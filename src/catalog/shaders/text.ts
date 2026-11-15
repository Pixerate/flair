import { FBM, glsl, HASH, NOISE, PALETTE } from "../glsl.js";
import { textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { TEXT_BEVEL } from "./glass.js";

export const shaderText: ShaderEffect = {
  kind: "shader",
  id: "shader-text",
  name: "Shader text",
  description: "A title filled with a living texture (plasma, fire, caustics or liquid chrome), with a soft glow and outline.",
  category: "text",
  video: "none",
  tags: ["text", "title", "plasma", "fire", "chrome", "glow"],
  source: glsl(
    `// Shader text: the letters of a text image filled with an animated pattern.
uniform sampler2D uText;     // @control filter=linear wrap=clamp default=${textImage("FLAIR")} label="Text"
uniform int uFill;           // @control min=0 max=3 default=0 label="Fill (0 plasma, 1 fire, 2 caustics, 3 chrome)"
uniform vec3 uBackground;    // @control color default=#0A0A12 label="Background"
uniform vec3 uTint;          // @control color default=#FFFFFF label="Tint"
uniform float uSize;         // @control min=0.3 max=1 default=0.9 label="Text size"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform float uGlow;         // @control min=0 max=2 default=0.6 label="Glow"
uniform float uOutline;      // @control min=0 max=0.02 default=0.004 label="Outline width"
uniform vec3 uOutlineColor;  // @control color default=#FFFFFF label="Outline"`,
    HASH,
    NOISE,
    FBM,
    PALETTE,
    `// The text image's alpha at frame point p (height 1, centred), the image contained in uSize of the frame.
float letters(vec2 p) {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float frame = iResolution.x / iResolution.y;
  float h = min(uSize, frame * uSize / aspect);
  vec2 uv = p / vec2(h * aspect, h) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

vec3 plasmaFill(vec2 p, float t) {
  float v = sin(p.x * 6.0 + t) + sin(p.y * 7.0 - t * 1.3) + sin((p.x + p.y) * 5.0 + t * 0.7) + sin(length(p * 8.0) - t * 2.0);
  return palette(v * 0.125 + 0.5 + t * 0.05, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}

vec3 fireFill(vec2 p, float t) {
  float n = fbm(vec2(p.x * 5.0, p.y * 3.0 - t * 1.8), 5);
  float heat = clamp(1.1 - (p.y + 0.3) * 1.6 + (n - 0.5) * 1.2, 0.0, 1.0);
  return vec3(1.0, 0.35, 0.05) * heat * 1.4 + vec3(1.0, 0.85, 0.3) * pow(heat, 3.0) + vec3(0.25, 0.0, 0.0);
}

vec3 causticsFill(vec2 p, float t) {
  vec2 q = p * 6.0;
  vec2 i = q;
  float c = 1.0;
  for (int n = 0; n < 5; n++) {
    float tn = t * 0.5 * (1.0 - 3.5 / float(n + 1));
    i = q + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tn) / 0.005), q.y / (cos(i.y + tn) / 0.005)));
  }
  c = 1.17 - pow(c / 5.0, 1.4);
  float light = pow(abs(c), 8.0);
  return clamp(vec3(0.0, 0.3, 0.5) + light * vec3(0.7, 1.0, 1.0), 0.0, 1.0);
}

// Liquid chrome: a horizon reflection bent by the letters' bevel and a slow warp.
vec3 chromeFill(vec2 p, float t, vec2 normal) {
  float warp = fbm(p * 3.0 + vec2(t * 0.3, -t * 0.2), 4) - 0.5;
  float y = p.y * 2.5 + normal.y * 1.5 + warp * 1.2 + 0.15 * sin(p.x * 4.0 + t);
  vec3 sky = mix(vec3(0.85, 0.9, 1.0), vec3(0.3, 0.4, 0.6), clamp(y, 0.0, 1.0));
  vec3 ground = mix(vec3(0.25, 0.2, 0.2), vec3(0.05), clamp(-y, 0.0, 1.0));
  vec3 col = y > 0.0 ? sky : ground;
  col += smoothstep(0.06, 0.0, abs(y)) * 0.9;
  return col + pow(max(0.0, normal.x * 0.7 + normal.y * 0.7), 6.0) * 0.8;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed;
  float mask = letters(p);
  // A soft bevel from the mask's slope, for chrome's reflections.
  float e = 0.004;
  vec2 normal = vec2(letters(p + vec2(e, 0.0)) - letters(p - vec2(e, 0.0)), letters(p + vec2(0.0, e)) - letters(p - vec2(0.0, e)));
  // Glow and outline: the mask's average and maximum on rings round the point.
  float glow = 0.0;
  float ring = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    vec2 dir = vec2(cos(a), sin(a));
    glow += letters(p + dir * 0.02) + letters(p + dir * 0.05) * 0.6;
    ring = max(ring, letters(p + dir * uOutline));
  }
  glow /= 19.2;
  vec3 fill = uFill == 0 ? plasmaFill(p, t) : uFill == 1 ? fireFill(p, t) : uFill == 2 ? causticsFill(p, t) : chromeFill(p, t, normal * 2.0);
  fill *= uTint;
  vec3 col = uBackground + fill * glow * uGlow;
  col = mix(col, uOutlineColor, clamp(ring - mask, 0.0, 1.0) * step(0.0001, uOutline));
  col = mix(col, fill, mask);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Inferno", values: { uFill: 1, uBackground: [0.05, 0.01, 0.0], uGlow: 1.2, uOutline: 0 } },
    { name: "Pool", values: { uFill: 2, uBackground: [0.0, 0.08, 0.14], uOutlineColor: [0.7, 0.95, 1] } },
    { name: "Chrome", values: { uFill: 3, uBackground: [0.06, 0.06, 0.08], uGlow: 0.3, uOutline: 0.002 } },
  ],
};

/** Shader effects that fill or animate text, drawn from a text image (see `textImage`). */

/*
 * Swash text: the `ribbon-curl` text treatment's flourish, in more detail than
 * a layer plan can carry. The same curve (in along the baseline, one loop, an
 * arc hooking over the end) becomes a rounded, twisting ribbon that weaves
 * through the letters pixel by pixel, sheds star-shaped sparkles and erodes
 * into frost.
 */
export const swashText: ShaderEffect = {
  kind: "shader",
  id: "swash-text",
  name: "Swash text",
  description:
    "A title with a glossy gradient ribbon swashing through it: in under the letters along the baseline, a loop over them, then an arc hooking over the end, rounded and twisting, shedding star sparkles, then eroding into frost.",
  category: "text",
  video: "none",
  tags: ["text", "title", "swash", "ribbon", "flourish", "curl", "gradient", "sparkle", "frost", "calligraphy", "overlay"],
  transparent: true,
  loop: 4,
  source: glsl(
    `// Swash text: a rounded, twisting ribbon drawn through the title along a swash curve, woven under and over the letters.
uniform sampler2D uText;        // @control wrap=clamp default=${textImage("Flourish")} label="Text"
uniform vec3 uInk;              // @control color default=#F4F1EA label="Text colour"
uniform vec3 uBackground;       // @control color default=#101018 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform float uSize;            // @control min=0.3 max=1 default=0.6 label="Text size"
uniform float uLength;          // @control min=0.3 max=1 default=0.84 label="Swash length"
uniform vec3 uTail;             // @control color default=#FFB38A label="Tail colour"
uniform vec3 uMid;              // @control color default=#F472B6 label="Middle colour"
uniform vec3 uHead;             // @control color default=#8B5CF6 label="Head colour"
uniform float uWidth;           // @control min=0.01 max=0.15 default=0.085 label="Ribbon width"
uniform float uOpacity;         // @control min=0.2 max=1 default=0.85 label="Ribbon opacity"
uniform float uTwist;           // @control min=0 max=4 default=1.5 label="Twists"
uniform float uGlow;            // @control min=0 max=1 default=0.5 label="Glow"
uniform float uSparkle;         // @control min=0 max=1 default=0.8 label="Sparkles"
uniform bool uWeave;            // @control default=true label="Weave through the letters"
uniform float uFrost;           // @control min=0 max=1 default=0.8 label="Frost dissolve"
uniform vec3 uFrostColor;       // @control color default=#DCE4FF label="Frost colour"
uniform float uCycle;           // @control min=2 max=12 default=4 label="Seconds per swash"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.45 label="Progress (when still)"`,
    HASH,
    NOISE,
    FBM,
    TEXT_BEVEL,
    `// The swash: a start point and three points per cubic segment, x across it and y down the line.
const vec2 CURL[19] = vec2[19](
  vec2(0.0, 0.8), vec2(0.18, 0.86), vec2(0.36, 0.74), vec2(0.44, 0.42),
  vec2(0.49, 0.18), vec2(0.41, -0.06), vec2(0.34, 0.1),
  vec2(0.28, 0.26), vec2(0.4, 0.58), vec2(0.5, 0.76),
  vec2(0.57, 0.9), vec2(0.65, 0.92), vec2(0.71, 0.66),
  vec2(0.77, 0.4), vec2(0.83, -0.12), vec2(0.91, -0.14),
  vec2(0.97, -0.16), vec2(1.01, -0.02), vec2(0.99, 0.18));
const int SEGMENTS = 6;
const int STEPS = 10;

// The title's box in screen units (as textPlace places it).
vec2 textBox() {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize, iResolution.x / iResolution.y * uSize / aspect);
  return vec2(h * aspect, h);
}

// A swash point in screen units: across the middle of the title, from the descenders (y 1) to the ascenders (y 0).
vec2 swashPoint(int i, vec2 box) {
  vec2 c = CURL[i];
  return (vec2(0.5 + (c.x - 0.5) * uLength, 0.93 - c.y * 0.9) - 0.5) * box;
}

vec2 cubic(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
  float u = 1.0 - t;
  return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
}

// The nearest point of the swash to p: its distance (x), the arc length there (y) and the whole length (z).
vec3 swashNearest(vec2 p, vec2 box) {
  float best = 1e9;
  float bestS = 0.0;
  float s = 0.0;
  vec2 prev = swashPoint(0, box);
  for (int k = 0; k < SEGMENTS; k++) {
    vec2 a = swashPoint(3 * k, box);
    vec2 b = swashPoint(3 * k + 1, box);
    vec2 c = swashPoint(3 * k + 2, box);
    vec2 d = swashPoint(3 * k + 3, box);
    for (int j = 1; j <= STEPS; j++) {
      vec2 q = cubic(a, b, c, d, float(j) / float(STEPS));
      vec2 e = q - prev;
      float len = length(e);
      float h = clamp(dot(p - prev, e) / max(len * len, 1e-9), 0.0, 1.0);
      float dist = length(p - prev - e * h);
      if (dist < best) {
        best = dist;
        bestS = s + h * len;
      }
      s += len;
      prev = q;
    }
  }
  return vec3(best, bestS, s);
}

// The swash at u (0 to 1 by segment, not by length), for placing sparkles.
vec2 swashAt(float u, vec2 box) {
  float f = clamp(u, 0.0, 0.9999) * float(SEGMENTS);
  int k = int(floor(f));
  return cubic(swashPoint(3 * k, box), swashPoint(3 * k + 1, box), swashPoint(3 * k + 2, box), swashPoint(3 * k + 3, box), f - float(k));
}

vec3 ribbonColour(float t) {
  return t < 0.5 ? mix(uTail, uMid, t * 2.0) : mix(uMid, uHead, (t - 0.5) * 2.0);
}

vec4 over(vec4 dst, vec3 col, float a) {
  return vec4(col * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 box = textBox();
  float prog = uAnimate ? fract(iTime / uCycle) : uProgress;
  // Drawn on from the tail, then held, then eroded into frost (or faded, without frost).
  float drawT = clamp(prog / 0.35, 0.0, 1.0);
  float reveal = 1.0 - pow(1.0 - drawT, 3.0);
  float erase = smoothstep(0.58, 0.88, prog);
  float fadeOut = mix(1.0 - erase, 1.0, step(0.001, uFrost));

  vec3 near = swashNearest(p, box);
  float d = near.x;
  float t = near.y / max(near.z, 1e-6);
  // Thin at the tail, swelling to the head; each twist narrows it and turns its back to us.
  float turn = cos(t * uTwist * 6.2831 + 0.8);
  float w = uWidth * box.y * (0.08 + 0.92 * smoothstep(0.0, 0.85, t)) * (0.3 + 0.7 * abs(turn));
  float halfW = 0.5 * w;
  float aa = 1.2 * px;
  float cover = smoothstep(halfW + aa, halfW - aa, d);
  cover *= smoothstep(reveal + 0.004, reveal - 0.02, t) * smoothstep(0.0, 0.14, t);
  // Frost: the ribbon erodes from its tail through noise, a bright frosted edge where it goes.
  float n = fbm(p / box.y * 22.0, 4);
  float edge = erase * 1.3 - 0.15;
  float thr = t + (n - 0.5) * 0.3;
  float alive = mix(1.0, smoothstep(edge - 0.015, edge + 0.015, thr), step(0.001, uFrost));
  float rim = uFrost * step(0.001, erase) * exp(-pow((thr - edge) / 0.03, 2.0)) * smoothstep(reveal + 0.01, reveal - 0.04, t);

  // Rounded across its width, with a specular streak on the face and a colour-shifting edge.
  float across = clamp(d / max(halfW, 1e-6), 0.0, 1.0);
  float round = sqrt(max(1.0 - across * across, 0.0));
  vec3 base = ribbonColour(t);
  vec3 col = turn >= 0.0 ? base : mix(base * 0.55, uHead * 0.5, 0.35);
  col *= 0.55 + 0.55 * round;
  col += pow(round, 16.0) * (turn >= 0.0 ? 0.75 : 0.25);
  col += 0.22 * smoothstep(0.7, 1.0, across) * (0.5 + 0.5 * cos(6.2831 * (t * 2.0 + across + vec3(0.0, 0.33, 0.67))));
  float ribbonA = cover * alive * uOpacity * fadeOut;
  col = mix(col, uFrostColor, clamp(rim * 1.5, 0.0, 1.0));

  // Drawn so far, softly at the head, so the glow and haze end with the ribbon rather than in a hard edge.
  float drawn = smoothstep(reveal + 0.01, reveal - 0.04, t);
  float glow = uGlow * 0.45 * exp(-pow(d / (halfW * 3.0 + 0.004), 2.0)) * drawn * alive * fadeOut * smoothstep(0.0, 0.2, t);
  // What frost is left after the edge passes: a soft, sparkling haze along where the ribbon was.
  float haze = uFrost * (1.0 - alive) * exp(-pow(d / (halfW * 1.8 + 0.003), 2.0)) * (1.0 - smoothstep(0.78, 0.97, prog)) * (0.35 + 0.65 * vnoise(p / box.y * 60.0)) * drawn;

  // Under the letters on the tail and the downstroke, over them on the loop and the arc.
  bool behind = uWeave && (t < 0.27 || (t > 0.5 && t < 0.66));
  float mask = textAt(p, 1.2 * px);
  float shade = 0.5 * textAt(p - vec2(0.012, -0.018) * box.y, 0.02 * box.y);
  vec4 c = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  if (behind) {
    c = over(c, base, glow * 0.6);
    c = over(c, col * (1.0 - shade), ribbonA);
    c = over(c, uInk, mask);
  } else {
    c = over(c, uInk, mask);
    c = over(c, base, glow);
    c = over(c, col, ribbonA);
  }
  c = over(c, uFrostColor, clamp(haze * 0.7 + rim * cover * 0.8, 0.0, 1.0));

  // Star sparkles shed where the ribbon has been drawn, twinkling and drifting down.
  float sparks = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float u = hash12(vec2(fi, 1.7));
    if (u > reveal) continue;
    vec2 at = swashAt(u, box) + (hash22(vec2(fi, 4.3)) - 0.5) * box.y * 0.4 - vec2(0.0, 0.08 * box.y * prog * hash12(vec2(fi, 9.1)));
    float size = box.y * 0.02 * (0.6 + 0.8 * hash12(vec2(fi, 5.2)));
    vec2 q = (p - at) / size;
    float star = exp(-dot(q, q)) + 0.6 * (exp(-abs(q.x) * 1.4 - q.y * q.y * 9.0) + exp(-abs(q.y) * 1.4 - q.x * q.x * 9.0));
    float rate = 3.0 + floor(3.0 * hash12(vec2(fi, 6.6)));
    sparks += star * (0.5 + 0.5 * sin(6.2831 * (prog * rate + hash12(vec2(fi, 7.7)))));
  }
  sparks *= 1.4 * uSparkle * (1.0 - smoothstep(0.78, 0.97, prog));
  c = over(c, mix(uMid, vec3(1.0), 0.6), clamp(sparks, 0.0, 1.0));
  fragColor = vec4(c.rgb / max(c.a, 1e-5), c.a);
}`,
  ),
  presets: [
    { name: "Light page", values: { uInk: [0.18, 0.18, 0.22], uBackground: [0.957, 0.953, 0.937], uBackgroundAlpha: 1, uFrostColor: [0.78, 0.82, 0.95], uOpacity: 0.8 } },
    { name: "Dark page", values: { uBackgroundAlpha: 1, uFrostColor: [0.73, 0.65, 1] } },
    { name: "Ocean", values: { uTail: [0.49, 0.83, 0.99], uMid: [0.22, 0.74, 0.97], uHead: [0.31, 0.27, 0.9], uFrostColor: [0.8, 0.92, 1] } },
    { name: "Gold leaf", values: { uTail: [1, 0.86, 0.55], uMid: [0.95, 0.68, 0.25], uHead: [0.75, 0.45, 0.12], uFrostColor: [1, 0.95, 0.85], uTwist: 2.5 } },
    { name: "Flat ribbon", values: { uTwist: 0, uWeave: false, uFrost: 0 } },
  ],
};

export const textShaders: ShaderEffect[] = [shaderText, swashText];
