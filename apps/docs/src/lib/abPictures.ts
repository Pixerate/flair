import { svgDataUrl } from "@pixerate/flair/catalog";

const BASE64_SVG = "data:image/svg+xml;base64,";

/** An SVG `data:` picture with a big letter stamped in its middle, so a preview shows which picture is which. */
function lettered(picture: string, letter: string): string {
  if (!picture.startsWith(BASE64_SVG)) return picture;
  // The picture nested as is (not as an <image>), so nothing has to load inside the SVG.
  const inner = atob(picture.slice(BASE64_SVG.length)).replace(
    /^<svg\b[^>]*/,
    (tag) => `${tag.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, "")} width="640" height="360" preserveAspectRatio="xMidYMid slice"`,
  );
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
${inner}
<circle cx="320" cy="180" r="74" fill="#0c0c14" fill-opacity="0.55" stroke="#fff" stroke-opacity="0.9" stroke-width="5"/>
<text x="320" y="180" dy="0.35em" text-anchor="middle" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="700" font-size="96" fill="#fff">${letter}</text>
</svg>`);
}

const cache = new Map<string, string>();

/**
 * For a transition's preview: its two pictures, each with an "A" or a "B" on
 * it, so the cut reads as from A to B. Other effects get nothing to change.
 */
export function abPictures(effect: { kind: string; video?: string }, values: Record<string, unknown>): Record<string, string> {
  if (effect.kind !== "shader" || effect.video !== "transition") return {};
  const out: Record<string, string> = {};
  for (const [name, letter] of [["uFrom", "A"], ["uTo", "B"]] as const) {
    const picture = values[name];
    if (typeof picture !== "string") continue;
    const key = `${letter}${picture}`;
    if (!cache.has(key)) cache.set(key, lettered(picture, letter));
    out[name] = cache.get(key)!;
  }
  return out;
}
