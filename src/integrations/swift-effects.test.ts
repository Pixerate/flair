import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EFFECT_META, loadEffect } from "../catalog/lazy.js";
import { attachFlairMetal, documentGlsl } from "../export/metal-document.js";
import { metalToolsAvailable } from "../export/metal.js";
import { flairEffects, planOf } from "./effects.js";

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
