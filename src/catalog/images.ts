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

/** Built-in sample pictures, as image control values. */
export const SAMPLE_IMAGES = {
  landscape: svgDataUrl(LANDSCAPE),
  city: svgDataUrl(CITY),
  portrait: svgDataUrl(PORTRAIT),
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
