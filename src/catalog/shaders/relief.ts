import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Relief: white-on-white surfaces shaped in depth and lit from one side, so
 * only their shading and soft shadows draw them (extruded hexagon tiles,
 * paper cut into layers, letters raised from or cut into a sheet).
 *
 * Each effect defines `heightAt(p)`, the surface's height (frame units, the
 * frame 1 tall, centred) at frame point p, and {@link RELIEF} looks at it
 * from slightly to one side (`reliefTrace`, so raised walls show), shades it
 * (`reliefNormal`, `reliefShade`) and marches toward the light for soft
 * shadows (`reliefShadow`).
 */

/**
 * `reliefLight()`: the direction to the light, from `uLight` (degrees round
 * the frame, 0 = from the right, 90 = from the top) and `uElevation`
 * (degrees above the surface). Needs those uniforms and `heightAt(p)`.
 *
 * `reliefTrace(p, view, bottom, top, px)`: the point (xy) and height (z)
 * seen at frame point p, the surface's heights within [bottom, top], when a
 * height h shows shifted by `view * h` (px: a pixel, in frame units). `reliefNormal(s, eps)`, `reliefShadow(s, L,
 * softness)` (1 lit, 0 in shadow, `top` the highest point) and
 * `reliefShade(N, L, lit, surface, shade)`: a lit flat surface is `surface`,
 * one turned from the light or in shadow fades to `shade`.
 */
const RELIEF = `
vec3 reliefLight() {
  float a = radians(uLight);
  float e = radians(uElevation);
  return vec3(cos(a) * cos(e), sin(a) * cos(e), sin(e));
}
vec3 reliefTrace(vec2 p, vec2 view, float bottom, float top, float px) {
  if (dot(view, view) < 1e-10 || top <= bottom) return vec3(p, heightAt(p));
  // About one step per pixel the surface's height range shifts across, then a few halvings.
  int steps = int(clamp(ceil(length(view) * (top - bottom) / px), 2.0, 36.0));
  float dz = (top - bottom) / float(steps);
  float hi = top;
  float lo = bottom;
  for (int i = 0; i <= 36; i++) {
    if (i > steps) break;
    float z = top - float(i) * dz;
    if (heightAt(p - view * z) >= z) { lo = z; break; }
    hi = z;
  }
  for (int i = 0; i < 5; i++) {
    float z = 0.5 * (hi + lo);
    if (heightAt(p - view * z) >= z) lo = z; else hi = z;
  }
  return vec3(p - view * lo, lo);
}
vec3 reliefNormal(vec2 q, float eps) {
  vec2 e = vec2(eps, 0.0);
  float dx = heightAt(q + e.xy) - heightAt(q - e.xy);
  float dy = heightAt(q + e.yx) - heightAt(q - e.yx);
  return normalize(vec3(-dx, -dy, 2.0 * eps));
}
float reliefShadow(vec3 s, vec3 L, float softness, float top, float px) {
  float flatLen = max(length(L.xy), 1e-3);
  vec2 dir = L.xy / flatLen;
  float rise = L.z / flatLen;
  float reach = min((top - s.z) / max(rise, 1e-3), 0.8);
  if (reach <= 0.0) return 1.0;
  // Steps closer together near the point, fewer for a short reach.
  int steps = int(clamp(reach / (2.0 * px), 6.0, 24.0));
  float lit = 1.0;
  for (int i = 1; i <= 24; i++) {
    if (i > steps) break;
    float f = float(i) / float(steps);
    float t = 1.5 * px + reach * f * f;
    float clearance = s.z + rise * t - heightAt(s.xy + dir * t);
    lit = min(lit, clamp(0.5 + clearance / (softness * t + px), 0.0, 1.0));
    if (lit <= 0.0) break;
  }
  return lit * lit * (3.0 - 2.0 * lit);
}
vec3 reliefShade(vec3 N, vec3 L, float lit, vec3 surface, vec3 shade) {
  float k = max(dot(N, L), 0.0) / max(L.z, 1e-3) * lit;
  // Light bounced off the sheet keeps faces turned away from going flat.
  float fill = 0.22 * (0.5 + 0.5 * N.z);
  vec3 col = mix(shade, surface, clamp(fill + (1.0 - fill) * k, 0.0, 1.0));
  // Faces turned toward the light catch a little more than the flat sheet.
  return col + surface * 0.18 * clamp(k - 1.0, 0.0, 1.0);
}`.trim();

/** The light and view controls every relief shares. */
const LIGHT_CONTROLS = (light: number, elevation: number, tilt: number, softness: number) => `
uniform float uLight;        // @control min=0 max=360 default=${light} label="Light from (°)"
uniform float uElevation;    // @control min=10 max=80 default=${elevation} label="Light height (°)"
uniform float uSoftness;     // @control min=0.02 max=2 default=${softness} label="Shadow softness"
uniform float uTilt;         // @control min=0 max=1 default=${tilt} label="View tilt"`.trim();

/**
 * `hexCell(p)`: flat-topped hexagons one unit across their flats; the point
 * relative to its cell's centre (xy) and the centre (zw). `hexEdge(g)`: how
 * far a cell's point is from its edge (0.5 at the centre).
 */
const HEX = `
vec4 hexCell(vec2 p) {
  vec2 s = p.yx;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = 0.5 * r;
  vec2 a = mod(s, r) - h;
  vec2 b = mod(s - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  return vec4(g.yx, (s - g).yx);
}
float hexEdge(vec2 g) {
  vec2 a = abs(g.yx);
  return 0.5 - max(dot(a, vec2(0.5, 0.8660254)), a.x);
}`.trim();

/**
 * `tileRaise(c)`: how far the tile centred at c (cell units) is raised, 0–1:
 * tiles gather on the side `uAngle` points to, `uCoverage` of the frame,
 * with a ragged edge (`uScatter`) and a few strays beyond it. `tileHeight(c)`
 * adds each tile's own height, swaying with time. `heightAt(p)` is the
 * tiles' surface. Needs {@link HEX}, `hash12`, `vnoise` and the hex uniforms.
 */
const HEX_TILES = `
float tileRaise(vec2 c) {
  vec2 f = c / uCells;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  float extent = 0.5 * (abs(dir.x) * iResolution.x / iResolution.y + abs(dir.y)) + 1e-3;
  float along = dot(f, dir) / extent;
  float v = along + uScatter * (1.4 * vnoise(c * 0.45 + 3.7) - 0.7);
  float edge = 1.0 - 2.0 * uCoverage;
  float raise = smoothstep(edge, edge + 0.3, v);
  // Strays: a few tiles out past the edge.
  float stray = step(0.9, hash12(c + 41.0)) * step(edge - 0.45 * (0.3 + uScatter), v);
  return max(raise, stray * 0.8);
}
float tileHeight(vec2 c) {
  float raise = tileRaise(c);
  if (raise <= 0.0) return 0.0;
  float sway = 0.5 + 0.5 * sin(6.2831853 * (iTime * uSpeed / 8.0 + hash12(c + 13.0)));
  return uHeight * raise * (1.0 - uVariation * sway);
}
float heightAt(vec2 p) {
  vec4 h = hexCell(p * uCells);
  float d = hexEdge(h.xy);
  float th = tileHeight(h.zw);
  // A gap between tiles, and a narrow rounded lip so edges catch the light.
  return th * smoothstep(uGap, uGap + 0.035, d);
}`.trim();

const HEX_CONTROLS = (coverage: number, angle: number) => `
uniform float uCells;        // @control min=4 max=30 default=9 label="Tiles (down the frame)"
uniform float uCoverage;     // @control min=0 max=1 default=${coverage} label="Coverage"
uniform float uAngle;        // @control min=0 max=360 default=${angle} label="Tiles gather toward (°)"
uniform float uScatter;      // @control min=0 max=1 default=0.5 label="Ragged edge"
uniform float uHeight;       // @control min=0 max=0.08 default=0.022 label="Tile height"
uniform float uVariation;    // @control min=0 max=1 default=0.6 label="Height variation"
uniform float uGap;          // @control min=0 max=0.12 default=0.02 label="Gap between tiles"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Sway speed"`.trim();

export const reliefHexTiles: ShaderEffect = {
  kind: "shader",
  id: "relief-hex-tiles",
  name: "Hexagon relief",
  description: "White hexagon tiles raised from a white wall at different heights, gathering toward one side with a few strays, lit from the side so only their soft shadows draw them, rising and settling slowly.",
  category: "relief",
  loop: 8,
  tags: ["relief", "hexagon", "honeycomb", "tiles", "3d", "white", "minimal", "paper", "shadow", "background", "extruded"],
  source: glsl(
    `// Hexagon relief: extruded hexagon tiles on a flat wall, seen slightly from one side and lit with soft shadows.
${HEX_CONTROLS(0.55, 315)}
uniform vec3 uSurface;       // @control color default=#F2F2F2 label="Surface"
uniform vec3 uShade;         // @control color default=#B4B7BD label="Shade"
${LIGHT_CONTROLS(40, 38, 0.35, 0.4)}`,
    HASH,
    NOISE,
    HEX,
    HEX_TILES,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec3 L = reliefLight();
  vec2 view = uTilt * 0.9 * vec2(0.5, 0.8660254);
  float top = uHeight + 1e-4;
  vec3 s = reliefTrace(p, view, 0.0, top, px);
  vec3 N = reliefNormal(s.xy, 0.75 * px);
  float lit = reliefShadow(s, L, uSoftness, top, px);
  vec3 col = reliefShade(N, L, lit, uSurface, uShade);
  // Light falls off a touch away from where it comes from.
  col *= 0.95 + 0.06 * dot(p, normalize(L.xy + 1e-4));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Full wall", values: { uCoverage: 1, uScatter: 0.2, uVariation: 0.8, uCells: 12 } },
    { name: "Scattered", values: { uCoverage: 0.3, uScatter: 1, uHeight: 0.03, uAngle: 270 } },
    { name: "Top down", values: { uTilt: 0, uElevation: 30, uSoftness: 0.15 } },
    { name: "Graphite", values: { uSurface: [0.33, 0.34, 0.37], uShade: [0.1, 0.1, 0.12], uLight: 120 } },
    { name: "Blush", values: { uSurface: [0.98, 0.9, 0.88], uShade: [0.78, 0.62, 0.62] } },
  ],
};

export const reliefHexInk: ShaderEffect = {
  kind: "shader",
  id: "relief-hex-ink",
  name: "Ink-splashed hexagons",
  description: "Raised hexagon tiles on a cracked plaster wall, those deep in the cluster black and marbled with cracks, the rest white, with ink spattered and smudged across the wall around them.",
  category: "relief",
  loop: 8,
  tags: ["relief", "hexagon", "honeycomb", "tiles", "grunge", "ink", "splatter", "cracked", "black-and-white", "3d", "background"],
  source: glsl(
    `// Ink-splashed hexagons: hexagon tiles turning from white to cracked black ink, ink spattered over a cracked wall.
${HEX_CONTROLS(0.5, 0)}
uniform vec3 uSurface;       // @control color default=#ECEBE8 label="Wall and white tiles"
uniform vec3 uShade;         // @control color default=#8D8D8F label="Shade"
uniform vec3 uInk;           // @control color default=#111214 label="Ink"
uniform float uInkTiles;     // @control min=0 max=1 default=0.75 label="Inked tiles"
uniform float uSplatter;     // @control min=0 max=1 default=0.6 label="Spatter"
uniform float uCracks;       // @control min=0 max=1 default=0.5 label="Cracks"
${LIGHT_CONTROLS(135, 42, 0.25, 0.4)}`,
    HASH,
    NOISE,
    FBM,
    HEX,
    HEX_TILES,
    RELIEF,
    `// Crack lines: thin dark seams along the edges of a jittered cell pattern.
float cracks(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = o + hash22(i + o) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  float seam = sqrt(d2) - sqrt(d1);
  // Only some seams have cracked, and a crack fades along its length.
  float open = smoothstep(0.4, 0.65, vnoise(p * 0.8 + 5.0));
  return (1.0 - smoothstep(0.0, 0.025, seam)) * open;
}

// How inked the wall is near p: a cloud gathered round the tiles, ragged at its edge, and spattered drops past it.
float inkAt(vec2 p, float along) {
  float edge = 1.0 - 2.0 * uCoverage;
  float cloud = smoothstep(edge - 0.1, edge + 0.5, along + 0.7 * (fbm(p * 3.0, 5) - 0.5) + 0.4 * (uInkTiles - 0.75));
  float drops = 0.0;
  for (int i = 0; i < 3; i++) {
    float scale = 18.0 + 22.0 * float(i);
    vec2 g = p * scale + float(i) * 7.3;
    vec2 cell = floor(g);
    vec2 r = hash22(cell);
    float size = mix(0.08, 0.32, hash12(cell + 2.0)) * step(1.0 - 0.35 * uSplatter, hash12(cell + 5.0));
    drops = max(drops, smoothstep(size, size - 0.06, length(fract(g) - r)));
  }
  float near = smoothstep(-0.6, 0.2, along);
  return max(cloud * (0.5 + 0.5 * uSplatter), drops * near * uSplatter);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec3 L = reliefLight();
  vec2 view = uTilt * 0.9 * vec2(-0.5, 0.8660254);
  float top = uHeight + 1e-4;
  vec3 s = reliefTrace(p, view, 0.0, top, px);
  vec3 N = reliefNormal(s.xy, 0.75 * px);
  float lit = reliefShadow(s, L, uSoftness, top, px);

  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  float along = dot(s.xy, dir) / (0.5 * (abs(dir.x) * iResolution.x / iResolution.y + abs(dir.y)) + 1e-3);

  vec4 h = hexCell(s.xy * uCells);
  bool onTile = s.z > 1e-4;
  vec3 base = uSurface;
  if (onTile) {
    float crack = cracks(s.xy * 16.0) * uCracks;
    // Tiles deep in the cluster are ink, marbled; toward its edge more of them stay white.
    float edge = 1.0 - 2.0 * uCoverage;
    float deep = clamp((along - edge) / max(1.0 - edge, 0.1), 0.0, 1.0);
    float inked = step(hash12(h.zw + 3.0), clamp(deep * 1.8 - 0.3 + (uInkTiles - 0.75) * 1.5, 0.0, 1.0));
    float marble = fbm(s.xy * 14.0 + h.zw, 5);
    vec3 ink = uInk * (0.7 + 0.9 * marble) + 0.25 * smoothstep(0.62, 0.8, marble);
    base = mix(uSurface * (0.92 + 0.08 * marble), ink, inked);
    // Cracks show light on ink and dark on white.
    base = mix(base, mix(uShade * 0.6, uSurface * 0.85, inked), crack * 0.8);
    // A thin light rim round each tile's face.
    float face = hexEdge(h.xy) - uGap - 0.035;
    float rim = smoothstep(-0.004, 0.0, face) * (1.0 - smoothstep(0.008, 0.016, face));
    base = mix(base, uSurface, rim * 0.5 * inked);
  } else {
    float crack = cracks(s.xy * 5.0) * uCracks;
    float stain = fbm(s.xy * 4.0 + 11.0, 5);
    base = uSurface * (0.9 + 0.12 * stain);
    base = mix(base, uShade * 0.8, crack * 0.3);
    base = mix(base, uInk, inkAt(s.xy, along) * (0.75 + 0.25 * stain));
  }
  vec3 col = reliefShade(N, L, lit, base, base * uShade);
  col *= 0.94 + 0.08 * dot(p, normalize(L.xy + 1e-4));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Clean", values: { uSplatter: 0, uCracks: 0.2, uInkTiles: 0.5 } },
    { name: "All ink", values: { uInkTiles: 1, uCoverage: 0.85, uSplatter: 0.9, uCracks: 0.8 } },
    { name: "Rust", values: { uInk: [0.36, 0.13, 0.07], uSurface: [0.93, 0.89, 0.82], uShade: [0.6, 0.5, 0.42] } },
    { name: "Blueprint", values: { uInk: [0.06, 0.16, 0.38], uSurface: [0.9, 0.93, 0.97], uShade: [0.55, 0.6, 0.7], uCracks: 0.3 } },
  ],
};

export const reliefPaperText: ShaderEffect = {
  kind: "shader",
  id: "relief-paper-text",
  name: "Paper relief text",
  description: "A word shaped out of a white sheet, its letters cut into the paper or raised from it (or cut in at one end and rising at the other), drawn only by light and the soft shadows of their walls.",
  category: "relief",
  video: "none",
  tags: ["relief", "text", "title", "emboss", "deboss", "letterpress", "paper", "white", "minimal", "typography", "3d", "mask"],
  source: glsl(
    `// Paper relief text: a mask raised from or cut into a sheet, its depth eased from one end to the other.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("RELIEF")} label="Shape (its alpha)"
uniform float uSize;         // @control min=0.2 max=1 default=0.85 label="Shape size"
uniform float uDepthStart;   // @control min=-1 max=1 default=0.7 label="Depth at the start (− cut in)"
uniform float uDepthEnd;     // @control min=-1 max=1 default=0.7 label="Depth at the end (− cut in)"
uniform float uDepth;        // @control min=0 max=0.1 default=0.03 label="Depth"
uniform float uBevel;        // @control min=0 max=1 default=0.2 label="Rounded edges"
uniform float uBreathe;      // @control min=0 max=1 default=0 label="Breathe"
uniform vec3 uSurface;       // @control color default=#F1F1F0 label="Paper"
uniform vec3 uShade;         // @control color default=#9A9CA1 label="Shade"
uniform vec3 uFace;          // @control color default=#F1F1F0 label="Letter faces"
${LIGHT_CONTROLS(130, 40, 0.25, 0.8)}`,
    `// The mask's alpha at frame point p, contained in uSize of the frame, softened by mip level lod.
float maskAt(vec2 p, float lod) {
  vec2 size = vec2(textureSize(uMask, 0));
  if (size.x <= 1.0) {
    vec2 q = abs(p) - vec2(0.3, 0.12) * uSize;
    return step(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0), 0.0);
  }
  float aspect = size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return textureLod(uMask, uv, lod).a;
}
float halfWidth() {
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x <= 1.0 ? 2.5 : size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  return 0.5 * h * aspect;
}
float depthAt(vec2 p) {
  float t = smoothstep(-1.0, 1.0, p.x / max(halfWidth(), 1e-3));
  float breathe = 1.0 - uBreathe * (0.5 - 0.5 * cos(6.2831853 * iTime / 6.0));
  return mix(uDepthStart, uDepthEnd, t) * uDepth * breathe;
}
float heightAt(vec2 p) {
  float lod = mix(0.0, 3.5, uBevel) + log2(max(iResolution.y / 512.0, 1.0));
  float m = maskAt(p, lod);
  return depthAt(p) * smoothstep(0.08, 0.92, m);
}`,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec3 L = reliefLight();
  vec2 view = uTilt * 0.9 * vec2(-0.7071, 0.7071);
  float top = max(max(uDepthStart, uDepthEnd), 0.0) * uDepth + 1e-4;
  float bottom = min(min(uDepthStart, uDepthEnd), 0.0) * uDepth - 1e-4;
  vec3 s = reliefTrace(p, view, bottom, top, px);
  vec3 N = reliefNormal(s.xy, 1.0 * px);
  float lit = reliefShadow(s, L, uSoftness, top, px);
  // Letter faces (raised tops and cut floors) can take their own colour.
  float face = smoothstep(0.85, 0.95, abs(s.z) / max(abs(depthAt(s.xy)), 1e-5)) * step(1e-4, abs(depthAt(s.xy)));
  vec3 surface = mix(uSurface, uFace, face);
  vec3 col = reliefShade(N, L, lit, surface, uShade * mix(vec3(1.0), uFace / max(uSurface, vec3(1e-3)), face));
  col *= 0.95 + 0.06 * dot(p, normalize(L.xy + 1e-4));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Cut in", values: { uDepthStart: -0.8, uDepthEnd: -0.8, uBevel: 0.05 } },
    { name: "Cut in to raised", values: { uMask: textImage("DESIGN"), uDepthStart: -0.9, uDepthEnd: 1, uLight: 150 } },
    { name: "Letterpress", values: { uMask: textImage("Letterpress", { font: "Georgia, 'Times New Roman', serif", weight: 700 }), uDepthStart: -0.35, uDepthEnd: -0.35, uBevel: 0.35, uTilt: 0, uFace: [0.72, 0.16, 0.2] } },
    { name: "Logo", values: { uMask: SAMPLE_IMAGES.logo, uSize: 0.6, uBevel: 0.6, uBreathe: 0.6 } },
    { name: "Charcoal", values: { uSurface: [0.2, 0.21, 0.23], uFace: [0.2, 0.21, 0.23], uShade: [0.06, 0.06, 0.07], uElevation: 30 } },
  ],
};

export const reliefPaperWaves: ShaderEffect = {
  kind: "shader",
  id: "relief-paper-waves",
  name: "Paper-cut waves",
  description: "Sheets of white paper cut into waves and stacked, each casting a soft shadow on the one beneath, the stack undulating gently.",
  category: "relief",
  loop: 10,
  tags: ["relief", "paper", "paper-cut", "papercraft", "wave", "layers", "white", "minimal", "shadow", "background", "3d"],
  source: glsl(
    `// Paper-cut waves: stacked sheets cut into waves, lit so each casts a soft shadow on the one below.
uniform int uLayers;         // @control min=2 max=8 default=5 label="Sheets"
uniform float uAngle;        // @control min=-90 max=90 default=-25 label="Angle (°)"
uniform float uWaves;        // @control min=0.5 max=6 default=2.2 label="Waves across"
uniform float uAmplitude;    // @control min=0 max=0.2 default=0.06 label="Wave height"
uniform float uSpacing;      // @control min=0.04 max=0.3 default=0.12 label="Sheet spacing"
uniform float uOffset;       // @control min=-1 max=1 default=0.15 label="Stack position"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Undulation"
uniform vec3 uSurface;       // @control color default=#F4F4F4 label="Paper"
uniform vec3 uTint;          // @control color default=#F4F4F4 label="Deepest sheet"
uniform vec3 uShade;         // @control color default=#9FA2A8 label="Shade"
uniform float uLight;        // @control min=0 max=360 default=20 label="Light from (°)"
uniform float uShadow;       // @control min=0 max=0.15 default=0.05 label="Shadow length"
uniform float uSoftness;     // @control min=0.1 max=1 default=0.6 label="Shadow softness"`,
    `const int MAX_LAYERS = 8;

// Sheet i's cut edge across the stack (y in the stack's turned frame), as a function of x along it.
float edgeY(int i, float x) {
  float fi = float(i);
  float ph = 6.2831853 * iTime * uSpeed / 10.0;
  float y = uOffset * 0.5 - (fi - 0.5 * float(uLayers - 1)) * uSpacing;
  y += uAmplitude * sin(x * uWaves * 3.14159 + fi * 0.55 + ph);
  y += 0.35 * uAmplitude * sin(x * uWaves * 7.1 - fi * 1.3 - 2.0 * ph);
  return y;
}
// Signed distance (about) from p to sheet i's edge: positive on the sheet.
float sheetDist(int i, vec2 p) {
  float e = 0.004;
  float y0 = edgeY(i, p.x);
  float slope = (edgeY(i, p.x + e) - edgeY(i, p.x - e)) / (2.0 * e);
  return (y0 - p.y) / sqrt(1.0 + slope * slope);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float a = radians(uAngle);
  mat2 turn = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = turn * p;
  float la = radians(uLight) - a;
  vec2 toLight = vec2(cos(la), sin(la));

  // The topmost sheet covering q: sheet 0 is the deepest, a whole page, each above it cut a little shorter.
  int topSheet = 0;
  for (int i = 1; i < MAX_LAYERS; i++) {
    if (i >= uLayers) break;
    if (sheetDist(i, q) > 0.0) topSheet = i;
  }
  float depth = float(topSheet) / float(max(uLayers - 1, 1));

  // Shadows from the sheets above: each one's edge, moved away from the light, darkens what is below it.
  float shade = 0.0;
  for (int i = 1; i < MAX_LAYERS; i++) {
    if (i >= uLayers) break;
    if (i <= topSheet) continue;
    float rise = float(i - topSheet);
    float d = sheetDist(i, q + toLight * uShadow * sqrt(rise));
    float soft = uSoftness * uShadow * sqrt(rise) + 2.0 * px;
    shade = max(shade, (1.0 - smoothstep(-soft, soft * 1.5, -d)) * (0.75 + 0.25 / rise));
  }

  // The cut edge of the top sheet: a thin lip lit on the side facing the light.
  vec3 col = mix(uTint, uSurface, depth);
  if (topSheet > 0) {
    float e = 0.004;
    float slope = (edgeY(topSheet, q.x + e) - edgeY(topSheet, q.x - e)) / (2.0 * e);
    vec2 n = normalize(vec2(slope, -1.0));
    float d = sheetDist(topSheet, q);
    float lip = 1.0 - smoothstep(0.0, 3.0 * px + 0.003, d);
    col *= 1.0 + 0.12 * lip * dot(n, toLight);
  }
  // A faint fall-off across each sheet, darker toward its back.
  float behind = topSheet + 1 < uLayers ? clamp(-sheetDist(topSheet + 1, q) / max(uSpacing, 1e-3), 0.0, 1.0) : 1.0;
  col *= 0.97 + 0.03 * behind;
  col = mix(col, uShade * mix(uTint, uSurface, depth) / max(uSurface, vec3(1e-3)), shade);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Sunset", values: { uSurface: [1, 0.85, 0.62], uTint: [0.87, 0.36, 0.42], uShade: [0.45, 0.18, 0.28], uLayers: 7 } },
    { name: "Ocean", values: { uSurface: [0.82, 0.93, 0.97], uTint: [0.1, 0.36, 0.55], uShade: [0.05, 0.18, 0.32], uAngle: 0, uWaves: 3 } },
    { name: "Gentle", values: { uAmplitude: 0.03, uWaves: 1.2, uSpacing: 0.18, uLayers: 4, uSoftness: 1 } },
    { name: "Diagonal", values: { uAngle: -50, uOffset: -0.2, uLayers: 6, uShadow: 0.08 } },
  ],
};

export const reliefEmboss: ShaderEffect = {
  kind: "shader",
  id: "relief-emboss",
  name: "Embossed picture",
  description: "A picture or video pressed into a sheet of paper: its light parts raised and its dark parts sunk (or the other way), lit from one side, keeping as much of its colour as you like.",
  category: "relief",
  video: "filter",
  tags: ["relief", "emboss", "deboss", "paper", "image", "video", "filter", "white", "letterpress", "plaster"],
  source: glsl(
    `// Embossed picture: the picture's lightness as the height of a paper sheet, shaded by a side light.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Picture"
uniform float uDepth;        // @control min=-1 max=1 default=0.6 label="Depth (− sinks the light parts)"
uniform float uSmoothing;    // @control min=0 max=1 default=0.3 label="Smoothing"
uniform float uColour;       // @control min=0 max=1 default=0 label="Picture colour"
uniform vec3 uSurface;       // @control color default=#F3F2EF label="Paper"
uniform vec3 uShade;         // @control color default=#9C9EA3 label="Shade"
uniform float uLight;        // @control min=0 max=360 default=135 label="Light from (°)"
uniform float uElevation;    // @control min=10 max=80 default=40 label="Light height (°)"
uniform float uGrain;        // @control min=0 max=1 default=0.3 label="Paper grain"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `float lightness(vec2 uv, float lod) {
  vec2 st = fitCoverUV(uImage, uv);
  // Over the backdrop, so a transparent picture (dark strokes on clear) still has light and dark.
  vec3 c = textureSize(uImage, 0).x > 1 ? overBackdrop(textureLod(uImage, st, lod)).rgb : testCard(fract(st));
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 texel = 1.0 / iResolution.xy;
  float lod = uSmoothing * 4.0 + log2(max(float(textureSize(uImage, 0).y) / iResolution.y, 1.0));
  float spread = 1.0 + 3.0 * uSmoothing;
  float dx = lightness(uv + vec2(texel.x * spread, 0.0), lod) - lightness(uv - vec2(texel.x * spread, 0.0), lod);
  float dy = lightness(uv + vec2(0.0, texel.y * spread), lod) - lightness(uv - vec2(0.0, texel.y * spread), lod);
  float strength = uDepth * 6.0 / spread;
  vec3 N = normalize(vec3(-dx * strength, -dy * strength, 1.0));
  float a = radians(uLight);
  float e = radians(uElevation);
  vec3 L = vec3(cos(a) * cos(e), sin(a) * cos(e), sin(e));
  float k = max(dot(N, L), 0.0) / L.z;
  float grain = (hash12(fragCoord) - 0.5) * 0.05 * uGrain;
  vec4 pic = pictureCoverRGBA(uImage, uv);
  vec3 paper = mix(uSurface, pic.rgb, uColour);
  vec3 col = mix(uShade * paper / max(uSurface, vec3(1e-3)), paper, clamp(k, 0.0, 1.0));
  col += paper * 0.2 * clamp(k - 1.0, 0.0, 1.0) + grain;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Debossed", values: { uDepth: -0.7 } },
    { name: "Plaster", values: { uSurface: [0.93, 0.9, 0.85], uShade: [0.55, 0.5, 0.45], uSmoothing: 0.6, uGrain: 0.8 } },
    { name: "Tinted", values: { uColour: 0.55, uDepth: 0.8, uSmoothing: 0.15 } },
    { name: "Landscape", values: { uImage: SAMPLE_IMAGES.landscape, uDepth: 0.9, uLight: 60 } },
  ],
};

/** Every relief effect, in the order the catalog lists them. */
export const reliefShaders: readonly ShaderEffect[] = [reliefHexTiles, reliefHexInk, reliefPaperText, reliefPaperWaves, reliefEmboss];
