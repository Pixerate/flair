/**
 * Drawing animated SVG pictures (see `SvgMotion`) in the DOM: a sanitising
 * parser, a view that applies frames, and a player that runs on a `Clock`.
 */

import { realClock, type Clock } from "../time/clock.js";
import { SVG_PICTURE, svgFrame, svgOpeningTag, type SvgBox, type SvgMotion } from "./motion.js";

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
    for (const [name, value] of Object.entries(frame.attrs)) el.setAttribute(name, value);
    if (frame.draw !== undefined) {
      // A path length of 1 lets the dash be a fraction, with nothing measured.
      el.setAttribute("pathLength", "1");
      el.setAttribute("stroke-dasharray", "1 1");
      el.setAttribute("stroke-dashoffset", String(1 - frame.draw));
    }
    if (frame.text !== undefined) el.textContent = frame.text;
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
  /** Called with the id of the innermost element with an id that is clicked. */
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
        if (el.id && el.localName !== "svg") return onPick(el.id);
    });
  let svg: SVGSVGElement | undefined | null = null;
  let fixed: SVGSVGElement | undefined;
  let nonscaling: Element[] = [];
  let whole: SvgBox = [0, 0, 100, 100];
  const byId = new Map<string, Element>();
  return {
    element,
    draw(timeMs, steps = []) {
      if (svg === null) {
        // Parsed on first use, so a view made and dropped costs nothing.
        svg = parseSvg(motion.svg);
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          element.appendChild(svg);
          fixed = fixedLayer(svg);
          if (fixed) {
            element.style.position = "relative";
            element.appendChild(fixed);
          }
          for (const layer of [svg, fixed])
            for (const el of layer?.querySelectorAll("[id]") ?? []) byId.set(el.id, el);
          nonscaling = [...svg.querySelectorAll("[data-nonscaling]")];
          const box = (svg.getAttribute("viewBox") ?? "")
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          if (box.length === 4 && box.every(Number.isFinite)) whole = box as unknown as SvgBox;
        }
      }
      if (svg) {
        apply(svg, whole, byId, motion, timeMs, steps);
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
  /** Start again at the end (default `true`). */
  loop?: boolean;
  /** Loop length in ms (default: the picture's own, see {@link svgDuration}, plus `hold`). */
  duration?: number;
  /** Ms to rest on the last frame before looping (default 600). */
  hold?: number;
  /** Playback speed (default 1). */
  speed?: number;
  /** Step start times in ms, for pictures that change on steps (default none). */
  steps?: readonly number[];
}

/**
 * Plays an {@link SvgMotion} inside `container`: loops by default, and can be
 * paused, sought and sped up. Dispose it to stop and remove the picture.
 */
export class SvgPlayer {
  readonly view: SvgView;
  private readonly clock: Clock;
  private readonly steps: readonly number[];
  private readonly loop: boolean;
  private readonly length: number;
  private speed: number;
  private time = 0;
  private last = 0;
  private playing = false;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    motion: SvgMotion,
    options: SvgPlayerOptions = {},
  ) {
    this.clock = options.clock ?? realClock;
    this.steps = options.steps ?? [];
    this.loop = options.loop ?? true;
    this.speed = options.speed ?? 1;
    this.length = options.duration ?? svgDuration(motion, this.steps) + (options.hold ?? 600);
    this.view = svgView(motion, options);
    container.appendChild(this.view.element);
    this.view.draw(0, this.steps);
    if (options.autoplay ?? true) this.play();
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
    this.last = this.clock.now();
    void this.run();
  }

  pause(): void {
    this.playing = false;
  }

  /** Shows the picture at `ms` (wrapped into the loop when looping). */
  seek(ms: number): void {
    this.time = this.loop
      ? ((ms % this.length) + this.length) % this.length
      : Math.min(Math.max(ms, 0), this.length);
    this.view.draw(this.time, this.steps);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  dispose(): void {
    this.disposed = true;
    this.playing = false;
    this.view.element.remove();
  }

  private async run(): Promise<void> {
    while (this.playing && !this.disposed) {
      await this.clock.frame();
      if (!this.playing || this.disposed) return;
      const now = this.clock.now();
      const next = this.time + (now - this.last) * this.speed;
      this.last = now;
      if (!this.loop && next >= this.length) {
        this.seek(this.length);
        this.playing = false;
        return;
      }
      this.seek(next);
    }
  }
}
