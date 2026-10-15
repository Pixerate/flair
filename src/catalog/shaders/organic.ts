import { FBM, glsl, HASH, NOISE, PALETTE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const marble: ShaderEffect = {
  kind: "shader",
  id: "marble",
  name: "Liquid marble",
  description: "Veined marble swirling like ink in water (domain-warped noise).",
  category: "organic",
  tags: ["background", "ink", "liquid", "luxury"],
  source: glsl(
    `// Liquid marble: domain-warped noise swirling like ink in water.
uniform vec3 uStone;    // @control color default=#F5F1E8 label="Stone"
uniform vec3 uVein;     // @control color default=#1F2937 label="Vein"
uniform vec3 uAccent;   // @control color default=#B08D57 label="Accent"
uniform float uSpeed;   // @control min=0 max=1 default=0.15 label="Speed"
uniform float uScale;   // @control min=0.5 max=6 default=2.5 label="Scale"
uniform float uWarp;    // @control min=0 max=8 default=4 label="Warp"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed;
  vec2 q = vec2(fbm(p + vec2(0.0, t), 5), fbm(p + vec2(5.2, 1.3 - t), 5));
  vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7, 9.2) + 0.3 * t, 5), fbm(p + uWarp * q + vec2(8.3, 2.8), 5));
  float f = fbm(p + uWarp * r, 5);
  float vein = 1.0 - smoothstep(0.0, 0.06, abs(sin(f * 12.0 + r.x * 6.0)));
  vec3 col = mix(uStone, uStone * 0.85, length(q) * 0.6);
  col = mix(col, uAccent, smoothstep(0.55, 0.9, r.y) * 0.5);
  col = mix(col, uVein, vein * 0.85);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Nero", values: { uStone: [0.08, 0.08, 0.09], uVein: [0.9, 0.88, 0.82], uAccent: [0.7, 0.55, 0.3] } },
    { name: "Jade", values: { uStone: [0.18, 0.45, 0.35], uVein: [0.85, 0.95, 0.88], uAccent: [0.05, 0.2, 0.15] } },
  ],
};

export const smoke: ShaderEffect = {
  kind: "shader",
  id: "smoke",
  name: "Smoke",
  description: "Billowing smoke or cloud drifting upwards.",
  category: "organic",
  tags: ["background", "atmosphere", "cloud", "mist"],
  source: glsl(
    `// Smoke: billowing fractal noise drifting upwards.
uniform vec3 uBackground; // @control color default=#0B0F19 label="Background"
uniform vec3 uSmoke;      // @control color default=#CBD5E1 label="Smoke"
uniform float uSpeed;     // @control min=0 max=2 default=0.3 label="Speed"
uniform float uDensity;   // @control min=0 max=2 default=1 label="Density"
uniform int uDetail;      // @control min=1 max=8 default=6 label="Detail"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * 3.0;
  float t = iTime * uSpeed;
  p.y -= t;
  float n = fbm(p + fbm(p + vec2(t * 0.3, 0.0), uDetail), uDetail);
  float body = smoothstep(0.35, 0.85, n) * uDensity;
  float fade = smoothstep(0.0, 0.7, fragCoord.y / iResolution.y + 0.2);
  vec3 col = mix(uBackground, uSmoke, clamp(body * fade, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const lavaLamp: ShaderEffect = {
  kind: "shader",
  id: "lava-lamp",
  name: "Lava lamp",
  description: "Soft metaballs merging and parting as they rise and fall.",
  category: "organic",
  tags: ["background", "playful", "blobs", "retro"],
  source: glsl(
    `// Lava lamp: metaballs merging as they rise and fall.
uniform vec3 uBackground; // @control color default=#1A0B2E label="Background"
uniform vec3 uBlobA;      // @control color default=#FF5E8A label="Blob A"
uniform vec3 uBlobB;      // @control color default=#FFB347 label="Blob B"
uniform int uCount;       // @control min=2 max=12 default=7 label="Blobs"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"
uniform float uSize;      // @control min=0.02 max=0.3 default=0.12 label="Size"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  float field = 0.0;
  float tint = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 seed = hash22(vec2(fi, 7.0));
    vec2 c = vec2(seed.x * aspect, 0.5 + 0.45 * sin(t * (0.4 + seed.y) + fi * 2.1));
    c.x += 0.1 * sin(t * 0.7 + fi);
    float r = uSize * (0.7 + 0.6 * seed.y);
    float k = r * r / dot(p - c, p - c);
    field += k;
    tint += k * seed.x;
  }
  float inside = smoothstep(0.9, 1.1, field);
  vec3 blob = mix(uBlobA, uBlobB, clamp(tint / max(field, 1e-3), 0.0, 1.0));
  blob *= 0.85 + 0.15 * smoothstep(1.0, 3.0, field);
  vec3 col = mix(uBackground, blob, inside);
  col += blob * 0.15 * smoothstep(0.3, 0.9, field) * (1.0 - inside);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const plasma: ShaderEffect = {
  kind: "shader",
  id: "plasma",
  name: "Plasma",
  description: "The demoscene classic: interfering sine waves through a colour palette.",
  category: "organic",
  tags: ["background", "retro", "psychedelic", "loop"],
  loop: 6.28318,
  source: glsl(
    `// Plasma: interfering sine waves through a cosine palette.
uniform float uScale;   // @control min=1 max=20 default=8 label="Scale"
uniform float uShift;   // @control min=0 max=1 default=0 label="Hue shift"
uniform vec3 uPhase;    // @control min=0 max=1 default=0,0.33,0.67 label="Palette phase"`,
    PALETTE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * uScale;
  float t = iTime;
  float v = sin(p.x + t);
  v += sin((p.y + t) * 0.5);
  v += sin((p.x + p.y + t) * 0.5);
  vec2 c = p + vec2(sin(t * 0.5), cos(t * 0.5)) * uScale * 0.3;
  v += sin(sqrt(dot(c, c) + 1.0) + t);
  vec3 col = palette(v * 0.25 + uShift, vec3(0.5), vec3(0.5), vec3(1.0), uPhase);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const caustics: ShaderEffect = {
  kind: "shader",
  id: "caustics",
  name: "Caustics",
  description: "Light dancing on the floor of a swimming pool.",
  category: "organic",
  tags: ["background", "water", "summer", "calm"],
  source: glsl(
    `// Caustics: light dancing on the floor of a pool.
uniform vec3 uWater;    // @control color default=#0369A1 label="Water"
uniform vec3 uLight;    // @control color default=#E0F2FE label="Light"
uniform float uSpeed;   // @control min=0 max=2 default=0.5 label="Speed"
uniform float uScale;   // @control min=1 max=10 default=4 label="Scale"
uniform float uBright;  // @control min=0 max=2 default=1 label="Brightness"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed + 23.0;
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 5; n++) {
    float tn = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tn) / 0.005), p.y / (cos(i.y + tn) / 0.005)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  float light = pow(abs(c), 8.0) * uBright;
  vec3 col = uWater + uLight * clamp(light, 0.0, 1.5);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const flames: ShaderEffect = {
  kind: "shader",
  id: "flames",
  name: "Flames",
  description: "A wall of fire licking upwards from the bottom edge.",
  category: "organic",
  tags: ["fire", "energy", "hot", "overlay"],
  source: glsl(
    `// Flames: a wall of fire licking upwards.
uniform vec3 uHot;      // @control color default=#FFF3B0 label="Hot"
uniform vec3 uMid;      // @control color default=#FF7A00 label="Mid"
uniform vec3 uCool;     // @control color default=#7A0000 label="Cool"
uniform float uSpeed;   // @control min=0 max=3 default=1.2 label="Speed"
uniform float uHeight;  // @control min=0.1 max=1.5 default=0.7 label="Height"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = vec2(fragCoord.x / iResolution.y, uv.y);
  float t = iTime * uSpeed;
  float n = fbm(vec2(p.x * 4.0, p.y * 3.0 - t * 1.5), 5);
  float heat = (1.0 - uv.y / uHeight) + (n - 0.5) * 1.1;
  heat = clamp(heat, 0.0, 1.0);
  vec3 col = mix(vec3(0.0), uCool, smoothstep(0.05, 0.3, heat));
  col = mix(col, uMid, smoothstep(0.3, 0.6, heat));
  col = mix(col, uHot, smoothstep(0.6, 0.95, heat));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Spirit", values: { uHot: [0.85, 1, 1], uMid: [0.2, 0.6, 1], uCool: [0.05, 0.05, 0.4] } },
    { name: "Toxic", values: { uHot: [0.95, 1, 0.7], uMid: [0.4, 0.95, 0.2], uCool: [0.05, 0.25, 0.05] } },
  ],
};
