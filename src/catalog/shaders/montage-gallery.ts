import { DEVICE_GLSL } from "../devices.js";
import { glsl } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";
import { BACKGROUND, COMPOSITE, SCREEN } from "./montage-glsl.js";

/*
 * Montages of a set of pictures: a bento grid, prints dealt on a table, a
 * film strip, a split screen, a ring, a series of before/after pairs, a
 * mosaic wall, and one device changing shape. Each shows up to `slots`
 * items at once (`uCount` says how many) and spotlights them one at a time
 * on a `uHold` beat, so a page can follow along with `onItem`; a longer
 * list swaps new items into the slots as it plays (see `EffectItems`). All
 * draw on clear unless their background is turned up.
 */

/** Sample pictures for six items, so a preview has something in every slot. */
const SAMPLES = [SAMPLE_IMAGES.city, SAMPLE_IMAGES.landscape, SAMPLE_IMAGES.portrait, SAMPLE_IMAGES.portrait2, SAMPLE_IMAGES.landscape, SAMPLE_IMAGES.city];

const slotNames = (n: number) => Array.from({ length: n }, (_, i) => `uItem${i}`);

/** `n` item controls, `uItem0`… */
function itemControls(n: number): string {
  return slotNames(n)
    .map((name, i) => `uniform sampler2D ${name};${" ".repeat(Math.max(1, 7 - name.length))}// @control filter=linear wrap=clamp default=${SAMPLES[i % SAMPLES.length]} label="Item ${i + 1}"`)
    .join("\n");
}

/**
 * Reading `n` items by index (GLSL picks a sampler only by a constant):
 * `itemSize(i)`, `itemAt(i, uv)`, and `itemCover(i, uv, aspect)`, the item
 * filling a box of that aspect, centred, cropping the overflow.
 */
function itemGlsl(n: number): string {
  const names = slotNames(n);
  const pick = (expr: (name: string) => string) =>
    names
      .slice(0, -1)
      .map((name, i) => `if (i == ${i}) return ${expr(name)};`)
      .concat(`return ${expr(names[n - 1]!)};`)
      .join("\n  ");
  return `
ivec2 itemSize(int i) {
  ${pick((name) => `textureSize(${name}, 0)`)}
}
vec4 itemAt(int i, vec2 uv) {
  ${pick((name) => `pictureRGBA(${name}, uv)`)}
}
vec4 itemCover(int i, vec2 uv, float aspect) {
  ivec2 ts = itemSize(i);
  if (ts.x > 1 && ts.y > 1) {
    float ta = float(ts.x) / float(ts.y);
    if (ta > aspect) uv.x = (uv.x - 0.5) * aspect / ta + 0.5;
    else uv.y = (uv.y - 0.5) * ta / aspect + 0.5;
  }
  return itemAt(i, uv);
}`.trim();
}

/** Easing, rotation, a hash and a rounded box. */
const MOTION = `
float ease(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float easeOut(float t) {
  t = clamp(t, 0.0, 1.0);
  return 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t);
}
mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}
float hash11(float n) {
  return fract(sin(n * 127.1 + 11.7) * 43758.5453);
}
float tileBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`.trim();

/**
 * `spotlight(t, start, hold, n)`: which item is in the spotlight, from
 * `start`, `hold` seconds each: x its index, y how far it has come in, z the
 * one before it (-1 for none) and w how much it still shows.
 * `spotWeight(s, i)` is item i's share, 0–1.
 */
const SPOTLIGHT = `
vec4 spotlight(float t, float start, float hold, int n) {
  float c = (t - start) / max(hold, 0.1);
  if (c < 0.0 || n < 1) return vec4(-1.0, 0.0, -1.0, 0.0);
  float k = floor(c);
  float w = ease((c - k) * hold / 0.45);
  float h = mod(k, float(n));
  float prev = k >= 1.0 ? mod(k - 1.0, float(n)) : -1.0;
  return vec4(h, w, prev, 1.0 - w);
}
float spotWeight(vec4 s, int i) {
  return (int(s.x) == i ? s.y : 0.0) + (int(s.z) == i ? s.w : 0.0);
}`.trim();

const COUNT = (n: number, def = n, min = 1) => `uniform int uCount;             // @control min=${min} max=${n} default=${def} label="Items shown"`;
const HOLD = (def: number) => `uniform float uHold;            // @control min=0.8 max=10 default=${def} label="Seconds per item"`;

const swap = (n: number, min = 1, max = 24) => ({ min, max, slots: slotNames(n), cycle: "swap" as const, count: "uCount" });

export const bentoMontage: ShaderEffect = {
  kind: "shader",
  id: "bento-montage",
  name: "Bento montage",
  description: "Pictures that fly into a bento grid of rounded tiles, big and small, then step into the spotlight one at a time, lifting with an accent ring while the rest dim.",
  category: "montage",
  video: "stills",
  tags: ["montage", "bento", "grid", "tiles", "screenshots", "features", "gallery", "product", "items"],
  transparent: true,
  rest: 1.5,
  items: swap(6),
  source: glsl(
    `// Bento montage: tiles fly into a bento grid, then each takes the spotlight in turn.
${itemControls(6)}
${COUNT(6)}
uniform float uGap;             // @control min=0 max=0.06 default=0.018 label="Gap"
uniform float uRadius;          // @control min=0 max=0.08 default=0.025 label="Corner radius"
uniform float uMargin;          // @control min=0 max=0.25 default=0.06 label="Margin"
${HOLD(2.5)}
uniform float uSpotlight;       // @control min=0 max=1 default=0.55 label="Dim the others"
uniform float uLift;            // @control min=0 max=0.12 default=0.04 label="Lift"
uniform vec3 uAccent;           // @control color default=#6366F1 label="Accent"
uniform float uRing;            // @control min=0 max=1 default=1 label="Ring"
uniform float uShadow;          // @control min=0 max=1 default=0.35 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    SPOTLIGHT,
    `// Tile i of n in the grid: left, top, width, height as fractions of it (y from the top).
vec4 bentoRect(int i, int n) {
  if (n <= 1) return vec4(0.0, 0.0, 1.0, 1.0);
  if (n == 2) return i == 0 ? vec4(0.0, 0.0, 0.6, 1.0) : vec4(0.6, 0.0, 0.4, 1.0);
  if (n == 3) return i == 0 ? vec4(0.0, 0.0, 0.6, 1.0) : i == 1 ? vec4(0.6, 0.0, 0.4, 0.5) : vec4(0.6, 0.5, 0.4, 0.5);
  if (n == 4) return i == 0 ? vec4(0.0, 0.0, 0.6, 0.6) : i == 1 ? vec4(0.6, 0.0, 0.4, 0.6) : i == 2 ? vec4(0.0, 0.6, 0.4, 0.4) : vec4(0.4, 0.6, 0.6, 0.4);
  if (n == 5) return i == 0 ? vec4(0.0, 0.0, 0.5, 0.6) : i == 1 ? vec4(0.5, 0.0, 0.25, 0.6) : i == 2 ? vec4(0.75, 0.0, 0.25, 0.6) : i == 3 ? vec4(0.0, 0.6, 0.6, 0.4) : vec4(0.6, 0.6, 0.4, 0.4);
  return i == 0 ? vec4(0.0, 0.0, 0.5, 0.64) : i == 1 ? vec4(0.5, 0.0, 0.5, 0.32) : i == 2 ? vec4(0.5, 0.32, 0.25, 0.32) : i == 3 ? vec4(0.75, 0.32, 0.25, 0.32) : i == 4 ? vec4(0.0, 0.64, 0.32, 0.36) : vec4(0.32, 0.64, 0.68, 0.36);
}

void drawTile(inout vec4 acc, vec2 p, int i, int n, vec2 grid, float w, float dim, float px) {
  vec4 r = bentoRect(i, n);
  vec2 half_ = max(r.zw * grid - 0.5 * uGap, vec2(0.001));
  vec2 centre = vec2(-grid.x + 2.0 * grid.x * r.x + r.z * grid.x, grid.y - 2.0 * grid.y * r.y - r.w * grid.y);
  // Flying in: each tile a little after the one before, rising and growing into place.
  float a = easeOut((iTime - 0.12 * float(i)) / 0.7);
  float scale = mix(0.82, 1.0, a) * (1.0 + uLift * w);
  vec2 q = (p - centre - vec2(0.0, -0.08 * (1.0 - a))) / scale;
  float d = tileBox(q, half_, uRadius);
  float lift = w;
  acc = over(acc, vec3(0.0), uShadow * (0.25 + 0.5 * lift) * a * exp(-pow(max(tileBox(q - vec2(0.0, -0.02 - 0.03 * lift), half_, uRadius), 0.0) / (0.015 + 0.04 * lift), 2.0)) * step(0.0, d));
  float cover = smoothstep(px, -px, d) * a;
  if (cover <= 0.0) return;
  vec2 uv = q / (2.0 * half_) + 0.5;
  vec4 pic = itemCover(i, uv, half_.x / half_.y);
  float off = dim * (1.0 - w);
  vec3 col = mix(pic.rgb, vec3(dot(pic.rgb, vec3(0.299, 0.587, 0.114))) * 0.4, off);
  acc = over(acc, col, cover * pic.a);
  float ring = smoothstep(px, -px, abs(d + 0.004) - 0.003) * w * uRing;
  acc = over(acc, uAccent, ring * a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  int n = clamp(uCount, 1, 6);
  vec2 grid = max(vec2(0.5 * iResolution.x / iResolution.y - uMargin, 0.5 - uMargin), vec2(0.05));
  float start = 0.12 * float(n - 1) + 0.7 + 0.8;
  vec4 s = spotlight(iTime, start, uHold, n);
  float dim = uSpotlight * clamp((iTime - start) / 0.45, 0.0, 1.0);
  vec4 acc = vec4(0.0);
  // The tile in the spotlight draws last, over its neighbours as it lifts.
  int top = int(s.x);
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    if (i != top) drawTile(acc, p, i, n, grid, spotWeight(s, i), dim, px);
  }
  if (top >= 0) drawTile(acc, p, top, n, grid, spotWeight(s, top), dim, px);
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Feature grid", values: {} },
    { name: "Calm", values: { uSpotlight: 0.25, uLift: 0.02, uRing: 0 } },
    { name: "Four up", values: { uCount: 4, uGap: 0.03, uRadius: 0.04 } },
    { name: "On a panel", values: { uBackgroundAlpha: 1, uBackground: [0.07, 0.08, 0.11] } },
  ],
};

export const photoScatter: ShaderEffect = {
  kind: "shader",
  id: "photo-scatter",
  name: "Photo scatter",
  description: "Pictures as white-bordered prints dealt one by one onto a table, landing at scattered angles, then picked up and straightened in the middle one at a time.",
  category: "montage",
  video: "stills",
  tags: ["montage", "photo", "polaroid", "print", "scatter", "gallery", "memories", "items"],
  transparent: true,
  rest: 2.7,
  items: swap(6),
  source: glsl(
    `// Photo scatter: prints dealt onto a table, then each picked up and shown in turn.
${itemControls(6)}
${COUNT(6)}
uniform float uPrint;           // @control min=0.15 max=0.8 default=0.42 label="Print size"
uniform float uAspect;          // @control min=0.6 max=1.8 default=1 label="Photo shape (width / height)"
uniform float uSpread;          // @control min=0 max=1 default=0.75 label="Spread"
uniform float uTilt;            // @control min=0 max=45 default=14 label="Tilt (degrees)"
uniform float uDeal;            // @control min=0.1 max=1 default=0.35 label="Seconds between prints"
${HOLD(2.5)}
uniform float uFocusScale;      // @control min=1 max=2.5 default=1.6 label="Picked-up size"
uniform float uSeed;            // @control min=0 max=100 default=3 label="Layout seed"
uniform vec3 uBorder;           // @control color default=#FAFAF7 label="Border"
uniform float uShadow;          // @control min=0 max=1 default=0.4 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    `// Print i, drawn at pos turned by angle and scaled; lift deepens its shadow.
void drawPrint(inout vec4 acc, vec2 p, int i, vec2 pos, float angle, float scale, float lift, float px) {
  float b = 0.06;
  float ph = 1.0 - b - 0.2;
  float pw = ph * uAspect;
  vec2 outer = vec2(0.5 * pw + b, 0.5);
  vec2 q = rot2(-angle) * (p - pos) / (uPrint * scale);
  float qpx = px / (uPrint * scale);
  float sd = tileBox(q - vec2(0.02, -0.03) * (1.0 + 2.0 * lift), outer, 0.01);
  acc = over(acc, vec3(0.0), uShadow * (0.45 - 0.15 * lift) * exp(-pow(max(sd, 0.0) / (0.03 + 0.06 * lift), 2.0)));
  float d = tileBox(q, outer, 0.008);
  float cover = smoothstep(qpx, -qpx, d);
  if (cover <= 0.0) return;
  acc = over(acc, uBorder * (0.97 + 0.03 * q.y), cover);
  vec2 pc = vec2(0.0, 0.5 - b - 0.5 * ph);
  float photo = smoothstep(qpx, -qpx, tileBox(q - pc, vec2(0.5 * pw, 0.5 * ph), 0.002));
  if (photo <= 0.0) return;
  vec4 pic = itemCover(i, (q - pc) / vec2(pw, ph) + 0.5, uAspect);
  acc = over(acc, pic.rgb, photo * pic.a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  int n = clamp(uCount, 1, 6);
  float fn = float(n);
  float tilt = radians(uTilt);
  float start = uDeal * float(n - 1) + 0.6 + 0.6;
  // The print being shown: picked up, straightened and set back within each hold.
  float c = (iTime - start) / max(uHold, 0.1);
  int shown = c >= 0.0 ? int(mod(floor(c), float(n))) : -1;
  float f = fract(c);
  float up = c >= 0.0 ? ease(f * uHold / 0.5) * ease((1.0 - f) * uHold / 0.5) : 0.0;
  vec2 room = max(vec2(aspect - uPrint * (0.74 * uAspect + 0.12), 1.0 - uPrint), vec2(0.0)) * 0.5 * uSpread;
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 7; j++) {
    // The shown print draws last, over the pile.
    int i = j < 6 ? j : shown;
    if (j < 6 && (j >= n || j == shown)) continue;
    if (i < 0) break;
    float fi = float(i) + uSeed * 7.31;
    // Spread round the table: evenly across it, each a little off its spot.
    float across = fn <= 1.0 ? 0.5 : (float(i) + 0.5) / fn;
    across = fract(across * 0.6180339 * fn + 0.17 * uSeed);
    vec2 pos = vec2(across * 2.0 - 1.0 + (hash11(fi) - 0.5) * 0.3 / fn, (hash11(fi + 3.7) * 2.0 - 1.0)) * room;
    float angle = (hash11(fi + 9.1) * 2.0 - 1.0) * tilt;
    // Dealt from below, spinning as it lands.
    float deal = easeOut((iTime - uDeal * float(i)) / 0.6);
    if (deal <= 0.0) continue;
    pos = mix(pos + vec2(0.35, -1.3), pos, deal);
    angle += (1.0 - deal) * 0.9;
    float w = i == shown ? up : 0.0;
    drawPrint(acc, p, i, mix(pos, vec2(0.0), w), mix(angle, 0.0, w), mix(1.0, uFocusScale, w), w, px);
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Table", values: { uBackgroundAlpha: 1, uBackground: [0.36, 0.27, 0.2] } },
    { name: "Neat pile", values: { uSpread: 0.35, uTilt: 8 } },
    { name: "Wide prints", values: { uAspect: 1.5, uPrint: 0.34 } },
    { name: "Quick deal", values: { uDeal: 0.18, uHold: 1.8 } },
  ],
};

export const filmstripMontage: ShaderEffect = {
  kind: "shader",
  id: "filmstrip-montage",
  name: "Filmstrip montage",
  description: "Pictures as frames on a strip of film with sprocket holes, stepping along one frame at a time, each frame in the middle punching in, large, before it moves on.",
  category: "montage",
  video: "stills",
  tags: ["montage", "film", "filmstrip", "contact-sheet", "frame", "gallery", "retro", "items"],
  transparent: true,
  rest: 0.9,
  items: swap(6),
  source: glsl(
    `// Filmstrip montage: a strip of film stepping along, the frame in the middle punching in.
${itemControls(6)}
${COUNT(6)}
uniform float uFrame;           // @control min=0.12 max=0.5 default=0.3 label="Frame height"
uniform float uAspect;          // @control min=0.6 max=2 default=1.5 label="Frame shape (width / height)"
${HOLD(2.5)}
uniform float uPunch;           // @control min=1 max=3 default=2 label="Punch-in size"
uniform float uAngle;           // @control min=-25 max=25 default=0 label="Strip angle (degrees)"
uniform vec3 uFilm;             // @control color default=#151515 label="Film"
uniform float uShadow;          // @control min=0 max=1 default=0.4 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  int n = clamp(uCount, 1, 6);
  float fh = uFrame;
  float fw = fh * uAspect;
  float pitch = fw + fh * 0.1;
  float sh = fh * 1.38;
  // Each hold: step one frame along, then punch the middle one in and back.
  float c = iTime / max(uHold, 0.1);
  float k = floor(c);
  float f = c - k;
  float step_ = ease(f / 0.35);
  float punch = ease((f - 0.4) / 0.15) * ease((1.0 - f) / 0.15);
  float offset = (k + step_) * pitch;
  float angle = radians(uAngle);
  vec2 r = rot2(-angle) * p;
  vec4 acc = vec4(0.0);
  // The strip: film, sprocket holes cut through it, a picture in each frame.
  float strip = smoothstep(px, -px, abs(r.y) - 0.5 * sh);
  acc = over(acc, vec3(0.0), uShadow * 0.5 * exp(-pow(max(abs(r.y + 0.012) - 0.5 * sh, 0.0) / 0.02, 2.0)) * (1.0 - strip));
  if (strip > 0.0) {
    float x = r.x + offset;
    float cell = floor(x / pitch + 0.5);
    float lx = x - cell * pitch;
    float hole = tileBox(vec2(mod(x, pitch * 0.25) - pitch * 0.125, abs(r.y) - 0.5 * fh - 0.25 * (sh - fh)), vec2(pitch * 0.055, fh * 0.045), fh * 0.015);
    float film = strip * smoothstep(-px, px, hole);
    acc = over(acc, uFilm, film);
    float win = smoothstep(px, -px, tileBox(vec2(lx, r.y), vec2(0.5 * fw, 0.5 * fh), fh * 0.02));
    if (win > 0.0) {
      int item = int(mod(cell, float(n)));
      vec4 pic = itemCover(item, vec2(lx, r.y) / vec2(fw, fh) + 0.5, uAspect);
      // The frame punched out of the strip leaves it dim.
      float out_ = cell == k + 1.0 ? punch : 0.0;
      acc = over(acc, pic.rgb * (1.0 - 0.7 * out_), win * pic.a);
    }
  }
  // The punched-in frame: straightening and growing out of the strip's middle.
  if (punch > 0.0) {
    int item = int(mod(k + 1.0, float(n)));
    float scale = mix(1.0, uPunch, punch);
    vec2 q = rot2(-angle * (1.0 - punch)) * p / scale;
    vec2 half_ = vec2(0.5 * fw, 0.5 * fh);
    float qpx = px / scale;
    acc = over(acc, vec3(0.0), uShadow * punch * 0.5 * exp(-pow(max(tileBox(q - vec2(0.0, -0.015), half_, 0.01), 0.0) / 0.03, 2.0)));
    float edge = smoothstep(qpx, -qpx, tileBox(q, half_ + fh * 0.03, fh * 0.03));
    acc = over(acc, uFilm, edge * punch);
    float win = smoothstep(qpx, -qpx, tileBox(q, half_, fh * 0.02));
    vec4 pic = itemCover(item, q / (2.0 * half_) + 0.5, uAspect);
    acc = over(acc, pic.rgb, win * pic.a * punch);
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Strip", values: {} },
    { name: "Diagonal", values: { uAngle: -12, uFrame: 0.26 } },
    { name: "Big punch", values: { uPunch: 2.6, uFrame: 0.22 } },
    { name: "Light box", values: { uBackgroundAlpha: 1, uBackground: [0.96, 0.95, 0.9] } },
  ],
};

export const splitGridReveal: ShaderEffect = {
  kind: "shader",
  id: "split-grid-reveal",
  name: "Split grid reveal",
  description: "A split screen of panels, slanted like a comic page or straight like an editorial grid, each wiping its picture in a beat after the last, then drifting slowly while one panel at a time can take the spotlight.",
  category: "montage",
  video: "stills",
  tags: ["montage", "split-screen", "grid", "panel", "comic", "editorial", "wipe", "reveal", "items"],
  transparent: true,
  rest: 2.2,
  items: swap(6),
  source: glsl(
    `// Split grid reveal: panels wiping their pictures in one after another.
${itemControls(6)}
${COUNT(6)}
uniform int uLayout;            // @control min=0 max=2 default=0 label="Layout (0 columns, 1 two rows, 2 stacked rows)"
uniform float uSlant;           // @control min=-0.5 max=0.5 default=0.18 label="Slant"
uniform float uGap;             // @control min=0 max=0.05 default=0.012 label="Gap"
uniform float uBorder;          // @control min=0 max=0.02 default=0 label="Ink outline"
uniform vec3 uInk;              // @control color default=#111111 label="Ink"
uniform float uMargin;          // @control min=0 max=0.2 default=0 label="Margin"
uniform float uStagger;         // @control min=0.05 max=0.6 default=0.18 label="Seconds between panels"
uniform float uWipe;            // @control min=0.2 max=2 default=0.7 label="Wipe seconds"
uniform float uPan;             // @control min=0 max=1 default=0.4 label="Drift"
${HOLD(2.5)}
uniform float uSpotlight;       // @control min=0 max=1 default=0 label="Spotlight one at a time"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    SPOTLIGHT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  int n = clamp(uCount, 1, 6);
  float fn = float(n);
  vec2 box = vec2(aspect - 2.0 * uMargin, 1.0 - 2.0 * uMargin);
  vec2 u = ((fragCoord / iResolution.y) - vec2(uMargin)) / box;
  vec4 acc = vec4(0.0);
  if (box.x <= 0.0 || box.y <= 0.0 || any(lessThan(u, vec2(0.0))) || any(greaterThan(u, vec2(1.0)))) {
    fragColor = finish(acc);
    return;
  }
  // Which panel, where in it (0–1), and its size, by layout.
  int i;
  vec2 l;
  vec2 size;
  bool across = false;
  if (uLayout == 1 && n > 1) {
    int topCount = (n + 1) / 2;
    bool top = u.y > 0.5;
    int k = top ? topCount : n - topCount;
    float xs = u.x + (fract(u.y * 2.0) - 0.5) * uSlant * 0.5;
    float col = clamp(floor(xs * float(k)), 0.0, float(k - 1));
    i = (top ? 0 : topCount) + int(col);
    l = vec2(xs * float(k) - col, fract(u.y * 2.0));
    size = box * vec2(1.0 / float(k), 0.5);
  } else if (uLayout == 2) {
    float ys = u.y + (u.x - 0.5) * uSlant;
    float row = clamp(floor(ys * fn), 0.0, fn - 1.0);
    i = n - 1 - int(row);
    l = vec2(u.x, ys * fn - row);
    size = box * vec2(1.0, 1.0 / fn);
    across = true;
  } else {
    float xs = u.x + (u.y - 0.5) * uSlant;
    float col = clamp(floor(xs * fn), 0.0, fn - 1.0);
    i = int(col);
    l = vec2(xs * fn - col, u.y);
    size = box * vec2(1.0 / fn, 1.0);
  }
  // The gap and ink between panels.
  vec2 toEdge = min(l, 1.0 - l) * size;
  float e = min(toEdge.x, toEdge.y);
  float inside = smoothstep(0.5 * uGap - px, 0.5 * uGap + px, e);
  float ink = uBorder > 0.0 ? smoothstep(0.5 * uGap + uBorder + px, 0.5 * uGap + uBorder - px, e) * inside : 0.0;
  // The wipe: panels in turn, alternately from either end.
  float start = 0.2 + uStagger * float(i);
  float r = ease((iTime - start) / uWipe);
  bool flip = mod(float(i), 2.0) > 0.5;
  float along = across ? l.x : l.y;
  float edge = flip ? along : 1.0 - along;
  float shown = smoothstep(r * 1.05, r * 1.05 - 0.05, 1.0 - edge) * step(0.001, r);
  // The picture rides in with the wipe, then drifts slowly.
  vec2 slide = (across ? vec2(flip ? -1.0 : 1.0, 0.0) : vec2(0.0, flip ? -1.0 : 1.0)) * 0.12 * (1.0 - r);
  float t = max(iTime - start, 0.0);
  vec2 drift = uPan * 0.035 * vec2(sin(t * 0.21 + float(i) * 1.7), cos(t * 0.17 + float(i) * 2.3));
  vec2 puv = (l - 0.5 + slide) * (1.0 - 0.09 * uPan) + 0.5 + drift;
  vec4 pic = itemCover(i, puv, size.x / size.y);
  float settled = 0.2 + uStagger * (fn - 1.0) + uWipe + 0.6;
  vec4 s = spotlight(iTime, settled, uHold, n);
  float off = uSpotlight * clamp((iTime - settled) / 0.45, 0.0, 1.0) * (1.0 - spotWeight(s, i));
  vec3 col = mix(pic.rgb, vec3(dot(pic.rgb, vec3(0.299, 0.587, 0.114))) * 0.45, off);
  acc = over(acc, col, inside * shown * pic.a);
  acc = over(acc, uInk, ink * shown);
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Comic page", values: { uBorder: 0.006, uGap: 0.02, uBackgroundAlpha: 1, uBackground: [1, 1, 1], uSlant: 0.22 } },
    { name: "Editorial grid", values: { uLayout: 1, uSlant: 0, uGap: 0.016 } },
    { name: "Stacked rows", values: { uLayout: 2, uSlant: 0.1, uCount: 4 } },
    { name: "Spotlight", values: { uSpotlight: 0.65 } },
  ],
};

export const orbitGallery: ShaderEffect = {
  kind: "shader",
  id: "orbit-gallery",
  name: "Orbit gallery",
  description: "Pictures as cards on a ring in 3D (or a rising helix) that turns a step at a time to bring each to the front, the rest curving away behind it over a faint floor reflection.",
  category: "montage",
  video: "stills",
  tags: ["montage", "carousel", "ring", "3d", "gallery", "cover-flow", "helix", "items"],
  transparent: true,
  rest: 0,
  items: swap(6),
  source: glsl(
    `// Orbit gallery: cards on a ring that turns to bring each to the front.
${itemControls(6)}
${COUNT(6)}
uniform float uCard;            // @control min=0.2 max=0.8 default=0.42 label="Card size"
uniform float uAspect;          // @control min=0.5 max=2 default=1.33 label="Card shape (width / height)"
uniform float uSpread;          // @control min=0.7 max=1.8 default=1.25 label="Ring size"
uniform float uTilt;            // @control min=-0.4 max=0.5 default=0.22 label="View from above"
uniform float uHelix;           // @control min=0 max=0.5 default=0 label="Helix rise"
${HOLD(2.5)}
uniform float uFade;            // @control min=0 max=1 default=0.55 label="Fade the back"
uniform float uReflect;         // @control min=0 max=1 default=0.25 label="Floor reflection"
uniform float uRadius;          // @control min=0 max=0.1 default=0.03 label="Corner radius"
uniform vec3 uBack;             // @control color default=#1F2937 label="Card backs (tint)"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    `const float CAM = 3.0;
const float FOCAL = 2.0;

// Card i of n on the ring turned by spin: its centre, and its angle (0 facing the camera).
vec4 cardAt(int i, int n, float spin, float radius, float ch) {
  float a = 6.28318 * float(i) / float(n) - spin;
  // A helix: cards rise round the ring from the one in front, the far side's step out of sight behind.
  float around = mod(a + 3.14159, 6.28318) - 3.14159;
  return vec4(radius * sin(a), uHelix * ch * around / 6.28318 * float(n), radius * cos(a), a);
}

// Where the ray meets card i: x, y on the card (0–1), the distance, and the edge's coverage (0 for a miss).
vec4 hitCard(vec3 ro, vec3 rd, vec4 c, vec2 half_, float px) {
  vec3 nrm = vec3(sin(c.w), 0.0, cos(c.w));
  float dn = dot(rd, nrm);
  if (abs(dn) < 1e-4) return vec4(0.0);
  float t = dot(c.xyz - ro, nrm) / dn;
  if (t <= 0.0) return vec4(0.0);
  vec3 h = ro + rd * t - c.xyz;
  vec2 q = vec2(dot(h, vec3(cos(c.w), 0.0, -sin(c.w))), h.y);
  float d = tileBox(q, half_, uRadius * half_.y * 2.0);
  float cover = smoothstep(px * t, -px * t, d);
  return vec4(q / (2.0 * half_) + 0.5, t, cover);
}

// The cards along a ray, back to front: what it sees, premultiplied.
vec4 traceCards(vec3 ro, vec3 rd, int n, float spin, float radius, vec2 half_, float px) {
  vec4 acc = vec4(0.0);
  float depths[6];
  for (int j = 0; j < 6; j++) depths[j] = j < n ? cos(6.28318 * float(j) / float(n) - spin) + float(j) * 1e-3 : 99.0;
  for (int pass = 0; pass < 6; pass++) {
    if (pass >= n) break;
    int which = 0;
    for (int j = 0; j < 6; j++) {
      int rank = 0;
      for (int m = 0; m < 6; m++) rank += depths[m] < depths[j] ? 1 : 0;
      if (j < n && rank == pass) which = j;
    }
    vec4 c = cardAt(which, n, spin, radius, 2.0 * half_.y);
    vec4 hit = hitCard(ro, rd, c, half_, px);
    if (hit.w <= 0.0) continue;
    float facing = cos(c.w);
    float shade = mix(1.0, 0.4 + 0.6 * (0.5 + 0.5 * facing), uFade);
    vec3 col;
    float a = hit.w;
    // From behind, the picture shows through the card, mirrored and tinted.
    bool back = dot(rd, vec3(sin(c.w), 0.0, cos(c.w))) > 0.0;
    vec4 pic = itemCover(which, back ? vec2(1.0 - hit.x, hit.y) : hit.xy, uAspect);
    col = (back ? mix(pic.rgb, uBack, 0.65) : pic.rgb) * shade;
    a *= back ? 1.0 : pic.a;
    acc = over(acc, col, a);
  }
  return acc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.5 / (iResolution.y * FOCAL);
  int n = clamp(uCount, 1, 6);
  // Size the ring so the front card is uCard of the frame high and the cards just clear each other.
  float k = float(n) * uAspect * 1.25 * uSpread / 6.28318;
  float ch = uCard * CAM / (FOCAL + uCard * k);
  float radius = n > 1 ? k * ch : 0.0;
  vec2 half_ = 0.5 * vec2(ch * uAspect, ch);
  // Hold each card in front, then turn to the next.
  float c = iTime / max(uHold, 0.1);
  float step_ = floor(c);
  float spin = 6.28318 / float(n) * (step_ + ease((c - step_ - 0.6) / 0.4));
  vec3 ro = vec3(0.0, uTilt * CAM, CAM);
  vec3 fwd = normalize(-ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd * FOCAL + right * p.x + up * p.y);
  vec4 acc = traceCards(ro, rd, n, spin, radius, half_, px);
  // A faint reflection in the floor just under the cards.
  float floorY = -half_.y - 0.02 - 0.5 * uHelix * ch * float(n);
  if (uReflect > 0.0 && acc.a < 0.999 && rd.y < 0.0 && ro.y > floorY) {
    float t = (floorY - ro.y) / rd.y;
    vec3 fp = ro + rd * t;
    vec4 mirror = traceCards(fp, vec3(rd.x, -rd.y, rd.z), n, spin, radius, half_, px);
    float fade = uReflect * 0.5 * exp(-3.0 * length(fp.xz) / max(radius + half_.x, 0.3));
    acc = acc + mirror * fade * (1.0 - acc.a);
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Ring", values: {} },
    { name: "Helix", values: { uHelix: 0.18, uTilt: 0.2, uReflect: 0 } },
    { name: "Portrait cards", values: { uAspect: 0.7, uCard: 0.5 } },
    { name: "Stage", values: { uBackgroundAlpha: 1, uBackground: [0.04, 0.05, 0.08], uReflect: 0.5 } },
  ],
};

export const beforeAfterSeries: ShaderEffect = {
  kind: "shader",
  id: "before-after-series",
  name: "Before / after series",
  description: "A series of before-and-after pairs, items taken two at a time: a divider sweeps each pair from before to after, then the next pair slides or fades in, with a dot for each pair below.",
  category: "montage",
  video: "stills",
  tags: ["montage", "before-after", "comparison", "edit", "generations", "slider", "series", "items"],
  transparent: true,
  rest: 1.6,
  items: swap(6, 2, 6),
  source: glsl(
    `// Before / after series: pairs of items, each swept from before to after by a divider.
${itemControls(6)}
${COUNT(6, 6, 2)}
uniform float uAspect;          // @control min=0.5 max=2.5 default=1.6 label="Frame shape (width / height)"
uniform float uSize;            // @control min=0.4 max=1 default=0.8 label="Size"
uniform float uRadius;          // @control min=0 max=0.08 default=0.02 label="Corner radius"
${HOLD(4)}
uniform int uChange;            // @control min=0 max=1 default=0 label="Next pair (0 slide, 1 fade)"
uniform vec3 uLine;             // @control color default=#FFFFFF label="Divider"
uniform bool uHandle;           // @control default=true label="Handle"
uniform bool uDots;             // @control default=true label="Pair dots"
uniform float uShadow;          // @control min=0 max=1 default=0.3 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMPOSITE,
    MOTION,
    itemGlsl(6),
    `// Pair k in a frame centred at x0 with the divider at split (0 all after … 1 all before).
void drawPair(inout vec4 acc, vec2 p, float x0, int pair, int n, float split, float alpha, vec2 half_, float px) {
  vec2 q = p - vec2(x0, 0.0);
  float d = tileBox(q, half_, uRadius);
  acc = over(acc, vec3(0.0), alpha * uShadow * 0.5 * exp(-pow(max(tileBox(q - vec2(0.0, -0.015), half_, uRadius), 0.0) / 0.03, 2.0)));
  float cover = smoothstep(px, -px, d) * alpha;
  if (cover <= 0.0) return;
  vec2 uv = q / (2.0 * half_) + 0.5;
  int before = min(2 * pair, n - 1);
  int after = min(2 * pair + 1, n - 1);
  float sx = (split - 0.5) * 2.0 * half_.x;
  vec4 pic = q.x < sx ? itemCover(before, uv, uAspect) : itemCover(after, uv, uAspect);
  acc = over(acc, pic.rgb, cover * pic.a);
  if (split > 0.001 && split < 0.999) {
    float line = smoothstep(px * 1.5, 0.0, abs(q.x - sx) - px);
    acc = over(acc, uLine, line * cover);
    if (uHandle) {
      float knob = length(q - vec2(sx, 0.0));
      float rad = 0.035 * 2.0 * half_.y;
      acc = over(acc, uLine, smoothstep(px, -px, knob - rad) * alpha);
      acc = over(acc, vec3(0.2), smoothstep(px, -px, abs(knob - rad * 0.55) - rad * 0.09) * alpha);
    }
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  int n = clamp(uCount, 2, 6);
  int pairs = (n + 1) / 2;
  float h = uSize * min(1.0, aspect / uAspect) * (uDots ? 0.9 : 1.0);
  vec2 half_ = 0.5 * vec2(h * uAspect, h);
  vec2 at = p - vec2(0.0, uDots ? 0.04 : 0.0);
  float c = iTime / max(uHold, 0.1);
  float k = floor(c);
  float f = c - k;
  int pair = int(mod(k, float(pairs)));
  // Before, swept to after, held, then on to the next pair.
  float split = 1.0 - ease((f - 0.15) / 0.5);
  float change = pairs > 1 ? ease((f - 0.85) / 0.15) : 0.0;
  vec4 acc = vec4(0.0);
  if (change <= 0.0) {
    drawPair(acc, at, 0.0, pair, n, split, 1.0, half_, px);
  } else if (uChange == 1) {
    drawPair(acc, at, 0.0, pair, n, 0.0, 1.0 - change, half_, px);
    drawPair(acc, at, 0.0, int(mod(k + 1.0, float(pairs))), n, 1.0, change, half_, px);
  } else {
    float gap = 2.0 * half_.x + 0.06;
    drawPair(acc, at, -change * gap, pair, n, 0.0, 1.0, half_, px);
    drawPair(acc, at, (1.0 - change) * gap, int(mod(k + 1.0, float(pairs))), n, 1.0, 1.0, half_, px);
  }
  if (uDots && pairs > 1) {
    float current = mod(k + (change > 0.5 ? 1.0 : 0.0), float(pairs));
    for (int j = 0; j < 3; j++) {
      if (j >= pairs) break;
      vec2 dc = vec2((float(j) - 0.5 * float(pairs - 1)) * 0.035, -half_.y - 0.035);
      float on = float(j) == current ? 1.0 : 0.35;
      acc = over(acc, uLine * 0.5 + 0.5 * vec3(on), smoothstep(px, -px, length(at - dc) - 0.008) * mix(0.5, 1.0, on));
    }
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Slide", values: {} },
    { name: "Fade", values: { uChange: 1 } },
    { name: "Square", values: { uAspect: 1, uSize: 0.78 } },
    { name: "Clean", values: { uHandle: false, uDots: false, uShadow: 0 } },
  ],
};

export const wallZoom: ShaderEffect = {
  kind: "shader",
  id: "wall-zoom",
  name: "Wall zoom",
  description: "A picture full frame breaks into a mosaic wall of all the items, tinted to its colours, then the view zooms into one tile until that picture fills the frame and becomes the next wall: a never-ending gallery.",
  category: "montage",
  video: "stills",
  tags: ["montage", "mosaic", "wall", "zoom", "droste", "infinite", "gallery", "photomosaic", "items"],
  transparent: false,
  rest: 1.1,
  items: swap(6),
  source: glsl(
    `// Wall zoom: a picture becomes a mosaic of the items, then zooms into the next one.
${itemControls(6)}
${COUNT(6)}
uniform int uGrid;              // @control min=3 max=9 default=5 label="Tiles across (odd)"
${HOLD(4)}
uniform float uGap;             // @control min=0 max=0.03 default=0.006 label="Gap"
uniform float uTint;            // @control min=0 max=1 default=0.55 label="Mosaic tint"
uniform float uRadius;          // @control min=0 max=0.05 default=0.006 label="Corner radius"
uniform vec3 uGapColor;         // @control color default=#0B0B0F label="Gaps"
${BACKDROP_CONTROLS}`,
    PICTURE,
    MOTION,
    itemGlsl(6),
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  int n = clamp(uCount, 1, 6);
  float g = float(2 * (clamp(uGrid, 3, 9) / 2) + 1);
  float c = iTime / max(uHold, 0.1);
  float k = floor(c);
  float u = c - k;
  int cur = int(mod(k, float(n)));
  int next = int(mod(k + 1.0, float(n)));
  // The picture breaks into the wall, then the view zooms into the middle tile.
  float mosaic = ease(u / 0.25);
  float z = ease((u - 0.3) / 0.55);
  float zoom = pow(g, z);
  vec2 w = (uv - 0.5) / zoom + 0.5;
  vec2 cell = floor(w * g);
  vec2 lw = w * g - cell;
  bool middle = all(equal(cell, vec2(floor(0.5 * g))));
  int item = middle ? next : int(floor(hash11(dot(cell, vec2(1.0, 17.0)) + k * 7.13) * float(n)));
  vec4 tile = itemCover(item, lw, aspect);
  // Photomosaic: each tile tinted to the colour of the picture where it sits, the tint going as the zoom arrives.
  vec3 tint = itemCover(cur, (cell + 0.5) / g, aspect).rgb;
  float luma = dot(tile.rgb, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(tile.rgb, tint * (0.35 + 0.95 * luma), uTint * (1.0 - z));
  vec2 toEdge = min(lw, 1.0 - lw) * vec2(aspect, 1.0) * zoom / g;
  float gap = uGap * (1.0 - z);
  float inTile = smoothstep(px, -px, tileBox((lw - 0.5) * vec2(aspect, 1.0) * zoom / g, vec2(0.5 * aspect, 0.5) * zoom / g - 0.5 * gap, uRadius * (1.0 - z)));
  col = mix(col, uGapColor, (1.0 - inTile) * step(0.0005, gap));
  vec4 whole = itemCover(cur, uv, aspect);
  // Gaps are opaque; a picture with transparency keeps it.
  float alpha = mix(whole.a, mix(1.0, tile.a, inTile), mosaic);
  fragColor = vec4(mix(whole.rgb, col, mosaic), alpha);
}`,
  ),
  presets: [
    { name: "Mosaic", values: {} },
    { name: "Fine mosaic", values: { uGrid: 9, uTint: 0.75, uGap: 0.003 } },
    { name: "Clean tiles", values: { uTint: 0, uGap: 0.012, uRadius: 0.02, uGrid: 3 } },
    { name: "Slow", values: { uHold: 7 } },
  ],
};

export const deviceMorph: ShaderEffect = {
  kind: "shader",
  id: "device-morph",
  name: "Device morph",
  description: "One screen whose frame morphs from phone to tablet to laptop (or any devices you give it), its screenshot changing to each breakpoint's layout as it grows: a responsive design at a glance.",
  category: "montage",
  video: "stills",
  tags: ["montage", "devices", "responsive", "breakpoints", "screenshots", "morph", "mockup", "product", "items"],
  transparent: true,
  rest: 0,
  items: { ...swap(4), devices: ["uDevice0", "uDevice1", "uDevice2", "uDevice3"] },
  source: glsl(
    `// Device morph: one frame changing shape from device to device, its screenshot with it.
${itemControls(4)}
${[0, 1, 2, 3].map((i) => `uniform int uDevice${i};        // @control min=0 max=5 default=${[0, 1, 2, 3][i]} label="Device ${i + 1} (0 phone, 1 tablet, 2 laptop, 3 desktop, 4 watch, 5 browser)"`).join("\n")}
${COUNT(4, 3)}
${HOLD(2.5)}
uniform float uMorph;           // @control min=0.15 max=0.9 default=0.4 label="Share of each hold spent changing"
uniform float uSize;            // @control min=0.3 max=1 default=0.78 label="Size"
uniform float uFloat;           // @control min=0 max=1 default=0.3 label="Float"
uniform vec3 uBezel;            // @control color default=#111827 label="Bezel"
uniform float uShadow;          // @control min=0 max=1 default=0.35 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    DEVICE_GLSL,
    COMPOSITE,
    SCREEN,
    MOTION,
    `vec4 shot(int i, vec2 suv, float aspect) {
  if (i == 0) return screenRGBA(uItem0, suv, aspect);
  if (i == 1) return screenRGBA(uItem1, suv, aspect);
  if (i == 2) return screenRGBA(uItem2, suv, aspect);
  return screenRGBA(uItem3, suv, aspect);
}
int deviceOf(int i) {
  return clamp(i == 0 ? uDevice0 : i == 1 ? uDevice1 : i == 2 ? uDevice2 : uDevice3, 0, 5);
}
// The body of a device kind, as a box: centre, half size; and its corner radius.
vec4 bodyBox(int k) {
  return k == 2 ? vec4(0.0, 0.06, 0.66, 0.43) : k == 3 ? vec4(0.0, 0.12, 0.74, 0.4) : k == 4 ? vec4(0.0, 0.0, 0.27, 0.33) : vec4(0.0, 0.0, 0.5 * deviceSize(k).x, 0.5);
}
float bodyRadius(int k) {
  return k == 0 ? 0.075 : k == 1 ? 0.045 : k == 4 ? 0.12 : k == 3 ? 0.02 : 0.03;
}
// How much of kind want a blend of kinds a and b (by m) has.
float share(int want, int a, int b, float m) {
  return (a == want ? 1.0 - m : 0.0) + (b == want ? m : 0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  int n = clamp(uCount, 1, 4);
  float c = iTime / max(uHold, 0.1);
  float k = floor(c);
  float f = c - k;
  int from = int(mod(k, float(n)));
  int to = int(mod(k + 1.0, float(n)));
  float m = n > 1 ? ease((f - (1.0 - uMorph)) / uMorph) : 0.0;
  int a = deviceOf(from);
  int b = deviceOf(to);
  // Sized to fit, wide frames by their width, blending from one fit to the other.
  float fitA = min(iResolution.y * uSize, iResolution.x * uSize / deviceSize(a).x);
  float fitB = min(iResolution.y * uSize, iResolution.x * uSize / deviceSize(b).x);
  float h = mix(fitA, fitB, m);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / h;
  float px = 1.5 / h;
  p.y -= uFloat * 0.02 * sin(iTime * 1.3);
  vec4 bodyA = bodyBox(a);
  vec4 bodyB = bodyBox(b);
  vec4 body = mix(bodyA, bodyB, m);
  float radius = mix(bodyRadius(a), bodyRadius(b), m);
  vec4 sr = mix(deviceScreen(a), deviceScreen(b), m);
  float sRadius = mix(deviceScreenRadius(a), deviceScreenRadius(b), m);
  // The parts only some devices have, grown and faded with their share.
  float laptop = share(2, a, b, m);
  float desktop = share(3, a, b, m);
  float watch = share(4, a, b, m);
  float browser = share(5, a, b, m);
  float phone = share(0, a, b, m);
  float d = dsBox(p - body.xy, body.zw, radius);
  float base = dsBox(p - vec2(0.0, -0.42), vec2(0.78 * laptop, 0.035), 0.02);
  float neck = min(dsBox(p - vec2(0.0, -0.36), vec2(0.06, 0.1 * desktop), 0.0), dsBox(p - vec2(0.0, -0.47), vec2(0.22 * desktop, 0.025), 0.02));
  float strap = dsBox(p, vec2(0.19, 0.5 * watch), 0.05);
  vec4 acc = vec4(0.0);
  float bottom = mix(-0.5, -0.45, max(laptop, desktop));
  float shadow = exp(-pow(length((p - vec2(0.0, bottom - 0.06)) * vec2(1.0 / max(2.0 * body.z, 0.4), 7.0)), 2.0) * 2.0);
  acc = over(acc, vec3(0.0), shadow * uShadow * 0.6);
  acc = over(acc, uBezel * 0.8, smoothstep(px, -px, strap) * watch);
  acc = over(acc, uBezel, smoothstep(px, -px, neck) * desktop);
  acc = over(acc, uBezel * 0.75 + 0.18, smoothstep(px, -px, base) * laptop);
  vec3 col = uBezel;
  col = mix(col, uBezel * 1.2 + 0.08, browser * step(sr.y + sr.w, p.y));
  acc = over(acc, col, smoothstep(px, -px, d));
  if (browser > 0.0) {
    for (int i = 0; i < 3; i++) {
      vec2 dotAt = vec2(-body.z + 0.05 + 0.035 * float(i), body.y + body.w - 0.045);
      acc = over(acc, vec3(0.95, 0.4 + 0.2 * float(i), 0.35), smoothstep(px, -px, length(p - dotAt) - 0.011) * browser);
    }
  }
  float screen = smoothstep(px, -px, dsBox(p - sr.xy, sr.zw, sRadius));
  screen *= 1.0 - phone * smoothstep(-px, px, -dsBox(p - vec2(0.0, sr.y + sr.w - 0.03), vec2(0.05, 0.012), 0.012));
  if (screen > 0.0) {
    vec2 suv = (p - sr.xy) / (2.0 * sr.zw) + 0.5;
    float aspect = sr.z / sr.w;
    // The layout changes as the frame passes halfway.
    float swap_ = smoothstep(0.35, 0.65, m);
    vec4 s = swap_ < 1.0 ? shot(from, suv, aspect) : vec4(0.0);
    if (swap_ > 0.0) s = mix(s, shot(to, suv, aspect), swap_);
    acc = over(acc, s.rgb, screen * s.a);
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Phone to laptop", values: {} },
    { name: "Phone to desktop", values: { uCount: 4, uDevice3: 3 } },
    { name: "Browser widths", values: { uCount: 3, uDevice0: 0, uDevice1: 1, uDevice2: 5 } },
    { name: "On a panel", values: { uBackgroundAlpha: 1, uBackground: [0.93, 0.95, 1] } },
  ],
};

export const montageGalleryShaders: ShaderEffect[] = [deviceMorph, bentoMontage, photoScatter, filmstripMontage, splitGridReveal, orbitGallery, beforeAfterSeries, wallZoom];
