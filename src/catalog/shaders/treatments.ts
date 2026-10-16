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
  vec4 col = vec4(uBackground, uBackdropAlpha);
  float top = -1.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 c = base + vec2(float(i), float(j));
      vec2 site = shardSite(c);
      vec2 h = hash22(c + 41.7);
      vec2 centre = site * grow + (h - 0.5) * 1.2 * k;
      float a = (h.x - 0.5) * 2.0 * uSpin * k;
      // Back to where this pixel would sit in the unbroken image, if it is on this shard.
      vec2 q = rot(-a) * (p - centre) + site;
      vec3 s = shardAt(q);
      if (s.x == c.x && s.y == c.y && h.y > top) {
        top = h.y;
        vec2 uv = q / uCount * iResolution.y / iResolution.xy + 0.5;
        vec4 shard = pictureRGBA(uImage, uv);
        shard.rgb *= 1.0 - 0.35 * k * abs(sin(a));
        shard.rgb += k * 0.35 * smoothstep(0.06, 0.0, s.z);
        col = shard;
      }
    }
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
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;
  // Sums of colour and colour² over four overlapping squares: down-left, down-right, up-left, up-right.
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = 0; j <= 8; j++) {
    if (j > uRadius) break;
    for (int i = 0; i <= 8; i++) {
      if (i > uRadius) break;
      vec2 o = vec2(float(i), float(j)) * px;
      vec3 c = picture(uImage, uv + vec2(-o.x, -o.y));
      m0 += c;
      s0 += c * c;
      c = picture(uImage, uv + vec2(o.x, -o.y));
      m1 += c;
      s1 += c * c;
      c = picture(uImage, uv + vec2(-o.x, o.y));
      m2 += c;
      s2 += c * c;
      c = picture(uImage, uv + o);
      m3 += c;
      s3 += c * c;
    }
  }
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
];
