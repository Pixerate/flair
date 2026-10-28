import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Instant change: the attribute snaps to `value` at `delay` (resets of hidden elements). */
const snap = (id: string, attr: string, value: string | number, delay: number): SvgAnimation => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 });

/**
 * A flame as path data, one structure for every pose so poses tween: two
 * licks and a tip over a round base at (`x`, `y`), `size` high. `sway` bends
 * the tip sideways (a fraction of the height, more toward the top),
 * `stretch` makes it taller or squatter, and `flip` mirrors it.
 */
function flamePath(x: number, y: number, size: number, sway = 0, stretch = 1, flip = false): string {
  // The shape, base at (0, 0), 1 high: cubic segments as x, y pairs.
  const shape = [
    [0, 0],
    [-0.26, 0, -0.36, -0.2, -0.32, -0.4],
    [-0.29, -0.55, -0.2, -0.62, -0.17, -0.76],
    [-0.1, -0.68, -0.08, -0.6, -0.07, -0.52],
    [-0.02, -0.66, 0.04, -0.84, 0, -1],
    [0.2, -0.86, 0.35, -0.62, 0.33, -0.36],
    [0.31, -0.14, 0.2, 0, 0, 0],
  ];
  const at = (px: number, py: number) => {
    const bend = sway * Math.pow(-py, 1.6);
    return `${r1(x + ((flip ? -px : px) + bend) * size)} ${r1(y + py * size * stretch)}`;
  };
  const [start, ...curves] = shape;
  return `M${at(start![0]!, start![1]!)} ${curves.map((c) => `C${at(c[0]!, c[1]!)} ${at(c[2]!, c[3]!)} ${at(c[4]!, c[5]!)}`).join(" ")} Z`;
}

/** Flicker poses, as [sway, stretch]: a loop, back to the first. */
const FLICKER: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.08, 1.06],
  [-0.06, 0.95],
  [0.05, 1.1],
  [-0.09, 0.98],
  [0.03, 1.04],
];

/** Changes stepping an element's `d` through the flicker poses (`phase` shifts which pose comes first) every `ms`, from `delay`. */
function flicker(id: string, path: (sway: number, stretch: number) => string, phase: number, ms: number, delay = 0, count = FLICKER.length): SvgAnimation[] {
  const pose = (i: number) => FLICKER[(i + phase) % FLICKER.length]!;
  return Array.from({ length: count }, (_, i): SvgAnimation => ({
    id,
    attrs: { d: [path(...pose(i)), path(...pose(i + 1))] },
    delay: delay + i * ms,
    ms,
    ease: "in-out",
  }));
}

const FLICKER_MS = 190;
const LOOP_MS = FLICKER.length * FLICKER_MS;

export const flameIcon: VectorEffect = {
  kind: "vector",
  id: "flame-icon",
  name: "Flame icon",
  description: "A flame icon flickering in three layers with a pulsing glow and embers rising off its tip, for streaks, trending and hot items.",
  category: "fire",
  tags: ["fire", "flames", "icon", "streak", "trending", "hot", "ui", "loop"],
  hold: 0,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], glow: [1, 0.72, 0.4] } },
    { name: "Blue flame", values: { outer: [0.23, 0.42, 0.98], middle: [0.38, 0.72, 1], core: [0.88, 0.96, 1], glow: [0.4, 0.6, 1] } },
  ],
  motion: (() => {
    const outer = (sway: number, stretch: number) => flamePath(60, 108, 90, sway, stretch);
    const middle = (sway: number, stretch: number) => flamePath(60, 108, 62, sway * 1.2, stretch, true);
    const core = (sway: number, stretch: number) => flamePath(60, 108, 34, sway * 1.4, stretch);
    const embers = [
      { id: "ember0", x: 52, delay: 0 },
      { id: "ember1", x: 70, delay: 420 },
      { id: "ember2", x: 60, delay: 800 },
    ];
    return {
      svg: `<svg viewBox="0 0 120 120"><!-- {{background: color default=#140B08 label='Background'}} {{outer: color default=#F0441D label='Outer flame'}} {{middle: color default=#FF9A1F label='Middle flame'}} {{core: color default=#FFE58A label='Core'}} {{glow: color default=#FF6A1F label='Glow'}} --><defs><filter id="flameIconGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="120" height="120" fill="{{background}}"/><ellipse id="halo" cx="60" cy="78" rx="34" ry="38" fill="{{glow}}" filter="url(#flameIconGlow)" opacity="0.45"/>${embers
        .map(({ id, x }) => `<circle id="${id}" cx="${x}" cy="30" r="2" fill="{{core}}" opacity="0"/>`)
        .join("")}<path id="outer" d="${outer(0, 1)}" fill="{{outer}}"/><path id="middle" d="${middle(...FLICKER[2]!)}" fill="{{middle}}"/><path id="core" d="${core(...FLICKER[4]!)}" fill="{{core}}"/></svg>`,
      animate: [
        // The three layers flicker out of step with each other.
        ...flicker("outer", outer, 0, FLICKER_MS),
        ...flicker("middle", middle, 2, FLICKER_MS),
        ...flicker("core", core, 4, FLICKER_MS),
        // The glow breathes with it.
        { id: "halo", attrs: { opacity: [0.45, 0.7] }, ms: LOOP_MS / 2, ease: "in-out" },
        { id: "halo", attrs: { opacity: [0.7, 0.45] }, delay: LOOP_MS / 2, ms: LOOP_MS / 2, ease: "in-out" },
        // Embers float up off the tip, swaying, and wink out.
        ...embers.flatMap(({ id, x, delay }): SvgAnimation[] => [
          { id, attrs: { cy: [30, 4], cx: [x, x + (x < 60 ? -6 : 6)] }, delay, ms: 600, ease: "out" },
          { id, attrs: { opacity: [0, 1] }, delay, ms: 120 },
          { id, attrs: { opacity: [1, 0], r: [2, 0.8] }, delay: delay + 280, ms: 320 },
          snap(id, "cy", 30, delay + 600),
          snap(id, "cx", x, delay + 600),
          snap(id, "r", 2, delay + 600),
        ]),
      ],
    };
  })(),
};

/** The match: a stick 90 long from its group's origin to the head, held at an angle, posed by translate and rotate. */
const matchPose = (x: number, y: number, deg: number) => `translate(${x} ${y}) rotate(${deg})`;
/** Where the match's head is in a pose. */
const headAt = (x: number, y: number, deg: number) => [r1(x + 90 * Math.cos((deg * Math.PI) / 180)), r1(y + 90 * Math.sin((deg * Math.PI) / 180))] as const;
/** The flame's transform: at the head, scaled by `s` (0 out). */
const flamePose = (at: readonly [number, number], s: number) => `translate(${at[0]} ${at[1] - 4}) scale(${Math.round(s * 1000) / 1000})`;

const REST = [10, 146, -25] as const;
const STRUCK = [100, 146, -25] as const;
const HELD = [60, 124, -38] as const;

export const matchStrike: VectorEffect = {
  kind: "vector",
  id: "match-strike",
  name: "Match strike",
  description: "A match struck along the side of its box: a spray of sparks, a flame that flares and settles, flickers as the stick chars, then is blown out in a curl of smoke.",
  category: "fire",
  tags: ["fire", "match", "flames", "ignite", "sparks", "smoke", "loop"],
  hold: 300,
  presets: [
    { name: "Light", values: { background: [0.98, 0.96, 0.93], box: [0.17, 0.35, 0.6] } },
    { name: "Green head", values: { head: [0.16, 0.6, 0.3] } },
  ],
  motion: (() => {
    const struckHead = headAt(...STRUCK);
    const heldHead = headAt(...HELD);
    const flame = (sway: number, stretch: number) => flamePath(0, 0, 34, sway, stretch);
    const core = (sway: number, stretch: number) => flamePath(0, 0, 17, sway * 1.3, stretch, true);
    const sparks = [-150, -110, -60, -20, 20].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const at = (r: number) => [r1(struckHead[0] + r * Math.cos(a)), r1(struckHead[1] + r * Math.sin(a))] as const;
      return { id: `spark${i}`, from: at(6), mid: at(20), to: at(32) };
    });
    const IGNITE = 600;
    const OUT = 3000;
    const flickers = Math.floor((OUT - 1100) / FLICKER_MS);
    return {
      svg: `<svg viewBox="0 0 240 160"><!-- {{background: color default=#120D0B label='Background'}} {{box: color default=#B3261E label='Box'}} {{striker: color default=#5A3A28 label='Striker'}} {{stick: color default=#E8C891 label='Stick'}} {{head: color default=#C8102E label='Head'}} {{flame: color default=#FF8A1F label='Flame'}} {{core: color default=#FFF1B0 label='Flame core'}} --><defs><filter id="matchGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter><filter id="matchSmoke" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter></defs><rect width="240" height="160" fill="{{background}}"/><rect x="80" y="96" width="150" height="70" rx="6" fill="{{box}}"/><rect x="80" y="96" width="150" height="70" rx="6" fill="#000" opacity="0.15"/><rect x="86" y="102" width="138" height="12" rx="3" fill="{{striker}}"/><circle id="glow" cx="${heldHead[0]}" cy="${heldHead[1] - 14}" r="34" fill="{{flame}}" filter="url(#matchGlow)" opacity="0"/>${sparks
        .map(({ id, from }) => `<line id="${id}" x1="${from[0]}" y1="${from[1]}" x2="${from[0]}" y2="${from[1]}" stroke="{{core}}" stroke-width="2.5" stroke-linecap="round" opacity="0"/>`)
        .join("")}<path id="smoke" d="M${heldHead[0]} ${heldHead[1] - 4} c-8 -10 8 -16 0 -26 s8 -16 0 -26" fill="none" stroke="#9A948F" stroke-width="5" stroke-linecap="round" filter="url(#matchSmoke)" opacity="0" transform="translate(0 0)"/><g id="match" transform="${matchPose(...REST)}"><rect x="0" y="-3.5" width="86" height="7" rx="2" fill="{{stick}}"/><rect id="char" x="86" y="-3.5" width="0" height="7" fill="#2A1A12"/><ellipse id="head" cx="89" cy="0" rx="9" ry="6.5" fill="{{head}}"/></g><g id="flame" transform="${flamePose(struckHead, 0.2)}" opacity="0"><path id="outer" d="${flame(0, 1)}" fill="{{flame}}"/><path id="inner" d="${core(...FLICKER[3]!)}" fill="{{core}}"/></g></svg>`,
      animate: [
        // The strike along the striker, then the match lifted up to burn.
        { id: "match", attrs: { transform: [matchPose(...REST), matchPose(...STRUCK)] }, delay: 150, ms: 500, ease: "in-out" },
        { id: "match", attrs: { transform: [matchPose(...STRUCK), matchPose(...HELD)] }, delay: 650, ms: 450, ease: "in-out" },
        // Sparks sprayed off the head as it catches.
        ...sparks.flatMap(({ id, from, mid, to }, i): SvgAnimation[] => [
          { id, attrs: { opacity: [0, 1] }, delay: 540 + i * 20, ms: 30 },
          { id, attrs: { x2: [from[0], mid[0]], y2: [from[1], mid[1]] }, delay: 540 + i * 20, ms: 120, ease: "out" },
          { id, attrs: { x1: [from[0], to[0]], y1: [from[1], to[1]], x2: [mid[0], to[0]], y2: [mid[1], to[1]], opacity: [1, 0] }, delay: 660 + i * 20, ms: 200, ease: "out" },
          snap(id, "x1", from[0], 900),
          snap(id, "y1", from[1], 900),
          snap(id, "x2", from[0], 900),
          snap(id, "y2", from[1], 900),
        ]),
        // The flame flares up, settles as the match is lifted, and flickers.
        { id: "flame", attrs: { opacity: [0, 1] }, delay: IGNITE, ms: 60 },
        { id: "flame", attrs: { transform: [flamePose(struckHead, 0.2), flamePose(struckHead, 1.4)] }, delay: IGNITE, ms: 150, ease: "out" },
        { id: "flame", attrs: { transform: [flamePose(struckHead, 1.4), flamePose(heldHead, 1)] }, delay: IGNITE + 150, ms: 350, ease: "in-out" },
        ...flicker("outer", flame, 0, FLICKER_MS, 1100, flickers),
        ...flicker("inner", core, 3, FLICKER_MS, 1100, flickers),
        { id: "glow", attrs: { opacity: [0, 0.75] }, delay: IGNITE + 150, ms: 350, ease: "out" },
        ...Array.from({ length: 6 }, (_, i): SvgAnimation => ({
          id: "glow",
          attrs: { opacity: i % 2 ? [0.55, 0.75] : [0.75, 0.55] },
          delay: 1100 + i * 300,
          ms: 300,
          ease: "in-out",
        })),
        // The head chars and the burn creeps down the stick.
        { id: "head", attrs: { fill: ["{{head}}", "#2A1A12"] }, delay: IGNITE + 100, ms: 900 },
        { id: "char", attrs: { x: [86, 62], width: [0, 24] }, delay: 1100, ms: OUT - 1100, ease: "linear" },
        // Blown out: the flame shrinks away, the glow dies and smoke curls up.
        { id: "outer", attrs: { d: [flame(...FLICKER[flickers % FLICKER.length]!), flame(0, 1)] }, delay: OUT, ms: 250 },
        { id: "inner", attrs: { d: [core(...FLICKER[(flickers + 3) % FLICKER.length]!), core(...FLICKER[3]!)] }, delay: OUT, ms: 250 },
        { id: "flame", attrs: { transform: [flamePose(heldHead, 1), flamePose(heldHead, 0)], opacity: [1, 0] }, delay: OUT, ms: 250, ease: "in-out" },
        { id: "glow", attrs: { opacity: [0.75, 0] }, delay: OUT, ms: 300, ease: "out" },
        { id: "smoke", attrs: { opacity: [0, 0.7] }, delay: OUT + 100, ms: 250 },
        { id: "smoke", attrs: { transform: ["translate(0 0)", "translate(6 -30)"], opacity: [0.7, 0] }, delay: OUT + 350, ms: 900, ease: "out" },
        snap("smoke", "transform", "translate(0 0)", OUT + 1250),
        // A fresh match: the burnt one fades, everything resets out of sight, and it fades back in at rest.
        { id: "match", attrs: { opacity: [1, 0] }, delay: OUT + 600, ms: 300 },
        snap("match", "transform", matchPose(...REST), OUT + 950),
        snap("head", "fill", "{{head}}", OUT + 950),
        snap("char", "x", 86, OUT + 950),
        snap("char", "width", 0, OUT + 950),
        snap("flame", "transform", flamePose(struckHead, 0.2), OUT + 950),
        { id: "match", attrs: { opacity: [0, 1] }, delay: OUT + 1000, ms: 300 },
      ],
    };
  })(),
};

/** Fire as vector effects: a flickering flame icon and a match being struck. */
export const fireEffects: VectorEffect[] = [flameIcon, matchStrike];
