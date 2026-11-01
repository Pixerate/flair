import { CAMERA_STEPS, DEFAULT_STAGE, viewAt, type Stage, type View } from './camera.js';
import type { SceneElement } from './geometry.js';
import { moveView, shotHoldMove, shotInMove, type ShotMove } from './moves.js';
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
  /** The camera move it gets into the shot with (`camera.in`, a glide by default), when it moves. */
  move?: ShotMove;
  /** The camera move it makes while the shot holds (`camera.during`), when it has one. */
  during?: ShotMove;
  /** Where the camera is at the end of the shot: `to`, or where the hold's move ends. */
  end: View;
  /** The elements on stage once the shot's commands have run. */
  elements: SceneElement[];
}

/** How long the camera moves at the start of a shot, in ms: none for the first shot or a shot without a camera, else its move's length (0 for a cut). */
export function shotMoveMs(shot: Shot, index: number): number {
  return index > 0 ? (shotInMove(shot)?.ms ?? 0) : 0;
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
 * each shot's move (framing, angle and camera moves) and hold.
 */
export function cameraTrack(scene: Scene): CameraShot[] {
  const stage = sceneStage(scene);
  const board = new MemorySceneBoard(stage);
  let view: View = viewAt(stage.width / 2, (stage.height - (stage.caption ?? 0)) / 2, 1, stage);
  let startMs = 0;
  return scene.shots.map((shot, index) => {
    const target = shotView(shot, board.elements(), stage, view);
    const moveMs = shotMoveMs(shot, index);
    const from = index === 0 && target ? target : view;
    const to = target ?? view;
    const holdMs = shot.hold ?? 800;
    const move = index > 0 ? shotInMove(shot) : undefined;
    const during = shotHoldMove(shot);
    for (const cmd of shot.run ?? []) board.runCommand(cmd);
    const end = during ? moveView(during, to, to, 1, stage) : to;
    const entry: CameraShot = {
      shot,
      index,
      startMs,
      moveMs,
      holdMs,
      from,
      to,
      ...(move ? { move } : {}),
      ...(during ? { during } : {}),
      end: stripBlur(end),
      elements: board.elements().map((e) => ({ ...e })),
    };
    view = entry.end;
    startMs += moveMs + holdMs;
    return entry;
  });
}

/** A view without its motion blur: where the camera is, for the next move to start from. */
function stripBlur(view: View): View {
  const { blur: _blur, blurAngle: _angle, ...still } = view;
  return still;
}

/** The time the player waits between steps of a default-length camera move, in ms (its blur is measured over one). */
export const CAMERA_STEP_MS = 600 / CAMERA_STEPS;

/**
 * The camera `ms` into a shot: part-way through its move into the shot
 * (with its motion blur), then through the move it makes while it holds,
 * or settled.
 */
export function cameraAt(entry: CameraShot, ms: number, stage: Stage): View {
  if (entry.move && entry.moveMs > 0 && ms < entry.moveMs) return moveView(entry.move, entry.from, entry.to, Math.max(0, ms) / entry.moveMs, stage);
  if (entry.during) return moveView(entry.during, entry.to, entry.to, entry.holdMs > 0 ? Math.min(1, (ms - entry.moveMs) / entry.holdMs) : 1, stage);
  return entry.to;
}

/** Where the shot's move jumps from one framing to the other (0 to 1 through it, for a whip or punch), or undefined when it moves smoothly. */
export const moveCut = (entry: CameraShot): number | undefined => (entry.moveMs > 0 ? entry.move?.move.motion.cut : undefined);

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
 * eased path and perspective), once where each move settles, and through
 * each hold that has a move of its own. Views include the moves' motion blur.
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
    // A whip or punch jumps part-way: key the frames either side of the jump, so straight-line interpolation never tweens across it.
    const jump = moveCut(entry);
    const cut = jump !== undefined ? Math.ceil(((entry.moveMs * jump) / 1000) * frameRate) : -1;
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
    // A move while the shot holds is sampled through the hold too.
    if (entry.during) {
      const holdFrames = Math.round(((entry.moveMs + entry.holdMs) / 1000) * frameRate) - moveFrames;
      for (let f = every; f < holdFrames; f += every) at(moveFrames + f);
      if (holdFrames > 0) at(moveFrames + holdFrames);
    }
  }
  return samples;
}
