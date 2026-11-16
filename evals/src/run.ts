import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EffectDefinition } from "@pixerate/flair/catalog";
import { draftControls, passRate, requirementChecks, validityChecks } from "./check.ts";
import { overChecker, pick, strip } from "./frames.ts";
import { judge, judgeParts, judgeScore } from "./judge.ts";
import { content, coverage, frameLikeness, isAnimated, similarity } from "./metrics.ts";
import { feedbackMessage, parseAnswer, systemPrompt, taskMessage, type ReferenceView } from "./prompt.ts";
import { DEFAULT_TEXT, loadReference, renderForTask, renderPicture, TEST_PICTURES, type Reference, type RenderOptions } from "./render.ts";
import { taskExpectations } from "./tasks.ts";
import { FatalModelError, KIND_OF_TYPE, type Check, type DraftEffect, type EvalTask, type Frames, type Model, type ModelMessage, type RenderResult, type SampleResult } from "./types.ts";

export interface RunContext {
  model: Model;
  judge?: Model;
  /** Results go here: `answers/` (replayable), `samples/<task>/<n>/`, `references/<task>/`. */
  out: string;
  /** Most turns a draft gets, counting the first (default 3). */
  turns?: number;
  /** Skip rendering (no Chrome): only the static checks run. */
  noRender?: boolean;
  render?: RenderOptions;
  log?: (line: string) => void;
}

/** A reference task's frames, rendered once and shared by its samples. */
interface PreparedReference {
  reference: Reference;
  view: ReferenceView;
  /** Frames as the model and the judge see them (overlays over a checkerboard). */
  shown: Frames;
}

const references = new Map<string, Promise<PreparedReference>>();

/** Renders (once per run folder) what a reference task shows the model. */
export function prepareReference(task: EvalTask, ctx: RunContext): Promise<PreparedReference> {
  const key = `${ctx.out}\0${task.id}`;
  let ready = references.get(key);
  if (!ready) {
    ready = (async () => {
      const dir = path.join(ctx.out, "references", task.id);
      mkdirSync(dir, { recursive: true });
      const reference = await loadReference(task, dir, ctx.render);
      const overlay = task.type === "overlay";
      const shown = overlay ? overChecker(reference.frames) : reference.frames;
      const png = strip(pick(shown, task.reference?.frames ?? 6));
      writeFileSync(path.join(dir, "reference.png"), png);
      const inputs: { label: string; png: Buffer }[] = [];
      const { width, height } = reference.frames;
      if (task.type === "filter" && task.reference?.effect) inputs.push({ label: "The picture it was applied to:", png: strip(await renderPicture(TEST_PICTURES.photo, dir, width, height)) });
      if (task.type === "transition" && task.reference?.effect) {
        inputs.push({ label: "The picture it starts from (uFrom):", png: strip(await renderPicture(TEST_PICTURES.from, dir, width, height)) });
        inputs.push({ label: "The picture it ends on (uTo):", png: strip(await renderPicture(TEST_PICTURES.to, dir, width, height)) });
      }
      const view: ReferenceView = {
        strip: png,
        frames: shown.data.length,
        seconds: task.type === "transition" ? 0 : reference.seconds,
        inputs,
        text: KIND_OF_TYPE[task.type] === "vector" && task.reference?.effect ? (task.reference.text ?? DEFAULT_TEXT) : task.reference?.text,
        overChecker: overlay,
      };
      return { reference, view, shown };
    })();
    references.set(key, ready);
  }
  return ready;
}

/** What a rendered draft shows that any person looking would notice: nothing drawn. Sent back to the model. */
function renderProblems(task: EvalTask, render: RenderResult): string[] {
  if (!render.ok) return [`It does not render: ${render.error}`];
  const blank = task.type === "overlay" ? coverage(render.frames) < 0.0005 : content(render.frames) < 0.002;
  return blank ? [task.type === "overlay" ? "It renders nothing: alpha is 0 everywhere in every frame." : "It renders nothing: every frame is one flat colour."] : [];
}

/** Requirements only a render shows. */
function renderChecks(task: EvalTask, render: RenderResult): Check[] {
  const checks: Check[] = [];
  const expect = taskExpectations(task);
  if (!render.ok) return [{ name: "renders", pass: false, detail: render.error }];
  checks.push({ name: "draws something", pass: renderProblems(task, render).length === 0 });
  if (expect.animated) checks.push({ name: "moves", pass: isAnimated(render.frames) });
  if (task.type === "overlay") {
    const c = coverage(render.frames);
    checks.push({ name: "leaves the picture under it visible", pass: c > 0.0005 && c < 0.95, detail: `covers ${(c * 100).toFixed(1)}%` });
  }
  if (render.transition) {
    const { at0, mid, at1, from, to } = render.transition;
    checks.push({ name: "progress 0 shows uFrom", pass: frameLikeness(at0, from) > frameLikeness(at0, to) && frameLikeness(at0, from) > 0.9 });
    checks.push({ name: "progress 1 shows uTo", pass: frameLikeness(at1, to) > frameLikeness(at1, from) && frameLikeness(at1, to) > 0.9 });
    checks.push({ name: "halfway is between", pass: frameLikeness(mid, from) < 0.985 && frameLikeness(mid, to) < 0.985 });
  }
  return checks;
}

function controlList(effect: DraftEffect): string {
  const read = draftControls(effect);
  if ("error" in read) return `(unreadable: ${read.error})`;
  if (!read.controls.length) return "(none)";
  return read.controls
    .map((c) => {
      const range = c.limits ? ` ${c.limits.min ?? ""}–${c.limits.max ?? ""}` : "";
      const def = typeof c.default === "string" && c.default.startsWith("data:") ? "picture" : JSON.stringify(c.default);
      return `- ${c.name}: ${c.color ? "colour" : c.type}${range}, default ${def}${c.label ? `, "${c.label}"` : ""}`;
    })
    .join("\n");
}

/** Drafts, checks, renders, repairs and grades one sample of one task. */
export async function runSample(task: EvalTask, sample: number, ctx: RunContext): Promise<SampleResult> {
  const kind = KIND_OF_TYPE[task.type];
  const dir = path.join(ctx.out, "samples", task.id, String(sample));
  mkdirSync(dir, { recursive: true });
  const answers = path.join(ctx.out, "answers");
  const maxTurns = Math.max(1, ctx.turns ?? 3);
  const usage = { input: 0, output: 0 };
  const ms = { generate: 0, render: 0 };
  const base = { task: task.id, type: task.type, kind, mode: task.mode, sample, model: ctx.model.name, dir };
  const log = ctx.log ?? (() => {});

  let prepared: PreparedReference | undefined;
  try {
    if (task.mode === "reference") prepared = await prepareReference(task, ctx);
  } catch (e) {
    return { ...base, turns: 0, firstTry: false, checks: [], scores: {}, overall: 0, usage, ms, error: `The reference could not be prepared: ${(e as Error).message}` };
  }

  const system = systemPrompt();
  const messages: ModelMessage[] = [{ role: "user", content: taskMessage(task, prepared?.view) }];
  let draft: DraftEffect | undefined;
  let render: RenderResult | undefined;
  let turns = 0;
  let firstTry = false;
  let error: string | undefined;
  const transcript: string[] = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    turns = turn;
    const key = `${task.id}/${sample}/turn-${turn}`;
    const started = Date.now();
    error = undefined;
    let text: string;
    try {
      const response = await ctx.model.generate({ system, messages, key });
      text = response.text;
      usage.input += response.usage?.input ?? 0;
      usage.output += response.usage?.output ?? 0;
      if (response.stop === "refusal") error = "The model refused.";
      if (response.stop === "max_tokens") error = "The answer was cut off at max_tokens.";
    } catch (e) {
      if (e instanceof FatalModelError) throw e;
      error = `The model call failed: ${(e as Error).message}`;
      break;
    } finally {
      ms.generate += Date.now() - started;
    }
    mkdirSync(path.dirname(path.join(answers, key)), { recursive: true });
    writeFileSync(path.join(answers, `${key}.md`), text);
    transcript.push(`## Turn ${turn}\n\n${text}`);

    const parsed = parseAnswer(text, kind);
    let problems: string[];
    if ("error" in parsed) {
      problems = [parsed.error];
    } else {
      draft = parsed.effect;
      problems = validityChecks(draft)
        .filter((c) => !c.pass)
        .map((c) => c.detail ?? c.name);
      if (!ctx.noRender && problems.length === 0) {
        render = await renderForTask(task, draft as unknown as EffectDefinition, dir, { ...ctx.render, text: task.reference?.text });
        ms.render += render.ms;
        problems.push(...renderProblems(task, render));
      } else render = undefined;
    }
    log(`  ${task.id}#${sample} turn ${turn}: ${problems.length ? `${problems.length} problem(s)` : "clean"}`);
    if (!problems.length) {
      firstTry = turn === 1;
      break;
    }
    transcript.push(`### Problems\n\n${problems.map((p) => `- ${p}`).join("\n")}`);
    if (turn < maxTurns) messages.push({ role: "assistant", content: [{ type: "text", text }] }, { role: "user", content: feedbackMessage(problems) });
  }
  writeFileSync(path.join(dir, "transcript.md"), transcript.join("\n\n"));

  if (!draft) return { ...base, turns, firstTry: false, checks: [], scores: {}, overall: 0, usage, ms, error: error ?? "No turn gave a readable effect." };

  writeFileSync(path.join(dir, "effect.json"), JSON.stringify(draft, null, 2));
  if (draft.kind === "shader") writeFileSync(path.join(dir, "effect.frag"), String(draft.source));
  else writeFileSync(path.join(dir, "effect.svg"), String((draft.motion as { svg?: string }).svg ?? ""));

  // Render the last draft even when its static checks failed, so its look can still be graded; a
  // vector picture with issues cannot draw, so it is not tried.
  const drawable = draft.kind === "shader" || validityChecks(draft).every((c) => c.name !== "picture has no issues" || c.pass);
  if (!render && !ctx.noRender && drawable) {
    render = await renderForTask(task, draft as unknown as EffectDefinition, dir, { ...ctx.render, text: task.reference?.text });
    ms.render += render.ms;
  }

  const validity = validityChecks(draft).map((c) => ({ ...c, name: `valid: ${c.name}` }));
  const requirements = [...requirementChecks(task, draft), ...(render ? renderChecks(task, render) : [])].map((c) => ({ ...c, name: `asked: ${c.name}` }));
  const scores: SampleResult["scores"] = { validity: passRate(validity), requirements: passRate(requirements) };
  if (render) scores.render = render.ok ? 1 : 0;

  let judged: SampleResult["judge"];
  let similar: SampleResult["similarity"];
  if (render?.ok) {
    const shown = task.type === "overlay" ? overChecker(render.frames) : render.frames;
    const candidatePng = strip(pick(shown, 6));
    writeFileSync(path.join(dir, "frames.png"), candidatePng);
    if (prepared) {
      // Raw frames: an overlay's alpha weights what counts, so its transparent background does not make every overlay look alike.
      const s = similarity(render.frames, prepared.reference.frames);
      similar = { palette: s.palette, structure: s.structure, motion: s.motion };
      scores.similarity = s.score;
    }
    if (ctx.judge) {
      const key = `judge/${task.id}/${sample}`;
      try {
        const inputs = prepared?.view.inputs ?? [];
        judged = await judge(ctx.judge, key, judgeParts(task, candidatePng, controlList(draft), prepared?.view.strip, inputs));
        scores.judge = judgeScore(judged);
        mkdirSync(path.join(answers, "judge", task.id), { recursive: true });
        writeFileSync(path.join(answers, `${key}.md`), JSON.stringify(judged));
      } catch (e) {
        if (e instanceof FatalModelError) throw e;
        error = `The judge failed: ${(e as Error).message}`;
      }
    }
  }

  const overall = overallScore(scores, render?.ok ?? false, ctx.noRender ?? false);
  const result: SampleResult = { ...base, turns, firstTry, checks: [...validity, ...requirements], scores, overall, ...(judged && { judge: judged }), ...(similar && { similarity: similar }), usage, ms, ...(error && { error }) };
  writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
  return result;
}

/**
 * One score, 0 to 100: validity 15%, requirements 25%, rendering 15%, and the look 45% (the judge,
 * or the frame similarity for reference tasks without a judge; both when there are both, 30/15).
 * Missing areas are left out and the rest scaled up; a draft that does not render scores at most 20.
 */
export function overallScore(scores: SampleResult["scores"], rendered: boolean, noRender: boolean): number {
  const parts: [number | undefined, number][] = [
    [scores.validity, 0.15],
    [scores.requirements, 0.25],
    [scores.render, 0.15],
  ];
  if (scores.judge !== undefined && scores.similarity !== undefined) parts.push([scores.judge, 0.3], [scores.similarity, 0.15]);
  else parts.push([scores.judge ?? scores.similarity, 0.45]);
  const present = parts.filter(([v]) => v !== undefined) as [number, number][];
  const weight = present.reduce((s, [, w]) => s + w, 0);
  const score = weight ? (100 * present.reduce((s, [v, w]) => s + v * w, 0)) / weight : 0;
  return Math.round(!noRender && !rendered ? Math.min(score, 20) : score);
}

/** Runs every task `samples` times, `concurrency` at once. */
export async function runAll(tasks: readonly EvalTask[], samples: number, concurrency: number, ctx: RunContext): Promise<SampleResult[]> {
  const jobs = tasks.flatMap((task) => Array.from({ length: samples }, (_, i) => ({ task, sample: i + 1 })));
  const results: SampleResult[] = new Array(jobs.length);
  let next = 0;
  let stopped = false;
  const log = ctx.log ?? (() => {});
  async function worker() {
    while (next < jobs.length && !stopped) {
      const n = next++;
      const { task, sample } = jobs[n]!;
      log(`${task.id}#${sample} (${task.mode}, ${task.type})…`);
      try {
        results[n] = await runSample(task, sample, ctx);
      } catch (e) {
        stopped = true;
        throw e;
      }
      log(`${task.id}#${sample}: ${results[n]!.overall}/100${results[n]!.error ? ` (${results[n]!.error})` : ""}`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker));
  return results;
}
