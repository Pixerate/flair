/**
 * The effect catalog: ready-made shader and vector effects, each with
 * controls and presets, to drop into a product or start an edit from.
 *
 * - Browsing: `EFFECTS`, `getEffect`, `findEffects`, `EFFECT_CATEGORIES`.
 * - Video: shader effects with image controls say how they suit video
 *   (`video`, see `VideoUse`); `findEffects({ video: ["filter"] })` finds them.
 * - Controls: `effectControls`, `effectDefaults`.
 * - Inputs: `effectInputs` (what an effect takes, how it answers the pointer).
 * - Vector effects: their pictures declare their controls (`vectorControls`),
 *   and `renderVectorEffect` fills them in.
 *
 * @packageDocumentation
 */

import { controlValue, parseControls, type ControlDef, type ControlType, type ControlValue } from "../shader/controls.js";
import { controlsSchema, type JsonSchema } from "../shader/schema.js";
import { countTags, matchesQuery, queryWords, type EffectQuery, type EffectTag } from "./query.js";
import { didYouMean } from "../motion/params.js";
import { metaOf, type EffectMeta } from "./meta.js";
import { svgDuration } from "../vector/svg.js";
import type { PipelinePass } from "../shader/pipeline.js";
import type { LiveSource } from "../shader/textures.js";
import { inputsOf, type EffectInput, type EffectInputs, type EffectInteraction } from "./inputs.js";
import { aurora, conicSweep, duotoneFlow, meshGradient, silk } from "./shaders/gradients.js";
import { moreGradientShaders } from "./shaders/gradients-more.js";
import { uiShaders } from "./shaders/ui.js";
import { uiEffects } from "./ui.js";
import { loaderEffects } from "./loaders.js";
import {
  crt,
  filmGrain,
  imageDuotone,
  imageGlitch,
  imageHalftone,
  imagePixelate,
  imageRipple,
  transitions,
} from "./shaders/image.js";
import { blackHole, bokeh, godRays, lightRibbons, nebula, neonRipple, sparkles, starfield, tarotReveal } from "./shaders/light.js";
import { caustics, flames, lavaLamp, marble, plasma, smoke } from "./shaders/organic.js";
import { barberStripes, chevronTunnel, dotWave, hexPulse, kaleidoscope, memphisPattern, moire, neonCircuit, truchet, voronoi } from "./shaders/patterns.js";
import { interactionEffects } from "./interaction.js";
import { splatterEffects } from "./splatter.js";
import { bubbleEffects } from "./bubble.js";
import { stickerEffects } from "./sticker.js";
import { trailEffects } from "./trail.js";
import { impactEffects } from "./impact.js";
import { comicEffects } from "./comic.js";
import { glowEffects } from "./glow.js";
import { shadowEffects } from "./shadow.js";
import { lightingEffects } from "./lighting.js";
import { electricEffects } from "./electric.js";
import { fireEffects } from "./fire.js";
import { hologramEffects } from "./hologram.js";
import { meltEffects } from "./melt.js";
import { pixelEffects } from "./pixel.js";
import { pyroEffects } from "./pyro.js";
import { timewarpEffects } from "./timewarp.js";
import { morphEffects } from "./morph.js";
import { interactionShaders } from "./shaders/interaction.js";
import { splatterShaders } from "./shaders/splatter.js";
import { bubbleShaders } from "./shaders/bubble.js";
import { growthShaders } from "./shaders/growth.js";
import { stickerShaders } from "./shaders/sticker.js";
import { electricShaders } from "./shaders/electric.js";
import { fireShaders } from "./shaders/fire.js";
import { loaderShaders } from "./shaders/loaders.js";
import { hologramShaders } from "./shaders/hologram.js";
import { meltShaders } from "./shaders/melt.js";
import { pixelShaders } from "./shaders/pixel.js";
import { pyroShaders } from "./shaders/pyro.js";
import { timewarpShaders } from "./shaders/timewarp.js";
import { morphShaders } from "./shaders/morph.js";
import { overlayEffects } from "./shaders/overlay.js";
import { digitalRain, pixelSunset, synthwaveGrid, tvStatic } from "./shaders/retro.js";
import { textShaders } from "./shaders/text.js";
import { imageTreatments } from "./shaders/treatments.js";
import { sketchShaders } from "./shaders/sketch.js";
import { trailShaders } from "./shaders/trail.js";
import { particlesShaders } from "./shaders/particles.js";
import { debrisShaders } from "./shaders/debris.js";
import { impactShaders } from "./shaders/impact.js";
import { comicShaders } from "./shaders/comic.js";
import { atmosphereShaders } from "./shaders/atmosphere.js";
import { glowShaders } from "./shaders/glow.js";
import { shadowShaders } from "./shaders/shadow.js";
import { distortionShaders } from "./shaders/distortion.js";
import { lightingShaders } from "./shaders/lighting.js";
import { audioShaders } from "./shaders/audio.js";
import { scrollShaders } from "./shaders/scroll.js";
import { scrollEffects } from "./scroll.js";
import { threeDShaders } from "./shaders/three-d.js";
import { spaceShaders } from "./shaders/space-more.js";
import { weatherShaders } from "./shaders/weather.js";
import { waterShaders } from "./shaders/water.js";
import { glassShaders } from "./shaders/glass.js";
import { mirrorShaders } from "./shaders/mirror.js";
import { iridescentShaders } from "./shaders/iridescent.js";
import { webShaders } from "./shaders/web.js";
import { webEffects } from "./web.js";
import { promoShaders } from "./shaders/promo.js";
import { horrorShaders } from "./shaders/horror.js";
import { promoEffects } from "./promo.js";
import { textEffects } from "./text.js";
import { broadcastEffects } from "./broadcast.js";
import { annotationEffects } from "./annotation.js";
import { CURRENT_COLOR, EFFECT_CATEGORIES, EFFECT_CATEGORY_GROUPS, isCurrentColor, renderVectorEffect, vectorEffectControls, type EffectCategory, type EffectDefinition, type ShaderEffect, type VideoUse } from "./types.js";
import { vectorEffects } from "./vector.js";
import { dataEffects } from "./data.js";
import { iconEffects } from "./icons.js";

export {
  colorControl,
  categoryGroup,
  CURRENT_COLOR,
  EFFECT_CATEGORIES,
  EFFECT_CATEGORY_GROUPS,
  isCurrentColor,
  numberControl,
  renderVectorEffect,
  VECTOR_CONTROL_TYPES,
  vectorControlDef,
  vectorControlIssues,
  vectorControls,
  vectorEffectControls,
  VIDEO_USES,
  type EffectCategory,
  type EffectCategoryGroup,
  type EffectDefinition,
  type EffectPreset,
  type ShaderEffect,
  type VectorControl,
  type VectorEffect,
  type VideoUse,
} from "./types.js";
export { SAMPLE_IMAGES, svgDataUrl, textImage } from "./images.js";
export { controlSchema, controlsSchema, controlUnit, type JsonSchema, type SchemaOptions } from "../shader/schema.js";
export { FBM, glsl, HASH, NOISE, OKLAB_MIX, PALETTE, ROTATE, SPECTRUM } from "./glsl.js";

/** The catalog's shader effects. */
export const SHADER_EFFECTS: readonly ShaderEffect[] = [
  meshGradient,
  aurora,
  duotoneFlow,
  conicSweep,
  silk,
  ...moreGradientShaders,
  marble,
  smoke,
  lavaLamp,
  plasma,
  caustics,
  flames,
  dotWave,
  truchet,
  hexPulse,
  voronoi,
  moire,
  kaleidoscope,
  barberStripes,
  memphisPattern,
  chevronTunnel,
  neonCircuit,
  bokeh,
  godRays,
  sparkles,
  neonRipple,
  lightRibbons,
  tarotReveal,
  ...lightingShaders,
  starfield,
  nebula,
  blackHole,
  ...spaceShaders,
  synthwaveGrid,
  digitalRain,
  pixelSunset,
  tvStatic,
  imageRipple,
  imageGlitch,
  imageDuotone,
  imageHalftone,
  imagePixelate,
  ...imageTreatments,
  ...sketchShaders,
  crt,
  filmGrain,
  ...overlayEffects,
  ...textShaders,
  ...morphShaders,
  ...interactionShaders,
  ...pyroShaders,
  ...timewarpShaders,
  ...meltShaders,
  ...electricShaders,
  ...fireShaders,
  ...loaderShaders,
  ...hologramShaders,
  ...pixelShaders,
  ...splatterShaders,
  ...bubbleShaders,
  ...growthShaders,
  ...stickerShaders,
  ...trailShaders,
  ...particlesShaders,
  ...debrisShaders,
  ...impactShaders,
  ...comicShaders,
  ...atmosphereShaders,
  ...glowShaders,
  ...shadowShaders,
  ...distortionShaders,
  ...audioShaders,
  ...scrollShaders,
  ...uiShaders,
  ...threeDShaders,
  ...weatherShaders,
  ...waterShaders,
  ...glassShaders,
  ...mirrorShaders,
  ...iridescentShaders,
  ...webShaders,
  ...promoShaders,
  ...horrorShaders,
  ...transitions,
];

/** Every effect in the catalog, shaders first, grouped by category. */
export const EFFECTS: readonly EffectDefinition[] = [...SHADER_EFFECTS, ...vectorEffects, ...textEffects, ...morphEffects, ...interactionEffects, ...pyroEffects, ...timewarpEffects, ...meltEffects, ...electricEffects, ...fireEffects, ...hologramEffects, ...pixelEffects, ...splatterEffects, ...bubbleEffects, ...stickerEffects, ...trailEffects, ...impactEffects, ...comicEffects, ...glowEffects, ...shadowEffects, ...lightingEffects, ...scrollEffects, ...broadcastEffects, ...annotationEffects, ...uiEffects, ...loaderEffects, ...dataEffects, ...iconEffects, ...webEffects, ...promoEffects].sort(
  (a, b) => EFFECT_CATEGORIES.indexOf(a.category) - EFFECT_CATEGORIES.indexOf(b.category),
);

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

/** The effect with this id, or undefined. */
export function getEffect(id: string): EffectDefinition | undefined {
  return byId.get(id);
}

/**
 * The effect with this id, as `@pixerate/flair/catalog/lazy`'s `loadEffect`
 * gives it, so code can be written once for either catalog. Here every
 * effect is loaded already. Rejects for an id the catalog does not have.
 */
export async function loadEffect(id: string): Promise<EffectDefinition> {
  const effect = byId.get(id);
  if (!effect) throw new Error(`There is no effect ${JSON.stringify(id)} in the catalog.${didYouMean(id, [...byId.keys()])} findEffects lists them.`);
  return effect;
}

/** An effect's metadata, as the lazy catalog has it up front (see `EffectMeta`). */
export function effectMeta(effect: EffectDefinition): EffectMeta {
  return metaOf(effect, effectControls(effect), effectInputs(effect), effectDuration(effect));
}

/**
 * Ms of one play of an effect: a shader's `loop`, or a vector effect's
 * picture at its default values plus its `hold` (default 600). Undefined for
 * a shader with no loop.
 */
export function effectDuration(effect: EffectDefinition): number | undefined {
  if (effect.kind === "shader") return effect.loop === undefined ? undefined : Math.round(effect.loop * 1000);
  return Math.round(svgDuration(renderVectorEffect(effect, effectDefaults(effect))) + (effect.hold ?? 600));
}

export {
  EFFECT_INPUTS,
  EFFECT_INTERACTIONS,
  type EffectInput,
  type EffectInputs,
  type EffectInteraction,
  type ImageSlot,
  type TextSlot,
} from "./inputs.js";

const inputsCache = new WeakMap<EffectDefinition, EffectInputs>();

/**
 * What an effect takes and how it answers the pointer: what you can give it
 * (`accepts`: image, video, svg, text, mask, path), its image controls and
 * whether each wants a picture, a mask or text, its text controls (copy,
 * font, path, glyphs), how it suits video, how it answers the pointer
 * (`interactions`: hover, press, click, trail, pointer, scroll) and whether it draws
 * over other content. Worked out from the effect itself, so it always agrees
 * with its controls and source.
 */
export function effectInputs(effect: EffectDefinition): EffectInputs {
  let inputs = inputsCache.get(effect);
  if (!inputs) inputsCache.set(effect, (inputs = inputsOf(effect, effectControls(effect))));
  return inputs;
}

/**
 * Whether a shader effect draws alpha to keep, so it needs a transparent
 * canvas (`alpha: true`). With `values`: an effect with a background opacity
 * control (`uBackgroundAlpha`, which covers the whole frame) when it is below
 * 1, else an overlay (`transparent`), or a picture effect whose backdrop
 * (`uBackdropAlpha`) is below 1. Without `values`, whether it could, for a
 * live canvas whose values change later: an overlay, or an effect with
 * either control (an opaque frame looks the same on a transparent canvas).
 * False for vector effects.
 */
export function drawsAlpha(effect: EffectDefinition, values?: Readonly<Record<string, ControlValue>>): boolean {
  if (effect.kind !== "shader") return false;
  const controls = effectControls(effect);
  const below1 = (name: string) => {
    const control = controls.find((c) => c.name === name);
    if (!control) return undefined;
    const value = values?.[name] ?? control.default;
    return typeof value === "number" && value < 1;
  };
  if (!values) return Boolean(effect.transparent) || below1("uBackgroundAlpha") !== undefined || below1("uBackdropAlpha") !== undefined;
  return below1("uBackgroundAlpha") ?? (Boolean(effect.transparent) || below1("uBackdropAlpha") === true);
}

export { normaliseTag, TAG_FORMAT, type EffectQuery, type EffectTag } from "./query.js";
export type { EffectMeta } from "./meta.js";

/**
 * Whether an effect is designed to modify a single picture (e.g. filters, stylizations, distortions).
 * Returns true when the effect accepts an image, has exactly one image slot, and that slot wants a 'picture'
 * (rather than a mask, text, or multiple pictures for transitions).
 */
export function isSinglePictureEffect(effect: EffectDefinition): boolean {
  const inputs = effectInputs(effect);
  return (
    inputs.accepts.includes("image") &&
    inputs.images.length === 1 &&
    inputs.images[0]?.wants === "picture"
  );
}

/**
 * Returns whether an effect outputs animated SVG flair.
 * All vector effects in Flair have motion definitions with SVG animations.
 */
export function canOutputAnimatedSvg(effect: EffectDefinition): boolean {
  if (!effect) return false;
  return effect.kind === "vector";
}

/**
 * Returns whether an effect outputs video (WebGL shader rendering).
 * Shader effects in Flair with video output capability can be rendered to video.
 */
export function canOutputVideo(effect: EffectDefinition): boolean {
  if (!effect) return false;
  if (effect.kind === "shader") {
    return effect.video !== "none";
  }
  return false;
}

/**
 * Returns whether an effect is animated over time (`iTime` uniform in shader source, or a vector effect).
 * Static image filters/treatments that do not reference `iTime` return `false`.
 */
export function isMotionEffect(effect: EffectDefinition | undefined): boolean {
  if (!effect) return false;
  if (effect.kind === "vector") return true;
  if (effect.kind === "shader") {
    return /\biTime\b/.test(effect.source);
  }
  return false;
}

/**
 * Returns the user-configurable controls for an effect, excluding image input slots and `sampler2D` uniforms.
 */
export function nonImageEffectControls(effect: EffectDefinition | undefined): ControlDef[] {
  if (!effect) return [];
  const all = effectControls(effect);
  const imageInputNames = new Set(effectInputs(effect).images.map((img) => img.name));
  return all.filter(
    (c) => !imageInputNames.has(c.name) && c.type !== "sampler2D" && !/^uImage\d*$/i.test(c.name),
  );
}

/**
 * Sanitizes a control value map for an effect by stripping image input slots (`uImage*`, `sampler2D`),
 * sample SVG data URLs, null/undefined entries, and (when `effect` is provided) unknown control keys.
 */
export function sanitizeEffectValues(
  effect: EffectDefinition | undefined,
  values: Record<string, unknown> | undefined | null,
): Record<string, ControlValue> {
  if (!values || typeof values !== "object") return {};
  const validControls = effect ? new Map(effectControls(effect).map((c) => [c.name, c])) : null;
  const imageKeys = effect ? new Set(effectInputs(effect).images.map((i) => i.name)) : null;
  const cleaned: Record<string, ControlValue> = {};

  for (const [key, val] of Object.entries(values)) {
    if (val === undefined || val === null) continue;
    if (imageKeys?.has(key) || /^uImage\d*$/i.test(key)) continue;
    if (typeof val === "string" && val.startsWith("data:image/svg+xml")) continue;
    if (validControls) {
      const ctrl = validControls.get(key);
      if (!ctrl || ctrl.type === "sampler2D") continue;
    }
    cleaned[key] = val as ControlValue;
  }

  return cleaned;
}

/** Effects matching a query, in catalog order. */
export function findEffects(query: EffectQuery = {}): EffectDefinition[] {
  const words = queryWords(query);
  return EFFECTS.filter((e) => matchesQuery({ ...e, video: e.kind === "shader" ? e.video : undefined }, () => effectInputs(e), query, words));
}

/**
 * The tags of the effects matching a query, each with how many of them carry
 * it, the most used first: `effectTags()` is the whole vocabulary,
 * `effectTags({ category: "fire" })` the tags to narrow fire effects by.
 * Pass any of them to `findEffects({ tags })`.
 */
export function effectTags(query: EffectQuery = {}): EffectTag[] {
  return countTags(findEffects(query));
}

/** One layer of an {@link effectStack}: a shader effect by id (or definition), with values or a preset. */
export type StackLayer = string | ShaderEffect | { effect: string | ShaderEffect; values?: Record<string, ControlValue>; preset?: string };

/**
 * Catalog shaders as the passes of a `ShaderPipeline`, each applied to the
 * one before: a layer with a picture control (a filter, a distortion, a
 * transition's `from`) reads the layer below there; an overlay is drawn over
 * it by its alpha; anything else (a generator) replaces it. The first
 * layer's picture is `source` when given, else its own sample image.
 *
 *     new ShaderPipeline({ passes: effectStack(["aurora", "crt", "vignette-grain"]), width, height })
 *
 * Throws for an id the catalog does not have, or a vector effect (stacks
 * are of shaders).
 */
export function effectStack(layers: readonly StackLayer[], options: { source?: LiveSource } = {}): PipelinePass[] {
  return layers.map((layer, i) => {
    const spec = typeof layer === "object" && "effect" in layer ? layer : { effect: layer };
    const effect = typeof spec.effect === "string" ? getEffect(spec.effect) : spec.effect;
    if (!effect) throw new Error(`There is no effect ${JSON.stringify(spec.effect)} in the catalog.${didYouMean(String(spec.effect), [...byId.keys()])}`);
    if (effect.kind !== "shader") throw new Error(`"${effect.id}" is a vector effect; a stack is of shader effects (layer ${i}).`);
    const picture = effectInputs(effect).images.find((slot) => slot.wants === "picture");
    const values = effectDefaults(effect, { preset: "preset" in spec ? spec.preset : undefined, values: "values" in spec ? spec.values : undefined });
    const pass: PipelinePass = { source: effect.source, values, name: effect.id };
    if (picture && i > 0) pass.inputs = { [picture.name]: "previous" };
    else if (picture && options.source) pass.inputs = { [picture.name]: options.source };
    else if (i > 0 && drawsAlpha(effect, values)) pass.blend = "over";
    return pass;
  });
}

/** An effect's controls: a shader's `@control` uniforms, or a vector effect's declared controls. */
export function effectControls(effect: EffectDefinition): ControlDef[] {
  return effect.kind === "shader" ? parseControls(effect.source) : vectorEffectControls(effect);
}

/**
 * The JSON Schema (draft 2020-12) of an effect's control values, by id or
 * definition; undefined for an id the catalog does not have. Strict: an
 * object of the effect's controls and nothing else (`additionalProperties:
 * false`), each with its label as the title, a description giving its unit,
 * range and default, and its default (see `controlSchema`). Colours take
 * sRGB channels 0–1 or a CSS colour string (and, in vector effects,
 * `"currentColor"`); images take a URL. Every control has a default, so none
 * is required. Presets and defaults always validate against it.
 */
export function effectControlSchema(effect: string | EffectDefinition): JsonSchema | undefined {
  const def = typeof effect === "string" ? getEffect(effect) : effect;
  if (!def) return undefined;
  return controlsSchema(effectControls(def), {
    title: `${def.name} controls`,
    description: def.description,
    currentColor: def.kind === "vector",
  });
}

/** An effect's values: each control's default, overridden by `values` (and a preset by name, when given). */
export function effectDefaults(
  effect: EffectDefinition,
  options: { preset?: string; values?: Record<string, ControlValue> } = {},
): Record<string, ControlValue> {
  const preset = options.preset ? effect.presets?.find((p) => p.name === options.preset)?.values : undefined;
  const merged = { ...preset, ...options.values };
  // A vector effect's colours may also follow the text around it.
  const keep = (c: ControlDef) => effect.kind === "vector" && c.color && isCurrentColor(merged[c.name]);
  return Object.fromEntries(effectControls(effect).map((c) => [c.name, keep(c) ? CURRENT_COLOR : controlValue(c, merged)]));
}

/**
 * A simplified, human-facing variable descriptor suitable for prompting or user configuration.
 */
export interface PromptVariableDef {
  name: string;
  label: string;
  type: ControlType;
  options?: string[];
  defaultValue?: ControlValue;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Determines whether a control is human-readable and suitable for inclusion
 * as a prompt/template variable. Omits internal uniforms, samplers, textures,
 * coordinate vectors, and frame/resolution metadata.
 */
export function isHumanReadableControl(c: Pick<ControlDef, "name" | "type"> & Partial<ControlDef>): boolean {
  if (!c || !c.name) return false;
  if (c.name.startsWith("_")) return false;
  if (c.type === "sampler2D") return false;

  // Samplers and textures
  const textureRegex =
    /^(uImage|uTexture|uFrom|uTo|uNormals|uNoise|uBuffer|uChannel\d*)$/i;
  if (textureRegex.test(c.name)) return false;

  // Engine uniforms & system coordinates
  const engineUniformRegex =
    /^(uResolution|iResolution|resolution|uTime|iTime|time|uMouse|iMouse|mouse|uProgress|iProgress|progress|phase|transitionProgress|uAspect|aspect|uFrame|iFrame|frame)$/i;
  if (engineUniformRegex.test(c.name)) return false;

  // Coordinate vectors (vec2 is coordinates/offsets, vec3 without color is coordinates/directions)
  if (c.type === "vec2") return false;
  if (c.type === "vec3" && !c.color) return false;

  // Raw index/coordinate floats (e.g. x1, y1, x2, y2)
  if (/^[xyzw]\d+$/i.test(c.name)) return false;

  return true;
}

/**
 * Extracts prompt-friendly template variables from an effect's controls.
 * Automatically filters out internal shader/engine controls.
 */
export function getPromptVariables(effect: EffectDefinition): PromptVariableDef[] {
  const controls = effectControls(effect).filter(isHumanReadableControl);
  return controls.map((c) => {
    const rawOptions = (c as any).options;
    const options = Array.isArray(rawOptions) && rawOptions.length > 0
      ? rawOptions.map(String)
      : c.type === "bool"
        ? ["true", "false"]
        : undefined;
    return {
      name: c.name,
      label: c.label || c.name,
      type: c.type,
      options,
      defaultValue: c.default,
      min: c.min,
      max: c.max,
      step: c.step,
    };
  });
}

/**
 * Extracts the reference template SVG string from a vector effect.
 * If given an effect ID, looks it up in the catalog.
 * Returns undefined if the effect is not found or is not a vector effect.
 */
export function getEffectReferenceSvg(
  effectOrId: EffectDefinition | string,
  values?: Record<string, ControlValue>,
): string | undefined {
  const effect = typeof effectOrId === "string" ? getEffect(effectOrId) : effectOrId;
  if (!effect || effect.kind !== "vector") return undefined;

  const rendered = renderVectorEffect(effect, values);
  return rendered?.svg || effect.motion?.svg;
}

