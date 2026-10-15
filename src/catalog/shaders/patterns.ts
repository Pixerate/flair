import { glsl, HASH, ROTATE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

export const dotWave: ShaderEffect = {
  kind: "shader",
  id: "dot-wave",
  name: "Dot wave",
  description: "A halftone grid of dots swelling in a travelling wave.",
  category: "pattern",
  tags: ["background", "halftone", "tech", "minimal"],
  loop: 4,
  source: glsl(
    `// Dot wave: a grid of dots swelling in a travelling wave.
uniform vec3 uBackground; // @control color default=#0F172A label="Background"
uniform vec3 uDot;        // @control color default=#38BDF8 label="Dot"
uniform float uSpacing;   // @control min=8 max=64 default=22 label="Spacing (px)"
uniform float uWaves;     // @control min=0.5 max=6 default=2 label="Waves"
uniform bool uRadial;     // @control default=true label="Radial"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uSpacing);
  vec2 local = fract(fragCoord / uSpacing) - 0.5;
  vec2 centre = (cell + 0.5) * uSpacing;
  vec2 p = (centre - 0.5 * iResolution.xy) / iResolution.y;
  float d = uRadial ? length(p) : p.x + p.y * 0.3;
  float phase = d * uWaves * 6.28318 - iTime * 6.28318 / 4.0;
  float size = 0.1 + 0.32 * (0.5 + 0.5 * sin(phase));
  float aa = 1.5 / uSpacing;
  float disc = 1.0 - smoothstep(size - aa, size + aa, length(local));
  vec3 col = mix(uBackground, uDot * (0.6 + 0.4 * size / 0.42), disc);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const truchet: ShaderEffect = {
  kind: "shader",
  id: "truchet",
  name: "Truchet flow",
  description: "Quarter-circle Truchet tiles forming endless winding paths, with light flowing along them.",
  category: "pattern",
  tags: ["background", "maze", "geometric", "tech"],
  source: glsl(
    `// Truchet flow: winding quarter-circle tiles with light flowing along them.
uniform vec3 uBackground; // @control color default=#111827 label="Background"
uniform vec3 uLine;       // @control color default=#F472B6 label="Line"
uniform float uTiles;     // @control min=3 max=30 default=10 label="Tiles"
uniform float uWidth;     // @control min=0.02 max=0.3 default=0.1 label="Line width"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Flow speed"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uTiles;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  float flip = hash12(id) > 0.5 ? 1.0 : -1.0;
  f.x *= flip;
  vec2 c = f.x > -f.y ? vec2(0.5) : vec2(-0.5);
  vec2 q = f - c;
  float d = abs(length(q) - 0.5);
  float angle = atan(q.y, q.x);
  float checker = mod(id.x + id.y, 2.0) * 2.0 - 1.0;
  float flow = 0.5 + 0.5 * sin(angle * 4.0 * checker * flip + iTime * uSpeed * 4.0);
  float line = 1.0 - smoothstep(uWidth - 0.02, uWidth, d);
  vec3 col = mix(uBackground, uLine * (0.45 + 0.75 * flow), line);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const hexPulse: ShaderEffect = {
  kind: "shader",
  id: "hex-pulse",
  name: "Hex pulse",
  description: "A honeycomb grid lighting up cell by cell in ripples.",
  category: "pattern",
  tags: ["background", "tech", "honeycomb", "sci-fi"],
  source: glsl(
    `// Hex pulse: a honeycomb grid lighting up in ripples.
uniform vec3 uBackground; // @control color default=#020617 label="Background"
uniform vec3 uEdge;       // @control color default=#22D3EE label="Edge"
uniform vec3 uFill;       // @control color default=#0E7490 label="Fill"
uniform float uCells;     // @control min=3 max=40 default=12 label="Cells"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"`,
    HASH,
    `vec4 hexCoords(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, p - gv);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * uCells;
  vec4 h = hexCoords(p);
  vec2 gv = abs(h.xy);
  float edgeDist = 0.5 - max(dot(gv, normalize(vec2(1.0, 1.7320508))), gv.x);
  float ripple = 0.5 + 0.5 * sin(length(h.zw) * 0.6 - iTime * uSpeed * 3.0);
  float spark = step(0.92, hash12(h.zw + floor(iTime * uSpeed * 2.0)));
  float lit = clamp(pow(ripple, 6.0) + spark * 0.6, 0.0, 1.0);
  vec3 col = mix(uBackground, uFill, lit * smoothstep(0.0, 0.1, edgeDist));
  col = mix(col, uEdge, (1.0 - smoothstep(0.0, 0.04, edgeDist)) * (0.3 + 0.7 * ripple));
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const moire: ShaderEffect = {
  kind: "shader",
  id: "moire",
  name: "Moiré rings",
  description: "Two sets of concentric rings sliding over each other into shimmering interference.",
  category: "pattern",
  tags: ["background", "op-art", "hypnotic", "minimal"],
  source: glsl(
    `// Moiré rings: two ring sets interfering as they slide.
uniform vec3 uInk;      // @control color default=#111111 label="Ink"
uniform vec3 uPaper;    // @control color default=#F5F5F0 label="Paper"
uniform float uRings;   // @control min=10 max=200 default=80 label="Rings"
uniform float uDrift;   // @control min=0 max=0.5 default=0.15 label="Drift"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 o = uDrift * vec2(sin(iTime * 0.4), cos(iTime * 0.3));
  float a = sin(length(p - o) * uRings);
  float b = sin(length(p + o) * uRings);
  float v = smoothstep(-0.2, 0.2, a * b);
  fragColor = vec4(mix(uInk, uPaper, v), 1.0);
}`,
  ),
};

export const barberStripes: ShaderEffect = {
  kind: "shader",
  id: "stripes",
  name: "Stripes",
  description: "Diagonal stripes marching across, for progress bars, banners and warnings.",
  category: "pattern",
  tags: ["progress", "banner", "warning", "loop"],
  loop: 1,
  source: glsl(
    `// Stripes: diagonal stripes marching across.
uniform vec3 uColorA;   // @control color default=#FACC15 label="Colour A"
uniform vec3 uColorB;   // @control color default=#18181B label="Colour B"
uniform float uWidth;   // @control min=4 max=120 default=28 label="Stripe width (px)"
uniform float uAngle;   // @control min=-90 max=90 default=45 label="Angle (°)"
uniform float uSoft;    // @control min=0 max=1 default=0.05 label="Softness"`,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float a = radians(uAngle);
  float d = dot(fragCoord, vec2(cos(a), sin(a))) / (uWidth * 2.0);
  float s = fract(d - iTime);
  float edge = max(uSoft * 0.5, 0.5 / uWidth);
  float m = smoothstep(0.5 - edge, 0.5 + edge, s) - smoothstep(1.0 - edge, 1.0, s) + (1.0 - smoothstep(0.0, edge, s));
  fragColor = vec4(mix(uColorA, uColorB, clamp(m, 0.0, 1.0)), 1.0);
}`,
  ),
};

export const voronoi: ShaderEffect = {
  kind: "shader",
  id: "voronoi",
  name: "Living cells",
  description: "Voronoi cells drifting and dividing, like a microscope slide.",
  category: "pattern",
  tags: ["background", "biology", "cells", "organic"],
  source: glsl(
    `// Living cells: drifting Voronoi cells with glowing walls.
uniform vec3 uBackground; // @control color default=#052E16 label="Background"
uniform vec3 uCell;       // @control color default=#4ADE80 label="Cell"
uniform vec3 uWall;       // @control color default=#DCFCE7 label="Wall"
uniform float uScale;     // @control min=2 max=20 default=6 label="Scale"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float shade = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      o = 0.5 + 0.4 * sin(iTime * uSpeed + 6.28318 * o);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; shade = hash12(i + g); }
      else if (d < d2) { d2 = d; }
    }
  }
  float wall = 1.0 - smoothstep(0.0, 0.08, d2 - d1);
  vec3 col = mix(uBackground, uCell * (0.4 + 0.6 * shade), smoothstep(0.9, 0.1, d1));
  col = mix(col, uWall, wall);
  fragColor = vec4(col, 1.0);
}`,
  ),
};

export const kaleidoscope: ShaderEffect = {
  kind: "shader",
  id: "kaleidoscope",
  name: "Kaleidoscope",
  description: "Mirrored wedges of shifting colour turning around the centre.",
  category: "pattern",
  tags: ["psychedelic", "music", "symmetry"],
  source: glsl(
    `// Kaleidoscope: mirrored wedges of shifting colour.
uniform int uSegments;  // @control min=2 max=16 default=8 label="Segments"
uniform float uZoom;    // @control min=0.5 max=8 default=3 label="Zoom"
uniform float uSpeed;   // @control min=0 max=2 default=0.4 label="Speed"
uniform vec3 uTint;     // @control color default=#FFFFFF label="Tint"`,
    ROTATE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed;
  float n = float(uSegments);
  float a = atan(p.y, p.x) + t * 0.3;
  float r = length(p);
  float wedge = 6.28318 / n;
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r * uZoom;
  q = rot(t * 0.2) * q + t;
  vec3 col = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + q.x * 2.0 + sin(q.y * 3.0) + t);
  col *= 0.6 + 0.4 * sin(q.x * 5.0) * sin(q.y * 5.0);
  col *= smoothstep(1.2, 0.2, r);
  fragColor = vec4(col * uTint, 1.0);
}`,
  ),
};

export const neonCircuit: ShaderEffect = {
  kind: "shader",
  id: "neon-circuit",
  name: "Neon circuit",
  description: "Glowing neon traces routed up a circuit board, with pulses of light racing along them.",
  category: "pattern",
  tags: ["background", "neon", "circuit", "tech", "80s", "vaporwave"],
  source: glsl(
    `// Neon circuit: glowing traces climbing a board in rounded jogs, with pulses running along them.
uniform vec3 uBackground; // @control color default=#170A2E label="Background"
uniform vec3 uColorA;     // @control color default=#FF5FA2 label="Trace A"
uniform vec3 uColorB;     // @control color default=#43E5FF label="Trace B"
uniform vec3 uColorC;     // @control color default=#FFD23F label="Trace C"
uniform vec3 uColorD;     // @control color default=#9D7BFF label="Trace D"
uniform float uLanes;     // @control min=4 max=40 default=14 label="Lanes"
uniform float uDensity;   // @control min=0.1 max=1 default=0.7 label="Density"
uniform float uWidth;     // @control min=0.04 max=0.4 default=0.16 label="Line width"
uniform float uGlow;      // @control min=0 max=2 default=1 label="Glow"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Pulse speed"
uniform float uPulses;    // @control min=0 max=1 default=0.5 label="Pulses"
uniform float uScroll;    // @control min=-2 max=2 default=0.4 label="Scroll"
uniform float uGrid;      // @control min=0 max=1 default=0.3 label="Grid"`,
    HASH,
    `// Each trace k owns lanes 3k..3k+2 and climbs in runs of RUN lanes, jogging
// sideways between them on rounded corners, so traces never cross.
const float RUN = 2.5;
const float RADIUS = 0.35;

float laneOf(float k, float j) {
  return 3.0 * k + floor(hash12(vec2(k, j) + 0.37) * 3.0) + 0.5;
}

vec3 traceColor(float k) {
  float h = hash12(vec2(k, 7.3));
  return h < 0.25 ? uColorA : h < 0.5 ? uColorB : h < 0.75 ? uColorC : uColorD;
}

// Distance to a quarter circle of RADIUS round c, in the quadrant whose signs are q.
float arcDist(vec2 p, vec2 c, vec2 q) {
  vec2 d = p - c;
  return d.x * q.x >= 0.0 && d.y * q.y >= 0.0 ? abs(length(d) - RADIUS) : 1e5;
}

// Trace k's run j: distance from p to its climb (x) and how far up it p is (y), then
// the same for its jog into run j + 1 (z, w), measured along the run.
vec4 run(vec2 p, float k, float j) {
  float x0 = laneOf(k, j - 1.0);
  float x1 = laneOf(k, j);
  float x2 = laneOf(k, j + 1.0);
  float y0 = j * RUN;
  float y1 = y0 + RUN;
  float lo = y0 + (x0 == x1 ? 0.0 : RADIUS);
  float hi = y1 - (x2 == x1 ? 0.0 : RADIUS);
  vec4 r = vec4(length(p - vec2(x1, clamp(p.y, lo, hi))), p.y - y0, 1e5, 0.0);
  if (x2 != x1) {
    float sx = sign(x2 - x1);
    float h = length(p - vec2(clamp(p.x, min(x1, x2) + RADIUS, max(x1, x2) - RADIUS), y1));
    h = min(h, arcDist(p, vec2(x1 + sx * RADIUS, y1 - RADIUS), vec2(-sx, 1.0)));
    h = min(h, arcDist(p, vec2(x2 - sx * RADIUS, y1 + RADIUS), vec2(sx, -1.0)));
    r.zw = vec2(h, RUN + abs(p.x - x1));
  }
  return r;
}

// How bright a pulse is at s along run j of trace k: a bright head with a fading tail.
// A pulse crosses one run per cycle and carries on into the next with the next cycle.
float pulseAt(float k, float j, float s) {
  float cycle = iTime * uSpeed * 1.5 + hash12(vec2(k, 8.8));
  float behind = fract(cycle) * (RUN + abs(laneOf(k, j + 1.0) - laneOf(k, j))) - s;
  float lit = step(hash12(vec2(k, floor(cycle) - j)), uPulses);
  return lit * (behind >= 0.0 ? exp(-behind * 0.8) : exp(behind * 30.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = uLanes / iResolution.y;
  vec2 p = fragCoord * px;
  p.y += iTime * uScroll;

  vec2 g = abs(fract(p / 1.5) - 0.5);
  float grid = 1.0 - smoothstep(0.0, px * 1.5, (0.5 - max(g.x, g.y)) * 1.5);
  vec3 light = uColorD * 0.12 * uGrid * grid;

  float home = floor(p.x / 3.0);
  for (int i = -1; i <= 1; i++) {
    float k = home + float(i);
    if (hash12(vec2(k, 1.9)) > uDensity) continue;
    vec2 q = vec2(p.x, p.y + hash12(vec2(k, 4.1)) * RUN);
    float jq = floor(q.y / RUN);
    float w = uWidth * 0.5;
    // The trace's nearest point lights it; each piece's pulse lights only round that piece.
    float d = 1e5;
    float pulse = 0.0;
    for (int b = -1; b <= 1; b++) {
      float j = jq + float(b);
      vec4 r = run(q, k, j);
      d = min(d, min(r.x, r.z));
      pulse = max(pulse, pulseAt(k, j, r.y) * exp(-r.x / uWidth));
      if (r.z < 1e4) pulse = max(pulse, pulseAt(k, j, r.w) * exp(-r.z / uWidth));
    }
    float core = 1.0 - smoothstep(w - px, w + px, d);
    float glow = uGlow * (0.5 * exp(-d / uWidth) + 0.2 * exp(-d / (uWidth * 5.0)));
    vec3 c = traceColor(k);
    light += c * (core * 0.8 + glow + uGlow * pulse) + mix(c, vec3(1.0), 0.7) * core * pulse * 3.0;
  }
  fragColor = vec4(uBackground + (1.0 - exp(-light * 1.4)), 1.0);
}`,
  ),
  presets: [
    { name: "Mainframe", values: { uBackground: [0.0, 0.04, 0.02], uColorA: [0.2, 1, 0.45], uColorB: [0.1, 0.75, 0.35], uColorC: [0.6, 1, 0.7], uColorD: [0.1, 0.5, 0.25] } },
    { name: "Blueprint", values: { uBackground: [0.02, 0.06, 0.16], uColorA: [0.35, 0.75, 1], uColorB: [0.6, 0.9, 1], uColorC: [1, 1, 1], uColorD: [0.25, 0.45, 0.9], uGlow: 0.6, uPulses: 0.3 } },
    { name: "Dense", values: { uLanes: 26, uDensity: 1, uWidth: 0.12, uPulses: 0.8 } },
  ],
};
