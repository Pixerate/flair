import type { ControlDef, ControlValue } from "../shader/controls.js";
import { listedControls, listedValues } from "./listed-controls.js";
import type { TimingBlend, TimingContext, TimingEffect, TimingFrame, TimingSample } from "./types.js";

/*
 * Timing effects retime video footage: for each frame of the result they name
 * the footage frames it shows and how to blend them. Each is a pure function
 * of where the frame is, so a frame can be drawn on its own, in any order, and
 * the host decodes only the footage it needs. Times are in ms; the footage
 * runs from 0 to its length, one frame every `1000 / fps` ms.
 */

/** Most footage frames one retimed frame blends: longer exposures skip frames evenly to stay within it. */
export const MAX_TIMING_FRAMES = 128;

/** The frame rate footage is taken to have when it does not say. */
export const DEFAULT_FOOTAGE_FPS = 30;

type Values = Readonly<Record<string, ControlValue>>;

/** A number control's value, or its fallback when it is missing or not a number. */
const num = (values: Values, name: string, fallback: number): number => {
  const v = values[name];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};

const flag = (values: Values, name: string, fallback: boolean): boolean => {
  const v = values[name];
  return typeof v === "boolean" ? v : fallback;
};

const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * The footage frames around footage time `s` while it plays at `speed`
 * (negative backwards): the one frame, or with `smooth` the two either side
 * of a slowed frame by nearness (frame blending), or the frames a sped-up one
 * passes over, averaged (as a 360° shutter would blur them).
 */
function atSpeed(s: number, speed: number, frameMs: number, smooth: boolean): TimingFrame[] {
  const step = Math.abs(speed);
  if (!smooth || step === 0) return [{ time: s, weight: 1 }];
  if (step <= 1) {
    const i = s / frameMs;
    const f = Math.floor(i + 1e-6);
    const frac = i - f;
    if (frac < 1e-3) return [{ time: f * frameMs, weight: 1 }];
    return [
      { time: f * frameMs, weight: 1 - frac },
      { time: (f + 1) * frameMs, weight: frac },
    ];
  }
  const n = Math.min(MAX_TIMING_FRAMES, Math.ceil(step));
  const dir = Math.sign(speed);
  return Array.from({ length: n }, (_, k) => ({ time: s + (dir * k * step * frameMs) / n, weight: 1 }));
}

const SMOOTH = { name: "smooth", type: "bool", label: "Blend frames" } as const;

export const retimeSpeed: TimingEffect = {
  kind: "timing",
  id: "retime-speed",
  name: "Speed change",
  description: "Footage played slower or faster throughout: slow motion with blended in-between frames, or a sped-up time-lapse with its motion blurred.",
  category: "timing",
  tags: ["timing", "retime", "speed", "slow-motion", "time-lapse", "video"],
  controls: [
    { name: "speed", type: "float", label: "Speed (×)", min: 0.1, max: 8, step: 0.05, default: 0.5 },
    { ...SMOOTH, default: true },
  ],
  motion: {
    length: (footage, values) => footage / num(values, "speed", 0.5),
    sample({ time, fps }, values) {
      const speed = num(values, "speed", 0.5);
      return { frames: atSpeed(time * speed, speed, 1000 / fps, flag(values, "smooth", true)) };
    },
  },
  presets: [
    { name: "Slow motion", values: { speed: 0.25 } },
    { name: "Double speed", values: { speed: 2 } },
    { name: "Time-lapse", values: { speed: 8 } },
    { name: "Choppy slow motion", values: { speed: 0.25, smooth: false } },
  ],
};

/** Footage samples the ramp's time map is worked out at. */
const RAMP_STEPS = 512;

/** The ramp's speed at footage time `s` (ms): `slow` round the moment, `fast` beyond the ramps either side. */
function rampSpeed(s: number, footage: number, values: Values): number {
  const slow = num(values, "slow", 0.2);
  const fast = num(values, "fast", 1);
  const centre = num(values, "at", 0.5) * footage;
  const inner = (num(values, "hold", 0.6) * 1000) / 2;
  const ramp = Math.max(1, num(values, "ramp", 0.4) * 1000);
  const d = Math.abs(s - centre);
  return slow + (fast - slow) * smoothstep((d - inner) / ramp);
}

/** Output ms at each of `RAMP_STEPS + 1` evenly spaced footage times: the time each part of the footage takes at its speed. */
function rampTable(footage: number, values: Values): Float64Array {
  const out = new Float64Array(RAMP_STEPS + 1);
  const h = footage / RAMP_STEPS;
  for (let i = 0; i < RAMP_STEPS; i++) {
    out[i + 1] = out[i]! + (h / 2) * (1 / rampSpeed(i * h, footage, values) + 1 / rampSpeed((i + 1) * h, footage, values));
  }
  return out;
}

export const retimeRamp: TimingEffect = {
  kind: "timing",
  id: "retime-ramp",
  name: "Speed ramp",
  description: "Footage that eases from full speed into slow motion round one moment and back out again, like a sports replay.",
  category: "timing",
  tags: ["timing", "retime", "speed", "ramp", "slow-motion", "sport", "replay", "video"],
  controls: [
    { name: "at", type: "float", label: "Slow moment (share of the footage)", min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: "slow", type: "float", label: "Slow speed (×)", min: 0.05, max: 1, step: 0.05, default: 0.2 },
    { name: "fast", type: "float", label: "Speed either side (×)", min: 0.25, max: 4, step: 0.05, default: 1 },
    { name: "hold", type: "float", label: "Slow stretch (s of footage)", min: 0, max: 5, step: 0.05, default: 0.6 },
    { name: "ramp", type: "float", label: "Ramp (s of footage)", min: 0.05, max: 2, step: 0.05, default: 0.4 },
    { ...SMOOTH, default: true },
  ],
  motion: {
    length: (footage, values) => rampTable(footage, values)[RAMP_STEPS]!,
    sample({ time, footage, fps }, values) {
      const table = rampTable(footage, values);
      const h = footage / RAMP_STEPS;
      let s: number;
      if (time >= table[RAMP_STEPS]!) s = footage;
      else if (time <= 0) s = 0;
      else {
        // The step whose output times hold `time`, then straight between its ends.
        let lo = 0;
        let hi = RAMP_STEPS;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (table[mid]! <= time) lo = mid;
          else hi = mid;
        }
        s = (lo + (time - table[lo]!) / (table[hi]! - table[lo]!)) * h;
      }
      return { frames: atSpeed(s, rampSpeed(s, footage, values), 1000 / fps, flag(values, "smooth", true)) };
    },
  },
  presets: [
    { name: "Sports replay", values: { fast: 2, slow: 0.15, hold: 0.8, ramp: 0.3 } },
    { name: "Gentle", values: { slow: 0.5, ramp: 1 } },
    { name: "Snap", values: { slow: 0.1, hold: 0.3, ramp: 0.1 } },
  ],
};

export const retimeReverse: TimingEffect = {
  kind: "timing",
  id: "retime-reverse",
  name: "Reverse",
  description: "Footage played backwards from its last frame to its first.",
  category: "timing",
  tags: ["timing", "retime", "reverse", "rewind", "backwards", "video"],
  controls: [
    { name: "speed", type: "float", label: "Speed (×)", min: 0.25, max: 4, step: 0.05, default: 1 },
    { ...SMOOTH, default: true },
  ],
  motion: {
    length: (footage, values) => footage / num(values, "speed", 1),
    sample({ time, footage, fps }, values) {
      const speed = num(values, "speed", 1);
      const frameMs = 1000 / fps;
      return { frames: atSpeed(footage - frameMs - time * speed, -speed, frameMs, flag(values, "smooth", true)) };
    },
  },
  presets: [
    { name: "Rewind", values: { speed: 3 } },
    { name: "Slow reverse", values: { speed: 0.5 } },
  ],
};

export const retimeBoomerang: TimingEffect = {
  kind: "timing",
  id: "retime-boomerang",
  name: "Boomerang",
  description: "Footage played forwards then backwards, again and again, sped up like a social-media boomerang.",
  category: "timing",
  tags: ["timing", "retime", "boomerang", "loop", "ping-pong", "reverse", "social", "video"],
  controls: [
    { name: "speed", type: "float", label: "Speed (×)", min: 0.5, max: 4, step: 0.05, default: 1.5 },
    { name: "loops", type: "int", label: "There and back", min: 1, max: 5, step: 1, default: 2 },
    { ...SMOOTH, default: false },
  ],
  motion: {
    length: (footage, values) => ((2 * footage) / num(values, "speed", 1.5)) * num(values, "loops", 2),
    sample({ time, footage, fps }, values) {
      const speed = num(values, "speed", 1.5);
      const frameMs = 1000 / fps;
      // One way takes `pass` ms; the last frame is shown once at the turn, not twice.
      const span = Math.max(frameMs, footage - frameMs);
      const pass = span / speed;
      const u = ((time % (2 * pass)) + 2 * pass) % (2 * pass);
      const forward = u < pass;
      const s = forward ? u * speed : (2 * pass - u) * speed;
      return { frames: atSpeed(s, forward ? speed : -speed, frameMs, flag(values, "smooth", false)) };
    },
  },
  presets: [
    { name: "Quick", values: { speed: 2.5, loops: 3 } },
    { name: "Lazy", values: { speed: 0.75, loops: 1, smooth: true } },
  ],
};

export const retimeFreeze: TimingEffect = {
  kind: "timing",
  id: "retime-freeze",
  name: "Freeze frame",
  description: "Footage that stops dead on one frame, holds it, then plays on from where it stopped.",
  category: "timing",
  tags: ["timing", "retime", "freeze", "freeze-frame", "hold", "pause", "video"],
  controls: [
    { name: "at", type: "float", label: "Freeze at (share of the footage)", min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: "hold", type: "float", label: "Hold (s)", min: 0.1, max: 10, step: 0.1, default: 1.5 },
  ],
  motion: {
    length: (footage, values) => footage + num(values, "hold", 1.5) * 1000,
    sample({ time, footage, fps }, values) {
      const frameMs = 1000 / fps;
      // The frame being shown when it stops.
      const at = Math.floor((num(values, "at", 0.5) * footage) / frameMs + 1e-6) * frameMs;
      const hold = num(values, "hold", 1.5) * 1000;
      const s = time < at ? time : time < at + hold ? at : time - hold;
      return { frames: [{ time: s, weight: 1 }] };
    },
  },
  presets: [
    { name: "Beat", values: { hold: 0.5 } },
    { name: "Long hold", values: { hold: 4 } },
    { name: "Opening still", values: { at: 0, hold: 2 } },
  ],
};

export const retimeStutter: TimingEffect = {
  kind: "timing",
  id: "retime-stutter",
  name: "Stutter",
  description: "Footage that catches on short snatches, replaying each a few times before it moves on, like a skipping record.",
  category: "timing",
  tags: ["timing", "retime", "stutter", "repeat", "glitch", "skip", "music-video", "video"],
  controls: [
    { name: "chunk", type: "float", label: "Snatch (s)", min: 0.04, max: 1, step: 0.01, default: 0.16 },
    { name: "repeats", type: "int", label: "Plays of each snatch", min: 2, max: 8, step: 1, default: 3 },
    { name: "every", type: "int", label: "Stutter every (snatches)", min: 1, max: 8, step: 1, default: 4 },
  ],
  motion: {
    length(footage, values) {
      const chunk = num(values, "chunk", 0.16) * 1000;
      const every = num(values, "every", 4);
      // Each whole group of `every` snatches replays its last one; what is left plays straight.
      return footage + Math.floor(footage / (every * chunk)) * (num(values, "repeats", 3) - 1) * chunk;
    },
    sample({ time, footage }, values) {
      const chunk = num(values, "chunk", 0.16) * 1000;
      const every = num(values, "every", 4);
      const repeats = num(values, "repeats", 3);
      const groups = Math.floor(footage / (every * chunk));
      const groupOut = (every - 1 + repeats) * chunk;
      const g = Math.floor(Math.max(0, time) / groupOut);
      let s: number;
      if (g >= groups) s = groups * every * chunk + (time - groups * groupOut);
      else {
        const r = time - g * groupOut;
        const straight = (every - 1) * chunk;
        s = g * every * chunk + (r < straight ? r : straight + ((r - straight) % chunk));
      }
      return { frames: [{ time: s, weight: 1 }] };
    },
  },
  presets: [
    { name: "Glitch", values: { chunk: 0.06, repeats: 4, every: 2 } },
    { name: "Beat repeat", values: { chunk: 0.5, repeats: 2, every: 4 } },
  ],
};

export const retimeStep: TimingEffect = {
  kind: "timing",
  id: "retime-step",
  name: "Step frames",
  description: "Footage that holds each frame a while at a low frame rate, for a choppy stop-motion or animated-on-twos look.",
  category: "timing",
  tags: ["timing", "retime", "frame-rate", "stop-motion", "choppy", "on-twos", "video"],
  controls: [{ name: "rate", type: "float", label: "Frames per second", min: 2, max: 24, step: 1, default: 8 }],
  motion: {
    length: (footage) => footage,
    sample({ time }, values) {
      const hold = 1000 / num(values, "rate", 8);
      return { frames: [{ time: Math.floor(time / hold + 1e-6) * hold, weight: 1 }] };
    },
  },
  presets: [
    { name: "On twos", values: { rate: 12 } },
    { name: "Stop motion", values: { rate: 6 } },
    { name: "Slideshow", values: { rate: 2 } },
  ],
};

export const frameEcho: TimingEffect = {
  kind: "timing",
  id: "frame-echo",
  name: "Frame echo",
  description: "Each frame of footage with fading copies of the frames just before it, so moving things leave a trail of ghosts.",
  category: "timing",
  tags: ["timing", "echo", "ghost", "trail", "onion-skin", "video"],
  controls: [
    { name: "echoes", type: "int", label: "Echoes", min: 1, max: 8, step: 1, default: 4 },
    { name: "spacing", type: "float", label: "Spacing (s)", min: 0.02, max: 0.5, step: 0.01, default: 0.1 },
    { name: "decay", type: "float", label: "Each echo's strength", min: 0.1, max: 0.95, step: 0.05, default: 0.6 },
    { name: "lighten", type: "bool", label: "Brightest wins", default: false },
  ],
  motion: {
    length: (footage) => footage,
    sample({ time }, values) {
      const spacing = num(values, "spacing", 0.1) * 1000;
      const decay = num(values, "decay", 0.6);
      const frames: TimingFrame[] = [];
      // Echoes from before the footage starts are left out, not held on its first frame.
      for (let k = 0; k <= num(values, "echoes", 4); k++) {
        const t = time - k * spacing;
        if (t < 0) break;
        frames.push({ time: t, weight: Math.pow(decay, k) });
      }
      return { frames, blend: flag(values, "lighten", false) ? "lighten" : "average" };
    },
  },
  presets: [
    { name: "Onion skin", values: { echoes: 6, spacing: 0.15, decay: 0.75 } },
    { name: "Light ghosts", values: { echoes: 8, spacing: 0.05, decay: 0.8, lighten: true } },
  ],
};

export const longExposure: TimingEffect = {
  kind: "timing",
  id: "long-exposure",
  name: "Long exposure",
  description:
    "Footage seen through a shutter held open: moving water turns silky and crowds melt away, or the brightest lights draw streaks, while whatever stays still stays sharp.",
  category: "timing",
  tags: ["timing", "long-exposure", "light-trails", "motion-blur", "photography", "silky", "night", "video"],
  controls: [
    { name: "exposure", type: "float", label: "Exposure (s)", min: 0.1, max: 10, step: 0.1, default: 1.5 },
    { name: "lighten", type: "bool", label: "Light trails (brightest wins)", default: false },
    { name: "fade", type: "float", label: "Fade older frames", min: 0, max: 1, step: 0.05, default: 0 },
    { name: "build", type: "bool", label: "Build from the start", default: false },
  ],
  motion: {
    length: (footage) => footage,
    sample({ time, fps }, values) {
      const frameMs = 1000 / fps;
      const start = flag(values, "build", false) ? 0 : Math.max(0, time - num(values, "exposure", 1.5) * 1000);
      const span = Math.max(frameMs, time - start);
      const fade = num(values, "fade", 0);
      // Every frame the shutter is open for, or evenly spaced ones when there are more than can be blended.
      const count = Math.floor((time - start) / frameMs + 1e-6) + 1;
      const stride = Math.ceil(count / MAX_TIMING_FRAMES);
      const frames: TimingFrame[] = [];
      for (let k = 0; k < count; k += stride) {
        const age = k * frameMs;
        frames.push({ time: time - age, weight: 1 - fade * Math.min(1, age / span) + 1e-3 });
      }
      return { frames, blend: flag(values, "lighten", false) ? "lighten" : "average" };
    },
  },
  presets: [
    { name: "Silky water", values: { exposure: 2 } },
    { name: "Light trails", values: { exposure: 4, lighten: true, fade: 0.5 } },
    { name: "Empty streets", values: { exposure: 8 } },
    { name: "Building trails", values: { lighten: true, build: true } },
  ],
};

/** Retimes of video footage: speed changes, ramps, reverses, freezes, stutters, echoes and long exposures. */
export const timingEffects: TimingEffect[] = [retimeSpeed, retimeRamp, retimeReverse, retimeBoomerang, retimeFreeze, retimeStutter, retimeStep, frameEcho, longExposure];

const byId = new Map(timingEffects.map((e) => [e.id, e]));

/** The timing effect with this id, or undefined: for code that needs only the timing effects, not the whole catalog. */
export function getTimingEffect(id: string): TimingEffect | undefined {
  return byId.get(id);
}

/** A timing effect's controls, as `effectControls` gives them. */
export function timingControls(effect: TimingEffect): ControlDef[] {
  return listedControls(effect);
}

/**
 * A timing effect's values: each control's default, overridden by a preset
 * (by name) and then `values`. Problems are sentences: an unknown preset or
 * control, or a value of the wrong type or out of range (left at its default).
 */
export function timingValues(
  effect: TimingEffect,
  options: { preset?: string; values?: Readonly<Record<string, unknown>> } = {},
): { values: Record<string, ControlValue>; issues: string[] } {
  return listedValues(effect, options);
}

/** Checks footage's length and frame rate, throwing a sentence naming the valid range. */
function checkFootage(footage: number, fps: number): void {
  if (typeof footage !== "number" || !Number.isFinite(footage) || footage <= 0) throw new Error(`The footage's length is a number of ms above 0; it was ${String(footage)}.`);
  if (typeof fps !== "number" || !Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error(`The footage's frame rate is above 0 and at most 240 frames per second; it was ${String(fps)}.`);
}

/** The values to run an effect with: checked and filled in, or a thrown sentence listing what is wrong. */
function checkedValues(effect: TimingEffect, values: Readonly<Record<string, unknown>> | undefined): Record<string, ControlValue> {
  const checked = timingValues(effect, values ? { values } : {});
  if (checked.issues.length) throw new Error(checked.issues.join(" "));
  return checked.values;
}

/**
 * Ms the retimed clip lasts for footage `footage` ms long (a speed change
 * stretches or squeezes it, a freeze adds its hold, a boomerang goes there and
 * back). Throws a sentence for a bad length or value.
 */
export function timingLength(effect: TimingEffect, footage: number, values?: Readonly<Record<string, unknown>>): number {
  checkFootage(footage, DEFAULT_FOOTAGE_FPS);
  return Math.max(0, effect.motion.length(footage, checkedValues(effect, values)));
}

/**
 * The footage frames retimed frame `ctx.time` is made of, ready to draw: each
 * time held within the footage and moved to the start of its frame, frames
 * that land on the same footage frame merged, at most
 * {@link MAX_TIMING_FRAMES} (evenly spaced when an effect asks for more), and
 * weights scaled to add up to 1, earliest frame first. `ctx.fps` defaults to
 * {@link DEFAULT_FOOTAGE_FPS}. Throws a sentence for a bad context or value.
 *
 * ```ts
 * timingSample(longExposure, { time: 2000, footage: 6000 }, { exposure: 1 });
 * // { frames: [{ time: 1000, weight: 1/31 }, …, { time: 2000, weight: 1/31 }], blend: "average" }
 * ```
 */
export function timingSample(
  effect: TimingEffect,
  ctx: Omit<TimingContext, "fps"> & { fps?: number },
  values?: Readonly<Record<string, unknown>>,
): Required<TimingSample> {
  const fps = ctx.fps ?? DEFAULT_FOOTAGE_FPS;
  checkFootage(ctx.footage, fps);
  if (typeof ctx.time !== "number" || !Number.isFinite(ctx.time)) throw new Error(`The time is a number of ms into the retimed clip; it was ${String(ctx.time)}.`);
  const frameMs = 1000 / fps;
  const last = Math.max(0, Math.ceil(ctx.footage / frameMs) - 1);
  const frameOf = (t: number) => Math.min(last, Math.max(0, Math.floor(t / frameMs + 1e-6)));
  const sample = effect.motion.sample({ time: ctx.time, footage: ctx.footage, fps }, checkedValues(effect, values));
  const weights = new Map<number, number>();
  for (const f of sample.frames) {
    if (!Number.isFinite(f.time) || !Number.isFinite(f.weight) || f.weight <= 0) continue;
    const i = frameOf(f.time);
    weights.set(i, (weights.get(i) ?? 0) + f.weight);
  }
  if (!weights.size) weights.set(frameOf(ctx.time), 1);
  let frames = [...weights.entries()].sort((a, b) => a[0] - b[0]);
  if (frames.length > MAX_TIMING_FRAMES) {
    const stride = frames.length / MAX_TIMING_FRAMES;
    frames = Array.from({ length: MAX_TIMING_FRAMES }, (_, k) => frames[Math.floor(k * stride)]!);
  }
  const total = frames.reduce((sum, [, w]) => sum + w, 0);
  return { frames: frames.map(([i, w]) => ({ time: (i * 1000) / fps, weight: w / total })), blend: sample.blend ?? "average" };
}

/* ---------- Drawing retimed frames ---------- */

/**
 * Blends straight-alpha RGBA frames (rows of 8-bit RGBA, the same size) by
 * weight: `average` in premultiplied alpha, so transparent edges do not
 * darken; `lighten` keeps each channel's brightest, each frame dimmed by its
 * weight against the heaviest. Sums are kept in a `Float64Array` it reuses.
 */
export class FrameBlender {
  private readonly sums: Float64Array;

  constructor(readonly pixels: number) {
    this.sums = new Float64Array(pixels * 4);
  }

  /** Writes the blend of `frames` into `out` (straight alpha, rounded). */
  blend<T extends Uint8Array | Uint8ClampedArray>(frames: readonly { rgba: ArrayLike<number>; weight: number }[], blend: TimingBlend, out: T): T {
    const s = this.sums;
    if (out.length !== s.length) throw new Error(`The blend has ${this.pixels} pixels; the output has room for ${out.length / 4}.`);
    for (const f of frames) if (f.rgba.length !== s.length) throw new Error(`A frame of ${f.rgba.length / 4} pixels cannot be blended with frames of ${this.pixels}.`);
    if (!frames.length) throw new Error("There are no frames to blend.");
    if (frames.length === 1) {
      const only = frames[0]!.rgba;
      for (let i = 0; i < s.length; i++) out[i] = only[i]!;
      return out;
    }
    s.fill(0);
    if (blend === "lighten") {
      const heaviest = Math.max(...frames.map((f) => f.weight));
      for (const f of frames) {
        const k = heaviest > 0 ? f.weight / heaviest : 1;
        const p = f.rgba;
        for (let i = 0; i < s.length; i += 4) {
          const a = (p[i + 3]! / 255) * k;
          if (p[i]! * a > s[i]!) s[i] = p[i]! * a;
          if (p[i + 1]! * a > s[i + 1]!) s[i + 1] = p[i + 1]! * a;
          if (p[i + 2]! * a > s[i + 2]!) s[i + 2] = p[i + 2]! * a;
          if (a > s[i + 3]!) s[i + 3] = a;
        }
      }
      for (let i = 0; i < s.length; i += 4) {
        const a = s[i + 3]!;
        // Colour is kept as it was dimmed (a faded trail is darker), not divided back up by its alpha.
        out[i] = Math.min(255, Math.round(s[i]!));
        out[i + 1] = Math.min(255, Math.round(s[i + 1]!));
        out[i + 2] = Math.min(255, Math.round(s[i + 2]!));
        out[i + 3] = Math.min(255, Math.round(a * 255));
      }
      return out;
    }
    let total = 0;
    for (const f of frames) {
      total += f.weight;
      const w = f.weight;
      const p = f.rgba;
      for (let i = 0; i < s.length; i += 4) {
        const a = p[i + 3]! * w;
        s[i] += p[i]! * a;
        s[i + 1] += p[i + 1]! * a;
        s[i + 2] += p[i + 2]! * a;
        s[i + 3] += a;
      }
    }
    for (let i = 0; i < s.length; i += 4) {
      const a = s[i + 3]!;
      if (a > 0) {
        out[i] = Math.min(255, Math.round(s[i]! / a));
        out[i + 1] = Math.min(255, Math.round(s[i + 1]! / a));
        out[i + 2] = Math.min(255, Math.round(s[i + 2]! / a));
      } else out[i] = out[i + 1] = out[i + 2] = 0;
      out[i + 3] = total > 0 ? Math.min(255, Math.round(a / total)) : 0;
    }
    return out;
  }
}

/**
 * Footage a timing effect retimes: its size, length and frame rate, and its
 * picture at any time. `embed`'s `videoFootage` makes one from a `<video>`,
 * and `previewFootage` a clip of its own to preview effects on.
 */
export interface TimingFootage {
  readonly width: number;
  readonly height: number;
  /** Ms of footage. */
  readonly duration: number;
  /** Frames per second (default {@link DEFAULT_FOOTAGE_FPS}). */
  readonly fps?: number;
  /** Writes the frame at `ms` into the footage as straight RGBA, rows top down, `width` × `height`. */
  frame(ms: number, out: Uint8ClampedArray): void | Promise<void>;
}

/**
 * Draws a timing effect's frames from footage: each frame's footage frames
 * (see {@link timingSample}) fetched, earliest first, and blended. Frames are
 * kept between calls, so the next frame of a long exposure fetches only what
 * is new. Not safe for concurrent `render` calls: await each.
 *
 * ```ts
 * const retime = new TimingRenderer(longExposure, footage, { values: { exposure: 2 } });
 * const out = new Uint8ClampedArray(footage.width * footage.height * 4);
 * for (let t = 0; t < retime.length; t += 1000 / 30) await retime.render(t, out);
 * ```
 */
export class TimingRenderer {
  private values: Record<string, ControlValue>;
  private readonly blender: FrameBlender;
  /** Footage frames by index, the most recently used last. */
  private readonly cache = new Map<number, Uint8ClampedArray>();

  constructor(
    readonly effect: TimingEffect,
    readonly footage: TimingFootage,
    options: { preset?: string; values?: Readonly<Record<string, unknown>> } = {},
  ) {
    checkFootage(footage.duration, this.fps);
    const checked = timingValues(effect, options);
    if (checked.issues.length) throw new Error(checked.issues.join(" "));
    this.values = checked.values;
    this.blender = new FrameBlender(footage.width * footage.height);
  }

  private get fps(): number {
    return this.footage.fps ?? DEFAULT_FOOTAGE_FPS;
  }

  /** Ms the retimed clip lasts. */
  get length(): number {
    return Math.max(0, this.effect.motion.length(this.footage.duration, this.values));
  }

  /** Changes control values (merged over the current ones); throws a sentence for an unknown control or a bad value, leaving them as they were. */
  setValues(values: Readonly<Record<string, unknown>>): void {
    this.values = checkedValues(this.effect, { ...this.values, ...values });
  }

  /** Forgets the footage frames it keeps: call it when the footage's pictures change. */
  clear(): void {
    this.cache.clear();
  }

  /** Draws retimed frame `time` (ms) into `out` as straight RGBA, and gives the sample it drew. */
  async render(time: number, out: Uint8ClampedArray): Promise<Required<TimingSample>> {
    const sample = timingSample(this.effect, { time, footage: this.footage.duration, fps: this.fps }, this.values);
    const frameMs = 1000 / this.fps;
    const frames: { rgba: Uint8ClampedArray; weight: number }[] = [];
    for (const f of sample.frames) frames.push({ rgba: await this.frame(Math.round(f.time / frameMs)), weight: f.weight });
    this.blender.blend(frames, sample.blend, out);
    // Keep about two exposures' worth, dropping the least recently used.
    const keep = Math.max(8, sample.frames.length * 2);
    for (const key of this.cache.keys()) {
      if (this.cache.size <= keep) break;
      this.cache.delete(key);
    }
    return sample;
  }

  private async frame(index: number): Promise<Uint8ClampedArray> {
    const kept = this.cache.get(index);
    if (kept) {
      this.cache.delete(index);
      this.cache.set(index, kept);
      return kept;
    }
    const rgba = new Uint8ClampedArray(this.footage.width * this.footage.height * 4);
    await this.footage.frame((index * 1000) / this.fps, rgba);
    this.cache.set(index, rgba);
    return rgba;
  }
}
