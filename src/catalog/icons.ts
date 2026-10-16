import { lerpAttr, type EaseName, type SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/*
 * Animated icons: small pictures in a 100-unit box (so they scale to any
 * size) with a colour control or two. Looping ones play seamlessly or rest
 * on a frame that matches their start; the click and hover ones follow the
 * interaction conventions (see interaction.ts): a toggle turns on with step
 * 1 and off with step 2, a one-shot has one step that returns by itself, and
 * a hover plays to its end and back.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field. */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** A transform scaling by `s` about (`cx`, `cy`). */
const about = (cx: number, cy: number, s: number) => `translate(${cx} ${cy}) scale(${r2(s)}) translate(${-cx} ${-cy})`;

type Values = Record<string, string | number>;

/**
 * A linear change from `from` to `to` that repeats every `period` ms,
 * starting `phase` (0–1) of the way through: written as two changes (from
 * the phase to the end, then from the start back to the phase), so every
 * period starts exactly where the last ended and the loop is seamless.
 */
function cycle(id: string, from: Values, to: Values, phase: number, period: number, ease: EaseName = "linear"): SvgAnimation[] {
  const at = (u: number) => Object.fromEntries(Object.keys(from).map((k) => [k, lerpAttr(from[k]!, to[k]!, u)]));
  const mid = at(phase);
  const pairs = (a: Values, b: Values) => Object.fromEntries(Object.keys(from).map((k) => [k, [a[k]!, b[k]!] as const]));
  const first = Math.round((1 - phase) * period);
  const out: SvgAnimation[] = [{ id, attrs: pairs(mid, to), ms: first, ease }];
  if (phase > 0) out.push({ id, attrs: pairs(from, mid), delay: first, ms: period - first, ease });
  return out;
}

/** There and back over `period` ms (in-out both ways), so the loop is seamless. */
const swing = (id: string, attr: string, a: string | number, b: string | number, period: number, delay = 0): SvgAnimation[] => [
  { id, attrs: { [attr]: [a, b] }, delay, ms: period / 2, ease: "in-out" },
  { id, attrs: { [attr]: [b, a] }, delay: delay + period / 2, ms: period / 2, ease: "in-out" },
];

/** A picker's groups: each shown only when the int control `name` picks it. */
const picks = (name: string, count: number) => (v: Record<string, unknown>) => {
  const pick = Math.min(count - 1, Math.max(0, Math.round(Number(v[name]) || 0)));
  return Object.fromEntries(Array.from({ length: count }, (_, k) => [`show${k}`, k === pick ? "inline" : "none"]));
};

// ── Weather icons ──────────────────────────────────────────────────────

const WEATHER_MS = 2400;
/** A cloud round (0, 0), about 60 wide and 34 high. */
const CLOUD = "M-22 14 H22 A12 12 0 0 0 20 -9 A17 17 0 0 0 -12 -10 A12 12 0 0 0 -22 14Z";
const DROP = "M0 -5 C2 -1 3 1 3 3 A3 3 0 0 1 -3 3 C-3 1 -2 -1 0 -5Z";
const FLAKE = "M0 -4 V4 M-3.5 -2 L3.5 2 M-3.5 2 L3.5 -2";
const sunRays = (cx: number, cy: number, from: number, to: number) =>
  Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    return `M${r1(cx + from * Math.cos(a))} ${r1(cy + from * Math.sin(a))} L${r1(cx + to * Math.cos(a))} ${r1(cy + to * Math.sin(a))}`;
  }).join(" ");
const cloud = (id: string, x: number, y: number, s: number, fill: string, extra = "") => `<g id="${id}" transform="translate(${x} ${y}) scale(${s})"><path d="${CLOUD}" fill="${fill}"${extra}/></g>`;
/** Things falling from under a cloud, each at its own phase of the fall. */
const falling = (prefix: string, shape: (i: number) => string, xs: number[], top: number, bottom: number, spin = 0) => ({
  markup: xs.map((x, i) => `<g id="${prefix}${i}" transform="translate(${x} ${top}) rotate(0)" opacity="1">${shape(i)}</g>`).join(""),
  animate: xs.flatMap((x, i) =>
    cycle(`${prefix}${i}`, { transform: `translate(${x} ${top}) rotate(0)`, opacity: 1 }, { transform: `translate(${x + spin / 30} ${bottom}) rotate(${spin})`, opacity: 0 }, (i * 0.37 + 0.15) % 1, WEATHER_MS),
  ),
});
const rain = falling("weatherIconsDrop", () => `<path d="${DROP}" fill="{{accent}}"/>`, [36, 50, 64, 43, 57], 50, 86);
const storm = falling("weatherIconsStormDrop", () => `<path d="${DROP}" fill="{{accent}}"/>`, [34, 66], 50, 86);
const snow = falling("weatherIconsFlake", () => `<path d="${FLAKE}" stroke="{{accent}}" stroke-width="1.8" stroke-linecap="round"/>`, [36, 50, 64, 43, 58], 50, 88, 120);
const WIND = ["M14 38 H58 C68 38 70 26 62 24 C56 23 54 29 58 32", "M10 52 H76 C86 52 88 64 80 66 C74 67 72 61 76 58", "M20 66 H50"];

export const weatherIcons: VectorEffect = {
  kind: "vector",
  id: "weather-icons",
  name: "Weather icons",
  description: "An animated weather icon: sun with turning rays, partly cloudy, drifting clouds, falling rain, a flashing thunderbolt, snow or gusting wind.",
  category: "icon",
  tags: ["weather", "forecast", "sun", "rain", "snow", "loop"],
  hold: 0,
  presets: [
    { name: "Rain", values: { kind: 3 } },
    { name: "Snow", values: { kind: 5, cloud: [0.8, 0.85, 0.92], accent: [0.55, 0.75, 0.95] } },
    { name: "Thunder", values: { kind: 4, cloud: [0.39, 0.45, 0.55] } },
  ],
  derived: picks("kind", 7),
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{kind: int min=0 max=6 default=0 label='Weather (sun, partly cloudy, cloudy, rain, thunder, snow, wind)'}} {{sun: color default=#FBBF24 label='Sun'}} {{cloud: color default=#94A3B8 label='Cloud'}} {{accent: color default=#38BDF8 label='Rain, snow and wind'}} {{bolt: color default=#FACC15 label='Lightning'}} -->`
      + `<g display="{{show0}}"><g id="weatherIconsRays" transform="rotate(0 50 50)"><path d="${sunRays(50, 50, 26, 36)}" stroke="{{sun}}" stroke-width="5" stroke-linecap="round"/></g><circle id="weatherIconsSun" cx="50" cy="50" r="17" fill="{{sun}}"/></g>`
      + `<g display="{{show1}}"><g id="weatherIconsPartRays" transform="rotate(0 38 38)"><path d="${sunRays(38, 38, 19, 27)}" stroke="{{sun}}" stroke-width="4" stroke-linecap="round"/></g><circle cx="38" cy="38" r="13" fill="{{sun}}"/>${cloud("weatherIconsPartCloud", 56, 60, 1, "{{cloud}}")}</g>`
      + `<g display="{{show2}}">${cloud("weatherIconsBackCloud", 62, 40, 0.75, "{{cloud}}", ` opacity="0.55"`)}${cloud("weatherIconsFrontCloud", 46, 56, 1.05, "{{cloud}}")}</g>`
      + `<g display="{{show3}}">${rain.markup}${cloud("weatherIconsRainCloud", 50, 38, 1.1, "{{cloud}}")}</g>`
      + `<g display="{{show4}}">${storm.markup}<g transform="translate(50 36) scale(1.1)"><path d="${CLOUD}" fill="{{cloud}}"/><path d="${CLOUD}" fill="#000000" opacity="0.22"/></g><path id="weatherIconsBolt" d="M54 50 L42 70 H51 L45 90 L63 64 H54 L60 50Z" fill="{{bolt}}" opacity="0"/></g>`
      + `<g display="{{show5}}">${snow.markup}${cloud("weatherIconsSnowCloud", 50, 38, 1.1, "{{cloud}}")}</g>`
      + `<g display="{{show6}}" fill="none" stroke="{{accent}}" stroke-width="5" stroke-linecap="round">${WIND.map((d, k) => `<path id="weatherIconsWind${k}" d="${d}"/>`).join("")}</g></svg>`,
    animate: [
      ...cycle("weatherIconsRays", { transform: "rotate(0 50 50)" }, { transform: "rotate(45 50 50)" }, 0, WEATHER_MS),
      ...swing("weatherIconsSun", "r", 17, 18.5, WEATHER_MS),
      ...cycle("weatherIconsPartRays", { transform: "rotate(0 38 38)" }, { transform: "rotate(45 38 38)" }, 0, WEATHER_MS),
      ...swing("weatherIconsPartCloud", "transform", "translate(54 60) scale(1)", "translate(60 60) scale(1)", WEATHER_MS),
      ...swing("weatherIconsBackCloud", "transform", "translate(66 40) scale(0.75)", "translate(58 40) scale(0.75)", WEATHER_MS),
      ...swing("weatherIconsFrontCloud", "transform", "translate(43 56) scale(1.05)", "translate(50 56) scale(1.05)", WEATHER_MS),
      ...swing("weatherIconsRainCloud", "transform", "translate(49 38) scale(1.1)", "translate(51 38) scale(1.1)", WEATHER_MS),
      ...swing("weatherIconsSnowCloud", "transform", "translate(49 38) scale(1.1)", "translate(51 38) scale(1.1)", WEATHER_MS),
      ...rain.animate,
      ...storm.animate,
      ...snow.animate,
      // Two quick flashes, then dark until the loop comes round.
      { id: "weatherIconsBolt", attrs: { opacity: [0, 1] }, delay: 700, ms: 60 },
      { id: "weatherIconsBolt", attrs: { opacity: [1, 0.2] }, delay: 760, ms: 90 },
      { id: "weatherIconsBolt", attrs: { opacity: [0.2, 1] }, delay: 850, ms: 60 },
      { id: "weatherIconsBolt", attrs: { opacity: [1, 0] }, delay: 1100, ms: 400 },
      // Gusts draw on in turn and fade; undrawn again by the time the loop restarts.
      ...WIND.flatMap((_, k): SvgAnimation[] => [
        { id: `weatherIconsWind${k}`, draw: true, delay: k * 220, ms: 900, ease: "in-out" },
        { id: `weatherIconsWind${k}`, attrs: { opacity: [1, 0] }, delay: 1300 + k * 220, ms: 450 },
      ]),
    ],
  },
};

// ── Notification bell ──────────────────────────────────────────────────

const BELL_PIVOT = "50 16";
const bellTurn = (deg: number) => `rotate(${deg} ${BELL_PIVOT})`;
const BELL_SWING = [0, 18, -15, 11, -7, 3, 0];
const CLAPPER_SWING = [0, -12, 14, -9, 6, -2, 0];
const BADGE = [72, 26] as const;

export const notificationBell: VectorEffect = {
  kind: "vector",
  id: "notification-bell",
  name: "Notification bell",
  description: "A bell ringing with a damped swing and its clapper lagging behind, as a badge pops on with the unread count.",
  category: "icon",
  tags: ["notification", "bell", "alert", "badge", "ui", "loop"],
  hold: 300,
  presets: [
    { name: "Dark", values: { bell: [0.9, 0.91, 0.94], ring: [0.06, 0.07, 0.1] } },
    { name: "Many", values: { count: 128 } },
  ],
  derived: (v) => {
    const count = Math.max(0, Math.round(Number(v.count) || 0));
    const many = count > 99;
    const digits = many ? 3 : String(count).length;
    return {
      from: many ? 99 : Math.max(0, count - 1),
      to: many ? 99 : count,
      format: many ? "{n}+" : "{n}",
      size: digits >= 3 ? 9 : digits === 2 ? 11 : 13,
      badgeR: digits >= 3 ? 15 : 13,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 100 100" font-family="${SANS}"><!-- {{count: int min=0 max=999 default=3 label='Count'}} {{bell: color default=#334155 label='Bell'}} {{badge: color default=#EF4444 label='Badge'}} {{ring: color default=#FFFFFF label='Badge outline'}} --><g fill="none" stroke="{{bell}}" stroke-width="3.5" stroke-linecap="round"><path id="notificationBellWaveL" d="M20 30 C14 38 14 50 20 58" opacity="0"/><path id="notificationBellWaveR" d="M80 30 C86 38 86 50 80 58" opacity="0"/></g><g id="notificationBellClapper" transform="${bellTurn(0)}"><circle cx="50" cy="80" r="7" fill="{{bell}}"/></g><g id="notificationBellBody" transform="${bellTurn(0)}"><circle cx="50" cy="15" r="5" fill="{{bell}}"/><path d="M50 18 C36 18 30 30 30 44 V58 L23 68 V72 H77 V68 L70 58 V44 C70 30 64 18 50 18Z" fill="{{bell}}"/></g><g id="notificationBellBadge" transform="${about(BADGE[0], BADGE[1], 0)}"><circle cx="${BADGE[0]}" cy="${BADGE[1]}" r="{{badgeR}}" fill="{{badge}}" stroke="{{ring}}" stroke-width="3"/><text id="notificationBellCount" x="${BADGE[0]}" y="${BADGE[1] + 4.5}" text-anchor="middle" font-size="{{size}}" font-weight="800" fill="#FFFFFF">0</text></g></svg>`,
    animate: [
      ...BELL_SWING.slice(1).map((deg, k): SvgAnimation => ({ id: "notificationBellBody", attrs: { transform: [bellTurn(BELL_SWING[k]!), bellTurn(deg)] }, delay: k * 120, ms: 120, ease: "in-out" })),
      ...CLAPPER_SWING.slice(1).map((deg, k): SvgAnimation => ({ id: "notificationBellClapper", attrs: { transform: [bellTurn(CLAPPER_SWING[k]!), bellTurn(deg)] }, delay: 50 + k * 120, ms: 120, ease: "in-out" })),
      ...["L", "R"].flatMap((side, k): SvgAnimation[] => [
        { id: `notificationBellWave${side}`, attrs: { opacity: [0, 1] }, delay: 80 + k * 120, ms: 120 },
        { id: `notificationBellWave${side}`, attrs: { opacity: [1, 0] }, delay: 420 + k * 120, ms: 260 },
      ]),
      { id: "notificationBellBadge", attrs: { transform: [about(BADGE[0], BADGE[1], 0), about(BADGE[0], BADGE[1], 1.25)] }, delay: 300, ms: 180, ease: "out" },
      { id: "notificationBellBadge", attrs: { transform: [about(BADGE[0], BADGE[1], 1.25), about(BADGE[0], BADGE[1], 1)] }, delay: 480, ms: 200, ease: "in-out" },
      { id: "notificationBellCount", count: [n("from"), n("to")], format: "{{format}}", delay: 300, ms: 350, ease: "out" },
      // The badge goes before the loop starts over, so it can pop on again.
      { id: "notificationBellBadge", attrs: { transform: [about(BADGE[0], BADGE[1], 1), about(BADGE[0], BADGE[1], 0)] }, delay: 2400, ms: 220, ease: "in-out" },
    ],
  },
};

// ── Animated arrows ────────────────────────────────────────────────────

const ARROW_MS = 1200;
/** Refresh arrows: an arc round (50, 50) from 180° clockwise to 320°, and its head. */
const refreshArc = (() => {
  const r = 26;
  const end = (-40 * Math.PI) / 180;
  const [ex, ey] = [50 + r * Math.cos(end), 50 + r * Math.sin(end)];
  const [tx, ty] = [-Math.sin(end), Math.cos(end)];
  const [nx, ny] = [Math.cos(end), Math.sin(end)];
  const tip = `${r1(ex + tx * 7)} ${r1(ey + ty * 7)}`;
  const head = `M${r1(ex + nx * 7)} ${r1(ey + ny * 7)} L${tip} L${r1(ex - nx * 7)} ${r1(ey - ny * 7)}Z`;
  return { arc: `M24 50 A${r} ${r} 0 0 1 ${r1(ex)} ${r1(ey)}`, head };
})();

export const animatedArrows: VectorEffect = {
  kind: "vector",
  id: "animated-arrows",
  name: "Animated arrows",
  description: "An arrow icon set: an arrow nudging right, chevrons cascading down, refresh arrows turning, or an external-link arrow leaving its box.",
  category: "icon",
  tags: ["arrow", "chevron", "refresh", "link", "ui", "loop"],
  // Every arrow's motion is over by 1000 ms: each rests the same before it repeats.
  hold: ARROW_MS - 1000,
  presets: [
    { name: "Scroll hint", values: { kind: 1, color: [0.39, 0.4, 0.95] } },
    { name: "Refresh", values: { kind: 2 } },
  ],
  derived: picks("kind", 4),
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{kind: int min=0 max=3 default=0 label='Arrow (right, chevrons, refresh, external)'}} {{color: color default=#0F172A label='Colour'}} {{width: float min=2 max=12 default=7 step=0.5 label='Stroke width'}} --><g fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round">`
      + `<g display="{{show0}}"><g id="animatedArrowsRight" transform="translate(0 0)"><path d="M20 50 H76 M56 30 L76 50 L56 70"/></g></g>`
      + `<g display="{{show1}}">${[0, 1, 2].map((k) => `<path id="animatedArrowsChevron${k}" d="M32 ${24 + k * 18} L50 ${38 + k * 18} L68 ${24 + k * 18}" opacity="0.2"/>`).join("")}</g>`
      + `<g display="{{show2}}"><g id="animatedArrowsRefresh" transform="rotate(0 50 50)">${[0, 180].map((deg) => `<g transform="rotate(${deg} 50 50)"><path d="${refreshArc.arc}"/><path d="${refreshArc.head}" fill="{{color}}" stroke-width="2"/></g>`).join("")}</g></g>`
      + `<g display="{{show3}}"><path d="M54 22 H32 C26 22 22 26 22 32 V68 C22 74 26 78 32 78 H68 C74 78 78 74 78 68 V46"/><g id="animatedArrowsExternal" transform="translate(0 0)"><path d="M46 54 L76 24 M56 24 H76 V44"/></g></g>`
      + `</g></svg>`,
    animate: [
      { id: "animatedArrowsRight", attrs: { transform: ["translate(0 0)", "translate(9 0)"] }, ms: 380, ease: "out" },
      { id: "animatedArrowsRight", attrs: { transform: ["translate(9 0)", "translate(0 0)"] }, delay: 380, ms: 520, ease: "in-out" },
      ...[0, 1, 2].flatMap((k): SvgAnimation[] => [
        { id: `animatedArrowsChevron${k}`, attrs: { opacity: [0.2, 1], transform: ["translate(0 0)", "translate(0 3)"] }, delay: k * 180, ms: 260, ease: "out" },
        { id: `animatedArrowsChevron${k}`, attrs: { opacity: [1, 0.2], transform: ["translate(0 3)", "translate(0 0)"] }, delay: k * 180 + 300, ms: 420, ease: "in-out" },
      ]),
      // Two arrows round the circle: half a turn brings it back to how it started.
      { id: "animatedArrowsRefresh", attrs: { transform: ["rotate(0 50 50)", "rotate(180 50 50)"] }, ms: 1000, ease: "in-out" },
      { id: "animatedArrowsExternal", attrs: { transform: ["translate(0 0)", "translate(10 -10)"], opacity: [1, 0] }, delay: 100, ms: 360, ease: "in-out" },
      { id: "animatedArrowsExternal", attrs: { transform: ["translate(-10 10)", "translate(0 0)"], opacity: [0, 1] }, delay: 520, ms: 420, ease: "out" },
    ],
  },
};

// ── Emoji reactions ────────────────────────────────────────────────────

const EMOJI_Y = 40;
const emojiX = (i: number) => 30 + i * 44;
const emojiPose = (i: number, dy: number, s: number) => `translate(${emojiX(i)} ${EMOJI_Y}) translate(0 ${dy}) scale(${s})`;
const FACES = [
  // Like: a thumb up on a blue disc.
  `<circle r="17" fill="{{like}}"/><path d="M-8 -1 H-4 V9 H-8Z M-2 -1 L2 -9 C3.5 -10.5 6.5 -9 5.8 -6.3 L4.8 -2.5 H8.5 C10.4 -2.5 11.4 -0.6 10.8 1.2 L8.8 7.5 C8.3 9 7.2 9.6 5.8 9.6 H-2Z" fill="#FFFFFF"/>`,
  // Love: a heart on a red disc.
  `<circle r="17" fill="{{love}}"/><path d="M0 9 C0 9 -9.5 3 -9.5 -2.8 C-9.5 -6 -7.3 -8.2 -4.6 -8.2 C-2.6 -8.2 -0.9 -7.1 0 -5.5 C0.9 -7.1 2.6 -8.2 4.6 -8.2 C7.3 -8.2 9.5 -6 9.5 -2.8 C9.5 3 0 9 0 9Z" fill="#FFFFFF"/>`,
  // Haha: shut eyes and a wide open laugh.
  `<circle r="17" fill="{{face}}"/><path d="M-10 -6 L-5 -3.5 L-10 -1 M10 -6 L5 -3.5 L10 -1" fill="none" stroke="{{features}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M-9 2 H9 C9 8.5 5 12 0 12 C-5 12 -9 8.5 -9 2Z" fill="{{features}}"/>`,
  // Wow: raised brows, round eyes and mouth.
  `<circle r="17" fill="{{face}}"/><path d="M-9 -9 Q-6 -11.5 -3 -9.5 M9 -9 Q6 -11.5 3 -9.5" fill="none" stroke="{{features}}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="-5.5" cy="-3.5" rx="2.2" ry="3" fill="{{features}}"/><ellipse cx="5.5" cy="-3.5" rx="2.2" ry="3" fill="{{features}}"/><ellipse cx="0" cy="7.5" rx="4" ry="5" fill="{{features}}"/>`,
  // Sad: a frown and a tear.
  `<circle r="17" fill="{{face}}"/><circle cx="-5.5" cy="-3" r="2.2" fill="{{features}}"/><circle cx="5.5" cy="-3" r="2.2" fill="{{features}}"/><path d="M-6 9.5 Q0 3.5 6 9.5" fill="none" stroke="{{features}}" stroke-width="2" stroke-linecap="round"/><path d="M-6 1 C-4.5 3.5 -4 4.8 -4 5.8 A2 2 0 0 1 -8 5.8 C-8 4.8 -7.5 3.5 -6 1Z" fill="#38BDF8"/>`,
  // Angry: a red-orange face with knitted brows.
  `<circle r="17" fill="{{angry}}"/><path d="M-10 -8 L-3 -4.5 M10 -8 L3 -4.5" stroke="{{features}}" stroke-width="2.2" stroke-linecap="round"/><circle cx="-5" cy="-1" r="2" fill="{{features}}"/><circle cx="5" cy="-1" r="2" fill="{{features}}"/><path d="M-6 10 Q0 5.5 6 10" fill="none" stroke="{{features}}" stroke-width="2" stroke-linecap="round"/>`,
];

export const emojiReactions: VectorEffect = {
  kind: "vector",
  id: "emoji-reactions",
  name: "Emoji reactions",
  description: "A reaction picker: on hover the bar opens and like, love, haha, wow, sad and angry faces bounce up one after another, drawn as vectors.",
  category: "icon",
  tags: ["interactive", "hover", "emoji", "reactions", "social", "ui"],
  trigger: "hover",
  hold: 600,
  presets: [{ name: "Dark", values: { pill: [0.13, 0.14, 0.19], button: [0.6, 0.63, 0.7] } }],
  motion: {
    svg: `<svg viewBox="0 0 280 80"><!-- {{pill: color default=#FFFFFF label='Bar'}} {{button: color default=#64748B label='Button icon'}} {{face: color default=#FBBF24 label='Faces'}} {{features: color default=#5B3A00 label='Eyes and mouths'}} {{like: color default=#2563EB label='Like'}} {{love: color default=#F43F5E label='Love'}} {{angry: color default=#F97316 label='Angry'}} --><rect id="emojiReactionsShadow" x="8" y="17" width="52" height="52" rx="26" fill="#000000" opacity="0.1"/><rect id="emojiReactionsPill" x="6" y="14" width="52" height="52" rx="26" fill="{{pill}}" stroke="#000000" stroke-opacity="0.08"/><g id="emojiReactionsButton" fill="none" stroke="{{button}}" stroke-width="2.2" stroke-linecap="round"><circle cx="30" cy="40" r="11"/><circle cx="26" cy="37" r="0.8" fill="{{button}}"/><circle cx="34" cy="37" r="0.8" fill="{{button}}"/><path d="M25.5 43.5 Q30 47 34.5 43.5"/></g>${FACES.map(
      (face, i) => `<g id="emojiReactionsFace${i}" transform="${emojiPose(i, 14, 0)}">${face}</g>`,
    ).join("")}</svg>`,
    animate: [
      { id: "emojiReactionsPill", attrs: { width: [52, 268] }, ms: 280, ease: "out" },
      { id: "emojiReactionsShadow", attrs: { width: [52, 268] }, ms: 280, ease: "out" },
      { id: "emojiReactionsButton", attrs: { opacity: [1, 0] }, ms: 120 },
      ...FACES.flatMap((_, i): SvgAnimation[] => [
        { id: `emojiReactionsFace${i}`, attrs: { transform: [emojiPose(i, 14, 0), emojiPose(i, -9, 1.15)] }, delay: 90 + i * 70, ms: 200, ease: "out" },
        { id: `emojiReactionsFace${i}`, attrs: { transform: [emojiPose(i, -9, 1.15), emojiPose(i, 0, 1)] }, delay: 290 + i * 70, ms: 200, ease: "in-out" },
      ]),
    ],
  },
};

// ── Bookmark star (star rating) ────────────────────────────────────────

const STARS = 5;
const STAR = { y: 32, r: 16, inner: 7, pitch: 38, first: 22 };
const starX = (i: number) => STAR.first + i * STAR.pitch;
const starPath = (cx: number) =>
  `M${Array.from({ length: 10 }, (_, k) => {
    const a = (k * Math.PI) / 5 - Math.PI / 2;
    const r = k % 2 ? STAR.inner : STAR.r;
    return `${r1(cx + r * Math.cos(a))} ${r1(STAR.y + 1.5 + r * Math.sin(a))}`;
  }).join(" L")}Z`;

export const bookmarkStar: VectorEffect = {
  kind: "vector",
  id: "bookmark-star",
  name: "Star rating",
  description: "Five stars that fill one after another on hover, each bouncing as it fills (halves too), while the rating counts up beside them.",
  category: "icon",
  tags: ["interactive", "hover", "rating", "stars", "review", "ui"],
  trigger: "hover",
  hold: 600,
  presets: [
    { name: "Half", values: { rating: 3.5 } },
    { name: "Dark", values: { empty: [0.28, 0.31, 0.37], ink: [0.94, 0.95, 0.97] } },
  ],
  derived: (v) => {
    const rating = Math.min(STARS, Math.max(0, Math.round((Number(v.rating) || 0) * 2) / 2));
    return {
      rating,
      ...Object.fromEntries(
        Array.from({ length: STARS }, (_, i) => {
          const f = Math.min(1, Math.max(0, rating - i));
          return [
            [`w${i}`, r1(f * STAR.r * 2)],
            [`pop${i}`, about(starX(i), STAR.y, f > 0 ? 1.22 : 1)],
          ];
        }).flat(),
      ),
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 260 64" font-family="${SANS}"><!-- {{rating: float min=0 max=5 default=4.5 step=0.5 label='Rating'}} {{star: color default=#FBBF24 label='Filled'}} {{empty: color default=#CBD5E1 label='Empty'}} {{ink: color default=#0F172A label='Text'}} --><defs>${Array.from(
      { length: STARS },
      (_, i) => `<clipPath id="bookmarkStarClip${i}"><rect id="bookmarkStarFill${i}" x="${starX(i) - STAR.r}" y="${STAR.y - STAR.r - 2}" width="0" height="${STAR.r * 2 + 6}"/></clipPath>`,
    ).join("")}</defs>${Array.from(
      { length: STARS },
      (_, i) =>
        `<g id="bookmarkStarStar${i}" transform="${about(starX(i), STAR.y, 1)}"><path d="${starPath(starX(i))}" fill="{{empty}}" stroke="{{empty}}" stroke-width="2" stroke-linejoin="round"/><path d="${starPath(starX(i))}" fill="{{star}}" stroke="{{star}}" stroke-width="2" stroke-linejoin="round" clip-path="url(#bookmarkStarClip${i})"/></g>`,
    ).join("")}<text id="bookmarkStarValue" x="202" y="38.5" font-size="16" font-weight="700" fill="{{ink}}" opacity="0">0.0</text></svg>`,
    animate: [
      ...Array.from({ length: STARS }, (_, i): SvgAnimation[] => [
        { id: `bookmarkStarFill${i}`, attrs: { width: [0, n(`w${i}`)] }, delay: i * 110, ms: 160, ease: "linear" },
        { id: `bookmarkStarStar${i}`, attrs: { transform: [about(starX(i), STAR.y, 1), `{{pop${i}}}`] }, delay: i * 110 + 60, ms: 130, ease: "out" },
        { id: `bookmarkStarStar${i}`, attrs: { transform: [`{{pop${i}}}`, about(starX(i), STAR.y, 1)] }, delay: i * 110 + 190, ms: 180, ease: "in-out" },
      ]).flat(),
      { id: "bookmarkStarValue", attrs: { opacity: [0, 1] }, ms: 200 },
      { id: "bookmarkStarValue", count: [0, n("rating")], decimals: 1, format: "{n} / 5", ms: STARS * 110 + 100, ease: "out" },
    ],
  },
};

// ── Trash delete ───────────────────────────────────────────────────────

const LID_HINGE = "76 30";
const lid = (deg: number) => `rotate(${deg} ${LID_HINGE})`;
const paperAt = (x: number, y: number, deg: number) => `translate(${x} ${y}) rotate(${deg})`;
const canTilt = (deg: number) => `rotate(${deg} 50 88)`;

export const trashDelete: VectorEffect = {
  kind: "vector",
  id: "trash-delete",
  name: "Trash delete",
  description: "A trash can whose lid flips open as a crumpled paper drops in, then snaps shut with a little wobble; replays on every click.",
  category: "icon",
  tags: ["interactive", "click", "delete", "trash", "remove", "ui"],
  trigger: "click",
  hold: 600,
  presets: [
    { name: "Danger", values: { color: [0.86, 0.15, 0.15] } },
    { name: "Dark", values: { color: [0.9, 0.91, 0.94], paper: [0.6, 0.63, 0.7] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{color: color default=#334155 label='Can'}} {{paper: color default=#F8FAFC label='Paper'}} {{width: float min=2 max=8 default=5 step=0.5 label='Stroke width'}} --><g id="trashDeletePaper" transform="${paperAt(38, 12, 0)}" opacity="0"><path d="M-9 -4 L-4 -10 L3 -8 L9 -3 L8 5 L2 9 L-6 8 L-10 2Z" fill="{{paper}}" stroke="{{color}}" stroke-width="2" stroke-linejoin="round"/><path d="M-4 -3 L2 1 M-2 5 L4 -2" stroke="{{color}}" stroke-width="1.4" stroke-linecap="round"/></g><g id="trashDeleteCan" transform="${canTilt(0)}" fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"><path d="M30 36 L34 82 C34.4 86 36 88 40 88 H60 C64 88 65.6 86 66 82 L70 36"/><path d="M43 46 V76 M57 46 V76"/><g id="trashDeleteLid" transform="${lid(0)}"><path d="M24 30 H76 M42 30 V23 H58 V30"/></g></g></svg>`,
    animate: [
      { id: "trashDeleteLid", step: 1, attrs: { transform: [lid(0), lid(32)] }, ms: 220, ease: "out" },
      { id: "trashDeletePaper", step: 1, attrs: { opacity: [0, 1] }, delay: 100, ms: 100 },
      { id: "trashDeletePaper", step: 1, attrs: { transform: [paperAt(38, 12, 0), paperAt(48, 62, 160)] }, delay: 120, ms: 420, ease: "in-out" },
      { id: "trashDeletePaper", step: 1, attrs: { opacity: [1, 0] }, delay: 430, ms: 110 },
      { id: "trashDeleteLid", step: 1, attrs: { transform: [lid(32), lid(0)] }, delay: 540, ms: 170, ease: "in-out" },
      { id: "trashDeleteLid", step: 1, attrs: { transform: [lid(0), lid(5)] }, delay: 710, ms: 80, ease: "out" },
      { id: "trashDeleteLid", step: 1, attrs: { transform: [lid(5), lid(0)] }, delay: 790, ms: 120, ease: "in-out" },
      { id: "trashDeleteCan", step: 1, attrs: { transform: [canTilt(0), canTilt(-5)] }, delay: 700, ms: 90, ease: "out" },
      { id: "trashDeleteCan", step: 1, attrs: { transform: [canTilt(-5), canTilt(3)] }, delay: 790, ms: 120, ease: "in-out" },
      { id: "trashDeleteCan", step: 1, attrs: { transform: [canTilt(3), canTilt(0)] }, delay: 910, ms: 140, ease: "in-out" },
      // The paper, gone, goes back to the top for the next click.
      { id: "trashDeletePaper", step: 1, attrs: { transform: [paperAt(38, 12, 0), paperAt(38, 12, 0)] }, delay: 1100, ms: 0 },
    ],
  },
};

// ── Lock / unlock ──────────────────────────────────────────────────────

const shackle = (y: number) => `translate(0 ${y})`;
const keyPose = (deg: number, s: number) => `translate(50 66) rotate(${deg}) scale(${s})`;

export const lockUnlock: VectorEffect = {
  kind: "vector",
  id: "lock-unlock",
  name: "Lock and unlock",
  description: "A padlock: a click turns a key and pops the shackle open as the lock turns green; the next click turns it back and snaps it shut.",
  category: "icon",
  tags: ["interactive", "click", "lock", "security", "toggle", "ui"],
  trigger: "click",
  hold: 600,
  presets: [{ name: "Dark", values: { locked: [0.85, 0.87, 0.9], hole: [0.06, 0.07, 0.1] } }],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{locked: color default=#334155 label='Locked'}} {{open: color default=#16A34A label='Unlocked'}} {{hole: color default=#FFFFFF label='Keyhole'}} {{key: color default=#F59E0B label='Key'}} --><g id="lockUnlockShackle" transform="${shackle(0)}"><path id="lockUnlockLoop" d="M34 48 V34 C34 25 41 18 50 18 C59 18 66 25 66 34 V48" fill="none" stroke="{{locked}}" stroke-width="8"/></g><rect id="lockUnlockBody" x="22" y="44" width="56" height="44" rx="9" fill="{{locked}}"/><g id="lockUnlockHole" transform="rotate(0 50 66)"><circle cx="50" cy="62" r="5.5" fill="{{hole}}"/><path d="M47.5 64 H52.5 L53.5 75 H46.5Z" fill="{{hole}}"/></g><g id="lockUnlockKey" transform="${keyPose(0, 0.4)}" opacity="0"><rect x="-2.5" y="-6" width="5" height="10" fill="{{key}}"/><circle cy="-13" r="8" fill="none" stroke="{{key}}" stroke-width="4.5"/></g></svg>`,
    animate: [
      // Step 1, unlock: the key goes in and turns, the shackle springs up, and the lock goes green.
      { id: "lockUnlockKey", step: 1, attrs: { opacity: [0, 1], transform: [keyPose(0, 0.4), keyPose(0, 1)] }, ms: 160, ease: "out" },
      { id: "lockUnlockKey", step: 1, attrs: { transform: [keyPose(0, 1), keyPose(90, 1)] }, delay: 180, ms: 200, ease: "in-out" },
      { id: "lockUnlockHole", step: 1, attrs: { transform: ["rotate(0 50 66)", "rotate(90 50 66)"] }, delay: 180, ms: 200, ease: "in-out" },
      { id: "lockUnlockShackle", step: 1, attrs: { transform: [shackle(0), shackle(-16)] }, delay: 380, ms: 160, ease: "out" },
      { id: "lockUnlockShackle", step: 1, attrs: { transform: [shackle(-16), shackle(-12)] }, delay: 540, ms: 180, ease: "in-out" },
      { id: "lockUnlockBody", step: 1, attrs: { fill: ["{{locked}}", "{{open}}"] }, delay: 380, ms: 220 },
      { id: "lockUnlockLoop", step: 1, attrs: { stroke: ["{{locked}}", "{{open}}"] }, delay: 380, ms: 220 },
      { id: "lockUnlockKey", step: 1, attrs: { opacity: [1, 0] }, delay: 650, ms: 200 },
      // Step 2, lock: the key turns back, the shackle drops shut with a bump.
      { id: "lockUnlockKey", step: 2, attrs: { opacity: [0, 1], transform: [keyPose(90, 0.4), keyPose(90, 1)] }, ms: 160, ease: "out" },
      { id: "lockUnlockKey", step: 2, attrs: { transform: [keyPose(90, 1), keyPose(0, 1)] }, delay: 180, ms: 200, ease: "in-out" },
      { id: "lockUnlockHole", step: 2, attrs: { transform: ["rotate(90 50 66)", "rotate(0 50 66)"] }, delay: 180, ms: 200, ease: "in-out" },
      { id: "lockUnlockShackle", step: 2, attrs: { transform: [shackle(-12), shackle(2)] }, delay: 380, ms: 150, ease: "in-out" },
      { id: "lockUnlockShackle", step: 2, attrs: { transform: [shackle(2), shackle(0)] }, delay: 530, ms: 120, ease: "out" },
      { id: "lockUnlockBody", step: 2, attrs: { fill: ["{{open}}", "{{locked}}"] }, delay: 400, ms: 220 },
      { id: "lockUnlockLoop", step: 2, attrs: { stroke: ["{{open}}", "{{locked}}"] }, delay: 400, ms: 220 },
      { id: "lockUnlockKey", step: 2, attrs: { opacity: [1, 0] }, delay: 650, ms: 200 },
      { id: "lockUnlockKey", step: 2, attrs: { transform: [keyPose(0, 0.4), keyPose(0, 0.4)] }, delay: 900, ms: 0 },
    ],
  },
};

// ── Wi-Fi signal ───────────────────────────────────────────────────────

const WIFI = { cx: 50, cy: 80 };
const wifiArc = (r: number) => {
  const d = r * Math.SQRT1_2;
  return `M${r1(WIFI.cx - d)} ${r1(WIFI.cy - d)} A${r} ${r} 0 0 1 ${r1(WIFI.cx + d)} ${r1(WIFI.cy - d)}`;
};
const WIFI_ARCS = [20, 36, 52];

export const wifiSignal: VectorEffect = {
  kind: "vector",
  id: "wifi-signal",
  name: "Wi-Fi signal",
  description: "Wi-Fi bars filling one after another from the dot outward, pulsing twice at full strength, then fading to start again.",
  category: "icon",
  tags: ["wifi", "signal", "connection", "network", "status", "loop"],
  hold: 200,
  presets: [
    { name: "Dark", values: { track: [0.2, 0.22, 0.27], color: [0.38, 0.65, 0.98] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{color: color default=#2563EB label='Signal'}} {{track: color default=#E2E8F0 label='Empty bars'}} {{width: float min=4 max=12 default=9 step=0.5 label='Bar width'}} --><g fill="none" stroke="{{track}}" stroke-width="{{width}}" stroke-linecap="round">${WIFI_ARCS.map((r) => `<path d="${wifiArc(r)}"/>`).join("")}</g><circle cx="${WIFI.cx}" cy="${WIFI.cy}" r="6.5" fill="{{track}}"/><g id="wifiSignalOn"><circle id="wifiSignalDot" cx="${WIFI.cx}" cy="${WIFI.cy}" r="6.5" fill="{{color}}" opacity="0"/><g fill="none" stroke="{{color}}" stroke-width="{{width}}" stroke-linecap="round">${WIFI_ARCS.map((r, k) => `<path id="wifiSignalArc${k}" d="${wifiArc(r)}" opacity="0"/>`).join("")}</g></g></svg>`,
    animate: [
      { id: "wifiSignalDot", attrs: { opacity: [0, 1], r: [3, 6.5] }, ms: 220, ease: "out" },
      ...WIFI_ARCS.map((_, k): SvgAnimation => ({ id: `wifiSignalArc${k}`, attrs: { opacity: [0, 1] }, delay: 250 + k * 250, ms: 220, ease: "out" })),
      ...[0, 1].flatMap((k): SvgAnimation[] => swing("wifiSignalOn", "opacity", 1, 0.45, 600, 1150 + k * 600)),
      // Fades out together, so the loop starts from empty again.
      { id: "wifiSignalDot", attrs: { opacity: [1, 0], r: [6.5, 3] }, delay: 2600, ms: 300 },
      ...WIFI_ARCS.map((_, k): SvgAnimation => ({ id: `wifiSignalArc${k}`, attrs: { opacity: [1, 0] }, delay: 2600, ms: 300 })),
    ],
  },
};

export const iconEffects: VectorEffect[] = [weatherIcons, notificationBell, animatedArrows, emojiReactions, bookmarkStar, trashDelete, lockUnlock, wifiSignal];
