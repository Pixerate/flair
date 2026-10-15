/**
 * GLSL helpers the catalog's shaders are built from. Each effect's source
 * inlines the helpers it uses, so a source stays self-contained: copy it into
 * any Shadertoy-style host and it compiles.
 */

/** Hashes: `hash12` (vec2 → float), `hash22` (vec2 → vec2), both 0–1. */
export const HASH = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}`.trim();

/** Smooth value noise, 0–1 (needs {@link HASH}). */
export const NOISE = `
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`.trim();

/** Fractal noise: `fbm(p, octaves)`, about 0–1 (needs {@link NOISE}). */
export const FBM = `
float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * vnoise(p);
    p = turn * p * 2.02 + 17.0;
    amp *= 0.5;
  }
  return sum;
}`.trim();

/** Inigo Quilez's cosine palette: `palette(t, a, b, c, d)`. */
export const PALETTE = `
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}`.trim();

/** Mixes colours in Oklab, so blends stay bright: `oklabMix(a, b, t)` on sRGB colours. */
export const OKLAB_MIX = `
vec3 toOklab(vec3 c) {
  c = pow(max(c, 0.0), vec3(2.2));
  vec3 lms = mat3(0.4122, 0.2119, 0.0883, 0.5363, 0.6807, 0.2817, 0.0514, 0.1074, 0.6300) * c;
  lms = pow(lms, vec3(1.0 / 3.0));
  return mat3(0.2105, 1.9780, 0.0259, 0.7936, -2.4286, 0.7828, -0.0041, 0.4506, -0.8087) * lms;
}
vec3 fromOklab(vec3 c) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963, -0.1056, -0.0895, 0.2158, -0.0639, -1.2915) * c;
  lms = lms * lms * lms;
  vec3 rgb = mat3(4.0767, -1.2684, -0.0042, -3.3077, 2.6098, -0.7034, 0.2310, -0.3413, 1.7076) * lms;
  return pow(max(rgb, 0.0), vec3(1.0 / 2.2));
}
vec3 oklabMix(vec3 a, vec3 b, float t) {
  return fromOklab(mix(toOklab(a), toOklab(b), t));
}`.trim();

/** 2D rotation matrix: `rot(angle)`. */
export const ROTATE = `
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}`.trim();

/** Joins helpers and a body into one source, a blank line apart. */
export function glsl(...parts: string[]): string {
  return parts.map((p) => p.trim()).join("\n\n") + "\n";
}
