import { rgbToHex } from "../shader/controls.js";
import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { CURRENT_COLOR, isCurrentColor, type VectorEffect } from "./types.js";

/*
 * More loaders, as animated SVG: skeleton placeholders, determinate and
 * indeterminate bars, a stepper, chasing dots, wave bars, an hourglass, an
 * infinity dash, orbiting dots and a morphing shape. Ids are
 * prefixed with the effect's name.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** `a` mixed `t` of the way to `b` (colours as vector controls hold them), or currentColor when either is. */
function mixHex(a: unknown, b: unknown, t: number): string {
  if (isCurrentColor(a) || isCurrentColor(b)) return CURRENT_COLOR;
  const x = (Array.isArray(a) ? a : [0, 0, 0]) as number[];
  const y = (Array.isArray(b) ? b : [0, 0, 0]) as number[];
  return rgbToHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t));
}

/** Skeleton shimmer's placeholder blocks: an avatar, a title and subtitle, a picture, two lines of text. */
const SKELETON_SHAPES = `<circle cx="42" cy="42" r="16"/><rect x="68" y="30" width="110" height="10" rx="5"/><rect x="68" y="47" width="70" height="8" rx="4"/><rect x="26" y="70" width="188" height="52" rx="8"/><rect x="26" y="132" width="168" height="8" rx="4"/><rect x="26" y="146" width="116" height="8" rx="4"/>`;

export const skeletonShimmer: VectorEffect = {
  kind: "vector",
  id: "skeleton-shimmer",
  name: "Skeleton shimmer",
  description: "A skeleton placeholder card (avatar, lines, picture block) with a shimmer of light sweeping across it while content loads.",
  category: "loader",
  tags: ["loader", "skeleton", "placeholder", "shimmer", "ui", "card"],
  hold: 250,
  presets: [
    { name: "Dark", values: { card: [0.07, 0.08, 0.11], bone: [0.16, 0.18, 0.22], shine: [0.25, 0.27, 0.32] } },
    { name: "Warm", values: { card: [1, 0.98, 0.95], bone: [0.93, 0.89, 0.84], shine: [0.98, 0.96, 0.93] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 240 172"><!-- {{card: color default=#FFFFFF label='Card'}} {{bone: color default=#E5E7EB label='Placeholder'}} {{shine: color default=#F8FAFC label='Shimmer'}} {{speed: float min=0.4 max=4 default=1.3 step=0.1 label='Sweep time (s)'}} --><defs><clipPath id="skeletonShimmerClip">${SKELETON_SHAPES}</clipPath><linearGradient id="skeletonShimmerGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{shine}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{shine}}" stop-opacity="1"/><stop offset="1" stop-color="{{shine}}" stop-opacity="0"/></linearGradient></defs><rect x="10" y="10" width="220" height="156" rx="14" fill="{{card}}" stroke="{{bone}}" stroke-width="1"/><g fill="{{bone}}">${SKELETON_SHAPES}</g><g clip-path="url(#skeletonShimmerClip)"><rect id="skeletonShimmerBand" x="0" y="10" width="110" height="156" fill="url(#skeletonShimmerGradient)" transform="translate(-120 0) skewX(-15)"/></g></svg>`,
    animate: [{ id: "skeletonShimmerBand", attrs: { transform: ["translate(-120 0) skewX(-15)", "translate(290 0) skewX(-15)"] }, ms: n("ms"), ease: "in-out" }],
  },
  derived: (v) => ({ ms: Math.round(Math.min(4, Math.max(0.4, Number(v.speed) || 1.3)) * 1000) }),
};

/** Progress bar: the track's left edge, top, width and height, the stripe period, and when it fades out. */
const BAR = { x: 20, y: 34, w: 220, h: 12 };
const STRIPE = 16;
const STRIPE_MS = 450;
const BAR_FADE = 3300;

export const progressBar: VectorEffect = {
  kind: "vector",
  id: "progress-bar",
  name: "Progress bar",
  description: "A striped progress bar filling to a value while its percentage counts up, the stripes marching all the while.",
  category: "loader",
  tags: ["loader", "progress", "bar", "upload", "ui", "percent"],
  hold: 0,
  presets: [
    { name: "Dark", values: { track: [0.15, 0.17, 0.22], ink: [0.95, 0.96, 0.97], accent: [0.55, 0.36, 0.96] } },
    { name: "Success", values: { value: 100, accent: [0.13, 0.77, 0.37], label: "Complete" } },
    { name: "Plain", values: { stripes: false } },
  ],
  derived: (v) => ({ fillW: r1((Math.min(100, Math.max(0, Number(v.value))) / 100) * BAR.w), stripeOpacity: v.stripes ? 0.22 : 0 }),
  motion: {
    svg: `<svg viewBox="0 0 260 64" font-family="${SANS}"><!-- {{label: text default='Uploading' label='Label'}} {{value: float min=0 max=100 default=68 step=1 label='Percent'}} {{accent: color default=#6366F1 label='Bar'}} {{track: color default=#E5E7EB label='Track'}} {{ink: color default=#111827 label='Text'}} {{stripes: bool default=true label='Stripes'}} --><defs><clipPath id="progressBarClip"><rect id="progressBarClipRect" x="${BAR.x}" y="${BAR.y}" width="0" height="${BAR.h}" rx="${BAR.h / 2}"/></clipPath></defs><text x="${BAR.x}" y="24" font-size="13" font-weight="600" fill="{{ink}}">{{label}}</text><text id="progressBarPercent" x="${BAR.x + BAR.w}" y="24" text-anchor="end" font-size="13" font-weight="500" fill="{{ink}}" fill-opacity="0.65">0%</text><rect x="${BAR.x}" y="${BAR.y}" width="${BAR.w}" height="${BAR.h}" rx="${BAR.h / 2}" fill="{{track}}"/><g id="progressBarBar"><rect id="progressBarFill" x="${BAR.x}" y="${BAR.y}" width="0" height="${BAR.h}" rx="${BAR.h / 2}" fill="{{accent}}"/><g clip-path="url(#progressBarClip)"><g id="progressBarStripes" transform="translate(-${STRIPE} 0)" fill="#FFFFFF" opacity="{{stripeOpacity}}">${Array.from(
      { length: Math.ceil((BAR.w + 2 * STRIPE) / STRIPE) + 1 },
      (_, i) => {
        const x = BAR.x - STRIPE + i * STRIPE;
        return `<path d="M${x} ${BAR.y + BAR.h} L${x + STRIPE / 2} ${BAR.y} L${x + STRIPE} ${BAR.y} L${x + STRIPE / 2} ${BAR.y + BAR.h}Z"/>`;
      },
    ).join("")}</g></g></g></svg>`,
    animate: [
      { id: "progressBarFill", attrs: { width: [0, "{{fillW}}"] }, ms: 1600, ease: "out" },
      { id: "progressBarClipRect", attrs: { width: [0, "{{fillW}}"] }, ms: 1600, ease: "out" },
      { id: "progressBarPercent", count: [0, "{{value}}"] as unknown as [number, number], format: "{n}%", ms: 1600, ease: "out" },
      ...Array.from({ length: Math.ceil((BAR_FADE + 300) / STRIPE_MS) }, (_, k): SvgAnimation => ({
        id: "progressBarStripes",
        attrs: { transform: [`translate(-${STRIPE} 0)`, "translate(0 0)"] },
        delay: k * STRIPE_MS,
        ms: STRIPE_MS,
        ease: "linear",
      })),
      { id: "progressBarBar", attrs: { opacity: [1, 0] }, delay: BAR_FADE, ms: 300 },
      { id: "progressBarPercent", attrs: { opacity: [1, 0] }, delay: BAR_FADE, ms: 300 },
    ],
  },
};

export const indeterminateBar: VectorEffect = {
  kind: "vector",
  id: "indeterminate-bar",
  name: "Indeterminate bar",
  description: "A Material-style indeterminate progress bar: two segments racing across the track, one long and one short.",
  category: "loader",
  tags: ["loader", "progress", "bar", "material", "ui", "minimal"],
  hold: 0,
  presets: [
    { name: "Dark", values: { accent: [0.51, 0.55, 0.97], track: [0.16, 0.17, 0.27] } },
    { name: "Thick", values: { thickness: 10 } },
  ],
  derived: (v) => {
    const t = Math.min(12, Math.max(2, Number(v.thickness) || 4));
    return { top: r1(12 - t / 2), radius: r1(t / 2) };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 24"><!-- {{accent: color default=#6366F1 label='Bar'}} {{track: color default=#E0E7FF label='Track'}} {{thickness: float min=2 max=12 default=4 step=1 label='Thickness'}} --><defs><clipPath id="indeterminateBarClip"><rect x="0" y="{{top}}" width="240" height="{{thickness}}" rx="{{radius}}"/></clipPath></defs><rect x="0" y="{{top}}" width="240" height="{{thickness}}" rx="{{radius}}" fill="{{track}}"/><g clip-path="url(#indeterminateBarClip)" fill="{{accent}}"><rect id="indeterminateBarA" x="-100" y="{{top}}" width="20" height="{{thickness}}" rx="{{radius}}"/><rect id="indeterminateBarB" x="-170" y="{{top}}" width="170" height="{{thickness}}" rx="{{radius}}"/></g></svg>`,
    animate: [
      { id: "indeterminateBarA", attrs: { x: [-100, 260] }, ms: 1400, ease: "in-out" },
      { id: "indeterminateBarA", attrs: { width: [20, 140] }, ms: 700, ease: "in-out" },
      { id: "indeterminateBarA", attrs: { width: [140, 40] }, delay: 700, ms: 700, ease: "in-out" },
      { id: "indeterminateBarB", attrs: { x: [-170, 260] }, delay: 1050, ms: 950, ease: "out" },
      { id: "indeterminateBarB", attrs: { width: [170, 30] }, delay: 1050, ms: 950, ease: "in-out" },
    ],
  },
};

/** Step progress: the steps' centres, their radius, and when each completes. */
const STEPS = [45, 115, 185, 255];
const STEP_Y = 36;
const STEP_R = 15;
const STEP_AT = (i: number) => 300 + i * 750;
const STEP_RESET = STEP_AT(3) + 1600;

export const stepProgress: VectorEffect = {
  kind: "vector",
  id: "step-progress",
  name: "Step progress",
  description: "A four-step stepper filling in turn: each step turns solid with a check and the line to the next one fills.",
  category: "loader",
  tags: ["loader", "stepper", "progress", "checkout", "onboarding", "ui"],
  hold: 300,
  presets: [
    { name: "Dark", values: { card: [0.07, 0.08, 0.11], track: [0.22, 0.24, 0.3], ink: [0.9, 0.92, 0.95], accent: [0.2, 0.83, 0.6] } },
    { name: "Onboarding", values: { labels: "Account · Profile · Team · Launch", accent: [0.93, 0.28, 0.6] } },
  ],
  derived: (v) => {
    const labels = String(v.labels).split("·").map((s) => s.trim());
    return Object.fromEntries(STEPS.map((_, i) => [`l${i}`, labels[i] ?? ""]));
  },
  motion: ((): SvgMotion => {
    const check = (x: number) => `M${x - 6} ${STEP_Y + 0.5} L${x - 2} ${STEP_Y + 4.5} L${x + 6} ${STEP_Y - 4}`;
    const lines = STEPS.slice(0, -1)
      .map((x, i) => {
        const d = `M${x + STEP_R + 3} ${STEP_Y} L${STEPS[i + 1]! - STEP_R - 3} ${STEP_Y}`;
        return `<path d="${d}" stroke="{{track}}" stroke-width="3" stroke-linecap="round"/><path id="stepProgressLine${i}" d="${d}" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/>`;
      })
      .join("");
    const steps = STEPS.map(
      (x, i) =>
        `<circle id="stepProgressCircle${i}" cx="${x}" cy="${STEP_Y}" r="${STEP_R}" fill="{{card}}" stroke="{{track}}" stroke-width="2.5"/><text id="stepProgressNumber${i}" x="${x}" y="${STEP_Y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="{{ink}}">${i + 1}</text><path id="stepProgressCheck${i}" d="${check(x)}" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0"/><text x="${x}" y="${STEP_Y + 38}" text-anchor="middle" font-size="11" font-weight="500" fill="{{ink}}" fill-opacity="0.7">{{l${i}}}</text>`,
    ).join("");
    const done = STEPS.flatMap((_, i): SvgAnimation[] => {
      const at = STEP_AT(i);
      return [
        { id: `stepProgressCircle${i}`, attrs: { fill: ["{{card}}", "{{accent}}"], stroke: ["{{track}}", "{{accent}}"] }, delay: at, ms: 220 },
        { id: `stepProgressNumber${i}`, attrs: { opacity: [1, 0] }, delay: at, ms: 150 },
        { id: `stepProgressCheck${i}`, attrs: { opacity: [0, 1] }, delay: at + 120, ms: 40 },
        { id: `stepProgressCheck${i}`, draw: true, delay: at + 120, ms: 260, ease: "out" },
        ...(i < STEPS.length - 1 ? [{ id: `stepProgressLine${i}`, draw: true, delay: at + 260, ms: 450, ease: "in-out" as const }] : []),
      ];
    });
    // Back to the start together, so the loop begins where it ends.
    const reset = STEPS.flatMap((_, i): SvgAnimation[] => [
      { id: `stepProgressCircle${i}`, attrs: { fill: ["{{accent}}", "{{card}}"], stroke: ["{{accent}}", "{{track}}"] }, delay: STEP_RESET, ms: 350 },
      { id: `stepProgressNumber${i}`, attrs: { opacity: [0, 1] }, delay: STEP_RESET, ms: 350 },
      { id: `stepProgressCheck${i}`, attrs: { opacity: [1, 0] }, delay: STEP_RESET, ms: 200 },
      { id: `stepProgressCheck${i}`, draw: [0, 0] as const, delay: STEP_RESET + 200, ms: 0 },
      ...(i < STEPS.length - 1 ? [{ id: `stepProgressLine${i}`, draw: [1, 0] as const, delay: STEP_RESET, ms: 350, ease: "in-out" as const }] : []),
    ]);
    return {
      svg: `<svg viewBox="0 0 300 96" font-family="${SANS}"><!-- {{accent: color default=#6366F1 label='Done'}} {{track: color default=#D1D5DB label='To do'}} {{card: color default=#FFFFFF label='Fill'}} {{ink: color default=#111827 label='Text'}} {{labels: text default='Cart · Details · Payment · Done' label='Steps'}} --><g fill="none">${lines}</g>${steps}</svg>`,
      animate: [...done, ...reset],
    };
  })(),
};

/** Circle dots: how many dots chase, and the trail behind each. */
const CHASE_DOTS = 5;
const CHASE_TRAIL = [0.5, 0.28, 0.14];

export const circleDotsLoader: VectorEffect = {
  kind: "vector",
  id: "circle-dots-loader",
  name: "Circle dots loader",
  description: "Dots chasing each other round a circle, bunching and spreading as they go, each with a fading trail.",
  category: "loader",
  tags: ["loader", "spinner", "dots", "ui", "minimal"],
  hold: 0,
  presets: [
    { name: "Dark", values: { accent: [0.65, 0.71, 0.99], track: [0.16, 0.17, 0.25] } },
    { name: "No trail", values: { trail: false, size: 6 } },
  ],
  derived: (v) => {
    const size = Math.min(8, Math.max(2, Number(v.size) || 5));
    const out: Record<string, number> = { trailOpacity: v.trail ? 1 : 0 };
    CHASE_TRAIL.forEach((_, j) => (out[`r${j + 1}`] = r1(size * (1 - 0.18 * (j + 1)))));
    return out;
  },
  motion: ((): SvgMotion => {
    const dot = (id: string, r: string, opacity: number) =>
      `<g id="${id}" transform="rotate(0 50 50)"><circle cx="50" cy="14" r="${r}" fill="{{accent}}" opacity="${opacity}"/></g>`;
    let markup = "";
    const animate: SvgAnimation[] = [];
    for (let i = CHASE_DOTS - 1; i >= 0; i--) {
      const trail = CHASE_TRAIL.map((o, j) => dot(`circleDotsLoaderDot${i}Trail${j + 1}`, `{{r${j + 1}}}`, o)).join("");
      markup += `<g opacity="{{trailOpacity}}">${trail}</g>${dot(`circleDotsLoaderDot${i}`, "{{size}}", 1)}`;
      const ids = [`circleDotsLoaderDot${i}`, ...CHASE_TRAIL.map((_, j) => `circleDotsLoaderDot${i}Trail${j + 1}`)];
      ids.forEach((id, j) =>
        animate.push({ id, attrs: { transform: ["rotate(0 50 50)", "rotate(360 50 50)"] }, delay: i * 120 + j * 40, ms: 1400, ease: "in-out" }),
      );
    }
    return {
      svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#6366F1 label='Dots'}} {{track: color default=#EEF2FF label='Track'}} {{size: float min=2 max=8 default=5 step=0.5 label='Dot size'}} {{trail: bool default=true label='Trails'}} --><circle cx="50" cy="50" r="36" fill="none" stroke="{{track}}" stroke-width="2"/>${markup}</svg>`,
      animate,
    };
  })(),
};

/** Wave bars: how many bars, and the stagger between them. */
const WAVE_BARS = 7;
const WAVE_STAGGER = 90;

export const waveBars: VectorEffect = {
  kind: "vector",
  id: "wave-bars",
  name: "Wave bars",
  description: "A row of rounded bars rising and falling in a wave that runs from left to right, shading from one colour to another.",
  category: "loader",
  tags: ["loader", "bar", "wave", "ui", "voice"],
  hold: 0,
  presets: [
    { name: "Mono", values: { colorA: [0.06, 0.09, 0.16], colorB: [0.06, 0.09, 0.16] } },
    { name: "Ocean", values: { colorA: [0.02, 0.71, 0.83], colorB: [0.23, 0.51, 0.96], low: 0.2 } },
  ],
  derived: (v) => Object.fromEntries(Array.from({ length: WAVE_BARS }, (_, i) => [`c${i}`, mixHex(v.colorA, v.colorB, i / (WAVE_BARS - 1))])),
  motion: ((): SvgMotion => {
    const at = (i: number) => 50 + (i - (WAVE_BARS - 1) / 2) * 12;
    const pose = (i: number, s: string | number) => `translate(${at(i)} 30) scale(1 ${s})`;
    return {
      svg: `<svg viewBox="0 0 100 60"><!-- {{colorA: color default=#6366F1 label='Colour A'}} {{colorB: color default=#EC4899 label='Colour B'}} {{low: float min=0.1 max=0.9 default=0.3 step=0.05 label='Rest height'}} -->${Array.from(
        { length: WAVE_BARS },
        (_, i) => `<g id="waveBarsBar${i}" transform="${pose(i, "{{low}}")}"><rect x="-3" y="-20" width="6" height="40" rx="3" fill="{{c${i}}}"/></g>`,
      ).join("")}</svg>`,
      animate: Array.from({ length: WAVE_BARS }, (_, i): SvgAnimation[] => [
        { id: `waveBarsBar${i}`, attrs: { transform: [pose(i, "{{low}}"), pose(i, 1)] }, delay: i * WAVE_STAGGER, ms: 380, ease: "in-out" },
        { id: `waveBarsBar${i}`, attrs: { transform: [pose(i, 1), pose(i, "{{low}}")] }, delay: i * WAVE_STAGGER + 380, ms: 380, ease: "in-out" },
      ]).flat(),
    };
  })(),
};

/** Hourglass: its glass, the neck at (60, 60), and when the sand has run and the glass has turned. */
const HOURGLASS_GLASS = "M36 20 H84 V26 C84 44 66 52 63 60 C66 68 84 76 84 94 V100 H36 V94 C36 76 54 68 57 60 C54 52 36 44 36 26 Z";
const HOURGLASS_RUN = 1800;
const HOURGLASS_TURN = 500;

export const hourglass: VectorEffect = {
  kind: "vector",
  id: "hourglass",
  name: "Hourglass",
  description: "An hourglass whose sand runs from the top bulb into the bottom in a thin stream, then the glass turns over to run again.",
  category: "loader",
  tags: ["loader", "hourglass", "waiting", "time", "ui", "icon"],
  hold: 0,
  presets: [
    { name: "Dark", values: { frame: [0.89, 0.91, 0.94], glass: [0.2, 0.23, 0.3], sand: [0.98, 0.75, 0.14] } },
    { name: "Blue sand", values: { sand: [0.23, 0.51, 0.96] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{frame: color default=#334155 label='Frame'}} {{glass: color default=#E2E8F0 label='Glass'}} {{sand: color default=#F59E0B label='Sand'}} --><defs><clipPath id="hourglassClip"><path d="${HOURGLASS_GLASS}"/></clipPath></defs><g id="hourglassTurn" transform="rotate(0 60 60)"><path d="${HOURGLASS_GLASS}" fill="{{glass}}"/><g clip-path="url(#hourglassClip)" fill="{{sand}}"><rect id="hourglassTop" x="30" y="30" width="60" height="30"/><rect id="hourglassBottom" x="30" y="100" width="60" height="0"/><rect id="hourglassStream" x="59" y="60" width="2" height="40" opacity="0"/></g><path d="${HOURGLASS_GLASS}" fill="none" stroke="{{frame}}" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="12" width="64" height="8" rx="3" fill="{{frame}}"/><rect x="28" y="100" width="64" height="8" rx="3" fill="{{frame}}"/></g></svg>`,
    animate: [
      // The sand runs: the top bulb empties from its surface down, the bottom fills up, a stream between.
      { id: "hourglassTop", attrs: { y: [30, 60], height: [30, 0] }, ms: HOURGLASS_RUN, ease: "linear" },
      { id: "hourglassBottom", attrs: { y: [100, 72], height: [0, 28] }, ms: HOURGLASS_RUN, ease: "linear" },
      { id: "hourglassStream", attrs: { opacity: [0, 1] }, ms: 100 },
      { id: "hourglassStream", attrs: { height: [40, 12] }, ms: HOURGLASS_RUN, ease: "linear" },
      { id: "hourglassStream", attrs: { opacity: [1, 0] }, delay: HOURGLASS_RUN - 120, ms: 120 },
      // Then the glass turns over; turned, it looks as it started, so everything snaps back.
      { id: "hourglassTurn", attrs: { transform: ["rotate(0 60 60)", "rotate(180 60 60)"] }, delay: HOURGLASS_RUN, ms: HOURGLASS_TURN, ease: "in-out" },
      ...(
        [
          ["hourglassTurn", "transform", "rotate(0 60 60)"],
          ["hourglassTop", "y", 30],
          ["hourglassTop", "height", 30],
          ["hourglassBottom", "y", 100],
          ["hourglassBottom", "height", 0],
          ["hourglassStream", "height", 40],
        ] as const
      ).map(([id, attr, value]): SvgAnimation => ({ id, attrs: { [attr]: [value, value] }, delay: HOURGLASS_RUN + HOURGLASS_TURN, ms: 0 })),
    ],
  },
};

/** Infinity loader: a figure of eight round (100, 50), measured as 100 long (`pathLength`). */
const INFINITY = "M100 50 C125 14 176 14 176 50 C176 86 125 86 100 50 C75 14 24 14 24 50 C24 86 75 86 100 50 Z";
const INFINITY_MS = 1600;

export const infinityLoader: VectorEffect = {
  kind: "vector",
  id: "infinity-loader",
  name: "Infinity loader",
  description: "A glowing dash chasing itself round a figure of eight, stretching as it swings through the crossing.",
  category: "loader",
  tags: ["loader", "infinity", "spinner", "loop", "ui", "minimal"],
  hold: 0,
  presets: [
    { name: "Dark", values: { track: [0.16, 0.18, 0.25], accent: [0.4, 0.91, 0.98] } },
    { name: "Thick", values: { thickness: 10 } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 200 100"><!-- {{accent: color default=#8B5CF6 label='Dash'}} {{track: color default=#EDE9FE label='Track'}} {{thickness: float min=2 max=14 default=7 step=1 label='Thickness'}} --><defs><filter id="infinityLoaderBlur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="3"/></filter></defs><path d="${INFINITY}" pathLength="100" fill="none" stroke="{{track}}" stroke-width="{{thickness}}" stroke-linecap="round"/><path id="infinityLoaderGlow" d="${INFINITY}" pathLength="100" fill="none" stroke="{{accent}}" stroke-width="{{thickness}}" stroke-linecap="round" stroke-dasharray="20 80" stroke-dashoffset="0" filter="url(#infinityLoaderBlur)" opacity="0.6"/><path id="infinityLoaderDash" d="${INFINITY}" pathLength="100" fill="none" stroke="{{accent}}" stroke-width="{{thickness}}" stroke-linecap="round" stroke-dasharray="20 80" stroke-dashoffset="0"/></svg>`,
    animate: ["infinityLoaderDash", "infinityLoaderGlow"].flatMap((id): SvgAnimation[] => [
      { id, attrs: { "stroke-dashoffset": [0, -100] }, ms: INFINITY_MS, ease: "linear" },
      // It stretches through each crossing and shortens on the loops.
      { id, attrs: { "stroke-dasharray": ["20 80", "34 66"] }, ms: INFINITY_MS / 4, ease: "in-out" },
      { id, attrs: { "stroke-dasharray": ["34 66", "20 80"] }, delay: INFINITY_MS / 4, ms: INFINITY_MS / 4, ease: "in-out" },
      { id, attrs: { "stroke-dasharray": ["20 80", "34 66"] }, delay: INFINITY_MS / 2, ms: INFINITY_MS / 4, ease: "in-out" },
      { id, attrs: { "stroke-dasharray": ["34 66", "20 80"] }, delay: (INFINITY_MS * 3) / 4, ms: INFINITY_MS / 4, ease: "in-out" },
      // A whole lap ends where it started.
      { id, attrs: { "stroke-dashoffset": [0, 0] }, delay: INFINITY_MS, ms: 0 },
    ]),
  },
};

/** Orbit loader: an ellipse `rx` by `ry` round (60, 60), tilted `deg`, starting `start` of the way round, as a closed path. */
function orbitPath(rx: number, ry: number, deg: number, start: number): string {
  const tilt = (deg * Math.PI) / 180;
  const points = Array.from({ length: 49 }, (_, i) => {
    const a = (start + i / 48) * Math.PI * 2;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return `${r1(60 + x * Math.cos(tilt) - y * Math.sin(tilt))} ${r1(60 + x * Math.sin(tilt) + y * Math.cos(tilt))}`;
  });
  return `M${points.join(" L")} Z`;
}

const ORBITS = [
  { deg: 0, start: 0 },
  { deg: 60, start: 0.33 },
  { deg: -60, start: 0.67 },
];
const ORBIT_MS = 1500;

export const orbitLoader: VectorEffect = {
  kind: "vector",
  id: "orbit-loader",
  name: "Orbit loader",
  description: "Three dots circling a pulsing centre on tilted orbits, like an atom, each a third of a turn behind the last.",
  category: "loader",
  tags: ["loader", "orbit", "atom", "spinner", "science", "ui"],
  hold: 0,
  presets: [
    { name: "Dark", values: { orbit: [0.2, 0.23, 0.3], dot: [0.4, 0.91, 0.98], core: [0.96, 0.45, 0.71] } },
    { name: "No orbits", values: { orbit: [1, 1, 1] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{dot: color default=#0EA5E9 label='Dots'}} {{core: color default=#6366F1 label='Centre'}} {{orbit: color default=#E2E8F0 label='Orbits'}} -->${ORBITS.map(
      ({ deg, start }, i) => `<path id="orbitLoaderPath${i}" d="${orbitPath(46, 16, deg, start)}" fill="none" stroke="{{orbit}}" stroke-width="2"/>`,
    ).join("")}<circle id="orbitLoaderCore" cx="60" cy="60" r="8" fill="{{core}}"/>${ORBITS.map((_, i) => `<circle id="orbitLoaderDot${i}" cx="0" cy="0" r="5.5" fill="{{dot}}"/>`).join("")}</svg>`,
    animate: [
      // A lap of a closed orbit ends where it started, so each dot snaps back to its start.
      ...ORBITS.flatMap((_, i): SvgAnimation[] => [
        { id: `orbitLoaderDot${i}`, along: `orbitLoaderPath${i}`, ms: ORBIT_MS, ease: "linear" },
        { id: `orbitLoaderDot${i}`, along: `orbitLoaderPath${i}`, at: [0, 0], delay: ORBIT_MS, ms: 0 },
      ]),
      { id: "orbitLoaderCore", attrs: { r: [8, 10.5] }, ms: ORBIT_MS / 2, ease: "in-out" },
      { id: "orbitLoaderCore", attrs: { r: [10.5, 8] }, delay: ORBIT_MS / 2, ms: ORBIT_MS / 2, ease: "in-out" },
    ],
  },
};

/**
 * Shape morph loader: a square, a circle and a triangle round (60, 60), each
 * as four cubic curves from the top clockwise, so any one tweens to another.
 */
const MORPH_SHAPES = (() => {
  type P = readonly [number, number];
  const line = (a: P, b: P) => [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3, b[0], b[1]];
  const path = (start: P, curves: number[][]) => `M${start.join(" ")} ${curves.map((c) => `C${c.map(r1).join(" ")}`).join(" ")} Z`;
  const k = 28 * 0.5523;
  const circle = path([60, 32], [
    [60 + k, 32, 88, 60 - k, 88, 60],
    [88, 60 + k, 60 + k, 88, 60, 88],
    [60 - k, 88, 32, 60 + k, 32, 60],
    [32, 60 - k, 60 - k, 32, 60, 32],
  ]);
  const square = path([60, 34], [
    [86, 34, 86, 34, 86, 60],
    [86, 86, 86, 86, 60, 86],
    [34, 86, 34, 86, 34, 60],
    [34, 34, 34, 34, 60, 34],
  ]);
  const top: P = [60, 30];
  const right: P = [90, 82];
  const left: P = [30, 82];
  const triangle = path(top, [line(top, right), line(right, [60, 82]), line([60, 82], left), line(left, top)]);
  return [square, circle, triangle];
})();
const MORPH_HOLD = 250;
const MORPH_MS = 450;

export const shapeMorphLoader: VectorEffect = {
  kind: "vector",
  id: "shape-morph-loader",
  name: "Shape morph loader",
  description: "A shape that turns as it morphs from a square into a circle, a triangle and back, changing colour with each.",
  category: "loader",
  tags: ["loader", "morph", "shape", "spinner", "playful", "ui"],
  hold: 0,
  presets: [
    { name: "Mono", values: { first: [0.07, 0.09, 0.15], second: [0.07, 0.09, 0.15], third: [0.07, 0.09, 0.15] } },
    { name: "Pastel", values: { first: [0.99, 0.65, 0.65], second: [0.65, 0.85, 0.99], third: [0.72, 0.95, 0.75] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{first: color default=#F43F5E label='Square'}} {{second: color default=#6366F1 label='Circle'}} {{third: color default=#10B981 label='Triangle'}} --><g id="shapeMorphLoaderTurn" transform="rotate(0 60 60)"><path id="shapeMorphLoaderShape" d="${MORPH_SHAPES[0]}" fill="{{first}}"/></g></svg>`,
    animate: (["first", "second", "third"] as const).flatMap((colour, i): SvgAnimation[] => {
      const next = (["first", "second", "third"] as const)[(i + 1) % 3]!;
      const delay = i * (MORPH_HOLD + MORPH_MS) + MORPH_HOLD;
      return [
        { id: "shapeMorphLoaderShape", attrs: { d: [MORPH_SHAPES[i]!, MORPH_SHAPES[(i + 1) % 3]!], fill: [`{{${colour}}}`, `{{${next}}}`] }, delay, ms: MORPH_MS, ease: "in-out" },
        { id: "shapeMorphLoaderTurn", attrs: { transform: [`rotate(${i * 120} 60 60)`, `rotate(${(i + 1) * 120} 60 60)`] }, delay, ms: MORPH_MS, ease: "in-out" },
      ];
    }),
  },
};

/*
 * Riffle shuffle: twelve cards, in the document in the order they end up
 * stacked, so each one riffled in lands on those below it. Cut into two
 * halves (even cards left, odd right), they drop back in turn from the
 * bottom up, and the deck is tapped square: it ends as it began.
 */
const RIFFLE_CARDS = 12;
const riffleStacked = (k: number) => `translate(80 ${r1(68 - k * 0.8)}) rotate(0)`;
const riffleHalf = (k: number) => (k % 2 === 0 ? `translate(48 ${r1(70 - (k / 2) * 1.3)}) rotate(-12)` : `translate(112 ${r1(70 - ((k - 1) / 2) * 1.3)}) rotate(12)`);
const RIFFLE_FROM = 420;
const RIFFLE_GAP = 55;
const RIFFLE_SQUARE = RIFFLE_FROM + RIFFLE_CARDS * RIFFLE_GAP + 120;

export const riffleShuffle: VectorEffect = {
  kind: "vector",
  id: "riffle-shuffle",
  name: "Riffle shuffle",
  description: "A deck of cards cut in two and riffled back together, the cards dropping in from either side in turn before the deck is tapped square, over and over.",
  category: "loader",
  tags: ["loader", "card", "shuffle", "deck", "playing-card", "waiting", "loop"],
  hold: 300,
  presets: [
    { name: "Red back", values: { back: [0.8, 0.15, 0.18] } },
    { name: "Mono", values: { back: [0.2, 0.22, 0.27], trim: [0.85, 0.87, 0.9] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 160 120"><!-- {{back: color default=#4F46E5 label='Card back'}} {{trim: color default=#FFFFFF label='Card edge'}} --><g id="riffleShuffleDeck" transform="translate(0 0)">${Array.from(
      { length: RIFFLE_CARDS },
      (_, k) =>
        `<g id="riffleShuffleCard${k}" transform="${riffleStacked(k)}"><rect x="-16" y="-23" width="32" height="46" rx="3.5" fill="{{trim}}" stroke="#000000" stroke-opacity="0.18" stroke-width="0.6"/><rect x="-13" y="-20" width="26" height="40" rx="2" fill="{{back}}"/><path d="M0 -12 L7 0 L0 12 L-7 0 Z" fill="none" stroke="{{trim}}" stroke-opacity="0.55" stroke-width="1.2"/></g>`,
    ).join("")}</g></svg>`,
    animate: [
      // Cut: every card to its half.
      ...Array.from({ length: RIFFLE_CARDS }, (_, k): SvgAnimation => ({ id: `riffleShuffleCard${k}`, attrs: { transform: [riffleStacked(k), riffleHalf(k)] }, ms: 340, ease: "in-out" })),
      // Riffle: from the bottom up, each drops back onto the stack.
      ...Array.from({ length: RIFFLE_CARDS }, (_, k): SvgAnimation => ({
        id: `riffleShuffleCard${k}`,
        attrs: { transform: [riffleHalf(k), riffleStacked(k)] },
        delay: RIFFLE_FROM + k * RIFFLE_GAP,
        ms: 170,
        ease: "out",
      })),
      // Tapped square.
      { id: "riffleShuffleDeck", attrs: { transform: ["translate(0 0)", "translate(0 -5)"] }, delay: RIFFLE_SQUARE, ms: 140, ease: "out" },
      { id: "riffleShuffleDeck", attrs: { transform: ["translate(0 -5)", "translate(0 0)"] }, delay: RIFFLE_SQUARE + 140, ms: 160, ease: "in-out" },
    ],
  },
};

export const loaderEffects: VectorEffect[] = [skeletonShimmer, progressBar, indeterminateBar, stepProgress, circleDotsLoader, waveBars, hourglass, infinityLoader, orbitLoader, shapeMorphLoader, riffleShuffle];
