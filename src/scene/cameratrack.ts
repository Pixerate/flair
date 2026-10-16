import {
  CAMERA_MS,
  CAMERA_STEPS,
  DEFAULT_STAGE,
  transitionStrength,
  transitionView,
  viewAt,
  type CameraTransition,
  type Stage,
  type View,
} from './camera.js';
import type { SceneElement } from './geometry.js';
import { MemorySceneBoard, shotView } from './player.js';
import type { Scene, Shot } from './types.js';

/** The camera through one shot, timed as `playScene` plays it: a move from `from` to `to`, then a hold. */
export interface CameraShot {
  shot: Shot;
  index: number;
  /** When the shot starts on the scene's timeline, in ms. */
  startMs: number;
  /** How long the camera moves at the start of the shot (0 when it cuts or stays). */
  moveMs: number;
  /** How long the shot holds after the move. */
  holdMs: number;
  from: View;
  to: View;
  /** How the camera gets into the shot (`camera.transition`, `move` by default). */
  transition: CameraTransition;
  /** The blur strength the move plays with: `camera.motionBlur`, or 2 for a whip or zoom without one (0 for none). */
  motionBlur: number;
  /** The elements on stage once the shot's commands have run. */
  elements: SceneElement[];
}

/** How long the camera moves at the start of a shot, in ms: none for the first shot, a shot without a camera, or a cut. */
export function shotMoveMs(shot: Shot, index: number): number {
  return index > 0 && shot.camera && shot.camera.transition !== 'cut' ? CAMERA_MS : 0;
}

/** The scene's stage with defaults filled in. */
export function sceneStage(scene: Scene): Stage {
  return {
    width: scene.stage?.width ?? DEFAULT_STAGE.width,
    height: scene.stage?.height ?? DEFAULT_STAGE.height,
    caption: scene.stage?.caption ?? DEFAULT_STAGE.caption,
  };
}

/**
 * The camera through every shot of a scene, worked out the way `playScene`
 * moves it, for exporters and players that lay a scene out on a timeline:
 * each shot's move (framing, angle and blur strength) and hold.
 */
export function cameraTrack(scene: Scene): CameraShot[] {
  const stage = sceneStage(scene);
  const board = new MemorySceneBoard(stage);
  let view: View = viewAt(stage.width / 2, (stage.height - (stage.caption ?? 0)) / 2, 1, stage);
  let startMs = 0;
  return scene.shots.map((shot, index) => {
    const target = shotView(shot, board.elements(), stage, view);
    const transition = shot.camera?.transition ?? 'move';
    const moveMs = shotMoveMs(shot, index);
    const from = index === 0 && target ? target : view;
    const to = target ?? view;
    const holdMs = shot.hold ?? 800;
    for (const cmd of shot.run ?? []) board.runCommand(cmd);
    const entry: CameraShot = {
      shot,
      index,
      startMs,
      moveMs,
      holdMs,
      from,
      to,
      transition,
      motionBlur: transitionStrength(transition, shot.camera?.motionBlur),
      elements: board.elements().map((e) => ({ ...e })),
    };
    view = to;
    startMs += moveMs + holdMs;
    return entry;
  });
}

/** The time the player waits between steps of a camera move, in ms (its blur is measured over one). */
export const CAMERA_STEP_MS = CAMERA_MS / CAMERA_STEPS;

/**
 * The camera `ms` into a shot: part-way through its move (eased, with its
 * motion blur) or settled.
 */
export function cameraAt(entry: CameraShot, ms: number, stage: Stage): View {
  if (!(entry.moveMs > 0) || ms >= entry.moveMs) return entry.to;
  return transitionView(entry.transition, entry.from, entry.to, Math.max(0, ms) / entry.moveMs, stage, entry.motionBlur);
}

/** Whether the shot's move jumps from one framing to the other halfway (a whip or zoom). */
export const cutsHalfway = (entry: CameraShot): boolean =>
  entry.moveMs > 0 && (entry.transition === 'whip' || entry.transition === 'zoom');

/** The camera at one frame of a scene's timeline. */
export interface CameraSample {
  frame: number;
  view: View;
  /** The shot (0-based) the frame is in. */
  shot: number;
}

/**
 * The camera sampled for a timeline at `frameRate`: every `every` frames
 * during each move (so an editor's straight-line interpolation follows the
 * eased path and perspective), and once where each move settles. Views
 * include the move's motion blur.
 */
export function cameraSamples(scene: Scene, frameRate: number, every = 2): CameraSample[] {
  const stage = sceneStage(scene);
  const samples: CameraSample[] = [];
  // A later sample on the same frame (a shot with no hold) replaces the earlier one.
  const add = (sample: CameraSample) => {
    if (samples.at(-1)?.frame === sample.frame) samples.pop();
    samples.push(sample);
  };
  for (const entry of cameraTrack(scene)) {
    const start = Math.round((entry.startMs / 1000) * frameRate);
    const moveFrames = Math.round((entry.moveMs / 1000) * frameRate);
    const at = (f: number) => add({ frame: start + f, view: cameraAt(entry, (f / frameRate) * 1000, stage), shot: entry.index });
    // A whip or zoom jumps halfway: key the frames either side of the jump, so straight-line interpolation never tweens across it.
    const cut = cutsHalfway(entry) ? Math.ceil((entry.moveMs / 2000) * frameRate) : -1;
    for (let f = 0; f < moveFrames; f += every) {
      if (cut > 0 && f < cut && f + every >= cut) {
        at(f);
        if (cut - 1 > f) at(cut - 1);
        at(cut);
        continue;
      }
      at(f);
    }
    add({ frame: start + moveFrames, view: entry.to, shot: entry.index });
  }
  return samples;
}
