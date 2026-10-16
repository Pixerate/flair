/**
 * The effect editor's commands. Menus, shortcuts, a command palette and
 * agents (through `createCommandToolProvider`) all run these by id, so every
 * entry point shares the same checks and undo steps.
 */

import type { CommandSpec } from "@pixerate/editor/commands";
import { EFFECT_CATEGORIES, VIDEO_USES, type VideoUse } from "../catalog/types.js";
import { findEffects } from "../catalog/index.js";
import type { EditResult, EffectEditor } from "./editor.js";
import { EASING_PRESETS, type Easing } from "./timeline.js";

/** Throws the refusal, so the command registry reports it as a failed command with its message. */
function done(result: EditResult): { ok: true } {
  if (!result.ok) throw new Error(result.message);
  return result;
}

const easingSchema = {
  description: `An easing preset (${EASING_PRESETS.join(", ")}) or {"type":"cubic-bezier","x1","y1","x2","y2"} or {"type":"spring","stiffness","damping","mass"}.`,
} as const;

const valueSchema = {
  description:
    'A control value: a number (float, int), true/false (bool), an array of numbers (vec2–vec4; colours 0–1), a "#RRGGBB" colour, an image URL (sampler2D), or a string (text).',
} as const;

/** A summary of the editor's state for agents: the document, controls, values at the playhead, issues and compile errors. */
export function describeEditor(editor: EffectEditor) {
  const state = editor.getState();
  const doc = state.document;
  return {
    name: doc.name,
    basedOn: doc.basedOn,
    kind: doc.effect.kind,
    ...(doc.effect.kind === "shader" ? { source: doc.effect.source } : { motion: doc.effect.motion, ...(doc.effect.controls && { vectorControls: doc.effect.controls }) }),
    controls: state.controls.map((c) => ({
      name: c.name,
      type: c.type,
      label: c.label,
      ...(c.color && { color: true }),
      ...(c.type !== "bool" && c.type !== "sampler2D" && c.type !== "text" && { min: c.min, max: c.max, step: c.step }),
      default: c.default,
    })),
    values: state.values,
    tracks: doc.tracks,
    presets: doc.presets.map((p) => p.name),
    timeline: { duration: doc.duration, loop: doc.loop, time: state.time, playing: state.playing, recording: state.recording },
    issues: state.issues,
    compile: state.compile,
    history: { canUndo: state.history.canUndo, canRedo: state.history.canRedo },
  };
}

/** The effect editor's commands (the registry adds `history.undo` / `history.redo`). */
export function effectCommands(): CommandSpec<EffectEditor>[] {
  return [
    {
      id: "effect.describe",
      label: "Describe effect",
      group: "Effect",
      description: "The effect being edited: its source (or picture), controls, values at the playhead, keyframes, presets, timeline, issues and compile errors.",
      readOnly: true,
      run: (editor) => describeEditor(editor),
    },
    {
      id: "catalog.search",
      label: "Search effects",
      group: "Catalog",
      description: "Searches the built-in effect catalog. Load one with effect.load to start from it.",
      readOnly: true,
      params: {
        type: "object",
        properties: {
          text: { type: "string", description: "Words to look for (all must match)." },
          category: { type: "string", enum: EFFECT_CATEGORIES },
          kind: { type: "string", enum: ["shader", "vector"] },
          video: {
            type: "array",
            items: { type: "string", enum: VIDEO_USES },
            description: "Only effects that suit video in one of these ways: filter (live video filter), transition (between two clips), interactive (pointer over video), stills (runs on video, made for stills), none.",
          },
        },
        additionalProperties: false,
      },
      run: (_, params: { text?: string; category?: (typeof EFFECT_CATEGORIES)[number]; kind?: "shader" | "vector"; video?: VideoUse[] }) =>
        findEffects(params ?? {}).map((e) => ({
          id: e.id,
          name: e.name,
          kind: e.kind,
          category: e.category,
          description: e.description,
          ...(e.kind === "shader" && e.video ? { video: e.video } : {}),
          presets: e.presets?.map((p) => p.name) ?? [],
        })),
    },
    {
      id: "effect.load",
      label: "Load effect",
      group: "Effect",
      description: "Starts over from a catalog effect (by id, optionally with one of its presets), or from a shader's source.",
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "A catalog effect id (see catalog.search)." },
          preset: { type: "string" },
          source: { type: "string", description: "A shader source to start from instead of a catalog effect." },
          name: { type: "string" },
        },
        additionalProperties: false,
      },
      run: (editor, p: { id?: string; preset?: string; source?: string; name?: string }) =>
        done(p?.source !== undefined ? editor.load({ source: p.source, name: p.name }) : editor.load(p?.id, p?.preset)),
    },
    {
      id: "effect.setSource",
      label: "Set shader source",
      group: "Effect",
      description:
        "Replaces the shader's GLSL ES 3.00 source (Shadertoy-style mainImage; controls are uniforms annotated `// @control`). Compile errors show up in effect.describe once the preview has compiled it.",
      params: { type: "object", properties: { source: { type: "string" } }, required: ["source"], additionalProperties: false },
      run: (editor, p: { source: string }) => done(editor.setSource(p.source)),
    },
    {
      id: "effect.rename",
      label: "Rename effect",
      group: "Effect",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.rename(p.name)),
    },
    {
      id: "values.set",
      label: "Set values",
      group: "Values",
      description: "Sets control values by name, all or nothing. A keyframed control (or any, while recording) gets a keyframe at the playhead instead.",
      params: {
        type: "object",
        properties: { values: { type: "object", additionalProperties: valueSchema, description: "Control name → value." } },
        required: ["values"],
        additionalProperties: false,
      },
      run: (editor, p: { values: Record<string, unknown> }) => done(editor.setValues(p.values)),
    },
    {
      id: "values.reset",
      label: "Reset values",
      group: "Values",
      description: "Puts controls back to their defaults: the named ones, or all.",
      params: { type: "object", properties: { names: { type: "array", items: { type: "string" } } }, additionalProperties: false },
      run: (editor, p: { names?: string[] }) => done(editor.resetValues(p?.names)),
    },
    {
      id: "values.randomize",
      label: "Randomize values",
      group: "Values",
      keywords: ["shuffle", "surprise", "explore"],
      params: { type: "object", properties: { names: { type: "array", items: { type: "string" } } }, additionalProperties: false },
      run: (editor, p: { names?: string[] }) => done(editor.randomize(p?.names)),
    },
    {
      id: "preset.apply",
      label: "Apply preset",
      group: "Presets",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.applyPreset(p.name)),
    },
    {
      id: "preset.save",
      label: "Save preset",
      group: "Presets",
      description: "Saves the values at the playhead (all, or the named controls) as a preset.",
      params: {
        type: "object",
        properties: { name: { type: "string" }, names: { type: "array", items: { type: "string" } } },
        required: ["name"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; names?: string[] }) => done(editor.savePreset(p.name, p.names)),
    },
    {
      id: "preset.delete",
      label: "Delete preset",
      group: "Presets",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.deletePreset(p.name)),
    },
    {
      id: "keyframe.set",
      label: "Set keyframe",
      group: "Keyframes",
      description: "Keyframes a control at a time (ms). Without a value, keyframes its current value there. The easing shapes the segment leaving this keyframe.",
      params: {
        type: "object",
        properties: { name: { type: "string" }, time: { type: "number", minimum: 0 }, value: valueSchema, easing: easingSchema },
        required: ["name", "time"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; time: number; value?: unknown; easing?: Easing }) => done(editor.setKeyframe(p.name, p.time, p.value, p.easing)),
    },
    {
      id: "keyframe.remove",
      label: "Delete keyframe",
      group: "Keyframes",
      params: { type: "object", properties: { name: { type: "string" }, time: { type: "number" } }, required: ["name", "time"], additionalProperties: false },
      run: (editor, p: { name: string; time: number }) => done(editor.removeKeyframe(p.name, p.time)),
    },
    {
      id: "keyframe.setEasing",
      label: "Set keyframe easing",
      group: "Keyframes",
      params: {
        type: "object",
        properties: { name: { type: "string" }, time: { type: "number" }, easing: easingSchema },
        required: ["name", "time", "easing"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; time: number; easing: Easing }) => done(editor.setKeyframeEasing(p.name, p.time, p.easing)),
    },
    {
      id: "keyframe.setTrack",
      label: "Set keyframes",
      group: "Keyframes",
      description: "Replaces all of a control's keyframes at once (an empty list removes them). Times are ms; each easing shapes the segment leaving its keyframe.",
      params: {
        type: "object",
        properties: {
          name: { type: "string" },
          keyframes: {
            type: "array",
            items: {
              type: "object",
              properties: { time: { type: "number", minimum: 0 }, value: valueSchema, easing: easingSchema },
              required: ["time", "value"],
            },
          },
        },
        required: ["name", "keyframes"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; keyframes: { time: number; value: unknown; easing?: unknown }[] }) => done(editor.setTrack(p.name, { keyframes: p.keyframes })),
    },
    {
      id: "keyframe.clear",
      label: "Clear keyframes",
      group: "Keyframes",
      description: "Removes a control's keyframes; it keeps the value it has at the playhead.",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.clearTrack(p.name)),
    },
    {
      id: "timeline.setTiming",
      label: "Set timing",
      group: "Timeline",
      params: {
        type: "object",
        properties: { duration: { type: "number", exclusiveMinimum: 0, description: "Ms." }, loop: { type: "boolean" } },
        additionalProperties: false,
      },
      run: (editor, p: { duration?: number; loop?: boolean }) => done(editor.setTiming(p ?? {})),
    },
    {
      id: "timeline.play",
      label: "Play",
      group: "Timeline",
      run: (editor) => editor.play(),
    },
    {
      id: "timeline.pause",
      label: "Pause",
      group: "Timeline",
      run: (editor) => editor.pause(),
    },
    {
      id: "timeline.toggle",
      label: "Play / pause",
      group: "Timeline",
      shortcut: "Space",
      run: (editor) => editor.toggle(),
    },
    {
      id: "timeline.seek",
      label: "Go to time",
      group: "Timeline",
      params: { type: "object", properties: { time: { type: "number", minimum: 0, description: "Ms." } }, required: ["time"], additionalProperties: false },
      run: (editor, p: { time: number }) => editor.seek(p.time),
    },
    {
      id: "timeline.stop",
      label: "Stop",
      group: "Timeline",
      run: (editor) => editor.stop(),
    },
    {
      id: "timeline.toggleRecording",
      label: "Record keyframes",
      group: "Timeline",
      description: "While recording, changing a value keyframes it at the playhead.",
      run: (editor) => editor.setRecording(!editor.getState().recording),
    },
  ];
}
