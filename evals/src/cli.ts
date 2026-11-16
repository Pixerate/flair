#!/usr/bin/env node
/**
 * Runs the effect-drafting eval: `node src/cli.ts --model anthropic:claude-opus-5-5 --judge anthropic:claude-opus-5-5`.
 * `--help` lists the options.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createModel } from "./models.ts";
import { renderAvailable } from "./render.ts";
import { groups, markdownReport } from "./report.ts";
import { runAll, runSample } from "./run.ts";
import { BUILTIN_TASKS, loadTaskFile, selectTasks } from "./tasks.ts";
import { EFFECT_TYPES, type SampleResult, type TaskMode } from "./types.ts";

const HELP = `Flair effect-drafting eval

  node src/cli.ts --model <spec> [options]

Models (--model, --judge):
  anthropic:<model>[?effort=low|medium|high|xhigh|max]   the Claude API
  command:<shell command>   any model: reads the request JSON on stdin, prints the answer
  replay:<folder>           answers saved by an earlier run (<run>/answers), to re-grade
  oracle                    answers reference tasks with the held-out catalog effect: the ceiling, to calibrate the graders

Options:
  --judge <spec>        a vision model that grades the rendered frames (without one, the look is graded only on reference tasks, by frame similarity)
  --mode <modes>        scratch, reference (comma-separated; default both)
  --type <types>        ${EFFECT_TYPES.join(", ")}
  --task <ids>          only these tasks
  --tasks <file.json>   your own tasks instead of the built-in ones (see tasks/custom.example.json)
  --samples <n>         drafts per task (default 1); more shows variance
  --turns <n>           most turns per draft, counting the first (default 3); the model sees check and compile failures between turns
  --concurrency <n>     samples at once (default 2)
  --frames <n>          frames rendered per sample (default 6)
  --software            draw with software GL: the same frames on every machine
  --no-render           static checks only (no Chrome)
  --out <folder>        where results go (default results/<time>-<model>)
  --redo-errors         with --out naming an earlier run (same --model and --judge): rerun only its samples that ended in an error, and rewrite its results
  --list                list the tasks and exit
`;

function list(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

function int(name: string, value: string | undefined, fallback: number, min: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} takes a whole number of at least ${min}; not "${value}".`);
  return n;
}

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      judge: { type: "string" },
      mode: { type: "string", multiple: true },
      type: { type: "string", multiple: true },
      task: { type: "string", multiple: true },
      tasks: { type: "string" },
      samples: { type: "string" },
      turns: { type: "string" },
      concurrency: { type: "string" },
      frames: { type: "string" },
      software: { type: "boolean", default: false },
      "no-render": { type: "boolean", default: false },
      out: { type: "string" },
      list: { type: "boolean", default: false },
      "redo-errors": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return void process.stdout.write(HELP);

  const modes = list(values.mode);
  const badMode = modes.find((m) => m !== "scratch" && m !== "reference");
  if (badMode) throw new Error(`--mode takes scratch or reference; not "${badMode}".`);
  const all = values.tasks ? loadTaskFile(values.tasks) : [...BUILTIN_TASKS];
  const tasks = selectTasks(all, { modes: modes as TaskMode[], types: list(values.type), ids: list(values.task) });

  if (values.list) {
    for (const t of tasks) console.log(`${t.id.padEnd(30)} ${t.mode.padEnd(9)} ${t.type.padEnd(11)} ${t.mode === "scratch" ? t.brief.slice(0, 90) : `reference: ${t.reference?.effect ?? t.reference?.video ?? t.reference?.images?.join(", ")}`}`);
    console.log(`\n${tasks.length} task(s).`);
    return;
  }
  if (!values.model) throw new Error("--model is required (for example --model anthropic:claude-opus-5-5); --help lists the options.");
  if (!tasks.length) throw new Error("No task matches those filters; --list shows them.");

  const noRender = values["no-render"];
  if (!noRender && !renderAvailable()) throw new Error("Rendering needs Chrome or Chromium (set CHROME_PATH, or: npx playwright install chromium) and ffmpeg (brew install ffmpeg, apt install ffmpeg, or FFMPEG_PATH), or pass --no-render for the static checks only.");
  if (!noRender && !values.judge && tasks.some((t) => t.mode === "scratch")) console.warn("No --judge: the look of scratch drafts is not graded, only their checks and renders.");

  const model = createModel(values.model, tasks);
  const judge = values.judge ? createModel(values.judge) : undefined;
  const turns = int("turns", values.turns, 3, 1);
  const samples = int("samples", values.samples, 1, 1);
  const concurrency = int("concurrency", values.concurrency, 2, 1);
  const frames = int("frames", values.frames, 6, 2);
  const started = new Date();
  // A command model is named by its last word (the model id, for the adapters).
  const slug = (values.model.startsWith("command:") ? values.model.trim().split(/\s+/).at(-1)! : values.model.replace(/^[a-z]+:/, "")).replace(/[^\w.-]+/g, "_").slice(0, 60);
  const out = path.resolve(values.out ?? path.join("results", `${started.toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${slug}`));
  mkdirSync(out, { recursive: true });

  const ctx = { model, judge, out, turns, noRender, render: { frames, software: values.software }, log: (line: string) => console.log(line) };
  let results: SampleResult[];
  let meta = { model: model.name, judge: judge?.name, turns, samples, started: started.toISOString(), finished: "" };
  if (values["redo-errors"]) {
    const file = path.join(out, "results.json");
    if (!values.out || !existsSync(file)) throw new Error("--redo-errors needs --out to name an earlier run's folder (one holding results.json).");
    const earlier = JSON.parse(readFileSync(file, "utf8")) as { meta: typeof meta; results: SampleResult[] };
    if (earlier.meta.model !== model.name || earlier.meta.judge !== judge?.name)
      throw new Error(`That run was made with --model ${earlier.meta.model}${earlier.meta.judge ? ` --judge ${earlier.meta.judge}` : " and no judge"}; redo its errors with the same.`);
    meta = { ...earlier.meta, finished: "" };
    results = earlier.results;
    const failed = results.filter((r) => r.error);
    console.log(`Redoing ${failed.length} sample(s) that ended in an error, in ${out}`);
    for (const r of failed) {
      const task = all.find((t) => t.id === r.task);
      if (!task) throw new Error(`The run has task "${r.task}", which is not among the tasks (pass the same --tasks file).`);
      const redone = await runSample(task, r.sample, ctx);
      console.log(`${r.task}#${r.sample}: ${redone.overall}/100${redone.error ? ` (${redone.error})` : ""}`);
      results = results.map((x) => (x === r ? redone : x));
    }
  } else {
    console.log(`${tasks.length} task(s) × ${samples} sample(s) with ${model.name}${judge ? `, judged by ${judge.name}` : ""} → ${out}`);
    results = await runAll(tasks, samples, concurrency, ctx);
  }

  // A replayed run is named after the model that wrote the answers, and keeps its drafting tokens and time.
  const source = values.model.startsWith("replay:") ? path.join(path.dirname(path.resolve(values.model.slice("replay:".length))), "results.json") : undefined;
  if (source && existsSync(source)) {
    const original = JSON.parse(readFileSync(source, "utf8")) as { meta: { model: string }; results: SampleResult[] };
    meta = { ...meta, model: original.meta.model, replayOf: path.dirname(source) } as typeof meta;
    results = results.map((r) => {
      const was = original.results.find((o) => o.task === r.task && o.sample === r.sample);
      return was ? { ...r, model: original.meta.model, usage: was.usage, ms: { ...r.ms, generate: was.ms.generate } } : r;
    });
  }
  meta.finished = new Date().toISOString();
  writeFileSync(path.join(out, "results.json"), JSON.stringify({ meta, summary: groups(results), results }, null, 2));
  const report = markdownReport(results, meta);
  writeFileSync(path.join(out, "report.md"), report);
  const g = groups(results);
  console.log(`\nScore ${g.all.overall.toFixed(1)} ± ${g.all.sd.toFixed(1)} over ${results.length} sample(s); first try ${Math.round(g.all.firstTry * 100)}%.`);
  for (const s of g.byType) console.log(`  ${s.group.padEnd(24)} ${s.overall.toFixed(1)}`);
  console.log(`\nReport: ${path.join(out, "report.md")}`);
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
