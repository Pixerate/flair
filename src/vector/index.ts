/**
 * Vector motion: animated SVG pictures described as data.
 *
 * - Describing motion: `SvgMotion`, `SvgAnimation` (attribute tweens, draw-on,
 *   along a path, counts, written text, view zooms), checked by `svgMotionIssues`.
 * - Frames as pure functions: `svgFrame`, `lerpAttr`, `lerpData`, `stepData`.
 * - Shape morphing: `morphPaths`, `morphSequence` (any paths → paths that blend).
 * - Drawing: `parseSvg` (sanitised), `svgView`, `SvgPlayer`.
 *
 * @packageDocumentation
 */

export { morphPaths, morphSequence, type MorphOptions } from "./morph.js";
export {
  defaultDataKey,
  EASES,
  formatCount,
  lerpAttr,
  lerpData,
  STEP_MS,
  stepData,
  stepProgress,
  stepStart,
  SVG_PICTURE,
  svgFrame,
  svgMotionIssues,
  svgOpeningTag,
  SCRAMBLE_MS,
  writtenText,
  type DataKey,
  type EaseName,
  type SvgAnimation,
  type SvgBox,
  type SvgElementFrame,
  type SvgMotion,
} from "./motion.js";
export {
  animateCount,
  parseSvg,
  svgDuration,
  SvgPlayer,
  svgView,
  type AnimateCountOptions,
  type SvgPlayerOptions,
  type SvgTrigger,
  type SvgView,
  type SvgViewOptions,
} from "./svg.js";
