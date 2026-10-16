import { morphSequence } from "../vector/morph.js";
import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Broadcast graphics: lower thirds, titles, logo reveals, end cards, a
 * countdown, a subscribe button, a ticker and a score bug. Every picture is
 * a 1920 × 1080 frame (16:9) with its text and boxes inside the title-safe
 * area (10% in from each edge: x 192–1728, y 108–972), so it lays over
 * video as it is. Overlays (lower thirds, the ticker, the score bug) are
 * transparent; full-frame cards draw their own background.
 *
 * Each animates in, holds for its `hold` control (seconds) and animates out,
 * ending as it started, so it loops cleanly. The out changes are timed from
 * when the hold ends: `{{out250}}` is 250 ms after it (see `outTimes`).
 * Text is fitted from its length (`textWidthEm`) and stretched to the width
 * that predicts with `textLength`, so bars and boxes fit any words in any font.
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/** @internal One decimal. */
export const r1 = (v: number) => Math.round(v * 10) / 10;

/** @internal A derived number in an animation's numeric field (`ms`, `delay`, `count`). */
export const n = (name: string) => `{{${name}}}` as unknown as number;

/** @internal A clean sans-serif, the broadcast default. */
export const SANS = `'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif`;

/** @internal Text fitted to `width` units, at most `max` high: its font size and its width at that size. */
export function fit(text: unknown, width: number, max: number) {
  const em = Math.max(0.6, textWidthEm(String(text ?? "")));
  const size = Math.min(max, width / em);
  return { size: r1(size), width: r1(em * size) };
}

/** @internal Seconds as whole ms. */
export const ms = (seconds: unknown) => Math.round(Math.max(0, Number(seconds) || 0) * 1000);

/** @internal The `hold` control: seconds to rest between animating in and out. */
export const holdControl = (seconds: number, label = "Hold (s)") => `{{hold: float min=0.5 max=20 default=${seconds} step=0.5 label='${label}'}}`;

/** @internal The delay `k` ms after the hold ends (filled by {@link outTimes}). */
export const after = (k: number) => n(`out${k}`);

/**
 * @internal The out delays a motion uses (every `{{outK}}`, see {@link after}),
 * `start` being when its hold ends.
 */
export function outTimes(motion: SvgMotion, start: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [, k] of JSON.stringify(motion).matchAll(/\{\{out(\d+)\}\}/g)) out[`out${k}`] = Math.round(start + Number(k));
  return out;
}

/** @internal Instant changes: the attribute holds each value from its time on. */
export const holds = (id: string, attr: string, keys: readonly (readonly [number, string | number])[]): SvgAnimation[] =>
  keys.map(([delay, value]) => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 }));

/** @internal A scale pop with overshoot: 0 → `over` → 1, starting at `delay`. */
export function pop(id: string, delay: number, over = 1.12, ms = 300): SvgAnimation[] {
  return [
    { id, attrs: { transform: ["scale(0)", `scale(${over})`] }, delay, ms, ease: "out" },
    { id, attrs: { transform: [`scale(${over})`, "scale(1)"] }, delay: delay + ms, ms: 160, ease: "in-out" },
  ];
}

// ── Logo marks ─────────────────────────────────────────────────────────

/** A hexagonal ring, the stand-in mark, in a 24 box. */
export const MARK = "M12 1.5 L21.5 7 V17 L12 22.5 L2.5 17 V7 Z M12 6.5 L7 9.4 V14.6 L12 17.5 L17 14.6 V9.4 Z";

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/**
 * @internal A logo's path data placed in `box` ([x, y, width, height]): the
 * path as given (or `fallback` when it cannot be read) and the transform that
 * centres it there at the largest size that fits. The path itself is kept, so
 * curves stay curves; its extent comes from `morphSequence`'s outline.
 */
export function placeMark(d: unknown, box: readonly [number, number, number, number], fallback = MARK) {
  for (const path of [String(d ?? ""), fallback]) {
    let nums: number[];
    try {
      nums = (morphSequence([path], { points: 128 })[0]!.match(NUMBER) ?? []).map(Number);
    } catch {
      continue;
    }
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const [w, h] = [x1 - x0, y1 - y0];
    if (![x0, x1, y0, y1].every(Number.isFinite) || Math.max(w, h) < 1e-6) continue;
    const s = Math.min(box[2] / Math.max(w, 1e-6), box[3] / Math.max(h, 1e-6));
    const ox = box[0] + (box[2] - w * s) / 2;
    const oy = box[1] + (box[3] - h * s) / 2;
    return { d: path, transform: `translate(${r2(ox)} ${r2(oy)}) scale(${+s.toPrecision(4)}) translate(${r2(-x0)} ${r2(-y0)})`, scale: s };
  }
  return { d: fallback, transform: "", scale: 1 };
}

const markControl = (label = "Logo path") => `{{logo: text default='${MARK}' label='${label}'}}`;

// ── Lower third ────────────────────────────────────────────────────────

const lowerThirdMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{name: text default='Ada Lovelace' label='Name'}} {{title: text default='Mathematician and writer' label='Title'}} {{plate: color default=#0F2742 label='Name bar'}} {{ink: color default=#FFFFFF label='Name colour'}} {{accent: color default=#3B82F6 label='Accent stripe'}} {{titlePlate: color default=#FFFFFF label='Title bar'}} {{titleInk: color default=#0F2742 label='Title colour'}} {{plateOpacity: float min=0 max=1 default=1 step=0.05 label='Bar opacity'}} {{skew: float min=-20 max=20 default=0 step=1 label='Slant'}} {{shadow: float min=0 max=1 default=0.35 step=0.05 label='Shadow'}} ${holdControl(3)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="lowerThirdNameClip"><rect x="206" y="792" width="1600" height="96"/></clipPath><clipPath id="lowerThirdTitleClip"><rect x="206" y="888" width="1600" height="60"/></clipPath><filter id="lowerThirdShadow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="{{shadow}}"/></filter></defs><g transform="translate(192 870) skewX({{skew}}) translate(-192 -870)" filter="url(#lowerThirdShadow)"><rect id="lowerThirdNameBar" x="206" y="792" width="0" height="96" fill="{{plate}}" fill-opacity="{{plateOpacity}}"/><rect id="lowerThirdTitleBar" x="206" y="888" width="0" height="60" fill="{{titlePlate}}" fill-opacity="{{plateOpacity}}"/><g clip-path="url(#lowerThirdNameClip)"><text id="lowerThirdName" x="238" y="{{nameBase}}" transform="translate({{nameHide}} 0)" font-family="{{font}}" font-size="{{nameSize}}" font-weight="700" textLength="{{nameW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{name}}</text></g><g clip-path="url(#lowerThirdTitleClip)"><text id="lowerThirdTitle" x="230" y="{{titleBase}}" transform="translate({{titleHide}} 0)" font-family="{{font}}" font-size="{{titleSize}}" font-weight="500" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{titleInk}}">{{title}}</text></g><rect id="lowerThirdStripe" x="192" y="870" width="14" height="0" fill="{{accent}}"/></g></svg>`,
  animate: [
    { id: "lowerThirdStripe", attrs: { y: [870, 792], height: [0, 156] }, ms: 350, ease: "out" },
    { id: "lowerThirdNameBar", attrs: { width: [0, n("nameBar")] }, delay: 150, ms: 500, ease: "out" },
    { id: "lowerThirdName", attrs: { transform: ["translate({{nameHide}} 0)", "translate(0 0)"] }, delay: 300, ms: 550, ease: "out" },
    { id: "lowerThirdTitleBar", attrs: { width: [0, n("titleBar")] }, delay: 400, ms: 450, ease: "out" },
    { id: "lowerThirdTitle", attrs: { transform: ["translate({{titleHide}} 0)", "translate(0 0)"] }, delay: 500, ms: 500, ease: "out" },
    { id: "lowerThirdName", attrs: { transform: ["translate(0 0)", "translate({{nameHide}} 0)"] }, delay: after(0), ms: 400 },
    { id: "lowerThirdTitle", attrs: { transform: ["translate(0 0)", "translate({{titleHide}} 0)"] }, delay: after(80), ms: 400 },
    { id: "lowerThirdTitleBar", attrs: { width: [n("titleBar"), 0] }, delay: after(250), ms: 400 },
    { id: "lowerThirdNameBar", attrs: { width: [n("nameBar"), 0] }, delay: after(300), ms: 400 },
    { id: "lowerThirdStripe", attrs: { y: [792, 870], height: [156, 0] }, delay: after(650), ms: 300 },
  ],
};

export const lowerThird: VectorEffect = {
  kind: "vector",
  id: "lower-third",
  name: "Lower third",
  description: "A name bar and a title bar sliding out from an accent stripe in the lower left, holding, then sliding back.",
  category: "broadcast",
  tags: ["broadcast", "lower-third", "name", "caption", "title", "news", "overlay"],
  hold: 300,
  presets: [
    { name: "Corporate", values: { plate: [0.06, 0.15, 0.26], accent: [0.23, 0.51, 0.96], titlePlate: [1, 1, 1], titleInk: [0.06, 0.15, 0.26] } },
    { name: "News", values: { plate: [0.73, 0.11, 0.11], accent: [0.98, 0.8, 0.08], titlePlate: [0.07, 0.09, 0.15], titleInk: [1, 1, 1] } },
    { name: "Sport", values: { plate: [0.07, 0.07, 0.07], accent: [0.64, 0.9, 0.21], titlePlate: [0.64, 0.9, 0.21], titleInk: [0.07, 0.07, 0.07], skew: -12 } },
    { name: "Minimal", values: { plateOpacity: 0, accent: [1, 1, 1], titleInk: [1, 1, 1], shadow: 0.7 } },
  ],
  derived: (v) => {
    const name = fit(v.name, 1380, 56);
    const title = fit(v.title, 1380, 32);
    return {
      ...outTimes(lowerThirdMotion, 1000 + ms(v.hold)),
      nameSize: name.size,
      nameW: name.width,
      nameBase: r1(840 + name.size * 0.35),
      nameBar: r1(name.width + 64),
      nameHide: -r1(name.width + 80),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(918 + title.size * 0.35),
      titleBar: r1(title.width + 48),
      titleHide: -r1(title.width + 60),
    };
  },
  motion: lowerThirdMotion,
};

// ── Stacked lower third ────────────────────────────────────────────────

const lowerThirdStackedMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{name: text default='Grace Hopper' label='Name'}} {{title: text default='Rear Admiral · Computer scientist' label='Title'}} ${markControl()} {{plate: color default=#FFFFFF label='Panel'}} {{ink: color default=#111827 label='Name colour'}} {{titleInk: color default=#4B5563 label='Title colour'}} {{accent: color default=#7C3AED label='Logo tile'}} {{logoInk: color default=#FFFFFF label='Logo colour'}} {{corner: float min=0 max=40 default=10 step=1 label='Corner radius'}} {{shadow: float min=0 max=1 default=0.3 step=0.05 label='Shadow'}} ${holdControl(3)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="lowerThirdStackedNameClip"><rect x="360" y="792" width="1400" height="76"/></clipPath><clipPath id="lowerThirdStackedTitleClip"><rect x="360" y="868" width="1400" height="68"/></clipPath><filter id="lowerThirdStackedShadow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="{{shadow}}"/></filter></defs><g filter="url(#lowerThirdStackedShadow)"><rect id="lowerThirdStackedPanel" x="340" y="792" width="0" height="144" rx="{{corner}}" fill="{{plate}}"/><g clip-path="url(#lowerThirdStackedNameClip)"><text id="lowerThirdStackedName" x="396" y="{{nameBase}}" transform="translate(0 80)" font-family="{{font}}" font-size="{{nameSize}}" font-weight="700" textLength="{{nameW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{name}}</text></g><line id="lowerThirdStackedRule" x1="396" y1="868" x2="{{ruleEnd}}" y2="868" stroke="{{accent}}" stroke-width="3" stroke-opacity="0.6"/><g clip-path="url(#lowerThirdStackedTitleClip)"><text id="lowerThirdStackedTitle" x="396" y="{{titleBase}}" transform="translate(0 70)" font-family="{{font}}" font-size="{{titleSize}}" font-weight="500" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{titleInk}}">{{title}}</text></g><g transform="translate(276 864)"><g id="lowerThirdStackedTile" transform="scale(0)"><rect x="-84" y="-84" width="168" height="168" rx="{{corner}}" fill="{{accent}}"/><path d="{{markD}}" transform="{{markT}}" fill="{{logoInk}}" fill-rule="evenodd"/></g></g></g></svg>`,
  animate: [
    ...pop("lowerThirdStackedTile", 0, 1.12),
    { id: "lowerThirdStackedPanel", attrs: { width: [0, n("panel")] }, delay: 300, ms: 550, ease: "out" },
    { id: "lowerThirdStackedName", attrs: { transform: ["translate(0 80)", "translate(0 0)"] }, delay: 550, ms: 450, ease: "out" },
    { id: "lowerThirdStackedRule", draw: true, delay: 650, ms: 450, ease: "out" },
    { id: "lowerThirdStackedTitle", attrs: { transform: ["translate(0 70)", "translate(0 0)"] }, delay: 700, ms: 450, ease: "out" },
    { id: "lowerThirdStackedTitle", attrs: { transform: ["translate(0 0)", "translate(0 70)"] }, delay: after(0), ms: 350 },
    { id: "lowerThirdStackedName", attrs: { transform: ["translate(0 0)", "translate(0 80)"] }, delay: after(80), ms: 350 },
    { id: "lowerThirdStackedRule", draw: [1, 0], delay: after(100), ms: 300 },
    { id: "lowerThirdStackedPanel", attrs: { width: [n("panel"), 0] }, delay: after(300), ms: 450 },
    { id: "lowerThirdStackedTile", attrs: { transform: ["scale(1)", "scale(0)"] }, delay: after(650), ms: 300 },
  ],
};

export const lowerThirdStacked: VectorEffect = {
  kind: "vector",
  id: "lower-third-stacked",
  name: "Stacked lower third",
  description: "A logo tile popping in, then a panel sliding out from behind it with a name over a title, divided by a drawn rule.",
  category: "broadcast",
  tags: ["broadcast", "lower-third", "name", "logo", "caption", "overlay"],
  hold: 300,
  presets: [
    { name: "Clean", values: { plate: [1, 1, 1], ink: [0.07, 0.09, 0.15], accent: [0.49, 0.23, 0.93] } },
    { name: "Night", values: { plate: [0.07, 0.09, 0.15], ink: [1, 1, 1], titleInk: [0.62, 0.66, 0.75], accent: [0.13, 0.83, 0.93], logoInk: [0.07, 0.09, 0.15] } },
    { name: "News", values: { plate: [1, 1, 1], ink: [0.07, 0.07, 0.07], accent: [0.8, 0.1, 0.12], corner: 0 } },
  ],
  derived: (v) => {
    const name = fit(v.name, 1300, 52);
    const title = fit(v.title, 1300, 30);
    const mark = placeMark(v.logo, [-52, -52, 104, 104]);
    const inner = Math.max(name.width, title.width, 160);
    return {
      ...outTimes(lowerThirdStackedMotion, 1150 + ms(v.hold)),
      nameSize: name.size,
      nameW: name.width,
      nameBase: r1(834 + name.size * 0.35),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(902 + title.size * 0.35),
      ruleEnd: r1(396 + inner),
      panel: r1(inner + 92),
      markD: mark.d,
      markT: mark.transform,
    };
  },
  motion: lowerThirdStackedMotion,
};

// ── Title card ─────────────────────────────────────────────────────────

const titleCardMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{title: text default='The Long Way Home' label='Title'}} {{subtitle: text default='A film about getting there' label='Subtitle'}} {{background: color default=#0B1020 label='Background'}} {{ink: color default=#F8FAFC label='Title colour'}} {{muted: color default=#94A3B8 label='Subtitle colour'}} {{accent: color default=#F59E0B label='Accent'}} {{wipe: bool default=true label='Wipe out (else fade)'}} ${holdControl(3)} {{font: text default="${SANS}" label='Font'}} --><defs><radialGradient id="titleCardGlow" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.18"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></radialGradient></defs><rect width="1920" height="1080" fill="{{background}}"/><rect width="1920" height="1080" fill="url(#titleCardGlow)"/><g id="titleCardAll" opacity="1"><g id="titleCardTitle" opacity="0" transform="translate(0 40)"><text x="960" y="{{titleBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{titleSize}}" font-weight="800" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{title}}</text></g><line id="titleCardLineL" x1="960" y1="{{lineY}}" x2="{{lineL}}" y2="{{lineY}}" stroke="{{accent}}" stroke-width="5" stroke-linecap="round"/><line id="titleCardLineR" x1="960" y1="{{lineY}}" x2="{{lineR}}" y2="{{lineY}}" stroke="{{accent}}" stroke-width="5" stroke-linecap="round"/><g id="titleCardSubtitle" opacity="0" transform="translate(0 30)"><text x="960" y="{{subBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{subSize}}" font-weight="400" letter-spacing="1" textLength="{{subW}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}">{{subtitle}}</text></g></g><g id="titleCardWipe" transform="translate(-2000 0)"><rect x="0" y="0" width="1920" height="1080" fill="{{background}}"/><rect x="1920" y="0" width="80" height="1080" fill="{{accent}}"/></g></svg>`,
  animate: [
    { id: "titleCardTitle", attrs: { opacity: [0, 1], transform: ["translate(0 40)", "translate(0 0)"] }, ms: 800, ease: "out" },
    { id: "titleCardLineL", draw: true, delay: 450, ms: 650, ease: "in-out" },
    { id: "titleCardLineR", draw: true, delay: 450, ms: 650, ease: "in-out" },
    { id: "titleCardSubtitle", attrs: { opacity: [0, 1], transform: ["translate(0 30)", "translate(0 0)"] }, delay: 750, ms: 700, ease: "out" },
    { id: "titleCardWipe", attrs: { transform: ["translate(-2000 0)", "translate({{wipeTo}} 0)"] }, delay: after(0), ms: 700 },
    { id: "titleCardAll", attrs: { opacity: [1, n("fadeTo")] }, delay: after(0), ms: 700 },
  ],
};

export const titleCard: VectorEffect = {
  kind: "vector",
  id: "title-card",
  name: "Title card",
  description: "A big centred title rising in, a line drawing out from the middle beneath it and a subtitle following, then a wipe or fade out.",
  category: "broadcast",
  tags: ["broadcast", "title", "card", "intro", "headline", "film"],
  hold: 300,
  presets: [
    { name: "Cinema", values: { background: [0.02, 0.02, 0.03], ink: [0.96, 0.88, 0.7], accent: [0.85, 0.65, 0.25], muted: [0.6, 0.56, 0.5] } },
    { name: "Clean", values: { background: [0.98, 0.98, 0.97], ink: [0.07, 0.09, 0.15], muted: [0.4, 0.45, 0.52], accent: [0.15, 0.39, 0.92], wipe: false } },
    { name: "News", values: { background: [0.04, 0.09, 0.2], ink: [1, 1, 1], muted: [0.75, 0.8, 0.9], accent: [0.86, 0.15, 0.15] } },
    { name: "Sport", values: { background: [0.05, 0.05, 0.05], ink: [1, 1, 1], muted: [0.64, 0.9, 0.21], accent: [0.64, 0.9, 0.21] } },
  ],
  derived: (v) => {
    const title = fit(v.title, 1440, 132);
    const sub = fit(v.subtitle, 1200, 46);
    // Laid out from y 0, then centred on the frame.
    const titleBase = title.size * 0.72;
    const lineY = titleBase + title.size * 0.25 + 36;
    const subBase = lineY + 40 + sub.size * 0.75;
    const shift = 540 - (subBase + sub.size * 0.25) / 2;
    const half = Math.min(600, Math.max(140, Math.max(title.width, sub.width) * 0.3));
    return {
      ...outTimes(titleCardMotion, 1450 + ms(v.hold)),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(titleBase + shift),
      subSize: sub.size,
      subW: sub.width,
      subBase: r1(subBase + shift),
      lineY: r1(lineY + shift),
      lineL: r1(960 - half),
      lineR: r1(960 + half),
      wipeTo: v.wipe ? 0 : -2000,
      fadeTo: v.wipe ? 1 : 0,
    };
  },
  motion: titleCardMotion,
};

// ── Logo reveal ────────────────────────────────────────────────────────

const lockupText = (id: string, extra = "") =>
  `<text${id ? ` id="${id}"` : ""} x="{{wordX}}" y="{{wordBase}}" font-family="{{font}}" font-size="{{wordSize}}" font-weight="800" textLength="{{wordW}}" lengthAdjust="spacingAndGlyphs"${extra}>{{word}}</text>`;

/** A lockup of a mark and a wordmark centred on the frame: the mark `mark` square, then a gap, then the word. */
function lockup(v: Record<string, unknown>, mark: number, gap: number, maxWidth: number, maxSize: number) {
  const word = fit(v.word, maxWidth, maxSize);
  const total = mark + gap + word.width;
  const left = 960 - total / 2;
  const placed = placeMark(v.logo, [left, 540 - mark / 2, mark, mark]);
  return {
    left: r1(left),
    right: r1(left + total),
    wordX: r1(left + mark + gap),
    wordBase: r1(540 + word.size * 0.36),
    wordSize: word.size,
    wordW: word.width,
    markD: placed.d,
    markT: placed.transform,
    scale: placed.scale,
  };
}

const logoRevealMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{word: text default='Northwind' label='Wordmark'}} {{tagline: text default='Built to move' label='Tagline'}} ${markControl()} {{background: color default=#0A0A0F label='Background'}} {{markColor: color default=#22D3EE label='Mark colour'}} {{ink: color default=#FFFFFF label='Wordmark colour'}} {{muted: color default=#94A3B8 label='Tagline colour'}} {{shine: float min=0 max=1 default=0.7 step=0.05 label='Shine'}} ${holdControl(2)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="logoRevealWordClip"><rect id="logoRevealWordWipe" x="{{wipeX}}" y="300" width="0" height="480"/></clipPath><clipPath id="logoRevealShineClip"><path d="{{markD}}" transform="{{markT}}" fill-rule="evenodd"/>${lockupText("")}</clipPath><linearGradient id="logoRevealShineFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="{{shine}}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect width="1920" height="1080" fill="{{background}}"/><g id="logoRevealLockup" transform="translate(960 540) scale(1) translate(-960 -540)" opacity="1"><path id="logoRevealMark" d="{{markD}}" transform="{{markT}}" fill="{{markColor}}" fill-opacity="0" fill-rule="evenodd" stroke="{{markColor}}" stroke-width="{{markStroke}}" stroke-linejoin="round"/><g clip-path="url(#logoRevealWordClip)"><g id="logoRevealWord" transform="translate(-60 0)">${lockupText("", ` fill="{{ink}}"`)}</g></g><g clip-path="url(#logoRevealShineClip)"><rect id="logoRevealShine" x="0" y="300" width="240" height="480" fill="url(#logoRevealShineFill)" transform="translate({{shineFrom}} 0) skewX(-20)"/></g><g id="logoRevealTagline" opacity="0" transform="translate(0 20)"><text x="960" y="{{tagBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{tagSize}}" font-weight="500" letter-spacing="2" textLength="{{tagW}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}">{{tagline}}</text></g></g></svg>`,
  animate: [
    { id: "logoRevealMark", draw: true, ms: 1200, ease: "in-out" },
    { id: "logoRevealMark", attrs: { "fill-opacity": [0, 1] }, delay: 900, ms: 500, ease: "out" },
    { id: "logoRevealWordWipe", attrs: { width: [0, n("wipeW")] }, delay: 1000, ms: 700, ease: "in-out" },
    { id: "logoRevealWord", attrs: { transform: ["translate(-60 0)", "translate(0 0)"] }, delay: 1000, ms: 800, ease: "out" },
    { id: "logoRevealTagline", attrs: { opacity: [0, 1], transform: ["translate(0 20)", "translate(0 0)"] }, delay: 1500, ms: 500, ease: "out" },
    { id: "logoRevealShine", attrs: { transform: ["translate({{shineFrom}} 0) skewX(-20)", "translate({{shineTo}} 0) skewX(-20)"] }, delay: 1900, ms: 900, ease: "in-out" },
    { id: "logoRevealLockup", attrs: { transform: ["translate(960 540) scale(1) translate(-960 -540)", "translate(960 540) scale(0.94) translate(-960 -540)"], opacity: [1, 0] }, delay: after(0), ms: 500 },
  ],
};

export const logoReveal: VectorEffect = {
  kind: "vector",
  id: "logo-reveal",
  name: "Logo reveal",
  description: "A logo mark tracing its outline on and filling, the wordmark wiping in beside it, a tagline rising, then a shine sweeping across.",
  category: "broadcast",
  tags: ["broadcast", "logo", "reveal", "brand", "intro", "draw-on", "shine"],
  hold: 300,
  presets: [
    { name: "Clean", values: { background: [0.98, 0.98, 0.98], markColor: [0.15, 0.39, 0.92], ink: [0.07, 0.09, 0.15], muted: [0.4, 0.45, 0.52], shine: 0.9 } },
    { name: "Gold", values: { background: [0.03, 0.03, 0.03], markColor: [0.85, 0.65, 0.25], ink: [0.96, 0.88, 0.7] } },
    { name: "Sport", values: { background: [0.05, 0.05, 0.05], markColor: [0.64, 0.9, 0.21], ink: [1, 1, 1], muted: [0.64, 0.9, 0.21] } },
  ],
  derived: (v) => {
    const l = lockup(v, 200, 56, 1100, 160);
    const tag = fit(v.tagline, 1000, 40);
    return {
      ...outTimes(logoRevealMotion, 2800 + ms(v.hold)),
      ...l,
      markStroke: r2(4 / l.scale),
      wipeX: r1(l.wordX - 20),
      wipeW: r1(l.wordW + 60),
      shineFrom: r1(l.left - 420),
      shineTo: r1(l.right + 200),
      tagSize: tag.size,
      tagW: tag.width,
      tagBase: r1(540 + 100 + 60 + tag.size * 0.7),
    };
  },
  motion: logoRevealMotion,
};

// ── Logo sting ─────────────────────────────────────────────────────────

/** Burst lines round the sting, evenly spaced, alternately long and short. */
const RAYS = 16;
const ray = (k: number) => {
  const a = ((k + 0.5) / RAYS) * Math.PI * 2;
  const [inner, outer] = [210, k % 2 ? 470 : 600];
  return { x0: r1(960 + Math.cos(a) * inner), y0: r1(540 + Math.sin(a) * inner * 0.8), x1: r1(960 + Math.cos(a) * outer), y1: r1(540 + Math.sin(a) * outer * 0.8) };
};

const logoStingMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{word: text default='BOLT' label='Wordmark'}} ${markControl()} {{background: color default=#111111 label='Background'}} {{accent: color default=#FACC15 label='Burst'}} {{markColor: color default=#FACC15 label='Mark colour'}} {{ink: color default=#FFFFFF label='Wordmark colour'}} {{flash: float min=0 max=1 default=0.5 step=0.05 label='Flash'}} ${holdControl(1.5)} {{font: text default="${SANS}" label='Font'}} --><rect width="1920" height="1080" fill="{{background}}"/><circle id="logoStingRing" cx="960" cy="540" r="40" fill="none" stroke="{{accent}}" stroke-width="30" opacity="0"/><g stroke="{{accent}}" stroke-width="10" stroke-linecap="butt">${Array.from({ length: RAYS }, (_, k) => {
    const p = ray(k);
    return `<line id="logoStingRay${k}" x1="${p.x0}" y1="${p.y0}" x2="${p.x0}" y2="${p.y0}"/>`;
  }).join("")}</g><g transform="translate(960 540)"><g id="logoStingPop" transform="scale(0)"><g transform="translate(-960 -540)"><path d="{{markD}}" transform="{{markT}}" fill="{{markColor}}" fill-rule="evenodd"/>${lockupText("", ` fill="{{ink}}"`)}</g></g></g><rect id="logoStingFlash" width="1920" height="1080" fill="#FFFFFF" opacity="0"/></svg>`,
  animate: [
    ...pop("logoStingPop", 80, 1.18, 260),
    { id: "logoStingFlash", attrs: { opacity: [0, n("flash")] }, delay: 80, ms: 60, ease: "linear" },
    { id: "logoStingFlash", attrs: { opacity: [n("flash"), 0] }, delay: 140, ms: 320, ease: "out" },
    { id: "logoStingRing", attrs: { r: [40, 620], "stroke-width": [30, 0], opacity: [0.9, 0] }, delay: 100, ms: 700, ease: "out" },
    ...Array.from({ length: RAYS }, (_, k): SvgAnimation[] => {
      const p = ray(k);
      const lag = (k % 4) * 25;
      return [
        { id: `logoStingRay${k}`, attrs: { x2: [p.x0, p.x1], y2: [p.y0, p.y1] }, delay: 120 + lag, ms: 260, ease: "out" },
        { id: `logoStingRay${k}`, attrs: { x1: [p.x0, p.x1], y1: [p.y0, p.y1] }, delay: 300 + lag, ms: 300, ease: "out" },
      ];
    }).flat(),
    { id: "logoStingPop", attrs: { transform: ["scale(1)", "scale(1.06)"] }, delay: after(0), ms: 140, ease: "out" },
    { id: "logoStingPop", attrs: { transform: ["scale(1.06)", "scale(0)"] }, delay: after(140), ms: 260 },
  ],
};

export const logoSting: VectorEffect = {
  kind: "vector",
  id: "logo-sting",
  name: "Logo sting",
  description: "A quick, punchy logo hit: a flash, burst lines and a shock ring firing out as the logo pops in with an overshoot, then snaps away.",
  category: "broadcast",
  tags: ["broadcast", "logo", "sting", "brand", "intro", "burst", "punchy"],
  hold: 200,
  presets: [
    { name: "Electric", values: { background: [0.02, 0.03, 0.08], accent: [0.13, 0.83, 0.93], markColor: [0.13, 0.83, 0.93] } },
    { name: "Clean", values: { background: [1, 1, 1], accent: [0.93, 0.27, 0.27], markColor: [0.93, 0.27, 0.27], ink: [0.07, 0.07, 0.07], flash: 0 } },
    { name: "Sport", values: { background: [0.05, 0.05, 0.05], accent: [0.64, 0.9, 0.21], markColor: [0.64, 0.9, 0.21] } },
  ],
  derived: (v) => ({ ...outTimes(logoStingMotion, 700 + ms(v.hold)), ...lockup(v, 150, 40, 900, 140) }),
  motion: logoStingMotion,
};

// ── End card ───────────────────────────────────────────────────────────

const tile = (key: "A" | "B", cx: number) =>
  `<g transform="translate(${cx} 500)"><g id="endCardTile${key}" transform="scale(0.85)" opacity="0"><rect x="-320" y="-180" width="640" height="360" rx="24" fill="{{tile}}" stroke="{{ink}}" stroke-opacity="0.25" stroke-width="3"/><circle r="52" fill="{{ink}}" fill-opacity="0.14"/><path d="M-16 -26 L28 0 L-16 26 Z" fill="{{ink}}" fill-opacity="0.85"/></g></g>`;

const endCardMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{title: text default='Thanks for watching' label='Title'}} {{videoA: text default='Watch next' label='Left video'}} {{videoB: text default='Latest video' label='Right video'}} {{button: text default='Subscribe' label='Button'}} {{background: color default=#0F0F12 label='Background'}} {{tile: color default=#1F2937 label='Video placeholders'}} {{ink: color default=#FFFFFF label='Text colour'}} {{accent: color default=#FF0033 label='Button'}} {{buttonInk: color default=#FFFFFF label='Button text'}} ${holdControl(4)} {{font: text default="${SANS}" label='Font'}} --><defs><radialGradient id="endCardGlow" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.12"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></radialGradient></defs><rect width="1920" height="1080" fill="{{background}}"/><rect width="1920" height="1080" fill="url(#endCardGlow)"/><g id="endCardAll" opacity="1"><g id="endCardTitle" opacity="0" transform="translate(0 -30)"><text x="960" y="{{titleBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{titleSize}}" font-weight="800" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{title}}</text></g>${tile("A", 600)}${tile("B", 1320)}<g id="endCardLabels" opacity="0"><text x="600" y="{{labelBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{aSize}}" font-weight="600" textLength="{{aW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{videoA}}</text><text x="1320" y="{{labelBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{bSize}}" font-weight="600" textLength="{{bW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{videoB}}</text></g><g transform="translate(960 868)"><g id="endCardButton" transform="scale(0)"><rect x="{{buttonX}}" y="-42" width="{{buttonW}}" height="84" rx="42" fill="{{accent}}"/><text y="{{buttonBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{buttonSize}}" font-weight="700" textLength="{{buttonTextW}}" lengthAdjust="spacingAndGlyphs" fill="{{buttonInk}}">{{button}}</text></g></g></g></svg>`,
  animate: [
    { id: "endCardTitle", attrs: { opacity: [0, 1], transform: ["translate(0 -30)", "translate(0 0)"] }, ms: 600, ease: "out" },
    { id: "endCardTileA", attrs: { opacity: [0, 1], transform: ["scale(0.85)", "scale(1)"] }, delay: 300, ms: 550, ease: "out" },
    { id: "endCardTileB", attrs: { opacity: [0, 1], transform: ["scale(0.85)", "scale(1)"] }, delay: 450, ms: 550, ease: "out" },
    { id: "endCardLabels", attrs: { opacity: [0, 1] }, delay: 800, ms: 400, ease: "out" },
    ...pop("endCardButton", 1100, 1.14),
    { id: "endCardAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 500 },
  ],
};

export const endCard: VectorEffect = {
  kind: "vector",
  id: "end-card",
  name: "End card",
  description: "An outro screen: a thank-you title, two video placeholders scaling in for end-screen links, and a subscribe button that pops.",
  category: "broadcast",
  tags: ["broadcast", "end-card", "outro", "youtube", "end-screen", "subscribe"],
  hold: 300,
  presets: [
    { name: "Dark", values: { background: [0.06, 0.06, 0.07], tile: [0.12, 0.16, 0.22] } },
    { name: "Light", values: { background: [0.97, 0.97, 0.98], tile: [0.89, 0.91, 0.94], ink: [0.07, 0.09, 0.15] } },
    { name: "Brand", values: { background: [0.15, 0.08, 0.35], tile: [0.24, 0.15, 0.5], accent: [0.98, 0.8, 0.08], buttonInk: [0.1, 0.06, 0.2] } },
  ],
  derived: (v) => {
    const title = fit(v.title, 1400, 88);
    const a = fit(v.videoA, 600, 36);
    const b = fit(v.videoB, 600, 36);
    const button = fit(v.button, 420, 34);
    const w = Math.max(220, button.width + 96);
    return {
      ...outTimes(endCardMotion, 1600 + ms(v.hold)),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(250 + title.size * 0.35),
      aSize: a.size,
      aW: a.width,
      bSize: b.size,
      bW: b.width,
      labelBase: r1(735 + Math.max(a.size, b.size) * 0.35),
      buttonW: r1(w),
      buttonX: -r1(w / 2),
      buttonSize: button.size,
      buttonTextW: button.width,
      buttonBase: r1(button.size * 0.35),
    };
  },
  motion: endCardMotion,
};

// ── Countdown ──────────────────────────────────────────────────────────

/** Countdown slots: one per number, up to this many seconds. */
const COUNT_MAX = 30;
const COUNT_IN = 300;
const flipPose = (s: number) => `translate(960 540) scale(1 ${s}) translate(-960 -540)`;

const countdownMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{from: int min=1 max=${COUNT_MAX} default=10 label='Count from'}} {{step: float min=0.25 max=3 default=1 step=0.05 label='Seconds per step'}} {{label: text default='Starting in' label='Label'}} {{background: color default=#0B1020 label='Background'}} {{ring: color default=#F43F5E label='Ring'}} {{track: color default=#1E293B label='Ring track'}} {{ink: color default=#FFFFFF label='Number colour'}} ${holdControl(1, "Hold on zero (s)")} {{font: text default="${SANS}" label='Font'}} --><rect width="1920" height="1080" fill="{{background}}"/><g id="countdownAll" opacity="0" transform="translate(960 540) scale(0.9) translate(-960 -540)"><circle cx="960" cy="520" r="300" fill="none" stroke="{{track}}" stroke-width="28"/><circle id="countdownRing" cx="960" cy="520" r="300" fill="none" stroke="{{ring}}" stroke-width="28" stroke-linecap="round" transform="rotate(-90 960 520)"/><g id="countdownFlip" transform="${flipPose(0)}"><text id="countdownNumber" x="960" y="{{numberBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{numberSize}}" font-weight="800" fill="{{ink}}">{{d0}}</text></g><text x="960" y="{{labelBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{labelSize}}" font-weight="600" letter-spacing="4" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.7">{{label}}</text></g></svg>`,
  animate: [
    { id: "countdownAll", attrs: { opacity: [0, 1], transform: ["translate(960 540) scale(0.9) translate(-960 -540)", "translate(960 540) scale(1) translate(-960 -540)"] }, ms: COUNT_IN, ease: "out" },
    // A slot per number: the ring drains over its step, the number is written and flips open.
    ...Array.from({ length: COUNT_MAX + 1 }, (_, k): SvgAnimation[] => [
      { id: "countdownRing", draw: [n(`ra${k}`), 0] as unknown as [number, number], delay: n(`t${k}`), ms: n(`rm${k}`), ease: "linear" },
      { id: "countdownNumber", write: `{{d${k}}}`, delay: n(`t${k}`), ms: 0 },
      { id: "countdownFlip", attrs: { transform: [flipPose(0), flipPose(1)] }, delay: n(`t${k}`), ms: 260, ease: "out" },
    ]).flat(),
    { id: "countdownAll", attrs: { opacity: [1, 0], transform: ["translate(960 540) scale(1) translate(-960 -540)", "translate(960 540) scale(1.08) translate(-960 -540)"] }, delay: after(0), ms: 400 },
  ],
};

export const countdown: VectorEffect = {
  kind: "vector",
  id: "countdown",
  name: "Countdown",
  description: "A countdown from ten (or any number) to zero, the number flipping over each second as a ring drains around it.",
  category: "broadcast",
  tags: ["broadcast", "countdown", "timer", "number", "intro", "live"],
  hold: 300,
  presets: [
    { name: "Live", values: { ring: [0.96, 0.25, 0.37], background: [0.04, 0.06, 0.13] } },
    { name: "Clean", values: { background: [0.98, 0.98, 0.98], ring: [0.15, 0.39, 0.92], track: [0.89, 0.91, 0.94], ink: [0.07, 0.09, 0.15] } },
    { name: "Retro film", values: { background: [0.1, 0.09, 0.08], ring: [0.95, 0.9, 0.8], track: [0.25, 0.23, 0.2], ink: [0.95, 0.9, 0.8], from: 5, label: '' } },
  ],
  derived: (v) => {
    const from = Math.max(1, Math.min(COUNT_MAX, Math.round(Number(v.from)) || 1));
    const step = ms(v.step);
    const number = fit(String(from), 380, 300);
    const label = fit(v.label, 900, 40);
    const out: Record<string, string | number> = {
      ...outTimes(countdownMotion, COUNT_IN + from * step + 300 + ms(v.hold)),
      numberSize: number.size,
      numberBase: r1(520 + number.size * 0.36),
      labelSize: label.size,
      labelW: label.width,
      labelBase: r1(920 + label.size * 0.35),
    };
    // Slots past zero repeat zero's, so they change nothing.
    for (let k = 0; k <= COUNT_MAX; k++) {
      const s = Math.min(k, from);
      out[`t${k}`] = COUNT_IN + s * step;
      out[`d${k}`] = String(from - s);
      out[`ra${k}`] = s < from ? 1 : 0;
      out[`rm${k}`] = s < from ? step : 0;
    }
    return out;
  },
  motion: countdownMotion,
};

// ── Subscribe button ───────────────────────────────────────────────────

/** An arrow pointer, its tip at (0, 0). */
export const CURSOR = "M0 0 L0 34 L9.5 25.5 L15.5 39.5 L21.5 37 L15.5 23.5 L27.5 23.5 Z";
const BELL = "M12 3 C8.4 3 6 5.8 6 9.6 V14 L4 17.2 H20 L18 14 V9.6 C18 5.8 15.6 3 12 3 Z M9.6 19.4 A2.5 2.5 0 0 0 14.4 19.4";
const ring = (deg: number) => `rotate(${deg} 0 -26)`;

const subscribeButtonMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{label: text default='Subscribe' label='Button'}} {{done: text default='Subscribed' label='Button when subscribed'}} {{color: color default=#FF0033 label='Button'}} {{ink: color default=#FFFFFF label='Button text'}} {{doneColor: color default=#E5E7EB label='Subscribed button'}} {{doneInk: color default=#111827 label='Subscribed text'}} ${holdControl(2)} {{font: text default="${SANS}" label='Font'}} --><g transform="translate(960 860) scale(1.35) translate(-960 -860)"><g id="subscribeButtonAll" opacity="0" transform="translate(0 40)"><rect id="subscribeButtonFace" x="{{buttonX}}" y="816" width="{{buttonW}}" height="88" rx="44" fill="{{color}}"/><text id="subscribeButtonLabel" x="{{buttonCx}}" y="{{textBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{labelSize}}" font-weight="700" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{label}}</text><text id="subscribeButtonDone" x="{{buttonCx}}" y="{{doneBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{doneSize}}" font-weight="700" textLength="{{doneW}}" lengthAdjust="spacingAndGlyphs" fill="{{doneInk}}" opacity="0">{{done}}</text><g transform="translate({{bellX}} 860)"><g id="subscribeButtonBell" transform="scale(0)"><circle r="44" fill="{{doneColor}}"/><g id="subscribeButtonSwing" transform="${ring(0)}"><path d="${BELL}" transform="scale(2.4) translate(-12 -11.5)" fill="none" stroke="{{doneInk}}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></g></g><circle id="subscribeButtonRipple" cx="{{clickX}}" cy="872" r="0" fill="#FFFFFF" opacity="0"/><g id="subscribeButtonCursor" transform="translate(1640 1130)"><g id="subscribeButtonPress" transform="scale(1.3)"><path d="${CURSOR}" fill="#FFFFFF" stroke="#111111" stroke-width="2" stroke-linejoin="round"/></g></g></g></g></svg>`,
  animate: [
    { id: "subscribeButtonAll", attrs: { opacity: [0, 1], transform: ["translate(0 40)", "translate(0 0)"] }, ms: 450, ease: "out" },
    { id: "subscribeButtonCursor", attrs: { transform: ["translate(1640 1130)", "translate({{clickX}} 872)"] }, delay: 450, ms: 850, ease: "in-out" },
    { id: "subscribeButtonPress", attrs: { transform: ["scale(1.3)", "scale(1.1)"] }, delay: 1300, ms: 100, ease: "out" },
    { id: "subscribeButtonPress", attrs: { transform: ["scale(1.1)", "scale(1.3)"] }, delay: 1400, ms: 140, ease: "out" },
    { id: "subscribeButtonRipple", attrs: { r: [0, 110], opacity: [0.5, 0] }, delay: 1300, ms: 550, ease: "out" },
    { id: "subscribeButtonFace", attrs: { fill: ["{{color}}", "{{doneColor}}"] }, delay: 1300, ms: 180, ease: "linear" },
    { id: "subscribeButtonLabel", attrs: { opacity: [1, 0] }, delay: 1300, ms: 120, ease: "linear" },
    { id: "subscribeButtonDone", attrs: { opacity: [0, 1] }, delay: 1380, ms: 160, ease: "linear" },
    ...pop("subscribeButtonBell", 1450, 1.15, 240),
    ...([[0, 20], [20, -18], [-18, 14], [14, -9], [-9, 5], [5, 0]] as const).map(([a, b], i): SvgAnimation => ({ id: "subscribeButtonSwing", attrs: { transform: [ring(a), ring(b)] }, delay: 1700 + i * 110, ms: 110, ease: "in-out" })),
    { id: "subscribeButtonCursor", attrs: { transform: ["translate({{clickX}} 872)", "translate({{leaveX}} 1000)"] }, delay: 2000, ms: 700, ease: "in-out" },
    { id: "subscribeButtonAll", attrs: { opacity: [1, 0], transform: ["translate(0 0)", "translate(0 40)"] }, delay: after(0), ms: 450 },
  ],
};

export const subscribeButton: VectorEffect = {
  kind: "vector",
  id: "subscribe-button",
  name: "Subscribe button",
  description: "A YouTube-style subscribe button: a cursor glides in and clicks it, it turns grey and reads Subscribed, and a bell pops up and rings.",
  category: "broadcast",
  tags: ["broadcast", "subscribe", "youtube", "button", "cursor", "bell", "overlay", "cta"],
  hold: 300,
  presets: [
    { name: "YouTube", values: { color: [1, 0, 0.2], doneColor: [0.9, 0.91, 0.92], doneInk: [0.07, 0.09, 0.15] } },
    { name: "Dark", values: { color: [1, 1, 1], ink: [0.06, 0.06, 0.06], doneColor: [0.15, 0.15, 0.15], doneInk: [1, 1, 1] } },
    { name: "Brand", values: { color: [0.49, 0.23, 0.93], doneColor: [0.93, 0.91, 0.99], doneInk: [0.35, 0.15, 0.7], label: "Follow", done: "Following" } },
  ],
  derived: (v) => {
    const label = fit(v.label, 520, 34);
    const done = fit(v.done, 520, 34);
    const w = Math.max(label.width, done.width) + 88;
    const total = w + 24 + 88;
    const left = 960 - total / 2;
    return {
      ...outTimes(subscribeButtonMotion, 2700 + ms(v.hold)),
      buttonX: r1(left),
      buttonW: r1(w),
      buttonCx: r1(left + w / 2),
      labelSize: label.size,
      labelW: label.width,
      textBase: r1(860 + label.size * 0.35),
      doneSize: done.size,
      doneW: done.width,
      doneBase: r1(860 + done.size * 0.35),
      bellX: r1(left + w + 24 + 44),
      clickX: r1(left + w * 0.55),
      leaveX: r1(Math.min(1700, left + total + 260)),
    };
  },
  motion: subscribeButtonMotion,
};

// ── News ticker ────────────────────────────────────────────────────────

/** Copies of the ticker text in the crawl, enough to fill the frame at the shortest repeat. */
const TICKER_COPIES = 8;
const TICKER_MIN_REPEAT = 400;
/** Blinks of the live dot per loop (even, so it loops seamlessly). */
const BLINKS = 24;

const newsTickerMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{text: text default='Markets close higher as rates hold steady  ·  Storm warning lifted along the coast  ·  City council approves new transit line' label='Ticker text'}} {{label: text default='BREAKING' label='Label'}} {{band: color default=#0B1220 label='Band'}} {{ink: color default=#FFFFFF label='Text colour'}} {{accent: color default=#DC2626 label='Label'}} {{labelInk: color default=#FFFFFF label='Label text'}} {{speed: float min=40 max=600 default=160 step=10 label='Speed (px/s)'}} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="newsTickerClip"><rect x="{{crawlX}}" y="884" width="{{crawlW}}" height="80"/></clipPath></defs><rect x="0" y="884" width="1920" height="80" fill="{{band}}" fill-opacity="0.92"/><rect x="0" y="884" width="1920" height="4" fill="{{accent}}"/><g clip-path="url(#newsTickerClip)"><g id="newsTickerCrawl" transform="translate(0 0)">${Array.from(
    { length: TICKER_COPIES },
    (_, k) =>
      `<text x="{{x${k}}}" y="{{textBase}}" font-family="{{font}}" font-size="{{textSize}}" font-weight="500" textLength="{{textW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{text}}</text><rect x="{{s${k}}}" y="917" width="14" height="14" transform="rotate(45 {{sc${k}}} 924)" fill="{{accent}}"/>`,
  ).join("")}</g></g><rect x="192" y="884" width="{{labelBox}}" height="80" fill="{{accent}}"/><circle id="newsTickerDot" cx="226" cy="924" r="9" fill="{{labelInk}}"/><text x="250" y="{{labelBase}}" font-family="{{font}}" font-size="{{labelSize}}" font-weight="800" letter-spacing="2" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{labelInk}}">{{label}}</text></svg>`,
  animate: [
    { id: "newsTickerCrawl", attrs: { transform: ["translate(0 0)", "translate({{repeatBack}} 0)"] }, ms: n("period"), ease: "linear" },
    ...holds(
      "newsTickerDot",
      "opacity",
      Array.from({ length: BLINKS }, (_, k) => [n(`b${k}`), k % 2 ? 0.25 : 1] as const),
    ),
  ],
};

export const newsTicker: VectorEffect = {
  kind: "vector",
  id: "news-ticker",
  name: "News ticker",
  description: "A news band along the bottom with a BREAKING label and a blinking live dot, its headlines crawling past in a seamless loop.",
  category: "broadcast",
  tags: ["broadcast", "news", "ticker", "crawl", "marquee", "breaking", "loop", "overlay"],
  hold: 0,
  presets: [
    { name: "Breaking", values: { accent: [0.86, 0.15, 0.15], band: [0.04, 0.07, 0.13] } },
    { name: "Business", values: { accent: [0.15, 0.39, 0.92], band: [1, 1, 1], ink: [0.07, 0.09, 0.15], label: "MARKETS" } },
    { name: "Sport", values: { accent: [0.64, 0.9, 0.21], labelInk: [0.05, 0.05, 0.05], band: [0.05, 0.05, 0.05], label: "LATEST" } },
  ],
  derived: (v) => {
    const label = fit(v.label, 360, 30);
    const text = fit(v.text, Infinity, 36);
    const labelBox = label.width + 92;
    const crawlX = 192 + labelBox;
    const repeat = Math.max(TICKER_MIN_REPEAT, text.width + 96);
    const period = Math.max(1, Math.round((repeat / Math.max(1, Number(v.speed))) * 1000));
    const out: Record<string, string | number> = {
      labelSize: label.size,
      labelW: label.width,
      labelBase: r1(924 + label.size * 0.35),
      labelBox: r1(labelBox),
      crawlX: r1(crawlX),
      crawlW: r1(1920 - crawlX),
      textSize: text.size,
      textW: text.width,
      textBase: r1(924 + text.size * 0.35),
      repeatBack: -r1(repeat),
      period,
    };
    for (let k = 0; k < TICKER_COPIES; k++) {
      const x = crawlX + 32 + k * repeat;
      out[`x${k}`] = r1(x);
      out[`s${k}`] = r1(x + text.width + 41);
      out[`sc${k}`] = r1(x + text.width + 48);
    }
    for (let k = 0; k < BLINKS; k++) out[`b${k}`] = Math.round((k * period) / BLINKS);
    return out;
  },
  motion: newsTickerMotion,
};

// ── Scoreboard ─────────────────────────────────────────────────────────

/** Clock ticks: one a second while it shows, up to this many. */
const TICKS = 40;
const SCORE_IN = 1400;

const clockText = (total: number) => {
  const t = Math.max(0, total);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

const scoreboardMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{home: text default='LIV' label='Home team'}} {{away: text default='ARS' label='Away team'}} {{homeScore: int min=0 max=199 default=2 label='Home score'}} {{awayScore: int min=0 max=199 default=1 label='Away score'}} {{period: text default='2H' label='Period'}} {{minutes: int min=0 max=120 default=67 label='Clock minutes'}} {{seconds: int min=0 max=59 default=12 label='Clock seconds'}} {{countDown: bool default=false label='Clock counts down'}} {{homeColor: color default=#C8102E label='Home colour'}} {{awayColor: color default=#F5F5F5 label='Away colour'}} {{plate: color default=#101828 label='Team plate'}} {{scorePlate: color default=#FFFFFF label='Score plate'}} {{ink: color default=#FFFFFF label='Team text'}} {{scoreInk: color default=#101828 label='Score text'}} {{accent: color default=#22C55E label='Clock plate'}} {{clockInk: color default=#04130A label='Clock text'}} ${holdControl(6)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="scoreboardWipe"><rect id="scoreboardWipeRect" x="192" y="100" width="0" height="80"/></clipPath><filter id="scoreboardShadow" x="-10%" y="-50%" width="120%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/></filter></defs><g clip-path="url(#scoreboardWipe)" filter="url(#scoreboardShadow)"><rect x="192" y="108" width="10" height="64" fill="{{homeColor}}"/><rect x="202" y="108" width="180" height="64" fill="{{plate}}"/><text x="292" y="{{homeBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{homeSize}}" font-weight="800" textLength="{{homeW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{home}}</text><rect x="382" y="108" width="152" height="64" fill="{{scorePlate}}"/><line x1="458" y1="122" x2="458" y2="158" stroke="{{scoreInk}}" stroke-opacity="0.2" stroke-width="2"/><text id="scoreboardHomeScore" x="420" y="152" text-anchor="middle" font-family="{{font}}" font-size="40" font-weight="800" fill="{{scoreInk}}">0</text><text id="scoreboardAwayScore" x="496" y="152" text-anchor="middle" font-family="{{font}}" font-size="40" font-weight="800" fill="{{scoreInk}}">0</text><rect x="534" y="108" width="180" height="64" fill="{{plate}}"/><text x="624" y="{{awayBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{awaySize}}" font-weight="800" textLength="{{awayW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{away}}</text><rect x="714" y="108" width="10" height="64" fill="{{awayColor}}"/><rect x="724" y="108" width="150" height="64" fill="{{accent}}"/><text id="scoreboardClock" x="799" y="152" text-anchor="middle" font-family="{{font}}" font-size="36" font-weight="700" fill="{{clockInk}}">{{c0}}</text><rect x="874" y="108" width="72" height="64" fill="{{plate}}"/><text x="910" y="{{periodBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{periodSize}}" font-weight="700" textLength="{{periodW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{period}}</text></g></svg>`,
  animate: [
    { id: "scoreboardWipeRect", attrs: { width: [0, 760] }, ms: 600, ease: "out" },
    { id: "scoreboardHomeScore", count: [0, n("homeScore")], delay: 500, ms: 900, ease: "out" },
    { id: "scoreboardAwayScore", count: [0, n("awayScore")], delay: 600, ms: 800, ease: "out" },
    ...Array.from({ length: TICKS }, (_, k): SvgAnimation => ({ id: "scoreboardClock", write: `{{c${k}}}`, delay: n(`ct${k}`), ms: 0 })),
    { id: "scoreboardWipeRect", attrs: { width: [760, 0] }, delay: after(0), ms: 500 },
  ],
};

export const scoreboard: VectorEffect = {
  kind: "vector",
  id: "scoreboard",
  name: "Scoreboard",
  description: "A sports score bug wiping in at the top left: team names and colours, scores counting up, a ticking match clock and the period.",
  category: "broadcast",
  tags: ["broadcast", "sport", "scoreboard", "score-bug", "clock", "overlay", "counter"],
  hold: 300,
  presets: [
    { name: "Football", values: { accent: [0.13, 0.77, 0.37], clockInk: [0.02, 0.07, 0.04] } },
    { name: "Basketball", values: { home: "LAL", away: "BOS", homeScore: 98, awayScore: 101, period: "Q4", minutes: 2, seconds: 30, countDown: true, homeColor: [0.33, 0.15, 0.53], awayColor: [0, 0.48, 0.2], accent: [0.98, 0.45, 0.09], clockInk: [0.1, 0.04, 0] } },
    { name: "Minimal", values: { plate: [1, 1, 1], ink: [0.07, 0.09, 0.15], scorePlate: [0.07, 0.09, 0.15], scoreInk: [1, 1, 1], accent: [0.95, 0.96, 0.97], clockInk: [0.07, 0.09, 0.15] } },
  ],
  derived: (v) => {
    const home = fit(v.home, 150, 34);
    const away = fit(v.away, 150, 34);
    const period = fit(v.period, 56, 28);
    const hold = ms(v.hold);
    const start = Math.round(Number(v.minutes)) * 60 + Math.round(Number(v.seconds));
    const dir = v.countDown ? -1 : 1;
    // The clock ticks every second from when it shows until the bug wipes out.
    const ticks = Math.max(1, Math.min(TICKS, Math.floor((SCORE_IN + hold - 600) / 1000) + 1));
    const out: Record<string, string | number> = {
      ...outTimes(scoreboardMotion, SCORE_IN + hold),
      homeSize: home.size,
      homeW: home.width,
      homeBase: r1(140 + home.size * 0.35),
      awaySize: away.size,
      awayW: away.width,
      awayBase: r1(140 + away.size * 0.35),
      periodSize: period.size,
      periodW: period.width,
      periodBase: r1(140 + period.size * 0.35),
      homeScore: Math.round(Number(v.homeScore)),
      awayScore: Math.round(Number(v.awayScore)),
    };
    for (let k = 0; k < TICKS; k++) {
      const s = Math.min(k, ticks - 1);
      out[`ct${k}`] = 600 + s * 1000;
      out[`c${k}`] = clockText(start + dir * s);
    }
    return out;
  },
  motion: scoreboardMotion,
};

// ── Chapter marker ─────────────────────────────────────────────────────

const chapterMarkerMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{title: text default='The plan' label='Title'}} {{number: int min=0 max=99 default=2 label='Chapter number'}} {{label: text default='Chapter' label='Label'}} {{accent: color default=#F97316 label='Badge'}} {{badgeInk: color default=#FFFFFF label='Number colour'}} {{plate: color default=#111827 label='Panel'}} {{ink: color default=#FFFFFF label='Title colour'}} {{labelInk: color default=#F97316 label='Label colour'}} {{plateOpacity: float min=0 max=1 default=0.92 step=0.05 label='Panel opacity'}} ${holdControl(3)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="chapterMarkerClip"><rect x="318" y="760" width="1420" height="112"/></clipPath></defs><rect id="chapterMarkerPanel" x="252" y="760" width="0" height="112" rx="56" fill="{{plate}}" fill-opacity="{{plateOpacity}}"/><g clip-path="url(#chapterMarkerClip)"><text id="chapterMarkerLabel" x="340" y="{{labelBase}}" transform="translate(-260 0)" font-family="{{font}}" font-size="{{labelSize}}" font-weight="700" letter-spacing="3" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{labelInk}}">{{heading}}</text><text id="chapterMarkerTitle" x="340" y="{{titleBase}}" transform="translate(-320 0)" font-family="{{font}}" font-size="{{titleSize}}" font-weight="700" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{title}}</text></g><g transform="translate(252 816)"><g id="chapterMarkerBadge" transform="rotate(-120) scale(0)"><circle r="60" fill="{{accent}}"/><circle r="50" fill="none" stroke="{{badgeInk}}" stroke-opacity="0.35" stroke-width="2"/><text y="{{numberBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{numberSize}}" font-weight="800" fill="{{badgeInk}}">{{number}}</text></g></g></svg>`,
  animate: [
    { id: "chapterMarkerBadge", attrs: { transform: ["rotate(-120) scale(0)", "rotate(8) scale(1.1)"] }, ms: 380, ease: "out" },
    { id: "chapterMarkerBadge", attrs: { transform: ["rotate(8) scale(1.1)", "rotate(0) scale(1)"] }, delay: 380, ms: 180, ease: "in-out" },
    { id: "chapterMarkerPanel", attrs: { width: [0, n("panel")] }, delay: 250, ms: 550, ease: "out" },
    { id: "chapterMarkerLabel", attrs: { transform: ["translate(-260 0)", "translate(0 0)"] }, delay: 450, ms: 450, ease: "out" },
    { id: "chapterMarkerTitle", attrs: { transform: ["translate(-320 0)", "translate(0 0)"] }, delay: 550, ms: 500, ease: "out" },
    { id: "chapterMarkerTitle", attrs: { transform: ["translate(0 0)", "translate(-320 0)"] }, delay: after(0), ms: 350 },
    { id: "chapterMarkerLabel", attrs: { transform: ["translate(0 0)", "translate(-260 0)"] }, delay: after(80), ms: 350 },
    { id: "chapterMarkerPanel", attrs: { width: [n("panel"), 0] }, delay: after(200), ms: 450 },
    { id: "chapterMarkerBadge", attrs: { transform: ["rotate(0) scale(1)", "rotate(-120) scale(0)"] }, delay: after(550), ms: 350 },
  ],
};

export const chapterMarker: VectorEffect = {
  kind: "vector",
  id: "chapter-marker",
  name: "Chapter marker",
  description: "A numbered badge spinning in at the lower left and a panel sliding out of it with the chapter label over its title.",
  category: "broadcast",
  tags: ["broadcast", "chapter", "section", "title", "number", "overlay", "youtube"],
  hold: 300,
  presets: [
    { name: "Bold", values: { accent: [0.98, 0.45, 0.09], labelInk: [0.98, 0.45, 0.09] } },
    { name: "Clean", values: { plate: [1, 1, 1], ink: [0.07, 0.09, 0.15], accent: [0.15, 0.39, 0.92], labelInk: [0.15, 0.39, 0.92], plateOpacity: 1 } },
    { name: "Minimal", values: { plateOpacity: 0, accent: [1, 1, 1], badgeInk: [0.07, 0.07, 0.07], labelInk: [1, 1, 1] } },
  ],
  derived: (v) => {
    const heading = `${String(v.label).toUpperCase()} ${Math.round(Number(v.number))}`.trim();
    const label = fit(heading, 1300, 24);
    const title = fit(v.title, 1300, 50);
    const number = fit(String(Math.round(Number(v.number))), 80, 56);
    return {
      ...outTimes(chapterMarkerMotion, 1050 + ms(v.hold)),
      heading,
      labelSize: label.size,
      labelW: label.width,
      labelBase: r1(796 + label.size * 0.35),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(840 + title.size * 0.35),
      numberSize: number.size,
      numberBase: r1(number.size * 0.36),
      panel: r1(88 + Math.max(label.width, title.width) + 44),
    };
  },
  motion: chapterMarkerMotion,
};

/** Broadcast graphics: lower thirds, titles, logos, end cards, a countdown, a subscribe button, a ticker, a score bug and chapter markers. */
export const broadcastEffects: VectorEffect[] = [
  lowerThird,
  lowerThirdStacked,
  titleCard,
  logoReveal,
  logoSting,
  endCard,
  countdown,
  subscribeButton,
  newsTicker,
  scoreboard,
  chapterMarker,
];
