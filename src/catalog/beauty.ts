import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, fit, holdControl, ms, n, outTimes, pop, r1, SANS } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * Beauty-ad graphics: a lipstick swatch swiped on, and a row of shades
 * popping in. Each is a transparent 1920 × 1080 (16:9) picture to lay over
 * a product shot or a video, placed in percent of the frame (x from the
 * left, y from the top); it animates in, holds for `hold` seconds and
 * animates out, ending as it started, so it loops.
 */

/** Percent of the frame's width or height, in its units. */
const px = (v: unknown) => r1((Number(v) / 100) * 1920);
const py = (v: unknown) => r1((Number(v) / 100) * 1080);

/** A percent position control. */
const at = (name: string, value: number, label: string, axis: "x" | "y") =>
  `{{${name}: float min=0 max=100 default=${value} step=0.5 label='${label} ${axis} (%)'}}`;

/** A serif for shade names, as beauty brands set them. */
const SERIF = `'Playfair Display', 'Didot', 'Bodoni 72', Georgia, serif`;

// ── Lipstick swipe ─────────────────────────────────────────────────────

const lipstickSwipeMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- ${at("x", 50, "Swatch", "x")} ${at("y", 44, "Swatch", "y")} {{length: float min=10 max=90 default=44 step=0.5 label='Length (%)'}} {{thickness: float min=20 max=300 default=120 step=1 label='Thickness'}} {{angle: float min=-45 max=45 default=-8 step=0.5 label='Angle'}} {{color: color default=#B0123A label='Shade'}} {{gloss: float min=0 max=1 default=0.45 step=0.05 label='Gloss'}} {{cream: float min=0 max=30 default=12 step=1 label='Creamy edges'}} {{label: text default='Ruby Kiss' label='Shade name'}} {{sub: text default='Satin lipstick' label='Small print'}} {{ink: color default=#1F1A1C label='Text colour'}} ${holdControl(2.5)} {{font: text default="${SERIF}" label='Font'}} {{subFont: text default="${SANS}" label='Small print font'}} --><defs><filter id="lipstickSwipeCream" x="-10%" y="-60%" width="120%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.09" numOctaves="2" seed="7" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="{{cream}}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g id="lipstickSwipeAll"><g transform="translate({{x}} {{y}}) rotate({{angle}})" filter="url(#lipstickSwipeCream)" fill="none" stroke-linecap="round"><path id="lipstickSwipeStroke" d="{{d}}" stroke="{{color}}" stroke-width="{{thickness}}"/><path id="lipstickSwipeShade" d="{{d}}" stroke="#000000" stroke-opacity="0.16" stroke-width="{{thickness}}" transform="translate(0 {{shadeY}})"/><path id="lipstickSwipeGloss" d="{{dGloss}}" stroke="#FFFFFF" stroke-opacity="{{glossAlpha}}" stroke-width="{{glossWidth}}"/></g><g id="lipstickSwipeText" opacity="0" transform="translate(0 24)"><text x="{{x}}" y="{{labelY}}" text-anchor="middle" font-family="{{font}}" font-size="{{labelSize}}" font-weight="600" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{label}}</text><text x="{{x}}" y="{{subY}}" text-anchor="middle" font-family="{{subFont}}" font-size="{{subSize}}" font-weight="500" letter-spacing="{{subSpacing}}" fill="{{ink}}" fill-opacity="0.7">{{subUpper}}</text></g></g></svg>`,
  animate: [
    { id: "lipstickSwipeStroke", draw: true, ms: 750, ease: "in-out" },
    { id: "lipstickSwipeShade", draw: true, ms: 750, ease: "in-out" },
    { id: "lipstickSwipeGloss", draw: true, delay: 250, ms: 650, ease: "in-out" },
    { id: "lipstickSwipeText", attrs: { opacity: [0, 1], transform: ["translate(0 24)", "translate(0 0)"] }, delay: 650, ms: 450, ease: "out" },
    { id: "lipstickSwipeAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const lipstickSwipe: VectorEffect = {
  kind: "vector",
  id: "lipstick-swipe",
  name: "Lipstick swipe",
  description: "A creamy lipstick swatch swiped across the frame with a glossy streak along it, then the shade's name fading in beneath.",
  category: "beauty",
  tags: ["beauty", "makeup", "cosmetics", "lipstick", "swatch", "shade", "product", "ad", "draw-on"],
  hold: 300,
  presets: [
    { name: "Nude", values: { color: [0.76, 0.5, 0.44], label: "Bare Petal", gloss: 0.3 } },
    { name: "Berry gloss", values: { color: [0.5, 0.08, 0.3], label: "Midnight Berry", sub: "High-shine gloss", gloss: 0.8 } },
    { name: "Bold stroke", values: { thickness: 220, angle: -14, cream: 20, label: "", sub: "" } },
  ],
  derived: (v) => {
    const [X, Y] = [px(v.x), py(v.y)];
    const L = px(v.length);
    const T = Math.max(1, Number(v.thickness));
    const bend = T * 0.25;
    // A gentle S, as a hand swipes: the gloss a thinner streak along its upper half.
    const curve = (dy: number, shrink: number) =>
      `M${r1(-L / 2 + shrink)} ${r1(dy)} C${r1(-L / 6)} ${r1(dy - bend)} ${r1(L / 6)} ${r1(dy + bend)} ${r1(L / 2 - shrink)} ${r1(dy)}`;
    const label = fit(v.label, Math.max(L, 400), 120);
    const sub = String(v.sub ?? "").toUpperCase();
    const subSize = 30;
    return {
      ...outTimes(lipstickSwipeMotion, 1100 + ms(v.hold)),
      x: X,
      y: Y,
      d: curve(0, 0),
      dGloss: curve(-T * 0.18, T * 0.35),
      shadeY: r1(T * 0.32),
      glossWidth: r1(T * 0.14),
      glossAlpha: r1(Number(v.gloss) * 0.75 * 100) / 100,
      labelSize: label.size,
      labelW: label.width,
      labelY: r1(Y + T / 2 + 40 + label.size * 0.8),
      subSize,
      subSpacing: 6,
      subUpper: sub,
      subY: r1(Y + T / 2 + 40 + label.size * 0.8 + subSize * 1.8),
    };
  },
  motion: lipstickSwipeMotion,
};

// ── Swatch reveal ──────────────────────────────────────────────────────

const SWATCHES = 5;
const SWATCH_GAP = 160;
const SWATCH_COLORS = ["#F2C1B0", "#D98A7A", "#B0123A", "#7A2048", "#4A2A2E"];
const SWATCH_NAMES = ["Blush", "Rosewood", "Ruby", "Plum", "Cocoa"];

const swatchRevealMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{count: int min=1 max=${SWATCHES} default=5 label='Shades'}} ${Array.from({ length: SWATCHES }, (_, i) => `{{c${i + 1}: color default=${SWATCH_COLORS[i]} label='Shade ${i + 1}'}} {{l${i + 1}: text default='${SWATCH_NAMES[i]}' label='Shade ${i + 1} name'}}`).join(" ")} ${at("x", 50, "Row", "x")} ${at("y", 50, "Row", "y")} {{size: float min=40 max=320 default=170 step=1 label='Swatch size'}} {{round: bool default=true label='Round swatches'}} {{satin: float min=0 max=1 default=0.5 step=0.05 label='Satin sheen'}} {{ink: color default=#1F1A1C label='Text colour'}} ${holdControl(2.5)} {{font: text default="${SANS}" label='Font'}} --><defs><radialGradient id="swatchRevealSheen" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.08"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></radialGradient><filter id="swatchRevealShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.22"/></filter></defs><g id="swatchRevealAll">${Array.from({ length: SWATCHES }, (_, i) => {
    const k = i + 1;
    return `<g transform="translate({{sx${k}}} {{sy}})" opacity="{{v${k}}}"><g id="swatchRevealChip${k}" transform="scale(0)" filter="url(#swatchRevealShadow)"><rect x="{{half}}" y="{{half}}" width="{{size}}" height="{{size}}" rx="{{rx}}" fill="{{c${k}}}"/><rect x="{{half}}" y="{{half}}" width="{{size}}" height="{{size}}" rx="{{rx}}" fill="url(#swatchRevealSheen)" opacity="{{satin}}"/></g><text id="swatchRevealName${k}" y="{{nameY}}" text-anchor="middle" font-family="{{font}}" font-size="{{ns${k}}}" font-weight="600" letter-spacing="2" fill="{{ink}}" opacity="0">{{l${k}}}</text></g>`;
  }).join("")}</g></svg>`,
  animate: [
    ...Array.from({ length: SWATCHES }, (_, i): SvgAnimation[] => [
      ...pop(`swatchRevealChip${i + 1}`, i * SWATCH_GAP, 1.12, 280),
      { id: `swatchRevealName${i + 1}`, attrs: { opacity: [0, 1] }, delay: i * SWATCH_GAP + 260, ms: 320, ease: "out" },
    ]).flat(),
    { id: "swatchRevealAll", attrs: { opacity: [1, 0] }, delay: after(0), ms: 400 },
  ],
};

export const swatchReveal: VectorEffect = {
  kind: "vector",
  id: "swatch-reveal",
  name: "Swatch reveal",
  description: "A row of shade swatches popping in one after another with a satin sheen, each with its name fading in below, like a cosmetics range.",
  category: "beauty",
  tags: ["beauty", "makeup", "cosmetics", "swatch", "shade", "palette", "range", "product", "ad"],
  hold: 300,
  presets: [
    { name: "Nudes", values: { c1: [0.96, 0.84, 0.76], c2: [0.89, 0.71, 0.6], c3: [0.78, 0.56, 0.45], c4: [0.6, 0.4, 0.3], c5: [0.4, 0.26, 0.2], l1: "Ivory", l2: "Sand", l3: "Honey", l4: "Caramel", l5: "Espresso" } },
    { name: "Nail polish", values: { round: false, satin: 0.8, size: 140 } },
    { name: "Three shades", values: { count: 3, size: 220 } },
  ],
  derived: (v) => {
    const count = Math.min(SWATCHES, Math.max(1, Math.round(Number(v.count)) || 1));
    const size = Math.max(1, Number(v.size));
    const pitch = size * 1.45;
    const X = px(v.x);
    const out: Record<string, string | number> = {};
    for (let i = 0; i < SWATCHES; i++) {
      const k = i + 1;
      out[`sx${k}`] = r1(X + (i - (count - 1) / 2) * pitch);
      out[`v${k}`] = i < count ? 1 : 0;
      out[`ns${k}`] = fit(v[`l${k}`], pitch * 0.92, Math.max(18, size * 0.2)).size;
    }
    return {
      ...out,
      ...outTimes(swatchRevealMotion, (count - 1) * SWATCH_GAP + 600 + ms(v.hold)),
      sy: py(v.y),
      half: r1(-size / 2),
      rx: r1(v.round ? size / 2 : size * 0.14),
      nameY: r1(size / 2 + 24 + Math.max(18, size * 0.2)),
    };
  },
  motion: swatchRevealMotion,
};

/** Beauty-ad graphics: a lipstick swatch and a row of shades. */
export const beautyEffects: VectorEffect[] = [lipstickSwipe, swatchReveal];
