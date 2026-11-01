import { describe, expect, it, vi } from "vitest";
import { getEffect, textImage } from "../catalog/index.js";
import { ManualClock } from "../time/clock.js";
import { svgDuration } from "../vector/svg.js";
import { callTool, createEffectToolProvider, EFFECT_AGENT_INSTRUCTIONS, toolDefinitions } from "./agent.js";
import { bindShaderRenderer, bindSvgView } from "./bind.js";
import { createEffectDocument, documentIssues, parseEffectDocument, valuesAt } from "./document.js";
import { createEffectEditor } from "./editor.js";
import { CATALOG_SEARCH_LIMIT, CATALOG_TAGS_LIMIT } from "./commands.js";

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

  it("gives a vector effect its motion and rest as its timeline", () => {
    const spinner = getEffect("spinner");
    if (spinner?.kind !== "vector") throw new Error("spinner is a vector effect");
    expect(createEffectDocument("spinner").duration).toBe(Math.round(svgDuration(spinner.motion) + (spinner.hold ?? 600)));
    expect(createEffectDocument("spinner").duration).not.toBe(5000);
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
    const drip = createEffectEditor({ from: "drip-text" });
    expect(drip.setMotion({ svg: `<svg viewBox="0 0 10 10"><text>{{title: text default=Hi}}</text></svg>` }).ok).toBe(true);
    expect(drip.controls.map((c) => c.name)).toEqual(["title"]);
    expect(drip.setValue("title", "Hello").ok).toBe(true);
    expect(drip.setValue("title", 3).ok).toBe(false);
    expect(drip.getState().values.title).toBe("Hello");
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
    type Search = { total: number; effects: { id: string; video?: string }[]; more?: string };
    const found = editor.commands.execute<Search>("catalog.search", { text: "fire" });
    expect(found.ok && found.result.effects.map((e) => e.id)).toContain("flames");
    const video = editor.commands.execute<Search>("catalog.search", { video: ["transition"], limit: 200 });
    expect(video.ok && video.result.effects.length > 5 && video.result.effects.every((e) => e.video === "transition")).toBe(true);
  });

  it("keeps catalog searches small and says how to see more", () => {
    const editor = createEffectEditor({ from: "aurora" });
    type Search = { total: number; effects: { id: string }[]; more?: string };
    const first = editor.commands.execute<Search>("catalog.search", {});
    if (!first.ok) throw new Error("search failed");
    expect(first.result.effects).toHaveLength(CATALOG_SEARCH_LIMIT);
    expect(first.result.total).toBeGreaterThan(CATALOG_SEARCH_LIMIT);
    expect(first.result.more).toMatch(new RegExp(`offset ${CATALOG_SEARCH_LIMIT}`));
    const next = editor.commands.execute<Search>("catalog.search", { offset: CATALOG_SEARCH_LIMIT, limit: 5 });
    expect(next.ok && next.result.effects[0]!.id).not.toBe(first.result.effects[0]!.id);
    const narrow = editor.commands.execute<Search>("catalog.search", { text: "fire", limit: 200 });
    expect(narrow.ok && narrow.result.more).toBeUndefined();
  });

  it("lets agents find effects by tag, and list the tags there are", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; tags: string[] }[] };
    type Tags = { total: number; tags: { tag: string; count: number }[]; more?: string };

    const tags = await callTool(provider, "run_command", { id: "catalog.tags", params: {} });
    const listed = (tags.structuredContent as { result: Tags }).result;
    expect(listed.tags).toHaveLength(CATALOG_TAGS_LIMIT);
    expect(listed.total).toBeGreaterThan(CATALOG_TAGS_LIMIT);
    expect(listed.more).toMatch(new RegExp(`offset ${CATALOG_TAGS_LIMIT}`));

    const fireTags = editor.commands.execute<Tags>("catalog.tags", { category: "fire", limit: 500 });
    if (!fireTags.ok) throw new Error(fireTags.message);
    const hot = fireTags.result.tags.find((t) => t.tag === "hot")!;
    const found = editor.commands.execute<Search>("catalog.search", { category: "fire", tags: ["HOT"], limit: 200 });
    if (!found.ok) throw new Error(found.message);
    expect(found.result.total).toBe(hot.count);
    expect(found.result.effects.every((e) => e.tags.includes("hot"))).toBe(true);

    const unknown = await callTool(provider, "run_command", { id: "catalog.search", params: { tags: ["glas"] } });
    expect(unknown.isError).toBe(true);
    expect(JSON.stringify(unknown)).toMatch(/No effect is tagged \\"glas\\"\. Did you mean \\"glass\\"/);
    expect(JSON.stringify(unknown)).toMatch(/catalog\.tags/);
    expect(editor.commands.execute("catalog.tags", { tags: "glass" })).toMatchObject({ ok: false });
    expect(editor.commands.execute("catalog.tags", { limit: 0 })).toMatchObject({ ok: false });
  });

  it("lets agents find cinematic effects and set up a letterbox", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string }[] };
    const found = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "cinematic", limit: 50 } });
    const result = (found.structuredContent as { result: Search }).result;
    expect(result.total).toBe(5);
    expect(result.effects.map((e) => e.id)).toEqual(expect.arrayContaining(["anamorphic-lens", "end-credits-roll"]));
    const pulls = editor.commands.execute<Search>("catalog.search", { group: "Transitions", text: "focus", limit: 50 });
    expect(pulls.ok && pulls.result.effects.map((e) => e.id)).toContain("transition-focus-pull");
    expect(editor.commands.execute("effect.load", { id: "letterbox" })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uAspect: 1.85, uAnimate: true } })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uAspect: "wide" } })).toMatchObject({ ok: false, message: expect.stringMatching(/uAspect/) });
    expect(editor.commands.execute("values.set", { values: { uRatio: 2 } })).toMatchObject({ ok: false, message: expect.stringMatching(/uRatio/) });
  });

  it("lets agents find beauty effects, and refuses a category there is not", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string; video?: string }[] };
    const found = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "beauty", limit: 50 } });
    const result = (found.structuredContent as { result: Search }).result;
    expect(result.total).toBe(12);
    expect(result.effects.every((e) => e.category === "beauty")).toBe(true);
    expect(result.effects.map((e) => e.id)).toEqual(expect.arrayContaining(["beauty-lip-tint", "lipstick-swipe"]));
    const lips = editor.commands.execute<Search>("catalog.search", { group: "Pictures", text: "lipstick", limit: 50 });
    expect(lips.ok && lips.result.effects.map((e) => e.id)).toEqual(expect.arrayContaining(["beauty-lip-tint", "lipstick-swipe"]));
    const wrong = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "makeup" } });
    expect(wrong.isError).toBe(true);
    expect(JSON.stringify(wrong)).toMatch(/beauty/);
    expect(editor.commands.execute("effect.load", { id: "beauty-blush" })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uAmount: 0.6, uColour: "#F08080" } })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uBlush: 1 } })).toMatchObject({ ok: false, message: expect.stringMatching(/uBlush/) });
  });

  it("lets agents find the horror effects, load one and tune it within its controls", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string }[] };
    const found = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "horror", limit: 50 } });
    expect(found.isError).toBeFalsy();
    const { result } = found.structuredContent as { result: Search };
    expect(result.effects.map((e) => e.id)).toEqual(
      expect.arrayContaining(["vhs-tracking", "night-vision-cam", "signal-lost", "ghost-apparition", "eyes-in-the-dark", "possessed-text"]),
    );
    expect(editor.commands.execute<Search>("catalog.search", { group: "Pictures", tags: ["analog-horror"], limit: 50 })).toMatchObject({ ok: true, result: { total: 5 } });

    // A category that is not there is refused, naming the ones that are.
    const wrong = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "spooky" } });
    expect(wrong.isError).toBe(true);
    expect(JSON.stringify(wrong)).toContain("horror");

    const run = await callTool(provider, "run_commands", {
      steps: [
        { id: "effect.load", params: { id: "eyes-in-the-dark" } },
        { id: "values.set", params: { values: { uDensity: 6, uReach: 0.3 } } },
      ],
    });
    expect(run.isError).toBeFalsy();
    expect(editor.document.basedOn).toBe("eyes-in-the-dark");
    expect(editor.document.values).toMatchObject({ uDensity: 6, uReach: 0.3 });
    // A mistyped value is refused and nothing changes.
    expect(editor.commands.execute("values.set", { values: { uAmount: "lots" } })).toMatchObject({ ok: false, message: expect.stringMatching(/uAmount takes a number/) });
    expect(editor.document.values.uAmount).toBeUndefined();
  });

  it("lets agents find the meme effects, caption one and tune it within its controls", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string }[] };
    const found = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "meme", limit: 50 } });
    expect(found.isError).toBeFalsy();
    const { result } = found.structuredContent as { result: Search };
    expect(result.effects.map((e) => e.id)).toEqual(expect.arrayContaining(["impact-caption", "deep-fried", "dramatic-zoom", "deal-with-it", "laser-eyes", "to-be-continued"]));

    const run = await callTool(provider, "run_commands", {
      steps: [
        { id: "effect.load", params: { id: "impact-caption" } },
        { id: "values.set", params: { values: { top: "When the tests pass", backdrop: 0 } } },
      ],
    });
    expect(run.isError).toBeFalsy();
    expect(editor.document.values).toMatchObject({ top: "When the tests pass", backdrop: 0 });
    // A mistyped value is refused and nothing changes.
    expect(editor.commands.execute("values.set", { values: { thickness: "heavy" } })).toMatchObject({ ok: false, message: expect.stringMatching(/thickness takes a number/) });
    expect(editor.document.values.thickness).toBeUndefined();
    // So is a value beyond the control's range.
    expect(editor.commands.execute("values.set", { values: { thickness: 5 } })).toMatchObject({ ok: false, message: expect.stringMatching(/thickness takes a number from 0 to 0\.2/) });
  });

  it("lets agents find the chart, retro and reaction memes by kind, load each, apply presets and refuse bad values", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string }[] };
    const search = async (params: Record<string, unknown>) => {
      const found = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "meme", limit: 50, ...params } });
      expect(found.isError).toBeFalsy();
      return (found.structuredContent as { result: Search }).result.effects.map((e) => e.id);
    };
    expect(await search({ tags: ["reaction"] })).toEqual(expect.arrayContaining(["bonk", "hitmarker-montage", "reaction-rain"]));
    expect(await search({ tags: ["chart"] })).toEqual(["stonks-chart"]);
    expect(await search({ tags: ["retro"] })).toEqual(expect.arrayContaining(["error-cascade", "wordart-text"]));

    // Each loads, and its presets apply.
    for (const [id, preset] of [
      ["stonks-chart", "Not stonks"],
      ["error-cascade", "Trail"],
      ["bonk", "Overlay"],
      ["hitmarker-montage", "Rapid fire"],
      ["reaction-rain", "Hearts"],
      ["wordart-text", "Arch"],
    ] as const) {
      const run = await callTool(provider, "run_commands", {
        steps: [
          { id: "effect.load", params: { id } },
          { id: "preset.apply", params: { name: preset } },
        ],
      });
      expect(run.isError, id).toBeFalsy();
      expect(editor.document.basedOn).toBe(id);
    }
    expect(editor.document.values).toMatchObject({ arch: 0.8, wave: 0 });

    // Text, numbers and switches land as given.
    await callTool(provider, "run_command", { id: "effect.load", params: { id: "error-cascade" } });
    const set = await callTool(provider, "run_command", { id: "values.set", params: { values: { title: "Fatal", message: "Out of memes.", count: 4, trail: true } } });
    expect(set.isError).toBeFalsy();
    expect(editor.document.values).toMatchObject({ title: "Fatal", message: "Out of memes.", count: 4, trail: true });
    // Too many dialogs, a mistyped switch and an unknown preset are refused, naming what is allowed, and nothing changes.
    const many = await callTool(provider, "run_command", { id: "values.set", params: { values: { count: 40 } } });
    expect(many.isError).toBe(true);
    expect(JSON.stringify(many)).toMatch(/count takes a number from 1 to 16, not 40/);
    expect(editor.commands.execute("values.set", { values: { trail: "yes" } })).toMatchObject({ ok: false, message: expect.stringMatching(/trail takes true or false/) });
    expect(editor.commands.execute("preset.apply", { name: "Blue screen" })).toMatchObject({ ok: false });
    expect(editor.document.values).toMatchObject({ count: 4, trail: true });

    await callTool(provider, "run_command", { id: "effect.load", params: { id: "reaction-rain" } });
    expect(editor.commands.execute("values.set", { values: { glyphs: 5 } })).toMatchObject({ ok: false, message: expect.stringMatching(/glyphs takes text/) });
    expect(editor.commands.execute("values.set", { values: { glyphs: "🎉 🙌" } })).toMatchObject({ ok: true });

    await callTool(provider, "run_command", { id: "effect.load", params: { id: "wordart-text" } });
    expect(editor.commands.execute("values.set", { values: { wave: 2 } })).toMatchObject({ ok: false, message: expect.stringMatching(/wave takes a number from -1 to 1/) });
    expect(editor.commands.execute("values.set", { values: { skew: -45 } })).toMatchObject({ ok: false, message: expect.stringMatching(/skew takes a number from -30 to 30/) });
    expect(editor.document.values.wave).toBeUndefined();
  });

  it("refuses values beyond a control's declared range, naming it, and changes nothing", async () => {
    const editor = createEffectEditor({ from: "beauty-blush" });
    const provider = createEffectToolProvider(editor);
    const wrong = await callTool(provider, "run_command", { id: "values.set", params: { values: { uAmount: 3 } } });
    expect(wrong.isError).toBe(true);
    expect(JSON.stringify(wrong)).toMatch(/uAmount takes a number from 0 to 1, not 3/);
    expect(editor.document.values.uAmount).toBeUndefined();
    // All or nothing: one value out of range keeps the others from landing too.
    expect(editor.commands.execute("values.set", { values: { uDepth: 0.4, uSpacing: 2 } })).toMatchObject({ ok: false, message: expect.stringMatching(/uSpacing takes a number from 0 to 0\.5/) });
    expect(editor.document.values.uDepth).toBeUndefined();
    expect(editor.commands.execute("values.set", { values: { uAmount: 0.9 } })).toMatchObject({ ok: true });
    // Vector controls declared with a range are held to it as well.
    const vector = createEffectEditor({ from: "swatch-reveal" });
    expect(vector.commands.execute("values.set", { values: { count: 9 } })).toMatchObject({ ok: false, message: expect.stringMatching(/count takes a number from 1 to 5, not 9/) });
  });

  it("lets agents set a text mask's words, in its own font or another, and refuses bare words", async () => {
    const editor = createEffectEditor({ from: "to-be-continued" });
    const provider = createEffectToolProvider(editor);
    // effect.describe marks the control, and values.schema says what it takes.
    const described = await callTool(provider, "run_command", { id: "effect.describe" });
    const controls = (described.structuredContent as { result: { controls: { name: string; textMask?: boolean }[] } }).result.controls;
    expect(controls.find((c) => c.name === "uText")).toMatchObject({ textMask: true });
    expect(controls.find((c) => c.name === "uImage")!.textMask).toBeUndefined();
    const schema = await callTool(provider, "run_command", { id: "values.schema" });
    const uText = (schema.structuredContent as { result: { properties: Record<string, { anyOf?: { type: string; required?: string[] }[] }> } }).result.properties.uText!;
    expect(uText.anyOf!.map((s) => s.type)).toEqual(["object", "string"]);
    expect(uText.anyOf![0]!.required).toEqual(["text"]);

    // Words become a text image in the default's font; a font and weight can be named.
    const set = await callTool(provider, "run_command", { id: "values.set", params: { values: { uText: { text: "COMING SOON" } } } });
    expect(set.isError).toBeFalsy();
    expect(editor.document.values.uText).toBe(textImage("COMING SOON"));
    expect(editor.commands.execute("values.set", { values: { uText: { text: "FIN", font: "Georgia, serif", weight: 400 } } })).toMatchObject({ ok: true });
    expect(editor.document.values.uText).toBe(textImage("FIN", { font: "Georgia, serif", weight: 400 }));
    expect(editor.commands.execute("keyframe.set", { name: "uText", time: 500, value: { text: "LATER" } })).toMatchObject({ ok: true });
    expect(editor.document.tracks.uText!.keyframes[0]!.value).toBe(textImage("LATER"));
    editor.commands.execute("history.undo", {});

    // Bare words, empty words, unknown keys and a bad weight are refused, saying what to pass, and nothing changes.
    expect(editor.commands.execute("values.set", { values: { uText: "ANGRY" } })).toMatchObject({
      ok: false,
      message: 'uText draws words from a text image, so "ANGRY" would be read as a file path: pass its words as {"text": "…"} (with "font" and "weight" if you like), or a text image\'s URL.',
    });
    expect(editor.commands.execute("values.set", { values: { uText: { text: " " } } })).toMatchObject({ ok: false, message: expect.stringMatching(/uText needs some words/) });
    expect(editor.commands.execute("values.set", { values: { uText: { text: "HI", size: 40 } } })).toMatchObject({ ok: false, message: 'uText takes {"text", "font", "weight"}, not "size".' });
    expect(editor.commands.execute("values.set", { values: { uText: { text: "HI", weight: "heavy" } } })).toMatchObject({ ok: false, message: expect.stringMatching(/"weight" is a font weight/) });
    expect(editor.document.values.uText).toBe(textImage("FIN", { font: "Georgia, serif", weight: 400 }));
    // A URL or a relative image path still works, and a picture control still takes any relative path.
    expect(editor.commands.execute("values.set", { values: { uText: "words/fin.png" } })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uImage: "photo" } })).toMatchObject({ ok: true });
    // A document stores the text image itself, so words there are an issue.
    expect(documentIssues({ ...editor.document, values: { uText: { text: "HI" } } } as never)).toEqual([
      'values: uText stores a text image\'s URL; words as {"text": …} are only taken by values.set and keyframe.set.',
    ]);
  });

  it("lets agents find the second batch of meme shaders, load one by its kind and set its words and levels", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    type Search = { total: number; effects: { id: string; category: string }[] };
    const BATCH = ["needs-more-jpeg", "triggered", "vaporwave-grade", "galaxy-brain", "sad-mode", "game-over-banner"];
    const all = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "meme", limit: 50 } });
    expect((all.structuredContent as { result: Search }).result.effects.map((e) => e.id)).toEqual(expect.arrayContaining(BATCH));
    const endings = await callTool(provider, "run_command", { id: "catalog.search", params: { category: "meme", tags: ["ending"], limit: 50 } });
    expect((endings.structuredContent as { result: Search }).result.effects.map((e) => e.id).sort()).toEqual(["game-over-banner", "to-be-continued"]);

    // Every one loads, and every preset applies within its controls.
    for (const id of BATCH) {
      expect(editor.commands.execute("effect.load", { id }), id).toMatchObject({ ok: true });
      for (const preset of getEffect(id)!.presets ?? []) {
        expect(editor.commands.execute("preset.apply", { name: preset.name }), `${id}: ${preset.name}`).toMatchObject({ ok: true });
      }
    }

    // A banner's words go in as words; the level and head point are set and checked like any control.
    const run = await callTool(provider, "run_commands", {
      steps: [
        { id: "effect.load", params: { id: "game-over-banner" } },
        { id: "values.set", params: { values: { uText: { text: "CONTINUE?" }, uPlay: 0.8 } } },
      ],
    });
    expect(run.isError).toBeFalsy();
    expect(editor.document.values).toMatchObject({ uText: expect.stringContaining("CONTINUE%3F"), uPlay: 0.8 });
    // In the banner's own serif, since no font was named.
    expect(decodeURIComponent(editor.document.values.uText as string)).toMatch(/font-family="Georgia[^"]*serif"/);

    editor.commands.execute("effect.load", { id: "galaxy-brain" });
    expect(editor.commands.execute("values.set", { values: { uLevel: 2, uHead: [0.42, 0.8] } })).toMatchObject({ ok: true });
    expect(editor.document.values).toMatchObject({ uLevel: 2, uHead: [0.42, 0.8] });
    // Out of range or mistyped, it is refused with the valid range, and nothing changes.
    expect(editor.commands.execute("values.set", { values: { uLevel: 5 } })).toMatchObject({ ok: false, message: "uLevel takes a number from 1 to 4, not 5." });
    expect(editor.commands.execute("values.set", { values: { uHead: [0.5, 1.4] } })).toMatchObject({ ok: false, message: expect.stringMatching(/uHead takes 2 numbers, each from 0 to 1/) });
    expect(editor.document.values).toMatchObject({ uLevel: 2, uHead: [0.42, 0.8] });

    // The jitter can't be pushed past its cap.
    editor.commands.execute("effect.load", { id: "triggered" });
    expect(editor.commands.execute("values.set", { values: { uShake: 3 } })).toMatchObject({ ok: false, message: "uShake takes a number from 0 to 1, not 3." });
    expect(editor.commands.execute("values.set", { values: { uShake: "max" } })).toMatchObject({ ok: false, message: expect.stringMatching(/uShake takes a number/) });
    expect(editor.document.values.uShake).toBeUndefined();
  });

  it("lets agents edit vector pictures and see shader compiles", async () => {
    const shader = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(shader);
    const wrongKind = await callTool(provider, "run_command", { id: "effect.setMotion", params: { motion: { svg: "<svg/>" } } });
    expect(wrongKind.isError && JSON.stringify(wrongKind)).toMatch(/effect\.setSource/);
    const set = await callTool(provider, "run_command", { id: "effect.setSource", params: { source: "void mainImage(out vec4 c, in vec2 f) { c = vec4(1.0); }" } });
    expect(JSON.stringify(set.structuredContent)).toMatch(/not compiled yet/);
    bindShaderRenderer(shader, { setSource: () => ({ ok: false, errors: [{ line: 1, message: "bad" }] }), setValues() {}, seek() {}, pause() {} });
    const compiled = await callTool(provider, "run_command", { id: "effect.setSource", params: { source: "void mainImage(out vec4 c, in vec2 f) { c = 1; }" } });
    expect(compiled.structuredContent).toMatchObject({ result: { compile: { ok: false, errors: [{ line: 1, message: "bad" }] } } });

    const vector = createEffectEditor({ from: "drip-text" });
    const tools = createEffectToolProvider(vector);
    const svg = `<svg viewBox="0 0 10 10"><text id="t">{{title: text default=Hi}}</text></svg>`;
    const ok = await callTool(tools, "run_command", { id: "effect.setMotion", params: { motion: { svg, animate: [{ id: "t", attrs: { opacity: [0, 1] } }] } } });
    expect(ok.isError).toBeFalsy();
    expect(vector.document.effect.kind === "vector" && vector.document.effect.motion.svg).toBe(svg);
    const empty = await callTool(tools, "run_command", { id: "effect.setMotion", params: { motion: { svg: "" } } });
    expect(empty.isError).toBe(true);
    const wrong = await callTool(tools, "run_command", { id: "effect.setSource", params: { source: "x" } });
    expect(JSON.stringify(wrong)).toMatch(/effect\.setMotion/);
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

describe("parameters", () => {
  it("maps controls to a parameters schema", async () => {
    const { parameterSchemaFor, toParameterValues } = await import("./parameters.js");
    const editor = createEffectEditor({ from: "image-glitch" });
    const schema = parameterSchemaFor(editor.controls, { images: [{ url: "https://x.test/a.png", label: "A" }] });
    const types = Object.fromEntries(schema.fields.map((f) => [f.id, f.type]));
    expect(types).toMatchObject({ uImage: "image", uAmount: "number" });
    const aurora = createEffectEditor({ from: "aurora" });
    const sky = parameterSchemaFor(aurora.controls).fields.find((f) => f.id === "uSky")!;
    expect(sky).toMatchObject({ type: "color", alpha: false, default: "#050816" });
    expect(toParameterValues(aurora.controls, aurora.getState().values).uSky).toBe("#050816");
    const plasma = createEffectEditor({ from: "plasma" });
    expect(parameterSchemaFor(plasma.controls).fields.find((f) => f.id === "uPhase")).toMatchObject({ type: "vector", size: 3 });
    expect(parameterSchemaFor(createEffectEditor({ from: "lava-lamp" }).controls).fields.find((f) => f.id === "uCount")).toMatchObject({ type: "int" });
    expect(parameterSchemaFor(createEffectEditor({ from: "drip-text" }).controls).fields.find((f) => f.id === "word")).toMatchObject({ type: "text", default: "SLOP" });
  });

  it("keeps a parameters controller in step with the editor, both ways", async () => {
    const { bindEffectParameters } = await import("./parameters.js");
    const editor = createEffectEditor({ from: "aurora" });
    const { controller, dispose } = bindEffectParameters(editor);
    // Controller → editor (one undo step, in the editor's history)
    expect(controller.setValue("uSky", "#ff0000").ok).toBe(true);
    expect(editor.getState().values.uSky).toEqual([1, 0, 0]);
    expect(editor.getState().history.canUndo).toBe(true);
    // Editor → controller
    editor.undo();
    expect(controller.getValues().uSky).toBe("#050816");
    editor.setValue("uSpeed", 1.5);
    expect(controller.getValues().uSpeed).toBe(1.5);
    // Keyframe diamonds go through the editor
    editor.seek(1000);
    expect(controller.toggleKeyframe("uSpeed").ok).toBe(true);
    expect(editor.document.tracks.uSpeed!.keyframes).toEqual([{ time: 1000, value: 1.5 }]);
    expect(controller.keyState("uSpeed")).toBe("keyed");
    editor.undo();
    expect(editor.document.tracks.uSpeed).toBeUndefined();
    // A new source updates the schema
    editor.load({ source: "uniform float uGain; // @control min=0 max=2 default=1\nvoid mainImage(out vec4 c, in vec2 p) { c = vec4(uGain); }" });
    expect(controller.getState().fields.map((f) => f.id)).toEqual(["uGain"]);
    dispose();
  });
});

describe("tool registry", () => {
  it("serves the editor's tools through @pixerate/editor/tools", async () => {
    const { createEffectToolRegistry } = await import("./agent.js");
    const editor = createEffectEditor({ from: "aurora" });
    const registry = createEffectToolRegistry(editor);
    expect(registry.listTools().tools.map((t) => t.name)).toEqual(expect.arrayContaining(["list_commands", "run_command", "run_commands"]));
    const ok = await registry.callTool("run_command", { id: "keyframe.setTrack", params: { name: "uSpeed", keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 2, easing: "ease-out" }] } });
    expect(ok.isError).toBeFalsy();
    expect(editor.document.tracks.uSpeed!.keyframes).toHaveLength(2);
    const bad = await registry.callTool("run_command", { nope: true });
    expect(bad.isError).toBe(true);
  });
});
