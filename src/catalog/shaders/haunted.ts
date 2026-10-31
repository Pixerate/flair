import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";

/*
 * Haunted interactions: eyes that watch the pointer, and a mirror whose
 * reflection lags behind it or does something of its own. Both answer the
 * pointer while it hovers and play an idle demo otherwise (uDemo). Tagged
 * "interactive", "hover" and "horror".
 */

/** A background under the overlay, clear by default. */
const BACKGROUND_CONTROLS = `
uniform vec3 uBackground;       // @control color default=#0B0A10 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

export const cursorFollowEyes: ShaderEffect = {
  kind: "shader",
  id: "cursor-follow-eyes",
  name: "Cursor-follow eyes",
  description:
    "A row of eyes whose pupils follow the pointer wherever it goes while it hovers, narrowing as it comes close and blinking now and then, wandering on their own while idle; a transparent overlay.",
  category: "interaction",
  transparent: true,
  tags: ["interactive", "hover", "horror", "eyes", "follow", "cursor", "watching", "overlay", "halloween"],
  source: glsl(
    `// Cursor-follow eyes: almond eyes in a row; each pupil is pulled towards the pointer (or a wandering point),
// as far as its iris can travel. The lids close for a blink now and then and narrow when the pointer is near.
uniform vec3 uWhite;       // @control color default=#F2ECE1 label="Whites"
uniform vec3 uIris;        // @control color default=#7A3FB0 label="Iris"
uniform vec3 uLid;         // @control color default=#1B1420 label="Lids"
uniform float uEyes;       // @control min=1 max=6 default=2 step=1 label="Eyes"
uniform float uSize;       // @control min=0.04 max=0.3 default=0.12 label="Size"
uniform float uBlink;      // @control min=0 max=1 default=0.5 label="Blinking"
uniform float uVeins;      // @control min=0 max=1 default=0.4 label="Bloodshot"
uniform bool uDemo;        // @control default=true label="Wander while idle"
${BACKGROUND_CONTROLS}`,
    HASH,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float H = iResolution.y;
  float px = 1.0 / H;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x * px;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 wander = vec2(0.35 * aspect * sin(iTime * 0.6), 0.25 * sin(iTime * 0.9 + 1.0));
  vec2 rest = vec2(0.0, -0.05);
  vec2 target = mix(uDemo ? wander : rest, (iPointer.xy - 0.5 * iResolution.xy) * px, hover);
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  int n = int(uEyes + 0.5);
  float r = uSize;
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = vec2((fi - 0.5 * float(n - 1)) * 2.5 * r, 0.0);
    if (abs(p.x - c.x) > 1.4 * r || abs(p.y - c.y) > r) continue;
    vec2 to = target - c;
    float near = 1.0 - smoothstep(r, 6.0 * r, length(to));
    // Blinks: a quick close every few seconds, each eye on its own beat.
    float beat = fract(iTime / (3.0 + 2.0 * hash12(vec2(fi, 3.0))) + hash12(vec2(fi, 7.0)));
    float blink = mix(1.0, 1.0 - exp(-pow((beat - 0.5) / 0.025, 2.0)), uBlink);
    float open = blink * mix(1.0, 0.55, near * hover);
    vec2 q = (p - c) / r;
    float h = 0.62 * open * max(1.0 - q.x * q.x, 0.0);
    float inside = clamp((h - abs(q.y)) * r / px, 0.0, 1.0) * step(abs(q.x), 1.0);
    float rim = clamp((h + 0.09 - abs(q.y)) * r / px, 0.0, 1.0) * step(abs(q.x), 1.05) * (1.0 - inside);
    // The iris, pulled towards the target as far as it can go; the pupil shrinks as the pointer nears.
    vec2 look = to / r;
    look = look / max(length(look), 1e-4) * min(length(look) * 0.5, 0.45);
    vec2 iq = q - look;
    float id = length(iq);
    float ang = atan(iq.y, iq.x);
    vec3 white = uWhite * (0.75 + 0.25 * (1.0 - q.x * q.x));
    // Bloodshot: thin red threads in from the corners.
    float vein = (1.0 - smoothstep(0.0, 0.04, abs(q.y - 0.18 * sin(q.x * 9.0 + fi) * (1.0 - abs(q.x))))) * smoothstep(0.35, 0.95, abs(q.x));
    white = mix(white, vec3(0.75, 0.12, 0.12), vein * uVeins * 0.7);
    vec3 iris = uIris * (0.65 + 0.35 * sin(ang * 18.0 + fi) * 0.5 + 0.35 * (1.0 - id / 0.42));
    float pupilR = mix(0.2, 0.12, near * hover);
    vec3 eye = mix(white, iris, 1.0 - smoothstep(0.4, 0.43, id));
    eye = mix(eye, vec3(0.02), 1.0 - smoothstep(pupilR - 0.02, pupilR, id));
    eye = mix(eye, vec3(1.0), 1.0 - smoothstep(0.05, 0.075, length(iq - vec2(-0.12, 0.13))));
    // Shadow under the upper lid.
    eye *= 1.0 - 0.35 * smoothstep(0.0, 0.25, q.y / max(h, 1e-3) - 0.4);
    acc = over(acc, uLid, rim);
    acc = over(acc, eye, inside);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Dark", values: { uBackgroundAlpha: 1 } },
    { name: "Many", values: { uEyes: 6, uSize: 0.07 } },
    { name: "Cat", values: { uIris: [0.75, 0.85, 0.15], uVeins: 0 } },
    { name: "Unblinking", values: { uBlink: 0 } },
  ],
};

export const mirrorMismatch: ShaderEffect = {
  kind: "shader",
  id: "mirror-mismatch",
  name: "Mirror mismatch",
  description:
    "A picture beside its reflection in an old framed mirror; both lean towards the pointer, but the reflection follows half a second late, and every so often it stops following and does something of its own.",
  category: "interaction",
  video: "interactive",
  tags: ["interactive", "hover", "horror", "mirror", "reflection", "uncanny", "image"],
  source: glsl(
    `// Mirror mismatch: the picture on the left leans towards the pointer (a small shift and turn); in the mirror on
// the right, flipped, the same lean follows where the pointer was uLag seconds ago (from iTrail). Now and then
// the reflection tilts its own way and holds it before going back.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uFrame;       // @control color default=#4A3626 label="Mirror frame"
uniform vec3 uRoom;        // @control color default=#17131A label="Wall"
uniform vec3 uGlass;       // @control color default=#B9C7D4 label="Glass tint"
uniform float uLag;        // @control min=0.1 max=0.9 default=0.5 label="Lag (s)"
uniform float uOwnMind;    // @control min=0 max=1 default=0.5 label="Mind of its own"
uniform bool uDemo;        // @control default=true label="Lean while idle"`,
    HASH,
    `// Where the pointer was about lag seconds ago, from the trail (or the idle demo's path then).
vec2 pointerAt(float lag, vec2 now) {
  vec2 at = now;
  for (int i = 0; i < 31; i++) {
    if (iTrail[i].w < 0.5) break;
    at = iTrail[i].xy;
    if (iTime - iTrail[i].z >= lag) break;
  }
  return at;
}

vec2 demo(float t) {
  return 0.5 * iResolution.xy + vec2(0.3 * iResolution.x * sin(t * 0.7), 0.2 * iResolution.y * sin(t * 1.1));
}

// A picture cover-fitted to a box of aspect a, at uv in that box (0–1).
vec3 pictureIn(vec2 uv, float a) {
  vec2 size = vec2(textureSize(uImage, 0));
  float ia = size.x > 1.0 ? size.x / size.y : a;
  vec2 scale = a > ia ? vec2(1.0, ia / a) : vec2(a / ia, 1.0);
  return textureSize(uImage, 0).x > 1 ? texture(uImage, 0.5 + (uv - 0.5) * scale).rgb : vec3(0.5);
}

// The picture leaning towards lean (-1–1 each way): shifted and turned a little.
vec3 leaning(vec2 uv, vec2 lean, float a, float turn) {
  vec2 c = uv - 0.5;
  float ang = 0.06 * lean.x + turn;
  c = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * c;
  return pictureIn(0.5 + c / 1.1 + lean * vec2(-0.04, 0.03), a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 idle = uDemo ? demo(iTime) : 0.5 * iResolution.xy;
  vec2 now = mix(idle, iPointer.xy, hover);
  vec2 then = hover > 0.5 ? pointerAt(uLag, iPointer.xy) : (uDemo ? demo(iTime - uLag) : idle);
  vec2 lean = clamp((now / iResolution.xy - 0.5) * 2.0, -1.0, 1.0);
  vec2 leanThen = clamp((then / iResolution.xy - 0.5) * 2.0, -1.0, 1.0);
  // A mind of its own: every few seconds the reflection turns its own way for a moment.
  float beat = fract(iTime / 7.0);
  float own = smoothstep(0.55, 0.6, beat) * (1.0 - smoothstep(0.78, 0.84, beat)) * step(hash12(vec2(floor(iTime / 7.0), 2.0)), uOwnMind);
  vec3 col = uRoom;
  // The picture, left.
  vec2 a = (uv - vec2(0.04, 0.12)) / vec2(0.42, 0.76);
  float boxA = (aspect * 0.42) / 0.76;
  if (all(greaterThanEqual(a, vec2(0.0))) && all(lessThanEqual(a, vec2(1.0)))) col = leaning(a, lean, boxA, 0.0);
  // The mirror, right: frame, then the flipped, lagging reflection under a cool glass tint and sheen.
  vec2 m = (uv - vec2(0.54, 0.12)) / vec2(0.42, 0.76);
  vec2 mf = (uv - vec2(0.54, 0.12) + vec2(0.02 / aspect, 0.02)) / vec2(0.42 + 0.04 / aspect, 0.76 + 0.04);
  if (all(greaterThanEqual(mf, vec2(0.0))) && all(lessThanEqual(mf, vec2(1.0)))) col = uFrame * (0.7 + 0.3 * sin(mf.y * 40.0) * 0.3 + 0.3 * mf.x);
  if (all(greaterThanEqual(m, vec2(0.0))) && all(lessThanEqual(m, vec2(1.0)))) {
    vec2 flipped = vec2(1.0 - m.x, m.y);
    vec3 refl = leaning(flipped, vec2(-leanThen.x, leanThen.y), boxA, own * 0.22);
    refl = mix(refl, refl * uGlass, 0.45) * 0.88;
    refl += 0.08 * smoothstep(0.0, 0.05, 0.05 - abs(m.x - m.y * 0.6 - 0.2));
    col = refl;
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Slow", values: { uLag: 0.9 } },
    { name: "Obedient", values: { uOwnMind: 0, uLag: 0.15 } },
    { name: "Gilt frame", values: { uFrame: [0.7, 0.55, 0.25], uRoom: [0.1, 0.08, 0.06] } },
  ],
};

/** The haunted interaction shaders. */
export const hauntedShaders: ShaderEffect[] = [cursorFollowEyes, mirrorMismatch];
