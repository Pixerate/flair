import type { Clock } from '../time/clock.js';
import { ManualClock } from '../time/clock.js';
import {
  between,
  CAMERA_MS,
  DEFAULT_STAGE,
  easeInOutCubic,
  frame,
  viewAt,
  type Stage,
  type View,
} from './camera.js';
import { checkShot } from './check.js';
import { effectGone, type RunningEffect } from './effects.js';
import type { SceneElement } from './geometry.js';
import { reviewScene, type Review, type ShotLog } from './report.js';
import {
  isDeleteCommand,
  isElementCommand,
  isUpdateCommand,
  type Scene,
  type SceneCommand,
  type Shot,
} from './types.js';

export interface SceneBoard {
  getView(): View;
  setView(view: View): void;
  elements(): readonly SceneElement[];
  runCommand(cmd: SceneCommand): void | Promise<void>;
  setTitle?(text: string, opacity: number): void;
  setCaption?(text: string): void;
  setEffects?(effects: readonly RunningEffect[]): void;
  setMediaTime?(mediaId: string, timeSeconds: number): void;
}

/** Pure in-memory board implementation suitable for headless simulation, testing, and SSR. */
export class MemorySceneBoard implements SceneBoard {
  private view: View;
  private elMap = new Map<string, SceneElement>();
  private currentTitle = '';
  private currentCaption = '';
  private runningEffects: readonly RunningEffect[] = [];

  constructor(stage: Stage = DEFAULT_STAGE) {
    this.view = viewAt(stage.width / 2, stage.height / 2, 1, stage);
  }

  getView(): View {
    return this.view;
  }

  setView(view: View): void {
    this.view = view;
  }

  elements(): readonly SceneElement[] {
    return Array.from(this.elMap.values());
  }

  runCommand(cmd: SceneCommand): void {
    if (isElementCommand(cmd)) {
      this.elMap.set(cmd.element.id, { ...cmd.element });
    } else if (isUpdateCommand(cmd)) {
      const existing = this.elMap.get(cmd.id);
      if (existing) {
        this.elMap.set(cmd.id, { ...existing, ...cmd.props });
      }
    } else if (isDeleteCommand(cmd)) {
      this.elMap.delete(cmd.id);
    } else if (cmd.type === 'clear') {
      this.elMap.clear();
    }
  }

  setTitle(text: string): void {
    this.currentTitle = text;
  }

  setCaption(text: string): void {
    this.currentCaption = text;
  }

  setEffects(effects: readonly RunningEffect[]): void {
    this.runningEffects = effects;
  }
}

export interface PlayOptions {
  check?: boolean;
  afterShot?: (log: ShotLog) => void | Promise<void>;
}

export interface PlayResult {
  ok: boolean;
  duration: number;
  shots: ShotLog[];
}

/**
 * Plays a scene's shots sequentially on `board` driven by `clock`.
 * When using a `ManualClock`, the execution is completely deterministic and stepped.
 */
export async function playScene(
  scene: Scene,
  board: SceneBoard,
  clock: Clock,
  options: PlayOptions = {},
): Promise<PlayResult> {
  const stage: Stage = {
    width: scene.stage?.width ?? DEFAULT_STAGE.width,
    height: scene.stage?.height ?? DEFAULT_STAGE.height,
    caption: scene.stage?.caption ?? DEFAULT_STAGE.caption,
  };

  const shots: ShotLog[] = [];
  const begin = clock.now();
  let runningEffects: RunningEffect[] = [];
  const endsAt = new Map<RunningEffect, number>();

  const updateEffects = (next: RunningEffect[]) => {
    runningEffects = next.filter((r) => !effectGone(r, clock.now()));
    board.setEffects?.(runningEffects);
  };

  for (const [idx, shot] of scene.shots.entries()) {
    const shotStart = clock.now() - begin;
    const failedCmds: string[] = [];

    // Stop requested effects
    const stopIds = new Set(shot.stopEffects ?? []);
    if (stopIds.size > 0 || runningEffects.some((r) => endsAt.get(r) === idx)) {
      const now = clock.now();
      updateEffects(
        runningEffects.map((r) =>
          r.until === undefined && (stopIds.has(r.effect.id) || endsAt.get(r) === idx)
            ? { ...r, until: now }
            : r,
        ),
      );
    }

    // Camera move
    if (shot.camera) {
      const targetView = frame(shot.camera, stage);
      if (idx === 0) {
        board.setView(targetView);
      } else {
        const fromView = board.getView();
        const steps = 15;
        const stepMs = CAMERA_MS / steps;
        for (let s = 1; s <= steps; s++) {
          const t = easeInOutCubic(s / steps);
          board.setView(between(fromView, targetView, t, stage));
          await clock.sleep(stepMs);
        }
      }
    }

    // Set title and caption
    if (shot.title !== undefined) {
      board.setTitle?.(shot.title, 1);
    }
    if (shot.caption !== undefined) {
      board.setCaption?.(shot.caption);
    }

    // Start effects scheduled at 'start'
    const startEffects = (shot.effects ?? []).filter((e) => e.at === 'start');
    if (startEffects.length > 0) {
      const now = clock.now();
      const added = startEffects.map((effect): RunningEffect => ({ effect, from: now }));
      for (const r of added) if (r.effect.shots) endsAt.set(r, idx + r.effect.shots);
      updateEffects([...runningEffects, ...added]);
    }

    // Run commands
    for (const cmd of shot.run ?? []) {
      try {
        await board.runCommand(cmd);
      } catch (err: any) {
        failedCmds.push(err.message || String(err));
      }
    }

    // Start effects scheduled after 'drawn' (default)
    const drawnEffects = (shot.effects ?? []).filter((e) => e.at !== 'start');
    if (drawnEffects.length > 0) {
      const now = clock.now();
      const added = drawnEffects.map((effect): RunningEffect => ({ effect, from: now }));
      for (const r of added) if (r.effect.shots) endsAt.set(r, idx + r.effect.shots);
      updateEffects([...runningEffects, ...added]);
    }

    const drawnTime = clock.now() - begin;

    // Check shot layout & framing
    const check = options.check
      ? checkShot(shot, board.elements(), board.getView(), stage, shot.title)
      : { framing: [], overlaps: [], edges: [], underTitle: [] };

    // Hold dwell time
    const holdMs = shot.hold ?? 800;
    await clock.sleep(holdMs);

    const shotEnd = clock.now() - begin;

    const log: ShotLog = {
      ...check,
      index: idx + 1,
      start: shotStart,
      drawn: drawnTime,
      end: shotEnd,
      caption: shot.caption,
      title: shot.title,
      failed: failedCmds,
      effects: runningEffects.map((r) => r.effect.id),
    };

    shots.push(log);
    if (options.afterShot) {
      await options.afterShot(log);
    }
  }

  const duration = clock.now() - begin;
  const ok = shots.every((s) => s.failed.length === 0 && s.framing.every((f) => f.how !== 'outside'));

  return { ok, duration, shots };
}

/**
 * Simulates a scene instantaneously using a ManualClock and MemorySceneBoard,
 * returning full timing details, layout checks, and diagnostic report.
 */
export async function simulateScene(
  scene: Scene,
  options: { minTextPx?: number } = {},
): Promise<{ result: PlayResult; review: Review }> {
  const clock = new ManualClock();
  const board = new MemorySceneBoard();

  let done = false;
  let playError: any = null;
  const playPromise = playScene(scene, board, clock, { check: true })
    .then((res) => {
      done = true;
      return res;
    })
    .catch((err) => {
      done = true;
      playError = err;
      throw err;
    });

  // Advance manual clock until simulation finishes
  for (let i = 0; i < 5000 && !done; i++) {
    await clock.advance(50);
  }

  if (playError) throw playError;
  const result = await playPromise;
  const review = reviewScene(scene, result.shots, {
    target: scene.target,
    minTextPx: options.minTextPx,
  });

  return { result, review };
}
