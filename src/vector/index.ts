/**
 * Vector motion: animated SVG pictures described as data.
 *
 * - Describing motion: `SvgMotion`, `SvgAnimation` (attribute tweens, draw-on,
 *   along a path, counts, written text, view zooms), checked by `svgMotionIssues`.
 * - Frames as pure functions: `svgFrame`, `lerpAttr`, `lerpData`, `stepData`.
 * - Drawing: `parseSvg` (sanitised), `svgView`, `SvgPlayer`.
 *
 * @packageDocumentation
 */

export {
  defaultDataKey,
  EASES,
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
  parseSvg,
  svgDuration,
  SvgPlayer,
  svgView,
  type SvgPlayerOptions,
  type SvgView,
  type SvgViewOptions,
} from "./svg.js";
