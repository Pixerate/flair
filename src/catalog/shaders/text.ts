import { FBM, glsl, HASH, NOISE, PALETTE } from "../glsl.js";
import { textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";

export const shaderText: ShaderEffect = {
  kind: "shader",
  id: "shader-text",
  name: "Shader text",
  description: "A title filled with a living texture (plasma, fire, caustics or liquid chrome), with a soft glow and outline.",
  category: "text",
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
export const textShaders: ShaderEffect[] = [shaderText];
