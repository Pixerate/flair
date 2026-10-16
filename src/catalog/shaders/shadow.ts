import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Shadows from shapes and light. The mask effects read a picture's alpha as
 * a silhouette, contained in `uSize` of the frame, and blur it by reading a
 * mip level about as coarse as their taps are apart (see silhouette-morph).
 * The rest are signed-distance shapes, so their shadows can be marched.
 */

/**
 * `shapeAt(p, spacing)`: the `uMask` picture's colour (premultiplied) and
 * alpha at frame point p (height 1, centred), contained in `uSize` of the
 * frame, read at a mip level as coarse as `spacing` (frame units). With no
 * picture, a rounded square. Needs `uMask` and `uSize`.
 */
const SHAPE = `
vec4 shapeAt(vec2 p, float spacing) {
  vec2 size = vec2(textureSize(uMask, 0));
  if (size.x <= 1.0) {
    vec2 q = abs(p) - 0.18 * uSize;
    float a = step(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.08 * uSize, 0.0);
    return vec4(vec3(a), a);
  }
  float aspect = size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  vec4 c = textureLod(uMask, uv, log2(max(spacing * size.y / h, 1.0)));
  // Clear texels upload black, so filtered colour is about colour × alpha already.
  return vec4(clamp(c.rgb / max(c.a, 1e-3), 0.0, 1.0) * c.a, c.a);
}`.trim();

/** `capsule(p, a, b, r)`, `box(p, halfSize, radius)` and `smin(a, b, k)`: 2D distances. */
const SDF = `
float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`.trim();

export const longShadow: ShaderEffect = {
  kind: "shader",
  id: "long-shadow",
  name: "Long shadow",
  description: "The flat-design long shadow: a word or icon casting a long diagonal band across a flat colour, fading along its length and slowly swinging round.",
  category: "shadow",
  video: "none",
  tags: ["shadow", "long-shadow", "flat", "text", "logo", "icon", "mask"],
  source: glsl(
    `// Long shadow: the shape's mask marched back along a direction, so it casts a long band that fades as it goes.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("LONG")} label="Shape (its alpha)"
uniform float uSize;         // @control min=0.2 max=1 default=0.8 label="Shape size"
uniform float uAngle;        // @control min=0 max=360 default=315 label="Direction (°)"
uniform float uSwing;        // @control min=0 max=60 default=15 label="Swing (°)"
uniform float uSpin;         // @control min=-30 max=30 default=0 label="Turn (°/s)"
uniform float uLength;       // @control min=0 max=1.5 default=0.7 label="Length"
uniform float uFade;         // @control min=0 max=1 default=0.85 label="Fade along"
uniform vec3 uBackground;    // @control color default=#EF5A5A label="Background"
uniform vec3 uShadow;        // @control color default=#B8383F label="Shadow"
uniform vec3 uColour;        // @control color default=#FFFFFF label="Shape colour"
uniform bool uImageColours;  // @control default=false label="Use the shape's own colours"`,
    SHAPE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float a = radians(uAngle + uSpin * iTime + uSwing * sin(iTime * 0.4));
  vec2 dir = vec2(cos(a), sin(a));
  // Look back toward the shape: any copy of it along the way covers this point.
  const int STEPS = 96;
  float spacing = uLength / float(STEPS);
  float shade = 0.0;
  for (int i = 1; i <= STEPS; i++) {
    float m = shapeAt(p - dir * (float(i) * spacing), spacing).a;
    shade = max(shade, m);
    if (shade > 0.99) break;
  }
  // The band fades in one smooth gradient along the direction, from the back of the shape's box to the shadow's end.
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x <= 1.0 ? 1.0 : size.x / size.y;
  float h = size.x <= 1.0 ? 0.52 * uSize : min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  float reach = 0.5 * h * (abs(dir.x) * aspect + abs(dir.y));
  shade *= 1.0 - uFade * clamp((dot(p, dir) + reach) / (2.0 * reach + uLength), 0.0, 1.0);
  vec3 col = mix(uBackground, uShadow, shade);
  vec4 c = shapeAt(p, 1.0 / iResolution.y);
  vec3 ink = uImageColours ? c.rgb / max(c.a, 1e-4) : uColour;
  fragColor = vec4(mix(col, ink, c.a), 1.0);
}`,
  ),
  presets: [
    { name: "Flat", values: { uFade: 0, uLength: 1.5, uSwing: 0, uBackground: [0.16, 0.71, 0.65], uShadow: [0.11, 0.55, 0.5] } },
    { name: "Icon", values: { uMask: SAMPLE_IMAGES.heart, uImageColours: true, uSize: 0.5, uBackground: [0.99, 0.82, 0.32], uShadow: [0.86, 0.62, 0.14] } },
    { name: "Spinning", values: { uSwing: 0, uSpin: 20, uFade: 1, uBackground: [0.2, 0.22, 0.32], uShadow: [0.1, 0.11, 0.18] } },
  ],
};

export const dropShadowLift: ShaderEffect = {
  kind: "shader",
  id: "drop-shadow-lift",
  name: "Drop shadow lift",
  description: "A logo or icon resting on a soft drop shadow that lifts off the page when hovered, its shadow growing larger, softer and further below as it scales up.",
  category: "shadow",
  video: "none",
  tags: ["shadow", "drop-shadow", "hover", "interactive", "elevation", "logo", "icon", "mask"],
  source: glsl(
    `// Drop shadow lift: a shape on a blurred copy of its own mask, which spreads and drops as the shape lifts (on hover).
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.logo} label="Object (its alpha)"
uniform float uSize;         // @control min=0.2 max=1 default=0.55 label="Object size"
uniform bool uImageColours;  // @control default=true label="Use the object's own colours"
uniform vec3 uColour;        // @control color default=#6366F1 label="Object colour"
uniform vec3 uBackground;    // @control color default=#EEF1F7 label="Background"
uniform vec3 uShadow;        // @control color default=#1E2340 label="Shadow colour"
uniform float uOpacity;      // @control min=0 max=1 default=0.45 label="Shadow strength"
uniform float uRestBlur;     // @control min=0 max=0.1 default=0.012 label="Blur at rest"
uniform float uLiftBlur;     // @control min=0 max=0.2 default=0.07 label="Blur when lifted"
uniform float uLiftDrop;     // @control min=0 max=0.15 default=0.06 label="Shadow drop when lifted"
uniform float uLiftScale;    // @control min=0 max=0.2 default=0.06 label="Scale when lifted"
uniform bool uDemo;          // @control default=true label="Demo when idle"`,
    SHAPE,
    `// The mask blurred over a disc of the radius: 24 taps on a golden-angle spiral, each from a mip level as coarse as their spacing.
float blurred(vec2 p, float radius) {
  float sum = 0.0;
  for (int i = 0; i < 24; i++) {
    float r = radius * sqrt((float(i) + 0.5) / 24.0);
    float a = float(i) * 2.39996;
    sum += shapeAt(p + r * vec2(cos(a), sin(a)), radius * 0.35).a;
  }
  return sum / 24.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  // Hovering lifts it; idle, the demo breathes it up and down.
  float idle = uDemo ? smoothstep(0.0, 1.0, 0.5 - 0.5 * cos(iTime * 1.3)) : 0.0;
  float lift = mix(idle, 1.0, clamp(iPointer.z, 0.0, 1.0));
  float k = 1.0 + uLiftScale * lift;
  vec2 rise = vec2(0.0, 0.012 * lift);
  // The shadow spreads a little wider than the object, drops below it and softens.
  float ks = k * (1.0 + 0.05 * lift);
  vec2 drop = vec2(0.0, -(0.008 + uLiftDrop * lift));
  float radius = mix(uRestBlur, uLiftBlur, lift) + px;
  float shadow = blurred((p - drop) / ks, radius / ks) * uOpacity * mix(1.0, 0.7, lift);
  vec3 col = mix(uBackground, uShadow, shadow);
  vec4 c = shapeAt((p - rise) / k, px / k);
  vec3 ink = uImageColours ? c.rgb / max(c.a, 1e-4) : uColour;
  fragColor = vec4(mix(col, ink, c.a), 1.0);
}`,
  ),
  presets: [
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uBackground: [1, 0.94, 0.95], uShadow: [0.45, 0.05, 0.15], uOpacity: 0.4 } },
    { name: "Dramatic", values: { uOpacity: 0.7, uLiftBlur: 0.12, uLiftDrop: 0.12, uLiftScale: 0.1, uBackground: [0.85, 0.87, 0.9] } },
  ],
};

export const lightSweepShadows: ShaderEffect = {
  kind: "shader",
  id: "light-sweep-shadows",
  name: "Light sweep shadows",
  description: "A coloured light drifting across a floor of shapes (or following the pointer), each casting a real soft shadow that swings round as the light moves.",
  category: "shadow",
  tags: ["shadow", "light", "soft-shadows", "sdf", "lamp", "interactive", "hover"],
  source: glsl(
    `// Light sweep shadows: soft 2D shadows marched from each point toward a moving light through the shapes' distance field.
uniform vec3 uLight;         // @control color default=#FFC46E label="Light colour"
uniform float uIntensity;    // @control min=0 max=4 default=1.8 label="Light strength"
uniform float uReach;        // @control min=0.1 max=2 default=0.45 label="Light reach"
uniform float uSoftness;     // @control min=0.005 max=0.3 default=0.06 label="Shadow softness"
uniform float uSpeed;        // @control min=0 max=2 default=0.5 label="Speed"
uniform vec3 uFloor;         // @control color default=#3A3F52 label="Floor"
uniform vec3 uShapes;        // @control color default=#ECE6DA label="Shapes"
uniform float uAmbient;      // @control min=0 max=1 default=0.12 label="Ambient light"
uniform bool uFollow;        // @control default=true label="Follow the pointer"`,
    ROTATE,
    SDF,
    `float scene(vec2 p) {
  float d = length(p - vec2(-0.45, 0.13)) - 0.09;
  d = min(d, length(p - vec2(0.36, -0.17)) - 0.065);
  d = min(d, length(p - vec2(-0.2, -0.28)) - 0.045);
  d = min(d, box(rot(0.5) * (p - vec2(0.04, 0.0)), vec2(0.1, 0.05), 0.012));
  d = min(d, box(rot(-0.3) * (p - vec2(0.55, 0.2)), vec2(0.03, 0.12), 0.01));
  d = min(d, box(rot(0.9) * (p - vec2(-0.62, -0.22)), vec2(0.05, 0.05), 0.008));
  return d;
}

vec2 sceneNormal(vec2 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec2(scene(p + e.xy) - scene(p - e.xy), scene(p + e.yx) - scene(p - e.yx)) + 1e-6);
}

// How much of the light reaches p: march toward it, keeping the narrowest miss relative to how far along.
float softShadow(vec2 p, vec2 light) {
  vec2 to = light - p;
  float dist = length(to);
  vec2 dir = to / max(dist, 1e-5);
  float res = 1.0;
  float t = 0.004;
  for (int i = 0; i < 56; i++) {
    if (t >= dist) break;
    float d = scene(p + dir * t);
    res = min(res, d / (uSoftness * t));
    if (res < -1.0) break;
    t += clamp(d, 0.004, 0.08);
  }
  res = max(res, -1.0);
  return 0.25 * (1.0 + res) * (1.0 + res) * (2.0 - res);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  vec2 light = vec2(0.42 * aspect * sin(t * 1.06), 0.36 * sin(t * 1.62 + 1.0));
  if (uFollow) light = mix(light, (iPointer.xy - 0.5 * iResolution.xy) * px, clamp(iPointer.z, 0.0, 1.0));
  // Keep the light out of the shapes.
  float inside = scene(light);
  if (inside < 0.03) light += sceneNormal(light) * (0.03 - inside);

  vec2 to = light - p;
  float r = length(to);
  float falloff = 1.0 / (1.0 + r * r / (uReach * uReach));
  vec3 lamp = uLight * uIntensity * falloff;
  float d = scene(p);
  // Floor: ambient, plus the light where it gets through.
  vec3 floorCol = uFloor * (uAmbient + lamp * softShadow(p, light));
  // Shapes are lit on top, brighter on the rim that faces the light.
  vec2 n = sceneNormal(p);
  float rim = smoothstep(-0.025, 0.0, d) * max(dot(n, to / max(r, 1e-5)), 0.0);
  vec3 shapeCol = uShapes * (uAmbient + 0.25 + lamp * (0.45 + 0.8 * rim));
  vec3 col = mix(shapeCol, floorCol, smoothstep(-px, px, d));
  // The bulb itself.
  col += uLight * (exp(-r * r / 0.00025) * 2.0 + exp(-r * r / 0.004) * 0.25);
  fragColor = vec4(1.0 - exp(-col * 1.3), 1.0);
}`,
  ),
  presets: [
    { name: "Candle", values: { uLight: [1, 0.6, 0.25], uReach: 0.3, uSoftness: 0.12, uSpeed: 0.3, uFloor: [0.22, 0.17, 0.14] } },
    { name: "Neon", values: { uLight: [0.3, 0.85, 1], uIntensity: 2.5, uSoftness: 0.02, uFloor: [0.1, 0.1, 0.18], uShapes: [0.9, 0.3, 0.7] } },
  ],
};

export const contactShadow: ShaderEffect = {
  kind: "shader",
  id: "contact-shadow",
  name: "Contact shadow",
  description: "An object floating up and down above the floor, its contact shadow tightening and darkening as it nears the ground and spreading and fading as it rises.",
  category: "shadow",
  tags: ["shadow", "contact-shadow", "float", "ground", "product", "3d"],
  source: glsl(
    `// Contact shadow: an object bobbing over a floor; a tight dark core and a wide soft shadow, both spreading and fading with height.
uniform int uShape;          // @control min=0 max=2 default=0 label="Object (0 ball, 1 cube, 2 pill)"
uniform vec3 uObject;        // @control color default=#FF7A59 label="Object"
uniform vec3 uBackground;    // @control color default=#F3EEE6 label="Wall"
uniform vec3 uGround;        // @control color default=#E2D8C9 label="Floor"
uniform vec3 uShadow;        // @control color default=#3A2C22 label="Shadow colour"
uniform float uHeight;       // @control min=0 max=0.4 default=0.2 label="Float height"
uniform float uSpeed;        // @control min=0 max=3 default=0.8 label="Speed"
uniform float uDarkness;     // @control min=0 max=1 default=0.8 label="Contact darkness"
uniform float uSpread;       // @control min=0 max=3 default=1.4 label="Spread when high"`,
    SDF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  const float horizon = -0.08;
  const float groundY = -0.26;
  const float R = 0.12;
  // Lingers at the top and bottom of each bob, and comes down to just touch.
  float s = 0.5 + 0.5 * sin(iTime * uSpeed * 1.6);
  float h = 0.003 + uHeight * s * s * (3.0 - 2.0 * s);

  // Wall above, floor below, a soft crease between.
  vec3 wall = uBackground * (0.92 + 0.08 * smoothstep(horizon, 0.5, p.y));
  vec3 floorCol = uGround * (0.94 + 0.06 * smoothstep(horizon, -0.5, p.y));
  vec3 col = mix(floorCol, wall, smoothstep(-px, px, p.y - horizon));
  col *= 1.0 - 0.06 * exp(-abs(p.y - horizon) * 40.0);

  vec2 ext = uShape == 0 ? vec2(R) : (uShape == 1 ? vec2(0.85 * R) : vec2(1.35 * R, 0.55 * R));
  // The shadow on the floor: a squashed core that tightens and darkens near the ground, and a broad soft one.
  vec2 g = p - vec2(0.0, groundY);
  float coreW = ext.x * 0.8 + h * uSpread * 0.35;
  float core = exp(-dot(g / vec2(coreW, coreW * 0.16), g / vec2(coreW, coreW * 0.16)) * 1.6) * exp(-h * 10.0);
  float wideW = ext.x * 1.15 + h * uSpread;
  float wide = exp(-dot(g / vec2(wideW, wideW * 0.22), g / vec2(wideW, wideW * 0.22)) * 1.2) * 0.45 / (1.0 + h * 8.0);
  float shade = uDarkness * (1.0 - (1.0 - core) * (1.0 - wide));
  col = mix(col, uShadow, shade);

  // The object.
  vec2 q = p - vec2(0.0, groundY + ext.y + h);
  float d = uShape == 0 ? length(q) - R : (uShape == 1 ? box(q, ext, 0.035) : box(q, ext, ext.y));
  vec2 u = clamp(q / ext, -1.0, 1.0);
  vec3 obj;
  if (uShape == 0) {
    vec3 n = vec3(u, sqrt(max(1.0 - dot(u, u), 0.0)));
    vec3 l = normalize(vec3(-0.45, 0.6, 0.65));
    float diff = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    obj = uObject * (0.35 + 0.75 * diff) + 0.35 * spec;
  } else {
    obj = uObject * (0.88 + 0.16 * u.y - 0.06 * u.x);
    obj += 0.12 * smoothstep(0.7, 1.0, u.y) * smoothstep(1.0, 0.6, abs(u.x));
  }
  // Near the ground the floor shades its underside.
  obj *= 1.0 - 0.35 * exp(-h * 14.0) * smoothstep(-0.2, -1.0, u.y);
  col = mix(obj, col, smoothstep(-px, px, d));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Cube", values: { uShape: 1, uObject: [0.38, 0.4, 0.95], uBackground: [0.93, 0.94, 0.97], uGround: [0.85, 0.87, 0.92], uShadow: [0.1, 0.12, 0.25] } },
    { name: "Pill on dark", values: { uShape: 2, uObject: [0.98, 0.84, 0.3], uBackground: [0.13, 0.14, 0.17], uGround: [0.18, 0.19, 0.23], uShadow: [0, 0, 0], uDarkness: 0.9 } },
  ],
};

export const windowShadows: ShaderEffect = {
  kind: "shader",
  id: "window-shadows",
  name: "Window shadows",
  description: "Warm sunlight through a window falling across a wall or a picture, dappled by the shadows of slowly tilting blinds or rustling leaves.",
  category: "shadow",
  video: "filter",
  tags: ["shadow", "light", "dappled", "window", "blinds", "leaves", "sunlight", "warm", "image"],
  source: glsl(
    `// Window shadows: a patch of sunlight from a window, striped by blinds or broken up by leaves, laid over a wall or picture.
uniform sampler2D uImage;    // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform bool uPlainWall;     // @control default=false label="Plain wall (no image)"
uniform vec3 uWall;          // @control color default=#E8DCCB label="Wall"
uniform int uPattern;        // @control min=0 max=1 default=1 label="Shadows of (0 blinds, 1 leaves)"
uniform vec3 uLight;         // @control color default=#FFC27A label="Light colour"
uniform float uIntensity;    // @control min=0 max=2 default=0.9 label="Light strength"
uniform float uShade;        // @control min=0 max=1 default=0.45 label="Shadow depth"
uniform float uAngle;        // @control min=-60 max=60 default=-22 label="Light angle (°)"
uniform float uScale;        // @control min=0.4 max=2.5 default=1 label="Scale"
uniform float uSoftness;     // @control min=0 max=1 default=0.35 label="Softness"
uniform float uSway;         // @control min=0 max=2 default=1 label="Sway"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    `// The sunlit patch the window throws, slanted, with soft edges.
float windowPatch(vec2 q, float soft) {
  vec2 e = abs(q) - vec2(0.5, 0.4);
  return smoothstep(soft, -soft, max(e.x, e.y));
}

float blinds(vec2 q, float t, float soft) {
  q.x += 0.006 * sin(t * 0.7) * uSway;
  // The slats tilt slowly open and shut.
  float open = clamp(0.5 + 0.22 * sin(t * 0.35 * uSway + 0.4), 0.15, 0.85);
  float f = fract(q.y * 14.0 + 0.04 * sin(q.x * 3.0 + t * 0.5) * uSway);
  float w = 0.03 + soft * 0.25;
  float lit = smoothstep(0.0, w, f) * smoothstep(open + w, open, f);
  // The window's frame and cross bar.
  float bars = smoothstep(0.012 + soft * 0.03, 0.006, abs(q.x)) + smoothstep(0.012 + soft * 0.03, 0.006, abs(q.y - 0.02));
  return lit * (1.0 - clamp(bars, 0.0, 1.0)) * windowPatch(q, 0.02 + soft * 0.06);
}

float leaves(vec2 q, float t, float soft) {
  // Branches sway slowly and the leaves rustle quickly on top.
  vec2 sway = uSway * (vec2(0.05 * sin(t * 0.6 + q.y * 1.5), 0.03 * cos(t * 0.45 + q.x * 1.2))
    + 0.012 * vec2(vnoise(q * 6.0 + t * 1.3), vnoise(q * 6.0 - t * 1.1 + 7.0)));
  float n = fbm((q + sway) * 3.2 + 4.0, 5);
  float s = 0.025 + soft * 0.1;
  float lit = smoothstep(0.5 - s, 0.5 + s, n);
  return lit * windowPatch(q * 0.75, 0.08 + soft * 0.1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // Light comes in at an angle, so the window's shape is turned and sheared across the wall.
  vec2 q = rot(radians(uAngle)) * p / uScale;
  q.x += q.y * 0.35;
  float lit = uPattern == 0 ? blinds(q, iTime, uSoftness) : leaves(q, iTime, uSoftness);

  vec4 base;
  if (uPlainWall) {
    float plaster = vnoise(fragCoord * 0.35) * 0.5 + vnoise(fragCoord * 0.05) * 0.5;
    base = vec4(uWall * (0.96 + 0.06 * plaster), 1.0);
  } else {
    base = pictureRGBA(uImage, uv);
  }
  vec3 light = (1.0 - uShade) * vec3(0.95, 0.96, 1.0) + lit * uShade * uLight * (0.6 + uIntensity);
  vec3 col = base.rgb * light;
  col = col / (1.0 + max(col - 1.0, 0.0));
  fragColor = vec4(col, base.a);
}`,
  ),
  presets: [
    { name: "Blinds", values: { uPattern: 0, uPlainWall: true, uAngle: -30, uSoftness: 0.2, uLight: [1, 0.82, 0.6] } },
    { name: "Plain wall", values: { uPlainWall: true } },
    { name: "Golden hour", values: { uPlainWall: true, uLight: [1, 0.6, 0.3], uIntensity: 1.4, uShade: 0.7, uSoftness: 0.6, uWall: [0.93, 0.85, 0.78] } },
  ],
};

export const shadowPuppets: ShaderEffect = {
  kind: "shader",
  id: "shadow-puppets",
  name: "Shadow puppets",
  description: "Hand shadow puppets on a lamp-lit wall: a flapping bird, a barking dog or a twitching rabbit, softening as the hand moves away from the wall.",
  category: "shadow",
  tags: ["shadow", "puppet", "hands", "silhouette", "bird", "dog", "rabbit", "warm", "playful"],
  source: glsl(
    `// Shadow puppets: hand shapes built from soft-unioned capsules, cast on a warmly lit wall; the further the hand from the wall, the bigger and softer.
uniform int uPuppet;         // @control min=0 max=2 default=0 label="Puppet (0 bird, 1 dog, 2 rabbit)"
uniform vec3 uWall;          // @control color default=#F2DDB8 label="Wall"
uniform vec3 uLight;         // @control color default=#FFB75E label="Lamp colour"
uniform vec3 uShadow;        // @control color default=#2B1B12 label="Shadow colour"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform float uDepth;        // @control min=0 max=1 default=0.6 label="Hand moving to and from the wall"
uniform float uSoftness;     // @control min=0 max=0.1 default=0.035 label="Softness away from the wall"
uniform float uSize;         // @control min=0.5 max=1.5 default=1 label="Size"`,
    HASH,
    NOISE,
    ROTATE,
    SDF,
    `float ellipse(vec2 p, vec2 r) {
  return (length(p / r) - 1.0) * min(r.x, r.y);
}

// Two hands linked at the thumbs (the head), fingers fanned out as wings.
float bird(vec2 p, float t) {
  float flap = 0.45 * sin(t * 4.0);
  float d = capsule(p, vec2(0.0, -0.02), vec2(0.0, 0.13), 0.028);
  d = smin(d, ellipse(p - vec2(0.0, 0.165), vec2(0.04, 0.035)), 0.02);
  d = min(d, capsule(p, vec2(0.025, 0.17), vec2(0.075, 0.158), 0.009));
  for (int s = 0; s < 2; s++) {
    vec2 q = vec2(s == 0 ? p.x : -p.x, p.y);
    d = smin(d, ellipse(q - vec2(0.08, 0.0), vec2(0.075, 0.045)), 0.03);
    d = smin(d, capsule(q, vec2(0.08, -0.01), vec2(0.3, -0.65), 0.06), 0.03);
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float a = 0.55 - fk * 0.22 + flap * (1.0 - fk * 0.12);
      vec2 root = vec2(0.13, 0.02 - fk * 0.018);
      d = smin(d, capsule(q, root, root + (0.2 - fk * 0.02) * vec2(cos(a), sin(a)), 0.019 - fk * 0.002), 0.012);
    }
  }
  return d;
}

// The back of the hand is the head, the thumb an ear, the little finger a jaw that drops as it barks.
float dog(vec2 p, float t) {
  float bark = max(sin(t * 3.0), 0.0);
  bark *= bark;
  float d = box(p - vec2(-0.02, 0.03), vec2(0.12, 0.065), 0.05);
  d = smin(d, capsule(p, vec2(0.06, 0.04), vec2(0.24, 0.025), 0.038), 0.03);
  vec2 pivot = vec2(0.0, -0.03);
  vec2 jaw = rot(0.4 * bark) * (p - pivot) + pivot;
  d = smin(d, capsule(jaw, vec2(0.02, -0.04), vec2(0.2, -0.045), 0.024), 0.012);
  d = smin(d, capsule(p, vec2(-0.06, 0.08), vec2(-0.1 + 0.04 * sin(t * 1.3), 0.2), 0.042), 0.03);
  d = smin(d, capsule(p, vec2(-0.08, 0.0), vec2(-0.5, -0.65), 0.075), 0.04);
  // A gap between the fingers for an eye.
  return max(d, -(length(p - vec2(0.07, 0.07)) - 0.013));
}

// Two fingers up as ears, the fist a head with a twitching nose.
float rabbit(vec2 p, float t) {
  float nose = 0.006 * sin(t * 18.0) * step(0.3, sin(t * 0.9));
  float d = ellipse(p, vec2(0.12, 0.085));
  d = smin(d, length(p - vec2(0.11 + nose, -0.025)) - 0.05, 0.04);
  d = smin(d, capsule(p, vec2(-0.04, 0.05), vec2(-0.09 + 0.08 * sin(t * 1.7), 0.32), 0.04), 0.03);
  d = smin(d, capsule(p, vec2(0.0, 0.06), vec2(0.03 + 0.08 * sin(t * 1.7 + 1.2), 0.3), 0.037), 0.03);
  d = smin(d, capsule(p, vec2(-0.06, -0.03), vec2(-0.45, -0.65), 0.075), 0.04);
  return max(d, -(length(p - vec2(0.045, 0.025)) - 0.013));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  // The lamp's pool of light on the wall, and a little plaster.
  float spot = smoothstep(0.95, 0.05, length((p - vec2(0.04, 0.05)) * vec2(0.75, 1.0)));
  vec3 wall = uWall * mix(vec3(0.16, 0.11, 0.09), uLight * 1.3, spot);
  wall *= 0.95 + 0.07 * vnoise(fragCoord * 0.3) + 0.04 * vnoise(fragCoord * 0.03);
  // Nearer the lamp the shadow grows and its edge blurs.
  float z = uDepth * (0.5 + 0.5 * sin(iTime * 0.45));
  float scale = uSize * (1.0 + 0.3 * z);
  vec2 drift = vec2(0.03 * sin(iTime * 0.4), 0.02 * sin(iTime * 0.7) - 0.04);
  vec2 q = (p - drift) / scale;
  float d = (uPuppet == 0 ? bird(q, t) : (uPuppet == 1 ? dog(q, t) : rabbit(q, t))) * scale;
  float soft = max(0.002 + uSoftness * z, px);
  float cover = 1.0 - smoothstep(-soft, soft, d);
  vec3 col = mix(wall, uShadow * (0.6 + 0.4 * spot), cover * 0.92);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dog", values: { uPuppet: 1 } },
    { name: "Rabbit by candle", values: { uPuppet: 2, uLight: [1, 0.55, 0.25], uWall: [0.95, 0.8, 0.62], uSoftness: 0.06 } },
    { name: "Moonlit bird", values: { uPuppet: 0, uLight: [0.7, 0.8, 1], uWall: [0.78, 0.82, 0.9], uShadow: [0.05, 0.07, 0.13] } },
  ],
};

/** Shadows: long, soft, moving and contact shadows from shapes and light. */
export const shadowShaders: ShaderEffect[] = [longShadow, dropShadowLift, lightSweepShadows, contactShadow, windowShadows, shadowPuppets];
