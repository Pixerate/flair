/**
 * Shutter-angle motion blur for recordings: each output frame is the average
 * of several sub-frames drawn while a film camera's shutter would be open.
 * Pure and dependency-free, so the browser recorder (`recordEffect`) and the
 * Node exporter (`exportEffect`, `exportMotionGraphic`) share it, and it is
 * testable without a GPU.
 */

/** The shutter options a recording or export takes. */
export interface ShutterOptions {
  /**
   * Motion blur, as a film camera's shutter angle in degrees, 0 to 360
   * (default 0, off). The shutter is open for `(shutterAngle / 360) / fps`
   * seconds from each frame's time, and the frame is the average of
   * `shutterSamples` pictures drawn across that time. 180 is a film
   * camera's usual; 360 blurs each frame into the next.
   */
  shutterAngle?: number;
  /**
   * Sub-frames averaged into each frame when `shutterAngle` is above 0: a
   * whole number, 2 to 32 (default 8). More is smoother and slower: the
   * render draws this many pictures per frame.
   */
  shutterSamples?: number;
}

/** A checked shutter: the angle in degrees (above 0) and the sub-frames per frame. */
export interface Shutter {
  angle: number;
  samples: number;
}

/** The default sub-frames per frame. */
export const DEFAULT_SHUTTER_SAMPLES = 8;

/**
 * Checks the shutter options: undefined when there is no blur (angle 0 or
 * absent), else the angle and sample count. Throws a sentence naming the
 * valid range when either is out of it (`shutterSamples` is checked even
 * when the angle is 0, so a typo does not pass unnoticed).
 */
export function checkShutter(options: ShutterOptions): Shutter | undefined {
  const { shutterAngle: angle = 0, shutterSamples: samples = DEFAULT_SHUTTER_SAMPLES } = options;
  if (typeof angle !== 'number' || !Number.isFinite(angle) || angle < 0 || angle > 360) {
    throw new Error(`shutterAngle is 0 to 360 degrees (180 is a film camera's usual, 0 is no motion blur); it was ${String(angle)}.`);
  }
  if (typeof samples !== 'number' || !Number.isInteger(samples) || samples < 2 || samples > 32) {
    throw new Error(`shutterSamples is a whole number of sub-frames from 2 to 32 (default ${DEFAULT_SHUTTER_SAMPLES}); it was ${String(samples)}.`);
  }
  return angle > 0 ? { angle, samples } : undefined;
}

/**
 * The times of a frame's sub-frames: the shutter opens at `time` for
 * `(angle / 360) / fps` seconds, and sub-frame k of N sits at the middle of
 * its slice, `time + ((k + 0.5) / N) × open`.
 */
export function shutterTimes(time: number, fps: number, shutter: Shutter): number[] {
  const open = shutter.angle / 360 / fps;
  return Array.from({ length: shutter.samples }, (_, k) => time + ((k + 0.5) / shutter.samples) * open);
}

/**
 * Averages straight-alpha RGBA frames (rows of 8-bit RGBA, the same size)
 * in premultiplied alpha, so a transparent recording's edges do not darken:
 * a colour counts by how much it covers. Sums are kept in a `Float64Array`,
 * never as 8-bit running averages.
 *
 * ```ts
 * const blur = new FrameAverager(width * height);
 * for (const t of shutterTimes(time, fps, shutter)) blur.add(draw(t));
 * blur.result(out); // and it is ready for the next frame
 * ```
 */
export class FrameAverager {
  private readonly sums: Float64Array;
  private count = 0;

  constructor(readonly pixels: number) {
    this.sums = new Float64Array(pixels * 4);
  }

  /** How many frames have been added since the last result. */
  get added(): number {
    return this.count;
  }

  /** Adds one straight-alpha RGBA frame. */
  add(rgba: ArrayLike<number>): void {
    if (rgba.length !== this.sums.length) throw new Error(`A frame of ${rgba.length / 4} pixels cannot be averaged with frames of ${this.pixels}.`);
    const s = this.sums;
    for (let i = 0; i < s.length; i += 4) {
      const a = rgba[i + 3]!;
      s[i] += rgba[i]! * a;
      s[i + 1] += rgba[i + 1]! * a;
      s[i + 2] += rgba[i + 2]! * a;
      s[i + 3] += a;
    }
    this.count++;
  }

  /** Writes the average (straight alpha, rounded) into `out`, and starts over. */
  result<T extends Uint8Array | Uint8ClampedArray>(out: T): T {
    if (!this.count) throw new Error('There are no frames to average yet.');
    if (out.length !== this.sums.length) throw new Error(`The average has ${this.pixels} pixels; the output has room for ${out.length / 4}.`);
    const s = this.sums;
    const n = this.count;
    for (let i = 0; i < s.length; i += 4) {
      const a = s[i + 3]!;
      if (a > 0) {
        out[i] = Math.min(255, Math.round(s[i]! / a));
        out[i + 1] = Math.min(255, Math.round(s[i + 1]! / a));
        out[i + 2] = Math.min(255, Math.round(s[i + 2]! / a));
      } else {
        out[i] = out[i + 1] = out[i + 2] = 0;
      }
      out[i + 3] = Math.min(255, Math.round(a / n));
    }
    s.fill(0);
    this.count = 0;
    return out;
  }
}
