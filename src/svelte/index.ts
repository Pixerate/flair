/**
 * Svelte 5 bindings for Flair, written as plain TypeScript so they need no
 * Svelte compiler: the `flairEffect` action runs any catalog effect (shader or
 * vector) applied to a picture, video, SVG or words; the `vectorEffect` action plays a catalog
 * effect (or any {@link SvgMotion}) in an element, and `vectorEffectStill`
 * gives the markup and style of its still for server rendering.
 *
 * ```svelte
 * <script>
 *   import { vectorEffect, vectorEffectStill } from "@pixerate/flair/svelte";
 *   const params = { id: "drip-text", values: { word: "Slop" }, loop: false };
 *   const still = vectorEffectStill(params);
 * </script>
 *
 * <span use:vectorEffect={params} style={still.style}>{@html still.markup}</span>
 * ```
 *
 * The still is in place from the first paint; the live `SvgPlayer` takes over
 * after mount and is disposed on destroy. Under `prefers-reduced-motion:
 * reduce` the still stays.
 *
 * `flairMoment` plays an effect once over its element (a change, a result
 * arriving). For a page that should not load the whole catalog, use
 * `@pixerate/flair/svelte/lazy`: the same actions, loading effects by id one
 * by one.
 *
 * Needs Svelte 5 (an optional peer dependency of the package); only its types
 * are imported.
 *
 * @packageDocumentation
 */

import type { ActionReturn } from "svelte/action";
import { getEffect } from "../catalog/index.js";
import { mountEffect, playMoment } from "../embed/index.js";
import { flairEffectWith, flairMomentWith, vectorEffectStillWith, vectorEffectWith, type FlairEffectParams, type FlairMomentParams, type VectorEffectParams, type VectorEffectStill } from "./core.js";

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

/**
 * The still of an effect or motion, for server rendering: put `markup` in the
 * element that has the `vectorEffect` action, with `style` as its style, so
 * the page shows the picture before the player starts (and instead of it
 * under reduced motion), in the room the player will take.
 * Throws when `id` is not a vector effect.
 */
export function vectorEffectStill(params: VectorEffectParams): VectorEffectStill {
  return vectorEffectStillWith(getEffect, params);
}

/**
 * A Svelte action that plays a vector effect in its element:
 * `<span use:vectorEffect={{ id: "drip-text", values: { word: "Slop" }, loop: false }} />`.
 *
 * It makes an `SvgPlayer` in a layer of its own, remakes it when the params
 * change (values by content; `speed` without remaking) and disposes it on
 * destroy. A still from {@link vectorEffectStill} in the element is hidden
 * while the player runs and shown again after; without one, the action makes
 * its own (so reduced motion still shows the picture) and sizes the element
 * from the viewBox, leaving alone any of `position`, `display`, `height`,
 * `aspect-ratio` and `margin` the element's style already sets.
 *
 * For an attachment, `{@attach fromAction(vectorEffect, () => params)}`
 * (`fromAction` is from `svelte/attachments`). Throws when `id` is not a
 * vector effect.
 */
export function vectorEffect(node: HTMLElement, initial: VectorEffectParams): ActionReturn<VectorEffectParams> {
  return vectorEffectWith(getEffect, node, initial);
}

/**
 * Runs any catalog effect, shader or vector, in an element, applied to a
 * subject (see `mountEffect` in `@pixerate/flair/embed`); it fills the
 * element, so size it with CSS. A new subject or values update the running
 * effect; a new effect, preset or playback option starts it again.
 *
 * ```svelte
 * <div use:flairEffect={{ effect: "image-duotone", subject: { image: "/team.jpg" } }} style="aspect-ratio: 16 / 9"></div>
 * <div use:flairEffect={{ effect: "liquid-loader", data: { value: progress }, label: "Generating" }}></div>
 * <div use:flairEffect={{ effect: "toggle-switch", state: { checked }, onEvent: (_, d) => (checked = d.checked), label: "Wi-Fi" }}></div>
 * ```
 */
export function flairEffect(node: HTMLElement, initial: FlairEffectParams): ActionReturn<FlairEffectParams> {
  return flairEffectWith(mountEffect, node, initial);
}

/**
 * A Svelte action that plays an effect once over its element (see
 * `playMoment` in `@pixerate/flair/embed`): on mount, or each time `key`
 * changes. It plays nothing under reduced motion or without WebGL2 for a
 * shader, so keep a CSS fallback; destroying the element stops it.
 *
 * ```svelte
 * <div use:flairMoment={{ effect: "change-pulse", key: item.updatedAt }}>…</div>
 * ```
 */
export function flairMoment(node: HTMLElement, initial: FlairMomentParams): ActionReturn<FlairMomentParams> {
  return flairMomentWith(playMoment, node, initial);
}
