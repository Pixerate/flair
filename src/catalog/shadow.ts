import { textWidthEm } from "./images.js";
import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

const SANS = `system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;

/** Text fitted to `width` units, at most `max` high: its font size and width. */
function fit(text: unknown, width: number, max: number) {
  const e = Math.max(0.6, textWidthEm(String(text)));
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size) };
}

/** The card's transform about its centre (160, 120): raised `up` units and scaled by `scale`. */
const raised = (up: number, scale: number) => `translate(0 ${-up}) translate(160 120) scale(${scale}) translate(-160 -120)`;

export const liftCard: VectorEffect = {
  kind: "vector",
  id: "lift-card",
  name: "Lift card",
  description: "A content card that lifts toward you on hover like a material elevation change, rising and growing slightly as its shadow spreads and softens beneath it.",
  category: "shadow",
  tags: ["shadow", "card", "hover", "interactive", "elevation", "material", "ui", "micro-interaction"],
  trigger: "hover",
  hold: 800,
  presets: [
    { name: "Dark", values: { background: [0.07, 0.08, 0.11], card: [0.13, 0.15, 0.2], ink: [0.9, 0.92, 0.96], shadow: [0, 0, 0], accent: [0.4, 0.85, 1] } },
    { name: "Warm", values: { title: "Weekend recipes", background: [0.98, 0.94, 0.88], accent: [0.93, 0.42, 0.25], shadow: [0.35, 0.18, 0.08] } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.title, 116, 17);
    return { size, length, base: r1(82 + size * 0.35) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 240"><!-- {{title: text default='Getting started' label='Title'}} {{background: color default=#EEF1F6 label='Background'}} {{card: color default=#FFFFFF label='Card'}} {{ink: color default=#1F2937 label='Text colour'}} {{accent: color default=#6366F1 label='Accent'}} {{shadow: color default=#0F172A label='Shadow colour'}} --><defs><filter id="liftCardTight" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="liftCardSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter></defs><rect width="320" height="240" fill="{{background}}"/><rect id="liftCardAmbient" x="70" y="50" width="180" height="140" rx="14" fill="{{shadow}}" opacity="0" filter="url(#liftCardSoft)" transform="${raised(-4, 0.94)}"/><rect id="liftCardKey" x="70" y="50" width="180" height="140" rx="14" fill="{{shadow}}" opacity="0.22" filter="url(#liftCardTight)" transform="translate(0 2)"/><g id="liftCardFace" transform="${raised(0, 1)}"><rect x="70" y="50" width="180" height="140" rx="14" fill="{{card}}"/><circle cx="98" cy="80" r="12" fill="{{accent}}"/><text x="118" y="{{base}}" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="700" fill="{{ink}}">{{title}}</text><g fill="{{ink}}" opacity="0.16"><rect x="86" y="108" width="148" height="8" rx="4"/><rect x="86" y="124" width="148" height="8" rx="4"/><rect x="86" y="140" width="96" height="8" rx="4"/></g><rect x="86" y="160" width="54" height="16" rx="8" fill="{{accent}}"/></g></svg>`,
    animate: [
      { id: "liftCardFace", attrs: { transform: [raised(0, 1), raised(6, 1.02)] }, ms: 260, ease: "out" },
      { id: "liftCardAmbient", attrs: { opacity: [0, 0.3], transform: [raised(-4, 0.94), raised(-16, 1)] }, ms: 300, ease: "out" },
      { id: "liftCardKey", attrs: { opacity: [0.22, 0.12], transform: ["translate(0 2)", "translate(0 5)"] }, ms: 260, ease: "out" },
    ],
  },
};

// ── Exploded layers ────────────────────────────────────────────────────

/*
 * An isometric card pulled apart into its layers. Each layer is drawn flat
 * round (0, 0) and laid on the floor by one matrix (rotated 45° and squashed
 * to half height); each lifts inside the layer below it, so the gaps add up
 * and stagger without layers passing through each other. A layer's soft
 * shadow sits on the one below and spreads as the gap opens.
 */

const EL_X = 200;
const EL_Y = 196;
/** The floor: flat (x, y) to isometric. */
const EL_ISO = `translate(${EL_X} ${EL_Y}) matrix(0.866 0.5 -0.866 0.5 0 0)`;

/** The timeline at speed 1, in ms: each layer lifts in turn, holds, and the top settles first. */
const EL_TIMES = { up1: 280, up2: 400, up3: 520, upMs: 680, down3: 2100, down2: 2220, down1: 2340, downMs: 620 } as const;
/** A derived timing in an animation's `delay` or `ms`. */
const elT = (name: keyof typeof EL_TIMES) => `{{el_${name}}}` as unknown as number;

/** A layer drawn flat on the floor, with a darker side `side` units thick below it. */
const elSlab = (body: string, side: number) =>
  `<g transform="translate(0 ${side})"><g transform="${EL_ISO}">${body}</g></g><g transform="translate(0 ${side})"><g transform="${EL_ISO}" fill="{{shadow}}" opacity="0.2">${body}</g></g><g transform="${EL_ISO}">${body}</g>`;

const EL_IMAGE = `<rect x="-66" y="-46" width="132" height="58" rx="7"/>`;
const EL_BADGE = `<circle cx="62" cy="-40" r="17"/>`;

/** A soft shadow on the layer below: its blur and how far it falls are animated. */
const elShadow = (k: number, footprint: string) =>
  `<g id="elS${k}" transform="translate(0 0)" opacity="0.34"><g transform="${EL_ISO}" fill="{{shadow}}" filter="url(#explodedLayersBlur${k})">${footprint}</g></g>`;

export const explodedLayers: VectorEffect = {
  kind: "vector",
  id: "exploded-layers",
  name: "Exploded layers",
  description: "An isometric UI card whose layers (shadow plate, card base, image and text lines, floating badge) lift apart one after another, showing the gaps and the soft shadows between them, hold, then settle back together.",
  category: "shadow",
  tags: ["shadow", "isometric", "layers", "exploded", "card", "ui", "depth", "3d", "loop"],
  hold: 500,
  presets: [
    { name: "Dark", values: { background: [0.07, 0.08, 0.12], card: [0.16, 0.18, 0.25], accent: [0.35, 0.85, 0.95], shadow: [0, 0, 0] } },
    { name: "Coral", values: { background: [1, 0.95, 0.92], accent: [0.97, 0.42, 0.36], shadow: [0.4, 0.12, 0.08], lift: 38 } },
    { name: "Slow and deep", values: { lift: 44, speed: 0.6 } },
  ],
  derived: (v) => {
    const speed = Math.max(0.1, Number(v.speed));
    const lift = Number(v.lift);
    return {
      ...Object.fromEntries(Object.entries(EL_TIMES).map(([name, ms]) => [`el_${name}`, Math.round(ms / speed)])),
      up: r1(-lift),
      fall: r1(lift * 0.92),
      spread: r1(lift * 0.12),
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{background: color default=#ECEFF7 label='Background'}} {{card: color default=#FFFFFF label='Card'}} {{accent: color default=#6366F1 label='Accent'}} {{shadow: color default=#1E1B4B label='Shadow colour'}} {{lift: float min=10 max=46 default=34 step=1 label='Lift distance'}} {{speed: float min=0.25 max=3 default=1 step=0.05 label='Speed'}} --><defs>${[0, 1, 2, 3]
      .map((k) => `<filter id="explodedLayersBlur${k}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur id="elBlur${k}" stdDeviation="${k ? 1.5 : 4}"/></filter>`)
      .join("")}</defs><rect width="400" height="300" fill="{{background}}"/><g id="elS0" transform="translate(0 6)" opacity="0.32"><g transform="${EL_ISO}" fill="{{shadow}}" filter="url(#explodedLayersBlur0)"><rect x="-84" y="-62" width="168" height="124" rx="14"/></g></g><g id="elL1" transform="translate(0 0)"><g fill="{{card}}">${elSlab(`<rect x="-80" y="-58" width="160" height="116" rx="12"/>`, 7)}</g><g transform="${EL_ISO}"><rect x="-80" y="-58" width="160" height="116" rx="12" fill="none" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1"/></g>${elShadow(1, `${EL_IMAGE}<rect x="-66" y="22" width="112" height="9" rx="4.5"/><rect x="-66" y="38" width="76" height="9" rx="4.5"/>`)}<g id="elL2" transform="translate(0 0)"><g fill="{{accent}}">${elSlab(EL_IMAGE, 3)}</g><g transform="${EL_ISO}"><path d="M-60 6 L-30 -22 L-8 0 L10 -14 L60 6 Z" fill="#FFFFFF" opacity="0.4"/><circle cx="34" cy="-28" r="8" fill="#FFFFFF" opacity="0.55"/><rect x="-66" y="-46" width="132" height="58" rx="7" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/><g fill="{{accent}}" opacity="0.35"><rect x="-66" y="22" width="112" height="9" rx="4.5"/><rect x="-66" y="38" width="76" height="9" rx="4.5"/></g></g>${elShadow(2, EL_BADGE)}<g id="elL3" transform="translate(0 0)"><g fill="{{accent}}">${elSlab(EL_BADGE, 4)}</g><g transform="${EL_ISO}"><circle cx="62" cy="-40" r="12.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="1.5"/><path d="M55 -40 L60 -35 L69 -45" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></g></g></g></svg>`,
    animate: [
      // Up: each layer in turn rises off the one below, its shadow falling back and spreading.
      ...([1, 2, 3] as const).flatMap((k): SvgAnimation[] => [
        { id: `elL${k}`, attrs: { transform: ["translate(0 0)", "translate(0 {{up}})"] }, delay: elT(`up${k}`), ms: elT("upMs"), ease: "in-out" },
        { id: `elL${k}`, attrs: { transform: ["translate(0 {{up}})", "translate(0 0)"] }, delay: elT(`down${k}`), ms: elT("downMs"), ease: "in-out" },
      ]),
      ...([1, 2, 3] as const).flatMap((k): SvgAnimation[] => {
        // The layer's shadow on the one below (the floor's for the card base).
        const s = `elS${k - 1}`;
        const rest = k === 1 ? "translate(0 6)" : "translate(0 0)";
        const open = k === 1 ? "translate({{spread}} {{fall}})" : "translate({{spread}} {{spread}})";
        const [o0, o1] = k === 1 ? [0.32, 0.18] : [0.34, 0.2];
        const [b0, b1] = k === 1 ? [4, 11] : [1.5, 6];
        return [
          { id: s, attrs: { transform: [rest, open], opacity: [o0, o1] }, delay: elT(`up${k}`), ms: elT("upMs"), ease: "in-out" },
          { id: s, attrs: { transform: [open, rest], opacity: [o1, o0] }, delay: elT(`down${k}`), ms: elT("downMs"), ease: "in-out" },
          { id: `elBlur${k - 1}`, attrs: { stdDeviation: [b0, b1] }, delay: elT(`up${k}`), ms: elT("upMs"), ease: "in-out" },
          { id: `elBlur${k - 1}`, attrs: { stdDeviation: [b1, b0] }, delay: elT(`down${k}`), ms: elT("downMs"), ease: "in-out" },
        ];
      }),
    ],
  },
};

/** Shadows as vector effects: lifting cards and exploded layers. */
export const shadowEffects: VectorEffect[] = [liftCard, explodedLayers];
