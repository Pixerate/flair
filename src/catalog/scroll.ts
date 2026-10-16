import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Vector effects that follow the page: `trigger: "scroll"`, so `SvgPlayer`
 * scrubs each picture with its element's progress through the viewport
 * (see `SvgPlayerOptions.scrollRange`) instead of playing it on a clock.
 * Every id is prefixed with the effect's name, so pictures can share a page.
 */

/** A derived or declared number in an animation's numeric field. */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

export const scrollDraw: VectorEffect = {
  kind: "vector",
  id: "scroll-draw",
  name: "Scroll draw",
  description: "A line drawing itself along its path as the page scrolls, a dot riding its tip, and undrawing as you scroll back.",
  category: "scroll",
  trigger: "scroll",
  tags: ["interactive", "scroll", "line", "path", "draw", "route", "storytelling"],
  motion: {
    svg: `<svg viewBox="0 0 400 200" fill="none"><!-- {{accent: color default=#6366F1 label='Line'}} {{track: color default=#CBD5E1 label='Track'}} {{width: float min=1 max=16 default=6 step=1 label='Width'}} --><path d="{{path: text default='M24 160 C84 20 150 24 196 100 S318 186 376 44' label='Path'}}" stroke="{{track}}" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/><path id="scrollDrawLine" d="{{path}}" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/><circle id="scrollDrawDot" cx="0" cy="0" r="{{dot}}" fill="{{accent}}" stroke="#FFFFFF" stroke-width="3"/></svg>`,
    animate: [
      { id: "scrollDrawLine", draw: true, ms: 1000, ease: "linear" },
      { id: "scrollDrawDot", along: "scrollDrawLine", ms: 1000, ease: "linear" },
    ],
  },
  derived: (v) => ({ dot: Math.round((Number(v.width) * 0.9 + 4) * 10) / 10 }),
  presets: [
    { name: "Signature", values: { path: "M30 140 C60 60 90 60 100 120 C110 170 140 70 170 90 C200 110 190 150 220 130 C250 110 270 80 300 110 C320 130 350 120 370 90", width: 4, accent: [0.07, 0.09, 0.15] } },
    { name: "Bold", values: { width: 12, accent: [0.93, 0.27, 0.27] } },
  ],
};

export const scrollCounter: VectorEffect = {
  kind: "vector",
  id: "scroll-counter",
  name: "Scroll counter",
  description: "A big number counting up as it scrolls into view, with its label and a line growing under it.",
  category: "scroll",
  trigger: "scroll",
  tags: ["interactive", "scroll", "counter", "number", "stat", "kpi", "landing page"],
  motion: {
    svg: `<svg viewBox="0 0 400 200" font-family="${SANS}"><!-- {{accent: color default=#0EA5E9 label='Accent'}} {{ink: color default=#0F172A label='Number'}} {{muted: color default=#64748B label='Label colour'}} {{value: float min=0 max=1000000 default=2400 step=1 label='Number'}} {{decimals: int min=0 max=3 default=0 label='Decimals'}} --><text id="scrollCounterValue" x="200" y="112" text-anchor="middle" font-size="76" font-weight="800" fill="{{ink}}" style="font-variant-numeric: tabular-nums">0</text><rect id="scrollCounterLine" x="140" y="132" width="0" height="6" rx="3" fill="{{accent}}"/><text x="200" y="170" text-anchor="middle" font-size="20" font-weight="500" fill="{{muted}}">{{label: text default='happy customers' label='Label'}}</text></svg>`,
    animate: [
      { id: "scrollCounterValue", count: [0, n("value")], format: "{{prefix: text default='' label='Before the number'}}{n}{{suffix: text default='+' label='After the number'}}", decimals: n("decimals"), ms: 1000, ease: "out" },
      { id: "scrollCounterLine", attrs: { width: [0, 120] }, ms: 1000, ease: "out" },
    ],
  },
  presets: [
    { name: "Revenue", values: { value: 12.5, decimals: 1, prefix: "$", suffix: "M", label: "raised so far" } },
    { name: "Percent", values: { value: 98, suffix: "%", label: "uptime", accent: [0.13, 0.77, 0.37] } },
  ],
};

const STEP_X = [60, 160, 260, 360];

export const scrollSteps: VectorEffect = {
  kind: "vector",
  id: "scroll-steps",
  name: "Scroll steps",
  description: "Four step markers joined by a line that fills as you scroll, each marker lighting up as the line reaches it.",
  category: "scroll",
  trigger: "scroll",
  tags: ["interactive", "scroll", "steps", "progress", "timeline", "onboarding", "ui"],
  motion: {
    svg: `<svg viewBox="0 0 420 160" font-family="${SANS}"><!-- {{accent: color default=#8B5CF6 label='Accent'}} {{track: color default=#E2E8F0 label='Track'}} {{text: color default=#334155 label='Text'}} --><line x1="60" y1="64" x2="360" y2="64" stroke="{{track}}" stroke-width="6" stroke-linecap="round"/><line id="scrollStepsLine" x1="60" y1="64" x2="360" y2="64" stroke="{{accent}}" stroke-width="6" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>${STEP_X.map(
      (x, i) =>
        `<circle cx="${x}" cy="64" r="20" fill="#FFFFFF" stroke="{{track}}" stroke-width="4"/><circle id="scrollStepsDot${i}" cx="${x}" cy="64" r="0" fill="{{accent}}"/><text id="scrollStepsNum${i}" x="${x}" y="71" text-anchor="middle" font-size="19" font-weight="700" fill="#94A3B8">${i + 1}</text><text x="${x}" y="118" text-anchor="middle" font-size="15" font-weight="600" fill="{{text}}">{{step${i + 1}: text default='${["Sign up", "Connect", "Customise", "Launch"][i]}' label='Step ${i + 1}'}}</text>`,
    ).join("")}</svg>`,
    animate: [
      { id: "scrollStepsLine", draw: true, ms: 1000, ease: "linear" },
      ...STEP_X.flatMap((_, i): SvgAnimation[] => [
        { id: `scrollStepsDot${i}`, attrs: { r: [0, 22] as const }, delay: Math.round((i * 1000) / 3) - (i ? 60 : 0), ms: 160, ease: "out" as const },
        { id: `scrollStepsNum${i}`, attrs: { fill: ["#94A3B8", "#FFFFFF"] as const }, delay: Math.round((i * 1000) / 3) - (i ? 60 : 0), ms: 160, ease: "out" as const },
      ]),
    ],
  },
  presets: [
    { name: "Checkout", values: { step1: "Cart", step2: "Details", step3: "Payment", step4: "Done", accent: [0.06, 0.73, 0.51] } },
  ],
};

/** The scroll category's vector effects. */
export const scrollEffects: readonly VectorEffect[] = [scrollDraw, scrollCounter, scrollSteps];
