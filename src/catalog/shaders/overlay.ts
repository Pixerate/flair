import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

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

export const rainOnGlass: ShaderEffect = {
  kind: "shader",
  id: "rain-on-glass",
  name: "Rain on glass",
  description: "Raindrops sliding down a window in fits and starts, leaving beaded trails behind them.",
  category: "overlay",
  tags: ["overlay", "rain", "weather", "moody", "window", "glass"],
  transparent: true,
  source: glsl(
    `// Rain on glass: drops sliding down a pane, leaving trails of beads.
uniform float uDensity;   // @control min=0 max=1 default=0.7 label="Density"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uSize;      // @control min=0.5 max=2 default=1 label="Drop size"
uniform vec3 uTint;       // @control color default=#CFE3F0 label="Tint"`,
    HASH,
    OVER,
    `// One drop of radius r at offset d: a glassy body, crisp meniscus rim, bottom caustic and bright pinpoint highlight.
vec4 paintDrop(vec4 acc, vec2 d, float r, float px) {
  float dist = length(d);
  if (dist > r + px) return acc;
  float m = (1.0 - smoothstep(r - 1.4 * px, r, dist)) * smoothstep(0.0, 1.8 * px, r);
  vec2 n = d / max(r, 1e-5);
  float l = length(n);
  float rim = smoothstep(0.55, 0.96, l) * m;
  float spec = pow(max(0.0, 1.0 - length(n - vec2(-0.32, 0.36)) * 3.2), 2.0) * m;
  float caustic = pow(max(0.0, 1.0 - length(n - vec2(0.18, -0.48)) * 2.0), 2.0) * m;
  acc = over(acc, uTint * 0.85, m * 0.16);
  acc = over(acc, vec3(0.0, 0.03, 0.08), rim * 0.55);
  acc = over(acc, mix(uTint, vec3(1.0), 0.72), caustic * 0.48);
  return over(acc, vec3(1.0), spec * 0.95);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = iTime * uSpeed;
  vec4 acc = vec4(0.0);

  // Condensation: still beads slowly forming and drying up in two sizes.
  for (int cLayer = 0; cLayer < 2; cLayer++) {
    float cl = float(cLayer);
    float beads = (cLayer == 0 ? 34.0 : 19.0) / uSize;
    vec2 bq = p * beads + cl * 5.3;
    vec2 bid = floor(bq);
    vec2 bh = hash22(bid + cl * 11.1);
    float life = fract(iTime * 0.04 + bh.x * 7.0);
    float br = (0.14 + 0.2 * bh.y) / beads * sin(3.14159 * life);
    if (hash12(bid + 5.0 + cl * 7.0) < uDensity * (cLayer == 0 ? 1.0 : 0.45)) {
      acc = paintDrop(acc, (fract(bq) - 0.5 - (bh - 0.5) * 0.42) / beads, br, px);
    }
  }

  // Running drops: one per cell at most, sliding down a wavy path with a glistening streak and beaded trail.
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 cell = vec2(0.12, 0.3) * uSize * (1.0 - 0.3 * fi);
    vec2 q = p / cell + vec2(fi * 3.7, 0.0);
    float column = floor(q.x);
    q.y += t * 0.15 + hash12(vec2(column, fi)) * 9.0;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 h = hash22(id + fi * 17.0);
    if (h.x > uDensity) continue;
    float tt = t * 1.2 + h.y * 6.28318;
    float y = -0.38 * sin(tt + sin(tt + sin(tt) * 0.5));
    float base = (h.y - 0.5) * 0.3;
    float wobble = h.x * 6.28318;
    float x = base + 0.03 * sin(y * 9.0 + wobble);
    float aspect = cell.x / cell.y;
    float r = cell.y * (0.055 + 0.042 * fract(h.x * 13.7));
    vec2 d = vec2((f.x - x) * aspect, f.y - y) * cell.y;
    // Teardrop taper: slightly elongated at the top, plump at the bottom.
    d.x *= 1.0 + 0.22 * clamp(d.y / max(r, 1e-5), 0.0, 1.0);
    d.y *= d.y > 0.0 ? 0.68 : 1.05;
    acc = paintDrop(acc, d, r, px);
    if (f.y > y) {
      float txPath = base + 0.03 * sin(f.y * 9.0 + wobble);
      float streakDist = abs((f.x - txPath) * aspect) * cell.y;
      float fade = 1.0 - clamp((f.y - y) / (0.5 - y), 0.0, 1.0);
      float streak = exp(-streakDist / max(r * 0.28, px)) * fade * 0.22;
      acc = over(acc, mix(uTint, vec3(1.0), 0.45), streak);

      float rows = 11.0;
      float row = floor(f.y * rows);
      float tx = base + 0.03 * sin((row + 0.5) / rows * 9.0 + wobble);
      vec2 bd = vec2((f.x - tx) * aspect, (fract(f.y * rows) - 0.5) / rows) * cell.y;
      float keep = step(0.3, hash12(id * 3.1 + vec2(row, fi)));
      acc = paintDrop(acc, bd, r * 0.36 * fade * keep, px);
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Storm", values: { uDensity: 1, uSpeed: 1.8, uSize: 1.3 } },
    { name: "Drizzle", values: { uDensity: 0.4, uSpeed: 0.6, uSize: 0.7 } },
  ],
};

export const snowfall: ShaderEffect = {
  kind: "shader",
  id: "snowfall",
  name: "Snowfall",
  description: "Layers of snowflakes drifting down on the wind, the far ones smaller and softer.",
  category: "overlay",
  tags: ["overlay", "snow", "winter", "festive", "particles"],
  transparent: true,
  source: glsl(
    `// Snowfall: layered flakes drifting with the wind, far layers smaller and blurrier.
uniform vec3 uColor;      // @control color default=#FFFFFF label="Colour"
uniform float uDensity;   // @control min=0 max=1 default=0.6 label="Density"
uniform float uWind;      // @control min=-2 max=2 default=0.3 label="Wind"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Fall speed"
uniform float uSize;      // @control min=0.2 max=2 default=1 label="Size"
uniform int uLayers;      // @control min=1 max=6 default=4 label="Layers"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float px = 1.0 / iResolution.y;
  float a = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uLayers) break;
    float fi = float(i);
    // Layer 0 is the farthest: smaller, slower, softer and fainter.
    float depth = (fi + 1.0) / float(uLayers);
    float scale = mix(22.0, 6.0, depth);
    vec2 vel = vec2(uWind * 0.12 * (0.4 + depth), -uSpeed * mix(0.06, 0.25, depth));
    vec2 q = (p - vel * iTime) * scale + fi * 11.3;
    vec2 id = floor(q);
    vec2 h = hash22(id);
    if (hash12(id + 3.7) > uDensity) continue;
    float phase = iTime * (0.4 + 0.6 * h.x) + h.y * 6.28318;
    vec2 centre = (h - 0.5) * 0.3 + vec2(sin(phase) * 0.12, cos(phase * 0.7) * 0.05);
    vec2 dp = fract(q) - 0.5 - centre;
    float d = length(dp);
    float r = 0.065 * uSize * (0.55 + 0.85 * hash12(id + 9.1));
    // Soft downy bokeh falloff with subtle 6-fold crystalline shimmer on closer flakes.
    float glow = exp(-d * d / max(r * r * 0.65, 1e-5));
    float soft = max(px * scale * 1.6, r * mix(0.95, 0.55, depth));
    float core = 1.0 - smoothstep(r * 0.25, r + soft * 0.4, d);
    float crystal = mix(1.0, 0.86 + 0.14 * cos(atan(dp.y, dp.x) * 6.0 + phase), smoothstep(0.45, 1.0, depth));
    float flake = clamp(mix(core, glow, 0.55) * crystal, 0.0, 1.0);
    a = max(a, flake * mix(0.38, 0.95, depth));
  }
  fragColor = vec4(uColor, a);
}`,
  ),
  presets: [
    { name: "Dust motes", values: { uColor: [1, 0.85, 0.63], uDensity: 0.25, uWind: 0.05, uSpeed: 0.08, uSize: 0.6, uLayers: 3 } },
    { name: "Blizzard", values: { uDensity: 0.9, uWind: 1.6, uSpeed: 2, uLayers: 6 } },
  ],
};

export const lensFlare: ShaderEffect = {
  kind: "shader",
  id: "lens-flare",
  name: "Lens flare",
  description: "An anamorphic lens flare: a long horizontal streak and a chain of ghosts through the centre, following the pointer.",
  category: "overlay",
  tags: ["overlay", "cinematic", "light", "interactive", "sci-fi"],
  transparent: true,
  source: glsl(
    `// Lens flare: an anamorphic streak and ghosts along the line through the centre.
uniform vec2 uSource;     // @control min=-1 max=1 default=-0.45,0.4 label="Source"
uniform vec3 uColor;      // @control color default=#FFC98A label="Colour"
uniform float uStreak;    // @control min=0 max=2 default=1 label="Streak length"
uniform float uIntensity; // @control min=0 max=2 default=1 label="Intensity"`,
    HASH,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 src = iMouse.z > 0.0
    ? (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y
    : uSource * vec2(aspect, 1.0) * 0.5;
  vec2 d = p - src;
  float r = length(d);
  float ang = atan(d.y, d.x);
  // Subtle 6-point optical starburst around the bright source.
  float spikes = pow(max(0.0, cos(ang * 3.0)), 14.0) * exp(-r * 10.0) * 0.45;
  vec3 col = uColor * (exp(-r * 20.0) * 1.5 + 0.015 / (r + 0.015) * 0.3 + spikes);
  // The anamorphic streak: a bright thin line and a wider, fainter one, blue-shifted.
  vec3 streakColor = mix(uColor, vec3(0.45, 0.65, 1.0), 0.6);
  float len = uStreak + 1e-3;
  col += streakColor * exp(-abs(d.y) * 220.0) * exp(-abs(d.x) / (0.5 * len));
  col += streakColor * 0.4 * exp(-abs(d.y) * 60.0) * exp(-abs(d.x) / (0.25 * len));
  // Ghosts sit on the line from the source through the centre, with chromatic iris rings.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float along = mix(-1.6, 0.6, hash12(vec2(fi, 1.7)));
    float gr = mix(0.015, 0.11, hash12(vec2(fi, 4.1)));
    float gd = length(p - src * along);
    vec3 tint = mix(uColor, vec3(0.4, 0.85, 1.0), hash12(vec2(fi, 8.3)));
    float disc = (1.0 - smoothstep(gr * 0.55, gr, gd)) * (0.09 + 0.05 * smoothstep(gr * 0.4, gr * 0.9, gd));
    vec3 chromRing = vec3(
      exp(-abs(gd - gr * 1.04) * 95.0),
      exp(-abs(gd - gr) * 95.0),
      exp(-abs(gd - gr * 0.96) * 95.0)
    ) * 0.2;
    col += hash12(vec2(fi, 2.9)) > 0.55 ? mix(tint, vec3(1.0), 0.25) * chromRing : tint * disc;
  }
  fragColor = glow(col * uIntensity);
}`,
  ),
  presets: [
    { name: "Sci-fi blue", values: { uColor: [0.5, 0.7, 1], uStreak: 1.8 } },
    { name: "Golden hour", values: { uColor: [1, 0.7, 0.28], uStreak: 0.6, uIntensity: 1.3 } },
  ],
};

export const vignetteGrain: ShaderEffect = {
  kind: "shader",
  id: "vignette-grain",
  name: "Vignette & grain",
  description: "Darkened corners and fine animated film grain to lay over any picture.",
  category: "overlay",
  tags: ["overlay", "cinematic", "film", "grain", "vintage"],
  transparent: true,
  source: glsl(
    `// Vignette & grain: darkened corners and fine grain, nothing else.
uniform float uStrength;  // @control min=0 max=1 default=0.6 label="Strength"
uniform float uRoundness; // @control min=0 max=1 default=0.5 label="Roundness"
uniform float uSoftness;  // @control min=0.05 max=1 default=0.5 label="Softness"
uniform float uGrain;     // @control min=0 max=0.3 default=0.08 label="Grain"
uniform float uGrainSize; // @control min=1 max=4 default=1.5 label="Grain size (px)"`,
    HASH,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float aspect = iResolution.x / iResolution.y;
  // 0 at the centre, 1 at the edges; rounder shapes measure across the frame's aspect.
  vec2 q = abs(fragCoord / iResolution.xy - 0.5) * 2.0;
  q.x *= mix(1.0, aspect, uRoundness * 0.5);
  float n = mix(8.0, 2.0, uRoundness);
  float dist = pow(pow(q.x, n) + pow(q.y, n), 1.0 / n);
  float dark = smoothstep(1.25 - uSoftness * 1.2, 1.3, dist) * uStrength;
  vec4 acc = over(vec4(0.0), vec3(0.0), dark);
  float frame = mod(floor(iTime * 24.0), 64.0);
  vec2 gc = floor(fragCoord / uGrainSize) + frame * vec2(17.31, 31.73);
  // Triangular-distributed film grain (softer than raw uniform salt-and-pepper noise).
  float g = (hash12(gc) + hash12(gc + 41.7) - 1.0) * 0.5;
  vec3 grainCol = g > 0.0 ? vec3(0.95, 0.93, 0.88) : vec3(0.04, 0.04, 0.06);
  acc = over(acc, grainCol, abs(g) * uGrain * 2.1);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Subtle", values: { uStrength: 0.35, uGrain: 0.04 } },
    { name: "Gritty", values: { uStrength: 0.8, uSoftness: 0.3, uGrain: 0.18, uGrainSize: 2 } },
  ],
};

export const scanlineSweep: ShaderEffect = {
  kind: "shader",
  id: "scanline-sweep",
  name: "Scanline sweep",
  description: "A bright scanning line with a glow and fading trail passing across, like a scanner or hologram.",
  category: "overlay",
  tags: ["overlay", "scan", "hologram", "sci-fi", "tech"],
  transparent: true,
  source: glsl(
    `// Scanline sweep: a glowing line with a faint trail crossing the frame at intervals.
uniform float uAngle;     // @control min=0 max=360 default=270 label="Direction (°)"
uniform float uSpeed;     // @control min=0.1 max=3 default=1 label="Speed"
uniform float uWidth;     // @control min=0.001 max=0.05 default=0.006 label="Width"
uniform vec3 uColor;      // @control color default=#4FF0FF label="Colour"
uniform float uInterval;  // @control min=0 max=5 default=1 label="Pause (s)"
uniform float uTrail;     // @control min=0 max=1 default=0.5 label="Trail"`,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  float s = dot(p, dir);
  // Start and end far enough past the frame that the trail has gone before the next pass.
  float trailLength = 0.02 + 0.2 * uTrail;
  float reach = 0.5 * (abs(dir.x) * aspect + abs(dir.y)) + uWidth * 6.0 + trailLength * 4.0;
  float sweep = 1.5 / uSpeed;
  float k = mod(iTime, sweep + uInterval) / sweep;
  float d = s - mix(-reach, reach, k);
  float core = 1.0 - smoothstep(uWidth * 0.5, uWidth * 0.5 + px, abs(d));
  float halo = exp(-abs(d) / (uWidth * 3.5)) * 0.65;
  float trail = d < 0.0 ? exp(d / trailLength) * 0.4 * uTrail : 0.0;
  float shimmer = 0.72 + 0.28 * sin(fragCoord.y * 2.0) * (0.85 + 0.15 * sin(fragCoord.x * 0.4 + iTime * 10.0));
  trail *= shimmer;
  vec3 beam = mix(uColor, vec3(1.0), core * 0.6) * (core * 1.6 + halo) + uColor * trail;
  fragColor = glow(beam);
}`,
  ),
  presets: [
    { name: "Hologram", values: { uAngle: 90, uColor: [0.3, 1, 0.6], uSpeed: 0.6, uInterval: 0, uTrail: 0.9 } },
    { name: "Barcode scanner", values: { uAngle: 0, uColor: [1, 0.15, 0.15], uSpeed: 2, uInterval: 0.2, uWidth: 0.003 } },
  ],
};

export const spotlight: ShaderEffect = {
  kind: "shader",
  id: "spotlight",
  name: "Spotlight",
  description: "Darkness everywhere but a soft circle of light that follows the pointer or wanders on its own.",
  category: "overlay",
  tags: ["overlay", "interactive", "reveal", "focus", "dramatic"],
  transparent: true,
  source: glsl(
    `// Spotlight: dark everywhere but a soft circle, at the pointer or drifting.
uniform float uRadius;    // @control min=0.05 max=0.8 default=0.25 label="Radius"
uniform float uSoftness;  // @control min=0 max=1 default=0.4 label="Softness"
uniform float uDarkness;  // @control min=0 max=1 default=0.85 label="Darkness"
uniform float uSpeed;     // @control min=0 max=2 default=0.3 label="Drift speed"
uniform vec3 uShade;      // @control color default=#05050A label="Shade"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  float t = iTime * uSpeed;
  vec2 centre = iMouse.z > 0.0
    ? (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y
    : vec2(sin(t * 2.0) * 0.32 * aspect, sin(t * 3.0 + 0.5) * 0.28);
  float r = length(p - centre);
  float dark = smoothstep(uRadius * (1.0 - uSoftness) - px, uRadius + px, r);
  // Subtle warm volumetric rim glow around the beam edge.
  float rim = exp(-pow((r - uRadius * 0.9) / max(uRadius * (0.18 + 0.25 * uSoftness), 0.025), 2.0)) * 0.08 * uDarkness;
  vec3 col = mix(uShade, vec3(0.95, 0.92, 0.85), rim / max(dark * uDarkness + rim, 1e-4));
  fragColor = vec4(col, clamp(dark * uDarkness + rim * 0.6, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Stage", values: { uRadius: 0.35, uSoftness: 0.15, uDarkness: 0.95, uSpeed: 0.15 } },
    { name: "Torch", values: { uRadius: 0.18, uSoftness: 0.7, uDarkness: 1, uShade: [0.02, 0.01, 0] } },
  ],
};

export const embers: ShaderEffect = {
  kind: "shader",
  id: "embers",
  name: "Embers",
  description: "Glowing sparks rising from below, swaying and flickering out as they cool.",
  category: "overlay",
  tags: ["overlay", "fire", "sparks", "particles", "warm"],
  transparent: true,
  source: glsl(
    `// Embers: sparks rising, swaying and flickering out as they cool.
uniform int uCount;       // @control min=5 max=80 default=40 label="Sparks"
uniform vec3 uHeat;       // @control color default=#FF7A1A label="Heat"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Rise speed"
uniform float uSize;      // @control min=0.3 max=3 default=1 label="Size"`,
    HASH,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  // Subtle warm heat glow rising from the bottom edge.
  vec3 col = uHeat * exp(-p.y * 5.0) * 0.14;
  for (int i = 0; i < 80; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 1.3));
    float clock = iTime * uSpeed * 0.22 * (0.6 + 0.8 * h.y) + h.x;
    float life = fract(clock);
    // Each life starts somewhere new along the bottom.
    vec2 seed = vec2(fi, floor(clock));
    float drift = (hash12(seed + 2.0) - 0.5) * 0.22;
    float sway = 0.045 * sin(life * 9.0 + fi * 1.7);
    float x = hash12(seed) * aspect + sway + life * drift;
    float y = life * (0.65 + 0.55 * hash12(seed + 4.0)) - 0.03;
    float r = 0.006 * uSize * (0.55 + 0.95 * hash12(seed + 6.0));
    vec2 d = p - vec2(x, y);
    // Stretch slightly along the rising path for a motion-streaked spark look.
    float vx = drift + 0.045 * 9.0 * cos(life * 9.0 + fi * 1.7);
    float vy = 0.8;
    vec2 dir = normalize(vec2(vx, vy));
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 ld = vec2(dot(d, perp), dot(d, dir) * 0.45);
    float dist = length(ld);
    if (dist > r * 14.0) continue;
    float fade = smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.5, 1.0, life));
    float flicker = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(iTime * 19.0 + fi * 3.7) * sin(iTime * 8.3 + fi), 1.5);
    vec3 heat = mix(vec3(1.0, 0.97, 0.82), uHeat, smoothstep(0.0, 0.45, life));
    heat = mix(heat, uHeat * vec3(0.85, 0.22, 0.08), smoothstep(0.45, 1.0, life));
    float core = 1.0 - smoothstep(r * 0.35, r, dist);
    float halo = exp(-dist / (r * 3.2)) * 0.48;
    col += heat * (core * 2.1 + halo) * fade * flicker;
  }
  fragColor = glow(col);
}`,
  ),
  presets: [
    { name: "Bonfire", values: { uCount: 80, uSpeed: 1.6, uSize: 1.3 } },
    { name: "Magic sparks", values: { uHeat: [0.55, 0.4, 1], uCount: 30, uSpeed: 0.6 } },
  ],
};

export const shineSweep: ShaderEffect = {
  kind: "shader",
  id: "shine-sweep",
  name: "Shine sweep",
  description: "A soft diagonal gloss band gliding across now and then, for cards and buttons.",
  category: "overlay",
  tags: ["overlay", "ui", "gloss", "premium", "button"],
  transparent: true,
  source: glsl(
    `// Shine sweep: a soft gloss band crossing the frame at intervals.
uniform float uAngle;     // @control min=-60 max=60 default=25 label="Tilt (°)"
uniform float uWidth;     // @control min=0.02 max=0.5 default=0.15 label="Width"
uniform float uIntensity; // @control min=0 max=1 default=0.6 label="Intensity"
uniform float uInterval;  // @control min=1 max=8 default=3 label="Every (s)"
uniform vec3 uColor;      // @control color default=#FFFFFF label="Colour"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float slope = tan(radians(uAngle));
  float s = p.x + p.y * slope;
  float reach = 0.5 * aspect + 0.5 * abs(slope) + uWidth;
  // Each sweep takes 0.9 s, then waits for the next.
  float k = clamp(mod(iTime, uInterval) / 0.9, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  float d = (s - mix(-reach, reach, k)) / uWidth;
  float d2 = d - 0.55;
  float band = exp(-d * d * 5.0) * 0.72 + exp(-d * d * 70.0) * 0.55 + exp(-d2 * d2 * 24.0) * 0.32;
  fragColor = vec4(uColor, clamp(band * uIntensity, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Gold foil", values: { uColor: [1, 0.9, 0.6], uWidth: 0.25, uIntensity: 0.5 } },
    { name: "Quick glint", values: { uWidth: 0.06, uIntensity: 0.9, uInterval: 1.5, uAngle: 35 } },
  ],
};

export const frostCreep: ShaderEffect = {
  kind: "shader",
  id: "frost-creep",
  name: "Frost creep",
  description: "Ice crystals creeping in from the edges of the frame and melting back.",
  category: "overlay",
  tags: ["overlay", "ice", "winter", "frozen", "reveal", "glass"],
  transparent: true,
  loop: 8,
  source: glsl(
    `// Frost creep: crystalline frost growing in from the edges.
uniform bool uAnimate;    // @control default=true label="Animate"
uniform float uCoverage;  // @control min=0 max=1 default=0.6 label="Coverage (when still)"
uniform float uScale;     // @control min=1 max=10 default=4 label="Crystal size"
uniform vec3 uColor;      // @control color default=#DDF2FF label="Frost"`,
    HASH,
    NOISE,
    FBM,
    `// Voronoi: x = distance to the nearest point, y = to the second, zw = the nearest cell.
vec4 voronoi(vec2 q) {
  vec2 id = floor(q);
  vec2 f = fract(q);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 nearest = id;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      float d = length(o + hash22(id + o) - f);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        nearest = id + o;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec4(f1, f2, nearest);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float coverage = uAnimate ? 0.5 - 0.5 * cos(iTime * 6.28318 / 8.0) : uCoverage;
  // Distance in from the nearest edge, roughened by feathered dendritic fbm plumes.
  float edge = min(min(fragCoord.x, iResolution.x - fragCoord.x), min(fragCoord.y, iResolution.y - fragCoord.y)) / iResolution.y;
  vec2 warp = vec2(fbm(p * uScale * 1.6, 3), fbm(p * uScale * 1.6 + 5.2, 3)) - 0.5;
  float plume = fbm(p * uScale * 2.4 + warp * 1.2, 5);
  float n = fbm(p * uScale * 0.85, 4);
  float g = edge + (n - 0.5) * 0.28 + (plume - 0.5) * 0.14;
  float front = mix(-0.22, 0.72, coverage);
  float frost = 1.0 - smoothstep(front - 0.12, front, g);
  if (frost <= 0.001) {
    fragColor = vec4(0.0);
    return;
  }
  // Feathery crystalline needles, fine frost grain, and delicate ice sparkle.
  vec4 v = voronoi(p * uScale * 5.0 + warp * 0.8);
  float facet = hash12(v.zw + 3.1);
  float feather = smoothstep(0.32, 0.78, plume);
  float needles = pow(fbm(p * uScale * vec2(7.0, 2.2) + warp * 2.0, 4), 1.6);
  float needles2 = pow(fbm(p * uScale * vec2(2.2, 7.0) - warp * 2.0, 4), 1.6);
  float crystal = clamp((needles + needles2) * 0.85, 0.0, 1.0);
  vec2 sp = p * uScale * 42.0;
  float sparkle = smoothstep(0.84, 0.99, hash12(floor(sp))) * (1.0 - smoothstep(0.0, 0.45, length(fract(sp) - 0.5))) * crystal;
  float rim = smoothstep(front - 0.1, front - 0.02, g) * feather;
  vec3 iceBase = mix(uColor * vec3(0.75, 0.88, 1.0), vec3(1.0), 0.35 * facet + 0.45 * crystal + 0.35 * feather + 0.5 * sparkle);
  float alpha = frost * clamp(0.18 + 0.32 * feather + 0.38 * crystal + 0.14 * facet + 0.25 * rim + 0.2 * sparkle, 0.0, 0.96);
  fragColor = vec4(min(iceBase, 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Hoarfrost", values: { uAnimate: false, uCoverage: 0.85, uScale: 6 } },
    { name: "Icy blue", values: { uColor: [0.62, 0.83, 1], uScale: 2.5 } },
  ],
};

/** Effects drawn over other content: transparent where there is nothing to draw (see `ShaderEffect.transparent`). */
/**
 * The light sweep duotone used to have built in, on its own: a soft diagonal
 * glare gliding across without a pause. It is added light, so lay it over a
 * picture with `mix-blend-mode: plus-lighter` for the glare exactly as it was
 * (duotone plus this, at its defaults, is the old duotone to the pixel), or
 * as it is for a slightly softer, screen-like one.
 */
export const glareSweep: ShaderEffect = {
  kind: "shader",
  id: "glare-sweep",
  name: "Glare sweep",
  description: "A soft diagonal glare gliding across without a pause, added light to lay over a picture (with plus-lighter blending it adds exactly).",
  category: "overlay",
  tags: ["overlay", "glare", "light", "sweep", "gloss", "editorial"],
  transparent: true,
  // One sweep every 1 / 0.15 s at the default speed.
  loop: 20 / 3,
  source: glsl(
    `// Glare sweep: a soft diagonal band of added light gliding across, again and again.
uniform float uStrength;  // @control min=0 max=1 default=0.3 label="Strength"
uniform float uSpeed;     // @control min=0.02 max=1 default=0.15 label="Sweeps per second"
uniform float uTilt;      // @control min=-1 max=1 default=0.4 label="Tilt"
uniform float uSharpness; // @control min=1 max=20 default=6 label="Sharpness"
uniform vec3 uColor;      // @control color default=#FFFFFF label="Colour"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  // A band along x + tilt·y, travelling from off one side to off the other each sweep.
  float sweep = exp(-pow((uv.x + uv.y * uTilt - fract(iTime * uSpeed) * 2.0 + 0.4) * uSharpness, 2.0));
  // Straight colour with the glare as coverage: added over a picture (plus-lighter), that is colour × strength × sweep.
  fragColor = vec4(uColor, clamp(sweep * uStrength, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Gold", values: { uColor: [1, 0.85, 0.55], uStrength: 0.45 } },
    { name: "Quick flash", values: { uSpeed: 0.6, uSharpness: 12, uStrength: 0.6 } },
  ],
};

export const overlayEffects: ShaderEffect[] = [
  rainOnGlass,
  snowfall,
  lensFlare,
  vignetteGrain,
  scanlineSweep,
  spotlight,
  embers,
  shineSweep,
  glareSweep,
  frostCreep,
];
