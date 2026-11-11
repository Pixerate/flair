import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLAIR_EFFECT_SWIFT,
  FLAIR_EFFECT_VIEW_SWIFT,
  FLAIR_INPUTS_SWIFT,
  FLAIR_PATH_AND_TEXT_SWIFT,
  FLAIR_PIPELINE_SWIFT,
  FLAIR_RENDERER_SWIFT,
  FLAIR_RUNTIME_EFFECT_SWIFT,
  FLAIR_TYPES_SWIFT,
} from "./metal-swift-templates.js";

/**
 * `flair export metal` writes the Swift package's runtime files from these templates, so an edit
 * to a committed file that is not made in its template too is lost on the next export.
 */
const FILES: Record<string, string> = {
  "FlairTypes.swift": FLAIR_TYPES_SWIFT,
  "FlairEffect.swift": FLAIR_EFFECT_SWIFT,
  "FlairRuntimeEffect.swift": FLAIR_RUNTIME_EFFECT_SWIFT,
  "FlairPathAndText.swift": FLAIR_PATH_AND_TEXT_SWIFT,
  "FlairInputs.swift": FLAIR_INPUTS_SWIFT,
  "FlairRenderer.swift": FLAIR_RENDERER_SWIFT,
  "FlairPipeline.swift": FLAIR_PIPELINE_SWIFT,
  "FlairEffectView.swift": FLAIR_EFFECT_VIEW_SWIFT,
};

describe("the Swift package's runtime files", () => {
  for (const [file, template] of Object.entries(FILES)) {
    it(`${file} is what \`flair export metal\` writes (edit src/export/metal-swift-templates.ts with it)`, () => {
      expect(readFileSync(resolve("swift/Sources/FlairEffects", file), "utf8")).toBe(template);
    });
  }
});
