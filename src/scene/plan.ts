import { controlValue, parseControls, type ControlDef, type ControlValue } from '../shader/controls.js';
import { ManualClock } from '../time/clock.js';
import { cameraSamples, sceneStage } from './cameratrack.js';
import type { SceneElement } from './geometry.js';
import { isSlot, subjectKind, TRANSITION_CONTROLS, type SceneSubject, type SubjectSlot } from './layers.js';
import { MemorySceneBoard, playScene, type ActiveLayer } from './player.js';
import { SCENE_PLAN_VERSION, type PlanDraw, type PlanLayer, type PlanPlacement, type PlanShot, type PlanTransition, type ScenePlan } from './plan-types.js';
import { sceneTimeline } from './timeline.js';
import type { Scene } from './types.js';

export * from './plan-types.js';

export interface ScenePlanOptions {
  /** Subjects for the scene's slots, written as the scene would (a live `<video>` is given to the player instead). */
  subjects?: Record<string, SceneSubject>;
  /** The rate the camera is keyed at (default 30). */
  fps?: number;
}

/** Records the elements' and layers' state at every step `playScene` takes. */
class RecordingBoard extends MemorySceneBoard {
  readonly elementKeys = new Map<string, { ms: number; element: SceneElement | null }[]>();
  readonly layerTracks = new Map<string, { ms: number; values: Record<string, number> }[]>();
  private last = new Map<string, string>();

  setLayers(layers: readonly ActiveLayer[], ms: number): void {
    super.setLayers(layers);
    const now = new Map(this.elements().map((e) => [e.id, e]));
    for (const id of new Set([...this.last.keys(), ...now.keys()])) {
      const el = now.get(id);
      const json = el ? JSON.stringify(el) : 'null';
      if (this.last.get(id) === json || (!el && !this.last.has(id))) continue;
      const keys = this.elementKeys.get(id) ?? [];
      keys.push({ ms, element: el ? { ...el } : null });
      this.elementKeys.set(id, keys);
      if (el) this.last.set(id, json);
      else this.last.delete(id);
    }
    for (const layer of layers) {
      const changed = Object.fromEntries(Object.entries(layer.values).filter(([k, v]) => typeof v === 'number' && layer.layer.values?.[k] !== v)) as Record<string, number>;
      if (!Object.keys(changed).length) continue;
      const track = this.layerTracks.get(layer.key) ?? [];
      if (JSON.stringify(track.at(-1)?.values) !== JSON.stringify(changed)) track.push({ ms, values: changed });
      this.layerTracks.set(layer.key, track);
    }
  }
}

type Lazy = typeof import('../catalog/lazy.js');
type Meta = NonNullable<ReturnType<Lazy['getEffectMeta']>>;

/** The image control a subject goes in, as `subjectValues` picks it: a picture or SVG in the first image control, a video in a picture control, words in a mask or text one. */
function imageControlFor(meta: Pick<Meta, 'inputs'>, kind: string): string | undefined {
  const images = meta.inputs.images;
  const slot = kind === 'text' ? images.find((x) => x.wants !== 'picture') : kind === 'video' ? images.find((x) => x.wants === 'picture') : images[0];
  return slot?.name;
}

/** Every control's value from a preset and given values over the defaults. */
function resolved(controls: readonly ControlDef[], preset: Record<string, ControlValue> | undefined, values: Record<string, ControlValue> | undefined, leaveOut: readonly string[]) {
  const merged = { ...preset, ...values };
  return Object.fromEntries(controls.filter((c) => !leaveOut.includes(c.name)).map((c) => [c.name, controlValue(c, merged)]));
}

/**
 * Works out a scene's {@link ScenePlan}: plays it on a manual clock to key
 * its elements and behaviors, keys its camera at `fps`, and loads the
 * catalog effects its layers and transitions use (on demand, from the lazy
 * catalog), resolving their presets and values.
 */
export async function scenePlan(scene: Scene, options: ScenePlanOptions = {}): Promise<ScenePlan> {
  const fps = options.fps ?? 30;
  const stage = sceneStage(scene);
  const timeline = sceneTimeline(scene);
  const notes: string[] = [];

  // Play it to see where everything is at each step.
  const board = new RecordingBoard(stage);
  const clock = new ManualClock();
  let done = false;
  const played = playScene(scene, board, clock, options.subjects ? { subjects: options.subjects } : {}).finally(() => (done = true));
  for (let i = 0; i < 100000 && !done; i++) await clock.advance(50);
  await played;

  const ids = new Set<string>();
  for (const t of timeline.layers) if (typeof t.layer.effect === 'string') ids.add(t.layer.effect);
  for (const t of timeline.transitions) ids.add(t.transition.effect);
  const lazy: Lazy | undefined = ids.size ? await import('../catalog/lazy.js') : undefined;
  const effects = new Map<string, { meta: Meta; def: import('../catalog/types.js').EffectDefinition }>();
  for (const id of ids) {
    const meta = lazy!.getEffectMeta(id);
    if (!meta || meta.kind === 'camera') {
      notes.push(`There is no catalog effect "${id}" for a layer; it is left out.`);
      continue;
    }
    effects.set(id, { meta, def: await lazy!.loadEffect(id) });
  }
  const { renderVectorEffect } = await import('../catalog/types.js');
  const presetOf = (def: { presets?: readonly { name: string; values: Record<string, ControlValue> }[] }, name: unknown) =>
    typeof name === 'string' ? def.presets?.find((p) => p.name === name)?.values : undefined;

  const fill = (subject: unknown): SceneSubject | SubjectSlot | undefined => {
    if (isSlot(subject)) return options.subjects?.[subject.slot] ?? subject;
    return subject as SceneSubject | undefined;
  };

  const layers: PlanLayer[] = [];
  for (const t of timeline.layers) {
    const { layer } = t;
    const subject = fill(layer.subject);
    const kind = subject && !isSlot(subject) ? subjectKind(subject) : undefined;
    let draw: PlanDraw | undefined;
    if (typeof layer.source === 'string') {
      const controls = parseControls(layer.source);
      const images = controls.filter((c) => c.type === 'sampler2D');
      const subjectControl = subject ? images[0]?.name : undefined;
      draw = { kind: 'shader', source: layer.source, values: resolved(controls, undefined, layer.values, subjectControl ? [subjectControl] : []), transparent: false, ...(subjectControl ? { subjectControl } : {}) };
    } else if (typeof layer.effect === 'string') {
      const found = effects.get(layer.effect);
      if (!found) continue;
      const { meta, def } = found;
      if (def.kind === 'shader') {
        const subjectControl = subject ? imageControlFor(meta, kind ?? 'image') : undefined;
        draw = {
          kind: 'shader',
          effect: def.id,
          source: def.source,
          values: resolved(meta.controls, presetOf(def, layer.preset), layer.values, subjectControl ? [subjectControl] : []),
          transparent: !!def.transparent,
          ...(subjectControl ? { subjectControl } : {}),
        };
      } else if (def.kind === 'vector') {
        const values = resolved(meta.controls, presetOf(def, layer.preset), layer.values, []);
        if (kind === 'text') {
          const copy = meta.inputs.texts.find((x) => x.holds === 'copy');
          if (copy) values[copy.name] = (subject as { text: string }).text;
        } else if (isSlot(subject)) notes.push(`Layer "${t.key}" takes its words from the slot "${subject.slot}", which was not filled when the plan was made; it shows its default words.`);
        draw = { kind: 'vector', effect: def.id, motion: renderVectorEffect(def, values), holdMs: def.hold ?? 600 };
      }
    } else {
      draw = { kind: 'picture' };
    }
    if (!draw) continue;
    if (isSlot(subject)) notes.push(`Layer "${t.key}" shows the slot "${subject.slot}", which the player fills (it was not given when the plan was made).`);
    const place: PlanPlacement = layer.rect ? { rect: { ...layer.rect } } : layer.ids ? { ids: [...layer.ids], padding: layer.padding ?? 0 } : { screen: true };
    const tracks = board.layerTracks.get(t.key);
    layers.push({
      key: t.key,
      shot: t.shot,
      role: t.role,
      startMs: t.startMs,
      endMs: t.endMs,
      opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
      fade: typeof layer.fade === 'number' ? layer.fade : 0,
      place,
      draw,
      ...(subject !== undefined ? { subject } : {}),
      ...(tracks?.length ? { tracks } : {}),
    });
  }

  const transitions: PlanTransition[] = [];
  for (const t of timeline.transitions) {
    const found = effects.get(t.transition.effect);
    if (!found || found.def.kind !== 'shader') continue;
    const { meta, def } = found;
    const values = resolved(meta.controls, presetOf(def, t.transition.preset), t.transition.values, [TRANSITION_CONTROLS.from, TRANSITION_CONTROLS.to]);
    values[TRANSITION_CONTROLS.animate] = false;
    transitions.push({
      shot: t.shot,
      startMs: t.startMs,
      ms: t.ms,
      draw: { kind: 'shader', effect: def.id, source: def.source, values, transparent: !!def.transparent },
      controls: TRANSITION_CONTROLS,
    });
  }

  let title: string | undefined;
  let caption: string | undefined;
  const shots = timeline.shots.map((entry): PlanShot => {
    title = entry.shot.title ?? title;
    caption = entry.shot.caption ?? caption;
    return { index: entry.index, startMs: entry.startMs, moveMs: entry.moveMs, holdMs: entry.holdMs, ...(title !== undefined ? { title } : {}), ...(caption !== undefined ? { caption } : {}) };
  });

  return {
    version: SCENE_PLAN_VERSION,
    name: scene.name,
    ...(scene.title ? { title: scene.title } : {}),
    stage,
    durationMs: timeline.durationMs,
    fps,
    shots,
    camera: cameraSamples(scene, fps, 1).map((s) => ({ ms: Math.round((s.frame / fps) * 1000 * 1000) / 1000, view: s.view })),
    elements: [...board.elementKeys].map(([id, keys]) => ({ id, keys })),
    layers,
    transitions,
    notes,
  };
}
