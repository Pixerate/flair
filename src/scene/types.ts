import type { Rect, SceneElement } from './geometry.js';
import type { CameraAngle, Stage } from './camera.js';
import type { CameraMoveSpec } from './moves.js';
import type { Behavior } from './behavior.js';
import type { SceneRig } from './rig.js';
import type { SceneLayer, ShotTransition } from './layers.js';
import type { ReplicatorConfig } from './replicator.js';

export interface ElementCommand {
  type: 'element';
  element: SceneElement;
}

export interface UpdateCommand {
  type: 'update';
  id: string;
  props: Partial<SceneElement>;
}

export interface DeleteCommand {
  type: 'delete';
  id: string;
}

export interface ClearCommand {
  type: 'clear';
}

/**
 * Copies of one element laid out in a pattern (see `ReplicatorConfig`):
 * `{ "type": "replicate", "element": {…}, "pattern": "grid", "count": 6 }`
 * draws `<id>_0` to `<id>_5`. A camera's `frame` or a layer's `ids` can
 * name the copies, or the element's own id for all of them. With
 * `sequence.delayPerItem`, each copy appears that many ms after the last.
 */
export interface ReplicateCommand extends ReplicatorConfig {
  type: 'replicate';
  element: SceneElement;
}

export interface CustomCommand {
  type: string;
  [key: string]: unknown;
}

/** A command to add, move, or style elements in a shot. */
export type SceneCommand =
  | ElementCommand
  | UpdateCommand
  | DeleteCommand
  | ClearCommand
  | ReplicateCommand
  | CustomCommand;

export function isElementCommand(cmd: SceneCommand): cmd is ElementCommand {
  return cmd.type === 'element' && 'element' in cmd && !!cmd.element;
}

export function isUpdateCommand(cmd: SceneCommand): cmd is UpdateCommand {
  return cmd.type === 'update' && 'id' in cmd && typeof cmd.id === 'string';
}

export function isReplicateCommand(cmd: SceneCommand): cmd is ReplicateCommand {
  return cmd.type === 'replicate' && 'element' in cmd && !!cmd.element && typeof (cmd as ReplicateCommand).count === 'number';
}

export function isDeleteCommand(cmd: SceneCommand): cmd is DeleteCommand {
  return cmd.type === 'delete' && 'id' in cmd && typeof cmd.id === 'string';
}

export interface DynamicFraming {
  /** Element IDs to frame. */
  frame: string[];
  /** Proportional padding (default 0.15 for 15%). */
  padding?: number;
  /** Minimum width in scene units. */
  minWidth?: number;
  /** Minimum height in scene units. */
  minHeight?: number;
}

/**
 * A shot's camera beyond its framing: its 3D angle (see `CameraAngle`) and
 * the camera moves from the catalog it plays (see `CameraMoveSpec`). An
 * angle left out keeps the value the camera already has, so set `tilt: 0`
 * to come back flat.
 */
export interface CameraLens extends CameraAngle {
  /**
   * How the camera gets into this shot: a camera move from the catalog
   * whose role is `transition` (`camera-glide`, the default, eases across;
   * `camera-whip-pan`, `camera-punch-zoom`, `camera-cut`…), by id or with
   * its length and values: `{ "move": "camera-whip-pan", "values": { "motionBlur": 3 } }`.
   */
  in?: CameraMoveSpec;
  /**
   * How the camera moves while this shot holds: a camera move whose role is
   * `hold` (`camera-ken-burns`, `camera-crash-zoom`…), played across the
   * shot's `hold`. The next shot's move starts from where it ends.
   */
  during?: CameraMoveSpec;
}

/**
 * Where the camera goes for a shot: a framing box, a dynamic framing, or
 * neither (only a new angle or move, keeping the framing), with any
 * {@link CameraLens} fields alongside: `{ "frame": ["chart"], "tilt": 30 }`.
 */
export type ShotCamera = (Rect | DynamicFraming | Record<never, never>) & CameraLens;

/** One beat of a scene: camera framing, title, narration/caption, commands, layers of catalog effects and a transition into it. */
export interface Shot {
  /** Narration / caption spoken or displayed during this beat. */
  caption?: string;
  /** High-level title or callout displayed on screen. */
  title?: string;
  /** Camera framing box in scene units or dynamic auto-framing target, with an optional 3D angle and motion blur. */
  camera?: ShotCamera;
  /** Pause/dwell duration after this shot's actions run (in milliseconds). Default: 800ms. */
  hold?: number;
  /** Drawing or state change commands played during this shot. */
  run?: SceneCommand[];
  /** Catalog effects, custom shaders and pictures this shot starts, as layers (see {@link SceneLayer}). */
  layers?: SceneLayer[];
  /** A catalog transition from the last shot into this one (see {@link ShotTransition}). */
  transition?: ShotTransition;
  /** Continuous procedural parameter and physics behaviors (a path among them) played while this shot holds. */
  behaviors?: Behavior[];
}

/** Complete animated scene specification. */
export interface Scene {
  name: string;
  title?: string;
  description?: string;
  stage?: Partial<Stage>;
  /** Target duration [minSeconds, maxSeconds]. */
  target?: [number, number];
  /** Interactive macro rigs binding high-level controls to layers' control values or element properties. */
  rig?: SceneRig;
  shots: Shot[];
}
