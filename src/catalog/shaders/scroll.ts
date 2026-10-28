import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * These read the scroll built-in the wrapper declares, `iScroll`: x the
 * canvas's progress through the viewport (0 as its top comes in at the
 * bottom, 1 as its bottom leaves at the top), y the page's scroll (0–1), z
 * the velocity (viewport heights a second, + down), w 1 while scrolling.
 * Where nothing scrolls (thumbnails, recordings) it is all zero, and each
 * effect plays an idle demo, a page scrolled slowly down and back up, that a
 * `uDemo` control turns off.
 */

/** `scrollDemo()`, and `scroll()`: `iScroll`, or the demo's. Needs a `uDemo` bool control. */
const SCROLL = `
bool scrollDemo() { return uDemo && dot(iScroll, iScroll) == 0.0; }
vec4 scroll() {
  if (!scrollDemo()) return iScroll;
  // Down and back up every 6 s, resting a moment at each end.
  float ph = fract(iTime / 6.0);
  float u = clamp(ph < 0.5 ? ph * 2.4 - 0.1 : (1.0 - ph) * 2.4 - 0.1, 0.0, 1.0);
  float x = u * u * (3.0 - 2.0 * u);
  float moving = u > 0.0 && u < 1.0 ? 1.0 : 0.0;
  // dx/dt in viewport heights a second (progress 0 to 1 being about two viewport heights): u moves 2.4 per 6 s.
  float v = moving * 6.0 * u * (1.0 - u) * (2.4 / 6.0) * 2.0 * (ph < 0.5 ? 1.0 : -1.0);
  return vec4(x, x, v, moving);
}`.trim();

const DEMO = `uniform bool uDemo;         // @control default=true label="Demo when not scrolled"`;

export const scrollReveal: ShaderEffect = {
  kind: "shader",
  id: "scroll-reveal",
  name: "Scroll reveal",
  description: "A picture revealed by a soft wipe, dissolve, iris or blinds as it scrolls into view, settling from a slight zoom.",
  category: "scroll",
  video: "filter",
  transparent: true,
  tags: ["interactive", "scroll", "reveal", "wipe", "dissolve", "image", "landing-page"],
  source: glsl(
    `// Scroll reveal: the picture's coverage follows how far the canvas has come into view.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uStyle;          // @control min=0 max=3 default=0 label="Style (wipe, dissolve, iris, blinds)"
uniform float uStart;        // @control min=0 max=1 default=0.1 label="Starts at"
uniform float uEnd;          // @control min=0 max=1 default=0.5 label="Done at"
uniform float uSoftness;     // @control min=0 max=0.4 default=0.12 label="Edge softness"
uniform float uZoom;         // @control min=0 max=0.3 default=0.08 label="Settle zoom"
uniform vec3 uEdge;          // @control color default=#FFFFFF label="Edge glow"
uniform float uEdgeGlow;     // @control min=0 max=1 default=0.35 label="Edge glow strength"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    HASH,
    NOISE,
    SCROLL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 s = scroll();
  float r = smoothstep(uStart, max(uEnd, uStart + 1e-3), s.x);
  // The field the reveal sweeps across, 0–1, and how far it has swept.
  float field;
  if (uStyle == 0) field = 1.0 - uv.y + 0.04 * (vnoise(vec2(uv.x * 9.0, 0.0)) - 0.5);
  else if (uStyle == 1) field = vnoise(fragCoord / iResolution.y * 18.0) * 0.6 + vnoise(fragCoord / iResolution.y * 60.0) * 0.4;
  else if (uStyle == 2) field = length((uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0)) / 0.9;
  else field = fract(uv.y * 8.0) * 0.9 + uv.y * 0.1;
  float soft = max(uSoftness, 1e-3);
  float edge = r * (1.0 + soft) - soft;
  float shown = smoothstep(edge + soft, edge, field);
  float rim = exp(-pow((field - edge - soft * 0.5) / (soft * 0.35 + 0.01), 2.0)) * (1.0 - step(0.999, r)) * step(0.001, r);
  // The picture settles from a slight zoom as it is revealed.
  vec2 at = (uv - 0.5) / (1.0 + uZoom * (1.0 - r)) + 0.5;
  vec4 pic = pictureRGBA(uImage, at);
  vec3 col = pic.rgb + uEdge * rim * uEdgeGlow;
  float alpha = pic.a * shown;
  fragColor = vec4(col, clamp(max(alpha, rim * uEdgeGlow * pic.a), 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Dissolve", values: { uStyle: 1, uSoftness: 0.2 } },
    { name: "Iris", values: { uStyle: 2, uSoftness: 0.05, uImage: SAMPLE_IMAGES.portrait } },
    { name: "Blinds", values: { uStyle: 3, uSoftness: 0.05, uEdgeGlow: 0, uImage: SAMPLE_IMAGES.city } },
  ],
};

export const parallaxLayers: ShaderEffect = {
  kind: "shader",
  id: "parallax-layers",
  name: "Parallax layers",
  description: "Layered hills under a sky, the near ones sliding further than the far ones as the page scrolls, for depth.",
  category: "scroll",
  tags: ["interactive", "scroll", "parallax", "landscape", "hills", "depth", "hero", "background"],
  source: glsl(
    `// Parallax layers: five ridgelines, each shifted by the scroll in proportion to how near it is.
uniform vec3 uSkyTop;        // @control color default=#1E3A8A label="Sky top"
uniform vec3 uSkyBottom;     // @control color default=#FDBA74 label="Sky horizon"
uniform vec3 uFar;           // @control color default=#A78BFA label="Far hills"
uniform vec3 uNear;          // @control color default=#1E1B4B label="Near hills"
uniform vec3 uSun;           // @control color default=#FFF7D6 label="Sun"
uniform float uDepth;        // @control min=0 max=1.5 default=0.6 label="Parallax depth"
uniform float uRough;        // @control min=0 max=1 default=0.5 label="Ruggedness"
uniform float uDrift;        // @control min=0 max=0.2 default=0.02 label="Drift"
${DEMO}`,
    HASH,
    NOISE,
    SCROLL,
    `float ridge(float x, float seed) {
  float h = vnoise(vec2(x * 1.3, seed)) * 0.6 + vnoise(vec2(x * 3.1, seed + 7.0)) * 0.3 * (0.5 + uRough) + vnoise(vec2(x * 8.0, seed + 3.0)) * 0.1 * uRough;
  return h;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 s = scroll();
  float shift = (s.x - 0.5) * uDepth;
  // The sky (and sun) move least: further away.
  float skyY = uv.y + shift * 0.15;
  vec3 col = mix(uSkyBottom, uSkyTop, smoothstep(0.1, 1.0, skyY));
  vec2 sun = vec2(0.68 * aspect, 0.62 - shift * 0.2);
  float d = length(vec2(uv.x * aspect, uv.y) - sun);
  col = mix(col, uSun, smoothstep(0.075, 0.07, d));
  col += uSun * exp(-d * 6.0) * 0.25;
  for (int i = 0; i < 5; i++) {
    float k = float(i) / 4.0;
    // Nearer layers sit lower, rise higher with the scroll, and drift faster.
    float base = 0.55 - 0.1 * float(i) + shift * (0.15 + 0.85 * k * k) ;
    float x = uv.x * aspect * (0.6 + 0.5 * k) + iTime * uDrift * (0.3 + k) + float(i) * 11.3;
    float top = base + ridge(x, float(i) * 5.0) * (0.18 + 0.05 * k);
    float layer = smoothstep(top + 1.5 / iResolution.y, top, uv.y);
    vec3 tint = mix(mix(uFar, uSkyBottom, 0.35), uNear, k);
    // Mist at each layer's foot.
    tint = mix(tint, uSkyBottom, 0.25 * (1.0 - k) * smoothstep(top - 0.25, top, uv.y) * 0.5);
    col = mix(col, tint, layer);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Night", values: { uSkyTop: [0.02, 0.03, 0.1], uSkyBottom: [0.15, 0.2, 0.4], uFar: [0.2, 0.25, 0.45], uNear: [0.02, 0.02, 0.06], uSun: [0.9, 0.92, 1] } },
    { name: "Forest", values: { uSkyTop: [0.55, 0.78, 0.95], uSkyBottom: [0.9, 0.95, 0.9], uFar: [0.45, 0.65, 0.55], uNear: [0.05, 0.2, 0.12], uRough: 0.9 } },
    { name: "Desert", values: { uSkyTop: [0.95, 0.55, 0.3], uSkyBottom: [1, 0.85, 0.6], uFar: [0.85, 0.55, 0.4], uNear: [0.45, 0.2, 0.12], uRough: 0.2 } },
  ],
};

export const scrollProgressGlow: ShaderEffect = {
  kind: "shader",
  id: "scroll-progress-glow",
  name: "Scroll progress glow",
  description: "A reading-progress bar along the top of the page, filling as you scroll, its glowing head flaring while you move.",
  category: "scroll",
  transparent: true,
  tags: ["interactive", "scroll", "progress", "reading", "bar", "overlay", "ui"],
  source: glsl(
    `// Scroll progress glow: a bar as long as the page's scroll, with a glow under it and a bright head.
uniform vec3 uColorA;        // @control color default=#22D3EE label="Start colour"
uniform vec3 uColorB;        // @control color default=#A855F7 label="End colour"
uniform float uHeight;       // @control min=1 max=16 default=4 label="Thickness (px)"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Glow"
uniform bool uBottom;        // @control default=false label="Along the bottom"
uniform vec3 uTrack;         // @control color default=#FFFFFF label="Track"
uniform float uTrackAlpha;   // @control min=0 max=1 default=0.08 label="Track opacity"
${DEMO}`,
    SCROLL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 s = scroll();
  float progress = clamp(s.y, 0.0, 1.0);
  float x = fragCoord.x;
  // Pixels from the bar's edge, into the page.
  float y = uBottom ? fragCoord.y : iResolution.y - fragCoord.y;
  float end = progress * iResolution.x;
  float inBar = clamp(uHeight - y + 0.5, 0.0, 1.0);
  float filled = clamp(end - x + 0.5, 0.0, 1.0);
  vec3 tint = mix(uColorA, uColorB, x / iResolution.x);
  float lit = 0.35 + 0.65 * s.w;
  // A glow spilling down from the filled part, and a flare round the head while scrolling.
  float under = filled * exp(-max(y - uHeight, 0.0) / (6.0 + 10.0 * s.w)) * 0.5 * uGlow * lit;
  float head = exp(-length(vec2(x - end, max(y - uHeight * 0.5, 0.0))) / (8.0 + 20.0 * s.w)) * uGlow * (0.4 + 0.9 * s.w) * step(0.001, progress);
  vec3 light = tint * (under + head * 1.4);
  vec4 bar = vec4(mix(uTrack, tint * (1.0 + 0.3 * s.w), filled), inBar * mix(uTrackAlpha, 1.0, filled));
  // Light over the bar, as straight colour with alpha.
  vec3 g = 1.0 - exp(-light);
  float ga = max(g.r, max(g.g, g.b));
  float alpha = bar.a + ga * (1.0 - bar.a);
  vec3 col = (bar.rgb * bar.a + g * (1.0 - bar.a)) / max(alpha, 1e-4);
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "Fire", values: { uColorA: [1, 0.8, 0.2], uColorB: [1, 0.2, 0.1], uHeight: 3 } },
    { name: "Thick, bottom", values: { uBottom: true, uHeight: 10, uGlow: 0.5, uTrackAlpha: 0.15 } },
  ],
};

export const scrollVelocityBlur: ShaderEffect = {
  kind: "shader",
  id: "scroll-velocity-blur",
  name: "Scroll velocity blur",
  description: "A picture smeared with motion blur and a colour split as fast as the page scrolls, sharp again when it stops.",
  category: "scroll",
  video: "filter",
  tags: ["interactive", "scroll", "motion-blur", "speed", "image", "chromatic"],
  source: glsl(
    `// Scroll velocity blur: samples along the scroll direction, as many viewport heights as it is moving per second.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uAmount;       // @control min=0 max=0.3 default=0.08 label="Blur per speed"
uniform float uMax;          // @control min=0.01 max=0.4 default=0.15 label="Most blur"
uniform float uSplit;        // @control min=0 max=1 default=0.4 label="Colour split"
uniform float uStretch;      // @control min=0 max=0.2 default=0.04 label="Stretch"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    SCROLL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 s = scroll();
  float v = s.z;
  float len = clamp(abs(v) * uAmount, 0.0, uMax) * sign(v);
  // A slight stretch along the scroll while moving.
  uv.y = (uv.y - 0.5) / (1.0 + uStretch * abs(len) / max(uMax, 1e-3)) + 0.5;
  vec4 acc = vec4(0.0);
  vec3 split = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float t = (float(i) + 0.5) / 16.0 - 0.5;
    float w = 1.0 - abs(t) * 1.2;
    vec4 c = pictureRGBA(uImage, uv + vec2(0.0, t * len));
    acc += c * w;
    // Red trails, blue leads: a colour split along the motion.
    split += vec3(c.r * max(-t, 0.0), 0.0, c.b * max(t, 0.0)) * w;
  }
  acc /= 6.4;
  split /= 6.4;
  vec3 col = acc.rgb + (split * 2.0 - vec3(acc.r, 0.0, acc.b) * 0.5) * uSplit * clamp(abs(len) * 10.0, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(acc.a, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Subtle", values: { uAmount: 0.03, uSplit: 0.1, uStretch: 0 } },
    { name: "Warp speed", values: { uAmount: 0.2, uMax: 0.35, uSplit: 1, uStretch: 0.15 } },
  ],
};

export const scrollZoom: ShaderEffect = {
  kind: "shader",
  id: "scroll-zoom",
  name: "Scroll zoom",
  description: "A picture zooming in (or out) and drifting as it passes through the viewport, with an optional turn and vignette.",
  category: "scroll",
  video: "filter",
  tags: ["interactive", "scroll", "zoom", "ken-burns", "image", "hero"],
  source: glsl(
    `// Scroll zoom: the picture's scale, pan and turn follow its progress through the viewport.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uFrom;         // @control min=0.5 max=3 default=1 label="Zoom entering"
uniform float uTo;           // @control min=0.5 max=3 default=1.6 label="Zoom leaving"
uniform vec2 uFocus;         // @control min=0 max=1 default=0.62,0.5 label="Zoom towards"
uniform float uPan;          // @control min=-0.3 max=0.3 default=0.06 label="Vertical drift"
uniform float uTurn;         // @control min=-30 max=30 default=0 label="Turn (degrees)"
uniform float uVignette;     // @control min=0 max=1 default=0.3 label="Vignette"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    SCROLL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 s = scroll();
  float k = s.x * s.x * (3.0 - 2.0 * s.x);
  float zoom = mix(uFrom, uTo, k);
  float a = radians(uTurn) * (k - 0.5);
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  vec2 p = (uv - uFocus) * aspect;
  p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p / zoom;
  vec2 at = p / aspect + uFocus + vec2(0.0, uPan * (k - 0.5));
  vec4 pic = pictureRGBA(uImage, at);
  float vig = 1.0 - uVignette * smoothstep(0.35, 0.95, length((uv - 0.5) * aspect) / length(aspect * 0.5));
  fragColor = vec4(pic.rgb * vig, pic.a);
}`,
  ),
  presets: [
    { name: "Zoom out", values: { uFrom: 1.8, uTo: 1 } },
    { name: "Dramatic turn", values: { uTo: 2.2, uTurn: 18, uVignette: 0.6, uImage: SAMPLE_IMAGES.city } },
  ],
};

/** The scroll category's shaders: effects that follow the page's scrolling. */
export const scrollShaders: readonly ShaderEffect[] = [scrollReveal, parallaxLayers, scrollProgressGlow, scrollVelocityBlur, scrollZoom];
