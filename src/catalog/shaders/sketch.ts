import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { INK_EDGE } from "./comic.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Artist's media: a picture redrawn in pencil, watercolour, pen and ink or
 * charcoal, or drawn and coloured in before your eyes. Marks are made in
 * pixels against paper fixed to the frame, so they hold still over video.
 * Outlines use the comic shaders' Sobel edge finder.
 */

/** `luma(c)`, and `streaks(p, a, len)`: value noise stretched `len` pixels along angle `a`, like graphite (needs NOISE, ROTATE). */
const MARKS = `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float streaks(vec2 p, float a, float len) {
  vec2 q = rot(a) * p;
  return vnoise(vec2(q.x / len, q.y));
}`.trim();

/** The line-boil controls the drawn looks share: off at 0, otherwise the drawing is redone this many times a second. */
const BOIL_CONTROL = `uniform float uBoil;       // @control min=0 max=12 default=0 label="Line boil (redraws per second)"`;

/** `boilSeed()`: an offset that jumps on each redraw (zero while boil is off). Needs HASH and the uBoil control. */
const BOIL = `
vec2 boilSeed() {
  return uBoil > 0.0 ? hash22(vec2(floor(iTime * uBoil), 7.1)) * 300.0 : vec2(0.0);
}`.trim();

export const imagePencilSketch: ShaderEffect = {
  kind: "shader",
  id: "image-pencil-sketch",
  name: "Pencil sketch",
  description: "A picture redrawn in pencil on paper: graphite outlines and streaky shading strokes that cross as it darkens, in grey or coloured pencil.",
  category: "image",
  video: "filter",
  tags: ["image", "sketch", "pencil", "drawing", "graphite", "hand-drawn", "artistic", "blueprint"],
  source: glsl(
    `// Pencil sketch: Sobel outlines plus up to three layers of streaky graphite, laid where the picture is darker.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uLine;       // @control min=0 max=4 default=1.2 label="Outline weight (px)"
uniform float uThreshold;  // @control min=0.05 max=1 default=0.25 label="Outline threshold"
uniform float uShading;    // @control min=0 max=1 default=0.75 label="Shading"
uniform float uStroke;     // @control min=2 max=40 default=14 label="Stroke length (px)"
uniform float uAngle;      // @control min=0 max=180 default=35 label="Stroke angle (°)"
uniform float uColour;     // @control min=0 max=1 default=0 label="Colour (coloured pencil)"
uniform vec3 uLead;        // @control color default=#2A2A30 label="Pencil"
uniform vec3 uPaper;       // @control color default=#F6F2E8 label="Paper"
uniform float uGrain;      // @control min=0 max=1 default=0.5 label="Paper grain"
${BOIL_CONTROL}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    ROTATE,
    PICTURE,
    INK_EDGE,
    MARKS,
    BOIL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fitCoverUV(uImage, fragCoord / iResolution.xy);
  vec2 px = 1.0 / iResolution.xy;
  vec2 seed = boilSeed();
  // Each redraw wobbles the lines a little, like a new drawing of the same picture.
  vec2 wobble = (vec2(vnoise(fragCoord / 40.0 + seed), vnoise(fragCoord / 40.0 + seed + 9.0)) - 0.5) * step(0.001, uBoil) * 2.0;
  vec2 st = uv + wobble * px;
  vec4 pic = pictureRGBA(uImage, st);
  float dark = 1.0 - luma(pic.rgb);
  // Outlines, pressed harder on strong edges and broken up a little along their length.
  float edge = uLine > 0.0 ? inkEdge(uImage, st, uLine * px) : 0.0;
  float line = smoothstep(uThreshold, uThreshold * 1.8 + 0.05, edge) * (0.7 + 0.3 * vnoise(fragCoord / 3.0 + seed));
  // Shading: three layers of strokes at crossing angles, each joining in a step darker than the last.
  vec2 p = fragCoord + seed;
  float a = radians(uAngle);
  float tone = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float s = smoothstep(0.25, 0.85, streaks(p + fi * 51.0, a + fi * 0.65, uStroke));
    float from = 0.2 + 0.22 * fi;
    float layer = smoothstep(from, from + 0.3, dark + (s - 0.5) * 0.3);
    tone = 1.0 - (1.0 - tone) * (1.0 - layer * s * 0.7);
  }
  tone = max(tone, dark * dark * 0.35);
  // Graphite catches on the paper's tooth, so the grain lightens every mark.
  float grain = 0.6 * vnoise(fragCoord * 0.7 + 3.0) + 0.4 * hash12(fragCoord);
  float ink = clamp(max(line, tone * uShading) * (1.0 - uGrain * 0.45 * grain), 0.0, 1.0);
  vec3 lead = mix(uLead, pic.rgb * 0.8, uColour);
  vec3 paper = uPaper * (1.0 - uGrain * 0.06 * grain);
  fragColor = vec4(mix(paper, lead, ink), pic.a);
}`,
  ),
  presets: [
    { name: "Coloured pencil", values: { uColour: 0.85, uShading: 0.9, uStroke: 10 } },
    { name: "Line drawing", values: { uShading: 0.15, uLine: 1.6, uThreshold: 0.2 } },
    { name: "Blueprint", values: { uLead: [0.93, 0.96, 1], uPaper: [0.11, 0.31, 0.57], uShading: 0.35, uGrain: 0.3, uAngle: 0 } },
    { name: "Animated", values: { uBoil: 6 } },
  ],
};

export const imageWatercolor: ShaderEffect = {
  kind: "shader",
  id: "image-watercolor",
  name: "Watercolour",
  description: "A picture painted in watercolour: soft washes in a few layers that bleed past their edges, pigment pooled dark where a wash dries and granulated in the paper's tooth, over a faint pencil underdrawing.",
  category: "image",
  video: "filter",
  tags: ["image", "watercolour", "watercolor", "painterly", "paint", "artistic", "wash"],
  source: glsl(
    `// Watercolour: a softened, layered wash, darkened where it ends, granulated by the paper, laid subtractively on paper.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uSoftness;      // @control min=0 max=12 default=4 label="Softness (px)"
uniform float uBleed;         // @control min=0 max=1 default=0.4 label="Bleed"
uniform float uWashes;        // @control min=2 max=12 default=6 step=1 label="Wash layers"
uniform float uEdges;         // @control min=0 max=2 default=1 label="Pooled edges"
uniform float uGranulation;   // @control min=0 max=1 default=0.5 label="Granulation"
uniform float uLines;         // @control min=0 max=1 default=0.35 label="Pencil underdrawing"
uniform vec3 uPaper;          // @control color default=#FBF8F1 label="Paper"
uniform float uFlow;          // @control min=0 max=1 default=0 label="Flow (wet drift)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    INK_EDGE,
    `float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// The picture softened over a ring of eight reads r apart, and the middle.
vec3 wash(vec2 uv, vec2 r) {
  vec3 sum = picture(uImage, uv) * 2.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.3;
    sum += picture(uImage, uv + vec2(cos(a), sin(a)) * r);
  }
  return sum / 10.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fitCoverUV(uImage, fragCoord / iResolution.xy);
  vec2 px = 1.0 / iResolution.xy;
  vec2 q = fragCoord / iResolution.y;
  float t = iTime * uFlow * 0.2;
  // Bleed: the wash is read through a slow, wet warp, so colour creeps past the edges.
  vec2 st = uv + (vec2(fbm(q * 4.0 + t, 4), fbm(q * 4.0 + 19.3 - t, 4)) - 0.5) * uBleed * 0.04;
  vec4 pic = pictureRGBA(uImage, st);
  vec3 soft = wash(st, uSoftness * px);
  vec3 wide = wash(st, (uSoftness * 2.5 + 3.0) * px);
  // Layers: brightness stepped a little, so the colour lies in flat washes.
  float l = max(luma(soft), 1e-3);
  float stepped = (floor(l * uWashes) + smoothstep(0.6, 1.0, fract(l * uWashes))) / uWashes;
  // Watercolour is transparent: the pigment is a little lighter than the picture, and the paper shows through.
  vec3 pigment = clamp(mix(mix(soft, soft * stepped / l, 0.6), vec3(1.0), 0.12), 0.03, 1.0);
  // Pigment pools where a wash dries, granulates in the paper's hollows and blooms unevenly.
  float tooth = fbm(fragCoord / 3.0, 3);
  float bloom = fbm(q * 6.0 - t, 3);
  float pool = clamp(length(soft - wide) * 4.0, 0.0, 1.0) * uEdges;
  float density = 0.7 + pool * 0.6 + uGranulation * (tooth - 0.5) * 0.9 + (bloom - 0.5) * 0.35;
  vec3 col = uPaper * pow(pigment, vec3(max(density, 0.2)));
  // The lightest washes are left as bare paper.
  col = mix(col, uPaper, smoothstep(0.86, 0.97, luma(soft)) * 0.8);
  float edge = uLines > 0.0 ? inkEdge(uImage, uv, px) : 0.0;
  col *= 1.0 - smoothstep(0.2, 0.55, edge) * uLines * 0.55;
  col *= 1.0 - 0.05 * (tooth - 0.5);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Loose wash", values: { uSoftness: 8, uBleed: 0.8, uWashes: 4, uLines: 0.15 } },
    { name: "Ink and wash", values: { uLines: 0.9, uEdges: 1.4, uWashes: 4, uGranulation: 0.3 } },
    { name: "Wet in wet", values: { uFlow: 0.6, uBleed: 1, uSoftness: 10, uEdges: 0.6, uLines: 0 } },
  ],
};

export const imageCrosshatch: ShaderEffect = {
  kind: "shader",
  id: "image-crosshatch",
  name: "Pen and ink",
  description: "A picture drawn with a pen: cross-hatched lines that build up as it darkens, stippled dots, or engraved lines that swell and bend with the forms, like a woodcut or banknote.",
  category: "image",
  video: "filter",
  tags: ["image", "ink", "pen", "crosshatch", "hatching", "stipple", "engraving", "woodcut", "linocut", "drawing", "artistic"],
  source: glsl(
    `// Pen and ink: the picture's darkness drawn as hatching, stippling or engraved lines, with Sobel outlines.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uStyle;        // @control min=0 max=2 default=0 label="Style (0 hatching, 1 stippling, 2 engraving)"
uniform float uSpacing;    // @control min=2 max=16 default=5 label="Spacing (px)"
uniform float uAngle;      // @control min=0 max=180 default=45 label="Angle (°)"
uniform float uContrast;   // @control min=0.5 max=3 default=1.2 label="Contrast"
uniform float uLine;       // @control min=0 max=4 default=1.2 label="Outline weight (px)"
uniform float uThreshold;  // @control min=0.05 max=1 default=0.3 label="Outline threshold"
uniform float uWobble;     // @control min=0 max=1 default=0.4 label="Hand wobble"
uniform vec3 uInk;         // @control color default=#15151A label="Ink"
uniform vec3 uPaper;       // @control color default=#FAF7EF label="Paper"
${BOIL_CONTROL}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    ROTATE,
    PICTURE,
    INK_EDGE,
    MARKS,
    BOIL,
    `float darkness(vec2 uv) {
  return clamp((0.5 - luma(picture(uImage, uv))) * uContrast + 0.5, 0.0, 1.0);
}

// Ink from parallel lines across direction a, spacing px apart and half-width px thick.
float lines(vec2 p, float a, float spacing, float halfWidth) {
  float f = abs(fract(dot(p, vec2(cos(a), sin(a))) / spacing) - 0.5) * spacing;
  return 1.0 - smoothstep(halfWidth - 0.6, halfWidth + 0.6, f);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fitCoverUV(uImage, fragCoord / iResolution.xy);
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 seed = boilSeed();
  // A hand's wobble: the paper position bent by slow noise before the marks are laid.
  vec2 p = fragCoord + (vec2(vnoise(fragCoord / 30.0 + seed), vnoise(fragCoord / 30.0 + seed + 13.0)) - 0.5) * uWobble * uSpacing;
  float a = radians(uAngle);
  float ink = 0.0;
  if (uStyle == 1) {
    // Stippling: two offset grids of jittered dots, each inked with a chance (and size) set by the darkness under it.
    for (int g = 0; g < 2; g++) {
      vec2 o = vec2(float(g) * 0.5) * uSpacing;
      vec2 cell = floor((p + o) / uSpacing);
      vec2 centre = (cell + 0.25 + 0.5 * hash22(cell + seed + float(g) * 7.0)) * uSpacing - o;
      float d = darkness((centre + fragCoord - p) * px);
      float chance = g == 0 ? smoothstep(0.06, 0.65, d) : (d - 0.5) * 2.0;
      float on = step(hash12(cell + seed + 11.0 + float(g) * 5.0), chance);
      float r = uSpacing * (0.16 + 0.24 * d);
      ink = max(ink, on * (1.0 - smoothstep(r - 0.6, r + 0.6, length(p - centre))));
    }
  } else if (uStyle == 2) {
    // Engraving: lines that swell with darkness and bend with the picture's broad light, crossed in the deepest shadow.
    float d = darkness(uv);
    float broad = 0.0;
    for (int i = 0; i < 4; i++) {
      float b = float(i) * 1.5708;
      broad += luma(picture(uImage, uv + vec2(cos(b), sin(b)) * 6.0 * px));
    }
    vec2 q = rot(-a) * p;
    float v = (q.y + (broad * 0.25 - 0.5) * uSpacing * 1.5) / uSpacing;
    float f = abs(fract(v) - 0.5) * 2.0;
    float aa = 1.2 / uSpacing;
    ink = (1.0 - smoothstep(d * 0.95 - aa, d * 0.95 + aa, f)) * smoothstep(0.03, 0.12, d);
    ink = max(ink, lines(p, a + 1.5708, uSpacing, uSpacing * 0.18) * smoothstep(0.75, 0.85, d));
  } else {
    // Hatching: four directions of lines, each joining in a step darker than the last.
    float d = darkness(uv);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float k = smoothstep(0.15 + 0.2 * fi, 0.25 + 0.2 * fi, d);
      float dir = a + (i == 1 ? 1.5708 : i == 2 ? -0.7854 : i == 3 ? 0.7854 : 0.0);
      ink = max(ink, k * lines(p + fi * 1.7, dir, uSpacing, 0.45 + 0.35 * k));
    }
  }
  float edge = uLine > 0.0 ? inkEdge(uImage, uv, uLine * px) : 0.0;
  ink = max(ink, smoothstep(uThreshold, uThreshold + 0.1, edge));
  vec3 paper = uPaper * (1.0 - 0.04 * hash12(fragCoord));
  fragColor = vec4(mix(paper, uInk, ink), pic.a);
}`,
  ),
  presets: [
    { name: "Stipple", values: { uStyle: 1, uSpacing: 4, uLine: 0.8 } },
    { name: "Banknote", values: { uStyle: 2, uSpacing: 4, uWobble: 0, uLine: 0.8, uInk: [0.12, 0.3, 0.23], uPaper: [0.93, 0.94, 0.88] } },
    { name: "Woodcut", values: { uStyle: 2, uSpacing: 9, uContrast: 2, uWobble: 0.7, uLine: 2.5, uThreshold: 0.4, uInk: [0.05, 0.05, 0.05], uPaper: [0.96, 0.93, 0.86] } },
    { name: "Sepia pen", values: { uInk: [0.3, 0.18, 0.1], uPaper: [0.96, 0.91, 0.8], uWobble: 0.6 } },
  ],
};

export const imageCharcoal: ShaderEffect = {
  kind: "shader",
  id: "image-charcoal",
  name: "Charcoal",
  description: "A picture drawn in smudgy, high-contrast charcoal: broad streaky strokes that catch on the paper's tooth and heavy dark edges, or in chalk on a blackboard, or in colour as waxy crayon or soft pastel.",
  category: "image",
  video: "filter",
  tags: ["image", "charcoal", "chalk", "chalkboard", "conte", "crayon", "pastel", "sketch", "drawing", "artistic"],
  source: glsl(
    `// Charcoal: a smudged, contrasty darkness (or lightness, or colour) drawn in broad streaks that fill the paper's hollows before its peaks.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uSmudge;     // @control min=0 max=10 default=3 label="Smudge (px)"
uniform float uContrast;   // @control min=0.5 max=3 default=1.6 label="Contrast"
uniform float uStroke;     // @control min=4 max=60 default=24 label="Stroke length (px)"
uniform float uAngle;      // @control min=0 max=180 default=60 label="Stroke angle (°)"
uniform float uTooth;      // @control min=0 max=1 default=0.6 label="Paper tooth"
uniform float uLine;       // @control min=0 max=5 default=2 label="Edge weight (px)"
uniform bool uInvert;      // @control default=false label="Draw the lights, not the darks"
uniform float uColour;     // @control min=0 max=1 default=0 label="Colour (crayon, pastel)"
uniform vec3 uInk;         // @control color default=#1A1817 label="Charcoal"
uniform vec3 uPaper;       // @control color default=#EDE8DD label="Paper"
${BOIL_CONTROL}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    PICTURE,
    INK_EDGE,
    MARKS,
    BOIL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fitCoverUV(uImage, fragCoord / iResolution.xy);
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 seed = boilSeed();
  // Smudged: the picture softened over a ring of reads, as if rubbed with a finger.
  vec3 sm = pic.rgb * 2.0;
  for (int i = 0; i < 8; i++) {
    float b = float(i) * 0.785398;
    sm += picture(uImage, uv + vec2(cos(b), sin(b)) * uSmudge * px);
  }
  sm /= 10.0;
  float l = luma(sm);
  // In colour the stick covers nearly everywhere (where it matches the paper that does not show), pressing harder where the picture differs.
  float tone = mix(uInvert ? l : 1.0 - l, clamp(0.55 + length(sm - uPaper), 0.0, 1.0), uColour);
  float d = clamp((tone - 0.5) * uContrast + 0.5, 0.0, 1.0);
  // Broad strokes: two streak layers a little apart in angle, a few pixels across.
  vec2 p = fragCoord + seed;
  float a = radians(uAngle);
  float s1 = streaks(p / 3.5, a, uStroke / 3.5);
  float s2 = streaks(p / 4.0 + 40.0, a + 0.3, uStroke / 4.0);
  float deposit = d * (0.8 + 0.4 * (s1 + s2 - 1.0));
  // The stick catches on the paper's tooth: hollows fill first, peaks last.
  float tooth = 0.7 * fbm(fragCoord / 2.0 + seed, 3) + 0.3 * hash12(fragCoord);
  float ink = smoothstep(0.0, 1.0, deposit + (0.5 - tooth) * uTooth * 0.7);
  // Heavy edges, pressed hard and dragged along the stroke.
  float edge = uLine > 0.0 ? inkEdge(uImage, uv, uLine * px) : 0.0;
  float line = smoothstep(0.15, 0.6, edge) * (0.6 + 0.4 * s1);
  // Coloured sticks are a little brighter in hue than the picture they copy.
  vec3 stick = mix(uInk, clamp(mix(vec3(l), sm, 1.25), 0.0, 1.0), uColour);
  vec3 paper = uPaper * (1.0 - 0.06 * tooth);
  vec3 col = mix(paper, stick, clamp(ink, 0.0, 1.0));
  // Edges in the stick's colour pressed darker, or charcoal when there is no colour.
  col = mix(col, mix(uInk, sm * 0.55, uColour), clamp(line, 0.0, 1.0));
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Chalkboard", values: { uInk: [0.95, 0.94, 0.9], uPaper: [0.17, 0.23, 0.2], uTooth: 0.8, uContrast: 1.3 } },
    { name: "Sanguine", values: { uInk: [0.6, 0.22, 0.14], uPaper: [0.95, 0.9, 0.8], uContrast: 1.3, uLine: 1.2 } },
    { name: "Heavy", values: { uContrast: 2.4, uSmudge: 6, uLine: 3, uTooth: 0.4 } },
    { name: "Crayon", values: { uColour: 1, uSmudge: 0, uTooth: 1, uStroke: 10, uContrast: 1.4, uLine: 1.5, uPaper: [0.98, 0.97, 0.94] } },
    { name: "Soft pastel", values: { uColour: 1, uSmudge: 5, uTooth: 0.7, uStroke: 30, uContrast: 1.3, uLine: 0.6, uPaper: [0.47, 0.45, 0.42] } },
    { name: "White on black", values: { uInvert: true, uInk: [0.96, 0.95, 0.92], uPaper: [0.08, 0.08, 0.09], uLine: 0 } },
  ],
};

export const sketchReveal: ShaderEffect = {
  kind: "shader",
  id: "sketch-reveal",
  name: "Sketch reveal",
  description: "A picture drawn before your eyes: pencil outlines sweep in stroke by stroke, shading follows, then colour washes in from a wet edge until the finished picture holds and fades back to paper.",
  category: "image",
  video: "filter",
  tags: ["image", "sketch", "pencil", "reveal", "intro", "drawing", "watercolour", "hand-drawn"],
  loop: 6,
  source: glsl(
    `// Sketch reveal: lines, then shading, then a wet colour wash spread across paper in a noisy drawing order.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.6 label="Progress (when still)"
uniform float uLine;       // @control min=0 max=4 default=1.3 label="Outline weight (px)"
uniform float uThreshold;  // @control min=0.05 max=1 default=0.25 label="Outline threshold"
uniform float uKeep;       // @control min=0 max=1 default=0.5 label="Lines kept under the colour"
uniform vec3 uLead;        // @control color default=#2B2A30 label="Pencil"
uniform vec3 uPaper;       // @control color default=#F7F3EA label="Paper"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    PICTURE,
    INK_EDGE,
    MARKS,
    `// How far a stage has got at a pixel whose turn comes at order: 0 before, 1 once drawn.
float drawn(float stage, float order) {
  return smoothstep(0.0, 0.06, stage * 1.12 - order);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fitCoverUV(uImage, fragCoord / iResolution.xy);
  vec2 px = 1.0 / iResolution.xy;
  vec2 q = fragCoord / iResolution.y;
  // Over a 6 s loop: drawn and coloured in the first 80%, held, then faded back to paper.
  float cycle = fract(iTime / 6.0);
  float t = uAnimate ? clamp(cycle / 0.8, 0.0, 1.0) : uProgress;
  float fade = uAnimate ? smoothstep(0.9, 1.0, cycle) : 0.0;
  vec4 pic = pictureRGBA(uImage, uv);
  // Drawing order: left to right and top to bottom, broken up by noise so it lands stroke by stroke.
  float order = clamp(0.55 * (uv.x * 0.7 + (1.0 - uv.y) * 0.3) + 0.45 * fbm(q * 3.0, 4), 0.0, 1.0);
  float lineIn = drawn(t / 0.4, order);
  float shadeIn = drawn((t - 0.25) / 0.35, order);
  float colourOrder = clamp(0.6 * uv.x + 0.4 * fbm(q * 2.5 + 11.0, 4), 0.0, 1.0);
  float gap = (t - 0.5) / 0.45 * 1.12 - colourOrder;
  float wet = smoothstep(0.0, 0.05, gap);
  float fringe = wet * smoothstep(0.12, 0.0, gap);
  float edge = uLine > 0.0 ? inkEdge(uImage, uv, uLine * px) : 0.0;
  float line = smoothstep(uThreshold, uThreshold * 1.8 + 0.05, edge) * (0.7 + 0.3 * vnoise(fragCoord / 3.0));
  float dark = 1.0 - luma(pic.rgb);
  float s = smoothstep(0.25, 0.85, streaks(fragCoord, 0.6, 14.0));
  float shade = smoothstep(0.3, 0.8, dark + (s - 0.5) * 0.3) * s * 0.35;
  vec3 col = mix(uPaper, uLead, shade * shadeIn);
  col = mix(col, pic.rgb, wet);
  // Pigment pools at the drying front of the wash.
  col *= 1.0 - 0.25 * fringe;
  col = mix(col, uLead, line * lineIn * mix(1.0, uKeep, wet));
  fragColor = vec4(mix(col, uPaper, fade), pic.a);
}`,
  ),
  presets: [
    { name: "Line art only", values: { uKeep: 1, uLine: 1.8 } },
    { name: "Clean finish", values: { uKeep: 0 } },
    { name: "Chalk on slate", values: { uLead: [0.95, 0.94, 0.9], uPaper: [0.17, 0.2, 0.22], uKeep: 0.3 } },
  ],
};

/** Artist's media: pencil, watercolour, pen and ink, charcoal and a sketch-to-colour reveal. */
export const sketchShaders: ShaderEffect[] = [imagePencilSketch, imageWatercolor, imageCrosshatch, imageCharcoal, sketchReveal];
