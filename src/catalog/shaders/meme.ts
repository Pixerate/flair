import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Memes: the picture treatments and reactions internet video reaches for (a
 * deep-fried photo, a crash zoom onto a face, laser eyes, a freeze frame that
 * says it is to be continued). Each is tagged "meme", and named after the
 * trope rather than any one meme, character or show.
 *
 * Points on the picture (eyes, a zoom target) are 0–1 across the frame, y up;
 * their defaults sit on the sample portrait's face. Nothing flashes the whole
 * frame: glints pulse, kicks are small and decay fast.
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

/** Where the sample portrait's eyes are, 0–1 across the frame, y up. */
const EYE_A = "0.461,0.583";
const EYE_B = "0.539,0.583";

/**
 * `glint(p, c, size, turn)`: a four-pointed star glint at `c` (y-units): a hot
 * core and two thin streaks, one turned `turn` radians from horizontal.
 */
const GLINT = `
float glint(vec2 p, vec2 c, float size, float turn) {
  vec2 d = p - c;
  float cs = cos(turn);
  float sn = sin(turn);
  d = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / size;
  float core = exp(-dot(d, d) * 40.0);
  float streaks = exp(-abs(d.y) * 60.0) * exp(-abs(d.x) * 2.2) + exp(-abs(d.x) * 60.0) * exp(-abs(d.y) * 2.2);
  return core + 0.7 * streaks;
}`.trim();

/**
 * `words(tuv)` and `inkBox()` for text from a `uText` image control: the words' coverage at a point
 * of the text image, and where its ink sits (so a sign or banner fits the words, not the image).
 */
const INK = `
// The words' coverage at tuv, 0–1 across the text image, and nothing outside it. It samples
// everywhere (clamped) so the mip level, from neighbouring pixels, stays sound at the image's edges.
float words(vec2 tuv) {
  float a = texture(uText, clamp(tuv, 0.0, 1.0)).a;
  return all(greaterThanEqual(tuv, vec2(0.0))) && all(lessThanEqual(tuv, vec2(1.0))) ? a : 0.0;
}

// Where the words' ink is in the text image, as (left, right, bottom, top) in its 0–1 uv, or zeros
// when there is none. A text image is mostly empty around its words (textImage fits short words to
// its height and long ones to its width), so the sign sizes the ink, not the image. Every pixel reads
// the same few texels from small mip levels, stopping at the first ink from each side.
vec4 inkBox() {
  // In from each side to the first ink, across the middle (at mip 4 the letters blur into a band).
  float x0 = 1.0;
  float x1 = 0.0;
  for (int i = 0; i < 32; i++) {
    float u = (float(i) + 0.5) / 32.0;
    if (textureLod(uText, vec2(u, 0.5), 4.0).a > 0.04) {
      x0 = u;
      break;
    }
  }
  for (int i = 31; i >= 0; i--) {
    float u = (float(i) + 0.5) / 32.0;
    if (textureLod(uText, vec2(u, 0.5), 4.0).a > 0.04) {
      x1 = u;
      break;
    }
  }
  if (x1 < x0) return vec4(0.0);
  // Down from the top and up from the bottom to the first row with ink, at mip 3, checking three columns.
  float y0 = 1.0;
  float y1 = 0.0;
  for (int j = 31; j >= 0; j--) {
    float v = (float(j) + 0.5) / 32.0;
    float a = 0.0;
    for (int k = 0; k < 3; k++) a = max(a, textureLod(uText, vec2(mix(x0, x1, (float(k) + 0.5) / 3.0), v), 3.0).a);
    if (a > 0.2) {
      y1 = v;
      break;
    }
  }
  for (int j = 0; j < 32; j++) {
    float v = (float(j) + 0.5) / 32.0;
    float a = 0.0;
    for (int k = 0; k < 3; k++) a = max(a, textureLod(uText, vec2(mix(x0, x1, (float(k) + 0.5) / 3.0), v), 3.0).a);
    if (a > 0.2) {
      y0 = v;
      break;
    }
  }
  return y1 > y0 ? vec4(x0, x1, y0, y1) : vec4(0.0);
}

// The text image's uv at p (y-units from where the words are centred), sizing the ink h tall and no
// wider than maxW.
vec2 inkUV(vec2 p, vec4 ink, float h, float maxW) {
  vec2 tsize = vec2(textureSize(uText, 0));
  float th = h / max(ink.w - ink.z, 1e-3);
  float tw = th * tsize.x / max(tsize.y, 1.0);
  float inkW = (ink.y - ink.x) * tw;
  float fit = inkW > maxW ? maxW / inkW : 1.0;
  return vec2((ink.x + ink.y) * 0.5 + p.x / (tw * fit), (ink.z + ink.w) * 0.5 + p.y / (th * fit));
}`.trim();

export const deepFried: ShaderEffect = {
  kind: "shader",
  id: "deep-fried",
  name: "Deep fried",
  description:
    "A picture fried to a crisp: saturation and contrast blown out, posterised colour, oversharpened halos, JPEG blocking and grain, with red glints flaring from two points such as the eyes.",
  category: "meme",
  video: "stills",
  tags: ["meme", "treatment", "image", "deep-fried", "jpeg", "saturated", "glint", "lens-flare"],
  source: glsl(
    `// Deep fried: blown-out colour, posterising, oversharpening, JPEG blocks, grain and glints at two points.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uFry;        // @control min=0 max=1 default=0.8 label="Fry"
uniform float uBlocks;     // @control min=0 max=1 default=0.5 label="JPEG blocks"
uniform float uGrain;      // @control min=0 max=0.3 default=0.1 label="Grain"
uniform float uGlint;      // @control min=0 max=2 default=1 label="Glints"
uniform vec3 uGlintColor;  // @control color default=#FF2A12 label="Glint colour"
uniform vec2 uGlintA;      // @control min=0 max=1 default=${EYE_A} label="Glint A"
uniform vec2 uGlintB;      // @control min=0 max=1 default=${EYE_B} label="Glint B"
uniform float uGlintSize;  // @control min=0.05 max=0.6 default=0.22 label="Glint size"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    GLINT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 texel = 1.0 / iResolution.xy;
  // JPEG blocking: each 8 × 8 block pulled towards the colour at its middle.
  vec2 block = (floor(fragCoord / 8.0) * 8.0 + 4.0) / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = mix(pic.rgb, picture(uImage, block), uBlocks * uFry * 0.45);
  // Oversharpening: an unsharp mask pushed far enough to ring.
  vec3 blur = 0.25 * (picture(uImage, uv + vec2(2.0, 0.0) * texel) + picture(uImage, uv - vec2(2.0, 0.0) * texel)
    + picture(uImage, uv + vec2(0.0, 2.0) * texel) + picture(uImage, uv - vec2(0.0, 2.0) * texel));
  col += (col - blur) * uFry * 3.0;
  // Blown-out saturation and contrast, pushed warm.
  float l = dot(col, ${LUMA});
  col = mix(vec3(l), col, 1.0 + uFry * 2.2);
  col = (col - 0.5) * (1.0 + uFry * 1.6) + 0.5;
  col *= mix(vec3(1.0), vec3(1.18, 1.0, 0.72), uFry);
  // Posterised to fewer levels the more it fries.
  float levels = mix(48.0, 5.0, uFry);
  col = floor(clamp(col, 0.0, 1.0) * levels + 0.5) / levels;
  // Grain, reshuffled twelve times a second.
  float seed = floor(iTime * 12.0);
  col += (hash12(fragCoord + seed * 17.0) - 0.5) * uGrain * 2.0;
  // Glints at the two points, pulsing a little.
  float aspect = iResolution.x / iResolution.y;
  vec2 p = uv * vec2(aspect, 1.0);
  float size = uGlintSize * (1.0 + 0.12 * sin(iTime * 5.0));
  float g = glint(p, uGlintA * vec2(aspect, 1.0), size, 0.35) + glint(p, uGlintB * vec2(aspect, 1.0), size, -0.35);
  g *= uGlint;
  col += uGlintColor * g * 1.6 + vec3(1.0) * pow(g, 2.0) * 0.6;
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, clamp(g, 0.0, 1.0)));
}`,
  ),
  presets: [
    { name: "Extra crispy", values: { uFry: 1, uBlocks: 1, uGrain: 0.2, uGlint: 1.6 } },
    { name: "Lightly toasted", values: { uFry: 0.4, uBlocks: 0.2, uGrain: 0.05, uGlint: 0.6 } },
    { name: "No glints", values: { uGlint: 0 } },
  ],
};

export const dramaticZoom: ShaderEffect = {
  kind: "shader",
  id: "dramatic-zoom",
  name: "Dramatic zoom",
  description:
    "A crash zoom onto a point (a face, a stare, a detail) in a few sudden steps, each landing with a kick while a vignette closes in, then a hold and a snap back to the whole picture.",
  category: "meme",
  video: "stills",
  tags: ["meme", "reaction", "image", "zoom", "crash-zoom", "dramatic", "shake", "vignette"],
  source: glsl(
    `// Dramatic zoom: a few sudden zoom steps onto a point, each with a kick, then a hold and a snap back.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uTarget;      // @control min=0 max=1 default=0.5,0.583 label="Zoom onto"
uniform float uZoom;       // @control min=1.2 max=8 default=3.4 label="Zoom"
uniform int uSteps;        // @control min=1 max=4 default=3 label="Steps"
uniform float uStepTime;   // @control min=0.15 max=1.5 default=0.4 label="Seconds per step"
uniform float uHold;       // @control min=0.3 max=5 default=1.6 label="Hold (s)"
uniform float uShake;      // @control min=0 max=1 default=0.5 label="Kick"
uniform float uVignette;   // @control min=0 max=1 default=0.65 label="Vignette"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `const float REST = 0.7; // Seconds on the whole picture before the first step.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float steps = float(uSteps);
  float cycle = REST + steps * uStepTime + uHold;
  float t = mod(iTime, cycle) - REST;
  // How far through the steps it is (0 to 1), each step a fast ease that overshoots a touch.
  float level = 0.0;
  float age = 99.0;
  if (t >= 0.0) {
    float k = min(floor(t / uStepTime), steps - 1.0);
    age = t - k * uStepTime;
    float e = clamp(age / 0.09, 0.0, 1.0);
    e = 1.0 + 2.7 * pow(e - 1.0, 3.0) + 1.7 * pow(e - 1.0, 2.0);
    level = (k + e) / steps;
  }
  float z = pow(uZoom, level);
  // Centre the target as the zoom grows, so at full zoom it sits in the middle.
  vec2 c = uTarget + (vec2(0.5) - uTarget) / z;
  vec2 st = c + (uv - 0.5) / z;
  // A kick as each step lands: a jolt that rings down fast.
  float kick = uShake * exp(-age * 16.0) * step(0.0, t);
  st += kick * 0.03 / z * vec2(sin(age * 90.0), cos(age * 70.0 + 1.0));
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb;
  // The vignette closes in and the contrast rises with each step.
  float aspect = iResolution.x / iResolution.y;
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col *= 1.0 - uVignette * level * smoothstep(0.25, 0.95, r);
  col = mix(col, (col - 0.5) * 1.25 + 0.5, level * 0.6);
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "One crash", values: { uSteps: 1, uZoom: 4, uStepTime: 0.5, uHold: 2 } },
    { name: "Slow dread", values: { uSteps: 4, uZoom: 2.6, uStepTime: 0.9, uShake: 0.15 } },
    { name: "Extreme close-up", values: { uZoom: 7, uVignette: 0.9, uShake: 0.8 } },
  ],
};

export const laserEyes: ShaderEffect = {
  kind: "shader",
  id: "laser-eyes",
  name: "Laser eyes",
  description:
    "Laser beams firing from two eyes over a picture: a white-hot core in a red glow, flaring at each eye and flickering, aimed at any angle and spread, with the picture darkened behind them.",
  category: "meme",
  video: "stills",
  tags: ["meme", "reaction", "image", "laser", "eyes", "glow", "beam", "lens-flare"],
  source: glsl(
    `// Laser eyes: flickering beams with a hot core and glow from two eye points.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uEyeA;        // @control min=0 max=1 default=${EYE_A} label="Left eye"
uniform vec2 uEyeB;        // @control min=0 max=1 default=${EYE_B} label="Right eye"
uniform vec3 uColor;       // @control color default=#FF1E1E label="Beam"
uniform float uAngle;      // @control min=-180 max=180 default=-15 label="Angle (degrees)"
uniform float uSpread;     // @control min=0 max=120 default=0 label="Spread (degrees)"
uniform float uLength;     // @control min=0 max=2 default=1.4 label="Length"
uniform float uWidth;      // @control min=0.002 max=0.05 default=0.012 label="Width"
uniform float uFlare;      // @control min=0 max=2 default=1 label="Eye flare"
uniform float uDarken;     // @control min=0 max=1 default=0.35 label="Darken picture"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    GLINT,
    `// Light of one beam from eye e (y-units) heading at angle a (radians), and its flare.
float beam(vec2 p, vec2 e, float a, float flicker) {
  vec2 dir = vec2(cos(a), sin(a));
  vec2 d = p - e;
  float along = dot(d, dir);
  float across = dot(d, vec2(-dir.y, dir.x));
  float w = uWidth * (1.0 + along * 0.8) * flicker;
  float on = step(0.0, along) * smoothstep(uLength, uLength * 0.75, along);
  float core = exp(-pow(across / (w * 0.35), 2.0));
  float glow = exp(-abs(across) / (w * 2.5));
  return on * (core * 1.4 + glow * 0.6);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = uv * vec2(aspect, 1.0);
  vec2 eA = uEyeA * vec2(aspect, 1.0);
  vec2 eB = uEyeB * vec2(aspect, 1.0);
  float a = radians(uAngle);
  float halfSpread = radians(uSpread) * 0.5;
  // The left eye's beam turns one way by half the spread, the right eye's the other.
  float flick = 0.85 + 0.15 * hash12(vec2(floor(iTime * 20.0), 3.0));
  float light = beam(p, eA, a + halfSpread * sign(eA.x - eB.x + 1e-4), flick) + beam(p, eB, a - halfSpread * sign(eA.x - eB.x + 1e-4), flick);
  float size = 0.09 * uFlare * flick;
  float flare = uFlare > 0.0 ? glint(p, eA, size, a) + glint(p, eB, size, a) : 0.0;
  light += flare;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb * (1.0 - uDarken);
  col = mix(col, col * uColor * 1.6, uDarken * 0.4);
  // The glow in the beam's colour, burning to white where it is brightest.
  col += uColor * light;
  col += vec3(1.0) * smoothstep(0.8, 2.0, light);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, clamp(light, 0.0, 1.0)));
}`,
  ),
  presets: [
    { name: "Straight ahead", values: { uAngle: -90, uLength: 0.6, uWidth: 0.02 } },
    { name: "Fanned out", values: { uAngle: -90, uSpread: 100, uLength: 2 } },
    { name: "Glowing eyes", values: { uLength: 0, uFlare: 2, uDarken: 0.5 } },
    { name: "Blue", values: { uColor: [0.2, 0.6, 1] } },
  ],
};

export const toBeContinued: ShaderEffect = {
  kind: "shader",
  id: "to-be-continued",
  name: "To be continued",
  description:
    "A picture that freezes on a sudden sepia grade with a little punch-in, then a left-pointing arrow slides in at the bottom with its words on it, holds, and it starts over.",
  category: "meme",
  video: "stills",
  tags: ["meme", "ending", "image", "freeze-frame", "sepia", "arrow", "cliffhanger"],
  source: glsl(
    `// To be continued: a sudden sepia freeze with a punch-in, then an arrow sign sliding in with its words.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform sampler2D uText;   // @control filter=mipmap wrap=clamp default=${textImage("TO BE CONTINUED")} label="Text"
uniform vec3 uTint;        // @control color default=#C8A060 label="Freeze tint"
uniform vec3 uArrow;       // @control color default=#3A3820 label="Arrow"
uniform vec3 uInk;         // @control color default=#F0DFA0 label="Words and border"
uniform float uPlay;       // @control min=0.2 max=6 default=1.4 label="Before the freeze (s)"
uniform float uHold;       // @control min=0.5 max=8 default=2.6 label="Hold (s)"
uniform float uSize;       // @control min=0.06 max=0.2 default=0.11 label="Arrow size"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    INK,
    `float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// The arrow's signed distance, its tip at the origin pointing left; len is the body's far end.
float arrowDist(vec2 p, float h, float len) {
  float hw = h * 0.85;
  float hh = h * 0.8;
  vec2 q = vec2(p.x, abs(p.y));
  float head = max(dot(q, normalize(vec2(-hh, hw))), p.x - hw);
  float body = sdBox(p - vec2((hw * 0.7 + len) * 0.5, 0.0), vec2((len - hw * 0.7) * 0.5, h * 0.5));
  return min(head, body);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = mod(iTime, uPlay + uHold);
  float frozen = step(uPlay, t);
  float since = t - uPlay;
  // The freeze: a quick punch-in and a sepia grade with a vignette.
  float punch = frozen * (1.0 + 0.04 * (1.0 - exp(-since * 10.0)));
  vec4 pic = pictureRGBA(uImage, 0.5 + (uv - 0.5) / max(punch, 1.0));
  vec3 col = pic.rgb;
  float l = dot(col, ${LUMA});
  vec3 sepia = clamp(uTint * l * 1.5, 0.0, 1.0);
  float aspect = iResolution.x / iResolution.y;
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  sepia *= 1.0 - 0.45 * smoothstep(0.3, 1.0, r);
  sepia += (hash12(fragCoord + floor(iTime * 12.0)) - 0.5) * 0.04;
  col = mix(col, sepia, frozen * smoothstep(0.0, 0.12, since));
  float shown = frozen * step(0.25, since);
  float h = uSize;
  vec2 p = uv * vec2(aspect, 1.0) - vec2(0.0, 0.06 + h);
  // Only the band the sign and its shadow cross, once it is showing, needs it measured.
  if (shown < 0.5 || abs(p.y) > h * 1.2) {
    fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
    return;
  }
  // The arrow: its words' capitals half its height, the body as long as they need (and no longer than fits).
  vec4 ink = inkBox();
  vec2 tsize = vec2(textureSize(uText, 0));
  float inkH = max(ink.w - ink.z, 1e-3);
  float th = h * 0.5 / inkH;
  float tw = th * tsize.x / max(tsize.y, 1.0);
  float textX = h * 0.95;
  float room = aspect - 0.1 - textX - h * 0.4;
  float inkW = (ink.y - ink.x) * tw;
  float fitScale = inkW > room ? room / inkW : 1.0;
  th *= fitScale;
  tw *= fitScale;
  float len = textX + (ink.y > ink.x ? (ink.y - ink.x) * tw : h * 1.5) + h * 0.4;
  float slide = clamp((since - 0.25) / 0.45, 0.0, 1.0);
  slide = 1.0 + 2.2 * pow(slide - 1.0, 3.0) + 1.2 * pow(slide - 1.0, 2.0);
  p.x -= 0.05 - (1.0 - slide) * (len + 0.1);
  float d = arrowDist(p, h, len);
  float px = 1.0 / iResolution.y;
  float border = h * 0.08;
  float outer = smoothstep(px, -px, d);
  float inner = smoothstep(px, -px, d + border);
  vec3 board = mix(uInk, uArrow, inner);
  // The ink's left edge at textX, its middle on the arrow's midline.
  vec2 tuv = vec2(ink.x + (p.x - textX) / tw, (ink.z + ink.w) * 0.5 + p.y / th);
  board = mix(board, uInk, words(tuv) * inner);
  // A soft drop shadow under the sign.
  float shadow = smoothstep(h * 0.25, 0.0, arrowDist(p - vec2(h * 0.08, -h * 0.1), h, len)) * 0.5;
  col *= 1.0 - shadow * (1.0 - outer);
  col = mix(col, board, outer);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, max(outer, shadow)));
}`,
  ),
  presets: [
    { name: "Coming soon", values: { uText: textImage("COMING SOON") } },
    { name: "Black and white", values: { uTint: [0.85, 0.85, 0.85], uArrow: [0.08, 0.08, 0.08], uInk: [1, 1, 1] } },
    { name: "Quick cut", values: { uPlay: 0.6, uHold: 1.8 } },
  ],
};

/** A serif face for banners: the old-style capitals of a game's ending screen. */
const SERIF = "Georgia, 'Times New Roman', Times, serif";

export const needsMoreJpeg: ShaderEffect = {
  kind: "shader",
  id: "needs-more-jpeg",
  name: "Needs more JPEG",
  description:
    "A picture saved again and again at lower quality: 8 × 8 blocks, smeared blocky colour and mosquito noise around its edges grow with each step down, then it snaps back clean and starts over.",
  category: "meme",
  video: "filter",
  tags: ["meme", "treatment", "image", "jpeg", "compression", "artifacts", "low-quality", "blocks"],
  source: glsl(
    `// Needs more JPEG: each step recompresses harder (blocks, chroma bleed, mosquito noise), then it snaps back clean.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uCrunch;     // @control min=0.1 max=1 default=0.85 label="Worst quality"
uniform int uSteps;        // @control min=1 max=8 default=5 label="Steps"
uniform float uStepTime;   // @control min=0.15 max=2 default=0.6 label="Seconds per step"
uniform float uHold;       // @control min=0.2 max=5 default=1.2 label="Hold (s)"
uniform float uBlock;      // @control min=4 max=32 default=8 label="Block size (px)"
uniform float uChroma;     // @control min=0 max=1 default=0.7 label="Chroma bleed"
uniform float uMosquito;   // @control min=0 max=1 default=0.6 label="Mosquito noise"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `const float REST = 0.8; // Seconds clean before the first step.

// YCbCr (BT.601), the space JPEG quantises in, and back.
vec3 toYCC(vec3 c) {
  return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.1687, -0.3313, 0.5)), dot(c, vec3(0.5, -0.4187, -0.0813)));
}
vec3 fromYCC(vec3 c) {
  return vec3(c.x + 1.402 * c.z, c.x - 0.3441 * c.y - 0.7141 * c.z, c.x + 1.772 * c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float steps = float(uSteps);
  float t = mod(iTime, REST + steps * uStepTime + uHold) - REST;
  // How bad it is now: a step worse each step, up to the worst quality, and clean again after the hold.
  float q = t < 0.0 ? 0.0 : min(floor(t / uStepTime) + 1.0, steps) / steps * uCrunch;
  vec4 pic = pictureRGBA(uImage, uv);
  if (q <= 0.0) {
    fragColor = pic;
    return;
  }
  // Each block keeps only its low frequencies: a patch through four samples at its quarter points,
  // flattening to its mean as the quality drops. The patches don't meet, so the block edges show.
  float b = uBlock;
  vec2 cell = floor(fragCoord / b);
  vec2 f = fract(fragCoord / b);
  vec2 org = cell * b;
  vec3 s00 = picture(uImage, (org + b * vec2(0.25, 0.25)) / iResolution.xy);
  vec3 s10 = picture(uImage, (org + b * vec2(0.75, 0.25)) / iResolution.xy);
  vec3 s01 = picture(uImage, (org + b * vec2(0.25, 0.75)) / iResolution.xy);
  vec3 s11 = picture(uImage, (org + b * vec2(0.75, 0.75)) / iResolution.xy);
  vec2 w = (f - 0.25) * 2.0;
  vec3 bilin = mix(mix(s00, s10, w.x), mix(s01, s11, w.x), w.y);
  vec3 mean = 0.25 * (s00 + s10 + s01 + s11);
  vec3 low = mix(bilin, mean, smoothstep(0.5, 1.0, q) * 0.75);
  vec3 ycc = toYCC(clamp(mix(pic.rgb, low, smoothstep(0.0, 0.4, q)), 0.0, 1.0));
  float levels = mix(48.0, 7.0, q);
  ycc.x = floor(ycc.x * levels + 0.5) / levels;
  // Chroma bleed: colour kept for blocks twice the size, smeared right, and quantised harder.
  float cb = b * 2.0;
  vec2 ccell = floor((fragCoord - vec2(uChroma * q * b * 1.5, 0.0)) / cb);
  vec2 chroma = toYCC(picture(uImage, (ccell * cb + cb * 0.5) / iResolution.xy)).yz;
  vec2 cbcr = mix(ycc.yz, chroma, uChroma * smoothstep(0.1, 0.6, q));
  float clevels = mix(64.0, 6.0, q * uChroma);
  cbcr = floor(cbcr * clevels + 0.5) / clevels * (1.0 + 0.35 * q);
  // Mosquito noise: a ripple in a cosine pattern, like the coefficients a coarse quantiser leaves,
  // in blocks with an edge in them. Each step has its own patterns.
  vec4 lum = vec4(toYCC(s00).x, toYCC(s10).x, toYCC(s01).x, toYCC(s11).x);
  float edge = max(max(lum.x, lum.y), max(lum.z, lum.w)) - min(min(lum.x, lum.y), min(lum.z, lum.w));
  vec2 h = hash22(cell + floor(q * 16.0) * 13.0);
  vec2 freq = floor(2.0 + h * 5.0);
  float basis = cos(3.14159 * freq.x * f.x) * cos(3.14159 * freq.y * f.y);
  ycc.x += basis * edge * uMosquito * q * 0.45;
  cbcr += basis * edge * uMosquito * q * 0.12 * (h - 0.5);
  fragColor = vec4(clamp(fromYCC(vec3(ycc.x, cbcr)), 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "One bad save", values: { uSteps: 1, uCrunch: 0.6, uStepTime: 1.5, uHold: 1.5 } },
    { name: "Potato quality", values: { uCrunch: 1, uBlock: 16, uChroma: 1, uMosquito: 1 } },
    { name: "Slow decline", values: { uSteps: 8, uStepTime: 0.9, uHold: 2 } },
  ],
};

export const triggered: ShaderEffect = {
  kind: "shader",
  id: "triggered",
  name: "Triggered",
  description:
    "A picture tinted red and jittering fast in place, with a banner bar along the bottom carrying its word; the jitter is capped and nothing flashes.",
  category: "meme",
  video: "stills",
  tags: ["meme", "reaction", "image", "shake", "jitter", "red", "angry", "banner"],
  source: glsl(
    `// Triggered: a red-tinted picture on screen-shake's jitter, stepped fast and capped, with a banner bar at the bottom.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform sampler2D uText;    // @control filter=mipmap wrap=clamp default=${textImage("TRIGGERED")} label="Text"
uniform vec3 uTint;         // @control color default=#FF1A1A label="Tint"
uniform float uRed;         // @control min=0 max=1 default=0.6 label="Red tint"
uniform float uShake;       // @control min=0 max=1 default=0.7 label="Jitter"
uniform float uRate;        // @control min=4 max=30 default=20 label="Jolts a second"
uniform vec3 uBar;          // @control color default=#FFFFFF label="Banner"
uniform vec3 uInk;          // @control color default=#111111 label="Words"
uniform float uBarHeight;   // @control min=0.08 max=0.3 default=0.17 label="Banner height"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    INK,
    `const float MAX_SHIFT = 0.02; // The furthest the picture jolts, as a share of the frame's height.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  // Screen shake's jitter and twist, from smooth noise, but a fresh jolt uRate times a second.
  float s = floor(iTime * uRate) * 2.3;
  vec2 jitter = vec2(vnoise(vec2(s, 1.0)), vnoise(vec2(s + 17.0, 5.0))) * 2.0 - 1.0;
  float twist = vnoise(vec2(s * 0.8 + 41.0, 3.0)) * 2.0 - 1.0;
  float amount = clamp(uShake, 0.0, 1.0);
  // Shake about the centre, zoomed in just enough that the edges stay filled.
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float ang = twist * amount * 0.02;
  q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * q;
  q = q / (1.0 + 2.5 * MAX_SHIFT * amount) + jitter * amount * MAX_SHIFT;
  vec4 pic = pictureRGBA(uImage, q / vec2(aspect, 1.0) + 0.5);
  vec3 col = pic.rgb;
  // The red tint keeps the picture's light and shade.
  float l = dot(col, ${LUMA});
  col = mix(col, uTint * (0.2 + l * 1.3), uRed);
  col = (col - 0.5) * (1.0 + 0.3 * uRed) + 0.5;
  // The banner jolts half as far as the picture.
  vec2 shift = jitter * amount * MAX_SHIFT * 0.5;
  float y = uv.y - shift.y;
  float px = 1.0 / iResolution.y;
  float bar = smoothstep(uBarHeight + px, uBarHeight - px, y);
  if (bar > 0.0) {
    vec4 ink = inkBox();
    vec2 p = vec2((uv.x - 0.5) * aspect - shift.x, y - uBarHeight * 0.5);
    float w = ink.y > ink.x ? words(inkUV(p, ink, uBarHeight * 0.55, aspect * 0.9)) : 0.0;
    col = mix(col, mix(uBar, uInk, w), bar);
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, bar));
}`,
  ),
  presets: [
    { name: "Red banner", values: { uBar: [0.75, 0.04, 0.04], uInk: [1, 1, 1] } },
    { name: "Simmering", values: { uShake: 0.3, uRate: 10, uRed: 0.4 } },
    { name: "Furious", values: { uShake: 1, uRate: 30, uRed: 0.85 } },
    { name: "Custom word", values: { uText: textImage("SALTY") } },
  ],
};

export const vaporwaveGrade: ShaderEffect = {
  kind: "shader",
  id: "vaporwave-grade",
  name: "Vaporwave grade",
  description:
    "A picture regraded pink and cyan, with soft scanlines and a split of its colours, a striped sun setting over a moving grid in the lower third, and a strip of glyphs along the top.",
  category: "meme",
  video: "filter",
  tags: ["meme", "aesthetic", "image", "vaporwave", "retro", "80s", "grade", "scanlines", "sun", "grid"],
  source: glsl(
    `// Vaporwave grade: a pink and cyan regrade, scanlines, a colour split, a striped sun over a grid, and glyphs.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform sampler2D uText;    // @control filter=mipmap wrap=clamp default=${textImage("エステティック")} label="Glyphs"
uniform bool uGlyphs;       // @control default=true label="Glyph strip"
uniform vec3 uPink;         // @control color default=#FF6AD5 label="Pink"
uniform vec3 uCyan;         // @control color default=#26E8FF label="Cyan"
uniform float uGrade;       // @control min=0 max=1 default=0.8 label="Regrade"
uniform float uScanlines;   // @control min=0 max=1 default=0.35 label="Scanlines"
uniform float uSplit;       // @control min=0 max=0.02 default=0.005 label="Colour split"
uniform float uBand;        // @control min=0 max=1 default=1 label="Sun and grid"
uniform float uHorizon;     // @control min=0.1 max=0.5 default=0.3 label="Horizon"
uniform float uSunX;        // @control min=0 max=1 default=0.78 label="Sun across"
uniform float uSpeed;       // @control min=0 max=2 default=1 label="Grid speed"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    INK,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  // The colour split: red and blue pulled apart sideways.
  vec2 off = vec2(uSplit, 0.0);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = vec3(picture(uImage, uv + off).r, pic.g, picture(uImage, uv - off).b);
  // The regrade, split toned: shadows to a deep violet and cyan, light tones to pink.
  float l = dot(col, ${LUMA});
  vec3 shadow = uCyan * 0.3 + vec3(0.1, 0.0, 0.2);
  vec3 graded = mix(shadow, mix(uCyan, uPink, 0.5), smoothstep(0.0, 0.45, l));
  graded = mix(graded, mix(uPink, vec3(1.0), 0.3), smoothstep(0.45, 1.0, l));
  col = mix(col, mix(col, graded, 0.8), uGrade);
  // Soft scanlines, about 3 px apart.
  col *= 1.0 - uScanlines * 0.3 * (0.5 + 0.5 * sin(fragCoord.y * 2.0944));
  float cover = 0.0;
  if (uBand > 0.0) {
    vec2 p = vec2(uv.x * aspect, uv.y);
    // The sun: a disc half set on the horizon, yellow fading to pink, its lower half cut by stripes
    // that thicken towards the horizon and drift down, with a glow around it.
    vec2 sc = vec2(uSunX * aspect, uHorizon);
    float R = 0.2;
    float r = length(p - sc);
    float k = (p.y - uHorizon) / R;
    float disc = smoothstep(R + px, R - px, r) * step(0.0, k);
    float gap = k < 0.55 ? step(fract(k * 8.0 + iTime * 0.25), (0.55 - k) * 1.1) : 0.0;
    vec3 sun = mix(uPink, vec3(1.0, 0.86, 0.42), smoothstep(0.0, 1.0, k));
    float sunA = disc * (1.0 - gap) * uBand;
    col += uPink * exp(-max(r - R, 0.0) * 14.0) * 0.3 * step(uHorizon, p.y) * (1.0 - disc) * uBand;
    col = mix(col, sun, sunA);
    cover = sunA;
    // The grid: a dark floor below the horizon, its lines in perspective and rolling towards us, a haze where it meets the sky.
    float d = uHorizon - uv.y;
    if (d > 0.0) {
      float z = 0.5 / d;
      vec2 g = vec2((uv.x - uSunX) * aspect * z * 5.0, z + iTime * uSpeed);
      vec2 gw = fwidth(g);
      vec2 gl = smoothstep(gw * 1.5, vec2(0.0), 0.5 - abs(fract(g) - 0.5));
      float line = max(gl.x, gl.y) * smoothstep(0.0, 0.1, d);
      vec3 floorCol = mix(vec3(0.07, 0.01, 0.13), uPink * 0.5, exp(-d * 30.0));
      floorCol += uCyan * line;
      float a = uBand * smoothstep(0.0, 0.012, d) * 0.92;
      col = mix(col, floorCol, a);
      cover = max(cover, a);
    }
  }
  // The glyph strip along the top: the words twice, in pink and cyan, either side of white.
  float top = 1.0 - 0.04 - 0.05;
  if (uGlyphs && abs(uv.y - top) < 0.05) {
    vec4 ink = inkBox();
    if (ink.y > ink.x) {
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - top);
      vec2 o = vec2(0.004, 0.0);
      float a = words(inkUV(p + o, ink, 0.05, aspect * 0.6));
      float b = words(inkUV(p - o, ink, 0.05, aspect * 0.6));
      float c = words(inkUV(p, ink, 0.05, aspect * 0.6));
      float back = smoothstep(0.05, 0.04, abs(uv.y - top)) * 0.45;
      col *= 1.0 - back;
      col = mix(col, uPink, a * 0.9);
      col = mix(col, uCyan, b * 0.9);
      col = mix(col, vec3(1.0), c);
      cover = max(cover, max(max(back, a), max(b, c)));
    }
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, cover));
}`,
  ),
  presets: [
    { name: "Grade only", values: { uBand: 0, uGlyphs: false } },
    { name: "Centred sun", values: { uSunX: 0.5, uHorizon: 0.25 } },
    { name: "Mint and lilac", values: { uPink: [0.75, 0.55, 1], uCyan: [0.55, 1, 0.8] } },
    { name: "Heavy tape", values: { uScanlines: 1, uSplit: 0.015 } },
  ],
};

export const galaxyBrain: ShaderEffect = {
  kind: "shader",
  id: "galaxy-brain",
  name: "Galaxy brain",
  description:
    "Cosmic light radiating from a head that climbs through four levels of enlightenment: a soft halo, then rays, then a nebula full of stars, then a starburst over the whole picture, before it settles and starts again.",
  category: "meme",
  video: "stills",
  tags: ["meme", "reaction", "image", "galaxy", "cosmic", "glow", "rays", "stars", "enlightened"],
  source: glsl(
    `// Galaxy brain: a glow from a head point climbing through levels: halo, rays, nebula and stars, starburst.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uHead;        // @control min=0 max=1 default=0.5,0.78 label="Head"
uniform int uLevel;        // @control min=1 max=4 default=4 label="Highest level"
uniform float uStepTime;   // @control min=0.4 max=4 default=1.4 label="Seconds per level"
uniform float uHold;       // @control min=0.5 max=6 default=2 label="Hold (s)"
uniform float uSize;       // @control min=0.1 max=1 default=0.3 label="Glow size"
uniform vec3 uGlow;        // @control color default=#8FE3FF label="Glow"
uniform vec3 uNebula;      // @control color default=#B054FF label="Nebula"
uniform float uDarken;     // @control min=0 max=1 default=0.5 label="Darken picture"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `const float REST = 0.6; // Seconds on the plain picture before the first level.

// Twinkling stars on a grid of cells, n per y-unit.
float stars(vec2 p, float n) {
  vec2 cell = floor(p * n);
  vec2 h = hash22(cell);
  vec2 d = fract(p * n) - (0.2 + 0.6 * h);
  float on = step(0.82, h.x);
  float twinkle = 0.6 + 0.4 * sin(iTime * (1.0 + 2.0 * h.y) + h.x * 40.0);
  return on * twinkle * exp(-dot(d, d) * 260.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float levels = float(uLevel);
  float cycle = REST + levels * uStepTime + uHold;
  float t = mod(iTime, cycle) - REST;
  // The level, 0 to uLevel: each one eases in over half a second, and it all fades out at the end.
  float L = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uLevel) break;
    L += smoothstep(0.0, 0.5, t - float(i) * uStepTime);
  }
  L *= smoothstep(cycle - REST, cycle - REST - 0.6, t);
  float w1 = clamp(L, 0.0, 1.0);
  float w2 = clamp(L - 1.0, 0.0, 1.0);
  float w3 = clamp(L - 2.0, 0.0, 1.0);
  float w4 = clamp(L - 3.0, 0.0, 1.0);
  vec2 p = uv * vec2(aspect, 1.0);
  vec2 d = p - uHead * vec2(aspect, 1.0);
  float r = length(d);
  float a = atan(d.y, d.x);
  float S = uSize * (1.0 + 0.5 * max(L - 1.0, 0.0));
  // Level 1: a soft halo.
  float halo = exp(-r / (S * 0.25)) * 0.6 + exp(-r / S) * 0.25;
  // Level 2: rays turning slowly, two sets.
  float rays = pow(0.5 + 0.5 * cos(a * 12.0 + iTime * 0.4), 6.0) + 0.6 * pow(0.5 + 0.5 * cos(a * 7.0 - iTime * 0.25 + 1.0), 10.0);
  rays *= exp(-r / (S * 1.3)) * smoothstep(0.0, S * 0.2, r);
  // Level 3: a nebula swirling round the head, with stars in it.
  vec3 light = uGlow * (halo * w1 + rays * w2 * 0.5);
  if (w3 > 0.0) {
    // Only where it is bright enough to see is the noise worked out.
    float fade = exp(-r / (uSize * 2.0));
    if (fade > 0.06) {
      float sw = r * 2.5 - iTime * 0.08;
      vec2 q = mat2(cos(sw), sin(sw), -sin(sw), cos(sw)) * d;
      float n = fbm(q * 3.0 + 4.0, 2);
      float neb = smoothstep(0.3, 0.75, n) * fade;
      light += mix(uNebula, uGlow, smoothstep(0.45, 0.8, n)) * neb * w3 * 0.9;
    }
    float reach = mix(exp(-r / (S * 2.0)), 1.0, w4);
    light += vec3(stars(p, 26.0) + stars(p + 3.7, 41.0) * 0.7) * reach * w3;
  }
  // Level 4: a starburst over everything and a white-hot core.
  if (w4 > 0.0) {
    float burst = pow(0.5 + 0.5 * cos(a * 36.0 + sin(a * 5.0) * 2.0 - iTime * 0.15), 24.0) / (1.0 + r * 2.5);
    light += (vec3(1.0) * burst * 0.45 + mix(uGlow, vec3(1.0), 0.6) * exp(-r / (S * 0.1)) * 1.1) * w4;
  }
  vec4 pic = pictureRGBA(uImage, uv);
  // The picture sinks into a violet dark as the levels rise.
  float dark = uDarken * L / 4.0;
  vec3 col = mix(pic.rgb, pic.rgb * mix(vec3(1.0), uNebula * 0.5 + 0.25, 0.7), dark) * (1.0 - dark * 0.6);
  col += light;
  float cover = clamp(max(max(halo * w1, rays * w2), w3 * 0.4), 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, cover));
}`,
  ),
  presets: [
    { name: "Just a halo", values: { uLevel: 1, uHold: 3 } },
    { name: "Quick ascent", values: { uStepTime: 0.6, uHold: 1.5 } },
    { name: "Golden", values: { uGlow: [1, 0.85, 0.45], uNebula: [1, 0.45, 0.2] } },
    { name: "Big brain", values: { uSize: 0.6, uDarken: 0.8 } },
  ],
};

export const sadMode: ShaderEffect = {
  kind: "shader",
  id: "sad-mode",
  name: "Sad mode",
  description:
    "A picture drained to a cool blue-grey with rain streaking down over it, the camera slowly pulling back and a heavy vignette closing in.",
  category: "meme",
  video: "stills",
  tags: ["meme", "mood", "image", "sad", "rain", "blue", "desaturate", "vignette", "melancholy"],
  source: glsl(
    `// Sad mode: a cool blue-grey drain, rain streaks, a slow push-out and a heavy vignette.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uTint;        // @control color default=#7C8FA8 label="Mood"
uniform float uDrain;      // @control min=0 max=1 default=0.85 label="Drain"
uniform float uRain;       // @control min=0 max=1 default=0.6 label="Rain"
uniform float uAngle;      // @control min=-30 max=30 default=10 label="Rain angle (degrees)"
uniform float uPush;       // @control min=0 max=0.4 default=0.15 label="Push out"
uniform float uPushTime;   // @control min=2 max=20 default=8 label="Push time (s)"
uniform float uVignette;   // @control min=0 max=1 default=0.75 label="Vignette"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `const float HOLD = 2.0;  // Seconds it rests pulled back.
const float BACK = 1.2; // Seconds it takes to ease back in to the start.

// One layer of rain: streaks in n columns per y-unit, len long (0–1 of their fall), falling at speed.
float rain(vec2 p, float n, float len, float speed, float seed) {
  float c = floor(p.x * n);
  float h = hash12(vec2(c, seed));
  float y = fract(p.y * 0.5 + iTime * speed * (0.8 + 0.4 * h) + h * 7.0);
  float x = abs(fract(p.x * n) - 0.5 - (h - 0.5) * 0.6);
  float streak = smoothstep(0.0, len * 0.3, y) * smoothstep(len, len * 0.4, y);
  return step(0.35, h) * streak * smoothstep(0.08, 0.0, x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  // The push-out, eased from close in to the whole picture; after the hold it eases back in to the start.
  float cycle = uPushTime + HOLD + BACK;
  float t = mod(iTime, cycle);
  float pulled = smoothstep(0.0, uPushTime, t) - smoothstep(cycle - BACK, cycle, t);
  vec4 pic = pictureRGBA(uImage, 0.5 + (uv - 0.5) / (1.0 + uPush * (1.0 - pulled)));
  vec3 col = pic.rgb;
  // Drained to the mood's blue-grey, the contrast flattened and the blacks lifted a little.
  float l = dot(col, ${LUMA});
  vec3 cool = uTint * (l / max(dot(uTint, ${LUMA}), 0.05));
  col = mix(col, mix(vec3(l), cool, 0.75), uDrain);
  col = mix(col, col * 0.82 + uTint * 0.06, uDrain);
  // Rain: a near layer of long streaks and a far layer of short faint ones, slanted.
  vec2 p = uv * vec2(aspect, 1.0);
  float ang = radians(uAngle);
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  float drops = rain(p, 26.0, 0.35, 1.6, 1.0) + rain(p + 0.37, 55.0, 0.2, 1.1, 2.0) * 0.5;
  col += vec3(0.78, 0.84, 0.95) * drops * uRain * 0.35;
  // A heavy vignette.
  float r = length((uv - 0.5) * vec2(aspect, 1.0));
  col *= 1.0 - uVignette * 0.85 * smoothstep(0.2, 0.95, r);
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Downpour", values: { uRain: 1, uAngle: 20 } },
    { name: "Dry tears", values: { uRain: 0 } },
    { name: "Sepia sorrow", values: { uTint: [0.66, 0.58, 0.48] } },
    { name: "Still", values: { uPush: 0 } },
  ],
};

export const gameOverBanner: ShaderEffect = {
  kind: "shader",
  id: "game-over-banner",
  name: "Game over banner",
  description:
    "A picture that slows to stuttering frames and drains to grey, then a dark band fades in across it with big serif words on it, growing a little as it holds, before it starts over.",
  category: "meme",
  video: "stills",
  tags: ["meme", "ending", "image", "game-over", "banner", "serif", "slow-motion", "desaturate", "game"],
  source: glsl(
    `// Game over banner: stuttering slow motion, a drain to grey, then serif words fading in on a dark band.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform sampler2D uText;   // @control filter=mipmap wrap=clamp default=${textImage("GAME OVER", { font: SERIF, weight: 400 })} label="Text"
uniform vec3 uInk;         // @control color default=#C0201A label="Words"
uniform vec3 uBand;        // @control color default=#000000 label="Band"
uniform float uPlay;       // @control min=0.3 max=6 default=1.5 label="Before it ends (s)"
uniform float uStutter;    // @control min=2 max=15 default=6 label="Stutter frames a second"
uniform float uFade;       // @control min=0.3 max=4 default=1.4 label="Fade (s)"
uniform float uHold;       // @control min=0.5 max=8 default=3 label="Hold (s)"
uniform float uSize;       // @control min=0.06 max=0.25 default=0.12 label="Words height"
${BACKDROP_CONTROLS}`,
    PICTURE,
    INK,
    `// A soft glow of the words: their coverage blurred, from a small mip level.
float wordsGlow(vec2 tuv) {
  return all(greaterThanEqual(tuv, vec2(-0.1))) && all(lessThanEqual(tuv, vec2(1.1))) ? textureLod(uText, clamp(tuv, 0.0, 1.0), 4.0).a : 0.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float t = mod(iTime, uPlay + uFade + uHold);
  float since = max(t - uPlay, 0.0);
  float over = step(uPlay, t);
  // The picture drifts in; once it ends, time slows to a third and steps at the stutter rate.
  float m = t < uPlay ? t : uPlay + floor(since * uStutter) / uStutter / 3.0;
  float z = 1.0 + 0.03 * m;
  vec2 st = 0.5 + (uv - 0.5) / z + vec2(0.006, -0.004) * m;
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb;
  // Drained to a dark grey.
  float g = over * smoothstep(0.0, uFade * 0.6, since);
  float l = dot(col, ${LUMA});
  col = mix(col, vec3(l) * 0.7, g);
  // The band fades in across the middle, soft at its edges, then the words on it.
  float b = over * smoothstep(uFade * 0.3, uFade, since);
  float halfH = uSize * 1.1;
  float dy = abs(uv.y - 0.5);
  float band = smoothstep(halfH + 0.08, halfH, dy) * b;
  col = mix(col, uBand, band * 0.85);
  float shown = 0.0;
  if (band > 0.0 && dy < halfH) {
    vec4 ink = inkBox();
    if (ink.y > ink.x) {
      float grow = 1.0 + 0.06 * smoothstep(0.0, uFade + uHold, since);
      vec2 tuv = inkUV(vec2((uv.x - 0.5) * aspect, uv.y - 0.5), ink, uSize * grow, aspect * 0.9);
      float w = words(tuv) * b;
      col += uInk * wordsGlow(tuv) * 0.35 * b;
      col = mix(col, uInk, w);
      shown = w;
    }
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, max(band * 0.85, shown)));
}`,
  ),
  presets: [
    { name: "You lose", values: { uText: textImage("YOU LOSE", { font: SERIF, weight: 400 }) } },
    { name: "Gold on black", values: { uInk: [0.9, 0.74, 0.35] } },
    { name: "Sudden", values: { uPlay: 0.6, uStutter: 4, uFade: 0.6 } },
    { name: "Long goodbye", values: { uFade: 3, uHold: 6 } },
  ],
};

export const memeShaders: ShaderEffect[] = [deepFried, dramaticZoom, laserEyes, toBeContinued, needsMoreJpeg, triggered, vaporwaveGrade, galaxyBrain, sadMode, gameOverBanner];
