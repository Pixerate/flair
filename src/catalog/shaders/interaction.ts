import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { PICTURE } from "./image.js";

/*
 * These read the pointer built-ins the wrapper declares: `iPointer` (xy
 * pixels, z how hovered 0–1, w seconds held) and `iClicks[8]` (newest first:
 * xy pixels, z the `iTime` of the click, w 1 for a click). Thumbnails and
 * recordings have no pointer, so each one plays a gentle demo while idle,
 * which a `uDemo` control turns off.
 */

/**
 * `clickAt(i, demo)`: click `i`, newest first, as (x, y, time, 1), or zeros
 * for none. With the demo on and no real clicks yet, a synthetic click lands
 * every 2 s at a pseudo-random spot (needs {@link HASH}).
 */
const CLICKS = `
vec4 clickAt(int i, bool demo) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[i];
  float k = floor(iTime / 2.0) - float(i);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.15 + 0.7 * h) * iResolution.xy, k * 2.0, 1.0);
}`.trim();

/**
 * `hoverPoint(demo, idle)`: the point hover effects follow, in pixels, and
 * how strongly they answer it (z): the pointer while it is over the canvas,
 * else (with the demo on) a slow Lissajous drift at strength `idle`.
 */
const HOVER = `
vec3 hoverPoint(bool demo, float idle) {
  vec2 drift = iResolution.xy * (0.5 + vec2(0.28 * sin(iTime * 0.63), 0.22 * sin(iTime * 0.91 + 1.3)));
  float h = clamp(iPointer.z, 0.0, 1.0);
  return vec3(mix(drift, iPointer.xy, h), mix(demo ? idle : 0.0, 1.0, h));
}`.trim();

/** `glow(c)`: light as a colour over whatever is behind it (alpha is its brightest channel). */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

export const clickRipple: ShaderEffect = {
  kind: "shader",
  id: "click-ripple",
  name: "Click ripple",
  description: "Rings of water spreading out from every click and fading as they go.",
  category: "interaction",
  tags: ["interactive", "click", "overlay", "water", "ripple"],
  transparent: true,
  source: glsl(
    `// Click ripple: water rings spreading from each click (up to 8 at once).
uniform vec3 uColor;      // @control color default=#BFE6FF label="Colour"
uniform float uSpeed;     // @control min=0.05 max=2 default=0.5 label="Speed"
uniform float uWidth;     // @control min=0.002 max=0.05 default=0.012 label="Ring width"
uniform float uLife;      // @control min=0.3 max=6 default=2 label="Lifetime"
uniform int uRings;       // @control min=1 max=4 default=3 label="Rings per click"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    CLICKS,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec4 acc = vec4(0.0);
  for (int i = 7; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > uLife) continue;
    float life = age / uLife;
    float fade = (1.0 - life) * (1.0 - life);
    float d = length(fragCoord - c.xy) * px;
    for (int j = 0; j < 4; j++) {
      if (j >= uRings) break;
      float r = (age - float(j) * 0.16) * uSpeed;
      if (r <= 0.0) continue;
      // Rings widen and soften as they spread.
      float w = max(uWidth * (1.0 + life * 1.5), 1.5 * px);
      float x = (d - r) / w;
      float k = fade * (1.0 - 0.28 * float(j)) * smoothstep(0.0, 0.05, r);
      // A bright crest with a darker trough just inside it.
      float crest = exp(-x * x * 2.0);
      float trough = exp(-(x + 1.6) * (x + 1.6) * 2.0);
      acc = over(acc, uColor * 0.15, trough * k * 0.35);
      acc = over(acc, mix(uColor, vec3(1.0), 0.5 * crest), crest * k);
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Sonar", values: { uColor: [0.3, 1, 0.6], uSpeed: 0.3, uWidth: 0.006, uLife: 4, uRings: 4 } },
    { name: "Raindrop", values: { uColor: [1, 1, 1], uSpeed: 0.8, uWidth: 0.02, uLife: 1.2, uRings: 2 } },
  ],
};

export const clickBurst: ShaderEffect = {
  kind: "shader",
  id: "click-burst",
  name: "Click burst",
  description: "Sparks or confetti bursting out of every click, falling under gravity as they fade.",
  category: "interaction",
  tags: ["interactive", "click", "overlay", "particles", "celebration", "confetti"],
  transparent: true,
  source: glsl(
    `// Click burst: sparks (or confetti) thrown out of each click, slowed by drag and pulled down by gravity.
uniform vec3 uColorA;     // @control color default=#FFD166 label="Colour 1"
uniform vec3 uColorB;     // @control color default=#EF476F label="Colour 2"
uniform vec3 uColorC;     // @control color default=#06D6A0 label="Colour 3"
uniform int uCount;       // @control min=4 max=48 default=24 label="Count"
uniform float uSpread;    // @control min=0.1 max=2 default=0.8 label="Spread"
uniform float uGravity;   // @control min=0 max=3 default=1 label="Gravity"
uniform float uLife;      // @control min=0.4 max=4 default=1.6 label="Lifetime"
uniform bool uConfetti;   // @control default=false label="Confetti"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    CLICKS,
    OVER,
    `float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  const float drag = 2.5;
  vec4 acc = vec4(0.0);
  for (int i = 7; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > uLife) continue;
    float life = age / uLife;
    vec2 origin = c.xy * px;
    // A quick flash where it landed.
    float flash = exp(-age * 18.0) * exp(-dot(p - origin, p - origin) / 0.002);
    acc = over(acc, vec3(1.0), clamp(flash, 0.0, 1.0));
    float slow = (1.0 - exp(-drag * age)) / drag;
    for (int j = 0; j < 48; j++) {
      if (j >= uCount) break;
      vec2 h = hash22(vec2(float(j) * 7.13 + 1.0, c.z * 3.1 + float(i)));
      float h3 = hash12(h * 91.7 + c.z);
      float angle = h.x * 6.28318;
      vec2 v0 = vec2(cos(angle), sin(angle)) * uSpread * (0.3 + 0.7 * h.y) + vec2(0.0, uSpread * 0.35);
      vec2 pos = origin + v0 * slow - vec2(0.0, 0.5 * uGravity * 0.6 * age * age);
      if (abs(p.x - pos.x) > 0.06 || abs(p.y - pos.y) > 0.06) continue;
      vec3 col = h3 < 0.333 ? uColorA : (h3 < 0.667 ? uColorB : uColorC);
      float a;
      if (uConfetti) {
        // A tumbling paper rectangle.
        float spin = (h3 - 0.5) * 20.0 * age + angle;
        float cs = cos(spin);
        float sn = sin(spin);
        vec2 q = mat2(cs, sn, -sn, cs) * (p - pos);
        vec2 size = vec2(0.011, 0.006 * abs(cos(age * (4.0 + 6.0 * h.y) + h.x * 9.0)) + px);
        vec2 e = abs(q) - size;
        float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
        a = (1.0 - smoothstep(-px, px, sd)) * (1.0 - smoothstep(0.7, 1.0, life));
        col *= 0.75 + 0.25 * cs;
      } else {
        // A streak along its velocity, with a white-hot core.
        vec2 v = v0 * exp(-drag * age) - vec2(0.0, uGravity * 0.6 * age);
        float r = 0.004 * (1.0 - 0.6 * life) + px;
        float sd = segment(p, pos, pos - v * 0.05) - r;
        a = (1.0 - smoothstep(-px, px, sd)) * (1.0 - life);
        a += exp(-max(sd, 0.0) / (r * 2.0)) * 0.35 * (1.0 - life);
        col = mix(col, vec3(1.0), exp(-max(sd + r, 0.0) / (r * 0.5)) * 0.6);
      }
      acc = over(acc, col, clamp(a, 0.0, 1.0));
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Confetti", values: { uConfetti: true, uCount: 36, uSpread: 1, uGravity: 1.4, uLife: 2.5, uColorC: [0.3, 0.55, 1] } },
    { name: "Embers", values: { uColorA: [1, 0.6, 0.15], uColorB: [1, 0.3, 0.1], uColorC: [1, 0.85, 0.5], uCount: 16, uSpread: 0.5, uGravity: 0.2 } },
  ],
};

export const cursorGlow: ShaderEffect = {
  kind: "shader",
  id: "cursor-glow",
  name: "Cursor glow",
  description: "A soft light following the pointer, with a halo ring that tightens while it is pressed.",
  category: "interaction",
  tags: ["interactive", "hover", "press", "overlay", "glow", "cursor"],
  transparent: true,
  source: glsl(
    `// Cursor glow: a soft light at the pointer, scaled by how hovered, with a halo that tightens while pressed.
uniform vec3 uColor;       // @control color default=#7DD3FC label="Colour"
uniform float uRadius;     // @control min=0.03 max=0.6 default=0.18 label="Radius"
uniform float uIntensity;  // @control min=0 max=3 default=1.2 label="Intensity"
uniform float uHalo;       // @control min=0 max=1 default=0.7 label="Halo"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HOVER,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 hp = hoverPoint(uDemo, 0.7);
  float d = length(fragCoord - hp.xy) / iResolution.y;
  // How pressed: eases in while held; the idle demo pulses it.
  float press = 1.0 - exp(-max(iPointer.w, 0.0) * 4.0);
  if (uDemo) press = max(press, (1.0 - iPointer.z) * pow(max(sin(iTime * 1.3), 0.0), 3.0));
  float light = exp(-pow(d / uRadius, 2.0) * 2.0) * uIntensity * hp.z * (1.0 + 0.6 * press);
  float ringR = uRadius * mix(1.3, 0.55, press);
  float ringW = max(uRadius * 0.05, 1.5 / iResolution.y);
  float ring = exp(-pow((d - ringR) / ringW, 2.0)) * uHalo * hp.z * (0.6 + 0.8 * press);
  fragColor = glow(uColor * light + mix(uColor, vec3(1.0), 0.5) * ring * 1.5);
}`,
  ),
  presets: [
    { name: "Spotlight", values: { uColor: [1, 0.95, 0.85], uRadius: 0.4, uIntensity: 0.8, uHalo: 0 } },
    { name: "Neon", values: { uColor: [1, 0.2, 0.75], uRadius: 0.1, uIntensity: 2, uHalo: 1 } },
  ],
};

export const hoverLiquid: ShaderEffect = {
  kind: "shader",
  id: "hover-liquid",
  name: "Liquid hover",
  description: "An image that swells and ripples like liquid around the pointer while it hovers.",
  category: "interaction",
  tags: ["interactive", "hover", "image", "liquid", "distortion"],
  source: glsl(
    `// Liquid hover: an image bulging and rippling around the pointer, as strongly as it is hovered.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uStrength;   // @control min=0 max=1 default=0.6 label="Strength"
uniform float uRadius;     // @control min=0.05 max=0.8 default=0.3 label="Radius"
uniform float uWobble;     // @control min=0 max=1 default=0.5 label="Wobble"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    HOVER,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 hp = hoverPoint(uDemo, 0.5);
  vec2 d = (fragCoord - hp.xy) / iResolution.y;
  float r = length(d);
  float s = uStrength * hp.z;
  float fall = exp(-pow(r / uRadius, 2.0) * 1.5);
  // Swell: pull samples towards the pointer, so it magnifies like a drop.
  vec2 off = -d * fall * s * 0.6;
  // Wobble: rings running out from the pointer and a slow liquid churn.
  vec2 dir = d / max(r, 1e-5);
  float wave = sin(r / uRadius * 14.0 - iTime * 5.0) * fall;
  off += dir * wave * uWobble * s * 0.02;
  vec2 churn = vec2(vnoise(d * 6.0 + iTime * 0.7), vnoise(d * 6.0 - iTime * 0.6 + 5.0)) - 0.5;
  off += churn * fall * s * uWobble * 0.05;
  vec3 col = picture(uImage, uv + off * vec2(iResolution.y / iResolution.x, 1.0));
  // Light catching the swell's upper-left slope.
  float slope = dot(dir, normalize(vec2(-0.6, 0.8))) * r / uRadius;
  col += 0.12 * s * fall * slope + 0.06 * s * wave * uWobble;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Syrup", values: { uStrength: 0.9, uRadius: 0.45, uWobble: 0.15 } },
    { name: "Splash", values: { uStrength: 0.5, uRadius: 0.25, uWobble: 1 } },
  ],
};

export const hoverReveal: ShaderEffect = {
  kind: "shader",
  id: "hover-reveal",
  name: "X-ray reveal",
  description: "A second image showing through a soft lens around the pointer that grows as it hovers and pulses on click.",
  category: "interaction",
  tags: ["interactive", "hover", "click", "image", "reveal", "x-ray"],
  source: glsl(
    `// X-ray reveal: a second image seen through a soft lens at the pointer.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform sampler2D uReveal; // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Revealed image"
uniform float uRadius;     // @control min=0.05 max=0.6 default=0.22 label="Lens radius"
uniform float uSoftness;   // @control min=0 max=1 default=0.35 label="Softness"
uniform vec3 uRim;         // @control color default=#A5F3FC label="Rim"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    CLICKS,
    HOVER,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec3 hp = hoverPoint(uDemo, 0.85);
  // Each click swells the lens, which settles back.
  float pulse = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 c = clickAt(i, uDemo);
    float age = iTime - c.z;
    if (c.w < 0.5 || age < 0.0) continue;
    pulse += 0.6 * exp(-age * 4.0) * (1.0 - exp(-age * 30.0));
  }
  float R = uRadius * hp.z * (1.0 + pulse);
  float d = length(fragCoord - hp.xy) * px;
  // A wobbly edge, so the lens looks like it is melting through.
  d += (vnoise(fragCoord * px * 9.0 + iTime * 0.6) - 0.5) * 0.25 * R;
  float soft = max(uSoftness * R * 0.6, 1.5 * px);
  float m = 1.0 - smoothstep(R - soft, R, d);
  vec3 col = mix(picture(uImage, uv), picture(uReveal, uv), m);
  float rim = exp(-pow((d - R + soft * 0.5) / max(soft * 0.5, 2.0 * px), 2.0)) * step(0.001, R);
  col += uRim * rim * 0.6;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Peephole", values: { uRadius: 0.12, uSoftness: 0.05, uRim: [1, 1, 1] } },
    { name: "Fog lamp", values: { uRadius: 0.4, uSoftness: 1, uRim: [0, 0, 0] } },
  ],
};

export const magnifier: ShaderEffect = {
  kind: "shader",
  id: "magnifier",
  name: "Magnifier",
  description: "A round magnifying glass over an image at the pointer, with a bright rim and a fringe of colour at its edge.",
  category: "interaction",
  tags: ["interactive", "hover", "image", "lens", "zoom"],
  source: glsl(
    `// Magnifier: a round lens over an image at the pointer, showing while hovered.
uniform sampler2D uImage;    // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uZoom;         // @control min=1 max=5 default=2 label="Zoom"
uniform float uRadius;       // @control min=0.05 max=0.5 default=0.18 label="Radius"
uniform float uAberration;   // @control min=0 max=1 default=0.35 label="Colour fringe"
uniform vec3 uRim;           // @control color default=#FFFFFF label="Rim"
uniform bool uDemo;          // @control default=true label="Demo when idle"`,
    HOVER,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 hp = hoverPoint(uDemo, 1.0);
  float s = hp.z;
  vec3 col = picture(uImage, uv);
  float R = uRadius * (0.75 + 0.25 * s) * iResolution.y;
  vec2 d = fragCoord - hp.xy;
  float r = length(d);
  float k = r / R;
  // A soft shadow under the glass.
  float shadow = 1.0 - smoothstep(R * 0.9, R * 1.3, length(d - vec2(R * 0.08, -R * 0.12)));
  col *= 1.0 - 0.35 * shadow * s;
  if (k < 1.05) {
    // More magnified at the centre, squeezed towards the rim like real glass.
    vec2 q = d / uZoom * (1.0 + 0.4 * k * k * k * k);
    float fr = uAberration * 0.08 * k * k * k;
    vec3 lens = vec3(
      picture(uImage, (hp.xy + q * (1.0 + fr)) / iResolution.xy).r,
      picture(uImage, (hp.xy + q) / iResolution.xy).g,
      picture(uImage, (hp.xy + q * (1.0 - fr)) / iResolution.xy).b
    );
    lens += 0.16 * exp(-pow(length(d / R - vec2(-0.35, 0.4)) * 2.6, 2.0));
    lens *= 1.0 - 0.25 * pow(k, 6.0);
    col = mix(col, lens, (1.0 - smoothstep(R - 1.5, R, r)) * s);
  }
  float rimW = max(R * 0.035, 2.0);
  float lit = 0.6 + 0.4 * dot(d / max(r, 1e-4), normalize(vec2(-1.0, 1.0)));
  float rim = exp(-pow((r - R) / rimW, 2.0));
  col = mix(col, uRim * lit, rim * s * 0.9);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Loupe", values: { uZoom: 4, uRadius: 0.1, uAberration: 0.1 } },
    { name: "Fishbowl", values: { uZoom: 1.5, uRadius: 0.35, uAberration: 1 } },
  ],
};

export const holoCard: ShaderEffect = {
  kind: "shader",
  id: "holo-card",
  name: "Holo card",
  description: "A holographic foil trading card whose rainbow sheen and glare shift as the pointer tilts it.",
  category: "interaction",
  tags: ["interactive", "hover", "card", "holographic", "foil", "iridescent"],
  transparent: true,
  source: glsl(
    `// Holo card: a rounded card with rainbow foil and glare that move as the pointer tilts it.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uFoil;       // @control min=0 max=1 default=0.7 label="Foil"
uniform float uGlare;      // @control min=0 max=1 default=0.6 label="Glare"
uniform float uTilt;       // @control min=0 max=1 default=0.6 label="Tilt"
uniform float uCorner;     // @control min=0 max=0.25 default=0.06 label="Corner radius"
uniform vec3 uBorder;      // @control color default=#E2E8F0 label="Border"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    HOVER,
    OVER,
    PICTURE,
    `float roundedBox(vec2 p, vec2 hs, float r) {
  vec2 e = abs(p) - hs + r;
  return length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  const float aspect = 0.716;
  float h = min(res.y * 0.84, res.x * 0.84 / aspect);
  vec2 hs = vec2(h * aspect, h) * 0.5;
  vec3 hp = hoverPoint(uDemo, 0.7);
  vec2 tilt = clamp((hp.xy - 0.5 * res) / hs, -1.0, 1.0) * hp.z * uTilt;
  vec2 s = (fragCoord - 0.5 * res) / hs;
  // Fake perspective: the side the pointer is on leans away.
  vec2 q = s / max(1.0 - 0.15 * dot(s, tilt), 0.2);
  float radius = uCorner * hs.x * 2.0;
  float sd = roundedBox(q * hs, hs, radius);
  float mask = 1.0 - smoothstep(-1.0, 1.0, sd);
  // A soft shadow, falling away from the tilt.
  float shadowD = roundedBox(fragCoord - 0.5 * res + tilt * hs * 0.06 + vec2(0.0, h * 0.03), hs, radius);
  float shadow = (1.0 - smoothstep(-h * 0.04, h * 0.06, shadowD)) * 0.35;
  vec4 acc = over(vec4(0.0), vec3(0.0), shadow * (1.0 - mask));
  if (mask > 0.0) {
    vec2 cuv = q * 0.5 + 0.5;
    // The picture fills the card, cropped to fit.
    vec2 ts = vec2(textureSize(uImage, 0));
    float imageAspect = ts.x / max(ts.y, 1.0);
    vec2 fit = imageAspect > aspect ? vec2(aspect / imageAspect, 1.0) : vec2(1.0, imageAspect / aspect);
    vec3 base = picture(uImage, 0.5 + (cuv - 0.5) * fit);
    // Foil: rainbow bands that slide with the tilt, strongest in a broad band facing the light.
    float n = vnoise(cuv * 5.0);
    float phase = dot(cuv, vec2(0.7, 1.1)) * 1.6 + tilt.x * 0.9 - tilt.y * 0.6 + n * 0.5;
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
    float lines = 0.75 + 0.25 * sin((cuv.x - cuv.y) * 90.0 + tilt.x * 8.0);
    float band = exp(-pow((cuv.x + cuv.y) * 0.7 - 0.7 - (tilt.x + tilt.y) * 0.6, 2.0) * 6.0);
    float foil = uFoil * (0.25 + 0.75 * band) * lines;
    // Overlay blend, so the picture keeps its darks under the foil.
    vec3 lit = mix(2.0 * base * rainbow, 1.0 - 2.0 * (1.0 - base) * (1.0 - rainbow), step(0.5, base));
    vec3 col = mix(base, lit + rainbow * 0.12, foil * 0.75);
    float sparkle = step(0.985, hash12(floor(cuv * vec2(90.0, 126.0))));
    col += sparkle * uFoil * band * (0.5 + 0.5 * sin(iTime * 3.0 + n * 20.0 + tilt.x * 10.0));
    // Glare: a highlight where the light hits, following the pointer.
    vec2 g = cuv - (0.5 + tilt * 0.55);
    col += uGlare * 0.6 * exp(-dot(g, g) * 7.0);
    // A thin foil border.
    float border = smoothstep(-0.03 * h - 1.0, -0.03 * h, sd);
    col = mix(col, uBorder * (0.8 + 0.4 * rainbow * uFoil), border);
    acc = over(acc, clamp(col, 0.0, 1.0), mask);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Subtle", values: { uFoil: 0.3, uGlare: 0.35, uTilt: 0.4 } },
    { name: "Full foil", values: { uFoil: 1, uGlare: 0.8, uTilt: 1, uBorder: [0.98, 0.82, 0.35] } },
  ],
};

export const pressCharge: ShaderEffect = {
  kind: "shader",
  id: "press-charge",
  name: "Press to charge",
  description: "A ring that fills and glows while the pointer is held and drains when it is let go, bursting if it was fully charged.",
  category: "interaction",
  tags: ["interactive", "press", "overlay", "hold", "button", "ring"],
  transparent: true,
  source: glsl(
    `// Press to charge: a ring that fills while held (iPointer.w > 0), drains when let go (iPointer.w < 0)
// and bursts if it was let go fully charged.
uniform vec3 uColor;       // @control color default=#A78BFA label="Colour"
uniform float uHold;       // @control min=0.3 max=5 default=1.2 label="Seconds to charge"
uniform float uSize;       // @control min=0.08 max=0.45 default=0.22 label="Size"
uniform float uThickness;  // @control min=0.005 max=0.08 default=0.025 label="Thickness"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  // iPointer.w: seconds held while pressed, minus the seconds since letting go after, 0 before any press.
  float w = iPointer.w;
  // The press is the newest click, so this is how long it was held when let go.
  float heldFor = iTime + min(w, 0.0) - iClicks[0].z;
  // Until someone presses, a synthetic press: hold, charge, let go, burst, rest.
  if (uDemo && iClicks[0].w < 0.5 && w == 0.0) {
    float t = mod(iTime, uHold + 2.0) - 0.4;
    float hold = uHold + 0.4;
    w = t <= 0.0 ? 0.0 : (t < hold ? t : -(t - hold));
    heldFor = hold;
  }
  float held = max(w, 0.0);
  float since = max(-w, 0.0);
  float reached = w < 0.0 ? clamp(heldFor / uHold, 0.0, 1.0) : 0.0;
  // While held it fills; once let go it drains from where it got to, over 0.4 s.
  float drain = 1.0 - smoothstep(0.0, 0.4, since);
  float charge = w > 0.0 ? clamp(held / uHold, 0.0, 1.0) : reached * drain;
  float full = step(uHold, held);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float r = length(p);
  float turn = fract(atan(p.x, p.y) / 6.28318 + 1.0);
  float R = uSize * (1.0 - 0.06 * charge + 0.03 * iPointer.z);
  float ringD = abs(r - R) - uThickness * 0.5;
  float ring = 1.0 - smoothstep(-px, px, ringD);
  vec4 acc = vec4(0.0);
  // The core fills faintly, and the track shows where the charge goes.
  acc = over(acc, uColor, (1.0 - smoothstep(R - px, R + px, r)) * 0.1 * charge);
  acc = over(acc, uColor * 0.6, ring * (0.22 + 0.1 * iPointer.z));
  // The charge: an arc clockwise from the top, glowing brighter as it fills.
  float arcEnd = (charge - turn) * 6.28318 * R / px;
  float arc = ring * clamp(arcEnd + 0.5, 0.0, 1.0) * step(0.001, charge);
  float pulse = 1.0 + full * 0.25 * sin(iTime * 9.0);
  float halo = exp(-max(ringD, 0.0) / (uThickness * 1.5)) * charge * charge * 0.6 * clamp(arcEnd + 0.5, 0.0, 1.0);
  acc = over(acc, uColor, clamp(halo * pulse, 0.0, 1.0));
  acc = over(acc, mix(uColor, vec3(1.0), 0.35 * charge * pulse), arc);
  // A ping when it fills, and a flash with a ring bursting out when let go fully charged.
  float flashAge = -1.0;
  float flashSize = 0.0;
  if (w > 0.0 && held >= uHold) { flashAge = held - uHold; flashSize = 0.5; }
  if (w < 0.0 && reached >= 1.0) { flashAge = since; flashSize = 1.0; }
  if (flashAge >= 0.0 && flashAge < 0.8) {
    float k = 1.0 - flashAge / 0.8;
    float burstR = R + flashAge * 0.6 * flashSize;
    float burst = exp(-pow((r - burstR) / (uThickness * (1.0 + flashAge * 3.0)), 2.0)) * k * k * flashSize;
    acc = over(acc, mix(uColor, vec3(1.0), 0.5), clamp(burst, 0.0, 1.0));
    acc = over(acc, vec3(1.0), exp(-r * r / (R * R * 0.5)) * exp(-flashAge * 6.0) * 0.8 * flashSize);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Hold to confirm", values: { uColor: [0.95, 0.3, 0.3], uHold: 2, uSize: 0.15, uThickness: 0.015 } },
    { name: "Power up", values: { uColor: [0.2, 0.9, 1], uHold: 0.8, uSize: 0.3, uThickness: 0.05 } },
  ],
};

export const hoverSwap: ShaderEffect = {
  kind: "shader",
  id: "hover-swap",
  name: "Hover swap",
  description: "One image burning away into another from the pointer as it hovers, along a glowing ragged edge.",
  category: "interaction",
  tags: ["interactive", "hover", "image", "dissolve", "transition"],
  source: glsl(
    `// Hover swap: image A dissolves into image B as hover goes 0 → 1, spreading from the pointer.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Hover image"
uniform vec3 uEdge;        // @control color default=#FFB86B label="Edge glow"
uniform float uEdgeWidth;  // @control min=0 max=0.3 default=0.08 label="Edge width"
uniform float uGrain;      // @control min=1 max=20 default=6 label="Noise scale"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    FBM,
    HOVER,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 hp = hoverPoint(uDemo, 0.0);
  float h = clamp(iPointer.z, 0.0, 1.0);
  // Idle, hover swings slowly in and out.
  float demo = uDemo ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 0.9)) : 0.0;
  float progress = mix(demo, 1.0, h);
  // Distance from the pointer, as a share of the way to the farthest corner.
  vec2 o = hp.xy / iResolution.y;
  vec2 size = iResolution.xy / iResolution.y;
  float far = max(max(length(o), length(o - vec2(size.x, 0.0))), max(length(o - vec2(0.0, size.y)), length(o - size)));
  float dist = length(fragCoord / iResolution.y - o) / far;
  float f = 0.65 * dist + 0.35 * fbm(fragCoord / iResolution.y * uGrain, 5);
  float w = max(uEdgeWidth, 0.005);
  float t = progress * (1.0 + w);
  float m = 1.0 - smoothstep(t - w, t, f);
  vec3 col = mix(picture(uFrom, uv), picture(uTo, uv), m);
  float edge = m * (1.0 - m) * 4.0 * step(0.001, uEdgeWidth);
  col = mix(col, uEdge, edge * 0.85);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Clean cut", values: { uEdgeWidth: 0.01, uGrain: 2 } },
    { name: "Embers", values: { uEdge: [1, 0.35, 0.1], uEdgeWidth: 0.2, uGrain: 14 } },
  ],
};

/** Shaders that answer the pointer: hovers, presses and clicks (`iPointer`, `iClicks`). */
export const interactionShaders: ShaderEffect[] = [
  clickRipple,
  clickBurst,
  cursorGlow,
  hoverLiquid,
  hoverReveal,
  magnifier,
  holoCard,
  pressCharge,
  hoverSwap,
];
