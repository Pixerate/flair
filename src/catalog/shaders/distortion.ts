import { glsl, HASH, NOISE, ROTATE, SPECTRUM } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/**
 * `centreAt(centre, follow)`: the centre of a distortion in pixels. It drifts
 * gently around `centre` (0–1 across the frame) and moves to the pointer while
 * it hovers, when `follow` is on.
 */
const CENTRE = `
vec2 centreAt(vec2 centre, bool follow) {
  vec2 drift = vec2(0.03 * sin(iTime * 0.37), 0.025 * cos(iTime * 0.29));
  vec2 idle = (centre + drift) * iResolution.xy;
  float h = follow ? clamp(iPointer.z, 0.0, 1.0) : 0.0;
  return mix(idle, iPointer.xy, h);
}`.trim();

export const twirl: ShaderEffect = {
  kind: "shader",
  id: "twirl",
  name: "Twirl",
  description: "A picture twisted into a swirl that winds and unwinds around the pointer or a centre, strongest in the middle.",
  category: "distortion",
  video: "interactive",
  tags: ["distortion", "swirl", "image", "interactive", "hover"],
  source: glsl(
    `// Twirl: the picture swirled around a centre, the twist falling off with radius.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uTwist;      // @control min=-12 max=12 default=5 label="Twist (radians)"
uniform float uRadius;     // @control min=0.05 max=1.2 default=0.45 label="Radius"
uniform float uSpeed;      // @control min=0 max=3 default=0.6 label="Wind speed (0 holds it)"
uniform vec2 uCentre;      // @control min=0 max=1 default=0.5,0.5 label="Centre"
uniform bool uFollow;      // @control default=true label="Follow the pointer"
${BACKDROP_CONTROLS}`,
    ROTATE,
    PICTURE,
    CENTRE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = centreAt(uCentre, uFollow);
  vec2 d = fragCoord - c;
  float R = uRadius * iResolution.y;
  float f = clamp(1.0 - length(d) / R, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  float swing = cos(iTime * uSpeed);
  d = rot(uTwist * swing * f * f) * d;
  fragColor = pictureRGBA(uImage, (c + d) / iResolution.xy);
}`,
  ),
  presets: [
    { name: "Whirlpool", values: { uTwist: 10, uRadius: 0.8, uSpeed: 0.3 } },
    { name: "Flick", values: { uTwist: -3, uRadius: 0.25, uSpeed: 2 } },
  ],
};

export const pinchBulge: ShaderEffect = {
  kind: "shader",
  id: "pinch-bulge",
  name: "Pinch & bulge",
  description: "A picture swelling out like a bubble or sucked in to a point around the pointer or a centre.",
  category: "distortion",
  video: "interactive",
  tags: ["distortion", "bulge", "pinch", "image", "interactive", "hover"],
  source: glsl(
    `// Pinch & bulge: the picture bulged out (positive) or pinched in (negative) inside a radius.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uStrength;   // @control min=-1 max=1 default=0.7 label="Pinch ← → Bulge"
uniform float uRadius;     // @control min=0.05 max=1 default=0.4 label="Radius"
uniform bool uAnimate;     // @control default=true label="Animate (swing between pinch and bulge)"
uniform float uSpeed;      // @control min=0.1 max=4 default=1 label="Swing speed"
uniform vec2 uCentre;      // @control min=0 max=1 default=0.5,0.5 label="Centre"
uniform bool uFollow;      // @control default=true label="Follow the pointer"
${BACKDROP_CONTROLS}`,
    PICTURE,
    CENTRE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 c = centreAt(uCentre, uFollow);
  vec2 d = fragCoord - c;
  float R = uRadius * iResolution.y;
  float t = length(d) / R;
  float s = uAnimate ? uStrength * cos(iTime * uSpeed) : uStrength;
  float shade = 1.0;
  if (t < 1.0) {
    // A power curve that meets the untouched picture at the rim: above 1 magnifies the middle, below 1 shrinks it.
    float e = exp(s * 1.3);
    d *= pow(max(t, 1e-4), e - 1.0);
    shade = 1.0 + 0.18 * s * (1.0 - t) * (1.0 - t);
  }
  vec4 pic = pictureRGBA(uImage, (c + d) / iResolution.xy);
  fragColor = vec4(pic.rgb * shade, pic.a);
}`,
  ),
  presets: [
    { name: "Bubble", values: { uStrength: 1, uRadius: 0.3, uAnimate: false } },
    { name: "Black hole", values: { uStrength: -1, uRadius: 0.6, uAnimate: false } },
  ],
};

export const fisheye: ShaderEffect = {
  kind: "shader",
  id: "fisheye",
  name: "Fisheye",
  description: "A picture seen through a fisheye lens, bulging in the middle and curving to the corners, over the whole frame or in a round lens.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "lens", "fisheye", "barrel", "image"],
  source: glsl(
    `// Fisheye: an equidistant fisheye projection of a flat picture, framed or in a circle.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uStrength;   // @control min=0 max=1 default=0.75 label="Strength (field of view)"
uniform float uZoom;       // @control min=0.5 max=2 default=1 label="Zoom"
uniform bool uLens;        // @control default=false label="Round lens"
uniform float uRadius;     // @control min=0.1 max=0.7 default=0.42 label="Lens radius"
uniform float uVignette;   // @control min=0 max=1 default=0.35 label="Vignette"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 mid = 0.5 * iResolution.xy;
  vec2 d = fragCoord - mid;
  // The unit radius: the half diagonal (corners stay corners) or the lens.
  float unit = uLens ? uRadius * iResolution.y : 0.5 * length(iResolution.xy);
  float r = length(d) / unit;
  vec4 col = pictureRGBA(uImage, fragCoord / iResolution.xy);
  if (r < 1.0) {
    // A ray at angle r * fov / 2 lands at tan(angle) on the flat picture.
    float fov = mix(0.02, 2.9, uStrength);
    float src = tan(r * 0.5 * fov) / tan(0.5 * fov);
    vec2 p = mid + d / max(length(d), 1e-5) * src * unit / uZoom;
    vec4 lens = pictureRGBA(uImage, p / iResolution.xy);
    lens.rgb *= 1.0 - uVignette * pow(r, 2.5);
    float edge = uLens ? 1.0 - smoothstep(1.0 - 2.0 / unit, 1.0, r) : 1.0;
    col = mix(col, lens, edge);
  }
  if (uLens) {
    float rim = exp(-pow((r - 1.0) * unit / max(unit * 0.02, 1.5), 2.0));
    col.rgb = mix(col.rgb, vec3(0.06), rim * 0.6);
  } else {
    col.rgb *= 1.0 - uVignette * smoothstep(0.98, 1.0, r);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Doorway peephole", values: { uLens: true, uStrength: 1, uRadius: 0.48, uVignette: 0.6 } },
    { name: "Action cam", values: { uStrength: 0.45, uZoom: 1.1, uVignette: 0.15 } },
  ],
};

export const mirrorTiles: ShaderEffect = {
  kind: "shader",
  id: "mirror-tiles",
  name: "Mirror tiles",
  description: "A picture folded into mirrored kaleidoscope tiles, square or hexagonal, slowly turning and drifting.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "kaleidoscope", "mirror", "tiles", "image"],
  source: glsl(
    `// Mirror tiles: each tile folds the picture about its centre into mirrored wedges.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uFold;         // @control min=2 max=8 step=2 default=6 label="Mirror fold"
uniform bool uHex;         // @control default=false label="Hexagonal tiles"
uniform float uTiles;      // @control min=1 max=8 default=2 label="Tiles down"
uniform float uZoom;       // @control min=0.2 max=2 default=1 label="Picture scale"
uniform float uSpin;       // @control min=-1 max=1 default=0.1 label="Spin"
uniform float uDrift;      // @control min=0 max=1 default=0.2 label="Drift"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * uTiles;
  p += uDrift * iTime * vec2(0.13, 0.07);
  vec2 q;
  if (uHex) {
    vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(p, p - vec2(0.5, 0.866)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + vec2(0.5, 0.5)) * s);
    q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  } else {
    q = fract(p) - 0.5;
  }
  float sector = 6.28318 / float(uFold);
  float a = mod(atan(q.y, q.x) + uSpin * iTime, sector);
  a = min(a, sector - a);
  q = length(q) * vec2(cos(a), sin(a));
  vec2 pan = uDrift * 0.15 * vec2(sin(iTime * 0.21), cos(iTime * 0.17));
  fragColor = pictureRGBA(uImage, 0.5 + pan + q * uZoom);
}`,
  ),
  presets: [
    { name: "Hex jewel", values: { uHex: true, uFold: 6, uTiles: 2.5, uZoom: 0.5 } },
    { name: "Four-way", values: { uFold: 4, uTiles: 2, uSpin: 0, uDrift: 0.4 } },
  ],
};

export const waveWarp: ShaderEffect = {
  kind: "shader",
  id: "wave-warp",
  name: "Wave warp",
  description: "A picture rippling in sine waves sideways, up and down or both, like a flag or a reflection on water, with lit crests.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "wave", "flag", "water", "image"],
  source: glsl(
    `// Wave warp: rows and/or columns of the picture shifted along travelling sine waves.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform bool uRows;        // @control default=true label="Shift rows sideways"
uniform bool uColumns;     // @control default=false label="Shift columns up and down"
uniform float uAmplitude;  // @control min=0 max=0.08 default=0.02 label="Amplitude"
uniform float uFrequency;  // @control min=0.5 max=40 default=6 label="Waves across"
uniform float uSpeed;      // @control min=-6 max=6 default=2 label="Speed"
uniform float uShade;      // @control min=0 max=1 default=0.3 label="Crest shading"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `float wave(float x) {
  return sin(x) + 0.3 * sin(2.3 * x + 1.0);
}
float slope(float x) {
  return cos(x) + 0.69 * cos(2.3 * x + 1.0);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float py = uv.y * uFrequency * 6.28318 - iTime * uSpeed;
  float px = uv.x * uFrequency * 6.28318 - iTime * uSpeed;
  vec2 offset = vec2(uRows ? wave(py) : 0.0, uColumns ? wave(px) : 0.0) * uAmplitude;
  float light = (uRows ? slope(py) : 0.0) + (uColumns ? slope(px) : 0.0);
  vec4 pic = pictureRGBA(uImage, uv + offset);
  float k = uShade * 0.18 * light * clamp(uAmplitude * 40.0, 0.0, 1.0);
  fragColor = vec4(pic.rgb * (1.0 + k) + max(k, 0.0) * 0.4, pic.a);
}`,
  ),
  presets: [
    { name: "Flag", values: { uRows: false, uColumns: true, uAmplitude: 0.03, uFrequency: 2, uSpeed: 3, uShade: 0.8 } },
    { name: "Reflection", values: { uRows: true, uColumns: false, uAmplitude: 0.006, uFrequency: 32, uSpeed: 3, uShade: 0.2 } },
    { name: "Jelly", values: { uRows: true, uColumns: true, uAmplitude: 0.015, uFrequency: 3, uSpeed: 1.5 } },
  ],
};

export const ribbedGlass: ShaderEffect = {
  kind: "shader",
  id: "ribbed-glass",
  name: "Ribbed glass",
  description: "A picture seen through fluted glass: strips of refracted image with bright and dark rib edges, clear or frosted.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "glass", "fluted", "reeded", "frosted", "image"],
  source: glsl(
    `// Ribbed glass: each rib is a little cylinder lens that flips and squeezes the picture behind it.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uWidth;      // @control min=4 max=120 default=28 label="Rib width (px)"
uniform float uAngle;      // @control min=-90 max=90 default=0 label="Rib angle (°)"
uniform float uRefraction; // @control min=0 max=1 default=0.5 label="Refraction"
uniform float uFrost;      // @control min=0 max=1 default=0.15 label="Frost"
uniform float uHighlight;  // @control min=0 max=1 default=0.4 label="Edge highlights"
uniform float uDispersion; // @control min=0 max=1 default=0 label="Dispersion (rainbow edges)"
uniform vec3 uTint;        // @control color default=#F2F7FA label="Glass tint"
${BACKDROP_CONTROLS}`,
    HASH,
    SPECTRUM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float a = radians(uAngle);
  vec2 across = vec2(cos(a), sin(a));
  float s = dot(fragCoord - 0.5 * iResolution.xy, across) / uWidth;
  float f = fract(s) - 0.5;
  vec2 bend = -across * f * uWidth * 3.0 * uRefraction;
  // Frost: a small disc of samples, jittered per pixel. With dispersion each sample also takes
  // its colour of the spectrum and bends by its own amount, so edges split into a rainbow.
  float blur = uFrost * 14.0;
  float spin = hash12(fragCoord) * 6.28318;
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float ang = fi * 2.39996 + spin;
    vec2 o = blur * sqrt((fi + 0.5) / 9.0) * vec2(cos(ang), sin(ang));
    float x = (fi + 0.5) / 9.0;
    vec3 w = uDispersion > 0.0 ? spectrum(x) : vec3(1.0);
    vec4 c = pictureRGBA(uImage, (fragCoord + bend * (1.0 + uDispersion * (x - 0.5)) + o) / iResolution.xy);
    sum += c.rgb * w;
    weight += w;
    alpha += c.a;
  }
  vec4 pic = vec4(sum / weight, alpha / 9.0);
  vec3 col = pic.rgb * uTint;
  col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))) + 0.08, uFrost * 0.2);
  float hi = exp(-pow((f - 0.3) * 12.0, 2.0));
  float lo = smoothstep(0.38, 0.5, abs(f));
  col = col * (1.0 - 0.25 * lo * uHighlight) + hi * uHighlight * 0.35;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Reeded", values: { uWidth: 14, uRefraction: 0.7, uFrost: 0 } },
    { name: "Wide flutes", values: { uWidth: 70, uRefraction: 0.4, uHighlight: 0.6 } },
    { name: "Frosted diagonal", values: { uAngle: 30, uFrost: 0.8, uWidth: 36 } },
    { name: "Prismatic", values: { uWidth: 40, uRefraction: 0.6, uDispersion: 0.8, uFrost: 0 } },
  ],
};

export const showerGlass: ShaderEffect = {
  kind: "shader",
  id: "shower-glass",
  name: "Shower glass",
  description: "A picture blurred and bent behind textured shower-door glass, pebbled or streaked with rain, catching small highlights.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "glass", "privacy", "rain", "pebble", "image"],
  source: glsl(
    `// Shower glass: a bumpy height field refracts and blurs the picture, lit from the top left.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait2} label="Image"
uniform bool uRain;        // @control default=false label="Rain pattern (else pebbled)"
uniform float uScale;      // @control min=4 max=60 default=16 label="Bumps down"
uniform float uRefraction; // @control min=0 max=1 default=0.5 label="Refraction"
uniform float uBlur;       // @control min=0 max=1 default=0.35 label="Blur"
uniform float uDim;        // @control min=0 max=1 default=0.15 label="Dim"
uniform float uHighlight;  // @control min=0 max=1 default=0.5 label="Highlights"
uniform float uFlow;       // @control min=0 max=1 default=0.1 label="Flow"
uniform float uDispersion; // @control min=0 max=1 default=0 label="Dispersion (rainbow edges)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    SPECTRUM,
    PICTURE,
    `// Round domes on a jittered grid: 1 at a pebble's top, 0 between.
float pebbles(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.15 + 0.7 * hash22(i + g);
      d = min(d, length(g + o - f));
    }
  }
  return 1.0 - smoothstep(0.0, 0.75, d);
}
float height(vec2 p) {
  float t = iTime * uFlow;
  if (uRain) {
    float streak = vnoise(vec2(p.x * 2.5, p.y * 0.3 + t * 2.0));
    return 0.55 * streak + 0.45 * pebbles(p * 1.7 + vec2(0.0, t * 3.0));
  }
  return pebbles(p + vec2(0.0, t) + 0.3 * vnoise(p * 0.7));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  float e = 0.03;
  vec2 grad = vec2(height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0)), height(p + vec2(0.0, e)) - height(p - vec2(0.0, e))) / (2.0 * e);
  vec2 uv = fragCoord / iResolution.xy - grad * uRefraction * 0.02;
  float blur = uBlur * 0.012;
  float spin = hash12(fragCoord) * 6.28318;
  vec2 split = -grad * uRefraction * 0.01 * uDispersion;
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float ang = fi * 2.39996 + spin;
    float x = (fi + 0.5) / 8.0;
    vec3 w = uDispersion > 0.0 ? spectrum(x) : vec3(1.0);
    vec4 c = pictureRGBA(uImage, uv + split * (x - 0.5) + blur * sqrt((fi + 0.5) / 8.0) * vec2(cos(ang) * iResolution.y / iResolution.x, sin(ang)));
    sum += c.rgb * w;
    weight += w;
    alpha += c.a;
  }
  vec4 pic = vec4(sum / weight, alpha / 8.0);
  vec3 n = normalize(vec3(-grad * 0.12, 1.0));
  vec3 h = normalize(normalize(vec3(-0.5, 0.6, 0.6)) + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), 60.0);
  float rim = clamp(dot(n.xy, vec2(-0.6, 0.6)) * 2.0, -1.0, 1.0);
  vec3 col = pic.rgb * (1.0 - uDim) * (1.0 + 0.12 * rim * uHighlight) + spec * uHighlight * 0.8;
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Rain door", values: { uRain: true, uScale: 10, uFlow: 0.3, uBlur: 0.3 } },
    { name: "Privacy", values: { uScale: 28, uRefraction: 0.8, uBlur: 0.9, uDim: 0.25 } },
    { name: "Prismatic", values: { uScale: 14, uRefraction: 0.6, uBlur: 0.25, uDispersion: 0.8 } },
  ],
};

export const datamosh: ShaderEffect = {
  kind: "shader",
  id: "datamosh",
  name: "Datamosh",
  description: "A picture breaking down like a corrupted video stream in bursts: macroblocks smear along a false motion field, stick in the wrong place and bleed colour.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "datamosh", "glitch", "compression", "image"],
  source: glsl(
    `// Datamosh: block motion vectors applied to a stale frame, stuck blocks and smeared chroma, in bursts.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uBlock;      // @control min=8 max=64 default=24 step=1 label="Macroblock (px)"
uniform float uAmount;     // @control min=0 max=1 default=0.6 label="Amount"
uniform float uSmear;      // @control min=0 max=0.4 default=0.12 label="Smear length"
uniform float uRate;       // @control min=0.2 max=4 default=0.8 label="Bursts per second"
uniform float uBleed;      // @control min=0 max=1 default=0.6 label="Colour bleed"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * uRate;
  float epoch = floor(t);
  float ph = fract(t);
  float on = step(1.0 - uAmount * 0.85, hash12(vec2(epoch, 7.0))) * smoothstep(0.0, 0.08, ph);
  vec2 block = floor(fragCoord / uBlock);
  // One motion vector per macroblock, from a smooth field that changes each burst.
  vec2 field = block * 0.12 + epoch * vec2(3.1, 1.7);
  vec2 mv = vec2(vnoise(field), vnoise(field + 9.7)) * 2.0 - 1.0;
  vec2 disp = mv * uSmear * ph * on * vec2(iResolution.y / iResolution.x, 1.0);
  // Stuck blocks: content from the wrong place, sliding slowly.
  vec2 bh = hash22(block + epoch * 13.0);
  float stuck = on * step(1.0 - 0.3 * uAmount, bh.x);
  vec2 wrong = (floor(bh * 6.0) - 2.5) * uBlock / iResolution.xy;
  vec2 st = uv + stuck * (wrong + mv * 0.02 * ph);
  // Smear: samples along the motion, weighted towards the oldest.
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 6; i++) {
    float k = float(i) / 5.0;
    float w = 0.4 + k;
    acc += w * pictureRGBA(uImage, st - disp * k);
    wsum += w;
  }
  vec4 pic = acc / wsum;
  // Bleed: chroma from the block's corner, dragged further along the motion.
  vec2 chromaUV = (block * uBlock + 0.5) / iResolution.xy - disp * 1.6;
  vec3 smeared = picture(uImage, chromaUV);
  float y = dot(pic.rgb, vec3(0.299, 0.587, 0.114));
  vec3 chroma = mix(pic.rgb - y, smeared - dot(smeared, vec3(0.299, 0.587, 0.114)), uBleed * on);
  vec3 col = y + chroma * (1.0 + 0.4 * on * uBleed);
  // A faint block grid where the stream is broken.
  vec2 edge = abs(fract(fragCoord / uBlock) - 0.5);
  col *= 1.0 - 0.06 * on * step(0.47, max(edge.x, edge.y));
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Melted stream", values: { uAmount: 1, uSmear: 0.3, uRate: 0.4, uBleed: 1 } },
    { name: "Hiccup", values: { uAmount: 0.4, uSmear: 0.05, uRate: 2.5, uBlock: 16 } },
  ],
};

export const polarWarp: ShaderEffect = {
  kind: "shader",
  id: "polar-warp",
  name: "Polar warp",
  description: "A picture wrapped into a circle, as a tiny planet or a tunnel, or a circle unrolled into a strip, slowly turning.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "polar", "tiny-planet", "tunnel", "image"],
  source: glsl(
    `// Polar warp: rectangular → polar (the picture's bottom edge at the centre), or polar → rectangular.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform bool uUnwrap;      // @control default=false label="Unwrap (polar → rectangular)"
uniform bool uInsideOut;   // @control default=false label="Inside out (tunnel)"
uniform float uZoom;       // @control min=0.3 max=3 default=1 label="Zoom"
uniform float uSpin;       // @control min=-0.5 max=0.5 default=0.04 label="Spin (turns/s)"
uniform float uTwist;      // @control min=-2 max=2 default=0 label="Twist"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 st;
  if (uUnwrap) {
    // Across is the angle, up is the radius of the circle inscribed in the picture.
    float r = (uInsideOut ? 1.0 - uv.y : uv.y) * 0.5 / uZoom;
    float a = (uv.x + iTime * uSpin + uTwist * r) * 6.28318;
    st = 0.5 + r * vec2(cos(a), sin(a));
  } else {
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float r = length(p) * 2.0 / uZoom;
    // The angle runs across the picture and back, so the seam is a mirror and does not show.
    float u = fract(atan(p.y, p.x) / 6.28318 + iTime * uSpin + uTwist * r * 0.25);
    u = 1.0 - abs(1.0 - 2.0 * u);
    float v = uInsideOut ? 1.0 - min(r, 1.0) : min(r, 1.0);
    st = vec2(u, v);
  }
  fragColor = pictureRGBA(uImage, st);
}`,
  ),
  presets: [
    { name: "Tiny planet", values: { uUnwrap: false, uInsideOut: false, uZoom: 1.1, uSpin: 0.03 } },
    { name: "Tunnel", values: { uUnwrap: false, uInsideOut: true, uZoom: 0.9, uSpin: -0.05, uTwist: 0.8 } },
    { name: "Unrolled", values: { uUnwrap: true, uZoom: 1, uSpin: 0.02 } },
  ],
};

export const textureDisplace: ShaderEffect = {
  kind: "shader",
  id: "texture-displace",
  name: "Texture displace",
  description: "A picture pushed around by a second, scrolling texture, by its red and green or by its light and shade.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "displacement", "map", "image"],
  source: glsl(
    `// Texture displace: each pixel moved by a displacement map (or its brightness slope) that scrolls.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform sampler2D uMap;    // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Displacement map"
uniform float uStrength;   // @control min=0 max=0.2 default=0.06 label="Strength"
uniform float uScale;      // @control min=0.2 max=4 default=1.5 label="Map scale"
uniform vec2 uScroll;      // @control min=-0.3 max=0.3 default=0.03,0.02 label="Scroll"
uniform bool uSlope;       // @control default=false label="Push by brightness slope (else by red/green)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `// The map, or soft noise while there is none (an empty image control is a 1 × 1 placeholder).
vec3 mapAt(vec2 p) {
  if (textureSize(uMap, 0).x > 1) return texture(uMap, p).rgb;
  return vec3(vnoise(p * 6.0), vnoise(p * 6.0 + 11.3), vnoise(p * 6.0 + 23.1));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 m = uv * uScale + uScroll * iTime;
  vec2 offset;
  if (uSlope) {
    float e = 0.03;
    vec3 w = vec3(0.299, 0.587, 0.114);
    float dx = dot(mapAt(m + vec2(e, 0.0)) - mapAt(m - vec2(e, 0.0)), w);
    float dy = dot(mapAt(m + vec2(0.0, e)) - mapAt(m - vec2(0.0, e)), w);
    offset = vec2(dx, dy) / (2.0 * e) * uStrength * 0.1;
  } else {
    offset = (mapAt(m).rg - 0.5) * 2.0 * uStrength;
  }
  fragColor = pictureRGBA(uImage, uv + offset);
}`,
  ),
  presets: [
    { name: "Embossed", values: { uSlope: true, uStrength: 0.08, uScale: 1, uScroll: [0, 0] } },
    { name: "Drifting channels", values: { uSlope: false, uStrength: 0.03, uScale: 2, uScroll: [0.05, -0.04] } },
  ],
};

export const cornerPin: ShaderEffect = {
  kind: "shader",
  id: "corner-pin",
  name: "Corner pin",
  description: "A picture pinned by its four corners anywhere in the frame, in true perspective, for screen replacements, signs and mock-ups.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "corner pin", "perspective", "homography", "mockup", "screen replacement", "image"],
  source: glsl(
    `// Corner pin: the projective map (homography) taking the picture's unit square to the four pinned corners,
// inverted, so each pixel finds where in the picture it shows; outside the quad is the backdrop.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec2 uTopLeft;        // @control min=-0.5 max=1.5 default=0.12,0.84 label="Top left"
uniform vec2 uTopRight;       // @control min=-0.5 max=1.5 default=0.86,0.92 label="Top right"
uniform vec2 uBottomLeft;     // @control min=-0.5 max=1.5 default=0.18,0.16 label="Bottom left"
uniform vec2 uBottomRight;    // @control min=-0.5 max=1.5 default=0.9,0.24 label="Bottom right"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// The square-to-quad homography (Heckbert): (0,0) to p0, (1,0) to p1, (1,1) to p2, (0,1) to p3.
mat3 squareToQuad(vec2 p0, vec2 p1, vec2 p2, vec2 p3) {
  vec2 d1 = p1 - p2;
  vec2 d2 = p3 - p2;
  vec2 d3 = p0 - p1 + p2 - p3;
  float den = d1.x * d2.y - d2.x * d1.y;
  float g = abs(den) < 1e-8 ? 0.0 : (d3.x * d2.y - d2.x * d3.y) / den;
  float h = abs(den) < 1e-8 ? 0.0 : (d1.x * d3.y - d3.x * d1.y) / den;
  // Columns: the u terms, the v terms, the constants.
  return mat3(p1.x - p0.x + g * p1.x, p1.y - p0.y + g * p1.y, g,
              p3.x - p0.x + h * p3.x, p3.y - p0.y + h * p3.y, h,
              p0.x, p0.y, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 q = inverse(squareToQuad(uBottomLeft, uBottomRight, uTopRight, uTopLeft)) * vec3(uv, 1.0);
  vec2 st = q.xy / q.z;
  // Coverage of the picture's square, a pixel wide at its edges (none behind the eye, where q.z flips).
  vec2 px = max(fwidth(st), vec2(1e-6));
  vec2 inside = min(st, 1.0 - st) / px;
  float cover = q.z > 0.0 ? clamp(min(inside.x, inside.y) + 0.5, 0.0, 1.0) : 0.0;
  vec4 back = vec4(uBackdrop, uBackdropAlpha);
  vec4 pic = pictureRGBA(uImage, clamp(st, 0.0, 1.0));
  float alpha = mix(back.a, pic.a, cover);
  fragColor = vec4(mix(back.rgb * back.a, pic.rgb * pic.a, cover) / max(alpha, 1e-4), alpha);
}`,
  ),
  presets: [
    { name: "Billboard", values: { uTopLeft: [0.1, 0.9], uTopRight: [0.7, 0.8], uBottomLeft: [0.1, 0.25], uBottomRight: [0.7, 0.4], uBackdrop: [0.08, 0.09, 0.12] } },
    { name: "Floor", values: { uTopLeft: [0.3, 0.6], uTopRight: [0.7, 0.6], uBottomLeft: [0.0, 0.05], uBottomRight: [1.0, 0.05] } },
    { name: "Flat", values: { uTopLeft: [0, 1], uTopRight: [1, 1], uBottomLeft: [0, 0], uBottomRight: [1, 0] } },
  ],
};

/** Distortions: swirls, bulges, lenses, mirrors, waves and glass over a picture. */
export const distortionShaders: ShaderEffect[] = [
  twirl,
  pinchBulge,
  fisheye,
  mirrorTiles,
  waveWarp,
  ribbedGlass,
  showerGlass,
  datamosh,
  polarWarp,
  textureDisplace,
  cornerPin,
];
