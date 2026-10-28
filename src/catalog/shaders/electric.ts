import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Electricity is drawn from jagged arcs: straight runs between hashed kinks,
 * octave on octave like midpoint displacement, re-seeded many times a second
 * (`floor(iTime * rate)`) so they snap from shape to shape rather than
 * wobble. Each arc is a thin white-hot core in a coloured glow. The
 * interactive ones read the pointer built-ins the wrapper declares
 * (`iPointer`, `iClicks`) and play on their own while nobody is pointing.
 */

/** `zigzag(x, seed)`: fractal jagged noise, about -1 to 1 (needs {@link HASH}). */
const ZIGZAG = `
// Jagged noise, -1 to 1: straight runs between hashed points, so arcs kink rather than wobble.
float jag(float x, float seed) {
  float i = floor(x);
  return mix(hash12(vec2(i, seed)), hash12(vec2(i + 1.0, seed)), fract(x)) * 2.0 - 1.0;
}
// Each octave halves the run and the kick, like midpoint displacement.
float zigzag(float x, float seed) {
  float s = 0.0;
  float amp = 0.6;
  for (int i = 0; i < 5; i++) {
    s += amp * jag(x, seed + float(i) * 17.3);
    x *= 2.1;
    amp *= 0.5;
  }
  return s;
}`.trim();

/**
 * Jagged arcs (needs {@link ZIGZAG}): `arcDist(p, a, b, seed, rough, open)`
 * is the distance from `p` to an arc from `a` to `b` and how far along it `p`
 * is (0–1); `rough` scales its kicks (a fraction of its length) and `open`
 * (1) lets the end at `b` swing free, for branches. `arcPoint` is the point
 * `t` of the way along one, and `arcLight(d, w, colour)` its light: a
 * white-hot core about `w` wide in a coloured glow.
 */
const ARC = `
float arcKick(float t, float seed, float rough, float open) {
  float env = sqrt(max(sin(3.14159 * t * (1.0 - 0.5 * open)), 0.0));
  return zigzag(t * 5.0, seed) * rough * env;
}
vec2 arcPoint(vec2 a, vec2 b, float t, float seed, float rough, float open) {
  vec2 ab = b - a;
  return a + ab * t + vec2(-ab.y, ab.x) * arcKick(t, seed, rough, open);
}
float chordDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
  return length(p - a - ab * t);
}
vec2 arcDist(vec2 p, vec2 a, vec2 b, float seed, float rough, float open) {
  vec2 ab = b - a;
  float len = max(length(ab), 1e-4);
  vec2 dir = ab / len;
  vec2 q = p - a;
  float along = dot(q, dir);
  float side = dot(q, vec2(-dir.y, dir.x));
  float t = clamp(along / len, 0.0, 1.0);
  // Well away from the arc's band, skip the noise.
  float band = rough * len * 1.3;
  if (abs(side) > band + 0.3) return vec2(length(vec2(along - t * len, abs(side) - band)), t);
  // The true distance to the arc's chords either side of t, so steep kicks stay thin and their glow even.
  const float STEP = 0.008;
  vec2 lp = vec2(along, side);
  vec2 c0 = vec2((t - STEP) * len, arcKick(t - STEP, seed, rough, open) * len);
  vec2 c1 = vec2(t * len, arcKick(t, seed, rough, open) * len);
  vec2 c2 = vec2((t + STEP) * len, arcKick(t + STEP, seed, rough, open) * len);
  return vec2(min(chordDist(lp, c0, c1), chordDist(lp, c1, c2)), t);
}
vec3 arcLight(float d, float w, vec3 col) {
  float core = exp(-d * d / (w * w));
  float halo = 0.55 * exp(-d / (w * 4.0)) + 0.18 * exp(-d / (w * 20.0));
  return mix(col, vec3(1.0), 0.75) * core * 2.0 + col * halo;
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

/** `segment(p, a, b)`: distance from `p` to the segment `a`–`b`. */
const SEGMENT = `
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}`.trim();

/** `crackle(p, seed)`: fractal jagged 2D noise, about -1 to 1, for crawling electricity (needs {@link HASH}). */
const CRACKLE = `
float jag2(vec2 x, float seed) {
  vec2 i = floor(x) + seed;
  vec2 f = fract(x);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}
float crackle(vec2 x, float seed) {
  float s = 0.0;
  float amp = 0.6;
  for (int i = 0; i < 4; i++) {
    s += amp * jag2(x, seed + float(i) * 7.3);
    x = x * 2.1 + 3.1;
    amp *= 0.5;
  }
  return s;
}`.trim();

export const lightning: ShaderEffect = {
  kind: "shader",
  id: "lightning",
  name: "Lightning",
  description: "Branching lightning striking from the top on a random schedule and wherever you click, lighting up the sky and leaving an afterglow.",
  category: "electric",
  tags: ["electric", "lightning", "storm", "weather", "overlay", "interactive", "click"],
  transparent: true,
  source: glsl(
    `// Lightning: branching bolts from the top, now and then and wherever you click.
uniform vec3 uColor;      // @control color default=#B4C6FF label="Colour"
uniform float uRate;      // @control min=0 max=2 default=0.8 label="Strikes per second (0 clicks only)"
uniform int uBranches;    // @control min=0 max=4 default=3 label="Branches"
uniform float uRough;     // @control min=0.03 max=0.3 default=0.12 label="Jaggedness"
uniform float uWidth;     // @control min=0.3 max=3 default=1 label="Width"
uniform float uFlash;     // @control min=0 max=1 default=0.5 label="Sky flash"
uniform float uAfterglow; // @control min=0 max=1 default=0.5 label="Afterglow"`,
    HASH,
    ROTATE,
    ZIGZAG,
    ARC,
    GLOW,
    `// How brightly a strike burns age seconds in: return strokes flickering for a moment.
float strikeLevel(float age, float seed) {
  if (age < 0.0 || age > 0.35) return 0.0;
  if (age < 0.04) return 1.0;
  float flick = 0.3 + 0.7 * step(0.45, hash12(vec2(floor(age * 30.0), seed)));
  return flick * (1.0 - age * 1.7);
}

// One bolt from a down to b with its branches, age seconds after it struck; adds its flash.
vec3 bolt(vec2 p, vec2 a, vec2 b, float seed, float age, float px, inout float flash) {
  if (age < 0.0 || age > 2.2) return vec3(0.0);
  float on = strikeLevel(age, seed);
  float level = max(on, uAfterglow * 0.45 * exp(-age * 1.6));
  if (level < 0.002) return vec3(0.0);
  flash += on;
  // The leader reaches down over the first 70 ms.
  float reach = clamp(age / 0.07, 0.0, 1.0) * 1.05;
  float w = max(0.0022 * uWidth * mix(0.6, 1.0, on), 0.7 * px);
  vec2 m = arcDist(p, a, b, seed, uRough, 0.0);
  vec3 col = arcLight(m.x, w, uColor) * level * smoothstep(reach, reach - 0.03, m.y);
  // A splash of light where it lands.
  col += uColor * exp(-length(p - b) / 0.03) * on * smoothstep(0.95, 1.0, reach);
  vec2 dir = normalize(b - a);
  float len = length(b - a);
  for (int j = 0; j < 4; j++) {
    if (j >= uBranches) break;
    float fj = float(j);
    vec3 h = vec3(hash12(vec2(seed, fj + 1.3)), hash12(vec2(fj + 3.1, seed)), hash12(vec2(seed + fj, 7.7)));
    float t0 = 0.12 + 0.6 * h.x;
    float prog = (reach - t0) / (1.0 - t0) * 1.2;
    if (prog <= 0.0) continue;
    vec2 s = arcPoint(a, b, t0, seed, uRough, 0.0);
    float turn = (h.y < 0.5 ? -1.0 : 1.0) * (0.35 + 0.55 * fract(h.y * 7.0));
    vec2 bdir = rot(turn) * dir;
    float blen = len * (1.0 - t0) * (0.25 + 0.35 * h.z);
    vec2 e = s + bdir * blen;
    float bseed = seed + fj * 5.3 + 1.0;
    vec2 d = arcDist(p, s, e, bseed, uRough * 1.3, 1.0);
    float shown = smoothstep(prog, prog - 0.05, d.y);
    col += arcLight(d.x, w * 0.6, uColor) * level * 0.6 * (1.0 - 0.8 * d.y) * shown;
    // A twig off each branch.
    float t1 = 0.3 + 0.4 * fract(h.z * 11.0);
    vec2 s2 = arcPoint(s, e, t1, bseed, uRough * 1.3, 1.0);
    vec2 e2 = s2 + rot(-turn * 0.9) * bdir * blen * (1.0 - t1) * 0.6;
    vec2 d2 = arcDist(p, s2, e2, bseed + 2.7, uRough * 1.5, 1.0);
    col += arcLight(d2.x, w * 0.4, uColor) * level * 0.35 * (1.0 - d2.y) * smoothstep(prog, prog - 0.05, t1 + d2.y * 0.3);
  }
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec3 col = vec3(0.0);
  float flash = 0.0;
  // Strikes on a random schedule: at most one in each slot, some slots quiet.
  if (uRate > 0.0) {
    float slot = 1.0 / uRate;
    float k0 = floor(iTime / slot);
    for (int i = 0; i < 5; i++) {
      float k = k0 - float(i);
      if (float(i - 1) * slot > 2.2) break;
      if (hash12(vec2(k, 9.1)) > 0.8) continue;
      vec2 h = hash22(vec2(k, 3.3));
      vec2 g = hash22(vec2(k, 5.9));
      vec2 a = vec2((0.1 + 0.8 * h.y) * aspect, 1.05);
      vec2 b = vec2(a.x + (g.x - 0.5) * 0.7, 0.35 * g.y - 0.05);
      col += bolt(p, a, b, k * 1.37 + 0.5, iTime - (k + 0.7 * h.x) * slot, px, flash);
    }
  }
  // And one aimed at each click.
  for (int i = 0; i < 4; i++) {
    vec4 c = iClicks[i];
    if (c.w < 0.5) continue;
    vec2 b = c.xy * px;
    vec2 a = vec2(b.x + (hash12(vec2(c.z, 1.9)) - 0.5) * 0.5, 1.05);
    col += bolt(p, a, b, fract(c.z * 0.731) * 97.0 + float(i), iTime - c.z, px, flash);
  }
  // The sky lights up with each stroke, most at the top.
  col += mix(uColor, vec3(1.0), 0.3) * uFlash * min(flash, 1.5) * (0.1 + 0.25 * p.y);
  fragColor = glow(col);
}`,
  ),
  presets: [
    { name: "Thunderstorm", values: { uRate: 1.4, uBranches: 4, uFlash: 0.9, uAfterglow: 0.7 } },
    { name: "Violet", values: { uColor: [0.75, 0.55, 1], uRate: 0.4, uRough: 0.16, uWidth: 1.4 } },
    { name: "Click to strike", values: { uRate: 0, uFlash: 0.3 } },
  ],
};

export const teslaArc: ShaderEffect = {
  kind: "shader",
  id: "tesla-arc",
  name: "Tesla arc",
  description: "A jittering plasma arc between two electrodes with stray filaments and sparks at the ends; hover and one end follows the pointer.",
  category: "electric",
  tags: ["electric", "arc", "plasma", "tesla", "sci-fi", "overlay", "interactive", "hover"],
  transparent: true,
  source: glsl(
    `// Tesla arc: a plasma arc between two electrodes, re-forming many times a second.
uniform vec2 uStart;      // @control min=-1 max=1 default=-0.6,0 label="Start"
uniform vec2 uEnd;        // @control min=-1 max=1 default=0.6,0 label="End"
uniform vec3 uColor;      // @control color default=#A98BFF label="Colour"
uniform float uRate;      // @control min=2 max=40 default=16 label="Re-forms per second"
uniform int uFilaments;   // @control min=0 max=3 default=2 label="Filaments"
uniform float uRough;     // @control min=0.03 max=0.4 default=0.16 label="Jaggedness"
uniform float uWidth;     // @control min=0.3 max=3 default=1 label="Width"
uniform float uSparks;    // @control min=0 max=1 default=0.6 label="Sparks"
uniform bool uFollow;     // @control default=true label="End follows pointer"`,
    HASH,
    ZIGZAG,
    ARC,
    SEGMENT,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 span = vec2(iResolution.x * px, 1.0) * 0.5;
  vec2 a = uStart * span;
  vec2 b = uEnd * span;
  if (uFollow) b = mix(b, (iPointer.xy - 0.5 * iResolution.xy) * px, clamp(iPointer.z, 0.0, 1.0));
  float tick = floor(iTime * uRate);
  float w = max(0.003 * uWidth, 0.7 * px);
  // The main arc, a little brighter or dimmer each time it re-forms.
  float level = 0.75 + 0.5 * hash12(vec2(tick, 0.7));
  vec2 m = arcDist(p, a, b, tick, uRough, 0.0);
  vec3 col = arcLight(m.x, w, uColor) * level;
  // Fainter, wilder filaments, each flickering on and off on its own clock.
  for (int i = 0; i < 3; i++) {
    if (i >= uFilaments) break;
    float fi = float(i) + 1.0;
    float ft = floor(iTime * uRate * (0.5 + 0.2 * fi) + fi * 3.1);
    float on = step(0.3, hash12(vec2(ft, fi * 4.3)));
    vec2 f = arcDist(p, a, b, ft * 1.7 + fi * 31.0, uRough * (1.4 + 0.4 * fi), 0.0);
    col += arcLight(f.x, w * 0.5, uColor) * 0.45 * on;
  }
  // Hot spots and sparks at both ends.
  for (int e = 0; e < 2; e++) {
    vec2 c = e == 0 ? a : b;
    vec2 away = normalize((e == 0 ? a - b : b - a) + 1e-5);
    float r = length(p - c);
    col += mix(uColor, vec3(1.0), 0.6) * (exp(-r / (0.012 * uWidth)) * 1.2 + exp(-r / 0.05) * 0.25) * level;
    for (int k = 0; k < 6; k++) {
      float fk = float(k);
      float clock = iTime * 2.3 + hash12(vec2(fk, float(e) + 0.5));
      float life = fract(clock);
      vec3 h = vec3(hash22(vec2(floor(clock), fk + float(e) * 7.0)), hash12(vec2(fk, floor(clock) + 0.3)));
      if (h.z > uSparks) continue;
      float ang = atan(away.y, away.x) + (h.x - 0.5) * 2.6;
      vec2 v = vec2(cos(ang), sin(ang)) * (0.25 + 0.35 * h.y);
      float s = life * 0.45;
      vec2 pos = c + v * s - vec2(0.0, 0.5 * s * s);
      if (length(p - pos) > 0.08) continue;
      vec2 vel = v - vec2(0.0, s);
      float d = segment(p, pos, pos - vel * 0.04);
      col += mix(uColor, vec3(1.0, 0.95, 0.85), 0.7) * (exp(-d * d / (w * w * 0.5)) + 0.3 * exp(-d / (w * 3.0))) * (1.0 - life);
    }
  }
  fragColor = glow(col);
}`,
  ),
  presets: [
    { name: "Blue arc", values: { uColor: [0.4, 0.7, 1], uRate: 24, uFilaments: 3 } },
    { name: "Lazy", values: { uRate: 5, uRough: 0.1, uFilaments: 1, uSparks: 0.2 } },
    { name: "Vertical", values: { uStart: [0, 0.75], uEnd: [0, -0.75], uColor: [0.55, 1, 0.75] } },
  ],
};

export const plasmaBall: ShaderEffect = {
  kind: "shader",
  id: "plasma-ball",
  name: "Plasma ball",
  description: "A plasma globe whose writhing filaments reach from a glowing electrode to the glass and gather where the pointer is.",
  category: "electric",
  tags: ["electric", "plasma", "globe", "retro", "sci-fi", "interactive", "hover"],
  source: glsl(
    `// Plasma ball: filaments writhing from a glowing electrode to the glass, gathering at the pointer.
uniform vec3 uColor;      // @control color default=#D04CFF label="Filaments"
uniform vec3 uTip;        // @control color default=#5BA8FF label="Tips"
uniform vec3 uBackground; // @control color default=#05030A label="Background"
uniform int uCount;       // @control min=3 max=14 default=9 label="Filament count"
uniform float uPull;      // @control min=0 max=1 default=0.85 label="Pull to pointer"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uSize;      // @control min=0.5 max=1 default=0.85 label="Size"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    ZIGZAG,
    ARC,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float R = 0.44 * uSize;
  vec2 o = vec2(0.0, 0.07 * uSize);
  vec2 q = p - o;
  float r = length(q);
  float t = iTime * uSpeed;
  float w = max(0.0035 * uSize, 0.7 * px);
  vec3 col = uBackground;
  vec3 light = vec3(0.0);

  // The stand, lit from above by the globe.
  vec2 sq = p - o + vec2(0.0, R * 0.92);
  float bw = (0.15 - sq.y * 0.7) * uSize;
  if (sq.y < 0.0 && sq.y > -0.13 * uSize && abs(sq.x) < bw) {
    float shade = 0.5 + 0.5 * cos(sq.x / bw * 1.4);
    col = vec3(0.07, 0.07, 0.09) * shade + uColor * 0.12 * exp(sq.y * 25.0 / uSize);
  }

  // Where the filaments reach: the pointer while it is over, else a wandering point.
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 drift = vec2(sin(t * 0.53), sin(t * 0.71 + 1.0)) * R;
  vec2 target = mix(drift, (iPointer.xy - 0.5 * iResolution.xy) * px - o, hover);
  float pull = uPull * mix(uDemo ? 0.5 : 0.0, 1.0, hover);
  float towards = atan(target.y, target.x);
  float tick = floor(iTime * 14.0);

  if (r < R) {
    light += uColor * 0.08 * (1.0 - r / R);
    for (int i = 0; i < 14; i++) {
      if (i >= uCount) break;
      float fi = float(i);
      float home = fi / float(uCount) * 6.28318 + (vnoise(vec2(fi * 3.1, t * 0.4)) - 0.5) * 2.5;
      float spread = (hash12(vec2(fi, 2.0)) - 0.5) * 0.6;
      float diff = mod(towards + spread - home + 3.14159, 6.28318) - 3.14159;
      float ang = home + diff * pull;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 root = dir * 0.05 * uSize;
      vec2 tip = dir * R * 0.985;
      // Bent in the middle, swaying slowly; kinked afresh each tick.
      vec2 mid = (root + tip) * 0.5 + vec2(-dir.y, dir.x) * (vnoise(vec2(fi * 5.7, t * 0.9)) - 0.5) * 0.5 * R;
      float seed = tick + fi * 13.0;
      vec2 d1 = arcDist(q, root, mid, seed, 0.1, 0.0);
      vec2 d2 = arcDist(q, mid, tip, seed + 7.0, 0.1, 0.0);
      float d = min(d1.x, d2.x);
      float along = d1.x < d2.x ? d1.y * 0.5 : 0.5 + d2.y * 0.5;
      vec3 fc = mix(uColor, uTip, smoothstep(0.45, 1.0, along));
      float flick = 0.7 + 0.3 * hash12(vec2(tick, fi));
      light += arcLight(d, w * mix(1.3, 0.7, along), fc) * flick * 0.75;
      // A bright spot where it touches the glass.
      light += uTip * exp(-length(q - tip) / (0.02 * uSize)) * 0.7;
    }
  } else {
    light += uColor * 0.25 * exp(-(r - R) / (0.06 * uSize));
  }
  // The electrode's glow.
  light += mix(uColor, vec3(1.0), 0.6) * exp(-r / (0.05 * uSize)) * 1.2;
  col += 1.0 - exp(-light);

  // The electrode, a frosted ball.
  float re = 0.05 * uSize;
  col = mix(col, mix(vec3(0.85, 0.8, 0.95), uColor, 0.3) * (1.1 - 0.4 * length(q / re - vec2(-0.3, 0.4))), smoothstep(re, re - px, r));
  // The glass: a thin rim, brighter toward the edge, and a highlight.
  col += vec3(0.75, 0.8, 1.0) * exp(-abs(r - R) / (0.003 + px)) * 0.4;
  col += mix(uColor, vec3(1.0), 0.5) * pow(clamp(r / R, 0.0, 1.0), 8.0) * 0.12 * step(r, R);
  float spec = length((q - vec2(-0.42, 0.5) * R) * vec2(1.0, 1.8));
  col += vec3(1.0) * (1.0 - smoothstep(0.0, 0.1 * R, spec)) * 0.35 * step(r, R);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Classic", values: { uColor: [0.95, 0.35, 0.8], uTip: [0.6, 0.5, 1] } },
    { name: "Ice", values: { uColor: [0.3, 0.7, 1], uTip: [0.85, 0.95, 1], uBackground: [0.01, 0.03, 0.06] } },
    { name: "Dense", values: { uCount: 14, uSpeed: 1.6 } },
  ],
};

export const electricBorder: ShaderEffect = {
  kind: "shader",
  id: "electric-border",
  name: "Electric border",
  description: "Electricity crackling round a rounded frame and now and then arcing off it, for cards and buttons.",
  category: "electric",
  tags: ["electric", "border", "frame", "ui", "card", "overlay", "glow"],
  transparent: true,
  source: glsl(
    `// Electric border: electricity crackling round a rounded frame, now and then arcing off it.
uniform vec3 uColor;      // @control color default=#5CE1FF label="Colour"
uniform float uInset;     // @control min=0 max=0.3 default=0.08 label="Inset"
uniform float uRadius;    // @control min=0 max=0.5 default=0.08 label="Corner radius"
uniform float uThickness; // @control min=0.002 max=0.06 default=0.016 label="Thickness"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uArcs;      // @control min=0 max=1 default=0.5 label="Arcs"
uniform float uIntensity; // @control min=0 max=2 default=1 label="Intensity"`,
    HASH,
    ZIGZAG,
    ARC,
    CRACKLE,
    GLOW,
    `float boxSdf(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// The point on the frame in the direction ang from the centre, about.
vec2 framePoint(float ang, vec2 box, float rad) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float s = min(box.x / max(abs(dir.x), 1e-3), box.y / max(abs(dir.y), 1e-3));
  vec2 q = dir * s;
  return q - dir * boxSdf(q, box, rad);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 box = max(0.5 * iResolution.xy * px - uInset, vec2(0.05));
  float rad = min(uRadius, min(box.x, box.y));
  float sd = boxSdf(p, box, rad);
  float t = iTime * uSpeed;
  float w = max(0.0018, 0.7 * px);
  float around = atan(p.y, p.x);
  vec3 light = vec3(0.0);
  // Strands: the frame's outline pushed about by jagged noise, re-kinked many times a second.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float tick = floor(t * (12.0 + 5.0 * fi) + fi * 0.5);
    float v = sd - crackle(p * (9.0 + 3.0 * fi), fract(tick * 0.0731) * 300.0 + fi * 19.0) * uThickness;
    vec2 g = vec2(dFdx(v), dFdy(v)) / px;
    float d = abs(v) / max(length(g), 0.5);
    // Brighter stretches running round the frame.
    float flow = 0.5 + 0.5 * sin(around * (2.0 + fi) - t * (2.0 + fi) * (fi == 1.0 ? -1.0 : 1.0) + fi * 2.0);
    float level = mix(0.2, 1.0, smoothstep(0.2, 0.9, flow)) * (fi == 0.0 ? 1.0 : 0.55);
    light += arcLight(d, w * (fi == 0.0 ? 1.0 : 0.6), uColor) * level;
  }
  // A soft glow hugging the frame.
  light += uColor * exp(-abs(sd) / (uThickness * 2.0 + 0.01)) * 0.2;
  // Arcs leaping off the frame and back.
  for (int j = 0; j < 2; j++) {
    float fj = float(j);
    float clock = t * 1.3 + fj * 0.47;
    float slot = floor(clock);
    if (hash12(vec2(slot, fj + 0.3)) > uArcs || fract(clock) > 0.3) continue;
    float ang = hash12(vec2(slot, fj + 5.1)) * 6.28318;
    vec2 a = framePoint(ang, box, rad);
    vec2 b = framePoint(ang + 0.15 + 0.2 * hash12(vec2(slot, 9.0)), box, rad);
    vec2 mid = (a + b) * 0.5;
    mid += normalize(mid) * (0.04 + 0.05 * hash12(vec2(slot, 2.0)));
    float seed = floor(iTime * 30.0) + fj * 50.0;
    float d = min(arcDist(p, a, mid, seed, 0.25, 0.0).x, arcDist(p, mid, b, seed + 3.0, 0.25, 0.0).x);
    light += arcLight(d, w * 0.8, uColor) * (1.0 - fract(clock) / 0.3);
  }
  fragColor = glow(light * uIntensity);
}`,
  ),
  presets: [
    { name: "Button", values: { uInset: 0.04, uRadius: 0.5, uThickness: 0.01, uArcs: 0.3 } },
    { name: "Toxic", values: { uColor: [0.55, 1, 0.3], uThickness: 0.03, uSpeed: 1.5, uArcs: 0.8 } },
    { name: "Hot pink", values: { uColor: [1, 0.35, 0.75], uRadius: 0.02, uIntensity: 1.4 } },
  ],
};

export const electricText: ShaderEffect = {
  kind: "shader",
  id: "electric-text",
  name: "Electric text",
  description: "A word with electricity crawling over its outlines and arcs leaping between its letters, flickering on a dark background.",
  category: "electric",
  video: "none",
  tags: ["electric", "text", "title", "glow", "sci-fi"],
  source: glsl(
    `// Electric text: electricity crawling along the letters' outlines, arcs jumping between them.
uniform sampler2D uText;     // @control filter=linear wrap=clamp default=${textImage("VOLT")} label="Text"
uniform vec3 uColor;         // @control color default=#6FD3FF label="Electricity"
uniform vec3 uFill;          // @control color default=#0B1622 label="Letters"
uniform vec3 uBackground;    // @control color default=#04060B label="Background"
uniform float uSize;         // @control min=0.3 max=1 default=0.85 label="Text size"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform float uArcs;         // @control min=0 max=1 default=0.6 label="Arcs between letters"
uniform float uFlicker;      // @control min=0 max=1 default=0.5 label="Flicker"`,
    HASH,
    ZIGZAG,
    ARC,
    CRACKLE,
    `// The text image's half size in the frame (height 1, centred), contained in uSize of it.
vec2 textHalf() {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  return vec2(h * aspect, h) * 0.5;
}

float letters(vec2 p) {
  vec2 uv = p / (2.0 * textHalf()) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

// The mask softened over a few taps, so its edge is a smooth slope to trace.
float soft(vec2 p) {
  float s = letters(p);
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    s += letters(p + vec2(cos(a), sin(a)) * 0.005);
  }
  return s / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  float w = max(0.0016, 0.6 * px);
  float mask = letters(p);
  float flick = mix(1.0, 0.35 + 0.65 * step(0.25, hash12(vec2(floor(t * 14.0), 4.0))), uFlicker);
  vec3 light = vec3(0.0);
  // Electricity crawling over the outlines: the edge traced through jagged jitter.
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float seed = fract(floor(t * (16.0 + 7.0 * fi)) * 0.0371) * 300.0 + fi * 11.0;
    vec2 jitter = vec2(crackle(p * 14.0, seed), crackle(p * 14.0 + 5.2, seed + 3.0)) * 0.012;
    float v = soft(p + jitter) - 0.5;
    vec2 g = vec2(dFdx(v), dFdy(v)) / px;
    float d = abs(v) / max(length(g), 1.0);
    light += arcLight(d, w * (1.0 - 0.4 * fi), uColor) * (1.0 - 0.45 * fi);
  }
  // A halo round the letters.
  float halo = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec2 dir = vec2(cos(a), sin(a));
    halo += letters(p + dir * 0.025) + letters(p + dir * 0.06) * 0.5;
  }
  light += uColor * halo / 12.0 * 0.5 * (1.0 - mask);
  // Arcs between letters, hidden where they pass behind one.
  vec2 hb = textHalf();
  for (int j = 0; j < 2; j++) {
    float fj = float(j);
    float clock = t * 1.7 + fj * 0.5;
    float slot = floor(clock);
    if (hash12(vec2(slot, fj + 0.7)) > uArcs || fract(clock) > 0.35) continue;
    vec3 h = vec3(hash22(vec2(slot, fj + 2.3)), hash12(vec2(slot, fj + 8.1)));
    vec2 a = vec2((h.x * 2.0 - 1.0) * hb.x * 0.75, (h.y - 0.5) * hb.y * 0.8);
    vec2 b = vec2(a.x + (h.x > 0.5 ? -1.0 : 1.0) * (0.12 + 0.25 * h.z) * hb.x, (fract(h.z * 7.0) - 0.5) * hb.y * 0.8);
    vec2 d = arcDist(p, a, b, floor(iTime * 25.0) + fj * 40.0, 0.2, 0.0);
    light += arcLight(d.x, w * 0.8, uColor) * (1.0 - mask) * (1.0 - fract(clock) / 0.35) * 0.9;
  }
  vec3 col = mix(uBackground, uFill + uColor * 0.06 * flick, mask);
  col += 1.0 - exp(-light * flick);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Toxic", values: { uColor: [0.5, 1, 0.3], uFill: [0.04, 0.1, 0.03] } },
    { name: "Overload", values: { uColor: [1, 0.85, 0.4], uArcs: 1, uFlicker: 0.9, uSpeed: 1.6 } },
    { name: "Steady", values: { uFlicker: 0, uArcs: 0.2, uSpeed: 0.6 } },
  ],
};

export const jacobsLadder: ShaderEffect = {
  kind: "shader",
  id: "jacobs-ladder",
  name: "Jacob's ladder",
  description: "An arc climbing between two diverging rods, stretching and breaking at the top, then striking again at the bottom.",
  category: "electric",
  tags: ["electric", "arc", "plasma", "lab", "retro", "loop"],
  source: glsl(
    `// Jacob's ladder: an arc climbing between diverging rods, breaking at the top and re-forming below.
uniform vec3 uColor;      // @control color default=#B79BFF label="Arc"
uniform vec3 uRod;        // @control color default=#8A8F9C label="Rods"
uniform vec3 uBackground; // @control color default=#06060B label="Background"
uniform float uPeriod;    // @control min=0.8 max=6 default=2.6 label="Climb seconds"
uniform float uSpread;    // @control min=0.05 max=0.5 default=0.24 label="Spread at top"
uniform float uRough;     // @control min=0.03 max=0.4 default=0.14 label="Jaggedness"
uniform float uWidth;     // @control min=0.3 max=3 default=1 label="Width"`,
    HASH,
    ZIGZAG,
    ARC,
    SEGMENT,
    `const float BOTTOM = -0.4;
const float TOP = 0.3;

// How far each rod is from the middle at height y.
float rodX(float y) {
  return 0.035 + uSpread * clamp((y - BOTTOM) / (TOP - BOTTOM), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float w = max(0.003 * uWidth, 0.7 * px);
  vec3 col = uBackground;

  // The insulator block and the two rods, round and metallic.
  vec2 bq = abs(p - vec2(0.0, BOTTOM - 0.05)) - vec2(0.12 + uSpread * 0.3, 0.05);
  if (max(bq.x, bq.y) < 0.0) col = mix(uRod * 0.2, uRod * 0.35, smoothstep(-0.05, 0.05, p.y - BOTTOM + 0.05));
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec2 a = vec2(side * rodX(BOTTOM), BOTTOM);
    vec2 b = vec2(side * rodX(TOP), TOP + 0.03);
    float d = segment(p, a, b);
    float r = 0.007;
    float across = clamp(d / r, 0.0, 1.0);
    vec3 metal = uRod * (0.45 + 0.55 * sqrt(1.0 - across * across)) + 0.25 * exp(-d / (r * 0.3));
    col = mix(col, metal, smoothstep(r, r - px, d));
  }

  // The climb: slow at the bottom, rising faster as the hot air carries it.
  float u = fract(iTime / uPeriod);
  float climb = clamp(u / 0.88, 0.0, 1.0);
  float y = BOTTOM + 0.02 + (TOP - BOTTOM - 0.02) * pow(climb, 1.5);
  float tick = floor(iTime * 20.0);
  vec3 light = vec3(0.0);
  if (u < 0.88) {
    vec2 l = vec2(-rodX(y) + 0.006, y);
    vec2 r = vec2(rodX(y) - 0.006, y);
    // It bows upward, more as it stretches before breaking.
    float bow = (r.x - l.x) * 0.15 + 0.12 * smoothstep(0.6, 0.88, u);
    vec2 mid = vec2((hash12(vec2(tick, 3.0)) - 0.5) * 0.04, y + bow);
    float d = min(arcDist(p, l, mid, tick * 2.1, uRough, 0.0).x, arcDist(p, mid, r, tick * 2.1 + 1.0, uRough, 0.0).x);
    float strike = 1.0 + 1.5 * exp(-u * uPeriod * 12.0);
    float flick = 0.75 + 0.35 * hash12(vec2(tick, 1.0)) - 0.4 * smoothstep(0.75, 0.88, u) * step(0.5, hash12(vec2(tick, 2.0)));
    light += arcLight(d, w, uColor) * strike * flick;
    // The rods glow where it touches them.
    light += uColor * (exp(-length(p - l) / 0.02) + exp(-length(p - r) / 0.02)) * 0.6 * flick;
  } else {
    // Broken: a puff of plasma rising off the top and fading.
    float age = (u - 0.88) * uPeriod;
    vec2 c = vec2(0.0, TOP + 0.12 + age * 0.25);
    light += uColor * exp(-length(p - c) / (0.03 + age * 0.1)) * exp(-age * 6.0) * 0.8;
  }
  col += 1.0 - exp(-light);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Fast", values: { uPeriod: 1.2, uRough: 0.2 } },
    { name: "Wide", values: { uSpread: 0.45, uPeriod: 3.5, uWidth: 1.4 } },
    { name: "Blue", values: { uColor: [0.45, 0.7, 1], uRod: [0.75, 0.6, 0.4] } },
  ],
};

export const shortCircuit: ShaderEffect = {
  kind: "shader",
  id: "short-circuit",
  name: "Short circuit",
  description: "A sparking fault spitting irregular bursts of hot sparks that fall away, with bright flashes and a wisp of smoke.",
  category: "electric",
  tags: ["electric", "sparks", "fault", "overlay", "particles", "danger"],
  transparent: true,
  source: glsl(
    `// Short circuit: a fault spitting bursts of hot sparks, flashes and a wisp of smoke.
uniform vec2 uOrigin;     // @control min=-1 max=1 default=0,0.2 label="Fault"
uniform vec3 uColor;      // @control color default=#FFB54D label="Sparks"
uniform vec3 uFlashColor; // @control color default=#BFD9FF label="Flash"
uniform float uActivity;  // @control min=0 max=1 default=0.6 label="Activity"
uniform int uSparks;      // @control min=4 max=32 default=18 label="Sparks per burst"
uniform float uSpread;    // @control min=0.2 max=2 default=1 label="Spread"
uniform float uGravity;   // @control min=0 max=3 default=1 label="Gravity"
uniform float uSmoke;     // @control min=0 max=1 default=0.4 label="Smoke"`,
    HASH,
    NOISE,
    FBM,
    ZIGZAG,
    ARC,
    SEGMENT,
    GLOW,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 o = uOrigin * vec2(iResolution.x * px, 1.0) * 0.5;
  float w = max(0.0025, 0.7 * px);
  const float drag = 2.5;
  const float SLOT = 0.3;
  vec3 light = vec3(0.0);
  float ambient = 0.0;
  float k0 = floor(iTime / SLOT);
  for (int i = 0; i < 5; i++) {
    float k = k0 - float(i);
    if (hash12(vec2(k, 1.7)) > uActivity) continue;
    float age = iTime - (k + 0.6 * hash12(vec2(k, 2.9))) * SLOT;
    if (age < 0.0 || age > 1.2) continue;
    // A flash, flickering, with a little arc across the fault.
    float flash = exp(-age * 14.0) * (0.6 + 0.4 * step(0.5, hash12(vec2(floor(age * 40.0), k))));
    float r = length(p - o);
    light += uFlashColor * (exp(-r / 0.02) * 2.0 + exp(-r / 0.12) * 0.5) * flash;
    ambient += flash;
    if (age < 0.12) {
      vec2 s = vec2(0.035, 0.0) * (0.6 + hash12(vec2(k, 4.4)));
      light += arcLight(arcDist(p, o - s, o + s.yx * 0.3 + s, floor(iTime * 40.0), 0.35, 0.0).x, w, uFlashColor) * 0.8;
    }
    float slow = (1.0 - exp(-drag * age)) / drag;
    for (int j = 0; j < 32; j++) {
      if (j >= uSparks) break;
      vec3 h = vec3(hash22(vec2(float(j) * 7.13 + 1.0, k * 3.1)), hash12(vec2(k, float(j) + 0.5)));
      float span = 0.35 + 0.75 * h.z;
      if (age > span) continue;
      float ang = 1.5708 + (h.x - 0.5) * 2.8;
      vec2 v0 = vec2(cos(ang), sin(ang)) * uSpread * (0.4 + 0.9 * h.y);
      vec2 pos = o + v0 * slow - vec2(0.0, 0.5 * uGravity * 0.8 * age * age);
      if (length(p - pos) > 0.1) continue;
      vec2 vel = v0 * exp(-drag * age) - vec2(0.0, uGravity * 0.8 * age);
      float d = segment(p, pos, pos - vel * 0.035);
      float heat = 1.0 - age / span;
      vec3 c = mix(uColor * vec3(1.0, 0.55, 0.35), mix(uColor, vec3(1.0), 0.7), heat * heat);
      light += c * (exp(-d * d / (w * w)) * 1.5 + 0.25 * exp(-d / (w * 3.0))) * heat;
    }
  }
  light += uFlashColor * min(ambient, 1.0) * 0.08;
  // Smoke curling up from the fault.
  vec2 q = p - o;
  float spread = 0.03 + max(q.y, 0.0) * 0.35;
  float plume = fbm(vec2(q.x * 7.0, q.y * 4.0 - iTime * 0.6), 4);
  float smoke = smoothstep(0.4, 0.75, plume) * exp(-q.x * q.x / (spread * spread)) * smoothstep(-0.02, 0.04, q.y) * exp(-max(q.y, 0.0) * 2.5);
  vec4 acc = over(vec4(0.0), vec3(0.32, 0.31, 0.3), clamp(smoke * uSmoke, 0.0, 1.0));
  vec4 g = glow(light);
  acc = over(acc, g.rgb, g.a);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Welding", values: { uColor: [0.75, 0.85, 1], uActivity: 1, uSparks: 32, uSmoke: 0.2 } },
    { name: "Sputter", values: { uActivity: 0.3, uSparks: 8, uSpread: 0.6 } },
    { name: "Wall socket", values: { uOrigin: [0, -0.3], uGravity: 1.6, uSmoke: 0.7 } },
  ],
};

export const powerSurge: ShaderEffect = {
  kind: "shader",
  id: "power-surge",
  name: "Power surge",
  description: "A picture jolted by a power surge: a flash, an arc tearing across, scanlines and colour split, then a brownout before it settles.",
  category: "electric",
  video: "filter",
  tags: ["electric", "image", "glitch", "surge", "flash"],
  source: glsl(
    `// Power surge: an image jolted by a surge, then settling, on a schedule.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uColor;       // @control color default=#8FD8FF label="Arc colour"
uniform float uPeriod;     // @control min=1.5 max=8 default=3.5 label="Seconds between surges"
uniform float uStrength;   // @control min=0 max=1.5 default=1 label="Strength"
uniform float uGlitch;     // @control min=0 max=1 default=0.6 label="Glitch"
${BACKDROP_CONTROLS}`,
    HASH,
    ZIGZAG,
    ARC,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  float cycle = floor(iTime / uPeriod);
  float since = iTime - cycle * uPeriod;
  float tick = floor(iTime * 24.0);
  float surge = uStrength * exp(-since * 4.0) * (0.55 + 0.45 * hash12(vec2(tick, 1.0)));
  // Rows torn sideways and the channels split while it surges.
  float rows = floor(uv.y * mix(12.0, 60.0, hash12(vec2(tick, 2.0))));
  float tear = (hash12(vec2(rows, tick)) - 0.5) * step(0.55, hash12(vec2(rows, tick + 5.0))) * 0.12 * surge * uGlitch;
  vec2 st = uv + vec2(tear, 0.0);
  float split = 0.012 * surge * uGlitch;
  vec4 r = pictureRGBA(uImage, st + vec2(split, 0.0));
  vec4 g = pictureRGBA(uImage, st);
  vec4 b2 = pictureRGBA(uImage, st - vec2(split, 0.0));
  vec3 col = vec3(r.r, g.g, b2.b);
  // Brightness spikes, dips in a brownout, then comes back.
  float brownout = 1.0 - 0.3 * min(uStrength, 1.0) * smoothstep(0.25, 0.5, since) * (1.0 - smoothstep(0.7, 1.5, since));
  col = col * brownout * (1.0 + surge * 1.4) + surge * 0.2 * mix(uColor, vec3(1.0), 0.5);
  col *= 1.0 - 0.35 * min(surge, 1.0) * uGlitch * (0.5 + 0.5 * sin(fragCoord.y * 1.5708));
  // The arc tearing across in the first moments, with a branch.
  vec3 light = vec3(0.0);
  float on = step(since, 0.35) * (0.5 + 0.5 * step(0.3, hash12(vec2(tick, 6.0)))) * uStrength;
  if (on > 0.0) {
    float w = max(0.003, 0.7 * px);
    vec2 a = vec2(-0.05, 0.2 + 0.6 * hash12(vec2(cycle, 3.0)));
    vec2 b = vec2(aspect + 0.05, 0.2 + 0.6 * hash12(vec2(cycle, 4.0)));
    light += arcLight(arcDist(p, a, b, tick, 0.07, 0.0).x, w, uColor);
    vec2 s = arcPoint(a, b, 0.3 + 0.4 * hash12(vec2(cycle, 5.0)), tick, 0.07, 0.0);
    vec2 e = s + vec2(0.15 + 0.2 * hash12(vec2(cycle, 6.0)), (hash12(vec2(cycle, 7.0)) - 0.5) * 0.6);
    light += arcLight(arcDist(p, s, e, tick + 9.0, 0.2, 1.0).x, w * 0.6, uColor) * 0.6;
    light *= on;
  }
  col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * exp(-light);
  // The arc shows where the picture is clear too.
  float arc = 1.0 - exp(-max(light.r, max(light.g, light.b)));
  fragColor = vec4(col, max(max(max(r.a, g.a), b2.a), arc));
}`,
  ),
  presets: [
    { name: "Blackout", values: { uStrength: 1.5, uGlitch: 1, uPeriod: 5 } },
    { name: "Flicker", values: { uStrength: 0.5, uGlitch: 0.3, uPeriod: 2 } },
    { name: "Landscape", values: { uImage: SAMPLE_IMAGES.landscape, uColor: [1, 0.85, 0.5] } },
  ],
};

export const electricField: ShaderEffect = {
  kind: "shader",
  id: "electric-field",
  name: "Electric field",
  description: "Field lines between glowing positive and negative charges with dashes flowing along them; hover and one charge follows the pointer.",
  category: "electric",
  tags: ["electric", "physics", "science", "field", "line", "interactive", "hover"],
  source: glsl(
    `// Electric field: the field lines of two or three charges, dashes flowing from + to -.
uniform vec2 uCharge1;    // @control min=-1 max=1 default=-0.5,0 label="Charge 1 (+)"
uniform vec2 uCharge2;    // @control min=-1 max=1 default=0.5,0 label="Charge 2 (-)"
uniform vec2 uCharge3;    // @control min=-1 max=1 default=0,0.7 label="Charge 3"
uniform int uThird;       // @control min=-1 max=1 default=0 label="Charge 3 sign (0 off)"
uniform int uLines;       // @control min=4 max=32 default=16 label="Field lines"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Flow speed"
uniform vec3 uLine;       // @control color default=#8FB3FF label="Lines"
uniform vec3 uPositive;   // @control color default=#FF5A5F label="Positive"
uniform vec3 uNegative;   // @control color default=#3FA7FF label="Negative"
uniform vec3 uBackground; // @control color default=#060912 label="Background"
uniform float uDrift;     // @control min=0 max=1 default=0.3 label="Drift"
uniform bool uFollow;     // @control default=true label="Charge 1 follows pointer"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 span = vec2(iResolution.x * px, 1.0) * 0.5;
  float t = iTime;
  vec2 c[3];
  c[0] = uCharge1 * span + vec2(sin(t * 0.7), cos(t * 0.9)) * 0.06 * uDrift;
  c[1] = uCharge2 * span + vec2(cos(t * 0.6 + 1.0), sin(t * 0.8)) * 0.06 * uDrift;
  c[2] = uCharge3 * span + vec2(sin(t * 0.5 + 2.0), cos(t * 0.4)) * 0.06 * uDrift;
  if (uFollow) c[0] = mix(c[0], (iPointer.xy - 0.5 * iResolution.xy) * px, clamp(iPointer.z, 0.0, 1.0));
  float q[3];
  q[0] = 1.0;
  q[1] = -1.0;
  q[2] = float(uThird);
  // Field lines are contours of the stream function (the charges' angles summed);
  // the potential (their log distances) spaces the dashes along them.
  float psi = 0.0;
  vec2 gradPsi = vec2(0.0);
  float phi = 0.0;
  float nearest = 1e3;
  for (int i = 0; i < 3; i++) {
    if (q[i] == 0.0) continue;
    vec2 d = p - c[i];
    float r2 = max(dot(d, d), 1e-6);
    psi += q[i] * atan(d.y, d.x);
    gradPsi += q[i] * vec2(-d.y, d.x) / r2;
    phi += q[i] * 0.5 * log(r2);
    nearest = min(nearest, sqrt(r2));
  }
  float n = float(uLines) / 6.28318;
  float v = psi * n;
  float off = abs(fract(v + 0.5) - 0.5) / max(length(gradPsi) * n * px, 1e-5);
  float line = (1.0 - smoothstep(0.4, 1.4, off)) * smoothstep(0.03, 0.09, nearest);
  float dash = fract(phi * 2.5 - t * uSpeed);
  float lit = 0.25 + 0.9 * smoothstep(0.0, 0.08, dash) * (1.0 - smoothstep(0.35, 0.5, dash));
  vec3 tint = mix(uLine, mix(uPositive, uNegative, smoothstep(-1.0, 1.0, phi)), 0.3);
  vec3 col = uBackground + uLine * 0.05 * clamp(length(gradPsi) * 0.03, 0.0, 1.0);
  col += tint * line * lit;
  // The charges: glowing discs with their signs.
  for (int i = 0; i < 3; i++) {
    if (q[i] == 0.0) continue;
    vec2 d = p - c[i];
    float r = length(d);
    vec3 cc = q[i] > 0.0 ? uPositive : uNegative;
    col += cc * (exp(-r / 0.025) * 0.8 + exp(-r / 0.1) * 0.25);
    col = mix(col, cc, smoothstep(0.035, 0.035 - px, r));
    vec2 ad = abs(d);
    float bar = max(ad.x - 0.018, ad.y - 0.004);
    if (q[i] > 0.0) bar = min(bar, max(ad.x - 0.004, ad.y - 0.018));
    col = mix(col, vec3(1.0), smoothstep(px, 0.0, bar));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Two positives", values: { uThird: 1, uCharge3: [0, -0.7], uLines: 20 } },
    { name: "Three body", values: { uThird: -1, uCharge3: [0, 0.65], uDrift: 0.8 } },
    { name: "Blueprint", values: { uBackground: [0.04, 0.12, 0.3], uLine: [0.85, 0.92, 1], uSpeed: 0.5 } },
  ],
};

/** Electricity: lightning, arcs, plasma and sparks. */
export const electricShaders: ShaderEffect[] = [
  lightning,
  teslaArc,
  plasmaBall,
  electricBorder,
  electricText,
  jacobsLadder,
  shortCircuit,
  powerSurge,
  electricField,
];
