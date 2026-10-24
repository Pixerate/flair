import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Holograms are light: a picture, words or a wireframe turned into one
 * colour of glow, banded by scanlines that drift up, dipping in flickers and
 * tearing sideways in glitching bands, standing in the beam of an emitter
 * below. They draw on clear (alpha is the light's brightest channel), so
 * they float over any page, with a background a control away.
 */

/** A row of numbers as GLSL, to four places. */
const g4 = (xs: readonly number[]) => xs.map((x) => x.toFixed(4)).join(", ");

/** The icosahedron: 12 unit vertices, and its 30 edges (the vertex pairs 2 apart before scaling). */
const ICOSAHEDRON = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const n = Math.hypot(1, phi);
  const v: number[][] = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) v.push([0, a, b], [a, b, 0], [b, 0, a]);
  const e: number[][] = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(Math.hypot(...v[i]!.map((x, k) => x - v[j]![k]!)) - 2) < 1e-6) e.push([i, j]);
  return { v: v.map((p) => p.map((x) => x / n)), e };
})();

/** The cube: 8 corners at ±0.577 (on the unit sphere), and its 12 edges. */
const CUBE = (() => {
  const s = 1 / Math.sqrt(3);
  const v: number[][] = [];
  for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) v.push([x, y, z]);
  const e: number[][] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (v[i]!.filter((x, k) => x !== v[j]![k]).length === 1) e.push([i, j]);
  return { v, e };
})();

const SOLIDS = `
const vec3 ICO_V[12] = vec3[12](${ICOSAHEDRON.v.map((p) => `vec3(${g4(p)})`).join(", ")});
const ivec2 ICO_E[30] = ivec2[30](${ICOSAHEDRON.e.map((p) => `ivec2(${p.join(", ")})`).join(", ")});
const vec3 CUBE_V[8] = vec3[8](${CUBE.v.map((p) => `vec3(${g4(p)})`).join(", ")});
const ivec2 CUBE_E[12] = ivec2[12](${CUBE.e.map((p) => `ivec2(${p.join(", ")})`).join(", ")});`.trim();

/**
 * The hologram look, shared: `holoScan(y)` (scanline brightness at pixel row
 * `y`), `holoFlicker()` (the whole projection's brightness this moment),
 * `holoGlitch(v)` (a sideways tear at height `v`, 0–1 up the picture: x the
 * shift, y 1 inside a torn band), `holoBeam(p, base, top, width)` (the light
 * cone from an emitter at `base` up to height `top`, and the emitter's
 * rings) and `holoOver(light)` (light over the background, as the output).
 * Needs {@link HASH}, {@link NOISE} and the uniforms `uColor`, `uScanlines`,
 * `uLineSpacing`, `uFlicker`, `uGlitch`, `uBackground`, `uBackgroundAlpha`.
 */
const HOLO = `
float holoScan(float y) {
  float s = 0.5 + 0.5 * sin((y - iTime * 24.0) * 6.28318 / uLineSpacing);
  // A brighter band rolling up through it now and then.
  float r = fract(y / iResolution.y * 0.6 - iTime * 0.18) * 8.0 - 4.0;
  float roll = exp(-r * r) * 0.35;
  return (1.0 - uScanlines * 0.75 * (1.0 - s)) * (1.0 + roll * uScanlines);
}
float holoFlicker() {
  float k = floor(iTime * 18.0);
  float dip = step(1.0 - 0.12 * uFlicker, hash12(vec2(k, 1.3))) * 0.65;
  return 1.0 - uFlicker * (0.12 * hash12(vec2(k, 7.1)) + 0.06 * sin(iTime * 11.0)) - dip;
}
vec2 holoGlitch(float v) {
  float k = floor(iTime * 7.0);
  float on = step(1.0 - 0.45 * uGlitch, hash12(vec2(k, 3.3)));
  float bands = 5.0 + floor(14.0 * hash12(vec2(k, 5.9)));
  float band = floor(v * bands);
  float h = hash12(vec2(band, k + 0.5));
  float hit = on * step(0.7, h);
  return vec2((hash12(vec2(band, k + 9.1)) - 0.5) * 0.1 * uGlitch * hit, hit);
}
vec3 holoBeam(vec2 p, vec2 base, float top, float width) {
  vec3 col = vec3(0.0);
  float up = (p.y - base.y) / max(top - base.y, 1e-3);
  if (up > 0.0 && up < 1.2) {
    float spread = mix(width * 0.12, width, clamp(up, 0.0, 1.0));
    float across = abs(p.x - base.x) / spread;
    float rays = 0.6 + 0.4 * vnoise(vec2((p.x - base.x) / spread * 6.0, up * 2.0 - iTime * 0.8));
    col += uColor * smoothstep(1.0, 0.6, across) * (1.0 - smoothstep(0.0, 1.15, up)) * rays * 0.22;
    col += uColor * exp(-across * across * 30.0) * (1.0 - up) * 0.12;
  }
  // The emitter: a bright lens in rings, seen at a low angle.
  vec2 e = (p - base) * vec2(1.0, 3.6);
  float r = length(e);
  float rings = 0.0;
  for (int i = 0; i < 3; i++) {
    float ri = width * (0.18 + 0.16 * float(i));
    float d = abs(r - ri - 0.004 * sin(iTime * 3.0 + float(i)));
    rings += exp(-d * d / 0.000006) * (1.0 - 0.25 * float(i));
  }
  col += uColor * (rings * 0.9 + exp(-r / (width * 0.12)) * 1.2 + exp(-r / (width * 0.5)) * 0.15);
  return col;
}
vec4 holoOver(vec3 light) {
  light = 1.0 - exp(-max(light, 0.0));
  float a = max(light.r, max(light.g, light.b));
  vec3 col = uBackground * uBackgroundAlpha * (1.0 - a) + light;
  float alpha = uBackgroundAlpha + a * (1.0 - uBackgroundAlpha);
  return vec4(min(col / max(alpha, 1e-4), 1.0), alpha);
}`.trim();

/** The controls every hologram has. */
const HOLO_CONTROLS = `
uniform float uScanlines;       // @control min=0 max=1 default=0.6 label="Scanlines"
uniform float uLineSpacing;     // @control min=2 max=12 default=4 label="Scanline spacing (px)"
uniform float uFlicker;         // @control min=0 max=1 default=0.4 label="Flicker"
uniform float uGlitch;          // @control min=0 max=1 default=0.35 label="Glitch"
uniform float uBeam;            // @control min=0 max=1 default=0.7 label="Projector beam"
uniform vec3 uBackground;       // @control color default=#03070D label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

export const hologram: ShaderEffect = {
  kind: "shader",
  id: "hologram",
  name: "Hologram",
  description: "A picture or video projected as a flickering hologram: its plain background keyed out, the rest tinted light in drifting scanlines with glowing edges, glitching tears and an emitter's beam below, rebuilding itself line by line if you like.",
  category: "hologram",
  video: "filter",
  tags: ["hologram", "sci-fi", "projection", "image", "glitch", "scanlines", "overlay", "futuristic"],
  transparent: true,
  source: glsl(
    `// Hologram: the picture's brightness as light of one colour (or its own colours, by the tint), fitted in a box
// over an emitter, a plain background (the colour at its corners) keyed out; scanlines, flicker and torn bands
// over it, its edges glowing, colour split where it tears.
uniform sampler2D uImage;       // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uColor;            // @control color default=#4FE3FF label="Hologram"
uniform float uTint;            // @control min=0 max=1 default=0.85 label="Tint"
uniform float uSize;            // @control min=0.3 max=1 default=0.72 label="Size"
uniform float uEdges;           // @control min=0 max=2 default=1 label="Edge glow"
uniform float uKey;             // @control min=0 max=1 default=0.6 label="Remove background"
uniform float uRebuild;         // @control min=0 max=12 default=0 label="Materialise every (s, 0 off)"
${HOLO_CONTROLS}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    HOLO,
    `// The colour to key out: the picture's corners, averaged (a plain backdrop, a green screen).
vec3 keyColour() {
  vec3 k = vec3(0.0);
  for (int i = 0; i < 4; i++) k += pictureRGBA(uImage, vec2(i == 1 || i == 3 ? 0.98 : 0.02, i >= 2 ? 0.98 : 0.02)).rgb;
  return k * 0.25;
}

// The picture as light (rgb) and how much of it there is (a): clear where it is near the key colour.
vec4 lightAt(vec2 uv, vec3 key) {
  vec4 s = pictureRGBA(uImage, uv);
  float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
  vec3 c = mix(s.rgb, uColor * (0.25 + 1.5 * lum), uTint);
  float keep = mix(1.0, smoothstep(0.04, 0.04 + 0.3 * uKey, length(s.rgb - key)), step(0.001, uKey));
  return vec4(c * (0.7 + 1.4 * lum), s.a * keep);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 ts = vec2(textureSize(uImage, 0));
  float aspect = ts.y > 1.0 ? ts.x / ts.y : 1.0;
  // The picture's box: uSize high (narrower if the frame is), floating gently above the emitter.
  float h = min(uSize, iResolution.x * px * 0.92 / aspect);
  vec2 centre = vec2(0.0, 0.5 * (1.0 - h) * 0.55 - 0.02 + 0.008 * sin(iTime * 1.3));
  vec2 base = vec2(0.0, -0.47);
  vec3 light = holoBeam(p, base, centre.y + 0.1 * h, h * aspect * 0.5) * uBeam;
  vec2 uv = (p - centre) / vec2(h * aspect, h) + 0.5;
  vec2 tear = holoGlitch(uv.y);
  uv.x += tear.x;
  vec2 st = clamp(uv, 0.0, 1.0);
  vec3 key = keyColour();
  vec4 l = lightAt(st, key);
  vec3 c = l.rgb;
  // The edges glow: where brightness or the cut-out changes fastest (worked out everywhere, so the slopes are sound).
  float lum = dot(l.rgb, vec3(0.333));
  float edge = clamp(length(vec2(dFdx(lum), dFdy(lum))) * 6.0 + length(vec2(dFdx(l.a), dFdy(l.a))) * 2.5, 0.0, 1.0);
  // Colour split where it tears.
  if (tear.y > 0.5) c = vec3(lightAt(st + vec2(0.012, 0.0), key).r, c.g, lightAt(st - vec2(0.012, 0.0), key).b);
  // Fade out toward the box's edges, so it floats rather than sits in a frame (nothing outside it).
  float fade = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x) * smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
  // Materialising: built up from the bottom by a bright scan line.
  float build = 1.0;
  if (uRebuild > 0.0) {
    float line = mod(iTime, uRebuild) / min(1.6, uRebuild * 0.5) * 1.1 - 0.05;
    float k = (uv.y - line) * 90.0;
    build = smoothstep(line + 0.01, line - 0.01, uv.y);
    c += uColor * exp(-k * k) * 2.0 * step(line, 1.05) * step(0.0, uv.x) * step(uv.x, 1.0);
  }
  // The picture's clear parts stay clear (its alpha), so only its light floats there.
  light += (c * l.a + uColor * edge * uEdges) * fade * build;
  light *= holoScan(fragCoord.y) * holoFlicker();
  fragColor = holoOver(light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Materialise", values: { uRebuild: 5, uGlitch: 0.2 } },
    { name: "Princess", values: { uColor: [0.45, 0.7, 1], uScanlines: 0.85, uLineSpacing: 3, uFlicker: 0.7, uGlitch: 0.6, uTint: 1 } },
    { name: "Emerald", values: { uColor: [0.3, 1, 0.55], uTint: 1, uEdges: 1.6 } },
    { name: "True colour", values: { uTint: 0.2, uFlicker: 0.25, uGlitch: 0.15 } },
  ],
};

export const hologramText: ShaderEffect = {
  kind: "shader",
  id: "hologram-text",
  name: "Hologram text",
  description: "Words hovering as a hologram above an emitter: glowing outlines over a translucent fill, scanlines drifting up, flickers and glitching tears.",
  category: "hologram",
  video: "none",
  tags: ["hologram", "text", "title", "sci-fi", "glitch", "scanlines", "overlay", "futuristic"],
  transparent: true,
  source: glsl(
    `// Hologram text: the letters' mask as a faint fill with bright outlines (where the mask's slope is), torn and
// colour split in glitching bands, over an emitter's beam.
uniform sampler2D uText;        // @control filter=linear wrap=clamp default=${textImage("HOLO")} label="Text"
uniform vec3 uColor;            // @control color default=#4FE3FF label="Hologram"
uniform float uSize;            // @control min=0.2 max=1 default=0.6 label="Text size"
uniform float uFill;            // @control min=0 max=1 default=0.5 label="Fill"
uniform float uOutline;         // @control min=0 max=2 default=1.4 label="Outline"
${HOLO_CONTROLS}`,
    HASH,
    NOISE,
    HOLO,
    `vec2 textHalf() {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize * 0.7, iResolution.x / iResolution.y * 0.9 / aspect);
  return vec2(h * aspect, h) * 0.5;
}

float letters(vec2 p, vec2 centre) {
  vec2 uv = (p - centre) / (2.0 * textHalf()) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 hb = textHalf();
  vec2 centre = vec2(0.0, 0.06 + 0.01 * sin(iTime * 1.4));
  vec2 base = vec2(0.0, -0.42);
  vec3 light = holoBeam(p, base, centre.y - hb.y, hb.x * 1.05) * uBeam;
  vec2 tear = holoGlitch((p.y - centre.y) / (2.0 * hb.y) + 0.5);
  vec2 q = p + vec2(tear.x * hb.x * 2.0, 0.0);
  float m = letters(q, centre);
  // The outline: where the mask changes, about a pixel and a half wide.
  float edge = clamp(length(vec2(dFdx(m), dFdy(m))) * 1.5, 0.0, 1.0);
  vec3 c = uColor * (m * uFill * (1.1 + 0.3 * sin((q.x - centre.x) * 40.0 + iTime * 3.0)) + edge * uOutline * 2.2);
  if (tear.y > 0.5) {
    float r = letters(q + vec2(0.006, 0.0), centre);
    float b = letters(q - vec2(0.006, 0.0), centre);
    c += vec3(r, 0.0, b) * 0.6 * uColor.g;
  }
  // A soft glow round the letters.
  float halo = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    halo += letters(q + vec2(cos(a), sin(a)) * 0.02, centre);
  }
  light += c + uColor * halo / 6.0 * 0.25 * (1.0 - m);
  light *= holoScan(fragCoord.y) * holoFlicker();
  fragColor = holoOver(light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Warning", values: { uColor: [1, 0.35, 0.3], uFlicker: 0.8, uGlitch: 0.7 } },
    { name: "Clean", values: { uFlicker: 0.1, uGlitch: 0, uScanlines: 0.35, uBeam: 0 } },
  ],
};

export const hologramProjector: ShaderEffect = {
  kind: "shader",
  id: "hologram-projector",
  name: "Hologram projector",
  description: "A wireframe globe, cube or icosahedron turning in the light cone of a hologram emitter, its far side dimmer, a scan band sweeping up through it.",
  category: "hologram",
  tags: ["hologram", "sci-fi", "3d", "wireframe", "globe", "projection", "overlay", "futuristic"],
  transparent: true,
  source: glsl(
    `// Hologram projector: the globe is an analytic sphere (latitude and longitude lines on its near and far
// faces); the solids are their edges, projected with a little perspective and dimmed by depth. All of it light.
uniform vec3 uColor;            // @control color default=#4FE3FF label="Hologram"
uniform int uShape;             // @control min=0 max=2 default=0 label="Shape (0 globe, 1 cube, 2 icosahedron)"
uniform float uSize;            // @control min=0.3 max=1.5 default=1 label="Size"
uniform float uSpin;            // @control min=-2 max=2 default=0.4 label="Spin"
uniform float uTilt;            // @control min=-1 max=1 default=0.35 label="Tilt"
uniform int uLines;             // @control min=4 max=24 default=12 label="Globe lines"
uniform float uFarSide;         // @control min=0 max=1 default=0.35 label="Far side"
${HOLO_CONTROLS}`,
    HASH,
    NOISE,
    HOLO,
    SOLIDS,
    `mat3 turn() {
  float a = iTime * uSpin, ct = cos(uTilt), st = sin(uTilt);
  mat3 spin = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
  mat3 tilt = mat3(1.0, 0.0, 0.0, 0.0, ct, st, 0.0, -st, ct);
  return tilt * spin;
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0));
}

// A vertex on screen (xy) and its depth (z, toward the viewer), with a little perspective.
vec3 project(vec3 v, mat3 m, vec2 centre, float r) {
  vec3 q = m * v;
  float f = 3.0 / (3.0 - q.z);
  return vec3(centre + q.xy * r * f, q.z);
}

vec3 solid(vec2 p, vec2 centre, float r, float px) {
  mat3 m = turn();
  float w = 1.2 * px;
  vec3 col = vec3(0.0);
  if (uShape == 1) {
    for (int i = 0; i < 12; i++) {
      vec3 a = project(CUBE_V[CUBE_E[i].x], m, centre, r), b = project(CUBE_V[CUBE_E[i].y], m, centre, r);
      float d = segment(p, a.xy, b.xy);
      float near = mix(uFarSide, 1.0, smoothstep(-0.6, 0.6, (a.z + b.z) * 0.5));
      col += uColor * near * (exp(-(d * d) / (w * w)) * 1.4 + exp(-d / (w * 6.0)) * 0.15);
    }
    for (int i = 0; i < 8; i++) {
      vec3 a = project(CUBE_V[i], m, centre, r);
      col += uColor * exp(-pow(length(p - a.xy) / (w * 2.2), 2.0)) * mix(uFarSide, 1.0, smoothstep(-0.6, 0.6, a.z));
    }
  } else {
    for (int i = 0; i < 30; i++) {
      vec3 a = project(ICO_V[ICO_E[i].x], m, centre, r), b = project(ICO_V[ICO_E[i].y], m, centre, r);
      float d = segment(p, a.xy, b.xy);
      float near = mix(uFarSide, 1.0, smoothstep(-0.6, 0.6, (a.z + b.z) * 0.5));
      col += uColor * near * (exp(-(d * d) / (w * w)) * 1.4 + exp(-d / (w * 6.0)) * 0.15);
    }
    for (int i = 0; i < 12; i++) {
      vec3 a = project(ICO_V[i], m, centre, r);
      col += uColor * exp(-pow(length(p - a.xy) / (w * 2.2), 2.0)) * mix(uFarSide, 1.0, smoothstep(-0.6, 0.6, a.z));
    }
  }
  return col;
}

vec3 globe(vec2 p, vec2 centre, float r) {
  vec2 q = (p - centre) / r;
  float rr = dot(q, q);
  float inside = step(rr, 1.0);
  vec3 col = uColor * exp(-abs(sqrt(rr) - 1.0) * 40.0) * 0.6 + uColor * exp(-max(sqrt(rr) - 1.0, 0.0) * 8.0) * 0.12 * (1.0 - inside);
  rr = min(rr, 0.9999);
  mat3 m = turn();
  float n = float(uLines);
  for (int s = 0; s < 2; s++) {
    // The near face, then the far one seen through it.
    float z = sqrt(1.0 - rr) * (s == 0 ? 1.0 : -1.0);
    vec3 g = vec3(q, z) * m;
    float lat = asin(clamp(g.y, -1.0, 1.0)) / 3.14159 * n;
    float lon = atan(g.x, g.z) / 6.28318 * n * 2.0;
    vec2 cell = abs(fract(vec2(lat, lon) + 0.5) - 0.5) / max(fwidth(vec2(lat, lon)), 1e-4);
    float lines = max(exp(-cell.x * cell.x * 0.4), exp(-cell.y * cell.y * 0.4) * smoothstep(0.98, 0.9, abs(g.y)));
    float rim = pow(1.0 - abs(z), 3.0);
    col += uColor * (lines * 1.1 + rim * 0.35 + 0.05) * (s == 0 ? 1.0 : uFarSide) * inside;
  }
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float r = 0.27 * uSize;
  vec2 centre = vec2(0.0, 0.07 + 0.008 * sin(iTime * 1.2));
  vec2 base = vec2(0.0, -0.44);
  vec3 light = holoBeam(p, base, centre.y - r * 0.6, r * 1.2) * uBeam;
  light += uShape == 0 ? globe(p, centre, r) : solid(p, centre, r, px);
  // A scan band sweeping up through the object.
  float band = ((p.y - centre.y) / r - (fract(iTime * 0.25) * 2.6 - 1.3)) * 6.0;
  light *= 1.0 + 1.2 * exp(-band * band) * smoothstep(1.4, 0.8, length(p - centre) / r);
  light *= holoScan(fragCoord.y) * holoFlicker();
  fragColor = holoOver(light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Cube", values: { uShape: 1, uSpin: 0.6, uTilt: 0.5 } },
    { name: "Icosahedron", values: { uShape: 2, uColor: [0.55, 1, 0.75] } },
    { name: "Red alert", values: { uColor: [1, 0.3, 0.25], uFlicker: 0.8, uGlitch: 0.6 } },
  ],
};

export const hologramShaders: readonly ShaderEffect[] = [hologram, hologramText, hologramProjector];
