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
    `float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Distance to the figure, in units of its height (0 at its middle, its head at the top).
float figure(vec2 q) {
  float head = length(q - vec2(0.0, 0.33)) - 0.095;
  float shoulders = (length((q - vec2(0.0, 0.12)) / vec2(0.17, 0.085)) - 1.0) * 0.085;
  float robe = max(abs(q.x) - (0.15 + 0.12 * (0.12 - q.y)), q.y - 0.12);
  return smin(smin(head, shoulders, 0.06), robe, 0.04);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
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

/** The horror shaders. */
export const horrorShaders: ShaderEffect[] = [vhsTracking, nightVisionCam, signalLost, ghostApparition, eyesInTheDark];
