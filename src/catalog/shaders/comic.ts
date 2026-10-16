import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Cartoon and comic shaders: a picture inked and printed as a comic panel,
 * toon-shaded, streaked with speed lines, framed by manga focus lines, or
 * turned into the next picture panel by panel. Inked looks share a Sobel
 * edge finder over brightness and alpha (so a cut-out's outline is inked too).
 */

/**
 * `inkEdge(tex, uv, d)`: Sobel edge strength of an image's brightness and
 * alpha, sampling `d` apart (in uv). Needs {@link PICTURE}.
 */
const INK_EDGE = `
vec2 lumaAlpha(sampler2D tex, vec2 uv) {
  vec4 c = pictureRGBA(tex, uv);
  return vec2(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), c.a);
}
float inkEdge(sampler2D tex, vec2 uv, vec2 d) {
  vec2 tl = lumaAlpha(tex, uv + vec2(-d.x, d.y));
  vec2 t = lumaAlpha(tex, uv + vec2(0.0, d.y));
  vec2 tr = lumaAlpha(tex, uv + d);
  vec2 l = lumaAlpha(tex, uv - vec2(d.x, 0.0));
  vec2 r = lumaAlpha(tex, uv + vec2(d.x, 0.0));
  vec2 bl = lumaAlpha(tex, uv - d);
  vec2 b = lumaAlpha(tex, uv - vec2(0.0, d.y));
  vec2 br = lumaAlpha(tex, uv + vec2(d.x, -d.y));
  vec2 gx = tr + 2.0 * r + br - tl - 2.0 * l - bl;
  vec2 gy = tl + 2.0 * t + tr - bl - 2.0 * b - br;
  return max(length(vec2(gx.x, gy.x)), length(vec2(gx.y, gy.y)));
}`.trim();

export const comicBook: ShaderEffect = {
  kind: "shader",
  id: "comic-book",
  name: "Comic book",
  description: "Any picture printed as a comic panel: thick inked outlines, flat posterised colour, Ben-Day dots of cyan, magenta and yellow in the mid-tones, slightly off-register on yellowed paper.",
  category: "comic",
  video: "filter",
  tags: ["comic", "cartoon", "image", "ink", "ben-day", "print", "pop-art"],
  presets: [
    { name: "Pop art", values: { uLevels: 3, uSaturation: 1.8, uDotSize: 9, uPaper: [1, 0.98, 0.94], uMisregister: 0 } },
    { name: "Old pulp", values: { uPaper: [0.9, 0.8, 0.6], uMisregister: 2.5, uSaturation: 0.8, uDots: 1 } },
    { name: "Bold ink", values: { uLine: 2.6, uThreshold: 0.18, uDots: 0.5 } },
  ],
  source: glsl(
    `// Comic book: inked Sobel outlines over flat colour printed as CMY Ben-Day dots on old paper.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uLine;        // @control min=0.5 max=4 default=1.6 label="Line weight (px)"
uniform float uThreshold;   // @control min=0.05 max=1 default=0.28 label="Ink threshold"
uniform vec3 uInk;          // @control color default=#141210 label="Ink"
uniform int uLevels;        // @control min=2 max=8 default=4 label="Colour levels"
uniform float uSaturation;  // @control min=0 max=2 default=1.35 label="Saturation"
uniform float uDotSize;     // @control min=3 max=16 default=6 label="Dot size (px)"
uniform float uDots;        // @control min=0 max=1 default=0.85 label="Ben-Day dots"
uniform float uMisregister; // @control min=0 max=5 default=1.2 label="Misregistration (px)"
uniform vec3 uPaper;        // @control color default=#F3E7C6 label="Paper"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    INK_EDGE,
    `// The picture at uv as flat ink: saturated and posterised, as cyan, magenta and yellow amounts.
vec3 flatInk(vec2 uv) {
  vec3 c = picture(uImage, uv);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, uSaturation), 0.0, 1.0);
  float n = float(uLevels) - 1.0;
  c = floor(c * n + 0.5) / n;
  return 1.0 - c;
}

// Coverage of a dot screen at angle a (radians) for an ink amount: dots grow with it and merge when full.
float screenDots(vec2 p, float a, float amount) {
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 q = r * p / uDotSize;
  float d = length(fract(q) - 0.5);
  float radius = sqrt(clamp(amount, 0.0, 1.0)) * 0.72;
  float aa = 0.7 / uDotSize;
  return smoothstep(radius + aa, radius - aa, d);
}

// Flat ink where it is solid or bare, dots in between.
float printed(vec2 p, float a, float amount) {
  float mid = smoothstep(0.04, 0.2, amount) * smoothstep(0.98, 0.8, amount);
  return mix(amount, screenDots(p, a, amount), uDots * mid);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  // Each plate is printed a little off the others.
  vec2 m = uMisregister * px;
  float cyan = flatInk(uv + vec2(m.x, 0.3 * m.y)).r;
  float magenta = flatInk(uv - vec2(0.6 * m.x, m.y)).g;
  float yellow = flatInk(uv + vec2(-0.4 * m.x, 0.8 * m.y)).b;
  vec3 ink = vec3(
    printed(fragCoord, radians(15.0), cyan),
    printed(fragCoord, radians(75.0), magenta),
    printed(fragCoord, radians(0.0), yellow)
  );
  // Paper with a little fibre and age, then the inks multiplied over it.
  float fibre = vnoise(fragCoord * 0.35) * 0.06 + vnoise(fragCoord * 0.02) * 0.04;
  vec3 paper = uPaper * (0.96 + fibre);
  vec3 col = paper * (1.0 - ink * 0.92);
  // Thick black outlines: a hard threshold on Sobel edges, sampled a line weight apart.
  float edge = inkEdge(uImage, uv, uLine * px);
  float line = smoothstep(uThreshold, uThreshold + 0.08, edge);
  line *= 0.85 + 0.15 * vnoise(fragCoord * 0.2);
  col = mix(col, uInk, clamp(line * 1.2, 0.0, 1.0));
  fragColor = vec4(col, max(pic.a, clamp(line, 0.0, 1.0)));
}`,
  ),
};

export const celShade: ShaderEffect = {
  kind: "shader",
  id: "cel-shade",
  name: "Cel shade",
  description: "A picture toon-shaded: its brightness stepped into a few crisp bands that keep its colours, with bright highlights and dark inked outlines.",
  category: "comic",
  video: "filter",
  tags: ["cartoon", "comic", "toon", "cel", "image", "anime", "outline"],
  presets: [
    { name: "Two-tone", values: { uBands: 2, uShadow: 0.45, uSaturation: 1.5 } },
    { name: "Anime", values: { uBands: 3, uSaturation: 1.25, uHighlight: 0.7, uLine: 1.2, uOutline: [0.18, 0.1, 0.16] } },
    { name: "Soft", values: { uBands: 6, uLine: 0.8, uThreshold: 0.45 } },
  ],
  source: glsl(
    `// Cel shade: brightness quantised into crisp bands, colour kept, outlines inked.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uBands;       // @control min=2 max=8 default=4 step=1 label="Bands"
uniform float uShadow;      // @control min=0 max=0.8 default=0.25 label="Darkest band"
uniform float uSaturation;  // @control min=0 max=2 default=1.3 label="Saturation"
uniform float uHighlight;   // @control min=0 max=1 default=0.45 label="Highlights"
uniform vec3 uOutline;      // @control color default=#111018 label="Outline"
uniform float uLine;        // @control min=0 max=4 default=1.5 label="Outline weight (px)"
uniform float uThreshold;   // @control min=0.05 max=1 default=0.3 label="Outline threshold"
${BACKDROP_CONTROLS}`,
    PICTURE,
    INK_EDGE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  // A little blur first, so the bands follow forms rather than texture.
  vec3 c = (pic.rgb * 4.0 + picture(uImage, uv + vec2(px.x * 1.5, 0.0)) + picture(uImage, uv - vec2(px.x * 1.5, 0.0)) +
            picture(uImage, uv + vec2(0.0, px.y * 1.5)) + picture(uImage, uv - vec2(0.0, px.y * 1.5))) / 8.0;
  float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  // Crisp steps, antialiased by how fast brightness changes across the pixel.
  float x = l * uBands;
  float k = floor(x);
  float w = max(fwidth(x), 1e-3) * 0.75;
  float stepped = (k + smoothstep(1.0 - w, 1.0, fract(x))) / uBands;
  float shade = mix(uShadow, 1.0, clamp(stepped + 0.5 / uBands, 0.0, 1.0));
  vec3 hue = c / l;
  hue = max(mix(vec3(1.0), hue, uSaturation), 0.0);
  vec3 col = clamp(hue * shade * 0.9, 0.0, 1.0);
  // A highlight band on the brightest parts.
  float fw = max(fwidth(l), 1e-3);
  float hi = smoothstep(0.8 - fw, 0.8 + fw, l) * uHighlight;
  col = mix(col, vec3(1.0), hi * 0.6);
  float edge = uLine > 0.0 ? inkEdge(uImage, uv, uLine * px) : 0.0;
  float line = smoothstep(uThreshold, uThreshold + 0.06, edge);
  col = mix(col, uOutline, line);
  fragColor = vec4(col, max(pic.a, line));
}`,
  ),
};

export const focusLines: ShaderEffect = {
  kind: "shader",
  id: "focus-lines",
  name: "Focus lines",
  description: "Manga focus lines: tapering radial speed lines converging on the centre, or the pointer, around a clear middle, flickering and shifting a few times a second.",
  category: "comic",
  tags: ["comic", "manga", "anime", "speed-lines", "focus", "interactive", "overlay"],
  transparent: true,
  presets: [
    { name: "Black on white", values: { uInk: [0, 0, 0], uPaper: [1, 1, 1], uPaperAlpha: 1 } },
    { name: "White on black", values: { uInk: [1, 1, 1], uPaper: [0, 0, 0], uPaperAlpha: 1 } },
    { name: "Overlay", values: { uInk: [0, 0, 0], uPaperAlpha: 0, uClear: 0.5 } },
  ],
  source: glsl(
    `// Focus lines: radial wedges converging on a point, with a clear area round it.
uniform float uLines;       // @control min=30 max=300 default=150 step=1 label="Lines"
uniform float uClear;       // @control min=0.05 max=0.9 default=0.42 label="Clear area"
uniform float uThickness;   // @control min=0.05 max=1 default=0.55 label="Thickness"
uniform float uRate;        // @control min=0 max=30 default=12 label="Flickers per second"
uniform bool uFollow;       // @control default=true label="Converge on the pointer"
uniform vec3 uInk;          // @control color default=#000000 label="Lines"
uniform vec3 uPaper;        // @control color default=#FFFFFF label="Background"
uniform float uPaperAlpha;  // @control min=0 max=1 default=1 label="Background opacity"`,
    HASH,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 middle = 0.5 * iResolution.xy;
  float hover = uFollow ? clamp(iPointer.z, 0.0, 1.0) : 0.0;
  vec2 centre = mix(middle, iPointer.xy, hover);
  vec2 d = fragCoord - centre;
  float rpx = length(d);
  // The clear area is an ellipse the frame's shape.
  float r = length(d / (0.5 * iResolution.xy));
  float frame = floor(iTime * uRate);
  float a = atan(d.y, d.x) / 6.28318 + 0.5;
  float s = a * uLines + hash12(vec2(frame, 7.0)) * 0.6;
  float cell = mod(floor(s), uLines);
  vec2 h = hash22(vec2(cell, frame * 1.37 + 3.0));
  float h3 = hash12(vec2(cell * 1.7 + 2.0, frame));
  // Some lines are missing, each starts its own way from the clear area, and widens outwards.
  float present = step(0.18, h.x);
  float start = uClear * (0.85 + 0.45 * h.y);
  float grow = smoothstep(start, start + 0.35 + 0.4 * h3, r);
  float halfWidth = 0.5 * uThickness * (0.35 + 0.65 * h3) * grow;
  float across = (abs(fract(s) - 0.5) - halfWidth) * rpx * 6.28318 / uLines;
  float cover = present * step(start, r) * clamp(0.5 - across, 0.0, 1.0);
  vec4 acc = vec4(uPaper * uPaperAlpha, uPaperAlpha);
  acc = vec4(acc.rgb * (1.0 - cover) + uInk * cover, acc.a * (1.0 - cover) + cover);
  fragColor = vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`,
  ),
};

export const actionLines: ShaderEffect = {
  kind: "shader",
  id: "action-lines",
  name: "Action lines",
  description: "Comic speed lines streaking across a picture at any angle, with the picture smeared along them, so it reads as rushing past.",
  category: "comic",
  video: "filter",
  tags: ["comic", "cartoon", "speed-lines", "motion", "image", "manga"],
  presets: [
    { name: "Ink streaks", values: { uLineColor: [0.05, 0.05, 0.06], uLineAlpha: 0.9, uCover: 0.4 } },
    { name: "Diagonal dash", values: { uAngle: 30, uSpeed: 2.5, uSmear: 0.05, uCover: 0.65 } },
    { name: "Vertical drop", values: { uAngle: 270, uDensity: 90, uLength: 0.6 } },
  ],
  source: glsl(
    `// Action lines: speed lines streaking along an angle, the picture smeared the same way.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform float uAngle;       // @control min=0 max=360 default=180 label="Direction (°)"
uniform float uDensity;     // @control min=20 max=200 default=60 step=1 label="Line rows"
uniform float uCover;       // @control min=0 max=1 default=0.5 label="Lines"
uniform float uLength;      // @control min=0.05 max=1 default=0.4 label="Line length"
uniform float uSpeed;       // @control min=0 max=5 default=1.6 label="Speed"
uniform float uSmear;       // @control min=0 max=0.12 default=0.035 label="Smear"
uniform vec3 uLineColor;    // @control color default=#FFFFFF label="Line colour"
uniform float uLineAlpha;   // @control min=0 max=1 default=0.85 label="Line opacity"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float ang = radians(uAngle);
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-dir.y, dir.x);
  // Smear: the picture averaged behind each point along the motion, heavier near it.
  vec2 back = -dir * uSmear * vec2(iResolution.y / iResolution.x, 1.0);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb * 0.25;
  float total = 0.25;
  for (int i = 1; i < 8; i++) {
    float k = float(i) / 7.0;
    float w = 1.0 - 0.6 * k;
    col += picture(uImage, uv + back * k) * w;
    total += w;
  }
  col /= total;
  // Streaks in rows across the motion, each its own speed, length and thickness.
  vec2 p = fragCoord - 0.5 * iResolution.xy;
  float rowH = iResolution.y / uDensity;
  float acrossPx = dot(p, perp);
  float row = floor(acrossPx / rowH);
  vec2 h = hash22(vec2(row, 3.7));
  float h3 = hash12(vec2(row, 9.1));
  float present = step(1.0 - uCover, h.x);
  float thick = rowH * (0.08 + 0.3 * h3);
  float dist = abs(acrossPx - (row + 0.5 + 0.3 * (h.y - 0.5)) * rowH);
  float lineMask = clamp(thick * 0.5 - dist + 0.5, 0.0, 1.0);
  float along = dot(p, dir) / iResolution.x;
  float span = uLength * (0.6 + 0.8 * h.y) + 0.3;
  float t = fract((along - iTime * uSpeed * (0.6 + 0.8 * h3)) / span + h.x * 7.0);
  float seg = uLength * (0.6 + 0.8 * h.y) / span;
  // A bright head fading to a thin tail.
  float streak = smoothstep(seg, seg * 0.85, t) * smoothstep(0.0, seg * 0.9, t);
  float m = present * lineMask * streak * uLineAlpha;
  col = mix(col, uLineColor, m);
  fragColor = vec4(col, max(pic.a, m));
}`,
  ),
};

export const transitionComicPanels: ShaderEffect = {
  kind: "shader",
  id: "transition-comic-panels",
  name: "Comic panels",
  description: "The next picture arrives panel by panel: the frame splits into comic panels with white gutters and black borders, each panel wipes, slides or pops to the new picture in turn, then the gutters close.",
  category: "transition",
  video: "transition",
  tags: ["transition", "comic", "cartoon", "panels", "image", "slideshow"],
  loop: 4,
  presets: [
    { name: "Manga", values: { uGutterColor: [0.98, 0.98, 0.98], uInk: [0, 0, 0], uGutter: 0.03, uBorder: 4 } },
    { name: "Night page", values: { uGutterColor: [0.08, 0.08, 0.1], uInk: [0.95, 0.85, 0.3] } },
  ],
  source: glsl(
    `// Comic panels transition. Progress runs 0 → 1 → 0 when animated.
uniform sampler2D uFrom;    // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;      // @control default=true label="Animate"
uniform float uProgress;    // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uGutter;      // @control min=0.005 max=0.06 default=0.022 label="Gutter width"
uniform float uBorder;      // @control min=0 max=8 default=3 label="Border (px)"
uniform vec3 uGutterColor;  // @control color default=#FFFFFF label="Gutters"
uniform vec3 uInk;          // @control color default=#111111 label="Borders"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// Signed distance in pixels from the line through a and b (uv), positive on its left.
float side(vec2 uv, vec2 a, vec2 b) {
  vec2 p = uv * iResolution.xy;
  vec2 pa = a * iResolution.xy;
  vec2 ab = normalize((b - a) * iResolution.xy);
  vec2 q = p - pa;
  return ab.x * q.y - ab.y * q.x;
}

// Ease out with an overshoot.
float backOut(float t) {
  float s = 2.2;
  t -= 1.0;
  return 1.0 + t * t * ((s + 1.0) * t + s);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float p = uAnimate ? smoothstep(0.08, 0.92, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  // The page: a slanted tier line, one cut above it and two below; distances in pixels.
  float tier = side(uv, vec2(0.0, 0.5), vec2(1.0, 0.55));
  float cutTop = side(uv, vec2(0.6, 1.0), vec2(0.55, 0.5));
  float cutA = side(uv, vec2(0.36, 0.0), vec2(0.31, 0.55));
  float cutB = side(uv, vec2(0.7, 0.0), vec2(0.74, 0.55));
  int panel;
  vec2 lo;
  vec2 size;
  float edge;
  if (tier > 0.0) {
    edge = min(tier, abs(cutTop));
    if (cutTop < 0.0) { panel = 0; lo = vec2(0.0, 0.5); size = vec2(0.6, 0.5); }
    else { panel = 1; lo = vec2(0.55, 0.5); size = vec2(0.45, 0.5); }
  } else {
    edge = -tier;
    if (cutA > 0.0) { panel = 2; lo = vec2(0.0); size = vec2(0.36, 0.55); edge = min(edge, cutA); }
    else if (cutB > 0.0) { panel = 3; lo = vec2(0.31, 0.0); size = vec2(0.43, 0.55); edge = min(edge, min(-cutA, cutB)); }
    else { panel = 4; lo = vec2(0.7, 0.0); size = vec2(0.3, 0.55); edge = min(edge, -cutB); }
  }
  vec2 framePx = min(fragCoord, iResolution.xy - fragCoord);
  edge = min(edge, min(framePx.x, framePx.y));
  // Gutters open at the start and close at the end.
  float open = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.86, 1.0, p));
  float gutter = 0.5 * uGutter * iResolution.y * open;
  float border = uBorder * open;
  // Each panel turns over in its own way, one after another.
  float t = clamp((p - 0.12 - float(panel) * 0.12) / 0.26, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);
  vec2 local = (uv - lo) / size;
  vec2 st = uv;
  float showTo = 0.0;
  float rim = 1e3;
  if (panel == 0) {
    // Wipe left to right.
    showTo = step(local.x, e * 1.05);
    rim = abs(local.x - e * 1.05) * size.x * iResolution.x;
  } else if (panel == 1) {
    // Slide down from the top.
    showTo = step(1.0 - e, local.y);
    st.y -= (1.0 - e) * size.y;
    rim = abs(local.y - (1.0 - e)) * size.y * iResolution.y;
  } else if (panel == 2) {
    // Pop out of the middle with an overshoot.
    float s = max(backOut(t), 1e-3);
    vec2 c = lo + 0.5 * size;
    vec2 q = (uv - c) / s;
    vec2 qa = abs(q) / size;
    showTo = step(max(qa.x, qa.y), 0.5) * step(1e-3, t);
    st = c + q;
    rim = (0.5 - max(qa.x, qa.y)) * min(size.x * iResolution.x, size.y * iResolution.y) * s;
  } else if (panel == 3) {
    // An iris from the bottom corner.
    vec2 q = local * size * iResolution.xy / iResolution.y;
    float radius = e;
    showTo = step(length(q), radius);
    rim = abs(length(q) - radius) * iResolution.y;
  } else {
    // Slide in from the right.
    showTo = step(1.0 - e, local.x);
    st.x -= (1.0 - e) * size.x;
    rim = abs(local.x - (1.0 - e)) * size.x * iResolution.x;
  }
  showTo = t >= 1.0 ? 1.0 : (t <= 0.0 ? 0.0 : showTo);
  vec4 col = mix(pictureRGBA(uFrom, uv), pictureRGBA(uTo, st), showTo);
  // A thin ink line on the moving edge while it moves.
  float moving = step(0.001, t) * step(t, 0.999);
  col = mix(col, vec4(uInk, 1.0), moving * clamp(2.0 - rim, 0.0, 1.0));
  vec4 frame = mix(vec4(uGutterColor, 1.0), vec4(uInk, 1.0), clamp(edge - gutter + 0.5, 0.0, 1.0));
  // Closed, there is no frame at all: the picture is whole.
  float inside = mix(1.0, clamp(edge - gutter - border + 0.5, 0.0, 1.0), smoothstep(0.0, 0.2, open));
  fragColor = mix(frame, col, inside);
}`,
  ),
};

/** Cartoon and comic: inked looks, cel shading, speed lines and panels. */
export const comicShaders: ShaderEffect[] = [comicBook, celShade, focusLines, actionLines, transitionComicPanels];
