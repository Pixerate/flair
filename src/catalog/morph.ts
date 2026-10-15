import { morphPaths, morphSequence } from "../vector/morph.js";
import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Morph effects blend shapes point by point: `morphPaths` and
 * `morphSequence` give paths one structure, so `attrs: { d: [a, b] }`
 * blends them. Shapes are drawn with `fill-rule="evenodd"`, since a piece's
 * direction can change, and pieces with no partner grow from or shrink to a
 * point.
 */

type Point = [number, number];

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const DEG = Math.PI / 180;

const r2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** A path's numbers in pairs, in order (for paths of absolute M, L and C, like morph output). */
const pointsOf = (d: string): Point[] => {
  const nums = (d.match(NUMBER) ?? []).map(Number);
  return Array.from({ length: nums.length >> 1 }, (_, i) => [nums[2 * i]!, nums[2 * i + 1]!]);
};

/** A path (absolute M, L and C only) with every point moved by `f`. */
function mapPath(d: string, f: (p: Point) => Point): string {
  const moved = pointsOf(d).map(f);
  let i = 0;
  return d.replace(NUMBER, () => {
    const k = i++;
    return String(r2(moved[k >> 1]![k % 2]!));
  });
}

const polyline = (pts: readonly Point[], close = false) =>
  `M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join(" L")}${close ? " Z" : ""}`;

/** Points round an ellipse between two angles in degrees (0 is right, 90 down), both ends included. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, every = 8): Point[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / every));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const a = (from + ((to - from) * k) / steps) * DEG;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

const circle = (cx: number, cy: number, r: number) => polyline(arc(cx, cy, r, r, 0, 360).slice(0, -1), true);

/** A regular star (or polygon, with `inner` equal to `outer`) of `tips` points, the first straight up. */
const star = (cx: number, cy: number, tips: number, outer: number, inner: number) =>
  polyline(
    Array.from({ length: tips * 2 }, (_, k): Point => {
      const r = k % 2 ? inner : outer;
      const a = (-90 + (k * 180) / tips) * DEG;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
    true,
  );

/**
 * A stroke along `pts` written as a filled outline `width` wide, so it morphs
 * as a shape: mitred corners, and round ends unless `flat` names an end.
 */
function stroke(pts: readonly Point[], width: number, flat: { start?: boolean; end?: boolean } = {}): string {
  const h = width / 2;
  const normals = pts.slice(1).map((p, i): Point => {
    const q = pts[i]!;
    const l = Math.hypot(p[0] - q[0], p[1] - q[1]);
    return [-(p[1] - q[1]) / l, (p[0] - q[0]) / l];
  });
  // Each corner's offset: along the two sides' mean normal, long enough to keep the width (a mitre).
  const offsets = pts.map((_, i): Point => {
    const a = normals[Math.max(0, i - 1)]!;
    const b = normals[Math.min(normals.length - 1, i)]!;
    const l = Math.hypot(a[0] + b[0], a[1] + b[1]);
    const m: Point = [(a[0] + b[0]) / l, (a[1] + b[1]) / l];
    const k = h / (m[0] * b[0] + m[1] * b[1]);
    return [m[0] * k, m[1] * k];
  });
  const left = pts.map((p, i): Point => [p[0] + offsets[i]![0], p[1] + offsets[i]![1]]);
  const right = pts.map((p, i): Point => [p[0] - offsets[i]![0], p[1] - offsets[i]![1]]).reverse();
  const angle = (v: Point) => Math.atan2(v[1], v[0]) / DEG;
  const [first, last] = [pts[0]!, pts[pts.length - 1]!];
  const endAt = angle(normals[normals.length - 1]!);
  const startAt = angle(normals[0]!) + 180;
  const endCap = flat.end ? [] : arc(last[0], last[1], h, h, endAt, endAt - 180, 15).slice(1, -1);
  const startCap = flat.start ? [] : arc(first[0], first[1], h, h, startAt, startAt - 180, 15).slice(1, -1);
  return polyline([...left, ...endCap, ...right, ...startCap], true);
}

/** Points round a circle from one angle to another, going the way that misses `avoid`. */
function around(c: Point, r: number, from: number, to: number, avoid: number): Point[] {
  let delta = (((to - from) % 360) + 360) % 360;
  if ((((avoid - from) % 360) + 360) % 360 < delta) delta -= 360;
  return arc(c[0], c[1], r, r, from, from + delta);
}

/** The part of one circle outside another: a crescent moon. */
function crescent(c1: Point, r1: number, c2: Point, r2_: number): string {
  const [dx, dy] = [c2[0] - c1[0], c2[1] - c1[1]];
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2_ * r2_ + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const [px, py] = [c1[0] + (a * dx) / d, c1[1] + (a * dy) / d];
  const i1: Point = [px - (h * dy) / d, py + (h * dx) / d];
  const i2: Point = [px + (h * dy) / d, py - (h * dx) / d];
  const angle = (c: Point, p: Point) => Math.atan2(p[1] - c[1], p[0] - c[0]) / DEG;
  // The long way round the moon (away from the cut), then back round the cut, inside the moon.
  const outer = around(c1, r1, angle(c1, i1), angle(c1, i2), angle(c1, c2));
  const inner = around(c2, r2_, angle(c2, i2), angle(c2, i1), angle(c2, c1) + 180);
  return polyline([...outer, ...inner.slice(1, -1)], true);
}

/** A heart in a 24 box, curves and all. */
const HEART = "M12 20.5 C12 20.5 3 14.8 3 8.8 C3 6 5.2 3.8 8 3.8 C9.7 3.8 11.2 4.7 12 6.1 C12.8 4.7 14.3 3.8 16 3.8 C18.8 3.8 21 6 21 8.8 C21 14.8 12 20.5 12 20.5 Z";

/** A path scaled by `s` about (12, 12) and moved to (`cx`, `cy`). */
const placed = (d: string, cx: number, cy: number, s: number) => mapPath(d, (p) => [cx + (p[0] - 12) * s, cy + (p[1] - 12) * s]);

/**
 * Any path as one closed outline per piece (see `morphSequence`), scaled
 * and centred to fill `box` ([x, y, width, height]), so paths drawn in any
 * coordinates land in the picture. Throws a sentence on a path it cannot read.
 */
function fitted(d: string, box: readonly [number, number, number, number], points: number): string {
  const outline = morphSequence([d], { points })[0]!;
  const pts = pointsOf(outline);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  const s = Math.min(box[2] / Math.max(w, 1e-6), box[3] / Math.max(h, 1e-6));
  const [ox, oy] = [box[0] + (box[2] - w * s) / 2, box[1] + (box[3] - h * s) / 2];
  return mapPath(outline, (p) => [ox + (p[0] - x0) * s, oy + (p[1] - y0) * s]);
}

/** A user's path fitted to `box`, or `fallback` fitted when it cannot be read, so the effect still draws. */
function fittedOr(d: unknown, fallback: string, box: readonly [number, number, number, number], points: number): string {
  try {
    return fitted(String(d), box, points);
  } catch {
    return fitted(fallback, box, points);
  }
}

// ── Shape morph ────────────────────────────────────────────────────────

const SHAPE_FROM = "M30 12 H70 A18 18 0 0 1 88 30 V70 A18 18 0 0 1 70 88 H30 A18 18 0 0 1 12 70 V30 A18 18 0 0 1 30 12 Z";
const SHAPE_TO = "M50 6 L61 38 L95 38 L67 58 L78 92 L50 72 L22 92 L33 58 L5 38 L39 38 Z";

export const shapeMorph: VectorEffect = {
  kind: "vector",
  id: "shape-morph",
  name: "Shape morph",
  description: "Any two SVG paths morphing into each other and back, their fill and outline colours blending along.",
  category: "morph",
  tags: ["morph", "shape", "path", "icon", "logo"],
  hold: 0,
  presets: [
    { name: "Ink", values: { background: [0.98, 0.97, 0.94], fillFrom: [0.1, 0.1, 0.12], fillTo: [0.1, 0.1, 0.12], strokeFrom: [0.1, 0.1, 0.12], strokeTo: [0.1, 0.1, 0.12], width: 0 } },
    {
      name: "Heart to drop",
      values: {
        from: "M12 20.5 C12 20.5 3 14.8 3 8.8 C3 6 5.2 3.8 8 3.8 C9.7 3.8 11.2 4.7 12 6.1 C12.8 4.7 14.3 3.8 16 3.8 C18.8 3.8 21 6 21 8.8 C21 14.8 12 20.5 12 20.5 Z",
        to: "M12 2 C12 2 5 10 5 15 A7 7 0 0 0 19 15 C19 10 12 2 12 2 Z",
        fillFrom: [0.96, 0.25, 0.37],
        fillTo: [0.22, 0.6, 0.97],
      },
    },
    { name: "Outline", values: { fillFrom: [0.06, 0.09, 0.16], fillTo: [0.06, 0.09, 0.16], strokeFrom: [0.2, 0.83, 0.6], strokeTo: [0.98, 0.8, 0.08], width: 2.5 } },
  ],
  // Each path is fitted to the picture on its own, so paths in any coordinates fill it.
  derived: (v) => {
    const [a, b] = morphPaths(fittedOr(v.from, SHAPE_FROM, [12, 12, 76, 76], 96), fittedOr(v.to, SHAPE_TO, [12, 12, 76, 76], 96), { points: 80 });
    return { a, b, back: Number(v.pause) * 2 + Number(v.morph) };
  },
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{from: text default='${SHAPE_FROM}' label='From path'}} {{to: text default='${SHAPE_TO}' label='To path'}} {{fillFrom: color default=#6366F1 label='Fill (from)'}} {{fillTo: color default=#F59E0B label='Fill (to)'}} {{strokeFrom: color default=#C7D2FE label='Outline (from)'}} {{strokeTo: color default=#FEF3C7 label='Outline (to)'}} {{background: color default=#0F172A label='Background'}} {{width: float min=0 max=6 default=1.5 step=0.25 label='Outline width'}} {{morph: float min=200 max=3000 default=1000 step=50 label='Morph ms'}} {{pause: float min=0 max=3000 default=700 step=50 label='Pause ms'}} --><rect width="100" height="100" fill="{{background}}"/><path id="shape" d="{{a}}" fill="{{fillFrom}}" fill-rule="evenodd" stroke="{{strokeFrom}}" stroke-width="{{width}}" stroke-linejoin="round"/></svg>`,
    animate: [
      { id: "shape", attrs: { d: ["{{a}}", "{{b}}"], fill: ["{{fillFrom}}", "{{fillTo}}"], stroke: ["{{strokeFrom}}", "{{strokeTo}}"] }, delay: n("pause"), ms: n("morph"), ease: "in-out" },
      { id: "shape", attrs: { d: ["{{b}}", "{{a}}"], fill: ["{{fillTo}}", "{{fillFrom}}"], stroke: ["{{strokeTo}}", "{{strokeFrom}}"] }, delay: n("back"), ms: n("morph"), ease: "in-out" },
    ],
  },
};

// ── Icon toggle ────────────────────────────────────────────────────────

/** Stroke width of the line icons, in their 24 box. */
const LINE = 2.4;

/**
 * Icon pairs in a 24 box, every stroke written as a filled outline so it
 * morphs as a shape. Pieces are laid out to pair up: play's two halves
 * become pause's bars, menu's bars the three strokes of the close cross
 * (which is cut so its strokes do not overlap), the sun's rays shrink away.
 */
const ICON_PAIRS: readonly (readonly [string, string])[] = (() => {
  const c = 12;
  // The close cross: one whole diagonal, and the other cut in two where it meets it.
  const meet = LINE / 2 / Math.SQRT2;
  const sun = [circle(c, c, 4.6), ...Array.from({ length: 8 }, (_, k) => {
    const a = k * 45 * DEG;
    return stroke([[c + 7.6 * Math.cos(a), c + 7.6 * Math.sin(a)], [c + 10 * Math.cos(a), c + 10 * Math.sin(a)]], 2);
  })];
  return [
    [
      "M7.5 4.5 L13.5 8.32 L13.5 15.68 L7.5 19.5 Z M13.5 8.32 L19.3 12 L13.5 15.68 Z",
      [stroke([[8.5, 6.5], [8.5, 17.5]], 3.6), stroke([[15.5, 6.5], [15.5, 17.5]], 3.6)].join(" "),
    ],
    [
      [7, 12, 17].map((y) => stroke([[5, y], [19, y]], LINE)).join(" "),
      [
        stroke([[6.5, 6.5], [17.5, 17.5]], LINE),
        stroke([[17.5, 6.5], [c + meet, c - meet]], LINE, { end: true }),
        stroke([[6.5, 17.5], [c - meet, c + meet]], LINE, { end: true }),
      ].join(" "),
    ],
    ["M10.7 5 H13.3 V10.7 H19 V13.3 H13.3 V19 H10.7 V13.3 H5 V10.7 H10.7 Z", stroke([[5, 12.5], [10, 17.5], [19, 7]], 2.6)],
    [sun.join(" "), crescent([11.5, 12.5], 8.5, [16.5, 7.5], 7)],
    [`${HEART} ${placed(HEART, 12, 12, 0.7)}`, HEART],
  ];
})();

const iconMorphs = new Map<number, [string, string]>();

/** A pair's two icons morphed to one structure, worked out once. */
function iconMorph(pair: number): [string, string] {
  if (!iconMorphs.has(pair)) iconMorphs.set(pair, morphPaths(...ICON_PAIRS[pair]!, { points: 64 }));
  return iconMorphs.get(pair)!;
}

/** The icon group's transform: centred in the button, turned and scaled. */
const pose = (turn: number, scale: number) => `translate(60 60) rotate(${turn}) scale(${scale}) translate(-12 -12)`;

/** One toggle at `at` ms: the icon morphs while it dips, turns and pops back, and the button changes colour. */
const toggle = (at: number, d: [string, string], fill: [string, string], turn: number): SvgAnimation[] => [
  { id: "glyph", attrs: { d }, delay: at, ms: 420, ease: "in-out" },
  { id: "icon", attrs: { transform: [pose(0, 2.6), pose(turn, 2.15)] }, delay: at, ms: 170, ease: "out" },
  { id: "icon", attrs: { transform: [pose(turn, 2.15), pose(-turn * 0.3, 2.85)] }, delay: at + 170, ms: 190, ease: "in-out" },
  { id: "icon", attrs: { transform: [pose(-turn * 0.3, 2.85), pose(0, 2.6)] }, delay: at + 360, ms: 260, ease: "in-out" },
  { id: "button", attrs: { fill }, delay: at, ms: 320, ease: "in-out" },
];

export const iconToggle: VectorEffect = {
  kind: "vector",
  id: "icon-toggle",
  name: "Icon toggle",
  description: "A round button whose icon morphs between two states (play and pause, menu and close, sun and moon) with a little pop.",
  category: "morph",
  tags: ["morph", "icon", "ui", "button", "toggle", "micro-interaction"],
  hold: 700,
  presets: [
    { name: "Play / pause", values: { pair: 0 } },
    { name: "Menu / close", values: { pair: 1, off: [0.98, 0.98, 0.98], on: [0.07, 0.07, 0.09], ink: [0.4, 0.4, 0.45], page: [0.9, 0.91, 0.93] } },
    { name: "Plus / check", values: { pair: 2, on: [0.13, 0.77, 0.37] } },
    { name: "Day / night", values: { pair: 3, off: [0.98, 0.75, 0.14], on: [0.19, 0.18, 0.5], page: [0.06, 0.07, 0.15] } },
    { name: "Like", values: { pair: 4, off: [0.12, 0.12, 0.14], on: [0.94, 0.27, 0.4] } },
  ],
  derived: (v) => {
    const [a, b] = iconMorph(Math.min(ICON_PAIRS.length - 1, Math.max(0, Math.round(Number(v.pair)) || 0)));
    return { a, b };
  },
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{pair: int min=0 max=4 default=0 label='Icons (play, menu, plus, sun, heart)'}} {{ink: color default=#FFFFFF label='Icon'}} {{off: color default=#334155 label='Button'}} {{on: color default=#6366F1 label='Button (on)'}} {{page: color default=#0B1020 label='Background'}} --><rect width="120" height="120" fill="{{page}}"/><circle id="button" cx="60" cy="60" r="44" fill="{{off}}"/><g id="icon" transform="${pose(0, 2.6)}"><path id="glyph" d="{{a}}" fill="{{ink}}" fill-rule="evenodd" stroke="{{ink}}" stroke-width="0.3" stroke-linejoin="round"/></g></svg>`,
    animate: [...toggle(500, ["{{a}}", "{{b}}"], ["{{off}}", "{{on}}"], -16), ...toggle(2100, ["{{b}}", "{{a}}"], ["{{on}}", "{{off}}"], 16)],
  },
};

// ── Morph sequence ─────────────────────────────────────────────────────

/** Circle, star, heart and hexagon, in a 200 box. */
const SEQUENCE = morphSequence(
  [circle(100, 100, 72), star(100, 104, 5, 82, 36), placed(HEART, 100, 98, 8.4), star(100, 100, 3, 78, 78)],
  { points: 96 },
);

export const morphSequenceEffect: VectorEffect = {
  kind: "vector",
  id: "morph-sequence",
  name: "Morph sequence",
  description: "One shape flowing from circle to star to heart to hexagon and round again, its colour changing with each.",
  category: "morph",
  tags: ["morph", "shape", "loop", "background", "playful"],
  hold: 0,
  presets: [
    { name: "Pastel", values: { background: [0.99, 0.97, 0.94], c0: [0.65, 0.84, 0.98], c1: [0.99, 0.85, 0.55], c2: [0.98, 0.65, 0.7], c3: [0.75, 0.7, 0.98] } },
    { name: "Mono", values: { background: [0.04, 0.04, 0.05], c0: [0.95, 0.95, 0.95], c1: [0.95, 0.95, 0.95], c2: [0.95, 0.95, 0.95], c3: [0.95, 0.95, 0.95], morph: 600, pause: 300 } },
  ],
  derived: (v) => {
    const each = Number(v.morph) + Number(v.pause);
    return Object.fromEntries(SEQUENCE.map((_, i) => [`at${i}`, Number(v.pause) + i * each]));
  },
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{c0: color default=#38BDF8 label='Circle'}} {{c1: color default=#FACC15 label='Star'}} {{c2: color default=#F43F5E label='Heart'}} {{c3: color default=#A78BFA label='Hexagon'}} {{background: color default=#0F172A label='Background'}} {{morph: float min=200 max=3000 default=900 step=50 label='Morph ms'}} {{pause: float min=0 max=3000 default=500 step=50 label='Pause ms'}} --><rect width="200" height="200" fill="{{background}}"/><path id="shape" d="${SEQUENCE[0]}" fill="{{c0}}" fill-rule="evenodd"/></svg>`,
    animate: SEQUENCE.map((d, i): SvgAnimation => {
      const next = (i + 1) % SEQUENCE.length;
      return { id: "shape", attrs: { d: [d, SEQUENCE[next]!], fill: [`{{c${i}}}`, `{{c${next}}}`] }, delay: n(`at${i}`), ms: n("morph"), ease: "in-out" };
    }),
  },
};

// ── Gooey morph ────────────────────────────────────────────────────────

/**
 * A cluster of drops, a star whose arms reach where the drops were, and two
 * blobs, in a 200 box. Each piece is its own path (overlapping pieces in one
 * evenodd path would cut holes), and the goo filter melts them together.
 */
const GOO = (() => {
  const cluster = [
    circle(100, 100, 25),
    ...Array.from({ length: 5 }, (_, k) => circle(100 + 56 * Math.cos((-90 + 72 * k) * DEG), 100 + 56 * Math.sin((-90 + 72 * k) * DEG), 15)),
  ].join(" ");
  const blobStar = polyline(
    arc(100, 100, 1, 1, -90, 270, 4).slice(0, -1).map((p): Point => {
      const a = Math.atan2(p[1] - 100, p[0] - 100);
      const r = 50 + 20 * Math.cos(5 * (a + Math.PI / 2));
      return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
    }),
    true,
  );
  const pair = `${circle(63, 100, 35)} ${circle(137, 100, 35)}`;
  // Each stage's pieces, one path each.
  const stages = morphSequence([cluster, blobStar, pair], { points: 64 }).map((d) => d.split(/ (?=M)/));
  return stages[0]!.map((_, piece) => stages.map((stage) => stage[piece]!));
})();

export const gooeyMorph: VectorEffect = {
  kind: "vector",
  id: "gooey-morph",
  name: "Gooey morph",
  description: "A cluster of liquid drops melting into a star, splitting into two blobs and beading back into drops.",
  category: "morph",
  tags: ["morph", "gooey", "liquid", "metaball", "blob", "loop"],
  hold: 0,
  presets: [
    { name: "Lava", values: { colorA: [1, 0.85, 0.2], colorB: [0.95, 0.2, 0.1], background: [0.1, 0.02, 0.02] } },
    { name: "Slime", values: { colorA: [0.75, 1, 0.3], colorB: [0.1, 0.7, 0.35], background: [0.03, 0.08, 0.05], goo: 9 } },
    { name: "Ink", values: { colorA: [0.1, 0.1, 0.12], colorB: [0.1, 0.1, 0.12], background: [0.97, 0.96, 0.93] } },
  ],
  derived: (v) => {
    const each = Number(v.morph) + Number(v.pause);
    return { ...Object.fromEntries(GOO[0]!.map((_, i) => [`at${i}`, Number(v.pause) + i * each])), threshold: -0.5 * Number(v.sharp) };
  },
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{colorA: color default=#22D3EE label='Colour A'}} {{colorB: color default=#A855F7 label='Colour B'}} {{background: color default=#0B0B1A label='Background'}} {{goo: float min=1 max=14 default=7 step=0.5 label='Gooeyness'}} {{sharp: float min=8 max=40 default=20 step=1 label='Edge sharpness'}} {{morph: float min=300 max=3000 default=1200 step=50 label='Morph ms'}} {{pause: float min=0 max=3000 default=400 step=50 label='Pause ms'}} --><defs><linearGradient id="gooFill" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="170" y2="170"><stop offset="0" stop-color="{{colorA}}"/><stop offset="1" stop-color="{{colorB}}"/></linearGradient><filter id="goo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="{{goo}}" result="soft"/><feColorMatrix in="soft" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 {{sharp}} {{threshold}}"/></filter></defs><rect width="200" height="200" fill="{{background}}"/><g filter="url(#goo)" fill="url(#gooFill)">${GOO.map((stages, i) => `<path id="goo${i}" d="${stages[0]}" fill-rule="evenodd"/>`).join("")}</g></svg>`,
    animate: GOO.flatMap((stages, i) =>
      stages.map((d, s): SvgAnimation => ({ id: `goo${i}`, attrs: { d: [d, stages[(s + 1) % stages.length]!] }, delay: n(`at${s}`), ms: n("morph"), ease: "in-out" })),
    ),
  },
};

// ── Particle morph ─────────────────────────────────────────────────────

/** Particle morph's dots: one element each, whatever the shapes. */
const DOTS = 48;
/** Ms between one dot setting off and the next. */
const DOT_STAGGER = 14;
const PARTICLE_FROM = HEART;
const PARTICLE_TO = star(12, 12, 5, 10, 4.2);

/** A repeatable 0–1 number for dot `i`. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

export const particleMorph: VectorEffect = {
  kind: "vector",
  id: "particle-morph",
  name: "Particle morph",
  description: "A shape bursting into dots along its outline that swirl across and settle into a second shape, then back.",
  category: "morph",
  tags: ["morph", "particles", "dots", "shape", "logo", "reveal"],
  hold: 600,
  presets: [
    { name: "Confetti", values: { background: [1, 0.98, 0.95], fromColor: [0.93, 0.27, 0.6], toColor: [0.15, 0.55, 0.95], ghost: 0.1, size: 3.2 } },
    { name: "Embers", values: { background: [0.05, 0.02, 0.02], fromColor: [1, 0.85, 0.3], toColor: [1, 0.3, 0.1], scatter: 50, size: 2 } },
    { name: "Circle to square", values: { from: "M12 2 A10 10 0 1 1 12 22 A10 10 0 1 1 12 2 Z", to: "M3 3 H21 V21 H3 Z" } },
  ],
  // The dots sit on the morphed outlines: point k of one shape flies to point k of the other.
  derived: (v) => {
    const box = [40, 40, 120, 120] as const;
    const [a, b] = morphPaths(fittedOr(v.from, PARTICLE_FROM, box, 96), fittedOr(v.to, PARTICLE_TO, box, 96), { points: DOTS });
    const [pa, pb] = [pointsOf(a), pointsOf(b)];
    const out: Record<string, string | number> = { a, b };
    const scatter = Number(v.scatter);
    for (let i = 0; i < DOTS; i++) {
      // The same share of the outline in shapes of several pieces.
      const k = Math.floor((i * pa.length) / DOTS);
      const [p, q] = [pa[k]!, pb[k]!];
      out[`ax${i}`] = r2(p[0]);
      out[`ay${i}`] = r2(p[1]);
      out[`bx${i}`] = r2(q[0]);
      out[`by${i}`] = r2(q[1]);
      // Halfway, thrown off to one side: a different way out and back.
      for (const [name, seed] of [["s", i], ["t", i + DOTS]] as const) {
        const angle = seed * 2.39996;
        const far = scatter * (0.45 + 0.55 * noise(seed));
        out[`${name}x${i}`] = r2((p[0] + q[0]) / 2 + far * Math.cos(angle));
        out[`${name}y${i}`] = r2((p[1] + q[1]) / 2 + far * Math.sin(angle));
      }
    }
    return out;
  },
  motion: (() => {
    const back = 3000;
    const spread = DOTS * DOT_STAGGER;
    const leg = (i: number, at: number, from: string, mid: string, to: string, colours: [string, string]): SvgAnimation[] => [
      { id: `p${i}`, attrs: { cx: [n(`${from}x${i}`), n(`${mid}x${i}`)], cy: [n(`${from}y${i}`), n(`${mid}y${i}`)] }, delay: at + i * DOT_STAGGER, ms: 450, ease: "out" },
      { id: `p${i}`, attrs: { cx: [n(`${mid}x${i}`), n(`${to}x${i}`)], cy: [n(`${mid}y${i}`), n(`${to}y${i}`)], fill: colours }, delay: at + 450 + i * DOT_STAGGER, ms: 650, ease: "in-out" },
    ];
    const fade = (id: string, at: number, show: boolean): SvgAnimation => ({ id, attrs: { opacity: show ? [0, n("ghost")] : [n("ghost"), 0] }, delay: at, ms: 450, ease: "in-out" });
    return {
      svg: `<svg viewBox="0 0 200 200"><!-- {{from: text default='${PARTICLE_FROM}' label='From path'}} {{to: text default='${PARTICLE_TO}' label='To path'}} {{fromColor: color default=#F472B6 label='From colour'}} {{toColor: color default=#FBBF24 label='To colour'}} {{background: color default=#0C0A1D label='Background'}} {{size: float min=0.8 max=6 default=2.6 step=0.1 label='Dot size'}} {{scatter: float min=0 max=80 default=34 step=1 label='Scatter'}} {{ghost: float min=0 max=1 default=0.16 label='Shape fill'}} --><rect width="200" height="200" fill="{{background}}"/><path id="ghostA" d="{{a}}" fill="{{fromColor}}" fill-rule="evenodd" opacity="{{ghost}}"/><path id="ghostB" d="{{b}}" fill="{{toColor}}" fill-rule="evenodd" opacity="0"/>${Array.from(
        { length: DOTS },
        (_, i) => `<circle id="p${i}" cx="{{ax${i}}}" cy="{{ay${i}}}" r="{{size}}" fill="{{fromColor}}"/>`,
      ).join("")}</svg>`,
      animate: [
        fade("ghostA", 400, false),
        fade("ghostB", 400 + spread + 900, true),
        fade("ghostB", back, false),
        fade("ghostA", back + spread + 900, true),
        ...Array.from({ length: DOTS }, (_, i) => [
          ...leg(i, 400, "a", "s", "b", ["{{fromColor}}", "{{toColor}}"]),
          ...leg(i, back, "b", "t", "a", ["{{toColor}}", "{{fromColor}}"]),
        ]).flat(),
      ],
    };
  })(),
};

// ── Digit morph ────────────────────────────────────────────────────────

/**
 * The digits 0–9 as pen strokes in a 20 × 32 box, drawn with a round-capped
 * stroke rather than filled: an open stroke morphs as an outline going there
 * and back, which a stroke draws as the line itself.
 */
const DIGITS: readonly string[] = (() => {
  const six: Point[] = [...arc(17, 22, 14, 19, 245, 180), ...arc(10, 22, 7, 7, 180, 540).slice(1)];
  return [
    polyline(arc(10, 16, 7, 13, 0, 360).slice(0, -1), true),
    polyline([[5.5, 8], [11, 3], [11, 29]]),
    polyline([...arc(10, 9.5, 6.5, 6.5, 200, 380), [3.5, 29], [17, 29]]),
    polyline([...arc(10, 9, 6, 6, 215, 450), ...arc(10, 21.5, 7, 6.5, 270, 495).slice(1)]),
    polyline([[14, 29], [14, 3], [3, 20.5], [18, 20.5]]),
    polyline([[16.5, 3], [5.5, 3], [4.6, 14.6], ...arc(10.5, 21.2, 6.8, 7, 218, 500)]),
    polyline(six),
    polyline([[3, 3], [17, 3], [8, 29]]),
    polyline([...arc(10, 9.5, 5.5, 5.5, 90, 450), ...arc(10, 22, 7, 7, 270, 630).slice(1)]),
    polyline(six.map((p): Point => [20 - p[0], 32 - p[1]])),
  ];
})();

/** A slot with no digit: a point, hidden. */
const BLANK = "M10 16 L10 16";
/** Digit slots: numbers up to 9999. */
const SLOTS = 4;
/** At most this many morphs from one number to the other; bigger jumps skip numbers between. */
const MAX_STEPS = 8;
/** Ms each number rests before the next morph. */
const DIGIT_REST = 260;

export const digitMorph: VectorEffect = {
  kind: "vector",
  id: "digit-morph",
  name: "Digit morph",
  description: "A number counting from one value to another, each digit's stroke bending smoothly into the next.",
  category: "morph",
  tags: ["morph", "number", "counter", "countdown", "kpi", "digits"],
  hold: 900,
  presets: [
    { name: "Countdown", values: { from: 10, to: 0, ink: [1, 0.36, 0.3] } },
    { name: "New year", values: { from: 2025, to: 2026, morph: 700, background: [0.04, 0.03, 0.1], ink: [1, 0.84, 0.4] } },
    { name: "Thin", values: { weight: 1.4, background: [0.98, 0.98, 0.97], ink: [0.1, 0.1, 0.12] } },
  ],
  derived: (v) => {
    const from = Math.round(Number(v.from)) || 0;
    const to = Math.round(Number(v.to)) || 0;
    const steps = Math.min(MAX_STEPS, Math.abs(to - from));
    const values = Array.from({ length: steps + 1 }, (_, k) => Math.round(from + ((to - from) * k) / Math.max(1, steps)));
    const used = Math.max(1, ...values.map((x) => String(x).length));
    // Slots centred in the picture, the last one the units.
    const scale = Math.min(4.2, 340 / (used * 22 - 2));
    const left = 200 - ((used * 22 - 2) * scale) / 2;
    const interval = Number(v.morph) + DIGIT_REST;
    const lastEnd = Math.max(0, steps - 1) * interval + Number(v.morph);
    const out: Record<string, string | number> = { scale: r2(scale), y: r2(100 - 16 * scale), back: lastEnd + DIGIT_REST * 3 };
    for (let k = 1; k <= MAX_STEPS; k++) out[`t${k}`] = k <= steps ? (k - 1) * interval : lastEnd;
    for (let j = 0; j < SLOTS; j++) {
      const place = j - (SLOTS - used);
      out[`x${j}`] = r2(left + Math.max(0, place) * 22 * scale);
      // The digit each number shows in this slot, right-aligned; none in a slot the number does not reach.
      const glyphs = values.map((x) => {
        const text = String(x);
        const at = text.length - (used - place);
        return place >= 0 && at >= 0 ? Number(text[at]) : -1;
      });
      const paths = morphSequence(glyphs.map((g) => (g < 0 ? BLANK : DIGITS[g]!)), { points: 64 });
      for (let k = 0; k <= MAX_STEPS; k++) {
        const s = Math.min(k, steps);
        out[`d${j}_${k}`] = paths[s]!;
        out[`o${j}_${k}`] = glyphs[s]! < 0 ? 0 : 1;
      }
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 400 200"><!-- {{from: int min=0 max=9999 default=12 label='From'}} {{to: int min=0 max=9999 default=20 label='To'}} {{ink: color default=#F8FAFC label='Digits'}} {{background: color default=#111827 label='Background'}} {{weight: float min=0.8 max=5 default=2.8 step=0.1 label='Weight'}} {{morph: float min=150 max=1500 default=420 step=10 label='Morph ms'}} --><rect width="400" height="200" fill="{{background}}"/>${Array.from(
      { length: SLOTS },
      (_, j) =>
        `<path id="s${j}" d="{{d${j}_0}}" opacity="{{o${j}_0}}" transform="translate({{x${j}}} {{y}}) scale({{scale}})" fill="none" fill-rule="evenodd" stroke="{{ink}}" stroke-width="{{weight}}" stroke-linecap="round" stroke-linejoin="round"/>`,
    ).join("")}</svg>`,
    animate: Array.from({ length: SLOTS }, (_, j): SvgAnimation[] => [
      ...Array.from({ length: MAX_STEPS }, (_, i): SvgAnimation => {
        const k = i + 1;
        return { id: `s${j}`, attrs: { d: [`{{d${j}_${k - 1}}}`, `{{d${j}_${k}}}`], opacity: [n(`o${j}_${k - 1}`), n(`o${j}_${k}`)] }, delay: n(`t${k}`), ms: n("morph"), ease: "in-out" };
      }),
      // Back to the first number in one morph, so it loops.
      { id: `s${j}`, attrs: { d: [`{{d${j}_${MAX_STEPS}}}`, `{{d${j}_0}}`], opacity: [n(`o${j}_${MAX_STEPS}`), n(`o${j}_0`)] }, delay: n("back"), ms: n("morph"), ease: "in-out" },
    ]).flat(),
  },
};

/** Vector effects that turn one shape into another (see `morphPaths`). */
export const morphEffects: VectorEffect[] = [shapeMorph, iconToggle, morphSequenceEffect, gooeyMorph, particleMorph, digitMorph];
