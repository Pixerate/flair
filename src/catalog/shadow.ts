import { textWidthEm } from "./images.js";
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

/** Shadows as vector effects: lifting cards. */
export const shadowEffects: VectorEffect[] = [liftCard];
