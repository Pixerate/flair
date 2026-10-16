import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/** The two-image controls every effect here starts with; progress runs 0 → 1 → 0 over 4 s when animated. */
const pair = (from: string, to: string) => `uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${from} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${to} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"`;

/** `progress()`, and `cover(tex, uv)` / `coverRGBA(tex, uv)`: an image cover-fitted to the frame (needs {@link PICTURE}). */
const COMMON = `
float progress() {
  return uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
}

// The share of an image visible across and up when it covers the frame (the test card fits it).
vec2 coverScale(sampler2D tex) {
  vec2 size = vec2(textureSize(tex, 0));
  float frameAspect = iResolution.x / iResolution.y;
  float imageAspect = size.x > 1.0 ? size.x / size.y : frameAspect;
  return frameAspect > imageAspect ? vec2(1.0, imageAspect / frameAspect) : vec2(frameAspect / imageAspect, 1.0);
}

vec4 coverRGBA(sampler2D tex, vec2 uv) {
  return pictureRGBA(tex, 0.5 + (uv - 0.5) * coverScale(tex));
}

vec3 cover(sampler2D tex, vec2 uv) {
  return coverRGBA(tex, uv).rgb;
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}`.trim();

export const featureMorph: ShaderEffect = {
  kind: "shader",
  id: "feature-morph",
  name: "Feature morph",
  description: "The classic face morph: two pictures warp so five matching points (eyes, mouth, chin, hairline) meet while they cross-fade.",
  category: "morph",
  video: "stills",
  tags: ["morph", "face", "warp", "image", "transition"],
  loop: 4,
  source: glsl(
    `// Feature morph: both images warp towards in-between positions of five matching points while they cross-fade.
${pair(SAMPLE_IMAGES.portrait, SAMPLE_IMAGES.portrait2)}
uniform vec2 uFromA;       // @control min=0 max=1 default=0.461,0.583 label="From: left eye"
uniform vec2 uFromB;       // @control min=0 max=1 default=0.539,0.583 label="From: right eye"
uniform vec2 uFromC;       // @control min=0 max=1 default=0.5,0.472 label="From: mouth"
uniform vec2 uFromD;       // @control min=0 max=1 default=0.5,0.389 label="From: chin"
uniform vec2 uFromE;       // @control min=0 max=1 default=0.5,0.778 label="From: hairline"
uniform vec2 uToA;         // @control min=0 max=1 default=0.619,0.514 label="To: left eye"
uniform vec2 uToB;         // @control min=0 max=1 default=0.725,0.514 label="To: right eye"
uniform vec2 uToC;         // @control min=0 max=1 default=0.672,0.364 label="To: mouth"
uniform vec2 uToD;         // @control min=0 max=1 default=0.672,0.25 label="To: chin"
uniform vec2 uToE;         // @control min=0 max=1 default=0.672,0.778 label="To: hairline"
uniform bool uShowPoints;  // @control default=false label="Show points"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMMON,
    `// Points are given in image uv; the warp works in frame space (height 1, x scaled by the aspect).
vec2 toFrame(vec2 imageUv, vec2 scale) {
  return (0.5 + (imageUv - 0.5) / scale) * vec2(iResolution.x / iResolution.y, 1.0);
}

vec2 toImage(vec2 q, vec2 scale) {
  return 0.5 + (q / vec2(iResolution.x / iResolution.y, 1.0) - 0.5) * scale;
}

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Where frame point x, among the in-between points m, comes from in a picture whose points are s:
// a best-fit similarity (move, scale, turn) carries m onto s, then inverse-distance weighting of
// what is left over bends each point exactly onto its partner.
vec2 warp(vec2 x, vec2 m[5], vec2 s[5]) {
  vec2 cm = vec2(0.0);
  vec2 cs = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    cm += m[i] * 0.2;
    cs += s[i] * 0.2;
  }
  vec2 num = vec2(0.0);
  float den = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 a = m[i] - cm;
    num += cmul(vec2(a.x, -a.y), s[i] - cs);
    den += dot(a, a);
  }
  vec2 k = num / max(den, 1e-6);
  vec2 bend = vec2(0.0);
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 left = s[i] - (cs + cmul(k, m[i] - cm));
    float d2 = dot(x - m[i], x - m[i]);
    float w = 1.0 / (d2 * d2 + 1e-6);
    bend += w * left;
    total += w;
  }
  return cs + cmul(k, x - cm) + bend / total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = progress();
  vec2 scaleA = coverScale(uFrom);
  vec2 scaleB = coverScale(uTo);
  vec2 a[5] = vec2[5](toFrame(uFromA, scaleA), toFrame(uFromB, scaleA), toFrame(uFromC, scaleA), toFrame(uFromD, scaleA), toFrame(uFromE, scaleA));
  vec2 b[5] = vec2[5](toFrame(uToA, scaleB), toFrame(uToB, scaleB), toFrame(uToC, scaleB), toFrame(uToD, scaleB), toFrame(uToE, scaleB));
  vec2 m[5];
  for (int i = 0; i < 5; i++) m[i] = mix(a[i], b[i], t);
  vec2 x = fragCoord / iResolution.y;
  vec4 colA = pictureRGBA(uFrom, toImage(warp(x, m, a), scaleA));
  vec4 colB = pictureRGBA(uTo, toImage(warp(x, m, b), scaleB));
  vec4 pic = mix(colA, colB, smoothstep(0.2, 0.8, t));
  vec3 col = pic.rgb;
  float marks = 0.0;
  if (uShowPoints) {
    float px = 1.0 / iResolution.y;
    for (int i = 0; i < 5; i++) {
      float d = length(x - m[i]);
      float shadow = smoothstep(px * 1.5, 0.0, abs(d - 0.012)) * 0.6;
      float ring = smoothstep(px, 0.0, abs(d - 0.012));
      col = mix(col, vec3(0.0), shadow);
      col = mix(col, vec3(1.0, 0.85, 0.2), ring);
      marks = max(marks, max(shadow, ring));
    }
  }
  fragColor = vec4(col, max(pic.a, marks));
}`,
  ),
  presets: [{ name: "Show points", values: { uShowPoints: true, uAnimate: false, uProgress: 0.5 } }],
};

export const silhouetteMorph: ShaderEffect = {
  kind: "shader",
  id: "silhouette-morph",
  name: "Silhouette morph",
  description: "One silhouette or logo flowing into another as a gooey blob, its colour blending from the first shape's to the second's.",
  category: "morph",
  video: "stills",
  tags: ["morph", "shape", "logo", "goo", "blob", "text"],
  loop: 4,
  source: glsl(
    `// Silhouette morph: blurred alpha masks of two shapes mixed by progress and thresholded, so one flows into the other.
uniform sampler2D uFrom;      // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.logo} label="From shape"
uniform sampler2D uTo;        // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.heart} label="To shape"
uniform bool uAnimate;        // @control default=true label="Animate"
uniform float uProgress;      // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uSize;          // @control min=0.2 max=1 default=0.75 label="Shape size"
uniform float uGoo;           // @control min=0 max=0.3 default=0.1 label="Gooeyness"
uniform float uEdge;          // @control min=0 max=0.05 default=0.004 label="Edge softness"
uniform bool uImageColours;   // @control default=true label="Use the shapes' own colours"
uniform vec3 uColourA;        // @control color default=#6366F1 label="From colour"
uniform vec3 uColourB;        // @control color default=#F43F5E label="To colour"
uniform vec3 uBackground;     // @control color default=#0F172A label="Background"`,
    `// A shape's colour (premultiplied) and alpha at frame point p (height 1, centred), the image contained in
// uSize of the frame, read from a mip level about as coarse as the spacing (in frame units), so sparse blur
// taps still sum smoothly. With no image, a disc (fallback 0) or a rounded square (1).
vec4 shapeAt(sampler2D tex, vec2 p, float spacing, int fallback) {
  vec2 size = vec2(textureSize(tex, 0));
  if (size.x <= 1.0) {
    float d = fallback == 0 ? length(p) - 0.3 * uSize : length(max(abs(p) - 0.2 * uSize, 0.0)) - 0.08 * uSize;
    float a = step(d, 0.0);
    return vec4(vec3(a), a);
  }
  float aspect = size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  vec4 c = textureLod(tex, uv, log2(max(spacing * size.y / h, 1.0)));
  // Clear texels upload black, so filtered colour is already about colour × alpha: divide it out, then weight by alpha.
  return vec4(clamp(c.rgb / max(c.a, 1e-3), 0.0, 1.0) * c.a, c.a);
}

// A disc blur of the shape: 28 taps on a golden-angle spiral.
vec4 blurred(sampler2D tex, vec2 p, float radius, int fallback) {
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 28; i++) {
    float r = radius * sqrt((float(i) + 0.5) / 28.0);
    float a = float(i) * 2.39996;
    sum += shapeAt(tex, p + r * vec2(cos(a), sin(a)), radius * 0.35, fallback);
  }
  return sum / 28.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // Shapes are sharp at either end and softest half way, where the blobs merge.
  float radius = uGoo * sin(3.14159 * t) + 1.0 / iResolution.y;
  vec4 a = blurred(uFrom, p, radius, 0);
  vec4 b = blurred(uTo, p, radius, 1);
  float field = mix(a.a, b.a, t);
  float w = uEdge + fwidth(field) * 0.75;
  float inside = smoothstep(0.5 - w, 0.5 + w, field);
  // Each shape's colour here (or the other's, where only one shape reaches), blended by progress.
  vec3 ca = uImageColours ? a.rgb / max(a.a, 1e-4) : uColourA;
  vec3 cb = uImageColours ? b.rgb / max(b.a, 1e-4) : uColourB;
  ca = mix(cb, ca, smoothstep(0.0, 0.05, a.a));
  cb = mix(ca, cb, smoothstep(0.0, 0.05, b.a));
  vec3 tint = mix(ca, cb, smoothstep(0.2, 0.8, t));
  // A little roundness: the thick middle of a blob is lighter than its rim.
  tint *= 0.82 + 0.25 * smoothstep(0.5, 1.0, field);
  fragColor = vec4(mix(uBackground, tint, inside), 1.0);
}`,
  ),
  presets: [
    {
      name: "Hello → World",
      values: { uFrom: textImage("HELLO"), uTo: textImage("WORLD"), uImageColours: false, uSize: 0.9, uGoo: 0.05, uColourA: [0.98, 0.75, 0.14], uColourB: [0.13, 0.83, 0.93] },
    },
    { name: "Blobby", values: { uGoo: 0.25, uBackground: [1, 0.97, 0.93] } },
  ],
};

export const transitionLiquidMorph: ShaderEffect = {
  kind: "shader",
  id: "transition-liquid-morph",
  name: "Liquid morph",
  description: "Both images swept along a flowing, swirling current that peaks half way, dissolving one into the other like ink in water.",
  category: "transition",
  video: "transition",
  tags: ["transition", "morph", "liquid", "image", "flow"],
  loop: 4,
  source: glsl(
    `// Liquid morph: both images advected along a domain-warped fbm current, strongest at mid-progress, while cross-fading.
${pair(SAMPLE_IMAGES.landscape, SAMPLE_IMAGES.city)}
uniform float uStrength;   // @control min=0 max=0.5 default=0.1 label="Strength"
uniform float uScale;      // @control min=0.5 max=8 default=2.5 label="Scale"
uniform float uFlow;       // @control min=0 max=2 default=0.4 label="Flow speed"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    COMMON,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  float s = sin(3.14159 * t);
  float time = iTime * uFlow;
  vec2 q = fragCoord / iResolution.y * uScale;
  vec2 first = vec2(fbm(q + vec2(0.0, time), 4), fbm(q + vec2(5.2, 1.3) - vec2(time, 0.0), 4)) - 0.5;
  vec2 flow = vec2(fbm(q + 4.0 * first + vec2(1.7, 9.2) + time * 0.5, 4), fbm(q + 4.0 * first + vec2(8.3, 2.8) - time * 0.5, 4)) - 0.5;
  vec2 d = flow * uStrength * s * 2.0;
  // From is carried downstream, To arrives from upstream; neither moves at the ends.
  vec4 a = coverRGBA(uFrom, uv + d);
  vec4 b = coverRGBA(uTo, uv - d);
  float k = smoothstep(0.25, 0.75, t + (flow.x + flow.y) * 0.6 * s);
  fragColor = mix(a, b, k);
}`,
  ),
  presets: [
    { name: "Gentle", values: { uStrength: 0.08, uScale: 1.5, uFlow: 0.2 } },
    { name: "Turbulent", values: { uStrength: 0.35, uScale: 4, uFlow: 1.2 } },
  ],
};

export const transitionDisplacement: ShaderEffect = {
  kind: "shader",
  id: "transition-displacement",
  name: "Displacement",
  description: "Each image's brightness pushes it out in one direction as the next slides in, warped by its own light and dark.",
  category: "transition",
  video: "transition",
  tags: ["transition", "morph", "displacement", "image", "warp"],
  loop: 4,
  source: glsl(
    `// Displacement: From's luminance drives a directional warp out, To's luminance the same warp in reverse.
${pair(SAMPLE_IMAGES.city, SAMPLE_IMAGES.landscape)}
uniform float uStrength;   // @control min=0 max=1 default=0.4 label="Strength"
uniform float uAngle;      // @control min=0 max=360 default=0 label="Direction (°)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMMON,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  vec2 dir = vec2(cos(radians(uAngle)), sin(radians(uAngle))) * vec2(iResolution.y / iResolution.x, 1.0);
  float la = luma(cover(uFrom, uv));
  float lb = luma(cover(uTo, uv));
  vec4 a = coverRGBA(uFrom, uv + dir * t * uStrength * la);
  vec4 b = coverRGBA(uTo, uv - dir * (1.0 - t) * uStrength * lb);
  fragColor = mix(a, b, smoothstep(0.2, 0.8, t));
}`,
  ),
  presets: [
    { name: "Upward smear", values: { uStrength: 0.6, uAngle: 90 } },
    { name: "Subtle", values: { uStrength: 0.12, uAngle: 30 } },
  ],
};

export const transitionLuma: ShaderEffect = {
  kind: "shader",
  id: "transition-luma",
  name: "Luma fade",
  description: "Pixels switch to the next image in order of brightness, shadows first or highlights first, along a soft edge.",
  category: "transition",
  video: "transition",
  tags: ["transition", "morph", "luma", "image", "dissolve"],
  loop: 4,
  source: glsl(
    `// Luma fade: each pixel switches when progress passes its brightness, with a soft edge.
${pair(SAMPLE_IMAGES.landscape, SAMPLE_IMAGES.city)}
uniform float uSoftness;   // @control min=0.01 max=0.5 default=0.1 label="Softness"
uniform bool uLightFirst;  // @control default=false label="Light first"
uniform int uSource;       // @control min=0 max=1 default=0 label="Brightness of (0 From, 1 To)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    COMMON,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  vec4 a = coverRGBA(uFrom, uv);
  vec4 b = coverRGBA(uTo, uv);
  float l = clamp(luma(uSource == 0 ? a.rgb : b.rgb), 0.0, 1.0);
  if (uLightFirst) l = 1.0 - l;
  // The front sweeps from below the darkest pixel to above the lightest, so both ends are clean.
  float front = mix(-uSoftness, 1.0 + uSoftness, t);
  fragColor = mix(a, b, smoothstep(l - uSoftness, l + uSoftness, front));
}`,
  ),
  presets: [
    { name: "Highlights first", values: { uLightFirst: true, uSoftness: 0.06 } },
    { name: "Hard threshold", values: { uSoftness: 0.01, uSource: 1 } },
  ],
};

export const transitionParticleSwap: ShaderEffect = {
  kind: "shader",
  id: "transition-particle-swap",
  name: "Particle swap",
  description: "The image breaks into square particles that tumble along curved, staggered paths and land as the next image.",
  category: "transition",
  video: "transition",
  tags: ["transition", "morph", "particles", "image", "mosaic"],
  loop: 4,
  source: glsl(
    `// Particle swap: each cell of From flies to a neighbouring cell's place, shrinking and spinning on the way, and lands as To.
${pair(SAMPLE_IMAGES.landscape, SAMPLE_IMAGES.city)}
uniform float uParticle;   // @control min=6 max=80 default=20 label="Particle size (px)"
uniform float uScatter;    // @control min=0 max=0.8 default=0.45 label="Scatter"
uniform float uSpin;       // @control min=0 max=2 default=0.6 label="Spin & curl"
uniform vec3 uBackground;  // @control color default=#0B0B12 label="Background"
${BACKDROP_CONTROLS}`,
    HASH,
    ROTATE,
    PICTURE,
    COMMON,
    `const vec2 RING[4] = vec2[4](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0));

// Where cell c's particle lands: cells trade places around each 2 × 2 block, turned 1–3 steps.
vec2 landing(vec2 c) {
  vec2 block = floor(c * 0.5);
  vec2 local = c - block * 2.0;
  int i = local.y < 0.5 ? int(local.x) : 3 - int(local.x);
  int turn = 1 + int(hash12(block + 7.3) * 2.999);
  return block * 2.0 + RING[(i + turn) % 4];
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float t = progress();
  vec2 p = fragCoord / uParticle;
  vec2 grid = iResolution.xy / uParticle;
  vec2 base = floor(p);
  vec4 col = vec4(uBackground, uBackdropAlpha);
  float top = -1.0;
  vec2 hitFrom = vec2(0.0);
  vec2 hitTo = vec2(0.0);
  float hitT = 0.0;
  float hitCover = 0.0;
  // Particles travel at most about 1.5 cells, so the 5 × 5 cells around are every candidate.
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 c = base + vec2(float(i), float(j));
      vec2 h = hash22(c);
      // Staggered: a sweep from the left plus some randomness.
      float delay = 0.5 * (0.55 * clamp(c.x / grid.x, 0.0, 1.0) + 0.45 * h.x);
      float k = smoothstep(0.0, 1.0, clamp((t - delay) / 0.5, 0.0, 1.0));
      float lift = sin(3.14159 * k);
      vec2 from = c + 0.5;
      vec2 to = landing(c) + 0.5;
      vec2 path = to - from;
      vec2 side = normalize(vec2(-path.y, path.x) + (h - 0.5) * 0.8);
      vec2 pos = mix(from, to, k) + side * lift * (uScatter + uSpin * 0.3) * (h.y > 0.5 ? 0.6 : -0.6);
      float size = 1.0 - 0.3 * lift;
      float angle = (h.y - 0.5) * 6.28318 * uSpin * lift;
      vec2 l = rot(-angle) * (p - pos) / size;
      float m = max(abs(l.x), abs(l.y));
      float z = h.y + lift;
      if (m <= 0.5 && z > top) {
        top = z;
        hitFrom = from + l;
        hitTo = to + l;
        hitT = k;
        hitCover = 1.0 - smoothstep(0.5 - 1.5 / uParticle, 0.5, m) * min(lift * 8.0, 1.0);
      }
    }
  }
  if (top > -1.0) {
    vec4 particle = mix(coverRGBA(uFrom, hitFrom / grid), coverRGBA(uTo, hitTo / grid), hitT);
    particle.rgb *= 1.0 + 0.15 * sin(3.14159 * hitT);
    col = mix(col, particle, hitCover);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Confetti", values: { uParticle: 10, uScatter: 0.8, uSpin: 1.6 } },
    { name: "Tiles", values: { uParticle: 48, uScatter: 0.2, uSpin: 0.15 } },
  ],
};

export const transitionInkBleed: ShaderEffect = {
  kind: "shader",
  id: "transition-ink-bleed",
  name: "Ink bleed",
  description: "The next image bleeds through the first like wet ink on paper, spreading from a few seeds with dark, pooled edges.",
  category: "transition",
  video: "transition",
  tags: ["transition", "morph", "ink", "watercolour", "image", "organic"],
  loop: 4,
  source: glsl(
    `// Ink bleed: To spreads through From along an fbm threshold grown from seeds, with a wet, darkened fringe.
${pair(SAMPLE_IMAGES.city, SAMPLE_IMAGES.landscape)}
uniform float uScale;      // @control min=0.5 max=8 default=3 label="Scale"
uniform float uEdge;       // @control min=0.005 max=0.2 default=0.05 label="Edge width"
uniform vec3 uInk;         // @control color default=#1B1F3B label="Ink"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    COMMON,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = progress();
  vec2 q = fragCoord / iResolution.y;
  // Distance to the nearest of four seeds spread across the frame, measured through a noisy warp so the blots are ragged.
  vec2 warped = q + (vec2(fbm(q * uScale, 5), fbm(q * uScale + 31.7, 5)) - 0.5) * 0.35;
  float aspect = iResolution.x / iResolution.y;
  float near = 1e9;
  for (int i = 0; i < 4; i++) {
    vec2 h = hash22(vec2(float(i), 3.7));
    vec2 seed = vec2((float(i) + 0.2 + 0.6 * h.x) / 4.0 * aspect, 0.2 + 0.6 * h.y);
    near = min(near, length(warped - seed));
  }
  // Fine noise adds capillary fingers to the front.
  float v = clamp(near / 0.5 * 0.75 + 0.25 * fbm(q * uScale * 4.0, 4) + 0.06 * (vnoise(q * uScale * 18.0) - 0.5), 0.0, 1.0);
  float front = mix(-2.0 * uEdge - 0.02, 1.0 + 2.0 * uEdge + 0.02, t);
  float gap = front - v;
  float wet = smoothstep(-uEdge * 0.3, uEdge * 0.3, gap);
  // Paper just ahead of the front darkens as it soaks; pigment pools just behind it.
  float soak = smoothstep(-2.0 * uEdge, 0.0, gap) * (1.0 - wet);
  float pool = wet * smoothstep(uEdge, 0.0, gap);
  vec2 bleed = vec2(soak - pool) * 0.004;
  vec4 col = mix(coverRGBA(uFrom, uv + bleed), coverRGBA(uTo, uv - bleed), wet);
  col.rgb = mix(col.rgb, col.rgb * 0.82, soak * 0.6);
  col = mix(col, vec4(uInk, 1.0), pool * 0.85);
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Sepia wash", values: { uInk: [0.36, 0.23, 0.12], uEdge: 0.08, uScale: 2 } },
    { name: "Crisp", values: { uEdge: 0.015, uScale: 5 } },
  ],
};

/** Shaders that turn one image into another: true morphs (category "morph") and morph-like transitions. */
export const morphShaders: ShaderEffect[] = [
  featureMorph,
  silhouetteMorph,
  transitionLiquidMorph,
  transitionDisplacement,
  transitionLuma,
  transitionParticleSwap,
  transitionInkBleed,
];
