/**
 * Keyframed control values. A track holds keyframes `{ time (ms), value,
 * easing }` for one control; the easing governs the segment leaving its
 * keyframe. Easing comes from `@pixerate/editor/animation`, and tracks keep
 * its `AnimationTrack` shape; Flair adds what control values need beyond
 * numbers and colours (vectors, booleans, images, ints).
 */

import {
  ANIMATION_EASING_PRESETS,
  cubicBezierAt as editorCubicBezierAt,
  evaluateEasing as evaluateAnimationEasing,
  isAnimationEasing,
  type AnimationEasing,
  type AnimationEasingPreset,
  type AnimationKeyframe,
  type AnimationTrack,
  type CubicBezierEasing,
  type SpringEasing,
} from "@pixerate/editor/animation";
import type { ControlDef, ControlValue } from "../shader/controls.js";
import { interpolateOklab, type ColorRGB } from "../shader/color.js";

/** Named easings (CSS keywords plus back and spring curves). */
export type EasingPreset = AnimationEasingPreset;
export type Easing = AnimationEasing;
export type { CubicBezierEasing, SpringEasing };

/** Every easing preset, in picker order. */
export const EASING_PRESETS: readonly EasingPreset[] = ANIMATION_EASING_PRESETS;

/** Eased progress at `u` (0–1) through a segment `durationMs` long (`@pixerate/editor`'s easing engine). */
export const evaluateEasing = evaluateAnimationEasing;

/** CSS `cubic-bezier(x1, y1, x2, y2)` solved for y at progress x. */
export const cubicBezierAt = editorCubicBezierAt;

/**
 * Whether `value` is an easing (a preset name, a cubic bezier or a spring),
 * with a spring's stiffness, damping and mass above 0 when given.
 */
export function isEasing(value: unknown): value is Easing {
  if (!isAnimationEasing(value)) return false;
  if (typeof value !== "object" || value.type !== "spring") return true;
  return [value.stiffness, value.damping, value.mass].every((v) => v === undefined || v > 0);
}

/** A keyframe of a control: like `AnimationKeyframe`, with any control value (vectors and booleans too). */
export interface Keyframe extends Omit<AnimationKeyframe, "value"> {
  value: ControlValue;
}

/** A control's keyframes: `AnimationTrack`'s shape, with control values. */
export interface Track extends Omit<AnimationTrack, "keyframes"> {
  /** Sorted by time, at most one per time. */
  keyframes: Keyframe[];
}

/**
 * A control value `t` of the way from `a` to `b`: numbers and vectors blend
 * (overshooting with back and spring easings), colours blend in Oklab, `int`s
 * round, and booleans and images switch halfway.
 */
export function interpolateControlValue(control: ControlDef | undefined, a: ControlValue, b: ControlValue, t: number): ControlValue {
  if (typeof a === "number" && typeof b === "number") {
    const v = a + (b - a) * t;
    return control?.type === "int" ? Math.round(v) : v;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    if (control?.color && a.length >= 3) {
      const rgb = interpolateOklab(a.slice(0, 3) as ColorRGB, b.slice(0, 3) as ColorRGB, t);
      const out = rgb.map((c) => Math.min(1, Math.max(0, c)));
      return a.length === 4 ? [...out, a[3]! + (b[3]! - a[3]!) * t] : out;
    }
    return a.map((v, i) => v + (b[i]! - v) * t);
  }
  return t < 0.5 ? a : b;
}

/** A track's value at `time` (ms), or undefined when it has no keyframes or is disabled. */
export function evaluateTrack(track: Track | undefined, time: number, control?: ControlDef): ControlValue | undefined {
  if (!track || track.enabled === false || track.keyframes.length === 0) return undefined;
  const keys = track.keyframes;
  if (time <= keys[0]!.time) return keys[0]!.value;
  const last = keys[keys.length - 1]!;
  if (time >= last.time) return last.value;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.time <= time) i++;
  const from = keys[i]!;
  const to = keys[i + 1]!;
  const span = to.time - from.time;
  const u = span > 0 ? (time - from.time) / span : 1;
  return interpolateControlValue(control, from.value, to.value, evaluateEasing(from.easing, u, span));
}

/** Keyframes sorted by time, one per time (the later of two at the same time wins). */
export function normalizeKeyframes(keyframes: readonly Keyframe[]): Keyframe[] {
  const byTime = new Map<number, Keyframe>();
  for (const k of keyframes) byTime.set(Math.round(k.time * 1000) / 1000, { ...k, time: Math.round(k.time * 1000) / 1000 });
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** The keyframe times across tracks, sorted and without duplicates. */
export function keyframeTimes(tracks: Record<string, Track>): number[] {
  return [...new Set(Object.values(tracks).flatMap((t) => t.keyframes.map((k) => k.time)))].sort((a, b) => a - b);
}
