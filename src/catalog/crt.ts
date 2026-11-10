import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, holdControl, holds, ms, n, outTimes, r1 } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * CRT drawn as vectors: a phosphor terminal typing out its lines, glowing
 * through scanlines with a faint bar rolling down the glass. A 4:3 picture,
 * the shape of the tubes it remembers.
 */

/** The most lines the terminal types; lines past it are left out. */
export const TERMINAL_LINES = 6;
const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
/** A monospace letter's width, in ems. */
const MONO_EM = 0.6;
const LEFT = 48;
const TEXT_W = 544;
/** Pause between one line finishing and the next starting (ms). */
const LINE_GAP = 250;
/** The caret's blinks after typing: on and off every 500 ms. */
const BLINKS = 6;

/** Terminal lines, separated by semicolons or new lines: blank ones skipped, at most {@link TERMINAL_LINES}. */
export function parseTerminalLines(text: unknown): string[] {
  return String(text ?? "")
    .split(/[;\n]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, TERMINAL_LINES);
}

const crtTerminalMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 640 480"><!-- {{lines: text default='> BOOT SEQUENCE INITIATED; > CHECKING MEMORY ... 640K OK; > LOADING SYSTEM FILES; > ESTABLISHING LINK; > READY.' label='Lines (separated by ;)'}} {{ink: color default=#3DFF7E label='Phosphor'}} {{background: color default=#03140A label='Background'}} {{pace: float min=15 max=200 default=45 step=5 label='Ms per letter'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} ${holdControl(2.5)} {{font: text default="${MONO}" label='Font'}} --><defs><filter id="crtTerminalGlow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="{{glow}}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="crtTerminalLines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.6" fill="#000000" fill-opacity="0.35"/></pattern><radialGradient id="crtTerminalVignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.75"/></radialGradient><linearGradient id="crtTerminalBarFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{ink}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{ink}}" stop-opacity="0.07"/><stop offset="1" stop-color="{{ink}}" stop-opacity="0"/></linearGradient></defs><rect width="640" height="480" rx="28" fill="{{background}}"/><g id="crtTerminalText" filter="url(#crtTerminalGlow)" font-family="{{font}}" font-size="{{size}}" fill="{{ink}}">${Array.from(
    { length: TERMINAL_LINES },
    (_, k) => `<text id="crtTerminalLine${k}" x="${LEFT}" y="{{y${k}}}" xml:space="preserve">{{line${k}}}</text>`,
  ).join("")}<text id="crtTerminalCaret" x="{{caretX}}" y="{{caretY}}" opacity="0">█</text></g><rect id="crtTerminalBar" x="0" y="-120" width="640" height="120" fill="url(#crtTerminalBarFill)"/><rect width="640" height="480" fill="url(#crtTerminalLines)"/><rect width="640" height="480" rx="28" fill="url(#crtTerminalVignette)"/></svg>`,
  animate: [
    ...Array.from({ length: TERMINAL_LINES }, (_, k): SvgAnimation => ({ id: `crtTerminalLine${k}`, write: `{{line${k}}}`, caret: "█", delay: n(`start${k}`), ms: n(`type${k}`), ease: "linear" })),
    // The caret blinking where the typing stopped.
    ...holds("crtTerminalCaret", "opacity", [[0, 0], ...Array.from({ length: BLINKS }, (_, k) => [n(`blink${k}`), k % 2 ? 0 : 1] as const)]),
    // A faint bright bar rolling down the glass the whole time.
    { id: "crtTerminalBar", attrs: { y: [-120, 480] }, ms: n("total"), ease: "linear" },
    // Cleared at the end, ready to type again.
    { id: "crtTerminalText", attrs: { opacity: [1, 0] }, delay: after(0), ms: 250 },
  ],
};

export const crtTerminal: VectorEffect = {
  kind: "vector",
  id: "crt-terminal",
  name: "CRT terminal",
  description:
    "An old phosphor terminal typing out its lines one after another behind a block cursor, glowing green through scanlines with a vignette and a faint bar rolling down the glass, then clearing to type again.",
  category: "crt",
  tags: ["crt", "terminal", "retro", "typing", "phosphor", "computer", "hacker", "text"],
  hold: 300,
  presets: [
    { name: "Amber", values: { ink: [1, 0.69, 0.18], background: [0.09, 0.05, 0.01] } },
    { name: "Mainframe", values: { ink: [0.82, 0.9, 1], background: [0.02, 0.04, 0.09], lines: "LOGIN: GUEST; PASSWORD: ********; WELCOME TO THE MAINFRAME" } },
    { name: "Fast", values: { pace: 20 } },
  ],
  derived: (v) => {
    const lines = parseTerminalLines(v.lines);
    const longest = Math.max(12, ...lines.map((l) => Array.from(l).length + 1));
    const size = r1(Math.min(26, TEXT_W / (longest * MONO_EM)));
    const lead = r1(size * 1.6);
    const top = 70 + size;
    const pace = Number(v.pace) || 45;
    const out: Record<string, string | number> = { size };
    let at = 300;
    for (let k = 0; k < TERMINAL_LINES; k++) {
      const line = lines[k] ?? "";
      const typing = Math.round(Array.from(line).length * pace);
      Object.assign(out, { [`line${k}`]: line, [`y${k}`]: r1(top + k * lead), [`start${k}`]: at, [`type${k}`]: typing });
      if (line) at += typing + LINE_GAP;
    }
    const last = Math.max(0, lines.length - 1);
    out.caretX = r1(LEFT + Array.from(lines[last] ?? "").length * MONO_EM * size);
    out.caretY = out[`y${last}`]!;
    for (let k = 0; k < BLINKS; k++) out[`blink${k}`] = at - LINE_GAP + k * 500;
    const end = at - LINE_GAP + ms(v.hold);
    Object.assign(out, outTimes(crtTerminalMotion, end));
    out.total = end + 250;
    return out;
  },
  motion: crtTerminalMotion,
};

/** CRT vector effects. */
export const crtEffects: VectorEffect[] = [crtTerminal];
