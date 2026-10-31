import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";
import { DIGIT7 } from "./timewarp.js";

/*
 * Horror: analog horror (a cursed tape, a night-vision camcorder, a feed that
 * freezes and corrupts into something it should not show) and the spectral
 * (an apparition over a picture, eyes opening in the dark). Each is tagged
 * "horror", with "analog-horror", "spectral" or "creature" for its kind.
 *
 * Flicker stays soft and slow: nothing flashes the whole frame between dark
 * and light more than a few times a second. Players show a still under
 * prefers-reduced-motion.
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

/**
 * `camcorder(fragCoord, unit, secs)`: a camcorder's burned-in display as
 * (white ink, red ink): a blinking red dot and REC at the top left and the
 * clock `secs` (seconds since midnight) as HH:MM:SS at the bottom right.
 * `unit` is half a character's height in pixels. Needs {@link DIGIT7}.
 */
const CAMCORDER = `
// R, E and C in digit7's 1 × 2 cell.
float letterDist(vec2 p, int k) {
  float d = segDist(p, vec2(0.0, 0.0), vec2(0.0, 2.0));
  d = min(d, segDist(p, vec2(0.0, 2.0), vec2(1.0, 2.0)));
  if (k == 0) {
    d = min(d, segDist(p, vec2(1.0, 2.0), vec2(1.0, 1.0)));
    d = min(d, segDist(p, vec2(0.0, 1.0), vec2(1.0, 1.0)));
    d = min(d, segDist(p, vec2(0.3, 1.0), vec2(1.0, 0.0)));
  } else {
    d = min(d, segDist(p, vec2(0.0, 0.0), vec2(1.0, 0.0)));
    if (k == 1) d = min(d, segDist(p, vec2(0.0, 1.0), vec2(0.8, 1.0)));
  }
  return d;
}

// Ink of "HH:MM:SS" at q (units of half a digit's height).
float clockInk(vec2 q, float secs) {
  if (q.y < -0.3 || q.y > 2.3 || q.x < -0.3 || q.x > 12.8) return 0.0;
  int slot = int(floor(q.x / 1.6));
  vec2 c = vec2(q.x - float(slot) * 1.6, q.y);
  int h = int(mod(floor(secs / 3600.0), 24.0));
  int m = int(mod(floor(secs / 60.0), 60.0));
  int s = int(mod(floor(secs), 60.0));
  float dist = 1e5;
  if (slot == 2 || slot == 5) dist = min(length(c - vec2(0.5, 0.6)), length(c - vec2(0.5, 1.4)));
  else {
    int v = slot < 2 ? h : slot < 5 ? m : s;
    int d = (slot == 0 || slot == 3 || slot == 6) ? v / 10 : v - (v / 10) * 10;
    dist = digit7(c, d);
  }
  return smoothstep(0.2, 0.12, dist);
}

vec2 camcorder(vec2 fragCoord, float unit, float secs) {
  vec2 rec = (fragCoord - vec2(unit * 4.2, iResolution.y - unit * 4.0)) / unit;
  float white = 0.0;
  if (rec.y > -0.3 && rec.y < 2.3 && rec.x > -0.3 && rec.x < 4.6) {
    int k = int(floor(rec.x / 1.6));
    white = smoothstep(0.2, 0.12, letterDist(rec - vec2(float(k) * 1.6, 0.0), k));
  }
  float spot = smoothstep(1.0, 0.85, length((fragCoord - vec2(unit * 2.6, iResolution.y - unit * 3.0)) / unit));
  float red = spot * step(0.5, fract(secs));
  vec2 clock = (fragCoord - vec2(iResolution.x - unit * 15.0, unit * 3.2)) / unit;
  white = max(white, clockInk(clock, secs));
  return vec2(white, red);
}`.trim();

/** The camcorder display's controls: on or off, its colour, and the clock it starts at. */
const CAMCORDER_CONTROLS = `
uniform bool uOsd;         // @control default=true label="Camcorder display"
uniform vec3 uOsdColor;    // @control color default=#F8FAFC label="Display colour"
uniform float uClock;      // @control min=0 max=24 default=3 label="Clock starts at (hour)"`.trim();

/** `osdOver(col, alpha, fragCoord, shift)`: the camcorder display laid over a colour, its alpha raised under the ink. */
const OSD_OVER = `
vec4 osdOver(vec3 col, float alpha, vec2 fragCoord, float shift) {
  if (!uOsd) return vec4(col, alpha);
  float unit = iResolution.y * 0.018;
  float secs = uClock * 3600.0 + iTime;
  vec2 at = fragCoord + vec2(shift, 0.0);
  vec2 shadow = camcorder(at + vec2(-0.25, 0.25) * unit, unit, secs);
  vec2 ink = camcorder(at, unit, secs);
  col = mix(col, vec3(0.0), 0.5 * max(shadow.x, shadow.y));
  col = mix(col, uOsdColor, ink.x);
  col = mix(col, vec3(1.0, 0.1, 0.08), ink.y);
  return vec4(col, max(alpha, max(0.5 * max(shadow.x, shadow.y), max(ink.x, ink.y))));
}`.trim();

/** `smin(a, b, k)`, a smooth union; `figure(q)`, distance to a hooded figure in units of its height (0 at its middle, its head at the top). */
const FIGURE = `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float figure(vec2 q) {
  float head = length(q - vec2(0.0, 0.33)) - 0.095;
  float shoulders = (length((q - vec2(0.0, 0.12)) / vec2(0.17, 0.085)) - 1.0) * 0.085;
  float robe = max(abs(q.x) - (0.15 + 0.12 * (0.12 - q.y)), q.y - 0.12);
  return smin(smin(head, shoulders, 0.06), robe, 0.04);
}`.trim();

export const vhsTracking: ShaderEffect = {
  kind: "shader",
  id: "vhs-tracking",
  name: "VHS tracking",
  description:
    "A picture on a cursed tape: the image warping as the tape stretches, a band of tracking noise rolling up through it, head-switching tear along the bottom, colour bleeding to the right and a camcorder's REC and clock burned in.",
  category: "horror",
  video: "filter",
  tags: ["horror", "analog-horror", "vhs", "tape", "found-footage", "camcorder", "glitch", "retro", "image"],
  source: glsl(
    `// VHS tracking: each scanline shifted by the tape's warp, a rolling tracking band and the head-switch tear at
// the bottom; then sharp brightness with colour smeared to the right (chroma has a fraction of luma's bandwidth).
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uWarp;       // @control min=0 max=1 default=0.5 label="Tape warp"
uniform float uTracking;   // @control min=0 max=1 default=0.6 label="Tracking band"
uniform float uHeadSwitch; // @control min=0 max=1 default=0.7 label="Head-switch tear"
uniform float uBleed;      // @control min=0 max=0.03 default=0.007 label="Colour bleed"
uniform float uNoise;      // @control min=0 max=1 default=0.5 label="Noise"
${CAMCORDER_CONTROLS}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    DIGIT7,
    CAMCORDER,
    OSD_OVER,
    `vec3 toYiq(vec3 c) { return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c; }
vec3 fromYiq(vec3 c) { return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float frame = floor(iTime * 30.0);
  float line = floor(uv.y * 240.0);
  // The tape's warp: a slow wave down the picture and a wandering wobble.
  float shift = uWarp * (0.004 * sin(uv.y * 6.0 + iTime * 1.3) + 0.006 * (vnoise(vec2(uv.y * 14.0, iTime * 1.7)) - 0.5));
  // The tracking band rolls up through the picture every few seconds, tearing the lines it crosses.
  float at = fract(iTime * 0.11) * 1.4 - 0.2;
  float band = exp(-pow((uv.y - at) / 0.04, 2.0)) * uTracking;
  shift += band * (hash12(vec2(line, frame)) - 0.3) * 0.07;
  // Head-switching: the bottom few lines torn sideways.
  float tear = (1.0 - smoothstep(0.02, 0.05, uv.y)) * uHeadSwitch;
  shift += tear * (0.02 + 0.04 * hash12(vec2(line, frame + 3.0)));
  shift += (hash12(vec2(line, frame + 7.0)) - 0.5) * 0.002 * uNoise;
  vec2 st = uv + vec2(shift, 0.0);
  vec4 pic = pictureRGBA(uImage, st);
  // Brightness from the line itself; colour averaged along it, so it bleeds to the right.
  vec3 iq = vec3(0.0);
  for (int k = 1; k < 5; k++) iq += toYiq(picture(uImage, st - vec2(float(k) * uBleed * 0.5, 0.0)));
  iq = (iq + toYiq(pic.rgb)) / 5.0;
  vec3 col = fromYiq(vec3(dot(pic.rgb, vec3(0.299, 0.587, 0.114)), iq.yz * 1.15));
  // Static in the band and the tear, grain everywhere and a few white dropouts.
  float snow = hash12(fragCoord + frame * 17.0);
  col = mix(col, vec3(snow), clamp(band * 0.7 * step(0.45, hash12(vec2(floor(fragCoord.x / 3.0), line + frame))) + tear * 0.35, 0.0, 1.0));
  col += (snow - 0.5) * 0.1 * uNoise;
  col += step(0.9993 - 0.001 * uNoise, hash12(vec2(floor(fragCoord.x / 8.0), line + frame * 31.0))) * 0.8 * uNoise;
  // The washed-out tape look: lifted blacks, a cold cast, soft scanlines and dark corners.
  col = mix(vec3(dot(col, ${LUMA})), col, 0.8) * vec3(0.97, 1.0, 1.04) * 0.92 + 0.04;
  col *= 0.94 + 0.06 * sin(fragCoord.y * 3.14159);
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.45 * dot(v, v);
  // The display was recorded onto the tape, so it tears with it.
  fragColor = osdOver(clamp(col, 0.0, 1.0), pic.a, fragCoord, -shift * iResolution.x);
}`,
  ),
  presets: [
    { name: "Worn tape", values: { uWarp: 1, uTracking: 1, uHeadSwitch: 1, uBleed: 0.02, uNoise: 0.9 } },
    { name: "Clean deck", values: { uWarp: 0.2, uTracking: 0.2, uHeadSwitch: 0.4, uBleed: 0.004, uNoise: 0.2 } },
    { name: "Midnight", values: { uClock: 0 } },
    { name: "No display", values: { uOsd: false } },
  ],
};

export const nightVisionCam: ShaderEffect = {
  kind: "shader",
  id: "night-vision-cam",
  name: "Night vision camcorder",
  description:
    "A picture through a camcorder's night-vision mode: amplified green phosphor with heavy grain in the shadows, blooming highlights and a dark tube vignette, where pairs of eyes catch the infrared light and shine back out of the dark now and then.",
  category: "horror",
  video: "filter",
  tags: ["horror", "analog-horror", "night-vision", "infrared", "camcorder", "found-footage", "eyes", "green", "image"],
  source: glsl(
    `// Night vision camcorder: brightness amplified and compressed onto a green phosphor, noise strongest where it
// is darkest (few photons), a bloom from the brightest parts and a round tube vignette. Now and then a pair of
// eyes shines out of the dark (where the picture is darkest under them), blinks and is gone.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uPhosphor;    // @control color default=#7CFF6B label="Phosphor"
uniform float uGain;       // @control min=0.5 max=4 default=1.8 label="Gain"
uniform float uGrain;      // @control min=0 max=1 default=0.55 label="Grain"
uniform float uBloom;      // @control min=0 max=1 default=0.5 label="Bloom"
uniform float uVignette;   // @control min=0 max=1 default=0.7 label="Vignette"
uniform float uEyes;       // @control min=0 max=1 default=0.6 label="Eyes in the dark"
uniform float uEyeSize;    // @control min=2 max=30 default=9 label="Eye size"
${CAMCORDER_CONTROLS}
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    DIGIT7,
    CAMCORDER,
    OSD_OVER,
    `// The glow of eye pair i at p (frame-height units, centred), or 0 while it is hidden.
float eyePair(vec2 p, float i, float aspect) {
  float period = 5.0 + 2.0 * i;
  float life = iTime / period + 0.37 * i;
  float cycle = floor(life);
  float u = fract(life);
  vec2 h = hash22(vec2(cycle * 3.7 + i, 11.0 + i));
  if (hash12(vec2(cycle, 5.0 + i)) > uEyes) return 0.0;
  vec2 c = vec2((h.x - 0.5) * 0.8 * aspect, (h.y - 0.5) * 0.6);
  // Shown where the picture is dark, so they seem to look out of the shadows.
  float dark = 1.0 - smoothstep(0.15, 0.5, dot(picture(uImage, c / vec2(aspect, 1.0) + 0.5), ${LUMA}));
  float open = smoothstep(0.1, 0.25, u) * (1.0 - smoothstep(0.6, 0.75, u));
  float blink = 1.0 - exp(-pow((u - 0.42) / 0.012, 2.0));
  float r = uEyeSize * 0.001;
  vec2 q = p - c;
  q.x = abs(q.x) - 1.7 * r;
  float shape = length(q / vec2(1.0, max(open * blink, 0.02)));
  return dark * open * (smoothstep(r, 0.4 * r, shape) + 0.5 * exp(-shape / (1.8 * r)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float frame = floor(iTime * 24.0);
  vec4 pic = pictureRGBA(uImage, uv);
  // Amplified: a gain on brightness, compressed so highlights saturate the tube rather than clip.
  float flicker = 1.0 + 0.04 * (hash12(vec2(frame, 1.0)) - 0.5);
  float l = 1.0 - exp(-dot(pic.rgb, ${LUMA}) * uGain * 1.6 * flicker);
  float d = 0.012;
  float glow = 0.0;
  for (int k = 0; k < 4; k++) {
    float a = float(k) * 1.5708 + 0.785;
    glow += dot(picture(uImage, uv + d * vec2(cos(a) / aspect, sin(a))), ${LUMA});
  }
  l += uBloom * 0.5 * smoothstep(0.35, 0.9, glow * 0.25 * uGain);
  // Photon noise: strongest in the dark, plus the odd sparkle.
  float n = hash12(fragCoord + frame * 23.1);
  l += (n - 0.5) * uGrain * (0.25 + 0.55 * (1.0 - l));
  l += step(0.9992, hash12(fragCoord * 0.73 + frame)) * uGrain;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  for (int i = 0; i < 3; i++) l += 1.4 * eyePair(p, float(i), aspect);
  l = max(l, 0.0);
  vec3 col = uPhosphor * l + vec3(pow(min(l, 1.2), 4.0)) * 0.35;
  col *= 0.9 + 0.1 * sin(fragCoord.y * 2.0);
  // The tube: round, dark at its rim.
  float rim = length(p / vec2(0.62 * aspect, 0.62));
  col *= 1.0 - uVignette * smoothstep(0.55, 1.05, rim);
  fragColor = osdOver(clamp(col, 0.0, 1.0), pic.a, fragCoord, 0.0);
}`,
  ),
  presets: [
    { name: "Gen 3 green", values: { uPhosphor: [0.49, 1, 0.42] } },
    { name: "White phosphor", values: { uPhosphor: [0.85, 0.92, 1] } },
    { name: "Something's there", values: { uEyes: 1, uEyeSize: 12, uGain: 1.2 } },
    { name: "Clean", values: { uGrain: 0.15, uEyes: 0, uOsd: false } },
  ],
};

export const signalLost: ShaderEffect = {
  kind: "shader",
  id: "signal-lost",
  name: "Signal lost",
  description:
    "A live feed that stutters and freezes, breaks into blocky corruption that smears across the frozen frame, shows a hidden picture through the broken blocks, then cuts to static and comes back as if nothing happened. Loops; or turn Animate off and set Moment.",
  category: "horror",
  video: "stills",
  tags: ["horror", "analog-horror", "glitch", "datamosh", "corruption", "freeze", "static", "hidden", "found-footage", "image"],
  loop: 6,
  source: glsl(
    `// Signal lost, over a cycle: live (the picture drifting), stutter, freeze; blocks corrupt (smeared, then
// showing the hidden picture); static; back to live. Each block corrupts at its own moment, from its hash.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Feed"
uniform sampler2D uHidden; // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Hidden picture"
uniform vec3 uTint;        // @control color default=#FF3B30 label="Hidden tint"
uniform float uBlock;      // @control min=8 max=96 default=32 label="Block size"
uniform float uCorrupt;    // @control min=0 max=1 default=0.8 label="Corruption"
uniform float uCycle;      // @control min=4 max=12 default=6 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.62 label="Moment (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// The live feed at time t: the picture slowly drifting and breathing, so a freeze shows.
vec4 feed(vec2 uv, float t) {
  float a = 6.28318 * t / uCycle;
  vec2 drift = vec2(0.012 * sin(a), 0.008 * sin(2.0 * a + 1.0));
  return pictureRGBA(uImage, (uv - 0.5) / (1.06 + 0.02 * sin(a)) + 0.5 + drift);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float T = uAnimate ? mod(iTime, uCycle) : uProgress * uCycle;
  float k = T / uCycle;
  // Stutter (frames repeating in jumps), then the freeze from a third of the way.
  float freezeAt = 0.33 * uCycle;
  float t = k < 0.27 ? T : k < 0.33 ? floor(T * 4.0) / 4.0 : freezeAt;
  // Corruption grows after the freeze; past the middle, broken blocks show the hidden picture.
  float corrupt = smoothstep(0.36, 0.55, k) * (1.0 - smoothstep(0.76, 0.78, k)) * uCorrupt;
  float reveal = smoothstep(0.5, 0.62, k) * (1.0 - smoothstep(0.76, 0.78, k));
  float bs = max(uBlock * 0.001 * iResolution.y, 4.0);
  vec2 block = floor(fragCoord / bs);
  float hb = hash12(block + 0.5);
  float broken = step(hb, corrupt);
  // A broken block smears: it repeats a neighbouring block's pixels pushed along a motion vector, as a lost
  // keyframe does, and its colour comes out in coarse steps.
  vec2 mv = (hash22(block + floor(k * 12.0)) - 0.5) * 0.08 * broken;
  vec4 col = feed(uv - mv, t);
  vec3 smeared = floor(col.rgb * 5.0) / 5.0;
  col.rgb = mix(col.rgb, smeared, broken);
  // The hidden picture through some broken blocks: tinted, hard and dark, and unsteady.
  float shows = broken * step(0.45, hash12(block * 1.7 + 3.0)) * reveal;
  vec4 hidden = pictureRGBA(uHidden, uv + (hash22(vec2(floor(iTime * 2.0), 4.0)) - 0.5) * 0.004);
  float hl = smoothstep(0.15, 0.7, dot(hidden.rgb, vec3(0.2126, 0.7152, 0.0722)));
  vec3 ghost = uTint * hl * (0.85 + 0.15 * sin(iTime * 9.0));
  col.rgb = mix(col.rgb, ghost, shows);
  // Rows of blocks slip sideways in the worst of it.
  float row = floor(fragCoord.y / bs);
  col.rgb = mix(col.rgb, col.gbr, broken * step(0.92, hash12(vec2(row, floor(k * 30.0)))));
  // Static as the signal drops, easing back into the live feed.
  float snowAmount = smoothstep(0.76, 0.78, k) * (1.0 - smoothstep(0.9, 1.0, k));
  float snow = hash12(fragCoord + floor(iTime * 30.0) * 13.0);
  col.rgb = mix(col.rgb, vec3(snow * 0.8 + 0.1), snowAmount);
  col.rgb *= 0.95 + 0.05 * sin(fragCoord.y * 3.14159);
  fragColor = vec4(clamp(col.rgb, 0.0, 1.0), max(col.a, snowAmount));
}`,
  ),
  presets: [
    { name: "Big blocks", values: { uBlock: 64 } },
    { name: "Fine grain", values: { uBlock: 12, uCorrupt: 1 } },
    { name: "Cold", values: { uTint: [0.55, 0.85, 1] } },
    { name: "Frozen reveal", values: { uAnimate: false, uProgress: 0.65 } },
  ],
};

export const ghostApparition: ShaderEffect = {
  kind: "shader",
  id: "ghost-apparition",
  name: "Ghost apparition",
  description:
    "A translucent figure fading in over a picture as it cools and darkens, flickering, hanging there with hollow eyes and wisps trailing from its hem, then fading away; turn on Double exposure to show a second picture inside it. Loops; or turn Animate off and set Presence.",
  category: "horror",
  video: "filter",
  tags: ["horror", "spectral", "ghost", "apparition", "haunting", "double-exposure", "halloween", "image"],
  loop: 8,
  source: glsl(
    `// Ghost apparition: a hooded figure as a soft distance field (head, shoulders, a robe widening down), its hem
// broken into wisps by noise. Translucent: it bends the picture a little, mists it over and glows at its edge.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform sampler2D uFigure; // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Double-exposure picture"
uniform bool uDouble;      // @control default=false label="Double exposure"
uniform vec3 uGhost;       // @control color default=#CFE6FF label="Ghost"
uniform float uX;          // @control min=-0.5 max=0.5 default=0.12 label="Position"
uniform float uSize;       // @control min=0.3 max=1.2 default=0.85 label="Size"
uniform float uOpacity;    // @control min=0 max=1 default=0.6 label="Opacity"
uniform float uGloom;      // @control min=0 max=1 default=0.6 label="Gloom"
uniform float uCycle;      // @control min=4 max=16 default=8 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=1 label="Presence (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    FIGURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float T = mod(iTime, uCycle) / uCycle;
  // In, a hold, out, gone; a soft flicker while it comes and goes.
  float presence = uAnimate ? smoothstep(0.0, 0.3, T) * (1.0 - smoothstep(0.62, 0.92, T)) : uProgress;
  float unsteady = uAnimate ? 4.0 * presence * (1.0 - presence) : 0.0;
  presence *= 1.0 - 0.3 * unsteady * step(0.6, hash12(vec2(floor(iTime * 5.0), 2.0)));
  float bob = 0.012 * sin(iTime * 1.3);
  vec2 q = (p - vec2(uX * iResolution.x / iResolution.y, bob - 0.02)) / uSize;
  // The hem frays into wisps, drifting up.
  float lower = smoothstep(0.0, -0.5, q.y);
  float wisp = fbm(vec2(q.x * 6.0, q.y * 3.0 - iTime * 0.4), 4);
  q.x += (wisp - 0.5) * 0.12 * lower;
  float d = figure(q);
  float fade = smoothstep(-0.52, -0.12, q.y + 0.25 * (wisp - 0.5));
  float inside = (1.0 - smoothstep(-0.01, 0.015, d)) * fade;
  float rim = exp(-abs(d) / 0.012) * fade;
  // Its hollow eyes.
  vec2 e = q - vec2(0.0, 0.335);
  e.x = abs(e.x) - 0.037;
  float eyes = (1.0 - smoothstep(0.012, 0.022, length(e / vec2(1.0, 1.4)))) * step(abs(q.x), 0.1);
  // The picture behind: bent a little through the figure, colder and darker while it is there.
  vec2 bend = vec2(wisp - 0.5, 0.0) * 0.01 * inside * presence;
  vec4 pic = pictureRGBA(uImage, uv + bend);
  float grey = dot(pic.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 cold = mix(vec3(grey), pic.rgb, 0.45) * vec3(0.82, 0.92, 1.05) * 0.7;
  vec3 col = mix(pic.rgb, cold, uGloom * (0.35 + 0.65 * presence));
  col *= 1.0 - 0.5 * uGloom * presence * smoothstep(0.3, 0.9, length(uv - 0.5) * 1.4);
  // The figure: mist inside (or the second picture, screened), a brighter edge, dark hollows for eyes.
  vec3 fill = uGhost * (0.55 + 0.45 * fbm(q * 4.0 + vec2(0.0, -iTime * 0.2), 3));
  if (uDouble) {
    vec2 fuv = vec2(q.x / 0.6 + 0.5, (q.y + 0.5));
    fill = uGhost * smoothstep(0.1, 0.9, dot(pictureCover(uFigure, fuv), vec3(0.2126, 0.7152, 0.0722)));
  }
  float a = uOpacity * presence;
  col = mix(col, 1.0 - (1.0 - col) * (1.0 - fill), inside * a);
  col += uGhost * rim * a * 0.35;
  col = mix(col, col * 0.15, eyes * inside * a);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, inside * a));
}`,
  ),
  presets: [
    { name: "Double exposure", values: { uDouble: true, uOpacity: 0.75 } },
    { name: "Faint", values: { uOpacity: 0.3, uGloom: 0.3 } },
    { name: "Wraith", values: { uGhost: [0.7, 1, 0.85], uGloom: 1, uSize: 1.1, uX: 0 } },
    { name: "Still", values: { uAnimate: false } },
  ],
};

export const eyesInTheDark: ShaderEffect = {
  kind: "shader",
  id: "eyes-in-the-dark",
  name: "Eyes in the dark",
  description:
    "Pairs of glowing eyes opening one after another in the dark, blinking and watching the pointer, snapping shut when it comes near and opening again somewhere else.",
  category: "horror",
  tags: ["horror", "creature", "eyes", "dark", "interactive", "hover", "halloween", "background"],
  source: glsl(
    `// Eyes in the dark: one pair at most in each cell of a grid, placed and timed by the cell's hash. Each pair
// opens, blinks, looks at the pointer (or wanders) and closes; near the pointer it shuts.
uniform vec3 uBackground;  // @control color default=#050407 label="Background"
uniform vec3 uColor;       // @control color default=#FFC83D label="Eyes"
uniform vec3 uColorB;      // @control color default=#FF3D2E label="Other eyes"
uniform float uDensity;    // @control min=2 max=10 default=4 label="Density"
uniform float uAmount;     // @control min=0 max=1 default=0.55 label="Watchers"
uniform float uSize;       // @control min=0.4 max=2.5 default=1.4 label="Size"
uniform float uReach;      // @control min=0 max=0.6 default=0.22 label="Shy distance"
uniform float uGlow;       // @control min=0 max=2 default=1 label="Glow"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float H = iResolution.y;
  vec2 p = fragCoord / H;
  float cell = 1.0 / uDensity;
  vec2 id = floor(p / cell);
  vec2 h = hash22(id + 7.3);
  // Its own rhythm: a long life, open for the middle of it, then elsewhere in the cell next time.
  float period = 5.0 + 5.0 * h.x;
  float life = iTime / period + h.y * 7.0;
  float cycle = floor(life);
  float u = fract(life);
  vec3 col = uBackground;
  if (hash12(id + cycle * 3.1) < uAmount) {
    float r = min(0.022 * uSize, 0.13 * cell);
    vec2 jitter = hash22(id * 1.3 + cycle * 5.7) - 0.5;
    vec2 c = (id + 0.5) * cell + jitter * (cell - 8.0 * r);
    // Shy: the pointer near it shuts it (only while it hovers).
    vec2 pointer = iPointer.xy / H;
    float near = clamp(iPointer.z, 0.0, 1.0) * (1.0 - smoothstep(0.5 * uReach, uReach, length(pointer - c)));
    float open = smoothstep(0.08, 0.2, u) * (1.0 - smoothstep(0.75, 0.88, u));
    float b = 0.3 + 0.4 * hash12(id + cycle);
    float blink = (1.0 - exp(-pow((u - b) / 0.01, 2.0))) * (1.0 - exp(-pow((u - b - 0.035) / 0.01, 2.0)));
    float lid = open * blink * (1.0 - near);
    // Looking at the pointer while it hovers, otherwise wandering.
    vec2 wander = vec2(sin(iTime * 0.7 + h.x * 9.0), 0.4 * sin(iTime * 0.5 + h.y * 7.0));
    vec2 toward = pointer - c;
    vec2 look = mix(wander, toward / max(length(toward), 1e-3), clamp(iPointer.z, 0.0, 1.0)) * 0.35;
    vec3 tint = hash12(id + 2.0) < 0.7 ? uColor : uColorB;
    float tilt = (h.x - 0.5) * 0.4;
    vec2 q = (p - c) / r;
    q = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * q;
    float side = sign(q.x);
    q.x = abs(q.x) - 1.6;
    // Slanted in towards the middle: a frown.
    q = mat2(cos(0.25), -sin(0.25), sin(0.25), cos(0.25)) * q;
    // An almond: inside where |y| is under its lid's height at x.
    float height = 0.55 * lid * max(1.0 - q.x * q.x, 0.0);
    float almond = clamp((height - abs(q.y)) * r * H * 1.2, 0.0, 1.0) * step(abs(q.x), 1.0);
    vec2 pq = q - vec2(look.x * side, look.y);
    float iris = 0.55 + 0.9 * exp(-length(pq) * 2.2);
    float pupil = 1.0 - smoothstep(0.07, 0.14, abs(pq.x) / max(1.0 - pq.y * pq.y * 2.2, 0.05));
    vec3 eye = tint * iris * (1.0 - 0.9 * pupil);
    // The glow they cast into the dark around them.
    float glow = exp(-length(q / vec2(1.4, 1.0)) * 1.6) * lid * 0.35 * uGlow;
    col += tint * glow;
    col = mix(col, eye, almond);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Swarm", values: { uDensity: 8, uAmount: 0.7, uSize: 0.8 } },
    { name: "Something big", values: { uDensity: 2, uAmount: 1, uSize: 2.5, uColor: [1, 0.2, 0.15], uColorB: [1, 0.2, 0.15] } },
    { name: "Cats", values: { uColor: [0.6, 1, 0.35], uColorB: [0.35, 0.85, 1] } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

/** `stampInk(q, secs)`: a trail camera's "MM/DD/YYYY  HH:MM:SS" at q (units of half a digit's height). Needs {@link CAMCORDER} (for clockInk) and the date controls. */
const STAMP = `
float stampInk(vec2 q, float secs) {
  if (q.y < -0.3 || q.y > 2.3 || q.x < -0.3) return 0.0;
  int slot = int(floor(q.x / 1.6));
  vec2 c = vec2(q.x - float(slot) * 1.6, q.y);
  float dist = 1e5;
  int month = int(uMonth + 0.5);
  int day = int(uDay + 0.5);
  int year = int(uYear + 0.5);
  if (slot == 2 || slot == 5) dist = segDist(c, vec2(0.1, 0.0), vec2(0.9, 2.0));
  else if (slot < 10) {
    int v = slot < 2 ? month : slot < 5 ? day : year;
    int place = slot == 0 || slot == 3 ? 10 : slot == 1 || slot == 4 ? 1 : slot == 6 ? 1000 : slot == 7 ? 100 : slot == 8 ? 10 : 1;
    dist = digit7(c, (v / place) - (v / (place * 10)) * 10);
  } else if (slot >= 12) return clockInk(q - vec2(19.2, 0.0), secs);
  return smoothstep(0.2, 0.12, dist);
}`.trim();

export const trailCam: ShaderEffect = {
  kind: "shader",
  id: "trail-cam",
  name: "Trail cam",
  description:
    "A picture as an infrared trail camera's stills, a new grainy grey shot every second or so under its flash, with the date and time stamped along the bottom, and a figure in a few of the shots, closer each time.",
  category: "horror",
  video: "stills",
  tags: ["horror", "analog-horror", "trail-cam", "infrared", "found-footage", "figure", "date-stamp", "image"],
  loop: 9.6,
  source: glsl(
    `// Trail cam: time held in shots (uInterval apart), each its own grain, shake and exposure, lit by the flash
// in the middle. Over every 8 shots a dark figure stands in shots 4 to 7, closer each time, its eyes shining.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uTint;        // @control color default=#E4EBE2 label="Tint"
uniform float uInterval;   // @control min=0.4 max=4 default=1.2 label="Seconds between shots"
uniform float uGrain;      // @control min=0 max=1 default=0.5 label="Grain"
uniform float uFlash;      // @control min=0 max=1 default=0.6 label="Flash falloff"
uniform bool uFigure;      // @control default=true label="Figure"
uniform float uMonth;      // @control min=1 max=12 default=10 step=1 label="Month"
uniform float uDay;        // @control min=1 max=31 default=31 step=1 label="Day"
uniform float uYear;       // @control min=1970 max=2099 default=2026 step=1 label="Year"
uniform float uClock;      // @control min=0 max=24 default=3 label="Clock starts at (hour)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    DIGIT7,
    CAMCORDER,
    STAMP,
    FIGURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float shot = floor(iTime / uInterval);
  // Each shot shakes a little (wind on the mount).
  vec2 shake = (hash22(vec2(shot, 3.0)) - 0.5) * 0.006;
  vec4 pic = pictureRGBA(uImage, uv + shake);
  // Infrared: foliage reads bright, so weight green; then contrast and a per-shot exposure.
  float l = dot(pic.rgb, vec3(0.15, 0.75, 0.1));
  l = smoothstep(0.05, 0.85, l) * (0.85 + 0.25 * hash12(vec2(shot, 7.0)));
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // The figure: dark against the flash, eyes catching it.
  float k = mod(shot, 8.0);
  if (uFigure && k >= 4.0) {
    float i = k - 4.0;
    float size = i == 0.0 ? 0.32 : i == 1.0 ? 0.48 : i == 2.0 ? 0.72 : 1.5;
    vec2 at = vec2(i == 0.0 ? 0.42 : i == 1.0 ? -0.28 : i == 2.0 ? 0.12 : -0.05, i == 3.0 ? -0.3 : -0.5 + 0.5 * size - 0.02);
    vec2 q = (p - at) / size;
    float d = figure(q);
    l = mix(l, 0.08 + 0.05 * l, smoothstep(0.012, -0.004, d) * smoothstep(-0.55, -0.35, q.y));
    vec2 e = q - vec2(0.0, 0.335);
    e.x = abs(e.x) - 0.037;
    l += 1.6 * exp(-length(e) / 0.009);
  }
  // The flash: bright in the middle, falling off to dark corners.
  l *= mix(1.0, 1.35 * exp(-length(p * vec2(0.8, 1.0)) * 1.6), uFlash);
  l += (hash12(fragCoord + shot * 41.0) - 0.5) * 0.22 * uGrain;
  vec3 col = clamp(l, 0.0, 1.0) * uTint;
  // The stamp bar: dark, with the date and the shot's time in white.
  float unit = iResolution.y * 0.016;
  float bar = step(fragCoord.y, unit * 4.4);
  col = mix(col, vec3(0.02), bar * 0.85);
  float secs = uClock * 3600.0 + shot * 17.0;
  float ink = stampInk((fragCoord - vec2(unit * 2.0, unit * 1.2)) / unit, secs);
  col = mix(col, vec3(1.0), ink);
  fragColor = vec4(col, max(pic.a, max(bar * 0.85, ink)));
}`,
  ),
  presets: [
    { name: "Every half second", values: { uInterval: 0.5 } },
    { name: "Pink IR", values: { uTint: [1, 0.85, 0.95] } },
    { name: "Empty woods", values: { uFigure: false } },
    { name: "Harsh flash", values: { uFlash: 1, uGrain: 0.8 } },
  ],
};

export const ectoplasmWisps: ShaderEffect = {
  kind: "shader",
  id: "ectoplasm-wisps",
  name: "Ectoplasm wisps",
  description:
    "Glowing green trails of ectoplasm spiralling in out of the dark towards the pointer while it hovers, or a point wandering the frame, each fading as it arrives and another rising in its place.",
  category: "horror",
  tags: ["horror", "spectral", "ectoplasm", "wisps", "glow", "interactive", "hover", "cursor", "background"],
  source: glsl(
    `// Ectoplasm wisps: each wisp spirals in from far out to the target over its life. Shaders keep no history, so
// its tail is the same path at earlier times, drawn as segments thinning and fading back from its head.
uniform vec3 uBackground;  // @control color default=#03060A label="Background"
uniform vec3 uColor;       // @control color default=#7DFFB2 label="Ectoplasm"
uniform float uWisps;      // @control min=1 max=8 default=6 step=1 label="Wisps"
uniform float uLength;     // @control min=0.1 max=1 default=0.5 label="Tail length"
uniform float uWidth;      // @control min=2 max=30 default=8 label="Width"
uniform float uGlow;       // @control min=0 max=2 default=1 label="Glow"
uniform float uSpeed;      // @control min=0.2 max=2 default=0.7 label="Speed"`,
    HASH,
    `// Wisp i's random values for the life it is on at time t: its life so far (whole part: which life), its
// start angle, reach and turn, and its wobble phase.
vec4 wispLife(float i, float t, out float life) {
  vec2 h = hash22(vec2(i * 7.1, 2.3));
  float rate = uSpeed / (2.5 + 2.0 * h.x);
  life = t * rate + h.y;
  vec2 g = hash22(vec2(i, floor(life)) * 1.7);
  return vec4(g.x * 6.28318, 0.5 + 0.4 * g.y, (2.0 + 2.0 * g.y) * (h.x < 0.5 ? 1.0 : -1.0), rate);
}

// Where wisp i is at life u (0–1) and time t, heading for target.
vec2 wispAt(float i, vec4 w, float u, float t, vec2 target) {
  float a = w.x + u * w.z;
  float r = w.y * pow(1.0 - u, 1.4);
  vec2 wobble = 0.02 * vec2(sin(t * 2.3 + i * 5.0), sin(t * 1.9 + i * 3.0)) * (1.0 - u);
  return target + r * vec2(cos(a), sin(a)) + wobble;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 idle = vec2(0.3 * aspect * sin(iTime * 0.31), 0.25 * sin(iTime * 0.47 + 1.0));
  vec2 target = mix(idle, (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y, hover);
  float w = uWidth * 0.001;
  float glow = 0.0;
  float core = 0.0;
  int n = int(uWisps + 0.5);
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float life;
    vec4 wl = wispLife(fi, iTime, life);
    float u0 = fract(life);
    // Nothing of it reaches this far from the target (its oldest point is furthest out), so skip it.
    if (length(p - target) > wl.y * pow(1.0 - max(u0 - 11.0 * 0.25 * uLength * wl.w, 0.0), 1.4) + 0.06 + 10.0 * w) continue;
    vec2 prev = wispAt(fi, wl, u0, iTime, target);
    // Fades in as it rises and out as it arrives.
    float fadeLife = smoothstep(0.0, 0.15, u0) * (1.0 - smoothstep(0.8, 1.0, u0));
    for (int k = 1; k < 12; k++) {
      float dt = float(k) * 0.25 * uLength;
      float u = u0 - dt * wl.w;
      // Its tail stops where this life began.
      if (u < 0.0) break;
      vec2 s = wispAt(fi, wl, u, iTime - dt, target);
      float along = float(k) / 12.0;
      vec2 pa = p - prev;
      vec2 ba = s - prev;
      float d = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0));
      float hw = w * (1.0 - 0.85 * along);
      float fade = fadeLife * (1.0 - along);
      glow += exp(-d / (2.5 * hw)) * fade * 0.33;
      core = max(core, (1.0 - smoothstep(0.4 * hw, hw, d)) * fade);
      prev = s;
    }
  }
  vec3 col = uBackground + uColor * glow * uGlow + mix(uColor, vec3(1.0), 0.6) * core;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Poltergeist", values: { uColor: [0.55, 0.75, 1], uWisps: 8, uSpeed: 1.2 } },
    { name: "Bile", values: { uColor: [0.8, 1, 0.25], uWidth: 14 } },
    { name: "Single spirit", values: { uWisps: 1, uLength: 1, uWidth: 14 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

export const spiritOrbs: ShaderEffect = {
  kind: "shader",
  id: "spirit-orbs",
  name: "Spirit orbs",
  description:
    "Pale translucent orbs over a picture, like the ones that turn up in flash photos of haunted houses, drifting like dust and every so often darting off in a streak before drifting on.",
  category: "horror",
  video: "filter",
  tags: ["horror", "spectral", "orbs", "ghost", "dust", "bokeh", "paranormal", "image"],
  source: glsl(
    `// Spirit orbs: each drifts on slow noise; at the end of each of its periods it darts a set way, stretching
// along the dart. Its place wraps round the frame, so a dart off one side comes back on the other.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uColor;       // @control color default=#E6F2FF label="Orbs"
uniform float uCount;      // @control min=1 max=24 default=14 step=1 label="Orbs"
uniform float uSize;       // @control min=0.3 max=3 default=1 label="Size"
uniform float uOpacity;    // @control min=0 max=1 default=0.55 label="Opacity"
uniform float uDart;       // @control min=0 max=1 default=0.6 label="Darting"
uniform float uDim;        // @control min=0 max=1 default=0.3 label="Dim the picture"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb * (1.0 - 0.45 * uDim);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 span = vec2(aspect, 1.0) + 0.2;
  int n = int(uCount + 0.5);
  float a = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi * 3.7, 1.9));
    vec2 g = hash22(vec2(fi * 1.3, 8.1));
    float period = 2.5 + 4.0 * g.x;
    float life = iTime / period + g.y * 5.0;
    float dart = smoothstep(0.9, 0.97, fract(life));
    vec2 dir = normalize(hash22(vec2(fi, 4.4)) - 0.5);
    vec2 drift = 0.05 * vec2(sin(iTime * 0.21 + fi * 9.0) + 0.5 * sin(iTime * 0.53 + fi), sin(iTime * 0.17 + fi * 4.0) + 0.5 * sin(iTime * 0.47 + fi * 2.0));
    vec2 c = mod(h * span + drift + dir * (floor(life) + dart) * 0.3 * uDart, span) - 0.1;
    float r = (0.012 + 0.03 * fract(h.x * 13.0)) * uSize;
    // Stretched along the dart while it darts.
    vec2 d = p - c;
    float speed = dart * (1.0 - dart) * 4.0 * uDart;
    float along = dot(d, dir);
    d = d - dir * along + dir * along / (1.0 + 3.0 * speed);
    float dist = length(d);
    float edge = smoothstep(r, 0.82 * r, dist);
    float ring = edge * smoothstep(0.55 * r, r, dist);
    float flicker = 0.75 + 0.25 * sin(iTime * (1.0 + g.x) + fi);
    a += (0.18 * edge + 0.5 * ring + 0.35 * exp(-dist / (0.25 * r)) * edge) * flicker;
  }
  col = 1.0 - (1.0 - col) * (1.0 - uColor * clamp(a * uOpacity, 0.0, 1.0));
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Swarm", values: { uCount: 24, uSize: 0.6, uDart: 1 } },
    { name: "Few and large", values: { uCount: 4, uSize: 2.5, uOpacity: 0.4 } },
    { name: "Green", values: { uColor: [0.7, 1, 0.8] } },
    { name: "Calm", values: { uDart: 0, uDim: 0 } },
  ],
};

export const creepingDark: ShaderEffect = {
  kind: "shader",
  id: "creeping-dark",
  name: "Creeping dark",
  description:
    "Darkness with tendril edges slowly closing in from the corners of a picture and drawing back, recoiling from the pointer while it hovers as if from a torch.",
  category: "horror",
  video: "interactive",
  tags: ["horror", "creature", "vignette", "darkness", "tendrils", "interactive", "hover", "image"],
  loop: 12,
  source: glsl(
    `// Creeping dark: dark where the distance to the frame's middle (between a box and a circle) passes a front
// that comes in and goes out over the cycle, broken into tendrils by noise; the pointer pushes it back.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uDark;        // @control color default=#020103 label="Darkness"
uniform vec3 uRim;         // @control color default=#5A0A12 label="Edge"
uniform float uAmount;     // @control min=0 max=1 default=0.55 label="How far it comes"
uniform float uTendrils;   // @control min=0 max=1 default=0.6 label="Tendrils"
uniform float uRecoil;     // @control min=0 max=1 default=0.7 label="Recoil from the pointer"
uniform float uCycle;      // @control min=4 max=30 default=12 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.7 label="Closed (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 e = p / vec2(0.5 * aspect, 0.5);
  float r = mix(max(abs(e.x), abs(e.y)), length(e), 0.6);
  float hover = clamp(iPointer.z, 0.0, 1.0);
  float closed = uAnimate ? 0.5 - 0.5 * cos(6.28318 * iTime / uCycle) : uProgress;
  closed *= uAmount * (1.0 - 0.6 * uRecoil * hover);
  float front = 1.2 - 0.95 * closed;
  // Pushed back round the pointer, as if from a light.
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y;
  front += hover * uRecoil * 0.6 * exp(-length(p - pointer) / 0.18);
  // Tendrils: noise round the edge, reaching in and curling slowly.
  float ang = atan(e.y, e.x);
  float t = fbm(vec2(ang * 2.5 + 0.3 * sin(iTime * 0.2), r * 3.0 - iTime * 0.15), 5);
  float fingers = pow(vnoise(vec2(ang * 9.0, iTime * 0.1)), 3.0);
  float edge = r + (t - 0.5) * 0.35 * uTendrils + fingers * 0.25 * uTendrils;
  float dark = smoothstep(front - 0.08, front + 0.02, edge);
  float rim = exp(-abs(edge - front + 0.03) / 0.03) * (1.0 - dark);
  vec3 col = pic.rgb * (1.0 - 0.35 * closed * smoothstep(0.2, 1.0, r));
  col = mix(col, uRim, rim * 0.6);
  col = mix(col, uDark, dark);
  fragColor = vec4(col, max(pic.a, dark));
}`,
  ),
  presets: [
    { name: "Smothering", values: { uAmount: 1, uTendrils: 1 } },
    { name: "Gentle", values: { uAmount: 0.45, uTendrils: 0.3, uRim: [0.05, 0.05, 0.08] } },
    { name: "Sickly", values: { uDark: [0.02, 0.04, 0.02], uRim: [0.3, 0.45, 0.1] } },
    { name: "Still", values: { uAnimate: false } },
  ],
};

export const shadowHands: ShaderEffect = {
  kind: "shader",
  id: "shadow-hands",
  name: "Shadow hands",
  description:
    "The shadows of long-fingered hands reaching in over a picture from the edges of the frame one after another, fingers spread, closing on nothing and drawing back.",
  category: "horror",
  video: "filter",
  tags: ["horror", "creature", "shadow", "hands", "reach", "silhouette", "image"],
  loop: 9,
  source: glsl(
    `// Shadow hands: each hand a distance field (forearm, palm, four long two-jointed fingers and a thumb) that
// reaches in along its own line from an edge, curls its fingers at the furthest point and draws back.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uShadow;      // @control color default=#050307 label="Shadow"
uniform float uDarkness;   // @control min=0 max=1 default=0.8 label="Darkness"
uniform float uSoftness;   // @control min=0 max=1 default=0.35 label="Softness"
uniform float uSize;       // @control min=0.3 max=1.5 default=0.8 label="Size"
uniform float uHands;      // @control min=1 max=3 default=3 step=1 label="Hands"
uniform float uCycle;      // @control min=3 max=20 default=9 label="Cycle (s)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// A hand pointing along +x, its palm at the origin (units of its length); curl 0 spread, 1 clenched.
float hand(vec2 q, float curl) {
  float d = capsule(q, vec2(-3.0, 0.0), vec2(0.0, 0.0), 0.1);
  vec2 b = abs(q - vec2(0.12, 0.0)) - vec2(0.12, 0.11);
  d = smin(d, length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.04, 0.05);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float spread = (fi - 1.5) * (0.16 - 0.1 * curl);
    float len = (fi == 0.0 || fi == 3.0 ? 0.2 : 0.25) * (1.0 - 0.15 * curl);
    vec2 base = vec2(0.26, (fi - 1.5) * 0.068);
    // Seen from above, curling fingers shorten and close in; a tremor keeps them alive.
    float a1 = spread;
    vec2 j1 = base + len * vec2(cos(a1), sin(a1));
    float a2 = a1 - 0.35 * curl * sign(fi - 1.5) + 0.12 * sin(iTime * 3.0 + fi * 1.7);
    vec2 j2 = j1 + 0.85 * len * (1.0 - 0.65 * curl) * vec2(cos(a2), sin(a2));
    d = smin(d, capsule(q, base, j1, 0.03), 0.03);
    d = smin(d, capsule(q, j1, j2, 0.024), 0.02);
  }
  vec2 t1 = vec2(0.1, 0.12);
  vec2 t2 = t1 + vec2(0.1, 0.1 - 0.08 * curl);
  d = smin(d, capsule(q, t1, t2, 0.034), 0.04);
  d = smin(d, capsule(q, t2, t2 + vec2(0.1, 0.02 - 0.06 * curl), 0.028), 0.02);
  return d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float S = 0.45 * uSize;
  float shade = 0.0;
  int n = int(uHands + 0.5);
  for (int i = 0; i < 3; i++) {
    if (i >= n) break;
    float fi = float(i);
    // From the left, the right and the bottom, in turn.
    vec2 from = i == 0 ? vec2(-0.5 * aspect, 0.12) : i == 1 ? vec2(0.5 * aspect, -0.08) : vec2(0.15 * aspect, -0.5);
    vec2 dir = normalize(i == 0 ? vec2(1.0, -0.25) : i == 1 ? vec2(-1.0, 0.3) : vec2(-0.2, 1.0));
    float u = fract(iTime / uCycle - fi / 3.0);
    float reach = smoothstep(0.0, 0.4, u) * (1.0 - smoothstep(0.62, 0.95, u));
    float curl = smoothstep(0.35, 0.5, u) * (1.0 - smoothstep(0.58, 0.7, u));
    vec2 palm = from + dir * (reach * 0.75 - 0.45) * S / 0.45;
    vec2 q = p - palm;
    vec2 h = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x))) / S;
    if (i == 1) h.y = -h.y;
    float d = hand(h, curl) * S;
    float soft = 0.002 + 0.03 * uSoftness;
    shade = max(shade, smoothstep(soft, -soft, d));
  }
  vec3 col = mix(pic.rgb, pic.rgb * uShadow * 4.0, shade * uDarkness);
  col = mix(col, uShadow, shade * uDarkness * 0.6);
  fragColor = vec4(col, max(pic.a, shade * uDarkness));
}`,
  ),
  presets: [
    { name: "Sharp", values: { uSoftness: 0 } },
    { name: "One hand", values: { uHands: 1, uSize: 1.2 } },
    { name: "Faint", values: { uDarkness: 0.45, uSoftness: 0.7 } },
    { name: "Slow", values: { uCycle: 16 } },
  ],
};

/** The horror shaders. */
export const horrorShaders: ShaderEffect[] = [vhsTracking, nightVisionCam, signalLost, trailCam, ghostApparition, ectoplasmWisps, spiritOrbs, eyesInTheDark, creepingDark, shadowHands];
