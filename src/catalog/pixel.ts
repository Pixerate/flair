import type { SvgAnimation } from "../vector/motion.js";
import { pixelGlyph } from "./shaders/pixel.js";
import type { VectorEffect } from "./types.js";

/*
 * Pixel art as SVG: each sprite is a bitmap (rows of characters, one per
 * colour) turned into one path per colour, a run of pixels per sub-path, and
 * drawn with `shape-rendering="crispEdges"` so pixels stay hard-edged.
 * Sprite frames change by snapping a path's `d` (a change with no duration).
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/**
 * The pixels of `bitmap` that are `char`, as path data: a rectangle per run
 * of pixels in a row, each pixel `unit` wide, the top-left at (`x`, `y`).
 */
export function bitmapPath(bitmap: readonly string[], char: string, unit = 1, x = 0, y = 0): string {
  let d = "";
  bitmap.forEach((row, j) => {
    for (let i = 0; i < row.length; ) {
      if (row[i] !== char) {
        i++;
        continue;
      }
      let end = i;
      while (row[end] === char) end++;
      d += `M${r2(x + i * unit)} ${r2(y + j * unit)}h${r2((end - i) * unit)}v${r2(unit)}h${r2(-(end - i) * unit)}z`;
      i = end;
    }
  });
  return d || "M0 0";
}

/** A bitmap drawn as one path per colour: `colours` maps its characters to fills. */
function sprite(bitmap: readonly string[], colours: Record<string, string>, unit = 1, x = 0, y = 0, id?: (char: string) => string | undefined): string {
  return Object.entries(colours)
    .map(([char, fill]) => {
      const pid = id?.(char);
      return `<path${pid ? ` id="${pid}"` : ""} fill="${fill}" d="${bitmapPath(bitmap, char, unit, x, y)}"/>`;
    })
    .join("");
}

/** Instant changes: the attribute snaps to `value` at `delay`. */
const snap = (id: string, attr: string, value: string | number, delay: number): SvgAnimation => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 });

// ── Pixel text ─────────────────────────────────────────────────────────

/** Letters pixel text has room for; longer text is cut. */
const TEXT_SLOTS = 16;
const TEXT_W = 240;
const TEXT_H = 100;

/** A letter's drop: from `lift` units above its place, a bounce, then at rest. */
const letterAt = (i: number, lift: number) => `translate(${i * 6} ${lift})`;

export const pixelText: VectorEffect = {
  kind: "vector",
  id: "pixel-text",
  name: "Pixel text",
  description: "Any text set in a chunky 5 × 7 pixel font, its letters dropping in one after another with a little bounce.",
  category: "retro",
  tags: ["pixel", "retro", "text", "title", "8-bit", "arcade", "font"],
  hold: 1400,
  presets: [
    { name: "Arcade", values: { ink: [1, 0.85, 0.1], shadow: [0.85, 0.15, 0.1], background: [0, 0, 0] } },
    { name: "Game Boy", values: { ink: [0.06, 0.22, 0.06], shadow: [0.55, 0.67, 0.06], background: [0.61, 0.74, 0.06] } },
  ],
  // Each letter slot is one path; its `d` is worked out from the text here (attribute values, so no markup is injected).
  derived: (v) => {
    const letters = Array.from(String(v.text ?? "")).slice(0, TEXT_SLOTS);
    const count = Math.max(1, letters.length);
    const width = count * 6 - 1;
    const scale = Math.min(10, (TEXT_W - 20) / width);
    const out: Record<string, string | number> = {
      fit: `translate(${r2((TEXT_W - width * scale) / 2)} ${r2((TEXT_H - 7 * scale) / 2)}) scale(${r2(scale)})`,
    };
    const stagger = Number(v.stagger) || 0;
    for (let i = 0; i < TEXT_SLOTS; i++) {
      const c = letters[i];
      out[`d${i}`] = c === undefined || /\s/.test(c) ? "M0 0" : bitmapPath(pixelGlyph(c), "#");
      // When it starts falling, lands and tops its bounce.
      out[`t${i}`] = Math.round(i * stagger);
      out[`u${i}`] = Math.round(i * stagger) + 260;
      out[`w${i}`] = Math.round(i * stagger) + 370;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${TEXT_W} ${TEXT_H}" shape-rendering="crispEdges"><!-- {{text: text default=PIXEL label='Text'}} {{ink: color default=#FFFFFF label='Letters'}} {{shadow: color default=#E8343F label='Shadow'}} {{background: color default=#1A1C2C label='Background'}} {{stagger: float min=20 max=300 default=90 step=10 label='Stagger (ms)'}} --><rect width="${TEXT_W}" height="${TEXT_H}" fill="{{background}}"/><g transform="{{fit}}">${Array.from(
      { length: TEXT_SLOTS },
      (_, i) =>
        `<g id="g${i}" transform="${letterAt(i, -14)}" opacity="0"><path transform="translate(0.6 0.6)" fill="{{shadow}}" d="{{d${i}}}"/><path fill="{{ink}}" d="{{d${i}}}"/></g>`,
    ).join("")}</g></svg>`,
    animate: Array.from({ length: TEXT_SLOTS }, (_, i): SvgAnimation[] => [
      { id: `g${i}`, attrs: { opacity: [0, 1] }, delay: n(`t${i}`), ms: 60, ease: "linear" },
      { id: `g${i}`, attrs: { transform: [letterAt(i, -14), letterAt(i, 0)] }, delay: n(`t${i}`), ms: 260, ease: "in-out" },
      { id: `g${i}`, attrs: { transform: [letterAt(i, 0), letterAt(i, -1.6)] }, delay: n(`u${i}`), ms: 110, ease: "out" },
      { id: `g${i}`, attrs: { transform: [letterAt(i, -1.6), letterAt(i, 0)] }, delay: n(`w${i}`), ms: 120, ease: "in-out" },
    ]).flat(),
  },
};

// ── Coin spin ──────────────────────────────────────────────────────────

const COIN = [
  "...oooo...",
  "..oyyyyo..",
  ".oylyyyyo.",
  ".oylyddyo.",
  "oylyyddyyo",
  "oylyyddyyo",
  "oylyyddyyo",
  "oylyyddyyo",
  "oylyyddyyo",
  "oylyyddyyo",
  ".oyyyddyo.",
  ".oyyyyyyo.",
  "..oyyyyo..",
  "...oooo...",
];
const SPARKLE = ["..w..", "..w..", "ww.ww", "..w..", "..w.."];
/** "+1" in the pixel font, a column apart. */
const PLUS_ONE = pixelGlyph("+").map((row, j) => `${row}.${pixelGlyph("1")[j]}`);
const coinPose = (sx: number) => `translate(60 60) scale(${sx} 1) translate(-25 -35)`;
const sparklePose = (s: number) => `translate(86 30) scale(${s}) translate(-6.25 -6.25)`;

export const coinSpin: VectorEffect = {
  kind: "vector",
  id: "coin-spin",
  name: "Coin spin",
  description: "An 8-bit gold coin spinning on the spot, a pixel sparkle glinting and a +1 popping up each turn.",
  category: "retro",
  tags: ["pixel", "retro", "coin", "game", "reward", "8-bit", "icon", "loop"],
  hold: 0,
  presets: [
    { name: "Silver", values: { gold: [0.78, 0.8, 0.85], light: [1, 1, 1], dark: [0.45, 0.48, 0.55], outline: [0.2, 0.22, 0.28] } },
    { name: "Ruby", values: { gold: [0.9, 0.15, 0.3], light: [1, 0.6, 0.7], dark: [0.55, 0.05, 0.15], outline: [0.25, 0.02, 0.08] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120" shape-rendering="crispEdges"><!-- {{background: color default=#1A1C2C label='Background'}} {{gold: color default=#F7C531 label='Coin'}} {{light: color default=#FFF3A8 label='Shine'}} {{dark: color default=#C27C0E label='Shade'}} {{outline: color default=#5A2E05 label='Outline'}} {{plus: color default=#FFFFFF label='+1'}} --><rect width="120" height="120" fill="{{background}}"/><g id="coin" transform="${coinPose(1)}">${sprite(COIN, { o: "{{outline}}", y: "{{gold}}", l: "{{light}}", d: "{{dark}}" }, 5)}</g><g id="sparkle" transform="${sparklePose(0)}">${sprite(SPARKLE, { w: "{{light}}" }, 2.5)}</g><g id="plus" transform="translate(66 22)" opacity="0">${sprite(PLUS_ONE, { "#": "{{plus}}" }, 2)}</g></svg>`,
    animate: [
      // A full turn: face, edge, back (mirrored), edge, face.
      { id: "coin", attrs: { transform: [coinPose(1), coinPose(-1)] }, ms: 500, ease: "in-out" },
      { id: "coin", attrs: { transform: [coinPose(-1), coinPose(1)] }, delay: 500, ms: 500, ease: "in-out" },
      { id: "sparkle", attrs: { transform: [sparklePose(0), sparklePose(1)] }, delay: 150, ms: 150, ease: "out" },
      { id: "sparkle", attrs: { transform: [sparklePose(1), sparklePose(0)] }, delay: 300, ms: 200, ease: "in-out" },
      { id: "plus", attrs: { transform: ["translate(66 22)", "translate(66 4)"], opacity: [1, 0] }, delay: 450, ms: 650, ease: "out" },
      snap("plus", "opacity", 0, 0),
    ],
  },
};

// ── Space invader ──────────────────────────────────────────────────────

const INVADER_A = ["..#.....#..", "...#...#...", "..#######..", ".##.###.##.", "###########", "#.#######.#", "#.#.....#.#", "...##.##..."];
const INVADER_B = ["..#.....#..", "#..#...#..#", "#.#######.#", "###.###.###", "###########", ".#########.", "..#.....#..", ".#.......#."];
const BOLT_A = [".#", "#.", ".#", "#."];
const BOLT_B = ["#.", ".#", "#.", ".#"];
const CANNON = ["....#....", "...###...", ".#######.", "#########"];
const MARCH_MS = 320;
/** The invader's positions: right in steps, down, left, down. */
const MARCH: [number, number][] = [
  ...[0, 1, 2, 3, 4, 5, 6].map((k): [number, number] => [24 + k * 16, 12]),
  ...[6, 5, 4, 3, 2, 1, 0].map((k): [number, number] => [24 + k * 16, 26]),
  [24, 40],
];
/** Shots fired: at which march step. */
const SHOTS = [3, 10];

export const spaceInvader: VectorEffect = {
  kind: "vector",
  id: "space-invader",
  name: "Space invader",
  description: "The classic two-frame pixel invader marching across and down a step, dropping a blinking zigzag laser shot.",
  category: "retro",
  tags: ["pixel", "retro", "arcade", "game", "sprite", "alien", "8-bit", "loop"],
  hold: 0,
  presets: [
    { name: "Green", values: { invader: [0.3, 1, 0.35], shot: [1, 1, 1], ground: [0.3, 1, 0.35] } },
    { name: "Overlay", values: { invader: [1, 0.3, 0.6], shot: [1, 0.9, 0.2], ground: [0.2, 0.85, 1], background: [0.06, 0.02, 0.12] } },
  ],
  motion: (() => {
    const pose = ([x, y]: [number, number]) => `translate(${x} ${y})`;
    const frameA = bitmapPath(INVADER_A, "#", 4);
    const frameB = bitmapPath(INVADER_B, "#", 4);
    const boltA = bitmapPath(BOLT_A, "#", 2);
    const boltB = bitmapPath(BOLT_B, "#", 2);
    const animate: SvgAnimation[] = [snap("bolt", "opacity", 0, 0)];
    MARCH.forEach((at, k) => {
      animate.push(snap("invader", "transform", pose(at), k * MARCH_MS));
      animate.push(snap("body", "d", k % 2 ? frameB : frameA, k * MARCH_MS));
    });
    SHOTS.forEach((k) => {
      const [x, y] = MARCH[k]!;
      const start = k * MARCH_MS + 60;
      const from = `translate(${x + 20} ${y + 34})`;
      animate.push(snap("bolt", "opacity", 1, start));
      animate.push({ id: "bolt", attrs: { transform: [from, `translate(${x + 20} 118)`] }, delay: start, ms: 900, ease: "linear" });
      for (let f = 0; f < 9; f++) animate.push(snap("zig", "d", f % 2 ? boltB : boltA, start + f * 100));
      animate.push(snap("bolt", "opacity", 0, start + 900));
    });
    return {
      svg: `<svg viewBox="0 0 200 140" shape-rendering="crispEdges"><!-- {{background: color default=#000000 label='Background'}} {{invader: color default=#FFFFFF label='Invader'}} {{shot: color default=#FF4D4D label='Laser'}} {{ground: color default=#3FD15C label='Ground'}} --><rect width="200" height="140" fill="{{background}}"/><g id="invader" transform="${pose(MARCH[0]!)}"><path id="body" fill="{{invader}}" d="${frameA}"/></g><g id="bolt" transform="translate(0 0)" opacity="0"><path id="zig" fill="{{shot}}" d="${boltA}"/></g><g fill="{{ground}}"><path d="${bitmapPath(CANNON, "#", 3, 128, 114)}"/><rect x="0" y="128" width="200" height="2"/></g></svg>`,
      animate,
    };
  })(),
};

// ── Pixel heart health ─────────────────────────────────────────────────

const HEART_INSIDE = [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."];
/** The heart on a 9 × 9 grid: `o` outline round the inside, `r` fill, `w` a highlight. */
const HEART = (() => {
  const grid = Array.from({ length: 9 }, () => Array<string>(9).fill("."));
  HEART_INSIDE.forEach((row, j) => [...row].forEach((c, i) => c === "#" && (grid[j + 1]![i + 1] = "r")));
  const inside = (i: number, j: number) => grid[j]?.[i] === "r";
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 9; i++)
      if (!inside(i, j) && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => inside(i + a!, j + b!))) grid[j]![i] = "o";
  grid[2]![2] = "w";
  grid[3]![2] = "w";
  return grid.map((row) => row.join(""));
})();
const HEARTS = 5;
const HEART_UNIT = 4;
const heartPose = (i: number, s: number) => `translate(${30 + i * 45} 32) scale(${s}) translate(-18 -18)`;
/** When hearts are lost (flash then empty) and refilled, in ms. */
const LOSSES: [number, number][] = [[4, 500], [3, 1500]];
const REFILLS: [number, number][] = [[3, 2700], [4, 3000]];

export const pixelHeartHealth: VectorEffect = {
  kind: "vector",
  id: "pixel-heart-health",
  name: "Heart health bar",
  description: "A row of pixel hearts as a game health bar: two hearts flash and empty as damage lands, then pop back full.",
  category: "retro",
  tags: ["pixel", "retro", "game", "health", "hud", "hearts", "8-bit", "loop"],
  hold: 900,
  presets: [
    { name: "Shield", values: { heart: [0.2, 0.6, 1], highlight: [0.8, 0.95, 1] } },
    { name: "Light", values: { background: [0.96, 0.95, 0.9], empty: [0.82, 0.8, 0.76], outline: [0.15, 0.12, 0.12] } },
  ],
  motion: (() => {
    const animate: SvgAnimation[] = [];
    for (let i = 0; i < HEARTS; i++) {
      animate.push(snap(`f${i}`, "opacity", 1, 0), snap(`x${i}`, "opacity", 0, 0));
    }
    for (const [i, at] of LOSSES) {
      // Flash white and flicker, then empty, with a shake.
      [0, 1, 0, 1, 0].forEach((on, k) => {
        animate.push(snap(`x${i}`, "opacity", on ? 0 : 1, at + k * 90));
        animate.push(snap(`f${i}`, "opacity", on, at + k * 90));
      });
      animate.push(snap(`x${i}`, "opacity", 0, at + 450));
      animate.push({ id: `h${i}`, attrs: { transform: [heartPose(i, 1), heartPose(i, 0.82)] }, delay: at, ms: 90, ease: "out" });
      animate.push({ id: `h${i}`, attrs: { transform: [heartPose(i, 0.82), heartPose(i, 1)] }, delay: at + 90, ms: 220, ease: "in-out" });
    }
    for (const [i, at] of REFILLS) {
      animate.push(snap(`f${i}`, "opacity", 1, at));
      animate.push({ id: `h${i}`, attrs: { transform: [heartPose(i, 1), heartPose(i, 1.3)] }, delay: at, ms: 120, ease: "out" });
      animate.push({ id: `h${i}`, attrs: { transform: [heartPose(i, 1.3), heartPose(i, 1)] }, delay: at + 120, ms: 200, ease: "in-out" });
    }
    const hearts = Array.from(
      { length: HEARTS },
      (_, i) =>
        `<g id="h${i}" transform="${heartPose(i, 1)}">${sprite(HEART, { o: "{{outline}}", r: "{{empty}}", w: "{{empty}}" }, HEART_UNIT)}<g id="f${i}">${sprite(HEART, { r: "{{heart}}", w: "{{highlight}}" }, HEART_UNIT)}</g><path id="x${i}" opacity="0" fill="{{flash}}" d="${bitmapPath(HEART.map((row) => row.replace(/w/g, "r")), "r", HEART_UNIT)}"/></g>`,
    ).join("");
    return {
      svg: `<svg viewBox="0 0 240 64" shape-rendering="crispEdges"><!-- {{background: color default=#14141F label='Background'}} {{heart: color default=#E83B3B label='Heart'}} {{highlight: color default=#FFB3B3 label='Highlight'}} {{empty: color default=#3A2E3E label='Empty'}} {{outline: color default=#000000 label='Outline'}} {{flash: color default=#FFFFFF label='Hit flash'}} --><rect width="240" height="64" fill="{{background}}"/>${hearts}</svg>`,
      animate,
    };
  })(),
};

// ── Chomp loader ───────────────────────────────────────────────────────

/** A 13 × 13 pixel mouth facing right, open by `angle` degrees each side of its axis. */
function chomper(angle: number): string[] {
  return Array.from({ length: 13 }, (_, j) =>
    Array.from({ length: 13 }, (_, i) => {
      const [x, y] = [i - 6, j - 6];
      if (x * x + y * y > 6.6 * 6.6) return ".";
      const a = (Math.atan2(-y, x) * 180) / Math.PI;
      return angle > 0 && x >= 0 && Math.abs(a) <= angle ? "." : "#";
    }).join(""),
  );
}
const CHOMP_UNIT = 3;
const CHOMP_FRAMES = [0, 25, 45, 25].map((a) => bitmapPath(chomper(a), "#", CHOMP_UNIT, -19.5, -19.5));
const CHOMP_MS = 2800;
const CHOMP_FROM = -30;
const CHOMP_TO = 270;
const DOTS = [50, 80, 110, 140, 170, 200];

export const chompLoader: VectorEffect = {
  kind: "vector",
  id: "chomp-loader",
  name: "Chomp loader",
  description: "A chomping pixel mouth munching along a row of dots between maze walls, as a looping loader.",
  category: "retro",
  tags: ["pixel", "retro", "loader", "arcade", "game", "8-bit", "loop"],
  hold: 0,
  presets: [
    { name: "Ghostly", values: { mouth: [0.4, 0.9, 1], dots: [1, 1, 1], walls: [0.9, 0.2, 0.6] } },
    { name: "Light", values: { background: [1, 1, 1], mouth: [0.95, 0.65, 0], dots: [0.4, 0.4, 0.45], walls: [0.15, 0.3, 0.9] } },
  ],
  motion: (() => {
    const travel = CHOMP_TO - CHOMP_FROM;
    const animate: SvgAnimation[] = [
      { id: "chomp", attrs: { transform: [`translate(${CHOMP_FROM} 40)`, `translate(${CHOMP_TO} 40)`] }, ms: CHOMP_MS, ease: "linear" },
    ];
    for (let f = 0; f * 80 < CHOMP_MS; f++) animate.push(snap("mouth", "d", CHOMP_FRAMES[f % CHOMP_FRAMES.length]!, f * 80));
    DOTS.forEach((x, k) => {
      animate.push(snap(`dot${k}`, "opacity", 1, 0));
      // Eaten as the mouth's centre reaches it.
      animate.push(snap(`dot${k}`, "opacity", 0, Math.round(((x - CHOMP_FROM) / travel) * CHOMP_MS)));
    });
    return {
      svg: `<svg viewBox="0 0 240 80" shape-rendering="crispEdges"><!-- {{background: color default=#000000 label='Background'}} {{mouth: color default=#FFE600 label='Chomper'}} {{dots: color default=#FFB897 label='Dots'}} {{walls: color default=#2E3BFF label='Walls'}} --><rect width="240" height="80" fill="{{background}}"/><g fill="none" stroke="{{walls}}" stroke-width="3"><path d="M0 10.5 H240 M0 69.5 H240"/></g>${DOTS.map((x, k) => `<rect id="dot${k}" x="${x - 3}" y="37" width="6" height="6" fill="{{dots}}"/>`).join("")}<g id="chomp" transform="translate(${CHOMP_FROM} 40)"><path id="mouth" fill="{{mouth}}" d="${CHOMP_FRAMES[0]}"/></g></svg>`,
      animate,
    };
  })(),
};

/** Pixel-art vector effects: sprites, pixel type and 8-bit UI. */
export const pixelEffects: VectorEffect[] = [pixelText, coinSpin, spaceInvader, pixelHeartHealth, chompLoader];
