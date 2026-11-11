import type { ControlDef, ControlValue } from "../shader/controls.js";
import { MAX_TRAIL, type ShaderClick } from "../shader/pointer.js";

/**
 * The pointer-trail effects (`comet-trail`, `ribbon-trail`, …) follow `iTrail`,
 * and with no pointer their `uDemo` walks a short trail along `uPath` over
 * time. An editor that paints with one along a stroke gives the stroke as
 * `uPath` points and wants the whole stroke drawn at once, so when `uPath` is
 * a points array (not SVG path data, which still walks) the adapters make
 * `iTrail` from it instead: {@link MAX_TRAIL} points spread evenly along the
 * path, the head at its end, their ages spread over half the effect's `uLife`
 * (so the tail fades as a trail does, but all of it shows), and `uDemo` off.
 */
export interface PathTrail {
  /** `iTrail`'s points, oldest first, in pixels from the bottom left (as the pointer's are). */
  trail: ShaderClick[];
  /** The values with `uDemo` off, so the shader reads `iTrail`. */
  values: Record<string, ControlValue>;
}

/** Whether an effect draws a pointer trail that a path can stand in for: it has a `uDemo` toggle and a path control. */
export function isPathTrailEffect(controls: readonly ControlDef[]): boolean {
  return controls.some((c) => c.name === "uDemo" && c.type === "bool") && controls.some((c) => c.type === "path");
}

/**
 * The trail for a frame `height` pixels tall at `time` seconds when `values`
 * gives the effect's path as points, else undefined (no points, SVG path
 * data, or not a trail effect).
 */
export function pathTrail(controls: readonly ControlDef[], values: Record<string, ControlValue>, height: number, time: number): PathTrail | undefined {
  if (!isPathTrailEffect(controls)) return undefined;
  const control = controls.find((c) => c.type === "path")!;
  const points = trailPoints(values[control.name]);
  if (!points) return undefined;
  const life = typeof values.uLife === "number" && values.uLife > 0 ? values.uLife : 1;
  return { trail: trailFromPoints(points, height, time, life), values: { ...values, uDemo: false } };
}

/** [x0, y0, x1, y1, …] pixels from the top left as points, or undefined when it is not at least two finite points. */
function trailPoints(value: ControlValue | undefined): [number, number][] | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < value.length; i += 2) {
    const x = value[i]!;
    const y = value[i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    out.push([x, y]);
  }
  return out;
}

/**
 * {@link MAX_TRAIL} points evenly along `points` (pixels from the top left),
 * oldest first, flipped to pixels from the bottom left; the last is the
 * path's end at `time`, and each before it `life / 2 / (MAX_TRAIL - 1)` s older.
 */
export function trailFromPoints(points: readonly [number, number][], height: number, time: number, life: number): ShaderClick[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[lengths.length - 1]!;
  const step = life / 2 / (MAX_TRAIL - 1);
  const out: ShaderClick[] = [];
  let seg = 1;
  for (let k = 0; k < MAX_TRAIL; k++) {
    const along = total * (k / (MAX_TRAIL - 1));
    while (seg < points.length - 1 && lengths[seg]! < along) seg++;
    const a = points[seg - 1]!;
    const b = points[Math.min(seg, points.length - 1)]!;
    const span = lengths[seg]! - lengths[seg - 1]!;
    const t = span > 0 ? Math.min(1, Math.max(0, (along - lengths[seg - 1]!) / span)) : 0;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    out.push({ x, y: height - y, time: time - (MAX_TRAIL - 1 - k) * step });
  }
  return out;
}
