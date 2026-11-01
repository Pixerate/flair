/**
 * Scenes in the browser: played in a page (`mountScene`) and recorded to a
 * file (`recordScene`), drawn by a {@link SceneCompositor}.
 */

import { scenePlan, type ScenePlan } from "../scene/plan.js";
import type { SceneSubject } from "../scene/layers.js";
import type { Scene } from "../scene/types.js";
import { parseColor } from "../shader/controls.js";
import { checkShutter, type ShutterOptions } from "../export/shutter.js";
import { SceneCompositor, type SceneCompositorOptions, type SceneSlotSubjects } from "./compositor.js";
import { encodeFrames, negotiateOutput, type FrameSource, type OutputPlan, type RecordOptions } from "./record.js";

export { SceneCompositor, shotIndexAt, type SceneCompositorOptions, type SceneSlotSubjects } from "./compositor.js";

/** The JSON-only subjects (for the plan) from subjects that may hold live sources (for the compositor). */
function writtenSubjects(subjects: SceneSlotSubjects | undefined): Record<string, SceneSubject> | undefined {
  if (!subjects) return undefined;
  return Object.fromEntries(Object.entries(subjects).filter(([, s]) => !("video" in s) || typeof s.video === "string")) as Record<string, SceneSubject>;
}

/** A plan from a scene, or the plan itself. */
async function planOf(scene: Scene | ScenePlan, subjects?: SceneSlotSubjects): Promise<ScenePlan> {
  if ((scene as ScenePlan).version !== undefined && Array.isArray((scene as ScenePlan).layers)) return scene as ScenePlan;
  const given = writtenSubjects(subjects);
  return scenePlan(scene as Scene, given ? { subjects: given } : {});
}

/** How {@link recordScene} records: like `recordEffect`, with the scene's slots filled by `subjects`. */
export interface SceneRecordOptions extends ShutterOptions, Pick<RecordOptions, "format" | "fps" | "bitrate" | "alpha" | "background" | "onProgress" | "signal"> {
  /** What fills the scene's slots: `{ productShot: { video: videoEl } }`. */
  subjects?: SceneSlotSubjects;
  /** Pixels (default the scene's stage, rounded up to even numbers for videos). */
  width?: number;
  height?: number;
  /** Seconds to record (default the whole scene). */
  duration?: number;
  /** The time of the first frame, in seconds (default 0). */
  start?: number;
  /** Draw the shots' titles and captions (default true). */
  words?: boolean;
}

/** What {@link recordScene} will make, worked out before a frame is drawn. */
export interface SceneRecordingPlan extends OutputPlan {
  plan: ScenePlan;
}

/**
 * What {@link recordScene} would make of a scene (or its plan) with these
 * options, without drawing a frame. Rejects with a sentence when an option
 * is out of range or the browser cannot make the format.
 */
export async function sceneRecordingPlan(scene: Scene | ScenePlan, options: SceneRecordOptions = {}): Promise<SceneRecordingPlan> {
  const plan = await planOf(scene, options.subjects);
  const fps = options.fps ?? 30;
  if (!(fps > 0)) throw new Error(`fps must be a number above 0 (it was ${String(options.fps)}).`);
  const start = options.start ?? 0;
  if (!(start >= 0)) throw new Error(`start must be 0 or more seconds (it was ${String(options.start)}).`);
  const duration = options.duration ?? Math.max(0.001, plan.durationMs / 1000 - start);
  if (!(duration > 0)) throw new Error(`duration must be a number above 0 (it was ${String(options.duration)}).`);
  const shutter = checkShutter(options);
  const output = await negotiateOutput({ ...options, width: options.width ?? plan.stage.width, height: options.height ?? plan.stage.height }, fps, false);
  return { plan, ...output, fps, duration, start, frames: Math.max(1, Math.round(duration * fps)), ...(shutter ? { shutter } : {}) };
}

/**
 * Records a scene to a file in the browser, as `recordEffect` records an
 * effect: an `mp4` or `webm` video, an animated `gif`, or `png` frames in a
 * ZIP. Frame `i` is the scene at `start + i / fps`, drawn by a
 * {@link SceneCompositor} with its layers, transitions, camera and words;
 * videos are sought to each frame. Slots are filled from `subjects`.
 *
 * ```ts
 * const mp4 = await recordScene(scene, { subjects: { productShot: { video: videoEl } } });
 * const gif = await recordScene(scene, { format: "gif", width: 640, height: 360, fps: 20 });
 * ```
 */
export async function recordScene(scene: Scene | ScenePlan, options: SceneRecordOptions = {}): Promise<Blob> {
  const rec = await sceneRecordingPlan(scene, options);
  const compositor = new SceneCompositor(rec.plan, { width: rec.width, height: rec.height, exact: true, ...(options.subjects ? { subjects: options.subjects } : {}), ...(options.words !== undefined ? { words: options.words } : {}), ...(options.background ? { background: options.background } : {}) });
  const source: FrameSource = {
    async frame(time, _i, out) {
      await compositor.draw(time * 1000);
      out.set(compositor.canvas.getContext("2d")!.getImageData(0, 0, rec.width, rec.height).data);
    },
    dispose: () => compositor.dispose(),
  };
  const background = (parseColor(options.background ?? "#000000") ?? [0, 0, 0]).map((c) => Math.round(c * 255)) as [number, number, number];
  try {
    await compositor.ready();
  } catch (e) {
    compositor.dispose();
    throw e;
  }
  return encodeFrames(rec, source, background, options);
}

/** A scene playing in a page (see {@link mountScene}). */
export interface MountedScene {
  readonly compositor: SceneCompositor;
  readonly plan: ScenePlan;
  /** Where it is, in ms on the scene's timeline. */
  readonly time: number;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  /** Shows the scene at `ms` (and plays on from there when playing). */
  seek(ms: number): Promise<void>;
  /** Called after each frame drawn, with its time. */
  onFrame?: (ms: number) => void;
  /** Stops it and takes its canvas out of the page. */
  dispose(): void;
}

export interface MountSceneOptions extends Omit<SceneCompositorOptions, "canvas" | "exact"> {
  /** Start playing at once (default true). */
  autoplay?: boolean;
  /** Start again at the end (default false: rest on the last frame). */
  loop?: boolean;
}

/**
 * Plays a scene (or its plan) in `host`: a canvas filling it, drawn by a
 * {@link SceneCompositor} on the page's clock, with the scene's slots
 * filled from `subjects` (a live `<video>` among them). Resolves once its
 * shaders are compiled and pictures loaded.
 *
 * ```ts
 * const player = await mountScene(el, scene, { subjects: { productShot: { video: videoEl } } });
 * player.pause(); await player.seek(2000);
 * ```
 */
export async function mountScene(host: HTMLElement, scene: Scene | ScenePlan, options: MountSceneOptions = {}): Promise<MountedScene> {
  const plan = await planOf(scene, options.subjects);
  const compositor = new SceneCompositor(plan, { ...options, exact: false });
  compositor.canvas.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;";
  host.appendChild(compositor.canvas);
  await compositor.ready();
  let time = 0;
  let playing = false;
  let from = 0;
  let frame = 0;
  let drawing = false;
  const tick = async () => {
    frame = 0;
    if (!playing || drawing) return;
    drawing = true;
    time = performance.now() - from;
    if (time >= plan.durationMs) {
      if (options.loop) {
        from = performance.now();
        time = 0;
      } else {
        time = Math.max(0, plan.durationMs - 1);
        playing = false;
      }
    }
    await compositor.draw(time);
    drawing = false;
    mounted.onFrame?.(time);
    if (playing) frame = requestAnimationFrame(tick);
  };
  const mounted: MountedScene = {
    compositor,
    plan,
    get time() {
      return time;
    },
    get playing() {
      return playing;
    },
    play() {
      if (playing) return;
      if (time >= plan.durationMs - 1) time = 0;
      playing = true;
      from = performance.now() - time;
      frame = requestAnimationFrame(tick);
    },
    pause() {
      playing = false;
      if (frame) cancelAnimationFrame(frame);
    },
    async seek(ms: number) {
      time = Math.min(Math.max(0, ms), Math.max(0, plan.durationMs - 1));
      from = performance.now() - time;
      if (!playing) {
        await compositor.draw(time);
        mounted.onFrame?.(time);
      }
    },
    dispose() {
      mounted.pause();
      compositor.dispose();
      compositor.canvas.remove();
    },
  };
  await compositor.draw(0);
  if (options.autoplay !== false) mounted.play();
  return mounted;
}
