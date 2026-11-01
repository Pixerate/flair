import { cameraTrack, type CameraShot } from './cameratrack.js';
import { LAYER_ROLES, layerKey, layerRole, type LayerRole, type LayerTime, type SceneLayer, type ShotTransition } from './layers.js';
import type { Scene } from './types.js';

/** A layer placed on the scene's timeline. */
export interface TimedLayer {
  /** Its `id`, or `shot<N>.layer<M>`. */
  key: string;
  /** The shot it is declared in (0-based). */
  shot: number;
  /** Its place in that shot's `layers` (0-based). */
  index: number;
  layer: SceneLayer;
  role: LayerRole;
  /** When it starts and stops on the scene's timeline, in ms. */
  startMs: number;
  endMs: number;
}

/** A shot's transition on the scene's timeline: from the shot's start, for `ms`. */
export interface TimedTransition {
  /** The shot it leads into (0-based, never the first). */
  shot: number;
  transition: ShotTransition;
  startMs: number;
  ms: number;
}

/**
 * When everything in a scene happens, as `playScene` plays it: each shot's
 * camera (see `cameraTrack`), each layer's stretch and each transition's.
 * Players, recorders and exporters that lay a scene out in time read it.
 */
export interface SceneTimeline {
  durationMs: number;
  shots: CameraShot[];
  layers: TimedLayer[];
  transitions: TimedTransition[];
}

/** A layer time on the scene's timeline: ms after its shot starts, or the start of a later shot (the scene's end past the last). */
export function layerTimeMs(time: LayerTime | undefined, shot: number, shots: readonly CameraShot[], durationMs: number, fallback: LayerTime): number {
  const t = time ?? fallback;
  const start = shots[shot]?.startMs ?? durationMs;
  if (typeof t === 'number') return start + Math.max(0, t);
  if (t && typeof t === 'object' && typeof t.shots === 'number') {
    const later = shots[shot + Math.max(0, Math.floor(t.shots))];
    return later ? later.startMs : durationMs;
  }
  return start;
}

const ROLE_ORDER = new Map(LAYER_ROLES.map((r, i) => [r, i]));

/** The scene's timeline: shots, layers and transitions in ms. */
export function sceneTimeline(scene: Scene): SceneTimeline {
  const shots = cameraTrack(scene);
  const last = shots.at(-1);
  const durationMs = last ? last.startMs + last.moveMs + last.holdMs : 0;
  const layers: TimedLayer[] = [];
  const transitions: TimedTransition[] = [];
  scene.shots.forEach((shot, s) => {
    (Array.isArray(shot.layers) ? shot.layers : []).forEach((layer, i) => {
      if (!layer || typeof layer !== 'object') return;
      const startMs = layerTimeMs(layer.from, s, shots, durationMs, 0);
      const endMs = layerTimeMs(layer.until, s, shots, durationMs, { shots: 1 });
      layers.push({ key: layerKey(layer, s, i), shot: s, index: i, layer, role: layerRole(layer), startMs, endMs });
    });
    const entry = shots[s]!;
    if (s > 0 && shot.transition && typeof shot.transition.effect === 'string' && entry.transitionMs > 0) {
      transitions.push({ shot: s, transition: shot.transition, startMs: entry.startMs, ms: entry.transitionMs });
    }
  });
  layers.sort((a, b) => ROLE_ORDER.get(a.role)! - ROLE_ORDER.get(b.role)! || a.shot - b.shot || a.index - b.index);
  return { durationMs, shots, layers, transitions };
}

/** A layer's opacity at a time on the scene's timeline: 0 outside its stretch, faded in and out over its `fade`. */
export function layerOpacityAt(timed: TimedLayer, ms: number): number {
  if (ms < timed.startMs || ms >= timed.endMs) return 0;
  const base = typeof timed.layer.opacity === 'number' ? Math.min(1, Math.max(0, timed.layer.opacity)) : 1;
  const fade = typeof timed.layer.fade === 'number' && timed.layer.fade > 0 ? timed.layer.fade : 0;
  if (!fade) return base;
  return base * Math.min(1, (ms - timed.startMs) / fade, (timed.endMs - ms) / fade);
}

/** The layers showing at a time, bottom of the stack first (background, then subject, then overlay; each in the order declared). */
export function layersAt(timeline: SceneTimeline, ms: number): TimedLayer[] {
  return timeline.layers.filter((l) => ms >= l.startMs && ms < l.endMs);
}

/** The transition playing at a time, with how far through it is (0 to 1), or undefined. */
export function transitionAt(timeline: SceneTimeline, ms: number): { timed: TimedTransition; progress: number } | undefined {
  const timed = timeline.transitions.find((t) => ms >= t.startMs && ms < t.startMs + t.ms);
  return timed ? { timed, progress: timed.ms > 0 ? (ms - timed.startMs) / timed.ms : 1 } : undefined;
}

/** The shot (0-based) playing at a time on the scene's timeline. */
export function shotAt(timeline: SceneTimeline, ms: number): number {
  let shot = 0;
  for (const entry of timeline.shots) if (ms >= entry.startMs) shot = entry.index;
  return shot;
}
