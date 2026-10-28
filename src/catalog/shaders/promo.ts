import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Promo: the accents of a punchy product-update video. Comet ribbons orbiting
 * a title, a ring of ticks bursting out behind it and a glowing swoosh under
 * its subtitle are transparent overlays, to lay over a title; a slanted wipe
 * knocks a picture's background out to a transparency checkerboard, and a
 * before-and-after divider compares a picture with its cut-out. Each is
 * tagged "promo", so the family is easy to find together.
 *
 * Sizes are in thousandths of the frame's height, so they look the same at
 * any resolution.
 */

/** A background under the overlays, clear by default. */
const BACKGROUND_CONTROLS = `
uniform vec3 uBackground;       // @control color default=#FFF4D2 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `knockout(tex, uv, fragCoord)`: a cut-out (its transparency kept) over a
 * transparency checkerboard, or over the backdrop with `uChecker` off. The
 * board takes the backdrop's opacity, so with it clear the cut-out keeps its
 * transparency. Needs {@link PICTURE} and the `uChecker` and `uCheckerSize`
 * controls.
 */
const KNOCKOUT = `
vec4 knockout(sampler2D tex, vec2 uv, vec2 fragCoord) {
  // Read as premultiplied, its colour clamped to its alpha (see overBackdrop); with no image, nothing is left.
  vec4 s = textureSize(tex, 0).x > 1 ? texture(tex, fitCoverUV(tex, uv)) : vec4(0.0);
  s.rgb = min(s.rgb, vec3(s.a));
  if (!uChecker) return overBackdrop(s);
  vec2 cell = floor(fragCoord / max(uCheckerSize * 0.001 * iResolution.y, 2.0));
  vec3 board = mix(vec3(1.0), vec3(0.85), mod(cell.x + cell.y, 2.0));
  float a = s.a + uBackdropAlpha * (1.0 - s.a);
  return vec4((s.rgb + board * uBackdropAlpha * (1.0 - s.a)) / max(a, 1e-4), a);
}`.trim();

const CHECKER_CONTROLS = `
uniform bool uChecker;      // @control default=true label="Checkerboard"
uniform float uCheckerSize; // @control min=8 max=80 default=26 label="Checker size"`.trim();

export const orbitSwoosh: ShaderEffect = {
  kind: "shader",
  id: "orbit-swoosh",
  name: "Orbit swoosh",
  description:
    "Glowing comet ribbons circling a title on tilted orbits, dimming and slipping behind it on the far side, shedding flecks of confetti that drift out and fade; a transparent overlay.",
  category: "light",
  transparent: true,
  tags: ["overlay", "promo", "title", "swoosh", "orbit", "comet", "confetti", "logo", "accent"],
  source: glsl(
    `// Orbit swoosh: comet ribbons on tilted ellipses round the centre. Each ribbon's far half (the top of its
// ellipse) is dimmer and hidden inside a gap the size of the title, so it seems to pass behind it.
uniform vec3 uColorA;          // @control color default=#FFC23D label="Ribbon 1"
uniform vec3 uColorB;          // @control color default=#2FD9B8 label="Ribbon 2"
uniform vec3 uConfetti;        // @control color default=#FF6F9C label="Confetti colour"
uniform float uRibbons;        // @control min=1 max=3 default=2 step=1 label="Ribbons"
uniform float uSize;           // @control min=0.2 max=1.4 default=0.8 label="Orbit size"
uniform float uFlatten;        // @control min=0.1 max=1 default=0.32 label="Orbit depth"
uniform float uTilt;           // @control min=-45 max=45 default=-14 label="Tilt (°)"
uniform float uLength;         // @control min=0.1 max=0.9 default=0.42 label="Tail length (turns)"
uniform float uWidth;          // @control min=2 max=30 default=9 label="Width"
uniform float uGlow;           // @control min=0 max=2 default=1 label="Glow"
uniform float uGap;            // @control min=0 max=1 default=0.6 label="Gap behind title"
uniform float uConfettiAmount; // @control min=0 max=1 default=0.6 label="Confetti"
uniform float uSpeed;          // @control min=0 max=2 default=0.45 label="Speed (turns/s)"
${BACKGROUND_CONTROLS}`,
    HASH,
    OVER,
    `// Ribbon i's orbit: a little bigger, deeper and tilted another way than the one before, so they cross.
vec3 orbitOf(int i) {
  float fi = float(i);
  float tilt = radians(uTilt) + (i == 1 ? -0.45 : i == 2 ? 0.3 : 0.0);
  return vec3(0.5 * uSize * (1.0 + 0.08 * fi), min(uFlatten * (1.0 + 0.3 * fi), 1.0), tilt);
}

// A point on orbit o at angle a.
vec2 orbitPoint(vec3 o, float a) {
  vec2 q = vec2(cos(a), sin(a) * o.y) * o.x;
  float c = cos(o.z), s = sin(o.z);
  return vec2(c * q.x - s * q.y, s * q.x + c * q.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float w = uWidth * 0.001;
  int n = int(uRibbons + 0.5);
  // The title's gap: a wide ellipse round the centre that the far side of each orbit passes behind.
  float gapR = uGap * 0.5 * uSize;
  float inGap = 1.0 - smoothstep(0.85 * gapR, 1.1 * gapR, length(p * vec2(1.0, 1.8)));
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  for (int i = 0; i < 3; i++) {
    if (i >= n) break;
    vec3 o = orbitOf(i);
    vec3 c = i == 0 ? uColorA : i == 1 ? uColorB : mix(uColorA, uColorB, 0.5);
    vec3 hot = mix(c, vec3(1.0), 0.6);
    // Into the orbit's frame, then the ellipse's unit circle.
    float co = cos(o.z), so = sin(o.z);
    vec2 q = vec2(co * p.x + so * p.y, -so * p.x + co * p.y);
    vec2 e = q / vec2(o.x, o.x * o.y);
    float L = max(length(e), 1e-4);
    float phi = atan(e.y, e.x);
    // Distance to the ellipse, to first order (the radius error over its gradient).
    float d = abs(L - 1.0) / max(length(e / vec2(o.x, o.x * o.y)) / L, 1e-4);
    float head = 6.28318 * (iTime * uSpeed + float(i) / float(n));
    // How far behind the head this point is, in turns, and the tail's strength there.
    float behind = mod(head - phi, 6.28318) / 6.28318;
    float k = clamp(1.0 - behind / uLength, 0.0, 1.0);
    // The near half (below the orbit's middle) is in front; the far half dims and hides in the gap.
    float front = smoothstep(-0.25, 0.25, -sin(phi));
    float vis = front + (1.0 - front) * 0.55 * (1.0 - inGap);
    float hw = 0.5 * w * (0.2 + 0.8 * k);
    float core = (1.0 - smoothstep(hw, hw + 1.5 * px, d)) * step(0.001, k);
    float halo = exp(-d / (2.5 * w)) * k * k * uGlow;
    // Painted rather than added, so the ribbons show on a light ground as well as a dark one:
    // a tinted halo, then a core whitening towards the head.
    acc = over(acc, c, clamp(0.6 * vis * halo, 0.0, 1.0));
    acc = over(acc, mix(c, hot, k), clamp(vis * core * (0.35 + 0.65 * k), 0.0, 1.0));
    // The head: a hot point with a soft bloom.
    vec2 hp = orbitPoint(o, head);
    float hf = smoothstep(-0.25, 0.25, -sin(head));
    float hv = hf + (1.0 - hf) * 0.55 * (1.0 - smoothstep(0.85 * gapR, 1.1 * gapR, length(hp * vec2(1.0, 1.8))));
    float dh = length(p - hp);
    acc = over(acc, c, clamp(0.5 * hv * exp(-dh / (4.0 * w)) * uGlow, 0.0, 1.0));
    acc = over(acc, vec3(1.0), clamp(1.6 * hv * exp(-dh / (0.9 * w)), 0.0, 1.0));
  }
  // Confetti: flecks shed from the orbits, flung outward as they fall and spin, fading out.
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    vec2 seed = hash22(vec2(fi * 7.13, 1.7));
    if (seed.x > uConfettiAmount) continue;
    float life = iTime / (1.4 + seed.y) + seed.x * 5.0;
    float cycle = floor(life);
    float age = life - cycle;
    vec2 h = hash22(vec2(fi * 3.1 + cycle * 17.3, 9.2));
    vec2 born = orbitPoint(orbitOf(int(mod(fi, float(n)))), h.x * 6.28318);
    vec2 pos = born + (normalize(born + 1e-4) * 0.12 + (h - 0.5) * 0.1) * age - vec2(0.0, 0.07 * age * age);
    float spin = h.y * 6.28318 + age * (4.0 + 6.0 * h.x);
    vec2 r = p - pos;
    r = vec2(cos(spin) * r.x - sin(spin) * r.y, sin(spin) * r.x + cos(spin) * r.y);
    vec2 size = vec2(0.006, 0.0022) * (0.7 + 0.6 * h.x) * (0.5 + 0.5 * uSize);
    vec2 bd = abs(r) - size;
    float box = length(max(bd, 0.0)) + min(max(bd.x, bd.y), 0.0);
    float fade = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.55, 1.0, age));
    float a = clamp(0.5 - box / px, 0.0, 1.0) * fade;
    vec3 fc = h.y < 0.5 ? uConfetti : h.y < 0.75 ? uColorA : uColorB;
    acc = over(acc, fc, a);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Cream", values: { uBackgroundAlpha: 1 } },
    { name: "Night", values: { uBackground: [0.04, 0.03, 0.08], uBackgroundAlpha: 1, uColorA: [1, 0.5, 0.85], uColorB: [0.35, 0.75, 1] } },
    { name: "Gold rush", values: { uColorA: [1, 0.8, 0.3], uColorB: [1, 0.55, 0.15], uConfetti: [1, 0.95, 0.7], uRibbons: 3 } },
    { name: "Single", values: { uRibbons: 1, uLength: 0.6, uConfettiAmount: 0.3 } },
  ],
};

export const tickRingBurst: ShaderEffect = {
  kind: "shader",
  id: "tick-ring-burst",
  name: "Tick ring burst",
  description:
    "A sunburst arc of short rounded ticks popping out one after another from its middle behind a title, holding, then flying outward and fading; a transparent overlay.",
  category: "light",
  transparent: true,
  tags: ["overlay", "promo", "title", "sunburst", "ring", "logo", "accent", "burst"],
  source: glsl(
    `// Tick ring burst: the nearest tick round the arc, as a capsule along its spoke. Ticks pop out from the
// arc's middle to its ends, hold, then fly outward and fade.
uniform vec3 uColor;   // @control color default=#F0507A label="Ticks"
uniform vec3 uColorB;  // @control color default=#FFB0C2 label="Ends"
uniform float uCount;  // @control min=8 max=96 default=44 step=1 label="Ticks round a full circle"
uniform float uArc;    // @control min=0.05 max=1 default=0.45 label="Arc (share of circle)"
uniform float uAngle;  // @control min=-180 max=180 default=90 label="Arc centre (°)"
uniform float uRadius; // @control min=0.05 max=0.48 default=0.3 label="Radius"
uniform float uLength; // @control min=0.01 max=0.2 default=0.06 label="Tick length"
uniform float uWidth;  // @control min=2 max=40 default=12 label="Tick width"
uniform bool uAnimate; // @control default=true label="Animate"
uniform float uCycle;  // @control min=1 max=8 default=3 label="Cycle (s)"
${BACKGROUND_CONTROLS}`,
    OVER,
    `// A back-out ease: past 1 and back, for the pop.
float backOut(float x) {
  float c = 1.9;
  x -= 1.0;
  return 1.0 + (c + 1.0) * x * x * x + c * x * x;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float count = floor(uCount);
  float spacing = 6.28318 / count;
  float centre = radians(uAngle);
  // The nearest tick, counted from the arc's middle.
  float a = mod(atan(p.y, p.x) - centre + 3.14159, 6.28318) - 3.14159;
  float k = floor(a / spacing + 0.5);
  float side = 0.5 * uArc * count;
  float order = abs(k) / max(side, 1.0);
  // Its pop (staggered out from the middle) and its exit.
  float t = uAnimate ? fract(iTime / uCycle) : 0.5;
  float grow = uAnimate ? backOut(clamp((t - 0.3 * order) / 0.15, 0.0, 1.0)) : 1.0;
  float gone = uAnimate ? smoothstep(0.72 + 0.1 * order, 0.9 + 0.08 * order, t) : 0.0;
  // Long and short in turn, thinning towards the ends.
  float len = uLength * (mod(abs(k), 2.0) < 0.5 ? 1.0 : 0.6) * grow * (1.0 - gone);
  float r0 = uRadius + gone * 1.5 * uLength;
  float hw = 0.0005 * uWidth * (1.0 - 0.35 * order) * clamp(grow * 3.0, 0.0, 1.0);
  float ang = centre + k * spacing;
  vec2 dir = vec2(cos(ang), sin(ang));
  float along = dot(p, dir);
  float across = dot(p, vec2(-dir.y, dir.x));
  float d = length(vec2(along - clamp(along, r0, r0 + max(len, 0.0)), across)) - hw;
  float cover = clamp(0.5 - d / px, 0.0, 1.0) * step(abs(k), side) * step(0.001, grow) * (1.0 - gone);
  vec3 col = mix(uColor, uColorB, order * order);
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  acc = over(acc, col, cover);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Cream", values: { uBackgroundAlpha: 1 } },
    { name: "Full ring", values: { uArc: 1, uCount: 60, uLength: 0.045, uColorB: [0.94, 0.31, 0.48] } },
    { name: "Gold", values: { uColor: [1, 0.72, 0.15], uColorB: [1, 0.92, 0.6], uBackground: [0.08, 0.06, 0.1], uBackgroundAlpha: 1 } },
    { name: "Fan below", values: { uAngle: -90, uArc: 0.3, uRadius: 0.36 } },
  ],
};

export const swooshUnderline: ShaderEffect = {
  kind: "shader",
  id: "swoosh-underline",
  name: "Swoosh underline",
  description:
    "A glowing curved stroke sweeping on under a subtitle with a bright head and a thinner second stroke chasing it, then wiping away from its tail; a transparent overlay.",
  category: "light",
  transparent: true,
  tags: ["overlay", "promo", "underline", "swoosh", "title", "accent", "neon"],
  source: glsl(
    `// Swoosh underline: a tapered curve (a parabola with a rise) drawn on from the left, its head a bright point,
// then wiped away from its tail. Distance to the curve is to first order (the height error over the slope).
uniform vec3 uColor;   // @control color default=#2FD9C4 label="Glow"
uniform vec3 uCore;    // @control color default=#FFFFFF label="Core"
uniform float uSpan;   // @control min=0.2 max=1 default=0.8 label="Width (share of frame)"
uniform float uY;      // @control min=-0.45 max=0.45 default=-0.1 label="Height"
uniform float uCurve;  // @control min=-0.3 max=0.3 default=0.06 label="Curve"
uniform float uRise;   // @control min=-0.3 max=0.3 default=0.05 label="Rise"
uniform float uWidth;  // @control min=2 max=40 default=11 label="Thickness"
uniform float uGlow;   // @control min=0 max=2 default=1 label="Glow"
uniform bool uSecond;  // @control default=true label="Second stroke"
uniform bool uAnimate; // @control default=true label="Animate"
uniform float uCycle;  // @control min=1 max=8 default=2.5 label="Cycle (s)"
${BACKGROUND_CONTROLS}`,
    OVER,
    `float easeOut(float x) { return 1.0 - pow(1.0 - clamp(x, 0.0, 1.0), 3.0); }
float easeInOut(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// One stroke at p, as (halo, core) coverage: offset down by drop, its thickness scaled, drawn from tail to head
// (shares of its length).
vec2 stroke(vec2 p, float drop, float scale, float tail, float head) {
  float W = uSpan * iResolution.x / iResolution.y;
  float uRaw = (p.x + 0.5 * W) / W;
  float u = clamp(uRaw, 0.0, 1.0);
  float y = uY - drop + uCurve * (4.0 * (u - 0.5) * (u - 0.5) - 1.0) + 2.0 * uRise * (u - 0.5);
  float slope = (8.0 * uCurve * (u - 0.5) + 2.0 * uRise) / W;
  float dy = abs(p.y - y) / sqrt(1.0 + slope * slope);
  float d = length(vec2((uRaw - u) * W, dy));
  float shown = smoothstep(tail, tail + 0.01, u) * (1.0 - smoothstep(head - 0.004, head, u)) * step(0.001, head - tail);
  // Tapered at both ends and towards the head, as a brush stroke is.
  float hw = 0.0005 * uWidth * scale * pow(sin(3.14159 * u), 0.5) * (0.45 + 0.55 * smoothstep(head, head - 0.2, u));
  float px = 1.0 / iResolution.y;
  float core = (1.0 - smoothstep(hw, hw + 1.5 * px, d)) * shown;
  float halo = exp(-d / (0.003 * uWidth * scale)) * shown * uGlow;
  // The head, while it is still drawing.
  if (head > 0.0 && head < 1.0) {
    float yh = uY - drop + uCurve * (4.0 * (head - 0.5) * (head - 0.5) - 1.0) + 2.0 * uRise * (head - 0.5);
    float dh = length(p - vec2(head * W - 0.5 * W, yh));
    float lit = smoothstep(0.0, 0.05, head);
    core = max(core, 1.6 * exp(-dh / (0.0012 * uWidth * scale)) * lit);
    halo += exp(-dh / (0.005 * uWidth * scale)) * uGlow * lit;
  }
  return vec2(halo, core);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = fract(iTime / uCycle);
  float head = uAnimate ? easeOut(t / 0.4) : 1.0;
  float tail = uAnimate ? easeInOut((t - 0.6) / 0.3) : 0.0;
  vec2 s = stroke(p, 0.0, 1.0, tail, head);
  if (uSecond) {
    // A thinner stroke under it, starting a beat later and finishing short.
    float head2 = uAnimate ? 0.92 * easeOut((t - 0.06) / 0.4) : 0.92;
    float tail2 = uAnimate ? max(0.12, 0.92 * easeInOut((t - 0.62) / 0.3)) : 0.12;
    s = max(s, 0.8 * stroke(p, 0.0026 * uWidth, 0.45, tail2, head2));
  }
  // Painted rather than added, so it shows on a light ground as well as a dark one: a tinted halo, then the core.
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  acc = over(acc, uColor, clamp(0.7 * s.x, 0.0, 1.0));
  acc = over(acc, uCore, clamp(s.y, 0.0, 1.0));
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Cream", values: { uBackgroundAlpha: 1 } },
    { name: "Hot pink", values: { uColor: [1, 0.35, 0.6], uCore: [1, 0.9, 0.95] } },
    { name: "Gold", values: { uColor: [1, 0.7, 0.2], uCore: [1, 0.96, 0.8], uBackground: [0.06, 0.05, 0.08], uBackgroundAlpha: 1 } },
    { name: "Straight", values: { uCurve: 0, uRise: 0, uSecond: false } },
  ],
};

export const knockoutWipe: ShaderEffect = {
  kind: "shader",
  id: "knockout-wipe",
  name: "Knockout wipe",
  description:
    "A slanted cut with a bright edge sweeping across a picture, knocking its background out to a transparency checkerboard and leaving the cut-out standing, like a background-removal reveal. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "image", "promo", "background-removal", "cut-out", "checkerboard", "wipe", "reveal"],
  loop: 4,
  source: glsl(
    `// Knockout wipe: a straight cut across the frame at an angle, from beyond one corner to beyond the opposite
// one. Behind it the cut-out shows over a checkerboard (or the backdrop); ahead of it, the whole picture.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Picture"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.cutout} label="Cut-out"
uniform float uAngle;      // @control min=-180 max=180 default=-35 label="Direction (°)"
uniform vec3 uEdge;        // @control color default=#FFFFFF label="Edge"
uniform float uEdgeWidth;  // @control min=0 max=40 default=9 label="Edge width"
uniform float uGlow;       // @control min=0 max=1 default=0.5 label="Edge glow"
${CHECKER_CONTROLS}
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    KNOCKOUT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float p = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  vec2 dir = vec2(cos(radians(uAngle)), sin(radians(uAngle)));
  vec2 q = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 halfSize = 0.5 * iResolution.xy * px;
  // From just beyond the nearest corner to just beyond the farthest, edge and glow included.
  float ew = uEdgeWidth * 0.001;
  float reach = abs(dir.x) * halfSize.x + abs(dir.y) * halfSize.y + ew + 0.05 * uGlow;
  float s = dot(q, dir) - mix(-reach, reach, p);
  float cut = smoothstep(-px, px, s);
  vec4 col = mix(knockout(uTo, uv, fragCoord), pictureCoverRGBA(uFrom, uv), cut);
  float edge = (1.0 - smoothstep(0.5 * ew - px, 0.5 * ew + px, abs(s))) * step(0.0001, ew);
  float halo = exp(-abs(s) / (0.004 + 2.0 * ew)) * uGlow * step(0.0001, ew) * 0.6;
  float light = clamp(edge + halo, 0.0, 1.0);
  fragColor = vec4(mix(col.rgb, uEdge, light), max(col.a, light));
}`,
  ),
  presets: [
    { name: "Top down", values: { uAngle: -90 } },
    { name: "Left to right", values: { uAngle: 0, uEdgeWidth: 5 } },
    { name: "On white", values: { uChecker: false } },
    { name: "Transparent", values: { uBackdropAlpha: 0 } },
  ],
};

export const beforeAfter: ShaderEffect = {
  kind: "shader",
  id: "before-after",
  name: "Before and after",
  description:
    "Two pictures compared either side of a divider with a round handle that follows the pointer while it hovers and sweeps back and forth when idle; a cut-out shows over a transparency checkerboard.",
  category: "interaction",
  video: "interactive",
  tags: ["interactive", "hover", "image", "promo", "compare", "before-after", "slider", "background-removal", "checkerboard"],
  source: glsl(
    `// Before and after: the first picture left of the divider, the second right of it (a cut-out over a
// checkerboard). The divider sits where the pointer is while it hovers, and drifts back to the idle split.
uniform sampler2D uBefore; // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Before"
uniform sampler2D uAfter;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.cutout} label="After"
uniform vec3 uLine;        // @control color default=#FFFFFF label="Divider"
uniform vec3 uHandle;      // @control color default=#F0507A label="Handle"
uniform float uLineWidth;  // @control min=0 max=20 default=4 label="Divider width"
uniform float uHandleSize; // @control min=0 max=0.2 default=0.065 label="Handle size"
uniform float uSplit;      // @control min=0 max=1 default=0.5 label="Split when idle"
uniform bool uDemo;        // @control default=true label="Sweep when idle"
${CHECKER_CONTROLS}
${BACKDROP_CONTROLS}`,
    PICTURE,
    KNOCKOUT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  float idle = uDemo ? 0.5 + 0.3 * sin(iTime * 0.8) : uSplit;
  float split = mix(idle * iResolution.x, iPointer.x, hover);
  float side = smoothstep(-0.75, 0.75, fragCoord.x - split);
  vec4 col = mix(pictureCoverRGBA(uBefore, uv), knockout(uAfter, uv, fragCoord), side);
  float lw = uLineWidth * 0.001 * iResolution.y;
  float dx = abs(fragCoord.x - split);
  // A soft shadow either side of the divider, then the divider.
  col.rgb *= 1.0 - 0.22 * exp(-dx / (3.0 * lw + 1.0)) * step(0.0001, lw);
  col = mix(col, vec4(uLine, 1.0), clamp(0.5 * lw + 0.5 - dx, 0.0, 1.0));
  // The handle: a round button ringed in the divider's colour, with arrows pointing both ways.
  float R = uHandleSize * iResolution.y;
  vec2 c = vec2(split, 0.5 * iResolution.y);
  vec2 off = fragCoord - c;
  float dist = length(off);
  float shadow = (1.0 - smoothstep(R, R + 0.6 * R, length(off + vec2(0.0, 0.12 * R)))) * 0.25 * step(0.5, R);
  col.rgb *= 1.0 - shadow;
  col = mix(col, vec4(uLine, 1.0), clamp(R + lw - dist + 0.5, 0.0, 1.0) * step(0.5, R));
  float disc = clamp(R - dist + 0.5, 0.0, 1.0) * step(0.5, R);
  col = mix(col, vec4(uHandle, 1.0), disc);
  vec2 l = off / max(R, 1.0);
  float ax = abs(l.x);
  float arrow = max(0.18 - ax, (abs(l.y) - 0.75 * (0.62 - ax)) * 0.8);
  col = mix(col, vec4(uLine, 1.0), clamp(0.5 - arrow * R, 0.0, 1.0) * disc);
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Still", values: { uDemo: false } },
    { name: "Minimal", values: { uHandleSize: 0, uLineWidth: 2 } },
    { name: "Dark divider", values: { uLine: [0.08, 0.08, 0.1], uHandle: [1, 0.85, 0.2] } },
    { name: "On white", values: { uChecker: false } },
  ],
};

/** The promo accents and image effects. */
export const promoShaders: ShaderEffect[] = [orbitSwoosh, tickRingBurst, swooshUnderline, knockoutWipe, beforeAfter];
