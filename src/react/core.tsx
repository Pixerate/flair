/**
 * The React components, made over whichever catalog the entry uses: the
 * full one (`@pixerate/flair/react`) or the lazy one
 * (`@pixerate/flair/react/lazy`). Nothing here imports the catalog's list of
 * effects.
 *
 * @internal
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { effectDefaults } from "../catalog/core.js";
import { renderVectorEffect, type EffectDefinition, type VectorEffect as VectorEffectDefinition } from "../catalog/types.js";
import type { EffectSubject, MountedEffect, MountOptions } from "../embed/mount.js";
import type { MomentAnchor, MomentOptions } from "../embed/moment.js";
import type { ControlValue } from "../shader/controls.js";
import type { JsonValue } from "../catalog/ui-hints.js";
import type { Clock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgFrameMarkup, svgInlineLayout, svgViewBox } from "../vector/static.js";
import { SvgPlayer, type SvgTrigger } from "../vector/svg.js";

// Layout effects swap the still for the player before paint; on a server neither runs.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Cap height of a heavy sans, as a share of its font size: what an inline word is framed to. */
const CAP_HEIGHT = "0.72em";

/** When to leave the still in place of the animation. */
export type ReducedMotion = "user" | "always" | "never";

export interface SvgPlayerViewProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The picture and its animations. */
  motion: SvgMotion;
  /** Start again at the end (default `true`); `false` plays once and stays on the last frame. */
  loop?: boolean;
  /** Start playing at once (default `true`). */
  autoplay?: boolean;
  /** Playback speed (default 1). */
  speed?: number;
  /** Ms to rest on the last frame before looping (default 600). */
  hold?: number;
  /** Loop length in ms (default: the picture's own, plus `hold`). */
  duration?: number;
  /** Step start times in ms, for pictures that change on steps. */
  steps?: readonly number[];
  /** Plays in answer to the pointer (see `SvgTrigger`). */
  trigger?: SvgTrigger;
  /** Pause while scrolled out of view. */
  pauseWhenHidden?: boolean;
  /**
   * Wait to start until scrolled into view. Default `true` when it plays once
   * (`loop={false}`, no trigger), so a one-shot further down the page does not
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
   * The still shown before the player starts (server render, hydration) and
   * instead of it under reduced motion: `"last"` (default; the rest frame,
   * `"first"` for a hover or press trigger), `"first"` or a time in ms.
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
   * sans; pass a CSS length for another). Meant for pictures framed from cap
   * height to baseline, like drip text's `inline`. Otherwise it is a block
   * as wide as its container with the viewBox's aspect ratio.
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

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The host's size from the picture's viewBox, so the still and the player take the same room. */
function hostStyle(svg: string, inline: boolean | string | undefined, contain: boolean | undefined, style?: CSSProperties): CSSProperties {
  const box = svgViewBox(svg);
  const aspectRatio = box ? `${box[2]} / ${box[3]}` : undefined;
  const spill = inline && contain ? svgInlineLayout(svg)?.overhang : undefined;
  const base: CSSProperties = inline
    ? {
        display: "inline-block",
        height: typeof inline === "string" ? inline : CAP_HEIGHT,
        aspectRatio,
        ...(spill && { margin: `${spill.top}em ${spill.right}em ${spill.bottom}em ${spill.left}em` }),
      }
    : { display: "block", aspectRatio };
  return { position: "relative", ...base, ...style };
}

const LAYER: CSSProperties = { position: "absolute", inset: 0, display: "block" };

/**
 * Plays an {@link SvgMotion}: a still on the server and before mount, then
 * an `SvgPlayer` (remade when the motion or its options change, disposed on
 * unmount). Pass a memoised `motion`: a new object each render restarts it.
 */
export function SvgPlayerView(props: SvgPlayerViewProps) {
  const {
    motion,
    loop,
    autoplay,
    speed,
    hold,
    duration,
    steps,
    trigger,
    pauseWhenHidden,
    playOnEnter,
    hideWhenPaused,
    clock,
    onPick,
    onPlayer,
    poster,
    reducedMotion = "user",
    inline,
    contain,
    style,
    ...rest
  } = props;
  const still = useRef<HTMLSpanElement>(null);
  const mount = useRef<HTMLSpanElement>(null);
  const player = useRef<SvgPlayer | undefined>(undefined);
  // Callbacks change every render; the player calls the latest without being remade.
  const callbacks = useRef({ onPick, onPlayer });
  callbacks.current = { onPick, onPlayer };

  const at = poster ?? (trigger === "hover" || trigger === "press" || trigger === "scroll" ? "first" : "last");
  const markup = useMemo(() => svgFrameMarkup(motion, { at, steps }) ?? "", [motion, at, steps]);
  const stepsKey = steps?.join(",");
  // A one-shot waits until it is seen.
  const enter = playOnEnter ?? (loop === false && !trigger);

  useIsomorphicLayoutEffect(() => {
    const host = mount.current;
    if (!host) return;
    if (reducedMotion === "always" || (reducedMotion === "user" && prefersReducedMotion())) return;
    const p = new SvgPlayer(host, motion, {
      loop,
      autoplay,
      speed,
      hold,
      duration,
      steps,
      trigger,
      pauseWhenHidden,
      playOnEnter: enter,
      hideWhenPaused,
      clock,
      onPick: (id) => callbacks.current.onPick?.(id),
    });
    player.current = p;
    // Set directly, not through props, so React leaves it be on later renders.
    if (still.current) still.current.style.display = "none";
    callbacks.current.onPlayer?.(p);
    return () => {
      p.dispose();
      player.current = undefined;
      if (still.current) still.current.style.display = "block";
      callbacks.current.onPlayer?.(undefined);
    };
    // `speed` is applied below without remaking; `steps` by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, loop, autoplay, hold, duration, stepsKey, trigger, pauseWhenHidden, enter, hideWhenPaused, clock, reducedMotion]);

  useEffect(() => {
    player.current?.setSpeed(speed ?? 1);
  }, [speed]);

  return (
    <span {...rest} style={hostStyle(motion.svg, inline, contain, style)}>
      <span ref={still} aria-hidden="true" style={LAYER} dangerouslySetInnerHTML={{ __html: markup }} />
      <span ref={mount} style={LAYER} />
    </span>
  );
}

export interface VectorEffectProps extends Omit<SvgPlayerViewProps, "motion" | "id"> {
  /** A vector effect's catalog id (`"drip-text"`), or the effect itself. */
  id: string | VectorEffectDefinition;
  /** Control values; missing ones take the preset's, then the defaults. */
  values?: Record<string, ControlValue>;
  /** A preset's name to start from. */
  preset?: string;
  /** The host element's own `id`. */
  elementId?: string;
}

/** `VectorEffect` over a catalog: `lookUp` finds an effect by id (`refusal` is added when it finds none). */
export function createVectorEffect(lookUp: (id: string) => EffectDefinition | undefined, refusal: string) {
  return function VectorEffect(props: VectorEffectProps) {
  const { id, values, preset, elementId, ...rest } = props;
  const effect = typeof id === "string" ? lookUp(id) : id;
  if (!effect || effect.kind !== "vector")
    throw new Error(`"${typeof id === "string" ? id : effect?.id}" is not a vector effect${typeof id === "string" && !effect ? refusal : ""}; pick one from findEffects({ kind: "vector" })`);
  const valuesKey = JSON.stringify(values ?? {});
  const motion = useMemo(
    () => renderVectorEffect(effect, effectDefaults(effect, { preset, values })),
    // Values by content, so an inline object literal does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effect, preset, valuesKey],
  );
  return (
    <SvgPlayerView
      id={elementId}
      motion={motion}
      hold={effect.hold}
      trigger={effect.trigger}
      inline={values?.inline === true}
      {...rest}
    />
  );
}
}

export type { SvgPlayer, SvgMotion, SvgTrigger };

export interface FlairEffectProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError"> {
  /** A catalog effect, by id or definition: shader or vector. */
  effect: string | EffectDefinition;
  /** What to apply it to: a picture, a video, an SVG, words or a path (see `EffectSubject`). */
  subject?: EffectSubject | readonly EffectSubject[];
  /** A preset by name, under `values`. */
  preset?: string;
  /** Control values over the effect's defaults (and preset). */
  values?: Record<string, ControlValue>;
  /** Start playing at once (default `true`). */
  autoplay?: boolean;
  /** Pause while scrolled out of view (default `true`). */
  pauseWhenHidden?: boolean;
  /**
   * For an effect offered as a UI component (one with `ui`): its typed data,
   * by its contract's props (`{ value: 72, max: 100, unit: "%" }` for `gauge`).
   * New data updates it by content.
   */
  data?: Record<string, unknown>;
  /**
   * For a UI component with controlled state: the state to show
   * (`{ checked }` for `toggle-switch`). Given, the host owns it: clicks and
   * keys only fire `onEvent`. Left out, the component keeps its own.
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
  reducedMotion?: ReducedMotion;
  /**
   * Called when the effect cannot be mounted (an id the catalog does not
   * have, a subject it does not take). Without it, an effect by definition
   * throws during the commit, and one that loads logs the error.
   */
  onError?: (error: Error) => void;
}

/** `FlairEffect` over a way to mount effects: `@pixerate/flair/embed`'s `mountEffect`, or the lazy one. */
export function createFlairEffect(mount: (host: HTMLElement, effect: string | EffectDefinition, options: MountOptions) => MountedEffect | Promise<MountedEffect>) {
  return function FlairEffect(props: FlairEffectProps) {
    const { effect, subject, preset, values, autoplay, pauseWhenHidden, data, state, onEvent, label, reducedMotion, onError, style, ...rest } = props;
    const host = useRef<HTMLDivElement>(null);
    const mounted = useRef<MountedEffect | undefined>(undefined);
    const valuesKey = JSON.stringify(values ?? {});
    const dataKey = JSON.stringify(data ?? {});
    const stateKey = JSON.stringify(state ?? {});
    // Whether the host owns the state: decided at mount, as React's own inputs do.
    const controlled = state !== undefined;
    // What the running effect last took, so a re-render with the same subject or values changes nothing.
    const applied = useRef<{ subject?: FlairEffectProps["subject"]; valuesKey: string; dataKey: string; stateKey: string }>({ valuesKey: "", dataKey: "", stateKey: "" });
    const latest = useRef({ subject, values, valuesKey, data, dataKey, state, stateKey, onEvent, onError, controlled });
    latest.current = { subject, values, valuesKey, data, dataKey, state, stateKey, onEvent, onError, controlled };
    /** Brings the running effect up to the latest props (after an effect that loads, they may have moved on). */
    const sync = () => {
      const m = mounted.current;
      const now = latest.current;
      if (!m) return;
      if (now.dataKey !== applied.current.dataKey) {
        m.setData?.(now.data ?? {});
        applied.current.dataKey = now.dataKey;
      }
      if (now.controlled && now.stateKey !== applied.current.stateKey) {
        m.setState?.(now.state ?? {});
        applied.current.stateKey = now.stateKey;
      }
      if (now.subject && now.subject !== applied.current.subject) {
        m.setSubject(now.subject);
        applied.current.subject = now.subject;
      }
      if (now.values && now.valuesKey !== applied.current.valuesKey) {
        m.setValues(now.values);
        applied.current.valuesKey = now.valuesKey;
      }
    };
    useEffect(() => {
      const now = latest.current;
      let gone = false;
      let running: MountedEffect | undefined;
      const take = (m: MountedEffect) => {
        if (gone) return m.dispose();
        running = m;
        m.element.style.display = "block";
        m.element.style.width = "100%";
        m.element.style.height = "100%";
        mounted.current = m;
        applied.current = { subject: now.subject, valuesKey: now.valuesKey, dataKey: now.dataKey, stateKey: now.stateKey };
        sync();
      };
      const fail = (error: unknown) => {
        if (gone) return;
        if (latest.current.onError) latest.current.onError(error instanceof Error ? error : new Error(String(error)));
        else console.error(error);
      };
      try {
        const m = mount(host.current!, effect, {
          ...(now.subject ? { subject: now.subject } : {}),
          ...(preset ? { preset } : {}),
          ...(now.values ? { values: now.values } : {}),
          ...(now.data ? { data: now.data } : {}),
          ...(controlled && now.state ? { state: now.state } : {}),
          ...(label !== undefined ? { label } : {}),
          ...(reducedMotion ? { reducedMotion } : {}),
          onEvent: (name, detail) => latest.current.onEvent?.(name, detail),
          autoplay: autoplay ?? true,
          pauseWhenHidden: pauseWhenHidden ?? true,
        });
        if (m instanceof Promise) m.then(take, fail);
        else take(m);
      } catch (error) {
        // An effect in hand throws at once, as it always has, unless the host listens.
        if (!latest.current.onError) throw error;
        fail(error);
      }
      return () => {
        gone = true;
        running?.dispose();
        mounted.current = undefined;
      };
    }, [effect, preset, autoplay, pauseWhenHidden, controlled, label, reducedMotion]);
    useEffect(sync, [dataKey, stateKey, controlled, subject, valuesKey]);
    return <div ref={host} style={{ position: "relative", ...style }} {...rest} />;
  };
}

/**
 * `useFlairMoment()` for a moment player: `@pixerate/flair/embed`'s
 * `playMoment`, or the lazy one.
 */
export function createUseFlairMoment(play: (anchor: MomentAnchor, effect: string | EffectDefinition, options?: MomentOptions) => Promise<boolean>) {
  return function useFlairMoment(): FlairMomentPlayer {
    const controllers = useRef(new Set<AbortController>());
    useEffect(() => {
      const live = controllers.current;
      return () => {
        for (const c of live) c.abort();
        live.clear();
      };
    }, []);
    return useCallback<FlairMomentPlayer>((target, effect, options = {}) => {
      const anchor = target === "viewport" ? target : "current" in target ? target.current : target;
      if (!anchor) return Promise.resolve(false);
      const controller = new AbortController();
      controllers.current.add(controller);
      options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
      if (options.signal?.aborted) controller.abort();
      return play(anchor, effect, { ...options, signal: controller.signal }).finally(() => controllers.current.delete(controller));
    }, []);
  };
}

/**
 * Plays a moment over an element (by ref or element) or the viewport; see
 * `useFlairMoment`. Settles `true` once it has played, `false` when it
 * played nothing (reduced motion, no WebGL2, the element gone, unmounted).
 */
export type FlairMomentPlayer = (target: Element | RefObject<Element | null> | "viewport", effect: string | EffectDefinition, options?: MomentOptions) => Promise<boolean>;
