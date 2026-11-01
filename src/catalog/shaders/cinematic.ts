import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Cinematic shaders: what a picture looks like through cinema lenses and on
 * cinema stock. An anamorphic lens's streaks and squeeze, a focus puller
 * racking between two points, a bleach-bypass grade, letterbox bars and a
 * transition through a focus pull. Each is tagged "cinematic".
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

/**
 * `lensBlur(tex, uv, radius, bloom, oval)`: a lens's out-of-focus blur, a disc
 * of taps `radius` high (in 0–1 of the frame's height) laid in a golden-angle
 * spiral. Bright taps weigh more, by `bloom`, so highlights open into discs
 * the way they do through a lens; `oval` narrows the disc into an anamorphic
 * lens's tall oval. Needs {@link PICTURE}.
 */
const LENS_BLUR = `
vec3 lensBlur(sampler2D tex, vec2 uv, float radius, float bloom, float oval) {
  if (radius * iResolution.y < 0.5) return picture(tex, uv);
  vec2 scale = vec2(iResolution.y / iResolution.x * (1.0 - 0.45 * oval), 1.0) * radius;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 32; i++) {
    float f = (float(i) + 0.5) / 32.0;
    float a = float(i) * 2.39996;
    vec3 c = picture(tex, uv + vec2(cos(a), sin(a)) * sqrt(f) * scale);
    float w = 1.0 + bloom * 10.0 * smoothstep(0.6, 1.0, dot(c, ${LUMA}));
    sum += c * w;
    total += w;
  }
  return sum / total;
}`.trim();

export const anamorphicLens: ShaderEffect = {
  kind: "shader",
  id: "anamorphic-lens",
  name: "Anamorphic lens",
  description: "A picture through an anamorphic cinema lens: its highlights throw long horizontal streaks and soft oval glows, and the frame bows a little towards its sides.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "lens", "anamorphic", "flare", "streak", "image"],
  source: glsl(
    `// Anamorphic lens: highlights above a threshold smeared sideways into a tinted streak, a soft oval glow round them,
// and a squeeze that bows the frame towards its sides.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uThreshold;  // @control min=0 max=1 default=0.7 label="Highlight threshold"
uniform float uStreak;     // @control min=0 max=1 default=0.5 label="Streak length"
uniform float uIntensity;  // @control min=0 max=3 default=1.2 label="Streak strength"
uniform vec3 uStreakColor; // @control color default=#4FA3FF label="Streak colour"
uniform float uGlow;       // @control min=0 max=1 default=0.35 label="Oval glow"
uniform float uSqueeze;    // @control min=0 max=1 default=0.3 label="Edge squeeze"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// The picture where it is brighter than the threshold, black elsewhere.
vec3 highlights(vec2 uv) {
  vec3 c = picture(uImage, uv);
  return c * smoothstep(uThreshold, uThreshold + 0.12, dot(c, ${LUMA}));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = fragCoord / iResolution.xy - 0.5;
  // The squeeze: across grows towards the top and bottom and shrinks at the middle, so straight verticals bow.
  c.x *= 1.0 + uSqueeze * 0.1 * (4.0 * c.y * c.y - 0.5);
  vec2 uv = c + 0.5;
  vec4 pic = pictureRGBA(uImage, uv);

  // The streak: taps out to either side, packed close in (where it is brightest) and spread further out.
  float len = 0.02 + 0.6 * uStreak;
  vec3 streak = vec3(0.0);
  for (int i = 1; i <= 24; i++) {
    float f = float(i) / 24.0;
    float x = f * f * len;
    streak += (highlights(uv + vec2(x, 0.0)) + highlights(uv - vec2(x, 0.0))) * f * exp(-3.0 * f);
  }
  streak = uStreakColor * dot(streak, vec3(0.333)) * 0.35;

  // The oval glow: a ring of taps twice as wide as it is high, in the highlights' own colour.
  vec3 glow = vec3(0.0);
  vec2 r = vec2(0.03 * iResolution.y / iResolution.x * 2.0, 0.03);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    glow += highlights(uv + vec2(cos(a), sin(a)) * r) + highlights(uv + vec2(cos(a), sin(a)) * r * 0.5);
  }
  glow *= 0.0625;

  vec3 col = pic.rgb + streak * uIntensity + glow * uGlow;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Sci-fi blue", values: { uStreakColor: [0.31, 0.64, 1], uStreak: 0.8, uIntensity: 1.8 } },
    { name: "Amber", values: { uStreakColor: [1, 0.66, 0.3], uIntensity: 1.4, uGlow: 0.5 } },
    { name: "Night city", values: { uThreshold: 0.55, uStreak: 0.65, uIntensity: 1.1 } },
    { name: "Subtle", values: { uIntensity: 0.6, uStreak: 0.3, uGlow: 0.2, uSqueeze: 0 } },
  ],
};

export const rackFocus: ShaderEffect = {
  kind: "shader",
  id: "rack-focus",
  name: "Rack focus",
  description: "A focus puller racking between two points in a picture: one sharp while the rest falls into soft lens blur with highlights opening into discs, then the focus pulls across to the other and back.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "focus", "lens", "blur", "bokeh", "depth-of-field", "image"],
  loop: 6,
  source: glsl(
    `// Rack focus: each pixel gets a depth from how near it is to the two focus points (0 at the first, 1 at the second),
// and blurs by how far that is from the depth in focus. Animated, focus holds on the first point, pulls to the
// second, holds and pulls back over 6 s.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec2 uFocusA;      // @control min=0 max=1 default=0.2,0.45 label="First focus point"
uniform vec2 uFocusB;      // @control min=0 max=1 default=0.82,0.77 label="Second focus point"
uniform float uAperture;   // @control min=0 max=0.05 default=0.018 label="Blur (share of height)"
uniform float uBloom;      // @control min=0 max=1 default=0.5 label="Bokeh highlights"
uniform float uOval;       // @control min=0 max=1 default=0 label="Bokeh shape (0 round, 1 anamorphic oval)"
uniform float uBreathing;  // @control min=0 max=0.05 default=0.012 label="Lens breathing"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0 label="Focus (when still: 0 first point, 1 second)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    LENS_BLUR,
    `float focus() {
  if (!uAnimate) return uProgress;
  float c = mod(iTime, 6.0) / 6.0;
  return smoothstep(0.2, 0.45, c) - smoothstep(0.7, 0.95, c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float f = focus();
  // A lens breathes: the picture grows a touch as focus comes nearer.
  uv = 0.5 + (uv - 0.5) / (1.0 + uBreathing * f);
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  float wa = 1.0 / (dot((uv - uFocusA) * aspect, (uv - uFocusA) * aspect) + 0.002);
  float wb = 1.0 / (dot((uv - uFocusB) * aspect, (uv - uFocusB) * aspect) + 0.002);
  float depth = wb / (wa + wb);
  float radius = uAperture * min(1.0, abs(depth - f) * 1.6);
  fragColor = vec4(lensBlur(uImage, uv, radius, uBloom, uOval), pictureRGBA(uImage, uv).a);
}`,
  ),
  presets: [
    { name: "Shallow", values: { uAperture: 0.03, uBloom: 0.7 } },
    { name: "Anamorphic", values: { uOval: 1, uAperture: 0.025, uBloom: 0.8 } },
    { name: "Gentle", values: { uAperture: 0.008, uBloom: 0.2, uBreathing: 0.005 } },
  ],
};

export const bleachBypass: ShaderEffect = {
  kind: "shader",
  id: "bleach-bypass",
  name: "Bleach bypass",
  description: "A picture graded like film that skipped the bleach: the silver left in lays a black-and-white image over the colour, draining saturation, hardening contrast and crushing the blacks to a gritty metallic look.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "grade", "colour-grade", "gritty", "desaturated", "image"],
  source: glsl(
    `// Bleach bypass: the picture's own luma overlaid on it (the retained silver), then desaturated, given an S-curve,
// its blacks crushed, tinted and grained.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uAmount;     // @control min=0 max=1 default=0.75 label="Silver retained"
uniform float uSaturation; // @control min=0 max=1.5 default=0.5 label="Saturation"
uniform float uContrast;   // @control min=0 max=1 default=0.5 label="Contrast"
uniform float uCrush;      // @control min=0 max=0.3 default=0.06 label="Crushed blacks"
uniform vec3 uTint;        // @control color default=#EEF4F2 label="Tint"
uniform float uGrain;      // @control min=0 max=0.2 default=0.04 label="Grain"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 c = clamp(pic.rgb, 0.0, 1.0);
  float l = dot(c, ${LUMA});
  // Overlay blend of the luma on the colour.
  vec3 overlay = mix(2.0 * c * l, 1.0 - 2.0 * (1.0 - c) * (1.0 - l), step(0.5, l));
  vec3 col = mix(c, overlay, uAmount);
  col = mix(vec3(dot(col, ${LUMA})), col, uSaturation);
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col = max(col - uCrush, 0.0) / (1.0 - uCrush);
  col *= uTint;
  // Grain shows most in the midtones.
  float frame = mod(floor(iTime * 24.0), 64.0);
  col += (hash12(fragCoord + frame * vec2(17.31, 31.73)) - 0.5) * uGrain * (1.0 - abs(2.0 * l - 1.0));
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "War film", values: { uAmount: 1, uSaturation: 0.3, uContrast: 0.8, uCrush: 0.1, uGrain: 0.08 } },
    { name: "Steel blue", values: { uTint: [0.82, 0.92, 1], uSaturation: 0.4 } },
    { name: "Warm bronze", values: { uTint: [1, 0.9, 0.76], uSaturation: 0.6, uAmount: 0.6 } },
    { name: "Subtle", values: { uAmount: 0.4, uSaturation: 0.75, uContrast: 0.3, uCrush: 0.02, uGrain: 0.02 } },
  ],
};

export const letterbox: ShaderEffect = {
  kind: "shader",
  id: "letterbox",
  name: "Letterbox",
  description: "Black bars that frame any picture to a cinema aspect ratio: top and bottom for a wider ratio (2.39 scope, 1.85 flat), at the sides for a narrower one (4:3). Animate slides them in and out.",
  category: "cinematic",
  tags: ["cinematic", "film", "letterbox", "aspect-ratio", "overlay", "frame"],
  transparent: true,
  loop: 5,
  source: glsl(
    `// Letterbox: bars covering the frame outside a centred opening of the chosen aspect ratio; pillarboxed (bars at the
// sides) when the ratio is narrower than the frame's. Animated, they slide in, hold and slide out over 5 s.
uniform float uAspect;     // @control min=1 max=3 step=0.01 default=2.39 label="Aspect ratio (width ÷ height)"
uniform vec3 uColor;       // @control color default=#000000 label="Bar colour"
uniform float uOpacity;    // @control min=0 max=1 default=1 label="Bar opacity"
uniform float uSoftness;   // @control min=0 max=60 default=0 label="Edge softness (px)"
uniform float uShift;      // @control min=-1 max=1 default=0 label="Opening offset (−1 low, 1 high)"
uniform bool uAnimate;     // @control default=false label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Bars in (when still)"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float c = mod(iTime, 5.0) / 5.0;
  float amount = uAnimate ? smoothstep(0.0, 0.2, c) - smoothstep(0.8, 1.0, c) : uProgress;
  vec2 size = iResolution.xy;
  // Across: x and the frame's width, for pillarbox bars at the sides; else y and its height.
  bool pillar = uAspect < size.x / size.y;
  float p = pillar ? fragCoord.x : fragCoord.y;
  float extent = pillar ? size.x : size.y;
  float opening = pillar ? size.y * uAspect : size.x / uAspect;
  float bar = max(0.0, extent - opening) * 0.5 * amount;
  // Distance inside the opening, from the nearer bar (the offset moves the opening up or right).
  float inside = min(p - bar * (1.0 + uShift), extent - bar * (1.0 - uShift) - p);
  float cover = 1.0 - smoothstep(-0.5, max(uSoftness, 1.0) - 0.5, inside);
  fragColor = vec4(uColor, cover * uOpacity);
}`,
  ),
  presets: [
    { name: "Scope 2.39", values: { uAspect: 2.39 } },
    { name: "Flat 1.85", values: { uAspect: 1.85 } },
    { name: "Academy 4:3", values: { uAspect: 1.33 } },
    { name: "Slide in", values: { uAspect: 2.39, uAnimate: true } },
  ],
};

export const transitionFocusPull: ShaderEffect = {
  kind: "shader",
  id: "transition-focus-pull",
  name: "Focus pull",
  description: "The first picture falls out of focus into soft lens blur, its highlights opening into discs, and the next one is pulled sharp out of the blur. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "cinematic", "focus", "blur", "bokeh", "lens", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Focus pull: blur grows to its widest at mid-progress while the lens breathes in, the pictures cross there,
// and blur closes again on the second. At 0 it shows the first picture exactly and at 1 the second.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uAperture;   // @control min=0.005 max=0.06 default=0.03 label="Widest blur (share of height)"
uniform float uBloom;      // @control min=0 max=1 default=0.6 label="Bokeh highlights"
uniform float uOval;       // @control min=0 max=1 default=0 label="Bokeh shape (0 round, 1 anamorphic oval)"
uniform float uBreathing;  // @control min=0 max=0.08 default=0.03 label="Lens breathing"
uniform float uBlend;      // @control min=0 max=0.5 default=0.2 label="Cross-fade width"
${BACKDROP_CONTROLS}`,
    PICTURE,
    LENS_BLUR,
    `float progress() {
  return uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  // 0 at either end, 1 at the middle: how far out of focus.
  float u = smoothstep(0.0, 1.0, 1.0 - abs(2.0 * t - 1.0));
  vec2 p = 0.5 + (uv - 0.5) / (1.0 + uBreathing * u);
  float radius = uAperture * u;
  float k = smoothstep(0.5 - 0.5 * uBlend, 0.5 + 0.5 * uBlend + 1e-4, t);
  vec4 col = vec4(0.0);
  if (k < 1.0) col += (1.0 - k) * vec4(lensBlur(uFrom, p, radius, uBloom, uOval), pictureRGBA(uFrom, p).a);
  if (k > 0.0) col += k * vec4(lensBlur(uTo, p, radius, uBloom, uOval), pictureRGBA(uTo, p).a);
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Hard cut in the blur", values: { uBlend: 0 } },
    { name: "Anamorphic", values: { uOval: 1, uBloom: 0.8 } },
    { name: "Dreamy", values: { uAperture: 0.05, uBloom: 0.9, uBlend: 0.45, uBreathing: 0.05 } },
  ],
};

/** The cinematic shaders, and the focus-pull transition. */
export const cinematicShaders: ShaderEffect[] = [anamorphicLens, rackFocus, bleachBypass, letterbox, transitionFocusPull];
