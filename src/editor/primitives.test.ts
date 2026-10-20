import { PRIMITIVES } from "../motion/library.js";
import { describe, expect, it } from "vitest";
import { renderVectorEffect } from "../catalog/types.js";
import { svgFrame, svgMotionIssues, type SvgMotion } from "../vector/motion.js";
import { callTool, createEffectToolProvider, createEffectToolRegistry, EFFECT_AGENT_INSTRUCTIONS } from "./agent.js";
import { createEffectEditor } from "./editor.js";

const SVG =
  '<svg viewBox="0 0 200 100"><!-- {{title: text default=Hello}} -->' +
  '<rect id="card" x="{{left: float default=10 min=0 max=100}}" y="10" width="40" height="20" fill="{{accent: color default=#336699}}"/>' +
  '<text id="title" x="10" y="90">{{title}}</text></svg>';

function setup() {
  const editor = createEffectEditor({ from: "spinner" });
  expect(editor.setMotion({ svg: SVG })).toEqual({ ok: true });
  const tools = createEffectToolProvider(editor);
  const run = async (id: string, params?: Record<string, unknown>) => {
    const result = await callTool(tools, "run_command", { id, ...(params && { params }) });
    const text = result.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
    return { error: Boolean(result.isError), text, result: (result.structuredContent as { result?: Record<string, unknown> } | undefined)?.result };
  };
  const motion = () => {
    const effect = editor.document.effect;
    if (effect.kind !== "vector") throw new Error("not vector");
    return effect;
  };
  return { editor, run, motion };
}

describe("motion primitives through the editor's commands", () => {
  it("lists primitives (by kind) and describes one, read only", async () => {
    const { run, editor } = setup();
    const history = editor.history.getState();
    const all = await run("primitive.list");
    expect(all.result).toMatchObject({ total: PRIMITIVES.length });
    const exits = await run("primitive.list", { kind: "exit" });
    expect((exits.result!.primitives as { id: string }[]).map((p) => p.id)).toEqual(["exit.fade", "exit.shrink", "exit.slide", "exit.wipe", "exit.undraw"]);
    expect(Object.keys((exits.result!.primitives as object[])[0]!)).toEqual(["id", "kind", "name", "description", "ms", "needsBox"]);
    const slide = await run("primitive.describe", { id: "entrance.slide" });
    expect(slide.result).toMatchObject({ id: "entrance.slide", ms: 600, params: [{ name: "direction", default: "up", options: ["up", "down", "left", "right"] }, { name: "distance", default: 40, unit: "viewBox units", min: 0 }] });
    expect(editor.history.getState()).toEqual(history);
  });

  it("repeats an emphasis, alternating, and refuses repeat on other kinds", async () => {
    const { run, editor, motion } = setup();
    const pulse = await run("primitive.apply", { primitive: "emphasis.pulse", target: "card", ms: 400, repeat: 3, alternate: true });
    expect(pulse.error).toBe(false);
    expect(pulse.result!.added).toEqual([expect.objectContaining({ repeat: 3, alternate: true, ms: 400 })]);
    expect(svgMotionIssues(motion().motion)).toEqual([]);
    const history = editor.history.getState();
    const bad = await run("primitive.apply", { primitive: "entrance.pop", target: "card", repeat: 2 });
    expect(bad).toMatchObject({ error: true, text: expect.stringContaining("`repeat` and `alternate` go with emphasis primitives") });
    expect(await run("primitive.apply", { primitive: "emphasis.pulse", target: "card", repeat: 0 })).toMatchObject({ error: true, text: expect.stringContaining("repeat") });
    expect(await run("primitive.apply", { primitive: "emphasis.pulse", target: "card", ease: { spring: { damping: "soft" } } })).toMatchObject({ error: true, text: expect.stringContaining("spring") });
    expect(editor.history.getState()).toEqual(history);
    const spring = await run("primitive.apply", { primitive: "emphasis.spin", target: "card", ease: { spring: { damping: 12 } }, ms: 900 });
    expect(spring.result!.added).toEqual([expect.objectContaining({ ease: { spring: { damping: 12 } } })]);
    expect(EFFECT_AGENT_INSTRUCTIONS).toContain("strobe");
  });

  it("refuses bad list and describe arguments with what to pass", async () => {
    const { run } = setup();
    // The schema's choices are checked first, and the refusal lists them.
    expect(await run("primitive.list", { kind: "entrances" })).toMatchObject({ error: true, text: expect.stringContaining('/kind Expected one of "entrance", "emphasis", "path", "exit", got "entrances"') });
    expect(await run("primitive.describe", { id: "pop" })).toMatchObject({ error: true, text: expect.stringContaining('"entrance.pop"') });
    expect(await run("primitive.describe", {})).toMatchObject({ error: true, text: expect.stringContaining("id") });
    expect(await run("primitive.list", { knd: "exit" })).toMatchObject({ error: true, text: expect.stringContaining('Unknown parameter "knd"') });
  });

  it("applies a primitive as one undo step, returning its tag and animations", async () => {
    const { run, editor, motion } = setup();
    const before = motion().motion;
    const pop = await run("primitive.apply", { primitive: "entrance.pop", target: "card", delay: 100 });
    expect(pop.error).toBe(false);
    expect(pop.result).toMatchObject({ ok: true, tag: "entrance.pop@card", elements: ["card--pop"], issues: [] });
    expect(pop.result!.added).toHaveLength(2);
    // Measured from the picture with its controls filled in: the card's centre at x = 10 + 20.
    expect(motion().motion.animate![1]!.attrs!.transform).toEqual(["translate(30 20) scale(0.5) translate(-30 -20)", "translate(30 20) scale(1) translate(-30 -20)"]);
    expect(motion().motion.svg).toContain('x="{{left: float default=10 min=0 max=100}}"');
    expect(await run("history.undo")).toMatchObject({ error: false });
    expect(motion().motion).toEqual(before);
    expect(editor.redo()).toBe(true);
    expect(motion().motion.animate).toHaveLength(2);
  });

  it("tints toward a colour from a colour control, played with the control's value", async () => {
    const { run, motion } = setup();
    await run("primitive.apply", { primitive: "emphasis.color-pulse", target: "card", params: { color: "#ffffff" } });
    expect(motion().motion.animate![0]!.attrs!.fill).toEqual(["{{accent}}", "#ffffff"]);
    const played = renderVectorEffect(motion(), { accent: "#000000" });
    expect(svgFrame(played.animate!, [], 0).get("card")!.attrs.fill).toBe("#000000");
    expect(svgFrame(played.animate!, [], 300).get("card")!.attrs.fill).toBe("#ffffff");
  });

  it("asks for a box for text, and takes one", async () => {
    const { run, motion } = setup();
    const refused = await run("primitive.apply", { primitive: "emphasis.spin", target: "title" });
    expect(refused).toMatchObject({ error: true, text: expect.stringContaining("pass `box`") });
    expect(motion().motion.animate).toBeUndefined();
    const spun = await run("primitive.apply", { primitive: "emphasis.spin", target: "title", box: [10, 70, 60, 24] });
    expect(spun.result).toMatchObject({ ok: true, tag: "emphasis.spin@title" });
    expect(svgMotionIssues(renderVectorEffect(motion()))).toEqual([]);
  });

  it("refuses bad apply arguments, leaving the picture alone", async () => {
    const { run, motion, editor } = setup();
    const before = JSON.stringify(motion());
    const steps = editor.history.getState();
    const cases: [Record<string, unknown>, string][] = [
      [{ primitive: "entrance.pop", target: "crd" }, 'Did you mean "card"?'],
      [{ primitive: "entrance.popp", target: "card" }, '/primitive Expected one of "entrance.fade", "entrance.pop"'],
      [{ primitive: "entrance.slide", target: "card", params: { direction: "sideways" } }, '`direction` is one of "up", "down", "left", "right"'],
      [{ primitive: "emphasis.pulse", target: "card", params: { amount: -1 } }, "`amount` is a number from 0 to 2"],
      [{ primitive: "emphasis.pulse", target: "card", step: 1.5 }, "/step Expected integer"],
      [{ primitive: "emphasis.pulse", target: "card", box: [1, 2, 3, Number.NaN] }, "`box` is [x, y, width, height]"],
      [{ primitive: "emphasis.pulse", target: "card", ease: "bouncy" }, "`ease` is"],
      [{ primitive: "entrance.draw", target: "title" }, "draws a stroke"],
      [{ target: "card" }, 'Missing required property "primitive"'],
    ];
    for (const [params, message] of cases) {
      const result = await run("primitive.apply", params);
      expect(result.error, JSON.stringify(params)).toBe(true);
      expect(result.text, JSON.stringify(params)).toContain(message);
    }
    expect(await run("primitive.apply", { primitive: "entrance.pop", target: "card", colour: "red" })).toMatchObject({ error: true, text: expect.stringContaining('Unknown parameter "colour"') });
    expect(JSON.stringify(motion())).toBe(before);
    expect(editor.history.getState()).toEqual(steps);
  });

  it("checks argument types before running when served through a registry", async () => {
    const { editor } = setup();
    const registry = createEffectToolRegistry(editor);
    const result = await registry.callTool("run_command", { id: "primitive.apply", params: { primitive: "entrance.pop", target: "card", step: "one" } });
    expect(result.isError).toBe(true);
  });

  it("lists what has been applied and removes one use as one undo step", async () => {
    const { run, motion } = setup();
    const original = motion().motion;
    await run("primitive.apply", { primitive: "entrance.wipe", target: "card" });
    const afterWipe = motion().motion;
    await run("primitive.apply", { primitive: "emphasis.shake", target: "card", delay: 700 });
    expect((await run("primitive.applied")).result).toEqual({
      total: 2,
      uses: [
        { tag: "entrance.wipe@card", primitive: "entrance.wipe", target: "card", animations: 1 },
        { tag: "emphasis.shake@card", primitive: "emphasis.shake", target: "card", animations: 1 },
      ],
    });
    const removed = await run("primitive.remove", { tag: "emphasis.shake@card" });
    expect(removed.result).toMatchObject({ ok: true, removed: 1, issues: [] });
    expect(motion().motion).toEqual(afterWipe);
    const bad = await run("primitive.remove", { tag: "emphasis.shake@card" });
    expect(bad).toMatchObject({ error: true, text: expect.stringContaining('The tags are "entrance.wipe@card"') });
    await run("history.undo");
    await run("history.undo");
    await run("history.undo");
    expect(motion().motion).toEqual(original);
  });

  it("refuses primitives on a shader effect, saying what to do", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const tools = createEffectToolProvider(editor);
    const result = await callTool(tools, "run_command", { id: "primitive.apply", params: { primitive: "entrance.fade", target: "x" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Load a vector effect first");
    const applied = await callTool(tools, "run_command", { id: "primitive.applied" });
    expect(JSON.stringify(applied)).toContain("shader effect");
  });

  it("tells agents about primitives", () => {
    for (const id of ["primitive.list", "primitive.describe", "primitive.apply", "primitive.applied", "primitive.remove"]) expect(EFFECT_AGENT_INSTRUCTIONS).toContain(id);
  });
});

// Keep the fixture honest: the raw picture is valid as it stands.
it("starts from a valid picture", () => {
  expect(svgMotionIssues({ svg: SVG } satisfies SvgMotion)).toEqual([]);
});
