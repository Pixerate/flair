import { hexToRgb, rgbToHex, type ControlDef, type ControlValue } from "../shader/controls.js";
import type { SvgMotion } from "../vector/motion.js";

/** What an effect is for, used to group the catalog. */
export type EffectCategory =
  | "gradient"
  | "organic"
  | "pattern"
  | "light"
  | "space"
  | "retro"
  | "image"
  | "transition"
  | "loader"
  | "data"
  | "icon";

/** Every category, in the order the catalog lists them. */
export const EFFECT_CATEGORIES: readonly EffectCategory[] = [
  "gradient",
  "organic",
  "pattern",
  "light",
  "space",
  "retro",
  "image",
  "transition",
  "loader",
  "data",
  "icon",
];

/** Named control values: a look an effect can be switched to. */
export interface EffectPreset {
  name: string;
  values: Record<string, ControlValue>;
}

interface EffectBase {
  /** Stable id, kebab-case: `aurora`, `image-glitch`. */
  id: string;
  name: string;
  /** One sentence: what it looks like. */
  description: string;
  category: EffectCategory;
  tags: readonly string[];
  presets?: readonly EffectPreset[];
}

/**
 * A WebGL2 fragment shader (Shadertoy-style `mainImage`). Its controls are the
 * `// @control` uniforms in `source`; run it with `ShaderRenderer`,
 * `ShaderFrames`, `ThumbnailPool`, `recordGif` or `standaloneHtml`.
 */
export interface ShaderEffect extends EffectBase {
  kind: "shader";
  source: string;
  /** Seconds after which it repeats exactly, when it loops seamlessly. */
  loop?: number;
}

/**
 * A control of a vector effect. The same shape as a shader's controls (see
 * `ControlDef`) less what only sources have; `vec3` colours are written into
 * the picture as `#rrggbb`.
 */
export type VectorControl = Pick<ControlDef, "name" | "type" | "default"> &
  Partial<Pick<ControlDef, "label" | "color" | "min" | "max" | "step">>;

/**
 * An animated SVG picture (see `SvgMotion`). `{{name}}` in the motion is
 * replaced by the control's value (see {@link renderVectorEffect}); run the
 * result with `SvgPlayer`.
 */
export interface VectorEffect extends EffectBase {
  kind: "vector";
  motion: SvgMotion;
  controls: readonly VectorControl[];
  /**
   * More placeholders worked out from the control values (a bar's height
   * from its value, say), filled in after the controls.
   */
  derived?: (values: Record<string, ControlValue>) => Record<string, string | number>;
  /** Ms to rest on the last frame before it loops (default 600). */
  hold?: number;
}

export type EffectDefinition = ShaderEffect | VectorEffect;

/** A vector control's value written into markup: colours as hex, numbers and booleans as they are. */
function written(control: VectorControl, value: ControlValue): string | number | boolean {
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value.join(" ");
  return value;
}

/** A vector control as a full `ControlDef`, so editors treat both kinds of effect alike. */
export function vectorControlDef(control: VectorControl, line = 0): ControlDef {
  const min = control.min ?? 0;
  return {
    name: control.name,
    type: control.type,
    label: control.label ?? control.name,
    color: control.color ?? false,
    min,
    max: control.max ?? Math.max(min + 1, 1),
    step: control.step ?? (control.type === "int" ? 1 : 0.01),
    default: control.default,
    line,
  };
}

/**
 * A vector effect's motion with its controls filled in: `"{{name}}"` (a
 * whole JSON string) becomes the value itself, so numbers stay numbers, and
 * `{{name}}` inside a string becomes its text. Missing values use defaults.
 */
export function renderVectorEffect(
  effect: Pick<VectorEffect, "motion" | "controls" | "derived">,
  values: Record<string, ControlValue> = {},
): SvgMotion {
  const filled: Record<string, ControlValue> = {};
  const placeholders = new Map<string, string | number | boolean>();
  for (const control of effect.controls) {
    filled[control.name] = values[control.name] ?? control.default;
    placeholders.set(control.name, written(control, filled[control.name]!));
  }
  for (const [name, value] of Object.entries(effect.derived?.(filled) ?? {})) placeholders.set(name, value);
  let json = JSON.stringify(effect.motion);
  for (const [key, value] of placeholders) {
    const name = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    json = json.replace(new RegExp(`"\\{\\{${name}\\}\\}"`, "g"), JSON.stringify(value));
    json = json.replace(new RegExp(`\\{\\{${name}\\}\\}`, "g"), String(value).replace(/["\\]/g, "\\$&"));
  }
  return JSON.parse(json) as SvgMotion;
}

/** A colour control for vector effects. */
export function colorControl(name: string, hex: string, label?: string): VectorControl {
  return { name, type: "vec3", color: true, default: hexToRgb(hex) ?? [1, 1, 1], label: label ?? name };
}

/** A number control for vector effects. */
export function numberControl(
  name: string,
  value: number,
  min: number,
  max: number,
  label?: string,
  step?: number,
): VectorControl {
  return { name, type: "float", default: value, min, max, label: label ?? name, step };
}
