/**
 * GLSL helpers the catalog's shaders are built from. Each effect's source
 * inlines the helpers it uses, so a source stays self-contained: copy it into
 * any Shadertoy-style host and it compiles.
 */

import { withBackgroundOpacity } from "../shader/background.js";

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

/**
 * The rainbow: `spectrum(x)` runs red (0) through green to violet (1), for
 * light split by glass. Weighting samples taken along a shift by their
 * colour and dividing by the summed weights gives back white where nothing
 * changes and colour fringes at edges.
 */
export const SPECTRUM = `
vec3 spectrum(float x) {
  vec3 d = (vec3(x) - vec3(0.2, 0.5, 0.8)) / 0.3;
  vec3 c = clamp(1.0 - d * d, 0.0, 1.0);
  c.r += 0.35 * clamp(1.0 - (x - 0.95) * (x - 0.95) / 0.0225, 0.0, 1.0);
  return c;
}`.trim();

/** 2D rotation matrix: `rot(angle)`. */
export const ROTATE = `
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}`.trim();

/**
 * Path helpers, for a `path` control (`uniform sampler2D uPath; // @control
 * path …`; the texture is laid out in `shader/path.ts`). Distances are in
 * frame pixels, positions in `fragCoord` pixels:
 * - `pathLength(path)`: the path's length;
 * - `pathNearest(path, p)` (or `pathNearest(path, p, from, to)`, only the
 *   part from `from` to `to` pixels along): x = distance to the nearest
 *   point, y = how far along the path it is, z = the side p is on (+1 right
 *   of the way the path goes, as seen, -1 left), w = 1 (0 with no path);
 * - `pathAt(path, along)`: xy = the point that far along, zw = the way the
 *   path goes there (a unit vector);
 * - `pathHits(path, p, radius, gap, from, to, hits)`: each pass of the path
 *   within `radius` of p, up to four, as `pathNearest` gives it; points
 *   closer than `gap` along the path count as one pass. Returns how many.
 *   Draw them in order of y (how far along) for a path that crosses itself.
 */
export const PATH = `
vec3 pathFrame(sampler2D path) {
  vec4 meta = texelFetch(path, ivec2(0, 1), 0);
  if (meta.w < 0.5) return vec3(0.0, 0.0, 1.0);
  vec4 b = texelFetch(path, ivec2(1, 1), 0);
  float margin = texelFetch(path, ivec2(2, 1), 0).x * min(iResolution.x, iResolution.y);
  vec2 size = b.zw - b.xy;
  vec2 s = (iResolution.xy - 2.0 * margin) / max(size, vec2(1e-6));
  float k = size.x < 1e-6 ? s.y : size.y < 1e-6 ? s.x : meta.w < 1.5 ? min(s.x, s.y) : max(s.x, s.y);
  return vec3(iResolution.xy * 0.5 - (b.xy + size * 0.5) * k, k);
}
vec2 pathUnits(vec3 f, vec2 p) {
  return (vec2(p.x, iResolution.y - p.y) - f.xy) / f.z;
}
float pathLength(sampler2D path) {
  return texelFetch(path, ivec2(0, 1), 0).y * pathFrame(path).z;
}
int pathHits(sampler2D path, vec2 p, float radius, float gap, float from, float to, out vec4 hits[4]) {
  for (int j = 0; j < 4; j++) hits[j] = vec4(1e20, 0.0, 1.0, 0.0);
  vec4 meta = texelFetch(path, ivec2(0, 1), 0);
  vec3 f = pathFrame(path);
  vec2 q = pathUnits(f, p);
  float r = radius / f.z;
  float lo = from / f.z;
  float hi = to / f.z;
  int n = int(meta.x);
  int chunks = int(meta.z);
  int count = 0;
  for (int c = 0; c < 64; c++) {
    if (c >= chunks) break;
    vec4 bb = texelFetch(path, ivec2(3 + c, 1), 0);
    vec2 out_ = max(max(bb.xy - q, q - bb.zw), 0.0);
    if (dot(out_, out_) > r * r) continue;
    int last = min(c * 16 + 16, n - 1);
    for (int i = c * 16; i < last; i++) {
      vec4 a = texelFetch(path, ivec2(i, 0), 0);
      vec4 b = texelFetch(path, ivec2(i + 1, 0), 0);
      if (b.w < 0.5 || b.z < lo || a.z > hi) continue;
      // Only the part between from and to.
      float span = max(b.z - a.z, 1e-9);
      vec2 a2 = mix(a.xy, b.xy, clamp((lo - a.z) / span, 0.0, 1.0));
      vec2 b2 = mix(a.xy, b.xy, clamp((hi - a.z) / span, 0.0, 1.0));
      float z0 = max(a.z, lo);
      float z1 = min(b.z, hi);
      vec2 ab = b2 - a2;
      vec2 aq = q - a2;
      float h = clamp(dot(aq, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
      vec2 e = aq - ab * h;
      float d = length(e);
      if (d > r) continue;
      vec4 hit = vec4(d * f.z, mix(z0, z1, h) * f.z, ab.x * aq.y - ab.y * aq.x < 0.0 ? -1.0 : 1.0, 1.0);
      // The same pass as a hit already found: keep the nearer.
      int slot = -1;
      int worst = 0;
      for (int j = 0; j < 4; j++) {
        if (j < count && abs(hits[j].y - hit.y) < gap) slot = j;
        if (hits[j].x > hits[worst].x) worst = j;
      }
      if (slot >= 0) {
        if (hit.x < hits[slot].x) hits[slot] = hit;
      } else if (count < 4) {
        hits[count] = hit;
        count++;
      } else if (hit.x < hits[worst].x) {
        hits[worst] = hit;
      }
    }
  }
  return count;
}
vec4 pathNearest(sampler2D path, vec2 p, float from, float to) {
  vec4 meta = texelFetch(path, ivec2(0, 1), 0);
  vec3 f = pathFrame(path);
  vec2 q = pathUnits(f, p);
  float lo = from / f.z;
  float hi = to / f.z;
  int n = int(meta.x);
  int chunks = int(meta.z);
  float best = 1e20;
  vec4 found = vec4(1e20, 0.0, 1.0, 0.0);
  for (int c = 0; c < 64; c++) {
    if (c >= chunks) break;
    vec4 bb = texelFetch(path, ivec2(3 + c, 1), 0);
    vec2 out_ = max(max(bb.xy - q, q - bb.zw), 0.0);
    if (dot(out_, out_) >= best) continue;
    int last = min(c * 16 + 16, n - 1);
    for (int i = c * 16; i < last; i++) {
      vec4 a = texelFetch(path, ivec2(i, 0), 0);
      vec4 b = texelFetch(path, ivec2(i + 1, 0), 0);
      if (b.w < 0.5 || b.z < lo || a.z > hi) continue;
      float span = max(b.z - a.z, 1e-9);
      vec2 a2 = mix(a.xy, b.xy, clamp((lo - a.z) / span, 0.0, 1.0));
      vec2 b2 = mix(a.xy, b.xy, clamp((hi - a.z) / span, 0.0, 1.0));
      vec2 ab = b2 - a2;
      vec2 aq = q - a2;
      float h = clamp(dot(aq, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
      vec2 e = aq - ab * h;
      float dd = dot(e, e);
      if (dd < best) {
        best = dd;
        found = vec4(sqrt(dd) * f.z, mix(max(a.z, lo), min(b.z, hi), h) * f.z, ab.x * aq.y - ab.y * aq.x < 0.0 ? -1.0 : 1.0, 1.0);
      }
    }
  }
  return found;
}
vec4 pathNearest(sampler2D path, vec2 p) {
  return pathNearest(path, p, 0.0, 1e20);
}
vec4 pathAt(sampler2D path, float along) {
  vec4 meta = texelFetch(path, ivec2(0, 1), 0);
  int n = int(meta.x);
  if (n < 2) return vec4(0.0, 0.0, 1.0, 0.0);
  vec3 f = pathFrame(path);
  float s = clamp(along / f.z, 0.0, meta.y);
  int lo = 0;
  int hi = n - 1;
  for (int k = 0; k < 11; k++) {
    if (hi - lo <= 1) break;
    int mid = (lo + hi) / 2;
    if (texelFetch(path, ivec2(mid, 0), 0).z <= s) lo = mid;
    else hi = mid;
  }
  vec4 a = texelFetch(path, ivec2(lo, 0), 0);
  vec4 b = texelFetch(path, ivec2(hi, 0), 0);
  vec2 q = b.w < 0.5 ? a.xy : mix(a.xy, b.xy, clamp((s - a.z) / max(b.z - a.z, 1e-9), 0.0, 1.0));
  vec2 t = b.xy - a.xy;
  t = dot(t, t) > 0.0 ? normalize(t) : vec2(1.0, 0.0);
  vec2 at = q * f.z + f.xy;
  return vec4(at.x, iResolution.y - at.y, t.x, -t.y);
}`.trim();

/**
 * Joins helpers and a body into one source, a blank line apart. A shader that
 * paints a `uBackground` colour gets a "Background opacity" control that keys
 * it out (`withBackgroundOpacity`), so it can sit over other content.
 */
export function glsl(...parts: string[]): string {
  return withBackgroundOpacity(parts.map((p) => p.trim()).join("\n\n") + "\n");
}
