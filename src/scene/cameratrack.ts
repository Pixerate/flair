import { between, CAMERA_MS, DEFAULT_STAGE, easeInOutCubic, moveBlur, viewAt, type Stage, type View } from './camera.js';
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
  /** The shot's `camera.motionBlur` (0 for none). */
  motionBlur: number;
  /** The elements on stage once the shot's commands have run. */
  elements: SceneElement[];
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
    const moveMs = index > 0 && shot.camera ? CAMERA_MS : 0;
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
      motionBlur: shot.camera?.motionBlur ?? 0,
      elements: board.elements().map((e) => ({ ...e })),
    };
    view = to;
    startMs += moveMs + holdMs;
    return entry;
  });
}

/** The time the player waits between steps of a camera move, in ms (its blur is measured over one). */
export const CAMERA_STEP_MS = CAMERA_MS / 15;

/**
 * The camera `ms` into a shot: part-way through its move (eased, with its
 * motion blur) or settled.
 */
export function cameraAt(entry: CameraShot, ms: number, stage: Stage): View {
  if (!(entry.moveMs > 0) || ms >= entry.moveMs) return entry.to;
  const u = Math.max(0, ms) / entry.moveMs;
  const view = between(entry.from, entry.to, easeInOutCubic(u), stage);
  if (!(entry.motionBlur > 0)) return view;
  const before = between(entry.from, entry.to, easeInOutCubic(Math.max(0, u - CAMERA_STEP_MS / entry.moveMs)), stage);
  return { ...view, ...moveBlur(before, view, stage, entry.motionBlur) };
}

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
    for (let f = 0; f < moveFrames; f += every) {
      add({ frame: start + f, view: cameraAt(entry, (f / frameRate) * 1000, stage), shot: entry.index });
    }
    add({ frame: start + moveFrames, view: entry.to, shot: entry.index });
  }
  return samples;
}
