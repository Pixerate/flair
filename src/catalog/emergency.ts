import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, fit, holdControl, holds, ms, n, outTimes, r1, SANS } from "./broadcast.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Emergency graphics drawn as vectors, in the broadcast graphics' 1920 × 1080
 * frame on a transparent background, so they sit over a picture: caution
 * tape snapping across the frame, and a phone's emergency alert dropping in
 * and buzzing. Text is fitted from its length, so any words fit.
 */

// ── Caution tape ───────────────────────────────────────────────────────

/** A tape's length in its own units, centred on the frame's middle so it overhangs every edge at any angle. */
const TAPE_LENGTH = 2600;
/** Copies of the tape's text along it, enough to fill it at the shortest repeat. */
const TAPE_COPIES = 10;
const TAPE_MIN_REPEAT = 320;
/** When each tape starts unrolling (ms), and when both have settled. */
const TAPE_AT = [0, 250] as const;
const TAPE_REVEAL = 350;
const TAPE_IN = TAPE_AT[1] + TAPE_REVEAL + 500;

const tapePose = (x: number, y: number, deg: number) => `translate(${x} ${y}) rotate(${r1(deg)}) translate(${-TAPE_LENGTH / 2} 0)`;

const tape = (i: number) =>
  `<g id="cautionTape${i}" display="{{show${i}}}" transform="{{pose${i}}}"><clipPath id="cautionTapeClip${i}"><rect id="cautionTapeReveal${i}" x="${i ? TAPE_LENGTH : 0}" y="-80" width="0" height="160"/></clipPath><g clip-path="url(#cautionTapeClip${i})"><g id="cautionTapeWave${i}" transform="translate(0 0)"><rect x="0" y="-50" width="${TAPE_LENGTH}" height="100" fill="{{tape}}"/><rect x="0" y="-42" width="${TAPE_LENGTH}" height="5" fill="{{ink}}"/><rect x="0" y="37" width="${TAPE_LENGTH}" height="5" fill="{{ink}}"/>${Array.from(
    { length: TAPE_COPIES },
    (_, k) =>
      `<text x="{{x${k}}}" y="{{textBase}}" font-family="{{font}}" font-size="{{textSize}}" font-weight="900" letter-spacing="3" textLength="{{textW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{text}}</text><path d="M{{s${k}}} -22 h16 l-14 44 h-16 Z M{{t${k}}} -22 h16 l-14 44 h-16 Z" fill="{{ink}}"/>`,
  ).join("")}</g></g></g>`;

const cautionTapeMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{text: text default='CAUTION  DO NOT CROSS' label='Tape text'}} {{tape: color default=#FFD400 label='Tape'}} {{ink: color default=#111111 label='Text and stripes'}} {{angle: float min=0 max=35 default=14 step=1 label='Angle (degrees)'}} {{cross: bool default=true label='Two tapes, crossed'}} ${holdControl(3)} {{font: text default="${SANS}" label='Font'}} -->${tape(0)}${tape(1)}</svg>`,
  animate: [
    ...[0, 1].flatMap((i): SvgAnimation[] => [
      // Unrolled across from opposite sides, snapping taut with a bounce.
      { id: `cautionTapeReveal${i}`, attrs: i ? { x: [TAPE_LENGTH, 0], width: [0, TAPE_LENGTH] } : { width: [0, TAPE_LENGTH] }, delay: TAPE_AT[i], ms: TAPE_REVEAL, ease: "out" },
      { id: `cautionTapeWave${i}`, attrs: { transform: ["translate(0 -18)", "translate(0 0)"] }, delay: TAPE_AT[i] + TAPE_REVEAL, ms: 500, behavior: { type: "overshoot", cycles: 3, damping: 5 } },
      // Fluttering in the wind while it holds.
      { id: `cautionTapeWave${i}`, attrs: { transform: ["translate(0 0) rotate(0 1300 0)", "translate(0 7) rotate(0.8 1300 0)"] }, delay: TAPE_IN, ms: n("holdMs"), behavior: { type: "wriggle", frequency: 1.4, seed: 7 + i * 13 } },
      // Torn down: it drops away, tipping, and fades.
      { id: `cautionTape${i}`, attrs: { transform: [`{{pose${i}}}`, `{{gone${i}}}`], opacity: [1, 0] }, delay: after(i * 150), ms: 600, ease: [0.55, 0, 1, 0.45] },
    ]),
  ],
};

export const cautionTape: VectorEffect = {
  kind: "vector",
  id: "caution-tape",
  name: "Caution tape",
  description:
    "Yellow and black caution tape snapping across the frame from either side, crossed in an X or as one band, its warning repeated along it, fluttering while it holds, then torn down and dropping away.",
  category: "emergency",
  tags: ["emergency", "caution", "warning", "tape", "hazard", "barrier", "crime-scene", "text", "overlay"],
  hold: 400,
  presets: [
    { name: "Crime scene", values: { text: "POLICE LINE  DO NOT CROSS" } },
    { name: "Danger", values: { text: "DANGER  KEEP OUT", tape: [0.86, 0.1, 0.1], ink: [1, 1, 1] } },
    { name: "One band", values: { cross: false, angle: 6 } },
  ],
  derived: (v) => {
    const text = fit(v.text, 2000, 48);
    const repeat = Math.max(TAPE_MIN_REPEAT, text.width + 140);
    const angle = Number(v.angle);
    const out: Record<string, string | number> = {
      ...outTimes(cautionTapeMotion, TAPE_IN + ms(v.hold)),
      holdMs: ms(v.hold),
      textSize: text.size,
      textW: text.width,
      textBase: r1(text.size * 0.36),
      show0: "inline",
      show1: v.cross ? "inline" : "none",
      pose0: tapePose(960, 540, -angle),
      pose1: tapePose(960, v.cross ? 540 : 700, angle),
      gone0: tapePose(900, 1500, -angle - 18),
      gone1: tapePose(1020, 1560, angle + 22),
    };
    for (let k = 0; k < TAPE_COPIES; k++) {
      const x = 40 + k * repeat;
      out[`x${k}`] = r1(x);
      out[`s${k}`] = r1(x + text.width + 46);
      out[`t${k}`] = r1(x + text.width + 72);
    }
    return out;
  },
  motion: cautionTapeMotion,
};

// ── Emergency alert ────────────────────────────────────────────────────

/** The alert card's left edge, width and inner text width, in the 1920 frame. */
const CARD_X = 400;
const CARD_W = 1120;
const TEXT_W = 980;
const BODY_LINES = 3;
const BODY_SIZE = 34;
const BODY_LEAD = 46;
/** When the card has dropped in, and its two buzzes (ms). */
const ALERT_DROP = 650;
const BUZZES = [700, 1250] as const;
const ALERT_IN = 1700;

/** Words wrapped into at most `lines` lines `width` wide at `size`; the last takes whatever is left. */
function wrap(text: unknown, width: number, size: number, lines: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && out.length < lines - 1 && textWidthEm(next) * size > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

const emergencyAlertMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{label: text default='Emergency alert' label='Label'}} {{level: text default='Extreme' label='Level'}} {{title: text default='Flash flood warning' label='Title'}} {{body: text default='Move to higher ground now. Avoid walking or driving through flood water. Check local news for updates.' label='Message'}} {{card: color default=#1C1C1E label='Card'}} {{cardOpacity: float min=0.5 max=1 default=0.94 step=0.01 label='Card opacity'}} {{ink: color default=#FFFFFF label='Title colour'}} {{muted: color default=#C7C7CC label='Message colour'}} {{alert: color default=#FF3B30 label='Alert colour'}} ${holdControl(4)} {{font: text default="${SANS}" label='Font'}} --><defs><filter id="emergencyAlertShadow" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/></filter></defs><g id="emergencyAlertCard" transform="translate(0 {{hide}})"><g id="emergencyAlertShake" transform="translate(0 0)"><rect x="${CARD_X}" y="60" width="${CARD_W}" height="{{cardH}}" rx="40" fill="{{card}}" fill-opacity="{{cardOpacity}}" filter="url(#emergencyAlertShadow)"/><circle id="emergencyAlertRing" cx="${CARD_X + 74}" cy="124" r="26" fill="none" stroke="{{alert}}" stroke-width="4" opacity="0"/><circle cx="${CARD_X + 74}" cy="124" r="26" fill="{{alert}}"/><path d="M${CARD_X + 74} 108 L${CARD_X + 90} 136 H${CARD_X + 58} Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round"/><path d="M${CARD_X + 74} 117 V127" stroke="{{alert}}" stroke-width="4" stroke-linecap="round"/><circle cx="${CARD_X + 74}" cy="132.5" r="2.3" fill="{{alert}}"/><text x="${CARD_X + 120}" y="{{labelBase}}" font-family="{{font}}" font-size="{{labelSize}}" font-weight="700" letter-spacing="1" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}">{{labelCaps}}</text><text x="${CARD_X + CARD_W - 60}" y="{{labelBase}}" text-anchor="end" font-family="{{font}}" font-size="{{levelSize}}" font-weight="700" textLength="{{levelW}}" lengthAdjust="spacingAndGlyphs" fill="{{alert}}">{{level}}</text><text x="${CARD_X + 70}" y="{{titleBase}}" font-family="{{font}}" font-size="{{titleSize}}" font-weight="800" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{title}}</text>${Array.from(
    { length: BODY_LINES },
    (_, k) =>
      `<text x="${CARD_X + 70}" y="{{bodyBase${k}}}" font-family="{{font}}" font-size="{{bodySize${k}}}" font-weight="500" textLength="{{bodyW${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}" display="{{bodyShow${k}}}">{{body${k}}}</text>`,
  ).join("")}</g></g></svg>`,
  animate: [
    // Drops in from above the frame, overshooting a little.
    { id: "emergencyAlertCard", attrs: { transform: ["translate(0 {{hide}})", "translate(0 0)"] }, ms: ALERT_DROP, ease: { spring: { stiffness: 210, damping: 19 } } },
    // Two buzzes, the phone vibrating.
    ...BUZZES.map((delay): SvgAnimation => ({ id: "emergencyAlertShake", attrs: { transform: ["translate(0 0)", "translate(9 0)"] }, delay, ms: 420, behavior: { type: "oscillate", count: 9, decay: 1 } })),
    // The alert icon ringing out while it shows.
    ...holds("emergencyAlertRing", "opacity", [[0, 0]]),
    ...holds("emergencyAlertRing", "r", [[0, 26]]),
    { id: "emergencyAlertRing", attrs: { r: [26, 58], opacity: [0.7, 0] }, delay: ALERT_DROP, ms: 1000, ease: "out", repeat: 3 },
    ...holds("emergencyAlertRing", "r", [[ALERT_DROP + 3000, 26]]),
    { id: "emergencyAlertCard", attrs: { transform: ["translate(0 0)", "translate(0 {{hide}})"] }, delay: after(0), ms: 420, ease: [0.55, 0, 1, 0.45] },
  ],
};

export const emergencyAlert: VectorEffect = {
  kind: "vector",
  id: "emergency-alert",
  name: "Emergency alert",
  description:
    "A phone's emergency alert dropping in from the top of the screen: a dark card with a red warning icon ringing out, the alert's level, a bold title and its message, buzzing twice as it lands, holding, then sliding away.",
  category: "emergency",
  tags: ["emergency", "alert", "warning", "phone", "notification", "weather", "ui", "text", "overlay"],
  hold: 400,
  presets: [
    { name: "Amber alert", values: { label: "Amber alert", level: "Severe", title: "Missing child alert", body: "Call 911 with any information. Check your local news for details.", alert: [1, 0.62, 0.04] } },
    { name: "Heat warning", values: { title: "Extreme heat warning", body: "Stay indoors where you can. Drink plenty of water and check on neighbours.", level: "Severe", alert: [1, 0.45, 0.1] } },
    { name: "Light card", values: { card: [0.97, 0.97, 0.98], ink: [0.07, 0.07, 0.08], muted: [0.33, 0.33, 0.37] } },
  ],
  derived: (v) => {
    const labelCaps = String(v.label ?? "").toUpperCase();
    const label = fit(labelCaps, 600, 28);
    const level = fit(v.level, 260, 28);
    const title = fit(v.title, TEXT_W, 46);
    const lines = wrap(v.body, TEXT_W, BODY_SIZE, BODY_LINES);
    const titleBase = 214;
    const out: Record<string, string | number> = {
      ...outTimes(emergencyAlertMotion, ALERT_IN + ms(v.hold)),
      labelCaps,
      labelSize: label.size,
      labelW: label.width,
      labelBase: r1(124 + label.size * 0.36),
      levelSize: level.size,
      levelW: level.width,
      titleSize: title.size,
      titleW: title.width,
      titleBase,
    };
    for (let k = 0; k < BODY_LINES; k++) {
      const line = fit(lines[k] ?? "", TEXT_W, BODY_SIZE);
      Object.assign(out, {
        [`body${k}`]: lines[k] ?? "",
        [`bodySize${k}`]: line.size,
        [`bodyW${k}`]: line.width,
        [`bodyBase${k}`]: titleBase + 58 + k * BODY_LEAD,
        [`bodyShow${k}`]: lines[k] ? "inline" : "none",
      });
    }
    const cardH = titleBase - 60 + 32 + Math.max(1, lines.length) * BODY_LEAD + 20;
    out.cardH = cardH;
    out.hide = -(cardH + 120);
    return out;
  },
  motion: emergencyAlertMotion,
};

/** Emergency vector effects. */
export const emergencyEffects: VectorEffect[] = [cautionTape, emergencyAlert];
