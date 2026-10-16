import type { ControlValue } from "../shader/controls.js";
import { morphSequence } from "../vector/morph.js";
import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Splats as vector effects. Shapes are worked out from a seed, so a `shape`
 * control picks among irregular splats, and `morphSequence` gives the dot,
 * the overshoot and the settled splat one structure so their `d`s blend.
 */

type Point = [number, number];

const r2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** A derived number in an animation's numeric field. */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** A small seeded random generator (mulberry32), 0–1. */
function random(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const polyline = (pts: readonly Point[]) => `M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join(" L")} Z`;

const CX = 100;
const CY = 100;
const DROPS = 8;
const POINTS = 144;

interface Splat {
  dot: string;
  over: string;
  settled: string;
  drops: { x: number; y: number; r: number }[];
}

/**
 * A splat of radius `size` from a seed: a lumpy body with spikes of varied
 * length, as a polygon round the centre (at `scale`), and droplets round it.
 */
function makeSplat(seed: number, size: number): Splat {
  const rnd = random(seed + 1);
  const lumps = Array.from({ length: 4 }, () => ({ k: 2 + Math.floor(rnd() * 4), a: rnd() * 0.12, p: rnd() * Math.PI * 2 }));
  const spikes = Array.from({ length: 9 + Math.floor(rnd() * 4) }, () => ({ at: rnd() * Math.PI * 2, len: 0.15 + rnd() * 0.45, w: 0.06 + rnd() * 0.08 }));
  const radius = (a: number) => {
    let r = 1;
    for (const l of lumps) r += l.a * Math.sin(l.k * a + l.p);
    for (const s of spikes) {
      const d = Math.atan2(Math.sin(a - s.at), Math.cos(a - s.at));
      r += s.len * Math.exp(-(d * d) / (s.w * s.w));
    }
    return r;
  };
  const shape = (scale: number) =>
    polyline(
      Array.from({ length: POINTS }, (_, k): Point => {
        const a = (k / POINTS) * Math.PI * 2;
        const r = radius(a) * size * scale;
        return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
      }),
    );
  const dotR = size * 0.42;
  const dot = polyline(Array.from({ length: POINTS }, (_, k): Point => [CX + dotR * Math.cos((k / POINTS) * Math.PI * 2), CY + dotR * Math.sin((k / POINTS) * Math.PI * 2)]));
  const drops = Array.from({ length: DROPS }, (_, k) => {
    const a = ((k + 0.2 + rnd() * 0.6) / DROPS) * Math.PI * 2;
    const d = size * (1.55 + rnd() * 0.75);
    return { x: r2(CX + d * Math.cos(a)), y: r2(CY + d * Math.sin(a)), r: r2(size * (0.06 + rnd() * 0.1)) };
  });
  const [d, o, s] = morphSequence([dot, shape(1.14), shape(1)], { points: POINTS });
  return { dot: d!, over: o!, settled: s!, drops };
}

const splats = new Map<string, Splat>();

/** A splat for these control values, worked out once. */
function splatFor(values: Record<string, ControlValue>): Splat {
  const seed = Math.max(0, Math.round(Number(values.shape)) || 0);
  const size = Math.min(60, Math.max(15, Number(values.size) || 36));
  const key = `${seed}/${size}`;
  if (!splats.has(key)) splats.set(key, makeSplat(seed, size));
  return splats.get(key)!;
}

/** When each droplet pops out after the splat lands, in ms. */
const POP = 380;
const SETTLE = 1700;

export const splatStamp: VectorEffect = {
  kind: "vector",
  id: "splat-stamp",
  name: "Splat stamp",
  description: "A dot that bursts into an irregular paint splat, droplets popping out round it before it settles and shrinks back.",
  category: "splatter",
  tags: ["splatter", "paint", "morph", "stamp", "playful", "micro-interaction"],
  hold: 300,
  presets: [
    { name: "Ink", values: { ink: [0.07, 0.07, 0.09], background: [0.97, 0.96, 0.93], shine: false } },
    { name: "Lime", values: { ink: [0.52, 0.85, 0.16], background: [0.1, 0.1, 0.14], shape: 4 } },
    { name: "Big pink", values: { ink: [0.96, 0.3, 0.55], background: [1, 0.95, 0.96], size: 50, shape: 7 } },
  ],
  derived: (v) => {
    const s = splatFor(v);
    const out: Record<string, string | number> = { a: s.dot, b: s.over, c: s.settled, gloss: v.shine === false ? 0 : 0.35 };
    const size = Math.min(60, Math.max(15, Number(v.size) || 36));
    Object.assign(out, { gx: r2(CX - size * 0.36), grx: r2(size * 0.24), gry: r2(size * 0.13) });
    s.drops.forEach((d, i) => {
      out[`x${i}`] = d.x;
      out[`y${i}`] = d.y;
      out[`r${i}`] = d.r;
      out[`ro${i}`] = r2(d.r * 1.35);
      out[`xm${i}`] = r2(CX + (d.x - CX) * 0.55);
      out[`ym${i}`] = r2(CY + (d.y - CY) * 0.55);
    });
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{ink: color default=#E11D48 label='Paint'}} {{background: color default=#FFF7ED label='Background'}} {{shape: int min=0 max=9 default=0 label='Shape'}} {{size: float min=15 max=60 default=36 step=1 label='Size'}} {{shine: bool default=true label='Shine'}} --><rect width="200" height="200" fill="{{background}}"/><path id="splat" d="{{a}}" fill="{{ink}}" fill-rule="evenodd"/><ellipse id="gloss" cx="{{gx}}" cy="{{gx}}" rx="{{grx}}" ry="{{gry}}" transform="rotate(-35 {{gx}} {{gx}})" fill="#FFFFFF" opacity="0"/>${Array.from(
      { length: DROPS },
      (_, i) => `<circle id="drop${i}" cx="${CX}" cy="${CY}" r="0" fill="{{ink}}"/>`,
    ).join("")}</svg>`,
    animate: [
      { id: "splat", attrs: { d: ["{{a}}", "{{b}}"] }, delay: 300, ms: 220, ease: "out" },
      { id: "splat", attrs: { d: ["{{b}}", "{{c}}"] }, delay: 520, ms: 380, ease: "in-out" },
      { id: "gloss", attrs: { opacity: [0, n("gloss")] }, delay: 600, ms: 400, ease: "out" },
      ...Array.from({ length: DROPS }, (_, i): SvgAnimation[] => {
        const at = POP + i * 35;
        return [
          { id: `drop${i}`, attrs: { cx: [CX, n(`xm${i}`)], cy: [CY, n(`ym${i}`)], r: [0, n(`ro${i}`)] }, delay: at, ms: 150, ease: "out" },
          { id: `drop${i}`, attrs: { cx: [n(`xm${i}`), n(`x${i}`)], cy: [n(`ym${i}`), n(`y${i}`)], r: [n(`ro${i}`), n(`r${i}`)] }, delay: at + 150, ms: 260, ease: "out" },
          { id: `drop${i}`, attrs: { cx: [n(`x${i}`), CX], cy: [n(`y${i}`), CY], r: [n(`r${i}`), 0] }, delay: SETTLE + 2000, ms: 360, ease: "in-out" },
        ];
      }).flat(),
      { id: "gloss", attrs: { opacity: [n("gloss"), 0] }, delay: SETTLE + 2000, ms: 300, ease: "in-out" },
      { id: "splat", attrs: { d: ["{{c}}", "{{a}}"] }, delay: SETTLE + 2050, ms: 420, ease: "in-out" },
    ],
  },
};

/** Splats as vector effects. */
export const splatterEffects: VectorEffect[] = [splatStamp];
