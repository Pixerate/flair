import { checkControlValue, controlValue, type ControlDef, type ControlValue } from "../shader/controls.js";
import { vectorControlDef, type VectorControl } from "./types.js";

/*
 * Controls written as a list, as camera moves and timing effects declare
 * them (not `// @control` uniforms), and their values. Kept apart from the
 * effects themselves, so code that checks values carries none of them.
 */

/** An effect's listed controls, as `effectControls` gives them. */
export function listedControls(effect: { controls: readonly VectorControl[] }): ControlDef[] {
  return effect.controls.map((c, i) => vectorControlDef(c, i + 1));
}

/**
 * An effect's values from its listed controls: each control's default,
 * overridden by a preset (by name) and then `values`. Problems are
 * sentences: an unknown preset or control, or a value of the wrong type or
 * out of range (left at its default).
 */
export function listedValues(
  effect: { id: string; presets?: readonly { name: string; values: Record<string, ControlValue> }[]; controls: readonly VectorControl[] },
  options: { preset?: string; values?: Readonly<Record<string, unknown>> } = {},
): { values: Record<string, ControlValue>; issues: string[] } {
  const issues: string[] = [];
  const controls = listedControls(effect);
  let preset: Record<string, ControlValue> | undefined;
  if (options.preset !== undefined) {
    preset = effect.presets?.find((p) => p.name === options.preset)?.values;
    if (!preset) {
      const names = (effect.presets ?? []).map((p) => `"${p.name}"`).join(", ");
      issues.push(`"${effect.id}" has no preset "${options.preset}"; ${names ? `its presets are ${names}` : "it has none"}.`);
    }
  }
  const given: Record<string, ControlValue> = {};
  for (const [name, value] of Object.entries(options.values ?? {})) {
    const control = controls.find((c) => c.name === name);
    if (!control) {
      issues.push(`"${effect.id}" has no control "${name}"; ${controls.length ? `its controls are ${controls.map((c) => c.name).join(", ")}` : "it has none"}.`);
      continue;
    }
    const check = checkControlValue(control, value as ControlValue);
    if (check.ok) given[name] = check.value;
    else issues.push(`"${effect.id}": ${check.message}`);
  }
  const merged = { ...preset, ...given };
  return { values: Object.fromEntries(controls.map((c) => [c.name, controlValue(c, merged)])), issues };
}
