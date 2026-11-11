/**
 * Precompiled Metal for Flair authoring documents, so the Swift adapter (`FlairEditorEffects`) can
 * draw a document whose GLSL was edited, with no GLSL compiler on the device. `attachFlairMetal`
 * compiles the document's GLSL to Metal Shading Language (with `glslangValidator` and `spirv-cross`,
 * as `flair export metal` does) and keeps the result in the document's `provider.metal`, next to a
 * hash of the GLSL it was made from. Editors keep `provider` through saving and reopening, and drop
 * it when the source is edited, so stale Metal is never drawn.
 *
 * Node only (it runs the compilers).
 */

import { createHash } from "node:crypto";
import { EFFECT_META } from "../catalog/lazy.js";
import { describePlan, FLAIR_PROVIDER_ID, planOf, withControls } from "../integrations/effects.js";
import { parseControls, type ControlDef } from "../shader/controls.js";
import type { CompileError } from "../shader/program.js";
import { compileShaderToMetal } from "./metal.js";

/** `provider.metal` in a document: what the Swift adapter needs to draw its GLSL. */
export interface FlairMetalBlock {
  /** Format version (1). */
  version: 1;
  /** SHA-256 (hex) of the GLSL's UTF-8 bytes; Swift draws the block only for that exact source. */
  sourceHash: string;
  /** The fragment function in `msl`, unique to this source. */
  functionName: string;
  /** Metal Shading Language source. */
  msl: string;
  /** Byte size of the `FlairUniforms` buffer. */
  uniformByteLength: number;
  /** Scalar and vector controls in the buffer, with the ranges the Swift adapter clamps to. */
  fields: { name: string; type: string; offset: number; min: number; max: number; color: boolean }[];
  /** Texture and path controls bound outside the buffer. */
  samplers: { name: string; type: "sampler2D" | "path"; binding: number; filter: string; wrap: string; pathFit?: string; pathMargin?: number }[];
  /** The effect as the contract describes it with this source's controls. */
  description: Record<string, unknown>;
  /** Input name → the image control it fills. */
  inputs: Record<string, string>;
  transition: boolean;
}

export type AttachFlairMetalResult =
  | { ok: true; document: Record<string, unknown>; metal: FlairMetalBlock }
  | { ok: false; message: string; errors?: CompileError[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** SHA-256 of a GLSL source's UTF-8 bytes, as hex (`flairSourceHash` in Swift). */
export function flairSourceHash(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/** The GLSL a saved document draws: Flair's own document (the TypeScript adapter's), else the contract's `source`. */
export function documentGlsl(document: Record<string, unknown>): string | null {
  const flair = document.flair;
  if (isRecord(flair) && isRecord(flair.effect) && flair.effect.kind === "shader" && typeof flair.effect.source === "string") return flair.effect.source;
  if (typeof document.source === "string" && (document.sourceLanguage === undefined || document.sourceLanguage === "glsl")) return document.source;
  return null;
}

/**
 * Compiles a Flair authoring document's GLSL to Metal and returns the document with it in
 * `provider.metal` (other `provider` data is kept). Refuses, saying why, a document that is not a
 * Flair shader document, and GLSL that does not compile (with line-numbered errors). Needs
 * `glslangValidator` and `spirv-cross` (`metalToolsAvailable()` says whether they are installed).
 */
export function attachFlairMetal(document: unknown, options: { verify?: boolean } = {}): AttachFlairMetalResult {
  if (!isRecord(document)) return { ok: false, message: "The document must be an object saved with exportDocument." };
  if (document.providerId !== undefined && document.providerId !== FLAIR_PROVIDER_ID) {
    return { ok: false, message: `The document is for the provider ${JSON.stringify(document.providerId)}; only Flair's ("${FLAIR_PROVIDER_ID}") documents carry Flair's Metal.` };
  }
  const effectId = typeof document.effectId === "string" ? document.effectId : "";
  const meta = EFFECT_META.find((m) => m.id === effectId);
  if (!meta) return { ok: false, message: `The document's effectId ${JSON.stringify(effectId)} is not a Flair effect; findEffectMeta lists them.` };
  if (meta.kind !== "shader") return { ok: false, message: `"${effectId}" is a ${meta.kind} effect; only shader documents compile to Metal.` };
  const glsl = documentGlsl(document);
  if (glsl === null) return { ok: false, message: "The document has no GLSL: save it with Flair's authoring session (its `flair` document), or give `source` with sourceLanguage \"glsl\"." };

  const sourceHash = flairSourceHash(glsl);
  const controls: ControlDef[] = parseControls(glsl);
  const compiled = compileShaderToMetal(glsl, { id: `doc-${sourceHash.slice(0, 16)}`, controls, ...(options.verify && { verify: true }) });
  if (!compiled.ok) {
    return { ok: false, message: `The GLSL doesn't compile to Metal: ${compiled.errors.map((e) => (e.line > 0 ? `line ${e.line}: ${e.message}` : e.message)).join("; ")}`, errors: compiled.errors };
  }

  const plan = withControls(planOf(meta), controls);
  const byName = new Map(controls.map((c) => [c.name, c]));
  const name = typeof document.name === "string" && document.name.trim() ? document.name : meta.name;
  const metal: FlairMetalBlock = {
    version: 1,
    sourceHash,
    functionName: compiled.functionName,
    msl: compiled.msl,
    uniformByteLength: compiled.layout.byteLength,
    fields: compiled.layout.fields.map((f) => {
      const c = byName.get(f.name)!;
      return { name: f.name, type: f.type, offset: f.offset, min: c.min, max: c.max, color: c.color };
    }),
    samplers: compiled.layout.samplers.map((s) => ({
      name: s.name,
      type: s.type,
      binding: s.binding,
      filter: s.filter,
      wrap: s.wrap,
      ...(s.pathFit !== undefined && { pathFit: s.pathFit }),
      ...(s.pathMargin !== undefined && { pathMargin: s.pathMargin }),
    })),
    description: JSON.parse(JSON.stringify({ ...describePlan(plan, []), name })),
    inputs: Object.fromEntries(plan.inputs.map((i) => [i.name, i.uniform])),
    transition: plan.transition,
  };
  const provider = isRecord(document.provider) ? document.provider : {};
  return { ok: true, document: { ...document, provider: { ...provider, metal } }, metal };
}
