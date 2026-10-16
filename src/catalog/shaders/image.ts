import { getTransitionGLSL, type TransitionType } from "../../shader/transition.js";
import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";

/**
 * The controls {@link BACKDROP} reads: what shows through an image's
 * transparent parts. At opacity 1 an icon or cut-out (a Lucide icon, a logo)
 * sits on the backdrop colour; at 0 the effect keeps the image's alpha, for
 * overlays on a transparent canvas.
 */
export const BACKDROP_CONTROLS = `
uniform vec3 uBackdrop;          // @control color default=#FFFFFF label="Backdrop"
uniform float uBackdropAlpha;    // @control min=0 max=1 default=1 label="Backdrop opacity"`.trim();

/**
 * `overBackdrop(sample)`: an image sample laid over the backdrop (see
 * {@link BACKDROP_CONTROLS}), as straight colour and alpha.
 */
export const BACKDROP = `
// The sample is read as premultiplied: filtering a straight-alpha image whose clear pixels are
// black (as browsers decode them) premultiplies it, and the clamp clears colour a clear pixel kept.
vec4 overBackdrop(vec4 s) {
  vec3 colour = min(s.rgb, vec3(s.a)) + uBackdrop * uBackdropAlpha * (1.0 - s.a);
  float alpha = s.a + uBackdropAlpha * (1.0 - s.a);
  return vec4(colour / max(alpha, 1e-4), alpha);
}`.trim();

/**
 * `picture(tex, uv)`: the image over the backdrop (see {@link BACKDROP}), or a
 * test card while there is none (an empty image control is bound to a 1 × 1
 * placeholder), so effects show something before an image is chosen.
 * `pictureRGBA(tex, uv)` also gives its alpha, which effects pass on. Needs
 * the {@link BACKDROP_CONTROLS} uniforms.
 */
export const PICTURE = `
${BACKDROP}
vec3 testCard(vec2 uv) {
  vec3 sky = mix(vec3(0.98, 0.62, 0.42), vec3(0.24, 0.32, 0.72), uv.y);
  float sun = smoothstep(0.16, 0.15, length((uv - vec2(0.65, 0.58)) * vec2(1.6, 1.0)));
  float hills = step(uv.y, 0.32 + 0.06 * sin(uv.x * 9.0) + 0.04 * sin(uv.x * 23.0 + 1.0));
  vec3 col = mix(sky, vec3(1.0, 0.92, 0.7), sun);
  col = mix(col, vec3(0.12, 0.28, 0.24) + 0.08 * sin(uv.x * 40.0), hills);
  vec2 grid = abs(fract(uv * 8.0) - 0.5);
  col += 0.04 * step(0.48, max(grid.x, grid.y));
  return col;
}
vec4 pictureRGBA(sampler2D tex, vec2 uv) {
  return textureSize(tex, 0).x > 1 ? overBackdrop(texture(tex, uv)) : vec4(testCard(fract(uv)), 1.0);
}
vec3 picture(sampler2D tex, vec2 uv) {
  return pictureRGBA(tex, uv).rgb;
}`.trim();

export const imageRipple: ShaderEffect = {
  kind: "shader",
  id: "image-ripple",
  name: "Ripple",
  description: "An image rippling as if seen through water, from the pointer or the centre.",
  category: "image",
  video: "filter",
  tags: ["image", "water", "interactive", "distortion"],
  source: glsl(
    `// Ripple: an image rippling as if under water.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uAmplitude;  // @control min=0 max=0.05 default=0.012 label="Amplitude"
uniform float uFrequency;  // @control min=5 max=80 default=30 label="Frequency"
uniform float uSpeed;      // @control min=0 max=6 default=2 label="Speed"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 centre = (iMouse.z > 0.0 ? iMouse.xy : 0.5 * iResolution.xy) / iResolution.xy;
  vec2 d = uv - centre;
  d.x *= iResolution.x / iResolution.y;
  float r = length(d);
  float wave = sin(r * uFrequency - iTime * uSpeed) * smoothstep(0.9, 0.0, r);
  vec2 offset = normalize(d + 1e-5) * wave * uAmplitude;
  vec4 pic = pictureRGBA(uImage, uv + offset);
  vec3 col = pic.rgb + 0.6 * max(wave, 0.0) * uAmplitude * 8.0;
  fragColor = vec4(col, pic.a);
}`,
  ),
};

export const imageGlitch: ShaderEffect = {
  kind: "shader",
  id: "image-glitch",
  name: "Glitch",
  description: "Digital glitch on an image: RGB split, slice displacement and blocky corruption in bursts.",
  category: "image",
  video: "filter",
  tags: ["image", "glitch", "cyber", "transition"],
  source: glsl(
    `// Glitch: RGB split, slice displacement and blocky corruption in bursts.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uAmount;     // @control min=0 max=1 default=0.5 label="Amount"
uniform float uSplit;      // @control min=0 max=0.05 default=0.012 label="RGB split"
uniform float uRate;       // @control min=0.5 max=12 default=4 label="Bursts per second"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float tick = floor(iTime * uRate);
  float burst = step(1.0 - uAmount * 0.6, hash12(vec2(tick, 1.0)));
  float slice = floor(uv.y * mix(8.0, 40.0, hash12(vec2(tick, 2.0))));
  float shift = (hash12(vec2(slice, tick)) - 0.5) * 0.15 * burst * step(0.6, hash12(vec2(slice, tick + 3.0)));
  vec2 block = floor(uv * vec2(16.0, 9.0));
  float corrupt = burst * step(0.97 - uAmount * 0.05, hash12(block + tick));
  vec2 st = uv + vec2(shift, 0.0);
  st = mix(st, floor(st * 24.0) / 24.0, corrupt);
  float split = uSplit * (0.3 + burst);
  vec4 r = pictureRGBA(uImage, st + vec2(split, 0.0));
  vec4 g = pictureRGBA(uImage, st);
  vec4 b = pictureRGBA(uImage, st - vec2(split, 0.0));
  vec3 col = vec3(r.r, g.g, b.b);
  col = mix(col, col.bgr, corrupt);
  col *= 0.92 + 0.08 * sin(fragCoord.y * 2.0);
  fragColor = vec4(col, max(max(r.a, g.a), b.a));
}`,
  ),
};

export const imageDuotone: ShaderEffect = {
  kind: "shader",
  id: "image-duotone",
  name: "Duotone",
  description: "An image mapped onto two colours, from its shadows to its highlights. For a passing glare, lay `shine-sweep` over it.",
  category: "image",
  video: "filter",
  tags: ["image", "brand", "editorial", "colour"],
  source: glsl(
    `// Duotone: an image mapped onto two colours by its brightness.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uShadow;      // @control color default=#1E1B4B label="Shadows"
uniform vec3 uHighlight;   // @control color default=#FB7185 label="Highlights"
uniform float uContrast;   // @control min=0.5 max=3 default=1.2 label="Contrast"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 src = pictureRGBA(uImage, uv);
  float l = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  fragColor = vec4(mix(uShadow, uHighlight, l), src.a);
}`,
  ),
  presets: [
    { name: "Spotify", values: { uShadow: [0.07, 0.1, 0.35], uHighlight: [0.12, 0.84, 0.38] } },
    { name: "Newsprint", values: { uShadow: [0.1, 0.1, 0.1], uHighlight: [0.96, 0.94, 0.88] } },
  ],
};

export const imagePixelate: ShaderEffect = {
  kind: "shader",
  id: "image-pixelate",
  name: "Pixel reveal",
  description: "An image resolving from big blocks to full detail, then back, in a loop.",
  category: "image",
  video: "filter",
  tags: ["image", "reveal", "transition", "8-bit"],
  loop: 4,
  source: glsl(
    `// Pixel reveal: an image resolving from blocks to full detail and back.
uniform sampler2D uImage;  // @control filter=nearest wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uMaxBlock;   // @control min=4 max=128 default=48 label="Largest block (px)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Detail (when still)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float k = uAnimate ? 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0) : uProgress;
  float block = max(1.0, floor(mix(uMaxBlock, 1.0, k)));
  vec2 cell = (floor(fragCoord / block) + 0.5) * block;
  fragColor = pictureRGBA(uImage, cell / iResolution.xy);
}`,
  ),
};

export const imageHalftone: ShaderEffect = {
  kind: "shader",
  id: "image-halftone",
  name: "Halftone",
  description: "An image printed as rotated halftone dots, breathing slightly.",
  category: "image",
  video: "filter",
  tags: ["image", "print", "comic", "pop-art"],
  source: glsl(
    `// Halftone: an image as rotated print dots.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uInk;         // @control color default=#111827 label="Ink"
uniform vec3 uPaper;       // @control color default=#FEF3C7 label="Paper"
uniform float uSpacing;    // @control min=3 max=30 default=8 label="Dot spacing (px)"
uniform float uAngle;      // @control min=0 max=90 default=45 label="Screen angle (°)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float a = radians(uAngle);
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 q = r * fragCoord / uSpacing;
  vec2 cell = floor(q) + 0.5;
  vec2 centre = transpose(r) * cell * uSpacing;
  vec4 pic = pictureRGBA(uImage, centre / iResolution.xy);
  float l = dot(pic.rgb, vec3(0.2126, 0.7152, 0.0722));
  float radius = sqrt(1.0 - l) * 0.62 * (0.95 + 0.05 * sin(iTime * 2.0));
  float d = length(q - cell);
  float ink = smoothstep(radius + 0.06, radius - 0.06, d);
  fragColor = vec4(mix(uPaper, uInk, ink), pic.a);
}`,
  ),
};

export const crt: ShaderEffect = {
  kind: "shader",
  id: "crt",
  name: "CRT screen",
  description: "An image on a curved CRT: scanlines, shadow mask, bloom and flicker.",
  category: "image",
  video: "filter",
  tags: ["image", "retro", "screen", "arcade"],
  source: glsl(
    `// CRT screen: an image on a curved tube with scanlines and a shadow mask.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uCurve;       // @control min=0 max=0.5 default=0.15 label="Curvature"
uniform float uScanlines;   // @control min=0 max=1 default=0.5 label="Scanlines"
uniform float uMask;        // @control min=0 max=1 default=0.35 label="Shadow mask"
uniform float uFlicker;     // @control min=0 max=0.2 default=0.03 label="Flicker"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy * 2.0 - 1.0;
  uv *= 1.0 + uCurve * dot(uv.yx, uv.yx) * 0.5;
  vec2 st = uv * 0.5 + 0.5;
  if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, uBackdropAlpha);
    return;
  }
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb;
  col += 0.25 * picture(uImage, st + vec2(0.003, 0.0)) * col;
  float scan = 1.0 - uScanlines * 0.5 * (1.0 - cos(st.y * iResolution.y * 3.14159));
  float m = mod(fragCoord.x, 3.0);
  vec3 mask = mix(vec3(1.0), vec3(m < 1.0 ? 1.2 : 0.8, m >= 1.0 && m < 2.0 ? 1.2 : 0.8, m >= 2.0 ? 1.2 : 0.8), uMask);
  col *= scan * mask;
  col *= 1.0 - uFlicker * hash12(vec2(floor(iTime * 24.0), 0.0));
  col *= smoothstep(1.0, 0.7, max(abs(uv.x), abs(uv.y)) * 0.98 + 0.02 * length(uv));
  fragColor = vec4(col, pic.a);
}`,
  ),
};

export const filmGrain: ShaderEffect = {
  kind: "shader",
  id: "film-look",
  name: "Film look",
  description: "An image graded like film: grain, gate weave, halation and vignette.",
  category: "image",
  video: "filter",
  tags: ["image", "cinematic", "grain", "vintage"],
  source: glsl(
    `// Film look: grain, gate weave, halation and vignette.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uGrain;       // @control min=0 max=0.3 default=0.08 label="Grain"
uniform float uWeave;       // @control min=0 max=0.01 default=0.0015 label="Gate weave"
uniform float uHalation;    // @control min=0 max=1 default=0.3 label="Halation"
uniform float uVignette;    // @control min=0 max=1 default=0.45 label="Vignette"
uniform vec3 uTint;         // @control color default=#FFF1DC label="Print tint"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float frame = floor(iTime * 24.0);
  uv += uWeave * (vec2(vnoise(vec2(frame * 0.3, 0.0)), vnoise(vec2(0.0, frame * 0.3))) - 0.5);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb;
  vec3 blur = (picture(uImage, uv + vec2(0.006, 0.0)) + picture(uImage, uv - vec2(0.006, 0.0)) +
               picture(uImage, uv + vec2(0.0, 0.006)) + picture(uImage, uv - vec2(0.0, 0.006))) * 0.25;
  float bright = smoothstep(0.6, 1.0, dot(blur, vec3(0.333)));
  col += vec3(1.0, 0.3, 0.1) * bright * uHalation * 0.5;
  col *= uTint;
  col += (hash12(fragCoord + frame * 31.7) - 0.5) * uGrain;
  col *= 1.0 - uVignette * smoothstep(0.3, 0.9, length(uv - 0.5) * 1.3);
  fragColor = vec4(col, pic.a);
}`,
  ),
};

const TRANSITIONS: { type: TransitionType; id: string; name: string; description: string }[] = [
  { type: "linearWipe", id: "wipe", name: "Wipe", description: "A soft-edged wipe from one image to the next." },
  { type: "radialIris", id: "iris", name: "Iris", description: "A circle opening from the centre onto the next image." },
  { type: "blockDissolve", id: "block-dissolve", name: "Block dissolve", description: "Random blocks switching to the next image." },
  { type: "gridWipe", id: "grid-wipe", name: "Grid wipe", description: "A diagonal cascade of cells revealing the next image." },
  { type: "glassWipe", id: "glass-wipe", name: "Glass wipe", description: "A refracting glass edge sweeping across." },
  { type: "twister", id: "twister", name: "Twister", description: "A swirl that twists one image into the next." },
  { type: "lightLeak", id: "light-leak", name: "Light leak", description: "A warm flare of light burning through to the next image." },
  { type: "crossZoom", id: "cross-zoom", name: "Cross zoom", description: "A zoom blur punching through to the next image." },
];

/** The transitions (see `getTransitionGLSL`) as looping effects between two images. */
export const transitions: ShaderEffect[] = TRANSITIONS.map(({ type, id, name, description }) => ({
  kind: "shader",
  id: `transition-${id}`,
  name,
  description: `${description} Loops back and forth; or turn Animate off and set Progress.`,
  category: "transition",
  video: "transition",
  tags: ["transition", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// ${name} transition between two images. Progress runs 0 → 1 → 0 when animated.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    BACKDROP,
    getTransitionGLSL(type),
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float p = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  fragColor = overBackdrop(flair_transition(uFrom, uTo, uv, p));
}`,
  ),
}));
