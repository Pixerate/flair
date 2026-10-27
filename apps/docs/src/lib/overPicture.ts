/**
 * Whether to show an effect over a background image: overlays, annotations,
 * and transparent shaders (sparks, flames, loaders, etc.), so what they add is seen against something.
 */
export function showsOverPicture(effect: { kind?: string; category?: string; tags?: string[]; transparent?: boolean } | undefined): boolean {
  if (!effect) return false;
  if (effect.category === "overlay" || effect.category === "annotation") return true;
  if (effect.category === "broadcast") return Boolean(effect.tags?.includes("overlay"));
  return effect.kind === "shader" && Boolean(effect.transparent);
}
