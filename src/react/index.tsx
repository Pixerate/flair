/**
 * React components for Flair: `<FlairEffect>` runs any catalog effect (shader
 * or vector) applied to a picture, video, SVG or words; `<VectorEffect>` plays
 * a catalog vector effect by id, `<SvgPlayerView>` plays any {@link SvgMotion};
 * `useFlairMoment()` plays an effect once over an element.
 *
 * Both render a still of the picture on the server (its last frame, by
 * default), so a page hydrates with the picture in place rather than a blank
 * box that jumps; the live `SvgPlayer` takes over after mount and is disposed
 * on unmount. Under `prefers-reduced-motion: reduce` the still stays, and a
 * shader holds its rest frame.
 *
 * For a page that should not load the whole catalog, use
 * `@pixerate/flair/react/lazy`: the same components, loading effects by id
 * one by one.
 *
 * Needs React 18 or later (an optional peer dependency of the package).
 *
 * @packageDocumentation
 */

import { getEffect } from "../catalog/index.js";
import { mountEffect, playMoment } from "../embed/index.js";
import { createFlairEffect, createUseFlairMoment, createVectorEffect } from "./core.js";

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
 * Plays a catalog vector effect: `<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} />`.
 * Its `hold` and `trigger` are used unless given. With an `inline` control
 * set (drip text's), it is sized as a word in the line (see `inline`).
 * Throws when `id` is not a vector effect.
 */
export const VectorEffect = createVectorEffect(getEffect, "");

/**
 * Any catalog effect, shader or vector, applied to a subject: a picture, a
 * video, an SVG, words or a path (see `mountEffect` in
 * `@pixerate/flair/embed`). Fills its element: size it with CSS. A new
 * subject or values update the running effect; a new effect, preset or
 * playback option starts it again. It renders nothing on the server.
 *
 * ```tsx
 * <FlairEffect effect="image-duotone" subject={{ image: "/team.jpg" }} preset="Spotify" style={{ aspectRatio: "16 / 9" }} />
 * <FlairEffect effect="typewriter" subject={{ text: "Hello there" }} />
 * <FlairEffect effect="gauge" data={{ value: 72, max: 100, unit: "%", label: "CPU" }} />
 * <FlairEffect effect="liquid-loader" data={{ value: job.progress ?? null }} label="Generating" />
 * <FlairEffect effect="toggle-switch" state={{ checked }} onEvent={(_, d) => setChecked(d.checked as boolean)} label="Wi-Fi" />
 * ```
 */
export const FlairEffect = createFlairEffect(mountEffect);

/**
 * A function that plays an effect once over an element (by ref or element)
 * or the viewport, as `playMoment` in `@pixerate/flair/embed` does, and
 * stops any still playing when the component unmounts. It plays nothing
 * under reduced motion or without WebGL2 for a shader (it settles `false`),
 * so keep a CSS fallback.
 *
 * ```tsx
 * const play = useFlairMoment();
 * const card = useRef<HTMLDivElement>(null);
 * useEffect(() => { if (result) play(card, "change-pulse"); }, [result]);
 * ```
 */
export const useFlairMoment = createUseFlairMoment(playMoment);
