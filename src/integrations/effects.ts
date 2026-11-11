/**
 * Flair as an effects provider for `@pixerate/editor`'s editors: `flairEffects()`
 * implements the editor's `EffectProvider` contract (`@pixerate/editor/effects`)
 * over the lazy catalog, so an editor can list, search, describe and render
 * Flair's shaders, draw its vector effects, and apply its motion primitives
 * to vector art, without depending on Flair itself.
 */

import {
  applyEffectMask,
  EffectDisposedError,
  isCameraView,
  sampleCameraViews,
  EffectUnsupportedError,
  isEffectPixels,
  resolveEffectValues,
  searchEffectSummaries,
  searchTemplateSummaries,
  UnknownEffectError,
  UnknownTemplateError,
  type CameraMoveContext,
  type CameraMoveSample,
  type CameraMoveSampleRequest,
  type CameraView,
  type EffectAuthoringSession,
  type EffectAuthoringSource,
  type EffectDescription,
  type EffectImageSource,
  type EffectInputSpec,
  type EffectKind,
  type EffectPixels,
  type EffectPreset,
  type EffectProvider,
  type EffectProviderCapabilities,
  type EffectRenderer,
  type EffectRendererOptions,
  type EffectRenderRequest,
  type EffectSearchOptions,
  type EffectSummary,
  type EffectTemplateDescription,
  type EffectTemplateOptions,
  type EffectTemplateResult,
  type EffectTemplateSearchOptions,
  type EffectTemplateSummary,
  type EffectTemplateValues,
  type EffectUse,
  type EffectValues,
  type EffectVectorMotion,
  type EffectVectorTarget,
  type TimingSample,
  type TimingSampleRequest,
} from "@pixerate/editor/effects";
import { cameraMoveControls, getCameraMove } from "../catalog/camera.js";
import { getTimingEffect, timingControls, timingSample as flairTimingSample, MAX_TIMING_FRAMES } from "../catalog/timing.js";
import { EFFECT_META, loadEffect, type EffectMeta } from "../catalog/lazy.js";
import { renderVectorEffect, type EffectDefinition, type ShaderEffect, type VectorEffect } from "../catalog/types.js";
import { applyPrimitive } from "../motion/apply.js";
import { getPrimitive, PRIMITIVES } from "../motion/library.js";
import type { PrimitiveDescriptor, PrimitiveParam } from "../motion/types.js";
import { BACKGROUND_OPACITY_CONTROL } from "../shader/background.js";
import { checkControlValue, rgbToHex, type ControlDef, type ControlValue } from "../shader/controls.js";
import { ShaderPipeline, type FloatPicture, type PassInput, type PipelineFormat } from "../shader/pipeline.js";
import { srgbToLinear } from "../shader/color.js";
import { controlsSchema, JSON_SCHEMA_DIALECT, type JsonSchema } from "../shader/schema.js";
import type { LiveSource } from "../shader/textures.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgDuration, svgView } from "../vector/svg.js";
import { instantiateTemplate as fillTemplate, type SceneTemplate, type TemplateValues } from "../scene/template.js";
import { pathTrail } from "./path-trail.js";
import { sequenceOf, templateDescriptionOf, templateSummaryOf } from "./templates.js";

/** Draws one frame of an animated SVG as pixels (see {@link FlairEffectsOptions.rasterizeSvg}). */
export type SvgRasterizer = (motion: SvgMotion, timeMs: number, size: { width: number; height: number }) => Promise<EffectPixels>;

export interface FlairEffectsOptions {
  /**
   * The kinds of effect to offer (default all): `shader`, `vector` (animated SVGs), `motion`
   * (primitives applied to vector art), `camera` (camera moves for a scene's shots, which
   * need `@pixerate/editor` 0.224 or later) and `timing` (retimes of video footage, which need
   * 0.254 or later). Leave out what an older editor does not know.
   */
  kinds?: readonly EffectKind[];
  /**
   * Draws vector effects as pixels for `createRenderer`. On a page Flair
   * draws them itself; a Worker has no DOM to lay an SVG out in, so there
   * vector effects only render with one of your own (or use
   * `applyVectorEffect` to get the animated SVG instead).
   */
  rasterizeSvg?: SvgRasterizer;
}

declare const __FLAIR_VERSION__: string | undefined;

/** The provider's id, saved next to effect ids. */
export const FLAIR_PROVIDER_ID = "flair";

/**
 * How an effect paints, as `flairEffects()` gives it on summaries and descriptions (`paint`), for
 * an editor that brushes with effects. Only effects that make good paint have one: with the
 * provider's `paintHints` capability, an effect without one is not meant as paint.
 * - `map`: `path` (the effect draws along the stroke, given its centreline as the path control
 *   `pathControlsOf` names), `stroke` (rendered into a strip bent along the stroke) or `canvas`
 *   (fixed to the canvas; strokes uncover it).
 * - `colors`: up to two colour controls the brush's main and second colours fill, main first.
 * - `values`: values to apply over the defaults when painting (contract values: colours as hex).
 * - `live`: whether a stroke keeps playing the effect.
 * - `repeat`: for `stroke`, past the end of the strip (`repeat`, `mirror` or `clamp`).
 * - `size`: a suggested brush width (px), when it has one.
 */
export interface EffectPaint {
  map: "path" | "stroke" | "canvas";
  colors: readonly string[];
  values: EffectValues;
  live: boolean;
  repeat?: "repeat" | "mirror" | "clamp";
  size?: number;
}

/** A Flair summary: the contract's, with its paint hint when the effect makes good paint. */
export type FlairEffectSummary = EffectSummary & { paint?: EffectPaint };

/** A Flair description: the contract's, with its paint hint when the effect makes good paint. */
export type FlairEffectDescription = EffectDescription & { paint?: EffectPaint };

/**
 * Flair's capabilities: the contract's, and `paintHints` (effects that make good paint say how
 * with `paint`, and those without one are not meant as paint).
 */
export type FlairEffectProviderCapabilities = EffectProviderCapabilities & { paintHints: true };

/** The provider `flairEffects()` returns: an `EffectProvider` whose summaries and descriptions carry paint hints. */
export type FlairEffectProvider = Omit<EffectProvider, "capabilities" | "list" | "search" | "describe"> & {
  readonly capabilities: FlairEffectProviderCapabilities;
  list(options?: EffectSearchOptions): FlairEffectSummary[];
  search(query: string, options?: EffectSearchOptions): FlairEffectSummary[];
  describe(id: string): Promise<FlairEffectDescription>;
};

// ---------------------------------------------------------------------------
// The catalog as the contract sees it
// ---------------------------------------------------------------------------

/** Categories whose effects are type or a graphic meant as a title. */
const TITLE_CATEGORIES = new Set(["text", "broadcast"]);

/** A transition's uniforms the contract drives itself (`progress`), so they are not controls. */
const TRANSITION_DRIVEN = new Set(["uAnimate", "uProgress"]);

/** Where an input of the contract goes: the image control (sampler) it fills. */
interface InputBinding extends EffectInputSpec {
  uniform: string;
}

/** What it takes to describe and render one catalog effect. */
export interface Plan {
  meta: EffectMeta;
  uses: EffectUse[];
  inputs: InputBinding[];
  /** The controls the contract shows: the effect's, less its image inputs and what the contract drives. */
  controls: ControlDef[];
  transition: boolean;
}

function wantsText(wants: string): string {
  if (wants === "mask") return "a shape whose transparency the effect uses (an icon, a logo, a word)";
  if (wants === "text") return "rendered words on transparency";
  return "a picture";
}

/** How the contract sees a catalog effect: its uses, the image controls its inputs fill, and the controls it shows. */
export function planOf(meta: EffectMeta): Plan {
  // A camera move draws no picture: it has no inputs (its preview picture is Flair's own) and only the use "camera".
  const move = meta.kind === "camera" ? getCameraMove(meta.id) : undefined;
  if (move) return { meta, uses: ["camera"], inputs: [], controls: cameraMoveControls(move), transition: false };
  // A timing effect retimes footage the host decodes: it has no inputs and only the use "timing".
  const retime = meta.kind === "timing" ? getTimingEffect(meta.id) : undefined;
  if (retime) return { meta, uses: ["timing"], inputs: [], controls: timingControls(retime), transition: false };
  const transition = meta.video === "transition";
  const uses = new Set<EffectUse>();
  const images = meta.inputs.images;
  const firstPicture = images.find((i) => i.wants === "picture");
  if (transition) uses.add("transition");
  else if (meta.video === "filter" || meta.video === "stills" || meta.video === "interactive") uses.add("filter");
  if (meta.video === "interactive" || meta.inputs.interactions.length || meta.category === "audio") uses.add("interactive");
  if (TITLE_CATEGORIES.has(meta.category) || images.some((i) => i.wants === "text")) uses.add("title");
  if (meta.transparent || meta.kind === "vector") uses.add("overlay");
  if (!uses.size || (!uses.has("filter") && !uses.has("transition") && !uses.has("title") && meta.kind === "shader" && !meta.transparent)) uses.add("generator");

  const inputs: InputBinding[] = images.map((slot) => {
    if (transition && slot.name === "uFrom") return { uniform: slot.name, name: "from", kind: "image", required: true, description: "The picture the transition starts from." };
    if (transition && slot.name === "uTo") return { uniform: slot.name, name: "to", kind: "image", required: true, description: "The picture the transition ends on." };
    if (uses.has("filter") && slot === firstPicture) return { uniform: slot.name, name: "source", kind: "image", required: true, description: `The picture the effect changes (${slot.label}).` };
    return {
      uniform: slot.name,
      name: slot.name,
      kind: "image",
      required: false,
      description: `${slot.label}: ${wantsText(slot.wants)}. Without it the effect shows its own sample.`,
    };
  });
  return withControls({ meta, uses: [...uses], inputs, controls: [], transition }, meta.controls);
}

/**
 * The plan with the effect's controls as they are now (after its source
 * changed, while authoring): the contract shows them less the image inputs
 * and what the contract drives.
 */
export function withControls(plan: Plan, controls: readonly ControlDef[]): Plan {
  const bound = new Set(plan.inputs.map((i) => i.uniform));
  return { ...plan, controls: controls.filter((c) => !bound.has(c.name) && c.type !== "sampler2D" && !(plan.transition && TRANSITION_DRIVEN.has(c.name))) };
}

/**
 * How long one play of a shader that moves but never repeats is said to last (ms): the contract
 * gives an effect that changes over time a `duration`, and editors size a clip or an animation
 * from it.
 */
export const ENDLESS_PLAY_MS = 4000;

/** The effect's play (ms): its loop, a vector picture's length, else `ENDLESS_PLAY_MS` for a shader that moves. */
function playOf(meta: EffectMeta): number | undefined {
  if (meta.duration !== undefined && meta.duration > 0) return meta.duration;
  return meta.kind === "shader" && meta.animated ? ENDLESS_PLAY_MS : undefined;
}

/** The plan's paint hint as the contract gives it, when the effect has one and its controls are still the hint's. */
export function paintOf(plan: Plan): EffectPaint | undefined {
  const hint = plan.meta.paint;
  if (!hint) return undefined;
  const controls = new Map(plan.controls.map((c) => [c.name, c]));
  const named = [...(hint.colors ?? []), ...Object.keys(hint.values ?? {})];
  if (!named.every((name) => controls.has(name)) || (hint.map === "path" && !plan.controls.some((c) => c.type === "path"))) return undefined;
  return {
    map: hint.map,
    colors: [...(hint.colors ?? [])],
    values: Object.fromEntries(Object.entries(hint.values ?? {}).map(([name, value]) => [name, contractValue(controls.get(name)!, value)])) as EffectValues,
    live: hint.live ?? false,
    ...(hint.map === "stroke" && { repeat: hint.repeat ?? "mirror" }),
    ...(hint.size !== undefined && { size: hint.size }),
  };
}

export function summaryOf(plan: Plan): FlairEffectSummary {
  const { meta } = plan;
  const paint = paintOf(plan);
  const duration = playOf(meta);
  const move = meta.kind === "camera" ? getCameraMove(meta.id) : undefined;
  const background = plan.controls.find((c) => c.name === BACKGROUND_OPACITY_CONTROL && c.type === "float");
  return {
    id: meta.id,
    name: meta.name,
    kind: meta.kind,
    category: meta.category,
    uses: plan.uses,
    description: meta.description,
    tags: meta.tags,
    transparent: meta.kind === "vector" || Boolean(meta.transparent),
    loop: meta.kind === "vector" ? !meta.trigger : meta.kind !== "timing" && meta.loop !== undefined,
    ...(duration !== undefined && { duration }),
    ...(background && { backgroundOpacity: background.name }),
    // Effects that draw along a path given at run time say so, for search.
    ...(plan.controls.some((c) => c.type === "path") && { accepts: ["path"] as const }),
    ...(move && { camera: { role: move.motion.role, durationMs: move.motion.duration, ...(move.motion.cut !== undefined && { cut: move.motion.cut }) } }),
    ...(paint && { paint }),
  };
}

function primitiveSummary(p: PrimitiveDescriptor): EffectSummary {
  return {
    id: p.id,
    name: p.name,
    kind: "motion",
    category: p.kind,
    uses: ["motion"],
    description: p.description,
    tags: ["motion", p.kind],
    transparent: false,
    loop: false,
    duration: p.ms,
  };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A colour value as the contract writes colours: `#rrggbb`, or `#rrggbbaa` with alpha below 1. */
function hex(value: ControlValue): ControlValue {
  if (!Array.isArray(value)) return value;
  const alpha = value.length === 4 && value[3]! < 1 ? Math.round(Math.min(1, Math.max(0, value[3]!)) * 255).toString(16).padStart(2, "0") : "";
  return rgbToHex(value) + alpha;
}

/** A control value as the contract shows it: colours as hex. */
export function contractValue(control: ControlDef, value: ControlValue): ControlValue {
  return control.color ? hex(value) : value;
}

export function controlSchemaOf(plan: Plan): EffectDescription["controls"] {
  const schema = controlsSchema(plan.controls, { title: `${plan.meta.name} controls`, description: plan.meta.description, currentColor: plan.meta.kind === "vector" });
  for (const control of plan.controls) {
    if (control.color) schema.properties![control.name] = { ...schema.properties![control.name], default: hex(control.default) };
  }
  return schema as unknown as EffectDescription["controls"];
}

/** Contract values (checked against the schema) as Flair's: CSS colours become channels. */
export function flairValues(controls: readonly ControlDef[], values: Record<string, unknown>): Record<string, ControlValue> {
  const out: Record<string, ControlValue> = {};
  for (const control of controls) {
    const value = values[control.name];
    if (value === undefined) continue;
    if (control.color && typeof value === "string" && value.trim().toLowerCase() === "currentcolor") {
      out[control.name] = value;
      continue;
    }
    const checked = checkControlValue(control, value);
    out[control.name] = checked.ok ? checked.value : (value as ControlValue);
  }
  return out;
}

function primitiveParamSchema(param: PrimitiveParam): JsonSchema {
  const unit = param.unit ? ` in ${param.unit}` : "";
  const about = param.description ? ` ${param.description.replace(/\.?$/, ".")}` : "";
  const def = JSON.stringify(param.default);
  switch (param.type) {
    case "float":
    case "int": {
      const range = param.min !== undefined && param.max !== undefined ? ` From ${round(param.min)} to ${round(param.max)}.` : "";
      return {
        type: param.type === "int" ? "integer" : "number",
        title: param.label,
        description: `${param.label}${unit}.${about}${range} Default ${def}.`,
        ...(param.min !== undefined && { minimum: param.min }),
        ...(param.max !== undefined && { maximum: param.max }),
        default: param.default,
      };
    }
    case "bool":
      return { type: "boolean", title: param.label, description: `${param.label}: on or off.${about} Default ${def}.`, default: param.default };
    case "color":
      return { type: "string", title: param.label, description: `${param.label}: a colour, "#rrggbb".${about} Default ${def}.`, pattern: "^#[0-9A-Fa-f]{6}$", default: param.default };
    case "enum":
      return { enum: [...(param.options ?? [])], title: param.label, description: `${param.label}: one of ${(param.options ?? []).join(", ")}.${about} Default ${def}.`, default: param.default };
    default:
      return { type: "string", title: param.label, description: `${param.label}: text.${about} Default ${def}.`, default: param.default };
  }
}

function describePrimitive(p: PrimitiveDescriptor): EffectDescription {
  const controls = {
    $schema: JSON_SCHEMA_DIALECT,
    title: `${p.name} parameters`,
    description: p.description,
    type: "object",
    properties: Object.fromEntries(p.params.map((param) => [param.name, primitiveParamSchema(param)])),
    additionalProperties: false,
  } as unknown as EffectDescription["controls"];
  return {
    ...primitiveSummary(p),
    controls,
    defaults: Object.fromEntries(p.params.map((param) => [param.name, param.default])),
    presets: [],
    inputs: [],
  };
}

/** A catalog effect's description from its plan, with these presets (Flair's values; controls the contract does not show are left out). */
export function describePlan(plan: Plan, presets: readonly { name: string; values: Record<string, ControlValue> }[]): FlairEffectDescription {
  const controls = new Map(plan.controls.map((c) => [c.name, c]));
  return {
    ...summaryOf(plan),
    controls: controlSchemaOf(plan),
    defaults: Object.fromEntries(plan.controls.map((c) => [c.name, contractValue(c, c.default)])) as EffectValues,
    presets: presets.map(
      (preset): EffectPreset => ({
        name: preset.name,
        values: Object.fromEntries(
          Object.entries(preset.values)
            .filter(([name]) => controls.has(name))
            .map(([name, value]) => [name, contractValue(controls.get(name)!, value)]),
        ) as EffectValues,
      }),
    ),
    inputs: plan.inputs.map(({ uniform: _, ...spec }) => spec),
  };
}

// ---------------------------------------------------------------------------
// Pictures in
// ---------------------------------------------------------------------------

/**
 * An input picture as what a pipeline's image control (or mask) takes: a
 * float picture when it has floats (linear light), an `ImageData` for 8-bit
 * pixels, and the host's own image objects as they are.
 */
export function passInput(source: EffectImageSource): Exclude<PassInput, "previous" | "feedback" | { pass: number }> {
  if (isEffectPixels(source)) {
    if (source.float) return { width: source.width, height: source.height, data: source.float } satisfies FloatPicture;
    if (typeof ImageData !== "undefined") return new ImageData(source.data as Uint8ClampedArray<ArrayBuffer>, source.width, source.height);
    return source as unknown as ImageData;
  }
  return source as LiveSource;
}

/** Whether this GPU can render to float textures, asked once of a small context. */
let floatSupport: boolean | undefined;
function canRenderFloat(): boolean {
  if (floatSupport !== undefined) return floatSupport;
  try {
    const canvas: HTMLCanvasElement | OffscreenCanvas | undefined =
      typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : typeof document !== "undefined" ? document.createElement("canvas") : undefined;
    const gl = canvas?.getContext("webgl2") as WebGL2RenderingContext | null | undefined;
    floatSupport = Boolean(gl?.getExtension("EXT_color_buffer_float"));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    floatSupport = false;
  }
  return floatSupport;
}

/** 8-bit pixels decoded to linear light, for a float-depth renderer whose effect is drawn at 8 bits (vector effects). */
function decodedFloat(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = srgbToLinear(data[i]! / 255);
    out[i + 1] = srgbToLinear(data[i + 1]! / 255);
    out[i + 2] = srgbToLinear(data[i + 2]! / 255);
    out[i + 3] = data[i + 3]! / 255;
  }
  return out;
}

/** Elements that hold definitions rather than drawing: nothing inside them is animated. */
const NOT_DRAWN = /^(defs|clipPath|mask|linearGradient|radialGradient|pattern|filter|symbol|marker|style|title|desc|metadata)$/;

/**
 * The SVG element ids an effect applies to: the ones asked for, or each
 * drawn element with an id that is not inside another one (so a group moves
 * as a whole, rather than with each of its parts again). Read from the
 * markup's tags, without a DOM.
 */
function targetIds(svg: string, nodeIds?: readonly string[]): string[] {
  if (nodeIds) return [...nodeIds];
  const ids: string[] = [];
  // For each open element: whether what is inside it is already covered (by an id above it) or not drawn.
  const covered: boolean[] = [];
  for (const [, closing, name, attrs, selfClosing] of svg.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g)) {
    if (closing) {
      covered.pop();
      continue;
    }
    const inside = covered.at(-1) ?? false;
    const id = /\sid\s*=\s*["']([^"']+)["']/.exec(` ${attrs}`)?.[1];
    const root = name === "svg" && covered.length === 0;
    if (id && !root && !inside && !NOT_DRAWN.test(name!)) ids.push(id);
    if (!selfClosing) covered.push(inside || NOT_DRAWN.test(name!) || (Boolean(id) && !root));
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Draws an animated SVG as pixels on a page: laid out off screen (so fonts and sizes resolve), drawn and captured. */
export const pageRasterizer: SvgRasterizer = async (motion, timeMs, { width, height }) => {
  const view = svgView(motion);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  host.appendChild(view.element);
  document.body.appendChild(host);
  try {
    view.draw(timeMs);
    const canvas = await view.capture({ width, height });
    const context = canvas?.getContext("2d");
    if (!context) throw new EffectUnsupportedError("This browser could not draw the vector effect on a canvas.");
    return { width, height, data: context.getImageData(0, 0, width, height).data };
  } finally {
    host.remove();
  }
};

/** A renderer's size and bit depth, checked as `createRenderer` and `createPreview` take them. */
export function rendererSize(id: string, options: EffectRendererOptions, call = "createRenderer"): { width: number; height: number; depth: 8 | 16 | 32 } {
  const width = Math.round(options?.width);
  const height = Math.round(options?.height);
  if (!(width >= 1 && height >= 1)) {
    throw new EffectUnsupportedError(`${call} needs a width and height of at least 1 pixel; got ${options?.width} × ${options?.height}.`, id);
  }
  const depth = options.depth ?? 8;
  if (depth !== 8 && depth !== 16 && depth !== 32) throw new EffectUnsupportedError(`depth is 8, 16 or 32 bits a channel; got ${JSON.stringify(options.depth)}.`, id);
  return { width, height, depth };
}

/** Checks a render request's time and inputs against the plan; throws what the contract throws. */
export function checkRenderRequest(plan: Plan, id: string, request: EffectRenderRequest): void {
  if (!request || typeof request.time !== "number" || !Number.isFinite(request.time)) {
    throw new EffectUnsupportedError(`render needs { time } in ms, a finite number; got ${JSON.stringify(request?.time)}.`, id);
  }
  const given = request.inputs ?? {};
  const names = new Set(plan.inputs.map((i) => i.name));
  for (const name of Object.keys(given)) {
    if (!names.has(name)) {
      throw new EffectUnsupportedError(
        `"${id}" has no input "${name}"; ${plan.inputs.length ? `its inputs are ${plan.inputs.map((i) => `"${i.name}"`).join(", ")}` : "it takes none"}.`,
        id,
      );
    }
  }
  for (const input of plan.inputs) {
    if (input.required && !given[input.name]) throw new EffectUnsupportedError(`"${id}" needs the input "${input.name}": ${input.description}`, id);
  }
}

const FORMATS: Record<8 | 16 | 32, PipelineFormat> = { 8: "rgba8", 16: "rgba16f", 32: "rgba32f" };

/**
 * A pipeline drawing one shader, in floats at depth 16 or 32 where the GPU
 * can render them (8 bits where it cannot; `depth` says which). Throws as
 * `ShaderPipeline` does: a `PassCompileError` when the source does not compile.
 */
export function shaderPipeline(source: string, name: string, width: number, height: number, depth: 8 | 16 | 32): { pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>; depth: 8 | 16 | 32 } {
  const make = (format: PipelineFormat) => new ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>({ passes: [{ source, name }], width, height, alpha: true, format });
  try {
    return { pipeline: make(FORMATS[depth]), depth };
  } catch (e) {
    // A GPU that cannot render to floats gives 8-bit frames, as the contract allows (depth says so).
    if (depth === 8 || !/float/i.test(e instanceof Error ? e.message : "")) throw e;
    return { pipeline: make("rgba8"), depth: 8 };
  }
}

/**
 * Draws one frame of a shader effect: the request's pictures in the plan's
 * image controls, a transition's progress, the mask, and Flair's `values`.
 * `disposed` is asked after the effect's own pictures load.
 */
export async function drawShaderFrame(
  pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>,
  plan: Plan,
  request: EffectRenderRequest,
  values: Record<string, ControlValue>,
  frame: { width: number; height: number; depth: 8 | 16 | 32; duration: number; disposed: () => boolean },
): Promise<EffectPixels> {
  const given = request.inputs ?? {};
  // A trail effect given its path as points draws the whole path as its trail (see path-trail.ts).
  const traced = pathTrail(plan.controls, values, frame.height, request.time / 1000);
  const flair = { ...(traced?.values ?? values) };
  for (const input of plan.inputs) {
    const source = given[input.name];
    pipeline.setInput(0, input.uniform, source ? passInput(source) : null);
    // A picture given needs no URL loaded behind it.
    if (source) flair[input.uniform] = "";
  }
  if (plan.transition) {
    flair.uAnimate = false;
    flair.uProgress = Math.min(1, Math.max(0, request.progress ?? request.time / frame.duration));
  }
  if (request.mask) {
    // Untouched where the mask is 0: the picture the effect changes (a filter's source, a transition's from).
    const untouched = given.source ?? given.from;
    pipeline.setMask({ picture: passInput(request.mask), ...(untouched ? { under: passInput(untouched) } : {}) });
  } else pipeline.setMask(null);
  pipeline.setValues(0, flair);
  // The effect's own sample pictures: a failure shows black where they go rather than failing the frame.
  await pipeline.ready().catch(() => undefined);
  if (frame.disposed()) throw new EffectDisposedError(plan.meta.id);
  pipeline.render(request.time / 1000, traced ? { trail: traced.trail } : {});
  const data = pipeline.readImageData().data;
  return { width: frame.width, height: frame.height, data, ...(frame.depth > 8 ? { float: pipeline.readFloatPixels() } : {}) };
}

/** A rasterised vector frame, masked and at the renderer's depth. */
export function finishVectorFrame(pixels: EffectPixels, id: string, request: EffectRenderRequest, frame: { width: number; height: number; depth: 8 | 16 | 32 }): EffectPixels {
  if (request.mask) {
    // A vector picture has nothing under it: coverage multiplies its alpha, as for any generator.
    if (!isEffectPixels(request.mask) || request.mask.width !== frame.width || request.mask.height !== frame.height) {
      throw new EffectUnsupportedError(`A vector effect's mask is EffectPixels the renderer's size (${frame.width} × ${frame.height}).`, id);
    }
    applyEffectMask(pixels, request.mask);
  }
  return frame.depth > 8 ? { ...pixels, float: decodedFloat(pixels.data) } : pixels;
}

abstract class BaseRenderer implements EffectRenderer {
  abstract readonly depth: 8 | 16 | 32;
  protected disposed = false;

  constructor(
    protected readonly plan: Plan,
    protected readonly description: EffectDescription,
    readonly width: number,
    readonly height: number,
  ) {}

  get effectId(): string {
    return this.plan.meta.id;
  }

  async render(request: EffectRenderRequest): Promise<EffectPixels> {
    if (this.disposed) throw new EffectDisposedError(this.effectId);
    checkRenderRequest(this.plan, this.effectId, request);
    const values = resolveEffectValues(this.description, request.values);
    return this.draw(request, flairValues(this.plan.controls, values));
  }

  protected abstract draw(request: EffectRenderRequest, values: Record<string, ControlValue>): Promise<EffectPixels>;

  dispose(): void {
    this.disposed = true;
  }
}

class ShaderRenderer extends BaseRenderer {
  readonly depth: 8 | 16 | 32;
  private pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>;

  constructor(plan: Plan, description: EffectDescription, effect: ShaderEffect, width: number, height: number, depth: 8 | 16 | 32) {
    super(plan, description, width, height);
    try {
      const made = shaderPipeline(effect.source, effect.id, width, height, depth);
      this.pipeline = made.pipeline;
      this.depth = made.depth;
    } catch (e) {
      throw new EffectUnsupportedError(`"${effect.id}" cannot render here: ${e instanceof Error ? e.message : String(e)}`, effect.id);
    }
  }

  protected draw(request: EffectRenderRequest, values: Record<string, ControlValue>): Promise<EffectPixels> {
    const { width, height, depth } = this;
    return drawShaderFrame(this.pipeline, this.plan, request, values, { width, height, depth, duration: this.plan.meta.duration ?? ENDLESS_PLAY_MS, disposed: () => this.disposed });
  }

  dispose(): void {
    if (!this.disposed) this.pipeline.dispose();
    super.dispose();
  }
}

class VectorRenderer extends BaseRenderer {
  constructor(
    plan: Plan,
    description: EffectDescription,
    private readonly effect: VectorEffect,
    width: number,
    height: number,
    private readonly rasterize: SvgRasterizer,
    readonly depth: 8 | 16 | 32,
  ) {
    super(plan, description, width, height);
  }

  protected async draw(request: EffectRenderRequest, values: Record<string, ControlValue>): Promise<EffectPixels> {
    const motion = renderVectorEffect(this.effect, values);
    const pixels = await this.rasterize(motion, request.time, { width: this.width, height: this.height });
    if (this.disposed) throw new EffectDisposedError(this.effectId);
    return finishVectorFrame(pixels, this.effectId, request, this);
  }
}

// ---------------------------------------------------------------------------
// The provider
// ---------------------------------------------------------------------------

/**
 * Flair's effects for `@pixerate/editor`'s editors, as an `EffectProvider`
 * (`@pixerate/editor/effects`): pass it to an editor's `setEffectsProvider`.
 *
 * - **Catalog:** every shader and vector effect, plus the motion primitives
 *   (`entrance.pop`, `emphasis.wiggle`…) as `motion` effects. Metadata comes
 *   from the lazy catalog; an effect's source loads when it is described or
 *   rendered.
 * - **Uses:** video filters (and stills and interactive effects over a
 *   picture) are `filter`, reading the input `source`; transitions read
 *   `from` and `to` and follow `progress`; overlays, titles, generators and
 *   interactive effects follow from the catalog's categories and inputs.
 *   Other image controls are optional inputs named after their uniform
 *   (`uMask`, `uText`).
 * - **Values:** controls as a strict JSON Schema (see `effectControlSchema`),
 *   colours as `#rrggbb`. Invalid values reject with `invalid_values`.
 * - **Rendering:** shaders render with a `ShaderPipeline`, on a page or in
 *   a Worker, and take `ImageBitmap`, `VideoFrame`, `OffscreenCanvas` or
 *   `EffectPixels` inputs (float ones too). Depth 16 or 32 renders in half
 *   or full floats and returns `float` in linear light (8 bits where the GPU
 *   cannot render to floats; `depth` says which). A mask is composited on
 *   the GPU over the untouched input (`source`, or a transition's `from`),
 *   or multiplies alpha where there is none. Vector effects render on a
 *   page (or with `rasterizeSvg`).
 * - **Vector:** `applyVectorEffect` gives a vector effect's animated SVG
 *   (its own picture, so the target is not used), or applies a motion
 *   primitive to the target's elements (`nodeIds`, or each top-level
 *   element with an id).
 * - **Authoring:** `openAuthoring` opens a shader or vector effect (or a
 *   document saved with `exportDocument`) in Flair's `EffectEditor`, for
 *   the editor's Effect Authoring tab and its agent tools. Shaders edit
 *   their GLSL, with compile errors on the source's lines; vector effects
 *   edit their controls (`sourceLanguage` null). Motion primitives and
 *   camera moves cannot be authored.
 * - **Camera:** the catalog's camera moves are `camera` effects (use
 *   `camera`, with their role, length and cut). `cameraView` gives where a
 *   move puts a scene's camera part-way through it, as Flair's scene player
 *   moves it, and `sampleCameraMove` keys it for an editor to bake. They
 *   draw no picture, so `createRenderer` refuses them.
 * - **Timing:** the catalog's retimes of video footage are `timing` effects
 *   (use `timing`, no inputs, no duration). `timingLength` gives how long a
 *   retime lasts for footage of a length, and `timingSample` the weighted
 *   footage frames one moment shows, as Flair's own players draw them. The
 *   editor decodes and blends the frames, so `createRenderer` refuses them.
 * - **Templates:** `listTemplates`, `describeTemplate` and
 *   `instantiateTemplate` offer Flair's sequence templates. A filled
 *   template comes back as an `EffectSequence`: each shot's framing where
 *   Flair's camera settles, its camera moves, catalog effect layers and
 *   transition. What a sequence cannot carry (custom shaders, element
 *   commands, camera angles, effects not offered under `kinds`) is left
 *   out and named in `notes`, with `validateScene`'s issues.
 */
export function flairEffects(options: FlairEffectsOptions = {}): FlairEffectProvider {
  const kinds = new Set<EffectKind>(options.kinds ?? ["shader", "vector", "motion", "camera", "timing"]);
  const plans = new Map(EFFECT_META.filter((m) => kinds.has(m.kind)).map((m) => [m.id, planOf(m)]));
  const primitives = kinds.has("motion") ? PRIMITIVES : [];
  const summaries: FlairEffectSummary[] = [...[...plans.values()].map(summaryOf), ...primitives.map(primitiveSummary)];
  const descriptions = new Map<string, Promise<FlairEffectDescription>>();
  const inWorker = typeof document === "undefined";
  const rasterize = options.rasterizeSvg ?? (inWorker ? undefined : pageRasterizer);

  const capabilities: FlairEffectProviderCapabilities = {
    supportsWorker: inWorker,
    supportsFloat: kinds.has("shader") && canRenderFloat(),
    supportsMask: true,
    supportsHostImages: true,
    supportsVector: kinds.has("vector") || kinds.has("motion"),
    supportsAuthoring: kinds.has("shader") || kinds.has("vector"),
    supportsCamera: kinds.has("camera"),
    supportsTiming: kinds.has("timing"),
    supportsTemplates: true,
    // Effects that make good paint say how (`paint`); the rest are not meant as paint.
    paintHints: true,
  };

  // Templates (and their summaries, which fill each one to time it) load with the first call that needs them.
  let templates: Promise<{ byId: Map<string, SceneTemplate>; summaries: EffectTemplateSummary[] }> | undefined;
  function loadTemplates() {
    templates ??= import("../catalog/templates.js").then(({ SCENE_TEMPLATES }) => ({
      byId: new Map(SCENE_TEMPLATES.map((t) => [t.id, t])),
      summaries: SCENE_TEMPLATES.map(templateSummaryOf),
    }));
    return templates;
  }
  async function template(id: string): Promise<SceneTemplate> {
    const found = (await loadTemplates()).byId.get(id);
    if (!found) throw new UnknownTemplateError(String(id), "Flair");
    return found;
  }
  const offered = (id: string) => plans.has(id);

  const unknown = (id: string) => new UnknownEffectError(String(id), "Flair");

  /** A catalog effect: its plan, definition and description (loading its source once). */
  async function catalogEffect(id: string): Promise<{ plan: Plan; effect: EffectDefinition; description: EffectDescription }> {
    const plan = plans.get(id);
    if (!plan) throw unknown(id);
    const effect = await loadEffect(id);
    return { plan, effect, description: await describe(id) };
  }

  async function describeCatalog(plan: Plan): Promise<FlairEffectDescription> {
    return describePlan(plan, (await loadEffect(plan.meta.id)).presets ?? []);
  }

  // Camera moves are described synchronously (they are few, and cameraView must not wait), once each.
  const cameraDescriptions = new Map<string, EffectDescription>();

  /** A camera move with its plan and description, or the refusal `cameraView` makes. */
  function cameraMove(id: string, u?: number) {
    const plan = plans.get(id);
    const move = plan && getCameraMove(id);
    if (!plan || !move) {
      if (!plan && !(kinds.has("motion") && getPrimitive(id))) throw unknown(id);
      throw new EffectUnsupportedError(`"${id}" is not a camera move, so it has no camera view; list the camera moves with list({ kind: "camera" }).`, id);
    }
    if (u !== undefined && !(u >= 0 && u <= 1)) throw new EffectUnsupportedError(`u is how far through the move, 0 to 1; got ${u}.`, id);
    let description = cameraDescriptions.get(id);
    if (!description) cameraDescriptions.set(id, (description = describePlan(plan, move.presets ?? [])));
    return { plan, move, description };
  }

  /** Where camera move `id` puts the camera `ctx.u` of the way through it. */
  function cameraView(id: string, ctx: CameraMoveContext, values?: EffectValues): CameraView {
    const { plan, move, description } = cameraMove(id, ctx?.u);
    for (const [name, view] of [["from", ctx.from], ["to", ctx.to]] as const) {
      if (!isCameraView(view)) throw new EffectUnsupportedError(`ctx.${name} is not a camera view: it needs a zoom above 0 and finite scrollX and scrollY.`, id);
    }
    const stage = ctx.stage;
    if (!(stage?.width > 0 && stage?.height > 0)) throw new EffectUnsupportedError(`ctx.stage needs a width and height above 0 (the stage in pixels).`, id);
    const resolved = flairValues(plan.controls, resolveEffectValues(description, values));
    const ms = Number.isFinite(ctx.ms) && ctx.ms >= 0 ? ctx.ms : move.motion.duration;
    return { ...move.motion.view({ from: ctx.from, to: ctx.to, u: ctx.u, ms, stage: { width: stage.width, height: stage.height } }, resolved) };
  }

  // Timing effects are described synchronously too (timingLength and timingSample must not wait), once each.
  const timingDescriptions = new Map<string, EffectDescription>();

  /** A timing effect with its plan and description, or the refusal `timingLength` and `timingSample` make. */
  function timingEffect(id: string) {
    const plan = plans.get(id);
    const retime = plan && getTimingEffect(id);
    if (!plan || !retime) {
      if (!plan && !(kinds.has("motion") && getPrimitive(id))) throw unknown(id);
      throw new EffectUnsupportedError(`"${id}" is not a timing effect, so it retimes no footage; list the timing effects with list({ kind: "timing" }).`, id);
    }
    let description = timingDescriptions.get(id);
    if (!description) timingDescriptions.set(id, (description = describePlan(plan, retime.presets ?? [])));
    return { plan, retime, description };
  }

  /** The footage's length, checked: a refusal naming what it takes. */
  function footageMs(id: string, footage: unknown): number {
    if (typeof footage !== "number" || !Number.isFinite(footage) || footage <= 0) throw new EffectUnsupportedError(`The footage's length is a number of ms above 0; got ${String(footage)}.`, id);
    return footage;
  }

  /** Ms timing effect `id`'s retime lasts for footage `footage` ms long. */
  function timingLength(id: string, footage: number, values?: EffectValues): number {
    const { plan, retime, description } = timingEffect(id);
    const resolved = flairValues(plan.controls, resolveEffectValues(description, values));
    return Math.max(0, retime.motion.length(footageMs(id, footage), resolved));
  }

  /** The footage frames retimed frame `request.time` of timing effect `id` shows. */
  function timingSample(id: string, request: TimingSampleRequest, values?: EffectValues): TimingSample {
    const { plan, retime, description } = timingEffect(id);
    const resolved = flairValues(plan.controls, resolveEffectValues(description, values));
    const footage = footageMs(id, request?.footage);
    if (typeof request.time !== "number" || !Number.isFinite(request.time)) throw new EffectUnsupportedError(`request.time is ms into the retimed clip, a finite number; got ${String(request.time)}.`, id);
    if (request.fps !== undefined && !(typeof request.fps === "number" && request.fps > 0 && request.fps <= 240)) {
      throw new EffectUnsupportedError(`request.fps is the footage's frames per second, above 0 and at most 240; got ${String(request.fps)}.`, id);
    }
    const sample = flairTimingSample(retime, { time: request.time, footage, ...(request.fps !== undefined && { fps: request.fps }) }, resolved);
    return { frames: sample.frames.slice(0, MAX_TIMING_FRAMES).map((f) => ({ time: f.time, weight: f.weight })), blend: sample.blend };
  }

  function describe(id: string): Promise<FlairEffectDescription> {
    let found = descriptions.get(id);
    if (!found) {
      const primitive = kinds.has("motion") ? getPrimitive(id) : undefined;
      const plan = plans.get(id);
      if (primitive) found = Promise.resolve(describePrimitive(primitive));
      else if (plan) found = describeCatalog(plan);
      else return Promise.reject(unknown(id));
      descriptions.set(id, found);
    }
    return found;
  }

  return {
    id: FLAIR_PROVIDER_ID,
    name: "Flair",
    ...(typeof __FLAIR_VERSION__ === "string" && { version: __FLAIR_VERSION__ }),
    capabilities,

    list(searchOptions?: EffectSearchOptions) {
      return searchEffectSummaries(summaries, "", searchOptions) as FlairEffectSummary[];
    },

    search(query: string, searchOptions?: EffectSearchOptions) {
      return searchEffectSummaries(summaries, query ?? "", searchOptions) as FlairEffectSummary[];
    },

    describe,

    async createRenderer(id: string, rendererOptions: EffectRendererOptions): Promise<EffectRenderer> {
      if (kinds.has("motion") && getPrimitive(id)) {
        throw new EffectUnsupportedError(`"${id}" is motion for vector art, not a picture: use applyVectorEffect to apply it to an SVG.`, id);
      }
      const { width, height, depth } = rendererSize(id, rendererOptions);
      const { plan, effect, description } = await catalogEffect(id);
      if (effect.kind === "shader") return new ShaderRenderer(plan, description, effect, width, height, depth);
      if (effect.kind === "camera") throw new EffectUnsupportedError(`"${id}" is a camera move, which moves a scene's camera rather than drawing a picture: use cameraView (or sampleCameraMove) for where it puts the camera.`, id);
      if (effect.kind === "timing") throw new EffectUnsupportedError(`"${id}" is a timing effect, which retimes footage rather than drawing a picture: use timingSample for the footage frames each moment shows (and timingLength for how long the retime lasts).`, id);
      if (!rasterize) {
        throw new EffectUnsupportedError(
          `"${id}" is a vector effect, and a Worker has no DOM to draw SVG in: render it on the page, pass rasterizeSvg to flairEffects, or use applyVectorEffect for the animated SVG.`,
          id,
        );
      }
      return new VectorRenderer(plan, description, effect, width, height, rasterize, depth);
    },

    cameraView,
    timingLength,
    timingSample,

    async listTemplates(searchOptions?: EffectTemplateSearchOptions): Promise<readonly EffectTemplateSummary[]> {
      return searchTemplateSummaries((await loadTemplates()).summaries, searchOptions);
    },

    async describeTemplate(id: string): Promise<EffectTemplateDescription> {
      return templateDescriptionOf(await template(id));
    },

    async instantiateTemplate(id: string, values?: EffectTemplateValues, templateOptions?: EffectTemplateOptions): Promise<EffectTemplateResult> {
      const filled = fillTemplate(await template(id), (values ?? {}) as TemplateValues, templateOptions ?? {});
      if (!filled.ok) return { ok: false, errors: filled.errors };
      const { sequence, notes } = sequenceOf(filled.scene, offered);
      const issues = filled.issues.map((issue) => `${issue.shot ? `Shot ${issue.shot}` : "The scene"}: ${issue.message}`);
      return { ok: true, sequence, openSlots: filled.openSlots, notes: [...notes, ...issues] };
    },

    async sampleCameraMove(id: string, request: CameraMoveSampleRequest): Promise<CameraMoveSample> {
      const { move } = cameraMove(id);
      if (!(Number.isFinite(request?.ms) && request.ms >= 0)) throw new EffectUnsupportedError(`ms is the move's length in ms, 0 or more; got ${request?.ms}.`, id);
      if (!(request.fps > 0)) throw new EffectUnsupportedError(`fps is keys per second, above 0; got ${request.fps}.`, id);
      // Check the values once, so a bad one is refused before any key is made.
      cameraView(id, { from: request.from, to: request.to, u: 0, ms: request.ms, stage: request.stage }, request.values);
      return sampleCameraViews((u) => cameraView(id, { from: request.from, to: request.to, u, ms: request.ms, stage: request.stage }, request.values), {
        ms: request.ms,
        fps: request.fps,
        ...(move.motion.cut !== undefined && { cut: move.motion.cut }),
      });
    },

    async openAuthoring(source: EffectAuthoringSource): Promise<EffectAuthoringSession> {
      // The editor (and the full catalog it creates documents from) loads with the first session.
      const { openFlairAuthoring } = await import("./authoring.js");
      return openFlairAuthoring(source, { plans, isPrimitive: (id) => kinds.has("motion") && getPrimitive(id) !== undefined, rasterize });
    },

    async applyVectorEffect(id: string, target: EffectVectorTarget, values?: EffectValues): Promise<EffectVectorMotion> {
      const primitive = kinds.has("motion") ? getPrimitive(id) : undefined;
      if (primitive) {
        const description = await describe(id);
        const params = resolveEffectValues(description, values);
        const svg = typeof target === "string" ? target : target?.svg;
        if (typeof svg !== "string" || !/<svg[\s>]/.test(svg)) throw new EffectUnsupportedError(`"${id}" needs an SVG to animate: pass its markup, or { svg, nodeIds }.`, id);
        const ids = targetIds(svg, typeof target === "string" ? undefined : target.nodeIds);
        if (!ids.length) throw new EffectUnsupportedError(`"${id}" animates elements by id, and the SVG has no element with an id: give the ones to animate ids, or pass nodeIds.`, id);
        let motion: SvgMotion = { svg };
        const problems: string[] = [];
        for (const elementId of ids) {
          const result = applyPrimitive(motion, { primitive: id, target: elementId, params });
          if (result.ok) motion = result.motion;
          else problems.push(`${elementId}: ${result.message}`);
        }
        if (problems.length === ids.length) throw new EffectUnsupportedError(`"${id}" could not be applied. ${problems.join(" ")}`, id);
        return { svg: motion.svg, animate: motion.animate ?? [], duration: Math.max(1, Math.round(svgDuration(motion))), loop: false };
      }
      const plan = plans.get(id);
      if (!plan) throw unknown(id);
      if (plan.meta.kind !== "vector") {
        throw new EffectUnsupportedError(`"${id}" is a shader, drawn as pixels: use createRenderer. Vector effects and motion primitives give SVG.`, id);
      }
      const { effect, description } = await catalogEffect(id);
      const resolved = resolveEffectValues(description, values);
      const vector = effect as VectorEffect;
      const motion = renderVectorEffect(vector, flairValues(plan.controls, resolved));
      return {
        svg: motion.svg,
        animate: motion.animate ?? [],
        duration: Math.max(1, Math.round(svgDuration(motion) + (vector.hold ?? 600))),
        loop: !vector.trigger,
        hold: vector.hold ?? 600,
      };
    },
  };
}
