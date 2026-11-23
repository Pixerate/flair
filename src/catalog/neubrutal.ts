import type { ControlValue } from "../shader/controls.js";
import { parseControls } from "../shader/controls.js";
import { vectorEffectControls, type EffectDefinition, type EffectPreset } from "./types.js";

/*
 * Neubrutalism: flat colour, thick near-black ink and hard shadows with no
 * blur. Two things here:
 *
 * - The shared optional controls a vector effect can take so it can go flat
 *   (`shadowStyle`, `shadowOffset`, `inkWidth`, `sheen` and the ink colour),
 *   with the shadow filter and derived values they drive.
 * - The cross-effect "Neubrutal" preset: for the sticker, comic, splatter,
 *   icon and loader effects, the palette below mapped onto each effect's own
 *   colour controls (ink to its outlines and text, the brights to the rest),
 *   with a hard shadow wherever the effect has the shared controls.
 */

/** The Neubrutal palette: ink, four brights, and an 8 px zero-blur shadow. */
export const NEUBRUTAL = {
  ink: "#09090b",
  pink: "#ff2a85",
  cyan: "#06b6d4",
  yellow: "#facc15",
  purple: "#c084fc",
  paper: "#ffffff",
  shadowOffset: 8,
} as const;

/** The categories whose effects get the "Neubrutal" preset. */
export const NEUBRUTAL_CATEGORIES = ["sticker", "comic", "splatter", "icon", "loader"] as const;

/**
 * The shared style controls, as vector placeholders to put in a picture's
 * declaration comment, with defaults for the effect (a soft, glossy sticker
 * by default; a flat one passes `style: 1` and `sheen: 0`).
 */
export function styleControls(defaults: { style?: 0 | 1; offset?: number; ink?: number; sheen?: number; inkColor?: string } = {}): string {
  return [
    `{{shadowStyle: int min=0 max=1 default=${defaults.style ?? 0} label='Shadow (0 soft, 1 hard)'}}`,
    `{{shadowOffset: float min=0 max=16 step=1 default=${defaults.offset ?? NEUBRUTAL.shadowOffset} label='Hard shadow offset'}}`,
    `{{inkWidth: float min=0 max=8 step=0.5 default=${defaults.ink ?? 0} label='Ink outline width'}}`,
    `{{inkColor: color default=${defaults.inkColor ?? "#09090B"} label='Ink'}}`,
    `{{sheen: float min=0 max=1 step=0.05 default=${defaults.sheen ?? 1} label='Sheen'}}`,
  ].join(" ");
}

/**
 * What the shared controls work out to, for an effect's `derived`: the
 * shadow's offset, blur and opacity (`shDx`, `shDy`, `shBlur`, `shAlpha`;
 * a hard shadow is offset by `shadowOffset` with no blur, fully opaque),
 * the ink outline's opacity (`inkOn`) and the sheen's opacity (`sheenA`).
 * `soft` is the effect's own soft shadow.
 */
export function styleDerived(v: Record<string, ControlValue>, soft: { dy?: number; blur?: number; alpha?: number } = {}): Record<string, number> {
  const hard = Math.round(Number(v.shadowStyle ?? 0)) === 1;
  const offset = Number(v.shadowOffset ?? NEUBRUTAL.shadowOffset);
  return {
    shDx: hard ? offset : 0,
    shDy: hard ? offset : (soft.dy ?? 5),
    shBlur: hard ? 0 : (soft.blur ?? 4),
    shAlpha: hard ? 1 : (soft.alpha ?? 0.3),
    inkOn: Number(v.inkWidth ?? 0) > 0 ? 1 : 0,
    sheenA: Math.max(0, Math.min(1, Number(v.sheen ?? 1))),
  };
}

/** The shadow filter the shared controls drive (see {@link styleDerived}), by id. */
export const styleShadow = (id: string) =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="{{shDx}}" dy="{{shDy}}" stdDeviation="{{shBlur}}" flood-color="{{inkColor}}" flood-opacity="{{shAlpha}}"/></filter>`;

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => Math.round(c * 1000) / 1000) as [number, number, number];
};

/** Colour controls that are ink: outlines, text, lines, shadows. */
const INKY = /ink|outline|stroke|line|text|label|word|frame|shadow|edge|rim|border|hand|needle|digit|letter|font|dark/i;
/** Colour controls that are the page or a card behind things. */
const PAPERY = /background|backdrop|paper|page|card|sheet|surface|bg\b|backing|glass|track|vat|panel/i;

/**
 * An effect's "Neubrutal" values: its colour controls from the palette (ink
 * for outlines and text, paper for cards and pages, the brights in turn for
 * the rest; a shader's background is left as it is, so it stays clear), a
 * hard shadow and no sheen where it has the shared controls. Undefined when
 * it has fewer than two colour controls to set.
 */
export function neubrutalValues(effect: EffectDefinition): Record<string, ControlValue> | undefined {
  if (effect.kind !== "vector" && effect.kind !== "shader") return undefined;
  const controls = effect.kind === "shader" ? parseControls(effect.source) : vectorEffectControls(effect);
  const brights = [NEUBRUTAL.pink, NEUBRUTAL.cyan, NEUBRUTAL.yellow, NEUBRUTAL.purple];
  const values: Record<string, ControlValue> = {};
  let next = 0;
  for (const c of controls) {
    if (!c.color || c.type !== "vec3") continue;
    const words = `${c.name} ${c.label}`;
    if (effect.kind === "shader" && /^uBack(ground|drop)$/.test(c.name)) continue;
    if (INKY.test(words) && !/background/i.test(words)) values[c.name] = hex(NEUBRUTAL.ink);
    else if (PAPERY.test(words)) values[c.name] = hex(effect.kind === "vector" && /background|page/i.test(words) ? NEUBRUTAL.yellow : NEUBRUTAL.paper);
    else values[c.name] = hex(brights[next++ % brights.length]!);
  }
  if (Object.keys(values).length < 2) return undefined;
  const names = new Set(controls.map((c) => c.name));
  if (names.has("shadowStyle")) values.shadowStyle = 1;
  if (names.has("shadowOffset")) values.shadowOffset = NEUBRUTAL.shadowOffset;
  if (names.has("sheen")) values.sheen = 0;
  if (names.has("inkWidth")) values.inkWidth = 3;
  if (names.has("inkColor")) values.inkColor = hex(NEUBRUTAL.ink);
  return values;
}

/**
 * Gives an effect in one of {@link NEUBRUTAL_CATEGORIES} its "Neubrutal"
 * preset (see {@link neubrutalValues}), unless it has one of its own.
 * Changes the effect in place and returns it; the catalog (full and lazy)
 * does this as it lists or loads its effects, so both carry the preset.
 */
export function withNeubrutal<T extends EffectDefinition>(effect: T): T {
  if (!(NEUBRUTAL_CATEGORIES as readonly string[]).includes(effect.category)) return effect;
  if (effect.presets?.some((p) => p.name === "Neubrutal")) return effect;
  const values = neubrutalValues(effect);
  if (!values) return effect;
  const preset: EffectPreset = { name: "Neubrutal", values };
  (effect as { presets?: readonly EffectPreset[] }).presets = [...(effect.presets ?? []), preset];
  return effect;
}
