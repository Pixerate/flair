import { FBM, glsl, HASH, NOISE, PALETTE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { MASK_FAST } from "./glow.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * These read the audio built-ins the wrapper declares: `iAudio` (level,
 * bass, mid, treble, 0–1), `iSpectrum[16]` (64 log-spaced bins, four to a
 * vec4) and `iBeat` (seconds since the last beat, -1 before the first). With
 * no audio at all every one of them is 0, `iBeat` included, so each effect
 * then plays an idle demo (a synthetic 120 bpm beat and spectrum) that a
 * `uDemo` control turns off.
 */

/**
 * `soundDemo()`: whether to play the demo (on, and no audio at all);
 * `level()`/`bass()`/`mid()`/`treble()` (as `sound()`, a vec4), `beat()`
 * (seconds since the last beat, -1 for none) and `spectrum(x)` (0–1, low to
 * high, between bins), from the sound or the demo. Needs a `uDemo` bool
 * control.
 */
const SOUND = `
bool soundDemo() { return uDemo && iBeat == 0.0 && dot(iAudio, iAudio) == 0.0; }
// The demo: a kick every half second, a hat between, and a gently wandering pink-ish spectrum.
float demoKick() { return exp(-mod(iTime, 0.5) * 7.0); }
float demoHat() { return exp(-mod(iTime + 0.25, 0.5) * 16.0); }
vec4 sound() {
  if (!soundDemo()) return iAudio;
  float k = demoKick();
  float mid = 0.4 + 0.12 * sin(iTime * 1.7) + 0.1 * sin(iTime * 3.1);
  return vec4(0.45 + 0.3 * k + 0.1 * mid, 0.3 + 0.65 * k, mid, 0.25 + 0.4 * demoHat() + 0.08 * sin(iTime * 5.3));
}
float beat() { return soundDemo() ? mod(iTime, 0.5) : iBeat; }
float spectrum(float x) {
  x = clamp(x, 0.0, 1.0);
  if (soundDemo()) {
    float tilt = 0.8 - 0.5 * x;
    float wander = 0.6 + 0.25 * sin(iTime * 0.7 + x * 5.0) + 0.1 * sin(x * 23.0 + iTime * 2.3) + 0.07 * sin(x * 47.0 - iTime * 3.7);
    return clamp(tilt * wander + 0.55 * demoKick() * exp(-x * 7.0) + 0.35 * demoHat() * smoothstep(0.55, 0.9, x), 0.0, 1.0);
  }
  float f = x * 63.0;
  int i = int(f);
  int j = min(i + 1, 63);
  return mix(iSpectrum[i / 4][i % 4], iSpectrum[j / 4][j % 4], f - float(i));
}`.trim();

/** `glow(c)`: light as a colour over whatever is behind it (alpha is its brightest channel). */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

const DEMO = `uniform bool uDemo;         // @control default=true label="Demo when silent"`;

export const spectrumBars: ShaderEffect = {
  kind: "shader",
  id: "spectrum-bars",
  name: "Spectrum bars",
  description: "Classic equaliser bars dancing to the music, with peak caps kicked up on each beat and an optional mirrored layout.",
  category: "audio",
  tags: ["audio", "music", "equalizer", "spectrum", "bar", "visualizer", "beat"],
  source: glsl(
    `// Spectrum bars: the spectrum as bars, low to high, coloured by height, with caps that jump on beats.
uniform int uBars;           // @control min=8 max=64 default=32 label="Bars"
uniform float uGap;          // @control min=0 max=0.8 default=0.3 label="Gap"
uniform float uGain;         // @control min=0.3 max=2.5 default=1.1 label="Gain"
uniform vec3 uColorLow;      // @control color default=#22D3EE label="Low colour"
uniform vec3 uColorHigh;     // @control color default=#F43F5E label="High colour"
uniform vec3 uBackground;    // @control color default=#070B16 label="Background"
uniform bool uMirror;        // @control default=false label="Mirrored"
uniform bool uPeaks;         // @control default=true label="Peak caps"
uniform float uRound;        // @control min=0 max=1 default=0.5 label="Rounded"
${DEMO}`,
    SOUND,
    `float box(vec2 p, vec2 hs, float r) {
  vec2 q = abs(p) - hs + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float n = float(uBars);
  // Margins round the bars, and a floor a little up from the bottom (the middle when mirrored).
  float x = (uv.x - 0.06) / 0.88;
  float base = uMirror ? 0.5 : 0.12;
  float room = uMirror ? 0.4 : 0.78;
  float cell = floor(x * n);
  float within = fract(x * n);
  vec3 col = uBackground * (1.0 + 0.25 * (1.0 - uv.y));
  if (x >= 0.0 && x < 1.0) {
    float v = clamp(spectrum((cell + 0.5) / n) * uGain, 0.0, 1.0);
    float h = max(v * room, 2.0 * px);
    // The bar, in pixels from its centre, so corners round alike at any size.
    float barW = (1.0 - uGap) * 0.88 * iResolution.x / n;
    vec2 p = vec2((within - 0.5) * 0.88 * iResolution.x / n, (uv.y - base) * iResolution.y);
    float sideY = uMirror ? abs(p.y) : p.y;
    float r = uRound * barW * 0.5;
    float d = box(vec2(p.x, sideY - h * 0.5 * iResolution.y), vec2(barW * 0.5, h * 0.5 * iResolution.y), r);
    float body = clamp(0.5 - d, 0.0, 1.0);
    float along = clamp(sideY / (room * iResolution.y), 0.0, 1.0);
    vec3 bar = mix(uColorLow, uColorHigh, along);
    // A soft glow under each bar, brighter as it rises.
    float halo = exp(-max(d, 0.0) / (barW * 0.6)) * 0.25 * v;
    col += bar * halo;
    col = mix(col, bar * (0.85 + 0.3 * v), body);
    if (uPeaks) {
      // The cap rides just above the bar, kicked up on each beat and falling back under gravity.
      float b = beat();
      float kick = b >= 0.0 ? max(0.0, 1.0 - b * 3.0) : 0.0;
      float lift = 0.035 + 0.12 * v * kick * kick;
      float capY = (h + lift * room) * iResolution.y;
      float cap = box(vec2(p.x, sideY - capY), vec2(barW * 0.5, max(2.0, 0.008 * iResolution.y)), r * 0.4);
      col = mix(col, mix(bar, vec3(1.0), 0.6), clamp(0.5 - cap, 0.0, 1.0));
    }
    // A faint reflection on the floor.
    if (!uMirror && p.y < 0.0) {
      float rd = box(vec2(p.x, -p.y - h * 0.5 * iResolution.y), vec2(barW * 0.5, h * 0.5 * iResolution.y), r);
      col = mix(col, bar, clamp(0.5 - rd, 0.0, 1.0) * 0.18 * exp(p.y / (0.06 * iResolution.y)));
    }
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Mirrored neon", values: { uMirror: true, uBars: 48, uGap: 0.4, uColorLow: [0.6, 0.2, 1], uColorHigh: [0.2, 1, 0.8] } },
    { name: "Retro LED", values: { uBars: 16, uGap: 0.15, uRound: 0, uColorLow: [0.2, 1, 0.3], uColorHigh: [1, 0.2, 0.1], uBackground: [0, 0, 0] } },
    { name: "Minimal", values: { uBars: 64, uGap: 0.5, uRound: 1, uPeaks: false, uColorLow: [1, 1, 1], uColorHigh: [1, 1, 1], uBackground: [0.06, 0.06, 0.07] } },
  ],
};

export const circularSpectrum: ShaderEffect = {
  kind: "shader",
  id: "circular-spectrum",
  name: "Circular spectrum",
  description: "A ring of spectrum bars radiating round a centre picture or colour, which swells on the bass.",
  category: "audio",
  video: "filter",
  tags: ["audio", "music", "spectrum", "radial", "ring", "visualizer", "album-art", "overlay"],
  transparent: true,
  source: glsl(
    `// Circular spectrum: bars radiating from a ring, the spectrum mirrored round it, a picture in the middle.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Centre picture"
uniform bool uShowImage;     // @control default=true label="Show the picture"
uniform vec3 uCenter;        // @control color default=#1E1B4B label="Centre colour"
uniform float uRadius;       // @control min=0.1 max=0.4 default=0.22 label="Radius"
uniform int uBars;           // @control min=24 max=180 default=96 label="Bars"
uniform float uLength;       // @control min=0.05 max=0.4 default=0.2 label="Bar length"
uniform vec3 uColorA;        // @control color default=#38BDF8 label="Colour 1"
uniform vec3 uColorB;        // @control color default=#E879F9 label="Colour 2"
uniform vec3 uBackground;    // @control color default=#05060F label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform float uSpin;         // @control min=-1 max=1 default=0.1 label="Spin"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    SOUND,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float pulse = 1.0 + 0.12 * s.y * s.y;
  float r0 = uRadius * pulse;
  float r = length(p);
  float a = atan(p.x, p.y) + iTime * uSpin;
  // Bars round the ring: the spectrum low to high from the top down each side, so it is symmetric.
  float n = float(uBars);
  float t = fract(a / 6.28318);
  float cell = floor(t * n);
  float mirrored = abs((cell + 0.5) / n * 2.0 - 1.0);
  float v = spectrum(1.0 - mirrored);
  float len = uLength * (0.08 + v);
  float within = abs(fract(t * n) - 0.5) * 6.28318 * r / n;
  float width = 0.45 * 6.28318 * r0 / n;
  float radial = max(r0 + 0.01 - r, r - (r0 + 0.01 + len));
  float bar = clamp(0.5 - max(radial, within - width) / px, 0.0, 1.0);
  vec3 tint = mix(uColorA, uColorB, mirrored);
  vec4 acc = vec4(uBackground, uBackgroundAlpha);
  // Glow round the ring with the level.
  float halo = exp(-abs(r - r0 - 0.02) / (0.04 + 0.06 * s.x)) * (0.3 + 0.7 * s.x);
  vec3 glowCol = tint * halo * 0.6;
  acc.rgb += glowCol;
  acc.a = max(acc.a, clamp(halo * 0.6, 0.0, 1.0));
  acc = mix(acc, vec4(tint * (0.8 + 0.5 * v), 1.0), bar);
  // The centre: the picture (or the colour) in a disc, with a thin ring.
  float disc = clamp((r0 - r) / px, 0.0, 1.0);
  if (disc > 0.0) {
    vec2 uv = p / (2.0 * r0) + 0.5;
    vec4 pic = uShowImage ? pictureRGBA(uImage, vec2(uv.x, uv.y)) : vec4(uCenter, 1.0);
    vec3 c = mix(uCenter, pic.rgb, pic.a) * (0.9 + 0.2 * s.y);
    acc = mix(acc, vec4(c, 1.0), disc);
  }
  float rim = clamp(1.0 - abs(r - r0) / (1.5 * px), 0.0, 1.0);
  acc = mix(acc, vec4(mix(tint, vec3(1.0), 0.5), 1.0), rim * 0.8);
  fragColor = acc;
}`,
  ),
  presets: [
    { name: "Colour disc", values: { uShowImage: false, uCenter: [0.95, 0.3, 0.45], uColorA: [1, 0.8, 0.3], uColorB: [1, 0.3, 0.5] } },
    { name: "Bare ring", values: { uShowImage: false, uCenter: [0, 0, 0], uBars: 140, uLength: 0.3 } },
    { name: "Dense", values: { uBars: 180, uLength: 0.32, uRadius: 0.18, uColorA: [0.3, 1, 0.7], uColorB: [0.2, 0.5, 1] } },
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const waveformLine: ShaderEffect = {
  kind: "shader",
  id: "waveform-line",
  name: "Waveform line",
  description: "A smooth glowing oscilloscope line drawn from the music's spectrum, with fainter echoes trailing it.",
  category: "audio",
  tags: ["audio", "music", "waveform", "oscilloscope", "line", "visualizer", "overlay"],
  transparent: true,
  source: glsl(
    `// Waveform line: a line built from sines whose sizes are the spectrum's bands, glowing, with echoes.
uniform vec3 uColor;         // @control color default=#5EEAD4 label="Colour"
uniform vec3 uEcho;          // @control color default=#A78BFA label="Echo colour"
uniform float uAmplitude;    // @control min=0.05 max=0.5 default=0.22 label="Height"
uniform float uThickness;    // @control min=0.5 max=8 default=2.5 label="Thickness (px)"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Glow"
uniform int uEchoes;         // @control min=0 max=3 default=2 label="Echoes"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform vec3 uBackground;    // @control color default=#03050C label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
${DEMO}`,
    SOUND,
    GLOW,
    `// The line's height at x (0–1) and its slope, from 12 bands of the spectrum, fading out at the ends.
vec2 wave(float x, float t) {
  float y = 0.0;
  float dy = 0.0;
  for (int k = 0; k < 12; k++) {
    float fk = float(k);
    float amp = spectrum((fk + 0.5) / 12.0) / (1.0 + fk * 0.35);
    float freq = 6.28318 * (1.5 + fk * 1.7);
    float ph = t * (1.3 + fk * 0.6) * (mod(fk, 2.0) < 0.5 ? 1.0 : -1.0) + fk * 1.7;
    y += amp * sin(freq * x + ph);
    dy += amp * freq * cos(freq * x + ph);
  }
  float env = sin(3.14159 * clamp(x, 0.0, 1.0));
  float denv = 3.14159 * cos(3.14159 * clamp(x, 0.0, 1.0));
  return vec2(y * env, dy * env + y * denv) * 0.35;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 s = sound();
  vec3 light = vec3(0.0);
  for (int e = 3; e >= 0; e--) {
    if (e > uEchoes) continue;
    float lag = float(e) * 0.12;
    vec2 w = wave(uv.x, iTime * uSpeed - lag) * uAmplitude * (1.0 + 0.6 * s.y) * (1.0 - 0.18 * float(e));
    // Distance to the line in pixels, corrected for its slope.
    float slope = w.y / aspect;
    float d = abs(uv.y - 0.5 - w.x) * iResolution.y / sqrt(1.0 + slope * slope);
    float core = clamp(uThickness * 0.5 + 0.5 - d, 0.0, 1.0);
    float halo = exp(-d / (6.0 + 18.0 * s.x)) * uGlow * 0.5;
    vec3 c = e == 0 ? uColor : uEcho;
    float fade = e == 0 ? 1.0 : 0.45 / float(e);
    light += c * (core * 1.6 + halo) * fade;
  }
  vec4 g = glow(light);
  vec3 col = mix(uBackground, g.rgb, g.a);
  float alpha = max(g.a, uBackgroundAlpha);
  fragColor = vec4(mix(g.rgb, col, uBackgroundAlpha), alpha);
}`,
  ),
  presets: [
    { name: "On black", values: { uBackgroundAlpha: 1 } },
    { name: "Laser", values: { uColor: [1, 0.15, 0.25], uEcho: [1, 0.6, 0.2], uThickness: 1.5, uGlow: 1.8 } },
    { name: "Clean", values: { uEchoes: 0, uGlow: 0.3, uColor: [1, 1, 1], uThickness: 3 } },
  ],
};

export const bassPulse: ShaderEffect = {
  kind: "shader",
  id: "bass-pulse",
  name: "Bass pulse",
  description: "A picture or logo thumping to the bass: it swells and glows on every kick, with a colour split on the beat.",
  category: "audio",
  video: "filter",
  tags: ["audio", "music", "bass", "pulse", "logo", "beat", "glow", "overlay"],
  transparent: true,
  source: glsl(
    `// Bass pulse: the picture scaled by the bass, a glow from its edges, a quick colour split on each beat.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Picture or logo"
uniform float uSize;         // @control min=0.2 max=1 default=0.55 label="Size"
uniform float uPulse;        // @control min=0 max=0.5 default=0.14 label="Pulse"
uniform vec3 uGlowColor;     // @control color default=#F472B6 label="Glow"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Glow strength"
uniform float uSplit;        // @control min=0 max=0.03 default=0.012 label="Colour split on the beat"
uniform float uCorner;       // @control min=0 max=0.5 default=0.08 label="Corner rounding"
uniform vec3 uBackground;    // @control color default=#0B0614 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    SOUND,
    `// The picture's coverage at p (centred, in heights), and its colour: inside a rounded box, through its own alpha.
vec4 card(vec2 p, vec2 hs) {
  float corner = uCorner * min(hs.x, hs.y);
  vec2 q = abs(p) - hs + corner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
  float inside = clamp(0.5 - d * iResolution.y, 0.0, 1.0);
  if (inside <= 0.0) return vec4(0.0);
  vec4 c = pictureRGBA(uImage, p / (2.0 * hs) + 0.5);
  return vec4(c.rgb, c.a * inside);
}

// The glow reaching p: falling off from the picture's box, shaped by its alpha blurred (a coarse mip) nearby.
float glowAt(vec2 p, vec2 hs, float spread) {
  float corner = uCorner * min(hs.x, hs.y);
  vec2 q = abs(p) - hs + corner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
  float box = exp(-max(d, 0.0) / spread);
  if (textureSize(uImage, 0).x <= 1 || uBackdropAlpha >= 1.0) return box;
  // A logo on a clear backdrop: two coarse mips of its alpha, a soft halo round its own shape.
  vec2 uv = p / (2.0 * hs) + 0.5;
  float lod = log2(float(textureSize(uImage, 0).x));
  float blurred = min(1.0, 0.6 * textureLod(uImage, uv, lod - 4.5).a + 0.8 * textureLod(uImage, uv, lod - 3.0).a);
  float inside = step(abs(uv.x - 0.5), 0.5) * step(abs(uv.y - 0.5), 0.5);
  return mix(blurred * inside, box, uBackdropAlpha);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 6.0) : 0.0;
  float bass = s.y * s.y;
  float scale = 1.0 + uPulse * (bass * 0.7 + hit * 0.5);
  // The picture's own shape: square for a 1 × 1 placeholder, else its aspect.
  vec2 size = vec2(textureSize(uImage, 0));
  float aspect = size.x > 1.0 ? size.x / size.y : 16.0 / 9.0;
  vec2 hs = 0.5 * uSize * scale * vec2(aspect, 1.0);
  // Narrower than the frame, whatever the picture's shape.
  hs *= min(1.0, 0.45 * iResolution.x / iResolution.y / hs.x);
  // A colour split along x on the beat.
  vec2 off = vec2(uSplit * hit, 0.0);
  vec4 c = card(p, hs);
  vec4 cr = card(p - off, hs);
  vec4 cb = card(p + off, hs);
  vec3 pic = vec3(cr.r, c.g, cb.b);
  float cover = max(c.a, max(cr.a, cb.a));
  // Glow round the picture, wider and brighter with the bass.
  float spread = 0.02 + 0.05 * bass + 0.03 * hit;
  float g = glowAt(p, hs, spread) * (0.45 + 0.9 * bass + 0.6 * hit) * uGlow;
  vec3 col = uBackground + uGlowColor * g * (1.0 - cover);
  float alpha = max(uBackgroundAlpha, clamp(g, 0.0, 1.0));
  col = mix(col, pic * (1.0 + 0.25 * hit), cover);
  fragColor = vec4(col, max(alpha, cover));
}`,
  ),
  presets: [
    { name: "Logo", values: { uImage: SAMPLE_IMAGES.logo, uBackdropAlpha: 0, uCorner: 0, uSize: 0.6, uGlowColor: [0.5, 0.5, 1] } },
    { name: "Heart beat", values: { uImage: SAMPLE_IMAGES.heart, uBackdropAlpha: 0, uCorner: 0, uPulse: 0.3, uGlowColor: [1, 0.3, 0.4] } },
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const audioParticles: ShaderEffect = {
  kind: "shader",
  id: "audio-particles",
  name: "Audio particles",
  description: "Sparks bursting outward from the centre on every beat, trailing and fading, over a core that breathes with the level.",
  category: "audio",
  tags: ["audio", "music", "particles", "beat", "burst", "overlay", "visualizer"],
  transparent: true,
  source: glsl(
    `// Audio particles: a burst of sparks on each beat, flying out and slowing, plus a core glowing with the level.
uniform int uCount;          // @control min=8 max=64 default=40 label="Particles"
uniform float uSpeed;        // @control min=0.2 max=2 default=0.9 label="Burst speed"
uniform float uSize;         // @control min=0.002 max=0.02 default=0.007 label="Size"
uniform float uLife;         // @control min=0.2 max=2 default=0.9 label="Lifetime"
uniform vec3 uColorA;        // @control color default=#FDE047 label="Colour 1"
uniform vec3 uColorB;        // @control color default=#FB7185 label="Colour 2"
uniform vec3 uColorC;        // @control color default=#60A5FA label="Colour 3"
uniform float uCore;         // @control min=0 max=1 default=0.6 label="Core glow"
${DEMO}`,
    HASH,
    SOUND,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  vec3 light = vec3(0.0);
  // The core breathes with the level.
  float r = length(p);
  light += mix(uColorA, uColorB, 0.5) * uCore * (0.2 + 0.8 * s.x) * exp(-r / (0.04 + 0.08 * s.y)) * 0.8;
  if (b >= 0.0 && b < uLife) {
    // Each burst is seeded by when it began (the beat's time on the iTime clock), so bursts differ.
    float seed = floor((iTime - b) * 8.0);
    float life = b / uLife;
    float fade = (1.0 - life) * (1.0 - life);
    float energy = 0.6 + 0.6 * s.y;
    for (int i = 0; i < 64; i++) {
      if (i >= uCount) break;
      vec2 h = hash22(vec2(float(i) * 1.91 + 0.3, seed));
      float ang = 6.28318 * (float(i) + h.x) / float(uCount);
      float v = uSpeed * energy * (0.35 + 0.65 * h.y);
      // Out fast, slowed by drag, the slow ones drooping a little.
      float dist = v * (1.0 - exp(-b * 3.5)) / 3.5;
      vec2 at = vec2(sin(ang), cos(ang)) * dist - vec2(0.0, 0.08 * b * b);
      vec2 dir = normalize(vec2(sin(ang), cos(ang)) + 1e-4);
      // A short streak behind each spark, along its direction.
      vec2 d = p - at;
      float along = clamp(dot(d, -dir), 0.0, 0.04 * exp(-b * 3.0) + 0.002);
      float dd = length(d + dir * along);
      float size = uSize * (1.0 - 0.5 * life);
      float spark = exp(-dd * dd / (size * size)) + 0.25 * exp(-dd / (size * 4.0));
      vec3 c = h.x < 0.33 ? uColorA : h.x < 0.66 ? uColorB : uColorC;
      light += c * spark * fade * 1.4;
    }
  }
  // Fine glitter that shimmers with the treble.
  vec2 cell = floor(p * 40.0);
  float g = hash12(cell + floor(iTime * 12.0));
  float twinkle = step(0.985, g) * s.w * exp(-length(fract(p * 40.0) - 0.5) * 8.0);
  light += uColorC * twinkle;
  fragColor = glow(light);
}`,
  ),
  presets: [
    { name: "Gold", values: { uColorA: [1, 0.85, 0.4], uColorB: [1, 0.6, 0.2], uColorC: [1, 1, 0.8], uCount: 56 } },
    { name: "Ice", values: { uColorA: [0.6, 0.9, 1], uColorB: [0.3, 0.6, 1], uColorC: [1, 1, 1], uSpeed: 1.3, uLife: 1.2 } },
  ],
};

export const audioPlasma: ShaderEffect = {
  kind: "shader",
  id: "audio-plasma",
  name: "Audio plasma",
  description: "A flowing plasma whose swirl, scale and colours follow the bass, mids and highs, flaring on each beat.",
  category: "audio",
  tags: ["audio", "music", "plasma", "gradient", "psychedelic", "background", "visualizer"],
  source: glsl(
    `// Audio plasma: layered sines warped by noise; the bass pushes the flow, the mids tilt the palette, the highs add grain.
uniform float uScale;        // @control min=0.5 max=6 default=2.4 label="Scale"
uniform float uFlow;         // @control min=0 max=2 default=0.5 label="Flow"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform vec3 uPhase;         // @control color default=#1A66B3 label="Palette phase"
uniform float uContrast;     // @control min=0.5 max=2 default=1.1 label="Contrast"
${DEMO}`,
    HASH,
    NOISE,
    PALETTE,
    SOUND,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound() * uReact;
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 5.0) * uReact : 0.0;
  float t = iTime * uFlow;
  // The bass pushes the pattern on (a nudge that settles back, not a jump in time).
  float push = 0.8 * s.y + 0.5 * hit;
  vec2 q = p * uScale * (1.0 - 0.1 * s.y);
  vec2 w = vec2(vnoise(q * 0.7 + t * 0.3), vnoise(q * 0.7 - t * 0.27 + 5.0)) - 0.5;
  q += w * (1.2 + 1.5 * s.z);
  float v = sin(q.x + t + push);
  v += sin(q.y * 1.3 - t * 0.8 + push * 0.7);
  v += sin((q.x + q.y) * 0.8 + t * 0.6);
  v += sin(length(q + vec2(sin(t * 0.4), cos(t * 0.3))) * 2.0 - t * 1.2 - push * 1.5);
  v = v * 0.25 * uContrast;
  // The mids turn the palette; the highs add a fine shimmer.
  vec3 col = palette(v * 0.7 + 0.15 * s.z + 0.05 * t, vec3(0.45, 0.4, 0.5), vec3(0.4, 0.35, 0.4), vec3(0.8, 0.7, 0.6), uPhase + vec3(0.0, 0.1 * s.w, 0.2 * s.y));
  col *= 0.75 + 0.35 * s.x + 0.4 * hit;
  col += (hash12(fragCoord + floor(iTime * 30.0)) - 0.5) * 0.06 * s.w;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Sunset", values: { uPhase: [0, 0.15, 0.3], uScale: 1.6 } },
    { name: "Acid", values: { uPhase: [0.3, 0.6, 0.1], uScale: 4, uContrast: 1.6, uFlow: 1 } },
    { name: "Calm", values: { uReact: 0.4, uFlow: 0.25, uScale: 1.2 } },
  ],
};

export const vinyl: ShaderEffect = {
  kind: "shader",
  id: "vinyl",
  name: "Vinyl",
  description: "A record spinning on a turntable, its label a picture, its grooves catching the light with the music, the tonearm riding the beat.",
  category: "audio",
  video: "stills",
  tags: ["audio", "music", "vinyl", "record", "turntable", "retro", "album-art", "overlay"],
  transparent: true,
  source: glsl(
    `// Vinyl: a spinning record; each groove's sheen follows the spectrum at its radius, the label is a picture.
uniform sampler2D uLabel;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Label picture"
uniform float uRpm;          // @control min=0 max=78 default=33.3 label="Speed (rpm)"
uniform vec3 uRecord;        // @control color default=#101014 label="Record"
uniform vec3 uSheen;         // @control color default=#C4B5FD label="Sheen"
uniform float uShimmer;      // @control min=0 max=2 default=1 label="Shimmer"
uniform vec3 uBackground;    // @control color default=#2A211C label="Platter"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Platter opacity"
uniform bool uArm;           // @control default=true label="Tonearm"
${BACKDROP_CONTROLS}
${DEMO}`,
    PICTURE,
    SOUND,
    ROTATE,
    `float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * t);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 c = p + vec2(0.12, 0.0);
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 8.0) : 0.0;
  float R = 0.44;
  float r = length(c);
  float spin = iTime * uRpm / 60.0 * 6.28318;
  vec2 q = rot(spin) * c;
  float ang = atan(q.y, q.x);
  // The platter, with a soft shadow under the record.
  vec3 col = uBackground * (0.85 + 0.15 * smoothstep(0.9, 0.0, length(p)));
  float shadow = 0.5 * exp(-max(r - R, 0.0) / 0.02) * step(R, r);
  col *= 1.0 - shadow;
  float alpha = max(uBackgroundAlpha, shadow);
  float disc = clamp((R - r) / px, 0.0, 1.0);
  if (disc > 0.0) {
    // Grooves: fine rings; their sheen is the spectrum at that radius (bass outside, treble in), in two
    // bright wedges opposite the light, as on a real record.
    float band = clamp((R - r) / (R - 0.14), 0.0, 1.0);
    float level = spectrum(band);
    float grooves = 0.5 + 0.5 * sin(r * 900.0);
    float wedge = pow(abs(cos(atan(c.y, c.x) - 0.8)), 24.0);
    float sheen = wedge * (0.25 + uShimmer * level) * (0.6 + 0.4 * grooves);
    vec3 rec = uRecord * (0.9 + 0.2 * grooves) + uSheen * sheen;
    // A faint swirl that shows the spin.
    rec += 0.03 * sin(ang * 2.0 + r * 40.0);
    // Lead-in and run-out rings.
    rec *= 1.0 - 0.4 * (smoothstep(0.004, 0.0, abs(r - R + 0.012)) + smoothstep(0.004, 0.0, abs(r - 0.15)));
    col = mix(col, rec, disc);
    // The label: the picture, turning with the record.
    float label = clamp((0.13 - r) / px, 0.0, 1.0);
    vec4 pic = pictureRGBA(uLabel, q / 0.26 + 0.5);
    vec3 lab = mix(uRecord, pic.rgb, pic.a) * (0.95 + 0.1 * s.y);
    col = mix(col, lab, label);
    // The spindle.
    col = mix(col, vec3(0.8), clamp((0.008 - r) / px, 0.0, 1.0));
  }
  if (uArm) {
    // The tonearm: from a pivot at the top right to the stylus on the outer grooves, nudged by the beat.
    vec2 pivot = vec2(0.42, 0.34);
    float swing = 0.32 + 0.004 * hit;
    vec2 head = pivot + vec2(-sin(swing + 0.9), -cos(swing + 0.9)) * 0.5;
    float arm = segment(p, pivot, head);
    float shade = clamp((0.009 - arm) / px, 0.0, 1.0);
    col = mix(col * (1.0 - 0.35 * exp(-segment(p + vec2(-0.01, 0.015), pivot, head) / 0.015)), vec3(0.78, 0.78, 0.82), shade);
    float cart = segment(p, head, head + vec2(-0.03, -0.012));
    col = mix(col, vec3(0.15), clamp((0.016 - cart) / px, 0.0, 1.0));
    float base = length(p - pivot);
    float foot = clamp((0.035 - base) / px, 0.0, 1.0);
    col = mix(col, vec3(0.6), foot);
    col = mix(col, vec3(0.3), clamp((0.015 - base) / px, 0.0, 1.0));
    alpha = max(alpha, max(shade, max(foot, clamp((0.016 - cart) / px, 0.0, 1.0))));
  }
  fragColor = vec4(col, max(alpha, disc));
}`,
  ),
  presets: [
    { name: "Red vinyl", values: { uRecord: [0.45, 0.04, 0.06], uSheen: [1, 0.6, 0.6] } },
    { name: "45 rpm", values: { uRpm: 45, uLabel: SAMPLE_IMAGES.logo, uBackdrop: [0.95, 0.9, 0.8] } },
    { name: "On the platter", values: { uBackgroundAlpha: 1 } },
  ],
};

export const blackHoleSpectrum: ShaderEffect = {
  kind: "shader",
  id: "black-hole-spectrum",
  name: "Black hole spectrum",
  description:
    "A black hole whose accretion disk is the spectrum: bass on the outer rings, treble by the horizon, bent over and under the hole by gravity, its photon ring flashing on each beat.",
  category: "audio",
  tags: ["audio", "music", "black-hole", "space", "spectrum", "lensing", "3d", "visualizer", "beat"],
  source: glsl(
    `// Black hole spectrum: rays bent round a black hole light up its accretion disk; each ring of the disk glows with the spectrum at its radius.
uniform float uTilt;         // @control min=2 max=60 default=9 label="Disk tilt (degrees)"
uniform float uLens;         // @control min=0 max=1.5 default=1 label="Lensing"
uniform float uSpin;         // @control min=0 max=2 default=0.8 label="Spin"
uniform float uDoppler;      // @control min=0 max=1 default=0.6 label="Doppler beaming"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat flash"
uniform vec3 uColorHot;      // @control color default=#FFE7B3 label="Inner colour"
uniform vec3 uColorCool;     // @control color default=#FF5A1F label="Outer colour"
uniform float uStars;        // @control min=0 max=1 default=0.7 label="Stars"
${DEMO}`,
    HASH,
    NOISE,
    SOUND,
    ROTATE,
    `// The disk's inner and outer edges, in horizon radii (the horizon is the unit sphere).
const float RIN = 2.6;
const float ROUT = 9.0;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// Stars in the direction d, on a grid of cells over the sky, and a faint band of galaxy.
vec3 sky(vec3 d, float shimmer) {
  vec3 col = vec3(0.004, 0.005, 0.012) + vec3(0.03, 0.022, 0.045) * exp(-abs(d.y + 0.35 * d.x) * 5.0);
  vec3 g = d * 90.0;
  float h = hash13(floor(g));
  if (h > 0.982) {
    float star = exp(-length(fract(g) - 0.5) * 9.0);
    vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), fract(h * 37.0));
    col += tint * star * (1.2 + shimmer * sin(iTime * 7.0 + h * 90.0));
  }
  return col;
}

// The disk where a ray (going dir) crosses it at 'at': light, and how much it hides behind it.
vec4 disk(vec3 at, float rr, vec3 dir, vec4 s, float b) {
  float x = (rr - RIN) / (ROUT - RIN);
  // Treble by the hole, bass round the outside.
  float level = spectrum(1.0 - x) * uReact;
  // Turbulent gas, orbiting faster nearer the hole (as Kepler has it), in rings.
  vec2 q = rot(iTime * uSpin * 6.0 / pow(rr, 1.5)) * at.xz;
  float n = vnoise(q * 1.3) * 0.65 + vnoise(q * 3.7 + 9.0) * 0.35;
  float gas = (0.35 + 1.1 * n * n) * (0.6 + 0.4 * sin(rr * 7.0 + n * 3.0));
  float edge = smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.6, x);
  float heat = 0.25 + 0.75 * (1.0 - x) * (1.0 - x);
  // The beat: a bright ripple running out through the disk.
  float ripple = b >= 0.0 ? exp(-pow((x - b * 1.6) / 0.05, 2.0)) * exp(-b * 2.0) * uFlash : 0.0;
  float e = edge * (gas * (0.6 * heat + 1.4 * level) + 1.5 * ripple);
  // Doppler beaming: the side coming towards us is brighter and bluer, the side going away dimmer and redder.
  vec3 vel = normalize(vec3(-at.z, 0.0, at.x));
  float beta = clamp(uDoppler * (0.55 + 0.35 * s.z) * sqrt(RIN / rr), 0.0, 0.9);
  float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(vel, -dir));
  vec3 c = mix(uColorHot, uColorCool, smoothstep(0.0, 0.8, x));
  c = mix(c, vec3(0.75, 0.85, 1.0) * max(c.r, max(c.g, c.b)), clamp((g - 1.0) * 0.8, 0.0, 0.6));
  c *= mix(vec3(1.0), vec3(1.0, 0.45, 0.25), clamp((1.0 - g) * 1.5, 0.0, 1.0));
  return vec4(c * e * g * g * g * 1.2, clamp(e * 0.9, 0.0, 0.92));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = rot(0.12) * (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 6.0) : 0.0;
  // The camera, a little above the disk's plane, looking at the hole.
  float tilt = radians(uTilt);
  vec3 ro = vec3(0.0, sin(tilt), -cos(tilt)) * 16.0;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 pos = ro;
  vec3 v = normalize(p.x * rt + p.y * up + 1.25 * fw);
  // Light bends as round a Schwarzschild hole: a pull of 1.5 h² / r⁵ towards it, h the ray's angular momentum.
  // The beat tightens the pull a moment, so the whole sky lurches inward.
  vec3 h = cross(pos, v);
  float pull = 1.5 * dot(h, h) * uLens * (1.0 + 0.35 * hit * uFlash);
  vec3 light = vec3(0.0);
  float clear = 1.0;
  float closest = 1e3;
  for (int i = 0; i < 120; i++) {
    float r = length(pos);
    closest = min(closest, r);
    if (r < 1.0) {
      clear = 0.0;
      break;
    }
    if (r > 24.0 && dot(pos, v) > 0.0) break;
    float dt = clamp(0.1 * r, 0.02, 0.8);
    vec3 prev = pos;
    v = normalize(v - pull * pos / pow(r, 5.0) * dt);
    pos += v * dt;
    if (prev.y * pos.y < 0.0) {
      vec3 at = mix(prev, pos, prev.y / (prev.y - pos.y));
      float rr = length(at.xz);
      if (rr > RIN && rr < ROUT) {
        vec4 d = disk(at, rr, v, s, b);
        light += clear * d.rgb;
        clear *= 1.0 - d.a;
        if (clear < 0.01) break;
      }
    }
  }
  vec3 col = light + clear * sky(v, s.w) * uStars;
  // The photon ring: light that skimmed the photon sphere (1.5 horizon radii), flashing on the beat.
  float ring = exp(-pow((closest - 1.55) / 0.1, 2.0));
  col += uColorHot * ring * (0.2 + 2.0 * hit * uFlash) * (0.5 + s.x);
  fragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`,
  ),
  presets: [
    { name: "Interstellar", values: { uColorHot: [1, 0.93, 0.8], uColorCool: [0.95, 0.55, 0.2], uDoppler: 0.35, uTilt: 6 } },
    { name: "Blue giant", values: { uColorHot: [0.85, 0.95, 1], uColorCool: [0.25, 0.4, 1], uSpin: 1.4 } },
    { name: "Top down", values: { uTilt: 45, uLens: 0.8 } },
  ],
};

export const cymatics: ShaderEffect = {
  kind: "shader",
  id: "cymatics",
  name: "Cymatics",
  description:
    "Sand on a vibrating metal plate gathering into Chladni figures: the music picks the pattern, simple for low notes and intricate for high ones, and every beat throws the sand.",
  category: "audio",
  tags: ["audio", "music", "cymatics", "chladni", "sand", "pattern", "science", "visualizer", "beat"],
  source: glsl(
    `// Cymatics: sand on a vibrating plate settles on the still lines of a Chladni figure; the spectrum's centre picks the figure, the beat throws the sand.
uniform float uComplexity;   // @control min=2 max=10 default=6 label="Complexity"
uniform float uLine;         // @control min=0.3 max=3 default=1 label="Line width"
uniform float uGrain;        // @control min=0.002 max=0.012 default=0.006 label="Grain size"
uniform float uScatter;      // @control min=0 max=2 default=1 label="Beat scatter"
uniform vec3 uSand;          // @control color default=#F2E6C9 label="Sand"
uniform vec3 uPlate;         // @control color default=#1E2026 label="Plate"
uniform vec3 uBackground;    // @control color default=#0A0A0C label="Background"
uniform bool uRound;         // @control default=false label="Round plate"
${DEMO}`,
    HASH,
    SOUND,
    `const float PI = 3.14159265;

// A Chladni figure on the square plate [0, 1]²: zero along its still lines.
float chladni(vec2 u, vec2 nm) {
  return cos(nm.x * PI * u.x) * cos(nm.y * PI * u.y) - cos(nm.y * PI * u.x) * cos(nm.x * PI * u.y);
}

// The k-th figure, from simple to intricate.
vec2 mode(float k) {
  float n = 1.0 + floor(k * 0.5);
  return vec2(n, n + 1.0 + 2.0 * mod(k, 2.0));
}

// The spectrum's centre of mass, 0 (all bass) to 1 (all treble).
float pitch() {
  float sum = 0.0;
  float total = 0.0;
  for (int i = 0; i < 16; i++) {
    float x = (float(i) + 0.5) / 16.0;
    float v = spectrum(x);
    sum += x * v;
    total += v;
  }
  return total > 1e-3 ? sum / total : 0.3;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 7.0) : 0.0;
  float size = 0.44;
  // The plate, with a soft shadow round it.
  vec2 corner = abs(p) - size + 0.02;
  float plateD = uRound ? length(p) - size : length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - 0.02;
  vec3 col = uBackground * (1.0 - 0.4 * length(p));
  col *= 1.0 - 0.6 * exp(-max(plateD, 0.0) / 0.025);
  float inside = clamp(0.5 - plateD / px, 0.0, 1.0);
  // Brushed metal, lit from the top left.
  vec3 plate = uPlate * (0.75 + 0.5 * smoothstep(0.6, -0.6, p.x - p.y));
  plate *= 0.95 + 0.1 * hash12(vec2(floor(fragCoord.y * 0.7), 3.0));
  // Which figure: the music's pitch, from the bass's simple shapes to the treble's mandalas.
  float k = uComplexity * clamp(0.15 + 1.6 * (pitch() - 0.25) + 0.3 * s.z - 0.2 * s.y, 0.0, 1.0);
  float f = smoothstep(0.3, 0.7, fract(k));
  vec2 m0 = mode(floor(k));
  vec2 m1 = mode(floor(k) + 1.0);
  // One grain of sand to a cell, at a jittered spot, there if the figure is still near it.
  vec2 id = floor(p / uGrain);
  vec2 jitter = hash22(id);
  vec2 centre = (id + 0.3 + 0.4 * jitter) * uGrain;
  vec2 u = centre / (2.0 * size) + 0.5;
  float figure = mix(chladni(u, m0), chladni(u, m1), f);
  float away = abs(figure) / (PI * mix(m0.y, m1.y, f));
  float width = 0.011 * uLine;
  float line = exp(-away * away / (width * width));
  // A light dusting along the lines, under the grains.
  plate = mix(plate, uSand * 0.45, line * 0.3);
  // Most sand sits on the lines; strays are scattered, and many more fly just after a beat.
  float stray = 0.01 + 0.08 * hit * uScatter;
  if (hash12(id + 17.3) < 0.95 * line + stray * (1.0 - line)) {
    // Grains off the lines are thrown up: bigger, their shadows further off. Those on the lines buzz with the level.
    float lift = (1.0 - line) * hit * uScatter;
    vec2 buzz = vec2(sin(iTime * 61.0 + jitter.x * 40.0), cos(iTime * 53.0 + jitter.y * 40.0)) * s.x * 0.06 * uGrain;
    vec2 at = centre + buzz;
    float rad = 0.32 * uGrain * (1.0 + 0.5 * lift);
    float sd = length(p - at - vec2(0.12, -0.16) * uGrain * (0.3 + lift)) - rad;
    plate *= 1.0 - 0.5 * clamp(0.5 - sd / px, 0.0, 1.0);
    float d = length(p - at) - rad;
    float shade = 0.85 + 0.35 * clamp(dot((p - at) / rad, vec2(-0.6, 0.6)), -1.0, 1.0);
    plate = mix(plate, uSand * (0.75 + 0.35 * jitter.x) * shade, clamp(0.5 - d / px, 0.0, 1.0));
  }
  // The bolt holding the plate up, in the middle.
  float bolt = length(p) - 0.012;
  plate = mix(plate, vec3(0.55) * (0.8 + 0.4 * smoothstep(0.012, -0.012, p.x - p.y)), clamp(0.5 - bolt / px, 0.0, 1.0));
  fragColor = vec4(mix(col, plate, inside), 1.0);
}`,
  ),
  presets: [
    { name: "Black sand", values: { uSand: [0.08, 0.08, 0.09], uPlate: [0.85, 0.83, 0.78], uBackground: [0.93, 0.92, 0.9] } },
    { name: "Brass", values: { uPlate: [0.55, 0.4, 0.15], uSand: [1, 0.98, 0.92], uRound: true } },
    { name: "Fine salt", values: { uGrain: 0.0025, uLine: 0.7, uComplexity: 9 } },
  ],
};

export const liquidChrome: ShaderEffect = {
  kind: "shader",
  id: "liquid-chrome",
  name: "Liquid chrome",
  description:
    "A speaker cone of mirror-like liquid metal in a studio: the bass pumps its middle, the spectrum ripples its surface, and each beat splashes drops off it.",
  category: "audio",
  tags: ["audio", "music", "chrome", "metal", "speaker", "liquid", "reflection", "visualizer", "beat"],
  source: glsl(
    `// Liquid chrome: a height field (a cone, pumped by the bass, rippled by the spectrum) shaded as a mirror reflecting a studio.
uniform float uPump;         // @control min=0 max=2 default=1 label="Bass pump"
uniform float uRipple;       // @control min=0 max=2 default=1 label="Ripples"
uniform float uSplash;       // @control min=0 max=2 default=1 label="Beat splash"
uniform vec3 uTint;          // @control color default=#E6EBF5 label="Metal tint"
uniform vec3 uLightA;        // @control color default=#FF4FD8 label="Light 1"
uniform vec3 uLightB;        // @control color default=#38BDF8 label="Light 2"
uniform vec3 uBackground;    // @control color default=#08080C label="Background"
${DEMO}`,
    HASH,
    SOUND,
    `// The cone's radius, in frame heights.
const float R = 0.42;

// The surface's height at c (from the centre), all of it in frame heights.
float height(vec2 c, vec4 s, float b, float hit) {
  float r = length(c) / R;
  // A shallow dish with a domed dust cap.
  float h = -0.12 * (1.0 - r) + 0.05 * exp(-r * r / 0.05);
  // The bass pushes the middle in and out, with a quick wobble after each kick.
  float pump = (s.y - 0.45) * 0.09 * uPump + hit * 0.04 * uSplash * cos(b * 38.0);
  h += pump * (1.0 - smoothstep(0.0, 1.0, r));
  // Rings running outward, one to a band of the spectrum, and an angular shiver for the highs.
  for (int i = 0; i < 6; i++) {
    float x = (float(i) + 0.5) / 6.0;
    h += uRipple * 0.008 * spectrum(x) * sin(r * (14.0 + 22.0 * x) - iTime * (5.0 + 6.0 * x) + float(i) * 1.7) * (0.4 + r);
  }
  h += uRipple * 0.004 * s.w * sin(atan(c.y, c.x) * 7.0 + iTime * 3.0) * sin(r * 30.0 - iTime * 9.0) * r;
  // The splash: a ring wave out from the middle on each beat.
  if (b >= 0.0) h += uSplash * 0.03 * exp(-b * 3.0) * exp(-pow((r - b * 2.2) / 0.06, 2.0));
  return h;
}

// A dark studio: a big softbox above, two coloured strip lights, a glow off the floor.
vec3 studio(vec3 d) {
  vec3 c = uBackground * 0.6 + vec3(0.06) * (d.y * 0.5 + 0.5);
  c += vec3(1.8) * smoothstep(0.32, 0.2, abs(d.x + 0.1)) * smoothstep(0.12, 0.3, d.y);
  c += uLightA * 1.8 * smoothstep(0.1, 0.03, abs(d.x - 0.42 + 0.15 * d.y));
  c += uLightB * 1.8 * smoothstep(0.1, 0.03, abs(d.x + 0.45 - 0.1 * d.y)) * smoothstep(-0.7, 0.1, d.y);
  c += mix(uLightA, uLightB, 0.5) * 0.45 * smoothstep(-0.1, -0.5, d.y);
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 c = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 5.0) : 0.0;
  float r = length(c) / R;
  // A view ray with a little perspective, so even the flat middle shows the room.
  vec3 view = normalize(vec3(c * 1.4, -1.0));
  vec3 col = uBackground * (1.0 - 0.5 * length(c));
  col *= 1.0 - 0.7 * exp(-max(r - 1.12, 0.0) * 8.0);
  if (r < 1.12) {
    vec3 n;
    vec3 tint;
    if (r < 1.0) {
      // The cone: its normal from the height field's slope, and a mirror for a surface.
      float e = 2.0 * px;
      float h = height(c, s, b, hit);
      n = normalize(vec3(-(height(c + vec2(e, 0.0), s, b, hit) - h) / e, -(height(c + vec2(0.0, e), s, b, hit) - h) / e, 1.0));
      tint = uTint;
    } else {
      // The rubber surround: a half-round roll, dark and dull.
      float x = (r - 1.06) / 0.06;
      n = normalize(vec3(normalize(c) * x, sqrt(max(1.0 - x * x, 0.0)) + 0.05));
      tint = vec3(0.12);
    }
    vec3 ref = reflect(view, n);
    float fresnel = pow(1.0 - max(dot(-view, n), 0.0), 5.0);
    vec3 surface = studio(ref) * tint * (0.65 + 0.35 * fresnel);
    col = mix(col, surface, clamp((1.12 - r) * R / px, 0.0, 1.0));
  }
  // Drops thrown off by the splash: out, up towards us (growing), and back.
  if (b >= 0.0 && b < 0.7 && uSplash > 0.0) {
    float seed = floor((iTime - b) * 8.0);
    float up = 4.0 * b * (0.7 - b) / 0.49;
    for (int i = 0; i < 10; i++) {
      vec2 hh = hash22(vec2(float(i) * 3.1, seed));
      float ang = 6.28318 * (float(i) + hh.x) / 10.0;
      vec2 at = vec2(cos(ang), sin(ang)) * (R * (0.3 + 0.2 * hh.y) + (0.25 + 0.35 * hh.y) * b * uSplash * (0.6 + s.y));
      float rad = (0.006 + 0.008 * hh.y) * (1.0 + 1.5 * up) * min(uSplash, 1.0);
      vec2 q = (c - at) / rad;
      float qq = dot(q, q);
      if (qq < 1.0) {
        vec3 dn = vec3(q, sqrt(1.0 - qq));
        col = mix(col, studio(reflect(view, dn)) * uTint, clamp((1.0 - sqrt(qq)) * rad / px, 0.0, 1.0));
      }
    }
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Gold", values: { uTint: [1, 0.8, 0.45], uLightA: [1, 0.55, 0.2], uLightB: [1, 0.95, 0.8] } },
    { name: "Mercury", values: { uTint: [0.8, 0.82, 0.85], uLightA: [1, 1, 1], uLightB: [0.6, 0.7, 0.9], uRipple: 1.6 } },
    { name: "Subwoofer", values: { uPump: 2, uRipple: 0.5, uSplash: 1.5 } },
  ],
};

export const auroraCurtain: ShaderEffect = {
  kind: "shader",
  id: "aurora-curtain",
  name: "Aurora curtain",
  description:
    "Curtains of northern lights over mountains and a still lake: the spectrum lifts the curtain left to right, the bass sways it, the treble shimmers its lower edge and each beat sends a pulse up the folds.",
  category: "audio",
  tags: ["audio", "music", "aurora", "northern-lights", "sky", "night", "ambient", "background", "visualizer"],
  source: glsl(
    `// Aurora curtain: three layers of folded, rayed curtain; the curtain's height across the sky is the spectrum, low to high.
uniform float uHeight;       // @control min=0.2 max=1.5 default=0.9 label="Height"
uniform float uSway;         // @control min=0 max=2 default=1 label="Sway"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform vec3 uColorLow;      // @control color default=#3CF59A label="Lower colour"
uniform vec3 uColorHigh;     // @control color default=#9B5CFF label="Upper colour"
uniform vec3 uFringe;        // @control color default=#FF4F9A label="Fringe"
uniform vec3 uSky;           // @control color default=#040814 label="Sky"
uniform bool uLake;          // @control default=true label="Lake reflection"
${DEMO}`,
    HASH,
    NOISE,
    SOUND,
    `// The aurora at q: x 0–1 across the frame, y in frame heights above the horizon.
vec3 aurora(vec2 q, vec4 s, float b) {
  vec3 light = vec3(0.0);
  float t = iTime;
  // The spectrum, read left to right, lifts the curtain.
  float level = spectrum(clamp(q.x, 0.0, 1.0)) * uReact;
  for (int layer = 0; layer < 3; layer++) {
    float L = float(layer);
    float near = 1.0 - 0.28 * L;
    float x = q.x * (1.0 + 0.3 * L) + L * 0.37;
    // The curtain's foot: a wavy line across the sky, swaying with the bass.
    float sway = uSway * (0.04 + 0.08 * s.y) * sin(x * 2.3 + t * 0.5 + L * 2.0);
    float foot = 0.12 + 0.1 * L + 0.06 * vnoise(vec2(x * 2.0 + t * 0.07, L * 7.0)) + sway;
    float above = q.y - foot;
    if (above < -0.02) continue;
    // Folds: x warped along the curtain; it bunches (and brightens) where the warp doubles back.
    float a = x * 9.0 + t * 0.35 + L * 4.0;
    float a2 = x * 17.0 - t * 0.5;
    float xw = x + 0.55 * sin(a) / 9.0 + 0.3 * sin(a2) / 17.0;
    float fold = 0.4 + 0.35 * min(1.0 / max(abs(1.0 + 0.55 * cos(a) + 0.3 * cos(a2)), 0.18), 4.0);
    float top = uHeight * (0.12 + 0.55 * level) * near;
    float lower = smoothstep(-0.02, 0.01, above);
    float fall = exp(-max(above, 0.0) / max(top, 0.02) * 1.6);
    // Rays: fine vertical streaks drifting along the curtain.
    float rays = (0.45 + 0.55 * vnoise(vec2(xw * 60.0 + t * 0.6, L * 13.0))) * (0.7 + 0.3 * vnoise(vec2(xw * 160.0 - t * 1.3, L)));
    // The beat: a brighter band climbing the curtain.
    float pulse = b >= 0.0 ? exp(-pow((above - b * 0.5) / 0.04, 2.0)) * exp(-b * 2.5) : 0.0;
    vec3 c = mix(uColorLow, uColorHigh, smoothstep(0.0, 1.0, above / max(top * 1.5, 0.05)));
    // The treble flickers a pink fringe along the lower edge.
    float fringe = exp(-max(above, 0.0) / 0.012) * lower * s.w * (0.5 + 0.5 * sin(xw * 80.0 + t * 12.0));
    light += (c * lower * fall * rays * fold * (0.5 + 0.6 * level + 1.2 * pulse) + uFringe * fringe * 1.2) * near * 0.8;
  }
  return light;
}

// The sky above the horizon at q (as for aurora), with stars and a ridge of mountains.
vec3 sky(vec2 q, float aspect, float px, vec4 s, float b) {
  vec3 col = uSky * (1.0 + 1.5 * exp(-q.y * 5.0));
  vec2 cell = floor(vec2(q.x * aspect, q.y) * 300.0);
  float h = hash12(cell);
  col += vec3(0.8, 0.85, 1.0) * step(0.996, h) * (0.5 + 0.5 * sin(iTime * 2.0 + h * 80.0)) * smoothstep(0.05, 0.3, q.y);
  col += aurora(q, s, b);
  float ridge = 0.04 + 0.09 * (0.7 * vnoise(vec2(q.x * 4.0, 1.0)) + 0.3 * vnoise(vec2(q.x * 13.0, 2.0)));
  return mix(col, uSky * 0.3, smoothstep(ridge + px, ridge - px, q.y));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float horizon = uLake ? 0.3 : 0.06;
  vec2 q = vec2(uv.x, uv.y - horizon);
  vec3 col;
  if (q.y >= 0.0) {
    col = sky(q, aspect, px, s, b);
  } else {
    // The lake: the sky upside down, broken by slow ripples that crowd towards the horizon, and darker.
    float depth = -q.y;
    float wave = vnoise(vec2(q.x * 30.0, 4.0 / (depth + 0.02) + iTime * 0.6)) - 0.5;
    col = sky(vec2(q.x + wave * 0.02 * depth * 3.0, depth), aspect, px, s, b) * vec3(0.4, 0.45, 0.5);
    col += uColorLow * 0.03 * exp(-depth * 60.0);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Crimson", values: { uColorLow: [1, 0.25, 0.3], uColorHigh: [0.5, 0.1, 0.6], uFringe: [1, 0.8, 0.3] } },
    { name: "Arctic", values: { uColorLow: [0.4, 1, 0.85], uColorHigh: [0.3, 0.5, 1], uFringe: [0.8, 1, 1], uSway: 0.5 } },
    { name: "No lake", values: { uLake: false, uHeight: 1.2 } },
  ],
};

export const neonSkyline: ShaderEffect = {
  kind: "shader",
  id: "neon-skyline",
  name: "Neon skyline",
  description:
    "A synthwave city whose towers are the equaliser: a striped sun pulsing with the level, a neon grid racing with the bass, and windows that flicker on every beat.",
  category: "audio",
  tags: ["audio", "music", "synthwave", "retrowave", "80s", "city", "neon", "equalizer", "visualizer", "beat"],
  source: glsl(
    `// Neon skyline: towers on the horizon, one to a band of the spectrum, in front of a striped sun, over a perspective grid.
uniform int uTowers;         // @control min=8 max=48 default=24 label="Towers"
uniform float uGain;         // @control min=0.3 max=2.5 default=1.1 label="Gain"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Grid speed"
uniform vec3 uSunTop;        // @control color default=#FFE66D label="Sun top"
uniform vec3 uSunBottom;     // @control color default=#FF2E88 label="Sun bottom"
uniform vec3 uNeon;          // @control color default=#00E5FF label="Outline"
uniform vec3 uGrid;          // @control color default=#FF3CAC label="Grid"
uniform vec3 uSky;           // @control color default=#1A0B3D label="Sky"
${DEMO}`,
    HASH,
    SOUND,
    `const float H = 0.38;

float box(vec2 p, vec2 hs) {
  vec2 q = abs(p) - hs;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// A row of towers over the column x (0–1 across), n of them: towers' colour mixed over col.
vec3 towers(vec3 col, float x, float y, float n, float aspect, float px, float far, float seed, float flicker) {
  float cell = floor(x * n);
  float within = fract(x * n);
  float cw = aspect / n;
  float h1 = hash12(vec2(cell, seed));
  float width = 0.55 + 0.35 * h1;
  float level = clamp(spectrum(far > 0.5 ? 1.0 - (cell + 0.5) / n : (cell + 0.5) / n) * uGain, 0.0, 1.0);
  float tall = far > 0.5 ? 0.06 + 0.08 * h1 + 0.16 * level : 0.03 + 0.04 * h1 + 0.28 * level;
  // Lower in the middle, under the sun.
  tall *= mix(0.3, 1.0, smoothstep(0.04, 0.3, abs((cell + 0.5) / n - 0.5)));
  vec2 local = vec2((within - 0.5) * cw, y - H - tall * 0.5);
  float d = box(local, vec2(width * 0.5 * cw, tall * 0.5));
  vec3 neon = far > 0.5 ? mix(uNeon, uSunBottom, 0.6) * 0.5 : uNeon;
  col += neon * 0.25 * exp(-max(d, 0.0) / 0.01) * step(H, y);
  if (d < 0.0) {
    vec3 body = far > 0.5 ? mix(uSky, uSunBottom, 0.18) * 0.7 : uSky * 0.35;
    // Windows: lit more as the band is louder, reshuffled on every beat.
    vec2 w = (local + vec2(width * 0.5 * cw, tall * 0.5)) / vec2(0.011, 0.016);
    vec2 wf = fract(w);
    float lit = step(hash12(floor(w) + vec2(cell * 31.0, seed + flicker)), (0.12 + 0.7 * level) * (far > 0.5 ? 0.4 : 1.0));
    float pane = step(0.3, wf.x) * step(wf.x, 0.7) * step(0.3, wf.y) * step(wf.y, 0.7) * step(0.02, -d);
    body = mix(body, mix(uSunTop, uNeon, hash12(floor(w) + 7.0)) * (far > 0.5 ? 0.5 : 0.9), lit * pane);
    col = body;
  }
  return mix(col, neon, clamp(1.2 - abs(d) / px, 0.0, 1.0) * step(H, y));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 6.0) : 0.0;
  vec3 col;
  if (p.y > H) {
    // Dusk: warm at the horizon, deep up top, with a few stars.
    float y = p.y - H;
    col = mix(uSunBottom * 0.35, uSky, smoothstep(0.0, 0.45, y));
    col += vec3(0.9) * step(0.997, hash12(floor(fragCoord / 2.0))) * smoothstep(0.15, 0.5, y);
    // The sun, swelling with the level; stripes cut its lower half, sliding down and jumping on the beat.
    vec2 sc = vec2(0.0, H + 0.25);
    float rad = 0.2 * (1.0 + 0.08 * s.x + 0.04 * hit);
    float d = length(p - sc) - rad;
    float sy = (p.y - sc.y) / rad;
    vec3 sun = mix(uSunBottom, uSunTop, smoothstep(-0.9, 0.9, sy));
    float stripes = 1.0;
    if (sy < 0.2) {
      float f = fract((sy - 0.2) * 7.0 + iTime * 0.4 + 0.5 * hit);
      float gap = mix(0.05, 0.5, clamp((0.2 - sy) / 1.2, 0.0, 1.0)) * (1.0 + 0.6 * hit);
      stripes = smoothstep(gap, gap + 7.0 * px / rad, f);
    }
    col += sun * 0.35 * exp(-max(d, 0.0) / 0.08);
    col = mix(col, sun * 1.1, clamp(0.5 - d / px, 0.0, 1.0) * stripes);
    // A far row of towers in the haze, then the equaliser row in front.
    float flicker = floor(iTime - max(b, 0.0)) * 13.0;
    col = towers(col, uv.x + 0.013, p.y, floor(float(uTowers) * 1.7), aspect, px, 1.0, 5.0, flicker);
    col = towers(col, uv.x, p.y, float(uTowers), aspect, px, 0.0, 1.0, flicker);
  } else {
    // The floor: a grid in perspective racing towards us, nudged on by the bass.
    float y = H - p.y;
    float z = 0.12 / y;
    float run = iTime * uSpeed * 2.0 + (0.6 * s.y + 0.8 * hit) * uSpeed;
    vec2 g = vec2(p.x * z * 2.0, z + run);
    vec2 gl = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), 1e-4);
    float near = min(gl.x, gl.y);
    float fade = smoothstep(0.0, 0.04, y);
    col = mix(uSky * 0.25, vec3(0.0), smoothstep(0.0, 0.3, y));
    col += uGrid * (clamp(1.0 - near, 0.0, 1.0) + 0.35 * exp(-near * 0.3)) * fade * (0.7 + 0.5 * s.x);
    // Haze on the horizon and the sun's reflection streaking down the floor.
    col += uSunBottom * 0.6 * exp(-y * 30.0);
    col += uSunBottom * 0.25 * exp(-abs(p.x) / 0.08) * exp(-y * 6.0);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Miami", values: { uSunTop: [1, 0.85, 0.3], uSunBottom: [1, 0.35, 0.55], uNeon: [0.3, 1, 0.9], uGrid: [0.3, 1, 0.9], uSky: [0.12, 0.05, 0.25] } },
    { name: "Blade", values: { uSunTop: [1, 0.55, 0.2], uSunBottom: [0.8, 0.1, 0.1], uNeon: [1, 0.4, 0.2], uGrid: [1, 0.3, 0.15], uSky: [0.05, 0.02, 0.04] } },
    { name: "Megacity", values: { uTowers: 44, uGain: 1.5, uSpeed: 2 } },
  ],
};

export const fractalPulse: ShaderEffect = {
  kind: "shader",
  id: "fractal-pulse",
  name: "Fractal pulse",
  description:
    "A flight down a tunnel bored through an endless 3D fractal: the bass reshapes it, the treble lights its edges and each beat lurches the camera forward.",
  category: "audio",
  tags: ["audio", "music", "fractal", "3d", "tunnel", "psychedelic", "raymarch", "visualizer", "beat"],
  source: glsl(
    `// Fractal pulse: a ray-marched Apollonian fractal, repeating forever, with a tunnel bored along z for the camera to fly down.
uniform float uSpeed;        // @control min=0 max=2 default=0.5 label="Flight speed"
uniform float uMorph;        // @control min=0 max=2 default=1 label="Bass morph"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Edge glow"
uniform float uLurch;        // @control min=0 max=2 default=1 label="Beat lurch"
uniform int uSteps;          // @control min=32 max=128 default=72 label="Quality (steps)"
uniform vec3 uColorA;        // @control color default=#F59E0B label="Colour 1"
uniform vec3 uColorB;        // @control color default=#7C3AED label="Colour 2"
uniform vec3 uGlowColor;     // @control color default=#22D3EE label="Glow colour"
${DEMO}`,
    SOUND,
    ROTATE,
    `// How close the last fractal() came to the gasket's centres, for colour.
float trap;

// Distance to the fractal (sheets of an Apollonian gasket, 'shape' about 1–1.3), less the tunnel round the z axis.
float fractal(vec3 p, float shape) {
  vec3 q = p;
  q.xy = rot(p.z * 0.15) * q.xy;
  float scale = 1.0;
  trap = 1e3;
  for (int i = 0; i < 7; i++) {
    q = -1.0 + 2.0 * fract(0.5 * q + 0.5);
    float r2 = max(dot(q, q), 1e-6);
    trap = min(trap, r2);
    float k = shape / r2;
    q *= k;
    scale *= k;
  }
  return max(0.25 * abs(q.y) / scale, 0.3 - length(p.xy));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 5.0) : 0.0;
  float shape = 1.04 + 0.16 * uMorph * s.y + 0.04 * sin(iTime * 0.13);
  // The lurch: a jump forward on the beat that eases back before the next.
  float lurch = b >= 0.0 ? uLurch * 0.25 * (1.0 - exp(-b * 14.0)) * exp(-b * 3.0) : 0.0;
  float z = iTime * uSpeed + lurch;
  vec3 ro = vec3(0.08 * sin(z * 0.9), 0.08 * cos(z * 0.7), z);
  vec3 ta = vec3(0.08 * sin((z + 0.5) * 0.9), 0.08 * cos((z + 0.5) * 0.7), z + 0.5);
  vec3 fw = normalize(ta - ro);
  float roll = iTime * 0.05 + 0.15 * s.z;
  vec3 rt = normalize(cross(vec3(sin(roll), cos(roll), 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(p.x * rt + p.y * up + (1.1 + 0.25 * hit * uLurch) * fw);
  float t = 0.01;
  float glow = 0.0;
  float steps = 0.0;
  bool found = false;
  for (int i = 0; i < 128; i++) {
    if (i >= uSteps) break;
    float d = fractal(ro + rd * t, shape);
    glow += 0.012 / (1.0 + d * d * 4000.0);
    steps += 1.0;
    if (d < 0.0004 * t) {
      found = true;
      break;
    }
    t += d * 0.9;
    if (t > 6.0) break;
  }
  // Far off, the tunnel glows with the level, like light at its end.
  vec3 fog = mix(uColorB * 0.12, uColorA * 0.8, exp(-length(p) * 5.0) * (0.3 + 0.7 * s.x));
  vec3 col = fog;
  if (found) {
    vec3 pos = ro + rd * t;
    vec2 e = vec2(0.0005 * t, -0.0005 * t);
    vec3 n = normalize(e.xyy * fractal(pos + e.xyy, shape) + e.yyx * fractal(pos + e.yyx, shape) + e.yxy * fractal(pos + e.yxy, shape) + e.xxx * fractal(pos + e.xxx, shape));
    fractal(pos, shape);
    vec3 base = mix(uColorA, uColorB, clamp(trap * 1.6, 0.0, 1.0));
    float ao = 1.0 - steps / float(uSteps);
    float diff = 0.35 + 0.65 * max(dot(n, -rd), 0.0);
    col = mix(base * diff * (0.3 + 0.9 * ao), fog, 1.0 - exp(-t * 0.6));
  }
  // The treble lights the edges the rays skimmed.
  col += uGlowColor * glow * uGlow * (0.15 + 1.5 * s.w + 0.5 * hit);
  fragColor = vec4(1.0 - exp(-col * 1.5), 1.0);
}`,
  ),
  presets: [
    { name: "Ember", values: { uColorA: [1, 0.45, 0.1], uColorB: [0.35, 0.05, 0.05], uGlowColor: [1, 0.8, 0.3] } },
    { name: "Ice cave", values: { uColorA: [0.7, 0.9, 1], uColorB: [0.1, 0.2, 0.5], uGlowColor: [0.6, 1, 1] } },
    { name: "Fast", values: { uSpeed: 1.4, uLurch: 1.6, uSteps: 56 } },
  ],
};

export const ferrofluidSpikes: ShaderEffect = {
  kind: "shader",
  id: "ferrofluid-spikes",
  name: "Ferrofluid spikes",
  description:
    "A puddle of glossy black magnetic fluid standing up in hexagonal spikes: the spectrum sets their height from the middle (bass) out (treble), each beat pulses the magnet and the treble sets the tips swaying.",
  category: "audio",
  tags: ["audio", "music", "ferrofluid", "magnetic", "liquid", "spikes", "3d", "visualizer", "beat"],
  source: glsl(
    `// Ferrofluid spikes: a ray-marched pool with a cone on every cell of a hex grid, smoothly joined; spike height is the spectrum by radius.
uniform float uGain;         // @control min=0.3 max=2.5 default=1 label="Spike height"
uniform float uPulse;        // @control min=0 max=2 default=1 label="Beat pulse"
uniform float uSway;         // @control min=0 max=2 default=1 label="Treble sway"
uniform float uSpacing;      // @control min=0.08 max=0.2 default=0.11 label="Spike spacing"
uniform vec3 uLightA;        // @control color default=#FF6A3D label="Light 1"
uniform vec3 uLightB;        // @control color default=#3DA9FF label="Light 2"
uniform vec3 uDish;          // @control color default=#D9D6CF label="Dish"
uniform vec3 uBackground;    // @control color default=#0C0C10 label="Background"
${DEMO}`,
    SOUND,
    `float gHit;
float gTreble;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// The nearest centre of a hex grid of unit spacing: xy = p from it, zw = the centre.
vec4 hexCell(vec2 p) {
  const vec2 S = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / S.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * S, p - (c.zw + 0.5) * S);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy * S) : vec4(h.zw, (c.zw + 0.5) * S);
}

// The fluid: a flat pool of radius 1, with a spike on each cell, melted into it.
float fluid(vec3 p) {
  float pool = (length(p / vec3(1.0, 0.09, 1.0)) - 1.0) * 0.09;
  vec4 h = hexCell(p.xz / uSpacing);
  vec2 centre = h.zw * uSpacing;
  float rc = length(centre);
  if (rc > 0.9) return pool;
  // Tallest in the middle; each spike's height is the spectrum at its radius, kicked up on the beat.
  float tall = (1.0 - rc * rc) * (0.06 + 0.45 * spectrum(rc / 0.9) * uGain) * (1.0 + 0.6 * gHit * uPulse) * uSpacing / 0.11;
  tall = max(tall, 0.01);
  float y = clamp(p.y / tall, 0.0, 1.0);
  // The tips sway with the treble.
  vec2 local = h.xy * uSpacing - vec2(sin(iTime * 9.0 + centre.x * 23.0), cos(iTime * 7.0 + centre.y * 19.0)) * 0.012 * uSway * gTreble * y * y;
  float spike = (length(local) - uSpacing * 0.46 * pow(1.0 - y, 1.6)) * 0.6;
  return smin(pool, max(spike, p.y - tall), 0.035);
}

float scene(vec3 p) {
  return min(fluid(p), p.y);
}

// A dark studio: a softbox overhead, two coloured strips either side, a faint horizon.
vec3 studio(vec3 d) {
  vec3 c = uBackground + vec3(0.03) * (d.y * 0.5 + 0.5);
  c += vec3(2.5) * smoothstep(0.45, 0.75, d.y) * smoothstep(0.8, 0.4, abs(d.x));
  float az = atan(d.x, d.z);
  float band = smoothstep(-0.1, 0.15, d.y) * smoothstep(0.85, 0.55, d.y);
  c += uLightA * 2.6 * smoothstep(0.35, 0.12, abs(az - 1.2)) * band;
  c += uLightB * 2.6 * smoothstep(0.35, 0.12, abs(az + 1.2)) * band;
  c += vec3(1.2) * smoothstep(0.3, 0.1, abs(abs(az) - 2.9)) * band;
  // A dim ring of light all round the horizon, so every spike has an outline.
  c += vec3(0.35) * smoothstep(0.0, 0.12, d.y) * smoothstep(0.4, 0.15, d.y);
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  gHit = b >= 0.0 ? exp(-b * 6.0) : 0.0;
  gTreble = s.w;
  // A camera above and in front, drifting slowly round the dish.
  float orbit = iTime * 0.06;
  vec3 ro = vec3(sin(orbit) * 2.5, 1.15, -cos(orbit) * 2.5);
  vec3 fw = normalize(vec3(0.0, 0.12, 0.0) - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 rd = normalize(p.x * rt + p.y * cross(fw, rt) + 1.8 * fw);
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    float d = scene(ro + rd * t);
    if (d < 0.0006 * t) {
      hit = true;
      break;
    }
    t += d;
    if (t > 9.0) break;
  }
  vec3 col = uBackground * (1.0 - 0.3 * length(p));
  if (hit) {
    vec3 pos = ro + rd * t;
    float f = fluid(pos);
    if (f < pos.y + 0.001) {
      // Black glass: almost no colour of its own, a mirror at grazing angles.
      vec2 e = vec2(0.0008, -0.0008);
      vec3 n = normalize(e.xyy * fluid(pos + e.xyy) + e.yyx * fluid(pos + e.yyx) + e.yxy * fluid(pos + e.yxy) + e.xxx * fluid(pos + e.xxx));
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      col = vec3(0.008) + studio(reflect(rd, n)) * (0.22 + 0.78 * fres);
    } else {
      // The dish, lit from above, darkened round the pool and fading off into the room.
      float ao = 0.35 + 0.65 * smoothstep(0.0, 0.3, f);
      col = uDish * (0.35 + 0.5 * smoothstep(-2.0, 1.0, -length(pos.xz))) * ao;
      col = mix(col, uBackground, smoothstep(1.4, 2.6, length(pos.xz)));
    }
  }
  fragColor = vec4(1.0 - exp(-col * 1.3), 1.0);
}`,
  ),
  presets: [
    { name: "White dish", values: { uDish: [1, 1, 1], uBackground: [0.8, 0.8, 0.82], uLightA: [1, 1, 1], uLightB: [1, 1, 1] } },
    { name: "Fine", values: { uSpacing: 0.08, uGain: 1.4 } },
    { name: "Calm", values: { uPulse: 0.3, uSway: 0.3, uGain: 0.7 } },
  ],
};

export const saturnRings: ShaderEffect = {
  kind: "shader",
  id: "saturn-rings",
  name: "Saturn rings",
  description:
    "A ringed planet whose rings are the spectrum, bin by bin, each ringlet's density following its band; the planet shadows the rings, the rings stripe the planet, the treble stirs dark spokes and each beat sends a wave out through them.",
  category: "audio",
  tags: ["audio", "music", "saturn", "planet", "ring", "space", "spectrum", "3d", "visualizer", "beat"],
  source: glsl(
    `// Saturn rings: a ray-traced oblate planet and ring plane; the rings' density is Saturn's own profile scaled by the spectrum at each radius.
uniform float uTilt;         // @control min=3 max=40 default=16 label="Ring tilt (degrees)"
uniform float uSun;          // @control min=-3.14 max=3.14 default=-0.9 label="Sun direction"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform float uSpokes;       // @control min=0 max=2 default=1 label="Spokes (treble)"
uniform float uWave;         // @control min=0 max=2 default=1 label="Beat wave"
uniform vec3 uPlanet;        // @control color default=#E3C595 label="Planet"
uniform vec3 uBands;         // @control color default=#A87B4F label="Bands"
uniform vec3 uRings;         // @control color default=#EDE2CB label="Rings"
uniform float uStars;        // @control min=0 max=1 default=0.6 label="Stars"
${DEMO}`,
    HASH,
    NOISE,
    SOUND,
    ROTATE,
    `// The rings' inner and outer radii, in planet radii; the planet is squashed to 0.9 at the poles.
const float RI = 1.25;
const float RO = 2.35;
const vec3 OBLATE = vec3(1.0, 1.0 / 0.9, 1.0);

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// Where a ray first meets the planet, or -1.
float planetHit(vec3 ro, vec3 rd) {
  vec3 o = ro * OBLATE;
  vec3 d = rd * OBLATE;
  float a = dot(d, d);
  float bb = dot(o, d);
  float h = bb * bb - a * (dot(o, o) - 1.0);
  if (h < 0.0) return -1.0;
  float t = (-bb - sqrt(h)) / a;
  return t > 0.0 ? t : -1.0;
}

// Saturn's rings, x 0 (inner) to 1 (outer): the faint C ring, bright B ring, the Cassini division, the A ring with the
// Encke gap, and the thin F ring.
float profile(float x) {
  float c = 0.22 * smoothstep(0.0, 0.05, x) * step(x, 0.26);
  float bRing = 0.95 * smoothstep(0.24, 0.27, x) * smoothstep(0.585, 0.575, x);
  float aRing = 0.7 * smoothstep(0.64, 0.66, x) * smoothstep(0.93, 0.91, x) * (1.0 - 0.9 * exp(-pow((x - 0.86) / 0.006, 2.0)));
  float f = 0.6 * exp(-pow((x - 0.98) / 0.004, 2.0));
  return max(max(c, bRing), max(aRing, f));
}

// The rings' density at q (in the ring plane), 0–1.
float rings(vec2 q, float b, float hit, float treble) {
  float r = length(q);
  float x = (r - RI) / (RO - RI);
  if (x < 0.0 || x > 1.0) return 0.0;
  float base = profile(x);
  // Fine ringlets, and each ringlet's band of the spectrum thickening it.
  float ringlets = 0.55 * vnoise(vec2(x * 320.0, 0.5)) + 0.45 * vnoise(vec2(x * 90.0, 3.5));
  float d = base * (0.25 + 0.75 * ringlets) * (0.35 + 1.1 * spectrum(x) * uReact);
  // Spokes: dark radial smudges across the B ring, turning with it, stirred by the treble.
  vec2 dir = rot(iTime * 0.08) * (q / r);
  float spokes = smoothstep(0.55, 0.85, vnoise(dir * 7.0 + vec2(0.0, x * 3.0))) * smoothstep(0.25, 0.35, x) * smoothstep(0.6, 0.5, x);
  d *= 1.0 - 0.6 * spokes * treble * uSpokes;
  // The beat: a density wave running outward.
  d += uWave * hit * 0.6 * step(0.01, base) * exp(-pow((x - b * 0.9) / 0.025, 2.0));
  return clamp(d, 0.0, 1.0);
}

vec3 sky(vec3 d) {
  vec3 g = d * 110.0;
  float h = hash13(floor(g));
  return vec3(0.004, 0.004, 0.008) + step(0.985, h) * exp(-length(fract(g) - 0.5) * 9.0) * mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), fract(h * 41.0)) * uStars;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = rot(0.3) * (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 1.5) : 0.0;
  float tilt = radians(uTilt);
  vec3 ro = vec3(0.0, sin(tilt), -cos(tilt)) * 7.0;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 rd = normalize(p.x * rt + p.y * cross(fw, rt) + 2.2 * fw);
  vec3 sun = normalize(vec3(cos(uSun), 0.3, sin(uSun)));
  vec3 col = sky(rd);
  float tp = planetHit(ro, rd);
  if (tp > 0.0) {
    vec3 pos = ro + rd * tp;
    vec3 n = normalize(pos * OBLATE * OBLATE);
    // Bands by latitude, wavering, with a little turbulence.
    float lat = pos.y * 0.9;
    float w = vnoise(vec2(lat * 9.0, atan(pos.z, pos.x) * 2.0 + iTime * 0.02));
    float bands = 0.5 + 0.5 * sin(lat * 26.0 + w * 2.5) * (0.6 + 0.4 * vnoise(vec2(lat * 40.0, 1.0)));
    vec3 c = mix(uPlanet, uBands, bands * 0.7);
    float light = smoothstep(-0.05, 0.4, dot(n, sun));
    // The rings' shadow on the planet.
    float k = -pos.y / sun.y;
    if (k > 0.0) light *= 1.0 - 0.85 * rings((pos + sun * k).xz, b, hit, s.w);
    // Darker towards the limb.
    col = c * light * (0.35 + 0.65 * pow(max(dot(n, -rd), 0.0), 0.4)) + c * 0.02;
  }
  float tr = -ro.y / rd.y;
  if (tr > 0.0 && (tp < 0.0 || tr < tp)) {
    vec3 pos = ro + rd * tr;
    float d = rings(pos.xz, b, hit, s.w);
    if (d > 0.0) {
      float x = (length(pos.xz) - RI) / (RO - RI);
      vec3 c = uRings * mix(vec3(0.75, 0.8, 0.85), vec3(1.05, 1.0, 0.92), smoothstep(0.1, 0.4, x));
      // Lit from our side, or seen against the light, where the thin parts glow brightest.
      float lit = sign(sun.y) == sign(ro.y) ? 0.35 + 0.65 * abs(sun.y) * 2.0 : 0.3 + 1.2 * (1.0 - d);
      // The planet's shadow across the rings.
      if (planetHit(pos + sun * 0.001, sun) > 0.0) lit *= 0.06;
      col = mix(col, c * lit, d);
    }
  }
  fragColor = vec4(1.0 - exp(-col * 1.6), 1.0);
}`,
  ),
  presets: [
    { name: "Edge on", values: { uTilt: 4 } },
    { name: "Backlit", values: { uSun: 1.9, uTilt: 22 } },
    { name: "Ice giant", values: { uPlanet: [0.6, 0.8, 0.9], uBands: [0.35, 0.55, 0.75], uRings: [0.8, 0.88, 0.95] } },
  ],
};

export const solarProminence: ShaderEffect = {
  kind: "shader",
  id: "solar-prominence",
  name: "Solar prominence",
  description:
    "The edge of the sun up close: a boiling surface, and arches of glowing plasma rising off it, one to a band of the spectrum; on each beat one of them snaps in a flare of light.",
  category: "audio",
  tags: ["audio", "music", "sun", "solar", "plasma", "fire", "space", "visualizer", "beat"],
  source: glsl(
    `// Solar prominence: the sun's limb with granulation, a corona, and plasma arches (ellipses on the limb) whose heights are the spectrum.
uniform int uArches;         // @control min=3 max=12 default=7 label="Arches"
uniform float uHeight;       // @control min=0.3 max=2 default=1 label="Height"
uniform float uBoil;         // @control min=0 max=2 default=1 label="Surface boil (treble)"
uniform float uFlare;        // @control min=0 max=2 default=1 label="Beat flare"
uniform vec3 uSurface;       // @control color default=#FFB547 label="Surface"
uniform vec3 uPlasma;        // @control color default=#FF4D1F label="Plasma"
uniform vec3 uCorona;        // @control color default=#FFD9A0 label="Corona"
uniform vec3 uSpace;         // @control color default=#050307 label="Space"
${DEMO}`,
    HASH,
    NOISE,
    FBM,
    SOUND,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float t = iTime;
  // The sun: a big disc below the frame, its limb arching across the lower part.
  vec2 C = vec2(-0.15, -1.6);
  float Rs = 1.3;
  vec2 d = p - C;
  float rad = length(d);
  float ang = atan(d.x, d.y);
  float alt = rad - Rs;
  // Space, and a corona of streamers fading out from the limb.
  float streamers = 0.6 + 0.4 * vnoise(vec2(ang * 28.0, max(alt, 0.0) * 3.0 - t * 0.05));
  vec3 col = uSpace + uCorona * (0.4 * exp(-max(alt, 0.0) / 0.06) + 0.08 * exp(-max(alt, 0.0) / 0.45)) * streamers;
  // The surface: granules boiling, faster and sharper with the treble, darker towards the limb.
  vec2 sp = d * 14.0;
  float boil = t * 0.15 * (1.0 + uBoil * 2.5 * s.w);
  float g = 0.6 * vnoise(sp + vec2(boil, -boil)) + 0.4 * vnoise(sp * 2.3 - vec2(boil * 1.3, boil * 0.7));
  float mu = sqrt(max(1.0 - (rad / Rs) * (rad / Rs), 0.0));
  vec3 surface = uSurface * 1.6 * (0.45 + 0.65 * pow(mu, 0.5)) * (0.75 + 0.6 * g * g);
  col = mix(col, surface, clamp(-alt / px, 0.0, 1.0));
  // The arches. On each beat one of them (picked by when the beat came) flares: brighter, and blown outward.
  float which = floor(hash12(vec2(floor((t - max(b, 0.0)) * 8.0), 3.0)) * float(uArches));
  float flare = b >= 0.0 ? exp(-b * 2.5) * uFlare : 0.0;
  vec3 light = vec3(0.0);
  vec2 foot = vec2(0.0);
  for (int k = 0; k < 12; k++) {
    if (k >= uArches) break;
    float fk = (float(k) + 0.5) / float(uArches);
    float level = spectrum(fk);
    float a0 = (fk - 0.5) * 1.1 + 0.03 * sin(t * 0.2 + float(k));
    float w = 0.05 + 0.05 * hash12(vec2(float(k), 1.0));
    float h = (0.04 + 0.3 * level) * uHeight;
    float boost = 0.0;
    if (float(k) == which) {
      h += max(b, 0.0) * 0.5 * uFlare;
      boost = flare;
      foot = C + vec2(sin(a0), cos(a0)) * Rs;
    }
    // In the arch's own frame: u along the limb, v up from it.
    vec2 uv = vec2((ang - a0) * Rs / w, alt / h);
    float e = length(uv);
    float dist = abs(e - 1.0) * min(w, h);
    if (dist > 0.12 || alt < -0.01) continue;
    // Twisting strands of plasma flowing along the arch.
    float along = atan(uv.y, uv.x);
    float strands = fbm(vec2(along * 6.0 - t * 0.6 * (1.0 + level), e * 14.0 + float(k) * 3.0), 3);
    float thick = 0.01 + 0.02 * level;
    float glowing = exp(-dist / thick) * (0.15 + 2.2 * strands * strands * strands) + 0.05 * exp(-dist / (thick * 5.0));
    light += uPlasma * glowing * (0.4 + 1.4 * level + 2.0 * boost) * smoothstep(-0.01, 0.01, alt);
  }
  col += light;
  // The flare's flash, washing out from the arch's foot.
  col += mix(uCorona, vec3(1.0), 0.5) * flare * 0.7 * exp(-length(p - foot) * 6.0);
  fragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`,
  ),
  presets: [
    { name: "H-alpha", values: { uSurface: [1, 0.35, 0.15], uPlasma: [1, 0.15, 0.1], uCorona: [1, 0.5, 0.35] } },
    { name: "Blue star", values: { uSurface: [0.6, 0.8, 1], uPlasma: [0.4, 0.6, 1], uCorona: [0.7, 0.85, 1] } },
    { name: "Tall", values: { uHeight: 1.7, uArches: 5 } },
  ],
};

export const plasmaGlobe: ShaderEffect = {
  kind: "shader",
  id: "plasma-globe",
  name: "Plasma globe",
  description:
    "A plasma lamp: lightning filaments crackling from the centre to the glass, one to a band of the spectrum, jagged with the treble; on each beat they all leap to one spot on the glass as if a finger touched it.",
  category: "audio",
  tags: ["audio", "music", "plasma", "lightning", "electric", "lamp", "neon", "visualizer", "beat"],
  source: glsl(
    `// Plasma globe: filaments as noisy angles out from the centre of a glass sphere; each one's brightness is a band of the spectrum.
uniform int uFilaments;      // @control min=4 max=16 default=9 label="Filaments"
uniform float uJag;          // @control min=0 max=2 default=1 label="Jaggedness"
uniform float uTouch;        // @control min=0 max=1 default=1 label="Beat touch"
uniform vec3 uFilament;      // @control color default=#D86BFF label="Filament"
uniform vec3 uCore;          // @control color default=#B9E6FF label="Core"
uniform vec3 uGlass;         // @control color default=#9AA5FF label="Glass"
uniform vec3 uBackground;    // @control color default=#050409 label="Background"
${DEMO}`,
    HASH,
    NOISE,
    SOUND,
    `const float PI = 3.14159265;

float turn(float a) {
  return mod(a + PI, 2.0 * PI) - PI;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px - vec2(0.0, 0.05);
  vec4 s = sound();
  float b = beat();
  float t = iTime;
  float R = 0.36;
  float r = length(p);
  float ang = atan(p.y, p.x);
  vec3 col = uBackground * (1.0 - 0.4 * length(p));
  // The stand: a dark tapered base under the globe.
  float y = (p.y + R + 0.2) / 0.2;
  float stand = step(0.0, y) * step(y, 1.0) * step(abs(p.x), 0.1 + 0.05 * (1.0 - y));
  col = mix(col, vec3(0.06, 0.06, 0.08) * (1.0 + 0.6 * smoothstep(0.1, -0.1, p.x)), stand);
  // Where the beat's finger touches, and how hard the filaments are drawn to it.
  float touchA = (hash12(vec2(floor((t - max(b, 0.0)) * 8.0), 1.7)) - 0.5) * 2.0 * PI;
  float pull = b >= 0.0 ? uTouch * exp(-b * 2.5) : 0.0;
  vec3 light = vec3(0.0);
  if (r < R) {
    for (int k = 0; k < 16; k++) {
      if (k >= uFilaments) break;
      float fk = float(k);
      float level = spectrum((fk + 0.5) / float(uFilaments));
      float base = 2.0 * PI * (fk + 0.3 * vnoise(vec2(t * 0.25, fk * 7.0))) / float(uFilaments) + 0.2 * sin(t * 0.3 + fk * 1.3);
      // Drawn towards the touch near the glass.
      float toTouch = turn(touchA - base);
      base += toTouch * pull * smoothstep(0.15, 1.0, r / R) * smoothstep(2.0, 0.6, abs(toTouch));
      // The crackle: an angle that wanders more further out, and finer with the treble.
      float jag = (vnoise(vec2(r * 14.0 - t * 2.0, fk * 5.1)) - 0.5) * 0.35 + (vnoise(vec2(r * 70.0 - t * 11.0, fk * 2.3)) - 0.5) * 0.22 * (0.4 + s.w)
        + (vnoise(vec2(r * 180.0 - t * 23.0, fk * 9.7)) - 0.5) * 0.1 * (0.3 + s.w);
      float a = base + jag * uJag * (r / R);
      float dist = abs(turn(ang - a)) * r;
      float width = 0.002 + 0.004 * level;
      float core = exp(-dist / width);
      float halo = 0.3 * exp(-dist / (width * 7.0));
      light += mix(uFilament, uCore, core * 0.6) * (core + halo) * (0.3 + 1.4 * level + pull) * smoothstep(0.02, 0.07, r);
      // A soft spot where it meets the glass.
      float end = base + (vnoise(vec2(R * 14.0 - t * 2.0, fk * 5.1)) - 0.5) * 0.35 * uJag;
      light += uFilament * (0.3 + level) * 0.5 * exp(-length(p - R * vec2(cos(end), sin(end))) / 0.015);
    }
    // The electrode in the middle, glowing with the level.
    light += uCore * (0.5 + s.x) * (exp(-r / 0.02) + 0.3 * exp(-r / 0.08));
    // A faint haze filling the glass.
    light += uGlass * 0.04;
  }
  // The touch: a bright spot on the glass.
  light += vec3(1.0) * pull * 0.8 * exp(-length(p - R * vec2(cos(touchA), sin(touchA))) / 0.02);
  // The glass: a rim, and a highlight at the top left.
  float rim = exp(-abs(r - R) / 0.004) * 0.35 + exp(-max(r - R, 0.0) / 0.03) * 0.04 * step(R, r);
  vec2 hl = (p - vec2(-0.14, 0.17)) / vec2(0.08, 0.035);
  float highlight = exp(-dot(hl, hl) * 2.0) * 0.18 * step(r, R);
  col += light + uGlass * rim + vec3(highlight);
  fragColor = vec4(1.0 - exp(-col * 1.5), 1.0);
}`,
  ),
  presets: [
    { name: "Tesla", values: { uFilament: [0.4, 0.6, 1], uCore: [0.9, 0.95, 1], uGlass: [0.6, 0.7, 1] } },
    { name: "Inferno", values: { uFilament: [1, 0.35, 0.1], uCore: [1, 0.9, 0.6], uGlass: [1, 0.6, 0.4] } },
    { name: "Wild", values: { uFilaments: 14, uJag: 1.8 } },
  ],
};

export const pulsar: ShaderEffect = {
  kind: "shader",
  id: "pulsar",
  name: "Pulsar",
  description:
    "A spinning neutron star wrapped in loops of magnetic field, one to a band of the spectrum, sweeping two lighthouse beams round; each beat whites out the frame as a beam crosses it.",
  category: "audio",
  tags: ["audio", "music", "pulsar", "neutron-star", "space", "beam", "magnetic", "visualizer", "beat"],
  source: glsl(
    `// Pulsar: a dipole's field lines (r = L sin²θ round a tilted, spinning magnetic axis) projected to the screen, and beams along the axis.
uniform float uSpin;         // @control min=0 max=3 default=0.8 label="Spin"
uniform float uTilt;         // @control min=0.1 max=1.4 default=0.7 label="Magnetic tilt"
uniform float uField;        // @control min=0 max=2 default=1 label="Field lines"
uniform float uBeam;         // @control min=0 max=2 default=1 label="Beams"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat flash"
uniform vec3 uStar;          // @control color default=#DDEBFF label="Star"
uniform vec3 uFieldColor;    // @control color default=#8B5CFF label="Field"
uniform vec3 uBeamColor;     // @control color default=#9FE7FF label="Beam"
uniform vec3 uSpace;         // @control color default=#03030A label="Space"
${DEMO}`,
    HASH,
    NOISE,
    SOUND,
    `const float PI = 3.14159265;

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0));
}

// A unit vector perpendicular to v.
vec3 across(vec3 v) {
  return normalize(abs(v.y) < 0.9 ? cross(v, vec3(0.0, 1.0, 0.0)) : cross(v, vec3(1.0, 0.0, 0.0)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 5.0) : 0.0;
  // The spin axis leans a little towards us; the magnetic axis turns round it, tilted off it.
  vec3 axis = normalize(vec3(0.2, 1.0, 0.35));
  vec3 e1 = across(axis);
  vec3 e2 = cross(axis, e1);
  float phase = iTime * uSpin * 2.0 + 0.6 * s.y;
  vec3 m = cos(uTilt) * axis + sin(uTilt) * (cos(phase) * e1 + sin(phase) * e2);
  vec3 f1 = across(m);
  vec3 f2 = cross(m, f1);
  // Space, with faint violet haze and stars, bent a little round the star.
  vec2 bent = p + normalize(p + 1e-5) * 0.0015 / max(dot(p, p), 0.01);
  vec3 col = uSpace + uFieldColor * 0.06 * vnoise(bent * 3.0 + 4.0) * vnoise(bent * 7.0);
  vec2 cell = floor(bent * 260.0);
  col += vec3(0.85, 0.9, 1.0) * step(0.996, hash12(cell)) * (0.6 + 0.4 * sin(iTime * 3.0 + hash12(cell + 3.0) * 50.0));
  // The field lines: eight round the axis, two shells each, each a band of the spectrum.
  vec3 light = vec3(0.0);
  for (int j = 0; j < 16; j++) {
    float level = spectrum(float(j) / 15.0);
    float psi = 2.0 * PI * float(j / 2) / 8.0 + 0.2 * float(j % 2);
    float L = (j % 2 == 0 ? 0.32 : 0.18) * (0.55 + 0.9 * level * uField);
    // A loop never reaches further than L from the star: skip it where its glow cannot reach.
    if (length(p) > L + 0.06) continue;
    vec3 side = cos(psi) * f1 + sin(psi) * f2;
    float best = 1e3;
    vec2 prev = vec2(0.0);
    for (int i = 0; i <= 22; i++) {
      float th = PI * float(i) / 22.0;
      float sn = sin(th);
      vec2 q = (L * sn * sn * (sn * side + cos(th) * m)).xy;
      if (i > 0) best = min(best, segment(p, prev, q));
      prev = q;
    }
    light += (vec3(0.8) * exp(-best / 0.002) + uFieldColor * (0.6 * exp(-best / 0.004) + 0.35 * exp(-best / 0.02))) * (0.15 + 1.2 * level) * uField;
  }
  // The beams, out both ways along the magnetic axis, widening.
  float facing = abs(m.z);
  for (int k = 0; k < 2; k++) {
    vec2 dir = (k == 0 ? m.xy : -m.xy);
    float len = length(dir);
    if (len < 1e-3) continue;
    dir /= len;
    float along = dot(p, dir);
    float perp = abs(dot(p, vec2(-dir.y, dir.x)));
    float width = 0.008 + along * 0.12 * (1.0 - 0.5 * len);
    if (along > 0.0) light += uBeamColor * exp(-perp / width) * exp(-along * 1.2) * uBeam * (0.6 + 0.8 * s.x);
  }
  // A beam pointing at us whites out the frame; the beat does too.
  float flash = pow(facing, 24.0) * uBeam + 0.6 * hit * uFlash;
  light += uBeamColor * flash * (0.6 * exp(-length(p) * 4.0) + 0.05);
  // The star itself.
  float r = length(p);
  light += uStar * (exp(-r / 0.012) * 2.0 + 0.4 * exp(-r / 0.05)) * (0.8 + 0.4 * s.x);
  col += light;
  fragColor = vec4(1.0 - exp(-col * 1.3), 1.0);
}`,
  ),
  presets: [
    { name: "Magnetar", values: { uFieldColor: [1, 0.35, 0.2], uBeamColor: [1, 0.85, 0.6], uField: 1.6, uTilt: 1.1 } },
    { name: "Millisecond", values: { uSpin: 2.6, uBeam: 1.4 } },
    { name: "Field only", values: { uBeam: 0, uFlash: 0.3 } },
  ],
};

export const nebulaPillars: ShaderEffect = {
  kind: "shader",
  id: "nebula-pillars",
  name: "Nebula pillars",
  description:
    "Dark pillars of dust in a glowing nebula, its gases lit by the music: red by the bass, teal by the mids, blue by the treble; on each beat a newborn star in a pillar's head flares and lights its edges.",
  category: "audio",
  tags: ["audio", "music", "nebula", "space", "pillars", "gas", "background", "ambient", "visualizer", "beat"],
  source: glsl(
    `// Nebula pillars: three warped fractal-noise gases, one per band (bass, mid, treble), behind noisy dust pillars rim-lit by a star.
uniform float uDrift;        // @control min=0 max=1 default=0.3 label="Drift"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform float uPillars;      // @control min=0 max=1 default=1 label="Pillars"
uniform float uFlare;        // @control min=0 max=2 default=1 label="Beat flare"
uniform vec3 uBassGas;       // @control color default=#FF3B4E label="Bass gas"
uniform vec3 uMidGas;        // @control color default=#2EE6C9 label="Mid gas"
uniform vec3 uHighGas;       // @control color default=#4D7CFF label="Treble gas"
uniform vec3 uDust;          // @control color default=#1E120D label="Dust"
${DEMO}`,
    HASH,
    NOISE,
    FBM,
    SOUND,
    `// How far p is outside the pillars (negative inside): three broad, leaning, tapering columns, torn ragged by noise.
float pillars(vec2 p) {
  float d = 1e3;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float cx = -0.45 + 0.43 * fk;
    float top = fk == 1.0 ? 0.24 : (fk == 0.0 ? 0.06 : -0.1);
    float y = clamp((p.y + 0.6) / (top + 0.6), 0.0, 1.0);
    float x = cx + 0.1 * (p.y + 0.6) * (fk - 1.0) + 0.12 * (fbm(vec2(p.y * 2.5, fk * 5.0), 4) - 0.5);
    float body = max(abs(p.x - x) - mix(0.2 - 0.03 * fk, 0.075, pow(y, 0.7)), p.y - top);
    d = min(d, body);
  }
  return d + 0.12 * (fbm(p * 6.0, 5) - 0.5) + 0.035 * (fbm(p * 20.0, 3) - 0.5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound() * uReact;
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 4.0) * uFlare : 0.0;
  float t = iTime * uDrift;
  // The gas drifts slowly past.
  vec2 g = p * (1.0 - 0.04 * sin(t * 0.3)) + vec2(t * 0.05, 0.0);
  vec2 w = vec2(fbm(g * 1.5 + t * 0.1, 4), fbm(g * 1.5 + 5.2 - t * 0.08, 4));
  float red = fbm(g * 2.0 + w * 1.5, 5);
  float teal = fbm(g * 2.6 + w.yx * 1.7 + 3.0, 5);
  float blue = fbm(g * 3.4 - w * 1.2 + 7.0, 4);
  red = smoothstep(0.3, 0.85, red);
  teal = smoothstep(0.35, 0.85, teal);
  blue = smoothstep(0.35, 0.9, blue);
  vec3 col = uBassGas * red * red * 1.6 * (0.3 + 1.3 * s.y);
  col += uMidGas * teal * teal * 1.4 * (0.25 + 1.3 * s.z);
  col += uHighGas * blue * blue * 1.5 * (0.25 + 1.4 * s.w);
  // Stars: many faint, a few bright with six-pointed diffraction spikes.
  vec2 cell = floor(g * 220.0);
  col += vec3(0.8, 0.85, 1.0) * step(0.995, hash12(cell)) * 0.7;
  vec2 big = floor(g * 6.0);
  vec2 bh = hash22(big);
  if (bh.x > 0.75) {
    vec2 q = g * 6.0 - big - 0.2 - 0.6 * bh;
    float spikes = 0.0;
    for (int i = 0; i < 3; i++) {
      float a = float(i) * 1.0472;
      vec2 r = vec2(cos(a) * q.x + sin(a) * q.y, -sin(a) * q.x + cos(a) * q.y);
      spikes += exp(-abs(r.y) / 0.004) * exp(-abs(r.x) / 0.12);
    }
    col += mix(vec3(1.0, 0.9, 0.8), vec3(0.8, 0.9, 1.0), bh.y) * (exp(-length(q) / 0.006) + 0.5 * spikes) * (0.5 + s.w);
  }
  // The pillars: dark dust, faintly glowing inside, their edges lit by the star in the tallest one's head.
  float d = pillars(p);
  float inside = smoothstep(px * 2.0, -px * 2.0, d) * uPillars;
  vec3 dust = uDust * (0.5 + 0.9 * fbm(p * 7.0, 3)) + uBassGas * 0.04 * fbm(p * 4.0 + 9.0, 3);
  col = mix(col, dust, inside);
  vec2 star = vec2(-0.02, 0.2);
  float toward = smoothstep(0.9, 0.0, length(p - star));
  float rim = exp(-abs(d) / 0.01) * smoothstep(0.03, -0.01, d) * uPillars;
  col += mix(uMidGas, vec3(1.0, 0.85, 0.7), 0.5) * rim * toward * (0.25 + 0.6 * s.x + 1.0 * hit);
  // The newborn star itself: hidden in the dust until the beat flares it.
  float sd = length(p - star);
  col += vec3(1.0, 0.9, 0.8) * hit * (exp(-sd / 0.008) * 2.0 + exp(-sd / 0.08) * 0.5);
  fragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`,
  ),
  presets: [
    { name: "Hubble palette", values: { uBassGas: [1, 0.75, 0.25], uMidGas: [0.3, 0.9, 0.5], uHighGas: [0.3, 0.5, 1] } },
    { name: "No pillars", values: { uPillars: 0 } },
    { name: "Still", values: { uDrift: 0, uReact: 0.5 } },
  ],
};

/**
 * Distance from a mask's shape, in frame units (`reach(q)`; 0 inside): disc blurs near it, the coarse
 * texels as discs further out, blended. Needs {@link MASK_FAST} (and so `uMask`, `uSize`) and `setKey()` called.
 */
const SHAPE_REACH = `
// The share of a disc blur that counts as "the shape is within reach"; a disc that little covered by a
// straight edge sits about 0.9 of its radius from it, so radii are scaled by that to give distances.
const float TOUCH = 0.02;
const float EDGE = 0.9;

// Distance from the shape near it, up to about 0.08: the radius at which a disc blur round q reaches the shape,
// between the two radii tried it falls between, so it changes smoothly.
float nearReach(vec2 q) {
  float r0 = 0.0;
  float c0 = shapeAt(q, 0.003);
  if (c0 >= TOUCH) return 0.0;
  float r = 0.008;
  for (int i = 0; i < 7; i++) {
    float c = coverage(q, r);
    if (c >= TOUCH) return EDGE * mix(r0, r, (TOUCH - c0) / max(c - c0, 1e-4));
    r0 = r;
    c0 = c;
    r *= 1.5;
  }
  return EDGE * r0;
}

// Distance from the shape far from it: to the texels of a coarse mip level (at most 8 × 8, or 16 × 4 and so on),
// each a disc a texel across (shrunk for partly covered ones) so neighbours overlap and their outline barely
// scallops, less the 0.44 texel that overlap adds, through a slightly smooth minimum, so contours further out
// come out round.
float farReach(vec2 q) {
  vec2 full = vec2(textureSize(uMask, 0));
  int lod = int(ceil(0.5 * log2(max(full.x * full.y / 64.0, 1.0))));
  ivec2 size = textureSize(uMask, lod);
  vec2 texel = 1.0 / (vec2(size) * gMaskPlace.xy);
  float radius = min(texel.x, texel.y);
  float k = 0.15 * radius;
  // A running log-sum-exp: the nearest distance so far, and the others' weights relative to it.
  float best = 1e3;
  float weight = 0.0;
  for (int y = 0; y < 64; y++) {
    if (y >= size.y) break;
    for (int x = 0; x < 64; x++) {
      if (x >= size.x) break;
      float a = texelFetch(uMask, ivec2(x, y), lod).a;
      if (a < 0.03) continue;
      vec2 centre = ((vec2(x, y) + 0.5) / vec2(size) - 0.5) / gMaskPlace.xy;
      float d = length(q - centre) - radius * sqrt(a);
      if (d < best) {
        weight = weight * exp((d - best) / k) + 1.0;
        best = d;
      } else {
        weight += exp((best - d) / k);
      }
    }
  }
  return weight > 0.0 ? max(best - k * log(weight) + 0.44 * radius, 0.0) : 1.0;
}

// How far q is from the shape, in frame units: the near reckoning close in, the far one further out, blended
// between. A disc with no picture.
float reach(vec2 q) {
  if (gMaskPlace.w < 0.5) return max(length(q) - 0.3 * uSize, 0.0);
  float far = farReach(q);
  if (far > 0.12) return far;
  float near = nearReach(q);
  return mix(near, far, smoothstep(0.04, 0.07, near));
}`.trim();

export const blackHoleSilhouette: ShaderEffect = {
  kind: "shader",
  id: "black-hole-silhouette",
  name: "Black hole silhouette",
  description:
    "Any shape or word as a black hole: an accretion disk of the spectrum hugging its outline (treble close in, bass far out), lensed up over the top and under the bottom, a photon ring tracing its edge and the stars bent round it, flashing on each beat.",
  category: "audio",
  video: "none",
  tags: ["audio", "music", "black-hole", "space", "spectrum", "lensing", "logo", "text", "visualizer", "beat"],
  source: glsl(
    `// Black hole silhouette: distance from the shape (where blurs of growing radius first find it) lays out an accretion disk
// round its outline, seen edge-on in front, and again face-on (as lensed light) over the top and underneath.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("VOID")} label="Shape"
uniform float uSize;         // @control min=0.2 max=1 default=0.6 label="Size"
uniform float uTilt;         // @control min=4 max=40 default=11 label="Disk tilt (degrees)"
uniform float uReach;        // @control min=0.1 max=0.38 default=0.3 label="Disk reach"
uniform float uSpin;         // @control min=0 max=2 default=0.8 label="Spin"
uniform float uDoppler;      // @control min=0 max=1 default=0.6 label="Doppler beaming"
uniform float uLens;         // @control min=0 max=2 default=1 label="Lensing"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat flash"
uniform vec3 uColorHot;      // @control color default=#FFE7B3 label="Inner colour"
uniform vec3 uColorCool;     // @control color default=#FF5A1F label="Outer colour"
uniform float uStars;        // @control min=0 max=1 default=0.7 label="Stars"
${DEMO}`,
    HASH,
    NOISE,
    MASK_FAST,
    SOUND,
    ROTATE,
    SHAPE_REACH,
    `// The disk starts this far out from the shape (frame units), past its photon ring.
const float DIN = 0.03;

// The disk at distance d from the shape, at q (its position, for the swirl and which side is coming towards us).
vec4 disk(float d, vec2 q, vec4 s, float b) {
  float x = (d - DIN) / uReach;
  if (x < 0.0 || x > 1.0) return vec4(0.0);
  // Treble close in, bass far out.
  float level = spectrum(1.0 - x) * uReact;
  // Gas swirling round, faster closer in.
  vec2 r = rot(iTime * uSpin * 0.5 / (0.15 + x)) * q;
  float n = vnoise(r * 12.0) * 0.65 + vnoise(r * 31.0 + 9.0) * 0.35;
  float gas = (0.35 + 1.1 * n * n) * (0.6 + 0.4 * sin(x * 40.0 + n * 3.0));
  float edge = smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.6, x);
  float heat = 0.25 + 0.75 * (1.0 - x) * (1.0 - x);
  // The beat: a bright ripple running out.
  float ripple = b >= 0.0 ? exp(-pow((x - b * 1.6) / 0.05, 2.0)) * exp(-b * 2.0) * uFlash : 0.0;
  float e = edge * (gas * (0.6 * heat + 1.4 * level) + 1.5 * ripple);
  // Doppler beaming: the left side comes towards us, brighter and bluer; the right goes away, dimmer and redder.
  float beta = clamp(uDoppler * (0.45 + 0.3 * s.z) * (1.0 - 0.5 * x), 0.0, 0.9);
  float g = sqrt(1.0 - beta * beta) / (1.0 - beta * -q.x / (abs(q.x) + 0.1));
  vec3 c = mix(uColorHot, uColorCool, smoothstep(0.0, 0.8, x));
  c = mix(c, vec3(0.75, 0.85, 1.0) * max(c.r, max(c.g, c.b)), clamp((g - 1.0) * 0.8, 0.0, 0.6));
  c *= mix(vec3(1.0), vec3(1.0, 0.45, 0.25), clamp((1.0 - g) * 1.5, 0.0, 1.0));
  return vec4(c * e * g * g * g * 1.2, clamp(e * 0.9, 0.0, 0.92));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(0.0);
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 6.0) : 0.0;
  // Distance from the shape as we see it (for the lensed disk, the shadow and the bending), and in the disk's own
  // plane, tilted nearly edge-on (for the disk seen directly), only near that plane.
  float sT = sin(radians(uTilt));
  float dp = reach(p);
  vec2 q = vec2(p.x, p.y / sT);
  float dq = abs(q.y) < 0.6 ? reach(q) : 1.0;
  // The stars, bent towards the shape: more the closer they come, and harder for a moment on the beat.
  vec2 grad = vec2(dFdx(dp), dFdy(dp));
  vec2 toward = dot(grad, grad) > 1e-12 ? -normalize(grad) : -normalize(p + 1e-5);
  vec2 sp = p + toward * uLens * (1.0 + 0.4 * hit * uFlash) * 0.012 / (dp + 0.02);
  vec2 cell = floor(sp * 240.0);
  float h = hash12(cell);
  vec3 col = vec3(0.004, 0.005, 0.012) + vec3(0.8, 0.85, 1.0) * step(0.993, h) * (0.7 + 0.3 * sin(iTime * 6.0 + h * 90.0) * s.w) * uStars;
  // The far half of the disk, lensed up over the top as if seen from above, squeezed into a narrower band;
  // and, fainter, the near half's underside below.
  vec4 arc = disk(DIN + (dp - DIN) * 2.6, p, s, b);
  col += arc.rgb * (p.y > 0.0 ? 1.0 : 0.45) * smoothstep(0.0, 0.02, abs(p.y) + 0.01);
  // The shadow: the shape, and a dark border round it.
  float shadow = max(shapeAt(p, px), smoothstep(0.012, 0.0, dp));
  col *= 1.0 - shadow;
  // The photon ring: light that skimmed the edge, tracing the outline, flashing on the beat.
  col += uColorHot * exp(-pow((dp - 0.016) / 0.004, 2.0)) * (0.35 + 2.0 * hit * uFlash) * (0.5 + s.x) * (1.0 - shadow);
  // The disk seen directly: its far half goes behind the shape, its near half crosses in front.
  vec4 direct = disk(dq, q, s, b);
  if (q.y > 0.0) direct *= 1.0 - shadow;
  col = col * (1.0 - direct.a) + direct.rgb;
  fragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`,
  ),
  presets: [
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uSize: 0.32 } },
    { name: "Logo", values: { uMask: SAMPLE_IMAGES.logo, uSize: 0.32, uColorHot: [0.85, 0.95, 1], uColorCool: [0.25, 0.4, 1] } },
    { name: "Top down", values: { uTilt: 35, uReach: 0.22 } },
  ],
};

export const arcaneSigil: ShaderEffect = {
  kind: "shader",
  id: "arcane-sigil",
  name: "Arcane sigil",
  description:
    "Any shape or word as a magic portal: arcane light swirling inside it, rings of glowing runes hugging its outline (one to a band of the spectrum, turning alternate ways), a tilted ring of runes orbiting it in front and behind, motes of light spiralling in and wisps curling up; each beat sends a pulse out through the runes.",
  category: "audio",
  video: "none",
  tags: ["audio", "music", "magic", "fantasy", "runes", "portal", "arcane", "logo", "text", "visualizer", "beat"],
  source: glsl(
    `// Arcane sigil: distance from the shape lays out bands of procedural runes round its outline, face-on, and one more in a
// tilted plane orbiting it; the shape itself is a portal of swirling light.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("MAGIC")} label="Shape"
uniform float uSize;         // @control min=0.2 max=1 default=0.6 label="Size"
uniform int uRings;          // @control min=1 max=6 default=4 label="Rune rings"
uniform float uSpacing;      // @control min=0.03 max=0.08 default=0.05 label="Ring spacing"
uniform float uTilt;         // @control min=4 max=40 default=14 label="Orbit tilt (degrees)"
uniform float uSpin;         // @control min=0 max=2 default=0.6 label="Spin"
uniform float uReact;        // @control min=0 max=2 default=1 label="Reactivity"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat pulse"
uniform float uMotes;        // @control min=0 max=1 default=0.7 label="Motes"
uniform vec3 uRune;          // @control color default=#FFCF6B label="Runes"
uniform vec3 uArcane;        // @control color default=#8B5CFF label="Arcane"
uniform vec3 uWisp;          // @control color default=#3EE6D0 label="Wisps"
uniform vec3 uNight;         // @control color default=#07041A label="Night"
${DEMO}`,
    HASH,
    NOISE,
    FBM,
    MASK_FAST,
    SOUND,
    ROTATE,
    SHAPE_REACH,
    `const float PI = 3.14159265;
// The first ring of runes starts this far out from the shape (frame units).
const float DIN = 0.035;

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0));
}

// A rune in a cell (uv 0–1): a stem and a few twigs, which ones picked by the bits of h.
float rune(vec2 uv, float h) {
  float d = segment(uv, vec2(0.5, 0.12), vec2(0.5, 0.88));
  if (fract(h * 2.0) > 0.5) d = min(d, segment(uv, vec2(0.5, 0.88), vec2(0.82, 0.62)));
  if (fract(h * 4.0) > 0.5) d = min(d, segment(uv, vec2(0.5, 0.62), vec2(0.18, 0.42)));
  if (fract(h * 8.0) > 0.5) d = min(d, segment(uv, vec2(0.5, 0.38), vec2(0.82, 0.12)));
  if (fract(h * 16.0) > 0.5) d = min(d, segment(uv, vec2(0.5, 0.88), vec2(0.18, 0.62)));
  if (fract(h * 32.0) > 0.55) d = min(d, segment(uv, vec2(0.18, 0.55), vec2(0.82, 0.35)));
  return d;
}

// A band of runes between two thin border lines: d is the distance from the shape, mid the band's middle and hw
// its half-width; runes run round it by the angle of q, count of them, turned by turn (in turns).
float runeBand(float d, float mid, float hw, vec2 q, float turn, float count, float seed) {
  float lines = exp(-pow((abs(d - mid) - hw * 1.25) / 0.0018, 2.0));
  float v = (d - (mid - hw)) / (2.0 * hw);
  if (v < 0.0 || v > 1.0) return lines;
  float a = fract(atan(q.y, q.x) / (2.0 * PI) + turn);
  float cell = floor(a * count);
  // Each rune takes the middle 60% of its cell, so they stand apart.
  vec2 uv = vec2((fract(a * count) - 0.5) / 0.6 + 0.5, v);
  if (uv.x < 0.0 || uv.x > 1.0) return lines;
  float h = hash12(vec2(cell, seed));
  float r = rune(uv, h);
  float stroke = smoothstep(0.09, 0.04, r) + 0.35 * exp(-r / 0.12);
  return lines + stroke * (0.7 + 0.3 * sin(iTime * 2.0 + h * 40.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(0.0);
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 5.0) : 0.0;
  float t = iTime;
  float n = float(uRings);
  // Distance from the shape face-on (for the rings), and in the orbit's tilted plane, only near that plane.
  float dp = reach(p);
  float sT = sin(radians(uTilt));
  vec2 q = vec2(p.x, p.y / sT);
  float orbitMid = DIN + uSpacing * (n + 0.8);
  float dq = abs(q.y) < 0.6 ? reach(q) : 1.0;
  // Night: deep, with a faint violet haze and stars.
  vec3 col = uNight * (1.2 - 0.6 * length(p)) + uArcane * 0.08 * fbm(p * 2.5 + vec2(t * 0.02, 0.0), 4);
  float star = hash12(floor(fragCoord / 2.0));
  col += vec3(0.9, 0.85, 1.0) * step(0.997, star) * (0.5 + 0.5 * sin(t * 3.0 + star * 70.0));
  // Wisps curling up off the shape, stirred by the bass.
  float wisp = fbm(p * 3.5 + vec2(0.3 * sin(t * 0.2), -t * 0.35) + fbm(p * 2.0 - t * 0.1, 3), 4);
  col += uWisp * pow(wisp, 3.0) * 2.5 * exp(-dp / 0.09) * (0.4 + 0.9 * s.y);
  // The rings of runes round the outline, treble closest and bass furthest out; a pulse runs out through them on the beat.
  float k = floor((dp - DIN) / uSpacing);
  if (k >= 0.0 && k < n) {
    float x = (k + 0.5) / n;
    float level = spectrum(1.0 - x) * uReact;
    float pulse = b >= 0.0 ? exp(-pow((x - b * 1.4) / 0.15, 2.0)) * exp(-b * 1.5) * uFlash : 0.0;
    float dir = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
    float band = runeBand(dp, DIN + (k + 0.5) * uSpacing, uSpacing * 0.3, p, dir * t * uSpin * 0.03 / (1.0 + 0.3 * k), floor(18.0 + 10.0 * k), k + 1.0);
    col += mix(uRune, vec3(1.0), 0.3 * pulse) * band * (0.25 + 1.3 * level + 1.5 * pulse);
  }
  // Motes of light spiralling in, twinkling with the treble.
  for (int i = 0; i < 32; i++) {
    if (float(i) >= 32.0 * uMotes) break;
    vec2 hh = hash22(vec2(float(i), 3.1));
    float life = fract(t * 0.12 * (0.6 + hh.x) + hh.y);
    float rad = mix(0.6, 0.05, life * life);
    float ang = hh.x * 6.28318 + life * 5.0;
    float m = length(p - vec2(cos(ang) * 1.5, sin(ang)) * rad);
    float twinkle = sin(PI * life) * (0.6 + 0.4 * sin(t * 9.0 + hh.y * 30.0));
    col += mix(uRune, uWisp, hh.y) * twinkle * (1.2 * exp(-m * m / 0.000012) + 0.15 * exp(-m / 0.012)) * (0.5 + s.w);
  }
  // The portal: light swirling inside the shape, tighter towards the middle, a bright rim inside its edge.
  float inside = shapeAt(p, px);
  vec2 sw = rot(t * 0.25 + 1.5 / (0.15 + length(p))) * p;
  float swirl = 0.6 * vnoise(sw * 7.0) + 0.4 * vnoise(sw * 17.0 - t);
  vec3 portal = mix(uArcane * 0.3, uWisp, swirl * swirl) * (0.5 + 0.8 * s.x) + uRune * (1.0 - coverage(p, 0.012)) * 1.5;
  col = mix(col, portal, inside);
  // The edge outside, flashing on the beat.
  col += uRune * exp(-pow(dp / 0.006, 2.0)) * (1.0 - inside) * (0.6 + 1.5 * hit * uFlash);
  // The orbiting ring, tilted: its far half goes behind the shape, its near half crosses in front.
  vec3 orbit = uRune * runeBand(dq, orbitMid, uSpacing * 0.35, q, -t * uSpin * 0.05, 48.0, 99.0) * (0.35 + 1.2 * s.z * uReact + hit * uFlash);
  if (q.y > 0.0) orbit *= 1.0 - inside;
  col += orbit;
  fragColor = vec4(1.0 - exp(-col * 1.3), 1.0);
}`,
  ),
  presets: [
    { name: "Fel fire", values: { uRune: [0.65, 1, 0.3], uArcane: [0.1, 0.5, 0.15], uWisp: [0.5, 1, 0.4], uNight: [0.01, 0.04, 0.02] } },
    { name: "Frost", values: { uRune: [0.75, 0.9, 1], uArcane: [0.2, 0.4, 1], uWisp: [0.85, 1, 1], uNight: [0.01, 0.02, 0.06] } },
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uSize: 0.32 } },
  ],
};

export const spellTrace: ShaderEffect = {
  kind: "shader",
  id: "spell-trace",
  name: "Spell trace",
  description:
    "Any shape or word traced in a hairline of light, as by a wand: a spark sweeps round its outline leaving a fading trail and a few drifting sparkles, a single ring of dots round it shows the spectrum, and each beat sends one soft ring of light out.",
  category: "audio",
  video: "none",
  tags: ["audio", "music", "magic", "minimal", "outline", "sparkle", "logo", "text", "overlay", "visualizer", "beat"],
  transparent: true,
  source: glsl(
    `// Spell trace: the outline (where the distance from the shape is near 0) lit along a trail behind a head sweeping
// round by angle; dots on one contour further out, one to a spectrum bin; a contour expanding on each beat.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("SPELL")} label="Shape"
uniform float uSize;         // @control min=0.2 max=1 default=0.6 label="Size"
uniform float uSpeed;        // @control min=0 max=2 default=0.6 label="Trace speed"
uniform float uTrail;        // @control min=0.05 max=1 default=0.35 label="Trail length"
uniform float uLine;         // @control min=0.5 max=4 default=1.2 label="Line width (px)"
uniform bool uDots;          // @control default=true label="Spectrum dots"
uniform float uDotRing;      // @control min=0.03 max=0.2 default=0.07 label="Dot ring distance"
uniform float uSparkle;      // @control min=0 max=1 default=0.6 label="Sparkles"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat ring"
uniform vec3 uColor;         // @control color default=#CFE3FF label="Light"
uniform vec3 uAccent;        // @control color default=#FFD27A label="Spark"
${DEMO}`,
    HASH,
    MASK_FAST,
    SOUND,
    GLOW,
    SHAPE_REACH,
    `const float PI = 3.14159265;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(0.0);
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 4.0) : 0.0;
  float t = iTime;
  float d = reach(p);
  // Light that spreads from the outline stays outside the shape.
  float outside = 1.0 - shapeAt(p, px);
  // Where the pixel lies round the shape (0–1 from the top, clockwise), and how far behind the head that is.
  float a = fract(0.25 - atan(p.y, p.x) / (2.0 * PI));
  float head = fract(t * uSpeed * 0.15 + 0.1 * s.y);
  float behind = fract(head - a);
  float trail = exp(-behind / max(uTrail, 0.01));
  // The outline: a hairline (pixels from the edge, from the slope of a slightly softened coverage), faint all
  // round, bright along the trail, brightest at the head.
  float v = coverage(p, 3.0 * px) - 0.5;
  float edge = abs(v) / max(length(vec2(dFdx(v), dFdy(v))), 0.02);
  float line = exp(-pow(edge / uLine, 2.0)) + 0.25 * exp(-edge / (uLine * 4.0));
  vec3 light = uColor * line * (0.15 + trail * (1.5 + 1.2 * s.x));
  float spark = 2.0 * exp(-behind / 0.008);
  light += uAccent * spark * (2.0 * line + 0.5 * exp(-d / 0.01) * outside);
  // Sparkles drifting up off the trail, twinkling with the treble.
  vec2 g = (p + vec2(0.0, -t * 0.025)) * 80.0;
  vec2 cell = floor(g);
  float h = hash12(cell);
  if (h > 1.0 - 0.06 * uSparkle) {
    vec2 at = (cell + 0.3 + 0.4 * hash22(cell)) / 80.0 + vec2(0.0, t * 0.025);
    float m = length(p - at);
    float twinkle = 0.5 + 0.5 * sin(t * 7.0 + h * 60.0);
    light += mix(uColor, uAccent, 0.5) * exp(-m * m / 0.0000045) * twinkle * exp(-d / 0.03) * outside * trail * (0.6 + s.w);
  }
  // The spectrum: a ring of 64 dots on one contour round the shape, each as bright and big as its bin.
  if (uDots) {
    float dots = 64.0;
    float i = floor(a * dots);
    float level = spectrum((i + 0.5) / dots);
    float along = (fract(a * dots) - 0.5) * 2.0 * PI * length(p) / dots;
    float r = length(vec2(along, d - uDotRing));
    float size = 0.0012 + 0.0035 * level;
    light += uColor * (smoothstep(size + px, size - px, r) * (0.25 + 0.9 * level) + 0.3 * level * exp(-r / 0.006));
  }
  // The beat: one soft ring of light running out from the outline.
  light += uColor * uFlash * hit * exp(-pow((d - max(b, 0.0) * 0.35) / 0.004, 2.0)) * outside * 0.8;
  light += uAccent * uFlash * hit * line * 0.6;
  fragColor = glow(light * 1.2);
}`,
  ),
  presets: [
    { name: "Gold leaf", values: { uColor: [1, 0.85, 0.55], uAccent: [1, 1, 0.9] } },
    { name: "Moonlight", values: { uColor: [0.75, 0.8, 1], uAccent: [0.85, 0.9, 1], uSparkle: 1, uTrail: 0.6 } },
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uSize: 0.4 } },
  ],
};

export const rippleDot: ShaderEffect = {
  kind: "shader",
  id: "ripple-dot",
  name: "Ripple dot",
  description:
    "Just a dot and its waves: a single dot swelling with the bass, thin rings rippling out from it whose brightness at each distance is the spectrum (bass close, treble far), and one brighter ring on each beat.",
  category: "audio",
  tags: ["audio", "music", "minimal", "dots", "ripple", "wave", "ring", "overlay", "visualizer", "beat"],
  transparent: true,
  source: glsl(
    `// Ripple dot: rings travelling out from a dot; their brightness at radius r is the spectrum at r / reach.
uniform float uDot;          // @control min=0.002 max=0.05 default=0.012 label="Dot size"
uniform float uSpacing;      // @control min=0.01 max=0.1 default=0.035 label="Wave spacing"
uniform float uSpeed;        // @control min=0 max=2 default=0.5 label="Wave speed"
uniform float uReach;        // @control min=0.1 max=0.8 default=0.42 label="Reach"
uniform float uLine;         // @control min=0.5 max=4 default=1.2 label="Line width (px)"
uniform float uFlash;        // @control min=0 max=2 default=1 label="Beat ring"
uniform vec3 uColor;         // @control color default=#F4F1EA label="Colour"
${DEMO}`,
    SOUND,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 s = sound();
  float b = beat();
  float hit = b >= 0.0 ? exp(-b * 3.0) : 0.0;
  float r = length(p);
  // The dot, swelling with the bass.
  float size = uDot * (1.0 + 0.6 * s.y + 0.3 * hit);
  float light = smoothstep(size + px, size - px, r) + 0.15 * exp(-max(r - size, 0.0) / (size * 2.0));
  // The waves: thin rings moving out, each as bright as the spectrum where it is now, fading towards the reach.
  float x = r / uReach;
  if (x < 1.0) {
    float phase = r / uSpacing - iTime * uSpeed * 2.0;
    float away = abs(fract(phase) - 0.5) * uSpacing / px;
    float ring = exp(-pow(away / uLine, 2.0));
    light += ring * (0.06 + 0.9 * spectrum(x)) * smoothstep(1.0, 0.6, x) * smoothstep(size, size + 0.01, r);
  }
  // The beat: one brighter ring running out past the others.
  float br = max(b, 0.0) * uReach * 1.2;
  light += uFlash * hit * exp(-pow((r - br) / (uLine * px * 1.5), 2.0)) * 1.2;
  fragColor = glow(uColor * light);
}`,
  ),
  presets: [
    { name: "Sonar", values: { uColor: [0.4, 1, 0.75], uSpacing: 0.06, uSpeed: 0.8 } },
    { name: "Fine", values: { uSpacing: 0.018, uLine: 0.8, uDot: 0.006 } },
    { name: "Ink", values: { uColor: [0.08, 0.08, 0.1] } },
  ],
};

/** The audio category: shaders that react to sound. */
export const audioShaders: readonly ShaderEffect[] = [
  spectrumBars,
  circularSpectrum,
  waveformLine,
  bassPulse,
  audioParticles,
  audioPlasma,
  vinyl,
  blackHoleSpectrum,
  cymatics,
  liquidChrome,
  auroraCurtain,
  neonSkyline,
  fractalPulse,
  ferrofluidSpikes,
  saturnRings,
  solarProminence,
  plasmaGlobe,
  pulsar,
  nebulaPillars,
  blackHoleSilhouette,
  arcaneSigil,
  spellTrace,
  rippleDot,
];
