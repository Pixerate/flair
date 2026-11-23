/**
 * The catalog, lazily: every effect's metadata (id, name, category,
 * description, tags, controls, presets' names, inputs, video use) up front,
 * at a fraction of the full catalog's size, and each effect's shader or
 * picture loaded when it is asked for with {@link loadEffect}. Effects are
 * stored in small modules of related effects, so loading one brings at most
 * a few neighbours. Use it where the catalog is browsed, searched or offered
 * to an agent, and only some effects are drawn; `@pixerate/flair/catalog`
 * stays the synchronous catalog with everything in it.
 *
 * @packageDocumentation
 */

import { unpackMeta, type EffectMeta, type PackedMeta } from "./meta.js";
import PACKED from "./meta.generated.json" with { type: "json" };
import { countTags, matchesQuery, queryWords, type EffectQuery, type EffectTag } from "./query.js";

export type { EffectMeta } from "./meta.js";
export { normaliseTag, TAG_FORMAT, type EffectQuery, type EffectTag } from "./query.js";
export { EFFECT_CATEGORIES, EFFECT_CATEGORY_GROUPS, VIDEO_USES, type EffectCategory, type EffectDefinition, type ShaderEffect, type VectorEffect, type VideoUse } from "./types.js";
export { PAINT_HINTS, PAINT_MAPS, PAINT_REPEATS, paintHint, type EffectPaintHint, type PaintMap, type PaintRepeat } from "./paint.js";
export {
  effectUi,
  UI_COLOR_ROLES,
  UI_HINTS,
  uiContentHash,
  uiHint,
  uiValues,
  type EffectUiHint,
  type JsonSchemaDocument,
  type JsonValue,
  type UiA11y,
  type UiBindings,
  type UiComponentContract,
  type UiComponentGroup,
  type UiDescriptor,
  type UiEvent,
  type UiInput,
  type UiPlatformTarget,
  type UiSizing,
  type UiStateField,
} from "./ui-hints.js";
export { EFFECT_INPUTS, EFFECT_INTERACTIONS, type EffectInput, type EffectInputs, type EffectInteraction } from "./inputs.js";

const entries = (PACKED as unknown as PackedMeta[]).map(unpackMeta);

/** Every effect's metadata, in catalog order (as `EFFECTS`). */
export const EFFECT_META: readonly EffectMeta[] = entries.map(({ module: _, ...meta }) => meta);
const metaById = new Map(EFFECT_META.map((m) => [m.id, m]));

/** An effect's metadata by id, or undefined. */
export function getEffectMeta(id: string): EffectMeta | undefined {
  return metaById.get(id);
}

/** Effects' metadata matching a query, in catalog order: the same query and answers as `findEffects`. */
export function findEffectMeta(query: EffectQuery = {}): EffectMeta[] {
  const words = queryWords(query);
  return EFFECT_META.filter((m) => matchesQuery(m, () => m.inputs, query, words));
}

/** The tags of the effects matching a query, with how many carry each, the most used first: the same answer as the catalog's `effectTags`. */
export function effectTags(query: EffectQuery = {}): EffectTag[] {
  return countTags(findEffectMeta(query));
}

export { getLoadedEffect, loadEffect, loadEffects } from "./load.js";
