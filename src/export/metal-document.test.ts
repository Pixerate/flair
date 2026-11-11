import { describe, expect, it } from "vitest";
import { EFFECT_META, loadEffect } from "../catalog/lazy.js";
import { attachFlairMetal, documentGlsl, flairSourceHash } from "./metal-document.js";
import { metalToolsAvailable } from "./metal.js";

const tools = metalToolsAvailable();

async function auroraDocument(edit = "\n// edited\n") {
  const effect = await loadEffect("aurora");
  if (effect.kind !== "shader") throw new Error("aurora is a shader");
  const source = `${effect.source}${edit}`;
  return { version: 1, providerId: "flair", effectId: "aurora", name: "Aurora", values: {}, tracks: {}, presets: [], duration: 4000, loop: true, source, sourceLanguage: "glsl" };
}

describe("attachFlairMetal", () => {
  it("finds a document's GLSL in Flair's own document, else the contract's source", async () => {
    const doc = await auroraDocument();
    expect(documentGlsl(doc)).toBe(doc.source);
    expect(documentGlsl({ ...doc, flair: { effect: { kind: "shader", source: "void mainImage() {}" } } })).toBe("void mainImage() {}");
    expect(documentGlsl({ ...doc, sourceLanguage: "pixel" })).toBeNull();
    expect(flairSourceHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("refuses what is not a Flair shader document, saying why", async () => {
    const doc = await auroraDocument();
    expect(attachFlairMetal("doc")).toEqual({ ok: false, message: "The document must be an object saved with exportDocument." });
    expect(attachFlairMetal({ ...doc, providerId: "pixel" })).toMatchObject({ ok: false, message: expect.stringContaining('provider "pixel"') });
    expect(attachFlairMetal({ ...doc, effectId: "auroa" })).toMatchObject({ ok: false, message: expect.stringContaining("findEffectMeta") });
    expect(attachFlairMetal({ ...doc, effectId: EFFECT_META.find((m) => m.kind === "vector")!.id })).toMatchObject({ ok: false, message: expect.stringContaining("only shader documents") });
    const { source: _, ...noSource } = doc;
    expect(attachFlairMetal(noSource)).toMatchObject({ ok: false, message: expect.stringContaining("has no GLSL") });
  });

  it.skipIf(!tools.ok)("compiles the GLSL to Metal with its layout and description, keeping other provider data", async () => {
    const doc = { ...(await auroraDocument()), provider: { other: 1 } };
    const result = attachFlairMetal(doc);
    if (!result.ok) throw new Error(result.message);
    const { metal } = result;
    expect(result.document.provider).toMatchObject({ other: 1, metal: { version: 1 } });
    expect(metal.sourceHash).toBe(flairSourceHash(doc.source));
    expect(metal.functionName).toBe(`flair_doc_${metal.sourceHash.slice(0, 16)}_frag`);
    expect(metal.msl).toContain(metal.functionName);
    expect(metal.fields.map((f) => f.name)).toEqual(["uSky", "uGlowA", "uGlowB", "uSpeed", "uIntensity", "uHeight"]);
    expect(metal.fields[0]).toMatchObject({ type: "vec3", offset: 992, min: 0, max: 1, color: true });
    expect(metal.description).toMatchObject({ id: "aurora", name: "Aurora", kind: "shader" });
    expect(metal.transition).toBe(false);
  });

  it.skipIf(!tools.ok)("refuses GLSL that doesn't compile, with its lines", async () => {
    const result = attachFlairMetal(await auroraDocument("\nvoid broken( {\n"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/^The GLSL doesn't compile to Metal: line \d+/);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});
