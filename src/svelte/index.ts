/**
 * Svelte 5 bindings for Flair's vector effects, written as plain TypeScript so
 * they need no Svelte compiler: the `vectorEffect` action plays a catalog
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
 * Needs Svelte 5 (an optional peer dependency of the package); only its types
 * are imported.
 *
 * @packageDocumentation
 */

import type { ActionReturn } from "svelte/action";
import { getEffect, effectDefaults } from "../catalog/index.js";
import { renderVectorEffect, type VectorEffect as VectorEffectDefinition } from "../catalog/types.js";
import type { ControlValue } from "../shader/controls.js";
import type { Clock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgFrameMarkup, svgViewBox } from "../vector/static.js";
import { SvgPlayer, type SvgTrigger } from "../vector/svg.js";

/** Cap height of a heavy sans, as a share of its font size: what an inline word is framed to. */
const CAP_HEIGHT = "0.72em";

/** Marks the still's layer, so the action can find it (and hide it while the player runs). */
const STILL_ATTR = "data-flair-still";

const LAYER = "position:absolute;inset:0;display:block";

/** When to leave the still in place of the animation. */
export type ReducedMotion = "user" | "always" | "never";

/** Options shared by an effect by id and a motion of your own. */
export interface SvgPlayerParams {
  /** Start again at the end (default `true`); `false` plays once and stays on the last frame. */
  loop?: boolean;
  /** Start playing at once (default `true`). */
  autoplay?: boolean;
  /** Playback speed (default 1); changed without remaking the player. */
  speed?: number;
  /** Ms to rest on the last frame before looping (default 600, or the effect's). */
  hold?: number;
  /** Loop length in ms (default: the picture's own, plus `hold`). */
  duration?: number;
  /** Step start times in ms, for pictures that change on steps. */
  steps?: readonly number[];
  /** Plays in answer to the pointer (see `SvgTrigger`; default the effect's). */
  trigger?: SvgTrigger;
  /** Pause while scrolled out of view. */
  pauseWhenHidden?: boolean;
  /** Wait to start until scrolled into view. */
  playOnEnter?: boolean;
  /** Hide the picture while paused or reset. */
  hideWhenPaused?: boolean;
  /** Time source (default animation frames); a `ManualClock` steps frames yourself. */
  clock?: Clock;
  /** Called with the id of the innermost element with an id that is clicked. */
  onPick?: (id: string) => void;
  /** Called with the player once it is made, and `undefined` when it is disposed. */
  onPlayer?: (player: SvgPlayer | undefined) => void;
  /**
   * The still shown before the player starts and instead of it under reduced
   * motion: `"last"` (default; the rest frame, `"first"` for a hover or press
   * trigger), `"first"` or a time in ms.
   */
  poster?: "first" | "last" | number;
  /**
   * `"user"` (default) shows the still when the visitor prefers reduced
   * motion, `"always"` always does, `"never"` always plays.
   */
  reducedMotion?: ReducedMotion;
  /**
   * Size it as a word in a line of text: `display: inline-block` with the
   * viewBox's aspect ratio and `height` 0.72em (the cap height of a heavy
   * sans; pass a CSS length for another). Default: the effect's `inline`
   * control. Otherwise it is a block as wide as its container with the
   * viewBox's aspect ratio.
   */
  inline?: boolean | string;
}

/** A catalog vector effect by id (or the effect itself), with its values. */
export interface VectorEffectByIdParams extends SvgPlayerParams {
  /** A vector effect's catalog id (`"drip-text"`), or the effect itself. */
  id: string | VectorEffectDefinition;
  /** Control values; missing ones take the preset's, then the defaults. Compared by content. */
  values?: Record<string, ControlValue>;
  /** A preset's name to start from. */
  preset?: string;
  motion?: never;
}

/** Any {@link SvgMotion}; a new object restarts the player. */
export interface SvgMotionParams extends SvgPlayerParams {
  /** The picture and its animations. */
  motion: SvgMotion;
  id?: never;
  values?: never;
  preset?: never;
}

/** What `vectorEffect` and `vectorEffectStill` take: an effect by `id`, or a `motion`. */
export type VectorEffectParams = VectorEffectByIdParams | SvgMotionParams;

/** A still of the picture, for `{@html markup}` inside an element with `style`. */
export interface VectorEffectStill {
  /** The still's layer: safe `<svg>` markup (see `svgFrameMarkup`) in an absolutely placed `<span>`. */
  markup: string;
  /** The host's inline style: its position and size from the viewBox. */
  style: string;
}

interface Resolved {
  motion: SvgMotion;
  hold?: number;
  trigger?: SvgTrigger;
  inline?: boolean | string;
}

/** Remembers the last motion made from an effect, so values compared by content do not remake it. */
type MotionCache = { key: string; effect: VectorEffectDefinition; motion: SvgMotion };

function resolve(params: VectorEffectParams, cache?: { current?: MotionCache }): Resolved {
  if (params.motion) return { motion: params.motion, hold: params.hold, trigger: params.trigger, inline: params.inline };
  const { id, values, preset } = params as VectorEffectByIdParams;
  const effect = typeof id === "string" ? getEffect(id) : id;
  if (!effect || effect.kind !== "vector")
    throw new Error(
      `"${typeof id === "string" ? id : (effect?.id ?? id)}" is not a vector effect; pick one from findEffects({ kind: "vector" }), or pass a motion`,
    );
  const key = JSON.stringify([preset ?? null, values ?? {}]);
  let motion: SvgMotion;
  if (cache?.current && cache.current.effect === effect && cache.current.key === key) motion = cache.current.motion;
  else {
    motion = renderVectorEffect(effect, effectDefaults(effect, { preset, values }));
    if (cache) cache.current = { key, effect, motion };
  }
  return {
    motion,
    hold: params.hold ?? effect.hold,
    trigger: params.trigger ?? effect.trigger,
    inline: params.inline ?? values?.inline === true,
  };
}

/** The host's sizing from the picture's viewBox, so the still and the player take the same room. */
function hostStyle(svg: string, inline: boolean | string | undefined): [string, string][] {
  const box = svgViewBox(svg);
  const style: [string, string][] = [
    ["position", "relative"],
    ["display", inline ? "inline-block" : "block"],
  ];
  if (inline) style.push(["height", typeof inline === "string" ? inline : CAP_HEIGHT]);
  if (box) style.push(["aspect-ratio", `${box[2]} / ${box[3]}`]);
  return style;
}

function stillMarkup(r: Resolved, params: SvgPlayerParams): string {
  const at = params.poster ?? (r.trigger === "hover" || r.trigger === "press" ? "first" : "last");
  return svgFrameMarkup(r.motion, { at, steps: params.steps }) ?? "";
}

/**
 * The still of an effect or motion, for server rendering: put `markup` in the
 * element that has the `vectorEffect` action, with `style` as its style, so
 * the page shows the picture before the player starts (and instead of it
 * under reduced motion), in the room the player will take.
 * Throws when `id` is not a vector effect.
 */
export function vectorEffectStill(params: VectorEffectParams): VectorEffectStill {
  const r = resolve(params);
  return {
    markup: `<span ${STILL_ATTR} aria-hidden="true" style="${LAYER}">${stillMarkup(r, params)}</span>`,
    style: hostStyle(r.motion.svg, r.inline)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; "),
  };
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The options whose change remakes the player (`speed` is set on it instead). */
function playerKey(r: Resolved, p: SvgPlayerParams): unknown[] {
  return [
    r.motion,
    p.loop,
    p.autoplay,
    r.hold,
    p.duration,
    p.steps?.join(","),
    r.trigger,
    p.pauseWhenHidden,
    p.playOnEnter,
    p.hideWhenPaused,
    p.clock,
    p.reducedMotion ?? "user",
  ];
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
 * from the viewBox, leaving alone any of `position`, `display`, `height` and
 * `aspect-ratio` the element's style already sets.
 *
 * For an attachment, `{@attach fromAction(vectorEffect, () => params)}`
 * (`fromAction` is from `svelte/attachments`). Throws when `id` is not a
 * vector effect.
 */
export function vectorEffect(node: HTMLElement, initial: VectorEffectParams): ActionReturn<VectorEffectParams> {
  const cache: { current?: MotionCache } = {};
  const doc = node.ownerDocument;
  const mount = doc.createElement("span");
  mount.style.cssText = LAYER;
  node.appendChild(mount);

  let params = initial;
  let resolved = resolve(params, cache);
  let player: SvgPlayer | undefined;
  let key: unknown[] = [];
  /** The still the action made itself, when the element had none. */
  let ownStill: HTMLElement | undefined;
  /** Sizing properties the action set (the element's own style had them empty). */
  const sized = new Set<string>();

  const stills = () => node.querySelectorAll<HTMLElement>(`:scope > [${STILL_ATTR}]`);
  const showStills = (show: boolean) => {
    for (const s of stills()) s.style.display = show ? "block" : "none";
  };
  // When the params change Svelte replaces a server still (`{@html}`), and when
  // it is the element's only child, by setting `innerHTML`, which takes the
  // player's layer out too: put the layer back, and keep a new still hidden.
  const reattach = () => {
    if (mount.parentNode !== node) node.appendChild(mount);
    if (player) showStills(false);
  };
  const observer = typeof MutationObserver === "function" ? new MutationObserver(reattach) : undefined;
  observer?.observe(node, { childList: true });

  const size = () => {
    const style = hostStyle(resolved.motion.svg, resolved.inline);
    for (const [prop, value] of style) {
      if (!sized.has(prop) && node.style.getPropertyValue(prop)) continue;
      node.style.setProperty(prop, value);
      sized.add(prop);
    }
    // A property the new sizing drops (`height` when no longer inline) is cleared.
    for (const prop of sized)
      if (!style.some(([p]) => p === prop)) {
        node.style.removeProperty(prop);
        sized.delete(prop);
      }
  };

  if (stills().length === 0) {
    ownStill = doc.createElement("span");
    ownStill.setAttribute(STILL_ATTR, "");
    ownStill.setAttribute("aria-hidden", "true");
    ownStill.style.cssText = LAYER;
    node.insertBefore(ownStill, mount);
    size();
  }

  const stop = () => {
    if (!player) return;
    player.dispose();
    player = undefined;
    showStills(true);
    params.onPlayer?.(undefined);
  };

  const start = () => {
    const reduced = params.reducedMotion ?? "user";
    if (reduced === "always" || (reduced === "user" && prefersReducedMotion())) return;
    player = new SvgPlayer(mount, resolved.motion, {
      loop: params.loop,
      autoplay: params.autoplay,
      speed: params.speed,
      hold: resolved.hold,
      duration: params.duration,
      steps: params.steps,
      trigger: resolved.trigger,
      pauseWhenHidden: params.pauseWhenHidden,
      playOnEnter: params.playOnEnter,
      hideWhenPaused: params.hideWhenPaused,
      clock: params.clock,
      // The latest params' callback, without remaking the player.
      onPick: (id) => params.onPick?.(id),
    });
    showStills(false);
    params.onPlayer?.(player);
  };

  const apply = () => {
    reattach();
    if (ownStill) {
      ownStill.innerHTML = stillMarkup(resolved, params);
      size();
    }
    const next = playerKey(resolved, params);
    if (player && next.every((v, i) => v === key[i])) {
      player.setSpeed(params.speed ?? 1);
      return;
    }
    key = next;
    stop();
    start();
  };

  apply();

  return {
    update(next) {
      params = next;
      resolved = resolve(params, cache);
      apply();
    },
    destroy() {
      observer?.disconnect();
      stop();
      mount.remove();
      ownStill?.remove();
      for (const prop of sized) node.style.removeProperty(prop);
    },
  };
}

export type { SvgPlayer, SvgMotion, SvgTrigger };
