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

import { didYouMean } from "../motion/params.js";
import { unpackMeta, type EffectMeta, type PackedMeta } from "./meta.js";
import PACKED from "./meta.generated.json" with { type: "json" };
import { EFFECT_MODULES } from "./modules.generated.js";
import { matchesQuery, queryWords, type EffectQuery } from "./query.js";
import type { EffectDefinition } from "./types.js";

export type { EffectMeta } from "./meta.js";
export type { EffectQuery } from "./query.js";
export { EFFECT_CATEGORIES, EFFECT_CATEGORY_GROUPS, VIDEO_USES, type EffectCategory, type EffectDefinition, type ShaderEffect, type VectorEffect, type VideoUse } from "./types.js";
export { EFFECT_INPUTS, EFFECT_INTERACTIONS, type EffectInput, type EffectInputs, type EffectInteraction } from "./inputs.js";

const entries = (PACKED as unknown as PackedMeta[]).map(unpackMeta);
const byId = new Map(entries.map((e) => [e.id, e]));

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

const loaded = new Map<string, EffectDefinition>();
const loading = new Map<string, Promise<EffectDefinition>>();

/** Every effect a module exports, alone or in lists. */
function effectsIn(module: Record<string, unknown>): EffectDefinition[] {
  const isEffect = (v: unknown): v is EffectDefinition => !!v && typeof v === "object" && "id" in v && "kind" in v && ((v as { kind: unknown }).kind === "shader" || (v as { kind: unknown }).kind === "vector");
  return Object.values(module).flatMap((v) => (Array.isArray(v) ? v.filter(isEffect) : isEffect(v) ? [v] : []));
}

/**
 * The effect with this id, with its source (or picture) and presets, loaded
 * on first use (the same object every time after). Rejects for an id the
 * catalog does not have, naming the nearest ones.
 */
export function loadEffect(id: string): Promise<EffectDefinition> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  const pending = loading.get(id);
  if (pending) return pending;
  const entry = byId.get(id);
  if (!entry) {
    return Promise.reject(new Error(`There is no effect ${JSON.stringify(id)} in the catalog.${didYouMean(id, [...byId.keys()])} findEffectMeta lists them.`));
  }
  const load = EFFECT_MODULES[entry.module]!().then((module) => {
    for (const effect of effectsIn(module)) if (byId.has(effect.id) && !loaded.has(effect.id)) loaded.set(effect.id, effect);
    const effect = loaded.get(id);
    if (!effect) throw new Error(`The catalog module "${entry.module}" does not have the effect "${id}".`);
    return effect;
  });
  loading.set(id, load);
  load.then(
    () => loading.delete(id),
    () => loading.delete(id),
  );
  return load;
}

/** Loads several effects at once (in the order given). */
export function loadEffects(ids: readonly string[]): Promise<EffectDefinition[]> {
  return Promise.all(ids.map(loadEffect));
}

/** The effect with this id if it has been loaded already, else undefined (see {@link loadEffect}). */
export function getLoadedEffect(id: string): EffectDefinition | undefined {
  return loaded.get(id);
}
