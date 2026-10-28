import { glsl, HASH, OKLAB_MIX } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Web UI flourishes and backgrounds: the looks of modern landing pages. The
 * frames (border beam, gradient border) are sized to the canvas, so lay the
 * canvas over a card or button; the backgrounds fill it. The pointer ones
 * read the built-ins (`iPointer`: xy pixels, z how hovered) and drift on
 * their own while idle, which `uDemo` turns off.
 */

/** `boxSdf(p, halfSize, radius)`: signed distance to a rounded rectangle centred on the origin. */
const BOX = `
float boxSdf(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
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
 * `hoverPoint(demo, idle)`: the point to follow, in pixels, and how strongly
 * (z): the pointer while it is over the canvas, else (with the demo on) a
 * slow drift at strength `idle`.
 */
const HOVER = `
vec3 hoverPoint(bool demo, float idle) {
  vec2 drift = iResolution.xy * (0.5 + vec2(0.3 * sin(iTime * 0.53), 0.25 * sin(iTime * 0.77 + 1.3)));
  float h = clamp(iPointer.z, 0.0, 1.0);
  return vec3(mix(drift, iPointer.xy, h), mix(demo ? idle : 0.0, 1.0, h));
}`.trim();

/** The frame controls shared by the border effects: inset, corner radius and line thickness, in frame heights. */
const FRAME_CONTROLS = `
uniform float uInset;     // @control min=0 max=0.3 default=0.06 label="Inset"
uniform float uRadius;    // @control min=0 max=0.5 default=0.1 label="Corner radius"
uniform float uThickness; // @control min=0.001 max=0.04 default=0.006 label="Thickness"`.trim();

export const borderBeam: ShaderEffect = {
  kind: "shader",
  id: "border-beam",
  name: "Border beam",
  description: "A bright beam of light travelling round a card's rounded border, trailing a gradient tail.",
  category: "ui",
  tags: ["ui", "border", "card", "button", "frame", "overlay", "glow", "saas"],
  transparent: true,
  loop: 5,
  source: glsl(
    `// Border beam: a beam of light running round a rounded frame, its tail fading from head colour to tail colour.
uniform vec3 uHead;        // @control color default=#FFAA40 label="Head"
uniform vec3 uTail;        // @control color default=#9C40FF label="Tail"
uniform vec3 uBorder;      // @control color default=#FFFFFF label="Border"
uniform float uBorderAlpha; // @control min=0 max=1 default=0.12 label="Border opacity"
${FRAME_CONTROLS}
uniform float uLength;     // @control min=0.05 max=0.9 default=0.25 label="Tail length"
uniform float uLaps;       // @control min=0 max=3 default=1 step=1 label="Laps per loop"
uniform int uBeams;        // @control min=1 max=4 default=1 label="Beams"
uniform float uGlow;       // @control min=0 max=1 default=0.6 label="Glow"`,
    BOX,
    OVER,
    `// How far round the frame q is, as arc length from the bottom of its right side, anticlockwise.
float framePos(vec2 q, vec2 c, float r) {
  float lc = 1.5707963 * r;
  float lx = 2.0 * c.x;
  float ly = 2.0 * c.y;
  vec2 a = abs(q);
  if (a.x > c.x && a.y > c.y) {
    vec2 k = vec2(q.x > 0.0 ? c.x : -c.x, q.y > 0.0 ? c.y : -c.y);
    float ang = atan(q.y - k.y, q.x - k.x);
    if (ang < 0.0) ang += 6.2831853;
    if (q.x > 0.0 && q.y > 0.0) return ly + r * ang;
    if (q.y > 0.0) return ly + lc + lx + r * (ang - 1.5707963);
    if (q.x < 0.0) return 2.0 * ly + 2.0 * lc + lx + r * (ang - 3.1415927);
    return 2.0 * ly + 3.0 * lc + 2.0 * lx + r * (ang - 4.712389);
  }
  bool side = a.x > c.x || (a.y <= c.y && c.x - a.x < c.y - a.y);
  if (side) return q.x > 0.0 ? q.y + c.y : ly + 2.0 * lc + lx + (c.y - q.y);
  return q.y > 0.0 ? ly + lc + (c.x - q.x) : 2.0 * ly + 3.0 * lc + lx + (q.x + c.x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 box = max(0.5 * iResolution.xy * px - uInset, vec2(0.02));
  float rad = min(uRadius, min(box.x, box.y));
  vec2 c = box - rad;
  float sd = boxSdf(p, box, rad);
  float w = max(uThickness, px);
  float core = clamp(1.0 - (abs(sd) - 0.5 * w) / px, 0.0, 1.0);
  float halo = exp(-abs(sd) / (w + 0.012));
  vec4 acc = vec4(0.0);
  acc = over(acc, uBorder, uBorderAlpha * core);
  if (abs(sd) > 0.06 + 3.0 * w) {
    fragColor = unpremultiply(acc);
    return;
  }
  float perim = 4.0 * (c.x + c.y) + 6.2831853 * rad;
  float s = framePos(p, c, rad) / perim;
  // Behind the head, as a fraction of the way round: the brightest of the beams.
  float beam = 0.0;
  float behind = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uBeams) break;
    float head = fract(iTime * uLaps / 5.0 + float(i) / float(uBeams));
    float d = fract(head - s);
    float k = d < uLength ? pow(1.0 - d / uLength, 1.2) * smoothstep(0.0, 0.012, d) : 0.0;
    if (k > beam) {
      beam = k;
      behind = d / uLength;
    }
  }
  vec3 col = mix(uHead, uTail, smoothstep(0.0, 0.7, behind));
  acc = over(acc, col, clamp(beam * halo * uGlow * 0.7, 0.0, 1.0));
  acc = over(acc, mix(col, vec3(1.0), 0.45 * beam * beam), clamp(beam * core * 1.4, 0.0, 1.0));
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Dark", values: { uHead: [1, 0.67, 0.25], uTail: [0.61, 0.25, 1], uBorder: [1, 1, 1], uBorderAlpha: 0.12 } },
    { name: "Light", values: { uHead: [0.39, 0.4, 0.95], uTail: [0.93, 0.28, 0.6], uBorder: [0.06, 0.09, 0.16], uBorderAlpha: 0.1, uGlow: 0.3 } },
    { name: "Twin beams", values: { uBeams: 2, uLength: 0.18, uHead: [0.13, 0.83, 0.93], uTail: [0.23, 0.51, 0.96] } },
    { name: "Button", values: { uInset: 0.02, uRadius: 0.5, uThickness: 0.012, uLength: 0.4, uLaps: 2 } },
  ],
};

export const gradientBorder: ShaderEffect = {
  kind: "shader",
  id: "gradient-border",
  name: "Gradient border",
  description: "A rounded card ringed by a turning conic gradient, glowing softly round the outside.",
  category: "ui",
  tags: ["ui", "border", "card", "button", "frame", "overlay", "glow", "gradient", "saas"],
  transparent: true,
  loop: 6,
  source: glsl(
    `// Gradient border: a conic gradient turning round a rounded frame, with a glow outside it and an optional card fill.
uniform vec3 uColorA;     // @control color default=#FF4D8D label="Colour A"
uniform vec3 uColorB;     // @control color default=#7C5CFF label="Colour B"
uniform vec3 uColorC;     // @control color default=#22D3EE label="Colour C"
${FRAME_CONTROLS}
uniform float uTurns;     // @control min=-3 max=3 default=1 step=1 label="Turns per loop"
uniform float uGlow;      // @control min=0 max=1 default=0.6 label="Glow"
uniform float uGlowSize;  // @control min=0.005 max=0.15 default=0.05 label="Glow size"
uniform vec3 uFill;       // @control color default=#0B0B12 label="Card"
uniform float uFillAlpha; // @control min=0 max=1 default=1 label="Card opacity"`,
    BOX,
    OVER,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 box = max(0.5 * iResolution.xy * px - uInset, vec2(0.02));
  float rad = min(uRadius, min(box.x, box.y));
  float sd = boxSdf(p, box, rad);
  float w = max(uThickness, px);
  // The gradient turns round the centre, squashed to the frame's shape so it turns evenly.
  float a = fract(atan(p.y / box.y, p.x / box.x) / 6.2831853 + 0.5 - iTime * uTurns / 6.0);
  float s = a * 3.0;
  vec3 col = s < 1.0 ? oklabMix(uColorA, uColorB, s) : s < 2.0 ? oklabMix(uColorB, uColorC, s - 1.0) : oklabMix(uColorC, uColorA, s - 2.0);
  float core = clamp(1.0 - (abs(sd) - 0.5 * w) / px, 0.0, 1.0);
  float inside = clamp(0.5 - sd / px, 0.0, 1.0);
  float glow = exp(-max(sd, 0.0) / uGlowSize) * (1.0 - inside);
  vec4 acc = vec4(0.0);
  acc = over(acc, col, clamp(glow * uGlow * 0.8, 0.0, 1.0));
  acc = over(acc, uFill, inside * uFillAlpha);
  // A faint wash of the gradient just inside the border.
  acc = over(acc, col, inside * uGlow * 0.18 * exp(sd / (uGlowSize * 0.6)));
  acc = over(acc, col, core);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Dark", values: { uFill: [0.04, 0.04, 0.07], uFillAlpha: 1, uGlow: 0.6 } },
    { name: "Light", values: { uFill: [1, 1, 1], uFillAlpha: 1, uGlow: 0.35, uColorA: [0.98, 0.45, 0.09], uColorB: [0.93, 0.28, 0.6], uColorC: [0.39, 0.4, 0.95] } },
    { name: "Ring only", values: { uFillAlpha: 0, uThickness: 0.01, uGlow: 0.8 } },
    { name: "Pill button", values: { uInset: 0.08, uRadius: 0.5, uThickness: 0.012, uTurns: 2, uGlowSize: 0.08 } },
  ],
};

export const meteors: ShaderEffect = {
  kind: "shader",
  id: "meteors",
  name: "Meteors",
  description: "Thin meteor streaks falling diagonally across, each trailing a fading tail.",
  category: "ui",
  tags: ["ui", "background", "overlay", "space", "streak", "card", "saas"],
  transparent: true,
  source: glsl(
    `// Meteors: thin streaks falling diagonally in lanes, each with a bright head and a fading tail.
uniform vec3 uColor;      // @control color default=#E2E8F0 label="Colour"
uniform int uCount;       // @control min=4 max=60 default=24 label="Lanes"
uniform float uSpeed;     // @control min=0.1 max=3 default=0.8 label="Speed"
uniform float uLength;    // @control min=0.05 max=0.8 default=0.3 label="Tail length"
uniform float uAngle;     // @control min=0 max=80 default=35 label="Angle (°)"
uniform float uWidth;     // @control min=0.5 max=4 default=1.2 label="Width (px)"
uniform float uGap;       // @control min=0 max=4 default=1.5 label="Gaps"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  float ang = radians(uAngle);
  // Falling down and to the left: along is the way they travel, across picks the lane.
  vec2 v = vec2(-sin(ang), -cos(ang));
  vec2 n = vec2(-v.y, v.x);
  vec4 al = vec4(0.0, dot(vec2(aspect, 0.0), v), dot(vec2(0.0, 1.0), v), dot(vec2(aspect, 1.0), v));
  vec4 ac = vec4(0.0, dot(vec2(aspect, 0.0), n), dot(vec2(0.0, 1.0), n), dot(vec2(aspect, 1.0), n));
  float alMin = min(min(al.x, al.y), min(al.z, al.w));
  float span = max(max(al.x, al.y), max(al.z, al.w)) - alMin;
  float acMin = min(min(ac.x, ac.y), min(ac.z, ac.w));
  float laneW = (max(max(ac.x, ac.y), max(ac.z, ac.w)) - acMin) / float(uCount);
  float along = dot(p, v);
  float across = dot(p, n) - acMin;
  float lane = floor(across / laneW);
  vec2 h = hash22(vec2(lane, 7.31));
  float h3 = hash12(vec2(lane, 2.17));
  float centre = (lane + 0.2 + 0.6 * h.x) * laneW;
  float speed = uSpeed * (0.6 + 0.8 * h.y);
  float cycle = (span + 2.0 * uLength) / speed * (1.0 + uGap * h3);
  float head = alMin - 0.1 * uLength + mod(iTime + h.x * 37.0, cycle) * speed;
  float behind = (head - along) / uLength;
  float d = abs(dot(p, n) - acMin - centre) / px;
  float a = 0.0;
  if (behind > -0.05 && behind < 1.0) {
    float wd = uWidth * (1.0 - 0.6 * max(behind, 0.0));
    float line = clamp(wd * 0.5 + 0.5 - d, 0.0, 1.0);
    float tail = pow(clamp(1.0 - behind, 0.0, 1.0), 2.0) * smoothstep(-0.05, 0.0, behind);
    a = line * tail;
  }
  // The head: a small glowing point.
  float hd = length(vec2((head - along) / px, d));
  float glow = exp(-hd / (uWidth * 2.0)) * 0.9 + exp(-hd / (uWidth * 6.0)) * 0.25;
  float alpha = clamp(a + glow, 0.0, 1.0);
  fragColor = vec4(mix(uColor, vec3(1.0), clamp(glow, 0.0, 1.0) * 0.5), alpha);
}`,
  ),
  presets: [
    { name: "Dark", values: { uColor: [0.89, 0.91, 0.94] } },
    { name: "Light", values: { uColor: [0.2, 0.25, 0.33], uWidth: 1 } },
    { name: "Shower", values: { uCount: 50, uSpeed: 1.6, uGap: 0.5, uLength: 0.2 } },
    { name: "Steep", values: { uAngle: 12, uCount: 16, uLength: 0.45 } },
  ],
};

export const backgroundBeams: ShaderEffect = {
  kind: "shader",
  id: "background-beams",
  name: "Background beams",
  description: "Faint curved paths fanning across a dark background, with gradient pulses of light flowing along them.",
  category: "ui",
  tags: ["ui", "background", "hero", "beam", "dark", "saas"],
  source: glsl(
    `// Background beams: faint curves fanning across, with gradient pulses of light running along them.
uniform vec3 uBackground; // @control color default=#05060A label="Background"
uniform vec3 uLine;       // @control color default=#FFFFFF label="Paths"
uniform float uLineAlpha; // @control min=0 max=0.4 default=0.07 label="Path opacity"
uniform vec3 uColorA;     // @control color default=#18CCFC label="Colour A"
uniform vec3 uColorB;     // @control color default=#6344F5 label="Colour B"
uniform vec3 uColorC;     // @control color default=#AE48FF label="Colour C"
uniform int uCount;       // @control min=3 max=24 default=14 label="Paths"
uniform float uSpeed;     // @control min=0 max=2 default=0.35 label="Speed"
uniform float uLength;    // @control min=0.05 max=0.8 default=0.3 label="Pulse length"
uniform float uGlow;      // @control min=0 max=1 default=0.6 label="Glow"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  float x = p.x / aspect;
  vec3 col = uBackground;
  // A dim glow low on the left where the paths start.
  col += mix(uColorB, uColorA, 0.5) * 0.08 * exp(-dot(p - vec2(0.0, 0.1), p - vec2(0.0, 0.1)) * 2.0);
  vec3 light = vec3(0.0);
  float n = float(uCount);
  for (int i = 0; i < 24; i++) {
    if (i >= uCount) break;
    float k = (float(i) + 0.5) / n;
    vec2 h = hash22(vec2(float(i), 3.7));
    float y0 = -0.25 + 0.55 * k;
    float y1 = 0.35 + 0.9 * k;
    float amp = 0.05 + 0.05 * h.x;
    float fr = 2.5 + 2.0 * h.y;
    float ph = 6.28 * h.x;
    float y = mix(y0, y1, x) + amp * sin(x * fr + ph);
    float dy = (y1 - y0) / aspect + amp * fr / aspect * cos(x * fr + ph);
    float d = abs(p.y - y) / sqrt(1.0 + dy * dy) / px;
    if (d > 40.0) continue;
    float line = clamp(1.1 - d, 0.0, 1.0);
    col = mix(col, uLine, line * uLineAlpha);
    // A pulse running left to right, a gradient from its head back along its tail.
    float head = fract(iTime * uSpeed * (0.5 + 0.6 * h.y) / (1.0 + uLength) + h.x) * (1.0 + 2.0 * uLength) - 0.5 * uLength;
    float behind = (head - x) / uLength;
    if (behind > 0.0 && behind < 1.0) {
      float k2 = pow(1.0 - behind, 1.5) * smoothstep(0.0, 0.08, behind);
      vec3 c = behind < 0.5 ? mix(uColorA, uColorB, behind * 2.0) : mix(uColorB, uColorC, behind * 2.0 - 1.0);
      light += c * k2 * (clamp(1.4 - d, 0.0, 1.0) * 1.4 + uGlow * 0.5 * exp(-d / 6.0));
    }
  }
  col += light;
  col = col / (1.0 + max(col - 1.0, 0.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dark", values: { uBackground: [0.02, 0.02, 0.04] } },
    { name: "Ember", values: { uColorA: [1, 0.8, 0.3], uColorB: [1, 0.4, 0.15], uColorC: [0.9, 0.1, 0.35], uBackground: [0.05, 0.02, 0.02] } },
    { name: "Dense", values: { uCount: 24, uSpeed: 0.6, uLength: 0.2, uLineAlpha: 0.05 } },
  ],
};

export const gridSpotlight: ShaderEffect = {
  kind: "shader",
  id: "grid-spotlight",
  name: "Grid spotlight",
  description: "A faint line grid that brightens and glows round the pointer while hovered, fading out at the edges.",
  category: "ui",
  tags: ["ui", "background", "interactive", "hover", "grid", "spotlight", "saas"],
  source: glsl(
    `// Grid spotlight: a faint grid revealed round the pointer (a drifting spotlight while idle), fading at the edges.
uniform vec3 uBackground; // @control color default=#09090B label="Background"
uniform vec3 uLine;       // @control color default=#FFFFFF label="Grid"
uniform vec3 uSpot;       // @control color default=#8B5CF6 label="Spotlight"
uniform float uBase;      // @control min=0 max=0.4 default=0.06 label="Grid at rest"
uniform float uCell;      // @control min=0.02 max=0.25 default=0.07 label="Cell size"
uniform float uRadius;    // @control min=0.05 max=0.8 default=0.28 label="Spotlight size"
uniform float uGlow;      // @control min=0 max=1 default=0.35 label="Spotlight glow"
uniform float uEdge;      // @control min=0 max=1 default=0.4 label="Edge fade"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HOVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec3 hp = hoverPoint(uDemo, 0.85);
  vec2 g = abs(fract(p / uCell + 0.5) - 0.5) * uCell / px;
  float line = clamp(1.0 - min(g.x, g.y), 0.0, 1.0);
  float node = clamp(2.0 - length(g), 0.0, 1.0);
  float d = length(fragCoord - hp.xy) * px;
  float spot = exp(-d * d / (uRadius * uRadius)) * hp.z;
  vec2 uv = fragCoord / iResolution.xy;
  vec2 e = min(uv, 1.0 - uv) * iResolution.xy * px;
  float edge = uEdge > 0.0 ? smoothstep(0.0, 0.5 * uEdge, min(e.x, e.y)) : 1.0;
  float level = (uBase + (1.0 - uBase) * spot * 0.7) * edge;
  vec3 col = uBackground + uSpot * spot * uGlow * 0.25 * edge;
  vec3 ink = mix(uLine, uSpot, 0.5 * spot);
  col = mix(col, ink, clamp(max(line, node * (0.5 + spot)) * level, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dark", values: { uBackground: [0.035, 0.035, 0.043], uLine: [1, 1, 1], uSpot: [0.55, 0.36, 0.96] } },
    { name: "Light", values: { uBackground: [0.98, 0.98, 0.99], uLine: [0.06, 0.09, 0.16], uSpot: [0.15, 0.39, 0.92], uBase: 0.08, uGlow: 0.2 } },
    { name: "Blueprint", values: { uBackground: [0.03, 0.12, 0.3], uLine: [0.6, 0.8, 1], uSpot: [0.4, 0.9, 1], uCell: 0.04, uBase: 0.12 } },
  ],
};

export const dotGrid: ShaderEffect = {
  kind: "shader",
  id: "dot-grid",
  name: "Dot grid",
  description: "A field of dots that swell and glow near the pointer, rippling in a gentle wave while idle.",
  category: "ui",
  tags: ["ui", "background", "interactive", "hover", "dots", "pattern", "saas"],
  source: glsl(
    `// Dot grid: dots swelling and lighting up near the pointer, with a gentle wave running through them.
uniform vec3 uBackground; // @control color default=#0B0B10 label="Background"
uniform vec3 uDot;        // @control color default=#3F3F46 label="Dots"
uniform vec3 uActive;     // @control color default=#22D3EE label="Lit dots"
uniform float uSpacing;   // @control min=0.015 max=0.15 default=0.035 label="Spacing"
uniform float uSize;      // @control min=0.04 max=0.4 default=0.1 label="Dot size"
uniform float uSwell;     // @control min=0 max=3 default=1.6 label="Swell"
uniform float uRadius;    // @control min=0.05 max=0.8 default=0.2 label="Reach"
uniform float uWave;      // @control min=0 max=1 default=0.5 label="Wave"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HOVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec3 hp = hoverPoint(uDemo, 0.8);
  vec2 cell = floor(p / uSpacing);
  vec2 centre = (cell + 0.5) * uSpacing;
  float dc = length(centre - hp.xy * px);
  float k = exp(-dc * dc / (uRadius * uRadius)) * hp.z;
  float wave = uWave * (0.5 + 0.5 * sin(dot(centre, vec2(5.0, 3.0)) * 2.0 - iTime * 1.6));
  float r = min(uSize * uSpacing * (1.0 + uSwell * k + 0.5 * wave), 0.48 * uSpacing);
  float d = length(p - centre);
  float shape = clamp((r - d) / px + 0.5, 0.0, 1.0);
  vec3 dotCol = mix(uDot, uActive, clamp(k + 0.25 * wave * (1.0 - k), 0.0, 1.0));
  vec3 col = uBackground + uActive * 0.12 * k * exp(-max(d - r, 0.0) / (0.3 * uSpacing));
  col = mix(col, dotCol, shape);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dark", values: { uBackground: [0.04, 0.04, 0.06], uDot: [0.25, 0.25, 0.27], uActive: [0.13, 0.83, 0.93] } },
    { name: "Light", values: { uBackground: [1, 1, 1], uDot: [0.82, 0.84, 0.86], uActive: [0.39, 0.4, 0.95] } },
    { name: "Dense", values: { uSpacing: 0.02, uSize: 0.14, uSwell: 2.4, uRadius: 0.15 } },
  ],
};

export const glassCard: ShaderEffect = {
  kind: "shader",
  id: "glass-card",
  name: "Glass card",
  description: "A frosted glass card floating over a picture: the picture blurred behind it, a bright edge, a soft shadow and fine grain.",
  category: "ui",
  video: "filter",
  tags: ["ui", "glass", "glassmorphism", "card", "frosted", "blur", "image"],
  source: glsl(
    `// Glass card: a frosted rounded card over the picture, blurring what is behind it.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uWidth;      // @control min=0.15 max=1 default=0.6 label="Width"
uniform float uHeight;     // @control min=0.15 max=1 default=0.55 label="Height"
uniform float uRadius;     // @control min=0 max=0.3 default=0.05 label="Corner radius"
uniform float uBlur;       // @control min=0 max=0.08 default=0.03 label="Blur"
uniform vec3 uTint;        // @control color default=#FFFFFF label="Tint"
uniform float uTintAlpha;  // @control min=0 max=1 default=0.18 label="Tint strength"
uniform float uEdge;       // @control min=0 max=1 default=0.6 label="Edge light"
uniform float uShadow;     // @control min=0 max=1 default=0.35 label="Shadow"
uniform float uGrain;      // @control min=0 max=0.2 default=0.04 label="Grain"
uniform float uFloat;      // @control min=0 max=1 default=0.3 label="Float"
${BACKDROP_CONTROLS}`,
    HASH,
    BOX,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 centre = 0.5 * iResolution.xy + vec2(0.0, sin(iTime * 1.1) * uFloat * 0.012 * iResolution.y);
  vec2 p = (fragCoord - centre) * px;
  vec2 hs = 0.5 * vec2(uWidth * iResolution.x, uHeight * iResolution.y) * px;
  float rad = min(uRadius, min(hs.x, hs.y));
  float sd = boxSdf(p, hs, rad);
  // A soft shadow under the card, a little below it.
  float shadow = exp(-max(boxSdf(p + vec2(0.0, 0.02), hs, rad), 0.0) / 0.035) * uShadow;
  vec3 col = pic.rgb * (1.0 - 0.6 * shadow * step(0.0, sd));
  float inside = clamp(0.5 - sd / px, 0.0, 1.0);
  if (inside > 0.0) {
    // The picture behind the card, blurred over a disc of taps.
    vec3 sum = vec3(0.0);
    float aspect = iResolution.y / iResolution.x;
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 24.0) * uBlur;
      float a = fi * 2.39996;
      sum += picture(uImage, uv + vec2(cos(a) * aspect, sin(a)) * r);
    }
    vec3 glass = sum / 24.0;
    // Glass lifts the colour a little, then takes the tint.
    float luma = dot(glass, vec3(0.299, 0.587, 0.114));
    glass = mix(vec3(luma), glass, 1.15);
    glass = mix(glass, uTint, uTintAlpha);
    // Lighter towards the top left, like light falling on it.
    glass += uEdge * 0.06 * (0.5 - (p.x / hs.x - p.y / hs.y) * 0.25);
    glass += (hash12(fragCoord) - 0.5) * uGrain;
    // A bright rim, brightest where it faces the light.
    vec2 nrm = normalize(p / max(hs, vec2(1e-3)) + 1e-5);
    float lit = 0.35 + 0.65 * clamp(dot(nrm, normalize(vec2(-0.7, 0.7))), 0.0, 1.0);
    float rim = clamp(1.0 - (abs(sd) - 0.6 * px) / px, 0.0, 1.0);
    glass = mix(glass, vec3(1.0), rim * uEdge * lit);
    glass += uEdge * 0.12 * lit * exp(sd / (6.0 * px));
    col = mix(col, glass, inside);
  }
  fragColor = vec4(col, max(pic.a, inside));
}`,
  ),
  presets: [
    { name: "Light", values: { uTint: [1, 1, 1], uTintAlpha: 0.25, uBlur: 0.035 } },
    { name: "Dark", values: { uTint: [0.06, 0.07, 0.1], uTintAlpha: 0.45, uEdge: 0.35 } },
    { name: "Clear", values: { uBlur: 0.012, uTintAlpha: 0.06, uGrain: 0.02 } },
    { name: "Pill", values: { uWidth: 0.5, uHeight: 0.22, uRadius: 0.3 } },
  ],
};

export const liquidGlass: ShaderEffect = {
  kind: "shader",
  id: "liquid-glass",
  name: "Liquid glass",
  description: "A liquid glass pill over a picture that bends and magnifies what is behind it, with a bright rim, following the pointer.",
  category: "ui",
  video: "interactive",
  tags: ["ui", "interactive", "hover", "glass", "lens", "refraction", "image"],
  source: glsl(
    `// Liquid glass: a glass pill bending the picture strongly near its rim and magnifying it inside; it follows the pointer.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uWidth;       // @control min=0.1 max=1.2 default=0.5 label="Width"
uniform float uHeight;      // @control min=0.06 max=0.8 default=0.2 label="Height"
uniform float uRound;       // @control min=0 max=1 default=1 label="Roundness"
uniform float uRefraction;  // @control min=0 max=1 default=0.55 label="Refraction"
uniform float uZoom;        // @control min=1 max=2 default=1.12 label="Magnify"
uniform float uDispersion;  // @control min=0 max=1 default=0.35 label="Dispersion"
uniform vec3 uTint;         // @control color default=#FFFFFF label="Tint"
uniform float uTintAlpha;   // @control min=0 max=0.6 default=0.06 label="Tint strength"
uniform float uRim;         // @control min=0 max=1 default=0.8 label="Rim light"
uniform bool uDemo;         // @control default=true label="Drift when idle"
${BACKDROP_CONTROLS}`,
    BOX,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 drift = iResolution.xy * (0.5 + vec2(0.22 * sin(iTime * 0.5), 0.18 * sin(iTime * 0.71 + 1.0)));
  vec2 c = mix(uDemo ? drift : 0.5 * iResolution.xy, iPointer.xy, clamp(iPointer.z, 0.0, 1.0));
  vec2 hs = 0.5 * vec2(uWidth, uHeight) * iResolution.y;
  float rad = uRound * min(hs.x, hs.y);
  vec2 q = fragCoord - c;
  float sd = boxSdf(q, hs, rad);
  float bezel = 0.45 * min(hs.x, hs.y);
  vec3 col = pic.rgb;
  // A soft shadow under the glass.
  col *= 1.0 - 0.25 * exp(-max(boxSdf(q + vec2(0.0, 0.12 * bezel), hs, rad), 0.0) / (0.5 * bezel)) * step(0.0, sd);
  float inside = clamp(0.5 - sd, 0.0, 1.0);
  if (inside > 0.0) {
    float e = 1.0;
    vec2 nrm = normalize(vec2(boxSdf(q + vec2(e, 0.0), hs, rad) - boxSdf(q - vec2(e, 0.0), hs, rad),
                              boxSdf(q + vec2(0.0, e), hs, rad) - boxSdf(q - vec2(0.0, e), hs, rad)) + 1e-6);
    // How far into the bezel: 1 at the rim, 0 on the flat middle. The rim bends light the most.
    float rimK = 1.0 - clamp(-sd / bezel, 0.0, 1.0);
    float bend = rimK * rimK * rimK * uRefraction * bezel * 1.6;
    vec2 base = c + q / uZoom - nrm * bend;
    float disp = uDispersion * 0.25 * rimK;
    vec2 off = nrm * bend * disp;
    vec3 glass = vec3(picture(uImage, (base + off) / iResolution.xy).r,
                      picture(uImage, base / iResolution.xy).g,
                      picture(uImage, (base - off) / iResolution.xy).b);
    glass = mix(glass, uTint, uTintAlpha);
    // Specular: a bright rim facing the light at the top left, a fainter one opposite.
    float lit = dot(nrm, normalize(vec2(-0.6, 0.8)));
    float rim = exp(-pow(sd / 1.5, 2.0));
    float spec = pow(max(lit, 0.0), 3.0) + 0.35 * pow(max(-lit, 0.0), 3.0);
    glass += uRim * (rim * (0.35 + 0.65 * spec) + 0.35 * spec * rimK * rimK * rimK);
    glass += uRim * 0.05 * (1.0 - rimK) * (0.5 + 0.5 * q.y / max(hs.y, 1.0));
    col = mix(col, glass, inside);
  }
  fragColor = vec4(col, max(pic.a, inside));
}`,
  ),
  presets: [
    { name: "Lens", values: { uWidth: 0.34, uHeight: 0.34, uZoom: 1.4, uRefraction: 0.7 } },
    { name: "Toolbar", values: { uWidth: 0.9, uHeight: 0.14, uZoom: 1.02, uRefraction: 0.45 } },
    { name: "Smoky", values: { uTint: [0.05, 0.05, 0.08], uTintAlpha: 0.35, uRim: 0.6 } },
  ],
};

export const noiseGrainBg: ShaderEffect = {
  kind: "shader",
  id: "noise-grain-bg",
  name: "Grainy glow background",
  description: "A few soft, blurred colour orbs drifting on a plain background under film grain: the grainy hero background.",
  category: "ui",
  tags: ["ui", "background", "hero", "grain", "blur", "soft", "saas"],
  source: glsl(
    `// Grainy glow background: soft colour orbs drifting on a plain ground, under film grain.
uniform vec3 uBackground; // @control color default=#0B0B14 label="Background"
uniform vec3 uColorA;     // @control color default=#7C3AED label="Colour A"
uniform vec3 uColorB;     // @control color default=#EC4899 label="Colour B"
uniform vec3 uColorC;     // @control color default=#06B6D4 label="Colour C"
uniform float uSize;      // @control min=0.1 max=1.2 default=0.45 label="Orb size"
uniform float uStrength;  // @control min=0 max=1 default=0.75 label="Strength"
uniform float uSpeed;     // @control min=0 max=2 default=0.25 label="Speed"
uniform float uGrain;     // @control min=0 max=0.4 default=0.12 label="Grain"`,
    HASH,
    OKLAB_MIX,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x * px;
  float t = iTime * uSpeed;
  vec2 pa = vec2(-0.3 * aspect, 0.25) + 0.15 * vec2(sin(t * 0.9), cos(t * 0.7));
  vec2 pb = vec2(0.25 * aspect, 0.2) + 0.15 * vec2(cos(t * 0.6 + 1.0), sin(t * 0.8));
  vec2 pc = vec2(0.05 * aspect, -0.3) + 0.15 * vec2(sin(t * 0.5 + 2.0), cos(t * 1.1));
  float s2 = uSize * uSize;
  vec3 col = uBackground;
  col = oklabMix(col, uColorA, uStrength * exp(-dot(p - pa, p - pa) / s2));
  col = oklabMix(col, uColorB, uStrength * exp(-dot(p - pb, p - pb) / s2));
  col = oklabMix(col, uColorC, uStrength * exp(-dot(p - pc, p - pc) / (s2 * 0.8)));
  // Film grain, fresh every frame at 24 fps; stronger in the mid-tones, as on film.
  float g = hash12(fragCoord + floor(iTime * 24.0) * 17.31) - 0.5;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * (0.6 + 1.6 * luma * (1.0 - luma));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dark", values: { uBackground: [0.04, 0.04, 0.08] } },
    { name: "Light", values: { uBackground: [0.97, 0.97, 0.99], uColorA: [0.77, 0.71, 0.99], uColorB: [0.98, 0.66, 0.83], uColorC: [0.6, 0.91, 0.96], uStrength: 0.85, uGrain: 0.08 } },
    { name: "Sunrise", values: { uBackground: [0.08, 0.03, 0.05], uColorA: [1, 0.45, 0.2], uColorB: [1, 0.75, 0.3], uColorC: [0.85, 0.2, 0.5] } },
  ],
};

export const uiShaders: ShaderEffect[] = [borderBeam, gradientBorder, meteors, backgroundBeams, gridSpotlight, dotGrid, glassCard, liquidGlass, noiseGrainBg];
