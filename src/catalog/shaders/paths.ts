import { glsl, PATH } from "../glsl.js";
import { textPath } from "../../vector/handwriting.js";
import type { ShaderEffect } from "../types.js";

/** A coil sweeping back and forth down a portrait frame, looping over itself at the left. */
const SQUIGGLE =
  "M 40 50 C 43 56 47 76 59 87 C 70 98 89 108 108 115 C 127 121 151 125 171 126 C 191 127 213 124 228 120 C 242 116 254 108 258 101 C 262 95 259 86 252 80 C 244 73 228 67 211 64 C 194 62 170 61 150 64 C 130 67 106 73 89 81 C 72 89 56 101 48 113 C 41 124 38 139 42 151 C 46 163 58 176 72 186 C 87 195 109 204 129 208 C 149 213 173 214 192 213 C 211 213 230 208 241 203 C 253 197 260 189 260 182 C 260 175 253 167 241 161 C 230 156 211 151 192 150 C 173 149 149 151 129 156 C 109 160 87 169 72 178 C 58 188 46 201 42 213 C 38 225 41 240 48 251 C 56 263 72 275 89 283 C 106 291 130 297 150 300 C 170 303 194 302 211 299 C 228 297 244 290 252 284 C 259 278 262 269 258 263 C 254 256 242 248 228 244 C 213 240 191 237 171 238 C 151 239 127 243 108 249 C 89 256 70 266 59 277 C 47 288 40 302 40 314 C 40 326 47 340 59 351 C 70 362 89 372 108 378 C 127 385 151 389 171 390 C 191 391 213 388 228 384 C 242 380 254 372 258 365 C 262 359 259 350 252 343 C 244 337 228 331 211 328 C 194 326 160 328 150 328";

/** The tube's defaults, for each effect built on it. */
interface TubeDefaults {
  path: string;
  pathLabel: string;
  thickness: number;
  drawOn: number;
  opacity: number;
  glow: number;
}

/** A see-through glowing tube along a path control: each pass of the path near a pixel lit as glass, earlier passes first. */
function tubeSource(title: string, d: TubeDefaults): string {
  return glsl(
    `// ${title}: each pass of the path near a pixel drawn as a lit, see-through tube, earlier passes first.
uniform sampler2D uPath;  // @control path default="${d.path}" label="${d.pathLabel}"
uniform vec3 uColorA;     // @control color default=#E8283C label="Start colour"
uniform vec3 uColorB;     // @control color default=#FF7A45 label="Middle colour"
uniform vec3 uColorC;     // @control color default=#FFC53D label="End colour"
uniform vec3 uBackground; // @control color default=#140B08 label="Background"
uniform float uThickness; // @control min=1 max=30 default=${d.thickness} label="Thickness (%)"
uniform float uUnit;      // @control min=0 max=16384 default=0 label="Size unit (px, 0 = frame's shorter side)"
uniform float uProgress;  // @control min=0 max=1 default=1 label="Drawn"
uniform float uDrawOn;    // @control min=0 max=10 default=${d.drawOn} label="Draw-on time (s)"
uniform float uOpacity;   // @control min=0 max=1 default=${d.opacity} label="Body opacity"
uniform float uRim;       // @control min=0 max=2 default=1 label="Edge light"
uniform float uGlow;      // @control min=0 max=2 default=${d.glow} label="Glow"
uniform float uFlow;      // @control min=0 max=2 default=0.4 label="Shimmer speed"
uniform bool uDownFrame;  // @control default=false label="Colour down the frame"`,
    PATH,
    `vec3 tubeTint(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uColorA, uColorB, t * 2.0) : mix(uColorB, uColorC, t * 2.0 - 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Thickness is a share of uUnit px when set (a paint brush's scale), else of the frame's shorter side.
  float r = 0.5 * uThickness / 100.0 * (uUnit > 0.0 ? uUnit : min(iResolution.x, iResolution.y));
  float total = pathLength(uPath);
  float drawn = uDrawOn > 0.0 ? min(uProgress, iTime / uDrawOn) : uProgress;
  float reach = r * (1.0 + 2.0 * min(uGlow, 1.0));
  vec4 hits[4];
  int n = pathHits(uPath, fragCoord, reach, 2.5 * r, 0.0, total * clamp(drawn, 0.0, 1.0), hits);
  // Earliest first, so later passes lie on top.
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3 - i; j++) {
      if (j + 1 < n && hits[j].y > hits[j + 1].y) {
        vec4 s = hits[j];
        hits[j] = hits[j + 1];
        hits[j + 1] = s;
      }
    }
  }
  vec3 col = uBackground;
  float frameT = 1.0 - fragCoord.y / iResolution.y;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    vec4 h = hits[i];
    float x = h.x / r;
    vec3 tint = tubeTint(uDownFrame ? frameT : h.y / max(total, 1.0));
    // Light spilling round the tube.
    col += tint * uGlow * 0.35 * exp(-2.5 * max(x - 1.0, 0.0)) * (1.0 - smoothstep(0.0, 1.0, 1.0 - x));
    if (x >= 1.0) continue;
    float across = x * h.z;
    float nz = sqrt(max(1.0 - x * x, 0.0));
    float fresnel = pow(1.0 - nz, 2.0);
    // A highlight running along one edge, and a slow glint travelling down the tube.
    float spec = pow(max(0.0, 1.0 - abs(across - 0.5) / 0.22), 3.0);
    float glint = pow(0.5 + 0.5 * sin((h.y - iTime * uFlow * r * 4.0) / (r * 3.0)), 12.0);
    // Dark, tinted glass in the middle; saturated light gathering towards the edges, then a thin bright lip.
    vec3 body = tint * (0.08 + 0.3 * nz * nz);
    vec3 edge = tint * uRim * (1.6 * fresnel + 0.9 * pow(x, 10.0));
    vec3 tube = body + edge + mix(tint, vec3(1.0), 0.5) * (0.45 * spec + 0.3 * glint * nz) * uRim;
    float a = mix(uOpacity, 1.0, fresnel) * smoothstep(r, r - 1.5, h.x);
    col = mix(col, tube, a);
  }
  fragColor = vec4(col, 1.0);
}`,
  );
}

export const glassTube: ShaderEffect = {
  kind: "shader",
  id: "glass-tube",
  name: "Glass tube",
  description:
    "A thick, see-through tube of glowing glass drawing itself along any path, with bright edges, a soft core and overlaps that show through each other, coloured from one end to the other.",
  category: "path",
  tags: ["background", "path", "line", "draw", "tube", "glass", "glow", "squiggle", "ribbon", "wallpaper"],
  build: 2.5,
  source: tubeSource("Glass tube", { path: SQUIGGLE, pathLabel: "Path", thickness: 13, drawOn: 2.5, opacity: 0.45, glow: 0.6 }),
  presets: [
    { name: "Neon", values: { uColorA: [0.1, 0.9, 1], uColorB: [0.55, 0.3, 1], uColorC: [1, 0.25, 0.75], uBackground: [0.02, 0.01, 0.06], uOpacity: 0.25, uGlow: 1.2 } },
    { name: "Chrome", values: { uColorA: [0.75, 0.78, 0.85], uColorB: [0.95, 0.96, 1], uColorC: [0.6, 0.65, 0.75], uBackground: [0.06, 0.07, 0.09], uOpacity: 0.9, uGlow: 0.2 } },
    { name: "Light", values: { uBackground: [0.96, 0.95, 0.94], uGlow: 0.2, uOpacity: 0.6 } },
    { name: "Static", values: { uDrawOn: 0, uFlow: 0 } },
  ],
};

export const glassWriting: ShaderEffect = {
  kind: "shader",
  id: "glass-writing",
  name: "Glass writing",
  description:
    "Words written on in one glowing glass stroke, letter by letter as a pen would, in joined-up script or print; give the path words as {\"text\": …} or any path.",
  category: "path",
  tags: ["title", "path", "handwriting", "signature", "writing", "draw", "tube", "glass", "glow", "neon"],
  build: 3,
  source: tubeSource("Glass writing", { path: textPath("Hello"), pathLabel: "Words (path)", thickness: 3.5, drawOn: 3, opacity: 0.8, glow: 0.8 }),
  presets: [
    { name: "Neon sign", values: { uColorA: [1, 0.2, 0.6], uColorB: [1, 0.35, 0.8], uColorC: [0.6, 0.4, 1], uBackground: [0.03, 0.01, 0.05], uOpacity: 0.85, uGlow: 1.4 } },
    { name: "Print", values: { uPath: textPath("Hello", { font: "sans" }) } },
    { name: "Gold", values: { uColorA: [1, 0.75, 0.3], uColorB: [1, 0.9, 0.55], uColorC: [0.9, 0.65, 0.25], uBackground: [0.05, 0.04, 0.03], uGlow: 0.5 } },
  ],
};

export const pathShaders: ShaderEffect[] = [glassTube, glassWriting];
