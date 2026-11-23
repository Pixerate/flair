/**
 * The Svelte actions, made over whichever catalog the entry uses: the full
 * one (`@pixerate/flair/svelte`) or the lazy one (`@pixerate/flair/svelte/lazy`).
 * Nothing here imports the catalog's list of effects.
 *
 * @internal
 */

import type { ActionReturn } from "svelte/action";
import { effectDefaults } from "../catalog/core.js";
import { renderVectorEffect, type EffectDefinition, type VectorEffect as VectorEffectDefinition } from "../catalog/types.js";
import type { EffectSubject, MountedEffect, MountOptions } from "../embed/mount.js";
import type { MomentAnchor, MomentOptions } from "../embed/moment.js";

/** Finds a catalog effect by id (undefined when there is none, or it has not loaded). */
export type LookUp = (id: string) => EffectDefinition | undefined;
import type { ControlValue } from "../shader/controls.js";
import type { JsonValue } from "../catalog/ui-hints.js";
import type { Clock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgFrameMarkup, svgInlineLayout, svgViewBox } from "../vector/static.js";
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
  /**
   * Wait to start until scrolled into view. Default `true` when it plays once
   * (`loop: false`, no trigger), so a one-shot further down the page does not
   * finish before anyone sees it; `false` plays at mount.
   */
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
  /**
   * With `inline`, keep room for what spills past the word (descenders,
   * outlines, glows, drips): a margin of the picture's `data-overhang` (see
   * `svgInlineLayout`), so the lines around it make space instead of being
   * painted over. Default `false`.
   */
  contain?: boolean;
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
  contain?: boolean;
}

/** Remembers the last motion made from an effect, so values compared by content do not remake it. */
type MotionCache = { key: string; effect: VectorEffectDefinition; motion: SvgMotion };

function resolve(lookUp: LookUp, params: VectorEffectParams, cache?: { current?: MotionCache }): Resolved {
  if (params.motion) return { motion: params.motion, hold: params.hold, trigger: params.trigger, inline: params.inline, contain: params.contain };
  const { id, values, preset } = params as VectorEffectByIdParams;
  const effect = typeof id === "string" ? lookUp(id) : id;
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
    contain: params.contain,
  };
}

/** The host's sizing from the picture's viewBox, so the still and the player take the same room. */
function hostStyle(svg: string, inline: boolean | string | undefined, contain?: boolean): [string, string][] {
  const box = svgViewBox(svg);
  const style: [string, string][] = [
    ["position", "relative"],
    ["display", inline ? "inline-block" : "block"],
  ];
  if (inline) style.push(["height", typeof inline === "string" ? inline : CAP_HEIGHT]);
  if (box) style.push(["aspect-ratio", `${box[2]} / ${box[3]}`]);
  const spill = inline && contain ? svgInlineLayout(svg)?.overhang : undefined;
  if (spill) style.push(["margin", `${spill.top}em ${spill.right}em ${spill.bottom}em ${spill.left}em`]);
  return style;
}

/** Whether to wait until scrolled into view: as asked, else when it plays once. */
const enters = (r: Resolved, p: SvgPlayerParams) => p.playOnEnter ?? (p.loop === false && !r.trigger);

function stillMarkup(r: Resolved, params: SvgPlayerParams): string {
  const at = params.poster ?? (r.trigger === "hover" || r.trigger === "press" || r.trigger === "scroll" ? "first" : "last");
  return svgFrameMarkup(r.motion, { at, steps: params.steps }) ?? "";
}

/** `vectorEffectStill` over a catalog. */
export function vectorEffectStillWith(lookUp: LookUp, params: VectorEffectParams): VectorEffectStill {
  const r = resolve(lookUp, params);
  return {
    markup: `<span ${STILL_ATTR} aria-hidden="true" style="${LAYER}">${stillMarkup(r, params)}</span>`,
    style: hostStyle(r.motion.svg, r.inline, r.contain)
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
    enters(r, p),
    p.hideWhenPaused,
    p.clock,
    p.reducedMotion ?? "user",
  ];
}

/** The `vectorEffect` action over a catalog. */
export function vectorEffectWith(lookUp: LookUp, node: HTMLElement, initial: VectorEffectParams): ActionReturn<VectorEffectParams> {
  const cache: { current?: MotionCache } = {};
  const doc = node.ownerDocument;
  const mount = doc.createElement("span");
  mount.style.cssText = LAYER;
  node.appendChild(mount);

  let params = initial;
  let resolved = resolve(lookUp, params, cache);
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
    const style = hostStyle(resolved.motion.svg, resolved.inline, resolved.contain);
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
      playOnEnter: enters(resolved, params),
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
      resolved = resolve(lookUp, params, cache);
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

/** What the `flairEffect` action runs: any catalog effect, applied to a subject. */
export interface FlairEffectParams {
  /** A catalog effect, by id or definition: shader or vector. */
  effect: string | EffectDefinition;
  /** What to apply it to: a picture, a video, an SVG, words or a path (see `EffectSubject`). */
  subject?: EffectSubject | readonly EffectSubject[];
  preset?: string;
  values?: Record<string, ControlValue>;
  /** Start playing at once (default `true`). */
  autoplay?: boolean;
  /** Pause while scrolled out of view (default `true`). */
  pauseWhenHidden?: boolean;
  /** Start again at the end (default `true`). For shaders with `uProgress`, false plays 0 → 1 once. */
  loop?: boolean;
  /** Wait to start playing until the element enters the viewport (default `false`). */
  playOnEnter?: boolean;
  /** Duration in ms for one-shot playback. */
  duration?: number;
  /** For an effect offered as a UI component (one with `ui`): its typed data, by its contract's props. */
  data?: Record<string, unknown>;
  /**
   * For a UI component with controlled state: the state to show (`{ checked }`).
   * Given, the host owns it: clicks and keys only fire `onEvent`.
   */
  state?: Record<string, JsonValue>;
  /** For a UI component: each event its contract names (`"change"`, `{ checked }`). */
  onEvent?: (event: string, detail: Record<string, JsonValue>) => void;
  /** For a UI component named by `aria-label` (the switch): its accessible name. */
  label?: string;
  /**
   * When to show the effect at rest, still (default `"user"`: when the
   * visitor prefers reduced motion): a shader's rest frame, a vector
   * effect's last frame, a UI component's rest state.
   */
  reducedMotion?: "user" | "always" | "never";
  /** Called when the effect cannot be mounted; without it, the error is logged (or thrown, for an effect in hand). */
  onError?: (error: Error) => void;
}

/** The `flairEffect` action over a way to mount effects: `@pixerate/flair/embed`'s `mountEffect`, or the lazy one. */
export function flairEffectWith(
  mount: (host: HTMLElement, effect: string | EffectDefinition, options: MountOptions) => MountedEffect | Promise<MountedEffect>,
  node: HTMLElement,
  initial: FlairEffectParams,
): ActionReturn<FlairEffectParams> {
  let params = initial;
  const win = node.ownerDocument?.defaultView ?? (typeof window !== "undefined" ? window : null);
  const computedPos = win && typeof win.getComputedStyle === "function" ? win.getComputedStyle(node).position : "";
  const setPosition = !node.style.position && (!computedPos || computedPos === "static");
  if (setPosition) node.style.position = "relative";

  let mounted: MountedEffect | undefined;
  /** Bumped on every (re)start and on destroy, so an effect that loads late is dropped. */
  let generation = 0;
  /** What the running effect last took (after loading, the params may have moved on). */
  let applied: FlairEffectParams = params;
  const sync = () => {
    if (!mounted) return;
    const next = params;
    if (next.subject && next.subject !== applied.subject) mounted.setSubject(next.subject);
    if (next.values && JSON.stringify(next.values) !== JSON.stringify(applied.values ?? {})) mounted.setValues(next.values);
    if (next.data && JSON.stringify(next.data) !== JSON.stringify(applied.data ?? {})) mounted.setData?.(next.data);
    if (next.state && JSON.stringify(next.state) !== JSON.stringify(applied.state ?? {})) mounted.setState?.(next.state);
    applied = next;
  };
  const start = () => {
    const mine = ++generation;
    const take = (m: MountedEffect) => {
      if (mine !== generation) return m.dispose();
      m.element.style.display = "block";
      m.element.style.width = "100%";
      m.element.style.height = "100%";
      mounted = m;
      sync();
    };
    const fail = (error: unknown) => {
      if (mine !== generation) return;
      if (params.onError) params.onError(error instanceof Error ? error : new Error(String(error)));
      else console.error(error);
    };
    applied = params;
    const m = mount(node, params.effect, {
      ...(params.subject ? { subject: params.subject } : {}),
      ...(params.preset ? { preset: params.preset } : {}),
      ...(params.values ? { values: params.values } : {}),
      autoplay: params.autoplay ?? true,
      pauseWhenHidden: params.pauseWhenHidden ?? true,
      ...(params.loop !== undefined ? { loop: params.loop } : {}),
      ...(params.playOnEnter !== undefined ? { playOnEnter: params.playOnEnter } : {}),
      ...(params.duration !== undefined ? { duration: params.duration } : {}),
      ...(params.data ? { data: params.data } : {}),
      ...(params.state ? { state: params.state } : {}),
      ...(params.label !== undefined ? { label: params.label } : {}),
      ...(params.reducedMotion ? { reducedMotion: params.reducedMotion } : {}),
      onEvent: (name, detail) => params.onEvent?.(name, detail),
    });
    if (m instanceof Promise) m.then(take, fail);
    else take(m);
  };
  start();
  return {
    update(next) {
      const restart =
        next.effect !== params.effect ||
        next.preset !== params.preset ||
        next.autoplay !== params.autoplay ||
        next.pauseWhenHidden !== params.pauseWhenHidden ||
        next.loop !== params.loop ||
        next.playOnEnter !== params.playOnEnter ||
        next.duration !== params.duration ||
        (next.state === undefined) !== (params.state === undefined) ||
        next.label !== params.label ||
        next.reducedMotion !== params.reducedMotion;
      params = next;
      if (restart) {
        mounted?.dispose();
        mounted = undefined;
        start();
        return;
      }
      sync();
    },
    destroy() {
      generation++;
      if (setPosition) node.style.position = "";
      mounted?.dispose();
      mounted = undefined;
    },
  };
}

/** What the `flairMoment` action plays over its element. */
export interface FlairMomentParams extends Omit<MomentOptions, "signal"> {
  /** The effect, by id or definition: a shader or vector effect. */
  effect: string | EffectDefinition;
  /**
   * Plays the moment each time this changes (compared with `!==`): a
   * result's id, an `updatedAt`, a counter. Left out, it plays once on mount.
   */
  key?: unknown;
  /** With `key`: also play when the element first mounts (default `false`). */
  onMount?: boolean;
  /** Called with whether it played (`false` under reduced motion, without WebGL2, or when stopped). */
  onDone?: (played: boolean) => void;
  /** Called when it cannot be played (an unknown id, an effect that is not a shader or vector effect). */
  onError?: (error: Error) => void;
}

/** The `flairMoment` action over a moment player: `@pixerate/flair/embed`'s `playMoment`, or the lazy one. */
export function flairMomentWith(
  play: (anchor: MomentAnchor, effect: string | EffectDefinition, options?: MomentOptions) => Promise<boolean>,
  node: HTMLElement,
  initial: FlairMomentParams,
): ActionReturn<FlairMomentParams> {
  let params = initial;
  const running = new Set<AbortController>();
  const fire = () => {
    const { effect, key: _key, onMount: _onMount, onDone, onError, ...options } = params;
    const controller = new AbortController();
    running.add(controller);
    play(node, effect, { ...options, signal: controller.signal }).then(
      (played) => {
        running.delete(controller);
        onDone?.(played);
      },
      (error: unknown) => {
        running.delete(controller);
        if (onError) onError(error instanceof Error ? error : new Error(String(error)));
        else console.error(error);
      },
    );
  };
  if (!("key" in params) || params.onMount) fire();
  return {
    update(next) {
      const changed = "key" in next && next.key !== params.key;
      params = next;
      if (changed) fire();
    },
    destroy() {
      for (const c of running) c.abort();
      running.clear();
    },
  };
}
