import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Creatures: horror effects with something alive in them. Tentacles curling
 * up out of the dark and reaching for the pointer, a swarm of bats wheeling
 * across a dusk sky, and a tall figure walking once across a picture. Each is
 * tagged "horror" and "creature".
 */

/** `segDist(p, a, b)` and `segT(p, a, b)`: the distance from p to segment ab, and how far along it is nearest (0–1). */
const SEGMENT = `
float segT(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  return clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
}
float segDist(vec2 p, vec2 a, vec2 b) {
  return length(p - a - (b - a) * segT(p, a, b));
}`.trim();

export const tentacles: ShaderEffect = {
  kind: "shader",
  id: "tentacles",
  name: "Tentacles",
  description:
    "Tentacles curling up out of the dark from the bottom of the frame, swaying and coiling at their tips, rows of pale suckers on their undersides, and reaching for the pointer while it hovers.",
  category: "horror",
  tags: ["horror", "creature", "tentacles", "kraken", "eldritch", "interactive", "hover", "background"],
  source: glsl(
    `// Tentacles: each a chain of segments from a base on the bottom edge, its heading turned a little at every joint
// (a sway travelling up it, a curl growing towards the tip, and a pull towards the pointer while it hovers). The
// nearest segment gives how far along and across the tentacle a point is, for its taper, shading and suckers.
uniform vec3 uBackground;  // @control color default=#07060B label="Background"
uniform vec3 uColor;       // @control color default=#4A2E5C label="Skin"
uniform vec3 uUnder;       // @control color default=#D9A3B5 label="Underside"
uniform vec3 uRim;         // @control color default=#8EF0C6 label="Rim light"
uniform float uCount;      // @control min=1 max=7 default=5 step=1 label="Tentacles"
uniform float uLength;     // @control min=0.3 max=1.4 default=0.95 label="Length"
uniform float uWidth;      // @control min=10 max=90 default=42 label="Thickness"
uniform float uCurl;       // @control min=0 max=1 default=0.6 label="Curl"
uniform float uReach;      // @control min=0 max=1 default=0.7 label="Reach for the pointer"
uniform float uSpeed;      // @control min=0 max=2 default=0.6 label="Speed"`,
    HASH,
    SEGMENT,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x / iResolution.y;
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  float best = 1e5;
  float along = 0.0;
  float across = 0.0;
  int n = int(uCount + 0.5);
  for (int i = 0; i < 7; i++) {
    if (i >= n) break;
    float fi = float(i);
    float bx = ((fi + 0.5) / float(n) - 0.5) * aspect * 0.9 + (hash12(vec2(fi, 3.0)) - 0.5) * 0.1;
    vec2 pos = vec2(bx, -0.56);
    // Too far from its base for this one to reach.
    if (length(p - pos) > uLength + 0.12) continue;
    float ang = 1.5708 + 0.3 * sin(t * 0.5 + fi * 1.7) + (bx / aspect) * -0.6;
    float seg = uLength / 20.0;
    float turn = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    for (int k = 0; k < 20; k++) {
      float fk = float(k) / 20.0;
      ang += uCurl * (0.13 * sin(t * 1.3 + fk * 4.0 + fi * 2.3) * (0.4 + fk) + turn * 0.22 * fk * fk);
      if (hover > 0.0) {
        float toward = atan(pointer.y - pos.y, pointer.x - pos.x) - ang;
        toward = mod(toward + 3.14159, 6.28318) - 3.14159;
        ang += hover * uReach * 0.07 * fk * toward;
      }
      // The rest of it cannot come closer than what is already nearest (or than the halo's reach): stop.
      if (length(p - pos) - float(20 - k) * seg - uWidth * 0.001 > min(best, 0.12)) break;
      vec2 next = pos + seg * vec2(cos(ang), sin(ang));
      float h = segT(p, pos, next);
      vec2 off = p - pos - (next - pos) * h;
      float w = uWidth * 0.001 * (1.0 - 0.85 * (fk + h / 20.0));
      float sd = length(off) - w;
      if (sd < best) {
        best = sd;
        along = fk + h / 20.0;
        vec2 dir = normalize(next - pos);
        across = clamp((dir.x * off.y - dir.y * off.x) / max(w, 1e-4), -1.0, 1.0) * turn;
      }
      pos = next;
    }
  }
  vec3 col = uBackground;
  // A dark halo where they block the faint light behind.
  col *= 1.0 - 0.5 * exp(-max(best, 0.0) / 0.03);
  float inside = clamp(0.5 - best / px, 0.0, 1.0);
  if (inside > 0.0) {
    float round_ = sqrt(max(1.0 - across * across, 0.0));
    vec3 skin = uColor * (0.35 + 0.75 * round_) * (0.8 + 0.2 * sin(along * 60.0));
    // The underside (one edge) is paler, with a row of suckers.
    float under = smoothstep(0.1, 0.6, -across);
    skin = mix(skin, uUnder * (0.5 + 0.5 * round_), under * 0.75);
    vec2 sucker = vec2((fract(along * 26.0) - 0.5) * 2.2, (-across - 0.62) * 3.0);
    float sd = length(sucker);
    float cup = (1.0 - smoothstep(0.55, 0.75, sd)) * step(along, 0.92);
    skin = mix(skin, uUnder * 1.15, cup * 0.8);
    skin = mix(skin, uColor * 0.25, (1.0 - smoothstep(0.2, 0.35, sd)) * cup);
    skin += uRim * smoothstep(0.55, 0.95, across) * 0.55;
    col = mix(col, skin, inside);
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Deep sea", values: { uColor: [0.75, 0.2, 0.18], uUnder: [1, 0.78, 0.68], uRim: [0.4, 0.75, 1], uBackground: [0.01, 0.03, 0.07] } },
    { name: "Eldritch", values: { uColor: [0.12, 0.2, 0.14], uUnder: [0.6, 0.8, 0.45], uRim: [0.85, 0.4, 1], uCount: 7, uCurl: 1 } },
    { name: "One arm", values: { uCount: 1, uLength: 1.3, uWidth: 80 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0 } },
  ],
};

export const batSwarm: ShaderEffect = {
  kind: "shader",
  id: "bat-swarm",
  name: "Bat swarm",
  description:
    "A swarm of bats wheeling across a dusk sky past a full moon, each flapping on its own beat as the flock sweeps back and forth, scattering away from the pointer while it hovers.",
  category: "horror",
  tags: ["horror", "creature", "bats", "swarm", "flock", "halloween", "moon", "interactive", "hover", "background"],
  source: glsl(
    `// Bat swarm: the flock's middle sweeps on a slow figure of eight; each bat circles it at its own radius and speed.
// A bat is a body and two scalloped wings whose tips rise and fall with its flap. Near the pointer they scatter.
uniform vec3 uBackground;  // @control color default=#1A1030 label="Sky"
uniform vec3 uHorizon;     // @control color default=#5A2A3A label="Horizon"
uniform vec3 uBat;         // @control color default=#050308 label="Bats"
uniform vec3 uMoon;        // @control color default=#F4E9C9 label="Moon"
uniform float uMoonSize;   // @control min=0 max=0.3 default=0.13 label="Moon size"
uniform float uCount;      // @control min=3 max=40 default=26 step=1 label="Bats"
uniform float uSize;       // @control min=0.3 max=2.5 default=1 label="Size"
uniform float uSpeed;      // @control min=0.2 max=2 default=1 label="Speed"
uniform float uScatter;    // @control min=0 max=1 default=0.7 label="Scatter from the pointer"`,
    HASH,
    `// A bat facing the viewer at q (units of its wingspan's half), wings flapping f (-1 down to 1 up).
float bat(vec2 q, float f, float px) {
  float ax = abs(q.x);
  float body = length(q / vec2(0.13, 0.3)) - 1.0;
  float head = length(q - vec2(0.0, 0.22)) - 0.1;
  float ears = max(abs(ax - 0.06) - 0.03 + (q.y - 0.3) * 0.25, abs(q.y - 0.33) - 0.06);
  float a = clamp(min(min(body * 0.13, head), ears) / px, -1.0, 1.0);
  float cover = 0.5 - 0.5 * a;
  // A wing between its leading edge (rising to the tip as it flaps) and its scalloped trailing edge.
  if (ax > 0.08 && ax < 1.0) {
    float top = 0.1 + f * 0.55 * (ax - 0.08) - 0.15 * (ax - 0.08) * (ax - 0.08);
    float bottom = top - 0.32 * (1.0 - ax) - 0.04 + 0.09 * abs(sin(ax * 9.42));
    float wing = min(top - q.y, q.y - bottom);
    cover = max(cover, clamp(wing / px + 0.5, 0.0, 1.0));
  }
  return cover;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  // The dusk sky and the moon.
  vec3 col = mix(uHorizon, uBackground, smoothstep(0.0, 0.8, uv.y));
  vec2 moonAt = vec2(0.28 * aspect, 0.22);
  float md = length(p - moonAt);
  col = mix(col, uMoon, (1.0 - smoothstep(uMoonSize - 0.002, uMoonSize, md)) * step(0.001, uMoonSize));
  col += uMoon * 0.25 * exp(-max(md - uMoonSize, 0.0) / 0.08) * step(0.001, uMoonSize);
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec2 middle = vec2(0.42 * aspect * sin(t * 0.21), 0.14 * sin(t * 0.42) + 0.08);
  float cover = 0.0;
  int n = int(uCount + 0.5);
  for (int i = 0; i < 40; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi * 1.7, 9.1));
    float a = t * (0.6 + 0.8 * h.x) * (h.y < 0.5 ? 1.0 : -1.0) + h.y * 6.28318;
    float r = 0.06 + 0.3 * fract(h.x * 7.0);
    vec2 pos = middle + vec2(cos(a), 0.55 * sin(a)) * r + 0.03 * vec2(sin(t * 1.7 + fi), sin(t * 2.3 + fi * 2.0));
    vec2 away = pos - pointer;
    pos += normalize(away + 1e-4) * hover * uScatter * 0.18 * exp(-length(away) / 0.15);
    float s = (0.022 + 0.018 * fract(h.y * 13.0)) * uSize;
    if (length(p - pos) > 1.2 * s) continue;
    float flap = sin(t * (11.0 + 5.0 * h.x) + fi * 3.0);
    cover = max(cover, bat((p - pos) / s, flap, 1.0 / (iResolution.y * s)));
  }
  col = mix(col, uBat, cover);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Blood moon", values: { uMoon: [0.95, 0.35, 0.22], uBackground: [0.1, 0.02, 0.04], uHorizon: [0.35, 0.06, 0.05] } },
    { name: "Colony", values: { uCount: 40, uSize: 0.6 } },
    { name: "A few big ones", values: { uCount: 6, uSize: 2.2, uMoonSize: 0.2 } },
    { name: "Transparent", values: { uBackgroundAlpha: 0, uMoonSize: 0 } },
  ],
};

export const passingSilhouette: ShaderEffect = {
  kind: "shader",
  id: "passing-silhouette",
  name: "Passing silhouette",
  description:
    "A tall, thin figure walking once across the back of a picture, long arms swinging, then gone until the next time round; easy to miss.",
  category: "horror",
  video: "filter",
  tags: ["horror", "creature", "silhouette", "figure", "walking", "background", "slender", "image"],
  loop: 12,
  source: glsl(
    `// Passing silhouette: a stick-proportioned figure (head, thin torso, swinging legs and long arms, each a capsule)
// walking along the ground line once per cycle, then off the frame for the rest of it.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uColor;       // @control color default=#050407 label="Figure"
uniform float uGround;     // @control min=-0.5 max=0.4 default=-0.24 label="Ground line"
uniform float uSize;       // @control min=0.1 max=1 default=0.42 label="Height"
uniform float uOpacity;    // @control min=0 max=1 default=0.9 label="Opacity"
uniform float uSoftness;   // @control min=0 max=1 default=0.3 label="Softness"
uniform float uCycle;      // @control min=4 max=40 default=12 label="Cycle (s)"
uniform float uWalk;       // @control min=2 max=20 default=6 label="Seconds to cross"
uniform bool uLeftToRight; // @control default=true label="Left to right"
${BACKDROP_CONTROLS}`,
    PICTURE,
    SEGMENT,
    `float limb(vec2 q, vec2 a, vec2 b, float r) {
  return segDist(q, a, b) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  float T = mod(iTime, uCycle);
  float s = T / max(uWalk, 0.1);
  float cover = 0.0;
  if (s < 1.0) {
    float x = mix(-0.5 * aspect - 0.25 * uSize, 0.5 * aspect + 0.25 * uSize, s);
    if (!uLeftToRight) x = -x;
    // About a stride a second, rising a little on each.
    float stride = T * 3.14159 * 1.1;
    vec2 q = (p - vec2(x, uGround)) / uSize;
    q.y -= 0.012 * abs(sin(stride));
    if (!uLeftToRight) q.x = -q.x;
    float swing = 0.32 * sin(stride);
    vec2 hip = vec2(0.0, 0.5);
    vec2 shoulder = vec2(0.02, 0.8);
    float d = length(q - vec2(0.03, 0.9)) - 0.055;
    d = min(d, limb(q, hip, shoulder, 0.045));
    // Legs, a knee bending on the way forward.
    for (int k = 0; k < 2; k++) {
      float sw = k == 0 ? swing : -swing;
      vec2 knee = hip + 0.25 * vec2(sin(sw + 0.1), -cos(sw + 0.1));
      vec2 foot = knee + 0.25 * vec2(sin(sw - 0.25 * max(sw, 0.0)), -cos(sw - 0.25 * max(sw, 0.0)));
      d = min(d, min(limb(q, hip, knee, 0.028), limb(q, knee, foot, 0.022)));
      // Arms, too long, swinging against the legs.
      vec2 elbow = shoulder + 0.26 * vec2(sin(-sw * 0.7), -cos(-sw * 0.7));
      vec2 hand = elbow + 0.28 * vec2(sin(-sw * 0.9 + 0.1), -cos(-sw * 0.9 + 0.1));
      d = min(d, min(limb(q, shoulder, elbow, 0.02), limb(q, elbow, hand, 0.016)));
    }
    float soft = (1.0 / iResolution.y + 0.01 * uSoftness) / uSize;
    cover = 1.0 - smoothstep(-soft, soft, d);
  }
  vec3 col = mix(pic.rgb, uColor, cover * uOpacity);
  fragColor = vec4(col, max(pic.a, cover * uOpacity));
}`,
  ),
  presets: [
    { name: "Closer", values: { uSize: 0.75, uGround: -0.45 } },
    { name: "Shadow", values: { uOpacity: 0.55, uSoftness: 0.8 } },
    { name: "Right to left", values: { uLeftToRight: false } },
    { name: "Slow walk", values: { uWalk: 12, uCycle: 20 } },
  ],
};

/** The creature shaders. */
export const creatureShaders: ShaderEffect[] = [tentacles, batSwarm, passingSilhouette];
