/**
 * Catalog search, on whatever describes an effect: a full definition (the
 * catalog) or its metadata (the lazy catalog), so both answer a query the
 * same way.
 */

import { EFFECT_CATEGORY_GROUPS, type EffectCategory, type EffectDefinition, type VideoUse } from "./types.js";
import type { EffectInput, EffectInputs, EffectInteraction } from "./inputs.js";

export interface EffectQuery {
  /** Words to look for in the name, description, tags and id (all must match). */
  text?: string;
  category?: EffectCategory;
  /** Effects in any category of the group with this name (`EFFECT_CATEGORY_GROUPS`, any case). */
  group?: string;
  kind?: EffectDefinition["kind"];
  /** Effects with every one of these tags (any case; spaces count as hyphens, so "Game Boy" is `game-boy`). */
  tags?: readonly string[];
  /** Effects that suit video in one of these ways (shader effects with image controls only). */
  video?: readonly VideoUse[];
  /** Effects that can be given every one of these (see `effectInputs`): `["image"]`, `["text"]`, `["svg"]`… */
  accepts?: readonly EffectInput[];
  /** Effects that answer the pointer in at least one of these ways; `[]` for effects that don't answer it at all. */
  interaction?: readonly EffectInteraction[];
  /** Overlays (`true`), which draw over other content, or effects that fill their frame (`false`). */
  transparent?: boolean;
  /** Effects designed to modify a single picture (exactly one image slot wanting a picture). */
  singlePicture?: boolean;
  /** Target output format: "animation" for animated SVGs, "video" for video shaders. */
  output?: "animation" | "video";
}

/** What a query looks at in an effect. */
export interface QueryTarget {
  id: string;
  name: string;
  description: string;
  category: EffectCategory;
  tags: readonly string[];
  kind: EffectDefinition["kind"];
  video?: VideoUse;
}

/** How tags are written: lower case, words joined by hyphens (`motion-blur`, `8-bit`). */
export const TAG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A tag as the catalog writes it: lower case, with spaces and underscores as hyphens. */
export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

/** A tag and how many effects carry it. */
export interface EffectTag {
  tag: string;
  count: number;
}

/** The tags these effects carry, the most used first (then A to Z). */
export function countTags(targets: readonly Pick<QueryTarget, "tags">[]): EffectTag[] {
  const counts = new Map<string, number>();
  for (const t of targets) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Whether inputs show an effect made to change one picture: one image slot, wanting a picture. */
export function singlePicture(inputs: EffectInputs): boolean {
  return inputs.accepts.includes("image") && inputs.images.length === 1 && inputs.images[0]?.wants === "picture";
}

/** A query's words to look for, lower case. */
export function queryWords(query: EffectQuery): string[] {
  return (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether `target` (with its inputs, worked out only when the query needs them) answers `query`. */
export function matchesQuery(target: QueryTarget, inputsOf: () => EffectInputs, query: EffectQuery, words = queryWords(query)): boolean {
  const e = target;
  if (query.category && e.category !== query.category) return false;
  if (query.group && !EFFECT_CATEGORY_GROUPS.find((g) => g.name.toLowerCase() === query.group!.toLowerCase())?.categories.includes(e.category)) return false;
  if (query.kind && e.kind !== query.kind) return false;
  if (query.tags && !query.tags.every((t) => e.tags.includes(normaliseTag(t)))) return false;
  if (query.video && !(e.kind === "shader" && e.video && query.video.includes(e.video))) return false;
  if (query.output === "animation" && e.kind !== "vector") return false;
  if (query.output === "video" && !(e.kind === "shader" && e.video !== "none")) return false;
  if (query.singlePicture !== undefined && singlePicture(inputsOf()) !== query.singlePicture) return false;
  if (query.accepts || query.interaction || query.transparent !== undefined) {
    const inputs = inputsOf();
    if (query.accepts && !query.accepts.every((i) => inputs.accepts.includes(i))) return false;
    if (query.interaction) {
      const answers = query.interaction.length === 0 ? inputs.interactions.length === 0 : query.interaction.some((i) => inputs.interactions.includes(i));
      if (!answers) return false;
    }
    if (query.transparent !== undefined && inputs.transparent !== query.transparent) return false;
  }
  const haystack = [e.id, e.name, e.description, e.category, ...e.tags].join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}
