/**
 * An effect's controls as a `@pixerate/editor/parameters` schema, and a
 * parameters controller kept in step with an `EffectEditor`. With them, any
 * parameters UI (the ready-made React and Svelte panels, or your own) edits
 * an effect: values, image picks and keyframe diamonds go through the effect
 * editor, so its undo history and agent tools see every change.
 */

import {
  ParametersController,
  rgba01ToHex,
  type ParameterField,
  type ParameterImageOption,
  type ParameterKeyframes,
  type ParameterSchema,
  type ParameterTrack,
  type ParameterValue,
  type ParameterValues,
} from "@pixerate/editor/parameters";
import type { ControlDef, ControlValue } from "../shader/controls.js";
import type { EffectEditor, EffectEditorState } from "./editor.js";
import type { Track } from "./timeline.js";

export interface EffectParameterOptions {
  /** Pictures image controls offer to pick from (any URL still works). */
  images?: readonly ParameterImageOption[];
  /** Schema title (default: none). */
  title?: string;
}

/** One control as a parameter field. */
export function parameterFieldFor(control: ControlDef, options: EffectParameterOptions = {}): ParameterField {
  const base = { id: control.name, label: control.label };
  switch (control.type) {
    case "bool":
      return { ...base, type: "boolean", default: control.default === true };
    case "int":
      return { ...base, type: "int", min: control.min, max: control.max, step: Math.max(1, Math.round(control.step)), default: Number(control.default) };
    case "float":
      return { ...base, type: "number", min: control.min, max: control.max, step: control.step, default: Number(control.default) };
    case "sampler2D":
      return { ...base, type: "image", default: String(control.default), ...(options.images && { options: options.images }) };
    default: {
      const value = control.default as number[];
      if (control.color) {
        const alpha = control.type === "vec4";
        return { ...base, type: "color", alpha, default: rgba01ToHex(value, alpha) };
      }
      return { ...base, type: "vector", size: value.length as 2 | 3 | 4, min: control.min, max: control.max, step: control.step, default: [...value] };
    }
  }
}

/** An effect's controls as a parameters schema. */
export function parameterSchemaFor(controls: readonly ControlDef[], options: EffectParameterOptions = {}): ParameterSchema {
  return { ...(options.title && { title: options.title }), fields: controls.map((c) => parameterFieldFor(c, options)) };
}

/** A control value as a parameter value: colours become `#rrggbb` (`#rrggbbaa` for `vec4`). */
export function toParameterValue(control: ControlDef, value: ControlValue): ParameterValue {
  if (control.color && Array.isArray(value)) return rgba01ToHex(value, control.type === "vec4");
  return Array.isArray(value) ? [...value] : value;
}

/** Control values as parameter values (see {@link toParameterValue}). */
export function toParameterValues(controls: readonly ControlDef[], values: Record<string, ControlValue>): ParameterValues {
  const out: ParameterValues = {};
  for (const control of controls) if (values[control.name] !== undefined) out[control.name] = toParameterValue(control, values[control.name]!);
  return out;
}

function toParameterTrack(control: ControlDef | undefined, track: Track | undefined): ParameterTrack | undefined {
  if (!track) return undefined;
  return {
    ...(track.enabled === false && { enabled: false }),
    keyframes: track.keyframes.map((k) => ({ ...k, value: control ? toParameterValue(control, k.value) : (k.value as ParameterValue) })),
  };
}

export interface EffectParametersBinding {
  /** Drive a parameters UI with it (e.g. `<ParametersPanel controller={…} />`). */
  readonly controller: ParametersController;
  /** Stops following the editor. */
  dispose(): void;
}

/**
 * A `ParametersController` for the effect in `editor`, kept in step with it:
 * the schema follows the effect's controls (a recompiled shader updates it),
 * values and the playhead follow the editor, and changes made through the
 * controller (fields, keyframe diamonds, reset, randomize) are applied to the
 * editor, which records the undo steps. Use the editor's undo, not the
 * controller's, and its presets (the controller's own presets are not saved).
 */
export function bindEffectParameters(editor: EffectEditor, options: EffectParameterOptions = {}): EffectParametersBinding {
  let state = editor.getState();
  let controls = state.controls;
  let signature = JSON.stringify(controls);
  let syncing = false;
  const byName = () => new Map(controls.map((c) => [c.name, c]));

  const keyframes: ParameterKeyframes = {
    getTrack: (id) => toParameterTrack(byName().get(id), editor.getState().document.tracks[id]),
    setTrack: (id, track) => {
      editor.setTrack(id, track);
    },
    subscribe: (listener) => editor.subscribe(() => listener()),
  };

  const controller = new ParametersController({
    schema: parameterSchemaFor(controls, options),
    values: toParameterValues(controls, state.values),
    time: state.time,
    keyframes,
    onChange: (values, changed) => {
      if (syncing) return;
      const result =
        changed.length === 1
          ? editor.setValue(changed[0]!, values[changed[0]!])
          : editor.setValues(Object.fromEntries(changed.map((id) => [id, values[id]])));
      // A refused change (or one that keyframed instead): show what the editor holds.
      if (!result.ok) sync(editor.getState());
    },
  });

  const sync = (next: EffectEditorState) => {
    state = next;
    const nextSignature = JSON.stringify(next.controls);
    syncing = true;
    try {
      if (nextSignature !== signature) {
        signature = nextSignature;
        controls = next.controls;
        controller.setSchema(parameterSchemaFor(controls, options));
      }
      controller.setTime(next.time, toParameterValues(controls, next.values));
    } finally {
      syncing = false;
    }
  };

  const unsubscribe = editor.subscribe(sync);
  return {
    controller,
    dispose: () => {
      unsubscribe();
      controller.destroy();
    },
  };
}
