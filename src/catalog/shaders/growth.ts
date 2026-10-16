import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

/** `smin(a, b, k)`: a smooth minimum of two distances, blending over `k`. */
const SMIN = `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-5), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`.trim();

export const reactionDiffusion: ShaderEffect = {
  kind: "shader",
  id: "reaction-diffusion",
  name: "Reaction diffusion",
  description: "Turing patterns of spots and labyrinth stripes slowly morphing, like a Gray-Scott simulation or an animal's coat.",
  category: "organic",
  tags: ["organic", "background", "pattern", "turing", "biology", "animal print"],
  source: glsl(
    `// Reaction diffusion: a stateless fake of Gray-Scott: thresholded, domain-warped sine gratings.
uniform vec3 uBase;      // @control color default=#FFE8DC label="Base"
uniform vec3 uInk;       // @control color default=#E8505B label="Pattern"
uniform float uScale;    // @control min=2 max=30 default=11 label="Scale"
uniform float uPattern;  // @control min=0 max=1 default=0.6 label="Spots to stripes"
uniform float uRings;    // @control min=0 max=1 default=0 label="Rosettes"
uniform float uAlign;    // @control min=0 max=1 default=0 label="Stripe alignment"
uniform float uWarp;     // @control min=0 max=2 default=0.7 label="Warp"
uniform float uSpeed;    // @control min=0 max=1 default=0.15 label="Speed"
uniform float uRelief;   // @control min=0 max=1 default=0.5 label="Relief"`,
    HASH,
    NOISE,
    FBM,
    `// Seven gratings at golden-angle headings: their sum thresholded at 0 is a labyrinth, high up it is spots.
float turing(vec2 p, float t) {
  float s = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    // Headings spread over half a turn, narrowed towards one direction by uAlign for stripes.
    float a = (mod(fi * 2.39996 + 1.5708, 3.14159) - 1.5708) * (1.0 - 0.85 * uAlign) + 0.3 * sin(t * 0.37 + fi * 1.3);
    s += cos(dot(p, vec2(cos(a), sin(a))) * 6.28318 + fi * 1.7 + t * (0.3 + 0.07 * fi));
  }
  return s * 0.378;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  float t = iTime * uSpeed;
  vec2 w = vec2(fbm(uv * 1.7 + vec2(0.0, t * 0.2), 4), fbm(uv * 1.7 + vec2(5.2, 1.3 - t * 0.2), 4)) - 0.5;
  vec2 p = uv * uScale + w * uWarp * 4.0;
  float v = turing(p, t);
  // Regions drift between spots and stripes, as in a real simulation with uneven feed.
  float region = fbm(uv * 1.1 + vec2(9.0, t * 0.05), 3) - 0.5;
  float level = mix(1.05, 0.0, uPattern) + region * 0.7;
  float e = max(fwidth(v), 0.02);
  float m = smoothstep(level - e, level + e, v);
  float band = 0.38;
  float ring = m * (1.0 - smoothstep(level + band - e, level + band + e, v));
  float hole = smoothstep(level + band - e, level + band + e, v) * uRings;
  m = mix(m, ring, uRings);
  vec3 col = uBase * (0.94 + 0.06 * vnoise(fragCoord * 0.35));
  col = mix(col, uInk, m);
  // Rosettes are filled with a deeper shade of the base.
  col = mix(col, mix(uBase, uInk, 0.3) * 0.92, hole);
  // Relief: the pattern is a little raised, lit from the top left.
  vec2 g = vec2(dFdx(v), dFdy(v));
  float lit = dot(g / max(length(g), 1e-5), normalize(vec2(-1.0, 1.0)));
  float edge = smoothstep(level - 0.02, level + 0.02, v) * (1.0 - smoothstep(level, level + 0.3, v));
  col *= 1.0 + uRelief * 0.35 * edge * lit;
  col = mix(col, col * 0.82, uRelief * m * smoothstep(level, level + 1.2, v) * (1.0 - uRings));
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Coral", values: { uBase: [1, 0.91, 0.86], uInk: [0.91, 0.31, 0.36], uPattern: 0.62, uRings: 0, uScale: 11, uAlign: 0 } },
    { name: "Zebra", values: { uBase: [0.96, 0.95, 0.92], uInk: [0.07, 0.07, 0.08], uPattern: 1, uRings: 0, uScale: 7, uWarp: 0.5, uAlign: 0.65 } },
    {
      name: "Leopard spots",
      values: { uBase: [0.85, 0.62, 0.27], uInk: [0.16, 0.1, 0.05], uPattern: 0.45, uRings: 0.9, uScale: 7, uWarp: 0.9, uAlign: 0 },
    },
  ],
};

export const cellDivision: ShaderEffect = {
  kind: "shader",
  id: "cell-division",
  name: "Cell division",
  description: "Cells in a petri dish under the microscope, growing, pinching and splitting in two.",
  category: "organic",
  tags: ["organic", "biology", "science", "microscope", "mitosis", "loop"],
  loop: 8,
  source: glsl(
    `// Cell division: soft cells with nuclei going through mitosis on an 8 s loop, seen through a microscope.
uniform vec3 uMedium;    // @control color default=#E6EEEC label="Medium"
uniform vec3 uCell;      // @control color default=#A7D8C9 label="Cytoplasm"
uniform vec3 uMembrane;  // @control color default=#2F5D62 label="Membrane"
uniform vec3 uNucleus;   // @control color default=#6D3FC0 label="Nucleus"
uniform float uDensity;  // @control min=1.5 max=8 default=3.5 label="Cells across"
uniform float uStain;    // @control min=0 max=1 default=0.65 label="Stain"
uniform float uVignette; // @control min=0 max=1 default=0.85 label="Microscope vignette"`,
    HASH,
    NOISE,
    ROTATE,
    SMIN,
    `float ellipseDist(vec2 v, vec2 r) {
  return (length(v / r) - 1.0) * min(r.x, r.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 p = c * uDensity;
  float px = uDensity / iResolution.y;
  float T = iTime * 6.28318 / 8.0;
  float best = 1e5;
  float bestNuc = 1e5;
  float bestFade = 0.0;
  float bestSoft = 0.0;
  vec2 bestL = vec2(0.0);
  vec2 cell = floor(p);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 h = hash22(id + 0.37);
      float h2 = hash12(id * 1.71 + 4.1);
      vec2 centre = id + 0.5 + (h - 0.5) * 0.24 + 0.05 * vec2(sin(T + h.x * 6.28), cos(T + h.y * 6.28));
      float s = fract(iTime / 8.0 + h2);
      // Fade in and out as cells drift through the focal plane, which hides the wrap of the cycle.
      float fade = smoothstep(0.0, 0.1, s) * (1.0 - smoothstep(0.88, 1.0, s));
      vec2 l = rot(-(h.x * 3.14159 + s * 0.6)) * (p - centre);
      float split = smoothstep(0.45, 0.8, s);
      float r = 0.16 + 0.06 * smoothstep(0.0, 0.45, s);
      float rd = r * mix(1.0, 0.8, split);
      float sep = 0.19 * split + 0.08 * smoothstep(0.8, 1.0, s);
      float ang = atan(l.y, l.x);
      float wob = 0.004 * sin(ang * 3.0 + T * 2.0 + h.y * 9.0) + 0.003 * sin(ang * 5.0 - T * 3.0 + h.x * 7.0);
      float d1 = length(l - vec2(sep, 0.0)) - rd;
      float d2 = length(l + vec2(sep, 0.0)) - rd;
      float d = smin(d1, d2, mix(0.12, 0.004, smoothstep(0.55, 0.85, s))) + wob;
      // Nucleus: round, condenses to a plate (metaphase), pulls apart and rounds up in each daughter.
      float s1 = smoothstep(0.3, 0.42, s);
      float s2 = smoothstep(0.75, 0.92, s);
      vec2 nr = mix(vec2(0.45 * r), vec2(0.1 * r, 0.6 * r), s1);
      nr = mix(nr, vec2(0.42 * rd), s2);
      float nsep = sep * 0.95;
      float nd = min(ellipseDist(l - vec2(nsep, 0.0), nr), ellipseDist(l + vec2(nsep, 0.0), nr));
      float key = d + (1.0 - fade) * 0.25;
      if (key < best) {
        best = key;
        bestNuc = nd;
        bestFade = fade;
        bestSoft = 1.0 - fade;
        bestL = l + h * 7.0;
      }
    }
  }
  float d = best - (1.0 - bestFade) * 0.25;
  float aa = px * 1.5 + bestSoft * 0.05;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float rim = exp(-abs(d) / (0.012 + bestSoft * 0.04));
  float halo = exp(-max(d, 0.0) / 0.05) * (1.0 - inside);
  float grain = vnoise(bestL * 28.0) * 0.5 + vnoise(bestL * 61.0) * 0.5;
  vec3 col = uMedium * (0.96 + 0.04 * vnoise(p * 9.0));
  vec3 cyto = mix(uCell, uCell * 0.86, grain) * (0.9 + 0.12 * smoothstep(0.0, -0.12, d));
  col = mix(col, cyto, inside * bestFade * 0.9);
  col += halo * 0.18 * bestFade;
  col = mix(col, uMembrane, rim * bestFade * 0.75);
  float nIn = (1.0 - smoothstep(-aa, aa, bestNuc)) * inside;
  float chromatin = 0.75 + 0.25 * vnoise(bestL * 45.0);
  col = mix(col, uNucleus * chromatin, nIn * bestFade * mix(0.25, 0.9, uStain));
  col = mix(col, uNucleus * 0.6, exp(-abs(bestNuc) / 0.01) * inside * bestFade * 0.5 * uStain);
  // Microscope: a round field of view with a soft dark edge.
  float field = (0.5 * min(iResolution.x, iResolution.y) + 0.3 * abs(iResolution.x - iResolution.y)) / iResolution.y;
  float dc = length(c);
  float lens = smoothstep(field, field * 0.9, dc) * (1.0 - 0.25 * pow(dc / field, 2.0));
  col *= mix(1.0, lens, uVignette);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Stained", values: { uMedium: [0.95, 0.9, 0.93], uCell: [0.93, 0.68, 0.8], uMembrane: [0.55, 0.15, 0.4], uNucleus: [0.25, 0.1, 0.55], uStain: 1 } },
    {
      name: "Fluorescent",
      values: { uMedium: [0.02, 0.03, 0.05], uCell: [0.1, 0.45, 0.25], uMembrane: [0.4, 1, 0.55], uNucleus: [0.25, 0.45, 1], uStain: 0.9, uVignette: 0.6 },
    },
  ],
};

export const coralGrowth: ShaderEffect = {
  kind: "shader",
  id: "coral-growth",
  name: "Coral growth",
  description: "Branching coral growing outward from the centre in rings, softly translucent, with glowing growing tips.",
  category: "organic",
  tags: ["organic", "background", "growth", "coral", "lichen", "underwater", "branching"],
  source: glsl(
    `// Coral growth: arms of branching coral (trees made by folding space) growing outward, banded by growth rings.
uniform vec3 uWater;      // @control color default=#08263A label="Background"
uniform vec3 uBody;       // @control color default=#C2255C label="Coral base"
uniform vec3 uTip;        // @control color default=#FFB4A2 label="Coral edges"
uniform vec3 uFront;      // @control color default=#FFF1C1 label="Growth front"
uniform int uArms;        // @control min=3 max=12 default=7 label="Arms"
uniform float uThickness; // @control min=0.006 max=0.05 default=0.022 label="Thickness"
uniform float uSpread;    // @control min=10 max=60 default=32 label="Branch angle"
uniform float uCycle;     // @control min=4 max=40 default=14 label="Cycle (seconds)"
uniform float uRings;     // @control min=0 max=1 default=0.5 label="Growth rings"`,
    HASH,
    NOISE,
    ROTATE,
    `// Distance to arm k grown to arc length g from the centre, and how far along the arm the nearest point is.
vec2 arm(vec2 q, float k, float g) {
  float L = 0.2;
  float sc = 1.0;
  float id = 1.0 + k * 61.0;
  float d = 1e5;
  float along = 0.0;
  float arc = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    q.x += (vnoise(vec2(q.y * 6.0, id * 3.7)) - 0.5) * 0.12 * sin(3.14159 * clamp(q.y / L, 0.0, 1.0));
    float shown = clamp((g - arc) / sc, 0.0, L);
    if (shown <= 0.0) break;
    float y = clamp(q.y, 0.0, shown);
    float age = clamp((g - arc - y * sc) / 0.12, 0.0, 1.0);
    float w = uThickness * sqrt(sc) * mix(0.6, 1.0, age);
    float dd = length(q - vec2(0.0, y)) * sc - w;
    if (dd < d) {
      d = dd;
      along = arc + y * sc;
    }
    arc += L * sc;
    q.y -= L;
    id = id * 2.0 + step(0.0, q.x);
    q.x = abs(q.x);
    q = rot(radians(uSpread) * (0.6 + 0.8 * hash12(vec2(id, fi)))) * q;
    float s = 0.78 + 0.1 * hash12(vec2(fi, id * 1.3));
    q /= s;
    sc *= s;
  }
  return vec2(d, along);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float r = length(c);
  float cyc = fract(iTime / max(uCycle, 0.1));
  float g = 0.95 * (1.0 - pow(1.0 - smoothstep(0.0, 0.85, cyc), 1.5));
  float grow = 1.0 - smoothstep(0.88, 1.0, cyc);
  float n = float(uArms);
  float sector = 6.28318 / n;
  float idx = floor(atan(c.y, c.x) / sector + 0.5);
  float d = r - min(g, 0.05);
  float along = 0.0;
  for (int k = -1; k <= 1; k++) {
    float s = idx + float(k);
    vec2 q = rot(1.5708 - s * sector) * c;
    vec2 a = arm(q, mod(s, n), g);
    if (a.x < d) {
      d = a.x;
      along = a.y;
    }
  }
  vec3 col = uWater * (0.75 + 0.35 * vnoise(c * 5.0 + iTime * 0.05)) * (1.15 - 0.5 * r);
  float coral = (1.0 - smoothstep(-px, px, d)) * grow;
  float inner = clamp(-d / uThickness, 0.0, 1.0);
  // Translucent: thin edges let light through, thick cores are deeper; lit from the top left.
  vec2 grad = vec2(dFdx(d), dFdy(d));
  float lit = dot(grad / max(length(grad), 1e-6), normalize(vec2(-0.6, 0.8)));
  vec3 body = mix(uTip, uBody, smoothstep(0.0, 0.9, inner));
  body *= 0.9 + 0.3 * lit * (1.0 - inner);
  body *= 0.88 + 0.24 * vnoise(c * 140.0);
  body *= 1.0 - uRings * 0.3 * smoothstep(0.7, 1.0, 0.5 + 0.5 * cos(along * 45.0));
  float tip = exp(-max(g - along, 0.0) / 0.035);
  body = mix(body, uFront, tip * 0.75);
  float halo = exp(-max(d, 0.0) / 0.02) * (1.0 - coral) * grow;
  col = mix(col, col * 0.7, halo * 0.6);
  col += uBody * halo * 0.1 + uFront * exp(-max(d, 0.0) / 0.006) * (1.0 - coral) * grow * tip * 0.4;
  col = mix(col, body, coral);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Lichen", values: { uWater: [0.36, 0.37, 0.33], uBody: [0.45, 0.55, 0.3], uTip: [0.85, 0.9, 0.6], uFront: [0.95, 0.97, 0.8], uArms: 11, uThickness: 0.012, uSpread: 45 } },
    { name: "Bleached", values: { uWater: [0.02, 0.18, 0.3], uBody: [0.75, 0.78, 0.8], uTip: [1, 1, 0.96], uFront: [0.6, 0.95, 1], uRings: 0.8, uThickness: 0.03 } },
  ],
};

export const veins: ShaderEffect = {
  kind: "shader",
  id: "veins",
  name: "Veins",
  description: "Branching veins or roots with pulses of light travelling out along them.",
  category: "organic",
  tags: ["organic", "background", "branching", "leaf", "roots", "blood", "fractal"],
  source: glsl(
    `// Veins: a bounded-depth branching tree by folding space, wiggled with noise, with pulses along its length.
uniform vec3 uBackground; // @control color default=#2F6A1D label="Background"
uniform vec3 uVein;       // @control color default=#D4F08A label="Vein"
uniform vec3 uPulse;      // @control color default=#FFFDE0 label="Pulse"
uniform int uDepth;       // @control min=2 max=9 default=7 label="Depth"
uniform int uTrees;       // @control min=1 max=3 default=1 label="Trunks"
uniform float uSpread;    // @control min=10 max=80 default=38 label="Branch angle"
uniform float uWidth;     // @control min=0.002 max=0.04 default=0.012 label="Width"
uniform float uWiggle;    // @control min=0 max=0.4 default=0.12 label="Wiggle"
uniform float uRotation;  // @control min=-180 max=180 default=0 label="Rotation"
uniform float uPulses;    // @control min=0 max=2 default=0.8 label="Pulse speed"
uniform float uGlow;      // @control min=0 max=2 default=1 label="Glow"`,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    `// Distance to tree k (world units), its width there, and the distance along it from the root.
vec3 tree(vec2 q, float k, out float width) {
  float L = 0.34;
  float sc = 1.0;
  float id = 1.0 + k * 97.0;
  float d = 1e5;
  float along = 0.0;
  float arc = 0.0;
  width = uWidth;
  for (int i = 0; i < 9; i++) {
    if (i >= uDepth) break;
    float fi = float(i);
    // Wiggle each segment between its ends, so children stay joined to their parent.
    q.x += (vnoise(vec2(q.y * 5.0, id * 7.13)) - 0.5) * uWiggle * sin(3.14159 * clamp(q.y / L, 0.0, 1.0));
    float h = clamp(q.y / L, 0.0, 1.0);
    float w = uWidth * sc * mix(1.0, 0.75, h);
    float dd = length(q - vec2(0.0, h * L)) * sc - w;
    if (dd < d) {
      d = dd;
      along = arc + h * L * sc;
      width = w;
    }
    arc += L * sc;
    q.y -= L;
    id = id * 2.0 + step(0.0, q.x);
    q.x = abs(q.x);
    q = rot(radians(uSpread) * (0.7 + 0.6 * hash12(vec2(id, fi)))) * q;
    float s = 0.66 + 0.14 * hash12(vec2(fi, id * 1.3));
    q /= s;
    sc *= s;
  }
  return vec3(d, along, 0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec2 p = rot(radians(uRotation)) * c;
  p += (vec2(fbm(p * 2.5, 3), fbm(p * 2.5 + 5.3, 3)) - 0.5) * uWiggle * 0.5;
  float aspect = iResolution.x / iResolution.y;
  float d = 1e5;
  float along = 0.0;
  float width = uWidth;
  float seed = 0.0;
  for (int k = 0; k < 3; k++) {
    if (k >= uTrees) break;
    float fk = float(k);
    float x0 = ((fk + 0.5) / float(uTrees) - 0.5) * aspect * 0.8;
    float w;
    vec3 t = tree(p - vec2(x0, -0.62), fk, w);
    if (t.x < d) {
      d = t.x;
      along = t.y;
      width = w;
      seed = fk;
    }
  }
  float mask = 1.0 - smoothstep(-px, px, d);
  float tube = clamp(-d / max(width, px), 0.0, 1.0);
  float glow = exp(-max(d, 0.0) / 0.012);
  // Background with a little cellular texture.
  vec3 col = uBackground * (0.88 + 0.12 * fbm(c * 14.0, 3)) * (1.1 - 0.35 * length(c));
  col = mix(col, uVein, glow * 0.18 * uGlow);
  col = mix(col, uVein * (0.8 + 0.35 * sqrt(tube)), mask);
  // Pulses: bright heads travelling root to tip.
  float f = fract(along * 2.2 - iTime * uPulses * 0.5 + seed * 0.37);
  float pulse = smoothstep(0.65, 0.97, f) * (1.0 - smoothstep(0.97, 1.0, f));
  col += uPulse * pulse * (mask * 0.9 + exp(-max(d, 0.0) / 0.008) * 0.5 * uGlow);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Leaf veins", values: { uBackground: [0.18, 0.42, 0.11], uVein: [0.83, 0.94, 0.54], uPulse: [1, 0.99, 0.88], uSpread: 40, uTrees: 1, uRotation: 0, uWiggle: 0.08 } },
    {
      name: "Blood vessels",
      values: { uBackground: [0.93, 0.74, 0.7], uVein: [0.55, 0.04, 0.1], uPulse: [1, 0.25, 0.25], uSpread: 30, uTrees: 2, uRotation: 90, uWiggle: 0.25, uWidth: 0.01, uPulses: 1.4 },
    },
    {
      name: "Tree roots",
      values: { uBackground: [0.23, 0.16, 0.11], uVein: [0.79, 0.64, 0.48], uPulse: [0.96, 0.89, 0.71], uSpread: 28, uTrees: 3, uRotation: 180, uWiggle: 0.35, uWidth: 0.016, uDepth: 8 },
    },
  ],
};

export const ferrofluid: ShaderEffect = {
  kind: "shader",
  id: "ferrofluid",
  name: "Ferrofluid",
  description: "A glossy black ferrofluid puddle whose spikes rise as a magnet passes over it, following the pointer.",
  category: "organic",
  tags: ["organic", "interactive", "hover", "liquid", "magnetic", "glossy", "3d"],
  source: glsl(
    `// Ferrofluid: a raymarched height field of spiky fluid; the magnet follows the pointer or orbits while idle.
uniform vec3 uFluid;      // @control color default=#050507 label="Fluid"
uniform vec3 uTable;      // @control color default=#E9E7E2 label="Surface"
uniform vec3 uLight;      // @control color default=#FFFFFF label="Light"
uniform float uStrength;  // @control min=0 max=1.5 default=1 label="Magnet strength"
uniform float uSpikes;    // @control min=4 max=16 default=7 label="Spike density"
uniform float uSize;      // @control min=0.3 max=1 default=0.55 label="Puddle size"
uniform float uGloss;     // @control min=0 max=1 default=0.85 label="Gloss"
uniform bool uDemo;       // @control default=true label="Orbit when idle"`,
    `vec3 camRay(vec2 frag, vec3 ro) {
  vec2 uv = (frag - 0.5 * iResolution.xy) / iResolution.y;
  vec3 fw = normalize(vec3(0.0, 0.1, 0.0) - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  return normalize(fw * 1.7 + uv.x * rt + uv.y * up);
}

// The magnet over the table: xz, and how strongly it pulls (0–1.5).
vec3 gMagnet;
vec2 gCentre;

float fluidHeight(vec2 xz) {
  float r = length(xz - gCentre) / uSize;
  if (r > 1.05) return 0.0;
  float inside = 1.0 - smoothstep(0.92, 1.05, r);
  float dome = 0.2 * uSize * pow(clamp(1.0 - r * r, 0.0, 1.0), 0.45);
  float near = exp(-dot(xz - gMagnet.xy, xz - gMagnet.xy) / pow(0.42 * uSize, 2.0));
  dome += 0.08 * uSize * gMagnet.z * near * inside;
  // Spikes on a hexagonal lattice, tallest under the magnet and shorter towards the rim.
  vec2 hp = xz * uSpikes / uSize;
  vec2 s = vec2(1.0, 1.732);
  vec2 a = mod(hp, s) - s * 0.5;
  vec2 b = mod(hp - s * 0.5, s) - s * 0.5;
  float dc = min(length(a), length(b));
  float cone = pow(max(1.0 - dc / 0.55, 0.0), 2.2);
  float tall = 0.42 * uSize * gMagnet.z * mix(0.25, 1.0, near) * (1.0 - smoothstep(0.7, 1.0, r));
  return dome + cone * tall;
}

vec3 environment(vec3 d) {
  vec3 env = mix(vec3(0.03), vec3(0.22), smoothstep(-0.1, 0.7, d.y));
  if (d.y < 0.0) env = uTable * 0.55 * (1.0 - smoothstep(0.0, -0.6, d.y) * 0.4);
  env += uLight * 2.2 * smoothstep(0.88, 0.92, dot(d, normalize(vec3(-0.45, 0.85, 0.25))));
  env += uLight * 1.4 * smoothstep(0.95, 0.975, dot(d, normalize(vec3(0.7, 0.55, -0.45))));
  return env;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 ro = vec3(0.0, 1.55, -2.0);
  float t0 = iTime;
  // The magnet: the pointer's spot on the table while hovered, else an orbit that comes and goes.
  vec3 pr = camRay(iPointer.xy, ro);
  vec2 pointerXZ = (ro + pr * (-ro.y / min(pr.y, -0.05))).xz;
  float hov = clamp(iPointer.z, 0.0, 1.0);
  vec2 orbit = uDemo ? vec2(cos(t0 * 0.45), sin(t0 * 0.45)) * 0.35 * uSize : vec2(0.0);
  float idleAmp = uDemo ? 0.55 + 0.45 * sin(t0 * 0.9) : 0.7;
  gMagnet = vec3(mix(orbit, clamp(pointerXZ, vec2(-1.5), vec2(1.5)), hov), uStrength * mix(idleAmp, 1.0, hov));
  gCentre = mix(vec2(0.0), gMagnet.xy, 0.22 * min(gMagnet.z, 1.0));
  vec3 rd = camRay(fragCoord, ro);
  float top = 0.75 * uSize;
  float t = (ro.y - top) / max(-rd.y, 1e-3);
  float lastT = t;
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    vec3 p = ro + rd * t;
    float dy = p.y - fluidHeight(p.xz);
    if (dy < 0.0005) { hit = true; break; }
    lastT = t;
    t += max(dy * 0.28, 0.0015);
    if (t > 12.0) break;
  }
  if (hit) {
    float lo = lastT;
    float hi = t;
    for (int i = 0; i < 6; i++) {
      float m = 0.5 * (lo + hi);
      vec3 p = ro + rd * m;
      if (p.y - fluidHeight(p.xz) < 0.0) hi = m; else lo = m;
    }
    t = hi;
  }
  vec3 p = ro + rd * t;
  vec3 col;
  float hgt = fluidHeight(p.xz);
  if (hit && hgt > 0.0008) {
    float e = 0.0015;
    vec3 n = normalize(vec3(
      fluidHeight(p.xz - vec2(e, 0.0)) - fluidHeight(p.xz + vec2(e, 0.0)),
      2.0 * e,
      fluidHeight(p.xz - vec2(0.0, e)) - fluidHeight(p.xz + vec2(0.0, e))));
    vec3 v = -rd;
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
    vec3 refl = reflect(rd, n);
    vec3 L = normalize(vec3(-0.45, 0.85, 0.25));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    col = uFluid * (0.4 + 0.6 * diff);
    col += environment(refl) * mix(0.05, 1.0, fres) * mix(0.35, 1.0, uGloss);
    col += uLight * pow(clamp(dot(refl, L), 0.0, 1.0), mix(20.0, 260.0, uGloss)) * 2.0 * uGloss;
  } else {
    // The table: soft light falloff and a contact shadow round the puddle.
    vec2 xz = (ro + rd * (-ro.y / min(rd.y, -1e-3))).xz;
    float r = length(xz - gCentre - vec2(0.12, -0.06) * uSize);
    float shadow = mix(0.45, 1.0, smoothstep(uSize * 0.95, uSize * 1.45, r));
    col = uTable * shadow * (1.0 - 0.18 * length(xz) / (1.0 + length(xz)));
  }
  vec2 uv = fragCoord / iResolution.xy;
  col *= 0.85 + 0.15 * pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.25);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Studio dark", values: { uTable: [0.12, 0.12, 0.14], uLight: [0.85, 0.92, 1], uGloss: 1 } },
    { name: "Gold leaf", values: { uFluid: [0.25, 0.17, 0.04], uTable: [0.96, 0.93, 0.86], uLight: [1, 0.85, 0.55], uSpikes: 12 } },
  ],
};

export const jellyfish: ShaderEffect = {
  kind: "shader",
  id: "jellyfish",
  name: "Jellyfish",
  description: "Translucent jellyfish pulsing and drifting up through deep water, trailing glowing tentacles.",
  category: "organic",
  tags: ["organic", "background", "underwater", "ocean", "bioluminescent", "creature"],
  source: glsl(
    `// Jellyfish: pulsing translucent bells with trailing tentacles, glowing in deep water.
uniform vec3 uDeep;        // @control color default=#020617 label="Deep water"
uniform vec3 uShallow;     // @control color default=#0B3555 label="Upper water"
uniform vec3 uGlow;        // @control color default=#7DF9FF label="Glow"
uniform vec3 uAccent;      // @control color default=#FF6EC7 label="Accent"
uniform int uCount;        // @control min=1 max=6 default=4 label="Jellyfish"
uniform float uSize;       // @control min=0.05 max=0.3 default=0.12 label="Size"
uniform float uSpeed;      // @control min=0 max=2 default=0.6 label="Speed"
uniform float uTentacles;  // @control min=0.2 max=2 default=1 label="Tentacle length"
uniform float uLuminance;  // @control min=0 max=2 default=1 label="Bioluminescence"`,
    HASH,
    NOISE,
    ROTATE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = fragCoord / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = iTime * uSpeed;
  // Water: lighter above, faint shafts of light, drifting marine snow.
  vec3 col = mix(uDeep, uShallow, pow(uv.y, 1.4));
  float shafts = vnoise(vec2((p.x + p.y * 0.35) * 7.0, iTime * 0.08)) * vnoise(vec2((p.x + p.y * 0.3) * 13.0, iTime * 0.05 + 4.0));
  col += uShallow * shafts * smoothstep(0.2, 1.0, uv.y) * 0.9;
  vec2 sp = p * 24.0 + vec2(0.0, iTime * 0.25);
  vec2 sc = floor(sp);
  vec2 sh = hash22(sc);
  float snow = smoothstep(0.08, 0.0, length(fract(sp) - sh)) * step(0.82, hash12(sc + 3.7));
  col += vec3(0.5, 0.6, 0.7) * snow * 0.35;
  vec3 light = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 seed = hash22(vec2(fi * 3.17 + 1.0, 7.3));
    float depth = 0.6 + 0.4 * seed.y;
    float size = uSize * depth;
    float period = 1.6 + seed.x * 0.9;
    float tau = t / period + seed.y * 5.0;
    float f = fract(tau);
    float contract = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.25, 1.0, f));
    // Each pulse pushes it up a little; it wraps once well off the top.
    float rise = (floor(tau) + smoothstep(0.0, 0.45, f)) * size * 0.45;
    float span = 1.0 + size * (2.0 + 6.0 * uTentacles);
    float y = mod(seed.x * span + rise, span) - size * 6.0 * uTentacles;
    vec2 centre = vec2((0.1 + 0.8 * fract(seed.x * 1.7 + fi * 0.37)) * aspect + 0.04 * sin(t * 0.3 + fi), y);
    float tilt = 0.25 * sin(t * 0.2 + fi * 2.0);
    vec2 q = rot(tilt) * (p - centre) / size;
    float lpx = px / size;
    float bright = uLuminance * depth;
    // Bell: a dome that narrows and heightens as it contracts, edged with scallops.
    float bw = 1.0 - 0.2 * contract;
    float bh = 0.85 + 0.15 * contract;
    vec2 bq = vec2(q.x / bw, q.y / bh);
    float e = length(bq);
    float under = 0.25 * (1.0 - bq.x * bq.x) + 0.04 * sin(bq.x * 18.0);
    float bell = (1.0 - smoothstep(1.0 - lpx * 2.0, 1.0, e)) * smoothstep(under - 0.05, under + 0.02, bq.y);
    float fresnel = pow(clamp(e, 0.0, 1.0), 5.0);
    vec3 bellCol = mix(uGlow * 0.35, uGlow, fresnel) ;
    col = mix(col, bellCol * (0.6 + 0.6 * bright), bell * (0.18 + 0.55 * fresnel) * depth);
    // Gonads: four soft loops inside the bell.
    vec2 gq = vec2(q.x, (q.y - 0.4) * 1.7);
    float petals = length(gq) - 0.2 * (0.7 + 0.3 * cos(4.0 * atan(gq.y, gq.x) + 0.785));
    float gonad = exp(-abs(petals) / 0.025) * bell;
    // Radial canals in the bell.
    float canals = exp(-abs(sin(atan(q.x, q.y - under * 0.5) * 8.0)) * 6.0) * bell * smoothstep(0.3, 0.95, e);
    light += uGlow * canals * 0.12 * bright;
    light += uAccent * gonad * 0.5 * bright;
    // Rim lights round the margin.
    float rim = exp(-abs(bq.y - under) / 0.04) * step(abs(bq.x), 1.0) * (0.6 + 0.4 * sin(bq.x * 18.0 + iTime * 3.0));
    light += uGlow * rim * 0.45 * bright;
    // Tentacles trail below, swaying with a lag that grows with length.
    float down = under * bw - q.y;
    if (down > -0.1) {
      for (int k = 0; k < 8; k++) {
        float fk = float(k);
        float len = uTentacles * 4.5 * (0.6 + 0.4 * hash12(vec2(fi, fk)));
        float x0 = mix(-0.85, 0.85, fk / 7.0) * bw;
        float xo = x0 * (1.0 + 0.12 * down) + sin(down * 2.6 - t * 3.0 + fk * 1.3 + fi) * 0.18 * down;
        float fade = 1.0 - smoothstep(0.0, len, down);
        float line = exp(-abs(q.x - xo) / (0.025 + lpx)) * fade * step(0.0, down);
        light += uGlow * line * 0.4 * bright;
      }
      // Oral arms: two frilly ribbons near the middle.
      for (int k = 0; k < 2; k++) {
        float fk = float(k) * 2.0 - 1.0;
        float xo = fk * 0.12 + sin(down * 2.0 - t * 2.4 + fk) * 0.1 * down;
        float wdt = 0.07 + 0.03 * sin(down * 18.0 + fk * 3.0);
        float arm = (1.0 - smoothstep(wdt - lpx * 2.0, wdt, abs(q.x - xo))) * (1.0 - smoothstep(0.0, uTentacles * 2.2, down)) * step(0.0, down);
        col = mix(col, mix(uAccent, uGlow, 0.4) * (0.5 + 0.5 * bright), arm * 0.35 * depth);
      }
    }
    light += uGlow * exp(-length(q - vec2(0.0, 0.3)) * 1.6) * 0.07 * bright;
  }
  col += light;
  col = 1.0 - exp(-col * 1.2);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Moon jelly", values: { uGlow: [0.75, 0.85, 1], uAccent: [0.85, 0.55, 1], uCount: 5, uSize: 0.1 } },
    { name: "Sea nettle", values: { uDeep: [0.03, 0.02, 0.04], uShallow: [0.12, 0.06, 0.08], uGlow: [1, 0.6, 0.3], uAccent: [1, 0.3, 0.2], uCount: 2, uSize: 0.18, uTentacles: 1.8 } },
  ],
};

export const fur: ShaderEffect = {
  kind: "shader",
  id: "fur",
  name: "Fur",
  description: "Soft fur, moss or grass swaying in a breeze, parting around the pointer.",
  category: "organic",
  tags: ["organic", "interactive", "hover", "texture", "soft", "nature"],
  source: glsl(
    `// Fur: tapered strands on jittered grids, the topmost drawn, shaded darker towards the roots;
// they sway in a breeze and part away from the pointer while it hovers.
uniform vec3 uRoot;      // @control color default=#3B2416 label="Root"
uniform vec3 uTip;       // @control color default=#D9A066 label="Tip"
uniform float uDensity;  // @control min=15 max=160 default=40 label="Density"
uniform float uLength;   // @control min=0.5 max=3.5 default=2.6 label="Length"
uniform float uWidth;    // @control min=0.05 max=0.5 default=0.2 label="Strand width"
uniform float uLie;      // @control min=-180 max=180 default=-80 label="Lie direction"
uniform float uSway;     // @control min=0 max=1 default=0.35 label="Breeze"
uniform float uClump;    // @control min=0 max=1 default=0.5 label="Clumping"
uniform float uPart;     // @control min=0 max=1 default=0.8 label="Parting"`,
    HASH,
    NOISE,
    `vec2 strandDir(vec2 root, vec2 ptr, float hov) {
  float a = radians(uLie) + (vnoise(root * 0.07) - 0.5) * 1.6 * uClump;
  a += uSway * 0.7 * sin(iTime * 1.3 + root.x * 0.05 + root.y * 0.03 + 2.0 * vnoise(root * 0.02 + iTime * 0.15));
  vec2 dir = vec2(cos(a), sin(a));
  vec2 away = root - ptr;
  float reach = 0.16 * uDensity;
  float f = uPart * hov * exp(-dot(away, away) / (reach * reach));
  return normalize(mix(dir, normalize(away + 1e-4), clamp(f * 1.4, 0.0, 1.0)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uDensity;
  vec2 ptr = iPointer.xy / iResolution.y * uDensity;
  float hov = clamp(iPointer.z, 0.0, 1.0);
  vec2 here = strandDir(p, ptr, hov);
  float top = -1.0;
  float across = 0.0;
  float tint = 0.0;
  vec2 topDir = here;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    vec2 off = vec2(0.37, 0.71) * fl;
    vec2 base = floor(p - here * uLength * 0.5 - off);
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 id = base + vec2(float(i), float(j));
        vec2 h = hash22(id + fl * 31.7);
        vec2 root = id + off + h;
        vec2 dir = strandDir(root, ptr, hov);
        float len = uLength * (0.75 + 0.5 * h.y);
        vec2 rp = p - root;
        float along = clamp(dot(rp, dir) / len, 0.0, 1.0);
        float w = uWidth * (1.0 - 0.75 * along);
        float dist = length(rp - dir * along * len);
        if (dist < w && along > top) {
          top = along;
          across = dist / w;
          tint = h.x;
          topDir = dir;
        }
      }
    }
  }
  float clump = vnoise(p * 0.07 + 3.0);
  vec3 skin = uRoot * 0.3;
  vec3 col = skin;
  if (top >= 0.0) {
    float h = top;
    col = mix(uRoot, uTip, pow(h, 0.8)) * (0.85 + 0.3 * tint);
    col *= 0.45 + 0.55 * h;
    col *= 0.75 + 0.25 * sqrt(max(1.0 - across * across, 0.0));
    // Strands facing the light (top left) catch a sheen.
    col += uTip * 0.25 * pow(max(dot(topDir, normalize(vec2(-0.6, 0.8))), 0.0), 4.0) * h;
  }
  col *= 0.85 + 0.3 * clump * uClump;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Moss", values: { uRoot: [0.1, 0.2, 0.04], uTip: [0.64, 0.79, 0.23], uDensity: 120, uLength: 1.2, uWidth: 0.3, uSway: 0.12, uClump: 0.9 } },
    { name: "Fur", values: { uRoot: [0.23, 0.14, 0.09], uTip: [0.85, 0.63, 0.4], uDensity: 40, uLength: 2.6, uWidth: 0.2, uSway: 0.35, uClump: 0.5 } },
    { name: "Grass", values: { uRoot: [0.08, 0.25, 0.07], uTip: [0.71, 0.89, 0.42], uDensity: 28, uLength: 3.5, uWidth: 0.14, uLie: 90, uSway: 0.8, uClump: 0.3 } },
  ],
};

/** More organic life: growth, cells, veins and creatures (category "organic"). */
export const growthShaders: ShaderEffect[] = [reactionDiffusion, cellDivision, coralGrowth, veins, ferrofluid, jellyfish, fur];
