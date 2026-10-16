/**
 * The effect catalog: ready-made shader and vector effects, each with
 * controls and presets, to drop into a product or start an edit from.
 *
 * - Browsing: `EFFECTS`, `getEffect`, `findEffects`, `EFFECT_CATEGORIES`.
 * - Video: shader effects with image controls say how they suit video
 *   (`video`, see `VideoUse`); `findEffects({ video: ["filter"] })` finds them.
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
import { interactionEffects } from "./interaction.js";
import { splatterEffects } from "./splatter.js";
import { bubbleEffects } from "./bubble.js";
import { stickerEffects } from "./sticker.js";
import { trailEffects } from "./trail.js";
import { impactEffects } from "./impact.js";
import { comicEffects } from "./comic.js";
import { electricEffects } from "./electric.js";
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
import { meltShaders } from "./shaders/melt.js";
import { pixelShaders } from "./shaders/pixel.js";
import { pyroShaders } from "./shaders/pyro.js";
import { timewarpShaders } from "./shaders/timewarp.js";
import { morphShaders } from "./shaders/morph.js";
import { overlayEffects } from "./shaders/overlay.js";
import { digitalRain, pixelSunset, synthwaveGrid, tvStatic } from "./shaders/retro.js";
import { textShaders } from "./shaders/text.js";
import { imageTreatments } from "./shaders/treatments.js";
import { trailShaders } from "./shaders/trail.js";
import { particlesShaders } from "./shaders/particles.js";
import { debrisShaders } from "./shaders/debris.js";
import { impactShaders } from "./shaders/impact.js";
import { comicShaders } from "./shaders/comic.js";
import { textEffects } from "./text.js";
import { CURRENT_COLOR, EFFECT_CATEGORIES, isCurrentColor, vectorEffectControls, type EffectCategory, type EffectDefinition, type ShaderEffect, type VideoUse } from "./types.js";
import { vectorEffects } from "./vector.js";

export {
  colorControl,
  CURRENT_COLOR,
  EFFECT_CATEGORIES,
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
  type EffectDefinition,
  type EffectPreset,
  type ShaderEffect,
  type VectorControl,
  type VectorEffect,
  type VideoUse,
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
  ...interactionShaders,
  ...pyroShaders,
  ...timewarpShaders,
  ...meltShaders,
  ...electricShaders,
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
  ...transitions,
];

/** Every effect in the catalog, shaders first, grouped by category. */
export const EFFECTS: readonly EffectDefinition[] = [...SHADER_EFFECTS, ...vectorEffects, ...textEffects, ...morphEffects, ...interactionEffects, ...pyroEffects, ...timewarpEffects, ...meltEffects, ...electricEffects, ...pixelEffects, ...splatterEffects, ...bubbleEffects, ...stickerEffects, ...trailEffects, ...impactEffects, ...comicEffects].sort(
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
  /** Effects that suit video in one of these ways (shader effects with image controls only). */
  video?: readonly VideoUse[];
}

/** Effects matching a query, in catalog order. */
export function findEffects(query: EffectQuery = {}): EffectDefinition[] {
  const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return EFFECTS.filter((e) => {
    if (query.category && e.category !== query.category) return false;
    if (query.kind && e.kind !== query.kind) return false;
    if (query.tags && !query.tags.every((t) => e.tags.includes(t))) return false;
    if (query.video && !(e.kind === "shader" && e.video && query.video.includes(e.video))) return false;
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
  // A vector effect's colours may also follow the text around it.
  const keep = (c: ControlDef) => effect.kind === "vector" && c.color && isCurrentColor(merged[c.name]);
  return Object.fromEntries(effectControls(effect).map((c) => [c.name, keep(c) ? CURRENT_COLOR : controlValue(c, merged)]));
}
