/**
 * `@pixerate/flair/svelte` for pages on a budget: the `flairEffect`,
 * `flairMoment` and `vectorEffect` actions, with effects by id loaded one by
 * one rather than the whole catalog up front, so a loader or a moment on a
 * hot path costs its own few kilobytes.
 *
 * `flairEffect` mounts once its effect has loaded (an error goes to
 * `onError`). `vectorEffect` and `vectorEffectStill` render a still on the
 * server, so they take an effect you have loaded (`await loadEffect(id)`) or
 * its definition.
 *
 * Needs Svelte 5 (an optional peer dependency of the package); only its types
 * are imported.
 *
 * @packageDocumentation
 */

import type { ActionReturn } from "svelte/action";
import { getLoadedEffect } from "../catalog/load.js";
import { mountEffect, playMoment } from "../embed/lazy.js";
import { flairEffectWith, flairMomentWith, vectorEffectStillWith, vectorEffectWith, type FlairEffectParams, type FlairMomentParams, type LookUp, type VectorEffectParams, type VectorEffectStill } from "./core.js";

export { getLoadedEffect, loadEffect, loadEffects } from "../catalog/load.js";
export type {
  FlairEffectParams,
  FlairMomentParams,
  ReducedMotion,
  SvgMotion,
  SvgMotionParams,
  SvgPlayer,
  SvgPlayerParams,
  SvgTrigger,
  VectorEffectByIdParams,
  VectorEffectParams,
  VectorEffectStill,
} from "./core.js";

const loadedOnly: LookUp = (id) => {
  const effect = getLoadedEffect(id);
  if (!effect) throw new Error(`"${id}" has not been loaded; await loadEffect("${id}") first, or pass the effect itself.`);
  return effect;
};

/** The still of a loaded vector effect (or a motion), as `vectorEffectStill` in `@pixerate/flair/svelte`. */
export function vectorEffectStill(params: VectorEffectParams): VectorEffectStill {
  return vectorEffectStillWith(loadedOnly, params);
}

/** Plays a loaded vector effect (or a motion), as the `vectorEffect` action in `@pixerate/flair/svelte`. */
export function vectorEffect(node: HTMLElement, initial: VectorEffectParams): ActionReturn<VectorEffectParams> {
  return vectorEffectWith(loadedOnly, node, initial);
}

/** Any catalog effect, as the `flairEffect` action in `@pixerate/flair/svelte`, loading one given by id first. */
export function flairEffect(node: HTMLElement, initial: FlairEffectParams): ActionReturn<FlairEffectParams> {
  return flairEffectWith(mountEffect, node, initial);
}

/** Plays an effect once over the element, as the `flairMoment` action in `@pixerate/flair/svelte`, loading it when it first plays. */
export function flairMoment(node: HTMLElement, initial: FlairMomentParams): ActionReturn<FlairMomentParams> {
  return flairMomentWith(playMoment, node, initial);
}
