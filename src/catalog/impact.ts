import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Impact vector effects play on a click (`trigger: "click"`) with a single
 * step that returns by itself, so every click replays the hit. Elements the
 * step only flashes snap back to their starting values once hidden.
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A transform scaling by `s` about (`cx`, `cy`). */
const about = (cx: number, cy: number, s: number) => `translate(${cx} ${cy}) scale(${r2(s)}) translate(${-cx} ${-cy})`;

/** Instant changes: the attribute snaps to `value` at `delay` (resets of hidden elements). */
const snap = (id: string, attr: string, value: string | number, delay: number): SvgAnimation => ({
  id,
  step: 1,
  attrs: { [attr]: [value, value] },
  delay,
  ms: 0,
});

const SANS = `system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

/** The marker's centre and its four diagonal ticks, from `inner` to `outer` out. */
const CX = 120;
const CY = 84;
const ticks = (inner: number, outer: number) =>
  [45, 135, 225, 315]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      return `M${r2(CX + inner * c)} ${r2(CY + inner * s)} L${r2(CX + outer * c)} ${r2(CY + outer * s)}`;
    })
    .join(" ");

/** When the marker fades and the number is gone. */
const MARK_OUT = 420;
const NUMBER_OUT = 700;

export const hitMarker: VectorEffect = {
  kind: "vector",
  id: "hit-marker",
  name: "Hit marker",
  description: "An FPS hit marker whose four diagonal ticks pop in at the crosshair and fade, with a damage number floating up beside it on every click.",
  category: "impact",
  tags: ["impact", "interactive", "ui", "click", "game", "fps", "hit", "damage", "crosshair"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Kill", values: { marker: [1, 0.2, 0.2], number: [1, 0.2, 0.2], damage: 150 } },
    { name: "Headshot", values: { marker: [1, 0.82, 0.2], number: [1, 0.82, 0.2], damage: 200, weight: 6 } },
    { name: "No number", values: { showNumber: false } },
  ],
  derived: (v) => ({ numberOn: v.showNumber ? 1 : 0 }),
  motion: {
    svg: `<svg viewBox="0 0 240 160"><!-- {{damage: int min=0 max=99999 default=42 label='Damage'}} {{showNumber: bool default=true label='Damage number'}} {{background: color default=#1B2430 label='Background'}} {{crosshair: color default=#9FB3C8 label='Crosshair'}} {{marker: color default=#FFFFFF label='Marker'}} {{number: color default=#FFFFFF label='Number colour'}} {{weight: float min=2 max=9 default=4.5 step=0.5 label='Tick weight'}} --><defs><filter id="hitMarkerShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.6"/></filter></defs><rect width="240" height="160" fill="{{background}}"/><g stroke="{{crosshair}}" stroke-width="2" stroke-linecap="round" opacity="0.7"><path d="M${CX} ${CY - 6} V${CY - 2} M${CX} ${CY + 2} V${CY + 6} M${CX - 6} ${CY} H${CX - 2} M${CX + 2} ${CY} H${CX + 6}"/></g><g id="hitMarkerTicks" transform="${about(CX, CY, 1.7)}" opacity="0" filter="url(#hitMarkerShadow)"><path d="${ticks(9, 24)}" fill="none" stroke="{{marker}}" stroke-width="{{weight}}" stroke-linecap="square"/></g><g id="hitMarkerRise" transform="translate(0 6)"><text id="hitMarkerNumber" x="${CX + 22}" y="${CY - 26}" font-family="${SANS}" font-size="22" font-weight="800" fill="{{number}}" stroke="#000000" stroke-opacity="0.55" stroke-width="3" paint-order="stroke" opacity="0">{{damage}}</text></g></svg>`,
    animate: [
      // The ticks snap in from large, overshoot small and settle, then fade.
      { id: "hitMarkerTicks", step: 1, attrs: { opacity: [0, 1] }, ms: 30 },
      { id: "hitMarkerTicks", step: 1, attrs: { transform: [about(CX, CY, 1.7), about(CX, CY, 0.88)] }, ms: 90, ease: "out" },
      { id: "hitMarkerTicks", step: 1, attrs: { transform: [about(CX, CY, 0.88), about(CX, CY, 1)] }, delay: 90, ms: 90, ease: "in-out" },
      { id: "hitMarkerTicks", step: 1, attrs: { opacity: [1, 0], transform: [about(CX, CY, 1), about(CX, CY, 1.15)] }, delay: MARK_OUT - 180, ms: 180, ease: "in-out" },
      snap("hitMarkerTicks", "transform", about(CX, CY, 1.7), MARK_OUT + 20),
      // The damage number pops up beside it, floats up and fades.
      { id: "hitMarkerNumber", step: 1, attrs: { opacity: [0, "{{numberOn}}"] }, delay: 40, ms: 80 },
      { id: "hitMarkerRise", step: 1, attrs: { transform: ["translate(0 6)", "translate(8 -36)"] }, delay: 40, ms: NUMBER_OUT - 40, ease: "out" },
      { id: "hitMarkerNumber", step: 1, attrs: { opacity: ["{{numberOn}}", 0] }, delay: NUMBER_OUT - 260, ms: 260, ease: "in-out" },
      snap("hitMarkerRise", "transform", "translate(0 6)", NUMBER_OUT + 20),
    ],
  },
};

/** Impacts as vector effects: hit markers. */
export const impactEffects: VectorEffect[] = [hitMarker];
