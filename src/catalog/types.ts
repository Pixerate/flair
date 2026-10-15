import {
  checkControlValue,
  controlFromDeclaration,
  hexToRgb,
  rgbToHex,
  type ControlDef,
  type ControlType,
  type ControlValue,
} from "../shader/controls.js";
import type { SvgMotion } from "../vector/motion.js";
import type { SvgTrigger } from "../vector/svg.js";

/** What an effect is for, used to group the catalog. */
export type EffectCategory =
  | "gradient"
  | "organic"
  | "pattern"
  | "light"
  | "space"
  | "retro"
  | "image"
  | "overlay"
  | "text"
  | "morph"
  | "interaction"
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
  "overlay",
  "text",
  "morph",
  "interaction",
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
  /**
   * Draws over other content: `fragColor.a` is coverage (0 where there is
   * nothing to draw), so render it on a transparent canvas
   * (`ShaderRenderer`'s `alpha` option) to layer it over a page or picture.
   */
  transparent?: boolean;
}

/**
 * A control of a vector effect, declared in a list rather than in the
 * picture (see {@link VectorEffect.controls}). The same shape as a shader's
 * controls (see `ControlDef`) less what only sources have; `vec3` colours
 * are written into the picture as `#rrggbb`.
 */
export type VectorControl = Pick<ControlDef, "name" | "type" | "default"> &
  Partial<Pick<ControlDef, "label" | "color" | "min" | "max" | "step">>;

/**
 * An animated SVG picture (see `SvgMotion`) whose controls are declared in
 * the picture itself, the way a shader's are declared in its source. The
 * first `{{name: type …}}` declares a control and every `{{name}}` is
 * replaced by its value (see {@link vectorControls} and
 * {@link renderVectorEffect}); run the result with `SvgPlayer`.
 */
export interface VectorEffect extends EffectBase {
  kind: "vector";
  motion: SvgMotion;
  /**
   * Controls declared outside the picture, for effects written before
   * controls were declared inline. A control declared in the picture wins
   * over one of the same name here.
   */
  controls?: readonly VectorControl[];
  /**
   * More placeholders worked out from the control values (a bar's height
   * from its value, say), filled in after the controls.
   */
  derived?: (values: Record<string, ControlValue>) => Record<string, string | number>;
  /** Ms to rest on the last frame before it loops (default 600). */
  hold?: number;
  /**
   * Plays in answer to the pointer rather than on a loop: pass it to
   * `SvgPlayer` (`{ trigger: effect.trigger }`). Click-triggered pictures
   * change on steps, each click playing the next.
   */
  trigger?: SvgTrigger;
}

export type EffectDefinition = ShaderEffect | VectorEffect;

/** The types a vector effect's `{{name: type …}}` placeholder can declare. */
export const VECTOR_CONTROL_TYPES = ["float", "int", "bool", "color", "text"] as const;

/**
 * A placeholder: `{{name}}`, or a declaration `{{name: type attributes}}`
 * whose attributes are a shader `@control`'s (`min`, `max`, `step`,
 * `default`, `label`). Quote values with spaces in single quotes inside an
 * SVG attribute: `fill="{{accent: color default=#6366F1 label='Accent'}}"`.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z_]\w*)\s*(?::\s*([A-Za-z0-9]*)([^}]*))?\}\}/g;

/** Every string in a motion, the markup first, then each animation's values in order. */
function motionStrings(motion: SvgMotion): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(motion);
  return out;
}

/**
 * The controls a vector effect's picture declares, in the order they are
 * first declared: `{{word: text default=SLOP label=Word}}`, `{{accent:
 * color default=#6366F1}}`, `{{width: float min=2 max=20 default=8 step=1}}`,
 * `{{shadow: bool default=true}}`. A name declared twice counts once (the
 * first wins), and declarations with an unknown type are left out (see
 * {@link vectorControlIssues}). A control only `derived` reads can be
 * declared in an XML comment: `<!-- {{drip: float default=1}} -->`.
 */
export function vectorControls(motion: SvgMotion): ControlDef[] {
  const controls: ControlDef[] = [];
  const seen = new Set<string>();
  for (const text of motionStrings(motion)) {
    for (const [, name, type, attributes] of text.matchAll(PLACEHOLDER)) {
      if (type === undefined || seen.has(name!) || !(VECTOR_CONTROL_TYPES as readonly string[]).includes(type)) continue;
      seen.add(name!);
      const colour = type === "color";
      controls.push(controlFromDeclaration(name!, colour ? "vec3" : (type as ControlType), `${attributes}${colour ? " color" : ""}`, controls.length + 1));
    }
  }
  return controls;
}

/** A vector effect's controls: those its picture declares, then any in its `controls` list it does not. */
export function vectorEffectControls(effect: Pick<VectorEffect, "motion" | "controls">): ControlDef[] {
  const declared = vectorControls(effect.motion);
  const names = new Set(declared.map((c) => c.name));
  const listed = (effect.controls ?? []).filter((c) => !names.has(c.name));
  return [...declared, ...listed.map((c, i) => vectorControlDef(c, declared.length + i + 1))];
}

/**
 * Problems with a picture's placeholders, as sentences: declarations of an
 * unknown type, and a name declared twice in different ways.
 */
export function vectorControlIssues(motion: SvgMotion): string[] {
  const issues: string[] = [];
  const declarations = new Map<string, string>();
  for (const text of motionStrings(motion)) {
    for (const [whole, name, type] of text.matchAll(PLACEHOLDER)) {
      if (type === undefined) continue;
      if (!(VECTOR_CONTROL_TYPES as readonly string[]).includes(type))
        issues.push(`${whole}: a control's type is one of ${VECTOR_CONTROL_TYPES.join(", ")}`);
      else if (declarations.has(name!) && declarations.get(name!) !== whole)
        issues.push(`"${name}" is declared twice; declare it once and write {{${name}}} everywhere else`);
      else declarations.set(name!, whole);
    }
  }
  return issues;
}

/** A vector control's value written into the picture: colours as hex, vectors space-separated, the rest as they are. */
function written(control: Pick<ControlDef, "color">, value: ControlValue): string | number | boolean {
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value.join(" ");
  return value;
}

const escapeMarkup = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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
 * A vector effect's motion with its controls filled in. A string that is
 * only a placeholder (an animation's `"{{width}}"`) becomes the value
 * itself, so numbers stay numbers; elsewhere a placeholder becomes its text,
 * escaped in the markup so any text is safe to show. Comments are dropped
 * from the markup. Colours also take "#RRGGBB"; missing values, and values a
 * control cannot take, use defaults. Placeholders no control or derived
 * value fills stay put.
 */
export function renderVectorEffect(
  effect: Pick<VectorEffect, "motion" | "controls" | "derived">,
  values: Record<string, ControlValue> = {},
): SvgMotion {
  const filled: Record<string, ControlValue> = {};
  const placeholders = new Map<string, string | number | boolean>();
  for (const control of vectorEffectControls(effect)) {
    const given = values[control.name];
    const check = given === undefined ? undefined : checkControlValue(control, given);
    filled[control.name] = check?.ok ? check.value : control.default;
    placeholders.set(control.name, written(control, filled[control.name]!));
  }
  for (const [name, value] of Object.entries(effect.derived?.(filled) ?? {})) placeholders.set(name, value);
  const fill = (text: string, markup: boolean): string | number | boolean => {
    const whole = /^\{\{\s*([A-Za-z_]\w*)\s*(?::[^}]*)?\}\}$/.exec(text);
    if (!markup && whole && placeholders.has(whole[1]!)) return placeholders.get(whole[1]!)!;
    return text.replace(PLACEHOLDER, (match, name: string) => {
      if (!placeholders.has(name)) return match;
      const value = String(placeholders.get(name));
      return markup ? escapeMarkup(value) : value;
    });
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fill(v, false);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const { svg, ...rest } = effect.motion;
  // Comments hold declarations, not picture, and a value with "--" in one would break the markup.
  return { svg: fill(svg.replace(/<!--[\s\S]*?-->/g, ""), true) as string, ...(walk(rest) as Omit<SvgMotion, "svg">) };
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
