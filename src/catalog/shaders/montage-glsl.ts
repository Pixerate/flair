/** GLSL shared by the montage shaders (see `montage.ts`). */

/** A background, off by default, and how it is composited under the devices. */
export const BACKGROUND = `
uniform vec3 uBackground;       // @control color default=#EEF2FF label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

/** `over(acc, c, a)` onto a premultiplied accumulator; `finish(acc)` puts it over the background. */
export const COMPOSITE = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 finish(vec4 acc) {
  vec4 base = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  vec4 o = vec4(acc.rgb + base.rgb * (1.0 - acc.a), acc.a + base.a * (1.0 - acc.a));
  return vec4(o.rgb / max(o.a, 1e-4), o.a);
}`.trim();

/** `screenRGBA(tex, suv, aspect)`: a screenshot filling a screen of that aspect (cover, top-aligned, as screenshots read). */
export const SCREEN = `
vec4 screenRGBA(sampler2D tex, vec2 suv, float aspect) {
  ivec2 ts = textureSize(tex, 0);
  vec2 uv = suv;
  if (ts.x > 1 && ts.y > 1) {
    float texAspect = float(ts.x) / float(ts.y);
    // Cover: fill the screen, cropping the overflow; a tall screenshot is cropped from the bottom.
    if (texAspect > aspect) uv.x = (suv.x - 0.5) * aspect / texAspect + 0.5;
    else uv.y = 1.0 - (1.0 - suv.y) * texAspect / aspect;
  }
  return pictureRGBA(tex, uv);
}`.trim();
