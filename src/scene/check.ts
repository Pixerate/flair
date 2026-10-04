import { visibleRect, type View, type Stage } from './camera.js';
import { boundsOf, overlapArea, areaOf, type Rect, type SceneElement } from './geometry.js';
import { isElementCommand, type Shot } from './types.js';

export interface ShotCheck {
  /** Elements this shot drew or changed that the camera frame leaves out ("outside") or cuts ("cut"). */
  framing: { id: string; how: 'outside' | 'cut' }[];
  /** Elements this shot drew that overlap each other significantly. */
  overlaps: [string, string][];
  /** Smallest text size on screen in CSS px. */
  smallestText?: { id: string; text: string; px: number };
  /** Any text smaller than min readable threshold (e.g. 18px). */
  smallTexts?: { id: string; text: string; px: number }[];
  /** Elements clipped by the screen edges. */
  edges: string[];
  /** Elements covered by the title bar. */
  underTitle: string[];
}

export const NO_CHECK: ShotCheck = { framing: [], overlaps: [], edges: [], underTitle: [] };

export const SMALL_TEXT_PX = 24;

export function titleBox(title: string, stage: Stage): Rect {
  const width = Math.min(stage.width, title.length * 20 + 64);
  return { x: (stage.width - width) / 2, y: 24, width, height: 60 };
}

export function touchedIds(shot: Shot): string[] {
  const ids = new Set<string>();
  for (const cmd of shot.run ?? []) {
    if (isElementCommand(cmd)) {
      ids.add(cmd.element.id);
    } else if ('id' in cmd && typeof (cmd as any).id === 'string') {
      ids.add((cmd as any).id);
    }
  }
  return [...ids];
}

const IN_FRAME = 0.95;

/** Evaluates the elements on stage against the current camera view and shot settings. */
export function checkShot(
  shot: Shot,
  elements: readonly SceneElement[],
  view: View,
  stage: Stage,
  title?: string,
): ShotCheck {
  const frameRect = visibleRect(view, stage);
  const touched = new Set(touchedIds(shot));
  const framing: { id: string; how: 'outside' | 'cut' }[] = [];
  const edges: string[] = [];
  const overlaps: [string, string][] = [];
  const activeElements = elements.filter((e) => !e.isDeleted && (e.opacity === undefined || e.opacity > 0));

  for (const el of activeElements) {
    const box = boundsOf(el);
    const overlap = overlapArea(box, frameRect);
    const boxArea = areaOf(box);

    if (touched.has(el.id)) {
      if (overlap === 0) {
        framing.push({ id: el.id, how: 'outside' });
      } else if (boxArea > 0 && overlap / boxArea < IN_FRAME) {
        framing.push({ id: el.id, how: 'cut' });
      }
    } else if (overlap > 0 && boxArea > 0 && overlap / boxArea < IN_FRAME) {
      edges.push(el.id);
    }
  }

  // Check overlaps among touched elements
  const touchedList = activeElements.filter((e) => touched.has(e.id));
  for (let i = 0; i < touchedList.length; i++) {
    for (let j = i + 1; j < touchedList.length; j++) {
      const a = touchedList[i]!;
      const b = touchedList[j]!;
      const aBox = boundsOf(a);
      const bBox = boundsOf(b);
      const ol = overlapArea(aBox, bBox);
      const minArea = Math.min(areaOf(aBox), areaOf(bBox));
      if (minArea > 0 && ol / minArea > 0.3) {
        overlaps.push([a.id, b.id]);
      }
    }
  }

  // Check text readability under current zoom
  const smallTexts: { id: string; text: string; px: number }[] = [];
  let smallestText: { id: string; text: string; px: number } | undefined;

  for (const el of activeElements) {
    if (el.text && el.fontSize) {
      const px = Math.round(el.fontSize * view.zoom);
      const item = { id: el.id, text: el.text, px };
      if (!smallestText || px < smallestText.px) {
        smallestText = item;
      }
      if (px < SMALL_TEXT_PX) {
        smallTexts.push(item);
      }
    }
  }

  // Check title obstruction
  const underTitle: string[] = [];
  if (title) {
    const tBox = titleBox(title, stage);
    // Convert tBox in screen space to scene space
    const sceneTBox: Rect = {
      x: tBox.x / view.zoom - view.scrollX,
      y: tBox.y / view.zoom - view.scrollY,
      width: tBox.width / view.zoom,
      height: tBox.height / view.zoom,
    };
    for (const el of activeElements) {
      if (overlapArea(boundsOf(el), sceneTBox) > 0) {
        underTitle.push(el.id);
      }
    }
  }

  return {
    framing,
    overlaps,
    smallestText,
    smallTexts: smallTexts.length ? smallTexts : undefined,
    edges,
    underTitle,
  };
}
