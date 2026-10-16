import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/**
 * `meltCycle(rate)`: how melted, 0–1, over an 8 s loop: it melts (faster
 * with a higher rate), holds, then reforms back to solid before the loop
 * starts again.
 */
const MELT_CYCLE = `
float meltCycle(float rate) {
  float u = fract(iTime / 8.0);
  float m = clamp(min(u, 0.62) * 2.0 * rate, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  return m * (1.0 - smoothstep(0.74, 0.97, u));
}`.trim();

/** `smin(a, b, k)`: a smooth minimum of two distances, blending over `k`. */
const SMIN = `
float smin(float a, float b, float k) {
  k = max(k, 1e-4);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`.trim();

/**
 * `liquidShade(base, n, gloss)`: a glossy liquid surface of colour `base`
 * with normal `n`, lit from the upper left.
 */
const LIQUID_SHADE = `
vec3 liquidShade(vec3 base, vec3 n, float gloss) {
  vec3 l = normalize(vec3(-0.5, 0.65, 0.85));
  float diff = clamp(dot(n, l), 0.0, 1.0);
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
  float rim = pow(1.0 - n.z, 2.0);
  return base * (0.45 + 0.7 * diff) * (1.0 - 0.35 * rim) + vec3(spec) * gloss + rim * 0.12 * gloss;
}`.trim();

export const dripMelt: ShaderEffect = {
  kind: "shader",
  id: "drip-melt",
  name: "Drip melt",
  description: "An image melting from the top edge down: columns slump, thick glossy drips run down and pool in a puddle, then it all reforms.",
  category: "melt",
  video: "filter",
  tags: ["melt", "image", "drip", "liquid", "glossy", "loop"],
  loop: 8,
  source: glsl(
    `// Drip melt: the top edge slumps, glossy drips run down the picture and pool at the bottom.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uDrips;         // @control min=3 max=32 default=14 label="Drip count"
uniform float uSpeed;       // @control min=0.25 max=3 default=1 label="Melt speed"
uniform float uViscosity;   // @control min=0.004 max=0.04 default=0.02 label="Viscosity (drip width)"
uniform float uGloss;       // @control min=0 max=1.5 default=0.8 label="Gloss"
uniform vec3 uBackground;   // @control color default=#17121F label="Behind"
uniform bool uAnimate;      // @control default=true label="Animate"
uniform float uProgress;    // @control min=0 max=1 default=0.7 label="Melt (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    MELT_CYCLE,
    SMIN,
    LIQUID_SHADE,
    `float aspect = 1.0;

// Where the picture's top edge has slumped to at x.
float edgeY(float x, float m) {
  return 1.0 - m * (0.04 + 0.3 * smoothstep(0.25, 0.7, fbm(vec2(x * 3.5, 1.7), 3)));
}

// The puddle's surface at x.
float poolY(float x, float m) {
  return m * (0.1 + 0.012 * sin(x * 9.0 + iTime * 0.7854) + 0.025 * vnoise(vec2(x * 6.0, 2.0))) - 0.006;
}

// Distance to the liquid (negative inside): a lip along the slumped edge, drips hanging from it, the puddle.
float liquid(vec2 uv, float m) {
  float n = float(uDrips);
  float grow = smoothstep(0.0, 0.2, m);
  float e = edgeY(uv.x, m) + 0.01 * (1.0 - grow);
  float lip = 0.022 * grow;
  float d = max(uv.y - e, e - lip - uv.y);
  float c = floor(uv.x * n);
  for (int k = -2; k <= 2; k++) {
    float ci = c + float(k);
    vec2 h = hash22(vec2(ci, 3.1));
    float xi = (ci + 0.2 + 0.6 * h.x) / n;
    float w = min(uViscosity * (0.7 + 0.6 * hash12(vec2(ci, 7.7))), 0.6 * aspect / n) * grow;
    float top = edgeY(xi, m) - lip * 0.5;
    float len = pow(m, 1.4) * min(0.2 + 0.95 * h.y, 1.0) * max(top - poolY(xi, m), 0.0);
    float head = top - len;
    float along = clamp(uv.y, head, top);
    // A stem thinning as it runs, then a round, heavier head.
    float r = w * mix(0.85, 0.6, smoothstep(top, top - 0.3, uv.y));
    r = mix(r, w * 1.3, smoothstep(head + 3.0 * w, head, uv.y));
    d = smin(d, length(vec2((uv.x - xi) * aspect, uv.y - along)) - r, 0.012 * grow);
  }
  return smin(d, uv.y - poolY(uv.x, m), 0.03 * grow);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  aspect = iResolution.x / iResolution.y;
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  float m = uAnimate ? meltCycle(uSpeed) : uProgress;

  // The picture slumped under its edge: squashed towards the bottom, stretched thin at the top.
  float e = edgeY(uv.x, m);
  float h = clamp(uv.y / e, 0.0, 1.0);
  float ys = 1.0 - pow(1.0 - h, 1.0 + m * 1.3);
  float xs = uv.x + m * 0.006 * sin(uv.y * 40.0 + uv.x * 13.0);
  vec4 col = pictureRGBA(uImage, vec2(xs, ys));
  vec4 behind = vec4(uBackground * (0.75 + 0.5 * uv.y), uBackdropAlpha);
  col = mix(col, behind, smoothstep(e - px, e + px, uv.y));

  // The liquid's shadow, down and to the right.
  float shadow = liquid(uv + vec2(-0.004, 0.009), m);
  col.rgb *= 1.0 - 0.4 * smoothstep(0.012, -0.004, shadow) * smoothstep(0.0, 0.1, m);

  float d = liquid(uv, m);
  if (d < 4.0 * px) {
    float eps = 0.0015;
    vec2 g = vec2(liquid(uv + vec2(eps / aspect, 0.0), m) - d, liquid(uv + vec2(0.0, eps), m) - d);
    g /= max(length(g), 1e-5);
    float thick = sqrt(clamp(-d / 0.018, 0.0, 1.0));
    vec3 nrm = normalize(vec3(g * (1.0 - thick) * 1.6, 0.4 + thick));
    // Drips carry the colour of the top edge down; the puddle is everything mixed.
    vec4 top = pictureRGBA(uImage, vec2(uv.x + 0.01 * sin(uv.y * 25.0), 0.965));
    float sx = uv.x + 0.04 * sin(uv.x * 11.0 + uv.y * 30.0);
    vec4 pool = (pictureRGBA(uImage, vec2(sx - 0.06, 0.25)) + pictureRGBA(uImage, vec2(sx + 0.06, 0.4)) + pictureRGBA(uImage, vec2(sx, 0.9))) / 3.0;
    float inPool = smoothstep(poolY(uv.x, m) + 0.04, poolY(uv.x, m) - 0.01, uv.y);
    vec4 base = mix(top, pool, inPool);
    base.rgb *= 0.9 + 0.12 * vnoise(vec2(uv.x * 90.0, uv.y * 3.0));
    vec3 wet = liquidShade(base.rgb * 1.05, nrm, uGloss);
    col = mix(col, vec4(wet, base.a), smoothstep(px, -px, d));
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Meltdown", values: { uDrips: 22, uSpeed: 1.6, uViscosity: 0.012, uGloss: 1 } },
    { name: "Syrup", values: { uDrips: 7, uSpeed: 0.6, uViscosity: 0.032, uGloss: 1.3 } },
    { name: "City at night", values: { uImage: SAMPLE_IMAGES.city, uBackground: [0.02, 0.02, 0.05] } },
  ],
};

export const heatHaze: ShaderEffect = {
  kind: "shader",
  id: "heat-haze",
  name: "Heat haze",
  description: "A mirage shimmer rising off a hot image: wavering refraction strongest near the ground, with a warm tint and a faint reflection.",
  category: "melt",
  video: "filter",
  tags: ["melt", "image", "heat", "mirage", "shimmer", "desert", "distortion"],
  source: glsl(
    `// Heat haze: rising, wavering refraction over a picture, strongest near the bottom.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uStrength;   // @control min=0 max=1 default=0.5 label="Strength"
uniform float uScale;      // @control min=1 max=20 default=7 label="Scale"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uHeight;     // @control min=0.1 max=1 default=0.8 label="Height"
uniform vec3 uTint;        // @control color default=#FFB070 label="Warm tint"
uniform float uWarmth;     // @control min=0 max=1 default=0.3 label="Tint amount"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  float heat = smoothstep(uHeight, 0.0, uv.y);
  // Rising turbulence, stretched upwards, and a fast horizontal waver through it.
  vec2 q = vec2(uv.x * aspect * uScale, uv.y * uScale * 1.6 - t * 1.4);
  float a = fbm(q, 4);
  float b = fbm(q + vec2(5.2, 1.3) + a, 4);
  vec2 off = vec2(a - 0.5, b - 0.5) * 0.05;
  off.x += sin(uv.y * uScale * 14.0 - t * 5.0 + a * 6.0) * 0.01;
  off *= uStrength * heat;
  vec2 st = uv + off;
  // A touch of colour fringing where the air bends light the most.
  float fringe = 0.25 * length(off);
  vec4 r = pictureRGBA(uImage, st + vec2(fringe, 0.0));
  vec4 g = pictureRGBA(uImage, st);
  vec4 b2 = pictureRGBA(uImage, st - vec2(fringe, 0.0));
  vec3 col = vec3(r.r, g.g, b2.b);
  float alpha = max(max(r.a, g.a), b2.a);
  // An inferior mirage: just above the ground, what sits above it shows again, flipped and shimmering.
  float y0 = 0.05 + 0.15 * uHeight;
  float below = smoothstep(y0, 0.0, uv.y) * (0.6 + 0.4 * b);
  vec4 mirage = pictureRGBA(uImage, vec2(st.x, y0 + (y0 - uv.y) * 1.4 + off.y * 2.0));
  col = mix(col, mirage.rgb, below * uStrength * 0.55);
  alpha = mix(alpha, mirage.a, below * uStrength * 0.55);
  // Warm, slightly hazy air.
  col = mix(col, col * mix(vec3(1.0), uTint * 1.35, uWarmth), heat);
  col = mix(col, uTint, heat * uWarmth * 0.12 * (0.7 + 0.6 * a));
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "Desert noon", values: { uStrength: 0.85, uScale: 9, uHeight: 0.75, uWarmth: 0.55 } },
    { name: "Asphalt", values: { uStrength: 0.6, uScale: 14, uSpeed: 1.8, uHeight: 0.35, uWarmth: 0.15, uTint: [1, 0.85, 0.7] } },
    { name: "City exhaust", values: { uImage: SAMPLE_IMAGES.city, uStrength: 0.5, uHeight: 0.5, uTint: [0.75, 0.85, 1], uWarmth: 0.2 } },
  ],
};

export const waxMelt: ShaderEffect = {
  kind: "shader",
  id: "wax-melt",
  name: "Wax melt",
  description: "A silhouette softening like warm wax: its edges round off, its top sags and it slumps into a glossy puddle, then sets again.",
  category: "melt",
  video: "none",
  tags: ["melt", "wax", "text", "silhouette", "glossy", "loop"],
  loop: 8,
  source: glsl(
    `// Wax melt: an alpha mask softening, sagging and spreading into a puddle.
uniform sampler2D uMask;    // @control filter=linear wrap=clamp default=${textImage("WAX")} label="Shape (alpha)"
uniform vec3 uColor;        // @control color default=#E8452C label="Wax"
uniform vec3 uBackground;   // @control color default=#1C1A22 label="Background"
uniform float uGloss;       // @control min=0 max=1.5 default=0.8 label="Gloss"
uniform float uSize;        // @control min=0.3 max=1 default=0.85 label="Size"
uniform bool uAnimate;      // @control default=true label="Animate"
uniform float uProgress;    // @control min=0 max=1 default=0.6 label="Melt (when still)"`,
    HASH,
    NOISE,
    FBM,
    MELT_CYCLE,
    LIQUID_SHADE,
    `const float BASE = -0.14;

// The mask's alpha at frame point s (height 1, centred), contained in uSize of the frame.
float shape(vec2 s, out float halfWidth, out float bottom) {
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize * 0.7, frame * uSize / aspect);
  halfWidth = 0.42 * h * aspect;
  // A text image's letters sit on a line about 0.27 of its height below the middle.
  bottom = -0.27 * h;
  vec2 uv = s / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uMask, uv).a;
}

// How much wax covers frame point p, 0–1, soft at the edges (softer still by soft): the sagging, spreading shape and its puddle.
float wax(vec2 p, float m, float soft) {
  float halfWidth;
  float bottom;
  shape(vec2(0.0), halfWidth, bottom);
  float dy = p.y - BASE;
  // The top sags (more in some places than others), the base spreads, and it wobbles a little as it goes.
  float sag = 1.0 + (0.25 * m + 1.6 * m * m * m) * (0.6 + 0.8 * fbm(vec2(p.x * 3.0, 4.0), 3));
  float spread = 1.0 + m * 0.4 * exp(-max(dy, 0.0) * 7.0);
  vec2 s = vec2(p.x / spread + m * 0.012 * sin(dy * 30.0 + p.x * 8.0), bottom + dy * sag);
  // Softened: the mask averaged over a disc that widens as it melts, so corners round off.
  float r = 0.004 + 0.022 * m + soft;
  float sum = shape(s, halfWidth, bottom) * 2.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    vec2 dir = vec2(cos(a), sin(a));
    sum += shape(s + dir * r * 0.5, halfWidth, bottom) + shape(s + dir.yx * vec2(-1.0, 1.0) * r, halfWidth, bottom);
  }
  float cover = dy < 0.0 ? 0.0 : sum / 14.0;
  // The puddle, growing out from under the shape, its rim lumpy.
  float rx = halfWidth * (0.25 + 0.8 * m);
  float ry = (0.008 + 0.05 * m) * (1.0 + 0.15 * sin(p.x * 17.0 + 1.0));
  vec2 e = vec2(p.x / rx, (p.y - BASE) / ry);
  float pool = smoothstep(0.012 + soft, -0.012 - soft, (length(e) - 1.0) * ry) * smoothstep(0.03, 0.25, m);
  return cover + pool - cover * pool;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float m = uAnimate ? meltCycle(1.0) : uProgress;
  // Background: a soft spot of light on a table top.
  vec3 col = uBackground * (1.0 + 0.6 * exp(-dot(p, p) * 3.0));
  col = mix(col, uBackground * 0.6, smoothstep(BASE + 0.02, BASE - 0.1, p.y));
  float shade = wax(p + vec2(-0.012, 0.02), m, 0.01);
  col *= 1.0 - 0.45 * smoothstep(0.2, 0.7, shade) * smoothstep(BASE + 0.25, BASE - 0.05, p.y);

  float c = wax(p, m, 0.0);
  float px = 1.5 / iResolution.y;
  float edge = smoothstep(0.5 - 0.06, 0.5 + 0.06, c);
  if (c > 0.3) {
    // The surface's slope from a softer copy, so the letters bulge like poured wax.
    float eps = 0.01;
    float soft = 0.014;
    vec2 g = vec2(wax(p + vec2(eps, 0.0), m, soft) - wax(p - vec2(eps, 0.0), m, soft), wax(p + vec2(0.0, eps), m, soft) - wax(p - vec2(0.0, eps), m, soft)) / (2.0 * eps);
    float thick = smoothstep(0.3, 1.0, c);
    vec3 nrm = normalize(vec3(-g * 0.03, 1.0));
    // Thin wax lets light through: warmer and brighter at the edges, deeper in the middle.
    vec3 deep = uColor * 0.7;
    vec3 glow = min(uColor * uColor * 1.6 + vec3(0.08, 0.03, 0.0), vec3(1.0));
    vec3 base = mix(glow, deep, thick);
    vec3 lit = liquidShade(base, nrm, uGloss * (0.35 + 0.65 * m));
    col = mix(col, lit, edge);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Beeswax", values: { uColor: [0.95, 0.75, 0.32], uBackground: [0.12, 0.09, 0.06] } },
    { name: "Candle white", values: { uColor: [0.95, 0.92, 0.85], uBackground: [0.08, 0.09, 0.14], uGloss: 1.1 } },
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uColor: [0.86, 0.12, 0.28], uSize: 0.6 } },
  ],
};

export const meltingText: ShaderEffect = {
  kind: "shader",
  id: "melting-text",
  name: "Melting text",
  description: "Letters sagging and stretching downwards as long glossy drips run from their bottoms and droplets break off and fall.",
  category: "melt",
  video: "none",
  tags: ["melt", "text", "title", "drip", "liquid", "glossy", "loop"],
  loop: 8,
  transparent: true,
  source: glsl(
    `// Melting text: letters sag, drips run from their bottoms, droplets fall.
uniform sampler2D uText;        // @control filter=linear wrap=clamp default=${textImage("MELT")} label="Text"
uniform vec3 uColor;            // @control color default=#FF3D6E label="Liquid"
uniform vec3 uHighlight;        // @control color default=#FFFFFF label="Highlight"
uniform float uGloss;           // @control min=0 max=1.5 default=0.9 label="Gloss"
uniform float uDrip;            // @control min=0.2 max=1.5 default=1 label="Drip length"
uniform float uSize;            // @control min=0.3 max=1 default=0.85 label="Text size"
uniform vec3 uBackground;       // @control color default=#120E1A label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.7 label="Melt (when still)"`,
    HASH,
    NOISE,
    FBM,
    MELT_CYCLE,
    SMIN,
    `const float RAISE = 0.14;
float textH = 0.3;
float textW = 1.0;

// The text image's alpha at frame point p (text raised by RAISE to leave room for drips).
float letters(vec2 p) {
  vec2 uv = (p - vec2(0.0, RAISE)) / vec2(textW, textH) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

// Distance to the liquid (about; negative inside) at frame point p, m of the way melted.
float liquid(vec2 p, float m) {
  float top = RAISE + 0.29 * textH;
  float baseline = RAISE - 0.24 * textH;
  // Letters stretch down from their tops, some columns further than others.
  float stretch = 1.0 + m * (0.25 + 0.35 * fbm(vec2(p.x * 4.0, 1.0), 3));
  vec2 s = vec2(p.x + m * 0.008 * sin(p.y * 30.0), top - (top - p.y) / stretch);
  float r = 0.003 + 0.006 * m;
  float cover = letters(s) * 2.0;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5708 + 0.785;
    cover += letters(s + vec2(cos(a), sin(a)) * r);
  }
  cover /= 6.0;
  float d = (0.5 - cover) * 0.02;
  // Drips from the bottoms of the letters, each with a droplet that breaks off now and then.
  float grow = smoothstep(0.0, 0.25, m);
  float cell = 0.13 * textH;
  float c = floor(p.x / cell);
  for (int k = -1; k <= 1; k++) {
    float ci = c + float(k);
    vec2 h = hash22(vec2(ci, 11.3));
    float xi = (ci + 0.25 + 0.5 * h.x) * cell;
    float colStretch = 1.0 + m * (0.25 + 0.35 * fbm(vec2(xi * 4.0, 1.0), 3));
    float root = top - (top - baseline) * colStretch;
    // Only where a letter stands on the line, and not every one.
    float on = step(0.5, letters(vec2(xi, baseline + 0.04 * textH))) * step(0.25, hash12(vec2(ci, 2.7)));
    if (on < 0.5) continue;
    float w = textH * (0.03 + 0.025 * h.y) * grow;
    float len = uDrip * pow(m, 1.3) * (0.06 + 0.3 * hash12(vec2(ci, 5.9)));
    float head = root - len;
    float along = clamp(p.y, head, root + 0.06 * textH);
    float rr = w * mix(1.0, 0.6, smoothstep(root, root - 0.08, p.y));
    rr = mix(rr, w * 1.25, smoothstep(head + 2.5 * w, head, p.y));
    d = smin(d, length(vec2(p.x - xi, p.y - along)) - rr, 0.01 * grow);
    // The droplet: swells at the tip, lets go and falls, every 2 s once it is well melted.
    float phase = fract(iTime * 0.5 + h.y);
    float fall = phase * phase * 1.4;
    float drop = w * 1.1 * smoothstep(0.35, 0.65, m) * step(0.5, hash12(vec2(ci, 8.1)));
    d = min(d, length(vec2(p.x - xi, p.y - (head - w * 1.8 - fall))) - drop * (1.0 - 0.3 * phase));
  }
  return d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  textH = min(uSize * 0.6, frame * uSize / aspect);
  textW = textH * aspect;
  float m = uAnimate ? meltCycle(1.0) : uProgress;
  float px = 1.0 / iResolution.y;

  float d = liquid(p, m);
  float cover = smoothstep(px, -px, d);
  vec4 col = vec4(uBackground, uBackgroundAlpha);
  if (d < 2.0 * px) {
    float eps = 0.0015;
    vec2 g = vec2(liquid(p + vec2(eps, 0.0), m) - d, liquid(p + vec2(0.0, eps), m) - d);
    g /= max(length(g), 1e-5);
    float thick = sqrt(clamp(-d / 0.012, 0.0, 1.0));
    vec3 n = normalize(vec3(g * (1.0 - thick) * 1.8, 0.35 + thick));
    vec3 l = normalize(vec3(-0.5, 0.7, 0.8));
    float diff = clamp(dot(n, l), 0.0, 1.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
    // Darker and richer where it runs thin, like a coloured syrup.
    vec3 body = mix(uColor * uColor * 0.8, uColor, thick) * (0.5 + 0.65 * diff);
    body += uHighlight * (spec * uGloss + pow(1.0 - n.z, 3.0) * 0.15 * uGloss);
    col = mix(col, vec4(body, 1.0), cover);
  }
  fragColor = vec4(col.rgb, col.a);
}`,
  ),
  presets: [
    { name: "Slime", values: { uColor: [0.45, 0.9, 0.2], uHighlight: [0.9, 1, 0.8], uDrip: 1.3 } },
    { name: "Chocolate", values: { uText: textImage("SWEET"), uColor: [0.42, 0.22, 0.12], uHighlight: [1, 0.9, 0.8], uBackground: [0.98, 0.93, 0.85], uBackgroundAlpha: 1 } },
    { name: "Gold", values: { uColor: [1, 0.76, 0.25], uHighlight: [1, 0.98, 0.85], uGloss: 1.3, uBackgroundAlpha: 1 } },
  ],
};

export const liquify: ShaderEffect = {
  kind: "shader",
  id: "liquify",
  name: "Liquify",
  description: "An image pushed and smeared like wet paint by a moving brush (or the pointer), the smears slowly relaxing back.",
  category: "melt",
  video: "filter",
  tags: ["melt", "image", "liquify", "smear", "paint", "interactive", "hover"],
  source: glsl(
    `// Liquify: a brush pushes the picture around; its recent path leaves smears that relax over time.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uBrush;      // @control min=0.05 max=0.5 default=0.17 label="Brush size"
uniform float uStrength;   // @control min=0 max=2 default=0.8 label="Strength"
uniform float uRelax;      // @control min=0.2 max=5 default=1.2 label="Relax"
uniform float uSpeed;      // @control min=0 max=2 default=1 label="Brush speed"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// The brush at time t (frame units, height 1): a Lissajous path, or stirring round the pointer while it hovers.
vec2 brush(float t) {
  float aspect = iResolution.x / iResolution.y;
  vec2 path = vec2(0.36 * aspect * sin(t * 0.9), 0.3 * sin(t * 1.37 + 0.6));
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec2 stir = pointer + 0.05 * vec2(cos(t * 4.0), sin(t * 4.0));
  return mix(path, stir, iPointer.z);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed * 1.4;
  float dt = 0.14;
  vec2 disp = vec2(0.0);
  float wet = 0.0;
  // Each of the brush's recent places pushes paint the way it was going and twists it a little, fading as it relaxes.
  for (int k = 0; k < 10; k++) {
    float tk = t - float(k) * dt;
    vec2 b = brush(tk);
    vec2 v = b - brush(tk - dt);
    vec2 d = p - disp - b;
    float f = exp(-dot(d, d) / (uBrush * uBrush));
    float fade = exp(-float(k) * dt * uRelax / max(uSpeed * 1.4, 0.05));
    vec2 twist = vec2(-d.y, d.x) * length(v) * 4.0;
    disp += (v * 1.3 + twist) * f * fade * uStrength;
    wet += f * fade;
  }
  vec2 uv = (p - disp) * vec2(iResolution.y / iResolution.x, 1.0) + 0.5;
  vec4 pic = pictureRGBA(uImage, uv);
  // Wet paint catches a little light along the smears.
  float sheen = clamp(dot(disp, normalize(vec2(-0.6, 0.8))) * 12.0, -1.0, 1.0);
  vec3 col = pic.rgb * (1.0 + 0.05 * sheen * min(wet, 1.0) * min(uStrength, 1.0));
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Finger paint", values: { uBrush: 0.25, uStrength: 1.6, uRelax: 0.5 } },
    { name: "Quick flick", values: { uBrush: 0.1, uStrength: 0.8, uRelax: 3, uSpeed: 1.8 } },
    { name: "Landscape", values: { uImage: SAMPLE_IMAGES.landscape, uStrength: 1.2 } },
  ],
};

export const daliClock: ShaderEffect = {
  kind: "shader",
  id: "dali-clock",
  name: "Melting clock",
  description: "A pocket-watch face draped over a ledge like Dalí's soft clocks, its lower half hanging and stretching as the hands keep turning.",
  category: "melt",
  tags: ["melt", "clock", "surreal", "dali", "time", "desert"],
  source: glsl(
    `// Melting clock: a clock face drooping over a ledge in a desert.
uniform vec3 uSkyTop;      // @control color default=#24467E label="Sky"
uniform vec3 uHorizon;     // @control color default=#F2C48D label="Horizon"
uniform vec3 uSand;        // @control color default=#B98B57 label="Sand"
uniform vec3 uLedge;       // @control color default=#5E4434 label="Ledge"
uniform vec3 uFace;        // @control color default=#F1E6CC label="Clock face"
uniform vec3 uCase;        // @control color default=#C9A048 label="Clock case"
uniform float uSag;        // @control min=0 max=1.5 default=1 label="Droop"
uniform float uSpeed;      // @control min=0 max=4 default=1 label="Clock speed"`,
    HASH,
    NOISE,
    FBM,
    `const float LEDGE_Y = 0.0;
const float LEDGE_X = 0.42;
const float R = 0.24;
const vec2 CENTRE = vec2(0.14, -0.02);

// Clock-face point (relative to CENTRE, unmelted) shown at frame point w; .z is how far it hangs, 0 on the ledge.
vec3 unmelt(vec2 w) {
  float sag = uSag;
  if (w.y >= LEDGE_Y) {
    // Lying back on the ledge top: foreshortened.
    return vec3(w.x - CENTRE.x, LEDGE_Y + (w.y - LEDGE_Y) / 0.5 - CENTRE.y, 0.0);
  }
  // Hanging: material further down is stretched more, narrows, sways and ripples.
  float d = LEDGE_Y - w.y;
  float k = 2.4 * sag + 1e-3;
  float u = (-1.0 + sqrt(1.0 + 4.0 * k * d)) / (2.0 * k);
  float sway = (0.05 * sin(iTime * 0.9) + 0.02 * sin(iTime * 2.1)) * sag * u * u * 8.0;
  float x = w.x - sway - 0.012 * sag * sin(u * 25.0 + iTime);
  float narrow = 1.0 + 0.75 * sag * smoothstep(0.0, R * 1.2, u) * u / R;
  return vec3((x - CENTRE.x) * narrow, LEDGE_Y - u - CENTRE.y, u);
}

// The clock at face point q: rgb, coverage in a.
vec4 clockFace(vec2 q, float aa) {
  float r = length(q);
  float ang = atan(q.x, q.y);
  // Winding crown at twelve.
  float crown = max(abs(q.x) - 0.025, abs(q.y - R - 0.025) - 0.022);
  float body = min(r - R, crown);
  float cover = smoothstep(aa, -aa, body);
  if (cover <= 0.0) return vec4(0.0);
  vec3 col = uFace * (1.0 - 0.18 * smoothstep(0.4 * R, R, r));
  // Hour ticks (long at the quarters) and minute ticks.
  float hourA = ang / 0.5236;
  float hourD = abs(hourA - floor(hourA + 0.5)) * 0.5236 * r;
  float quarter = step(mod(floor(hourA + 0.5), 3.0), 0.5);
  float hourTick = smoothstep(0.012 + 0.006 * quarter + aa, 0.012 + 0.006 * quarter - aa, hourD) * step(R * (0.68 - 0.08 * quarter), r) * step(r, R * 0.86);
  float minA = ang / 0.10472;
  float minD = abs(minA - floor(minA + 0.5)) * 0.10472 * r;
  float minTick = smoothstep(0.003 + aa, 0.003 - aa, minD) * step(R * 0.8, r) * step(r, R * 0.86);
  col = mix(col, vec3(0.12, 0.1, 0.09), max(hourTick, minTick));
  // Hands: the minute hand goes round in 12 s, the hour hand in 144 s, the second hand in 4 s.
  float t = iTime * uSpeed;
  for (int i = 0; i < 3; i++) {
    float a = i == 0 ? t * 0.5236 / 12.0 : i == 1 ? t * 0.5236 : t * 1.5708;
    float len = i == 0 ? 0.5 * R : i == 1 ? 0.75 * R : 0.8 * R;
    float width = i == 0 ? 0.012 : i == 1 ? 0.008 : 0.003;
    vec2 dir = vec2(sin(a), cos(a));
    float along = clamp(dot(q, dir), -0.04, len);
    float hd = length(q - dir * along) - width;
    vec3 ink = i == 2 ? vec3(0.7, 0.15, 0.1) : vec3(0.1, 0.09, 0.08);
    col = mix(col, ink, smoothstep(aa, -aa, hd));
  }
  col = mix(col, uCase * 0.7, smoothstep(aa, -aa, r - 0.014));
  // The case: a bevelled ring and the crown.
  float ringD = max(body, -(r - R * 0.9));
  float bevel = 0.75 + 0.5 * dot(normalize(q + 1e-5), normalize(vec2(-0.6, 0.8)));
  col = mix(col, uCase * bevel, smoothstep(aa, -aa, min(ringD, crown)));
  return vec4(col, cover);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 w = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aa = 1.5 / iResolution.y;
  // Desert: sky, far cliffs and sand.
  float horizon = -0.18;
  vec3 col = mix(uHorizon, uSkyTop, smoothstep(horizon, 0.5, w.y));
  float cliffs = horizon + 0.05 + 0.12 * fbm(vec2(w.x * 2.5 + 3.0, 0.0), 4) * smoothstep(-0.2, 0.9, w.x);
  col = mix(col, mix(uSand, uSkyTop, 0.35) * 0.9, smoothstep(aa, -aa, w.y - cliffs));
  col = mix(col, uSand * (0.75 + 0.5 * smoothstep(-0.5, horizon, w.y)), smoothstep(aa, -aa, w.y - horizon));
  // The ledge: a block with a lit top and a front face in shade.
  float top = LEDGE_Y + 0.15;
  float inBlock = step(w.x, LEDGE_X);
  col = mix(col, uLedge * 1.35, inBlock * smoothstep(aa, -aa, w.y - top) * smoothstep(-aa, aa, w.y - LEDGE_Y));
  col = mix(col, uLedge * (0.8 - 0.3 * smoothstep(LEDGE_Y, -0.5, w.y)), inBlock * smoothstep(aa, -aa, w.y - LEDGE_Y));
  col = mix(col, uLedge * 0.5, smoothstep(aa, -aa, abs(w.x - LEDGE_X) - 0.002) * step(w.y, top));
  // The clock's shadow on the ledge, then the clock.
  vec3 sq = unmelt(w + vec2(-0.03, 0.025));
  float shadow = smoothstep(0.01, -0.01, length(sq.xy) - R) * inBlock;
  col *= 1.0 - 0.4 * shadow * step(w.y, top);
  vec3 q = unmelt(w);
  float stretch = 1.0 + q.z * 6.0 * uSag;
  vec4 clock = clockFace(q.xy, aa * stretch);
  // Shade the fold at the ledge's edge and the far side of the hanging part.
  float fold = exp(-pow((w.y - LEDGE_Y) / 0.02, 2.0));
  clock.rgb *= (q.z > 0.0 ? 0.88 - 0.2 * smoothstep(0.0, 0.3, q.z) : 1.0) * (1.0 - 0.3 * fold);
  clock.rgb += 0.15 * fold * smoothstep(LEDGE_Y - 0.01, LEDGE_Y + 0.02, w.y);
  col = mix(col, clock.rgb, clock.a);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dusk", values: { uSkyTop: [0.17, 0.12, 0.35], uHorizon: [0.98, 0.55, 0.4], uSand: [0.55, 0.36, 0.3] } },
    { name: "Very soft", values: { uSag: 1.5, uSpeed: 0.4 } },
  ],
};

export const lavaFlow: ShaderEffect = {
  kind: "shader",
  id: "lava-flow",
  name: "Lava flow",
  description: "Glowing molten rock oozing downhill, dark cooling crust plates cracking apart over bright flowing lava.",
  category: "melt",
  tags: ["melt", "lava", "fire", "volcano", "glow", "background"],
  source: glsl(
    `// Lava flow: crust plates (Voronoi cells) drifting downhill over brighter, faster lava.
uniform float uSpeed;      // @control min=0 max=2 default=0.5 label="Flow speed"
uniform float uCrust;      // @control min=0 max=1 default=0.6 label="Crust"
uniform float uScale;      // @control min=2 max=12 default=5 label="Scale"
uniform vec3 uHot;         // @control color default=#FFE27A label="Hottest"
uniform vec3 uLava;        // @control color default=#FF4A0A label="Lava"
uniform vec3 uCrustColor;  // @control color default=#1C1310 label="Crust colour"
uniform float uGlow;       // @control min=0 max=2 default=1 label="Heat glow"`,
    HASH,
    NOISE,
    FBM,
    `// Voronoi of slowly shifting points: x = distance to the nearest edge (about), y = the cell's id hash.
vec2 plates(vec2 q, float t) {
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 nearest = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 h = hash22(cell + g);
      vec2 o = g + 0.5 + 0.38 * sin(t * 0.6 + 6.2831 * h) - f;
      float d = dot(o, o);
      if (d < d1) { d2 = d1; d1 = d; nearest = cell + g; }
      else if (d < d2) d2 = d;
    }
  }
  return vec2(sqrt(d2) - sqrt(d1), hash12(nearest));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float t = iTime * uSpeed;
  // Downhill is down the screen; the warp makes it flow sluggishly round obstacles.
  vec2 flow = vec2(0.0, t * 0.35);
  vec2 warp = vec2(fbm(p * 2.0 + flow * 0.6, 3), fbm(p * 2.0 + flow * 0.6 + 7.3, 3)) - 0.5;
  vec2 q = p * uScale + warp * 1.6 + flow * uScale * 0.3;
  vec2 v = plates(q, t);
  // The molten lava under the crust flows faster and churns.
  float churn = fbm(p * uScale * 0.9 + vec2(0.0, t * 0.9) + warp * 3.0, 5);
  vec3 lava = mix(uLava * 0.45, uLava, smoothstep(0.3, 0.5, churn));
  lava = mix(lava, uHot, smoothstep(0.55, 0.8, churn));
  // Cracks open wider where there is less crust; some plates melt through entirely.
  float crack = mix(0.3, 0.02, uCrust) * (0.6 + 0.8 * fbm(q * 0.7 + 3.0, 2));
  float molten = step(0.55 + 0.45 * uCrust, v.y);
  float crust = smoothstep(crack, crack + 0.06, v.x) * (1.0 - molten);
  // Crust: rough, dark, glowing dull red near the cracks and in its pores.
  float rough = fbm(q * 4.0, 3);
  float heat = exp(-max(v.x - crack, 0.0) * 6.0);
  vec3 rock = uCrustColor * (0.5 + 1.2 * rough) + uLava * heat * 0.6 * uGlow;
  rock += uLava * 0.3 * uGlow * smoothstep(0.62, 0.8, rough) * (1.0 - smoothstep(0.0, 0.4, v.x));
  vec3 col = mix(lava, rock, crust);
  // The glow of the cracks lighting the air.
  col += uHot * 0.2 * uGlow * (1.0 - crust) * smoothstep(0.5, 0.9, churn);
  col = min(col, vec3(1.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Fresh flow", values: { uCrust: 0.3, uSpeed: 0.9, uGlow: 1.4 } },
    { name: "Cooling field", values: { uCrust: 0.9, uSpeed: 0.2, uScale: 7 } },
    { name: "Blue lava", values: { uHot: [0.85, 0.98, 1], uLava: [0.15, 0.45, 1], uCrustColor: [0.05, 0.06, 0.1] } },
  ],
};

/** Melting: drips, heat haze, wax and liquefying shapes. */
export const meltShaders: ShaderEffect[] = [dripMelt, heatHaze, waxMelt, meltingText, liquify, daliClock, lavaFlow];
