import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Splashes and splatters. The overlays draw straight colour with coverage
 * alpha (0 where nothing lands), so they sit over a page or picture. The
 * splats that land at clicks read `iClicks` (xy pixels, z the `iTime` of the
 * click, w 1 for a click), the built-in the wrapper declares; with no clicks
 * yet they play a demo on a loop, which `uDemo` turns off.
 */

/** `smin(a, b, k)`: a smooth union of two distances, melting shapes together within `k`. */
const SMIN = `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`.trim();

/** `segment(p, a, b)`: distance from `p` to the segment a–b (x) and how far along it the nearest point is (y). */
const SEGMENT = `
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `splatAt(i, demo, period, seed)`: splat `i`, newest first, as (x, y, time,
 * 1) in pixels, or zeros for none, and a seed for its shape. Real clicks win;
 * with the demo on and no clicks yet, one lands every `period` seconds at one
 * of 8 spots in turn, so the demo repeats exactly every 8 periods (needs
 * {@link HASH}).
 */
const SPLATS = `
vec4 splatAt(int i, bool demo, float period, out float seed) {
  if (!demo || iClicks[0].w > 0.5) {
    seed = fract(iClicks[i].z * 0.6180339 + float(i) * 0.1379) * 97.0 + 1.0;
    return iClicks[i];
  }
  float k = floor(iTime / period) - float(i);
  float slot = mod(k, 8.0);
  vec2 h = hash22(vec2(slot * 1.37 + 0.5, 3.7));
  seed = slot * 11.3 + 1.0;
  return vec4((0.15 + 0.7 * h) * iResolution.xy, k * period, 1.0);
}`.trim();

export const paintSplatter: ShaderEffect = {
  kind: "shader",
  id: "paint-splatter",
  name: "Paint splatter",
  description: "Glossy paint splats landing in layers of a few colours, each a blob with spiky rays, satellite drops and thin flung streaks, slowly fading; clicks throw more.",
  category: "splatter",
  tags: ["splatter", "paint", "overlay", "click", "interactive", "artistic", "playful"],
  transparent: true,
  loop: 10,
  source: glsl(
    `// Paint splatter: metaball blobs with radial spikes, droplets and streaks, landing on a loop and at clicks.
uniform vec3 uColorA;     // @control color default=#E63946 label="Paint 1"
uniform vec3 uColorB;     // @control color default=#FFB703 label="Paint 2"
uniform vec3 uColorC;     // @control color default=#219EBC label="Paint 3"
uniform float uSize;      // @control min=0.3 max=2.5 default=1 label="Splat size"
uniform float uSpikes;    // @control min=0 max=1 default=0.7 label="Spikes"
uniform float uDroplets;  // @control min=0 max=1 default=0.8 label="Droplets"
uniform float uFade;      // @control min=1 max=9.5 default=8 label="Fades after (s)"
uniform float uGloss;     // @control min=0 max=1 default=0.8 label="Gloss"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    ROTATE,
    SMIN,
    SEGMENT,
    OVER,
    SPLATS,
    `// A splat's signed distance in units of its radius; grow runs 0 to 1 as it lands.
float splatShape(vec2 q, float seed, float grow) {
  // The body: a few lobes melted together, with a wobbly rim.
  float s = mix(0.3, 1.0, grow);
  vec2 b = q / s;
  float d = length(b) - 0.5;
  for (int k = 0; k < 5; k++) {
    vec2 h = hash22(vec2(seed, float(k) + 0.5));
    float r = 0.2 + 0.18 * hash12(h * 13.1 + seed);
    d = smin(d, length(b - (h - 0.5) * 0.8) - r, 0.25);
  }
  d = (d + (vnoise(b * 5.0 + seed) - 0.5) * 0.09) * s;
  // Spikes: tapering rays out of the body, the longer ones throwing a drop off their end.
  const float N = 18.0;
  float sector = 6.28318 / N;
  float base = floor(atan(q.y, q.x + 1e-5) / sector);
  for (int k = -1; k <= 1; k++) {
    float id = mod(base + float(k), N);
    vec3 h = vec3(hash22(vec2(id + 0.5, seed)), hash12(vec2(seed, id * 3.1 + 0.7)));
    if (h.z > uSpikes) continue;
    float ang = (id + 0.5 + (h.x - 0.5) * 0.7) * sector;
    vec2 dir = vec2(cos(ang), sin(ang));
    float len = (0.7 + 0.8 * h.y) * grow;
    float t = clamp(dot(q, dir) / len, 0.0, 1.0);
    d = smin(d, length(q - dir * t * len) - mix(0.11, 0.012, sqrt(t)), 0.1);
    if (h.y > 0.5) d = min(d, length(q - dir * (len + (0.1 + 0.25 * h.x) * grow)) - 0.035 - 0.04 * h.x);
  }
  // Satellite drops, and a few thin streaks flung from the rim, each ending in a drop.
  for (int k = 0; k < 12; k++) {
    if (float(k) >= uDroplets * 12.0) break;
    vec3 h = vec3(hash22(vec2(seed + 4.1, float(k) + 0.5)), hash12(vec2(float(k) * 1.7, seed + 2.0)));
    float ang = h.x * 6.28318;
    vec2 dir = vec2(cos(ang), sin(ang));
    float dist = (1.15 + 1.1 * h.y) * grow;
    float r = 0.02 + 0.06 * h.z * h.z;
    if (k < 4) {
      vec2 sg = segment(q, dir * 0.8 * grow, dir * dist);
      d = min(d, sg.x - mix(0.006, 0.02, sg.y));
      d = min(d, length(q - dir * (dist + 0.03)) - 0.035);
    } else {
      d = min(d, length(q - dir * dist) - r);
    }
  }
  return d;
}

vec3 pick(float h) {
  return h < 0.333 ? uColorA : (h < 0.667 ? uColorB : uColorC);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec3 light = normalize(vec3(-0.5, 0.6, 1.0));
  vec4 acc = vec4(0.0);
  // Oldest first, so newer splats land on top.
  for (int i = 7; i >= 0; i--) {
    float seed;
    vec4 s = splatAt(i, uDemo, 1.25, seed);
    if (s.w < 0.5) continue;
    float age = iTime - s.z;
    if (age < 0.0 || age > uFade) continue;
    float R = 0.12 * uSize * (0.7 + 0.6 * hash12(vec2(seed, 9.1)));
    vec2 q = (p - s.xy * px) / R;
    if (dot(q, q) > 7.0) continue;
    mat2 m = rot(seed * 2.4);
    float grow = 1.0 - exp(-age * 14.0);
    float eps = px / R;
    float d = splatShape(m * q, seed, grow);
    float cover = clamp(0.5 - d * R / px, 0.0, 1.0);
    if (cover <= 0.0) continue;
    // A glossy dome: the paint is thickest inside, sloping down at the rim.
    vec2 g = vec2(splatShape(m * (q + vec2(eps, 0.0)), seed, grow), splatShape(m * (q + vec2(0.0, eps)), seed, grow)) - d;
    g /= eps;
    vec3 n = normalize(vec3(g * exp(d / 0.07) * 1.3, 1.0));
    vec3 paint = pick(hash12(vec2(seed, 5.3)));
    vec3 col = paint * (0.72 + 0.28 * dot(n, light)) * mix(0.82, 1.0, smoothstep(0.0, -0.05, d));
    float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
    col = min(col + spec * uGloss * 0.85, vec3(1.0));
    float fade = 1.0 - smoothstep(uFade * 0.55, uFade, age);
    acc = over(acc, col, cover * fade);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Black ink", values: { uColorA: [0.06, 0.06, 0.07], uColorB: [0.1, 0.1, 0.12], uColorC: [0.04, 0.04, 0.05], uGloss: 0.5 } },
    { name: "Neon", values: { uColorA: [1, 0.18, 0.62], uColorB: [0.2, 1, 0.55], uColorC: [0.25, 0.6, 1], uSpikes: 1, uDroplets: 1 } },
    { name: "Big drops", values: { uSize: 1.9, uSpikes: 0.35, uDroplets: 0.4, uGloss: 1 } },
  ],
};

export const inkSplash: ShaderEffect = {
  kind: "shader",
  id: "ink-splash",
  name: "Ink splash",
  description: "A drop of ink hitting still water and blooming into a swirling cloud of curling tendrils that sinks and clears.",
  category: "splatter",
  tags: ["splatter", "ink", "water", "organic", "calm", "artistic"],
  loop: 8,
  source: glsl(
    `// Ink splash: a drop falls into water and blooms into a sinking cloud, its tendrils advected by fbm and curled by a vortex ring.
uniform vec3 uInk;        // @control color default=#1E3A8A label="Ink"
uniform vec3 uInk2;       // @control color default=#7C3AED label="Second ink"
uniform vec3 uBackground; // @control color default=#EEF4F6 label="Water"
uniform float uSwirl;     // @control min=0 max=2 default=1 label="Swirl"
uniform float uSpread;    // @control min=0.4 max=1.6 default=1 label="Spread"
uniform float uDensity;   // @control min=0.3 max=2 default=1 label="Density"
uniform bool uSurface;    // @control default=true label="Show surface"`,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    SEGMENT,
    `// Turns q round a point by an angle that fades out away from it, curling what flows past.
vec2 curl(vec2 q, vec2 c, float angle, float r) {
  vec2 d = q - c;
  return c + rot(angle * exp(-dot(d, d) / (r * r))) * d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = mod(iTime, 8.0);
  float top = 0.36;
  // Water, a touch darker with depth, under a faint surface line.
  vec3 bg = uBackground * (0.94 + 0.06 * smoothstep(-0.5, top, p.y));
  if (uSurface) {
    bg = mix(bg, uBackground * 1.04 + 0.02, step(top, p.y));
    bg *= 1.0 - 0.08 * exp(-abs(p.y - top) / (2.0 * px));
  }
  float dens = 0.0;
  float hue = 0.0;
  const float hit = 0.45;
  if (t < hit) {
    // The falling drop: a bead with a short tail.
    float y = mix(0.62, top, (t / hit) * (t / hit));
    float d = length((p - vec2(0.0, y)) * vec2(1.0, 0.8)) - 0.022;
    d = min(d, segment(p, vec2(0.0, y), vec2(0.0, y + 0.05)).x - 0.006);
    dens = clamp(0.5 - d / px, 0.0, 1.0) * 2.0;
  } else {
    float tau = t - hit;
    float grow = 1.0 - exp(-tau * 0.6);
    vec2 c = vec2(0.0, top - 0.04 - 0.5 * (1.0 - exp(-tau * 0.42)));
    float R = 0.05 + 0.2 * uSpread * grow;
    vec2 q = p - c;
    // The vortex ring: two lobes curling in opposite ways, the mushroom cap of sinking ink.
    float spin = uSwirl * 1.7 * (1.0 - exp(-tau * 0.5));
    q = curl(q, vec2(-0.6 * R, -0.15 * R), -spin, R * 0.7);
    q = curl(q, vec2(0.6 * R, -0.15 * R), spin, R * 0.7);
    // Fractal flow tears the edges into tendrils.
    vec2 w = vec2(fbm(q / R * 1.2 + vec2(3.1, -tau * 0.25), 5), fbm(q / R * 1.2 + vec2(7.7 + tau * 0.2, 1.3), 5)) - 0.5;
    q += w * R * (0.4 + 0.35 * uSwirl);
    float e = length(q / vec2(1.0, 0.62)) / R;
    float edge = 0.75 + 0.55 * fbm(normalize(q + 1e-5) * 2.2 + vec2(tau * 0.05, 4.0), 4);
    float cloud = smoothstep(edge, edge * 0.35, e);
    float strands = 1.0 - abs(2.0 * fbm(q / R * 2.6 + 9.0, 5) - 1.0);
    dens = cloud * mix(0.6, 1.5, strands * strands) + 0.3 * smoothstep(edge * 1.4, edge * 0.2, e);
    // Fingers trailing down out of the cap.
    for (int j = 0; j < 5; j++) {
      vec2 h = hash22(vec2(float(j) + 0.5, 4.2));
      float x = (h.x - 0.5) * 1.4 * R;
      float len = R * (0.6 + 1.4 * h.y) * smoothstep(0.3, 3.0, tau);
      vec2 sg = segment(q, vec2(x, -0.3 * R), vec2(x * 1.3, -0.3 * R - len));
      dens += exp(-sg.x * sg.x / (R * R * 0.012)) * (1.0 - sg.y * 0.7) * 0.6;
    }
    // The trail the drop left from the surface down to the cloud.
    vec2 tw = p + (vec2(fbm(p * 9.0 + 2.0, 3), 0.0) - 0.5) * 0.04;
    vec2 sg = segment(tw, vec2(0.0, top), c + vec2(0.0, 0.3 * R));
    dens += exp(-sg.x * sg.x / 0.00006) * 0.5 * exp(-tau * 0.35);
    // The ink spreads thinner as it settles, and the water clears before the drop comes round again.
    dens *= mix(1.3, 0.6, grow) * (1.0 - smoothstep(5.6, 7.5, t));
    if (uSurface) dens *= smoothstep(top + 2.0 * px, top - 2.0 * px, p.y);
    hue = smoothstep(0.35, 0.75, fbm(q / R * 1.5 + 11.0, 3));
  }
  // Ink absorbs light: the denser, the deeper its colour.
  vec3 ink = max(mix(uInk, uInk2, hue), vec3(0.02));
  vec3 col = bg * pow(ink, vec3(dens * uDensity * 1.3));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Paper", values: { uBackground: [0.95, 0.91, 0.84], uInk: [0.1, 0.1, 0.12], uInk2: [0.3, 0.12, 0.1], uSurface: false } },
    { name: "Crimson", values: { uInk: [0.62, 0.05, 0.12], uInk2: [0.95, 0.35, 0.2], uSwirl: 1.6 } },
    { name: "Dark water", values: { uBackground: [0.08, 0.1, 0.14], uInk: [0.3, 0.9, 1], uInk2: [1, 0.4, 0.9], uDensity: 0.6 } },
  ],
};

export const splashCrown: ShaderEffect = {
  kind: "shader",
  id: "splash-crown",
  name: "Splash crown",
  description: "A milk-drop coronet: a drop falls, a crown of liquid rises with beads on its points and falls back into rippling rings.",
  category: "splatter",
  tags: ["splatter", "liquid", "milk", "drop", "slow-motion", "product"],
  loop: 3,
  source: glsl(
    `// Splash crown: a stylised 2.5D milk-drop coronet, rising and falling back on a 3 s loop.
uniform vec3 uLiquid;     // @control color default=#F6F3EC label="Liquid"
uniform vec3 uBackground; // @control color default=#1F4E8C label="Background"
uniform float uHeight;    // @control min=0.4 max=1.6 default=1 label="Crown height"
uniform int uPoints;      // @control min=8 max=24 default=16 label="Crown points"
uniform float uGloss;     // @control min=0 max=1 default=0.8 label="Gloss"`,
    HASH,
    `const float SURFACE = -0.2;
const float SQUASH = 0.3;
const float HIT = 0.6;

// A shaded bead of liquid of radius r at c, painted over col.
vec3 bead(vec3 col, vec2 p, vec2 c, float r, float px) {
  vec2 d = (p - c) / r;
  float m = clamp(0.5 - (length(d) - 1.0) * r / px, 0.0, 1.0);
  if (m <= 0.0) return col;
  vec3 n = vec3(d, sqrt(max(1.0 - dot(d, d), 0.0)));
  vec3 b = uLiquid * (0.55 + 0.45 * max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0));
  b += uGloss * pow(max(dot(n, normalize(vec3(-0.35, 0.5, 1.0))), 0.0), 40.0);
  b = mix(b, uBackground * 0.6 + uLiquid * 0.3, smoothstep(0.75, 1.0, length(d)) * 0.4);
  return mix(col, min(b, vec3(1.0)), m);
}

// The crown's height at an angle round it: a wall rising into points of varied height.
float crownTop(float theta, float h) {
  float n = float(uPoints);
  float f = theta / 6.28318 * n;
  float id = floor(f);
  float w = abs(fract(f) - 0.5) * 2.0;
  float tall = 0.6 + 0.4 * hash12(vec2(mod(id, n), 2.3));
  return h * (0.68 + 0.5 * tall * pow(1.0 - w, 3.0));
}

// Droplets on the crown's points, the far ones (back) or the near ones: they bead up, break off and fall.
vec3 droplets(vec3 col, vec2 p, float tau, float rc, float h, bool back, float px) {
  float n = float(uPoints);
  for (int i = 0; i < 24; i++) {
    if (i >= uPoints) break;
    float th = (float(i) + 0.5) / n * 6.28318;
    float s = sin(th);
    if ((s > 0.0) != back) continue;
    vec2 hh = hash22(vec2(float(i) + 0.5, 7.1));
    float top = crownTop(th, h);
    float r = 0.007 + 0.008 * hh.x;
    float lift = smoothstep(0.08, 0.35, tau);
    float rTip = rc + 0.35 * top;
    vec2 c = vec2(rTip * cos(th), SURFACE + SQUASH * rTip * s + top + r * lift);
    float td = max(tau - (0.35 + 0.15 * hh.y), 0.0);
    // After breaking off: up and outwards, then down under gravity.
    vec2 v = vec2(cos(th) * 0.18, SQUASH * s * 0.18 + 0.35 + 0.2 * hh.y) * uHeight;
    c += v * td - vec2(0.0, 1.6 * td * td);
    if (c.y < SURFACE + SQUASH * rTip * s - 0.01) continue;
    col = bead(col, p, c, r * lift * (1.0 + 0.4 * smoothstep(0.0, 0.2, td)), px);
  }
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = mod(iTime, 3.0);
  float horizon = 0.04;
  // Backdrop and the pool, reflecting the backdrop towards its far edge.
  vec3 col = uBackground * (0.75 + 0.6 * clamp(p.y + 0.2, 0.0, 1.0));
  float fres = smoothstep(horizon - 0.3, horizon, p.y);
  vec3 pool = mix(uLiquid * (0.78 + 0.18 * smoothstep(-0.5, SURFACE, p.y)), uBackground * 0.9 + uLiquid * 0.15, fres * 0.55);
  col = mix(col, pool, smoothstep(horizon + px, horizon - 2.0 * px, p.y));
  float tau = t - HIT;
  if (tau > 0.0) {
    // Ripples spreading over the pool.
    for (int j = 0; j < 3; j++) {
      float rr = 0.09 + (tau - 0.22 * float(j)) * 0.3;
      if (rr < 0.09) continue;
      float de = length(vec2(p.x, (p.y - SURFACE) / SQUASH)) - rr;
      float k = (1.0 - smoothstep(0.4, 2.2, tau)) * (1.0 - 0.25 * float(j)) * step(p.y, horizon);
      col += 0.22 * exp(-de * de / 0.00008) * k;
      col -= uLiquid * 0.12 * exp(-(de + 0.018) * (de + 0.018) / 0.00012) * k;
    }
  }
  float u = tau / 1.15;
  if (u > 0.0 && u < 1.0) {
    float h = 0.2 * uHeight * sin(3.14159 * pow(u, 0.6));
    float rc = 0.06 + 0.1 * (1.0 - exp(-tau * 5.0));
    // The hollow inside the crown.
    float inside = length(vec2(p.x, (p.y - SURFACE) / SQUASH)) / rc;
    col = mix(col, col * 0.78, smoothstep(1.02, 0.95, inside) * smoothstep(0.0, 0.1, h));
    // The crown flares out as it rises: its radius at a pixel's height.
    float r = rc + 0.35 * max(p.y - SURFACE, 0.0);
    float c = p.x / r;
    if (abs(c) < 1.0) {
      float s = sqrt(1.0 - c * c);
      // The far wall, seen from inside.
      float zb = p.y - (SURFACE + SQUASH * r * s);
      float topb = crownTop(atan(s, c), h);
      float mb = clamp(zb / px + 0.5, 0.0, 1.0) * clamp((topb - zb) / px + 0.5, 0.0, 1.0);
      vec3 wallB = uLiquid * (0.6 + 0.25 * (1.0 - s) + 0.15 * smoothstep(0.0, topb, zb));
      col = mix(col, wallB, mb);
      col = droplets(col, p, tau, rc, h, true, px);
      // The near wall: lit from the front, rounder at the sides, thinner and brighter at the top.
      float zf = p.y - (SURFACE - SQUASH * r * s);
      float topf = crownTop(6.28318 - atan(s, c), h);
      float mf = clamp(zf / px + 0.5, 0.0, 1.0) * clamp((topf - zf) / px + 0.5, 0.0, 1.0);
      vec3 wallF = uLiquid * (0.5 + 0.5 * s) * (0.85 + 0.15 * smoothstep(0.0, 0.05, zf));
      wallF += 0.12 * smoothstep(topf - 0.03, topf, zf);
      wallF += uGloss * 0.7 * exp(-(c + 0.45) * (c + 0.45) / 0.01) * smoothstep(0.0, 0.04, zf);
      col = mix(col, min(wallF, vec3(1.0)), mf);
    } else {
      col = droplets(col, p, tau, rc, h, true, px);
    }
    col = droplets(col, p, tau, rc, h, false, px);
  }
  // The falling drop, stretched by its speed.
  if (t < HIT) {
    float y = mix(0.62, SURFACE + 0.02, (t / HIT) * (t / HIT));
    vec2 q = (p - vec2(0.0, y)) * vec2(1.0, 0.8);
    col = bead(col, vec2(0.0, y) + q, vec2(0.0, y), 0.026, px);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Coffee", values: { uLiquid: [0.42, 0.25, 0.14], uBackground: [0.93, 0.87, 0.78], uGloss: 0.6 } },
    { name: "Red paint", values: { uLiquid: [0.86, 0.1, 0.16], uBackground: [0.08, 0.08, 0.1], uPoints: 20, uHeight: 1.3 } },
  ],
};

export const gooSplat: ShaderEffect = {
  kind: "shader",
  id: "goo-splat",
  name: "Goo splat",
  description: "Bright, glossy slime splatting onto the glass with a wobble and running down in drips with fat beads on their ends; clicks splat more.",
  category: "splatter",
  tags: ["splatter", "slime", "goo", "overlay", "click", "interactive", "playful"],
  transparent: true,
  loop: 12,
  source: glsl(
    `// Goo splat: jelly blobs hitting the glass, wobbling, and dripping down; on a loop and at clicks.
uniform vec3 uColorA;     // @control color default=#A3E635 label="Goo 1"
uniform vec3 uColorB;     // @control color default=#F472B6 label="Goo 2"
uniform vec3 uColorC;     // @control color default=#22D3EE label="Goo 3"
uniform float uSize;      // @control min=0.3 max=2.5 default=1 label="Splat size"
uniform float uDrips;     // @control min=0 max=1 default=0.8 label="Drips"
uniform float uFade;      // @control min=2 max=11.5 default=9 label="Fades after (s)"
uniform float uGloss;     // @control min=0 max=1 default=0.9 label="Gloss"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    SMIN,
    SEGMENT,
    OVER,
    SPLATS,
    `// A splat's signed distance in units of its radius, age seconds after it hit.
float gooShape(vec2 q, float seed, float age) {
  // It lands flattened and wobbles back to round.
  float wob = 0.22 * exp(-age * 5.0) * cos(age * 24.0);
  float grow = 1.0 - exp(-age * 16.0);
  vec2 b = q / vec2(1.0 + wob, 1.0 - wob) / mix(0.4, 1.0, grow);
  float d = length(b) - 0.5;
  for (int k = 0; k < 6; k++) {
    vec2 h = hash22(vec2(seed, float(k) + 0.5));
    float a = h.x * 6.28318;
    d = smin(d, length(b - vec2(cos(a), sin(a)) * (0.35 + 0.3 * h.y)) - 0.18 - 0.14 * hash12(h + seed), 0.2);
  }
  d = (d + (vnoise(b * 3.5 + seed) - 0.5) * 0.08) * mix(0.4, 1.0, grow);
  // Drips sliding down from the bottom, slowing as they thin, each with a bead on its end.
  for (int j = 0; j < 5; j++) {
    vec3 h = vec3(hash22(vec2(seed + 2.7, float(j) + 0.5)), hash12(vec2(float(j) * 3.3, seed)));
    if (h.z > uDrips) continue;
    float x = (h.x - 0.5) * 1.1;
    float len = (0.3 + 1.3 * h.y) * (1.0 - exp(-max(age - 0.25, 0.0) * (0.25 + 0.3 * h.y)));
    float w = 0.05 + 0.05 * h.z;
    vec2 top = vec2(x, -0.25 - 0.2 * (1.0 - abs(h.x - 0.5) * 2.0) * 0.5);
    vec2 sg = segment(q, top, top - vec2(0.0, len));
    d = smin(d, sg.x - w * mix(1.0, 0.7, sg.y), 0.12);
    d = smin(d, length(q - top + vec2(0.0, len + w * 0.4)) - w * 1.45, 0.06);
  }
  // A few round blobs thrown off round it.
  for (int k = 0; k < 5; k++) {
    vec3 h = vec3(hash22(vec2(seed + 9.1, float(k) + 0.5)), hash12(vec2(seed, float(k) * 5.1)));
    float a = h.x * 6.28318;
    d = min(d, length(q - vec2(cos(a), sin(a)) * (0.95 + 0.5 * h.y) * grow) - 0.04 - 0.07 * h.z);
  }
  return d;
}

vec3 pick(float h) {
  return h < 0.333 ? uColorA : (h < 0.667 ? uColorB : uColorC);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec3 light = normalize(vec3(-0.45, 0.6, 1.0));
  vec4 acc = vec4(0.0);
  for (int i = 7; i >= 0; i--) {
    float seed;
    vec4 s = splatAt(i, uDemo, 1.5, seed);
    if (s.w < 0.5) continue;
    float age = iTime - s.z;
    if (age < 0.0 || age > uFade) continue;
    float R = 0.1 * uSize * (0.75 + 0.5 * hash12(vec2(seed, 9.1)));
    vec2 q = (p - s.xy * px) / R;
    // Leave room below for the drips.
    if (abs(q.x) > 1.8 || q.y > 1.8 || q.y < -2.3) continue;
    float eps = px / R;
    float d = gooShape(q, seed, age);
    float cover = clamp(0.5 - d * R / px, 0.0, 1.0);
    if (cover <= 0.0) continue;
    vec2 g = vec2(gooShape(q + vec2(eps, 0.0), seed, age), gooShape(q + vec2(0.0, eps), seed, age)) - d;
    g /= eps;
    vec3 n = normalize(vec3(g * exp(d / 0.12) * 1.6, 1.0));
    vec3 goo = pick(hash12(vec2(seed, 5.3)));
    // Jelly: deeper colour where it is thick, light glowing through near the rim, a wet highlight.
    float thick = smoothstep(0.0, -0.25, d);
    vec3 col = mix(goo * 1.15, goo * 0.62, thick * 0.6) * (0.78 + 0.22 * dot(n, light));
    float fresnel = pow(1.0 - n.z, 2.0);
    col = mix(col, vec3(1.0), fresnel * 0.35);
    // A soft shade inside the lower rim, where the goo curls under.
    col *= 1.0 - 0.25 * smoothstep(0.0, 0.6, -n.y) * (1.0 - thick);
    float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
    float sheen = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 6.0);
    col = min(col + uGloss * (spec * 0.9 + sheen * 0.12), vec3(1.0));
    float fade = 1.0 - smoothstep(uFade * 0.6, uFade, age);
    acc = over(acc, col, cover * fade * mix(0.97, 0.86, thick));
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Slime", values: { uColorA: [0.52, 0.9, 0.16], uColorB: [0.4, 0.85, 0.2], uColorC: [0.65, 0.95, 0.3] } },
    { name: "Bubblegum", values: { uColorA: [1, 0.55, 0.78], uColorB: [0.75, 0.6, 1], uColorC: [0.5, 0.85, 1], uDrips: 0.5 } },
    { name: "Big drippy", values: { uSize: 1.8, uDrips: 1, uFade: 11 } },
  ],
};

export const paintRoller: ShaderEffect = {
  kind: "shader",
  id: "paint-roller",
  name: "Paint roller",
  description: "A paint roller sweeping down the frame, laying a new picture or colour over the old with a stippled, textured edge and thin drips running ahead.",
  category: "splatter",
  video: "transition",
  tags: ["splatter", "paint", "transition", "image", "reveal", "slideshow"],
  loop: 6,
  source: glsl(
    `// Paint roller: a roller paints the To picture (or a colour) over the From one, top to bottom, and back again.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uUsePaint;    // @control default=false label="Paint a colour"
uniform vec3 uPaint;       // @control color default=#F2C14E label="Paint colour"
uniform float uStipple;    // @control min=0 max=1 default=0.6 label="Stipple"
uniform float uDrips;      // @control min=0 max=1 default=0.6 label="Drips"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `vec4 paintOf(sampler2D tex, vec2 uv) {
  return uUsePaint ? vec4(uPaint, 1.0) : pictureRGBA(tex, uv);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 P = vec2(uv.x * aspect, uv.y);
  // Two passes a loop: To over From, then From back over To.
  float t = mod(iTime, 6.0);
  bool second = uAnimate && t >= 3.0;
  float prog = uAnimate ? smoothstep(0.25, 2.75, t - (second ? 3.0 : 0.0)) : uProgress;
  vec4 below = second ? paintOf(uTo, uv) : pictureRGBA(uFrom, uv);
  vec4 fresh = second ? pictureRGBA(uFrom, uv) : paintOf(uTo, uv);
  const float RR = 0.04;
  float edge = mix(1.0 + 2.2 * RR, -0.06, prog);
  float seed = second ? 7.0 : 0.0;
  // The roller's edge: wavy where the nap pressed unevenly.
  float nap = vnoise(vec2(P.x * 40.0, P.y * 25.0) + seed);
  float e = edge + 0.012 * (fbm(vec2(P.x * 9.0 + seed, 1.0), 3) - 0.5) + 0.004 * (nap - 0.5);
  float dist = P.y - e;
  float cover = clamp(dist / px + 0.5, 0.0, 1.0);
  // Stipple: near the edge the paint only catches the high points of the wall.
  float grain = vnoise(P * 260.0 + seed) * 0.6 + vnoise(P * 90.0 + seed) * 0.4;
  float s = clamp(dist / (0.09 * uStipple + 1e-3), 0.0, 1.0);
  cover *= smoothstep(-0.06, 0.06, s * 1.2 - grain);
  // Specks flicked ahead of the roller.
  vec2 cell = floor(P * 55.0);
  vec2 hs = hash22(cell + seed);
  float speck = length(P * 55.0 - cell - hs) - 0.06 - 0.12 * hs.x * hs.y;
  float ahead = smoothstep(-0.08, 0.0, dist) * step(0.72, hash12(cell + 3.1 + seed)) * uStipple;
  cover = max(cover, clamp(0.5 - speck / (55.0 * px), 0.0, 1.0) * ahead);
  vec4 col = mix(below, fresh, cover);
  // Wet paint just laid: a sheen and the roller's texture, fading as it dries.
  float wet = exp(-max(dist, 0.0) / 0.12) * step(0.0, dist);
  col.rgb *= 1.0 + 0.08 * (nap - 0.5) * wet;
  col.rgb += 0.05 * wet;
  // The roller, sitting just below the edge, with its soft shadow on the wall ahead.
  float yr = edge - RR + 0.005;
  float under = yr - RR - P.y;
  col.rgb *= 1.0 - 0.35 * exp(-max(under, 0.0) / 0.02) * step(0.0, under);
  // Thin drips of paint hanging from the roller, each ending in a bead.
  float column = floor(P.x / aspect * 16.0);
  vec2 hd = hash22(vec2(column + seed, 2.9));
  if (hd.y < uDrips) {
    float x = (column + 0.25 + 0.5 * hd.x) / 16.0 * aspect;
    float len = 0.015 + 0.1 * hash12(vec2(column, seed + 5.0)) * uDrips * smoothstep(0.0, 0.25, prog);
    float w = 0.0025 + 0.002 * hd.x;
    vec2 a = vec2(x, yr - RR * 0.7);
    vec2 b = vec2(x, a.y - len);
    float hh = clamp((a.y - P.y) / len, 0.0, 1.0);
    float dd = length(P - mix(a, b, hh)) - w * mix(1.4, 0.8, hh);
    dd = min(dd, length(P - b) - w * 1.7);
    float drip = clamp(0.5 - dd / px, 0.0, 1.0);
    vec3 paint = second ? pictureRGBA(uFrom, vec2(uv.x, clamp(edge, 0.0, 1.0))).rgb : paintOf(uTo, vec2(uv.x, clamp(edge, 0.0, 1.0))).rgb;
    paint *= 0.85 + 0.4 * exp(-pow((P.x - x + w * 0.4) / w, 2.0));
    col = mix(col, vec4(min(paint, vec3(1.0)), 1.0), drip);
  }
  float v = (P.y - yr) / RR;
  if (abs(v) < 1.0) {
    float roll = asin(clamp(v, -1.0, 1.0)) + edge * 40.0;
    float fuzz = vnoise(vec2(P.x * 140.0, roll * 5.0)) * 0.6 + vnoise(vec2(P.x * 50.0, roll * 2.0)) * 0.4;
    // Loaded with the paint it lays: the new picture's colours along the edge, mixed together.
    vec3 load = vec3(0.0);
    for (int k = 0; k < 6; k++) {
      vec2 at = vec2((float(k) + 0.5) / 6.0, clamp(edge + 0.04, 0.0, 1.0));
      load += (second ? pictureRGBA(uFrom, at).rgb : paintOf(uTo, at).rgb) / 6.0;
    }
    vec3 r = mix(load, vec3(0.95), 0.1) * (0.35 + 0.65 * sqrt(1.0 - v * v)) * (0.8 + 0.4 * fuzz);
    r += 0.12 * pow(max(1.0 - abs(v - 0.45) * 3.0, 0.0), 2.0);
    float m = clamp((1.0 - abs(v)) * RR / px, 0.0, 1.0);
    col = mix(col, vec4(min(r, vec3(1.0)), 1.0), m);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Yellow wall", values: { uUsePaint: true, uPaint: [0.95, 0.76, 0.31] } },
    { name: "Clean", values: { uStipple: 0.15, uDrips: 0 } },
    { name: "Drippy", values: { uStipple: 1, uDrips: 1 } },
  ],
};

export const waterSplash: ShaderEffect = {
  kind: "shader",
  id: "water-splash",
  name: "Water splash",
  description: "Drops falling onto a water line and throwing up a jet and clear, glinting droplets that arc back down into small ripples.",
  category: "splatter",
  tags: ["splatter", "water", "overlay", "drops", "liquid", "fresh"],
  transparent: true,
  loop: 8,
  source: glsl(
    `// Water splash: drops land on a surface line, throwing up a jet and droplets that fall back, with ripples.
uniform vec3 uTint;       // @control color default=#CDEBFF label="Water"
uniform float uLevel;     // @control min=0.05 max=0.7 default=0.25 label="Surface height"
uniform float uSize;      // @control min=0.4 max=2 default=1 label="Splash size"
uniform int uDrops;       // @control min=4 max=40 default=26 label="Droplets"
uniform float uGravity;   // @control min=0.5 max=2 default=1 label="Gravity"
uniform bool uSurface;    // @control default=true label="Show surface"`,
    HASH,
    SEGMENT,
    OVER,
    `// A clear bead (a capsule from a to b, radius r): a faint tinted body, a darker rim, a caustic and a glint.
vec4 waterBead(vec4 acc, vec2 p, vec2 a, vec2 b, float r, float k, float px) {
  vec2 sg = segment(p, a, b);
  float d = sg.x - r;
  float m = clamp(0.5 - d / px, 0.0, 1.0) * k;
  if (m <= 0.0) return acc;
  vec2 c = mix(a, b, sg.y);
  vec2 n = (p - c) / max(r, 1e-5);
  float rim = smoothstep(0.5, 1.0, length(n));
  float glint = 1.0 - smoothstep(0.0, 0.35, length(n - vec2(-0.35, 0.4)));
  float caustic = 1.0 - smoothstep(0.0, 0.55, length(n - vec2(0.15, -0.45)));
  acc = over(acc, uTint, m * 0.3);
  acc = over(acc, uTint * 0.25, rim * m * 0.45);
  acc = over(acc, mix(uTint, vec3(1.0), 0.7), caustic * m * 0.45);
  return over(acc, vec3(1.0), glint * m * 0.95);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  float level = uLevel;
  float g = 2.0 * uGravity;
  vec4 acc = vec4(0.0);
  if (uSurface) {
    // The water below the line, and the line itself catching the light.
    float below = level - p.y;
    acc = over(acc, uTint, 0.16 * step(0.0, below) * exp(-max(below, 0.0) / 0.25));
    acc = over(acc, vec3(1.0), 0.6 * exp(-abs(below) / (1.2 * px)));
  }
  const float PERIOD = 1.0;
  float t = mod(iTime, 8.0);
  for (int i = -1; i < 3; i++) {
    float k = floor(t / PERIOD) - float(i);
    float slot = mod(k, 8.0);
    float tau = t - k * PERIOD;
    vec2 h = hash22(vec2(slot * 1.71 + 0.3, 5.9));
    vec2 o = vec2((0.12 + 0.76 * h.x) * aspect, level);
    float size = uSize * (0.7 + 0.5 * h.y);
    if (tau < 0.0) {
      // The drop falling in.
      float tb = -tau;
      if (tb > 0.4) continue;
      vec2 c = o + vec2(0.0, 3.2 * tb * tb + 0.01);
      acc = waterBead(acc, p, c, c + vec2(0.0, 0.03 + 0.08 * tb), 0.008 * size, 1.0, px);
      continue;
    }
    if (tau > 2.2) continue;
    // Ripples on the surface: flattened rings spreading out under the line.
    for (int j = 0; j < 2; j++) {
      float rr = (tau - 0.3 * float(j)) * 0.22 * size;
      if (rr <= 0.0) continue;
      float de = length(vec2(p.x - o.x, (p.y - level + 0.012) / 0.18)) - rr;
      float fade = (1.0 - smoothstep(0.3, 2.2, tau)) * step(p.y, level);
      acc = over(acc, vec3(1.0), 0.55 * exp(-de * de / (4.0 * px * px)) * fade);
    }
    // The jet: a column shooting up and breaking into a drop.
    if (tau < 0.7) {
      float hj = 0.2 * size * sin(3.14159 * tau / 0.7);
      acc = waterBead(acc, p, o, o + vec2(0.0, hj), 0.012 * size * (1.0 - 0.5 * tau / 0.7), 1.0, px);
    }
    // Droplets flung up and out, falling back under gravity.
    for (int j = 0; j < 40; j++) {
      if (j >= uDrops) break;
      vec3 hh = vec3(hash22(vec2(float(j) + 0.5, slot * 3.7 + 1.0)), hash12(vec2(slot + 0.3, float(j) * 1.9)));
      float a = (hh.x - 0.5) * 1.9;
      float speed = (0.55 + 0.65 * hh.y) * sqrt(size) * sqrt(uGravity);
      vec2 v = vec2(sin(a) * 0.8, cos(a)) * speed;
      float td = tau - 0.03 * hh.z;
      if (td <= 0.0) continue;
      vec2 c = o + v * td - vec2(0.0, 0.5 * g * td * td);
      if (c.y < level) continue;
      vec2 vel = v - vec2(0.0, g * td);
      if (abs(p.x - c.x) > 0.06 || abs(p.y - c.y) > 0.06) continue;
      float r = (0.0035 + 0.009 * hh.z * hh.z) * size;
      acc = waterBead(acc, p, c, c - vel * 0.022, r, smoothstep(level, level + 0.01, c.y), px);
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Big splash", values: { uSize: 1.8, uDrops: 40, uGravity: 0.8 } },
    { name: "No surface", values: { uSurface: false, uLevel: 0.15, uTint: [1, 1, 1] } },
  ],
};

/** The splatter shaders: paint, ink, liquid crowns, goo, a paint roller and water. */
export const splatterShaders: ShaderEffect[] = [paintSplatter, inkSplash, splashCrown, gooSplat, paintRoller, waterSplash];
