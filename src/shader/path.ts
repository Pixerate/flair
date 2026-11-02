/**
 * Paths for shaders. A `path` control (`uniform sampler2D uPath; // @control
 * path …`) takes SVG path data (`d`) or a list of points in frame pixels,
 * which is flattened, resampled evenly along its length and packed into a
 * small float texture. The catalog's path helpers (`PATH` in
 * `catalog/glsl.ts`) read it: the nearest point of the path to a pixel, how
 * far along the path that is, which side the pixel is on, and the point at a
 * distance along. The texture is the same whatever the frame size: fitting
 * the path into the frame happens in the shader, so a path follows resizes.
 *
 * Texture layout (RGBA32F, nearest, `width` × 2):
 * - row 0, texel i: point i as (x, y, distance along, 1 if the segment from
 *   point i - 1 joins it, 0 where a new piece starts), in path units, y down;
 * - row 1, texel 0: (points, length, chunks, fit: 0 none, 1 contain, 2 cover);
 * - row 1, texel 1: the bounds (min x, min y, max x, max y);
 * - row 1, texel 2: (margin, 0, 0, 0);
 * - row 1, texel 3 + c: the box round chunk c, the segments from points
 *   c × {@link PATH_CHUNK} to (c + 1) × {@link PATH_CHUNK}, so the helpers
 *   skip chunks far from a pixel.
 */

import { flatten } from "../vector/morph.js";

/** The most points a path is resampled to; longer paths are spaced further apart, not refused. */
export const MAX_PATH_POINTS = 1024;

/** Points per chunk of the texture's boxes. */
export const PATH_CHUNK = 16;

/**
 * How SVG path data sits in the frame: `contain` (the default) fits its bounds
 * inside the frame less the margin, centred; `cover` fills the frame,
 * cropping; `none` reads it in frame pixels from the top left. A list of
 * points is always in frame pixels.
 */
export type PathFit = "contain" | "cover" | "none";

export const PATH_FITS: readonly PathFit[] = ["contain", "cover", "none"];

/** A path control's value: SVG path data, or points in frame pixels as `[x0, y0, x1, y1, …]` from the top left. */
export type PathValue = string | readonly number[];

/** A path packed for a shader (see the module's notes for the layout). */
export interface PathTexture {
  data: Float32Array;
  width: number;
  height: 2;
  /** Points after resampling. */
  points: number;
  /** Pieces (subpaths). */
  pieces: number;
  /** Length along the path, in path units (pixels for a list of points). */
  length: number;
  /** The box round the path: `[x, y, width, height]`, in path units. */
  bounds: [number, number, number, number];
}

type Point = [number, number];

/** Why a value is not a path, or null when it is one. */
export function pathProblem(value: unknown): string | null {
  if (typeof value === "string") {
    if (!/^\s*[Mm]/.test(value)) return 'takes SVG path data starting with a move, like "M 10 80 C 40 10 65 10 95 80", or a list of points [x0, y0, x1, y1, …] in pixels';
    let rings;
    try {
      rings = flatten(value);
    } catch (e) {
      return `takes SVG path data, and this does not parse: ${(e as Error).message}`;
    }
    return lengthOf(rings.map(closedPoints)) > 0 ? null : "takes a path with some length; this one has every point in the same place";
  }
  if (Array.isArray(value)) {
    if (!value.every((x) => typeof x === "number" && Number.isFinite(x))) return "takes a list of numbers [x0, y0, x1, y1, …] (pixels from the top left)";
    if (value.length < 4 || value.length % 2) return `takes an even list of at least 4 numbers [x0, y0, x1, y1, …], not ${value.length}`;
    return lengthOf([pairs(value)]) > 0 ? null : "takes a path with some length; these points are all in the same place";
  }
  return 'takes SVG path data like "M 10 80 C 40 10 65 10 95 80", or a list of points [x0, y0, x1, y1, …] in pixels';
}

/**
 * A path value packed for a shader, or undefined when it is not a path (see
 * {@link pathProblem} for why). `fit` and `margin` (a fraction of the
 * frame's shorter side kept clear, for `contain` and `cover`) come from the
 * control's declaration; a list of points is always in pixels (`none`).
 */
export function pathTexture(value: PathValue, fit: PathFit = "contain", margin = 0.1): PathTexture | undefined {
  if (pathProblem(value)) return undefined;
  const pieces = (typeof value === "string" ? flatten(value).map(closedPoints) : [pairs(value)]).filter((p) => lengthOf([p]) > 0);
  const length = lengthOf(pieces);
  const vertices = pieces.reduce((n, p) => n + p.length, 0);
  // Curves are flattened into 24 lines each; a quarter of that still follows them to well under a
  // pixel, and every point saved is work saved for every pixel near the path (two at least per piece).
  const budget = Math.max(2 * pieces.length, Math.min(MAX_PATH_POINTS, Math.max(64, Math.ceil(vertices / 4))));
  const spacing = length / Math.max(1, budget - pieces.length);
  const points: [number, number, number, number][] = [];
  let along = 0;
  for (const piece of pieces) {
    const own = lengthOf([piece]);
    const n = Math.max(2, Math.min(MAX_PATH_POINTS - points.length - 2 * (pieces.length - 1 - pieces.indexOf(piece)), Math.round(own / spacing) + 1));
    for (let i = 0; i < n; i++) {
      const [x, y] = pointAlong(piece, (own * i) / (n - 1));
      points.push([x, y, along + (own * i) / (n - 1), i === 0 ? 0 : 1]);
    }
    along += own;
  }
  const chunks = Math.ceil((points.length - 1) / PATH_CHUNK);
  const width = Math.max(points.length, 3 + chunks);
  const data = new Float32Array(width * 2 * 4);
  points.forEach((p, i) => data.set(p, i * 4));
  const row = width * 4;
  const box = (from: number, to: number) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = from; i <= to; i++) {
      const [x, y] = points[i]!;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [x0, y0, x1, y1];
  };
  const all = box(0, points.length - 1);
  data.set([points.length, length, chunks, fit === "none" || typeof value !== "string" ? 0 : fit === "contain" ? 1 : 2], row);
  data.set(all, row + 4);
  data.set([margin, 0, 0, 0], row + 8);
  for (let c = 0; c < chunks; c++) data.set(box(c * PATH_CHUNK, Math.min((c + 1) * PATH_CHUNK, points.length - 1)), row + (3 + c) * 4);
  return { data, width, height: 2, points: points.length, pieces: pieces.length, length, bounds: [all[0]!, all[1]!, all[2]! - all[0]!, all[3]! - all[1]!] };
}

/**
 * Where a path lands in a frame of `width` × `height` pixels: the scale
 * (pixels per path unit) and the box round it in pixels from the top left,
 * as the shader helpers place it. For checking a path headlessly.
 */
export function pathPlacement(path: PathTexture, width: number, height: number): { scale: number; box: [number, number, number, number] } {
  const fit = path.data[path.width * 4 + 3]!;
  const margin = path.data[path.width * 4 + 8]!;
  const [x, y, w, h] = path.bounds;
  if (fit === 0) return { scale: 1, box: [x, y, w, h] };
  const m = margin * Math.min(width, height);
  const sx = (width - 2 * m) / Math.max(w, 1e-6);
  const sy = (height - 2 * m) / Math.max(h, 1e-6);
  // A straight line has no height (or width): it fits by the other side alone.
  const scale = w < 1e-6 ? sy : h < 1e-6 ? sx : fit === 1 ? Math.min(sx, sy) : Math.max(sx, sy);
  return { scale, box: [width / 2 - (w / 2) * scale, height / 2 - (h / 2) * scale, w * scale, h * scale] };
}

const pairs = (list: readonly number[]): Point[] => Array.from({ length: list.length / 2 }, (_, i) => [list[2 * i]!, list[2 * i + 1]!]);

const closedPoints = (ring: { points: Point[]; closed: boolean }): Point[] => (ring.closed && ring.points.length > 1 ? [...ring.points, ring.points[0]!] : ring.points);

function lengthOf(pieces: Point[][]): number {
  let sum = 0;
  for (const p of pieces) for (let i = 1; i < p.length; i++) sum += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  return sum;
}

function pointAlong(piece: Point[], at: number): Point {
  let left = at;
  for (let i = 1; i < piece.length; i++) {
    const a = piece[i - 1]!, b = piece[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= l && l > 0) return [a[0] + ((b[0] - a[0]) * left) / l, a[1] + ((b[1] - a[1]) * left) / l];
    left -= l;
  }
  return piece[piece.length - 1]!;
}

/** The most path textures kept per context; the least recently drawn goes first. */
const KEPT = 16;

const uploaded = new WeakMap<WebGL2RenderingContext, Map<string, WebGLTexture>>();

/**
 * The texture for a path control's value on `gl`, uploaded once and kept for
 * the next frames (the last {@link KEPT} per context), leaving it bound to
 * `TEXTURE_2D`. Null for a value that is not a path: the helpers then find
 * no path, and draw as if it were far away.
 */
export function bindPathTexture(gl: WebGL2RenderingContext, value: PathValue, fit: PathFit, margin: number): WebGLTexture | null {
  const key = `${fit} ${margin} ${typeof value === "string" ? value : `[${value.join(",")}]`}`;
  let kept = uploaded.get(gl);
  if (!kept) uploaded.set(gl, (kept = new Map()));
  const existing = kept.get(key);
  if (existing && gl.isTexture(existing)) {
    kept.delete(key);
    kept.set(key, existing);
    gl.bindTexture(gl.TEXTURE_2D, existing);
    return existing;
  }
  const packed = pathTexture(value, fit, margin);
  if (!packed) {
    gl.bindTexture(gl.TEXTURE_2D, null);
    return null;
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, packed.width, packed.height, 0, gl.RGBA, gl.FLOAT, packed.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  kept.delete(key);
  kept.set(key, texture);
  for (const [old, t] of kept) {
    if (kept.size <= KEPT) break;
    gl.deleteTexture(t);
    kept.delete(old);
  }
  return texture;
}

/**
 * A path control's texture as plain data for a page that sets it up itself
 * (standalone HTML, the export recorder): its width and its texels, rounded
 * to thousandths. Null when the value is not a path.
 */
export function pathPageData(value: PathValue, fit: PathFit, margin: number): { width: number; data: number[] } | null {
  const packed = pathTexture(value, fit, margin);
  return packed ? { width: packed.width, data: Array.from(packed.data, (v) => Math.round(v * 1000) / 1000) } : null;
}

/** The page's code for {@link pathPageData}: `pathTexture(gl, unit, path)` makes the texture on `unit`. */
export const PAGE_PATH_TEXTURE = `function pathTexture(gl, unit, path) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (path) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, path.width, 2, 0, gl.RGBA, gl.FLOAT, new Float32Array(path.data));
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
  return t;
}`;
