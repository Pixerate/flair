/**
 * Sample pictures for the catalog's image effects: small SVGs as `data:` URLs,
 * so image controls have something to show with nothing to download.
 */

/** An ASCII SVG as a base64 `data:image/svg+xml` URL. */
export function svgDataUrl(svg: string): string {
  const base64 =
    typeof btoa === "function" ? btoa(svg) : (globalThis as { Buffer?: { from(s: string): { toString(e: string): string } } }).Buffer!.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

const LANDSCAPE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4cb8"/><stop offset="1" stop-color="#ffa36b"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#s)"/>
<circle cx="420" cy="170" r="62" fill="#ffe9b0"/>
<path d="M0 250 Q120 190 240 240 T480 230 T640 220 V360 H0Z" fill="#2c4a52"/>
<path d="M0 290 Q160 240 320 290 T640 280 V360 H0Z" fill="#1b2f33"/>
<path d="M0 330 Q200 300 400 330 T640 325 V360 H0Z" fill="#0f1c1f"/>
</svg>`;

const CITY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<rect width="640" height="360" fill="#0d1028"/>
<circle cx="520" cy="80" r="34" fill="#f5f3d7"/>
<g fill="#252a52"><rect x="20" y="170" width="70" height="190"/><rect x="110" y="120" width="60" height="240"/><rect x="190" y="200" width="80" height="160"/><rect x="290" y="90" width="55" height="270"/><rect x="365" y="160" width="90" height="200"/><rect x="475" y="130" width="60" height="230"/><rect x="555" y="190" width="70" height="170"/></g>
<g fill="#ffcf5a"><rect x="125" y="140" width="8" height="8"/><rect x="150" y="170" width="8" height="8"/><rect x="305" y="110" width="8" height="8"/><rect x="320" y="150" width="8" height="8"/><rect x="380" y="180" width="8" height="8"/><rect x="420" y="220" width="8" height="8"/><rect x="490" y="150" width="8" height="8"/><rect x="40" y="200" width="8" height="8"/><rect x="215" y="230" width="8" height="8"/><rect x="575" y="215" width="8" height="8"/></g>
</svg>`;

const PORTRAIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<rect width="640" height="360" fill="#f2e6d8"/>
<circle cx="320" cy="150" r="70" fill="#c98b6b"/>
<path d="M190 360 Q200 240 320 240 Q440 240 450 360Z" fill="#33415c"/>
<path d="M250 130 Q260 60 320 62 Q385 60 392 135 Q370 100 320 100 Q275 100 250 130Z" fill="#2b1d16"/>
<circle cx="295" cy="150" r="6" fill="#2b1d16"/><circle cx="345" cy="150" r="6" fill="#2b1d16"/>
<path d="M300 185 Q320 198 340 185" stroke="#7a3e2c" stroke-width="5" fill="none"/>
</svg>`;

// The portrait with its background taken away: the same figure, on transparent, for cut-outs and
// background removal, lined up with PORTRAIT so the two can be wiped or compared.
const CUTOUT = PORTRAIT.replace(/<rect [^>]*\/>\n/, "");

// A second portrait, the face larger and right of centre, for morphing with PORTRAIT.
// Features (viewBox units): eyes (396, 175) and (464, 175), mouth (430, 229), chin (430, 270), hairline (430, 80).
const PORTRAIT_2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
<rect width="640" height="360" fill="#d3e4e6"/>
<path d="M255 360 Q268 300 430 297 Q592 300 605 360Z" fill="#a4372f"/>
<rect x="408" y="250" width="44" height="52" fill="#d9a07c"/>
<circle cx="430" cy="175" r="95" fill="#e8b48f"/>
<path d="M332 172 Q330 66 430 64 Q530 66 528 172 Q520 112 470 100 Q420 128 352 116 Q336 140 332 172Z" fill="#8a3b1e"/>
<circle cx="396" cy="175" r="8" fill="#3a2418"/><circle cx="464" cy="175" r="8" fill="#3a2418"/>
<path d="M424 186 Q430 206 436 186" stroke="#c48262" stroke-width="5" fill="none"/>
<path d="M403 225 Q430 244 457 225" stroke="#9c4a35" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;

// Flat shapes on transparent, for silhouette morphs and masks.
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<path fill="#6366f1" fill-rule="evenodd" d="M256 56a200 200 0 1 1 0 400a200 200 0 1 1 0-400zm0 92a108 108 0 1 0 0 216a108 108 0 1 0 0-216z"/>
<circle cx="256" cy="256" r="52" fill="#6366f1"/>
</svg>`;

const HEART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<path fill="#f43f5e" d="M256 452C120 352 40 272 40 172C40 102 95 58 160 58C205 58 238 84 256 118C274 84 307 58 352 58C417 58 472 102 472 172C472 272 392 352 256 452Z"/>
</svg>`;

/**
 * An icon drawn the way Lucide and similar sets draw them: 24 × 24, stroked
 * in `currentColor` (black in an image) on a transparent background.
 */
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20C5 15.5 3 12 3 8.5a4.5 4.5 0 0 1 9 0a4.5 4.5 0 0 1 9 0c0 3.5-2 7-9 11.5Z"/></svg>`;

// The portrait shot on a green screen: a floor shadow and a green rim of spill on the shoulders and hair, for keying.
const GREEN_SCREEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#2fd35a"/><stop offset="1" stop-color="#16a03f"/></radialGradient>
<radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<ellipse cx="350" cy="352" rx="190" ry="22" fill="url(#sh)"/>
<path d="M186 360 Q196 236 320 236 Q444 236 454 360Z" fill="#5f9b4a"/>
<path d="M190 360 Q200 240 320 240 Q440 240 450 360Z" fill="#33415c"/>
<circle cx="320" cy="150" r="73" fill="#8fbf62"/>
<circle cx="320" cy="150" r="70" fill="#c98b6b"/>
<path d="M247 132 Q257 56 320 58 Q388 56 395 137 Q370 100 320 100 Q275 100 247 132Z" fill="#4f7a30"/>
<path d="M250 130 Q260 60 320 62 Q385 60 392 135 Q370 100 320 100 Q275 100 250 130Z" fill="#2b1d16"/>
<circle cx="295" cy="150" r="6" fill="#2b1d16"/><circle cx="345" cy="150" r="6" fill="#2b1d16"/>
<path d="M300 185 Q320 198 340 185" stroke="#7a3e2c" stroke-width="5" fill="none"/>
</svg>`;

/** Built-in sample pictures, as image control values. */
export const SAMPLE_IMAGES = {
  landscape: svgDataUrl(LANDSCAPE),
  city: svgDataUrl(CITY),
  portrait: svgDataUrl(PORTRAIT),
  /** Another face, larger and to the right: morph it with `portrait`. */
  portrait2: svgDataUrl(PORTRAIT_2),
  /** The portrait with its background removed (transparent), lined up with `portrait`. */
  cutout: svgDataUrl(CUTOUT),
  /** The portrait on a green screen, with a floor shadow and green spill, for keying. */
  greenScreen: svgDataUrl(GREEN_SCREEN),
  /** A ring-and-dot mark, indigo on transparent. */
  logo: svgDataUrl(LOGO),
  /** A heart, rose on transparent. */
  heart: svgDataUrl(HEART),
  icon: svgDataUrl(ICON),
} as const;

/** Roughly how wide a character is in a bold sans-serif, in ems, for fitting text without measuring it. */
function charWidth(c: string): number {
  if (/[iIjl.,:;'!|`]/.test(c)) return 0.3;
  if (/[\sfrt()[\]\-]/.test(c)) return 0.4;
  if (/[MW@%]/.test(c)) return 0.94;
  if (/[mw]/.test(c)) return 0.88;
  if (/[A-Z&#]/.test(c)) return 0.74;
  if (/[0-9]/.test(c)) return 0.58;
  if (/[a-z]/.test(c)) return 0.6;
  // Wide scripts (CJK, kana, hangul) and emoji take about a full em.
  return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠]|\p{Extended_Pictographic}/u.test(c) ? 1 : 0.64;
}

/** About how wide `text` is in ems in a bold sans-serif (letters are code points). */
export function textWidthEm(text: string): number {
  return Array.from(text).reduce((sum, c) => sum + charWidth(c), 0);
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface TextImageOptions {
  /** CSS font family (default a heavy system sans-serif). */
  font?: string;
  /** Font weight (default 900). */
  weight?: number | string;
  /** Font size in the picture's units; by default as large as fits. */
  size?: number;
  /** The picture's size (default 1024 × 256). */
  width?: number;
  height?: number;
}

/**
 * A line of text, white on transparent, as an SVG `data:` URL for an image
 * control (the shader text effects use its alpha as a letter mask). The text
 * is centred and fitted to the picture (1024 × 256 by default): the font
 * size comes from its length, and `textLength` stretches it to the width
 * that size predicts, so any text fills about the same box in any font.
 * Takes any Unicode text.
 */
export function textImage(text: string, options: TextImageOptions = {}): string {
  const width = options.width ?? 1024;
  const height = options.height ?? 256;
  const ems = Math.max(0.5, textWidthEm(text));
  const size = options.size ?? Math.min(height * 0.78, (width * 0.9) / ems);
  const length = Math.min(width * 0.96, ems * size);
  const font = options.font ?? "'Arial Black', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><text x="${width / 2}" y="${height / 2}" dy="0.35em" text-anchor="middle" textLength="${+length.toFixed(1)}" lengthAdjust="spacingAndGlyphs" font-family="${escapeXml(font)}" font-weight="${escapeXml(String(options.weight ?? 900))}" font-size="${+size.toFixed(1)}" fill="#fff">${escapeXml(text)}</text></svg>`;
  // UTF-8 percent-encoded rather than base64 (btoa only takes Latin-1); quotes and brackets are encoded too, so it is safe unquoted.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
