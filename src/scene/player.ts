import type { Clock } from '../time/clock.js';
import { ManualClock } from '../time/clock.js';
import {
  between,
  boardHeight,
  cameraAngle,
  centreOf,
  CAMERA_MS,
  DEFAULT_STAGE,
  easeInOutCubic,
  frame,
  calculateFramingRect,
  isAngled,
  motionBlur,
  projectPoint,
  viewAt,
  type Stage,
  type View,
} from './camera.js';
import { checkShot } from './check.js';
import { effectGone, type RunningEffect } from './effects.js';
import { evaluateBehavior } from './behavior.js';
import type { Rect, SceneElement } from './geometry.js';
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

/**
 * The view a shot's camera moves to: its framing (a box, or the elements it
 * frames, from the board or the shot's own commands) at its angle, zoomed
 * out when angled so the framed box still fits. Framing
 * or angle parts the camera leaves out keep `current`'s. Undefined when the
 * shot has no camera.
 */
export function shotView(
  shot: Shot,
  elements: readonly SceneElement[],
  stage: Stage,
  current: View,
): View | undefined {
  const camera = shot.camera;
  if (!camera) return undefined;
  let view: View = { zoom: current.zoom, scrollX: current.scrollX, scrollY: current.scrollY };
  let framed: Rect | undefined;
  if ('frame' in camera) {
    const frameIds = new Set(camera.frame);
    const targetElements = elements.filter((el) => frameIds.has(el.id));
    if (targetElements.length === 0) {
      for (const cmd of shot.run ?? []) {
        if (isElementCommand(cmd) && frameIds.has(cmd.element.id)) targetElements.push(cmd.element);
      }
    }
    framed = calculateFramingRect(targetElements, stage, {
      padding: camera.padding,
      minWidth: camera.minWidth,
      minHeight: camera.minHeight,
    });
  } else if ('width' in camera) {
    framed = camera as Rect;
  }
  if (framed) view = frame(framed, stage);
  const angle = cameraAngle({
    tilt: camera.tilt ?? current.tilt,
    turn: camera.turn ?? current.turn,
    roll: camera.roll ?? current.roll,
    perspective: camera.perspective ?? current.perspective,
  });
  const angled: View = { ...view, ...angle };
  return framed && isAngled(angled) ? fitAngled(angled, framed, stage) : angled;
}

/**
 * An angled view zoomed out (round the same centre) until the framed box,
 * turned and in perspective, fits the board again: perspective makes the
 * near side bigger, so a flat framing would cut it.
 */
function fitAngled(view: View, box: Rect, stage: Stage): View {
  const [cx, cy] = centreOf(view, stage);
  const halfW = stage.width / 2;
  const halfH = boardHeight(stage) / 2;
  let fitted = view;
  for (let i = 0; i < 4; i++) {
    let spread = 0;
    for (const corner of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]] as const) {
      const p = projectPoint(fitted, stage, corner);
      spread = p ? Math.max(spread, Math.abs(p[0] - halfW) / halfW, Math.abs(p[1] - halfH) / halfH) : Infinity;
      if (!p) break;
    }
    if (spread <= 1.001) break;
    const zoom = fitted.zoom / (Number.isFinite(spread) ? spread : 2);
    fitted = { ...fitted, ...viewAt(cx, cy, zoom, stage) };
  }
  return fitted;
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
    const targetView = shotView(shot, board.elements(), stage, board.getView());
    if (targetView) {
      if (idx === 0) {
        board.setView(targetView);
      } else {
        const fromView = board.getView();
        const strength = shot.camera?.motionBlur ?? 0;
        const steps = 15;
        const stepMs = CAMERA_MS / steps;
        let last = fromView;
        for (let s = 1; s <= steps; s++) {
          const t = easeInOutCubic(s / steps);
          const view = between(fromView, targetView, t, stage);
          const blur = s < steps ? motionBlur(last, view, stage, strength) : 0;
          board.setView(blur > 0 ? { ...view, blur } : view);
          last = view;
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

    // Hold dwell time and active behaviors
    const holdMs = shot.hold ?? 800;
    const behaviors = shot.behaviors ?? [];
    if (behaviors.length > 0) {
      const initialProps = new Map<string, number>();
      for (const b of behaviors) {
        const key = `${b.target}:${b.property}`;
        const el = board.elements().find((e) => e.id === b.target);
        if (el && typeof (el as any)[b.property] === 'number') {
          initialProps.set(key, (el as any)[b.property]);
        } else {
          initialProps.set(key, 0);
        }
      }

      const stepMs = 50;
      const steps = Math.max(1, Math.round(holdMs / stepMs));
      const actualStepMs = holdMs / steps;
      const durationSec = holdMs / 1000;

      for (let s = 1; s <= steps; s++) {
        await clock.sleep(actualStepMs);
        const elapsedSec = (s * actualStepMs) / 1000;
        for (const b of behaviors) {
          const baseVal = initialProps.get(`${b.target}:${b.property}`) ?? 0;
          const nextVal = evaluateBehavior(b, elapsedSec, durationSec, baseVal);
          board.runCommand({
            type: 'update',
            id: b.target,
            props: { [b.property]: nextVal },
          });
        }
      }
    } else {
      await clock.sleep(holdMs);
    }

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
