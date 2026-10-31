import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Horror transitions: from one picture to the next through claw marks, a
 * curtain of blood, darkness, a burst of static or a burn in the film. Like
 * the other transitions they loop back and forth over 4 s, or hold at
 * Progress with Animate off; at 0 they show the first picture exactly and at
 * 1 the second. Each is tagged "transition" and "horror".
 */

/** The transitions' shared timing and picture inputs. */
const TRANSITION_CONTROLS = `
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"`.trim();

/** `progress()`: there and back over 4 s, resting a moment at each end, or uProgress when still. */
const PROGRESS = `
float progress() {
  return uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
}`.trim();

const LOOP = "Loops back and forth; or turn Animate off and set Progress.";

export const transitionClawSlash: ShaderEffect = {
  kind: "shader",
  id: "transition-claw-slash",
  name: "Claw tear",
  description: `Claw marks rip across the first picture and tear wider, raw-edged, until the next picture fills the frame through them. ${LOOP}`,
  category: "transition",
  video: "transition",
  tags: ["transition", "horror", "claw", "slash", "tear", "rip", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Claw slash: parallel curved tears rip open from one end, then widen, the next picture showing through them;
// at the end every part of the frame has been torn open. The first picture is pushed apart beside each tear.
${TRANSITION_CONTROLS}
uniform vec3 uEdge;        // @control color default=#8A0D16 label="Raw edge"
uniform float uClaws;      // @control min=1 max=5 default=4 step=1 label="Claws"
uniform float uAngle;      // @control min=-80 max=80 default=-35 label="Angle (°)"
uniform float uSpacing;    // @control min=0.08 max=0.3 default=0.16 label="Spacing"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    PROGRESS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float k = progress();
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 perp = vec2(-dir.y, dir.x);
  int n = int(uClaws + 0.5);
  float L = 2.2;
  float nearest = 1e5;
  float side = 0.0;
  float width = 0.0;
  for (int j = 0; j < 5; j++) {
    if (j >= n) break;
    float fj = float(j);
    vec2 q = p - perp * (fj - 0.5 * float(n - 1)) * uSpacing;
    float s = dot(q, dir) / L;
    float across = dot(q, perp) - 0.06 * s * s * L;
    float reach = smoothstep(0.02 * fj, 0.2 + 0.02 * fj, k);
    if (s < -0.5 || s > 0.5 || s + 0.5 > reach) continue;
    // Torn open, then wider until the tears meet.
    float w = (0.012 * smoothstep(0.0, 0.2, k) + 0.6 * uSpacing * smoothstep(0.25, 0.9, k)) * pow(sin(3.14159 * (s + 0.5)), 0.4);
    w *= 1.0 + 0.5 * (vnoise(vec2(s * 90.0, fj * 5.0)) - 0.5);
    float d = abs(across) - w;
    if (d < nearest) { nearest = d; side = sign(across); width = w; }
  }
  // Whatever is still standing at the end goes too.
  float tear = max(clamp(0.5 - nearest / px, 0.0, 1.0) * step(1e-5, width), smoothstep(0.8, 1.0, k));
  float pull = width * 0.6 * exp(-max(nearest, 0.0) / 0.02) * step(nearest, 0.06) * (1.0 - smoothstep(0.8, 1.0, k));
  vec4 from = pictureCoverRGBA(uFrom, uv - perp * side * pull / vec2(iResolution.x / iResolution.y, 1.0));
  vec4 to = pictureCoverRGBA(uTo, uv);
  float rim = (1.0 - smoothstep(0.0, 0.007, nearest)) * step(1e-5, width) * (1.0 - smoothstep(0.8, 1.0, k));
  from.rgb = mix(from.rgb, mix(from.rgb, uEdge, 0.8), rim * (1.0 - tear));
  to.rgb *= 1.0 - 0.5 * exp(-max(-nearest, 0.0) / 0.015) * step(1e-5, width) * (1.0 - smoothstep(0.8, 1.0, k));
  fragColor = mix(from, to, tear);
}`,
  ),
  presets: [
    { name: "Three claws", values: { uClaws: 3, uSpacing: 0.22 } },
    { name: "Downward", values: { uAngle: -75 } },
    { name: "Shadow", values: { uEdge: [0.15, 0.1, 0.2] } },
  ],
};

export const transitionBloodWipe: ShaderEffect = {
  kind: "shader",
  id: "transition-blood-wipe",
  name: "Blood wipe",
  description: `A curtain of blood pours down over the first picture, drips running ahead of it, then drains away from the top to show the next. ${LOOP}`,
  category: "transition",
  video: "transition",
  tags: ["transition", "horror", "blood", "drip", "wipe", "gore", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Blood wipe: down from the top, a front of blood with drips ahead of it covers the first picture; in the second
// half it drains from the top, the next picture showing behind, stained near the draining edge.
${TRANSITION_CONTROLS}
uniform vec3 uColor;       // @control color default=#7A0610 label="Blood"
uniform vec3 uShine;       // @control color default=#FF7A7A label="Shine"
uniform float uDrips;      // @control min=0 max=1 default=0.7 label="Drips"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    PROGRESS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float k = progress();
  float y = 1.0 - uv.y;
  float x = uv.x * aspect;
  float pour = smoothstep(0.0, 0.5, k);
  float drain = smoothstep(0.5, 1.0, k);
  // The front, with drips running ahead of it in some columns.
  float col = floor(x * 18.0);
  float h = hash12(vec2(col, 2.0));
  float lane = 1.0 - smoothstep(0.12, 0.32, abs(fract(x * 18.0) - 0.5));
  float drip = 0.18 * h * lane * step(h, uDrips + 0.05) + 0.02 * vnoise(vec2(x * 12.0, 1.0));
  float front = pour * 1.45 - 0.2 + drip;
  float clear = drain * 1.4 - 0.2 + 0.04 * vnoise(vec2(x * 9.0, 7.0));
  vec4 from = pictureCoverRGBA(uFrom, uv);
  vec4 to = pictureCoverRGBA(uTo, uv);
  float px = 1.0 / iResolution.y;
  float inFront = clamp((front - y) / px, 0.0, 1.0);
  float cleared = clamp((clear - y) / px, 0.0, 1.0);
  // The blood: glossy, darker in its body, streaked, a bright rim at its leading edge.
  float body = clamp((front - y) / 0.05, 0.0, 1.0);
  vec3 blood = uColor * (0.75 + 0.35 * vnoise(vec2(x * 50.0, y * 4.0 - k * 3.0))) * (1.1 - 0.3 * body);
  blood = mix(blood, uShine, (1.0 - smoothstep(0.0, 0.012, front - y)) * inFront * 0.55);
  // Stained where it has just drained from.
  to.rgb *= mix(vec3(1.0), vec3(1.0, 0.55, 0.55), exp(-max(clear - y, 0.0) / 0.06) * (1.0 - smoothstep(0.9, 1.0, k)));
  vec4 bloodRGBA = vec4(blood, 1.0);
  vec4 under = mix(from, bloodRGBA, inFront);
  fragColor = mix(under, to, cleared);
}`,
  ),
  presets: [
    { name: "Ink", values: { uColor: [0.03, 0.03, 0.05], uShine: [0.5, 0.5, 0.6] } },
    { name: "Ichor", values: { uColor: [0.25, 0.6, 0.12], uShine: [0.8, 1, 0.6] } },
    { name: "Clean edge", values: { uDrips: 0 } },
  ],
};

export const transitionShadowSwallow: ShaderEffect = {
  kind: "shader",
  id: "transition-shadow-swallow",
  name: "Shadow swallow",
  description: `Darkness with tendril edges closes in from the corners and swallows the first picture, a pair of eyes glinting in it for a moment, then draws back to show the next. ${LOOP}`,
  category: "transition",
  video: "transition",
  tags: ["transition", "horror", "shadow", "darkness", "tendrils", "eyes", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Shadow swallow: dark wherever the distance from the middle (between a box and a circle, broken into tendrils
// by noise) is past a front that closes in over the first half and opens out over the second.
${TRANSITION_CONTROLS}
uniform vec3 uDark;        // @control color default=#020103 label="Darkness"
uniform vec3 uRim;         // @control color default=#4A0A12 label="Edge"
uniform float uTendrils;   // @control min=0 max=1 default=0.7 label="Tendrils"
uniform bool uEyes;        // @control default=true label="Eyes in the dark"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    PROGRESS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float k = progress();
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 e = p / vec2(0.5 * aspect, 0.5);
  float r = mix(max(abs(e.x), abs(e.y)), length(e), 0.6);
  float ang = atan(e.y, e.x);
  float t = fbm(vec2(ang * 2.5 + k * 2.0, r * 3.0 - k * 3.0), 5);
  float fingers = pow(vnoise(vec2(ang * 9.0, k * 2.0)), 3.0);
  float edge = r + (t - 0.5) * 0.35 * uTendrils + fingers * 0.25 * uTendrils;
  // Closing to nothing at the middle, then opening out again past the corners.
  float front = k < 0.5 ? mix(2.0, -0.4, smoothstep(0.0, 0.5, k)) : mix(-0.4, 2.0, smoothstep(0.5, 1.0, k));
  float dark = smoothstep(front - 0.06, front + 0.02, edge);
  float rim = exp(-abs(edge - front + 0.03) / 0.03) * (1.0 - dark);
  vec4 pic = k < 0.5 ? pictureCoverRGBA(uFrom, uv) : pictureCoverRGBA(uTo, uv);
  vec3 col = mix(pic.rgb, uRim, rim * 0.6);
  col = mix(col, uDark, dark);
  // Eyes opening in the dark while it is all dark.
  if (uEyes) {
    float open = smoothstep(0.42, 0.47, k) * (1.0 - smoothstep(0.53, 0.58, k));
    vec2 q = p - vec2(0.06, 0.04);
    q.x = abs(q.x) - 0.045;
    float eye = 1.0 - smoothstep(0.008, 0.012, length(q / vec2(1.0, max(open, 0.05) * 0.45)));
    col = mix(col, vec3(1.0, 0.82, 0.3), eye * open * dark);
  }
  fragColor = vec4(col, max(pic.a, dark));
}`,
  ),
  presets: [
    { name: "No eyes", values: { uEyes: false } },
    { name: "Smooth", values: { uTendrils: 0.1 } },
    { name: "Sickly", values: { uDark: [0.02, 0.04, 0.02], uRim: [0.3, 0.45, 0.1] } },
  ],
};

export const transitionStaticCut: ShaderEffect = {
  kind: "shader",
  id: "transition-static-cut",
  name: "Static cut",
  description: `The first picture tears and rolls as the signal goes, breaks into TV static, then the next picture tunes in out of it. ${LOOP}`,
  category: "transition",
  video: "transition",
  tags: ["transition", "horror", "static", "glitch", "tv", "signal", "analog-horror", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Static cut: lines tear sideways, a bar rolls and the channels split as the signal goes; static takes over at
// the middle, the first picture before it and the next after.
${TRANSITION_CONTROLS}
uniform float uTear;       // @control min=0 max=1 default=0.7 label="Tearing"
uniform float uSplit;      // @control min=0 max=0.03 default=0.012 label="Colour split"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    PROGRESS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float k = progress();
  float noise = smoothstep(0.12, 0.45, k) * (1.0 - smoothstep(0.55, 0.88, k));
  float frame = floor(iTime * 30.0);
  float line = floor(uv.y * 200.0);
  float shift = (hash12(vec2(line, frame)) - 0.5) * 0.15 * uTear * noise * noise;
  float roll = fract(uv.y * 1.3 + iTime * 1.7);
  float bar = smoothstep(0.0, 0.03, roll) * smoothstep(0.15, 0.05, roll) * noise;
  vec2 st = uv + vec2(shift + bar * 0.05, 0.0);
  vec2 sp = vec2(uSplit * noise, 0.0);
  vec4 g = k < 0.5 ? pictureCoverRGBA(uFrom, st) : pictureCoverRGBA(uTo, st);
  vec3 c = k < 0.5 ? vec3(pictureCover(uFrom, st + sp).r, g.g, pictureCover(uFrom, st - sp).b) : vec3(pictureCover(uTo, st + sp).r, g.g, pictureCover(uTo, st - sp).b);
  float snow = hash12(fragCoord + frame * 13.0);
  vec3 col = mix(c, vec3(snow * 0.85 + 0.08), clamp(noise * 1.2 - 0.1 + bar * 0.5, 0.0, 1.0));
  fragColor = vec4(col, max(g.a, noise));
}`,
  ),
  presets: [
    { name: "Clean switch", values: { uTear: 0.1, uSplit: 0.002 } },
    { name: "Bad reception", values: { uTear: 1, uSplit: 0.03 } },
  ],
};

export const transitionFilmBurn: ShaderEffect = {
  kind: "shader",
  id: "transition-film-burn",
  name: "Burn through",
  description: `The first picture blisters and burns through from a hot spot, a glowing charred edge spreading out across the frame and the next picture showing through the hole. ${LOOP}`,
  category: "transition",
  video: "transition",
  tags: ["transition", "horror", "film", "burn", "melt", "vintage", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Film burn: a hole with a noisy edge grows from the hot spot over the transition; round it the first picture
// is drawn away (melting), charred and lit by a glowing rim, and the next picture shows through the hole.
${TRANSITION_CONTROLS}
uniform vec3 uHot;         // @control color default=#FF9A3C label="Burning edge"
uniform float uX;          // @control min=-0.5 max=0.5 default=0.12 label="Hot spot across"
uniform float uY;          // @control min=-0.5 max=0.5 default=0.06 label="Hot spot up"
uniform float uMelt;       // @control min=0 max=1 default=0.6 label="Melt"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    PROGRESS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float k = progress();
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 rel = p - vec2(uX * aspect, uY);
  float r = 1.75 * pow(k, 1.7);
  float edge = length(rel) + (fbm(rel * 6.0, 4) - 0.5) * 0.12 * (0.3 + r);
  float open = step(1e-4, r);
  float near = exp(-max(edge - r, 0.0) / 0.08) * open * (1.0 - smoothstep(0.85, 1.0, k));
  vec4 from = pictureCoverRGBA(uFrom, uv - normalize(rel + 1e-5) * near * 0.04 * uMelt / vec2(aspect, 1.0));
  vec4 to = pictureCoverRGBA(uTo, uv);
  float charred = smoothstep(r + 0.06, r + 0.01, edge) * open;
  from.rgb = mix(from.rgb, vec3(0.05, 0.03, 0.02), charred * 0.85);
  float glow = exp(-abs(edge - r) / 0.012) * open;
  float hole = smoothstep(r, r - 0.01, edge) * open;
  vec4 col = mix(from, to, hole);
  col.rgb = mix(col.rgb, uHot, clamp(glow, 0.0, 1.0) * (1.0 - smoothstep(0.85, 1.0, k)));
  fragColor = col;
}`,
  ),
  presets: [
    { name: "From the corner", values: { uX: -0.5, uY: -0.5 } },
    { name: "Blue flame", values: { uHot: [0.45, 0.7, 1] } },
    { name: "No melt", values: { uMelt: 0 } },
  ],
};

/** The horror transitions. */
export const horrorTransitions: ShaderEffect[] = [transitionClawSlash, transitionBloodWipe, transitionShadowSwallow, transitionStaticCut, transitionFilmBurn];
