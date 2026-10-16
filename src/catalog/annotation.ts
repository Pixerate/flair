import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, CURSOR, fit, holdControl, ms, n, outTimes, pop, r1, SANS } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * Annotations and product-demo overlays: hand-drawn circles and arrows,
 * callouts, brackets, scribbles, step badges, a spotlight, a demo cursor and
 * a guided-tour tooltip. Each is a transparent 1920 × 1080 (16:9) picture
 * to lay over a screenshot or a video, placed with position controls in
 * percent of the frame (x from the left, y from the top). Like the broadcast
 * graphics, each animates in, holds for `hold` seconds and animates out,
 * ending as it started, so it loops.
 */

type Point = [number, number];

/** A handwriting face, for notes and labels drawn by hand. */
const HAND = `'Caveat', 'Patrick Hand', 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive`;

/** Percent of the frame's width or height, in its units. */
const px = (v: unknown) => r1((Number(v) / 100) * 1920);
const py = (v: unknown) => r1((Number(v) / 100) * 1080);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pt = (p: Point) => `${r1(p[0])} ${r1(p[1])}`;

/** A percent position control. */
const at = (name: string, value: number, label: string, axis: "x" | "y") =>
  `{{${name}: float min=0 max=100 default=${value} step=0.5 label='${label} ${axis} (%)'}}`;

/** A repeatable 0–1 random sequence from a seed (mulberry32). */
function random(seed: unknown): () => number {
  let a = (Math.round(Number(seed)) || 0) * 7919 + 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth open path through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly Point[]): string {
  let d = `M${pt(pts[0]!)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i]!, pts[i]!, pts[i + 1]!, pts[i + 2] ?? pts[i + 1]!];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

/**
 * A loop drawn by hand round an ellipse: it starts at the upper left, wobbles
 * a little, overshoots its start and drifts outwards, as a pen does.
 */
function handLoop(cx: number, cy: number, rx: number, ry: number, rand: () => number, rough: number, grow = 1): string {
  const a0 = -2.5 + rand() * 0.5;
  const sweep = Math.PI * 2 + 0.4 + rand() * 0.25;
  const [p1, p2, p3] = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const tilt = (rand() - 0.5) * 0.12;
  const amp = 0.012 + 0.06 * rough;
  const pts: Point[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + sweep * t;
    const r = grow * (1 + amp * (0.55 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.15 * Math.sin(5 * a + p3)) + 0.07 * rough * t);
    const [x, y] = [rx * r * Math.cos(a), ry * r * Math.sin(a)];
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return smooth(pts);
}

/** How long writing `text` by hand takes, in ms. */
const writing = (text: unknown, perLetter = 60) => clamp(Array.from(String(text ?? "")).length * perLetter, 200, 1800);

// ── Hand circle ────────────────────────────────────────────────────────

const handCircleMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- ${at("x", 50, "Centre", "x")} ${at("y", 50, "Centre", "y")} {{w: float min=2 max=100 default=30 step=0.5 label='Width (%)'}} {{h: float min=2 max=100 default=26 step=0.5 label='Height (%)'}} {{color: color default=#EF4444 label='Ink'}} {{width: float min=1 max=40 default=8 step=0.5 label='Pen width'}} {{alpha: float min=0.1 max=1 default=1 step=0.05 label='Ink opacity'}} {{rough: float min=0 max=1 default=0.5 step=0.05 label='Roughness'}} {{seed: int min=0 max=99 default=3 label='Seed'}} ${holdControl(2)} --><g id="handCircleAll" fill="none" stroke="{{color}}" stroke-linecap="round" stroke-linejoin="round"><path id="handCircleA" d="{{a}}" stroke-width="{{width}}" stroke-opacity="{{alpha}}"/><path id="handCircleB" d="{{b}}" stroke-width="{{thin}}" stroke-opacity="{{alphaB}}"/></g></svg>`,
  animate: [
    { id: "handCircleA", draw: true, ms: 750, ease: "in-out" },
    { id: "handCircleB", draw: true, delay: 350, ms: 700, ease: "in-out" },
    { id: "handCircleAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const handCircle: VectorEffect = {
  kind: "vector",
  id: "hand-circle",
  name: "Hand circle",
  description: "A hand-drawn, slightly wobbly marker circle drawing itself round a region in a rough double stroke, then fading.",
  category: "annotation",
  tags: ["annotation", "hand-drawn", "circle", "highlight", "marker", "draw-on", "tutorial"],
  hold: 300,
  presets: [
    { name: "Red marker", values: { color: [0.94, 0.27, 0.27], width: 8 } },
    { name: "Highlighter", values: { color: [0.98, 0.88, 0.2], width: 26, alpha: 0.55, rough: 0.3 } },
    { name: "Blue pen", values: { color: [0.15, 0.39, 0.92], width: 4, rough: 0.7 } },
  ],
  derived: (v) => {
    const [cx, cy] = [px(v.x), py(v.y)];
    const [rx, ry] = [(Number(v.w) / 200) * 1920, (Number(v.h) / 200) * 1080];
    const rough = Number(v.rough);
    return {
      ...outTimes(handCircleMotion, 1050 + ms(v.hold)),
      a: handLoop(cx, cy, rx, ry, random(v.seed), rough),
      b: handLoop(cx, cy, rx, ry, random(Number(v.seed) + 101), rough, 1.035),
      thin: r1(Number(v.width) * 0.6),
      alphaB: r1(Number(v.alpha) * 0.85 * 100) / 100,
    };
  },
  motion: handCircleMotion,
};

// ── Hand arrow ─────────────────────────────────────────────────────────

const handArrowMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{label: text default='Click here!' label='Label'}} ${at("lx", 22, "Label", "x")} ${at("ly", 24, "Label", "y")} ${at("tx", 52, "Target", "x")} ${at("ty", 58, "Target", "y")} {{bend: float min=-1 max=1 default=0.45 step=0.05 label='Bend'}} {{color: color default=#EF4444 label='Ink'}} {{width: float min=1 max=24 default=7 step=0.5 label='Pen width'}} {{size: float min=16 max=160 default=76 step=1 label='Label size'}} {{rough: float min=0 max=1 default=0.5 step=0.05 label='Roughness'}} {{seed: int min=0 max=99 default=5 label='Seed'}} ${holdControl(2)} {{font: text default="${HAND}" label='Font'}} --><g id="handArrowAll" fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"><text id="handArrowLabel" x="{{lx}}" y="{{labelBase}}" text-anchor="middle" transform="rotate(-4 {{lx}} {{ly}})" font-family="{{font}}" font-size="{{labelSize}}" font-weight="700" fill="{{color}}" stroke="none">{{label}}</text><path id="handArrowShaft" d="{{shaft}}"/><path id="handArrowHead" d="{{head}}"/></g></svg>`,
  animate: [
    { id: "handArrowLabel", write: "{{label}}", ms: n("writeMs"), ease: "linear" },
    { id: "handArrowShaft", draw: true, delay: n("shaftAt"), ms: 700, ease: "in-out" },
    { id: "handArrowHead", draw: true, delay: n("headAt"), ms: 250, ease: "out" },
    { id: "handArrowAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const handArrow: VectorEffect = {
  kind: "vector",
  id: "hand-arrow",
  name: "Hand arrow",
  description: "A handwritten label, then a curved, hand-drawn arrow drawing itself from it to a target point.",
  category: "annotation",
  tags: ["annotation", "hand-drawn", "arrow", "pointer", "label", "draw-on", "tutorial"],
  hold: 300,
  presets: [
    { name: "Red marker", values: { color: [0.94, 0.27, 0.27] } },
    { name: "White chalk", values: { color: [0.97, 0.97, 0.95], width: 6, rough: 0.8 } },
    { name: "Blue pen", values: { color: [0.15, 0.39, 0.92], width: 4, bend: -0.35 } },
  ],
  derived: (v) => {
    const L: Point = [px(v.lx), py(v.ly)];
    const T: Point = [px(v.tx), py(v.ty)];
    const label = fit(v.label, 900, Number(v.size));
    const empty = String(v.label ?? "").trim() === "";
    let [dx, dy] = [T[0] - L[0], T[1] - L[1]];
    let len = Math.hypot(dx, dy);
    if (len < 1) [dx, dy, len] = [1, 0, 1];
    const [ux, uy] = [dx / len, dy / len];
    // Leave the label's box along the way to the target.
    const [hw, hh] = empty ? [0, 0] : [label.width / 2 + 22, label.size * 0.55 + 18];
    const edge = Math.min(Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity, Math.max(0, len - 40));
    const S: Point = [L[0] + ux * edge, L[1] + uy * edge];
    const E: Point = [T[0] - ux * 14, T[1] - uy * 14];
    const span = Math.max(10, Math.hypot(E[0] - S[0], E[1] - S[1]));
    const perp: Point = [-uy, ux];
    const bend = Number(v.bend) * span * 0.5;
    const C: Point = [(S[0] + E[0]) / 2 + perp[0] * bend, (S[1] + E[1]) / 2 + perp[1] * bend];
    const rand = random(v.seed);
    const phase = rand() * 6.28;
    const wobble = Number(v.rough) * Math.min(14, span * 0.03);
    const curve = (t: number): Point => [
      (1 - t) ** 2 * S[0] + 2 * (1 - t) * t * C[0] + t * t * E[0],
      (1 - t) ** 2 * S[1] + 2 * (1 - t) * t * C[1] + t * t * E[1],
    ];
    const pts = Array.from({ length: 18 }, (_, i): Point => {
      const t = i / 17;
      const [x, y] = curve(t);
      const j = wobble * Math.sin(Math.PI * t * 3 + phase) * 4 * t * (1 - t);
      return [x + perp[0] * j, y + perp[1] * j];
    });
    const before = curve(0.9);
    const angle = Math.atan2(E[1] - before[1], E[0] - before[0]);
    const barb = 22 + Number(v.width) * 2.2;
    const wing = (s: number): Point => [E[0] + barb * Math.cos(angle + Math.PI + s * (0.5 + rand() * 0.08)), E[1] + barb * Math.sin(angle + Math.PI + s * (0.5 + rand() * 0.08))];
    const writeMs = empty ? 0 : writing(v.label);
    return {
      ...outTimes(handArrowMotion, writeMs + 950 + ms(v.hold)),
      lx: L[0],
      ly: L[1],
      labelSize: label.size,
      labelBase: r1(L[1] + label.size * 0.32),
      shaft: smooth(pts),
      head: `M${pt(wing(1))} L${pt(E)} L${pt(wing(-1))}`,
      writeMs,
      shaftAt: Math.max(0, writeMs - 100),
      headAt: writeMs + 550,
    };
  },
  motion: handArrowMotion,
};

// ── Callout ────────────────────────────────────────────────────────────

const calloutMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{label: text default='New: dark mode' label='Label'}} ${at("tx", 38, "Target", "x")} ${at("ty", 46, "Target", "y")} ${at("bx", 64, "Label", "x")} ${at("by", 26, "Label", "y")} {{accent: color default=#6366F1 label='Accent'}} {{box: color default=#FFFFFF label='Label box'}} {{ink: color default=#111827 label='Label colour'}} {{size: float min=14 max=80 default=34 step=1 label='Label size'}} ${holdControl(2.5)} {{font: text default="${SANS}" label='Font'}} --><defs><filter id="calloutShadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.25"/></filter></defs><g id="calloutAll"><path id="calloutLeader" d="{{leader}}" fill="none" stroke="{{accent}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate({{tx}} {{ty}})"><circle id="calloutPulse" r="11" fill="none" stroke="{{accent}}" stroke-width="4" opacity="0"/><g id="calloutDot" transform="scale(0)"><circle r="16" fill="{{accent}}" fill-opacity="0.25"/><circle r="9" fill="{{accent}}"/></g></g><g transform="translate({{bx}} {{by}})"><g id="calloutBox" transform="scale(0)" filter="url(#calloutShadow)"><rect x="{{boxX}}" y="{{boxY}}" width="{{boxW}}" height="{{boxH}}" rx="14" fill="{{box}}" stroke="{{accent}}" stroke-width="3"/><text y="{{labelBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{labelSize}}" font-weight="600" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{label}}</text></g></g></g></svg>`,
  animate: [
    ...pop("calloutDot", 0, 1.3, 260),
    { id: "calloutPulse", attrs: { r: [11, 46], opacity: [0.9, 0] }, delay: 150, ms: 700, ease: "out" },
    { id: "calloutLeader", draw: true, delay: 250, ms: 500, ease: "in-out" },
    ...pop("calloutBox", 650, 1.08, 280),
    { id: "calloutPulse", attrs: { r: [11, 46], opacity: [0.9, 0] }, delay: 1300, ms: 700, ease: "out" },
    { id: "calloutAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const callout: VectorEffect = {
  kind: "vector",
  id: "callout",
  name: "Callout",
  description: "A dot pops on a target and pulses, a leader line draws out from it and a label box pops in at its end.",
  category: "annotation",
  tags: ["annotation", "callout", "label", "pointer", "product", "tutorial", "ui"],
  hold: 300,
  presets: [
    { name: "Indigo", values: { accent: [0.39, 0.4, 0.95] } },
    { name: "Dark", values: { accent: [0.13, 0.83, 0.93], box: [0.07, 0.09, 0.15], ink: [1, 1, 1] } },
    { name: "Alert", values: { accent: [0.94, 0.27, 0.27], box: [1, 0.95, 0.95], ink: [0.5, 0.1, 0.1] } },
  ],
  derived: (v) => {
    const T: Point = [px(v.tx), py(v.ty)];
    const B: Point = [px(v.bx), py(v.by)];
    const label = fit(v.label, 760, Number(v.size));
    const [bw, bh] = [label.width + 56, label.size + 40];
    // The leader meets the box on the side facing the target, with a short level run in.
    const side = B[0] >= T[0] ? -1 : 1;
    const A: Point = [B[0] + (side * bw) / 2, B[1]];
    const elbow: Point = [A[0] + side * 40, B[1]];
    return {
      ...outTimes(calloutMotion, 1150 + ms(v.hold)),
      tx: T[0],
      ty: T[1],
      bx: B[0],
      by: B[1],
      leader: `M${pt(T)} L${pt(elbow)} L${pt(A)}`,
      boxX: -r1(bw / 2),
      boxY: -r1(bh / 2),
      boxW: r1(bw),
      boxH: r1(bh),
      labelSize: label.size,
      labelW: label.width,
      labelBase: r1(label.size * 0.35),
    };
  },
  motion: calloutMotion,
};

// ── Bracket note ───────────────────────────────────────────────────────

const bracketNoteMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{note: text default='All of these ship today' label='Note'}} ${at("x", 62, "Bracket", "x")} {{top: float min=0 max=100 default=24 step=0.5 label='Top (%)'}} {{bottom: float min=0 max=100 default=76 step=0.5 label='Bottom (%)'}} {{flip: bool default=false label='Note on the left'}} {{color: color default=#EF4444 label='Ink'}} {{width: float min=1 max=20 default=6 step=0.5 label='Pen width'}} {{depth: float min=10 max=120 default=40 step=1 label='Bracket depth'}} {{size: float min=16 max=140 default=68 step=1 label='Note size'}} ${holdControl(2.5)} {{font: text default="${HAND}" label='Font'}} --><g id="bracketNoteAll"><path id="bracketNoteBrace" d="{{brace}}" fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/><text id="bracketNoteText" x="{{noteX}}" y="{{noteBase}}" text-anchor="{{anchor}}" font-family="{{font}}" font-size="{{noteSize}}" font-weight="700" fill="{{color}}">{{note}}</text></g></svg>`,
  animate: [
    { id: "bracketNoteBrace", draw: true, ms: 700, ease: "in-out" },
    { id: "bracketNoteText", write: "{{note}}", delay: 600, ms: n("writeMs"), ease: "linear" },
    { id: "bracketNoteAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const bracketNote: VectorEffect = {
  kind: "vector",
  id: "bracket-note",
  name: "Bracket note",
  description: "A curly bracket drawing itself down the side of a region, then a handwritten note beside its point.",
  category: "annotation",
  tags: ["annotation", "hand-drawn", "bracket", "note", "group", "draw-on", "tutorial"],
  hold: 300,
  presets: [
    { name: "Red marker", values: { color: [0.94, 0.27, 0.27] } },
    { name: "Blue pen", values: { color: [0.15, 0.39, 0.92], width: 4 } },
    { name: "Chalk", values: { color: [0.97, 0.97, 0.95] } },
  ],
  derived: (v) => {
    const x = px(v.x);
    const [y1, y2] = [py(v.top), py(v.bottom)].sort((a, b) => a - b) as [number, number];
    const ym = (y1 + y2) / 2;
    const dir = v.flip ? -1 : 1;
    const w = dir * Math.max(4, Math.min(Number(v.depth), (y2 - y1) / 4));
    const h = w / 2;
    const ah = Math.abs(h);
    const brace = `M${r1(x)} ${r1(y1)} Q${r1(x + h)} ${r1(y1)} ${r1(x + h)} ${r1(y1 + ah)} L${r1(x + h)} ${r1(ym - ah)} Q${r1(x + h)} ${r1(ym)} ${r1(x + w)} ${r1(ym)} Q${r1(x + h)} ${r1(ym)} ${r1(x + h)} ${r1(ym + ah)} L${r1(x + h)} ${r1(y2 - ah)} Q${r1(x + h)} ${r1(y2)} ${r1(x)} ${r1(y2)}`;
    const noteX = x + w + dir * 24;
    const room = v.flip ? noteX - 96 : 1824 - noteX;
    const note = fit(v.note, Math.max(200, room), Number(v.size));
    const writeMs = writing(v.note);
    return {
      ...outTimes(bracketNoteMotion, 600 + writeMs + 200 + ms(v.hold)),
      brace,
      noteX: r1(noteX),
      noteBase: r1(ym + note.size * 0.3),
      noteSize: note.size,
      anchor: v.flip ? "end" : "start",
      writeMs,
    };
  },
  motion: bracketNoteMotion,
};

// ── Scribble out ───────────────────────────────────────────────────────

const scribbleOutMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{word: text default='Tuesday' label='Word'}} {{replacement: text default='Friday!' label='Replacement'}} ${at("x", 42, "Word", "x")} ${at("y", 50, "Word", "y")} {{size: float min=16 max=200 default=96 step=1 label='Word size'}} {{showWord: bool default=true label='Draw the word'}} {{ink: color default=#111827 label='Word colour'}} {{color: color default=#EF4444 label='Scribble'}} {{fix: color default=#2563EB label='Replacement colour'}} {{width: float min=1 max=24 default=8 step=0.5 label='Pen width'}} {{seed: int min=0 max=99 default=7 label='Seed'}} ${holdControl(2.5)} {{font: text default="${SANS}" label='Font'}} {{handFont: text default="${HAND}" label='Handwriting font'}} --><g id="scribbleOutAll"><text id="scribbleOutWord" x="{{x}}" y="{{wordBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{wordSize}}" font-weight="700" textLength="{{wordW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="0">{{word}}</text><path id="scribbleOutScribble" d="{{scribble}}" fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/><text id="scribbleOutFix" x="{{fixX}}" y="{{fixY}}" text-anchor="{{fixAnchor}}" transform="rotate(-5 {{fixX}} {{fixY}})" font-family="{{handFont}}" font-size="{{fixSize}}" font-weight="700" fill="{{fix}}">{{replacement}}</text></g></svg>`,
  animate: [
    { id: "scribbleOutWord", attrs: { opacity: [0, n("wordOpacity")] }, ms: 300, ease: "out" },
    { id: "scribbleOutScribble", draw: true, delay: 300, ms: 1000, ease: "in-out" },
    { id: "scribbleOutFix", write: "{{replacement}}", delay: 1300, ms: n("writeMs"), ease: "linear" },
    { id: "scribbleOutAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const scribbleOut: VectorEffect = {
  kind: "vector",
  id: "scribble-out",
  name: "Scribble out",
  description: "A word scribbled out in a back-and-forth cross-hatch, then a replacement handwritten beside it.",
  category: "annotation",
  tags: ["annotation", "hand-drawn", "scribble", "strike", "correction", "draw-on", "edit"],
  hold: 300,
  presets: [
    { name: "Red and blue", values: { color: [0.94, 0.27, 0.27], fix: [0.15, 0.39, 0.92] } },
    { name: "Over a screenshot", values: { showWord: false, color: [0.94, 0.27, 0.27], fix: [0.94, 0.27, 0.27] } },
    { name: "Black marker", values: { color: [0.07, 0.07, 0.07], width: 10, fix: [0.86, 0.15, 0.15] } },
  ],
  derived: (v) => {
    const [X, Y] = [px(v.x), py(v.y)];
    const word = fit(v.word, 1400, Number(v.size));
    const rand = random(v.seed);
    const [left, right] = [X - word.width / 2 - 10, X + word.width / 2 + 10];
    const [top, bottom] = [Y - word.size * 0.46, Y + word.size * 0.32];
    const step = Math.max(6, word.size * 0.12);
    const jitter = () => (rand() - 0.5) * word.size * 0.1;
    const pts: Point[] = [];
    // There and back: a zigzag one way, then another slanted the other way over it.
    for (let x = left, k = 0; x <= right + step / 2; x += step, k++) pts.push([Math.min(x, right) + (k % 2 ? step * 0.4 : 0), (k % 2 ? top : bottom) + jitter()]);
    for (let x = right, k = 0; x >= left - step / 2; x -= step * 1.1, k++) pts.push([Math.max(x, left) - (k % 2 ? step * 0.4 : 0), (k % 2 ? bottom : top) + jitter() + word.size * 0.04]);
    const roomRight = 1824 - (X + word.width / 2 + 24);
    const beside = roomRight >= 280;
    const fix = fit(v.replacement, beside ? roomRight : 1600, word.size * 0.9);
    return {
      ...outTimes(scribbleOutMotion, 1300 + writing(v.replacement, 70) + 150 + ms(v.hold)),
      x: X,
      wordSize: word.size,
      wordW: word.width,
      wordBase: r1(Y + word.size * 0.35),
      wordOpacity: v.showWord ? 1 : 0,
      scribble: `M${pts.map(pt).join(" L")}`,
      fixX: r1(beside ? X + word.width / 2 + 24 : X),
      fixY: r1(beside ? Y - word.size * 0.5 : Y - word.size * 0.75),
      fixAnchor: beside ? "start" : "middle",
      fixSize: fix.size,
      writeMs: writing(v.replacement, 70),
    };
  },
  motion: scribbleOutMotion,
};

// ── Step badges ────────────────────────────────────────────────────────

const STEPS = 4;
const STEP_GAP = 450;
const STEP_SPOTS: readonly Point[] = [[24, 30], [58, 24], [36, 64], [72, 70]];
const STEP_LABELS = ["Open settings", "Pick a theme", "Hit save", "Share it"];

const stepBadgesMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{count: int min=1 max=${STEPS} default=3 label='Steps'}} ${Array.from({ length: STEPS }, (_, i) => `{{l${i + 1}: text default='${STEP_LABELS[i]}' label='Step ${i + 1}'}} ${at(`x${i + 1}`, STEP_SPOTS[i]![0], `Step ${i + 1}`, "x")} ${at(`y${i + 1}`, STEP_SPOTS[i]![1], `Step ${i + 1}`, "y")}`).join(" ")} {{accent: color default=#F97316 label='Badge'}} {{badgeInk: color default=#FFFFFF label='Number colour'}} {{plate: color default=#111827 label='Label box'}} {{labelInk: color default=#FFFFFF label='Label colour'}} ${holdControl(2.5)} {{font: text default="${SANS}" label='Font'}} --><defs><filter id="stepBadgesShadow" x="-30%" y="-60%" width="160%" height="220%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.3"/></filter></defs><g id="stepBadgesAll" filter="url(#stepBadgesShadow)">${Array.from({ length: STEPS }, (_, i) => {
    const k = i + 1;
    return `<g transform="translate({{bx${k}}} {{by${k}}})" opacity="{{v${k}}}"><g id="stepBadgesLabel${k}" opacity="0" transform="translate({{lo${k}}} 0)"><rect x="{{lr${k}}}" y="-28" width="{{lw${k}}}" height="56" rx="28" fill="{{plate}}"/><text x="{{lt${k}}}" y="{{lb${k}}}" text-anchor="middle" font-family="{{font}}" font-size="{{ls${k}}}" font-weight="600" textLength="{{ll${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{labelInk}}">{{l${k}}}</text></g><g id="stepBadgesBadge${k}" transform="scale(0)"><circle r="36" fill="{{accent}}"/><circle r="36" fill="none" stroke="{{badgeInk}}" stroke-width="4"/><text y="14" text-anchor="middle" font-family="{{font}}" font-size="38" font-weight="800" fill="{{badgeInk}}">${k}</text></g></g>`;
  }).join("")}</g></svg>`,
  animate: [
    ...Array.from({ length: STEPS }, (_, i): SvgAnimation[] => [
      ...pop(`stepBadgesBadge${i + 1}`, i * STEP_GAP, 1.18, 260),
      { id: `stepBadgesLabel${i + 1}`, attrs: { opacity: [0, 1], transform: [`translate({{lo${i + 1}}} 0)`, "translate(0 0)"] }, delay: i * STEP_GAP + 220, ms: 380, ease: "out" },
    ]).flat(),
    { id: "stepBadgesAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const stepBadges: VectorEffect = {
  kind: "vector",
  id: "step-badges",
  name: "Step badges",
  description: "Numbered step badges popping in one after another at points on a screen, each with a label sliding out beside it.",
  category: "annotation",
  tags: ["annotation", "steps", "badges", "numbers", "tutorial", "onboarding", "product"],
  hold: 300,
  presets: [
    { name: "Orange", values: { accent: [0.98, 0.45, 0.09] } },
    { name: "Light", values: { accent: [0.15, 0.39, 0.92], plate: [1, 1, 1], labelInk: [0.07, 0.09, 0.15] } },
    { name: "Four steps", values: { count: 4 } },
  ],
  derived: (v) => {
    const count = clamp(Math.round(Number(v.count)) || 1, 1, STEPS);
    const out: Record<string, string | number> = { ...outTimes(stepBadgesMotion, (count - 1) * STEP_GAP + 700 + ms(v.hold)) };
    for (let k = 1; k <= STEPS; k++) {
      const [x, y] = [px(v[`x${k}`]), py(v[`y${k}`])];
      const label = fit(v[`l${k}`], 520, 28);
      const w = label.width + 44;
      // Labels sit right of their badge, or left of it near the right edge.
      const left = x + 46 + w > 1824;
      out[`bx${k}`] = x;
      out[`by${k}`] = y;
      out[`v${k}`] = k <= count ? 1 : 0;
      out[`lw${k}`] = r1(w);
      out[`lr${k}`] = left ? -r1(46 + w) : 46;
      out[`lt${k}`] = left ? -r1(46 + w / 2) : r1(46 + w / 2);
      out[`lo${k}`] = left ? 24 : -24;
      out[`ls${k}`] = label.size;
      out[`ll${k}`] = label.width;
      out[`lb${k}`] = r1(label.size * 0.35);
    }
    return out;
  },
  motion: stepBadgesMotion,
};

// ── Focus box ──────────────────────────────────────────────────────────

const FOCUS: readonly (readonly [number, number, number, number])[] = [[30, 32, 30, 24], [70, 40, 34, 30], [50, 76, 60, 18]];
const box = (k: number) => ["x", "y", "width", "height"].map((a) => `{{${a}${k}}}`);
const between = (from: number, to: number) => Object.fromEntries(["x", "y", "width", "height"].map((a, i) => [a, [box(from)[i]!, box(to)[i]!] as const]));

const focusBoxMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{stops: int min=2 max=3 default=3 label='Stops'}} ${FOCUS.map(([x, y, w, h], i) => `${at(`cx${i + 1}`, x, `Stop ${i + 1}`, "x")} ${at(`cy${i + 1}`, y, `Stop ${i + 1}`, "y")} {{w${i + 1}: float min=2 max=100 default=${w} step=0.5 label='Stop ${i + 1} width (%)'}} {{h${i + 1}: float min=2 max=100 default=${h} step=0.5 label='Stop ${i + 1} height (%)'}}`).join(" ")} {{dim: color default=#000000 label='Dim'}} {{dimOpacity: float min=0 max=1 default=0.62 step=0.02 label='Dim opacity'}} {{ring: color default=#FACC15 label='Outline'}} {{ringWidth: float min=0 max=16 default=4 step=0.5 label='Outline width'}} {{radius: float min=0 max=80 default=18 step=1 label='Corner radius'}} ${holdControl(1.5, "Hold at each stop (s)")} --><defs><mask id="focusBoxMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect width="1920" height="1080" fill="#FFFFFF"/><rect id="focusBoxHole" x="{{x1}}" y="{{y1}}" width="{{width1}}" height="{{height1}}" rx="{{radius}}" fill="#000000"/></mask></defs><rect id="focusBoxDim" width="1920" height="1080" fill="{{dim}}" opacity="0" mask="url(#focusBoxMask)"/><rect id="focusBoxRing" x="{{x1}}" y="{{y1}}" width="{{width1}}" height="{{height1}}" rx="{{radius}}" fill="none" stroke="{{ring}}" stroke-width="{{ringWidth}}" opacity="0"/></svg>`,
  animate: [
    { id: "focusBoxDim", attrs: { opacity: [0, n("dimOpacity")] }, ms: 500, ease: "out" },
    { id: "focusBoxRing", attrs: { opacity: [0, 1] }, delay: 200, ms: 400, ease: "out" },
    ...["focusBoxHole", "focusBoxRing"].flatMap((id): SvgAnimation[] => [
      { id, attrs: between(1, 2), delay: n("move2"), ms: 700, ease: "in-out" },
      { id, attrs: between(2, 3), delay: n("move3"), ms: n("move3ms"), ease: "in-out" },
    ]),
    { id: "focusBoxRing", attrs: { opacity: [1, 0] }, delay: after(0), ms: 300 },
    { id: "focusBoxDim", attrs: { opacity: [n("dimOpacity"), 0] }, delay: after(100), ms: 450 },
  ],
};

export const focusBox: VectorEffect = {
  kind: "vector",
  id: "focus-box",
  name: "Focus box",
  description: "A spotlight dimming a screen everywhere but a rounded box, which glides from one region to the next and the next.",
  category: "annotation",
  tags: ["annotation", "spotlight", "focus", "highlight", "dim", "tutorial", "product", "walkthrough"],
  hold: 300,
  presets: [
    { name: "Yellow outline", values: { ring: [0.98, 0.8, 0.08] } },
    { name: "Soft", values: { dimOpacity: 0.4, ringWidth: 0, radius: 32 } },
    { name: "Light", values: { dim: [1, 1, 1], dimOpacity: 0.7, ring: [0.15, 0.39, 0.92] } },
  ],
  derived: (v) => {
    const stops = Math.round(Number(v.stops)) >= 3 ? 3 : 2;
    const hold = ms(v.hold);
    const move2 = 500 + hold;
    const move3 = move2 + 700 + (stops === 3 ? hold : 0);
    const out: Record<string, number> = {
      ...outTimes(focusBoxMotion, (stops === 3 ? move3 + 700 : move2 + 700) + hold),
      move2,
      move3,
      move3ms: stops === 3 ? 700 : 0,
    };
    for (let k = 1; k <= 3; k++) {
      // With two stops, the third is the second, so nothing moves.
      const s = stops === 2 && k === 3 ? 2 : k;
      const [w, h] = [px(v[`w${s}`]), py(v[`h${s}`])];
      out[`x${k}`] = r1(px(v[`cx${s}`]) - w / 2);
      out[`y${k}`] = r1(py(v[`cy${s}`]) - h / 2);
      out[`width${k}`] = w;
      out[`height${k}`] = h;
    }
    return out;
  },
  motion: focusBoxMotion,
};

// ── Fake cursor ────────────────────────────────────────────────────────

const press = (s: number) => `scale(${s})`;

const fakeCursorMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{typed: text default='hello@flair.dev' label='Typed text'}} ${at("sx", 82, "Start", "x")} ${at("sy", 86, "Start", "y")} ${at("cx", 28, "Click", "x")} ${at("cy", 30, "Click", "y")} ${at("dx", 52, "Drag to", "x")} ${at("dy", 52, "Drag to", "y")} ${at("fx", 62, "Text field", "x")} ${at("fy", 74, "Text field", "y")} {{field: bool default=true label='Draw the text field'}} {{accent: color default=#3B82F6 label='Accent'}} {{fieldColor: color default=#FFFFFF label='Field'}} {{fieldBorder: color default=#CBD5E1 label='Field border'}} {{ink: color default=#0F172A label='Text colour'}} {{pointer: color default=#FFFFFF label='Cursor'}} {{size: float min=14 max=64 default=30 step=1 label='Text size'}} ${holdControl(2)} {{font: text default="${SANS}" label='Font'}} --><g id="fakeCursorAll"><rect id="fakeCursorMarquee" x="{{cx}}" y="{{cy}}" width="0" height="0" fill="{{accent}}" fill-opacity="0.15" stroke="{{accent}}" stroke-width="2" stroke-dasharray="8 6"/><rect id="fakeCursorField" x="{{fieldX}}" y="{{fieldY}}" width="{{fieldW}}" height="{{fieldH}}" rx="10" fill="{{fieldColor}}" stroke="{{fieldBorder}}" stroke-width="3" opacity="{{fieldOpacity}}"/><text id="fakeCursorTyped" x="{{textX}}" y="{{textBase}}" font-family="{{font}}" font-size="{{size}}" fill="{{ink}}" xml:space="preserve">{{typed}}</text><circle id="fakeCursorRipple1" cx="{{cx}}" cy="{{cy}}" r="0" fill="{{accent}}" opacity="0"/><circle id="fakeCursorRipple2" cx="{{kx}}" cy="{{ky}}" r="0" fill="{{accent}}" opacity="0"/><g id="fakeCursorPos" transform="translate({{sx}} {{sy}})" opacity="0"><g id="fakeCursorPress" transform="${press(1.3)}"><path d="${CURSOR}" fill="{{pointer}}" stroke="#111111" stroke-width="2" stroke-linejoin="round"/></g></g></g></svg>`,
  animate: [
    { id: "fakeCursorPos", attrs: { opacity: [0, 1] }, ms: 300, ease: "out" },
    { id: "fakeCursorPos", attrs: { transform: ["translate({{sx}} {{sy}})", "translate({{cx}} {{cy}})"] }, delay: 300, ms: 800, ease: "in-out" },
    // Click.
    { id: "fakeCursorPress", attrs: { transform: [press(1.3), press(1.1)] }, delay: 1100, ms: 100, ease: "out" },
    { id: "fakeCursorPress", attrs: { transform: [press(1.1), press(1.3)] }, delay: 1200, ms: 120, ease: "out" },
    { id: "fakeCursorRipple1", attrs: { r: [0, 60], opacity: [0.45, 0] }, delay: 1100, ms: 500, ease: "out" },
    // Press, drag out a selection, let go.
    { id: "fakeCursorPress", attrs: { transform: [press(1.3), press(1.1)] }, delay: 1500, ms: 100, ease: "out" },
    { id: "fakeCursorPos", attrs: { transform: ["translate({{cx}} {{cy}})", "translate({{dx}} {{dy}})"] }, delay: 1600, ms: 1000, ease: "in-out" },
    { id: "fakeCursorMarquee", attrs: { x: [n("cx"), n("mx")], y: [n("cy"), n("my")], width: [0, n("mw")], height: [0, n("mh")] }, delay: 1600, ms: 1000, ease: "in-out" },
    { id: "fakeCursorPress", attrs: { transform: [press(1.1), press(1.3)] }, delay: 2600, ms: 120, ease: "out" },
    { id: "fakeCursorMarquee", attrs: { opacity: [1, 0] }, delay: 2800, ms: 300, ease: "linear" },
    // Click into the field and type.
    { id: "fakeCursorPos", attrs: { transform: ["translate({{dx}} {{dy}})", "translate({{kx}} {{ky}})"] }, delay: 2900, ms: 800, ease: "in-out" },
    { id: "fakeCursorPress", attrs: { transform: [press(1.3), press(1.1)] }, delay: 3700, ms: 100, ease: "out" },
    { id: "fakeCursorPress", attrs: { transform: [press(1.1), press(1.3)] }, delay: 3800, ms: 120, ease: "out" },
    { id: "fakeCursorRipple2", attrs: { r: [0, 60], opacity: [0.45, 0] }, delay: 3700, ms: 500, ease: "out" },
    { id: "fakeCursorField", attrs: { stroke: ["{{fieldBorder}}", "{{accent}}"] }, delay: 3700, ms: 200, ease: "linear" },
    // The caret shows once the field has focus, and the cursor steps aside to let the text be read.
    { id: "fakeCursorTyped", attrs: { opacity: [0, 0] }, ms: 0 },
    { id: "fakeCursorTyped", attrs: { opacity: [1, 1] }, delay: 3800, ms: 0 },
    { id: "fakeCursorPos", attrs: { transform: ["translate({{kx}} {{ky}})", "translate({{ax}} {{ay}})"] }, delay: 3950, ms: 500, ease: "in-out" },
    { id: "fakeCursorTyped", write: "{{typed}}", caret: "|", delay: 4000, ms: n("typeMs"), ease: "linear" },
    { id: "fakeCursorAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const fakeCursor: VectorEffect = {
  kind: "vector",
  id: "fake-cursor",
  name: "Fake cursor",
  description: "A product-demo cursor over a screen: it glides to a point and clicks with a ripple, drags out a selection, then clicks a text field and types.",
  category: "annotation",
  tags: ["annotation", "cursor", "pointer", "demo", "product", "click", "typing", "walkthrough"],
  hold: 300,
  presets: [
    { name: "Light UI", values: { accent: [0.23, 0.51, 0.96] } },
    { name: "Dark UI", values: { fieldColor: [0.07, 0.09, 0.15], fieldBorder: [0.2, 0.25, 0.33], ink: [0.95, 0.96, 0.98], accent: [0.13, 0.83, 0.93] } },
    { name: "Over a screenshot", values: { field: false } },
  ],
  derived: (v) => {
    const [cx, cy, dx, dy, fx, fy] = [px(v.cx), py(v.cy), px(v.dx), py(v.dy), px(v.fx), py(v.fy)];
    const size = Number(v.size);
    const text = fit(v.typed, 1400, size);
    const fieldW = Math.max(360, text.width + 72);
    const fieldX = clamp(fx - fieldW / 2, 24, Math.max(24, 1896 - fieldW));
    const fieldH = size + 40;
    return {
      ...outTimes(fakeCursorMotion, 4000 + writing(v.typed, 65) + 300 + ms(v.hold)),
      sx: px(v.sx),
      sy: py(v.sy),
      cx,
      cy,
      dx,
      dy,
      mx: Math.min(cx, dx),
      my: Math.min(cy, dy),
      mw: r1(Math.abs(dx - cx)),
      mh: r1(Math.abs(dy - cy)),
      fieldX: r1(fieldX),
      fieldY: r1(fy - fieldH / 2),
      fieldW: r1(fieldW),
      fieldH: r1(fieldH),
      fieldOpacity: v.field ? 1 : 0,
      textX: r1(fieldX + 28),
      textBase: r1(fy + size * 0.35),
      kx: r1(fieldX + 40),
      ky: fy,
      ax: r1(fieldX + 40 + 50),
      ay: r1(fy + fieldH / 2 + 50),
      typeMs: writing(v.typed, 65),
    };
  },
  motion: fakeCursorMotion,
};

// ── Tooltip tour ───────────────────────────────────────────────────────

const TOUR: readonly Point[] = [[22, 22], [70, 34], [44, 74]];
const TOUR_TITLES = ["Search anything from here", "Your projects live here", "Invite your team"];
const TOUR_IN = 400;
const TOUR_MOVE = 600;

const tooltipTourMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- ${TOUR.map(([x, y], i) => `{{t${i + 1}: text default='${TOUR_TITLES[i]}' label='Step ${i + 1}'}} ${at(`x${i + 1}`, x, `Target ${i + 1}`, "x")} ${at(`y${i + 1}`, y, `Target ${i + 1}`, "y")}`).join(" ")} {{radius: float min=10 max=200 default=54 step=1 label='Highlight radius'}} {{accent: color default=#8B5CF6 label='Accent'}} {{plate: color default=#FFFFFF label='Tooltip'}} {{ink: color default=#111827 label='Text colour'}} {{muted: color default=#6B7280 label='Counter colour'}} {{size: float min=16 max=48 default=28 step=1 label='Text size'}} ${holdControl(1.8, "Hold at each step (s)")} {{font: text default="${SANS}" label='Font'}} --><defs><filter id="tooltipTourShadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/></filter></defs><g id="tooltipTourAll" opacity="0"><circle id="tooltipTourHalo" cx="{{hx1}}" cy="{{hy1}}" r="0" fill="{{accent}}" fill-opacity="0.16" stroke="{{accent}}" stroke-width="4"/><g filter="url(#tooltipTourShadow)"><path id="tooltipTourArrow" d="{{arrow1}}" fill="{{plate}}"/><g id="tooltipTourTip" transform="translate({{tx1}} {{ty1}})"><rect width="{{tipW}}" height="{{tipH}}" rx="14" fill="{{plate}}"/>${[1, 2, 3]
    .map((k) => `<text id="tooltipTourTitle${k}" x="28" y="{{titleBase}}" font-family="{{font}}" font-size="{{s${k}}}" font-weight="700" textLength="{{w${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="${k === 1 ? 1 : 0}">{{t${k}}}</text>`)
    .join("")}<text id="tooltipTourCount" x="28" y="{{countBase}}" font-family="{{font}}" font-size="22" font-weight="600" fill="{{muted}}">1 / 3</text>${[0, 1, 2].map((k) => `<circle cx="{{dot${k}}}" cy="{{dotY}}" r="5" fill="{{muted}}" fill-opacity="0.35"/>`).join("")}<rect id="tooltipTourActive" x="{{pill0}}" y="{{pillY}}" width="22" height="10" rx="5" fill="{{accent}}"/></g></g></g></svg>`,
  animate: [
    { id: "tooltipTourAll", attrs: { opacity: [0, 1] }, ms: TOUR_IN, ease: "out" },
    { id: "tooltipTourHalo", attrs: { r: [0, n("radius")] }, ms: TOUR_IN, ease: "out" },
    ...[2, 3].flatMap((k): SvgAnimation[] => {
      const t = n(`m${k}`);
      return [
        { id: "tooltipTourTip", attrs: { transform: [`translate({{tx${k - 1}}} {{ty${k - 1}}})`, `translate({{tx${k}}} {{ty${k}}})`] }, delay: t, ms: TOUR_MOVE, ease: "in-out" },
        { id: "tooltipTourArrow", attrs: { d: [`{{arrow${k - 1}}}`, `{{arrow${k}}}`] }, delay: t, ms: TOUR_MOVE, ease: "in-out" },
        { id: "tooltipTourHalo", attrs: { cx: [n(`hx${k - 1}`), n(`hx${k}`)], cy: [n(`hy${k - 1}`), n(`hy${k}`)] }, delay: t, ms: TOUR_MOVE, ease: "in-out" },
        { id: `tooltipTourTitle${k - 1}`, attrs: { opacity: [1, 0] }, delay: t, ms: 200, ease: "linear" },
        { id: `tooltipTourTitle${k}`, attrs: { opacity: [0, 1] }, delay: n(`f${k}`), ms: 250, ease: "linear" },
        { id: "tooltipTourCount", write: `${k} / 3`, delay: n(`f${k}`), ms: 0 },
        { id: "tooltipTourActive", attrs: { x: [n(`pill${k - 2}`), n(`pill${k - 1}`)] }, delay: t, ms: 400, ease: "in-out" },
      ];
    }),
    { id: "tooltipTourAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const tooltipTour: VectorEffect = {
  kind: "vector",
  id: "tooltip-tour",
  name: "Tooltip tour",
  description: "A guided-tour tooltip moving between three highlighted spots on a screen, its text changing with a 1/3, 2/3, 3/3 counter and a progress dot.",
  category: "annotation",
  tags: ["annotation", "tooltip", "tour", "onboarding", "walkthrough", "product", "ui"],
  hold: 300,
  presets: [
    { name: "Violet", values: { accent: [0.55, 0.36, 0.96] } },
    { name: "Dark", values: { plate: [0.07, 0.09, 0.15], ink: [1, 1, 1], muted: [0.6, 0.64, 0.7], accent: [0.13, 0.83, 0.93] } },
    { name: "Blue", values: { accent: [0.15, 0.39, 0.92] } },
  ],
  derived: (v) => {
    const size = Number(v.size);
    const r = Number(v.radius);
    const titles = [1, 2, 3].map((k) => fit(v[`t${k}`], 700, size));
    const w = Math.max(340, ...titles.map((t) => t.width + 56));
    const h = size + 92;
    const hold = ms(v.hold);
    const m2 = TOUR_IN + hold;
    const m3 = m2 + TOUR_MOVE + hold;
    const out: Record<string, string | number> = {
      ...outTimes(tooltipTourMotion, m3 + TOUR_MOVE + hold),
      m2,
      m3,
      f2: m2 + 300,
      f3: m3 + 300,
      radius: r,
      tipW: r1(w),
      tipH: r1(h),
      titleBase: r1(26 + size * 0.8),
      countBase: r1(h - 24),
      dotY: r1(h - 31),
      pillY: r1(h - 36),
    };
    [1, 2, 3].forEach((k, i) => {
      const [x, y] = [px(v[`x${k}`]), py(v[`y${k}`])];
      const left = clamp(x - w / 2, 96, Math.max(96, 1824 - w));
      const below = y + r + 22 + h <= 1000;
      const top = below ? y + r + 22 : y - r - 22 - h;
      const ax = clamp(x, left + 28, left + w - 28);
      const edge = below ? top : top + h;
      const tip = below ? edge - 14 : edge + 14;
      out[`s${k}`] = titles[i]!.size;
      out[`w${k}`] = titles[i]!.width;
      out[`hx${k}`] = x;
      out[`hy${k}`] = y;
      out[`tx${k}`] = r1(left);
      out[`ty${k}`] = r1(top);
      out[`arrow${k}`] = `M${r1(ax - 14)} ${r1(edge)} L${r1(ax)} ${r1(tip)} L${r1(ax + 14)} ${r1(edge)} Z`;
      out[`dot${i}`] = r1(w - 28 - (2 - i) * 24);
      out[`pill${i}`] = r1(w - 28 - (2 - i) * 24 - 11);
    });
    return out;
  },
  motion: tooltipTourMotion,
};

/** Annotations and product-demo overlays, transparent over a screenshot or video. */
export const annotationEffects: VectorEffect[] = [handCircle, handArrow, callout, bracketNote, scribbleOut, stepBadges, focusBox, fakeCursor, tooltipTour];
