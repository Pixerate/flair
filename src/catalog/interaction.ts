import { rgbToHex } from "../shader/controls.js";
import { morphPaths } from "../vector/morph.js";
import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * UI micro-interactions play in answer to the pointer (`trigger`), not on a
 * loop. Hover and press pictures play to their end while hovered or held and
 * back after, so each is designed to look right backwards too. Click
 * pictures change on steps: a toggle turns on with step 1 and back off with
 * step 2, ending exactly as it started; a one-shot (copy, send, download)
 * has a single step that returns by itself, so every click replays it.
 * Elements a step only flashes (a ring, particles, a tick) snap back to their
 * starting values once hidden, so each round starts from the same look.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`count`, `ms`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** `a` mixed `t` of the way to `b`, colours as written by vector controls ([r, g, b] 0–1). */
const mixHex = (a: unknown, b: unknown, t: number) => {
  const x = (Array.isArray(a) ? a : [1, 1, 1]) as number[];
  const y = (Array.isArray(b) ? b : [1, 1, 1]) as number[];
  return rgbToHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t));
};

/** Text fitted to `width` units, at most `max` high: its font size and width. */
function fit(text: unknown, width: number, max: number) {
  const e = Math.max(0.6, textWidthEm(String(text)));
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size) };
}

/** A transform scaling by `s` about (`cx`, `cy`). */
const about = (cx: number, cy: number, s: number) => `translate(${cx} ${cy}) scale(${r2(s)}) translate(${-cx} ${-cy})`;

/** Instant changes: the attribute snaps to `value` at `delay` (resets of hidden elements). */
const snap = (id: string, attr: string, value: string | number, delay: number, step = 1): SvgAnimation => ({
  id,
  step,
  attrs: { [attr]: [value, value] },
  delay,
  ms: 0,
});

const SANS = `system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

/** A heart in a 24 box, curves and all. */
const HEART = "M12 20.5 C12 20.5 3 14.8 3 8.8 C3 6 5.2 3.8 8 3.8 C9.7 3.8 11.2 4.7 12 6.1 C12.8 4.7 14.3 3.8 16 3.8 C18.8 3.8 21 6 21 8.8 C21 14.8 12 20.5 12 20.5 Z";

/** Like button's burst: particles round the heart, from and to these radii. */
const PARTICLES = 8;
const BURST_FROM = 22;
const BURST_TO = 46;
const HEART_X = 72;
const HEART_Y = 60;
/** The heart's group: centred on the heart, scaled by `k` (1 at rest). */
const heartPose = (k: number) => `translate(${HEART_X} ${HEART_Y}) scale(${r2(2.2 * k)}) translate(-12 -12)`;

export const likeButton: VectorEffect = {
  kind: "vector",
  id: "like-button",
  name: "Like button",
  description: "A heart that fills with a springy pop, a ring and a burst of particles as its like count ticks up, and empties again on the next click.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "like", "heart", "toggle", "social", "micro-interaction"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], chip: [0.13, 0.14, 0.19], outline: [0.6, 0.63, 0.7], ink: [0.9, 0.91, 0.95] } },
    { name: "Purple", values: { heart: [0.6, 0.3, 1], accent: [1, 0.4, 0.75], count: 1204 } },
  ],
  derived: (v) => ({ liked: Number(v.count) + 1 }),
  motion: {
    svg: `<svg viewBox="0 0 240 120"><!-- {{count: int min=0 max=99999 default=42 label='Start count'}} {{background: color default=#FFFFFF label='Background'}} {{chip: color default=#F3F4F6 label='Button'}} {{outline: color default=#6B7280 label='Outline'}} {{heart: color default=#F43F5E label='Heart'}} {{accent: color default=#FB923C label='Sparks'}} {{ink: color default=#111827 label='Count colour'}} --><rect width="240" height="120" fill="{{background}}"/><rect x="20" y="24" width="200" height="72" rx="36" fill="{{chip}}"/><circle id="ring" cx="${HEART_X}" cy="${HEART_Y}" r="14" fill="none" stroke="{{heart}}" stroke-width="0"/>${Array.from(
      { length: PARTICLES },
      (_, k) => {
        const a = ((k * 360) / PARTICLES - 90) * (Math.PI / 180);
        return `<circle id="p${k}" cx="${r1(HEART_X + BURST_FROM * Math.cos(a))}" cy="${r1(HEART_Y + BURST_FROM * Math.sin(a))}" r="0" fill="${k % 2 ? "{{accent}}" : "{{heart}}"}"/>`;
      },
    ).join("")}<g id="hg" transform="${heartPose(1)}"><path id="heartShape" d="${HEART}" fill="{{heart}}" fill-opacity="0" stroke="{{outline}}" stroke-width="1.8" stroke-linejoin="round"/></g><text id="tally" x="106" y="70.5" font-family="${SANS}" font-size="30" font-weight="700" fill="{{ink}}">{{count}}</text></svg>`,
    animate: [
      // Step 1, like: squash, pop past full size and settle while it fills.
      { id: "hg", step: 1, attrs: { transform: [heartPose(1), heartPose(0.78)] }, ms: 110, ease: "out" },
      { id: "hg", step: 1, attrs: { transform: [heartPose(0.78), heartPose(1.22)] }, delay: 110, ms: 170, ease: "out" },
      { id: "hg", step: 1, attrs: { transform: [heartPose(1.22), heartPose(1)] }, delay: 280, ms: 220, ease: "in-out" },
      { id: "heartShape", step: 1, attrs: { "fill-opacity": [0, 1], stroke: ["{{outline}}", "{{heart}}"] }, delay: 110, ms: 120 },
      // The ring and sparks burst out, then snap back once they are gone.
      snap("ring", "stroke-width", 0, 0),
      { id: "ring", step: 1, attrs: { r: [14, 44], "stroke-width": [10, 0] }, delay: 130, ms: 480, ease: "out" },
      snap("ring", "r", 14, 700),
      ...Array.from({ length: PARTICLES }, (_, k): SvgAnimation[] => {
        const a = ((k * 360) / PARTICLES - 90) * (Math.PI / 180);
        const [x0, y0] = [r1(HEART_X + BURST_FROM * Math.cos(a)), r1(HEART_Y + BURST_FROM * Math.sin(a))];
        const [x1, y1] = [r1(HEART_X + BURST_TO * Math.cos(a)), r1(HEART_Y + BURST_TO * Math.sin(a))];
        return [
          snap(`p${k}`, "r", 0, 0),
          { id: `p${k}`, step: 1, attrs: { cx: [x0, x1], cy: [y0, y1], r: [4.5, 0] }, delay: 150, ms: 520, ease: "out" },
          snap(`p${k}`, "cx", x0, 700),
          snap(`p${k}`, "cy", y0, 700),
        ];
      }).flat(),
      { id: "tally", step: 1, count: [n("count"), n("liked")], attrs: { fill: ["{{ink}}", "{{heart}}"] }, delay: 150, ms: 260, ease: "out" },
      // Step 2, unlike: a small dip as it empties and the count goes back.
      { id: "hg", step: 2, attrs: { transform: [heartPose(1), heartPose(0.86)] }, ms: 120, ease: "out" },
      { id: "hg", step: 2, attrs: { transform: [heartPose(0.86), heartPose(1)] }, delay: 120, ms: 200, ease: "in-out" },
      { id: "heartShape", step: 2, attrs: { "fill-opacity": [1, 0], stroke: ["{{heart}}", "{{outline}}"] }, ms: 180 },
      { id: "tally", step: 2, count: [n("liked"), n("count")], attrs: { fill: ["{{heart}}", "{{ink}}"] }, ms: 220, ease: "out" },
    ],
  },
};

export const toggleSwitch: VectorEffect = {
  kind: "vector",
  id: "toggle-switch",
  name: "Toggle switch",
  description: "A switch whose knob slides across, squashing a little mid-slide, as the track blends to its on colour; the next click slides it back.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "toggle", "switch", "settings", "micro-interaction"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "iOS", values: { on: [0.2, 0.78, 0.35] } },
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], off: [0.22, 0.24, 0.3], on: [0.55, 0.45, 1], knob: [0.96, 0.96, 1] } },
  ],
  motion: ((): SvgMotion => {
    const slide = (from: number, to: number, step: number): SvgAnimation[] => [
      { id: "slide", step, attrs: { transform: [`translate(${from} 0)`, `translate(${to} 0)`] }, ms: 320, ease: "in-out" },
      // Stretched along the slide and flattened halfway, round again at the end.
      { id: "knob", step, attrs: { rx: [19, 24], ry: [19, 16.5] }, ms: 160, ease: "out" },
      { id: "knob", step, attrs: { rx: [24, 19], ry: [16.5, 19] }, delay: 160, ms: 160, ease: "in-out" },
    ];
    return {
      svg: `<svg viewBox="0 0 200 120"><!-- {{background: color default=#FFFFFF label='Background'}} {{off: color default=#D1D5DB label='Track off'}} {{on: color default=#6366F1 label='Track on'}} {{knob: color default=#FFFFFF label='Knob'}} --><rect width="200" height="120" fill="{{background}}"/><rect id="track" x="40" y="35" width="120" height="50" rx="25" fill="{{off}}"/><g id="slide" transform="translate(0 0)"><ellipse cx="65" cy="62.5" rx="18" ry="18" fill="#000000" opacity="0.16"/><ellipse id="knob" cx="65" cy="60" rx="19" ry="19" fill="{{knob}}"/></g></svg>`,
      animate: [
        ...slide(0, 70, 1),
        { id: "track", step: 1, attrs: { fill: ["{{off}}", "{{on}}"] }, ms: 320, ease: "in-out" },
        ...slide(70, 0, 2),
        { id: "track", step: 2, attrs: { fill: ["{{on}}", "{{off}}"] }, ms: 320, ease: "in-out" },
      ],
    };
  })(),
};

export const checkbox: VectorEffect = {
  kind: "vector",
  id: "checkbox",
  name: "Checkbox",
  description: "A labelled checkbox that fills with a press and draws its tick on, then undraws it and empties on the next click.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "checkbox", "form", "toggle", "todo", "micro-interaction"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Green", values: { accent: [0.13, 0.7, 0.4] } },
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], border: [0.4, 0.43, 0.5], ink: [0.92, 0.93, 0.96], accent: [0.95, 0.6, 0.15], tick: [0.06, 0.07, 0.1] } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 216, 24);
    return { size, length, base: r1(60 + size * 0.35) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 120"><!-- {{label: text default='Remember me' label='Label'}} {{background: color default=#FFFFFF label='Background'}} {{border: color default=#9CA3AF label='Border'}} {{accent: color default=#6366F1 label='Checked'}} {{tick: color default=#FFFFFF label='Tick'}} {{ink: color default=#111827 label='Label colour'}} --><rect width="320" height="120" fill="{{background}}"/><g id="boxg" transform="${about(48, 60, 1)}"><rect id="box" x="30" y="42" width="36" height="36" rx="9" fill="{{accent}}" fill-opacity="0" stroke="{{border}}" stroke-width="3"/><path id="tick" d="M39 60.5 L45.5 67 L58 53.5" fill="none" stroke="{{tick}}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g><text x="84" y="{{base}}" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="500" fill="{{ink}}">{{label}}</text></svg>`,
    animate: [
      // Step 1, check: the box dips as it fills, then the tick draws on.
      { id: "boxg", step: 1, attrs: { transform: [about(48, 60, 1), about(48, 60, 0.86)] }, ms: 100, ease: "out" },
      { id: "boxg", step: 1, attrs: { transform: [about(48, 60, 0.86), about(48, 60, 1)] }, delay: 100, ms: 220, ease: "in-out" },
      { id: "box", step: 1, attrs: { "fill-opacity": [0, 1], stroke: ["{{border}}", "{{accent}}"] }, ms: 160 },
      // Shown only once it starts drawing: a round cap would leave a dot.
      { id: "tick", step: 1, attrs: { opacity: [0, 1] }, delay: 120, ms: 40 },
      { id: "tick", step: 1, draw: true, delay: 120, ms: 260, ease: "out" },
      // Step 2, uncheck: the tick undraws, then the box empties.
      { id: "tick", step: 2, draw: [1, 0], ms: 160, ease: "in-out" },
      { id: "tick", step: 2, attrs: { opacity: [1, 0] }, delay: 140, ms: 30 },
      { id: "box", step: 2, attrs: { "fill-opacity": [1, 0], stroke: ["{{accent}}", "{{border}}"] }, delay: 100, ms: 180 },
      { id: "boxg", step: 2, attrs: { transform: [about(48, 60, 1), about(48, 60, 0.92)] }, delay: 100, ms: 90, ease: "out" },
      { id: "boxg", step: 2, attrs: { transform: [about(48, 60, 0.92), about(48, 60, 1)] }, delay: 190, ms: 160, ease: "in-out" },
    ],
  },
};

type Point = [number, number];

/**
 * A stroke from `p` to `q`, `width` wide, as a filled outline: round ends,
 * or a flat one at `q` (where a cut stroke meets another without overlap,
 * which `evenodd` would punch a hole through).
 */
function capsule(p: Point, q: Point, width: number, flatEnd = false): string {
  const h = width / 2;
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const pts: Point[] = [];
  const cap = (c: Point, from: number) => {
    for (let k = 0; k <= 8; k++) {
      const t = from + (k * Math.PI) / 8;
      pts.push([c[0] + h * Math.cos(t), c[1] + h * Math.sin(t)]);
    }
  };
  if (flatEnd) pts.push([q[0] + h * Math.cos(a - Math.PI / 2), q[1] + h * Math.sin(a - Math.PI / 2)], [q[0] + h * Math.cos(a + Math.PI / 2), q[1] + h * Math.sin(a + Math.PI / 2)]);
  else cap(q, a - Math.PI / 2);
  cap(p, a + Math.PI / 2);
  return `M${pts.map((pt) => `${r2(pt[0])} ${r2(pt[1])}`).join(" L")} Z`;
}

const menuMorphs = new Map<number, [string, string]>();

/** Three bars and the close cross (one whole diagonal, the other cut where it meets it) at a line weight, in a 24 box, morphed once per weight. */
function menuMorph(weight: number): [string, string] {
  if (!menuMorphs.has(weight)) {
    const bars = [7, 12, 17].map((y) => capsule([5, y], [19, y], weight)).join(" ");
    // A cut stroke ends half a width from the centre, so its corners just touch the whole one.
    const meet = (weight / 2 + 0.05) / Math.SQRT2;
    const cross = [
      capsule([6.5, 6.5], [17.5, 17.5], weight),
      capsule([17.5, 6.5], [12 + meet, 12 - meet], weight, true),
      capsule([6.5, 17.5], [12 - meet, 12 + meet], weight, true),
    ].join(" ");
    menuMorphs.set(weight, morphPaths(bars, cross, { points: 48 }));
  }
  return menuMorphs.get(weight)!;
}

/** The menu icon's group: centred in the button, turned `turn` degrees. */
const menuPose = (turn: number) => `translate(60 60) rotate(${turn}) scale(3) translate(-12 -12)`;

export const menuToggle: VectorEffect = {
  kind: "vector",
  id: "menu-toggle",
  name: "Menu toggle",
  description: "A hamburger menu button whose three bars morph into a close cross as it spins half a turn, and back on the next click.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "menu", "hamburger", "close", "morph", "navigation", "micro-interaction"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], button: [0.95, 0.96, 0.97], active: [0.07, 0.09, 0.15], ink: [0.07, 0.09, 0.15], activeInk: [1, 1, 1] } },
    { name: "Bold", values: { weight: 3, button: [0.98, 0.8, 0.1], active: [0.95, 0.3, 0.2], ink: [0.1, 0.1, 0.1], activeInk: [1, 1, 1] } },
  ],
  derived: (v) => {
    const [bars, cross] = menuMorph(Math.round(Number(v.weight) * 4) / 4);
    return { bars, cross };
  },
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{weight: float min=1 max=3.5 default=2 step=0.25 label='Line weight'}} {{background: color default=#0F172A label='Background'}} {{button: color default=#1E293B label='Button'}} {{active: color default=#6366F1 label='Button open'}} {{ink: color default=#F8FAFC label='Icon'}} {{activeInk: color default=#FFFFFF label='Icon open'}} --><rect width="120" height="120" fill="{{background}}"/><rect id="bg" x="16" y="16" width="88" height="88" rx="24" fill="{{button}}"/><g id="icon" transform="${menuPose(0)}"><path id="glyph" d="{{bars}}" fill="{{ink}}" fill-rule="evenodd"/></g></svg>`,
    animate: [
      // Step 1, open: bars to cross while turning half a turn.
      { id: "glyph", step: 1, attrs: { d: ["{{bars}}", "{{cross}}"], fill: ["{{ink}}", "{{activeInk}}"] }, ms: 450, ease: "in-out" },
      { id: "icon", step: 1, attrs: { transform: [menuPose(0), menuPose(180)] }, ms: 450, ease: "in-out" },
      { id: "bg", step: 1, attrs: { fill: ["{{button}}", "{{active}}"] }, ms: 300, ease: "in-out" },
      // Step 2, close: on round the same way (-180° looks like 180°), ending where it started.
      { id: "glyph", step: 2, attrs: { d: ["{{cross}}", "{{bars}}"], fill: ["{{activeInk}}", "{{ink}}"] }, ms: 450, ease: "in-out" },
      { id: "icon", step: 2, attrs: { transform: [menuPose(-180), menuPose(0)] }, ms: 450, ease: "in-out" },
      { id: "bg", step: 2, attrs: { fill: ["{{active}}", "{{button}}"] }, ms: 300, ease: "in-out" },
    ],
  },
};

/** A bookmark with rounded top corners and a notched foot. */
const BOOKMARK = "M41 22 H79 Q84 22 84 27 V98 L60 81 L36 98 V27 Q36 22 41 22 Z";
const bounce = (y: number) => `translate(0 ${y})`;

export const bookmark: VectorEffect = {
  kind: "vector",
  id: "bookmark",
  name: "Bookmark",
  description: "A bookmark that hops and fills from top to bottom when saved, then drains and dips when unsaved.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "bookmark", "save", "toggle", "micro-interaction"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Gold", values: { fill: [0.98, 0.72, 0.1] } },
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], outline: [0.6, 0.63, 0.7], fill: [0.4, 0.8, 1] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{background: color default=#FFFFFF label='Background'}} {{outline: color default=#6B7280 label='Outline'}} {{fill: color default=#6366F1 label='Saved'}} --><defs><clipPath id="fillClip"><rect id="level" x="30" y="18" width="60" height="0"/></clipPath></defs><rect width="120" height="120" fill="{{background}}"/><g id="mark" transform="${bounce(0)}"><path d="${BOOKMARK}" fill="{{fill}}" clip-path="url(#fillClip)"/><path id="edge" d="${BOOKMARK}" fill="none" stroke="{{outline}}" stroke-width="4" stroke-linejoin="round"/></g></svg>`,
    animate: [
      // Step 1, save: a hop, a drop past rest and a settle, filling top down.
      { id: "mark", step: 1, attrs: { transform: [bounce(0), bounce(-7)] }, ms: 130, ease: "out" },
      { id: "mark", step: 1, attrs: { transform: [bounce(-7), bounce(4)] }, delay: 130, ms: 170, ease: "in-out" },
      { id: "mark", step: 1, attrs: { transform: [bounce(4), bounce(0)] }, delay: 300, ms: 200, ease: "in-out" },
      { id: "level", step: 1, attrs: { height: [0, 84] }, delay: 60, ms: 380, ease: "in-out" },
      { id: "edge", step: 1, attrs: { stroke: ["{{outline}}", "{{fill}}"] }, ms: 200 },
      // Step 2, unsave: drains top down (then the empty clip snaps back up) with a small dip.
      { id: "level", step: 2, attrs: { y: [18, 102], height: [84, 0] }, ms: 320, ease: "in-out" },
      snap("level", "y", 18, 320, 2),
      { id: "mark", step: 2, attrs: { transform: [bounce(0), bounce(3)] }, ms: 120, ease: "out" },
      { id: "mark", step: 2, attrs: { transform: [bounce(3), bounce(0)] }, delay: 120, ms: 180, ease: "in-out" },
      { id: "edge", step: 2, attrs: { stroke: ["{{fill}}", "{{outline}}"] }, delay: 100, ms: 200 },
    ],
  },
};

/**
 * A pill button's two labels, swapped on a click: the first slides up and
 * out as the second slides up and in, `back` ms later the reverse (the
 * second then drops back below, hidden, ready for the next click).
 */
const swapLabels = (outAt: number, back: number): SvgAnimation[] => [
  { id: "label", step: 1, attrs: { opacity: [1, 0], transform: ["translate(0 0)", "translate(0 -10)"] }, delay: outAt, ms: 180, ease: "out" },
  { id: "done", step: 1, attrs: { opacity: [0, 1], transform: ["translate(0 10)", "translate(0 0)"] }, delay: outAt + 120, ms: 220, ease: "out" },
  { id: "done", step: 1, attrs: { opacity: [1, 0], transform: ["translate(0 0)", "translate(0 -10)"] }, delay: back, ms: 180, ease: "out" },
  { id: "label", step: 1, attrs: { opacity: [0, 1], transform: ["translate(0 10)", "translate(0 0)"] }, delay: back + 120, ms: 220, ease: "out" },
  snap("done", "transform", "translate(0 10)", back + 200),
];

/** A check drawn on at `at` and hidden at `back`, then undrawn while hidden (so each round draws it afresh). */
const checkFlash = (at: number, back: number): SvgAnimation[] => [
  { id: "check", step: 1, attrs: { opacity: [0, 1] }, delay: at, ms: 40 },
  { id: "check", step: 1, draw: true, delay: at, ms: 280, ease: "out" },
  { id: "check", step: 1, attrs: { opacity: [1, 0] }, delay: back, ms: 160 },
  { id: "check", step: 1, draw: [0, 0], delay: back + 200, ms: 0 },
];

/** Two labels sharing a pill button's room left of an icon: one font size that fits both. */
const buttonLabels = (a: unknown, b: unknown, room: number, max: number) => {
  const ems = [a, b].map((t) => Math.max(0.6, textWidthEm(String(t))));
  const size = Math.min(max, room / Math.max(...ems));
  return { size: r1(size), base: r1(50 + size * 0.35), labelLen: r1(ems[0]! * size), doneLen: r1(ems[1]! * size) };
};

const labelTexts = (x: number) =>
  `<text id="label" x="${x}" y="{{base}}" textLength="{{labelLen}}" lengthAdjust="spacingAndGlyphs" transform="translate(0 0)" font-family="${SANS}" font-size="{{size}}" font-weight="600" fill="{{ink}}">{{label}}</text><text id="done" x="${x}" y="{{base}}" textLength="{{doneLen}}" lengthAdjust="spacingAndGlyphs" transform="translate(0 10)" opacity="0" font-family="${SANS}" font-size="{{size}}" font-weight="600" fill="{{ink}}">{{doneText}}</text>`;

/** When the copy button turns back. */
const COPY_BACK = 1600;
const copyPose = (s: number) => `translate(54 50) scale(${r2(1.2 * s)}) translate(-12 -12)`;

export const copyButton: VectorEffect = {
  kind: "vector",
  id: "copy-button",
  name: "Copy button",
  description: "A copy button whose icon shrinks away for a drawn check and a “Copied!” label, turning back by itself a moment later.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "copy", "clipboard", "feedback", "button", "micro-interaction"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], button: [0.95, 0.96, 0.97], success: [0.86, 0.97, 0.9], ink: [0.07, 0.09, 0.15] } },
    { name: "Code", values: { label: "Copy code", doneText: "Copied to clipboard", button: [0.2, 0.22, 0.28] } },
  ],
  derived: (v) => buttonLabels(v.label, v.doneText, 126, 19),
  motion: {
    svg: `<svg viewBox="0 0 240 100"><!-- {{label: text default='Copy' label='Label'}} {{doneText: text default='Copied!' label='Copied label'}} {{background: color default=#0F172A label='Background'}} {{button: color default=#1E293B label='Button'}} {{success: color default=#166534 label='Copied'}} {{ink: color default=#F8FAFC label='Text and icon'}} --><rect width="240" height="100" fill="{{background}}"/><rect id="btn" x="20" y="24" width="200" height="52" rx="14" fill="{{button}}"/><g id="copy" transform="${copyPose(1)}" opacity="1" fill="none" stroke="{{ink}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M4.5 15.5 V6.5 C4.5 5.4 5.4 4.5 6.5 4.5 H15.5"/></g><g transform="${copyPose(1)}"><path id="check" d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="{{ink}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g>${labelTexts(80)}</svg>`,
    animate: [
      // One step that returns by itself: each click replays it.
      { id: "copy", step: 1, attrs: { transform: [copyPose(1), copyPose(0.3)], opacity: [1, 0] }, ms: 180, ease: "out" },
      { id: "btn", step: 1, attrs: { fill: ["{{button}}", "{{success}}"] }, ms: 200 },
      ...checkFlash(150, COPY_BACK),
      ...swapLabels(0, COPY_BACK),
      { id: "copy", step: 1, attrs: { transform: [copyPose(0.3), copyPose(1)], opacity: [0, 1] }, delay: COPY_BACK + 80, ms: 260, ease: "out" },
      { id: "btn", step: 1, attrs: { fill: ["{{success}}", "{{button}}"] }, delay: COPY_BACK, ms: 300 },
    ],
  },
};

/** When the send button resets. */
const SEND_BACK = 1800;
const planeScale = (s: number) => `scale(${r2(s)}) translate(-12 -12)`;

export const sendButton: VectorEffect = {
  kind: "vector",
  id: "send-button",
  name: "Send button",
  description: "A send button whose paper plane winds up and flies off up and to the right as the label turns to “Sent” with a check, then it resets.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "send", "submit", "message", "button", "micro-interaction"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Sky", values: { button: [0.05, 0.6, 0.9], success: [0.05, 0.45, 0.7] } },
    { name: "Mail", values: { label: "Send email", doneText: "Delivered", button: [0.9, 0.3, 0.25], success: [0.13, 0.6, 0.35] } },
  ],
  derived: (v) => buttonLabels(v.label, v.doneText, 120, 20),
  motion: {
    svg: `<svg viewBox="0 0 240 100"><!-- {{label: text default='Send' label='Label'}} {{doneText: text default='Sent' label='Sent label'}} {{background: color default=#FFFFFF label='Background'}} {{button: color default=#4F46E5 label='Button'}} {{success: color default=#16A34A label='Sent'}} {{ink: color default=#FFFFFF label='Text and icon'}} --><rect width="240" height="100" fill="{{background}}"/><rect id="btn" x="20" y="24" width="200" height="52" rx="26" fill="{{button}}"/><path id="flight" d="M56 50 C88 46 150 22 262 -36" fill="none"/><g transform="translate(56 50) scale(1.1) translate(-12 -12)"><path id="check" d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="{{ink}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g>${labelTexts(82)}<g id="plane" transform="translate(56 50)"><g id="planeIcon" transform="${planeScale(1.05)}" opacity="1"><path d="M22 2 L15 22 L11 13 L2 9 Z" fill="{{ink}}" stroke="{{ink}}" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 2 L11 13" stroke="{{button}}" stroke-width="1.5" stroke-linecap="round"/></g></g></svg>`,
    animate: [
      // Wind up, then fly off along the curve, shrinking and fading.
      { id: "planeIcon", step: 1, attrs: { transform: [planeScale(1.05), planeScale(0.88)] }, ms: 120, ease: "out" },
      { id: "plane", step: 1, along: "flight", delay: 120, ms: 600, ease: "in-out" },
      { id: "planeIcon", step: 1, attrs: { transform: [planeScale(0.88), planeScale(0.5)] }, delay: 120, ms: 600, ease: "in-out" },
      { id: "planeIcon", step: 1, attrs: { opacity: [1, 0] }, delay: 520, ms: 200 },
      { id: "btn", step: 1, attrs: { fill: ["{{button}}", "{{success}}"] }, delay: 450, ms: 250 },
      ...swapLabels(150, SEND_BACK),
      ...checkFlash(500, SEND_BACK),
      // Back home: the plane pops in where it started.
      { id: "plane", step: 1, along: "flight", at: [0, 0], delay: SEND_BACK, ms: 0 },
      { id: "planeIcon", step: 1, attrs: { transform: [planeScale(0), planeScale(1.05)], opacity: [0, 1] }, delay: SEND_BACK + 100, ms: 300, ease: "out" },
      { id: "btn", step: 1, attrs: { fill: ["{{success}}", "{{button}}"] }, delay: SEND_BACK, ms: 300 },
    ],
  },
};

/** The download arrow over its tray, and the progress ring they become, in a 24 box. */
const [ARROW, RING] = morphPaths(
  "M10.6 4 H13.4 V11.6 H17.2 L12 17 L6.8 11.6 H10.6 Z M5 18.6 H19 V20.6 H5 Z",
  (() => {
    const circle = (r: number) =>
      `M${Array.from({ length: 48 }, (_, k) => {
        const a = (k / 48) * Math.PI * 2 - Math.PI / 2;
        return `${r2(12 + r * Math.cos(a))} ${r2(12 + r * Math.sin(a))}`;
      }).join(" L")} Z`;
    return `${circle(9.6)} ${circle(8)}`;
  })(),
  { points: 56 },
);
/** The ring's middle radius and width in the picture (the icon is scaled 2.2 about the centre). */
const RING_R = r2(8.8 * 2.2);
const DOWNLOAD_BACK = 2300;
const iconAt = (y: number) => `translate(60 ${y}) scale(2.2) translate(-12 -12)`;

export const downloadButton: VectorEffect = {
  kind: "vector",
  id: "download-button",
  name: "Download button",
  description: "A round download button whose arrow drops and morphs into a progress ring that fills, ends on a check, then resets.",
  category: "interaction",
  tags: ["interactive", "ui", "click", "download", "progress", "morph", "button", "micro-interaction"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], button: [0.93, 0.95, 1], ink: [0.31, 0.27, 0.9], track: [0.78, 0.8, 0.95], progress: [0.31, 0.27, 0.9], success: [0.86, 0.97, 0.9] } },
    { name: "Ocean", values: { button: [0.03, 0.4, 0.6], progress: [0.4, 0.95, 0.85], success: [0.05, 0.55, 0.5] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{background: color default=#0F172A label='Background'}} {{button: color default=#4F46E5 label='Button'}} {{success: color default=#16A34A label='Done'}} {{ink: color default=#FFFFFF label='Icon'}} {{track: color default=#818CF8 label='Ring track'}} {{progress: color default=#FFFFFF label='Progress'}} --><rect width="120" height="120" fill="{{background}}"/><circle id="btn" cx="60" cy="60" r="42" fill="{{button}}"/><g id="icon" transform="${iconAt(60)}"><path id="glyph" d="${ARROW}" fill="{{ink}}" fill-rule="evenodd"/></g><circle id="bar" cx="60" cy="60" r="${RING_R}" fill="none" stroke="{{progress}}" stroke-width="3.6" transform="rotate(-90 60 60)"/><g transform="translate(60 60) scale(1.5) translate(-12 -12)"><path id="check" d="M6 12.5 L10.5 17 L18.5 8" fill="none" stroke="{{ink}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g></svg>`,
    animate: [
      // The arrow drops, then rises back as it morphs into the ring's track.
      { id: "icon", step: 1, attrs: { transform: [iconAt(60), iconAt(67)] }, ms: 180, ease: "out" },
      { id: "icon", step: 1, attrs: { transform: [iconAt(67), iconAt(60)] }, delay: 180, ms: 260, ease: "in-out" },
      { id: "glyph", step: 1, attrs: { d: [ARROW, RING], fill: ["{{ink}}", "{{track}}"] }, delay: 180, ms: 340, ease: "in-out" },
      // Progress round the ring (a flat-ended line, so nothing shows at 0), then a check.
      { id: "bar", step: 1, draw: true, delay: 520, ms: 900, ease: "in-out" },
      { id: "btn", step: 1, attrs: { fill: ["{{button}}", "{{success}}"] }, delay: 1400, ms: 250 },
      { id: "check", step: 1, attrs: { opacity: [0, 1] }, delay: 1450, ms: 40 },
      { id: "check", step: 1, draw: true, delay: 1450, ms: 300, ease: "out" },
      // Reset: check and ring fade, the track morphs back into the arrow.
      { id: "check", step: 1, attrs: { opacity: [1, 0] }, delay: DOWNLOAD_BACK, ms: 150 },
      { id: "bar", step: 1, attrs: { opacity: [1, 0] }, delay: DOWNLOAD_BACK, ms: 200 },
      { id: "check", step: 1, draw: [0, 0], delay: DOWNLOAD_BACK + 200, ms: 0 },
      { id: "bar", step: 1, draw: [0, 0], delay: DOWNLOAD_BACK + 200, ms: 0 },
      snap("bar", "opacity", 1, DOWNLOAD_BACK + 200),
      { id: "glyph", step: 1, attrs: { d: [RING, ARROW], fill: ["{{track}}", "{{ink}}"] }, delay: DOWNLOAD_BACK + 100, ms: 420, ease: "in-out" },
      { id: "btn", step: 1, attrs: { fill: ["{{success}}", "{{button}}"] }, delay: DOWNLOAD_BACK, ms: 300 },
    ],
  },
};

export const linkHover: VectorEffect = {
  kind: "vector",
  id: "link-hover",
  name: "Link hover",
  description: "A text link whose underline grows from left to right on hover, its arrow nudging right as the text changes colour.",
  category: "interaction",
  tags: ["interactive", "ui", "hover", "link", "underline", "navigation", "micro-interaction"],
  trigger: "hover",
  hold: 800,
  presets: [
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], ink: [0.85, 0.87, 0.92], hover: [0.4, 0.85, 1] } },
    { name: "Editorial", values: { text: "Continue reading", ink: [0.1, 0.1, 0.1], hover: [0.85, 0.2, 0.15] } },
  ],
  // The text and its arrow centred together; the arrow is drawn round (0, 0) and placed.
  derived: (v) => {
    const { size, length } = fit(v.text, 230, 28);
    const total = length + size * 1.05;
    const left = 160 - total / 2;
    const base = 50 + size * 0.35;
    const ax = left + length + size * 0.35;
    const ay = base - size * 0.33;
    const s = size / 28;
    return {
      size,
      length,
      left: r1(left),
      base: r1(base),
      lineY: r1(base + size * 0.2),
      lineH: r1(Math.max(2, size * 0.08)),
      arrowAt: `translate(${r1(ax)} ${r1(ay)}) scale(${r2(s)})`,
      arrowTo: `translate(${r1(ax + size * 0.25)} ${r1(ay)}) scale(${r2(s)})`,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 100"><!-- {{text: text default='Read the docs' label='Link text'}} {{background: color default=#FFFFFF label='Background'}} {{ink: color default=#1F2937 label='Text colour'}} {{hover: color default=#4F46E5 label='Hover colour'}} --><rect width="320" height="100" fill="{{background}}"/><text id="link" x="{{left}}" y="{{base}}" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="600" fill="{{ink}}">{{text}}</text><rect id="under" x="{{left}}" y="{{lineY}}" width="0" height="{{lineH}}" rx="1" fill="{{hover}}"/><g id="arrow" transform="{{arrowAt}}"><path id="arrowPath" d="M0 0 H18 M11 -7 L18 0 L11 7" fill="none" stroke="{{ink}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
    animate: [
      { id: "link", attrs: { fill: ["{{ink}}", "{{hover}}"] }, ms: 220 },
      { id: "under", attrs: { width: [0, n("length")] }, ms: 320, ease: "out" },
      { id: "arrow", attrs: { transform: ["{{arrowAt}}", "{{arrowTo}}"] }, ms: 300, ease: "out" },
      { id: "arrowPath", attrs: { stroke: ["{{ink}}", "{{hover}}"] }, ms: 220 },
    ],
  },
};

export const buttonHoverFill: VectorEffect = {
  kind: "vector",
  id: "button-hover-fill",
  name: "Button hover fill",
  description: "An outlined pill button that fills with a slanted sweep from the left on hover, its label inverting colour as the fill passes.",
  category: "interaction",
  tags: ["interactive", "ui", "hover", "button", "fill", "cta", "micro-interaction"],
  trigger: "hover",
  hold: 800,
  presets: [
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], surface: [0.06, 0.07, 0.1], accent: [0.98, 0.8, 0.2] } },
    { name: "Coral", values: { label: "Book a demo", accent: [0.96, 0.35, 0.3] } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 190, 22);
    return { size, length, base: r1(60 + size * 0.35) };
  },
  motion: ((): SvgMotion => {
    // The sweep's right edge leans back, so it is a slanted band starting outside the pill.
    const sweep = (x: number) => `M10 26 H${x} L${x - 24} 94 H10 Z`;
    const label = (fill: string, clip = "") =>
      `<text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="700" letter-spacing="0.5" fill="${fill}"${clip}>{{label}}</text>`;
    return {
      svg: `<svg viewBox="0 0 320 120"><!-- {{label: text default='Get started' label='Label'}} {{background: color default=#FFFFFF label='Background'}} {{surface: color default=#FFFFFF label='Button'}} {{accent: color default=#4F46E5 label='Accent'}} --><defs><clipPath id="swept"><path id="cover" d="${sweep(40)}"/></clipPath></defs><rect width="320" height="120" fill="{{background}}"/><g id="btn" transform="translate(0 0)"><rect x="40" y="30" width="240" height="60" rx="30" fill="{{surface}}" stroke="{{accent}}" stroke-width="2.5"/><rect x="40" y="30" width="240" height="60" rx="30" fill="{{accent}}" stroke="{{accent}}" stroke-width="2.5" clip-path="url(#swept)"/>${label("{{accent}}")}${label("{{surface}}", ` clip-path="url(#swept)"`)}</g></svg>`,
      animate: [
        { id: "cover", attrs: { d: [sweep(40), sweep(310)] }, ms: 380, ease: "in-out" },
        { id: "btn", attrs: { transform: ["translate(0 0)", "translate(0 -2)"] }, ms: 240, ease: "out" },
      ],
    };
  })(),
};

/** The tooltip's group: grown from its pointer's tip (160, 104), raised by `dy`. */
const tipPose = (s: number, dy: number) => `translate(160 ${104 + dy}) scale(${r2(s)}) translate(-160 -104)`;

export const tooltipPop: VectorEffect = {
  kind: "vector",
  id: "tooltip-pop",
  name: "Tooltip pop",
  description: "A small help badge that pops a tooltip bubble up above it on hover, rising and fading in with a slight overshoot.",
  category: "interaction",
  tags: ["interactive", "ui", "hover", "tooltip", "help", "popover", "micro-interaction"],
  trigger: "hover",
  hold: 800,
  presets: [
    { name: "Light", values: { background: [0.97, 0.97, 0.98], bubble: [1, 1, 1], tipInk: [0.1, 0.1, 0.15], badge: [0.6, 0.63, 0.7] } },
    { name: "Warning", values: { tip: "This can't be undone", accent: [0.95, 0.4, 0.15], bubble: [0.95, 0.4, 0.15], tipInk: [1, 1, 1] } },
  ],
  // The bubble is as wide as its text, centred over the badge.
  derived: (v) => {
    const { size, length } = fit(v.tip, 250, 15);
    const w = length + 28;
    return { size, length, bx: r1(160 - w / 2), bw: r1(w), tipY: r1(79 + size * 0.35) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 180"><!-- {{tip: text default='Saved to your library' label='Tooltip'}} {{background: color default=#0F172A label='Background'}} {{badge: color default=#475569 label='Badge'}} {{accent: color default=#6366F1 label='Badge hovered'}} {{bubble: color default=#F8FAFC label='Bubble'}} {{tipInk: color default=#0F172A label='Tooltip text'}} --><rect width="320" height="180" fill="{{background}}"/><g id="tip" transform="${tipPose(0.5, 8)}" opacity="0"><rect x="{{bx}}" y="60" width="{{bw}}" height="38" rx="10" fill="{{bubble}}"/><path d="M151 96 L160 105 L169 96 Z" fill="{{bubble}}"/><text x="160" y="{{tipY}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="500" fill="{{tipInk}}">{{tip}}</text></g><g id="badgeG" transform="${about(160, 134, 1)}"><circle id="badge" cx="160" cy="134" r="18" fill="{{badge}}"/><text x="160" y="141" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="700" fill="#FFFFFF">?</text></g></svg>`,
    animate: [
      { id: "tip", attrs: { transform: [tipPose(0.5, 8), tipPose(1.07, -3)] }, ms: 190, ease: "out" },
      { id: "tip", attrs: { transform: [tipPose(1.07, -3), tipPose(1, 0)] }, delay: 190, ms: 150, ease: "in-out" },
      { id: "tip", attrs: { opacity: [0, 1] }, ms: 150 },
      { id: "badge", attrs: { fill: ["{{badge}}", "{{accent}}"] }, ms: 200 },
      { id: "badgeG", attrs: { transform: [about(160, 134, 1), about(160, 134, 1.08)] }, ms: 200, ease: "out" },
    ],
  },
};

export const pressButton: VectorEffect = {
  kind: "vector",
  id: "press-button",
  name: "Press button",
  description: "A chunky 3D button whose face pushes down onto its base while held, its shadow tightening, and springs back up on release.",
  category: "interaction",
  tags: ["interactive", "ui", "press", "button", "3d", "tactile", "micro-interaction"],
  trigger: "press",
  hold: 800,
  presets: [
    { name: "Arcade red", values: { face: [0.94, 0.27, 0.27], background: [0.1, 0.09, 0.12] } },
    { name: "Mint", values: { face: [0.3, 0.85, 0.6], ink: [0.05, 0.25, 0.15], label: "Let's go" } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 170, 22);
    return { size, length, base: r1(67 + size * 0.35), side: mixHex(v.face, [0, 0, 0], 0.35), pressed: mixHex(v.face, [0, 0, 0], 0.08) };
  },
  // Played backwards on release, the brief lift at the start of the press becomes a spring past rest at the end.
  motion: {
    svg: `<svg viewBox="0 0 320 140"><!-- {{label: text default='Press me' label='Label'}} {{background: color default=#F1F5F9 label='Background'}} {{face: color default=#6366F1 label='Button'}} {{ink: color default=#FFFFFF label='Label colour'}} {{shadow: color default=#0F172A label='Shadow'}} --><rect width="320" height="140" fill="{{background}}"/><ellipse id="shadow" cx="160" cy="114" rx="108" ry="9" fill="{{shadow}}" opacity="0.3"/><rect x="60" y="50" width="200" height="58" rx="16" fill="{{side}}"/><g id="faceG" transform="translate(0 0)"><rect id="faceRect" x="60" y="38" width="200" height="58" rx="16" fill="{{face}}"/><text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="800" fill="{{ink}}">{{label}}</text></g></svg>`,
    animate: [
      { id: "faceG", attrs: { transform: ["translate(0 0)", "translate(0 -1.5)"] }, ms: 40, ease: "out" },
      { id: "faceG", attrs: { transform: ["translate(0 -1.5)", "translate(0 9)"] }, delay: 40, ms: 90, ease: "out" },
      { id: "shadow", attrs: { rx: [108, 96], ry: [9, 5], opacity: [0.3, 0.18] }, delay: 40, ms: 90, ease: "out" },
      { id: "faceRect", attrs: { fill: ["{{face}}", "{{pressed}}"] }, delay: 40, ms: 90 },
    ],
  },
};

/** UI micro-interactions as vector effects, each played by a hover, press or click (`trigger`). */
export const interactionEffects: VectorEffect[] = [
  likeButton,
  toggleSwitch,
  checkbox,
  menuToggle,
  bookmark,
  copyButton,
  sendButton,
  downloadButton,
  linkHover,
  buttonHoverFill,
  tooltipPop,
  pressButton,
];
