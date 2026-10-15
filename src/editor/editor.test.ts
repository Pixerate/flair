import { describe, expect, it, vi } from "vitest";
import { getEffect } from "../catalog/index.js";
import { ManualClock } from "../time/clock.js";
import { callTool, createEffectToolProvider, EFFECT_AGENT_INSTRUCTIONS, toolDefinitions } from "./agent.js";
import { bindShaderRenderer, bindSvgView } from "./bind.js";
import { createEffectDocument, documentIssues, parseEffectDocument, valuesAt } from "./document.js";
import { createEffectEditor } from "./editor.js";

describe("documents", () => {
  it("start blank, from the catalog, or from source", () => {
    expect(createEffectDocument().effect.kind).toBe("shader");
    const aurora = createEffectDocument("aurora");
    expect(aurora.basedOn).toBe("aurora");
    expect(aurora.presets.map((p) => p.name)).toContain("Ember");
    expect(createEffectDocument("spinner").effect.kind).toBe("vector");
    expect(createEffectDocument({ source: "void mainImage(out vec4 c, in vec2 p) {}", name: "Mine" }).name).toBe("Mine");
    expect(() => createEffectDocument("nope")).toThrow(/no effect "nope"/);
  });

  it("uses each effect's loop as its timeline", () => {
    expect(createEffectDocument("stripes").duration).toBe(1000);
    expect(createEffectDocument("aurora").duration).toBe(5000);
  });

  it("evaluates values from tracks, picked values and defaults", () => {
    const doc = createEffectDocument("aurora");
    doc.values.uSpeed = 1.5;
    doc.tracks.uIntensity = { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 2 }] };
    const v = valuesAt(doc, 500);
    expect(v.uSpeed).toBe(1.5);
    expect(v.uIntensity).toBe(1);
    expect(v.uHeight).toBe(0.55);
  });

  it("reports issues and parses JSON", () => {
    const doc = createEffectDocument("aurora");
    doc.values.uNope = 1;
    doc.values.uSpeed = "fast" as never;
    const issues = documentIssues(doc).join(" | ");
    expect(issues).toMatch(/no control "uNope"/);
    expect(issues).toMatch(/uSpeed/);
    const round = parseEffectDocument(JSON.stringify(createEffectDocument("spinner")));
    expect(round.ok).toBe(true);
    expect(parseEffectDocument("{").ok).toBe(false);
    expect(parseEffectDocument({ version: 2 })).toMatchObject({ ok: false });
    expect(documentIssues(createEffectDocument("bar-chart"))).toEqual([]);
  });
});

describe("EffectEditor", () => {
  it("sets values with checks, and merges quick changes into one undo step", () => {
    const editor = createEffectEditor({ from: "aurora" });
    expect(editor.setValue("uSpeed", 1)).toEqual({ ok: true });
    expect(editor.setValue("uSpeed", 1.2)).toEqual({ ok: true });
    expect(editor.setValue("uSky", "#ff0000")).toEqual({ ok: true });
    expect(editor.getState().values.uSky).toEqual([1, 0, 0]);
    expect(editor.setValue("uNope", 1)).toMatchObject({ ok: false, message: expect.stringMatching(/no control "uNope"/) });
    expect(editor.setValue("uSpeed", "x")).toMatchObject({ ok: false });
    editor.undo();
    expect(editor.document.values.uSky).toBeUndefined();
    expect(editor.document.values.uSpeed).toBe(1.2);
    editor.undo();
    expect(editor.document.values.uSpeed).toBeUndefined();
    editor.redo();
    expect(editor.document.values.uSpeed).toBe(1.2);
  });

  it("keeps the same state object until something changes", () => {
    const editor = createEffectEditor({ from: "aurora" });
    const a = editor.getState();
    expect(editor.getState()).toBe(a);
    editor.setValue("uSpeed", 1);
    expect(editor.getState()).not.toBe(a);
  });

  it("applies, saves and deletes presets", () => {
    const editor = createEffectEditor({ from: "aurora" });
    expect(editor.applyPreset("Ember").ok).toBe(true);
    expect(editor.getState().values.uGlowA).toEqual([1, 0.45, 0.1]);
    expect(editor.applyPreset("Nope")).toMatchObject({ ok: false, message: expect.stringContaining('"Arctic"') });
    editor.savePreset("Mine", ["uSpeed"]);
    expect(editor.document.presets.find((p) => p.name === "Mine")!.values).toEqual({ uSpeed: 0.35 });
    editor.deletePreset("Mine");
    expect(editor.document.presets.some((p) => p.name === "Mine")).toBe(false);
  });

  it("keyframes values, and records changes at the playhead", () => {
    const editor = createEffectEditor({ from: "aurora" });
    editor.setKeyframe("uIntensity", 0, 0);
    editor.setKeyframe("uIntensity", 2000, 2, "ease-in-out");
    editor.seek(1000);
    expect(editor.getState().values.uIntensity).toBeCloseTo(1, 5);
    // A tracked control keyframes at the playhead when set
    editor.setValue("uIntensity", 0.5);
    expect(editor.document.tracks.uIntensity!.keyframes.map((k) => k.time)).toEqual([0, 1000, 2000]);
    editor.setRecording(true);
    editor.setValue("uSpeed", 2);
    expect(editor.document.tracks.uSpeed!.keyframes).toEqual([{ time: 1000, value: 2 }]);
    expect(editor.setKeyframeEasing("uIntensity", 0, "spring").ok).toBe(true);
    expect(editor.setKeyframeEasing("uIntensity", 0, "wobbly" as never).ok).toBe(false);
    expect(editor.removeKeyframe("uIntensity", 1000).ok).toBe(true);
    expect(editor.clearTrack("uIntensity").ok).toBe(true);
    expect(editor.document.tracks.uIntensity).toBeUndefined();
    // It keeps the value the track had at the playhead (a spring from 0 to 2, nearly settled).
    expect(editor.document.values.uIntensity).toBeGreaterThan(1.9);
  });

  it("plays on its clock, looping over the timeline", async () => {
    const clock = new ManualClock();
    const editor = createEffectEditor({ from: "stripes", clock });
    editor.play();
    for (let i = 0; i < 90; i++) await clock.advance(16);
    const { time, playing } = editor.getState();
    expect(playing).toBe(true);
    expect(time).toBeGreaterThan(0);
    expect(time).toBeLessThan(1000);
    editor.pause();
    editor.setTiming({ loop: false, duration: 500 });
    editor.seek(400);
    editor.play();
    for (let i = 0; i < 20; i++) await clock.advance(16);
    expect(editor.getState()).toMatchObject({ playing: false, time: 500 });
  });

  it("loads effects and edits sources", () => {
    const editor = createEffectEditor();
    expect(editor.load("plasma", "Nope").ok).toBe(false);
    expect(editor.load("flames", "Spirit").ok).toBe(true);
    expect(editor.document.values.uHot).toEqual([0.85, 1, 1]);
    expect(editor.setSource(editor.document.effect.kind === "shader" ? editor.document.effect.source.replace("Speed", "Pace") : "").ok).toBe(true);
    expect(editor.setMotion({ svg: "<svg/>" }).ok).toBe(false);
    editor.reportCompile({ ok: false, errors: [{ line: 3, message: "boom" }] });
    expect(editor.getState().compile).toEqual({ ok: false, errors: [{ line: 3, message: "boom" }] });
    editor.undo();
    editor.undo();
    expect(editor.document.basedOn).toBeUndefined();
  });
});

describe("commands and agent tools", () => {
  it("runs editing through the command registry", () => {
    const editor = createEffectEditor({ from: "aurora" });
    expect(editor.commands.execute("values.set", { values: { uSpeed: 1 } })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uNope: 1 } })).toMatchObject({ ok: false, message: expect.stringMatching(/uNope/) });
    expect(editor.commands.execute("history.undo")).toMatchObject({ ok: true });
    expect(editor.document.values.uSpeed).toBeUndefined();
    const found = editor.commands.execute<{ id: string }[]>("catalog.search", { text: "fire" });
    expect(found.ok && found.result.map((e) => e.id)).toContain("flames");
  });

  it("exposes the commands as MCP tools an agent can call", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor, { capture: () => "data:image/png;base64,AAAA" });
    const names = toolDefinitions(provider).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["list_commands", "run_command", "run_commands", "view_effect"]));
    const listed = await callTool(provider, "list_commands", {});
    expect(JSON.stringify(listed)).toContain("keyframe.set");
    const run = await callTool(provider, "run_commands", {
      steps: [
        { id: "effect.load", params: { id: "nebula" } },
        { id: "values.set", params: { values: { uDensity: 1.5 } } },
        { id: "keyframe.set", params: { name: "uSpeed", time: 1000, value: 0.5, easing: "ease-out" } },
      ],
    });
    expect(run.isError).toBeFalsy();
    expect(editor.document.basedOn).toBe("nebula");
    expect(editor.document.values.uDensity).toBe(1.5);
    const described = await callTool(provider, "run_command", { id: "effect.describe" });
    expect(JSON.stringify(described)).toContain("uDensity");
    const view = await callTool(provider, "view_effect");
    expect(view.content[0]).toEqual({ type: "image", data: "AAAA", mimeType: "image/png" });
    expect((await callTool(provider, "nope")).isError).toBe(true);
    expect(EFFECT_AGENT_INSTRUCTIONS).toContain("iResolution");
  });
});

describe("bindings", () => {
  it("drives a shader preview and reports compiles back", () => {
    const editor = createEffectEditor({ from: "aurora" });
    const renderer = {
      setSource: vi.fn(() => ({ ok: false, errors: [{ line: 2, message: "bad" }] })),
      setValues: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
    };
    const unbind = bindShaderRenderer(editor, renderer);
    expect(renderer.pause).toHaveBeenCalled();
    expect(renderer.setSource).toHaveBeenCalledTimes(1);
    expect(editor.getState().compile).toMatchObject({ ok: false });
    editor.seek(1500);
    expect(renderer.seek).toHaveBeenLastCalledWith(1.5);
    editor.setValue("uSpeed", 1);
    expect(renderer.setValues).toHaveBeenLastCalledWith(expect.objectContaining({ uSpeed: 1 }));
    expect(renderer.setSource).toHaveBeenCalledTimes(1);
    unbind();
  });

  it("draws a vector effect with its values", () => {
    const editor = createEffectEditor({ from: "progress-ring" });
    const host = document.createElement("div");
    const unbind = bindSvgView(editor, host);
    editor.seek(5000);
    expect(host.querySelector("#label")!.textContent).toBe("72%");
    editor.setValue("value", 40);
    expect(host.querySelector("#label")!.textContent).toBe("40%");
    unbind();
    expect(host.querySelector("svg")).toBeNull();
  });
});

it("catalog effects load in the editor without issues", () => {
  for (const id of ["aurora", "spinner", "bar-chart", "transition-iris"]) {
    expect(getEffect(id)).toBeDefined();
    expect(createEffectEditor({ from: id }).getState().issues).toEqual([]);
  }
});
