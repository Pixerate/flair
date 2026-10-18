/**
 * An {@link SvgMotion} as one self-contained animated `.svg` file, with no
 * DOM and no script: its changes written as SMIL (`<animate>`,
 * `<animateTransform>`, `<animateMotion>`), so it plays on its own wherever
 * an SVG image does (an `<img src>`, a file opened directly, inline markup).
 */

import { pathPointAt } from "./morph.js";
import {
  STEP_MS,
  SVG_PICTURE,
  stepStart,
  easeFunction,
  svgFrame,
  type CubicBezier,
  type EaseName,
  type SvgAnimation,
  type SvgEase,
  type SvgBox,
  type SvgElementFrame,
  type SvgMotion,
} from "./motion.js";
import { getAttr, serialize, setAttr, svgFrameTree, type SvgNode } from "./static.js";
import { svgDuration } from "./svg.js";

export interface AnimatedSvgOptions {
  /** Loop length in ms (default: `svgDuration(motion, steps)` + `hold`). */
  duration?: number;
  /** Ms to rest on the last frame before looping (default 600, like `SvgPlayer`). */
  hold?: number;
  /** Loop forever (default true); false plays once and holds the last frame. */
  loop?: boolean;
  /** Step start times in ms, for pictures that change on steps (like `SvgPlayer`'s `steps`). */
  steps?: readonly number[];
  /**
   * Samples per second for what cannot be written exactly (counts, written
   * text, a change cut short by the next, a `matrix` transform); default 30.
   */
  fps?: number;
  /**
   * Added to the ids the picture refers to (its gradients, filters, clips,
   * paths followed), so two files inlined in one page each use their own.
   * Default: a hash of the motion, so the same motion gives the same file;
   * `""` keeps ids as written.
   */
  idSuffix?: string;
}

/**
 * How a value gets to a keyframe from the one before: the shapes `EASES` are
 * made of, or a cubic-bezier curve written as it is.
 */
type Shape = "linear" | "in" | "out" | CubicBezier;

/** A channel's value at a time, reached from the keyframe before along `shape`. */
interface Key {
  t: number;
  v: string;
  shape: Shape;
}

/** One change to a channel, when it starts. */
interface Change {
  anim: SvgAnimation;
  start: number;
}

/**
 * Cubic Bézier timing for each shape. `out` (1 − (1 − t)³) is exactly the
 * curve (0, 1, 1, 1), and `in-out` is `in` (t³, the curve (0, 0, 0, 1)) to
 * its middle then `out`, so eases are written exactly, not sampled.
 */
const SPLINES: Record<Extract<Shape, string>, string> = { linear: "0 0 1 1", in: "0.3333 0 0.6667 0", out: "0.3333 1 0.6667 1" };

/** When a named ease is halfway (where a value that cannot blend switches), as a share of its time. */
const HALFWAY: Record<EaseName, number> = { linear: 0.5, "in-out": 0.5, out: 1 - 0.5 ** (1 / 3) };

/** When an ease is first halfway, as a share of its time. */
function halfway(ease: SvgEase): number {
  if (typeof ease === "string") return HALFWAY[ease];
  const f = easeFunction(ease);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0.5) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** SMIL key splines: a shape's control points, written as given. */
const splineOf = (shape: Shape) => (typeof shape === "string" ? SPLINES[shape] : shape.map((n) => String(+n.toFixed(4))).join(" "));

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const TRANSFORMS = new Set(["transform", "gradienttransform", "patterntransform"]);
const URL_REF = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;

/** Whether `lerpAttr` blends two values (else it switches halfway), so SMIL can interpolate them. */
function blends(a: string | number, b: string | number): boolean {
  if (typeof a === "number" && typeof b === "number") return true;
  const [sa, sb] = [String(a), String(b)];
  if (HEX.test(sa) && HEX.test(sb)) return true;
  const na = sa.match(NUMBER) ?? [];
  return na.length > 0 && na.length === (sb.match(NUMBER) ?? []).length && sa.replace(NUMBER, "#") === sb.replace(NUMBER, "#");
}

const num = (n: number) => String(+n.toFixed(3));

/** A short, stable hash of a string, for default id suffixes. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** An element: `<tag attrs/>`. */
const node = (tag: string, attrs: Record<string, string | undefined>, children: SvgNode["children"] = []): SvgNode => ({
  tag,
  attrs: Object.entries(attrs).filter((e): e is [string, string] => e[1] !== undefined),
  children,
});

/**
 * The transform functions in a `transform` value, with their arguments:
 * `translate(10 20) rotate(45)` → [["translate", [10, 20]], ["rotate", [45]]].
 */
function transformList(value: string): [string, number[]][] {
  return [...value.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)].map((m) => [m[1]!, (m[2]!.match(NUMBER) ?? []).map(Number)]);
}

/** A transform list as one matrix [a b c d e f]. */
function transformMatrix(value: string): number[] {
  let m = [1, 0, 0, 1, 0, 0];
  const times = (n: number[]) => {
    const [a, b, c, d, e, f] = m as [number, number, number, number, number, number];
    m = [a * n[0]! + c * n[1]!, b * n[0]! + d * n[1]!, a * n[2]! + c * n[3]!, b * n[2]! + d * n[3]!, a * n[4]! + c * n[5]! + e, b * n[4]! + d * n[5]! + f];
  };
  const rad = Math.PI / 180;
  for (const [name, [p = 0, q, r = 0, s = 0, t = 0, u = 0]] of transformList(value)) {
    if (name === "translate") times([1, 0, 0, 1, p, q ?? 0]);
    else if (name === "scale") times([p, 0, 0, q ?? p, 0, 0]);
    else if (name === "rotate") {
      const [cos, sin] = [Math.cos(p * rad), Math.sin(p * rad)];
      const [cx, cy] = [q ?? 0, r];
      times([1, 0, 0, 1, cx, cy]);
      times([cos, sin, -sin, cos, 0, 0]);
      times([1, 0, 0, 1, -cx, -cy]);
    } else if (name === "skewX") times([1, 0, Math.tan(p * rad), 1, 0, 0]);
    else if (name === "skewY") times([1, Math.tan(p * rad), 0, 1, 0, 0]);
    else if (name === "matrix") times([p, q ?? 0, r, s, t, u]);
  }
  return m;
}

/** A matrix as translate · rotate · skewX · scale (degrees), the order SMIL can add them in. */
function decompose([a, b, c, d, e, f]: number[]): [number, number, number, number, number, number] {
  const sx = Math.hypot(a!, b!);
  const angle = sx ? Math.atan2(b!, a!) : 0;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const sy = -sin * c! + cos * d!;
  const skew = sy ? Math.atan((cos * c! + sin * d!) / sy) : 0;
  return [e!, f!, (angle * 180) / Math.PI, (skew * 180) / Math.PI, sx, sy];
}

/** A shape's outline as a path `d`, for following it with `along`. */
function outline(el: SvgNode): string | undefined {
  const at = (name: string) => Number(getAttr(el, name) ?? 0);
  switch (el.tag.toLowerCase()) {
    case "path":
      return getAttr(el, "d");
    case "line":
      return `M${at("x1")} ${at("y1")}L${at("x2")} ${at("y2")}`;
    case "polyline":
    case "polygon":
      return `M${getAttr(el, "points") ?? ""}${el.tag.toLowerCase() === "polygon" ? "Z" : ""}`;
    default:
      return undefined;
  }
}

/**
 * The timing attributes that play `keys` over the loop: `keyTimes` and,
 * where a key eases in, `keySplines`. Keys at the same time are a jump.
 */
function timing(keys: readonly Key[], loop: number, repeat: boolean, discrete = false): Record<string, string | undefined> {
  const spline = !discrete && keys.some((k, i) => i > 0 && k.shape !== "linear");
  return {
    ...clock(loop, repeat),
    keyTimes: keys.map((k) => String(+(k.t / loop).toFixed(5))).join(";"),
    calcMode: discrete ? "discrete" : spline ? "spline" : "linear",
    keySplines: spline ? keys.slice(1).map((k) => splineOf(k.shape)).join(";") : undefined,
  };
}

/** How long an animation runs, and whether it repeats or holds its end. */
const clock = (loop: number, repeat: boolean) => ({
  dur: `${+(loop / 1000).toFixed(4)}s`,
  repeatCount: repeat ? "indefinite" : undefined,
  fill: repeat ? undefined : "freeze",
});

/** Keys with their repeats dropped: a key between two of the same value, or a copy of the one before. */
function collapse(keys: Key[]): Key[] {
  const out: Key[] = [];
  keys.forEach((k, i) => {
    const prev = out[out.length - 1];
    if (prev && prev.v === k.v && (prev.t === k.t || (keys[i + 1]?.v === k.v && i < keys.length - 1))) return;
    out.push(k);
  });
  return out;
}

/** Keys reduced to where the value changes, for a discrete animation (the last at a time wins). */
function runs(keys: readonly Key[]): Key[] {
  const out: Key[] = [];
  for (const k of keys) {
    const prev = out[out.length - 1];
    if (prev?.t === k.t) out.pop();
    if (out[out.length - 1]?.v !== k.v) out.push(k);
  }
  return out;
}

/**
 * The {@link SvgMotion} as one animated SVG file that plays and loops on its
 * own, as `SvgPlayer` plays it, with no script: save it as `.svg`, put it in
 * an `<img src>`, or inline it. Each element starts as the motion's first
 * frame, so it still shows that where SMIL does not run.
 *
 * Attribute changes become one `<animate>` per attribute (`<animateTransform>`
 * per function of a `transform`), with the eases written exactly as splines;
 * `draw` animates `stroke-dashoffset`; `along` becomes `<animateMotion>` on
 * the path; `view` animates the root `viewBox` (keeping `data-fixed` and
 * `data-nonscaling` elements as the player does); `solo` toggles `display`.
 * Counts and written text are sampled at `fps`, each text shown in its own
 * `<tspan>` in turn.
 *
 * Limits: a `view` that frames an element by id stays where it is (it needs
 * layout, as in `svgFrameMarkup`); `style` and other attributes SMIL cannot
 * interpolate change in steps; ids are suffixed only where the picture
 * refers to them (CSS `#id` selectors in a `<style>` are left as written).
 * Undefined when `motion.svg` is not an `<svg>`.
 */
export function svgAnimatedMarkup(motion: SvgMotion, options: AnimatedSvgOptions = {}): string | undefined {
  const steps = options.steps ?? [];
  const repeat = options.loop ?? true;
  const fps = options.fps ?? 30;
  const loop = Math.max(1, options.duration ?? svgDuration(motion, steps) + (options.hold ?? 600));
  const animations = motion.animate ?? [];
  const tree = svgFrameTree(motion, steps, 0);
  if (!tree) return undefined;
  const { svg, byId, whole } = tree;

  // Each property's changes in the order they start, as `svgFrame` keeps them.
  const tracks = new Map<string, Change[]>();
  animations.forEach((anim) => {
    const s = stepStart(steps, anim.step ?? 0);
    const start = s === undefined ? Infinity : s + (anim.delay ?? 0);
    const add = (prop: string) => {
      const key = `${prop === "view" ? SVG_PICTURE : anim.id}\u0000${prop}`;
      tracks.set(key, [...(tracks.get(key) ?? []), { anim, start }]);
    };
    for (const name of Object.keys(anim.attrs ?? {})) add(`@${name}`);
    if (anim.draw) add("draw");
    if (anim.count || anim.write !== undefined) add("text");
    if (anim.solo !== undefined) add("solo");
    if (anim.view !== undefined) add("view");
    if (anim.along) add("along");
  });
  for (const list of tracks.values()) list.sort((x, y) => x.start - y.start);

  const frames = new Map<number, Map<string, SvgElementFrame>>();
  const frameAt = (t: number) => {
    let f = frames.get(t);
    if (!f) frames.set(t, (f = svgFrame(animations, steps, t)));
    return f;
  };
  const boxOf = (v: SvgBox | string | null) => (v === null ? whole : typeof v === "string" ? undefined : v);
  /** A channel's value in a frame, as written into the file. */
  const read = (frame: Map<string, SvgElementFrame>, id: string, prop: string): string | undefined => {
    const f = frame.get(id);
    if (!f) return undefined;
    if (prop.startsWith("@")) return f.attrs[prop.slice(1)];
    if (prop === "draw") return f.draw === undefined ? undefined : num(1 - f.draw);
    if (prop === "along") return f.along && num(f.along.at);
    if (prop === "solo") return f.solo === undefined ? undefined : String(f.solo);
    if (prop === "text") return f.text;
    if (!f.view) return undefined;
    const [a, b] = [boxOf(f.view.from), boxOf(f.view.to)];
    const box = a && b ? a.map((n, i) => n + (b[i]! - n) * f.view!.u) : (b ?? a ?? whole);
    return box?.map(num).join(" ");
  };

  /**
   * A channel's keyframes over the loop: before its first change its start,
   * then each change from its start to its end (or the next change), eased
   * exactly or (with `sampled`, or when cut short) sampled at `fps`.
   */
  const keyframes = (id: string, prop: string, list: readonly Change[], sampled = false): Key[] => {
    const shown = list.filter((c, i) => c.start < loop && !(list[i + 1] && list[i + 1]!.start <= c.start));
    // A change alone (with the one before it, where a view starts) gives its own value at any time.
    const value = (k: number, t: number) =>
      read(svgFrame(shown.slice(Math.max(0, k - 1), k + 1).map((c) => c.anim), steps, t), id, prop) ?? "";
    const keys: Key[] = [];
    const push = (t: number, v: string, shape: Shape = "linear") => keys.push({ t, v, shape });
    if (!shown.length) return [];
    push(0, read(frameAt(0), id, prop) ?? value(0, 0));
    shown.forEach((c, k) => {
      const next = Math.min(shown[k + 1]?.start ?? loop, loop);
      const ms = c.anim.ms ?? STEP_MS;
      const end = Math.min(c.start + ms, next);
      // Held until it starts, where it may jump.
      push(c.start, keys[keys.length - 1]!.v);
      push(c.start, value(k, c.start));
      if (!(ms > 0)) return;
      const ease = c.anim.ease ?? "in-out";
      const pair = prop.startsWith("@") ? c.anim.attrs![prop.slice(1)]! : undefined;
      if (pair && !blends(pair[0], pair[1])) {
        const at = c.start + ms * halfway(ease);
        if (at < next) {
          push(at, value(k, c.start));
          push(at, value(k, end));
        }
      } else if (!sampled && end === c.start + ms && typeof ease !== "string" && ease.every((n) => n >= 0 && n <= 1)) {
        // SMIL takes any curve whose control points stay within 0–1.
        push(end, value(k, end), ease);
      } else if (!sampled && end === c.start + ms && ease !== "linear" && typeof ease === "string") {
        if (ease === "in-out") push(c.start + ms / 2, value(k, c.start + ms / 2), "in");
        push(end, value(k, end), "out");
      } else if (!sampled && ease === "linear") push(end, value(k, end));
      else {
        for (let t = c.start + 1000 / fps; t < end; t += 1000 / fps) push(t, value(k, t));
        push(end, value(k, end));
      }
    });
    if (keys[keys.length - 1]!.t < loop) push(loop, keys[keys.length - 1]!.v);
    return collapse(keys);
  };

  /** Times to sample text at: every 1/fps, and wherever a change starts or ends. */
  const sampleTimes = (list: readonly Change[]) => {
    const times = new Set<number>();
    for (let t = 0; t < loop; t += 1000 / fps) times.add(+t.toFixed(3));
    for (const c of list)
      for (const t of [c.start, c.start + (c.anim.ms ?? STEP_MS)]) if (t < loop) times.add(t);
    return [...times].sort((a, b) => a - b);
  };

  // What to add to each element, appended once all are worked out (so a solo's children stay as written).
  const added = new Map<SvgNode, SvgNode[]>();
  const add = (el: SvgNode, ...anims: SvgNode[]) => added.set(el, [...(added.get(el) ?? []), ...anims]);
  const animate = (name: string, keys: readonly Key[], values = keys.map((k) => k.v), discrete = false) =>
    node("animate", { attributeName: name, values: values.join(";"), ...timing(keys, loop, repeat, discrete) });
  const followers = new Set(animations.filter((a) => a.along).map((a) => a.id));
  let viewKeys: Key[] | undefined;

  for (const [key, list] of tracks) {
    const [id, prop] = key.split("\u0000") as [string, string];
    const el = id === SVG_PICTURE ? svg : byId.get(id);
    if (!el) continue;
    const name = prop.slice(1);
    if (prop === "text") {
      // One <tspan> per text it shows, each shown in its turn.
      const own = list.map((c) => c.anim);
      const text = (t: number) => read(svgFrame(own, steps, t), id, prop) ?? "";
      const shown: Key[] = [];
      let last = -1;
      for (const t of sampleTimes(list)) {
        const v = text(t);
        if (shown.length && v !== shown[shown.length - 1]!.v) {
          let [lo, hi] = [last, t];
          while (hi - lo > 0.5) {
            const mid = (lo + hi) / 2;
            if (text(mid) === shown[shown.length - 1]!.v) lo = mid;
            else hi = mid;
          }
          // One change between them is placed exactly; several (a fast count) change at the middle.
          shown.push({ t: text(hi) === v ? hi : (last + t) / 2, v, shape: "linear" });
        }
        if (v !== shown[shown.length - 1]?.v) shown.push({ t, v, shape: "linear" });
        last = t;
      }
      const texts = [...new Set(shown.map((k) => k.v))];
      el.children = texts.map((value, i) => {
        const keys = runs(shown.map((k) => ({ ...k, v: k.v === value ? "inline" : "none" })));
        const span = node("tspan", { display: i === 0 ? undefined : "none" }, [value]);
        if (keys.length > 1) span.children.push(animate("display", keys, undefined, true));
        return span;
      });
      continue;
    }
    if (prop.startsWith("@") && TRANSFORMS.has(name.toLowerCase())) {
      if (followers.has(id) && name === "transform") continue;
      let keys = keyframes(id, prop, list);
      if (keys.length < 2) continue;
      const lists = keys.map((k) => transformList(k.v));
      const shape = (l: [string, number[]][]) => l.map(([f, args]) => `${f}${args.length}`).join(" ");
      if (lists.every((l) => shape(l) === shape(lists[0]!)) && !/matrix|skewY/.test(shape(lists[0]!))) {
        // The same functions throughout: each animated on its own, added up in order.
        lists[0]!.forEach(([type], j) =>
          add(el, node("animateTransform", {
            attributeName: name,
            type,
            additive: j ? "sum" : undefined,
            values: lists.map((l) => l[j]![1].map(num).join(" ")).join(";"),
            ...timing(keys, loop, repeat),
          })),
        );
      } else {
        // Anything else as translate · rotate · skewX · scale, sampled, with the angle kept continuous.
        keys = keyframes(id, prop, list, true);
        const parts = keys.map((k) => decompose(transformMatrix(k.v)));
        parts.forEach((p, i) => {
          const before = parts[i - 1];
          if (before) p[2] += 360 * Math.round((before[2] - p[2]) / 360);
        });
        const types: [string, (p: number[]) => number[]][] = [
          ["translate", (p) => [p[0]!, p[1]!]],
          ["rotate", (p) => [p[2]!]],
          ["skewX", (p) => [p[3]!]],
          ["scale", (p) => [p[4]!, p[5]!]],
        ];
        types.forEach(([type, pick], j) =>
          add(el, node("animateTransform", {
            attributeName: name,
            type,
            additive: j ? "sum" : undefined,
            values: parts.map((p) => pick(p).map(num).join(" ")).join(";"),
            ...timing(keys, loop, repeat),
          })),
        );
      }
      continue;
    }
    if (prop === "along") {
      const paths = new Set(list.map((c) => c.anim.along!));
      const pathEl = byId.get([...paths][0]!);
      const d = pathEl && outline(pathEl);
      if (!d) continue;
      const point = (at: string) => pathPointAt(d, Number(at));
      const first = point(read(frameAt(0), id, prop) ?? "0");
      if (first) setAttr(el, "transform", `translate(${num(first[0])} ${num(first[1])})`);
      if (paths.size === 1 && pathEl.tag.toLowerCase() === "path") {
        // The browser follows the path itself: the markup's place (for no SMIL) set aside while it does.
        const keys = keyframes(id, prop, list);
        add(
          el,
          node("animateTransform", { attributeName: "transform", type: "translate", values: "0 0", ...clock(loop, repeat) }),
          node("animateMotion", { keyPoints: keys.map((k) => k.v).join(";"), ...timing(keys, loop, repeat) }, [
            node("mpath", { href: `#${[...paths][0]}` }),
          ]),
        );
      } else {
        // Along several paths, or a shape SMIL cannot follow: its points, sampled.
        const keys = sampleTimes(list).map((t): Key => {
          const f = frameAt(t).get(id)?.along;
          const p = f && byId.get(f.path) && pathPointAt(outline(byId.get(f.path)!) ?? "", f.at);
          return { t, v: p ? `${num(p[0])} ${num(p[1])}` : "0 0", shape: "linear" };
        });
        keys.push({ t: loop, v: keys[keys.length - 1]!.v, shape: "linear" });
        const ks = collapse(keys);
        add(el, node("animateTransform", { attributeName: "transform", type: "translate", values: ks.map((k) => k.v).join(";"), ...timing(ks, loop, repeat) }));
      }
      continue;
    }
    const keys = keyframes(id, prop, list);
    if (keys.length < 2) continue;
    if (prop === "solo") {
      const shown = runs(keys);
      let i = 0;
      for (const child of el.children) {
        if (typeof child === "string") continue;
        const index = String(i++);
        const toggles = runs(shown.map((k) => ({ ...k, v: k.v === index ? "inline" : "none" })));
        if (toggles.length > 1) add(child, animate("display", toggles, undefined, true));
      }
    } else if (prop === "view") {
      viewKeys = keys;
      add(svg, animate("viewBox", keys));
    } else add(el, animate(prop === "draw" ? "stroke-dashoffset" : name, keys));
  }

  if (viewKeys && whole) {
    // As the view zooms, `data-nonscaling` elements keep their size and `data-fixed` ones their place.
    const boxes = viewKeys.map((k) => k.v.split(" ").map(Number));
    const all: SvgNode[] = [];
    const walk = (n: SvgNode) => {
      all.push(n);
      for (const c of n.children) if (typeof c !== "string") walk(c);
    };
    walk(svg);
    const zooms = boxes.map((b) => num(b[2]! / whole[2]));
    for (const el of all.filter((n) => getAttr(n, "data-nonscaling") !== undefined)) {
      setAttr(el, "transform", zooms[0] === "1" ? undefined : `scale(${zooms[0]})`);
      add(el, node("animateTransform", { attributeName: "transform", type: "scale", values: zooms.join(";"), ...timing(viewKeys, loop, repeat) }));
    }
    const fixed = all.filter((n) => getAttr(n, "data-fixed") !== undefined);
    const top = fixed.filter((n) => !fixed.some((f) => f !== n && contains(f, n)));
    if (top.length) {
      for (const el of top) for (const n of all) n.children = n.children.filter((c) => c !== el);
      // A layer that maps the whole picture onto the view as it moves (as a nested <svg> with the
      // whole viewBox would, but with transforms, which images animate where they do not re-lay out one).
      const fit = boxes.map(([x, y, w, h]) => {
        const k = Math.min(w! / whole[2], h! / whole[3]);
        return { at: `${num(x! + (w! - whole[2] * k) / 2 - whole[0] * k)} ${num(y! + (h! - whole[3] * k) / 2 - whole[1] * k)}`, k: num(k) };
      });
      const layer = node("g", { transform: `translate(${fit[0]!.at}) scale(${fit[0]!.k})` }, top);
      add(
        layer,
        node("animateTransform", { attributeName: "transform", type: "translate", values: fit.map((f) => f.at).join(";"), ...timing(viewKeys, loop, repeat) }),
        node("animateTransform", { attributeName: "transform", type: "scale", additive: "sum", values: fit.map((f) => f.k).join(";"), ...timing(viewKeys, loop, repeat) }),
      );
      svg.children.push(layer);
    }
  }

  for (const [el, anims] of added) el.children.push(...anims);
  scopeIds(svg, options.idSuffix ?? hash(motion.svg + JSON.stringify(animations)));
  setAttr(svg, "width", "100%");
  setAttr(svg, "height", "100%");
  setAttr(svg, "xmlns", "http://www.w3.org/2000/svg");
  const markup = serialize(svg);
  // Read as XML (an image, a file), `xlink:` attributes need their namespace declared.
  return /\sxlink:/.test(markup) && !/\sxmlns:xlink=/.test(markup)
    ? markup.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    : markup;
}

const contains = (outer: SvgNode, inner: SvgNode): boolean =>
  outer.children.some((c) => c === inner || (typeof c !== "string" && contains(c, inner)));

/**
 * Gives the ids the picture refers to (by `url(#…)` or `href="#…"`) `-suffix`,
 * and points the references at them, as a live player does.
 */
function scopeIds(svg: SvgNode, suffix: string) {
  if (!suffix) return;
  const all: SvgNode[] = [];
  const walk = (n: SvgNode) => {
    all.push(n);
    for (const c of n.children) if (typeof c !== "string") walk(c);
  };
  walk(svg);
  const referred = new Set<string>();
  for (const n of all) {
    const css = n.tag.toLowerCase() === "style" ? n.children.filter((c): c is string => typeof c === "string") : [];
    for (const [name, value] of [...n.attrs, ...css.map((c) => ["", c] as const)]) {
      if (/^(xlink:)?href$/i.test(name) && value.startsWith("#")) referred.add(value.slice(1));
      for (const m of value.matchAll(URL_REF)) referred.add(m[2]!);
    }
  }
  const ids = new Map<string, string>();
  for (const n of all) {
    const id = getAttr(n, "id");
    if (id && referred.has(id) && !ids.has(id)) ids.set(id, `${id}-${suffix}`);
  }
  if (!ids.size) return;
  const scoped = (value: string) =>
    value.replace(URL_REF, (whole, quote: string, id: string) => (ids.has(id) ? `url(${quote}#${ids.get(id)}${quote})` : whole));
  for (const n of all) {
    for (const attr of n.attrs) {
      if (attr[0] === "id") attr[1] = ids.get(attr[1]) ?? attr[1];
      else if (/^(xlink:)?href$/i.test(attr[0])) attr[1] = attr[1].startsWith("#") && ids.has(attr[1].slice(1)) ? `#${ids.get(attr[1].slice(1))}` : attr[1];
      else attr[1] = scoped(attr[1]);
    }
    if (n.tag.toLowerCase() === "style") n.children = n.children.map((c) => (typeof c === "string" ? scoped(c) : c));
  }
}
