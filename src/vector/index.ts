/**
 * Vector motion: animated SVG pictures described as data.
 *
 * - Describing motion: `SvgMotion`, `SvgAnimation` (attribute tweens, draw-on,
 *   along a path, counts, written text, view zooms, and `behavior`: pulses,
 *   oscillations, seeded wriggles and overshoots), checked by `svgMotionIssues`.
 *   Reusable entrances, exits and emphasis built on these are in
 *   `@pixerate/flair/motion`.
 * - Frames as pure functions: `svgFrame`, `lerpAttr`, `lerpData`, `stepData`.
 * - Shape morphing: `morphPaths`, `morphSequence` (any paths → paths that blend).
 * - Drawing: `parseSvg` (sanitised), `svgView`, `SvgPlayer`.
 * - Stills without a DOM (server rendering, reduced motion): `svgFrameMarkup`, `svgViewBox`.
 * - Animated files without a DOM or script (an `<img>`, a `.svg` download): `svgAnimatedMarkup`.
 *
 * @packageDocumentation
 */

export { morphPaths, morphSequence, type MorphOptions } from "./morph.js";
export {
  behaviorProgress,
  changeCycles,
  changeLength,
  changeProgress,
  changeTime,
  cubicBezierEase,
  defaultDataKey,
  EASES,
  easeFunction,
  formatCount,
  isCubicBezier,
  isSpringEase,
  isSvgEase,
  SPRING_DEFAULTS,
  springProgress,
  springSettleMs,
  lerpAttr,
  lerpData,
  STEP_MS,
  stepData,
  stepProgress,
  stepStart,
  SVG_BEHAVIORS,
  SVG_PICTURE,
  svgFrame,
  svgMotionIssues,
  svgOpeningTag,
  SCRAMBLE_MS,
  writtenText,
  type CubicBezier,
  type DataKey,
  type EaseName,
  type SvgAnimation,
  type SvgBehavior,
  type SvgBox,
  type SvgEase,
  type ChangeTiming,
  type SpringEase,
  type SvgSpring,
  type SvgElementFrame,
  type SvgMotion,
} from "./motion.js";
export {
  animateCount,
  parseSvg,
  svgDuration,
  SCROLL_RANGE,
  SvgPlayer,
  svgView,
  type AnimateCountOptions,
  type SvgPlayerOptions,
  type SvgTrigger,
  type SvgView,
  type SvgViewOptions,
} from "./svg.js";
export {
  parseViewBox,
  svgFrameMarkup,
  svgInlineLayout,
  svgViewBox,
  type SvgFrameMarkupOptions,
  type SvgInlineLayout,
} from "./static.js";
export { svgAnimatedMarkup, type AnimatedSvgOptions } from "./animated.js";
export {
  computeBoxFit,
  layoutStack,
  type BoxAlignment,
  type BoxFit,
  type FittedBoxResult,
  type StackLayoutOptions,
} from "./layout.js";
export {
  formatUnit,
  remap,
  stepVariant,
  type FormatUnitOptions,
  type UnitFormat,
} from "./converters.js";
