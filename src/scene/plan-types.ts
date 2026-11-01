import type { ControlValue } from '../shader/controls.js';
import type { SvgMotion } from '../vector/motion.js';
import type { Stage, View } from './camera.js';
import type { Rect, SceneElement } from './geometry.js';
import type { LayerRole, SceneSubject, SubjectSlot, TRANSITION_CONTROLS } from './layers.js';

/**
 * The shape of a {@link ScenePlan}, apart from the code that makes one
 * (`scenePlan`), so players can read plans without the catalog.
 */

/** The version of {@link ScenePlan} this library writes. A player refuses a plan of a version it does not know. */
export const SCENE_PLAN_VERSION = 1;

/**
 * What a layer or transition draws, as data: a shader (GLSL ES 3.00
 * `mainImage`) with every control's value worked out, a vector effect's
 * picture with its values filled in, or a bare picture (its subject).
 */
export type PlanDraw =
  | {
      kind: 'shader';
      /** The catalog effect's id (absent for a custom source). */
      effect?: string;
      source: string;
      /** Every control's value, but the ones the player fills (the subject's, a transition's pictures). */
      values: Record<string, ControlValue>;
      /** Draws over other content: render on a transparent canvas. */
      transparent: boolean;
      /** The image control the layer's subject fills. */
      subjectControl?: string;
    }
  | {
      kind: 'vector';
      effect: string;
      /** The picture with its controls (and a text subject) filled in: play it as `SvgPlayer` does, looping. */
      motion: SvgMotion;
      /** Ms it rests on its last frame before it loops. */
      holdMs: number;
    }
  | { kind: 'picture' };

/** Where a layer is drawn: over the whole screen, a box on the board, or the bounds of elements (with padding) on the board. */
export type PlanPlacement = { screen: true } | { rect: Rect } | { ids: string[]; padding: number };

/** A layer, resolved: when, where, what and on what. */
export interface PlanLayer {
  key: string;
  /** The shot it was declared in (0-based). */
  shot: number;
  role: LayerRole;
  startMs: number;
  endMs: number;
  opacity: number;
  fade: number;
  place: PlanPlacement;
  draw: PlanDraw;
  /** A picture, video URL, SVG or words; or the slot, when it was not filled when the plan was made. */
  subject?: SceneSubject | SubjectSlot;
  /** Control values that behaviors change over time, keyed by ms on the scene's timeline (hold the last key). */
  tracks?: { ms: number; values: Record<string, number> }[];
}

/** A transition, resolved: the shader, and the controls the player drives. */
export interface PlanTransition {
  /** The shot it leads into (0-based). */
  shot: number;
  startMs: number;
  ms: number;
  draw: Extract<PlanDraw, { kind: 'shader' }>;
  /** The image controls for the outgoing frame (`from`, held still) and the incoming shot (`to`), the 0–1 `progress`, and the `animate` switch to turn off. */
  controls: typeof TRANSITION_CONTROLS;
}

/** An element's state over the scene: a key each time it changes (null once it is gone). */
export interface PlanElement {
  id: string;
  keys: { ms: number; element: SceneElement | null }[];
}

/** A shot's timing and words. */
export interface PlanShot {
  index: number;
  startMs: number;
  /** The lead-in: the camera's move or the transition into it. */
  moveMs: number;
  holdMs: number;
  /** The title and caption showing (carried over from earlier shots, as the player does). */
  title?: string;
  caption?: string;
}

/**
 * A scene with everything a player needs worked out, as plain JSON: when
 * each shot, layer and transition plays, the camera at every frame, every
 * element's state as it changes, and each effect's shader or picture with
 * its values. Nothing in it is code to run or needs the catalog, so any
 * player can draw it: the web player (`standaloneSceneHtml`,
 * `recordScene`) does, and a native one could (it would need GLSL ES 3.00
 * shaders compiled for its GPU, and an SVG renderer for vector layers).
 */
export interface ScenePlan {
  version: typeof SCENE_PLAN_VERSION;
  name: string;
  title?: string;
  stage: Stage;
  durationMs: number;
  /** The rate the camera is keyed at. */
  fps: number;
  shots: PlanShot[];
  /** The camera at every frame (eased moves and cuts included; hold each view to the next). */
  camera: { ms: number; view: View }[];
  elements: PlanElement[];
  /** Bottom of the stack first. */
  layers: PlanLayer[];
  transitions: PlanTransition[];
  /** What could not be resolved (a slot nobody filled, an effect the catalog does not have), as sentences. */
  notes: string[];
}

/** The value a plan's keys give at a time: the last key at or before it (undefined before the first). */
export function keyAt<T extends { ms: number }>(keys: readonly T[], ms: number): T | undefined {
  let lo = 0;
  let hi = keys.length - 1;
  let found: T | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid]!.ms <= ms) {
      found = keys[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** A layer's opacity in a plan at a time on the scene's timeline (0 outside its stretch, faded over its `fade`). */
export function planLayerOpacity(layer: PlanLayer, ms: number): number {
  if (ms < layer.startMs || ms >= layer.endMs) return 0;
  if (!(layer.fade > 0)) return layer.opacity;
  return layer.opacity * Math.min(1, (ms - layer.startMs) / layer.fade, (layer.endMs - ms) / layer.fade);
}
