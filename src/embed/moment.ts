/**
 * One-shot moments: an effect played once over an element (or the whole
 * viewport) on a transparent overlay that lets the pointer through, then
 * removed with its canvas and GL context. Shared by `@pixerate/flair/embed`
 * and `@pixerate/flair/embed/lazy`, which look effects up in their own way.
 *
 * @internal
 */

import { effectDefaults } from "../catalog/core.js";
import { renderVectorEffect, type EffectDefinition } from "../catalog/types.js";
import type { SubjectResolver } from "../scene/layers.js";
import type { ControlValue } from "../shader/controls.js";
import { holdsStill } from "../shader/renderer.js";
import { svgDuration } from "../vector/svg.js";
import { mountDefinition, type EffectSubject, type MountedEffect } from "./mount.js";

/** Where a moment plays: over an element (following it as the page scrolls), or over the whole viewport. */
export type MomentAnchor = Element | "viewport";

export interface MomentOptions {
  /** What to apply the effect to, as `mountEffect` takes it. Most moments take none. */
  subject?: EffectSubject | readonly EffectSubject[];
  /** The host's asset library, for `{ asset }` subjects (see `MountOptions.resolveAsset`). */
  resolveAsset?: SubjectResolver;
  /** A preset by name, then these values, over the effect's defaults. */
  preset?: string;
  values?: Record<string, ControlValue>;
  /**
   * Ms it plays for before it is removed. Default: 2500 for a one-shot
   * shader (its `uProgress` runs 0 → 1 over it), one loop of a looping shader (2000 when it does not loop), or a vector
   * effect's animations.
   */
  duration?: number;
  /**
   * Px the overlay reaches past the anchor on each side (or `[x, y]`), for
   * effects that spill over its edges (a burst, a glow). Default 0.
   */
  outset?: number | readonly [number, number];
  /**
   * `"user"` (default) plays nothing when the visitor prefers reduced
   * motion, `"always"` never plays, `"never"` always plays. Either way the
   * page's own state (and any CSS fallback) is left as it is.
   */
  reducedMotion?: "user" | "always" | "never";
  /** Stops it early: the overlay is removed and the moment settles `false`. */
  signal?: AbortSignal;
  /** The overlay's `z-index` (default 2147483000, over nearly everything). */
  zIndex?: number;
  /** Class for the overlay element. */
  className?: string;
}

/** The overlay's layout: fixed over the anchor's box, grown by `outset`. */
function place(overlay: HTMLElement, anchor: MomentAnchor, outset: MomentOptions["outset"]) {
  const [ox, oy] = typeof outset === "number" ? [outset, outset] : (outset ?? [0, 0]);
  const rect = anchor === "viewport" ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : anchor.getBoundingClientRect();
  overlay.style.left = `${rect.left - ox}px`;
  overlay.style.top = `${rect.top - oy}px`;
  overlay.style.width = `${Math.max(1, rect.width + 2 * ox)}px`;
  overlay.style.height = `${Math.max(1, rect.height + 2 * oy)}px`;
}

/** Ms a moment plays: `duration`, else the effect's own length (see {@link MomentOptions.duration}). */
export function momentLength(effect: EffectDefinition, values: Record<string, ControlValue>, duration?: number): number {
  if (duration !== undefined) return Math.max(0, duration);
  if (effect.kind === "shader") {
    if ("uProgress" in values || "uAnimate" in values) return 2500;
    return effect.loop ? effect.loop * 1000 : 2000;
  }
  if (effect.kind === "vector") return svgDuration(renderVectorEffect(effect, values));
  return 0;
}

/**
 * Plays `effect` once over `anchor`; see `playMoment` in
 * `@pixerate/flair/embed`. `load` is the effect, or loads it (only called
 * when the moment will play).
 */
export async function playMomentWith(anchor: MomentAnchor, load: EffectDefinition | (() => Promise<EffectDefinition>), options: MomentOptions = {}): Promise<boolean> {
  if (holdsStill(options.reducedMotion) || typeof document === "undefined" || options.signal?.aborted) return false;
  const def = typeof load === "function" ? await load() : load;
  if (def.kind !== "shader" && def.kind !== "vector")
    throw new Error(`"${def.id}" is a ${def.kind} effect; a moment plays a shader or vector effect over an element (findEffects({ kind: "shader" }) or { kind: "vector" }).`);
  if (options.signal?.aborted) return false;
  if (anchor !== "viewport" && !anchor.isConnected) return false;

  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.flairMoment = def.id;
  if (options.className) overlay.className = options.className;
  Object.assign(overlay.style, { position: "fixed", pointerEvents: "none", zIndex: String(options.zIndex ?? 2147483000), overflow: "visible", contain: "layout paint" });
  place(overlay, anchor, options.outset);
  document.body.appendChild(overlay);

  const values = effectDefaults(def, { ...(options.preset ? { preset: options.preset } : {}), ...(options.values ? { values: options.values } : {}) });
  const length = momentLength(def, values, options.duration);
  let mounted: MountedEffect;
  try {
    mounted = mountDefinition(overlay, def, {
      ...(options.subject ? { subject: options.subject } : {}),
      ...(options.resolveAsset ? { resolveAsset: options.resolveAsset } : {}),
      ...(options.preset ? { preset: options.preset } : {}),
      ...(options.values ? { values: options.values } : {}),
      loop: false,
      autoplay: true,
      pauseWhenHidden: false,
      reducedMotion: "never",
      duration: length,
    });
  } catch (error) {
    overlay.remove();
    throw error;
  }
  Object.assign(mounted.element.style, { display: "block", width: "100%", height: "100%" });
  // No WebGL2: nothing to show, so the caller's fallback stands.
  if (mounted.renderer && !mounted.renderer.supported) {
    mounted.dispose();
    overlay.remove();
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let raf = 0;
    let done = false;
    const finish = (played: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      mounted.dispose();
      overlay.remove();
      resolve(played);
    };
    const abort = () => finish(false);
    // Follows the anchor as the page scrolls or reflows; stops if it leaves the page.
    const follow = () => {
      if (anchor !== "viewport" && !anchor.isConnected) return finish(false);
      place(overlay, anchor, options.outset);
      raf = requestAnimationFrame(follow);
    };
    const timer = setTimeout(() => finish(true), length + 32);
    options.signal?.addEventListener("abort", abort, { once: true });
    raf = requestAnimationFrame(follow);
  });
}
