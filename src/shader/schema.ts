/**
 * JSON Schemas (draft 2020-12) for control values, so hosts, forms and agent
 * tool layers can check values with any validator before they reach a shader
 * or a vector effect. Every control has a default, so none is required; a
 * name that is not a control is refused (`additionalProperties: false`).
 */

import { componentCount, rgbToHex, type ControlDef, type ControlValue } from "./controls.js";

/** The JSON Schema keywords these schemas use (a plain object, ready for `JSON.stringify`). */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  title?: string;
  description?: string;
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null" | readonly ("object" | "array" | "string" | "number" | "integer" | "boolean" | "null")[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  prefixItems?: readonly JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minLength?: number;
  pattern?: string;
  enum?: readonly unknown[];
  const?: unknown;
  anyOf?: readonly JsonSchema[];
  oneOf?: readonly JsonSchema[];
  default?: unknown;
  examples?: readonly unknown[];
}

export const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

/** Units a label may end with, in brackets: "Size (px)", "Angle (°)", "Delay (s)". */
const LABEL_UNITS: Record<string, string> = {
  px: "pixels",
  "°": "degrees",
  deg: "degrees",
  s: "seconds",
  ms: "milliseconds",
  "%": "percent",
  hz: "hertz",
  x: "times",
};

/**
 * The unit a control's number is in, when it says: from `unit=` in its
 * `@control` comment, else from its label ("Size (px)" is in pixels).
 * Undefined for amounts with no unit (a strength, an opacity, a speed
 * multiplier) and for controls that are not numbers.
 */
export function controlUnit(control: ControlDef): string | undefined {
  if (control.unit) return control.unit;
  if (control.color || control.type === "bool" || control.type === "sampler2D" || control.type === "text") return undefined;
  const bracket = /\(([^)]+)\)\s*$/.exec(control.label)?.[1]?.trim().toLowerCase();
  return bracket ? LABEL_UNITS[bracket] : undefined;
}

/** The label without its bracketed unit: "Size (px)" → "Size". */
function bareLabel(control: ControlDef): string {
  return controlUnit(control) && !control.unit ? control.label.replace(/\s*\([^)]+\)\s*$/, "") : control.label;
}

/** A default URL short enough for a description: a data URL is cut after its type. */
const shortUrl = (url: string) => (url.startsWith("data:") ? `a ${url.slice(5, url.search(/[;,]/))} data URL` : url.length > 80 ? `${url.slice(0, 79)}…` : url);

const round = (n: number) => Math.round(n * 1000) / 1000;
const show = (value: ControlValue) => JSON.stringify(Array.isArray(value) ? value.map(round) : typeof value === "number" ? round(value) : value);

/** A regex for `word` in any case, for patterns, which take no flags: "data" → "[Dd][Aa][Tt][Aa]". */
function anyCase(word: string): string {
  return [...word].map((c) => `[${c.toUpperCase()}${c}]`).join("");
}

/**
 * A URL an image control loads (as `isImageUrl` checks): `https:`, `http:`,
 * `blob:`, `data:image/…` or a relative path, or "" for no image.
 */
export const IMAGE_URL_PATTERN = `^(?:|\\s*(?:${anyCase("http")}[Ss]?:|${anyCase("blob")}:|${anyCase("data")}:${anyCase("image")}/).*|(?!\\s*[A-Za-z][A-Za-z0-9+.-]*:)\\s*\\S.*)$`;

/** A CSS colour a colour control takes as a string: hex, `rgb()`/`rgba()` or `hsl()`/`hsla()` (see `parseColor`). */
export const CSS_COLOR_PATTERN = "^\\s*(?:#?(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})|(?:rgba?|hsla?|RGBA?|HSLA?)\\([^)]*\\))\\s*$";

export interface SchemaOptions {
  /** Colours also take `"currentColor"`, as vector effects' do (following the text around them). */
  currentColor?: boolean;
}

/**
 * The JSON Schema of one control's value, with its label as the title and a
 * description that gives its unit, range and default:
 *
 * - `float` → number, `int` → integer, both between `min` and `max`.
 * - `bool` → boolean. `text` → string.
 * - `vec2`/`vec3`/`vec4` → an array of that many numbers, each in range.
 * - A colour (`vec3`/`vec4` marked `color`) → sRGB channels 0–1 as an
 *   array, or a CSS colour string (hex, `rgb()`, `hsl()`).
 * - `sampler2D` → an image URL, or "" for none.
 */
export function controlSchema(control: ControlDef, options: SchemaOptions = {}): JsonSchema {
  const title = bareLabel(control);
  const unit = controlUnit(control);
  const n = componentCount(control.type);
  const def = control.default;
  const range = `${round(control.min)} to ${round(control.max)}`;
  const inUnit = unit ? ` in ${unit}` : "";
  switch (control.type) {
    case "bool":
      return { type: "boolean", title, description: `${title}: on or off (default ${def}).`, default: def };
    case "text":
      return { type: "string", title, description: `${title}: text (default ${show(def)}).`, default: def };
    case "sampler2D":
      return {
        type: "string",
        title,
        description: `${title}: an image URL (https:, http:, blob:, data:image/… or a relative path), or "" for none (default ${def ? shortUrl(String(def)) : "none"}).`,
        pattern: IMAGE_URL_PATTERN,
        default: def,
      };
    case "float":
    case "int":
      return {
        type: control.type === "int" ? "integer" : "number",
        title,
        description: `${title}${inUnit}: ${control.type === "int" ? "a whole number " : ""}from ${range} (default ${show(def)}).`,
        minimum: control.min,
        maximum: control.max,
        default: def,
      };
  }
  if (control.color) {
    const channels = n === 4 ? "red, green, blue and alpha" : "red, green and blue";
    const hex = Array.isArray(def) ? rgbToHex(def) : String(def);
    const current = options.currentColor ? ', or "currentColor" to follow the surrounding text' : "";
    return {
      title,
      description: `${title}: a colour, as ${n} sRGB channels (${channels}) from 0 to 1, or a CSS colour string such as "${hex}"${current} (default ${hex}).`,
      anyOf: [
        { type: "array", items: { type: "number", minimum: 0, maximum: 1 }, minItems: n, maxItems: n },
        { type: "string", pattern: CSS_COLOR_PATTERN },
        ...(options.currentColor ? [{ const: "currentColor" }] : []),
      ],
      default: def,
      examples: [hex],
    };
  }
  const axes = ["x", "y", "z", "w"].slice(0, n).join(", ");
  return {
    type: "array",
    title,
    description: `${title}${inUnit}: ${n} numbers (${axes}), each from ${range} (default ${show(def)}).`,
    items: { type: "number", minimum: control.min, maximum: control.max },
    minItems: n,
    maxItems: n,
    default: def,
  };
}

/**
 * The JSON Schema of a set of control values, `{ [control name]: value }`:
 * an object that takes each control (see {@link controlSchema}) and nothing
 * else. None is required, as every control has a default.
 */
export function controlsSchema(
  controls: readonly ControlDef[],
  meta: SchemaOptions & { title?: string; description?: string; $id?: string } = {},
): JsonSchema {
  return {
    $schema: JSON_SCHEMA_DIALECT,
    ...(meta.$id && { $id: meta.$id }),
    ...(meta.title && { title: meta.title }),
    ...(meta.description && { description: meta.description }),
    type: "object",
    properties: Object.fromEntries(controls.map((c) => [c.name, controlSchema(c, meta)])),
    additionalProperties: false,
  };
}
