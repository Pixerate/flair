import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EFFECT_META } from "../catalog/lazy.js";
import { flairEffects, planOf } from "./effects.js";

/**
 * The Swift adapter (`FlairEditorEffects`, the `EffectProvider` of the editor's Swift package)
 * describes Flair's Metal effects exactly as `flairEffects()` describes them, from a file written
 * here: each effect's description, with the image control each of its inputs fills. When the
 * catalog or the Metal package changes, this test fails until the file is written again with
 * `pnpm swift:meta` (which runs it with UPDATE_SWIFT_EFFECTS=1).
 */
const SHADERS_DIR = resolve("swift/Sources/FlairEffects/Shaders");
const OUT_FILE = resolve("swift/Sources/FlairEditorEffects/Resources/flair-effects.json");

/** The shader effects the Metal package has: one `.metal` file each. */
function metalIds(): Set<string> {
  return new Set(
    readdirSync(SHADERS_DIR)
      .filter((f) => f.endsWith(".metal") && !f.startsWith("_"))
      .map((f) => f.slice(0, -".metal".length)),
  );
}

async function generate(): Promise<string> {
  const ids = metalIds();
  const provider = flairEffects({ kinds: ["shader"] });
  const lines: string[] = [];
  for (const meta of EFFECT_META) {
    if (meta.kind !== "shader" || !ids.has(meta.id)) continue;
    const plan = planOf(meta);
    const description = await provider.describe(meta.id);
    const entry = {
      description,
      // Input name → the image control (Metal sampler) it fills.
      inputs: Object.fromEntries(plan.inputs.map((i) => [i.name, i.uniform])),
      ...(plan.transition && { transition: true }),
    };
    lines.push(JSON.stringify(entry));
  }
  return `{"generatedBy":"pnpm swift:meta (src/integrations/swift-effects.test.ts)","effects":[\n${lines.join(",\n")}\n]}\n`;
}

describe("the Swift adapter's effect descriptions", () => {
  it("cover every Metal effect, as flairEffects() describes it (pnpm swift:meta writes them)", async () => {
    const text = await generate();
    if (process.env.UPDATE_SWIFT_EFFECTS) writeFileSync(OUT_FILE, text);
    const parsed = JSON.parse(text) as { effects: { description: { id: string } }[] };
    expect(parsed.effects.length).toBe([...metalIds()].filter((id) => EFFECT_META.some((m) => m.id === id && m.kind === "shader")).length);
    expect(existsSync(OUT_FILE) && readFileSync(OUT_FILE, "utf8") === text, "Run `pnpm swift:meta`: the catalog or the Metal package has changed.").toBe(true);
  });
});
