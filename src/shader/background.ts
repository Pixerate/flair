/**
 * Background opacity for shaders that paint their own background colour.
 *
 * Many generators draw light over a solid `uBackground` colour and return an
 * opaque frame. {@link withBackgroundOpacity} gives such a source a
 * `uBackgroundAlpha` control ("Background opacity", default 1, so nothing
 * changes until it is lowered). Below 1 the background colour is keyed out of
 * the frame (colour to alpha): each pixel becomes the most transparent colour
 * that, laid over the background colour, gives the pixel back. Light added to
 * a dark background keeps its hue and glow; at 0 the background is gone and
 * the effect sits over whatever is under it.
 */

/** The background colour control a source must declare to take a background opacity. */
const BACKGROUND = /^\s*uniform\s+vec3\s+uBackground\s*;\s*\/\/\s*@control\b[^\n]*\bcolor\b/m;
const MAIN_IMAGE = /\bmainImage\b/g;

/** The opacity control's name: the same one the catalog's hand-written overlays declare. */
export const BACKGROUND_OPACITY_CONTROL = "uBackgroundAlpha";

const KEY = `
vec4 flair_backgroundOpacity(vec4 c, vec3 bg, float opacity) {
  if (opacity >= 1.0) return c;
  vec3 d = clamp(c.rgb, 0.0, 1.0) - bg;
  vec3 room = mix(bg, 1.0 - bg, step(0.0, d));
  vec3 k = abs(d) / max(room, vec3(1e-4));
  float a = clamp(max(k.r, max(k.g, k.b)), 0.0, 1.0);
  vec3 fg = a > 0.0 ? bg + d / a : bg;
  float alpha = a + opacity * (1.0 - a);
  vec3 col = alpha > 0.0 ? (fg * a + bg * opacity * (1.0 - a)) / alpha : bg;
  return vec4(col, alpha * c.a);
}
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  flair_opaqueImage(fragColor, fragCoord);
  fragColor = flair_backgroundOpacity(fragColor, uBackground, uBackgroundAlpha);
}`;

/**
 * Whether a source paints its own background colour (`uBackground`, a colour
 * control) without a background opacity of its own.
 */
export function takesBackgroundOpacity(source: string): boolean {
  return BACKGROUND.test(source) && !source.includes(BACKGROUND_OPACITY_CONTROL) && /\bvoid\s+mainImage\s*\(/.test(source);
}

/**
 * The source with a `uBackgroundAlpha` control that keys its background
 * colour out (see the module comment), or the source unchanged when it has no
 * `uBackground` colour control or already has a background opacity. The
 * source's own lines keep their numbers: its `mainImage` is renamed in place
 * and the key is added after it.
 */
export function withBackgroundOpacity(source: string): string {
  if (!takesBackgroundOpacity(source)) return source;
  return `${source.replace(MAIN_IMAGE, "flair_opaqueImage").trimEnd()}\n${KEY}\n`;
}
