import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const bokeh: ShaderEffect = {
  kind: "shader",
  id: "bokeh",
  name: "Bokeh",
  description: "Out-of-focus city lights drifting softly.",
  category: "light",
  tags: ["background", "festive", "dreamy", "night", "overlay"],
  transparent: true,
  source: glsl(
    `// Bokeh: soft out-of-focus lights drifting.
uniform vec3 uBackground;       // @control color default=#0B1026 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform vec3 uWarm;             // @control color default=#FFC56E label="Warm light"
uniform vec3 uCool;             // @control color default=#6EC8FF label="Cool light"
uniform int uCount;             // @control min=4 max=60 default=30 label="Lights"
uniform float uSize;            // @control min=0.02 max=0.25 default=0.08 label="Size"
uniform float uSpeed;           // @control min=0 max=1 default=0.15 label="Drift"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec3 col = uBackground * (0.7 + 0.3 * fragCoord.y / iResolution.y) * uBackgroundAlpha;
  float lightAlpha = 0.0;
  for (int i = 0; i < 60; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 3.1));
    float depth = hash12(vec2(fi, 9.7));
    vec2 c = vec2(fract(h.x + iTime * uSpeed * (0.2 + depth) * 0.1) * (aspect + 0.4) - 0.2, h.y);
    c.y += 0.03 * sin(iTime * 0.5 + fi);
    float r = uSize * (0.5 + depth);
    float d = length(p - c);
    float disc = smoothstep(r, r * 0.85, d) * (0.6 + 0.4 * smoothstep(r * 0.4, r, d));
    vec3 light = mix(uWarm, uCool, step(0.5, hash12(vec2(fi, 1.3))));
    float weight = disc * (0.15 + 0.25 * (1.0 - depth));
    col += light * weight;
    lightAlpha += weight;
  }
  float a = clamp(uBackgroundAlpha + lightAlpha * (1.0 - uBackgroundAlpha), 0.0, 1.0);
  fragColor = vec4(col, a);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const godRays: ShaderEffect = {
  kind: "shader",
  id: "god-rays",
  name: "God rays",
  description: "Shafts of light fanning down through haze.",
  category: "light",
  tags: ["background", "hero", "heavenly", "spotlight"],
  source: glsl(
    `// God rays: shafts of light fanning through haze.
uniform vec3 uBackground; // @control color default=#0C0A09 label="Background"
uniform vec3 uLight;      // @control color default=#FDE68A label="Light"
uniform vec2 uSource;     // @control min=-1 max=1 default=0,0.6 label="Source"
uniform float uRays;      // @control min=4 max=60 default=18 label="Rays"
uniform float uSpeed;     // @control min=0 max=2 default=0.3 label="Speed"
uniform float uStrength;  // @control min=0 max=2 default=1 label="Strength"`,
    HASH,
    NOISE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 d = p - uSource * vec2(iResolution.x / iResolution.y, 1.0) * 0.5;
  float a = atan(d.x, -d.y);
  float r = length(d);
  float t = iTime * uSpeed;
  float rays = vnoise(vec2(a * uRays, t)) * 0.6 + vnoise(vec2(a * uRays * 2.3, -t * 1.3)) * 0.4;
  rays = pow(rays, 2.0) * smoothstep(1.6, 0.0, r);
  float glow = exp(-r * 4.0);
  vec3 col = uBackground + uLight * (rays * 0.9 + glow * 0.8) * uStrength;
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const sparkles: ShaderEffect = {
  kind: "shader",
  id: "sparkles",
  name: "Sparkles",
  description: "Four-pointed glints twinkling on and off across the frame.",
  category: "light",
  tags: ["overlay", "magic", "celebration", "premium"],
  transparent: true,
  source: glsl(
    `// Sparkles: four-pointed glints twinkling across the frame.
uniform vec3 uBackground;       // @control color default=#1E1B4B label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform vec3 uSparkle;          // @control color default=#FFFFFF label="Sparkle"
uniform float uDensity;         // @control min=2 max=30 default=10 label="Density"
uniform float uChance;          // @control min=0.02 max=1 default=1 label="Sparsity"
uniform float uSize;            // @control min=0.05 max=0.5 default=0.35 label="Size"
uniform float uSpeed;           // @control min=0 max=4 default=1 label="Twinkle speed"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uDensity;
  float glint = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    vec2 q = p * (1.0 + float(layer) * 0.6) + float(layer) * 7.3;
    vec2 id = floor(q);
    float keep = step(1.0 - uChance, hash12(id + 19.0 + float(layer) * 31.0));
    vec2 f = fract(q) - 0.5;
    vec2 o = hash22(id) - 0.5;
    vec2 d = f - o * 0.6;
    float phase = hash12(id + 4.0) * 6.28318;
    float tw = pow(max(0.0, sin(iTime * uSpeed * 2.0 + phase)), 4.0);
    float r = length(d);
    float rays = max(0.0, 1.0 - abs(d.x * d.y) * 3000.0);
    float core = 0.01 / (r + 0.01);
    float star = (rays * 0.8 + core) * smoothstep(uSize, 0.0, r) * tw * keep;
    glint += star;
  }
  vec3 col = uBackground * uBackgroundAlpha + uSparkle * glint;
  float a = clamp(uBackgroundAlpha + glint * (1.0 - uBackgroundAlpha), 0.0, 1.0);
  fragColor = vec4(col, a);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const neonRipple: ShaderEffect = {
  kind: "shader",
  id: "neon-ripple",
  name: "Neon ripple",
  description: "Glowing neon rings radiating out from the pointer or the centre.",
  category: "light",
  tags: ["interactive", "glow", "music", "pulse"],
  loop: 2,
  source: glsl(
    `// Neon ripple: glowing rings radiating from the pointer (or the centre).
uniform vec3 uBackground; // @control color default=#09090B label="Background"
uniform vec3 uNeon;       // @control color default=#FF2BD6 label="Neon"
uniform float uRings;     // @control min=1 max=10 default=4 label="Rings"
uniform float uWidth;     // @control min=0.002 max=0.05 default=0.01 label="Width"
uniform float uGlow;      // @control min=0 max=3 default=1 label="Glow"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 centre = iMouse.z > 0.0 ? iMouse.xy : 0.5 * iResolution.xy;
  float r = length(fragCoord - centre) / iResolution.y;
  float phase = fract(r * uRings - iTime * 0.5);
  float ringDist = min(phase, 1.0 - phase) / uRings;
  float fade = smoothstep(1.2, 0.0, r);
  float core = smoothstep(uWidth, 0.0, ringDist);
  float glow = uWidth * 2.0 / (ringDist + uWidth) * 0.25 * uGlow;
  vec3 col = uBackground + uNeon * (core + glow) * fade;
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const starfield: ShaderEffect = {
  kind: "shader",
  id: "starfield",
  name: "Warp starfield",
  description: "Flying through a field of stars, from cruising to warp speed.",
  category: "space",
  tags: ["background", "space", "speed", "sci-fi"],
  source: glsl(
    `// Warp starfield: flying through layers of stars.
uniform vec3 uBackground; // @control color default=#000005 label="Background"
uniform vec3 uStar;       // @control color default=#E0E7FF label="Star"
uniform float uSpeed;     // @control min=0 max=4 default=0.6 label="Speed"
uniform float uStreak;    // @control min=0 max=1 default=0.3 label="Streak"
uniform int uLayers;      // @control min=1 max=8 default=5 label="Layers"`,
    HASH,
    ROTATE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 col = uBackground;
  float n = float(uLayers);
  for (int i = 0; i < 8; i++) {
    if (i >= uLayers) break;
    float depth = fract(float(i) / n + iTime * uSpeed * 0.1);
    float scale = mix(20.0, 0.5, depth);
    float fade = depth * smoothstep(1.0, 0.85, depth);
    vec2 q = rot(float(i) * 1.7) * p * scale + float(i) * 13.1;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 o = hash22(id) - 0.5;
    vec2 d = f - o * 0.8;
    vec2 dir = normalize(p + 1e-4);
    float along = dot(d, dir);
    float across = length(d - dir * along);
    float len = 0.02 + uStreak * depth * 0.4;
    float star = smoothstep(0.03, 0.0, across) * smoothstep(len, 0.0, abs(along));
    star *= step(0.6, hash12(id + 2.0));
    col += uStar * star * fade * 1.5;
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const nebula: ShaderEffect = {
  kind: "shader",
  id: "nebula",
  name: "Nebula",
  description: "Glowing gas clouds and stars drifting in deep space.",
  category: "space",
  tags: ["background", "space", "cosmic", "hero"],
  source: glsl(
    `// Nebula: glowing gas clouds over a field of stars.
uniform vec3 uGasA;     // @control color default=#7C3AED label="Gas A"
uniform vec3 uGasB;     // @control color default=#EC4899 label="Gas B"
uniform vec3 uDeep;     // @control color default=#020010 label="Deep space"
uniform float uSpeed;   // @control min=0 max=1 default=0.05 label="Drift"
uniform float uDensity; // @control min=0 max=2 default=1 label="Density"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * 2.0;
  float t = iTime * uSpeed;
  vec2 q = vec2(fbm(p + t, 5), fbm(p - t + 3.3, 5));
  float gas = fbm(p * 1.3 + 2.5 * q, 6);
  float dust = smoothstep(0.45, 0.75, fbm(p * 3.0 - q, 5));
  vec3 col = uDeep;
  col += uGasA * smoothstep(0.35, 0.8, gas) * uDensity;
  col += uGasB * smoothstep(0.5, 0.9, gas * q.x * 1.6) * uDensity;
  col *= 1.0 - 0.6 * dust;
  float star = step(0.996, hash12(floor(fragCoord)));
  float bright = step(0.9993, hash12(floor(fragCoord * 0.5) + 7.0));
  col += vec3(star * 0.7 + bright * (0.8 + 0.2 * sin(iTime * 4.0 + fragCoord.x)));
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const blackHole: ShaderEffect = {
  kind: "shader",
  id: "event-horizon",
  name: "Event horizon",
  description: "A glowing accretion disc swirling into a black hole.",
  category: "space",
  tags: ["space", "dramatic", "vortex", "hero"],
  source: glsl(
    `// Event horizon: an accretion disc swirling into a black hole.
uniform vec3 uHot;      // @control color default=#FFE4B5 label="Hot"
uniform vec3 uDisc;     // @control color default=#FF6A00 label="Disc"
uniform float uRadius;  // @control min=0.05 max=0.4 default=0.15 label="Horizon"
uniform float uSpin;    // @control min=0 max=4 default=1 label="Spin"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  p.y *= 2.2;
  float r = length(p);
  float a = atan(p.y, p.x);
  float swirl = a + uSpin * iTime * 0.5 + 1.5 / (r + 0.05);
  float streaks = fbm(vec2(swirl * 3.0, r * 8.0), 5);
  float disc = smoothstep(uRadius, uRadius * 1.6, r) * smoothstep(1.0, uRadius * 1.6, r);
  vec3 col = mix(uDisc, uHot, smoothstep(0.5, 0.9, streaks) * smoothstep(0.6, 0.1, r));
  col *= disc * (0.4 + 1.2 * streaks);
  col += uHot * 0.6 * exp(-abs(r - uRadius * 1.05) * 60.0);
  col *= smoothstep(uRadius * 0.95, uRadius * 1.05, r);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const lightRibbons: ShaderEffect = {
  kind: "shader",
  id: "light-ribbons",
  name: "Light ribbons",
  description: "A bundle of thin iridescent light strands weaving across a dark frame.",
  category: "light",
  tags: ["background", "hero", "tech", "iridescent", "flow"],
  source: glsl(
    `// Light ribbons: thin glowing strands weaving across the frame, shading from one colour to the next.
uniform vec3 uBackground; // @control color default=#05060D label="Background"
uniform vec3 uColorA;     // @control color default=#4FD1FF label="Colour A"
uniform vec3 uColorB;     // @control color default=#B06BFF label="Colour B"
uniform vec3 uColorC;     // @control color default=#FF7AC6 label="Colour C"
uniform float uCount;     // @control min=2 max=24 default=12 step=1 label="Strands"
uniform float uSpread;    // @control min=0.02 max=0.6 default=0.18 label="Spread"
uniform float uWave;      // @control min=0 max=0.5 default=0.22 label="Wave"
uniform float uTilt;      // @control min=-1 max=1 default=0.3 label="Tilt"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"
uniform float uGlow;      // @control min=0 max=2 default=1 label="Glow"`,
    `// Three colours round a loop, so the shading drifts without a seam.
vec3 shade(float g) {
  g = fract(g) * 3.0;
  return g < 1.0 ? mix(uColorA, uColorB, g) : g < 2.0 ? mix(uColorB, uColorC, g - 1.0) : mix(uColorC, uColorA, g - 2.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = iTime * uSpeed;
  float halfWidth = 0.5 * iResolution.x / iResolution.y;
  float x = p.x;
  float y = p.y - x * uTilt;
  // The bundle pinches and opens along its length, like ribbons twisting.
  float pinch = 0.35 + 0.65 * abs(sin(x * 1.3 - t * 0.7));
  vec3 light = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    if (float(i) >= uCount) break;
    float f = float(i) / max(uCount - 1.0, 1.0) - 0.5;
    float centre = f * uSpread * pinch
      + uWave * (0.6 * sin(x * 1.7 + t + f * 2.0) + 0.3 * sin(x * 3.3 - t * 1.3 + f * 5.0));
    float d = abs(y - centre);
    float core = 1.0 - smoothstep(0.0, px * 1.5, d);
    float glow = uGlow * 0.006 / (d + 0.006);
    light += shade(f * 0.6 + x * 0.12 + t * 0.05) * (core * 0.9 + glow * 0.4);
  }
  light *= 1.0 - 0.75 * pow(min(abs(x) / halfWidth, 1.0), 2.0);
  fragColor = vec4(uBackground + (1.0 - exp(-light)), 1.0);
}`,
  ),
  presets: [
    { name: "Gold", values: { uBackground: [0.03, 0.03, 0.04], uColorA: [1, 0.78, 0.4], uColorB: [0.75, 0.5, 0.2], uColorC: [1, 0.93, 0.75], uCount: 8, uSpread: 0.4 } },
    { name: "Aurora", values: { uColorA: [0.2, 1, 0.7], uColorB: [0.2, 0.6, 1], uColorC: [0.6, 0.3, 1], uTilt: -0.2, uWave: 0.3 } },
  ],
};
