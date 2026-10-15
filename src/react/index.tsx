/**
 * React components for Flair's vector effects: `<VectorEffect>` plays a
 * catalog effect by id, `<SvgPlayerView>` plays any {@link SvgMotion}.
 *
 * Both render a still of the picture on the server (its last frame, by
 * default), so a page hydrates with the picture in place rather than a blank
 * box that jumps; the live `SvgPlayer` takes over after mount and is disposed
 * on unmount. Under `prefers-reduced-motion: reduce` the still stays.
 *
 * Needs React 18 or later (an optional peer dependency of the package).
 *
 * @packageDocumentation
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { getEffect, effectDefaults } from "../catalog/index.js";
import { renderVectorEffect, type VectorEffect as VectorEffectDefinition } from "../catalog/types.js";
import type { ControlValue } from "../shader/controls.js";
import type { Clock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import { svgFrameMarkup, svgViewBox } from "../vector/static.js";
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
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The host's size from the picture's viewBox, so the still and the player take the same room. */
function hostStyle(svg: string, inline: boolean | string | undefined, style?: CSSProperties): CSSProperties {
  const box = svgViewBox(svg);
  const aspectRatio = box ? `${box[2]} / ${box[3]}` : undefined;
  const base: CSSProperties = inline
    ? { display: "inline-block", height: typeof inline === "string" ? inline : CAP_HEIGHT, aspectRatio }
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
    style,
    ...rest
  } = props;
  const still = useRef<HTMLSpanElement>(null);
  const mount = useRef<HTMLSpanElement>(null);
  const player = useRef<SvgPlayer | undefined>(undefined);
  // Callbacks change every render; the player calls the latest without being remade.
  const callbacks = useRef({ onPick, onPlayer });
  callbacks.current = { onPick, onPlayer };

  const at = poster ?? (trigger === "hover" || trigger === "press" ? "first" : "last");
  const markup = useMemo(() => svgFrameMarkup(motion, { at, steps }) ?? "", [motion, at, steps]);
  const stepsKey = steps?.join(",");

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
      playOnEnter,
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
  }, [motion, loop, autoplay, hold, duration, stepsKey, trigger, pauseWhenHidden, playOnEnter, hideWhenPaused, clock, reducedMotion]);

  useEffect(() => {
    player.current?.setSpeed(speed ?? 1);
  }, [speed]);

  return (
    <span {...rest} style={hostStyle(motion.svg, inline, style)}>
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

/**
 * Plays a catalog vector effect: `<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} />`.
 * Its `hold` and `trigger` are used unless given. With an `inline` control
 * set (drip text's), it is sized as a word in the line (see `inline`).
 * Throws when `id` is not a vector effect.
 */
export function VectorEffect(props: VectorEffectProps) {
  const { id, values, preset, elementId, ...rest } = props;
  const effect = typeof id === "string" ? getEffect(id) : id;
  if (!effect || effect.kind !== "vector")
    throw new Error(`"${typeof id === "string" ? id : effect?.id}" is not a vector effect; pick one from findEffects({ kind: "vector" })`);
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

export type { SvgPlayer, SvgMotion, SvgTrigger };
