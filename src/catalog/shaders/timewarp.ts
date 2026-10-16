import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Shaders keep no previous frames, so these re-derive the past: the picture
 * moves on a known path, and an echo, a lagging channel or a frozen moment
 * is the same picture sampled where the path had it at an earlier time.
 */

/** `coverOf(tex)`: the share of a cover-fitted image visible across and up (the test card fits the frame). */
const COVER = `
vec2 coverOf(sampler2D tex) {
  vec2 size = vec2(textureSize(tex, 0));
  float frameAspect = iResolution.x / iResolution.y;
  float imageAspect = size.x > 1.0 ? size.x / size.y : frameAspect;
  return frameAspect > imageAspect ? vec2(1.0, imageAspect / frameAspect) : vec2(frameAspect / imageAspect, 1.0);
}`.trim();

/**
 * `swayUv(tex, uv, t, amount)`: where screen point `uv` sees the cover-fitted
 * image at time `t` while it sways, drifts and breathes (strength `amount`).
 * The motion repeats every 8 s, so effects built only on it loop in 8 s
 * (needs {@link COVER}).
 */
const SWAY = `
vec2 swayUv(sampler2D tex, vec2 uv, float t, float amount) {
  vec2 cover = coverOf(tex);
  float aspect = iResolution.x / iResolution.y;
  float w = 0.785398;
  float zoom = 1.3 + 0.18 * amount * sin(w * t + 0.7);
  float angle = 0.07 * amount * sin(2.0 * w * t + 0.4);
  vec2 pan = amount * vec2(0.1 * sin(w * t) + 0.04 * sin(3.0 * w * t + 1.3), 0.07 * sin(2.0 * w * t + 2.1));
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float c = cos(angle);
  float s = sin(angle);
  p = mat2(c, s, -s, c) * p / vec2(aspect, 1.0);
  return 0.5 + (p / zoom + pan) * cover;
}`.trim();

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

export const timeEcho: ShaderEffect = {
  kind: "shader",
  id: "time-echo",
  name: "Time echo",
  description: "A swaying picture trailed by fading, tinted ghost echoes of where it just was.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "echo", "trail", "ghost"],
  loop: 8,
  source: glsl(
    `// Time echo: the picture now, blended with copies of where its motion had it a moment ago.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uEchoes;        // @control min=1 max=8 default=5 label="Echoes"
uniform float uSpacing;     // @control min=0.02 max=0.6 default=0.18 label="Spacing (s)"
uniform float uDecay;       // @control min=0.1 max=0.95 default=0.65 label="Decay"
uniform float uMotion;      // @control min=0 max=2 default=1.2 label="Motion"
uniform vec3 uTint;         // @control color default=#38BDF8 label="Echo tint"
uniform float uTintAmount;  // @control min=0 max=1 default=0.5 label="Tint strength"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COVER,
    SWAY,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // Summed premultiplied, so clear parts of the picture do not darken the echoes.
  vec4 now = pictureRGBA(uImage, swayUv(uImage, uv, iTime, uMotion));
  vec4 sum = vec4(now.rgb * now.a, now.a);
  float total = 1.0;
  float weight = 1.0;
  for (int k = 1; k <= 8; k++) {
    if (k > uEchoes) break;
    weight *= uDecay;
    float age = float(k) / float(uEchoes);
    vec4 echo = pictureRGBA(uImage, swayUv(uImage, uv, iTime - float(k) * uSpacing, uMotion));
    // Older echoes take on more of the tint.
    echo.rgb = mix(echo.rgb, uTint * dot(echo.rgb, ${LUMA}) * 1.8, uTintAmount * age);
    sum += vec4(echo.rgb * echo.a, echo.a) * weight;
    total += weight;
  }
  fragColor = vec4(sum.rgb / max(sum.a, 1e-4), sum.a / total);
}`,
  ),
  presets: [
    { name: "Trails", values: { uEchoes: 8, uSpacing: 0.06, uDecay: 0.85 } },
    { name: "Strobe", values: { uEchoes: 3, uSpacing: 0.45, uDecay: 0.55, uTintAmount: 0 } },
    { name: "Neon ghosts", values: { uTint: [1, 0.2, 0.8], uTintAmount: 1, uMotion: 1.6 } },
  ],
};

export const chronoSplit: ShaderEffect = {
  kind: "shader",
  id: "chrono-split",
  name: "Chrono split",
  description: "Red, green and blue each lagging a little further behind in time, so movement leaves colour fringes.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "rgb", "chromatic", "echo"],
  loop: 8,
  source: glsl(
    `// Chrono split: each colour channel shows the moving picture at a different moment.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uLag;        // @control min=0 max=0.6 default=0.15 label="Lag per channel (s)"
uniform float uMotion;     // @control min=0 max=2 default=1.4 label="Motion"
uniform int uOrder;        // @control min=0 max=1 default=0 label="Leading channel (0 red, 1 blue)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COVER,
    SWAY,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float lagR = uOrder == 0 ? 0.0 : 2.0 * uLag;
  float lagB = uOrder == 0 ? 2.0 * uLag : 0.0;
  vec4 r = pictureRGBA(uImage, swayUv(uImage, uv, iTime - lagR, uMotion));
  vec4 g = pictureRGBA(uImage, swayUv(uImage, uv, iTime - uLag, uMotion));
  vec4 b = pictureRGBA(uImage, swayUv(uImage, uv, iTime - lagB, uMotion));
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}`,
  ),
  presets: [
    { name: "Subtle", values: { uLag: 0.05, uMotion: 1 } },
    { name: "Prism", values: { uLag: 0.35, uMotion: 2 } },
  ],
};

export const timeSlice: ShaderEffect = {
  kind: "shader",
  id: "time-slice",
  name: "Time slice",
  description: "Bands of a moving picture each showing a different moment, staggered like a time-displacement.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "slices", "stagger", "displacement"],
  loop: 8,
  source: glsl(
    `// Time slice: every band shows the picture's motion delayed by a different amount.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uBands;        // @control min=2 max=48 default=10 label="Bands"
uniform float uDelay;      // @control min=0 max=0.6 default=0.12 label="Delay per band (s)"
uniform int uDirection;    // @control min=0 max=1 default=0 label="Bands (0 horizontal, 1 vertical)"
uniform int uPattern;      // @control min=0 max=2 default=0 label="Order (0 stepped, 1 from centre, 2 random)"
uniform float uMotion;     // @control min=0 max=2 default=1.5 label="Motion"
uniform float uSeams;      // @control min=0 max=1 default=0.4 label="Seams"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    COVER,
    SWAY,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float across = uDirection == 0 ? uv.y : uv.x;
  float bands = float(uBands);
  float band = floor(across * bands);
  float order = band;
  if (uPattern == 1) order = abs(band - (bands - 1.0) * 0.5);
  if (uPattern == 2) order = floor(hash12(vec2(band, 4.7)) * bands);
  vec4 pic = pictureRGBA(uImage, swayUv(uImage, uv, iTime - order * uDelay, uMotion));
  vec3 col = pic.rgb;
  // A thin dark seam between bands, a pixel or two wide.
  float px = (uDirection == 0 ? iResolution.y : iResolution.x) / bands;
  float f = fract(across * bands);
  float edge = min(f, 1.0 - f) * px;
  col *= 1.0 - uSeams * (1.0 - smoothstep(0.0, 1.5, edge));
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Venetian", values: { uBands: 24, uDelay: 0.05, uPattern: 1 } },
    { name: "Shuffle", values: { uBands: 14, uDelay: 0.2, uPattern: 2, uDirection: 1 } },
  ],
};

/** `digit7(p, d)`: distance to digit `d` drawn as a seven-segment glyph in a 1 × 2 cell (bottom-left origin). */
const DIGIT7 = `
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float digit7(vec2 p, int d) {
  const int MASKS[10] = int[10](63, 6, 91, 79, 102, 109, 125, 7, 127, 111);
  int m = MASKS[clamp(d, 0, 9)];
  float dist = 1e5;
  if ((m & 1) != 0) dist = min(dist, segDist(p, vec2(0.0, 2.0), vec2(1.0, 2.0)));
  if ((m & 2) != 0) dist = min(dist, segDist(p, vec2(1.0, 2.0), vec2(1.0, 1.0)));
  if ((m & 4) != 0) dist = min(dist, segDist(p, vec2(1.0, 1.0), vec2(1.0, 0.0)));
  if ((m & 8) != 0) dist = min(dist, segDist(p, vec2(0.0, 0.0), vec2(1.0, 0.0)));
  if ((m & 16) != 0) dist = min(dist, segDist(p, vec2(0.0, 0.0), vec2(0.0, 1.0)));
  if ((m & 32) != 0) dist = min(dist, segDist(p, vec2(0.0, 1.0), vec2(0.0, 2.0)));
  if ((m & 64) != 0) dist = min(dist, segDist(p, vec2(0.0, 1.0), vec2(1.0, 1.0)));
  return dist;
}`.trim();

export const rewind: ShaderEffect = {
  kind: "shader",
  id: "rewind",
  name: "VHS rewind",
  description: "A tape playing, then rewinding fast with tracking noise, jittering lines, colour bleed and a ◀◀ display.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "vhs", "retro", "rewind", "tape"],
  loop: 6,
  source: glsl(
    `// VHS rewind: 4 s of play, then 2 s rewinding at double speed back to the start.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uNoise;      // @control min=0 max=1 default=0.6 label="Tracking noise"
uniform float uJitter;     // @control min=0 max=1 default=0.5 label="Line jitter"
uniform float uBleed;      // @control min=0 max=0.03 default=0.008 label="Chroma bleed"
uniform bool uOsd;         // @control default=true label="On-screen display"
uniform vec3 uOsdColor;    // @control color default=#F8FAFC label="Display colour"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    COVER,
    SWAY,
    DIGIT7,
    `// Ink of the timecode "M:SS:FF" at q (units of half a digit's height).
float timecode(vec2 q, float secs) {
  if (q.y < -0.3 || q.y > 2.3 || q.x < -0.3) return 0.0;
  int slot = int(floor(q.x / 1.6));
  vec2 c = vec2(q.x - float(slot) * 1.6, q.y);
  int s = int(floor(mod(secs, 60.0)));
  int f = int(floor(fract(secs) * 30.0));
  float dist = 1e5;
  if (slot == 0) dist = digit7(c, int(floor(secs / 60.0)));
  else if (slot == 1 || slot == 4) dist = min(length(c - vec2(0.5, 0.6)), length(c - vec2(0.5, 1.4)));
  else if (slot == 2) dist = digit7(c, s / 10);
  else if (slot == 3) dist = digit7(c, s - (s / 10) * 10);
  else if (slot == 5) dist = digit7(c, f / 10);
  else if (slot == 6) dist = digit7(c, f - (f / 10) * 10);
  return smoothstep(0.2, 0.12, dist);
}

// Ink of a right-pointing triangle 1 wide, 1 high, its back edge at q.x = 0.
float playIcon(vec2 q) {
  float inside = min(q.x, 0.5 * (1.0 - q.x) - abs(q.y - 0.5));
  return smoothstep(0.0, 0.04, inside);
}

// The display's ink at fragCoord: a play arrow for a moment after play starts, rewind arrows while rewinding, and the timecode.
float osd(vec2 fragCoord, float phase, float tau) {
  float unit = iResolution.y * 0.045;
  vec2 q = (fragCoord - vec2(iResolution.x - unit * 3.4, iResolution.y - unit * 2.4)) / unit;
  float ink = 0.0;
  if (phase >= 4.0) ink = max(playIcon(vec2(1.0 - q.x, q.y)), playIcon(vec2(2.0 - q.x, q.y)));
  else if (phase < 1.5) ink = playIcon(q);
  vec2 t = (fragCoord - vec2(iResolution.x - unit * 6.5, unit * 1.0)) / (unit * 0.5);
  return max(ink, timecode(t, tau));
}`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float phase = mod(iTime, 6.0);
  // Tape time: forwards for 4 s, then back to the start in 2.
  float tau = phase < 4.0 ? phase : 4.0 - (phase - 4.0) * 2.0;
  float rw = smoothstep(3.9, 4.1, phase) * (1.0 - smoothstep(5.85, 6.0, phase));
  float shake = 0.15 + rw;
  float frame = mod(floor(iTime * 30.0), 180.0);
  // Line jitter: each scanline nudged sideways, stronger near the bottom head-switch band.
  float line = floor(uv.y * 240.0);
  float jitter = (hash12(vec2(line, frame)) - 0.5) * 0.012 * uJitter * shake;
  jitter += (1.0 - smoothstep(0.0, 0.05, uv.y)) * 0.03 * uJitter * (hash12(vec2(frame, 2.0)) - 0.2);
  // Tracking bars rolling down the picture while rewinding.
  float roll = fract(uv.y * 1.7 + iTime * 1.5);
  float bar = smoothstep(0.0, 0.02, roll) * smoothstep(0.1, 0.04, roll) * uNoise * rw;
  vec2 st = uv + vec2(jitter + bar * 0.06, 0.0);
  // While rewinding the picture jumps up and down a touch.
  st.y += rw * 0.01 * (hash12(vec2(frame, 5.0)) - 0.5);
  float bleed = uBleed * (1.0 + 2.0 * rw);
  float t = tau * 1.5;
  vec4 r = pictureRGBA(uImage, swayUv(uImage, st + vec2(bleed, 0.0), t, 1.4));
  vec4 g = pictureRGBA(uImage, swayUv(uImage, st, t, 1.4));
  vec4 b = pictureRGBA(uImage, swayUv(uImage, st - vec2(bleed, 0.0), t, 1.4));
  vec3 col = vec3(r.r, g.g, b.b);
  float alpha = max(max(r.a, g.a), b.a);
  // Static in the bars, a few white dropouts, and a washed-out tape look.
  float grain = hash12(fragCoord + frame * 17.0);
  col = mix(col, vec3(grain), bar * 0.75);
  col += step(0.9985 - 0.002 * rw * uNoise, hash12(vec2(floor(fragCoord.x / 6.0), line + frame * 31.0))) * uNoise;
  float grey = dot(col, ${LUMA});
  col = mix(vec3(grey), col, 0.85 - 0.25 * rw) * vec3(1.03, 1.0, 0.95);
  col = mix(col, vec3(0.08), (1.0 - smoothstep(0.0, 0.02, uv.y)) * rw);
  col *= 0.94 + 0.06 * sin(fragCoord.y * 3.14159);
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.35 * dot(v, v);
  if (uOsd) {
    float shadow = osd(fragCoord + vec2(-2.0, 2.0), phase, tau);
    float text = osd(fragCoord, phase, tau);
    col = mix(col, vec3(0.0), shadow * 0.5);
    col = mix(col, uOsdColor, text);
    alpha = max(alpha, max(shadow * 0.5, text));
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Worn tape", values: { uNoise: 1, uJitter: 0.9, uBleed: 0.018 } },
    { name: "Clean deck", values: { uNoise: 0.25, uJitter: 0.15, uBleed: 0.003 } },
    { name: "Green OSD", values: { uOsdColor: [0.4, 1, 0.5] } },
  ],
};

export const bulletTime: ShaderEffect = {
  kind: "shader",
  id: "bullet-time",
  name: "Bullet time",
  description: "A shockwave sweeping out from the centre or a click, freezing the picture grey and zoomed behind it while the rest moves on.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "freeze", "shockwave", "click", "cinematic", "interactive"],
  loop: 8,
  source: glsl(
    `// Bullet time: every 4 s (or on a click) a wave freezes the picture behind it, then lets go.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uSpeed;       // @control min=0.2 max=3 default=1.2 label="Wave speed"
uniform float uHold;        // @control min=0.5 max=3 default=2.2 label="Freeze (s)"
uniform float uDesaturate;  // @control min=0 max=1 default=0.85 label="Desaturate"
uniform float uZoom;        // @control min=0 max=0.25 default=0.08 label="Zoom"
uniform vec3 uRing;         // @control color default=#A5F3FC label="Shockwave"
uniform float uMotion;      // @control min=0 max=2 default=1.4 label="Motion"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COVER,
    SWAY,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // The demo freezes every 4 s from the centre; a click freezes from where it landed.
  vec2 centre = 0.5 * iResolution.xy;
  float since = mod(iTime, 4.0);
  if (iClicks[0].w > 0.5) {
    centre = iClicks[0].xy;
    since = iTime - iClicks[0].z;
  }
  float start = iTime - since;
  float radius = since * uSpeed * iResolution.y;
  vec2 d = fragCoord - centre;
  float dist = length(d);
  float release = smoothstep(uHold, uHold + 0.6, since);
  float inside = smoothstep(radius, radius - 0.02 * iResolution.y, dist) * (1.0 - release);
  // The wavefront bends the picture outwards as it passes.
  float front = (dist - radius) / (0.045 * iResolution.y);
  float ring = exp(-front * front) * (1.0 - release);
  vec2 warp = d / max(dist, 1.0) * ring * 0.018;
  vec4 live = pictureRGBA(uImage, swayUv(uImage, uv - warp, iTime, uMotion));
  // Behind the wave: the moment the freeze began, zooming in towards the centre the longer it is held.
  vec2 c = centre / iResolution.xy;
  float zoom = 1.0 + uZoom * smoothstep(0.0, 1.0, since / max(uHold, 0.1));
  vec4 frozen = pictureRGBA(uImage, swayUv(uImage, c + (uv - warp - c) / zoom, start, uMotion));
  float grey = dot(frozen.rgb, ${LUMA});
  frozen.rgb = mix(frozen.rgb, vec3(grey) * vec3(0.9, 0.98, 1.1), uDesaturate);
  frozen.rgb *= 1.0 + 0.025 * sin(dist / iResolution.y * 60.0 - since * 4.0) * inside;
  vec4 pic = mix(live, frozen, inside);
  // The ring is light added over the picture, so it also shows where the picture is clear.
  float alpha = max(pic.a, clamp(ring * 0.7, 0.0, 1.0));
  fragColor = vec4((pic.rgb * pic.a + uRing * ring * 0.7) / max(alpha, 1e-4), alpha);
}`,
  ),
  presets: [
    { name: "Slow wave", values: { uSpeed: 0.5, uHold: 2.8 } },
    { name: "Snap", values: { uSpeed: 2.5, uHold: 1.2, uZoom: 0.15, uRing: [1, 1, 1] } },
  ],
};

export const timeTunnel: ShaderEffect = {
  kind: "shader",
  id: "time-tunnel",
  name: "Time tunnel",
  description: "A picture wrapped round a spiralling tunnel rushing at the viewer, with light streaks and a blazing core.",
  category: "timewarp",
  video: "filter",
  tags: ["time", "image", "tunnel", "vortex", "sci-fi", "warp"],
  loop: 8,
  source: glsl(
    `// Time tunnel: the picture mapped onto a twisting tube by angle and depth.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uTwist;      // @control min=0 max=4 default=1.2 label="Twist"
uniform float uSpeed;      // @control min=0 max=2 default=0.5 label="Speed"
uniform vec3 uColor;       // @control color default=#3B82F6 label="Tunnel colour"
uniform float uTint;       // @control min=0 max=1 default=0.55 label="Colour strength"
uniform vec3 uCore;        // @control color default=#F0F9FF label="Core"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // The far end wanders a little.
  p += 0.05 * vec2(sin(iTime * 0.785398), cos(iTime * 1.570796));
  float r = max(length(p), 1e-3);
  float a = atan(p.y, p.x);
  float z = 0.3 / r;
  // Round the tube (seamless: twice round the mirrored image), twisting with depth; along it, rushing closer.
  float u = a / 6.28318 + uTwist * 0.15 * z + iTime * 0.125;
  float v = z * 0.5 + iTime * uSpeed;
  vec4 pic = pictureRGBA(uImage, vec2(u * 2.0, v));
  vec3 img = pic.rgb;
  float l = dot(img, vec3(0.2126, 0.7152, 0.0722));
  vec3 col = mix(img, uColor * l * 2.2, uTint);
  // Rings where the tube's sections meet.
  col *= 0.85 + 0.15 * smoothstep(0.0, 0.08, abs(fract(v * 2.0) - 0.5));
  // Light streaks flying past in some angular lanes.
  float lane = floor(fract(u) * 64.0);
  float h = hash12(vec2(lane, 3.0));
  float dash = smoothstep(0.85, 1.0, fract(z * 0.25 + iTime * uSpeed * 2.0 + h * 7.0));
  // Thin in screen space at any distance from the core.
  float across = abs(fract(u * 64.0) - 0.5) / 64.0 * 6.28318 * r;
  float thin = 1.0 - smoothstep(0.0015, 0.005, across);
  float streak = dash * step(0.75, h) * thin * smoothstep(0.05, 0.25, r);
  col += mix(uCore, uColor, 0.4) * streak;
  // Depth haze into the glowing core; the near rim darkens.
  float haze = 1.0 - smoothstep(0.0, 0.2, r);
  col = mix(col, uCore, haze);
  col += uCore * 0.002 / (r * r + 0.01);
  col *= 1.0 - 0.45 * smoothstep(0.5, 0.95, r);
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(max(pic.a, max(haze, streak)), 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Vortex", values: { uTwist: 3, uSpeed: 1, uColor: [0.55, 0.3, 1] } },
    { name: "Ember", values: { uColor: [1, 0.45, 0.1], uCore: [1, 0.95, 0.8], uTint: 0.75 } },
    { name: "True colour", values: { uTint: 0, uTwist: 0.6 } },
  ],
};

export const speedRamp: ShaderEffect = {
  kind: "shader",
  id: "speed-ramp",
  name: "Speed ramp",
  description: "A panning picture lurching from a crawl to a blur and back, motion-blurred in proportion to its speed.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "speed", "motion blur", "cinematic"],
  loop: 4,
  source: glsl(
    `// Speed ramp: a pan whose speed swings from almost still to nearly double, with matching blur.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uRamp;       // @control min=0 max=0.95 default=0.9 label="Ramp strength"
uniform float uBlur;       // @control min=0 max=0.25 default=0.1 label="Motion blur (shutter s)"
uniform float uPan;        // @control min=0.1 max=1 default=0.5 label="Pan speed"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 cover = coverOf(uImage);
  // Speed 1 + ramp * cos(w t) over a 4 s cycle; tau is how far the pan has got.
  float w = 1.570796;
  float speed = 1.0 + uRamp * cos(w * iTime);
  float tau = iTime + uRamp * sin(w * iTime) / w;
  // A little push in as it speeds up.
  float zoom = 1.15 + 0.06 * (speed - 1.0);
  vec2 base = 0.5 + (uv - 0.5) * cover / zoom + vec2(uPan * tau, 0.02 * sin(w * 2.0 * tau));
  // Blur along the pan, as long as the picture moves while the shutter is open (16 taps at most).
  float len = min(uPan * speed * uBlur, 0.25);
  // Summed premultiplied, so clear parts of the picture do not darken the blur.
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float k = float(i) / 15.0 - 0.5;
    vec4 c = pictureRGBA(uImage, base - vec2(len * k, 0.0));
    sum += vec4(c.rgb * c.a, c.a);
  }
  vec3 col = sum.rgb / max(sum.a, 1e-4);
  vec2 v = uv - 0.5;
  col *= 1.0 - (0.2 + 0.25 * max(speed - 1.0, 0.0)) * dot(v, v) * 2.0;
  fragColor = vec4(col, sum.a / 16.0);
}`,
  ),
  presets: [
    { name: "Gentle", values: { uRamp: 0.5, uBlur: 0.05 } },
    { name: "Whip", values: { uRamp: 0.95, uBlur: 0.25, uPan: 1 } },
  ],
};

export const stutterFreeze: ShaderEffect = {
  kind: "shader",
  id: "stutter-freeze",
  name: "Stutter freeze",
  description: "A moving picture that catches in irregular bursts, holding or stuttering frames with a flash on each freeze.",
  category: "timewarp",
  video: "stills",
  tags: ["time", "image", "freeze", "stutter", "glitch"],
  source: glsl(
    `// Stutter freeze: some moments end in a hold (or a skipping stutter) before cutting back to live.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uRate;       // @control min=0.2 max=4 default=1 label="Bursts per second"
uniform float uHold;       // @control min=0 max=1 default=0.55 label="Hold length"
uniform float uFlash;      // @control min=0 max=1 default=0.6 label="Flash"
uniform float uMotion;     // @control min=0 max=2 default=1.6 label="Motion"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    COVER,
    SWAY,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float slot = floor(iTime * uRate);
  float f = fract(iTime * uRate);
  // Most moments end in a hold of random length.
  float len = uHold * mix(0.35, 1.0, hash12(vec2(slot, 3.3)));
  float startF = 1.0 - len;
  bool frozen = hash12(vec2(slot, 7.1)) > 0.25 && len > 0.001 && f >= startF;
  float freezeAt = (slot + startF) / uRate;
  float since = iTime - freezeAt;
  float t = iTime;
  float kick = 0.0;
  if (frozen) {
    // Some holds stutter, skipping back and forth between nearby frames.
    float stutter = step(0.55, hash12(vec2(slot, 9.7)));
    float k = floor(since * 12.0);
    t = freezeAt - stutter * mod(k, 3.0) * 0.06;
    kick = exp(-since * 10.0);
  }
  vec2 st = 0.5 + (uv - 0.5) / (1.0 + 0.04 * kick);
  vec4 pic = pictureRGBA(uImage, swayUv(uImage, st, t * 2.0, uMotion));
  vec3 col = pic.rgb;
  if (frozen) {
    col = mix(col, vec3(dot(col, ${LUMA})), 0.25);
    col = (col - 0.5) * 1.1 + 0.5;
  }
  col = mix(col, vec3(1.0), kick * uFlash * 0.85);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, kick * uFlash * 0.85));
}`,
  ),
  presets: [
    { name: "Nervous", values: { uRate: 3, uHold: 0.4 } },
    { name: "Long holds", values: { uRate: 0.5, uHold: 0.8, uFlash: 0.3 } },
  ],
};

/** Time warps: echoes, rewinds, freezes and tunnels. */
export const timewarpShaders: ShaderEffect[] = [timeEcho, chronoSplit, timeSlice, rewind, bulletTime, timeTunnel, speedRamp, stutterFreeze];
