/**
 * Keyframed control values. A track holds keyframes `{ time (ms), value,
 * easing }` for one control; the easing governs the segment leaving its
 * keyframe. The shapes and easing names match `@pixerate/editor`'s keyframe
 * animation (`AnimationTrack`, `AnimationEasing`), so timelines move between
 * the two unchanged.
 */

import type { ControlDef, ControlValue } from "../shader/controls.js";
import { interpolateOklab, type ColorRGB } from "../shader/color.js";

/** Named easings (CSS keywords plus back and spring curves). */
export type EasingPreset =
  | "linear"
  | "hold"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "ease-in-back"
  | "ease-out-back"
  | "spring";

export interface CubicBezierEasing {
  type: "cubic-bezier";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SpringEasing {
  type: "spring";
  /** Default 170. */
  stiffness?: number;
  /** Default 26. */
  damping?: number;
  /** Default 1. */
  mass?: number;
}

export type Easing = EasingPreset | CubicBezierEasing | SpringEasing;

/** Every easing preset, in picker order. */
export const EASING_PRESETS: readonly EasingPreset[] = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "ease-in-back",
  "ease-out-back",
  "spring",
  "hold",
];

const BEZIERS: Record<string, readonly [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  "ease-in-back": [0.36, 0, 0.66, -0.56],
  "ease-out-back": [0.34, 1.56, 0.64, 1],
};

export interface Keyframe {
  /** Ms from the start of the timeline. */
  time: number;
  value: ControlValue;
  /** Easing of the segment from this keyframe to the next (default `linear`). */
  easing?: Easing;
}

export interface Track {
  /** Sorted by time, at most one per time. */
  keyframes: Keyframe[];
  /** Disabled tracks keep their keyframes but do not animate (default `true`). */
  enabled?: boolean;
}

/** Whether `value` is an easing this module understands. */
export function isEasing(value: unknown): value is Easing {
  if (typeof value === "string") return (EASING_PRESETS as readonly string[]).includes(value);
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  if (e.type === "cubic-bezier") return ["x1", "y1", "x2", "y2"].every((k) => Number.isFinite(e[k]));
  if (e.type === "spring")
    return ["stiffness", "damping", "mass"].every((k) => e[k] === undefined || (typeof e[k] === "number" && e[k] > 0));
  return false;
}

/** CSS `cubic-bezier(x1, y1, x2, y2)` solved for y at progress x. */
export function cubicBezierAt(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  x1 = Math.min(1, Math.max(0, x1));
  x2 = Math.min(1, Math.max(0, x2));
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  const dx = (t: number) => 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = bx(t) - x;
    if (Math.abs(err) < 1e-6) return by(t);
    const d = dx(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i++) {
    if (bx(t) < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

/** A damped spring from 0 to 1 over `durationMs`, settling at 1. */
function springAt(easing: SpringEasing, u: number, durationMs: number): number {
  const k = easing.stiffness ?? 170;
  const c = easing.damping ?? 26;
  const m = easing.mass ?? 1;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  // Run long enough to settle, scaled into the segment.
  const t = u * Math.max(durationMs / 1000, 0.6);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** Eased progress at `u` (0–1) through a segment `durationMs` long. */
export function evaluateEasing(easing: Easing | undefined, u: number, durationMs = 1000): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (!easing || easing === "linear") return u;
  if (easing === "hold") return 0;
  if (easing === "spring") return springAt({ type: "spring" }, u, durationMs);
  if (typeof easing === "string") {
    const b = BEZIERS[easing];
    return b ? cubicBezierAt(b[0], b[1], b[2], b[3], u) : u;
  }
  if (easing.type === "spring") return springAt(easing, u, durationMs);
  return cubicBezierAt(easing.x1, easing.y1, easing.x2, easing.y2, u);
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
