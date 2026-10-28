import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { TEXT_BEVEL } from "./glass.js";

/*
 * Iridescence and neon: thin-film chrome lettering and blobs, neon strands
 * swirling like dye in water, glowing neon tubes, a molten web, a prism
 * starburst and neon hyperspace streaks. Each is tagged "iridescent" or
 * "neon" (some both), so the family is easy to find together.
 */

export const iridescentText: ShaderEffect = {
  kind: "shader",
  id: "iridescent-text",
  name: "Iridescent text",
  description:
    "A title in rainbow chrome: thin-film colours swirl over bevelled letters with bright white rims, a soft rainbow halo, and star glints twinkling at the edges.",
  category: "text",
  video: "none",
  tags: ["text", "title", "iridescent", "holographic", "chrome", "rainbow", "glossy", "hero", "overlay"],
  transparent: true,
  source: glsl(
    `// Iridescent text: bevelled letters whose thin-film colour turns with the slope and drifts; glints twinkle round them.
uniform sampler2D uText;        // @control wrap=clamp default=${textImage("Flair", { width: 640 })} label="Text"
uniform vec3 uBackground;       // @control color default=#050508 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform float uSize;            // @control min=0.3 max=1 default=0.8 label="Text size"
uniform float uBevel;           // @control min=0.005 max=0.06 default=0.016 label="Bevel"
uniform float uFilm;            // @control min=0 max=3 default=1.2 label="Colour bands"
uniform float uSaturation;      // @control min=0 max=1 default=0.9 label="Saturation"
uniform float uSpeed;           // @control min=0 max=1 default=0.12 label="Drift speed"
uniform float uGloss;           // @control min=0 max=1 default=0.8 label="Gloss"
uniform float uHalo;            // @control min=0 max=1 default=0.45 label="Halo"
uniform float uGlints;          // @control min=0 max=1 default=0.7 label="Glints"`,
    HASH,
    NOISE,
    TEXT_BEVEL,
    `vec3 film(float x) {
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67)));
  return mix(vec3(dot(c, vec3(0.333))), c, uSaturation);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  float mask = textAt(p, 1.5 * px);
  vec2 s = bevelSlope(p, uBevel);
  float h = bevelHeight(p, uBevel);
  vec3 n = normalize(vec3(-s * 2.2, 1.0));
  // Thin film: the colour follows how far the surface tilts, a slow swirl of noise and a drift along the line.
  float swirl = vnoise(p * 3.0 + vec2(t, -0.6 * t)) + 0.5 * vnoise(p * 7.0 - vec2(0.4 * t, t));
  vec3 face = film(uFilm * (2.0 * (1.0 - n.z) + swirl + 1.4 * p.x) + t);
  vec3 light = normalize(vec3(-0.4, 0.6, 0.7));
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
  float rim = clamp(length(s) * 1.4, 0.0, 1.0);
  face = face * (0.75 + 0.35 * h) + uGloss * (1.2 * spec + 0.7 * pow(rim, 4.0));
  // Premultiplied layers: background, halo, glints, letters.
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  float halo = uHalo * textAt(p, 0.07) * (1.0 - mask) * 0.7;
  acc = vec4(film(p.x * 0.7 + t) * halo, halo) + acc * (1.0 - halo);
  // Glints: four-pointed stars in a coarse grid, kept near the letters, each twinkling on its own beat.
  vec2 g = p * 9.0;
  vec2 id = floor(g);
  vec2 d = fract(g) - 0.5 - 0.6 * (hash22(id) - 0.5);
  float near = smoothstep(0.02, 0.2, textAt((id + 0.5) / 9.0, 0.05)) * (1.0 - smoothstep(0.7, 0.95, textAt((id + 0.5) / 9.0, 0.02)));
  float tw = pow(max(0.0, sin(iTime * 1.7 + hash12(id + 3.1) * 6.28318)), 6.0);
  float star = (max(0.0, 1.0 - abs(d.x * d.y) * 900.0) * 0.7 + 0.004 / (dot(d, d) + 0.004)) * smoothstep(0.25, 0.0, length(d));
  float glint = clamp(uGlints * near * tw * star * step(0.45, hash12(id + 9.7)), 0.0, 1.0);
  acc = vec4(vec3(glint), glint) + acc * (1.0 - glint);
  acc = vec4(face * mask, mask) + acc * (1.0 - mask);
  fragColor = vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`,
  ),
  presets: [
    { name: "Pearl", values: { uSaturation: 0.45, uFilm: 0.8, uGloss: 1 } },
    { name: "Oil slick", values: { uFilm: 2.4, uSaturation: 1, uBevel: 0.035 } },
    { name: "No glints", values: { uGlints: 0, uHalo: 0.2 } },
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const neonFluid: ShaderEffect = {
  kind: "shader",
  id: "neon-fluid",
  name: "Neon fluid",
  description:
    "Glowing strands of violet, cyan and gold swirling like dye in water, broken into fine grains with a haze of drifting sparks.",
  category: "organic",
  tags: ["background", "neon", "fluid", "swirl", "ink", "particles", "glow", "hero"],
  source: glsl(
    `// Neon fluid: thin bands of a doubly domain-warped field, three colours in turn, grained and dusted with sparks.
uniform vec3 uColorA;     // @control color default=#B04CFF label="Colour 1"
uniform vec3 uColorB;     // @control color default=#2FE6E0 label="Colour 2"
uniform vec3 uColorC;     // @control color default=#FFB23A label="Colour 3"
uniform vec3 uBackground; // @control color default=#05040A label="Background"
uniform float uSpeed;     // @control min=0 max=1 default=0.1 label="Speed"
uniform float uScale;     // @control min=0.5 max=5 default=1.2 label="Scale"
uniform float uSwirl;     // @control min=0 max=6 default=3.5 label="Swirl"
uniform float uStrands;   // @control min=2 max=14 default=10 label="Strands"
uniform float uGlow;      // @control min=0 max=2 default=1 label="Glow"
uniform float uGrain;     // @control min=0 max=1 default=0.55 label="Grain"
uniform float uDust;      // @control min=0 max=1 default=0.5 label="Sparks"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * uScale;
  float t = iTime * uSpeed;
  vec2 q = vec2(fbm(p + vec2(0.0, t), 3), fbm(p + vec2(5.2, 1.3) - t, 3));
  vec2 r = vec2(fbm(p + uSwirl * q + vec2(1.7, 9.2) + 0.5 * t, 3), fbm(p + uSwirl * q + vec2(8.3, 2.8) - 0.3 * t, 3));
  float f = fbm(p + uSwirl * r, 2) * uStrands;
  float band = floor(f);
  float d = abs(fract(f) - 0.5) / max(fwidth(f), 1e-4);
  // Some bands carry a strand, in one of the three colours in turn.
  float on = step(0.35, hash12(vec2(band, 7.0)));
  float k = mod(band, 3.0);
  vec3 tint = k < 1.0 ? uColorA : (k < 2.0 ? uColorB : uColorC);
  float core = exp(-d * d / 5.0);
  float glow = exp(-d / 16.0);
  float grain = mix(1.0, smoothstep(0.35, 0.85, vnoise(fragCoord * 0.45 + r * 40.0)), uGrain);
  vec3 light = on * tint * (1.5 * core * grain + 0.3 * uGlow * glow);
  // Sparks: sparse bright pixels that ride the flow, thickest near the strands.
  float spark = step(0.99 - 0.04 * uDust * glow, hash12(floor(fragCoord / 2.0) + floor(r * 90.0)));
  light += uDust * spark * tint * (0.2 + 1.6 * glow) * on;
  vec3 col;
  // Light over the ground: on dark it adds, on a light ground the lines keep their own colour instead of washing out.
  col = uBackground * (1.0 - clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0)) + light;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Ice", values: { uColorA: [0.35, 0.55, 1], uColorB: [0.6, 0.95, 1], uColorC: [1, 1, 1] } },
    { name: "Ember", values: { uColorA: [1, 0.25, 0.1], uColorB: [1, 0.6, 0.15], uColorC: [1, 0.9, 0.6] } },
    { name: "Calm", values: { uSpeed: 0.04, uSwirl: 2, uStrands: 4 } },
    { name: "Light", values: { uBackground: [0.96, 0.95, 0.98], uColorA: [0.42, 0.12, 0.82], uColorB: [0, 0.55, 0.58], uColorC: [0.82, 0.48, 0], uGlow: 0.8 } },
  ],
};

export const neonWorms: ShaderEffect = {
  kind: "shader",
  id: "neon-worms",
  name: "Neon worms",
  description: "Glowing neon tubes looping and wriggling across a dark frame, their colour shifting slowly from one end of the screen to the other.",
  category: "pattern",
  tags: ["background", "neon", "glow", "line", "squiggle", "organic", "loop"],
  source: glsl(
    `// Neon worms: contour lines of drifting, warped noise, drawn as glowing tubes a fixed number of pixels wide.
uniform vec3 uColorA;     // @control color default=#C04BFF label="Colour 1"
uniform vec3 uColorB;     // @control color default=#FF4FB8 label="Colour 2"
uniform vec3 uBackground; // @control color default=#07040D label="Background"
uniform float uScale;     // @control min=0.5 max=6 default=2.4 label="Scale"
uniform float uSpeed;     // @control min=0 max=1 default=0.15 label="Speed"
uniform float uCount;     // @control min=1 max=4 default=2 label="Tubes"
uniform float uWidth;     // @control min=0.5 max=8 default=2.5 label="Tube width (px)"
uniform float uGlow;      // @control min=0 max=2 default=1 label="Glow"`,
    HASH,
    NOISE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed;
  vec2 w = vec2(vnoise(p * 1.3 + vec2(t, 0.0)), vnoise(p * 1.3 + vec2(4.0, -t)));
  float n = 0.65 * vnoise(p + 0.9 * w + 0.3 * t) + 0.35 * vnoise(p * 2.1 - w + vec2(0.0, 0.4 * t));
  float f = n * uCount * 2.0;
  float d = abs(fract(f) - 0.5) / max(fwidth(f), 1e-4);
  float x = fragCoord.x / iResolution.x;
  vec3 tint = mix(uColorA, uColorB, 0.5 + 0.5 * sin(6.28318 * (x * 0.6 + n) + t * 2.0));
  float tube = smoothstep(uWidth, uWidth * 0.3, d);
  float glow = uGlow * exp(-d / (uWidth * 3.5));
  vec3 light = tint * (0.55 * glow + tube) + vec3(1.0) * 0.6 * smoothstep(uWidth * 0.45, 0.0, d);
  vec3 col;
  // Light over the ground: on dark it adds, on a light ground the lines keep their own colour instead of washing out.
  col = uBackground * (1.0 - clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0)) + light;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Acid", values: { uColorA: [0.55, 1, 0.2], uColorB: [0.1, 0.9, 0.8] } },
    { name: "Thin", values: { uWidth: 1, uCount: 3, uGlow: 0.6 } },
    { name: "Fat tubes", values: { uWidth: 6, uCount: 1, uScale: 1.6 } },
    { name: "Light", values: { uBackground: [0.96, 0.95, 0.98], uColorA: [0.48, 0.13, 0.88], uColorB: [0.88, 0.14, 0.48] } },
  ],
};

export const moltenWeb: ShaderEffect = {
  kind: "shader",
  id: "molten-web",
  name: "Molten web",
  description: "A web of white-hot ridges glowing orange through dark cooled rock, slowly drifting and flickering like cracked lava.",
  category: "organic",
  tags: ["background", "lava", "molten", "fire", "glow", "gold", "cracks"],
  source: glsl(
    `// Molten web: warped ridged noise, its ridges mapped from cooled rock through orange to white heat.
uniform vec3 uHot;        // @control color default=#FFE7A0 label="White heat"
uniform vec3 uGlowColor;  // @control color default=#FF7A0A label="Glow"
uniform vec3 uRock;       // @control color default=#120402 label="Rock"
uniform float uScale;     // @control min=0.5 max=8 default=3.5 label="Scale"
uniform float uSpeed;     // @control min=0 max=1 default=0.12 label="Speed"
uniform float uSharpness; // @control min=1 max=16 default=9 label="Ridge sharpness"
uniform float uFlicker;   // @control min=0 max=1 default=0.35 label="Flicker"`,
    HASH,
    NOISE,
    `float ridge(vec2 p) {
  return 1.0 - abs(2.0 * vnoise(p) - 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed;
  vec2 w = vec2(vnoise(p * 0.7 + t), vnoise(p * 0.7 + vec2(3.7, -t)));
  p += 0.8 * w;
  float r = 0.65 * pow(ridge(p + vec2(0.0, t * 0.5)), uSharpness) + 0.35 * pow(ridge(p * 2.03 + 11.0 - t * 0.3), uSharpness * 1.4);
  r *= 1.0 - uFlicker * 0.5 * vnoise(p * 1.5 + iTime * 1.3);
  vec3 col = mix(uRock, uGlowColor, smoothstep(0.05, 0.55, r));
  col = mix(col, uHot, smoothstep(0.55, 0.95, r));
  col += uGlowColor * 0.25 * smoothstep(0.0, 0.4, r);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Plasma", values: { uHot: [0.9, 0.95, 1], uGlowColor: [0.65, 0.3, 1], uRock: [0.03, 0.01, 0.08] } },
    { name: "Light", values: { uRock: [0.97, 0.94, 0.9], uGlowColor: [1, 0.48, 0.04], uHot: [0.64, 0.09, 0.04] } },
    { name: "Gold leaf", values: { uHot: [1, 0.95, 0.75], uGlowColor: [0.85, 0.6, 0.2], uFlicker: 0, uSharpness: 14 } },
  ],
};

export const prismBurst: ShaderEffect = {
  kind: "shader",
  id: "prism-burst",
  name: "Prism burst",
  description: "Rainbow rays fanning out from a white-hot core, slowly turning and shimmering, like light split through a prism.",
  category: "light",
  tags: ["background", "rays", "starburst", "rainbow", "spectrum", "iridescent", "hero", "glow"],
  source: glsl(
    `// Prism burst: rays from noise read round a circle (so there is no seam), tinted by angle, over a glowing core.
uniform vec3 uBackground; // @control color default=#06050C label="Background"
uniform vec2 uCenter;     // @control min=-0.5 max=0.5 default=0,0 label="Centre"
uniform float uRays;      // @control min=2 max=40 default=14 label="Rays"
uniform float uSharpness; // @control min=1 max=8 default=3 label="Ray sharpness"
uniform float uSpin;      // @control min=-1 max=1 default=0.05 label="Spin"
uniform float uSaturation; // @control min=0 max=1 default=0.85 label="Saturation"
uniform float uCore;      // @control min=0 max=2 default=1 label="Core"
uniform float uReach;     // @control min=0.2 max=2 default=0.9 label="Reach"`,
    HASH,
    NOISE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y - uCenter;
  float r = length(p);
  float a = atan(p.y, p.x) + iTime * uSpin;
  vec2 dir = vec2(cos(a), sin(a));
  float n = 0.6 * vnoise(dir * uRays * 0.5 + iTime * 0.15) + 0.4 * vnoise(dir * uRays * 1.3 - iTime * 0.1 + 7.0);
  float rays = pow(n, uSharpness) * 2.2;
  vec3 hue = 0.5 + 0.5 * cos(a * 2.0 + vec3(0.0, 2.1, 4.2) + iTime * 0.2);
  hue = mix(vec3(dot(hue, vec3(0.333))), hue, uSaturation);
  float fall = exp(-r / uReach);
  vec3 light = hue * rays * fall * smoothstep(0.0, 0.08, r) * 1.4;
  light += uCore * (vec3(1.0, 0.97, 0.92) * 0.012 / (r * r + 0.004) * 0.15 + hue * 0.25 * exp(-r * 6.0));
  vec3 col;
  // Light over the ground: on dark it adds, on a light ground the lines keep their own colour instead of washing out.
  col = uBackground * (1.0 - clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0)) + light;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Teal sun", values: { uSaturation: 0.3, uRays: 22, uBackground: [0.02, 0.08, 0.09] } },
    { name: "Corner flare", values: { uCenter: [-0.45, 0.3], uReach: 1.6, uRays: 9 } },
    { name: "Soft", values: { uSharpness: 1.5, uCore: 0.5 } },
    { name: "Light", values: { uBackground: [0.97, 0.96, 0.98], uSharpness: 1.5, uCore: 0.5, uSaturation: 1 } },
  ],
};

export const neonWarp: ShaderEffect = {
  kind: "shader",
  id: "neon-warp",
  name: "Neon warp",
  description: "Pink and cyan light streaks rushing out from a dark centre, as if jumping to hyperspace, leaving room in the middle for a title.",
  category: "space",
  tags: ["background", "neon", "warp", "hyperspace", "speed", "streak", "retro", "hero"],
  source: glsl(
    `// Neon warp: in each of a few rings of angular slots, a streak rides outward, lengthening and brightening as it goes.
uniform vec3 uColorA;     // @control color default=#FF3EA5 label="Colour 1"
uniform vec3 uColorB;     // @control color default=#35D6FF label="Colour 2"
uniform vec3 uBackground; // @control color default=#070313 label="Background"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"
uniform float uDensity;   // @control min=20 max=200 default=90 label="Streaks"
uniform float uLength;    // @control min=0.05 max=1 default=0.35 label="Streak length"
uniform float uClear;     // @control min=0 max=0.5 default=0.18 label="Clear centre"
uniform float uWidth;     // @control min=0.5 max=4 default=1.4 label="Streak width (px)"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float r = length(p);
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  vec3 light = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float count = floor(uDensity * (1.0 + 0.37 * fl));
    float slot = floor(a * count + fl * 0.37);
    float h = hash12(vec2(slot, fl * 13.0 + 1.0));
    // Where the streak's head is: 0 at the centre to past the corner, faster the further out it gets.
    float z = fract(h * 7.0 + iTime * uSpeed * (0.5 + h));
    float head = uClear + z * z * 1.3;
    float len = uLength * (0.2 + z);
    float along = smoothstep(head - len, head, r) * step(r, head);
    float across = abs(fract(a * count + fl * 0.37) - 0.5) / count * 6.28318 * r * iResolution.y;
    float line = smoothstep(uWidth, 0.0, across) * along * smoothstep(0.0, 0.15, z) * step(0.35, h);
    vec3 tint = mix(uColorA, uColorB, step(0.5, hash12(vec2(slot, fl + 5.0))));
    light += tint * line * (0.6 + 1.2 * z);
  }
  light += mix(uColorA, uColorB, 0.5) * 0.12 * exp(-pow(r - uClear, 2.0) * 40.0);
  vec3 col;
  // Light over the ground: on dark it adds, on a light ground the lines keep their own colour instead of washing out.
  col = uBackground * (1.0 - clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0)) + light;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Classic white", values: { uColorA: [1, 1, 1], uColorB: [0.75, 0.85, 1], uBackground: [0, 0, 0.02] } },
    { name: "Cruise", values: { uSpeed: 0.15, uLength: 0.12, uDensity: 60 } },
    { name: "Full screen", values: { uClear: 0 } },
    { name: "Light", values: { uBackground: [0.97, 0.96, 0.98], uColorA: [0.88, 0.09, 0.44], uColorB: [0.04, 0.56, 0.79], uWidth: 1.8 } },
  ],
};

export const iridescentBlobs: ShaderEffect = {
  kind: "shader",
  id: "iridescent-blobs",
  name: "Iridescent blobs",
  description: "Glossy blobs of liquid chrome with an oil-slick sheen, slowly merging and pulling apart on a dark ground.",
  category: "organic",
  tags: ["background", "iridescent", "holographic", "chrome", "liquid", "blob", "glossy", "y2k"],
  source: glsl(
    `// Iridescent blobs: the high ground of drifting noise, lit as a glossy surface whose thin-film colour follows its tilt.
uniform vec3 uBackground; // @control color default=#060608 label="Background"
uniform float uScale;     // @control min=0.5 max=8 default=3.4 label="Scale"
uniform float uSpeed;     // @control min=0 max=1 default=0.12 label="Speed"
uniform float uAmount;    // @control min=0 max=1 default=0.5 label="Amount"
uniform float uFilm;      // @control min=0 max=3 default=1.4 label="Colour bands"
uniform float uSaturation; // @control min=0 max=1 default=0.8 label="Saturation"
uniform float uGloss;     // @control min=0 max=1 default=0.8 label="Gloss"`,
    HASH,
    NOISE,
    `float field(vec2 p, float t) {
  return 0.6 * vnoise(p + vec2(t, 0.3 * t)) + 0.4 * vnoise(p * 1.9 + vec2(-0.5 * t, t) + 5.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float t = iTime * uSpeed;
  float level = mix(0.68, 0.4, uAmount);
  float f = field(p, t);
  float e = 0.01;
  vec2 grad = vec2(field(p + vec2(e, 0.0), t) - f, field(p + vec2(0.0, e), t) - f) / e;
  float inside = f - level;
  float aa = fwidth(f);
  float mask = smoothstep(-aa, aa, inside);
  // A rounded surface, the height going as the square root of how far inside: steep at the edge, easing over the top.
  vec3 n = normalize(vec3(-grad * 0.3 / sqrt(max(inside, 2e-3)), 1.0));
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (uFilm * (1.6 * (1.0 - n.z) + 0.6 * dot(n.xy, vec2(0.7, 0.4)) + 0.4 * f) + t + vec3(0.0, 0.33, 0.67)));
  c = mix(vec3(dot(c, vec3(0.333))), c, uSaturation);
  vec3 light = normalize(vec3(-0.5, 0.6, 0.65));
  float facing = max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0);
  float spec = pow(facing, 60.0) + 0.25 * pow(facing, 6.0);
  // Chrome: the colour is a reflection, bright where the surface faces up into the sky, dark where it turns to the ground.
  float sky = smoothstep(-0.5, 0.6, n.y + 0.3 * n.z);
  vec3 blob = c * (0.25 + 0.85 * sky) + uGloss * spec * 1.3;
  vec3 col = uBackground * (1.0 - 0.6 * smoothstep(0.0, -0.08, inside) * step(inside, 0.0));
  fragColor = vec4(mix(col, blob, mask), 1.0);
}`,
  ),
  presets: [
    { name: "Pearl", values: { uSaturation: 0.35, uBackground: [0.9, 0.9, 0.93] } },
    { name: "Bubbles", values: { uAmount: 0.2, uScale: 3.5 } },
    { name: "Flood", values: { uAmount: 0.85, uScale: 1.4 } },
  ],
};

/** Iridescent and neon effects recreated from the Flair launch film: text, fluid, worms, a molten web, a prism burst, a warp and blobs. */
export const iridescentShaders: ShaderEffect[] = [iridescentText, neonFluid, neonWorms, moltenWeb, prismBurst, neonWarp, iridescentBlobs];
