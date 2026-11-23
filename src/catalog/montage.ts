/**
 * A montage's item list as control values, from its `items` spec alone (as
 * `effectInputs` reports it), so scenes, the editor and agents fill a
 * montage the same way without a DOM or the full catalog.
 */

import { DEVICE_KINDS, deviceIndex } from "./devices.js";
import { svgMarkupUrl } from "./images.js";
import type { EffectInputs } from "./inputs.js";
import type { ControlValue } from "../shader/controls.js";

/** A montage item written as data: a picture (URL or `data:` URL) or SVG markup, with an optional device and label. */
export interface MontageItemData {
  image?: string;
  svg?: string;
  device?: string;
  label?: string;
}

/** The fields a {@link MontageItemData} takes. */
export const MONTAGE_ITEM_FIELDS = ["image", "svg", "device", "label"] as const;

/** What an effect's `items` spec says: its `EffectItems`, or `effectInputs(effect).items`. */
export interface MontageSpec {
  min: number;
  max: number;
  slots: readonly string[];
  cycle: NonNullable<EffectInputs["items"]>["cycle"];
  list?: string;
  count?: string;
  devices?: readonly string[];
  progress?: string;
}

/**
 * The control values a list of items sets on a montage: a shader's first
 * items in its slots, how many it shows and each one's device (a
 * carousel's shown and next item); a vector montage's whole list in its
 * list control. `shown` is how many show at once. Problems come back as
 * sentences, naming the item and saying what it takes, with no values.
 */
export function montageValues(
  id: string,
  spec: MontageSpec,
  items: unknown,
): { ok: true; values: Record<string, ControlValue>; shown: number } | { ok: false; issues: string[] } {
  if (!Array.isArray(items)) return { ok: false, issues: [`"${id}"'s items are a list of { "image": url } or { "svg": markup } items, each with an optional "device" and "label".`] };
  const issues: string[] = [];
  if (items.length < spec.min || items.length > spec.max) issues.push(`"${id}" takes ${spec.min} to ${spec.max} items; ${items.length} ${items.length === 1 ? "was" : "were"} given.`);
  const pictures: { href: string; device?: number; label?: string }[] = [];
  items.forEach((raw, i) => {
    const where = `Item ${i + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void issues.push(`${where} is an object: { "image": url } or { "svg": markup }, with an optional "device" and "label".`);
    const item = raw as Record<string, unknown>;
    const extra = Object.keys(item).filter((k) => !(MONTAGE_ITEM_FIELDS as readonly string[]).includes(k));
    if (extra.length) issues.push(`${where} has no field ${extra.map((k) => `"${k}"`).join(", ")}; items take ${MONTAGE_ITEM_FIELDS.map((k) => `"${k}"`).join(", ")}.`);
    const hasImage = typeof item.image === "string" && item.image.trim() !== "";
    const hasSvg = typeof item.svg === "string" && item.svg.trim() !== "";
    if (hasImage === hasSvg) return void issues.push(`${where} needs one picture: "image" (a URL or data: URL) or "svg" (markup), not ${hasImage ? "both" : "neither"}.`);
    const href = hasSvg ? svgMarkupUrl(item.svg as string) : (item.image as string).trim();
    if (spec.cycle === "repeat" && !/^data:image\//i.test(href))
      issues.push(`${where} is the picture ${JSON.stringify(href.slice(0, 80))}; "${id}" is a vector montage, drawn inside an SVG, which shows only SVG markup ("svg") or data:image/… URLs. Give it one of those, or use a shader montage for pictures by URL.`);
    if (item.device !== undefined && (typeof item.device !== "string" || deviceIndex(item.device) === undefined))
      issues.push(`${where} names the device ${JSON.stringify(item.device)}; devices are ${DEVICE_KINDS.join(", ")}.`);
    if (item.label !== undefined && typeof item.label !== "string") issues.push(`${where}'s "label" is words.`);
    pictures.push({ href, ...(typeof item.device === "string" && deviceIndex(item.device) !== undefined && { device: deviceIndex(item.device)! }), ...(typeof item.label === "string" && { label: item.label }) });
  });
  if (issues.length) return { ok: false, issues };

  const values: Record<string, ControlValue> = {};
  if (spec.cycle === "repeat") {
    values[spec.list!] = JSON.stringify(pictures.map((p) => ({ href: p.href, ...(p.label !== undefined && { label: p.label }) })));
    return { ok: true, values, shown: pictures.length };
  }
  const put = (slot: number, p: (typeof pictures)[number]) => {
    values[spec.slots[slot]!] = p.href;
    const control = spec.devices?.[slot];
    if (control && p.device !== undefined) values[control] = p.device;
  };
  if (spec.cycle === "carousel") {
    put(0, pictures[0]!);
    put(1, pictures[1 % pictures.length]!);
    if (spec.progress) values[spec.progress] = 0;
  } else pictures.slice(0, spec.slots.length).forEach((p, i) => put(i, p));
  if (spec.count) values[spec.count] = Math.min(pictures.length, spec.slots.length);
  return { ok: true, values, shown: Math.min(pictures.length, spec.cycle === "carousel" ? 1 : spec.slots.length) };
}
