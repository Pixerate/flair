import { morphSequence } from "../vector/morph.js";
import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

type Point = [number, number];

const DEG = Math.PI / 180;
const r2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

const polyline = (pts: readonly Point[]) => `M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join(" L")} Z`;

/** Points round an ellipse between two angles in degrees (0 is right, 90 down), `wobble(a)` scaling the radius. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, wobble: (a: number) => number = () => 1, every = 6): Point[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / every));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const deg = from + ((to - from) * k) / steps;
    const w = wobble(deg);
    return [cx + rx * w * Math.cos(deg * DEG), cy + ry * w * Math.sin(deg * DEG)];
  });
}

/** A polygon with its corners rounded off by `r`, as points. */
function rounded(corners: readonly Point[], r: number): Point[] {
  return corners.flatMap((c, i) => {
    const a = corners[(i + corners.length - 1) % corners.length]!;
    const b = corners[(i + 1) % corners.length]!;
    const towards = (p: Point): Point => {
      const l = Math.hypot(p[0] - c[0], p[1] - c[1]);
      return [c[0] + ((p[0] - c[0]) * r) / l, c[1] + ((p[1] - c[1]) * r) / l];
    };
    const [s, e] = [towards(a), towards(b)];
    // A quadratic round the corner, in a few points.
    return [0, 0.25, 0.5, 0.75, 1].map((t): Point => [
      (1 - t) ** 2 * s[0] + 2 * t * (1 - t) * c[0] + t * t * e[0],
      (1 - t) ** 2 * s[1] + 2 * t * (1 - t) * c[1] + t * t * e[1],
    ]);
  });
}

// ── Ice cube melt ──────────────────────────────────────────────────────

// An ice cube seen from above a corner: its outline, top face and shaded right face.
const CUBE: Point[] = [[100, 48], [152, 76], [152, 136], [100, 164], [48, 136], [48, 76]];
const lumpy = (a: number) => 1 + 0.035 * Math.sin(a * 5 * DEG) + 0.02 * Math.sin(a * 11 * DEG + 1);

const ICE_OUTLINE = morphSequence(
  [
    polyline(rounded(CUBE, 7)),
    // Slumped: a soft lump on a spreading foot.
    polyline([...arc(100, 158, 54, 62, 180, 360, lumpy), [154, 162], [130, 166], [100, 167], [70, 166], [46, 162]]),
    // A puddle.
    polyline(arc(100, 163, 84, 14, 0, 360, lumpy).slice(0, -1)),
  ],
  { points: 72 },
);

const ICE_TOP = morphSequence(
  [
    polyline(rounded([[100, 48], [152, 76], [100, 104], [48, 76]], 5)),
    polyline(arc(86, 118, 24, 13, 0, 360).slice(0, -1)),
    polyline(arc(80, 159, 36, 3.5, 0, 360).slice(0, -1)),
  ],
  { points: 40 },
);

const ICE_SIDE = morphSequence(
  [
    polyline([[100, 104], [152, 76], [152, 136], [100, 164]]),
    polyline([...arc(100, 158, 54, 62, 300, 360, lumpy), ...arc(100, 158, 30, 56, 360, 300)]),
    polyline([...arc(100, 163, 84, 14, -15, 100, lumpy), ...arc(100, 161, 72, 9, 100, -15)]),
  ],
  { points: 40 },
);

const MELT = { delay: 400, ms: 1700 };
const SPREAD = { delay: 2100, ms: 1500 };
const REFORM = { delay: 4600, ms: 1100 };

/** One shape through its three stages and back. */
const stages = (id: string, [cube, slump, puddle]: string[]): SvgAnimation[] => [
  { id, attrs: { d: [cube!, slump!] }, ...MELT, ease: "in-out" },
  { id, attrs: { d: [slump!, puddle!] }, ...SPREAD, ease: "out" },
  { id, attrs: { d: [puddle!, cube!] }, ...REFORM, ease: "in-out" },
];

export const iceCubeMelt: VectorEffect = {
  kind: "vector",
  id: "ice-cube-melt",
  name: "Ice cube melt",
  description: "An ice cube softening, slumping and spreading into a glossy puddle with a couple of drips, then freezing back into a cube.",
  category: "melt",
  tags: ["melt", "ice", "water", "puddle", "morph", "loop"],
  hold: 700,
  presets: [
    { name: "Night", values: { background: [0.07, 0.09, 0.14], ice: [0.72, 0.88, 1], water: [0.25, 0.55, 0.85], edge: [0.55, 0.78, 0.95] } },
    { name: "Popsicle", values: { ice: [1, 0.55, 0.62], water: [0.95, 0.3, 0.42], edge: [0.85, 0.35, 0.45], background: [1, 0.96, 0.92] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{ice: color default=#CFEFFF label='Ice'}} {{water: color default=#7FC8F2 label='Water'}} {{edge: color default=#86C3E6 label='Edge'}} {{highlight: color default=#FFFFFF label='Highlight'}} {{background: color default=#F2F5FA label='Background'}} --><rect width="200" height="200" fill="{{background}}"/><ellipse id="pool" cx="100" cy="164" rx="36" ry="5" fill="{{water}}" opacity="0.35"/><path id="cube" d="${ICE_OUTLINE[0]}" fill="{{ice}}" fill-rule="evenodd" stroke="{{edge}}" stroke-width="1.5" stroke-linejoin="round"/><path id="side" d="${ICE_SIDE[0]}" fill="#0b2a44" fill-rule="evenodd" opacity="0.12"/><path id="top" d="${ICE_TOP[0]}" fill="{{highlight}}" fill-rule="evenodd" opacity="0.55"/><path id="streak" d="M58 92 L58 128" stroke="{{highlight}}" stroke-width="4" stroke-linecap="round" opacity="0.85"/><circle id="glint" cx="118" cy="66" r="3" fill="{{highlight}}" opacity="0.9"/><circle id="drop1" cx="146" cy="128" r="0" fill="{{water}}" stroke="{{edge}}" stroke-width="1"/><circle id="drop2" cx="62" cy="134" r="0" fill="{{water}}" stroke="{{edge}}" stroke-width="1"/></svg>`,
    animate: [
      ...stages("cube", ICE_OUTLINE),
      ...stages("top", ICE_TOP),
      ...stages("side", ICE_SIDE),
      { id: "cube", attrs: { fill: ["{{ice}}", "{{water}}"] }, delay: 1800, ms: 1800, ease: "in-out" },
      { id: "cube", attrs: { fill: ["{{water}}", "{{ice}}"] }, ...REFORM, ease: "in-out" },
      { id: "top", attrs: { opacity: [0.55, 0.8] }, ...SPREAD, ease: "in-out" },
      { id: "top", attrs: { opacity: [0.8, 0.55] }, ...REFORM, ease: "in-out" },
      { id: "streak", attrs: { opacity: [0.85, 0] }, delay: 400, ms: 900, ease: "in-out" },
      { id: "streak", attrs: { opacity: [0, 0.85] }, delay: 5500, ms: 300, ease: "in-out" },
      { id: "glint", attrs: { opacity: [0.9, 0], r: [3, 1] }, delay: 300, ms: 700, ease: "in-out" },
      { id: "glint", attrs: { opacity: [0, 0.9], r: [1, 3] }, delay: 5500, ms: 300, ease: "in-out" },
      { id: "pool", attrs: { rx: [36, 92], ry: [5, 17], opacity: [0.35, 0.6] }, delay: 600, ms: 3000, ease: "in-out" },
      { id: "pool", attrs: { rx: [92, 36], ry: [17, 5], opacity: [0.6, 0.35] }, ...REFORM, ease: "in-out" },
      { id: "drop1", attrs: { cy: [128, 160], r: [0, 4.5] }, delay: 900, ms: 1000, ease: "in-out" },
      { id: "drop1", attrs: { r: [4.5, 0] }, delay: 1900, ms: 300, ease: "in-out" },
      { id: "drop2", attrs: { cy: [134, 160], r: [0, 3.5] }, delay: 1400, ms: 900, ease: "in-out" },
      { id: "drop2", attrs: { r: [3.5, 0] }, delay: 2300, ms: 300, ease: "in-out" },
      // Back up the sides, unseen, for the next melt.
      { id: "drop1", attrs: { cy: [160, 128] }, ...REFORM },
      { id: "drop2", attrs: { cy: [160, 134] }, ...REFORM },
    ],
  },
};

// ── Candle ─────────────────────────────────────────────────────────────

const BURN = 6000;
const TOP = 92;
const BURNT = 150;
const FLICKER = 150;

/** The top of the candle at `ms` into the burn. */
const topAt = (ms: number) => TOP + ((BURNT - TOP) * Math.min(ms, BURN)) / BURN;

/** A repeatable 0–1 number for a flicker. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The flame's transform at a flicker: following the top down, stretching, leaning and swelling at random. */
const flame = (i: number, ms: number) => {
  const sx = i < 0 ? 1 : 0.9 + 0.16 * rand(i, 1);
  const sy = i < 0 ? 1 : 0.82 + 0.34 * rand(i, 2);
  const lean = i < 0 ? 0 : (rand(i, 3) - 0.5) * 12;
  return `translate(100 ${r2(topAt(ms) - 12)}) skewX(${r2(lean)}) scale(${r2(sx)} ${r2(sy)})`;
};

const FLICKERS = BURN / FLICKER;

const DRIPS = [
  { x: 66, delay: 700, ms: 2600, length: 70 },
  { x: 123, delay: 1600, ms: 3000, length: 96 },
  { x: 93, delay: 3000, ms: 2400, length: 52 },
] as const;

const linear = { delay: 0, ms: BURN, ease: "linear" as const };
const relight = { delay: BURN, ms: 600, ease: "in-out" as const };

export const candle: VectorEffect = {
  kind: "vector",
  id: "candle",
  name: "Candle",
  description: "A candle burning down with a flickering flame and halo while wax drips run down its sides, then it is lit anew.",
  category: "melt",
  tags: ["melt", "candle", "flames", "wax", "cosy", "loop"],
  hold: 0,
  presets: [
    { name: "Red taper", values: { wax: [0.78, 0.15, 0.2], holder: [0.75, 0.62, 0.35] } },
    { name: "Spirit flame", values: { flame: [0.35, 0.7, 1], core: [0.88, 0.96, 1], background: [0.04, 0.05, 0.1] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 200 260"><!-- {{wax: color default=#F1E4CF label='Wax'}} {{flame: color default=#FFA733 label='Flame'}} {{core: color default=#FFF6CF label='Flame core'}} {{holder: color default=#6E5A48 label='Holder'}} {{background: color default=#17131F label='Background'}} --><defs><radialGradient id="halo"><stop offset="0" stop-color="{{flame}}" stop-opacity="0.55"/><stop offset="1" stop-color="{{flame}}" stop-opacity="0"/></radialGradient><linearGradient id="waxshade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.12"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs><rect width="200" height="260" fill="{{background}}"/><circle id="glow" cx="100" cy="${TOP - 30}" r="80" fill="url(#halo)" opacity="0.9"/><ellipse cx="100" cy="244" rx="58" ry="10" fill="{{holder}}"/><rect id="body" x="70" y="${TOP}" width="60" height="${244 - TOP}" fill="{{wax}}"/><rect id="shade" x="70" y="${TOP}" width="60" height="${244 - TOP}" fill="url(#waxshade)"/>${DRIPS.map(
      (d, i) => `<rect id="drip${i}" x="${d.x}" y="${TOP}" width="11" height="0" rx="5.5" fill="{{wax}}" stroke="#000" stroke-opacity="0.12"/>`,
    ).join("")}<ellipse id="rim" cx="100" cy="${TOP}" rx="30" ry="7" fill="{{wax}}" stroke="#000" stroke-opacity="0.1"/><ellipse id="pool" cx="100" cy="${TOP}" rx="21" ry="4" fill="{{core}}" opacity="0.35"/><line id="wick" x1="100" y1="${TOP}" x2="100" y2="${TOP - 13}" stroke="#2a211c" stroke-width="2.5" stroke-linecap="round"/><g id="flame" transform="${flame(-1, 0)}"><path d="M0 0 C-13 -6 -12 -27 0 -50 C12 -27 13 -6 0 0 Z" fill="{{flame}}"/><path d="M0 -2 C-6 -5 -6 -15 0 -27 C6 -15 6 -5 0 -2 Z" fill="{{core}}"/></g></svg>`,
    animate: [
      // Burning down, then lit anew.
      { id: "body", attrs: { y: [TOP, BURNT], height: [244 - TOP, 244 - BURNT] }, ...linear },
      { id: "body", attrs: { y: [BURNT, TOP], height: [244 - BURNT, 244 - TOP] }, ...relight },
      { id: "shade", attrs: { y: [TOP, BURNT], height: [244 - TOP, 244 - BURNT] }, ...linear },
      { id: "shade", attrs: { y: [BURNT, TOP], height: [244 - BURNT, 244 - TOP] }, ...relight },
      ...(["rim", "pool"] as const).flatMap((id): SvgAnimation[] => [
        { id, attrs: { cy: [TOP, BURNT] }, ...linear },
        { id, attrs: { cy: [BURNT, TOP] }, ...relight },
      ]),
      { id: "wick", attrs: { y1: [TOP, BURNT], y2: [TOP - 13, BURNT - 13] }, ...linear },
      { id: "wick", attrs: { y1: [BURNT, TOP], y2: [BURNT - 13, TOP - 13] }, ...relight },
      { id: "glow", attrs: { cy: [TOP - 30, BURNT - 30] }, ...linear },
      { id: "glow", attrs: { cy: [BURNT - 30, TOP - 30] }, ...relight },
      // Wax runs down the sides, its drips riding down with the top as it burns.
      ...DRIPS.flatMap((d, i): SvgAnimation[] => [
        { id: `drip${i}`, attrs: { y: [TOP, BURNT] }, ...linear },
        { id: `drip${i}`, attrs: { height: [0, d.length] }, delay: d.delay, ms: d.ms, ease: "out" },
        { id: `drip${i}`, attrs: { y: [BURNT, TOP], height: [d.length, 0] }, ...relight },
      ]),
      // The flame flickers as it follows the top down, goes out, and is lit again.
      ...Array.from({ length: FLICKERS }, (_, i): SvgAnimation => ({
        id: "flame",
        attrs: { transform: [flame(i - 1, i * FLICKER), flame(i, (i + 1) * FLICKER)] },
        delay: i * FLICKER,
        ms: FLICKER,
        ease: "in-out",
      })),
      { id: "flame", attrs: { transform: [flame(FLICKERS - 1, BURN), flame(-1, 0)], opacity: [1, 0] }, delay: BURN, ms: 250, ease: "in-out" },
      { id: "flame", attrs: { opacity: [0, 1] }, delay: BURN + 500, ms: 300, ease: "out" },
      ...Array.from({ length: BURN / 300 }, (_, i): SvgAnimation => ({
        id: "glow",
        attrs: { opacity: [i ? r2(0.7 + 0.3 * rand(i - 1, 7)) : 0.9, r2(0.7 + 0.3 * rand(i, 7))] },
        delay: i * 300,
        ms: 300,
        ease: "in-out",
      })),
      { id: "glow", attrs: { opacity: [r2(0.7 + 0.3 * rand(BURN / 300 - 1, 7)), 0] }, delay: BURN, ms: 250, ease: "in-out" },
      { id: "glow", attrs: { opacity: [0, 0.9] }, delay: BURN + 500, ms: 300, ease: "out" },
    ],
  },
};

/** Melting: drips, heat haze, wax and liquefying shapes, as vector effects. */
export const meltEffects: VectorEffect[] = [iceCubeMelt, candle];
