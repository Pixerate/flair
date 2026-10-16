import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

/*
 * These follow `iTrail`, the built-in the wrapper declares: where the pointer
 * has just been, newest first (xy pixels, z the `iTime` of the point, w 1 for
 * a point, 0 for an empty slot), about one point a frame. Thumbnails and
 * recordings have no pointer, so while the canvas is not hovered (or nothing
 * has moved over it yet) each one, with its `uDemo` control on, makes up a
 * trail of its own along a smooth looping path.
 */

/**
 * `trailPoint(i, demo)`: trail point `i`, newest first, as (x, y, time, 1),
 * or zeros for an empty slot. With the demo on and the pointer not over the
 * canvas (or no trail yet), the points are a looping path taken at `iTime`
 * and then every `dt` seconds back, on a grid of times so they stay put
 * between frames like real points do; the drawing code is the same for both.
 * `speed` is how fast the demo goes round. `TRAIL_POINTS` is the size of
 * `iTrail` (32 points, at most one every 1/30 s: about a second of path).
 * With `walk`, also the cheaper ways through the trail of {@link trailWalk}.
 */
function trailHelper(dt: number, speed: number, walk = false): string {
  return `
const int TRAIL_POINTS = 32;
vec2 demoPath(float t) {
  float s = t * ${speed.toFixed(3)};
  vec2 q = vec2(0.34 * sin(s) + 0.05 * sin(s * 2.3 + 1.0), 0.27 * sin(s * 2.0 + 0.4) + 0.04 * cos(s * 3.1));
  return iResolution.xy * (0.5 + q);
}
// Whether a and b are either side of a jump (the pointer left and came back elsewhere), not one stroke.
bool trailJump(vec4 a, vec4 b) {
  return a.z - b.z > 0.25 && length(a.xy - b.xy) > 0.03 * iResolution.y;
}
vec4 trailPoint(int i, bool demo) {
  if (!demo || (iTrail[0].w > 0.5 && iPointer.z > 0.0)) return iTrail[i];
  const float dt = ${dt.toFixed(5)};
  float t = i == 0 ? iTime : (floor(iTime / dt) + 1.0 - float(i)) * dt;
  return vec4(demoPath(t), t, 1.0);
}${walk ? `\n${trailWalk(dt, speed)}` : ""}`.trim();
}

/**
 * For walking the whole trail each pixel, cheaply: `trailLive(demo)` once,
 * then `trailAt(i, live)` gives what `trailPoint(i, demo)` does; or, going
 * through the points in order, `trailFrom(i, live)` once and `trailNext(live)`
 * for points i, i + 1, …, which steps the demo path's sines and cosines on
 * by a fixed turn instead of working each one out again.
 */
function trailWalk(dt: number, speed: number): string {
  // The demo path's four phases, as multiples of s, and how far each turns back per point.
  const rates = [1, 2.3, 2, 3.1];
  const turn = rates.map((r) => r * dt * speed);
  const vec = (f: (x: number) => number) => `vec4(${turn.map((x) => f(x).toFixed(8)).join(", ")})`;
  return `
bool trailLive(bool demo) {
  return !demo || (iTrail[0].w > 0.5 && iPointer.z > 0.0);
}
vec4 trailAt(int i, bool live) {
  if (live) return iTrail[i];
  const float dt = ${dt.toFixed(5)};
  float t = i == 0 ? iTime : (floor(iTime / dt) + 1.0 - float(i)) * dt;
  return vec4(demoPath(t), t, 1.0);
}
int gWalkI;
float gWalkBase;
vec4 gWalkCos;
vec4 gWalkSin;
// Starts a walk at point i (1 or more).
void trailFrom(int i, bool live) {
  gWalkI = i;
  if (live) return;
  const float dt = ${dt.toFixed(5)};
  gWalkBase = floor(iTime / dt) + 1.0;
  float s = (gWalkBase - float(i)) * dt * ${speed.toFixed(3)};
  vec4 phase = vec4(s, s * 2.3 + 1.0, s * 2.0 + 0.4, s * 3.1);
  gWalkCos = cos(phase);
  gWalkSin = sin(phase);
}
// The walk's next point: as trailAt(i, live) for i = the start, then one more each call.
vec4 trailNext(bool live) {
  int i = gWalkI;
  gWalkI++;
  if (live) return iTrail[min(i, TRAIL_POINTS - 1)];
  const float dt = ${dt.toFixed(5)};
  vec2 q = vec2(0.34 * gWalkSin.x + 0.05 * gWalkSin.y, 0.27 * gWalkSin.z + 0.04 * gWalkCos.w);
  vec4 point = vec4(iResolution.xy * (0.5 + q), (gWalkBase - float(i)) * dt, 1.0);
  const vec4 turnCos = ${vec(Math.cos)};
  const vec4 turnSin = ${vec(Math.sin)};
  vec4 c = gWalkCos * turnCos + gWalkSin * turnSin;
  gWalkSin = gWalkSin * turnCos - gWalkCos * turnSin;
  gWalkCos = c;
  return point;
}`.trim();
}

/** `segment(p, a, b)`: distance from p to the segment ab (x) and how far along it the nearest point is, 0–1 (y). */
const SEGMENT = `
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
  return vec2(length(p - a - ab * t), t);
}`.trim();

/** `catmull(p0, p1, p2, p3, t)`: the Catmull-Rom spline from p1 to p2. */
const CATMULL = `
vec2 catmull(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return 0.5 * (2.0 * p1 + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t3);
}`.trim();

/**
 * `trailBoxDist(p, p0, p1, p2, p3, scale)`: at most the distance from p to the
 * Catmull-Rom spline from p1 to p2 (and to any chords between points on it),
 * all scaled by `scale`: the distance to the box round its Bezier control
 * points, which hold the whole curve.
 */
const CATMULL_BOX = `
float trailBoxDist(vec2 p, vec2 p0, vec2 p1, vec2 p2, vec2 p3, float scale) {
  vec2 c1 = p1 + (p2 - p0) / 6.0;
  vec2 c2 = p2 - (p3 - p1) / 6.0;
  vec2 lo = min(min(p1, p2), min(c1, c2)) * scale;
  vec2 hi = max(max(p1, p2), max(c1, c2)) * scale;
  return length(max(max(lo - p, p - hi), 0.0));
}`.trim();

/** `glow(c)`: light as a colour over whatever is behind it (alpha is its brightest channel). */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

export const cometTrail: ShaderEffect = {
  kind: "shader",
  id: "comet-trail",
  name: "Comet trail",
  description: "A bright comet head on the pointer with a glowing tail that tapers and fades through where it has just been, shading from head to tail colour.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "overlay", "glow", "comet"],
  transparent: true,
  source: glsl(
    `// Comet trail: a glowing head on the newest trail point and a tail along the rest, thinning and fading with age.
uniform vec3 uHead;       // @control color default=#FFF1C9 label="Head colour"
uniform vec3 uTail;       // @control color default=#5B7CFF label="Tail colour"
uniform float uWidth;     // @control min=0.002 max=0.06 default=0.016 label="Tail width"
uniform float uHeadSize;  // @control min=0 max=0.08 default=0.02 label="Head size"
uniform float uGlow;      // @control min=0 max=3 default=1.2 label="Glow"
uniform float uLife;      // @control min=0.1 max=3 default=1 label="Fade time"
uniform float uIntensity; // @control min=0.2 max=3 default=1.2 label="Intensity"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    trailHelper(1 / 30, 1.6),
    SEGMENT,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec4 a = trailPoint(0, uDemo);
  if (a.w < 0.5) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 head = a.xy * px;
  float core = 0.0;
  float halo = 0.0;
  float bestU = 0.0;
  float bestLight = -1.0;
  for (int k = 0; k < TRAIL_POINTS - 1; k++) {
    vec4 b = trailPoint(k + 1, uDemo);
    if (b.w < 0.5 || trailJump(a, b)) break;
    vec2 s = segment(p, a.xy * px, b.xy * px);
    float u = (float(k) + s.y) / float(TRAIL_POINTS - 1);
    float age = iTime - mix(a.z, b.z, s.y);
    float fade = (1.0 - u) * clamp(1.0 - age / uLife, 0.0, 1.0);
    // Thinner towards the tail, and as it fades.
    float w = uWidth * mix(1.0, 0.12, u) * sqrt(fade);
    float sd = s.x - w;
    float c = (1.0 - smoothstep(-px, px, sd)) * fade;
    float g = exp(-max(sd, 0.0) / (uWidth * 1.4 + px)) * fade * fade * uGlow * 0.6;
    core = max(core, c);
    halo = max(halo, g);
    if (c + g > bestLight) {
      bestLight = c + g;
      bestU = u;
    }
    a = b;
  }
  vec3 tint = mix(uHead, uTail, smoothstep(0.0, 0.75, bestU));
  vec3 col = tint * halo + mix(tint, vec3(1.0), 0.45) * core * 1.5;
  // The head: a white-hot core in a halo of its colour, fading once the pointer rests.
  vec4 h0 = trailPoint(0, uDemo);
  float headFade = clamp(1.0 - (iTime - h0.z) / (uLife * 2.0), 0.0, 1.0);
  float r = length(p - head);
  float sz = max(uHeadSize, px);
  col += vec3(1.0, 0.98, 0.94) * exp(-r * r / (sz * sz * 0.35)) * 2.5 * headFade;
  col += uHead * (sz / (r + sz)) * exp(-r / (sz * 8.0)) * uGlow * headFade;
  fragColor = glow(col * uIntensity);
}`,
  ),
  presets: [
    { name: "Fireball", values: { uHead: [1, 0.93, 0.6], uTail: [1, 0.25, 0.05], uWidth: 0.024, uGlow: 1.8 } },
    { name: "Ice", values: { uHead: [0.9, 0.98, 1], uTail: [0.3, 0.85, 1], uWidth: 0.01, uLife: 1.2 } },
    { name: "Laser", values: { uHead: [1, 0.6, 0.9], uTail: [0.9, 0.1, 0.6], uWidth: 0.005, uHeadSize: 0.008, uGlow: 2.2 } },
  ],
};

export const ribbonTrail: ShaderEffect = {
  kind: "shader",
  id: "ribbon-trail",
  name: "Ribbon trail",
  description: "A shiny two-tone ribbon flowing smoothly after the pointer, twisting over to show its other side as it goes.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "overlay", "ribbon", "spline"],
  transparent: true,
  source: glsl(
    `// Ribbon trail: a Catmull-Rom ribbon through the trail points; its width swells and pinches to fake a twist.
uniform vec3 uColorA;     // @control color default=#FF4F9A label="Front"
uniform vec3 uColorB;     // @control color default=#4F6BFF label="Back"
uniform float uWidth;     // @control min=0.01 max=0.12 default=0.055 label="Width"
uniform float uTwist;     // @control min=0 max=40 default=14 label="Twist"
uniform float uSpin;      // @control min=0 max=10 default=2 label="Spin"
uniform float uShine;     // @control min=0 max=1 default=0.7 label="Shine"
uniform float uLife;      // @control min=0.1 max=3 default=1.1 label="Fade time"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    trailHelper(1 / 30, 1.5, true),
    SEGMENT,
    CATMULL,
    CATMULL_BOX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  bool live = trailLive(uDemo);
  vec4 a = trailAt(0, live);
  vec4 b = trailAt(1, live);
  if (a.w < 0.5 || b.w < 0.5) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 prev = 2.0 * a.xy - b.xy;
  float best = 1e9;
  float bestU = 0.0;
  float bestFace = 1.0;
  float bestV = 0.0;
  float bestFade = 0.0;
  trailFrom(2, live);
  for (int k = 0; k < TRAIL_POINTS - 1; k++) {
    if (b.w < 0.5 || trailJump(a, b)) break;
    // The point after b: read once, it is the next segment's b.
    vec4 c = k + 2 < TRAIL_POINTS ? trailNext(live) : vec4(0.0);
    vec2 next = c.w > 0.5 && !trailJump(b, c) ? c.xy : 2.0 * b.xy - a.xy;
    vec2 lo = min(min(prev, a.xy), min(b.xy, next)) * px - uWidth - 2.0 * px;
    vec2 hi = max(max(prev, a.xy), max(b.xy, next)) * px + uWidth + 2.0 * px;
    // The ribbon is at most half its width either side of the spline: further off than that, a segment cannot be nearer.
    if (all(greaterThan(p, lo)) && all(lessThan(p, hi)) && trailBoxDist(p, prev, a.xy, b.xy, next, px) - uWidth * 0.5 < best) {
      vec2 q0 = a.xy * px;
      for (int j = 1; j <= 4; j++) {
        float t1 = float(j) / 4.0;
        vec2 q1 = catmull(prev, a.xy, b.xy, next, t1) * px;
        vec2 s = segment(p, q0, q1);
        float tt = (float(j - 1) + s.y) / 4.0;
        float u = (float(k) + tt) / float(TRAIL_POINTS - 1);
        float when = mix(a.z, b.z, tt);
        float fade = clamp(1.0 - (iTime - when) / uLife, 0.0, 1.0);
        // The twist travels with the ribbon: its phase is fixed to when each part was laid.
        float face = cos(when * uTwist + iTime * uSpin);
        float w = uWidth * 0.5 * mix(1.0, 0.15, u) * (0.12 + 0.88 * abs(face)) * sqrt(fade);
        float sd = s.x - w;
        if (sd < best) {
          best = sd;
          bestU = u;
          bestFace = face;
          bestV = s.x / max(w, 1e-5);
          bestFade = fade;
        }
        q0 = q1;
      }
    }
    prev = a.xy;
    a = b;
    b = c;
  }
  float cover = (1.0 - smoothstep(-px, px, best)) * smoothstep(0.0, 0.15, bestFade);
  if (cover <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }
  // Front and back in their own colours, each darkening along the ribbon.
  vec3 base = bestFace >= 0.0 ? uColorA : uColorB;
  vec3 other = bestFace >= 0.0 ? uColorB : uColorA;
  base = mix(base, mix(base, other, 0.35) * 0.75, bestU);
  float lit = 0.45 + 0.55 * abs(bestFace);
  vec3 col = base * lit * (1.0 - 0.3 * bestV * bestV);
  // A sheen across the face, brightest where it faces us.
  float spec = uShine * pow(abs(bestFace), 6.0) * exp(-pow((bestV - 0.25) * 2.5, 2.0));
  col = mix(col, vec3(1.0), clamp(spec, 0.0, 1.0));
  fragColor = vec4(col, cover);
}`,
  ),
  presets: [
    { name: "Gold and silver", values: { uColorA: [1, 0.78, 0.25], uColorB: [0.8, 0.83, 0.88], uShine: 1 } },
    { name: "Silk", values: { uColorA: [0.95, 0.3, 0.35], uColorB: [0.55, 0.08, 0.15], uTwist: 6, uSpin: 0.5, uShine: 0.4, uWidth: 0.06 } },
  ],
};

export const sparkleTrail: ShaderEffect = {
  kind: "shader",
  id: "sparkle-trail",
  name: "Sparkle trail",
  description: "Twinkling sparkles and four-point stars shed along the pointer's path, each drifting down a little as it fades out.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "overlay", "sparkle", "magic", "particles"],
  transparent: true,
  source: glsl(
    `// Sparkle trail: stars shed at each trail point, twinkling and drifting down as they fade.
uniform vec3 uColorA;     // @control color default=#FFE27A label="Colour 1"
uniform vec3 uColorB;     // @control color default=#9AD9FF label="Colour 2"
uniform int uCount;       // @control min=1 max=4 default=2 label="Sparkles per point"
uniform float uSize;      // @control min=0.005 max=0.06 default=0.022 label="Size"
uniform float uSpread;    // @control min=0 max=0.1 default=0.025 label="Spread"
uniform float uFall;      // @control min=0 max=0.5 default=0.1 label="Drift down"
uniform float uLife;      // @control min=0.2 max=2 default=1 label="Lifetime"
uniform float uTwinkle;   // @control min=0 max=1 default=0.7 label="Twinkle"
uniform float uIntensity; // @control min=0.2 max=3 default=1.2 label="Intensity"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    trailHelper(1 / 40, 1.4, true),
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec3 col = vec3(0.0);
  bool live = trailLive(uDemo);
  // How far a sparkle's light reaches from where it is (twice its largest size), and its sideways sway.
  float reach = 2.5 * uSize + px;
  float side = uSpread + 0.012 + reach;
  // Point 0 is still moving with the pointer, so sparkles come from the settled points after it.
  trailFrom(1, live);
  for (int k = 1; k < TRAIL_POINTS; k++) {
    vec4 q = trailNext(live);
    if (q.w < 0.5) break;
    float age = iTime - q.z;
    if (age < 0.0 || age > uLife) continue;
    // Skip points none of whose sparkles (spread, swaying and drifting down) can reach this pixel.
    vec2 rel = p - q.xy * px;
    float fall = uFall * age * (0.4 + 0.6 * age);
    if (abs(rel.x) > side || rel.y > uSpread + reach || rel.y < -uSpread - fall - reach) continue;
    float life = age / uLife;
    // Points drop off the end of the trail: fade those about to go.
    float keep = 1.0 - smoothstep(float(TRAIL_POINTS) - 6.0, float(TRAIL_POINTS) - 1.0, float(k));
    float env = smoothstep(0.0, 0.08, life) * (1.0 - life) * (1.0 - life) * keep;
    for (int j = 0; j < 4; j++) {
      if (j >= uCount) break;
      vec2 h = hash22(vec2(q.z * 61.37 + float(j) * 7.13, float(j) + 0.5));
      float h3 = hash12(h * 37.1 + q.z);
      vec2 pos = q.xy * px + (h - 0.5) * 2.0 * uSpread;
      pos += vec2(0.012 * sin(age * 3.0 + h.x * 6.28318), -uFall * age * (0.4 + 0.6 * age));
      float s = uSize * (0.45 + 0.8 * h3);
      vec2 d = pos - p;
      if (dot(d, d) > s * s * 4.0) continue;
      // Turn some of them a little.
      float an = (h.y - 0.5) * 0.9;
      d = mat2(cos(an), sin(an), -sin(an), cos(an)) * d;
      float tw = mix(1.0, 0.35 + 0.65 * (0.5 + 0.5 * sin(age * (12.0 + 12.0 * h.y) + h.x * 6.28318)), uTwinkle);
      float rays = exp(-abs(d.x) / (s * 0.05)) * exp(-abs(d.y) / (s * 0.45));
      rays += exp(-abs(d.y) / (s * 0.05)) * exp(-abs(d.x) / (s * 0.45));
      float core = exp(-dot(d, d) / (s * s * 0.02));
      vec3 tint = h3 < 0.5 ? uColorA : uColorB;
      col += (tint * (rays * 0.9 + core * 0.6) + vec3(1.0) * core) * env * tw;
    }
  }
  fragColor = glow(col * uIntensity);
}`,
  ),
  presets: [
    { name: "Fairy dust", values: { uColorA: [1, 0.6, 0.95], uColorB: [0.7, 0.6, 1], uCount: 3, uSize: 0.015, uSpread: 0.04 } },
    { name: "Gold glitter", values: { uColorA: [1, 0.82, 0.35], uColorB: [1, 0.95, 0.75], uCount: 4, uSize: 0.012, uFall: 0.25, uTwinkle: 1 } },
  ],
};

export const brushTrail: ShaderEffect = {
  kind: "shader",
  id: "brush-trail",
  name: "Brush trail",
  description: "An ink brush stroke following the pointer, bristle-streaked and breaking up dry at its tail, thinner where it moves faster.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "overlay", "brush", "ink", "paint"],
  transparent: true,
  source: glsl(
    `// Brush trail: a stroke along the trail, its width from speed (pressure), bristle streaks across it, dry at the tail.
uniform vec3 uInk;        // @control color default=#15171D label="Ink"
uniform float uWidth;     // @control min=0.005 max=0.1 default=0.045 label="Width"
uniform float uPressure;  // @control min=0 max=1 default=0.6 label="Thinner when fast"
uniform float uBristles;  // @control min=4 max=80 default=28 label="Bristles"
uniform float uDry;       // @control min=0 max=1 default=0.65 label="Dry brush"
uniform float uLife;      // @control min=0.2 max=6 default=1.5 label="Fade time"
uniform bool uPaper;      // @control default=true label="Paper"
uniform vec3 uPaperColor; // @control color default=#F4ECDD label="Paper colour"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    FBM,
    trailHelper(1 / 30, 1.3, true),
    SEGMENT,
    `// The stroke's width at a point from how fast the segment from a to b was drawn: faster, thinner.
float pressWidth(vec4 a, vec4 b, float px) {
  float speed = length(b.xy - a.xy) * px / max(abs(a.z - b.z), 1.0 / 240.0);
  return uWidth * mix(0.3, 1.0, 1.0 / (1.0 + speed * uPressure * 1.5));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  bool live = trailLive(uDemo);
  vec4 a = trailAt(0, live);
  vec4 b = trailAt(1, live);
  float best = 1e9;
  float bestU = 1.0;
  float bestV = 0.0;
  float bestFade = 0.0;
  // Ragged edges: the same noise for every segment, so read it once.
  float rag = 0.9 + 0.2 * vnoise(p * 180.0);
  if (a.w > 0.5 && b.w > 0.5) {
    // Faster strokes are thinner, never wider than uWidth: ragged, at most 1.1 × that from the line.
    float reach = 1.1 * uWidth;
    trailFrom(2, live);
    for (int k = 0; k < TRAIL_POINTS - 1; k++) {
      if (b.w < 0.5 || trailJump(a, b)) break;
      // The point after b: read once, it is the next segment's b.
      vec4 next = k + 2 < TRAIL_POINTS ? trailNext(live) : vec4(0.0);
      // A segment whose box is further off than the stroke reaches cannot be nearer than the best so far.
      vec2 off = max(max(min(a.xy, b.xy) * px - p, p - max(a.xy, b.xy) * px), 0.0);
      float r = best + reach;
      if (r > 0.0 && dot(off, off) < r * r) {
        // The width where the segment starts is from it, where it ends from the next (or the same at the end).
        float wa = pressWidth(a, b, px);
        float wb = next.w > 0.5 && !trailJump(b, next) ? pressWidth(b, next, px) : wa;
        vec2 s = segment(p, a.xy * px, b.xy * px);
        float u = (float(k) + s.y) / float(TRAIL_POINTS - 1);
        float fade = clamp(1.0 - (iTime - mix(a.z, b.z, s.y)) / uLife, 0.0, 1.0);
        // A rounded start and a tail that thins out.
        float w = mix(wa, wb, s.y) * (1.0 - 0.6 * smoothstep(0.55, 1.0, u)) * smoothstep(0.0, 0.04, u + 0.01);
        w *= 0.4 + 0.6 * fade;
        float sd = s.x - w * rag;
        if (sd < best) {
          vec2 dir = b.xy - a.xy;
          float side = dir.x * (p.y - a.y * px) - dir.y * (p.x - a.x * px);
          best = sd;
          bestU = u;
          bestV = clamp(s.x / max(w, 1e-5), 0.0, 1.0) * (side < 0.0 ? -1.0 : 1.0);
          bestFade = fade;
        }
      }
      a = b;
      b = next;
    }
  }
  // Bristles streak along the stroke (they vary across it); the paper's tooth breaks them up.
  // Away from the stroke nothing shows, so the bristles are not worked out there.
  float cover = (1.0 - smoothstep(-px, px, best)) * smoothstep(0.0, 0.1, bestFade);
  vec3 col = uInk;
  if (cover > 0.0) {
    float bristle = 0.6 * vnoise(vec2(bestV * uBristles, 3.7)) + 0.4 * fbm(p * vec2(55.0, 55.0), 3);
    float dry = uDry * smoothstep(0.15, 1.0, bestU) + 0.35 * uDry * smoothstep(0.6, 1.0, abs(bestV)) + 0.7 * (1.0 - bestFade);
    cover *= smoothstep(dry - 0.06, dry + 0.06, bristle * 1.1);
    // Ink pools darker at the edges and thins where a bristle runs dry.
    col = uInk * (1.0 + 0.6 * (1.0 - bristle) * (1.0 - abs(bestV))) + 0.04 * (1.0 - bristle);
  }
  if (uPaper) {
    vec3 paper = uPaperColor * (0.95 + 0.07 * fbm(p * 9.0, 4)) - 0.03 * smoothstep(0.55, 0.9, vnoise(p * vec2(400.0, 30.0)));
    fragColor = vec4(mix(paper, col, cover * 0.95), 1.0);
  } else {
    fragColor = vec4(col, cover);
  }
}`,
  ),
  presets: [
    { name: "Red paint", values: { uInk: [0.78, 0.1, 0.12], uWidth: 0.05, uDry: 0.4, uBristles: 18 } },
    { name: "Sumi-e", values: { uInk: [0.05, 0.05, 0.06], uPressure: 1, uDry: 0.85, uLife: 3, uPaperColor: [0.94, 0.91, 0.84] } },
    { name: "Chalk on nothing", values: { uInk: [0.96, 0.96, 0.94], uPaper: false, uDry: 0.9, uBristles: 60 } },
  ],
};

export const ghostTrail: ShaderEffect = {
  kind: "shader",
  id: "ghost-trail",
  name: "Ghost trail",
  description: "Afterimages of a circle, ring or star stamped along the pointer's path, each fainter, smaller and shifted in hue than the one before.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "overlay", "afterimage", "echo"],
  transparent: true,
  source: glsl(
    `// Ghost trail: a shape stamped at the trail points, fading, shrinking and shifting hue with age.
uniform int uShape;       // @control min=0 max=2 default=1 label="Shape (0 circle, 1 ring, 2 star)"
uniform vec3 uColor;      // @control color default=#56F0FF label="Colour"
uniform float uSize;      // @control min=0.01 max=0.2 default=0.05 label="Size"
uniform float uSpacing;   // @control min=0 max=0.1 default=0.02 label="Spacing"
uniform float uOpacity;   // @control min=0.1 max=1 default=0.85 label="Opacity"
uniform float uDecay;     // @control min=0.3 max=4 default=1.4 label="Decay"
uniform float uHueShift;  // @control min=0 max=1 default=0.3 label="Hue shift"
uniform float uLife;      // @control min=0.1 max=3 default=0.8 label="Fade time"
uniform bool uShrink;     // @control default=true label="Shrink with age"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    trailHelper(1 / 50, 1.4),
    `vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

float star5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994, -0.587785252);
  const vec2 k2 = vec2(-0.809016994, -0.587785252);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  // Newest first, each stamp going under the ones before it.
  vec4 acc = vec4(0.0);
  vec2 last = vec2(-1e5);
  for (int k = 0; k < TRAIL_POINTS; k++) {
    vec4 q = trailPoint(k, uDemo);
    if (q.w < 0.5) break;
    vec2 c = q.xy * px;
    if (k > 0 && length(c - last) < uSpacing) continue;
    last = c;
    float u = float(k) / float(TRAIL_POINTS - 1);
    float fade = pow(1.0 - u, uDecay) * clamp(1.0 - (iTime - q.z) / uLife, 0.0, 1.0);
    if (fade < 0.003) continue;
    float r = uSize * (uShrink ? mix(1.0, 0.4, u) : 1.0);
    vec2 d = p - c;
    if (dot(d, d) > r * r * 2.6 + 4.0 * px * px) continue;
    float sd;
    float shade = 1.0;
    if (uShape == 1) {
      sd = abs(length(d) - r * 0.82) - r * 0.16;
    } else if (uShape == 2) {
      float an = float(k) * 0.25 + iTime * 0.8;
      d = mat2(cos(an), sin(an), -sin(an), cos(an)) * d;
      sd = star5(d, r, 0.45);
    } else {
      sd = length(d) - r;
      shade = 0.7 + 0.3 * (1.0 - length(d) / r);
    }
    float al = (1.0 - smoothstep(-px, px, sd)) * fade * uOpacity;
    vec3 col = hueShift(uColor, u * uHueShift * 6.28318) * shade;
    // The newest stamp has a bright rim.
    if (k == 0) col = mix(col, vec3(1.0), 0.5 * smoothstep(-3.0 * px, 0.0, sd));
    acc.rgb += (1.0 - acc.a) * col * al;
    acc.a += (1.0 - acc.a) * al;
  }
  fragColor = vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`,
  ),
  presets: [
    { name: "Bubbles", values: { uShape: 0, uColor: [1, 0.45, 0.75], uSize: 0.035, uOpacity: 0.6, uHueShift: 0.15 } },
    { name: "Starry", values: { uShape: 2, uColor: [1, 0.85, 0.3], uSize: 0.06, uSpacing: 0.035, uHueShift: 0.5 } },
  ],
};

export const lightPainting: ShaderEffect = {
  kind: "shader",
  id: "light-painting",
  name: "Light painting",
  description: "Long-exposure light painting in the dark: the pointer leaves neon tubes with white-hot cores that cycle through colour along the stroke and fade slowly.",
  category: "trail",
  tags: ["trail", "interactive", "hover", "cursor", "neon", "glow", "long-exposure", "light"],
  source: glsl(
    `// Light painting: a smooth glowing tube through the trail on a dark ground, coloured by when each part was painted.
uniform vec3 uBackground; // @control color default=#05060C label="Background"
uniform float uWidth;     // @control min=0.002 max=0.03 default=0.007 label="Tube width"
uniform float uGlow;      // @control min=0 max=3 default=1.2 label="Glow"
uniform float uCycle;     // @control min=0 max=2 default=0.4 label="Colour cycle"
uniform float uHue;       // @control min=0 max=1 default=0 label="Hue"
uniform float uLife;      // @control min=0.5 max=10 default=4 label="Fade time"
uniform float uFlicker;   // @control min=0 max=1 default=0.25 label="Flicker"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    trailHelper(0.05, 1.1, true),
    SEGMENT,
    CATMULL,
    CATMULL_BOX,
    `vec3 spectrum(float h) {
  return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 uv = fragCoord / iResolution.xy;
  // A dark ground with a little vignette and grain.
  vec3 col = uBackground * (1.0 - 0.45 * dot(uv - 0.5, uv - 0.5) * 2.0);
  col += (hash12(fragCoord + fract(iTime) * 113.0) - 0.5) * 0.012;

  bool live = trailLive(uDemo);
  vec4 a = trailAt(0, live);
  vec4 b = trailAt(1, live);
  if (a.w > 0.5 && b.w > 0.5) {
    float glowR = uWidth * 4.0 * max(uGlow, 0.05);
    float margin = uWidth * 3.0 + glowR * 6.0 + 2.0 * px;
    vec2 prev = 2.0 * a.xy - b.xy;
    float core = 0.0;
    float halo = 0.0;
    float best = 1e9;
    float bestWhen = a.z;
    trailFrom(2, live);
    for (int k = 0; k < TRAIL_POINTS - 1; k++) {
      if (b.w < 0.5) break;
      // Earlier strokes stay lit, but the jump between strokes is not drawn.
      bool jump = trailJump(a, b);
      // The point after b: read once, it is the next segment's b.
      vec4 c = k + 2 < TRAIL_POINTS ? trailNext(live) : vec4(0.0);
      vec2 next = c.w > 0.5 && !trailJump(b, c) ? c.xy : 2.0 * b.xy - a.xy;
      vec2 lo = min(min(prev, a.xy), min(b.xy, next)) * px - margin;
      vec2 hi = max(max(prev, a.xy), max(b.xy, next)) * px + margin;
      if (!jump && all(greaterThan(p, lo)) && all(lessThan(p, hi))) {
        // Nothing on the segment is brighter than its newer end: skip it when it can be neither nearer
        // nor brighter than what is found.
        float dmin = trailBoxDist(p, prev, a.xy, b.xy, next, px);
        float top = clamp(1.0 - (iTime - max(a.z, b.z)) / uLife, 0.0, 1.0);
        top *= top;
        if (dmin < best || exp(-dmin / glowR) * top > halo || exp(-dmin * dmin / (uWidth * uWidth)) * top > core) {
          vec2 q0 = a.xy * px;
          for (int j = 1; j <= 4; j++) {
            vec2 q1 = catmull(prev, a.xy, b.xy, next, float(j) / 4.0) * px;
            vec2 s = segment(p, q0, q1);
            float when = mix(a.z, b.z, (float(j - 1) + s.y) / 4.0);
            float fade = clamp(1.0 - (iTime - when) / uLife, 0.0, 1.0);
            fade *= fade;
            float d = s.x;
            core = max(core, exp(-d * d / (uWidth * uWidth)) * fade);
            halo = max(halo, exp(-d / glowR) * fade);
            if (d < best) {
              best = d;
              bestWhen = when;
            }
            q0 = q1;
          }
        }
      }
      prev = jump ? 2.0 * b.xy - next : a.xy;
      a = b;
      b = c;
    }
    // Colour from when the light passed, so each part keeps its colour as it fades.
    vec3 tint = spectrum(uHue + bestWhen * uCycle);
    float flicker = 1.0 - uFlicker * 0.35 * hash12(vec2(floor(iTime * 30.0), floor(bestWhen * 20.0)));
    vec3 light = tint * halo * uGlow * 0.9 + mix(tint, vec3(1.0), 0.75) * core * 1.8;
    col += (1.0 - exp(-light * 1.4)) * flicker;
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Sparkler writing", values: { uCycle: 0, uHue: 0.08, uWidth: 0.004, uGlow: 2, uFlicker: 0.8 } },
    { name: "Neon tubes", values: { uWidth: 0.012, uGlow: 0.8, uCycle: 1, uFlicker: 0 } },
  ],
};

/** Trails: comets, ribbons and brush strokes following the pointer (iTrail) or a path. */
export const trailShaders: ShaderEffect[] = [cometTrail, ribbonTrail, sparkleTrail, brushTrail, ghostTrail, lightPainting];
