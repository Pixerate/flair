/**
 * What every effect has, worked out from the effect itself: its controls,
 * defaults, inputs and whether it draws alpha. Kept apart from the catalog's
 * list of effects, so code that is handed effects (the lazy wrappers, the
 * embed core) can use these without loading every effect.
 */

import { controlValue, parseControls, type ControlDef, type ControlValue } from "../shader/controls.js";
import { inputsOf, type EffectInputs } from "./inputs.js";
import { CURRENT_COLOR, isCurrentColor, vectorControlDef, vectorEffectControls, type EffectDefinition } from "./types.js";

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


/** An effect's controls: a shader's `@control` uniforms, or a vector effect's, camera move's, timing effect's or text treatment's declared controls. */
export function effectControls(effect: EffectDefinition): ControlDef[] {
  if (effect.kind === "camera" || effect.kind === "timing" || effect.kind === "text-treatment") return effect.controls.map((c, i) => vectorControlDef(c, i + 1));
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


/**
 * Seconds of `iTime` a shader effect shows, still, under reduced motion: its
 * `rest`, else its `build` (once it has settled), else 1. Undefined for
 * effects that are not shaders.
 */
export function shaderRestTime(effect: EffectDefinition): number | undefined {
  if (effect.kind !== "shader") return undefined;
  return effect.rest ?? effect.build ?? 1;
}
