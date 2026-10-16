import type { EaseName, SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Cartoon and comic as vector effects. They share the comic inker's habits:
 * flat fills with a heavy ink outline, shapes that pop in past their size and
 * settle, and, where a shape is a heap of round puffs, the puffs drawn twice
 * (stroked under, filled over) so their outline is one cloud's. Ids in
 * `<defs>` start with the effect's name; animated elements with its initials.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** A repeatable 0–1 number for `k`. */
const rand = (k: number) => {
  const x = Math.sin(k * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

/** A transform about (`cx`, `cy`): scaled `sx` by `sy`, turned `rot` degrees and moved by (`dx`, `dy`). */
const about = (cx: number, cy: number, sx: number, sy = sx, rot = 0, dx = 0, dy = 0) =>
  `translate(${r1(cx + dx)} ${r1(cy + dy)}) rotate(${r1(rot)}) scale(${r2(sx)} ${r2(sy)}) translate(${r1(-cx)} ${r1(-cy)})`;

/** Instant change: the attribute snaps to `value` at `delay`. */
const snap = (id: string, attr: string, value: string | number, delay: number, step?: number): SvgAnimation => ({
  id,
  ...(step === undefined ? {} : { step }),
  attrs: { [attr]: [value, value] },
  delay,
  ms: 0,
});

/** Keyframes `[ms, value]` of one attribute as changes, each from the frame before (equal times snap). */
function keys(
  id: string,
  attr: string,
  frames: readonly (readonly [number, string | number])[],
  options: { ease?: EaseName; step?: number } = {},
): SvgAnimation[] {
  return frames.slice(1).map(([at, value], i): SvgAnimation => {
    const [from, before] = frames[i]!;
    return {
      id,
      ...(options.step === undefined ? {} : { step: options.step }),
      attrs: { [attr]: [before, value] },
      delay: from,
      ms: at - from,
      ease: options.ease ?? "in-out",
    };
  });
}

type Point = readonly [number, number];

/** A closed outline through `points`. */
const outline = (points: readonly Point[]) => `M${points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;

/** A star of `points` points, outer radius `r`, inner `inner`, point up, round (`cx`, `cy`). */
function star(cx: number, cy: number, r: number, inner: number, points = 5): string {
  return outline(
    Array.from({ length: points * 2 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / points;
      const rr = k % 2 ? inner : r;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
    }),
  );
}

/** A four-pointed sparkle with curved sides, round (`cx`, `cy`). */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.18;
  return `M${r1(cx)} ${r1(cy - r)} Q${r1(cx + k)} ${r1(cy - k)} ${r1(cx + r)} ${r1(cy)} Q${r1(cx + k)} ${r1(cy + k)} ${r1(cx)} ${r1(cy + r)} Q${r1(cx - k)} ${r1(cy + k)} ${r1(cx - r)} ${r1(cy)} Q${r1(cx - k)} ${r1(cy - k)} ${r1(cx)} ${r1(cy - r)} Z`;
}

/** An ellipse as a path. */
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r1(cx - rx)} ${r1(cy)} A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx + rx)} ${r1(cy)} A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx - rx)} ${r1(cy)} Z`;

/** Lettering faces, the comic ones first. */
const LETTERING = `'Bangers', 'Luckiest Guy', Impact, 'Arial Black', sans-serif`;
const HANDWRITTEN = `'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive`;

// ── Sound effect ───────────────────────────────────────────────────────

const SFX_X = 200;
const SFX_Y = 150;

/** A jagged starburst round the sound effect's centre: `spikes` points of uneven length. */
function jagged(rx: number, ry: number, spikes: number, inner: number, seed: number, turn = 0): string {
  return outline(
    Array.from({ length: spikes * 2 }, (_, k) => {
      const a = turn + (k * Math.PI) / spikes;
      const reach = k % 2 ? inner * (0.92 + 0.16 * rand(k + seed)) : 0.8 + 0.2 * rand(k * 3.1 + seed);
      return [SFX_X + rx * reach * Math.cos(a), SFX_Y + ry * reach * Math.sin(a)] as const;
    }),
  );
}

const SFX_OUTER = jagged(178, 132, 15, 0.64, 1);
const SFX_INNER = jagged(128, 92, 13, 0.7, 9, 0.2);

/** Little ink flecks flying off the burst. */
const SFX_FLECKS = Array.from({ length: 10 }, (_, k) => {
  const a = (k / 10) * Math.PI * 2 + 0.3 * rand(k + 40);
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const [r0, r1_] = [1.0 + 0.06 * rand(k), 1.16 + 0.1 * rand(k + 7)];
  return `M${r1(SFX_X + 182 * r0 * c)} ${r1(SFX_Y + 136 * r0 * s)} L${r1(SFX_X + 182 * r1_ * c)} ${r1(SFX_Y + 136 * r1_ * s)}`;
}).join(" ");

/** The burst's pose: scaled `s` and turned `rot`, round the centre. */
const sfxPose = (s: number, rot: number) => about(SFX_X, SFX_Y, s, s, rot);

/** The shake after the hit: [ms, dx, dy], dying away. */
const SFX_SHAKE: readonly (readonly [number, number, number])[] = [
  [380, 0, 0],
  [420, 7, -4],
  [460, -6, 5],
  [500, 5, 3],
  [540, -5, -3],
  [580, 3, 4],
  [620, -3, -2],
  [660, 2, 1],
  [700, 0, 0],
];

export const soundEffect: VectorEffect = {
  kind: "vector",
  id: "sound-effect",
  name: "Sound effect",
  description: "A comic sound effect: a jagged starburst with halftone dots and a lettered word that pops in with an overshoot, shakes from the hit, holds and bursts away, on a loop.",
  category: "comic",
  tags: ["comic", "cartoon", "pow", "onomatopoeia", "burst", "halftone", "text", "pop"],
  hold: 300,
  presets: [
    { name: "BAM!", values: { word: "BAM!", burst: [1, 0.36, 0.64], dots: [0.85, 0.12, 0.45], inner: [1, 0.9, 0.2], letters: [0.93, 0.13, 0.17], background: [1, 0.95, 0.75] } },
    { name: "ZAP!", values: { word: "ZAP!", burst: [0.49, 0.98, 1], dots: [0.13, 0.64, 0.79], inner: [0.49, 0.23, 0.93], letters: [1, 0.9, 0.2], background: [0.1, 0.1, 0.2] } },
  ],
  derived: (v) => {
    const e = Math.max(0.6, textWidthEm(String(v.word)));
    const size = Math.min(92, 230 / e);
    return { size: r1(size), length: r1(e * size), base: r1(SFX_Y + size * 0.36) };
  },
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{word: text default='POW!' label='Word'}} {{background: color default=#3FA9F5 label='Background'}} {{burst: color default=#FFD60A label='Burst'}} {{dots: color default=#F08C00 label='Halftone dots'}} {{inner: color default=#EF233C label='Inner burst'}} {{letters: color default=#FFE45C label='Letters'}} {{ink: color default=#111111 label='Ink'}} {{font: text default="${LETTERING}" label='Font'}} --><defs><pattern id="soundEffectDots" patternUnits="userSpaceOnUse" width="11" height="11" patternTransform="rotate(22)"><circle cx="5.5" cy="5.5" r="2.9" fill="{{dots}}"/></pattern><radialGradient id="soundEffectRamp" gradientUnits="userSpaceOnUse" cx="${SFX_X}" cy="${SFX_Y}" r="180"><stop offset="0.45" stop-color="#000000"/><stop offset="0.95" stop-color="#FFFFFF"/></radialGradient><mask id="soundEffectFade"><rect width="400" height="300" fill="url(#soundEffectRamp)"/></mask></defs><rect width="400" height="300" fill="{{background}}"/><g id="sfxShake" transform="translate(0 0)"><g id="sfxFlecks" transform="${sfxPose(0.7, 0)}" opacity="0"><path d="${SFX_FLECKS}" stroke="{{ink}}" stroke-width="6" stroke-linecap="round"/></g><g id="sfx" transform="${sfxPose(0, -25)}"><path d="${SFX_OUTER}" fill="{{burst}}" stroke="{{ink}}" stroke-width="6" stroke-linejoin="miter"/><path d="${SFX_OUTER}" fill="url(#soundEffectDots)" mask="url(#soundEffectFade)"/><path d="${SFX_INNER}" fill="{{inner}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="miter"/><g id="sfxWord" transform="${about(SFX_X, SFX_Y, 0, 0, -8)}"><text x="${SFX_X + 6}" y="{{base}}" dy="6" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{ink}}" stroke="{{ink}}" stroke-width="10" stroke-linejoin="round">{{word}}</text><text x="${SFX_X}" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{letters}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">{{word}}</text></g></g></g></svg>`,
    animate: [
      // The burst slams in past its size, settles, holds, then bursts away.
      ...keys("sfx", "transform", [
        [0, sfxPose(0, -25)],
        [160, sfxPose(1.22, 6)],
        [280, sfxPose(0.92, -3)],
        [400, sfxPose(1, 0)],
      ], { ease: "out" }),
      ...keys("sfx", "transform", [
        [1900, sfxPose(1, 0)],
        [2020, sfxPose(1.1, -4)],
        [2200, sfxPose(0, 14)],
      ]),
      // The word lands a beat later, bigger, and throbs.
      ...keys("sfxWord", "transform", [
        [100, about(SFX_X, SFX_Y, 0, 0, -8)],
        [290, about(SFX_X, SFX_Y, 1.35, 1.35, -12)],
        [410, about(SFX_X, SFX_Y, 0.94, 0.94, -6)],
        [520, about(SFX_X, SFX_Y, 1, 1, -8)],
        [1000, about(SFX_X, SFX_Y, 1.06, 1.06, -8)],
        [1400, about(SFX_X, SFX_Y, 1, 1, -8)],
      ], { ease: "out" }),
      // Flecks fly off on impact.
      snap("sfxFlecks", "opacity", 0, 0),
      snap("sfxFlecks", "opacity", 1, 140),
      { id: "sfxFlecks", attrs: { transform: [sfxPose(0.7, 0), sfxPose(1.25, 4)] }, delay: 140, ms: 420, ease: "out" },
      { id: "sfxFlecks", attrs: { opacity: [1, 0] }, delay: 300, ms: 320 },
      // Everything shakes from the hit.
      ...SFX_SHAKE.slice(1).map(([at, dx, dy], i): SvgAnimation => {
        const [from, fx, fy] = SFX_SHAKE[i]!;
        return { id: "sfxShake", attrs: { transform: [`translate(${fx} ${fy})`, `translate(${dx} ${dy})`] }, delay: from, ms: at - from, ease: "linear" };
      }),
    ],
  },
};

// ── Speech bubble ──────────────────────────────────────────────────────

const SB_X = 212;
const SB_Y = 112;
/** Lines of text a bubble holds. */
const SB_LINES = 3;

/** Words wrapped into lines no wider than `limit` ems. */
function wrap(words: readonly string[], limit: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidthEm(next) > limit) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text set in at most {@link SB_LINES} lines: the lines and their size. */
function setText(text: string): { lines: string[]; size: number } {
  const words = text.split(/\s+/).filter(Boolean);
  for (let size = 26; size >= 12; size--) {
    const lines = wrap(words, 270 / size);
    if (lines.length <= SB_LINES && lines.every((l) => textWidthEm(l) * size <= 300)) return { lines, size };
  }
  const lines = wrap(words, 270 / 12);
  const kept = [...lines.slice(0, SB_LINES - 1), lines.slice(SB_LINES - 1).join(" ")].filter(Boolean);
  const widest = Math.max(1, ...kept.map((l) => textWidthEm(l)));
  return { lines: kept, size: Math.max(4, Math.min(12, 300 / widest)) };
}

/** A cloud's outline: bumps bulging out between points round an ellipse. */
function cloud(cx: number, cy: number, rx: number, ry: number, bumps: number): string {
  const pts = Array.from({ length: bumps }, (_, k) => {
    const a = (k / bumps) * Math.PI * 2 + 0.2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  });
  return `M${r1(pts[0]![0])} ${r1(pts[0]![1])} ${pts
    .map((p, k) => {
      const [x, y] = pts[(k + 1) % bumps]!;
      const chord = Math.hypot(x - p[0], y - p[1]);
      return `A${r1(chord * 0.6)} ${r1(chord * 0.6)} 0 0 1 ${r1(x)} ${r1(y)}`;
    })
    .join(" ")} Z`;
}

export const speechBubble: VectorEffect = {
  kind: "vector",
  id: "speech-bubble",
  name: "Speech bubble",
  description: "A comic speech balloon with a tail that pops out of the speaker and types its words in, or a cloudy thought bubble with trailing circles.",
  category: "comic",
  tags: ["comic", "cartoon", "speech", "bubble", "balloon", "thought", "text", "typing"],
  hold: 300,
  presets: [
    { name: "Thought", values: { thought: true, text: "Hmm… what if we tried it in space?", background: [0.93, 0.9, 1] } },
    { name: "Shout", values: { text: "LOOK OUT!", background: [1, 0.36, 0.3], pace: 70 } },
  ],
  derived: (v) => {
    const thought = v.thought === true;
    const { lines, size } = setText(String(v.text));
    const pace = Number(v.pace);
    const lineH = size * 1.22;
    const widest = Math.max(...lines.map((l) => textWidthEm(l) * size), size * 2);
    const rx = Math.min(186, widest / 2 / 0.8 + 26);
    const ry = Math.min(98, (lines.length * lineH) / 2 / 0.78 + 24);
    const tip: Point = [SB_X - rx * 0.62 - 18, Math.min(272, SB_Y + ry + 50)];
    const onRim = (deg: number, k = 1): Point => [SB_X + rx * k * Math.cos((deg * Math.PI) / 180), SB_Y + ry * k * Math.sin((deg * Math.PI) / 180)];
    const [b1, b2] = [onRim(112, 0.9), onRim(136, 0.9)];
    const tail = `M${r1(b1[0])} ${r1(b1[1])} Q${r1((b1[0] + tip[0]) / 2 + 6)} ${r1((b1[1] + tip[1]) / 2)} ${r1(tip[0])} ${r1(tip[1])} Q${r1((b2[0] + tip[0]) / 2 + 2)} ${r1((b2[1] + tip[1]) / 2 - 8)} ${r1(b2[0])} ${r1(b2[1])} Z`;
    const start = onRim(124, 1.18);
    const trail = [0.25, 0.55, 0.85].map((t, i) => ({
      x: r1(start[0] + (tip[0] - start[0]) * t),
      y: r1(start[1] + (tip[1] - start[1]) * t),
      r: [16, 11, 7][i]!,
    }));
    const top = SB_Y - (lines.length * lineH) / 2;
    const out: Record<string, string | number> = {
      size: r1(size),
      outline: thought ? cloud(SB_X, SB_Y, rx * 0.94, ry * 0.92, 11) : ellipse(SB_X, SB_Y, rx, ry),
      tail,
      tailShow: thought ? "none" : "inline",
      trailShow: thought ? "inline" : "none",
      pop0: about(tip[0], tip[1], 0),
      popOver: about(tip[0], tip[1], 1.1),
      popUnder: about(tip[0], tip[1], 0.96),
      pop1: about(tip[0], tip[1], 1),
    };
    trail.forEach((c, i) => Object.assign(out, { [`tx${i}`]: c.x, [`ty${i}`]: c.y, [`tr${i}`]: c.r }));
    let at = 480;
    for (let i = 0; i < SB_LINES; i++) {
      const line = lines[i] ?? "";
      const ms = Math.max(1, Math.round(Array.from(line).length * pace));
      Object.assign(out, {
        [`line${i}`]: line,
        [`x${i}`]: r1(SB_X - (textWidthEm(line) * size) / 2),
        [`y${i}`]: r1(top + lineH * (i + 0.78)),
        [`at${i}`]: at,
        [`ms${i}`]: ms,
      });
      at += line ? ms + 80 : 0;
    }
    out.outAt = at + 1600;
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 400 290"><!-- {{text: text default='Great Scott! It actually works!' label='Text'}} {{thought: bool default=false label='Thought bubble'}} {{pace: float min=15 max=200 default=45 step=5 label='Ms per letter'}} {{background: color default=#8ECAE6 label='Background'}} {{bubble: color default=#FFFFFF label='Bubble'}} {{ink: color default=#111111 label='Ink'}} {{font: text default="${HANDWRITTEN}" label='Font'}} --><rect width="400" height="290" fill="{{background}}"/><g id="sbPop" transform="{{pop0}}"><g display="{{trailShow}}">${[0, 1, 2]
      .map((i) => `<circle id="sbTrail${i}" cx="{{tx${i}}}" cy="{{ty${i}}}" r="{{tr${i}}}" fill="{{bubble}}" stroke="{{ink}}" stroke-width="4" opacity="0"/>`)
      .join("")}</g><path d="{{tail}}" display="{{tailShow}}" fill="{{bubble}}" stroke="{{ink}}" stroke-width="5" stroke-linejoin="round"/><path d="{{outline}}" fill="{{bubble}}" stroke="{{ink}}" stroke-width="5" stroke-linejoin="round"/><path d="{{tail}}" display="{{tailShow}}" fill="{{bubble}}"/>${[0, 1, 2]
      .map((i) => `<text id="sbLine${i}" x="{{x${i}}}" y="{{y${i}}}" font-family="{{font}}" font-size="{{size}}" font-weight="700" fill="{{ink}}" xml:space="preserve"></text>`)
      .join("")}</g></svg>`,
    animate: [
      // Out of the speaker's mouth: the bubble grows from the tail's tip, past its size and back.
      { id: "sbPop", attrs: { transform: ["{{pop0}}", "{{popOver}}"], opacity: [1, 1] }, ms: 240, ease: "out" },
      { id: "sbPop", attrs: { transform: ["{{popOver}}", "{{popUnder}}"] }, delay: 240, ms: 120, ease: "in-out" },
      { id: "sbPop", attrs: { transform: ["{{popUnder}}", "{{pop1}}"] }, delay: 360, ms: 120, ease: "in-out" },
      // A thought's trailing circles bubble up first.
      ...[0, 1, 2].flatMap((i) => [snap(`sbTrail${2 - i}`, "opacity", 0, 0), snap(`sbTrail${2 - i}`, "opacity", 1, 40 + i * 70)]),
      ...[0, 1, 2].map((i): SvgAnimation => ({ id: `sbLine${i}`, write: `{{line${i}}}`, delay: n(`at${i}`), ms: n(`ms${i}`), ease: "linear" })),
      { id: "sbPop", attrs: { opacity: [1, 0] }, delay: n("outAt"), ms: 280 },
    ],
  },
};

// ── Fight cloud ────────────────────────────────────────────────────────

const FC_X = 200;
const FC_Y = 158;
/** The cloud's reach (its puffs' outer edge), for placing what pokes out. */
const FC_RX = 118;
const FC_RY = 84;
/** One churn of the cloud, and the whole loop, in ms. */
const FC_LOOP = 2400;
const FC_CHURN = FC_LOOP / 3;

/** The puffs: [x, y, r]. */
const FC_PUFFS: readonly (readonly [number, number, number])[] = [
  ...Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 + 0.25;
    return [FC_X + 80 * Math.cos(a), FC_Y + 46 * Math.sin(a), 36 + 12 * rand(k + 20)] as const;
  }),
  [FC_X - 28, FC_Y - 6, 46],
  [FC_X + 30, FC_Y + 4, 44],
];

/** A puff at churn phase `j` (0–3, 3 back where 0 was). */
function puffAt(i: number, j: number) {
  const [x, y, r] = FC_PUFFS[i]!;
  const a = (j / 3) * Math.PI * 2 + rand(i + 3) * Math.PI * 2;
  return { cx: r1(x + 6 * Math.cos(a)), cy: r1(y + 5 * Math.sin(a * 1.0 + 1)), r: r1(r * (1 + 0.14 * Math.sin(a))) };
}

/** Things poking out of the cloud, pointing along +x from the wrist at the origin. */
const FC_FIST = `<rect x="-44" y="-9" width="46" height="18" rx="6" fill="{{skin}}" stroke="{{ink}}" stroke-width="4"/><rect x="0" y="-17" width="34" height="34" rx="11" fill="{{skin}}" stroke="{{ink}}" stroke-width="4"/><path d="M24 -9 H33 M24 0 H33 M24 9 H33" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><path d="M6 -17 Q12 -24 20 -17" fill="{{skin}}" stroke="{{ink}}" stroke-width="3"/>`;
const FC_FOOT = `<rect x="-44" y="-10" width="46" height="20" fill="{{ink}}" opacity="0.85"/><path d="M0 -15 H18 Q40 -15 42 4 V15 H0 Z" fill="{{boot}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round"/><path d="M0 9 H42" stroke="{{ink}}" stroke-width="4"/>`;
const FC_STAR = `<path d="${star(20, 0, 20, 9)}" fill="{{star}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round"/>`;
const FC_THINGS = [FC_FIST, FC_FOOT, FC_STAR];

/** What pokes out when: [ms, angle in degrees, thing (0 fist, 1 foot, 2 star)]. */
const FC_POKES: readonly (readonly [number, number, number])[] = [
  [0, -35, 0],
  [330, 168, 1],
  [620, -105, 2],
  [880, 12, 0],
  [1180, -152, 0],
  [1450, 78, 1],
  [1720, -62, 2],
  [1930, 200, 0],
];

/** Where the cloud's edge is at `deg`, as a distance from its centre. */
const fcReach = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return (FC_RX * FC_RY) / Math.hypot(FC_RY * Math.cos(a), FC_RX * Math.sin(a));
};

const fcPoke = (deg: number, d: number) => {
  const a = (deg * Math.PI) / 180;
  return `translate(${r1(FC_X + d * Math.cos(a))} ${r1(FC_Y + d * Math.sin(a))}) rotate(${deg}) scale(1)`;
};

const FC_SHAKE = [0, 100, 200, 300, 400, 500, 600, 700, 800].map((t, k) => [t, k === 0 || k === 8 ? 0 : r1((rand(k + 60) - 0.5) * 6), k === 0 || k === 8 ? 0 : r1((rand(k + 70) - 0.5) * 5)] as const);

export const fightCloud: VectorEffect = {
  kind: "vector",
  id: "fight-cloud",
  name: "Fight cloud",
  description: "A cartoon brawl: a churning dust cloud of puffs with fists, boots and stars poking out at random, little impact marks where they land, shaking the whole time.",
  category: "comic",
  tags: ["cartoon", "comic", "fight", "brawl", "dust", "cloud", "loop"],
  hold: 0,
  presets: [
    { name: "Night brawl", values: { background: [0.12, 0.16, 0.23], dust: [0.6, 0.65, 0.72], marks: [1, 0.85, 0.2] } },
    { name: "Desert", values: { background: [0.99, 0.9, 0.54], dust: [0.9, 0.79, 0.63], boot: [0.35, 0.22, 0.12] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{background: color default=#FFFFFF label='Background'}} {{dust: color default=#F2E8D5 label='Dust'}} {{ink: color default=#1A1A1A label='Ink'}} {{skin: color default=#FFCC99 label='Fists'}} {{boot: color default=#8B4513 label='Boots'}} {{star: color default=#FFD60A label='Stars'}} {{marks: color default=#EF233C label='Impact marks'}} --><rect width="400" height="300" fill="{{background}}"/><ellipse cx="${FC_X}" cy="${FC_Y + 98}" rx="120" ry="12" fill="{{ink}}" opacity="0.12"/><g id="fcShake" transform="translate(0 0)">${FC_POKES.map(
      ([, deg, thing], k) => `<g id="fcPoke${k}" transform="${fcPoke(deg, 0)}">${FC_THINGS[thing]}</g>`,
    ).join("")}${FC_PUFFS.map((_, i) => {
      const p = puffAt(i, 0);
      return `<circle id="fcO${i}" cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="{{ink}}" stroke="{{ink}}" stroke-width="10"/>`;
    }).join("")}${FC_PUFFS.map((_, i) => {
      const p = puffAt(i, 0);
      return `<circle id="fcF${i}" cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="{{dust}}"/>`;
    }).join("")}<path d="M150 150 q8 -6 16 0 M222 176 q8 -6 16 0 M196 128 q6 -5 12 0" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>${FC_POKES.map(([, deg], k) => {
      const a = (deg * Math.PI) / 180;
      const d = fcReach(deg) + 54;
      const [x, y] = [r1(FC_X + d * Math.cos(a)), r1(FC_Y + d * Math.sin(a))];
      return `<g id="fcHit${k}" transform="${about(x, y, 0.3)}" opacity="0"><path d="M${x} ${y - 12} V${y - 22} M${x + 11} ${y - 7} L${x + 19} ${y - 13} M${x - 11} ${y - 7} L${x - 19} ${y - 13} M${x + 13} ${y + 5} L${x + 22} ${y + 8} M${x - 13} ${y + 5} L${x - 22} ${y + 8}" stroke="{{marks}}" stroke-width="4" stroke-linecap="round"/><path d="${star(x, y, 8, 3.5, 4)}" fill="{{marks}}"/></g>`;
    }).join("")}</g></svg>`,
    animate: [
      // Each puff swells and drifts round its place, three times a loop.
      ...FC_PUFFS.flatMap((_, i) =>
        [0, 1, 2].flatMap((j): SvgAnimation[] => {
          const [a, b] = [puffAt(i, j), puffAt(i, j + 1)];
          const attrs = { cx: [a.cx, b.cx], cy: [a.cy, b.cy], r: [a.r, b.r] } as const;
          return [
            { id: `fcO${i}`, attrs, delay: j * FC_CHURN, ms: FC_CHURN },
            { id: `fcF${i}`, attrs, delay: j * FC_CHURN, ms: FC_CHURN },
          ];
        }),
      ),
      // A fist, boot or star jabs out of the cloud and back, and an impact mark flashes at its tip.
      ...FC_POKES.flatMap(([at, deg], k): SvgAnimation[] => {
        const hidden = fcPoke(deg, 0);
        const out = fcPoke(deg, fcReach(deg) + 14);
        const a = (deg * Math.PI) / 180;
        const d = fcReach(deg) + 54;
        const [x, y] = [FC_X + d * Math.cos(a), FC_Y + d * Math.sin(a)];
        return [
          { id: `fcPoke${k}`, attrs: { transform: [hidden, out] }, delay: at, ms: 110, ease: "out" },
          { id: `fcPoke${k}`, attrs: { transform: [out, hidden] }, delay: at + 290, ms: 170, ease: "in-out" },
          snap(`fcHit${k}`, "opacity", 0, 0),
          snap(`fcHit${k}`, "opacity", 1, at + 90),
          { id: `fcHit${k}`, attrs: { transform: [about(x, y, 0.3), about(x, y, 1.2)] }, delay: at + 90, ms: 200, ease: "out" },
          { id: `fcHit${k}`, attrs: { opacity: [1, 0] }, delay: at + 200, ms: 200 },
          snap(`fcHit${k}`, "transform", about(x, y, 0.3), at + 400),
        ];
      }),
      // The whole scrap jitters.
      ...[0, 1, 2].flatMap((round) =>
        FC_SHAKE.slice(1).map(([t, dx, dy], i): SvgAnimation => {
          const [t0, fx, fy] = FC_SHAKE[i]!;
          return { id: "fcShake", attrs: { transform: [`translate(${fx} ${fy})`, `translate(${dx} ${dy})`] }, delay: round * FC_CHURN + t0, ms: t - t0, ease: "linear" };
        }),
      ),
    ],
  },
};

// ── Dizzy stars ────────────────────────────────────────────────────────

const DZ_X = 150;
const DZ_Y = 100;
const DZ_RX = 92;
const DZ_RY = 24;
const DZ_ORBIT = 1600;
const DZ_COUNT = 5;
/** Samples per orbit. */
const DZ_SAMPLES = 24;

/** Orbiter `j` at `t` (0–1 round the orbit): its pose, nearer (lower) ones bigger and stronger. */
function dzAt(j: number, t: number) {
  const a = (t + j / DZ_COUNT) * Math.PI * 2;
  const depth = (Math.sin(a) + 1) / 2;
  return {
    transform: `translate(${r1(DZ_X + DZ_RX * Math.cos(a))} ${r1(DZ_Y + DZ_RY * Math.sin(a))}) rotate(${r1(24 * Math.sin(t * Math.PI * 4))}) scale(${r2(0.62 + 0.48 * depth)})`,
    opacity: r2(0.35 + 0.65 * depth),
  };
}

const DZ_BIRD = `<ellipse cx="0" cy="2" rx="11" ry="7.5" fill="{{bird}}" stroke="{{ink}}" stroke-width="2.5"/><circle cx="9" cy="-5" r="5.5" fill="{{bird}}" stroke="{{ink}}" stroke-width="2.5"/><path d="M14 -6 L20 -4 L14 -2 Z" fill="#F59E0B" stroke="{{ink}}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="-6" r="1.3" fill="{{ink}}"/><path d="M-6 0 Q-2 -9 5 -1" fill="none" stroke="{{ink}}" stroke-width="2.5" stroke-linecap="round"/>`;

export const dizzyStars: VectorEffect = {
  kind: "vector",
  id: "dizzy-stars",
  name: "Dizzy stars",
  description: "Cartoon stars (and, if you like, little birds) circling in an ellipse over a dazed head, growing and brightening as they swing round the front and shrinking and fading round the back.",
  category: "comic",
  tags: ["cartoon", "comic", "dizzy", "stars", "orbit", "knocked-out", "loop"],
  hold: 0,
  presets: [
    { name: "Tweety", values: { birds: true, background: [0.88, 0.95, 1] } },
    { name: "Stars only", values: { head: false, background: [0.1, 0.1, 0.18], star: [1, 0.85, 0.3] } },
  ],
  derived: (v) => ({
    headShow: v.head === false ? "none" : "inline",
    birdShow: v.birds === true ? "inline" : "none",
    starShow: v.birds === true ? "none" : "inline",
  }),
  motion: {
    svg: `<svg viewBox="0 0 300 300"><!-- {{background: color default=#FFF4E0 label='Background'}} {{star: color default=#FFD60A label='Stars'}} {{bird: color default=#7DD3FC label='Birds'}} {{skin: color default=#FFD9B3 label='Head'}} {{ink: color default=#1F2937 label='Ink'}} {{head: bool default=true label='Head'}} {{birds: bool default=false label='Birds too'}} --><rect width="300" height="300" fill="{{background}}"/><g id="dzHead" display="{{headShow}}" transform="rotate(-4 150 290)"><circle cx="150" cy="205" r="74" fill="{{skin}}" stroke="{{ink}}" stroke-width="5"/><ellipse cx="172" cy="134" rx="16" ry="11" fill="{{skin}}" stroke="{{ink}}" stroke-width="4"/><path d="M114 192 l18 18 M132 192 l-18 18 M168 192 l18 18 M186 192 l-18 18" stroke="{{ink}}" stroke-width="5" stroke-linecap="round"/><path d="M122 240 q10 -9 20 0 t20 0 t20 0" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/></g><ellipse cx="${DZ_X}" cy="${DZ_Y}" rx="${DZ_RX}" ry="${DZ_RY}" fill="none" stroke="{{ink}}" stroke-width="2" stroke-dasharray="4 9" stroke-linecap="round" opacity="0.25"/>${Array.from(
      { length: DZ_COUNT },
      (_, j) => {
        const p = dzAt(j, 0);
        const starShape = `<path d="${star(0, 0, 18, 7.5)}" fill="{{star}}" stroke="{{ink}}" stroke-width="2.5" stroke-linejoin="round"/>`;
        const body = j % 2 ? `<g display="{{starShow}}">${starShape}</g><g display="{{birdShow}}">${DZ_BIRD}</g>` : starShape;
        return `<g id="dzStar${j}" transform="${p.transform}" opacity="${p.opacity}">${body}</g>`;
      },
    ).join("")}</svg>`,
    animate: [
      ...Array.from({ length: DZ_COUNT }, (_, j) =>
        Array.from({ length: DZ_SAMPLES }, (_, k): SvgAnimation => {
          const [a, b] = [dzAt(j, k / DZ_SAMPLES), dzAt(j, (k + 1) / DZ_SAMPLES)];
          return {
            id: `dzStar${j}`,
            attrs: { transform: [a.transform, b.transform], opacity: [a.opacity, b.opacity] },
            delay: (k * DZ_ORBIT) / DZ_SAMPLES,
            ms: DZ_ORBIT / DZ_SAMPLES,
            ease: "linear",
          };
        }),
      ).flat(),
      // The head sways, dazed.
      ...keys("dzHead", "transform", [
        [0, "rotate(-4 150 290)"],
        [DZ_ORBIT / 2, "rotate(4 150 290)"],
        [DZ_ORBIT, "rotate(-4 150 290)"],
      ]),
    ],
  },
};

// ── Anime emotes ───────────────────────────────────────────────────────

const AE_LOOP = 1600;

/** One corner of the anger vein, bulging in towards the centre. */
const AE_VEIN = [0, 90, 180, 270].map((deg) => `<path d="M58 88 Q86 86 88 58" transform="rotate(${deg} 100 100)"/>`).join("");

const AE_SPARKS: readonly (readonly [number, number, number, number])[] = [
  [100, 98, 50, 0],
  [48, 150, 26, 420],
  [154, 46, 24, 760],
];

const aeSpark = (x: number, y: number, s: number, rot: number) => `translate(${x} ${y}) rotate(${r1(rot)}) scale(${r2(s)})`;
const aeDrop = (y: number, sx: number, sy: number) => `translate(132 ${r1(y)}) scale(${r2(sx)} ${r2(sy)})`;

export const animeEmotes: VectorEffect = {
  kind: "vector",
  id: "anime-emotes",
  name: "Anime emotes",
  description: "Anime and manga emote symbols, picked by number: a pulsing anger vein, a sliding sweat drop, twinkling sparkles or a popping exclamation mark.",
  category: "comic",
  tags: ["comic", "cartoon", "anime", "manga", "emote", "reaction", "icon", "loop"],
  hold: 0,
  presets: [
    { name: "Sweat drop", values: { emote: 1 } },
    { name: "Sparkle", values: { emote: 2, background: [0.12, 0.1, 0.2] } },
    { name: "Exclamation", values: { emote: 3, color: [0.98, 0.75, 0.1] } },
  ],
  derived: (v) => Object.fromEntries([0, 1, 2, 3].map((k) => [`show${k}`, Math.round(Number(v.emote)) === k ? "inline" : "none"])),
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{emote: int min=0 max=3 default=0 label='Emote (0 anger, 1 sweat, 2 sparkle, 3 exclamation)'}} {{background: color default=#FFFFFF label='Background'}} {{color: color default=#E11D48 label='Anger and exclamation'}} {{sweat: color default=#7DD3FC label='Sweat'}} {{sparkle: color default=#FACC15 label='Sparkle'}} {{ink: color default=#1F2937 label='Ink'}} --><rect width="200" height="200" fill="{{background}}"/><g display="{{show0}}"><g id="aeAnger" transform="${about(100, 100, 1)}" fill="none" stroke="{{color}}" stroke-width="13" stroke-linecap="round">${AE_VEIN}</g></g><g display="{{show1}}"><path d="M30 196 Q22 70 128 30" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round" opacity="0.25"/><g id="aeSweat" transform="${aeDrop(46, 0.2, 0.2)}" opacity="0"><path d="M0 -30 C8 -15 20 -3 20 10 A20 20 0 0 1 -20 10 C-20 -3 -8 -15 0 -30 Z" fill="{{sweat}}" stroke="{{ink}}" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="-8" cy="8" rx="4" ry="7" fill="#FFFFFF" opacity="0.8"/></g></g><g display="{{show2}}">${AE_SPARKS.map(
      ([x, y], i) => `<g id="aeSpark${i}" transform="${aeSpark(x, y, 0, 0)}"><path d="${sparkle(0, 0, 1)}" fill="{{sparkle}}" stroke="{{ink}}" stroke-width="0.06" stroke-linejoin="round"/><circle r="0.16" fill="#FFFFFF"/></g>`,
    ).join("")}</g><g display="{{show3}}"><g id="aeBangLines" transform="${about(100, 100, 0.6)}" opacity="0" stroke="{{ink}}" stroke-width="5" stroke-linecap="round"><path d="M56 40 L68 56 M144 40 L132 56 M44 84 L60 88 M156 84 L140 88"/></g><g id="aeBang" transform="${about(100, 160, 0)}"><path d="M88 34 Q100 26 112 34 L106 118 Q100 124 94 118 Z" fill="{{color}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="148" r="12" fill="{{color}}" stroke="{{ink}}" stroke-width="4"/></g></g></svg>`,
    animate: [
      // Anger: a heartbeat, twice a loop.
      ...keys("aeAnger", "transform", [
        [0, about(100, 100, 1)],
        [140, about(100, 100, 1.28, 1.28, 4)],
        [360, about(100, 100, 0.94, 0.94, -2)],
        [500, about(100, 100, 1.18, 1.18, 3)],
        [760, about(100, 100, 1)],
        [AE_LOOP, about(100, 100, 1)],
      ], { ease: "out" }),
      // Sweat: forms, wobbles, slides down the brow and fades.
      ...keys("aeSweat", "transform", [
        [0, aeDrop(46, 0.2, 0.2)],
        [200, aeDrop(52, 1.1, 0.9)],
        [340, aeDrop(54, 1, 1)],
        [1250, aeDrop(122, 0.92, 1.1)],
        [1500, aeDrop(136, 0.92, 1.1)],
      ]),
      snap("aeSweat", "transform", aeDrop(46, 0.2, 0.2), 1520),
      ...keys("aeSweat", "opacity", [
        [0, 0],
        [160, 1],
        [1250, 1],
        [1500, 0],
      ]),
      // Sparkles: each twinkles open with a turn and closes again, one after another.
      ...AE_SPARKS.flatMap(([x, y, s, at], i) =>
        keys(`aeSpark${i}`, "transform", [
          [at, aeSpark(x, y, 0, 0)],
          [at + 260, aeSpark(x, y, s, 45)],
          [at + 460, aeSpark(x, y, s * 0.85, 60)],
          [at + 760, aeSpark(x, y, 0, 90)],
        ], { ease: "out" }).concat(snap(`aeSpark${i}`, "transform", aeSpark(x, y, 0, 0), at + 780)),
      ),
      // Exclamation: pops up past its size with stress lines, holds, then ducks away.
      ...keys("aeBang", "transform", [
        [0, about(100, 160, 0)],
        [140, about(100, 160, 1.35, 1.35, -6)],
        [270, about(100, 160, 0.9, 0.9, 3)],
        [380, about(100, 160, 1)],
        [1250, about(100, 160, 1)],
        [1450, about(100, 160, 0)],
      ], { ease: "out" }),
      snap("aeBangLines", "opacity", 0, 0),
      snap("aeBangLines", "opacity", 1, 120),
      { id: "aeBangLines", attrs: { transform: [about(100, 100, 0.6), about(100, 100, 1.1)] }, delay: 120, ms: 260, ease: "out" },
      { id: "aeBangLines", attrs: { opacity: [1, 0] }, delay: 900, ms: 300 },
      snap("aeBangLines", "transform", about(100, 100, 0.6), 1220),
    ],
  },
};

// ── Cartoon poof ───────────────────────────────────────────────────────

const PF_X = 120;
const PF_Y = 138;
/** Where the object stands. */
const PF_FLOOR = 180;
const PF_BACK = 1300;
const PF_END = 1700;

/** The object a shape control picks (0 ball, 1 crate, 2 star), sitting on the floor. */
function poofShape(shape: unknown): string {
  switch (Math.round(Number(shape))) {
    case 1:
      return "M84 108 H156 Q160 108 160 112 V176 Q160 180 156 180 H84 Q80 180 80 176 V112 Q80 108 84 108 Z";
    case 2:
      return star(PF_X, 138, 48, 22);
    default:
      return ellipse(PF_X, 140, 40, 40);
  }
}

/** The puffs: angle, how far they fly, radius. */
const PF_PUFFS = [
  ...Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * Math.PI * 2 + 0.4 * rand(k + 80);
    return { a, d: 34 + 22 * rand(k + 90), r: 22 + 12 * rand(k + 100), delay: Math.round(rand(k + 110) * 60) };
  }),
  // The middle stays filled.
  { a: -Math.PI / 2, d: 6, r: 34, delay: 0 },
];
const PF_SPARKS: readonly (readonly [number, number, number])[] = [
  [52, 82, 12],
  [190, 96, 10],
  [176, 196, 8],
  [66, 190, 9],
];
const pfPose = (sx: number, sy: number) => about(PF_X, PF_FLOOR, sx, sy);
const pfSpark = (x: number, y: number, s: number, rot: number) => `translate(${x} ${y}) rotate(${rot}) scale(${r2(s)})`;

export const cartoonPoof: VectorEffect = {
  kind: "vector",
  id: "cartoon-poof",
  name: "Cartoon poof",
  description: "A cartoon vanishing act: on each click the object squashes, stretches and disappears into a burst of round smoke puffs that swell and fade among sparkles, then pops back.",
  category: "comic",
  tags: ["cartoon", "comic", "poof", "smoke", "vanish", "click", "interactive"],
  trigger: "click",
  hold: 300,
  presets: [
    { name: "Crate", values: { shape: 1, object: [0.72, 0.5, 0.3] } },
    { name: "Magic star", values: { shape: 2, object: [0.98, 0.8, 0.15], smoke: [0.86, 0.8, 1], background: [0.15, 0.12, 0.3] } },
  ],
  derived: (v) => ({ shape: poofShape(v.shape) }),
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{shape: int min=0 max=2 default=0 label='Object (0 ball, 1 crate, 2 star)'}} {{word: text default='POOF!' label='Word'}} {{background: color default=#FFF8EC label='Background'}} {{object: color default=#F97316 label='Object'}} {{smoke: color default=#F1F2F6 label='Smoke'}} {{sparkle: color default=#FACC15 label='Sparkles'}} {{ink: color default=#1F2937 label='Ink'}} {{font: text default="${LETTERING}" label='Font'}} --><rect width="240" height="240" fill="{{background}}"/><ellipse id="pfShadow" cx="${PF_X}" cy="${PF_FLOOR + 4}" rx="44" ry="7" fill="{{ink}}" opacity="0.15"/><g id="pfObject" transform="${pfPose(1, 1)}" opacity="1"><path d="{{shape}}" fill="{{object}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round"/><circle cx="108" cy="136" r="4" fill="{{ink}}"/><circle cx="132" cy="136" r="4" fill="{{ink}}"/><path d="M112 150 q8 6 16 0" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/></g><g id="pfSmoke" opacity="1"><g>${PF_PUFFS.map(
      (_, k) => `<circle id="pfO${k}" cx="${PF_X}" cy="${PF_Y}" r="0" fill="{{ink}}" stroke="{{ink}}" stroke-width="7"/>`,
    ).join("")}</g><g>${PF_PUFFS.map((_, k) => `<circle id="pfF${k}" cx="${PF_X}" cy="${PF_Y}" r="0" fill="{{smoke}}"/>`).join("")}</g></g>${PF_SPARKS.map(
      ([x, y], i) => `<g id="pfSpark${i}" transform="${pfSpark(x, y, 0, 0)}"><path d="${sparkle(0, 0, 1)}" fill="{{sparkle}}" stroke="{{ink}}" stroke-width="0.12" stroke-linejoin="round"/></g>`,
    ).join("")}<g id="pfWord" transform="${about(PF_X, 50, 0)}" opacity="1"><text x="${PF_X}" y="60" text-anchor="middle" font-family="{{font}}" font-size="30" font-weight="900" fill="{{object}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">{{word}}</text></g></svg>`,
    animate: [
      // Squash, stretch up and vanish; much later, pop back.
      ...keys("pfObject", "transform", [
        [0, pfPose(1, 1)],
        [110, pfPose(1.25, 0.72)],
        [230, pfPose(0.6, 1.35)],
        [330, pfPose(0, 0)],
      ], { step: 1, ease: "out" }),
      snap("pfObject", "opacity", 1, 0, 1),
      snap("pfObject", "opacity", 0, 330, 1),
      snap("pfObject", "opacity", 1, PF_BACK, 1),
      ...keys("pfObject", "transform", [
        [PF_BACK, pfPose(0, 0)],
        [PF_BACK + 220, pfPose(1.12, 1.12)],
        [PF_BACK + 360, pfPose(1, 1)],
      ], { step: 1, ease: "out" }),
      ...keys("pfShadow", "rx", [
        [0, 44],
        [110, 54],
        [330, 0],
        [PF_BACK, 0],
        [PF_BACK + 220, 48],
        [PF_BACK + 360, 44],
      ], { step: 1 }),
      // The smoke bursts out and swells, then fades.
      ...PF_PUFFS.flatMap(({ a, d, r, delay }, k): SvgAnimation[] => {
        const [x, y] = [r1(PF_X + d * Math.cos(a)), r1(PF_Y + d * Math.sin(a) * 0.8)];
        const [x2, y2] = [r1(PF_X + d * 1.35 * Math.cos(a)), r1(PF_Y + d * 1.35 * Math.sin(a) * 0.8 - 10)];
        return [`pfO${k}`, `pfF${k}`].flatMap((id): SvgAnimation[] => [
          { id, step: 1, attrs: { cx: [PF_X, x], cy: [PF_Y, y], r: [0, r] }, delay: 220 + delay, ms: 380, ease: "out" },
          { id, step: 1, attrs: { cx: [x, x2], cy: [y, y2], r: [r, r1(r * 1.15)] }, delay: 600 + delay, ms: 500, ease: "in-out" },
          snap(id, "cx", PF_X, PF_END, 1),
          snap(id, "cy", PF_Y, PF_END, 1),
          snap(id, "r", 0, PF_END, 1),
        ]);
      }),
      { id: "pfSmoke", step: 1, attrs: { opacity: [1, 0] }, delay: 650, ms: 450 },
      snap("pfSmoke", "opacity", 1, PF_END, 1),
      // Sparkles twinkle round the smoke.
      ...PF_SPARKS.flatMap(([x, y, s], i) =>
        keys(`pfSpark${i}`, "transform", [
          [300 + i * 90, pfSpark(x, y, 0, 0)],
          [520 + i * 90, pfSpark(x, y, s, 45)],
          [820 + i * 90, pfSpark(x, y, 0, 90)],
        ], { step: 1, ease: "out" }).concat(snap(`pfSpark${i}`, "transform", pfSpark(x, y, 0, 0), PF_END, 1)),
      ),
      // The word pops above it all and floats off.
      ...keys("pfWord", "transform", [
        [260, about(PF_X, 50, 0)],
        [400, about(PF_X, 50, 1.25, 1.25, -6)],
        [500, about(PF_X, 50, 1, 1, -4)],
        [1000, about(PF_X, 50, 1, 1, -4, 0, -10)],
      ], { step: 1, ease: "out" }),
      { id: "pfWord", step: 1, attrs: { opacity: [1, 0] }, delay: 750, ms: 250 },
      snap("pfWord", "transform", about(PF_X, 50, 0), PF_END, 1),
      snap("pfWord", "opacity", 1, PF_END, 1),
    ],
  },
};

// ── Line boil ──────────────────────────────────────────────────────────

/** Turbulence seeds, one per drawing of the boil. */
const LB_SEEDS = [2, 9, 17, 23];

const DOODLE = "M150 100 m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0 M135 90 v6 M165 90 v6 M132 110 q18 16 36 0 M150 46 v-24 M150 154 v24 M96 100 h-24 M204 100 h24 M112 62 l-16 -16 M188 62 l16 -16 M112 138 l-16 16 M188 138 l16 16";
const HEART = "M150 172 C100 136 70 110 70 80 C70 56 88 40 110 40 C128 40 142 52 150 66 C158 52 172 40 190 40 C212 40 230 56 230 80 C230 110 200 136 150 172 Z";

export const lineBoil: VectorEffect = {
  kind: "vector",
  id: "line-boil",
  name: "Line boil",
  description: "Hand-drawn line boil on any path: a turbulence filter whose noise is redrawn a few times a second, so the line jitters like traced animation drawings.",
  category: "comic",
  tags: ["cartoon", "hand-drawn", "line-boil", "sketch", "wobble", "doodle", "filter"],
  hold: 0,
  presets: [
    { name: "Heart", values: { d: HEART, fill: [1, 0.45, 0.55], fillAlpha: 1, ink: [0.35, 0.05, 0.12] } },
    { name: "Jittery", values: { wobble: 7, rate: 70 } },
    { name: "Chalkboard", values: { paper: [0.13, 0.2, 0.17], ink: [0.95, 0.95, 0.9], wobble: 3, width: 4 } },
  ],
  derived: (v) => Object.fromEntries(LB_SEEDS.map((_, k) => [`at${k}`, Math.round(k * Number(v.rate))])),
  motion: {
    svg: `<svg viewBox="0 0 300 200"><!-- {{rate: float min=40 max=400 default=120 step=10 label='Ms per drawing'}} --><defs><filter id="lineBoilWobble" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence id="lineBoilNoise" type="turbulence" baseFrequency="{{frequency: float min=0.005 max=0.1 default=0.03 step=0.005 label='Wobble size (smaller is wider)'}}" numOctaves="2" seed="${LB_SEEDS[0]}" result="lineBoilWarp"/><feDisplacementMap in="SourceGraphic" in2="lineBoilWarp" scale="{{wobble: float min=0 max=12 default=4 step=0.5 label='Wobble'}}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><rect width="300" height="200" fill="{{paper: color default=#FFFDF5 label='Paper'}}"/><path d="{{d: text default='${DOODLE}' label='Path (d)'}}" fill="{{fill: color default=#FDE68A label='Fill'}}" fill-opacity="{{fillAlpha: float min=0 max=1 default=0 label='Fill opacity'}}" stroke="{{ink: color default=#1F2937 label='Line'}}" stroke-width="{{width: float min=1 max=12 default=5 step=0.5 label='Line width'}}" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineBoilWobble)"/></svg>`,
    animate: LB_SEEDS.map((seed, k): SvgAnimation => ({
      id: "lineBoilNoise",
      attrs: { seed: [seed, seed] },
      delay: n(`at${k}`),
      // The last drawing holds a whole beat too, so the loop is even.
      ms: k === LB_SEEDS.length - 1 ? n("rate") : 0,
    })),
  },
};

/** Cartoon and comic as vector effects: sound-effect bursts, speech bubbles, emotes and puffs. */
export const comicEffects: VectorEffect[] = [soundEffect, speechBubble, fightCloud, dizzyStars, animeEmotes, cartoonPoof, lineBoil];
