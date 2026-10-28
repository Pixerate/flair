import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/** `glow(c)`: light as a colour over whatever is behind it (alpha is its brightest channel). */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

/**
 * Reading a silhouette from `uMask` (a `filter=mipmap` image control) placed
 * contained in `uSize` of the frame, centred, in frame units (height 1).
 * `shapeAt(p, blur)` is its coverage read at the mip level for a blur of
 * about `blur` frame units; `coverage(p, radius)` a smooth disc blur of it
 * (16 golden-angle taps at a matching mip level), so glows built from it are
 * smooth at any size. With `gKey` above 0, colours near the picture's corner
 * colour count as clear too, so a photo on a plain ground (the portrait)
 * works as a silhouette; call `setKey()` first. With no image, a disc.
 * Needs `uMask`, `uSize` and a `float gKeyTolerance` set before use.
 */
const MASK = `
vec3 gKeyColour;
float gKeyTolerance;

// The colour in the picture's top-left corner: the ground to key out.
void setKey(float tolerance) {
  gKeyTolerance = tolerance;
  vec4 c = textureLod(uMask, vec2(0.01, 0.99), 0.0);
  gKeyColour = c.rgb / max(c.a, 1e-3);
}

// Where frame point p falls in the picture (xy) and texels per frame unit (z).
vec3 maskPlace(vec2 p) {
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  return vec3(p / vec2(h * aspect, h) + 0.5, size.y / h);
}

float shapeAt(vec2 p, float blur) {
  if (textureSize(uMask, 0).x <= 1) {
    float d = length(p) - 0.3 * uSize;
    return clamp(0.5 - d / max(blur, 0.004), 0.0, 1.0);
  }
  vec3 m = maskPlace(p);
  if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
  vec4 c = textureLod(uMask, m.xy, log2(max(blur * m.z, 1.0)));
  float a = c.a;
  if (gKeyTolerance > 0.0) {
    float away = distance(c.rgb / max(c.a, 1e-3), gKeyColour);
    a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.12, away);
  }
  return a;
}

float coverage(vec2 p, float radius) {
  float sum = 0.0;
  for (int i = 0; i < 16; i++) {
    float r = radius * sqrt((float(i) + 0.5) / 16.0);
    float a = float(i) * 2.39996;
    sum += shapeAt(p + r * vec2(cos(a), sin(a)), radius * 0.4);
  }
  return sum / 16.0;
}`.trim();

/** Golden-angle disc offsets of unit radius for an `n`-tap blur, as the GLSL constant `GOLDEN<n>`. */
function goldenTaps(n: number): string {
  const taps = Array.from({ length: n }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996;
    return `vec2(${(r * Math.cos(a)).toFixed(5)}, ${(r * Math.sin(a)).toFixed(5)})`;
  });
  return `const vec2 GOLDEN${n}[${n}] = vec2[${n}](${taps.join(", ")});`;
}

/** A disc blur of the mask in `n` golden-angle taps, each read at the mip level for a blur of `blur` × the radius. */
function coverageTaps(name: string, n: number, blur: number): string {
  return `
${goldenTaps(n)}
float ${name}(vec2 p, float radius) {
  float sum = 0.0;
  if (gMaskPlace.w < 0.5) {
    for (int i = 0; i < ${n}; i++) sum += shapeAt(p + radius * GOLDEN${n}[i], radius * ${blur.toFixed(2)});
  } else {
    float lod = log2(max(radius * ${blur.toFixed(2)} * gMaskPlace.z, 1.0));
    for (int i = 0; i < ${n}; i++) sum += shapeLod(p + radius * GOLDEN${n}[i], lod);
  }
  return sum / ${n}.0;
}`.trim();
}

/** Taps in `coverageLite`. */
const LITE_TAPS = 10;

/**
 * {@link MASK} made cheaper to read many times a pixel, for the glows that
 * do: `setKey()` also works out once where the picture sits, the golden-angle
 * taps are constants and each blur picks its mip level once. `shapeAt` and
 * `coverage` give what MASK's do; `coverageLite(p, radius)` is the same blur
 * in {@link LITE_TAPS} taps a little higher up the mip chain, for wide blurs
 * where the difference does not show.
 */
const MASK_FAST = `
vec3 gKeyColour;
float gKeyTolerance;
// Picture units per frame unit (xy), texels per frame unit (z), 1 with a picture (w).
vec4 gMaskPlace;

// The colour in the picture's top-left corner: the ground to key out; and where the picture sits.
void setKey(float tolerance) {
  gKeyTolerance = tolerance;
  vec4 c = textureLod(uMask, vec2(0.01, 0.99), 0.0);
  gKeyColour = c.rgb / max(c.a, 1e-3);
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x / size.y;
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  gMaskPlace = vec4(1.0 / (h * aspect), 1.0 / h, size.y / h, size.x > 1.0 ? 1.0 : 0.0);
}

// Where frame point p falls in the picture (xy) and texels per frame unit (z).
vec3 maskPlace(vec2 p) {
  return vec3(p * gMaskPlace.xy + 0.5, gMaskPlace.z);
}

// The picture's coverage at p read at mip level lod (needs a picture).
float shapeLod(vec2 p, float lod) {
  vec2 uv = p * gMaskPlace.xy + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec4 c = textureLod(uMask, uv, lod);
  float a = c.a;
  if (gKeyTolerance > 0.0) {
    float away = distance(c.rgb / max(c.a, 1e-3), gKeyColour);
    a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.12, away);
  }
  return a;
}

float shapeAt(vec2 p, float blur) {
  if (gMaskPlace.w < 0.5) {
    float d = length(p) - 0.3 * uSize;
    return clamp(0.5 - d / max(blur, 0.004), 0.0, 1.0);
  }
  return shapeLod(p, log2(max(blur * gMaskPlace.z, 1.0)));
}

${coverageTaps("coverage", 16, 0.4)}

${coverageTaps("coverageLite", LITE_TAPS, 0.5)}`.trim();

export const aura: ShaderEffect = {
  kind: "shader",
  id: "aura",
  name: "Aura",
  description: "A silhouette wreathed in an energetic aura, flame-like wisps of light rising off its outline and pulsing.",
  category: "glow",
  video: "stills",
  tags: ["glow", "aura", "energy", "flames", "silhouette", "anime", "power-up"],
  source: glsl(
    `// Aura: a blurred silhouette, lifted and torn by rising fbm, read as tongues of light round the outline.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Silhouette"
uniform float uKey;          // @control min=0 max=0.5 default=0.12 label="Key out the corner colour (0 off)"
uniform float uSize;         // @control min=0.2 max=1 default=1 label="Size"
uniform vec3 uColor;         // @control color default=#FFC93C label="Aura"
uniform vec3 uCore;          // @control color default=#FFF6D5 label="Core"
uniform vec3 uBackground;    // @control color default=#0B0A12 label="Background"
uniform float uHeight;       // @control min=0 max=0.4 default=0.16 label="Flame height"
uniform float uSpread;       // @control min=0.01 max=0.15 default=0.06 label="Spread"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform float uPulse;        // @control min=0 max=1 default=0.4 label="Pulse"
uniform float uIntensity;    // @control min=0 max=3 default=1.1 label="Intensity"`,
    HASH,
    NOISE,
    FBM,
    MASK_FAST,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(uKey);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed;
  float px = 1.0 / iResolution.y;
  // Rising noise: tongues flow up and sway.
  vec2 q = p * 6.0;
  float n = fbm(vec2(q.x, q.y - t * 2.0), 5);
  float n2 = fbm(vec2(q.x * 1.7 + 4.1, q.y * 0.9 - t * 2.9), 4);
  float pulse = 1.0 + uPulse * (0.3 * sin(t * 3.0) + 0.12 * sin(t * 7.3 + 1.0));
  // The silhouette blurred at three widths, swayed and stretched upward by the noise, so light gathers above it.
  // The two wide blurs, torn by the noise anyway, take fewer taps.
  vec2 warp = vec2((n2 - 0.5) * uSpread * 1.5, -(n - 0.3) * uHeight);
  float inner = coverage(p + warp * 0.3, uSpread * 0.5);
  float outer = coverageLite(p + warp, uSpread * 1.4);
  float tall = coverageLite(p + warp * 1.5 - vec2(0.0, uHeight), uSpread * 2.2);
  float field = (inner * 0.9 + outer * 0.8 + tall * 0.6) * pulse;
  // Torn into tongues: the noise breaks the thin outer field into licks, the thick inner field holds.
  float tongues = smoothstep(0.12, 0.95, field * (0.45 + 1.1 * n));
  float wisps = smoothstep(0.55, 0.75, n2) * smoothstep(0.02, 0.3, tall) * 0.5;
  float body = shapeAt(p, 1.5 * px);
  vec3 light = uColor * (tongues * 1.3 + wisps + field * 0.25) + uCore * smoothstep(0.5, 0.9, inner * pulse) * 0.8;
  light *= uIntensity;
  vec3 col = uBackground + (1.0 - exp(-light));
  // The figure in front, its own colours, rim-lit by the aura.
  if (gMaskPlace.w > 0.5 && body > 0.0) {
    vec3 m = maskPlace(p);
    vec4 c = texture(uMask, m.xy);
    vec3 own = c.rgb / max(c.a, 1e-3);
    float rim = 1.0 - coverage(p, uSpread * 0.25);
    vec3 lit = own * mix(vec3(0.75), uColor, 0.25) + uColor * rim * 1.6 * uIntensity * pulse * 0.5;
    col = mix(col, lit, body);
  } else {
    col = mix(col, uBackground * 0.6 + uColor * 0.15, body);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Super saiyan", values: { uColor: [1, 0.79, 0.24], uCore: [1, 0.97, 0.84], uHeight: 0.22, uSpeed: 1.6, uPulse: 0.6, uIntensity: 1.8 } },
    { name: "Spirit", values: { uColor: [0.25, 0.85, 1], uCore: [0.85, 1, 1], uBackground: [0.02, 0.05, 0.09], uHeight: 0.1, uSpeed: 0.6, uPulse: 0.3 } },
    { name: "Dark", values: { uColor: [0.55, 0.2, 0.95], uCore: [0.95, 0.75, 1], uBackground: [0.02, 0.01, 0.04], uHeight: 0.18, uSpread: 0.07, uIntensity: 1.6 } },
  ],
};

export const bloom: ShaderEffect = {
  kind: "shader",
  id: "bloom",
  name: "Bloom",
  description: "A picture whose bright areas bleed soft light into their surroundings, with an optional anamorphic lens streak at any angle.",
  category: "glow",
  video: "filter",
  tags: ["glow", "bloom", "image", "lens", "light", "filter", "anamorphic"],
  source: glsl(
    `// Bloom: the brightest parts of the image, blurred at two scales (and streaked sideways), added back as light.
uniform sampler2D uImage;    // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uThreshold;    // @control min=0 max=1 default=0.6 label="Threshold"
uniform float uKnee;         // @control min=0.01 max=0.5 default=0.2 label="Softness"
uniform float uRadius;       // @control min=0.01 max=0.2 default=0.08 label="Radius"
uniform float uIntensity;    // @control min=0 max=4 default=2.5 label="Intensity"
uniform vec3 uTint;          // @control color default=#FFFFFF label="Tint"
uniform float uStreak;       // @control min=0 max=2 default=0 label="Anamorphic streak"
uniform vec3 uStreakColor;   // @control color default=#7FB2FF label="Streak colour"
uniform float uStreakAngle;  // @control min=0 max=180 default=0 label="Streak angle (°)"
uniform float uStreakLength; // @control min=0.05 max=0.6 default=0.3 label="Streak length"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// The light above the threshold at uv, read at a mip level (a soft knee, so light fades in smoothly). A coarse
// level has averaged small lights with their dark surroundings, so its threshold is lowered a little to match.
vec3 bright(vec2 uv, float lod) {
  vec3 c = textureSize(uImage, 0).x > 1 ? textureLod(uImage, uv, lod).rgb : testCard(fract(uv));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float thr = uThreshold * exp2(-max(lod, 0.0) * 0.1);
  float knee = uKnee * exp2(-max(lod, 0.0) * 0.1);
  float k = clamp((l - thr + knee) / (2.0 * knee), 0.0, 1.0);
  float soft = l > thr ? l - thr : k * k * knee * 0.5;
  return c * max(soft, 0.0) / max(l, 1e-4);
}

// A disc blur of the bright pass, radius r (uv height units): 20 golden-angle taps at a mip level about as
// coarse as their spacing, so they run together.
vec3 blurBright(vec2 uv, float r, float texels) {
  float lod = log2(max(r * 0.4 * texels, 1.0));
  vec3 sum = vec3(0.0);
  vec2 aspect = vec2(iResolution.y / iResolution.x, 1.0);
  for (int i = 0; i < 20; i++) {
    float rr = r * sqrt((float(i) + 0.5) / 20.0);
    float a = float(i) * 2.39996;
    sum += bright(uv + rr * vec2(cos(a), sin(a)) * aspect, lod);
  }
  return sum / 20.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float texels = textureSize(uImage, 0).y > 1 ? float(textureSize(uImage, 0).y) : iResolution.y;
  vec3 light = blurBright(uv, uRadius * 0.3, texels) * 0.3 + blurBright(uv, uRadius, texels) * 0.4 + blurBright(uv, uRadius * 3.0, texels) * 0.5;
  light *= uTint;
  if (uStreak > 0.0) {
    // A long smear of the bright pass along the streak angle (horizontal at 0°, in frame widths), read a little
    // blurred so its taps run together.
    float a = radians(uStreakAngle);
    vec2 along = vec2(cos(a), sin(a) * iResolution.x / iResolution.y) * uStreakLength;
    vec3 streak = vec3(0.0);
    float w = 0.0;
    float jitter = fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float texelsX = textureSize(uImage, 0).x > 1 ? float(textureSize(uImage, 0).x) : iResolution.x;
    float lodStreak = log2(max(0.0125 * texelsX, 1.0));
    for (int i = -24; i <= 24; i++) {
      float f = (float(i) + jitter) / 24.0;
      float k = exp(-abs(f) * 3.5);
      streak += bright(uv + along * f, lodStreak) * k;
      w += k;
    }
    light += dot(streak / w, vec3(0.33)) * uStreakColor * uStreak * 4.0;
  }
  light *= uIntensity;
  vec4 pic = pictureRGBA(uImage, uv);
  // The bloom is light added over the picture, so it also shows where the picture is clear.
  float glowA = clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0);
  float alpha = max(pic.a, glowA);
  vec3 col = (pic.rgb * pic.a + light) / max(alpha, 1e-4);
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "Dreamy", values: { uThreshold: 0.45, uRadius: 0.12, uIntensity: 1.8, uTint: [1, 0.9, 0.95] } },
    { name: "Anamorphic night", values: { uImage: SAMPLE_IMAGES.city, uStreak: 1.2, uThreshold: 0.6, uIntensity: 3 } },
    { name: "Subtle", values: { uThreshold: 0.75, uRadius: 0.04, uIntensity: 1.2 } },
    { name: "Diagonal streak", values: { uImage: SAMPLE_IMAGES.city, uStreak: 1.4, uStreakAngle: 35, uStreakLength: 0.45, uStreakColor: [0.18, 0.83, 1], uThreshold: 0.6, uIntensity: 1.5 } },
  ],
};

export const pulsingHalo: ShaderEffect = {
  kind: "shader",
  id: "pulsing-halo",
  name: "Pulsing halo",
  description: "Soft halo rings behind a centre spot, breathing slowly in and out with a gentle shimmer running round them.",
  category: "glow",
  tags: ["glow", "halo", "ring", "breathe", "overlay", "pulse", "ui"],
  transparent: true,
  loop: 4,
  source: glsl(
    `// Pulsing halo: soft rings round the centre that grow and brighten with each breath, shimmering round.
uniform vec3 uColor;         // @control color default=#7DD3FC label="Outer colour"
uniform vec3 uInner;         // @control color default=#E0F2FE label="Inner colour"
uniform float uRadius;       // @control min=0.05 max=0.45 default=0.2 label="Radius"
uniform float uWidth;        // @control min=0.004 max=0.12 default=0.025 label="Ring width"
uniform int uRings;          // @control min=1 max=4 default=2 label="Rings"
uniform float uSpacing;      // @control min=0.02 max=0.2 default=0.07 label="Ring spacing"
uniform float uBreath;       // @control min=0 max=0.5 default=0.12 label="Breath"
uniform float uPeriod;       // @control min=1 max=10 default=4 label="Seconds per breath"
uniform float uShimmer;      // @control min=0 max=1 default=0.5 label="Shimmer"
uniform float uIntensity;    // @control min=0 max=3 default=1.2 label="Intensity"`,
    HASH,
    NOISE,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float d = length(p);
  vec2 dir = p / max(d, 1e-4);
  float phase = 6.28318 * iTime / uPeriod;
  float b = 0.5 - 0.5 * cos(phase);
  float scale = 1.0 + uBreath * (b - 0.3);
  // The shimmer: noise round the ring, drifting on a circle so it repeats every breath.
  vec2 drift = vec2(cos(phase), sin(phase));
  vec3 light = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= uRings) break;
    float fi = float(i);
    float r = (uRadius + fi * uSpacing * (1.0 + 0.5 * b)) * scale;
    float w = uWidth * (1.0 + 0.5 * fi);
    float ring = exp(-pow((d - r) / w, 2.0)) + 0.4 * exp(-abs(d - r) / (w * 3.0));
    float s = vnoise(dir * 3.0 + drift * 0.8 + fi * 7.3) * 0.6 + vnoise(dir * 7.0 - drift * 1.3 + fi * 3.1) * 0.4;
    float sh = mix(1.0, 0.35 + 1.3 * s, uShimmer);
    float fade = 1.0 / (1.0 + 0.9 * fi);
    vec3 tint = mix(uInner, uColor, uRings > 1 ? fi / float(uRings - 1) : 0.6);
    light += tint * ring * sh * fade;
  }
  // A faint glow filling the centre, behind whatever sits there.
  light += uInner * 0.18 * exp(-pow(d / (uRadius * scale), 2.0) * 1.5);
  light *= uIntensity * (0.7 + 0.45 * b);
  fragColor = glow(light);
}`,
  ),
  presets: [
    { name: "Calm", values: { uRings: 1, uWidth: 0.04, uPeriod: 6, uShimmer: 0.2 } },
    { name: "Golden", values: { uColor: [1, 0.66, 0.2], uInner: [1, 0.93, 0.7], uRings: 3, uShimmer: 0.8 } },
    { name: "Notify", values: { uColor: [0.98, 0.3, 0.45], uInner: [1, 0.8, 0.85], uRadius: 0.12, uBreath: 0.35, uPeriod: 1.5, uRings: 3 } },
  ],
};

export const neonOutline: ShaderEffect = {
  kind: "shader",
  id: "neon-outline",
  name: "Neon outline",
  description: "Any shape or word traced in a crisp neon line with a wide soft glow, its colour flowing along the outline and flickering now and then.",
  category: "glow",
  video: "none",
  tags: ["glow", "neon", "outline", "text", "logo", "overlay", "sign"],
  transparent: true,
  source: glsl(
    `// Neon outline: the mask's edge as a bright tube, a soft halo either side, coloured along the outline.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${textImage("GLOW")} label="Shape"
uniform float uSize;         // @control min=0.2 max=1 default=0.85 label="Size"
uniform vec3 uColorA;        // @control color default=#FF3DD8 label="Colour"
uniform vec3 uColorB;        // @control color default=#38E1FF label="Gradient to"
uniform float uGradient;     // @control min=0 max=1 default=1 label="Gradient along outline"
uniform float uFlow;         // @control min=0 max=2 default=0.3 label="Gradient flow"
uniform float uLine;         // @control min=0.5 max=8 default=2 label="Line width (px)"
uniform float uGlow;         // @control min=0.01 max=0.2 default=0.05 label="Glow size"
uniform float uIntensity;    // @control min=0 max=3 default=1.3 label="Intensity"
uniform float uFlicker;      // @control min=0 max=1 default=0.3 label="Flicker"
uniform float uFill;         // @control min=0 max=1 default=0 label="Fill"`,
    HASH,
    MASK,
    GLOW,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(0.0);
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  // The edge, softened a few pixels so its slope gives a smooth distance in pixels.
  float v = coverage(p, 3.0 * px) - 0.5;
  vec2 g = vec2(dFdx(v), dFdy(v));
  float d = abs(v) / max(length(g), 0.02);
  float tube = exp(-pow(d / uLine, 2.0));
  float core = exp(-pow(d / (uLine * 0.4), 2.0));
  // The halo: blurred coverage is half way across the edge, falling off either side.
  float c1 = coverage(p, uGlow * 0.4);
  float c2 = coverage(p, uGlow);
  float halo = (1.0 - abs(2.0 * c1 - 1.0)) * 0.55 + (1.0 - abs(2.0 * c2 - 1.0)) * 0.35;
  float inside = shapeAt(p, px);
  // Colour along the outline, flowing.
  float k = mix(0.0, 0.5 + 0.5 * sin(p.x * 5.0 + p.y * 2.5 - iTime * uFlow * 3.0), uGradient);
  vec3 tint = mix(uColorA, uColorB, k);
  // Flicker: now and then a burst of quick dips, as a tired tube does.
  float burst = step(0.72, hash12(vec2(floor(iTime * 1.7), 3.0)));
  float dip = step(0.45, hash12(vec2(floor(iTime * 24.0), 7.0)));
  float flick = 1.0 - uFlicker * burst * (1.0 - dip) * 0.85;
  vec3 light = tint * (tube * 1.6 + halo) + mix(tint, vec3(1.0), 0.7) * core * 0.9;
  light += tint * inside * uFill * 0.6;
  fragColor = glow(light * uIntensity * flick);
}`,
  ),
  presets: [
    { name: "Bar sign", values: { uColorA: [1, 0.24, 0.4], uGradient: 0, uFlicker: 0.8, uLine: 3 } },
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uSize: 0.7, uColorA: [1, 0.3, 0.55], uColorB: [1, 0.65, 0.3], uFlicker: 0 } },
    { name: "Filled", values: { uFill: 0.35, uGlow: 0.09, uColorA: [0.5, 1, 0.4], uColorB: [0.2, 0.8, 1] } },
  ],
};

export const backlightGlow: ShaderEffect = {
  kind: "shader",
  id: "backlight-glow",
  name: "Backlight glow",
  description: "A dark silhouette with a light behind it: radiant rays stream past its edges and glow spills round its rim.",
  category: "glow",
  video: "none",
  tags: ["glow", "backlight", "silhouette", "rays", "eclipse", "rim", "logo"],
  source: glsl(
    `// Backlight glow: a light behind a mask, marched toward for shafts the shape blocks, with spill and a rim.
uniform sampler2D uMask;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.logo} label="Silhouette"
uniform float uKey;          // @control min=0 max=0.5 default=0 label="Key out the corner colour (0 off)"
uniform float uSize;         // @control min=0.2 max=1 default=0.6 label="Size"
uniform vec3 uLight;         // @control color default=#FFC46B label="Light"
uniform vec3 uBackground;    // @control color default=#07060D label="Background"
uniform vec3 uObject;        // @control color default=#040308 label="Object"
uniform float uLightX;       // @control min=-0.5 max=0.5 default=0 label="Light across"
uniform float uLightY;       // @control min=-0.5 max=0.5 default=0.04 label="Light up"
uniform float uGlowSize;     // @control min=0.05 max=0.8 default=0.3 label="Light size"
uniform float uRays;         // @control min=0 max=1 default=0.8 label="Rays"
uniform float uRim;          // @control min=0 max=1 default=0.6 label="Rim light"
uniform float uSpeed;        // @control min=0 max=2 default=0.4 label="Ray drift"
uniform float uIntensity;    // @control min=0 max=3 default=1.3 label="Intensity"`,
    HASH,
    NOISE,
    MASK_FAST,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setKey(uKey);
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 L = vec2(uLightX, uLightY);
  vec2 toL = L - p;
  float dl = length(toL);
  // Light reaching here: march toward the light, the shape shadowing what is behind it.
  // 24 jittered steps (decay and sum scaled to match 0.965 per 1/40 of the way); steps three light
  // sizes or more from it add almost nothing, so they skip reading the shape.
  float shafts = 0.0;
  float decay = 1.0;
  float jitter = hash12(fragCoord);
  float far = 3.0 * uGlowSize;
  for (int i = 0; i < 24; i++) {
    float s = (float(i) + jitter) / 24.0;
    float r = dl * (1.0 - s);
    float open = r < far ? 1.0 - shapeAt(p + toL * s, 2.0 * px + 0.01 * s) : 1.0;
    float g = r / uGlowSize;
    shafts += open * exp(-g * g) * decay;
    decay *= 0.94236;
  }
  shafts /= 12.0;
  // Streaks round the light, drifting slowly.
  vec2 dir = -toL / max(dl, 1e-4);
  float a = iTime * uSpeed * 0.2;
  float streak = vnoise(dir * 6.0 + vec2(a, -a)) * 0.6 + vnoise(dir * 15.0 - vec2(a * 2.0, a)) * 0.4;
  float rays = shafts * mix(1.0, 0.25 + 1.5 * streak * streak, uRays);
  // Spill: light wrapping just round the edges.
  float body = shapeAt(p, 1.2 * px);
  float spill = coverage(p, 0.03) * 0.8 + coverageLite(p, 0.08) * 0.5;
  float glowAt = exp(-pow(dl / (uGlowSize * 1.6), 2.0));
  vec3 light = uLight * (rays * 1.4 + spill * (1.0 - body) * glowAt * 1.2) * uIntensity;
  vec3 col = uBackground + (1.0 - exp(-light));
  // The object, dark, its edges facing the light lit.
  float edge = 1.0 - coverage(p, 0.012);
  vec2 grad = vec2(dFdx(edge), dFdy(edge));
  float facing = 0.5 + 0.5 * dot(normalize(grad + 1e-6), normalize(toL + 1e-6));
  vec3 obj = uObject + uLight * edge * uRim * (0.4 + 0.6 * facing) * glowAt * 1.5 * uIntensity;
  col = mix(col, obj, body);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Eclipse", values: { uLight: [1, 0.95, 0.85], uGlowSize: 0.22, uRays: 0.9, uRim: 0.8 } },
    { name: "Hero portrait", values: { uMask: SAMPLE_IMAGES.portrait, uKey: 0.12, uSize: 1, uLightY: 0.12, uLight: [0.6, 0.8, 1] } },
    { name: "Sunset", values: { uLight: [1, 0.45, 0.2], uBackground: [0.12, 0.04, 0.1], uLightY: -0.08, uGlowSize: 0.5 } },
  ],
};

export const rimLight: ShaderEffect = {
  kind: "shader",
  id: "rim-light",
  name: "Rim light",
  description: "A picture given a coloured studio kicker light along the edges that face a chosen direction.",
  category: "glow",
  video: "filter",
  tags: ["glow", "rim", "light", "image", "portrait", "studio", "filter"],
  source: glsl(
    `// Rim light: luminance edges, kept where they face the light, glowing in its colour over the dimmed picture.
uniform sampler2D uImage;    // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uColor;         // @control color default=#4FD1FF label="Light colour"
uniform float uAngle;        // @control min=0 max=360 default=35 label="Light from (°)"
uniform float uWidth;        // @control min=0.5 max=8 default=3 label="Rim width (px)"
uniform float uFocus;        // @control min=0 max=1 default=1 label="Focus on the light side"
uniform float uThreshold;    // @control min=0 max=0.5 default=0.06 label="Threshold"
uniform float uIntensity;    // @control min=0 max=4 default=2.4 label="Intensity"
uniform float uDim;          // @control min=0 max=1 default=0.3 label="Darken picture"
uniform bool uBrightSubject; // @control default=false label="Subject brighter than background"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `float luma(vec2 uv) {
  vec4 c = pictureRGBA(uImage, uv);
  return dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) * c.a;
}

// The luminance gradient (Sobel), sampling d apart in uv: it points from dark to bright.
vec2 gradient(vec2 uv, vec2 d) {
  float tl = luma(uv + vec2(-d.x, d.y));
  float t = luma(uv + vec2(0.0, d.y));
  float tr = luma(uv + d);
  float l = luma(uv - vec2(d.x, 0.0));
  float r = luma(uv + vec2(d.x, 0.0));
  float bl = luma(uv - d);
  float b = luma(uv - vec2(0.0, d.y));
  float br = luma(uv + vec2(d.x, -d.y));
  return vec2(tr + 2.0 * r + br - tl - 2.0 * l - bl, tl + 2.0 * t + tr - bl - 2.0 * b - br) * 0.25;
}

// How much rim light an edge sampled d apart gets: its strength, toward the light.
float rimAt(vec2 uv, vec2 d, vec2 toLight) {
  vec2 g = gradient(uv, d);
  float s = length(g);
  // A dark subject on a light ground: its outward normal points to the brighter side.
  vec2 n = (uBrightSubject ? -g : g) / max(s, 1e-5);
  float facing = mix(1.0, smoothstep(0.25, 0.95, dot(n, toLight)), uFocus);
  return smoothstep(uThreshold, uThreshold + 0.12, s) * facing;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float a = radians(uAngle);
  vec2 toLight = vec2(cos(a), sin(a));
  vec2 d = uWidth / iResolution.xy;
  // The light falls on the subject's side of the edge: read it a little toward the light, and keep it where
  // this pixel is on the subject's side (darker than what lies toward the light, or brighter if so set).
  float crisp = rimAt(uv + toLight * d, d, toLight);
  float soft = rimAt(uv + toLight * d * 2.5, d * 3.0, toLight);
  float rise = luma(uv + toLight * d * 3.0) - luma(uv);
  float side = smoothstep(0.0, 0.06, uBrightSubject ? -rise : rise);
  crisp *= side;
  soft *= mix(0.5, 1.0, side);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 light = uColor * (crisp + 0.45 * soft) * uIntensity + vec3(1.0) * crisp * crisp * 0.12 * uIntensity;
  vec3 col = pic.rgb * (1.0 - uDim) + light * (1.0 - 0.5 * pic.rgb);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Kicker", values: { uColor: [1, 0.86, 0.66], uAngle: 160, uDim: 0.2 } },
    { name: "Cyberpunk", values: { uColor: [1, 0.2, 0.7], uAngle: 20, uDim: 0.55, uIntensity: 2.5, uWidth: 3.5 } },
    { name: "Top light", values: { uColor: [0.85, 0.95, 1], uAngle: 90, uFocus: 0.7 } },
  ],
};

/** Glows and auras: halos, bloom, outlines and rim light round shapes and pictures. */
export const glowShaders: ShaderEffect[] = [aura, bloom, pulsingHalo, neonOutline, backlightGlow, rimLight];
