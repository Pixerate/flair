import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Pixel looks stay crisp: every effect works on a virtual low-resolution grid
 * (`floor(fragCoord / uPixel)`), samples images at the centre of each virtual
 * pixel and quantises colours to a few levels, so no edge is ever blended.
 */

/**
 * A 5 × 7 pixel font: each glyph seven rows of five, `#` inked, top row first.
 * Shared by the shaders (packed into ints, see {@link packGlyph}) and the
 * vector pixel effects (drawn as paths).
 */
export const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "/": [".....", "....#", "...#.", "..#..", ".#...", "#....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "*": [".....", "..#..", "#.#.#", ".###.", "#.#.#", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".####"],
};

/** A glyph of {@link PIXEL_FONT}, upper-casing letters; unknown characters are `?`. */
export function pixelGlyph(char: string): readonly string[] {
  return PIXEL_FONT[char] ?? PIXEL_FONT[char.toUpperCase()] ?? PIXEL_FONT["?"]!;
}

/** A glyph as GLSL `ivec2`: bit (x + 5y) of .x holds rows 0–3 (top first), of .y rows 4–6 (as image-ascii). */
function packGlyph(rows: readonly string[]): string {
  let a = 0;
  let b = 0;
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "#") return;
      if (y < 4) a |= 1 << (x + 5 * y);
      else b |= 1 << (x + 5 * (y - 4));
    }),
  );
  return `ivec2(${a}, ${b})`;
}

/** `#rrggbb` as a GLSL `vec3`. */
const vec3Hex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(3));
  return `vec3(${c.map((v) => (Number.isInteger(v) ? `${v}.0` : String(v))).join(", ")})`;
};

/** A GLSL `const vec3 NAME[n]` palette. */
const paletteArray = (name: string, hexes: readonly string[]) =>
  `const vec3 ${name}[${hexes.length}] = vec3[${hexes.length}](\n  ${hexes.map(vec3Hex).join(",\n  ")}\n);`;

const GAMEBOY = ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"];
const PICO8 = ["#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8", "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"];
const NES = ["#000000", "#FCFCFC", "#BCBCBC", "#7C7C7C", "#A81000", "#F83800", "#FCA044", "#F8D878", "#005800", "#00B800", "#B8F818", "#0058F8", "#3CBCFC", "#6844FC", "#D800CC", "#503000"];
const CGA = ["#000000", "#55FFFF", "#FF55FF", "#FFFFFF"];
const C64 = ["#000000", "#FFFFFF", "#880000", "#AAFFEE", "#CC44CC", "#00CC55", "#0000AA", "#EEEE77", "#DD8855", "#664400", "#FF7777", "#333333", "#777777", "#AAFF66", "#0088FF", "#BBBBBB"];

/** Ordered dithering thresholds, 0–1: `bayer4(cell)` (16 levels) and `bayer8(cell)` (64). */
const BAYER = `
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
float bayer8(vec2 a) {
  return bayer4(0.5 * a) * 0.25 + bayer2(a);
}`.trim();

/** 1D value noise along x, 0–1, for skylines (needs HASH). */
const NOISE1 = `
float noise1(float x, float seed) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash12(vec2(i, seed)), hash12(vec2(i + 1.0, seed)), f);
}`.trim();

export const image8bit: ShaderEffect = {
  kind: "shader",
  id: "image-8bit",
  name: "8-bit",
  description: "An image on a chunky pixel grid, reduced to a classic console or computer palette with ordered Bayer dithering.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "retro", "image", "8-bit", "dither", "palette", "game-boy", "pico-8"],
  source: glsl(
    `// 8-bit: an image on a chunky pixel grid in a classic palette, Bayer-dithered.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uPalette;      // @control min=0 max=5 default=0 label="Palette (0 Game Boy, 1 PICO-8, 2 NES, 3 CGA, 4 C64, 5 1-bit)"
uniform float uPixel;      // @control min=1 max=16 default=4 step=1 label="Pixel size"
uniform float uDither;     // @control min=0 max=1 default=0.7 label="Dither"
uniform bool uBayer8;      // @control default=true label="8 × 8 Bayer matrix"
uniform float uContrast;   // @control min=0.5 max=2 default=1.1 label="Contrast"
${BACKDROP_CONTROLS}`,
    PICTURE,
    BAYER,
    paletteArray("GAMEBOY", GAMEBOY),
    paletteArray("PICO8", PICO8),
    paletteArray("NES", NES),
    paletteArray("CGA", CGA),
    paletteArray("C64", C64),
    `// The palette colour closest to c (weighted for the eye).
vec3 nearest(vec3 c, int pal) {
  vec3 best = vec3(0.0);
  float bestDist = 1e9;
  for (int i = 0; i < 16; i++) {
    vec3 p;
    if (pal == 1) p = PICO8[i];
    else if (pal == 2) p = NES[i];
    else if (pal == 4) p = C64[i];
    else {
      if (i >= 4) break;
      p = CGA[i];
    }
    vec3 d = c - p;
    float dist = dot(d * d, vec3(0.3, 0.59, 0.11));
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec4 pic = pictureRGBA(uImage, (cell + 0.5) * uPixel / iResolution.xy);
  vec3 src = clamp((pic.rgb - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float threshold = (uBayer8 ? bayer8(cell) + 0.5 / 64.0 : bayer4(cell) + 0.5 / 16.0) - 0.5;
  vec3 col;
  if (uPalette == 0 || uPalette == 5) {
    // Shades of one ramp: dither the brightness between its levels.
    float levels = uPalette == 0 ? 3.0 : 1.0;
    float l = dot(src, vec3(0.2126, 0.7152, 0.0722));
    int i = int(clamp(floor(l * levels + 0.5 + threshold * uDither), 0.0, levels));
    col = uPalette == 0 ? GAMEBOY[i] : vec3(float(i));
  } else {
    float spread = uPalette == 3 ? 0.55 : 0.22;
    col = nearest(src + threshold * uDither * spread, uPalette);
  }
  // Pixels are whole, so alpha is cut at a half rather than blended.
  fragColor = vec4(col, step(0.5, pic.a));
}`,
  ),
  presets: [
    { name: "Game Boy", values: { uPalette: 0, uPixel: 4 } },
    { name: "PICO-8", values: { uPalette: 1, uPixel: 4 } },
    { name: "NES", values: { uPalette: 2, uPixel: 3 } },
    { name: "CGA", values: { uPalette: 3, uPixel: 3, uDither: 0.9 } },
    { name: "C64", values: { uPalette: 4, uPixel: 5, uBayer8: false } },
    { name: "1-bit", values: { uPalette: 5, uPixel: 2, uDither: 1 } },
  ],
};

export const gameboyScreen: ShaderEffect = {
  kind: "shader",
  id: "gameboy-screen",
  name: "Game Boy screen",
  description: "An image on a handheld's green dot-matrix LCD: four shades, a visible pixel grid and smeary ghosting, inset in an olive bezel.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "retro", "image", "game-boy", "lcd", "handheld", "screen"],
  source: glsl(
    `// Game Boy screen: an image on a 4-shade green LCD with a pixel grid, ghosting and a bezel.
uniform sampler2D uImage;  // @control filter=linear wrap=repeat default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uLines;      // @control min=36 max=144 default=144 step=1 label="Screen lines"
uniform float uPan;        // @control min=-0.3 max=0.3 default=0.04 label="Pan speed"
uniform float uGhost;      // @control min=0 max=1 default=0.5 label="Ghosting"
uniform float uGrid;       // @control min=0 max=1 default=0.6 label="Pixel grid"
uniform bool uDither;      // @control default=true label="Dither"
uniform vec3 uDark;        // @control color default=#0F380F label="Darkest shade"
uniform vec3 uLight;       // @control color default=#9BBC0F label="Lightest shade"
uniform vec3 uBezel;       // @control color default=#4E5236 label="Bezel"
uniform vec3 uCase;        // @control color default=#C9C6BC label="Case"
${BACKDROP_CONTROLS}`,
    PICTURE,
    BAYER,
    `// The LCD shade (0 darkest – 3 lightest) of the picture at uv, for screen pixel cell.
float shade(vec2 uv, vec2 cell) {
  float l = dot(picture(uImage, uv), vec3(0.2126, 0.7152, 0.0722));
  float d = uDither ? (bayer4(cell) - 0.47) * 0.7 : 0.0;
  return clamp(floor(l * 3.0 + 0.5 + d), 0.0, 3.0);
}

vec3 lcd(float s) {
  // The DMG's four greens sit at about these points between darkest and lightest.
  float w = s < 0.5 ? 0.0 : (s < 1.5 ? 0.28 : (s < 2.5 ? 0.88 : 1.0));
  return mix(uDark, uLight, w);
}

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float lines = floor(uLines);
  float cols = floor(lines * 160.0 / 144.0 + 0.5);
  // Whole device pixels per LCD pixel, so the grid is even.
  float px = max(1.0, floor(min(res.y * 0.64 / lines, res.x * 0.7 / cols)));
  vec2 size = vec2(cols, lines) * px;
  vec2 origin = floor((res - size) * 0.5);
  vec2 q = fragCoord - origin;
  float margin = floor(size.y * 0.12);

  vec3 col = uCase;
  // The bezel round the screen, with a rounded lower-right corner like the DMG's.
  vec2 bc = q - size * 0.5 - vec2(0.0, margin * 0.25);
  vec2 bh = size * 0.5 + vec2(margin * 1.6, margin * 1.25);
  float corner = (bc.x > 0.0 && bc.y < 0.0) ? margin * 2.0 : margin * 0.4;
  float bezel = roundBox(bc, bh, corner);
  col = mix(col, uBezel, clamp(0.5 - bezel, 0.0, 1.0));
  // Two stripes across the top of the bezel.
  float top = size.y + margin * 0.6;
  if (bezel < -1.0 && q.y > top && q.y < top + max(1.0, floor(margin * 0.08)))
    col = vec3(0.55, 0.15, 0.35);
  if (bezel < -1.0 && q.y > top + margin * 0.18 && q.y < top + margin * 0.18 + max(1.0, floor(margin * 0.08)))
    col = vec3(0.15, 0.18, 0.42);
  // Power LED.
  vec2 led = vec2(-margin * 0.85, size.y * 0.62);
  float ledR = max(2.0, margin * 0.18);
  float glow = 0.85 + 0.15 * sin(iTime * 3.0);
  col = mix(col, vec3(0.95, 0.15, 0.12) * glow, clamp(ledR - length(q - led) + 0.5, 0.0, 1.0));

  if (q.x >= 0.0 && q.y >= 0.0 && q.x < size.x && q.y < size.y) {
    vec2 cell = floor(q / px);
    vec2 f = q - cell * px;
    vec2 uv = (cell + 0.5) / vec2(cols, lines);
    vec2 now = uv + vec2(iTime * uPan, 0.0);
    // Ghosting: the LCD is slow, so where the picture was a moment ago still shows.
    vec2 before = now - vec2(uPan * 0.35, 0.0);
    float s = shade(now, cell);
    float g = shade(before, cell);
    vec3 lit = mix(lcd(s), lcd(g), uGhost * 0.45);
    // Each dot casts a faint shadow down and right onto the screen behind it.
    float behind = shade(now - vec2(1.0 / cols, -1.0 / lines), cell + vec2(-1.0, 1.0));
    lit = mix(lit, lcd(min(s, behind)), uGhost * 0.2);
    // The grid between dots shows the lighter screen behind.
    float edge = px >= 3.0 ? float(f.x < 1.0 || f.y >= px - 1.0) : 0.0;
    col = mix(lit, mix(uLight, vec3(1.0), 0.08), edge * uGrid * 0.6);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Chunky", values: { uLines: 72 } },
    { name: "Pocket", values: { uDark: [0.16, 0.16, 0.14], uLight: [0.77, 0.79, 0.72], uBezel: [0.42, 0.42, 0.4], uCase: [0.78, 0.78, 0.76] } },
  ],
};

export const pixelFire: ShaderEffect = {
  kind: "shader",
  id: "pixel-fire",
  name: "Pixel fire",
  description: "Chunky Doom-style pixel fire licking up from the bottom through a stepped black, red, orange, yellow and white ramp.",
  category: "retro",
  tags: ["pixel", "retro", "fire", "flames", "doom", "demoscene", "loop"],
  source: glsl(
    `// Pixel fire: Doom-style chunky flames in a stepped palette ramp.
uniform float uPixel;    // @control min=2 max=16 default=6 step=1 label="Pixel size"
uniform float uHeight;   // @control min=0.2 max=1.2 default=0.65 label="Flame height"
uniform float uWind;     // @control min=-1 max=1 default=0.2 label="Wind"
uniform float uSpeed;    // @control min=0 max=3 default=1 label="Speed"
uniform float uFlicker;  // @control min=0 max=1 default=0.5 label="Flicker"
uniform int uLevels;     // @control min=3 max=16 default=9 label="Palette steps"
uniform vec3 uEmber;     // @control color default=#7A0E06 label="Embers"
uniform vec3 uFlame;     // @control color default=#F2560E label="Flame"
uniform vec3 uCore;      // @control color default=#FFE27A label="Core"`,
    HASH,
    NOISE,
    FBM,
    `// Black → embers → flame → core → white.
vec3 ramp(float t) {
  vec3 c = mix(vec3(0.02, 0.01, 0.01), uEmber, smoothstep(0.0, 0.3, t));
  c = mix(c, uFlame, smoothstep(0.3, 0.6, t));
  c = mix(c, uCore, smoothstep(0.6, 0.85, t));
  return mix(c, vec3(1.0, 1.0, 0.94), smoothstep(0.85, 1.0, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  float rows = max(floor(iResolution.y / uPixel), 1.0);
  float t = iTime * uSpeed;
  float y = cell.y / rows;
  // Columns lean with the wind the higher they get.
  float x = cell.x / rows - uWind * y * y * 0.8;
  float n = fbm(vec2(x * 7.0 + uWind * t * 1.5, y * 4.0 - t * 2.6), 4);
  float flick = hash12(cell + floor(t * 14.0) * 7.31) - 0.5;
  float heat = 1.05 - (y / uHeight) * (0.35 + 1.5 * n) + flick * 0.22 * uFlicker;
  float levels = float(uLevels);
  float lvl = clamp(floor(heat * levels), 0.0, levels - 1.0);
  fragColor = vec4(ramp(lvl / (levels - 1.0)), 1.0);
}`,
  ),
  presets: [
    { name: "Doom", values: { uPixel: 6, uLevels: 9 } },
    { name: "Blue flame", values: { uEmber: [0.04, 0.08, 0.42], uFlame: [0.16, 0.48, 1], uCore: [0.75, 0.96, 1] } },
    { name: "Toxic", values: { uEmber: [0.1, 0.3, 0.02], uFlame: [0.4, 0.85, 0.1], uCore: [0.85, 1, 0.5], uWind: -0.4 } },
  ],
};

export const pixelLandscape: ShaderEffect = {
  kind: "shader",
  id: "pixel-landscape",
  name: "Pixel landscape",
  description: "A parallax pixel-art landscape: clouds, snowy mountains, hills and pines scrolling at different speeds under a pixel sun or moon.",
  category: "retro",
  tags: ["pixel", "retro", "landscape", "parallax", "game", "background", "16-bit"],
  source: glsl(
    `// Pixel landscape: parallax layers of a limited-palette scene, each scrolling whole pixels.
uniform float uPixel;     // @control min=2 max=12 default=4 step=1 label="Pixel size"
uniform float uSpeed;     // @control min=0 max=4 default=1 label="Scroll speed"
uniform vec3 uSkyTop;     // @control color default=#3E6FD8 label="Sky top"
uniform vec3 uSkyBottom;  // @control color default=#A8DCFF label="Sky bottom"
uniform vec3 uSun;        // @control color default=#FFE066 label="Sun / moon"
uniform vec3 uCloud;      // @control color default=#FFFFFF label="Clouds"
uniform vec3 uFar;        // @control color default=#6E7EC0 label="Mountains"
uniform vec3 uMid;        // @control color default=#3F9A4F label="Hills"
uniform vec3 uNear;       // @control color default=#1E5B30 label="Foreground"
uniform float uStars;     // @control min=0 max=1 default=0 label="Stars"`,
    HASH,
    BAYER,
    NOISE1,
    `float mountain(float x) {
  float ridge = 1.0 - abs(2.0 * noise1(x * 0.03, 1.0) - 1.0);
  return ridge * 0.75 + noise1(x * 0.11, 2.0) * 0.25;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  float rows = max(floor(iResolution.y / uPixel), 1.0);
  float cols = max(floor(iResolution.x / uPixel), 1.0);
  float t = iTime * uSpeed;
  float y = cell.y;
  float sy = y / rows;

  // Sky in six bands, dithered where they meet.
  float band = clamp(floor(sy * 6.0 + (bayer4(cell) - 0.5) * 0.9), 0.0, 5.0) / 5.0;
  vec3 col = mix(uSkyBottom, uSkyTop, band);
  float star = hash12(cell);
  if (sy > 0.4 && star > 1.0 - 0.015 * uStars)
    col = mix(col, vec3(1.0), 0.5 + 0.5 * step(0.5, hash12(cell + floor(iTime * 2.0))));

  // Sun or moon: a pixel disc with a checkered halo.
  vec2 sun = floor(vec2(cols * 0.7, rows * 0.7));
  float r = max(3.0, floor(rows * 0.1));
  vec2 d = cell - sun;
  float dd = dot(d, d);
  if (dd <= (r + 2.0) * (r + 2.0) + r && mod(cell.x + cell.y, 2.0) < 1.0) col = mix(col, uSun, 0.45);
  if (dd <= r * r + r) col = uSun;

  // Clouds: flat-bottomed puffs drifting slowest.
  float cx = cell.x + floor(t * 2.0);
  float base = floor(rows * 0.76 + 3.0 * noise1(floor(cx / 40.0), 9.0));
  float puff = max(0.0, noise1(cx * 0.045, 4.0) - 0.42) * 2.4 * rows * 0.12 + max(0.0, noise1(cx * 0.16, 5.0) - 0.5) * rows * 0.05;
  if (y >= base && y < base + floor(puff)) col = y < base + 1.0 ? mix(uCloud, uSkyTop, 0.25) : uCloud;

  // Mountains, with snow on the high peaks and shaded far sides.
  float mx = cell.x + floor(t * 4.0);
  float mh = floor(rows * (0.3 + 0.32 * mountain(mx)));
  if (y <= mh) {
    // Faces sloping down to the right are in shade.
    float slope = mountain(mx + 2.0) - mountain(mx - 2.0);
    col = slope < 0.0 ? uFar * 0.82 : uFar;
    if (mh > rows * 0.52 && y > mh - 3.0 - mod(mx, 2.0)) col = mix(uFar, vec3(1.0), 0.75);
  }

  // Rolling hills, a lit rim along the top.
  float hx = cell.x + floor(t * 9.0);
  float hh = floor(rows * (0.24 + 0.06 * sin(hx * 0.045) + 0.04 * noise1(hx * 0.09, 6.0)));
  if (y <= hh) col = y > hh - 1.0 ? mix(uMid, vec3(1.0), 0.2) : uMid;

  // Foreground: a strip of ground with pine trees, fastest.
  float nx = cell.x + floor(t * 18.0);
  float nh = floor(rows * (0.1 + 0.02 * sin(nx * 0.08)));
  float slot = floor(nx / 14.0);
  float lx = abs(mod(nx, 14.0) - 7.0);
  float treeH = floor(rows * (0.08 + 0.08 * hash12(vec2(slot, 3.0))));
  bool tree = hash12(vec2(slot, 7.0)) > 0.35 && y > nh && y <= nh + treeH && lx <= floor((nh + treeH - y) / 2.5);
  if (y <= nh || tree) col = tree ? uNear * 0.8 : uNear;
  if (!tree && y <= nh && y > nh - 1.0) col = mix(uNear, uMid, 0.5);

  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    {
      name: "Dusk",
      values: {
        uSkyTop: [0.17, 0.11, 0.31],
        uSkyBottom: [0.95, 0.53, 0.35],
        uSun: [1, 0.36, 0.24],
        uCloud: [0.96, 0.69, 0.57],
        uFar: [0.42, 0.24, 0.43],
        uMid: [0.23, 0.15, 0.31],
        uNear: [0.1, 0.07, 0.19],
      },
    },
    {
      name: "Night",
      values: {
        uSkyTop: [0.02, 0.03, 0.09],
        uSkyBottom: [0.11, 0.17, 0.35],
        uSun: [0.95, 0.94, 0.85],
        uCloud: [0.22, 0.27, 0.48],
        uFar: [0.15, 0.19, 0.37],
        uMid: [0.1, 0.14, 0.28],
        uNear: [0.05, 0.07, 0.16],
        uStars: 1,
      },
    },
  ],
};

export const outrunRoad: ShaderEffect = {
  kind: "shader",
  id: "outrun-road",
  name: "Outrun road",
  description: "A pseudo-3D arcade racer's road curving toward a striped sunset sun, with rumble strips, stripe bands and roadside poles rushing past.",
  category: "retro",
  tags: ["pixel", "retro", "racing", "80s", "arcade", "road", "synthwave", "sunset"],
  source: glsl(
    `// Outrun road: a pseudo-3D road racing toward a striped sun, all on a pixel grid.
uniform float uPixel;      // @control min=1 max=12 default=3 step=1 label="Pixel size"
uniform float uSpeed;      // @control min=0 max=4 default=1 label="Speed"
uniform float uCurve;      // @control min=0 max=1 default=0.6 label="Curves"
uniform vec3 uSkyTop;      // @control color default=#1B0B42 label="Sky top"
uniform vec3 uSkyBottom;   // @control color default=#FF6A5C label="Sky bottom"
uniform vec3 uSunTop;      // @control color default=#FFE45E label="Sun top"
uniform vec3 uSunBottom;   // @control color default=#FF2E88 label="Sun bottom"
uniform vec3 uGrass;       // @control color default=#1F8F4E label="Verge"
uniform vec3 uRoad;        // @control color default=#56566A label="Road"
uniform vec3 uKerb;        // @control color default=#E8343F label="Rumble strip"`,
    HASH,
    BAYER,
    NOISE1,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec2 grid = max(floor(iResolution.xy / uPixel), vec2(1.0));
  float horizon = floor(grid.y * 0.46);
  float t = iTime * uSpeed;
  float curve = uCurve * sin(iTime * 0.32);
  float cx = floor(grid.x * 0.5);
  vec3 col;

  if (cell.y >= horizon) {
    // Sky in banded steps, dithered between them.
    float h = (cell.y - horizon) / max(grid.y - horizon, 1.0);
    float band = clamp(floor(h * 7.0 + (bayer4(cell) - 0.5) * 0.8), 0.0, 6.0) / 6.0;
    col = mix(uSkyBottom, uSkyTop, band);
    // The sun, sliding against the curve, with gaps widening toward its foot.
    float r = floor(grid.y * 0.2);
    vec2 sc = vec2(floor(cx - curve * grid.x * 0.25), horizon + floor(r * 0.55));
    vec2 d = cell - sc;
    if (dot(d, d) <= r * r + r) {
      float below = -d.y;
      bool gap = below > 0.0 && mod(below, 5.0) < floor(below / r * 4.0 + 0.5);
      if (!gap) col = mix(uSunBottom, uSunTop, clamp(floor((d.y / r * 0.5 + 0.5) * 4.0) / 3.0, 0.0, 1.0));
    }
    // A pixel skyline of hills on the horizon.
    float hills = floor(2.0 + 5.0 * noise1((cell.x + floor(curve * grid.x * 0.4)) * 0.07, 3.0));
    if (cell.y < horizon + hills) col = mix(uSkyTop, uGrass, 0.25);
  } else {
    float dy = horizon - cell.y;
    float scale = dy / horizon;
    float z = 1.0 / scale;
    float roadX = cx + curve * grid.x * 0.6 * (1.0 - scale) * (1.0 - scale);
    float halfW = grid.x * 0.42 * scale;
    float dx = abs(cell.x - roadX);
    float alt = mod(floor((z + t * 10.0) * 0.5), 2.0);
    col = uGrass * (alt > 0.5 ? 1.0 : 0.8);
    if (dx < halfW) {
      col = uRoad * (alt > 0.5 ? 1.0 : 0.9);
      // Lane lines on every other band.
      float lane = abs(dx - halfW / 3.0);
      if (alt > 0.5 && (lane < max(0.5, halfW * 0.025) || dx < max(0.5, halfW * 0.025))) col = vec3(0.95);
    } else if (dx < halfW * 1.12) {
      col = alt > 0.5 ? uKerb : vec3(0.95);
    }
    // Haze near the horizon.
    float haze = clamp(1.0 - scale * 6.0, 0.0, 1.0);
    if (bayer4(cell) < haze * 0.8) col = uSkyBottom * 0.8;
  }

  // Roadside poles, the nearest drawn last.
  for (int k = 7; k >= 0; k--) {
    float period = 8.0;
    float zk = float(k) * period + period - mod(t * 10.0, period);
    if (zk < 1.0) continue;
    float sk = 1.0 / zk;
    float yb = horizon - sk * horizon;
    float roadX = cx + curve * grid.x * 0.6 * (1.0 - sk) * (1.0 - sk);
    float off = grid.x * 0.42 * sk * 1.35;
    float w = max(1.0, floor(grid.x * 0.012 * sk + 0.5));
    float ph = floor(grid.y * 0.42 * sk) + 2.0;
    float py = cell.y - floor(yb);
    if (py >= 0.0 && py < ph) {
      for (int side = 0; side < 2; side++) {
        float px = floor(roadX + (side == 0 ? -off : off));
        if (cell.x >= px && cell.x < px + w) {
          col = py > ph - max(1.0, floor(w * 1.5)) ? uSunTop : (mod(floor(py / max(1.0, w * 2.0)), 2.0) < 1.0 ? vec3(0.95) : uKerb);
        }
      }
    }
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Coastline", values: { uSkyTop: [0.12, 0.35, 0.85], uSkyBottom: [0.65, 0.88, 1], uSunTop: [1, 1, 0.85], uSunBottom: [1, 0.85, 0.4], uGrass: [0.85, 0.78, 0.5] } },
    { name: "Midnight", values: { uSkyTop: [0.01, 0.0, 0.06], uSkyBottom: [0.3, 0.05, 0.45], uGrass: [0.05, 0.02, 0.15], uRoad: [0.12, 0.1, 0.2], uKerb: [0.0, 0.95, 1] } },
  ],
};

const WATER_RAMP = [0, 0.1, 0.22, 0.4, 0.7, 1, 0.75, 0.45, 0.25, 0.12, 0.05, 0, 0.08, 0.18, 0.1, 0];

export const paletteCycle: ShaderEffect = {
  kind: "shader",
  id: "palette-cycle",
  name: "Palette cycle",
  description: "Demoscene colour cycling: a still pixel-art waterfall (or plasma) brought to life purely by rotating its palette.",
  category: "retro",
  tags: ["pixel", "retro", "palette", "colour-cycling", "demoscene", "waterfall", "plasma", "loop"],
  loop: 2,
  source: glsl(
    `// Palette cycle: a static indexed picture animated only by rotating its palette.
uniform int uScene;        // @control min=0 max=1 default=0 label="Scene (0 waterfall, 1 plasma)"
uniform float uPixel;      // @control min=2 max=12 default=4 step=1 label="Pixel size"
uniform float uRate;       // @control min=0 max=32 default=8 step=1 label="Cycle speed (steps per second)"
uniform vec3 uDeep;        // @control color default=#163C8C label="Water"
uniform vec3 uFoam;        // @control color default=#E8F7FF label="Foam"
uniform vec3 uRock;        // @control color default=#5A4466 label="Rock"
uniform vec3 uSky;         // @control color default=#1A1238 label="Sky"`,
    HASH,
    BAYER,
    NOISE1,
    `const float WATER[16] = float[16](${WATER_RAMP.map((v) => v.toFixed(2)).join(", ")});

vec3 water(float i) {
  return mix(uDeep, uFoam, WATER[int(mod(i, 16.0))]);
}

vec3 rainbow(float i) {
  float t = mod(i, 16.0) / 16.0;
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec2 grid = max(floor(iResolution.xy / uPixel), vec2(1.0));
  float shift = floor(iTime * uRate);
  vec3 col;

  if (uScene == 1) {
    // A plasma whose 16 palette indices rotate.
    vec2 p = cell / grid.y * 8.0;
    float v = sin(p.x) + sin(p.y * 1.3) + sin((p.x + p.y) * 0.7) + sin(length(p - 4.0) * 1.5);
    float index = floor((v * 0.125 + 0.5) * 32.0);
    fragColor = vec4(rainbow(index - shift), 1.0);
    return;
  }

  vec2 uv = cell / grid;
  float mid = floor(grid.x * 0.5);
  float fallHalf = floor(grid.x * 0.1 + 2.0 * noise1(cell.y * 0.2, 2.0));
  float cliffTop = floor(grid.y * (0.74 + 0.08 * noise1(cell.x * 0.08, 1.0)));
  float poolTop = floor(grid.y * 0.26);

  // Night sky with fixed stars (the sky never cycles).
  col = mix(uSky, uSky * 1.8 + 0.04, floor((1.0 - uv.y) * 4.0) / 4.0);
  if (hash12(cell) > 0.985) col = vec3(0.85, 0.85, 1.0);

  if (cell.y < cliffTop && cell.y >= poolTop) {
    // Rock in three tones with strata.
    float tone = floor(clamp(noise1(cell.x * 0.3 + floor(cell.y / 3.0) * 7.0, 5.0) * 2.2 + (bayer4(cell) - 0.5) * 0.6, 0.0, 2.0));
    col = uRock * (0.65 + 0.25 * tone);
  }
  if (abs(cell.x - mid) <= fallHalf && cell.y >= poolTop && cell.y < cliffTop + 1.0) {
    // The fall: streaks whose indices rise with height, so cycling moves them down.
    float streak = floor(hash12(vec2(cell.x, 7.0)) * 6.0);
    col = water(floor(cell.y / 2.0) + streak + shift);
    if (abs(cell.x - mid) == fallHalf) col = mix(col, uDeep, 0.5);
  }
  if (cell.y < poolTop) {
    // The pool: ripple rings whose indices fall outward from the splash.
    vec2 d = (cell - vec2(mid, poolTop)) * vec2(1.0, 2.6);
    float ring = floor(length(d) / 2.0);
    col = mix(uDeep * 0.7, water(ring - shift), 0.75 - 0.4 * uv.y / 0.26);
    // Churning foam where the fall lands.
    if (abs(cell.x - mid) <= fallHalf + 3.0 && cell.y > poolTop - 4.0)
      col = water(floor(hash12(cell) * 16.0) + shift);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Plasma", values: { uScene: 1, uRate: 12 } },
    { name: "Lava", values: { uDeep: [0.45, 0.05, 0.02], uFoam: [1, 0.85, 0.3], uRock: [0.2, 0.17, 0.2], uSky: [0.12, 0.03, 0.05] } },
  ],
};

const RASTER_COLOURS = ["#E8343F", "#FF8A1F", "#FFE14D", "#3FD15C", "#2EE6E6", "#2E6BFF", "#9B4DFF", "#FF4DC4"];

export const rasterBars: ShaderEffect = {
  kind: "shader",
  id: "raster-bars",
  name: "Raster bars",
  description: "Demoscene copper bars bouncing on sine paths behind a sine-scrolling greeting, all in chunky pixels.",
  category: "retro",
  video: "none",
  tags: ["pixel", "retro", "demoscene", "amiga", "c64", "scroller", "text", "copper"],
  source: glsl(
    `// Raster bars: copper bars on sine paths behind a sine scroller.
uniform sampler2D uText;    // @control filter=linear wrap=clamp default=${textImage("GREETINGS FROM FLAIR", { width: 2048, height: 256 })} label="Scroller text"
uniform float uPixel;       // @control min=1 max=12 default=4 step=1 label="Pixel size"
uniform int uBars;          // @control min=1 max=8 default=7 label="Bars"
uniform float uSpeed;       // @control min=0 max=3 default=1 label="Speed"
uniform float uWave;        // @control min=0 max=1 default=0.5 label="Text wave"
uniform vec3 uBackground;   // @control color default=#0B0B24 label="Background"
uniform vec3 uTextTop;      // @control color default=#FFFFFF label="Text top"
uniform vec3 uTextBottom;   // @control color default=#3AA0FF label="Text bottom"`,
    paletteArray("BARS", RASTER_COLOURS),
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec2 grid = max(floor(iResolution.xy / uPixel), vec2(1.0));
  float t = iTime * uSpeed;
  vec3 col = uBackground;

  // Copper bars: each a stepped highlight, later bars over earlier ones.
  float thick = max(3.0, floor(grid.y * 0.06));
  for (int i = 0; i < 8; i++) {
    if (i >= uBars) break;
    float fi = float(i);
    float centre = floor(grid.y * (0.5 + 0.36 * sin(t * 1.7 + fi * 0.55)));
    float dy = abs(cell.y - centre);
    if (dy <= thick) {
      float level = ceil((1.0 - dy / (thick + 1.0)) * 4.0) / 4.0;
      col = BARS[i] * (0.25 + 0.75 * level) + vec3(pow(level, 4.0) * 0.35);
    }
  }

  // Scroller: text marching left, each column bobbing on a sine.
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = floor(grid.y * 0.3);
  float w = h * aspect;
  // Starting with the text already on screen, near the left.
  float scroll = mod(t * grid.y * 0.35 + grid.x * 0.9, w + grid.x);
  float tx = cell.x + scroll - grid.x;
  float bob = floor(sin(tx * 0.06 + t * 3.0) * grid.y * 0.14 * uWave);
  float ty = cell.y - (floor(grid.y * 0.5 - h * 0.5) + bob);
  vec2 uv = (vec2(tx, ty) + 0.5) / vec2(w, h);
  vec2 shadowUv = uv + vec2(-1.0 / w, 1.0 / h);
  float ink = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? step(0.5, texture(uText, uv).a) : 0.0;
  float shadow = (shadowUv.x > 0.0 && shadowUv.x < 1.0 && shadowUv.y > 0.0 && shadowUv.y < 1.0) ? step(0.5, texture(uText, shadowUv).a) : 0.0;
  if (shadow > 0.5) col = vec3(0.0);
  if (ink > 0.5) {
    // A stepped gradient down the letters.
    float g = clamp(floor((uv.y - 0.3) / 0.4 * 4.0) / 3.0, 0.0, 1.0);
    col = mix(uTextBottom, uTextTop, g);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Amiga", values: { uBackground: [0, 0, 0], uTextTop: [1, 0.9, 0.3], uTextBottom: [1, 0.3, 0.1] } },
    { name: "Gentle", values: { uSpeed: 0.5, uWave: 0.25, uBars: 4 } },
  ],
};

/** The loading screen's lines, 20 columns each (a blank line between). */
const LOADING_LINES = ["PRESS PLAY ON TAPE", "", "LOADING", "", "READY.", ""];
const LOADING_COLS = 20;
const loadingChars = [...new Set([" ", ...LOADING_LINES.join("")])];
const loadingText = LOADING_LINES.flatMap((line) => [...line.padEnd(LOADING_COLS)].map((c) => loadingChars.indexOf(c)));

export const loadingStripes: ShaderEffect = {
  kind: "shader",
  id: "loading-stripes",
  name: "Tape loading",
  description: "An 8-bit computer loading from tape: chaotic colour stripes racing through the border around a blue screen with a blinking cursor under READY.",
  category: "retro",
  tags: ["pixel", "retro", "c64", "loading", "loader", "8-bit", "computer", "text"],
  source: glsl(
    `// Tape loading: raster stripes in the border, a bitmap-font screen and a blinking cursor.
uniform vec3 uScreen;     // @control color default=#352879 label="Screen"
uniform vec3 uInk;        // @control color default=#6C5EB5 label="Text"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Stripe speed"
uniform float uStripe;    // @control min=1 max=12 default=3 step=1 label="Stripe thickness"`,
    HASH,
    paletteArray("C64", C64),
    `// 5 × 7 glyphs: bit (x + 5y) of .x holds rows 0–3 (top first), of .y rows 4–6.
const ivec2 GLYPHS[${loadingChars.length}] = ivec2[${loadingChars.length}](
  ${loadingChars.map((c) => packGlyph(PIXEL_FONT[c]!)).join(",\n  ")}
);
const int TEXT[${loadingText.length}] = int[${loadingText.length}](${loadingText.join(", ")});

float glyphBit(ivec2 g, int x, int y) {
  if (x < 0 || x > 4 || y < 0 || y > 6) return 0.0;
  int bits = y < 4 ? (g.x >> (x + 5 * y)) : (g.y >> (x + 5 * (y - 4)));
  return float(bits & 1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // The screen is 128 × 80 virtual pixels: 20 columns of 6 and 8 rows of 8, a margin round them.
  vec2 screen = vec2(128.0, 80.0);
  float px = max(1.0, floor(min(iResolution.x * 0.78 / screen.x, iResolution.y * 0.72 / screen.y)));
  vec2 origin = floor((iResolution.xy - screen * px) * 0.5);
  vec2 q = floor((fragCoord - origin) / px);

  if (q.x < 0.0 || q.y < 0.0 || q.x >= screen.x || q.y >= screen.y) {
    // Border: stripes of two overlapping widths, reshuffled every tick.
    float row = floor(fragCoord.y / px);
    float tick = floor(iTime * uSpeed * 20.0);
    float offset = floor(hash12(vec2(tick, 3.0)) * 400.0);
    float a = floor((row + offset) / uStripe);
    float b = floor((row + offset * 1.7) / (uStripe * 2.3));
    int c = int(hash12(vec2(a + b * 31.0, tick)) * 16.0);
    fragColor = vec4(C64[c], 1.0);
    return;
  }

  vec3 col = uScreen;
  float x = q.x - 4.0;
  float y = screen.y - 5.0 - q.y;
  int tc = int(floor(x / 6.0));
  int tr = int(floor(y / 8.0));
  int gx = int(mod(x, 6.0));
  int gy = int(mod(y, 8.0));
  if (x >= 0.0 && y >= 0.0 && tc < ${LOADING_COLS} && tr < ${LOADING_LINES.length}) {
    float ink = glyphBit(GLYPHS[TEXT[tr * ${LOADING_COLS} + tc]], gx, gy);
    // The cursor: a block under READY., on and off.
    if (tr == ${LOADING_LINES.length - 1} && tc == 0 && gx < 6 && mod(floor(iTime * 2.5), 2.0) < 1.0) ink = 1.0;
    col = mix(col, uInk, ink);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Green screen", values: { uScreen: [0.02, 0.1, 0.03], uInk: [0.3, 1, 0.4] } },
    { name: "Turbo", values: { uSpeed: 2.5, uStripe: 1 } },
  ],
};

export const pixelWater: ShaderEffect = {
  kind: "shader",
  id: "pixel-water",
  name: "Pixel water",
  description: "Tiling pixel-art water in three blues with wavy highlight lines and twinkling sparkles; it loops and tiles seamlessly.",
  category: "retro",
  tags: ["pixel", "retro", "water", "tiles", "game", "background", "loop"],
  loop: 4,
  source: glsl(
    `// Pixel water: a seamless tile of banded blues, crest highlights and sparkles.
uniform float uPixel;     // @control min=1 max=12 default=4 step=1 label="Pixel size"
uniform float uTile;      // @control min=8 max=64 default=32 step=1 label="Tile size (pixels)"
uniform vec3 uDeep;       // @control color default=#1B3B8F label="Deep"
uniform vec3 uMid;        // @control color default=#2F6FD6 label="Mid"
uniform vec3 uLight;      // @control color default=#6FB8FF label="Light"
uniform vec3 uFoam;       // @control color default=#FFFFFF label="Highlights"
uniform float uSparkle;   // @control min=0 max=1 default=0.6 label="Sparkles"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  float tile = floor(uTile);
  vec2 p = mod(cell, tile);
  float k = 6.28318 / tile;
  float w = iTime * 6.28318 / 4.0;
  // Whole waves per tile and per loop, so it tiles and loops seamlessly.
  float a = sin(k * p.x + 1.4 * sin(k * 2.0 * p.y + w) + w);
  float b = sin(k * 2.0 * p.y - w + 0.9 * sin(k * p.x - w));
  float v = 0.5 + 0.28 * a + 0.22 * b;
  vec3 col = v < 0.4 ? uDeep : (v < 0.72 ? uMid : uLight);
  if (v > 0.86 && mod(p.y, 2.0) < 1.0) col = uFoam;

  // Sparkles: one per 8 × 8 block of the tile, a plus that blinks once a loop.
  vec2 block = floor(p / 8.0);
  vec2 at = floor(block * 8.0 + 1.0 + hash22(block + tile) * 6.0);
  float phase = fract(iTime / 4.0 + hash12(block * 1.7 + tile));
  float life = phase < 0.12 ? phase / 0.12 : 0.0;
  if (hash12(block + 9.1) < uSparkle && life > 0.0) {
    vec2 d = abs(p - at);
    float arm = life > 0.3 && life < 0.75 ? 1.0 : 0.0;
    if ((d.x + d.y < 0.5) || (arm > 0.5 && min(d.x, d.y) < 0.5 && d.x + d.y < 1.5)) col = uFoam;
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Lagoon", values: { uDeep: [0.0, 0.42, 0.55], uMid: [0.1, 0.7, 0.75], uLight: [0.55, 0.95, 0.9] } },
    { name: "Murky", values: { uDeep: [0.1, 0.18, 0.15], uMid: [0.18, 0.3, 0.22], uLight: [0.35, 0.48, 0.32], uFoam: [0.7, 0.8, 0.6], uSparkle: 0.2 } },
  ],
};

export const pixelDissolve: ShaderEffect = {
  kind: "shader",
  id: "transition-pixel-dissolve",
  name: "Pixel dissolve",
  description: "The picture pixelates up to big blocks, the blocks swap to the next image in a random order, then it resolves into the new picture. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "pixel", "image", "retro", "8-bit", "slideshow"],
  loop: 4,
  source: glsl(
    `// Pixel dissolve: pixelate up, swap blocks in a random order, resolve down. Progress runs 0 → 1 → 0 when animated.
uniform sampler2D uFrom;   // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uMaxBlock;   // @control min=4 max=96 default=40 step=1 label="Largest block (px)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float p = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  // 0–0.35 blocks grow; 0.35–0.65 blocks swap; 0.65–1 blocks shrink.
  float grow = clamp(p / 0.35, 0.0, 1.0);
  float shrink = clamp((1.0 - p) / 0.35, 0.0, 1.0);
  float k = min(grow, shrink);
  float block = max(1.0, floor(mix(1.0, uMaxBlock, k * k)));
  vec2 cell = floor(fragCoord / block);
  vec2 uv = (cell + 0.5) * block / iResolution.xy;
  // The order blocks swap in, picked on the largest grid so a block swaps whole.
  vec2 big = floor(fragCoord / uMaxBlock);
  float swap = clamp((p - 0.35) / 0.3, 0.0, 1.0);
  bool showTo = p >= 0.65 || (p > 0.35 && hash12(big + 0.5) < swap);
  fragColor = showTo ? pictureRGBA(uTo, uv) : pictureRGBA(uFrom, uv);
}`,
  ),
};

export const imagePixelSort: ShaderEffect = {
  kind: "shader",
  id: "image-pixel-sort",
  name: "Pixel sort",
  description: "Glitch-art pixel sorting: runs of pixels between two brightness thresholds are sorted dark to bright, smearing the picture into streaks that shift as the threshold breathes.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "glitch", "image", "pixel-sort", "databending", "streak"],
  loop: 8,
  source: glsl(
    `// Pixel sort: each run of pixels between the thresholds, along the sort direction, sorted by brightness.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uDirection;    // @control min=0 max=3 default=0 label="Brightest toward (0 down, 1 up, 2 right, 3 left)"
uniform float uLow;        // @control min=0 max=1 default=0.3 label="Low threshold"
uniform float uHigh;       // @control min=0 max=1 default=0.95 label="High threshold"
uniform float uLength;     // @control min=4 max=128 default=64 step=1 label="Longest run (pixels)"
uniform float uPixel;      // @control min=1 max=8 default=2 step=1 label="Pixel size"
uniform bool uReverse;     // @control default=false label="Darkest toward instead"
uniform float uSweep;      // @control min=0 max=0.3 default=0.12 label="Threshold sweep"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `const int MAX_RUN = 128;
const int SAMPLES = 8;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec2 cellUV(vec2 cell) {
  return (cell + 0.5) * uPixel / iResolution.xy;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec2 grid = ceil(iResolution.xy / uPixel);
  vec2 dir = uDirection == 0 ? vec2(0.0, -1.0) : (uDirection == 1 ? vec2(0.0, 1.0) : (uDirection == 2 ? vec2(1.0, 0.0) : vec2(-1.0, 0.0)));
  // The low threshold breathes, so runs grow, split and merge.
  float lo = uLow + uSweep * sin(iTime * 6.28318 / 8.0);
  vec4 here = pictureRGBA(uImage, cellUV(cell));
  float l = luma(here.rgb);
  if (l < lo || l > uHigh) {
    fragColor = here;
    return;
  }

  // Runs are cut into segments at most uLength long, staggered per line so the cuts don't line up.
  float cap = floor(uLength);
  float line = dot(cell, abs(dir.yx));
  float t = dot(cell, dir);
  float phase = floor(hash12(vec2(line, 3.7)) * cap);
  float segStart = floor((t + phase) / cap) * cap - phase;
  float segEnd = segStart + cap - 1.0;
  float back = 0.0;
  for (int i = 1; i < MAX_RUN; i++) {
    float s = float(i);
    vec2 c = cell - dir * s;
    if (t - s < segStart || c.x < 0.0 || c.y < 0.0 || c.x >= grid.x || c.y >= grid.y) break;
    float m = luma(picture(uImage, cellUV(c)));
    if (m < lo || m > uHigh) break;
    back = s;
  }
  float fwd = 0.0;
  for (int i = 1; i < MAX_RUN; i++) {
    float s = float(i);
    vec2 c = cell + dir * s;
    if (t + s > segEnd || c.x < 0.0 || c.y < 0.0 || c.x >= grid.x || c.y >= grid.y) break;
    float m = luma(picture(uImage, cellUV(c)));
    if (m < lo || m > uHigh) break;
    fwd = s;
  }

  // Sorting the whole run is too dear per pixel: sort a few evenly spaced samples of it
  // and read this pixel's place in the run off them.
  float len = back + fwd;
  vec3 col[SAMPLES];
  float key[SAMPLES];
  for (int k = 0; k < SAMPLES; k++) {
    float s = floor(-back + len * float(k) / float(SAMPLES - 1) + 0.5);
    col[k] = picture(uImage, cellUV(cell + dir * s));
    key[k] = uReverse ? -luma(col[k]) : luma(col[k]);
  }
  for (int i = 1; i < SAMPLES; i++) {
    for (int j = i; j > 0; j--) {
      if (key[j - 1] <= key[j]) break;
      float kt = key[j];
      key[j] = key[j - 1];
      key[j - 1] = kt;
      vec3 ct = col[j];
      col[j] = col[j - 1];
      col[j - 1] = ct;
    }
  }
  float r = len > 0.0 ? back / len * float(SAMPLES - 1) : 0.0;
  int a = int(floor(r));
  int b = min(a + 1, SAMPLES - 1);
  fragColor = vec4(mix(col[a], col[b], fract(r)), here.a);
}`,
  ),
  presets: [
    { name: "Waterfall", values: { uDirection: 0, uLow: 0.3, uHigh: 0.95 } },
    { name: "Sideways", values: { uDirection: 2, uLow: 0.2, uHigh: 0.8, uLength: 128 } },
    { name: "Highlights only", values: { uLow: 0.6, uHigh: 1, uSweep: 0.08 } },
  ],
};

export const imageLedWall: ShaderEffect = {
  kind: "shader",
  id: "image-led-wall",
  name: "LED wall",
  description: "An image on a stadium LED board: round diodes on a black grid with stepped brightness, soft bloom, sun louvres, the odd dead diode and a rolling scan band.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "led", "image", "screen", "billboard", "stadium", "display"],
  loop: 5,
  source: glsl(
    `// LED wall: each grid cell one round diode lit with the picture's colour there, glowing into its neighbours.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uPitch;      // @control min=4 max=40 default=12 step=1 label="LED pitch (px)"
uniform float uSize;       // @control min=0.2 max=1 default=0.7 label="Diode size"
uniform float uLevels;     // @control min=2 max=32 default=12 step=1 label="Brightness levels"
uniform float uBloom;      // @control min=0 max=1.5 default=0.6 label="Bloom"
uniform float uBrightness; // @control min=0.5 max=2 default=1.2 label="Brightness"
uniform float uDead;       // @control min=0 max=0.1 default=0.01 label="Dead diodes"
uniform float uFlicker;    // @control min=0 max=1 default=0.3 label="Scan band"
uniform bool uLouvres;     // @control default=true label="Sun louvres"
uniform vec3 uBoard;       // @control color default=#0A0A0C label="Board"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// The light of the diode in grid cell \`cell\`.
vec3 diode(vec2 cell) {
  vec3 c = picture(uImage, (cell + 0.5) * uPitch / iResolution.xy);
  float steps = uLevels - 1.0;
  c = floor(c * steps + 0.5) / steps;
  return hash12(cell + 0.31) < uDead ? vec3(0.0) : c * uBrightness;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPitch);
  vec2 f = fragCoord / uPitch - cell - 0.5;
  float r = uSize * 0.5;
  float aa = 1.0 / uPitch;

  // Bloom from this diode and its eight neighbours.
  vec3 glow = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 d = f - o;
      glow += diode(cell + o) * exp(-dot(d, d) / (r * r * 2.5));
    }
  }
  vec3 own = diode(cell);
  float alpha = pictureRGBA(uImage, (cell + 0.5) * uPitch / iResolution.xy).a;
  float d = length(f);
  float disc = smoothstep(r + aa, r - aa, d);
  // A lens, brightest in the middle; an unlit one still shows as a dim dot.
  vec3 lens = vec3(0.05) + own * (1.15 - 0.3 * d / r);
  vec3 col = mix(uBoard, lens, disc) + glow * uBloom * 0.25;
  // A ledge over each row shading the top of the diode beneath it.
  if (uLouvres) col = mix(col, uBoard * 0.5, smoothstep(0.36, 0.42, f.y) * 0.85);
  // The refresh scan a camera catches rolling down the board.
  float band = abs(fract(fragCoord.y / iResolution.y + iTime * 0.4) - 0.5);
  col *= 1.0 - uFlicker * 0.3 * smoothstep(0.12, 0.0, band);
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "Fine pitch", values: { uPitch: 6, uSize: 0.8, uLevels: 24, uBloom: 0.4 } },
    { name: "Old scoreboard", values: { uPitch: 18, uSize: 0.6, uLevels: 4, uDead: 0.04, uBloom: 0.9 } },
  ],
};

export const imageSubpixel: ShaderEffect = {
  kind: "shader",
  id: "image-subpixel",
  name: "Subpixel zoom",
  description: "A macro zoom in and out of a screen: the picture breaks into its pixels and then into glowing red, green and blue subpixels, as LCD stripes, PenTile diamonds or CRT phosphor triads.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "subpixel", "image", "lcd", "screen", "macro", "zoom", "rgb"],
  loop: 8,
  source: glsl(
    `// Subpixel zoom: the picture as a screen's pixels, zoomed until the red, green and blue subpixels show.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uLayout;       // @control min=0 max=2 default=0 label="Layout (0 LCD stripes, 1 PenTile, 2 CRT triads)"
uniform float uCell;       // @control min=2 max=12 default=4 step=1 label="Screen pixel (px)"
uniform bool uAnimate;     // @control default=true label="Animate zoom"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Zoom (when still)"
uniform float uMaxZoom;    // @control min=2 max=60 default=24 label="Deepest zoom"
uniform float uCenterX;    // @control min=0 max=1 default=0.5 label="Zoom centre x"
uniform float uCenterY;    // @control min=0 max=1 default=0.6 label="Zoom centre y"
uniform float uGap;        // @control min=0 max=0.6 default=0.25 label="Gap between subpixels"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// Coverage of a box of half-size h at p, edges softened over aa.
float box(vec2 p, vec2 h, float aa) {
  vec2 q = abs(p) - h;
  return clamp(0.5 - max(q.x, q.y) / aa, 0.0, 1.0);
}

float disc(vec2 p, float r, float aa) {
  return clamp(0.5 - (length(p) - r) / aa, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Starts deep in the subpixels, pulls back to the whole picture by mid-loop, then dives again.
  float k = uAnimate ? smoothstep(0.15, 0.85, 0.5 + 0.5 * cos(iTime * 6.28318 / 8.0)) : uProgress;
  float z = exp(log(uMaxZoom) * k);
  vec2 centre = vec2(uCenterX, uCenterY) * iResolution.xy;
  vec2 p = (fragCoord - centre) / z + centre;
  vec2 cell = floor(p / uCell);
  vec2 f = p / uCell - cell;
  vec4 pic = pictureRGBA(uImage, (cell + 0.5) * uCell / iResolution.xy);
  vec3 c = pic.rgb;
  // One device pixel in cell units, for soft edges.
  float aa = 1.0 / (z * uCell);
  float shrink = 1.0 - uGap;

  vec3 sub = vec3(0.0);
  if (uLayout == 0) {
    // Three vertical stripes per pixel.
    float i = min(floor(f.x * 3.0), 2.0);
    vec3 tint = i < 0.5 ? vec3(1.0, 0.0, 0.0) : (i < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    vec2 q = vec2((fract(f.x * 3.0) - 0.5) / 3.0, f.y - 0.5);
    float m = box(q, vec2(shrink / 6.0, shrink * 0.5), aa);
    sub = tint * (0.04 + dot(c, tint) * 2.2) * m;
  } else if (uLayout == 1) {
    // PenTile: a red or blue diamond, alternating, beside a small green dot.
    vec2 q = f - vec2(0.27, 0.5);
    bool red = mod(cell.x + cell.y, 2.0) < 1.0;
    vec3 tint = red ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
    float diamond = clamp(0.5 - ((abs(q.x) + abs(q.y)) - 0.24 * shrink) / aa, 0.0, 1.0);
    float green = disc(f - vec2(0.76, 0.5), 0.15 * shrink, aa);
    sub = tint * (0.04 + dot(c, tint) * 2.4) * diamond + vec3(0.0, 0.04 + c.g * 2.0, 0.0) * green;
  } else {
    // CRT: three phosphor dots in a triangle, every other row offset by half a pixel.
    vec2 g = vec2(p.x / uCell + 0.5 * mod(cell.y, 2.0), p.y / uCell);
    vec2 tc = floor(g);
    vec2 tf = g - tc;
    vec3 tcol = picture(uImage, (tc + 0.5) * uCell / iResolution.xy);
    float r = 0.21 * shrink;
    sub = vec3(1.0, 0.0, 0.0) * (0.04 + tcol.r * 2.4) * disc(tf - vec2(0.25, 0.3), r, aa)
        + vec3(0.0, 1.0, 0.0) * (0.04 + tcol.g * 2.4) * disc(tf - vec2(0.75, 0.3), r, aa)
        + vec3(0.0, 0.0, 1.0) * (0.04 + tcol.b * 2.4) * disc(tf - vec2(0.5, 0.75), r, aa);
  }
  sub = mix(vec3(0.015), min(sub, vec3(1.0)), clamp(length(sub) * 8.0, 0.0, 1.0));
  // Until the subpixels are a few device pixels wide they blur into the pixel's own colour.
  float resolve = smoothstep(1.5, 5.0, z * uCell / 3.0);
  fragColor = vec4(mix(c, sub, resolve), pic.a);
}`,
  ),
  presets: [
    { name: "LCD", values: { uLayout: 0 } },
    { name: "Phone OLED", values: { uLayout: 1, uGap: 0.15 } },
    { name: "CRT", values: { uLayout: 2, uCell: 6, uGap: 0.1 } },
  ],
};

export const imageBricks: ShaderEffect = {
  kind: "shader",
  id: "image-bricks",
  name: "Brick mosaic",
  description: "An image rebuilt from toy bricks with studs, ironed fuse beads or cross-stitch on cloth, in a few flat colours, built up row by row from the bottom.",
  category: "retro",
  video: "filter",
  tags: ["pixel", "image", "mosaic", "bricks", "beads", "cross-stitch", "craft", "toy"],
  loop: 6,
  source: glsl(
    `// Brick mosaic: one brick, bead or stitch per cell, in the picture's colour there, flattened to a few levels.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uStyle;        // @control min=0 max=2 default=0 label="Style (0 bricks, 1 beads, 2 cross-stitch)"
uniform float uCell;       // @control min=6 max=48 default=18 step=1 label="Cell size (px)"
uniform float uLevels;     // @control min=2 max=8 default=4 step=1 label="Colour levels"
uniform bool uBuild;       // @control default=true label="Build up"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Built (when still)"
uniform vec3 uBase;        // @control color default=#2F8F3F label="Baseplate / board / cloth"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// A brick seen from above: bevelled edges and a stud with a lit rim. q is -0.5–0.5 in the cell.
vec3 brick(vec3 c, vec2 q, float aa) {
  float edge = 0.5 - max(abs(q.x), abs(q.y));
  vec3 col = c * (1.0 + 0.22 * sign(q.y - q.x) * (1.0 - smoothstep(0.0, 0.07, edge)));
  col *= mix(0.55, 1.0, smoothstep(0.0, aa * 1.5, edge));
  float r = 0.3;
  col *= mix(0.72, 1.0, smoothstep(r - aa, r + aa * 2.0, length(q - vec2(0.05, -0.05))));
  float d = length(q);
  float lit = dot(q / max(d, 1e-4), vec2(-0.7071, 0.7071));
  vec3 top = c * (1.06 + smoothstep(r - 0.08, r, d) * lit * 0.35);
  return mix(col, top, smoothstep(r + aa, r - aa, d));
}

// A fuse bead from above: a shaded ring round its hole, on a pegboard.
vec3 bead(vec3 c, vec2 q, float aa, bool placed) {
  float d = length(q);
  vec3 col = uBase * mix(0.8, 1.0, smoothstep(0.0, aa * 2.0, abs(d - 0.36) - 0.12));
  // The board's peg, under the bead when one is placed.
  col = mix(col, uBase * 0.82, smoothstep(0.12 + aa, 0.12 - aa, d));
  if (!placed) return col;
  float ring = smoothstep(aa, -aa, abs(d - 0.31) - 0.14);
  float lit = dot(q / max(d, 1e-4), vec2(-0.7071, 0.7071));
  vec3 b = c * (0.9 + 0.25 * lit * smoothstep(0.17, 0.45, d)) + 0.25 * smoothstep(0.06, 0.0, length(q - vec2(-0.2, 0.2)));
  return mix(col, b, ring);
}

// Aida cloth with its holes at the cell corners, and a cross stitch over it when placed.
vec3 stitch(vec3 c, vec2 q, float aa, bool placed) {
  vec2 corner = 0.5 - abs(q);
  vec3 col = uBase * (0.97 - 0.25 * smoothstep(0.1, 0.0, length(corner)));
  col *= 0.97 + 0.03 * sin((q.x + q.y) * 60.0);
  if (!placed || max(abs(q.x), abs(q.y)) > 0.44) return col;
  float w = 0.13;
  float under = abs(q.x + q.y) * 0.7071;
  float over = abs(q.x - q.y) * 0.7071;
  // Twisted floss: bright ridges along each thread, darker at its edges.
  if (under < w) col = c * (0.78 + 0.12 * sin((q.x - q.y) * 50.0)) * (1.0 - 0.35 * pow(under / w, 2.0));
  if (over < w) col = c * (0.9 + 0.12 * sin((q.x + q.y) * 50.0)) * (1.0 - 0.35 * pow(over / w, 2.0));
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uCell);
  vec2 q = fragCoord / uCell - cell - 0.5;
  float aa = 1.0 / uCell;
  vec4 pic = pictureRGBA(uImage, (cell + 0.5) * uCell / iResolution.xy);
  float steps = uLevels - 1.0;
  vec3 c = floor(pic.rgb * steps + 0.5) / steps;

  // Built row by row from the bottom over 5 s, held a second, then cleared.
  float rows = ceil(iResolution.y / uCell);
  float p = uBuild ? clamp(fract(iTime / 6.0) * 1.2, 0.0, 1.0) : uProgress;
  float order = (cell.y + hash12(cell) * 3.0) / (rows + 3.0);
  bool placed = order < p || p >= 1.0;

  vec3 col;
  if (uStyle == 0) col = placed ? brick(c, q, aa) : brick(uBase, q, aa);
  else if (uStyle == 1) col = bead(c, q, aa, placed);
  else col = stitch(c, q, aa, placed);
  // Whole cells, so alpha is cut at a half rather than blended.
  fragColor = vec4(col, step(0.5, pic.a));
}`,
  ),
  presets: [
    { name: "Bricks", values: { uStyle: 0, uCell: 18, uBase: [0.18, 0.56, 0.25] } },
    { name: "Beads", values: { uStyle: 1, uCell: 14, uLevels: 5, uBase: [0.85, 0.85, 0.87] } },
    { name: "Cross-stitch", values: { uStyle: 2, uCell: 12, uLevels: 4, uBase: [0.95, 0.92, 0.86] } },
  ],
};

export const pixelSprites: ShaderEffect = {
  kind: "shader",
  id: "pixel-sprites",
  name: "Pixel sprites",
  description: "A field of little procedurally generated pixel creatures, each mirror-symmetric with an outline and blinking eyes, bobbing in place and swapping for new ones now and then.",
  category: "retro",
  tags: ["pixel", "retro", "sprite", "creature", "procedural", "8-bit", "pattern", "background"],
  source: glsl(
    `// Pixel sprites: a grid of slots, each a creature hashed from its slot and generation, mirrored left to right.
uniform float uPixel;      // @control min=2 max=12 default=5 step=1 label="Pixel size"
uniform float uDensity;    // @control min=0.1 max=1 default=0.75 label="Density"
uniform int uPalette;      // @control min=0 max=2 default=0 label="Palette (0 PICO-8, 1 NES, 2 C64)"
uniform float uChange;     // @control min=0 max=2 default=0.25 label="New sprites per second (per slot)"
uniform bool uBob;         // @control default=true label="Bob"
uniform vec3 uBackground;  // @control color default=#1D2B53 label="Background"
uniform vec3 uOutline;     // @control color default=#000000 label="Outline"`,
    HASH,
    paletteArray("PICO8", PICO8),
    paletteArray("NES", NES),
    paletteArray("C64", C64),
    `// Colour i (1–15: index 0 is black in every palette) of the chosen palette.
vec3 pal(int i) {
  return uPalette == 1 ? NES[i] : (uPalette == 2 ? C64[i] : PICO8[i]);
}

// The sprite at pixel p (0–6 each way) for seed s: 0 empty, 1 body, 2 accent, 3 eye.
int sprite(vec2 p, vec2 s) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > 6.0 || p.y > 6.0) return 0;
  float x = min(p.x, 6.0 - p.x);
  // Eyes on one of the upper rows, never on the centre column.
  float eyeX = 1.0 + floor(hash12(s + 4.2) * 2.0);
  float eyeY = 3.0 + floor(hash12(s + 5.3) * 2.0);
  if (x == eyeX && p.y == eyeY) return 3;
  float h = hash12(s + vec2(x, p.y) * 3.17);
  float keep = x == 3.0 ? 0.62 : 0.5;
  if (h > keep) return 0;
  return h < 0.1 ? 2 : 1;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  vec2 slot = floor(cell / 11.0);
  vec2 p = cell - slot * 11.0 - 2.0;
  float gen = floor(iTime * uChange + hash12(slot + 0.7) * 8.0);
  vec2 s = slot * 1.7 + gen * 31.3;
  vec3 col = uBackground;
  if (hash12(s + 9.1) > uDensity) {
    fragColor = vec4(col, 1.0);
    return;
  }
  // Each sprite hops up a pixel on its own beat.
  if (uBob) p.y -= step(0.5, fract(iTime * 1.2 + hash12(slot + 2.9)));
  int v = sprite(p, s);
  if (v == 0) {
    bool edge = sprite(p + vec2(1.0, 0.0), s) > 0 || sprite(p - vec2(1.0, 0.0), s) > 0 || sprite(p + vec2(0.0, 1.0), s) > 0 || sprite(p - vec2(0.0, 1.0), s) > 0;
    fragColor = vec4(edge ? uOutline : col, 1.0);
    return;
  }
  vec3 body = pal(1 + int(hash12(s + 1.3) * 15.0));
  vec3 accent = pal(1 + int(hash12(s + 2.6) * 15.0));
  // Blinks now and then: the eye closes to the body colour.
  bool blink = fract(iTime * 0.4 + hash12(s + 6.1)) < 0.06;
  if (v == 3) col = blink ? body : vec3(1.0);
  else col = v == 2 ? accent : body;
  // Lower rows in shade.
  if (v != 3 && p.y < 2.0) col *= 0.75;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Arcade", values: { uPalette: 1, uBackground: [0, 0, 0], uOutline: [0.2, 0.2, 0.2] } },
    { name: "Crowd", values: { uPixel: 3, uDensity: 1, uChange: 0.1 } },
    { name: "Commodore", values: { uPalette: 2, uBackground: [0.27, 0.25, 0.7], uOutline: [0.12, 0.1, 0.4] } },
  ],
};

export const pixelCity: ShaderEffect = {
  kind: "shader",
  id: "pixel-city",
  name: "Pixel city",
  description: "A night-time pixel skyline in parallax: three rows of towers with windows flicking on and off, blinking aerials, stars, a crescent moon and car lights along the street.",
  category: "retro",
  tags: ["pixel", "retro", "city", "skyline", "night", "parallax", "background", "16-bit"],
  source: glsl(
    `// Pixel city: layers of hashed towers scrolling whole pixels at different speeds, under a dithered night sky.
uniform float uPixel;     // @control min=2 max=12 default=4 step=1 label="Pixel size"
uniform float uSpeed;     // @control min=0 max=4 default=1 label="Scroll speed"
uniform float uLit;       // @control min=0 max=1 default=0.45 label="Lit windows"
uniform float uStars;     // @control min=0 max=1 default=0.6 label="Stars"
uniform bool uTraffic;    // @control default=true label="Traffic"
uniform vec3 uSkyTop;     // @control color default=#0B0A24 label="Sky top"
uniform vec3 uSkyBottom;  // @control color default=#4A2466 label="Sky bottom"
uniform vec3 uFar;        // @control color default=#2A1E4E label="Far towers"
uniform vec3 uMid;        // @control color default=#1A1434 label="Middle towers"
uniform vec3 uNear;       // @control color default=#0D0A1C label="Near towers"
uniform vec3 uWindow;     // @control color default=#FFD27A label="Windows"`,
    HASH,
    BAYER,
    `// A tower layer: whether cell (x, y) is in a tower, and its slot, left edge, width and height.
// Towers stand in slots w wide, each a few pixels narrower than its slot so gaps show.
bool tower(float x, float y, float w, float layer, float lo, float hi, float ground, float rows, out vec4 info) {
  float slot = floor(x / w);
  float lx = x - slot * w;
  float width = w - 1.0 - floor(hash12(vec2(slot, layer + 5.0)) * 3.0);
  float h = ground + floor(rows * mix(lo, hi, hash12(vec2(slot, layer))));
  info = vec4(slot, lx, width, h);
  return lx < width && y < h;
}

// Whether a window is lit: each switches on or off every few seconds on its own clock.
bool lit(vec3 id) {
  float clock = floor(iTime * 0.4 + hash12(id.xy + id.z * 7.7) * 10.0);
  return hash12(id.xy * 1.3 + vec2(id.z, clock)) < uLit;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uPixel);
  float rows = max(floor(iResolution.y / uPixel), 1.0);
  float cols = max(floor(iResolution.x / uPixel), 1.0);
  float t = iTime * uSpeed;
  float y = cell.y;
  float sy = y / rows;
  float ground = max(3.0, floor(rows * 0.06));

  // Sky in eight dithered bands, with twinkling stars and a crescent moon.
  float band = clamp(floor(sy * 8.0 + (bayer4(cell) - 0.5) * 0.9), 0.0, 7.0) / 7.0;
  vec3 col = mix(uSkyBottom, uSkyTop, band);
  if (sy > 0.35 && hash12(cell) > 1.0 - 0.02 * uStars)
    col = mix(col, vec3(1.0), 0.45 + 0.55 * step(0.5, hash12(cell + floor(iTime * 1.5))));
  vec2 moon = floor(vec2(cols * 0.8, rows * 0.8));
  float r = max(3.0, floor(rows * 0.07));
  vec2 dm = cell - moon;
  vec2 bite = dm - vec2(floor(r * 0.6), floor(r * 0.3));
  if (dot(dm, dm) <= r * r + r && dot(bite, bite) > r * r) col = vec3(0.98, 0.94, 0.8);

  vec4 info;
  // Far towers: flat silhouettes with a few lit windows.
  float fx = cell.x + floor(t * 2.0);
  if (tower(fx, y, 9.0, 1.0, 0.25, 0.55, ground, rows, info)) {
    col = uFar;
    if (mod(info.y, 2.0) == 1.0 && mod(y, 2.0) == 0.0 && lit(vec3(info.x, info.y, y)) && hash12(vec2(info.y, y) + info.x) < 0.3)
      col = mix(uFar, uWindow, 0.55);
  }
  // Middle towers: rows of one-by-two windows.
  float mx = cell.x + floor(t * 5.0);
  if (tower(mx, y, 13.0, 2.0, 0.15, 0.42, ground, rows, info)) {
    col = uMid;
    bool inside = info.y >= 1.0 && info.y <= info.z - 2.0 && y >= ground + 2.0 && y <= info.w - 3.0;
    if (inside && mod(info.y, 2.0) == 1.0 && mod(y - ground - 2.0, 3.0) < 2.0 && lit(vec3(info.x * 3.1, info.y, floor((y - ground) / 3.0))))
      col = uWindow * 0.85;
  }
  // Near towers: two-by-two windows, some cooler, and an aerial on top with a blinking light.
  float nx = cell.x + floor(t * 10.0);
  bool near = tower(nx, y, 18.0, 3.0, 0.08, 0.3, ground, rows, info);
  float aerial = floor(info.z * 0.5);
  bool hasAerial = hash12(vec2(info.x, 11.0)) > 0.55;
  if (near) {
    col = uNear;
    vec2 w = vec2(info.y - 1.0, y - ground - 2.0);
    vec2 wc = floor(w / 3.0);
    bool inside = info.y >= 1.0 && info.y <= info.z - 2.0 && y >= ground + 2.0 && y <= info.w - 3.0;
    if (inside && mod(w.x, 3.0) < 2.0 && mod(w.y, 3.0) < 2.0 && lit(vec3(info.x * 5.3 + wc.x, wc.y, 3.0)))
      col = hash12(wc + info.x) < 0.2 ? mix(uWindow, vec3(0.6, 0.85, 1.0), 0.7) : uWindow;
  } else if (hasAerial && info.y == aerial && y >= info.w && y < info.w + 5.0) {
    col = uNear;
    if (y == info.w + 4.0 && fract(iTime * 0.8 + hash12(vec2(info.x, 12.0))) < 0.5) col = vec3(1.0, 0.2, 0.15);
  }

  // The street: tail lights going left in the far lane, headlights going right in the near.
  if (y < ground) {
    col = uNear * 0.6;
    if (uTraffic && y == 2.0) {
      float x = cell.x + floor(t * 16.0 + iTime * 8.0);
      if (mod(x, 23.0) < 2.0 && hash12(vec2(floor(x / 23.0), 1.0)) > 0.4) col = vec3(1.0, 0.15, 0.1);
    }
    if (uTraffic && y == 1.0) {
      float x = cell.x - floor(iTime * 14.0) + floor(t * 10.0);
      if (mod(x, 29.0) < 2.0 && hash12(vec2(floor(x / 29.0), 2.0)) > 0.4) col = vec3(1.0, 0.95, 0.7);
    }
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Neon", values: { uSkyTop: [0.02, 0.02, 0.08], uSkyBottom: [0.55, 0.1, 0.45], uWindow: [0.3, 0.95, 1], uFar: [0.2, 0.08, 0.3] } },
    {
      name: "Dusk",
      values: { uSkyTop: [0.18, 0.2, 0.45], uSkyBottom: [0.98, 0.55, 0.35], uFar: [0.45, 0.3, 0.45], uMid: [0.25, 0.17, 0.3], uNear: [0.12, 0.08, 0.16], uLit: 0.25, uStars: 0 },
    },
  ],
};

export const screenMelt: ShaderEffect = {
  kind: "shader",
  id: "transition-screen-melt",
  name: "Screen melt",
  description: "The classic shooter's screen melt: the old picture's columns slide down off the screen at ragged, staggered speeds, uncovering the next one. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "pixel", "image", "retro", "doom", "melt", "slideshow"],
  loop: 4,
  source: glsl(
    `// Screen melt: each column of the old picture drops away after its own delay, falling faster as it goes.
uniform sampler2D uFrom;   // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uColumn;     // @control min=1 max=32 default=6 step=1 label="Column width (px)"
uniform float uStagger;    // @control min=0 max=1 default=0.4 label="Stagger"
uniform float uRagged;     // @control min=0 max=1 default=0.4 label="Raggedness"
uniform float uStep;       // @control min=1 max=16 default=4 step=1 label="Drop step (px)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float p = uAnimate ? smoothstep(0.05, 0.95, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  float column = floor(fragCoord.x / uColumn);
  // Neighbouring columns start close together, with some jitter on top, like the original's random walk.
  float delay = mix(vnoise(vec2(column * 0.12, 1.3)), hash12(vec2(column, 2.0)), uRagged) * uStagger;
  float local = clamp(p * (1.0 + uStagger) - delay, 0.0, 1.0);
  // Each column speeds up as it falls, moving in whole steps.
  float drop = floor(local * local * iResolution.y / uStep) * uStep;
  float from = fragCoord.y + drop;
  vec2 res = iResolution.xy;
  fragColor = local >= 1.0 || from >= res.y ? pictureRGBA(uTo, fragCoord / res) : pictureRGBA(uFrom, vec2(fragCoord.x, from) / res);
}`,
  ),
};

export const pixelStaircase: ShaderEffect = {
  kind: "shader",
  id: "transition-pixel-staircase",
  name: "Pixel block wipe",
  description: "An 8-bit block wipe: big squares grow in steps to cover the picture in a diagonal, spiral, closing-iris or random order, then shrink away to show the next one. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "pixel", "image", "retro", "8-bit", "wipe", "iris", "slideshow"],
  loop: 4,
  source: glsl(
    `// Pixel block wipe: a grid of blocks, each growing in steps after its turn in the order comes, then shrinking.
uniform sampler2D uFrom;   // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.3 label="Progress (when still)"
uniform int uPattern;      // @control min=0 max=3 default=0 label="Order (0 diagonal, 1 spiral, 2 iris, 3 random)"
uniform float uBlock;      // @control min=8 max=160 default=48 step=1 label="Block size (px)"
uniform float uSpread;     // @control min=0 max=0.9 default=0.6 label="Spread"
uniform float uSteps;      // @control min=1 max=8 default=4 step=1 label="Growth steps"
uniform bool uReverse;     // @control default=false label="Clear in reverse order"
uniform vec3 uFill;        // @control color default=#000000 label="Block colour"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// When block b of a g-block grid takes its turn, 0–1.
float order(vec2 b, vec2 g) {
  if (uPattern == 0) return (b.x + (g.y - 1.0 - b.y)) / max(g.x + g.y - 2.0, 1.0);
  if (uPattern == 1) {
    float ring = min(min(b.x, b.y), min(g.x - 1.0 - b.x, g.y - 1.0 - b.y));
    float rings = floor((min(g.x, g.y) + 1.0) / 2.0);
    vec2 d = b - (g - 1.0) * 0.5;
    float turn = fract(atan(d.y, d.x) / 6.28318 + 0.25);
    return clamp((ring + turn) / rings, 0.0, 1.0);
  }
  if (uPattern == 2) return clamp(1.0 - length(b + 0.5 - g * 0.5) / length(g * 0.5), 0.0, 1.0);
  return hash12(b + 0.5);
}

// How far block growth has got, in uSteps whole steps, at phase u for a block whose turn is o.
float grown(float u, float o) {
  float w = min(uSpread, 0.9);
  float k = clamp((u - o * w) / (1.0 - w), 0.0, 1.0);
  return floor(k * uSteps) / uSteps;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float p = uAnimate ? smoothstep(0.05, 0.95, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  vec2 g = ceil(iResolution.xy / uBlock);
  vec2 b = floor(fragCoord / uBlock);
  vec2 f = fragCoord / uBlock - b - 0.5;
  float m = max(abs(f.x), abs(f.y));
  float o = order(b, g);
  vec2 uv = fragCoord / iResolution.xy;
  bool covered;
  vec4 under;
  if (p < 0.5) {
    float k = grown(p * 2.0, o);
    covered = k >= 1.0 || m < k * 0.5;
    under = pictureRGBA(uFrom, uv);
  } else {
    float k = grown(p * 2.0 - 1.0, uReverse ? 1.0 - o : o);
    covered = k <= 0.0 || m < (1.0 - k) * 0.5;
    under = pictureRGBA(uTo, uv);
  }
  fragColor = covered ? vec4(uFill, 1.0) : under;
}`,
  ),
  presets: [
    { name: "Diagonal", values: { uPattern: 0 } },
    { name: "Spiral", values: { uPattern: 1, uBlock: 64, uReverse: true } },
    { name: "Level complete", values: { uPattern: 2, uBlock: 24, uReverse: true, uSteps: 2 } },
    { name: "Scatter", values: { uPattern: 3, uBlock: 32, uSpread: 0.85 } },
  ],
};

/** Retro and pixel graphics: limited palettes, chunky pixels, demoscene and arcade looks. */
export const pixelShaders: ShaderEffect[] = [
  image8bit,
  gameboyScreen,
  pixelFire,
  pixelLandscape,
  outrunRoad,
  paletteCycle,
  rasterBars,
  loadingStripes,
  pixelWater,
  pixelDissolve,
  imagePixelSort,
  imageLedWall,
  imageSubpixel,
  imageBricks,
  pixelSprites,
  pixelCity,
  screenMelt,
  pixelStaircase,
];
