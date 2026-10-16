import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/**
 * Weather: rain streaks, a thunderstorm, a rainbow over a picture, wind
 * gusts and hail. The overlays (rain, wind, hail) draw on clear, so they
 * lay over any picture or page; particles live in grid cells, each cell
 * holding at most one, so a pixel looks at a few cells rather than at every
 * particle.
 */

export const rainStreaks: ShaderEffect = {
  kind: "shader",
  id: "rain-streaks",
  name: "Rain streaks",
  description: "Rain falling in slanted streaks at several depths, splashing where it meets a ground line, to lay over any scene.",
  category: "weather",
  tags: ["weather", "rain", "storm", "overlay", "particles", "moody"],
  transparent: true,
  source: glsl(
    `// Rain streaks: layers of streaks in sheared grid cells (far layers finer, slower and fainter), and splashes
// (a ring and a few flying droplets) in cells along the ground line.
uniform vec3 uColor;      // @control color default=#D4E4FF label="Colour"
uniform float uDensity;   // @control min=0 max=1 default=0.55 label="Density"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uWind;      // @control min=-1 max=1 default=0.18 label="Wind (slant)"
uniform float uLength;    // @control min=0.2 max=3 default=1 label="Streak length"
uniform int uLayers;      // @control min=1 max=5 default=4 label="Layers"
uniform float uGround;    // @control min=0 max=0.6 default=0.1 label="Ground line"
uniform float uSplashes;  // @control min=0 max=1 default=0.8 label="Splashes"
uniform float uOpacity;   // @control min=0 max=1 default=0.75 label="Opacity"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float a = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uLayers) break;
    float depth = (float(i) + 1.0) / float(uLayers);
    // Columns per screen height, and how long a cell is (in columns).
    float cols = mix(70.0, 18.0, depth);
    float cellH = 6.0;
    // Shear so streaks slant with the wind.
    vec2 q = vec2(p.x - (p.y - uGround) * uWind, p.y);
    float fall = iTime * uSpeed * mix(1.4, 3.2, depth);
    float column = floor(q.x * cols + float(i) * 7.3);
    // Each column's cells start at a height of their own, so streaks never line up in rows.
    vec2 g = vec2(q.x * cols + float(i) * 7.3, (q.y + fall) * cols / cellH + hash12(vec2(column, float(i))));
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float h = hash12(cell + float(i) * 13.1);
    if (h > uDensity) continue;
    float x = 0.2 + 0.6 * hash12(cell + 3.3);
    float len = clamp(0.35 * uLength * mix(0.6, 1.0, depth) * (0.7 + 0.6 * hash12(cell + 5.7)), 0.05, 0.95);
    float top = 0.05 + (0.95 - len) * hash12(cell + 9.1);
    // Distance across the streak in pixels (a column is iResolution.y / cols pixels wide).
    float across = abs(f.x - x) / (px * cols);
    float width = mix(0.5, 1.4, depth);
    float along = (f.y - top) / len;
    float body = step(0.0, along) * step(along, 1.0) * pow(1.0 - along, 0.6) * smoothstep(0.0, 0.15, along);
    float streak = (1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, across)) * body;
    // Rain stops at the ground.
    streak *= step(uGround, p.y);
    a = max(a, streak * mix(0.25, 0.9, depth));
  }
  // Splashes along the ground: a flattened ring spreading and droplets thrown up.
  if (uSplashes > 0.0) {
    for (int k = 0; k < 2; k++) {
      float w = 0.045;
      float sx = p.x / w + float(k) * 0.5;
      float cell = floor(sx);
      float period = 0.45 + 0.5 * hash12(vec2(cell, float(k)));
      float time = iTime * uSpeed + hash12(vec2(cell, 7.0 + float(k))) * period;
      float cycle = floor(time / period);
      float age = fract(time / period) * period;
      if (hash12(vec2(cell, cycle + float(k) * 19.0)) > uSplashes * uDensity * 1.4) continue;
      vec2 centre = vec2((cell + 0.25 + 0.5 * hash12(vec2(cell, cycle + 2.0)) - float(k) * 0.5) * w, uGround);
      vec2 d = p - centre;
      float life = smoothstep(0.25, 0.0, age);
      // The ring, flattened by perspective.
      float r = 0.004 + age * 0.08;
      float ring = abs(length(d * vec2(1.0, 3.5)) - r);
      a = max(a, (1.0 - smoothstep(0.6 * px, 1.8 * px, ring)) * life * 0.7 * step(-0.003, d.y));
      // Droplets.
      for (int j = 0; j < 3; j++) {
        float fj = float(j);
        float vx = (fj - 1.0) * 0.12 + (hash12(vec2(cell, fj + cycle)) - 0.5) * 0.06;
        float vy = 0.22 + 0.12 * hash12(vec2(cell + 4.0, fj + cycle));
        vec2 at = centre + vec2(vx * age, vy * age - 2.2 * age * age);
        float drop = 1.0 - smoothstep(0.8 * px, 2.0 * px, length(p - at));
        a = max(a, drop * life * step(uGround - 0.002, at.y) * 0.9);
      }
    }
  }
  fragColor = vec4(uColor, a * uOpacity);
}`,
  ),
  presets: [
    { name: "Drizzle", values: { uDensity: 0.25, uSpeed: 0.7, uLength: 0.6, uWind: 0.05, uOpacity: 0.55 } },
    { name: "Downpour", values: { uDensity: 0.9, uSpeed: 1.6, uLength: 1.6, uWind: 0.35, uLayers: 5 } },
    { name: "No splashes", values: { uSplashes: 0, uGround: 0 } },
  ],
};

export const thunderstorm: ShaderEffect = {
  kind: "shader",
  id: "thunderstorm",
  name: "Thunderstorm",
  description: "Dark, roiling storm clouds lit from inside by flickering lightning, with bolts to the ground and driving rain.",
  category: "weather",
  tags: ["weather", "storm", "lightning", "clouds", "rain", "dramatic", "background"],
  source: glsl(
    `// Thunderstorm: domain-warped fbm clouds, flashes in random slots that light the clouds around a point
// (more where they are thin), a jagged bolt to the ground for some, and two layers of rain.
uniform vec3 uSky;         // @control color default=#10131C label="Sky"
uniform vec3 uCloud;       // @control color default=#454C5E label="Cloud"
uniform vec3 uFlash;       // @control color default=#D6DEFF label="Flash"
uniform vec3 uRainColor;   // @control color default=#9AA8C4 label="Rain"
uniform float uFrequency;  // @control min=0 max=2 default=0.5 label="Flashes per second"
uniform float uRain;       // @control min=0 max=1 default=0.6 label="Rain"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Cloud speed"
uniform bool uBolts;       // @control default=true label="Bolts"`,
    HASH,
    NOISE,
    FBM,
    `// The flash in slot k: its brightness now, where (x), and whether it strikes the ground.
vec3 flashAt(float slot, float t) {
  float h = hash12(vec2(slot, 1.7));
  if (h > 0.7) return vec3(0.0);
  float start = hash12(vec2(slot, 4.1)) * 0.5;
  float tau = t - start;
  if (tau < 0.0) return vec3(0.0);
  // A few flickers: a bright strike, a dip, a restrike, then fading.
  float b = exp(-tau * 9.0) + 0.7 * exp(-max(tau - 0.12, 0.0) * 12.0) * step(0.12, tau) + 0.4 * exp(-max(tau - 0.3, 0.0) * 6.0) * step(0.3, tau);
  return vec3(b, hash12(vec2(slot, 9.3)), step(0.45, hash12(vec2(slot, 2.2))));
}

float rain(vec2 p, float cols, float speed, float slant, float seed) {
  vec2 q = vec2(p.x + p.y * slant, p.y + iTime * speed);
  vec2 g = vec2(q.x * cols + seed, q.y * cols / 8.0);
  vec2 c = floor(g);
  vec2 f = fract(g);
  if (hash12(c + seed) > uRain) return 0.0;
  float x = 0.2 + 0.6 * hash12(c + 1.3);
  float across = abs(f.x - x) * iResolution.y / cols;
  float y0 = hash12(c + 2.9) * 0.5;
  float body = smoothstep(y0, y0 + 0.1, f.y) * smoothstep(y0 + 0.5, y0 + 0.3, f.y);
  return (1.0 - smoothstep(0.4, 1.4, across)) * body;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed * 0.05;

  // Clouds: warped fbm, thickest overhead, with a ragged base.
  vec2 cp = vec2(p.x, p.y * 1.6) * 1.6;
  vec2 warp = vec2(fbm(cp + vec2(t, 0.0), 4), fbm(cp + vec2(5.2, 1.3) - vec2(0.0, t * 0.7), 4));
  float dens = fbm(cp + 1.8 * warp + vec2(t * 2.0, 0.0), 5);
  float base = smoothstep(0.25, 0.75, uv.y + 0.35 * (dens - 0.5));
  float cloud = clamp(smoothstep(0.35, 0.68, dens) * 0.75 + base * 0.6, 0.0, 1.0);
  // Light from above: thick cloud is dark below.
  float shade = fbm(cp + 1.8 * warp + vec2(t * 2.0, 0.03), 5) - dens;
  vec3 col = mix(uSky * 0.7, uCloud * clamp(0.55 + 5.0 * shade + 0.45 * uv.y, 0.15, 1.6), cloud);

  // Lightning: one possible flash in each slot.
  float slotLen = 1.0 / max(uFrequency, 0.01);
  float slot = floor(iTime / slotLen);
  vec3 fl = flashAt(slot, iTime - slot * slotLen);
  if (uFrequency > 0.0 && fl.x > 0.002) {
    vec2 at = vec2((0.1 + 0.8 * fl.y) * aspect, 0.72 + 0.15 * hash12(vec2(slot, 6.6)));
    float d = length(p - at);
    float glow = exp(-d * 3.2);
    // Light scatters through the cloud: brightest at the source, more where the cloud is thinner.
    col += uFlash * fl.x * glow * (0.35 + 0.9 * cloud * (1.2 - dens)) * 1.6;
    col += uFlash * fl.x * 0.12;
    if (uBolts && fl.z > 0.5) {
      // A jagged bolt from the cloud base to the ground, with one fork.
      float y = p.y;
      float jag = (fbm(vec2(y * 5.0, slot * 3.1), 4) - 0.5) * 0.35 + (vnoise(vec2(y * 40.0, slot)) - 0.5) * 0.03;
      float x = at.x + jag;
      float dx = abs(p.x - x);
      float span = step(y, at.y) * smoothstep(-0.02, 0.05, y);
      float core = (1.0 - smoothstep(0.6 * px, 2.2 * px, dx)) * span;
      float halo = exp(-dx * 60.0) * span * 0.5;
      float forkY = at.y - 0.2 - 0.15 * hash12(vec2(slot, 8.8));
      float fx = x + (forkY - y) * (0.3 * sign(hash12(vec2(slot, 3.3)) - 0.5)) + (vnoise(vec2(y * 30.0, slot + 9.0)) - 0.5) * 0.04;
      float fork = (1.0 - smoothstep(0.5 * px, 1.6 * px, abs(p.x - fx))) * step(y, forkY) * step(forkY - 0.18, y) * smoothstep(forkY - 0.18, forkY - 0.1, y);
      float strike = smoothstep(0.25, 0.6, fl.x);
      col += (vec3(1.0) * (core + fork * 0.8) + uFlash * halo) * strike * 1.5;
    }
  }
  // The land: a dark ridge lit by the flash.
  float ridge = 0.08 + 0.04 * fbm(vec2(p.x * 3.0, 1.0), 4);
  col = mix(col, uSky * 0.35 + uFlash * fl.x * 0.15, 1.0 - smoothstep(ridge - px, ridge + px, p.y));
  // Rain.
  float r = max(rain(p, 60.0, 2.6, 0.12, 0.0) * 0.5, rain(p, 24.0, 3.6, 0.15, 17.0));
  col = mix(col, uRainColor * (1.0 + fl.x), r * 0.3);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Distant storm", values: { uFrequency: 0.25, uRain: 0.2, uBolts: false } },
    { name: "Supercell", values: { uSky: [0.08, 0.1, 0.1], uCloud: [0.3, 0.38, 0.36], uFlash: [0.85, 0.8, 1], uFrequency: 1.2, uRain: 0.9, uSpeed: 2 } },
  ],
};

export const rainbow: ShaderEffect = {
  kind: "shader",
  id: "rainbow",
  name: "Rainbow",
  description: "A soft rainbow arc fading in over a picture as if after rain, with a faint second bow and optional sun rays.",
  category: "weather",
  video: "filter",
  tags: ["weather", "rainbow", "image", "light", "hopeful", "spring"],
  source: glsl(
    `// Rainbow: a primary bow (red outside, violet inside) and a fainter reversed secondary over the picture,
// brighter inside the primary and darker between them, fading in over time, with optional sun rays.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec2 uCentre;       // @control min=-1 max=2 default=0.5,-0.35 label="Bow centre"
uniform float uRadius;      // @control min=0.2 max=2 default=0.95 label="Radius"
uniform float uWidth;       // @control min=0.01 max=0.3 default=0.07 label="Width"
uniform float uStrength;    // @control min=0 max=1.5 default=0.65 label="Strength"
uniform float uSecondary;   // @control min=0 max=1 default=0.35 label="Second bow"
uniform float uDelay;       // @control min=0 max=10 default=0.5 label="Fade-in delay (s)"
uniform float uFade;        // @control min=0 max=10 default=3 label="Fade-in time (s)"
uniform float uRays;        // @control min=0 max=1 default=0.35 label="Sun rays"
uniform vec2 uSun;          // @control min=-0.5 max=1.5 default=0.1,1.05 label="Sun position"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `// Spectrum across a bow: 0 inside (violet) to 1 outside (red), soft at both edges.
vec3 spectrum(float x) {
  float h = (1.0 - x) * 0.78;
  vec3 c = clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return c * smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 c = vec2(uCentre.x * aspect, uCentre.y);
  float r = length(p - c);
  float appear = uFade <= 0.0 ? step(uDelay, iTime) : smoothstep(uDelay, uDelay + uFade, iTime);
  // Bows fade toward the ground and shimmer faintly.
  float ground = smoothstep(0.0, 0.35, uv.y);
  float shimmer = 0.85 + 0.15 * vnoise(vec2(atan(p.y - c.y, p.x - c.x) * 6.0, iTime * 0.3));
  float x1 = (r - (uRadius - uWidth)) / uWidth;
  vec3 bow = spectrum(x1);
  float r2 = uRadius * 1.27;
  float x2 = 1.0 - (r - r2) / (uWidth * 1.6);
  bow += spectrum(x2) * uSecondary * 0.6;
  // Brighter sky inside the primary, darker between the bows.
  float inside = smoothstep(uRadius - uWidth, uRadius - uWidth - 0.25, r) * step(0.0, uRadius - uWidth - r) * 0.12;
  float between = smoothstep(uRadius, uRadius + 0.02, r) * smoothstep(r2 - uWidth * 1.6, r2 - uWidth * 1.6 - 0.02, r) * 0.08;
  float amount = appear * ground * shimmer * uStrength;
  vec3 col = pic.rgb;
  col = 1.0 - (1.0 - col) * (1.0 - bow * amount);
  col += inside * amount * 0.8;
  col *= 1.0 - between * amount;
  // Sun rays fanning from the sun.
  if (uRays > 0.0) {
    vec2 s = vec2(uSun.x * aspect, uSun.y);
    vec2 d = p - s;
    float ang = atan(d.y, d.x);
    float rays = vnoise(vec2(ang * 9.0, iTime * 0.15)) * vnoise(vec2(ang * 23.0 + 4.0, iTime * 0.1));
    float fall = exp(-length(d) * 1.4);
    col += vec3(1.0, 0.93, 0.75) * (smoothstep(0.15, 0.6, rays) * 0.7 + 0.3) * fall * uRays * appear * 0.7;
  }
  fragColor = vec4(min(col, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Double rainbow", values: { uSecondary: 1, uStrength: 0.9, uWidth: 0.08 } },
    { name: "Low and wide", values: { uCentre: [0.5, -0.8], uRadius: 1.35, uWidth: 0.09, uRays: 0 } },
  ],
};

export const windGust: ShaderEffect = {
  kind: "shader",
  id: "wind-gust",
  name: "Wind gust",
  description: "Gusts of wind sweeping across: curling wind lines with leaves and dust tumbling along, to lay over any scene.",
  category: "weather",
  tags: ["weather", "wind", "leaves", "autumn", "overlay", "particles"],
  transparent: true,
  source: glsl(
    `// Wind gust: wind lines (curving segments sliding along rows), leaves (tumbling ellipses with a vein) and
// dust carried in cells by the wind's integrated push, all swelling with each gust.
uniform vec3 uLineColor;   // @control color default=#FFFFFF label="Wind lines"
uniform vec3 uLeafA;       // @control color default=#E0892E label="Leaf colour A"
uniform vec3 uLeafB;       // @control color default=#9BB13E label="Leaf colour B"
uniform vec3 uDustColor;   // @control color default=#D6C5A4 label="Dust"
uniform float uStrength;   // @control min=0 max=2 default=1 label="Strength"
uniform float uDirection;  // @control min=-1 max=1 default=1 step=2 label="Direction"
uniform float uGustRate;   // @control min=0.05 max=1 default=0.25 label="Gusts per second"
uniform float uLines;      // @control min=0 max=1 default=0.7 label="Wind lines"
uniform float uLeaves;     // @control min=0 max=1 default=0.5 label="Leaves"
uniform float uDust;       // @control min=0 max=1 default=0.5 label="Dust"`,
    HASH,
    `const float TAU = 6.28318;

// The gust at time t: 0.25 calm to 1 at its peak.
float gust(float t) {
  float s = 0.5 + 0.5 * sin(t * uGustRate * TAU);
  return 0.25 + 0.75 * s * s;
}
// How far the wind has pushed by time t (the integral of gust: s² = 3/8 + sin/2 − cos(2x)/8).
float pushed(float t) {
  float w = uGustRate * TAU;
  float x = t * w;
  return 0.25 * t + 0.75 * (0.375 * t - 0.5 * cos(x) / w - 0.125 * sin(2.0 * x) / (2.0 * w));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float dir = uDirection < 0.0 ? -1.0 : 1.0;
  p.x *= dir;
  float aspect = iResolution.x / iResolution.y;
  vec4 acc = vec4(0.0);

  // Wind lines: each row holds a curved segment sliding fast along it, shown while the gust passes.
  if (uLines > 0.0) {
    for (int k = 0; k < 2; k++) {
      float rows = k == 0 ? 9.0 : 15.0;
      float y = p.y * rows + float(k) * 0.5;
      float row = floor(y);
      float h = hash12(vec2(row, float(k)));
      float speed = (1.2 + 0.8 * h) * uStrength;
      float lag = iTime - p.x * 0.35;
      float g = gust(lag);
      float u = p.x * 0.7 - iTime * speed * 0.6 - h * 9.0;
      float seg = floor(u);
      float fu = fract(u);
      if (hash12(vec2(seg, row + float(k) * 5.0)) > uLines * 0.7) continue;
      float len = 0.25 + 0.3 * hash12(vec2(seg, row + 1.0));
      float along = fu / len;
      if (along > 1.0) continue;
      // A gentle wave and, now and then, a curl at the head.
      float curve = 0.25 * sin(p.x * 5.0 + h * 6.0 + iTime * 0.5) + 0.12 * sin(p.x * 13.0 + h * 3.0);
      float curl = step(0.75, hash12(vec2(seg, row + 3.0))) * smoothstep(0.65, 1.0, along) * 0.45 * sin((along - 0.65) * 14.0);
      float centre = row + 0.5 + curve + curl;
      float d = abs(y - centre) / (rows * px);
      float taper = smoothstep(0.0, 0.3, along) * smoothstep(1.0, 0.75, along);
      float line = (1.0 - smoothstep(0.9, 2.2, d)) * taper * mix(0.25, 1.0, smoothstep(0.3, 0.9, g)) * (k == 0 ? 0.85 : 0.5);
      acc.rgb = mix(acc.rgb, uLineColor, line);
      acc.a = max(acc.a, line);
    }
  }

  // Leaves and dust carried by the wind's push.
  float push = pushed(iTime) * uStrength;
  for (int k = 0; k < 3; k++) {
    bool leaf = k < 2;
    float amount = leaf ? uLeaves : uDust;
    if (amount <= 0.0) continue;
    float scale = k == 0 ? 5.0 : k == 1 ? 8.0 : 22.0;
    float speed = k == 0 ? 0.9 : k == 1 ? 0.65 : 1.2;
    vec2 q = p * scale;
    q.x -= push * speed * scale * 0.55;
    q.y += sin(iTime * 0.8 + q.x * 0.3) * 0.3 + iTime * 0.15 * scale * 0.1;
    vec2 cell = floor(q);
    float h = hash12(cell + float(k) * 11.0);
    if (h > amount * (leaf ? 0.45 : 0.5)) continue;
    vec2 at = 0.25 + 0.5 * hash22(cell + float(k));
    // Tumbling and bobbing within the cell.
    float spin = iTime * (1.5 + 3.0 * hash12(cell + 2.0)) * (0.5 + gust(iTime)) + h * 20.0;
    at += 0.15 * vec2(sin(spin * 0.7), cos(spin * 0.9));
    vec2 d = fract(q) - at;
    if (leaf) {
      float c = cos(spin), s = sin(spin);
      d = mat2(c, s, -s, c) * d;
      // The tumble foreshortens the leaf.
      d.y /= max(abs(sin(spin * 0.6)), 0.25);
      float size = 0.18 + 0.08 * hash12(cell + 4.0);
      vec2 e = d / vec2(size, size * 0.45);
      float r = length(e) - (1.0 - 0.35 * abs(e.x));
      float aa = px * scale / size * 1.5;
      float shape = 1.0 - smoothstep(-aa, aa, r);
      vec3 colour = mix(uLeafA, uLeafB, hash12(cell + 6.0)) * (0.8 + 0.3 * sign(sin(spin * 0.6)));
      float vein = (1.0 - smoothstep(0.0, 0.08, abs(e.y))) * step(abs(e.x), 0.85) * 0.3;
      colour *= 1.0 - vein;
      acc.rgb = mix(acc.rgb, colour, shape);
      acc.a = max(acc.a, shape);
    } else {
      // Dust: short streaks along the wind.
      float len = 0.06 + 0.1 * gust(iTime);
      float dd = length(vec2(d.x / (1.0 + len * 12.0), d.y));
      float speck = (1.0 - smoothstep(0.02, 0.05, dd)) * 0.55 * smoothstep(0.3, 0.6, gust(iTime - p.x * 0.35));
      acc.rgb = mix(acc.rgb, uDustColor, speck * (1.0 - acc.a));
      acc.a = max(acc.a, speck);
    }
  }
  fragColor = vec4(acc.rgb, acc.a);
}`,
  ),
  presets: [
    { name: "Autumn", values: { uLeaves: 0.85, uLines: 0.4, uDust: 0.2 } },
    { name: "Dust storm", values: { uLeaves: 0, uDust: 1, uLines: 0.9, uStrength: 1.8, uLineColor: [0.9, 0.82, 0.68], uDustColor: [0.8, 0.66, 0.45] } },
    { name: "Breeze", values: { uLeaves: 0.2, uDust: 0, uLines: 0.5, uStrength: 0.6, uGustRate: 0.12 } },
  ],
};

export const hail: ShaderEffect = {
  kind: "shader",
  id: "hail",
  name: "Hail",
  description: "Hailstones pelting down and bouncing on a ground line, each bounce lower than the last, to lay over any scene.",
  category: "weather",
  tags: ["weather", "hail", "ice", "storm", "overlay", "particles", "physics"],
  transparent: true,
  source: glsl(
    `// Hail: stones on cycles in columns, each falling under gravity, bouncing three times on the ground line
// with a loss of speed each time and scattering sideways, then melting away. A pixel checks its column and
// its neighbours (stones scatter into them), two stones each.
uniform vec3 uColor;      // @control color default=#EEF4FA label="Colour"
uniform vec3 uShade;      // @control color default=#9FB4CC label="Shade"
uniform float uDensity;   // @control min=0 max=1 default=0.6 label="Density"
uniform float uSize;      // @control min=0.3 max=2.5 default=1 label="Size"
uniform float uGround;    // @control min=0 max=0.6 default=0.12 label="Ground line"
uniform float uBounce;    // @control min=0 max=0.8 default=0.42 label="Bounciness"
uniform float uSpeed;     // @control min=0 max=2 default=1 label="Speed"`,
    HASH,
    `const float G = 3.2;
const float TOP = 1.1;

// A stone's place at local time tau (x offset from its column, height), its fall speed, and how visible it is.
vec4 stoneAt(float tau, float r, float drift) {
  float h0 = TOP - uGround - r;
  float tf = sqrt(2.0 * h0 / G);
  if (tau < tf) return vec4(0.0, TOP - 0.5 * G * tau * tau, G * tau, 1.0);
  float v = G * tf;
  float t = tau - tf;
  float x = 0.0;
  // Each bounce: up at v·e, back down after 2v·e/G, drifting sideways.
  for (int b = 0; b < 3; b++) {
    v *= uBounce;
    float d = 2.0 * v / G;
    if (t < d) return vec4(drift * (x + t), uGround + r + v * t - 0.5 * G * t * t, abs(v - G * t), 1.0);
    t -= d;
    x += d;
  }
  // At rest, melting away.
  return vec4(drift * x, uGround + r, 0.0, 1.0 - smoothstep(0.2, 0.7, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float w = 0.035;
  float col0 = floor(p.x / w);
  vec4 acc = vec4(0.0);
  for (int c = -1; c <= 1; c++) {
    float column = col0 + float(c);
    for (int k = 0; k < 2; k++) {
      vec2 id = vec2(column, float(k));
      float period = 1.3 + 1.2 * hash12(id);
      float time = iTime * uSpeed + hash12(id + 3.1) * period;
      float cycle = floor(time / period);
      float tau = time - cycle * period;
      vec2 seed = id + cycle * 7.13;
      if (hash12(seed + 1.9) > uDensity) continue;
      float r = (0.008 + 0.009 * hash12(seed + 5.5)) * uSize;
      float drift = (hash12(seed + 8.2) - 0.5) * 0.25;
      vec4 s = stoneAt(tau, r, drift);
      if (s.w <= 0.0) continue;
      vec2 centre = vec2((column + 0.2 + 0.6 * hash12(seed + 2.4)) * w + s.x, s.y);
      vec2 d = p - centre;
      // Stretched a little along the fall when moving fast.
      d.y /= 1.0 + min(s.z * 0.12, 0.6);
      float dist = length(d);
      float disc = 1.0 - smoothstep(r - px, r + px, dist);
      if (disc <= 0.0) continue;
      // Lit from the upper left, with a hard highlight.
      vec2 n = d / r;
      float light = clamp(0.6 - 0.5 * dot(n, vec2(0.6, -0.6)), 0.0, 1.0);
      vec3 colour = mix(uShade, uColor, light);
      colour += smoothstep(0.35, 0.1, length(n - vec2(-0.35, 0.35))) * 0.5;
      float a = disc * s.w * 0.95;
      acc.rgb = mix(acc.rgb, colour, a);
      acc.a = max(acc.a, a);
    }
  }
  fragColor = vec4(min(acc.rgb, 1.0), acc.a);
}`,
  ),
  presets: [
    { name: "Light hail", values: { uDensity: 0.3, uSize: 0.7, uBounce: 0.3 } },
    { name: "Golf balls", values: { uDensity: 0.45, uSize: 2.2, uBounce: 0.5, uSpeed: 0.8 } },
  ],
};

export const weatherShaders: readonly ShaderEffect[] = [rainStreaks, thunderstorm, rainbow, windGust, hail];
