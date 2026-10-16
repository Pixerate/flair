import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/**
 * Water: an open ocean, an underwater view, ripples over a picture and a
 * waterfall. The ocean is a heightfield of sharp-crested waves met between
 * the planes of its highest and lowest points; the rest are 2D.
 */

export const oceanWaves: ShaderEffect = {
  kind: "shader",
  id: "ocean-waves",
  name: "Ocean waves",
  description: "An open ocean at sunset or by day: layered, sharp-crested waves rolling in, foam on the crests, the sky in the water and a glint of sun.",
  category: "water",
  tags: ["water", "ocean", "sea", "waves", "sunset", "nature", "3d", "background"],
  source: glsl(
    `// Ocean waves: a sum of sharp-crested waves (e^(sin x − 1), each layer's position dragged by the last),
// met by marching only between the planes of its highest and lowest points (16 steps and 4 secant steps),
// with more layers for the normal. Fresnel mixes the reflected sky with light scattered through the crests.
uniform vec3 uSkyTop;      // @control color default=#27325E label="Sky (top)"
uniform vec3 uSkyHorizon;  // @control color default=#FF9B5C label="Sky (horizon)"
uniform vec3 uSun;         // @control color default=#FFD38A label="Sun"
uniform vec3 uWater;       // @control color default=#0A2638 label="Water"
uniform vec3 uFoam;        // @control color default=#F2EEE6 label="Foam"
uniform float uSunHeight;  // @control min=-0.1 max=1.2 default=0.06 label="Sun height"
uniform float uSunAzimuth; // @control min=-1 max=1 default=0 label="Sun direction"
uniform float uWaveHeight; // @control min=0 max=2.5 default=1 label="Wave height"
uniform float uChoppiness; // @control min=0 max=2 default=1 label="Choppiness"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uFoamAmount; // @control min=0 max=1 default=0.5 label="Foam"`,
    HASH,
    NOISE,
    `const float AMP = 1.1;

// The sea's height (about 0–1) at p from its first n wave layers.
float sea(vec2 p, int n) {
  float t = iTime * uSpeed;
  float h = 0.0;
  float total = 0.0;
  float a = 1.0;
  float k = 0.26;
  float ang = 0.3;
  for (int i = 0; i < 18; i++) {
    if (i >= n) break;
    vec2 d = vec2(cos(ang), sin(ang));
    float x = dot(d, p) * k + t * sqrt(9.8 * k) * 0.55;
    float e = exp(sin(x) - 1.0);
    h += a * e;
    total += a;
    // Drag the next layers toward this one's crests, so the crests gather.
    p += d * e * cos(x) * a * 0.35 * uChoppiness;
    a *= 0.76;
    k *= 1.24;
    ang += 2.39996;
  }
  return h / total;
}

float heightAt(vec2 p, int n) {
  return (sea(p, n) - 0.42) * AMP * uWaveHeight;
}

vec3 sky(vec3 rd, vec3 sun) {
  float y = max(rd.y, 0.0);
  vec3 c = mix(uSkyHorizon, uSkyTop, pow(y, 0.5));
  float mu = max(dot(rd, sun), 0.0);
  c += uSun * (pow(mu, 8.0) * 0.35 + pow(mu, 90.0) * 0.6);
  c += uSun * smoothstep(0.9993, 0.9997, mu) * 3.0;
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 1.6 + 0.4 * uWaveHeight, iTime * uSpeed * 0.6);
  vec3 rd = normalize(vec3(p.x, p.y - 0.12, 1.2));
  vec3 sun = normalize(vec3(sin(uSunAzimuth), uSunHeight, cos(uSunAzimuth)));
  vec3 col = sky(rd, sun);

  float top = AMP * uWaveHeight * 0.6;
  float bottom = -AMP * uWaveHeight * 0.45;
  if (rd.y < -0.0005) {
    // Between the planes of the highest and lowest water.
    float t0 = (top - ro.y) / rd.y;
    float t1 = min((bottom - ro.y) / rd.y, 400.0);
    float tPrev = t0;
    float gPrev = top - heightAt(ro.xz + rd.xz * t0, 7);
    float t = t0;
    float dt = (t1 - t0) / 16.0;
    float tHit = t1;
    for (int i = 1; i <= 16; i++) {
      t = t0 + dt * float(i);
      vec3 pos = ro + rd * t;
      float g = pos.y - heightAt(pos.xz, 7);
      if (g < 0.0) {
        // Secant steps between the last point above and this one below.
        float a = tPrev, b = t, ga = gPrev, gb = g;
        for (int j = 0; j < 4; j++) {
          float m = a + (b - a) * ga / (ga - gb);
          vec3 q = ro + rd * m;
          float gm = q.y - heightAt(q.xz, 7);
          if (gm > 0.0) {
            a = m;
            ga = gm;
          } else {
            b = m;
            gb = gm;
          }
        }
        tHit = a + (b - a) * ga / (ga - gb);
        break;
      }
      tPrev = t;
      gPrev = g;
    }
    vec3 pos = ro + rd * tHit;
    // The normal from more wave layers, finer up close.
    int fine = tHit < 30.0 ? 13 : 9;
    float e = 0.008 * tHit + 0.01;
    float h = heightAt(pos.xz, fine);
    vec3 n = normalize(vec3(h - heightAt(pos.xz + vec2(e, 0.0), fine), e, h - heightAt(pos.xz + vec2(0.0, e), fine)));
    // Far away the waves blur into a flatter surface.
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(30.0, 200.0, tHit)));
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 r = reflect(rd, n);
    r.y = abs(r.y);
    vec3 refl = sky(r, sun);
    float crest = clamp(h / (AMP * max(uWaveHeight, 0.05)) + 0.3, 0.0, 1.0);
    // Light through the crests, toward the sun.
    float through = pow(max(dot(rd, sun) * 0.5 + 0.5, 0.0), 3.0) * crest;
    vec3 water = uWater * (0.35 + 0.65 * max(dot(n, sun), 0.0)) + mix(uWater * 3.0, uSun * 0.6, 0.3) * through * 0.6;
    col = mix(water, refl, fres);
    // Glint.
    col += uSun * pow(max(dot(r, sun), 0.0), 700.0) * 6.0 * smoothstep(-0.1, 0.1, uSunHeight);
    // Foam on the crests, broken up by noise.
    float foamNoise = vnoise(pos.xz * 3.0 + iTime * 0.3) * vnoise(pos.xz * 7.0 - iTime * 0.2);
    float foam = smoothstep(0.55, 0.85, crest + foamNoise * 0.6 - (1.0 - uFoamAmount) * 0.5) * uFoamAmount;
    col = mix(col, uFoam * (0.5 + 0.5 * max(dot(n, sun), 0.3)) * mix(vec3(1.0), uSkyHorizon, 0.25), foam * smoothstep(80.0, 20.0, tHit));
    // Haze toward the horizon.
    col = mix(col, sky(vec3(rd.x, 0.0, rd.z), sun), smoothstep(0.0, 1.0, 1.0 - exp(-tHit * 0.006)));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Sunset", values: { uSunHeight: 0.06 } },
    {
      name: "Day",
      values: {
        uSkyTop: [0.22, 0.48, 0.85],
        uSkyHorizon: [0.8, 0.9, 0.97],
        uSun: [1, 0.97, 0.9],
        uWater: [0.03, 0.22, 0.32],
        uSunHeight: 0.55,
        uSunAzimuth: 0.4,
      },
    },
    { name: "Stormy sea", values: { uSkyTop: [0.2, 0.23, 0.27], uSkyHorizon: [0.5, 0.53, 0.55], uSun: [0.6, 0.62, 0.65], uWater: [0.05, 0.1, 0.12], uSunHeight: 0.3, uWaveHeight: 2.2, uChoppiness: 1.6, uFoamAmount: 0.9, uSpeed: 1.4 } },
  ],
};

export const underwaterScene: ShaderEffect = {
  kind: "shader",
  id: "underwater-scene",
  name: "Underwater scene",
  description: "Looking out under water: shafts of light from the rippling surface, caustics dancing on a sandy floor, drifting particles and deep blue fog.",
  category: "water",
  tags: ["water", "underwater", "ocean", "sea", "caustics", "light", "background"],
  source: glsl(
    `// Underwater scene: a sandy floor met analytically with caustic lines (ridges of warped noise), the surface
// above shimmering inside its bright window, light shafts as streaks of noise fanning down, particles in layers.
uniform vec3 uDeep;        // @control color default=#021E33 label="Deep water"
uniform vec3 uShallow;     // @control color default=#13708A label="Shallow water"
uniform vec3 uLight;       // @control color default=#C8F6FF label="Light"
uniform vec3 uSand;        // @control color default=#C6B188 label="Sand"
uniform float uShafts;     // @control min=0 max=1.5 default=0.7 label="Light shafts"
uniform float uCaustics;   // @control min=0 max=1.5 default=0.8 label="Caustics"
uniform float uParticles;  // @control min=0 max=1 default=0.6 label="Particles"
uniform float uFog;        // @control min=0 max=2 default=1 label="Fog"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"`,
    HASH,
    NOISE,
    `// Bright lines where light gathers: the ridges of two layers of warped noise, multiplied.
float caustic(vec2 p, float t) {
  vec2 w = vec2(vnoise(p * 0.7 + t * 0.3), vnoise(p * 0.7 - t * 0.25 + 5.0));
  vec2 q = p + w * 1.6;
  float a = 1.0 - abs(vnoise(q + t * 0.4) * 2.0 - 1.0);
  float b = 1.0 - abs(vnoise(q * 1.7 - t * 0.35 + 3.0) * 2.0 - 1.0);
  return pow(a, 6.0) + pow(b, 6.0) * 0.7 + pow(a * b, 4.0) * 1.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  vec3 ro = vec3(0.0, 0.0, t * 0.15);
  vec3 rd = normalize(vec3(p.x, p.y + 0.08, 1.0));
  // The water itself: lighter looking up.
  vec3 water = mix(uDeep, uShallow, smoothstep(-0.45, 0.7, rd.y));
  vec3 col = water;
  float fogK = 0.09 * uFog;

  if (rd.y < 0.0) {
    // The floor: sand in low dunes, lit by caustics, fading into the blue.
    float tf = -3.0 / rd.y;
    vec3 pos = ro + rd * tf;
    float dunes = vnoise(pos.xz * 0.35) * 0.6 + vnoise(pos.xz * 1.3) * 0.25 + vnoise(pos.xz * 6.0) * 0.08;
    vec3 sand = uSand * (0.55 + 0.5 * dunes);
    float c = caustic(pos.xz * 0.9, t * 0.8);
    // Fine caustics turn to an even glow far away.
    c = mix(c, 0.5, smoothstep(10.0, 30.0, tf));
    sand += uLight * c * 0.55 * uCaustics;
    sand *= mix(uShallow * 1.5, vec3(1.0), 0.4);
    col = mix(water, sand, exp(-tf * fogK));
  } else {
    // The surface: a bright, rippling window overhead.
    float ts = 4.0 / max(rd.y, 0.05);
    vec2 sp = (ro + rd * ts).xz;
    float ripple = caustic(sp * 0.6, t * 1.2);
    float window = smoothstep(0.35, 0.8, rd.y);
    col += uLight * (0.25 + 0.6 * ripple) * window * exp(-ts * 0.04);
  }

  // Light shafts fanning down from the surface, swaying.
  float ang = (p.x - 0.35 * p.y) / (1.3 - p.y);
  float shafts = vnoise(vec2(ang * 9.0 + t * 0.15, t * 0.1)) * vnoise(vec2(ang * 23.0 - t * 0.1, 3.0 + t * 0.12));
  shafts = smoothstep(0.12, 0.6, shafts);
  col += uLight * shafts * smoothstep(-0.55, 0.45, p.y) * 0.35 * uShafts;

  // Drifting particles: far ones small and dim, near ones larger and soft.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = mix(28.0, 8.0, fi / 2.0);
    vec2 q = p * scale + vec2(t * 0.05 * (fi + 1.0), t * (0.08 + 0.05 * fi)) + fi * 17.0;
    vec2 cell = floor(q);
    if (hash12(cell + fi) > uParticles * 0.5) continue;
    vec2 at = 0.2 + 0.6 * hash22(cell + 3.0 * fi);
    at += 0.15 * vec2(sin(t * 0.7 + hash12(cell) * 6.28), cos(t * 0.5 + hash12(cell + 1.0) * 6.28));
    float d = length(fract(q) - at) / (scale * px);
    float size = mix(0.8, 3.0, fi / 2.0) * (0.6 + 0.8 * hash12(cell + 5.0));
    col += uLight * (1.0 - smoothstep(size * 0.4, size + 0.8, d)) * mix(0.25, 0.45, fi / 2.0);
  }
  // Darker at the edges and bottom, like a lens in water.
  col *= 1.0 - 0.35 * dot(p, p);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Tropical", values: { uDeep: [0.0, 0.25, 0.35], uShallow: [0.1, 0.65, 0.7], uSand: [0.95, 0.88, 0.7], uFog: 0.6, uCaustics: 1.1 } },
    { name: "Murky", values: { uDeep: [0.02, 0.07, 0.05], uShallow: [0.12, 0.25, 0.18], uLight: [0.75, 0.9, 0.7], uSand: [0.4, 0.38, 0.3], uFog: 1.8, uShafts: 1.1, uParticles: 1 } },
  ],
};

export const pondRipples: ShaderEffect = {
  kind: "shader",
  id: "pond-ripples",
  name: "Pond ripples",
  description: "Raindrops landing on a picture as if it lay under a pond, each spreading rings that bend the picture beneath; clicks drop stones that ripple wider.",
  category: "water",
  video: "filter",
  tags: ["water", "ripples", "rain", "pond", "image", "distortion", "interactive", "click"],
  source: glsl(
    `// Pond ripples: drops on cycles in grid cells (a pixel sums its own and the eight around it), clicks as larger
// drops (iClicks), each a damped ring whose slope bends the picture and catches a highlight.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uRain;        // @control min=0 max=1 default=0.55 label="Rain"
uniform float uSize;        // @control min=0.3 max=2 default=1 label="Ripple size"
uniform float uStrength;    // @control min=0 max=2 default=1 label="Refraction"
uniform float uSpeed;       // @control min=0 max=3 default=1 label="Speed"
uniform vec3 uTint;         // @control color default=#BFD8E4 label="Water tint"
uniform float uTintAmount;  // @control min=0 max=1 default=0.12 label="Tint amount"
uniform bool uDemo;         // @control default=true label="Demo when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `const float CELL = 0.22;

// The slope (gradient of the water's height) of one ring: centre c, age in seconds, size and strength.
vec2 ring(vec2 p, vec2 c, float age, float speed, float life, float amp) {
  if (age < 0.0 || age > life) return vec2(0.0);
  vec2 d = p - c;
  float r = length(d);
  float front = age * speed;
  float x = r - front;
  float width = 0.025 * uSize + age * 0.012;
  float k = 6.28318 / (0.035 * uSize + age * 0.01);
  float env = exp(-x * x / (width * width)) * (1.0 - age / life) * smoothstep(0.0, 0.04, age);
  // d/dr of sin(k x)·env, about k·cos(k x)·env for narrow rings.
  float slope = (k * cos(k * x) - 2.0 * x / (width * width) * sin(k * x)) * env * amp;
  return d / max(r, 1e-4) * slope;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float t = iTime * uSpeed;
  vec2 grad = vec2(0.0);

  // Rain: one drop per cell per cycle.
  if (uRain > 0.0) {
    vec2 base = floor(p / CELL);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = base + vec2(float(i), float(j));
        float period = mix(3.5, 0.9, uRain) * (0.7 + 0.6 * hash12(cell));
        float time = t + hash12(cell + 4.2) * period;
        float cycle = floor(time / period);
        float age = time - cycle * period;
        if (hash12(cell + cycle * 3.7) > 0.35 + 0.65 * uRain) continue;
        vec2 c = (cell + 0.15 + 0.7 * hash22(cell + cycle)) * CELL;
        grad += ring(p, c, age, 0.12 * uSize, min(period, 1.6), 0.0012 * uSize);
      }
    }
  }
  // Clicks drop stones; while nobody has clicked, the demo drops one now and then.
  if (iClicks[0].w > 0.5 || !uDemo) {
    for (int i = 0; i < 8; i++) {
      vec4 c = iClicks[i];
      if (c.w < 0.5) continue;
      grad += ring(p, c.xy * px, (iTime - c.z) * uSpeed, 0.2 * uSize, 3.0, 0.004 * uSize);
    }
  } else {
    float k = floor(t / 3.0);
    vec2 at = vec2((0.2 + 0.6 * hash12(vec2(k, 1.0))) * iResolution.x * px, 0.25 + 0.5 * hash12(vec2(k, 2.0)));
    grad += ring(p, at, t - k * 3.0, 0.2 * uSize, 3.0, 0.004 * uSize);
  }

  vec2 offset = grad * 0.6 * uStrength;
  offset.x *= iResolution.y / iResolution.x;
  vec4 pic = pictureRGBA(uImage, uv - offset);
  vec3 col = mix(pic.rgb, pic.rgb * uTint * 1.2, uTintAmount);
  // A highlight on the slopes facing the light, and a little shade on the others.
  vec3 n = normalize(vec3(-grad * 1.5, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.6, 0.65));
  float lit = dot(n, l) - l.z;
  col += vec3(1.0) * pow(max(lit, 0.0), 1.5) * 0.9;
  col *= 1.0 + min(lit, 0.0) * 0.6;
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Drizzle", values: { uRain: 0.25, uSize: 0.7 } },
    { name: "Downpour", values: { uRain: 1, uSize: 0.8, uStrength: 1.3, uTintAmount: 0.2 } },
    { name: "Stones only", values: { uRain: 0 } },
  ],
};

export const waterfall: ShaderEffect = {
  kind: "shader",
  id: "waterfall",
  name: "Waterfall",
  description: "A stylised waterfall pouring over a cliff between mossy rocks into a churning plunge pool, wrapped in rising mist.",
  category: "water",
  tags: ["water", "waterfall", "nature", "mist", "landscape", "background"],
  source: glsl(
    `// Waterfall: a curtain of streaks (noise stretched down, scrolling faster as it falls) between noise-edged
// cliffs, foam where it lands in the pool, rings spreading across the pool and fbm mist rising around the foot.
uniform vec3 uSky;        // @control color default=#A9D3EE label="Sky"
uniform vec3 uRock;       // @control color default=#4A443E label="Rock"
uniform vec3 uFoliage;    // @control color default=#3E6B3C label="Foliage"
uniform vec3 uWater;      // @control color default=#CDEFFA label="Falling water"
uniform vec3 uPool;       // @control color default=#2D7591 label="Pool"
uniform float uWidth;     // @control min=0.1 max=0.8 default=0.32 label="Width"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uMist;      // @control min=0 max=1.5 default=0.8 label="Mist"`,
    HASH,
    NOISE,
    FBM,
    `const float LIP = 0.74;
const float POOL = 0.24;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float t = iTime * uSpeed;

  // Sky and distant hills.
  vec3 col = mix(uSky * 1.08, uSky * 0.85, uv.y);
  float hills = 0.83 + 0.05 * fbm(vec2(p.x * 2.0, 3.0), 4);
  col = mix(col, mix(uFoliage, uSky, 0.55), step(uv.y, hills));

  // The cliff: rock on both sides of the fall, its top edge ragged with foliage.
  float half_ = uWidth * 0.5 * aspect * 0.5;
  float edgeNoise = (fbm(vec2(p.y * 8.0, 1.0), 3) - 0.5) * 0.06;
  float fallEdge = abs(p.x) - half_ - edgeNoise - (LIP - p.y) * 0.03;
  float cliffTop = LIP + 0.03 + 0.04 * fbm(vec2(p.x * 4.0, 7.0), 3);
  if (p.y < cliffTop) {
    float strata = fbm(vec2(p.x * 3.0, p.y * 14.0), 4);
    vec3 rock = uRock * (0.6 + 0.7 * strata) * (0.75 + 0.35 * smoothstep(0.0, 0.3, fallEdge));
    // Moss and leaves on ledges and along the top.
    float moss = smoothstep(0.55, 0.7, fbm(p * 9.0, 4)) + smoothstep(cliffTop - 0.08, cliffTop - 0.01, p.y);
    rock = mix(rock, uFoliage * (0.7 + 0.5 * fbm(p * 30.0, 2)), clamp(moss, 0.0, 1.0) * 0.85);
    col = rock;
  }

  // The falling water, in front of the cliff between its edges.
  float inFall = smoothstep(px * 2.0, -px * 2.0, fallEdge) * step(POOL - 0.02, p.y) * step(p.y, LIP + 0.012);
  if (inFall > 0.0) {
    float drop = max(LIP - p.y, 0.0);
    // Water speeds up as it falls: the scroll stretches toward the bottom.
    float s = pow(drop, 0.7) * 6.0 - t * 1.6;
    float streaks = vnoise(vec2(p.x * 70.0, s * 3.0)) * 0.6 + vnoise(vec2(p.x * 160.0 + 3.0, s * 5.0)) * 0.4;
    float sheets = vnoise(vec2(p.x * 12.0, s * 1.2));
    vec3 w = mix(uWater * 0.65, uWater * 1.1, smoothstep(0.3, 0.8, streaks * 0.7 + sheets * 0.5));
    // The lip: water bulges over the edge, bright.
    w += vec3(0.25) * smoothstep(LIP - 0.04, LIP, p.y);
    // Darker gaps near the edges where the curtain thins.
    float thin = smoothstep(-0.06, 0.0, fallEdge + streaks * 0.03);
    w = mix(w, col, thin * 0.6);
    col = mix(col, w, inFall);
  }

  // The plunge pool.
  if (p.y < POOL) {
    float depth = (POOL - p.y) / POOL;
    float z = 1.0 / (0.05 + depth);
    vec2 q = vec2(p.x * z * 0.6, z);
    float waves = vnoise(vec2(q.x * 5.0, q.y * 2.0 - t * 0.6)) * 0.5 + vnoise(vec2(q.x * 13.0, q.y * 5.0 + t * 0.3)) * 0.5;
    vec3 pool = uPool * (0.7 + 0.5 * waves) + mix(uSky, vec3(1.0), 0.3) * smoothstep(0.6, 0.85, waves) * 0.3;
    // Rings spreading from where the water lands.
    float rings = sin(length(vec2(p.x / max(half_ * 1.4, 0.05), (POOL - p.y) * 6.0)) * 9.0 - t * 4.0);
    pool += uWater * smoothstep(0.7, 1.0, rings) * 0.12 * (1.0 - depth);
    col = pool;
  }

  // Foam where the curtain lands, churning.
  float foamZone = exp(-pow((p.y - POOL) / 0.05, 2.0)) * smoothstep(half_ * 1.6, half_ * 0.6, abs(p.x));
  float churn = fbm(vec2(p.x * 14.0, p.y * 18.0 - t * 1.5), 4);
  col = mix(col, uWater * 1.15, clamp(foamZone * (0.6 + churn), 0.0, 1.0));

  // Mist rising from the foot.
  vec2 mp = vec2(p.x * 2.5, (p.y - POOL) * 3.0 - t * 0.25);
  float mist = fbm(mp + vec2(fbm(mp + t * 0.05, 3), 0.0), 5);
  float around = exp(-pow((p.y - POOL - 0.08) / 0.2, 2.0)) * smoothstep(half_ * 3.5, half_ * 0.5, abs(p.x));
  col = mix(col, vec3(0.95, 0.98, 1.0), clamp(smoothstep(0.35, 0.8, mist) * around * uMist, 0.0, 0.85));
  // Spray droplets thrown up.
  vec2 g = vec2(p.x * 90.0, (p.y + t * 0.05) * 90.0);
  vec2 cell = floor(g);
  float spray = step(0.93, hash12(cell)) * (1.0 - smoothstep(0.1, 0.35, length(fract(g) - 0.5)));
  col += spray * around * 0.5 * uMist;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Jungle", values: { uSky: [0.75, 0.9, 0.85], uRock: [0.25, 0.27, 0.22], uFoliage: [0.18, 0.45, 0.2], uPool: [0.12, 0.45, 0.4], uMist: 1.2 } },
    { name: "Dusk", values: { uSky: [0.95, 0.6, 0.5], uRock: [0.22, 0.18, 0.2], uFoliage: [0.2, 0.22, 0.25], uWater: [0.95, 0.85, 0.85], uPool: [0.3, 0.25, 0.4] } },
  ],
};

export const waterShaders: readonly ShaderEffect[] = [oceanWaves, underwaterScene, pondRipples, waterfall];
