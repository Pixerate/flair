/**
 * Vector motion: animated SVG pictures described as data. A picture changes in
 * steps (step 0 when it starts, step n at `steps[n - 1]` ms), and everything
 * here is a pure function of its arguments, so a frame comes out the same
 * however it is reached (played, stepped for a recording, or seeked).
 */

/** Easing curves by name. */
export const EASES = {
  linear: (t: number) => t,
  "in-out": (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
} as const;

export type EaseName = keyof typeof EASES;

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` curve: the two control points of a
 * curve from (0, 0) to (1, 1). `x1` and `x2` are 0–1; `y1` and `y2` may go
 * past 0–1 to overshoot (a back ease).
 */
export type CubicBezier = readonly [number, number, number, number];

/** An easing: one of {@link EASES} by name, or any {@link CubicBezier} curve. */
export type SvgEase = EaseName | CubicBezier;

/** Whether `value` is a {@link CubicBezier}: four finite numbers with `x1` and `x2` in 0–1. */
export function isCubicBezier(value: unknown): value is CubicBezier {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1
  );
}

/** Whether `value` is an easing Flair plays: a name in {@link EASES} or a {@link CubicBezier}. */
export const isSvgEase = (value: unknown): value is SvgEase =>
  (typeof value === "string" && value in EASES) || isCubicBezier(value);

const bezierCache = new Map<string, (t: number) => number>();

/** The curve as a function of time (0–1), solved for x by Newton's method with a bisection fallback. */
export function cubicBezierEase([x1, y1, x2, y2]: CubicBezier): (t: number) => number {
  const key = `${x1},${y1},${x2},${y2}`;
  const hit = bezierCache.get(key);
  if (hit) return hit;
  const at = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s * s + s ** 3;
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s * s;
  const fn = (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = at(x1, x2, s) - t;
      if (Math.abs(dx) < 1e-7) return at(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= dx / d;
    }
    let [lo, hi] = [0, 1];
    s = t;
    for (let i = 0; i < 40; i++) {
      const x = at(x1, x2, s);
      if (Math.abs(x - t) < 1e-7) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return at(y1, y2, s);
  };
  if (bezierCache.size > 256) bezierCache.clear();
  bezierCache.set(key, fn);
  return fn;
}

/** An easing as a function of time (0–1); `fallback` when it is not given. */
export function easeFunction(ease: SvgEase | undefined, fallback: EaseName = "in-out"): (t: number) => number {
  if (ease === undefined) return EASES[fallback];
  return typeof ease === "string" ? EASES[ease] : cubicBezierEase(ease);
}

/** How long a change takes by default, in ms. */
export const STEP_MS = 800;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * When `step` starts, in ms since the media started (step 0 at 0, step n at
 * `steps[n - 1]`), or undefined if it has not started yet.
 */
export function stepStart(steps: readonly number[], step: number): number | undefined {
  if (step <= 0) return 0;
  return steps[step - 1];
}

/**
 * How far a change that plays on `step` (after `delay` ms, over `ms`) has
 * got at `timeMs`, eased: 0 before it starts, 1 once it is over.
 */
export function stepProgress(
  steps: readonly number[],
  timeMs: number,
  step: number,
  options: { delay?: number; ms?: number; ease?: SvgEase } = {},
): number {
  const start = stepStart(steps, step);
  if (start === undefined) return 0;
  const from = start + (options.delay ?? 0);
  const ms = options.ms ?? STEP_MS;
  const t = ms > 0 ? clamp01((timeMs - from) / ms) : timeMs >= from ? 1 : 0;
  return easeFunction(options.ease)(t);
}

/** The key an item in a list of data keeps from one state to the next. */
export type DataKey = (item: unknown, index: number) => string;

/**
 * Keys items by their `id`, `key`, `name` or `label` (or a link's `source`
 * and `target`), else by position.
 */
export const defaultDataKey: DataKey = (item, index) => {
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (o.source !== undefined && o.target !== undefined)
      return `${String(o.source)}→${String(o.target)}`;
    for (const k of ["id", "key", "name", "label"])
      if (typeof o[k] === "string" || typeof o[k] === "number") return String(o[k]);
  }
  return String(index);
};

/** Every number in `value` times `k`, so an item can grow from or shrink to nothing. */
function scaled(value: unknown, k: number): unknown {
  if (typeof value === "number") return value * k;
  if (Array.isArray(value)) return value.map((v) => scaled(v, k));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, scaled(v, k)]));
  return value;
}

/**
 * Data between two states, `u` of the way from `a` to `b`. Numbers blend;
 * lists match their items by key (`keyOf`), so each keeps its identity and
 * moves rather than jumping, with items only in `b` growing from nothing and
 * items only in `a` shrinking away; objects blend field by field; anything
 * else changes halfway.
 */
export function lerpData<D>(a: D, b: D, u: number, keyOf: DataKey = defaultDataKey): D {
  if (u <= 0) return a;
  if (u >= 1) return b;
  return blend(a, b, u, keyOf) as D;
}

function blend(a: unknown, b: unknown, u: number, keyOf: DataKey): unknown {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u;
  if (Array.isArray(a) && Array.isArray(b)) {
    const before = new Map(a.map((item, i) => [keyOf(item, i), item]));
    const after = new Set(b.map((item, i) => keyOf(item, i)));
    const out: unknown[] = b.map((item, i) => {
      const key = keyOf(item, i);
      return before.has(key) ? blend(before.get(key), item, u, keyOf) : scaled(item, u);
    });
    a.forEach((item, i) => {
      if (!after.has(keyOf(item, i))) out.push(scaled(item, 1 - u));
    });
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    return Object.fromEntries(
      [...new Set([...Object.keys(ao), ...Object.keys(bo)])].map((k) => [
        k,
        k in ao && k in bo
          ? blend(ao[k], bo[k], u, keyOf)
          : k in bo
            ? scaled(bo[k], u)
            : scaled(ao[k], 1 - u),
      ]),
    );
  }
  return u < 0.5 ? a : b;
}

/**
 * The data to show at `timeMs`, for media whose data has a state per step:
 * `states[n]` is shown from step n (the last one stays), reached by moving
 * from the state before it over `ms`.
 */
export function stepData<D>(
  states: readonly D[],
  steps: readonly number[],
  timeMs: number,
  options: { ms?: number; ease?: SvgEase; keyOf?: DataKey } = {},
): D {
  const last = Math.min(steps.length, states.length - 1);
  const to = states[last]!;
  if (last === 0) return to;
  const u = stepProgress(steps, timeMs, last, options);
  return lerpData(states[last - 1]!, to, u, options.keyOf);
}

// ── SVG media ──────────────────────────────────────────────────────────

/**
 * An animated SVG picture: markup plus changes to its elements. Draw it with
 * `SvgPlayer` (or `svgView`), or compute frames yourself with `svgFrame`.
 */
export interface SvgMotion {
  /** One self-contained `<svg>` with a `viewBox`: no scripts, no outside links. */
  svg: string;
  /** Changes to its elements, each on a step. */
  animate?: SvgAnimation[];
}

/** A box in an SVG's `viewBox` units: `[x, y, width, height]`. */
export type SvgBox = readonly [number, number, number, number];

/** A change to one element of an {@link SvgMotion}, or (with `view`) to the whole picture. */
export interface SvgAnimation {
  /** The element's `id` in the SVG (not needed for `view`). */
  id?: string;
  /** The step it plays on: 0 (default) when the media starts, 1 with the next shot, and so on. */
  step?: number;
  /** Ms after the step starts. */
  delay?: number;
  /** How long it takes, in ms (default {@link STEP_MS}). */
  ms?: number;
  /** A name in {@link EASES} (default `"in-out"`) or a `[x1, y1, x2, y2]` cubic-bezier curve. */
  ease?: SvgEase;
  /**
   * Attributes from one value to another: numbers, colours (`#rrggbb`), or
   * strings whose numbers change while the rest stays the same (a path's
   * `d`, a `transform`, `points`).
   */
  attrs?: Record<string, readonly [string | number, string | number]>;
  /** Draws a line or outline on along its length, from 0 to 1 (or between two fractions). */
  draw?: boolean | readonly [number, number];
  /**
   * Zooms and pans the whole picture to frame a box (`[x, y, width, height]`
   * in the `viewBox`'s units) or an element by id (with a margin round it),
   * from where the last `view` left it (at first, the whole `viewBox`).
   */
  view?: SvgBox | string;
  /**
   * Moves the element along a path (by id) from its start to its end, or
   * between the fractions in `at`; draw the element round (0, 0), like a
   * circle at `cx="0" cy="0"`.
   */
  along?: string;
  /** How far along the path `along` moves the element, from and to (default [0, 1]). */
  at?: readonly [number, number];
  /**
   * Sets the active child index in a solo container (data-solo group or element with multiple children).
   * Hides all siblings except the one at this index (0-based).
   */
  solo?: number;
  /** Counts the element's text from one number to the other. */
  count?: readonly [number, number];
  /** How a count is written: `{n}` stands for the number ("{n}%", "$ {n}M"). */
  format?: string;
  /** Decimals in a count (default 0). */
  decimals?: number;
  /**
   * Writes this text into the element letter by letter: none of it when the
   * change starts, all of it when it ends (a typewriter).
   */
  write?: string;
  /**
   * With `write`: letters not yet written show characters picked from this
   * string, changing every {@link SCRAMBLE_MS} ms, so the text decodes
   * rather than types. The same time always picks the same characters.
   */
  scramble?: string;
  /** With `write`: shown after the written letters while it writes ("▌", "|"). */
  caret?: string;
}

/** How often scrambled letters change, in ms (see `SvgAnimation.scramble`). */
export const SCRAMBLE_MS = 50;

/**
 * `text` with `u` (0–1) of its letters written (see `SvgAnimation.write`):
 * the rest scrambled from `scramble` (picked by `timeMs`) or left off, then
 * the caret while it is unfinished. Letters are code points, so emoji and
 * accents are never split.
 */
export function writtenText(
  text: string,
  u: number,
  options: { scramble?: string; caret?: string; timeMs?: number } = {},
): string {
  const letters = Array.from(text);
  const shown = Math.round(clamp01(u) * letters.length);
  let out = letters.slice(0, shown).join("");
  const pool = Array.from(options.scramble ?? "");
  if (pool.length) {
    const tick = Math.floor((options.timeMs ?? 0) / SCRAMBLE_MS);
    for (let i = shown; i < letters.length; i++)
      out += /\s/.test(letters[i]!) ? letters[i] : pool[Math.floor(noise(i, tick) * pool.length)];
  }
  return shown < letters.length && options.caret ? out + options.caret : out;
}

/** A repeatable 0–1 number for a letter at a tick. */
function noise(i: number, tick: number): number {
  const x = Math.sin(i * 127.1 + tick * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** What one element of an animated SVG shows at a time. */
export interface SvgElementFrame {
  attrs: Record<string, string>;
  /** How much of its length is drawn, 0–1. */
  draw?: number;
  text?: string;
  /** Active child index when targeting a solo container. */
  solo?: number;
  /** Where it is along a path: the path's id and the fraction of its length. */
  along?: { path: string; at: number };
  /**
   * The whole picture's framing (on the frame for {@link SVG_PICTURE}): `u`
   * of the way from one view to the next, `null` being the whole `viewBox`.
   */
  view?: { from: SvgBox | string | null; to: SvgBox | string; u: number };
}

/** The key of the whole picture's frame in {@link svgFrame}'s result (for `view`). */
export const SVG_PICTURE = "";

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function rgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A value `u` of the way between two attribute values (see `SvgAnimation.attrs`). */
export function lerpAttr(a: string | number, b: string | number, u: number): string {
  if (typeof a === "number" && typeof b === "number") return String(round(a + (b - a) * u));
  const sa = String(a);
  const sb = String(b);
  if (HEX.test(sa) && HEX.test(sb)) {
    const [ca, cb] = [rgb(sa), rgb(sb)];
    return `#${ca
      .map((c, i) =>
        Math.round(c + (cb[i]! - c) * u)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }
  const na = sa.match(NUMBER) ?? [];
  const nb = sb.match(NUMBER) ?? [];
  if (na.length && na.length === nb.length && sa.replace(NUMBER, "#") === sb.replace(NUMBER, "#")) {
    let i = 0;
    return sa.replace(NUMBER, () => {
      const v = Number(na[i]) + (Number(nb[i]) - Number(na[i])) * u;
      i++;
      return String(round(v));
    });
  }
  return u < 0.5 ? sa : sb;
}

/** Formats a number for a count animation (`{n}` stands for the rounded number). */
export function formatCount(
  value: number,
  options: { decimals?: number; format?: string } = {},
): string {
  const n = value.toFixed(options.decimals ?? 0);
  return (options.format ?? "{n}").replace("{n}", n);
}

const startOf = (a: SvgAnimation, steps: readonly number[]) => {
  const s = stepStart(steps, a.step ?? 0);
  return s === undefined ? Infinity : s + (a.delay ?? 0);
};

/**
 * What each animated element shows at `timeMs`. For each attribute (or
 * line, count or writing) the latest change to have started wins; before the first
 * one starts, the element shows that change's starting value, so something
 * that grows in later is hidden until then.
 */
export function svgFrame(
  animations: readonly SvgAnimation[],
  steps: readonly number[],
  timeMs: number,
): Map<string, SvgElementFrame> {
  // Each property's changes in the order they start (ties: list order).
  const tracks = new Map<string, { anim: SvgAnimation; start: number; index: number }[]>();
  const add = (prop: string, anim: SvgAnimation, index: number) => {
    const key = `${prop === "view" ? SVG_PICTURE : anim.id}\u0000${prop}`;
    const list = tracks.get(key) ?? [];
    list.push({ anim, start: startOf(anim, steps), index });
    tracks.set(key, list);
  };
  animations.forEach((a, i) => {
    for (const name of Object.keys(a.attrs ?? {})) add(`@${name}`, a, i);
    if (a.draw) add("draw", a, i);
    if (a.count) add("count", a, i);
    if (a.write !== undefined) add("count", a, i);
    if (a.solo !== undefined) add("solo", a, i);
    if (a.view !== undefined) add("view", a, i);
    if (a.along) add("along", a, i);
  });
  const frames = new Map<string, SvgElementFrame>();
  for (const [key, list] of tracks) {
    list.sort((x, y) => x.start - y.start || x.index - y.index);
    const [id, prop] = key.split("\u0000") as [string, string];
    const started = list.filter((c) => c.start <= timeMs);
    const current = started[started.length - 1];
    const anim = (current ?? list[0]!).anim;
    const u = current
      ? stepProgress(steps, timeMs, anim.step ?? 0, {
          delay: anim.delay,
          ms: anim.ms,
          ease: anim.ease,
        })
      : 0;
    const frame = frames.get(id) ?? { attrs: {} };
    if (prop === "view") {
      // From where the change before it left the picture.
      const before = current ? list[list.indexOf(current) - 1] : undefined;
      frame.view = { from: before?.anim.view ?? null, to: anim.view!, u };
    } else if (prop === "along") {
      const [a, b] = anim.at ?? [0, 1];
      frame.along = { path: anim.along!, at: a + (b - a) * u };
    } else if (prop === "solo") {
      frame.solo = anim.solo;
    } else if (prop.startsWith("@")) {
      const [a, b] = anim.attrs![prop.slice(1)]!;
      frame.attrs[prop.slice(1)] = lerpAttr(a, b, u);
    } else if (prop === "draw") {
      const [a, b] = anim.draw === true ? [0, 1] : (anim.draw as readonly [number, number]);
      frame.draw = a + (b - a) * u;
    } else if (anim.write !== undefined) {
      frame.text = writtenText(anim.write, u, { scramble: anim.scramble, caret: anim.caret, timeMs });
    } else {
      const [a, b] = anim.count!;
      frame.text = formatCount(a + (b - a) * u, anim);
    }
    frames.set(id, frame);
  }
  return frames;
}

/**
 * The opening tag of the root element at the start of `markup` (up to its
 * first `>`), cut out without a regular expression, so checks on it stay
 * linear however long or odd the markup is.
 */
export function svgOpeningTag(markup: string): string {
  const end = markup.indexOf(">");
  return end < 0 ? markup : markup.slice(0, end + 1);
}

/** Problems with an {@link SvgMotion}, as sentences; none when it can be drawn. */
export function svgMotionIssues(motion: unknown): string[] {
  const issues: string[] = [];
  const m = (motion ?? {}) as Partial<SvgMotion>;
  const svg = typeof m.svg === "string" ? m.svg.trim() : "";
  if (!svg) return ["`svg` needs the picture's markup: one <svg> element"];
  if (!/^<svg[\s>]/i.test(svg) || !svg.toLowerCase().endsWith("</svg>"))
    issues.push("`svg` must be one <svg>…</svg> element");
  if (!/\sviewBox\s*=/i.test(svgOpeningTag(svg)))
    issues.push("the <svg> needs a `viewBox`, so it scales to where it is placed");
  if (/<script|<foreignObject|\son\w+\s*=/i.test(svg))
    issues.push("`svg` cannot have scripts, event handlers or <foreignObject>");
  if (/<(animate|animateTransform|animateMotion|set)[\s/>]/i.test(svg))
    issues.push(
      "`svg` cannot animate itself (<animate>, <animateTransform>, <animateMotion>, <set>): give changes in `animate`, so every frame is a function of time",
    );
  if (/(?:href|src)\s*=\s*["'](?!#|data:image\/)/i.test(svg))
    issues.push("`svg` cannot link outside itself (only #ids and data:image URLs)");
  const ids = new Set([...svg.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((x) => x[1]));
  if (m.animate !== undefined && !Array.isArray(m.animate)) issues.push("`animate` must be a list");
  (Array.isArray(m.animate) ? m.animate : []).forEach((a, i) => {
    const where = `animate[${i}]`;
    if (!a || typeof a !== "object") return void issues.push(`${where} is not an animation`);
    if (typeof a.id !== "string") {
      if (a.view === undefined) return void issues.push(`${where} needs an \`id\``);
    } else if (!ids.has(a.id))
      issues.push(`${where}: there is no element with id "${a.id}" in the SVG`);
    if (a.step !== undefined && !(Number.isInteger(a.step) && a.step >= 0))
      issues.push(`${where}: \`step\` is a whole number, 0 or more`);
    if (a.ms !== undefined && !(a.ms >= 0)) issues.push(`${where}: \`ms\` must be 0 or more`);
    if (a.delay !== undefined && !(a.delay >= 0))
      issues.push(`${where}: \`delay\` must be 0 or more`);
    if (a.ease !== undefined && !isSvgEase(a.ease))
      issues.push(`${where}: \`ease\` is one of ${Object.keys(EASES).join(", ")}, or a cubic-bezier [x1, y1, x2, y2] with x1 and x2 from 0 to 1`);
    if (!a.attrs && !a.draw && !a.count && a.write === undefined && a.view === undefined && !a.along && a.solo === undefined)
      issues.push(
        `${where} changes nothing: give \`attrs\`, \`draw\`, \`count\`, \`write\`, \`view\`, \`along\` or \`solo\``,
      );
    if (a.solo !== undefined && !(Number.isInteger(a.solo) && a.solo >= 0))
      issues.push(`${where}: \`solo\` is an index (whole number, 0 or more)`);
    if (a.view !== undefined) {
      const box = a.view as unknown;
      if (typeof box === "string") {
        if (!ids.has(box))
          issues.push(`${where}: \`view\` frames "${box}", which is not an id in the SVG`);
      } else if (
        !Array.isArray(box) ||
        box.length !== 4 ||
        !box.every((n) => Number.isFinite(n)) ||
        !(box[2] > 0 && box[3] > 0)
      )
        issues.push(
          `${where}: \`view\` is [x, y, width, height] (width and height above 0) or an element's id`,
        );
    }
    if (a.along !== undefined) {
      if (typeof a.along !== "string" || !ids.has(a.along))
        issues.push(`${where}: \`along\` is the id of a path in the SVG`);
      if (typeof a.id !== "string")
        issues.push(`${where}: \`along\` moves an element: give its \`id\``);
    }
    if (
      a.at !== undefined &&
      !(Array.isArray(a.at) && a.at.length === 2 && a.at.every((v) => v >= 0 && v <= 1))
    )
      issues.push(`${where}: \`at\` is [from, to] between 0 and 1`);
    for (const [name, pair] of Object.entries(a.attrs ?? {}))
      if (!Array.isArray(pair) || pair.length !== 2)
        issues.push(`${where}: \`attrs.${name}\` is [from, to]`);
    if (Array.isArray(a.draw) && a.draw.some((v) => !(v >= 0 && v <= 1)))
      issues.push(`${where}: \`draw\` is true or [from, to] between 0 and 1`);
    if (a.count !== undefined && !(Array.isArray(a.count) && a.count.length === 2))
      issues.push(`${where}: \`count\` is [from, to]`);
    if (a.write !== undefined && typeof a.write !== "string")
      issues.push(`${where}: \`write\` is the text to write`);
    if ((a.scramble !== undefined || a.caret !== undefined) && a.write === undefined)
      issues.push(`${where}: \`scramble\` and \`caret\` go with \`write\``);
  });
  return issues;
}
