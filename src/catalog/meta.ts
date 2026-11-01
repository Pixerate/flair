/**
 * What the catalog knows about an effect without its source: enough to list,
 * search and describe it, and to build a form for its controls, before (or
 * without) loading its shader or picture. The lazy catalog
 * (`@pixerate/flair/catalog/lazy`) ships this for every effect, and loads
 * each effect's source when it is asked for.
 */

import { humanise, type ControlDef, type ControlValue } from "../shader/controls.js";
import type { EffectInputs } from "./inputs.js";
import { SAMPLE_IMAGES } from "./images.js";
import type { CameraRole, EffectCategory, EffectDefinition, VideoUse } from "./types.js";
import type { SvgTrigger } from "../vector/svg.js";

export interface EffectMeta {
  id: string;
  name: string;
  kind: EffectDefinition["kind"];
  category: EffectCategory;
  /** One sentence: what it looks like. */
  description: string;
  tags: readonly string[];
  /** Its controls, as `effectControls` gives them. */
  controls: readonly ControlDef[];
  /** Its presets' names (their values come with the effect). */
  presets: readonly string[];
  /** What it takes and how it answers the pointer (see `effectInputs`). */
  inputs: EffectInputs;
  /** How a shader suits video in its image controls. */
  video?: VideoUse;
  /** A shader drawn over other content (render it with `alpha`). */
  transparent?: boolean;
  /** Seconds after which a shader repeats exactly. */
  loop?: number;
  /** Ms a vector effect rests on its last frame before it loops. */
  hold?: number;
  /** What makes a vector effect play, when not a loop. */
  trigger?: SvgTrigger;
  /** What a camera move is for: getting into a shot (`transition`) or moving while it holds (`hold`). */
  role?: CameraRole;
  /** Whether it moves over time (a shader reading `iTime`, or any vector effect or camera move), rather than a still treatment. */
  animated: boolean;
  /**
   * Ms of one play: a shader's `loop`, a vector effect's picture (at its
   * default values) plus its `hold`, or a camera move's own length.
   * Undefined for a shader with no loop.
   */
  duration?: number;
}

/** An effect's metadata, from its definition (given its controls and inputs, which the catalog works out). */
export function metaOf(effect: EffectDefinition, controls: readonly ControlDef[], inputs: EffectInputs, duration?: number): EffectMeta {
  return {
    id: effect.id,
    name: effect.name,
    kind: effect.kind,
    category: effect.category,
    description: effect.description,
    tags: effect.tags,
    controls,
    presets: (effect.presets ?? []).map((p) => p.name),
    inputs,
    ...(effect.kind === "shader"
      ? { ...(effect.video && { video: effect.video }), ...(effect.transparent && { transparent: true }), ...(effect.loop !== undefined && { loop: effect.loop }) }
      : effect.kind === "vector"
        ? { ...(effect.hold !== undefined && { hold: effect.hold }), ...(effect.trigger && { trigger: effect.trigger }) }
        : { role: effect.motion.role }),
    animated: effect.kind !== "shader" || /\biTime\b/.test(effect.source),
    ...(duration !== undefined && { duration }),
  };
}

/**
 * A control, compactly: what `controlFromDeclaration` would have worked out
 * anyway (a humanised label, the default range and step, mipmapped repeating
 * textures) is left out, and sample images are named rather than inlined.
 */
type PackedControl = Record<string, unknown> & { n: string; t: ControlDef["type"]; d: ControlValue | { sample: string } | { c255: number[] } };

/** A colour's channels as whole steps of 1/255, when they are exactly that (as colours from hex are). */
function bytes(value: ControlValue): number[] | undefined {
  if (!Array.isArray(value) || !value.every((v) => Math.round(v * 255) / 255 === v)) return undefined;
  return value.map((v) => Math.round(v * 255));
}

const SAMPLE_NAMES = new Map<string, string>(Object.entries(SAMPLE_IMAGES).map(([name, url]) => [url, name]));

export function packControl(c: ControlDef): PackedControl {
  const { name, type, label, color, min, max, step, default: def, line, texture, limits, ...rest } = c;
  const c255 = color ? bytes(def) : undefined;
  const d = typeof def === "string" && SAMPLE_NAMES.has(def) ? { sample: SAMPLE_NAMES.get(def)! } : c255 ? { c255 } : def;
  const packed: PackedControl = { n: name, t: type, d, ...rest };
  if (label !== humanise(name)) packed.l = label;
  if (color) packed.c = 1;
  if (min !== 0) packed.min = min;
  if (max !== (type === "int" ? 10 : 1)) packed.max = max;
  if (step !== (type === "int" ? 1 : (max - min) / 200)) packed.s = step;
  // Declared limits are the range's own ends: 1 the low one, 2 the high one, 3 both.
  if (limits) packed.b = (limits.min !== undefined ? 1 : 0) + (limits.max !== undefined ? 2 : 0);
  if (line) packed.line = line;
  if (texture && (texture.filter !== "mipmap" || texture.wrap !== "repeat")) packed.x = texture;
  else if (texture) packed.x = 1;
  return packed;
}

export function unpackControl(p: PackedControl): ControlDef {
  const { n, t, d, l, c, min, max, s, line, x, b, ...rest } = p;
  const lo = (min as number | undefined) ?? 0;
  const hi = (max as number | undefined) ?? (t === "int" ? 10 : 1);
  const control: ControlDef = {
    name: n,
    type: t,
    label: (l as string | undefined) ?? humanise(n),
    color: Boolean(c),
    min: lo,
    max: hi,
    step: (s as number | undefined) ?? (t === "int" ? 1 : (hi - lo) / 200),
    default: typeof d !== "object" || d === null || Array.isArray(d) ? d : "c255" in d ? d.c255.map((v) => v / 255) : (SAMPLE_IMAGES as Record<string, string>)[d.sample]!,
    line: (line as number | undefined) ?? 0,
    ...rest,
  };
  if (typeof b === "number" && b > 0) control.limits = { ...(b & 1 && { min: lo }), ...(b & 2 && { max: hi }) };
  if (x !== undefined) control.texture = x === 1 ? { filter: "mipmap", wrap: "repeat" } : (x as ControlDef["texture"]);
  return control;
}

/** One effect's metadata as stored: compact controls, and the module its source is in. */
export type PackedMeta = Omit<EffectMeta, "controls"> & { controls: PackedControl[]; module: string };

export function packMeta(meta: EffectMeta, module: string): PackedMeta {
  return { ...meta, controls: meta.controls.map(packControl), module };
}

export function unpackMeta(packed: PackedMeta): EffectMeta & { module: string } {
  return { ...packed, controls: packed.controls.map(unpackControl) };
}
