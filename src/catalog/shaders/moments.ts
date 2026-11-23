import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Effects for the moments in an AI product's UI: a generated picture
 * arriving, a job brewing over its card, an agent at work on a region, an
 * element that just changed, a task done, a drop zone. They are sized for
 * cards and list items rather than full frames, draw on clear so they lay
 * over the page (`playMoment`, or a canvas over the element), and the
 * one-shots run on `uProgress` (0 → 1) with an `uAnimate` loop for previews.
 */

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` as the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/** `boxSd(p, halfSize, radius)`: signed distance to a rounded box centred on 0 (negative inside). */
const BOX = `
float boxSd(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`.trim();

/** `oneShot(period)`: 0 → 1 over most of a loop, holding at 1 before it starts again: a one-shot's preview. */
const ONE_SHOT = `
float oneShot(float period) {
  return smoothstep(0.0, 0.78, fract(iTime / period));
}`.trim();

export const denoiseReveal: ShaderEffect = {
  kind: "shader",
  id: "denoise-reveal",
  name: "Denoise reveal",
  description: "A picture resolving out of noise the way a diffusion model makes it: coarse blotches of colour settle into shapes, then detail, as the grain clears.",
  category: "transition",
  video: "stills",
  tags: ["ai", "generated", "reveal", "noise", "diffusion", "image", "loader"],
  loop: 4,
  rest: 3.4,
  source: glsl(
    `// Denoise reveal: a picture resolving out of diffusion noise, coarse to fine, as uProgress goes 0 → 1.
uniform sampler2D uImage;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uNoise;          // @control min=0 max=1 default=0.6 label="Noise that lingers"
uniform float uGrain;          // @control min=1 max=16 default=3 label="Grain size (px)"
uniform float uBlocks;         // @control min=4 max=96 default=40 label="Coarsest blotch (px)"
uniform vec3 uTint;            // @control color default=#8B93FF label="Noise tint"
uniform float uTintAmount;     // @control min=0 max=1 default=0.3 label="Noise tint amount"
uniform bool uAnimate;         // @control default=true label="Animate"
uniform float uProgress;       // @control min=0 max=1 default=1 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    ONE_SHOT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = uAnimate ? oneShot(4.0) : clamp(uProgress, 0.0, 1.0);
  float k = 1.0 - t;
  // Coarse to fine: the picture is first seen as big blotches, which shrink to pixels.
  float block = max(1.0, uBlocks * k * k);
  vec2 cell = (floor(fragCoord / block) + 0.5) * block / iResolution.xy;
  vec4 coarse = pictureRGBA(uImage, cell);
  vec4 fine = pictureRGBA(uImage, uv);
  vec4 pic = mix(coarse, fine, smoothstep(0.25, 0.95, t));
  // Grain that re-rolls a dozen times a second, roughly Gaussian (two hashes averaged).
  float frame = floor(iTime * 12.0);
  vec2 g = floor(fragCoord / uGrain);
  vec3 n1 = vec3(hash12(g + frame * 1.7), hash12(g + vec2(31.4, frame)), hash12(g + vec2(frame, 77.1)));
  vec3 n2 = vec3(hash12(g * 1.3 + frame), hash12(g * 1.7 + vec2(5.1, frame)), hash12(g * 0.7 + vec2(frame, 9.3)));
  vec3 n = 0.5 * (n1 + n2);
  vec3 noise = mix(n, uTint * (0.4 + 1.2 * n.x), uTintAmount);
  float amount = pow(k, mix(2.6, 0.7, uNoise));
  vec3 col = mix(pic.rgb, noise, amount);
  // Over a clear backdrop the noise stays on the picture, so a cut-out keeps its clear parts.
  fragColor = vec4(col, mix(pic.a, 1.0, amount * uBackdropAlpha));
}`,
  ),
  presets: [
    { name: "Clean and quick", values: { uNoise: 0.2, uTintAmount: 0 } },
    { name: "Chunky", values: { uBlocks: 80, uGrain: 6 } },
    { name: "Violet static", values: { uTint: [0.55, 0.36, 0.96], uTintAmount: 0.6 } },
    { name: "Half resolved", values: { uAnimate: false, uProgress: 0.5 } },
  ],
};

export const generatingField: ShaderEffect = {
  kind: "shader",
  id: "generating-field",
  name: "Generating field",
  description: "A soft field brewing over a card while a job runs, its motion set by what is being made, with a glowing front that sweeps across as the job gets further along.",
  category: "loader",
  tags: ["loader", "ai", "generating", "progress", "ambient", "overlay", "ui"],
  transparent: true,
  rest: 2,
  source: glsl(
    `// Generating field: an ambient field over a card while a job runs; a front marks how far along it is.
uniform vec3 uColorA;          // @control color default=#818CF8 label="Colour A"
uniform vec3 uColorB;          // @control color default=#C084FC label="Colour B"
uniform vec3 uColorC;          // @control color default=#22D3EE label="Colour C"
uniform int uMotion;           // @control min=0 max=4 default=0 label="Motion (0 image, 1 video, 2 audio, 3 text, 4 vector)"
uniform float uIntensity;      // @control min=0 max=1 default=0.55 label="Intensity"
uniform float uSpeed;          // @control min=0 max=3 default=1 label="Speed"
uniform float uRadius;         // @control min=0 max=64 default=16 label="Corner radius (px)"
uniform bool uAnimate;         // @control default=true label="Animate"
uniform float uProgress;       // @control min=0 max=1 default=0.45 label="Progress (when still)"`,
    HASH,
    NOISE,
    FBM,
    OVER,
    BOX,
    `vec3 palette3(float x) {
  x = fract(x);
  return x < 0.333 ? mix(uColorA, uColorB, x * 3.0) : x < 0.667 ? mix(uColorB, uColorC, x * 3.0 - 1.0) : mix(uColorC, uColorA, x * 3.0 - 2.0);
}

// The field's density (x) and where along the palette it is (y), for each kind of thing being made.
vec2 field(vec2 p, vec2 uv, float t) {
  if (uMotion == 1) {
    // Video: frames scanning down, with a flicker of strips.
    float band = 0.5 + 0.5 * sin(uv.y * 18.0 - t * 4.0);
    float strip = step(0.7, hash12(vec2(floor(uv.y * 24.0), floor(t * 6.0))));
    return vec2(0.25 + 0.55 * band * band + 0.3 * strip, uv.x * 0.5 + t * 0.05);
  }
  if (uMotion == 2) {
    // Audio: waveforms rolling across.
    float w = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y = 0.5 + 0.18 * sin(uv.x * (6.0 + 3.0 * fi) - t * (2.0 + fi)) * (0.6 + 0.4 * sin(t * 0.7 + fi * 2.0));
      w += exp(-abs(uv.y - y) * 40.0);
    }
    return vec2(0.2 + 0.8 * clamp(w, 0.0, 1.0), uv.x + 0.1 * t);
  }
  if (uMotion == 3) {
    // Text: lines of copy shimmering into place.
    float row = floor(uv.y * 7.0);
    float inRow = smoothstep(0.18, 0.28, fract(uv.y * 7.0)) * smoothstep(0.82, 0.72, fract(uv.y * 7.0));
    float len = 0.55 + 0.4 * hash12(vec2(row, 2.0));
    float shimmer = 0.5 + 0.5 * sin((uv.x - row * 0.07) * 9.0 - t * 3.0);
    return vec2(inRow * step(uv.x, len) * (0.35 + 0.65 * shimmer), row * 0.13 + t * 0.03);
  }
  if (uMotion == 4) {
    // Vector: a grid of points pulsing on and off.
    vec2 g = fract(p * 9.0) - 0.5;
    vec2 id = floor(p * 9.0);
    float pulse = 0.5 + 0.5 * sin(t * 2.0 + hash12(id) * 6.28);
    return vec2(smoothstep(0.16, 0.05, length(g)) * pulse + 0.15 * pulse, hash12(id) + t * 0.05);
  }
  // Image: colour clouds drifting and folding into each other.
  vec2 q = vec2(fbm(p * 2.0 + vec2(0.0, t * 0.2), 4), fbm(p * 2.0 + vec2(5.2, -t * 0.17), 4));
  float f = fbm(p * 2.2 + 1.8 * q + t * 0.05, 4);
  return vec2(smoothstep(0.25, 0.85, f), f + q.x * 0.6);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = fragCoord / iResolution.y;
  float t = iTime * uSpeed;
  // How far along: the job's progress, or (while it cannot tell) a front that keeps sweeping.
  float level = uAnimate ? fract(iTime / 5.0) * 1.15 - 0.05 : clamp(uProgress, 0.0, 1.0);
  vec2 f = field(p, uv, t);
  float done = smoothstep(level + 0.04, level - 0.04, uv.x);
  float front = exp(-abs(uv.x - level) * iResolution.x / 18.0) * step(0.001, level) * step(level, 0.999);
  // Clipped to the card's rounded corners.
  vec2 hs = 0.5 * iResolution.xy;
  float inside = smoothstep(1.0, -1.0, boxSd(fragCoord - hs, hs, uRadius));
  vec4 acc = vec4(0.0);
  acc = over(acc, palette3(f.y), uIntensity * f.x * (0.35 + 0.65 * done) * inside);
  acc = over(acc, mix(palette3(f.y + 0.3), vec3(1.0), 0.4), front * uIntensity * inside);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Image", values: { uMotion: 0, uColorA: [0.51, 0.55, 0.97], uColorB: [0.75, 0.52, 0.99], uColorC: [0.13, 0.83, 0.93] } },
    { name: "Video", values: { uMotion: 1, uColorA: [0.98, 0.45, 0.35], uColorB: [0.98, 0.75, 0.2], uColorC: [0.93, 0.29, 0.6] } },
    { name: "Audio", values: { uMotion: 2, uColorA: [0.2, 0.83, 0.6], uColorB: [0.13, 0.83, 0.93], uColorC: [0.52, 0.8, 0.09] } },
    { name: "Text", values: { uMotion: 3, uColorA: [0.58, 0.64, 0.72], uColorB: [0.39, 0.4, 0.95], uColorC: [0.8, 0.84, 0.88] } },
    { name: "Vector", values: { uMotion: 4, uColorA: [0.93, 0.28, 0.6], uColorB: [0.98, 0.8, 0.08], uColorC: [0.02, 0.71, 0.83] } },
    { name: "Neubrutal", values: { uColorA: [1, 0.16, 0.52], uColorB: [0.98, 0.8, 0.08], uColorC: [0.02, 0.71, 0.83], uIntensity: 0.8, uRadius: 0 } },
  ],
};

export const agentWorkingBorder: ShaderEffect = {
  kind: "shader",
  id: "agent-working-border",
  name: "Agent working border",
  description: "A calm beam of colour gliding round a region's border while an agent works on it, one hue per agent when several work at once.",
  category: "ui",
  tags: ["ai", "agent", "border", "beam", "working", "ui", "overlay", "glow"],
  transparent: true,
  rest: 2,
  source: glsl(
    `// Agent working border: slow beams round a rounded box, one per agent at work.
uniform vec3 uColor1;          // @control color default=#818CF8 label="Agent 1"
uniform vec3 uColor2;          // @control color default=#F472B6 label="Agent 2"
uniform vec3 uColor3;          // @control color default=#34D399 label="Agent 3"
uniform vec3 uColor4;          // @control color default=#FBBF24 label="Agent 4"
uniform int uAgents;           // @control min=1 max=4 default=1 label="Agents"
uniform float uSpeed;          // @control min=0 max=1 default=0.08 label="Laps per second"
uniform float uLength;         // @control min=0.05 max=0.6 default=0.28 label="Beam length"
uniform float uWidth;          // @control min=0.5 max=8 default=1.5 label="Line width (px)"
uniform float uGlow;           // @control min=0 max=1 default=0.5 label="Glow"
uniform float uTrack;          // @control min=0 max=1 default=0.15 label="Border opacity"
uniform float uRadius;         // @control min=0 max=64 default=14 label="Corner radius (px)"
uniform float uInset;          // @control min=0 max=40 default=6 label="Inset (px)"`,
    OVER,
    BOX,
    `vec3 agentColor(int i) {
  return i == 0 ? uColor1 : i == 1 ? uColor2 : i == 2 ? uColor3 : uColor4;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 hs = 0.5 * iResolution.xy;
  vec2 p = fragCoord - hs;
  vec2 b = max(hs - uInset, vec2(1.0));
  float d = boxSd(p, b, min(uRadius, min(b.x, b.y)));
  // Where round the border, 0–1 (angle round the box, stretched to its shape).
  float s = atan(p.y / b.y, p.x / b.x) / 6.28318 + 0.5;
  float line = smoothstep(uWidth, uWidth - 1.0, abs(d));
  float halo = exp(-abs(d) / (6.0 + 10.0 * uGlow)) * uGlow;
  // A faint border all round, in the agents' first colour.
  vec4 acc = over(vec4(0.0), uColor1, uTrack * line);
  int n = clamp(uAgents, 1, 4);
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    float head = fract(iTime * uSpeed + float(i) / float(n));
    // Behind the head, fading along the beam's length.
    float behind = fract(head - s);
    float beam = smoothstep(uLength, 0.0, behind) * smoothstep(0.0, 0.015, behind + 0.004);
    vec3 c = agentColor(i);
    acc = over(acc, c, beam * clamp(line + 0.65 * halo, 0.0, 1.0));
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Three agents", values: { uAgents: 3 } },
    { name: "Single violet", values: { uColor1: [0.66, 0.33, 0.97], uGlow: 0.8 } },
    { name: "Hairline", values: { uWidth: 1, uGlow: 0.15, uTrack: 0.08 } },
    { name: "Neubrutal", values: { uColor1: [1, 0.16, 0.52], uColor2: [0.02, 0.71, 0.83], uColor3: [0.98, 0.8, 0.08], uColor4: [0.75, 0.52, 0.99], uWidth: 4, uGlow: 0, uTrack: 1, uRadius: 0 } },
  ],
};

export const changePulse: ShaderEffect = {
  kind: "shader",
  id: "change-pulse",
  name: "Change pulse",
  description: "A one-shot highlight on an element that just changed: a ring that blooms out from a new one, a sweep across an edited one, a flash that closes in on a removed one.",
  category: "ui",
  tags: ["ui", "highlight", "change", "collaboration", "notification", "overlay", "one-shot"],
  transparent: true,
  loop: 2,
  rest: 1.9,
  source: glsl(
    `// Change pulse: a one-shot highlight round a changed element (uTone 0 created, 1 updated, 2 removed).
uniform int uTone;             // @control min=0 max=2 default=1 label="Tone (0 create, 1 update, 2 remove)"
uniform vec3 uCreate;          // @control color default=#22C55E label="Created"
uniform vec3 uUpdate;          // @control color default=#3B82F6 label="Updated"
uniform vec3 uRemove;          // @control color default=#EF4444 label="Removed"
uniform float uRadius;         // @control min=0 max=64 default=12 label="Corner radius (px)"
uniform float uInset;          // @control min=0 max=64 default=16 label="Element inset (px)"
uniform float uSpread;         // @control min=0 max=64 default=14 label="Ring spread (px)"
uniform float uStrength;       // @control min=0 max=1 default=0.8 label="Strength"
uniform bool uAnimate;         // @control default=true label="Animate"
uniform float uProgress;       // @control min=0 max=1 default=1 label="Progress (when still)"`,
    OVER,
    BOX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = uAnimate ? smoothstep(0.0, 0.85, fract(iTime / 2.0)) : clamp(uProgress, 0.0, 1.0);
  vec2 hs = 0.5 * iResolution.xy;
  vec2 p = fragCoord - hs;
  vec2 b = max(hs - uInset, vec2(1.0));
  float r = min(uRadius, min(b.x, b.y));
  vec3 c = uTone == 0 ? uCreate : uTone == 2 ? uRemove : uUpdate;
  float fade = 1.0 - t;
  vec4 acc = vec4(0.0);
  if (uTone == 2) {
    // Removed: a flash over the element that closes in to nothing.
    float d = boxSd(p, b * (1.0 - 0.25 * t), r);
    float fill = smoothstep(1.0, -1.0, d) * 0.35 * fade * fade;
    float ring = exp(-abs(d) / 2.0) * fade;
    acc = over(acc, c, fill * uStrength);
    acc = over(acc, c, ring * uStrength);
  } else if (uTone == 0) {
    // Created: a ring blooms out from the element's edge, with a soft fill flash.
    float d = boxSd(p, b, r);
    float grow = uSpread * (1.0 - (1.0 - t) * (1.0 - t));
    float ring = exp(-abs(d - grow) / (1.5 + 3.0 * t)) * fade;
    float fill = smoothstep(1.0, -1.0, d) * 0.22 * fade * fade * fade;
    acc = over(acc, c, fill * uStrength);
    acc = over(acc, c, ring * uStrength);
  } else {
    // Updated: the border lights up and a band of light sweeps across.
    float d = boxSd(p, b, r);
    float inside = smoothstep(1.0, -1.0, d);
    float x = (fragCoord.x - uInset) / max(2.0 * b.x, 1.0);
    float band = exp(-pow((x - mix(-0.2, 1.2, t)) * 6.0, 2.0)) * inside * 0.3;
    float ring = exp(-abs(d) / 2.0) * sin(3.14159 * t);
    acc = over(acc, c, band * uStrength);
    acc = over(acc, c, ring * uStrength);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Created", values: { uTone: 0 } },
    { name: "Updated", values: { uTone: 1 } },
    { name: "Removed", values: { uTone: 2 } },
    { name: "Collaborator", values: { uTone: 1, uUpdate: [0.93, 0.28, 0.6] } },
  ],
};

export const cardCompleteBurst: ShaderEffect = {
  kind: "shader",
  id: "card-complete-burst",
  name: "Card complete burst",
  description: "A small burst of sparks and a ring popping from a point on a card's edge when a task is done, sized for a list item rather than a whole screen.",
  category: "pyrotechnics",
  tags: ["pyro", "celebration", "success", "burst", "sparks", "ui", "overlay", "one-shot"],
  transparent: true,
  loop: 1.6,
  rest: 0.5,
  source: glsl(
    `// Card complete burst: sparks and a ring from a point on a card's edge, then gone.
uniform vec2 uOrigin;          // @control min=0 max=1 default=0.9,0.5 label="Origin (0–1)"
uniform vec3 uColor1;          // @control color default=#22C55E label="Colour 1"
uniform vec3 uColor2;          // @control color default=#FACC15 label="Colour 2"
uniform vec3 uColor3;          // @control color default=#38BDF8 label="Colour 3"
uniform float uSize;           // @control min=0.2 max=1.5 default=0.7 label="Size"
uniform int uSparks;           // @control min=6 max=24 default=16 label="Sparks"
uniform bool uAnimate;         // @control default=true label="Animate"
uniform float uProgress;       // @control min=0 max=1 default=0.35 label="Progress (when still)"`,
    HASH,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = uAnimate ? fract(iTime / 1.6) / 0.9 : clamp(uProgress, 0.0, 1.0);
  float unit = iResolution.y * uSize;
  vec2 o = uOrigin * iResolution.xy;
  vec2 p = (fragCoord - o) / unit;
  vec4 acc = vec4(0.0);
  if (t > 1.0) {
    fragColor = vec4(0.0);
    return;
  }
  float fade = 1.0 - smoothstep(0.55, 1.0, t);
  // A ring popping out.
  float rr = 0.45 * (1.0 - pow(1.0 - min(t * 1.6, 1.0), 3.0));
  float ring = exp(-abs(length(p) - rr) * unit / 2.5) * (1.0 - smoothstep(0.1, 0.6, t));
  acc = over(acc, uColor1, ring);
  // Sparks reach at most 1.2 out and fall 0.25: nothing to draw past that.
  if (length(p) > 1.6) {
    fragColor = unpremultiply(acc);
    return;
  }
  int n = clamp(uSparks, 6, 24);
  for (int i = 0; i < 24; i++) {
    if (i >= n) break;
    float fi = float(i);
    float a = fi / float(n) * 6.28318 + 0.4 * (hash12(vec2(fi, 1.0)) - 0.5);
    float speed = 0.6 + 0.6 * hash12(vec2(fi, 2.0));
    float dist = speed * (1.0 - pow(1.0 - t, 2.5));
    vec2 dir = vec2(cos(a), sin(a));
    // Each spark a short streak along its path, falling a little.
    vec2 head = dir * dist + vec2(0.0, -0.25 * t * t);
    vec2 tail = dir * max(dist - 0.12 * (1.0 - t), 0.0) + vec2(0.0, -0.25 * t * t);
    vec2 pa = p - tail;
    vec2 ba = head - tail;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    float seg = length(pa - ba * h) * unit;
    float w = 1.6 + 1.2 * hash12(vec2(fi, 3.0));
    float k = smoothstep(w, w - 1.0, seg) * fade;
    float pick = hash12(vec2(fi, 4.0));
    vec3 c = pick < 0.33 ? uColor1 : pick < 0.66 ? uColor2 : uColor3;
    acc = over(acc, c, k);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Centre", values: { uOrigin: [0.5, 0.5] } },
    { name: "Left edge", values: { uOrigin: [0.06, 0.5] } },
    { name: "Gold", values: { uColor1: [0.98, 0.75, 0.14], uColor2: [1, 0.93, 0.55], uColor3: [0.98, 0.55, 0.2] } },
    { name: "Neubrutal", values: { uColor1: [1, 0.16, 0.52], uColor2: [0.98, 0.8, 0.08], uColor3: [0.02, 0.71, 0.83] } },
  ],
};

export const dragoverAttract: ShaderEffect = {
  kind: "shader",
  id: "dragover-attract",
  name: "Dragover attract",
  description: "A dashed drop zone whose border bulges toward the pointer while something is dragged over it, and ripples out from where the item lands.",
  category: "interaction",
  tags: ["interactive", "hover", "click", "drop-zone", "upload", "ui", "overlay"],
  transparent: true,
  source: glsl(
    `// Dragover attract: a drop zone pulled toward the pointer (iPointer or uHover/uTarget), rippling where it lands (iClicks or uLanded).
uniform vec3 uColor;           // @control color default=#6366F1 label="Colour"
uniform vec3 uFill;            // @control color default=#EEF2FF label="Fill"
uniform float uRadius;         // @control min=0 max=64 default=16 label="Corner radius (px)"
uniform float uInset;          // @control min=4 max=48 default=14 label="Inset (px)"
uniform float uPull;           // @control min=0 max=40 default=14 label="Pull (px)"
uniform float uDash;           // @control min=4 max=40 default=12 label="Dash (px)"
uniform float uHover;          // @control min=0 max=1 default=0 label="Dragged over (for drag events)"
uniform vec2 uTarget;          // @control min=0 max=1 default=0.5,0.5 label="Drag point (0–1, for drag events)"
uniform float uLanded;         // @control min=0 max=1 default=0 label="Landing ripple (0–1, for drop events)"
uniform bool uDemo;            // @control default=true label="Demo when idle"`,
    HASH,
    OVER,
    BOX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 hs = 0.5 * iResolution.xy;
  vec2 b = max(hs - uInset, vec2(4.0));
  float r = min(uRadius, min(b.x, b.y));
  // Where the dragged thing is and how much it is over the zone: the pointer, the host's drag events, or the idle demo.
  float demoPhase = fract(iTime / 4.0);
  vec2 demo = hs + b * 0.6 * vec2(sin(iTime * 0.9), 0.6 * sin(iTime * 1.3));
  float demoOn = uDemo && iPointer.z <= 0.0 && uHover <= 0.0 ? smoothstep(0.0, 0.15, demoPhase) * smoothstep(0.8, 0.65, demoPhase) : 0.0;
  float over_ = max(max(clamp(iPointer.z, 0.0, 1.0), uHover), demoOn);
  vec2 at = iPointer.z > 0.0 ? iPointer.xy : uHover > 0.0 ? uTarget * iResolution.xy : demo;
  // The border bulges toward that point: the box pushed out where it is near.
  vec2 p = fragCoord - hs;
  float near = exp(-pow(length(fragCoord - at) / (0.35 * min(b.x, b.y) + 40.0), 2.0));
  float d = boxSd(p, b + uPull * over_ * near, r);
  // Dashes round the border, marching while dragged over.
  float s = atan(p.y, p.x) * length(b) / 1.2;
  float dash = step(0.5, fract((s - iTime * 30.0 * over_) / (2.0 * uDash)));
  float line = smoothstep(2.0, 1.0, abs(d)) * mix(dash, 1.0, over_ * 0.6);
  vec4 acc = vec4(0.0);
  acc = over(acc, uFill, smoothstep(1.0, -1.0, d) * (0.15 + 0.55 * over_));
  acc = over(acc, uColor, line * (0.55 + 0.45 * over_));
  // Where something lands: rings out from the latest click, the host's uLanded, or the demo's drop.
  vec2 landAt = at;
  float landAge = -1.0;
  if (iClicks[0].w > 0.5) {
    landAt = iClicks[0].xy;
    landAge = (iTime - iClicks[0].z) / 0.9;
  } else if (uLanded > 0.0) {
    landAge = uLanded;
    landAt = uTarget * iResolution.xy;
  } else if (uDemo && iPointer.z <= 0.0) {
    landAge = (demoPhase - 0.65) / 0.3;
    landAt = demo;
  }
  if (landAge > 0.0 && landAge < 1.0) {
    float rr = landAge * length(b) * 1.2;
    float ring = exp(-abs(length(fragCoord - landAt) - rr) / 3.0) * (1.0 - landAge) * smoothstep(1.0, -1.0, d);
    acc = over(acc, uColor, ring * 0.8);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Mint", values: { uColor: [0.06, 0.73, 0.51], uFill: [0.93, 0.99, 0.96] } },
    { name: "Strong pull", values: { uPull: 32 } },
    { name: "Dark", values: { uColor: [0.65, 0.7, 1], uFill: [0.12, 0.14, 0.24] } },
    { name: "Neubrutal", values: { uColor: [0.04, 0.04, 0.04], uFill: [0.98, 0.8, 0.08], uRadius: 0, uDash: 16 } },
  ],
};

export const momentShaders: ShaderEffect[] = [denoiseReveal, generatingField, agentWorkingBorder, changePulse, cardCompleteBurst, dragoverAttract];
