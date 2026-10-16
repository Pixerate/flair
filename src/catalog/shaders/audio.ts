import { glsl, HASH, NOISE, PALETTE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
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
  tags: ["audio", "music", "equalizer", "spectrum", "bars", "visualizer", "beat"],
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
  tags: ["audio", "music", "spectrum", "radial", "ring", "visualizer", "album art"],
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
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
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
    { name: "Overlay", values: { uBackgroundAlpha: 0, uShowImage: false, uCenter: [0, 0, 0], uBars: 140, uLength: 0.3 } },
    { name: "Dense", values: { uBars: 180, uLength: 0.32, uRadius: 0.18, uColorA: [0.3, 1, 0.7], uColorB: [0.2, 0.5, 1] } },
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
  tags: ["audio", "music", "bass", "pulse", "logo", "beat", "glow"],
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
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
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
    { name: "Overlay", values: { uBackgroundAlpha: 0, uSplit: 0.02 } },
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
  tags: ["audio", "music", "vinyl", "record", "turntable", "retro", "album art"],
  source: glsl(
    `// Vinyl: a spinning record; each groove's sheen follows the spectrum at its radius, the label is a picture.
uniform sampler2D uLabel;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Label picture"
uniform float uRpm;          // @control min=0 max=78 default=33.3 label="Speed (rpm)"
uniform vec3 uRecord;        // @control color default=#101014 label="Record"
uniform vec3 uSheen;         // @control color default=#C4B5FD label="Sheen"
uniform float uShimmer;      // @control min=0 max=2 default=1 label="Shimmer"
uniform vec3 uBackground;    // @control color default=#2A211C label="Platter"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Platter opacity"
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
  ],
};

/** The audio category: shaders that react to sound. */
export const audioShaders: readonly ShaderEffect[] = [spectrumBars, circularSpectrum, waveformLine, bassPulse, audioParticles, audioPlasma, vinyl];
