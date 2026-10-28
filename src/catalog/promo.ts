import type { CubicBezier, SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Easing in: slow to start, fastest at the end, as a fall is. */
const EASE_IN: CubicBezier = [0.55, 0, 1, 0.45];

/** A placeholder where an animation wants a number: filled in from `derived`. */
const slot = (name: string) => `{{${name}}}` as unknown as number;

/** Slime drop: the word's baseline and size on its 400 × 200 stage. */
const SLIME_BASELINE = 128;
const SLIME_SIZE = 72;
/** Where the word lands, and how far up it falls from. */
const FALL = 240;
const IMPACT = 420;

/** The splash: droplets fanned over the top, each its own size and reach (a share of the word's width). */
const DROPLETS = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13;
  const angle = Math.PI * (1.06 - 1.12 * t);
  return {
    i,
    angle,
    reach: 0.42 + 0.38 * ((i * 7) % 5) / 4,
    r: [6, 3.5, 5, 2.5, 7, 3, 4.5][i % 7]!,
    lift: 0.5 + 0.5 * ((i * 3) % 4) / 3,
  };
});

/** Drips hanging from the word, at shares of its width. */
const SLIME_DRIPS = [
  { at: 0.12, width: 9, length: 18 },
  { at: 0.38, width: 7, length: 12 },
  { at: 0.63, width: 10, length: 22 },
  { at: 0.86, width: 7, length: 14 },
];

const squash = (sx: number, sy: number) => `translate(200 ${SLIME_BASELINE}) scale(${sx} ${sy}) translate(-200 -${SLIME_BASELINE})`;
const fall = (y: number) => `translate(0 ${y})`;

export const slimeDrop: VectorEffect = {
  kind: "vector",
  id: "slime-drop",
  name: "Slime drop",
  description: "A drippy slime title falling in from above, squashing flat as it lands in a puddle and splashing droplets out round it that stay as specks.",
  category: "splatter",
  tags: ["splatter", "promo", "title", "slime", "splat", "drip", "logo", "bounce", "y2k"],
  hold: 1400,
  presets: [
    { name: "Slime", values: { fill: [0.55, 0.93, 0.25], outline: [0.06, 0.2, 0.04] } },
    { name: "Grape", values: { fill: [0.62, 0.42, 1], outline: [0.16, 0.06, 0.36] } },
    { name: "Big splash", values: { spread: 1.6 } },
  ],
  derived: (v) => {
    const width = Math.round(Math.max(0.6, textWidthEm(String(v.word).trim())) * SLIME_SIZE);
    const left = 200 - width / 2;
    const spread = Number(v.spread);
    return {
      width,
      fit: Math.round(Math.min(1, 360 / width) * 1000) / 1000,
      puddle: r1(width * 0.56),
      puddleRest: r1(width * 0.5),
      ...Object.fromEntries(
        DROPLETS.flatMap((d) => {
          // Thrown out along its angle from the ends of the word, landing a little below the baseline.
          const reach = (width * 0.5 + 60) * d.reach * spread * 1.2;
          const x = 200 + Math.cos(d.angle) * reach;
          return [
            [`dx${d.i}`, r1(x)],
            [`dy${d.i}`, r1(SLIME_BASELINE - 20 - Math.sin(d.angle) * reach * 0.55 * d.lift)],
            [`dl${d.i}`, r1(SLIME_BASELINE + 14 + ((d.i * 5) % 4) * 4)],
          ];
        }),
      ),
      ...Object.fromEntries(SLIME_DRIPS.flatMap((d, i) => [[`drip${i}`, r1(left + d.at * width)]])),
    };
  },
  motion: (() => {
    const word = `<text x="200" y="${SLIME_BASELINE}" text-anchor="middle" textLength="{{width}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="${SLIME_SIZE}" font-weight="{{weight}}" stroke-linejoin="round"`;
    const drips = (paint: string) =>
      SLIME_DRIPS.map(
        (d, i) =>
          `<rect x="{{drip${i}}}" y="${SLIME_BASELINE - 10}" width="${d.width}" height="${d.length + 10}" rx="${d.width / 2}" transform="translate(-${d.width / 2} 0)" ${paint}/><circle cx="{{drip${i}}}" cy="${SLIME_BASELINE + d.length}" r="${r1(d.width * 0.7)}" ${paint}/>`,
      ).join("");
    const outline = `fill="{{outline}}" stroke="{{outline}}" stroke-width="{{stroke}}"`;
    return {
      svg: `<svg viewBox="0 0 400 200" overflow="hidden"><!-- {{word: text default=SLOP label='Word'}} {{font: text default='Arial Black, Impact, system-ui, sans-serif' label='Font'}} {{weight: int min=100 max=900 default=900 step=100 label='Weight'}} {{fill: color default=#FF5C9A label='Slime'}} {{outline: color default=#4A0D2C label='Outline'}} {{stroke: float min=0 max=14 default=7 step=0.5 label='Outline width'}} {{spread: float min=0.3 max=2 default=1 label='Splash size'}} --><g transform="translate(200 100) scale({{fit}}) translate(-200 -100)"><ellipse id="puddle" cx="200" cy="${SLIME_BASELINE + 8}" rx="0" ry="0" fill="{{fill}}" stroke="{{outline}}" stroke-width="3"/>${DROPLETS.map(
        (d) => `<circle id="d${d.i}" cx="200" cy="${SLIME_BASELINE}" r="${d.r}" fill="{{fill}}" opacity="0"/>`,
      ).join("")}<g id="drop" transform="${fall(-FALL)}"><g id="squash" transform="${squash(0.9, 1.12)}">${drips(outline)}${word} fill="none" stroke="{{outline}}" stroke-width="{{stroke}}">{{word}}</text>${drips(`fill="{{fill}}"`)}${word} fill="{{fill}}">{{word}}</text></g></g></g></svg>`,
      animate: [
        // The fall, stretching as it speeds up; then the squash on landing, a rebound and a settle.
        { id: "drop", attrs: { transform: [fall(-FALL), fall(0)] }, ms: IMPACT, ease: EASE_IN },
        { id: "squash", attrs: { transform: [squash(0.9, 1.12), squash(1.22, 0.7)] }, delay: IMPACT - 40, ms: 120, ease: "out" },
        { id: "squash", attrs: { transform: [squash(1.22, 0.7), squash(0.94, 1.08)] }, delay: IMPACT + 80, ms: 150, ease: "in-out" },
        { id: "drop", attrs: { transform: [fall(0), fall(-10)] }, delay: IMPACT + 80, ms: 150, ease: "out" },
        { id: "squash", attrs: { transform: [squash(0.94, 1.08), squash(1, 1)] }, delay: IMPACT + 230, ms: 260, ease: "in-out" },
        { id: "drop", attrs: { transform: [fall(-10), fall(0)] }, delay: IMPACT + 230, ms: 260, ease: EASE_IN },
        // The puddle spreads out under it and draws back a little.
        { id: "puddle", attrs: { rx: [0, slot("puddle")], ry: [0, 11] }, delay: IMPACT - 20, ms: 240, ease: "out" },
        { id: "puddle", attrs: { rx: [slot("puddle"), slot("puddleRest")], ry: [11, 8] }, delay: IMPACT + 220, ms: 500, ease: "in-out" },
        // Droplets thrown up and out, each falling back on its arc to stay as a speck.
        ...DROPLETS.flatMap((d): SvgAnimation[] => {
          const ms = 520 + (d.i % 3) * 60;
          const up = Math.round(ms * 0.45);
          return [
            { id: `d${d.i}`, attrs: { opacity: [0, 1] }, delay: IMPACT, ms: 40 },
            { id: `d${d.i}`, attrs: { cx: [200, slot(`dx${d.i}`)] }, delay: IMPACT, ms, ease: "out" },
            { id: `d${d.i}`, attrs: { cy: [SLIME_BASELINE, slot(`dy${d.i}`)] }, delay: IMPACT, ms: up, ease: "out" },
            { id: `d${d.i}`, attrs: { cy: [slot(`dy${d.i}`), slot(`dl${d.i}`)], r: [d.r, r1(d.r * 0.75)] }, delay: IMPACT + up, ms: ms - up, ease: EASE_IN },
          ];
        }),
      ],
    };
  })(),
};

/** App window: the card's centre, and its ring. */
const RING = { x: 196, y: 146, r: 42 } as const;
const card = (dy: number, tilt: number | string, scale: number) => `translate(200 ${150 + dy}) rotate(${tilt}) scale(${scale}) translate(-200 -150)`;
const pop = (scale: number) => `translate(${RING.x} ${RING.y}) scale(${scale}) translate(-${RING.x} -${RING.y})`;

export const appWindow: VectorEffect = {
  kind: "vector",
  id: "app-window",
  name: "App window",
  description:
    "A neo-brutalist app window with a coloured title bar, three dots and a hard offset shadow springing in at a tilt, its progress ring filling and drawing a tick as the label changes to done.",
  category: "ui",
  tags: ["promo", "ui", "window", "card", "progress", "success", "brutalist", "mockup"],
  hold: 200,
  presets: [
    { name: "Mint", values: { bar: [0.56, 0.89, 0.78], accent: [0.13, 0.71, 0.53], track: [0.81, 0.95, 0.9] } },
    { name: "Butter", values: { bar: [0.97, 0.79, 0.29], accent: [0.93, 0.55, 0.1], track: [1, 0.91, 0.72] } },
    { name: "Sky", values: { bar: [0.55, 0.78, 1], accent: [0.2, 0.45, 0.95], track: [0.83, 0.9, 1], card: [0.96, 0.98, 1] } },
  ],
  derived: (v) => {
    // Labels shrink to fit the window, from their estimated width.
    const size = (text: unknown) => r1(Math.min(18, 220 / Math.max(0.5, textWidthEm(String(text).trim()))));
    const tilt = Number(v.tilt);
    return { labelSize: size(v.label), doneSize: size(v.done), tiltFrom: r1(tilt - 10) };
  },
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{label: text default='Exporting video' label='Label'}} {{done: text default='Done!' label='Done label'}} {{font: text default='system-ui, sans-serif' label='Font'}} {{card: color default=#FFF6DA label='Window'}} {{bar: color default=#F58BA4 label='Title bar'}} {{ink: color default=#1F1A1C label='Ink'}} {{accent: color default=#F0507A label='Ring'}} {{track: color default=#F9CAD5 label='Track'}} {{tilt: float min=-15 max=15 default=-4 label='Tilt (°)'}} --><g id="card" transform="${card(40, "{{tiltFrom}}", 0.6)}" opacity="0" font-family="{{font}}"><rect x="72" y="52" width="264" height="208" rx="12" fill="{{ink}}"/><rect x="64" y="44" width="264" height="208" rx="12" fill="{{card}}" stroke="{{ink}}" stroke-width="4"/><path d="M64 80 V56 Q64 44 76 44 H316 Q328 44 328 56 V80 Z" fill="{{bar}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="round"/><circle cx="84" cy="62" r="5" fill="{{ink}}"/><circle cx="100" cy="62" r="5" fill="{{ink}}"/><circle cx="116" cy="62" r="5" fill="{{ink}}"/><g id="badge" transform="${pop(1)}"><circle cx="${RING.x}" cy="${RING.y}" r="${RING.r}" fill="none" stroke="{{track}}" stroke-width="12"/><circle id="ring" cx="${RING.x}" cy="${RING.y}" r="${RING.r}" fill="none" stroke="{{accent}}" stroke-width="12" stroke-linecap="round" transform="rotate(-90 ${RING.x} ${RING.y})"/><path id="tick" d="M${RING.x - 19} ${RING.y + 1} L${RING.x - 5} ${RING.y + 15} L${RING.x + 21} ${RING.y - 13}" fill="none" stroke="{{ink}}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g><text id="label" x="${RING.x}" y="226" text-anchor="middle" font-size="{{labelSize}}" font-weight="700" fill="{{ink}}">{{label}}</text><text id="doneLabel" x="${RING.x}" y="226" text-anchor="middle" font-size="{{doneSize}}" font-weight="700" fill="{{ink}}" opacity="0">{{done}}</text></g></svg>`,
    animate: [
      // Springs in from below at a steeper tilt.
      { id: "card", attrs: { opacity: [0, 1] }, ms: 160, ease: "out" },
      { id: "card", attrs: { transform: [card(40, "{{tiltFrom}}", 0.6), card(0, "{{tilt}}", 1)] }, ms: 700, ease: { spring: { stiffness: 260, damping: 15 } } },
      // The ring fills, the tick draws, the badge pops and the label changes.
      { id: "ring", draw: true, delay: 450, ms: 1400, ease: "in-out" },
      { id: "tick", draw: true, delay: 1800, ms: 300, ease: "out" },
      { id: "badge", attrs: { transform: [pop(1), pop(1.1)] }, delay: 1850, ms: 140, ease: "out" },
      { id: "badge", attrs: { transform: [pop(1.1), pop(1)] }, delay: 1990, ms: 260, ease: "in-out" },
      { id: "label", attrs: { opacity: [1, 0] }, delay: 1800, ms: 160 },
      { id: "doneLabel", attrs: { opacity: [0, 1] }, delay: 1900, ms: 220 },
      // Then flicks away up and out, ready to come in again.
      { id: "card", attrs: { transform: [card(0, "{{tilt}}", 1), card(-30, "{{tiltFrom}}", 0.9)], opacity: [1, 0] }, delay: 3300, ms: 260, ease: EASE_IN },
    ],
  },
};

/** The promo effects drawn as vectors. */
export const promoEffects: VectorEffect[] = [slimeDrop, appWindow];
