/**
 * Opening animations made with `@pixerate/editor`'s animation editor
 * (`@pixerate/editor/animation-editor`): a scene of shots over vector
 * artwork becomes a vector effect document, with the scene's colour controls
 * as `{{name: color}}` placeholders and its presets kept.
 */

import { checkMotionScene, motionIssueLine, parseMotionScene, toFlairEffectDocument, type MotionScene } from "@pixerate/editor/animation-editor";
import { parseEffectDocument, type EffectDocument } from "./document.js";

export type { MotionScene };

export interface AnimationImportOptions {
  /** Sampling rate for motion Flair cannot express exactly (default: the scene's `fps`, else 30). */
  fps?: number;
}

export type AnimationImport =
  | {
      ok: true;
      document: EffectDocument;
      /** The scene's warnings and notes, as lines; they do not stop the import. */
      warnings: string[];
    }
  | { ok: false; message: string };

/**
 * A vector effect document from an animation-editor scene (JSON text or a
 * parsed object). Refuses a malformed scene, or one with errors (an unknown
 * node id, say), listing every problem.
 */
export function effectDocumentFromAnimation(scene: unknown, options: AnimationImportOptions = {}): AnimationImport {
  let parsed: MotionScene;
  try {
    parsed = parseMotionScene(scene);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  const issues = checkMotionScene(parsed);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) return { ok: false, message: `The animation has ${errors.length} error${errors.length === 1 ? "" : "s"}: ${errors.map(motionIssueLine).join(" ")}` };
  const exported = toFlairEffectDocument(parsed, options.fps ? { fps: options.fps } : {});
  const checked = parseEffectDocument(exported);
  if (!checked.ok) return { ok: false, message: `The exported effect is not valid: ${checked.errors.join("; ")}` };
  return {
    ok: true,
    document: checked.document,
    warnings: issues.filter((i) => i.severity !== "error").map((i) => `${i.severity}: ${motionIssueLine(i)}`),
  };
}
