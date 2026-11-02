/**
 * Words as single-stroke SVG path data, written the way a pen writes them:
 * each letter's strokes in order, letters left to right, lines top to bottom.
 * A path control drawing along it writes the words on (see `glass-tube` and
 * `glass-writing`); a vector effect can draw it on with `draw`. Pure, with no
 * DOM. The letters are the Hershey fonts' (see `hershey.ts`).
 */

import { HERSHEY_SANS, HERSHEY_SCRIPT } from "./hershey.js";

/** `script`: joined-up handwriting (the default); `sans`: plain printed capitals and lowercase. */
export type HandwritingFont = "script" | "sans";

export const HANDWRITING_FONTS: readonly HandwritingFont[] = ["script", "sans"];

export interface TextPathOptions {
  /** `script` (the default) or `sans`. */
  font?: HandwritingFont;
  /** Height of a capital letter, in path units (default 32). */
  size?: number;
  /** Extra space between letters, as a fraction of `size` (default 0; may be negative). */
  spacing?: number;
  /** Distance from one line's top to the next's, as a multiple of `size` (default 1.6). */
  lineHeight?: number;
  /** How lines sit against each other: `left` (the default), `center` or `right`. */
  align?: "left" | "center" | "right";
  /**
   * Joins a letter's stroke to the next letter's when the pen would land
   * close by, so script runs on as one line (default true for `script`,
   * false for `sans`).
   */
  join?: boolean;
  /**
   * Rounds each stroke into curves through its points (default true): the
   * fonts are drawn in short straight lines, which show as facets when large.
   * Corners sharper than about 80° stay sharp.
   */
  smooth?: boolean;
}

/** Glyph units from a capital's top to the baseline. */
const CAP = 21;
/** Where a capital's top is, in glyph units. */
const TOP = -12;

const R = "R".charCodeAt(0);

interface Glyph {
  left: number;
  right: number;
  strokes: [number, number][][];
}

const decoded = new Map<string, Glyph[]>();

function glyphs(font: HandwritingFont): Glyph[] {
  const cached = decoded.get(font);
  if (cached) return cached;
  const list = (font === "sans" ? HERSHEY_SANS : HERSHEY_SCRIPT).map((data) => {
    const strokes: [number, number][][] = [];
    let stroke: [number, number][] = [];
    for (let i = 2; i + 1 < data.length; i += 2) {
      if (data[i] === " " && data[i + 1] === "R") {
        if (stroke.length) strokes.push(stroke);
        stroke = [];
        continue;
      }
      stroke.push([data.charCodeAt(i) - R, data.charCodeAt(i + 1) - R]);
    }
    if (stroke.length) strokes.push(stroke);
    return { left: data.charCodeAt(0) - R, right: data.charCodeAt(1) - R, strokes };
  });
  decoded.set(font, list);
  return list;
}

/** Whether the turn at `b` (from a to c) is sharper than about 80°. */
function sharp(a: [number, number], b: [number, number], c: [number, number]): boolean {
  const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
  const lu = Math.hypot(u[0]!, u[1]!), lv = Math.hypot(v[0]!, v[1]!);
  return lu === 0 || lv === 0 || (u[0]! * v[0]! + u[1]! * v[1]!) / (lu * lv) < Math.cos((100 * Math.PI) / 180);
}

/**
 * A stroke after its first point as curves through every point (Catmull-Rom,
 * as cubic Béziers), with sharp corners kept as corners.
 */
function curves(pts: [number, number][], r: (v: number) => string): string[] {
  const out: string[] = [];
  const corner = pts.map((p, i) => i === 0 || i === pts.length - 1 || sharp(pts[i - 1]!, p, pts[i + 1]!));
  for (let i = 0; i + 1 < pts.length; i++) {
    const p1 = pts[i]!, p2 = pts[i + 1]!;
    const p0 = corner[i] ? p1 : pts[i - 1]!;
    const p3 = corner[i + 1] ? p2 : pts[i + 2]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push(`C ${r(c1[0]!)} ${r(c1[1]!)} ${r(c2[0]!)} ${r(c2[1]!)} ${r(p2[0])} ${r(p2[1])}`);
  }
  return out;
}

/** Why words cannot be written (empty, or letters the fonts lack), or null when they can. */
export function textPathProblem(text: unknown): string | null {
  if (typeof text !== "string" || text.trim() === "") return "needs some words to write";
  const missing = [...new Set([...text].filter((c) => c !== "\n" && (c < " " || c > "~")))];
  if (missing.length) {
    const shown = missing.slice(0, 5).map((c) => JSON.stringify(c)).join(", ");
    return `can only write printable ASCII letters, digits and punctuation (and line breaks), not ${shown}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`;
  }
  return null;
}

/**
 * Words as SVG path data, in the order a pen writes them, with capitals'
 * tops at y = 0 on the first line (y down). Throws a `RangeError` (saying
 * why) for words it cannot write: see {@link textPathProblem}.
 */
export function textPath(text: string, options: TextPathOptions = {}): string {
  const problem = textPathProblem(text);
  if (problem) throw new RangeError(`textPath ${problem}.`);
  const font = options.font ?? "script";
  const size = options.size ?? 32;
  const scale = size / CAP;
  const extra = (options.spacing ?? 0) * size;
  const join = options.join ?? font === "script";
  const gap = 0.35 * size;
  const set = glyphs(font);
  const lines = text.split("\n").map((line) => {
    const placed: { glyph: Glyph; x: number }[] = [];
    let x = 0;
    for (const c of line) {
      const glyph = set[c.charCodeAt(0) - 32]!;
      placed.push({ glyph, x: x - glyph.left * scale });
      x += (glyph.right - glyph.left) * scale + extra;
    }
    return { placed, width: Math.max(0, x - extra) };
  });
  const widest = Math.max(...lines.map((l) => l.width));
  const r = (v: number) => String(Math.round(v * 10) / 10);
  const parts: string[] = [];
  let pen: [number, number] | null = null;
  lines.forEach((line, n) => {
    const shift = options.align === "center" ? (widest - line.width) / 2 : options.align === "right" ? widest - line.width : 0;
    const top = n * (options.lineHeight ?? 1.6) * size;
    pen = null;
    for (const { glyph, x } of line.placed) {
      if (!glyph.strokes.length) {
        pen = null;
        continue;
      }
      glyph.strokes.forEach((stroke, k) => {
        const pts = stroke.map(([gx, gy]): [number, number] => [shift + x + gx * scale, top + (gy - TOP) * scale]);
        const [px, py] = pts[0]!;
        // Only a letter's first stroke runs on from the letter before: an i's dot is lifted to.
        const near = k === 0 && join && pen && Math.hypot(px - pen[0], py - pen[1]) < gap;
        parts.push(`${near ? "L" : "M"} ${r(px)} ${r(py)}`);
        parts.push(...(options.smooth === false ? pts.slice(1).map(([qx, qy]) => `L ${r(qx)} ${r(qy)}`) : curves(pts, r)));
        pen = pts[pts.length - 1]!;
      });
    }
  });
  return parts.join(" ");
}
