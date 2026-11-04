import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { INK_EDGE } from "./comic.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Anime and manga shaders: a picture printed as a black-and-white manga page,
 * a painted anime sky, cherry blossom drifting across, a shoujo sparkle
 * backdrop and the gloom lines that hang over a character's despair. Overlays
 * composite premultiplied and unpremultiply at the end, as the other overlays do.
 */

const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

export const mangaTone: ShaderEffect = {
  kind: "shader",
  id: "manga-tone",
  name: "Manga tone",
  description: "Any picture printed as a black-and-white manga page: inked outlines, mid-tones cut from screentone dot sheets, shadows in solid black or cross-hatching, on off-white paper.",
  category: "anime",
  video: "filter",
  tags: ["anime", "manga", "comic", "screentone", "ink", "black-and-white", "image", "print"],
  presets: [
    { name: "Fine tone", values: { uTones: 3, uToneSize: 3, uLine: 1, uHatch: 0.8 } },
    { name: "Bold ink", values: { uTones: 1, uToneSize: 6, uLine: 2.4, uThreshold: 0.2, uBlack: 0.3, uHatch: 0 } },
    { name: "Old volume", values: { uPaper: [0.93, 0.89, 0.8], uInk: [0.16, 0.13, 0.12], uToneSize: 5 } },
  ],
  source: glsl(
    `// Manga tone: inked outlines, screentone mid-tones and hatched or solid shadows, in black and white.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uLine;        // @control min=0.5 max=4 default=1.4 label="Line weight (px)"
uniform float uThreshold;   // @control min=0.05 max=1 default=0.3 label="Ink threshold"
uniform int uTones;         // @control min=1 max=4 default=2 label="Screentone levels"
uniform float uToneSize;    // @control min=2 max=12 default=4.5 label="Tone dot pitch (px)"
uniform float uToneAngle;   // @control min=0 max=90 default=45 label="Tone angle (°)"
uniform float uBlack;       // @control min=0 max=0.5 default=0.16 label="Shadows below"
uniform float uWhite;       // @control min=0.5 max=1 default=0.74 label="Paper white above"
uniform float uHatch;       // @control min=0 max=1 default=0.5 label="Hatched shadows"
uniform vec3 uInk;          // @control color default=#111111 label="Ink"
uniform vec3 uPaper;        // @control color default=#FAF8F2 label="Paper"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    INK_EDGE,
    `// Ink of a dot screen at angle a (radians) covering c of the paper: round dots that never touch.
float toneDots(vec2 p, float a, float c) {
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 q = r * p / uToneSize;
  float d = length(fract(q) - 0.5);
  float radius = sqrt(c / 3.14159);
  float aa = 0.6 / uToneSize;
  return clamp((radius - d) / (2.0 * aa) + 0.5, 0.0, 1.0) * step(1e-3, c);
}

// The share of paper the tone sheet of level k (0 the darkest) covers.
float toneCover(float k) {
  float n = float(uTones);
  return n > 1.0 ? mix(0.6, 0.16, k / (n - 1.0)) : 0.4;
}

// Ink of cross-hatching: two sets of diagonal strokes, each a third of their spacing wide.
float hatching(vec2 p) {
  float s = uToneSize * 0.9;
  float a = abs(fract(dot(p, vec2(0.7071, -0.7071)) / s) - 0.5);
  float b = abs(fract(dot(p, vec2(0.7071, 0.7071)) / s) - 0.5);
  return max(clamp((a - 0.33) * s + 0.5, 0.0, 1.0), clamp((b - 0.33) * s + 0.5, 0.0, 1.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  // A little blur first, so the tones follow forms rather than texture.
  vec3 c = (pic.rgb * 4.0 + picture(uImage, uv + vec2(px.x * 1.5, 0.0)) + picture(uImage, uv - vec2(px.x * 1.5, 0.0)) +
            picture(uImage, uv + vec2(0.0, px.y * 1.5)) + picture(uImage, uv - vec2(0.0, px.y * 1.5))) / 8.0;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Mid-tones in uTones bands, each its own sheet, the edges between them antialiased.
  float v = clamp((l - uBlack) / max(uWhite - uBlack, 1e-3), 0.0, 0.9999) * float(uTones);
  float k = floor(v);
  float w = max(fwidth(v), 1e-3) * 0.75;
  float next = k + 1.0 < float(uTones) ? toneCover(k + 1.0) : 0.0;
  float a = radians(uToneAngle);
  float tone = mix(toneDots(fragCoord, a, toneCover(k)), toneDots(fragCoord, a, next), smoothstep(1.0 - w, 1.0, fract(v)));
  // Paper above the white point, shadows below the black point.
  float fl = max(fwidth(l), 1e-3);
  tone *= smoothstep(uWhite + fl, uWhite - fl, l);
  float shadow = smoothstep(uBlack + fl, uBlack - fl, l);
  float ink = mix(tone, mix(1.0, hatching(fragCoord), uHatch), shadow);
  // Inked outlines over the tones.
  float edge = inkEdge(uImage, uv, uLine * px);
  float line = smoothstep(uThreshold, uThreshold + 0.06, edge);
  ink = max(ink, line);
  vec3 paper = uPaper * (0.97 + 0.03 * vnoise(fragCoord * 0.3));
  fragColor = vec4(mix(paper, uInk, ink), max(pic.a, line));
}`,
  ),
};

export const animeSky: ShaderEffect = {
  kind: "shader",
  id: "anime-sky",
  name: "Anime sky",
  description: "A painted anime sky: a deep blue gradient over towering cumulus clouds shaded in a few crisp bands, lit at their edges by a glaring sun with soft lens-flare rings, drifting slowly.",
  category: "anime",
  tags: ["anime", "sky", "clouds", "summer", "background", "sun", "lens-flare", "painted"],
  presets: [
    { name: "Golden hour", values: { uZenith: [0.24, 0.27, 0.62], uHorizon: [1, 0.72, 0.5], uCloud: [1, 0.9, 0.78], uCloudShade: [0.66, 0.5, 0.66], uSun: [1, 0.82, 0.55], uSunX: 0.3, uSunY: 0.55 } },
    { name: "Twilight", values: { uZenith: [0.08, 0.08, 0.26], uHorizon: [0.92, 0.48, 0.58], uCloud: [0.98, 0.7, 0.72], uCloudShade: [0.32, 0.26, 0.5], uSun: [1, 0.66, 0.6], uGlare: 0.35, uSunY: 0.3 } },
    { name: "Clear", values: { uCover: 0.2, uGlare: 0.8 } },
  ],
  source: glsl(
    `// Anime sky: a sky gradient, cel-shaded cumulus lit from the sun, and the sun's glare and flare.
uniform vec3 uZenith;       // @control color default=#1D59D6 label="Sky"
uniform vec3 uHorizon;      // @control color default=#A6DCF8 label="Horizon"
uniform vec3 uCloud;        // @control color default=#FFFFFF label="Clouds"
uniform vec3 uCloudShade;   // @control color default=#93AEE0 label="Cloud shadow"
uniform vec3 uSun;          // @control color default=#FFF4D2 label="Sun"
uniform float uCover;       // @control min=0 max=1 default=0.55 label="Cloud cover"
uniform float uScale;       // @control min=0.5 max=3 default=1.3 label="Cloud size"
uniform float uBands;       // @control min=1 max=4 default=2 step=1 label="Shading bands"
uniform float uSpeed;       // @control min=0 max=0.2 default=0.025 label="Drift"
uniform float uGlare;       // @control min=0 max=1 default=0.6 label="Sun glare"
uniform float uSunX;        // @control min=0 max=1 default=0.78 label="Sun across"
uniform float uSunY;        // @control min=0 max=1 default=0.92 label="Sun height"`,
    HASH,
    NOISE,
    FBM,
    `// Cloud density at p, positive inside a cloud: noise of a few octaves heaped up towards the bottom of the frame.
float cloudField(vec2 p, int octaves) {
  vec2 q = p / uScale * vec2(3.2, 2.6) + vec2(iTime * uSpeed * 2.0, 0.0);
  float heap = smoothstep(0.5, -0.5, p.y);
  return fbm(q, octaves) - 0.5 + (heap - 0.6) * 0.6 + (uCover - 0.5) * 0.45;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 sun = (vec2(uSunX, uSunY) - 0.5) * vec2(aspect, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(uv.y, 0.8));
  // Glare: a soft halo and a hot core round the sun.
  float ds = length(p - sun);
  col += uSun * uGlare * (0.5 * exp(-ds * 3.0) + 0.6 * exp(-ds * 18.0));
  // Clouds: crisp-edged, shaded in bands. A point is lit by how near open sky is above it and
  // towards the sun (on a smoother outline), so each billow gets a lit crown over a shaded body.
  float d = cloudField(p, 5);
  float aa = max(fwidth(d), 1e-4);
  float inside = smoothstep(-aa, aa, d);
  if (inside > 0.0) {
    vec2 toSun = normalize(sun - p + 1e-4);
    float lit = clamp(1.05 - cloudField(p + normalize(toSun + vec2(0.0, 1.0)) * 0.05, 3) * 3.0 + 0.3 * p.y, 0.0, 1.0);
    float x = lit * uBands;
    float k = floor(x);
    float w = max(fwidth(x), 1e-3) * 0.75;
    float band = min((k + smoothstep(1.0 - w, 1.0, fract(x))) / uBands, 1.0);
    vec3 cloud = mix(uCloudShade, uCloud, band);
    // A bright rim where a cloud's edge faces the sun.
    float rim = smoothstep(0.03, 0.0, d) * smoothstep(0.4, 0.8, lit);
    cloud = mix(cloud, uSun, rim * 0.5 * (0.4 + 0.6 * uGlare));
    col = mix(col, cloud, inside);
  }
  // Lens flare: soft rings strung from the sun through the middle of the frame.
  for (int i = 0; i < 4; i++) {
    float t = 0.5 + 0.45 * float(i);
    vec2 c = sun * (1.0 - 2.0 * t);
    float r = 0.03 + 0.035 * float(i % 3);
    float ring = smoothstep(r, r * 0.6, length(p - c)) * 0.35 + smoothstep(0.012, 0.0, abs(length(p - c) - r)) * 0.4;
    col += uSun * ring * uGlare * 0.25;
  }
  fragColor = vec4(min(col, 1.0), 1.0);
}`,
  ),
};

export const sakuraPetals: ShaderEffect = {
  kind: "shader",
  id: "sakura-petals",
  name: "Sakura petals",
  description: "Cherry blossom petals drifting down on a breeze at three depths, each notched petal fluttering and flipping over as it falls.",
  category: "anime",
  tags: ["anime", "sakura", "cherry-blossom", "petals", "spring", "japan", "overlay", "particles"],
  transparent: true,
  presets: [
    { name: "Spring sky", values: { uBackgroundAlpha: 1 } },
    { name: "Storm of petals", values: { uDensity: 0.9, uWind: 0.8, uFall: 0.2, uFlutter: 1.6 } },
    { name: "White plum", values: { uPetal: [1, 0.97, 0.97], uPetalBase: [0.95, 0.72, 0.8], uBackground: [0.17, 0.15, 0.25], uBackgroundAlpha: 1 } },
  ],
  source: glsl(
    `// Sakura petals: notched petals carried down and across, fluttering and flipping, at three depths.
uniform vec3 uPetal;            // @control color default=#FFC8D9 label="Petal"
uniform vec3 uPetalBase;        // @control color default=#F0819F label="Petal base"
uniform vec3 uBackground;       // @control color default=#BFE4FF label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform float uDensity;         // @control min=0.1 max=1 default=0.45 label="Density"
uniform float uSize;            // @control min=0.01 max=0.06 default=0.03 label="Petal size"
uniform float uFall;            // @control min=0 max=0.5 default=0.12 label="Fall speed"
uniform float uWind;            // @control min=-1 max=1 default=0.3 label="Wind"
uniform float uFlutter;         // @control min=0 max=2 default=1 label="Flutter"`,
    HASH,
    OVER,
    `const float TAU = 6.28318;

// How far inside a petal q is (negative outside): one unit long each way, its base down and a notch at its tip.
float petal(vec2 q) {
  float y = clamp(q.y, -1.0, 1.0);
  float w = 0.62 * sqrt(max(1.0 - y * y, 0.0)) * (0.7 + 0.3 * (y + 1.0));
  float body = min(w - abs(q.x), 1.0 - abs(q.y));
  float notch = (0.74 + 1.1 * abs(q.x)) - q.y;
  return min(body, notch);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  for (int l = 2; l >= 0; l--) {
    // Farther petals are smaller, slower and paler.
    float sc = 1.0 - 0.28 * float(l);
    float cs = uSize * 6.0;
    vec2 drift = vec2(uWind, -uFall) * iTime * (0.6 + 0.4 * sc) / max(sc, 0.3);
    vec2 pl = p / sc - drift + float(l) * 5.1;
    vec2 cell = floor(pl / cs);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec4 h = vec4(hash22(c + 0.31 * float(l)), hash22(c + 5.3 + float(l)));
        if (h.x > uDensity) continue;
        // Swaying side to side as it falls, round its place in the drifting air.
        float t = iTime * (0.8 + 0.4 * h.w) + h.y * 30.0;
        vec2 centre = (c + 0.5 + 0.35 * (h.zw - 0.5)) * cs + cs * uFlutter * vec2(0.22 * sin(t * 1.1), 0.08 * sin(t * 2.2 + 1.0));
        float r = uSize * (0.7 + 0.5 * h.z);
        vec2 rel = pl - centre;
        if (length(rel) > r * 1.3) continue;
        // Turning in the plane and flipping over: its width shrinks to an edge and back as it flips.
        float spin = h.y * TAU + uFlutter * (0.6 * sin(t * 0.7) + 0.4 * t * (h.z - 0.5));
        float flip = cos(t * (0.9 + uFlutter * h.w) + h.x * TAU);
        vec2 q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * rel / r;
        float face = 0.3 + 0.7 * abs(flip);
        q.x /= face;
        float inside = petal(q) * r * face / (px / sc);
        float soft = 1.0 + 1.5 * float(l);
        float cover = clamp(inside / soft + 0.5, 0.0, 1.0);
        if (cover <= 0.0) continue;
        // Deeper pink at the base, the back a little darker than the face.
        vec3 col = mix(uPetalBase, uPetal, smoothstep(-0.9, 0.1, q.y));
        col *= flip > 0.0 ? 1.0 : 0.9;
        col = mix(col, vec3(1.0), 0.18 * float(l));
        acc = over(acc, col, cover * (1.0 - 0.18 * float(l)));
      }
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
};

export const shoujoSparkles: ShaderEffect = {
  kind: "shader",
  id: "shoujo-sparkles",
  name: "Shoujo sparkles",
  description: "A shoujo manga backdrop: a soft pastel gradient filled with rising rimmed bubbles and long-rayed sparkles twinkling, the dreamy screen behind a romantic close-up.",
  category: "anime",
  tags: ["anime", "manga", "shoujo", "sparkle", "bubble", "romance", "dreamy", "background", "overlay"],
  presets: [
    { name: "Overlay", values: { uBackgroundAlpha: 0 } },
    { name: "Lavender", values: { uTop: [0.82, 0.78, 1], uBottom: [0.98, 0.88, 0.96], uSparkle: [1, 0.95, 0.75] } },
    { name: "Night", values: { uTop: [0.1, 0.08, 0.28], uBottom: [0.36, 0.18, 0.46], uBubble: [0.85, 0.75, 1] } },
  ],
  source: glsl(
    `// Shoujo sparkles: a pastel gradient, rising rimmed bubbles and long-rayed sparkles twinkling.
uniform vec3 uTop;              // @control color default=#FFD9EC label="Top"
uniform vec3 uBottom;           // @control color default=#E7DAFF label="Bottom"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
uniform vec3 uBubble;           // @control color default=#FFFFFF label="Bubbles"
uniform vec3 uSparkle;          // @control color default=#FFFFFF label="Sparkles"
uniform float uBubbles;         // @control min=0 max=1 default=0.5 label="Bubbles"
uniform float uSparkles;        // @control min=0 max=1 default=0.6 label="Sparkles"
uniform float uSpeed;           // @control min=0 max=2 default=0.6 label="Speed"`,
    HASH,
    OVER,
    `// A sparkle at d (in its own units): two long thin rays, two short diagonal ones and a hot core.
float sparkle(vec2 d) {
  vec2 a = abs(d);
  float rays = exp(-a.y * 60.0) * smoothstep(1.0, 0.0, a.x) + exp(-a.x * 60.0) * smoothstep(1.0, 0.0, a.y);
  vec2 e = abs(vec2(d.x + d.y, d.x - d.y)) * 0.7071;
  float diag = (exp(-e.y * 80.0) * smoothstep(0.4, 0.0, e.x) + exp(-e.x * 80.0) * smoothstep(0.4, 0.0, e.y)) * 0.6;
  return clamp(rays + diag + 0.02 / (dot(d, d) * 40.0 + 0.02), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = fragCoord / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec3 bg = mix(uBottom, uTop, uv.y);
  vec4 acc = vec4(bg * uBackgroundAlpha, uBackgroundAlpha);
  // Bubbles at two sizes, rising slowly with a sway: a faint fill, a bright rim and a glint.
  for (int l = 0; l < 2; l++) {
    float cs = l == 0 ? 0.32 : 0.18;
    vec2 q = p + vec2(0.0, -iTime * uSpeed * (l == 0 ? 0.05 : 0.08)) + float(l) * 3.7;
    vec2 cell = floor(q / cs);
    vec2 h = hash22(cell + 11.0 * float(l));
    if (h.x > uBubbles) continue;
    float r = cs * (0.18 + 0.2 * h.y);
    vec2 centre = (cell + 0.5) * cs + cs * vec2(0.25 * sin(iTime * uSpeed + h.y * 6.28), 0.15 * (h.x - 0.5));
    float d = length(q - centre);
    float fill = clamp((r - d) / px + 0.5, 0.0, 1.0);
    float rim = clamp(1.0 - abs(d - r + 1.5 * px) / (1.2 * px), 0.0, 1.0);
    vec2 g = q - centre - vec2(-0.45, 0.45) * r;
    float glint = clamp((0.18 * r - length(g * vec2(1.0, 1.8))) / px + 0.5, 0.0, 1.0);
    acc = over(acc, uBubble, fill * 0.16);
    acc = over(acc, uBubble, max(rim * 0.7, glint * 0.85));
  }
  // Sparkles twinkling open and shut, each on its own beat.
  for (int l = 0; l < 2; l++) {
    float cs = l == 0 ? 0.22 : 0.13;
    vec2 q = p + float(l) * 9.1;
    vec2 cell = floor(q / cs);
    vec4 h = vec4(hash22(cell + 23.0 * float(l)), hash22(cell + 41.0));
    if (h.x > uSparkles) continue;
    float tw = pow(max(0.0, sin(iTime * uSpeed * 2.5 + h.y * 6.28)), 3.0);
    float size = cs * (0.35 + 0.35 * h.z) * tw;
    if (size <= 0.0) continue;
    vec2 centre = (cell + 0.5 + 0.5 * (h.zw - 0.5)) * cs;
    float s = sparkle((q - centre) / size);
    acc = over(acc, uSparkle, s);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
};

export const gloomLines: ShaderEffect = {
  kind: "shader",
  id: "gloom-lines",
  name: "Gloom lines",
  description: "The manga gloom over a character's despair: wavering vertical lines hanging down from the top of the frame into a shadow that darkens towards it, swaying slowly.",
  category: "anime",
  tags: ["anime", "manga", "gloom", "despair", "sad", "reaction", "overlay", "line"],
  transparent: true,
  presets: [
    { name: "Purple funk", values: { uInk: [0.24, 0.1, 0.36], uShade: [0.42, 0.24, 0.6], uShadow: 0.7 } },
    { name: "Lines only", values: { uShadow: 0, uLength: 0.6, uThickness: 2.5 } },
    { name: "Ghost white", values: { uInk: [1, 1, 1], uShade: [0.7, 0.75, 0.9], uShadow: 0.35 } },
  ],
  source: glsl(
    `// Gloom lines: vertical wavering lines hanging from the top over a darkening shadow.
uniform vec3 uInk;          // @control color default=#1E1A2E label="Lines"
uniform vec3 uShade;        // @control color default=#3F3560 label="Shadow"
uniform float uShadow;      // @control min=0 max=1 default=0.55 label="Shadow strength"
uniform float uLines;       // @control min=10 max=120 default=46 step=1 label="Lines"
uniform float uLength;      // @control min=0.1 max=1 default=0.45 label="Line length"
uniform float uThickness;   // @control min=0.5 max=6 default=2 label="Thickness (px)"
uniform float uSway;        // @control min=0 max=1 default=0.4 label="Sway"`,
    HASH,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float depth = 1.0 - uv.y;
  vec4 acc = vec4(0.0);
  // The shadow, heaviest at the top and gone a little below the longest lines.
  float shade = uShadow * pow(smoothstep(uLength * 1.25, 0.0, depth), 1.5);
  acc = over(acc, uShade, shade);
  // Each line in its own column, missing in some, hanging its own length and wavering as it hangs.
  float colW = iResolution.x / uLines;
  float x = fragCoord.x / colW;
  for (int k = -1; k <= 1; k++) {
    float col = floor(x) + float(k);
    vec2 h = hash22(vec2(col, 4.2));
    float h3 = hash12(vec2(col, 8.7));
    if (h.x < 0.22) continue;
    float len = uLength * (0.35 + 0.75 * h.y) * (1.0 + 0.06 * sin(iTime * 0.9 + h3 * 6.28));
    if (depth > len) continue;
    float wave = uSway * 0.3 * sin(depth * 26.0 - iTime * 1.6 + h3 * 6.28) * smoothstep(0.0, 0.15, depth);
    float centre = col + 0.5 + 0.5 * (h3 - 0.5) + wave;
    float dist = abs(x - centre) * colW;
    // Thinning to a point at its end.
    float w = uThickness * (0.6 + 0.6 * h3) * (1.0 - depth / len);
    float cover = clamp(0.5 * w - dist + 0.5, 0.0, 1.0);
    acc = over(acc, uInk, cover);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
};

export const animeShaders: ShaderEffect[] = [mangaTone, animeSky, sakuraPetals, shoujoSparkles, gloomLines];
