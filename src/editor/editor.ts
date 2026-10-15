/**
 * A UI-agnostic effect editor: the document, its undo history, a playhead,
 * and commands that menus, shortcuts, a palette and agents all run by id.
 * Bring your own UI (any framework, or none) and your own renderer binding
 * (see `bindShaderRenderer` and `bindSvgView`).
 */

import { createCommandRegistry, createHistoryCommands, type CommandRegistry } from "@pixerate/editor/commands";
import { createHistoryManager, HistoryManager, type HistoryState } from "@pixerate/editor/history";
import type { EffectDefinition } from "../catalog/types.js";
import type { CompileError } from "../shader/program.js";
import { checkControlValue, type ControlDef, type ControlValue } from "../shader/controls.js";
import { realClock, type Clock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import { effectCommands } from "./commands.js";
import {
  createEffectDocument,
  documentControls,
  documentIssues,
  parseEffectDocument,
  valuesAt,
  type EffectDocument,
} from "./document.js";
import { evaluateTrack, isEasing, normalizeKeyframes, type Easing, type Keyframe } from "./timeline.js";

/** What an edit did: `ok`, or why it was refused (in a sentence an agent can act on). */
export type EditResult = { ok: true } | { ok: false; message: string };

/** The result of compiling the shader, as reported by a renderer (see `reportCompile`). */
export interface CompileReport {
  ok: boolean;
  errors: CompileError[];
}

export interface EffectEditorState {
  document: EffectDocument;
  controls: ControlDef[];
  /** Every control's value at the playhead. */
  values: Record<string, ControlValue>;
  /** Problems with the document (see `documentIssues`). */
  issues: string[];
  /** The latest compile report, or null before a renderer reported one (and for vector effects). */
  compile: CompileReport | null;
  /** Playhead, ms. */
  time: number;
  playing: boolean;
  /** Whether changing a value keyframes it at the playhead. */
  recording: boolean;
  history: HistoryState;
}

export interface EffectEditorOptions {
  /** The document to edit, or what to start one from (see `createEffectDocument`). */
  document?: EffectDocument;
  from?: string | EffectDefinition | { source: string; name?: string };
  /** Undo history to record into (default: a new one, 100 steps deep). */
  history?: HistoryManager;
  /** Time source for playback (default: animation frames). */
  clock?: Clock;
  /** Ms within which value changes to one control merge into one undo step (default 400). */
  mergeWindowMs?: number;
}

const ok: EditResult = { ok: true };
const fail = (message: string): EditResult => ({ ok: false, message });

/**
 * Edits one effect. Every change to the document is an undo step (value
 * changes in quick succession, like a slider drag, merge into one), and
 * subscribers hear about every change to the state.
 */
export class EffectEditor {
  readonly history: HistoryManager;
  /** Every editing action, by id: for menus, shortcuts, a command palette and agents. */
  readonly commands: CommandRegistry<EffectEditor>;
  private doc: EffectDocument;
  private controlsCache: { doc: EffectDocument; controls: ControlDef[]; issues: string[] } | null = null;
  private compileReport: CompileReport | null = null;
  private time = 0;
  private playing = false;
  private recording = false;
  private readonly clock: Clock;
  private readonly mergeWindowMs: number;
  private readonly listeners = new Set<(state: EffectEditorState) => void>();
  private state: EffectEditorState | null = null;
  private readonly unsubscribeHistory: () => void;
  private disposed = false;

  constructor(options: EffectEditorOptions = {}) {
    this.doc = options.document ?? createEffectDocument(options.from);
    this.history = options.history ?? createHistoryManager({ maxDepth: 100 });
    this.clock = options.clock ?? realClock;
    this.mergeWindowMs = options.mergeWindowMs ?? 400;
    this.commands = createCommandRegistry<EffectEditor>({ context: this });
    this.commands.register([...createHistoryCommands(this.history), ...effectCommands()]);
    this.unsubscribeHistory = this.history.subscribe(() => this.changed());
  }

  // ── Reading ────────────────────────────────────────────────────────

  get document(): EffectDocument {
    return this.doc;
  }

  /** The current state; the same object until something changes (safe for `useSyncExternalStore`). */
  getState(): EffectEditorState {
    if (!this.state) {
      const { controls, issues } = this.analysis();
      this.state = {
        document: this.doc,
        controls,
        values: valuesAt(this.doc, this.time, controls),
        issues,
        compile: this.doc.effect.kind === "shader" ? this.compileReport : null,
        time: this.time,
        playing: this.playing,
        recording: this.recording,
        history: this.history.getState(),
      };
    }
    return this.state;
  }

  /** Calls `listener` with the new state after every change; returns an unsubscribe function. */
  subscribe(listener: (state: EffectEditorState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The document's controls. */
  get controls(): ControlDef[] {
    return this.analysis().controls;
  }

  /** The document as JSON. */
  toJSON(): EffectDocument {
    return this.doc;
  }

  // ── Whole documents ─────────────────────────────────────────────────

  /** Replaces the document (one undo step). */
  replaceDocument(next: EffectDocument, label = "Replace effect"): EditResult {
    const parsed = parseEffectDocument(next);
    if (!parsed.ok) return fail(parsed.errors.join("; "));
    this.commit(label, parsed.document);
    return ok;
  }

  /** Starts over from a catalog effect, a shader source, or blank (one undo step). */
  load(from?: string | EffectDefinition | { source: string; name?: string }, preset?: string): EditResult {
    let next: EffectDocument;
    try {
      next = createEffectDocument(from);
    } catch (e) {
      return fail((e as Error).message);
    }
    if (preset) {
      const values = next.presets.find((p) => p.name === preset)?.values;
      if (!values) return fail(`"${next.name}" has no preset "${preset}"; it has ${next.presets.map((p) => `"${p.name}"`).join(", ") || "none"}.`);
      next = { ...next, values: { ...values } };
    }
    this.compileReport = null;
    this.commit(`Load ${next.name}`, next);
    return ok;
  }

  rename(name: string): EditResult {
    if (!name.trim()) return fail("A name cannot be empty.");
    this.commit("Rename", { ...this.doc, name: name.trim() });
    return ok;
  }

  // ── The effect itself ───────────────────────────────────────────────

  /** Replaces a shader's source. Compile errors arrive later, from the renderer (see `reportCompile`). */
  setSource(source: string): EditResult {
    if (this.doc.effect.kind !== "shader") return fail("This is a vector effect; use setMotion.");
    if (source === this.doc.effect.source) return ok;
    this.commit("Edit source", { ...this.doc, effect: { kind: "shader", source } }, "source");
    return ok;
  }

  /** Replaces a vector effect's picture (and optionally its controls). */
  setMotion(motion: SvgMotion, controls?: Extract<EffectDocument["effect"], { kind: "vector" }>["controls"]): EditResult {
    if (this.doc.effect.kind !== "vector") return fail("This is a shader effect; use setSource.");
    this.commit("Edit picture", { ...this.doc, effect: { ...this.doc.effect, motion, controls: controls ?? this.doc.effect.controls } });
    return ok;
  }

  /** Called by a renderer binding with the result of compiling the current source. */
  reportCompile(report: CompileReport): void {
    this.compileReport = { ok: report.ok, errors: [...report.errors] };
    this.changed();
  }

  // ── Values ──────────────────────────────────────────────────────────

  /**
   * Sets a control's value. With a track on that control (or while
   * recording) it sets a keyframe at the playhead instead. Quick successive
   * changes to one control merge into one undo step.
   */
  setValue(name: string, value: unknown): EditResult {
    const control = this.control(name);
    if (!control) return this.unknownControl(name);
    const check = checkControlValue(control, value);
    if (!check.ok) return fail(check.message);
    if (this.recording || this.doc.tracks[name]) return this.setKeyframe(name, this.time, check.value, undefined, `value:${name}`);
    this.commit(`Set ${control.label}`, { ...this.doc, values: { ...this.doc.values, [name]: check.value } }, `value:${name}`);
    return ok;
  }

  /** Sets several values in one undo step; refuses them all if any is wrong. */
  setValues(values: Record<string, unknown>): EditResult {
    const next = { ...this.doc.values };
    const tracks = { ...this.doc.tracks };
    for (const [name, value] of Object.entries(values)) {
      const control = this.control(name);
      if (!control) return this.unknownControl(name);
      const check = checkControlValue(control, value);
      if (!check.ok) return fail(check.message);
      if (this.recording || tracks[name]) {
        const keyframes = [...(tracks[name]?.keyframes ?? []), { time: this.time, value: check.value }];
        tracks[name] = { ...tracks[name], keyframes: normalizeKeyframes(keyframes) };
      } else next[name] = check.value;
    }
    this.commit("Set values", { ...this.doc, values: next, tracks });
    return ok;
  }

  /** Back to defaults: the named controls, or all of them (values only; tracks stay). */
  resetValues(names?: readonly string[]): EditResult {
    const unknown = names?.find((n) => !this.control(n));
    if (unknown) return this.unknownControl(unknown);
    const values = names ? Object.fromEntries(Object.entries(this.doc.values).filter(([k]) => !names.includes(k))) : {};
    this.commit("Reset values", { ...this.doc, values });
    return ok;
  }

  /** Random values in each control's range (colours anywhere), for exploring. */
  randomize(names?: readonly string[], random: () => number = Math.random): EditResult {
    const values: Record<string, ControlValue> = {};
    for (const control of this.controls) {
      if (names ? !names.includes(control.name) : control.type === "sampler2D") continue;
      const pick = () => {
        const v = control.min + random() * (control.max - control.min);
        return control.type === "int" ? Math.round(v) : +v.toFixed(3);
      };
      if (control.type === "bool") values[control.name] = random() < 0.5;
      else if (control.type === "sampler2D") continue;
      else if (control.color) values[control.name] = Array.from({ length: control.type === "vec4" ? 4 : 3 }, () => +random().toFixed(3));
      else if (control.type === "float" || control.type === "int") values[control.name] = pick();
      else values[control.name] = Array.from({ length: Number(control.type.slice(3)) }, pick);
    }
    return this.setValues(values);
  }

  // ── Presets ─────────────────────────────────────────────────────────

  applyPreset(name: string): EditResult {
    const preset = this.doc.presets.find((p) => p.name === name);
    if (!preset) return fail(`There is no preset "${name}"; there are ${this.doc.presets.map((p) => `"${p.name}"`).join(", ") || "none"}.`);
    this.commit(`Apply ${name}`, { ...this.doc, values: { ...this.doc.values, ...preset.values } });
    return ok;
  }

  /** Saves the current values (all, or the named ones) as a preset, replacing one of the same name. */
  savePreset(name: string, names?: readonly string[]): EditResult {
    if (!name.trim()) return fail("A preset needs a name.");
    const all = valuesAt(this.doc, this.time, this.controls);
    const values = Object.fromEntries(Object.entries(all).filter(([k]) => (names ? names.includes(k) : true)));
    const presets = [...this.doc.presets.filter((p) => p.name !== name), { name: name.trim(), values }];
    this.commit(`Save preset ${name}`, { ...this.doc, presets });
    return ok;
  }

  deletePreset(name: string): EditResult {
    if (!this.doc.presets.some((p) => p.name === name)) return fail(`There is no preset "${name}".`);
    this.commit(`Delete preset ${name}`, { ...this.doc, presets: this.doc.presets.filter((p) => p.name !== name) });
    return ok;
  }

  // ── Keyframes ───────────────────────────────────────────────────────

  /** Sets (or replaces) a keyframe; `value` defaults to the control's value at that time. */
  setKeyframe(name: string, time: number, value?: unknown, easing?: Easing, mergeKey?: string): EditResult {
    const control = this.control(name);
    if (!control) return this.unknownControl(name);
    if (!(time >= 0)) return fail("A keyframe's time is 0 ms or more.");
    if (easing !== undefined && !isEasing(easing)) return fail(`Unknown easing ${JSON.stringify(easing)}.`);
    let v: ControlValue;
    if (value === undefined) v = valuesAt(this.doc, time, [control])[name]!;
    else {
      const check = checkControlValue(control, value);
      if (!check.ok) return fail(check.message);
      v = check.value;
    }
    const track = this.doc.tracks[name];
    const existing = track?.keyframes.find((k) => Math.abs(k.time - time) < 1e-3);
    const keyframe: Keyframe = { time, value: v, ...((easing ?? existing?.easing) !== undefined && { easing: easing ?? existing?.easing }) };
    const keyframes = normalizeKeyframes([...(track?.keyframes ?? []), keyframe]);
    this.commit(`Keyframe ${control.label}`, { ...this.doc, tracks: { ...this.doc.tracks, [name]: { ...track, keyframes } } }, mergeKey);
    return ok;
  }

  removeKeyframe(name: string, time: number): EditResult {
    const track = this.doc.tracks[name];
    const keyframes = track?.keyframes.filter((k) => Math.abs(k.time - time) >= 1e-3);
    if (!track || keyframes!.length === track.keyframes.length) return fail(`"${name}" has no keyframe at ${time} ms.`);
    const tracks = { ...this.doc.tracks };
    if (keyframes!.length) tracks[name] = { ...track, keyframes: keyframes! };
    else delete tracks[name];
    this.commit("Delete keyframe", { ...this.doc, tracks });
    return ok;
  }

  setKeyframeEasing(name: string, time: number, easing: Easing): EditResult {
    if (!isEasing(easing)) return fail(`Unknown easing ${JSON.stringify(easing)}.`);
    const track = this.doc.tracks[name];
    if (!track?.keyframes.some((k) => Math.abs(k.time - time) < 1e-3)) return fail(`"${name}" has no keyframe at ${time} ms.`);
    const keyframes = track.keyframes.map((k) => (Math.abs(k.time - time) < 1e-3 ? { ...k, easing } : k));
    this.commit("Set easing", { ...this.doc, tracks: { ...this.doc.tracks, [name]: { ...track, keyframes } } });
    return ok;
  }

  /** Removes a control's track; it keeps the value it had at the playhead. */
  clearTrack(name: string): EditResult {
    if (!this.doc.tracks[name]) return fail(`"${name}" has no keyframes.`);
    const control = this.control(name);
    const value = control ? evaluateTrack(this.doc.tracks[name], this.time, control) : undefined;
    const tracks = { ...this.doc.tracks };
    delete tracks[name];
    const values = value === undefined ? this.doc.values : { ...this.doc.values, [name]: value };
    this.commit("Clear keyframes", { ...this.doc, tracks, values });
    return ok;
  }

  /**
   * Replaces a control's whole track (or removes it with `undefined`), one
   * undo step. Every keyframe is checked like `setKeyframe`; values may be
   * any form the control accepts (colours as "#RRGGBB" too).
   */
  setTrack(name: string, track: { keyframes: readonly { time: number; value: unknown; easing?: unknown }[]; enabled?: boolean } | undefined): EditResult {
    const control = this.control(name);
    if (!control) return this.unknownControl(name);
    const tracks = { ...this.doc.tracks };
    if (!track || track.keyframes.length === 0) {
      if (!tracks[name]) return ok;
      delete tracks[name];
      this.commit("Clear keyframes", { ...this.doc, tracks });
      return ok;
    }
    const keyframes: Keyframe[] = [];
    for (const k of track.keyframes) {
      if (!(k.time >= 0)) return fail("A keyframe's time is 0 ms or more.");
      if (k.easing !== undefined && !isEasing(k.easing)) return fail(`Unknown easing ${JSON.stringify(k.easing)}.`);
      const check = checkControlValue(control, k.value);
      if (!check.ok) return fail(`At ${k.time} ms: ${check.message}`);
      keyframes.push({ time: k.time, value: check.value, ...(k.easing !== undefined && { easing: k.easing as Easing }) });
    }
    tracks[name] = { keyframes: normalizeKeyframes(keyframes), ...(track.enabled === false && { enabled: false }) };
    this.commit(`Keyframes ${control.label}`, { ...this.doc, tracks });
    return ok;
  }

  setTiming(timing: { duration?: number; loop?: boolean }): EditResult {
    if (timing.duration !== undefined && !(timing.duration > 0)) return fail("The duration must be above 0 ms.");
    this.commit("Set timing", { ...this.doc, duration: timing.duration ?? this.doc.duration, loop: timing.loop ?? this.doc.loop });
    return ok;
  }

  // ── Playhead ────────────────────────────────────────────────────────

  play(): void {
    if (this.playing || this.disposed) return;
    if (!this.doc.loop && this.time >= this.doc.duration) this.time = 0;
    this.playing = true;
    this.changed();
    void this.run();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.changed();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Moves the playhead (clamped to the timeline). */
  seek(time: number): void {
    const t = Math.min(Math.max(0, time), this.doc.duration);
    if (t === this.time) return;
    this.time = t;
    this.changed();
  }

  stop(): void {
    this.playing = false;
    this.time = 0;
    this.changed();
  }

  /** While recording, changing a value keyframes it at the playhead. */
  setRecording(recording: boolean): void {
    if (recording === this.recording) return;
    this.recording = recording;
    this.changed();
  }

  undo(): boolean {
    return this.history.undo();
  }

  redo(): boolean {
    return this.history.redo();
  }

  dispose(): void {
    this.disposed = true;
    this.playing = false;
    this.unsubscribeHistory();
    this.listeners.clear();
  }

  // ── Internals ───────────────────────────────────────────────────────

  private async run(): Promise<void> {
    let last = this.clock.now();
    while (this.playing && !this.disposed) {
      await this.clock.frame();
      if (!this.playing || this.disposed) return;
      const now = this.clock.now();
      let next = this.time + (now - last);
      last = now;
      if (next >= this.doc.duration) {
        if (this.doc.loop) next %= this.doc.duration;
        else {
          this.time = this.doc.duration;
          this.playing = false;
          this.changed();
          return;
        }
      }
      this.time = next;
      this.changed();
    }
  }

  private analysis() {
    if (this.controlsCache?.doc !== this.doc) {
      this.controlsCache = { doc: this.doc, controls: documentControls(this.doc), issues: documentIssues(this.doc) };
    }
    return this.controlsCache;
  }

  private control(name: string): ControlDef | undefined {
    return this.controls.find((c) => c.name === name);
  }

  private unknownControl(name: string): EditResult {
    return fail(`There is no control "${name}"; the controls are ${this.controls.map((c) => c.name).join(", ") || "none"}.`);
  }

  private commit(label: string, next: EffectDocument, mergeKey?: string): void {
    const before = this.doc;
    const command = HistoryManager.createSnapshotCommand<EffectDocument>({
      name: label,
      before,
      after: next,
      apply: (doc) => {
        this.doc = doc;
        if (this.time > doc.duration) this.time = doc.duration;
        this.changed();
      },
      tag: mergeKey,
    });
    if (mergeKey) this.history.executeMerged(command, { key: mergeKey, windowMs: this.mergeWindowMs });
    else this.history.execute(command);
  }

  private changed(): void {
    this.state = null;
    if (this.listeners.size === 0) return;
    const state = this.getState();
    for (const listener of [...this.listeners]) listener(state);
  }
}

/** A new {@link EffectEditor}. */
export function createEffectEditor(options: EffectEditorOptions = {}): EffectEditor {
  return new EffectEditor(options);
}
