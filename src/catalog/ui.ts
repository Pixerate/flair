import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
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
  tags: ["ui", "marquee", "logos", "ticker", "scroll", "saas", "social-proof"],
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
  tags: ["ui", "counter", "odometer", "number", "kpi", "stats", "saas"],
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

export const uiEffects: VectorEffect[] = [marquee, numberTicker, animatedBadge];
