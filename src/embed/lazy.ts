/**
 * `@pixerate/flair/embed` for pages on a budget: the same `mountEffect`,
 * `playMoment` and subject helpers, with effects by id loaded one by one
 * (as the lazy catalog's `loadEffect` does, from a compact index of which
 * module holds each effect) instead of the whole catalog up front. A loader or a moment on a hot path
 * costs its own few kilobytes, not the catalog's hundreds.
 *
 * The one difference: `mountEffect` settles once the effect has loaded, so
 * it returns a promise of the `MountedEffect`. An effect given as a
 * definition loads nothing.
 *
 * ```ts
 * import { mountEffect, playMoment } from "@pixerate/flair/embed/lazy";
 * const loader = await mountEffect(el, "liquid-loader", { data: { value: null } });
 * loader.setData?.({ value: 0.4 });
 * playMoment(card, "confetti");
 * ```
 *
 * @packageDocumentation
 */

import { loadEffect } from "../catalog/load.js";
import type { EffectDefinition } from "../catalog/types.js";
import { mountDefinition, type KindMounters, type MountedEffect, type MountOptions } from "./mount.js";
import { playMomentWith, type MomentAnchor, type MomentOptions } from "./moment.js";

export { resolveSubject, subjectValues, type EffectSubject, type MountedEffect, type MountOptions, type SubjectValues } from "./mount.js";
export { momentLength, type MomentAnchor, type MomentOptions } from "./moment.js";
export { getLoadedEffect, loadEffect, loadEffects } from "../catalog/load.js";
export { preloadImages, releaseImages } from "../shader/textures.js";
export { UI_HINTS, uiValues, type JsonValue, type UiDescriptor } from "../catalog/ui-hints.js";

/** The effect, loading it from the lazy catalog when it is given by id. */
export async function resolveEffect(effect: EffectDefinition | string): Promise<EffectDefinition> {
  return typeof effect === "string" ? loadEffect(effect) : effect;
}

/**
 * Loads the effect (when given by id) and runs it in `host`, as `mountEffect`
 * in `@pixerate/flair/embed` does. Rejects with a sentence for an id the
 * catalog does not have, naming the nearest ones.
 */
export async function mountEffect(host: HTMLElement, effect: EffectDefinition | string, options: MountOptions = {}): Promise<MountedEffect> {
  const def = await resolveEffect(effect);
  // Timing effects and text treatments bring their own players, loaded only when one is mounted.
  let kinds: KindMounters | undefined;
  if (def.kind === "timing" || def.kind === "text-treatment") {
    const [{ mountTiming }, { previewTextTreatment }] = await Promise.all([import("./timing.js"), import("./treatment.js")]);
    kinds = { mountTiming, previewTextTreatment };
  }
  return mountDefinition(host, def, options, kinds);
}

/**
 * Loads the effect (when given by id) and plays it once over `anchor`, as
 * `playMoment` in `@pixerate/flair/embed` does: settles `true` once it has
 * played and removed itself, `false` when it played nothing (reduced
 * motion, no WebGL2, the anchor gone, aborted).
 */
export function playMoment(anchor: MomentAnchor, effect: EffectDefinition | string, options: MomentOptions = {}): Promise<boolean> {
  return playMomentWith(anchor, () => resolveEffect(effect), options);
}
