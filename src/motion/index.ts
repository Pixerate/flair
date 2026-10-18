/**
 * Motion primitives: reusable entrances, exits, emphasis and path motions
 * that work on any element of an `SvgMotion`, described as data.
 *
 * - The vocabulary: `PRIMITIVES` (plain JSON descriptors: id, kind, params
 *   with defaults, labels, units and ranges, default `ms` and `ease`),
 *   `listPrimitives`, `getPrimitive`.
 * - Using them: `applyPrimitive(motion, use)` adds one to an element (as
 *   `SvgAnimation`s, plus a wrapper group or clip path where needed), all or
 *   nothing; `removePrimitive(motion, tag)` takes it off; `primitiveTags`
 *   lists what has been applied.
 *
 * Everything expands to plain `SvgAnimation`s, so `svgFrame`, `SvgPlayer`
 * and `svgAnimatedMarkup` play the result with no new runtime.
 *
 * @packageDocumentation
 */

export {
  BACK_EASE,
  ENTRANCE_EASE,
  EXIT_EASE,
  getPrimitive,
  listPrimitives,
  MOVE_EASE,
  PRIMITIVES,
} from "./library.js";
export { applyPrimitive, primitiveTags, removePrimitive } from "./apply.js";
export {
  PRIMITIVE_KINDS,
  type PrimitiveDescriptor,
  type PrimitiveKind,
  type PrimitiveParam,
  type PrimitiveParamType,
  type PrimitiveParamValue,
  type PrimitiveResult,
  type PrimitiveUse,
} from "./types.js";
