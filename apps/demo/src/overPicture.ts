import type { EffectDefinition } from "@pixerate/flair/catalog";

/**
 * Whether the demo shows an effect over a picture: overlays, annotations and
 * broadcast overlays (lower thirds, tickers: transparent vector frames), and
 * any shader that draws on a transparent canvas (sparks, splats, bubbles…),
 * so what it adds is seen against something.
 */
export function showsOverPicture(effect: EffectDefinition | undefined): boolean {
  if (!effect) return false;
  if (effect.category === "overlay" || effect.category === "annotation") return true;
  if (effect.category === "broadcast") return effect.tags.includes("overlay");
  return effect.kind === "shader" && Boolean(effect.transparent);
}
