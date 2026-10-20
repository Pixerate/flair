/**
 * The motion primitives: each one's descriptor (plain JSON) and the pure
 * function that expands a use of it into `SvgAnimation`s (and, where it
 * needs them, wrapper groups and clip paths in the markup).
 *
 * Defaults follow `@pixerate/editor`'s animation editor, so the two agree:
 * entrances 600 ms easing out (`ENTRANCE_EASE`), exits 450 ms easing in
 * (`EXIT_EASE`), moves easing in and out (`MOVE_EASE`), pulse 600 ms and
 * shake 500 ms.
 */

import type { CubicBezier, SvgAnimation, SvgEase } from "../vector/motion.js";
import type { PrimitiveDescriptor, PrimitiveParam, PrimitiveParamValue } from "./types.js";

/** How entrances ease by default: `1 − (1 − t)³` exactly (Flair's `out`), as a curve. */
export const ENTRANCE_EASE: CubicBezier = [1 / 3, 1, 2 / 3, 1];
/** How exits ease by default: CSS `ease-in`. */
export const EXIT_EASE: CubicBezier = [0.42, 0, 1, 1];
/** How moves (spins, following a path, drawing a line) ease by default. */
export const MOVE_EASE: CubicBezier = [0.65, 0, 0.35, 1];
/** A back ease that overshoots and settles (CSS "back out"), for pops and rises. */
export const BACK_EASE: CubicBezier = [0.34, 1.56, 0.64, 1];

/** Thrown by an expansion to refuse a use; the message says how to fix it. */
export class PrimitiveError extends Error {}

/** A clip rectangle's or circle's attributes, from and to (unit-box space: 0–1 across the element). */
export type ClipShape = { shape: "rect" | "circle"; attrs: Record<string, readonly [number, number] | number> };

/** What an expansion gets to work with; everything it adds is checked and applied together, or not at all. */
export interface ExpandContext {
  /** The target's id. */
  readonly id: string;
  /** The target's tag name, lower case. */
  readonly tagName: string;
  /** The target's attributes as written. */
  readonly attrs: Readonly<Record<string, string>>;
  /** Parameter values, defaults filled in and checked. */
  readonly values: Readonly<Record<string, PrimitiveParamValue>>;
  /** Timing for a part from `from` to `to` of the use's time (default all of it), with `ease` or the use's main ease. */
  timing(from?: number, to?: number, ease?: SvgEase): Pick<SvgAnimation, "step" | "delay" | "ms" | "ease">;
  /** Wraps the target in a new group (inside any added before); returns its id, for animations to change. */
  wrap(name: string, attrs?: Record<string, string>): string;
  /**
   * Wraps what is inside the target (a `<text>`'s words) in a new element
   * (inside any added before); returns its id. Refuses a target with nothing inside.
   */
  wrapContent(name: string, element: string, attrs?: Record<string, string>): string;
  /**
   * Clips the latest wrapper to a shape in its own box's units (0–1 across
   * it, so text and groups need no measuring); returns the shape's id.
   */
  clip(shape: ClipShape["shape"], attrs: Record<string, number>): string;
  /** The target's centre in its parent's units; refuses when Flair cannot measure it and no `box` was given. */
  centre(): readonly [number, number];
  /**
   * How far past its box (as a share of its width and height) a clip must
   * reach to show its whole stroke; refuses for a box with no width or height.
   */
  padding(): readonly [number, number];
  /** Adds an animation (its timing and tag are the caller's to set through `timing`). */
  add(anim: SvgAnimation): void;
  /** Whether `id` is an element in the picture, and its tag name. */
  element(id: string): { tagName: string } | undefined;
  /** Whether `id` (a path) and the target's parent are in the same units, so `along` lands where it should. */
  sameUnits(pathId: string): boolean | undefined;
}

interface Primitive {
  descriptor: PrimitiveDescriptor;
  expand(ctx: ExpandContext): void;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
const scaleAbout = ([cx, cy]: readonly [number, number], s: number) => `translate(${fmt(cx)} ${fmt(cy)}) scale(${fmt(s)}) translate(${fmt(-cx)} ${fmt(-cy)})`;
const rotateAbout = ([cx, cy]: readonly [number, number], a: number) => `rotate(${fmt(a)} ${fmt(cx)} ${fmt(cy)})`;
const translate = (x: number, y: number) => `translate(${fmt(x)} ${fmt(y)})`;

const DIRECTIONS = ["up", "down", "left", "right"] as const;
type Direction = (typeof DIRECTIONS)[number];
const STEP: Record<Direction, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

const param = (p: PrimitiveParam) => p;
const direction = (fallback: Direction, description: string) =>
  param({ name: "direction", type: "enum", label: "Direction", default: fallback, options: DIRECTIONS, description });
const distance = (fallback: number) => param({ name: "distance", type: "float", label: "Distance", default: fallback, min: 0, max: 2000, step: 1, unit: "viewBox units" });
const count = (fallback: number, max = 20) => param({ name: "count", type: "int", label: "Count", default: fallback, min: 1, max, step: 1 });

const SHAPES = "a shape (path, line, polyline, polygon, rect, circle, ellipse)";
const ANY = "any drawn element (a shape, text, image, group or use)";

/** A number attribute's value at rest: as written, a `{{placeholder}}` kept as one, else `fallback`. */
function restValue(attrs: Readonly<Record<string, string>>, name: string, fallback: number): number | string {
  const v = attrs[name]?.trim();
  if (v === undefined || v === "") return fallback;
  const placeholder = /^\{\{\s*([A-Za-z_]\w*)\s*(?::[^}]*)?\}\}$/.exec(v);
  if (placeholder) return `{{${placeholder[1]}}}`;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A wipe's clip rectangle at its start and end, revealing (`reveal`) with its
 * edge travelling `dir`, or hiding (the reveal the other way, reversed).
 */
function wipeRect(dir: Direction, reveal: boolean, [px, py]: readonly [number, number]): Record<string, readonly [number, number] | number> {
  if (!reveal) {
    const shown = wipeRect(OPPOSITE[dir], true, [px, py]);
    return Object.fromEntries(Object.entries(shown).map(([k, v]) => [k, typeof v === "number" ? v : ([v[1], v[0]] as const)]));
  }
  const [w, h] = [1 + 2 * px, 1 + 2 * py];
  switch (dir) {
    case "right":
      return { x: -px, y: -py, width: [0, w], height: h };
    case "left":
      return { x: [1 + px, -px], y: -py, width: [0, w], height: h };
    case "down":
      return { x: -px, y: -py, width: w, height: [0, h] };
    case "up":
      return { x: -px, y: [1 + py, -py], width: w, height: [0, h] };
  }
}

/** Splits a clip shape's attributes into those that stay and those that change (as an animation's `attrs`). */
function clipParts(attrs: Record<string, readonly [number, number] | number>) {
  const fixed: Record<string, number> = {};
  const changing: Record<string, readonly [number, number]> = {};
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "number") fixed[k] = r(v);
    else {
      fixed[k] = r(v[0]);
      changing[k] = [r(v[0]), r(v[1])];
    }
  }
  return { fixed, changing };
}

function clipReveal(ctx: ExpandContext, name: string, shape: ClipShape["shape"], attrs: Record<string, readonly [number, number] | number>) {
  const { fixed, changing } = clipParts(attrs);
  ctx.wrap(name);
  const clip = ctx.clip(shape, fixed);
  ctx.add({ id: clip, ...ctx.timing(), attrs: changing });
}

function drawOn(ctx: ExpandContext, on: boolean) {
  if (!["path", "line", "polyline", "polygon", "rect", "circle", "ellipse"].includes(ctx.tagName))
    throw new PrimitiveError(
      `${on ? "entrance.draw" : "exit.undraw"} draws a stroke, so it needs ${SHAPES}; "${ctx.id}" is a <${ctx.tagName}>. Apply it to each shape inside, or use ${on ? "entrance.fade or entrance.wipe" : "exit.fade or exit.wipe"} on the whole element.`,
    );
  const rest = restValue(ctx.attrs, "fill-opacity", 1);
  if (on) {
    ctx.add({ id: ctx.id, ...ctx.timing(0, 0.75), draw: true });
    if (ctx.values.fill) ctx.add({ id: ctx.id, ...ctx.timing(0.6, 1, ENTRANCE_EASE), attrs: { "fill-opacity": [0, rest] } });
  } else {
    if (ctx.values.fill) ctx.add({ id: ctx.id, ...ctx.timing(0, 0.4, EXIT_EASE), attrs: { "fill-opacity": [rest, 0] } });
    ctx.add({ id: ctx.id, ...ctx.timing(), draw: [1, 0] });
  }
}

/** A colour attribute's value at rest, for tweening: `#rrggbb` as written or a `{{placeholder}}`. */
function restColour(ctx: ExpandContext, name: string): string {
  const style = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(ctx.attrs.style ?? "")?.[1];
  const v = (style ?? ctx.attrs[name])?.trim();
  const placeholder = v && /^\{\{\s*([A-Za-z_]\w*)\s*(?::[^}]*)?\}\}$/.exec(v);
  if (placeholder) return `{{${placeholder[1]}}}`;
  if (v && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  throw new PrimitiveError(
    `emphasis.color-pulse tints the element's own ${name}, so "${ctx.id}" needs a ${name} written #rrggbb (or a {{colour}} control)${v ? `; it has ${JSON.stringify(v)}` : `, and it has none (a group's children keep their own colours: apply it to each shape)`}. Set its ${name} to a hex colour with effect.setMotion first.`,
  );
}

/** A seed from an id, so each element wanders its own way. */
function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return (h >>> 0) % 2147483647 || 1;
}

const PRIMITIVE_LIST: Primitive[] = [
  // ── Entrances ─────────────────────────────────────────────────────
  {
    descriptor: { id: "entrance.fade", name: "Fade in", kind: "entrance", description: "Fades the element in from nothing.", appliesTo: ANY, params: [], ms: 600, ease: ENTRANCE_EASE, needsBox: false },
    expand(ctx) {
      const w = ctx.wrap("fade");
      ctx.add({ id: w, ...ctx.timing(), attrs: { opacity: [0, 1] } });
    },
  },
  {
    descriptor: {
      id: "entrance.pop",
      name: "Pop in",
      kind: "entrance",
      description: "Scales up from `from` past full size and settles (a back ease), fading in over the first 40%.",
      appliesTo: ANY,
      params: [{ name: "from", type: "float", label: "Starting scale", default: 0.5, min: 0, max: 1, step: 0.05, unit: "×" }],
      ms: 600,
      ease: BACK_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("pop");
      ctx.add({ id: w, ...ctx.timing(0, 0.4, ENTRANCE_EASE), attrs: { opacity: [0, 1] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [scaleAbout(c, ctx.values.from as number), scaleAbout(c, 1)] } });
    },
  },
  {
    descriptor: {
      id: "entrance.grow",
      name: "Grow in",
      kind: "entrance",
      description: "Grows from nothing at its centre to full size, fading in over the first 30%.",
      appliesTo: ANY,
      params: [],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("grow");
      ctx.add({ id: w, ...ctx.timing(0, 0.3, ENTRANCE_EASE), attrs: { opacity: [0, 1] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [scaleAbout(c, 0), scaleAbout(c, 1)] } });
    },
  },
  {
    descriptor: {
      id: "entrance.slide",
      name: "Slide in",
      kind: "entrance",
      description: "Slides into place travelling `direction` (from `distance` the other way), fading in as it goes.",
      appliesTo: ANY,
      params: [direction("up", "The way it travels: up comes from below."), distance(40)],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      const [dx, dy] = STEP[ctx.values.direction as Direction];
      const d = ctx.values.distance as number;
      const w = ctx.wrap("slide");
      ctx.add({ id: w, ...ctx.timing(0, 1, ENTRANCE_EASE), attrs: { opacity: [0, 1] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [translate(-dx * d, -dy * d), translate(0, 0)] } });
    },
  },
  {
    descriptor: {
      id: "entrance.wipe",
      name: "Wipe in",
      kind: "entrance",
      description: "Reveals the element behind an edge travelling `direction` (a clip path over its box).",
      appliesTo: `${ANY} with a width and a height (not a lone straight line)`,
      params: [direction("right", "The way the edge travels: right reveals from the left.")],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      clipReveal(ctx, "wipe", "rect", wipeRect(ctx.values.direction as Direction, true, ctx.padding()));
    },
  },
  {
    descriptor: {
      id: "entrance.iris",
      name: "Iris in",
      kind: "entrance",
      description: "Reveals the element from its centre outwards, through a circle (an ellipse on a box that is not square) or a box.",
      appliesTo: `${ANY} with a width and a height`,
      params: [{ name: "shape", type: "enum", label: "Shape", default: "circle", options: ["circle", "box"] }],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      const [px, py] = ctx.padding();
      if (ctx.values.shape === "circle") clipReveal(ctx, "iris", "circle", { cx: 0.5, cy: 0.5, r: [0, Math.hypot(0.5 + px, 0.5 + py)] });
      else clipReveal(ctx, "iris", "rect", { x: [0.5, -px], y: [0.5, -py], width: [0, 1 + 2 * px], height: [0, 1 + 2 * py] });
    },
  },
  {
    descriptor: {
      id: "entrance.split",
      name: "Split in",
      kind: "entrance",
      description: "Reveals the element from a line through its middle outwards: horizontal opens up and down from a horizontal line, vertical opens left and right.",
      appliesTo: `${ANY} with a width and a height`,
      params: [{ name: "orientation", type: "enum", label: "Orientation", default: "horizontal", options: ["horizontal", "vertical"] }],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      const [px, py] = ctx.padding();
      if (ctx.values.orientation === "horizontal") clipReveal(ctx, "split", "rect", { x: -px, y: [0.5, -py], width: 1 + 2 * px, height: [0, 1 + 2 * py] });
      else clipReveal(ctx, "split", "rect", { x: [0.5, -px], y: -py, width: [0, 1 + 2 * px], height: 1 + 2 * py });
    },
  },
  {
    descriptor: {
      id: "entrance.zoom",
      name: "Zoom in",
      kind: "entrance",
      description: "Settles from `from` times its size (larger by default, as if the camera pulls back onto it) to full size round its centre, fading in over the first half.",
      appliesTo: ANY,
      params: [{ name: "from", type: "float", label: "Starting scale", default: 1.6, min: 0, max: 8, step: 0.1, unit: "×" }],
      ms: 600,
      ease: ENTRANCE_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("zoom");
      ctx.add({ id: w, ...ctx.timing(0, 0.5, ENTRANCE_EASE), attrs: { opacity: [0, 1] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [scaleAbout(c, ctx.values.from as number), scaleAbout(c, 1)] } });
    },
  },
  {
    descriptor: {
      id: "entrance.rise",
      name: "Rise in",
      kind: "entrance",
      description: "Rises a short way into place, overshooting a touch and settling (a back ease), fading in over the first half.",
      appliesTo: ANY,
      params: [distance(20)],
      ms: 600,
      ease: BACK_EASE,
      needsBox: false,
    },
    expand(ctx) {
      const w = ctx.wrap("rise");
      ctx.add({ id: w, ...ctx.timing(0, 0.5, ENTRANCE_EASE), attrs: { opacity: [0, 1] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [translate(0, ctx.values.distance as number), translate(0, 0)] } });
    },
  },
  {
    descriptor: {
      id: "entrance.draw",
      name: "Draw in",
      kind: "entrance",
      description: "Draws the outline on along its length over the first 75%, then (with `fill`) fades the fill in over the last 40%, easing out.",
      appliesTo: `${SHAPES} with a stroke`,
      params: [{ name: "fill", type: "bool", label: "Fade the fill in", default: true }],
      ms: 600,
      ease: MOVE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      drawOn(ctx, true);
    },
  },

  // ── Exits ─────────────────────────────────────────────────────────
  {
    descriptor: { id: "exit.fade", name: "Fade out", kind: "exit", description: "Fades the element out to nothing.", appliesTo: ANY, params: [], ms: 450, ease: EXIT_EASE, needsBox: false },
    expand(ctx) {
      const w = ctx.wrap("fade-out");
      ctx.add({ id: w, ...ctx.timing(), attrs: { opacity: [1, 0] } });
    },
  },
  {
    descriptor: {
      id: "exit.shrink",
      name: "Shrink out",
      kind: "exit",
      description: "Shrinks to nothing at its centre, fading out over the last 40% (ease in).",
      appliesTo: ANY,
      params: [],
      ms: 450,
      ease: EXIT_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("shrink");
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [scaleAbout(c, 1), scaleAbout(c, 0)] } });
      ctx.add({ id: w, ...ctx.timing(0.6, 1, EXIT_EASE), attrs: { opacity: [1, 0] } });
    },
  },
  {
    descriptor: {
      id: "exit.slide",
      name: "Slide out",
      kind: "exit",
      description: "Slides `distance` away travelling `direction`, fading out as it goes: slide in reversed.",
      appliesTo: ANY,
      params: [direction("down", "The way it travels."), distance(40)],
      ms: 450,
      ease: EXIT_EASE,
      needsBox: false,
    },
    expand(ctx) {
      const [dx, dy] = STEP[ctx.values.direction as Direction];
      const d = ctx.values.distance as number;
      const w = ctx.wrap("slide-out");
      ctx.add({ id: w, ...ctx.timing(), attrs: { opacity: [1, 0] } });
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [translate(0, 0), translate(dx * d, dy * d)] } });
    },
  },
  {
    descriptor: {
      id: "exit.wipe",
      name: "Wipe out",
      kind: "exit",
      description: "Hides the element behind an edge travelling `direction` (right hides from the left): wipe in reversed in time.",
      appliesTo: `${ANY} with a width and a height`,
      params: [direction("right", "The way the edge travels.")],
      ms: 450,
      ease: EXIT_EASE,
      needsBox: false,
    },
    expand(ctx) {
      clipReveal(ctx, "wipe-out", "rect", wipeRect(ctx.values.direction as Direction, false, ctx.padding()));
    },
  },
  {
    descriptor: {
      id: "exit.undraw",
      name: "Undraw out",
      kind: "exit",
      description: "Fades the fill out over the first 40% (with `fill`, ease in), and takes the outline back along its length: draw in reversed.",
      appliesTo: `${SHAPES} with a stroke`,
      params: [{ name: "fill", type: "bool", label: "Fade the fill out", default: true }],
      ms: 450,
      ease: MOVE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      drawOn(ctx, false);
    },
  },

  // ── Emphasis ──────────────────────────────────────────────────────
  {
    descriptor: {
      id: "emphasis.pulse",
      name: "Pulse",
      kind: "emphasis",
      description: "Swells by `amount` and back round its centre, `count` times (scale × (1 + amount · sin²(π · count · t))).",
      appliesTo: ANY,
      params: [{ name: "amount", type: "float", label: "Amount", default: 0.15, min: 0, max: 2, step: 0.01, unit: "×", description: "Extra scale at the peak." }, count(1)],
      ms: 600,
      ease: "linear",
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("pulse");
      ctx.add({ id: w, ...ctx.timing(), behavior: { type: "pulse", count: ctx.values.count as number }, attrs: { transform: [scaleAbout(c, 1), scaleAbout(c, 1 + (ctx.values.amount as number))] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.shake",
      name: "Shake",
      kind: "emphasis",
      description: "Shakes side to side (or up and down) by `amount`, `count` times, settling as it goes (amount · sin(2π · count · t) · (1 − t)).",
      appliesTo: ANY,
      params: [
        { name: "amount", type: "float", label: "Amount", default: 8, min: 0, max: 500, step: 1, unit: "viewBox units" },
        count(3, 40),
        { name: "axis", type: "enum", label: "Axis", default: "horizontal", options: ["horizontal", "vertical"] },
      ],
      ms: 500,
      ease: "linear",
      needsBox: false,
    },
    expand(ctx) {
      const a = ctx.values.amount as number;
      const w = ctx.wrap("shake");
      const to = ctx.values.axis === "vertical" ? translate(0, a) : translate(a, 0);
      ctx.add({ id: w, ...ctx.timing(), behavior: { type: "oscillate", count: ctx.values.count as number, decay: 1 }, attrs: { transform: [translate(0, 0), to] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.teeter",
      name: "Teeter",
      kind: "emphasis",
      description: "Rocks round its centre by `angle` either way, `count` times, settling as it goes (a decaying sine).",
      appliesTo: ANY,
      params: [{ name: "angle", type: "float", label: "Angle", default: 8, min: 0, max: 180, step: 1, unit: "degrees" }, count(3, 40)],
      ms: 600,
      ease: "linear",
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("teeter");
      ctx.add({ id: w, ...ctx.timing(), behavior: { type: "oscillate", count: ctx.values.count as number, decay: 1 }, attrs: { transform: [rotateAbout(c, 0), rotateAbout(c, ctx.values.angle as number)] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.wave",
      name: "Wave",
      kind: "emphasis",
      description: "Bobs up and down by `amount`, `count` times, smoothly and without settling, like something floating on a swell.",
      appliesTo: ANY,
      params: [{ name: "amount", type: "float", label: "Amount", default: 6, min: 0, max: 500, step: 1, unit: "viewBox units" }, count(2, 40)],
      ms: 1000,
      ease: "linear",
      needsBox: false,
    },
    expand(ctx) {
      const w = ctx.wrap("wave");
      ctx.add({ id: w, ...ctx.timing(), behavior: { type: "oscillate", count: ctx.values.count as number }, attrs: { transform: [translate(0, 0), translate(0, -(ctx.values.amount as number))] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.color-pulse",
      name: "Colour pulse",
      kind: "emphasis",
      description: "Tints the element's fill (or stroke) toward `color` and back, `count` times.",
      appliesTo: "an element with its own fill (or stroke) written #rrggbb or as a {{colour}} control",
      params: [
        { name: "color", type: "color", label: "Colour", default: "#f59e0b" },
        { name: "attribute", type: "enum", label: "Paints", default: "fill", options: ["fill", "stroke"] },
        count(1),
      ],
      ms: 600,
      ease: "linear",
      needsBox: false,
    },
    expand(ctx) {
      const name = ctx.values.attribute as string;
      ctx.add({ id: ctx.id, ...ctx.timing(), behavior: { type: "pulse", count: ctx.values.count as number }, attrs: { [name]: [restColour(ctx, name), ctx.values.color as string] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.spin",
      name: "Spin",
      kind: "emphasis",
      description: "Turns round its centre by `angle` (a whole turn by default, so it ends as it began).",
      appliesTo: ANY,
      params: [{ name: "angle", type: "float", label: "Angle", default: 360, min: -3600, max: 3600, step: 15, unit: "degrees", description: "Positive turns clockwise." }],
      ms: 700,
      ease: MOVE_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const c = ctx.centre();
      const w = ctx.wrap("spin");
      ctx.add({ id: w, ...ctx.timing(), attrs: { transform: [rotateAbout(c, 0), rotateAbout(c, ctx.values.angle as number)] } });
    },
  },
  {
    descriptor: {
      id: "emphasis.wiggle",
      name: "Wiggle",
      kind: "emphasis",
      description:
        "Wanders round its place by up to about `amount` (and turns by up to about `rotate`), as smooth seeded noise at `frequency` Hz with `octaves` layers of detail, easing out of and back to rest. The same seed always wanders the same way.",
      appliesTo: ANY,
      params: [
        { name: "amount", type: "float", label: "Amount", default: 6, min: 0, max: 500, step: 1, unit: "viewBox units" },
        { name: "frequency", type: "float", label: "Frequency", default: 3, min: 0.1, max: 30, step: 0.1, unit: "Hz" },
        { name: "octaves", type: "int", label: "Octaves", default: 2, min: 1, max: 8, step: 1, description: "Layers of finer detail." },
        { name: "rotate", type: "float", label: "Turn", default: 0, min: 0, max: 180, step: 1, unit: "degrees", description: "How far it also turns round its centre (needs its box)." },
        { name: "seed", type: "int", label: "Seed", default: 0, min: 0, max: 2147483647, step: 1, description: "0 picks one from the element's id, so each element wanders its own way." },
      ],
      ms: 1500,
      ease: "linear",
      needsBox: false,
    },
    expand(ctx) {
      const a = ctx.values.amount as number;
      const r = ctx.values.rotate as number;
      const c = r > 0 ? ctx.centre() : undefined;
      const w = ctx.wrap("wiggle");
      const seed = (ctx.values.seed as number) || seedOf(ctx.id);
      // Each number wanders on its own channel: x, y, then the angle (the centre's numbers do not change).
      const from = c ? `${translate(0, 0)} ${rotateAbout(c, 0)}` : translate(0, 0);
      const to = c ? `${translate(a, a)} ${rotateAbout(c, r)}` : translate(a, a);
      ctx.add({ id: w, ...ctx.timing(), behavior: { type: "wriggle", frequency: ctx.values.frequency as number, octaves: ctx.values.octaves as number, seed }, attrs: { transform: [from, to] } });
    },
  },

  // ── Path ──────────────────────────────────────────────────────────
  {
    descriptor: {
      id: "path.follow",
      name: "Follow a path",
      kind: "path",
      description:
        "Moves the element's centre along a path in the picture (by id) from `from` to `to` of its length, turning with it when `orient` is on (draw it pointing right). It sits at the path's `from` point until it starts.",
      appliesTo: `${ANY}; \`path\` is the id of a path, line, polyline or polygon in the same units as the element's parent`,
      params: [
        { name: "path", type: "text", label: "Path id", default: "", description: "The id of the path to follow." },
        { name: "orient", type: "bool", label: "Turn with the path", default: false },
        { name: "from", type: "float", label: "From", default: 0, min: 0, max: 1, step: 0.01, unit: "fraction" },
        { name: "to", type: "float", label: "To", default: 1, min: 0, max: 1, step: 0.01, unit: "fraction" },
      ],
      ms: 1400,
      ease: MOVE_EASE,
      needsBox: true,
    },
    expand(ctx) {
      const path = (ctx.values.path as string).trim();
      if (!path) throw new PrimitiveError('path.follow needs `path`: the id of a path, line, polyline or polygon in the picture to follow (params: {path: "route"}).');
      if (path === ctx.id) throw new PrimitiveError(`"${ctx.id}" cannot follow itself; give the id of another path.`);
      const el = ctx.element(path);
      if (!el) throw new PrimitiveError(`There is no element "${path}" to follow; give the id of a path, line, polyline or polygon in the picture.`);
      if (!["path", "line", "polyline", "polygon"].includes(el.tagName)) throw new PrimitiveError(`path.follow follows a path, line, polyline or polygon; "${path}" is a <${el.tagName}>.`);
      if (ctx.sameUnits(path) === false)
        throw new PrimitiveError(`"${path}" and "${ctx.id}" sit in groups with different transforms, so the element would follow it in the wrong place; put the path beside the element (in the same group) and try again.`);
      const c = ctx.centre();
      const w = ctx.wrap("follow");
      ctx.wrap("follow-centre", { transform: translate(-c[0], -c[1]) });
      ctx.add({ id: w, ...ctx.timing(), along: path, at: [ctx.values.from as number, ctx.values.to as number], ...(ctx.values.orient ? { orient: true } : {}) });
    },
  },
  {
    descriptor: {
      id: "path.text",
      name: "Text along a path",
      kind: "path",
      description:
        "Sets a <text>'s words along a path in the picture (by id) and moves them from `from` to `to` of its length, where the text's anchor sits (its middle with text-anchor=\"middle\"); with `from` equal to `to` the words just sit on the path. `lift` raises them off it.",
      appliesTo: "a <text> with words in it; `path` is the id of a <path> in the picture",
      params: [
        { name: "path", type: "text", label: "Path id", default: "", description: "The id of the path the words follow." },
        { name: "from", type: "float", label: "From", default: 0, min: 0, max: 1, step: 0.01, unit: "fraction" },
        { name: "to", type: "float", label: "To", default: 0.5, min: 0, max: 1, step: 0.01, unit: "fraction" },
        { name: "lift", type: "float", label: "Lift", default: 0, min: -100, max: 100, step: 1, unit: "viewBox units", description: "How far above the path the words sit (below when negative)." },
      ],
      ms: 1600,
      ease: MOVE_EASE,
      needsBox: false,
    },
    expand(ctx) {
      if (ctx.tagName !== "text") throw new PrimitiveError(`path.text sets a <text>'s words along a path; "${ctx.id}" is a <${ctx.tagName}>. Apply it to a <text>, or use path.follow to move a shape along the path.`);
      const path = (ctx.values.path as string).trim();
      if (!path) throw new PrimitiveError('path.text needs `path`: the id of a <path> in the picture for the words to follow (params: {path: "curve"}).');
      const el = ctx.element(path);
      if (!el) throw new PrimitiveError(`There is no element "${path}" for the words to follow; give the id of a <path> in the picture.`);
      if (el.tagName !== "path") throw new PrimitiveError(`path.text follows a <path> (browsers set text along paths only); "${path}" is a <${el.tagName}>.`);
      const pct = (v: number) => `${+(v * 100).toFixed(2)}%`;
      const from = pct(ctx.values.from as number);
      const along = ctx.wrapContent("along", "textPath", { href: `#${path}`, startOffset: from });
      // At x 0 and y 0 the text's own position does not push the words along the path: startOffset alone places them.
      ctx.wrapContent("on-path", "tspan", { x: "0", y: "0", dy: String(-(ctx.values.lift as number)) });
      ctx.add({ id: along, ...ctx.timing(), attrs: { startOffset: [from, pct(ctx.values.to as number)] } });
    },
  },
];

/** Every primitive's descriptor, by kind (entrances, emphasis, path, exits). */
export const PRIMITIVES: readonly PrimitiveDescriptor[] = PRIMITIVE_LIST.map((p) => p.descriptor);

const BY_ID = new Map(PRIMITIVE_LIST.map((p) => [p.descriptor.id, p]));

/** @internal A primitive with its expansion, by id. */
export const primitiveById = (id: string): Primitive | undefined => BY_ID.get(id);

/** A primitive's descriptor by id, or undefined. */
export function getPrimitive(id: string): PrimitiveDescriptor | undefined {
  return BY_ID.get(id)?.descriptor;
}

/** The primitives, all or of one kind. */
export function listPrimitives(kind?: PrimitiveDescriptor["kind"]): PrimitiveDescriptor[] {
  return PRIMITIVES.filter((p) => !kind || p.kind === kind);
}
