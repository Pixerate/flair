/**
 * Measuring an element's box from the markup alone, with no DOM: shapes,
 * paths, images and groups of them, through their transforms. Text needs
 * layout and placeholders have no numbers yet, so those are not measured.
 */

import { transformMatrix } from "../vector/animated.js";
import { pathBounds } from "../vector/morph.js";
import type { SvgBox } from "../vector/motion.js";
import { ancestorsOf, type MarkupElement } from "./markup.js";

/** An affine matrix `[a, b, c, d, e, f]` (as SVG's `matrix()`). */
export type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` then `n`: a point goes through `n` first. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  return [a * n[0] + c * n[1], b * n[0] + d * n[1], a * n[2] + c * n[3], b * n[2] + d * n[3], a * n[4] + c * n[5] + e, b * n[4] + d * n[5] + f];
}

/** The inverse of `m`, or undefined when it flattens everything (a scale of 0). */
export function invert([a, b, c, d, e, f]: Matrix): Matrix | undefined {
  const det = a * d - b * c;
  if (!det || !Number.isFinite(det)) return undefined;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** The box round `box` once it has gone through `m`. */
export function transformBox(box: SvgBox, m: Matrix): SvgBox {
  const [x, y, w, h] = box;
  const pts = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => [m[0] * px! + m[2] * py! + m[4], m[1] * px! + m[3] * py! + m[5]] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

function union(boxes: SvgBox[]): SvgBox | undefined {
  if (!boxes.length) return undefined;
  const x = Math.min(...boxes.map((b) => b[0]));
  const y = Math.min(...boxes.map((b) => b[1]));
  return [x, y, Math.max(...boxes.map((b) => b[0] + b[2])) - x, Math.max(...boxes.map((b) => b[1] + b[3])) - y];
}

/** Elements that are never drawn where they are written. */
const UNDRAWN = new Set(["defs", "clippath", "mask", "symbol", "marker", "pattern", "lineargradient", "radialgradient", "filter", "title", "desc", "metadata", "style", "script"]);

/** Whether `el` is never drawn itself (a clip path, a gradient) or sits inside such an element. */
export function isUndrawn(el: MarkupElement): boolean {
  return [el, ...ancestorsOf(el)].some((e) => UNDRAWN.has(e.tag.toLowerCase()));
}

/** Its `transform` as a matrix (none: the identity); undefined when it has numbers Flair cannot read. */
export function ownTransform(el: MarkupElement): Matrix | undefined {
  const t = el.attrs.transform;
  if (!t || !t.trim()) return IDENTITY;
  if (/\{\{/.test(t)) return undefined;
  const m = transformMatrix(t) as unknown as Matrix;
  return m.every(Number.isFinite) ? m : undefined;
}

/** From its parent's units to the `viewBox`'s: its ancestors' transforms (undefined when one cannot be read). */
export function parentMatrix(el: MarkupElement): Matrix | undefined {
  let m: Matrix = IDENTITY;
  for (const a of ancestorsOf(el)) {
    if (!a.parent) break; // the root <svg>: its viewBox is the units we measure in
    if (a.tag.toLowerCase() === "svg") {
      // A nested <svg> places its content at x, y; a viewBox of its own would scale it.
      if (a.attrs.viewBox) return undefined;
      const [x, y] = [Number(a.attrs.x ?? 0), Number(a.attrs.y ?? 0)];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
      m = multiply([1, 0, 0, 1, x, y], m);
      continue;
    }
    const t = ownTransform(a);
    if (!t) return undefined;
    m = multiply(t, m);
  }
  return m;
}

const numberOf = (el: MarkupElement, name: string, fallback = 0): number => {
  const v = el.attrs[name];
  if (v === undefined || v.trim() === "") return fallback;
  return /^\s*-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*(?:px)?\s*$/i.test(v) ? parseFloat(v) : NaN;
};

const finite = (box: SvgBox | undefined) => (box && box.every(Number.isFinite) ? box : undefined);

/** Its box in its own units (before its own transform), or undefined when Flair cannot measure it. */
export function localBox(el: MarkupElement, byId: ReadonlyMap<string, MarkupElement>, depth = 0): SvgBox | undefined {
  if (depth > 32) return undefined;
  const n = (name: string, fallback = 0) => numberOf(el, name, fallback);
  switch (el.tag.toLowerCase()) {
    case "rect":
    case "image":
      return finite([n("x"), n("y"), n("width"), n("height")]);
    case "circle":
      return finite([n("cx") - n("r"), n("cy") - n("r"), 2 * n("r"), 2 * n("r")]);
    case "ellipse":
      return finite([n("cx") - n("rx"), n("cy") - n("ry"), 2 * n("rx"), 2 * n("ry")]);
    case "line": {
      const [x1, y1, x2, y2] = [n("x1"), n("y1"), n("x2"), n("y2")];
      return finite([Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)]);
    }
    case "polyline":
    case "polygon": {
      const pts = (el.attrs.points ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (pts.length < 2 || pts.some((p) => !Number.isFinite(p))) return undefined;
      const xs = pts.filter((_, i) => i % 2 === 0);
      const ys = pts.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    }
    case "path": {
      const d = el.attrs.d;
      return d && !/\{\{/.test(d) ? pathBounds(d) : undefined;
    }
    case "use": {
      const ref = (el.attrs.href ?? el.attrs["xlink:href"] ?? "").replace(/^#/, "");
      const used = byId.get(ref);
      if (!used || used === el) return undefined;
      const inner = localBox(used, byId, depth + 1);
      const t = ownTransform(used);
      if (!inner || !t) return undefined;
      return finite(transformBox(transformBox(inner, t), [1, 0, 0, 1, n("x"), n("y")]));
    }
    case "g":
    case "a":
    case "switch":
    case "svg": {
      const boxes: SvgBox[] = [];
      for (const c of el.children) {
        if (UNDRAWN.has(c.tag.toLowerCase())) continue;
        const b = boxInParent(c, byId, depth + 1);
        if (!b) return undefined;
        boxes.push(b);
      }
      const box = union(boxes);
      return box && el.tag.toLowerCase() === "svg" && el.parent ? transformBox(box, [1, 0, 0, 1, n("x"), n("y")]) : box;
    }
    default:
      // Text needs layout; anything else is not drawn on its own.
      return undefined;
  }
}

/** Its box in its parent's units (through its own transform), or undefined. */
export function boxInParent(el: MarkupElement, byId: ReadonlyMap<string, MarkupElement>, depth = 0): SvgBox | undefined {
  const box = localBox(el, byId, depth);
  const t = ownTransform(el);
  return box && t ? finite(transformBox(box, t)) : undefined;
}

/** The width of its stroke where it has one (its own or inherited `stroke-width`, 1 by default), else 0. */
export function strokeWidth(el: MarkupElement): number {
  const read = (e: MarkupElement, name: string) => {
    const style = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(e.attrs.style ?? "")?.[1];
    return (style ?? e.attrs[name])?.trim();
  };
  let stroke: string | undefined;
  let width: string | undefined;
  for (const e of [el, ...ancestorsOf(el)]) {
    stroke ??= read(e, "stroke");
    width ??= read(e, "stroke-width");
  }
  if (!stroke || stroke === "none") return 0;
  const w = width === undefined ? 1 : parseFloat(width);
  return Number.isFinite(w) && w > 0 ? w : 1;
}
