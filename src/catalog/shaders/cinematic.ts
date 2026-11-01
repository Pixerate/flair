import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Cinematic shaders: what a picture looks like through cinema lenses and on
 * cinema stock. An anamorphic lens's streaks and squeeze, a focus puller
 * racking between two points, bleach-bypass, Technicolor and day-for-night
 * grades, letterbox bars, an academy leader, a picture on a cinema screen, a
 * trailer title, a dolly zoom and transitions through a focus pull and a lens flare.
 * Each is tagged "cinematic".
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

/** A wide, engraved serif for trailer titles, falling back to Georgia. */
const TRAILER_FONT = "'Cinzel', 'Trajan Pro', Georgia, 'Times New Roman', serif";

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

export const technicolor: ShaderEffect = {
  kind: "shader",
  id: "technicolor",
  name: "Technicolor",
  description: "A picture printed like three-strip (or two-strip) dye-transfer film: separate colour records laid down as dyes, saturated primaries, a warm print and a slight misregistration between the records.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "grade", "colour-grade", "vintage", "saturated", "image"],
  source: glsl(
    `// Technicolor: red, green and blue records taken from slightly offset frames (misregistration), turned to cyan,
// magenta and yellow dye densities that bleed into one another (deepening the primaries) and printed back.
// Two strips keep a red-orange record and a single blue-green one.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uStrips;        // @control min=2 max=3 default=3 label="Strips (2 or 3)"
uniform float uSaturation;  // @control min=0 max=2 default=1.3 label="Saturation"
uniform float uContrast;    // @control min=0 max=1 default=0.35 label="Contrast"
uniform float uWarmth;      // @control min=0 max=1 default=0.3 label="Print warmth"
uniform float uMisregister; // @control min=0 max=8 default=1.5 label="Misregistration (px)"
uniform float uFade;        // @control min=0 max=1 default=0 label="Faded print"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = uMisregister / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 rec = vec3(picture(uImage, uv + vec2(px.x, -0.5 * px.y)).r, pic.g, picture(uImage, uv - vec2(0.7 * px.x, px.y)).b);
  if (uStrips == 2) {
    float gb = 0.5 * (rec.g + rec.b);
    rec = vec3(rec.r, gb * 0.92, gb * 1.05);
  }
  // Each dye takes a little from its neighbours, which deepens the primaries.
  vec3 dye = 1.0 - clamp(rec, 0.0, 1.0);
  dye = mat3(1.16, -0.08, -0.08, -0.08, 1.16, -0.08, -0.08, -0.08, 1.16) * dye;
  vec3 col = 1.0 - clamp(dye, 0.0, 1.0);
  col = mix(vec3(dot(col, ${LUMA})), col, uSaturation);
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col *= vec3(1.0 + 0.08 * uWarmth, 1.0 + 0.02 * uWarmth, 1.0 - 0.12 * uWarmth);
  // A faded print: its blacks lifted, its colour gone to brown and cream.
  col = mix(col, col * vec3(0.92, 0.82, 0.68) + vec3(0.08, 0.06, 0.04), uFade);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Two-strip", values: { uStrips: 2, uSaturation: 1.1, uWarmth: 0.5 } },
    { name: "Musical", values: { uSaturation: 1.7, uContrast: 0.5 } },
    { name: "Faded print", values: { uFade: 0.7, uMisregister: 3, uSaturation: 1 } },
  ],
};

export const dayForNight: ShaderEffect = {
  kind: "shader",
  id: "day-for-night",
  name: "Day for night",
  description: "A daylight picture graded into moonlit night, the way films shot night scenes by day: underexposed, drained of colour, tinted moonlight blue, with the bright sky darkened and the shadows lifted a touch.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "grade", "colour-grade", "night", "moonlight", "blue", "image"],
  source: glsl(
    `// Day for night: desaturate, dim the bright parts most (the sky gives day away), underexpose, tint towards the
// moonlight colour at the same lightness, add contrast and lift the shadows into the moonlight.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uExposure;    // @control min=0.1 max=1.5 default=0.6 label="Exposure"
uniform vec3 uMoon;         // @control color default=#6F8FD0 label="Moonlight"
uniform float uSaturation;  // @control min=0 max=1 default=0.3 label="Saturation"
uniform float uSkyDarken;   // @control min=0 max=1 default=0.55 label="Darken the sky"
uniform float uContrast;    // @control min=0 max=1 default=0.35 label="Contrast"
uniform float uLift;        // @control min=0 max=0.2 default=0.03 label="Shadow lift"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 c = clamp(pic.rgb, 0.0, 1.0);
  float l = dot(c, ${LUMA});
  vec3 col = mix(vec3(l), c, uSaturation);
  // Bright parts dimmed most, but never below darker ones, so a sun in the shot stays the brightest thing, as a moon.
  col /= 1.0 + 2.0 * uSkyDarken * l;
  col *= uExposure;
  // The moonlight's hue at the picture's lightness.
  col *= uMoon / max(dot(uMoon, ${LUMA}), 0.05);
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col += uLift * uMoon;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Deep night", values: { uExposure: 0.3, uSaturation: 0.15, uSkyDarken: 0.8 } },
    { name: "Silver moon", values: { uMoon: [0.72, 0.78, 0.86], uSaturation: 0.1 } },
    { name: "Dusk", values: { uExposure: 0.65, uSaturation: 0.5, uMoon: [0.55, 0.6, 0.85], uSkyDarken: 0.3 } },
  ],
};

export const academyLeader: ShaderEffect = {
  kind: "shader",
  id: "academy-leader",
  name: "Academy leader",
  description: "The countdown at the head of a film reel: 8 down to 3 in a ringed circle under crosshairs, a sweep going round each second, worn with dust, scratches and flicker; the 2 flashes for a frame and the screen goes black.",
  category: "cinematic",
  tags: ["cinematic", "film", "countdown", "leader", "vintage", "intro", "projector"],
  loop: 7,
  source: glsl(
    `// Academy leader: one numeral a second from 8 to 3 (each 1 s), the 2 for one frame (1/12 s), then black to 7 s.
// The sweep shades the frame clockwise from twelve o'clock over each second. Numerals are drawn from strokes.
uniform vec3 uLight;  // @control color default=#B8B8B4 label="Frame"
uniform vec3 uShade;  // @control color default=#6E6E6A label="Sweep"
uniform vec3 uInk;    // @control color default=#111111 label="Numerals and rings"
uniform float uWear;  // @control min=0 max=1 default=0.5 label="Wear (dust, scratches, flicker)"`,
    HASH,
    `float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float ring(vec2 p, vec2 c, float r) {
  return abs(length(p - c) - r);
}

// An arc of the circle (c, r) from angle a0 clockwise through sweep radians.
float arc(vec2 p, vec2 c, float r, float a0, float sweep) {
  vec2 d = p - c;
  if (mod(a0 - atan(d.y, d.x), 6.28318) <= sweep) return abs(length(d) - r);
  vec2 e0 = c + r * vec2(cos(a0), sin(a0));
  vec2 e1 = c + r * vec2(cos(a0 - sweep), sin(a0 - sweep));
  return min(length(p - e0), length(p - e1));
}

// Distance to the strokes of numeral n, in a box 1 wide and 1.6 high centred on 0.
float numeral(int n, vec2 p) {
  if (n == 8) return min(ring(p, vec2(0.0, 0.42), 0.32), ring(p, vec2(0.0, -0.36), 0.42));
  if (n == 7) return min(seg(p, vec2(-0.42, 0.78), vec2(0.42, 0.78)), seg(p, vec2(0.42, 0.78), vec2(-0.1, -0.78)));
  if (n == 6) return min(ring(p, vec2(0.0, -0.36), 0.42), seg(p, vec2(-0.41, -0.28), vec2(0.18, 0.78)));
  if (n == 5) return min(min(seg(p, vec2(-0.32, 0.78), vec2(0.4, 0.78)), seg(p, vec2(-0.32, 0.78), vec2(-0.3, 0.0))), arc(p, vec2(0.0, -0.34), 0.44, 2.29, 4.9));
  if (n == 4) return min(min(seg(p, vec2(0.2, 0.78), vec2(-0.45, -0.25)), seg(p, vec2(-0.45, -0.25), vec2(0.45, -0.25))), seg(p, vec2(0.2, 0.78), vec2(0.2, -0.78)));
  if (n == 3) return min(arc(p, vec2(0.0, 0.4), 0.36, 2.6, 4.17), arc(p, vec2(0.0, -0.36), 0.42, 1.5708, 4.17));
  return min(min(arc(p, vec2(0.0, 0.38), 0.38, 2.7, 3.3), seg(p, vec2(0.314, 0.165), vec2(-0.42, -0.78))), seg(p, vec2(-0.42, -0.78), vec2(0.44, -0.78)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float c = mod(iTime, 7.0);
  float frame = floor(iTime * 24.0);
  float px = 1.0 / iResolution.y;
  if (c >= 6.0 + 1.0 / 12.0) {
    fragColor = vec4(vec3(0.02) + (hash12(fragCoord + frame) - 0.5) * 0.03 * uWear, 1.0);
    return;
  }
  int n = c < 6.0 ? 8 - int(floor(c)) : 2;
  float second = c < 6.0 ? fract(c) : 0.0;
  // Gate weave: the whole frame jitters a little from frame to frame.
  vec2 weave = (vec2(hash12(vec2(frame, 1.0)), hash12(vec2(frame, 2.0))) - 0.5) * 0.004 * uWear;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y + weave;

  float a = atan(p.x, p.y);
  if (a < 0.0) a += 6.28318;
  vec3 col = a < second * 6.28318 ? uShade : uLight;

  float lines = min(abs(p.x), abs(p.y)) - 0.0015;
  lines = min(lines, min(ring(p, vec2(0.0), 0.36), ring(p, vec2(0.0), 0.41)) - 0.006);
  float digit = numeral(n, p / 0.2) * 0.2 - 0.013;
  float ink = 1.0 - smoothstep(-px, px, min(lines, digit));
  col = mix(col, uInk, ink);

  // Wear: flicker, grain, dust specks and a scratch or two running down the frame.
  col *= 1.0 - uWear * 0.12 * hash12(vec2(frame, 7.0));
  col += (hash12(fragCoord + frame * vec2(17.31, 31.73)) - 0.5) * 0.08 * uWear;
  vec2 cell = floor(p * 40.0);
  float speck = step(0.9985 - 0.002 * uWear, hash12(cell + frame * 3.1));
  col = mix(col, vec3(0.05), speck * smoothstep(0.03, 0.0, length(fract(p * 40.0) - 0.5) * 0.05) * uWear);
  for (int i = 0; i < 2; i++) {
    float h = hash12(vec2(frame, float(i) * 13.0));
    float x = (hash12(vec2(floor(frame / 6.0), float(i))) - 0.5) * iResolution.x / iResolution.y + (h - 0.5) * 0.01;
    col += (h > 0.5 ? 0.25 : -0.25) * uWear * (1.0 - smoothstep(0.0, 1.5 * px, abs(p.x - x))) * step(0.3, h);
  }
  // The 2 is a flash: a frame of white light behind it.
  if (n == 2) col = mix(col, vec3(1.0), 0.35);
  col *= 1.0 - 0.35 * smoothstep(0.5, 1.1, length(p * vec2(0.8, 1.0)));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Clean", values: { uWear: 0 } },
    { name: "Battered", values: { uWear: 1 } },
    { name: "Sepia", values: { uLight: [0.8, 0.7, 0.55], uShade: [0.52, 0.42, 0.3], uInk: [0.14, 0.09, 0.05] } },
  ],
};

export const cinemaProjector: ShaderEffect = {
  kind: "shader",
  id: "cinema-projector",
  name: "Cinema projector",
  description: "A picture showing on a cinema screen in a dark auditorium: it flickers and weaves in the gate, a dusty projector beam fans down onto it, its light spills onto the curtains, and a row of heads sits silhouetted in front.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "cinema", "projector", "screen", "audience", "vintage", "image"],
  source: glsl(
    `// Cinema projector: the picture cover-fitted into a screen of the chosen aspect, flickering, with a hot centre; the
// room lit by the screen's average colour; curtains either side; the beam a haze in the triangle from the
// projector (above the frame) to the screen's top edge; heads and shoulders along the bottom, rimmed by the screen.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uScreen;      // @control min=0.4 max=0.95 default=0.56 label="Screen width"
uniform float uAspect;      // @control min=1.33 max=2.4 step=0.01 default=1.85 label="Screen aspect ratio"
uniform float uBeam;        // @control min=0 max=1 default=0.55 label="Projector beam"
uniform float uDust;        // @control min=0 max=1 default=0.5 label="Dust in the beam"
uniform float uFlicker;     // @control min=0 max=1 default=0.4 label="Flicker"
uniform float uAudience;    // @control min=0 max=1 default=1 label="Audience"
uniform vec3 uRoom;         // @control color default=#0B0A0E label="Room"
uniform vec3 uCurtain;      // @control color default=#5A1420 label="Curtains"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `// The image cover-fitted to a screen of aspect uAspect, at screen point s (0–1).
vec3 onScreen(vec2 s) {
  vec2 size = vec2(textureSize(uImage, 0));
  float imageAspect = size.x > 1.0 ? size.x / size.y : uAspect;
  vec2 scale = uAspect > imageAspect ? vec2(1.0, imageAspect / uAspect) : vec2(uAspect / imageAspect, 1.0);
  return picture(uImage, 0.5 + (s - 0.5) * scale);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float frame = floor(iTime * 24.0);
  float flicker = 1.0 - uFlicker * (0.12 * hash12(vec2(frame, 3.0)) + 0.04 * sin(iTime * 47.0));
  vec2 weave = (vec2(hash12(vec2(frame, 1.0)), hash12(vec2(frame, 2.0))) - 0.5) * 0.002 * uFlicker;

  // The screen, centred a little above the middle, leaving room above it for the beam.
  vec2 size = vec2(uScreen, min(uScreen * aspect / uAspect, 0.56));
  vec2 lo = vec2(0.5, 0.55) - 0.5 * size;
  vec2 hi = lo + size;
  vec2 s = (uv - lo) / size;
  vec3 spill = (onScreen(vec2(0.5)) + onScreen(vec2(0.25, 0.3)) + onScreen(vec2(0.75, 0.3)) + onScreen(vec2(0.25, 0.7)) + onScreen(vec2(0.75, 0.7))) * 0.2 * flicker;

  vec2 q = vec2(uv.x * aspect, uv.y);
  vec2 sc = vec2(0.5 * aspect, 0.55);
  vec3 col = uRoom + spill * 0.1 * exp(-2.0 * length(q - sc));
  // Curtains either side of the screen, folded, lit by it.
  float margin = 0.03;
  float side = max(lo.x - margin - uv.x, uv.x - hi.x - margin);
  if (side > 0.0) {
    float folds = 0.55 + 0.45 * sin(uv.x * aspect * 70.0 + sin(uv.y * 3.0));
    vec3 curtain = uCurtain * folds * (0.35 + spill * 0.6) * (1.0 - smoothstep(0.0, 0.35, side) * 0.7);
    col = mix(col, curtain, smoothstep(0.0, 0.01, side));
  }
  // The picture, its edge soft by a pixel.
  vec2 edge = min(s, 1.0 - s) * size * iResolution.xy;
  float inside = clamp(min(edge.x, edge.y), 0.0, 1.0);
  vec3 shown = onScreen(s + weave) * flicker * (1.08 - 0.3 * length(s - 0.5));
  col = mix(col, shown, inside);

  // The beam: the triangle from the projector to the screen's top corners.
  vec2 src = vec2(0.5 * aspect, 1.25);
  vec2 tl = vec2(lo.x * aspect, hi.y);
  vec2 tr = vec2(hi.x * aspect, hi.y);
  vec2 d = q - src;
  float across = d.x / max(-d.y, 1e-4) / ((tr.x - src.x) / (src.y - tr.y));
  float down = clamp(-d.y / (src.y - tr.y), 0.0, 1.0);
  float inBeam = (1.0 - smoothstep(0.85, 1.0, abs(across))) * step(hi.y, q.y) * step(q.y, src.y);
  float rays = 0.6 + 0.4 * vnoise(vec2(across * 18.0, iTime * 0.3));
  float haze = fbm(q * 3.0 + vec2(iTime * 0.04, -iTime * 0.02), 4);
  vec3 beamLight = mix(vec3(1.0, 0.95, 0.85), spill * 2.0, 0.5);
  col += beamLight * inBeam * uBeam * 0.32 * rays * (0.4 + haze) * (0.5 + 0.5 * down) * flicker;
  // Dust motes catching the beam.
  vec2 g = q * 90.0 + vec2(iTime * 1.5, -iTime * 2.5);
  vec2 cell = floor(g);
  float mote = step(1.0 - 0.06 * uDust, hash12(cell)) * smoothstep(0.25, 0.0, length(fract(g) - hash22(cell)));
  col += beamLight * mote * inBeam * uDust * 0.6;

  // Heads and shoulders along the bottom, rimmed with screen light.
  float sil = 0.0;
  float rim = 0.0;
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    if (hash12(vec2(fk, 9.1)) > uAudience) continue;
    float x = ((fk + 0.5) / 7.0 + (hash12(vec2(fk, 4.2)) - 0.5) * 0.06) * aspect + sin(iTime * 0.4 + fk * 2.0) * 0.004;
    float y = 0.15 + hash12(vec2(fk, 5.3)) * 0.03;
    vec2 head = (q - vec2(x, y)) / vec2(0.055, 0.068);
    vec2 body = (q - vec2(x, -0.02)) / vec2(0.15, 0.12);
    float dh = (length(head) - 1.0) * 0.055;
    float db = (length(body) - 1.0) * 0.12;
    float dd = min(dh, db);
    sil = max(sil, 1.0 - smoothstep(-0.0015, 0.0015, dd));
    rim = max(rim, smoothstep(-0.012, 0.0, dd) * (1.0 - smoothstep(0.0, 0.0015, dd)) * smoothstep(0.0, 0.5, head.y) * step(dh, db));
  }
  col = mix(col, vec3(0.012) + spill * 0.6 * rim, sil);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Scope screen", values: { uAspect: 2.39, uScreen: 0.72 } },
    { name: "Old picture house", values: { uAspect: 1.33, uScreen: 0.5, uFlicker: 0.8, uDust: 0.9, uCurtain: [0.45, 0.1, 0.08] } },
    { name: "Empty house", values: { uAudience: 0, uBeam: 0.8 } },
  ],
};

export const trailerTitleSlam: ShaderEffect = {
  kind: "shader",
  id: "trailer-title-slam",
  name: "Trailer title slam",
  description: "A film-trailer title hit: brushed-metal letters slam down out of the dark with a flash, a shake and a burst of dust, a lens flare glints across them, they hold and fade back to black.",
  category: "cinematic",
  video: "none",
  tags: ["cinematic", "film", "trailer", "title", "metal", "flare", "impact", "text"],
  loop: 4,
  source: glsl(
    `// Trailer title slam over 4 s: the letters fall from twice their size and land at 0.35 s (flash, shake, dust),
// a glint and flare sweep across them from 0.6 s to 1.6 s, they hold, and fade to black from 3.2 s.
uniform sampler2D uText;     // @control filter=linear wrap=clamp default=${textImage("THE LONG WAY HOME", { font: TRAILER_FONT, weight: 700 })} label="Text"
uniform vec3 uBackground;    // @control color default=#050608 label="Background"
uniform vec3 uMetal;         // @control color default=#C9CED6 label="Metal"
uniform vec3 uFlare;         // @control color default=#7DB7FF label="Flare"
uniform float uSize;         // @control min=0.3 max=1 default=0.8 label="Text size"
uniform float uDust;         // @control min=0 max=1 default=0.6 label="Dust"
uniform float uShake;        // @control min=0 max=1 default=0.5 label="Shake"
uniform bool uAnimate;       // @control default=true label="Animate"
uniform float uMoment;       // @control min=0 max=4 default=1.1 label="Moment (s, when still)"`,
    HASH,
    NOISE,
    FBM,
    `// The text image's alpha at frame point p (height 1, centred), the image contained in uSize of the frame.
float letters(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float c = uAnimate ? mod(iTime, 4.0) : uMoment;
  float aspect = iResolution.x / iResolution.y;
  float age = c - 0.35;
  float hit = step(0.0, age);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  p += hit * uShake * 0.02 * exp(-age * 7.0) * vec2(sin(age * 90.0), cos(age * 77.0));
  float fall = clamp(c / 0.35, 0.0, 1.0);
  vec2 q = p / mix(2.0, 1.0, fall * fall);
  float shown = smoothstep(0.0, 0.25, c);
  float fade = 1.0 - smoothstep(3.2, 3.85, c);

  vec3 col = uBackground + fbm(p * 2.5 + vec2(iTime * 0.05, 0.0), 4) * 0.035;
  col *= 1.0 - 0.5 * smoothstep(0.4, 1.2, length(p * vec2(0.7, 1.0)));

  // Brushed metal: lighter towards the top, fine streaks across, a lit upper-left bevel and a glint passing.
  float a = letters(q) * shown;
  float e = 0.003;
  float bevel = clamp(letters(q + vec2(-e, e)) - letters(q - vec2(-e, e)), 0.0, 1.0);
  float sweep = clamp((c - 0.6) / 1.0, 0.0, 1.0);
  float gx = mix(-0.9, 0.9, sweep) * aspect * 0.5;
  float glint = exp(-pow((q.x + q.y * 0.5 - gx) * 10.0, 2.0)) * step(0.6, c) * step(c, 1.6);
  vec3 metal = uMetal * (0.35 + 0.75 * smoothstep(-0.08, 0.08, q.y)) * (0.94 + 0.06 * hash12(vec2(floor(q.x * 900.0), 0.0)));
  metal += bevel * 0.7 + glint * 0.9;
  // A faint glow of the flare colour round the letters.
  float halo = (letters(q + vec2(0.0, 0.01)) + letters(q - vec2(0.0, 0.01)) + letters(q + vec2(0.015, 0.0)) + letters(q - vec2(0.015, 0.0))) * 0.25;
  col += uFlare * halo * 0.08 * shown;
  col = mix(col, metal, a);

  // The flare: a horizontal streak and a hot core travelling with the glint.
  float flareOn = sin(3.14159 * sweep) * step(0.6, c) * step(c, 1.6);
  float streak = exp(-abs(p.y) * 70.0) * exp(-abs(p.x - gx) * 2.0);
  col += (uFlare * streak + vec3(1.0) * exp(-dot(p - vec2(gx, 0.0), p - vec2(gx, 0.0)) * 300.0)) * flareOn;

  // The landing: a flash, sparks of grit thrown up from the baseline and a puff of dust rolling out.
  if (hit > 0.0) {
    col += vec3(0.9, 0.95, 1.0) * exp(-age * 12.0) * 0.4;
    float grit = 0.0;
    for (int i = 0; i < 36; i++) {
      vec2 h = hash22(vec2(float(i), 3.1));
      vec2 at = vec2((h.x - 0.5) * uSize * aspect * 0.8, -0.04);
      vec2 vel = vec2((h.x - 0.5) * 0.7, 0.15 + h.y * 0.35);
      vec2 pos = at + vel * age + vec2(0.0, -0.3 * age * age);
      grit += smoothstep(0.004, 0.0, length(p - pos)) * exp(-age * 1.5);
    }
    float puff = fbm(p * 5.0 + vec2(0.0, -age * 0.4), 4) * exp(-age * 1.2) * exp(-abs(p.y + 0.06) * 7.0) * (1.0 - smoothstep(0.0, uSize * aspect * 0.5 + age * 0.3, abs(p.x)));
    col += uDust * (vec3(0.85, 0.8, 0.72) * grit + vec3(0.5, 0.48, 0.45) * puff * 0.5);
  }
  fragColor = vec4(mix(uBackground, col, fade), 1.0);
}`,
  ),
  presets: [
    { name: "Gold", values: { uMetal: [0.92, 0.78, 0.48], uFlare: [1, 0.72, 0.35] } },
    { name: "Blood red", values: { uMetal: [0.75, 0.14, 0.12], uFlare: [1, 0.35, 0.25], uBackground: [0.03, 0.01, 0.01] } },
    { name: "No dust", values: { uDust: 0, uShake: 0.2 } },
    { name: "Held title", values: { uAnimate: false, uMoment: 2.5 } },
  ],
};

export const transitionFlareWipe: ShaderEffect = {
  kind: "shader",
  id: "transition-flare-wipe",
  name: "Flare wipe",
  description: "An anamorphic lens flare sweeps across the frame, its streak and bloom washing over the cut, and the next picture is left behind it. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "cinematic", "flare", "lens", "anamorphic", "streak", "wipe", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Flare wipe: a light travels across at the streak height; behind it the second picture shows, the edge soft and
// hidden under the flare's bloom, which swells to its brightest mid-way. At 0 it shows the first picture exactly
// and at 1 the second.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform vec3 uColor;       // @control color default=#5FA8FF label="Streak colour"
uniform float uHeight;     // @control min=0 max=1 default=0.55 label="Streak height"
uniform float uStrength;   // @control min=0 max=2 default=1.2 label="Flare strength"
uniform float uBloom;      // @control min=0 max=1 default=0.6 label="Bloom"
uniform bool uReverse;     // @control default=false label="Right to left"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `float progress() {
  return uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  float on = sin(3.14159 * t);
  float x = uReverse ? 1.0 - uv.x : uv.x;
  float lx = mix(-0.2, 1.2, t);
  float k = smoothstep(lx + 0.1, lx - 0.1, x);
  vec4 col = mix(pictureRGBA(uFrom, uv), pictureRGBA(uTo, uv), k);
  vec2 d = vec2((x - lx) * iResolution.x / iResolution.y, uv.y - uHeight);
  float streak = exp(-abs(d.y) * 90.0) * (0.5 + 0.5 * exp(-abs(d.x) * 1.5));
  float ghosts = (exp(-abs(d.y - 0.05) * 160.0) + exp(-abs(d.y + 0.05) * 160.0)) * 0.3 * exp(-abs(d.x) * 3.0);
  float core = exp(-dot(d, d) * 80.0);
  float bloom = exp(-length(d * vec2(0.6, 1.0)) * 3.0) * uBloom;
  vec3 light = uColor * (streak + ghosts) + vec3(1.0) * core * 1.5 + mix(uColor, vec3(1.0), 0.6) * bloom;
  col.rgb = col.rgb * (1.0 + 0.5 * bloom * on * uStrength) + light * on * uStrength;
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Amber", values: { uColor: [1, 0.66, 0.3] } },
    { name: "Low and fast", values: { uHeight: 0.3, uBloom: 0.3 } },
    { name: "White out", values: { uBloom: 1, uStrength: 2 } },
  ],
};

export const dollyZoom: ShaderEffect = {
  kind: "shader",
  id: "dolly-zoom",
  name: "Dolly zoom",
  description: "The vertigo shot: the subject holds its size in the middle of the frame while the background behind it stretches towards the camera or falls away, as when a camera dollies one way and zooms the other.",
  category: "cinematic",
  video: "filter",
  tags: ["cinematic", "film", "camera", "dolly", "vertigo", "zoom", "warp", "dramatic", "image"],
  loop: 5,
  source: glsl(
    `// Dolly zoom: a picture has no depth, so the subject's distance stands in for it: inside the subject's oval
// nothing moves, and outside it the picture scales about the subject as one plane, as a background behind the
// subject would (up to 1.8 × at full stretch). It streaks along the warp while it moves. Animated, it holds,
// makes the move, holds and snaps back over 5 s.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec2 uSubject;     // @control min=0 max=1 default=0.5,0.5 label="Subject"
uniform float uSize;       // @control min=0.05 max=0.6 default=0.18 label="Subject size (share of height)"
uniform float uStretch;    // @control min=-1 max=1 default=0.7 label="Background (+ rushes in, − falls away)"
uniform float uBlur;       // @control min=0 max=1 default=0.5 label="Motion blur"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Move (when still)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `float dollyAt(float t) {
  float c = mod(t, 5.0) / 5.0;
  return smoothstep(0.1, 0.7, c) - smoothstep(0.82, 0.98, c);
}

// Where a point of the frame samples the picture \`p\` of the way through the move. Falling away starts with the
// background grown and ends with it as it is, so the frame never reaches past the picture's edges.
vec2 warp(vec2 uv, float p) {
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  vec2 d = (uv - uSubject) * aspect;
  float r = length(d);
  float behind = smoothstep(uSize, uSize * 2.4 + 0.1, r);
  float s = exp(uStretch * (p - step(uStretch, 0.0)) * behind * 0.6);
  return uSubject + d / s / aspect;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float p = uAnimate ? dollyAt(iTime) : uProgress;
  // How far the move went in the last thirtieth of a second, which the blur spreads each pixel across.
  float dp = uAnimate ? clamp((p - dollyAt(iTime - 0.033)) * uBlur * 4.0, -0.3, 0.3) : 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++) col += picture(uImage, warp(uv, p - dp * float(i) / 7.0));
  fragColor = vec4(col / 8.0, pictureRGBA(uImage, warp(uv, p)).a);
}`,
  ),
  presets: [
    { name: "Vertigo", values: { uStretch: 0.9, uBlur: 0.6 } },
    { name: "Falling away", values: { uStretch: -0.8 } },
    { name: "Unease", values: { uStretch: 0.35, uBlur: 0.2 } },
    { name: "Held", values: { uAnimate: false, uProgress: 1, uStretch: 0.7 } },
  ],
};

/** The cinematic shaders, and the transitions through a focus pull and a flare. */
export const cinematicShaders: ShaderEffect[] = [
  anamorphicLens,
  rackFocus,
  bleachBypass,
  technicolor,
  dayForNight,
  letterbox,
  academyLeader,
  cinemaProjector,
  trailerTitleSlam,
  dollyZoom,
  transitionFocusPull,
  transitionFlareWipe,
];
