import { glsl } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Pixel blooms: rounded squares laid on a sunflower spiral (phyllotaxis).
 * Square n (1-based) sits at radius √n and angle n × the golden angle, so they
 * pack evenly at every radius; sizes, turns and timing then vary along the
 * spiral.
 */

/**
 * `phyllo(p, count, twist, maxSide, aa)`: the square covering point `p` (in
 * spacing units, the bloom's centre at the origin), as
 * `vec4(coverage, n, n's radius / the bloom's radius, signed distance)`.
 *
 * The including shader defines `squareSide(n, rn)` (the side, in spacing units;
 * 0 or less hides the square) and `squareTurn(n, angle)` (its rotation).
 * A square only reaches points within `maxSide` of its centre, so only
 * the squares whose radius is near the point's are checked, never all of them.
 */
const PHYLLOTAXIS = `
const float GOLDEN_ANGLE = 2.39996323;
float squareSide(float n, float rn);
float squareTurn(float n, float a);
vec4 phyllo(vec2 p, float count, float twist, float maxSide, float aa) {
  float r = length(p);
  // A square reaches at most half its diagonal from its centre, plus a little for the antialiasing.
  float reach = maxSide * 0.7072 + aa + 0.05;
  float lo = max(1.0, floor(max(r - reach, 0.0) * max(r - reach, 0.0)));
  float hi = min(count, ceil((r + reach) * (r + reach)));
  float root = sqrt(max(count, 1.0));
  float theta = atan(p.y, p.x);
  vec4 best = vec4(0.0, 0.0, 0.0, 1e3);
  for (int i = 0; i < 200; i++) {
    float n = lo + float(i);
    if (n > hi) break;
    float rn = sqrt(n);
    float a = n * GOLDEN_ANGLE + twist * rn;
    // Most squares in the band are round the other side: two points dt radians apart at radii
    // r and rn are at least (2 / pi) * min(r, rn) * dt apart, so those are skipped before any work.
    float dt = abs(mod(a - theta + 3.14159265, 6.2831853) - 3.14159265);
    if (0.63662 * min(r, rn) * dt > reach) continue;
    float side = squareSide(n, rn / root);
    if (side <= 0.0) continue;
    vec2 d = p - rn * vec2(cos(a), sin(a));
    float t = squareTurn(n, a);
    float c = cos(t), s = sin(t);
    d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    float h = side * 0.5;
    float round = h * 0.22;
    vec2 q = abs(d) - (h - round);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - round;
    float cover = clamp(0.5 - sd / aa, 0.0, 1.0);
    if (cover > best.x || (cover == best.x && sd < best.w)) best = vec4(cover, n, rn / root, sd);
  }
  return best;
}`.trim();

/** `ramp3(a, b, c, t)`: a three-stop colour ramp, the middle stop at 0.55. */
const RAMP3 = `
vec3 ramp3(vec3 a, vec3 b, vec3 c, float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.55 ? mix(a, b, t / 0.55) : mix(b, c, (t - 0.55) / 0.45);
}`.trim();

/** Shape controls shared by the two pixel blooms. */
const BLOOM_SHAPE = `
uniform int uCount;          // @control min=20 max=400 default=70 label="Squares"
uniform float uRadius;       // @control min=0.1 max=0.6 default=0.42 label="Radius"
uniform float uSize;         // @control min=0.4 max=2 default=1.6 label="Square size"
uniform float uDissolve;     // @control min=0 max=1 default=0.9 label="Dissolve toward the edge"
uniform float uTwist;        // @control min=-1 max=1 default=0 label="Twist"
uniform bool uUpright;       // @control default=false label="Keep squares upright"
uniform vec3 uInner;         // @control color default=#E10A6B label="Centre colour"
uniform vec3 uMiddle;        // @control color default=#842688 label="Middle colour"
uniform vec3 uOuter;         // @control color default=#2D37A0 label="Edge colour"
uniform bool uDiagonal;      // @control default=false label="Colour across (not outward)"
uniform float uGlow;         // @control min=0 max=1 default=0.25 label="Glow"`.trim();

/** The colour, coverage and glow of a bloom square, straight colour and alpha. */
const BLOOM_PAINT = `
vec4 paintBloom(vec4 hit, vec2 p, float bloomR) {
  float t = uDiagonal ? clamp(0.5 + dot(p / bloomR, vec2(0.5, -0.5)), 0.0, 1.0) : hit.z;
  vec3 col = ramp3(uInner, uMiddle, uOuter, t);
  // A soft glow just outside each square, in the square's own colour.
  float glowA = uGlow * 0.55 * exp(-max(hit.w, 0.0) / 0.35) * step(0.5, hit.y);
  float alpha = max(hit.x, glowA);
  return vec4(col, alpha);
}`.trim();

export const pixelBloom: ShaderEffect = {
  kind: "shader",
  id: "pixel-bloom",
  name: "Pixel bloom",
  description:
    "Rounded squares on a sunflower spiral, big at the bright centre and shrinking to pixel dust toward the edge, turning slowly while a shimmer ripples outward. On a clear background, for logos, headers and loaders.",
  category: "pattern",
  tags: ["pixel", "phyllotaxis", "sunflower", "spiral", "logo", "brand", "squares", "dissolve", "generative", "overlay"],
  transparent: true,
  loop: 24,
  source: glsl(
    `// Pixel bloom: squares on a sunflower spiral, shrinking outward, turning and shimmering.
${BLOOM_SHAPE}
uniform int uSpin;           // @control min=-2 max=2 default=1 label="Turns per loop (24 s)"
uniform int uWaves;          // @control min=0 max=16 default=8 label="Shimmer waves per loop"
uniform float uShimmer;      // @control min=0 max=1 default=0.35 label="Shimmer"`,
    PHYLLOTAXIS,
    RAMP3,
    BLOOM_PAINT,
    `float shimmerAt(float rn) {
  float wave = 0.5 + 0.5 * sin(6.28318 * (float(uWaves) * iTime / 24.0 - rn));
  return 1.0 - uShimmer * 0.3 * wave;
}

float squareSide(float n, float rn) {
  return uSize * max(1.0 - uDissolve * 0.88 * rn, 0.0) * shimmerAt(rn);
}

float squareTurn(float n, float a) {
  return uUpright ? 0.0 : a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float spin = 6.28318 * float(uSpin) * iTime / 24.0;
  float cs = cos(spin), sn = sin(spin);
  p = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y);
  float count = float(uCount);
  float spacing = uRadius / sqrt(count);
  vec2 q = p / spacing;
  vec4 hit = phyllo(q, count, uTwist * 0.6, uSize, 1.2 / (iResolution.y * spacing));
  vec4 c = paintBloom(hit, q, sqrt(count));
  // The shimmer dims a square a little as it passes.
  c.a *= shimmerAt(hit.z);
  fragColor = c;
}`,
  ),
  presets: [
    { name: "Upright pixels", values: { uUpright: true, uCount: 40, uDissolve: 0.6, uSize: 1.3 } },
    { name: "Galaxy", values: { uTwist: 0.7, uCount: 160, uSize: 1.4, uSpin: 2, uGlow: 0.5 } },
    { name: "Sunflower", values: { uCount: 220, uDissolve: 0, uSize: 1.1, uInner: [1, 0.82, 0.25], uMiddle: [1, 0.55, 0.15], uOuter: [0.75, 0.28, 0.1], uShimmer: 0.2 } },
    { name: "Mint", values: { uInner: [0.4, 1, 0.82], uMiddle: [0.18, 0.72, 0.85], uOuter: [0.2, 0.36, 0.9], uDiagonal: true } },
  ],
};

export const pixelBloomReveal: ShaderEffect = {
  kind: "shader",
  id: "pixel-bloom-reveal",
  name: "Pixel bloom reveal",
  description:
    "A logo-sting loop: squares pop out from the centre along a sunflower spiral, the bloom holds and shimmers, then it spins away into pixel dust from the edge in. On a clear background; works as a loader.",
  category: "loader",
  tags: ["pixel", "phyllotaxis", "sunflower", "logo", "reveal", "sting", "intro", "loader", "dissolve", "overlay"],
  transparent: true,
  loop: 5,
  source: glsl(
    `// Pixel bloom reveal: squares pop in centre-first, hold, then spin away to dust edge-first.
${BLOOM_SHAPE}
uniform float uLoop;         // @control min=2 max=12 default=5 label="Seconds per loop"
uniform float uHold;         // @control min=0 max=0.6 default=0.3 label="Hold"
uniform float uPop;          // @control min=0 max=1 default=0.6 label="Overshoot"`,
    PHYLLOTAXIS,
    RAMP3,
    BLOOM_PAINT,
    `float phase() {
  return fract(iTime / uLoop);
}

// How far square n is through its entrance (0 → 1) and its exit (0 → 1).
vec2 squareState(float rn) {
  float u = phase();
  float build = (1.0 - uHold) * 0.55;
  float leave = (1.0 - uHold) * 0.45;
  float inK = clamp((u - rn * build * 0.65) / (build * 0.35), 0.0, 1.0);
  float outStart = build + uHold;
  float outK = clamp((u - outStart - (1.0 - rn) * leave * 0.6) / (leave * 0.4), 0.0, 1.0);
  return vec2(inK, outK);
}

float squareSide(float n, float rn) {
  vec2 st = squareState(rn);
  // In: an overshooting pop. Out: shrink to nothing.
  float pop = 1.0 + uPop * 0.6 * sin(3.14159 * st.x) * (1.0 - st.x * 0.4);
  float grow = st.x < 1.0 ? smoothstep(0.0, 1.0, st.x) * pop : 1.0;
  float shrink = 1.0 - smoothstep(0.0, 1.0, st.y);
  return uSize * max(1.0 - uDissolve * 0.88 * rn, 0.0) * grow * shrink;
}

float squareTurn(float n, float a) {
  vec2 st = squareState(sqrt(n) / sqrt(float(uCount)));
  // Each square turns a quarter as it arrives and another as it leaves.
  float spin = (1.0 - st.x) * -1.5708 + st.y * 1.5708;
  return (uUpright ? 0.0 : a) + spin;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float count = float(uCount);
  float spacing = uRadius / sqrt(count);
  vec2 q = p / spacing;
  // The pop can briefly make a square larger than its resting size.
  vec4 hit = phyllo(q, count, uTwist * 0.6, uSize * (1.0 + uPop * 0.6), 1.2 / (iResolution.y * spacing));
  fragColor = paintBloom(hit, q, sqrt(count));
}`,
  ),
  presets: [
    { name: "Quick loader", values: { uLoop: 2.5, uHold: 0.1, uCount: 40 } },
    { name: "Upright", values: { uUpright: true, uPop: 0.3 } },
    { name: "Galaxy sting", values: { uTwist: 0.7, uCount: 140, uSize: 1.4, uGlow: 0.5, uLoop: 6 } },
  ],
};

export const transitionPixelBloom: ShaderEffect = {
  kind: "shader",
  id: "transition-pixel-bloom",
  name: "Pixel bloom transition",
  description:
    "Squares on a sunflower spiral grow out from the centre, each carrying the next picture, until they cover the frame; a glow rides the growing edge. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "pixel", "phyllotaxis", "sunflower", "spiral", "image", "slideshow", "logo"],
  loop: 4,
  source: glsl(
    `// Pixel bloom transition: spiral squares grow centre-first, each showing the next picture.
uniform sampler2D uFrom;     // @control wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;       // @control wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;       // @control default=true label="Animate"
uniform float uProgress;     // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uCell;         // @control min=64 max=200 default=72 step=1 label="Square spacing (px)"
uniform float uSpread;       // @control min=0.1 max=0.9 default=0.55 label="Spread"
uniform float uTwist;        // @control min=-1 max=1 default=0.3 label="Twist"
uniform bool uUpright;       // @control default=false label="Keep squares upright"
uniform vec3 uEdge;          // @control color default=#F05AB4 label="Edge glow"
uniform float uEdgeGlow;     // @control min=0 max=1 default=0.5 label="Edge glow strength"
${BACKDROP_CONTROLS}`,
    PICTURE,
    PHYLLOTAXIS,
    `// Set once per pixel in mainImage, read by the per-square functions.
float gProgress;
float gRoot;

// Enough squares to reach the frame's corners.
float squareCount() {
  float reach = 0.5 * length(iResolution.xy) / uCell + 2.0;
  return ceil(reach * reach);
}

// How grown square n is, 0 → 1, as the wave passes it centre-first.
float grownAt(float rn) {
  float w = uSpread;
  return clamp((gProgress * (1.0 + w) - rn) / w, 0.0, 1.0);
}

float squareSide(float n, float rn) {
  float k = grownAt(rn);
  // Grown squares overlap, so together they cover the whole frame.
  return 2.3 * smoothstep(0.0, 1.0, k);
}

float squareTurn(float n, float a) {
  return (uUpright ? 0.0 : a) + (1.0 - grownAt(sqrt(n) / gRoot)) * 1.5708;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  gProgress = uAnimate ? smoothstep(0.05, 0.95, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  vec2 uv = fragCoord / iResolution.xy;
  // Before the first square grows and once every square has, the frame is one picture.
  if (gProgress <= 0.0) { fragColor = pictureRGBA(uFrom, uv); return; }
  if (gProgress >= 1.0) { fragColor = pictureRGBA(uTo, uv); return; }
  vec2 q = (fragCoord - 0.5 * iResolution.xy) / uCell;
  float count = squareCount();
  gRoot = sqrt(count);
  vec4 hit = phyllo(q, count, uTwist * 0.4, 2.3, 1.2 / uCell);
  vec4 from = pictureRGBA(uFrom, uv);
  vec4 to = pictureRGBA(uTo, uv);
  vec4 c = mix(from, to, hit.x);
  // The glow on squares still growing, strongest mid-growth, fading once they settle.
  float k = grownAt(hit.z);
  float edge = uEdgeGlow * hit.x * 4.0 * k * (1.0 - k) * exp(-max(-hit.w, 0.0) / 0.25);
  c.rgb = mix(c.rgb, uEdge, clamp(edge, 0.0, 1.0));
  fragColor = c;
}`,
  ),
  presets: [
    { name: "Fine", values: { uCell: 64, uSpread: 0.7 } },
    { name: "Bold blocks", values: { uCell: 140, uSpread: 0.35, uTwist: 0, uEdgeGlow: 0.2 } },
    { name: "Upright pixels", values: { uUpright: true, uTwist: 0, uEdge: [0.4, 0.85, 1] } },
  ],
};

/** Phyllotaxis pixel blooms: squares on a sunflower spiral, as a pattern, a reveal loop and a transition. */
export const phyllotaxisShaders: ShaderEffect[] = [pixelBloom, pixelBloomReveal, transitionPixelBloom];
