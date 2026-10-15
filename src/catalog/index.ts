/**
 * The effect catalog: ready-made shader and vector effects, each with
 * controls and presets, to drop into a product or start an edit from.
 *
 * - Browsing: `EFFECTS`, `getEffect`, `findEffects`, `EFFECT_CATEGORIES`.
 * - Controls: `effectControls`, `effectDefaults`.
 * - Vector effects: their pictures declare their controls (`vectorControls`),
 *   and `renderVectorEffect` fills them in.
 *
 * @packageDocumentation
 */

import { controlValue, parseControls, type ControlDef, type ControlValue } from "../shader/controls.js";
import { aurora, conicSweep, duotoneFlow, meshGradient, silk } from "./shaders/gradients.js";
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
import { blackHole, bokeh, godRays, lightRibbons, nebula, neonRipple, sparkles, starfield } from "./shaders/light.js";
import { caustics, flames, lavaLamp, marble, plasma, smoke } from "./shaders/organic.js";
import { barberStripes, dotWave, hexPulse, kaleidoscope, moire, neonCircuit, truchet, voronoi } from "./shaders/patterns.js";
import { morphEffects } from "./morph.js";
import { morphShaders } from "./shaders/morph.js";
import { overlayEffects } from "./shaders/overlay.js";
import { digitalRain, pixelSunset, synthwaveGrid, tvStatic } from "./shaders/retro.js";
import { textShaders } from "./shaders/text.js";
import { imageTreatments } from "./shaders/treatments.js";
import { textEffects } from "./text.js";
import { EFFECT_CATEGORIES, vectorEffectControls, type EffectCategory, type EffectDefinition, type ShaderEffect } from "./types.js";
import { vectorEffects } from "./vector.js";

export {
  colorControl,
  EFFECT_CATEGORIES,
  numberControl,
  renderVectorEffect,
  VECTOR_CONTROL_TYPES,
  vectorControlDef,
  vectorControlIssues,
  vectorControls,
  vectorEffectControls,
  type EffectCategory,
  type EffectDefinition,
  type EffectPreset,
  type ShaderEffect,
  type VectorControl,
  type VectorEffect,
} from "./types.js";
export { SAMPLE_IMAGES, svgDataUrl, textImage } from "./images.js";
export { FBM, glsl, HASH, NOISE, OKLAB_MIX, PALETTE, ROTATE } from "./glsl.js";

/** The catalog's shader effects. */
export const SHADER_EFFECTS: readonly ShaderEffect[] = [
  meshGradient,
  aurora,
  duotoneFlow,
  conicSweep,
  silk,
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
  neonCircuit,
  bokeh,
  godRays,
  sparkles,
  neonRipple,
  lightRibbons,
  starfield,
  nebula,
  blackHole,
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
  crt,
  filmGrain,
  ...overlayEffects,
  ...textShaders,
  ...morphShaders,
  ...transitions,
];

/** Every effect in the catalog, shaders first, grouped by category. */
export const EFFECTS: readonly EffectDefinition[] = [...SHADER_EFFECTS, ...vectorEffects, ...textEffects, ...morphEffects].sort(
  (a, b) => EFFECT_CATEGORIES.indexOf(a.category) - EFFECT_CATEGORIES.indexOf(b.category),
);

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

/** The effect with this id, or undefined. */
export function getEffect(id: string): EffectDefinition | undefined {
  return byId.get(id);
}

export interface EffectQuery {
  /** Words to look for in the name, description, tags and id (all must match). */
  text?: string;
  category?: EffectCategory;
  kind?: EffectDefinition["kind"];
  /** Effects with every one of these tags. */
  tags?: readonly string[];
}

/** Effects matching a query, in catalog order. */
export function findEffects(query: EffectQuery = {}): EffectDefinition[] {
  const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return EFFECTS.filter((e) => {
    if (query.category && e.category !== query.category) return false;
    if (query.kind && e.kind !== query.kind) return false;
    if (query.tags && !query.tags.every((t) => e.tags.includes(t))) return false;
    const haystack = [e.id, e.name, e.description, e.category, ...e.tags].join(" ").toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

/** An effect's controls: a shader's `@control` uniforms, or a vector effect's declared controls. */
export function effectControls(effect: EffectDefinition): ControlDef[] {
  return effect.kind === "shader" ? parseControls(effect.source) : vectorEffectControls(effect);
}

/** An effect's values: each control's default, overridden by `values` (and a preset by name, when given). */
export function effectDefaults(
  effect: EffectDefinition,
  options: { preset?: string; values?: Record<string, ControlValue> } = {},
): Record<string, ControlValue> {
  const preset = options.preset ? effect.presets?.find((p) => p.name === options.preset)?.values : undefined;
  const merged = { ...preset, ...options.values };
  return Object.fromEntries(effectControls(effect).map((c) => [c.name, controlValue(c, merged)]));
}
