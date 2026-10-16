/**
 * What an effect takes and how it answers the pointer, worked out from the
 * effect itself (its controls, its `video` use, the pointer built-ins its
 * source reads, its `trigger`), so a consumer can pair a picture, a video,
 * an SVG, a word or a path with effects that suit it.
 */

import type { ControlDef } from "../shader/controls.js";
import type { SvgTrigger } from "../vector/svg.js";
import type { EffectDefinition, VideoUse } from "./types.js";

/**
 * Something you can give an effect:
 * - `image`: a photo or picture (any URL or `data:` image) for an image control.
 * - `video`: a live `<video>` (or canvas) for an image control, with `setLiveSource`.
 * - `svg`: an SVG file or `data:` URL for an image control (drawn as a picture, keeping its transparency).
 * - `text`: words, for a text control, or for a text mask through `textImage`.
 * - `mask`: a shape with transparency (an icon, a logo, `textImage`) whose silhouette the effect uses.
 * - `path`: SVG path data (`d`), for a shape control.
 * - `audio`: sound (a playing `<audio>` or `<video>`, a microphone, a Web
 *   Audio node, or an `AudioBuffer` for recordings) that it reacts to
 *   through `iAudio`, `iSpectrum` or `iBeat`.
 */
export type EffectInput = "image" | "video" | "svg" | "text" | "mask" | "path" | "audio";

/** Every {@link EffectInput}. */
export const EFFECT_INPUTS: readonly EffectInput[] = ["image", "video", "svg", "text", "mask", "path", "audio"];

/**
 * How an effect answers the pointer:
 * - `hover`: changes while the pointer is over it.
 * - `press`: changes while the pointer is held down (or dragged).
 * - `click`: answers each click or tap.
 * - `trail`: follows where the pointer has just been.
 * - `pointer`: follows where the pointer is.
 * - `scroll`: follows the page's scrolling (`iScroll`, or a vector effect's
 *   `trigger: "scroll"`).
 */
export type EffectInteraction = "hover" | "press" | "click" | "trail" | "pointer" | "scroll";

/** Every {@link EffectInteraction}. */
export const EFFECT_INTERACTIONS: readonly EffectInteraction[] = ["hover", "press", "click", "trail", "pointer", "scroll"];

/** A shader's image control and what it wants. */
export interface ImageSlot {
  /** The control's name (a `sampler2D` uniform): set it with `setValues` or `setLiveSource`. */
  name: string;
  label: string;
  /**
   * What it is for: `picture` (a photo, video or SVG shown as it is), `mask`
   * (a shape whose transparency the effect uses: an icon, a logo, a
   * silhouette), or `text` (a word drawn by `textImage`).
   */
  wants: "picture" | "mask" | "text";
}

/** A vector effect's text control and what it holds. */
export interface TextSlot {
  /** The control's name: set it with `renderVectorEffect(effect, { [name]: … })`. */
  name: string;
  label: string;
  /** `copy` (words shown), `font` (a CSS font family), `path` (SVG path data) or `glyphs` (characters to draw from). */
  holds: "copy" | "font" | "path" | "glyphs";
  default: string;
}

/** What an effect takes and how it answers the pointer (see {@link effectInputs}). */
export interface EffectInputs {
  /** Everything it can be given, from its image and text controls. Empty: it makes its picture from nothing. */
  accepts: EffectInput[];
  /** Its image controls (shader effects). */
  images: ImageSlot[];
  /** Its text controls (vector effects). */
  texts: TextSlot[];
  /** How it suits video, for shaders with an image control (see `VideoUse`). */
  video?: VideoUse;
  /** How it answers the pointer; empty when it does not. */
  interactions: EffectInteraction[];
  /** A vector effect's trigger: what makes it play. */
  trigger?: SvgTrigger;
  /** Draws over other content (render it with `alpha: true`, over a page or picture). */
  transparent: boolean;
}

/** `textImage` output: a UTF-8 SVG `data:` URL holding a `<text>`. */
function isTextImage(url: string): boolean {
  if (!url.startsWith("data:image/svg+xml;charset=utf-8,")) return false;
  try {
    return decodeURIComponent(url.slice(url.indexOf(",") + 1)).includes("<text");
  } catch {
    return false;
  }
}

const PATH_DATA = /^\s*[Mm]\s*[-+.\d]/;

function textSlot(control: ControlDef): TextSlot {
  const value = String(control.default);
  const holds: TextSlot["holds"] =
    control.name === "font" || /\bfont\b/i.test(control.label)
      ? "font"
      : PATH_DATA.test(value)
        ? "path"
        : control.name === "glyphs"
          ? "glyphs"
          : "copy";
  return { name: control.name, label: control.label, holds, default: value };
}

/** A shader's source without its comments. */
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

/** The pointer and scroll built-ins a shader's source reads (comments left out), as interactions. */
function shaderInteractions(source: string): EffectInteraction[] {
  const code = codeOf(source);
  const found = new Set<EffectInteraction>();
  if (/\biClicks\b/.test(code)) found.add("click");
  if (/\biTrail\b/.test(code)) found.add("trail");
  if (/\biPointer\s*\.\s*z\b/.test(code)) found.add("hover");
  if (/\biPointer\s*\.\s*w\b/.test(code) || /\biMouse\s*\.\s*z\b/.test(code)) found.add("press");
  if (/\biPointer\s*\.\s*xy?\b/.test(code) || /\biMouse\s*\.\s*xy?\b/.test(code)) found.add("pointer");
  if (/\biScroll\b/.test(code)) found.add("scroll");
  return EFFECT_INTERACTIONS.filter((i) => found.has(i));
}

/**
 * What `effect` takes and how it answers the pointer, given its controls (see
 * `effectInputs` in the catalog, which passes them), from its controls and
 * source: its image controls (and whether each wants a picture, a mask or
 * text), its text controls (copy, fonts, path data), how it suits video, the
 * pointer and scroll built-ins it reads (`iPointer`, `iClicks`, `iTrail`,
 * `iMouse`, `iScroll`) or its `trigger`, whether it hears sound (`iAudio`,
 * `iSpectrum`, `iBeat`), and whether it draws over other content.
 */
export function inputsOf(effect: EffectDefinition, controls: readonly ControlDef[]): EffectInputs {
  const accepts = new Set<EffectInput>();
  const images: ImageSlot[] = [];
  const texts: TextSlot[] = [];
  for (const control of controls) {
    if (control.type === "sampler2D") {
      const value = String(control.default);
      const video = effect.kind === "shader" ? effect.video : undefined;
      const wants: ImageSlot["wants"] = isTextImage(value) ? "text" : video === "none" ? "mask" : "picture";
      images.push({ name: control.name, label: control.label, wants });
      if (wants === "picture") {
        accepts.add("image").add("svg");
        if (video && video !== "none") accepts.add("video");
      } else {
        // A shape with transparency: an icon, a logo, an SVG, or a word through textImage.
        accepts.add("mask").add("svg").add("text").add("image");
      }
    } else if (control.type === "text") {
      const slot = textSlot(control);
      texts.push(slot);
      if (slot.holds === "copy") accepts.add("text");
      if (slot.holds === "path") accepts.add("path");
    }
  }
  if (effect.kind === "shader" && /\bi(Audio|Spectrum|Beat)\b/.test(codeOf(effect.source))) accepts.add("audio");
  const interactions =
    effect.kind === "vector"
      ? effect.trigger
        ? [effect.trigger]
        : []
      : shaderInteractions(effect.source);
  return {
    accepts: EFFECT_INPUTS.filter((i) => accepts.has(i)),
    images,
    texts,
    ...(effect.kind === "shader" && effect.video ? { video: effect.video } : {}),
    interactions,
    ...(effect.kind === "vector" && effect.trigger ? { trigger: effect.trigger } : {}),
    transparent: effect.kind === "shader" ? Boolean(effect.transparent) : false,
  };
}
