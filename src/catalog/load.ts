/**
 * Loading catalog effects one by one, by id, with nothing up front but a
 * compact index of which module holds each effect (a few kilobytes): what
 * the lazy catalog's `loadEffect` and the lazy entries
 * (`@pixerate/flair/embed/lazy`, `/react/lazy`, `/svelte/lazy`) use. The
 * metadata (names, controls, tags) is the lazy catalog's, and is not needed
 * to load an effect.
 *
 * @internal
 */

import { didYouMean } from "../motion/params.js";
import { EFFECT_IDS, EFFECT_MODULES } from "./modules.generated.js";
import { withNeubrutal } from "./neubrutal.js";
import type { EffectDefinition } from "./types.js";

const moduleById = new Map<string, string>();
for (const [module, ids] of Object.entries(EFFECT_IDS)) for (const id of ids.split(" ")) if (id) moduleById.set(id, module);

const loaded = new Map<string, EffectDefinition>();
const loadingModules = new Map<string, Promise<void>>();

/** Whether the catalog has an effect with this id (loaded or not). */
export function hasEffectId(id: string): boolean {
  return moduleById.has(id);
}

/** Every effect a module exports, alone or in lists. */
function effectsIn(module: Record<string, unknown>): EffectDefinition[] {
  const isEffect = (v: unknown): v is EffectDefinition => !!v && typeof v === "object" && "id" in v && "kind" in v && ["shader", "vector", "camera", "timing", "text-treatment"].includes((v as { kind: string }).kind);
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
  const module = moduleById.get(id);
  if (!module) return Promise.reject(new Error(`There is no effect ${JSON.stringify(id)} in the catalog.${didYouMean(id, [...moduleById.keys()])} findEffectMeta lists them.`));
  let moduleLoad = loadingModules.get(module);
  if (!moduleLoad) {
    moduleLoad = EFFECT_MODULES[module]!().then((exports) => {
      for (const effect of effectsIn(exports)) if (moduleById.get(effect.id) === module && !loaded.has(effect.id)) loaded.set(effect.id, withNeubrutal(effect));
    });
    loadingModules.set(module, moduleLoad);
    moduleLoad.then(
      () => loadingModules.delete(module),
      () => loadingModules.delete(module),
    );
  }
  return moduleLoad.then(() => {
    const effect = loaded.get(id);
    if (!effect) throw new Error(`The catalog module "${module}" does not have the effect "${id}".`);
    return effect;
  });
}

/** Loads several effects at once (in the order given). */
export function loadEffects(ids: readonly string[]): Promise<EffectDefinition[]> {
  return Promise.all(ids.map(loadEffect));
}

/** The effect with this id if it has been loaded already, else undefined (see {@link loadEffect}). */
export function getLoadedEffect(id: string): EffectDefinition | undefined {
  return loaded.get(id);
}
