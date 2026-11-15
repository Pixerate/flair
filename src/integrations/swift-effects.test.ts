import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EFFECT_META, loadEffect } from "../catalog/lazy.js";
import { attachFlairMetal, documentGlsl } from "../export/metal-document.js";
import { metalToolsAvailable } from "../export/metal.js";
import { flairEffects, planOf } from "./effects.js";
import { DEFAULT_TEXT_TREATMENT, TEXT_TREATMENT_STAGES, textTreatmentControls, textTreatmentDuration, textTreatmentPlan, textTreatments, type TextTreatmentTarget } from "../catalog/treatment.js";

/**
 * The Swift adapter (`FlairEditorEffects`, the `EffectProvider` of the editor's Swift package)
 * describes Flair's Metal effects exactly as `flairEffects()` describes them, from a file written
 * here: each effect's description, with the image control each of its inputs fills and a hash of
 * the GLSL its Metal shader was made from (so Swift can tell a saved document still uses that
 * shader). When the catalog or the Metal package changes, this test fails until the file is written
 * again with `pnpm swift:meta` (which runs it with UPDATE_SWIFT_EFFECTS=1).
 *
 * It also writes a document saved by the TypeScript adapter's authoring session, which the Swift
 * tests open, draw and save again: documents cross between the two adapters. A second one has its
 * GLSL edited (a comment only, so it draws as the catalog shader does) and Metal compiled from it
 * (`attachFlairMetal`), which the Swift tests draw with run-time Metal. That one needs
 * `glslangValidator` and `spirv-cross`; without them it is checked against its GLSL, not rewritten.
 */
const SHADERS_DIR = resolve("swift/Sources/FlairEffects/Shaders");
const OUT_FILE = resolve("swift/Sources/FlairEditorEffects/Resources/flair-effects.json");
const DOCUMENT_FIXTURE = resolve("swift/Tests/FlairEditorEffectsTests/Fixtures/aurora-ts-document.json");
const METAL_FIXTURE = resolve("swift/Tests/FlairEditorEffectsTests/Fixtures/aurora-edited-metal-document.json");
const TREATMENTS_FILE = resolve("swift/Sources/FlairEffects/Resources/flair-text-treatments.json");
const TREATMENT_FIXTURE = resolve("swift/Tests/FlairEffectsTests/Fixtures/text-treatment-plans.json");
const EDIT = "\n// Edited on the web: a comment, so it draws as the catalog's Aurora.\n";

/** The shader effects the Metal package has: one `.metal` file each. */
function metalIds(): Set<string> {
  return new Set(
    readdirSync(SHADERS_DIR)
      .filter((f) => f.endsWith(".metal") && !f.startsWith("_"))
      .map((f) => f.slice(0, -".metal".length)),
  );
}

/** SHA-256 of a GLSL source's UTF-8 bytes, as hex (`flairSourceHash` in Swift). */
const sourceHash = (source: string) => createHash("sha256").update(source, "utf8").digest("hex");

async function generate(): Promise<string> {
  const ids = metalIds();
  const provider = flairEffects({ kinds: ["shader"] });
  const lines: string[] = [];
  for (const meta of EFFECT_META) {
    if (meta.kind !== "shader" || !ids.has(meta.id)) continue;
    const plan = planOf(meta);
    const description = await provider.describe(meta.id);
    const effect = await loadEffect(meta.id);
    if (effect.kind !== "shader") continue;
    const entry = {
      description,
      // Input name → the image control (Metal sampler) it fills.
      inputs: Object.fromEntries(plan.inputs.map((i) => [i.name, i.uniform])),
      ...(plan.transition && { transition: true }),
      sourceHash: sourceHash(effect.source),
    };
    lines.push(JSON.stringify(entry));
  }
  return `{"generatedBy":"pnpm swift:meta (src/integrations/swift-effects.test.ts)","effects":[\n${lines.join(",\n")}\n]}\n`;
}

/** A document the TypeScript adapter saves: Aurora with a preset, a changed value, keyframes, timing and a saved preset (and with `edit` appended to its GLSL). */
async function tsDocument(edit?: string): Promise<string> {
  const session = await flairEffects({ kinds: ["shader"] }).openAuthoring!({ effectId: "aurora", preset: "Ember" });
  try {
    const ok = (r: { ok: boolean; message?: string }) => expect(r.message).toBeUndefined();
    if (edit) ok(await session.setSource!(`${session.getState().source}${edit}`));
    ok(session.setTiming({ duration: 3000, loop: true }));
    ok(session.setValue("uSpeed", 0.8));
    ok(session.setKeyframe("uIntensity", 0, 0.2));
    ok(session.setKeyframe("uIntensity", 2000, 1.4, "ease-in-out"));
    ok(session.savePreset("Saved on the web"));
    return `${JSON.stringify(session.exportDocument(), null, 2)}\n`;
  } finally {
    session.dispose();
  }
}

/**
 * The text treatments as data for `FlairTextTreatments` (Swift), which plans them with the same
 * arithmetic as `textTreatmentPlan`: their controls, presets and stages, placeholders and all.
 */
function treatmentsFile(): string {
  const lines = textTreatments.map((t) =>
    JSON.stringify({
      id: t.id,
      name: t.name,
      description: t.description,
      tags: t.tags,
      controls: textTreatmentControls(t).map((c) => ({ name: c.name, type: c.type, label: c.label, color: c.color, default: c.default, min: c.min, max: c.max })),
      presets: t.presets ?? [],
      stages: t.stages,
    }),
  );
  return `{"generatedBy":"pnpm swift:meta (src/integrations/swift-effects.test.ts)","default":${JSON.stringify(DEFAULT_TEXT_TREATMENT)},"treatments":[\n${lines.join(",\n")}\n]}\n`;
}

/**
 * Plans the Swift tests compute again and compare (conformance): every treatment's every stage, at
 * several moments, with and without motion, over a wrapped range with a caret, a typed word, a name
 * tag and colours; and with a preset, a colour value and the caret blinking, over one line.
 */
function treatmentFixture(): string {
  const wrapped: TextTreatmentTarget = {
    lines: [
      { x: 40, y: 0, width: 120, height: 20 },
      { x: 0, y: 24, width: 64.5, height: 20 },
    ],
    caret: { x: 64.5, y: 24, height: 20 },
    text: "word",
    label: "Agent",
    color: "#1d1d1f",
    background: "#ffffff",
  };
  const single: TextTreatmentTarget = { lines: [{ x: 12, y: 30, width: 88, height: 17 }], caret: { x: 100, y: 30, height: 17 }, label: "Claude", background: "#202124" };
  const cases: unknown[] = [];
  for (const t of textTreatments) {
    for (const stage of TEXT_TREATMENT_STAGES) {
      for (const reduceMotion of [false, true]) {
        const d = textTreatmentDuration(t, stage, wrapped, { reduceMotion });
        for (const f of [0.1, 0.35, 0.5, 0.8, 1.3]) {
          const time = Math.round(d * f * 1000) / 1000;
          const plan = textTreatmentPlan(t, { stage, time, target: wrapped, reduceMotion });
          cases.push({ id: t.id, stage, time, reduceMotion, target: wrapped, plan });
        }
      }
      const preset = t.presets![1]!.name;
      const values = { color: "#3366cc", blink: true };
      const d = textTreatmentDuration(t, stage, single, { preset, values });
      for (const f of [0.3, 0.6]) {
        const time = Math.round(d * f * 1000) / 1000;
        cases.push({ id: t.id, stage, time, reduceMotion: false, preset, values, target: single, plan: textTreatmentPlan(t, { stage, time, target: single, preset, values }) });
      }
    }
  }
  return `{"generatedBy":"pnpm swift:meta (src/integrations/swift-effects.test.ts)","cases":[\n${cases.map((c) => JSON.stringify(c)).join(",\n")}\n]}\n`;
}

describe("the Swift text treatments", () => {
  it("are the catalog's, as data (pnpm swift:meta writes them)", () => {
    const text = treatmentsFile();
    if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(TREATMENTS_FILE, text);
    expect(existsSync(TREATMENTS_FILE) && readFileSync(TREATMENTS_FILE, "utf8") === text, "Run `pnpm swift:meta`: the text treatments have changed.").toBe(true);
  });

  it("come with plans for the Swift tests to match (pnpm swift:meta writes them)", () => {
    const text = treatmentFixture();
    if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(TREATMENT_FIXTURE, text);
    expect(existsSync(TREATMENT_FIXTURE) && readFileSync(TREATMENT_FIXTURE, "utf8") === text, "Run `pnpm swift:meta`: the text treatments' plans have changed.").toBe(true);
  });
});

describe("the Swift adapter's effect descriptions", () => {
  it("cover every Metal effect, as flairEffects() describes it (pnpm swift:meta writes them)", async () => {
    const text = await generate();
    if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(OUT_FILE, text);
    const parsed = JSON.parse(text) as { effects: { description: { id: string } }[] };
    expect(parsed.effects.length).toBe([...metalIds()].filter((id) => EFFECT_META.some((m) => m.id === id && m.kind === "shader")).length);
    expect(existsSync(OUT_FILE) && readFileSync(OUT_FILE, "utf8") === text, "Run `pnpm swift:meta`: the catalog or the Metal package has changed.").toBe(true);
  });

  it("come with a document the TypeScript adapter saved, for the Swift tests to open (pnpm swift:meta writes it)", async () => {
    const text = await tsDocument();
    if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(DOCUMENT_FIXTURE, text);
    const doc = JSON.parse(text) as { flair: { effect: { source: string } } };
    // The Swift adapter draws it with Aurora's Metal shader because its GLSL is the catalog's.
    expect(sourceHash(doc.flair.effect.source)).toBe(sourceHash(((await loadEffect("aurora")) as { source: string }).source));
    expect(existsSync(DOCUMENT_FIXTURE) && readFileSync(DOCUMENT_FIXTURE, "utf8") === text, "Run `pnpm swift:meta`: the TypeScript adapter's documents have changed.").toBe(true);
  });

  it("come with an edited document carrying Metal compiled from its GLSL (pnpm swift:meta writes it where the Metal tools are)", async () => {
    const edited = JSON.parse(await tsDocument(EDIT)) as Record<string, unknown>;
    const glsl = documentGlsl(edited)!;
    expect(glsl.endsWith(EDIT)).toBe(true);
    if (metalToolsAvailable().ok) {
      const attached = attachFlairMetal(edited);
      if (!attached.ok) throw new Error(attached.message);
      const text = `${JSON.stringify(attached.document, null, 2)}\n`;
      if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(METAL_FIXTURE, text);
      expect(existsSync(METAL_FIXTURE) && readFileSync(METAL_FIXTURE, "utf8") === text, "Run `pnpm swift:meta` (with glslangValidator and spirv-cross installed).").toBe(true);
    } else {
      // Without the compilers: the committed document is still this GLSL, and its Metal was made from it.
      const committed = JSON.parse(readFileSync(METAL_FIXTURE, "utf8")) as Record<string, unknown> & { provider: { metal: { sourceHash: string } } };
      expect(documentGlsl(committed), "Run `pnpm swift:meta` where glslangValidator and spirv-cross are installed.").toBe(glsl);
      expect(committed.provider.metal.sourceHash).toBe(sourceHash(glsl));
    }
  });
});
