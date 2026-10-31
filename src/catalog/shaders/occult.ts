import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

/*
 * Occult: horror effects from the ritual. A sigil drawing itself and flaring,
 * a cauldron bubbling under green steam, and a ring of candles that gutter
 * out all at once. Each is tagged "horror" and "occult", and paints its own
 * background, which its Background opacity control can key out.
 */

const SEGMENT = `
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  return length(p - a - ba * clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0));
}`.trim();

export const summoningCircle: ShaderEffect = {
  kind: "shader",
  id: "summoning-circle",
  name: "Summoning circle",
  description:
    "A glowing sigil drawing itself: a double ring traced round from the top, runes filling the band between, then a star struck point to point, before it flares, a shockwave rolling out, and fades. Loops; or turn Animate off and set Drawn.",
  category: "horror",
  tags: ["horror", "occult", "sigil", "pentagram", "ritual", "glow", "summon", "magic", "background"],
  loop: 6,
  source: glsl(
    `// Summoning circle, over a cycle: the rings trace round (with the runes between them), then the star's edges
// draw one after another; at the flare everything brightens and a ring rolls outward; then it fades.
uniform vec3 uBackground;  // @control color default=#070208 label="Background"
uniform vec3 uColor;       // @control color default=#FF3524 label="Glow"
uniform vec3 uCore;        // @control color default=#FFE6C4 label="Core"
uniform float uSize;       // @control min=0.15 max=0.48 default=0.38 label="Radius"
uniform float uPoints;     // @control min=5 max=9 default=5 step=2 label="Star points"
uniform float uRunes;      // @control min=0 max=1 default=0.8 label="Runes"
uniform float uWidth;      // @control min=1 max=12 default=4 label="Line width"
uniform float uSpin;       // @control min=-1 max=1 default=0.05 label="Spin"
uniform float uCycle;      // @control min=3 max=12 default=6 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Drawn (when still)"`,
    HASH,
    SEGMENT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float u = fract(iTime / uCycle);
  float drawn = uAnimate ? smoothstep(0.0, 0.55, u) : uProgress;
  float flare = uAnimate ? exp(-pow((u - 0.62) / 0.035, 2.0)) : 0.0;
  float fade = uAnimate ? 1.0 - smoothstep(0.78, 0.97, u) : 1.0;
  float spin = iTime * uSpin;
  p = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * p;
  float R = uSize;
  float r = length(p);
  // From the top, clockwise, 0 to 1 round.
  float round_ = fract(0.25 - atan(p.y, p.x) / 6.28318);
  float w = uWidth * 0.001;
  float ring = clamp(drawn / 0.4, 0.0, 1.0);
  float shown = step(round_, ring);
  float d = min(abs(r - R), abs(r - 0.86 * R)) + (1.0 - shown) * 10.0;
  // Runes in the band: a couple of strokes in each cell round it.
  float cells = 28.0;
  float ci = floor(round_ * cells);
  vec2 g = vec2(fract(round_ * cells), (r - 0.875 * R) / (0.11 * R));
  if (g.y > 0.0 && g.y < 1.0 && uRunes > 0.0 && step((ci + 0.5) / cells, ring) > 0.0) {
    vec2 cell = vec2((g.x - 0.5) * (6.28318 * 0.93 * R / cells) / (0.11 * R) + 0.5, g.y);
    for (int k = 0; k < 2; k++) {
      vec4 h = vec4(hash22(vec2(ci, float(k) * 3.0)), hash22(vec2(ci + 9.0, float(k) * 5.0)));
      if (hash12(vec2(ci, 7.0)) > uRunes) break;
      float rd = segDist(cell, vec2(0.25, 0.15) + h.xy * vec2(0.5, 0.7), vec2(0.25, 0.15) + h.zw * vec2(0.5, 0.7));
      d = min(d, rd * 0.11 * R);
    }
  }
  // The star, its edges struck in turn.
  float n = floor(uPoints + 0.5);
  float step_ = floor((n - 1.0) / 2.0);
  float edges = clamp((drawn - 0.4) / 0.6, 0.0, 1.0) * n;
  for (int e = 0; e < 9; e++) {
    float fe = float(e);
    if (fe >= n || fe >= edges) break;
    float a0 = 1.5708 - 6.28318 * fe * step_ / n;
    float a1 = 1.5708 - 6.28318 * (fe + 1.0) * step_ / n;
    vec2 v0 = 0.86 * R * vec2(cos(a0), sin(a0));
    vec2 v1 = 0.86 * R * vec2(cos(a1), sin(a1));
    v1 = mix(v0, v1, clamp(edges - fe, 0.0, 1.0));
    d = min(d, segDist(p, v0, v1));
  }
  float bright = fade * (1.0 + 2.5 * flare);
  float core = (1.0 - smoothstep(0.35 * w, w, d)) * bright;
  float glow = exp(-d / (3.0 * w + 0.004 * flare)) * 0.7 * bright;
  // The flare: light filling the circle and a shockwave rolling out from its edge.
  float wave = uAnimate ? exp(-abs(r - R * (1.0 + (u - 0.6) * 4.0)) / 0.01) * smoothstep(0.6, 0.62, u) * (1.0 - smoothstep(0.62, 0.8, u)) : 0.0;
  glow += flare * 0.5 * (1.0 - smoothstep(0.0, R, r)) + wave * 0.8;
  vec3 col = uBackground + uColor * glow + uCore * clamp(core, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Arcane blue", values: { uColor: [0.25, 0.55, 1], uCore: [0.85, 0.95, 1] } },
    { name: "Hellfire", values: { uColor: [1, 0.45, 0.08], uWidth: 7 } },
    { name: "Seven points", values: { uPoints: 7, uRunes: 1 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

export const cauldron: ShaderEffect = {
  kind: "shader",
  id: "cauldron",
  name: "Cauldron",
  description:
    "A black iron cauldron with a glowing green brew swirling and bubbling at its brim, bubbles swelling and popping, its light catching the rim as green steam curls up out of it.",
  category: "horror",
  tags: ["horror", "occult", "cauldron", "witch", "brew", "potion", "bubble", "steam", "halloween", "background"],
  source: glsl(
    `// Cauldron: the pot is an ellipse below its rim, the rim an elliptical ring, the brew the ellipse inside it.
// Bubbles sit in a grid on the brew's surface, each swelling over its own period and popping; steam is noise
// rising above the brim, widening as it goes, lit by the brew.
uniform vec3 uBackground;  // @control color default=#050806 label="Background"
uniform vec3 uBrew;        // @control color default=#5BFF48 label="Brew"
uniform vec3 uPot;         // @control color default=#101012 label="Pot"
uniform vec3 uSteam;       // @control color default=#86FFB8 label="Steam"
uniform float uBubbles;    // @control min=0 max=1 default=0.7 label="Bubbling"
uniform float uSteamAmount;// @control min=0 max=1 default=0.7 label="Steam"
uniform float uSize;       // @control min=0.4 max=1.4 default=0.85 label="Size"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y / uSize;
  vec2 q = p / uSize - vec2(0.0, -0.12);
  vec3 col = uBackground;
  // The brew's light on everything round it.
  col += uBrew * 0.22 * exp(-length((q - vec2(0.0, 0.05)) / vec2(1.0, 0.6)) / 0.25);
  // The pot: a squat bowl, three stubby legs, a rim lit green from above.
  float bowl = length((q - vec2(0.0, -0.16)) / vec2(0.34, 0.27)) - 1.0;
  float body = max(bowl, q.y - 0.0);
  float legs = 1e5;
  for (int i = -1; i <= 1; i++) legs = min(legs, length((q - vec2(float(i) * 0.2, -0.43)) / vec2(0.04, 0.05)) - 1.0);
  float potCover = 1.0 - smoothstep(-px * 3.0, px * 3.0, min(body * 0.27, legs * 0.04));
  vec3 iron = uPot * (0.7 + 0.6 * smoothstep(-0.3, 0.3, q.x * -1.0)) + uBrew * 0.12 * smoothstep(-0.25, 0.0, q.y);
  col = mix(col, iron, potCover);
  vec2 e = (q - vec2(0.0, 0.0)) / vec2(0.31, 0.07);
  float rimOuter = length(e) - 1.0;
  float rimInner = length((q - vec2(0.0, 0.004)) / vec2(0.27, 0.052)) - 1.0;
  float rim = max(rimOuter * 0.07, -rimInner * 0.052);
  float rimCover = 1.0 - smoothstep(-px, px, rim);
  vec3 rimCol = uPot * 1.6 + uBrew * 0.45 * smoothstep(0.02, -0.04, q.y - 0.0) + uBrew * 0.25 * smoothstep(0.0, 0.06, q.y);
  col = mix(col, rimCol, rimCover);
  // The brew: swirling, brighter in its middle, bubbles swelling and popping across it.
  vec2 s = (q - vec2(0.0, 0.004)) / vec2(0.27, 0.052);
  float inBrew = 1.0 - smoothstep(-px * 4.0, px * 4.0, (length(s) - 1.0) * 0.052);
  if (inBrew > 0.0) {
    float a = atan(s.y, s.x) + iTime * 0.4;
    float swirl = vnoise(vec2(a * 2.0, length(s) * 4.0 - iTime * 0.5));
    vec3 brew = uBrew * (0.55 + 0.35 * swirl + 0.3 * (1.0 - length(s)));
    vec2 bg = s * vec2(5.0, 2.0);
    vec2 bi = floor(bg);
    vec2 bh = hash22(bi + 3.1);
    float period = 1.2 + 1.6 * bh.x;
    float life = fract(iTime / period + bh.y);
    float br = 0.42 * smoothstep(0.0, 0.85, life) * step(hash12(bi + 1.7), uBubbles);
    vec2 bf = (fract(bg) - 0.5) * vec2(1.0, 1.6);
    float bd = length(bf);
    float bubble = (1.0 - smoothstep(br - 0.06, br, bd)) * (1.0 - step(0.88, life));
    brew = mix(brew, uBrew * 1.25 + 0.15, bubble * smoothstep(br * 0.5, br, bd));
    brew = mix(brew, uBrew * 0.45, bubble * (1.0 - smoothstep(0.0, br * 0.6, bd)) * 0.5);
    // The pop: a bright ring for a moment.
    float pop = smoothstep(0.88, 0.9, life) * (1.0 - smoothstep(0.9, 1.0, life));
    brew += uBrew * pop * exp(-abs(bd - 0.45) / 0.05) * step(hash12(bi + 1.7), uBubbles);
    col = mix(col, brew, inBrew);
  }
  // Steam rising from the brim, widening and thinning, curling as it goes.
  if (q.y > -0.02) {
    float h = q.y;
    float wobble = 0.06 * sin(h * 6.0 - iTime * 1.2) + 0.04 * sin(h * 11.0 + iTime * 0.7);
    float width = 0.22 + h * 0.45;
    float mask = (1.0 - smoothstep(0.4 * width, width, abs(q.x - wobble))) * smoothstep(-0.02, 0.06, h) * (1.0 - smoothstep(0.25, 0.95, h));
    float plume = fbm(vec2(q.x * 4.0 - wobble * 3.0, h * 3.0 - iTime * 0.55), 4);
    float steam = smoothstep(0.35, 0.8, plume) * mask * uSteamAmount;
    col = mix(col, uSteam * (0.6 + 0.4 * (1.0 - h)), steam * 0.75);
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Purple potion", values: { uBrew: [0.75, 0.35, 1], uSteam: [0.85, 0.65, 1] } },
    { name: "Blood", values: { uBrew: [0.85, 0.06, 0.08], uSteam: [0.75, 0.6, 0.6] } },
    { name: "Simmer", values: { uBubbles: 0.3, uSteamAmount: 0.35 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

export const candleRing: ShaderEffect = {
  kind: "shader",
  id: "candle-ring",
  name: "Candle ring",
  description:
    "A ring of candles on a dark floor, flames flickering in a pool of their light, until all of them gutter and go out at once, smoke curling up in the dark, before they relight one by one round the ring. Loops; or turn Animate off and set Light.",
  category: "horror",
  tags: ["horror", "occult", "candle", "ritual", "flames", "flicker", "smoke", "seance", "background"],
  loop: 9,
  source: glsl(
    `// Candle ring: candles on an ellipse (a ring seen from above at an angle), smaller towards the back. Over the
// cycle they burn, gutter out together, smoke in the dark, then relight in turn round the ring.
uniform vec3 uBackground;  // @control color default=#040306 label="Background"
uniform vec3 uWax;         // @control color default=#E9DDC3 label="Wax"
uniform vec3 uFlame;       // @control color default=#FFB044 label="Flame"
uniform float uCount;      // @control min=3 max=13 default=9 step=1 label="Candles"
uniform float uRadius;     // @control min=0.15 max=0.5 default=0.36 label="Ring size"
uniform float uTilt;       // @control min=0.15 max=0.8 default=0.38 label="Viewing angle"
uniform float uCycle;      // @control min=4 max=20 default=9 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Light (when still)"`,
    HASH,
    NOISE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float u = fract(iTime / uCycle);
  int n = int(uCount + 0.5);
  float fn = float(n);
  vec3 col = uBackground;
  vec3 light = vec3(0.0);
  float total = 0.0;
  // The nearest candle drawn so far at this pixel, so ones behind it do not paint over it.
  float nearest = 2.0;
  for (int j = 0; j < 13; j++) {
    if (j >= n) break;
    float fj = float(j);
    float theta = 6.28318 * fj / fn + 0.3;
    float depth = sin(theta);
    float scale = 1.0 - 0.28 * depth;
    vec2 base = vec2(uRadius * 1.25 * cos(theta), uRadius * uTilt * depth - 0.1);
    // How lit it is: burning, guttering out together, dark, then relit in turn.
    float level = 1.0;
    if (uAnimate) {
      float relight = 0.78 + 0.16 * fj / fn;
      level = (1.0 - smoothstep(0.5, 0.56, u)) + smoothstep(relight, relight + 0.02, u);
      level = clamp(level, 0.0, 1.0);
    } else level = uProgress;
    float gutter = uAnimate ? smoothstep(0.44, 0.52, u) * (1.0 - smoothstep(0.56, 0.6, u)) : 0.0;
    float h = 0.15 * scale * (0.85 + 0.3 * hash12(vec2(fj, 2.0)));
    float w = 0.022 * scale;
    // The candle: a lit cylinder, brighter near its flame.
    vec2 c = p - base;
    float side = abs(c.x) - w;
    float body = max(side, max(-c.y, c.y - h));
    float cover = clamp(0.5 - body / px, 0.0, 1.0);
    float roundness = sqrt(max(1.0 - (c.x / w) * (c.x / w), 0.0));
    vec3 wax = uWax * (0.18 + 0.5 * roundness) * (0.35 + 0.65 * level * smoothstep(-0.05, h, c.y));
    bool front = depth < nearest;
    if (front) col = mix(col, wax, cover);
    // The flame: a teardrop above the wick, flickering and leaning; guttering makes it shrink and stutter.
    float flick = vnoise(vec2(iTime * 9.0, fj * 7.0));
    float size = 0.028 * scale * level * (0.8 + 0.3 * flick) * (1.0 - 0.5 * gutter * vnoise(vec2(iTime * 20.0, fj)));
    vec2 f = c - vec2((flick - 0.5) * 0.01 * scale + gutter * 0.012 * scale, h + 0.012 * scale);
    float fd = 1e5;
    if (size > 1e-4) {
      vec2 fq = f / size;
      fq.y = fq.y < 0.0 ? fq.y * 1.4 : fq.y * 0.45;
      fd = length(fq) - 0.5;
      float flame = clamp(0.5 - fd * size / px, 0.0, 1.0);
      if (front) col = mix(col, mix(uFlame, vec3(1.0, 0.97, 0.88), smoothstep(0.1, -0.35, fd)), flame);
      if (flame > 0.5) cover = 1.0;
    }
    if (front && cover > 0.5) nearest = depth;
    light += uFlame * level * 0.012 * scale / (length(f) + 0.03);
    total += level;
    // Smoke from the wick while it is out.
    if (uAnimate) {
      float smoking = smoothstep(0.54, 0.6, u) * (1.0 - smoothstep(0.7, 0.85, u)) * (1.0 - level);
      float rise = max(c.y - h, 0.0);
      float curl = 0.012 * sin(rise * 40.0 - iTime * 4.0 + fj) * (rise * 6.0);
      float smoke = exp(-abs(c.x - curl) / (0.003 + rise * 0.03)) * smoothstep(0.0, 0.02, rise) * (1.0 - smoothstep(0.02, 0.3, rise));
      col += vec3(0.5) * smoke * smoking * 0.35;
    }
  }
  // The pool of light on the floor, and each flame's glow.
  float pool = exp(-length((p - vec2(0.0, -0.1)) / vec2(1.25, uTilt + 0.15)) / (uRadius * 0.9));
  col += uFlame * pool * 0.25 * total / fn + light * 0.6;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Black candles", values: { uWax: [0.12, 0.11, 0.12] } },
    { name: "Witch light", values: { uFlame: [0.4, 1, 0.55] } },
    { name: "Circle of thirteen", values: { uCount: 13, uRadius: 0.44 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

/** The occult shaders. */
export const occultShaders: ShaderEffect[] = [summoningCircle, cauldron, candleRing];
