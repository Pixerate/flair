import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

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

export const tarotReveal: ShaderEffect = {
  kind: "shader",
  id: "tarot-reveal",
  name: "Tarot reveal",
  description: "A face-down tarot card hovering in a golden glow, its back inlaid with a gilt sun, moon and stars, turning over to reveal a picture in a gold frame as dust motes drift up through the light.",
  category: "light",
  video: "filter",
  tags: ["card", "tarot", "reveal", "mystic", "gold", "flip", "glow", "fortune"],
  loop: 8,
  source: glsl(
    `// Tarot reveal: face down and hovering (0–3 s), turning over (3–3.9 s), the picture shown
// (to 7 s), turning back (7–7.9 s). Card units: half its height is 1.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uGold;        // @control color default=#E8C46A label="Gold"
uniform vec3 uCardBack;    // @control color default=#1E1B4B label="Card back"
uniform vec3 uBackground;  // @control color default=#0A0716 label="Background"
uniform float uGlow;       // @control min=0 max=1 default=0.6 label="Glow"
uniform float uDust;       // @control min=0 max=1 default=0.6 label="Dust"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `const float ASPECT = 0.58;

float roundedBox(vec2 p, vec2 hs, float r) {
  vec2 e = abs(p) - hs + r;
  return length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
}

// How much of a line \`w\` wide lies along the distance \`d\`, antialiased over \`px\`.
float stroke(float d, float w, float px) {
  return 1.0 - smoothstep(w - px, w + px, abs(d));
}

// A four-pointed sparkle round \`c\`, \`r\` across.
float sparkle(vec2 p, vec2 c, float r) {
  vec2 q = abs(p - c) / r;
  return 1.0 - smoothstep(0.0, 0.06, q.x * q.y * 8.0 + max(q.x, q.y) - 1.0);
}

// The back's gilt: two borders, a rayed sun ringed with dots, a crescent moon and sparkles.
float backArt(vec2 l, float px) {
  float g = stroke(roundedBox(l, vec2(ASPECT, 1.0) - 0.06, 0.04), 0.008, px);
  g = max(g, stroke(roundedBox(l, vec2(ASPECT, 1.0) - 0.1, 0.03), 0.004, px));
  float r = length(l);
  float a = atan(l.y, l.x);
  g = max(g, 1.0 - smoothstep(-px, px, r - (0.17 + 0.05 * pow(abs(cos(a * 6.0)), 6.0))));
  g = max(g, stroke(r - 0.3, 0.006, px));
  float dots = length(vec2(fract(a / 6.28318 * 16.0) - 0.5, (r - 0.38) * 8.0));
  g = max(g, 1.0 - smoothstep(0.12, 0.12 + px * 8.0, dots));
  float moon = max(length(l - vec2(0.0, 0.64)) - 0.1, -(length(l - vec2(0.04, 0.67)) - 0.085));
  g = max(g, 1.0 - smoothstep(-px, px, moon));
  for (int i = 0; i < 4; i++) {
    vec2 c = vec2(i % 2 == 0 ? -0.34 : 0.34, i < 2 ? -0.7 : 0.72);
    g = max(g, sparkle(l, c, 0.07));
  }
  g = max(g, sparkle(l, vec2(0.0, -0.62), 0.11));
  return g;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float t = mod(iTime, 8.0);
  float unit = min(res.y * 0.4, res.x * 0.4 / ASPECT);
  float bob = 0.035 * sin(iTime * 1.7);
  vec2 sp = (fragCoord - 0.5 * res) / unit - vec2(0.0, bob);
  float px = 1.5 / unit;
  // Turned over from its back (0) to its face (pi), swaying a little as it hovers.
  float flip = smoothstep(3.0, 3.9, t) - smoothstep(7.0, 7.9, t);
  float turn = 3.14159265 * flip + 0.14 * sin(iTime * 1.1) * (1.0 - abs(sin(3.14159265 * flip)));
  float c = cos(turn);
  float s = sin(turn);
  // A flash as its face comes round.
  float flash = exp(-pow((t - 3.5) * 5.0, 2.0));
  // The glow behind it, breathing.
  vec2 uv = (fragCoord - 0.5 * res) / res.y;
  vec3 col = uBackground * (1.0 - 0.5 * length(uv));
  float halo = exp(-length(sp * vec2(1.3, 0.8)) * 1.6) * uGlow * (0.6 + 0.15 * sin(iTime * 2.0) + 0.3 * flip + flash);
  col += uGold * halo * 0.55;
  // Where the ray from the eye meets the card's plane, turning about its upright axis.
  const float D = 5.0;
  float den = D * c - sp.x * s;
  if (abs(den) > 1e-4) {
    float tr = D * c / den;
    vec2 l = vec2(tr * sp.x * c + (D * tr - D) * s, tr * sp.y);
    bool back = c > 0.0;
    if (!back) l.x = -l.x;
    float sd = roundedBox(l, vec2(ASPECT, 1.0), 0.05);
    float mask = (1.0 - smoothstep(-px, px, sd)) * step(0.0, tr);
    if (mask > 0.0) {
      vec2 cuv = l / vec2(ASPECT, 1.0) * 0.5 + 0.5;
      // Gold that glints as a sheen passes over it.
      float sheen = exp(-pow(cuv.x + cuv.y * 0.5 - fract(iTime * 0.2) * 2.6 + 0.4, 2.0) * 30.0);
      vec3 gold = uGold * (0.75 + 0.25 * cuv.y + 0.6 * sheen);
      vec3 face;
      if (back) {
        face = uCardBack * (0.8 + 0.3 * cuv.y);
        face = mix(face, gold, backArt(l, px));
      } else {
        // The picture inside a gold frame, a blank title plate across its foot.
        vec2 win = vec2(ASPECT - 0.1, 0.78);
        vec2 wl = l - vec2(0.0, 0.12);
        vec2 wuv = wl / win * 0.5 + 0.5;
        vec2 ts = vec2(textureSize(uImage, 0));
        float imageAspect = ts.x / max(ts.y, 1.0);
        float wa = win.x / win.y;
        vec2 fit = imageAspect > wa ? vec2(wa / imageAspect, 1.0) : vec2(1.0, imageAspect / wa);
        vec3 pic = picture(uImage, 0.5 + (wuv - 0.5) * fit);
        face = mix(vec3(0.97, 0.94, 0.86), gold, 0.15);
        float wsd = roundedBox(wl, win, 0.02);
        face = mix(face, pic, 1.0 - smoothstep(-px, px, wsd));
        face = mix(face, gold, stroke(wsd, 0.012, px));
        face = mix(face, gold, stroke(roundedBox(l, vec2(ASPECT, 1.0) - 0.04, 0.03), 0.01, px));
        float plate = roundedBox(l - vec2(0.0, -0.83), vec2(ASPECT - 0.16, 0.07), 0.03);
        face = mix(face, uCardBack, 1.0 - smoothstep(-px, px, plate));
        face = mix(face, gold, stroke(plate, 0.006, px));
      }
      // Darker as it turns away, brighter for the flash.
      face *= 0.55 + 0.45 * abs(c);
      face += uGold * flash * 0.35;
      col = mix(col, face, mask);
    }
  }
  // Dust motes drifting up through the light, more once it is revealed.
  float dust = 0.0;
  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 3.1));
    float y = fract(h.y + iTime * (0.04 + 0.05 * h.x)) * 2.4 - 1.2;
    vec2 m = vec2((h.x - 0.5) * 2.2 + 0.05 * sin(iTime * 0.7 + fi), y);
    float r = 0.006 + 0.01 * hash12(vec2(fi, 9.0));
    float twinkle = 0.5 + 0.5 * sin(iTime * 3.0 + fi * 1.7);
    dust += exp(-dot(sp - m, sp - m) / (r * r)) * twinkle * smoothstep(1.2, 0.6, abs(y));
  }
  col += uGold * dust * uDust * (0.5 + 0.8 * flip);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Silver moon", values: { uGold: [0.85, 0.88, 0.95], uCardBack: [0.06, 0.09, 0.18], uBackground: [0.02, 0.03, 0.07] } },
    { name: "Crimson", values: { uGold: [0.95, 0.75, 0.4], uCardBack: [0.38, 0.05, 0.1], uBackground: [0.1, 0.02, 0.03], uGlow: 0.8 } },
  ],
};

export const lightWaves: ShaderEffect = {
  kind: "shader",
  id: "light-waves",
  name: "Light waves",
  description:
    "A glossy sheet of fine parallel ridges folding in slow, deep waves, each ridge catching the light so the lines shimmer and bunch where the sheet turns, with an iridescent sheen sliding across the folds.",
  category: "light",
  tags: ["background", "hero", "wave", "line", "ribbed", "iridescent", "gloss", "fold", "flow", "wallpaper"],
  source: glsl(
    `// Light waves: a slowly folding sheet with fine parallel ridges pressed into it, lit as glossy plastic.
uniform vec3 uShadow;       // @control color default=#032417 label="Shadow"
uniform vec3 uBase;         // @control color default=#22B356 label="Base"
uniform vec3 uHighlight;    // @control color default=#D8FFE2 label="Highlight"
uniform vec3 uSheen;        // @control color default=#F27AD9 label="Sheen"
uniform float uScale;       // @control min=0.3 max=4 default=1.2 label="Fold size"
uniform float uDensity;     // @control min=10 max=300 default=110 step=1 label="Lines"
uniform float uBend;        // @control min=0 max=3 default=1.4 label="Bend"
uniform float uRidge;       // @control min=0 max=2 default=1 label="Ridge depth"
uniform float uRelief;      // @control min=0 max=2 default=1 label="Fold depth"
uniform float uGloss;       // @control min=0 max=2 default=1 label="Gloss"
uniform float uIridescence; // @control min=0 max=2 default=1 label="Sheen"
uniform float uSpeed;       // @control min=0 max=1 default=0.12 label="Speed"
uniform float uAngle;       // @control min=-180 max=180 default=-25 label="Angle (°)"`,
    ROTATE,
    `// The sheet's folds: warped sines, so everything bends in long smooth curves.
float waveHeight(vec2 p, float t) {
  p += 0.45 * vec2(sin(p.y * 1.3 + t), sin(p.x * 1.1 - t * 0.8));
  return sin(p.x * 1.4 + 1.6 * sin(p.y * 0.9 + t * 0.7))
    + 0.6 * sin(p.y * 1.8 - p.x * 0.7 + t * 0.5)
    + 0.25 * sin(sqrt(dot(p - vec2(0.8, -0.4), p - vec2(0.8, -0.4)) + 0.3) * 3.2 - t * 1.2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  mat2 turn = rot(radians(uAngle));
  vec2 p = turn * (fragCoord - 0.5 * iResolution.xy) / iResolution.y * 2.0 / uScale;
  float t = iTime * uSpeed * 2.0;
  float h = waveHeight(p, t);
  float e = 0.004;
  vec2 g = vec2(waveHeight(p + vec2(e, 0.0), t) - h, waveHeight(p + vec2(0.0, e), t) - h) / e;

  // Parallel lines running across the sheet, pushed about by its folds; where they crowd
  // below a pixel the ridges fade out and the sheet reads as a smooth band.
  float s = p.y + 0.35 * uBend * h;
  vec2 across = normalize(vec2(0.0, 1.0) + 0.35 * uBend * g);
  float f = s * uDensity * 0.25;
  float resolved = smoothstep(0.55, 0.3, fwidth(f));
  float tilt = sin(6.28318 * f) * 0.9 * uRidge * resolved;
  vec3 n = normalize(vec3(-g * 0.55 * uRelief + across * tilt, 1.0));
  vec3 fold = normalize(vec3(-g * 0.55 * uRelief, 1.0));

  vec3 light = normalize(vec3(turn * vec2(-0.5, 0.6), 0.6));
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = dot(n, light);
  float spec = pow(max(dot(n, halfway), 0.0), 40.0) * uGloss;
  float broad = pow(max(dot(fold, halfway), 0.0), 12.0) * uGloss;

  // Iridescent sheen in bands across the turned folds, drifting along them.
  // Mixed in only where the sheet is lit, so it stays a clear colour rather than greying the shadows.
  float steep = smoothstep(0.98, 0.7, fold.z);
  float band = smoothstep(0.25, 0.8, 0.5 + 0.5 * sin(h * 1.3 + p.x * 0.5 - t * 0.6));
  float sheen = clamp(uIridescence * (0.3 + 0.7 * steep) * band, 0.0, 1.0);
  float lit = smoothstep(-0.1, 0.7, dot(fold, light));

  vec3 body = mix(uShadow, uBase, smoothstep(-0.55, 0.85, diffuse));
  body = mix(body, uSheen * (0.35 + 0.8 * max(diffuse, 0.0)), sheen * lit * 0.75);
  vec3 shine = mix(uHighlight, uSheen * 1.3, sheen);
  vec3 col = body + shine * (0.9 * spec + 0.3 * broad);
  vec2 uv = fragCoord / iResolution.xy - 0.5;
  col *= 1.0 - 0.4 * dot(uv, uv);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Ultraviolet", values: { uShadow: [0.05, 0.02, 0.13], uBase: [0.38, 0.17, 0.8], uHighlight: [0.88, 0.84, 1], uSheen: [0.25, 0.9, 1] } },
    { name: "Chrome", values: { uShadow: [0.04, 0.05, 0.07], uBase: [0.48, 0.51, 0.56], uHighlight: [1, 1, 1], uSheen: [0.75, 0.85, 1], uIridescence: 0.4, uGloss: 1.4 } },
    { name: "Sunset", values: { uShadow: [0.2, 0.03, 0.05], uBase: [0.95, 0.38, 0.2], uHighlight: [1, 0.9, 0.7], uSheen: [1, 0.35, 0.65] } },
    { name: "Bold", values: { uDensity: 45, uScale: 1.6, uRidge: 1.3 } },
    { name: "Still", values: { uSpeed: 0 } },
  ],
};

export const lightStrandText: ShaderEffect = {
  kind: "shader",
  id: "light-strand-text",
  name: "Light strand text",
  description:
    "Tall, heavy letters built from hundreds of fine strands of light, steel blue to white, that fall into place from top to bottom, the letters' cores first and their edges last, then curve along the edges, brightening and fading as light slides down them, with a few warm threads running through and a glow along the lower edges.",
  category: "text",
  video: "none",
  tags: ["text", "title", "light", "streak", "line", "fibre", "glow", "hero", "tech", "overlay"],
  transparent: true,
  source: glsl(
    `// Light strand text: the letters, stretched tall, are filled with layers of thin strands whose light slides down them;
// near the outline they are drawn along it, bunching at the sides and bending round curves. They build up by falling
// in from the top, strand by strand, from the middle of each stroke out to its edges.
uniform sampler2D uText;        // @control wrap=clamp default=${textImage("PRO", { width: 1280, height: 512 })} label="Text"
uniform vec3 uBackground;       // @control color default=#000000 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform vec3 uDark;             // @control color default=#060B1A label="Dark"
uniform vec3 uMid;              // @control color default=#4E6C9A label="Mid"
uniform vec3 uLight;            // @control color default=#EEF4FF label="Light"
uniform vec3 uWarm;             // @control color default=#FF5A1F label="Warm threads"
uniform float uSize;            // @control min=0.3 max=2 default=1.45 label="Text size"
uniform float uStretch;         // @control min=1 max=4 default=2.2 label="Stretch"
uniform float uStrands;         // @control min=0.3 max=3 default=1 label="Strand density"
uniform float uContrast;        // @control min=0.5 max=2 default=1.1 label="Contrast"
uniform float uWarmth;          // @control min=0 max=2 default=1 label="Warm threads"
uniform float uBend;            // @control min=0 max=1 default=1 label="Follow edges"
uniform float uEdge;            // @control min=0 max=2 default=1 label="Edge glow"
uniform float uSpeed;           // @control min=0 max=1 default=0.15 label="Flow speed"
uniform bool uAnimate;          // @control default=true label="Build up"
uniform float uBuildTime;       // @control min=0.5 max=10 default=3 label="Build time (s)"
uniform float uProgress;        // @control min=0 max=1 default=1 label="Built (when still)"`,
    HASH,
    NOISE,
    `// Where p falls on the text picture, stretched vertically: xy the picture's 0-1 coordinates, z its texels per frame unit.
vec3 strandPlace(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize, iResolution.x / iResolution.y * uSize * uStretch / aspect);
  return vec3(p / vec2(h * aspect / uStretch, h) + 0.5, size.y / h);
}
float strandMask(vec2 p, float blur) {
  vec3 m = strandPlace(p);
  if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
  return textureLod(uText, m.xy, log2(max(blur * m.z, 1.0))).a;
}
// How far a strand has fallen, from 0 (not started) to 1 (reached the bottom), at build stage 'stage'.
// Each strand waits its own short while before it drops.
float strandFall(float id, float stage) {
  return (stage - 0.3 * hash12(vec2(id, 1.9))) / 0.4;
}
// How much of a falling strand is lit at height y, plus a bright head while it is still dropping.
vec2 strandDrop(float fall, float y) {
  float below = fall * 1.1 - (1.0 - y);
  float lit = smoothstep(0.0, 0.03, below);
  float head = smoothstep(0.0, 0.01, below) * exp(-below * 30.0) * (1.0 - smoothstep(0.8, 1.0, fall));
  return vec2(lit, head);
}
// One layer of strands: a column of light per cell across, its brightness drifting slowly along it.
// x its brightness, y how much of the cell it covers so far.
vec2 strandLayer(vec2 m, float count, float seed, float t, float stage) {
  float u = m.x * count;
  float id = floor(u) + seed;
  float across = pow(sin(3.14159 * fract(u)), 0.6);
  float along = vnoise(vec2(id * 7.31, m.y * (2.0 + 3.0 * hash12(vec2(id, seed))) - t * (0.6 + hash12(vec2(seed, id)))));
  vec2 drop = strandDrop(strandFall(id, stage), m.y);
  float light = along * (0.35 + 0.65 * across) * (0.3 + 0.7 * hash12(vec2(id, 3.7)));
  return vec2(light * drop.x + 1.5 * drop.y * across, drop.x * (0.35 + 0.65 * across));
}

// The strands' colour at strand coordinate s (across) and height y, both in text-picture units, and in
// 'cover' how much of the letter the strands that have fallen so far fill.
vec3 strandColor(float s, float y, float n, float t, float stage, out float cover) {
  vec2 m = vec2(s, y);
  vec2 a = strandLayer(m, n, 0.0, t, stage);
  vec2 b = strandLayer(m, n * 2.3, 17.0, t * 1.3, stage);
  vec2 c = strandLayer(m, n * 5.1, 41.0, t * 0.8, stage);
  float strands = 0.45 * a.x + 0.35 * b.x + 0.3 * c.x;
  cover = 1.0 - (1.0 - a.y) * (1.0 - b.y) * (1.0 - c.y);
  // Broad bright and dark zones, so whole runs of strands dim together down the letters.
  float zone = vnoise(vec2(s * 9.0, y * 1.6 - t * 0.35)) * 0.7 + 0.3 * vnoise(vec2(s * 23.0 + 5.0, y * 2.4 + t * 0.2));
  zone = smoothstep(0.2, 0.8, zone);
  float tone = clamp(pow(strands * (0.15 + 2.2 * zone), uContrast * 1.4), 0.0, 1.0);
  vec3 col = mix(uDark, uMid, smoothstep(0.0, 0.5, tone));
  col = mix(col, uLight, smoothstep(0.42, 0.95, tone));
  // A few hairline warm threads, red at the top turning gold lower down.
  float wu = s * n * 7.0;
  float wid = floor(wu);
  float thread = step(hash12(vec2(wid, 9.1)), 0.012 * uWarmth) * smoothstep(0.5, 0.15, abs(fract(wu) - 0.5));
  thread *= smoothstep(0.3, 0.7, vnoise(vec2(wid, y * 3.0 - t))) * strandDrop(strandFall(wid + 9.1, stage), y).x;
  return mix(col, mix(vec3(1.0, 0.82, 0.4), uWarm, y) * 1.2, clamp(thread, 0.0, 1.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed * 2.0;
  float mask = strandMask(p, 1.5 * px);
  vec2 m = strandPlace(p).xy;
  float n = uStrands * 60.0;
  // Follow the outline: the strand coordinate is pulled along the outline's normal, more the nearer
  // the edge. Beside an edge that only squeezes the strands together; round a curve or a corner it
  // bends them along it. It never folds a strand back, whatever the strength.
  const float R = 0.07;
  float soft = strandMask(p, R);
  vec2 g = vec2(strandMask(p + vec2(R * 0.5, 0.0), R) - strandMask(p - vec2(R * 0.5, 0.0), R),
                strandMask(p + vec2(0.0, R * 0.5), R) - strandMask(p - vec2(0.0, R * 0.5), R));
  vec2 normal = g / (length(g) + 0.03);
  float s = m.x - 0.13 * uBend * (1.0 - soft) * normal.x;
  // Build up: strands deep in a stroke start falling first, those at its edges last.
  float built = uAnimate ? clamp(iTime / uBuildTime, 0.0, 1.0) : uProgress;
  // How far in from the outline, from 0 at the edge to 1 in the middle of a stroke: the letter
  // blurred over growing radii stays solid only as far in as each radius. The blur is measured down
  // the picture, which the stretch squeezes across, so the radii grow with it.
  float depth = (smoothstep(0.5, 0.8, strandMask(p, 0.045 * uStretch)) + smoothstep(0.5, 0.8, strandMask(p, 0.09 * uStretch))
               + smoothstep(0.5, 0.75, strandMask(p, 0.18 * uStretch))) / 3.0;
  float stage = built * 1.6 - 0.6 * (1.0 - depth);
  float cover;
  vec3 col = strandColor(s, m.y, n, t, stage, cover);
  // Light gathering at the letters' edges: white along the sides, warm along the bottoms.
  float inner = strandMask(p, 0.02);
  float edge = clamp(mask - inner, 0.0, 1.0) * 1.6;
  float below = clamp(mask - strandMask(p - vec2(0.0, 0.006), 0.004), 0.0, 1.0) * smoothstep(0.35, 0.0, m.y);
  col += uEdge * (uLight * 0.3 * edge + mix(uWarm, vec3(1.0, 0.85, 0.5), 0.7) * 0.5 * below) * cover;
  float shape = mask * cover;
  float a = shape + uBackgroundAlpha * (1.0 - shape);
  vec3 rgb = col * shape + uBackground * uBackgroundAlpha * (1.0 - shape);
  fragColor = vec4(rgb / max(a, 1e-4), a);
}`,
  ),
  presets: [
    { name: "On black", values: { uBackgroundAlpha: 1 } },
    { name: "Gold", values: { uDark: [0.08, 0.04, 0.01], uMid: [0.7, 0.45, 0.15], uLight: [1, 0.95, 0.8], uWarm: [1, 0.3, 0.1], uBackgroundAlpha: 1 } },
    { name: "Emerald", values: { uDark: [0.01, 0.07, 0.04], uMid: [0.1, 0.6, 0.35], uLight: [0.85, 1, 0.9], uWarm: [1, 0.4, 0.8], uBackgroundAlpha: 1 } },
    { name: "Fine", values: { uStrands: 2, uContrast: 1.3 } },
  ],
};

export const ledNet: ShaderEffect = {
  kind: "shader",
  id: "led-net",
  name: "LED net",
  description:
    "A picture shown through a net of tiny LEDs draped in folds like fabric: each light glows with a cross-shaped star flare, mostly in one cool tint with drifting patches of rainbow colour, dark parts of the picture leaving the lights off so shapes stand out as silhouettes.",
  category: "image",
  video: "filter",
  tags: ["image", "led", "light", "grid", "sparkle", "stars", "fabric", "glow", "neon", "display"],
  source: glsl(
    `// LED net: a grid of point lights on folded fabric, each lit by the picture under it, with star-filter flares.
uniform sampler2D uImage;   // @control wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uTint;         // @control color default=#2A8CFF label="Tint"
uniform float uImageColour; // @control min=0 max=1 default=0.2 label="Picture colour"
uniform float uRainbow;     // @control min=0 max=1 default=0.5 label="Rainbow patches"
uniform float uPitch;       // @control min=6 max=48 default=26 label="Light spacing (px)"
uniform float uLightSize;   // @control min=0.3 max=2 default=1 label="Light size"
uniform float uFlare;       // @control min=0 max=2 default=1 label="Star flare"
uniform float uDrape;       // @control min=0 max=1 default=0.6 label="Folds"
uniform float uThreshold;   // @control min=0 max=0.8 default=0.12 label="Cut-off"
uniform float uBacklight;   // @control min=0 max=1 default=0.06 label="Picture behind"
uniform float uTwinkle;     // @control min=0 max=1 default=0.4 label="Twinkle"
uniform float uSpeed;       // @control min=0 max=1 default=0.2 label="Speed"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = iTime * uSpeed;
  vec2 uv0 = fragCoord / iResolution.xy;
  // The fabric: vertical folds swaying slowly, and rows sagging between them. The grid lives on the
  // fabric (q); where a fold turns away the lights crowd together and dim.
  float y = fragCoord.y / iResolution.y;
  float k = 9.0 / iResolution.y;
  float phase = fragCoord.x * k + 1.2 * sin(y * 2.3 + t * 1.3) + 0.6 * sin(y * 5.1 - t);
  float amp = uDrape * 0.85 / k;
  vec2 q = fragCoord + vec2(amp * sin(phase), uPitch * 0.8 * uDrape * sin(fragCoord.x * k * 0.6 + y * 1.7 + t));
  float facing = 1.0 + uDrape * 0.85 * cos(phase);
  float shade = clamp(0.25 + 0.75 * facing, 0.15, 1.6);

  vec2 g = q / uPitch;
  vec2 cell = floor(g);
  float r = uLightSize * uPitch * 0.08 + 0.6;
  float len = uFlare * uPitch * 0.4;
  vec3 light = vec3(0.0);
  // This light and its eight neighbours: a flare reaches less than a cell.
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 centre = c + 0.5 + 0.08 * (hash22(c) - 0.5);
      vec2 dq = (g - centre) * uPitch;
      vec2 d = vec2(dq.x / max(facing, 0.15), dq.y);
      // Lit by the picture where the light sits; dark parts of the picture switch it off.
      vec3 pic = pictureCover(uImage, (fragCoord - d) / iResolution.xy);
      float lum = dot(pic, vec3(0.299, 0.587, 0.114));
      float on = smoothstep(uThreshold, uThreshold + 0.2, lum) * (0.35 + 0.9 * lum);
      if (on < 0.01) continue;
      float tw = 1.0 - uTwinkle * 0.6 * (0.5 + 0.5 * sin(t * 9.0 + hash12(c + 4.1) * 40.0));
      vec3 col = mix(uTint * (0.7 + 0.6 * lum), pic * 1.4, uImageColour);
      // Patches of the net running rainbow colours, drifting across it.
      float rainbow = smoothstep(0.58, 0.78, vnoise(c * 0.11 + vec2(t * 0.6, -t * 0.3))) * uRainbow;
      vec3 hue = 0.5 + 0.5 * cos(6.28318 * (hash12(c + 7.7) + vec3(0.0, 0.33, 0.67)));
      col = mix(col, hue * 1.2, rainbow);
      float energy = on * tw * shade;
      // A bright core, a soft halo, and the star filter's diagonal cross.
      float dd = dot(d, d);
      float core = exp(-dd / (r * r));
      float halo = exp(-dd / (r * r * 6.0)) * 0.3;
      vec2 a = vec2(d.x + d.y, d.y - d.x) * 0.7071;
      float star = 0.0;
      if (len > 0.0) {
        star = exp(-abs(a.y) / 0.7) * exp(-abs(a.x) / len) + exp(-abs(a.x) / 0.7) * exp(-abs(a.y) / len);
      }
      light += energy * (col * (1.8 * core + halo + 0.7 * star) + vec3(1.0) * 1.1 * exp(-dd / (r * r * 0.2)));
    }
  }
  // The scene behind the net, faintly lit in the tint.
  vec4 back = pictureCoverRGBA(uImage, uv0);
  vec3 col = back.rgb * uBacklight * mix(vec3(1.0), uTint * 1.5, 0.75) + light * (1.0 - 0.2 * exp(-length(light)));
  // Tone-mapped on the brightest channel, so bright blue stays blue and only the hearts go white.
  float peak = max(col.r, max(col.g, col.b));
  col *= (1.0 - exp(-peak * 2.2)) / max(peak, 1e-4);
  fragColor = vec4(col, max(back.a, clamp(length(light), 0.0, 1.0)));
}`,
  ),
  presets: [
    { name: "Full colour", values: { uImageColour: 1, uRainbow: 0.15 } },
    { name: "Rainbow", values: { uRainbow: 1, uTint: [0.55, 0.3, 1] } },
    { name: "Flat grid", values: { uDrape: 0, uTwinkle: 0.2 } },
    { name: "Fine", values: { uPitch: 10, uLightSize: 0.8, uFlare: 0.7 } },
    { name: "Warm", values: { uTint: [1, 0.55, 0.2], uRainbow: 0.2 } },
  ],
};
