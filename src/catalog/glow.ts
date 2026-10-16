import { rgbToHex } from "../shader/controls.js";
import type { SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

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

// ── Glow ring pulse ────────────────────────────────────────────────────

/** Rings in flight at once, evenly spaced through the loop. */
const RINGS = 3;
/** Rings are born under the core (so they appear without a pop) and fade out by the outer radius. */
const RING_FROM = 18;
const RING_TO = 112;

/**
 * Each ring grows from the core and fades out over one period, starting a
 * share of the period along: it plays from there to the end, then from the
 * start back to where it began, both linear, so the loop is seamless.
 */
function ringAnimations(k: number): SvgAnimation[] {
  const at = (phase: number) => ({ r: r1(RING_FROM + (RING_TO - RING_FROM) * phase), o: Math.round((1 - phase) * 100) / 100 });
  const id = `glowRingPulseRing${k}`;
  const phase = k / RINGS;
  const from = at(phase);
  const end = at(1);
  const start = at(0);
  const out: SvgAnimation[] = [
    {
      id,
      attrs: { r: [from.r, end.r], opacity: [from.o, end.o], "stroke-width": [n(`ws${k}`), n("wEnd")] },
      ms: n(`rest${k}`),
    },
  ];
  if (phase > 0)
    out.push({
      id,
      attrs: { r: [start.r, from.r], opacity: [start.o, from.o], "stroke-width": [n("wStart"), n(`ws${k}`)] },
      delay: n(`rest${k}`),
      ms: n(`lead${k}`),
    });
  return out;
}

export const glowRingPulse: VectorEffect = {
  kind: "vector",
  id: "glow-ring-pulse",
  name: "Glow ring pulse",
  description: "Glowing rings pulsing out from a softly breathing core in endless waves, like a beacon or a live indicator.",
  category: "glow",
  tags: ["glow", "ring", "pulse", "beacon", "live", "loop", "radar"],
  hold: 0,
  presets: [
    { name: "Live", values: { ring: [1, 0.25, 0.35], core: [1, 0.72, 0.75], period: 1.6 } },
    { name: "Gold", values: { ring: [1, 0.75, 0.25], core: [1, 0.95, 0.75], background: [0.08, 0.06, 0.03], glow: 8 } },
    { name: "Light", values: { background: [0.96, 0.97, 1], ring: [0.31, 0.27, 0.9], core: [0.55, 0.5, 1], glow: 4 } },
  ],
  derived: (v) => {
    const period = Math.round(Number(v.period) * 1000);
    const width = Number(v.width);
    const out: Record<string, number> = { half: Math.round(period / 2), wStart: r1(width * 1.6), wEnd: r1(width * 0.4) };
    for (let k = 0; k < RINGS; k++) {
      const phase = k / RINGS;
      out[`rest${k}`] = Math.round(period * (1 - phase));
      out[`lead${k}`] = period - out[`rest${k}`]!;
      out[`ws${k}`] = r1(width * (1.6 - 1.2 * phase));
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 240 240"><!-- {{period: float min=0.8 max=6 default=2.4 step=0.1 label='Seconds per wave'}} {{width: float min=1 max=10 default=4 step=0.5 label='Ring width'}} --><defs><filter id="glowRingPulseGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="{{glow: float min=0 max=16 default=6 step=0.5 label='Glow'}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="glowRingPulseCoreFill"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.45" stop-color="{{core: color default=#A5F3FC label='Core'}}"/><stop offset="1" stop-color="{{ring: color default=#22D3EE label='Ring'}}"/></radialGradient></defs><rect width="240" height="240" fill="{{background: color default=#060A14 label='Background'}}"/><g filter="url(#glowRingPulseGlow)">${Array.from(
      { length: RINGS },
      (_, k) => `<circle id="glowRingPulseRing${k}" cx="120" cy="120" r="${r1(RING_FROM + ((RING_TO - RING_FROM) * k) / RINGS)}" fill="none" stroke="{{ring}}" stroke-width="{{ws${k}}}" opacity="${Math.round((1 - k / RINGS) * 100) / 100}"/>`,
    ).join("")}<circle id="glowRingPulseCore" cx="120" cy="120" r="22" fill="url(#glowRingPulseCoreFill)"/></g></svg>`,
    animate: [
      ...Array.from({ length: RINGS }, (_, k) => ringAnimations(k)).flat(),
      // The core breathes once a period, out and back, so it too loops seamlessly.
      { id: "glowRingPulseCore", attrs: { r: [22, 26] }, ms: n("half"), ease: "in-out" },
      { id: "glowRingPulseCore", attrs: { r: [26, 22] }, delay: n("half"), ms: n("half"), ease: "in-out" },
    ],
  },
};

// ── Glow button ────────────────────────────────────────────────────────

/** The halo's pose: scaled `s` about the button's centre (160, 70). */
const haloPose = (s: number) => `translate(160 70) scale(${s}) translate(-160 -70)`;

export const glowButton: VectorEffect = {
  kind: "vector",
  id: "glow-button",
  name: "Glow button",
  description: "A pill button with a soft glow that, on hover, brightens, spreads its glow wider and lifts a little.",
  category: "glow",
  tags: ["glow", "button", "hover", "interactive", "ui", "cta", "neon"],
  trigger: "hover",
  hold: 800,
  presets: [
    { name: "Violet", values: { accent: [0.55, 0.36, 0.96], background: [0.05, 0.04, 0.09] } },
    { name: "Mint", values: { accent: [0.2, 0.9, 0.6], ink: [0.02, 0.15, 0.1], label: "Start free trial" } },
    { name: "Sunset", values: { accent: [1, 0.45, 0.3], label: "Join now" } },
  ],
  derived: (v) => {
    const { size, length } = fit(v.label, 180, 22);
    return { size, length, base: r1(70 + size * 0.35), bright: mixHex(v.accent, [1, 1, 1], 0.3) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 140"><!-- {{label: text default='Get started' label='Label'}} {{background: color default=#0A0D18 label='Background'}} {{accent: color default=#38BDF8 label='Accent'}} {{ink: color default=#04121C label='Label colour'}} --><defs><filter id="glowButtonBlur" x="-60%" y="-120%" width="220%" height="340%"><feGaussianBlur id="glowButtonSpread" stdDeviation="10"/></filter><linearGradient id="glowButtonSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect width="320" height="140" fill="{{background}}"/><g opacity="0.9"><g id="glowButtonHalo" transform="${haloPose(1)}" opacity="0.55"><rect x="50" y="42" width="220" height="56" rx="28" fill="{{accent}}" filter="url(#glowButtonBlur)"/></g></g><g id="glowButtonLift" transform="translate(0 0)"><rect id="glowButtonFace" x="50" y="42" width="220" height="56" rx="28" fill="{{accent}}"/><rect x="50" y="42" width="220" height="56" rx="28" fill="url(#glowButtonSheen)"/><text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="700" letter-spacing="0.3" fill="{{ink}}">{{label}}</text></g></svg>`,
    animate: [
      { id: "glowButtonHalo", attrs: { opacity: [0.55, 0.95], transform: [haloPose(1), haloPose(1.08)] }, ms: 320, ease: "out" },
      { id: "glowButtonSpread", attrs: { stdDeviation: [10, 14] }, ms: 320, ease: "out" },
      { id: "glowButtonLift", attrs: { transform: ["translate(0 0)", "translate(0 -3)"] }, ms: 260, ease: "out" },
      { id: "glowButtonFace", attrs: { fill: ["{{accent}}", "{{bright}}"] }, ms: 260 },
    ],
  },
};

/** Glows as vector effects: ring pulses and glowing buttons. */
export const glowEffects: VectorEffect[] = [glowRingPulse, glowButton];
