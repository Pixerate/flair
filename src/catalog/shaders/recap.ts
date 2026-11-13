import { glsl, HASH, NOISE, OKLAB_MIX, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Recap effects: the flat, loud graphic language of a year-in-review story.
 * Ribbons of clashing colour, nested shapes, tiles of morphing geometry, a
 * gradient cut into steps, titles that echo and stretch, pictures smeared
 * from a line or run through a photocopier, and a wipe of colour bands. Each
 * is filed under the category it belongs to (pattern, gradient, text, image,
 * transition) and tagged "recap".
 */

/** Four flat colours and `flatColour(i)`, which cycles through them. */
const FOUR_COLOURS = `
uniform vec3 uColorA;     // @control color default=#F037A5 label="Colour A"
uniform vec3 uColorB;     // @control color default=#CDF564 label="Colour B"
uniform vec3 uColorC;     // @control color default=#4100F5 label="Colour C"
uniform vec3 uColorD;     // @control color default=#FF4632 label="Colour D"`.trim();

const FLAT_COLOUR = `
vec3 flatColour(int i) {
  int k = i - 4 * (i / 4);
  return k == 0 ? uColorA : k == 1 ? uColorB : k == 2 ? uColorC : uColorD;
}`.trim();

/** The text image's alpha at a frame point: `letters(p)`, as the other text shaders read it. Needs `uText` and `uSize`. */
const LETTERS = `
// The text image's alpha at frame point p (height 1, centred), the image contained in uSize of the frame.
float letters(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}`.trim();

export const ribbonBands: ShaderEffect = {
  kind: "shader",
  id: "ribbon-bands",
  name: "Ribbon bands",
  description: "Flat ribbons of clashing colour stacked across the frame, each edge riding its own slow wave so they overlap and part, with a soft shadow under every fold.",
  category: "pattern",
  tags: ["background", "ribbon", "stripe", "wave", "flat", "bold", "recap", "story", "loop"],
  loop: 8,
  source: glsl(
    `// Ribbon bands: flat ribbons stacked down the frame, each edge on its own wave, the lower laid over the upper.
${FOUR_COLOURS}
uniform int uCount;       // @control min=3 max=16 default=8 label="Ribbons"
uniform float uWave;      // @control min=0 max=1 default=0.55 label="Wave"
uniform float uFrequency; // @control min=0.5 max=6 default=1.6 label="Wave frequency"
uniform float uAngle;     // @control min=-180 max=180 default=-18 label="Angle (°)"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uLines;     // @control min=0 max=1 default=0.35 label="Pinstripes"
uniform float uShadow;    // @control min=0 max=1 default=0.4 label="Shadow"`,
    HASH,
    ROTATE,
    FLAT_COLOUR,
    `// A ribbon's colour, pinstriped along its own top edge; d is how far under that edge the point is.
vec3 ribbon(int i, float d, float pitch, float px) {
  float s = d / pitch * 5.0;
  float aa = px / pitch * 5.0;
  float line = smoothstep(0.1 + aa, 0.1 - aa, abs(fract(s) - 0.5));
  return flatColour(i) * (1.0 - 0.22 * uLines * line);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float a = radians(uAngle);
  p = rot(a) * p;
  // Half the frame's height as the ribbons see it, turned.
  float half_ = 0.5 * (abs(sin(a)) * iResolution.x / iResolution.y + abs(cos(a)));
  float pitch = 2.0 * half_ / float(uCount);
  float t = iTime * uSpeed * 6.28318 / 8.0;
  float px = 1.5 / iResolution.y;
  vec3 col = ribbon(0, half_ + pitch - p.y, pitch, px);
  for (int i = 1; i < 16; i++) {
    if (i >= uCount) break;
    vec2 h = hash22(vec2(float(i), 3.7));
    float turn = (i - 2 * (i / 2) == 0 ? 1.0 : -1.0) * float(1 + i - 3 * (i / 3));
    float wave = 0.65 * sin(p.x * uFrequency * (0.7 + 0.6 * h.x) + t * turn + h.y * 6.28318)
               + 0.35 * sin(p.x * uFrequency * 2.3 - t * 2.0 + h.x * 6.28318);
    float edge = half_ - pitch * float(i) + uWave * pitch * 1.3 * wave;
    float d = edge - p.y;
    // The ribbon behind darkens just above this one's edge.
    float under = smoothstep(-pitch * 0.5, 0.0, d);
    col *= 1.0 - uShadow * 0.4 * under * under;
    col = mix(col, ribbon(i, d, pitch, px), smoothstep(-px, px, d));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Clash", values: {} },
    { name: "Sorbet", values: { uColorA: [1, 0.72, 0.62], uColorB: [1, 0.9, 0.6], uColorC: [0.72, 0.86, 1], uColorD: [0.98, 0.6, 0.78], uLines: 0, uShadow: 0.25 } },
    { name: "Ink and paper", values: { uColorA: [0.07, 0.07, 0.07], uColorB: [0.96, 0.94, 0.88], uColorC: [0.07, 0.07, 0.07], uColorD: [0.96, 0.94, 0.88], uCount: 12, uLines: 0, uShadow: 0, uAngle: 35 } },
    { name: "Calm stack", values: { uWave: 0.15, uCount: 6, uAngle: 0, uSpeed: 0.5, uLines: 0.6 } },
  ],
};

export const concentricShapes: ShaderEffect = {
  kind: "shader",
  id: "concentric-shapes",
  name: "Concentric shapes",
  description: "Flat-coloured shapes nested inside one another, growing out of the centre (or sinking into it) as they turn and morph between circle, squircle, flower and star.",
  category: "pattern",
  tags: ["background", "concentric", "ring", "tunnel", "shape", "flat", "bold", "recap", "story", "title"],
  source: glsl(
    `// Concentric shapes: nested flat shapes streaming out of a centre point, each ring turned a little more than the last.
${FOUR_COLOURS}
uniform int uShape;       // @control min=0 max=4 default=4 label="Shape (0 circle, 1 squircle, 2 flower, 3 star, 4 morphing)"
uniform int uRings;       // @control min=3 max=20 default=9 label="Rings"
uniform int uPoints;      // @control min=3 max=12 default=6 label="Petals or points"
uniform float uSpeed;     // @control min=0 max=3 default=0.5 label="Speed"
uniform bool uInward;     // @control default=false label="Stream inward"
uniform float uTwist;     // @control min=-2 max=2 default=0.4 label="Twist"
uniform float uSpin;      // @control min=-2 max=2 default=0.15 label="Spin"
uniform vec2 uCentre;     // @control min=0 max=1 default=0.5,0.5 label="Centre"`,
    FLAT_COLOUR,
    `// How far the shape reaches at angle th, between 0.5 and 1 of its ring's radius.
float shapeRadius(float th, int kind, float n) {
  if (kind == 1) {
    vec2 c = vec2(cos(th), sin(th));
    c *= c;
    return 0.84 / sqrt(sqrt(dot(c, c)));
  }
  if (kind == 2) return 0.8 + 0.2 * cos(th * n);
  if (kind == 3) return 0.5 + 0.5 * abs(fract(th * n / 6.28318) - 0.5) * 2.0;
  return 0.92;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - uCentre * iResolution.xy) / iResolution.y;
  float rr = length(p);
  float th = atan(p.y, p.x);
  // Rings are spaced so uRings of them reach the farthest corner.
  vec2 corner = (abs(uCentre - 0.5) + 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
  float spacing = length(corner) / float(uRings);
  float flow = iTime * uSpeed * (uInward ? -1.0 : 1.0);
  float shift = fract(flow);
  float base = floor(flow);
  float px = 1.5 / iResolution.y;
  float n = float(uPoints);
  // From the smallest ring that could hold this point outward: the first to cover it is on top.
  float first = max(floor(rr / spacing - shift), 0.0);
  vec3 col = vec3(0.0);
  float acc = 0.0;
  for (int k = 0; k < 28; k++) {
    float j = first + float(k);
    float rho = (j + shift) * spacing;
    float a = th - uTwist * rho * 2.0 - uSpin * iTime;
    float R;
    if (uShape < 4) {
      R = shapeRadius(a, uShape, n);
    } else {
      float m = iTime * uSpeed * 0.5 - rho * 0.45;
      int k0 = int(mod(floor(m), 4.0));
      int k1 = k0 == 3 ? 0 : k0 + 1;
      R = mix(shapeRadius(a, k0, n), shapeRadius(a, k1, n), smoothstep(0.3, 0.7, fract(m)));
    }
    float cover = smoothstep(-px, px, rho * R - rr);
    col += (1.0 - acc) * cover * flatColour(int(mod(j - base, 4.0) + 0.5));
    acc += (1.0 - acc) * cover;
    if (acc > 0.995) break;
  }
  fragColor = vec4(col / max(acc, 1e-3), 1.0);
}`,
  ),
  presets: [
    { name: "Shapeshifter", values: {} },
    { name: "Bloom", values: { uShape: 2, uPoints: 8, uTwist: 0.8, uRings: 11 } },
    { name: "Bullseye", values: { uShape: 0, uTwist: 0, uSpin: 0, uColorC: [0.94, 0.22, 0.65], uColorD: [0.8, 0.96, 0.39], uRings: 12 } },
    { name: "Star dive", values: { uShape: 3, uPoints: 5, uInward: true, uTwist: -0.6, uSpeed: 0.9, uColorA: [1, 0.85, 0.2], uColorB: [0.07, 0.07, 0.07], uColorC: [1, 0.27, 0.2], uColorD: [0.07, 0.07, 0.07] } },
    { name: "Squircle stack", values: { uShape: 1, uTwist: 0.25, uSpin: 0, uRings: 7, uSpeed: 0.3 } },
  ],
};

export const shapeTiles: ShaderEffect = {
  kind: "shader",
  id: "shape-tiles",
  name: "Shape tiles",
  description: "A grid of flat-coloured tiles, each holding a disc, quarter circle, half circle, diamond, ring or square that morphs into another and swaps colours on its own beat.",
  category: "pattern",
  tags: ["background", "tiles", "grid", "geometric", "shape", "flat", "bold", "bauhaus", "recap", "story"],
  source: glsl(
    `// Shape tiles: every tile morphs from one simple shape to the next, each on its own beat.
${FOUR_COLOURS}
uniform float uSize;      // @control min=40 max=400 default=170 label="Tile size (px)"
uniform float uRate;      // @control min=0 max=2 default=0.45 label="Changes per second"
uniform float uStagger;   // @control min=0 max=1 default=1 label="Stagger"`,
    HASH,
    FLAT_COLOUR,
    `// A tile's shape at q (the tile runs -0.5 to 0.5), negative inside.
float tileShape(vec2 q, int kind) {
  if (kind == 0) return length(q) - 0.36;
  if (kind == 1) return length(q + 0.5) - 0.86;
  if (kind == 2) return length(vec2(q.x, q.y + 0.5)) - 0.5;
  if (kind == 3) return abs(q.x) + abs(q.y) - 0.44;
  if (kind == 4) return abs(length(q) - 0.29) - 0.1;
  return max(abs(q.x), abs(q.y)) - 0.27;
}

vec2 quarterTurns(vec2 q, int n) {
  return n == 0 ? q : n == 1 ? vec2(q.y, -q.x) : n == 2 ? -q : vec2(-q.y, q.x);
}

// What a tile holds on a beat: x its shape, y its turn, z its colour, w how far on its ground's colour is.
vec4 tileState(vec2 cell, float beat) {
  vec2 a = hash22(cell + beat * vec2(7.31, 3.17));
  vec2 b = hash22(cell * 1.7 + 11.0 + beat * vec2(5.11, 9.73));
  return vec4(min(floor(a.x * 6.0), 5.0), min(floor(a.y * 4.0), 3.0), min(floor(b.x * 4.0), 3.0), 1.0 + min(floor(b.y * 3.0), 2.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 g = (fragCoord - 0.5 * iResolution.xy) / uSize;
  vec2 cell = floor(g);
  vec2 q = fract(g) - 0.5;
  // Each tile rests on its shape, then morphs over the first part of its beat.
  float T = iTime * uRate + 0.45 + 0.5 * uStagger * hash12(cell + 0.5);
  float beat = floor(T);
  float e = smoothstep(0.0, 0.4, fract(T));
  vec4 was = tileState(cell, beat - 1.0);
  vec4 now = tileState(cell, beat);
  float d = mix(tileShape(quarterTurns(q, int(was.y)), int(was.x)), tileShape(quarterTurns(q, int(now.y)), int(now.x)), e);
  float px = 1.5 / uSize;
  vec3 shape = mix(flatColour(int(was.z)), flatColour(int(now.z)), e);
  vec3 ground = mix(flatColour(int(was.z + was.w)), flatColour(int(now.z + now.w)), e);
  fragColor = vec4(mix(ground, shape, smoothstep(px, -px, d)), 1.0);
}`,
  ),
  presets: [
    { name: "Clash", values: {} },
    { name: "Primary school", values: { uColorA: [0.9, 0.16, 0.14], uColorB: [0.98, 0.8, 0.1], uColorC: [0.1, 0.25, 0.7], uColorD: [0.96, 0.94, 0.88] } },
    { name: "Two tone", values: { uColorA: [0.07, 0.07, 0.07], uColorB: [0.8, 0.96, 0.39], uColorC: [0.07, 0.07, 0.07], uColorD: [0.8, 0.96, 0.39], uSize: 110 } },
    { name: "All together", values: { uStagger: 0, uRate: 0.6, uSize: 240 } },
  ],
};

export const steppedGradient: ShaderEffect = {
  kind: "shader",
  id: "stepped-gradient",
  name: "Stepped gradient",
  description: "A three-colour gradient cut into flat steps, the edge between each pair broken into a ragged skyline of pixel stairs, swaying slowly.",
  category: "gradient",
  tags: ["background", "gradient", "steps", "pixel", "blocks", "stairs", "flat", "bold", "recap", "story"],
  source: glsl(
    `// Stepped gradient: a gradient cut into flat steps and drawn in big square blocks, the steps' edges ragged stairs.
uniform vec3 uColorA;     // @control color default=#4100F5 label="Colour A"
uniform vec3 uColorB;     // @control color default=#F037A5 label="Colour B"
uniform vec3 uColorC;     // @control color default=#CDF564 label="Colour C"
uniform int uSteps;       // @control min=2 max=24 default=7 label="Steps"
uniform float uBlock;     // @control min=4 max=160 default=40 label="Block size (px)"
uniform float uStairs;    // @control min=0 max=1 default=0.75 label="Pixel stairs"
uniform float uAngle;     // @control min=-180 max=180 default=90 label="Angle (°)"
uniform float uWave;      // @control min=0 max=1 default=0.45 label="Wave"
uniform float uSpeed;     // @control min=0 max=2 default=0.35 label="Speed"`,
    HASH,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uBlock);
  vec2 c = ((cell + 0.5) * uBlock - 0.5 * iResolution.xy) / iResolution.y;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 perp = vec2(-dir.y, dir.x);
  float extent = abs(dir.x) * iResolution.x / iResolution.y + abs(dir.y);
  float t = iTime * uSpeed;
  float across = dot(c, perp);
  float g = dot(c, dir) / extent + 0.5;
  g += uWave * (0.16 * sin(across * 3.0 + t) + 0.07 * sin(across * 7.3 - t * 1.3));
  // Each block rounds to a step; every column of blocks (and every run of three) rounds at its own height, in stairs.
  float column = abs(dir.y) > abs(dir.x) ? cell.x : cell.y;
  float q = clamp(g, 0.0, 1.0) * float(uSteps);
  float threshold = 0.5 + (0.55 * hash12(vec2(column, 1.0)) + 0.45 * hash12(vec2(floor(column / 3.0), 2.0)) - 0.5) * uStairs;
  float level = min(floor(q) + step(threshold, fract(q)), float(uSteps)) / float(uSteps);
  vec3 col = level < 0.5 ? oklabMix(uColorA, uColorB, level * 2.0) : oklabMix(uColorB, uColorC, level * 2.0 - 1.0);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Clash", values: {} },
    { name: "Sunset blocks", values: { uColorA: [0.16, 0.08, 0.36], uColorB: [1, 0.27, 0.2], uColorC: [1, 0.85, 0.35] } },
    { name: "Clean steps", values: { uStairs: 0, uWave: 0.15, uSteps: 9 } },
    { name: "Big pixels", values: { uBlock: 96, uSteps: 4, uStairs: 1 } },
    { name: "Mono", values: { uColorA: [0.07, 0.07, 0.07], uColorB: [0.5, 0.5, 0.5], uColorC: [0.96, 0.94, 0.88], uSteps: 5 } },
  ],
};

export const echoText: ShaderEffect = {
  kind: "shader",
  id: "echo-text",
  name: "Echo text",
  description: "A title trailed by copies of its own outline in two alternating colours, fanning out behind it and folding back in a ripple. Set the outline width to 0 for solid stacked copies.",
  category: "text",
  video: "none",
  tags: ["text", "title", "echo", "outline", "trail", "repeat", "kinetic", "bold", "recap", "story", "loop"],
  loop: 4,
  source: glsl(
    `// Echo text: copies of a title's outline step away behind it, each hiding the ones further back.
uniform sampler2D uText;   // @control filter=linear wrap=clamp default=${textImage("FLAIR")} label="Text"
uniform vec3 uBackground;  // @control color default=#4100F5 label="Background"
uniform vec3 uInk;         // @control color default=#FFFFFF label="Text"
uniform vec3 uEchoA;       // @control color default=#F037A5 label="Echo A"
uniform vec3 uEchoB;       // @control color default=#CDF564 label="Echo B"
uniform int uEchoes;       // @control min=1 max=12 default=7 label="Echoes"
uniform float uSpread;     // @control min=0 max=0.12 default=0.04 label="Spread"
uniform float uAngle;      // @control min=-180 max=180 default=-90 label="Angle (°)"
uniform float uGrow;       // @control min=0 max=0.3 default=0.03 label="Grow"
uniform float uOutline;    // @control min=0 max=0.012 default=0.005 label="Outline width (0 fills)"
uniform float uSize;       // @control min=0.3 max=1 default=0.7 label="Text size"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"`,
    LETTERS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  float phase = iTime * uSpeed * 6.28318 / 4.0;
  vec3 col = uBackground;
  // Farthest echo first, so nearer ones cover it.
  for (int k = 0; k < 12; k++) {
    int i = uEchoes - k;
    if (i < 1) break;
    float fi = float(i);
    // Each echo opens a little after the one in front of it.
    float open = 0.5 - 0.5 * cos(phase - fi * 0.3);
    open = uSpeed > 0.0 ? open * open * (3.0 - 2.0 * open) : 1.0;
    vec2 q = (p - dir * uSpread * fi * open) / (1.0 + uGrow * fi * open);
    float fill = letters(q);
    vec3 echo = i - 2 * (i / 2) == 1 ? uEchoA : uEchoB;
    if (uOutline > 0.0) {
      float ring = fill;
      for (int s = 0; s < 6; s++) {
        float b = float(s) * 1.0472;
        ring = max(ring, letters(q + vec2(cos(b), sin(b)) * uOutline));
      }
      col = mix(col, echo, ring);
      col = mix(col, uBackground, fill);
    } else {
      col = mix(col, echo, fill);
    }
  }
  col = mix(col, uInk, letters(p));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Outline trail", values: {} },
    { name: "Solid stack", values: { uOutline: 0, uSpread: 0.022, uAngle: -45, uGrow: 0, uEchoes: 8, uBackground: [0.8, 0.96, 0.39], uInk: [0.07, 0.07, 0.07], uEchoA: [0.94, 0.22, 0.65], uEchoB: [0.25, 0, 0.96] } },
    { name: "Zoom out", values: { uSpread: 0, uGrow: 0.16, uEchoes: 9, uSize: 0.5, uBackground: [0.07, 0.07, 0.07], uEchoA: [1, 0.27, 0.2], uEchoB: [1, 0.85, 0.2] } },
    { name: "Ghost", values: { uEchoes: 5, uSpread: 0.03, uAngle: 180, uGrow: 0, uOutline: 0.003, uBackground: [0.96, 0.94, 0.88], uInk: [0.07, 0.07, 0.07], uEchoA: [0.07, 0.07, 0.07], uEchoB: [0.5, 0.5, 0.5] } },
  ],
};

export const stretchText: ShaderEffect = {
  kind: "shader",
  id: "stretch-text",
  name: "Stretch text",
  description: "A title whose letters are pulled tall along a cut line, the stretch travelling across the word in a wave, like type drawn on a variable-height axis.",
  category: "text",
  video: "none",
  tags: ["text", "title", "stretch", "variable", "kinetic", "wave", "bold", "recap", "story", "loop"],
  loop: 4,
  source: glsl(
    `// Stretch text: the row of letters at a cut line is drawn out into tall bars, by an amount that waves across the word.
uniform sampler2D uText;   // @control filter=linear wrap=clamp default=${textImage("FLAIR")} label="Text"
uniform vec3 uBackground;  // @control color default=#CDF564 label="Background"
uniform vec3 uInk;         // @control color default=#121212 label="Text"
uniform vec3 uBand;        // @control color default=#F037A5 label="Stretch colour"
uniform float uTint;       // @control min=0 max=1 default=0 label="Stretch colour amount"
uniform float uStretch;    // @control min=0 max=1 default=0.7 label="Stretch"
uniform float uCut;        // @control min=0.1 max=0.9 default=0.5 label="Cut height"
uniform float uWaves;      // @control min=0 max=4 default=1 label="Waves across"
uniform int uColumns;      // @control min=0 max=24 default=0 label="Columns (0 smooth)"
uniform float uSize;       // @control min=0.15 max=0.8 default=0.34 label="Text size"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * 0.92 / aspect);
  // u, v: across and up the unstretched text, 0–1.
  float u = p.x / (h * aspect) + 0.5;
  float v = p.y / h + 0.5;
  float across = uColumns > 0 ? (floor(u * float(uColumns)) + 0.5) / float(uColumns) : u;
  float wave = 0.5 + 0.5 * sin(across * uWaves * 6.28318 - iTime * uSpeed * 6.28318 / 4.0);
  // The most the text can grow and still fit the frame.
  float s = uStretch * max(0.94 / h - 1.0, 0.0) * wave;
  // Rows above and below the cut move apart by s; the gap repeats the row at the cut.
  float d = v - uCut;
  float inBand = step(abs(d), 0.5 * s);
  float row = uCut + sign(d) * max(abs(d) - 0.5 * s, 0.0);
  float mask = 0.0;
  if (u >= 0.0 && u <= 1.0 && row >= 0.0 && row <= 1.0) mask = texture(uText, vec2(u, row)).a;
  vec3 ink = mix(uInk, uBand, uTint * inBand);
  fragColor = vec4(mix(uBackground, ink, mask), 1.0);
}`,
  ),
  presets: [
    { name: "Wave", values: {} },
    { name: "Two tone", values: { uTint: 1, uBackground: [0.07, 0.07, 0.07], uInk: [0.96, 0.94, 0.88], uBand: [0.94, 0.22, 0.65] } },
    { name: "Equaliser", values: { uColumns: 14, uWaves: 2, uTint: 1, uBackground: [0.25, 0, 0.96], uInk: [1, 1, 1], uBand: [0.8, 0.96, 0.39], uSpeed: 1.5 } },
    { name: "Breathe", values: { uWaves: 0, uCut: 0.35, uStretch: 0.5, uBackground: [0.94, 0.22, 0.65], uInk: [1, 1, 1] } },
  ],
};

export const imagePixelStretch: ShaderEffect = {
  kind: "shader",
  id: "image-pixel-stretch",
  name: "Pixel stretch",
  description: "A picture kept whole up to a line, then dragged out from it in long flat bars of its own edge colours, the line ragged and drifting.",
  category: "image",
  video: "filter",
  tags: ["image", "stretch", "smear", "pixel", "bar", "glitch", "editorial", "recap", "story"],
  source: glsl(
    `// Pixel stretch: past a line, every row (or band of rows) repeats the pixel it had at the line.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uDirection;    // @control min=0 max=3 default=3 label="Direction (0 right, 1 left, 2 up, 3 down)"
uniform float uLine;       // @control min=0 max=1 default=0.5 label="Stretch from"
uniform float uTravel;     // @control min=0 max=0.5 default=0.12 label="Travel"
uniform float uSpeed;      // @control min=0 max=3 default=0.7 label="Speed"
uniform float uBands;      // @control min=0 max=80 default=22 step=1 label="Bands (0 smooth)"
uniform float uRagged;     // @control min=0 max=0.6 default=0.22 label="Ragged edge"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  bool upright = uDirection >= 2;
  bool back = uDirection == 1 || uDirection == 3;
  // along: the way the picture is dragged; across: the rows that are dragged.
  float along = upright ? uv.y : uv.x;
  float across = upright ? uv.x : uv.y;
  if (back) along = 1.0 - along;
  bool banded = uBands >= 1.0;
  float band = banded ? (floor(across * uBands) + 0.5) / uBands : across;
  float t = iTime * uSpeed;
  float ragged = banded ? hash12(vec2(floor(across * uBands), 7.0)) - 0.5 : 0.5 * sin(across * 9.0 + t * 0.7);
  float line = uLine + uTravel * sin(t + band * 2.5) + uRagged * ragged;
  if (along > line) {
    along = line;
    across = band;
  }
  if (back) along = 1.0 - along;
  fragColor = pictureRGBA(uImage, upright ? vec2(across, along) : vec2(along, across));
}`,
  ),
  presets: [
    { name: "Bars", values: {} },
    { name: "Clean pull", values: { uBands: 0, uRagged: 0, uTravel: 0.2 } },
    { name: "Sideways", values: { uDirection: 0, uBands: 40, uLine: 0.45, uRagged: 0.4 } },
    { name: "Liquid edge", values: { uBands: 0, uRagged: 0.3, uDirection: 2, uLine: 0.55 } },
  ],
};

export const imagePhotocopy: ShaderEffect = {
  kind: "shader",
  id: "image-photocopy",
  name: "Photocopy",
  description: "A picture run through a tired photocopier: hard black toner on off-white paper, clumped grain, pale streaks down the page, burnt edges and a slight shift with every copy, like a zine page.",
  category: "image",
  video: "filter",
  tags: ["image", "photocopy", "xerox", "zine", "toner", "grain", "monochrome", "collage", "editorial", "recap"],
  source: glsl(
    `// Photocopy: brightness cut to toner or paper, with the copier's grain, streaks, edge burn and copy-to-copy shift.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uInk;         // @control color default=#141414 label="Toner"
uniform vec3 uPaper;       // @control color default=#F2EFE6 label="Paper"
uniform float uThreshold;  // @control min=0 max=1 default=0.4 label="Threshold"
uniform float uHardness;   // @control min=1 max=12 default=6 label="Hardness"
uniform float uGrain;      // @control min=0 max=1 default=0.5 label="Toner grain"
uniform float uStreaks;    // @control min=0 max=1 default=0.3 label="Streaks"
uniform float uEdge;       // @control min=0 max=1 default=0.45 label="Edge burn"
uniform float uJitter;     // @control min=0 max=1 default=0.3 label="Copy shift"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // A new copy eight times a second: it lands a little off and a little skewed.
  float copy = uJitter > 0.0 || uGrain > 0.0 ? floor(iTime * 8.0) : 0.0;
  vec2 shift = (hash22(vec2(copy, 3.0)) - 0.5) * 0.006 * uJitter;
  float skew = (hash12(vec2(copy, 9.0)) - 0.5) * 0.012 * uJitter;
  vec4 pic = pictureRGBA(uImage, uv + shift + vec2((uv.y - 0.5) * skew, 0.0));
  float l = dot(pic.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Toner grain: fine speckle and coarser clumps.
  float speckle = hash12(floor(fragCoord / 2.0) + copy * 17.0) - 0.5;
  float clump = vnoise(fragCoord / 9.0 + copy * 3.1) - 0.5;
  l += uGrain * (0.3 * speckle + 0.3 * clump);
  // The drum leaves pale and dark streaks down the page.
  l += uStreaks * 0.5 * smoothstep(0.78, 0.97, vnoise(vec2(uv.x * 60.0, copy * 0.37)));
  l -= uStreaks * 0.3 * smoothstep(0.75, 0.98, vnoise(vec2(uv.x * 23.0 + 40.0, copy * 0.21)));
  // The lid never sits flat: the page's edges burn dark.
  vec2 margin = min(uv, 1.0 - uv);
  l -= uEdge * 0.9 * smoothstep(0.05, 0.0, min(margin.x, margin.y) + 0.03 * (vnoise(uv * 14.0) - 0.5));
  float w = 0.5 / uHardness;
  float toner = 1.0 - smoothstep(uThreshold - w, uThreshold + w, l);
  // Stray specks of toner.
  toner = max(toner, uGrain * step(0.9985, hash12(floor(fragCoord / 3.0) + copy * 5.0)));
  fragColor = vec4(mix(uPaper, uInk, toner), pic.a);
}`,
  ),
  presets: [
    { name: "Zine", values: {} },
    { name: "Clean copy", values: { uGrain: 0.15, uStreaks: 0, uEdge: 0, uJitter: 0, uHardness: 9 } },
    { name: "Pink flyer", values: { uPaper: [0.98, 0.55, 0.78], uInk: [0.1, 0.05, 0.2] } },
    { name: "Blueprint", values: { uInk: [0.1, 0.18, 0.6], uPaper: [0.93, 0.95, 0.98], uStreaks: 0.2 } },
    { name: "Tenth generation", values: { uHardness: 12, uGrain: 0.9, uStreaks: 0.8, uEdge: 0.8, uJitter: 0.6, uThreshold: 0.45 } },
  ],
};

export const transitionColorBlocks: ShaderEffect = {
  kind: "shader",
  id: "transition-color-blocks",
  name: "Colour blocks",
  description: "Bands of flat colour sweep across in staggered rows, covering one picture and uncovering the next behind them. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "image", "slideshow", "blocks", "band", "wipe", "flat", "bold", "recap", "story"],
  loop: 4,
  source: glsl(
    `// Colour blocks: a train of flat colour bands crosses the frame, row by row, the next picture following it.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
${FOUR_COLOURS}
uniform int uBands;        // @control min=1 max=4 default=4 label="Colour bands"
uniform float uWidth;      // @control min=0.1 max=1.5 default=0.7 label="Band train length"
uniform int uRows;         // @control min=1 max=12 default=5 label="Rows"
uniform float uStagger;    // @control min=0 max=1 default=0.45 label="Stagger"
uniform float uAngle;      // @control min=-180 max=180 default=0 label="Angle (°)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    FLAT_COLOUR,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float k = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  float aspect = iResolution.x / iResolution.y;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 perp = vec2(-dir.y, dir.x);
  float extent = abs(dir.x) * aspect + abs(dir.y);
  // s: 0–1 the way the bands travel; row: which row of the stagger this is.
  float s = dot(p, dir) / extent + 0.5;
  float row = floor((dot(p, perp) / (abs(perp.x) * aspect + abs(perp.y)) + 0.5) * float(uRows));
  float lag = uRows > 1 ? hash12(vec2(row, 4.0)) * uStagger : 0.0;
  // u: how far behind the train's leading edge this point is; the train is uWidth long.
  float u = k * (1.0 + uWidth + uStagger) - s - lag;
  float px = 1.5 / (iResolution.y * extent);
  float n = float(uBands);
  float b = clamp(u / uWidth, 0.0, 0.9999) * n;
  int i = int(floor(b));
  vec3 band = flatColour(i);
  if (i > 0) band = mix(flatColour(i - 1), band, smoothstep(0.0, px * n / uWidth, fract(b)));
  vec4 col = pictureRGBA(uFrom, uv);
  col = mix(col, vec4(band, 1.0), smoothstep(0.0, px, u));
  fragColor = mix(col, pictureRGBA(uTo, uv), smoothstep(uWidth - px, uWidth, u));
}`,
  ),
  presets: [
    { name: "Clash", values: {} },
    { name: "Single slab", values: { uBands: 1, uRows: 1, uWidth: 1, uColorA: [0.8, 0.96, 0.39] } },
    { name: "Blinds", values: { uRows: 10, uStagger: 1, uWidth: 0.4, uAngle: 90 } },
    { name: "Diagonal", values: { uAngle: 30, uRows: 1, uWidth: 1 } },
    { name: "Ink and paper", values: { uColorA: [0.07, 0.07, 0.07], uColorB: [0.96, 0.94, 0.88], uColorC: [0.07, 0.07, 0.07], uColorD: [0.96, 0.94, 0.88], uRows: 7 } },
  ],
};

/** The recap effects: flat, loud story graphics, each filed under its own category. */
export const recapShaders: ShaderEffect[] = [
  ribbonBands,
  concentricShapes,
  shapeTiles,
  steppedGradient,
  echoText,
  stretchText,
  imagePixelStretch,
  imagePhotocopy,
  transitionColorBlocks,
];
