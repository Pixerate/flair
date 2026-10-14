import type { Rect, SceneElement } from './geometry.js';
import type { Stage } from './camera.js';
import type { Effect } from './effects.js';
import type { Behavior } from './behavior.js';
import type { SceneRig } from './rig.js';

/** Shader or external visual stream in the scene. */
export interface SceneMedia {
  type: 'shader' | string;
  source?: string;
  values?: Record<string, unknown>;
  [field: string]: unknown;
}

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
  | CustomCommand;

export function isElementCommand(cmd: SceneCommand): cmd is ElementCommand {
  return cmd.type === 'element' && 'element' in cmd && !!cmd.element;
}

export function isUpdateCommand(cmd: SceneCommand): cmd is UpdateCommand {
  return cmd.type === 'update' && 'id' in cmd && typeof cmd.id === 'string';
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

export type ShotCamera = Rect | DynamicFraming;

/** One beat of a scene: camera framing, title, narration/caption, commands, and procedural effects. */
export interface Shot {
  /** Narration / caption spoken or displayed during this beat. */
  caption?: string;
  /** High-level title or callout displayed on screen. */
  title?: string;
  /** Camera framing box in scene units, or dynamic auto-framing target. */
  camera?: ShotCamera;
  /** Pause/dwell duration after this shot's actions run (in milliseconds). Default: 800ms. */
  hold?: number;
  /** Drawing or state change commands played during this shot. */
  run?: SceneCommand[];
  /** Procedural visual effects started in this shot. */
  effects?: Effect[];
  /** IDs of active effects to stop/fade at the start of this shot. */
  stopEffects?: string[];
  /** Continuous procedural parameter and physics behaviors played during this shot. */
  behaviors?: Behavior[];
}

/** Complete animated scene specification. */
export interface Scene {
  name: string;
  title?: string;
  description?: string;
  stage?: Partial<Stage>;
  /** Embedded media (e.g. bespoke WebGL fragment shaders). */
  media?: Record<string, SceneMedia>;
  /** Target duration [minSeconds, maxSeconds]. */
  target?: [number, number];
  /** Interactive macro rigs binding high-level controls to uniforms or element properties. */
  rig?: SceneRig;
  shots: Shot[];
}
