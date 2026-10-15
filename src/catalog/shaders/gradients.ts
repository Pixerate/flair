import { FBM, glsl, HASH, NOISE, OKLAB_MIX, ROTATE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const aurora: ShaderEffect = {
  kind: "shader",
  id: "aurora",
  name: "Aurora",
  description: "Soft curtains of light drifting over a night sky.",
  category: "gradient",
  tags: ["background", "hero", "calm", "night"],
  source: glsl(
    `// Aurora: curtains of light drifting over a night sky.
uniform vec3 uSky;        // @control color default=#050816 label="Sky"
uniform vec3 uGlowA;      // @control color default=#22D3A6 label="Glow A"
uniform vec3 uGlowB;      // @control color default=#7C3AED label="Glow B"
uniform float uSpeed;     // @control min=0 max=2 default=0.35 label="Speed"
uniform float uIntensity; // @control min=0 max=2 default=1 label="Intensity"
uniform float uHeight;    // @control min=0 max=1 default=0.55 label="Height"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * uSpeed;
  vec3 col = uSky * (0.6 + 0.4 * uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = uv.x * (1.4 + 0.3 * fi) + fi * 3.7;
    float wave = fbm(vec2(x * 1.5 + t * 0.4, t * 0.25 + fi), 4);
    float centre = uHeight + 0.18 * (wave - 0.5) + 0.06 * fi;
    float band = exp(-pow((uv.y - centre) * (7.0 + 2.0 * fi), 2.0));
    float rays = 0.55 + 0.45 * fbm(vec2(x * 12.0, t * 0.6 + fi * 9.0), 3);
    float above = smoothstep(centre - 0.05, centre + 0.35, uv.y) * 0.35;
    vec3 glow = mix(uGlowA, uGlowB, clamp(uv.y * 1.4 - 0.2 + 0.25 * fi, 0.0, 1.0));
    col += glow * (band * rays + above * band) * 0.6 * uIntensity;
  }
  float stars = step(0.997, hash12(floor(fragCoord * 0.5))) * smoothstep(0.3, 1.0, uv.y);
  col += stars * 0.6 * (0.5 + 0.5 * sin(iTime * 3.0 + hash12(floor(fragCoord)) * 40.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Arctic", values: { uGlowA: [0.13, 0.83, 0.65], uGlowB: [0.49, 0.23, 0.93] } },
    { name: "Ember", values: { uSky: [0.06, 0.02, 0.03], uGlowA: [1, 0.45, 0.1], uGlowB: [0.9, 0.1, 0.4] } },
    { name: "Ice", values: { uSky: [0.01, 0.03, 0.06], uGlowA: [0.5, 0.9, 1], uGlowB: [0.2, 0.4, 1] } },
  ],
};

export const meshGradient: ShaderEffect = {
  kind: "shader",
  id: "mesh-gradient",
  name: "Mesh gradient",
  description: "Four colours blended across a slowly warping mesh, mixed in Oklab.",
  category: "gradient",
  tags: ["background", "hero", "brand", "soft"],
  source: glsl(
    `// Mesh gradient: four colours on drifting points, blended in Oklab.
uniform vec3 uColorA;  // @control color default=#FF6B6B label="Colour A"
uniform vec3 uColorB;  // @control color default=#FFD93D label="Colour B"
uniform vec3 uColorC;  // @control color default=#6BCB77 label="Colour C"
uniform vec3 uColorD;  // @control color default=#4D96FF label="Colour D"
uniform float uSpeed;  // @control min=0 max=2 default=0.3 label="Speed"
uniform float uWarp;   // @control min=0 max=1 default=0.35 label="Warp"
uniform float uGrain;  // @control min=0 max=0.2 default=0.04 label="Grain"`,
    HASH,
    NOISE,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * uSpeed;
  vec2 w = uv + uWarp * 0.3 * vec2(vnoise(uv * 2.0 + t), vnoise(uv * 2.0 - t + 5.0)) - uWarp * 0.15;
  vec2 pa = vec2(0.2, 0.2) + 0.15 * vec2(sin(t * 1.1), cos(t * 0.9));
  vec2 pb = vec2(0.8, 0.25) + 0.15 * vec2(cos(t * 0.7), sin(t * 1.3));
  vec2 pc = vec2(0.25, 0.8) + 0.15 * vec2(sin(t * 0.8 + 2.0), cos(t * 1.2));
  vec2 pd = vec2(0.8, 0.8) + 0.15 * vec2(cos(t * 1.0 + 1.0), sin(t * 0.6));
  vec4 d = vec4(distance(w, pa), distance(w, pb), distance(w, pc), distance(w, pd));
  vec4 k = 1.0 / (d * d + 0.02);
  k /= dot(k, vec4(1.0));
  vec3 ab = oklabMix(uColorA, uColorB, k.y / max(k.x + k.y, 1e-4));
  vec3 cd = oklabMix(uColorC, uColorD, k.w / max(k.z + k.w, 1e-4));
  vec3 col = oklabMix(ab, cd, k.z + k.w);
  col += (hash12(fragCoord + fract(iTime) * 100.0) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Sunset", values: { uColorA: [1, 0.42, 0.42], uColorB: [1, 0.85, 0.24], uColorC: [0.9, 0.3, 0.6], uColorD: [0.36, 0.2, 0.7] } },
    { name: "Lagoon", values: { uColorA: [0.0, 0.6, 0.7], uColorB: [0.5, 0.95, 0.85], uColorC: [0.1, 0.3, 0.6], uColorD: [0.85, 0.95, 1] } },
    { name: "Mono", values: { uColorA: [0.1, 0.1, 0.12], uColorB: [0.3, 0.3, 0.34], uColorC: [0.2, 0.2, 0.24], uColorD: [0.6, 0.6, 0.65] } },
  ],
};

export const conicSweep: ShaderEffect = {
  kind: "shader",
  id: "conic-sweep",
  name: "Conic sweep",
  description: "A rotating conic gradient with a soft glowing core.",
  category: "gradient",
  tags: ["background", "spotlight", "brand"],
  loop: 10,
  source: glsl(
    `// Conic sweep: a rotating conic gradient with a glowing core.
uniform vec3 uColorA;  // @control color default=#0EA5E9 label="Colour A"
uniform vec3 uColorB;  // @control color default=#A855F7 label="Colour B"
uniform vec3 uColorC;  // @control color default=#F43F5E label="Colour C"
uniform float uTurns;  // @control min=-3 max=3 default=1 step=1 label="Turns per loop"
uniform float uCore;   // @control min=0 max=1 default=0.4 label="Core glow"
uniform vec2 uCenter;  // @control min=-0.5 max=0.5 default=0,0 label="Centre"`,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y - uCenter;
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  a = fract(a + iTime * uTurns / 10.0);
  float s = a * 3.0;
  vec3 col = s < 1.0 ? oklabMix(uColorA, uColorB, s)
           : s < 2.0 ? oklabMix(uColorB, uColorC, s - 1.0)
                     : oklabMix(uColorC, uColorA, s - 2.0);
  float r = length(p);
  col *= 0.75 + 0.25 * smoothstep(0.9, 0.0, r);
  col += uCore * exp(-r * 6.0);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const silk: ShaderEffect = {
  kind: "shader",
  id: "silk",
  name: "Silk",
  description: "Folds of glossy fabric rippling in a slow breeze.",
  category: "gradient",
  tags: ["background", "luxury", "soft"],
  source: glsl(
    `// Silk: glossy folds of fabric rippling slowly.
uniform vec3 uBase;      // @control color default=#3B0764 label="Base"
uniform vec3 uSheen;     // @control color default=#F0ABFC label="Sheen"
uniform float uSpeed;    // @control min=0 max=2 default=0.4 label="Speed"
uniform float uFolds;    // @control min=1 max=10 default=5 label="Folds"
uniform float uGloss;    // @control min=0 max=2 default=1 label="Gloss"`,
    ROTATE,
    `float folds(vec2 p, float t) {
  float h = 0.0;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    h += sin(p.x * uFolds * fi * 0.7 + t * (1.0 + 0.3 * fi) + sin(p.y * 2.0 * fi + t)) / fi;
  }
  return h;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = rot(0.6) * (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed;
  float e = 0.002;
  float hx = (folds(p + vec2(e, 0.0), t) - folds(p - vec2(e, 0.0), t)) / (2.0 * e);
  float hy = (folds(p + vec2(0.0, e), t) - folds(p - vec2(0.0, e), t)) / (2.0 * e);
  vec3 n = normalize(vec3(-hx * 0.12, -hy * 0.12, 1.0));
  vec3 l = normalize(vec3(-0.4, 0.6, 0.7));
  float diff = clamp(dot(n, l), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 20.0) * uGloss;
  vec3 col = uBase * (0.35 + 0.9 * diff) + uSheen * (spec + 0.12 * pow(diff, 6.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Champagne", values: { uBase: [0.55, 0.42, 0.25], uSheen: [1, 0.95, 0.8] } },
    { name: "Midnight", values: { uBase: [0.04, 0.08, 0.2], uSheen: [0.6, 0.75, 1] } },
  ],
};

export const duotoneFlow: ShaderEffect = {
  kind: "shader",
  id: "gradient-flow",
  name: "Gradient flow",
  description: "Two colours flowing through each other along a warped noise field.",
  category: "gradient",
  tags: ["background", "brand", "liquid"],
  source: glsl(
    `// Gradient flow: two colours flowing through a warped noise field.
uniform vec3 uColorA;   // @control color default=#1E3A8A label="Colour A"
uniform vec3 uColorB;   // @control color default=#F97316 label="Colour B"
uniform float uSpeed;   // @control min=0 max=2 default=0.25 label="Speed"
uniform float uScale;   // @control min=0.5 max=6 default=2 label="Scale"
uniform float uContrast; // @control min=0.5 max=4 default=1.5 label="Contrast"`,
    HASH,
    NOISE,
    FBM,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed;
  vec2 q = vec2(fbm(p + t, 4), fbm(p + vec2(5.2, 1.3) - t, 4));
  float f = fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.5 * t, 5);
  f = clamp((f - 0.5) * uContrast + 0.5, 0.0, 1.0);
  fragColor = vec4(oklabMix(uColorA, uColorB, smoothstep(0.0, 1.0, f)), 1.0);
}`,
  ),
};
