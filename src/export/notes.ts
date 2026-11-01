import { isSlot, layerWhat, subjectKind, type SceneLayer } from '../scene/layers.js';
import { sceneTimeline, type SceneTimeline, type TimedLayer } from '../scene/timeline.js';
import { namedElements } from '../scene/player.js';
import type { Rect } from '../scene/geometry.js';
import type { Scene } from '../scene/types.js';

/** The formats a scene exports to (see `exportLottie`, `exportMotn`, `exportFcp7Xml`, `exportCmx3600Edl`). */
export type SceneExportFormat = 'lottie' | 'motn' | 'fcp7' | 'edl';

const FORMAT_NAMES: Record<SceneExportFormat, string> = { lottie: 'Lottie', motn: 'Motion', fcp7: 'FCP7 XML', edl: 'the EDL' };

/** Whether a layer is a picture Lottie can carry: no effect, an image or SVG written in the scene (not a slot). */
export function lottiePicture(layer: SceneLayer): { url: string } | undefined {
  if (layer.effect !== undefined || layer.source !== undefined || !layer.subject || isSlot(layer.subject)) return undefined;
  const kind = subjectKind(layer.subject);
  if (kind === 'image') return { url: (layer.subject as { image: string }).image };
  if (kind === 'svg') {
    const svg = (layer.subject as { svg: string }).svg.trim();
    return { url: svg.startsWith('<') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : svg };
  }
  return undefined;
}

/** A layer's box on the board: its `rect`, or the bounds (with padding) of the elements it names as its shot drew them; undefined over the screen. */
export function layerBoard(t: TimedLayer, timeline: SceneTimeline): Rect | undefined {
  if (t.layer.rect) return t.layer.rect;
  if (!t.layer.ids) return undefined;
  const els = namedElements(t.layer.ids, timeline.shots[t.shot]?.elements ?? []);
  if (!els.length) return undefined;
  const pad = t.layer.padding ?? 0;
  const x = Math.min(...els.map((e) => e.x)) - pad;
  const y = Math.min(...els.map((e) => e.y)) - pad;
  return { x, y, width: Math.max(...els.map((e) => e.x + e.width)) + pad - x, height: Math.max(...els.map((e) => e.y + e.height)) + pad - y };
}

const named = (t: TimedLayer) => `Layer "${t.key}" (${layerWhat(t.layer)})`;

/**
 * What a format leaves out of a scene, or carries only in part, as
 * sentences: layers it cannot draw, transitions it plays as something
 * simpler. Empty when it carries everything. Each exporter writes these
 * into its file (an XML comment, EDL `*` lines, Lottie's `meta`), and
 * `flair export` prints them.
 */
export function sceneExportNotes(scene: Scene, format: SceneExportFormat): string[] {
  const timeline = sceneTimeline(scene);
  const notes: string[] = [];
  const name = FORMAT_NAMES[format];
  for (const t of timeline.layers) {
    if (format === 'lottie') {
      if (lottiePicture(t.layer)) continue;
      const why = t.layer.source !== undefined || t.layer.effect !== undefined ? 'Lottie cannot draw shaders or Flair\'s vector effects' : isSlot(t.layer.subject) ? 'its picture comes from a slot, filled only when it plays' : 'Lottie only takes pictures (images and SVGs)';
      notes.push(`${named(t)} is left out of the Lottie file: ${why}. Record it with recordEffect and add it as a picture or video.`);
    } else if (format === 'edl') {
      notes.push(`${named(t)} is a comment in the EDL, which has one picture track; place it in your editor from its times.`);
    } else {
      notes.push(`${named(t)} is a placeholder in ${name}, with its place and time but not its look; record it with recordEffect (or recordScene) and swap it in.`);
    }
  }
  for (const t of timeline.transitions) {
    const where = `Shot ${t.shot + 1}'s transition "${t.transition.effect}"`;
    if (format === 'lottie') notes.push(`${where} is a marker in the Lottie file, where the shots cut.`);
    else if (format === 'motn') notes.push(`${where} is a comment in Motion, where the shots cut; add a transition there.`);
    else notes.push(`${where} is a cross dissolve in ${name}, ${t.ms} ms long.`);
  }
  if (format === 'lottie' || format === 'motn') {
    scene.shots.forEach((shot, i) => {
      if ((shot.behaviors ?? []).some((b) => b?.type === 'path')) notes.push(`Shot ${i + 1}'s path behaviors are left out of ${name}: elements stay where the shot drew them.`);
    });
  }
  return notes;
}
