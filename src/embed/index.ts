/**
 * Catalog effects on a page in one call: pick an effect, give it what it
 * takes (a picture, a video, an SVG, words or a path) and get it running.
 *
 * - Pairing: `subjectValues` turns a subject into the control values (and
 *   live sources) an effect needs, using `effectInputs`.
 * - Embedding: `mountEffect` runs a shader effect (`ShaderRenderer`) or a
 *   vector effect (`SvgPlayer`) in an element, with its subject.
 *
 * @packageDocumentation
 */

import { effectDefaults, effectInputs, getEffect, textImage, type EffectDefinition, type ImageSlot, type TextSlot } from "../catalog/index.js";
import { renderVectorEffect } from "../catalog/types.js";
import type { ControlValue } from "../shader/controls.js";
import { ShaderRenderer } from "../shader/renderer.js";
import type { LiveSource } from "../shader/textures.js";
import { SvgPlayer } from "../vector/svg.js";

export { recordEffect, recordingPlan, type RecordFormat, type RecordOptions, type RecordPointer, type RecordingPlan } from "./record.js";

/**
 * What an effect is applied to:
 * - `{ image }`: a picture's URL (or `data:` URL).
 * - `{ video }`: a playing `<video>` (or a canvas), shown live.
 * - `{ svg }`: an SVG, as markup (`"<svg …>"`) or a URL; drawn as a picture, keeping its transparency.
 * - `{ text }`: words, for a vector effect's text, or drawn with `textImage` for a shader's text or mask.
 * - `{ path }`: SVG path data (`d`), for a shape control.
 */
export type EffectSubject =
  | { image: string }
  | { video: LiveSource }
  | { svg: string }
  | { text: string; font?: string; weight?: number | string }
  | { path: string };

/** What a subject becomes for an effect: control values, and live sources by image control. */
export interface SubjectValues {
  values: Record<string, ControlValue>;
  live: Record<string, LiveSource>;
}

const kindOf = (subject: EffectSubject) => Object.keys(subject).find((k) => k !== "font" && k !== "weight") as "image" | "video" | "svg" | "text" | "path";

/** An SVG as a URL: markup becomes a UTF-8 `data:` URL; a URL stays as it is. */
function svgUrl(svg: string): string {
  const markup = svg.trim();
  if (!markup.startsWith("<")) return svg;
  const withNs = /\sxmlns\s*=/.test(markup.slice(0, markup.indexOf(">") + 1)) ? markup : markup.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
}

function pick<T extends { name: string }>(slots: T[], wanted: (s: T) => boolean, name: string | undefined, effect: EffectDefinition, what: string): T {
  const slot = name ? slots.find((s) => s.name === name) : slots.find(wanted);
  if (!slot) {
    const names = slots.map((s) => s.name).join(", ");
    throw new Error(
      name
        ? `"${effect.id}" has no control "${name}" for ${what}${names ? `; it has ${names}` : ""}.`
        : `"${effect.id}" takes no ${what}; see effectInputs(effect).accepts, or findEffects({ accepts: [...] }) for effects that do.`,
    );
  }
  return slot;
}

/**
 * The control values (and live sources) that put `subject` in `effect`,
 * into the control named `slot` or the first that suits it: a picture or
 * SVG into an image control, a video into a picture control as a live
 * source, words into a vector effect's text or (drawn by `textImage`) a
 * shader's text or mask control, path data into a shape control. Several
 * subjects fill several controls in order (a transition's from and to).
 * Throws a sentence when the effect takes no such thing.
 */
export function subjectValues(effect: EffectDefinition, subject: EffectSubject | readonly EffectSubject[], slot?: string): SubjectValues {
  const out: SubjectValues = { values: {}, live: {} };
  const inputs = effectInputs(effect);
  const used = new Set<string>();
  for (const s of Array.isArray(subject) ? subject : [subject as EffectSubject]) {
    const kind = kindOf(s);
    const free = <T extends { name: string }>(slots: T[]) => slots.filter((x) => !used.has(x.name));
    if (kind === "path" || (kind === "text" && effect.kind === "vector")) {
      const holds = kind === "path" ? "path" : "copy";
      const text = pick<TextSlot>(free(inputs.texts), (t) => t.holds === holds, slot, effect, kind === "path" ? "path data" : "text");
      out.values[text.name] = kind === "path" ? (s as { path: string }).path : (s as { text: string }).text;
      used.add(text.name);
      continue;
    }
    if (effect.kind === "vector")
      throw new Error(`"${effect.id}" is a vector effect: it draws its own picture and takes words or path data (${inputs.accepts.join(", ") || "nothing"}), not ${{ svg: "an SVG", image: "an image", video: "a video" }[kind as "svg" | "image" | "video"]}.`);
    const wanted = (x: ImageSlot) =>
      kind === "text" ? x.wants !== "picture" : kind === "video" ? x.wants === "picture" : true;
    const image = pick<ImageSlot>(free(inputs.images), wanted, slot, effect, kind === "text" ? "text" : `${kind === "svg" ? "SVG" : kind}`);
    used.add(image.name);
    if (kind === "video") {
      if (!inputs.accepts.includes("video")) throw new Error(`"${effect.id}" is not made for video (video: "${inputs.video}"); give it a picture.`);
      out.live[image.name] = (s as { video: LiveSource }).video;
    } else if (kind === "text") {
      const t = s as { text: string; font?: string; weight?: number | string };
      out.values[image.name] = textImage(t.text, { ...(t.font ? { font: t.font } : {}), ...(t.weight !== undefined ? { weight: t.weight } : {}) });
    } else out.values[image.name] = kind === "svg" ? svgUrl((s as { svg: string }).svg) : (s as { image: string }).image;
  }
  return out;
}

export interface MountOptions {
  /** What to apply the effect to (see {@link EffectSubject}); several fill several controls in order. */
  subject?: EffectSubject | readonly EffectSubject[];
  /** A preset by name, then these values, over the effect's defaults. */
  preset?: string;
  values?: Record<string, ControlValue>;
  /** Start playing at once (default true). */
  autoplay?: boolean;
  /** Class for the canvas (shaders) or the player's element (vector effects). */
  className?: string;
  /** Pause while scrolled out of view (default true). */
  pauseWhenHidden?: boolean;
}

/** A running effect, from {@link mountEffect}. */
export interface MountedEffect {
  readonly effect: EffectDefinition;
  /** What it draws into: the shader's canvas, or the vector player's element. */
  readonly element: HTMLElement;
  /** The shader renderer, for a shader effect. */
  readonly renderer?: ShaderRenderer;
  /** The vector player, for a vector effect (replaced when values change). */
  readonly player?: SvgPlayer;
  /** Applies it to something else. */
  setSubject(subject: EffectSubject | readonly EffectSubject[]): void;
  /** Changes control values (merged over the current ones). */
  setValues(values: Record<string, ControlValue>): void;
  play(): void;
  pause(): void;
  /** Stops it and removes what it drew. */
  dispose(): void;
}

/**
 * Runs a catalog effect (by id or definition) in `host`, applied to
 * `subject`: a shader on a canvas (transparent for overlays, so it lays over
 * the page), or a vector effect in an SVG player that answers its trigger
 * (hover, press, click). Throws a sentence when the effect is unknown or
 * takes no such subject.
 *
 * ```ts
 * mountEffect(el, "image-duotone", { subject: { image: "/team.jpg" }, preset: "Spotify" });
 * mountEffect(el, "crt", { subject: { video: videoElement } });
 * mountEffect(el, "typewriter", { subject: { text: "Hello there" } });
 * mountEffect(el, "neon-outline", { subject: { svg: logoMarkup } });
 * ```
 */
export function mountEffect(host: HTMLElement, effect: EffectDefinition | string, options: MountOptions = {}): MountedEffect {
  const def = typeof effect === "string" ? getEffect(effect) : effect;
  if (!def) throw new Error(`There is no effect "${String(effect)}" in the catalog; findEffects() lists them.`);
  let values: Record<string, ControlValue> = { ...effectDefaults(def, { ...(options.preset ? { preset: options.preset } : {}), ...(options.values ? { values: options.values } : {}) }) };
  let live: Record<string, LiveSource> = {};
  const apply = (subject: EffectSubject | readonly EffectSubject[] | undefined) => {
    if (!subject) return;
    const s = subjectValues(def, subject);
    values = { ...values, ...s.values };
    live = s.live;
  };
  apply(options.subject);

  if (def.kind === "shader") {
    const renderer = new ShaderRenderer(host, {
      alpha: Boolean(def.transparent),
      autoplay: options.autoplay ?? true,
      pauseWhenHidden: options.pauseWhenHidden ?? true,
      ...(options.className ? { className: options.className } : {}),
    });
    renderer.setSource(def.source);
    renderer.setValues(values);
    const setLive = (previous: Record<string, LiveSource>) => {
      for (const name of Object.keys(previous)) if (!(name in live)) renderer.setLiveSource(name, null);
      for (const [name, source] of Object.entries(live)) renderer.setLiveSource(name, source);
    };
    setLive({});
    return {
      effect: def,
      element: renderer.canvas,
      renderer,
      setSubject(subject) {
        const before = live;
        apply(subject);
        renderer.setValues(values);
        setLive(before);
      },
      setValues(next) {
        values = { ...values, ...next };
        renderer.setValues(values);
      },
      play: () => renderer.play(),
      pause: () => renderer.pause(),
      dispose: () => renderer.dispose(),
    };
  }

  let player: SvgPlayer;
  const build = () => {
    player?.dispose();
    player = new SvgPlayer(host, renderVectorEffect(def, values), {
      hold: def.hold,
      ...(def.trigger ? { trigger: def.trigger } : {}),
      autoplay: options.autoplay ?? true,
      pauseWhenHidden: options.pauseWhenHidden ?? true,
    });
    if (options.className) player.view.element.className = options.className;
  };
  build();
  return {
    effect: def,
    get element() {
      return player.view.element;
    },
    get player() {
      return player;
    },
    setSubject(subject) {
      apply(subject);
      build();
    },
    setValues(next) {
      values = { ...values, ...next };
      build();
    },
    play: () => player.play(),
    pause: () => player.pause(),
    dispose: () => player.dispose(),
  };
}
