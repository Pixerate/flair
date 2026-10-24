import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A transform scaling by `s` about (`cx`, `cy`). */
const about = (cx: number, cy: number, s: number) => `translate(${cx} ${cy}) scale(${Math.round(s * 1000) / 1000}) translate(${-cx} ${-cy})`;

/** Instant change: the attribute snaps to `value` at `delay` (resets of hidden elements). */
const snap = (id: string, attr: string, value: string | number, delay: number, step?: number): SvgAnimation => ({
  id,
  ...(step === undefined ? {} : { step }),
  attrs: { [attr]: [value, value] },
  delay,
  ms: 0,
});

const SANS = `system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

/** A lightning bolt in a 120 box, centred on (60, 60). */
const BOLT = "M68 8 L28 66 L56 66 L46 112 L92 48 L64 48 L76 8 Z";

export const zapIcon: VectorEffect = {
  kind: "vector",
  id: "zap-icon",
  name: "Zap icon",
  description: "A lightning bolt icon that draws itself on, flashes with a burst of glow and sparks, then settles.",
  category: "electric",
  tags: ["electric", "icon", "lightning", "bolt", "ui", "energy"],
  hold: 1000,
  presets: [
    { name: "Electric blue", values: { bolt: [0.22, 0.74, 0.97], glow: [0.73, 0.9, 0.99] } },
    { name: "Light", values: { background: [1, 1, 1], bolt: [0.92, 0.7, 0.03], glow: [0.99, 0.83, 0.3] } },
  ],
  motion: (() => {
    // Sparks flying off the bolt: angle in degrees, from and to radii round the centre.
    const sparks = [-55, 25, 160, 215].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const at = (r: number) => [r1(60 + r * Math.cos(a)), r1(60 + r * Math.sin(a))] as const;
      return { id: `s${i}`, from: at(30), mid: at(46), to: at(56) };
    });
    return {
      svg: `<svg viewBox="0 0 120 120"><!-- {{background: color default=#0B1020 label='Background'}} {{bolt: color default=#FACC15 label='Bolt'}} {{glow: color default=#FDE68A label='Glow'}} --><defs><filter id="zapGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter></defs><rect width="120" height="120" fill="{{background}}"/><circle id="burst" cx="60" cy="60" r="20" fill="none" stroke="{{glow}}" stroke-width="6" opacity="0"/><path id="halo" d="${BOLT}" fill="{{glow}}" filter="url(#zapGlow)" opacity="0"/>${sparks
        .map(({ id, from }) => `<line id="${id}" x1="${from[0]}" y1="${from[1]}" x2="${from[0]}" y2="${from[1]}" stroke="{{glow}}" stroke-width="3" stroke-linecap="round" opacity="0"/>`)
        .join("")}<g id="zap" transform="${about(60, 60, 1)}"><path id="fill" d="${BOLT}" fill="{{bolt}}" fill-opacity="0"/><path id="outline" d="${BOLT}" fill="none" stroke="{{bolt}}" stroke-width="3.5" stroke-linejoin="round"/></g></svg>`,
      animate: [
        { id: "outline", draw: true, ms: 550, ease: "in-out" },
        { id: "fill", attrs: { "fill-opacity": [0, 1] }, delay: 500, ms: 100 },
        // The flash: a pop, a burst of glow and a ring, then a soft glow stays.
        { id: "zap", attrs: { transform: [about(60, 60, 1), about(60, 60, 1.16)] }, delay: 560, ms: 110, ease: "out" },
        { id: "zap", attrs: { transform: [about(60, 60, 1.16), about(60, 60, 1)] }, delay: 670, ms: 320, ease: "in-out" },
        { id: "halo", attrs: { opacity: [0, 1] }, delay: 560, ms: 70 },
        { id: "halo", attrs: { opacity: [1, 0.35] }, delay: 630, ms: 600, ease: "out" },
        snap("burst", "opacity", 0, 0),
        { id: "burst", attrs: { r: [20, 58], "stroke-width": [6, 0], opacity: [0.9, 0] }, delay: 560, ms: 520, ease: "out" },
        ...sparks.flatMap(({ id, from, mid, to }, i): SvgAnimation[] => [
          { id, attrs: { opacity: [0, 1] }, delay: 570 + i * 25, ms: 30 },
          { id, attrs: { x2: [from[0], mid[0]], y2: [from[1], mid[1]] }, delay: 570 + i * 25, ms: 150, ease: "out" },
          { id, attrs: { x1: [from[0], to[0]], y1: [from[1], to[1]], x2: [mid[0], to[0]], y2: [mid[1], to[1]], opacity: [1, 0] }, delay: 720 + i * 25, ms: 220, ease: "out" },
        ]),
      ],
    };
  })(),
};

/** The power symbol: an arc open at the top round (80, 82), and a bar through the gap. */
const POWER_ARC = "M63.3 62.1 A26 26 0 1 0 96.7 62.1";
const POWER_BAR = "M80 48 L80 78";

export const powerButton: VectorEffect = {
  kind: "vector",
  id: "power-button",
  name: "Power button",
  description: "A power button that lights up with a glow ring and its on colour when clicked, and dims again on the next click.",
  category: "electric",
  tags: ["electric", "interactive", "ui", "click", "power", "toggle", "button", "icon"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Green", values: { on: [0.29, 0.87, 0.5] } },
    { name: "Light", values: { background: [0.96, 0.97, 0.98], button: [1, 1, 1], off: [0.6, 0.64, 0.7], on: [0.39, 0.4, 0.95] } },
  ],
  motion: (() => {
    const symbol = (id: string, stroke: string) =>
      `<path id="${id}Arc" d="${POWER_ARC}" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path id="${id}Bar" d="${POWER_BAR}" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/>`;
    const press = (step: number, depth: number): SvgAnimation[] => [
      { id: "press", step, attrs: { transform: [about(80, 80, 1), about(80, 80, depth)] }, ms: 90, ease: "out" },
      { id: "press", step, attrs: { transform: [about(80, 80, depth), about(80, 80, 1)] }, delay: 90, ms: 260, ease: "in-out" },
    ];
    const colours = (step: number, from: string, to: string, delay: number): SvgAnimation[] =>
      ["symArc", "symBar"].map((id) => ({ id, step, attrs: { stroke: [from, to] }, delay, ms: 220 }));
    return {
      svg: `<svg viewBox="0 0 160 160"><!-- {{background: color default=#0B0F19 label='Background'}} {{button: color default=#1A2030 label='Button'}} {{off: color default=#5B6475 label='Off'}} {{on: color default=#22D3EE label='On'}} --><defs><filter id="pbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="160" height="160" fill="{{background}}"/><circle id="halo" cx="80" cy="80" r="52" fill="none" stroke="{{on}}" stroke-width="8" opacity="0" filter="url(#pbGlow)"/><circle id="pulse" cx="80" cy="80" r="50" fill="none" stroke="{{on}}" stroke-width="3" opacity="0"/><g id="press" transform="${about(80, 80, 1)}"><circle id="disc" cx="80" cy="80" r="48" fill="{{button}}" stroke="{{off}}" stroke-width="2.5"/><g id="symGlow" opacity="0" filter="url(#pbGlow)">${symbol("glow", "{{on}}")}</g>${symbol("sym", "{{off}}")}</g></svg>`,
      animate: [
        // Step 1, on: a press, the symbol and rim light up, the glow ring comes on and a pulse rings out.
        ...press(1, 0.93),
        ...colours(1, "{{off}}", "{{on}}", 60),
        { id: "disc", step: 1, attrs: { stroke: ["{{off}}", "{{on}}"] }, delay: 60, ms: 220 },
        { id: "symGlow", step: 1, attrs: { opacity: [0, 1] }, delay: 60, ms: 260 },
        { id: "halo", step: 1, attrs: { opacity: [0, 0.75] }, delay: 80, ms: 360, ease: "out" },
        snap("pulse", "opacity", 0, 0, 1),
        { id: "pulse", step: 1, attrs: { r: [50, 76], opacity: [0.9, 0] }, delay: 80, ms: 560, ease: "out" },
        snap("pulse", "r", 50, 700, 1),
        // Step 2, off: a press and everything dims back to the start.
        ...press(2, 0.95),
        ...colours(2, "{{on}}", "{{off}}", 40),
        { id: "disc", step: 2, attrs: { stroke: ["{{on}}", "{{off}}"] }, delay: 40, ms: 220 },
        { id: "symGlow", step: 2, attrs: { opacity: [1, 0] }, delay: 40, ms: 220 },
        { id: "halo", step: 2, attrs: { opacity: [0.75, 0] }, delay: 40, ms: 300, ease: "out" },
      ],
    };
  })(),
};

/** Battery cells: five across the inside of the case. */
const CELLS = Array.from({ length: 5 }, (_, i) => ({ id: `cell${i}`, x: r1(36 + i * 24.8) }));
/** The bolt over the battery's middle, scaled by `k` (1 at rest). */
const boltPose = (k: number) => `translate(96 58) scale(${Math.round(0.36 * k * 1000) / 1000}) translate(-60 -60)`;

export const batteryCharge: VectorEffect = {
  kind: "vector",
  id: "battery-charge",
  name: "Battery charge",
  description: "A battery filling cell by cell as its percentage counts up and the bolt pulses, flashing when it is full.",
  category: "loader",
  tags: ["electric", "battery", "charging", "loader", "progress", "ui", "icon"],
  hold: 900,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], shell: [0.2, 0.25, 0.33], ink: [0.06, 0.09, 0.16] } },
    { name: "Low power", values: { charge: [0.96, 0.62, 0.04] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 200 140"><!-- {{background: color default=#0F172A label='Background'}} {{shell: color default=#CBD5E1 label='Case'}} {{charge: color default=#22C55E label='Charge'}} {{bolt: color default=#FDE047 label='Bolt'}} {{ink: color default=#F8FAFC label='Percent'}} --><rect width="200" height="140" fill="{{background}}"/><rect id="case" x="28" y="26" width="136" height="64" rx="12" fill="none" stroke="{{shell}}" stroke-width="5"/><rect id="nub" x="167" y="46" width="9" height="24" rx="3" fill="{{shell}}"/>${CELLS.map(
      ({ id, x }) => `<rect id="${id}" x="${x}" y="34" width="20.8" height="48" rx="4" fill="{{charge}}" opacity="0"/>`,
    ).join("")}<path id="bolt" d="${BOLT}" transform="${boltPose(1)}" fill="{{bolt}}" stroke="{{background}}" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/><rect id="flash" x="28" y="26" width="136" height="64" rx="12" fill="#FFFFFF" opacity="0"/><text id="pct" x="96" y="124" text-anchor="middle" font-family="${SANS}" font-size="22" font-weight="700" fill="{{ink}}">0%</text></svg>`,
    animate: [
      { id: "pct", count: [0, 100], format: "{n}%", ms: 2000, ease: "linear" },
      // Each cell lights as the count passes its share.
      ...CELLS.map(({ id }, i): SvgAnimation => ({ id, attrs: { opacity: [0, 1] }, delay: (i + 1) * 400 - 80, ms: 120 })),
      // The bolt pulses as it charges.
      ...[0, 500, 1000, 1500].flatMap((t): SvgAnimation[] => [
        { id: "bolt", attrs: { transform: [boltPose(1), boltPose(1.2)] }, delay: t, ms: 150, ease: "out" },
        { id: "bolt", attrs: { transform: [boltPose(1.2), boltPose(1)] }, delay: t + 150, ms: 250, ease: "in-out" },
      ]),
      // Full: a flash and the case takes the charge colour.
      { id: "flash", attrs: { opacity: [0, 0.7] }, delay: 2050, ms: 70 },
      { id: "flash", attrs: { opacity: [0.7, 0] }, delay: 2120, ms: 420, ease: "out" },
      { id: "case", attrs: { stroke: ["{{shell}}", "{{charge}}"] }, delay: 2050, ms: 150 },
      { id: "nub", attrs: { fill: ["{{shell}}", "{{charge}}"] }, delay: 2050, ms: 150 },
      { id: "pct", attrs: { fill: ["{{ink}}", "{{charge}}"] }, delay: 2050, ms: 150 },
      { id: "bolt", attrs: { transform: [boltPose(1), boltPose(1.3)] }, delay: 2050, ms: 120, ease: "out" },
      { id: "bolt", attrs: { transform: [boltPose(1.3), boltPose(1)] }, delay: 2170, ms: 300, ease: "in-out" },
    ],
  },
};

/** Electricity as vector effects: zaps, power and charge. */
export const electricEffects: VectorEffect[] = [zapIcon, powerButton, batteryCharge];
