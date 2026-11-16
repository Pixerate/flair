/**
 * Measures of rendered frames, with no GPU or model: whether anything is drawn, how much it moves,
 * how much an overlay covers, and how close two clips look. All return 0 to 1.
 */
import type { Frames } from "./types.ts";

const SIDE = 48;

/** A frame averaged down to `side` × `side` RGBA floats (0–1), so measures ignore resolution and fine noise. */
export function shrink(frame: Buffer, width: number, height: number, side = SIDE): Float32Array {
  const out = new Float32Array(side * side * 4);
  const counts = new Float32Array(side * side);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(side - 1, Math.floor((y * side) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(side - 1, Math.floor((x * side) / width));
      const i = (y * width + x) * 4;
      const o = sy * side + sx;
      for (let c = 0; c < 4; c++) out[o * 4 + c]! += frame[i + c]! / 255;
      counts[o]!++;
    }
  }
  for (let o = 0; o < side * side; o++) for (let c = 0; c < 4; c++) out[o * 4 + c]! /= Math.max(1, counts[o]!);
  return out;
}

/** The share of pixels that differ visibly from the frame's commonest colour, averaged over frames: 0 is a flat, empty picture. */
export function content(frames: Frames): number {
  if (!frames.data.length) return 0;
  let sum = 0;
  for (const frame of frames.data) {
    const counts = new Map<number, number>();
    const n = frames.width * frames.height;
    for (let i = 0; i < n; i++) {
      const key = ((frame[i * 4]! >> 4) << 12) | ((frame[i * 4 + 1]! >> 4) << 8) | ((frame[i * 4 + 2]! >> 4) << 4) | (frame[i * 4 + 3]! >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let commonest = 0;
    for (const count of counts.values()) commonest = Math.max(commonest, count);
    sum += 1 - commonest / n;
  }
  return sum / frames.data.length;
}

/** Mean absolute RGBA difference between two equal-sized shrunk frames. */
function difference(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

/** How much the picture changes from frame to frame, on average (0 for a still). */
export function motion(frames: Frames): number {
  const small = frames.data.map((f) => shrink(f, frames.width, frames.height));
  if (small.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < small.length; i++) sum += difference(small[i - 1]!, small[i]!);
  return sum / (small.length - 1);
}

/** Whether the frames move enough to count as animated. */
export function isAnimated(frames: Frames): boolean {
  return motion(frames) > 0.002;
}

/** The share of pixels an overlay draws on (alpha above 4%), averaged over frames. */
export function coverage(frames: Frames): number {
  if (!frames.data.length) return 0;
  let sum = 0;
  const n = frames.width * frames.height;
  for (const frame of frames.data) {
    let covered = 0;
    for (let i = 0; i < n; i++) if (frame[i * 4 + 3]! > 10) covered++;
    sum += covered / n;
  }
  return sum / frames.data.length;
}

/** A 4×4×4 colour histogram over all frames, weighted by alpha, summing to 1. */
function histogram(frames: Frames): Float64Array {
  const bins = new Float64Array(64);
  let total = 0;
  for (const frame of frames.data)
    for (let i = 0; i < frame.length; i += 4) {
      const a = frame[i + 3]! / 255;
      const bin = ((frame[i]! >> 6) << 4) | ((frame[i + 1]! >> 6) << 2) | (frame[i + 2]! >> 6);
      bins[bin]! += a;
      total += a;
    }
  if (total > 0) for (let b = 0; b < 64; b++) bins[b]! /= total;
  return bins;
}

/** How alike two clips' colours are: histogram intersection, 1 for the same palette in the same amounts. */
export function paletteSimilarity(a: Frames, b: Frames): number {
  const ha = histogram(a);
  const hb = histogram(b);
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += Math.min(ha[i]!, hb[i]!);
  return sum;
}

/** SSIM of two shrunk frames' luminance in 8×8 blocks, averaged weighted by each block's contrast. */
function ssim(a: Float32Array, b: Float32Array, side = SIDE): number {
  const luma = (f: Float32Array, i: number) => (0.2126 * f[i * 4]! + 0.7152 * f[i * 4 + 1]! + 0.0722 * f[i * 4 + 2]!) * f[i * 4 + 3]!;
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  const block = 8;
  let sum = 0;
  let blocks = 0;
  for (let by = 0; by < side; by += block)
    for (let bx = 0; bx < side; bx += block) {
      let ma = 0, mb = 0, n = 0;
      for (let y = by; y < by + block; y++) for (let x = bx; x < bx + block; x++) { ma += luma(a, y * side + x); mb += luma(b, y * side + x); n++; }
      ma /= n;
      mb /= n;
      let va = 0, vb = 0, cov = 0;
      for (let y = by; y < by + block; y++)
        for (let x = bx; x < bx + block; x++) {
          const da = luma(a, y * side + x) - ma;
          const db = luma(b, y * side + x) - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      va /= n;
      vb /= n;
      cov /= n;
      // Weighted by what is in the block, so empty blocks (most of a sparse overlay) do not count as matches.
      const weight = va + vb + C2;
      sum += weight * (((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)));
      blocks += weight;
    }
  return sum / blocks;
}

/** How alike two clips' layouts are: SSIM of frames paired by their place in time, 0 to 1. */
export function structureSimilarity(a: Frames, b: Frames): number {
  const n = Math.min(a.data.length, b.data.length);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const ia = Math.round((i * (a.data.length - 1)) / Math.max(1, n - 1));
    const ib = Math.round((i * (b.data.length - 1)) / Math.max(1, n - 1));
    sum += ssim(shrink(a.data[ia]!, a.width, a.height), shrink(b.data[ib]!, b.width, b.height));
  }
  return Math.max(0, Math.min(1, sum / n));
}

/** How alike two clips' amounts of motion are: 1 when they move as much as each other. */
export function motionSimilarity(a: Frames, b: Frames): number {
  const ma = motion(a);
  const mb = motion(b);
  const top = Math.max(ma, mb);
  return top < 0.002 ? 1 : 1 - Math.abs(ma - mb) / top;
}

/** Palette, layout and motion likeness of a candidate to a reference, and their weighted blend. */
export function similarity(candidate: Frames, reference: Frames) {
  const palette = paletteSimilarity(candidate, reference);
  const structure = structureSimilarity(candidate, reference);
  const moves = motionSimilarity(candidate, reference);
  return { palette, structure, motion: moves, score: 0.4 * palette + 0.35 * structure + 0.25 * moves };
}

/** How alike one frame is to another, 1 for the same picture (mean RGB difference, shrunk). */
export function frameLikeness(a: Frames, b: Frames, ia = 0, ib = 0): number {
  return 1 - difference(shrink(a.data[ia]!, a.width, a.height), shrink(b.data[ib]!, b.width, b.height));
}
