/**
 * The JSON Schema (draft 2020-12) of an {@link EffectDocument}, so tools
 * outside JavaScript, forms and agent tool layers can check a document's
 * shape before `parseEffectDocument` reads it. It checks shape only: which
 * controls exist, and the values each takes, depend on the effect's source
 * (see `effectControlSchema` and `documentIssues`).
 */

import { JSON_SCHEMA_DIALECT, type JsonSchema } from "../shader/schema.js";

const number = (description: string, extra: JsonSchema = {}): JsonSchema => ({ type: "number", description, ...extra });

/** A control value: a number, a boolean, a vector, an image URL, a CSS colour or text. */
const controlValue: JsonSchema = {
  description: "A control's value: a number (float, int), true or false (bool), a list of 2 to 4 numbers (a vector, or a colour's sRGB channels 0–1), or a string (an image URL, a CSS colour, or text).",
  anyOf: [
    { type: "number" },
    { type: "boolean" },
    { type: "array", items: { type: "number" }, minItems: 2, maxItems: 4 },
    { type: "string" },
  ],
};

const values: JsonSchema = {
  type: "object",
  description: "Control values by control name.",
  additionalProperties: { $ref: "#/$defs/controlValue" },
};

const easing: JsonSchema = {
  description: "How a segment eases: a preset name, a CSS cubic bezier, a spring or an elastic curve.",
  anyOf: [
    {
      enum: ["linear", "hold", "ease", "ease-in", "ease-out", "ease-in-out", "ease-in-back", "ease-out-back", "ease-out-elastic", "ease-in-elastic", "ease-in-out-elastic", "elastic", "spring"],
    },
    {
      type: "object",
      properties: { type: { const: "cubic-bezier" }, x1: { type: "number" }, y1: { type: "number" }, x2: { type: "number" }, y2: { type: "number" } },
      required: ["type", "x1", "y1", "x2", "y2"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "spring" },
        stiffness: number("Stiffness (default 170).", { exclusiveMinimum: 0 }),
        damping: number("Damping (default 26).", { exclusiveMinimum: 0 }),
        mass: number("Mass (default 1).", { exclusiveMinimum: 0 }),
        velocity: number("Starting velocity, in the segment's change per second (default 0)."),
      },
      required: ["type"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: { type: { const: "elastic" }, amplitude: number("Overshoot (default 1)."), period: number("Period, as a fraction of the segment (default 0.3)."), mode: { enum: ["out", "in", "in-out"] } },
      required: ["type"],
      additionalProperties: false,
    },
  ],
};

const keyframe: JsonSchema = {
  type: "object",
  properties: {
    time: number("Ms from the start of the timeline.", { minimum: 0 }),
    value: { $ref: "#/$defs/controlValue" },
    easing: { $ref: "#/$defs/easing" },
  },
  required: ["time", "value"],
  additionalProperties: false,
};

const track: JsonSchema = {
  type: "object",
  description: "A control's keyframes. It overrides the control's value.",
  properties: {
    keyframes: { type: "array", items: { $ref: "#/$defs/keyframe" }, description: "Keyframes; sorted by time when read, one per time." },
    enabled: { type: "boolean", description: "Whether it animates (default true)." },
  },
  required: ["keyframes"],
  additionalProperties: false,
};

const preset: JsonSchema = {
  type: "object",
  properties: { name: { type: "string" }, values: { $ref: "#/$defs/values" } },
  required: ["name", "values"],
  additionalProperties: false,
};

/**
 * A vector picture's numbers and words may be `{{control}}` placeholders,
 * filled with control values when it is drawn, so each value in a change
 * takes one too.
 */
const PLACEHOLDER: JsonSchema = { type: "string", pattern: "^\\s*\\{\\{[^}]+\\}\\}\\s*$", description: "A {{control}} placeholder." };
const slot = (schema: JsonSchema): JsonSchema => {
  const { description, ...rest } = schema;
  return { ...(description && { description }), anyOf: [rest, PLACEHOLDER] };
};
const pair = (items: JsonSchema): JsonSchema => ({ type: "array", items: slot(items), minItems: 2, maxItems: 2 });
const stringOrNumber: JsonSchema = { anyOf: [{ type: "string" }, { type: "number" }] };

/** One change in a vector effect's picture (`SvgAnimation`). */
const animation: JsonSchema = {
  type: "object",
  description: "A change to an element of the picture, on a step (see SvgAnimation).",
  properties: {
    id: { type: "string", description: "The element's id in the SVG (not needed for view)." },
    step: { type: "integer", minimum: 0, description: "The step it plays on (default 0)." },
    delay: number("Ms after the step starts.", { minimum: 0 }),
    ms: number("How long it takes, in ms (each cycle's length with repeat).", { minimum: 0 }),
    ease: {
      description: 'A name ("linear", "in-out", "out"), a [x1, y1, x2, y2] cubic bezier, or { spring: { mass, stiffness, damping, velocity } }.',
      anyOf: [
        { enum: ["linear", "in-out", "out"] },
        { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
        {
          type: "object",
          properties: {
            spring: {
              type: "object",
              properties: { mass: { type: "number" }, stiffness: { type: "number" }, damping: { type: "number" }, velocity: { type: "number" } },
              additionalProperties: false,
            },
          },
          required: ["spring"],
          additionalProperties: false,
        },
      ],
    },
    repeat: { type: "integer", minimum: 1, description: "Whole times it plays (default 1)." },
    alternate: { type: "boolean", description: "With repeat: odd cycles run backwards." },
    strobe: number("Frames a second its time is held to (12 for animation on twos).", { exclusiveMinimum: 0 }),
    behavior: {
      type: "object",
      description: "pulse, oscillate, wriggle or overshoot (see SvgBehavior).",
      properties: {
        type: { enum: ["pulse", "oscillate", "wriggle", "overshoot"] },
        count: { type: "number" },
        decay: { type: "number" },
        wave: { enum: ["sine", "triangle", "square", "sawtooth"] },
        frequency: { type: "number" },
        octaves: { type: "number" },
        seed: { type: "number" },
        cycles: { type: "number" },
        damping: { type: "number" },
      },
      required: ["type"],
      additionalProperties: false,
    },
    tag: { type: "string", description: "Who added it (a motion primitive's use), so changes added together can be removed together." },
    attrs: { type: "object", description: "Attributes, each from one value to another.", additionalProperties: pair(stringOrNumber) },
    draw: { description: "Draws a line on along its length, from 0 to 1 or between two fractions.", anyOf: [{ type: "boolean" }, pair({ type: "number" })] },
    view: {
      description: "Zooms and pans to a box [x, y, width, height] in viewBox units, or to an element by id.",
      anyOf: [{ type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 }, { type: "string" }],
    },
    along: { type: "string", description: "The id of a path to move along." },
    at: { ...pair({ type: "number" }), description: "How far along the path, from and to (default [0, 1])." },
    orient: { type: "boolean", description: "With along: turns with the path's direction." },
    solo: { type: "integer", minimum: 0, description: "The child shown in a solo group." },
    count: { ...pair({ type: "number" }), description: "Counts the element's text from one number to the other." },
    format: { type: "string", description: "How a count is written: {n} is the number." },
    decimals: { type: "integer", minimum: 0, description: "Decimals in a count (default 0)." },
    write: { type: "string", description: "Text written in letter by letter." },
    scramble: { type: "string", description: "With write: characters unwritten letters cycle through." },
    caret: { type: "string", description: "With write: shown after the written letters." },
  },
  additionalProperties: false,
};
animation.properties = Object.fromEntries(Object.entries(animation.properties!).map(([k, v]) => [k, k === "id" || k === "tag" ? v : slot(v)]));

const vectorControl: JsonSchema = {
  type: "object",
  description: "A control declared outside the picture, for pictures written before controls were declared inline.",
  properties: {
    name: { type: "string" },
    type: { enum: ["float", "int", "bool", "vec2", "vec3", "vec4", "sampler2D", "text"] },
    default: { $ref: "#/$defs/controlValue" },
    label: { type: "string" },
    color: { type: "boolean" },
    min: { type: "number" },
    max: { type: "number" },
    step: { type: "number" },
  },
  required: ["name", "type", "default"],
  additionalProperties: false,
};

/**
 * The JSON Schema of an `EffectDocument`, version 1. Published with the
 * package as `@pixerate/flair/schemas/effect-document.json`.
 */
export const EFFECT_DOCUMENT_SCHEMA: JsonSchema = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: "https://pixerate.github.io/flair/schemas/effect-document.json",
  title: "Flair effect document",
  description:
    "An effect (a fragment shader, or an animated SVG with controls), the values picked for its controls, keyframed tracks, presets and a timeline. Which controls exist, and the values each takes, come from the effect itself: check them with effectControlSchema or documentIssues.",
  type: "object",
  properties: {
    version: { const: 1, description: "Format version." },
    name: { type: "string" },
    basedOn: { type: "string", description: "The catalog effect it started from, by id." },
    effect: {
      description: "What is edited: a shader's source, or a vector picture.",
      oneOf: [
        {
          type: "object",
          properties: {
            kind: { const: "shader" },
            source: { type: "string", description: "A Shadertoy-style fragment shader with a mainImage function; its controls are uniforms annotated // @control." },
          },
          required: ["kind", "source"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            kind: { const: "vector" },
            motion: {
              type: "object",
              properties: {
                svg: { type: "string", description: "One self-contained <svg> with a viewBox; controls are declared in it as {{name: type …}}." },
                animate: { type: "array", items: { $ref: "#/$defs/animation" } },
              },
              required: ["svg"],
              additionalProperties: false,
            },
            controls: { type: "array", items: { $ref: "#/$defs/vectorControl" } },
            hold: number("Ms the finished picture holds before it loops.", { minimum: 0 }),
          },
          required: ["kind", "motion"],
          additionalProperties: false,
        },
      ],
    },
    values: { $ref: "#/$defs/values", description: "Picked control values; controls without one use their default." },
    tracks: { type: "object", description: "Keyframed controls, by control name.", additionalProperties: { $ref: "#/$defs/track" } },
    duration: number("Timeline length in ms.", { exclusiveMinimum: 0 }),
    loop: { type: "boolean" },
    presets: { type: "array", items: { $ref: "#/$defs/preset" } },
  },
  required: ["version", "name", "effect", "values", "tracks", "duration", "loop", "presets"],
  additionalProperties: false,
  $defs: { controlValue, values, easing, keyframe, track, preset, animation, vectorControl },
};
