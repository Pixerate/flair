/**
 * `@pixerate/flair/react` for pages on a budget: `<FlairEffect>`,
 * `<VectorEffect>`, `<SvgPlayerView>` and `useFlairMoment()`, with effects
 * by id loaded one by one through the lazy catalog
 * (`@pixerate/flair/catalog/lazy`) rather than the whole catalog up front, so
 * a loader or a moment on a hot path costs its own few kilobytes.
 *
 * `<FlairEffect>` mounts once its effect has loaded (an error goes to
 * `onError`); `<VectorEffect>` takes an effect you have loaded
 * (`await loadEffect("drip-text")`), since it renders its still on the server.
 *
 * Needs React 18 or later (an optional peer dependency of the package).
 *
 * @packageDocumentation
 */

import { getLoadedEffect } from "../catalog/load.js";
import { mountEffect, playMoment } from "../embed/lazy.js";
import { createFlairEffect, createUseFlairMoment, createVectorEffect } from "./core.js";

export { getLoadedEffect, loadEffect, loadEffects } from "../catalog/load.js";
export {
  SvgPlayerView,
  type FlairEffectProps,
  type FlairMomentPlayer,
  type ReducedMotion,
  type SvgMotion,
  type SvgPlayer,
  type SvgPlayerViewProps,
  type SvgTrigger,
  type VectorEffectProps,
} from "./core.js";

/**
 * Plays a vector effect, given as its definition or by the id of one
 * already loaded (`await loadEffect(id)` from `@pixerate/flair/catalog/lazy`
 * first): it renders its still on the server, so it cannot wait for one to load.
 */
export const VectorEffect = createVectorEffect(getLoadedEffect, " that has been loaded (await loadEffect(id) first)");

/**
 * Any catalog effect, shader or vector, applied to a subject, as
 * `<FlairEffect>` in `@pixerate/flair/react` does, loading an effect given
 * by id first (nothing is drawn until it has loaded).
 *
 * ```tsx
 * <FlairEffect effect="liquid-loader" data={{ value: job.progress ?? null }} label="Generating" style={{ height: 120 }} />
 * ```
 */
export const FlairEffect = createFlairEffect(mountEffect);

/** `useFlairMoment()` as in `@pixerate/flair/react`, loading the effect when it first plays. */
export const useFlairMoment = createUseFlairMoment(playMoment);
