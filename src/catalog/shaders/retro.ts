import { glsl, HASH } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const synthwaveGrid: ShaderEffect = {
  kind: "shader",
  id: "synthwave",
  name: "Synthwave",
  description: "A neon perspective grid racing towards a striped retro sun.",
  category: "retro",
  tags: ["background", "80s", "neon", "music", "loop"],
  loop: 1,
  source: glsl(
    `// Synthwave: a neon grid racing towards a striped sun.
uniform vec3 uSkyTop;    // @control color default=#12002B label="Sky top"
uniform vec3 uSkyBottom; // @control color default=#7A1A6B label="Sky bottom"
uniform vec3 uSunTop;    // @control color default=#FFE45E label="Sun top"
uniform vec3 uSunBottom; // @control color default=#FF3D7F label="Sun bottom"
uniform vec3 uGrid;      // @control color default=#00F0FF label="Grid"
uniform float uHorizon;  // @control min=0.2 max=0.7 default=0.42 label="Horizon"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float horizon = uHorizon - 0.5;
  vec3 col;
  if (p.y > horizon) {
    float h = (p.y - horizon) / (0.5 - horizon);
    col = mix(uSkyBottom, uSkyTop, h);
    vec2 s = p - vec2(0.0, horizon + 0.18);
    float sun = smoothstep(0.2, 0.195, length(s));
    float bands = step(0.0, sin((s.y + 0.2) * 60.0 - 1.5)) + step(0.06, s.y);
    sun *= clamp(bands, 0.0, 1.0);
    col = mix(col, mix(uSunBottom, uSunTop, clamp(s.y / 0.2 * 0.5 + 0.5, 0.0, 1.0)), sun);
    col += uSunBottom * 0.25 * exp(-length(s) * 4.0);
  } else {
    float depth = (horizon - p.y);
    vec2 g = vec2(p.x / depth, 1.0 / depth);
    g.y += iTime * 2.0;
    vec2 grid = abs(fract(g * 0.5) - 0.5) / fwidth(g * 0.5);
    float line = 1.0 - clamp(min(grid.x, grid.y), 0.0, 1.0);
    float fade = smoothstep(0.0, 0.25, depth);
    col = mix(uSkyTop * 0.4, uSkyBottom * 0.3, uv.y);
    col += uGrid * line * fade + uGrid * 0.25 * exp(-depth * 20.0);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const tvStatic: ShaderEffect = {
  kind: "shader",
  id: "tv-static",
  name: "TV static",
  description: "Analogue snow with rolling bars and scanlines.",
  category: "retro",
  tags: ["glitch", "analogue", "transition", "noise"],
  source: glsl(
    `// TV static: analogue snow with a rolling bar and scanlines.
uniform float uAmount;    // @control min=0 max=1 default=0.9 label="Snow"
uniform float uScanlines; // @control min=0 max=1 default=0.35 label="Scanlines"
uniform float uRoll;      // @control min=0 max=1 default=0.3 label="Rolling bar"
uniform vec3 uTint;       // @control color default=#E6E6E6 label="Tint"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float n = hash12(floor(fragCoord * 0.5) + floor(iTime * 30.0) * 17.31);
  float scan = 1.0 - uScanlines * 0.5 * (1.0 + sin(fragCoord.y * 3.14159));
  float bar = 1.0 + uRoll * 0.6 * smoothstep(0.15, 0.0, abs(fract(uv.y - iTime * 0.2) - 0.5) - 0.3);
  vec3 col = uTint * mix(0.5, n, uAmount) * scan * bar;
  col *= smoothstep(1.2, 0.4, length(uv - 0.5) * 1.4);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const digitalRain: ShaderEffect = {
  kind: "shader",
  id: "digital-rain",
  name: "Digital rain",
  description: "Columns of glyph-like characters raining down a terminal.",
  category: "retro",
  tags: ["hacker", "code", "tech", "cyber"],
  source: glsl(
    `// Digital rain: glyph-like cells raining down in columns.
uniform vec3 uBackground; // @control color default=#000000 label="Background"
uniform vec3 uGlyph;      // @control color default=#22FF66 label="Glyph"
uniform float uCell;      // @control min=6 max=40 default=14 label="Cell size (px)"
uniform float uSpeed;     // @control min=0 max=4 default=1 label="Speed"`,
    HASH,
    `float glyph(vec2 cell, vec2 f) {
  vec2 g = floor(f * vec2(3.0, 5.0));
  float on = step(0.45, hash12(g + cell * 13.7 + floor(iTime * 4.0 * hash12(cell))));
  vec2 inset = abs(fract(f * vec2(3.0, 5.0)) - 0.5);
  return on * step(max(inset.x, inset.y), 0.38);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 q = fragCoord / uCell;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float col = cell.x;
  float speed = (0.5 + hash12(vec2(col, 1.0))) * uSpeed * 8.0;
  float offset = hash12(vec2(col, 2.0)) * 100.0;
  float head = fract((iTime * speed + offset) / 40.0) * (iResolution.y / uCell + 30.0);
  float y = iResolution.y / uCell - cell.y;
  float trail = head - y;
  float lit = trail >= 0.0 ? exp(-trail * 0.15) : 0.0;
  float isHead = step(abs(trail), 0.5);
  float g = glyph(cell, f);
  vec3 c = uBackground + uGlyph * g * lit + vec3(0.8) * g * isHead;
  fragColor = vec4(c, 1.0);
}`,
  ),
};

export const pixelSunset: ShaderEffect = {
  kind: "shader",
  id: "dither-gradient",
  name: "Dithered gradient",
  description: "A 1-bit Bayer-dithered gradient wave, like an old Mac or Game Boy screen.",
  category: "retro",
  tags: ["pixel", "1-bit", "lo-fi", "background"],
  source: glsl(
    `// Dithered gradient: a Bayer-dithered gradient wave in two colours.
uniform vec3 uDark;     // @control color default=#0F380F label="Dark"
uniform vec3 uLight;    // @control color default=#9BBC0F label="Light"
uniform float uPixel;   // @control min=1 max=12 default=4 step=1 label="Pixel size"
uniform float uSpeed;   // @control min=0 max=2 default=0.5 label="Speed"`,
    `float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = floor(fragCoord / uPixel);
  vec2 uv = px * uPixel / iResolution.xy;
  float v = uv.y + 0.15 * sin(uv.x * 6.0 + iTime * uSpeed * 2.0) + 0.1 * sin(uv.x * 13.0 - iTime * uSpeed * 3.0);
  v = clamp(v, 0.0, 1.0);
  float on = step(bayer4(px), v);
  fragColor = vec4(mix(uDark, uLight, on), 1.0);
}`,
  ),
  presets: [
    { name: "Mac", values: { uDark: [0.05, 0.05, 0.05], uLight: [0.93, 0.93, 0.9] } },
    { name: "Amber", values: { uDark: [0.1, 0.04, 0], uLight: [1, 0.69, 0] } },
  ],
};
