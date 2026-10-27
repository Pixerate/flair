/**
 * Effect authoring for `flairEffects()`: the `@pixerate/editor/effects`
 * authoring session over Flair's own `EffectEditor`, so the editor's Effect
 * Authoring tab and its agent tools edit Flair effects. Shaders edit their
 * GLSL (compile errors on the source's lines); vector effects edit their
 * controls. Loaded with the first session, with the editor and the catalog
 * it creates documents from.
 */

import {
  EffectControlError,
  EffectDisposedError,
  EffectUnsupportedError,
  UnknownEffectError,
  effectValueErrors,
  resolveEffectValues,
  type EffectAuthoringDocument,
  type EffectAuthoringIssue,
  type EffectAuthoringResult,
  type EffectAuthoringSession,
  type EffectAuthoringSource,
  type EffectAuthoringState,
  type EffectDescription,
  type EffectKeyframe,
  type EffectPixels,
  type EffectRenderer,
  type EffectRendererOptions,
  type EffectRenderRequest,
  type EffectValue,
  type EffectValues,
} from "@pixerate/editor/effects";
import type { AnimationEasing } from "@pixerate/editor/animation";
import { loadEffect } from "../catalog/lazy.js";
import { createEffectDocument, documentControls, motionAt, parseEffectDocument, valuesAt, type EffectDocument } from "../editor/document.js";
import { createEffectEditor, type CompileReport, type EffectEditor, type EffectEditorState } from "../editor/editor.js";
import { normalizeKeyframes, type Track } from "../editor/timeline.js";
import { checkControlValue, type ControlDef, type ControlValue } from "../shader/controls.js";
import { PassCompileError, type ShaderPipeline } from "../shader/pipeline.js";
import { compileShader, createContext, ShaderCompileError } from "../shader/program.js";
import {
  checkRenderRequest,
  contractValue,
  describePlan,
  drawShaderFrame,
  finishVectorFrame,
  FLAIR_PROVIDER_ID,
  flairValues,
  rendererSize,
  shaderPipeline,
  withControls,
  type Plan,
  type SvgRasterizer,
} from "./effects.js";

/** What `flairEffects()` hands a session: its catalog plans, and how it draws vector effects. */
export interface AuthoringEnvironment {
  plans: ReadonlyMap<string, Plan>;
  isPrimitive(id: string): boolean;
  /** Draws vector effects as pixels; undefined in a Worker without `rasterizeSvg`. */
  rasterize?: SvgRasterizer;
}

/** A saved document: the contract's fields, plus Flair's own document so the source survives a round trip. */
interface FlairAuthoringDocument extends EffectAuthoringDocument {
  flair?: EffectDocument;
}

type Problem = { path: string; message: string };
type Result = EffectAuthoringResult;
type Refusal = { ok: false; message: string };

const fail = (message: string): Refusal => ({ ok: false, message });
const CLOSED = fail("the session is closed; open the effect again with openAuthoring.");

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Schema problems as one sentence naming each control, as the editor's generic session words them. */
function valueMessage(problems: readonly Problem[]): string {
  return problems
    .map((p) => {
      const [control, ...rest] = p.path.replace(/^\//, "").split("/");
      return `control "${control}"${rest.length ? ` (item ${rest.join("/")})` : ""}: ${p.message}`;
    })
    .join("; ");
}

/** A contract value as Flair's (colours as channels); the schema has checked it already. */
function toFlair(control: ControlDef, value: unknown): ControlValue {
  if (control.color && typeof value === "string" && value.trim().toLowerCase() === "currentcolor") return value;
  const checked = checkControlValue(control, value);
  return checked.ok ? checked.value : (value as ControlValue);
}

function unsupportedPrimitive(id: string): EffectUnsupportedError {
  return new EffectUnsupportedError(`"${id}" is a motion primitive: it moves vector art and has no picture or source of its own to edit. Apply it with applyVectorEffect instead.`, id);
}

function planOf(env: AuthoringEnvironment, id: string): Plan {
  if (env.isPrimitive(id)) throw unsupportedPrimitive(id);
  const plan = env.plans.get(id);
  if (!plan) throw new UnknownEffectError(String(id), "Flair");
  return plan;
}

// ---------------------------------------------------------------------------
// Documents in
// ---------------------------------------------------------------------------

/** Problems with a saved document's contract fields against the effect's description, by JSON path. */
function documentProblems(doc: Record<string, unknown>, description: EffectDescription): Problem[] {
  const problems: Problem[] = [];
  const controls = Object.keys(description.controls.properties);
  const valueProblems = (at: string, values: unknown) => effectValueErrors(description, values).map((e) => ({ path: `${at}${e.path}`, message: e.message }));
  if (doc.name !== undefined && typeof doc.name !== "string") problems.push({ path: "/name", message: "must be a string" });
  if (doc.values !== undefined) {
    if (!isRecord(doc.values)) problems.push({ path: "/values", message: "must be an object of control values" });
    else problems.push(...valueProblems("/values", doc.values));
  }
  if (doc.tracks !== undefined) {
    if (!isRecord(doc.tracks)) problems.push({ path: "/tracks", message: "must be an object of keyframe lists" });
    else
      for (const [control, keyframes] of Object.entries(doc.tracks)) {
        const at = `/tracks/${control}`;
        if (!controls.includes(control)) problems.push({ path: at, message: `there is no control "${control}"; the controls are ${controls.join(", ") || "none"}` });
        else if (!Array.isArray(keyframes)) problems.push({ path: at, message: "must be a list of keyframes" });
        else
          keyframes.forEach((k: unknown, i) => {
            if (!isRecord(k)) return void problems.push({ path: `${at}/${i}`, message: "must be a keyframe object" });
            if (typeof k.time !== "number" || !Number.isFinite(k.time) || k.time < 0) problems.push({ path: `${at}/${i}/time`, message: "must be a finite number of ms >= 0" });
            problems.push(...effectValueErrors(description, { [control]: k.value }).map((e) => ({ path: `${at}/${i}/value`, message: e.message })));
          });
      }
  }
  if (doc.presets !== undefined) {
    if (!Array.isArray(doc.presets)) problems.push({ path: "/presets", message: "must be a list of presets" });
    else
      doc.presets.forEach((p: unknown, i) => {
        if (!isRecord(p) || typeof p.name !== "string" || !p.name) return void problems.push({ path: `/presets/${i}`, message: "must have a name" });
        problems.push(...valueProblems(`/presets/${i}/values`, p.values));
      });
  }
  if (doc.duration !== undefined && (typeof doc.duration !== "number" || !Number.isFinite(doc.duration) || !(doc.duration > 0))) {
    problems.push({ path: "/duration", message: "must be a finite number of ms > 0" });
  }
  if (doc.loop !== undefined && typeof doc.loop !== "boolean") problems.push({ path: "/loop", message: "must be a boolean" });
  return problems;
}

/** Flair's document for a saved one: its `flair` document when it has one, else the catalog effect with the contract fields over it. */
async function readDocument(raw: unknown, env: AuthoringEnvironment): Promise<EffectDocument> {
  if (!isRecord(raw)) throw new EffectControlError("", [{ path: "/", message: "must be a document saved with exportDocument (an object)" }]);
  const header: Problem[] = [];
  if (raw.version !== 1) header.push({ path: "/version", message: "must be 1" });
  if (raw.providerId !== undefined && raw.providerId !== FLAIR_PROVIDER_ID) {
    header.push({ path: "/providerId", message: `is ${JSON.stringify(raw.providerId)}; this is Flair's provider ("${FLAIR_PROVIDER_ID}"): open it with the provider that saved it` });
  }
  if (typeof raw.effectId !== "string" || !raw.effectId) header.push({ path: "/effectId", message: "must be the id of the effect the document was made from" });
  const effectId = typeof raw.effectId === "string" ? raw.effectId : "";
  if (header.length) throw new EffectControlError(effectId, header);
  const plan = planOf(env, effectId);

  let doc: EffectDocument;
  const problems: Problem[] = [];
  if (raw.flair !== undefined) {
    const parsed = parseEffectDocument(raw.flair);
    if (!parsed.ok) throw new EffectControlError(effectId, parsed.errors.map((message) => ({ path: "/flair", message })));
    if (parsed.document.effect.kind !== plan.meta.kind) {
      throw new EffectControlError(effectId, [{ path: "/flair/effect/kind", message: `is "${parsed.document.effect.kind}", but "${effectId}" is a ${plan.meta.kind} effect` }]);
    }
    doc = { ...parsed.document, basedOn: parsed.document.basedOn ?? effectId };
  } else doc = createEffectDocument(await loadEffect(effectId));

  const controls = documentControls(doc);
  const description = describePlan(withControls(plan, controls), []);
  problems.push(...documentProblems(raw, description));
  if (problems.length) throw new EffectControlError(effectId, problems);
  if (raw.flair !== undefined) return doc;

  // Only the contract fields: they go over the catalog effect's document.
  const byName = new Map(controls.map((c) => [c.name, c]));
  const flairOf = (values: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(values).flatMap(([name, value]) => (byName.has(name) ? [[name, toFlair(byName.get(name)!, value)]] : []))) as Record<string, ControlValue>;
  const tracks: Record<string, Track> = {};
  for (const [name, keyframes] of Object.entries((raw.tracks ?? {}) as Record<string, EffectKeyframe[]>)) {
    if (!keyframes.length) continue;
    tracks[name] = {
      keyframes: normalizeKeyframes(
        keyframes.map((k) => ({ time: k.time, value: toFlair(byName.get(name)!, k.value), ...(k.easing !== undefined && { easing: k.easing }) })),
      ),
    };
  }
  return {
    ...doc,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : doc.name,
    values: flairOf((raw.values ?? {}) as Record<string, unknown>),
    tracks,
    presets: Array.isArray(raw.presets) ? (raw.presets as { name: string; values?: Record<string, unknown> }[]).map((p) => ({ name: p.name, values: flairOf(p.values ?? {}) })) : doc.presets,
    duration: typeof raw.duration === "number" ? raw.duration : doc.duration,
    loop: typeof raw.loop === "boolean" ? raw.loop : doc.loop,
  };
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

/**
 * Opens a Flair effect for authoring (`EffectProvider.openAuthoring`): a
 * catalog effect by id (with a preset's values when one is named), or a
 * document saved with `exportDocument`.
 */
export async function openFlairAuthoring(source: EffectAuthoringSource, env: AuthoringEnvironment): Promise<EffectAuthoringSession> {
  if (!isRecord(source)) throw new EffectUnsupportedError("openAuthoring takes { effectId, preset? } or { document } (one saved with exportDocument).");
  let doc: EffectDocument;
  if ("document" in source) doc = await readDocument(source.document, env);
  else if (typeof source.effectId === "string") {
    const plan = planOf(env, source.effectId);
    doc = createEffectDocument(await loadEffect(plan.meta.id));
    if (source.preset !== undefined) {
      const preset = doc.presets.find((p) => p.name === source.preset);
      if (!preset) {
        throw new EffectUnsupportedError(
          `"${plan.meta.id}" has no preset ${JSON.stringify(source.preset)}; its presets are ${doc.presets.map((p) => `"${p.name}"`).join(", ") || "none"}.`,
          plan.meta.id,
        );
      }
      doc = { ...doc, values: { ...preset.values } };
    }
  } else throw new EffectUnsupportedError("openAuthoring takes { effectId, preset? } or { document } (one saved with exportDocument).");
  return new FlairAuthoringSession(createEffectEditor({ document: doc }), planOf(env, doc.basedOn!), env.rasterize);
}

class FlairAuthoringSession implements EffectAuthoringSession {
  private disposed = false;
  private readonly previews = new Set<AuthoringPreview>();
  /** The source the editor's latest compile report is for: a report for an older source is not shown. */
  private reportedSource: string | null = null;
  /** A small context for compiling sources no preview has drawn yet (null: none could be made). */
  private compiler: { gl: WebGL2RenderingContext } | null | undefined;
  private flairState: EffectEditorState | undefined;
  private state: EffectAuthoringState | undefined;
  private described: { controls: ControlDef[]; presets: EffectDocument["presets"]; name: string; plan: Plan; description: EffectDescription } | undefined;

  constructor(
    readonly editor: EffectEditor,
    private readonly basePlan: Plan,
    private readonly rasterize: SvgRasterizer | undefined,
  ) {
    this.compileSource();
  }

  // ── Reading ────────────────────────────────────────────────────────

  getState(): EffectAuthoringState {
    const flair = this.editor.getState();
    if (this.state && flair === this.flairState) return this.state;
    const doc = flair.document;
    const { plan, description } = this.describe(flair);
    const shown = new Map(plan.controls.map((c) => [c.name, c]));
    const source = doc.effect.kind === "shader" ? doc.effect.source : null;
    const report = source !== null && source === this.reportedSource ? flair.compile : null;
    const tracks: Record<string, EffectKeyframe[]> = {};
    for (const [name, track] of Object.entries(doc.tracks)) {
      const control = shown.get(name);
      if (!control || track.enabled === false) continue;
      tracks[name] = track.keyframes.map((k) => ({ time: k.time, value: contractValue(control, k.value) as EffectValue, ...(k.easing !== undefined && { easing: k.easing as AnimationEasing }) }));
    }
    const issues: EffectAuthoringIssue[] = [
      ...(report?.errors ?? []).map((e) => ({ message: e.message, ...(e.line > 0 && { line: e.line }), severity: "error" as const })),
      ...flair.issues.map((message) => ({ message, severity: "warning" as const })),
    ];
    this.flairState = flair;
    this.state = {
      providerId: FLAIR_PROVIDER_ID,
      effectId: doc.basedOn ?? this.basePlan.meta.id,
      name: doc.name,
      kind: this.basePlan.meta.kind,
      description,
      source,
      sourceLanguage: source === null ? null : "glsl",
      values: this.contractValues(plan, flair.values),
      tracks,
      issues,
      compiled: report ? report.ok : null,
      time: flair.time,
      duration: doc.duration,
      loop: doc.loop,
      playing: flair.playing,
      canUndo: flair.history.canUndo,
      canRedo: flair.history.canRedo,
    };
    return this.state;
  }

  subscribe(listener: (state: EffectAuthoringState) => void): () => void {
    return this.editor.subscribe(() => listener(this.getState()));
  }

  /** The plan and description for the editor's controls now; the same objects until the controls, presets or name change. */
  private describe(flair: EffectEditorState): { plan: Plan; description: EffectDescription } {
    const { controls, document: doc } = flair;
    const d = this.described;
    if (d && d.controls === controls && d.presets === doc.presets && d.name === doc.name) return d;
    const plan = withControls(this.basePlan, controls);
    const description = { ...describePlan(plan, doc.presets), name: doc.name, duration: doc.duration, loop: doc.loop };
    this.described = { controls, presets: doc.presets, name: doc.name, plan, description };
    return this.described;
  }

  private contractValues(plan: Plan, values: Record<string, ControlValue>): EffectValues {
    return Object.fromEntries(plan.controls.map((c) => [c.name, contractValue(c, values[c.name] ?? c.default)])) as EffectValues;
  }

  // ── Checking what comes in ─────────────────────────────────────────

  /** The shown control, or the refusal naming the ones there are. */
  private control(name: unknown): { control: ControlDef } | Refusal {
    const { plan } = this.describe(this.editor.getState());
    const control = typeof name === "string" ? plan.controls.find((c) => c.name === name) : undefined;
    return control ? { control } : fail(`there is no control ${JSON.stringify(name)}; the controls are ${plan.controls.map((c) => c.name).join(", ") || "none"}.`);
  }

  /** Contract values as Flair's, or the refusal naming each control that is wrong. */
  private incoming(values: unknown): { values: Record<string, ControlValue> } | Refusal {
    if (!isRecord(values)) return fail("values must be an object of control values, by control name.");
    for (const name of Object.keys(values)) {
      const found = this.control(name);
      if ("message" in found) return found;
    }
    const { plan, description } = this.describe(this.editor.getState());
    const problems = effectValueErrors(description, values);
    if (problems.length) return fail(`${valueMessage(problems)}.`);
    return { values: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, toFlair(plan.controls.find((c) => c.name === name)!, value)])) };
  }

  // ── Writing ────────────────────────────────────────────────────────

  setSource(source: string): EffectAuthoringResult<{ issues: readonly EffectAuthoringIssue[] }> {
    if (this.disposed) return CLOSED;
    if (typeof source !== "string") return fail(`setSource takes the whole GLSL source as a string; got ${source === null ? "null" : typeof source}.`);
    if (this.editor.document.effect.kind !== "shader") {
      return fail(`"${this.basePlan.meta.id}" is a vector effect, and its picture cannot be edited as source here (sourceLanguage is null); change its controls instead.`);
    }
    const result = this.editor.setSource(source);
    if (!result.ok) return fail(result.message);
    this.compileSource();
    return { ok: true, issues: this.getState().issues };
  }

  setValue(name: string, value: EffectValue, options?: { gesture?: string | null }): Result {
    if (this.disposed) return CLOSED;
    const found = this.incoming({ [name]: value });
    if ("message" in found) return found;
    return this.editor.setValue(name, found.values[name], { gesture: options?.gesture });
  }

  setValues(values: EffectValues, options?: { gesture?: string | null }): Result {
    if (this.disposed) return CLOSED;
    const found = this.incoming(values);
    if ("message" in found) return found;
    return this.editor.setValues(found.values, { gesture: options?.gesture });
  }

  resetValues(names?: readonly string[]): Result {
    if (this.disposed) return CLOSED;
    if (names !== undefined) {
      if (!Array.isArray(names)) return fail("resetValues takes a list of control names, or nothing to reset them all.");
      for (const name of names) {
        const found = this.control(name);
        if ("message" in found) return found;
      }
    }
    return this.editor.resetValues(names);
  }

  applyPreset(name: string): Result {
    if (this.disposed) return CLOSED;
    const presets = this.editor.document.presets;
    if (!presets.some((p) => p.name === name)) return fail(`there is no preset ${JSON.stringify(name)}; the presets are ${presets.map((p) => `"${p.name}"`).join(", ") || "none"}.`);
    return this.editor.applyPreset(name);
  }

  savePreset(name: string): Result {
    if (this.disposed) return CLOSED;
    if (typeof name !== "string" || !name.trim()) return fail("A preset needs a name (a non-empty string).");
    return this.editor.savePreset(name.trim());
  }

  setKeyframe(name: string, time: number, value?: EffectValue, easing?: AnimationEasing): Result {
    if (this.disposed) return CLOSED;
    const found = this.control(name);
    if ("message" in found) return found;
    if (typeof time !== "number" || !Number.isFinite(time) || time < 0) return fail(`control "${name}": a keyframe's time is a number of ms, 0 or more; got ${JSON.stringify(time)}.`);
    let flair: ControlValue | undefined;
    if (value !== undefined) {
      const checked = this.incoming({ [name]: value });
      if ("message" in checked) return checked;
      flair = checked.values[name];
    }
    const result = this.editor.setKeyframe(name, time, flair, easing);
    return result.ok ? result : fail(`control "${name}": ${result.message}`);
  }

  removeKeyframe(name: string, time: number): Result {
    if (this.disposed) return CLOSED;
    const found = this.control(name);
    if ("message" in found) return found;
    const keyframes = this.editor.document.tracks[name]?.keyframes ?? [];
    if (!keyframes.some((k) => Math.abs(k.time - time) < 1e-3)) {
      return fail(`control "${name}" has no keyframe at ${JSON.stringify(time)} ms; ${keyframes.length ? `its keyframes are at ${keyframes.map((k) => k.time).join(", ")} ms` : "it has none"}.`);
    }
    return this.editor.removeKeyframe(name, time);
  }

  clearTrack(name: string): Result {
    if (this.disposed) return CLOSED;
    const found = this.control(name);
    if ("message" in found) return found;
    if (!this.editor.document.tracks[name]) return fail(`control "${name}" has no keyframes to clear.`);
    return this.editor.clearTrack(name);
  }

  setTiming(timing: { duration?: number; loop?: boolean }): Result {
    if (this.disposed) return CLOSED;
    if (!isRecord(timing)) return fail("setTiming takes { duration?, loop? }: duration in ms above 0, loop true or false.");
    const { duration, loop } = timing;
    if (duration !== undefined && (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0)) return fail(`duration is a number of ms above 0; got ${JSON.stringify(duration)}.`);
    if (loop !== undefined && typeof loop !== "boolean") return fail(`loop is true or false; got ${JSON.stringify(loop)}.`);
    return this.editor.setTiming({ duration, loop });
  }

  // ── Playback and history ───────────────────────────────────────────

  play(): void {
    if (!this.disposed) this.editor.play();
  }

  pause(): void {
    this.editor.pause();
  }

  seek(time: number): void {
    if (!this.disposed && typeof time === "number" && Number.isFinite(time)) this.editor.seek(time);
  }

  undo(): boolean {
    if (this.disposed) return false;
    const undone = this.editor.undo();
    if (undone) this.compileSource();
    return undone;
  }

  redo(): boolean {
    if (this.disposed) return false;
    const redone = this.editor.redo();
    if (redone) this.compileSource();
    return redone;
  }

  // ── Compiling ──────────────────────────────────────────────────────

  /** Records a compile of `source` (from a preview, or compiled here). */
  report(source: string, report: CompileReport): void {
    if (this.disposed) return;
    this.reportedSource = source;
    this.editor.reportCompile(report);
  }

  /**
   * Compiles the current source when no report is for it yet, so its errors
   * are known without a preview (an agent setting source gets them back).
   * Where there is no WebGL2 it stays unknown (`compiled` null).
   */
  private compileSource(): void {
    const effect = this.editor.document.effect;
    if (effect.kind !== "shader" || effect.source === this.reportedSource) return;
    if (this.compiler === undefined) {
      try {
        const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : typeof document !== "undefined" ? document.createElement("canvas") : undefined;
        const gl = canvas ? createContext(canvas) : null;
        this.compiler = gl ? { gl } : null;
      } catch {
        this.compiler = null;
      }
    }
    if (!this.compiler) return;
    const { gl } = this.compiler;
    const compiled = compileShader(gl, effect.source, []);
    if (compiled.ok) gl.deleteProgram(compiled.shader.program);
    this.report(effect.source, compiled.ok ? { ok: true, errors: [] } : { ok: false, errors: compiled.errors });
  }

  // ── Preview and lifecycle ──────────────────────────────────────────

  createPreview(options: EffectRendererOptions): EffectRenderer | Promise<EffectRenderer> {
    const id = this.basePlan.meta.id;
    if (this.disposed) throw new EffectDisposedError(id);
    const size = rendererSize(id, options, "createPreview");
    if (this.editor.document.effect.kind === "vector" && !this.rasterize) {
      return Promise.reject(
        new EffectUnsupportedError(`"${id}" is a vector effect, and a Worker has no DOM to draw SVG in: preview it on the page, or pass rasterizeSvg to flairEffects.`, id),
      );
    }
    const preview = new AuthoringPreview(this, size, this.rasterize, () => this.previews.delete(preview));
    this.previews.add(preview);
    return preview;
  }

  /** The current plan and description, for previews. */
  current(): { plan: Plan; description: EffectDescription; document: EffectDocument; controls: ControlDef[] } {
    const flair = this.editor.getState();
    return { ...this.describe(flair), document: flair.document, controls: flair.controls };
  }

  exportDocument(): FlairAuthoringDocument {
    const doc = this.editor.document;
    const { plan } = this.describe(this.editor.getState());
    const shown = new Map(plan.controls.map((c) => [c.name, c]));
    const contract = (values: Record<string, ControlValue>) =>
      Object.fromEntries(Object.entries(values).flatMap(([name, value]) => (shown.has(name) ? [[name, contractValue(shown.get(name)!, value)]] : []))) as EffectValues;
    const state = this.getState();
    return JSON.parse(
      JSON.stringify({
        version: 1,
        providerId: FLAIR_PROVIDER_ID,
        effectId: state.effectId!,
        name: doc.name,
        values: contract(doc.values),
        tracks: state.tracks,
        presets: doc.presets.map((p) => ({ name: p.name, values: contract(p.values) })),
        duration: doc.duration,
        loop: doc.loop,
        flair: doc,
      }),
    ) as FlairAuthoringDocument;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const preview of [...this.previews]) preview.dispose();
    this.editor.dispose();
    this.compiler?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.compiler = null;
  }
}

/**
 * Draws the session's effect as it is at each `render`: its current source
 * (recompiled, and reported, when it changed) and the values at the
 * request's time (keyframes applied) unless the request gives values.
 */
class AuthoringPreview implements EffectRenderer {
  readonly width: number;
  readonly height: number;
  depth: 8 | 16 | 32;
  private readonly asked: 8 | 16 | 32;
  private pipeline: ShaderPipeline<HTMLCanvasElement | OffscreenCanvas> | null = null;
  /** The source the pipeline was made from (or failed to compile). */
  private pipelineSource: string | null = null;
  private disposed = false;

  constructor(
    private readonly session: FlairAuthoringSession,
    size: { width: number; height: number; depth: 8 | 16 | 32 },
    private readonly rasterize: SvgRasterizer | undefined,
    private readonly forget: () => void,
  ) {
    this.width = size.width;
    this.height = size.height;
    this.depth = this.asked = size.depth;
  }

  get effectId(): string {
    return this.session.current().plan.meta.id;
  }

  async render(request: EffectRenderRequest): Promise<EffectPixels> {
    if (this.disposed) throw new EffectDisposedError(this.effectId);
    const { plan, description, document: doc, controls } = this.session.current();
    checkRenderRequest(plan, plan.meta.id, request);
    // The values for this time, or the ones asked for (over the defaults, as for any renderer).
    const values = request.values ? { ...valuesAt(doc, request.time, controls), ...flairValues(plan.controls, resolveEffectValues(description, request.values)) } : valuesAt(doc, request.time, controls);
    if (doc.effect.kind === "vector") {
      const motion = motionAt(request.values ? { ...doc, values, tracks: {} } : doc, request.time)!;
      const pixels = await this.rasterize!(motion, request.time, { width: this.width, height: this.height });
      if (this.disposed) throw new EffectDisposedError(plan.meta.id);
      return finishVectorFrame(pixels, plan.meta.id, request, { width: this.width, height: this.height, depth: this.asked });
    }
    const pipeline = this.pipelineFor(doc.effect.source, plan.meta.id);
    // A source that does not compile shows nothing; its errors are in the session's issues.
    if (!pipeline) return { width: this.width, height: this.height, data: new Uint8ClampedArray(this.width * this.height * 4) };
    return drawShaderFrame(pipeline, plan, request, values, {
      width: this.width,
      height: this.height,
      depth: this.depth,
      duration: doc.duration,
      disposed: () => this.disposed,
    });
  }

  /** The pipeline for `source`, made (and its compile reported) when the source changed; null when it does not compile. */
  private pipelineFor(source: string, id: string): ShaderPipeline<HTMLCanvasElement | OffscreenCanvas> | null {
    if (source === this.pipelineSource) return this.pipeline;
    this.pipeline?.dispose();
    this.pipeline = null;
    this.pipelineSource = source;
    try {
      const made = shaderPipeline(source, id, this.width, this.height, this.asked);
      this.pipeline = made.pipeline;
      this.depth = made.depth;
      this.session.report(source, { ok: true, errors: [] });
    } catch (e) {
      if (e instanceof PassCompileError || e instanceof ShaderCompileError) this.session.report(source, { ok: false, errors: e.errors });
      else {
        this.pipelineSource = null;
        throw new EffectUnsupportedError(`"${id}" cannot render here: ${e instanceof Error ? e.message : String(e)}`, id);
      }
    }
    return this.pipeline;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pipeline?.dispose();
    this.pipeline = null;
    this.forget();
  }
}
