import { cameraEffects, cameraMoveValues, getCameraMove } from '../catalog/camera.js';
import type { CameraEffect, CameraRole } from '../catalog/types.js';
import type { ControlValue } from '../shader/controls.js';
import type { Stage, View } from './camera.js';
import type { Shot } from './types.js';
import { DEFAULT_TRANSITION_MS } from './layers.js';

/**
 * A camera move from the catalog, as a shot names it: its id
 * (`"camera-whip-pan"`), or the id with a preset, values and a length:
 * `{ "move": "camera-whip-pan", "ms": 450, "values": { "motionBlur": 3 } }`.
 */
export type CameraMoveSpec =
  | string
  | {
      move: string;
      /** How long the move takes, in ms (default the move's own; a hold plays across the shot's hold). */
      ms?: number;
      /** A preset of the move's, by name. */
      preset?: string;
      /** Control values over its defaults (and the preset's). */
      values?: Record<string, ControlValue>;
    };

/** The move a shot glides in with when its camera names none. */
export const DEFAULT_CAMERA_MOVE = 'camera-glide';

/** A camera move worked out for a shot: the move, its values and how long it takes. */
export interface ShotMove {
  move: CameraEffect;
  values: Record<string, ControlValue>;
  ms: number;
}

/** The catalog's camera moves for a role, as a sentence's list: `"camera-glide", "camera-whip-pan", …`. */
export function cameraMoveIds(role: CameraRole): string {
  return cameraEffects
    .filter((m) => m.motion.role === role)
    .map((m) => `"${m.id}"`)
    .join(', ');
}

/**
 * A shot's camera move for a role (`in` for a `transition`, `during` for a
 * `hold`), with the problems in it as sentences. Unknown ids, a move of the
 * other role, bad values and a bad length are each a problem; the move is
 * then undefined (or, for bad values, played with its defaults).
 */
export function resolveCameraMove(
  spec: unknown,
  role: CameraRole,
  holdMs?: number,
): { move?: ShotMove; issues: string[] } {
  const field = role === 'transition' ? 'in' : 'during';
  if (typeof spec !== 'string' && !(spec && typeof spec === 'object' && !Array.isArray(spec))) {
    return { issues: [`Camera "${field}" is a camera move's id, or { "move": id, "ms"?, "preset"?, "values"? }; the moves for it are ${cameraMoveIds(role)}.`] };
  }
  const given = typeof spec === 'string' ? { move: spec } : (spec as Record<string, unknown>);
  const issues: string[] = [];
  for (const key of Object.keys(given)) {
    if (!['move', 'ms', 'preset', 'values'].includes(key)) issues.push(`Camera "${field}" has no field "${key}"; it takes move, ms, preset and values.`);
  }
  const id = given.move;
  const move = typeof id === 'string' ? getCameraMove(id) : undefined;
  if (!move) {
    issues.push(`There is no camera move ${JSON.stringify(id)}; camera "${field}" takes one of ${cameraMoveIds(role)}.`);
    return { issues };
  }
  if (move.motion.role !== role) {
    const other = role === 'transition' ? 'during' : 'in';
    issues.push(
      `"${move.id}" moves the camera ${move.motion.role === 'hold' ? 'while a shot holds' : 'into a shot'}, so it goes in camera "${other}", not "${field}"; camera "${field}" takes one of ${cameraMoveIds(role)}.`,
    );
    return { issues };
  }
  let ms = role === 'hold' ? (holdMs ?? 800) : move.motion.duration;
  if (given.ms !== undefined) {
    if (role === 'hold') issues.push(`A move while the shot holds plays across the shot's hold; set the shot's "hold" instead of "ms".`);
    else if (typeof given.ms === 'number' && given.ms >= 0 && given.ms <= 10000) ms = given.ms;
    else issues.push(`Camera "in" ms is how long the move takes, 0 to 10000 (default ${move.motion.duration} for "${move.id}").`);
  }
  if (given.values !== undefined && (typeof given.values !== 'object' || given.values === null || Array.isArray(given.values))) {
    issues.push(`Camera "${field}" values are an object of the move's controls, like { "motionBlur": 1 }.`);
  }
  const resolved = cameraMoveValues(move, {
    ...(typeof given.preset === 'string' ? { preset: given.preset } : {}),
    ...(given.values && typeof given.values === 'object' && !Array.isArray(given.values) ? { values: given.values as Record<string, unknown> } : {}),
  });
  if (given.preset !== undefined && typeof given.preset !== 'string') issues.push(`Camera "${field}" preset is a preset's name.`);
  issues.push(...resolved.issues);
  return { move: { move, values: resolved.values, ms: move.motion.duration === 0 && role === 'transition' ? 0 : ms }, issues };
}

/** The camera move a shot with a transition and no camera `in` makes: a cut, so the transition does the move. */
export const TRANSITION_CAMERA_MOVE = 'camera-cut';

/**
 * The move a shot's camera gets in with (its `in`, else a cut when the shot
 * has a transition, else a glide), or undefined when it does not move (no camera).
 */
export function shotInMove(shot: Shot): ShotMove | undefined {
  if (!shot.camera) return undefined;
  const spec = shot.camera.in ?? (shot.transition ? TRANSITION_CAMERA_MOVE : DEFAULT_CAMERA_MOVE);
  return resolveCameraMove(spec, 'transition').move ?? resolveCameraMove(DEFAULT_CAMERA_MOVE, 'transition').move;
}

/** How long a shot's transition takes, in ms (0 without one). */
export function shotTransitionMs(shot: Shot): number {
  const t = shot.transition;
  if (!t || typeof t !== 'object') return 0;
  return typeof t.ms === 'number' && t.ms >= 0 ? t.ms : DEFAULT_TRANSITION_MS;
}

/** The move a shot's camera makes while it holds (its `during`), or undefined. */
export function shotHoldMove(shot: Shot): ShotMove | undefined {
  const spec = shot.camera?.during;
  return spec === undefined ? undefined : resolveCameraMove(spec, 'hold', shot.hold ?? 800).move;
}

/** The camera `u` (0 to 1) of the way through a move from one framing to another. */
export function moveView(move: ShotMove, from: View, to: View, u: number, stage: Stage): View {
  return move.move.motion.view({ from, to, u, stage, ms: move.ms }, move.values);
}
