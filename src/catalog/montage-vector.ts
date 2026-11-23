import { SAMPLE_IMAGES } from "./images.js";
import type { VectorEffect, VectorItem } from "./types.js";

/*
 * Vector montages: SVG pictures whose markup follows their item count. The
 * items live in a text control as JSON (`items.list`); each
 * `{{#items}}…{{/items}}` block is written once per item, and each animation
 * naming `{{item.…}}` runs once per item, `stagger` ms apart (see
 * `renderVectorEffect`).
 */

const SANS = `'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif`;

/** The items a preview shows before any are given. */
const EXAMPLE_ITEMS: VectorItem[] = [
  { href: SAMPLE_IMAGES.logo, label: "Ringlet" },
  { href: SAMPLE_IMAGES.heart, label: "Kindly" },
  { href: SAMPLE_IMAGES.icon, label: "Outline" },
  { href: SAMPLE_IMAGES.logo, label: "Orbit" },
  { href: SAMPLE_IMAGES.heart, label: "Bloom" },
  { href: SAMPLE_IMAGES.icon, label: "Sketch" },
];

const W = 640;
const H = 360;
const PAD = 24;

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Where item `i` of `count` sits on the wall: a grid about as wide as the
 * frame is, the last row centred, each card filling its cell less the gap.
 */
function wallCell(i: number, count: number, gap: number, labels: boolean) {
  const n = Math.max(1, count);
  const cols = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * (W - 2 * PAD)) / (H - 2 * PAD)))));
  const rows = Math.ceil(n / cols);
  const cw = (W - 2 * PAD) / cols;
  const ch = Math.min((H - 2 * PAD) / rows, cw * 0.8);
  const row = Math.floor(i / cols);
  const inRow = row === rows - 1 ? n - row * cols : cols;
  const col = i - row * cols;
  const cx = W / 2 + (col - (inRow - 1) / 2) * cw;
  const cy = H / 2 + (row - (rows - 1) / 2) * ch;
  const w = Math.max(8, cw - gap);
  const h = Math.max(8, ch - gap);
  const font = Math.max(7, Math.min(16, h * 0.13));
  const labelRoom = labels ? font * 1.9 : 0;
  const img = Math.max(4, Math.min(w * 0.62, (h - labelRoom) * 0.66));
  return {
    cx: r1(cx),
    cy: r1(cy),
    x: r1(-w / 2),
    y: r1(-h / 2),
    w: r1(w),
    h: r1(h),
    imgX: r1(-img / 2),
    imgY: r1(-labelRoom / 2 - img / 2),
    img: r1(img),
    labelY: r1(h / 2 - font * 1.05),
    font: r1(font),
  };
}

export const logoWall: VectorEffect = {
  kind: "vector",
  id: "logo-wall",
  name: "Logo wall",
  description: "A wall of cards, one per item (logos, icons, small pictures, each with its label), laid out in a grid that fits however many there are, popping in one after another and then rippling once in the accent colour.",
  category: "montage",
  tags: ["montage", "logo", "customers", "partners", "grid", "wall", "icon", "social-proof", "items"],
  hold: 1200,
  items: { min: 1, max: 24, slots: [], cycle: "repeat", list: "items", stagger: 90 },
  // The item list's JSON cannot sit in a {{…}} declaration, so it is the one control listed here.
  controls: [{ name: "items", type: "text", default: JSON.stringify(EXAMPLE_ITEMS), label: "Items (JSON list of { href, label })" }],
  presets: [
    { name: "Light", values: {} },
    { name: "Dark", values: { card: [0.09, 0.1, 0.13], ink: [0.8, 0.83, 0.88], edge: [0.2, 0.22, 0.27] } },
    { name: "Tight", values: { gap: 4, radius: 4 } },
    { name: "Logos only", values: { labels: false } },
  ],
  derived: (v) => ({ labelDisplay: v.labels === false ? "none" : "inline" }),
  itemDerived: (i, count, v) => wallCell(i, count, Number(v.gap), v.labels !== false),
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}" font-family="${SANS}"><!-- {{card: color default=#FFFFFF label='Card'}} {{ink: color default=#334155 label='Labels'}} {{accent: color default=#6366F1 label='Accent'}} {{edge: color default=#E2E8F0 label='Card edge'}} {{gap: float min=0 max=40 default=14 step=1 label='Gap'}} {{radius: float min=0 max=40 default=12 step=1 label='Corner radius'}} {{labels: bool default=true label='Show labels'}} -->{{#items}}<g id="logoWallItem{{item.i}}" opacity="0" transform="translate({{item.cx}} {{item.cy}}) scale(0.7)"><g id="logoWallLift{{item.i}}" transform="translate(0 0)"><rect id="logoWallCard{{item.i}}" x="{{item.x}}" y="{{item.y}}" width="{{item.w}}" height="{{item.h}}" rx="{{radius}}" fill="{{card}}" stroke="{{edge}}" stroke-width="1.5"/><image href="{{item.href}}" x="{{item.imgX}}" y="{{item.imgY}}" width="{{item.img}}" height="{{item.img}}" preserveAspectRatio="xMidYMid meet"/><text x="0" y="{{item.labelY}}" text-anchor="middle" font-size="{{item.font}}" font-weight="600" fill="{{ink}}" display="{{labelDisplay}}">{{item.label}}</text></g></g>{{/items}}</svg>`,
    animate: [
      { id: "logoWallItem{{item.i}}", attrs: { opacity: [0, 1] }, ms: 260 },
      { id: "logoWallItem{{item.i}}", attrs: { transform: ["translate({{item.cx}} {{item.cy}}) scale(0.7)", "translate({{item.cx}} {{item.cy}}) scale(1)"] }, ms: 520, ease: [0.34, 1.56, 0.64, 1] },
      // Once all are in, a ripple of lifts across the wall in the accent colour.
      { id: "logoWallLift{{item.i}}", attrs: { transform: ["translate(0 0)", "translate(0 -6)"] }, delay: 1300, ms: 220, repeat: 2, alternate: true },
      { id: "logoWallCard{{item.i}}", attrs: { stroke: ["{{edge}}", "{{accent}}"] }, delay: 1300, ms: 220, repeat: 2, alternate: true },
    ],
  },
};

export const montageVectors: VectorEffect[] = [logoWall];
