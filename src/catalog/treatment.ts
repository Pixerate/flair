import { rgbToHex, parseColor, type ControlDef, type ControlValue } from "../shader/controls.js";
import { didYouMean } from "../motion/params.js";
import { listedControls, listedValues } from "./listed-controls.js";
import {
  colorControl,
  numberControl,
  type TextTreatmentEffect,
  type TextTreatmentStage,
  type TreatmentBlend,
  type TreatmentEase,
  type TreatmentLayer,
  type TreatmentLayerType,
  type TreatmentReduced,
  type TreatmentStage,
  type TreatmentTrack,
  type TreatmentValue,
  type VectorControl,
} from "./types.js";

/*
 * Text treatments: the look of edits to a range of text (an agent checking a
 * sentence, selecting a word, typing over it, the change landing, and its
 * caret). A treatment's stages are data, and `textTreatmentPlan` turns a
 * stage at a moment into a layer plan: rectangles, gradients, text and their
 * opacities, in the host's coordinates (y down). The web renderer
 * (`/embed`'s `mountTextTreatment`) and the Swift one
 * (`FlairTextTreatmentRenderer`) draw that plan, and Swift computes it with
 * the same arithmetic (`FlairTextTreatments.plan`), checked against plans
 * written here (`pnpm swift:meta`).
 */

/** Every stage of a treatment, in the order an edit plays them. */
export const TEXT_TREATMENT_STAGES: readonly TextTreatmentStage[] = ["caret", "checking", "selecting", "typing", "landed"];

/** The treatment hosts use when nobody has chosen one: the writing partner's soft sweep. */
export const DEFAULT_TEXT_TREATMENT = "soft-sweep";

/** What each stage is, for sentences and tool descriptions. */
export const TEXT_TREATMENT_STAGE_NOTES: Readonly<Record<TextTreatmentStage, string>> = {
  caret: "the agent's insertion point, with its name tag when the host gives a label (loops until stopped)",
  checking: "a sweep across the word or line being looked at",
  selecting: "the selection appearing over what will be replaced",
  typing: "the word being typed, drawn over the one it replaces, with the caret at its end",
  landed: "what changed, tinted, then fading",
};

/** How each stage moves under Reduce Motion when the treatment does not say. */
export const DEFAULT_REDUCED: Readonly<Record<TextTreatmentStage, Required<Omit<TreatmentReduced, "duration">>>> = {
  caret: { at: 0, fade: "none" },
  checking: { at: 0.5, fade: "in-out" },
  selecting: { at: 1, fade: "in" },
  typing: { at: 1, fade: "none" },
  landed: { at: 0, fade: "out" },
};

/** Layer types, for checks and sentences. */
export const TREATMENT_LAYER_TYPES: readonly TreatmentLayerType[] = ["fill", "band", "caret", "tag", "cover", "ghost", "handles", "ribbon", "sparkles"];

// ---------------------------------------------------------------------------
// The host's side: where the text is.
// ---------------------------------------------------------------------------

/** A rectangle in the host's coordinates, y down (a line of the range). */
export interface TreatmentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An insertion point: its x, the top of its line and the line's height. */
export interface TreatmentCaret {
  x: number;
  y: number;
  height: number;
}

/**
 * What a treatment draws over, from the host: the range's line rectangles in
 * reading order (a range that wraps has several; they may change while a
 * stage plays), the caret, and for some layers the text's colours, font,
 * what has been typed and a name tag.
 */
export interface TextTreatmentTarget {
  /** The range's lines, in reading order. */
  lines?: readonly TreatmentRect[];
  /** The insertion point (for `caret` and `tag` layers). */
  caret?: TreatmentCaret;
  /** `typing`: what has been typed so far, for a `ghost` layer. */
  text?: string;
  /** A name tag for the caret (an agent's name), for a `tag` layer. */
  label?: string;
  /** The text's colour (`#rrggbb` or channels 0 to 1), for `"text"` colours. */
  color?: string | readonly number[];
  /** The colour behind the text, for `"background"` colours (a `cover` is left out without it). */
  background?: string | readonly number[];
  /** The text's font, passed through to `ghost` layers (a CSS font on the web). */
  font?: string;
}

// ---------------------------------------------------------------------------
// The plan: what a renderer draws.
// ---------------------------------------------------------------------------

/** A colour's channels and alpha, 0 to 1. */
export type TreatmentRGBA = [number, number, number, number];

/** A linear gradient in the host's coordinates, padded with its end colours past its ends. */
export interface TreatmentGradient {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: { offset: number; color: TreatmentRGBA }[];
}

/**
 * One thing to draw:
 * - `rect`: a rectangle, filled with `color` (or `gradient`), or outlined `stroke` px wide.
 * - `text`: `text` in the host's `font`, left-aligned at `x`, centred down the line from `y` to `y + height`.
 * - `tag`: a pill `height` tall whose bottom-left corner is `x`, `y + height`,
 *   holding `text` (`size` px, `textColor`), `padX` px either side of it: the
 *   renderer measures the text, so the plan has no width (`width` is 0).
 * - `path`: a ribbon, as `segments` (filled polygons, each in one colour, each
 *   overlapping the next) drawn together as one group at `opacity`, so the
 *   overlaps do not show; `x`, `y`, `width`, `height` are their bounds.
 */
export interface TreatmentPlanLayer {
  kind: "rect" | "text" | "tag" | "path";
  /** The layer type of the stage it came from. */
  source: TreatmentLayerType;
  z: "behind" | "above";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  opacity: number;
  color: TreatmentRGBA;
  gradient?: TreatmentGradient;
  stroke?: number;
  glow?: number;
  blend: TreatmentBlend;
  text?: string;
  font?: string;
  size?: number;
  padX?: number;
  textColor?: TreatmentRGBA;
  segments?: TreatmentSegment[];
}

/** A piece of a ribbon: a polygon (`[x, y]` corners) filled in one colour. */
export interface TreatmentSegment {
  points: [number, number][];
  color: TreatmentRGBA;
}

/** A stage at a moment, ready to draw. */
export interface TextTreatmentPlan {
  stage: TextTreatmentStage;
  /** Ms into the stage. */
  time: number;
  /** Ms the stage takes for this target (a looping stage's one pass). */
  duration: number;
  /** Whether it has finished (never, for a looping stage): a host removes it then. */
  done: boolean;
  /** Whether it was drawn without motion. */
  reduced: boolean;
  /** Back to front: the `behind` layers go under the text, the `above` ones over it. */
  layers: TreatmentPlanLayer[];
}

export interface TextTreatmentPlanOptions {
  stage: TextTreatmentStage;
  /** Ms into the stage (0 or more). */
  time: number;
  target: TextTreatmentTarget;
  /** A preset by name, then these values, over the treatment's defaults. */
  preset?: string;
  values?: Readonly<Record<string, unknown>>;
  /** Draws the stage without motion: held, and faded (see `TreatmentReduced`). */
  reduceMotion?: boolean;
}

// ---------------------------------------------------------------------------
// Easing: the same arithmetic as Swift's (`FlairTextTreatments.ease`).
// ---------------------------------------------------------------------------

const EASES: Readonly<Record<Exclude<TreatmentEase, readonly number[]>, readonly [number, number, number, number]>> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** A cubic Bézier timing function at `x` (0 to 1): Newton's method, then bisection if it stalls. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-7) return ((ay * t + by) * t + cy) * t;
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i++) {
    const v = sampleX(t);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ((ay * t + by) * t + cy) * t;
}

/** An easing at `x`, by name or control points. */
export function ease(e: TreatmentEase | undefined, x: number): number {
  if (e === undefined || e === "linear") return Math.min(1, Math.max(0, x));
  const [x1, y1, x2, y2] = typeof e === "string" ? EASES[e] : e;
  return cubicBezier(x1, y1, x2, y2, x);
}

// ---------------------------------------------------------------------------
// Values and resolution.
// ---------------------------------------------------------------------------

/** A placeholder naming a control: `"{{name}}"`. */
const PLACEHOLDER = /^\{\{\s*([A-Za-z_]\w*)\s*\}\}$/;

/** The control a value names, if it is a placeholder. */
export function placeholderName(value: unknown): string | undefined {
  return typeof value === "string" ? PLACEHOLDER.exec(value)?.[1] : undefined;
}

/** A treatment's controls, as `effectControls` gives them. */
export function textTreatmentControls(effect: Pick<TextTreatmentEffect, "controls">): ControlDef[] {
  return listedControls(effect);
}

/**
 * A treatment's values: each control's default, overridden by a preset (by
 * name) and then `values`, with problems as sentences (an unknown preset or
 * control, or a value of the wrong type or out of range, left at its default).
 */
export function textTreatmentValues(
  effect: TextTreatmentEffect,
  options: { preset?: string; values?: Readonly<Record<string, unknown>> } = {},
): { values: Record<string, ControlValue>; issues: string[] } {
  return listedValues(effect, options);
}

/** A control value as the stages read it: colours as `#rrggbb`, the rest as they are. */
function written(control: ControlDef, value: ControlValue): number | string | boolean {
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value[0] ?? 0;
  return value as number | string | boolean;
}

/**
 * A treatment's stages with every `"{{name}}"` replaced by its control's
 * value (colours as `#rrggbb`): plain data a renderer reads. Swift's
 * `FlairTextTreatments.resolve` does the same.
 */
export function resolveTextTreatment(effect: TextTreatmentEffect, values: Readonly<Record<string, ControlValue>>): TextTreatmentEffect["stages"] {
  const controls = new Map(textTreatmentControls(effect).map((c) => [c.name, c]));
  const walk = (v: unknown): unknown => {
    const name = placeholderName(v);
    if (name !== undefined) {
      const control = controls.get(name);
      return control ? written(control, values[name] ?? control.default) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(withDefaultColours(effect.stages)) as TextTreatmentEffect["stages"];
}

/** Layer types drawn in the agent's colour (`"{{color}}"`) unless they say otherwise. */
const AGENT_COLOURED: readonly TreatmentLayerType[] = ["fill", "band", "caret", "tag", "handles", "ribbon", "sparkles"];

/** Stages with each layer's colour filled in where it is left out: the agent's colour, the background for a cover, the text's colour for a ghost. */
function withDefaultColours(stages: TextTreatmentEffect["stages"]): TextTreatmentEffect["stages"] {
  return Object.fromEntries(
    Object.entries(stages).map(([name, stage]) => [
      name,
      { ...stage, layers: stage.layers.map((l) => (l.color !== undefined ? l : { ...l, color: AGENT_COLOURED.includes(l.type) ? "{{color}}" : defaultColour(l.type) })) },
    ]),
  ) as unknown as TextTreatmentEffect["stages"];
}

/** Every placeholder in a value, with where it is. */
function placeholders(v: unknown, where: string, out: { name: string; where: string }[] = []): { name: string; where: string }[] {
  const name = placeholderName(v);
  if (name !== undefined) out.push({ name, where });
  else if (Array.isArray(v)) v.forEach((x, i) => placeholders(x, `${where}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) placeholders(x, `${where}.${k}`, out);
  return out;
}

const NUMBER_FIELDS = ["alpha", "padX", "padY", "top", "height", "radius", "width", "widthPx", "glow", "stroke", "size", "gap", "taper", "count", "spread", "drift", "seed", "aspect", "endTaper"] as const;
const ANIMATED_FIELDS = ["opacity", "reveal", "erase", "position"] as const;
const COLOR_FIELDS = ["color", "textColor"] as const;
const LAYER_FIELDS = new Set<string>(["type", "z", "if", "unless", "stops", "blend", "points", "colorStops", "anchor", "behind", ...NUMBER_FIELDS, ...ANIMATED_FIELDS, ...COLOR_FIELDS]);
const STAGE_FIELDS = new Set(["duration", "perPixel", "stagger", "flow", "loop", "reduced", "layers"]);
const BLENDS: readonly TreatmentBlend[] = ["normal", "multiply", "screen", "plus-lighter"];

/**
 * Problems with a treatment's definition, as sentences: missing stages,
 * unknown layer types or fields, placeholders naming no control (or a control
 * of the wrong type), keys out of order, presets naming unknown controls.
 * The catalog's treatments have none.
 */
export function textTreatmentIssues(effect: TextTreatmentEffect): string[] {
  const issues: string[] = [];
  const controls = new Map(textTreatmentControls(effect).map((c) => [c.name, c]));
  if (!controls.has("color") || !controls.get("color")!.color) issues.push(`"${effect.id}" has no "color" colour control: every treatment's agent colour is "color", so several agents can be told apart.`);
  for (const stage of TEXT_TREATMENT_STAGES) {
    const spec = effect.stages[stage];
    if (!spec) {
      issues.push(`"${effect.id}" has no "${stage}" stage; every treatment has ${TEXT_TREATMENT_STAGES.join(", ")}.`);
      continue;
    }
    const at = `${effect.id} ${stage}`;
    for (const k of Object.keys(spec)) if (!STAGE_FIELDS.has(k)) issues.push(`${at}: a stage has no field "${k}"; it takes ${[...STAGE_FIELDS].join(", ")}.`);
    if (spec.flow !== undefined && spec.flow !== "each" && spec.flow !== "sequence") issues.push(`${at}: flow is "each" or "sequence".`);
    if (spec.reduced?.at !== undefined && !(spec.reduced.at >= 0 && spec.reduced.at <= 1)) issues.push(`${at}: reduced.at is from 0 to 1.`);
    spec.layers.forEach((layer, i) => {
      const where = `${at} layer ${i} (${layer.type})`;
      if (!TREATMENT_LAYER_TYPES.includes(layer.type)) issues.push(`${where}: a layer's type is one of ${TREATMENT_LAYER_TYPES.join(", ")}.`);
      for (const k of Object.keys(layer)) if (!LAYER_FIELDS.has(k)) issues.push(`${where}: a layer has no field "${k}".`);
      if ((layer.type === "ribbon" || layer.type === "sparkles") && (!Array.isArray(layer.points) || layer.points.length < 4 || (layer.points.length - 1) % 3 !== 0))
        issues.push(`${where}: points are a start point and then three [x, y] points for each cubic segment (4, 7, 10, … points).`);
      if (layer.behind !== undefined && (!Array.isArray(layer.behind) || layer.behind.some((r) => !Array.isArray(r) || r.length !== 2 || !(r[0] >= 0 && r[1] <= 1 && r[0] < r[1]))))
        issues.push(`${where}: behind is a list of [from, to] stretches along the curve, from 0 (its start) to 1 (its end), each from before to.`);
      if (layer.anchor !== undefined && layer.anchor !== "caret" && layer.anchor !== "range") issues.push(`${where}: anchor is "caret" or "range".`);
      if (layer.blend !== undefined && !BLENDS.includes(layer.blend)) issues.push(`${where}: blend is one of ${BLENDS.join(", ")}.`);
      if (layer.z !== undefined && layer.z !== "behind" && layer.z !== "above") issues.push(`${where}: z is "behind" or "above".`);
      for (const f of ANIMATED_FIELDS) {
        const v = layer[f];
        if (v && typeof v === "object") {
          const keys = (v as TreatmentTrack).keys;
          if (!Array.isArray(keys) || keys.length === 0) issues.push(`${where}: ${f}'s keys are [progress, value] pairs.`);
          else if (keys.some((k, j) => !(k[0] >= 0 && k[0] <= 1) || (j > 0 && k[0] < keys[j - 1]![0]))) issues.push(`${where}: ${f}'s keys go from progress 0 to 1, in order.`);
        }
      }
    });
    for (const { name, where } of placeholders(spec, at)) {
      const control = controls.get(name);
      if (!control) {
        issues.push(`${where} names "{{${name}}}", which is not a control of "${effect.id}".${didYouMean(name, [...controls.keys()])}`);
        continue;
      }
      const field = where.split(".").pop()!.replace(/\[\d+\]/g, "");
      const wantsColour = (COLOR_FIELDS as readonly string[]).includes(field) || /colorStops\[\d+\]\[1\]$/.test(where);
      if (wantsColour !== control.color) issues.push(`${where} names "${name}", ${control.color ? "a colour control, where a number goes" : "not a colour control, where a colour goes"}.`);
      else if ((field === "if" || field === "unless") && control.type !== "bool") issues.push(`${where} names "${name}"; "${field}" takes a bool control.`);
      else if (field !== "if" && field !== "unless" && !wantsColour && control.type !== "float" && control.type !== "int") issues.push(`${where} names "${name}", which is not a number control.`);
    }
  }
  for (const preset of effect.presets ?? []) {
    for (const name of Object.keys(preset.values)) if (!controls.has(name)) issues.push(`"${effect.id}" preset "${preset.name}" sets "${name}", which is not one of its controls.`);
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Planning.
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Smoothstep from 0 to 1. */
const smooth01 = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** A resolved number field, or its fallback. */
const n = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** A resolved value at progress `p`: a number, or a track eased between its keys. */
export function valueAt(v: TreatmentValue | undefined, p: number, fallback: number): number {
  if (v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string" || !v || !Array.isArray(v.keys) || v.keys.length === 0) return fallback;
  const keys = v.keys;
  const first = keys[0]!;
  if (p <= first[0]) return n(first[1], fallback);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (p <= b[0]) {
      const span = b[0] - a[0];
      const u = span <= 0 ? 1 : (p - a[0]) / span;
      const va = n(a[1], fallback);
      const vb = n(b[1], fallback);
      return va + (vb - va) * ease(v.ease, u);
    }
  }
  return n(keys[keys.length - 1]![1], fallback);
}

/** A colour from the host (hex or channels), or undefined. */
function hostColour(c: string | readonly number[] | undefined): [number, number, number, number] | undefined {
  if (c === undefined) return undefined;
  if (typeof c === "string") {
    const rgb = parseColor(c);
    return rgb ? [rgb[0]!, rgb[1]!, rgb[2]!, rgb[3] ?? 1] : undefined;
  }
  if (c.length >= 3 && c.every((x) => typeof x === "number" && Number.isFinite(x))) return [c[0]!, c[1]!, c[2]!, c[3] ?? 1];
  return undefined;
}

/** A resolved colour field: hex, `"text"` or `"background"`; undefined when it cannot be drawn. */
function colourOf(v: unknown, target: TextTreatmentTarget): [number, number, number, number] | undefined {
  if (v === "text") return hostColour(target.color) ?? [0, 0, 0, 1];
  if (v === "background") return hostColour(target.background);
  if (typeof v !== "string") return undefined;
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return undefined;
  const h = m[1]!;
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1];
}

/** Ms one pass of a resolved stage takes for these lines. */
function stageLength(spec: TreatmentStage, lines: readonly TreatmentRect[]): number {
  const duration = Math.max(0, n(spec.duration, 0));
  const perPixel = Math.max(0, n(spec.perPixel, 0));
  if ((spec.flow ?? "sequence") === "each" && lines.length) {
    const stagger = Math.max(0, n(spec.stagger, 0));
    return Math.max(...lines.map((l, i) => i * stagger + duration + perPixel * l.width));
  }
  return duration + perPixel * lines.reduce((s, l) => s + l.width, 0);
}

/** The default `z` of a layer type. */
const defaultZ = (type: TreatmentLayerType): "behind" | "above" => (type === "fill" || type === "band" ? "behind" : "above");

/** The default colour of a layer type. */
const defaultColour = (type: TreatmentLayerType): string => (type === "cover" ? "background" : type === "ghost" ? "text" : "#000000");

/** A line's rectangle grown by a layer's padding, cut to its `top` and `height`. */
function lineBox(line: TreatmentRect, layer: TreatmentLayer): TreatmentRect {
  const padX = n(layer.padX, 0);
  const padY = n(layer.padY, 0);
  const top = n(layer.top, 0);
  const height = n(layer.height, 1);
  return { x: line.x - padX, y: line.y + top * line.height - padY, width: line.width + 2 * padX, height: height * line.height + 2 * padY };
}

const radiusFor = (r: number, w: number, h: number) => Math.max(0, Math.min(r, w / 2, h / 2));

/** Samples each cubic segment of a curve is cut into. */
const CURVE_STEPS = 16;

/** A curve's points (caret heights from the caret) sampled in the host's px, with the arc length up to each sample. */
/** Where a curve's points are measured from, and its units across and down: from the caret in caret heights, or across the range's last line. */
interface CurveFrame {
  x: number;
  y: number;
  ux: number;
  uy: number;
}

/**
 * A curve layer's frame: with `anchor: "caret"` (the default) the caret, in caret heights; with
 * `anchor: "range"` the last line of the range (where the change ends), x as a share of its width
 * and y as a share of its height, so the curve covers only the text it is drawn over.
 */
function curveFrame(layer: TreatmentLayer, target: TextTreatmentTarget, lines: readonly TreatmentRect[]): CurveFrame | undefined {
  if (layer.anchor === "range") {
    const last = lines[lines.length - 1];
    if (!last) return undefined;
    const aspect = n(layer.aspect, 0);
    if (!(aspect > 0)) return { x: last.x, y: last.y, ux: last.width, uy: last.height };
    // Its own shape, `aspect` line heights wide: on the end of a long line, scaled down evenly (to 40% at the least) to fit a short one.
    const scale = Math.min(1, Math.max(MIN_CURVE_SCALE, last.width / (aspect * last.height)));
    const ux = aspect * last.height * scale;
    const uy = last.height * scale;
    const x = ux <= last.width ? last.x + last.width - ux : last.x + (last.width - ux) / 2;
    return { x, y: last.y + (last.height - uy) / 2, ux, uy };
  }
  const caret = target.caret;
  return caret && caret.height > 0 ? { x: caret.x, y: caret.y, ux: caret.height, uy: caret.height } : undefined;
}

/** The smallest a curve with an `aspect` is scaled to, to fit a short word (it overflows the word a little past that). */
const MIN_CURVE_SCALE = 0.4;

function sampleCurve(points: unknown, frame: CurveFrame): { x: number; y: number; s: number }[] {
  if (!Array.isArray(points) || points.length < 4) return [];
  const pt = (i: number): [number, number] => {
    const q = points[i] as unknown[];
    return [frame.x + n(q?.[0], 0) * frame.ux, frame.y + n(q?.[1], 0) * frame.uy];
  };
  const out: { x: number; y: number; s: number }[] = [];
  const [x0, y0] = pt(0);
  out.push({ x: x0, y: y0, s: 0 });
  for (let k = 0; k + 3 < points.length; k += 3) {
    const [ax, ay] = pt(k);
    const [bx, by] = pt(k + 1);
    const [cx, cy] = pt(k + 2);
    const [dx, dy] = pt(k + 3);
    for (let j = 1; j <= CURVE_STEPS; j++) {
      const t = j / CURVE_STEPS;
      const u = 1 - t;
      const x = u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx;
      const y = u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy;
      const last = out[out.length - 1]!;
      out.push({ x, y, s: last.s + Math.hypot(x - last.x, y - last.y) });
    }
  }
  return out;
}

/** The point at arc length `at` along samples. */
function pointAt(samples: readonly { x: number; y: number; s: number }[], at: number): { x: number; y: number; s: number } {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (at <= b.s) {
      const f = b.s - a.s <= 0 ? 0 : (at - a.s) / (b.s - a.s);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, s: at };
    }
  }
  return samples[samples.length - 1]!;
}

/** A colour along `colorStops` at `u` (0 tail to 1 head), interpolated channel by channel; undefined stops give `fallback`. */
function stopColour(stops: unknown, u: number, fallback: TreatmentRGBA, target: TextTreatmentTarget): TreatmentRGBA {
  if (!Array.isArray(stops) || stops.length === 0) return fallback;
  const parsed = stops
    .map((st) => {
      const a = st as unknown[];
      const c = colourOf(a?.[1], target);
      return c ? { at: n(a[0], 0), c: [c[0], c[1], c[2], c[3] * clamp01(n(a[2], 1))] as TreatmentRGBA } : undefined;
    })
    .filter((x): x is { at: number; c: TreatmentRGBA } => x !== undefined);
  if (!parsed.length) return fallback;
  if (u <= parsed[0]!.at) return parsed[0]!.c;
  for (let i = 1; i < parsed.length; i++) {
    const a = parsed[i - 1]!;
    const b = parsed[i]!;
    if (u <= b.at) {
      const f = b.at - a.at <= 0 ? 1 : (u - a.at) / (b.at - a.at);
      return [0, 1, 2, 3].map((k) => a.c[k]! + (b.c[k]! - a.c[k]!) * f) as TreatmentRGBA;
    }
  }
  return parsed[parsed.length - 1]!.c;
}

/** Whether `u` (0 to 1 along a curve) falls in one of a layer's `behind` stretches. */
function isBehind(behind: unknown, u: number): boolean {
  if (!Array.isArray(behind)) return false;
  return behind.some((r) => Array.isArray(r) && u >= n(r[0], 2) && u < n(r[1], -1));
}

/** A number from 0 to 1 for `i`, the same in Swift (an integer hash, no floating-point trigonometry). */
export function treatmentHash(i: number): number {
  let h = Math.imul((i + 1) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The layers of one resolved stage at a moment: `progress(i)` is how far
 * line `i` is through the stage (or the whole stage, for `-1`); `fade`
 * multiplies every opacity.
 */
function planLayers(
  spec: TreatmentStage,
  target: TextTreatmentTarget,
  progress: (line: number) => number,
  fade: number,
  sequence: boolean,
): TreatmentPlanLayer[] {
  const out: TreatmentPlanLayer[] = [];
  const lines = (target.lines ?? []).filter((l) => l.width > 0 && l.height > 0);
  for (const layer of spec.layers) {
    if (layer.if !== undefined && (layer.if as unknown) !== true) continue;
    if (layer.unless !== undefined && (layer.unless as unknown) === true) continue;
    const colour = colourOf(layer.color ?? defaultColour(layer.type), target);
    if (!colour) continue;
    const alpha = clamp01(n(layer.alpha, 1));
    const color: [number, number, number, number] = [colour[0], colour[1], colour[2], colour[3] * alpha];
    const z = layer.z ?? defaultZ(layer.type);
    const blend = layer.blend ?? "normal";
    const glow = n(layer.glow, 0);
    const base = (p: number) => ({ z, blend, color, ...(glow > 0 && { glow }), opacity: clamp01(valueAt(layer.opacity, p, 1)) * fade });
    const push = (l: TreatmentPlanLayer) => {
      if (l.opacity > 0 && l.color[3] > 0) out.push(l);
    };

    if (layer.type === "fill" || layer.type === "band" || layer.type === "cover") {
      const boxes = lines.map((l) => lineBox(l, layer));
      // Where each line starts along the strip the range makes, and its length.
      const offsets: number[] = [];
      let span = 0;
      for (const b of boxes) {
        offsets.push(sequence ? span : 0);
        span += b.width;
      }
      boxes.forEach((box, i) => {
        const p = progress(sequence ? -1 : i);
        const length = sequence ? span : box.width;
        const o = offsets[i]!;
        const radius = n(layer.radius, 0);
        if (layer.type === "band") {
          const bw = Math.max(0, n(layer.width, 0.4) * length + n(layer.widthPx, 0));
          const pos = valueAt(layer.position, p, 0);
          const start = pos * (length + bw) - bw;
          const from = Math.max(start, o);
          const to = Math.min(start + bw, o + box.width);
          if (to - from <= 0.01 || bw <= 0) return;
          const stops = (layer.stops ?? [[0, 0], [0.5, 1], [1, 0]]).map(([offset, a]) => ({ offset: n(offset, 0), color: [color[0], color[1], color[2], color[3] * clamp01(n(a, 1))] as TreatmentRGBA }));
          const x0 = box.x + start - o;
          const midY = box.y + box.height / 2;
          const x = box.x + from - o;
          const width = to - from;
          push({ kind: "rect", source: "band", x, y: box.y, width, height: box.height, radius: radiusFor(radius, width, box.height), ...base(p), gradient: { x0, y0: midY, x1: x0 + bw, y1: midY, stops } });
          return;
        }
        const reveal = layer.type === "fill" ? clamp01(valueAt(layer.reveal, p, 1)) : 1;
        const erase = layer.type === "fill" ? clamp01(valueAt(layer.erase, p, 0)) : 0;
        const from = Math.max(erase * length, o);
        const to = Math.min(reveal * length, o + box.width);
        if (to - from <= 0.01) return;
        const x = box.x + from - o;
        const width = to - from;
        const stroke = layer.type === "fill" ? n(layer.stroke, 0) : 0;
        const l: TreatmentPlanLayer = { kind: "rect", source: layer.type, x, y: box.y, width, height: box.height, radius: radiusFor(radius, width, box.height), ...base(p) };
        if (stroke > 0) l.stroke = stroke;
        if (layer.type === "fill" && layer.stops) {
          const midY = box.y + box.height / 2;
          l.gradient = { x0: box.x, y0: midY, x1: box.x + box.width, y1: midY, stops: layer.stops.map(([offset, a]) => ({ offset: n(offset, 0), color: [color[0], color[1], color[2], color[3] * clamp01(n(a, 1))] as TreatmentRGBA })) };
        }
        push(l);
      });
      continue;
    }

    const p = progress(-1);
    if (layer.type === "ribbon" || layer.type === "sparkles") {
      const frame = curveFrame(layer, target, lines);
      if (!frame) continue;
      const samples = sampleCurve(layer.points, frame);
      const total = samples.length ? samples[samples.length - 1]!.s : 0;
      if (total <= 0) continue;
      const reveal = clamp01(valueAt(layer.reveal, p, 1));
      const erase = clamp01(valueAt(layer.erase, p, 0));
      if (reveal - erase <= 0.001) continue;
      // Widths, spreads and drifts are in line (or caret) heights; so is glow, over the text, so it keeps to the text's size.
      const h = frame.uy;
      const glowPx = layer.anchor === "range" ? n(layer.glow, 0) * h : n(layer.glow, 0);
      const glowed = glowPx > 0 ? { glow: glowPx } : {};
      if (layer.type === "ribbon") {
        // The drawn part, cut at its ends.
        const from = erase * total;
        const to = reveal * total;
        const part = [pointAt(samples, from), ...samples.filter((q) => q.s > from && q.s < to), pointAt(samples, to)];
        const head = Math.max(0, n(layer.width, 0.3)) * h;
        const taper = clamp01(n(layer.taper, 0.1));
        const edges = part.map((q, i) => {
          const a = part[Math.max(0, i - 1)]!;
          const b = part[Math.min(part.length - 1, i + 1)]!;
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / len;
          const ny = (b.x - a.x) / len;
          const u = q.s / total;
          // With `endTaper`, the last stretch narrows to a point, as a brush stroke lifts.
          const endTaper = n(layer.endTaper, 0);
          const lift = endTaper > 0 ? 0.15 + 0.85 * smooth01((1 - u) / endTaper) : 1;
          const half = (head * (taper + (1 - taper) * u) * lift) / 2;
          return { l: [q.x + nx * half, q.y + ny * half] as [number, number], r: [q.x - nx * half, q.y - ny * half] as [number, number], s: q.s };
        });
        // Pieces in a `behind` stretch go under the text, the rest over it, so the ribbon weaves through the words.
        const groups: { z: "behind" | "above"; segments: TreatmentSegment[]; xs: number[]; ys: number[] }[] = [];
        for (let i = 0; i + 1 < edges.length; i++) {
          // Each piece reaches over the next one, so no seam shows between them.
          const j = Math.min(i + 2, edges.length - 1);
          const mid = (edges[i]!.s + edges[i + 1]!.s) / 2 / total;
          const pz = isBehind(layer.behind, mid) ? "behind" : z;
          let group = groups[groups.length - 1];
          if (!group || group.z !== pz) groups.push((group = { z: pz, segments: [], xs: [], ys: [] }));
          const corners: [number, number][] = [edges[i]!.l, edges[j]!.l, edges[j]!.r, edges[i]!.r];
          group.segments.push({ points: corners, color: stopColour(layer.colorStops, mid, [color[0], color[1], color[2], 1], target) });
          for (const [x, y] of corners) {
            group.xs.push(x);
            group.ys.push(y);
          }
        }
        const b = base(p);
        for (const group of groups) {
          const left = Math.min(...group.xs);
          const top = Math.min(...group.ys);
          // The layer's alpha goes on the group, so overlapping pieces do not darken.
          push({ kind: "path", source: "ribbon", x: left, y: top, width: Math.max(...group.xs) - left, height: Math.max(...group.ys) - top, radius: 0, ...b, ...glowed, z: group.z, opacity: b.opacity * color[3], color: [color[0], color[1], color[2], 1], segments: group.segments });
        }
      } else {
        const count = Math.max(0, Math.min(200, Math.round(n(layer.count, 12))));
        const spread = n(layer.spread, 0.4) * h;
        const drift = n(layer.drift, 0.3) * h;
        const size = Math.max(0, n(layer.size, 0.12)) * h;
        const seed = Math.round(n(layer.seed, 0)) * 1000;
        for (let i = 0; i < count; i++) {
          const u = treatmentHash(seed + i * 5);
          if (u < erase || u > reveal) continue;
          const q = pointAt(samples, u * total);
          const a = pointAt(samples, Math.max(0, u * total - 1));
          const bq = pointAt(samples, Math.min(total, u * total + 1));
          const len = Math.hypot(bq.x - a.x, bq.y - a.y) || 1;
          const off = (treatmentHash(seed + i * 5 + 1) - 0.5) * 2 * spread;
          const d = size * (0.35 + 0.65 * treatmentHash(seed + i * 5 + 2));
          // They drift and dim through the stage.
          const since = p;
          const cx = q.x - ((bq.y - a.y) / len) * off;
          const cy = q.y + ((bq.x - a.x) / len) * off + drift * since * (0.5 + treatmentHash(seed + i * 5 + 3));
          const twinkle = 1 - 0.6 * since * treatmentHash(seed + i * 5 + 4);
          const b = base(p);
          push({ kind: "rect", source: "sparkles", x: cx - d / 2, y: cy - d / 2, width: d, height: d, radius: d / 2, ...b, ...glowed, ...(isBehind(layer.behind, u) && { z: "behind" as const }), opacity: b.opacity * twinkle });
        }
      }
      continue;
    }
    if (layer.type === "caret" || layer.type === "tag") {
      const caret = target.caret;
      if (!caret || !(caret.height > 0)) continue;
      if (layer.type === "caret") {
        const width = Math.max(0, n(layer.width, 2));
        const height = n(layer.height, 1) * caret.height;
        const y = caret.y + n(layer.top, 0) * caret.height;
        push({ kind: "rect", source: "caret", x: caret.x - width / 2, y, width, height, radius: radiusFor(n(layer.radius, 0), width, height), ...base(p) });
      } else {
        if (!target.label) continue;
        const size = Math.max(1, n(layer.size, 11));
        const height = size * 1.6;
        const textColor = colourOf(layer.textColor ?? "#ffffff", target) ?? [1, 1, 1, 1];
        push({
          kind: "tag",
          source: "tag",
          x: caret.x - 1,
          y: caret.y - n(layer.gap, 2) - height,
          width: 0,
          height,
          radius: Math.max(0, n(layer.radius, 4)),
          ...base(p),
          text: target.label,
          size,
          padX: size * 0.6,
          textColor,
        });
      }
      continue;
    }
    if (layer.type === "ghost") {
      const first = lines[0];
      if (!first || !target.text) continue;
      push({ kind: "text", source: "ghost", x: first.x, y: first.y, width: first.width, height: first.height, radius: 0, ...base(p), text: target.text, ...(target.font !== undefined && { font: target.font }) });
      continue;
    }
    if (layer.type === "handles") {
      if (!lines.length) continue;
      const boxes = lines.map((l) => lineBox(l, layer));
      const left = Math.min(...boxes.map((b) => b.x));
      const top = Math.min(...boxes.map((b) => b.y));
      const right = Math.max(...boxes.map((b) => b.x + b.width));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      const size = Math.max(0, n(layer.width, 6));
      for (const [cx, cy] of [[left, top], [right, top], [left, bottom], [right, bottom]] as const) {
        push({ kind: "rect", source: "handles", x: cx - size / 2, y: cy - size / 2, width: size, height: size, radius: radiusFor(n(layer.radius, 0), size, size), ...base(p) });
      }
    }
  }
  return out;
}

/** How far through a fade of `fade` kind a moment `u` (0 to 1) is, as an opacity. */
function fadeAt(fade: TreatmentReduced["fade"], u: number): number {
  const x = clamp01(u);
  if (fade === "in") return x;
  if (fade === "out") return 1 - x;
  if (fade === "in-out") return clamp01(Math.min(x / 0.3, (1 - x) / 0.3));
  return 1;
}

/**
 * A stage of an already resolved treatment at a moment (see
 * {@link resolveTextTreatment}): what Swift's `FlairTextTreatments.plan`
 * computes. Most callers want {@link textTreatmentPlan}.
 */
export function planResolvedStage(
  stages: TextTreatmentEffect["stages"],
  stage: TextTreatmentStage,
  time: number,
  target: TextTreatmentTarget,
  reduceMotion = false,
): TextTreatmentPlan {
  const spec = stages[stage];
  const lines = (target.lines ?? []).filter((l) => l.width > 0 && l.height > 0);
  const length = stageLength(spec, lines);
  const sequence = (spec.flow ?? "sequence") === "sequence";
  if (reduceMotion) {
    const reduced = { ...DEFAULT_REDUCED[stage], ...spec.reduced };
    const duration = Math.max(0, n(spec.reduced?.duration, length));
    const u = duration <= 0 ? 1 : time / duration;
    const layers = planLayers(spec, target, () => reduced.at, fadeAt(reduced.fade, u), sequence);
    return { stage, time, duration, done: !spec.loop && time >= duration, reduced: true, layers };
  }
  const t = spec.loop && length > 0 ? time % length : time;
  const global = length <= 0 ? 1 : clamp01(t / length);
  const duration = Math.max(0, n(spec.duration, 0));
  const perPixel = Math.max(0, n(spec.perPixel, 0));
  const stagger = Math.max(0, n(spec.stagger, 0));
  const progress = (i: number) => {
    if (i < 0 || sequence) return global;
    const d = duration + perPixel * lines[i]!.width;
    return d <= 0 ? (t >= i * stagger ? 1 : 0) : clamp01((t - i * stagger) / d);
  };
  return { stage, time, duration: length, done: !spec.loop && time >= length, reduced: false, layers: planLayers(spec, target, progress, 1, sequence) };
}

/** Checks a target's rectangles and caret, throwing a sentence naming what is wrong. */
function checkTarget(target: TextTreatmentTarget): void {
  if (!target || typeof target !== "object") throw new Error("The target is an object: { lines: [{ x, y, width, height }, …], caret: { x, y, height }, text?, label?, color?, background?, font? }.");
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (target.lines !== undefined) {
    if (!Array.isArray(target.lines)) throw new Error("The target's lines are a list of rectangles: [{ x, y, width, height }, …], in reading order.");
    target.lines.forEach((l, i) => {
      if (!l || !finite(l.x) || !finite(l.y) || !finite(l.width) || !finite(l.height) || l.width < 0 || l.height < 0)
        throw new Error(`Line ${i} of the target is { x, y, width, height } in px, with width and height 0 or more; it was ${JSON.stringify(l)}.`);
    });
  }
  const c = target.caret;
  if (c !== undefined && (!c || !finite(c.x) || !finite(c.y) || !finite(c.height) || c.height < 0))
    throw new Error(`The target's caret is { x, y, height } in px (y the top of its line); it was ${JSON.stringify(c)}.`);
  for (const k of ["text", "label", "font"] as const) if (target[k] !== undefined && typeof target[k] !== "string") throw new Error(`The target's ${k} is a string.`);
  for (const k of ["color", "background"] as const) if (target[k] !== undefined && !hostColour(target[k])) throw new Error(`The target's ${k} is a colour: "#rrggbb", or channels 0 to 1; it was ${JSON.stringify(target[k])}.`);
}

/** Why a text treatment cannot be opened as an effect, or rendered on its own, and what to do with it instead. */
export function textTreatmentRefusal(id: string): string {
  return `"${id}" is a text treatment, which draws over a host's text (a range's line rectangles) rather than a picture of its own, so it cannot be opened as an effect or rendered alone. See what any stage draws with catalog.treatment, play it over a page's text with mountTextTreatment (or its scripted preview with mountEffect), or draw it in Swift with FlairTextTreatmentRenderer.`;
}

/** A stage name, checked: a thrown sentence lists the stages. */
export function checkStage(stage: unknown): TextTreatmentStage {
  if (typeof stage === "string" && (TEXT_TREATMENT_STAGES as readonly string[]).includes(stage)) return stage as TextTreatmentStage;
  throw new Error(`There is no stage ${JSON.stringify(stage)}; a treatment's stages are ${TEXT_TREATMENT_STAGES.map((s) => `${s} (${TEXT_TREATMENT_STAGE_NOTES[s]})`).join("; ")}.`);
}

/**
 * What a treatment draws for `stage` at `time` ms into it, over `target`: a
 * layer plan of rectangles, gradients, text and opacities in the host's
 * coordinates, with how long the stage takes and whether it is done. Pure:
 * the same treatment, values, stage, time and target give the same plan, on
 * the web and in Swift. Throws a sentence for an unknown stage, a bad time,
 * target, preset or value.
 *
 * ```ts
 * textTreatmentPlan(getTextTreatment("soft-sweep")!, {
 *   stage: "checking", time: 120,
 *   target: { lines: [{ x: 10, y: 4, width: 80, height: 18 }] },
 * });
 * ```
 */
export function textTreatmentPlan(effect: TextTreatmentEffect, options: TextTreatmentPlanOptions): TextTreatmentPlan {
  const stage = checkStage(options.stage);
  if (typeof options.time !== "number" || !Number.isFinite(options.time) || options.time < 0) throw new Error(`The time is ms into the stage, 0 or more; it was ${String(options.time)}.`);
  checkTarget(options.target);
  const checked = textTreatmentValues(effect, { ...(options.preset !== undefined && { preset: options.preset }), ...(options.values && { values: options.values }) });
  if (checked.issues.length) throw new Error(checked.issues.join(" "));
  return planResolvedStage(resolveTextTreatment(effect, checked.values), stage, options.time, options.target, options.reduceMotion ?? false);
}

/** Ms a stage takes over `target`'s lines (its fade, with `reduceMotion`), with the treatment's values. */
export function textTreatmentDuration(
  effect: TextTreatmentEffect,
  stage: TextTreatmentStage,
  target: TextTreatmentTarget = {},
  options: { preset?: string; values?: Readonly<Record<string, unknown>>; reduceMotion?: boolean } = {},
): number {
  return textTreatmentPlan(effect, { stage, time: 0, target, ...options }).duration;
}

// ---------------------------------------------------------------------------
// The catalog's treatments.
// ---------------------------------------------------------------------------

const track = (keys: readonly (readonly [number, number | string])[], e?: TreatmentEase): TreatmentTrack => ({ keys, ...(e !== undefined && { ease: e }) });

/** Fades out over the last part of a stage. */
const holdThenFade = (from = 0.6) => track([[0, 1], [from, 1], [1, 0]], "ease-in");

/** A caret that blinks: on, then off for the second half of each pass. */
const blink = track([[0, 1], [0.45, 1], [0.5, 0], [0.95, 0], [1, 1]]);

/** A 2 px caret with a tag above it, in the agent's colour. */
const caretLayers = (extra: Partial<TreatmentLayer> = {}, opacity?: TreatmentValue): TreatmentLayer[] => [
  { type: "caret", width: "{{caretWidth}}", radius: 1, ...extra, ...(opacity !== undefined && { opacity }) },
  { type: "tag", if: "{{nameTag}}", radius: 4, size: 11, ...(opacity !== undefined && { opacity }) },
];

/** Controls every treatment has: the agent's colour, the caret and its tag, and each stage's timing. */
const commonControls = (colour: string, o: { checkMs?: number; selectMs?: number; landMs?: number } = {}): VectorControl[] => [
  colorControl("color", colour, "Agent colour"),
  numberControl("caretWidth", 2, 1, 6, "Caret width", 0.5),
  { name: "nameTag", type: "bool", default: true, label: "Name tag" },
  { name: "blink", type: "bool", default: false, label: "Blink caret" },
  numberControl("checkMs", o.checkMs ?? 320, 80, 2000, "Check (ms)", 10),
  numberControl("selectMs", o.selectMs ?? 180, 0, 1000, "Select (ms)", 10),
  numberControl("landMs", o.landMs ?? 900, 100, 4000, "Land (ms)", 10),
];

/** The caret stage every treatment shares: steady, or blinking with `blink`. */
const caretStage = (extra: Partial<TreatmentLayer> = {}): TreatmentStage => ({
  duration: 1060,
  loop: true,
  layers: [
    { type: "caret", unless: "{{blink}}", width: "{{caretWidth}}", radius: 1, ...extra },
    { type: "caret", if: "{{blink}}", width: "{{caretWidth}}", radius: 1, opacity: blink, ...extra },
    { type: "tag", if: "{{nameTag}}", radius: 4, size: 11 },
  ],
});

/**
 * Soft sweep: the writing partner's look (Swash's WritingPartnerOverlay),
 * and the default. A soft gradient sweeps across each line being checked;
 * the selection grows from the start in the agent's colour; the word being
 * typed covers the old one with a faint tint behind it; what changed is
 * tinted, then fades.
 */
export const softSweep: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "soft-sweep",
  name: "Soft sweep",
  description: "A soft gradient sweeping across the word being checked, a selection growing over it in the agent's colour, the new word typed over the old with the caret at its end, then a tint on what changed that fades.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "sweep", "gradient", "caret", "selection", "subtle"],
  controls: [...commonControls("#AF52DE"), numberControl("sweepAlpha", 0.22, 0, 1, "Sweep opacity", 0.01), numberControl("tintAlpha", 0.16, 0, 1, "Tint opacity", 0.01)],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 1.5,
      stagger: 80,
      flow: "each",
      layers: [{ type: "band", padX: 2, padY: -1, radius: 3, width: 0.4, alpha: "{{sweepAlpha}}", position: track([[0, 0], [1, 1]], "ease-in-out") }],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [{ type: "fill", alpha: 0.22, radius: 2, reveal: track([[0, 0], [1, 1]], "ease-out") }, ...caretLayers()],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", padX: 1, alpha: 0.12, radius: 2 }, { type: "ghost" }, ...caretLayers()],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [{ type: "fill", alpha: "{{tintAlpha}}", radius: 2, opacity: holdThenFade(0.67) }],
    },
  },
  presets: [
    { name: "Purple", values: { color: [175 / 255, 82 / 255, 222 / 255] } },
    { name: "Blue", values: { color: [0, 122 / 255, 1] } },
    { name: "Teal", values: { color: [48 / 255, 176 / 255, 199 / 255] } },
    { name: "Orange", values: { color: [1, 149 / 255, 0] } },
    { name: "Quiet", values: { sweepAlpha: 0.12, tintAlpha: 0.08, nameTag: false } },
  ],
};

/** Marker: from `highlighter`, a marker swipe behind the phrase. */
export const markerSwipe: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "marker-swipe",
  name: "Marker swipe",
  description: "A highlighter pen swiping behind the words: a light pass while checking, a firm swipe over the selection, and a fresh stroke on what changed that dries away.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "highlighter", "marker", "pen", "caret", "selection"],
  controls: [...commonControls("#FFD23F", { checkMs: 420, selectMs: 220 }), numberControl("markAlpha", 0.55, 0, 1, "Marker opacity", 0.01), numberControl("markTop", 0.38, 0, 0.9, "Marker top", 0.01)],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 1,
      layers: [{ type: "fill", top: "{{markTop}}", height: 0.56, padX: 2, radius: 3, alpha: 0.3, blend: "multiply", reveal: track([[0, 0], [0.6, 1]], "ease-out"), erase: track([[0.45, 0], [1, 1]], "ease-in") }],
    },
    selecting: {
      duration: "{{selectMs}}",
      perPixel: 0.5,
      layers: [{ type: "fill", top: "{{markTop}}", height: 0.56, padX: 2, radius: 3, alpha: "{{markAlpha}}", blend: "multiply", reveal: track([[0, 0], [1, 1]], "ease-out") }, ...caretLayers()],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", top: "{{markTop}}", height: 0.56, padX: 2, radius: 3, alpha: "{{markAlpha}}", blend: "multiply" }, { type: "ghost" }, ...caretLayers()],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [{ type: "fill", top: "{{markTop}}", height: 0.56, padX: 2, radius: 3, alpha: "{{markAlpha}}", blend: "multiply", opacity: holdThenFade(0.5) }],
    },
  },
  presets: [
    { name: "Yellow", values: { color: [1, 210 / 255, 63 / 255] } },
    { name: "Pink", values: { color: [1, 122 / 255, 182 / 255] } },
    { name: "Mint", values: { color: [102 / 255, 230 / 255, 168 / 255] } },
    { name: "Full height", values: { markTop: 0, markAlpha: 0.4 } },
  ],
};

/** Glow underline: from `swoosh-underline` (a glowing stroke sweeping on) and `cursor-glow` (a soft light at the pointer). */
export const glowUnderline: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "glow-underline",
  name: "Glow underline",
  description: "A glowing underline sweeping on beneath the words being checked and wiping away from its tail, a lit underline under the selection, and a glowing caret.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "underline", "glow", "neon", "caret", "selection"],
  controls: [...commonControls("#5B8CFF", { checkMs: 520 }), numberControl("glow", 6, 0, 16, "Glow (px)", 0.5), numberControl("thickness", 0.1, 0.04, 0.3, "Thickness", 0.01)],
  stages: {
    caret: caretStage({ glow: "{{glow}}" }),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 1,
      layers: [{ type: "fill", top: 0.9, height: "{{thickness}}", radius: 2, glow: "{{glow}}", reveal: track([[0, 0], [0.6, 1]], "ease-out"), erase: track([[0.4, 0], [1, 1]], "ease-in-out") }],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [
        { type: "fill", alpha: 0.12, radius: 2, reveal: track([[0, 0], [1, 1]], "ease-out") },
        { type: "fill", top: 0.9, height: "{{thickness}}", radius: 2, glow: "{{glow}}", reveal: track([[0, 0], [1, 1]], "ease-out") },
        ...caretLayers({ glow: "{{glow}}" }),
      ],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", top: 0.9, height: "{{thickness}}", radius: 2, glow: "{{glow}}" }, { type: "ghost" }, ...caretLayers({ glow: "{{glow}}" })],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [
        { type: "fill", alpha: 0.14, radius: 2, opacity: holdThenFade(0.4) },
        { type: "fill", top: 0.9, height: "{{thickness}}", radius: 2, glow: "{{glow}}", opacity: holdThenFade(0.6) },
      ],
    },
  },
  presets: [
    { name: "Blue", values: { color: [91 / 255, 140 / 255, 1] } },
    { name: "Hot pink", values: { color: [1, 64 / 255, 160 / 255] } },
    { name: "Gold", values: { color: [1, 196 / 255, 64 / 255] } },
    { name: "No glow", values: { glow: 0, thickness: 0.08 } },
  ],
};

/** Two passes of a glint across the range (keys at the same progress jump it back to the start). */
const twoPasses = track([[0, 0], [0.5, 1], [0.5, 0], [1, 1]], "ease-in-out");

/**
 * Shimmer: a loading skeleton, from `skeleton-shimmer`, `shine-sweep` and
 * `animated-badge`'s shimmer. The words sit on rounded pills while a bright
 * glint streaks across them twice, behind the text so it stays legible.
 */
export const shimmer: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "shimmer",
  name: "Shimmer",
  description: "A loading skeleton: the words sit on rounded pills while a bright glint streaks across them twice as they are checked, a pill selection, and a last glint across what changed.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "shimmer", "skeleton", "shine", "loading", "pill", "caret", "selection"],
  controls: [
    ...commonControls("#64748B", { checkMs: 1100 }),
    numberControl("base", 0.2, 0, 0.6, "Pill tint", 0.01),
    numberControl("shine", 0.9, 0, 1, "Glint", 0.01),
    colorControl("light", "#FFFFFF", "Glint colour"),
  ],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 0.5,
      layers: [
        { type: "fill", alpha: "{{base}}", radius: 999, padX: 4, padY: -1, opacity: track([[0, 0], [0.1, 1], [0.9, 1], [1, 0]]) },
        { type: "band", color: "{{light}}", alpha: "{{shine}}", width: 0.12, widthPx: 22, padX: 4, padY: -1, radius: 999, position: twoPasses },
      ],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [{ type: "fill", alpha: "{{base}}", radius: 999, padX: 4, padY: -1, reveal: track([[0, 0], [1, 1]], "ease-out") }, ...caretLayers()],
    },
    typing: {
      duration: 900,
      loop: true,
      layers: [
        { type: "cover" },
        { type: "fill", z: "above", alpha: "{{base}}", radius: 999, padX: 4, padY: -1 },
        { type: "band", z: "above", color: "{{light}}", alpha: "{{shine}}", width: 0.3, widthPx: 14, padX: 4, padY: -1, radius: 999, position: track([[0, 0], [1, 1]], "ease-in-out") },
        { type: "ghost" },
        ...caretLayers(),
      ],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [
        { type: "fill", alpha: "{{base}}", radius: 999, padX: 4, padY: -1, opacity: holdThenFade(0.5) },
        { type: "band", color: "{{light}}", alpha: "{{shine}}", width: 0.2, widthPx: 18, padX: 4, padY: -1, radius: 999, position: track([[0, 0], [0.5, 1]], "ease-in-out") },
      ],
    },
  },
  presets: [
    { name: "Slate", values: { color: [100 / 255, 116 / 255, 139 / 255] } },
    { name: "Violet", values: { color: [139 / 255, 124 / 255, 246 / 255], base: 0.22 } },
    { name: "Dark theme", values: { color: [148 / 255, 163 / 255, 184 / 255], base: 0.28, light: [226 / 255, 232 / 255, 240 / 255], shine: 0.55 } },
  ],
};

/** Scan: from `scanline-sweep`, a bright line with a fading trail. */
export const scanLine: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "scan-line",
  name: "Scan line",
  description: "A bright scanning line with a fading trail passing over the words being checked, a scanned selection, and a final pass over what changed.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "scan", "scanner", "line", "trail", "tech", "caret", "selection"],
  controls: [...commonControls("#22D3A6", { checkMs: 460 }), numberControl("trail", 0.35, 0, 1, "Trail", 0.01), numberControl("glow", 4, 0, 12, "Glow (px)", 0.5)],
  stages: {
    caret: caretStage({ glow: "{{glow}}" }),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 1.2,
      layers: [{ type: "band", padY: 1, width: "{{trail}}", widthPx: 3, glow: "{{glow}}", stops: [[0, 0], [0.85, 0.35], [0.97, 1], [1, 1]], position: track([[0, 0], [1, 1]], "linear") }],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [
        { type: "fill", alpha: 0.18, padY: 1, reveal: track([[0, 0], [1, 1]], "linear") },
        { type: "band", padY: 1, width: 0, widthPx: 3, glow: "{{glow}}", stops: [[0, 1], [1, 1]], position: track([[0, 0], [1, 1]], "linear"), opacity: track([[0, 1], [0.9, 1], [1, 0]]) },
        ...caretLayers({ glow: "{{glow}}" }),
      ],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", alpha: 0.14, padY: 1 }, { type: "ghost" }, ...caretLayers({ glow: "{{glow}}" })],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [
        { type: "fill", alpha: 0.16, padY: 1, opacity: holdThenFade(0.5) },
        { type: "band", padY: 1, width: "{{trail}}", widthPx: 3, glow: "{{glow}}", stops: [[0, 0], [0.85, 0.35], [0.97, 1], [1, 1]], position: track([[0, 0], [0.5, 1]], "linear") },
      ],
    },
  },
  presets: [
    { name: "Mint", values: { color: [34 / 255, 211 / 255, 166 / 255] } },
    { name: "Hologram", values: { color: [0.3, 0.85, 1], glow: 8 } },
    { name: "Barcode red", values: { color: [1, 0.2, 0.25], trail: 0.15, glow: 2 } },
  ],
};

/** Presence: from `presence-cursors` (collaborators' cursors with name tags) and `typewriter`'s blinking caret. */
export const presence: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "presence",
  name: "Presence",
  description: "A collaborator's presence, as in a shared document: a caret with a coloured name tag, an outline pulsing round what is being checked, and a selection and change tint in the collaborator's colour.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "collaboration", "multiplayer", "cursor", "name-tag", "caret", "selection"],
  controls: [...commonControls("#F2555A", { checkMs: 900 }).map((c) => (c.name === "blink" ? { ...c, default: true } : c))],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      layers: [
        { type: "fill", stroke: 1.5, padX: 2, padY: 1, radius: 3, opacity: track([[0, 0], [0.2, 1], [0.5, 0.45], [0.8, 1], [1, 0]], "ease-in-out") },
        { type: "fill", alpha: 0.08, padX: 2, padY: 1, radius: 3, opacity: track([[0, 0], [0.2, 1], [0.8, 1], [1, 0]]) },
      ],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [{ type: "fill", alpha: 0.25, radius: 1, opacity: track([[0, 0], [1, 1]], "ease-out") }, ...caretLayers()],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", alpha: 0.15, radius: 1 }, { type: "ghost" }, ...caretLayers()],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [{ type: "fill", alpha: 0.22, radius: 1, opacity: holdThenFade(0.55) }, ...caretLayers({}, track([[0, 1], [0.7, 1], [1, 0]]))],
    },
  },
  presets: [
    { name: "Coral", values: { color: [242 / 255, 85 / 255, 90 / 255] } },
    { name: "Indigo", values: { color: [94 / 255, 92 / 255, 230 / 255] } },
    { name: "Green", values: { color: [52 / 255, 199 / 255, 89 / 255] } },
    { name: "Steady", values: { blink: false } },
  ],
};

/** Selection frame: from `selection-frame`, a design tool's selection box with corner handles. */
export const designFrame: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "design-frame",
  name: "Design frame",
  description: "A design tool's selection: a thin box with square corner handles tracing round what is checked and selected, and the box lingering round what changed before it fades.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "design-tool", "selection", "frame", "handles", "outline", "caret"],
  controls: [...commonControls("#0D99FF", { checkMs: 520 }), numberControl("handle", 6, 3, 12, "Handle (px)", 0.5)],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      layers: [
        { type: "fill", stroke: 1, padX: 3, padY: 2, reveal: track([[0, 0], [0.5, 1]], "ease-out"), opacity: track([[0, 1], [0.75, 1], [1, 0]]) },
        { type: "handles", padX: 3, padY: 2, width: "{{handle}}", opacity: track([[0, 0], [0.4, 0], [0.5, 1], [0.75, 1], [1, 0]]) },
      ],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [
        { type: "fill", alpha: 0.12, padX: 3, padY: 2, opacity: track([[0, 0], [1, 1]], "ease-out") },
        { type: "fill", z: "above", stroke: 1, padX: 3, padY: 2, opacity: track([[0, 0], [1, 1]], "ease-out") },
        { type: "handles", padX: 3, padY: 2, width: "{{handle}}", opacity: track([[0, 0], [1, 1]], "ease-out") },
        ...caretLayers(),
      ],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [{ type: "cover" }, { type: "fill", z: "above", stroke: 1, padX: 3, padY: 2 }, { type: "ghost" }, ...caretLayers()],
    },
    landed: {
      duration: "{{landMs}}",
      layers: [
        { type: "fill", alpha: 0.1, padX: 3, padY: 2, opacity: holdThenFade(0.5) },
        { type: "fill", z: "above", stroke: 1, padX: 3, padY: 2, opacity: holdThenFade(0.5) },
        { type: "handles", padX: 3, padY: 2, width: "{{handle}}", opacity: holdThenFade(0.4) },
      ],
    },
  },
  presets: [
    { name: "Blue", values: { color: [13 / 255, 153 / 255, 1] } },
    { name: "Magenta", values: { color: [0.9, 0.2, 0.75] } },
    { name: "Large handles", values: { handle: 9 } },
  ],
};

/**
 * The curl's curve, across the changed text's line (x as a share of its width, y of its height):
 * a thin tail in along the baseline, a small loop, then down and up into an arc that hooks over
 * at the end of the word, as a swash flourish does.
 */
const CURL: readonly (readonly [number, number])[] = [
  [0, 0.8],
  [0.18, 0.86],
  [0.36, 0.74],
  [0.44, 0.42],
  [0.49, 0.18],
  [0.41, -0.06],
  [0.34, 0.1],
  [0.28, 0.26],
  [0.4, 0.58],
  [0.5, 0.76],
  [0.57, 0.9],
  [0.65, 0.92],
  [0.71, 0.66],
  [0.77, 0.4],
  [0.83, -0.12],
  [0.91, -0.14],
  [0.97, -0.16],
  [1.01, -0.02],
  [0.99, 0.18],
];

/** The curl's own width, in line heights: it keeps this shape on any word, scaled down to fit a short one. */
const CURL_ASPECT = 3.2;

/** Where the curl goes under the letters: its tail along the baseline, and the downstroke after the loop (the loop and the rising arc stay over them). */
const CURL_UNDER: readonly (readonly [number, number])[] = [
  [0, 0.27],
  [0.5, 0.66],
];

/** A short wisp trailing the caret while it types. */
const WISP: readonly (readonly [number, number])[] = [
  [-2.2, 1.05],
  [-1.5, 1.25],
  [-0.6, 1.1],
  [0, 0.85],
];

/** Draws on over the first part of the stage. */
const drawOn = track([[0, 0], [0.4, 1]], "ease-out");

/** The frost rises as the ribbon fades, then melts away from the tail. */
const frostIn = track([[0, 0], [0.5, 0], [0.62, 1], [1, 0]], "ease-in-out");
const frostErase = track([[0.62, 0], [1, 1]], "ease-in");

/**
 * Ribbon curl: when an edit lands, a translucent ribbon sweeps across the new
 * word from a thin tail, loops once and swells into an arc that hooks over at
 * its end, staying on the word and weaving through it (under the letters
 * along the baseline and on the downstroke, over them on the loop and the
 * arc), shedding sparkles; then it dissolves into
 * frost that melts away. Frost is pale blue on light pages; `darkTheme`
 * swaps in a glowing lilac frost that reads on dark ones.
 */
export const ribbonCurl: TextTreatmentEffect = {
  kind: "text-treatment",
  id: "ribbon-curl",
  name: "Ribbon curl",
  description: "A translucent gradient swash woven through what changed: a thin tail runs under the letters, loops over them and swells into an arc that hooks over the end of the word, shedding sparkles, then dissolves into frost; a wisp of it trails the caret while typing.",
  category: "treatment",
  tags: ["agent", "writing", "edit", "ribbon", "swoosh", "curl", "flourish", "gradient", "sparkle", "frost", "caret"],
  controls: [
    ...commonControls("#8B5CF6", { landMs: 1900 }),
    colorControl("tail", "#FFB38A", "Tail colour"),
    colorControl("mid", "#F472B6", "Middle colour"),
    numberControl("ribbonWidth", 0.17, 0.05, 0.5, "Ribbon width", 0.01),
    numberControl("ribbonAlpha", 0.7, 0.2, 1, "Ribbon opacity", 0.01),
    numberControl("sparkles", 12, 0, 40, "Sparkles", 1),
    { name: "darkTheme", type: "bool", default: false, label: "Dark theme" },
    colorControl("frost", "#DCE4FF", "Frost (light)"),
    colorControl("frostDark", "#B9A6FF", "Frost (dark)"),
  ],
  stages: {
    caret: caretStage(),
    checking: {
      duration: "{{checkMs}}",
      perPixel: 1.2,
      layers: [{ type: "band", color: "{{mid}}", alpha: 0.24, padX: 2, padY: -1, radius: 3, width: 0.35, position: track([[0, 0], [1, 1]], "ease-in-out") }],
    },
    selecting: {
      duration: "{{selectMs}}",
      layers: [{ type: "fill", alpha: 0.18, radius: 2, reveal: track([[0, 0], [1, 1]], "ease-out") }, ...caretLayers()],
    },
    typing: {
      duration: 1060,
      loop: true,
      layers: [
        { type: "cover" },
        { type: "fill", z: "above", padX: 1, alpha: 0.1, radius: 2 },
        { type: "ghost" },
        { type: "ribbon", points: WISP, width: 0.1, taper: 0.05, alpha: 0.45, colorStops: [[0, "{{tail}}"], [1, "{{mid}}"]], opacity: track([[0, 0.8], [0.5, 1], [1, 0.8]], "ease-in-out") },
        ...caretLayers(),
      ],
    },
    landed: {
      duration: "{{landMs}}",
      reduced: { at: 0.45, fade: "in-out" },
      layers: [
        { type: "fill", alpha: 0.12, radius: 2, opacity: holdThenFade(0.5) },
        { type: "ribbon", anchor: "range", aspect: CURL_ASPECT, behind: CURL_UNDER, unless: "{{darkTheme}}", points: CURL, color: "{{frost}}", alpha: 0.5, width: 0.3, taper: 0.15, glow: 0.12, reveal: drawOn, erase: frostErase, opacity: frostIn },
        { type: "ribbon", anchor: "range", aspect: CURL_ASPECT, behind: CURL_UNDER, if: "{{darkTheme}}", points: CURL, color: "{{frostDark}}", alpha: 0.45, width: 0.32, taper: 0.15, glow: 0.2, blend: "screen", reveal: drawOn, erase: frostErase, opacity: frostIn },
        {
          type: "ribbon",
          anchor: "range",
          aspect: CURL_ASPECT,
          behind: CURL_UNDER,
          points: CURL,
          alpha: "{{ribbonAlpha}}",
          width: "{{ribbonWidth}}",
          taper: 0.08,
          endTaper: 0.12,
          glow: 0.05,
          colorStops: [[0, "{{tail}}", 0], [0.18, "{{tail}}", 0.7], [0.45, "{{mid}}"], [1, "{{color}}"]],
          reveal: drawOn,
          opacity: track([[0, 1], [0.5, 1], [0.72, 0]], "ease-in"),
        },
        { type: "ribbon", anchor: "range", aspect: CURL_ASPECT, behind: CURL_UNDER, points: CURL, color: "#ffffff", alpha: 0.35, width: 0.05, taper: 0.3, endTaper: 0.2, reveal: drawOn, opacity: track([[0, 1], [0.45, 1], [0.65, 0]], "ease-in") },
        { type: "sparkles", anchor: "range", aspect: CURL_ASPECT, behind: CURL_UNDER, points: CURL, color: "{{mid}}", alpha: 0.85, glow: 0.05, count: "{{sparkles}}", spread: 0.55, drift: 0.3, size: 0.09, reveal: drawOn, opacity: track([[0, 1], [0.6, 1], [1, 0]]) },
        { type: "sparkles", anchor: "range", aspect: CURL_ASPECT, behind: CURL_UNDER, points: CURL, color: "#ffffff", alpha: 1, glow: 0.07, count: 8, seed: 1, spread: 0.7, drift: 0.2, size: 0.07, reveal: drawOn, opacity: track([[0, 1], [0.55, 1], [0.9, 0]]) },
      ],
    },
  },
  presets: [
    { name: "Sunset", values: { tail: [1, 179 / 255, 138 / 255], mid: [244 / 255, 114 / 255, 182 / 255], color: [139 / 255, 92 / 255, 246 / 255] } },
    { name: "Ocean", values: { tail: [125 / 255, 211 / 255, 252 / 255], mid: [56 / 255, 189 / 255, 248 / 255], color: [79 / 255, 70 / 255, 229 / 255] } },
    { name: "Dark theme", values: { darkTheme: true } },
    { name: "Dark ocean", values: { darkTheme: true, tail: [125 / 255, 211 / 255, 252 / 255], mid: [56 / 255, 189 / 255, 248 / 255], color: [129 / 255, 140 / 255, 248 / 255], frostDark: [147 / 255, 197 / 255, 253 / 255] } },
  ],
};

/** The catalog's text treatments, the default first. */
export const textTreatments: readonly TextTreatmentEffect[] = [softSweep, markerSwipe, glowUnderline, shimmer, scanLine, presence, designFrame, ribbonCurl];

/** A catalog text treatment by id, or undefined. */
export function getTextTreatment(id: string): TextTreatmentEffect | undefined {
  return textTreatments.find((e) => e.id === id);
}
