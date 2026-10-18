/**
 * Motion primitives as data: what each one is called, does and takes, so
 * people and agents can list and describe them without running anything.
 * The expansion behind each is a pure function in code (see `library.ts`).
 */

import type { SvgAnimation, SvgBox, SvgEase, SvgMotion } from "../vector/motion.js";

/** When a primitive plays in an element's life. */
export type PrimitiveKind = "entrance" | "exit" | "emphasis" | "path";

/** Every {@link PrimitiveKind}, in the order an element lives them. */
export const PRIMITIVE_KINDS: readonly PrimitiveKind[] = ["entrance", "emphasis", "path", "exit"];

/** The types a primitive's parameter can be: a vector control's, plus `enum` for a choice of words. */
export type PrimitiveParamType = "float" | "int" | "bool" | "color" | "text" | "enum";

/** A primitive parameter's value: a number (float, int), true/false (bool), or a string (color as `#rrggbb`, text, enum). */
export type PrimitiveParamValue = number | boolean | string;

/** One parameter of a primitive, declared like a vector effect's control. */
export interface PrimitiveParam {
  name: string;
  type: PrimitiveParamType;
  label: string;
  default: PrimitiveParamValue;
  /** What it does, in a sentence, when the label alone does not say. */
  description?: string;
  /** Unit of a number: `"viewBox units"`, `"degrees"`, `"Hz"`, `"×"` (a scale), `"fraction"` (0–1). */
  unit?: string;
  /** Lowest and highest number it takes (floats and ints). */
  min?: number;
  max?: number;
  /** A sensible slider step (floats and ints). */
  step?: number;
  /** The words an `enum` takes. */
  options?: readonly string[];
}

/**
 * A motion primitive: an entrance, exit, emphasis or path motion that works
 * on any element of an `SvgMotion` (not one finished picture). Plain JSON.
 */
export interface PrimitiveDescriptor {
  /** Stable id, `kind.name`: `entrance.pop`, `exit.fade`, `emphasis.wiggle`, `path.follow`. */
  id: string;
  name: string;
  /** One or two sentences: what it does to the element. */
  description: string;
  kind: PrimitiveKind;
  /** What it can be applied to, when not any drawn element. */
  appliesTo: string;
  params: readonly PrimitiveParam[];
  /** How long it takes by default, in ms. */
  ms: number;
  /** Its main ease by default (some parts keep eases of their own, said in `description`). */
  ease: SvgEase;
  /** Whether it needs the element's box (to scale or turn round its centre): give `box` when Flair cannot measure it (text, placeholders). */
  needsBox: boolean;
}

/** One use of a primitive on an element (see `applyPrimitive`). */
export interface PrimitiveUse {
  /** The primitive's id (see `PRIMITIVES`). */
  primitive: string;
  /** The `id` of the element in the picture it moves. */
  target: string;
  /** Parameter values by name; any left out take their defaults. */
  params?: Record<string, unknown>;
  /** The step it plays on: 0 (default) when the picture starts, 1 with the next shot, and so on. */
  step?: number;
  /** Ms after the step starts (default 0). */
  delay?: number;
  /** How long it takes, in ms (default: the primitive's). */
  ms?: number;
  /** Its main ease (default: the primitive's). */
  ease?: SvgEase;
  /**
   * Emphasis only: plays it this many whole times (default 1), so it takes
   * `ms × repeat` in all (see `SvgAnimation.repeat`).
   */
  repeat?: number;
  /** Emphasis only, with `repeat`: every other cycle runs backwards (see `SvgAnimation.alternate`). */
  alternate?: boolean;
  /**
   * The element's box in the `viewBox`'s units, `[x, y, width, height]`,
   * for primitives that need it (`needsBox`) when Flair cannot measure it
   * from the markup (text needs layout; placeholders have no numbers yet).
   */
  box?: SvgBox;
}

/** What `applyPrimitive` did: the new motion and what it added, or why nothing was changed. */
export type PrimitiveResult =
  | {
      ok: true;
      motion: SvgMotion;
      /** Marks everything this use added (`SvgAnimation.tag`, `data-flair-tag`); pass it to `removePrimitive`. */
      tag: string;
      /** The animations it added. */
      added: SvgAnimation[];
      /** Ids of the elements it added to the markup (wrapper groups, clip paths). */
      elements: string[];
    }
  | { ok: false; message: string };
