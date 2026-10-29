import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

export const imageKenBurns: ShaderEffect = {
  kind: "shader",
  id: "image-ken-burns",
  name: "Ken Burns",
  description: "A slow documentary-style pan and zoom across an image, easing in and out and back again.",
  category: "image",
  video: "filter",
  tags: ["image", "camera", "documentary", "slideshow"],
  loop: 12,
  source: glsl(
    `// Ken Burns: a slow, eased pan and zoom across a cover-fitted image, there and back.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uZoomStart;  // @control min=1 max=3 default=1.05 label="Start zoom"
uniform float uZoomEnd;    // @control min=1 max=3 default=1.4 label="End zoom"
uniform float uAngle;      // @control min=0 max=360 default=20 label="Pan direction (°)"
uniform float uDuration;   // @control min=2 max=30 default=6 label="Duration (s)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // Cover-fit: the share of the image visible across and up (the test card fits the frame).
  vec2 size = vec2(textureSize(uImage, 0));
  float frameAspect = iResolution.x / iResolution.y;
  float imageAspect = size.x > 1.0 ? size.x / size.y : frameAspect;
  vec2 cover = frameAspect > imageAspect ? vec2(1.0, imageAspect / frameAspect) : vec2(frameAspect / imageAspect, 1.0);
  // 0 → 1 over one duration, back over the next, eased at both ends.
  float k = 0.5 - 0.5 * cos(3.14159265 * iTime / max(uDuration, 0.1));
  float zoom = max(mix(uZoomStart, uZoomEnd, k), 1.0);
  vec2 window = cover / zoom;
  // Pan as far as the window allows in the chosen direction, from one side to the other.
  float a = radians(uAngle);
  vec2 pan = vec2(cos(a), sin(a)) * (1.0 - window) * 0.5 * (2.0 * k - 1.0);
  fragColor = pictureRGBA(uImage, 0.5 + (uv - 0.5) * window + pan);
}`,
  ),
  presets: [
    { name: "Push in", values: { uZoomStart: 1.0, uZoomEnd: 1.5, uAngle: 0 } },
    { name: "Pull out", values: { uZoomStart: 1.6, uZoomEnd: 1.05, uAngle: 200 } },
    { name: "Slow drift", values: { uZoomStart: 1.2, uZoomEnd: 1.25, uAngle: 0, uDuration: 12 } },
  ],
};

export const imageAscii: ShaderEffect = {
  kind: "shader",
  id: "image-ascii",
  name: "ASCII art",
  description: "An image drawn as text characters picked by brightness, in one ink or the picture's own colours.",
  category: "image",
  video: "filter",
  tags: ["image", "ascii", "text", "terminal", "retro"],
  source: glsl(
    `// ASCII art: each cell of the image becomes a character, denser for brighter cells.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uCell;       // @control min=4 max=32 default=9 label="Cell size (px)"
uniform int uColourMode;   // @control min=0 max=1 default=0 label="Colour (0 ink, 1 original)"
uniform vec3 uInk;         // @control color default=#A3E635 label="Ink"
uniform vec3 uBackground;  // @control color default=#0A0F0A label="Background"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// 5 × 7 glyphs, lightest to densest: bit (x + 5y) of .x holds rows 0–3 (top first), of .y rows 4–6.
const ivec2 GLYPHS[10] = ivec2[10](
  ivec2(0, 0),            // space
  ivec2(0, 6336),         // .
  ivec2(1015808, 0),      // -
  ivec2(6336, 198),       // :
  ivec2(1020032, 132),    // +
  ivec2(31744, 31),       // =
  ivec2(1030816, 686),    // *
  ivec2(139875, 25378),   // %
  ivec2(359754, 10591),   // #
  ivec2(718382, 30781)    // @
);

// Whether glyph g has ink at column x (0–4), row y (0–6, top first).
float glyphBit(ivec2 g, int x, int y) {
  if (x < 0 || x > 4 || y < 0 || y > 6) return 0.0;
  int bits = y < 4 ? (g.x >> (x + 5 * y)) : (g.y >> (x + 5 * (y - 4)));
  return float(bits & 1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Cells are 7 × 9 units: the 5 × 7 glyph and a unit of margin around it.
  vec2 cell = vec2(uCell, uCell * 9.0 / 7.0);
  vec2 id = floor(fragCoord / cell);
  vec2 local = fract(fragCoord / cell);
  vec4 pic = pictureRGBA(uImage, (id + 0.5) * cell / iResolution.xy);
  vec3 src = pic.rgb;
  float l = pow(clamp(dot(src, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0), 0.8);
  int level = int(min(l * 10.0, 9.0));
  int gx = int(floor(local.x * 7.0)) - 1;
  int gy = int(floor((1.0 - local.y) * 9.0)) - 1;
  float ink = glyphBit(GLYPHS[level], gx, gy);
  vec3 tint = uColourMode == 1 ? src * 1.25 : uInk;
  fragColor = vec4(mix(uBackground, tint, ink), pic.a);
}`,
  ),
  presets: [
    { name: "Terminal", values: { uColourMode: 0, uInk: [0.64, 0.9, 0.21], uBackground: [0.04, 0.06, 0.04] } },
    { name: "Colour", values: { uColourMode: 1, uBackground: [0.02, 0.02, 0.03] } },
    { name: "Typewriter", values: { uColourMode: 0, uInk: [0.1, 0.1, 0.12], uBackground: [0.96, 0.94, 0.88], uCell: 7 } },
  ],
};

export const imageShatter: ShaderEffect = {
  kind: "shader",
  id: "image-shatter",
  name: "Shatter",
  description: "An image breaking into glass-like shards that fly apart, spin and reassemble in a loop.",
  category: "image",
  video: "filter",
  tags: ["image", "shatter", "transition", "voronoi", "explode"],
  loop: 5,
  source: glsl(
    `// Shatter: Voronoi shards of the image fly apart, spin and come back together.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform bool uAuto;        // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uCount;      // @control min=3 max=30 default=8 label="Shards (across height)"
uniform float uSpread;     // @control min=0 max=2 default=0.6 label="Spread"
uniform float uSpin;       // @control min=0 max=6.28 default=1.5 label="Spin"
uniform vec3 uBackground;  // @control color default=#0B0B12 label="Background"
${BACKDROP_CONTROLS}`,
    HASH,
    ROTATE,
    PICTURE,
    `vec2 shardSite(vec2 cell) {
  return cell + 0.15 + 0.7 * hash22(cell);
}

// No point is further than this from its own shard's site (sites sit in the middle 70% of each cell).
const float SHARD_REACH = 1.25;

// Whether grid point q lies on shard c: c's site is the nearest of those in the 3 × 3 cells around q.
bool onShard(vec2 q, vec2 c) {
  vec2 base = floor(q);
  vec2 off = c - base;
  if (abs(off.x) > 1.0 || abs(off.y) > 1.0) return false;
  float own = distance(q, shardSite(c));
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 n = base + vec2(float(i), float(j));
      if (n != c && distance(q, shardSite(n)) < own) return false;
    }
  }
  return true;
}

// The shard (cell) under grid point q, and how far q is from its edge (xy: cell, z: edge gap).
vec3 shardAt(vec2 q) {
  vec2 base = floor(q);
  float d1 = 1e9;
  float d2 = 1e9;
  vec2 id = base;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = base + vec2(float(i), float(j));
      float d = distance(q, shardSite(c));
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = c;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec3(id, d2 - d1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float k = uAuto ? smoothstep(0.2, 0.8, 0.5 - 0.5 * cos(iTime * 6.28318 / 5.0)) : uProgress;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * uCount;
  // Shard centres move out from the middle; shards keep their size, so gaps open between them.
  float grow = 1.0 + uSpread * k;
  vec2 base = floor(p / grow);
  float top = -1.0;
  vec2 hitQ = vec2(0.0);
  float hitA = 0.0;
  // Every shard that could reach this pixel (of the 5 × 5 cells around, those whose site, wherever it sits
  // in its cell and however far it is thrown, lands close enough); the one on top (highest h.y) wins.
  float slack = 0.6 * k + SHARD_REACH;
  vec2 lo = max(base - 2.0, ceil((p - slack) / grow - 0.85));
  vec2 hi = min(base + 2.0, floor((p + slack) / grow - 0.15));
  for (int j = 0; j < 5; j++) {
    if (lo.y + float(j) > hi.y) break;
    for (int i = 0; i < 5; i++) {
      if (lo.x + float(i) > hi.x) break;
      vec2 c = lo + vec2(float(i), float(j));
      vec2 h = hash22(c + 41.7);
      if (h.y <= top) continue;
      vec2 site = shardSite(c);
      vec2 centre = site * grow + (h - 0.5) * 1.2 * k;
      vec2 rel = p - centre;
      if (dot(rel, rel) > SHARD_REACH * SHARD_REACH) continue;
      float a = (h.x - 0.5) * 2.0 * uSpin * k;
      // Back to where this pixel would sit in the unbroken image, if it is on this shard.
      vec2 q = rot(-a) * rel + site;
      if (onShard(q, c)) {
        top = h.y;
        hitQ = q;
        hitA = a;
      }
    }
  }
  vec4 col = vec4(uBackground, uBackdropAlpha);
  if (top > -1.0) {
    vec2 uv = hitQ / uCount * iResolution.y / iResolution.xy + 0.5;
    col = pictureRGBA(uImage, uv);
    col.rgb *= 1.0 - 0.35 * k * abs(sin(hitA));
    col.rgb += k * 0.35 * smoothstep(0.06, 0.0, shardAt(hitQ).z);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Burst", values: { uCount: 6, uSpread: 1.4, uSpin: 3 } },
    { name: "Crackle", values: { uCount: 18, uSpread: 0.15, uSpin: 0.4 } },
  ],
};

export const imageMelt: ShaderEffect = {
  kind: "shader",
  id: "image-melt",
  name: "Melt",
  description: "An image melting and dripping downwards in slow, noisy runs.",
  category: "image",
  video: "filter",
  tags: ["image", "melt", "drip", "psychedelic", "distortion"],
  source: glsl(
    `// Melt: noise-driven runs drag the image downwards.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uAmount;     // @control min=0 max=0.6 default=0.18 label="Amount"
uniform float uSpeed;      // @control min=0 max=2 default=0.35 label="Flow speed"
uniform float uScale;      // @control min=1 max=20 default=6 label="Scale"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * uSpeed;
  // Columns run at different lengths; thin drips ride on top; runs grow towards the bottom.
  float runs = fbm(vec2(uv.x * uScale, t * 0.5), 4);
  float drips = pow(vnoise(vec2(uv.x * uScale * 5.0, t * 0.3 + 7.0)), 3.0);
  float drop = uAmount * (0.7 * runs + 0.6 * drips) * (0.35 + 0.65 * (1.0 - uv.y));
  float wobble = (vnoise(vec2(uv.y * uScale * 2.0 - t, uv.x * uScale)) - 0.5) * uAmount * 0.12;
  vec2 st = clamp(uv + vec2(wobble, drop), 0.0, 1.0);
  vec4 pic = pictureRGBA(uImage, st);
  // A little sheen along the leading edges of the runs.
  vec3 col = pic.rgb + 0.12 * smoothstep(0.55, 0.9, drips) * uAmount * 4.0;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Slow ooze", values: { uAmount: 0.12, uSpeed: 0.15, uScale: 4 } },
    { name: "Meltdown", values: { uAmount: 0.45, uSpeed: 0.8, uScale: 9 } },
  ],
};

export const imageRisograph: ShaderEffect = {
  kind: "shader",
  id: "image-risograph",
  name: "Risograph",
  description: "An image printed in two posterized, slightly misregistered inks on grainy paper.",
  category: "image",
  video: "filter",
  tags: ["image", "print", "riso", "editorial", "poster"],
  source: glsl(
    `// Risograph: two posterized ink layers, out of register, on grainy paper.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uLevels;       // @control min=2 max=8 default=4 label="Levels"
uniform vec3 uInkA;        // @control color default=#FF48B0 label="Ink A"
uniform vec3 uInkB;        // @control color default=#0078BF label="Ink B"
uniform float uOffset;     // @control min=0 max=20 default=4 label="Misregistration (px)"
uniform float uGrain;      // @control min=0 max=1 default=0.4 label="Grain"
uniform vec3 uPaper;       // @control color default=#F5EFE0 label="Paper"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `// Ink density stepped to a few levels, with grain dithering the steps.
float posterize(float d, float levels, float grain) {
  return clamp(floor(d * (levels - 1.0) + 0.5 + grain) / (levels - 1.0), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 shift = vec2(uOffset, uOffset * 0.6) / iResolution.xy;
  float levels = float(uLevels);
  float fibre = hash12(fragCoord);
  float mottle = vnoise(fragCoord / 6.0);
  // Two separations: ink A where the picture lacks green, ink B where it lacks red.
  vec4 a = pictureRGBA(uImage, uv + shift);
  vec4 b = pictureRGBA(uImage, uv - shift);
  float dA = posterize(1.0 - a.g, levels, (hash12(fragCoord + 17.0) - 0.5) * uGrain * 0.6);
  float dB = posterize(1.0 - b.r, levels, (hash12(fragCoord + 53.0) - 0.5) * uGrain * 0.6);
  // Ink never lays down evenly: mottled, with paper showing through.
  float cover = 0.9 * (1.0 - uGrain * 0.35 * mottle);
  vec3 col = uPaper * (1.0 - uGrain * 0.08 * fibre);
  col *= mix(vec3(1.0), uInkA, dA * cover);
  col *= mix(vec3(1.0), uInkB, dB * cover);
  fragColor = vec4(col, max(a.a, b.a));
}`,
  ),
  presets: [
    { name: "Pink & blue", values: { uInkA: [1, 0.28, 0.69], uInkB: [0, 0.47, 0.75] } },
    { name: "Sunflower & teal", values: { uInkA: [1, 0.71, 0], uInkB: [0, 0.51, 0.54], uLevels: 3 } },
    { name: "Red & black", values: { uInkA: [1, 0.25, 0.25], uInkB: [0.15, 0.15, 0.17], uOffset: 2, uGrain: 0.6 } },
  ],
};

export const imageThermal: ShaderEffect = {
  kind: "shader",
  id: "image-thermal",
  name: "Thermal",
  description: "An image seen through a heat camera or night-vision goggles.",
  category: "image",
  video: "filter",
  tags: ["image", "thermal", "night-vision", "surveillance", "colour"],
  source: glsl(
    `// Thermal: brightness mapped to a heat palette, or to green night-vision phosphor.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uMode;         // @control min=0 max=1 default=0 label="Palette (0 thermal, 1 night vision)"
uniform float uNoise;      // @control min=0 max=0.5 default=0.04 label="Noise"
uniform float uContrast;   // @control min=0.5 max=3 default=1.3 label="Contrast"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `vec3 heat(float t) {
  vec3 c = mix(vec3(0.0, 0.0, 0.08), vec3(0.15, 0.0, 0.55), smoothstep(0.0, 0.2, t));
  c = mix(c, vec3(0.75, 0.0, 0.55), smoothstep(0.2, 0.4, t));
  c = mix(c, vec3(1.0, 0.25, 0.0), smoothstep(0.4, 0.6, t));
  c = mix(c, vec3(1.0, 0.8, 0.0), smoothstep(0.6, 0.8, t));
  return mix(c, vec3(1.0, 1.0, 0.9), smoothstep(0.8, 1.0, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // Heat spreads, so take a soft average around the pixel.
  vec2 px = 2.0 / iResolution.xy;
  vec4 src = 0.4 * pictureRGBA(uImage, uv) + 0.15 * (pictureRGBA(uImage, uv + vec2(px.x, 0.0)) + pictureRGBA(uImage, uv - vec2(px.x, 0.0)) +
             pictureRGBA(uImage, uv + vec2(0.0, px.y)) + pictureRGBA(uImage, uv - vec2(0.0, px.y)));
  float l = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float frame = floor(iTime * 24.0);
  float grain = hash12(fragCoord + frame * 37.1) - 0.5;
  vec3 col;
  if (uMode == 0) {
    col = heat(clamp(l + grain * uNoise, 0.0, 1.0));
  } else {
    float g = clamp(l * 1.2 + grain * uNoise * 2.0, 0.0, 1.0);
    col = vec3(0.12, 1.0, 0.25) * g + vec3(0.02, 0.06, 0.02);
    col *= 0.94 + 0.06 * sin(fragCoord.y * 2.0);
    col *= 0.97 + 0.03 * hash12(vec2(frame, 3.0));
    vec2 d = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    col *= smoothstep(0.75, 0.3, length(d));
  }
  fragColor = vec4(col, src.a);
}`,
  ),
  presets: [
    { name: "Thermal", values: { uMode: 0, uNoise: 0.04, uContrast: 1.3 } },
    { name: "Night vision", values: { uMode: 1, uNoise: 0.2, uContrast: 1.8 } },
  ],
};

export const imageEdgeGlow: ShaderEffect = {
  kind: "shader",
  id: "image-edge-glow",
  name: "Edge glow",
  description: "An image's edges traced as glowing neon lines over a dimmed picture, with a travelling pulse.",
  category: "image",
  video: "filter",
  tags: ["image", "neon", "edges", "outline", "cyber"],
  loop: 2,
  source: glsl(
    `// Edge glow: Sobel edges as neon lines and a soft halo over the dimmed image.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uThreshold;  // @control min=0 max=1 default=0.15 label="Threshold"
uniform vec3 uGlow;        // @control color default=#22D3EE label="Glow colour"
uniform float uWidth;      // @control min=0.5 max=4 default=1.5 label="Glow width (px)"
uniform float uDim;        // @control min=0 max=1 default=0.75 label="Dim image"
uniform float uPulse;      // @control min=0 max=1 default=0.4 label="Pulse"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// Brightness and alpha: an edge is where either changes (an icon's outline is in its alpha).
vec2 lumaAlpha(vec2 uv) {
  vec4 c = pictureRGBA(uImage, uv);
  return vec2(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), c.a);
}

// Sobel edge strength, sampling d apart (in uv).
float sobel(vec2 uv, vec2 d) {
  vec2 tl = lumaAlpha(uv + vec2(-d.x, d.y));
  vec2 t = lumaAlpha(uv + vec2(0.0, d.y));
  vec2 tr = lumaAlpha(uv + d);
  vec2 l = lumaAlpha(uv - vec2(d.x, 0.0));
  vec2 r = lumaAlpha(uv + vec2(d.x, 0.0));
  vec2 bl = lumaAlpha(uv - d);
  vec2 b = lumaAlpha(uv - vec2(0.0, d.y));
  vec2 br = lumaAlpha(uv + vec2(d.x, -d.y));
  vec2 gx = tr + 2.0 * r + br - tl - 2.0 * l - bl;
  vec2 gy = tl + 2.0 * t + tr - bl - 2.0 * b - br;
  return max(length(vec2(gx.x, gy.x)), length(vec2(gx.y, gy.y)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 d = uWidth / iResolution.xy;
  float line = smoothstep(uThreshold, uThreshold + 0.15, sobel(uv, d));
  float halo = smoothstep(uThreshold, uThreshold + 0.5, sobel(uv, d * 3.0));
  vec2 c = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
  float pulse = 1.0 - uPulse * (0.5 + 0.5 * sin(iTime * 3.14159265 - length(c) * 12.0));
  vec4 pic = pictureRGBA(uImage, uv);
  float glow = (line + 0.45 * halo) * pulse;
  vec3 light = uGlow * glow + vec3(1.0) * line * line * 0.35 * pulse;
  // The glow is light added over the picture, so it also shows where the picture is clear.
  float alpha = max(pic.a, clamp(glow, 0.0, 1.0));
  vec3 col = (pic.rgb * (1.0 - uDim) * pic.a + light) / max(alpha, 1e-4);
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "Cyan", values: { uGlow: [0.13, 0.83, 0.93] } },
    { name: "Magenta blackout", values: { uGlow: [0.93, 0.28, 0.6], uDim: 1, uThreshold: 0.1 } },
  ],
};

export const imageTiltShift: ShaderEffect = {
  kind: "shader",
  id: "image-tilt-shift",
  name: "Tilt-shift",
  description: "An image blurred outside a sharp horizontal band, with punchy colour, so it looks like a miniature.",
  category: "image",
  video: "filter",
  tags: ["image", "blur", "miniature", "photography", "depth"],
  source: glsl(
    `// Tilt-shift: blur away from a focus band, plus saturation, for the miniature look.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uFocus;      // @control min=0 max=1 default=0.45 label="Focus position"
uniform float uBand;       // @control min=0 max=0.6 default=0.12 label="Focus band width"
uniform float uBlur;       // @control min=0 max=30 default=12 label="Blur (px)"
uniform float uSaturation; // @control min=0 max=2 default=1.4 label="Saturation"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float away = smoothstep(uBand * 0.5, uBand * 0.5 + 0.3, abs(uv.y - uFocus));
  float radius = away * uBlur;
  // A 24-tap golden-angle disc.
  // Summed premultiplied, so clear parts of the picture do not darken the blur.
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 24.0) * radius;
    float a = fi * 2.39996;
    vec4 c = pictureRGBA(uImage, uv + r * vec2(cos(a), sin(a)) / iResolution.xy);
    sum += vec4(c.rgb * c.a, c.a);
  }
  vec3 col = sum.rgb / max(sum.a, 1e-4);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = clamp((col - 0.5) * 1.08 + 0.5, 0.0, 1.0);
  fragColor = vec4(col, sum.a / 24.0);
}`,
  ),
  presets: [
    { name: "Model village", values: { uFocus: 0.4, uBand: 0.1, uBlur: 16, uSaturation: 1.6 } },
    { name: "Subtle", values: { uBand: 0.25, uBlur: 6, uSaturation: 1.15 } },
  ],
};

export const imageSlitScan: ShaderEffect = {
  kind: "shader",
  id: "image-slit-scan",
  name: "Slit-scan",
  description: "An image smeared into time-stretched streaks, like a slit-scan photograph.",
  category: "image",
  video: "stills",
  tags: ["image", "slit-scan", "smear", "experimental", "distortion"],
  source: glsl(
    `// Slit-scan: rows (or columns) squeeze towards a moving slit and smear into streaks.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uDirection;    // @control min=0 max=1 default=0 label="Direction (0 horizontal, 1 vertical)"
uniform float uStretch;    // @control min=0 max=1 default=0.45 label="Stretch"
uniform float uSpeed;      // @control min=0 max=3 default=0.6 label="Speed"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // along: the axis the streaks run along; across: the axis the delay varies over.
  vec2 a = uDirection == 0 ? uv : uv.yx;
  float t = iTime * uSpeed;
  float delay = vnoise(vec2(a.y * 7.0, t)) * 0.7 + vnoise(vec2(a.y * 31.0, t * 1.7)) * 0.3;
  float slit = 0.5 + 0.35 * sin(t * 0.7 + delay * 2.0);
  // Squeeze towards the slit (stretching what is there) and drift with the delay.
  float along = slit + (a.x - slit) * (1.0 - uStretch * delay);
  along += uStretch * 0.15 * (delay - 0.5);
  // Smear: average a few taps along the streak.
  // Summed premultiplied, so clear parts of the picture do not darken the smear.
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float s = along - float(i) * uStretch * 0.006;
    vec2 st = uDirection == 0 ? vec2(s, a.y) : vec2(a.y, s);
    vec4 c = pictureRGBA(uImage, st);
    sum += vec4(c.rgb * c.a, c.a);
  }
  fragColor = vec4(sum.rgb / max(sum.a, 1e-4), sum.a / 8.0);
}`,
  ),
  presets: [
    { name: "Drift", values: { uDirection: 0, uStretch: 0.3, uSpeed: 0.3 } },
    { name: "Waterfall", values: { uDirection: 1, uStretch: 0.7, uSpeed: 1.2 } },
  ],
};

export const imageMosaic: ShaderEffect = {
  kind: "shader",
  id: "image-mosaic",
  name: "Mosaic flip",
  description: "Hexagonal or triangular tiles flipping over from the left to reveal an image, then back.",
  category: "image",
  video: "filter",
  tags: ["image", "reveal", "transition", "tiles", "hexagon"],
  loop: 6,
  source: glsl(
    `// Mosaic flip: tiles turn over in a wave from the left, background on one face, image on the other.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uShape;        // @control min=0 max=1 default=0 label="Tile shape (0 hexagon, 1 triangle)"
uniform float uSize;       // @control min=10 max=160 default=48 label="Tile size (px)"
uniform bool uAuto;        // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Progress (when still)"
uniform vec3 uBackground;  // @control color default=#0F172A label="Background"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// Hexagon tiles 1 unit across the flats: h is the offset from the tile's centre.
void hexTile(vec2 p, out vec2 h, out vec2 centre) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = (floor(p / s) + 0.5) * s;
  vec2 b = (floor((p - 0.5 * s) / s) + 1.0) * s;
  centre = dot(p - a, p - a) < dot(p - b, p - b) ? a : b;
  h = p - centre;
}

// 0 at a hexagon's centre, 1 on its edge.
float hexEdge(vec2 h) {
  h = abs(h);
  return max(h.x, dot(h, vec2(0.5, 0.8660254))) * 2.0;
}

// Triangle tiles with sides of 1 unit; up is 1 for upward-pointing tiles, -1 for downward.
void triTile(vec2 p, out vec2 h, out vec2 centre, out float up) {
  vec2 q = vec2(p.x - p.y * 0.5773503, p.y * 1.1547005);
  vec2 cell = floor(q);
  vec2 f = q - cell;
  up = f.x + f.y < 1.0 ? 1.0 : -1.0;
  vec2 cq = cell + (up > 0.0 ? vec2(1.0 / 3.0) : vec2(2.0 / 3.0));
  centre = vec2(cq.x + cq.y * 0.5, cq.y * 0.8660254);
  h = p - centre;
}

// 0 at a triangle's centre, 1 on its edge.
float triEdge(vec2 h, float up) {
  h *= up;
  float e = max(-h.y, max(dot(h, vec2(0.8660254, 0.5)), dot(h, vec2(-0.8660254, 0.5))));
  return e / 0.2886751;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float k = uAuto ? smoothstep(0.05, 0.95, 0.5 - 0.5 * cos(iTime * 6.28318 / 6.0)) : uProgress;
  vec2 p = fragCoord / uSize;
  vec2 h;
  vec2 centre;
  float up = 1.0;
  if (uShape == 0) {
    hexTile(p, h, centre);
  } else {
    triTile(p, h, centre, up);
  }
  // Each tile turns over in its own moment, sweeping left to right with a little jitter.
  float start = centre.x * uSize / iResolution.x * 0.75 + hash12(centre * 7.31) * 0.15;
  float flip = smoothstep(0.0, 1.0, clamp((k * 1.35 - start) / 0.35, 0.0, 1.0));
  float squash = abs(cos(flip * 3.14159265));
  vec2 hf = vec2(h.x / max(squash, 0.001), h.y);
  float e = uShape == 0 ? hexEdge(hf) : triEdge(hf, up);
  float gap = 0.1 * (1.0 - flip);
  vec4 col = vec4(uBackground * 0.6, uBackdropAlpha);
  if (e < 1.0 - gap + 0.001) {
    vec4 face = flip < 0.5
      ? vec4(uBackground * (0.9 + 0.2 * hash12(centre * 3.17)) + 0.04, uBackdropAlpha)
      : pictureRGBA(uImage, (centre + hf) * uSize / iResolution.xy);
    col = vec4(face.rgb * (0.5 + 0.5 * squash), face.a);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Hexagons", values: { uShape: 0, uSize: 48 } },
    { name: "Triangles", values: { uShape: 1, uSize: 64 } },
  ],
};

export const imageChromaticLens: ShaderEffect = {
  kind: "shader",
  id: "image-chromatic-lens",
  name: "Chromatic lens",
  description: "An image through a cheap wide lens: barrel distortion and colour fringes growing towards the edges.",
  category: "image",
  video: "filter",
  tags: ["image", "lens", "aberration", "distortion", "vintage"],
  source: glsl(
    `// Chromatic lens: barrel distortion with red, green and blue bent by different amounts.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uDistortion;  // @control min=-0.5 max=1 default=0.25 label="Distortion"
uniform float uAberration;  // @control min=0 max=0.1 default=0.025 label="Aberration"
uniform float uVignette;    // @control min=0 max=1 default=0.4 label="Vignette"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// Where a lens with barrel strength k shows the point c (centred, aspect-corrected) from.
vec2 lens(vec2 c, float k, vec2 aspect) {
  float r2 = dot(c, c);
  // Zoom in to keep the corners filled when barrelling.
  float fill = 1.0 + max(k, 0.0) * 0.3;
  return 0.5 + c * (1.0 + k * r2) / fill / aspect;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  vec2 c = (uv - 0.5) * aspect;
  vec4 r = pictureRGBA(uImage, lens(c, uDistortion + uAberration, aspect));
  vec4 g = pictureRGBA(uImage, lens(c, uDistortion, aspect));
  vec4 b = pictureRGBA(uImage, lens(c, uDistortion - uAberration, aspect));
  vec3 col = vec3(r.r, g.g, b.b);
  col *= 1.0 - uVignette * smoothstep(0.25, 0.95, length(c));
  fragColor = vec4(col, max(max(r.a, g.a), b.a));
}`,
  ),
  presets: [
    { name: "Fisheye", values: { uDistortion: 0.7, uAberration: 0.04, uVignette: 0.6 } },
    { name: "Fringe only", values: { uDistortion: 0, uAberration: 0.05, uVignette: 0.2 } },
  ],
};

export const imageOilPaint: ShaderEffect = {
  kind: "shader",
  id: "image-oil-paint",
  name: "Oil paint",
  description: "An image repainted in flat, edge-keeping brush dabs, like an oil painting.",
  category: "image",
  video: "filter",
  tags: ["image", "painterly", "artistic", "kuwahara", "filter"],
  source: glsl(
    `// Oil paint: a four-sector Kuwahara filter, each pixel takes the calmest neighbourhood's colour.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uRadius;       // @control min=1 max=8 default=4 label="Brush radius (px)"
uniform float uSharpness;  // @control min=0.5 max=8 default=4 label="Sharpness"
uniform float uSaturation; // @control min=0 max=2 default=1.15 label="Saturation"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// Sums of colour and colour² over four overlapping squares (down-left, down-right, up-left, up-right),
// each pixel read once: the shared middle row and column count towards both squares they border.
// A macro so the image and the test card each get their own loop, rather than every read paying for both.
#define GATHER(TAP) { \\
  vec3 c = TAP(uv); \\
  vec3 cc = c * c; \\
  m0 = c; m1 = c; m2 = c; m3 = c; \\
  s0 = cc; s1 = cc; s2 = cc; s3 = cc; \\
  for (int i = 1; i <= 8; i++) { \\
    if (i > uRadius) break; \\
    float o = float(i); \\
    c = TAP(uv - vec2(o * px.x, 0.0)); cc = c * c; m0 += c; s0 += cc; m2 += c; s2 += cc; \\
    c = TAP(uv + vec2(o * px.x, 0.0)); cc = c * c; m1 += c; s1 += cc; m3 += c; s3 += cc; \\
    c = TAP(uv - vec2(0.0, o * px.y)); cc = c * c; m0 += c; s0 += cc; m1 += c; s1 += cc; \\
    c = TAP(uv + vec2(0.0, o * px.y)); cc = c * c; m2 += c; s2 += cc; m3 += c; s3 += cc; \\
  } \\
  for (int j = 1; j <= 8; j++) { \\
    if (j > uRadius) break; \\
    for (int i = 1; i <= 8; i++) { \\
      if (i > uRadius) break; \\
      vec2 o = vec2(float(i), float(j)) * px; \\
      c = TAP(uv - o); m0 += c; s0 += c * c; \\
      c = TAP(uv + vec2(o.x, -o.y)); m1 += c; s1 += c * c; \\
      c = TAP(uv + vec2(-o.x, o.y)); m2 += c; s2 += c * c; \\
      c = TAP(uv + o); m3 += c; s3 += c * c; \\
    } \\
  } \\
}

vec3 imageTap(vec2 uv) {
  return overBackdrop(texture(uImage, uv)).rgb;
}

vec3 cardTap(vec2 uv) {
  return testCard(fract(uv));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;
  vec3 m0, m1, m2, m3, s0, s1, s2, s3;
  if (textureSize(uImage, 0).x > 1) GATHER(imageTap) else GATHER(cardTap)
  float n = float((uRadius + 1) * (uRadius + 1));
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  // Weight each square by how calm (low-variance) it is; sharpness sets how strongly the calmest wins.
  vec4 v = vec4(
    dot(abs(s0 / n - m0 * m0), vec3(1.0)),
    dot(abs(s1 / n - m1 * m1), vec3(1.0)),
    dot(abs(s2 / n - m2 * m2), vec3(1.0)),
    dot(abs(s3 / n - m3 * m3), vec3(1.0))
  );
  vec4 w = pow(v * 100.0 + 1e-3, vec4(-uSharpness));
  vec3 col = (m0 * w.x + m1 * w.y + m2 * w.z + m3 * w.w) / (w.x + w.y + w.z + w.w);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  fragColor = vec4(col, pictureRGBA(uImage, uv).a);
}`,
  ),
  presets: [
    { name: "Broad strokes", values: { uRadius: 7, uSharpness: 6, uSaturation: 1.3 } },
    { name: "Watercolour", values: { uRadius: 3, uSharpness: 1.5, uSaturation: 0.9 } },
  ],
};

/** More image treatments: each takes an image control and changes the picture. */
// BT.709 luma and chroma (Cb, Cr), and back, for keying and skin detection.
const YCBCR = `vec3 toYCbCr(vec3 c) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return vec3(y, (c.b - y) / 1.8556, (c.r - y) / 1.5748);
}
vec3 fromYCbCr(vec3 q) {
  float r = q.x + 1.5748 * q.z;
  float b = q.x + 1.8556 * q.y;
  return vec3(r, (q.x - 0.2126 * r - 0.0722 * b) / 0.7152, b);
}`;

export const imageChromaKey: ShaderEffect = {
  kind: "shader",
  id: "image-chroma-key",
  name: "Chroma key",
  description: "A green- or blue-screen keyer: the screen turns clear (or the backdrop colour) with a soft edge, the screen colour bounced onto the subject is taken back out, and shadows cast on the screen can stay as see-through shade.",
  category: "image",
  video: "filter",
  tags: ["image", "video", "chroma-key", "green-screen", "blue-screen", "keying", "despill", "compositing", "filter"],
  source: glsl(
    `// Chroma key: pixels whose chroma is near the key colour's (scaled to their brightness, so lit and shaded
// parts of the screen both match) turn clear, the key colour's chroma is pulled out of what is left (despill),
// and the screen's darkening under the subject can stay as black shade.
uniform sampler2D uImage;          // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.greenScreen} label="Image"
uniform vec3 uKeyColor;            // @control color default=#22C24E label="Key colour"
uniform float uSimilarity;         // @control min=0 max=1 default=0.35 label="Similarity"
uniform float uSmoothness;         // @control min=0 max=0.5 default=0.1 label="Edge softness"
uniform float uDespill;            // @control min=0 max=1 default=0.8 label="Spill suppression"
uniform float uShadowPreserve;     // @control min=0 max=1 default=0.2 label="Keep shadows"
${BACKDROP_CONTROLS}`,
    PICTURE,
    YCBCR,
    `// The picture as shot (premultiplied), or the test card: the backdrop goes under what the key leaves, not
// under the screen, so this reads it before any backdrop.
vec4 footage(vec2 uv) {
  return textureSize(uImage, 0).x > 1 ? texture(uImage, uv) : vec4(testCard(uv), 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 s = footage(uv);
  vec3 src = s.rgb / max(s.a, 1e-4);
  vec3 q = toYCbCr(src);
  vec3 k = toYCbCr(uKeyColor);
  float keyChroma = max(length(k.yz), 0.02);
  // How far the pixel's chroma is from the screen's at this brightness, as a share of the screen's chroma.
  // Brightness is floored, so black and dark neutral colours (hair, clothes), whose chroma is near none, stay.
  float lit = clamp(q.x / max(k.x, 1e-3), 0.6, 1.6);
  float d = length(q.yz - k.yz * lit) / keyChroma;
  float alpha = smoothstep(uSimilarity, uSimilarity + max(uSmoothness, 1e-3), d) * s.a;
  // Despill: take out the chroma that points the key colour's way, keeping the brightness.
  vec2 dir = k.yz / keyChroma;
  float spill = max(dot(q.yz, dir), 0.0);
  vec3 clean = clamp(fromYCbCr(vec3(q.x, q.yz - dir * spill * uDespill)), 0.0, 1.0);
  // Shade where the screen is darker than the key colour, kept as black under the subject.
  float shade = clamp((1.0 - q.x / max(k.x, 1e-3)) * 2.0, 0.0, 1.0) * uShadowPreserve * (1.0 - alpha) * s.a;
  fragColor = overBackdrop(vec4(clean * alpha, alpha + shade));
}`,
  ),
  presets: [
    { name: "Green screen studio", values: { uKeyColor: [0.13, 0.76, 0.31], uSimilarity: 0.35, uSmoothness: 0.1, uDespill: 0.8 } },
    { name: "Blue screen exterior", values: { uKeyColor: [0.1, 0.31, 0.84], uSimilarity: 0.4, uSmoothness: 0.15, uDespill: 0.9 } },
    { name: "Soft spill reduction", values: { uSimilarity: 0.3, uSmoothness: 0.25, uDespill: 0.5, uShadowPreserve: 0.5 } },
    { name: "Transparent", values: { uBackdropAlpha: 0 } },
  ],
};

export const imageLutGrade: ShaderEffect = {
  kind: "shader",
  id: "image-lut-grade",
  name: "LUT grade",
  description: "A colour grade from a 3D LUT image (or a built-in teal & orange, punchy or film noir look) that leaves skin tones alone, so faces keep their colour under a heavy grade.",
  category: "image",
  video: "filter",
  tags: ["image", "video", "lut", "colour-grading", "color-grading", "skin-tones", "cinematic", "teal-and-orange", "film", "filter"],
  source: glsl(
    `// LUT grade: each colour looked up in a 3D LUT (trilinear, from 8 lattice texels), or graded by a built-in look,
// then eased back towards the original where its hue and saturation say skin, and blended by the intensity.
uniform sampler2D uImage;          // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform sampler2D uLut;            // @control filter=nearest wrap=clamp label="LUT image (n³ colours: n × n tiles, or Hald)"
uniform int uLutLayout;            // @control min=0 max=1 default=0 label="LUT layout (0 tiles, 1 Hald)"
uniform int uLook;                 // @control min=1 max=3 default=1 label="Look without a LUT (1 teal & orange, 2 punchy, 3 film noir)"
uniform float uIntensity;          // @control min=0 max=1 default=1 label="Intensity"
uniform float uPreserveSkinTones;  // @control min=0 max=1 default=0.7 label="Protect skin tones"
uniform float uSkinHue;            // @control min=0 max=60 default=25 label="Skin hue (°)"
uniform float uSkinWidth;          // @control min=5 max=45 default=20 label="Skin hue width (°)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// The LUT's lattice point p (0 to n - 1 on each axis). Tiles: blue picks an n × n tile, left to right then down,
// red runs across it and green down. Hald: red fastest, then green, then blue, row by row. Rows are counted from
// the top of the picture, which was uploaded bottom up.
vec3 lutPoint(ivec3 p, int n, ivec2 size) {
  ivec2 xy;
  if (uLutLayout == 1) {
    int i = p.r + p.g * n + p.b * n * n;
    xy = ivec2(i % size.x, i / size.x);
  } else {
    int across = max(size.x / n, 1);
    xy = ivec2((p.b % across) * n + p.r, (p.b / across) * n + p.g);
  }
  return texelFetch(uLut, ivec2(xy.x, size.y - 1 - xy.y), 0).rgb;
}

// The LUT's lattice size n when the image holds exactly n³ colours in its layout (whole n × n tiles), else 0.
int lutSize() {
  ivec2 size = textureSize(uLut, 0);
  int n = int(floor(pow(float(size.x * size.y), 1.0 / 3.0) + 0.5));
  if (n < 2 || size.x * size.y != n * n * n) return 0;
  return uLutLayout == 1 || (size.x % n == 0 && size.y % n == 0) ? n : 0;
}

vec3 lookUp(vec3 c, int n) {
  ivec2 size = textureSize(uLut, 0);
  vec3 f = clamp(c, 0.0, 1.0) * float(n - 1);
  ivec3 a = ivec3(floor(f));
  ivec3 b = min(a + 1, n - 1);
  vec3 t = f - vec3(a);
  vec3 c00 = mix(lutPoint(a, n, size), lutPoint(ivec3(b.r, a.g, a.b), n, size), t.r);
  vec3 c10 = mix(lutPoint(ivec3(a.r, b.g, a.b), n, size), lutPoint(ivec3(b.r, b.g, a.b), n, size), t.r);
  vec3 c01 = mix(lutPoint(ivec3(a.r, a.g, b.b), n, size), lutPoint(ivec3(b.r, a.g, b.b), n, size), t.r);
  vec3 c11 = mix(lutPoint(ivec3(a.r, b.g, b.b), n, size), lutPoint(b, n, size), t.r);
  return mix(mix(c00, c10, t.g), mix(c01, c11, t.g), t.b);
}

vec3 saturate(vec3 c, float amount) {
  return mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, amount);
}

// The built-in looks: teal shadows and orange highlights; an S-curve and more colour; faded, cool-shadowed noir.
vec3 look(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (uLook == 1) {
    vec3 tone = mix(vec3(-0.07, 0.03, 0.09), vec3(0.09, 0.02, -0.08), smoothstep(0.15, 0.85, l));
    return clamp(saturate(c + tone, 1.15), 0.0, 1.0);
  }
  if (uLook == 2) {
    vec3 s = c * c * (3.0 - 2.0 * c);
    return clamp(saturate(mix(c, s, 0.7), 1.35), 0.0, 1.0);
  }
  float g = smoothstep(0.05, 0.95, l);
  vec3 noir = 0.07 + 0.86 * mix(vec3(g) * vec3(0.96, 0.98, 1.04), vec3(g) * vec3(1.04, 1.0, 0.94), g);
  return clamp(mix(noir, c, 0.06), 0.0, 1.0);
}

// How much c looks like skin: a hue near uSkinHue, moderately saturated, not too dark.
float skin(vec3 c) {
  float hi = max(c.r, max(c.g, c.b));
  float lo = min(c.r, min(c.g, c.b));
  float d = hi - lo;
  if (d < 1e-4) return 0.0;
  float h = hi == c.r ? mod((c.g - c.b) / d, 6.0) : hi == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  float off = abs(mod(h * 60.0 - uSkinHue + 180.0, 360.0) - 180.0);
  float sat = d / max(hi, 1e-4);
  return (1.0 - smoothstep(uSkinWidth * 0.5, uSkinWidth, off)) * smoothstep(0.08, 0.2, sat) * (1.0 - smoothstep(0.75, 0.95, sat)) * smoothstep(0.08, 0.25, hi);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  // An image that is not a LUT (the wrong size for one) is passed over for the built-in look.
  int n = lutSize();
  vec3 graded = n > 0 ? lookUp(pic.rgb, n) : look(pic.rgb);
  vec3 kept = mix(graded, pic.rgb, uPreserveSkinTones * skin(pic.rgb));
  fragColor = vec4(mix(pic.rgb, kept, uIntensity), pic.a);
}`,
  ),
  presets: [
    { name: "Teal & Orange (Protected Face)", values: { uLook: 1, uPreserveSkinTones: 0.85 } },
    { name: "Punchy Contrast", values: { uLook: 2, uPreserveSkinTones: 0.5 } },
    { name: "Faded Film Noir", values: { uLook: 3, uPreserveSkinTones: 0, uImage: SAMPLE_IMAGES.city } },
  ],
};

export const scratchCard: ShaderEffect = {
  kind: "shader",
  id: "scratch-card",
  name: "Scratch card",
  description: "A scratch-off ticket: a coin scrapes its silver foil away row by row, flecks and curled edges and all, to reveal a picture, which shines once uncovered before the foil seals back over.",
  category: "image",
  video: "filter",
  tags: ["image", "reveal", "card", "scratch", "foil", "lottery", "prize", "coin"],
  loop: 6,
  source: glsl(
    `// Scratch card: a coin scratching rows of foil off a ticket's panel (0.4–3.6 s), the picture
// shining once uncovered, then the foil sealing back over (5.2–6 s).
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uFoil;        // @control color default=#B9BEC7 label="Foil"
uniform vec3 uTicket;      // @control color default=#7C3AED label="Ticket"
uniform int uRows;         // @control min=2 max=10 default=4 label="Rows scratched"
uniform bool uCoin;        // @control default=true label="Show the coin"
uniform bool uAuto;        // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Scratched (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `float roundedBox(vec2 p, vec2 hs, float r) {
  vec2 e = abs(p) - hs + r;
  return length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0));
}

// The coin's path through the panel, in the panel's own units (x 0 to its aspect, y 0 at the top
// to 1): along each row, the way back along the next, a short drop between, wobbling as a hand does.
vec2 pathPoint(int i, int rows, float aspect) {
  int row = i / 2;
  bool along = i % 2 == 0;
  float y = (float(row) + 0.5) / float(rows);
  bool right = row % 2 == 0;
  float x = (along == right) ? -0.04 : aspect + 0.04;
  return vec2(x, y + 0.04 / float(rows) * sin(float(i) * 2.3));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float t = mod(iTime, 6.0);
  float scratched = uAuto ? clamp((t - 0.4) / 3.2, 0.0, 1.0) : uProgress;
  float reseal = uAuto ? smoothstep(5.2, 6.0, t) : 0.0;
  // The ticket, with the foil panel inset on it.
  float margin = 0.09 * min(res.x, res.y);
  vec2 hs = 0.5 * res - margin;
  vec2 p = fragCoord - 0.5 * res;
  float panelR = 0.06 * min(hs.x, hs.y);
  float panel = 1.0 - smoothstep(-1.0, 1.0, roundedBox(p, hs, panelR));
  vec2 g = fragCoord / res.y;
  float stripes = 0.5 + 0.5 * sin((g.x + g.y) * 60.0);
  vec3 col = uTicket * (0.88 + 0.12 * stripes);
  col = mix(col, vec3(1.0), 0.85 * (1.0 - smoothstep(0.0, 2.0, abs(roundedBox(p, hs + margin * 0.35, panelR * 1.6)))));
  // Panel units: y from 0 at the top to 1, x from 0 to the panel's aspect.
  float aspect = hs.x / hs.y;
  vec2 q = vec2(p.x + hs.x, hs.y - p.y) / (2.0 * hs.y);
  // The picture under the foil, cropped to the panel.
  vec2 ts = vec2(textureSize(uImage, 0));
  float imageAspect = ts.x / max(ts.y, 1.0);
  vec2 fit = imageAspect > aspect ? vec2(aspect / imageAspect, 1.0) : vec2(1.0, imageAspect / aspect);
  vec2 uv = vec2(q.x / aspect, 1.0 - q.y);
  vec3 pic = picture(uImage, 0.5 + (uv - 0.5) * fit);
  // How far along its path the coin has got, and how near this pixel is to where it has been.
  int rows = clamp(uRows, 2, 10);
  int segs = rows * 2 - 1;
  float total = 0.0;
  for (int i = 0; i < 19; i++) {
    if (i >= segs) break;
    total += length(pathPoint(i + 1, rows, aspect) - pathPoint(i, rows, aspect));
  }
  float reach = scratched * total;
  float d = 1e3;
  vec2 head = pathPoint(0, rows, aspect);
  float done = 0.0;
  for (int i = 0; i < 19; i++) {
    if (i >= segs || done >= reach) break;
    vec2 a = pathPoint(i, rows, aspect);
    vec2 b = pathPoint(i + 1, rows, aspect);
    float len = length(b - a);
    float f = clamp((reach - done) / max(len, 1e-5), 0.0, 1.0);
    head = mix(a, b, f);
    d = min(d, segment(q, a, head));
    done += len;
  }
  float brush = 0.62 / float(rows);
  float px = 1.0 / (2.0 * hs.y);
  // Ragged edges: the stroke's width wanders, finely and coarsely.
  float rough = (vnoise(q * 90.0) - 0.5) * 0.22 + (vnoise(q * 14.0) - 0.5) * 0.25;
  float edgeD = d - brush * (1.0 + rough);
  float bare = (1.0 - smoothstep(-px, px, edgeD)) * step(0.0005, scratched) * (1.0 - reseal);
  // Foil: brushed silver, a sheen gliding across and specks of glitter.
  float brushed = vnoise(vec2(q.x * 4.0, q.y * 160.0));
  vec3 foil = uFoil * (0.82 + 0.18 * brushed);
  float sheen = exp(-pow(q.x * 0.6 - q.y * 0.4 - (fract(iTime * 0.17) * 2.4 - 0.6) * aspect * 0.6, 2.0) * 18.0);
  foil += 0.22 * sheen;
  foil += 0.35 * step(0.992, hash12(floor(fragCoord / 2.0))) * (0.5 + 0.5 * sin(iTime * 4.0 + hash12(floor(fragCoord / 2.0)) * 30.0));
  // Embossed diamonds, faintly.
  vec2 dm = abs(fract(vec2(q.x + q.y, q.x - q.y) * 6.0) - 0.5);
  foil *= 0.96 + 0.04 * smoothstep(0.42, 0.48, max(dm.x, dm.y));
  // The foil curls up dark along the scratched edge, and loose flecks lie just past it.
  float lip = exp(-max(edgeD, 0.0) / (brush * 0.12)) * (1.0 - bare);
  foil *= 1.0 - 0.35 * lip * step(0.0005, scratched) * (1.0 - reseal);
  float fleck = step(0.93, hash12(floor(fragCoord / 3.0))) * (1.0 - smoothstep(0.0, brush * 0.5, edgeD)) * step(0.0, edgeD);
  foil = mix(foil, uFoil * 1.25, fleck * (1.0 - reseal) * step(0.0005, scratched));
  // Uncovered, the picture shines once across.
  float shine = uAuto ? exp(-pow(q.x - q.y * 0.5 - (t - 3.8) * aspect * 1.1, 2.0) * 30.0) * step(3.6, t) : 0.0;
  vec3 under = pic + 0.4 * shine;
  // A soft inner shadow round the bare panel.
  under *= 1.0 - 0.25 * exp(roundedBox(p, hs, panelR) / (margin * 0.15));
  vec3 inPanel = mix(foil, under, bare);
  col = mix(col, inPanel, panel);
  // The coin, tilted, riding the head of the scratch.
  if (uCoin && uAuto && scratched > 0.0 && scratched < 1.0) {
    vec2 cp = (q - head - vec2(0.0, -0.02)) / brush;
    vec2 e = cp * vec2(1.0, 1.6);
    float r = length(e);
    float body = 1.0 - smoothstep(0.95 - px / brush * 2.0, 0.95, r);
    float shade = 1.0 - smoothstep(0.7, 1.4, length((q - head - vec2(0.05, 0.06) * brush) / brush * vec2(1.0, 1.6)));
    col *= 1.0 - 0.3 * shade * (1.0 - body);
    vec3 gold = mix(vec3(0.85, 0.62, 0.18), vec3(1.0, 0.86, 0.45), smoothstep(0.6, -0.6, e.x + e.y));
    gold *= 0.85 + 0.15 * smoothstep(0.78, 0.7, r);
    col = mix(col, gold, body);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Gold ticket", values: { uFoil: [0.88, 0.74, 0.38], uTicket: [0.07, 0.09, 0.16], uRows: 3 } },
    { name: "Quick scratch", values: { uRows: 2, uTicket: [0.94, 0.27, 0.27] } },
  ],
};

export const polaroidDevelop: ShaderEffect = {
  kind: "shader",
  id: "polaroid-develop",
  name: "Polaroid develop",
  description: "An instant photo sliding onto the table and given a shake, its picture developing out of murky blue-green to full, slightly faded colour inside the white frame.",
  category: "image",
  video: "filter",
  tags: ["image", "reveal", "card", "polaroid", "instant-photo", "film", "retro", "develop"],
  loop: 7,
  source: glsl(
    `// Polaroid develop: the print slides in (0–0.8 s), is shaken (0.8–2 s) and develops (0.8–5 s),
// then fades away (6.3–7 s) for the next.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uTable;       // @control color default=#C8B59A label="Table"
uniform vec3 uFrame;       // @control color default=#F5F2EA label="Frame"
uniform float uTilt;       // @control min=-15 max=15 default=-4 label="Tilt (degrees)"
uniform bool uAuto;        // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Developed (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `float roundedBox(vec2 p, vec2 hs, float r) {
  vec2 e = abs(p) - hs + r;
  return length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float t = uAuto ? mod(iTime, 7.0) : 3.0;
  float developed = uAuto ? smoothstep(0.8, 5.0, t) : uProgress;
  float slide = uAuto ? 1.0 - pow(1.0 - clamp(t / 0.8, 0.0, 1.0), 3.0) : 1.0;
  float shake = uAuto ? sin((t - 0.8) * 26.0) * exp(-(t - 0.8) * 2.2) * step(0.8, t) : 0.0;
  float gone = uAuto ? smoothstep(6.3, 7.0, t) : 0.0;
  // The print: 88 × 107, the picture square under a thin top and sides and a deep bottom.
  float h = min(res.y * 0.84, res.x * 0.84 / 0.822);
  vec2 hs = vec2(h * 0.822, h) * 0.5;
  vec2 centre = 0.5 * res + vec2(shake * h * 0.02, (1.0 - slide) * (res.y * 0.5 + h) + gone * h * 0.08);
  float ang = radians(uTilt + shake * 6.0 + (1.0 - slide) * 14.0);
  vec2 p = fragCoord - centre;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  // The table: a soft-lit surface with a little grain.
  vec2 g = fragCoord / res.y;
  vec3 col = uTable * (0.92 + 0.08 * vnoise(g * vec2(3.0, 40.0))) * (1.05 - 0.25 * length(fragCoord / res - 0.5));
  // Its shadow, softer the higher it is off the table.
  float lift = (1.0 - slide) + abs(shake) * 0.4;
  float sd = roundedBox(p, hs, h * 0.008);
  float shadowD = roundedBox(p - vec2(h * 0.012, -h * (0.018 + 0.05 * lift)), hs, h * 0.02);
  col *= 1.0 - 0.38 * (1.0 - smoothstep(-h * 0.02, h * (0.05 + 0.08 * lift), shadowD)) * (1.0 - gone);
  float mask = (1.0 - smoothstep(-1.0, 1.0, sd)) * (1.0 - gone);
  if (mask > 0.0) {
    vec3 paper = uFrame * (0.97 + 0.03 * vnoise(p / h * 60.0));
    float side = hs.x * 2.0 * 0.068;
    float win = hs.x - side;
    vec2 wc = vec2(0.0, hs.y - side - win);
    vec2 wp = p - wc;
    float wsd = roundedBox(wp, vec2(win), 1.0);
    vec3 face = paper;
    if (wsd < 1.0) {
      vec2 uv = wp / (2.0 * win) + 0.5;
      vec2 ts = vec2(textureSize(uImage, 0));
      float imageAspect = ts.x / max(ts.y, 1.0);
      vec2 fit = imageAspect > 1.0 ? vec2(1.0 / imageAspect, 1.0) : vec2(1.0, imageAspect);
      vec3 pic = picture(uImage, 0.5 + (uv - 0.5) * fit);
      // Developing unevenly: from the dark emulsion to a ghost in blue-green, then to colour.
      float d = clamp(developed * 1.2 - 0.2 * vnoise(uv * 3.0 + 7.0), 0.0, 1.0);
      float lum = dot(pic, vec3(0.299, 0.587, 0.114));
      vec3 ghost = mix(vec3(0.15, 0.23, 0.25), vec3(0.55, 0.63, 0.57), lum);
      vec3 film = mix(pic, vec3(lum), 0.12) * vec3(1.03, 0.99, 0.93) + 0.03;
      vec3 shot = mix(vec3(0.1, 0.15, 0.17), ghost, smoothstep(0.0, 0.45, d));
      shot = mix(shot, film, smoothstep(0.35, 1.0, d));
      // A slight inset where the picture meets the frame.
      shot *= 1.0 - 0.25 * exp(wsd / (h * 0.006));
      face = mix(shot, paper, smoothstep(-1.0, 1.0, wsd));
    }
    col = mix(col, face, mask);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dark desk", values: { uTable: [0.16, 0.13, 0.11], uTilt: 6 } },
    { name: "Half developed", values: { uAuto: false, uProgress: 0.45, uTilt: 0 } },
  ],
};

export const imageTreatments: ShaderEffect[] = [
  imageKenBurns,
  imageAscii,
  imageShatter,
  imageMelt,
  imageRisograph,
  imageThermal,
  imageEdgeGlow,
  imageTiltShift,
  imageSlitScan,
  imageMosaic,
  imageChromaticLens,
  imageOilPaint,
  imageChromaKey,
  imageLutGrade,
  scratchCard,
  polaroidDevelop,
];
