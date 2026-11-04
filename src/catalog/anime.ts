import type { SvgAnimation } from "../vector/motion.js";
import { about, keys, LETTERING, snap, star } from "./comic.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Anime and manga as vector effects, inked like the comic ones: flat fills
 * with a heavy outline drawn under them (`paint-order="stroke"`), shapes that
 * pop in past their size and settle. Animated elements' ids start with the
 * effect's initials.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Faces with Japanese glyphs, the heaviest first. */
const JAPANESE = `'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif`;

// ── Menacing ───────────────────────────────────────────────────────────

const MG_LOOP = 1800;
/** Ms between keyframes of the throb, sampled from a periodic curve so the loop closes. */
const MG_STEP = 100;

/** Each glyph's place, size and lean: two columns climbing up the sides of the frame. */
const MG_GLYPHS: readonly (readonly [number, number, number, number])[] = [
  [64, 228, 1, -8],
  [98, 156, 0.85, -4],
  [122, 94, 0.7, -10],
  [336, 228, 1, 8],
  [302, 156, 0.85, 4],
  [278, 94, 0.7, 10],
];

/** A glyph's pose `u` of the way through the loop: a throb, a rise and a tremble, each glyph a beat behind the last. */
function mgPose(k: number, u: number): string {
  const [x, y, s, lean] = MG_GLYPHS[k]!;
  const a = 2 * Math.PI * (u + (k % 3) / 3 + (k >= 3 ? 1 / 6 : 0));
  const throb = 1 + 0.16 * Math.pow(0.5 + 0.5 * Math.sin(a), 3);
  const dx = 1.6 * Math.sin(a * 5);
  const dy = -7 * Math.sin(a) + 1.2 * Math.cos(a * 4);
  return `translate(${r1(x + dx)} ${r1(y + dy)}) rotate(${r1(lean + 3 * Math.sin(a * 2))}) scale(${r2(s * throb)})`;
}

export const menacing: VectorEffect = {
  kind: "vector",
  id: "menacing",
  name: "Menacing",
  description: "The manga menace: heavy outlined ゴ glyphs climbing both sides of the frame, throbbing and trembling one after another while something ominous happens, on a transparent loop.",
  category: "anime",
  tags: ["anime", "manga", "menacing", "katakana", "onomatopoeia", "tension", "overlay", "loop"],
  hold: 0,
  presets: [
    { name: "Rumble (ドドド)", values: { glyph: "ド", fill: [0.86, 0.22, 0.3] } },
    { name: "Shock (ザワ)", values: { glyph: "ザワ", fill: [0.2, 0.2, 0.22], outline: [1, 1, 1] } },
  ],
  derived: (v) => {
    const size = Math.min(78, 78 / Math.max(1, textWidthEm(String(v.glyph))));
    return { size: r1(size), base: r1(size * 0.36) };
  },
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{glyph: text default='ゴ' label='Glyph'}} {{fill: color default=#7B2CBF label='Fill'}} {{outline: color default=#14061F label='Outline'}} {{font: text default="${JAPANESE}" label='Font'}} -->${MG_GLYPHS.map(
      (_, k) =>
        `<g id="mg${k}" transform="${mgPose(k, 0)}"><text y="{{base}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="900" fill="{{fill}}" stroke="{{outline}}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">{{glyph}}</text></g>`,
    ).join("")}</svg>`,
    animate: MG_GLYPHS.flatMap((_, k) =>
      keys(
        `mg${k}`,
        "transform",
        Array.from({ length: MG_LOOP / MG_STEP + 1 }, (_, i) => [i * MG_STEP, mgPose(k, (i * MG_STEP) / MG_LOOP)] as const),
        { ease: "linear" },
      ),
    ),
  },
};

// ── Eyecatch ───────────────────────────────────────────────────────────

const EC_X = 320;
const EC_Y = 140;
/** Ms the card holds once it is all in. */
const EC_OUT = 2400;

/** Where the subtitle's pill sits, under the burst. */
const EC_SUB_Y = 304;

const ecSlide = (dx: number) => `translate(${dx} 0)`;

export const eyecatch: VectorEffect = {
  kind: "vector",
  id: "eyecatch",
  name: "Eyecatch",
  description: "An anime eyecatch card, the bumper either side of an ad break: two diagonal colour bands slash across from opposite sides, a starburst spins open and the show's title slams in over it with its subtitle, holds, then everything sweeps away.",
  category: "anime",
  tags: ["anime", "eyecatch", "title", "bumper", "episode", "text", "broadcast", "loop"],
  hold: 400,
  presets: [
    { name: "Mecha", values: { band1: [0.1, 0.32, 0.86], band2: [0.95, 0.2, 0.18], burst: [1, 0.85, 0.1], background: [0.06, 0.08, 0.16], title: "GEAR STRIKER", subtitle: "Episode 7 · Launch!" } },
    { name: "Slice of life", values: { band1: [0.55, 0.85, 0.7], band2: [1, 0.78, 0.52], burst: [1, 1, 1], background: [1, 0.98, 0.93], title: "Café Days", subtitle: "つづく" } },
  ],
  derived: (v) => {
    const t = Math.max(0.6, textWidthEm(String(v.title)));
    const s = Math.max(0.6, textWidthEm(String(v.subtitle)));
    const size = Math.min(76, 500 / t);
    const subSize = Math.min(22, 340 / s);
    const pillW = s * subSize + 36;
    const pillH = subSize + 16;
    return {
      size: r1(size),
      base: r1(EC_Y + size * 0.36),
      subSize: r1(subSize),
      subBase: r1(EC_SUB_Y + subSize * 0.36),
      pillX: r1(EC_X - pillW / 2),
      pillY: r1(EC_SUB_Y - pillH / 2),
      pillW: r1(pillW),
      pillH: r1(pillH),
      subShow: String(v.subtitle).trim() ? "inline" : "none",
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 640 360"><!-- {{title: text default='SUMMER ARC' label='Title'}} {{subtitle: text default='Episode 12' label='Subtitle'}} {{background: color default=#FFF6EA label='Background'}} {{band1: color default=#FF4F8B label='First band'}} {{band2: color default=#FFC93C label='Second band'}} {{burst: color default=#FFFFFF label='Burst'}} {{letters: color default=#FFFFFF label='Letters'}} {{ink: color default=#1B1A33 label='Ink'}} {{font: text default="${LETTERING}" label='Font'}} --><rect width="640" height="360" fill="{{background}}"/><g id="ecBand1" transform="${ecSlide(-720)}"><path d="M-20 70 L660 16 L660 196 L-20 250 Z" fill="{{band1}}" stroke="{{ink}}" stroke-width="5"/></g><g id="ecBand2" transform="${ecSlide(720)}"><path d="M-20 262 L660 208 L660 262 L-20 316 Z" fill="{{band2}}" stroke="{{ink}}" stroke-width="5"/></g><g id="ecBurst" transform="${about(EC_X, EC_Y, 0, 0, -40)}"><path d="${star(EC_X, EC_Y, 134, 94, 16)}" fill="{{burst}}" stroke="{{ink}}" stroke-width="4" stroke-linejoin="miter" opacity="0.92"/></g><g id="ecTitle" transform="${about(EC_X, EC_Y, 0, 0, -6)}"><text x="${EC_X + 6}" y="{{base}}" dy="6" text-anchor="middle" font-family="{{font}}, ${JAPANESE}" font-size="{{size}}" font-weight="900" fill="{{ink}}" stroke="{{ink}}" stroke-width="10" stroke-linejoin="round">{{title}}</text><text x="${EC_X}" y="{{base}}" text-anchor="middle" font-family="{{font}}, ${JAPANESE}" font-size="{{size}}" font-weight="900" fill="{{letters}}" stroke="{{ink}}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">{{title}}</text></g><g id="ecSub" transform="translate(0 16)" opacity="0"><g display="{{subShow}}" transform="rotate(-4.5 ${EC_X} ${EC_SUB_Y})"><rect x="{{pillX}}" y="{{pillY}}" width="{{pillW}}" height="{{pillH}}" rx="6" fill="{{ink}}"/><text x="${EC_X}" y="{{subBase}}" text-anchor="middle" font-family="{{font}}, ${JAPANESE}" font-size="{{subSize}}" font-weight="700" fill="{{letters}}">{{subtitle}}</text></g></g></svg>`,
    animate: [
      // The bands slash in from opposite sides, then carry on out the far side.
      { id: "ecBand1", attrs: { transform: [ecSlide(-720), ecSlide(0)] }, ms: 380, ease: "out" },
      { id: "ecBand2", attrs: { transform: [ecSlide(720), ecSlide(0)] }, delay: 90, ms: 380, ease: "out" },
      { id: "ecBand1", attrs: { transform: [ecSlide(0), ecSlide(720)] }, delay: EC_OUT, ms: 340, ease: [0.55, 0, 1, 0.45] },
      { id: "ecBand2", attrs: { transform: [ecSlide(0), ecSlide(-720)] }, delay: EC_OUT + 60, ms: 340, ease: [0.55, 0, 1, 0.45] },
      snap("ecBand1", "transform", ecSlide(-720), EC_OUT + 420),
      snap("ecBand2", "transform", ecSlide(720), EC_OUT + 420),
      // The burst spins open behind the title and keeps turning while it holds.
      ...keys("ecBurst", "transform", [
        [220, about(EC_X, EC_Y, 0, 0, -40)],
        [520, about(EC_X, EC_Y, 1.08, 1.08, 6)],
        [680, about(EC_X, EC_Y, 1, 1, 0)],
        [EC_OUT, about(EC_X, EC_Y, 1, 1, 22)],
        [EC_OUT + 300, about(EC_X, EC_Y, 0, 0, 60)],
      ], { ease: "out" }),
      snap("ecBurst", "transform", about(EC_X, EC_Y, 0, 0, -40), EC_OUT + 420),
      // The title slams in past its size and settles; it shrinks away as the bands leave.
      ...keys("ecTitle", "transform", [
        [380, about(EC_X, EC_Y, 0, 0, -6)],
        [560, about(EC_X, EC_Y, 1.25, 1.25, -9)],
        [680, about(EC_X, EC_Y, 0.94, 0.94, -5)],
        [800, about(EC_X, EC_Y, 1, 1, -6)],
        [EC_OUT, about(EC_X, EC_Y, 1, 1, -6)],
        [EC_OUT + 260, about(EC_X, EC_Y, 0, 0, -6)],
      ], { ease: "out" }),
      // The subtitle rises in under it a beat later.
      { id: "ecSub", attrs: { transform: ["translate(0 16)", "translate(0 0)"], opacity: [0, 1] }, delay: 760, ms: 260, ease: "out" },
      { id: "ecSub", attrs: { opacity: [1, 0] }, delay: EC_OUT - 60, ms: 200 },
      snap("ecSub", "transform", "translate(0 16)", EC_OUT + 420),
    ] satisfies SvgAnimation[],
  },
};

export const animeEffects: VectorEffect[] = [menacing, eyecatch];
