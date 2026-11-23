/**
 * Catalog effects on a page in one call: pick an effect, give it what it
 * takes (a picture, a video, an SVG, words or a path) and get it running.
 *
 * - Pairing: `subjectValues` turns a subject into the control values (and
 *   live sources) an effect needs, using `effectInputs`.
 * - Embedding: `mountEffect` runs a shader effect (`ShaderRenderer`) or a
 *   vector effect (`SvgPlayer`) in an element, with its subject, and
 *   previews a camera move on its subject.
 * - Moments: `playMoment` plays an effect once over an element (a change
 *   highlighted, a result arriving) and removes it.
 *
 * For a page that draws a few effects and should not load the whole
 * catalog, use `@pixerate/flair/embed/lazy`: the same API with effects by id
 * loaded one by one.
 *
 * @packageDocumentation
 */

import { getEffect, type EffectDefinition } from "../catalog/index.js";
import { mountDefinition, type KindMounters, type MountedEffect, type MountOptions } from "./mount.js";
import { mountTiming } from "./timing.js";
import { previewTextTreatment } from "./treatment.js";
import { playMomentWith, type MomentAnchor, type MomentOptions } from "./moment.js";
import { preloadImages, releaseImages } from "../shader/textures.js";

export { resolveSubject, subjectValues, type EffectSubject, type MountedEffect, type MountOptions, type SubjectValues } from "./mount.js";
export { momentLength, type MomentAnchor, type MomentOptions } from "./moment.js";
export { preloadImages, releaseImages };
export { UI_HINTS, uiValues, type JsonValue, type UiDescriptor } from "../catalog/ui-hints.js";
export { recordEffect, recordingPlan, type RecordFormat, type RecordOptions, type RecordPointer, type RecordingPlan } from "./record.js";
export { PREVIEW_FOOTAGE_MS, previewFootage, videoFootage } from "./timing.js";
export {
  caretAt,
  drawTextTreatmentPlans,
  mountTextTreatment,
  previewTextTreatment,
  rangeRects,
  TREATMENT_PREVIEW_SCRIPT,
  treatmentOf,
  type TextTreatmentOverlay,
  type TextTreatmentOverlayOptions,
  type TreatmentPlayback,
  type TreatmentPreview,
  type TreatmentPreviewOptions,
  type TreatmentTargetSource,
} from "./treatment.js";
export {
  DEFAULT_TEXT_TREATMENT,
  getTextTreatment,
  TEXT_TREATMENT_STAGES,
  textTreatmentDuration,
  textTreatmentPlan,
  textTreatments,
  type TextTreatmentPlan,
  type TextTreatmentTarget,
  type TreatmentCaret,
  type TreatmentPlanLayer,
  type TreatmentRect,
} from "../catalog/treatment.js";
export { checkShutter, FrameAverager, shutterTimes, DEFAULT_SHUTTER_SAMPLES, type Shutter, type ShutterOptions } from "../export/shutter.js";

const KINDS: KindMounters = { mountTiming, previewTextTreatment };

function lookUp(effect: EffectDefinition | string): EffectDefinition {
  const def = typeof effect === "string" ? getEffect(effect) : effect;
  if (!def) throw new Error(`There is no effect "${String(effect)}" in the catalog; findEffects() lists them.`);
  return def;
}

/**
 * Runs a catalog effect (by id or definition) in `host`, applied to
 * `subject`: a shader on a canvas (transparent for overlays, so it lays over
 * the page), or a vector effect in an SVG player that answers its trigger
 * (hover, press, click, scroll), or a camera move previewed on the subject
 * (a picture standing in for a scene's board: a transition moves from the
 * whole picture to a detail, a hold plays across it), or a timing effect
 * retiming a `{ video }` subject (paused and sought frame by frame, put back
 * as it was on `dispose`; without one, a preview clip of Flair's own), or a
 * text treatment's scripted edit on a paragraph of its own (see
 * `previewTextTreatment`; over your own text, use `mountTextTreatment`). Shaders that read `iScroll` follow the
 * page's scrolling, and audio-reactive shaders hear an `{ audio }` subject.
 * Throws a sentence when the effect is unknown or takes no such subject.
 *
 * ```ts
 * mountEffect(el, "image-duotone", { subject: { image: "/team.jpg" }, preset: "Spotify" });
 * mountEffect(el, "crt", { subject: { video: videoElement } });
 * mountEffect(el, "long-exposure", { subject: { video: videoElement }, preset: "Light trails" });
 * mountEffect(el, "typewriter", { subject: { text: "Hello there" } });
 * mountEffect(el, "neon-outline", { subject: { svg: logoMarkup } });
 * mountEffect(el, "spectrum-bars", { subject: { audio: audioElement } });
 * mountEffect(el, "sticker-cutout", { subject: { asset: "pixerate:cat-heart" }, resolveAsset: library.resolve });
 * ```
 */
export function mountEffect(host: HTMLElement, effect: EffectDefinition | string, options: MountOptions = {}): MountedEffect {
  return mountDefinition(host, lookUp(effect), options, KINDS);
}

/**
 * Plays a shader or vector effect once over `anchor` (an element, or
 * `"viewport"`) and then removes it: a transparent overlay that lets the
 * pointer through, sized to the anchor and following it as the page
 * scrolls, disposed (canvas, GL context and all) when it has played. It
 * plays nothing, and settles `false`, when the visitor prefers reduced
 * motion (see `reducedMotion`), WebGL2 is missing for a shader, the anchor
 * is not on the page, or `signal` aborts first: keep a CSS fallback for
 * those. Settles `true` once it has played and is gone. Throws a sentence
 * for an unknown id, or an effect that is not a shader or vector effect.
 *
 * ```ts
 * playMoment(card, "change-pulse", { values: { tone: "update" } });
 * playMoment("viewport", "confetti", { duration: 2000 });
 * ```
 */
export function playMoment(anchor: MomentAnchor, effect: EffectDefinition | string, options: MomentOptions = {}): Promise<boolean> {
  return playMomentWith(anchor, lookUp(effect), options);
}

export {
  mountScene,
  recordScene,
  sceneRecordingPlan,
  SceneCompositor,
  shotIndexAt,
  type MountedScene,
  type MountSceneOptions,
  type SceneCompositorOptions,
  type SceneRecordingPlan,
  type SceneRecordOptions,
  type SceneSlotSubjects,
} from "./scene.js";
