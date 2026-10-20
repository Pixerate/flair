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
  EffectUnsupportedError,
  isEffectPixels,
  resolveEffectValues,
  searchEffectSummaries,
  UnknownEffectError,
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
  type EffectUse,
  type EffectValues,
  type EffectVectorMotion,
  type EffectVectorTarget,
} from "@pixerate/editor/effects";
import { EFFECT_META, loadEffect, type EffectMeta } from "../catalog/lazy.js";
import { renderVectorEffect, type EffectDefinition, type ShaderEffect, type VectorEffect } from "../catalog/types.js";
import { applyPrimitive } from "../motion/apply.js";
import { getPrimitive, PRIMITIVES } from "../motion/library.js";
import type { PrimitiveDescriptor, PrimitiveParam } from "../motion/types.js";
import { checkControlValue, rgbToHex, type ControlDef, type ControlValue } from "../shader/controls.js";
import { ShaderPipeline, type FloatPicture, type PassInput, type PipelineFormat } from "../shader/pipeline.js";
import { srgbToLinear } from "../shader/color.js";
import { controlsSchema, JSON_SCHEMA_DIALECT, type JsonSchema } from "../shader/schema.js";
import type { LiveSource } from "../shader/textures.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgDuration, svgView } from "../vector/svg.js";

/** Draws one frame of an animated SVG as pixels (see {@link FlairEffectsOptions.rasterizeSvg}). */
export type SvgRasterizer = (motion: SvgMotion, timeMs: number, size: { width: number; height: number }) => Promise<EffectPixels>;

export interface FlairEffectsOptions {
  /** The kinds of effect to offer (default all): `shader`, `vector` (animated SVGs) and `motion` (primitives applied to vector art). */
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
interface Plan {
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

function planOf(meta: EffectMeta): Plan {
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
  const bound = new Set(inputs.map((i) => i.uniform));
  const controls = meta.controls.filter((c) => !bound.has(c.name) && c.type !== "sampler2D" && !(transition && TRANSITION_DRIVEN.has(c.name)));
  return { meta, uses: [...uses], inputs, controls, transition };
}

function summaryOf(plan: Plan): EffectSummary {
  const { meta } = plan;
  return {
    id: meta.id,
    name: meta.name,
    kind: meta.kind,
    category: meta.category,
    uses: plan.uses,
    description: meta.description,
    tags: meta.tags,
    transparent: meta.kind === "vector" || Boolean(meta.transparent),
    loop: meta.kind === "vector" ? !meta.trigger : meta.loop !== undefined,
    ...(meta.duration !== undefined && meta.duration > 0 && { duration: meta.duration }),
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
function contractValue(control: ControlDef, value: ControlValue): ControlValue {
  return control.color ? hex(value) : value;
}

function controlSchemaOf(plan: Plan): EffectDescription["controls"] {
  const schema = controlsSchema(plan.controls, { title: `${plan.meta.name} controls`, description: plan.meta.description, currentColor: plan.meta.kind === "vector" });
  for (const control of plan.controls) {
    if (control.color) schema.properties![control.name] = { ...schema.properties![control.name], default: hex(control.default) };
  }
  return schema as unknown as EffectDescription["controls"];
}

/** Contract values (checked against the schema) as Flair's: CSS colours become channels. */
function flairValues(controls: readonly ControlDef[], values: Record<string, unknown>): Record<string, ControlValue> {
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

// ---------------------------------------------------------------------------
// Pictures in
// ---------------------------------------------------------------------------

/**
 * An input picture as what a pipeline's image control (or mask) takes: a
 * float picture when it has floats (linear light), an `ImageData` for 8-bit
 * pixels, and the host's own image objects as they are.
 */
function passInput(source: EffectImageSource): Exclude<PassInput, "previous" | "feedback" | { pass: number }> {
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
const pageRasterizer: SvgRasterizer = async (motion, timeMs, { width, height }) => {
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
    if (!request || typeof request.time !== "number" || !Number.isFinite(request.time)) {
      throw new EffectUnsupportedError(`render needs { time } in ms, a finite number; got ${JSON.stringify(request?.time)}.`, this.effectId);
    }
    const values = resolveEffectValues(this.description, request.values);
    const given = request.inputs ?? {};
    const names = new Set(this.plan.inputs.map((i) => i.name));
    for (const name of Object.keys(given)) {
      if (!names.has(name)) {
        throw new EffectUnsupportedError(
          `"${this.effectId}" has no input "${name}"; ${this.plan.inputs.length ? `its inputs are ${this.plan.inputs.map((i) => `"${i.name}"`).join(", ")}` : "it takes none"}.`,
          this.effectId,
        );
      }
    }
    for (const input of this.plan.inputs) {
      if (input.required && !given[input.name]) throw new EffectUnsupportedError(`"${this.effectId}" needs the input "${input.name}": ${input.description}`, this.effectId);
    }
    return this.draw(request, flairValues(this.plan.controls, values));
  }

  protected abstract draw(request: EffectRenderRequest, values: Record<string, ControlValue>): Promise<EffectPixels>;

  dispose(): void {
    this.disposed = true;
  }
}

const FORMATS: Record<8 | 16 | 32, PipelineFormat> = { 8: "rgba8", 16: "rgba16f", 32: "rgba32f" };

class ShaderRenderer extends BaseRenderer {
  readonly depth: 8 | 16 | 32;
  private pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>;

  constructor(plan: Plan, description: EffectDescription, effect: ShaderEffect, width: number, height: number, depth: 8 | 16 | 32) {
    super(plan, description, width, height);
    const make = (format: PipelineFormat) => new ShaderPipeline<HTMLCanvasElement | OffscreenCanvas>({ passes: [{ source: effect.source, name: effect.id }], width, height, alpha: true, format });
    let pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas> | undefined;
    let made: 8 | 16 | 32 = depth;
    try {
      try {
        pipeline = make(FORMATS[depth]);
      } catch (e) {
        // A GPU that cannot render to floats gives 8-bit frames, as the contract allows (depth says so).
        if (depth === 8 || !/float/i.test(e instanceof Error ? e.message : "")) throw e;
        pipeline = make("rgba8");
        made = 8;
      }
    } catch (e) {
      throw new EffectUnsupportedError(`"${effect.id}" cannot render here: ${e instanceof Error ? e.message : String(e)}`, effect.id);
    }
    this.pipeline = pipeline;
    this.depth = made;
  }

  protected async draw(request: EffectRenderRequest, values: Record<string, ControlValue>): Promise<EffectPixels> {
    const given = request.inputs ?? {};
    const flair = { ...values };
    for (const input of this.plan.inputs) {
      const source = given[input.name];
      this.pipeline.setInput(0, input.uniform, source ? passInput(source) : null);
      // A picture given needs no URL loaded behind it.
      if (source) flair[input.uniform] = "";
    }
    const duration = this.plan.meta.duration ?? 4000;
    if (this.plan.transition) {
      flair.uAnimate = false;
      flair.uProgress = Math.min(1, Math.max(0, request.progress ?? request.time / duration));
    }
    if (request.mask) {
      // Untouched where the mask is 0: the picture the effect changes (a filter's source, a transition's from).
      const untouched = given.source ?? given.from;
      this.pipeline.setMask({ picture: passInput(request.mask), ...(untouched ? { under: passInput(untouched) } : {}) });
    } else this.pipeline.setMask(null);
    this.pipeline.setValues(0, flair);
    // The effect's own sample pictures: a failure shows black where they go rather than failing the frame.
    await this.pipeline.ready().catch(() => undefined);
    if (this.disposed) throw new EffectDisposedError(this.effectId);
    this.pipeline.render(request.time / 1000);
    const data = this.pipeline.readImageData().data;
    return { width: this.width, height: this.height, data, ...(this.depth > 8 ? { float: this.pipeline.readFloatPixels() } : {}) };
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
    if (request.mask) {
      // A vector picture has nothing under it: coverage multiplies its alpha, as for any generator.
      if (!isEffectPixels(request.mask) || request.mask.width !== this.width || request.mask.height !== this.height) {
        throw new EffectUnsupportedError(`A vector effect's mask is EffectPixels the renderer's size (${this.width} × ${this.height}).`, this.effectId);
      }
      applyEffectMask(pixels, request.mask);
    }
    return this.depth > 8 ? { ...pixels, float: decodedFloat(pixels.data) } : pixels;
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
 */
export function flairEffects(options: FlairEffectsOptions = {}): EffectProvider {
  const kinds = new Set<EffectKind>(options.kinds ?? ["shader", "vector", "motion"]);
  const plans = new Map(EFFECT_META.filter((m) => kinds.has(m.kind)).map((m) => [m.id, planOf(m)]));
  const primitives = kinds.has("motion") ? PRIMITIVES : [];
  const summaries: EffectSummary[] = [...[...plans.values()].map(summaryOf), ...primitives.map(primitiveSummary)];
  const descriptions = new Map<string, Promise<EffectDescription>>();
  const inWorker = typeof document === "undefined";
  const rasterize = options.rasterizeSvg ?? (inWorker ? undefined : pageRasterizer);

  const capabilities: EffectProviderCapabilities = {
    supportsWorker: inWorker,
    supportsFloat: kinds.has("shader") && canRenderFloat(),
    supportsMask: true,
    supportsHostImages: true,
    supportsVector: kinds.has("vector") || kinds.has("motion"),
  };

  const unknown = (id: string) => new UnknownEffectError(String(id), "Flair");

  /** A catalog effect: its plan, definition and description (loading its source once). */
  async function catalogEffect(id: string): Promise<{ plan: Plan; effect: EffectDefinition; description: EffectDescription }> {
    const plan = plans.get(id);
    if (!plan) throw unknown(id);
    const effect = await loadEffect(id);
    return { plan, effect, description: await describe(id) };
  }

  async function describeCatalog(plan: Plan): Promise<EffectDescription> {
    const effect = await loadEffect(plan.meta.id);
    const names = new Set(plan.controls.map((c) => c.name));
    const presets: EffectPreset[] = (effect.presets ?? []).map((preset) => ({
      name: preset.name,
      values: Object.fromEntries(
        Object.entries(preset.values)
          .filter(([name]) => names.has(name))
          .map(([name, value]) => [name, contractValue(plan.controls.find((c) => c.name === name)!, value)]),
      ) as EffectValues,
    }));
    return {
      ...summaryOf(plan),
      controls: controlSchemaOf(plan),
      defaults: Object.fromEntries(plan.controls.map((c) => [c.name, contractValue(c, c.default)])) as EffectValues,
      presets,
      inputs: plan.inputs.map(({ uniform: _, ...spec }) => spec),
    };
  }

  function describe(id: string): Promise<EffectDescription> {
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
      return searchEffectSummaries(summaries, "", searchOptions);
    },

    search(query: string, searchOptions?: EffectSearchOptions) {
      return searchEffectSummaries(summaries, query ?? "", searchOptions);
    },

    describe,

    async createRenderer(id: string, rendererOptions: EffectRendererOptions): Promise<EffectRenderer> {
      if (kinds.has("motion") && getPrimitive(id)) {
        throw new EffectUnsupportedError(`"${id}" is motion for vector art, not a picture: use applyVectorEffect to apply it to an SVG.`, id);
      }
      const width = Math.round(rendererOptions?.width);
      const height = Math.round(rendererOptions?.height);
      if (!(width >= 1 && height >= 1)) {
        throw new EffectUnsupportedError(`createRenderer needs a width and height of at least 1 pixel; got ${rendererOptions?.width} × ${rendererOptions?.height}.`, id);
      }
      const depth = rendererOptions.depth ?? 8;
      if (depth !== 8 && depth !== 16 && depth !== 32) throw new EffectUnsupportedError(`depth is 8, 16 or 32 bits a channel; got ${JSON.stringify(rendererOptions.depth)}.`, id);
      const { plan, effect, description } = await catalogEffect(id);
      if (effect.kind === "shader") return new ShaderRenderer(plan, description, effect, width, height, depth);
      if (!rasterize) {
        throw new EffectUnsupportedError(
          `"${id}" is a vector effect, and a Worker has no DOM to draw SVG in: render it on the page, pass rasterizeSvg to flairEffects, or use applyVectorEffect for the animated SVG.`,
          id,
        );
      }
      return new VectorRenderer(plan, description, effect, width, height, rasterize, depth);
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
