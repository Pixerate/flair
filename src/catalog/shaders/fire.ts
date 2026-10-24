import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Fire is heat: a number, 0 (nothing) to 1 (white-hot), turned into light by
 * a ramp from the tips' deep red through the flame's orange to its hot core.
 * Heat comes from where something burns (a frame, letters, a ball, logs),
 * carried upward by warped noise scrolling up, so tongues lick, split and
 * curl rather than wave. Most draw on clear (alpha is the light's brightest
 * channel), so they burn over any page, with a background a control away.
 */

/** The flame's three colours, cool tips to hot core. */
const FIRE_COLOURS = `
uniform vec3 uHot;              // @control color default=#FFF2BF label="Core"
uniform vec3 uMid;              // @control color default=#FF8A1C label="Flame"
uniform vec3 uCool;             // @control color default=#C0230C label="Tips"`.trim();

/** A background for the fires drawn on clear, off by default. */
const FIRE_BACKGROUND = `
uniform vec3 uBackground;       // @control color default=#0B0503 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

/** `fireBase()`: the background of {@link FIRE_BACKGROUND} at its opacity, premultiplied, to draw fire over. */
const FIRE_BASE = `
vec4 fireBase() {
  return vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
}`.trim();

/**
 * Fire, shared: `fireLight(heat)` (the light of heat 0–1, brighter as it gets
 * hotter), `flameNoise(p, t)` (warped fractal noise, about 0–1, scrolling up
 * with `t`, for tongues), `sparks(p, t, amount)` (rising sparks' brightness:
 * cells of a grid drifting up, one swaying spark in some of them) and
 * `fireOver(base, light)` (light over a premultiplied base, as the output).
 * Needs {@link HASH}, {@link NOISE}, {@link FBM} and the uniforms of
 * {@link FIRE_COLOURS}.
 */
const FIRE = `
vec3 fireLight(float h) {
  h = clamp(h, 0.0, 1.0);
  vec3 c = uCool * smoothstep(0.0, 0.2, h);
  c = mix(c, uMid, smoothstep(0.22, 0.55, h));
  c = mix(c, uHot, smoothstep(0.6, 0.95, h));
  return c * (0.7 + 3.0 * h * h);
}
float flameNoise(vec2 p, float t) {
  vec2 w = vec2(fbm(p * 0.6 + vec2(0.0, -t * 0.5), 3), fbm(p * 0.6 + vec2(4.3, 1.7 - t * 0.7), 3));
  return fbm(p + (w - 0.5) * 1.8 + vec2(0.0, -t), 4);
}
float sparks(vec2 p, float t, float amount) {
  float s = 0.0;
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float scale = 7.0 + 5.0 * fl;
    vec2 q = p * scale - vec2(0.0, t * (2.2 + 0.6 * fl));
    vec2 cell = floor(q);
    vec3 h = vec3(hash22(cell + fl * 31.7), hash12(cell + vec2(7.7, fl)));
    if (h.z > amount * 0.5) continue;
    vec2 c = 0.25 + 0.5 * h.xy + vec2(0.12 * sin(t * 2.5 + h.x * 40.0), 0.0);
    vec2 d = (fract(q) - c) * vec2(1.0, 0.55) / scale;
    float r = (0.0016 + 0.0016 * h.y) * (1.0 - 0.25 * fl);
    float twinkle = 0.55 + 0.45 * sin(t * 17.0 + h.y * 60.0);
    s += exp(-dot(d, d) / (r * r)) * twinkle;
  }
  return s;
}
vec4 fireOver(vec4 base, vec3 light) {
  light = 1.0 - exp(-max(light, 0.0));
  float a = max(light.r, max(light.g, light.b));
  vec3 col = base.rgb * (1.0 - a) + light;
  float alpha = base.a + a * (1.0 - base.a);
  return vec4(min(col / max(alpha, 1e-4), 1.0), alpha);
}`.trim();

/**
 * Flames off an edge (needs {@link FIRE}): `edgeLift(p, t, height)` is how
 * far up (x sideways, y up) to look for the edge from `p`, and
 * `edgeHeat(sd, lift, height, n)` the heat there, given the edge's signed
 * distance `sd` at `p - lift` and the noise `n` it was made from. Looking
 * lower for the edge carries it up, in tongues where the noise is high, so
 * flames rise off every edge, tallest off the top.
 */
const EDGE_FLAMES = `
vec3 edgeLift(vec2 p, float t, float height) {
  float n = flameNoise(p * 7.0 / max(height * 8.0, 0.4), t);
  float side = vnoise(vec2(p.y * 9.0 - t * 1.3, p.x * 3.0)) - 0.5;
  return vec3(side * height * 0.5, height * (0.05 + 1.6 * n * n), n);
}
float edgeHeat(float sd, vec3 lift, float height) {
  float band = smoothstep(height * 0.32, 0.0, abs(sd));
  float cool = clamp(lift.y / (height * 1.25), 0.0, 1.0);
  return band * (1.05 - cool) * (0.55 + 0.7 * lift.z);
}`.trim();

/** `boxSdf(p, half, radius)`: signed distance to a rounded box. */
const BOX_SDF = `
float boxSdf(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`.trim();

export const fireBorder: ShaderEffect = {
  kind: "shader",
  id: "fire-border",
  name: "Fire border",
  description: "Flames rising off a rounded frame, licking up its sides and tallest along the top, with sparks flying up, for cards, buttons and hot deals.",
  category: "fire",
  tags: ["fire", "flames", "border", "frame", "ui", "card", "overlay", "hot"],
  transparent: true,
  source: glsl(
    `// Fire border: flames rising off a rounded frame, tallest along its top, sparks flying up off it.
uniform float uInset;           // @control min=0 max=0.35 default=0.16 label="Inset"
uniform float uRadius;          // @control min=0 max=0.5 default=0.06 label="Corner radius"
uniform float uHeight;          // @control min=0.02 max=0.3 default=0.11 label="Flame height"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
uniform float uIntensity;       // @control min=0 max=2 default=1 label="Intensity"
${FIRE_COLOURS}
${FIRE_BACKGROUND}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    FIRE_BASE,
    EDGE_FLAMES,
    BOX_SDF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 box = max(0.5 * iResolution.xy * px - uInset, vec2(0.05));
  float rad = min(uRadius, min(box.x, box.y));
  float t = iTime * uSpeed * 1.8;
  vec3 lift = edgeLift(p, t, uHeight);
  float heat = edgeHeat(boxSdf(p - lift.xy, box, rad), lift, uHeight);
  float sd = boxSdf(p, box, rad);
  // The burning edge itself, glowing, and its warmth spilling either side.
  heat = max(heat, smoothstep(0.006 + px, 0.0, abs(sd)) * (0.55 + 0.3 * lift.z));
  vec3 light = fireLight(heat) * uIntensity;
  light += uMid * exp(-abs(sd) / (uHeight * 0.6)) * 0.12 * uIntensity;
  // Sparks flying up off the frame, most off its top, thinning out as they rise.
  float rise = exp(-max(sd, 0.0) / (uHeight * 2.0)) * smoothstep(-0.01, 0.02, sd) * smoothstep(-box.y, box.y, p.y);
  light += mix(uHot, uMid, 0.4) * sparks(p, iTime * uSpeed, uSparks) * rise * 1.6;
  fragColor = fireOver(fireBase(), light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Button", values: { uInset: 0.2, uRadius: 0.5, uHeight: 0.07, uSparks: 0.3 } },
    { name: "Blue flame", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6] } },
    { name: "Inferno", values: { uHeight: 0.22, uSpeed: 1.4, uSparks: 1, uIntensity: 1.4 } },
    { name: "Hellfire", values: { uHot: [0.75, 1, 0.55], uMid: [0.25, 0.85, 0.2], uCool: [0.05, 0.3, 0.1] } },
  ],
};

export const flamingText: ShaderEffect = {
  kind: "shader",
  id: "flaming-text",
  name: "Flaming text",
  description: "Words on fire: flames rising off the letters, which smoulder like coals with glowing cracks, and sparks drifting up.",
  category: "fire",
  video: "none",
  tags: ["fire", "flames", "text", "title", "hot", "overlay"],
  transparent: true,
  source: glsl(
    `// Flaming text: the letters smoulder like coals while flames rise off them and sparks drift up.
uniform sampler2D uText;        // @control filter=linear wrap=clamp default=${textImage("FIRE")} label="Text"
uniform vec3 uFill;             // @control color default=#1E0D07 label="Letters"
uniform float uSize;            // @control min=0.3 max=1 default=0.62 label="Text size"
uniform float uHeight;          // @control min=0 max=0.5 default=0.26 label="Flame height"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
uniform float uSmoulder;        // @control min=0 max=1 default=0.7 label="Glowing letters"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
${FIRE_COLOURS}
${FIRE_BACKGROUND}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    FIRE_BASE,
    `// The text image's half size in the frame (height 1), contained in uSize of it, set low to leave the flames room.
vec2 textHalf() {
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  float h = min(uSize, iResolution.x / iResolution.y * 0.92 / aspect);
  return vec2(h * aspect, h) * 0.5;
}

float letters(vec2 p, vec2 hb) {
  vec2 uv = p / (2.0 * hb) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

// The letters blurred over about r, so flames carried up from them have soft edges.
float blurred(vec2 p, vec2 hb, float r) {
  float s = letters(p, hb) * 2.0;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5708 + 0.785;
    s += letters(p + vec2(cos(a), sin(a)) * r, hb);
  }
  return s / 6.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 hb = textHalf();
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px + vec2(0.0, uHeight * 0.3);
  float t = iTime * uSpeed * 1.6;
  float mask = letters(p, hb);
  // Flames: the letters looked for lower down, as far as the noise says, so their heat rises in tongues.
  float heat = 0.0;
  float n = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float m = flameNoise(p * 8.0 + fi * 7.3, t * (1.0 + 0.15 * fi));
    n = max(n, m);
    float lift = uHeight * (0.02 + 1.7 * m * m);
    float side = (vnoise(vec2(p.y * 7.0 - t * 1.2, fi * 5.0 + p.x * 2.0)) - 0.5) * uHeight * 0.45;
    heat = max(heat, blurred(p - vec2(side, lift), hb, 0.004 + lift * 0.12) * pow(max(1.0 - lift / (uHeight * 1.35), 0.0), 1.4) * (0.4 + 0.75 * m));
  }
  heat = max(heat, mask * 0.3);
  vec3 light = fireLight(heat) * (1.0 - 0.85 * mask);
  // The letters: charred, with embers glowing in their cracks and brighter at their edges.
  float glowing = fbm(p * 16.0 + vec2(0.0, -t * 0.2), 4);
  float cracks = 0.6 * smoothstep(0.035, 0.0, abs(glowing - 0.5)) + smoothstep(0.6, 0.78, glowing);
  float edge = clamp(length(vec2(dFdx(mask), dFdy(mask))) * 3.0, 0.0, 1.0);
  float pulse = 0.75 + 0.25 * sin(iTime * 2.0 + glowing * 12.0);
  vec3 coal = uFill + (1.0 - exp(-fireLight(0.35 + 0.45 * cracks) * cracks * pulse)) * uSmoulder;
  vec4 acc = fireBase();
  acc = vec4(acc.rgb * (1.0 - mask) + coal * mask, acc.a * (1.0 - mask) + mask);
  light += uMid * edge * uSmoulder * 0.8;
  // Sparks drifting up off the letters, thinning out as they rise.
  float rise = smoothstep(-hb.y * 0.5, hb.y, p.y) * exp(-max(p.y - hb.y, 0.0) / (uHeight * 1.2 + 0.03)) * (1.0 - smoothstep(hb.x * 0.6, hb.x + 0.05, abs(p.x)));
  light += mix(uHot, uMid, 0.4) * sparks(p, iTime * uSpeed, uSparks) * rise * 1.6;
  fragColor = fireOver(acc, light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Blue flame", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6], uFill: [0.04, 0.05, 0.12] } },
    { name: "Raging", values: { uHeight: 0.4, uSpeed: 1.4, uSparks: 1 } },
    { name: "Smouldering", values: { uHeight: 0.08, uSpeed: 0.6, uSmoulder: 1, uSparks: 0.2 } },
  ],
};

export const burnAway: ShaderEffect = {
  kind: "shader",
  id: "burn-away",
  name: "Burn away",
  description: "A picture catching fire and burning away from a point: the paper browns and chars ahead of a glowing, flaming edge that leaves nothing behind, then it is whole again.",
  category: "fire",
  video: "filter",
  tags: ["fire", "burn", "image", "paper", "reveal", "transition", "loop"],
  transparent: true,
  loop: 8,
  source: glsl(
    `// Burn away: the picture burns from a point outwards; ahead of the glowing edge it browns and chars,
// behind it there is nothing (clear), then it is whole again.
uniform sampler2D uImage;       // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec2 uOrigin;           // @control min=-1 max=1 default=-0.3,-0.4 label="Catches at"
uniform float uRagged;          // @control min=0 max=1 default=0.6 label="Ragged edge"
uniform float uChar;            // @control min=0.01 max=0.2 default=0.07 label="Scorch width"
uniform float uFlames;          // @control min=0 max=1 default=0.7 label="Flames"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.45 label="Burnt (when still)"
${FIRE_COLOURS}
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    PICTURE,
    `// How burnt, 0–1, over the 8 s loop: catching slowly, spreading, holding, then whole again.
float burnCycle() {
  float u = fract(iTime / 8.0);
  float b = clamp(u / 0.7, 0.0, 1.0);
  return b * b * (1.6 - 0.6 * b) * (1.0 - smoothstep(0.8, 0.97, u));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec2 o = (uOrigin * 0.5 + 0.5) * vec2(aspect, 1.0);
  float u = fract(iTime / 8.0);
  float burnt = uAnimate ? burnCycle() : uProgress;
  float restoring = uAnimate ? smoothstep(0.8, 0.97, u) : 0.0;
  // The front: a ragged circle round where it caught, burning faster uphill, far enough at 1 to take the corners.
  vec2 d = p - o;
  float reach = length(vec2(max(o.x, aspect - o.x), max(o.y, 1.0 - o.y))) + 0.1;
  float ragged = (fbm(p * 5.0, 5) - 0.5) * 0.35 * uRagged + (fbm(p * 22.0, 3) - 0.5) * 0.06 * uRagged;
  float dist = length(d * vec2(1.0, 0.8 + 0.2 * step(d.y, 0.0))) + ragged;
  float front = burnt * (reach + uChar) - uChar * 0.5;
  float into = front - dist;
  vec4 pic = pictureRGBA(uImage, uv);
  // Ahead of the edge: browned, then charred.
  float scorch = smoothstep(-uChar, 0.0, into);
  float charred = smoothstep(-uChar * 0.35, 0.0, into);
  vec3 col = mix(pic.rgb, pic.rgb * vec3(0.75, 0.52, 0.3), scorch * 0.8);
  col = mix(col, vec3(0.05, 0.03, 0.02), charred);
  float gone = smoothstep(0.0, 0.004 + px, into);
  float alpha = pic.a * (1.0 - gone);
  // The glowing rim, flickering, and flames rising off it.
  float t = iTime * 1.8;
  float rim = exp(-abs(into) / 0.004) * step(0.001, burnt) * (1.0 - restoring);
  float n = flameNoise(p * 8.0, t);
  vec3 light = fireLight(0.4 + 0.35 * n) * rim * 1.2;
  // Flames off the rim: the front looked for lower down, as far as the noise says, so they rise in tongues.
  float lift = 0.12 * uFlames * (0.03 + 1.6 * n * n);
  vec2 q = p - vec2((vnoise(vec2(p.y * 9.0 - t, p.x * 3.0)) - 0.5) * 0.03, lift);
  float qd = length((q - o) * vec2(1.0, 0.8 + 0.2 * step(q.y - o.y, 0.0))) + (fbm(q * 5.0, 5) - 0.5) * 0.35 * uRagged + (fbm(q * 22.0, 3) - 0.5) * 0.06 * uRagged;
  float heat = smoothstep(0.014, 0.0, abs(front - qd)) * pow(max(1.0 - lift / (0.16 * uFlames + 1e-3), 0.0), 1.3) * (0.45 + 0.7 * n);
  heat *= step(0.001, burnt) * (1.0 - restoring) * step(0.001, uFlames);
  light += fireLight(heat * 1.2);
  light += mix(uHot, uMid, 0.4) * sparks(p, iTime, uSparks) * exp(-abs(into) / 0.03) * step(0.001, burnt) * (1.0 - restoring) * 1.4;
  // Whole again: the picture fades back over what was left.
  col = mix(col, pic.rgb, restoring);
  alpha = mix(alpha, pic.a, restoring);
  vec4 base = vec4(col * alpha, alpha);
  fragColor = fireOver(base, light);
}`,
  ),
  presets: [
    { name: "From the middle", values: { uOrigin: [0, 0], uRagged: 0.8 } },
    { name: "Clean edge", values: { uRagged: 0.15, uChar: 0.03, uFlames: 0.3 } },
    { name: "Portrait", values: { uImage: SAMPLE_IMAGES.portrait, uOrigin: [0.4, -0.8] } },
  ],
};

export const fireRing: ShaderEffect = {
  kind: "shader",
  id: "fire-ring",
  name: "Ring of fire",
  description: "A hoop of fire, flames rising off a ring and roaring up its top, for avatars, badges and portals; hover and it flares.",
  category: "fire",
  tags: ["fire", "flames", "ring", "circle", "avatar", "badge", "portal", "overlay", "interactive", "hover"],
  transparent: true,
  source: glsl(
    `// Ring of fire: flames rising off a circle, tallest over its top; hovering fans them higher.
uniform float uRadius;          // @control min=0.1 max=0.45 default=0.3 label="Radius"
uniform float uHeight;          // @control min=0.02 max=0.3 default=0.1 label="Flame height"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
uniform float uFlare;           // @control min=0 max=1 default=0.6 label="Flare on hover"
${FIRE_COLOURS}
${FIRE_BACKGROUND}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    FIRE_BASE,
    EDGE_FLAMES,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px + vec2(0.0, 0.05);
  float flare = 1.0 + uFlare * clamp(iPointer.z, 0.0, 1.0);
  float height = uHeight * flare;
  float t = iTime * uSpeed * 1.8 * mix(1.0, flare, 0.5);
  vec3 lift = edgeLift(p, t, height);
  float heat = edgeHeat(length(p - lift.xy) - uRadius, lift, height);
  float sd = length(p) - uRadius;
  heat = max(heat, smoothstep(0.006 + px, 0.0, abs(sd)) * (0.55 + 0.3 * lift.z));
  vec3 light = fireLight(heat * mix(1.0, 1.15, flare - 1.0));
  light += uMid * exp(-abs(sd) / (height * 0.6)) * 0.12 * flare;
  light += mix(uHot, uMid, 0.4) * sparks(p, iTime * uSpeed, uSparks * flare) * exp(-max(sd, 0.0) / (height * 2.0)) * smoothstep(-0.01, 0.02, sd) * smoothstep(-uRadius * 0.6, uRadius * 0.4, p.y) * 1.6;
  fragColor = fireOver(fireBase(), light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Portal", values: { uRadius: 0.4, uHeight: 0.06, uHot: [1, 0.95, 0.8], uMid: [1, 0.55, 0.1], uSpeed: 1.6 } },
    { name: "Blue flame", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6] } },
    { name: "Circus hoop", values: { uRadius: 0.36, uHeight: 0.16, uSparks: 0.9 } },
  ],
};

export const fireball: ShaderEffect = {
  kind: "shader",
  id: "fireball",
  name: "Fireball",
  description: "A roiling ball of fire streaming flames and sparks behind it as it swoops about; hover and it follows the pointer, its flames rising when it stops.",
  category: "fire",
  tags: ["fire", "fireball", "flames", "magic", "game", "overlay", "interactive", "pointer"],
  transparent: true,
  source: glsl(
    `// Fireball: a turbulent ball of fire, its flames streaming behind as it moves and rising when it stops.
uniform float uSize;            // @control min=0.03 max=0.2 default=0.08 label="Size"
uniform float uTail;            // @control min=0 max=1 default=0.6 label="Tail"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Swoop speed"
uniform float uSparks;          // @control min=0 max=1 default=0.6 label="Sparks"
uniform bool uFollow;           // @control default=true label="Follow pointer"
${FIRE_COLOURS}
${FIRE_BACKGROUND}`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    FIRE_BASE,
    `// Where the ball swoops on its own: a looping figure, in frame units round the centre.
vec2 swoop(float t, float aspect) {
  return vec2(0.36 * aspect * sin(t * 0.9), 0.24 * sin(t * 1.8 + 0.5) + 0.04 * sin(t * 2.7));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float aspect = iResolution.x * px;
  float st = iTime * uSpeed;
  vec2 c = swoop(st, aspect);
  vec2 vel = (swoop(st, aspect) - swoop(st - 0.08, aspect)) / 0.08 * uSpeed;
  bool live = uFollow && iPointer.z > 0.0 && iTrail[0].w > 0.5;
  if (live) {
    c = (iPointer.xy - 0.5 * iResolution.xy) * px;
    // The pointer's speed over the last few trail points, if they are recent.
    vec4 back = iTrail[4];
    vel = back.w > 0.5 && iTrail[0].z - back.z > 0.0 ? (iTrail[0].xy - back.xy) * px / max(iTrail[0].z - back.z, 0.03) : vec2(0.0);
    vel *= step(iTime - iTrail[0].z, 0.15);
  }
  // The tail streams away from the motion, and up as the ball slows.
  float speed = length(vel);
  vec2 dir = normalize(mix(vec2(0.0, 1.0), -vel / max(speed, 1e-4), smoothstep(0.05, 0.6, speed)) + vec2(0.0, 0.25));
  float len = uSize * (1.5 + 7.0 * uTail * smoothstep(0.0, 0.8, speed));
  vec2 q = p - c;
  vec2 local = vec2(dot(q, vec2(dir.y, -dir.x)), dot(q, dir));
  float t = iTime * 2.4;
  float n = flameNoise(vec2(local.x, local.y - speed * iTime * 0.3) * 18.0 / max(uSize * 10.0, 0.5), t);
  // The ball, its rim churning, and a tail tapering behind it, broken into tongues toward its end.
  float r = length(q);
  float churn = fbm(q * 40.0 / max(uSize * 10.0, 0.5) + vec2(0.0, -t), 3);
  float ball = smoothstep(uSize * 1.1, uSize * 0.45, r + (n - 0.5) * uSize * 0.8) * (0.7 + 0.35 * churn);
  float along = clamp(local.y / len, 0.0, 1.0);
  float width = uSize * (1.0 - along * 0.85) * (0.7 + 0.6 * n);
  float d = length(vec2(local.x, local.y - along * len)) - width;
  float tail = smoothstep(uSize * 0.3, -uSize * 0.5, d - (n - 0.5) * uSize * 0.9) * (0.85 - 0.65 * along) * smoothstep(0.15, 0.6, n + 0.35 * (1.0 - along));
  float heat = max(ball, tail);
  vec3 light = fireLight(heat * 1.1);
  light += uMid * exp(-r / (uSize * 1.2)) * 0.3;
  // Sparks shed along the tail, drifting up.
  float shed = exp(-max(local.y, 0.0) / (len + 0.05)) * smoothstep(-uSize, uSize * 0.5, local.y) * exp(-abs(local.x) / (uSize * 1.5));
  light += mix(uHot, uMid, 0.4) * sparks(p - c * 0.6, iTime, uSparks) * shed * 2.0;
  fragColor = fireOver(fireBase(), light);
}`,
  ),
  presets: [
    { name: "With background", values: { uBackgroundAlpha: 1 } },
    { name: "Blue flame", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6] } },
    { name: "Comet", values: { uSize: 0.05, uTail: 1, uSpeed: 1.6 } },
    { name: "Hellfire", values: { uHot: [0.75, 1, 0.55], uMid: [0.25, 0.85, 0.2], uCool: [0.05, 0.3, 0.1], uSize: 0.12 } },
  ],
};

export const campfire: ShaderEffect = {
  kind: "shader",
  id: "campfire",
  name: "Campfire",
  description: "A crackling campfire at night: flames dancing over crossed logs with glowing embers, sparks spiralling up into the dark and firelight flickering on the ground.",
  category: "fire",
  tags: ["fire", "campfire", "flames", "night", "cosy", "outdoors", "scene", "loop"],
  source: glsl(
    `// Campfire: flames over crossed logs, glowing coals, sparks rising and firelight flickering round it.
uniform float uSize;            // @control min=0.5 max=1.5 default=1 label="Size"
uniform float uHeight;          // @control min=0.3 max=1.5 default=1 label="Flame height"
uniform float uSpeed;           // @control min=0 max=3 default=1 label="Speed"
uniform float uSparks;          // @control min=0 max=1 default=0.6 label="Sparks"
uniform float uSmoke;           // @control min=0 max=1 default=0.3 label="Smoke"
${FIRE_COLOURS}
uniform vec3 uLogs;             // @control color default=#4A2E1C label="Logs"
uniform vec3 uGround;           // @control color default=#1A1410 label="Ground"
uniform vec3 uSky;              // @control color default=#070912 label="Sky"`,
    HASH,
    NOISE,
    FBM,
    FIRE,
    `// Distance to a log: a capsule from a to b, r thick.
float logDist(vec2 p, vec2 a, vec2 b, float r) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * t) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = ((fragCoord - 0.5 * iResolution.xy) * px - vec2(0.0, -0.3)) / uSize;
  float t = iTime * uSpeed;
  // How bright the fire burns this moment: a slow breath and a quick flicker, for the light it throws.
  float flicker = 0.85 + 0.1 * sin(t * 3.1) + 0.08 * (vnoise(vec2(t * 9.0, 1.0)) - 0.5) * 2.0;
  // Sky and ground, the ground lit in a flickering pool round the fire.
  float horizon = -0.08 + 0.01 * sin(p.x * 3.0);
  vec3 col = mix(uSky, uSky * 1.6, smoothstep(0.6, -0.1, p.y));
  if (p.y < horizon) {
    float gr = fbm(p * vec2(30.0, 60.0), 3);
    col = uGround * (0.7 + 0.5 * gr);
    float pool = exp(-length((p - vec2(0.0, -0.02)) * vec2(1.0, 3.2)) / 0.22);
    col += uMid * pool * 0.55 * flicker + uHot * pool * pool * 0.25 * flicker;
    // Stones ringing the fire.
    for (int i = 0; i < 9; i++) {
      float a = 3.14159 * (0.04 + 0.92 * float(i) / 8.0) + 3.14159;
      vec2 sc = vec2(cos(a) * 0.3, sin(a) * 0.075 - 0.02);
      float sd = length((p - sc) * vec2(1.0, 1.6)) - 0.035 - 0.01 * hash12(vec2(float(i), 4.0));
      vec3 stone = vec3(0.22, 0.2, 0.19) * (0.6 + 0.4 * smoothstep(0.03, -0.03, p.y - sc.y)) + uMid * 0.25 * flicker * smoothstep(-0.01, 0.03, -(p.y - sc.y) * -1.0);
      col = mix(col, stone, smoothstep(px / uSize, 0.0, sd));
    }
  }
  col += uMid * exp(-length(p - vec2(0.0, 0.1)) / 0.35) * 0.18 * flicker;
  // Smoke drifting up from the flames' tops.
  vec2 sq = p - vec2(0.0, 0.42 * uHeight);
  float plume = fbm(vec2(sq.x * 5.0 - sin(sq.y * 2.0 + t * 0.3) * 0.6, sq.y * 3.0 - t * 0.5), 4);
  float spread = 0.06 + max(sq.y, 0.0) * 0.4;
  float smoke = smoothstep(0.45, 0.8, plume) * exp(-sq.x * sq.x / (spread * spread)) * smoothstep(-0.1, 0.1, sq.y) * exp(-max(sq.y, 0.0) * 1.5);
  col = mix(col, vec3(0.3, 0.28, 0.27), clamp(smoke * uSmoke, 0.0, 0.8));

  // The flames: a column narrowing as it rises, broken into tongues by the noise.
  float n = flameNoise(vec2(p.x * 7.0, p.y * 4.5), t * 2.4);
  float h = 0.55 * uHeight;
  float y = (p.y + 0.02) / h;
  float w = 0.17 * (1.0 - 0.75 * clamp(y, 0.0, 1.0)) * (1.0 + 0.35 * sin(y * 4.0 - t * 3.0) * clamp(y, 0.0, 1.0));
  float sway = 0.04 * sin(t * 1.3 + y * 2.5) * y;
  float heat = (1.0 - y) * 1.2 - abs(p.x - sway) / w * 0.75 + (n - 0.5) * 1.5;
  heat *= smoothstep(-0.25, 0.05, y);
  heat = clamp(heat, 0.0, 1.0);
  vec3 light = fireLight(heat);

  // Logs crossed over the coals, lit from the fire and glowing where they burn.
  vec2 logs[6];
  logs[0] = vec2(-0.26, -0.07); logs[1] = vec2(0.2, 0.06);
  logs[2] = vec2(0.26, -0.07); logs[3] = vec2(-0.2, 0.06);
  logs[4] = vec2(-0.22, -0.02); logs[5] = vec2(0.22, -0.035);
  float logMask = 0.0;
  vec3 logCol = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec2 a = logs[i * 2];
    vec2 b = logs[i * 2 + 1];
    float r = 0.032 - 0.004 * float(i);
    float ld = logDist(p, a, b, r);
    float m = smoothstep(px / uSize, 0.0, ld);
    if (m <= 0.0) continue;
    vec2 ab = normalize(b - a);
    float across = dot(p - a, vec2(-ab.y, ab.x)) / r;
    float bark = fbm(vec2(dot(p - a, ab) * 40.0, across * 2.0), 3);
    vec3 c = uLogs * (0.5 + 0.6 * bark) * (0.55 + 0.45 * smoothstep(-1.0, 0.6, across));
    // Hot near the middle of the fire: the bark burns through to glowing wood.
    float burn = smoothstep(0.22, 0.02, length(p - vec2(0.0, 0.0))) * smoothstep(0.35, 0.65, fbm(p * 30.0 + vec2(0.0, -t * 0.4), 3));
    c = mix(c, vec3(0.05, 0.03, 0.02), smoothstep(0.18, 0.05, length(p)) * 0.6);
    c += (1.0 - exp(-fireLight(0.4 + 0.4 * burn) * burn * flicker * 1.4));
    c += uMid * 0.18 * flicker * smoothstep(-0.2, 0.2, p.y + 0.06);
    if (m > logMask) { logCol = c; logMask = m; }
  }
  // The coals under it all.
  float coal = smoothstep(0.02, -0.005, length((p - vec2(0.0, -0.065)) * vec2(1.0, 3.0)) - 0.17);
  vec3 coals = (1.0 - exp(-fireLight(0.3 + 0.5 * fbm(p * 50.0 + t * 0.3, 3)) * 1.2 * flicker));
  col = mix(col, coals, coal);
  // Flames rise behind the front log and in front of the rest.
  col += 1.0 - exp(-light * (1.0 - logMask * 0.85));
  col = mix(col, logCol, logMask * smoothstep(0.75, 0.2, heat));
  col += (1.0 - exp(-light)) * logMask * smoothstep(0.2, 0.75, heat);
  // Sparks spiralling up into the dark.
  float rise = smoothstep(0.0, 0.25, p.y) * exp(-max(p.y - 0.3, 0.0) * 2.0) * exp(-abs(p.x) / (0.06 + 0.25 * max(p.y, 0.0)));
  vec2 swirl = vec2(p.x + 0.05 * sin(p.y * 6.0 - t * 1.5), p.y);
  col += mix(uHot, uMid, 0.5) * sparks(swirl * uSize, t * 0.8, uSparks) * rise * 2.0;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Bonfire", values: { uSize: 1.25, uHeight: 1.5, uSparks: 1, uSpeed: 1.2 } },
    { name: "Embers", values: { uHeight: 0.35, uSparks: 0.3, uSmoke: 0.6, uSpeed: 0.6 } },
    { name: "Gas fire", values: { uHot: [0.85, 0.95, 1], uMid: [0.25, 0.55, 1], uCool: [0.12, 0.1, 0.6], uSmoke: 0 } },
  ],
};

/** Fire: burning borders, text and pictures, fireballs, a ring of fire and a campfire. */
export const fireShaders: ShaderEffect[] = [fireBorder, flamingText, burnAway, fireRing, fireball, campfire];
