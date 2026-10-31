import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";
import { REGION, regionControls } from "./region.js";

/*
 * Censoring: hiding part of a picture or video, as for a face, a number
 * plate or a line of a document. Each effect works on a region (a box or an
 * ellipse, placed in 0–1 of the frame, y up) and can be turned inside out to
 * hide everything but it.
 */

export const censorPixelate: ShaderEffect = {
  kind: "shader",
  id: "censor-pixelate",
  name: "Pixelate censor",
  description: "Part of a picture or video hidden behind big mosaic blocks, as for a face or a number plate, the blocks shimmering like a live censor.",
  category: "image",
  video: "filter",
  tags: ["image", "censor", "redact", "privacy", "mosaic", "pixelate", "face", "anonymise"],
  source: glsl(
    `// Pixelate censor: a region of the picture as mosaic blocks, each the average of its block.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uBlock;      // @control min=4 max=120 default=24 label="Block size (px)"
uniform float uShimmer;    // @control min=0 max=1 default=0.35 label="Shimmer"
${regionControls()}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    REGION,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = region(fragCoord);
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  // The grid creeps a few times a second, as a live censor's does over a moving subject.
  vec2 shift = (hash22(vec2(floor(iTime * 6.0), 3.7)) - 0.5) * uShimmer * uBlock * 0.5;
  vec2 cell = floor((fragCoord + shift) / uBlock);
  // Four taps across the block, so it shows the block's colour, not one pixel's.
  // Summed premultiplied, so clear parts of the picture do not darken it.
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i & 1, i >> 1) * 0.5 + 0.25;
    vec4 c = pictureRGBA(uImage, ((cell + o) * uBlock - shift) / iResolution.xy);
    sum += vec4(c.rgb * c.a, c.a);
  }
  fragColor = mix(pic, vec4(sum.rgb / max(sum.a, 1e-4), sum.a / 4.0), m);
}`,
  ),
  presets: [
    { name: "TV censor", values: { uBlock: 16, uShimmer: 0.6 } },
    { name: "Chunky", values: { uBlock: 44, uShimmer: 0, uShape: 0, uFeather: 0 } },
    { name: "Hide the background", values: { uBlock: 20, uShimmer: 0, uInvert: true, uSize: [0.34, 0.62], uFeather: 16 } },
  ],
};

export const censorBlur: ShaderEffect = {
  kind: "shader",
  id: "censor-blur",
  name: "Blur censor",
  description: "Part of a picture or video blurred beyond recognition, as for a face or a screen, or everything but it blurred for focus.",
  category: "image",
  video: "filter",
  tags: ["image", "censor", "redact", "privacy", "blur", "face", "anonymise", "frosted"],
  source: glsl(
    `// Blur censor: a region of the picture blurred, from the picture's smaller mipmaps.
uniform sampler2D uImage;  // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uBlur;       // @control min=0 max=120 default=40 label="Blur (px)"
uniform float uFrost;      // @control min=0 max=1 default=0 label="Frosted grain"
uniform float uBrightness; // @control min=-0.5 max=0.5 default=0 label="Brightness"
${regionControls()}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    REGION,
    `// The picture as pictureRGBA gives it, read from mipmap level lod (an explicit level: the taps'
// scattered coordinates would otherwise have the hardware pick the smallest).
vec4 softPicture(vec2 uv, float lod) {
  return textureSize(uImage, 0).x > 1 ? overBackdrop(textureLod(uImage, uv, lod)) : vec4(testCard(fract(uv)), 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  float m = region(fragCoord);
  if (m <= 0.0 || uBlur <= 0.0) {
    fragColor = pic;
    return;
  }
  // A 16-tap golden-angle disc over a mipmap whose texels are a quarter of the blur, so few
  // taps cover a wide blur smoothly.
  vec2 ts = vec2(textureSize(uImage, 0));
  float lod = max(0.0, log2(uBlur * max(ts.x / iResolution.x, ts.y / iResolution.y) / 4.0));
  float spin = hash12(fragCoord) * 6.28318;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 16.0) * uBlur;
    float a = fi * 2.39996 + spin;
    vec4 c = softPicture(uv + r * vec2(cos(a), sin(a)) / iResolution.xy, lod);
    sum += vec4(c.rgb * c.a, c.a);
  }
  vec3 col = sum.rgb / max(sum.a, 1e-4);
  col += (hash12(fragCoord * 1.37 + 11.0) - 0.5) * uFrost * 0.3;
  col = clamp(col + uBrightness, 0.0, 1.0);
  fragColor = mix(pic, vec4(col, sum.a / 16.0), m);
}`,
  ),
  presets: [
    { name: "Frosted glass", values: { uBlur: 60, uFrost: 0.6, uBrightness: 0.12, uShape: 0, uFeather: 0 } },
    { name: "Focus on the subject", values: { uBlur: 24, uInvert: true, uSize: [0.36, 0.7], uFeather: 40 } },
    { name: "Darkened", values: { uBlur: 80, uBrightness: -0.3 } },
  ],
};

export const censorScramble: ShaderEffect = {
  kind: "shader",
  id: "censor-scramble",
  name: "Scramble censor",
  description: "Part of a picture or video broken into shuffled, flipped blocks with digital noise, reshuffling several times a second.",
  category: "image",
  video: "filter",
  tags: ["image", "censor", "redact", "privacy", "scramble", "glitch", "digital", "mosaic"],
  source: glsl(
    `// Scramble censor: a region's blocks swapped with near ones, flipped and noisy, reshuffling.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uBlock;      // @control min=6 max=80 default=18 label="Block size (px)"
uniform float uReach;      // @control min=1 max=12 default=5 label="Shuffle reach (blocks)"
uniform float uRate;       // @control min=0 max=24 default=8 label="Reshuffles per second"
uniform float uNoise;      // @control min=0 max=1 default=0.45 label="Digital noise"
${regionControls()}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    REGION,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  float m = region(fragCoord);
  if (m <= 0.0) {
    fragColor = pic;
    return;
  }
  float tick = floor(iTime * uRate);
  vec2 cell = floor(fragCoord / uBlock);
  // Each block shows another from near by, mirrored or turned, a different one each reshuffle.
  vec2 src = cell + floor((hash22(cell + tick * 17.31) - 0.5) * 2.0 * uReach + 0.5);
  vec2 f = fract(fragCoord / uBlock);
  vec2 h = hash22(cell * 3.1 + tick * 0.73);
  if (h.x < 0.5) f.x = 1.0 - f.x;
  if (h.y < 0.35) f = f.yx;
  vec4 c = pictureRGBA(uImage, (src + f) * uBlock / iResolution.xy);
  // Digital noise: fewer colours, and some blocks lose theirs to swapped channels or static.
  vec3 col = mix(c.rgb, floor(c.rgb * 5.0 + 0.5) / 5.0, uNoise);
  float k = hash12(cell + tick * 5.7);
  if (k < 0.12 * uNoise) col = vec3(hash12(floor(fragCoord / 2.0) + tick));
  else if (k < 0.3 * uNoise) col = col.gbr;
  fragColor = mix(pic, vec4(col, c.a), m);
}`,
  ),
  presets: [
    { name: "Calm", values: { uRate: 2, uNoise: 0.1, uReach: 3 } },
    { name: "Corrupted", values: { uBlock: 28, uRate: 16, uNoise: 1, uReach: 9, uShape: 0 } },
  ],
};

export const redactionBars: ShaderEffect = {
  kind: "shader",
  id: "redaction-bars",
  name: "Redaction bars",
  description: "Black marker bars drawn one after another over lines of a picture, like a redacted document, then wiped away.",
  category: "image",
  video: "filter",
  tags: ["image", "censor", "redact", "privacy", "document", "classified", "marker", "reveal"],
  loop: 5,
  source: glsl(
    `// Redaction bars: rough marker bars drawn over an area line by line, held, then wiped off.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uCentre;      // @control min=0 max=1 default=0.5,0.6 label="Area centre"
uniform vec2 uSize;        // @control min=0 max=1 default=0.62,0.3 label="Area size"
uniform int uLines;        // @control min=1 max=8 default=3 label="Bars"
uniform float uGap;        // @control min=0 max=1 default=0.4 label="Gap between bars"
uniform vec3 uInk;         // @control color default=#0A0A0A label="Bar colour"
uniform float uRough;      // @control min=0 max=1 default=0.4 label="Marker roughness"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Drawn (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 pic = pictureRGBA(uImage, fragCoord / iResolution.xy);
  // Drawn over the first 1.8 s, held, then wiped off from the left before the loop ends.
  float t = mod(iTime, 5.0);
  float drawn = uAnimate ? clamp(t / 1.8, 0.0, 1.0) : uProgress;
  float wiped = uAnimate ? smoothstep(4.2, 4.9, t) : 0.0;
  vec2 hs = 0.5 * uSize * iResolution.xy;
  vec2 lo = uCentre * iResolution.xy - hs;
  float lines = float(max(uLines, 1));
  float h = 2.0 * hs.y / (lines + (lines - 1.0) * uGap);
  float pitch = h * (1.0 + uGap);
  // Bar i counts down from the area's top; across is 0 at its top edge, along 0 at its left.
  float down = lo.y + 2.0 * hs.y - fragCoord.y;
  float i = floor(down / pitch);
  float across = down - i * pitch;
  float along = fragCoord.x - lo.x;
  float ink = 0.0;
  if (i >= 0.0 && i < lines && hs.x > 0.0) {
    // Each bar starts as the one above is half drawn; the last line of a paragraph is shorter.
    float len = 2.0 * hs.x * (i == lines - 1.0 && lines > 1.0 ? 0.62 : 1.0 - 0.14 * hash12(vec2(i, 4.1)));
    float k = clamp(drawn * (lines * 0.5 + 0.5) - i * 0.5, 0.0, 1.0);
    k = 1.0 - (1.0 - k) * (1.0 - k);
    // A marker's edges wobble, more at its rounded-off ends.
    float wob = uRough * h * 0.12;
    float top = (vnoise(vec2(along / 23.0, i * 7.3)) - 0.5) * 2.0 * wob;
    float bottom = h + (vnoise(vec2(along / 19.0, i * 3.1 + 40.0)) - 0.5) * 2.0 * wob;
    float endWob = (vnoise(vec2(across / 9.0, i * 5.7 + 80.0)) - 0.5) * 6.0 * wob;
    float start = wiped * len + endWob;
    float end = k * len - endWob;
    ink = smoothstep(top - 0.5, top + 0.5, across) * smoothstep(bottom + 0.5, bottom - 0.5, across)
      * smoothstep(start - 0.5, start + 0.5, along) * smoothstep(end + 0.5, end - 0.5, along) * step(0.001, k);
  }
  // Streaks along the stroke, where the marker laid down a little less ink.
  vec3 bar = uInk + uRough * 0.08 * vnoise(vec2(fragCoord.x / 70.0, fragCoord.y / 2.5));
  fragColor = vec4(mix(pic.rgb, bar, ink), max(pic.a, ink));
}`,
  ),
  presets: [
    { name: "Clean", values: { uRough: 0, uGap: 0.25 } },
    { name: "Document", values: { uLines: 6, uGap: 0.55, uSize: [0.7, 0.6] } },
    { name: "White-out", values: { uInk: [0.97, 0.96, 0.93], uRough: 0.7, uLines: 2 } },
  ],
};

/** Censoring a region of a picture or video: pixelated, blurred, scrambled or redacted. */
export const censorShaders: ShaderEffect[] = [censorPixelate, censorBlur, censorScramble, redactionBars];
