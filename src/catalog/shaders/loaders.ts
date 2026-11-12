import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";
import { FIRE, FIRE_COLOURS } from "./fire.js";

/*
 * Loaders as shaders: soft light, liquid and goo that SVG cannot draw. They
 * sit centred in the frame at a size relative to its height, draw on clear
 * (with a background a control away) so they drop onto any card, and the
 * ones that fill up loop over a cycle with a still progress control.
 */

/** A background for the loaders, off by default. */
const LOADER_BACKGROUND = `
uniform vec3 uBackground;       // @control color default=#0F172A label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `finish(acc)` puts it over the background, as the output. */
const COMPOSITE = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 finish(vec4 acc) {
  vec4 base = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  vec4 o = vec4(acc.rgb + base.rgb * (1.0 - acc.a), acc.a + base.a * (1.0 - acc.a));
  return vec4(o.rgb / max(o.a, 1e-4), o.a);
}`.trim();

/** `fillCycle(period)`: how full, 0–1, over a loop: filling, holding full, then emptying fast. */
const FILL_CYCLE = `
float fillCycle(float period) {
  float u = fract(iTime / period);
  float f = smoothstep(0.0, 0.72, u);
  return f * (1.0 - smoothstep(0.86, 0.98, u));
}`.trim();

export const liquidLoader: ShaderEffect = {
  kind: "shader",
  id: "liquid-loader",
  name: "Liquid loader",
  description: "A glass circle filling with sloshing liquid, two waves rolling across its surface and bubbles rising, then draining to fill again.",
  category: "loader",
  tags: ["loader", "progress", "liquid", "water", "fill", "ui", "overlay", "loop"],
  transparent: true,
  loop: 6,
  source: glsl(
    `// Liquid loader: a circle filling with sloshing liquid, a lighter wave behind, bubbles rising.
uniform vec3 uLiquid;           // @control color default=#3B82F6 label="Liquid"
uniform vec3 uBack;             // @control color default=#93C5FD label="Back wave"
uniform vec3 uGlass;            // @control color default=#CBD5E1 label="Glass"
uniform float uSize;            // @control min=0.3 max=0.95 default=0.7 label="Size"
uniform float uSlosh;           // @control min=0 max=1 default=0.5 label="Slosh"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.6 label="Full (when still)"
${LOADER_BACKGROUND}`,
    HASH,
    COMPOSITE,
    FILL_CYCLE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float R = 0.5 * uSize;
  float r = length(p);
  float level = uAnimate ? fillCycle(6.0) : uProgress;
  // The surface: from below the glass at empty to above it at full; the waves repeat every 6 s, so it loops.
  float w = 6.28318 / 6.0;
  float y0 = mix(-R * 1.08, R * 1.08, level);
  float amp = R * 0.07 * uSlosh * (0.4 + 0.6 * sin(3.14159 * level));
  float front = y0 + amp * sin(p.x / R * 5.0 + iTime * w * 6.0) + amp * 0.5 * sin(p.x / R * 9.0 - iTime * w * 4.0);
  float back = y0 + amp * 1.2 * sin(p.x / R * 4.0 - iTime * w * 5.0 + 1.3) + R * 0.02;
  float inner = R * 0.88;
  float inside = smoothstep(inner, inner - px, r);
  vec4 acc = vec4(0.0);
  // The glass: a faint tint inside, a rim and a highlight.
  acc = over(acc, uGlass, 0.12 * inside);
  acc = over(acc, uBack, smoothstep(px, -px, p.y - back) * inside);
  float liquid = smoothstep(px, -px, p.y - front) * inside;
  // Darker deeper down, a bright line at the surface.
  vec3 lc = uLiquid * (0.8 + 0.25 * smoothstep(-inner, front, p.y)) + 0.35 * exp(-abs(p.y - front) / (2.0 * px + 0.004));
  acc = over(acc, lc, liquid);
  // Bubbles rising through the liquid, on a 6 s cycle.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float life = fract(iTime / 6.0 * (2.0 + mod(fi, 3.0)) + hash12(vec2(fi, 3.1)));
    vec2 b = vec2((hash12(vec2(fi, 1.7)) - 0.5) * inner * 1.4 + 0.02 * sin(life * 12.0 + fi), -inner + life * (front + inner));
    float br = R * (0.025 + 0.025 * hash12(vec2(fi, 5.3)));
    float ring = smoothstep(br, br - px, length(p - b)) - 0.6 * smoothstep(br * 0.7, br * 0.7 - px, length(p - b));
    acc = over(acc, vec3(1.0), clamp(ring, 0.0, 1.0) * 0.55 * liquid * step(b.y, front - br));
  }
  float rim = smoothstep(R, R - px, r) - smoothstep(inner + px, inner, r);
  acc = over(acc, uGlass, rim);
  float shine = smoothstep(0.012, 0.0, abs(r - inner * 0.86)) * smoothstep(0.2, 0.75, -p.x / R + p.y / R) * inside;
  acc = over(acc, vec3(1.0), shine * 0.45);
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Potion", values: { uLiquid: [0.55, 0.2, 0.9], uBack: [0.85, 0.45, 0.95], uSlosh: 0.9 } },
    { name: "Lime", values: { uLiquid: [0.4, 0.8, 0.15], uBack: [0.75, 0.95, 0.45] } },
    { name: "Still at half", values: { uAnimate: false, uProgress: 0.5 } },
  ],
};

export const glowRingSpinner: ShaderEffect = {
  kind: "shader",
  id: "glow-ring-spinner",
  name: "Glow ring spinner",
  description: "A ring of light sweeping round with a soft glowing gradient tail, its tail stretching and shrinking as it turns.",
  category: "loader",
  tags: ["loader", "spinner", "ring", "glow", "neon", "ui", "overlay"],
  transparent: true,
  source: glsl(
    `// Glow ring spinner: a bright head sweeping round a ring, a gradient tail glowing behind it.
uniform vec3 uHead;             // @control color default=#22D3EE label="Head"
uniform vec3 uTail;             // @control color default=#A855F7 label="Tail"
uniform vec3 uTrack;            // @control color default=#1E293B label="Track"
uniform float uSize;            // @control min=0.3 max=0.95 default=0.65 label="Size"
uniform float uThickness;       // @control min=0.01 max=0.12 default=0.045 label="Thickness"
uniform float uSpeed;           // @control min=0.2 max=3 default=1 label="Turns per second"
uniform float uGlow;            // @control min=0 max=2 default=1 label="Glow"
uniform float uTrackAlpha;      // @control min=0 max=1 default=0.5 label="Track opacity"
${LOADER_BACKGROUND}`,
    COMPOSITE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float R = 0.5 * uSize - uThickness;
  float r = length(p);
  float d = abs(r - R);
  float band = smoothstep(uThickness * 0.5, uThickness * 0.5 - px, d);
  // How far behind the head each point is, 0–1 of a turn; the tail breathes between a third and most of a turn.
  float head = fract(iTime * uSpeed);
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  float behind = fract(head - a);
  float len = 0.45 + 0.3 * (0.5 + 0.5 * sin(iTime * uSpeed * 3.14159));
  // Soft at the very front too (the head's cap covers it), so the glow has no hard edge.
  float tail = pow(clamp(1.0 - behind / len, 0.0, 1.0), 1.2) * smoothstep(0.0, 0.015, behind);
  vec3 col = mix(uTail, uHead, tail);
  vec4 acc = over(vec4(0.0), uTrack, band * uTrackAlpha);
  acc = over(acc, col, band * tail);
  // Glow round the lit part, brightest at the head, and a round cap on the head.
  float hang = (head - 0.5) * 6.28318;
  vec2 hp = vec2(cos(hang), sin(hang)) * R;
  float cap = smoothstep(uThickness * 0.5, uThickness * 0.5 - px, length(p - hp));
  acc = over(acc, uHead, cap);
  vec3 light = col * tail * exp(-d / (uThickness * 1.2)) * 0.6 * uGlow + uHead * exp(-length(p - hp) / (uThickness * 1.5)) * 0.8 * uGlow;
  light = 1.0 - exp(-light);
  float la = max(light.r, max(light.g, light.b));
  acc = vec4(acc.rgb + light * (1.0 - acc.a), acc.a + la * (1.0 - acc.a));
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Sunset", values: { uHead: [1, 0.85, 0.3], uTail: [0.95, 0.25, 0.45] } },
    { name: "Thin", values: { uThickness: 0.02, uGlow: 0.6 } },
    { name: "Light card", values: { uTrack: [0.9, 0.92, 0.95], uGlow: 0.4, uBackground: [1, 1, 1], uBackgroundAlpha: 1 } },
  ],
};

export const metaballLoader: ShaderEffect = {
  kind: "shader",
  id: "metaball-loader",
  name: "Metaball loader",
  description: "Gooey blobs chasing each other round a circle, stretching apart and merging back together as they pass.",
  category: "loader",
  tags: ["loader", "spinner", "metaball", "goo", "blob", "playful", "overlay"],
  transparent: true,
  source: glsl(
    `// Metaball loader: blobs racing round a circle at their own speeds, merging where they meet.
uniform vec3 uColor;            // @control color default=#EC4899 label="Colour"
uniform vec3 uColor2;           // @control color default=#8B5CF6 label="Second colour"
uniform float uSize;            // @control min=0.3 max=0.95 default=0.6 label="Size"
uniform int uCount;             // @control min=2 max=7 default=5 label="Blobs"
uniform float uGoo;             // @control min=0.3 max=1.5 default=0.9 label="Gooeyness"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
${LOADER_BACKGROUND}`,
    COMPOSITE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float R = 0.32 * uSize;
  float t = iTime * uSpeed;
  float field = 0.0;
  vec2 grad = vec2(0.0);
  float hue = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    // Each blob laps at its own pace, easing in and out, so they bunch up and spread apart.
    float lap = t * 0.7 + fi / float(uCount);
    float ang = 6.28318 * (lap + 0.12 * sin(6.28318 * lap * 1.0 + fi));
    vec2 c = vec2(cos(ang), sin(ang)) * R;
    float rb = R * (0.46 - 0.08 * fi / float(uCount));
    vec2 d = p - c;
    // Kept finite at the blob's middle, where the field and its slope would blow up.
    float dd = max(dot(d, d), rb * rb * 0.05);
    float k = rb * rb / dd;
    field += k;
    grad += -2.0 * k * d / dd;
    hue += k * fi / max(float(uCount) - 1.0, 1.0);
  }
  // And a still blob in the middle that they reach toward.
  float kc = (R * 0.3) * (R * 0.3) / max(dot(p, p), 1e-6) * 0.6;
  field += kc;
  float thr = 1.0 / uGoo;
  float edge = (field - thr) / max(length(grad), 1e-4);
  float inside = smoothstep(-px, px, edge);
  vec3 col = mix(uColor, uColor2, clamp(hue / max(field - kc, 1e-4), 0.0, 1.0));
  // Lit from the upper left: a soft sheen across each blob and a darker rim.
  // Only near the edge, where the slope is sound (it vanishes at each blob's middle).
  vec2 n = -normalize(grad + 1e-6);
  float lightSide = dot(n, normalize(vec2(-0.6, 0.8)));
  float rim = exp(-max(edge, 0.0) / 0.025);
  col *= 1.0 - 0.25 * rim * (1.0 - lightSide) * 0.5;
  col += 0.3 * rim * smoothstep(0.4, 0.95, lightSide) * smoothstep(0.004, 0.012, edge);
  vec4 acc = over(vec4(0.0), col, inside);
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Mercury", values: { uColor: [0.75, 0.78, 0.82], uColor2: [0.45, 0.48, 0.55], uGoo: 1.2 } },
    { name: "Lava", values: { uColor: [1, 0.55, 0.1], uColor2: [0.9, 0.15, 0.1], uSpeed: 0.6 } },
    { name: "Few", values: { uCount: 3, uGoo: 0.7 } },
  ],
};

export const flameLoader: ShaderEffect = {
  kind: "shader",
  id: "flame-loader",
  name: "Flame loader",
  description: "A progress bar that burns along its length: the filled part glows like embers under flames, tallest at the leading edge, sparks flying off it.",
  category: "loader",
  tags: ["loader", "progress", "bar", "fire", "flames", "overlay", "loop"],
  transparent: true,
  loop: 6,
  source: glsl(
    `// Flame loader: a bar filling with fire, glowing embers along it under flames that lean back from the front.
uniform vec3 uTrack;            // @control color default=#2A1A14 label="Track"
uniform float uWidth;           // @control min=0.3 max=0.95 default=0.8 label="Width"
uniform float uThickness;       // @control min=0.02 max=0.12 default=0.05 label="Thickness"
uniform float uHeight;          // @control min=0 max=0.4 default=0.16 label="Flame height"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.65 label="Progress (when still)"
${FIRE_COLOURS}
${LOADER_BACKGROUND}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    FILL_CYCLE,
    `float boxSdf(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px + vec2(0.0, uHeight * 0.35);
  float aspect = iResolution.x * px;
  vec2 half_ = vec2(0.5 * aspect * uWidth, 0.5 * uThickness);
  float rad = half_.y;
  float sd = boxSdf(p, half_, rad);
  float progress = uAnimate ? fillCycle(6.0) : uProgress;
  float frontX = -half_.x + 2.0 * half_.x * progress;
  float behind = frontX - p.x;
  float lit = smoothstep(-0.004, 0.004, behind) * step(0.001, progress);
  float t = iTime * 1.8;
  vec4 acc = vec4(0.0);
  float inBar = smoothstep(px, -px, sd);
  acc = vec4(uTrack * inBar, inBar);
  // The burning part: embers glowing hottest near the front, crawling with noise.
  float embers = fbm(vec2(p.x * 40.0, p.y * 40.0) + vec2(0.0, -t * 0.4), 4);
  float glowHeat = (0.35 + 0.5 * embers) * (0.6 + 0.4 * exp(-behind / 0.15));
  vec3 coal = 1.0 - exp(-fireLight(glowHeat));
  acc = vec4(mix(acc.rgb, coal, inBar * lit), acc.a);
  // Flames off the top of the burning part: the bar looked for lower down as the noise says, tallest at the front.
  float n = flameNoise(p * 9.0, t);
  float near = exp(-max(behind, 0.0) / 0.25);
  float h = uHeight * (0.35 + 0.65 * near);
  float lift = h * (0.03 + 1.6 * n * n);
  vec2 q = p - vec2(-lift * 0.5 + (vnoise(vec2(p.y * 8.0 - t, p.x * 3.0)) - 0.5) * h * 0.3, lift);
  float qBehind = frontX - q.x;
  float flames = smoothstep(0.012, -0.004, boxSdf(q, half_, rad)) * smoothstep(-0.004, 0.01, qBehind) * pow(max(1.0 - lift / (h * 1.3 + 1e-4), 0.0), 1.3) * (0.45 + 0.75 * n);
  vec3 light = fireLight(flames * step(0.001, progress) * step(0.001, uHeight)) * (1.0 - inBar * 0.7);
  // A hot spot at the front and sparks flying off it.
  light += mix(uHot, uMid, 0.3) * exp(-length((p - vec2(frontX, 0.0)) * vec2(1.0, 1.5)) / (uThickness * 0.8)) * 0.8 * step(0.001, progress) * step(progress, 0.999);
  float rise = exp(-max(p.y - half_.y, 0.0) / (uHeight * 1.5 + 0.03)) * smoothstep(-half_.y, half_.y, p.y) * exp(-abs(p.x - frontX) / 0.08);
  light += mix(uHot, uMid, 0.4) * sparks(p, iTime, uSparks) * rise * 1.6 * step(0.001, progress);
  vec4 base = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  acc = vec4(acc.rgb + base.rgb * (1.0 - acc.a), acc.a + base.a * (1.0 - acc.a));
  fragColor = fireOver(acc, light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Blue flame", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6], uTrack: [0.08, 0.1, 0.2] } },
    { name: "Tall flames", values: { uHeight: 0.32, uSparks: 0.9 } },
    { name: "Still at two thirds", values: { uAnimate: false, uProgress: 0.66 } },
  ],
};

export const ringedOrb: ShaderEffect = {
  kind: "shader",
  id: "ringed-orb",
  name: "Ringed orb",
  description:
    "A glossy orb wrapped in a slowly turning ring of fine dashes and drifting specks, on a dark halo disk with a light sweeping round its rim; a hero icon or a thinking indicator.",
  category: "loader",
  tags: ["loader", "orbs", "ring", "glow", "hero", "thinking", "ai", "tech", "overlay"],
  transparent: true,
  source: glsl(
    `// Ringed orb: a lit sphere, two counter-turning rings of dashes and specks round it, and a dark disk behind with a light running round its edge.
uniform vec3 uOrb;              // @control color default=#B7A4FF label="Orb"
uniform vec3 uRim;              // @control color default=#7B5CFF label="Orb rim"
uniform vec3 uRing;             // @control color default=#9C8CF5 label="Ring"
uniform vec3 uAccent;           // @control color default=#5EE6D8 label="Accent"
uniform vec3 uDisk;             // @control color default=#0E2B30 label="Disk"
uniform float uDiskAlpha;       // @control min=0 max=1 default=0.7 label="Disk opacity"
uniform float uSize;            // @control min=0.3 max=0.98 default=0.8 label="Size"
uniform int uTicks;             // @control min=40 max=240 default=150 label="Dashes"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
uniform float uSweep;           // @control min=0 max=3 default=1 label="Rim light speed"
uniform float uGlow;            // @control min=0 max=2 default=1 label="Glow"
${LOADER_BACKGROUND}`,
    HASH,
    COMPOSITE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float W = 0.5 * uSize;
  float r = length(p);
  float turn = atan(p.y, p.x) / 6.28318 + 0.5;
  vec4 acc = vec4(0.0);
  vec3 light = vec3(0.0);

  // The halo disk: dark, a little lighter toward its edge, with a faint rim and a light sweeping round it.
  float disk = smoothstep(W, W - 1.5 * px, r);
  acc = over(acc, uDisk, disk * uDiskAlpha * (0.55 + 0.45 * smoothstep(W * 0.2, W, r)));
  float edge = exp(-abs(r - W) / (1.2 * px + W * 0.006));
  float behind = fract(turn - iTime * uSweep * 0.12);
  float sweep = pow(behind, 5.0) * smoothstep(1.0, 0.96, behind);
  light += mix(uRing, uAccent, 0.5) * edge * (0.12 + 0.9 * sweep) * uDiskAlpha;

  // A soft glowing band under the dashes.
  light += uRing * 0.12 * uGlow * exp(-abs(r - W * 0.62) / (W * 0.09));

  // Two rings turning opposite ways: radial dashes of scattered length, then round specks.
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float spin = iTime * uSpeed * (layer == 0 ? 0.035 : -0.023);
    float n = float(uTicks) * (layer == 0 ? 1.0 : 0.6);
    float a = (turn + spin) * n;
    float cell = floor(a);
    float h1 = hash12(vec2(cell, 3.1 + fl * 17.0));
    float h2 = hash12(vec2(cell + 41.0, 7.7 + fl));
    float h3 = hash12(vec2(cell + 83.0, 1.3 + fl * 5.0));
    float h4 = hash12(vec2(cell + 127.0, 9.4 + fl * 3.0));
    // Tangential distance from the cell's middle, in frame units.
    float along = (fract(a) - 0.5) / n * 6.28318 * r;
    float rc = W * (layer == 0 ? 0.54 + 0.14 * h1 : 0.5 + 0.26 * h1);
    float d;
    if (layer == 0) {
      float len = W * (0.015 + 0.07 * h2 * h2);
      d = max(abs(along) - (0.6 * px + W * 0.0035), abs(r - rc) - len);
    } else {
      d = length(vec2(along, r - rc)) - (0.6 * px + W * (0.004 + 0.007 * h2));
    }
    float cover = clamp(0.5 - d / px, 0.0, 1.0);
    float bright = (0.35 + 0.65 * h3) * (0.7 + 0.3 * sin(iTime * (1.0 + 2.0 * h4) + h3 * 6.28318));
    vec3 c = mix(uRing, uAccent, step(0.88, h4));
    acc = over(acc, c, cover * bright);
    light += c * bright * 0.35 * uGlow * exp(-max(d, 0.0) / (W * 0.012));
  }

  // The orb: a lit sphere breathing a little, with a white highlight, a coloured rim and a faint bounce from below.
  float R = W * 0.36 * (1.0 + 0.012 * sin(iTime * 1.3));
  float s = smoothstep(R, R - 1.5 * px, r);
  vec2 q = p / R;
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  vec3 nrm = vec3(q, z);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float diff = max(dot(nrm, L), 0.0);
  float spec = pow(max(dot(reflect(-L, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
  float fres = pow(1.0 - z, 2.5);
  vec3 orb = uOrb * (0.22 + 0.85 * diff) + uRim * fres * 0.9 + vec3(spec * 0.9);
  orb += uAccent * 0.18 * pow(max(dot(nrm, normalize(vec3(0.5, -0.65, 0.4))), 0.0), 3.0);
  acc = over(acc, orb, s);
  light += uRim * 0.55 * uGlow * exp(-max(r - R, 0.0) / (R * 0.22)) * (1.0 - s);

  light = 1.0 - exp(-light);
  float la = max(light.r, max(light.g, light.b));
  acc = vec4(acc.rgb + light * (1.0 - acc.a), acc.a + la * (1.0 - acc.a));
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackground: [0.04, 0.1, 0.12], uBackgroundAlpha: 1 } },
    { name: "Gold", values: { uOrb: [1, 0.85, 0.5], uRim: [0.95, 0.55, 0.15], uRing: [0.95, 0.78, 0.45], uAccent: [1, 1, 0.9] } },
    { name: "Cyan", values: { uOrb: [0.55, 0.95, 1], uRim: [0.1, 0.6, 0.95], uRing: [0.35, 0.85, 0.95], uAccent: [0.75, 0.6, 1] } },
    { name: "No disk", values: { uDiskAlpha: 0, uSize: 0.9 } },
  ],
};

/** Loaders as shaders: liquid, a glowing ring, goo, fire and a ringed orb. */
export const loaderShaders: ShaderEffect[] = [liquidLoader, glowRingSpinner, metaballLoader, flameLoader, ringedOrb];
