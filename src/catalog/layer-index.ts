/**
 * Every catalog effect a scene layer can use, in a few kilobytes: its id,
 * kind, what it takes, and whether it is a transition or draws over other
 * content. `validateScene` checks layers against it without loading the
 * catalog (the controls and presets are checked against the lazy catalog,
 * which is loaded on demand).
 */

import type { EffectInput } from "./inputs.js";
import { LAYER_INDEX } from "./layer-index.generated.js";

export interface LayerIndexEntry {
  id: string;
  kind: "shader" | "vector";
  accepts: EffectInput[];
  /** Blends two pictures (`uFrom` into `uTo` by `uProgress`): it goes in a shot's `transition`. */
  transition: boolean;
  /** Draws over other content, with transparency. */
  transparent: boolean;
}

/** The letters the index writes each input as. */
export const INPUT_LETTERS: Record<EffectInput, string> = { image: "i", video: "v", svg: "g", text: "t", mask: "m", path: "p", audio: "a" };

/** One effect as the index writes it: `id:kind:inputs:flags`. */
export function packLayerEntry(e: LayerIndexEntry): string {
  return [e.id, e.kind === "shader" ? "s" : "v", e.accepts.map((a) => INPUT_LETTERS[a]).join(""), `${e.transition ? "t" : ""}${e.transparent ? "o" : ""}`].join(":");
}

let byId: Map<string, LayerIndexEntry> | undefined;

function entries(): Map<string, LayerIndexEntry> {
  if (byId) return byId;
  const inputs = new Map(Object.entries(INPUT_LETTERS).map(([k, v]) => [v, k as EffectInput]));
  byId = new Map();
  for (const packed of LAYER_INDEX.split(" ")) {
    const [id, kind, accepts, flags] = packed.split(":") as [string, string, string, string];
    byId.set(id, { id, kind: kind === "s" ? "shader" : "vector", accepts: [...accepts].map((c) => inputs.get(c)!), transition: flags.includes("t"), transparent: flags.includes("o") });
  }
  return byId;
}

/** The effect a layer or transition names, or undefined when the catalog has no such shader or vector effect. */
export function layerEffect(id: string): LayerIndexEntry | undefined {
  return entries().get(id);
}

/** Every effect's id in the index, in catalog order. */
export function layerEffectIds(): string[] {
  return [...entries().keys()];
}
