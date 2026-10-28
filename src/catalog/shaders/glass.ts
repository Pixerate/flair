import { FBM, glsl, HASH, NOISE, ROTATE, SPECTRUM } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Glass: text and shapes made of glass, glass you look through (blocks,
 * cracked panes, a crystal ball, condensation), glass that splits light
 * (a prism, dichroic panels, a cut gem) and stained glass. Every effect here
 * is tagged "glass", so `findEffects({ tags: ["glass"] })` gathers them with
 * the glass effects in other categories (ribbed and shower glass, the glass
 * card, liquid glass, rain on glass, glass shatter).
 */

/**
 * `pictureBlurRGBA(tex, uv, blurPx)`: the picture (see {@link PICTURE})
 * softened over about `blurPx` pixels, read from the image's mipmaps, so
 * frosting costs one read. `dispersed(tex, uv, shift, blurPx)`: the picture
 * seen through glass that splits light, five reads spread along `shift` (uv)
 * and weighted by their colour of the spectrum. Needs {@link PICTURE},
 * `SPECTRUM` and an image control left on mipmap filtering.
 */
export const DISPERSE = `
vec4 pictureBlurRGBA(sampler2D tex, vec2 uv, float blurPx) {
  vec2 size = vec2(textureSize(tex, 0));
  if (size.x <= 1.0) return vec4(testCard(fract(uv)), 1.0);
  return overBackdrop(textureLod(tex, uv, log2(max(blurPx * size.x / iResolution.x, 1.0))));
}
vec4 dispersed(sampler2D tex, vec2 uv, vec2 shift, float blurPx) {
  if (dot(shift, shift) < 1e-12) return pictureBlurRGBA(tex, uv, blurPx);
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 5; i++) {
    float x = (float(i) + 0.5) / 5.0;
    vec3 w = spectrum(x);
    vec4 c = pictureBlurRGBA(tex, uv + shift * (x - 0.5), blurPx);
    sum += c.rgb * w;
    weight += w;
    alpha += c.a;
  }
  return vec4(sum / weight, alpha / 5.0);
}`.trim();

/**
 * Glass or metal letters from a text image (`uText`, see `textImage`) placed
 * `uSize` of the frame: `textAt(p, blur)` is their coverage at frame point p
 * (height 1, centred) softened over `blur` frame units; `bevelHeight(p,
 * bevel)` rises from 0 outside to 1 inside over the bevel; `bevelSlope(p,
 * bevel)` is its slope, about 1 across a full rim. Reads the text image's
 * mipmaps, so leave its control on mipmap filtering.
 */
export const TEXT_BEVEL = `
vec3 textPlace(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  return vec3(p / vec2(h * aspect, h) + 0.5, size.y / h);
}
float textAt(vec2 p, float blur) {
  vec3 m = textPlace(p);
  if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
  return textureLod(uText, m.xy, log2(max(blur * m.z, 1.0))).a;
}
float bevelHeight(vec2 p, float bevel) {
  return 0.45 * textAt(p, bevel * 0.5) + 0.35 * textAt(p, bevel) + 0.2 * textAt(p, bevel * 2.0);
}
vec2 bevelSlope(vec2 p, float bevel) {
  float e = bevel * 0.35;
  vec2 d = vec2(bevelHeight(p + vec2(e, 0.0), bevel) - bevelHeight(p - vec2(e, 0.0), bevel),
                bevelHeight(p + vec2(0.0, e), bevel) - bevelHeight(p - vec2(0.0, e), bevel));
  return d / (2.0 * e) * bevel;
}`.trim();

/**
 * `voronoiBorder(p, jitter)`: the Voronoi cell around p, as its seed (xy, in
 * p's units), the distance to the cell's nearest border (z) and a 0–1 id
 * (w). Needs {@link HASH}.
 */
const VORONOI = `
vec4 voronoiBorder(vec2 p, float jitter) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + 0.5 + jitter * (hash22(n + g) - 0.5) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + 0.5 + jitter * (hash22(n + g) - 0.5) - f;
      vec2 between = r - mr;
      if (dot(between, between) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(between)));
    }
  }
  return vec4(n + mg + 0.5 + jitter * (hash22(n + mg) - 0.5), md, hash12(n + mg));
}`.trim();

export const glassText: ShaderEffect = {
  kind: "shader",
  id: "glass-text",
  name: "Glass text",
  description:
    "A title cast in glass over a picture, bending and splitting what is behind it, while a beam of light sweeps through the letters and breaks into a faint rainbow at their edges.",
  category: "text",
  video: "filter",
  tags: ["text", "title", "glass", "refraction", "prism", "rainbow", "light-sweep", "image"],
  loop: 4,
  source: glsl(
    `// Glass text: bevelled glass letters refract the picture; a light beam sweeps through and disperses at the bevels.
uniform sampler2D uText;      // @control wrap=clamp default=${textImage("GLASS")} label="Text"
uniform sampler2D uImage;     // @control wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image behind"
uniform float uSize;          // @control min=0.3 max=1 default=0.85 label="Text size"
uniform float uBevel;         // @control min=0.005 max=0.08 default=0.025 label="Bevel"
uniform float uRefraction;    // @control min=0 max=1 default=0.6 label="Refraction"
uniform float uDispersion;    // @control min=0 max=1 default=0.35 label="Dispersion"
uniform float uFrost;         // @control min=0 max=1 default=0 label="Frost"
uniform float uRough;         // @control min=0 max=1 default=0 label="Rough surface"
uniform vec3 uTint;           // @control color default=#E6F4FF label="Glass tint"
uniform float uTintAlpha;     // @control min=0 max=1 default=0.25 label="Tint strength"
uniform float uGloss;         // @control min=0 max=1 default=0.7 label="Gloss"
uniform float uShadow;        // @control min=0 max=1 default=0.35 label="Shadow"
uniform float uDim;           // @control min=0 max=0.9 default=0.25 label="Dim the picture"
uniform float uBeam;          // @control min=0 max=2 default=1 label="Light beam"
uniform vec3 uBeamColor;      // @control color default=#FFF8EA label="Beam colour"
uniform float uBeamWidth;     // @control min=0.03 max=0.6 default=0.16 label="Beam width"
uniform float uBeamAngle;     // @control min=-60 max=60 default=20 label="Beam angle (°)"
uniform float uSweepTime;     // @control min=1 max=12 default=4 label="Seconds per sweep"
uniform float uPrism;         // @control min=0 max=1 default=0.6 label="Prism (rainbow)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    TEXT_BEVEL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 uv = fragCoord / iResolution.xy;
  vec2 toUv = vec2(iResolution.y / iResolution.x, 1.0);
  float mask = textAt(p, 1.5 * px);
  float h = bevelHeight(p, uBevel);
  vec2 s = bevelSlope(p, uBevel);
  if (uRough > 0.0) {
    vec2 q = p * 60.0;
    s += uRough * 0.5 * vec2(vnoise(q) - vnoise(q + vec2(0.5, 0.0)), vnoise(q) - vnoise(q + vec2(0.0, 0.5))) * 2.0 * h;
  }
  float slope = length(s);
  float rim = smoothstep(0.1, 0.8, slope);

  // The beam: a soft band sweeping across, its rays running along it.
  float ba = radians(uBeamAngle);
  vec2 across = vec2(cos(ba), sin(ba));
  vec2 along = vec2(sin(ba), -cos(ba));
  float reach = 0.5 * iResolution.x * px + uBeamWidth * 2.5;
  float phase = fract(iTime / uSweepTime);
  float d = dot(p, across) - mix(-reach, reach, clamp(phase / 0.7, 0.0, 1.0));
  float beam = uBeam * exp(-d * d / (uBeamWidth * uBeamWidth)) * step(phase, 0.7);

  // Behind: the picture, a soft shadow of the letters, the beam's haze, and the letters' light thrown past them.
  vec4 bg = pictureBlurRGBA(uImage, uv, 1.0);
  vec3 col = bg.rgb * (1.0 - uDim);
  float shadow = textAt(p - vec2(0.012, -0.02), uBevel * 2.0);
  col *= 1.0 - uShadow * 0.6 * shadow;
  col += uBeamColor * beam * 0.1;
  vec3 thrown = vec3(0.0);
  vec3 weight = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float x = (float(i) + 0.5) / 4.0;
    vec3 w = spectrum(x);
    thrown += w * textAt(p - along * (0.03 + 0.05 * x), uBevel * 1.5);
    weight += w;
  }
  col += uBeamColor * (thrown / weight) * beam * uPrism * 0.4;

  // The glass: the picture bent by the bevel and by each letter's body as a whole (a lens),
  // split into colour, tinted by its thickness and lit.
  vec2 lens = bevelSlope(p, uBevel * 4.0);
  vec2 bend = -(s + 0.8 * lens) * uRefraction * 0.06;
  vec4 seen = dispersed(uImage, uv + bend * toUv, bend * toUv * uDispersion * 3.0, 1.0 + uFrost * 28.0);
  vec3 glass = seen.rgb * (1.0 - uDim * 0.5);
  glass = mix(glass, glass * uTint * 1.15, uTintAlpha * (0.4 + 0.6 * h));
  glass = mix(glass, vec3(dot(glass, vec3(0.299, 0.587, 0.114))) + 0.1, uFrost * 0.25);
  vec3 n = normalize(vec3(-s * 1.4, 1.0));
  vec3 light = normalize(vec3(-0.5, 0.6, 0.8));
  glass *= 1.0 - 0.3 * clamp(dot(s, light.xy), -1.0, 1.0) * rim;
  // Light leaving the glass at a steep slope is bent away: a dark line just inside the edge.
  glass *= 1.0 - 0.45 * smoothstep(0.35, 0.9, slope) * (1.0 - smoothstep(0.9, 1.4, slope));
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  glass += uGloss * (spec * 0.8 + 0.25 * rim * clamp(n.y + 0.3, 0.0, 1.0));
  glass += uGloss * 0.06 * (1.0 - rim);
  // The beam inside: brighter at the bevels, and split there into a rainbow that shifts as it crosses.
  glass += uBeamColor * beam * (0.12 + 0.45 * rim);
  float x = clamp(0.5 + dot(s, across) * 0.9 + 0.4 * d / uBeamWidth, 0.0, 1.0);
  glass += spectrum(x) * beam * smoothstep(0.05, 0.6, slope) * uPrism * 1.1;

  col = mix(col, glass, mask);
  fragColor = vec4(col, max(bg.a, mask));
}`,
  ),
  presets: [
    { name: "Clear", values: { uTintAlpha: 0.1, uFrost: 0, uDispersion: 0.3 } },
    { name: "Frosted", values: { uFrost: 0.6, uRefraction: 0.4, uTintAlpha: 0.15, uDim: 0.35 } },
    { name: "Ice", values: { uTint: [0.75, 0.9, 1], uTintAlpha: 0.45, uFrost: 0.25, uRough: 0.5, uBeamColor: [0.85, 0.95, 1] } },
    { name: "Amber", values: { uTint: [1, 0.62, 0.2], uTintAlpha: 0.7, uBeamColor: [1, 0.85, 0.6], uPrism: 0.3 } },
    { name: "Prism sweep", values: { uDim: 0.6, uBeam: 1.6, uPrism: 1, uBeamWidth: 0.1, uDispersion: 0.6 } },
    { name: "Still", values: { uBeam: 0 } },
  ],
};

export const glassOrb: ShaderEffect = {
  kind: "shader",
  id: "glass-orb",
  name: "Crystal ball",
  description:
    "A crystal ball over a picture showing it flipped and magnified, with colour fringes at its rim, a bright highlight and a focused spot of light in its shadow; it follows the pointer.",
  category: "distortion",
  video: "interactive",
  tags: ["distortion", "glass", "lens", "sphere", "refraction", "image", "interactive", "hover"],
  source: glsl(
    `// Crystal ball: a solid glass sphere that flips and magnifies the picture behind it, following the pointer.
uniform sampler2D uImage;   // @control wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uRadius;      // @control min=0.05 max=0.6 default=0.22 label="Radius"
uniform float uZoom;        // @control min=0.3 max=3 default=1.3 label="Magnify"
uniform bool uInvert;       // @control default=true label="Flip the view (as a solid ball does)"
uniform float uRefraction;  // @control min=0 max=1 default=0.6 label="Bend at the rim"
uniform float uDispersion;  // @control min=0 max=1 default=0.4 label="Dispersion"
uniform vec3 uTint;         // @control color default=#FFFFFF label="Tint"
uniform float uTintAlpha;   // @control min=0 max=0.6 default=0.04 label="Tint strength"
uniform float uRim;         // @control min=0 max=1 default=0.7 label="Rim and highlights"
uniform float uShadow;      // @control min=0 max=1 default=0.4 label="Shadow"
uniform float uCaustic;     // @control min=0 max=1 default=0.5 label="Focused light"
uniform bool uDemo;         // @control default=true label="Drift when idle"
${BACKDROP_CONTROLS}`,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureBlurRGBA(uImage, uv, 1.0);
  vec2 drift = iResolution.xy * (0.5 + vec2(0.2 * sin(iTime * 0.43), 0.14 * sin(iTime * 0.61 + 1.3)));
  vec2 c = mix(uDemo ? drift : 0.5 * iResolution.xy, iPointer.xy, clamp(iPointer.z, 0.0, 1.0));
  float R = uRadius * iResolution.y;
  vec2 q = (fragCoord - c) / R;
  float r = length(q);
  vec2 toLight = normalize(vec2(-0.55, 0.8));
  vec3 col = pic.rgb;
  // The shadow falls away from the light, with the light the ball gathers focused inside it.
  vec2 sq = (q + toLight * 0.45) * vec2(1.0, 1.3);
  col *= 1.0 - uShadow * 0.6 * smoothstep(1.05, 0.5, length(sq));
  float f = length(q + toLight * 1.15);
  col += uCaustic * (0.9 * exp(-f * f / 0.02) + 0.25 * spectrum(clamp((f - 0.12) / 0.2, 0.0, 1.0)) * smoothstep(0.34, 0.2, f) * smoothstep(0.08, 0.14, f));
  float inside = clamp((1.0 - r) * R + 0.5, 0.0, 1.0);
  if (inside > 0.0) {
    float z = sqrt(max(1.0 - r * r, 0.0));
    float bend = 1.0 - z;
    vec2 look = (uInvert ? -q : q) / uZoom * (1.0 + uRefraction * bend * 1.5);
    vec2 toUv = vec2(R) / iResolution.xy;
    vec4 seen = dispersed(uImage, (c / iResolution.xy) + look * toUv, q * bend * uDispersion * 0.25 * toUv, 1.0 + 6.0 * bend * bend);
    vec3 glass = mix(seen.rgb, uTint, uTintAlpha);
    glass *= 1.0 - 0.35 * bend * bend * bend;
    vec3 n = vec3(q, z);
    float fresnel = pow(bend, 4.0);
    vec3 sky = mix(vec3(0.2, 0.22, 0.26), vec3(1.0), smoothstep(-0.3, 0.8, n.y));
    glass = mix(glass, sky, fresnel * uRim * 0.7);
    vec3 h = normalize(normalize(vec3(toLight, 0.9)) + vec3(0.0, 0.0, 1.0));
    glass += uRim * 1.2 * pow(max(dot(n, h), 0.0), 90.0);
    // A soft window reflected near the top.
    vec2 w = (q - vec2(-0.3, 0.52)) * vec2(1.0, 2.2);
    glass += uRim * 0.18 * smoothstep(0.3, 0.12, length(w));
    glass += uRim * 0.45 * smoothstep(0.9, 1.0, r) * (0.5 + 0.5 * dot(q / max(r, 1e-3), toLight));
    col = mix(col, glass, inside);
  }
  fragColor = vec4(col, max(pic.a, inside));
}`,
  ),
  presets: [
    { name: "Marble", values: { uRadius: 0.1, uZoom: 2, uCaustic: 0.7 } },
    { name: "Lens (no flip)", values: { uInvert: false, uZoom: 1.6, uRefraction: 0.4 } },
    { name: "Smoky quartz", values: { uTint: [0.35, 0.3, 0.28], uTintAlpha: 0.35, uDispersion: 0.2 } },
  ],
};

export const glassBlocks: ShaderEffect = {
  kind: "shader",
  id: "glass-blocks",
  name: "Glass blocks",
  description: "A picture seen through a wall of glass bricks: each block squeezes and ripples its own piece of the view, set in pale mortar.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "glass", "glass-block", "bricks", "privacy", "image"],
  source: glsl(
    `// Glass blocks: a grid of pillowed glass bricks, each a lens with pressed ripples, between lines of mortar.
uniform sampler2D uImage;     // @control wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uSize;          // @control min=30 max=320 default=120 label="Block size (px)"
uniform float uMortar;        // @control min=0 max=0.25 default=0.07 label="Mortar"
uniform vec3 uMortarColor;    // @control color default=#D9D6CF label="Mortar colour"
uniform float uRefraction;    // @control min=0 max=1 default=0.55 label="Refraction"
uniform float uWave;          // @control min=0 max=1 default=0.5 label="Pressed ripples"
uniform float uDispersion;    // @control min=0 max=1 default=0.2 label="Dispersion"
uniform float uFrost;         // @control min=0 max=1 default=0.2 label="Frost"
uniform vec3 uTint;           // @control color default=#EAF5F3 label="Glass tint"
uniform float uHighlight;     // @control min=0 max=1 default=0.5 label="Highlights"
${BACKDROP_CONTROLS}`,
    HASH,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 g = fragCoord / uSize;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float edge = 0.5 - max(abs(f.x), abs(f.y));
  float mortar = 1.0 - smoothstep(0.5 * uMortar, 0.5 * uMortar + 1.5 / uSize, edge);
  vec2 u = clamp(f / (0.5 - 0.5 * uMortar), -1.0, 1.0);
  // The pillowed face, (1 - x²)(1 - y²), and its pressed ripples.
  vec2 slope = -2.0 * u * vec2(1.0 - u.y * u.y, 1.0 - u.x * u.x);
  float rr = length(u);
  slope += uWave * 0.6 * cos(rr * 14.0) * u / max(rr, 1e-3);
  vec2 look = (cell + 0.5) * uSize + f * uSize * (1.0 - 1.2 * uRefraction) - slope * uSize * 0.12 * uRefraction;
  vec2 toUv = 1.0 / iResolution.xy;
  vec4 seen = dispersed(uImage, look * toUv, slope * uSize * 0.1 * uDispersion * toUv, 1.0 + uFrost * 24.0);
  vec3 glass = seen.rgb * uTint;
  vec2 toLight = normalize(vec2(-0.6, 0.8));
  glass *= 1.0 + 0.25 * uHighlight * clamp(-dot(slope, toLight), -1.0, 1.0);
  float rim = smoothstep(0.78, 0.98, max(abs(u.x), abs(u.y)));
  glass += uHighlight * 0.3 * rim * clamp(0.5 - 0.5 * dot(normalize(u + 1e-4), toLight), 0.0, 1.0);
  vec3 mortarCol = uMortarColor * (0.88 + 0.12 * hash12(floor(fragCoord / 2.0)));
  mortarCol *= 1.0 - 0.25 * smoothstep(0.5 * uMortar, 0.0, edge) * step(0.001, uMortar);
  vec3 col = mix(glass, mortarCol, mortar);
  fragColor = vec4(col, max(seen.a, mortar));
}`,
  ),
  presets: [
    { name: "Bathroom", values: { uSize: 90, uWave: 0.8, uFrost: 0.4 } },
    { name: "Clear blocks", values: { uWave: 0.15, uFrost: 0, uRefraction: 0.4 } },
    { name: "Dark grout", values: { uMortarColor: [0.18, 0.18, 0.2], uMortar: 0.05, uTint: [0.85, 0.95, 1] } },
  ],
};

export const crackedGlass: ShaderEffect = {
  kind: "shader",
  id: "cracked-glass",
  name: "Cracked glass",
  description:
    "A picture behind a pane that cracks into a spider web from the centre and wherever you click, its shards slightly out of line and the cracks catching the light.",
  category: "distortion",
  video: "interactive",
  tags: ["distortion", "glass", "cracks", "safety-glass", "impact", "image", "interactive", "click"],
  loop: 5,
  source: glsl(
    `// Cracked glass: radial cracks and rings from each impact; each shard shifts and shades the picture a little.
uniform sampler2D uImage;     // @control wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform bool uDemo;           // @control default=true label="Crack the centre on a loop"
uniform vec2 uCentre;         // @control min=0 max=1 default=0.5,0.5 label="Centre impact"
uniform int uRays;            // @control min=5 max=28 default=14 label="Radial cracks"
uniform float uRings;         // @control min=0 max=1 default=0.6 label="Ring cracks"
uniform float uReach;         // @control min=0.1 max=1.5 default=0.6 label="Reach"
uniform float uShift;         // @control min=0 max=1 default=0.4 label="Shard shift"
uniform float uCrackLight;    // @control min=0 max=1 default=0.75 label="Crack light"
uniform float uDispersion;    // @control min=0 max=1 default=0.4 label="Dispersion"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `// The crack web of one impact at q (frame units from it): its lines, and the shift and shade of the shard q is in.
float web(vec2 q, float reach, float seed, inout vec2 shift, inout float shade) {
  float r = length(q);
  if (reach <= 0.0 || r > reach * 1.2) return 0.0;
  float n = float(uRays);
  float a = atan(q.y, q.x) / 6.28318 + 0.5 + (0.0025 * sin(r * 30.0 + seed) + 0.0012 * sin(r * 90.0 - seed)) * 14.0 / float(uRays);
  float k = a * n + seed;
  float sector = floor(k);
  float fr = fract(k);
  float arc = r * 6.28318 / n;
  float width = 0.0011 + 0.002 * exp(-r * 12.0);
  float lenLo = reach * (0.5 + 0.5 * hash12(vec2(sector, seed)));
  float lenHi = reach * (0.5 + 0.5 * hash12(vec2(sector + 1.0, seed)));
  float lines = smoothstep(width * 2.0, 0.0, fr * arc) * smoothstep(lenLo, lenLo * 0.6, r);
  lines = max(lines, smoothstep(width * 2.0, 0.0, (1.0 - fr) * arc) * smoothstep(lenHi, lenHi * 0.6, r));
  // Rings: log-spaced bands whose radius jumps a little from sector to sector, so they read as chords.
  float g = 0.55;
  float band = log(max(r, 1e-4) / 0.03) / g + 0.6 * hash12(vec2(sector, seed + 3.0));
  float ring = floor(band);
  float fb = fract(band);
  float dr = r * g * min(fb, 1.0 - fb);
  float shown = step(hash12(vec2(sector * 7.0 + ring, seed)), uRings) * smoothstep(reach, reach * 0.7, r);
  lines = max(lines, smoothstep(width * 2.0, 0.0, dr) * shown * step(0.03, r));
  // Crushed glass right at the impact.
  lines = max(lines, smoothstep(0.035, 0.0, r) * smoothstep(0.45, 0.7, vnoise(q * 500.0 + seed)));
  vec2 id = vec2(sector, ring + seed * 7.0);
  float fall = smoothstep(reach, 0.0, r);
  shift += (hash22(id) - 0.5) * uShift * 0.012 * fall;
  shade += (hash12(id + 0.5) - 0.5) * 0.18 * fall;
  return lines;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 shift = vec2(0.0);
  float shade = 0.0;
  float lines = 0.0;
  if (uDemo) {
    float t = mod(iTime, 5.0);
    float reach = uReach * smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(4.5, 5.0, t));
    lines = max(lines, web(p - uCentre * iResolution.xy * px, reach, 1.0, shift, shade));
  }
  for (int i = 0; i < 8; i++) {
    if (iClicks[i].w < 0.5) break;
    float age = iTime - iClicks[i].z;
    float seed = fract(iClicks[i].z * 0.618) * 40.0 + 2.0;
    lines = max(lines, web(p - iClicks[i].xy * px, uReach * 0.8 * smoothstep(0.0, 0.3, age), seed, shift, shade));
  }
  vec2 uv = fragCoord / iResolution.xy + shift * vec2(iResolution.y / iResolution.x, 1.0);
  vec4 seen = dispersed(uImage, uv, shift * uDispersion * 4.0 * vec2(iResolution.y / iResolution.x, 1.0), 1.0);
  vec3 col = seen.rgb * (1.0 + shade);
  col = mix(col, vec3(0.95), lines * uCrackLight * 0.85);
  col += (spectrum(fract(p.x * 2.0 + p.y * 3.0)) - 0.45) * lines * uDispersion * 0.4;
  fragColor = vec4(col, seen.a);
}`,
  ),
  presets: [
    { name: "Bullet hole", values: { uReach: 0.35, uRays: 20, uRings: 0.8, uShift: 0.2 } },
    { name: "Spider web", values: { uReach: 1.2, uRays: 10, uRings: 0.9 } },
    { name: "Clicks only", values: { uDemo: false } },
  ],
};

export const condensationWipe: ShaderEffect = {
  kind: "shader",
  id: "condensation-wipe",
  name: "Condensation wipe",
  description:
    "A picture behind fogged-up glass dotted with droplets; the pointer wipes clear streaks that mist over again, and a few drips run down.",
  category: "interaction",
  video: "interactive",
  tags: ["interaction", "interactive", "hover", "glass", "fog", "steam", "condensation", "wipe", "trail", "image"],
  source: glsl(
    `// Condensation wipe: blurred, misted glass with droplets; recent pointer positions (or a finger while idle) clear it.
uniform sampler2D uImage;     // @control wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uFog;           // @control min=0 max=1 default=0.75 label="Fog"
uniform float uBlur;          // @control min=0 max=1 default=0.6 label="Blur"
uniform vec3 uFogColor;       // @control color default=#DCE5EA label="Fog colour"
uniform float uWidth;         // @control min=0.02 max=0.25 default=0.07 label="Wipe width"
uniform float uDroplets;      // @control min=0 max=1 default=0.6 label="Droplets"
uniform float uDrips;         // @control min=0 max=1 default=0.5 label="Drips"
uniform float uRefog;         // @control min=0.5 max=8 default=3 label="Idle wipe fogs over after (s)"
uniform bool uDemo;           // @control default=true label="Wipe on its own when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0));
}

// The idle finger's path, in frame units (height 1).
vec2 finger(float t) {
  float aspect = iResolution.x / iResolution.y;
  return vec2(aspect * (0.5 + 0.32 * sin(t * 0.9)), 0.5 + 0.25 * sin(t * 1.7 + 0.6));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 uv = fragCoord / iResolution.xy;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  float clear = 0.0;
  // The idle finger: its path over the last few seconds, older parts misting over.
  if (uDemo && hover < 1.0) {
    for (int i = 0; i < 24; i++) {
      float age = float(i) / 24.0;
      float t0 = iTime - age * uRefog;
      float d = segment(p, finger(t0), finger(t0 - uRefog / 24.0));
      clear = max(clear, smoothstep(uWidth * 0.5, uWidth * 0.3, d) * (1.0 - age) * (1.0 - hover));
    }
  }
  // The pointer: where it has been in the last second, and where it is.
  for (int i = 0; i < 31; i++) {
    if (iTrail[i + 1].w < 0.5) break;
    float age = clamp(iTime - iTrail[i].z, 0.0, 1.0);
    float d = segment(p, iTrail[i].xy * px, iTrail[i + 1].xy * px);
    clear = max(clear, smoothstep(uWidth * 0.5, uWidth * 0.3, d) * (1.0 - age * age));
  }
  clear = max(clear, hover * smoothstep(uWidth * 0.5, uWidth * 0.3, length(p - iPointer.xy * px)));
  // Drips: a few drops sliding down, leaving a clear line above them.
  float lane = floor(p.x / 0.08);
  float lx = (fract(p.x / 0.08) - 0.5) * 0.08;
  float hasDrip = step(1.0 - 0.45 * uDrips, hash12(vec2(lane, 3.0)));
  float head = 1.2 - fract(iTime * (0.05 + 0.08 * hash12(vec2(lane, 7.0))) + hash12(vec2(lane, 9.0))) * 1.5;
  float wobble = 0.004 * sin(p.y * 40.0 + lane);
  float dripLine = smoothstep(0.004, 0.002, abs(lx + wobble)) * step(head, p.y) * smoothstep(head + 0.35, head, p.y);
  float drop = smoothstep(0.008, 0.005, length(vec2(lx + wobble, (p.y - head) * 0.7)));
  clear = max(clear, max(dripLine * 0.8, drop) * hasDrip);
  // Fog: the picture blurred and lifted towards the fog colour; droplets in it show the picture sharper, upside down.
  vec4 sharp = pictureBlurRGBA(uImage, uv, 1.0);
  vec4 blurred = pictureBlurRGBA(uImage, uv, 2.0 + uBlur * 40.0);
  vec3 fog = mix(blurred.rgb, uFogColor, uFog * 0.55) + 0.04 * uFog;
  vec2 cell = floor(p * 40.0);
  vec2 local = fract(p * 40.0) - 0.5 - (hash22(cell) - 0.5) * 0.4;
  float size = 0.1 + 0.25 * hash12(cell + 1.7);
  float droplet = smoothstep(size, size - 0.06, length(local)) * step(0.55, hash12(cell + 4.1)) * uDroplets;
  // Each droplet is a tiny lens: the picture through it, sharper, lit on its upper left and shaded below.
  vec3 inDrop = mix(fog, pictureBlurRGBA(uImage, uv - local * 0.02, 1.0).rgb, 0.6);
  inDrop += 0.25 * smoothstep(0.0, size, -(local.x - local.y)) - 0.08 * smoothstep(0.0, size, local.x - local.y);
  fog = mix(fog, inDrop, droplet * (1.0 - clear));
  // A thin ridge of water along the edge of each wipe.
  float ridge = clear * (1.0 - clear) * 4.0;
  vec3 col = mix(fog, sharp.rgb, clear);
  col += ridge * 0.08;
  fragColor = vec4(col, sharp.a);
}`,
  ),
  presets: [
    { name: "Shower", values: { uFog: 0.9, uBlur: 0.8, uDroplets: 0.9, uDrips: 0.9 } },
    { name: "Cold window", values: { uFogColor: [0.78, 0.86, 0.95], uFog: 0.6, uDrips: 0.2 } },
    { name: "Pointer only", values: { uDemo: false } },
  ],
};

export const stainedGlass: ShaderEffect = {
  kind: "shader",
  id: "stained-glass",
  name: "Stained glass",
  description: "Jewel-coloured panes of mottled glass set in lead, glowing as the sun moves behind them; a rose window when you want one.",
  category: "pattern",
  tags: ["pattern", "glass", "stained-glass", "church", "window", "mosaic", "background"],
  source: glsl(
    `// Stained glass: Voronoi panes in four glass colours, mottled and lit from behind, set in lead came.
uniform float uCells;        // @control min=3 max=30 default=8 label="Panes down"
uniform float uLead;         // @control min=0.01 max=0.25 default=0.07 label="Lead width"
uniform vec3 uLeadColor;     // @control color default=#1B1B20 label="Lead"
uniform vec3 uColorA;        // @control color default=#B5212B label="Glass A"
uniform vec3 uColorB;        // @control color default=#1E4CA8 label="Glass B"
uniform vec3 uColorC;        // @control color default=#E6AE1E label="Glass C"
uniform vec3 uColorD;        // @control color default=#2C8A55 label="Glass D"
uniform float uLight;        // @control min=0.2 max=2 default=1 label="Light through"
uniform float uSun;          // @control min=0 max=1 default=0.6 label="Moving sun"
uniform float uTexture;      // @control min=0 max=1 default=0.5 label="Mottling"
uniform bool uRose;          // @control default=false label="Rose window"
uniform float uSpeed;        // @control min=0 max=2 default=0.3 label="Speed"`,
    HASH,
    NOISE,
    FBM,
    VORONOI,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float r = length(p);
  vec2 q = p * uCells;
  if (uRose) {
    // Twelve mirrored slices, so the panes repeat round the centre.
    float seg = 6.28318 / 12.0;
    float a = abs(mod(atan(p.y, p.x), seg) - 0.5 * seg);
    q = vec2(cos(a), sin(a)) * r * uCells * 2.8;
  }
  vec4 v = voronoiBorder(q, 0.9);
  float id = v.w;
  float pick = floor(id * 4.0);
  vec3 glass = pick < 1.0 ? uColorA : pick < 2.0 ? uColorB : pick < 3.0 ? uColorC : uColorD;
  glass *= 0.7 + 0.55 * fract(id * 7.31);
  float mottle = fbm(q * 1.7 + id * 13.0, 4);
  float streak = fbm(vec2(q.x * 0.6, q.y * 5.0) + id * 5.0, 3);
  glass *= mix(1.0, 0.65 + 0.5 * mottle + 0.25 * streak, uTexture);
  // Seeds: tiny bubbles in the glass.
  vec2 bc = floor(q * 9.0);
  float bubble = smoothstep(0.12, 0.05, length(fract(q * 9.0) - 0.5 - (hash22(bc) - 0.5) * 0.6)) * step(0.93, hash12(bc));
  glass *= 1.0 + 0.4 * bubble * uTexture;
  // Light from behind: a sun drifting across, the panes glowing where it is.
  float t = iTime * uSpeed;
  vec2 sun = vec2(0.6 * sin(t * 0.5), 0.25 + 0.2 * cos(t * 0.37));
  float glow = mix(0.9, 0.45 + 1.2 * exp(-dot(p - sun, p - sun) * 2.5), uSun);
  glow *= 0.92 + 0.08 * sin(t * 2.0 + id * 20.0);
  vec3 col = glass * glow * uLight;
  col += glass * glass * max(glow * uLight - 1.0, 0.0) * 0.6;
  // Lead came, rounded, darkening the glass that meets it.
  float cell = uCells * px * (uRose ? 2.8 : 1.0);
  float half_ = 0.5 * uLead;
  float lead = 1.0 - smoothstep(half_, half_ + 1.5 * cell, v.z);
  col *= 0.75 + 0.25 * smoothstep(half_, half_ * 3.0 + 0.02, v.z);
  vec3 came = uLeadColor * (0.7 + 0.6 * smoothstep(half_, 0.0, v.z)) + 0.05 * smoothstep(half_ * 0.6, 0.0, v.z);
  col = mix(col, came, lead);
  if (uRose) {
    // The window's stone tracery: rings and a dark surround.
    float ring = min(abs(r - 0.46), abs(r - 0.12));
    col = mix(col, came, 1.0 - smoothstep(0.008, 0.008 + 1.5 * px, ring));
    col = mix(col, uLeadColor * 0.6, smoothstep(0.46, 0.46 + 1.5 * px, r));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Rose window", values: { uRose: true, uCells: 4, uLead: 0.09 } },
    { name: "Tiffany", values: { uColorA: [0.86, 0.55, 0.18], uColorB: [0.36, 0.55, 0.3], uColorC: [0.92, 0.8, 0.45], uColorD: [0.55, 0.3, 0.2], uLeadColor: [0.25, 0.2, 0.15], uCells: 12 } },
    { name: "Cool", values: { uColorA: [0.15, 0.35, 0.75], uColorB: [0.2, 0.6, 0.7], uColorC: [0.5, 0.3, 0.75], uColorD: [0.85, 0.9, 0.95] } },
  ],
};

export const imageStainedGlass: ShaderEffect = {
  kind: "shader",
  id: "image-stained-glass",
  name: "Stained glass picture",
  description: "A picture remade as a stained-glass window: each pane takes the picture's colour where it sits, mottled, lit from behind and set in lead.",
  category: "image",
  video: "filter",
  tags: ["image", "glass", "stained-glass", "mosaic", "window", "filter"],
  source: glsl(
    `// Stained glass picture: Voronoi panes filled with the picture's colour at each pane, set in lead.
uniform sampler2D uImage;    // @control wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uCells;        // @control min=5 max=90 default=24 label="Panes down"
uniform float uLead;         // @control min=0.01 max=0.25 default=0.08 label="Lead width"
uniform vec3 uLeadColor;     // @control color default=#18181C label="Lead"
uniform float uSaturation;   // @control min=0 max=2 default=1.35 label="Saturation"
uniform float uTexture;      // @control min=0 max=1 default=0.45 label="Mottling"
uniform float uLight;        // @control min=0.3 max=2 default=1.1 label="Light through"
uniform float uJitter;       // @control min=0 max=1 default=0.9 label="Irregular panes"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    VORONOI,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 q = fragCoord * px * uCells;
  vec4 v = voronoiBorder(q, uJitter);
  vec2 seedUv = v.xy / uCells / px / iResolution.xy;
  vec4 pane = pictureBlurRGBA(uImage, seedUv, 0.35 / (uCells * px));
  vec3 glass = pane.rgb;
  float luma = dot(glass, vec3(0.299, 0.587, 0.114));
  glass = clamp(mix(vec3(luma), glass, uSaturation), 0.0, 1.0);
  glass *= mix(1.0, 0.7 + 0.55 * fbm(q * 1.8 + v.w * 11.0, 4), uTexture);
  vec2 c = fragCoord / iResolution.xy - 0.5;
  glass *= uLight * (1.05 - 0.45 * dot(c, c));
  float cell = uCells * px;
  float half_ = 0.5 * uLead;
  float lead = 1.0 - smoothstep(half_, half_ + 1.5 * cell, v.z);
  glass *= 0.78 + 0.22 * smoothstep(half_, half_ * 3.0 + 0.02, v.z);
  vec3 came = uLeadColor * (0.7 + 0.6 * smoothstep(half_, 0.0, v.z));
  vec3 col = mix(glass, came, lead);
  fragColor = vec4(col, max(pane.a, lead * pane.a));
}`,
  ),
  presets: [
    { name: "Bold", values: { uCells: 12, uLead: 0.12, uSaturation: 1.6 } },
    { name: "Fine", values: { uCells: 55, uLead: 0.06, uTexture: 0.25 } },
    { name: "Tiled", values: { uJitter: 0.1, uCells: 20 } },
  ],
};

export const gemstone: ShaderEffect = {
  kind: "shader",
  id: "gemstone",
  name: "Gemstone",
  description: "A brilliant-cut gem seen from above, turning slowly so its facets flash white and throw sparks of rainbow fire, with star glints.",
  category: "3d",
  tags: ["3d", "glass", "gem", "diamond", "crystal", "sparkle", "fire", "luxury", "overlay"],
  transparent: true,
  source: glsl(
    `// Gemstone: a brilliant cut in plan, its crown and pavilion facets each a mirror flashing as two lights circle.
uniform vec3 uColor;           // @control color default=#F4F8FF label="Stone colour"
uniform vec3 uBackground;      // @control color default=#07080C label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform float uSize;           // @control min=0.2 max=0.95 default=0.62 label="Size"
uniform int uFacets;           // @control min=6 max=16 default=8 label="Facets round"
uniform float uFire;           // @control min=0 max=1 default=0.6 label="Fire (rainbow)"
uniform float uSparkle;        // @control min=0 max=1 default=0.8 label="Sparkle"
uniform float uFlares;         // @control min=0 max=1 default=0.6 label="Star glints"
uniform float uSpeed;          // @control min=0 max=2 default=0.4 label="Speed"`,
    HASH,
    SPECTRUM,
    ROTATE,
    `vec4 gFacet; // xy: which way the facet tilts (scaled by its tilt), z: id, w: distance to its nearest edge (gem units)

void facet(vec2 q) {
  float n = float(uFacets);
  float seg = 6.28318 / n;
  float r = length(q);
  float a = atan(q.y, q.x);
  float sector = floor(a / seg);
  float la = a - (sector + 0.5) * seg;
  float u = la / (0.5 * seg);
  float rc = r * cos(la);
  float side = r * abs(sin(la));
  float centre = (sector + 0.5) * seg;
  float table = 0.55;
  float star = table + 0.26 * (1.0 - abs(u));
  float girdle = 0.86 + 0.1 * abs(u);
  if (rc < table) {
    // The table looks down into the pavilion: twice as many arrow facets, in two rings.
    float sub = floor(a / (0.5 * seg));
    float ring = step(0.32, r);
    float dir = (sub + 0.5) * 0.5 * seg + 3.14159;
    float ls = (a / (0.5 * seg) - sub - 0.5) * 0.5 * seg;
    gFacet = vec4(vec2(cos(dir), sin(dir)) * (0.45 + 0.25 * ring), 100.0 + sub * 2.0 + ring, min(table - rc, min(abs(r - 0.32), r * abs(sin(abs(ls) - 0.25 * seg)))));
  } else if (rc < star) {
    gFacet = vec4(vec2(cos(centre), sin(centre)) * 0.35, sector * 4.0, min(rc - table, (star - rc) * 0.7));
  } else if (r > girdle) {
    float s = sign(u);
    float dir = centre + s * 0.3 * seg;
    gFacet = vec4(vec2(cos(dir), sin(dir)) * 0.85, sector * 4.0 + 2.0 + step(0.0, u), min(min(r - girdle, side), 1.0 - r) * 0.7);
  } else {
    float edgeA = centre + sign(u) * 0.5 * seg;
    gFacet = vec4(vec2(cos(edgeA), sin(edgeA)) * 0.6, (sector + step(0.0, u)) * 4.0 + 1.0, min(rc - star, girdle - r) * 0.7);
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float R = 0.5 * uSize;
  float t = iTime * uSpeed;
  vec2 q = rot(t * 0.3) * p / R;
  float r = length(q);
  vec3 col = uBackground + uColor * 0.12 * exp(-max(r - 1.0, 0.0) * 3.0);
  float inside = smoothstep(1.0 + px / R, 1.0 - px / R, r);
  float alpha = max(uBackgroundAlpha, inside);
  if (inside > 0.0) {
    facet(q);
    vec3 n = normalize(vec3(gFacet.xy, 1.0));
    vec3 view = reflect(vec3(0.0, 0.0, -1.0), n);
    vec3 l1 = normalize(vec3(cos(t * 1.3), sin(t * 0.9), 0.5));
    vec3 l2 = normalize(vec3(cos(t * 0.7 + 2.0), sin(t * 1.1 + 1.0), 0.8));
    float s1 = pow(max(dot(view, l1), 0.0), 30.0);
    float s2 = pow(max(dot(view, l2), 0.0), 18.0);
    float id = gFacet.z;
    float inner = 0.5 + 0.5 * sin(t * 3.0 + id * 1.7);
    float spark = (s1 + 0.6 * s2) * uSparkle;
    float k = hash12(vec2(id, 1.0));
    float body = 0.04 + 0.45 * inner * k * k + 0.06 * max(view.z, 0.0);
    vec3 stone = uColor * uColor * body * 1.6 + vec3(spark);
    stone += spectrum(fract(id * 0.618 + t * 0.15)) * uFire * (0.6 * sqrt(spark) + 0.12 * inner * step(0.7, hash12(vec2(id, 2.0))));
    float line = smoothstep(1.5 * px / R, 0.0, gFacet.w);
    stone = mix(stone, stone * 0.55 + uColor * 0.12, line * 0.6);
    col = mix(col, stone, inside);
  }
  // Star glints at points on the stone that catch the light in turn.
  vec3 glints = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 at = R * 0.65 * vec2(cos(fi * 1.7 + 0.4), sin(fi * 2.3 + 1.0));
    float on = pow(0.5 + 0.5 * sin(t * 2.3 + fi * 2.1), 14.0) * uFlares;
    vec2 d = (p - at) / R;
    float star = exp(-abs(d.x) * 70.0) * exp(-abs(d.y) * 5.0) + exp(-abs(d.y) * 70.0) * exp(-abs(d.x) * 5.0) + exp(-length(d) * 25.0);
    glints += on * star * (vec3(1.0) + 0.3 * uFire * spectrum(fract(fi * 0.3)));
  }
  col += glints;
  fragColor = vec4(col, max(alpha, clamp(dot(glints, vec3(0.333)), 0.0, 1.0)));
}`,
  ),
  presets: [
    { name: "Ruby", values: { uColor: [0.95, 0.15, 0.25], uFire: 0.3 } },
    { name: "Sapphire", values: { uColor: [0.2, 0.4, 1], uFire: 0.3 } },
    { name: "Emerald", values: { uColor: [0.2, 0.85, 0.45], uFacets: 12, uFire: 0.2 } },
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const prismLight: ShaderEffect = {
  kind: "shader",
  id: "prism-light",
  name: "Prism",
  description: "A white beam striking a glass prism and fanning out the far side as a rainbow through faint haze, the prism rocking so the colours sweep.",
  category: "light",
  tags: ["light", "glass", "prism", "rainbow", "spectrum", "beam", "dispersion"],
  source: glsl(
    `// Prism: a beam enters a triangular prism, crosses it and leaves as a fan of spectral colour.
uniform vec3 uBackground;    // @control color default=#040507 label="Background"
uniform vec3 uBeamColor;     // @control color default=#FFFFFF label="Beam"
uniform float uSize;         // @control min=0.1 max=0.7 default=0.36 label="Prism size"
uniform float uSpread;       // @control min=0.05 max=1 default=0.32 label="Spread"
uniform float uTilt;         // @control min=-30 max=30 default=0 label="Tilt (°)"
uniform float uWobble;       // @control min=0 max=1 default=0.4 label="Rock"
uniform float uSpeed;        // @control min=0 max=2 default=0.5 label="Speed"
uniform float uBeamAngle;    // @control min=-30 max=30 default=8 label="Beam angle (°)"
uniform float uHaze;         // @control min=0 max=1 default=0.4 label="Haze"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Brightness"`,
    HASH,
    NOISE,
    FBM,
    SPECTRUM,
    ROTATE,
    `float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// Inigo Quilez's signed distance to a triangle.
float triangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  float ang = radians(uTilt) + uWobble * 0.18 * sin(t);
  mat2 turn = rot(ang);
  float cr = uSize / 1.73205;
  vec2 top = turn * vec2(0.0, cr);
  vec2 bl = turn * vec2(-0.5 * uSize, -0.5 * cr);
  vec2 br = turn * vec2(0.5 * uSize, -0.5 * cr);
  float sd = triangle(p, top, bl, br);
  vec2 enter = mix(top, bl, 0.55);
  vec2 leave = mix(top, br, 0.58);
  float b = radians(uBeamAngle);
  vec2 dirIn = vec2(cos(b), sin(b));
  vec2 dirOut = rot(-0.42 - 1.6 * ang) * dirIn;
  float haze = uHaze * (0.5 + 0.8 * fbm(p * 3.0 + vec2(t * 0.1, 0.0), 4));
  vec3 col = uBackground;
  // The incoming beam, with its glow in the haze.
  float din = segment(p, enter - dirIn * 4.0, enter);
  col += uBeamColor * (exp(-din / 0.0025) * 0.9 + exp(-din / 0.03) * 0.35 * haze) * uGlow * step(0.0, sd + 0.002);
  // The fan: a spread of angles from where the light leaves, each its colour.
  vec2 v = p - leave;
  float fwd = dot(v, dirOut);
  float side = dirOut.x * v.y - dirOut.y * v.x;
  float x = atan(side, max(fwd, 1e-4)) / uSpread + 0.5;
  float inFan = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.94, x) * step(0.0, fwd) * step(0.0, sd);
  float fade = 1.0 / (1.0 + fwd * 1.5) * smoothstep(0.0, 0.03, fwd);
  vec3 fan = spectrum(1.0 - clamp(x, 0.0, 1.0)) * inFan * fade;
  col += fan * uGlow * (0.75 + 0.6 * haze);
  // The glass: dark and clear, the beam crossing it already spreading, edges catching the light.
  if (sd < 0.004) {
    float inside = smoothstep(1.5 * px, -1.5 * px, sd);
    vec2 w = p - enter;
    vec2 across = leave - enter;
    float k = clamp(dot(w, across) / dot(across, across), 0.0, 1.0);
    float dInt = segment(p, enter, leave);
    float spread = 0.004 + 0.02 * k;
    float sideIn = (across.x * w.y - across.y * w.x) / length(across);
    vec3 inner = mix(uBeamColor, spectrum(clamp(0.5 - sideIn / (2.0 * spread), 0.0, 1.0)), k) * exp(-dInt / spread) * 0.8;
    vec3 body = uBackground * 0.6 + vec3(0.03, 0.035, 0.045) + 0.05 * (0.5 + 0.5 * p.y / cr);
    vec3 glass = body + inner * uGlow;
    col = mix(col, glass, inside);
  }
  col += vec3(0.75, 0.8, 0.9) * exp(-abs(sd) / (1.2 * px)) * 0.5 + exp(-abs(sd) / 0.012) * 0.06 * haze;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Album cover", values: { uWobble: 0, uHaze: 0.1, uSpread: 0.28, uBeamAngle: 12 } },
    { name: "Wide rainbow", values: { uSpread: 0.75, uGlow: 1.3 } },
    { name: "Smoky room", values: { uHaze: 1, uGlow: 1.2, uSpeed: 0.3 } },
  ],
};

export const dichroicGlass: ShaderEffect = {
  kind: "shader",
  id: "dichroic-glass",
  name: "Dichroic glass",
  description:
    "Overlapping panes of dichroic glass over a picture, each tinting what is behind it a colour that shifts across the pane and with the pointer, reflecting the opposite colour at its edges.",
  category: "ui",
  video: "interactive",
  tags: ["ui", "glass", "dichroic", "iridescent", "rainbow", "interactive", "hover", "image"],
  source: glsl(
    `// Dichroic glass: rounded panes whose transmitted colour shifts with angle; where they overlap the colours multiply.
uniform sampler2D uImage;    // @control wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uPanes;          // @control min=1 max=3 default=3 label="Panes"
uniform float uSize;         // @control min=0.15 max=1 default=0.42 label="Pane size"
uniform float uStrength;     // @control min=0 max=1 default=0.75 label="Colour strength"
uniform float uShift;        // @control min=0 max=1 default=0.6 label="Colour shift"
uniform float uRefraction;   // @control min=0 max=1 default=0.3 label="Refraction"
uniform float uRim;          // @control min=0 max=1 default=0.6 label="Edge light"
uniform float uSpeed;        // @control min=0 max=2 default=0.3 label="Drift"
uniform bool uDemo;          // @control default=true label="Tilt on its own when idle"
${BACKDROP_CONTROLS}`,
    ROTATE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `float boxSdf(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 film(float phase) {
  return 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * uSpeed;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 idle = uDemo ? vec2(sin(t * 1.3), cos(t * 0.9)) * 0.4 : vec2(0.0);
  vec2 tilt = mix(idle, (iPointer.xy - 0.5 * iResolution.xy) * px * 2.0, hover);
  // First where each pane is, to bend the picture under them all at once.
  vec2 bend = vec2(0.0);
  float sds[3];
  vec2 locals[3];
  float rim = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 centre = (uPanes == 1 ? vec2(0.0) : 0.16 * vec2(cos(fi * 2.094 + 0.5), sin(fi * 2.094 + 0.5))) + 0.04 * vec2(sin(t + fi * 2.0), cos(t * 0.8 + fi));
    vec2 local = rot(0.35 * fi - 0.3 + 0.1 * sin(t * 0.5 + fi)) * (p - centre);
    vec2 hs = vec2(0.5 * uSize * (1.0 - 0.15 * fi), 0.4 * uSize);
    float sd = i < uPanes ? boxSdf(local, hs, 0.06 * uSize) : 1.0;
    sds[i] = sd;
    locals[i] = local / hs;
    float near = exp(-max(-sd, 0.0) / (0.025 * uSize)) * step(sd, 0.0);
    bend += near * normalize(local + 1e-4) * uRefraction * 0.012;
    rim = max(rim, exp(-abs(sd) / (1.2 * px)));
  }
  vec4 pic = dispersed(uImage, uv - bend * vec2(iResolution.y / iResolution.x, 1.0), bend * vec2(iResolution.y / iResolution.x, 1.0) * 2.0, 1.0);
  vec3 col = pic.rgb;
  float cover = 0.0;
  for (int i = 0; i < 3; i++) {
    float inside = clamp(0.5 - sds[i] / px, 0.0, 1.0);
    if (inside <= 0.0) continue;
    float fi = float(i);
    vec2 l = locals[i];
    float phase = fi * 0.31 + uShift * (0.35 * l.x - 0.2 * l.y) + dot(tilt, vec2(0.5, 0.3)) + 0.03 * t;
    vec3 pass = film(phase);
    vec3 through = col * mix(vec3(1.0), pass * 1.6, uStrength) + pass * 0.1 * uStrength;
    // The reflected colour (the opposite one) shows where the pane turns away: its edges and a soft band.
    float edge = exp(sds[i] / (0.04 * uSize));
    float band = exp(-pow((l.x + l.y * 0.4 - tilt.x * 0.6) * 2.5, 2.0));
    through += (1.0 - pass) * uStrength * (0.45 * edge + 0.2 * band);
    col = mix(col, through, inside);
    cover = max(cover, inside);
  }
  col += rim * uRim * 0.7;
  fragColor = vec4(col, max(pic.a, cover));
}`,
  ),
  presets: [
    { name: "Single pane", values: { uPanes: 1, uSize: 0.7 } },
    { name: "Subtle", values: { uStrength: 0.4, uShift: 0.3, uRim: 0.4 } },
    { name: "Vivid", values: { uStrength: 1, uShift: 1, uRefraction: 0.6 } },
  ],
};

/** Glass effects: glass text, a crystal ball, glass blocks, cracked glass, condensation, stained glass, a gem, a prism and dichroic panes. */
export const glassShaders: ShaderEffect[] = [
  glassText,
  glassOrb,
  glassBlocks,
  crackedGlass,
  condensationWipe,
  stainedGlass,
  imageStainedGlass,
  gemstone,
  prismLight,
  dichroicGlass,
];
