import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Gore-lite: horror that is stylised rather than graphic. Glossy blood
 * dripping down from the top of the frame, claw marks tearing through a
 * picture, and a crimson moon. Each is tagged "horror" and "gore".
 */

/** A background under the overlay, clear by default. */
const BACKGROUND_CONTROLS = `
uniform vec3 uBackground;       // @control color default=#F4EFE6 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

export const bloodDripBorder: ShaderEffect = {
  kind: "shader",
  id: "blood-drip-border",
  name: "Blood drip border",
  description:
    "A glossy band of blood along the top of the frame, drips creeping down from it at their own pace, swelling at their tips and letting drops fall, then thinning away as new ones start; a transparent overlay.",
  category: "horror",
  transparent: true,
  tags: ["horror", "gore", "blood", "drip", "border", "overlay", "halloween"],
  source: glsl(
    `// Blood drip border: a band with a wavy lower edge; under it, in columns across the frame, a drip grows down over
// its life (fast, then slowing), its tip swelling into a bead, and late in its life a drop falls from it. Glossy:
// darker at its edges, with a highlight down one side.
uniform vec3 uColor;       // @control color default=#7E0711 label="Blood"
uniform vec3 uShine;       // @control color default=#FF8A8A label="Shine"
uniform float uBand;       // @control min=0 max=0.3 default=0.05 label="Band"
uniform float uDrips;      // @control min=0 max=1 default=0.7 label="Drips"
uniform float uLength;     // @control min=0.1 max=1 default=0.5 label="Drip length"
uniform float uWidth;      // @control min=0.3 max=2.5 default=1 label="Drip width"
uniform float uSpeed;      // @control min=0.1 max=2 default=0.6 label="Speed"
${BACKGROUND_CONTROLS}`,
    HASH,
    NOISE,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  // Down from the top, in frame heights; across, in frame heights too.
  float y = (iResolution.y - fragCoord.y) * px;
  float x = fragCoord.x * px;
  float edge = uBand + 0.012 * (vnoise(vec2(x * 18.0, 2.0)) - 0.5) + 0.006 * sin(x * 50.0);
  float d = y - edge;
  // The nearest column's drip, and its neighbours' (drips are narrower than a column, so these are enough).
  float cols = 16.0;
  float shade = 0.0;
  for (int k = -1; k <= 1; k++) {
    float ci = floor(x * cols) + float(k);
    vec2 h = hash22(vec2(ci, 4.7));
    if (h.x > uDrips) continue;
    float cx = (ci + 0.3 + 0.4 * h.y) / cols;
    float period = (5.0 + 5.0 * h.x) / uSpeed;
    float u = fract(iTime / period + h.y * 3.0);
    float w = (0.006 + 0.006 * fract(h.x * 9.0)) * uWidth;
    // Late in its life it drains away down its own length, and its bead goes with it.
    float drain = smoothstep(0.85, 1.0, u);
    float len = uLength * (0.35 + 0.65 * fract(h.y * 7.0)) * (1.0 - pow(1.0 - min(u / 0.75, 1.0), 2.5));
    float tip = edge + len;
    float ax = abs(x - cx);
    float taper = 1.0 - 0.35 * clamp((y - edge) / max(len, 1e-3), 0.0, 1.0);
    float stem = max(ax - w * taper, max(y - tip, edge - 0.01 + drain * (len + 0.02) - y));
    float bead = length(vec2(x - cx, y - tip)) - 1.5 * w * (1.0 - smoothstep(0.8, 1.0, drain));
    float drip = min(stem, bead);
    // A drop falling from the tip late in its life.
    float fall = max(u - 0.6, 0.0) / 0.4;
    float drop = length(vec2(x - cx, (y - tip - 0.02 - 1.8 * fall * fall) * 0.7)) - 1.1 * w;
    drip = min(drip, mix(1.0, drop, step(0.6, u)));
    if (drip < d) {
      d = drip;
      shade = clamp((x - cx) / (1.5 * w), -1.0, 1.0);
    }
  }
  float inside = clamp(0.5 - d / px, 0.0, 1.0);
  // Gloss: dark at the edges, a highlight down the left of each drip and along the band's lower edge.
  float depth = clamp(-d / 0.012, 0.0, 1.0);
  vec3 col = uColor * (0.55 + 0.45 * depth);
  float spec = smoothstep(-0.75, -0.45, shade) * (1.0 - smoothstep(-0.45, -0.1, shade)) * step(edge + 0.004, y);
  spec = max(spec, (1.0 - smoothstep(0.0, 0.006, abs(y - edge + 0.008))) * step(y, edge));
  col = mix(col, uShine, spec * 0.6);
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  acc = over(acc, col, inside);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Paper", values: { uBackgroundAlpha: 1 } },
    { name: "Heavy", values: { uDrips: 1, uWidth: 1.8, uBand: 0.09, uLength: 0.8 } },
    { name: "Ink", values: { uColor: [0.04, 0.03, 0.05], uShine: [0.55, 0.55, 0.65] } },
    { name: "Slime", values: { uColor: [0.35, 0.75, 0.1], uShine: [0.85, 1, 0.6] } },
  ],
};

export const clawSlash: ShaderEffect = {
  kind: "shader",
  id: "claw-slash",
  name: "Claw slash",
  description:
    "Claw marks raked across a picture in a fast stroke, each tear ripping open along its length with ragged raw edges and the picture pulled apart round it, holding a moment, then closing up again. Loops; or turn Animate off and set Progress.",
  category: "horror",
  video: "filter",
  tags: ["horror", "gore", "claw", "slash", "scratch", "tear", "rip", "image"],
  loop: 4,
  source: glsl(
    `// Claw slash: parallel curved tears at an angle, each opening from one end to the other in turn. A tear is
// widest in the middle, pointed at its ends and ragged by noise; the picture beside it is pushed apart.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uInside;      // @control color default=#140306 label="Inside the tear"
uniform vec3 uEdge;        // @control color default=#8A0D16 label="Raw edge"
uniform float uClaws;      // @control min=1 max=5 default=4 step=1 label="Claws"
uniform float uAngle;      // @control min=-80 max=80 default=-35 label="Angle (°)"
uniform float uWidth;      // @control min=4 max=50 default=18 label="Width"
uniform float uSpacing;    // @control min=0.03 max=0.2 default=0.085 label="Spacing"
uniform float uCycle;      // @control min=1.5 max=10 default=4 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.4 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float k = uAnimate ? fract(iTime / uCycle) : uProgress;
  float heal = uAnimate ? 1.0 - smoothstep(0.7, 0.95, k) : 1.0;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 perp = vec2(-dir.y, dir.x);
  int n = int(uClaws + 0.5);
  float L = 0.85;
  float nearest = 1e5;
  float width = 0.0;
  float side = 0.0;
  for (int j = 0; j < 5; j++) {
    if (j >= n) break;
    float fj = float(j);
    vec2 c = perp * (fj - 0.5 * float(n - 1)) * uSpacing + dir * 0.03 * (fj - 1.5);
    vec2 q = p - c;
    float s = dot(q, dir) / L;
    float across = dot(q, perp) - 0.08 * s * s * L;
    // It rips open from one end to the other, the claws a beat apart.
    float start = 0.02 * fj;
    float reach = smoothstep(start, start + 0.08, k);
    if (s < -0.5 || s > 0.5 || s + 0.5 > reach) continue;
    float w = uWidth * 0.001 * pow(sin(3.14159 * (s + 0.5)), 0.6) * (1.0 + 0.5 * (vnoise(vec2(s * 70.0, fj * 5.0)) - 0.5)) * heal;
    float d = abs(across) - w;
    if (d < nearest) {
      nearest = d;
      width = w;
      side = sign(across);
    }
  }
  // The picture pulled apart from the tear.
  float pull = width * 0.9 * exp(-max(nearest, 0.0) / 0.02) * step(nearest, 0.06);
  vec4 pic = pictureRGBA(uImage, uv - perp * side * pull / vec2(iResolution.x / iResolution.y, 1.0));
  vec3 col = pic.rgb;
  float px = 1.0 / iResolution.y;
  float rim = (1.0 - smoothstep(0.0, 0.006 * heal + px, nearest)) * step(1e-5, width);
  float tear = clamp(0.5 - nearest / px, 0.0, 1.0) * step(1e-5, width);
  col = mix(col, mix(col, uEdge, 0.75), rim);
  vec3 inside = uInside * (0.6 + 0.4 * clamp(-nearest / max(width, 1e-4), 0.0, 1.0));
  col = mix(col, inside, tear);
  // A shadow just outside the edge, where it curls.
  col *= 1.0 - 0.35 * exp(-max(nearest, 0.0) / 0.004) * step(1e-5, width) * (1.0 - tear);
  fragColor = vec4(col, max(pic.a, tear));
}`,
  ),
  presets: [
    { name: "Three", values: { uClaws: 3, uWidth: 26 } },
    { name: "Vertical", values: { uAngle: -80 } },
    { name: "Shadow beast", values: { uInside: [0.01, 0.01, 0.02], uEdge: [0.25, 0.2, 0.35] } },
    { name: "Torn open", values: { uAnimate: false, uProgress: 0.4 } },
  ],
};

export const bloodMoon: ShaderEffect = {
  kind: "shader",
  id: "blood-moon",
  name: "Blood moon",
  description:
    "A crimson full moon hanging over dark hills and a lone dead tree, its cratered face glowing through drifting clouds, the sky round it stained red and pricked with faint stars.",
  category: "horror",
  tags: ["horror", "gore", "moon", "blood-moon", "night", "sky", "space", "halloween", "background"],
  source: glsl(
    `// Blood moon: a sky darkening upwards, a red glow round the moon, stars in a jittered grid; the moon's face from
// noise (maria and craters) with its rim darkened; clouds of noise drifting across, lit red where thin; then the
// hills and a dead tree as silhouettes.
uniform vec3 uBackground;  // @control color default=#070209 label="Sky"
uniform vec3 uGlow;        // @control color default=#5A0710 label="Red glow"
uniform vec3 uMoon;        // @control color default=#D2361F label="Moon"
uniform float uMoonSize;   // @control min=0.05 max=0.35 default=0.17 label="Moon size"
uniform float uClouds;     // @control min=0 max=1 default=0.55 label="Clouds"
uniform float uStars;      // @control min=0 max=1 default=0.5 label="Stars"
uniform bool uLand;        // @control default=true label="Hills and tree"`,
    HASH,
    NOISE,
    FBM,
    `float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec2 mc = vec2(-0.18 * aspect, 0.16);
  float md = length(p - mc);
  vec3 col = mix(uGlow * 0.6, uBackground, smoothstep(0.0, 0.9, uv.y));
  col += uGlow * 0.9 * exp(-max(md - uMoonSize, 0.0) / (0.35 * uMoonSize + 0.08));
  // Stars, fewer near the moon's glow.
  vec2 g = fragCoord * px * 60.0;
  vec2 gi = floor(g);
  vec2 h = hash22(gi);
  float star = step(1.0 - 0.08 * uStars, hash12(gi + 3.0)) * (1.0 - smoothstep(0.03, 0.09, length(fract(g) - h)));
  col += vec3(1.0, 0.85, 0.85) * star * (0.5 + 0.5 * sin(iTime * (1.0 + 3.0 * h.x) + h.y * 6.0)) * smoothstep(1.4 * uMoonSize, 3.0 * uMoonSize, md);
  // The moon.
  if (md < uMoonSize + 2.0 * px) {
    vec2 m = (p - mc) / uMoonSize;
    float maria = fbm(m * 2.2 + 3.0, 4);
    float craters = fbm(m * 7.0, 3);
    float limb = sqrt(max(1.0 - dot(m, m), 0.0));
    vec3 face = uMoon * (0.55 + 0.35 * smoothstep(0.35, 0.7, maria) + 0.25 * craters) * (0.45 + 0.55 * limb);
    col = mix(col, face, clamp((uMoonSize - md) / px, 0.0, 1.0));
  }
  // Clouds drifting across, dark and lit red at their thin edges.
  float cloud = fbm(vec2(p.x * 2.2 - iTime * 0.03, p.y * 5.0), 5);
  float band = exp(-pow((p.y - 0.15) / 0.18, 2.0));
  float thick = smoothstep(0.5, 0.75, cloud) * band * uClouds;
  col = mix(col, uBackground * 0.6 + uGlow * 0.6 * exp(-md / 0.3) * (1.0 - smoothstep(0.55, 0.8, cloud)), thick * 0.85);
  if (uLand) {
    // Hills, and a dead tree on the nearer one.
    float hills = -0.32 + 0.05 * sin(p.x * 3.0 + 1.0) + 0.03 * sin(p.x * 7.0);
    float near = -0.4 + 0.08 * sin(p.x * 1.6 - 0.6);
    float land = min(p.y - hills, p.y - near);
    vec2 t = p - vec2(0.3 * aspect, near + 0.0);
    float tree = capsule(t, vec2(0.0, -0.05), vec2(0.01, 0.22), 0.012);
    tree = min(tree, capsule(t, vec2(0.005, 0.12), vec2(-0.09, 0.2), 0.006));
    tree = min(tree, capsule(t, vec2(-0.09, 0.2), vec2(-0.12, 0.26), 0.003));
    tree = min(tree, capsule(t, vec2(0.008, 0.17), vec2(0.08, 0.27), 0.005));
    tree = min(tree, capsule(t, vec2(0.08, 0.27), vec2(0.12, 0.28), 0.003));
    tree = min(tree, capsule(t, vec2(0.01, 0.2), vec2(0.03, 0.31), 0.004));
    float sil = min(land, tree);
    col = mix(col, vec3(0.012, 0.004, 0.008), clamp(0.5 - sil / px, 0.0, 1.0));
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Clear night", values: { uClouds: 0, uStars: 1 } },
    { name: "Harvest", values: { uMoon: [0.95, 0.55, 0.2], uGlow: [0.35, 0.15, 0.05] } },
    { name: "Huge", values: { uMoonSize: 0.32 } },
    { name: "Sky only", values: { uLand: false } },
  ],
};

/** The gore-lite shaders. */
export const goreShaders: ShaderEffect[] = [bloodDripBorder, clawSlash, bloodMoon];
