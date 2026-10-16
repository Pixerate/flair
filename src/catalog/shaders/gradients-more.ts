import { glsl, HASH, NOISE, OKLAB_MIX, PALETTE, ROTATE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const grainyGradient: ShaderEffect = {
  kind: "shader",
  id: "grainy-gradient",
  name: "Grainy gradient",
  description: "Big soft colour blobs drifting into each other under a fine film grain, filling the frame.",
  category: "gradient",
  tags: ["background", "hero", "grain", "soft", "brand"],
  source: glsl(
    `// Grainy gradient: three soft blobs drifting over a base colour, warped a little, under fine grain.
uniform vec3 uBase;      // @control color default=#F5D0FE label="Base"
uniform vec3 uColorA;    // @control color default=#F97316 label="Colour A"
uniform vec3 uColorB;    // @control color default=#DB2777 label="Colour B"
uniform vec3 uColorC;    // @control color default=#4F46E5 label="Colour C"
uniform float uSize;     // @control min=0.2 max=1.5 default=0.6 label="Blob size"
uniform float uSpeed;    // @control min=0 max=2 default=0.3 label="Speed"
uniform float uWarp;     // @control min=0 max=1 default=0.4 label="Warp"
uniform float uGrain;    // @control min=0 max=0.4 default=0.14 label="Grain"`,
    HASH,
    NOISE,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x * px;
  float t = iTime * uSpeed;
  p += uWarp * 0.25 * (vec2(vnoise(p * 1.8 + t * 0.6), vnoise(p * 1.8 - t * 0.5 + 7.0)) - 0.5);
  vec2 pa = vec2(-0.35 * aspect, -0.2) + vec2(0.25 * sin(t * 0.7), 0.2 * cos(t * 0.9));
  vec2 pb = vec2(0.3 * aspect, 0.25) + vec2(0.25 * cos(t * 0.6 + 1.0), 0.2 * sin(t * 0.8 + 2.0));
  vec2 pc = vec2(0.2 * aspect, -0.35) + vec2(0.3 * sin(t * 0.5 + 4.0), 0.15 * cos(t * 1.1));
  float s2 = uSize * uSize;
  vec3 col = uBase;
  col = oklabMix(col, uColorA, exp(-dot(p - pa, p - pa) / s2));
  col = oklabMix(col, uColorB, exp(-dot(p - pb, p - pb) / s2));
  col = oklabMix(col, uColorC, exp(-dot(p - pc, p - pc) / (s2 * 0.9)));
  // Fine grain, still between frames, like a printed texture.
  col += (hash12(fragCoord) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Stripe-like", values: { uBase: [0.66, 0.38, 0.93], uColorA: [1, 0.2, 0.24], uColorB: [1, 0.8, 0.34], uColorC: [0.56, 0.88, 1], uGrain: 0.08, uSize: 0.7 } },
    { name: "Peach", values: { uBase: [1, 0.89, 0.8], uColorA: [1, 0.6, 0.45], uColorB: [1, 0.78, 0.55], uColorC: [0.95, 0.5, 0.6] } },
    { name: "Night", values: { uBase: [0.03, 0.03, 0.08], uColorA: [0.3, 0.1, 0.6], uColorB: [0.05, 0.3, 0.5], uColorC: [0.6, 0.1, 0.4], uGrain: 0.1 } },
  ],
};

export const stripeGradient: ShaderEffect = {
  kind: "shader",
  id: "stripe-gradient",
  name: "Stripe gradient",
  description: "Bands of colour flowing in slow diagonal waves, like the Stripe.com hero, optionally cut by a slanted edge.",
  category: "gradient",
  tags: ["background", "hero", "brand", "wave", "saas"],
  source: glsl(
    `// Stripe gradient: four colour layers flowing in diagonal waves, each revealed where its own noise is high.
uniform vec3 uColorA;     // @control color default=#EF008F label="Colour A"
uniform vec3 uColorB;     // @control color default=#6EC3F4 label="Colour B"
uniform vec3 uColorC;     // @control color default=#7038FF label="Colour C"
uniform vec3 uColorD;     // @control color default=#FFBA27 label="Colour D"
uniform float uSpeed;     // @control min=0 max=2 default=0.4 label="Speed"
uniform float uScale;     // @control min=0.3 max=3 default=1 label="Scale"
uniform float uAngle;     // @control min=-45 max=45 default=-12 label="Angle (°)"
uniform float uCut;       // @control min=0 max=0.6 default=0 label="Slanted edge"
uniform vec3 uBackground; // @control color default=#FFFFFF label="Below the edge"`,
    HASH,
    NOISE,
    ROTATE,
    OKLAB_MIX,
    `float layer(vec2 p, float t, float seed) {
  // Long diagonal waves, with noise breaking them up.
  float w = sin(p.x * 1.6 + t + seed * 2.1 + sin(p.y * 1.3 + t * 0.7 + seed) * 1.2) * 0.5 + 0.5;
  float n = vnoise(vec2(p.x * 1.2 + t * 0.4 + seed * 13.0, p.y * 2.4 - t * 0.3));
  return mix(w, n, 0.45);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p0 = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 p = rot(radians(uAngle)) * p0 / uScale * 2.0;
  float t = iTime * uSpeed;
  vec3 col = uColorA;
  col = oklabMix(col, uColorB, smoothstep(0.42, 0.72, layer(p, t, 1.0)));
  col = oklabMix(col, uColorC, smoothstep(0.48, 0.78, layer(p * 1.1 + vec2(0.0, 0.6), t * 1.15, 2.0)));
  col = oklabMix(col, uColorD, smoothstep(0.55, 0.85, layer(p * 0.9 - vec2(0.0, 0.8), t * 0.9, 3.0)));
  // Soft light running along the waves.
  col += 0.06 * sin(p.x * 3.0 - p.y * 2.0 + t * 1.5);
  if (uCut > 0.0) {
    float edge = p0.y - (-0.5 + uCut + p0.x * 0.25);
    col = mix(uBackground, col, clamp(edge / px + 0.5, 0.0, 1.0));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Stripe", values: { uColorA: [0.94, 0, 0.56], uColorB: [0.43, 0.76, 0.96], uColorC: [0.44, 0.22, 1], uColorD: [1, 0.73, 0.15], uCut: 0.25 } },
    { name: "Ocean", values: { uColorA: [0.02, 0.2, 0.45], uColorB: [0.1, 0.6, 0.8], uColorC: [0.3, 0.9, 0.85], uColorD: [0.85, 0.97, 1] } },
    { name: "Citrus", values: { uColorA: [1, 0.55, 0.1], uColorB: [1, 0.85, 0.2], uColorC: [0.55, 0.85, 0.25], uColorD: [1, 0.35, 0.4] } },
  ],
};

export const holographicGradient: ShaderEffect = {
  kind: "shader",
  id: "holographic-gradient",
  name: "Holographic gradient",
  description: "Iridescent foil: rainbow bands shifting and shimmering across the frame, with bright sheen streaks.",
  category: "gradient",
  tags: ["background", "holographic", "iridescent", "foil", "y2k"],
  source: glsl(
    `// Holographic gradient: thin-film rainbow bands that warp and drift, a pale tint, sheen streaks and glitter.
uniform vec3 uTint;       // @control color default=#E9E4FF label="Tint"
uniform float uPastel;    // @control min=0 max=1 default=0.55 label="Pastel"
uniform float uBands;     // @control min=0.5 max=8 default=2.5 label="Bands"
uniform float uWarp;      // @control min=0 max=2 default=0.8 label="Warp"
uniform float uSpeed;     // @control min=0 max=2 default=0.3 label="Speed"
uniform float uSheen;     // @control min=0 max=1 default=0.5 label="Sheen"
uniform float uGlitter;   // @control min=0 max=1 default=0.15 label="Glitter"`,
    HASH,
    NOISE,
    PALETTE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  vec2 q = p + uWarp * 0.3 * vec2(vnoise(p * 2.0 + t * 0.5), vnoise(p * 2.0 - t * 0.4 + 3.0));
  float v = dot(q, normalize(vec2(1.0, 0.6))) * uBands + 0.35 * sin(q.y * 4.0 + t) + t * 0.5;
  vec3 film = palette(v, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  vec3 col = mix(film, uTint, uPastel);
  // Sheen: thin bright streaks across the bands.
  float s = sin(dot(q, vec2(-0.6, 1.0)) * 9.0 - t * 2.0 + 2.0 * vnoise(q * 3.0));
  col += uSheen * 0.35 * pow(max(s, 0.0), 12.0);
  col *= 0.92 + 0.08 * sin(v * 6.2831853);
  // Glitter: sparse points twinkling.
  vec2 cell = floor(fragCoord / 2.0);
  float g = hash12(cell);
  float tw = 0.5 + 0.5 * sin(iTime * 4.0 + g * 60.0);
  col += uGlitter * step(0.993, g) * tw * 0.7;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Pearl", values: { uTint: [0.96, 0.95, 1], uPastel: 0.65, uGlitter: 0.1 } },
    { name: "Oil slick", values: { uTint: [0.04, 0.03, 0.08], uPastel: 0.45, uBands: 4, uSheen: 0.8 } },
    { name: "Foil", values: { uTint: [0.8, 0.82, 0.88], uPastel: 0.3, uBands: 5, uGlitter: 0.5 } },
  ],
};

export const radialGlow: ShaderEffect = {
  kind: "shader",
  id: "radial-glow",
  name: "Radial glow",
  description: "Soft radial glows breathing in and out as they drift over a dark background.",
  category: "gradient",
  tags: ["background", "hero", "glow", "dark", "calm"],
  source: glsl(
    `// Radial glow: soft round glows of light pulsing and drifting over a dark ground.
uniform vec3 uBackground; // @control color default=#05050A label="Background"
uniform vec3 uColorA;     // @control color default=#6366F1 label="Colour A"
uniform vec3 uColorB;     // @control color default=#EC4899 label="Colour B"
uniform vec3 uColorC;     // @control color default=#22D3EE label="Colour C"
uniform int uCount;       // @control min=1 max=3 default=3 label="Glows"
uniform float uSize;      // @control min=0.1 max=1 default=0.4 label="Size"
uniform float uPulse;     // @control min=0 max=1 default=0.5 label="Pulse"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"
uniform float uIntensity; // @control min=0 max=2 default=1 label="Intensity"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x * px;
  float t = iTime * uSpeed;
  vec3 light = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec3 c = i == 0 ? uColorA : i == 1 ? uColorB : uColorC;
    vec2 home = uCount == 1 ? vec2(0.0) : vec2((fi / float(uCount - 1) - 0.5) * 0.6 * aspect, 0.12 * sin(fi * 2.4));
    vec2 at = home + 0.1 * vec2(sin(t * 0.5 + fi * 2.0), cos(t * 0.4 + fi * 1.3));
    float breathe = 1.0 + uPulse * 0.35 * sin(t * 1.7 + fi * 2.1);
    float r = uSize * breathe;
    float d = length(p - at) / r;
    light += c * (exp(-d * d * 2.0) * 0.9 + exp(-d * 1.2) * 0.25) * (1.0 + uPulse * 0.25 * sin(t * 1.7 + fi * 2.1));
  }
  vec3 col = uBackground + light * uIntensity;
  col = 1.0 - exp(-col * 1.2);
  col += (hash12(fragCoord) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Indigo", values: { uCount: 1, uColorA: [0.39, 0.4, 0.95], uSize: 0.6 } },
    { name: "Sunset", values: { uColorA: [1, 0.45, 0.2], uColorB: [0.95, 0.25, 0.5], uColorC: [1, 0.75, 0.3], uBackground: [0.06, 0.02, 0.03] } },
    { name: "Aurora", values: { uColorA: [0.1, 0.9, 0.6], uColorB: [0.2, 0.5, 1], uColorC: [0.6, 0.3, 1] } },
  ],
};

export const moreGradientShaders: ShaderEffect[] = [grainyGradient, stripeGradient, holographicGradient, radialGlow];
