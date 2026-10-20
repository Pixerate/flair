/**
 * The document an effect editor edits: an effect (a shader's source, or a
 * vector picture with its controls), the values picked for its controls,
 * keyframed tracks, presets and a timeline. Plain JSON, so it can be saved,
 * diffed, and written by an agent.
 */

import { effectDefaults, getEffect, renderVectorEffect, vectorControlIssues, vectorEffectControls } from "../catalog/index.js";
import type { EffectDefinition, EffectPreset, VectorControl } from "../catalog/types.js";
import { checkControlValue, controlValue, parseControls, type ControlDef, type ControlValue } from "../shader/controls.js";
import { svgMotionIssues, type SvgMotion } from "../vector/motion.js";
import { svgDuration } from "../vector/svg.js";
import { evaluateTrack, isEasing, normalizeKeyframes, type Track } from "./timeline.js";

/**
 * What is being edited: a fragment shader, or an animated SVG. Both declare
 * their controls in themselves (`// @control`, `{{name: type …}}`); a vector
 * effect's optional `controls` list is for pictures written before that.
 */
export type EffectSource =
  | { kind: "shader"; source: string }
  | { kind: "vector"; motion: SvgMotion; controls?: VectorControl[]; hold?: number };

export interface EffectDocument {
  /** Format version (1). */
  version: 1;
  name: string;
  /** The catalog effect it started from, if any. */
  basedOn?: string;
  effect: EffectSource;
  /** Picked control values; controls without one use their default. */
  values: Record<string, ControlValue>;
  /** Keyframed controls, by control name. A track overrides the control's value. */
  tracks: Record<string, Track>;
  /** Timeline length in ms. */
  duration: number;
  loop: boolean;
  presets: EffectPreset[];
}

const DEFAULT_SHADER = `// A new effect: edit me.
uniform vec3 uColorA;  // @control color default=#6366F1 label="Colour A"
uniform vec3 uColorB;  // @control color default=#EC4899 label="Colour B"
uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = 0.5 + 0.5 * sin(uv.x * 3.0 + iTime * uSpeed);
  fragColor = vec4(mix(uColorA, uColorB, t), 1.0);
}
`;

/** Ms of timeline a new document gets when its effect sets none (a shader's `loop`, or a vector effect's motion plus `hold`). */
const DEFAULT_DURATION = 5000;

/**
 * A new document: blank (a small starter shader), from a catalog effect (by
 * id or definition), or from a shader's source.
 */
export function createEffectDocument(from?: string | EffectDefinition | { source: string; name?: string }): EffectDocument {
  if (from === undefined) return blankDocument("Untitled effect", DEFAULT_SHADER);
  if (typeof from === "object" && !("kind" in from)) return blankDocument(from.name ?? "Untitled effect", from.source);
  const effect = typeof from === "string" ? getEffect(from) : from;
  if (!effect) throw new Error(`There is no effect "${String(from)}" in the catalog.`);
  return {
    version: 1,
    name: effect.name,
    basedOn: effect.id,
    effect:
      effect.kind === "shader"
        ? { kind: "shader", source: effect.source }
        : {
            kind: "vector",
            motion: structuredClone(effect.motion),
            ...(effect.controls && { controls: effect.controls.map((c) => ({ ...c })) }),
            hold: effect.hold,
          },
    values: {},
    tracks: {},
    duration:
      effect.kind === "vector"
        ? // Timed with the defaults filled in: a placeholder `ms` or `delay` has no length of its own.
          Math.round(svgDuration(renderVectorEffect(effect, effectDefaults(effect))) + (effect.hold ?? 600))
        : effect.loop
          ? Math.round(effect.loop * 1000)
          : DEFAULT_DURATION,
    loop: true,
    presets: (effect.presets ?? []).map((p) => ({ name: p.name, values: { ...p.values } })),
  };
}

function blankDocument(name: string, source: string): EffectDocument {
  return { version: 1, name, effect: { kind: "shader", source }, values: {}, tracks: {}, duration: DEFAULT_DURATION, loop: true, presets: [] };
}

/** The document's controls. */
export function documentControls(doc: EffectDocument): ControlDef[] {
  if (doc.effect.kind === "shader") return parseControls(doc.effect.source);
  return vectorEffectControls(doc.effect);
}

/** Every control's value at `time` (ms): its track if it has one, else the picked value, else its default. */
export function valuesAt(doc: EffectDocument, time: number, controls = documentControls(doc)): Record<string, ControlValue> {
  const out: Record<string, ControlValue> = {};
  for (const control of controls) {
    const tracked = evaluateTrack(doc.tracks[control.name], time, control);
    out[control.name] = tracked ?? controlValue(control, doc.values);
  }
  return out;
}

/** A vector document's picture with the values at `time` filled in; undefined for shaders. */
export function motionAt(doc: EffectDocument, time: number): SvgMotion | undefined {
  if (doc.effect.kind !== "vector") return undefined;
  // Derived placeholders are code, so they come from the catalog effect the document started from.
  const base = doc.basedOn ? getEffect(doc.basedOn) : undefined;
  const derived = base?.kind === "vector" ? base.derived : undefined;
  return renderVectorEffect({ motion: doc.effect.motion, controls: doc.effect.controls, derived }, valuesAt(doc, time));
}

/**
 * Problems with a document, as sentences: unknown controls in values, tracks
 * or presets, values a control cannot take, bad keyframes, and (for vector
 * effects) problems with the picture. Shader compile errors come from the
 * GPU, not from here.
 */
export function documentIssues(doc: EffectDocument): string[] {
  const issues: string[] = [];
  if (!(doc.duration > 0)) issues.push("`duration` must be above 0 ms");
  if (doc.effect.kind === "shader" && !/void\s+mainImage\s*\(/.test(doc.effect.source))
    issues.push("the shader needs `void mainImage(out vec4 fragColor, in vec2 fragCoord)`");
  const controls = new Map(documentControls(doc).map((c) => [c.name, c]));
  const check = (where: string, name: string, value: unknown) => {
    const control = controls.get(name);
    if (!control) return void issues.push(`${where}: there is no control "${name}"`);
    const result = checkControlValue(control, value);
    if (!result.ok) issues.push(`${where}: ${result.message}`);
  };
  for (const [name, value] of Object.entries(doc.values)) check("values", name, value);
  for (const [name, track] of Object.entries(doc.tracks)) {
    track.keyframes.forEach((k, i) => {
      const where = `tracks.${name}[${i}]`;
      if (!(k.time >= 0)) issues.push(`${where}: \`time\` must be 0 or more`);
      if (k.easing !== undefined && !isEasing(k.easing)) issues.push(`${where}: unknown easing`);
      check(where, name, k.value);
    });
  }
  for (const preset of doc.presets) for (const [name, value] of Object.entries(preset.values)) check(`preset "${preset.name}"`, name, value);
  if (doc.effect.kind === "vector") {
    const motion = motionAt(doc, 0)!;
    issues.push(...vectorControlIssues(doc.effect.motion), ...svgMotionIssues(motion));
    if (/\{\{[^}]+\}\}/.test(JSON.stringify(motion))) issues.push("the picture has placeholders no control fills");
  }
  return issues;
}

/** Reads a document from JSON (or a parsed object), checking its shape. */
export function parseEffectDocument(input: string | unknown): { ok: true; document: EffectDocument } | { ok: false; errors: string[] } {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`not JSON: ${(e as Error).message}`] };
    }
  }
  const errors: string[] = [];
  const o = (raw ?? {}) as Partial<EffectDocument> & Record<string, unknown>;
  if (o.version !== 1) errors.push("`version` must be 1");
  if (typeof o.name !== "string") errors.push("`name` must be a string");
  const effect = o.effect as Partial<EffectSource> | undefined;
  if (!effect || (effect.kind !== "shader" && effect.kind !== "vector")) errors.push('`effect.kind` must be "shader" or "vector"');
  else if (effect.kind === "shader" && typeof (effect as { source?: unknown }).source !== "string") errors.push("`effect.source` must be a string");
  else if (effect.kind === "vector") {
    const v = effect as Partial<Extract<EffectSource, { kind: "vector" }>>;
    if (!v.motion || typeof v.motion.svg !== "string") errors.push("`effect.motion.svg` must be a string");
    if (v.controls !== undefined && !Array.isArray(v.controls)) errors.push("`effect.controls` must be a list");
  }
  const isRecord = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  if (o.values !== undefined && !isRecord(o.values)) errors.push("`values` must be an object");
  if (o.tracks !== undefined && !isRecord(o.tracks)) errors.push("`tracks` must be an object");
  for (const [name, track] of Object.entries((isRecord(o.tracks) ? o.tracks : {}) as Record<string, Track>))
    if (!track || !Array.isArray(track.keyframes)) errors.push(`\`tracks.${name}.keyframes\` must be a list`);
  if (o.presets !== undefined && !Array.isArray(o.presets)) errors.push("`presets` must be a list");
  if (errors.length) return { ok: false, errors };
  const tracks = Object.fromEntries(
    Object.entries((o.tracks ?? {}) as Record<string, Track>).map(([k, t]) => [k, { ...t, keyframes: normalizeKeyframes(t.keyframes) }]),
  );
  return {
    ok: true,
    document: {
      version: 1,
      name: o.name!,
      basedOn: typeof o.basedOn === "string" ? o.basedOn : undefined,
      effect: o.effect as EffectSource,
      values: (o.values ?? {}) as Record<string, ControlValue>,
      tracks,
      duration: typeof o.duration === "number" && o.duration > 0 ? o.duration : DEFAULT_DURATION,
      loop: o.loop !== false,
      presets: (o.presets ?? []) as EffectPreset[],
    },
  };
}
