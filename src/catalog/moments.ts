import type { SvgAnimation } from "../vector/motion.js";
import { styleControls, styleDerived, styleShadow } from "./neubrutal.js";
import type { VectorEffect } from "./types.js";

/*
 * Vector effects for AI product moments, drawn flat: thick ink, flat colour
 * and hard shadows by default (the shared style controls in `neubrutal.ts`
 * switch them to a soft, glossy look).
 */

const SANS = `'Arial Black', 'Helvetica Neue', system-ui, sans-serif`;

// ── Slop vat ────────────────────────────────────────────────────────────

/** The vat's inside: the liquid's surface at full and empty. */
const VAT = { x: 40, y: 40, w: 110, h: 110, r: 14, full: 52, empty: 148 } as const;
const VAT_FILL_MS = 3200;

const lobe = (i: number, cx: number, r: number): string => `<circle id="slopLobe${i}" cx="${cx}" cy="2" r="${r}" fill="{{slop}}"/>`;
const bubble = (i: number, cx: number, r: number): string => `<circle id="slopBubble${i}" cx="${cx}" cy="80" r="${r}" fill="none" stroke="{{inkColor}}" stroke-width="1.6" opacity="0"/>`;

export const slopVat: VectorEffect = {
  kind: "vector",
  id: "slop-vat",
  name: "Slop vat",
  description: "A stroked machine vat filling with bubbling slop to how far a job has got, gooey lobes bobbing on the surface and a nozzle dripping into a puddle below.",
  category: "loader",
  tags: ["loader", "progress", "ai", "liquid", "goo", "fill", "neubrutal", "ui"],
  hold: 400,
  presets: [
    { name: "Soft", values: { shadowStyle: 0, sheen: 1, inkWidth: 2 } },
    { name: "Pink slop", values: { slop: [1, 0.16, 0.52] } },
    { name: "Half full", values: { animate: false, level: 0.5 } },
    { name: "Neubrutal", values: { slop: [0.98, 0.8, 0.08], vat: [1, 1, 1], shadowStyle: 1, shadowOffset: 8, sheen: 0, inkWidth: 3, inkColor: [0.035, 0.035, 0.043] } },
  ],
  derived: (v) => {
    const level = Math.max(0, Math.min(1, Number(v.level)));
    const still = VAT.empty - level * (VAT.empty - VAT.full);
    const animate = v.animate === true;
    return {
      y0: animate ? VAT.empty : still,
      y1: animate ? VAT.full : still,
      ...styleDerived(v, { dy: 6, blur: 5, alpha: 0.25 }),
    };
  },
  motion: ((): { svg: string; animate: SvgAnimation[] } => {
    const lobes = [lobe(0, 58, 10), lobe(1, 82, 13), lobe(2, 108, 11), lobe(3, 132, 12)].join("");
    const bubbles = [bubble(0, 64, 4), bubble(1, 92, 3), bubble(2, 118, 5), bubble(3, 136, 3)].join("");
    const bob = [0, 1, 2, 3].map((i): SvgAnimation => ({ id: `slopLobe${i}`, attrs: { cy: [3, -5] }, ms: 400, delay: i * 120, repeat: 8, alternate: true, ease: "in-out" }));
    const rise = [0, 1, 2, 3].flatMap((i): SvgAnimation[] => [
      { id: `slopBubble${i}`, attrs: { cy: [86, 6] }, ms: 1000, delay: 200 + i * 450, repeat: 2, ease: "in-out" },
      { id: `slopBubble${i}`, attrs: { opacity: [0, 1] }, ms: 150, delay: 200 + i * 450 },
    ]);
    const { x, y, w, h, r } = VAT;
    return {
      svg: `<svg viewBox="0 0 200 200"><!-- {{level: float min=0 max=1 default=0.6 label='Full (when still)'}} {{animate: bool default=true label='Animate'}} {{slop: color default=#A3E635 label='Slop'}} {{vat: color default=#FFFFFF label='Vat'}} ${styleControls({ style: 1, ink: 3, sheen: 0 })} --><defs>${styleShadow("slopShadow")}<clipPath id="slopInside"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs><g filter="url(#slopShadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="{{vat}}" stroke="{{inkColor}}" stroke-width="{{inkWidth}}"/><rect x="150" y="124" width="24" height="12" fill="{{vat}}" stroke="{{inkColor}}" stroke-width="{{inkWidth}}"/><rect x="164" y="136" width="10" height="10" fill="{{vat}}" stroke="{{inkColor}}" stroke-width="{{inkWidth}}"/><ellipse id="slopPuddle" cx="169" cy="184" rx="14" ry="4.5" fill="{{slop}}" stroke="{{inkColor}}" stroke-width="{{inkWidth}}"/></g><g clip-path="url(#slopInside)"><g id="slopLevel" transform="translate(0 {{y0}})"><rect x="${x - 4}" y="0" width="${w + 8}" height="${h + 20}" fill="{{slop}}"/>${lobes}${bubbles}</g></g><rect x="${x + 10}" y="${y + 10}" width="9" height="${h - 30}" rx="4.5" fill="#FFFFFF" opacity="{{sheenA}}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="{{inkColor}}" stroke-width="{{inkWidth}}"/><circle id="slopDrip" cx="169" cy="150" r="4" fill="{{slop}}" stroke="{{inkColor}}" stroke-width="1.6" opacity="0"/></svg>`,
      animate: [
        { id: "slopLevel", attrs: { transform: ["translate(0 {{y0}})", "translate(0 {{y1}})"] }, ms: VAT_FILL_MS, ease: "in-out" },
        ...bob,
        ...rise,
        { id: "slopDrip", attrs: { opacity: [0, 1] }, ms: 80 },
        { id: "slopDrip", attrs: { cy: [148, 182] }, ms: 640, repeat: 5, ease: [0.5, 0, 1, 1] },
        { id: "slopPuddle", attrs: { rx: [13, 16] }, ms: 320, delay: 560, repeat: 10, alternate: true, ease: "out" },
      ],
    };
  })(),
};

// ── Goo drop reveal ─────────────────────────────────────────────────────

/** A wobbly blob about 30 across, centred on 0,0: a drop, and a splat with drips. */
const DROP = "M0 -30 C14 -30 26 -14 26 2 C26 18 14 28 0 28 C-14 28 -26 18 -26 2 C-26 -14 -14 -30 0 -30 Z";
const SPLAT =
  "M0 -30 C12 -34 18 -24 28 -22 C38 -20 34 -6 30 2 C38 10 32 22 22 24 C18 34 6 30 0 28 C-8 34 -18 32 -22 24 C-34 22 -36 10 -30 2 C-36 -8 -32 -20 -22 -22 C-16 -32 -8 -30 0 -30 Z";

export const gooDropReveal: VectorEffect = {
  kind: "vector",
  id: "goo-drop-reveal",
  name: "Goo drop reveal",
  description: "A flat, ink-stroked blob drops in, splats across the frame and wipes away to the side, leaving its slot revealed with a word in it.",
  category: "transition",
  tags: ["transition", "reveal", "goo", "slime", "wipe", "neubrutal", "flat"],
  hold: 800,
  presets: [
    { name: "Pink", values: { goo: [1, 0.16, 0.52] } },
    { name: "Cyan", values: { goo: [0.02, 0.71, 0.83] } },
    { name: "Soft", values: { shadowStyle: 0, sheen: 1 } },
    { name: "No word", values: { label: "" } },
  ],
  derived: (v) => styleDerived(v, { dy: 6, blur: 6, alpha: 0.25 }),
  motion: {
    svg: `<svg viewBox="0 0 320 200" font-family="${SANS}"><!-- {{label: text default='Ready' label='Revealed word (may be empty)'}} {{goo: color default=#A3E635 label='Goo'}} {{wordColor: color default=#09090B label='Word'}} ${styleControls({ style: 1, ink: 3, sheen: 0 })} --><defs>${styleShadow("gooDropShadow")}</defs><text id="gooWord" x="160" y="114" text-anchor="middle" font-size="40" font-weight="900" fill="{{wordColor}}" opacity="0">{{label}}</text><g id="gooWipe" transform="translate(0 0)"><g filter="url(#gooDropShadow)"><g id="gooDrop" transform="translate(160 -40) scale(1 1)"><path id="gooShape" d="${DROP}" fill="{{goo}}" stroke="{{inkColor}}" stroke-width="{{inkWidth}}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><ellipse cx="-9" cy="-12" rx="4" ry="7" fill="#FFFFFF" opacity="{{sheenA}}"/></g></g></g></svg>`,
    animate: [
      // Drops in.
      { id: "gooDrop", attrs: { transform: ["translate(160 -40) scale(1 1)", "translate(160 100) scale(1 1)"] }, ms: 420, ease: [0.5, 0, 1, 1] },
      // Squashes on landing.
      { id: "gooDrop", attrs: { transform: ["translate(160 100) scale(1 1)", "translate(160 108) scale(1.45 0.6)"] }, delay: 420, ms: 90, ease: "out" },
      // Splats across the frame.
      { id: "gooShape", attrs: { d: [DROP, SPLAT] }, delay: 480, ms: 160, ease: "out" },
      { id: "gooDrop", attrs: { transform: ["translate(160 108) scale(1.45 0.6)", "translate(160 100) scale(7.5 5.5)"] }, delay: 510, ms: 380, ease: { spring: { stiffness: 220, damping: 18 } } },
      // Wipes away to the right, revealing the slot.
      { id: "gooWipe", attrs: { transform: ["translate(0 0)", "translate(460 0)"] }, delay: 1150, ms: 520, ease: [0.6, 0, 0.9, 0.6] },
      { id: "gooWord", attrs: { opacity: [0, 1] }, delay: 1250, ms: 200 },
      { id: "gooWord", attrs: { transform: ["translate(0 10)", "translate(0 0)"] }, delay: 1250, ms: 400, ease: { spring: { stiffness: 260, damping: 14 } } },
    ],
  },
};

// ── Memphis burst ───────────────────────────────────────────────────────

/** A shape: id, markup drawn round 0,0 (with `{{colour}}`), where it lands, its turn and its colour control. */
type Piece = { id: string; d: string; x: number; y: number; turn: number; colour: string; fill: boolean };

const SPARKLE = "M0 -18 C2 -6 6 -2 18 0 C6 2 2 6 0 18 C-2 6 -6 2 -18 0 C-6 -2 -2 -6 0 -18 Z";
const SQUIGGLE = "M-22 0 C-17 -10 -11 -10 -6 0 C-1 10 5 10 10 0 C15 -10 21 -10 26 0";
const TRIANGLE = "M0 -14 L13 9 L-13 9 Z";
const RING = "M-11 0 A11 11 0 1 0 11 0 A11 11 0 1 0 -11 0 Z";
const DOT = "M-5 0 A5 5 0 1 0 5 0 A5 5 0 1 0 -5 0 Z";

const PIECES: Piece[] = [
  { id: "memphisSparkle", d: SPARKLE, x: 56, y: 52, turn: 15, colour: "c3", fill: true },
  { id: "memphisSquiggle", d: SQUIGGLE, x: 148, y: 50, turn: -20, colour: "c1", fill: false },
  { id: "memphisTriangle", d: TRIANGLE, x: 154, y: 142, turn: 40, colour: "c2", fill: true },
  { id: "memphisRing", d: RING, x: 46, y: 140, turn: 0, colour: "c4", fill: false },
  { id: "memphisDot1", d: DOT, x: 102, y: 28, turn: 0, colour: "c1", fill: true },
  { id: "memphisDot2", d: DOT, x: 176, y: 98, turn: 0, colour: "c3", fill: true },
  { id: "memphisSparkle2", d: SPARKLE, x: 104, y: 170, turn: -10, colour: "c2", fill: true },
  { id: "memphisDot3", d: DOT, x: 24, y: 96, turn: 0, colour: "c2", fill: true },
];

export const memphisBurst: VectorEffect = {
  kind: "vector",
  id: "memphis-burst",
  name: "Memphis burst",
  description: "Memphis pop-art shapes spring out from the centre with hard shadows: four-point sparkles, a squiggle, a ring, a triangle and dots, then settle and fade. A flat alternative to confetti.",
  category: "icon",
  tags: ["celebration", "success", "burst", "memphis", "pop-art", "neubrutal", "flat", "overlay"],
  hold: 300,
  presets: [
    { name: "Soft", values: { shadowStyle: 0, sheen: 1, inkWidth: 1.5 } },
    { name: "Mono ink", values: { c1: [0.035, 0.035, 0.043], c2: [0.035, 0.035, 0.043], c3: [0.035, 0.035, 0.043], c4: [0.035, 0.035, 0.043] } },
    { name: "Pastel", values: { c1: [0.98, 0.66, 0.83], c2: [0.65, 0.91, 0.96], c3: [1, 0.93, 0.6], c4: [0.85, 0.75, 1] } },
  ],
  derived: (v) => styleDerived(v, { dy: 3, blur: 3, alpha: 0.3 }),
  motion: ((): { svg: string; animate: SvgAnimation[] } => {
    const shapes = PIECES.map(
      (p) =>
        `<g id="${p.id}" transform="translate(100 100) rotate(0) scale(0)" opacity="1"><path d="${p.d}" fill="${p.fill ? `{{${p.colour}}}` : "none"}" stroke="${p.fill ? "{{inkColor}}" : `{{${p.colour}}}`}" stroke-width="${p.fill ? "{{inkWidth}}" : 6}" stroke-linecap="round" stroke-linejoin="round"/>${p.fill ? `<circle cx="-3" cy="-4" r="2.5" fill="#FFFFFF" opacity="{{sheenA}}"/>` : ""}</g>`,
    ).join("");
    const out = PIECES.flatMap((p, i): SvgAnimation[] => [
      { id: p.id, attrs: { transform: ["translate(100 100) rotate(0) scale(0)", `translate(${p.x} ${p.y}) rotate(${p.turn}) scale(1)`] }, delay: i * 35, ms: 650, ease: { spring: { stiffness: 260, damping: 13 } } },
      { id: p.id, attrs: { opacity: [1, 0] }, delay: 1300 + i * 30, ms: 300 },
    ]);
    return {
      svg: `<svg viewBox="0 0 200 200"><!-- {{c1: color default=#FF2A85 label='Pink'}} {{c2: color default=#06B6D4 label='Cyan'}} {{c3: color default=#FACC15 label='Yellow'}} {{c4: color default=#C084FC label='Purple'}} ${styleControls({ style: 1, ink: 2.5, sheen: 0, offset: 4 })} --><defs>${styleShadow("memphisShadow")}</defs><g filter="url(#memphisShadow)">${shapes}</g></svg>`,
      animate: out,
    };
  })(),
};

export const momentEffects: VectorEffect[] = [slopVat, gooDropReveal, memphisBurst];
