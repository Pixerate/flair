import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Holographic interface pieces as animated SVG: light-coloured lines and
 * monospaced readouts in a glow, projected in, flickering, and switched off
 * again, so they loop. The shader holograms are in shaders/hologram.ts.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field. */
const n = (name: string) => `{{${name}}}` as unknown as number;

const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`;
const SCRAMBLE = "01<>/\\|#*+=-:";

/** A glow filter: the shape blurred twice under itself. */
const glowFilter = (id: string, blur: number) =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

/** A transform scaling by `sx`, `sy` about (`cx`, `cy`). */
const about = (cx: number, cy: number, sx: number, sy = sx) => `translate(${cx} ${cy}) scale(${r2(sx)} ${r2(sy)}) translate(${-cx} ${-cy})`;

/** A quick dip in opacity, a flicker, at `at` ms. */
const flicker = (id: string, at: number, low = 0.3): SvgAnimation[] => [
  { id, attrs: { opacity: [1, low] }, delay: at, ms: 50 },
  { id, attrs: { opacity: [low, 1] }, delay: at + 50, ms: 40 },
  { id, attrs: { opacity: [1, low * 1.6] }, delay: at + 130, ms: 40 },
  { id, attrs: { opacity: [low * 1.6, 1] }, delay: at + 170, ms: 60 },
];

/** Four corner brackets round a box, as one path. */
const brackets = (x: number, y: number, w: number, h: number, len: number) =>
  [
    `M${x} ${y + len} V${y} H${x + len}`,
    `M${x + w - len} ${y} H${x + w} V${y + len}`,
    `M${x + w} ${y + h - len} V${y + h} H${x + w - len}`,
    `M${x + len} ${y + h} H${x} V${y + h - len}`,
  ].join(" ");

// ── Holo HUD ───────────────────────────────────────────────────────────

const HUD_MS = 4800;
const HUD = { cx: 100, cy: 100 };
/** Ticks round the rim every 6°, every fifth longer. */
const HUD_TICKS = Array.from({ length: 60 }, (_, k) => {
  const a = (k * 6 * Math.PI) / 180;
  const [r0, r] = [k % 5 ? 85 : 80, 90];
  return `M${r1(HUD.cx + r0 * Math.cos(a))} ${r1(HUD.cy + r0 * Math.sin(a))}L${r1(HUD.cx + r * Math.cos(a))} ${r1(HUD.cy + r * Math.sin(a))}`;
}).join("");
/** Four dashes round a 72 ring, so a quarter turn looks the same. */
const HUD_DASH = (() => {
  const c = 2 * Math.PI * 72;
  return `${r1(c / 4 - 30)} 30`;
})();
/** The radar's sweep: a 40° wedge trailing behind its leading edge at 0° (pointing right). */
const HUD_WEDGE = (() => {
  const r = 66;
  const a = (-40 * Math.PI) / 180;
  return `M${HUD.cx} ${HUD.cy} L${HUD.cx + r} ${HUD.cy} A${r} ${r} 0 0 0 ${r1(HUD.cx + r * Math.cos(a))} ${r1(HUD.cy + r * Math.sin(a))}Z`;
})();
/** Blips on the radar: angle (°, clockwise from right) and radius; each flares as the sweep passes. */
const HUD_BLIPS = [
  [35, 44],
  [150, 58],
  [255, 34],
] as const;
const spin = (deg: number) => `rotate(${deg} ${HUD.cx} ${HUD.cy})`;

export const holoHud: VectorEffect = {
  kind: "vector",
  id: "holo-hud",
  name: "Holo HUD",
  description: "A holographic heads-up display: tick rings turning both ways, a radar sweep lighting blips as it passes, and a readout counting up round a progress ring, all in a glow.",
  category: "hologram",
  tags: ["hologram", "hud", "sci-fi", "radar", "interface", "gauge", "futuristic", "loop"],
  presets: [
    { name: "Amber", values: { accent: [1, 0.72, 0.25], dim: [0.55, 0.36, 0.1] } },
    { name: "Clear", values: { backdrop: 0 } },
    { name: "Red alert", values: { accent: [1, 0.33, 0.3], dim: [0.55, 0.12, 0.12], label: "ALERT", value: 100 } },
  ],
  derived: (v) => ({ frac: r2(Math.min(100, Math.max(0, Number(v.value) || 0)) / 100) }),
  motion: {
    svg: `<svg viewBox="0 0 200 200" font-family="${MONO}"><!-- {{value: int min=0 max=100 default=87 label='Value'}} {{label: text default='SYNC' label='Label'}} {{accent: color default=#4FE3FF label='Hologram'}} {{dim: color default=#1B6A80 label='Dim lines'}} {{background: color default=#03070D label='Background'}} {{backdrop: float min=0 max=1 default=1 step=0.05 label='Background opacity'}} --><defs>${glowFilter("holoHudGlow", 2.2)}<radialGradient id="holoHudFade" cx="${HUD.cx}" cy="${HUD.cy}" r="66" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{{accent}}" stop-opacity="0"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0.35"/></radialGradient></defs><rect width="200" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g id="holoHudAll" filter="url(#holoHudGlow)" fill="none"><g id="holoHudTicks" transform="${spin(0)}"><path d="${HUD_TICKS}" stroke="{{accent}}" stroke-width="1.2"/></g><g id="holoHudDash" transform="${spin(0)}"><circle cx="${HUD.cx}" cy="${HUD.cy}" r="72" stroke="{{accent}}" stroke-width="2.5" stroke-dasharray="${HUD_DASH}"/></g><circle cx="${HUD.cx}" cy="${HUD.cy}" r="66" stroke="{{dim}}" stroke-width="0.8"/><circle cx="${HUD.cx}" cy="${HUD.cy}" r="33" stroke="{{dim}}" stroke-width="0.8" stroke-dasharray="2 3"/><path d="M${HUD.cx - 66} ${HUD.cy}H${HUD.cx + 66}M${HUD.cx} ${HUD.cy - 66}V${HUD.cy + 66}" stroke="{{dim}}" stroke-width="0.6"/><g id="holoHudSweep" transform="${spin(0)}"><path d="${HUD_WEDGE}" fill="url(#holoHudFade)"/><path d="M${HUD.cx} ${HUD.cy}H${HUD.cx + 66}" stroke="{{accent}}" stroke-width="1.4"/></g>${HUD_BLIPS.map(([a, r], k) => {
      const t = (a * Math.PI) / 180;
      return `<circle id="holoHudBlip${k}" cx="${r1(HUD.cx + r * Math.cos(t))}" cy="${r1(HUD.cy + r * Math.sin(t))}" r="0" fill="{{accent}}" opacity="0"/>`;
    }).join("")}<circle cx="${HUD.cx}" cy="${HUD.cy}" r="52" stroke="{{dim}}" stroke-width="5" opacity="0.6"/><circle id="holoHudArc" cx="${HUD.cx}" cy="${HUD.cy}" r="52" stroke="{{accent}}" stroke-width="5" transform="rotate(-90 ${HUD.cx} ${HUD.cy})"/><path id="holoHudBrackets" d="${brackets(8, 8, 184, 184, 18)}" stroke="{{accent}}" stroke-width="2"/></g><g id="holoHudReadout" fill="{{accent}}" text-anchor="middle" opacity="0"><text id="holoHudValue" x="${HUD.cx}" y="${HUD.cy + 6}" font-size="20" font-weight="700">0%</text><text id="holoHudLabel" x="${HUD.cx}" y="${HUD.cy + 21}" font-size="7.5" letter-spacing="2.5" fill="{{accent}}" opacity="0.75">{{label}}</text></g></svg>`,
    animate: [
      // Turning the whole loop, by angles their patterns repeat at, so it never jumps.
      { id: "holoHudTicks", attrs: { transform: [spin(0), spin(-36)] }, ms: HUD_MS, ease: "linear" },
      { id: "holoHudDash", attrs: { transform: [spin(0), spin(90)] }, ms: HUD_MS, ease: "linear" },
      { id: "holoHudSweep", attrs: { transform: [spin(0), spin(360)] }, ms: HUD_MS, ease: "linear" },
      ...HUD_BLIPS.flatMap(([a], k): SvgAnimation[] => {
        const at = Math.round((a / 360) * HUD_MS);
        return [
          { id: `holoHudBlip${k}`, attrs: { r: [1, 4], opacity: [1, 1] }, delay: at, ms: 120, ease: "out" },
          { id: `holoHudBlip${k}`, attrs: { r: [4, 2.5], opacity: [1, 0] }, delay: at + 120, ms: 1100, ease: "out" },
        ];
      }),
      { id: "holoHudBrackets", draw: true, ms: 450, ease: "out" },
      { id: "holoHudReadout", attrs: { opacity: [0, 1] }, delay: 150, ms: 250 },
      { id: "holoHudArc", draw: [0, n("frac")] as unknown as [number, number], delay: 200, ms: 1400, ease: "out" },
      { id: "holoHudValue", count: [0, n("value")], format: "{n}%", delay: 200, ms: 1400, ease: "out" },
      ...flicker("holoHudAll", 2300, 0.45),
      // Off again before the loop comes round.
      { id: "holoHudReadout", attrs: { opacity: [1, 0] }, delay: HUD_MS - 450, ms: 300 },
      { id: "holoHudArc", draw: [n("frac"), 0] as unknown as [number, number], delay: HUD_MS - 450, ms: 400, ease: "in-out" },
    ],
  },
};

// ── Holo panel ─────────────────────────────────────────────────────────

const PANEL = { x: 20, y: 24, w: 280, h: 152, cx: 160, cy: 100 };
const PANEL_ROWS = [88, 114, 140];
const PANEL_OUT = 4300;

export const holoPanel: VectorEffect = {
  kind: "vector",
  id: "holo-panel",
  name: "Holo panel",
  description: "A holographic info panel that unfolds from a line of light, writes its title and readings in with decoding letters, flickers as a scan passes over, then folds away.",
  category: "hologram",
  tags: ["hologram", "sci-fi", "interface", "panel", "readout", "text", "futuristic", "loop"],
  hold: 300,
  presets: [
    { name: "Amber", values: { color: [1, 0.72, 0.25] } },
    { name: "Clear", values: { backdrop: 0 } },
    { name: "Mission", values: { title: "MISSION STATUS", label1: "OBJECTIVE", value1: "SECURE DATA", label2: "TEAM", value2: "4 / 4", label3: "EXTRACTION", value3: "T-02:30" } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 320 200" font-family="${MONO}"><!-- {{title: text default='TARGET ACQUIRED' label='Title'}} {{label1: text default='RANGE' label='Row 1'}} {{value1: text default='2.4 KM' label='Row 1 value'}} {{label2: text default='VELOCITY' label='Row 2'}} {{value2: text default='31 M/S' label='Row 2 value'}} {{label3: text default='STATUS' label='Row 3'}} {{value3: text default='LOCKED' label='Row 3 value'}} {{color: color default=#4FE3FF label='Hologram'}} {{background: color default=#03070D label='Background'}} {{backdrop: float min=0 max=1 default=1 step=0.05 label='Background opacity'}} --><defs>${glowFilter("holoPanelGlow", 1.8)}<pattern id="holoPanelLines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.3" fill="{{color}}" fill-opacity="0.13"/></pattern><linearGradient id="holoPanelScanFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{color}}" stop-opacity="0"/><stop offset="1" stop-color="{{color}}" stop-opacity="0.5"/></linearGradient></defs><rect width="320" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g id="holoPanelAll" filter="url(#holoPanelGlow)"><g id="holoPanelBox" transform="${about(PANEL.cx, PANEL.cy, 0, 0.02)}"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" fill="{{color}}" fill-opacity="0.07"/><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" fill="url(#holoPanelLines)" stroke="{{color}}" stroke-opacity="0.55" stroke-width="1"/><rect id="holoPanelScan" x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="14" fill="url(#holoPanelScanFill)" opacity="0"/></g><path id="holoPanelBrackets" d="${brackets(PANEL.x - 6, PANEL.y - 6, PANEL.w + 12, PANEL.h + 12, 16)}" fill="none" stroke="{{color}}" stroke-width="2.2"/><g id="holoPanelText" fill="{{color}}"><text id="holoPanelTitle" x="36" y="54" font-size="15" font-weight="700" letter-spacing="2">{{title}}</text><path id="holoPanelRule" d="M36 64H284" stroke="{{color}}" stroke-width="1" opacity="0.7"/>${PANEL_ROWS.map(
      (y, k) =>
        `<text id="holoPanelLabel${k}" x="36" y="${y}" font-size="11" letter-spacing="1.5" opacity="0.7">{{label${k + 1}}}</text><text id="holoPanelValue${k}" x="284" y="${y}" font-size="12" font-weight="700" text-anchor="end" letter-spacing="1">{{value${k + 1}}}</text>`,
    ).join("")}</g></g></svg>`,
    animate: [
      // Unfolding: a point to a line of light, then the line to the panel.
      { id: "holoPanelBox", attrs: { transform: [about(PANEL.cx, PANEL.cy, 0, 0.02), about(PANEL.cx, PANEL.cy, 1, 0.02)] }, ms: 280, ease: "out" },
      { id: "holoPanelBox", attrs: { transform: [about(PANEL.cx, PANEL.cy, 1, 0.02), about(PANEL.cx, PANEL.cy, 1, 1)] }, delay: 280, ms: 300, ease: { spring: { stiffness: 220, damping: 18 } } },
      { id: "holoPanelBrackets", draw: true, delay: 520, ms: 380, ease: "out" },
      { id: "holoPanelText", attrs: { opacity: [0, 1] }, delay: 600, ms: 60 },
      { id: "holoPanelTitle", write: "{{title}}", scramble: SCRAMBLE, delay: 640, ms: 650, ease: "linear" },
      { id: "holoPanelRule", draw: true, delay: 760, ms: 450, ease: "out" },
      ...PANEL_ROWS.flatMap((_, k): SvgAnimation[] => [
        { id: `holoPanelLabel${k}`, write: `{{label${k + 1}}}`, scramble: SCRAMBLE, delay: 950 + k * 220, ms: 420, ease: "linear" },
        { id: `holoPanelValue${k}`, write: `{{value${k + 1}}}`, scramble: SCRAMBLE, delay: 1100 + k * 220, ms: 520, ease: "linear" },
      ]),
      // A scan down the panel, and a flicker as it passes.
      { id: "holoPanelScan", attrs: { opacity: [0, 0.9] }, delay: 1900, ms: 120 },
      { id: "holoPanelScan", attrs: { y: [PANEL.y, PANEL.y + PANEL.h - 14] }, delay: 1900, ms: 1100, ease: "in-out" },
      { id: "holoPanelScan", attrs: { opacity: [0.9, 0] }, delay: 2880, ms: 120 },
      ...flicker("holoPanelAll", 2450),
      ...flicker("holoPanelAll", 3600, 0.5),
      // Folding away: the words go, the panel back to a line, the line to nothing.
      { id: "holoPanelText", attrs: { opacity: [1, 0] }, delay: PANEL_OUT, ms: 160 },
      { id: "holoPanelBrackets", draw: [1, 0], delay: PANEL_OUT, ms: 300, ease: "in-out" },
      { id: "holoPanelBox", attrs: { transform: [about(PANEL.cx, PANEL.cy, 1, 1), about(PANEL.cx, PANEL.cy, 1, 0.02)] }, delay: PANEL_OUT + 160, ms: 240, ease: "in-out" },
      { id: "holoPanelBox", attrs: { transform: [about(PANEL.cx, PANEL.cy, 1, 0.02), about(PANEL.cx, PANEL.cy, 0, 0.02)] }, delay: PANEL_OUT + 400, ms: 220, ease: "in-out" },
    ],
  },
};

export const hologramEffects: VectorEffect[] = [holoHud, holoPanel];
