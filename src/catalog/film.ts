import type { SvgAnimation } from "../vector/motion.js";
import { holds } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * Film drawn as vectors: a vintage projector running, its reels turning and
 * its beam flickering. It loops seamlessly: every change repeats a whole
 * number of times in the loop.
 */

/** The loop (ms): the feed reel turns once, the take-up reel twice. */
const LOOP = 2400;
/** The beam flickers on frames of a 12 fps projector. */
const FLICKER_FPS = 12;

/** Steady pseudo-random numbers (0–1) from a seed, so the flicker is the same on every render. */
function flickers(count: number, seed: number): number[] {
  let s = seed;
  return Array.from({ length: count }, () => {
    s = (s * 16807) % 2147483647;
    return (s % 1000) / 1000;
  });
}

const REELS = [
  { id: "filmProjectorFeed", cx: 150, cy: 92, r: 54, turns: 1 },
  { id: "filmProjectorTakeUp", cx: 252, cy: 104, r: 40, turns: 2 },
] as const;

const reel = ({ id, cx, cy, r }: (typeof REELS)[number]) =>
  `<line x1="${cx}" y1="${cy}" x2="${cx < 200 ? 186 : 236}" y2="150" stroke="{{body}}" stroke-width="8" stroke-linecap="round"/><g id="${id}" transform="rotate(0 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="{{reel}}"/><circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="none" stroke="{{body}}" stroke-opacity="0.35" stroke-width="2"/>${[0, 120, 240]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const d = r * 0.52;
      return `<circle cx="${Math.round((cx + Math.cos(a) * d) * 10) / 10}" cy="${Math.round((cy + Math.sin(a) * d) * 10) / 10}" r="${Math.round(r * 0.26 * 10) / 10}" fill="{{body}}"/>`;
    })
    .join("")}<circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.16 * 10) / 10}" fill="{{trim}}"/><circle cx="${cx}" cy="${cy}" r="3" fill="{{body}}"/></g>`;

/** Dust in the beam: where each mote enters, how far it drifts up or down, and how many times it crosses in a loop. */
const MOTES = [
  { y: 168, dy: -36, times: 2 },
  { y: 176, dy: 28, times: 3 },
  { y: 172, dy: -8, times: 4 },
] as const;

export const filmProjector: VectorEffect = {
  kind: "vector",
  id: "film-projector",
  name: "Film projector",
  description:
    "A vintage film projector running: its two reels turning, the film feeding through it from one to the other, and a flickering cone of light streaming from its lens with dust drifting through the beam, on a seamless loop.",
  category: "film",
  tags: ["film", "cinema", "projector", "film-reel", "vintage", "movie", "icon", "loop"],
  hold: 0,
  presets: [
    { name: "Chrome", values: { body: [0.55, 0.58, 0.62], trim: [0.2, 0.21, 0.24], reel: [0.85, 0.87, 0.9] } },
    { name: "Dark room", values: { backdrop: 1, background: [0.05, 0.05, 0.07] } },
    { name: "Warm beam", values: { beam: [1, 0.82, 0.5], beamOpacity: 0.7 } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 400 300"><!-- {{body: color default=#2E3138 label='Body'}} {{trim: color default=#9AA0AA label='Trim'}} {{reel: color default=#C6CAD2 label='Reels'}} {{film: color default=#3B2A1E label='Film'}} {{beam: color default=#FFF3D1 label='Beam'}} {{beamOpacity: float min=0 max=1 default=0.55 step=0.05 label='Beam strength'}} {{background: color default=#101216 label='Background'}} {{backdrop: float min=0 max=1 default=0 step=0.05 label='Background opacity'}} --><defs><linearGradient id="filmProjectorBeamFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{beam}}" stop-opacity="{{beamOpacity}}"/><stop offset="1" stop-color="{{beam}}" stop-opacity="0"/></linearGradient></defs><rect width="400" height="300" fill="{{background}}" opacity="{{backdrop}}"/><path id="filmProjectorBeam" d="M326 162 L400 104 V244 L326 178 Z" fill="url(#filmProjectorBeamFill)"/>${MOTES.map(
      (m, k) => `<circle id="filmProjectorMote${k}" cx="330" cy="${m.y}" r="1.6" fill="{{beam}}" opacity="0"/>`,
    ).join("")}<path id="filmProjectorFilmIn" d="M96 92 C96 150 120 170 150 176" fill="none" stroke="{{film}}" stroke-width="3" stroke-dasharray="6 4"/><path id="filmProjectorFilmOut" d="M262 192 C292 200 300 150 292 104" fill="none" stroke="{{film}}" stroke-width="3" stroke-dasharray="6 4"/>${REELS.map(reel).join(
      "",
    )}<rect x="120" y="150" width="180" height="76" rx="12" fill="{{body}}"/><rect x="132" y="162" width="58" height="10" rx="5" fill="{{trim}}" opacity="0.6"/><circle cx="270" cy="208" r="7" fill="{{trim}}"/><rect x="298" y="158" width="26" height="24" rx="3" fill="{{trim}}"/><rect x="320" y="154" width="10" height="32" rx="3" fill="{{body}}"/><circle cx="330" cy="170" r="5" fill="{{beam}}" opacity="0.9"/><path d="M140 226 L132 248 H156 L160 226 Z M262 226 L266 248 H290 L282 226 Z" fill="{{body}}"/></svg>`,
    animate: [
      ...REELS.map(
        ({ id, cx, cy, turns }): SvgAnimation => ({ id, attrs: { transform: [`rotate(0 ${cx} ${cy})`, `rotate(360 ${cx} ${cy})`] }, ms: LOOP / turns, repeat: turns, ease: "linear" }),
      ),
      // The film feeding through: its dashes marching along, a whole dash period at a time.
      ...["filmProjectorFilmIn", "filmProjectorFilmOut"].map((id): SvgAnimation => ({ id, attrs: { "stroke-dashoffset": [0, -10] }, ms: LOOP / 8, repeat: 8, ease: "linear" })),
      // The beam flickering on each projector frame, back where it started at the end.
      ...holds(
        "filmProjectorBeam",
        "opacity",
        [
          ...flickers((LOOP / 1000) * FLICKER_FPS, 7).map((h, k) => [Math.round((k * 1000) / FLICKER_FPS), k === 0 ? 1 : Math.round((0.72 + 0.28 * h) * 100) / 100] as const),
          [LOOP, 1] as const,
        ],
      ),
      // Dust drifting out through the beam.
      ...MOTES.map(
        (m, k): SvgAnimation => ({ id: `filmProjectorMote${k}`, attrs: { cx: [330, 398], cy: [m.y, m.y + m.dy], opacity: [0.9, 0] }, ms: LOOP / m.times, repeat: m.times, ease: "linear" }),
      ),
    ],
  },
};

/** Film vector effects. */
export const filmEffects: VectorEffect[] = [filmProjector];
