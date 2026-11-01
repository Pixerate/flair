/**
 * Text masks: shader image controls that draw words from a text image (their
 * default is a `textImage(...)`, like `uText` in the meme banners). Agents set
 * them with words, `{ text, font?, weight? }`, which become a text image in the
 * default's font unless they name another; an image URL still works. Bare
 * words are refused, since an image control would take them for a path.
 */

import { textImage } from "../catalog/images.js";
import { isTextImage } from "../catalog/inputs.js";
import { checkControlValue, type ControlCheck, type ControlDef } from "../shader/controls.js";
import { controlSchema, type JsonSchema } from "../shader/schema.js";

/** Words for a text mask, as an agent passes them. */
export interface TextMaskWords {
  text: string;
  /** A CSS font family; default the control's default font. */
  font?: string;
  /** A font weight; default the control's default weight. */
  weight?: number | string;
}

/** Whether `control` is an image control that draws words from a text image. */
export function isTextMask(control: ControlDef): boolean {
  return control.type === "sampler2D" && typeof control.default === "string" && isTextImage(control.default);
}

const unescapeXml = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The font family and weight of a text image, as `textImage` wrote them. */
function textImageFont(url: string): { font?: string; weight?: string } {
  let svg: string;
  try {
    svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
  } catch {
    return {};
  }
  const font = /font-family="([^"]*)"/.exec(svg)?.[1];
  const weight = /font-weight="([^"]*)"/.exec(svg)?.[1];
  return { ...(font !== undefined && { font: unescapeXml(font) }), ...(weight !== undefined && { weight: unescapeXml(weight) }) };
}

/** A relative path an image control could load: it names a file or a folder, not just words. */
const PATH_LIKE = /^\s*(?:\.{0,2}\/|[^\s]*\/)|\.(?:png|jpe?g|gif|webp|avif|svg|bmp)(?:[?#].*)?\s*$/i;

/**
 * Checks a value for a control as the editor stores it (see `checkControlValue`),
 * with words for text masks: `{ text, font?, weight? }` becomes a text image,
 * and bare words are refused with what to pass instead. Pass `words: false`
 * where only stored values belong (a document's), so `{ text }` is refused there too.
 */
export function checkEditorValue(control: ControlDef, raw: unknown, options: { words?: boolean } = {}): ControlCheck {
  if (!isTextMask(control)) return checkControlValue(control, raw);
  const how = `pass its words as {"text": "…"} (with "font" and "weight" if you like), or a text image's URL`;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    if (options.words === false) return { ok: false, message: `${control.name} stores a text image's URL; words as {"text": …} are only taken by values.set and keyframe.set.` };
    const { text, font, weight, ...rest } = raw as Record<string, unknown>;
    const extra = Object.keys(rest);
    if (extra.length) return { ok: false, message: `${control.name} takes {"text", "font", "weight"}, not ${extra.map((k) => JSON.stringify(k)).join(", ")}.` };
    if (typeof text !== "string" || text.trim() === "") return { ok: false, message: `${control.name} needs some words: ${how}.` };
    if (font !== undefined && (typeof font !== "string" || font.trim() === "")) return { ok: false, message: `${control.name}'s "font" is a CSS font family, like "Georgia, serif".` };
    if (weight !== undefined && !((typeof weight === "number" && weight >= 1 && weight <= 1000) || (typeof weight === "string" && /^(?:normal|bold|bolder|lighter|\d{1,4})$/.test(weight)))) {
      return { ok: false, message: `${control.name}'s "weight" is a font weight: 1 to 1000, "normal" or "bold".` };
    }
    const base = textImageFont(String(control.default));
    return { ok: true, value: textImage(text, { font: font ?? base.font, weight: weight ?? base.weight }) };
  }
  if (typeof raw === "string" && raw.trim() !== "" && !/^\s*[a-z][a-z0-9+.-]*:/i.test(raw) && !PATH_LIKE.test(raw)) {
    return { ok: false, message: `${control.name} draws words from a text image, so ${JSON.stringify(raw)} would be read as a file path: ${how}.` };
  }
  return checkControlValue(control, raw);
}

/**
 * A control's JSON Schema for the editor: as `controlSchema` gives it, and for a
 * text mask either its words, `{ text, font?, weight? }`, or an image URL.
 */
export function editorControlSchema(control: ControlDef): JsonSchema {
  const schema = controlSchema(control);
  if (!isTextMask(control)) return schema;
  const { font, weight } = textImageFont(String(control.default));
  const title = schema.title as string;
  return {
    title,
    description: `${title}: words drawn as a text mask, as {"text": "…"} (in ${font ?? "the default font"}${weight ? `, weight ${weight}` : ""} unless you give "font" and "weight"), or a text image's URL.`,
    anyOf: [
      {
        type: "object",
        properties: {
          text: { type: "string", minLength: 1, description: "The words." },
          font: { type: "string", description: "A CSS font family, like \"Georgia, serif\"." },
          weight: { type: ["number", "string"], description: 'A font weight: 1 to 1000, "normal" or "bold".' },
        },
        required: ["text"],
        additionalProperties: false,
      },
      { type: "string", pattern: schema.pattern as string },
    ],
    default: schema.default,
  };
}
