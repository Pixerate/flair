import { getCameraMove } from '../catalog/camera.js';
import { layerEffect, layerEffectIds } from '../catalog/layer-index.js';
import { didYouMean } from '../motion/params.js';
import { checkControlValue, parseControls, type ControlDef } from '../shader/controls.js';
import { DEFAULT_TRANSITION_MS, isSlot, LAYER_ROLES, subjectKind, SUBJECT_KINDS, type SceneLayer } from './layers.js';
import type { Scene } from './types.js';

const list = (names: readonly string[]) => names.map((n) => `"${n}"`).join(', ');

export const LAYER_FIELDS = ['id', 'effect', 'source', 'preset', 'values', 'subject', 'role', 'rect', 'ids', 'padding', 'from', 'until', 'opacity', 'fade'];
export const TRANSITION_FIELDS = ['effect', 'ms', 'preset', 'values'];

/** The longest transition, in ms. */
export const MAX_TRANSITION_MS = 10000;

/** The catalog's transitions, for sentences that list them. */
export function transitionIds(): string[] {
  return layerEffectIds().filter((id) => layerEffect(id)!.transition);
}

/** What the old built-in scene effects are now: a catalog effect to use instead, and where it goes. */
const LEGACY_EFFECTS: Record<string, string> = {
  gradient: '{ "effect": "mesh-gradient", "role": "background" }',
  flow: '{ "effect": "flow-network", "ids": [...] }',
  glow: '{ "effect": "glow-ring-pulse", "ids": [...] }',
  spotlight: '{ "effect": "spotlight", "role": "overlay" }',
  shimmer: '{ "effect": "skeleton-shimmer", "ids": [...] }',
  ripple: '{ "effect": "click-ripple", "ids": [...] }',
  timer: 'a timer from find_layer_effects ({ "text": "timer" })',
  counter: '{ "effect": "stat-counter", "ids": [...] }',
  highlight: '{ "effect": "highlighter", "ids": [...] }',
  blur: '{ "effect": "censor-blur", "ids": [...] }',
  burst: '{ "effect": "tick-ring-burst", "ids": [...] }',
  media: '{ "source": "<the shader from scene media>" }',
};

/** A shot's old `effects` and `stopEffects`, refused with the layers to write instead. */
export function legacyEffectIssues(shot: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (shot.effects !== undefined) {
    const types = Array.isArray(shot.effects) ? [...new Set(shot.effects.map((e) => (e && typeof e === 'object' ? String((e as { type?: unknown }).type) : '?')))] : [];
    const instead = types.map((t) => `${t} → ${LEGACY_EFFECTS[t] ?? 'a catalog effect from find_layer_effects'}`).join('; ');
    issues.push(`Shot "effects" were replaced by "layers" of catalog effects; write "layers" instead${instead ? ` (${instead})` : ''}. A layer stops with its "until" ({ "shots": n } or ms).`);
  }
  if (shot.stopEffects !== undefined) issues.push('Shot "stopEffects" was replaced by each layer\'s "until": give the layer that should stop { "until": { "shots": n } } (n shots after its own) or ms after its shot starts.');
  return issues;
}

/** What `checkLayer` needs to know about where the layer is. */
export interface LayerContext {
  /** Its shot, 0-based. */
  shot: number;
  /** Its place in the shot's layers, 0-based. */
  index: number;
  /** How many shots the scene has. */
  shots: number;
  /** The element ids drawn by the end of its shot's commands. */
  drawn: ReadonlySet<string>;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** An effect's id, refused as a layer's with what it is and what to write. */
function effectIdIssue(id: unknown, where: string): string | undefined {
  if (typeof id !== 'string') return `${where} "effect" is a catalog effect's id, like "aurora"; find_layer_effects lists them.`;
  if (layerEffect(id)) return undefined;
  if (getCameraMove(id)) return `${where} names "${id}", a camera move: it goes in the shot's camera "in" or "during", not in layers.`;
  return `There is no catalog effect "${id}" for ${where.toLowerCase()}.${didYouMean(id, layerEffectIds())} find_layer_effects lists the effects a layer can use.`;
}

/** A layer time (`from`/`until`): ms after its shot starts, or `{ "shots": n }`. */
function timeIssue(value: unknown, field: 'from' | 'until', where: string, ctx: LayerContext): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value >= 0 && Number.isFinite(value) ? undefined : `${where} "${field}" in ms is 0 or more.`;
  if (isObject(value) && Object.keys(value).length === 1 && typeof value.shots === 'number' && Number.isInteger(value.shots) && value.shots >= (field === 'until' ? 1 : 0)) {
    const left = ctx.shots - 1 - ctx.shot;
    if (value.shots > left + (field === 'until' ? 1 : 0))
      return `${where} "${field}" is { "shots": ${value.shots} }, but only ${left} shot${left === 1 ? '' : 's'} come${left === 1 ? 's' : ''} after shot ${ctx.shot + 1}; ${field === 'until' ? `{ "shots": ${left + 1} } lasts to the end of the scene` : `use 0 to ${left}`}.`;
    return undefined;
  }
  return `${where} "${field}" is ms after its shot starts (like 400), or { "shots": n } for when the n-th shot after its own starts${field === 'until' ? ' (default { "shots": 1 }: the next shot)' : ''}.`;
}

/**
 * What is wrong with one layer, as sentences that say what to write: its
 * fields, its effect (a shader or vector effect from the catalog, not a
 * camera move or a transition), its subject (one the effect takes), its
 * placement, role, times and opacity. Control values are checked against
 * the catalog by {@link checkSceneLayers}; a custom `source`'s here.
 */
export function checkLayer(layer: unknown, ctx: LayerContext): string[] {
  const where = `Layer ${ctx.index + 1}`;
  if (!isObject(layer)) return [`${where} must be an object, like { "effect": "aurora" }.`];
  const issues: string[] = [];
  const named = typeof layer.id === 'string' ? `${where} ("${layer.id}")` : where;
  for (const key of Object.keys(layer)) {
    if (!LAYER_FIELDS.includes(key)) issues.push(`${named} has no field "${key}"; layer fields are ${list(LAYER_FIELDS)}.`);
  }
  if (layer.id !== undefined && !(typeof layer.id === 'string' && /^[A-Za-z][\w-]*$/.test(layer.id)))
    issues.push(`${named} "id" is a name of letters, digits, "-" and "_", starting with a letter.`);

  // What it draws
  let accepts: string[] | undefined;
  if (layer.effect !== undefined && layer.source !== undefined) {
    issues.push(`${named} has both "effect" and "source"; give a catalog effect's id or a custom shader's source, not both.`);
  } else if (layer.effect !== undefined) {
    const problem = effectIdIssue(layer.effect, named);
    if (problem) issues.push(problem);
    else {
      const entry = layerEffect(layer.effect as string)!;
      if (entry.transition)
        issues.push(`"${entry.id}" is a transition: it blends the last shot into this one, so it goes in the shot's "transition": { "effect": "${entry.id}" }, not in "layers".`);
      accepts = entry.accepts;
    }
  } else if (layer.source !== undefined) {
    if (typeof layer.source !== 'string' || !/\bmainImage\s*\(/.test(layer.source)) {
      issues.push(`${named} "source" is a GLSL ES 3.00 shader with void mainImage(out vec4 fragColor, in vec2 fragCoord), its uniforms declared with // @control.`);
    } else {
      issues.push(...valueIssues(parseControls(layer.source), layer.values, `${named}'s shader`));
    }
    if (layer.preset !== undefined) issues.push(`${named} has a custom "source", which has no presets; set its "values" instead.`);
  } else if (layer.subject === undefined) {
    issues.push(`${named} draws nothing: give it a catalog "effect" (find_layer_effects lists them), a custom shader "source", or a "subject" to show as a picture.`);
  } else if (layer.preset !== undefined || layer.values !== undefined) {
    issues.push(`${named} is a bare picture (no "effect" or "source"), so it has no preset or values; add an "effect" to treat the picture.`);
  }
  if (layer.preset !== undefined && typeof layer.preset !== 'string') issues.push(`${named} "preset" is a preset's name.`);
  if (layer.values !== undefined && !isObject(layer.values)) issues.push(`${named} "values" is an object of control values, like { "uSpeed": 0.5 }.`);

  // Its subject
  const subject = layer.subject;
  if (subject !== undefined) {
    if (isSlot(subject)) {
      if (!/^[A-Za-z][\w-]*$/.test(subject.slot) || Object.keys(subject).length !== 1)
        issues.push(`${named} "subject" { "slot": name } names a slot the host fills at play time: letters, digits, "-" and "_", starting with a letter.`);
    } else {
      const kind = subjectKind(subject);
      const value = kind ? (subject as Record<string, unknown>)[kind] : undefined;
      if (!kind || typeof value !== 'string' || !value) {
        issues.push(`${named} "subject" is one of { "image": url }, { "video": url }, { "svg": markup or url }, { "text": words } or { "slot": name } for the host to fill.`);
      } else if (accepts) {
        const takes = kind === 'text' ? accepts.includes('text') || accepts.includes('mask') : accepts.includes(kind);
        if (!takes) {
          issues.push(
            accepts.length
              ? `"${layer.effect}" takes ${list(accepts.filter((a) => (SUBJECT_KINDS as readonly string[]).includes(a) || a === 'mask'))}, not ${kind === 'svg' ? 'an SVG' : kind === 'image' ? 'an image' : `${kind === 'text' ? 'text' : 'a video'}`}; give it one of those, or find_layer_effects with { "accepts": ["${kind}"] } finds effects that take one.`
              : `"${layer.effect}" makes its picture from nothing, so it takes no subject; leave "subject" out, or find_layer_effects with { "accepts": ["${kind}"] } finds effects that take one.`,
          );
        }
      }
    }
  }

  // Where it goes
  if (layer.role !== undefined && !LAYER_ROLES.includes(layer.role as never)) issues.push(`${named} "role" is one of ${list(LAYER_ROLES)}.`);
  if (layer.rect !== undefined && layer.ids !== undefined) issues.push(`${named} has both "rect" and "ids"; place it by a box or by elements, not both.`);
  if (layer.rect !== undefined) {
    const r = layer.rect as Record<string, unknown>;
    if (!isObject(r) || !['x', 'y', 'width', 'height'].every((k) => typeof r[k] === 'number') || !((r.width as number) > 0 && (r.height as number) > 0))
      issues.push(`${named} "rect" is a box on the board in scene units, { "x", "y", "width", "height" }, with a positive width and height.`);
  }
  if (layer.ids !== undefined) {
    if (!Array.isArray(layer.ids) || layer.ids.length === 0 || !layer.ids.every((id) => typeof id === 'string')) {
      issues.push(`${named} "ids" is a non-empty list of element ids to place it over.`);
    } else {
      const missing = layer.ids.filter((id) => !ctx.drawn.has(id as string));
      if (missing.length) {
        const known = [...ctx.drawn];
        issues.push(`${named} is placed over ${list(missing as string[])}, which no shot has drawn by the end of shot ${ctx.shot + 1}; ${known.length ? `the elements are ${list(known.slice(0, 12))}${known.length > 12 ? ` and ${known.length - 12} more` : ''}` : 'no elements are drawn yet'}.`);
      }
    }
  }
  if (layer.padding !== undefined && !(typeof layer.padding === 'number' && layer.padding >= 0)) issues.push(`${named} "padding" is scene units, 0 or more.`);

  // When
  for (const field of ['from', 'until'] as const) {
    const problem = timeIssue(layer[field], field, named, ctx);
    if (problem) issues.push(problem);
  }
  if (typeof layer.from === 'number' && typeof layer.until === 'number' && layer.until <= layer.from)
    issues.push(`${named} stops (until ${layer.until} ms) before it starts (from ${layer.from} ms); "until" comes after "from".`);
  if (isObject(layer.from) && typeof layer.until === 'number') issues.push(`${named} starts a shot later but stops ${layer.until} ms into its own shot; give "until" as { "shots": n } too.`);
  if (isObject(layer.from) && isObject(layer.until) && (layer.until.shots as number) <= (layer.from.shots as number))
    issues.push(`${named} stops ({ "shots": ${layer.until.shots} }) no later than it starts ({ "shots": ${layer.from.shots} }); "until" comes after "from".`);
  if (layer.opacity !== undefined && !(typeof layer.opacity === 'number' && layer.opacity >= 0 && layer.opacity <= 1)) issues.push(`${named} "opacity" is 0 to 1.`);
  if (layer.fade !== undefined && !(typeof layer.fade === 'number' && layer.fade >= 0)) issues.push(`${named} "fade" is ms to fade in and out over, 0 or more.`);
  return issues;
}

/** What is wrong with a shot's transition, as sentences. */
export function checkTransition(transition: unknown, shot: number): string[] {
  if (!isObject(transition)) return [`A shot's "transition" is { "effect": id, "ms"?, "preset"?, "values"? }, with a catalog transition: ${list(transitionIds())}.`];
  const issues: string[] = [];
  for (const key of Object.keys(transition)) {
    if (!TRANSITION_FIELDS.includes(key)) issues.push(`The transition has no field "${key}"; it takes ${list(TRANSITION_FIELDS)}.`);
  }
  if (shot === 0) issues.push('The first shot has nothing to come from, so it has no transition; give it to a later shot.');
  const id = transition.effect;
  const entry = typeof id === 'string' ? layerEffect(id) : undefined;
  if (!entry || !entry.transition) {
    const transitions = transitionIds();
    issues.push(
      entry
        ? `"${id}" is not a transition (it does not blend one picture into another); it goes in "layers". The transitions are ${list(transitions)}.`
        : `There is no transition ${JSON.stringify(id)}.${typeof id === 'string' ? didYouMean(id, transitions) : ''} The transitions are ${list(transitions)}.`,
    );
  }
  if (transition.ms !== undefined && !(typeof transition.ms === 'number' && transition.ms > 0 && transition.ms <= MAX_TRANSITION_MS))
    issues.push(`The transition's "ms" is how long it takes, more than 0 and up to ${MAX_TRANSITION_MS} (default ${DEFAULT_TRANSITION_MS}).`);
  if (transition.preset !== undefined && typeof transition.preset !== 'string') issues.push(`The transition's "preset" is a preset's name.`);
  if (transition.values !== undefined && !isObject(transition.values)) issues.push(`The transition's "values" is an object of control values.`);
  return issues;
}

/** Problems with control values against the controls they set, each starting with `who`. */
export function valueIssues(controls: readonly ControlDef[], values: unknown, who: string, skip: readonly string[] = []): string[] {
  if (!isObject(values)) return [];
  const issues: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (skip.includes(name)) continue;
    const control = controls.find((c) => c.name === name);
    if (!control) {
      const names = controls.map((c) => c.name).filter((n) => !skip.includes(n));
      issues.push(`${who} has no control "${name}";${didYouMean(name, names)} ${names.length ? `its controls are ${names.join(', ')}` : 'it has none'}.`);
      continue;
    }
    const check = checkControlValue(control, value);
    if (!check.ok) issues.push(`${who}: ${check.message}`);
  }
  return issues;
}

/**
 * The scene's layers' and transitions' presets and control values checked
 * against the catalog, which this loads on demand (the lazy catalog's
 * metadata, not the effects), with shot numbers as `validateScene` gives
 * them. A transition's `uFrom`, `uTo`, `uProgress` and `uAnimate` are the
 * player's to set, so they are refused here.
 */
export async function checkSceneLayers(scene: Scene): Promise<{ shot: number; message: string }[]> {
  const uses = (Array.isArray(scene?.shots) ? scene.shots : []).some((s) => (Array.isArray(s?.layers) && s.layers.some((l) => typeof l?.effect === 'string')) || typeof s?.transition?.effect === 'string');
  if (!uses) return [];
  const { getEffectMeta } = await import('../catalog/lazy.js');
  const issues: { shot: number; message: string }[] = [];
  const check = (shot: number, id: string, preset: unknown, values: unknown, who: string, playerControls: readonly string[] = []) => {
    const meta = getEffectMeta(id);
    if (!meta || meta.kind === 'camera') return;
    if (typeof preset === 'string' && !meta.presets.includes(preset))
      issues.push({ shot, message: `"${id}" has no preset "${preset}"; ${meta.presets.length ? `its presets are ${list(meta.presets)}` : 'it has none'}.` });
    if (isObject(values)) {
      for (const name of playerControls) {
        if (name in values) issues.push({ shot, message: `${who} sets "${name}", which the player drives (uFrom is the last shot, uTo this one, uProgress runs 0 to 1); leave it out.` });
      }
    }
    for (const message of valueIssues(meta.controls, values, `"${id}"`, playerControls)) issues.push({ shot, message });
  };
  scene.shots.forEach((shot, s) => {
    (Array.isArray(shot?.layers) ? shot.layers : []).forEach((layer: SceneLayer, i) => {
      if (layer && typeof layer.effect === 'string') check(s + 1, layer.effect, layer.preset, layer.values, `Layer ${i + 1}`);
    });
    const t = shot?.transition;
    if (t && typeof t.effect === 'string') check(s + 1, t.effect, t.preset, t.values, 'The transition', ['uFrom', 'uTo', 'uProgress', 'uAnimate']);
  });
  return issues;
}
