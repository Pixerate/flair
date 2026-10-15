import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A point `radius` from the clock's centre (100, 100), `degrees` clockwise from 12. */
const at = (degrees: number, radius: number) => {
  const a = (degrees * Math.PI) / 180;
  return [r1(100 + radius * Math.sin(a)), r1(100 - radius * Math.cos(a))] as const;
};

/** A pie slice of the dial from `from` to `to` degrees clockwise from 12. */
const slice = (from: number, to: number, radius: number) => {
  const [x0, y0] = at(from, radius);
  const [x1, y1] = at(to, radius);
  return `M100 100 L${x0} ${y0} A${radius} ${radius} 0 0 1 ${x1} ${y1}Z`;
};

/** One clock cycle: day, dusk, night, dawn, 2 s each. */
const CYCLE = 8000;
const PHASE = CYCLE / 4;
/** How long the sky takes to change at the end of each phase. */
const FADE = 1400;

const TICKS = Array.from({ length: 12 }, (_, i) => {
  const [x0, y0] = at(i * 30, i % 3 ? 80 : 74);
  const [x1, y1] = at(i * 30, 86);
  return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="{{hands}}" stroke-width="${i % 3 ? 2 : 4}" stroke-linecap="round" opacity="0.8"/>`;
}).join("");

const STARS = [
  [62, 50, 1.6], [128, 44, 1.2], [150, 78, 1.8], [44, 92, 1.2], [70, 140, 1.4], [138, 132, 1.2], [104, 160, 1.6], [92, 34, 1], [160, 110, 1], [36, 124, 1.4],
]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF"/>`)
  .join("");

// Fading wedges behind the minute hand: older (further back) is fainter.
const TRAIL = [0.07, 0.13, 0.22]
  .map((opacity, i) => `<path d="${slice(-36 + i * 12, -24 + i * 12, 72)}" fill="{{trail}}" opacity="${opacity}"/>`)
  .join("");

/** The sky's colour from one phase to the next, at the end of each phase. */
const SKY: readonly (readonly [string, string])[] = [
  ["{{day}}", "{{dusk}}"],
  ["{{dusk}}", "{{night}}"],
  ["{{night}}", "{{dawn}}"],
  ["{{dawn}}", "{{day}}"],
];

export const timeLapseClock: VectorEffect = {
  kind: "vector",
  id: "time-lapse-clock",
  name: "Time-lapse clock",
  description: "A clock whose hands race round while the sky behind turns from day to dusk, night and dawn.",
  category: "timewarp",
  tags: ["time", "clock", "time-lapse", "day", "night", "loader"],
  hold: 0,
  presets: [
    { name: "Pastel", values: { day: [0.75, 0.9, 1], dusk: [1, 0.72, 0.6], night: [0.36, 0.33, 0.6], dawn: [1, 0.85, 0.9] } },
    { name: "Mono", values: { day: [0.9, 0.9, 0.9], dusk: [0.55, 0.55, 0.55], night: [0.1, 0.1, 0.1], dawn: [0.7, 0.7, 0.7], sun: [1, 1, 1], trail: [1, 1, 1] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 200 200"><!-- {{day: color default=#7DD3FC label='Day'}} {{dusk: color default=#F97316 label='Dusk'}} {{night: color default=#0F172A label='Night'}} {{dawn: color default=#F9A8D4 label='Dawn'}} {{sun: color default=#FDE68A label='Sun'}} {{hands: color default=#FFFFFF label='Hands'}} {{trail: color default=#FDE68A label='Trail'}} --><circle id="sky" cx="100" cy="100" r="92" fill="{{day}}"/><g id="stars" opacity="0">${STARS}</g><g id="orbit" transform="rotate(0 100 100)"><circle id="sun" cx="100" cy="38" r="11" fill="{{sun}}"/></g>${TICKS}<circle cx="100" cy="100" r="92" fill="none" stroke="{{hands}}" stroke-width="4" opacity="0.9"/><g id="hour" transform="rotate(0 100 100)"><line x1="100" y1="106" x2="100" y2="56" stroke="#000000" stroke-opacity="0.25" stroke-width="9" stroke-linecap="round"/><line x1="100" y1="106" x2="100" y2="56" stroke="{{hands}}" stroke-width="6" stroke-linecap="round"/></g><g id="minute" transform="rotate(0 100 100)">${TRAIL}<line x1="100" y1="110" x2="100" y2="28" stroke="#000000" stroke-opacity="0.25" stroke-width="6" stroke-linecap="round"/><line x1="100" y1="110" x2="100" y2="28" stroke="{{hands}}" stroke-width="3.5" stroke-linecap="round"/></g><circle cx="100" cy="100" r="5" fill="{{hands}}"/></svg>`,
    animate: [
      // Twelve turns of the minute hand to one of the hour hand, and the sun once round the sky.
      { id: "minute", attrs: { transform: ["rotate(0 100 100)", "rotate(4320 100 100)"] }, ms: CYCLE, ease: "linear" },
      { id: "hour", attrs: { transform: ["rotate(0 100 100)", "rotate(360 100 100)"] }, ms: CYCLE, ease: "linear" },
      { id: "orbit", attrs: { transform: ["rotate(0 100 100)", "rotate(360 100 100)"] }, ms: CYCLE, ease: "linear" },
      ...SKY.map(([from, to], i): SvgAnimation => ({ id: "sky", attrs: { fill: [from, to] }, delay: (i + 1) * PHASE - FADE, ms: FADE, ease: "in-out" })),
      // Stars come out at night; the sun fades while it is below the horizon.
      { id: "stars", attrs: { opacity: [0, 1] }, delay: 2 * PHASE - FADE, ms: FADE, ease: "in-out" },
      { id: "stars", attrs: { opacity: [1, 0] }, delay: 3 * PHASE - FADE, ms: FADE, ease: "in-out" },
      { id: "sun", attrs: { opacity: [1, 0.25] }, delay: PHASE, ms: PHASE, ease: "in-out" },
      { id: "sun", attrs: { opacity: [0.25, 1] }, delay: 3 * PHASE - FADE, ms: FADE, ease: "in-out" },
    ],
  },
};

/** Time warps: echoes, rewinds, freezes and tunnels, as vector effects. */
export const timewarpEffects: VectorEffect[] = [timeLapseClock];
