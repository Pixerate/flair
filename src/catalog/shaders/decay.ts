import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Decay: horror effects that eat at a picture. Rust and mould spread across
 * it, it withers and caves in, its wallpaper peels away from something
 * underneath, it ages like an old print, or the film stalls and burns
 * through in the projector. Each is tagged "horror" and "decay".
 *
 * The growing ones run over a cycle and give the picture back at its end, so
 * they loop; turn Animate off and set Progress to hold a moment.
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

/** The cycle and still-moment controls the growing effects share. */
const CYCLE_CONTROLS = (cycle: number, progress: number, label = "Progress") => `
uniform float uCycle;      // @control min=3 max=30 default=${cycle} label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=${progress} label="${label} (when still)"`.trim();

export const rustSpread: ShaderEffect = {
  kind: "shader",
  id: "rust-spread",
  name: "Rust spread",
  description:
    "Rust breaking out at a few spots on a picture and eating across it along a dark wet front, leaving pitted flaking orange-brown behind, then gone again. Loops; or turn Animate off and set Progress.",
  category: "horror",
  video: "filter",
  tags: ["horror", "decay", "rust", "corrosion", "spread", "metal", "image"],
  loop: 10,
  source: glsl(
    `// Rust spread: rusted where the distance to the nearest seed (bent by noise) is inside a front that grows over
// the cycle. Longer-rusted parts are deeper and more pitted; the front is a dark stain.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uRust;        // @control color default=#8A3B12 label="Rust"
uniform vec3 uRustLight;   // @control color default=#C9702E label="Rust highlights"
uniform vec3 uDeep;        // @control color default=#2B1309 label="Pits"
uniform float uSeeds;      // @control min=1 max=6 default=3 step=1 label="Spots"
uniform float uRough;      // @control min=0 max=1 default=0.6 label="Ragged edge"
uniform float uReach;      // @control min=0.2 max=1.6 default=1.1 label="Reach"
${CYCLE_CONTROLS(10, 0.6)}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float u = fract(iTime / uCycle);
  float k = uAnimate ? smoothstep(0.0, 0.8, u) : uProgress;
  float back = uAnimate ? smoothstep(0.88, 1.0, u) : 0.0;
  float seed = 1e5;
  int n = int(uSeeds + 0.5);
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    vec2 s = (hash22(vec2(float(i) * 3.1, 7.7)) - 0.5) * vec2(aspect * 0.85, 0.85);
    seed = min(seed, length(p - s));
  }
  float field = seed + (fbm(p * 4.0, 5) - 0.5) * 0.4 * uRough;
  float front = k * uReach;
  float rust = smoothstep(front, front - 0.02, field) * step(0.001, k);
  float depth = clamp((front - field) / 0.3, 0.0, 1.0);
  float stain = exp(-abs(field - front) / 0.012) * step(0.001, k);
  // Its texture: mottled light and dark, pitted deeper the longer it has rusted.
  float grain = fbm(p * 18.0, 4);
  float pits = smoothstep(0.6, 0.7, fbm(p * 40.0 + 3.0, 3)) * (0.3 + 0.7 * depth);
  vec3 rc = mix(uRust, uRustLight, smoothstep(0.35, 0.75, grain));
  rc = mix(rc, uDeep, clamp(pits + 0.3 * depth * (1.0 - grain), 0.0, 1.0));
  vec4 pic = pictureRGBA(uImage, uv);
  float l = dot(pic.rgb, ${LUMA});
  // A ghost of the picture stays in the rust at first, then is eaten away.
  vec3 col = mix(pic.rgb, rc * (0.7 + 0.5 * l * (1.0 - depth)), rust * mix(0.75, 1.0, depth));
  col = mix(col, uDeep, stain * 0.55 * (1.0 - rust * 0.5));
  col = mix(col, pic.rgb, back);
  // Rust only grows on the picture: where it is clear, it stays clear.
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "One spot", values: { uSeeds: 1, uReach: 1.4 } },
    { name: "Verdigris", values: { uRust: [0.2, 0.5, 0.42], uRustLight: [0.45, 0.78, 0.66], uDeep: [0.08, 0.2, 0.16] } },
    { name: "Clean edge", values: { uRough: 0.1 } },
    { name: "Half eaten", values: { uAnimate: false, uProgress: 0.45 } },
  ],
};

export const moldBloom: ShaderEffect = {
  kind: "shader",
  id: "mold-bloom",
  name: "Mould bloom",
  description:
    "Fuzzy colonies of mould blooming across a picture one after another, dark-centred and ringed, with white fur at their edges and a yellow stain spreading round them, then wiped clean. Loops; or turn Animate off and set Progress.",
  category: "horror",
  video: "filter",
  tags: ["horror", "decay", "mold", "mould", "fungus", "growth", "spread", "image"],
  loop: 12,
  source: glsl(
    `// Mould bloom: each colony starts at its own time and grows to its own size, its edge fuzzed by noise. Inside,
// growth rings run from a dark centre to a furry white rim; round it the picture yellows.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uColor;       // @control color default=#6E8536 label="Mould"
uniform vec3 uFur;         // @control color default=#ECE9DA label="Fur"
uniform vec3 uCore;        // @control color default=#1C2213 label="Centres"
uniform float uColonies;   // @control min=3 max=30 default=14 step=1 label="Colonies"
uniform float uSize;       // @control min=0.03 max=0.4 default=0.14 label="Size"
${CYCLE_CONTROLS(12, 0.7)}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float u = fract(iTime / uCycle);
  float k = uAnimate ? smoothstep(0.0, 0.85, u) : uProgress;
  float back = uAnimate ? smoothstep(0.9, 1.0, u) : 0.0;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb;
  float cover = 0.0;
  int n = int(uColonies + 0.5);
  for (int i = 0; i < 30; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi * 5.3, 2.9));
    vec2 c = (h - 0.5) * vec2(aspect * 0.95, 0.95);
    float start = 0.6 * hash12(vec2(fi, 4.1));
    float grow = pow(clamp((k - start) / (1.0 - start), 0.0, 1.0), 0.7);
    float r = uSize * (0.4 + 0.8 * fract(h.x * 17.0)) * grow;
    float dc = length(p - c);
    if (r < 1e-4 || dc > 1.8 * r) continue;
    // The yellow stain spreading ahead of it.
    col *= mix(vec3(1.0), vec3(0.93, 0.86, 0.62), (1.0 - smoothstep(r, 1.7 * r, dc)) * 0.8);
    float d = dc + (vnoise(p * 60.0 + fi * 7.0) - 0.5) * 0.35 * r;
    float inside = 1.0 - smoothstep(0.85 * r, r, d);
    float x = clamp(d / r, 0.0, 1.0);
    vec3 m = mix(uCore, uColor, smoothstep(0.0, 0.55, x));
    m *= 0.85 + 0.15 * sin(x * 22.0);
    m = mix(m, uFur, smoothstep(0.65, 0.98, x) * (0.6 + 0.4 * vnoise(p * 140.0)));
    col = mix(col, m, inside * 0.95);
    cover = max(cover, inside);
  }
  col = mix(col, pic.rgb, back);
  fragColor = vec4(col, max(pic.a, cover * (1.0 - back)));
}`,
  ),
  presets: [
    { name: "Black mould", values: { uColor: [0.12, 0.13, 0.12], uCore: [0.02, 0.02, 0.02], uFur: [0.35, 0.36, 0.33] } },
    { name: "Penicillin", values: { uColor: [0.3, 0.55, 0.6], uFur: [0.95, 0.97, 0.94] } },
    { name: "Overrun", values: { uColonies: 30, uSize: 0.22 } },
    { name: "Still", values: { uAnimate: false } },
  ],
};

export const wither: ShaderEffect = {
  kind: "shader",
  id: "wither",
  name: "Wither",
  description:
    "A picture draining of colour and drying out, cracks splitting across it as its middle caves in and sags, then coming back to life. Loops; or turn Animate off and set Progress.",
  category: "horror",
  video: "filter",
  tags: ["horror", "decay", "wither", "dry", "cracks", "desaturate", "cave-in", "image"],
  loop: 8,
  source: glsl(
    `// Wither: colour drains to a dry brown-grey, the middle is pinched in and sags (sampled from further out and
// higher up), and the cells of a jittered grid split along their edges, more of them as it goes.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uDry;         // @control color default=#B8A88A label="Dried colour"
uniform float uCracks;     // @control min=0 max=1 default=0.7 label="Cracks"
uniform float uCrackSize;  // @control min=3 max=20 default=8 label="Crack cells"
uniform float uSag;        // @control min=0 max=1 default=0.6 label="Cave in"
${CYCLE_CONTROLS(8, 0.8)}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `// The cracks' cells: (distance to the nearest edge, the nearest cell's hash).
vec2 cells(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 best = vec2(0.0);
  vec2 bestId = vec2(0.0);
  float d1 = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int xx = -1; xx <= 1; xx++) {
      vec2 g = vec2(float(xx), float(y));
      vec2 o = g + hash22(i + g) - f;
      float d = dot(o, o);
      if (d < d1) { d1 = d; best = o; bestId = i + g; }
    }
  float edge = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int xx = -1; xx <= 1; xx++) {
      vec2 g = vec2(float(xx), float(y));
      vec2 o = g + hash22(i + g) - f;
      vec2 diff = o - best;
      if (dot(diff, diff) > 1e-5) edge = min(edge, dot(0.5 * (best + o), normalize(diff)));
    }
  return vec2(edge, hash12(bestId));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float u = fract(iTime / uCycle);
  float k = uAnimate ? smoothstep(0.0, 0.6, u) * (1.0 - smoothstep(0.82, 1.0, u)) : uProgress;
  vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
  float r2 = dot(c, c);
  // Caving in: the middle drawn in towards a point and sagging down.
  vec2 st = 0.5 + (uv - 0.5) * (1.0 + 0.45 * k * uSag * exp(-r2 * 5.0));
  st.y += 0.07 * k * uSag * exp(-r2 * 4.0);
  vec4 pic = pictureRGBA(uImage, st);
  float l = dot(pic.rgb, ${LUMA});
  vec3 dry = uDry * (0.25 + 0.95 * l);
  vec3 col = mix(pic.rgb, dry, k);
  col = mix(col, (col - 0.5) * 1.15 + 0.5, k);
  col *= 1.0 - 0.45 * k * smoothstep(0.05, 0.4, r2);
  // Cracks run along the cells' edges where a noise field has opened them, spreading in broken runs as it dries.
  vec2 x = fragCoord / iResolution.y * uCrackSize;
  vec2 cell = cells(x);
  float spread = 0.7 * k * uCracks;
  float open = smoothstep(1.0 - spread, 1.05 - spread, vnoise(x * 0.9 + 11.0) * 0.6 + vnoise(x * 3.0) * 0.4);
  float edge = cell.x + (vnoise(x * 12.0) - 0.5) * 0.04;
  float w = (0.012 + 0.03 * k) * open;
  float crack = (1.0 - smoothstep(0.5 * w, w, edge)) * step(0.001, w);
  float lip = (1.0 - smoothstep(w, 2.5 * w + 0.01, edge)) * open * (1.0 - crack);
  col = mix(col, col * 1.15 + 0.04, lip * 0.5);
  col = mix(col, vec3(0.07, 0.05, 0.035), crack * 0.9);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, crack));
}`,
  ),
  presets: [
    { name: "Ash", values: { uDry: [0.62, 0.62, 0.6] } },
    { name: "Parched", values: { uCracks: 1, uCrackSize: 14, uSag: 0.2 } },
    { name: "Collapse", values: { uSag: 1, uCracks: 0.4 } },
    { name: "Dried out", values: { uAnimate: false, uProgress: 1 } },
  ],
};

export const peelingWallpaper: ShaderEffect = {
  kind: "shader",
  id: "peeling-wallpaper",
  name: "Peeling wallpaper",
  description:
    "A picture as wallpaper peeling back from a corner along a torn edge, its pale backing curling over, to show a grimy, stained picture underneath, then smoothing back down. Loops; or turn Animate off and set Progress.",
  category: "horror",
  video: "stills",
  tags: ["horror", "decay", "wallpaper", "peel", "reveal", "hidden", "grime", "image"],
  loop: 7,
  source: glsl(
    `// Peeling wallpaper: a fold line sweeps in from a corner. Before it the paper is gone and the picture beneath
// shows, shadowed near the fold; past it, where the mirror image (across the fold) of a point is paper, the
// folded-back flap covers it, showing its backing. The fold's edge is torn by noise.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Wallpaper"
uniform sampler2D uUnder;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Underneath"
uniform vec3 uBacking;     // @control color default=#E8DDC4 label="Paper backing"
uniform float uGrime;      // @control min=0 max=1 default=0.6 label="Grime underneath"
uniform float uAngle;      // @control min=-180 max=180 default=145 label="Peel direction (°)"
uniform float uReach;      // @control min=0.1 max=1 default=0.75 label="How far it peels"
${CYCLE_CONTROLS(7, 0.6)}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 q = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 half_ = vec2(0.5 * aspect, 0.5);
  vec2 dir = vec2(cos(radians(uAngle)), sin(radians(uAngle)));
  vec2 across = vec2(-dir.y, dir.x);
  float span = abs(dir.x) * half_.x + abs(dir.y) * half_.y;
  float k = uAnimate ? smoothstep(0.05, 0.55, fract(iTime / uCycle)) * (1.0 - smoothstep(0.75, 1.0, fract(iTime / uCycle))) : uProgress;
  // The fold, from just outside the starting corner, torn along its length.
  float fold = -span + k * uReach * 2.0 * span + (vnoise(vec2(dot(q, across) * 18.0, 3.0)) - 0.5) * 0.025;
  float t = dot(q, dir);
  vec4 paper = pictureRGBA(uImage, uv);
  // Underneath: darker, stained, streaked with old glue.
  vec4 under = pictureRGBA(uUnder, uv);
  float stain = fbm(q * 5.0, 4);
  vec3 grimy = under.rgb * mix(1.0, 0.55 + 0.4 * stain, uGrime) * mix(vec3(1.0), vec3(0.9, 0.85, 0.65), uGrime * smoothstep(0.45, 0.7, stain));
  grimy *= 1.0 - 0.15 * uGrime * smoothstep(0.7, 0.9, vnoise(vec2(dot(q, across) * 40.0, t * 3.0)));
  vec3 col;
  float alpha;
  if (t < fold) {
    // Peeled away: the picture beneath, in the shadow of the curl near the fold.
    col = grimy * (1.0 - 0.55 * exp(-(fold - t) / 0.04));
    alpha = under.a;
  } else {
    col = paper.rgb;
    alpha = paper.a;
    // The flap: paper folded back over the fold, if its mirror point was on the wall.
    vec2 m = q - 2.0 * (t - fold) * dir;
    if (abs(m.x) < half_.x && abs(m.y) < half_.y && t - fold < (fold + span)) {
      float from = t - fold;
      float shade = 0.72 + 0.28 * smoothstep(0.0, 0.12, from) - 0.12 * smoothstep(0.1, 0.4, from);
      col = uBacking * shade * (0.92 + 0.08 * vnoise(m * 90.0));
      alpha = 1.0;
    } else {
      // The flap's shadow on the paper just past it.
      vec2 mm = q - 2.0 * (t - fold - 0.015) * dir;
      float near = step(abs(mm.x), half_.x) * step(abs(mm.y), half_.y) * step(0.0, fold + span);
      col *= 1.0 - 0.25 * near * step(0.001, k);
    }
  }
  fragColor = vec4(col, alpha);
}`,
  ),
  presets: [
    { name: "From the top", values: { uAngle: -90 } },
    { name: "Clean wall", values: { uGrime: 0 } },
    { name: "Nearly off", values: { uReach: 1 } },
    { name: "Torn back", values: { uAnimate: false, uProgress: 0.8 } },
  ],
};

export const agedPhoto: ShaderEffect = {
  kind: "shader",
  id: "aged-photo",
  name: "Aged photo",
  description:
    "A picture as an old print: faded to sepia, foxed with brown spots, silvered with a bluish sheen in its shadows that shifts with the light, cracked along creases and worn white at the edges.",
  category: "horror",
  video: "filter",
  tags: ["horror", "decay", "vintage", "sepia", "old", "photo", "foxing", "creases", "image"],
  source: glsl(
    `// Aged photo: sepia and fade; foxing as small spots in a jittered grid and larger blotches; silvering where it
// is dark and near the edges, as a sheen that drifts; creases as broken bright lines with a shadow on one side.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uSepia;      // @control min=0 max=1 default=0.75 label="Sepia"
uniform float uFade;       // @control min=0 max=1 default=0.5 label="Fade"
uniform float uFoxing;     // @control min=0 max=1 default=0.6 label="Foxing"
uniform float uSilver;     // @control min=0 max=1 default=0.5 label="Silvering"
uniform float uCreases;    // @control min=0 max=1 default=0.6 label="Creases"
uniform float uWear;       // @control min=0 max=1 default=0.5 label="Worn edges"
uniform float uSeed;       // @control min=0 max=100 default=7 step=1 label="Variation"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `// A crease across the print: brightness (the cracked emulsion) and the shadow beside it.
vec2 crease(vec2 p, float i) {
  vec2 h = hash22(vec2(i * 3.3, uSeed));
  vec2 at = (h - 0.5) * vec2(0.8, 0.6);
  float a = hash12(vec2(i, uSeed + 1.0)) * 3.14159;
  vec2 dir = vec2(cos(a), sin(a));
  float side = dot(p - at, vec2(-dir.y, dir.x));
  float along = dot(p - at, dir);
  float broken = smoothstep(0.35, 0.55, vnoise(vec2(along * 30.0, i * 9.0)));
  float wobble = (vnoise(vec2(along * 12.0, i)) - 0.5) * 0.006;
  float d = abs(side + wobble);
  return vec2(exp(-d / 0.0018) * broken, exp(-max(side + wobble, 0.0) / 0.006) * step(0.0, side + wobble) * 0.6);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  float l = dot(pic.rgb, ${LUMA});
  // Sepia and fade: a warm monochrome, blacks lifted and highlights dulled.
  vec3 sep = vec3(l) * vec3(1.07, 0.93, 0.74) + vec3(0.04, 0.02, 0.0);
  vec3 col = mix(pic.rgb, sep, uSepia);
  col = mix(col, 0.12 + col * 0.78, uFade);
  // Yellowing in blotches, and foxing: small brown spots with darker rims.
  float blotch = fbm(p * 3.0 + uSeed, 4);
  col *= mix(vec3(1.0), vec3(0.98, 0.9, 0.72), uFoxing * smoothstep(0.45, 0.75, blotch));
  vec2 g = p * 22.0;
  vec2 gi = floor(g);
  vec2 h = hash22(gi + uSeed);
  float fd = length(fract(g) - 0.25 - 0.5 * h);
  float fr = 0.08 + 0.2 * fract(h.x * 11.0);
  float fox = step(hash12(gi + uSeed * 2.0), 0.18 * uFoxing) * (1.0 - smoothstep(0.7 * fr, fr, fd));
  col = mix(col, col * vec3(0.72, 0.52, 0.32), fox * (0.6 + 0.4 * smoothstep(0.5 * fr, fr, fd)));
  // Silvering: a cold metallic sheen in the shadows and near the edges, drifting with the light.
  float edgeD = min(0.5 * aspect - abs(p.x), 0.5 - abs(p.y));
  float where = (1.0 - smoothstep(0.1, 0.5, l)) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 0.2, edgeD)));
  float sheen = 0.5 + 0.5 * sin(dot(p, vec2(2.0, 1.2)) * 3.0 + iTime * 0.35);
  col += vec3(0.32, 0.37, 0.45) * where * sheen * uSilver * 0.6;
  // Creases.
  for (int i = 0; i < 3; i++) {
    vec2 c = crease(p, float(i)) * uCreases;
    col = mix(col, col * 0.75, c.y * 0.5);
    col = mix(col, vec3(0.93, 0.9, 0.82), c.x);
  }
  // Worn edges: the emulsion rubbed off to paper, raggedly.
  float rag = edgeD + (fbm(p * 14.0 + uSeed, 3) - 0.5) * 0.04;
  float worn = 1.0 - smoothstep(0.0, 0.03 + 0.05 * uWear, rag);
  col = mix(col, vec3(0.92, 0.89, 0.8), worn * uWear);
  col += (hash12(fragCoord) - 0.5) * 0.04;
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Daguerreotype", values: { uSepia: 0.3, uSilver: 1, uFade: 0.3 } },
    { name: "Attic find", values: { uFoxing: 1, uCreases: 1, uWear: 0.9 } },
    { name: "Gently aged", values: { uFoxing: 0.2, uCreases: 0, uWear: 0.2, uSilver: 0.1 } },
    { name: "Another print", values: { uSeed: 42 } },
  ],
};

export const filmBurn: ShaderEffect = {
  kind: "shader",
  id: "film-burn",
  name: "Film burn",
  description:
    "A picture as projected film that stutters and stalls in the gate, then blisters and melts open from a hot spot, a glowing charred edge spreading out to the bare projector light, before the next reel starts. Loops; or turn Animate off and set Moment.",
  category: "horror",
  video: "stills",
  tags: ["horror", "decay", "film", "burn", "melt", "projector", "stall", "vintage", "image"],
  loop: 6,
  source: glsl(
    `// Film burn, over a cycle: running (gate weave, flicker), stalled (held, jerking), blistering at a hot spot,
// burning open (a hole with a glowing, charred, warped rim growing to fill the frame), then back to the picture.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uHot;         // @control color default=#FF9A3C label="Burning edge"
uniform vec3 uLamp;        // @control color default=#FFF4DC label="Projector light"
uniform float uWeave;      // @control min=0 max=1 default=0.5 label="Gate weave"
uniform float uMelt;       // @control min=0 max=1 default=0.6 label="Melt"
${CYCLE_CONTROLS(6, 0.62, "Moment")}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float T = uAnimate ? iTime : uProgress * uCycle;
  float cyc = floor(T / uCycle);
  float u = fract(T / uCycle);
  // Running at 24 frames a second until it stalls; then the frame holds and jerks.
  float frame = u < 0.35 ? floor(T * 24.0) : floor((cyc + 0.35) * uCycle * 24.0);
  vec2 weave = (vec2(vnoise(vec2(frame * 0.3, 1.0)), vnoise(vec2(2.0, frame * 0.3))) - 0.5) * 0.006 * uWeave;
  if (u > 0.35 && u < 0.5) weave += (hash22(vec2(floor(T * 8.0), 5.0)) - 0.5) * 0.01;
  // The hot spot, somewhere new each time.
  vec2 hot = (hash22(vec2(cyc, 3.3)) - 0.5) * vec2(0.5 * aspect, 0.5);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 rel = p - hot;
  float dist = length(rel);
  float r = 1.4 * pow(smoothstep(0.5, 0.88, u), 1.6);
  float edge = dist + (fbm(rel * 6.0 + cyc * 7.0, 4) - 0.5) * 0.12 * (0.3 + r);
  // Melting: the film round the hole drawn away from it.
  float near = exp(-max(edge - r, 0.0) / 0.08) * step(0.001, r);
  vec2 st = uv + weave - normalize(rel + 1e-5) * near * 0.04 * uMelt / vec2(aspect, 1.0);
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb * (0.94 + 0.06 * hash12(vec2(frame, 9.0)));
  // Blisters before it opens: bubbles round the spot.
  float blisterZone = smoothstep(0.42, 0.5, u) * (1.0 - smoothstep(0.0, 0.25 + r, dist)) * step(r, edge);
  float bub = smoothstep(0.65, 0.8, vnoise(p * 45.0 + T * 2.0));
  col = mix(col, col * 1.3 + 0.1 * uHot, bub * blisterZone);
  // Char, the glowing edge, then the bare light through the hole.
  float charred = smoothstep(r + 0.06, r + 0.01, edge) * step(0.001, r);
  col = mix(col, vec3(0.05, 0.03, 0.02), charred * 0.85);
  float glow = exp(-abs(edge - r) / 0.012) * step(0.001, r);
  col = mix(col, uHot, clamp(glow, 0.0, 1.0));
  float hole = smoothstep(r, r - 0.01, edge) * step(0.001, r);
  col = mix(col, uLamp * (0.95 + 0.05 * hash12(vec2(floor(T * 24.0), 2.0))), hole);
  // The next reel: back to the running picture.
  float next = smoothstep(0.9, 1.0, u);
  col = mix(col, pic.rgb, next);
  col *= 1.0 - 0.3 * smoothstep(0.35, 0.9, length(uv - 0.5) * 1.3);
  fragColor = vec4(clamp(col, 0.0, 1.0), max(pic.a, (hole + glow) * (1.0 - next)));
}`,
  ),
  presets: [
    { name: "Blue flame", values: { uHot: [0.45, 0.7, 1] } },
    { name: "No melt", values: { uMelt: 0 } },
    { name: "Slow burn", values: { uCycle: 12 } },
    { name: "Burning open", values: { uAnimate: false, uProgress: 0.72 } },
  ],
};

/** The decay shaders. */
export const decayShaders: ShaderEffect[] = [rustSpread, moldBloom, wither, peelingWallpaper, agedPhoto, filmBurn];
