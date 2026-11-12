import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { fitLabel } from "./data.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Web UI flourishes as animated SVG: a logo marquee, a rolling number and a
 * shimmering badge. Ids are prefixed with the effect's name.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** Marquee: the copies of its row, and the picture's width. */
const MARQUEE_COPIES = 6;
const MARQUEE_WIDTH = 400;

export const marquee: VectorEffect = {
  kind: "vector",
  id: "marquee",
  name: "Marquee",
  description: "An endless row of logos or words scrolling sideways, looping seamlessly and fading out at both edges.",
  category: "ui",
  tags: ["ui", "marquee", "logo", "ticker", "scroll", "saas", "social-proof"],
  hold: 0,
  presets: [
    { name: "Dark", values: { ink: [0.8, 0.83, 0.88] } },
    { name: "Headlines", values: { words: "Fast · Private · Open source · Made for teams", size: 26, weight: 800, ink: [0.06, 0.09, 0.16] } },
    { name: "Right to left", values: { reverse: true, speed: 40 } },
  ],
  derived: (v) => {
    const size = Number(v.size) || 20;
    const length = Math.max(size, textWidthEm(String(v.words)) * size * 0.92);
    const gap = Math.max(size * 1.6, MARQUEE_WIDTH / (MARQUEE_COPIES - 1) - length);
    const period = length + gap;
    const out: Record<string, string | number> = {
      length: r1(length),
      ms: Math.round((period / Math.max(5, Number(v.speed) || 60)) * 1000),
      from: v.reverse ? `translate(${r1(-period)} 0)` : "translate(0 0)",
      to: v.reverse ? "translate(0 0)" : `translate(${r1(-period)} 0)`,
      fadeIn: Math.min(0.45, Number(v.fade)),
      fadeOut: 1 - Math.min(0.45, Number(v.fade)),
      dotR: r1(size * 0.12),
    };
    for (let i = 0; i < MARQUEE_COPIES; i++) {
      out[`x${i}`] = r1(i * period);
      out[`dot${i}`] = r1(i * period + length + gap / 2);
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${MARQUEE_WIDTH} 64"><!-- {{words: text default='Acme · Globex · Initech · Umbrella · Hooli · Stark' label='Words'}} {{ink: color default=#64748B label='Colour'}} {{size: float min=10 max=36 default=20 step=1 label='Text size'}} {{weight: int min=300 max=900 default=600 step=100 label='Weight'}} {{speed: float min=10 max=200 default=50 step=1 label='Speed'}} {{fade: float min=0 max=0.45 default=0.15 step=0.01 label='Edge fade'}} {{reverse: bool default=false label='Right to left'}} --><defs><linearGradient id="marqueeFadeGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000"/><stop offset="{{fadeIn}}" stop-color="#FFFFFF"/><stop offset="{{fadeOut}}" stop-color="#FFFFFF"/><stop offset="1" stop-color="#000000"/></linearGradient><mask id="marqueeFade" maskUnits="userSpaceOnUse" x="0" y="0" width="${MARQUEE_WIDTH}" height="64"><rect width="${MARQUEE_WIDTH}" height="64" fill="url(#marqueeFadeGradient)"/></mask></defs><g mask="url(#marqueeFade)"><g id="marqueeRow" transform="{{from}}" fill="{{ink}}" font-family="${SANS}" font-size="{{size}}" font-weight="{{weight}}">${Array.from(
      { length: MARQUEE_COPIES },
      (_, i) =>
        `<text x="{{x${i}}}" y="32" dominant-baseline="central" textLength="{{length}}" lengthAdjust="spacingAndGlyphs">{{words}}</text><circle cx="{{dot${i}}}" cy="32" r="{{dotR}}" opacity="0.6"/>`,
    ).join("")}</g></g></svg>`,
    animate: [{ id: "marqueeRow", attrs: { transform: ["{{from}}", "{{to}}"] }, ms: n("ms"), ease: "linear" }],
  },
};

/** Number ticker: how many characters it shows at most, and its type size and line height. */
const TICKER_SLOTS = 12;
const TICKER_SIZE = 56;
const TICKER_LINE = 64;
const TICKER_BASE = 70;

export const numberTicker: VectorEffect = {
  kind: "vector",
  id: "number-ticker",
  name: "Number ticker",
  description: "A number rolling up digit by digit like an odometer, in any format: $12,480, 98.6%, 1,024 users.",
  category: "ui",
  tags: ["ui", "counter", "odometer", "number", "kpi", "stat", "saas"],
  hold: 1600,
  presets: [
    { name: "Dark", values: { ink: [0.97, 0.98, 0.99] } },
    { name: "Percent", values: { value: "98.6%", ink: [0.09, 0.64, 0.29] } },
    { name: "Users", values: { value: "1,024,000", duration: 2.4, stagger: 0.06 } },
  ],
  derived: (v) => {
    const chars = Array.from(String(v.value)).slice(0, TICKER_SLOTS);
    const widths = chars.map((c) => (/[0-9]/.test(c) ? 0.62 : Math.max(0.3, textWidthEm(c))) * TICKER_SIZE);
    const total = widths.reduce((a, b) => a + b, 0);
    const fit = Math.min(1, 296 / Math.max(1, total));
    const duration = Math.round(Math.min(5, Math.max(0.2, Number(v.duration) || 1.6)) * 1000);
    const stagger = Math.round(Math.min(0.5, Math.max(0, Number(v.stagger) || 0)) * 1000);
    const out: Record<string, string | number> = { fit: +fit.toFixed(4), ms: duration };
    let x = 160 - total / 2;
    let digit = 0;
    for (let i = 0; i < TICKER_SLOTS; i++) {
      const c = chars[i];
      const w = widths[i] ?? 0;
      const isDigit = c !== undefined && /[0-9]/.test(c);
      out[`x${i}`] = r1(x + w / 2);
      out[`c${i}`] = c !== undefined && !isDigit ? c : "";
      out[`d${i}`] = isDigit ? "inline" : "none";
      out[`roll${i}`] = isDigit ? (10 + Number(c)) * TICKER_LINE : 0;
      out[`delay${i}`] = isDigit ? digit++ * stagger : 0;
      x += w;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 320 100"><!-- {{value: text default='$12,480' label='Value'}} {{ink: color default=#0F172A label='Colour'}} {{font: text default='system-ui, -apple-system, Segoe UI, Roboto, sans-serif' label='Font'}} {{weight: int min=100 max=900 default=700 step=100 label='Weight'}} {{duration: float min=0.2 max=5 default=1.6 step=0.1 label='Roll time (s)'}} {{stagger: float min=0 max=0.5 default=0.1 step=0.01 label='Stagger (s)'}} --><defs><clipPath id="numberTickerClip"><rect x="-200" y="${TICKER_BASE - 54}" width="720" height="72"/></clipPath></defs><g transform="translate(160 50) scale({{fit}}) translate(-160 -50)" fill="{{ink}}" font-family="{{font}}" font-size="${TICKER_SIZE}" font-weight="{{weight}}" text-anchor="middle"><g clip-path="url(#numberTickerClip)">${Array.from(
      { length: TICKER_SLOTS },
      (_, i) =>
        `<g transform="translate({{x${i}}} 0)"><g display="{{d${i}}}"><g id="numberTickerDigit${i}" transform="translate(0 0)"><text x="0">${Array.from(
          { length: 20 },
          (_, k) => `<tspan x="0" y="${TICKER_BASE + k * TICKER_LINE}">${k % 10}</tspan>`,
        ).join("")}</text></g></g><text x="0" y="${TICKER_BASE}">{{c${i}}}</text></g>`,
    ).join("")}</g></g></svg>`,
    animate: Array.from({ length: TICKER_SLOTS }, (_, i): SvgAnimation => ({
      id: `numberTickerDigit${i}`,
      attrs: { transform: ["translate(0 0)", `translate(0 -{{roll${i}}})`] },
      delay: n(`delay${i}`),
      ms: n("ms"),
      ease: "out",
    })),
  },
};

/** Animated badge: the pill's height and top. */
const BADGE_H = 30;
const BADGE_Y = 17;

export const animatedBadge: VectorEffect = {
  kind: "vector",
  id: "animated-badge",
  name: "Animated badge",
  description: "A small \"New\" pill with a gradient fill, a shimmer sweeping across it and a sparkle popping at its corner.",
  category: "ui",
  tags: ["ui", "badge", "pill", "new", "beta", "shimmer", "saas"],
  hold: 500,
  presets: [
    { name: "Beta", values: { label: "Beta", colorA: [0.06, 0.73, 0.51], colorB: [0.02, 0.71, 0.83] } },
    { name: "Pro", values: { label: "Pro", colorA: [0.98, 0.75, 0.14], colorB: [0.98, 0.45, 0.09], ink: [0.27, 0.1, 0.01] } },
    { name: "Soft", values: { colorA: [0.93, 0.95, 1], colorB: [0.88, 0.91, 1], ink: [0.26, 0.22, 0.79], sparkle: false } },
  ],
  derived: (v) => {
    const e = Math.max(0.6, textWidthEm(String(v.label)));
    const size = r1(Math.min(14, 104 / e));
    const length = r1(e * size * 0.95);
    const w = length + 30;
    const x = r1(80 - w / 2);
    return {
      size,
      length,
      w: r1(w),
      x,
      base: r1(BADGE_Y + BADGE_H / 2 + size * 0.36),
      shineFrom: r1(x - 40),
      shineTo: r1(x + w + 20),
      spx: r1(x + w - 3),
      spy: BADGE_Y + 1,
      sp2x: r1(x + 4),
      sp2y: BADGE_Y + BADGE_H - 2,
      sparkleDisplay: v.sparkle ? "inline" : "none",
    };
  },
  motion: ((): SvgMotion => {
    const star = "M0 -8 C1 -1.5 1.5 -1 8 0 C1.5 1 1 1.5 0 8 C-1 1.5 -1.5 1 -8 0 C-1.5 -1 -1 -1.5 0 -8Z";
    const pose = (x: string, y: string, s: number, r: number) => `translate({{${x}}} {{${y}}}) scale(${s}) rotate(${r})`;
    return {
      svg: `<svg viewBox="0 0 160 64"><!-- {{label: text default='New' label='Label'}} {{colorA: color default=#6366F1 label='Colour A'}} {{colorB: color default=#EC4899 label='Colour B'}} {{ink: color default=#FFFFFF label='Text colour'}} {{sparkle: bool default=true label='Sparkle'}} --><defs><linearGradient id="animatedBadgeFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{colorA}}"/><stop offset="1" stop-color="{{colorB}}"/></linearGradient><linearGradient id="animatedBadgeShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><clipPath id="animatedBadgeClip"><rect x="{{x}}" y="${BADGE_Y}" width="{{w}}" height="${BADGE_H}" rx="${BADGE_H / 2}"/></clipPath><filter id="animatedBadgeBlur" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="6"/></filter></defs><rect id="animatedBadgeGlow" x="{{x}}" y="${BADGE_Y + 3}" width="{{w}}" height="${BADGE_H}" rx="${BADGE_H / 2}" fill="url(#animatedBadgeFill)" filter="url(#animatedBadgeBlur)" opacity="0.35"/><rect x="{{x}}" y="${BADGE_Y}" width="{{w}}" height="${BADGE_H}" rx="${BADGE_H / 2}" fill="url(#animatedBadgeFill)"/><g clip-path="url(#animatedBadgeClip)"><rect id="animatedBadgeShimmer" x="0" y="${BADGE_Y - 4}" width="28" height="${BADGE_H + 8}" fill="url(#animatedBadgeShine)" transform="translate({{shineFrom}} 0) skewX(-20)"/></g><rect x="{{x}}" y="${BADGE_Y}" width="{{w}}" height="${BADGE_H}" rx="${BADGE_H / 2}" fill="none" stroke="#FFFFFF" stroke-opacity="0.35"/><text x="80" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="700" letter-spacing="0.2" fill="{{ink}}">{{label}}</text><g display="{{sparkleDisplay}}" fill="#FFFFFF"><path id="animatedBadgeSparkle" d="${star}" transform="${pose("spx", "spy", 0, 0)}" stroke="{{colorB}}" stroke-width="0.6"/><path id="animatedBadgeSparkleSmall" d="${star}" transform="${pose("sp2x", "sp2y", 0, 0)}" stroke="{{colorA}}" stroke-width="0.8"/></g></svg>`,
      animate: [
        { id: "animatedBadgeShimmer", attrs: { transform: ["translate({{shineFrom}} 0) skewX(-20)", "translate({{shineTo}} 0) skewX(-20)"] }, ms: 1000, ease: "in-out" },
        { id: "animatedBadgeGlow", attrs: { opacity: [0.35, 0.75] }, ms: 900, ease: "in-out" },
        { id: "animatedBadgeGlow", attrs: { opacity: [0.75, 0.35] }, delay: 900, ms: 900, ease: "in-out" },
        { id: "animatedBadgeSparkle", attrs: { transform: [pose("spx", "spy", 0, 0), pose("spx", "spy", 1, 45)] }, delay: 700, ms: 260, ease: "out" },
        { id: "animatedBadgeSparkle", attrs: { transform: [pose("spx", "spy", 1, 45), pose("spx", "spy", 0, 90)] }, delay: 960, ms: 320, ease: "in-out" },
        { id: "animatedBadgeSparkleSmall", attrs: { transform: [pose("sp2x", "sp2y", 0, 0), pose("sp2x", "sp2y", 0.6, 45)] }, delay: 1000, ms: 220, ease: "out" },
        { id: "animatedBadgeSparkleSmall", attrs: { transform: [pose("sp2x", "sp2y", 0.6, 45), pose("sp2x", "sp2y", 0, 90)] }, delay: 1220, ms: 300, ease: "in-out" },
      ],
    };
  })(),
};

/** Text fitted to `width` units, at most `max` high: its font size and width. */
function fitText(text: unknown, width: number, max: number) {
  const e = Math.max(0.6, textWidthEm(String(text)));
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size) };
}

/** Instant changes: the attribute snaps to `value` at `delay`, for elements that have changed before. */
const snap = (id: string, attr: string, value: string | number, delay: number): SvgAnimation => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 });

/**
 * An instant change from `from` to `to` at `delay`. An element shows its
 * first change's starting value until that change begins, so a swap must
 * start from what was showing.
 */
const swap = (id: string, attr: string, from: string | number, to: string | number, delay: number): SvgAnimation => ({ id, attrs: { [attr]: [from, to] }, delay, ms: 0 });

/** A card's pose: moved to (`x`, `y`), turned `r` degrees, scaled `s`; the structure every card transform shares. */
const cardPose = (x: number, y: number, r = 0, s = 1) => `translate(${r1(x)} ${r1(y)}) rotate(${r1(r)}) scale(${s})`;

/*
 * Swipe stack: SVG paints in document order, so the stack is four fixed
 * layers (back, middle, front and the card flying off), each holding all
 * three cards with only one showing. At the start of each swipe every layer
 * switches to the card one place on, posed where that card already is, so
 * the picture does not change; then the layers move up a place and the
 * flying one goes. Three swipes bring every layer back where it began.
 */
const SWIPE_SLOTS = ["Back", "Mid", "Front", "Fly"] as const;
const SWIPE_POSES = { Back: cardPose(160, 136, 0, 0.88), Mid: cardPose(160, 124, 0, 0.94), Front: cardPose(160, 112) } as const;
/** The card each layer shows before swipe `k`: card k on top, the next two below, the last flown one in the hidden flying layer. */
const swipeShows = (k: number) => ({ Fly: (k + 2) % 3, Front: k % 3, Mid: (k + 1) % 3, Back: (k + 2) % 3 });
const SWIPE_START = swipeShows(0);
const SWIPE_MS = 1600;
const SWIPE_AT = 500;

/** One card of the stack, drawn round its own centre. */
function swipeCard(slot: string, i: number, shown: boolean): string {
  return `<g id="swipeStack${slot}${i}" opacity="${shown ? 1 : 0}"><rect x="-75" y="-95" width="150" height="190" rx="14" fill="{{card}}" filter="url(#swipeStackShadow)"/><rect x="-67" y="-87" width="134" height="128" rx="9" fill="url(#swipeStackPhoto${i})"/><circle cx="0" cy="-35" r="20" fill="#FFFFFF" opacity="0.4"/><path d="M-38 41 C-36 6 36 6 38 41 Z" fill="#FFFFFF" opacity="0.4"/><text x="-66" y="66" textLength="{{len${i}}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size${i}}}" font-weight="800" fill="{{ink}}">{{name${i + 1}}}</text><rect x="-66" y="76" width="70" height="5" rx="2.5" fill="{{ink}}" opacity="0.18"/></g>`;
}

export const swipeStack: VectorEffect = {
  kind: "vector",
  id: "swipe-stack",
  name: "Swipe stack",
  description: "A dating-app stack of cards: the top one is dragged and flung off to one side or the other under a LIKE or NOPE stamp, and the cards beneath move up to take its place.",
  category: "ui",
  tags: ["ui", "card", "swipe", "stack", "dating", "deck", "loop"],
  hold: 0,
  presets: [
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], card: [0.12, 0.13, 0.18], ink: [0.95, 0.96, 0.98] } },
    { name: "Products", values: { name1: "Trail runner", name2: "Rain shell", name3: "Day pack", like: "SAVE", nope: "SKIP", c1: [0.98, 0.45, 0.09], c2: [0.02, 0.71, 0.83], c3: [0.52, 0.8, 0.09] } },
  ],
  derived: (v) => {
    const out: Record<string, string | number> = {};
    for (let i = 0; i < 3; i++) {
      const { size, length } = fitText(v[`name${i + 1}`], 132, 18);
      out[`size${i}`] = size;
      out[`len${i}`] = length;
    }
    for (const stamp of ["like", "nope"]) {
      const { size, length } = fitText(v[stamp], 84, 24);
      out[`${stamp}Size`] = size;
      out[`${stamp}Len`] = length;
      out[`${stamp}W`] = r1(length + 20);
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 320 240"><!-- {{name1: text default='Alex, 27' label='Card 1'}} {{name2: text default='Sam, 31' label='Card 2'}} {{name3: text default='Jo, 24' label='Card 3'}} {{like: text default='LIKE' label='Right stamp'}} {{nope: text default='NOPE' label='Left stamp'}} {{background: color default=#F1F5F9 label='Background'}} {{card: color default=#FFFFFF label='Card'}} {{ink: color default=#0F172A label='Text colour'}} {{c1: color default=#F472B6 label='Card 1 colour'}} {{c2: color default=#818CF8 label='Card 2 colour'}} {{c3: color default=#34D399 label='Card 3 colour'}} {{likeColor: color default=#16A34A label='Right stamp colour'}} {{nopeColor: color default=#E11D48 label='Left stamp colour'}} --><defs><filter id="swipeStackShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.16"/></filter>${[0, 1, 2]
      .map((i) => `<linearGradient id="swipeStackPhoto${i}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="{{c${i + 1}}}" stop-opacity="0.65"/><stop offset="1" stop-color="{{c${i + 1}}}"/></linearGradient>`)
      .join("")}</defs><rect width="320" height="240" fill="{{background}}"/>${SWIPE_SLOTS.map(
      (slot) =>
        `<g id="swipeStack${slot}" transform="${slot === "Fly" ? SWIPE_POSES.Front : SWIPE_POSES[slot]}"${slot === "Fly" ? ` opacity="0"` : ""}>${[0, 1, 2].map((i) => swipeCard(slot, i, SWIPE_START[slot] === i)).join("")}${
          slot === "Fly"
            ? `<g id="swipeStackLike" opacity="0" transform="translate(-60 -70) rotate(-14)"><rect x="0" y="-18" width="{{likeW}}" height="36" rx="6" fill="none" stroke="{{likeColor}}" stroke-width="4"/><text x="10" y="0" dy="0.35em" textLength="{{likeLen}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{likeSize}}" font-weight="900" fill="{{likeColor}}">{{like}}</text></g><g id="swipeStackNope" opacity="0" transform="translate(60 -70) rotate(14)"><rect x="-{{nopeW}}" y="-18" width="{{nopeW}}" height="36" rx="6" fill="none" stroke="{{nopeColor}}" stroke-width="4"/><text x="-10" y="0" dy="0.35em" text-anchor="end" textLength="{{nopeLen}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{nopeSize}}" font-weight="900" fill="{{nopeColor}}">{{nope}}</text></g>`
            : ""
        }</g>`,
    ).join("")}</svg>`,
    animate: [0, 1, 2].flatMap((k): SvgAnimation[] => {
      const at = k * SWIPE_MS + SWIPE_AT;
      // Which card each layer shows once this swipe starts: the front's goes flying, the rest move up.
      const before = swipeShows(k);
      const shows = swipeShows(k + 1);
      const after = { Fly: k % 3, Front: shows.Front, Mid: shows.Mid, Back: k % 3 };
      const right = k % 2 === 0;
      const dir = right ? 1 : -1;
      const stamp = right ? "swipeStackLike" : "swipeStackNope";
      const flung = cardPose(160 + 300 * dir, 70, 26 * dir);
      return [
        ...SWIPE_SLOTS.flatMap((slot) =>
          [0, 1, 2].filter((i) => (before[slot] === i) !== (after[slot] === i)).map((i) => swap(`swipeStack${slot}${i}`, "opacity", before[slot] === i ? 1 : 0, after[slot] === i ? 1 : 0, at)),
        ),
        swap("swipeStackFly", "opacity", 0, 1, at),
        swap("swipeStackFront", "transform", SWIPE_POSES.Front, SWIPE_POSES.Mid, at),
        swap("swipeStackMid", "transform", SWIPE_POSES.Mid, SWIPE_POSES.Back, at),
        swap("swipeStackBack", "opacity", 1, 0, at),
        // Dragged a little way under the stamp, then flung off.
        { id: "swipeStackFly", attrs: { transform: [SWIPE_POSES.Front, cardPose(160 + 34 * dir, 106, 7 * dir)] }, delay: at, ms: 280, ease: "out" },
        { id: stamp, attrs: { opacity: [0, 1] }, delay: at + 60, ms: 200 },
        { id: "swipeStackFly", attrs: { transform: [cardPose(160 + 34 * dir, 106, 7 * dir), flung] }, delay: at + 320, ms: 380, ease: [0.5, 0, 0.9, 0.6] },
        swap("swipeStackFly", "opacity", 1, 0, at + 700),
        swap(stamp, "opacity", 1, 0, at + 700),
        swap("swipeStackFly", "transform", flung, SWIPE_POSES.Front, at + 700),
        // The rest step up a place as it goes, and the card it took slides in at the back.
        { id: "swipeStackFront", attrs: { transform: [SWIPE_POSES.Mid, SWIPE_POSES.Front] }, delay: at + 320, ms: 420, ease: { spring: { stiffness: 260, damping: 20 } } },
        { id: "swipeStackMid", attrs: { transform: [SWIPE_POSES.Back, SWIPE_POSES.Mid] }, delay: at + 380, ms: 420, ease: { spring: { stiffness: 260, damping: 20 } } },
        { id: "swipeStackBack", attrs: { opacity: [0, 1] }, delay: at + 500, ms: 300 },
      ];
    }),
  },
};

/*
 * Pack opening: the cards wait inside the pack, drawn behind its front, so
 * they come up out of its torn top. The rare card is drawn last of them, on
 * top of the fan.
 */
const PACK_CARDS = [0, 1, 3, 4, 2] as const;
const PACK_RARE = 2;
const packFan = (i: number) => (i === PACK_RARE ? cardPose(160, 104, 0, 1.16) : cardPose(160 + (i - 2) * 44, 116 + Math.abs(i - 2) * 9, (i - 2) * 13));
const packInside = (i: number) => cardPose(160 + (i - 2) * 4, 150);
const packRisen = (i: number) => cardPose(160 + (i - 2) * 12, 52 - (i === PACK_RARE ? 8 : 0));
const PACK_SPARKLES: readonly [number, number, number][] = [[104, 46, 1], [222, 58, 0.8], [96, 150, 0.7], [226, 160, 1]];
const SPARKLE = "M0 -8 C1 -1.5 1.5 -1 8 0 C1.5 1 1 1.5 0 8 C-1 1.5 -1.5 1 -8 0 C-1.5 -1 -1 -1.5 0 -8Z";
const PACK_OUT = 3900;

/** A card of the pack, round its own centre: the rare one has gold edges and holographic art. */
function packCard(i: number): string {
  const rare = i === PACK_RARE;
  const art = rare ? "url(#packOpeningHolo)" : `{{art${i % 3}}}`;
  return `<g id="packOpeningCard${i}" transform="${packInside(i)}"><rect x="-35" y="-49" width="70" height="98" rx="6" fill="${rare ? "{{rare}}" : "{{card}}"}" stroke="#000000" stroke-opacity="0.12"/><rect x="-29" y="-43" width="58" height="50" rx="3" fill="${art}"/>${
    rare
      ? `<g clip-path="url(#packOpeningArtClip)"><rect id="packOpeningSheen" x="-20" y="-60" width="16" height="80" fill="#FFFFFF" opacity="0.55" transform="translate(-50 0) rotate(20)"/></g>`
      : ""
  }<rect x="-29" y="13" width="40" height="4" rx="2" fill="#000000" opacity="0.2"/><rect x="-29" y="22" width="52" height="3" rx="1.5" fill="#000000" opacity="0.12"/><rect x="-29" y="29" width="46" height="3" rx="1.5" fill="#000000" opacity="0.12"/><path d="${SPARKLE}" transform="translate(23 37) scale(0.6)" fill="${rare ? "#FFFFFF" : "#000000"}" opacity="${rare ? 0.9 : 0.25}"/></g>`;
}

export const packOpening: VectorEffect = {
  kind: "vector",
  id: "pack-opening",
  name: "Pack opening",
  description: "A foil booster pack shaking, its top tearing off and a hand of trading cards rising out of it and fanning open, the rare one in the middle lifting, glowing and catching a holographic shine.",
  category: "ui",
  tags: ["ui", "card", "trading-card", "pack", "reveal", "rare", "holographic", "reward", "celebration", "loop"],
  hold: 400,
  presets: [
    { name: "Midnight", values: { background: [0.05, 0.06, 0.1], pack: [0.12, 0.16, 0.42], pack2: [0.47, 0.18, 0.7], rare: [0.96, 0.78, 0.3] } },
    { name: "Fire set", values: { label: "BLAZE", pack: [0.86, 0.15, 0.15], pack2: [0.98, 0.6, 0.1], art0: [0.98, 0.45, 0.09], art1: [0.86, 0.15, 0.15], art2: [0.98, 0.75, 0.14] } },
  ],
  derived: (v) => {
    const { size, length } = fitText(v.label, 92, 26);
    return { size, length, base: r1(132 + size * 0.36) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 240"><!-- {{label: text default='MYTHIC' label='Set name'}} {{background: color default=#EEF2FF label='Background'}} {{pack: color default=#4338CA label='Pack'}} {{pack2: color default=#DB2777 label='Pack second colour'}} {{card: color default=#F8FAFC label='Card'}} {{rare: color default=#F5C542 label='Rare card edge'}} {{art0: color default=#38BDF8 label='Art colour 1'}} {{art1: color default=#A78BFA label='Art colour 2'}} {{art2: color default=#4ADE80 label='Art colour 3'}} {{ink: color default=#FFFFFF label='Label colour'}} --><defs><linearGradient id="packOpeningFoil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{pack}}"/><stop offset="1" stop-color="{{pack2}}"/></linearGradient><linearGradient id="packOpeningGloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><linearGradient id="packOpeningHolo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8AD8"/><stop offset="0.25" stop-color="#FFE27A"/><stop offset="0.5" stop-color="#7DFFB2"/><stop offset="0.75" stop-color="#7CC8FF"/><stop offset="1" stop-color="#C69CFF"/></linearGradient><radialGradient id="packOpeningHalo"><stop offset="0" stop-color="{{rare}}" stop-opacity="0.9"/><stop offset="1" stop-color="{{rare}}" stop-opacity="0"/></radialGradient><clipPath id="packOpeningArtClip"><rect x="-29" y="-43" width="58" height="50" rx="3"/></clipPath><filter id="packOpeningShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.22"/></filter></defs><rect width="320" height="240" fill="{{background}}"/><circle id="packOpeningHaloRing" cx="160" cy="104" r="100" fill="url(#packOpeningHalo)" opacity="0"/><g id="packOpeningAll" opacity="0"><g filter="url(#packOpeningShadow)">${PACK_CARDS.map(packCard).join("")}</g><g id="packOpeningPack" transform="translate(0 0) rotate(0 160 130)"><path d="M100 62 L220 62 L220 206 L214 212 L208 206 L202 212 L196 206 L190 212 L184 206 L178 212 L172 206 L166 212 L160 206 L154 212 L148 206 L142 212 L136 206 L130 212 L124 206 L118 212 L112 206 L106 212 L100 206 Z" fill="url(#packOpeningFoil)" filter="url(#packOpeningShadow)"/><rect x="100" y="62" width="120" height="146" fill="url(#packOpeningGloss)"/><path d="M100 64 L220 64" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="160" cy="128" r="34" fill="#FFFFFF" opacity="0.14"/><text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size}}" font-weight="900" fill="{{ink}}">{{label}}</text><rect x="122" y="168" width="76" height="6" rx="3" fill="#FFFFFF" opacity="0.35"/></g><g id="packOpeningStrip" transform="translate(0 0) rotate(0 220 62)" opacity="1"><path d="M100 46 L106 40 L112 46 L118 40 L124 46 L130 40 L136 46 L142 40 L148 46 L154 40 L160 46 L166 40 L172 46 L178 40 L184 46 L190 40 L196 46 L202 40 L208 46 L214 40 L220 46 L220 63 L100 63 Z" fill="url(#packOpeningFoil)"/><rect x="100" y="46" width="120" height="17" fill="#000000" opacity="0.12"/></g></g><g fill="#FFFFFF" stroke="{{rare}}" stroke-width="0.8">${PACK_SPARKLES.map(
      ([x, y], k) => `<path id="packOpeningSparkle${k}" d="${SPARKLE}" transform="translate(${x} ${y}) scale(0) rotate(0)"/>`,
    ).join("")}</g></svg>`,
    animate: [
      { id: "packOpeningAll", attrs: { opacity: [0, 1] }, ms: 250 },
      // A shake of anticipation.
      { id: "packOpeningPack", attrs: { transform: ["translate(0 0) rotate(-3 160 130)", "translate(0 0) rotate(3 160 130)"] }, delay: 300, ms: 70, repeat: 6, alternate: true, ease: "in-out" },
      { id: "packOpeningStrip", attrs: { transform: ["translate(0 0) rotate(-3 220 62)", "translate(0 0) rotate(3 220 62)"] }, delay: 300, ms: 70, repeat: 6, alternate: true, ease: "in-out" },
      { id: "packOpeningPack", attrs: { transform: ["translate(0 0) rotate(3 160 130)", "translate(0 0) rotate(0 160 130)"] }, delay: 720, ms: 80 },
      { id: "packOpeningStrip", attrs: { transform: ["translate(0 0) rotate(3 220 62)", "translate(0 0) rotate(0 220 62)"] }, delay: 720, ms: 80 },
      // The top tears off and flies away.
      { id: "packOpeningStrip", attrs: { transform: ["translate(0 0) rotate(0 220 62)", "translate(60 -70) rotate(28 220 62)"] }, delay: 820, ms: 420, ease: "out" },
      { id: "packOpeningStrip", attrs: { opacity: [1, 0] }, delay: 1000, ms: 240 },
      // The cards rise out of the pack, then the pack drops away as they fan open.
      ...PACK_CARDS.map((i, k): SvgAnimation => ({ id: `packOpeningCard${i}`, attrs: { transform: [packInside(i), packRisen(i)] }, delay: 1050 + k * 50, ms: 420, ease: "out" })),
      { id: "packOpeningPack", attrs: { transform: ["translate(0 0) rotate(0 160 130)", "translate(0 190) rotate(8 160 130)"] }, delay: 1500, ms: 420, ease: "in-out" },
      ...PACK_CARDS.map((i, k): SvgAnimation => ({ id: `packOpeningCard${i}`, attrs: { transform: [packRisen(i), packFan(i)] }, delay: 1620 + k * 30, ms: 520, ease: { spring: { stiffness: 200, damping: 17 } } })),
      // The rare card glows and shines, with sparkles popping round it.
      { id: "packOpeningHaloRing", attrs: { opacity: [0, 0.75] }, delay: 2050, ms: 400, ease: "out" },
      { id: "packOpeningHaloRing", attrs: { r: [100, 112] }, delay: 2050, ms: 900, repeat: 2, alternate: true },
      { id: "packOpeningSheen", attrs: { transform: ["translate(-50 0) rotate(20)", "translate(70 0) rotate(20)"] }, delay: 2200, ms: 700, ease: "in-out" },
      ...PACK_SPARKLES.flatMap(([x, y, s], k): SvgAnimation[] => [
        { id: `packOpeningSparkle${k}`, attrs: { transform: [`translate(${x} ${y}) scale(0) rotate(0)`, `translate(${x} ${y}) scale(${s}) rotate(45)`] }, delay: 2150 + k * 140, ms: 260, ease: "out" },
        { id: `packOpeningSparkle${k}`, attrs: { transform: [`translate(${x} ${y}) scale(${s}) rotate(45)`, `translate(${x} ${y}) scale(0) rotate(90)`] }, delay: 2410 + k * 140, ms: 320, ease: "in-out" },
      ]),
      // All fades, then everything goes back inside the pack for the next round.
      { id: "packOpeningAll", attrs: { opacity: [1, 0] }, delay: PACK_OUT, ms: 350 },
      { id: "packOpeningHaloRing", attrs: { opacity: [0.75, 0] }, delay: PACK_OUT, ms: 350 },
      snap("packOpeningPack", "transform", "translate(0 0) rotate(0 160 130)", PACK_OUT + 360),
      snap("packOpeningStrip", "transform", "translate(0 0) rotate(0 220 62)", PACK_OUT + 360),
      snap("packOpeningStrip", "opacity", 1, PACK_OUT + 360),
      snap("packOpeningSheen", "transform", "translate(-50 0) rotate(20)", PACK_OUT + 360),
      ...PACK_CARDS.map((i) => snap(`packOpeningCard${i}`, "transform", packInside(i), PACK_OUT + 360)),
    ],
  },
};

// ── AI prompt bar ──────────────────────────────────────────────────────

/**
 * AI prompt bar's layout and timing: a frosted panel holding the input
 * field (send button at its right end) over a row of chips. A request types
 * into the field at `pace` ms a letter while a beam runs round the panel,
 * the send button is pressed, then the action chip lights and a shimmer
 * sweeps the field while it "thinks". Times are in ms.
 */
const PROMPT = {
  panel: { x: 20, y: 22, w: 360, h: 116, rx: 18 },
  field: { x: 32, y: 34, w: 336, h: 42 },
  send: { cx: 346, cy: 55, r: 15 },
  chipY: 92,
  chipH: 30,
  intro: 450,
  turn: 1700,
  think: 1500,
};
/** The panel's outline, from the middle of its top edge round clockwise. */
const PROMPT_OUTLINE = (() => {
  const { x, y, w, h, rx } = PROMPT.panel;
  const r = rx;
  return `M${x + w / 2} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
})();
const SPARKLE_PATH = "M0 -6 C0.8 -1.2 1.2 -0.8 6 0 C1.2 0.8 0.8 1.2 0 6 C-0.8 1.2 -1.2 0.8 -6 0 C-1.2 -0.8 -0.8 -1.2 0 -6Z";

export const aiPromptBar: VectorEffect = {
  kind: "vector",
  id: "ai-prompt-bar",
  name: "AI prompt bar",
  description:
    "A frosted AI prompt box: a request types into the field while a glowing beam runs round the panel, the send button presses with a ripple, then the action chip lights up and a shimmer sweeps the text while it thinks.",
  category: "ui",
  tags: ["ui", "ai", "prompt", "chat", "typing", "assistant", "tech", "product-demo"],
  hold: 1400,
  presets: [
    { name: "Light", values: { background: [0.93, 0.95, 0.96], panel: [1, 1, 1], field: [0.95, 0.97, 0.98], text: [0.08, 0.12, 0.18], ink: [0.25, 0.3, 0.36], accent: [0.05, 0.6, 0.62], accent2: [0.39, 0.4, 0.95] } },
    { name: "Violet", values: { background: [0.05, 0.04, 0.1], panel: [0.11, 0.09, 0.2], accent: [0.66, 0.55, 1], accent2: [0.95, 0.45, 0.8], ink: [0.88, 0.86, 1] } },
    { name: "Search", values: { prompt: "Summarise this quarter's customer feedback", agent: "Insights", action: "Search", placeholder: "Search anything…" } },
  ],
  derived: (v) => {
    const { field: f, send } = PROMPT;
    const room = send.cx - send.r - 10 - (f.x + 16);
    const typed = fitLabel(v.prompt, room, 12.5, 8);
    const hint = fitLabel(v.placeholder, room, 12.5, 8);
    const letters = Math.max(1, Array.from(typed.text).length);
    const typing = Math.round(letters * Math.min(200, Math.max(10, Number(v.pace) || 40)));
    const sent = PROMPT.intro + 250 + typing + 200;
    const lit = sent + 320;
    const done = lit + PROMPT.think;
    const chip = (text: unknown, max: number) => {
      const l = fitLabel(text, max, 10.5, 8);
      return { ...l, w: Math.round(l.length + 40) };
    };
    const agent = chip(v.agent, 110);
    const action = chip(v.action, 120);
    const { x, w } = PROMPT.panel;
    const agentX = x + 12;
    const actionX = x + w - 12 - action.w;
    const turns = Math.max(1, Math.round((done - PROMPT.intro) / PROMPT.turn));
    return {
      typed: typed.text,
      hint: hint.text,
      textSize: typed.size,
      hintSize: hint.size,
      textY: r1(f.y + f.h / 2 + typed.size * 0.36),
      hintY: r1(f.y + f.h / 2 + hint.size * 0.36),
      typeAt: PROMPT.intro + 250,
      typing,
      sent,
      sentUp: sent + 120,
      lit,
      think2: lit + PROMPT.think / 2,
      done,
      beamMs: done - PROMPT.intro,
      beamEnd: -100 * turns,
      agentText: agent.text,
      agentSize: agent.size,
      agentLength: agent.length,
      agentX,
      agentW: agent.w,
      agentIconX: agentX + 14,
      agentTextX: agentX + 26,
      plusX: agentX + agent.w + 8,
      plusTextX: agentX + agent.w + 8 + 17,
      actionText: action.text,
      actionSize: action.size,
      actionLength: action.length,
      actionX,
      actionW: action.w,
      actionIcon: `translate(${actionX + 15} ${PROMPT.chipY + PROMPT.chipH / 2})`,
      actionIconTurned: `translate(${actionX + 15} ${PROMPT.chipY + PROMPT.chipH / 2}) rotate(180)`,
      actionTextX: actionX + 27,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: ((): SvgMotion => {
    const { panel: p, field: f, send: s, chipY, chipH } = PROMPT;
    const cy = chipY + chipH / 2;
    const at = (scale: number) => `translate(${s.cx} ${s.cy}) scale(${scale})`;
    const svg = `<svg viewBox="0 0 400 160" font-family="${SANS}"><!-- {{prompt: text default='Analyse Federal Decree-Law No. 45 of 2021 in healthcare' label='Request'}} {{placeholder: text default='Ask a question…' label='Placeholder'}} {{agent: text default='My agent' label='Agent chip'}} {{action: text default='AI Analysis' label='Action chip'}} {{pace: float min=10 max=200 default=40 step=5 label='Ms per letter'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{panel: color default=#14303A label='Panel'}} {{field: color default=#E6F0F1 label='Field'}} {{text: color default=#16262B label='Typed text'}} {{ink: color default=#D7E3E6 label='Chip text'}} {{accent: color default=#5EC8C4 label='Accent'}} {{accent2: color default=#8F7CF7 label='Second accent'}} {{glow: float min=0 max=6 default=3 step=0.5 label='Glow'}} --><defs><filter id="aiPromptBarGlow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="aiPromptBarSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.1"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><linearGradient id="aiPromptBarShimmerFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{accent}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{accent}}" stop-opacity="0.45"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient><linearGradient id="aiPromptBarRimStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{accent}}"/><stop offset="1" stop-color="{{accent2}}"/></linearGradient><clipPath id="aiPromptBarFieldClip"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.h / 2}"/></clipPath></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="160" fill="{{background}}"/></g><g id="aiPromptBarPanel" opacity="0"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="{{panel}}" fill-opacity="0.92"/><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="url(#aiPromptBarSheen)" stroke="{{ink}}" stroke-opacity="0.14"/><path id="aiPromptBarRim" d="${PROMPT_OUTLINE}" fill="none" stroke="url(#aiPromptBarRimStroke)" stroke-width="1.2" opacity="0"/><path id="aiPromptBarBeam" d="${PROMPT_OUTLINE}" pathLength="100" fill="none" stroke="{{accent}}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="12 88" stroke-dashoffset="0" filter="url(#aiPromptBarGlow)" opacity="0"/><path id="aiPromptBarBeam2" d="${PROMPT_OUTLINE}" pathLength="100" fill="none" stroke="{{accent2}}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="12 88" stroke-dashoffset="-50" filter="url(#aiPromptBarGlow)" opacity="0"/><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.h / 2}" fill="{{field}}"/><g clip-path="url(#aiPromptBarFieldClip)"><text id="aiPromptBarHint" x="${f.x + 16}" y="{{hintY}}" font-size="{{hintSize}}" fill="{{text}}" opacity="0.45">{{hint}}</text><text id="aiPromptBarText" x="${f.x + 16}" y="{{textY}}" font-size="{{textSize}}" font-weight="500" fill="{{text}}" opacity="0" xml:space="preserve"></text><rect id="aiPromptBarShimmer" x="${f.x - 120}" y="${f.y}" width="120" height="${f.h}" fill="url(#aiPromptBarShimmerFill)" opacity="0"/></g><circle id="aiPromptBarRipple" cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="none" stroke="{{accent}}" stroke-width="2" opacity="0"/><g id="aiPromptBarSend" transform="${at(1)}"><circle r="${s.r}" fill="{{panel}}"/><circle id="aiPromptBarSendLit" r="${s.r}" fill="{{accent}}" opacity="0"/><path d="M-5 0 H5 M1 -4.5 L5.5 0 L1 4.5" fill="none" stroke="{{field}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><g><rect x="{{agentX}}" y="${chipY}" width="{{agentW}}" height="${chipH}" rx="${chipH / 2}" fill="{{ink}}" fill-opacity="0.06" stroke="{{ink}}" stroke-opacity="0.14"/><rect x="{{agentIconX}}" y="${cy - 5}" width="10" height="10" rx="2.5" transform="translate(-5 0)" fill="none" stroke="{{ink}}" stroke-width="1.4"/><text x="{{agentTextX}}" y="${cy + 3.6}" font-size="{{agentSize}}" textLength="{{agentLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{agentText}}</text><rect x="{{plusX}}" y="${chipY}" width="34" height="${chipH}" rx="${chipH / 2}" fill="{{ink}}" fill-opacity="0.06" stroke="{{ink}}" stroke-opacity="0.14"/><text x="{{plusTextX}}" y="${cy + 3.6}" text-anchor="middle" font-size="10.5" fill="{{ink}}" fill-opacity="0.75">+3</text></g><g><rect x="{{actionX}}" y="${chipY}" width="{{actionW}}" height="${chipH}" rx="${chipH / 2}" fill="{{accent}}" fill-opacity="0.14" stroke="{{accent}}" stroke-opacity="0.45"/><rect id="aiPromptBarActionLit" x="{{actionX}}" y="${chipY}" width="{{actionW}}" height="${chipH}" rx="${chipH / 2}" fill="{{accent}}" filter="url(#aiPromptBarGlow)" opacity="0"/><path id="aiPromptBarSpark" d="${SPARKLE_PATH}" transform="{{actionIcon}}" fill="{{ink}}"/><text id="aiPromptBarActionText" x="{{actionTextX}}" y="${cy + 3.6}" font-size="{{actionSize}}" textLength="{{actionLength}}" lengthAdjust="spacingAndGlyphs" font-weight="600" fill="{{ink}}">{{actionText}}</text></g></g></svg>`;
    const animate: SvgAnimation[] = [
        { id: "aiPromptBarPanel", attrs: { opacity: [0, 1], transform: ["translate(0 10)", "translate(0 0)"] }, ms: PROMPT.intro, ease: "out" },
        // Focused: the rim comes up and two beams chase round the panel.
        { id: "aiPromptBarRim", attrs: { opacity: [0, 0.7] }, delay: PROMPT.intro, ms: 300 },
        { id: "aiPromptBarBeam", attrs: { opacity: [0, 1] }, delay: PROMPT.intro, ms: 300 },
        { id: "aiPromptBarBeam2", attrs: { opacity: [0, 1] }, delay: PROMPT.intro, ms: 300 },
        { id: "aiPromptBarBeam", attrs: { "stroke-dashoffset": [0, n("beamEnd")] }, delay: PROMPT.intro, ms: n("beamMs"), ease: "linear" },
        { id: "aiPromptBarBeam2", attrs: { "stroke-dashoffset": [-50, `{{beamEnd}}` as unknown as number] }, delay: PROMPT.intro, ms: n("beamMs"), ease: "linear" },
        // Typing.
        { id: "aiPromptBarHint", attrs: { opacity: [0.45, 0] }, delay: n("typeAt"), ms: 1 },
        { id: "aiPromptBarText", attrs: { opacity: [0, 1] }, delay: n("typeAt"), ms: 1 },
        { id: "aiPromptBarText", write: "{{typed}}", caret: "|", delay: n("typeAt"), ms: n("typing"), ease: "linear" },
        // Sent: the button presses, lights and throws a ripple.
        { id: "aiPromptBarSend", attrs: { transform: [at(1), at(0.82)] }, delay: n("sent"), ms: 120, ease: "out" },
        { id: "aiPromptBarSend", attrs: { transform: [at(0.82), at(1)] }, delay: n("sentUp"), ms: 260, ease: { spring: { stiffness: 260, damping: 14 } } },
        { id: "aiPromptBarSendLit", attrs: { opacity: [0, 1] }, delay: n("sent"), ms: 120 },
        { id: "aiPromptBarSendLit", attrs: { opacity: [1, 0] }, delay: n("done"), ms: 400 },
        { id: "aiPromptBarRipple", attrs: { r: [s.r, s.r + 16], opacity: [0.9, 0], "stroke-width": [2, 0.5] }, delay: n("sent"), ms: 600, ease: "out" },
        // Thinking: the action chip lights, its sparkle turns, and a shimmer sweeps the request twice.
        { id: "aiPromptBarActionLit", attrs: { opacity: [0, 0.9] }, delay: n("lit"), ms: 250, ease: "out" },
        { id: "aiPromptBarActionText", attrs: { fill: ["{{ink}}", "{{panel}}"] }, delay: n("lit"), ms: 250 },
        { id: "aiPromptBarSpark", attrs: { fill: ["{{ink}}", "{{panel}}"] }, delay: n("lit"), ms: 250 },
        { id: "aiPromptBarSpark", attrs: { transform: ["{{actionIcon}}", "{{actionIconTurned}}"] }, delay: n("lit"), ms: PROMPT.think, ease: "in-out" },
        { id: "aiPromptBarShimmer", attrs: { opacity: [0, 1] }, delay: n("lit"), ms: 1 },
        { id: "aiPromptBarShimmer", attrs: { x: [f.x - 120, f.x + f.w] }, delay: n("lit"), ms: PROMPT.think / 2, ease: "in-out" },
        { id: "aiPromptBarShimmer", attrs: { x: [f.x - 120, f.x + f.w] }, delay: n("think2"), ms: PROMPT.think / 2, ease: "in-out" },
        { id: "aiPromptBarActionLit", attrs: { opacity: [0.9, 0.35] }, delay: n("done"), ms: 500, ease: "in-out" },
        { id: "aiPromptBarBeam", attrs: { opacity: [1, 0] }, delay: n("done"), ms: 500 },
        { id: "aiPromptBarBeam2", attrs: { opacity: [1, 0] }, delay: n("done"), ms: 500 },
      ];
    return { svg, animate };
  })(),
};

// ── Insight cards ──────────────────────────────────────────────────────

/**
 * Insight cards' layout and timing: a glass panel with a header (a sparkle,
 * the heading, a "+n" pill and a close mark) over up to `slots` finding
 * cards. Each card arrives as a shimmering skeleton, then its text fades
 * in; the flagged card then gets a red wash and a glowing border that
 * traces round it and pulses. Times are in ms.
 */
const INSIGHT = {
  slots: 3,
  panel: { x: 16, y: 12, w: 368, rx: 16 },
  card: { x: 28, w: 344, top: 52, room: 174, gap: 8, rx: 10 },
  intro: 420,
  stagger: 520,
  skeleton: 420,
};

/** `text` broken into at most `lines` lines of `width` at `size`, the last cut short with an ellipsis if it runs over. */
export function wrapText(text: string, width: number, size: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const fits = (s: string) => textWidthEm(s) * size <= width;
  const out: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (fits(next) || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = words[i]!;
    if (out.length === lines) break;
  }
  if (out.length < lines && line) {
    out.push(line);
    i = words.length;
  }
  if (i < words.length || !fits(out[out.length - 1] ?? "")) {
    let last = out[out.length - 1] ?? "";
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
    out[out.length - 1] = `${last}…`;
  }
  return out;
}

/** The outline of a rounded rectangle, from the middle of its top edge round clockwise. */
const roundedOutline = (x: number, y: number, w: number, h: number, r: number) =>
  `M${r1(x + w / 2)} ${r1(y)} H${r1(x + w - r)} A${r} ${r} 0 0 1 ${r1(x + w)} ${r1(y + r)} V${r1(y + h - r)} A${r} ${r} 0 0 1 ${r1(x + w - r)} ${r1(y + h)} H${r1(x + r)} A${r} ${r} 0 0 1 ${r1(x)} ${r1(y + h - r)} V${r1(y + r)} A${r} ${r} 0 0 1 ${r1(x + r)} ${r1(y)} Z`;

export const insightCards: VectorEffect = {
  kind: "vector",
  id: "insight-cards",
  name: "Insight cards",
  description:
    "An AI analysis panel whose findings drop in one after another, each as a shimmering skeleton before its title, source link and summary fade in; then the flagged one turns red, a glowing border tracing round it and pulsing.",
  category: "ui",
  tags: ["ui", "ai", "insight", "alert", "card", "assistant", "dashboard", "tech", "product-demo"],
  hold: 1600,
  presets: [
    { name: "Light", values: { background: [0.93, 0.95, 0.96], panel: [1, 1, 1], ink: [0.1, 0.14, 0.2], accent: [0.05, 0.55, 0.58], alert: [0.86, 0.2, 0.22] } },
    { name: "Amber warning", values: { alert: [0.98, 0.65, 0.15], title1: "Deadline at risk", source1: "Q3 roadmap", body1: "Three dependencies are behind schedule and block the launch milestone." } },
    { name: "No flag", values: { flagged: 0 } },
    { name: "Two findings", values: { count: 2 } },
  ],
  derived: (v) => {
    const count = Math.min(INSIGHT.slots, Math.max(1, Math.round(Number(v.count)) || 1));
    const flagged = Math.min(count, Math.max(0, Math.round(Number(v.flagged)) || 0));
    const { card: c } = INSIGHT;
    const h = Math.min(66, (c.room - (count - 1) * c.gap) / count);
    const out: Record<string, string | number> = {};
    for (let i = 0; i < INSIGHT.slots; i++) {
      const shown = i < count;
      const y = r1(c.top + i * (h + c.gap));
      const source = fitLabel(v[`source${i + 1}`], 140, 9, 7);
      const title = fitLabel(v[`title${i + 1}`], c.w - 40 - source.length - 30, 11, 8);
      const body = wrapText(String(v[`body${i + 1}`] ?? ""), c.w - 32, 9, h >= 50 ? 2 : 1);
      const at = INSIGHT.intro + 200 + i * INSIGHT.stagger;
      out[`show${i}`] = shown ? "inline" : "none";
      out[`y${i}`] = y;
      out[`h${i}`] = r1(h);
      out[`titleY${i}`] = r1(y + 19);
      out[`bodyY${i}`] = r1(y + 34);
      out[`body2Y${i}`] = r1(y + 46);
      out[`bracket${i}`] = `M${c.x + 17} ${r1(y + 10)} h-3 v12 h3`;
      out[`title${i}`] = title.text;
      out[`titleSize${i}`] = title.size;
      out[`titleLength${i}`] = title.length;
      out[`source${i}`] = source.text;
      out[`sourceSize${i}`] = source.size;
      out[`sourceLength${i}`] = source.length;
      out[`body${i}`] = body[0] ?? "";
      out[`bodyMore${i}`] = body[1] ?? "";
      out[`skel${i}`] = r1(c.w - 40);
      out[`arrive${i}`] = at;
      out[`text${i}`] = at + INSIGHT.skeleton;
      out[`skeletonOut${i}`] = at + INSIGHT.skeleton - 60;
      out[`outline${i}`] = roundedOutline(c.x, y, c.w, h, c.rx);
      out[`wash${i}`] = i === flagged - 1 ? 1 : 0;
    }
    const settled = INSIGHT.intro + 200 + (count - 1) * INSIGHT.stagger + INSIGHT.skeleton + 300;
    return {
      ...out,
      panelH: r1(c.top - INSIGHT.panel.y + count * h + (count - 1) * c.gap + 12),
      offsetY: r1((250 - (c.top - INSIGHT.panel.y + count * h + (count - 1) * c.gap + 12)) / 2 - INSIGHT.panel.y),
      flagShow: flagged ? "inline" : "none",
      flagOutline: flagged ? out[`outline${flagged - 1}`]! : "M0 0",
      flagY: flagged ? out[`y${flagged - 1}`]! : 0,
      flagH: flagged ? out[`h${flagged - 1}`]! : 0,
      flagAt: settled,
      flagLit: settled + 700,
      heading: fitLabel(String(v.heading ?? "").toUpperCase(), 180, 9.5, 7).text,
      more: Math.max(0, Math.round(Number(v.more)) || 0),
      moreShow: Math.round(Number(v.more)) > 0 ? "inline" : "none",
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: ((): SvgMotion => {
    const { panel: p, card: c } = INSIGHT;
    const slots = Array.from({ length: INSIGHT.slots }, (_, i) => i);
    const cards = slots
      .map(
        (i) =>
          `<g id="insightCardsCard${i}" display="{{show${i}}}" opacity="0"><rect x="${c.x}" y="{{y${i}}}" width="${c.w}" height="{{h${i}}}" rx="${c.rx}" fill="{{ink}}" fill-opacity="0.05" stroke="{{ink}}" stroke-opacity="0.1"/><rect x="${c.x}" y="{{y${i}}}" width="${c.w}" height="{{h${i}}}" rx="${c.rx}" fill="url(#insightCardsWashFill)" opacity="0" id="insightCardsWash${i}"/><g id="insightCardsSkeleton${i}"><rect x="${c.x + 14}" y="{{titleY${i}}}" transform="translate(0 -8)" width="120" height="9" rx="4.5" fill="{{ink}}" fill-opacity="0.12"/><rect x="${c.x + 14}" y="{{bodyY${i}}}" transform="translate(0 -7)" width="{{skel${i}}}" height="7" rx="3.5" fill="{{ink}}" fill-opacity="0.08"/><rect id="insightCardsShine${i}" x="${c.x - 80}" y="{{y${i}}}" width="80" height="{{h${i}}}" fill="url(#insightCardsShineFill)"/></g><g id="insightCardsText${i}" opacity="0"><path d="{{bracket${i}}}" fill="none" stroke="{{accent}}" stroke-width="1.4" stroke-linecap="round"/><path id="insightCardsAlertBracket${i}" d="{{bracket${i}}}" fill="none" stroke="{{alert}}" stroke-width="1.6" stroke-linecap="round" opacity="0"/><text x="${c.x + 22}" y="{{titleY${i}}}" font-size="{{titleSize${i}}}" textLength="{{titleLength${i}}}" lengthAdjust="spacingAndGlyphs" font-weight="600" fill="{{ink}}">{{title${i}}}</text><text x="${c.x + c.w - 26}" y="{{titleY${i}}}" text-anchor="end" font-size="{{sourceSize${i}}}" textLength="{{sourceLength${i}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.8">{{source${i}}}</text><path d="M${c.x + c.w - 19} {{titleY${i}}} l6 -6 m-4.2 0 h4.2 v4.2" transform="translate(0 -1)" fill="none" stroke="{{accent}}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><text x="${c.x + 14}" y="{{bodyY${i}}}" font-size="9" fill="{{ink}}" fill-opacity="0.6">{{body${i}}}</text><text x="${c.x + 14}" y="{{body2Y${i}}}" font-size="9" fill="{{ink}}" fill-opacity="0.6">{{bodyMore${i}}}</text></g></g>`,
      )
      .join("");
    const svg = `<svg viewBox="0 0 400 250" font-family="${SANS}"><!-- {{heading: text default='AI Analysis' label='Heading'}} {{count: int min=1 max=3 default=3 label='Findings'}} {{flagged: int min=0 max=3 default=1 label='Flagged finding (0: none)'}} {{more: int min=0 max=99 default=3 label='More findings (the +n pill; 0 hides it)'}} {{title1: text default='Critical concerns' label='Finding 1 title'}} {{source1: text default='Federal Decree-Law No. 42' label='Finding 1 source'}} {{body1: text default='These laws have run into unexpected challenges from several bodies during implementation.' label='Finding 1 summary'}} {{title2: text default='Propose deregulation' label='Finding 2 title'}} {{source2: text default='Federal Law on Mental Health' label='Finding 2 source'}} {{body2: text default='Several regulations were found to be out of date in the following domains.' label='Finding 2 summary'}} {{title3: text default='Coverage gap' label='Finding 3 title'}} {{source3: text default='Health Data Act' label='Finding 3 source'}} {{body3: text default='Two services handle patient records with no regulation covering them yet.' label='Finding 3 summary'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{panel: color default=#122A30 label='Panel'}} {{ink: color default=#E3EEF0 label='Text'}} {{accent: color default=#5EC8C4 label='Accent'}} {{alert: color default=#F0605E label='Flag'}} {{glow: float min=0 max=6 default=3 step=0.5 label='Glow'}} --><defs><filter id="insightCardsGlow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="insightCardsWashFill" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="{{alert}}" stop-opacity="0.55"/><stop offset="0.6" stop-color="{{alert}}" stop-opacity="0.12"/><stop offset="1" stop-color="{{alert}}" stop-opacity="0"/></linearGradient><linearGradient id="insightCardsShineFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{ink}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{ink}}" stop-opacity="0.12"/><stop offset="1" stop-color="{{ink}}" stop-opacity="0"/></linearGradient><linearGradient id="insightCardsSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.07"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient><clipPath id="insightCardsClip"><rect x="${c.x}" y="${c.top}" width="${c.w}" height="${c.room}"/></clipPath></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="250" fill="{{background}}"/></g><g id="insightCardsPanel" opacity="0"><g transform="translate(0 {{offsetY}})"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="{{panelH}}" rx="${p.rx}" fill="{{panel}}" fill-opacity="0.94"/><rect x="${p.x}" y="${p.y}" width="${p.w}" height="{{panelH}}" rx="${p.rx}" fill="url(#insightCardsSheen)" stroke="{{ink}}" stroke-opacity="0.14"/><path d="${"M0 -5 C0.7 -1 1 -0.7 5 0 C1 0.7 0.7 1 0 5 C-0.7 1 -1 0.7 -5 0 C-1 -0.7 -0.7 -1 0 -5Z"}" transform="translate(${p.x + 18} ${p.y + 19})" fill="{{accent}}"/><text x="${p.x + 30}" y="${p.y + 22.5}" font-size="9.5" font-weight="600" letter-spacing="0.8" fill="{{ink}}" fill-opacity="0.85">{{heading}}</text><g display="{{moreShow}}"><rect x="${p.x + p.w - 74}" y="${p.y + 10}" width="40" height="18" rx="9" fill="{{ink}}" fill-opacity="0.1"/><path d="M${p.x + p.w - 66} ${p.y + 21} l3 -3 l3 3" fill="none" stroke="{{ink}}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><text id="insightCardsMore" x="${p.x + p.w - 46}" y="${p.y + 22.5}" text-anchor="middle" font-size="9" fill="{{ink}}">+{{more}}</text></g><circle cx="${p.x + p.w - 19}" cy="${p.y + 19}" r="8" fill="none" stroke="{{ink}}" stroke-opacity="0.5"/><path d="M${p.x + p.w - 22} ${p.y + 16} l6 6 m0 -6 l-6 6" stroke="{{ink}}" stroke-opacity="0.7" stroke-width="1.2" stroke-linecap="round"/><g clip-path="url(#insightCardsClip)">${cards}</g><g display="{{flagShow}}"><path id="insightCardsFlag" d="{{flagOutline}}" fill="none" stroke="{{alert}}" stroke-width="1.6" filter="url(#insightCardsGlow)" opacity="0"/></g></g></g></svg>`;
    const animate: SvgAnimation[] = [
      { id: "insightCardsPanel", attrs: { opacity: [0, 1], transform: ["translate(0 10)", "translate(0 0)"] }, ms: INSIGHT.intro, ease: "out" },
      { id: "insightCardsMore", count: [0, n("more")], format: "+{n}", delay: INSIGHT.intro, ms: 600, ease: "out" },
      ...slots.flatMap((i): SvgAnimation[] => [
        // In from above as a skeleton, a shine running across it, then the text.
        { id: `insightCardsCard${i}`, attrs: { opacity: [0, 1], transform: ["translate(0 -10)", "translate(0 0)"] }, delay: n(`arrive${i}`), ms: 360, ease: "out" },
        { id: `insightCardsShine${i}`, attrs: { x: [c.x - 80, c.x + c.w] }, delay: n(`arrive${i}`), ms: INSIGHT.skeleton, ease: "in-out" },
        { id: `insightCardsSkeleton${i}`, attrs: { opacity: [1, 0] }, delay: n(`skeletonOut${i}`), ms: 220 },
        { id: `insightCardsText${i}`, attrs: { opacity: [0, 1], transform: ["translate(0 3)", "translate(0 0)"] }, delay: n(`text${i}`), ms: 320, ease: "out" },
        // The flagged one: its red wash comes up as the border traces round it.
        { id: `insightCardsWash${i}`, attrs: { opacity: [0, n(`wash${i}`)] }, delay: n("flagAt"), ms: 700, ease: "out" },
        { id: `insightCardsAlertBracket${i}`, attrs: { opacity: [0, n(`wash${i}`)] }, delay: n("flagAt"), ms: 300 },
      ]),
      { id: "insightCardsFlag", attrs: { opacity: [0, 1] }, delay: n("flagAt"), ms: 1 },
      { id: "insightCardsFlag", draw: true, delay: n("flagAt"), ms: 700, ease: "in-out" },
      { id: "insightCardsFlag", attrs: { "stroke-width": [1.6, 2.4], opacity: [1, 0.55] }, delay: n("flagLit"), ms: 550, ease: "in-out", repeat: 4, alternate: true },
    ];
    return { svg, animate };
  })(),
};

export const uiEffects: VectorEffect[] = [marquee, numberTicker, animatedBadge, swipeStack, packOpening, aiPromptBar, insightCards];
