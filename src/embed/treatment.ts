/**
 * Text treatments on the web: an overlay above and behind a container's text
 * that draws a treatment's layer plan (`textTreatmentPlan`) with SVG, from
 * DOM `Range`s or line rectangles. It never changes the text.
 */

import type { ControlValue } from "../shader/controls.js";
import type { TextTreatmentEffect, TextTreatmentStage } from "../catalog/types.js";
import {
  checkStage,
  getTextTreatment,
  planResolvedStage,
  resolveTextTreatment,
  textTreatmentPlan,
  textTreatments,
  textTreatmentValues,
  type TextTreatmentPlan,
  type TextTreatmentTarget,
  type TreatmentCaret,
  type TreatmentPlanLayer,
  type TreatmentRect,
  type TreatmentRGBA,
} from "../catalog/treatment.js";
import { didYouMean } from "../motion/params.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// Where text is: DOM ranges as line rectangles.
// ---------------------------------------------------------------------------

/** Where `container`'s content box starts in the viewport, allowing for its border and scroll. */
function originOf(container: Element): { x: number; y: number } {
  const box = container.getBoundingClientRect();
  return { x: box.left + container.clientLeft - container.scrollLeft, y: box.top + container.clientTop - container.scrollTop };
}

/** Text nodes a range covers, each with the part of it inside the range. */
function textPieces(range: Range): { node: Text; start: number; end: number }[] {
  const out: { node: Text; start: number; end: number }[] = [];
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    out.push({ node: root as Text, start: range.startOffset, end: range.endOffset });
    return out;
  }
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) out.push({ node, start, end });
  }
  return out;
}

/**
 * The line rectangles of a DOM `Range` in `container`'s coordinates (the
 * overlay's), in reading order: one per line it covers, from the text it
 * holds (not the boxes of elements it spans), rectangles on the same line
 * merged.
 */
export function rangeRects(range: Range, container: Element): TreatmentRect[] {
  const origin = originOf(container);
  const doc = container.ownerDocument;
  const rects: TreatmentRect[] = [];
  for (const piece of textPieces(range)) {
    const sub = doc.createRange();
    sub.setStart(piece.node, piece.start);
    sub.setEnd(piece.node, piece.end);
    for (const r of Array.from(sub.getClientRects?.() ?? [])) {
      if (r.width > 0.5 && r.height > 0.5) rects.push({ x: r.left - origin.x, y: r.top - origin.y, width: r.width, height: r.height });
    }
  }
  // Merge rectangles that sit on the same line (their middles within each other).
  const lines: TreatmentRect[] = [];
  for (const r of rects) {
    const mid = r.y + r.height / 2;
    const line = lines.find((l) => mid > l.y && mid < l.y + l.height);
    if (!line) {
      lines.push({ ...r });
      continue;
    }
    const left = Math.min(line.x, r.x);
    const top = Math.min(line.y, r.y);
    line.width = Math.max(line.x + line.width, r.x + r.width) - left;
    line.height = Math.max(line.y + line.height, r.y + r.height) - top;
    line.x = left;
    line.y = top;
  }
  return lines;
}

/**
 * The insertion point at `offset` in a text node, in `container`'s
 * coordinates: the left edge of the character there, or the right edge of the
 * one before at the end of the text. Undefined when it has no layout.
 */
export function caretAt(node: Text, offset: number, container: Element): TreatmentCaret | undefined {
  const origin = originOf(container);
  const doc = container.ownerDocument;
  const range = doc.createRange();
  const at = Math.max(0, Math.min(offset, node.length));
  const after = at < node.length;
  if (!after && at === 0) return undefined;
  range.setStart(node, after ? at : at - 1);
  range.setEnd(node, after ? at + 1 : at);
  const r = Array.from(range.getClientRects?.() ?? []).find((x) => x.height > 0.5);
  if (!r) return undefined;
  return { x: (after ? r.left : r.right) - origin.x, y: r.top - origin.y, height: r.height };
}

// ---------------------------------------------------------------------------
// Drawing a plan with SVG.
// ---------------------------------------------------------------------------

const rgb = (c: TreatmentRGBA) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
const rgba = (c: TreatmentRGBA) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`;
const num = (v: number) => String(Math.round(v * 1000) / 1000);

function el<K extends keyof SVGElementTagNameMap>(doc: Document, name: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** The width of a tag's text: measured when the SVG is laid out, else estimated from its size. */
function textWidth(text: SVGTextElement, label: string, size: number): number {
  try {
    const w = text.getComputedTextLength?.();
    if (typeof w === "number" && w > 0) return w;
  } catch {
    // Not laid out (or no layout at all, as under jsdom).
  }
  return label.length * size * 0.58;
}

/** The SVG elements drawing one plan layer (into `svg`, with gradients in `defs`). */
function drawLayer(svg: SVGSVGElement, defs: SVGDefsElement, layer: TreatmentPlanLayer, id: () => string): void {
  const doc = svg.ownerDocument;
  const style: string[] = [];
  if (layer.blend !== "normal") style.push(`mix-blend-mode: ${layer.blend}`);
  if (layer.glow) style.push(`filter: drop-shadow(0 0 ${num(layer.glow)}px ${rgba(layer.color)})`);
  const common: Record<string, string> = { opacity: num(layer.opacity), "data-source": layer.source };
  if (style.length) common.style = style.join("; ");

  if (layer.kind === "path") {
    // One group, so the overlapping pieces composite before its opacity, glow and blend apply.
    const g = el(doc, "g", common);
    for (const seg of layer.segments ?? []) {
      g.appendChild(el(doc, "polygon", { points: seg.points.map(([x, y]) => `${num(x)},${num(y)}`).join(" "), fill: rgb(seg.color), "fill-opacity": num(seg.color[3]) }));
    }
    svg.appendChild(g);
    return;
  }
  if (layer.kind === "text") {
    const text = el(doc, "text", { ...common, x: num(layer.x), y: num(layer.y + layer.height / 2), "dominant-baseline": "central", fill: rgb(layer.color), "fill-opacity": num(layer.color[3]), "xml:space": "preserve" });
    text.style.whiteSpace = "pre";
    if (layer.font) text.style.font = layer.font;
    text.textContent = layer.text ?? "";
    svg.appendChild(text);
    return;
  }
  if (layer.kind === "tag") {
    const g = el(doc, "g", common);
    const size = layer.size ?? 11;
    const padX = layer.padX ?? size * 0.6;
    const pill = el(doc, "rect", { x: num(layer.x), y: num(layer.y), height: num(layer.height), rx: num(layer.radius), fill: rgb(layer.color), "fill-opacity": num(layer.color[3]) });
    const text = el(doc, "text", { x: num(layer.x + padX), y: num(layer.y + layer.height / 2), "dominant-baseline": "central", fill: rgb(layer.textColor ?? [1, 1, 1, 1]) });
    text.style.font = `600 ${num(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    text.style.whiteSpace = "pre";
    text.textContent = layer.text ?? "";
    g.append(pill, text);
    svg.appendChild(g);
    pill.setAttribute("width", num(textWidth(text, layer.text ?? "", size) + 2 * padX));
    return;
  }
  const attrs: Record<string, string> = { ...common, x: num(layer.x), y: num(layer.y), width: num(layer.width), height: num(layer.height) };
  if (layer.radius > 0) attrs.rx = num(layer.radius);
  if (layer.stroke) {
    // Inside the rectangle, as a Core Animation border is.
    const s = Math.min(layer.stroke, layer.width / 2, layer.height / 2);
    Object.assign(attrs, { x: num(layer.x + s / 2), y: num(layer.y + s / 2), width: num(layer.width - s), height: num(layer.height - s), fill: "none", stroke: rgb(layer.color), "stroke-opacity": num(layer.color[3]), "stroke-width": num(s) });
    if (layer.radius > 0) attrs.rx = num(Math.max(0, layer.radius - s / 2));
  } else if (layer.gradient) {
    const gid = id();
    const g = layer.gradient;
    const grad = el(doc, "linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: num(g.x0), y1: num(g.y0), x2: num(g.x1), y2: num(g.y1) });
    for (const stop of g.stops) grad.appendChild(el(doc, "stop", { offset: num(stop.offset), "stop-color": rgb(stop.color), "stop-opacity": num(stop.color[3]) }));
    defs.appendChild(grad);
    attrs.fill = `url(#${gid})`;
  } else {
    attrs.fill = rgb(layer.color);
    attrs["fill-opacity"] = num(layer.color[3]);
  }
  svg.appendChild(el(doc, "rect", attrs));
}

let overlays = 0;

/**
 * Draws plans into a pair of SVGs (layers marked `behind` into `behind`, the
 * rest into `above`), replacing what they drew before. Plans are drawn in
 * order, each back to front.
 */
export function drawTextTreatmentPlans(svgs: { behind: SVGSVGElement; above: SVGSVGElement }, plans: readonly TextTreatmentPlan[], idPrefix = `flair-tt${++overlays}`): void {
  let next = 0;
  const id = () => `${idPrefix}-g${next++}`;
  for (const [z, svg] of [["behind", svgs.behind], ["above", svgs.above]] as const) {
    svg.replaceChildren();
    const defs = el(svg.ownerDocument, "defs", {});
    svg.appendChild(defs);
    for (const plan of plans) for (const layer of plan.layers) if (layer.z === z) drawLayer(svg, defs, layer, id);
  }
}

// ---------------------------------------------------------------------------
// The overlay.
// ---------------------------------------------------------------------------

export interface TextTreatmentOverlayOptions {
  /** A preset by name, then these values, over the treatment's defaults. */
  preset?: string;
  values?: Record<string, ControlValue>;
  /**
   * `"user"` (default) draws stages without motion (held and faded) when the
   * visitor prefers reduced motion; `"always"` always does; `"never"` never.
   */
  reducedMotion?: "user" | "always" | "never";
  /**
   * Ms now, for stage times (default `performance.now`). A host that draws
   * frames itself passes its own clock and calls `render()`.
   */
  clock?: () => number;
  /** Redraw every animation frame while a stage plays (default true; false: call `render()`). */
  autoplay?: boolean;
}

/** What a stage plays over: a target, or a function giving the current one each frame (for a range that moves while it plays). */
export type TreatmentTargetSource = TextTreatmentTarget | (() => TextTreatmentTarget);

/** A stage playing in an overlay, from {@link TextTreatmentOverlay.play}. */
export interface TreatmentPlayback {
  readonly stage: TextTreatmentStage;
  /** Replaces what it plays over (the range moved, the caret advanced, more was typed). */
  update(target: TreatmentTargetSource): void;
  /** Stops it at once, removing what it drew. */
  stop(): void;
  /** Settles when it finishes (a looping stage, when stopped). */
  readonly finished: Promise<void>;
  /** Its last plan, once drawn. */
  readonly plan: TextTreatmentPlan | undefined;
}

/** A treatment's overlay on a container, from {@link mountTextTreatment}. */
export interface TextTreatmentOverlay {
  readonly effect: TextTreatmentEffect;
  /** The SVG under the text, and the one over it. */
  readonly behind: SVGSVGElement;
  readonly above: SVGSVGElement;
  /** Plays a stage over a target; several stages (and several agents' overlays) can play at once. Throws a sentence for an unknown stage or a bad target. */
  play(stage: TextTreatmentStage, target: TreatmentTargetSource, options?: { onDone?: () => void }): TreatmentPlayback;
  /** Changes control values (merged over the current ones); refuses bad ones with a sentence. */
  setValues(values: Record<string, ControlValue>): void;
  /** Switches to another treatment, keeping what plays (and the values you set that its controls share; the rest are its defaults). */
  setEffect(effect: TextTreatmentEffect | string): void;
  /** Whether stages started now play without motion. */
  readonly reduceMotion: boolean;
  /** Draws every playing stage at the clock's time (done for you each frame with `autoplay`). */
  render(): void;
  /** Stops every stage. */
  clear(): void;
  /** Stops everything and removes the overlay, putting the container's style back. */
  dispose(): void;
}

/** A catalog treatment by id or definition, or a thrown sentence listing them. */
export function treatmentOf(effect: TextTreatmentEffect | string): TextTreatmentEffect {
  if (typeof effect !== "string") {
    if (effect?.kind !== "text-treatment") throw new Error(`"${(effect as { id?: string })?.id}" is not a text treatment; the treatments are ${textTreatments.map((e) => e.id).join(", ")}.`);
    return effect;
  }
  const found = getTextTreatment(effect);
  if (!found) throw new Error(`There is no text treatment "${effect}".${didYouMean(effect, textTreatments.map((e) => e.id))} The treatments are ${textTreatments.map((e) => e.id).join(", ")}.`);
  return found;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Puts a text treatment's overlay on `container` (the element holding the
 * text): an SVG behind its text and one above it, both ignoring the pointer.
 * The container becomes a positioned stacking context (`position: relative`
 * if it was static, `isolation: isolate`) so the one behind stays over its
 * background; `dispose` puts that back. Play stages over line rectangles in
 * the container's coordinates (see {@link rangeRects} and {@link caretAt}).
 *
 * ```ts
 * const overlay = mountTextTreatment(editor, "soft-sweep", { values: { color: "#0a84ff" } });
 * const caret = overlay.play("caret", () => ({ caret: caretAt(node, offset, editor), label: "Claude" }));
 * await overlay.play("checking", { lines: rangeRects(sentence, editor) }).finished;
 * ```
 */
export function mountTextTreatment(container: HTMLElement, effect: TextTreatmentEffect | string, options: TextTreatmentOverlayOptions = {}): TextTreatmentOverlay {
  let def = treatmentOf(effect);
  const doc = container.ownerDocument;
  const view = doc.defaultView;
  const clock = options.clock ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const autoplay = options.autoplay ?? true;
  const checkValues = (d: TextTreatmentEffect, values: Record<string, ControlValue> | undefined, preset?: string) => {
    const checked = textTreatmentValues(d, { ...(preset !== undefined && { preset }), ...(values && { values }) });
    if (checked.issues.length) throw new Error(checked.issues.join(" "));
    return checked.values;
  };
  let values = checkValues(def, options.values, options.preset);
  // What the host set itself, which carries over to another treatment (its defaults do not).
  let given: Record<string, ControlValue> = { ...options.values };
  let resolved = resolveTextTreatment(def, values);

  const restore = { position: container.style.position, isolation: container.style.isolation };
  const computed = view?.getComputedStyle(container);
  if (!computed || computed.position === "static" || computed.position === "") container.style.position = "relative";
  container.style.isolation = "isolate";
  const svg = (z: number) => {
    const s = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("data-flair-treatment", def.id);
    Object.assign(s.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: String(z) });
    return s;
  };
  const behind = svg(-1);
  const above = svg(1);
  container.prepend(behind);
  container.append(above);
  const prefix = `flair-tt${++overlays}`;

  interface Playing {
    stage: TextTreatmentStage;
    start: number;
    target: TreatmentTargetSource;
    reduce: boolean;
    plan?: TextTreatmentPlan;
    done: () => void;
    onDone?: () => void;
  }
  const playing = new Set<Playing>();
  let frame = 0;
  let drawn = "";
  const reduceNow = () => options.reducedMotion === "always" || (options.reducedMotion !== "never" && prefersReducedMotion());

  const finish = (p: Playing) => {
    if (!playing.delete(p)) return;
    p.done();
    p.onDone?.();
  };
  const render = () => {
    const now = clock();
    const plans: TextTreatmentPlan[] = [];
    for (const p of [...playing]) {
      const target = typeof p.target === "function" ? p.target() : p.target;
      p.plan = planResolvedStage(resolved, p.stage, Math.max(0, now - p.start), target, p.reduce);
      if (p.plan.done) finish(p);
      else plans.push(p.plan);
    }
    // A steady caret (or a paused preview) draws the same layers frame after frame: only redraw on change.
    const key = JSON.stringify(plans.map((p) => p.layers));
    if (key === drawn) return;
    drawn = key;
    drawTextTreatmentPlans({ behind, above }, plans, prefix);
  };
  const tick = () => {
    frame = 0;
    render();
    schedule();
  };
  const schedule = () => {
    if (!autoplay || frame || playing.size === 0 || typeof requestAnimationFrame !== "function") return;
    frame = requestAnimationFrame(tick);
  };

  const overlay: TextTreatmentOverlay = {
    get effect() {
      return def;
    },
    behind,
    above,
    get reduceMotion() {
      return reduceNow();
    },
    play(stageName, target, playOptions = {}) {
      const stage = checkStage(stageName);
      // Checks the target (and stage) up front, so a bad one throws here rather than in a frame.
      const first = typeof target === "function" ? target() : target;
      const reduce = reduceNow();
      const length = textTreatmentPlan(def, { stage, time: 0, target: first, values, reduceMotion: reduce }).duration;
      let done!: () => void;
      const finished = new Promise<void>((resolve) => (done = resolve));
      const p: Playing = { stage, start: clock(), target, reduce, done, ...(playOptions.onDone && { onDone: playOptions.onDone }) };
      playing.add(p);
      schedule();
      // Animation frames stop in a background tab (and never come without a page); a timer at the stage's
      // end still finishes it, so `finished` settles and scripts waiting on it carry on.
      if (autoplay && !def.stages[stage].loop) {
        const check = () => {
          if (!playing.has(p)) return;
          render();
          if (playing.has(p)) setTimeout(check, 250);
        };
        setTimeout(check, length + 30);
      }
      return {
        stage,
        finished,
        get plan() {
          return p.plan;
        },
        update(next) {
          const t = typeof next === "function" ? next() : next;
          textTreatmentPlan(def, { stage, time: 0, target: t, values });
          p.target = next;
        },
        stop() {
          finish(p);
          if (!autoplay || typeof requestAnimationFrame !== "function") render();
        },
      };
    },
    setValues(next) {
      values = checkValues(def, { ...values, ...next });
      given = { ...given, ...next };
      resolved = resolveTextTreatment(def, values);
    },
    setEffect(next) {
      const d = treatmentOf(next);
      const names = new Set(d.controls.map((c) => c.name));
      const kept = Object.fromEntries(Object.entries(given).filter(([k]) => names.has(k)));
      def = d;
      values = checkValues(d, kept);
      resolved = resolveTextTreatment(d, values);
      behind.setAttribute("data-flair-treatment", d.id);
      above.setAttribute("data-flair-treatment", d.id);
    },
    render,
    clear() {
      for (const p of [...playing]) finish(p);
      render();
    },
    dispose() {
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = 0;
      for (const p of [...playing]) finish(p);
      behind.remove();
      above.remove();
      container.style.position = restore.position;
      container.style.isolation = restore.isolation;
    },
  };
  return overlay;
}

// ---------------------------------------------------------------------------
// The scripted preview: check a sentence, fix two words.
// ---------------------------------------------------------------------------

/** The paragraph the preview edits: a lead-in, then the sentence it checks, with two words to fix. */
export const TREATMENT_PREVIEW_SCRIPT = {
  lead: "A writing partner reads along as you go. ",
  sentence: [
    { text: "It checks each " },
    { text: "sentance", fix: "sentence" },
    { text: ", fixes the odd " },
    { text: "wrod", fix: "word" },
    { text: " and leaves the rest alone." },
  ],
  label: "Partner",
} as const;

export interface TreatmentPreviewOptions extends TextTreatmentOverlayOptions {
  /** Plays the edit again after a pause (default true). */
  loop?: boolean;
  /** Ms between typed letters (default 70). */
  typeMs?: number;
  /** The caret's name tag (default "Partner"). */
  label?: string;
  /** Start at once (default true). */
  autoplay?: boolean;
  /** Stand still while scrolled out of view (default true). */
  pauseWhenHidden?: boolean;
}

/** A treatment's scripted preview, from {@link previewTextTreatment}. */
export interface TreatmentPreview {
  readonly effect: TextTreatmentEffect;
  /** The element holding the paragraph and the overlay. */
  readonly element: HTMLElement;
  readonly overlay: TextTreatmentOverlay;
  play(): void;
  pause(): void;
  setValues(values: Record<string, ControlValue>): void;
  setEffect(effect: TextTreatmentEffect | string): void;
  dispose(): void;
}

/** The first colour behind `el` that is not transparent, else white. */
function backgroundOf(el: Element): string {
  const view = el.ownerDocument.defaultView;
  for (let node: Element | null = el; node && view; node = node.parentElement) {
    const bg = view.getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg;
  }
  return "#ffffff";
}

/** Px `text` takes in `el`'s font. */
function measure(el: Element, text: string): number {
  const view = el.ownerDocument.defaultView;
  const style = view?.getComputedStyle(el);
  try {
    const canvas = el.ownerDocument.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx && style) {
      ctx.font = style.font || `${style.fontSize} ${style.fontFamily}`;
      return ctx.measureText(text).width;
    }
  } catch {
    // No canvas (jsdom): estimate.
  }
  const size = parseFloat(style?.fontSize ?? "16") || 16;
  return text.length * size * 0.52;
}

/**
 * Plays a treatment's scripted edit on a paragraph of its own in `host`: the
 * agent's caret arrives, a sentence is checked, then two misspelt words are
 * each selected, typed over and land, and the caret leaves; then it plays
 * again. What the catalog gallery shows, and what `mountEffect` mounts for a
 * text treatment. The paragraph takes the host's font and colours.
 */
export function previewTextTreatment(host: HTMLElement, effect: TextTreatmentEffect | string, options: TreatmentPreviewOptions = {}): TreatmentPreview {
  const doc = host.ownerDocument;
  const element = doc.createElement("div");
  element.className = "flair-treatment-preview";
  Object.assign(element.style, { padding: "1em 1.25em", lineHeight: "1.6", font: "inherit", color: "inherit" });
  const p = doc.createElement("p");
  p.style.margin = "0";
  element.appendChild(p);
  host.appendChild(element);

  // A pausable clock, so pausing freezes stages and the script's waits alike.
  const base = options.clock ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  let pausedAt: number | undefined;
  let offset = 0;
  const clock = () => (pausedAt ?? base()) - offset;
  // The preview's `autoplay` says whether the script starts; the overlay always draws its frames.
  const overlay = mountTextTreatment(element, effect, { ...options, clock, autoplay: true });
  const typeMs = options.typeMs ?? 70;
  const label = options.label ?? TREATMENT_PREVIEW_SCRIPT.label;
  let run = 0;
  let disposed = false;

  /** Rejects once this run is over (disposed, or started again), so the script's awaits end with it. */
  let stopRun: () => void = () => undefined;
  let stopped: Promise<never> = new Promise<never>(() => undefined);
  const newRun = () => {
    stopRun();
    stopped = new Promise<never>((_, reject) => (stopRun = () => reject(new Error("stopped"))));
    stopped.catch(() => undefined);
  };
  /** Waits `ms` of the preview's clock (which stands still while paused), sleeping rather than polling. */
  const wait = (ms: number, id: number) =>
    Promise.race([
      stopped,
      new Promise<void>((resolve) => {
        const end = clock() + ms;
        const step = () => {
          if (disposed || id !== run) return;
          if (pausedAt !== undefined) return void setTimeout(step, 200);
          const left = end - clock();
          if (left <= 0) resolve();
          else setTimeout(step, left);
        };
        step();
      }),
    ]);
  const until = (playback: TreatmentPlayback) => Promise.race([stopped, playback.finished]);

  const build = () => {
    p.replaceChildren();
    p.append(doc.createTextNode(TREATMENT_PREVIEW_SCRIPT.lead));
    const spans = TREATMENT_PREVIEW_SCRIPT.sentence.map((part) => {
      const span = doc.createElement("span");
      span.textContent = part.text;
      p.appendChild(span);
      return { span, part };
    });
    return spans;
  };
  const textOf = (span: HTMLElement) => span.firstChild as Text;
  const rangeOver = (from: Node, fromOffset: number, to: Node, toOffset: number) => {
    const r = doc.createRange();
    r.setStart(from, fromOffset);
    r.setEnd(to, toOffset);
    return r;
  };
  const colours = () => {
    const view = doc.defaultView;
    const style = view?.getComputedStyle(p);
    return { background: backgroundOf(element), ...(style?.color && { color: style.color }), ...(style?.font && { font: style.font }) };
  };
  const hostColour = (c: string | undefined) => {
    if (!c) return undefined;
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return c;
    const parts = m[1]!.split(",").map((x) => parseFloat(x));
    return parts.slice(0, 3).map((x) => x / 255).concat(parts[3] !== undefined ? [parts[3]] : []);
  };
  const target = (t: TextTreatmentTarget): TextTreatmentTarget => {
    const c = colours();
    return { ...t, background: hostColour(c.background)!, ...(c.color && { color: hostColour(c.color)! }), ...(c.font && { font: c.font }) };
  };

  const script = async (id: number) => {
    const spans = build();
    const first = textOf(spans[0]!.span);
    let caretAtNode: { node: Text; offset: number } = { node: first, offset: 0 };
    const caretTarget = () => target({ ...((): TextTreatmentTarget => {
      const c = caretAt(caretAtNode.node, caretAtNode.offset, element);
      return c ? { caret: c } : {};
    })(), label });
    let caret = overlay.play("caret", caretTarget);
    await wait(500, id);
    const last = textOf(spans[spans.length - 1]!.span);
    await until(overlay.play("checking", target({ lines: rangeRects(rangeOver(first, 0, last, last.length), element) })));
    for (const { span, part } of spans) {
      if (!("fix" in part)) continue;
      const word = textOf(span);
      caretAtNode = { node: word, offset: 0 };
      await wait(220, id);
      caretAtNode = { node: word, offset: word.length };
      await until(overlay.play("selecting", target({ lines: rangeRects(rangeOver(word, 0, word, word.length), element), ...((c) => (c ? { caret: c } : {}))(caretAt(word, word.length, element)) })));
      // Keep the selection showing while typing begins.
      caret.stop();
      const lines = rangeRects(rangeOver(word, 0, word, word.length), element);
      const start = caretAt(word, 0, element);
      let typed = "";
      const typing = overlay.play("typing", () =>
        target({ lines, text: typed, ...(start && { caret: { ...start, x: start.x + measure(p, typed) } }) }),
      );
      for (const letter of part.fix) {
        await wait(typeMs, id);
        typed += letter;
      }
      await wait(typeMs * 2, id);
      word.data = part.fix;
      typing.stop();
      // The caret at the end of the new word: flourishes (a ribbon, sparkles) are placed from it.
      const end = caretAt(word, word.length, element);
      overlay.play("landed", target({ lines: rangeRects(rangeOver(word, 0, word, word.length), element), ...(end && { caret: end }) }));
      caretAtNode = { node: word, offset: word.length };
      caret = overlay.play("caret", caretTarget);
      await wait(320, id);
    }
    await wait(900, id);
    caret.stop();
    await wait(1400, id);
  };

  const loop = async (id: number) => {
    try {
      do await script(id);
      while (options.loop !== false && !disposed && id === run);
    } catch {
      // Stopped: disposed, or started again.
    }
  };
  const start = () => {
    run++;
    newRun();
    overlay.clear();
    void loop(run);
  };
  if (options.autoplay !== false) start();
  else build();

  // Previews scrolled out of view stand still: a gallery of them playing at once swamps scrolling.
  let userPaused = false;
  let visible = true;
  const settle = () => {
    if (userPaused || !visible) {
      if (pausedAt === undefined) pausedAt = base();
    } else if (pausedAt !== undefined) {
      offset += base() - pausedAt;
      pausedAt = undefined;
      overlay.render();
    }
  };
  const observer =
    options.pauseWhenHidden !== false && typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          settle();
        })
      : undefined;
  observer?.observe(element);

  return {
    get effect() {
      return overlay.effect;
    },
    element,
    overlay,
    play() {
      userPaused = false;
      if (run === 0) start();
      settle();
    },
    pause() {
      userPaused = true;
      settle();
    },
    setValues: (values) => overlay.setValues(values),
    setEffect: (next) => overlay.setEffect(next),
    dispose() {
      disposed = true;
      run++;
      stopRun();
      observer?.disconnect();
      overlay.dispose();
      element.remove();
    },
  };
}
