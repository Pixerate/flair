import type { SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Stickers read as stickers by three things they all share: a thick white
 * die-cut border (the shape stroked wide in the border colour, round joins),
 * a soft drop shadow under it, and a glossy sheen (a white gradient across
 * the face that stops short, like light on vinyl). Shapes are worked out in
 * code and handed to the picture by `derived`, so one control can switch them.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const HEAVY = `'Arial Black', 'Helvetica Neue', Impact, system-ui, sans-serif`;

/** The font control the labelled stickers share. */
const FONT = `{{font: text default="${HEAVY}" label='Font'}}`;

/** Text fitted to `width` units, at most `max` high: its font size and width. */
function fit(text: unknown, width: number, max: number) {
  const e = Math.max(0.6, textWidthEm(String(text)));
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size) };
}

type Point = readonly [number, number];

/** A closed outline through `points`. */
const outline = (points: readonly Point[]) => `M${points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;

/** A scalloped badge: a circle of radius `r` with `bumps` round bumps `depth` deep. */
function burst(cx: number, cy: number, r: number, bumps = 14, depth = 0.08): string {
  return outline(
    Array.from({ length: 112 }, (_, k) => {
      const a = (k / 112) * Math.PI * 2;
      const rr = r * (1 - depth + depth * Math.cos(a * bumps));
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
    }),
  );
}

/** A star of `points` points, outer radius `r`, inner `inner`, point up. */
function star(cx: number, cy: number, r: number, inner: number, points = 5): string {
  return outline(
    Array.from({ length: points * 2 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / points;
      const rr = k % 2 ? inner : r;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
    }),
  );
}

/** A heart in a 24 box, curves and all. */
const HEART = "M12 21 C12 21 2.5 15 2.5 8.6 C2.5 5.6 4.9 3.3 7.9 3.3 C9.7 3.3 11.2 4.3 12 5.8 C12.8 4.3 14.3 3.3 16.1 3.3 C19.1 3.3 21.5 5.6 21.5 8.6 C21.5 15 12 21 12 21 Z";

/** The heart scaled to `size` wide and centred on (`cx`, `cy`). */
function heart(cx: number, cy: number, size: number): string {
  const k = size / 19;
  let i = 0;
  return HEART.replace(/-?\d+(?:\.\d+)?/g, (m) => String(r1(i++ % 2 === 0 ? cx + (Number(m) - 12) * k : cy + (Number(m) - 12.2) * k)));
}

/** A circle as a path. */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

/** A lightning bolt about `size` high, centred on (`cx`, `cy`). */
function bolt(cx: number, cy: number, size: number): string {
  const k = size / 68;
  const pts: Point[] = [[4, -34], [-22, 6], [-3, 6], [-10, 34], [22, -8], [3, -8], [12, -34]];
  return outline(pts.map(([x, y]) => [cx + x * k, cy + y * k] as const));
}

/**
 * The shapes a sticker control picks between (0 burst, 1 heart, 2 star, 3
 * circle), centred on (`cx`, `cy`) about `r` in radius, with where and how
 * wide its label goes.
 */
function stickerShape(shape: unknown, cx: number, cy: number, r: number) {
  switch (Math.round(Number(shape))) {
    case 1:
      return { d: heart(cx, cy, r * 2.15), labelY: cy - r * 0.08, labelW: r * 1.25 };
    case 2:
      return { d: star(cx, cy, r * 1.12, r * 0.56), labelY: cy + r * 0.12, labelW: r * 0.95 };
    case 3:
      return { d: circle(cx, cy, r * 0.95), labelY: cy, labelW: r * 1.5 };
    default:
      return { d: burst(cx, cy, r), labelY: cy, labelW: r * 1.45 };
  }
}

const SHAPE_CONTROL = `{{shape: int min=0 max=3 default=0 label='Shape (0 burst, 1 heart, 2 star, 3 circle)'}}`;

/** The gloss every sticker's face wears: light from the top left that stops short, as on vinyl. */
const gloss = (id: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.6"/><stop offset="0.36" stop-color="#FFFFFF" stop-opacity="0.12"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;

/** A transform posing a sticker round (`cx`, `cy`): turned `r` degrees, scaled `s` (and `sy` if squashed), dropped `dy`. */
const pose = (cx: number, cy: number, s: number, r: number, dy = 0, sy = s) =>
  `translate(${cx} ${r1(cy + dy)}) rotate(${r1(r)}) scale(${r2(s)} ${r2(sy)}) translate(${-cx} ${-cy})`;

/** Instant changes: the attribute snaps to `value` at `delay`. */
const snap = (id: string, attr: string, value: string | number, delay: number, step = 1): SvgAnimation => ({
  id,
  step,
  attrs: { [attr]: [value, value] },
  delay,
  ms: 0,
});

// ── Sticker slap ───────────────────────────────────────────────────────

/** Slap keyframes: [ms, scale, turn, shadow drop, shadow opacity, shadow blur]. */
const SLAP: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 1, -6, 7, 0.32, 3],
  [150, 1.45, 6, 26, 0, 12],
  // A jump to big and clear, then the slap down past its size and back.
  [150, 2.5, 18, 34, 0.06, 15],
  [430, 0.9, -10, 3, 0.42, 2],
  [550, 1.06, -4, 8, 0.36, 3.5],
  [740, 1, -6, 7, 0.32, 3],
];

export const stickerSlap: VectorEffect = {
  kind: "vector",
  id: "sticker-slap",
  name: "Sticker slap",
  description: "A die-cut sticker with a label that flicks up and slaps back down from big with a twist, overshooting and settling as its shadow tightens; every click slaps it again.",
  category: "sticker",
  tags: ["sticker", "click", "interactive", "die-cut", "badge", "label", "slap"],
  trigger: "click",
  hold: 400,
  presets: [
    { name: "Hello heart", values: { shape: 1, label: "HI!", sticker: [0.98, 0.33, 0.52], ink: [1, 1, 1] } },
    { name: "Gold star", values: { shape: 2, label: "TOP", sticker: [1, 0.78, 0.18], ink: [0.36, 0.2, 0.02], background: [0.13, 0.14, 0.18] } },
    { name: "Laptop lid", values: { shape: 3, label: "SHIP IT", sticker: [0.2, 0.83, 0.6], ink: [0.04, 0.2, 0.15], background: [0.75, 0.77, 0.8] } },
  ],
  derived: (v) => {
    const { d, labelY, labelW } = stickerShape(v.shape, 120, 120, 78);
    const { size, length } = fit(v.label, labelW, 40);
    return { d, size, length, base: r1(labelY + size * 0.36) };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{label: text default='NEW!' label='Label'}} ${SHAPE_CONTROL} {{background: color default=#EDE8DF label='Background'}} {{sticker: color default=#FF5A36 label='Sticker'}} {{ink: color default=#FFFFFF label='Label colour'}} {{border: color default=#FFFFFF label='Border'}} ${FONT} --><defs><filter id="slapSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur id="shadeBlur" stdDeviation="3"/></filter>${gloss("slapGloss")}</defs><rect width="240" height="240" fill="{{background}}"/><g id="shade" transform="${pose(120, 120, 1, -6, 7)}" opacity="0.32"><path d="{{d}}" fill="#000000" stroke="#000000" stroke-width="16" stroke-linejoin="round" filter="url(#slapSoft)"/></g><g id="sticker" transform="${pose(120, 120, 1, -6)}"><path d="{{d}}" fill="{{border}}" stroke="{{border}}" stroke-width="16" stroke-linejoin="round"/><path d="{{d}}" fill="{{sticker}}"/><text x="120" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{ink}}">{{label}}</text><path d="{{d}}" fill="url(#slapGloss)" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="16" stroke-linejoin="round"/></g></svg>`,
    animate: SLAP.slice(1).flatMap(([at, s, r, dy, o, blur], i): SvgAnimation[] => {
      const [from, fs, fr, fdy, fo, fblur] = SLAP[i]!;
      const ms = at - from;
      if (ms === 0)
        return [
          snap("sticker", "transform", pose(120, 120, s, r), at),
          snap("shade", "transform", pose(120, 120, s, r, dy), at),
          snap("shade", "opacity", o, at),
          snap("shadeBlur", "stdDeviation", blur, at),
        ];
      const ease = i === 0 || i === 3 ? "out" : "in-out";
      return [
        { id: "sticker", step: 1, attrs: { transform: [pose(120, 120, fs, fr), pose(120, 120, s, r)] }, delay: from, ms, ease },
        { id: "shade", step: 1, attrs: { transform: [pose(120, 120, fs, fr, fdy), pose(120, 120, s, r, dy)], opacity: [fo, o] }, delay: from, ms, ease },
        { id: "shadeBlur", step: 1, attrs: { stdDeviation: [fblur, blur] }, delay: from, ms, ease },
      ];
    }).concat([
      // Gone as it flicks up, back in as it comes down.
      { id: "sticker", step: 1, attrs: { opacity: [1, 0] }, ms: 150, ease: "out" },
      { id: "sticker", step: 1, attrs: { opacity: [0, 1] }, delay: 150, ms: 110 },
    ]),
  },
};

// ── Sticker peel ───────────────────────────────────────────────────────

/*
 * The peel folds the bottom-right corner back along the line x + y = k: the
 * sticker is clipped to the side of the line it still covers, and its back
 * is the sticker's outline reflected across the line, clipped to the
 * triangle the fold lifted, so the flap has the sticker's rounded corner.
 */
const PEEL_LO = 50;
const PEEL_HI = 190;
/** The clip's edge, just past the sticker. */
const PEEL_EDGE = PEEL_HI + 5;
const PEEL_REST = 2 * PEEL_HI + 4;
const PEEL_UP = 310;

const peelRemain = (k: number) =>
  [[40, 40], [PEEL_EDGE, 40], [PEEL_EDGE, k - PEEL_EDGE], [k - PEEL_EDGE, PEEL_EDGE], [40, PEEL_EDGE]].map((p) => p.join(",")).join(" ");
const peelFlap = (k: number) => [[PEEL_EDGE, k - PEEL_EDGE], [k - PEEL_EDGE, PEEL_EDGE], [k - PEEL_EDGE, k - PEEL_EDGE]].map((p) => p.join(",")).join(" ");
/** Reflection across x + y = k. */
const peelMirror = (k: number) => `matrix(0 -1 -1 0 ${k} ${k})`;

export const stickerPeel: VectorEffect = {
  kind: "vector",
  id: "sticker-peel",
  name: "Sticker peel",
  description: "A square die-cut sticker whose corner curls up on hover, showing its paper-white backing and the shadow under the lifted flap, and lies back down after.",
  category: "sticker",
  tags: ["sticker", "hover", "interactive", "peel", "curl", "die-cut", "label"],
  trigger: "hover",
  presets: [
    { name: "Mint", values: { sticker: [0.3, 0.85, 0.66], ink: [0.04, 0.24, 0.18], label: "FRESH" } },
    { name: "Midnight", values: { background: [0.1, 0.11, 0.15], sticker: [0.42, 0.36, 1], ink: [1, 1, 1], label: "PEEL ME" } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 104, 36);
    return { size, length, base: r1(132 + size * 0.36), icon: r1(96 - size * 0.25) };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{label: text default='HELLO' label='Label'}} {{background: color default=#E7E2D8 label='Background'}} {{sticker: color default=#FFB627 label='Sticker'}} {{ink: color default=#3B1F00 label='Label colour'}} {{border: color default=#FFFFFF label='Border'}} {{back: color default=#F4F1EA label='Backing'}} ${FONT} --><defs><filter id="peelDrop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.28"/></filter><filter id="peelLift" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dx="6" dy="8"/><feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer></filter><clipPath id="peelRemain"><polygon id="remainEdge" points="${peelRemain(PEEL_REST)}"/></clipPath><clipPath id="peelLifted"><polygon id="flapEdge" points="${peelFlap(PEEL_REST)}"/></clipPath><linearGradient id="peelBacking" gradientUnits="userSpaceOnUse" x1="${PEEL_REST / 2}" y1="${PEEL_REST / 2}" x2="${PEEL_HI}" y2="${PEEL_HI}"><stop offset="0" stop-color="#B9BDC6"/><stop offset="0.22" stop-color="{{back}}"/><stop offset="0.7" stop-color="#FFFFFF"/><stop offset="1" stop-color="{{back}}"/></linearGradient>${gloss("peelGloss")}</defs><rect width="240" height="240" fill="{{background}}"/><g filter="url(#peelDrop)"><g clip-path="url(#peelRemain)"><rect x="${PEEL_LO}" y="${PEEL_LO}" width="${PEEL_HI - PEEL_LO}" height="${PEEL_HI - PEEL_LO}" rx="24" fill="{{border}}"/><rect x="${PEEL_LO + 9}" y="${PEEL_LO + 9}" width="${PEEL_HI - PEEL_LO - 18}" height="${PEEL_HI - PEEL_LO - 18}" rx="16" fill="{{sticker}}"/><path d="${star(120, 96, 20, 9)}" fill="{{ink}}" transform="translate(0 {{icon}}) translate(0 -96)"/><text x="120" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{ink}}">{{label}}</text><rect x="${PEEL_LO}" y="${PEEL_LO}" width="${PEEL_HI - PEEL_LO}" height="${PEEL_HI - PEEL_LO}" rx="24" fill="url(#peelGloss)"/></g></g><use href="#peelFlap" filter="url(#peelLift)"/><g id="peelFlap" clip-path="url(#peelLifted)"><g id="mirror" transform="${peelMirror(PEEL_REST)}"><rect x="${PEEL_LO}" y="${PEEL_LO}" width="${PEEL_HI - PEEL_LO}" height="${PEEL_HI - PEEL_LO}" rx="24" fill="url(#peelBacking)"/></g></g></svg>`,
    animate: [
      { id: "remainEdge", attrs: { points: [peelRemain(PEEL_REST), peelRemain(PEEL_UP)] }, ms: 650, ease: "in-out" },
      { id: "flapEdge", attrs: { points: [peelFlap(PEEL_REST), peelFlap(PEEL_UP)] }, ms: 650, ease: "in-out" },
      { id: "mirror", attrs: { transform: [peelMirror(PEEL_REST), peelMirror(PEEL_UP)] }, ms: 650, ease: "in-out" },
      { id: "peelBacking", attrs: { x1: [PEEL_REST / 2, PEEL_UP / 2], y1: [PEEL_REST / 2, PEEL_UP / 2] }, ms: 650, ease: "in-out" },
    ],
  },
};

// ── Holo sticker ───────────────────────────────────────────────────────

/** The holo gradient's period along its direction, in picture units. */
const HOLO_PERIOD = 150;
/** Sparkles: [x, y, size, start as a share of the loop]. */
const GLINTS: readonly (readonly [number, number, number, number])[] = [
  [86, 84, 14, 0.12],
  [158, 150, 11, 0.42],
  [150, 78, 9, 0.66],
  [92, 160, 8, 0.8],
];
/** A four-point sparkle round (0, 0), radius 1. */
const SPARKLE = "M0 -1 C0.12 -0.12 0.12 -0.12 1 0 C0.12 0.12 0.12 0.12 0 1 C-0.12 0.12 -0.12 0.12 -1 0 C-0.12 -0.12 -0.12 -0.12 0 -1 Z";

export const holoSticker: VectorEffect = {
  kind: "vector",
  id: "holo-sticker",
  name: "Holo sticker",
  description: "A holographic die-cut sticker whose rainbow foil sweeps round and round under a white border, with a sheen passing over and sparkles glinting.",
  category: "sticker",
  tags: ["sticker", "holographic", "foil", "rainbow", "iridescent", "sparkle", "badge", "loop"],
  hold: 0,
  presets: [
    { name: "Gold foil", values: { holo1: [1, 0.84, 0.4], holo2: [1, 0.62, 0.3], holo3: [1, 0.95, 0.7], ink: [0.4, 0.22, 0.02] } },
    { name: "Heart on black", values: { shape: 1, background: [0.07, 0.07, 0.1], label: "LOVE" } },
    { name: "Badge", values: { shape: 0, label: "PRO", speed: 2 } },
  ],
  derived: (v) => {
    const { d, labelY, labelW } = stickerShape(v.shape, 120, 120, 80);
    const { size, length } = fit(v.label, labelW, 40);
    const period = Math.round(Number(v.speed) * 1000);
    const glints = Object.fromEntries(GLINTS.flatMap(([, , , at], k) => [[`g${k}`, Math.round(at * period)], [`h${k}`, Math.round(at * period) + Math.round(period * 0.08)]]));
    // Each glint grows for 8% of the loop and fades for 11%, all inside it, so the loop stays seamless.
    return { d, size, length, base: r1(labelY + size * 0.36), period, sheen: Math.round(period * 0.35), grow: Math.round(period * 0.08), fade: Math.round(period * 0.11), ...glints };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{label: text default='WOW' label='Label'}} {{shape: int min=0 max=3 default=2 label='Shape (0 burst, 1 heart, 2 star, 3 circle)'}} {{background: color default=#E9E6F5 label='Background'}} {{holo1: color default=#FF9DE2 label='Foil 1'}} {{holo2: color default=#8FE3FF label='Foil 2'}} {{holo3: color default=#FFF3A0 label='Foil 3'}} {{ink: color default=#2E1065 label='Label colour'}} {{border: color default=#FFFFFF label='Border'}} {{speed: float min=1 max=8 default=3 step=0.5 label='Seconds per sweep'}} ${FONT} --><defs><filter id="holoDrop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/></filter><linearGradient id="holoFoil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${HOLO_PERIOD}" y2="0" spreadMethod="repeat" gradientTransform="rotate(35 120 120) translate(0 0)"><stop offset="0" stop-color="{{holo1}}"/><stop offset="0.2" stop-color="#C4B5FD"/><stop offset="0.36" stop-color="{{holo2}}"/><stop offset="0.52" stop-color="#B9FBC0"/><stop offset="0.68" stop-color="{{holo3}}"/><stop offset="0.84" stop-color="#FFC4A3"/><stop offset="1" stop-color="{{holo1}}"/></linearGradient><linearGradient id="holoGrain" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${HOLO_PERIOD / 5}" y2="0" spreadMethod="reflect" gradientTransform="rotate(-50 120 120) translate(0 0)"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="1" stop-color="#6D28D9" stop-opacity="0.12"/></linearGradient><linearGradient id="holoSheenFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><clipPath id="holoFace"><path d="{{d}}"/></clipPath>${gloss("holoGloss")}</defs><rect width="240" height="240" fill="{{background}}"/><path d="{{d}}" fill="{{border}}" stroke="{{border}}" stroke-width="18" stroke-linejoin="round" filter="url(#holoDrop)"/><path d="{{d}}" fill="url(#holoFoil)"/><path d="{{d}}" fill="url(#holoGrain)"/><g clip-path="url(#holoFace)"><rect id="sheen" x="-60" y="-40" width="60" height="320" fill="url(#holoSheenFill)" transform="translate(-80 0) rotate(20 120 120)"/></g><text x="120" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{ink}}" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="1.5" paint-order="stroke">{{label}}</text><path d="{{d}}" fill="url(#holoGloss)"/>${GLINTS.map(
      ([x, y], k) => `<path id="glint${k}" d="${SPARKLE}" fill="#FFFFFF" transform="translate(${x} ${y}) scale(0) rotate(0)"/>`,
    ).join("")}</svg>`,
    animate: [
      // One period along each gradient per loop, so it wraps seamlessly.
      { id: "holoFoil", attrs: { gradientTransform: ["rotate(35 120 120) translate(0 0)", `rotate(35 120 120) translate(${HOLO_PERIOD} 0)`] }, ms: n("period"), ease: "linear" },
      { id: "holoGrain", attrs: { gradientTransform: ["rotate(-50 120 120) translate(0 0)", `rotate(-50 120 120) translate(${-HOLO_PERIOD * 0.4} 0)`] }, ms: n("period"), ease: "linear" },
      { id: "sheen", attrs: { transform: ["translate(-80 0) rotate(20 120 120)", "translate(320 0) rotate(20 120 120)"] }, ms: n("sheen"), ease: "in-out" },
      ...GLINTS.flatMap(([x, y, size], k): SvgAnimation[] => [
        { id: `glint${k}`, attrs: { transform: [`translate(${x} ${y}) scale(0) rotate(0)`, `translate(${x} ${y}) scale(${size}) rotate(45)`] }, delay: n(`g${k}`), ms: n("grow"), ease: "out" },
        { id: `glint${k}`, attrs: { transform: [`translate(${x} ${y}) scale(${size}) rotate(45)`, `translate(${x} ${y}) scale(0) rotate(90)`] }, delay: n(`h${k}`), ms: n("fade"), ease: "in-out" },
      ]),
    ],
  },
};

// ── Sticker sheet ──────────────────────────────────────────────────────

/** The sheet's stickers: [kind, x, y, turn]. */
const SHEET: readonly (readonly ["heart" | "star" | "smile" | "bolt" | "pill" | "burst", number, number, number])[] = [
  ["heart", 86, 80, -10],
  ["star", 178, 76, 8],
  ["smile", 272, 82, -5],
  ["bolt", 84, 168, 12],
  ["pill", 190, 166, -6],
  ["burst", 290, 170, 9],
];
const SHEET_COLOURS = ["{{c1}}", "{{c2}}", "{{c3}}", "{{c4}}", "{{c1}}", "{{c2}}"];

/** A sticker of the sheet, drawn round its own centre. */
function sheetSticker(kind: (typeof SHEET)[number][0], x: number, y: number, colour: string): string {
  const cut = (d: string) => `<path d="${d}" fill="{{border}}" stroke="{{border}}" stroke-width="10" stroke-linejoin="round" filter="url(#sheetDrop)"/><path d="${d}" fill="${colour}"/>`;
  const shine = (d: string) => `<path d="${d}" fill="url(#sheetGloss)"/>`;
  switch (kind) {
    case "heart":
      return cut(heart(x, y, 64)) + shine(heart(x, y, 64));
    case "star":
      return cut(star(x, y, 36, 17)) + shine(star(x, y, 36, 17));
    case "bolt":
      return cut(bolt(x, y, 66)) + shine(bolt(x, y, 66));
    case "burst":
      return cut(burst(x, y, 32, 10, 0.1)) + `<text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${HEAVY}" font-size="16" font-weight="900" fill="{{ink}}">★</text>` + shine(burst(x, y, 32, 10, 0.1));
    case "smile":
      return (
        cut(circle(x, y, 30)) +
        `<circle cx="${x - 10}" cy="${y - 7}" r="4" fill="{{ink}}"/><circle cx="${x + 10}" cy="${y - 7}" r="4" fill="{{ink}}"/><path d="M${x - 15} ${y + 6} Q${x} ${y + 21} ${x + 15} ${y + 6}" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>` +
        shine(circle(x, y, 30))
      );
    case "pill":
      return `<rect x="{{pillX}}" y="${y - 21}" width="{{pillW}}" height="42" rx="21" fill="{{border}}" stroke="{{border}}" stroke-width="10" filter="url(#sheetDrop)"/><rect x="{{pillX}}" y="${y - 21}" width="{{pillW}}" height="42" rx="21" fill="${colour}"/><text x="${x}" y="{{pillBase}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{ink}}">{{label}}</text><rect x="{{pillX}}" y="${y - 21}" width="{{pillW}}" height="42" rx="21" fill="url(#sheetGloss)"/>`;
  }
}

/** When the sheet's stickers pop, and when they all go. */
const POP_GAP = 230;
const SHEET_EXIT = 3300;

export const stickerSheet: VectorEffect = {
  kind: "vector",
  id: "sticker-sheet",
  name: "Sticker sheet",
  description: "A sheet of six little die-cut stickers popping onto the backing one after another, each with its own tilt, like a sticker pack being opened.",
  category: "sticker",
  tags: ["sticker", "pack", "reveal", "stagger", "pop", "die-cut", "collection", "loop"],
  hold: 200,
  presets: [
    { name: "Pastel", values: { c1: [1, 0.7, 0.8], c2: [0.7, 0.85, 1], c3: [1, 0.93, 0.6], c4: [0.75, 0.95, 0.78], ink: [0.25, 0.2, 0.35] } },
    { name: "Night pack", values: { background: [0.08, 0.09, 0.13], sheet: [0.16, 0.17, 0.23], label: "RAD" } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 84, 22);
    const pillW = r1(Math.max(56, length + 30));
    return { size, length, pillW, pillX: r1(190 - pillW / 2), pillBase: r1(166 + size * 0.36) };
  },
  motion: {
    svg: `<svg viewBox="0 0 360 240"><!-- {{label: text default='COOL' label='Label'}} {{background: color default=#DCD6CC label='Background'}} {{sheet: color default=#FBFAF7 label='Sheet'}} {{c1: color default=#FF5D8F label='Colour 1'}} {{c2: color default=#4CC9F0 label='Colour 2'}} {{c3: color default=#FFD23F label='Colour 3'}} {{c4: color default=#7BE495 label='Colour 4'}} {{ink: color default=#1F1A2E label='Ink'}} {{border: color default=#FFFFFF label='Border'}} ${FONT} --><defs><filter id="sheetDrop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.25"/></filter><filter id="sheetPaper" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.18"/></filter>${gloss("sheetGloss")}</defs><rect width="360" height="240" fill="{{background}}"/><rect x="16" y="14" width="328" height="212" rx="14" fill="{{sheet}}" filter="url(#sheetPaper)"/><rect x="26" y="24" width="308" height="192" rx="9" fill="none" stroke="{{ink}}" stroke-opacity="0.08" stroke-width="1.5" stroke-dasharray="4 5"/>${SHEET.map(
      ([kind, x, y, r], i) => `<g id="s${i}" transform="${pose(x, y, 0, r - 30)}" opacity="0">${sheetSticker(kind, x, y, SHEET_COLOURS[i]!)}</g>`,
    ).join("")}</svg>`,
    animate: SHEET.flatMap(([, x, y, r], i): SvgAnimation[] => {
      const at = 150 + i * POP_GAP;
      const out = SHEET_EXIT + i * 40;
      return [
        { id: `s${i}`, attrs: { opacity: [0, 1] }, delay: at, ms: 60 },
        { id: `s${i}`, attrs: { transform: [pose(x, y, 0, r - 30), pose(x, y, 1.18, r + 4)] }, delay: at, ms: 220, ease: "out" },
        { id: `s${i}`, attrs: { transform: [pose(x, y, 1.18, r + 4), pose(x, y, 1, r)] }, delay: at + 220, ms: 180, ease: "in-out" },
        { id: `s${i}`, attrs: { transform: [pose(x, y, 1, r), pose(x, y, 0, r - 30)] }, delay: out, ms: 240, ease: "in-out" },
        { id: `s${i}`, attrs: { opacity: [1, 0] }, delay: out + 160, ms: 80 },
      ];
    }),
  },
};

// ── Stamp badge ────────────────────────────────────────────────────────

/** The stamp's pose round the middle of the page: scaled `sx` by `sy`, turned `r`. */
const stampPose = (sx: number, sy: number, r: number) => pose(160, 100, sx, r, 0, sy);
const STAMP_UP = stampPose(1.8, 1.8, -16);
const FLECKS: readonly Point[] = [[38, 62], [284, 142], [276, 50], [52, 150], [230, 160]];

export const stampBadge: VectorEffect = {
  kind: "vector",
  id: "stamp-badge",
  name: "Stamp badge",
  description: "A rubber stamp that thumps down onto the page with a squash, leaving a tilted badge in grungy, patchy ink; the next click lifts it off again.",
  category: "sticker",
  tags: ["sticker", "stamp", "click", "interactive", "toggle", "approved", "ink", "badge", "grunge"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Rejected", values: { label: "REJECTED", sub: "★ NOT TODAY ★", ink: [0.12, 0.2, 0.62] } },
    { name: "Paid", values: { label: "PAID", sub: "★ THANK YOU ★", ink: [0.1, 0.5, 0.25], roughness: 3, wear: 0.85 } },
  ],
  derived: (v) => {
    const main = fit(v.label, 184, 46);
    const sub = fit(v.sub, 140, 12);
    // Worn ink: the blotchy noise's alpha cut-off, from clean (8.8) to patchy (6.4).
    return { size: main.size, length: main.length, base: r1(112 + main.size * 0.34), subSize: sub.size, subLength: sub.length, worn: r2(8.8 - Number(v.wear) * 2.4) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 200"><!-- {{label: text default='APPROVED' label='Label'}} {{sub: text default='★ OFFICIAL ★' label='Small print'}} {{paper: color default=#FBF8F1 label='Paper'}} {{ink: color default=#C81E1E label='Ink'}} {{roughness: float min=0 max=6 default=1.6 step=0.2 label='Rough edges'}} {{wear: float min=0 max=1 default=0.4 label='Worn ink'}} ${FONT} --><defs><filter id="stampInk" x="-15%" y="-25%" width="130%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="{{roughness}}" xChannelSelector="R" yChannelSelector="G" result="rough"/><feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="3" seed="11" result="blots"/><feColorMatrix in="blots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 0 0 0 {{worn}}" result="worn"/><feComposite in="rough" in2="worn" operator="in"/></filter><filter id="stampBlur" x="-30%" y="-50%" width="160%" height="200%"><feGaussianBlur stdDeviation="10"/></filter></defs><g id="page" transform="translate(0 0)"><rect x="-10" y="-10" width="340" height="220" fill="{{paper}}"/><g fill="#000000" opacity="0.07"><rect x="28" y="24" width="150" height="6" rx="3"/><rect x="28" y="38" width="210" height="4" rx="2"/><rect x="28" y="168" width="230" height="4" rx="2"/><rect x="28" y="178" width="180" height="4" rx="2"/></g></g><ellipse id="hover" cx="160" cy="106" rx="150" ry="70" fill="#000000" opacity="0" filter="url(#stampBlur)"/><g id="stamp" transform="${STAMP_UP}" opacity="0"><g filter="url(#stampInk)" fill="{{ink}}" stroke="{{ink}}"><rect x="46" y="46" width="228" height="108" rx="14" fill="none" stroke-width="7"/><rect x="57" y="57" width="206" height="86" rx="8" fill="none" stroke-width="2.5"/><text x="160" y="82" text-anchor="middle" textLength="{{subLength}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{subSize}}" font-weight="700" stroke="none">{{sub}}</text><text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" stroke="none">{{label}}</text>${FLECKS.map(
      ([x, y], k) => `<circle id="fleck${k}" cx="${x}" cy="${y}" r="${2 + (k % 3)}" stroke="none" opacity="0"/>`,
    ).join("")}</g></g></svg>`,
    animate: [
      // Step 1, stamp: down from above, a hard squash on impact, a little rebound, settled.
      { id: "stamp", step: 1, attrs: { opacity: [0, 0.92] }, ms: 120 },
      { id: "stamp", step: 1, attrs: { transform: [STAMP_UP, stampPose(1.08, 0.86, -8)] }, ms: 170, ease: "linear" },
      { id: "stamp", step: 1, attrs: { transform: [stampPose(1.08, 0.86, -8), stampPose(0.97, 1.04, -8)] }, delay: 170, ms: 120, ease: "out" },
      { id: "stamp", step: 1, attrs: { transform: [stampPose(0.97, 1.04, -8), stampPose(1, 1, -8)] }, delay: 290, ms: 140, ease: "in-out" },
      // The stamp's shadow closing in as it comes down, gone once it lands.
      { id: "hover", step: 1, attrs: { rx: [150, 118], ry: [70, 56], opacity: [0, 0.22] }, ms: 170, ease: "linear" },
      { id: "hover", step: 1, attrs: { opacity: [0.22, 0] }, delay: 170, ms: 60 },
      snap("hover", "rx", 150, 400),
      snap("hover", "ry", 70, 400),
      // The page jolts and ink flecks off.
      { id: "page", step: 1, attrs: { transform: ["translate(0 0)", "translate(0 2.5)"] }, delay: 170, ms: 60, ease: "out" },
      { id: "page", step: 1, attrs: { transform: ["translate(0 2.5)", "translate(0 0)"] }, delay: 230, ms: 140, ease: "in-out" },
      ...FLECKS.map((_, k): SvgAnimation => ({ id: `fleck${k}`, step: 1, attrs: { opacity: [0, 1] }, delay: 170, ms: 40 })),
      // Step 2, lift off: up and away, then back where it started.
      { id: "stamp", step: 2, attrs: { transform: [stampPose(1, 1, -8), stampPose(1.18, 1.18, -4)] }, ms: 280, ease: "out" },
      { id: "stamp", step: 2, attrs: { opacity: [0.92, 0] }, ms: 260 },
      snap("stamp", "transform", STAMP_UP, 300, 2),
      ...FLECKS.map((_, k): SvgAnimation => ({ id: `fleck${k}`, step: 2, attrs: { opacity: [1, 0] }, ms: 200 })),
    ],
  },
};

// ── Washi tape ─────────────────────────────────────────────────────────

const TAPE_L = 344;
const TAPE_W = 46;
/** How far each torn end's points reach in, top to bottom. */
const TORN_LEFT = [3, 0, 5, 1, 4, 0, 6, 2, 3, 0, 4];
const TORN_RIGHT = [1, 5, 0, 4, 2, 6, 1, 3, 0, 5, 2];

/** The tape's outline, along x from 0 to its length, y round 0, with torn ends. */
const TAPE = (() => {
  const h = TAPE_W / 2;
  const at = (k: number) => -h + (k * TAPE_W) / (TORN_LEFT.length - 1);
  const right = TORN_RIGHT.map((dx, k) => [TAPE_L - dx, at(k)] as const);
  const left = TORN_LEFT.map((dx, k) => [dx, at(k)] as const).reverse();
  return outline([...right, ...left]);
})();
const UNROLL_MS = 1500;
const TAPE_OFF = 3000;

export const washiTape: VectorEffect = {
  kind: "vector",
  id: "washi-tape",
  name: "Washi tape",
  description: "A strip of translucent patterned washi tape unrolling across the page from its roll, with torn ends and the paper showing through.",
  category: "sticker",
  tags: ["sticker", "tape", "washi", "scrapbook", "pattern", "craft", "unroll", "loop"],
  hold: 300,
  presets: [
    { name: "Mint dots", values: { tape: [0.66, 0.9, 0.82], stripe: [0.45, 0.78, 0.7], dot: [1, 1, 1], stripes: false, dots: true } },
    { name: "Kraft", values: { tape: [0.8, 0.65, 0.45], stripe: [0.55, 0.38, 0.22], dot: [0.98, 0.95, 0.88], alpha: 0.95, stripes: true, dots: false } },
    { name: "Candy stripe", values: { tape: [1, 1, 1], stripe: [0.95, 0.3, 0.4], dot: [0.95, 0.3, 0.4], alpha: 0.75 } },
  ],
  derived: (v) => ({ stripesOn: v.stripes ? 1 : 0, dotsOn: v.dots ? 1 : 0 }),
  motion: {
    svg: `<svg viewBox="0 0 400 200"><!-- {{background: color default=#F6F1E7 label='Paper'}} {{tape: color default=#F9C6D3 label='Tape'}} {{stripe: color default=#F48FB1 label='Stripes'}} {{dot: color default=#FFFFFF label='Dots'}} {{alpha: float min=0.3 max=1 default=0.82 label='Opacity'}} {{stripes: bool default=true label='Stripes'}} {{dots: bool default=true label='Dots'}} --><defs><pattern id="washiStripeFill" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)"><rect width="6" height="14" fill="{{stripe}}"/></pattern><pattern id="washiDotFill" patternUnits="userSpaceOnUse" width="16" height="16"><circle cx="4" cy="4" r="2.4" fill="{{dot}}"/><circle cx="12" cy="12" r="2.4" fill="{{dot}}"/></pattern><filter id="washiFiber" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.05" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.7 0 0 0 -0.25"/><feComposite in2="SourceGraphic" operator="in"/></filter><filter id="washiFlat" x="-5%" y="-30%" width="110%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.18"/></filter><filter id="washiRollShadow" x="-100%" y="-30%" width="300%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/></filter><linearGradient id="washiCurve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.28"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="1" stop-color="#000000" stop-opacity="0.35"/></linearGradient><clipPath id="washiUnrolled"><rect id="reveal" x="-4" y="-40" width="0" height="80"/></clipPath></defs><rect width="400" height="200" fill="{{background}}"/><g fill="#000000" opacity="0.1"><rect x="36" y="38" width="210" height="5" rx="2.5"/><rect x="36" y="52" width="160" height="5" rx="2.5"/><rect x="150" y="146" width="214" height="5" rx="2.5"/><rect x="150" y="160" width="170" height="5" rx="2.5"/></g><g transform="translate(28 106) rotate(-5)"><g id="tape"><g clip-path="url(#washiUnrolled)" filter="url(#washiFlat)"><g opacity="{{alpha}}"><path d="${TAPE}" fill="{{tape}}"/><path d="${TAPE}" fill="url(#washiStripeFill)" opacity="{{stripesOn}}"/><path d="${TAPE}" fill="url(#washiDotFill)" opacity="{{dotsOn}}"/><path d="${TAPE}" fill="#FFFFFF" filter="url(#washiFiber)"/></g><path d="M0 ${-TAPE_W / 2 + 1} H${TAPE_L}" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="1.2"/></g><g id="roll" transform="translate(0 0)" opacity="1"><g filter="url(#washiRollShadow)"><rect x="-6" y="${-TAPE_W / 2 - 4}" width="14" height="${TAPE_W + 8}" rx="6" fill="{{tape}}"/><rect x="-6" y="${-TAPE_W / 2 - 4}" width="14" height="${TAPE_W + 8}" rx="6" fill="url(#washiStripeFill)" opacity="{{stripesOn}}"/><rect x="-6" y="${-TAPE_W / 2 - 4}" width="14" height="${TAPE_W + 8}" rx="6" fill="url(#washiCurve)"/></g></g></g></g></svg>`,
    animate: [
      { id: "reveal", attrs: { width: [0, TAPE_L + 8] }, ms: UNROLL_MS, ease: "in-out" },
      { id: "roll", attrs: { transform: ["translate(0 0)", `translate(${TAPE_L} 0)`] }, ms: UNROLL_MS, ease: "in-out" },
      // The roll lifts away once it reaches the end, which tears clean.
      { id: "roll", attrs: { opacity: [1, 0] }, delay: UNROLL_MS, ms: 250 },
      { id: "tape", attrs: { opacity: [1, 0] }, delay: TAPE_OFF, ms: 400 },
    ],
  },
};

// ── Seal badge ─────────────────────────────────────────────────────────

/** A seal's outline round (120, 120): rounded scallops, or sharp points with `sharp`. */
function sealOutline(points: unknown, sharp: unknown): string {
  const count = Math.max(6, Math.round(Number(points)));
  if (sharp) return star(120, 120, 90, 79, count);
  const samples = Math.max(112, count * 8);
  return outline(
    Array.from({ length: samples }, (_, k) => {
      const a = (k / samples) * Math.PI * 2 - Math.PI / 2;
      const rr = 88 * (0.93 + 0.07 * Math.cos(a * count + Math.PI / 2 * count));
      return [120 + rr * Math.cos(a), 120 + rr * Math.sin(a)] as const;
    }),
  );
}

/** When each pulse comes, as a fraction of a turn, and its scale keyframes `[ms after, scale]`. */
const SEAL_PULSES = [0.22, 0.68];
const SEAL_BEAT: readonly (readonly [number, number])[] = [
  [0, 1],
  [170, 1.12],
  [320, 0.96],
  [460, 1],
];
const SEAL_GLINT_MS = 560;

export const sealBadge: VectorEffect = {
  kind: "vector",
  id: "seal-badge",
  name: "Seal badge",
  description: "A scalloped seal sticker (a \"NEW\" or \"UPDATE LIVE\" price-tag burst) turning slowly under upright one- or two-line text, pulsing now and then as a glint sweeps across its face.",
  category: "sticker",
  tags: ["sticker", "seal", "badge", "burst", "price-tag", "label", "spin", "new", "loop"],
  hold: 0,
  presets: [
    { name: "New", values: { top: "NEW", bottom: "", seal: [0.98, 0.8, 0.12], ink: [0.25, 0.13, 0.01], points: 16 } },
    { name: "Sale", values: { top: "50%", bottom: "OFF", seal: [0.93, 0.16, 0.24], sharp: true, points: 28, turn: 8 } },
    { name: "Mint", values: { top: "JUST", bottom: "LAUNCHED", seal: [0.2, 0.83, 0.6], ink: [0.03, 0.2, 0.14], background: [0.09, 0.1, 0.13], border: [0.95, 0.97, 0.96] } },
  ],
  derived: (v) => {
    const period = Math.round(Number(v.turn) * 1000);
    const d = sealOutline(v.points, v.sharp);
    const two = String(v.bottom).trim() !== "";
    const top = fit(v.top, two ? 118 : 124, two ? 36 : 46);
    const bottom = two ? fit(v.bottom, 104, 30) : { size: 0, length: 0 };
    const gap = two ? 4 : 0;
    const height = top.size + gap + bottom.size;
    const topMid = 120 - height / 2 + top.size / 2;
    const bottomMid = topMid + top.size / 2 + gap + bottom.size / 2;
    const beats = Object.fromEntries(
      SEAL_PULSES.flatMap((f, i) => {
        const at = Math.round(period * f);
        return [...SEAL_BEAT.map(([ms], j) => [`beat${i}_${j}`, at + ms] as const), [`glint${i}`, at + 60] as const];
      }),
    );
    return {
      period,
      d,
      topSize: top.size,
      topLength: top.length,
      topBase: r1(topMid + top.size * 0.36),
      bottomSize: Math.max(1, bottom.size),
      bottomLength: Math.max(1, bottom.length),
      bottomBase: r1(bottomMid + bottom.size * 0.36),
      ...beats,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{top: text default='UPDATE' label='Top line'}} {{bottom: text default='LIVE' label='Bottom line (may be empty)'}} {{background: color default=#F3EFE6 label='Background'}} {{seal: color default=#FF3D6E label='Seal'}} {{ink: color default=#FFFFFF label='Text colour'}} {{border: color default=#FFFFFF label='Border'}} {{points: int min=8 max=40 default=20 label='Points'}} {{sharp: bool default=false label='Sharp points'}} {{turn: float min=3 max=40 default=14 step=0.5 label='Spin (seconds per turn)'}} ${FONT} --><defs><filter id="sealBadgeSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>${gloss("sealBadgeGloss")}<linearGradient id="sealBadgeGlintFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.65"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><clipPath id="sealBadgeClip"><path id="sealClipShape" d="{{d}}" transform="rotate(0 120 120)"/></clipPath></defs><rect width="240" height="240" fill="{{background}}"/><g id="sealPulse" transform="${pose(120, 120, 1, 0)}"><circle cx="120" cy="127" r="92" fill="#000000" opacity="0.28" filter="url(#sealBadgeSoft)"/><g id="sealSpin" transform="rotate(0 120 120)"><path d="{{d}}" fill="{{border}}" stroke="{{border}}" stroke-width="10" stroke-linejoin="round"/><path d="{{d}}" fill="{{seal}}"/><circle cx="120" cy="120" r="70" fill="none" stroke="{{ink}}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="1.5 5.5" stroke-linecap="round"/><circle cx="120" cy="120" r="63" fill="none" stroke="{{ink}}" stroke-opacity="0.3" stroke-width="1.2"/></g><g clip-path="url(#sealBadgeClip)"><rect width="240" height="240" fill="url(#sealBadgeGloss)"/><rect id="sealGlint" x="0" y="20" width="40" height="200" fill="url(#sealBadgeGlintFill)" transform="translate(-14 0) skewX(-20)"/></g><g font-family="{{font}}" font-weight="900" fill="{{ink}}" text-anchor="middle"><text x="120" y="{{topBase}}" textLength="{{topLength}}" lengthAdjust="spacingAndGlyphs" font-size="{{topSize}}">{{top}}</text><text x="120" y="{{bottomBase}}" textLength="{{bottomLength}}" lengthAdjust="spacingAndGlyphs" font-size="{{bottomSize}}">{{bottom}}</text></g></g></svg>`,
    animate: [
      // One whole turn a loop, the clip turning with it so the shine stays on the seal.
      ...["sealSpin", "sealClipShape"].map((id): SvgAnimation => ({ id, attrs: { transform: ["rotate(0 120 120)", "rotate(360 120 120)"] }, ms: n("period"), ease: "linear" })),
      // Now and then it pulses and a glint sweeps across.
      ...SEAL_PULSES.flatMap((_, i): SvgAnimation[] => [
        ...SEAL_BEAT.slice(1).map(([at, scale], j): SvgAnimation => ({
          id: "sealPulse",
          attrs: { transform: [pose(120, 120, SEAL_BEAT[j]![1], 0), pose(120, 120, scale, 0)] },
          delay: n(`beat${i}_${j}`),
          ms: at - SEAL_BEAT[j]![0],
          ease: j === 0 ? "out" : "in-out",
        })),
        { id: "sealGlint", attrs: { transform: ["translate(-14 0) skewX(-20)", "translate(300 0) skewX(-20)"] }, delay: n(`glint${i}`), ms: SEAL_GLINT_MS, ease: "in-out" },
      ]),
    ],
  },
};

/** Stickers: slapped on, peeled, holographic, stamped and sealed. */
export const stickerEffects: VectorEffect[] = [stickerSlap, stickerPeel, holoSticker, stickerSheet, stampBadge, washiTape, sealBadge];
