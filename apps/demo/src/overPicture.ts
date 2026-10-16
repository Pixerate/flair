import type { EffectDefinition } from "@pixerate/flair/catalog";

/**
 * Whether the demo shows an effect over a picture: overlays, and any shader
 * that draws on a transparent canvas (sparks, splats, bubbles…), so what it
 * adds is seen against something.
 */
export function showsOverPicture(effect: EffectDefinition | undefined): boolean {
  if (!effect) return false;
  return effect.category === "overlay" || (effect.kind === "shader" && Boolean(effect.transparent));
}
