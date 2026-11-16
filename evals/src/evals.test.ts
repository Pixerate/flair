// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getEffect } from "@pixerate/flair/catalog";
import { describe, expect, it } from "vitest";
import { passRate, requirementChecks, validityChecks } from "./check.ts";
import { encodePng, overChecker, pick } from "./frames.ts";
import { judgeScore, parseJudge } from "./judge.ts";
import { content, coverage, isAnimated, motion, similarity } from "./metrics.ts";
import { answerFor, createModel } from "./models.ts";
import { parseAnswer, systemPrompt, taskMessage } from "./prompt.ts";
import { renderAvailable } from "./render.ts";
import { overallScore, runSample } from "./run.ts";
import { BUILTIN_TASKS, selectTasks, taskIssues } from "./tasks.ts";
import { FatalModelError, type DraftEffect, type EvalTask, type Frames, type Model, type ModelRequest } from "./types.ts";

const tmp = () => mkdtempSync(path.join(tmpdir(), "flair-evals-"));

const SHADER = `uniform vec3 uInk;    // @control color default=#ff8800 label="Ink"
uniform float uSpeed; // @control min=0 max=4 default=1
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uInk * (0.5 + 0.5 * sin(uv.x * 12.0 + iTime * uSpeed)), 1.0);
}`;

const meta = { id: "stripes", name: "Stripes", category: "pattern", description: "Moving stripes.", tags: ["stripes"] };
const answer = (source: string, extra: Record<string, unknown> = {}) => `Here it is.\n\n\`\`\`json\n${JSON.stringify({ ...meta, ...extra })}\n\`\`\`\n\n\`\`\`glsl\n${source}\n\`\`\`\n`;

/** A model that gives these answers in turn and remembers what it was asked. */
function scripted(answers: string[]): Model & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    name: "scripted",
    requests,
    async generate(request) {
      requests.push(request);
      const text = answers[requests.length - 1];
      if (text === undefined) throw new Error("out of answers");
      return { text, usage: { input: 10, output: 5 } };
    },
  };
}

function frames(fill: (frame: number, x: number, y: number) => [number, number, number, number], count = 4, width = 32, height = 24): Frames {
  return {
    width,
    height,
    data: Array.from({ length: count }, (_, f) => {
      const buf = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) buf.set(fill(f, x, y), (y * width + x) * 4);
      return buf;
    }),
  };
}

describe("tasks", () => {
  it("are valid, unique, and name catalog effects that exist", () => {
    for (const t of BUILTIN_TASKS) expect(taskIssues(t), t.id).toEqual([]);
    expect(new Set(BUILTIN_TASKS.map((t) => t.id)).size).toBe(BUILTIN_TASKS.length);
    for (const t of BUILTIN_TASKS) if (t.reference?.effect) expect(getEffect(t.reference.effect), t.id).toBeDefined();
  });

  it("cover every type, from scratch and from reference", () => {
    const scratch = new Set(BUILTIN_TASKS.filter((t) => t.mode === "scratch").map((t) => t.type));
    expect(scratch.size).toBe(10);
    expect(new Set(BUILTIN_TASKS.filter((t) => t.mode === "reference").map((t) => t.type)).size).toBeGreaterThanOrEqual(7);
  });

  it("refuses filters that match nothing, naming the valid choices", () => {
    expect(() => selectTasks(BUILTIN_TASKS, { ids: ["nope"] })).toThrow(/no task "nope"/);
    expect(() => selectTasks(BUILTIN_TASKS, { types: ["sparkle"] })).toThrow(/the types are background/);
    expect(selectTasks(BUILTIN_TASKS, { modes: ["reference"], types: ["filter"] }).map((t) => t.id)).toEqual(["ref-image-halftone", "ref-image-thermal"]);
  });

  it("checks a task file's tasks", () => {
    expect(taskIssues({ id: "Bad Id", type: "sparkle", mode: "scratch", brief: "" })).toEqual([
      'task.id must be kebab-case, like "my-task"',
      expect.stringMatching(/^task.type must be one of/),
      "task.brief is empty; a scratch task needs a brief",
    ]);
    expect(taskIssues({ id: "a", type: "filter", mode: "reference", brief: "", reference: { effect: "x", video: "y.mp4" } })).toEqual(["task.reference needs exactly one of effect, images or video"]);
  });
});

describe("prompt", () => {
  it("gives the model the authoring skill and the answer format, never a held-out effect", () => {
    const system = systemPrompt();
    expect(system).toContain("mainImage");
    expect(system).toContain("{{placeholders}}");
    expect(system).toContain("## How to answer");
    for (const t of BUILTIN_TASKS.filter((t) => t.reference?.effect)) {
      const text = taskMessage(t, { strip: Buffer.alloc(0), frames: 6, seconds: 3 }).flatMap((p) => (p.type === "text" ? [p.text] : [])).join(" ");
      expect(text, t.id).not.toContain(t.reference!.effect!);
    }
  });

  it("reads catalog effects written as answers back unchanged", () => {
    for (const id of ["transition-luma", "orbit-loader", "embers"]) {
      const effect = getEffect(id)!;
      const parsed = parseAnswer(answerFor(effect as never), effect.kind as "shader" | "vector");
      expect("effect" in parsed && validityChecks(parsed.effect).filter((c) => !c.pass), id).toEqual([]);
    }
  });

  it("says what is missing from an unreadable answer", () => {
    expect(parseAnswer("no code here", "shader")).toEqual({ error: "The answer has no ```json block with the effect's definition." });
    expect(parseAnswer("```json\n{oops}\n```", "shader")).toMatchObject({ error: expect.stringMatching(/not valid JSON/) });
    expect(parseAnswer('```json\n{"id":"a"}\n```', "shader")).toEqual({ error: "The answer has no ```glsl block with the shader's source." });
    expect(parseAnswer('```json\n{"id":"a"}\n```', "vector")).toEqual({ error: "The answer has no ```svg block with the picture." });
  });
});

describe("checks", () => {
  const draft = (source: string, extra: Record<string, unknown> = {}) => ({ ...meta, kind: "shader", source, ...extra }) as DraftEffect;

  it("pass every catalog shader and vector effect", () => {
    for (const id of ["aurora", "image-halftone", "sparkles", "transition-iris", "typewriter", "bar-chart"]) {
      expect(validityChecks(getEffect(id) as never).filter((c) => !c.pass), id).toEqual([]);
    }
  });

  it("name uniforms that are not controls, redeclared built-ins and presets that do not fit", () => {
    const failed = validityChecks(
      draft(`uniform float uBare;\nuniform float iTime;\n${SHADER}`, { presets: [{ name: "Fast", values: { uSpeed: 9, uNope: 1 } }], category: "sparkly" }),
    ).filter((c) => !c.pass);
    expect(failed.map((c) => c.detail)).toEqual([
      expect.stringMatching(/^category "sparkly" is not one of EFFECT_CATEGORIES/),
      "iTime is a built-in uniform: delete the declaration",
      "uBare is a uniform without // @control on the same line",
      expect.stringMatching(/preset "Fast": uSpeed .*; preset "Fast" sets uNope, which is not a control/),
    ]);
  });

  it("hold a transition to uFrom, uTo and uProgress, and an overlay to transparency", () => {
    const transition = BUILTIN_TASKS.find((t) => t.id === "transition-radial-pixelate")!;
    const failed = requirementChecks(transition, draft(SHADER)).filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toEqual(["uFrom and uTo are pictures", "uProgress is a float", "has 5+ controls"]);
    expect(requirementChecks(transition, getEffect("transition-luma") as never).filter((c) => !c.pass)).toEqual([]);
    const overlay = BUILTIN_TASKS.find((t) => t.id === "overlay-snowfall")!;
    expect(requirementChecks(overlay, draft(SHADER)).find((c) => c.name === "is transparent")?.pass).toBe(false);
    expect(passRate([])).toBe(1);
  });
});

describe("metrics", () => {
  const flat = frames(() => [20, 30, 40, 255]);
  const moving = frames((f, x) => (x > f * 6 ? [255, 255, 255, 255] : [0, 0, 0, 255]));

  it("tell a blank still from a moving picture", () => {
    expect(content(flat)).toBe(0);
    expect(motion(flat)).toBe(0);
    expect(isAnimated(flat)).toBe(false);
    expect(content(moving)).toBeGreaterThan(0.2);
    expect(isAnimated(moving)).toBe(true);
  });

  it("measure an overlay's coverage", () => {
    const half = frames((_f, x) => (x < 16 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    expect(coverage(half)).toBeCloseTo(0.5);
    expect(overChecker(half).data[0]![(20 + 0 * 32) * 4 + 3]).toBe(255);
  });

  it("score a clip against itself as alike, and against something else as less so", () => {
    expect(similarity(moving, moving).score).toBeCloseTo(1, 5);
    const other = similarity(moving, flat);
    expect(other.score).toBeLessThan(0.5);
    expect(other.motion).toBe(0);
    expect(pick(moving, 2).data).toEqual([moving.data[0], moving.data[3]]);
  });

  it("encodes a PNG", () => {
    const png = encodePng(Buffer.alloc(4 * 4 * 4, 255), 4, 4);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});

describe("scores", () => {
  it("weigh validity, requirements, rendering and look, and cap drafts that do not render", () => {
    expect(overallScore({ validity: 1, requirements: 1, render: 1, judge: 1 }, true, false)).toBe(100);
    expect(overallScore({ validity: 1, requirements: 1, render: 1, judge: 0 }, true, false)).toBe(55);
    expect(overallScore({ validity: 1, requirements: 1 }, false, true)).toBe(100);
    expect(overallScore({ validity: 1, requirements: 1, render: 0 }, false, false)).toBe(20);
    expect(overallScore({ validity: 1, requirements: 1, render: 1, judge: 1, similarity: 0 }, true, false)).toBe(85);
  });

  it("read the judge's grades, refusing ones out of range", () => {
    const s = parseJudge('{"fidelity":5,"craft":3,"motion":3,"controls":1,"notes":"ok"}');
    expect(judgeScore(s)).toBeCloseTo((8 + 2 + 2 + 0) / 20);
    expect(() => parseJudge('{"fidelity":9,"craft":3,"motion":3,"controls":1}')).toThrow(/fidelity is 9, not 1 to 5/);
  });
});

describe("models", () => {
  it("refuse a spec they do not know, saying which they do", () => {
    expect(() => createModel("gpt")).toThrow(/use anthropic:<model>/);
    expect(() => createModel("anthropic:claude-opus-5-5?effort=huge")).toThrow(/effort must be one of low, medium, high, xhigh, max/);
  });

  it("replay saved answers by key", async () => {
    const model = createModel(`replay:${path.join(import.meta.dirname, "missing")}`);
    await expect(model.generate({ system: "", messages: [], key: "a/1/turn-1" })).rejects.toThrow(/no saved answer for a\/1\/turn-1/);
  });
});

describe("a sample", () => {
  const task: EvalTask = { id: "bg-test", type: "background", mode: "scratch", brief: "Moving stripes in one ink colour.", expect: { animated: true, minColorControls: 1 } };

  it("sends the checks' problems back and takes the repaired draft", async () => {
    const model = scripted([answer(`uniform float uBare;\n${SHADER}`), answer(SHADER)]);
    const result = await runSample(task, 1, { model, out: tmp(), noRender: true });
    expect(result).toMatchObject({ turns: 2, firstTry: false, scores: { validity: 1, requirements: 1 }, overall: 100, usage: { input: 20, output: 10 } });
    const feedback = model.requests[1]!.messages.at(-1)!.content[0]!;
    expect(feedback.type === "text" && feedback.text).toContain("uBare is a uniform without // @control on the same line");
    expect(model.requests[1]!.messages).toHaveLength(3);
  });

  it("stops after its turns, grading the last readable draft", async () => {
    const model = scripted(["nothing", answer(`uniform float uBare;\n${SHADER}`)]);
    const result = await runSample(task, 1, { model, out: tmp(), noRender: true, turns: 2 });
    expect(result.turns).toBe(2);
    expect(result.checks.find((c) => !c.pass)?.name).toBe("valid: every uniform is a control");
  });

  it("stops the run when the model cannot be reached at all", async () => {
    const model: Model = { name: "down", generate: async () => { throw new FatalModelError("down: no credentials"); } };
    await expect(runSample(task, 1, { model, out: tmp(), noRender: true })).rejects.toThrow("down: no credentials");
  });

  it("scores zero when no answer can be read", async () => {
    const result = await runSample(task, 1, { model: scripted(["a", "b"]), out: tmp(), noRender: true, turns: 2 });
    expect(result).toMatchObject({ overall: 0, error: "No turn gave a readable effect." });
  });
});

describe.skipIf(!renderAvailable())("a rendered sample", () => {
  it("renders, measures and judges a background", async () => {
    const task: EvalTask = { id: "bg-test", type: "background", mode: "scratch", brief: "Moving stripes.", expect: { animated: true } };
    const judgeModel = scripted(['{"fidelity":4,"craft":4,"motion":4,"controls":4,"notes":"fine"}']);
    const result = await runSample(task, 1, { model: scripted([answer(SHADER)]), judge: judgeModel, out: tmp(), render: { frames: 3, width: 96, height: 54 } });
    expect(result).toMatchObject({ firstTry: true, scores: { render: 1, requirements: 1 }, judge: { fidelity: 4 } });
    expect(judgeModel.requests[0]!.messages[0]!.content.some((p) => p.type === "image")).toBe(true);
  });

  it("checks a transition's ends against its pictures, and tells a compile error back", async () => {
    const task = BUILTIN_TASKS.find((t) => t.id === "transition-radial-pixelate")!;
    const luma = answerFor(getEffect("transition-luma") as never);
    const broken = `uniform sampler2D uFrom; // @control label="From"
uniform sampler2D uTo;   // @control label="To"
uniform float uProgress; // @control min=0 max=1 default=0
void mainImage(out vec4 c, in vec2 p) { c = vec4(oops); }`;
    const model = scripted([answer(broken), luma]);
    const result = await runSample(task, 1, { model, out: tmp(), render: { frames: 3, width: 96, height: 54 } });
    const feedback = model.requests[1]!.messages.at(-1)!.content[0]!;
    expect(feedback.type === "text" && feedback.text).toMatch(/does not render: .*'oops' : undeclared identifier/);
    const names = Object.fromEntries(result.checks.map((c) => [c.name, c.pass]));
    expect(names).toMatchObject({ "asked: progress 0 shows uFrom": true, "asked: progress 1 shows uTo": true, "asked: halfway is between": true });
  }, 120_000);
});
