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
