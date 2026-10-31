import { glsl, HASH, OKLAB_MIX } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";
import { PAIR_REGION, pairRegionControls, REGION, regionControls } from "./region.js";

/*
 * Beauty: retouching and make-up for a portrait or a live face, and shine
 * for a product shot. There is no face tracking: each effect works on a
 * region placed by hand (0–1 of the frame, y up), its default on the sample
 * portrait's face, and keeps to skin by its colour. Make-up is laid on in
 * Oklab, taking the shade's hue and the picture's own lightness, so pores
 * and texture show through as they do through real make-up.
 */

/** `skinLike(c)`: 0–1, how much a colour looks like skin, of any tone (its chroma in YCbCr, not too dark). */
const SKIN = `
float skinLike(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float cb = 0.5 - 0.1687 * c.r - 0.3313 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.4187 * c.g - 0.0813 * c.b;
  return smoothstep(0.53, 0.57, cr) * smoothstep(0.72, 0.68, cr) * smoothstep(0.28, 0.32, cb) * smoothstep(0.52, 0.48, cb) * smoothstep(0.06, 0.16, y);
}`.trim();

/**
 * `tintKeepLight(c, tint, k, depth)`: `c` tinted towards `tint` by `k`, taking
 * the tint's hue and colourfulness and keeping `c`'s lightness, scaled towards
 * the tint's by `depth` (needs {@link OKLAB_MIX}).
 */
const TINT = `
vec3 tintKeepLight(vec3 c, vec3 tint, float k, float depth) {
  vec3 a = toOklab(c);
  vec3 b = toOklab(tint);
  float l = mix(a.x, a.x * b.x / 0.7, depth);
  return clamp(fromOklab(mix(a, vec3(l, b.yz), k)), 0.0, 1.0);
}`.trim();

/**
 * `discBlur(fragCoord, r)`: `uImage` blurred over a disc `r` pixels across, in
 * 12 golden-angle taps from a mipmap level a quarter of the blur (needs a
 * mipmapped `uImage`, {@link HASH} and `PICTURE`).
 */
const DISC_BLUR = `
vec4 softPicture(vec2 uv, float lod) {
  return textureSize(uImage, 0).x > 1 ? overBackdrop(textureLod(uImage, uv, lod)) : vec4(testCard(fract(uv)), 1.0);
}
vec3 discBlur(vec2 fragCoord, float r) {
  vec2 ts = vec2(textureSize(uImage, 0));
  float lod = max(0.0, log2(r * max(ts.x / iResolution.x, ts.y / iResolution.y) / 4.0));
  float spin = hash12(fragCoord) * 6.28318;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float rr = sqrt((fi + 0.5) / 12.0) * r;
    float a = fi * 2.39996 + spin;
    sum += softPicture((fragCoord + rr * vec2(cos(a), sin(a))) / iResolution.xy, lod).rgb;
  }
  return sum / 12.0;
}`.trim();

/**
 * `evenSkin(fragCoord, radius, edges)`: a bilateral blur of `uImage`, 12 taps
 * on two rings each weighted by how near its colour is to the pixel's, so
 * skin evens out while the edges of eyes, brows and lips stay put.
 */
const EVEN_SKIN = `
vec3 evenSkin(vec2 fragCoord, vec3 here, float radius, float edges) {
  vec3 sum = here;
  float wsum = 1.0;
  for (int i = 0; i < 12; i++) {
    float r = radius * (i < 6 ? 0.5 : 1.0);
    float a = float(i) * 1.0472 + (i < 6 ? 0.0 : 0.5236);
    vec3 c = pictureRGBA(uImage, (fragCoord + r * vec2(cos(a), sin(a))) / iResolution.xy).rgb;
    vec3 d = c - here;
    float w = exp(-dot(d, d) / (2.0 * edges * edges));
    sum += c * w;
    wsum += w;
  }
  return sum / wsum;
}`.trim();

const LUMA = `float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;

const PORTRAIT = `uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"`;
const PORTRAIT_MIPMAP = `uniform sampler2D uImage;  // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"`;

// ── Retouch ────────────────────────────────────────────────────────────

export const beautySkinSmooth: ShaderEffect = {
  kind: "shader",
  id: "beauty-skin-smooth",
  name: "Skin smoothing",
  description: "Skin in a portrait or live video evened out, blemishes and blotches softened, while eyes, brows and lips stay sharp and some fine texture is kept.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "retouch", "skin", "smooth", "portrait", "face", "filter", "soften", "airbrush"],
  source: glsl(
    `// Skin smoothing: a bilateral blur over skin in a region, with the finest texture added back.
${PORTRAIT}
uniform float uAmount;     // @control min=0 max=1 default=0.75 label="Smoothing"
uniform float uRadius;     // @control min=1 max=24 default=8 label="Smoothing radius (px)"
uniform float uEdges;      // @control min=0.02 max=0.5 default=0.1 label="Edge protection (lower keeps more)"
uniform float uTexture;    // @control min=0 max=1 default=0.35 label="Texture kept"
uniform float uSkinOnly;   // @control min=0 max=1 default=1 label="Skin only"
${regionControls("0.5,0.6", "0.3,0.6", 1, 30, "Smooth everything but the region")}
${BACKDROP_CONTROLS}`,
    PICTURE,
    SKIN,
    REGION,
    EVEN_SKIN,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, fragCoord * px);
  float m = region(fragCoord) * mix(1.0, skinLike(pic.rgb), uSkinOnly) * uAmount;
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  vec3 even = evenSkin(fragCoord, pic.rgb, uRadius, uEdges);
  // Fine texture (pores, grain): the pixel less its nearest neighbours, added back in part.
  vec3 near = 0.25 * (pictureRGBA(uImage, (fragCoord + vec2(1.5, 0.0)) * px).rgb
    + pictureRGBA(uImage, (fragCoord - vec2(1.5, 0.0)) * px).rgb
    + pictureRGBA(uImage, (fragCoord + vec2(0.0, 1.5)) * px).rgb
    + pictureRGBA(uImage, (fragCoord - vec2(0.0, 1.5)) * px).rgb);
  vec3 col = clamp(even + (pic.rgb - near) * uTexture, 0.0, 1.0);
  fragColor = vec4(mix(pic.rgb, col, m), pic.a);
}`,
  ),
  presets: [
    { name: "Natural", values: { uAmount: 0.5, uRadius: 6, uTexture: 0.6 } },
    { name: "Airbrushed", values: { uAmount: 1, uRadius: 14, uTexture: 0.1, uEdges: 0.14 } },
    { name: "Whole frame", values: { uSize: [1, 1], uShape: 0, uFeather: 0 } },
  ],
};

export const beautyDewyGlow: ShaderEffect = {
  kind: "shader",
  id: "beauty-dewy-glow",
  name: "Dewy glow",
  description: "A soft, warm glow blooming from the highlights of skin, with a sheen on its brightest parts, for a fresh, dewy look.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "glow", "dewy", "skin", "sheen", "radiant", "portrait", "bloom", "filter"],
  source: glsl(
    `// Dewy glow: skin's highlights blurred and screened back over it, tinted warm, plus a sheen.
${PORTRAIT_MIPMAP}
uniform float uAmount;     // @control min=0 max=2 default=0.8 label="Glow"
uniform float uRadius;     // @control min=2 max=80 default=24 label="Glow size (px)"
uniform float uThreshold;  // @control min=0 max=1 default=0.5 label="Glow from (brightness)"
uniform float uSheen;      // @control min=0 max=1 default=0.25 label="Sheen"
uniform vec3 uTint;        // @control color default=#FFE2CC label="Glow colour"
uniform float uSkinOnly;   // @control min=0 max=1 default=1 label="Skin only"
${regionControls("0.5,0.6", "0.3,0.6", 1, 40, "Glow everywhere but the region")}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    SKIN,
    REGION,
    DISC_BLUR,
    LUMA,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = region(fragCoord);
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  vec3 blur = discBlur(fragCoord, uRadius);
  vec3 glow = blur * smoothstep(uThreshold, uThreshold + 0.3, luma(blur)) * mix(1.0, skinLike(blur), uSkinOnly) * uAmount;
  float sheen = uSheen * smoothstep(uThreshold - 0.1, 1.0, luma(pic.rgb)) * mix(1.0, skinLike(pic.rgb), uSkinOnly);
  // Screened over, so the glow brightens without clipping.
  vec3 col = pic.rgb + (1.0 - pic.rgb) * clamp((glow + sheen) * uTint, 0.0, 1.0) * m;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Golden hour", values: { uTint: [1, 0.78, 0.55], uAmount: 1.1, uRadius: 36 } },
    { name: "Glass skin", values: { uSheen: 0.6, uAmount: 0.5, uRadius: 12, uTint: [1, 0.97, 0.95] } },
    { name: "Subtle", values: { uAmount: 0.4, uSheen: 0.1 } },
  ],
};

export const beautySoftFocus: ShaderEffect = {
  kind: "shader",
  id: "beauty-soft-focus",
  name: "Soft focus",
  description: "A dreamy diffusion-filter look: highlights bleed softly into the picture, contrast eases and the shadows lift in a faint haze.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "soft-focus", "diffusion", "dreamy", "glow", "haze", "portrait", "filter", "pro-mist"],
  source: glsl(
    `// Soft focus: the picture's blurred highlights screened over it, a little of the blur mixed in, and a haze.
${PORTRAIT_MIPMAP}
uniform float uDiffusion;  // @control min=0 max=1 default=0.5 label="Diffusion"
uniform float uRadius;     // @control min=4 max=120 default=30 label="Spread (px)"
uniform float uThreshold;  // @control min=0 max=1 default=0.45 label="Bloom from (brightness)"
uniform float uHaze;       // @control min=0 max=0.5 default=0.08 label="Haze"
uniform vec3 uTint;        // @control color default=#FFF4EA label="Diffusion colour"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    DISC_BLUR,
    LUMA,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  vec3 blur = discBlur(fragCoord, uRadius);
  vec3 bloom = blur * smoothstep(uThreshold, 1.0, luma(blur)) * uTint;
  vec3 col = pic.rgb + (1.0 - pic.rgb) * clamp(bloom * uDiffusion * 1.5, 0.0, 1.0);
  col = mix(col, blur, uDiffusion * 0.25);
  col = col * (1.0 - uHaze) + uHaze * uTint;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Pro-Mist", values: { uDiffusion: 0.7, uRadius: 50, uHaze: 0.12 } },
    { name: "Hint", values: { uDiffusion: 0.25, uHaze: 0.03 } },
    { name: "Rosy", values: { uTint: [1, 0.86, 0.88], uDiffusion: 0.6 } },
  ],
};

export const beautyBrighten: ShaderEffect = {
  kind: "shader",
  id: "beauty-brighten",
  name: "Brighten eyes and teeth",
  description: "The whites of the eyes or a smile brightened and whitened in a region, the yellow taken out, while the skin round them is left alone.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "retouch", "eyes", "teeth", "whiten", "brighten", "smile", "portrait", "filter"],
  source: glsl(
    `// Brighten eyes and teeth: a region lifted in Oklab, its yellow and red cut, skin kept as it is.
${PORTRAIT}
uniform float uLift;       // @control min=0 max=1 default=0.35 label="Brighten"
uniform float uWhiten;     // @control min=0 max=1 default=0.6 label="Whiten (less yellow)"
uniform float uSkinGuard;  // @control min=0 max=1 default=0.7 label="Leave skin alone"
${regionControls("0.5,0.583", "0.17,0.09", 1, 10, "Brighten everything but the region")}
${BACKDROP_CONTROLS}`,
    PICTURE,
    SKIN,
    REGION,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = region(fragCoord) * mix(1.0, 1.0 - skinLike(pic.rgb), uSkinGuard);
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  vec3 lab = toOklab(pic.rgb);
  lab.x += (1.0 - lab.x) * uLift * 0.6 * m;
  // Only yellow (b > 0) and red (a > 0) are taken out, so blue or green eyes keep their colour.
  lab.y = lab.y > 0.0 ? lab.y * (1.0 - 0.4 * uWhiten * m) : lab.y;
  lab.z = lab.z > 0.0 ? lab.z * (1.0 - uWhiten * m) : lab.z;
  fragColor = vec4(clamp(fromOklab(lab), 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Eyes", values: { uCentre: [0.5, 0.583], uSize: [0.17, 0.09], uLift: 0.4, uWhiten: 0.5 } },
    { name: "Smile", values: { uCentre: [0.5, 0.475], uSize: [0.1, 0.06], uLift: 0.3, uWhiten: 0.8 } },
  ],
};

// ── Make-up ────────────────────────────────────────────────────────────

export const beautyLipTint: ShaderEffect = {
  kind: "shader",
  id: "beauty-lip-tint",
  name: "Lip tint",
  description: "Lipstick laid on lips in a region: any shade, as sheer or as deep as you like, with a wet gloss along the lower lip, the lips' texture showing through.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "makeup", "cosmetics", "lips", "lipstick", "gloss", "tint", "try-on", "portrait"],
  source: glsl(
    `// Lip tint: the shade's hue over the lips' own lightness, then a gloss on their bright parts and lower lip.
${PORTRAIT}
uniform vec3 uColour;      // @control color default=#B0123A label="Lip colour"
uniform float uAmount;     // @control min=0 max=1 default=0.75 label="Strength"
uniform float uDepth;      // @control min=0 max=1 default=0.5 label="Colour depth"
uniform float uGloss;      // @control min=0 max=1 default=0.35 label="Gloss"
uniform float uFollow;     // @control min=0 max=1 default=0.6 label="Follow the lips' colour"
${regionControls("0.5,0.478", "0.09,0.06", 1, 6, "Tint everything but the region")}
${BACKDROP_CONTROLS}`,
    PICTURE,
    SKIN,
    REGION,
    OKLAB_MIX,
    TINT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  // Lips are skin-coloured to the mask; teeth and the inside of the mouth are not, and stay bare.
  float m = region(fragCoord) * mix(1.0, skinLike(pic.rgb), uFollow) * uAmount;
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  vec3 col = tintKeepLight(pic.rgb, uColour, m, uDepth);
  // Gloss: wet make-up catches the light on its brighter parts and in a band along the lower lip.
  vec2 q = (fragCoord - uCentre * iResolution.xy) / max(0.5 * uSize * iResolution.xy, vec2(1.0));
  float band = exp(-pow((q.y + 0.35) / 0.18, 2.0)) * max(0.0, 1.0 - q.x * q.x);
  float spec = uGloss * m * (0.6 * smoothstep(0.5, 0.85, toOklab(pic.rgb).x) + 0.5 * band);
  fragColor = vec4(col + (1.0 - col) * spec, pic.a);
}`,
  ),
  presets: [
    { name: "Classic red", values: { uColour: [0.75, 0.05, 0.12], uDepth: 0.6, uGloss: 0.2 } },
    { name: "Nude matte", values: { uColour: [0.76, 0.5, 0.44], uDepth: 0.2, uGloss: 0 } },
    { name: "Berry gloss", values: { uColour: [0.5, 0.08, 0.3], uDepth: 0.7, uGloss: 0.7 } },
  ],
};

export const beautyBlush: ShaderEffect = {
  kind: "shader",
  id: "beauty-blush",
  name: "Blush",
  description: "A soft flush of colour on both cheeks, fading out at the edges, any shade, the skin's texture showing through.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "makeup", "cosmetics", "blush", "cheeks", "rosy", "flush", "try-on", "portrait"],
  source: glsl(
    `// Blush: a mirrored pair of soft ellipses on the cheeks, tinted towards the shade over skin only.
${PORTRAIT}
uniform vec3 uColour;      // @control color default=#E8647A label="Blush colour"
uniform float uAmount;     // @control min=0 max=1 default=0.45 label="Strength"
uniform float uDepth;      // @control min=0 max=1 default=0.2 label="Colour depth"
uniform float uSkinOnly;   // @control min=0 max=1 default=1 label="Skin only"
${pairRegionControls("0.5,0.525", 0.047, "0.07,0.09", 30, "Cheek")}
${BACKDROP_CONTROLS}`,
    PICTURE,
    SKIN,
    PAIR_REGION,
    OKLAB_MIX,
    TINT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = pairRegion(fragCoord) * mix(1.0, skinLike(pic.rgb), uSkinOnly) * uAmount;
  fragColor = m <= 0.0 ? pic : vec4(tintKeepLight(pic.rgb, uColour, m, uDepth), pic.a);
}`,
  ),
  presets: [
    { name: "Peach", values: { uColour: [0.98, 0.6, 0.48], uAmount: 0.4 } },
    { name: "Doll", values: { uColour: [0.96, 0.4, 0.55], uAmount: 0.6, uSize: [0.06, 0.07] } },
    { name: "Sun-kissed", values: { uColour: [0.88, 0.45, 0.35], uSpacing: 0.04, uSize: [0.13, 0.06], uCentre: [0.5, 0.55] } },
  ],
};

export const beautyEyeshadow: ShaderEffect = {
  kind: "shader",
  id: "beauty-eyeshadow",
  name: "Eyeshadow",
  description: "Two-tone eyeshadow on both lids, deepest at the lash line and outer corners and blended up to the crease, with an optional twinkling shimmer.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "makeup", "cosmetics", "eyeshadow", "eyes", "smokey", "shimmer", "try-on", "portrait"],
  loop: 4,
  source: glsl(
    `// Eyeshadow: a mirrored pair of lids, graded from the lid colour to the crease colour, with shimmer flecks.
${PORTRAIT}
uniform vec3 uLid;         // @control color default=#7B4A8C label="Lid colour"
uniform vec3 uCrease;      // @control color default=#D9A2B8 label="Crease colour"
uniform float uAmount;     // @control min=0 max=1 default=0.7 label="Strength"
uniform float uDepth;      // @control min=0 max=1 default=0.4 label="Colour depth"
uniform float uShimmer;    // @control min=0 max=1 default=0.3 label="Shimmer"
uniform float uSkinOnly;   // @control min=0 max=1 default=0.8 label="Skin only (keeps eyes and lashes bare)"
${pairRegionControls("0.5,0.606", 0.039, "0.055,0.045", 8, "Lid")}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    SKIN,
    PAIR_REGION,
    OKLAB_MIX,
    TINT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = pairRegion(fragCoord) * mix(1.0, skinLike(pic.rgb), uSkinOnly) * uAmount;
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  // Deepest at the lash line (the lid's bottom) and its outer corner, the crease colour above.
  vec2 q = pairLocal(fragCoord);
  float t = clamp(0.5 + 0.5 * q.y - 0.25 * q.x, 0.0, 1.0);
  vec3 col = tintKeepLight(pic.rgb, mix(uLid, uCrease, smoothstep(0.2, 0.9, t)), m, uDepth);
  // Shimmer: one fleck in a few, each twinkling a whole number of times a loop.
  vec2 cell = floor(fragCoord / 2.5);
  float h = hash12(cell);
  float k = 1.0 + floor(h * 4.0);
  float fleck = pow(max(0.0, sin(iTime * 1.5708 * k + h * 40.0)), 12.0) * step(0.8, hash12(cell + 7.3));
  fragColor = vec4(col + (1.0 - col) * fleck * uShimmer * m, pic.a);
}`,
  ),
  presets: [
    { name: "Smokey", values: { uLid: [0.18, 0.16, 0.2], uCrease: [0.5, 0.44, 0.46], uDepth: 0.8, uShimmer: 0.1 } },
    { name: "Golden", values: { uLid: [0.78, 0.55, 0.22], uCrease: [0.9, 0.75, 0.55], uShimmer: 0.7 } },
    { name: "Sheer pink", values: { uLid: [0.95, 0.55, 0.65], uCrease: [0.98, 0.8, 0.82], uAmount: 0.45, uDepth: 0.1 } },
  ],
};

export const beautyHighlighter: ShaderEffect = {
  kind: "shader",
  id: "beauty-highlighter",
  name: "Highlighter",
  description: "A luminous sheen on both cheekbones, its finely milled glitter twinkling as the light catches it.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "makeup", "cosmetics", "highlighter", "glow", "glitter", "shimmer", "cheekbones", "sparkle"],
  loop: 4,
  source: glsl(
    `// Highlighter: a sheen on the brighter skin of the cheekbones, plus glitter flecks twinkling on a loop.
${PORTRAIT}
uniform vec3 uColour;      // @control color default=#FFF1D6 label="Highlight colour"
uniform float uSheen;      // @control min=0 max=1 default=0.4 label="Sheen"
uniform float uGlitter;    // @control min=0 max=1 default=0.6 label="Glitter"
uniform float uGrain;      // @control min=1 max=8 default=2.5 label="Glitter size (px)"
uniform float uDensity;    // @control min=0 max=1 default=0.25 label="Glitter density"
uniform float uSkinOnly;   // @control min=0 max=1 default=1 label="Skin only"
${pairRegionControls("0.5,0.561", 0.055, "0.06,0.05", 20, "Highlight")}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    SKIN,
    PAIR_REGION,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = pairRegion(fragCoord) * mix(1.0, skinLike(pic.rgb), uSkinOnly);
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  float L = toOklab(pic.rgb).x;
  float sheen = uSheen * smoothstep(0.3, 0.9, L);
  vec2 cell = floor(fragCoord / max(uGrain, 1.0));
  float h = hash12(cell);
  float on = step(1.0 - uDensity, hash12(cell + 19.7));
  float k = 1.0 + floor(h * 4.0);
  float fleck = pow(0.5 + 0.5 * sin(iTime * 1.5708 * k + h * 6.28318), 10.0) * on;
  vec3 col = pic.rgb + (1.0 - pic.rgb) * clamp(uColour * (sheen + fleck * uGlitter * (0.4 + L)) * m, 0.0, 1.0);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Champagne", values: { uColour: [1, 0.9, 0.72], uSheen: 0.5 } },
    { name: "Rose gold", values: { uColour: [1, 0.78, 0.74], uGlitter: 0.8 } },
    { name: "Wet look", values: { uSheen: 0.8, uGlitter: 0 } },
  ],
};

// ── Beauty-ad motion ───────────────────────────────────────────────────

export const beautyRetouchReveal: ShaderEffect = {
  kind: "shader",
  id: "beauty-retouch-reveal",
  name: "Retouch reveal",
  description: "A portrait split by a sweeping divider: as it was on one side, retouched on the other, skin smoothed, glowing and warmed.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "retouch", "compare", "before-after", "reveal", "skin", "promo", "ad", "slider"],
  loop: 6,
  source: glsl(
    `// Retouch reveal: the picture left of the divider, the same picture retouched right of it.
${PORTRAIT}
uniform float uSmooth;     // @control min=0 max=1 default=0.85 label="Smoothing"
uniform float uGlow;       // @control min=0 max=1 default=0.35 label="Glow"
uniform float uWarmth;     // @control min=0 max=1 default=0.3 label="Warmth"
uniform float uSkinOnly;   // @control min=0 max=1 default=1 label="Retouch skin only"
uniform bool uSweep;       // @control default=true label="Sweep"
uniform float uSplit;      // @control min=0 max=1 default=0.5 label="Split (when still)"
uniform vec3 uLine;        // @control color default=#FFFFFF label="Divider"
uniform float uLineWidth;  // @control min=0 max=12 default=3 label="Divider width"
${BACKDROP_CONTROLS}`,
    PICTURE,
    SKIN,
    EVEN_SKIN,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float split = (uSweep ? 0.5 + 0.35 * sin(iTime * 1.0472) : uSplit) * iResolution.x;
  vec4 col = pic;
  if (fragCoord.x > split - 1.0) {
    float skin = mix(1.0, skinLike(pic.rgb), uSkinOnly);
    vec3 after = mix(pic.rgb, evenSkin(fragCoord, pic.rgb, 0.012 * iResolution.y, 0.1), uSmooth * skin);
    after += (1.0 - after) * uGlow * 0.35 * skin;
    after *= mix(vec3(1.0), vec3(1.05, 1.0, 0.93), uWarmth);
    col.rgb = mix(pic.rgb, clamp(after, 0.0, 1.0), smoothstep(-0.75, 0.75, fragCoord.x - split));
  }
  // The divider, with a small round grip half way up.
  float lw = uLineWidth * 0.001 * iResolution.y;
  float dx = abs(fragCoord.x - split);
  float line = clamp(0.5 * lw + 0.5 - dx, 0.0, 1.0);
  float R = 6.0 * lw;
  float grip = clamp(R - length(fragCoord - vec2(split, 0.5 * iResolution.y)) + 0.5, 0.0, 1.0) * step(0.5, lw);
  col.rgb = mix(col.rgb, uLine, max(line, grip));
  col.a = max(col.a, max(line, grip));
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Still", values: { uSweep: false, uSplit: 0.5 } },
    { name: "Strong", values: { uSmooth: 1, uGlow: 0.6, uWarmth: 0.5 } },
    { name: "No divider", values: { uLineWidth: 0 } },
  ],
};

export const beautyProductShine: ShaderEffect = {
  kind: "shader",
  id: "beauty-product-shine",
  name: "Product shine",
  description: "A bright glint sweeping across a product shot, then four-point sparkles twinkling on it in turn, as in a cosmetics ad.",
  category: "beauty",
  video: "filter",
  tags: ["beauty", "product", "shine", "glint", "sparkle", "packshot", "ad", "promo", "cosmetics"],
  loop: 3,
  source: glsl(
    `// Product shine: a glint band crossing the product (where the picture is opaque), then sparkles on it.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.cutout} label="Product"
uniform vec3 uGlint;       // @control color default=#FFFFFF label="Shine colour"
uniform float uStrength;   // @control min=0 max=1 default=0.7 label="Glint strength"
uniform float uWidth;      // @control min=0.02 max=0.4 default=0.1 label="Glint width"
uniform float uAngle;      // @control min=-90 max=90 default=30 label="Glint angle (°)"
uniform int uSparkles;     // @control min=0 max=8 default=4 label="Sparkles"
uniform float uSparkleSize; // @control min=4 max=80 default=26 label="Sparkle size (px)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// How opaque the product is at uv (1 with no picture, over the test card).
float product(vec2 uv) {
  return textureSize(uImage, 0).x > 1 ? texture(uImage, uv).a : 1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  float t = fract(iTime / 3.0);
  // The glint crosses the frame over the first 60% of the loop, a thin second streak trailing it.
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float span = 0.5 * (abs(dir.x) * iResolution.x / iResolution.y + abs(dir.y)) + 2.0 * uWidth;
  float d = dot(p, dir) - mix(-span, span, smoothstep(0.0, 0.6, t));
  float glint = exp(-d * d / (uWidth * uWidth)) + 0.5 * exp(-pow((d + 1.8 * uWidth) / (0.35 * uWidth), 2.0));
  vec3 col = pic.rgb + (1.0 - pic.rgb) * uGlint * clamp(glint * product(uv) * uStrength, 0.0, 1.0);
  // Sparkles on the product, each in turn: its place the first of a few tries the product covers.
  float spark = 0.0;
  float n = max(float(uSparkles), 1.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uSparkles) break;
    float fi = float(i);
    float life = sin(clamp((t - 0.15 - 0.7 * fi / n) / 0.25, 0.0, 1.0) * 3.14159);
    if (life <= 0.0) continue;
    vec2 c = vec2(-1.0);
    for (int j = 0; j < 4; j++) {
      vec2 tryAt = 0.15 + 0.7 * hash22(vec2(fi * 7.0 + float(j), 4.2));
      if (product(tryAt) > 0.5) {
        c = tryAt;
        break;
      }
    }
    if (c.x < 0.0) continue;
    vec2 q = (fragCoord - c * iResolution.xy) / (uSparkleSize * life);
    float arms = max(0.0, 1.0 - abs(q.x) * 8.0) * max(0.0, 1.0 - abs(q.y)) + max(0.0, 1.0 - abs(q.y) * 8.0) * max(0.0, 1.0 - abs(q.x));
    spark += (arms * arms + exp(-dot(q, q) * 30.0)) * life;
  }
  spark = clamp(spark, 0.0, 1.0);
  fragColor = vec4(mix(col, uGlint, spark), max(pic.a, spark));
}`,
  ),
  presets: [
    { name: "Gold", values: { uGlint: [1, 0.86, 0.55], uSparkles: 6 } },
    { name: "Glint only", values: { uSparkles: 0, uWidth: 0.16 } },
    { name: "Transparent", values: { uBackdropAlpha: 0 } },
  ],
};

/** Beauty: retouching, make-up and product shine for portraits, live faces and product shots. */
export const beautyShaders: ShaderEffect[] = [
  beautySkinSmooth,
  beautyDewyGlow,
  beautySoftFocus,
  beautyBrighten,
  beautyLipTint,
  beautyBlush,
  beautyEyeshadow,
  beautyHighlighter,
  beautyRetouchReveal,
  beautyProductShine,
];
