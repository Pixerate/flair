/**
 * Drawing animated SVG pictures (see `SvgMotion`) in the DOM: a sanitising
 * parser, a view that applies frames, and a player that runs on a `Clock`.
 */

import { realClock, type Clock } from "../time/clock.js";
import {
  easeFunction,
  formatCount,
  STEP_MS,
  SVG_PICTURE,
  svgFrame,
  svgOpeningTag,
  type SvgEase,
  type SvgBox,
  type SvgMotion,
} from "./motion.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The `<svg>` in `markup`, parsed and made safe to show: no scripts, event
 * handlers, `<foreignObject>` or links outside itself. Undefined when it is
 * not an SVG.
 */
export function parseSvg(markup: string): SVGSVGElement | undefined {
  // Parsed as XML, an <svg> without its namespace is not an SVG at all.
  let source = markup.trim();
  const open = svgOpeningTag(source);
  if (!/\sxmlns\s*=/i.test(open)) source = source.replace(/^<svg/i, `<svg xmlns="${SVG_NS}"`);
  if (/xlink:/.test(source) && !/\sxmlns:xlink\s*=/i.test(open))
    source = source.replace(/^<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.namespaceURI !== SVG_NS || svg.localName !== "svg" || doc.querySelector("parsererror"))
    return undefined;
  for (const bad of svg.querySelectorAll("script, foreignObject")) bad.remove();
  for (const el of [svg, ...svg.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const link = name === "href" || name === "xlink:href" || name === "src";
      if (name.startsWith("on") || (link && !/^(#|data:image\/)/i.test(attr.value.trim())))
        el.removeAttribute(attr.name);
    }
  }
  return document.importNode(svg, true) as unknown as SVGSVGElement;
}

/** Live views made so far, for ids unique on the page (see {@link scopeIds}). */
let views = 0;

const URL_REF = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;

/**
 * Gives the ids a live picture refers to (by `url(#…)` in attributes and
 * styles, or `href="#…"`: its gradients, filters, clips, masks, `<use>`d
 * shapes) `suffix`, and points the references at the new ids, so two
 * pictures on one page that both define `id="glow"` each use their own.
 * Other ids stay as written. The original id is kept in `data-flair-id`;
 * returns how ids map.
 */
function scopeIds(svg: Element, suffix: string): Map<string, string> {
  const all = [svg, ...svg.querySelectorAll("*")];
  const referred = new Set<string>();
  for (const el of all) {
    const texts = [...el.attributes].map((a) => [a.name.toLowerCase(), a.value] as const);
    if (el.localName === "style") texts.push(["", el.textContent ?? ""]);
    for (const [name, value] of texts) {
      if ((name === "href" || name === "xlink:href") && value.startsWith("#")) referred.add(value.slice(1));
      for (const m of value.matchAll(URL_REF)) referred.add(m[2]!);
    }
  }
  const ids = new Map<string, string>();
  for (const el of all) {
    if (!el.id || !referred.has(el.id) || ids.has(el.id)) continue;
    ids.set(el.id, `${el.id}-${suffix}`);
    el.setAttribute("data-flair-id", el.id);
    el.id = `${el.id}-${suffix}`;
  }
  if (ids.size)
    for (const el of [svg, ...svg.querySelectorAll("*")]) {
      for (const attr of [...el.attributes]) {
        const scoped = scopedRefs(attr.value, ids, attr.name);
        if (scoped !== attr.value) attr.value = scoped;
      }
      if (el.localName === "style" && el.textContent) el.textContent = scopedRefs(el.textContent, ids);
    }
  return ids;
}

/** `value` with its references to ids in `ids` pointed at their scoped ids. */
function scopedRefs(value: string, ids: ReadonlyMap<string, string>, attr = ""): string {
  const name = attr.toLowerCase();
  if (name === "href" || name === "xlink:href") {
    const to = value.startsWith("#") ? ids.get(value.slice(1)) : undefined;
    return to ? `#${to}` : value;
  }
  if (!value.includes("url(")) return value;
  return value.replace(URL_REF, (whole, quote: string, id: string) => {
    const to = ids.get(id);
    return to ? `url(${quote}#${to}${quote})` : whole;
  });
}

/** Share of an element's size left round it when a `view` frames it. */
const VIEW_MARGIN = 0.12;

/**
 * The box a `view` frames, in viewBox units: a box as given, an element's
 * box with a margin, widened to the picture's shape so the zoom does not
 * skew, or the whole picture for `null`.
 */
function viewBox(view: SvgBox | string | null, whole: SvgBox, byId: Map<string, Element>): SvgBox {
  if (view === null) return whole;
  if (typeof view !== "string") return view;
  const el = byId.get(view) as SVGGraphicsElement | undefined;
  let box: DOMRect | undefined;
  try {
    box = el?.getBBox?.();
  } catch {
    // Not laid out (or not drawable): keep the whole picture.
  }
  if (!box || !(box.width > 0 || box.height > 0)) return whole;
  // In the picture's own units: through the element's transforms (a point
  // placed with one), which its box leaves out.
  try {
    const svg = el!.ownerSVGElement;
    const m = svg?.getScreenCTM()?.inverse().multiply(el!.getScreenCTM()!);
    if (m) {
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x, box.y + box.height],
        [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
      const xs = corners.map((p) => p.x);
      const ys = corners.map((p) => p.y);
      box = new DOMRect(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
    }
  } catch {
    // Not laid out: keep its own box.
  }
  const aspect = whole[2] / whole[3];
  let w = box.width * (1 + 2 * VIEW_MARGIN);
  let h = box.height * (1 + 2 * VIEW_MARGIN);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [box.x + box.width / 2 - w / 2, box.y + box.height / 2 - h / 2, w, h];
}

/**
 * Keeps the picture's `data-nonscaling` elements (a map's pins and labels)
 * the same size on screen as a `view` zooms: each is scaled round its own
 * origin by how far the picture is zoomed (so draw it round (0, 0) inside a
 * group that places it).
 */
function keepSize(svg: SVGSVGElement, whole: SvgBox, nonscaling: Element[]) {
  if (!nonscaling.length) return;
  const width = Number((svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/)[2]);
  const zoom = width > 0 ? width / whole[2] : 1;
  const transform = Math.abs(zoom - 1) < 1e-4 ? "" : `scale(${+zoom.toFixed(4)})`;
  for (const el of nonscaling)
    if ((el.getAttribute("transform") ?? "") !== transform)
      if (transform) el.setAttribute("transform", transform);
      else el.removeAttribute("transform");
}

/** Applies a frame of the media's animations to `svg`. */
function apply(
  svg: SVGSVGElement,
  whole: SvgBox,
  byId: Map<string, Element>,
  motion: SvgMotion,
  timeMs: number,
  steps: readonly number[],
  ids: ReadonlyMap<string, string> = new Map(),
) {
  for (const [id, frame] of svgFrame(motion.animate ?? [], steps, timeMs)) {
    if (id === SVG_PICTURE && frame.view) {
      const a = viewBox(frame.view.from, whole, byId);
      const b = viewBox(frame.view.to, whole, byId);
      const u = frame.view.u;
      svg.setAttribute("viewBox", a.map((n, i) => +(n + (b[i]! - n) * u).toFixed(2)).join(" "));
      continue;
    }
    const el = byId.get(id);
    if (!el) continue;
    for (const [name, value] of Object.entries(frame.attrs)) el.setAttribute(name, scopedRefs(value, ids, name));
    if (frame.draw !== undefined) {
      // A path length of 1 lets the dash be a fraction, with nothing measured.
      el.setAttribute("pathLength", "1");
      el.setAttribute("stroke-dasharray", "1 1");
      el.setAttribute("stroke-dashoffset", String(1 - frame.draw));
    }
    if (frame.text !== undefined) el.textContent = frame.text;
    if (frame.solo !== undefined) {
      const children = Array.from(el.children);
      children.forEach((child, idx) => {
        if (child instanceof SVGElement || child instanceof HTMLElement) {
          if (idx === frame.solo) {
            child.removeAttribute("display");
          } else {
            child.setAttribute("display", "none");
          }
        }
      });
    }
    if (frame.along) {
      const path = byId.get(frame.along.path) as SVGGeometryElement | undefined;
      try {
        const length = path?.getTotalLength?.();
        if (path && length !== undefined) {
          const p = path.getPointAtLength(frame.along.at * length);
          el.setAttribute("transform", `translate(${+p.x.toFixed(2)} ${+p.y.toFixed(2)})`);
        }
      } catch {
        // Not laid out: leave it where it is.
      }
    }
  }
}

const VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g;

/**
 * `copy` with the CSS variables in its attributes and styles replaced by
 * their values on `live` (its original, in the page), or their fallbacks:
 * an image of the SVG is drawn on its own, where the page's variables (a
 * host's palette) mean nothing.
 */
function resolveVariables(live: SVGSVGElement, copy: SVGSVGElement) {
  const originals = [live, ...live.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  copies.forEach((el, i) => {
    let style: CSSStyleDeclaration | undefined;
    for (const attr of [...el.attributes]) {
      if (!attr.value.includes("var(")) continue;
      style ??= getComputedStyle(originals[i] ?? live);
      el.setAttribute(
        attr.name,
        attr.value.replace(
          VAR,
          (_, name: string, fallback?: string) =>
            style!.getPropertyValue(name).trim() || fallback?.trim() || "",
        ),
      );
    }
  });
}

/** An image of the picture as drawn now (its layers in order), at `pixels`. */
async function rasterize(layers: SVGSVGElement[], pixels: { width: number; height: number }): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const defs = layers[0]?.querySelector("defs");
  for (const [i, svg] of layers.entries()) {
    const copy = svg.cloneNode(true) as SVGSVGElement;
    resolveVariables(svg, copy);
    // A fixed layer's gradients and markers live in the picture's <defs>.
    if (i > 0 && defs) copy.prepend(defs.cloneNode(true));
    copy.setAttribute("xmlns", SVG_NS);
    copy.setAttribute("width", String(pixels.width));
    copy.setAttribute("height", String(pixels.height));
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }),
    );
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      canvas.getContext("2d")!.drawImage(image, 0, 0, pixels.width, pixels.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return canvas;
}

/**
 * Moves the picture's `data-fixed` elements (titles, legends, notes) into a
 * layer over it that keeps the original `viewBox`, so a `view` zooms the
 * picture under them while they stay put. Undefined when it has none.
 */
function fixedLayer(svg: SVGSVGElement): SVGSVGElement | undefined {
  const fixed = [...svg.querySelectorAll("[data-fixed]")].filter(
    (el) => !el.parentElement?.closest("[data-fixed]"),
  );
  if (!fixed.length) return undefined;
  // The picture's own attributes (viewBox, fonts, fills) without its id.
  const layer = svg.cloneNode(false) as SVGSVGElement;
  layer.removeAttribute("id");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:absolute;inset:0;overflow:visible";
  for (const el of fixed) layer.appendChild(el);
  return layer;
}

export interface SvgViewOptions {
  /**
   * Called with the id of the innermost element with an id that is clicked:
   * its id in the motion's markup (in the page, ids carry a suffix that keeps
   * them unique, so several pictures can use the same ones).
   */
  onPick?: (id: string) => void;
}

/** An {@link SvgMotion} drawn into an element; call `draw` with a time to show it then. */
export interface SvgView {
  /** A `div` filled by the picture; put it anywhere. */
  readonly element: HTMLDivElement;
  /** Shows the picture at `timeMs`, with steps starting at `steps` (ms). */
  draw(timeMs: number, steps?: readonly number[]): void;
  /** An image of the picture as drawn now. */
  capture(pixels: { width: number; height: number }): Promise<HTMLCanvasElement | undefined>;
}

/** Shows an {@link SvgMotion} as a live view; with `onPick`, clicks report the id of the element clicked. */
export function svgView(motion: SvgMotion, options: SvgViewOptions = {}): SvgView {
  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";
  const { onPick } = options;
  if (onPick)
    element.addEventListener("click", (event) => {
      // The innermost element with an id, up to the picture itself.
      for (let el = event.target as Element | null; el && el !== element; el = el.parentElement)
        if (el.id && el.localName !== "svg") return onPick(el.getAttribute("data-flair-id") ?? el.id);
    });
  let svg: SVGSVGElement | undefined | null = null;
  let fixed: SVGSVGElement | undefined;
  let nonscaling: Element[] = [];
  let whole: SvgBox = [0, 0, 100, 100];
  const byId = new Map<string, Element>();
  let ids: ReadonlyMap<string, string> = new Map();
  const suffix = `f${++views}`;
  return {
    element,
    draw(timeMs, steps = []) {
      if (svg === null) {
        // Parsed on first use, so a view made and dropped costs nothing.
        svg = parseSvg(motion.svg);
        if (svg) {
          ids = scopeIds(svg, suffix);
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          element.appendChild(svg);
          fixed = fixedLayer(svg);
          if (fixed) {
            element.style.position = "relative";
            element.appendChild(fixed);
          }
          for (const layer of [svg, fixed])
            for (const el of layer?.querySelectorAll("[id]") ?? [])
              byId.set(el.getAttribute("data-flair-id") ?? el.id, el);
          nonscaling = [...svg.querySelectorAll("[data-nonscaling]")];
          const box = (svg.getAttribute("viewBox") ?? "")
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          if (box.length === 4 && box.every(Number.isFinite)) whole = box as unknown as SvgBox;
        }
      }
      if (svg) {
        apply(svg, whole, byId, motion, timeMs, steps, ids);
        keepSize(svg, whole, nonscaling);
      }
    },
    capture: async (pixels) => (svg ? rasterize(fixed ? [svg, fixed] : [svg], pixels) : undefined),
  };
}

/** How long an {@link SvgMotion} runs: its last change's end, in ms (at least 1). */
export function svgDuration(motion: SvgMotion, steps: readonly number[] = []): number {
  let end = 0;
  for (const a of motion.animate ?? []) {
    const step = a.step ?? 0;
    const start = step <= 0 ? 0 : steps[step - 1];
    if (start === undefined) continue;
    end = Math.max(end, start + (a.delay ?? 0) + (a.ms ?? 800));
  }
  return Math.max(1, end);
}

export interface SvgPlayerOptions extends SvgViewOptions {
  /** Time source (default: animation frames). Pass a `ManualClock` to step frames yourself. */
  clock?: Clock;
  /** Start playing at once (default `true`). */
  autoplay?: boolean;
  /**
   * Start again at the end (default `true`). When `false` it plays once and
   * stays on the last frame (hidden instead with `hideWhenPaused`).
   */
  loop?: boolean;
  /** Loop length in ms (default: the picture's own, see {@link svgDuration}, plus `hold`). */
  duration?: number;
  /** Ms to rest on the last frame before looping (default 600). */
  hold?: number;
  /** Playback speed (default 1). */
  speed?: number;
  /** Step start times in ms, for pictures that change on steps (default none). */
  steps?: readonly number[];
  /** Pause the animation loop when scrolled out of view via IntersectionObserver (default false). */
  pauseWhenHidden?: boolean;
  /** Wait to start playing until the element enters the viewport via IntersectionObserver (default false). When true, autoplay is deferred until first visible. */
  playOnEnter?: boolean;
  /** Hide the view (`visibility: hidden`) whenever playback is paused or reset (default false). */
  hideWhenPaused?: boolean;
  /**
   * Plays in answer to the pointer or the page instead of on its own (see
   * {@link SvgTrigger}): `"hover"` and `"press"` play to the end while
   * hovered or held and back to the start after; `"click"` plays the next
   * step on each click, starting over after the last; `"scroll"` follows
   * the trigger target's progress through the viewport (see `scrollRange`),
   * scrubbing back and forth as the page scrolls. `autoplay`, `loop` and
   * `steps` are ignored.
   */
  trigger?: SvgTrigger;
  /** The element whose pointer events trigger it, or whose scrolling a scroll trigger follows (default the container). */
  triggerTarget?: HTMLElement;
  /**
   * For a scroll trigger: the stretch of the target's progress through the
   * viewport (0 as its top comes in at the bottom, 1 as its bottom leaves at
   * the top) over which the picture plays from start to end (default
   * `[0.1, 0.6]`: from just after it comes into view to a little past the
   * middle).
   */
  scrollRange?: readonly [number, number];
}

/** What makes a triggered {@link SvgPlayer} play. */
export type SvgTrigger = "hover" | "press" | "click" | "scroll";

/** The stretch of the viewport a scroll-triggered picture plays over (see `SvgPlayerOptions.scrollRange`). */
export const SCROLL_RANGE: readonly [number, number] = [0.1, 0.6];

/**
 * Plays an {@link SvgMotion} inside `container`: loops by default, and can be
 * paused, sought and sped up. Dispose it to stop and remove the picture.
 */
export class SvgPlayer {
  readonly view: SvgView;
  private readonly clock: Clock;
  private steps: readonly number[];
  private readonly loop: boolean;
  private length: number;
  private readonly motion: SvgMotion;
  private readonly trigger?: SvgTrigger;
  private readonly triggerTarget?: HTMLElement;
  /** With a hover or press trigger: 1 playing to the end, -1 back to the start. */
  private direction = 1;
  /** With a click trigger: when each click came, in ms of playback. */
  private clicks: number[] = [];
  private readonly hideWhenPaused: boolean;
  private speed: number;
  private time = 0;
  private last = 0;
  private playing = false;
  private disposed = false;
  private wasPlayingBeforeHidden = false;
  private hasEnteredViewport = false;
  private intersectionObserver?: IntersectionObserver;
  private readonly scrollRange: readonly [number, number];
  /** A scroll trigger's pending update (one per frame). */
  private scrollFrame = 0;
  private followingScroll = false;

  constructor(
    private readonly container: HTMLElement,
    motion: SvgMotion,
    options: SvgPlayerOptions = {},
  ) {
    this.clock = options.clock ?? realClock;
    this.motion = motion;
    this.trigger = options.trigger;
    this.steps = this.trigger ? [] : (options.steps ?? []);
    this.loop = this.trigger ? false : (options.loop ?? true);
    this.speed = options.speed ?? 1;
    this.hideWhenPaused = Boolean(options.hideWhenPaused);
    this.scrollRange = options.scrollRange ?? SCROLL_RANGE;
    this.length = options.duration ?? svgDuration(motion, this.steps) + (options.hold ?? 600);
    this.view = svgView(motion, options);
    container.appendChild(this.view.element);
    this.view.draw(0, this.steps);

    const needsObserver =
      (options.pauseWhenHidden || options.playOnEnter) && typeof IntersectionObserver !== "undefined";

    if (needsObserver) {
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (options.playOnEnter && !this.hasEnteredViewport) {
            this.hasEnteredViewport = true;
            if (options.autoplay ?? true) {
              this.play();
            }
          } else if (this.wasPlayingBeforeHidden) {
            this.wasPlayingBeforeHidden = false;
            this.play();
          }
        } else {
          if (this.playing && options.pauseWhenHidden) {
            this.wasPlayingBeforeHidden = true;
            this.pause();
          }
        }
      });
      this.intersectionObserver.observe(this.view.element);
    }

    if (this.trigger === "scroll") {
      this.length = options.duration ?? svgDuration(motion);
      this.triggerTarget = options.triggerTarget ?? container;
      this.followingScroll = true;
      this.listen(true);
      this.followScroll();
      return;
    }

    if (this.trigger) {
      // A click-triggered picture runs until its latest step is over, however many clicks.
      // Hovers and presses run to the last change and back, with no rest to wait through.
      this.length = this.trigger === "click" ? Infinity : (options.duration ?? svgDuration(motion));
      this.triggerTarget = options.triggerTarget ?? container;
      this.listen(true);
      return;
    }

    // Without IntersectionObserver (a server, a test), nothing would say it entered: play at once.
    const shouldAutoplay = (options.autoplay ?? true) && !(options.playOnEnter && needsObserver);
    if (shouldAutoplay) {
      this.play();
    } else if (this.hideWhenPaused) {
      this.view.element.style.visibility = "hidden";
    }
  }

  /** The loop length in ms. */
  get duration(): number {
    return this.length;
  }

  /** The time shown, in ms. */
  get currentTime(): number {
    return this.time;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    if (this.playing || this.disposed) return;
    this.playing = true;
    if (this.hideWhenPaused) this.view.element.style.visibility = "visible";
    this.last = this.clock.now();
    void this.run();
  }

  pause(): void {
    this.playing = false;
    if (this.hideWhenPaused) this.view.element.style.visibility = "hidden";
  }

  /** Stops playback, rewinds to `0 ms`, and hides the view if `hideWhenPaused` is enabled. */
  reset(): void {
    this.playing = false;
    this.wasPlayingBeforeHidden = false;
    this.seek(0);
    if (this.hideWhenPaused) this.view.element.style.visibility = "hidden";
  }

  /** Shows the picture at `ms` (wrapped into the loop when looping). */
  seek(ms: number): void {
    this.time = this.loop
      ? ((ms % this.length) + this.length) % this.length
      : Math.min(Math.max(ms, 0), this.length);
    this.view.draw(this.time, this.steps);
  }

  /**
   * Shows the picture at `progress` of the way through it, 0–1: how hosts
   * scrub it themselves (a slider, a scroll position of their own). A scroll
   * trigger stops following the page once a host calls this.
   */
  setProgress(progress: number): void {
    if (this.followingScroll) {
      this.followingScroll = false;
      this.listen(false);
    }
    this.playing = false;
    this.seek(Math.min(1, Math.max(0, progress)) * (Number.isFinite(this.length) ? this.length : svgDuration(this.motion, this.steps)));
  }

  /**
   * A scroll trigger's playback position, 0–1, for the trigger target's
   * `progress` through the viewport (see {@link SvgPlayerOptions.scrollRange}).
   */
  scrollPosition(progress: number): number {
    const [from, to] = this.scrollRange;
    return to > from ? Math.min(1, Math.max(0, (progress - from) / (to - from))) : progress >= to ? 1 : 0;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * Plays to the end (`true`) or back to the start (`false`) from wherever it
   * is: what a hover or press trigger does, for hosts that drive it themselves
   * (a hovered card, a focused button).
   */
  setActive(active: boolean): void {
    this.direction = active ? 1 : -1;
    this.play();
  }

  /**
   * Plays the picture's next step (what a click trigger does): steps 1, 2, …
   * in turn, then step 1 again, so a picture whose last step leads back to
   * how it started toggles; one with no steps plays again from the start.
   */
  advance(): void {
    const last = Math.max(0, ...(this.motion.animate ?? []).map((a) => a.step ?? 0));
    if (last === 0) {
      this.clicks = [];
      this.time = 0;
    } else {
      this.clicks.push(this.time);
      // Only the clicks of the current round count, so each round starts from how the last ended.
      this.steps = this.clicks.slice(Math.floor((this.clicks.length - 1) / last) * last);
    }
    this.view.draw(this.time, this.steps);
    this.play();
  }

  dispose(): void {
    this.disposed = true;
    this.playing = false;
    if (this.trigger && (this.trigger !== "scroll" || this.followingScroll)) this.listen(false);
    if (this.scrollFrame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(this.scrollFrame);
    this.intersectionObserver?.disconnect();
    this.view.element.remove();
  }

  private onEnter = () => this.setActive(true);
  private onLeave = () => this.setActive(false);
  private onClick = () => this.advance();

  /** Seeks to where the trigger target is in the viewport. */
  private followScroll = () => {
    this.scrollFrame = 0;
    if (!this.followingScroll || this.disposed) return;
    const rect = this.triggerTarget!.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    const travel = viewport + rect.height;
    const progress = travel > 0 ? Math.min(1, Math.max(0, (viewport - rect.top) / travel)) : 0;
    this.seek(this.scrollPosition(progress) * this.length);
  };

  /** A scroll or resize: follow it on the next frame (or now, without frames). */
  private onScroll = () => {
    if (typeof requestAnimationFrame === "undefined") return this.followScroll();
    if (!this.scrollFrame) this.scrollFrame = requestAnimationFrame(this.followScroll);
  };

  private listen(on: boolean) {
    const target = this.triggerTarget!;
    const method = on ? "addEventListener" : "removeEventListener";
    if (this.trigger === "scroll") {
      // Any scroll that may move the target: the page's or a scrolling element's.
      window[method]("scroll", this.onScroll, { capture: true, passive: true } as AddEventListenerOptions);
      window[method]("resize", this.onScroll, { passive: true } as AddEventListenerOptions);
    } else if (this.trigger === "hover") {
      target[method]("pointerenter", this.onEnter);
      target[method]("pointerleave", this.onLeave);
    } else if (this.trigger === "press") {
      target[method]("pointerdown", this.onEnter);
      window[method]("pointerup", this.onLeave);
      window[method]("pointercancel", this.onLeave);
    } else target[method]("click", this.onClick);
  }

  private async run(): Promise<void> {
    while (this.playing && !this.disposed) {
      await this.clock.frame();
      if (!this.playing || this.disposed) return;
      const now = this.clock.now();
      const dt = (now - this.last) * this.speed;
      this.last = now;
      if (this.trigger === "click") {
        // Rest once the latest step is over, until the next click.
        const end = svgDuration(this.motion, this.steps);
        this.time = Math.min(this.time + dt, Math.max(end, this.time));
        this.view.draw(this.time, this.steps);
        if (this.time >= end) this.playing = false;
        continue;
      }
      if (this.trigger) {
        const next = Math.min(Math.max(this.time + dt * this.direction, 0), this.length);
        this.seek(next);
        if (next === 0 || next === this.length) this.playing = false;
        continue;
      }
      const next = this.time + dt;
      if (!this.loop && next >= this.length) {
        this.seek(this.length);
        this.playing = false;
        if (this.hideWhenPaused) this.view.element.style.visibility = "hidden";
        return;
      }
      this.seek(next);
    }
  }
}

export interface AnimateCountOptions {
  /** Starting number. */
  from: number;
  /** Ending number. */
  to: number;
  /** Duration in ms (default {@link STEP_MS}). */
  ms?: number;
  /** Delay before starting in ms (default 0). */
  delay?: number;
  /** Easing curve (default `"out"`), by name or as a `[x1, y1, x2, y2]` cubic-bezier. */
  ease?: SvgEase;
  /** Number of decimal places (default 0). */
  decimals?: number;
  /** Format template where `{n}` is replaced by the formatted number (default `"{n}"`). */
  format?: string;
  /** Time source (default: animation frames). */
  clock?: Clock;
  /** Called with each formatted text frame (and raw numeric value). */
  onUpdate: (text: string, value: number) => void;
}

/**
 * Counts a number from `from` to `to` over `ms` using Flair's easing curves
 * and `Clock`, calling `onUpdate` with the formatted string on each frame.
 * Returns a cancel function that stops the animation.
 */
export function animateCount(options: AnimateCountOptions): () => void {
  const clock = options.clock ?? realClock;
  const ms = options.ms ?? STEP_MS;
  const delay = options.delay ?? 0;
  const ease = easeFunction(options.ease, "out");
  const start = clock.now();
  let stopped = false;

  const emit = (u: number) => {
    const v = options.from + (options.to - options.from) * ease(u);
    options.onUpdate(formatCount(v, options), v);
  };

  emit(ms <= 0 && delay <= 0 ? 1 : 0);
  if (ms <= 0 && delay <= 0) return () => {};

  void (async () => {
    while (!stopped) {
      await clock.frame();
      if (stopped) return;
      const elapsed = clock.now() - start - delay;
      if (elapsed < 0) continue;
      if (ms <= 0 || elapsed >= ms) {
        emit(1);
        return;
      }
      emit(elapsed / ms);
    }
  })();

  return () => {
    stopped = true;
  };
}
