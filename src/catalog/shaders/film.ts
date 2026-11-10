import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Film shaders: the medium itself rather than a look graded onto a picture.
 * A picture running through a strip of film between its sprocket holes, a
 * battered print (scratches, dust, hair, splices and cue marks) and a
 * letterbox that slams in with the grade and push-in of a trailer's big
 * moment. Each is tagged "film"; the cinema projector, the academy leader
 * and the plain letterbox live in this category too.
 */

/** `fitInto(tex, uv, aspect)`: uv in a window of `aspect` (width ÷ height) mapped so the image covers it. Needs a sampler. */
const FIT_INTO = `
vec2 fitInto(sampler2D tex, vec2 uv, float aspect) {
  vec2 size = vec2(textureSize(tex, 0));
  float imageAspect = size.x > 1.0 ? size.x / size.y : aspect;
  vec2 scale = aspect > imageAspect ? vec2(1.0, imageAspect / aspect) : vec2(aspect / imageAspect, 1.0);
  return 0.5 + (uv - 0.5) * scale;
}`.trim();

export const filmStrip: ShaderEffect = {
  kind: "shader",
  id: "film-strip",
  name: "Film strip",
  description:
    "A picture running through a strip of film: frame after frame of it sliding past between rows of sprocket holes, with frame lines, printed edge marks along the margin and a little dust and flicker, lit from behind as on a lightbox; upright or across, tilted if you like, or as an orange-based negative.",
  category: "film",
  video: "filter",
  tags: ["film", "cinema", "sprockets", "film-strip", "35mm", "negative", "vintage", "image"],
  source: glsl(
    `// Film strip: in the strip's own coordinates (across, along) the strip is uWidth wide; its margins hold four
// sprocket holes a frame, the window between them shows the picture cover-fitted to uFrameAspect, and the whole
// strip runs at uSpeed frames a second. Holes and the space round the strip show the backdrop, like film on a lightbox.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uDirection;       // @control min=0 max=1 default=0 label="Direction (0 runs up, 1 runs across)"
uniform float uSpeed;         // @control min=-4 max=4 default=0.6 step=0.05 label="Frames a second"
uniform float uWidth;         // @control min=0.3 max=1 default=0.62 label="Strip width"
uniform float uAngle;         // @control min=-45 max=45 default=0 step=1 label="Tilt (degrees)"
uniform float uFrameAspect;   // @control min=1 max=2.4 step=0.01 default=1.5 label="Frame aspect ratio"
uniform vec3 uBase;           // @control color default=#17110E label="Film base"
uniform vec3 uEdge;           // @control color default=#E0963A label="Edge marks"
uniform bool uNegative;       // @control default=false label="Negative"
uniform float uWear;          // @control min=0 max=1 default=0.35 label="Wear"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    FIT_INTO,
    `float roundBox(vec2 p, vec2 hs, float r) {
  vec2 q = abs(p) - hs + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float a = radians(uAngle);
  p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
  bool across = uDirection == 1;
  // s.x across the strip, s.y along it.
  vec2 s = across ? vec2(p.y, p.x) : p;
  vec4 surround = vec4(uBackdrop, uBackdropAlpha);

  float w = uWidth;
  float margin = 0.15 * w;
  float win = w - 2.0 * margin;
  float frameLen = across ? win * uFrameAspect : win / uFrameAspect;
  float gap = 0.07 * win;
  float pitch = frameLen + gap;
  float along = s.y - iTime * uSpeed * pitch;
  float k = floor(along / pitch);
  float f = along - k * pitch;

  // The film base, a little lighter down its middle.
  vec3 base = uBase * (0.8 + 0.3 * cos(s.x / w * 3.14159));
  vec4 film = vec4(base, 1.0);

  // Edge marks between one row of holes and the picture: dashes that change from frame to frame.
  float band = s.x - (win * 0.5 + margin * 0.08);
  float mark = step(0.0, band) * step(band, margin * 0.12);
  float dash = step(0.45, hash12(vec2(k, floor(f / (pitch / 14.0)))));
  film.rgb = mix(film.rgb, uEdge, 0.75 * mark * dash);

  // The picture in its window, frame lines between.
  vec2 local = vec2(s.x / win + 0.5, (f - 0.5 * gap) / frameLen);
  float window = max(abs(s.x) - 0.5 * win, abs(f - 0.5 * pitch) - 0.5 * frameLen);
  float inWindow = 1.0 - smoothstep(-px, px, window);
  vec2 uv = across ? vec2(local.y, local.x) : local;
  vec4 pic = pictureRGBA(uImage, fitInto(uImage, uv, uFrameAspect));
  vec3 col = pic.rgb;
  if (uNegative) col = (1.0 - col) * vec3(1.0, 0.66, 0.42) + vec3(0.08, 0.03, 0.0);
  // Wear: each frame flickers a little and carries its own dust, which travels with it.
  col *= 1.0 - uWear * 0.18 * hash12(vec2(k, 3.0));
  for (int i = 0; i < 3; i++) {
    vec3 h = vec3(hash22(vec2(k, float(i) * 7.1)), hash12(vec2(k, float(i) + 40.0)));
    if (h.z > uWear) continue;
    float r = (0.004 + 0.01 * h.x) * win;
    float speck = 1.0 - smoothstep(r - px, r + px, length((local - h.xy) * vec2(win, frameLen)));
    col = mix(col, vec3(0.04), 0.8 * speck);
  }
  float scratch = (hash12(vec2(floor(k / 5.0), 9.0)) - 0.5) * win * 0.8;
  col += uWear * 0.35 * (1.0 - smoothstep(0.0, 1.5 * px, abs(s.x - scratch)));
  vec4 frameRGBA = vec4(col, pic.a);
  film = mix(film, frameRGBA, inWindow);

  // Four sprocket holes a frame in each margin.
  float perf = pitch / 4.0;
  vec2 hp = vec2(abs(s.x) - (0.5 * w - 0.5 * margin), mod(along, perf) - 0.5 * perf);
  vec2 hole = vec2(margin * 0.27, perf * 0.3);
  float inHole = 1.0 - smoothstep(-px, px, roundBox(hp, hole, 0.3 * min(hole.x, hole.y)));
  film = mix(film, surround, inHole);

  float inStrip = 1.0 - smoothstep(-px, px, abs(s.x) - 0.5 * w);
  fragColor = mix(surround, film, inStrip);
}`,
  ),
  presets: [
    { name: "Across", values: { uDirection: 1, uWidth: 0.5 } },
    { name: "Negative", values: { uNegative: true, uBase: [0.52, 0.24, 0.1] } },
    { name: "Tilted", values: { uAngle: -14, uWidth: 0.55, uSpeed: 1.2 } },
    { name: "Dark room", values: { uBackdrop: [0.05, 0.05, 0.07] } },
    { name: "Overlay", values: { uBackdropAlpha: 0 } },
  ],
};

export const filmDamage: ShaderEffect = {
  kind: "shader",
  id: "film-damage",
  name: "Film damage",
  description:
    "A picture as a battered old print: scratches running down it that come and go, dust and the odd hair flashing past for a frame, emulsion blotches, flicker and a faded colour, the frame jumping at bad splices and a cue mark blinking in the corner.",
  category: "film",
  video: "filter",
  tags: ["film", "cinema", "scratches", "dust", "damage", "vintage", "grain", "projector", "image"],
  source: glsl(
    `// Film damage, a 24 fps frame at a time: up to four scratches (each lasting a while, jittering), dust specks,
// a hair now and then, blotches of lost emulsion, flicker, and in each half second a chance of a splice that
// jumps the picture with its frame line showing. Cue marks show for four frames at 0 s and 7 s of every 10.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uScratches;   // @control min=0 max=1 default=0.6 label="Scratches"
uniform float uDust;        // @control min=0 max=1 default=0.5 label="Dust and hair"
uniform float uBlotches;    // @control min=0 max=1 default=0.3 label="Blotches"
uniform float uFlicker;     // @control min=0 max=1 default=0.4 label="Flicker"
uniform float uJumps;       // @control min=0 max=1 default=0.3 label="Splices and jumps"
uniform bool uCueMarks;     // @control default=true label="Cue marks"
uniform float uFade;        // @control min=0 max=1 default=0.35 label="Faded print"
uniform float uGrain;       // @control min=0 max=1 default=0.35 label="Grain"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float px = 1.0 / iResolution.y;
  float frame = floor(iTime * 24.0);

  // A splice: for the first few frames of a half second, the picture jumps and its frame line shows.
  float seg = floor(iTime * 2.0);
  float into = frame - floor(seg * 12.0);
  float jump = step(hash12(vec2(seg, 5.0)), uJumps * 0.45) * step(into, 2.0);
  float offset = jump * (hash12(vec2(seg, 6.0)) - 0.5) * 0.5;
  vec2 weave = (hash22(vec2(frame, 1.0)) - 0.5) * vec2(0.002, 0.003);
  float v = fract(uv.y + offset + weave.y);
  vec4 pic = pictureRGBA(uImage, vec2(uv.x + weave.x, v));
  vec3 col = pic.rgb;
  float line = jump * (1.0 - smoothstep(0.0, 0.02, min(v, 1.0 - v)));
  col = mix(col, vec3(0.02), line);

  // A faded print: warmer, pinker and flatter.
  col = mix(col, col * vec3(1.06, 0.84, 0.88) + vec3(0.07, 0.03, 0.05), uFade);
  col = mix(col, vec3(0.55), 0.18 * uFade);
  col *= 1.0 + uFlicker * (hash12(vec2(frame, 2.0)) - 0.5) * 0.28;

  vec2 p = vec2(uv.x * aspect, uv.y);
  // Scratches down the frame: each slot holds one for a while, jittering a pixel or two from frame to frame.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float life = floor(frame / (14.0 + 9.0 * fi));
    if (hash12(vec2(life, fi + 10.0)) > uScratches) continue;
    float x = hash12(vec2(life, fi + 20.0)) * aspect + (hash12(vec2(frame, fi + 30.0)) - 0.5) * 0.004 + 0.003 * sin(uv.y * 9.0 + fi);
    float top = hash12(vec2(life, fi + 40.0));
    float span = step(uv.y, max(top, 0.6)) * step(min(top, 0.4) - 0.4, uv.y);
    float s = (1.0 - smoothstep(0.0, (0.8 + fi * 0.4) * px, abs(p.x - x))) * span * (0.5 + 0.5 * hash12(vec2(frame, fi + 50.0)));
    col = mix(col, hash12(vec2(life, fi + 60.0)) > 0.35 ? vec3(0.95) : vec3(0.05), 0.75 * s);
  }
  // Dust: specks for a frame each, mostly dark, a few light.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (hash12(vec2(frame, fi + 70.0)) > uDust) continue;
    vec2 c = hash22(vec2(frame, fi * 3.7)) * vec2(aspect, 1.0);
    float r = 0.002 + 0.007 * hash12(vec2(frame, fi + 80.0));
    vec2 d = p - c;
    float rough = r * (0.7 + 0.6 * vnoise(vec2(atan(d.y, d.x) * 2.0, fi + frame)));
    float speck = 1.0 - smoothstep(rough - px, rough + px, length(d));
    col = mix(col, hash12(vec2(frame, fi + 90.0)) > 0.8 ? vec3(0.9) : vec3(0.03), 0.85 * speck);
  }
  // A hair caught for a frame: a thin wavy curl.
  if (hash12(vec2(frame, 100.0)) < uDust * 0.12) {
    vec2 c = hash22(vec2(frame, 101.0)) * vec2(aspect, 1.0);
    float a = hash12(vec2(frame, 102.0)) * 6.28318;
    vec2 d = mat2(cos(a), sin(a), -sin(a), cos(a)) * (p - c);
    float hair = abs(d.y - 0.025 * sin(d.x * 38.0) - 0.4 * d.x * d.x);
    col = mix(col, vec3(0.03), 0.8 * (1.0 - smoothstep(0.0, 1.5 * px, hair)) * step(abs(d.x), 0.09));
  }
  // A blotch where the emulsion came away.
  if (hash12(vec2(frame, 110.0)) < uBlotches * 0.25) {
    vec2 c = hash22(vec2(frame, 111.0)) * vec2(aspect, 1.0);
    float blob = smoothstep(0.55, 0.62, vnoise((p - c) * 14.0 + frame) * (1.0 - smoothstep(0.03, 0.12, length(p - c))) * 1.6);
    col = mix(col, vec3(0.92, 0.86, 0.72), 0.7 * blob);
  }
  // Cue marks: a ringed dot near the top right corner for four frames, twice in ten seconds.
  float cycle = mod(iTime, 10.0);
  if (uCueMarks && (cycle < 4.0 / 24.0 || abs(cycle - 7.0 - 2.0 / 24.0) < 2.0 / 24.0)) {
    float d = length(p - vec2(aspect - 0.12, 0.86));
    col = mix(col, vec3(0.04), 1.0 - smoothstep(0.024, 0.024 + px, d));
    col = mix(col, vec3(0.85), (1.0 - smoothstep(0.0, 1.5 * px, abs(d - 0.026))) * 0.8);
  }
  col += (hash12(fragCoord + frame * vec2(17.31, 31.73)) - 0.5) * 0.14 * uGrain;
  col *= 1.0 - 0.3 * smoothstep(0.45, 0.95, length((uv - 0.5) * vec2(aspect / 1.3, 1.0)));
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Grindhouse", values: { uScratches: 1, uDust: 0.9, uBlotches: 0.7, uJumps: 0.6, uFade: 0.6, uGrain: 0.6 } },
    { name: "Archive", values: { uScratches: 0.4, uDust: 0.3, uBlotches: 0.15, uJumps: 0.1, uFade: 0.8, uFlicker: 0.6 } },
    { name: "Light wear", values: { uScratches: 0.25, uDust: 0.2, uBlotches: 0, uJumps: 0, uCueMarks: false, uFade: 0.1 } },
  ],
};

export const dramaticLetterbox: ShaderEffect = {
  kind: "shader",
  id: "dramatic-letterbox",
  name: "Dramatic letterbox",
  description:
    "A picture's big moment: cinema bars slam in from the top and bottom, bouncing and shaking the frame as they land, while the picture pushes slowly in and the grade turns moody, contrasty and teal and orange; then it all eases back. Loops; or turn Animate off and set Progress.",
  category: "film",
  video: "filter",
  tags: ["film", "cinematic", "letterbox", "dramatic", "trailer", "aspect-ratio", "grade", "image"],
  loop: 6,
  source: glsl(
    `// Dramatic letterbox over 6 s: at 0.6 s the bars slam in (accelerating, then bouncing and shaking for uSlam),
// the grade fades in and the picture pushes in until 5 s, then everything eases back out by 5.8 s.
// Still, Progress sets bars, grade and push together.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uAspect;        // @control min=1 max=3 step=0.01 default=2.39 label="Aspect ratio (width ÷ height)"
uniform vec3 uBar;            // @control color default=#000000 label="Bar colour"
uniform float uSlam;          // @control min=0 max=1 default=0.6 label="Slam (bounce and shake)"
uniform float uPush;          // @control min=0 max=0.25 default=0.08 label="Push in"
uniform float uGrade;         // @control min=0 max=1 default=0.7 label="Grade"
uniform vec3 uShadowTint;     // @control color default=#0F4C5C label="Shadow tint"
uniform vec3 uHighlightTint;  // @control color default=#FFB26B label="Highlight tint"
uniform bool uAnimate;        // @control default=true label="Animate"
uniform float uProgress;      // @control min=0 max=1 default=1 label="Progress (when still)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 size = iResolution.xy;
  float bars = uProgress;
  float grade = uProgress;
  float push = uProgress;
  vec2 shake = vec2(0.0);
  if (uAnimate) {
    float c = mod(iTime, 6.0);
    float x = clamp((c - 0.6) / 0.3, 0.0, 1.0);
    float landed = max(c - 0.9, 0.0);
    float bounce = c > 0.9 ? uSlam * 0.16 * exp(-landed * 9.0) * sin(landed * 28.0) : 0.0;
    bars = (x * x + bounce) * (1.0 - smoothstep(5.0, 5.5, c));
    grade = smoothstep(0.6, 1.2, c) * (1.0 - smoothstep(5.0, 5.6, c));
    push = c < 5.0 ? smoothstep(0.6, 5.0, c) : 1.0 - smoothstep(5.0, 5.8, c);
    if (c > 0.9) shake = uSlam * 0.01 * exp(-landed * 7.0) * vec2(sin(landed * 61.0), sin(landed * 47.0 + 1.0));
  }

  vec4 pic = pictureRGBA(uImage, 0.5 + (uv - 0.5) / (1.0 + uPush * push) + shake);
  vec3 col = pic.rgb;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float g = grade * uGrade;
  col = mix(col, vec3(lum), 0.35 * g);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.7 * g);
  col += g * 0.3 * (mix(uShadowTint, uHighlightTint, smoothstep(0.15, 0.85, lum)) - 0.5);
  col *= 1.0 - g * (0.12 + 0.35 * smoothstep(0.35, 0.9, length((uv - 0.5) * vec2(size.x / size.y / 1.5, 1.0))));

  // Bars outside an opening of the aspect ratio: top and bottom for a wider one, at the sides for a narrower.
  bool pillar = uAspect < size.x / size.y;
  float pos = pillar ? fragCoord.x : fragCoord.y;
  float extent = pillar ? size.x : size.y;
  float opening = pillar ? size.y * uAspect : size.x / uAspect;
  float bar = max(0.0, extent - opening) * 0.5 * max(bars, 0.0);
  float cover = 1.0 - smoothstep(-0.5, 0.5, min(pos - bar, extent - bar - pos));
  float alpha = mix(pic.a, 1.0, cover);
  fragColor = vec4(mix(clamp(col, 0.0, 1.0), uBar, cover), alpha);
}`,
  ),
  presets: [
    { name: "Scope slam", values: { uAspect: 2.39, uSlam: 0.8 } },
    { name: "Ultra wide", values: { uAspect: 2.76, uPush: 0.12 } },
    { name: "Noir", values: { uShadowTint: [0.1, 0.1, 0.12], uHighlightTint: [0.85, 0.85, 0.9], uGrade: 1 } },
    { name: "Gentle", values: { uSlam: 0, uGrade: 0.4, uPush: 0.04 } },
  ],
};

export const filmShaders: ShaderEffect[] = [filmStrip, filmDamage, dramaticLetterbox];
