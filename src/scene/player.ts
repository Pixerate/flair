import type { Clock } from '../time/clock.js';
import { ManualClock } from '../time/clock.js';
import type { ControlValue } from '../shader/controls.js';
import {
  boardHeight,
  cameraAngle,
  centreOf,
  CAMERA_STEPS,
  DEFAULT_STAGE,
  frame,
  calculateFramingRect,
  isAngled,
  projectPoint,
  viewAt,
  type Stage,
  type View,
} from './camera.js';
import { checkShot } from './check.js';
import { moveView, resolveCameraMove, shotHoldMove, shotInMove } from './moves.js';
import { behaviorProps, type Behavior } from './behavior.js';
import type { Rect, SceneElement } from './geometry.js';
import { isSlot, type LayerRole, type SceneLayer, type SceneSubjects, type ShotTransition, type SlotSubject, type SubjectSlot } from './layers.js';
import { replicateCommands } from './replicator.js';
import { reviewScene, type Review, type ShotLog } from './report.js';
import { layerOpacityAt, layersAt, sceneTimeline, type SceneTimeline, type TimedLayer } from './timeline.js';
import {
  isDeleteCommand,
  isElementCommand,
  isReplicateCommand,
  isUpdateCommand,
  type ElementCommand,
  type Scene,
  type SceneCommand,
  type Shot,
} from './types.js';

/**
 * A layer as the board is asked to show it at a moment: what it is, its
 * subject (a slot filled by `PlayOptions.subjects`, or left as the slot when
 * none were given), its control values (with behaviors' changes), and its
 * opacity then.
 */
export interface ActiveLayer {
  key: string;
  /** The shot it was declared in (0-based). */
  shot: number;
  layer: SceneLayer;
  role: LayerRole;
  subject?: SlotSubject | SubjectSlot;
  values: Record<string, ControlValue>;
  opacity: number;
  /** Ms since it started: the time its effect is drawn at. */
  ms: number;
  startMs: number;
  endMs: number;
}

/** A transition as the board is asked to show it: from the last shot's frame into this one, `progress` of the way. */
export interface ActiveTransition {
  /** The shot it leads into (0-based). */
  shot: number;
  transition: ShotTransition;
  progress: number;
}

export interface SceneBoard {
  getView(): View;
  setView(view: View): void;
  elements(): readonly SceneElement[];
  runCommand(cmd: SceneCommand): void | Promise<void>;
  setTitle?(text: string, opacity: number): void;
  setCaption?(text: string): void;
  /** The layers showing now, bottom of the stack first, and the time on the scene's timeline. Called at every step. */
  setLayers?(layers: readonly ActiveLayer[], ms: number): void;
  /** The transition playing now, or undefined once it is over. */
  setTransition?(transition: ActiveTransition | undefined): void;
}

/** Pure in-memory board implementation suitable for headless simulation, testing, and SSR. */
export class MemorySceneBoard implements SceneBoard {
  private view: View;
  private elMap = new Map<string, SceneElement>();
  private currentTitle = '';
  private currentCaption = '';
  /** The layers last shown, bottom of the stack first. */
  layers: readonly ActiveLayer[] = [];
  /** The transition last shown, while one plays. */
  transition: ActiveTransition | undefined;

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
    if (isReplicateCommand(cmd)) {
      for (const { command } of replicateCommands(cmd)) this.runCommand(command);
    } else if (isElementCommand(cmd)) {
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

  setLayers(layers: readonly ActiveLayer[], _ms?: number): void {
    this.layers = layers;
  }

  setTransition(transition: ActiveTransition | undefined): void {
    this.transition = transition;
  }
}

/** The ids a camera's `frame` or a layer's `ids` name: an element's own id also names the copies a `replicate` command made of it. */
export function namedElements(ids: readonly string[], elements: readonly SceneElement[]): SceneElement[] {
  const wanted = new Set(ids);
  return elements.filter((el) => wanted.has(el.id) || wanted.has(el.id.replace(/_\d+$/, '')));
}

/** What each behavior's target holds before the behaviors run: an element's fields, by target id. */
export function behaviorBase(board: Pick<SceneBoard, 'elements'>, behaviors: readonly Behavior[]): Map<string, Record<string, unknown>> {
  const base = new Map<string, Record<string, unknown>>();
  for (const b of behaviors) {
    const el = board.elements().find((e) => e.id === b.target);
    if (el && !base.has(b.target)) base.set(b.target, { ...el });
  }
  return base;
}

/**
 * Plays behaviors `elapsedMs` into a hold of `holdMs`: elements they target
 * are updated on the board, and what they set on layers (by layer key) is
 * returned.
 */
export function applyBehaviors(
  board: Pick<SceneBoard, 'runCommand'>,
  behaviors: readonly Behavior[],
  elapsedMs: number,
  holdMs: number,
  base: Map<string, Record<string, unknown>>,
  layerValues: ReadonlyMap<string, Record<string, unknown>> = new Map(),
): Map<string, Record<string, number>> {
  const layers = new Map<string, Record<string, number>>();
  for (const b of behaviors) {
    if (!b || typeof b !== 'object' || typeof b.target !== 'string') continue;
    const element = base.get(b.target);
    if (element) {
      board.runCommand({ type: 'update', id: b.target, props: behaviorProps(b, elapsedMs / 1000, holdMs / 1000, element) });
    } else if (layerValues.has(b.target) && b.type !== 'path') {
      layers.set(b.target, { ...layers.get(b.target), ...behaviorProps(b, elapsedMs / 1000, holdMs / 1000, layerValues.get(b.target)!) });
    }
  }
  return layers;
}

/**
 * A timed layer as it shows at `ms`: its subject (a slot filled from
 * `subjects` when they were given), values with behaviors' changes, and opacity.
 */
export function activeLayer(timed: TimedLayer, ms: number, subjects?: SceneSubjects, changed?: Record<string, number>): ActiveLayer {
  const { layer } = timed;
  const given = layer.subject;
  const subject = isSlot(given) && subjects && subjects[given.slot] !== undefined ? subjects[given.slot] : given;
  return {
    key: timed.key,
    shot: timed.shot,
    layer,
    role: timed.role,
    ...(subject !== undefined ? { subject } : {}),
    values: { ...(layer.values ?? {}), ...(changed ?? {}) },
    opacity: layerOpacityAt(timed, ms),
    ms: ms - timed.startMs,
    startMs: timed.startMs,
    endMs: timed.endMs,
  };
}

/** The slots a scene's layers use, with the shot (0-based) each is first used in. */
export function sceneSlots(scene: Scene): Map<string, number> {
  const slots = new Map<string, number>();
  scene.shots.forEach((shot, s) => {
    for (const layer of Array.isArray(shot?.layers) ? shot.layers : []) {
      if (isSlot(layer?.subject) && !slots.has(layer.subject.slot)) slots.set(layer.subject.slot, s);
    }
  });
  return slots;
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
    const targetElements = namedElements(camera.frame, elements);
    if (targetElements.length === 0) {
      const drawn: SceneElement[] = [];
      for (const cmd of shot.run ?? []) {
        if (isElementCommand(cmd)) drawn.push(cmd.element);
        else if (isReplicateCommand(cmd)) drawn.push(...replicateCommands(cmd).map((r) => r.command.element));
      }
      targetElements.push(...namedElements(camera.frame, drawn));
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
  /**
   * What fills the scene's subject slots (`{ "slot": "productShot" }`), by
   * name: `{ productShot: { video: videoEl } }`. When given, a slot left
   * out fails the shot that uses it; when not, layers keep their slots.
   */
  subjects?: SceneSubjects;
}

export interface PlayResult {
  ok: boolean;
  duration: number;
  shots: ShotLog[];
}

/** How often the player steps through a hold or a transition, in ms. */
const STEP_MS = 50;

/**
 * Plays a scene's shots sequentially on `board` driven by `clock`.
 * When using a `ManualClock`, the execution is completely deterministic and stepped.
 * The board is told which layers show (`setLayers`) at every step, and which
 * transition plays (`setTransition`) through a shot's lead-in.
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

  const timeline: SceneTimeline = sceneTimeline(scene);
  const shots: ShotLog[] = [];
  const begin = clock.now();
  let showing: readonly ActiveLayer[] = [];
  /** Control values behaviors have set on layers, by layer key. */
  const changed = new Map<string, Record<string, number>>();
  const missing = new Map<number, string[]>();
  if (options.subjects) {
    for (const [slot, shotIdx] of sceneSlots(scene)) {
      if (options.subjects[slot] === undefined) {
        const given = Object.keys(options.subjects);
        const list = missing.get(shotIdx) ?? [];
        list.push(`No subject was given for the slot "${slot}"; pass subjects: { ${slot}: { image | video | svg | text } }${given.length ? ` (the subjects given fill ${given.map((g) => `"${g}"`).join(', ')})` : ''}.`);
        missing.set(shotIdx, list);
      }
    }
  }

  for (const [idx, shot] of scene.shots.entries()) {
    const shotStart = clock.now() - begin;
    const shotBegan = clock.now();
    const failedCmds: string[] = [...(missing.get(idx) ?? [])];
    const entry = timeline.shots[idx]!;
    const shown = new Set<string>();

    /** Shows the layers for the time since this shot began, on the scene's timeline. */
    const showLayers = () => {
      const ms = Math.min(entry.startMs + (clock.now() - shotBegan), timeline.durationMs - 0.001);
      showing = layersAt(timeline, ms).map((t) => activeLayer(t, ms, options.subjects, changed.get(t.key)));
      for (const l of showing) shown.add(l.key);
      board.setLayers?.(showing, ms);
    };
    showLayers();

    // The lead-in: a move from the catalog into the shot (`camera.in`, a glide by default), and the shot's transition
    const targetView = shotView(shot, board.elements(), stage, board.getView());
    if (shot.camera?.in !== undefined) failedCmds.push(...resolveCameraMove(shot.camera.in, 'transition').issues);
    if (shot.camera?.during !== undefined) failedCmds.push(...resolveCameraMove(shot.camera.during, 'hold', shot.hold ?? 800).issues);
    const move = idx === 0 || !targetView ? undefined : shotInMove(shot);
    const fromView = board.getView();
    // Run commands; copies a `replicate` staggers wait for their time in the hold
    const later: { command: ElementCommand; delayMs: number }[] = [];
    const runCommands = async () => {
      for (const cmd of shot.run ?? []) {
        try {
          if (isReplicateCommand(cmd)) {
            for (const copy of replicateCommands(cmd)) {
              if (copy.delayMs > 0) later.push(copy);
              else await board.runCommand(copy.command);
            }
          } else {
            await board.runCommand(cmd);
          }
        } catch (err: any) {
          failedCmds.push(err.message || String(err));
        }
      }
    };
    const transitionFirst = entry.transitionMs > 0 && !!shot.transition;
    if (transitionFirst) await runCommands();
    if (transitionFirst && shot.transition) {
      const steps = Math.max(1, Math.round(entry.moveMs / STEP_MS));
      const stepMs = entry.moveMs / steps;
      board.setTransition?.({ shot: idx, transition: shot.transition, progress: 0 });
      if (targetView && !(move && move.ms > 0)) board.setView(targetView);
      for (let s = 1; s <= steps; s++) {
        await clock.sleep(stepMs);
        const t = s * stepMs;
        if (targetView && move && move.ms > 0) board.setView(t >= move.ms ? targetView : moveView(move, fromView, targetView, t / move.ms, stage));
        board.setTransition?.(t < entry.transitionMs ? { shot: idx, transition: shot.transition, progress: t / entry.transitionMs } : undefined);
        showLayers();
      }
      board.setTransition?.(undefined);
    } else if (targetView) {
      if (!move || !(move.ms > 0)) {
        board.setView(targetView);
      } else {
        const stepMs = move.ms / CAMERA_STEPS;
        for (let s = 1; s <= CAMERA_STEPS; s++) {
          board.setView(moveView(move, fromView, targetView, s / CAMERA_STEPS, stage));
          await clock.sleep(stepMs);
          showLayers();
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

    // Commands run after the camera's move, or before a transition, so the shot it reveals is drawn
    if (!transitionFirst) await runCommands();

    const drawnTime = clock.now() - begin;

    // Check shot layout & framing
    const check = options.check
      ? checkShot(shot, board.elements(), board.getView(), stage, shot.title)
      : { framing: [], overlaps: [], edges: [], underTitle: [] };

    // Hold: layers, behaviors (paths among them), staggered copies and the camera's move while it holds (`camera.during`)
    const holdMs = shot.hold ?? 800;
    const behaviors = Array.isArray(shot.behaviors) ? shot.behaviors : [];
    const during = targetView ? shotHoldMove(shot) : undefined;
    const settled = board.getView();
    if (behaviors.length > 0 || during || later.length > 0 || timeline.layers.length > 0) {
      const base = behaviorBase(board, behaviors);
      const layerValues = new Map(showing.map((l) => [l.key, l.values as Record<string, unknown>]));
      const steps = Math.max(1, Math.round(holdMs / STEP_MS));
      const actualStepMs = holdMs / steps;

      for (let s = 1; s <= steps; s++) {
        await clock.sleep(actualStepMs);
        const elapsed = s * actualStepMs;
        while (later.length && later[0]!.delayMs <= elapsed) await board.runCommand(later.shift()!.command);
        if (during) board.setView(moveView(during, settled, settled, s / steps, stage));
        if (behaviors.length) {
          for (const [key, values] of applyBehaviors(board, behaviors, elapsed, holdMs, base, layerValues)) changed.set(key, values);
        }
        showLayers();
      }
      for (const copy of later) await board.runCommand(copy.command);
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
      layers: timeline.layers.filter((l) => shown.has(l.key)).map((l) => l.key),
    };

    shots.push(log);
    if (options.afterShot) {
      await options.afterShot(log);
    }
  }

  board.setLayers?.([], timeline.durationMs);
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
