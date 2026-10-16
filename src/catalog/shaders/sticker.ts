import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Stickers in shaders. The foil sticker reads the pointer built-ins the
 * wrapper declares (`iPointer`: xy pixels, z how hovered 0–1), drifting on
 * its own while nothing hovers it, which `uDemo` turns off.
 */

/**
 * `hoverPoint(demo, idle)`: the point to tilt towards, in pixels, and how
 * strongly (z): the pointer while it is over the canvas, else (with the demo
 * on) a slow drift at strength `idle`.
 */
const HOVER = `
vec3 hoverPoint(bool demo, float idle) {
  vec2 drift = iResolution.xy * (0.5 + vec2(0.3 * sin(iTime * 0.63), 0.24 * sin(iTime * 0.91 + 1.3)));
  float h = clamp(iPointer.z, 0.0, 1.0);
  return vec3(mix(drift, iPointer.xy, h), mix(demo ? idle : 0.0, 1.0, h));
}`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

export const holoFoilSticker: ShaderEffect = {
  kind: "shader",
  id: "holo-foil-sticker",
  name: "Holo foil sticker",
  description: "A die-cut sticker cut from any shape's outline, with a thick white border, a drop shadow and holographic foil whose rainbow and sparkles shift as the pointer tilts it.",
  category: "sticker",
  video: "none",
  tags: ["sticker", "holographic", "foil", "die-cut", "interactive", "hover", "rainbow", "sparkle", "iridescent"],
  transparent: true,
  source: glsl(
    `// Holo foil sticker: the mask's shape, grown into a white die-cut border, with a soft shadow and rainbow foil that tilts with the pointer.
uniform sampler2D uMask;         // @control wrap=clamp default=${textImage("WOW")} label="Shape (alpha)"
uniform vec3 uTint;              // @control color default=#DADDEA label="Face tint"
uniform vec3 uBorderColor;       // @control color default=#FFFFFF label="Border"
uniform float uBorder;           // @control min=0 max=0.08 default=0.035 label="Border width"
uniform float uSize;             // @control min=0.3 max=1 default=0.8 label="Size"
uniform float uFoil;             // @control min=0 max=1 default=0.85 label="Foil"
uniform float uSparkle;          // @control min=0 max=1 default=0.7 label="Sparkle"
uniform float uShadow;           // @control min=0 max=1 default=0.45 label="Shadow"
uniform float uTilt;             // @control min=0 max=1 default=0.6 label="Tilt"
uniform bool uDemo;              // @control default=true label="Demo when idle"
uniform vec3 uBackground;        // @control color default=#EEF0F6 label="Background"
uniform float uBackgroundAlpha;  // @control min=0 max=1 default=0 label="Background opacity"`,
    HASH,
    NOISE,
    HOVER,
    OVER,
    `// The mask's alpha at uv, nothing outside the picture (so an opaque edge does not smear).
float maskAt(vec2 uv, float lod) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return textureLod(uMask, uv, lod).a * inside.x * inside.y;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float px = min(res.x, res.y);
  vec2 ts = vec2(textureSize(uMask, 0));
  float ia = ts.x / max(ts.y, 1.0);
  // The picture's box, fitted to the frame with room round it for the border and shadow.
  float w = min(res.x * uSize, res.y * uSize * ia);
  vec2 hs = vec2(w, w / ia) * 0.5;
  vec3 hp = hoverPoint(uDemo, 0.7);
  vec2 tilt = clamp((hp.xy - 0.5 * res) / (0.5 * res), -1.0, 1.0) * hp.z * uTilt;
  // Fake perspective: the side the pointer is on leans away.
  vec2 s = (fragCoord - 0.5 * res) / hs;
  vec2 sn = (fragCoord - 0.5 * res) / max(hs.x, hs.y);
  vec2 q = s / max(1.0 - 0.12 * dot(sn, tilt), 0.2);
  vec2 uv = q * 0.5 + 0.5;
  vec2 toUv = 1.0 / (2.0 * hs);
  vec2 rb = uBorder * px * toUv;

  // Die cut: the shape grown by the border width (its furthest reach in 24 directions, at three radii,
  // the outer ones read blurrier so the cut comes out round rather than scalloped).
  float a0 = maskAt(uv, 0.0);
  float reach = a0;
  for (int i = 0; i < 24; i++) {
    float ang = float(i) * 0.261799;
    vec2 d = vec2(cos(ang), sin(ang)) * rb;
    reach = max(reach, maskAt(uv + d * 0.85, 2.0));
    reach = max(reach, maskAt(uv + d * 0.55, 1.0));
    reach = max(reach, maskAt(uv + d * 0.28, 0.5));
  }
  float cut = smoothstep(0.2, 0.5, reach);
  float face = smoothstep(0.35, 0.65, a0);

  // Shadow: the grown shape blurred (a coarse mip level), dropped and pushed away from the pointer.
  vec2 drop = (vec2(0.0, 0.03) + tilt * 0.025) * px * toUv;
  float sh = 0.0;
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.785398 + 0.39;
    sh += maskAt(uv + drop + vec2(cos(ang), sin(ang)) * rb * 1.3, 3.5);
  }
  sh = smoothstep(0.0, 0.45, sh / 8.0) * uShadow;

  vec2 fuv = uv * vec2(ia, 1.0);
  // The face: the picture's own colour (unpremultiplied) under the tint.
  vec4 tex = textureLod(uMask, clamp(uv, 0.0, 1.0), 0.0);
  vec3 base = tex.rgb / max(tex.a, 1e-3) * uTint;
  // Foil: rainbow bands that slide with the tilt, plus a fine diffraction grating whose colours run faster.
  float nz = vnoise(fuv * 5.0);
  float phase = dot(fuv, vec2(0.45, 0.8)) * 0.9 + tilt.x * 1.1 - tilt.y * 0.8 + nz * 0.35 + iTime * 0.04;
  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
  float grating = 0.5 + 0.5 * sin((fuv.x * 0.6 + fuv.y) * 240.0 + tilt.x * 18.0);
  vec3 diffraction = 0.5 + 0.5 * cos(6.28318 * (phase * 2.4 + grating * 0.18 + vec3(0.0, 0.33, 0.67)));
  vec3 holo = mix(rainbow, diffraction, 0.35);
  float band = exp(-pow(dot(sn, normalize(vec2(1.0, 1.4))) * 1.4 - (tilt.x + tilt.y) * 0.9, 2.0) * 2.5);
  float foil = uFoil * (0.4 + 0.6 * band);
  // Overlay blend keeps the face's darks; light faces (white text) take the foil's colour as metal would.
  vec3 lit = mix(2.0 * base * holo, 1.0 - 2.0 * (1.0 - base) * (1.0 - holo), step(0.5, base));
  vec3 metal = base * pow(holo, vec3(1.4)) * (0.85 + 0.3 * grating) * 1.1;
  vec3 col = mix(base, mix(lit, metal, 0.65), foil);
  // A fine dark line where the print meets the border.
  col *= 1.0 - 0.4 * smoothstep(0.25, 0.5, a0) * (1.0 - smoothstep(0.5, 0.85, a0));
  // Sparkles: glints in a grid, each catching the light at its own tilt.
  vec2 cell = floor(fuv * 26.0);
  vec2 inCell = fract(fuv * 26.0) - 0.5 - (hash22(cell) - 0.5) * 0.5;
  float h = hash12(cell + 7.1);
  float catchLight = pow(0.5 + 0.5 * sin(h * 60.0 + iTime * 2.2 + dot(tilt, vec2(9.0, 7.0))), 14.0);
  float glint = exp(-abs(inCell.x) * 38.0) * exp(-abs(inCell.y) * 7.0) + exp(-abs(inCell.y) * 38.0) * exp(-abs(inCell.x) * 7.0);
  col += step(0.82, h) * catchLight * glint * uSparkle * 1.6;

  // The border: white vinyl with a faint sheen of the foil, and a slightly darker cut edge.
  vec3 border = uBorderColor * (0.94 + 0.06 * holo);
  float edge = 1.0 - smoothstep(0.22, 0.6, reach);
  border *= 1.0 - 0.12 * edge;
  vec3 sticker = mix(border, col, face);
  // Gloss: a glare that follows the pointer, and a soft sheen from the top.
  vec2 g = sn - tilt * 0.7;
  sticker += 0.35 * exp(-dot(g, g) * 2.5) + 0.06 * smoothstep(-0.2, 1.0, sn.y);

  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  acc = over(acc, vec3(0.0), sh * (1.0 - cut));
  acc = over(acc, clamp(sticker, 0.0, 1.0), cut);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uTint: [1, 1, 1], uFoil: 0.6 } },
    { name: "Logo on card", values: { uMask: SAMPLE_IMAGES.logo, uBackgroundAlpha: 1, uBackground: [0.12, 0.13, 0.18], uSize: 0.7 } },
    { name: "Thick cut", values: { uBorder: 0.06, uFoil: 1, uSparkle: 1 } },
  ],
};

export const stickerPeelReveal: ShaderEffect = {
  kind: "shader",
  id: "sticker-peel-reveal",
  name: "Sticker peel reveal",
  description: "A picture peels back like a sticker from its bottom-right corner, rolling diagonally over itself with a curl highlight and shadow, to reveal a second picture underneath. Loops back and forth; or turn Animate off and set Progress.",
  category: "sticker",
  video: "transition",
  tags: ["sticker", "transition", "peel", "curl", "page", "image", "reveal"],
  loop: 4,
  source: glsl(
    `// Sticker peel: the From picture peels from a corner along the diagonal, its paper backing curled over it, revealing the To picture. Progress runs 0 → 1 → 0 when animated.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Sticker image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Underneath"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.4 label="Progress (when still)"
uniform float uCurl;       // @control min=0.03 max=0.4 default=0.14 label="Curl radius"
uniform vec3 uBack;        // @control color default=#F4F1EA label="Backing"
uniform float uShowThrough; // @control min=0 max=0.5 default=0.1 label="Print showing through"
uniform float uShadow;     // @control min=0 max=1 default=0.6 label="Shadow"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `// How far inside the peeled flap a point is (negative outside it), in height units, and its distance s past the fold.
// The flap is the part from the corner to the fold, turned back over the picture: round a curl of radius r near the fold, then flat.
float flapMargin(vec2 pos, vec2 corner, vec2 dir, float aspect, float fold, float r, out float s, out vec2 orig) {
  float t = dot(pos - corner, dir);
  s = t - fold;
  float l = s < r ? r * asin(clamp(s / r, 0.0, 1.0)) : r * 1.5708 + (s - r);
  orig = pos + dir * ((fold - l) - t);
  float m = min(min(orig.x, aspect - orig.x), min(orig.y, 1.0 - orig.y));
  return min(m, s);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 res = iResolution.xy;
  float aspect = res.x / res.y;
  float p = uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
  vec2 pos = fragCoord / res.y;
  vec2 corner = vec2(aspect, 0.0);
  vec2 dir = normalize(vec2(-aspect, 1.0));
  float r = uCurl;
  // The fold travels from the corner past the far one, far enough for the curl to leave too.
  float fold = p * (length(vec2(aspect, 1.0)) + r * 2.2);
  float s;
  vec2 orig;
  float m = flapMargin(pos, corner, dir, aspect, fold, r, s, orig);
  vec2 uv = fragCoord / res;
  vec4 col = s > 0.0 ? pictureRGBA(uFrom, uv) : pictureRGBA(uTo, uv);
  // The lifted flap's shadow: soft, thrown down and right, and over the revealed picture by the curl.
  float soft = 0.012 + 0.12 * r;
  float s2;
  vec2 o2;
  float m2 = flapMargin(pos - vec2(0.5, -0.8) * soft, corner, dir, aspect, fold, r, s2, o2);
  float shadow = smoothstep(-soft, soft, m2) * uShadow * 0.6 * smoothstep(0.0, 0.03, p);
  float crease = s < 0.0 ? exp(s / (0.35 * r + 0.01)) * uShadow * 0.45 * smoothstep(0.0, 0.03, p) : 0.0;
  col.rgb *= 1.0 - max(shadow, crease);
  // The flap: the paper backing, lit round the curl, with the print faintly showing through mirrored.
  float flap = smoothstep(-1.0 / res.y, 1.0 / res.y, m);
  if (flap > 0.0) {
    vec3 back = mix(uBack, pictureRGBA(uFrom, orig / vec2(aspect, 1.0)).rgb, uShowThrough);
    float x = clamp(s / r, 0.0, 3.0);
    float light = 0.68 + 0.42 * smoothstep(0.0, 0.6, x) - 0.1 * smoothstep(0.6, 1.8, x);
    light += 0.22 * exp(-pow((x - 0.55) / 0.14, 2.0));
    col = mix(col, vec4(clamp(back * light, 0.0, 1.0), 1.0), flap);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Tight curl", values: { uCurl: 0.06, uShadow: 0.8 } },
    { name: "Kraft backing", values: { uBack: [0.82, 0.7, 0.52], uShowThrough: 0, uCurl: 0.2 } },
  ],
};

/** Stickers in shaders: holographic foil and peeling. */
export const stickerShaders: ShaderEffect[] = [holoFoilSticker, stickerPeelReveal];
