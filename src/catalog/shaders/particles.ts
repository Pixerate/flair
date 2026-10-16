import { glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";

/*
 * Particle systems, all stateless: where a particle is comes from its seed
 * and the time alone (`hash` per particle or per cell), so any frame renders
 * on its own. Fields of many particles give each grid cell one and search
 * the cells around a pixel; smaller systems loop over every particle with an
 * early out. Light is summed and written with `glow`; paper and paint are
 * layered with `over`. The pointer ones read the wrapper's built-ins
 * (`iPointer`, `iClicks`, `iTrail`), never declared here.
 */

/**
 * `glow(c)`: light as a colour over whatever is behind it. Its alpha is its
 * brightest channel, so it brightens what is under it like a screen blend.
 */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

/**
 * `over(acc, colour, alpha)`: paints a colour over a premultiplied
 * accumulator; `unpremultiply(acc)` turns it into straight colour and coverage.
 */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `pointerAt(t)`: where the pointer was at time `t`, in pixels: the newest
 * `iTrail` point no later than `t` (the oldest kept if none is), else
 * `iPointer` while there is no trail.
 */
const POINTER_AT = `
vec2 pointerAt(float t) {
  vec2 at = iPointer.xy;
  for (int i = 0; i < 32; i++) {
    if (iTrail[i].w < 0.5) break;
    at = iTrail[i].xy;
    if (iTrail[i].z <= t) break;
  }
  return at;
}`.trim();

/**
 * `clickAt(i, demo, period)`: click `i`, newest first, as (x, y, time, 1),
 * or zeros for none. With the demo on and no real clicks yet, a synthetic
 * click lands every `period` seconds at a pseudo-random spot (needs HASH).
 */
const CLICKS = `
vec4 clickAt(int i, bool demo, float period) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[i];
  float k = floor(iTime / period) - float(i);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.2 + 0.6 * h) * iResolution.xy, k * period, 1.0);
}`.trim();

/**
 * `cornerHashes(i)`: `hash12` of the four corners of lattice cell `i`
 * (i, i + x, i + y, i + xy), sharing the work between corners in the same
 * row or column; the same numbers as four `hash12` calls, for less.
 */
const CORNER_HASHES = `
vec4 cornerHashes(vec2 i) {
  vec2 x = fract(vec2(i.x, i.x + 1.0) * 0.1031);
  vec2 y = fract(vec2(i.y, i.y + 1.0) * 0.1031);
  vec4 X = x.xyxy;
  vec4 Y = y.xxyy;
  vec4 d = X * (Y + 33.33) + Y * (X + 33.33) + X * (X + 33.33);
  vec4 px = X + d;
  return fract((px + (Y + d)) * px);
}`.trim();

export const flowParticles: ShaderEffect = {
  kind: "shader",
  id: "flow-particles",
  name: "Flow particles",
  description: "Thousands of tiny particles streaming along a swirling curl-noise flow field, coloured by how fast they go.",
  category: "particles",
  tags: ["particles", "flow", "field", "curl", "abstract", "background"],
  source: glsl(
    `// Flow particles: streaks along a curl-noise field. Each pixel walks the field upstream
// a few steps and lights up where it meets a particle that has passed that way.
uniform float uScale;       // @control min=0.5 max=6 default=2 label="Field scale"
uniform float uSpeed;       // @control min=0 max=3 default=1 label="Speed"
uniform float uDensity;     // @control min=30 max=160 default=80 step=1 label="Grid density"
uniform float uAmount;      // @control min=0.05 max=1 default=0.4 label="Particles"
uniform float uTail;        // @control min=0.1 max=1 default=0.55 label="Tail length"
uniform float uTurbulence;  // @control min=0 max=1 default=0.4 label="Turbulence"
uniform float uBrightness;  // @control min=0.2 max=3 default=1.2 label="Brightness"
uniform vec3 uSlow;         // @control color default=#2B4CFF label="Slow colour"
uniform vec3 uFast;         // @control color default=#7CFFE0 label="Fast colour"
uniform vec3 uBackground;   // @control color default=#04060E label="Background"
uniform bool uTransparent;  // @control default=false label="Transparent"`,
    HASH,
    CORNER_HASHES,
    GLOW,
    `// The gradient of vnoise, worked out exactly (its value is not needed here).
vec2 vnoiseGrad(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  vec4 h = cornerHashes(i);
  float k = h.x - h.y - h.z + h.w;
  return du * vec2(h.y - h.x + k * u.y, h.z - h.x + k * u.x);
}

// The curl of the potential vnoise(p + vec2(t, -0.6 t)) + turbulence * 0.5 * vnoise(p * 2.3 - vec2(0.7 t, t) + 9.1)
// (divergence free, so streams swirl rather than pool), plus a gentle drift.
vec2 flow(vec2 p, float t) {
  vec2 g = vnoiseGrad(p + vec2(t, -0.6 * t));
  if (uTurbulence > 0.0) g += uTurbulence * 1.15 * vnoiseGrad(p * 2.3 - vec2(0.7 * t, t) + 9.1);
  return vec2(g.y, -g.x) + vec2(0.35, 0.08);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  const int STEPS = 24;
  vec2 q = fragCoord / iResolution.y;
  float cell = 1.0 / uDensity;
  float ft = iTime * uSpeed * 0.04;
  float tail = max(uTail * float(STEPS), 1.0);
  vec3 col = vec3(0.0);
  // The walk stays a few steps in each cell, so its particle is worked out once per cell.
  vec2 cellAt = vec2(-1e9);
  bool alive = false;
  float life = 0.0;
  vec2 at = vec2(0.0);
  vec2 v = vec2(0.0);
  float sp = 0.0;
  for (int k = 0; k < STEPS; k++) {
    // The field barely turns over a step, so it is looked up every other step.
    if ((k & 1) == 0) {
      v = flow(q * uScale, ft);
      sp = length(v);
    }
    // One particle per cell at most; each life starts somewhere new in the cell.
    vec2 c = floor(q * uDensity);
    if (c != cellAt) {
      cellAt = c;
      float h0 = hash12(c + 0.31);
      float phase = iTime * uSpeed * (0.3 + 0.3 * h0) + hash12(c + 7.7);
      life = fract(phase);
      float cyc = floor(phase);
      alive = hash12(c * 1.7 + cyc * 3.1) < uAmount;
      if (alive) at = (c + 0.25 + 0.5 * hash22(c + cyc * 17.13)) * cell;
    }
    // This pixel lies k steps downstream of the particle's start; its head is "head" steps along.
    float behind = life * float(STEPS) - float(k);
    if (alive && behind >= 0.0 && behind < tail) {
      vec2 dq = (q - at) / cell;
      float d2 = dot(dq, dq);
      // exp(-14 d^2) > 0.01
      if (d2 < 0.329) {
        float spot = exp(-d2 * 14.0);
        float w = 1.0 - behind / tail;
        float fade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.75, 1.0, life));
        vec3 hue = mix(uSlow, uFast, smoothstep(0.3, 2.2, sp));
        col += hue * spot * w * w * fade * (0.6 + 1.6 * exp(-behind * 1.2));
      }
    }
    // Walk upstream, farther per step where the flow is fast.
    q -= v / max(sp, 1e-3) * cell * min(0.22 * (0.6 + sp), 0.45);
  }
  col *= uBrightness;
  if (uTransparent) {
    fragColor = glow(col);
  } else {
    fragColor = vec4(uBackground + (1.0 - exp(-col)) * (1.0 - uBackground), 1.0);
  }
}`,
  ),
  presets: [
    { name: "Ember stream", values: { uSlow: [0.6, 0.08, 0.02], uFast: [1, 0.8, 0.35], uBackground: [0.03, 0.01, 0.01], uTurbulence: 0.7 } },
    { name: "Fine silk", values: { uDensity: 140, uAmount: 0.8, uTail: 1, uScale: 1.2, uSlow: [0.55, 0.45, 1], uFast: [1, 1, 1] } },
    { name: "Overlay", values: { uTransparent: true, uAmount: 0.35, uBrightness: 1.6 } },
  ],
};

export const magneticSwarm: ShaderEffect = {
  kind: "shader",
  id: "magnetic-swarm",
  name: "Magnetic swarm",
  description: "A swarm of glowing particles orbiting an attractor that chases the pointer, flung outward by every click.",
  category: "particles",
  tags: ["particles", "interactive", "hover", "click", "swarm", "orbit", "overlay"],
  transparent: true,
  source: glsl(
    `// Magnetic swarm: particles on tilted elliptical orbits around an attractor. The attractor
// follows the pointer (later for outer groups, read back from iTrail) or drifts while idle.
uniform int uCount;        // @control min=10 max=160 default=110 label="Particles"
uniform float uRadius;     // @control min=0.05 max=0.6 default=0.22 label="Orbit radius"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Orbit speed"
uniform float uLag;        // @control min=0 max=1 default=0.6 label="Lag"
uniform float uFling;      // @control min=0 max=1 default=0.5 label="Fling at clicks"
uniform float uSize;       // @control min=0.3 max=3 default=1 label="Size"
uniform vec3 uColorA;      // @control color default=#6EE7FF label="Inner colour"
uniform vec3 uColorB;      // @control color default=#C084FC label="Outer colour"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    ROTATE,
    GLOW,
    POINTER_AT,
    CLICKS,
    `vec2 drift(float t) {
  return iResolution.xy * (0.5 + vec2(0.3 * sin(t * 0.53), 0.24 * sin(t * 0.81 + 1.3)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  // Four groups, each following the attractor a little later than the last.
  vec2 centres[4];
  for (int g = 0; g < 4; g++) {
    float lag = uLag * float(g) / 3.0;
    vec2 idle = uDemo ? drift(iTime - lag * 1.2) : iResolution.xy * 0.5;
    centres[g] = mix(idle, pointerAt(iTime - lag * 0.25), hover) * px;
  }
  vec4 clicks[4];
  for (int k = 0; k < 4; k++) clicks[k] = clickAt(k, uDemo, 3.0);

  vec3 col = vec3(0.0);
  // A faint core at the attractor.
  float dc = length(p - centres[0]);
  col += mix(uColorA, vec3(1.0), 0.5) * (0.25 * exp(-dc * dc / 0.0004) + 0.05 * exp(-dc / 0.05));

  for (int i = 0; i < 160; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 4.1));
    float h3 = hash12(vec2(fi, 9.7));
    float r = uRadius * (0.25 + 0.75 * sqrt(h.x));
    // Inner orbits run faster, as round a mass.
    float w = uSpeed * (0.7 + 0.6 * h.y) * 0.25 / (r + 0.05);
    float a = iTime * w + h3 * 6.28318;
    float tilt = hash12(vec2(fi, 2.3)) * 3.14159;
    float ecc = 0.2 + 0.8 * hash12(vec2(fi, 5.5));
    vec2 pos = centres[i % 4] + rot(tilt) * vec2(cos(a), sin(a) * ecc) * r;
    float energy = 0.0;
    for (int k = 0; k < 4; k++) {
      vec4 c = clicks[k];
      if (c.w < 0.5) continue;
      float age = iTime - c.z;
      if (age < 0.0 || age > 4.0) continue;
      vec2 dir = pos - c.xy * px;
      float d = length(dir);
      float push = uFling * 0.7 * exp(-d * 2.5) * (1.0 - exp(-age * 9.0)) * exp(-age * 1.3);
      pos += (dir / max(d, 1e-4)) * push;
      energy += push;
    }
    vec2 dp = p - pos;
    if (abs(dp.x) > 0.06 || abs(dp.y) > 0.06) continue;
    float dist = length(dp);
    float rr = 0.0035 * uSize * (0.6 + 0.8 * h.y);
    vec3 hue = mix(uColorA, uColorB, smoothstep(0.2, 1.0, r / max(uRadius, 1e-3)));
    float twinkle = 0.75 + 0.25 * sin(iTime * 6.0 + fi * 2.1);
    float core = 1.0 - smoothstep(rr * 0.5, rr + px, dist);
    float halo = exp(-dist / (rr * 2.5)) * 0.4;
    col += hue * (core * 1.6 + halo) * twinkle * (1.0 + energy * 3.0);
  }
  fragColor = glow(col);
}`,
  ),
  presets: [
    { name: "Bee swarm", values: { uColorA: [1, 0.85, 0.2], uColorB: [1, 0.55, 0.1], uSpeed: 2.2, uRadius: 0.12, uSize: 0.8, uLag: 1 } },
    { name: "Galaxy", values: { uCount: 160, uRadius: 0.4, uSpeed: 0.5, uSize: 0.6, uColorA: [1, 0.95, 0.8], uColorB: [0.35, 0.5, 1] } },
  ],
};

export const dustInLight: ShaderEffect = {
  kind: "shader",
  id: "dust-in-light",
  name: "Dust in light",
  description: "Dust motes drifting slowly through a diagonal beam of light, sharp at one depth and soft discs nearer or farther.",
  category: "particles",
  tags: ["particles", "overlay", "dust", "light", "beam", "atmosphere", "bokeh"],
  transparent: true,
  source: glsl(
    `// Dust in light: layers of motes, only lit inside a beam; out-of-focus layers become bigger, fainter discs.
uniform vec3 uColor;       // @control color default=#FFE2AA label="Light"
uniform float uAngle;      // @control min=-80 max=80 default=30 label="Beam angle"
uniform float uOffset;     // @control min=-1 max=1 default=-0.3 label="Beam position"
uniform float uWidth;      // @control min=0.05 max=0.9 default=0.32 label="Beam width"
uniform float uHaze;       // @control min=0 max=1 default=0.35 label="Haze"
uniform float uDensity;    // @control min=0 max=1 default=0.55 label="Dust"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Drift"
uniform float uFocus;      // @control min=0 max=1 default=0.45 label="Focus depth"
uniform float uBlur;       // @control min=0 max=1 default=0.6 label="Depth of field"`,
    HASH,
    NOISE,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;

  // The beam: from the top edge, angled, widening and fading as it goes.
  float ang = radians(uAngle);
  vec2 dir = vec2(sin(ang), -cos(ang));
  vec2 o = vec2(aspect * (0.5 + 0.5 * uOffset), 1.05);
  vec2 rel = p - o;
  float along = dot(rel, dir);
  float across = dot(rel, vec2(-dir.y, dir.x));
  float w = uWidth * (0.7 + 0.35 * max(along, 0.0));
  float beam = (1.0 - smoothstep(w * 0.25, w * 0.5, abs(across))) * smoothstep(-0.02, 0.15, along) * exp(-max(along, 0.0) * 0.35);
  // Faint shafts within it, slowly shifting.
  float shafts = 0.75 + 0.25 * vnoise(vec2(across / max(w, 0.01) * 6.0, t * 0.15));
  beam *= shafts;
  vec3 col = uColor * beam * uHaze * 0.3;

  if (beam > 0.002) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float z = (fi + 0.5) / 4.0;          // 0 far, 1 near
      float scale = mix(26.0, 9.0, z);     // cells per height
      vec2 q = p * scale + vec2(0.012, -0.007) * t * (0.5 + z) * scale + fi * 7.3;
      vec2 base = floor(q);
      float blur = abs(z - uFocus) * uBlur;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 id = base + vec2(float(x), float(y));
          vec2 h = hash22(id + fi * 13.1);
          if (hash12(id * 1.3 + fi) > uDensity) continue;
          // Each mote wanders slowly round its cell.
          vec2 wander = 0.35 * vec2(sin(t * (0.2 + 0.3 * h.x) + h.y * 6.28), cos(t * (0.17 + 0.25 * h.y) + h.x * 6.28));
          vec2 m = id + 0.5 + (h - 0.5) * 0.4 + wander;
          float d = length(q - m) / scale;
          float r = 0.0018 * (0.6 + 1.6 * z) * (0.6 + 0.8 * h.x);
          float big = r + blur * 0.022 * (0.5 + z);
          if (d > big + px * 2.0) continue;
          float edge = max(px, big * 0.35 * min(blur * 4.0, 1.0));
          float disc = 1.0 - smoothstep(big - edge, big + px * 0.5, d);
          float energy = (r * r) / (big * big);
          // Motes glint as they tumble.
          float glint = 0.55 + 0.45 * sin(t * (1.0 + 2.0 * h.y) + h.x * 30.0);
          col += uColor * disc * mix(1.0, 0.25, min(blur * 3.0, 1.0)) * (0.4 + 2.6 * energy) * glint * beam * 1.6;
        }
      }
    }
  }
  fragColor = glow(col);
}`,
  ),
  presets: [
    { name: "Cathedral", values: { uAngle: 20, uWidth: 0.2, uHaze: 0.55, uColor: [1, 0.92, 0.75], uDensity: 0.7 } },
    { name: "Sharp", values: { uBlur: 0.1, uDensity: 0.8, uWidth: 0.5, uHaze: 0.2 } },
    { name: "Underwater", values: { uColor: [0.55, 0.9, 1], uAngle: -15, uSpeed: 0.6, uBlur: 1, uHaze: 0.5 } },
  ],
};

export const boids: ShaderEffect = {
  kind: "shader",
  id: "boids",
  name: "Boids",
  description: "Flocks of small birds or arrows wheeling across the sky in coherent groups that split apart and merge again.",
  category: "particles",
  tags: ["particles", "flock", "birds", "boids", "swarm", "nature"],
  source: glsl(
    `// Boids: each bird follows one of a few flock paths, plus its own place in the formation and
// a little jitter, and now and then moves over to another flock (so flocks split and merge).
// It faces along its velocity, found from where it was a moment ago.
uniform int uCount;        // @control min=10 max=120 default=70 label="Birds"
uniform int uGroups;       // @control min=1 max=4 default=3 label="Flocks"
uniform float uSize;       // @control min=0.3 max=3 default=1 label="Size"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uSpread;     // @control min=0.02 max=0.4 default=0.12 label="Flock spread"
uniform float uJitter;     // @control min=0 max=1 default=0.35 label="Jitter"
uniform bool uArrows;      // @control default=false label="Arrows instead of birds"
uniform vec3 uColor;       // @control color default=#1B1A2A label="Birds"
uniform vec3 uSkyTop;      // @control color default=#5B7DB8 label="Sky top"
uniform vec3 uSkyBottom;   // @control color default=#F6C29A label="Sky bottom"
uniform bool uTransparent; // @control default=false label="Transparent"`,
    HASH,
    `float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// A flock's path: slow sweeps whose frequencies differ a little per flock, so flocks meet and part.
vec2 flockAt(float g, float t, float aspect) {
  vec2 h = hash22(vec2(g, 1.7));
  return vec2(
    aspect * (0.5 + 0.36 * sin(t * (0.21 + 0.06 * h.x) + h.y * 6.28) + 0.06 * sin(t * 0.57 + g * 2.0)),
    0.52 + 0.3 * sin(t * (0.29 + 0.08 * h.y) + h.x * 6.28 + 1.7 * g) + 0.05 * sin(t * 0.73 + g * 3.0)
  );
}

vec2 birdAt(float fi, float t, float aspect) {
  vec2 h = hash22(vec2(fi, 3.1));
  float groups = float(uGroups);
  // Which flock it flies with: switching now and then, gliding over to the next.
  float sw = t * 0.06 * (0.6 + 0.8 * h.y) + h.x * 10.0;
  float k = floor(sw);
  float ga = floor(hash12(vec2(fi, k)) * groups);
  float gb = floor(hash12(vec2(fi, k + 1.0)) * groups);
  vec2 centre = mix(flockAt(ga, t, aspect), flockAt(gb, t, aspect), smoothstep(0.6, 1.0, fract(sw)));
  vec2 o = (hash22(vec2(fi, 8.3)) - 0.5) * 2.0 * uSpread;
  o.x *= 1.6;
  vec2 jitter = uJitter * 0.025 * vec2(sin(t * (1.1 + h.x) + fi), cos(t * (1.3 + h.y) + fi * 1.7));
  return centre + o + jitter;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed * 0.5;
  float len = 0.018 * uSize;
  float cover = 0.0;
  // A bird is within its formation offset, jitter and size of the line between the two flocks
  // it is moving between, so first find which pairs of flocks pass near this pixel (bit a * 4 + b).
  float groups = float(uGroups);
  vec2 flocks[4];
  for (int g = 0; g < 4; g++) flocks[g] = flockAt(float(g), t, aspect);
  float margin = 1.89 * uSpread + 0.036 * uJitter + 2.04 * len + 2.0 * px;
  int near = 0;
  for (int a = 0; a < 4; a++) {
    if (a >= uGroups) break;
    for (int b = 0; b < 4; b++) {
      if (b >= uGroups) break;
      vec2 pa = p - flocks[a];
      vec2 ba = flocks[b] - flocks[a];
      vec2 off = pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
      if (dot(off, off) < margin * margin) near |= 1 << (a * 4 + b);
    }
  }
  for (int i = 0; i < 120; i++) {
    if (near == 0 || i >= uCount) break;
    float fi = float(i);
    // birdAt, with the flock centres looked up and far birds dropped before the rest of the work.
    vec2 h = hash22(vec2(fi, 3.1));
    float sw = t * 0.06 * (0.6 + 0.8 * h.y) + h.x * 10.0;
    float k = floor(sw);
    int ga = int(floor(hash12(vec2(fi, k)) * groups));
    float glide = smoothstep(0.6, 1.0, fract(sw));
    int gb = glide > 0.0 ? int(floor(hash12(vec2(fi, k + 1.0)) * groups)) : ga;
    if ((near & (1 << (ga * 4 + gb))) == 0) continue;
    vec2 o = (hash22(vec2(fi, 8.3)) - 0.5) * 2.0 * uSpread;
    o.x *= 1.6;
    vec2 jitter = uJitter * 0.025 * vec2(sin(t * (1.1 + h.x) + fi), cos(t * (1.3 + h.y) + fi * 1.7));
    vec2 pos = mix(flocks[ga], flocks[gb], glide) + o + jitter;
    float scale = 0.7 + 0.5 * hash12(vec2(fi, 6.6));
    float l = len * scale;
    vec2 dp = p - pos;
    if (abs(dp.x) > l * 1.2 || abs(dp.y) > l * 1.2) continue;
    vec2 v = pos - birdAt(fi, t - 0.03, aspect);
    vec2 fwd = v / max(length(v), 1e-6);
    vec2 q = vec2(dot(dp, fwd), dot(dp, vec2(-fwd.y, fwd.x))) / l;
    float sd;
    if (uArrows) {
      sd = max(sdTriangle(q, vec2(0.55, 0.0), vec2(-0.45, 0.38), vec2(-0.45, -0.38)), -sdTriangle(q, vec2(-0.2, 0.0), vec2(-0.6, 0.45), vec2(-0.6, -0.45)));
    } else {
      // A gull's V, flapping.
      float flap = sin(iTime * (9.0 + 4.0 * hash12(vec2(fi, 2.2))) + fi * 1.3);
      float span = 0.55 + 0.15 * flap;
      vec2 tipL = vec2(-0.35 - 0.1 * flap, span);
      vec2 tipR = vec2(-0.35 - 0.1 * flap, -span);
      vec2 elbowL = vec2(-0.05, 0.25 + 0.12 * flap);
      vec2 elbowR = vec2(-0.05, -0.25 - 0.12 * flap);
      vec2 head = vec2(0.3, 0.0);
      float bones = min(min(sdSegment(q, head, elbowL), sdSegment(q, elbowL, tipL)), min(sdSegment(q, head, elbowR), sdSegment(q, elbowR, tipR)));
      float body = sdSegment(q, vec2(-0.25, 0.0), head);
      sd = min(bones - 0.06, body - 0.09);
    }
    cover = max(cover, 1.0 - smoothstep(-px / l, px / l, sd));
  }
  if (uTransparent) {
    fragColor = vec4(uColor, cover);
  } else {
    vec3 sky = mix(uSkyBottom, uSkyTop, smoothstep(0.0, 1.0, p.y));
    fragColor = vec4(mix(sky, uColor, cover), 1.0);
  }
}`,
  ),
  presets: [
    { name: "Starlings", values: { uCount: 120, uSize: 0.5, uGroups: 2, uSpread: 0.2, uJitter: 0.6, uSkyTop: [0.62, 0.6, 0.7], uSkyBottom: [0.95, 0.75, 0.6] } },
    { name: "Arrows", values: { uArrows: true, uColor: [0.95, 0.95, 1], uSkyTop: [0.08, 0.1, 0.22], uSkyBottom: [0.2, 0.15, 0.4], uCount: 50 } },
  ],
};

export const particleText: ShaderEffect = {
  kind: "shader",
  id: "particle-text",
  name: "Particle text",
  description: "A title that dissolves into drifting particles, letter by letter, and gathers back into place, on a loop.",
  category: "particles",
  tags: ["particles", "text", "title", "dissolve", "disintegrate"],
  video: "none",
  loop: 6,
  source: glsl(
    `// Particle text: a particle on every cell of a grid where the text's mask is, carried off by a
// smooth wind field (so a pixel can trace back to the cells that could have reached it). Loops every 6 s.
uniform sampler2D uText;     // @control filter=linear wrap=clamp default=${textImage("FLAIR")} label="Text"
uniform vec3 uColor;         // @control color default=#FFFFFF label="Letters"
uniform vec3 uDust;          // @control color default=#FF7AC6 label="Particles"
uniform vec3 uBackground;    // @control color default=#0B0A14 label="Background"
uniform bool uTransparent;   // @control default=false label="Transparent"
uniform float uSize;         // @control min=0.3 max=1 default=0.85 label="Text size"
uniform float uDensity;      // @control min=40 max=240 default=120 step=1 label="Particles per height"
uniform float uScatter;      // @control min=0.1 max=1.5 default=0.4 label="Scatter distance"
uniform float uDirection;    // @control min=-180 max=180 default=20 label="Drift direction"`,
    HASH,
    CORNER_HASHES,
    `// The text image's alpha at frame point p (height 1, centred), the image contained in uSize of the frame.
float letters(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

// Half the size of the text's box in the frame (letters is 0 outside it).
vec2 lettersHalf() {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * uSize / aspect);
  return 0.5 * vec2(h * aspect, h);
}

// How far through dissolving the particle at home is (0 in place, 1 gone): left to right, then back together.
float scattered(vec2 home, float phase) {
  float frame = iResolution.x / iResolution.y;
  float sx = clamp(home.x / max(frame * uSize, 0.1) + 0.5, 0.0, 1.0);
  float leave = smoothstep(0.12 + 0.28 * sx, 0.32 + 0.28 * sx, phase);
  float back = smoothstep(0.66, 0.94, phase);
  float a = leave * (1.0 - back);
  return a * a * (3.0 - 2.0 * a);
}

// vnoise, keeping the corner hashes of the lattice cell it last looked in: the wind is smooth and
// its lattice coarse, so most lookups land in the same cell as the one before.
vec2 eddyCellA = vec2(-1e9);
vec2 eddyCellB = vec2(-1e9);
vec4 eddyHashA = vec4(0.0);
vec4 eddyHashB = vec4(0.0);

float eddy(vec2 p, inout vec2 cellAt, inout vec4 h) {
  vec2 i = floor(p);
  if (i != cellAt) {
    cellAt = i;
    h = cornerHashes(i);
  }
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h.x, h.y, u.x), mix(h.z, h.w, u.x), u.y);
}

// Group g's gust: its wind (xy) and how much it lifts what it carries (z).
vec3 gustOf(float g) {
  float ang = radians(uDirection) + (fract(g * 0.618) - 0.5) * 1.2;
  return vec3(vec2(cos(ang), sin(ang)) * (0.3 + 0.18 * g), 0.3 * (0.5 + 0.2 * g));
}

// Where the wind has carried a particle of group g from home: smooth in home, so it can be inverted.
// Each of the six groups rides its own gust (speed, heading and eddies), so they spread apart.
vec2 carried(vec2 home, float phase, float g, vec3 gust) {
  float a = scattered(home, phase);
  // Still at home (most of the frame, most of the time): no need for the eddies.
  if (a <= 0.0) return vec2(0.0);
  float t = phase * 3.0;
  vec2 q = home * 3.0 + g * 5.3;
  vec2 swirl = vec2(eddy(q + vec2(t, 0.0), eddyCellA, eddyHashA), eddy(q + vec2(4.7, t), eddyCellB, eddyHashB)) - 0.5;
  return a * uScatter * (gust.xy + swirl * 0.8 + vec2(0.0, gust.z * a));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float cell = 1.0 / uDensity;
  float phase = fract(iTime / 6.0);

  // Solid letters while (and where) they are whole.
  float solid = letters(p) * (1.0 - smoothstep(0.0, 0.04, scattered(p, phase)));
  vec3 col = uColor;
  float cover = solid;

  // Every particle is home outside this part of the loop.
  bool moving = phase > 0.12 && phase < 0.94;
  vec2 box = lettersHalf() + 2.0 * cell;
  for (int gi = 0; gi < 6; gi++) {
    if (!moving) break;
    float g = float(gi);
    vec3 gust = gustOf(g);
    // Trace back to the home a particle of this group here would have come from, then search the cells round it.
    vec2 home = p;
    for (int i = 0; i < 4; i++) home = p - carried(home, phase, g, gust);
    // The cells searched are all off the text.
    if (any(greaterThan(abs(home), box))) continue;
    vec2 base = floor(home / cell);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 c = base + vec2(float(x), float(y));
        if (floor(hash12(c + 0.73) * 6.0) != g) continue;
        vec2 hc = (c + 0.5) * cell;
        float a = scattered(hc, phase);
        if (a < 0.002 || letters(hc) < 0.5) continue;
        vec2 j = hash22(c);
        vec2 pos = hc + carried(hc, phase, g, gust) + (j - 0.5) * cell * 1.1 * a;
        float r = cell * (0.5 - 0.1 * a) * (0.75 + 0.5 * j.x);
        float d = length(p - pos);
        float disc = (1.0 - smoothstep(r - px, r + px * 0.5, d)) * (1.0 - smoothstep(0.6, 1.0, a) * 0.6 * j.y);
        if (disc > cover) {
          cover = disc;
          col = mix(uColor, uDust, smoothstep(0.0, 0.5, a));
        }
      }
    }
  }
  if (uTransparent) {
    fragColor = vec4(col, cover);
  } else {
    fragColor = vec4(mix(uBackground, col, cover), 1.0);
  }
}`,
  ),
  presets: [
    { name: "Ash", values: { uColor: [0.92, 0.9, 0.86], uDust: [0.45, 0.42, 0.4], uBackground: [0.07, 0.07, 0.07], uDirection: 60, uScatter: 0.9 } },
    { name: "Gold dust", values: { uColor: [1, 0.85, 0.45], uDust: [1, 0.6, 0.2], uDensity: 180, uDirection: -10 } },
  ],
};

export const confettiCannon: ShaderEffect = {
  kind: "shader",
  id: "confetti-cannon",
  name: "Confetti cannon",
  description: "Confetti blasting out of both bottom corners and every click in arcs, then flipping and fluttering down.",
  category: "particles",
  tags: ["particles", "confetti", "celebration", "party", "interactive", "click", "overlay"],
  transparent: true,
  source: glsl(
    `// Confetti cannon: paper rectangles and dots launched with air drag towards a terminal fall,
// swaying as they go, spinning in the plane and flipping (squashed and shaded) out of it.
uniform vec3 uColorA;      // @control color default=#FF4D6D label="Colour 1"
uniform vec3 uColorB;      // @control color default=#FFD166 label="Colour 2"
uniform vec3 uColorC;      // @control color default=#06D6A0 label="Colour 3"
uniform vec3 uColorD;      // @control color default=#4D96FF label="Colour 4"
uniform int uCount;        // @control min=10 max=80 default=50 label="Pieces per blast"
uniform float uInterval;   // @control min=1.5 max=8 default=3.5 label="Seconds between blasts"
uniform float uPower;      // @control min=0.5 max=2 default=1 label="Power"
uniform float uSize;       // @control min=0.4 max=2.5 default=1 label="Size"
uniform float uFall;       // @control min=0.2 max=2 default=1 label="Fall speed"
uniform bool uCannons;     // @control default=true label="Corner cannons"
uniform bool uDemo;        // @control default=true label="Demo clicks when idle"`,
    HASH,
    ROTATE,
    OVER,
    CLICKS,
    `const float LIFE = 4.5;

// One blast of count pieces from origin at time age, aimed at angle (radians) give or take spread/2.
vec4 blast(vec4 acc, vec2 p, vec2 origin, float angle, float spread, float speed, float age, float seed, int count, float px) {
  if (age < 0.0 || age > LIFE) return acc;
  const float k = 2.2;
  float e = (1.0 - exp(-k * age)) / k;
  float fade = 1.0 - smoothstep(LIFE - 1.0, LIFE, age);
  float reach = 0.03 * uSize;
  // Every piece is within its sway and the spread of fall speeds of the fan its launch sweeps out
  // (speeds 0.5 to 1 times speed, within spread of angle, all dropped by the middle fall speed),
  // so skip the blast where this pixel is clear of that.
  float drop = 0.16 * uFall * (age - e);
  vec2 rel = p - origin + vec2(0.0, drop);
  float slack = reach * 1.42 + 0.035 + 0.3 * drop + px;
  float r = length(rel);
  float far = speed * e;
  if (r > far + slack || r < 0.5 * far - slack) return acc;
  if (spread < 6.2 && r > slack) {
    float off = abs(mod(atan(rel.y, rel.x) - angle + 3.14159265, 6.28318531) - 3.14159265);
    if (off > spread * 0.5 + asin(slack / r) + 0.01) return acc;
  }
  for (int j = 0; j < 80; j++) {
    if (j >= count) break;
    float fj = float(j);
    vec2 h = hash22(vec2(fj * 7.13 + 1.0, seed));
    float launch = speed * (0.5 + 0.5 * h.y);
    // The same tests for this piece before working out the rest of it: how far out, then where.
    if (abs(r - launch * e) > slack) continue;
    float a = angle + (h.x - 0.5) * spread;
    vec2 v0 = vec2(cos(a), sin(a)) * launch;
    vec2 dv = rel - v0 * e;
    if (abs(dv.x) > reach + 0.035 || abs(dv.y) > reach + 0.3 * drop) continue;
    vec2 h2 = hash22(h * 53.1 + seed);
    float h3 = hash12(h2 * 17.7 + fj);
    float fall = 0.16 * uFall * (0.7 + 0.6 * h2.x);
    vec2 pos = origin + v0 * e - vec2(0.0, fall * (age - e));
    pos.x += 0.035 * sin(age * (2.0 + 2.0 * h2.y) + h.x * 6.28) * smoothstep(0.3, 1.2, age);
    vec2 dp = p - pos;
    if (abs(dp.x) > reach || abs(dp.y) > reach) continue;
    float spin = age * (2.0 + 5.0 * h2.y) * (h3 < 0.5 ? 1.0 : -1.0) + h.x * 6.28;
    float flip = age * (4.0 + 7.0 * h2.x) + h.y * 6.28;
    float face = cos(flip);
    float squash = max(abs(face), 0.06);
    vec2 q = rot(spin) * dp;
    q.y /= squash;
    float sd;
    if (h3 < 0.65) {
      vec2 d = abs(q) - vec2(0.011, 0.0065) * uSize;
      sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    } else {
      sd = length(q) - 0.0065 * uSize;
    }
    float alpha = 1.0 - smoothstep(-px, px / squash, sd);
    if (alpha <= 0.0) continue;
    float pick = fract(h3 * 7.3);
    vec3 col = pick < 0.25 ? uColorA : (pick < 0.5 ? uColorB : (pick < 0.75 ? uColorC : uColorD));
    // Flip shading: dim edge-on, the back a shade darker, a glint face-on.
    col *= (0.5 + 0.5 * abs(face)) * (face < 0.0 ? 0.82 : 1.0);
    col += 0.35 * pow(abs(face), 16.0);
    acc = over(acc, min(col, vec3(1.0)), alpha * fade);
  }
  return acc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  vec4 acc = vec4(0.0);
  if (uCannons) {
    float now = floor(iTime / uInterval);
    for (int m = 3; m >= 0; m--) {
      float n = now - float(m);
      float age = iTime - n * uInterval;
      acc = blast(acc, p, vec2(0.0, -0.02), radians(58.0), 0.7, 2.8 * uPower, age, n * 3.17 + 1.0, uCount, px);
      acc = blast(acc, p, vec2(aspect, -0.02), radians(122.0), 0.7, 2.8 * uPower, age, n * 3.17 + 2.0, uCount, px);
    }
  }
  for (int i = 3; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo, 4.0);
    if (c.w < 0.5) continue;
    acc = blast(acc, p, c.xy * px, radians(90.0), 6.28318, 1.2 * uPower, iTime - c.z, c.z * 1.91 + float(i), uCount / 2 + 5, px);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Gold and silver", values: { uColorA: [1, 0.82, 0.3], uColorB: [0.85, 0.87, 0.9], uColorC: [1, 0.7, 0.2], uColorD: [0.7, 0.72, 0.78] } },
    { name: "Clicks only", values: { uCannons: false, uCount: 60 } },
    { name: "Big blast", values: { uCount: 80, uPower: 1.6, uSize: 1.4, uInterval: 5 } },
  ],
};

export const fireflies: ShaderEffect = {
  kind: "shader",
  id: "fireflies",
  name: "Fireflies",
  description: "Fireflies wandering over a dusky meadow, each blinking on and off in its own rhythm and drifting towards the pointer.",
  category: "particles",
  tags: ["particles", "fireflies", "night", "nature", "glow", "interactive", "hover"],
  source: glsl(
    `// Fireflies: wandering lights on their own blink cycles, drawn (lazily, through iTrail) to the pointer.
uniform int uCount;        // @control min=5 max=80 default=40 label="Fireflies"
uniform vec3 uGlow;        // @control color default=#D4FF5C label="Glow"
uniform float uSize;       // @control min=0.3 max=3 default=1 label="Size"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Wander"
uniform float uBlink;      // @control min=0.1 max=3 default=1 label="Blink rate"
uniform float uAttract;    // @control min=0 max=1 default=0.6 label="Drawn to pointer"
uniform bool uMeadow;      // @control default=true label="Dusky meadow"
uniform vec3 uSky;         // @control color default=#141B36 label="Sky"
uniform vec3 uDusk;        // @control color default=#4B3A5E label="Horizon"
uniform vec3 uGrass;       // @control color default=#070D0B label="Grass"`,
    HASH,
    NOISE,
    GLOW,
    POINTER_AT,
    `// How much of the grass silhouette covers p (height units).
float grass(vec2 p, float aspect) {
  float ground = 0.1 + 0.04 * vnoise(vec2(p.x * 3.0, 1.0));
  float cover = 1.0 - smoothstep(ground - 0.002, ground + 0.002, p.y);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float n = 70.0 + 50.0 * fi;
    float y = p.y - ground;
    float sway = sin(iTime * 0.8 + p.x * 4.0 + fi) * 0.25 * y;
    float x = p.x * n + sway * n;
    float id = floor(x);
    float hb = (0.04 + 0.11 * hash12(vec2(id, fi))) * (1.0 - 0.35 * fi);
    float lean = (hash12(vec2(id, fi + 5.0)) - 0.5) * 1.5;
    float f = fract(x) - 0.5 - lean * y / hb;
    float blade = step(0.0, y) * step(y, hb) * step(abs(f), 0.5 * (1.0 - y / hb));
    cover = max(cover, blade);
  }
  return cover;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  float hover = clamp(iPointer.z, 0.0, 1.0) * uAttract;
  vec3 light = vec3(0.0);
  for (int i = 0; i < 80; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 1.9));
    vec2 g = hash22(vec2(fi, 7.3));
    vec2 home = vec2(h.x * aspect, 0.06 + 0.8 * pow(h.y, 1.4));
    vec2 wander = vec2(
      0.1 * sin(t * (0.15 + 0.2 * g.x) + g.y * 6.28) + 0.04 * sin(t * (0.6 + 0.5 * g.y) + fi),
      0.06 * sin(t * (0.12 + 0.18 * g.y) + g.x * 6.28) + 0.03 * cos(t * (0.7 + 0.4 * g.x) + fi * 1.3)
    );
    vec2 pos = home + wander;
    if (hover > 0.0) {
      // Each drifts to its own spot round the pointer, the slow ones following where it was.
      vec2 near = pointerAt(iTime - 0.25 * g.x) * px + (h - 0.5) * 0.3 + wander * 0.6;
      pos = mix(pos, near, hover * (0.4 + 0.5 * g.y));
    }
    vec2 dp = p - pos;
    float r = 0.004 * uSize * (0.7 + 0.6 * g.x);
    if (abs(dp.x) > r * 20.0 || abs(dp.y) > r * 20.0) continue;
    float period = (2.5 + 3.5 * hash12(vec2(fi, 4.4))) / uBlink;
    float ph = fract(iTime / period + h.y * 3.0);
    float blink = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.08, 0.4, ph));
    float on = 0.04 + blink;
    float d = length(dp);
    float core = 1.0 - smoothstep(r * 0.3, r + px, d);
    float halo = exp(-d / (r * 3.5));
    vec3 hue = mix(uGlow, vec3(1.0, 0.85, 0.4), 0.3 * g.y);
    light += hue * (core * 2.0 + halo) * on;
  }
  if (uMeadow) {
    vec3 sky = mix(uDusk, uSky, smoothstep(0.05, 1.0, p.y));
    float stars = step(0.996, hash12(floor(fragCoord * 0.5))) * smoothstep(0.4, 0.9, p.y) * (0.5 + 0.5 * sin(iTime * 2.0 + p.x * 40.0));
    sky += stars * 0.5;
    vec3 col = mix(sky, uGrass, grass(p, aspect));
    fragColor = vec4(col + (1.0 - exp(-light)) * (1.0 - col), 1.0);
  } else {
    fragColor = glow(light);
  }
}`,
  ),
  presets: [
    { name: "Overlay", values: { uMeadow: false } },
    { name: "Swarm", values: { uCount: 80, uBlink: 2, uSize: 0.7, uAttract: 1 } },
    { name: "Blue spirits", values: { uGlow: [0.45, 0.8, 1], uSky: [0.03, 0.05, 0.1], uDusk: [0.1, 0.18, 0.25], uBlink: 0.5 } },
  ],
};

/** Particles: flow fields, swarms, dust, fireflies and confetti. */
export const particlesShaders: ShaderEffect[] = [flowParticles, magneticSwarm, dustInLight, boids, particleText, confettiCannon, fireflies];
