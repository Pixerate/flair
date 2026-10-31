import { rgbToHex } from "../shader/controls.js";
import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { pathBounds } from "../vector/morph.js";
import { textWidthEm } from "./images.js";
import { CURRENT_COLOR, isCurrentColor, type VectorEffect } from "./types.js";

/*
 * Text effects take any word or phrase: `derived` works out a font size from
 * its length (see `textWidthEm`) and, where it can, `textLength` stretches it
 * to the width that size predicts, so it fills the same box in any font.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A line fitted to `width` units, at most `max` high: its font size, width and left edge (centred on 200). */
function fit(text: string, width: number, max: number, ems = textWidthEm(text)) {
  const e = Math.max(0.6, ems);
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size), left: r1(200 - (e * size) / 2) };
}

/** Letters as code points, so emoji and accents count once. */
const lettersOf = (text: unknown) => Array.from(String(text));

/**
 * `a` mixed `t` of the way to `b`, colours as written by vector controls
 * ([r, g, b] 0–1). Mixed with `currentColor`, the browser mixes them (CSS `color-mix`).
 */
const mixHex = (a: unknown, b: unknown, t: number) => {
  if (isCurrentColor(a) || isCurrentColor(b)) {
    const css = (c: unknown) => (isCurrentColor(c) ? CURRENT_COLOR : rgbToHex((Array.isArray(c) ? c : [1, 1, 1]) as number[]));
    return `color-mix(in srgb, ${css(a)}, ${css(b)} ${Math.round(t * 100)}%)`;
  }
  const x = (Array.isArray(a) ? a : [1, 1, 1]) as number[];
  const y = (Array.isArray(b) ? b : [1, 1, 1]) as number[];
  return rgbToHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t));
};

/** Instant changes: the attribute holds each value from its time on (flicker, jumps). */
const holds = (id: string, attr: string, keys: readonly (readonly [number, string | number])[]): SvgAnimation[] =>
  keys.map(([delay, value]) => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 }));

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
/** A monospace letter's advance, in ems. */
const MONO_EM = 0.6;
const HEAVY = `'Arial Black', 'Helvetica Neue', Impact, system-ui, sans-serif`;
const SANS = `system-ui, 'Helvetica Neue', Arial, sans-serif`;
const SCRIPT = `'Pacifico', 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive`;

/** Text effects' cap height, in ems: near enough for the heavy, plain, monospace and script faces they use. */
const CAP = 0.72;

/**
 * The controls every text effect shares, declared after its own: its
 * typeface (`font` takes any CSS font-family, `inherit` the surrounding
 * text's), and `inline`, which sets it in a line of text (see {@link frame}).
 */
const typeface = (font: string, weight: number) =>
  `{{font: text default="${font}" label='Font'}} {{weight: int min=100 max=900 default=${weight} step=100 label='Weight'}} {{inline: bool default=false label='Inline'}}`;

/**
 * What a text effect's picture frames: its whole 400 × 200 stage, or with
 * `inline` just its text, from cap height down to the baseline, so it sits
 * on the line like a word would. Inline, the backdrop goes and everything
 * else (glows, underlines, drops) spills over the text around it.
 */
function frame(
  v: Record<string, unknown>,
  left: number,
  width: number,
  base: number,
  size: number,
  overhang: Overhang = [0.05, 0, DESCENT, 0],
) {
  const spill = overhang.map((e) => Math.round(Math.max(0, e) * 100) / 100).join(" ");
  return v.inline
    ? { viewBox: `${r1(left)} ${r1(base - size * CAP)} ${r1(width)} ${r1(size * CAP)}`, overflow: "visible", backdrop: 0, overhang: spill }
    : { viewBox: "0 0 400 200", overflow: "hidden", backdrop: 1, overhang: spill };
}

/**
 * How far a text effect spills past its inline box at rest (top, right,
 * bottom, left), in ems of its font size: descenders, outlines, glows,
 * underlines. Written on the picture as `data-overhang` (see `svgInlineLayout`).
 */
type Overhang = [number, number, number, number];

/** How far descenders reach below the baseline, in ems. */
const DESCENT = 0.25;

/** `overhang` grown by `by` ems on every side (a glow's or an outline's reach). */
const glowing = (overhang: Overhang, by: number): Overhang => overhang.map((e) => e + by) as Overhang;

/** The width a line fits in: inline, any (the picture widens with the text instead of the text shrinking). */
const room = (v: Record<string, unknown>, width: number) => (v.inline ? Infinity : width);

/** The caret's blinks after typing: on and off every 500 ms. */
const BLINKS = 7;

export const typewriter: VectorEffect = {
  kind: "vector",
  id: "typewriter",
  name: "Typewriter",
  description: "Letters typed out one at a time behind a block caret, which then blinks.",
  category: "text",
  tags: ["text", "title", "typing", "terminal", "caption"],
  hold: 300,
  presets: [
    { name: "Terminal", values: { paper: [0.03, 0.05, 0.04], ink: [0.3, 1, 0.45] } },
    { name: "Paper", values: { paper: [0.98, 0.95, 0.88], ink: [0.15, 0.13, 0.12], pace: 120 } },
  ],
  // Monospace, so the caret lands after the last letter however long the text is.
  derived: (v) => {
    const count = Math.max(1, lettersOf(v.text).length);
    const size = r1(Math.min(44, room(v, 340) / ((count + 1) * MONO_EM)));
    const left = r1(200 - ((count + 1) * MONO_EM * size) / 2);
    const typing = Math.round(count * Number(v.pace));
    const base = r1(100 + size * 0.35);
    return {
      ...frame(v, left, (count + 1) * MONO_EM * size, base, size, [0.08, 0, DESCENT, 0]),
      size,
      left,
      base,
      end: r1(left + count * MONO_EM * size),
      typing,
      ...Object.fromEntries(Array.from({ length: BLINKS }, (_, k) => [`blink${k}`, typing + k * 500])),
    };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Hello, world.' label='Text'}} {{paper: color default=#111827 label='Background'}} {{ink: color default=#F9FAFB label='Text colour'}} {{pace: float min=30 max=300 default=90 step=5 label='Ms per letter'}} ${typeface(MONO, 400)} --><rect width="400" height="200" fill="{{paper}}" opacity="{{backdrop}}"/><text id="typed" x="{{left}}" y="{{base}}" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}" xml:space="preserve">{{text}}</text><text id="caret" x="{{end}}" y="{{base}}" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}" opacity="0">▌</text></svg>`,
    animate: [
      { id: "typed", write: "{{text}}", caret: "▌", ms: n("typing"), ease: "linear" },
      // Hidden while the writer shows its own caret, then blinking where it stopped.
      ...holds("caret", "opacity", [[0, 0], ...Array.from({ length: BLINKS }, (_, k) => [n(`blink${k}`), k % 2 ? 0 : 1] as const)]),
    ],
  },
};

export const scrambleText: VectorEffect = {
  kind: "vector",
  id: "scramble-text",
  name: "Scramble text",
  description: "Random glyphs flickering, then settling into the real word letter by letter, left to right.",
  category: "text",
  tags: ["text", "title", "decode", "hacker", "cyber", "reveal"],
  hold: 1200,
  presets: [
    { name: "Matrix", values: { background: [0, 0.03, 0.01], ink: [0.4, 1, 0.5], accent: [0.1, 0.7, 0.25], glyphs: "01" } },
    { name: "Amber", values: { background: [0.08, 0.04, 0], ink: [1, 0.72, 0.2], accent: [0.9, 0.4, 0.05] } },
  ],
  derived: (v) => {
    const count = Math.max(1, lettersOf(v.text).length);
    const size = r1(Math.min(60, room(v, 360) / (count * MONO_EM)));
    const width = r1(count * MONO_EM * size);
    const base = r1(100 + size * 0.35);
    return { size, base, barX: r1(200 - width / 2), barY: r1(base + size * 0.3), barW: width, decode: Math.round(count * Number(v.pace)), glowWide: Number(v.glow) * 2, ...frame(v, 200 - width / 2, width, base, size, glowing([0.08, 0, Math.max(DESCENT, 0.3 + 3 / size), 0], (Number(v.glow) * 4) / size)) };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='ACCESS GRANTED' label='Text'}} {{glyphs: text default='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+' label='Scramble glyphs'}} {{background: color default=#05070D label='Background'}} {{ink: color default=#E2E8F0 label='Text colour'}} {{accent: color default=#22D3EE label='Accent'}} {{pace: float min=20 max=250 default=70 step=5 label='Ms per letter'}} {{glow: float min=0 max=6 default=2 step=0.5 label='Glow'}} ${typeface(MONO, 700)} --><defs><filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="{{glowWide}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><text id="word" x="200" y="{{base}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}" filter="url(#glow)" xml:space="preserve">{{text}}</text><rect id="bar" x="{{barX}}" y="{{barY}}" width="0" height="3" fill="{{accent}}"/></svg>`,
    animate: [
      // Pure noise for a moment (the scramble runs before the change starts), then it decodes.
      { id: "word", write: "{{text}}", scramble: "{{glyphs}}", delay: 500, ms: n("decode"), ease: "linear" },
      { id: "bar", attrs: { width: [0, n("barW")] }, delay: 500, ms: n("decode"), ease: "linear" },
    ],
  },
};

/** Kinetic stagger's letter slots: one element per letter, so each can move on its own. */
const SLOTS = 20;

export const kineticStagger: VectorEffect = {
  kind: "vector",
  id: "kinetic-stagger",
  name: "Kinetic stagger",
  description: "Each letter springs up into place in turn, rising, turning and overshooting, then an underline sweeps beneath.",
  category: "text",
  tags: ["text", "title", "kinetic", "typography", "headline", "intro"],
  hold: 1200,
  presets: [
    { name: "Poster", values: { background: [0.98, 0.87, 0.2], ink: [0.07, 0.07, 0.07], accent: [0.9, 0.15, 0.2] } },
    { name: "Midnight", values: { background: [0.04, 0.05, 0.12], ink: [0.95, 0.96, 1], accent: [0.55, 0.45, 1], stagger: 80 } },
  ],
  // Up to SLOTS letters, each centred in its estimated advance; unused slots stay empty.
  derived: (v) => {
    const letters = lettersOf(v.text).slice(0, SLOTS);
    const widths = letters.map((c) => textWidthEm(c));
    const ems = Math.max(0.6, widths.reduce((a, b) => a + b, 0));
    const size = Math.min(92, room(v, 370) / ems);
    const base = 100 + size * 0.35;
    const stagger = Number(v.stagger);
    const out: Record<string, string | number> = {
      ...frame(v, 200 - (ems * size) / 2, ems * size, base, size, [0.15, 0, Math.max(DESCENT, 0.2 + 6 / size), 0]),
      size: r1(size),
      base: r1(base),
      rise: r1(base - size * 0.1),
      drop: r1(base + size * 0.6),
      lineX: r1(200 - (ems * size) / 2),
      lineY: r1(base + size * 0.2),
      lineW: r1(ems * size),
      lineAt: Math.round(letters.length * stagger + 400),
    };
    let x = 200 - (ems * size) / 2;
    for (let i = 0; i < SLOTS; i++) {
      const w = (widths[i] ?? 0) * size;
      out[`c${i}`] = letters[i]?.trim() ?? "";
      out[`x${i}`] = r1(x + w / 2);
      out[`d${i}`] = Math.round(i * stagger);
      out[`e${i}`] = Math.round(i * stagger + 380);
      x += w;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Kinetic' label='Text'}} {{background: color default=#F8FAFC label='Background'}} {{ink: color default=#0F172A label='Text colour'}} {{accent: color default=#F43F5E label='Underline'}} {{stagger: float min=20 max=200 default=55 step=5 label='Ms between letters'}} ${typeface(HEAVY, 900)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/>${Array.from(
      { length: SLOTS },
      (_, i) =>
        `<text id="l${i}" text-anchor="middle" transform="translate({{x${i}}} {{drop}}) rotate(-28) scale(0.3)" opacity="0" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}">{{c${i}}}</text>`,
    ).join("")}<rect id="line" x="{{lineX}}" y="{{lineY}}" width="0" height="6" rx="3" fill="{{accent}}"/></svg>`,
    animate: [
      ...Array.from({ length: SLOTS }, (_, i): SvgAnimation[] => [
        {
          id: `l${i}`,
          attrs: { transform: [`translate({{x${i}}} {{drop}}) rotate(-28) scale(0.3)`, `translate({{x${i}}} {{rise}}) rotate(5) scale(1.12)`], opacity: [0, 1] },
          delay: n(`d${i}`),
          ms: 380,
          ease: "out",
        },
        { id: `l${i}`, attrs: { transform: [`translate({{x${i}}} {{rise}}) rotate(5) scale(1.12)`, `translate({{x${i}}} {{base}}) rotate(0) scale(1)`] }, delay: n(`e${i}`), ms: 260, ease: "in-out" },
      ]).flat(),
      { id: "line", attrs: { width: [0, n("lineW")] }, delay: n("lineAt"), ms: 500, ease: "in-out" },
    ],
  },
};

export const neonSign: VectorEffect = {
  kind: "vector",
  id: "neon-sign",
  name: "Neon sign",
  description: "Glowing neon tube lettering that stutters on, then keeps one faulty letter buzzing.",
  category: "text",
  tags: ["text", "neon", "glow", "sign", "night", "retro"],
  hold: 400,
  presets: [
    { name: "Hot pink", values: { tube: [1, 0.2, 0.65], wall: [0.06, 0.02, 0.07] } },
    { name: "Ice", values: { tube: [0.35, 0.85, 1], wall: [0.02, 0.04, 0.08], glow: 5 } },
    { name: "Lime", values: { tube: [0.6, 1, 0.2], wall: [0.03, 0.05, 0.02] } },
  ],
  // The word in three runs, so the buzzing letter can flicker on its own.
  derived: (v) => {
    const letters = lettersOf(v.text);
    const k = Math.min(Math.max(0, Math.round(Number(v.faulty)) - 1), Math.max(0, letters.length - 1));
    const { size, length, left } = fit(String(v.text), room(v, 340), 84);
    return {
      ...frame(v, left, length, 100 + size * 0.3, size, glowing([0.1, 0, DESCENT, 0], (Number(v.glow) * 6) / size)),
      hazeX: r1(Math.max(170, length / 2 + 30)),
      head: letters.slice(0, k).join(""),
      mid: letters[k] ?? "",
      tail: letters.slice(k + 1).join(""),
      size,
      length,
      base: r1(100 + size * 0.3),
      far: Number(v.glow) * 3,
      core: mixHex(v.tube, [1, 1, 1], 0.6),
    };
  },
  motion: ((): SvgMotion => {
    const word = `x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}"`;
    const runs = (id: string) => `<tspan>{{head}}</tspan><tspan id="${id}">{{mid}}</tspan><tspan>{{tail}}</tspan>`;
    // Start-up: the tubes catch, drop out and catch again.
    const startUp = [[0, 0], [150, 0.85], [210, 0], [330, 1], [390, 0.15], [450, 1], [620, 0.35], [680, 1]] as const;
    const buzz = [[0, 1], [1300, 0.15], [1350, 1], [1420, 0.2], [1520, 1], [2100, 0.1], [2160, 1], [2230, 0.25], [2280, 1]] as const;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Open late' label='Text'}} {{tube: color default=#FF3DA5 label='Tube'}} {{wall: color default=#120612 label='Wall'}} {{glow: float min=0.5 max=8 default=3.5 step=0.5 label='Glow'}} {{faulty: int min=1 max=24 default=6 label='Buzzing letter'}} ${typeface(SCRIPT, 400)} --><defs><filter id="neon" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="{{glow}}" result="near"/><feGaussianBlur in="SourceGraphic" stdDeviation="{{far}}" result="far"/><feMerge><feMergeNode in="far"/><feMergeNode in="far"/><feMergeNode in="near"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="haze" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="30"/></filter></defs><rect width="400" height="200" fill="{{wall}}" opacity="{{backdrop}}"/><g id="sign" opacity="0"><ellipse cx="200" cy="100" rx="{{hazeX}}" ry="55" fill="{{tube}}" opacity="0.18" filter="url(#haze)"/><text ${word} fill="{{tube}}" stroke="{{tube}}" stroke-width="1.5" filter="url(#neon)">${runs("buzzGlow")}</text><text ${word} fill="{{core}}">${runs("buzzCore")}</text></g></svg>`,
      animate: [
        ...holds("sign", "opacity", startUp),
        // fill-opacity rather than opacity: browsers ignore opacity on a <tspan>.
        ...["buzzGlow", "buzzCore"].flatMap((id) => [...holds(id, "fill-opacity", buzz), ...holds(id, "stroke-opacity", buzz)]),
      ],
    };
  })(),
};

export const strokeDrawText: VectorEffect = {
  kind: "vector",
  id: "stroke-draw-text",
  name: "Stroke draw text",
  description: "A word's outline traced on along every letter, then its fill fading in.",
  category: "text",
  tags: ["text", "title", "draw-on", "outline", "reveal", "handwriting"],
  hold: 1200,
  presets: [
    { name: "Blueprint", values: { background: [0.05, 0.2, 0.45], outline: [0.85, 0.93, 1], fill: [0.85, 0.93, 1], fillOpacity: 0.15 } },
    { name: "Gold", values: { background: [0.07, 0.06, 0.05], outline: [1, 0.8, 0.35], fill: [0.85, 0.6, 0.15] } },
  ],
  // <text> takes no pathLength, so `draw` cannot measure it: the dash grows instead, longer than any letter's outline.
  // Note on variable and system fonts: Some variable fonts (such as system-ui/SF Pro on macOS) draw certain glyphs
  // (e.g. 'e') using multiple overlapping contour segments. An SVG stroke traces every internal segment boundary,
  // which can appear as an unexpected stroke through glyph counters. Use standard web fonts (Inter, Roboto, Arial Black)
  // or outline-flattened paths when clean single-boundary outlines are required.
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 360), 100);
    const edge = Number(v.width) / 2 / size;
    return { size, length, base: r1(100 + size * 0.35), dash: Math.round(size * 6), ...frame(v, left, length, 100 + size * 0.35, size, glowing([0.05, 0, DESCENT, 0], edge)) };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Draw' label='Text'}} {{background: color default=#FFFBF5 label='Background'}} {{outline: color default=#1E293B label='Outline'}} {{fill: color default=#F97316 label='Fill'}} {{width: float min=0.5 max=6 default=2 step=0.5 label='Outline width'}} {{fillOpacity: float min=0 max=1 default=1 label='Fill opacity'}} ${typeface(HEAVY, 900)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><text id="word" x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{fill}}" fill-opacity="0" stroke="{{outline}}" stroke-width="{{width}}" stroke-linejoin="round" stroke-dasharray="0 {{dash}}">{{text}}</text></svg>`,
    animate: [
      { id: "word", attrs: { "stroke-dasharray": ["0 {{dash}}", "{{dash}} 0"] }, ms: 2000, ease: "in-out" },
      { id: "word", attrs: { "fill-opacity": [0, n("fillOpacity")] }, delay: 1500, ms: 700, ease: "out" },
    ],
  },
};

export const splitReveal: VectorEffect = {
  kind: "vector",
  id: "split-reveal",
  name: "Split reveal",
  description: "A line draws across, then the title's top half rises out from behind it while the bottom half drops down.",
  category: "text",
  tags: ["text", "title", "reveal", "mask", "editorial", "intro"],
  hold: 1400,
  presets: [
    { name: "Light", values: { background: [0.97, 0.96, 0.94], ink: [0.08, 0.08, 0.1], line: [0.85, 0.2, 0.15] } },
    { name: "Gold on black", values: { background: [0.02, 0.02, 0.02], ink: [0.96, 0.84, 0.55], line: [0.96, 0.84, 0.55] } },
  ],
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 360), 88);
    return {
      ...frame(v, left, length, 100 + size * 0.36, size, [0.05, 10 / size, Math.max(DESCENT, 34 / size), 10 / size]),
      size,
      length,
      base: r1(100 + size * 0.36),
      shift: r1(size * 0.8),
      lineX1: r1(left - 10),
      lineX2: r1(400 - left + 10),
      captionY: r1(100 + size * 0.36 + 30),
    };
  },
  motion: ((): SvgMotion => {
    const word = `<text x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}">{{text}}</text>`;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Chapter One' label='Text'}} {{caption: text default='The beginning' label='Caption'}} {{background: color default=#0F172A label='Background'}} {{ink: color default=#F8FAFC label='Text colour'}} {{line: color default=#38BDF8 label='Line'}} ${typeface(SANS, 800)} --><defs><clipPath id="above"><rect x="-5000" y="-5000" width="10400" height="5100"/></clipPath><clipPath id="below"><rect x="-5000" y="100" width="10400" height="5100"/></clipPath></defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g clip-path="url(#above)"><g id="top" transform="translate(0 {{shift}})">${word}</g></g><g clip-path="url(#below)"><g id="bottom" transform="translate(0 -{{shift}})">${word}</g></g><path id="line" d="M{{lineX1}} 100 H{{lineX2}}" stroke="{{line}}" stroke-width="2.5" stroke-linecap="round"/><text id="caption" x="200" y="{{captionY}}" text-anchor="middle" font-family="{{font}}" font-size="13" letter-spacing="3" fill="{{ink}}" opacity="0">{{caption}}</text></svg>`,
      animate: [
        { id: "line", draw: true, ms: 600, ease: "in-out" },
        { id: "top", attrs: { transform: ["translate(0 {{shift}})", "translate(0 0)"] }, delay: 450, ms: 800, ease: "out" },
        { id: "bottom", attrs: { transform: ["translate(0 -{{shift}})", "translate(0 0)"] }, delay: 450, ms: 800, ease: "out" },
        { id: "line", attrs: { opacity: [1, 0] }, delay: 1100, ms: 400 },
        { id: "caption", attrs: { opacity: [0, 0.75] }, delay: 1100, ms: 500, ease: "out" },
      ],
    };
  })(),
};

export const highlighter: VectorEffect = {
  kind: "vector",
  id: "highlighter",
  name: "Highlighter",
  description: "A marker swipe drawn left to right behind a phrase, rough-edged like a real highlighter pen.",
  category: "text",
  tags: ["text", "highlight", "marker", "emphasis", "explainer", "callout"],
  hold: 1400,
  presets: [
    { name: "Pink", values: { marker: [1, 0.55, 0.78] } },
    { name: "Mint", values: { marker: [0.55, 0.95, 0.7] } },
    { name: "Dark", values: { background: [0.07, 0.08, 0.1], ink: [0.97, 0.97, 0.98], marker: [0.55, 0.2, 0.95] } },
  ],
  // The swipe runs a little past the phrase at both ends, across its lower half, with a ragged second pass.
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 330), 56);
    const base = 100 + size * 0.35;
    const x0 = left - size * 0.25;
    const x1 = 400 - left + size * 0.2;
    const y = base - size * 0.3;
    return {
      ...frame(v, left, length, base, size, [0.05, 0.2, DESCENT, 0.25]),
      size,
      length,
      base: r1(base),
      swipe: `M${r1(x0)} ${r1(y + size * 0.05)} Q${r1((x0 + x1) / 2)} ${r1(y - size * 0.06)} ${r1(x1)} ${r1(y - size * 0.02)}`,
      ragged: `M${r1(x0 + size * 0.15)} ${r1(y + size * 0.3)} L${r1(x1 - size * 0.1)} ${r1(y + size * 0.26)}`,
      thick: r1(size * 0.72),
      thin: r1(size * 0.16),
    };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Ship it faster' label='Phrase'}} {{background: color default=#FFFFFF label='Background'}} {{ink: color default=#111827 label='Text colour'}} {{marker: color default=#FDE047 label='Marker'}} ${typeface(SANS, 700)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g transform="rotate(-1.2 200 100)" opacity="0.9"><path id="swipe" d="{{swipe}}" fill="none" stroke="{{marker}}" stroke-width="{{thick}}"/><path id="ragged" d="{{ragged}}" fill="none" stroke="{{marker}}" stroke-width="{{thin}}" stroke-linecap="round"/></g><text id="phrase" x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}" opacity="0">{{text}}</text></svg>`,
    animate: [
      { id: "phrase", attrs: { opacity: [0, 1] }, ms: 300, ease: "out" },
      { id: "swipe", draw: true, delay: 350, ms: 650, ease: "in-out" },
      { id: "ragged", draw: true, delay: 420, ms: 620, ease: "in-out" },
    ],
  },
};

/** Word cycle's timing: how long each word rests, and how long a roll to the next takes. */
const SHOW_MS = 1000;
const ROLL_MS = 450;
const CYCLE_WORDS = 4;

export const wordCycle: VectorEffect = {
  kind: "vector",
  id: "word-cycle",
  name: "Word cycle",
  description: "A fixed lead-in with the last word rolling through alternatives like a slot machine, an underline resizing to each.",
  category: "text",
  tags: ["text", "headline", "rotating", "hero", "marketing", "slot"],
  hold: 0,
  presets: [
    { name: "Dark", values: { background: [0.05, 0.06, 0.1], ink: [0.95, 0.96, 1], accent: [0.4, 0.85, 0.65] } },
    { name: "Warm", values: { background: [1, 0.96, 0.9], ink: [0.2, 0.12, 0.08], accent: [0.93, 0.35, 0.15] } },
  ],
  // The lead-in and the longest word share the line; the reel ends with word 1 again, so the loop is seamless.
  derived: (v) => {
    const words = Array.from({ length: CYCLE_WORDS }, (_, i) => String(v[`word${i + 1}`]));
    const lead = textWidthEm(String(v.prefix));
    const ems = words.map((w) => Math.max(0.6, textWidthEm(w)));
    const total = lead + 0.3 + Math.max(...ems);
    const size = Math.min(52, room(v, 370) / total);
    const left = 200 - (total * size) / 2;
    const base = 100 + size * 0.35;
    const step = size * 1.3;
    const wx = left + (lead + 0.3) * size;
    return {
      ...frame(v, left, total * size, base, size, [0.08, 0, Math.max(DESCENT, 0.18 + 4 / size), 0]),
      bold: Math.min(900, Number(v.weight) + 100),
      size: r1(size),
      base: r1(base),
      px: r1(left),
      plen: r1(Math.max(0.6, lead) * size),
      wx: r1(wx),
      clipX: r1(wx - 4),
      clipY: r1(base - size * 1.0),
      clipW: r1(Math.max(...ems) * size + 8),
      clipH: r1(size * 1.32),
      underY: r1(base + size * 0.18),
      ...Object.fromEntries(
        [...words, words[0]!].flatMap((_, k) => [
          [`y${k}`, r1(base + k * step)],
          [`o${k}`, r1(k * step)],
          [`len${k}`, r1(ems[k % CYCLE_WORDS]! * size)],
        ]),
      ),
      ...Object.fromEntries(words.map((w, k) => [`w${k}`, w])),
    };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{prefix: text default='We build' label='Lead-in'}} {{word1: text default=apps label='Word 1'}} {{word2: text default=brands label='Word 2'}} {{word3: text default=websites label='Word 3'}} {{word4: text default=games label='Word 4'}} {{background: color default=#FFFFFF label='Background'}} {{ink: color default=#0F172A label='Text colour'}} {{accent: color default=#6366F1 label='Accent'}} ${typeface(SANS, 700)} --><defs><clipPath id="window"><rect x="{{clipX}}" y="{{clipY}}" width="{{clipW}}" height="{{clipH}}"/></clipPath></defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><text x="{{px}}" y="{{base}}" textLength="{{plen}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}">{{prefix}}</text><g clip-path="url(#window)"><g id="reel" transform="translate(0 -0)">${Array.from(
      { length: CYCLE_WORDS + 1 },
      (_, k) =>
        `<text x="{{wx}}" y="{{y${k}}}" textLength="{{len${k}}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{bold}}" fill="{{accent}}">{{w${k % CYCLE_WORDS}}}</text>`,
    ).join("")}</g></g><rect id="under" x="{{wx}}" y="{{underY}}" width="{{len0}}" height="4" rx="2" fill="{{accent}}"/></svg>`,
    animate: Array.from({ length: CYCLE_WORDS }, (_, i): SvgAnimation[] => {
      const at = { delay: (i + 1) * SHOW_MS + i * ROLL_MS, ms: ROLL_MS, ease: "in-out" as const };
      return [
        { id: "reel", attrs: { transform: [`translate(0 -{{o${i}}})`, `translate(0 -{{o${i + 1}}})`] }, ...at },
        { id: "under", attrs: { width: [n(`len${i}`), n(`len${i + 1}`)] }, ...at },
      ];
    }).flat(),
  },
};

/** Liquid fill's wave: crests along y = 0 in 100-unit periods, far either side of the picture (inline text runs wide), filled down below it. */
const WAVE = `M-2000 0${" q25 -8 50 0 t50 0".repeat(46)} V320 H-2000Z`;

export const liquidFill: VectorEffect = {
  kind: "vector",
  id: "liquid-fill",
  name: "Liquid fill",
  description: "A title filling up with liquid, its wavy surface rising through the letters.",
  category: "text",
  tags: ["text", "title", "liquid", "water", "progress", "fill"],
  hold: 900,
  presets: [
    { name: "Gradient sweep", values: { liquid: [0.98, 0.25, 0.55], liquid2: [0.35, 0.4, 1], empty: [0.93, 0.93, 0.96] } },
    { name: "Lava", values: { liquid: [1, 0.35, 0.05], liquid2: [1, 0.8, 0.1], empty: [0.15, 0.08, 0.06], background: [0.06, 0.03, 0.02] } },
    { name: "Juice", values: { liquid: [1, 0.6, 0.1], liquid2: [1, 0.75, 0.25] } },
  ],
  // The surface starts under the letters and ends above their caps.
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 360), 110);
    const base = 100 + size * 0.36;
    return { ...frame(v, left, length, base, size), size, length, base: r1(base), low: r1(base + 12), high: r1(base - size * 0.82 - 12) };
  },
  motion: ((): SvgMotion => {
    const word = `x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}"`;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='FILL' label='Text'}} {{background: color default=#FFFFFF label='Background'}} {{empty: color default=#E0F2FE label='Empty'}} {{liquid: color default=#0284C7 label='Liquid'}} {{liquid2: color default=#38BDF8 label='Liquid sweep'}} ${typeface(HEAVY, 900)} --><defs><clipPath id="letters"><text ${word}>{{text}}</text></clipPath><linearGradient id="liq" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="{{liquid}}"/><stop offset="0.5" stop-color="{{liquid2}}"/><stop offset="1" stop-color="{{liquid}}"/></linearGradient></defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><text ${word} fill="{{empty}}" stroke="{{liquid}}" stroke-width="1.5" stroke-opacity="0.5">{{text}}</text><g clip-path="url(#letters)"><g id="level" transform="translate(0 {{low}})"><path id="back" d="${WAVE}" fill="{{liquid}}" opacity="0.45" transform="translate(-50 -5)"/><path id="wave" d="${WAVE}" fill="url(#liq)" transform="translate(0 0)"/></g></g></svg>`,
      animate: [
        { id: "level", attrs: { transform: ["translate(0 {{low}})", "translate(0 {{high}})"] }, ms: 2800, ease: "out" },
        { id: "wave", attrs: { transform: ["translate(0 0)", "translate(-200 0)"] }, ms: 3000, ease: "linear" },
        { id: "back", attrs: { transform: ["translate(-50 -5)", "translate(150 -5)"] }, ms: 3000, ease: "linear" },
        // The sweep: the repeating gradient slides along, visible when the two liquid colours differ.
        { id: "liq", attrs: { x1: [0, 400], x2: [400, 800] }, ms: 3000, ease: "linear" },
      ],
    };
  })(),
};

/** Glitch text's bands: where the word is cut into slices, as fractions from its cap line to its baseline. */
const BANDS = [0.3, 0.55, 0.8];
/** Glitch text's jumps: [ms, red offset, cyan offset, each band's shift], in units of the word's size; rests between bursts. */
const GLITCH = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const rest = { red: [-0.02, 0], cyan: [0.02, 0], bands: [0, 0, 0, 0] };
  const keys: { at: number; red: number[]; cyan: number[]; bands: number[] }[] = [{ at: 0, ...rest }];
  for (const [start, count] of [[250, 6], [1050, 3], [1650, 8]] as const) {
    for (let k = 0; k < count; k++)
      keys.push({
        at: start + k * 55,
        red: [rand() * 0.12, rand() * 0.04],
        cyan: [rand() * 0.12, rand() * 0.04],
        bands: [0, 1, 2, 3].map(() => (rand() > 0.1 ? rand() * 0.25 : 0)),
      });
    keys.push({ at: start + count * 55, ...rest });
  }
  return keys;
})();

export const glitchText: VectorEffect = {
  kind: "vector",
  id: "glitch-text",
  name: "Glitch text",
  description: "A title breaking up in bursts: red and cyan copies split apart and slices of the letters jump sideways.",
  category: "text",
  tags: ["text", "title", "glitch", "cyber", "rgb-split", "error"],
  hold: 400,
  presets: [
    { name: "Classic", values: { left: [1, 0, 0.2], right: [0, 1, 1] } },
    { name: "Vapor", values: { left: [1, 0.3, 0.85], right: [0.4, 0.6, 1], background: [0.08, 0.02, 0.12], amount: 1.4 } },
  ],
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 340), 100);
    const a = Number(v.amount);
    const base = 100 + size * 0.36;
    const top = base - size * 0.78;
    const cuts = [-1000, ...BANDS.map((f) => r1(top + f * (base - top))), 1200];
    const unit = size * Number(v.amount);
    const shift = ([x, y]: number[]) => `translate(${r1(x! * unit)} ${r1(y! * unit)})`;
    return {
      ...frame(v, left, length, base, size, [0.05 + 0.04 * a, 0.25 * a, DESCENT + 0.04 * a, 0.25 * a]),
      size,
      length,
      base: r1(base),
      ...Object.fromEntries([0, 1, 2, 3].flatMap((b) => [[`cut${b}`, cuts[b]!], [`band${b}`, r1(cuts[b + 1]! - cuts[b]!)]])),
      ...Object.fromEntries(
        GLITCH.flatMap((key, k) => [
          [`red${k}`, shift(key.red)],
          [`cyan${k}`, shift(key.cyan)],
          ...key.bands.map((x, b) => [`b${b}_${k}`, shift([x, 0])]),
        ]),
      ),
    };
  },
  motion: ((): SvgMotion => {
    const word = (paint: string) =>
      `<text x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" ${paint}>{{text}}</text>`;
    const jumps = (id: string, value: (k: number) => string) =>
      GLITCH.map((key, k): SvgAnimation => ({ id, attrs: { transform: [value(k), value(k)] }, delay: key.at, ms: 0 }));
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='GLITCH' label='Text'}} {{background: color default=#07070B label='Background'}} {{ink: color default=#F5F5F5 label='Text colour'}} {{left: color default=#FF0040 label='Red copy'}} {{right: color default=#00F0FF label='Cyan copy'}} {{amount: float min=0 max=3 default=1 step=0.1 label='Intensity'}} ${typeface(HEAVY, 900)} --><defs>${[0, 1, 2, 3]
        .map((b) => `<clipPath id="slice${b}"><rect x="-5000" y="{{cut${b}}}" width="10400" height="{{band${b}}}"/></clipPath>`)
        .join("")}</defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g id="red" style="mix-blend-mode:screen">${word(`fill="{{left}}"`)}</g><g id="cyan" style="mix-blend-mode:screen">${word(`fill="{{right}}"`)}</g>${[0, 1, 2, 3]
        .map((b) => `<g clip-path="url(#slice${b})"><g id="s${b}">${word(`fill="{{ink}}"`)}</g></g>`)
        .join("")}</svg>`,
      animate: [
        ...jumps("red", (k) => `{{red${k}}}`),
        ...jumps("cyan", (k) => `{{cyan${k}}}`),
        ...[0, 1, 2, 3].flatMap((b) => jumps(`s${b}`, (k) => `{{b${b}_${k}}}`)),
      ],
    };
  })(),
};

/** Extruded text's layers, back to front, and the directions the extrude swings between (degrees, 0 = right, 90 = down). */
const LAYERS = 12;
const EXTRUDE_FROM = 40;
const EXTRUDE_TO = 140;

export const extrudedText: VectorEffect = {
  kind: "vector",
  id: "extruded-text",
  name: "Extruded text",
  description: "Retro 3D block lettering: stacked shaded layers extrude out of the title and swing as the light moves.",
  category: "text",
  tags: ["text", "title", "3d", "retro", "extrude", "80s"],
  hold: 600,
  presets: [
    { name: "Arcade", values: { face: [0.2, 0.95, 1], side: [0.85, 0.2, 0.75], shade: [0.2, 0.05, 0.3], background: [0.05, 0.02, 0.12] } },
    { name: "Diner", values: { face: [1, 1, 1], side: [0.9, 0.15, 0.2], shade: [0.35, 0.03, 0.06], background: [0.98, 0.9, 0.75], outline: [0.1, 0.1, 0.12] } },
  ],
  // Each layer sits a step further back along the extrude direction, shaded from the side colour to the shadow.
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 320), 96);
    const d = 0.36 * Number(v.depth);
    const step = size * 0.03 * Number(v.depth);
    const at = (deg: number, i: number) => {
      const a = (deg * Math.PI) / 180;
      return `translate(${r1(Math.cos(a) * step * i)} ${r1(Math.sin(a) * step * i)})`;
    };
    return {
      ...frame(v, left, length, 92 + size * 0.35, size, [0.05, 0.77 * d, DESCENT + d, 0.77 * d]),
      size,
      length,
      base: r1(92 + size * 0.35),
      ...Object.fromEntries(
        Array.from({ length: LAYERS }, (_, k) => {
          const i = LAYERS - k;
          return [
            [`fill${i}`, mixHex(v.side, v.shade, i / LAYERS)],
            [`a${i}`, at(EXTRUDE_FROM, i)],
            [`b${i}`, at(EXTRUDE_TO, i)],
          ];
        }).flat(),
      ),
    };
  },
  motion: ((): SvgMotion => {
    const word = (paint: string) =>
      `x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" stroke-linejoin="round" ${paint}`;
    const layers = Array.from({ length: LAYERS }, (_, k) => LAYERS - k);
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='RETRO' label='Text'}} {{background: color default=#FFE8C2 label='Background'}} {{face: color default=#FFD23F label='Face'}} {{outline: color default=#1A1423 label='Outline'}} {{side: color default=#EE4266 label='Extrude'}} {{shade: color default=#3B1F2B label='Shadow'}} {{depth: float min=0.2 max=2 default=1 step=0.1 label='Depth'}} ${typeface(HEAVY, 900)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/>${layers
        .map((i) => `<text id="e${i}" transform="translate(0 0)" ${word(`fill="{{fill${i}}}" stroke="{{fill${i}}}" stroke-width="2"`)}>{{text}}</text>`)
        .join("")}<text ${word(`fill="{{face}}" stroke="{{outline}}" stroke-width="2.5" paint-order="stroke"`)}>{{text}}</text></svg>`,
      animate: layers.flatMap((i): SvgAnimation[] => [
        { id: `e${i}`, attrs: { transform: ["translate(0 0)", `{{a${i}}}`] }, ms: 700, ease: "out" },
        { id: `e${i}`, attrs: { transform: [`{{a${i}}}`, `{{b${i}}}`] }, delay: 1200, ms: 1500, ease: "in-out" },
        { id: `e${i}`, attrs: { transform: [`{{b${i}}}`, `{{a${i}}}`] }, delay: 3200, ms: 1500, ease: "in-out" },
      ]),
    };
  })(),
};

/** Animated titles and type, as vector effects. */

/*
 * Text on a path: the words go in a <textPath> through a <tspan> at x="0"
 * y="0", so the text's own position does not push them along the path and
 * `startOffset` (a percentage of the path's length) places them.
 */

/** The frame of a picture whose letters follow a shape inside `box`: the whole stage, or inline, the shape's box with room for its letters. */
function pathFrame(v: Record<string, unknown>, box: readonly [number, number, number, number], reach: number) {
  return v.inline
    ? { viewBox: `${r1(box[0] - reach)} ${r1(box[1] - reach)} ${r1(box[2] + 2 * reach)} ${r1(box[3] + 2 * reach)}`, overflow: "visible", backdrop: 0, overhang: "0 0 0 0" }
    : { viewBox: "0 0 400 200", overflow: "hidden", backdrop: 1, overhang: "0 0 0 0" };
}

export const textOnPath: VectorEffect = {
  kind: "vector",
  id: "text-on-path",
  name: "Text on a path",
  description: "Words gliding along a curve, in at its start and out at its end; give it any SVG path to follow.",
  category: "text",
  tags: ["text", "path", "curve", "type", "title", "motion", "marquee"],
  hold: 0,
  presets: [
    { name: "Wave", values: { path: "M 10 110 C 80 40 130 40 200 110 S 320 180 390 110", background: [0.02, 0.09, 0.16], color: [0.6, 0.95, 1], line: [0.2, 0.6, 0.9] } },
    { name: "Ink", values: { background: [0.99, 0.97, 0.93], color: [0.1, 0.1, 0.12], line: [0.1, 0.1, 0.12], lineOpacity: 0.15 } },
  ],
  derived: (v) => {
    const box = pathBounds(String(v.path)) ?? [20, 50, 360, 100];
    return { travel: Math.round(Number(v.seconds) * 1000), ...pathFrame(v, box, Number(v.size) + Math.abs(Number(v.lift))) };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Along the curve' label='Text'}} {{path: text default='M 20 150 C 120 20 280 20 380 150' label='Path'}} {{size: float min=10 max=60 default=28 label='Size'}} {{seconds: float min=1 max=12 default=5 label='Travel (s)'}} {{lift: float min=-30 max=30 default=-8 label='Lift off the path'}} {{background: color default=#0F172A label='Background'}} {{color: color default=#F8FAFC label='Text'}} {{line: color default=#38BDF8 label='Path'}} {{lineOpacity: float min=0 max=1 default=0.5 label='Path opacity'}} ${typeface(SANS, 700)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><path id="track" d="{{path}}" fill="none" stroke="{{line}}" stroke-opacity="{{lineOpacity}}" stroke-width="2" stroke-linecap="round"/><text font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{color}}" text-anchor="middle"><textPath id="ride" href="#track" startOffset="-30%"><tspan x="0" y="0" dy="{{lift}}">{{text}}</tspan></textPath></text></svg>`,
    animate: [{ id: "ride", attrs: { startOffset: ["-30%", "130%"] }, ms: n("travel"), ease: "linear" }],
  },
};

export const circleText: VectorEffect = {
  kind: "vector",
  id: "circle-text",
  name: "Circle text",
  description: "Words set round a circle, repeated to close the ring, turning slowly round a mark: a badge or a seal.",
  category: "text",
  tags: ["text", "path", "circle", "badge", "seal", "rotate", "type"],
  hold: 0,
  presets: [
    { name: "Stamp", values: { background: [0.99, 0.96, 0.9], color: [0.75, 0.15, 0.12], text: "Handmade with care", mark: "✶" } },
    { name: "Night", values: { background: [0.04, 0.04, 0.08], color: [0.98, 0.85, 0.4], text: "Open late", mark: "☾" } },
  ],
  derived: (v) => {
    const r = Number(v.radius);
    const size = Number(v.size);
    const words = String(v.text).trim() || " ";
    const circumference = 2 * Math.PI * r;
    // Repeated, with a dot between, as often as fits the ring at this size; the spacing stretches to close it.
    const once = textWidthEm(`${words} • `) * size;
    const times = Math.max(1, Math.round(circumference / Math.max(once, 1)));
    return {
      ring: Array.from({ length: times }, () => `${words} • `).join(""),
      circle: `M 200 ${r1(100 - r)} a ${r1(r)} ${r1(r)} 0 1 1 0 ${r1(2 * r)} a ${r1(r)} ${r1(r)} 0 1 1 0 ${r1(-2 * r)}`,
      length: r1(circumference - size * 0.2),
      turn: Math.round(Number(v.seconds) * 1000),
      end: v.clockwise ? 360 : -360,
      markSize: r1(r * 0.6),
      markBase: r1(100 + r * 0.21),
      ...pathFrame(v, [200 - r, 100 - r, 2 * r, 2 * r], size),
    };
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Flair motion graphics' label='Text'}} {{mark: text default='★' label='Centre mark'}} {{radius: float min=30 max=88 default=70 label='Radius'}} {{size: float min=8 max=28 default=15 label='Size'}} {{seconds: float min=2 max=40 default=12 label='One turn (s)'}} {{clockwise: bool default=true label='Clockwise'}} {{background: color default=#111827 label='Background'}} {{color: color default=#F9FAFB label='Text'}} ${typeface(SANS, 700)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><defs><path id="ring-path" d="{{circle}}"/></defs><g id="ring" transform="rotate(0 200 100)"><text font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{color}}" letter-spacing="0.08em" textLength="{{length}}" lengthAdjust="spacing"><textPath href="#ring-path" startOffset="0"><tspan x="0" y="0">{{ring}}</tspan></textPath></text></g><text x="200" y="{{markBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{markSize}}" fill="{{color}}">{{mark}}</text></svg>`,
    animate: [{ id: "ring", attrs: { transform: ["rotate(0 200 100)", "rotate({{end}} 200 100)"] }, ms: n("turn"), ease: "linear" }],
  },
};

/** Caption effects' word slots: one element per word, so each can move on its own. */
const WORDS = 12;
/** The gap between caption words, in ems. */
const GAP = 0.3;

/** Up to WORDS words, split on whitespace. */
const wordsOf = (text: unknown) => String(text).trim().split(/\s+/).filter(Boolean).slice(0, WORDS);

/**
 * A caption's words laid out centred on one line, shrunk to fit, or on two
 * when a break lets them stand a good deal larger (never inline, where the
 * picture widens with the line instead). Per slot `i`: the word `w{i}`, its
 * centre `x{i}` / `y{i}` (mid cap height, where it scales and turns about),
 * its left edge `lx{i}` and width `ww{i}`. Unused slots are empty, at the centre.
 */
function captionLine(v: Record<string, unknown>, max: number) {
  const words = wordsOf(v.text);
  const ems = words.map((w) => Math.max(0.3, textWidthEm(w)));
  const span = (a: number[]) => a.reduce((s, e) => s + e, 0) + GAP * Math.max(0, a.length - 1);
  const width = room(v, 360);
  let size = Math.min(max, width / Math.max(0.6, span(ems)));
  let lines = [ems];
  if (!v.inline && words.length > 1) {
    // The break that leaves the longer line shortest; two lines stand at most 64 high, so both fit.
    let best = { size: 0, at: 1 };
    for (let k = 1; k < ems.length; k++) {
      const s = Math.min(max, 64, width / Math.max(span(ems.slice(0, k)), span(ems.slice(k))));
      if (s > best.size) best = { size: s, at: k };
    }
    if (best.size > size * 1.25) [size, lines] = [best.size, [ems.slice(0, best.at), ems.slice(best.at)]];
  }
  const pitch = size * 1.15;
  const base = 100 + size * 0.35 - ((lines.length - 1) * pitch) / 2;
  const widest = Math.max(...lines.map(span)) * size;
  const slots: Record<string, string | number> = { size: r1(size), lift: r1(size * 0.35) };
  let i = 0;
  lines.forEach((line, j) => {
    let x = 200 - (span(line) * size) / 2;
    for (const e of line) {
      Object.assign(slots, { [`w${i}`]: words[i]!, [`lx${i}`]: r1(x), [`ww${i}`]: r1(e * size), [`x${i}`]: r1(x + (e * size) / 2), [`y${i}`]: r1(base + j * pitch - size * 0.35) });
      x += (e + GAP) * size;
      i++;
    }
  });
  for (; i < WORDS; i++) Object.assign(slots, { [`w${i}`]: "", [`lx${i}`]: 200, [`ww${i}`]: 0, [`x${i}`]: 200, [`y${i}`]: 100 });
  return { slots, count: words.length, size, base, left: 200 - widest / 2, widest };
}

/** A caption word's outline, drawn under its fill: `thickness` ems of its size, the outline colour. */
const OUTLINED = `stroke="{{outline}}" stroke-width="{{strokeW}}" stroke-linejoin="round" paint-order="stroke"`;

/** A caption's frame (see {@link frame}) and outline width, the outline counted in its overhang. */
const captionFrame = (v: Record<string, unknown>, line: ReturnType<typeof captionLine>, top: number) => ({
  ...frame(v, line.left, Math.max(1, line.widest), line.base, line.size, glowing([top, 0, DESCENT, 0], Number(v.thickness) / 2)),
  strokeW: r1(Number(v.thickness) * line.size),
});

/** A slot's start: `i` steps of `every` ms in, or 0 for an unused slot, so empty slots never lengthen the effect. */
const startOf = (i: number, count: number, every: number) => (i < count ? Math.round(i * every) : 0);

export const captionWordBounce: VectorEffect = {
  kind: "vector",
  id: "caption-word-bounce",
  name: "Word bounce",
  description: "A caption's words spring up one after another, each overshooting in scale with an elastic wobble before it settles.",
  category: "text",
  tags: ["caption", "subtitle", "text", "kinetic", "typography", "social", "words", "bounce"],
  hold: 1200,
  presets: [
    { name: "Bubblegum", values: { background: [1, 0.42, 0.7], ink: [1, 1, 1], outline: [0.35, 0.05, 0.3], overshoot: 1.3 } },
    { name: "Clean", values: { background: [0.97, 0.97, 0.96], ink: [0.08, 0.08, 0.1], thickness: 0, stagger: 90, overshoot: 1.08 } },
    { name: "Lime pop", values: { background: [0.05, 0.05, 0.06], ink: [0.75, 1, 0.2], outline: [0, 0, 0], stagger: 160 } },
  ],
  derived: (v) => {
    const line = captionLine(v, 64);
    const stagger = Number(v.stagger);
    const out: Record<string, string | number> = { ...line.slots, ...captionFrame(v, line, 0.15 + (Number(v.overshoot) - 1) * 0.6), drop: r1(line.size * 0.5) };
    for (let i = 0; i < WORDS; i++) {
      out[`d${i}`] = startOf(i, line.count, stagger);
      out[`e${i}`] = Number(out[`d${i}`]) + 260;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Words that bounce into place' label='Text'}} {{background: color default=#1E1B4B label='Background'}} {{ink: color default=#FFFFFF label='Text colour'}} {{outline: color default=#000000 label='Outline'}} {{thickness: float min=0 max=0.2 default=0.08 step=0.01 label='Outline width (em)'}} {{stagger: float min=30 max=600 default=120 step=10 label='Ms between words'}} {{overshoot: float min=1 max=1.5 default=1.15 step=0.05 label='Overshoot'}} ${typeface(HEAVY, 900)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/>${Array.from(
      { length: WORDS },
      (_, i) =>
        `<text id="bw${i}" x="0" y="{{lift}}" text-anchor="middle" textLength="{{ww${i}}}" lengthAdjust="spacingAndGlyphs" transform="translate({{x${i}}} {{y${i}}}) translate(0 {{drop}}) scale(0.3)" opacity="0" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}" ${OUTLINED}>{{w${i}}}</text>`,
    ).join("")}</svg>`,
    animate: Array.from({ length: WORDS }, (_, i): SvgAnimation[] => [
      {
        id: `bw${i}`,
        attrs: { transform: [`translate({{x${i}}} {{y${i}}}) translate(0 {{drop}}) scale(0.3)`, `translate({{x${i}}} {{y${i}}}) translate(0 0) scale({{overshoot}})`], opacity: [0, 1] },
        delay: n(`d${i}`),
        ms: 260,
        ease: "out",
      },
      // An underdamped spring back to rest: it dips under full size and wobbles before it settles.
      { id: `bw${i}`, attrs: { transform: [`translate({{x${i}}} {{y${i}}}) translate(0 0) scale({{overshoot}})`, `translate({{x${i}}} {{y${i}}}) translate(0 0) scale(1)`] }, delay: n(`e${i}`), ms: 700, ease: { spring: { stiffness: 320, damping: 11 } } },
    ]).flat(),
  },
};

/** Karaoke sweep's lead-in: the line shows, then the sweep starts. */
const KARAOKE_LEAD = 400;

export const captionKaraoke: VectorEffect = {
  kind: "vector",
  id: "caption-karaoke",
  name: "Karaoke sweep",
  description: "A caption shown whole in an outlined base colour, with a highlight colour wiping left to right across it a word at a time, like karaoke lyrics.",
  category: "text",
  tags: ["caption", "subtitle", "text", "kinetic", "typography", "karaoke", "lyrics", "highlight", "social"],
  hold: 1000,
  presets: [
    { name: "Gold", values: { background: [0.04, 0.06, 0.13], active: [0.98, 0.8, 0.08], base: [1, 1, 1], outline: [0, 0, 0] } },
    { name: "Neon", values: { background: [0.07, 0.02, 0.12], active: [1, 0.25, 0.65], base: [0.85, 0.95, 1], outline: [0.2, 0.05, 0.35], pace: 280 } },
    { name: "Ink on paper", values: { background: [0.98, 0.96, 0.92], active: [0.85, 0.15, 0.2], base: [0.15, 0.15, 0.17], thickness: 0 } },
  ],
  // Each word twice: the base copy, and a highlighted copy over it, clipped to a window that opens across the word in its turn.
  derived: (v) => {
    const line = captionLine(v, 60);
    const pace = Number(v.pace);
    const pad = line.size * (0.1 + Number(v.thickness));
    const out: Record<string, string | number> = { ...line.slots, ...captionFrame(v, line, 0.1), pace: Math.round(pace), clipH: r1(line.size * 1.6) };
    for (let i = 0; i < WORDS; i++) {
      out[`cx${i}`] = r1(Number(out[`lx${i}`]) - pad);
      out[`cy${i}`] = r1(Number(out[`y${i}`]) - line.size * 0.8);
      out[`cw${i}`] = i < line.count ? r1(Number(out[`ww${i}`]) + 2 * pad) : 0;
      out[`d${i}`] = KARAOKE_LEAD + startOf(i, line.count, pace);
    }
    return out;
  },
  motion: ((): SvgMotion => {
    const word = (i: number, fill: string) =>
      `x="{{lx${i}}}" y="{{y${i}}}" dy="{{lift}}" textLength="{{ww${i}}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="${fill}" ${OUTLINED}`;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Sing along with every word' label='Text'}} {{background: color default=#0B1020 label='Background'}} {{base: color default=#FFFFFF label='Base colour'}} {{active: color default=#FACC15 label='Highlight'}} {{outline: color default=#000000 label='Outline'}} {{thickness: float min=0 max=0.2 default=0.1 step=0.01 label='Outline width (em)'}} {{pace: float min=80 max=1500 default=380 step=10 label='Ms per word'}} ${typeface(HEAVY, 900)} --><defs>${Array.from(
        { length: WORDS },
        (_, i) => `<clipPath id="kclip${i}"><rect id="kc${i}" x="{{cx${i}}}" y="{{cy${i}}}" width="0" height="{{clipH}}"/></clipPath>`,
      ).join("")}</defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><g id="kline" opacity="0">${Array.from({ length: WORDS }, (_, i) => `<text ${word(i, "{{base}}")}>{{w${i}}}</text>`).join("")}${Array.from(
        { length: WORDS },
        (_, i) => `<text clip-path="url(#kclip${i})" ${word(i, "{{active}}")}>{{w${i}}}</text>`,
      ).join("")}</g></svg>`,
      animate: [
        { id: "kline", attrs: { opacity: [0, 1] }, ms: 300, ease: "out" },
        ...Array.from({ length: WORDS }, (_, i): SvgAnimation => ({ id: `kc${i}`, attrs: { width: [0, n(`cw${i}`)] }, delay: n(`d${i}`), ms: n("pace"), ease: "linear" })),
      ],
    };
  })(),
};

export const captionPop: VectorEffect = {
  kind: "vector",
  id: "caption-pop",
  name: "Word pop",
  description: "Social-video captions: each word in turn pops on from small with a quick tilt, then snaps to rest, lit in a highlight colour until the next word lands. Earlier words stay.",
  category: "text",
  tags: ["caption", "subtitle", "text", "kinetic", "typography", "social", "reels", "tiktok", "pop"],
  hold: 1200,
  presets: [
    { name: "Reels", values: { background: [0.09, 0.09, 0.11], ink: [1, 1, 1], active: [0.13, 0.83, 0.93], outline: [0, 0, 0] } },
    { name: "Hype", values: { background: [0.45, 0.1, 0.95], ink: [1, 1, 1], active: [1, 0.9, 0.1], outline: [0.1, 0, 0.25], pace: 220 } },
    { name: "Calm", values: { background: [0.96, 0.94, 0.9], ink: [0.12, 0.12, 0.14], active: [0.12, 0.12, 0.14], thickness: 0, pace: 450 } },
  ],
  // Tilts alternate, -4° then +4°, so a run of words does not lean one way.
  derived: (v) => {
    const line = captionLine(v, 64);
    const pace = Number(v.pace);
    const out: Record<string, string | number> = { ...line.slots, ...captionFrame(v, line, 0.2) };
    for (let i = 0; i < WORDS; i++) {
      const d = startOf(i, line.count, pace);
      Object.assign(out, { [`d${i}`]: d, [`e${i}`]: d + 120, [`f${i}`]: i < line.count ? Math.round((i + 1) * pace) : 0, [`t${i}`]: i % 2 ? 4 : -4 });
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='Captions that pop on every word' label='Text'}} {{background: color default=#18181B label='Background'}} {{ink: color default=#FFFFFF label='Text colour'}} {{active: color default=#22D3EE label='Current word'}} {{outline: color default=#000000 label='Outline'}} {{thickness: float min=0 max=0.2 default=0.08 step=0.01 label='Outline width (em)'}} {{pace: float min=80 max=1500 default=320 step=10 label='Ms per word'}} ${typeface(HEAVY, 900)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/>${Array.from(
      { length: WORDS },
      (_, i) =>
        `<text id="pw${i}" x="0" y="{{lift}}" text-anchor="middle" textLength="{{ww${i}}}" lengthAdjust="spacingAndGlyphs" transform="translate({{x${i}}} {{y${i}}}) rotate({{t${i}}}) scale(0.2)" opacity="0" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{active}}" ${OUTLINED}>{{w${i}}}</text>`,
    ).join("")}</svg>`,
    animate: Array.from({ length: WORDS }, (_, i): SvgAnimation[] => [
      {
        id: `pw${i}`,
        attrs: { transform: [`translate({{x${i}}} {{y${i}}}) rotate({{t${i}}}) scale(0.2)`, `translate({{x${i}}} {{y${i}}}) rotate({{t${i}}}) scale(1.12)`], opacity: [0, 1] },
        delay: n(`d${i}`),
        ms: 120,
        ease: "out",
      },
      { id: `pw${i}`, attrs: { transform: [`translate({{x${i}}} {{y${i}}}) rotate({{t${i}}}) scale(1.12)`, `translate({{x${i}}} {{y${i}}}) rotate(0) scale(1)`] }, delay: n(`e${i}`), ms: 140, ease: "out" },
      // Lit while it is the newest word, then the plain text colour.
      ...holds(`pw${i}`, "fill", [
        [n(`d${i}`), "{{active}}"],
        [n(`f${i}`), "{{ink}}"],
      ]),
    ]).flat(),
  },
};

/** Possessed text's letter slots, and when its letters start writhing and snap back (ms). */
const POSSESSED_SLOTS = 20;
const WRITHE_AT = 600;
const SNAP_AT = 3000;

export const possessedText: VectorEffect = {
  kind: "vector",
  id: "possessed-text",
  name: "Possessed text",
  description:
    "A title that something takes hold of: its letters writhe, twist and float up out of line behind a blood-red haze, then snap back into place all at once as if nothing happened.",
  category: "horror",
  tags: ["horror", "spectral", "text", "title", "possessed", "creepy", "halloween", "kinetic"],
  hold: 900,
  presets: [
    { name: "Ectoplasm", values: { ink: [0.85, 1, 0.88], aura: [0.25, 0.95, 0.45], background: [0.02, 0.05, 0.04] } },
    { name: "Parchment", values: { background: [0.93, 0.89, 0.8], ink: [0.12, 0.08, 0.06], aura: [0.55, 0.05, 0.05] } },
    { name: "Violent", values: { amount: 1.8 } },
    { name: "Uneasy", values: { amount: 0.4 } },
  ],
  // Up to POSSESSED_SLOTS letters, each centred in its estimated advance, each with its own writhe and rise.
  derived: (v) => {
    const letters = lettersOf(v.text).slice(0, POSSESSED_SLOTS);
    const widths = letters.map((c) => textWidthEm(c));
    const ems = Math.max(0.6, widths.reduce((a, b) => a + b, 0));
    const size = Math.min(92, room(v, 360) / ems);
    const base = 100 + size * 0.35;
    const a = Number(v.amount);
    const out: Record<string, string | number> = {
      ...frame(v, 200 - (ems * size) / 2, ems * size, base, size, glowing([0.15 + 0.45 * a, 0.1 * a, DESCENT + 0.15 * a, 0.1 * a], 0.06)),
      size: r1(size),
      base: r1(base),
      length: r1(ems * size),
      haze: r1(size * 0.09),
    };
    let x = 200 - (ems * size) / 2;
    for (let i = 0; i < POSSESSED_SLOTS; i++) {
      const w = (widths[i] ?? 0) * size;
      const cx = x + w / 2;
      // Every third letter floats right up; the rest only lift a little.
      const rise = (i % 3 === 1 ? 0.45 : 0.08 + 0.06 * (i % 2)) * size * a;
      out[`c${i}`] = letters[i]?.trim() ?? "";
      out[`x${i}`] = r1(cx);
      out[`wx${i}`] = r1(cx + 0.12 * size * a);
      out[`wy${i}`] = r1(base - 0.14 * size * a);
      out[`wr${i}`] = r1((i % 2 ? 24 : -20) * a);
      out[`ws${i}`] = r1(1 + 0.18 * a);
      out[`rise${i}`] = `translate(0 ${r1(-rise)})`;
      x += w;
    }
    return out;
  },
  motion: (() => {
    const rest = (i: number) => `translate({{x${i}}} {{base}}) rotate(0) scale(1)`;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='GET OUT' label='Text'}} {{background: color default=#0B0708 label='Background'}} {{ink: color default=#E8E2D6 label='Text colour'}} {{aura: color default=#B3121B label='Haze'}} {{amount: float min=0 max=2 default=1 step=0.1 label='Intensity'}} ${typeface(`Georgia, 'Times New Roman', serif`, 700)} --><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/><text id="aura" x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{aura}}" stroke="{{aura}}" stroke-width="{{haze}}" stroke-linejoin="round" opacity="0" transform="translate(0 0)">{{text}}</text><g id="word" transform="translate(200 {{base}}) scale(1) translate(-200 -{{base}})">${Array.from(
        { length: POSSESSED_SLOTS },
        (_, i) =>
          `<g id="f${i}" transform="translate(0 0)"><text id="l${i}" text-anchor="middle" transform="${rest(i)}" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{ink}}">{{c${i}}}</text></g>`,
      ).join("")}</g></svg>`,
      animate: [
        // The haze swells behind the word and shudders while it writhes, then is gone at the snap.
        { id: "aura", attrs: { opacity: [0, 0.65] }, delay: WRITHE_AT, ms: 500, ease: "out" },
        { id: "aura", attrs: { transform: ["translate(0 0)", "translate(6 -4)"] }, delay: WRITHE_AT, ms: SNAP_AT - WRITHE_AT, behavior: { type: "wriggle", frequency: 6, seed: 3 } },
        { id: "aura", attrs: { opacity: [0.65, 0] }, delay: SNAP_AT, ms: 90, ease: "out" },
        ...Array.from({ length: POSSESSED_SLOTS }, (_, i): SvgAnimation[] => [
          // Each letter writhes on its own: drifting, twisting and swelling round its place.
          {
            id: `l${i}`,
            attrs: { transform: [rest(i), `translate({{wx${i}}} {{wy${i}}}) rotate({{wr${i}}}) scale({{ws${i}}})`] },
            delay: WRITHE_AT + (i % 4) * 60,
            ms: SNAP_AT - WRITHE_AT - (i % 4) * 60,
            behavior: { type: "wriggle", frequency: 2.4 + 0.3 * (i % 3), octaves: 2, seed: 11 + i * 7 },
          },
          // Some float up out of line, and all drop back at once.
          { id: `f${i}`, attrs: { transform: ["translate(0 0)", `{{rise${i}}}`] }, delay: WRITHE_AT + 200 + (i % 5) * 120, ms: 1300, ease: "in-out" },
          { id: `f${i}`, attrs: { transform: [`{{rise${i}}}`, "translate(0 0)"] }, delay: SNAP_AT, ms: 110, ease: [0.55, 0, 1, 0.45] },
        ]).flat(),
        // The snap: the whole word jolts as the letters slam home.
        { id: "word", attrs: { transform: ["translate(200 {{base}}) scale(1) translate(-200 -{{base}})", "translate(200 {{base}}) scale(1.07) translate(-200 -{{base}})"] }, delay: SNAP_AT + 60, ms: 50, ease: "out" },
        { id: "word", attrs: { transform: ["translate(200 {{base}}) scale(1.07) translate(-200 -{{base}})", "translate(200 {{base}}) scale(1) translate(-200 -{{base}})"] }, delay: SNAP_AT + 110, ms: 220, ease: "out" },
      ],
    };
  })(),
};

/** Rune glow's letter slots. */
const RUNE_SLOTS = 20;

export const runeGlow: VectorEffect = {
  kind: "vector",
  id: "rune-glow",
  name: "Rune glow",
  description:
    "A word carved into dark stone, its letters lighting up one after another with an inner glow as if a spell were being read, pulsing together once all are lit, then fading back into the stone.",
  category: "horror",
  tags: ["horror", "occult", "text", "title", "runes", "carved", "glow", "magic", "fantasy"],
  hold: 700,
  presets: [
    { name: "Hellfire", values: { glow: [1, 0.42, 0.1] } },
    { name: "Elder green", values: { glow: [0.45, 1, 0.6], stone: [0.06, 0.08, 0.07] } },
    { name: "Marble", values: { stone: [0.85, 0.84, 0.8], carved: [0.55, 0.53, 0.5], glow: [0.3, 0.55, 1] } },
  ],
  derived: (v) => {
    const letters = lettersOf(v.text).slice(0, RUNE_SLOTS);
    const widths = letters.map((c) => textWidthEm(c) * 1.1);
    const ems = Math.max(0.6, widths.reduce((a, b) => a + b, 0));
    const size = Math.min(84, room(v, 360) / ems);
    const base = 100 + size * 0.35;
    const stagger = Number(v.stagger);
    const lit = letters.filter((c) => c.trim()).length;
    const out: Record<string, string | number> = {
      ...frame(v, 200 - (ems * size) / 2, ems * size, base, size, glowing([0.05, 0, DESCENT, 0], 0.15)),
      size: r1(size),
      base: r1(base),
      bevel: r1(Math.max(1, size * 0.025)),
      halo: r1(size * 0.08),
      pulseAt: Math.round(Math.max(1, lit) * stagger + 300),
      fadeAt: Math.round(Math.max(1, lit) * stagger + 1500),
    };
    let x = 200 - (ems * size) / 2;
    let k = 0;
    for (let i = 0; i < RUNE_SLOTS; i++) {
      const w = (widths[i] ?? 0) * size;
      const c = letters[i]?.trim() ?? "";
      out[`c${i}`] = c;
      out[`x${i}`] = r1(x + w / 2);
      out[`d${i}`] = Math.round(k * stagger);
      if (c) k += 1;
      x += w;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='NOX AETERNA' label='Text'}} {{stone: color default=#17151A label='Stone'}} {{carved: color default=#0A090C label='Carving'}} {{edge: color default=#3B3740 label='Carved edge'}} {{glow: color default=#7FD4FF label='Glow'}} {{stagger: float min=40 max=400 default=140 step=10 label='Ms between letters'}} ${typeface(`'Cinzel', 'Trajan Pro', Georgia, serif`, 700)} --><rect width="400" height="200" fill="{{stone}}" opacity="{{backdrop}}"/><g id="runes">${Array.from(
      { length: RUNE_SLOTS },
      (_, i) =>
        `<text x="{{x${i}}}" y="{{base}}" dx="{{bevel}}" dy="{{bevel}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{edge}}">{{c${i}}}</text><text x="{{x${i}}}" y="{{base}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{carved}}">{{c${i}}}</text><text id="g${i}" x="{{x${i}}}" y="{{base}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" fill="{{glow}}" stroke="{{glow}}" stroke-width="{{halo}}" stroke-opacity="0.35" stroke-linejoin="round" opacity="0">{{c${i}}}</text>`,
    ).join("")}</g></svg>`,
    animate: [
      // Each letter kindles in turn, flaring a little past full before it settles.
      ...Array.from({ length: RUNE_SLOTS }, (_, i): SvgAnimation[] => [
        { id: `g${i}`, attrs: { opacity: [0, 1] }, delay: n(`d${i}`), ms: 260, ease: "out" },
      ]).flat(),
      // All of them pulse together, then sink back into the stone.
      { id: "runes", attrs: { opacity: [1, 0.55] }, delay: n("pulseAt"), ms: 300, repeat: 2, alternate: true },
      ...Array.from({ length: RUNE_SLOTS }, (_, i): SvgAnimation => ({ id: `g${i}`, attrs: { opacity: [1, 0] }, delay: n("fadeAt"), ms: 700, ease: "in-out" })),
    ],
  },
};

/** Bleeding text's drips: where along the word (a share of its width), how wide and how long (shares of its size). */
const BLEEDS = [
  { at: 0.09, w: 0.07, len: 0.55 },
  { at: 0.27, w: 0.05, len: 0.9 },
  { at: 0.46, w: 0.08, len: 0.45 },
  { at: 0.64, w: 0.05, len: 1.1 },
  { at: 0.85, w: 0.065, len: 0.7 },
];
/** When the blood starts seeping down, the drips run, the drops fall and it all fades (ms). */
const SEEP_AT = 300;
const DRIP_AT = 1000;
const DROP_AT = 2300;
const CLEAR_AT = 3600;

export const bleedingText: VectorEffect = {
  kind: "vector",
  id: "bleeding-text",
  name: "Bleeding text",
  description:
    "A title that starts to bleed: blood seeps down through its letters from the top, drips run from its baseline and swell, a few drops fall, then it all fades back to clean letters.",
  category: "horror",
  tags: ["horror", "gore", "text", "title", "blood", "drip", "halloween"],
  hold: 900,
  presets: [
    { name: "On white", values: { background: [0.97, 0.95, 0.92], ink: [0.1, 0.08, 0.08] } },
    { name: "Black blood", values: { blood: [0.06, 0.04, 0.05], ink: [0.86, 0.12, 0.14] } },
    { name: "Ichor", values: { blood: [0.3, 0.75, 0.15] } },
  ],
  derived: (v) => {
    const { size, length, left } = fit(String(v.text), room(v, 340), 104);
    const base = 92 + size * 0.36;
    const top = base - size * CAP;
    return {
      ...frame(v, left, length, base, size, [0.05, 0, 1.25, 0]),
      size,
      length,
      base: r1(base),
      top: r1(top - 2),
      cap: r1(size * CAP + 4),
      ...Object.fromEntries(
        BLEEDS.flatMap((d, i) => [
          [`bx${i}`, r1(left + d.at * length)],
          [`bw${i}`, r1(d.w * size)],
          [`bl${i}`, r1(d.len * size)],
          [`by${i}`, r1(base + d.len * size)],
          [`br${i}`, r1(d.w * size * 0.75)],
          [`bd${i}`, r1(base + d.len * size + size * 0.9)],
        ]),
      ),
    };
  },
  motion: (() => {
    const word = (paint: string) =>
      `<text x="200" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="{{weight}}" ${paint}>{{text}}</text>`;
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{text: text default='BLEED' label='Text'}} {{background: color default=#0D0A0B label='Background'}} {{ink: color default=#EEE7DE label='Text colour'}} {{blood: color default=#8A0913 label='Blood'}} ${typeface(HEAVY, 900)} --><defs><clipPath id="seepClip"><rect id="seep" x="-5000" y="{{top}}" width="10400" height="0"/></clipPath></defs><rect width="400" height="200" fill="{{background}}" opacity="{{backdrop}}"/>${word(`fill="{{ink}}"`)}<g id="bleeding" opacity="1"><g clip-path="url(#seepClip)">${word(`fill="{{blood}}"`)}</g>${BLEEDS.map(
        (_, i) =>
          `<rect id="stem${i}" x="{{bx${i}}}" y="{{base}}" width="{{bw${i}}}" height="0" rx="{{br${i}}}" transform="translate(-{{br${i}}} -4)" fill="{{blood}}"/><circle id="bead${i}" cx="{{bx${i}}}" cy="{{base}}" r="0" fill="{{blood}}"/>`,
      ).join("")}${[1, 3].map((i) => `<circle id="drop${i}" cx="{{bx${i}}}" cy="{{by${i}}}" r="0" fill="{{blood}}"/>`).join("")}</g></svg>`,
      animate: [
        // Blood seeps down through the letters from their tops.
        { id: "seep", attrs: { height: [0, n("cap")] }, delay: SEEP_AT, ms: 1300, ease: "in-out" },
        // Drips run down from the baseline, each at its own pace, swelling at the tip.
        ...BLEEDS.flatMap((_, i): SvgAnimation[] => {
          const at = DRIP_AT + i * 170;
          const ms = 1400 + (i % 3) * 250;
          return [
            { id: `stem${i}`, attrs: { height: [0, n(`bl${i}`)] }, delay: at, ms, ease: "out" },
            { id: `bead${i}`, attrs: { cy: [n("base"), n(`by${i}`)], r: [0, n(`bw${i}`)] }, delay: at, ms, ease: "out" },
          ];
        }),
        // Two drops fall from the longest drips.
        ...[1, 3].flatMap((i, k): SvgAnimation[] => [
          { id: `drop${i}`, attrs: { r: [0, n(`br${i}`)] }, delay: DROP_AT + k * 300, ms: 120, ease: "out" },
          { id: `drop${i}`, attrs: { cy: [n(`by${i}`), n(`bd${i}`)] }, delay: DROP_AT + k * 300 + 120, ms: 420, ease: [0.55, 0, 1, 0.45] },
          { id: `drop${i}`, attrs: { r: [n(`br${i}`), 0] }, delay: DROP_AT + k * 300 + 420, ms: 120 },
        ]),
        // Then it all fades, and is reset unseen.
        { id: "bleeding", attrs: { opacity: [1, 0] }, delay: CLEAR_AT, ms: 700, ease: "in-out" },
        ...holds("seep", "height", [[CLEAR_AT + 700, 0]]),
        ...BLEEDS.flatMap((_, i) => [...holds(`stem${i}`, "height", [[CLEAR_AT + 700, 0]]), ...holds(`bead${i}`, "r", [[CLEAR_AT + 700, 0]])]),
        ...[1, 3].flatMap((i) => holds(`drop${i}`, "cy", [[CLEAR_AT + 700, n(`by${i}`)]])),
        ...holds("bleeding", "opacity", [[CLEAR_AT + 701, 1]]),
      ],
    };
  })(),
};

export const textEffects: VectorEffect[] = [
  typewriter,
  scrambleText,
  kineticStagger,
  captionWordBounce,
  captionKaraoke,
  captionPop,
  neonSign,
  strokeDrawText,
  splitReveal,
  highlighter,
  wordCycle,
  liquidFill,
  glitchText,
  extrudedText,
  textOnPath,
  circleText,
  possessedText,
  runeGlow,
  bleedingText,
];
