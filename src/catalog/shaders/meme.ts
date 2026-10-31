import { glsl, HASH } from "../glsl.js";
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

// The words' coverage at tuv, 0–1 across the text image, and nothing outside it.
float words(vec2 tuv) {
  return all(greaterThanEqual(tuv, vec2(0.0))) && all(lessThanEqual(tuv, vec2(1.0))) ? texture(uText, tuv).a : 0.0;
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

export const memeShaders: ShaderEffect[] = [deepFried, dramaticZoom, laserEyes, toBeContinued];
