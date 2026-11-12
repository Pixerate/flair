/**
 * Paint hints: which catalog effects make good paint in an editor that brushes
 * with effects (the Pixerate editors' effect paint), and how.
 *
 * Painting has to add something a still frame doesn't. An effect gets a hint
 * when it
 * - follows the stroke (`path`: a path effect drawing along the stroke's
 *   centreline, given as its path control);
 * - reads as a material bent along a stroke (`stroke`: gradients, organic
 *   fields, patterns, water, lava, fire and light), or as a texture or field
 *   fixed to the canvas that the stroke uncovers (`canvas`); or
 * - keeps moving as live paint where the motion is the point (`live`).
 *
 * It must show something without audio, a pointer or an input picture. Framed
 * scenes and objects (planets, cities, skies with a horizon), loaders, UI
 * widgets, text and titles, meme banners, audio visualisers and cursor or
 * click effects get none: painting with them only uncovers a fragment of a
 * picture meant to be seen whole. No hint means "don't offer it as paint".
 *
 * Each was judged by rendering it along a sample stroke. `src/catalog/paint.test.ts`
 * checks the hints name real controls; the demo's `#check` page and the Swift
 * tests render each one along a path on a GPU.
 */

import type { ControlValue } from "../shader/controls.js";

/**
 * How a paint lies on the canvas:
 * - `path`: the effect draws along the stroke itself, given the stroke's
 *   centreline as its path control.
 * - `stroke`: rendered into a strip and bent along each stroke (with `repeat`).
 * - `canvas`: rendered once at the canvas size and fixed to it; strokes
 *   uncover it.
 */
export type PaintMap = "path" | "stroke" | "canvas";

/** Every {@link PaintMap}. */
export const PAINT_MAPS: readonly PaintMap[] = ["path", "stroke", "canvas"];

/** Past the end of a `stroke` paint's strip: start again, run back, or hold the last colour. */
export type PaintRepeat = "repeat" | "mirror" | "clamp";

/** Every {@link PaintRepeat}. */
export const PAINT_REPEATS: readonly PaintRepeat[] = ["repeat", "mirror", "clamp"];

/** How an effect paints (see the module's notes for which effects get one). */
export interface EffectPaintHint {
  map: PaintMap;
  /** Up to two colour controls the brush's colours fill, main first. */
  colors?: readonly string[];
  /** Values applied over the defaults when painting (a clear backdrop, no draw-on, …). */
  values?: Readonly<Record<string, ControlValue>>;
  /** Whether a stroke keeps playing the effect. */
  live?: boolean;
  /** For `stroke`: past the end of the strip (default `mirror`). */
  repeat?: PaintRepeat;
  /** A suggested brush width (px). */
  size?: number;
}

/** No backdrop: only what the effect draws is left. */
const clear = { uBackgroundAlpha: 0 } as const;

/** Every catalog effect that makes good paint, by id. */
export const PAINT_HINTS: Readonly<Record<string, EffectPaintHint>> = {
  // Path effects: they draw along the stroke. The pointer trails trace the whole stroke when given its points.
  "comet-trail": { map: "path", colors: ["uTail", "uHead"], live: true },
  "ribbon-trail": { map: "path", colors: ["uColorA", "uColorB"], live: true },
  "sparkle-trail": { map: "path", colors: ["uColorA", "uColorB"], live: true },
  "ghost-trail": { map: "path", colors: ["uColor"], live: true },
  "brush-trail": { map: "path", colors: ["uInk"], values: { uPaper: false }, live: true },
  "glass-tube": { map: "path", colors: ["uColorA", "uColorC"], values: { ...clear, uDrawOn: 0 } },
  "glass-writing": { map: "path", colors: ["uColorA", "uColorC"], values: { ...clear, uDrawOn: 0 }, size: 32 },
  "swoosh-underline": { map: "path", colors: ["uColor", "uCore"], values: { uAnimate: false, uSecond: false } },
  "light-painting": { map: "path", values: clear },
  "border-beam": { map: "path", colors: ["uHead", "uTail"], live: true },

  // Materials bent along the stroke.
  "mesh-gradient": { map: "stroke", colors: ["uColorA", "uColorB"] },
  "gradient-flow": { map: "stroke", colors: ["uColorA", "uColorB"] },
  "grainy-gradient": { map: "stroke", colors: ["uColorA", "uColorB"] },
  "stripe-gradient": { map: "stroke", colors: ["uColorA", "uColorB"] },
  "noise-grain-bg": { map: "stroke", colors: ["uColorA", "uColorB"] },
  silk: { map: "stroke", colors: ["uSheen", "uBase"] },
  aurora: { map: "stroke", colors: ["uGlowA", "uGlowB"], live: true },
  "holographic-gradient": { map: "stroke", colors: ["uTint"] },
  "dither-gradient": { map: "stroke", colors: ["uLight", "uDark"] },
  plasma: { map: "stroke", live: true },
  "iridescent-blobs": { map: "stroke", live: true },
  marble: { map: "stroke", colors: ["uVein", "uStone"] },
  smoke: { map: "stroke", colors: ["uSmoke"], values: clear, live: true },
  caustics: { map: "stroke", colors: ["uWater", "uLight"], live: true },
  flames: { map: "stroke", colors: ["uMid", "uHot"], live: true, repeat: "repeat" },
  "pixel-fire": { map: "stroke", colors: ["uFlame", "uCore"], live: true, repeat: "repeat" },
  "pixel-water": { map: "stroke", colors: ["uMid", "uLight"], live: true, repeat: "repeat" },
  "lava-flow": { map: "stroke", colors: ["uLava", "uHot"], live: true },
  "lava-bubbles": { map: "stroke", colors: ["uMolten", "uHot"], live: true },
  "molten-web": { map: "stroke", colors: ["uGlowColor", "uHot"] },
  "neon-fluid": { map: "stroke", colors: ["uColorA", "uColorB"], values: clear, live: true },
  "neon-worms": { map: "stroke", colors: ["uColorA", "uColorB"], values: clear, live: true },
  "neon-circuit": { map: "stroke", colors: ["uColorA", "uColorB"], values: clear, live: true, repeat: "repeat" },
  "light-ribbons": { map: "stroke", colors: ["uColorA", "uColorB"], values: clear, live: true },
  "light-waves": { map: "stroke", colors: ["uHighlight", "uBase"] },
  nebula: { map: "stroke", colors: ["uGasA", "uGasB"] },
  fizz: { map: "stroke", colors: ["uDrink", "uBubble"], live: true, repeat: "repeat" },
  foam: { map: "stroke", colors: ["uWall", "uBase"], repeat: "repeat" },
  fur: { map: "stroke", colors: ["uTip", "uRoot"], repeat: "repeat" },
  "reaction-diffusion": { map: "stroke", colors: ["uInk", "uBase"], repeat: "repeat" },
  stripes: { map: "stroke", colors: ["uColorA", "uColorB"], repeat: "repeat" },
  "stained-glass": { map: "stroke", colors: ["uColorA", "uColorB"], repeat: "repeat" },
  truchet: { map: "stroke", colors: ["uLine", "uBackground"], repeat: "repeat" },
  voronoi: { map: "stroke", colors: ["uCell", "uWall"], repeat: "repeat" },

  // Textures and fields fixed to the canvas: strokes uncover them.
  "conic-sweep": { map: "canvas", colors: ["uColorA", "uColorB"] },
  "radial-glow": { map: "canvas", colors: ["uColorA", "uColorB"] },
  "lava-lamp": { map: "canvas", colors: ["uBlobA", "uBlobB"], values: clear, live: true },
  veins: { map: "canvas", colors: ["uVein", "uPulse"], values: clear, live: true },
  "dot-wave": { map: "canvas", colors: ["uDot"], values: clear, live: true },
  "neon-ripple": { map: "canvas", colors: ["uNeon"], values: clear, live: true },
  "hex-pulse": { map: "canvas", colors: ["uEdge", "uFill"], values: clear, live: true },
  "relief-hex-tiles": { map: "canvas", colors: ["uSurface", "uShade"], values: { uCoverage: 1, uScatter: 0.2 } },
  moire: { map: "canvas", colors: ["uInk", "uPaper"], live: true },
  kaleidoscope: { map: "canvas", colors: ["uTint"], live: true },
  "memphis-pattern": { map: "canvas", colors: ["uInkA", "uInkB"] },
  "frost-creep": { map: "canvas", colors: ["uColor"], values: { uAnimate: false } },
  "tv-static": { map: "canvas", colors: ["uTint"], live: true },
  "digital-rain": { map: "canvas", colors: ["uGlyph"], values: clear, live: true },
  starfield: { map: "canvas", colors: ["uStar"], values: clear, live: true },
  "plexus-web": { map: "canvas", colors: ["uColorA", "uColorB"], values: clear, live: true },
  "flow-particles": { map: "canvas", colors: ["uFast", "uSlow"], values: { ...clear, uTransparent: true }, live: true },
  "god-rays": { map: "canvas", colors: ["uLight"], values: clear, live: true },
  "prism-burst": { map: "canvas", values: clear, live: true },
  sparkles: { map: "canvas", colors: ["uSparkle"], live: true },
  bokeh: { map: "canvas", colors: ["uWarm", "uCool"], live: true },
  embers: { map: "canvas", colors: ["uHeat"], live: true },
  snowfall: { map: "canvas", colors: ["uColor"], live: true },
  "rain-streaks": { map: "canvas", colors: ["uColor"], live: true },
  "leaves-blowing": { map: "canvas", colors: ["uColor1", "uColor2"], live: true },
};

/** The paint hint of catalog effect `id`, or undefined when it does not make good paint. */
export function paintHint(id: string): EffectPaintHint | undefined {
  return Object.hasOwn(PAINT_HINTS, id) ? PAINT_HINTS[id] : undefined;
}
