/**
 * An {@link SvgMotion}'s frame as markup, with no DOM: for server rendering
 * (a still that hydrates without a blank flash), reduced motion and other
 * places a live player is not wanted.
 */

import { SVG_PICTURE, svgFrame, type SvgBox, type SvgMotion } from "./motion.js";
import { svgDuration } from "./svg.js";

/** @internal An element of a parsed picture (see `svgFrameTree`). */
export interface SvgNode {
  tag: string;
  attrs: [string, string][];
  children: (SvgNode | string)[];
}

type Node = SvgNode;

/** Elements dropped with all they hold: they run code or show outside markup. */
const DROPPED = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)|<[!?][^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/g;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? match;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

/** Safe as `parseSvg` keeps it: no handlers, and links only within the picture or to data images. */
function safeAttr(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (n.startsWith("on") || !/^[a-z_][\w:.-]*$/i.test(n)) return false;
  if (n === "href" || n === "xlink:href" || n === "src") return /^(#|data:image\/)/i.test(value.trim());
  return true;
}

/** The `<svg>` in `markup` as a tree, without anything `parseSvg` would remove. */
function parse(markup: string): Node | undefined {
  const root: Node = { tag: "", attrs: [], children: [] };
  const stack = [root];
  let dropping = 0;
  let at = 0;
  const text = (s: string) => {
    if (!dropping && s) stack[stack.length - 1]!.children.push(decode(s));
  };
  for (const m of markup.matchAll(TOKEN)) {
    text(markup.slice(at, m.index));
    at = m.index + m[0].length;
    const [, cdata, close, open, attrs = "", selfClosing] = m;
    if (cdata !== undefined) {
      if (!dropping) stack[stack.length - 1]!.children.push(cdata);
    } else if (close) {
      const tag = close.toLowerCase();
      if (dropping) {
        if (DROPPED.has(tag)) dropping--;
        continue;
      }
      // Close up to the matching element; a stray closing tag is ignored.
      let i = stack.length - 1;
      while (i > 0 && stack[i]!.tag.toLowerCase() !== tag) i--;
      if (i > 0) stack.length = i;
    } else if (open) {
      if (DROPPED.has(open.toLowerCase())) {
        if (!selfClosing) dropping++;
        continue;
      }
      if (dropping) continue;
      const node: Node = { tag: open, attrs: [], children: [] };
      for (const a of attrs.matchAll(ATTR)) {
        const value = decode(a[2] ?? a[3] ?? a[4] ?? "");
        if (safeAttr(a[1]!, value)) node.attrs.push([a[1]!, value]);
      }
      stack[stack.length - 1]!.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  text(markup.slice(at));
  const svg = root.children.find((c): c is Node => typeof c !== "string");
  return svg && svg.tag.toLowerCase() === "svg" ? svg : undefined;
}

/** @internal A parsed element as markup. */
export function serialize(node: Node | string): string {
  if (typeof node === "string") return escapeText(node);
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
  return `<${node.tag}${attrs}>${node.children.map(serialize).join("")}</${node.tag}>`;
}

/** @internal Sets (or with `undefined` removes) an attribute, unless it is unsafe. */
export function setAttr(node: Node, name: string, value: string | undefined) {
  const i = node.attrs.findIndex(([k]) => k === name);
  if (value === undefined) {
    if (i >= 0) node.attrs.splice(i, 1);
  } else if (!safeAttr(name, value)) return;
  else if (i >= 0) node.attrs[i]![1] = value;
  else node.attrs.push([name, value]);
}

/** @internal */
export const getAttr = (node: Node, name: string) => node.attrs.find(([k]) => k === name)?.[1];

/** A `viewBox` attribute's box, or undefined when it has none or it is malformed. */
export function parseViewBox(value: string | null | undefined): SvgBox | undefined {
  const box = (value ?? "").trim().split(/[\s,]+/).map(Number);
  return box.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[3]! > 0
    ? (box as unknown as SvgBox)
    : undefined;
}

/** The `viewBox` on an SVG's opening tag (see {@link parseViewBox}). */
export function svgViewBox(markup: string): SvgBox | undefined {
  const open = /<svg\b[^>]*>/i.exec(markup)?.[0] ?? "";
  return parseViewBox(/\sviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(open)?.slice(1).find((v) => v !== undefined));
}

/** How a picture framed for a line of text (a text effect's `inline`) sits in it; see {@link svgInlineLayout}. */
export interface SvgInlineLayout {
  /** Its viewBox: x, y, width, height. */
  viewBox: SvgBox;
  /** Width over height, for its host's CSS `aspect-ratio`. */
  aspectRatio: number;
  /**
   * How far it reaches past its box at rest (descenders, outlines, glows,
   * drips), in ems of the font size it is set at; 0 where the picture says
   * nothing (no `data-overhang`).
   */
  overhang: { top: number; right: number; bottom: number; left: number };
}

/**
 * The box and overhang on an SVG's opening tag: its `viewBox`, and
 * `data-overhang="top right bottom left"` (ems), which text effects write.
 * Set inline (`height: 0.72em`, the cap height they frame), give the host a
 * margin of the overhang to keep room for what spills out:
 * `margin: ${top}em ${right}em ${bottom}em ${left}em`.
 */
export function svgInlineLayout(markup: string): SvgInlineLayout | undefined {
  const viewBox = svgViewBox(markup);
  if (!viewBox || !(viewBox[3] > 0)) return undefined;
  const open = /<svg\b[^>]*>/i.exec(markup)?.[0] ?? "";
  const spill = (/\sdata-overhang\s*=\s*"([^"]*)"/i.exec(open)?.[1] ?? "").trim().split(/\s+/).map(Number);
  const [top, right, bottom, left] = [0, 1, 2, 3].map((i) => (Number.isFinite(spill[i]) ? Math.max(0, spill[i]!) : 0));
  return { viewBox, aspectRatio: viewBox[2] / viewBox[3], overhang: { top: top!, right: right!, bottom: bottom!, left: left! } };
}

export interface SvgFrameMarkupOptions {
  /**
   * The time shown, in ms: a number, `"first"` (0) or `"last"` (the end of
   * its last change, see `svgDuration`; the default).
   */
  at?: number | "first" | "last";
  /** Step start times in ms, as a player's `steps` (default none). */
  steps?: readonly number[];
}

/**
 * The picture of an {@link SvgMotion} at a moment, as `<svg>` markup made safe
 * the way `parseSvg` makes it (no scripts, handlers, `<foreignObject>` or
 * outside links), with no DOM needed: render it on a server, show it under
 * `prefers-reduced-motion`, or anywhere a still will do. It is sized to fill
 * its container, as `SvgPlayer` draws it.
 *
 * It matches the player's frame except where that needs layout: a change
 * `along` a path, and a `view` that frames an element by id, stay where the
 * markup puts them. Undefined when `motion.svg` is not an `<svg>`.
 */
export function svgFrameMarkup(motion: SvgMotion, options: SvgFrameMarkupOptions = {}): string | undefined {
  const steps = options.steps ?? [];
  const at = options.at ?? "last";
  const time = at === "first" ? 0 : at === "last" ? svgDuration(motion, steps) : at;
  const tree = svgFrameTree(motion, steps, time);
  if (!tree) return undefined;
  const { svg } = tree;
  setAttr(svg, "width", "100%");
  setAttr(svg, "height", "100%");
  if (!getAttr(svg, "xmlns")) setAttr(svg, "xmlns", "http://www.w3.org/2000/svg");
  return serialize(svg);
}

/**
 * @internal The safe tree of `motion.svg` showing its frame at `time`, with
 * its elements by id (the first of each) and its own `viewBox`; undefined
 * when it is not an `<svg>`. What {@link svgFrameMarkup} and
 * `svgAnimatedMarkup` build on.
 */
export function svgFrameTree(
  motion: SvgMotion,
  steps: readonly number[],
  time: number,
): { svg: Node; byId: Map<string, Node>; whole: SvgBox | undefined } | undefined {
  const svg = parse(motion.svg.trim());
  if (!svg) return undefined;
  const byId = new Map<string, Node>();
  const index = (node: Node) => {
    const id = getAttr(node, "id");
    if (id && !byId.has(id)) byId.set(id, node);
    for (const c of node.children) if (typeof c !== "string") index(c);
  };
  index(svg);
  const whole = parseViewBox(getAttr(svg, "viewBox"));
  for (const [id, frame] of svgFrame(motion.animate ?? [], steps, time)) {
    if (id === SVG_PICTURE && frame.view) {
      const { from, to, u } = frame.view;
      const a = from === null ? whole : typeof from === "string" ? undefined : from;
      const b = typeof to === "string" ? undefined : to;
      if (a && b) setAttr(svg, "viewBox", a.map((n, i) => +(n + (b[i]! - n) * u).toFixed(2)).join(" "));
      continue;
    }
    const el = byId.get(id);
    if (!el) continue;
    for (const [name, value] of Object.entries(frame.attrs)) setAttr(el, name, value);
    if (frame.draw !== undefined) {
      setAttr(el, "pathLength", "1");
      setAttr(el, "stroke-dasharray", "1 1");
      setAttr(el, "stroke-dashoffset", String(1 - frame.draw));
    }
    if (frame.text !== undefined) el.children = [frame.text];
    if (frame.solo !== undefined) {
      let i = 0;
      for (const child of el.children)
        if (typeof child !== "string") setAttr(child, "display", i++ === frame.solo ? undefined : "none");
    }
  }
  return { svg, byId, whole };
}
