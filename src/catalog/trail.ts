import type { ControlValue } from "../shader/controls.js";
import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Trails as vector effects: shapes are worked out in code from the control
 * values and handed to the picture by `derived`, so one control can reshape
 * a streak or move a line of dots.
 */

const r1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
};
const r2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** A number control's value, clamped, or its default. */
const num = (v: ControlValue | undefined, fallback: number, min: number, max: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
};

type Point = readonly [number, number];

/** A closed outline through `points`. */
const outline = (points: readonly Point[]) => `M${points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")} Z`;

// ── Motion streak ──────────────────────────────────────────────────────

/** A circle of radius `r` round the origin, as a path. */
const circlePath = (r: number) => `M${r1(-r)} 0 A${r1(r)} ${r1(r)} 0 1 0 ${r1(r)} 0 A${r1(r)} ${r1(r)} 0 1 0 ${r1(-r)} 0 Z`;

/** A five-point star of radius `r` round the origin, point up. */
const starPath = (r: number) =>
  outline(
    Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.48 : r * 1.15;
      return [rr * Math.cos(a), rr * Math.sin(a)] as const;
    }),
  );

/** Where the object rests, and where it comes from and goes to. */
const STREAK_Y = 80;
const STREAK_IN = -60;
const STREAK_REST = 160;
const STREAK_OUT = 400;
const at = (x: number) => `translate(${x} ${STREAK_Y})`;
const squash = (sx: number, sy: number) => `scale(${sx} ${sy})`;

export const motionStreak: VectorEffect = {
  kind: "vector",
  id: "motion-streak",
  name: "Motion streak",
  description: "A ball or star whizzing in, easing to a stop with a squash, then easing off again, a motion-blur streak and speed lines stretching behind it while it is fast.",
  category: "trail",
  tags: ["trail", "motion", "speed", "streak", "motion-blur", "cartoon", "loop"],
  hold: 500,
  presets: [
    { name: "Shooting star", values: { shape: 1, object: [1, 0.84, 0.25], streak: [1, 0.6, 0.2], background: [0.06, 0.07, 0.16], length: 170 } },
    { name: "Tennis ball", values: { object: [0.8, 0.95, 0.2], streak: [0.55, 0.7, 0.15], background: [0.2, 0.45, 0.3], size: 14 } },
  ],
  derived: (v) => {
    const size = num(v.size, 18, 8, 32);
    const len = num(v.length, 130, 40, 220);
    const star = Math.round(Number(v.shape)) === 1;
    const line = (y: number, from: number, to: number) => `M${r1(from)} ${r1(y)} L${r1(to)} ${r1(y)}`;
    return {
      body: star ? starPath(size) : circlePath(size),
      shine: star ? 0 : 0.55,
      hx: r1(-size * 0.35),
      hy: r1(-size * 0.4),
      hr: r1(size * 0.32),
      tail: `M0 ${r1(-size)} L${r1(-len)} ${r1(-size * 0.2)} L${r1(-len)} ${r1(size * 0.2)} L0 ${r1(size)} Z`,
      lines: [line(-size * 1.15, -size * 1.3, -len * 0.75), line(size * 0.1, -size * 1.6, -len * 1.05), line(size * 1.15, -size * 1.4, -len * 0.6)].join(" "),
      lineWidth: r1(Math.max(1.5, size * 0.14)),
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 160"><!-- {{shape: int min=0 max=1 default=0 label='Shape (0 ball, 1 star)'}} {{size: float min=8 max=32 default=18 step=1 label='Size'}} {{length: float min=40 max=220 default=130 step=5 label='Streak length'}} --><defs><linearGradient id="motionStreakFade" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="{{streak: color default=#FF7A59 label='Streak'}}" stop-opacity="0.8"/><stop offset="1" stop-color="{{streak}}" stop-opacity="0"/></linearGradient></defs><rect width="320" height="160" fill="{{background: color default=#FFF8EE label='Background'}}"/><g id="motionStreakMover" transform="${at(STREAK_IN)}"><g id="motionStreakTail" transform="scale(1 1)" opacity="1"><path d="{{tail}}" fill="url(#motionStreakFade)"/><path d="{{lines}}" fill="none" stroke="{{streak}}" stroke-width="{{lineWidth}}" stroke-linecap="round" opacity="0.6"/></g><g id="motionStreakBody" transform="${squash(1.3, 0.8)}"><path d="{{body}}" fill="{{object: color default=#FF4D4D label='Object'}}" stroke-linejoin="round"/><circle cx="{{hx}}" cy="{{hy}}" r="{{hr}}" fill="#FFFFFF" opacity="{{shine}}"/></g></g></svg>`,
    animate: [
      // In fast, easing to a stop: the streak shrinks as it slows.
      { id: "motionStreakMover", attrs: { transform: [at(STREAK_IN), at(STREAK_REST)] }, ms: 700, ease: "out" },
      { id: "motionStreakTail", attrs: { transform: ["scale(1 1)", "scale(0 1)"], opacity: [1, 0] }, ms: 650, ease: "out" },
      { id: "motionStreakBody", attrs: { transform: [squash(1.3, 0.8), squash(1, 1)] }, ms: 600, ease: "out" },
      // A squash as it stops, and back.
      { id: "motionStreakBody", attrs: { transform: [squash(1, 1), squash(0.84, 1.14)] }, delay: 600, ms: 140, ease: "out" },
      { id: "motionStreakBody", attrs: { transform: [squash(0.84, 1.14), squash(1, 1)] }, delay: 740, ms: 260, ease: "out" },
      // A wind-up back, then off, easing in and out as the streak grows behind it.
      { id: "motionStreakMover", attrs: { transform: [at(STREAK_REST), at(STREAK_REST - 12)] }, delay: 1300, ms: 220, ease: "out" },
      { id: "motionStreakMover", attrs: { transform: [at(STREAK_REST - 12), at(STREAK_OUT)] }, delay: 1520, ms: 700, ease: "in-out" },
      { id: "motionStreakTail", attrs: { transform: ["scale(0 1)", "scale(1 1)"], opacity: [0, 1] }, delay: 1560, ms: 420, ease: "in-out" },
      { id: "motionStreakBody", attrs: { transform: [squash(1, 1), squash(1.3, 0.8)] }, delay: 1520, ms: 400, ease: "in-out" },
    ],
  },
};

// ── Dotted trail ───────────────────────────────────────────────────────

/** How many dots the trail has. */
const DOTS = 12;

/** The curve the dots follow, sampled: an S from the bottom left to the top right. */
const CURVE: Point[] = Array.from({ length: 49 }, (_, k) => {
  const t = k / 48;
  const p0 = [26, 124];
  const p1 = [120, 150];
  const p2 = [170, 6];
  const p3 = [294, 40];
  const b = (i: number) => (1 - t) ** 3 * p0[i]! + 3 * (1 - t) ** 2 * t * p1[i]! + 3 * (1 - t) * t * t * p2[i]! + t ** 3 * p3[i]!;
  return [b(0), b(1)] as const;
});

/** The curve moved `offset` to its left (negative: right), and the direction it heads in at each sample, in degrees. */
function offsetCurve(offset: number): { points: Point[]; angles: number[] } {
  const points: Point[] = [];
  const angles: number[] = [];
  CURVE.forEach((p, k) => {
    const a = CURVE[Math.max(0, k - 1)]!;
    const b = CURVE[Math.min(CURVE.length - 1, k + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    points.push([p[0] + (dy / l) * offset, p[1] - (dx / l) * offset]);
    angles.push((Math.atan2(dy, dx) * 180) / Math.PI);
  });
  return { points, angles };
}

/** The point `f` (0–1) of the way along a polyline by length, and the sample index nearest it. */
function pointAlong(points: readonly Point[], f: number): { p: Point; i: number } {
  const lengths = [0];
  for (let k = 1; k < points.length; k++) lengths.push(lengths[k - 1]! + Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1]));
  const target = f * lengths[lengths.length - 1]!;
  let k = 1;
  while (k < points.length - 1 && lengths[k]! < target) k++;
  const span = lengths[k]! - lengths[k - 1]! || 1;
  const u = Math.min(1, Math.max(0, (target - lengths[k - 1]!) / span));
  const a = points[k - 1]!;
  const b = points[k]!;
  return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], i: u < 0.5 ? k - 1 : k };
}

/** How far along its side's path dot `k` sits. */
const dotAt = (k: number) => r2(0.02 + (0.96 * k) / (DOTS - 1));

const DOT_IDS = Array.from({ length: DOTS }, (_, k) => k);

export const dottedTrail: VectorEffect = {
  kind: "vector",
  id: "dotted-trail",
  name: "Dotted trail",
  description: "A staggered line of dots, like footsteps or breadcrumbs, stepping one by one along a curvy path and fading out behind, on a loop.",
  category: "trail",
  tags: ["trail", "path", "dots", "footsteps", "breadcrumb", "loop", "loader"],
  hold: 300,
  presets: [
    { name: "Footprints in snow", values: { footprints: true, dot: [0.45, 0.55, 0.7], background: [0.95, 0.97, 1], stagger: 14, size: 5 } },
    { name: "Breadcrumbs", values: { dot: [0.75, 0.5, 0.25], background: [0.99, 0.95, 0.88], stagger: 0, keep: 12, guide: false } },
    { name: "Night trail", values: { dot: [0.4, 1, 0.75], background: [0.05, 0.07, 0.1], keep: 4, gap: 110 } },
  ],
  derived: (v) => {
    const stagger = num(v.stagger, 10, 0, 24);
    const size = num(v.size, 5, 2, 10);
    const gap = num(v.gap, 170, 60, 400);
    const keep = Math.round(num(v.keep, 6, 2, 12));
    const left = offsetCurve(stagger / 2);
    const right = offsetCurve(-stagger / 2);
    const path = (pts: readonly Point[]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L")}`;
    const out: Record<string, string | number> = {
      left: path(left.points),
      right: path(right.points),
      middle: path(CURVE),
      guideOpacity: v.guide === false ? 0 : 0.18,
      rx: r1(v.footprints === true ? size * 1.5 : size),
      ry: r1(size),
      shrinkRx: r1((v.footprints === true ? size * 1.5 : size) * 0.6),
      shrinkRy: r1(size * 0.6),
      inMs: Math.round(gap * 1.6),
      outMs: Math.round(gap * 2.5),
    };
    for (const k of DOT_IDS) {
      const side = k % 2 ? right : left;
      const { p, i } = pointAlong(side.points, dotAt(k));
      out[`x${k}`] = r1(p[0]);
      out[`y${k}`] = r1(p[1]);
      out[`a${k}`] = r1(side.angles[i]!);
      out[`in${k}`] = Math.round(k * gap);
      out[`out${k}`] = Math.round((k + keep) * gap);
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 320 160"><!-- {{stagger: float min=0 max=24 default=10 step=1 label='Stagger'}} {{size: float min=2 max=10 default=5 step=0.5 label='Dot size'}} {{gap: float min=60 max=400 default=170 step=10 label='Ms between dots'}} {{keep: int min=2 max=12 default=6 label='Dots shown at once'}} {{footprints: bool default=false label='Footprints'}} {{guide: bool default=true label='Show path'}} --><rect width="320" height="160" fill="{{background: color default=#14121F label='Background'}}"/><path d="{{middle}}" fill="none" stroke="{{dot: color default=#FFB547 label='Dots'}}" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round" opacity="{{guideOpacity}}"/><path id="dottedTrailLeft" d="{{left}}" fill="none"/><path id="dottedTrailRight" d="{{right}}" fill="none"/>${DOT_IDS.map(
      (k) =>
        `<g id="dottedTrailDot${k}" transform="translate({{x${k}}} {{y${k}}})"><ellipse id="dottedTrailMark${k}" rx="0" ry="0" transform="rotate({{a${k}}})" fill="{{dot}}" opacity="0"/></g>`,
    ).join("")}</svg>`,
    animate: DOT_IDS.flatMap((k): SvgAnimation[] => [
      // Each dot steps in along its side of the path, then fades away a few dots later.
      { id: `dottedTrailDot${k}`, along: k % 2 ? "dottedTrailRight" : "dottedTrailLeft", at: [Math.max(0, r2(dotAt(k) - 0.025)), dotAt(k)], delay: n(`in${k}`), ms: n("inMs"), ease: "out" },
      { id: `dottedTrailMark${k}`, attrs: { rx: [0, "{{rx}}"], ry: [0, "{{ry}}"], opacity: [0, 1] }, delay: n(`in${k}`), ms: n("inMs"), ease: "out" },
      { id: `dottedTrailMark${k}`, attrs: { rx: ["{{rx}}", "{{shrinkRx}}"], ry: ["{{ry}}", "{{shrinkRy}}"], opacity: [1, 0] }, delay: n(`out${k}`), ms: n("outMs"), ease: "in-out" },
    ]),
  },
};

/** Trails as vector effects. */
export const trailEffects: VectorEffect[] = [motionStreak, dottedTrail];
