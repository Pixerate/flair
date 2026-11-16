import { BUILTIN_UNIFORMS, checkControlValue, parseControls, svgMotionIssues, type ControlDef } from "@pixerate/flair";
import { EFFECT_CATEGORIES, effectControls, effectDefaults, renderVectorEffect, vectorControlIssues, type EffectDefinition } from "@pixerate/flair/catalog";
import { taskExpectations } from "./tasks.ts";
import { KIND_OF_TYPE, type Check, type DraftEffect, type EvalTask } from "./types.ts";

const BUILTINS = new Set<string>(BUILTIN_UNIFORMS.map((u) => u.name));
const POINTER = /\b(iPointer|iMouse|iClicks|iTrail)\b/;

/** The draft's controls, or the reason they cannot be read. */
export function draftControls(effect: DraftEffect): { controls: ControlDef[] } | { error: string } {
  try {
    return { controls: effectControls(effect as unknown as EffectDefinition) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** GLSL without comments, so checks read only code. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Checks any tool would make, as `flair controls`, the catalog's tests and `svgMotionIssues` do: a
 * well-formed definition, every uniform a control, presets that fit, a picture that can draw. Their
 * failures are sent back to the model.
 */
export function validityChecks(effect: DraftEffect): Check[] {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail && !pass && { detail }) });
  add("id is kebab-case", typeof effect.id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(effect.id), `id "${String(effect.id)}" must be kebab-case, like "my-effect"`);
  add("name is set", typeof effect.name === "string" && effect.name.trim() !== "", "name must be a non-empty string");
  add("description is set", typeof effect.description === "string" && effect.description.trim() !== "", "description must be one sentence saying what it looks like");
  add("category is known", EFFECT_CATEGORIES.includes(effect.category as never), `category "${String(effect.category)}" is not one of EFFECT_CATEGORIES (${EFFECT_CATEGORIES.join(", ")})`);
  add("tags are strings", Array.isArray(effect.tags) && effect.tags.every((t) => typeof t === "string"), "tags must be an array of strings");

  if (effect.kind === "shader") {
    const source = String(effect.source ?? "");
    const body = code(source);
    add("defines mainImage", /void\s+mainImage\s*\(/.test(body), "the source must define void mainImage(out vec4 fragColor, in vec2 fragCoord)");
    add("no wrapper code", !/#version|\bprecision\s+\w+p\s+float|void\s+main\s*\(/.test(body), "do not write #version, precision or main(): the wrapper adds them");
    let declared: ControlDef[] = [];
    try {
      declared = parseControls(source);
      add("controls parse", true);
    } catch (e) {
      add("controls parse", false, (e as Error).message);
    }
    const names = new Set(declared.map((c) => c.name));
    const uniforms = [...body.matchAll(/\buniform\s+\w+\s+(\w+)/g)].map((m) => m[1]!);
    const redeclared = uniforms.filter((u) => BUILTINS.has(u));
    add("built-ins not redeclared", redeclared.length === 0, `${redeclared.join(", ")} ${redeclared.length > 1 ? "are" : "is a"} built-in uniform${redeclared.length > 1 ? "s" : ""}: delete the declaration`);
    const bare = uniforms.filter((u) => !BUILTINS.has(u) && !names.has(u));
    add("every uniform is a control", bare.length === 0, `${bare.join(", ")} ${bare.length > 1 ? "are uniforms" : "is a uniform"} without // @control on the same line`);
  } else {
    const motion = effect.motion as Parameters<typeof vectorControlIssues>[0];
    let issues: string[] = [];
    try {
      issues = [...vectorControlIssues(motion), ...svgMotionIssues(renderVectorEffect(effect as never, effectDefaults(effect as unknown as EffectDefinition)))];
    } catch (e) {
      issues = [(e as Error).message];
    }
    add("picture has no issues", issues.length === 0, issues.join("; "));
  }

  const read = draftControls(effect);
  if ("error" in read) {
    add("controls read", false, read.error);
    return checks;
  }
  const presetProblems: string[] = [];
  const presets = effect.presets === undefined ? [] : effect.presets;
  if (!Array.isArray(presets)) presetProblems.push("presets must be an array of { name, values }");
  else
    for (const preset of presets as { name?: unknown; values?: Record<string, unknown> }[]) {
      if (typeof preset?.name !== "string") presetProblems.push("every preset needs a name");
      for (const [key, value] of Object.entries(preset?.values ?? {})) {
        const control = read.controls.find((c) => c.name === key);
        if (!control) presetProblems.push(`preset "${String(preset.name)}" sets ${key}, which is not a control`);
        else {
          const result = checkControlValue(control, value);
          if (!result.ok) presetProblems.push(`preset "${String(preset.name)}": ${result.message}`);
        }
      }
    }
  add("presets use declared controls", presetProblems.length === 0, presetProblems.join("; "));
  return checks;
}

/**
 * Whether the draft is what the task asked for, from its definition alone. Not sent back to the
 * model: following the brief is what is being measured.
 */
export function requirementChecks(task: EvalTask, effect: DraftEffect): Check[] {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail && !pass && { detail }) });
  const kind = KIND_OF_TYPE[task.type];
  add(`is a ${kind} effect`, effect.kind === kind);
  const read = draftControls(effect);
  const controls = "controls" in read ? read.controls : [];
  const expect = taskExpectations(task);
  const pictures = controls.filter((c) => c.type === "sampler2D" && !(c as { path?: boolean }).path);
  const source = effect.kind === "shader" ? code(String(effect.source ?? "")) : "";

  if (task.type === "background") add("takes no picture", pictures.length === 0, `has picture controls ${pictures.map((c) => c.name).join(", ")}`);
  if (task.type === "filter") add("takes a picture", pictures.length >= 1);
  if (task.type === "overlay") add("is transparent", effect.transparent === true, "the definition must set transparent: true");
  if (task.type === "transition") {
    const type = (name: string) => controls.find((c) => c.name === name)?.type;
    add("uFrom and uTo are pictures", type("uFrom") === "sampler2D" && type("uTo") === "sampler2D");
    add("uProgress is a float", type("uProgress") === "float");
  }
  if (task.type === "interactive") add("reads the pointer", POINTER.test(source));

  if (expect.minControls) add(`has ${expect.minControls}+ controls`, controls.length >= expect.minControls, `has ${controls.length}`);
  if (expect.minColorControls) {
    const n = controls.filter((c) => c.color).length;
    add(`has ${expect.minColorControls}+ colour controls`, n >= expect.minColorControls, `has ${n}`);
  }
  if (expect.minTextControls) {
    const n = controls.filter((c) => c.type === "text").length;
    add(`has ${expect.minTextControls}+ text controls`, n >= expect.minTextControls, `has ${n}`);
  }
  for (const name of expect.controls ?? []) if (task.type !== "transition") add(`has control ${name}`, controls.some((c) => c.name === name));
  if (expect.trigger) add(`plays on ${expect.trigger}`, effect.trigger === expect.trigger, `trigger is ${String(effect.trigger ?? "unset")}`);
  if (expect.loops) add("loops", effect.trigger === undefined, `has trigger ${String(effect.trigger)}`);
  return checks;
}

/** The share of checks that pass (1 when there are none). */
export function passRate(checks: readonly Check[]): number {
  return checks.length ? checks.filter((c) => c.pass).length / checks.length : 1;
}
