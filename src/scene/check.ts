import { boardHeight, projectPoint, type View, type Stage } from './camera.js';
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

/**
 * Where a scene box lands on screen (stage pixels from the board's top
 * left), turned and in perspective as the view draws it: the bounds of its
 * four corners. Null when part of it is behind the camera.
 */
export function screenBox(box: Rect, view: View, stage: Stage): Rect | null {
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => projectPoint(view, stage, [x!, y!]));
  if (corners.some((c) => !c)) return null;
  const xs = corners.map((c) => c![0]);
  const ys = corners.map((c) => c![1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Evaluates the elements on stage against the current camera view and shot
 * settings. Framing, edges, text size and the title are judged on screen,
 * where the view (its angle included) puts each element.
 */
export function checkShot(
  shot: Shot,
  elements: readonly SceneElement[],
  view: View,
  stage: Stage,
  title?: string,
): ShotCheck {
  const screen: Rect = { x: 0, y: 0, width: stage.width, height: boardHeight(stage) };
  const touched = new Set(touchedIds(shot));
  const framing: { id: string; how: 'outside' | 'cut' }[] = [];
  const edges: string[] = [];
  const overlaps: [string, string][] = [];
  const activeElements = elements.filter((e) => !e.isDeleted && (e.opacity === undefined || e.opacity > 0));

  for (const el of activeElements) {
    const box = screenBox(boundsOf(el), view, stage);
    const overlap = box ? overlapArea(box, screen) : 0;
    const boxArea = box ? areaOf(box) : 0;

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
      // The text's height on screen where it sits: zoom, and perspective when the camera is angled.
      const b = boundsOf(el);
      const top = projectPoint(view, stage, [b.x + b.width / 2, b.y + b.height / 2]);
      const bottom = projectPoint(view, stage, [b.x + b.width / 2, b.y + b.height / 2 + el.fontSize]);
      if (!top || !bottom) continue;
      const px = Math.round(Math.hypot(bottom[0] - top[0], bottom[1] - top[1]));
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
    for (const el of activeElements) {
      const box = screenBox(boundsOf(el), view, stage);
      if (box && overlapArea(box, tBox) > 0) {
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
