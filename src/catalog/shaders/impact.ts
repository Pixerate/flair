import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Impacts go off at each click, read from the `iClicks[8]` built-in the
 * wrapper declares (newest first: xy pixels, z the `iTime` of the click, w 1
 * for a click). Thumbnails and recordings have no pointer, so while there
 * are no clicks each one strikes on a schedule, which a `uDemo` control
 * turns off.
 */

/**
 * `hitAt(i, demo, every)`: hit `i`, newest first, as (x, y, time, 1), or
 * zeros for none. With the demo on and no real clicks yet, a synthetic hit
 * lands every `every` seconds somewhere near the middle (needs {@link HASH}).
 */
const HITS = `
vec4 hitAt(int i, bool demo, float every) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[i];
  float k = floor(iTime / every) - float(i);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.3 + 0.4 * h) * iResolution.xy, k * every, 1.0);
}`.trim();

export const shockwave: ShaderEffect = {
  kind: "shader",
  id: "shockwave",
  name: "Shockwave",
  description: "A picture hit by a shockwave from each click: a refracting ring bends it as it spreads, with a bright leading edge, a slight colour split and a flash where it struck.",
  category: "impact",
  video: "interactive",
  tags: ["impact", "interactive", "click", "image", "shockwave", "distortion", "action"],
  source: glsl(
    `// Shockwave: a refracting ring spreading from each hit (the four newest at once).
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uStrength;   // @control min=0 max=2 default=1 label="Refraction"
uniform float uSpeed;      // @control min=0.2 max=3 default=1.1 label="Speed"
uniform float uWidth;      // @control min=0.01 max=0.2 default=0.06 label="Ring width"
uniform float uLife;       // @control min=0.4 max=4 default=1.4 label="Lifetime"
uniform float uChroma;     // @control min=0 max=1 default=0.35 label="Colour split"
uniform vec3 uEdge;        // @control color default=#E0F2FF label="Edge"
uniform float uFlash;      // @control min=0 max=2 default=1 label="Flash"
uniform bool uDemo;        // @control default=true label="Demo when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    HITS,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float px = 1.0 / iResolution.y;
  vec2 off = vec2(0.0);
  float edge = 0.0;
  float shade = 0.0;
  float flash = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 c = hitAt(i, uDemo, 2.2);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > uLife) continue;
    vec2 d = (fragCoord - c.xy) * px;
    float r = length(d);
    vec2 dir = d / max(r, 1e-5);
    float life = age / uLife;
    float fade = (1.0 - life) * (1.0 - life);
    float R = age * uSpeed;
    float w = uWidth * (0.6 + life * 1.4);
    float x = (r - R) / w;
    // The ring is a lens: it pushes samples outward ahead of its crest and inward behind it.
    float lens = -x * exp(-x * x) * smoothstep(0.0, 0.04, R);
    off += dir * lens * uStrength * w * 1.2 * fade;
    shade += lens * fade;
    // A thin bright front just ahead of the crest.
    float front = (x - 0.7) * 3.0;
    edge += exp(-front * front) * fade;
    flash += exp(-age * 14.0) * exp(-r * r / (0.03 + age * 0.3));
  }
  vec2 o = off * vec2(iResolution.y / iResolution.x, 1.0);
  vec4 pic = pictureRGBA(uImage, uv - o);
  vec3 col = pic.rgb;
  // Red and blue refract a little more and less than green.
  col.r = picture(uImage, uv - o * (1.0 + uChroma * 1.5)).r;
  col.b = picture(uImage, uv - o * (1.0 - uChroma * 1.5)).b;
  col *= 1.0 + shade * 0.25 * uStrength;
  col += uEdge * edge * 0.55;
  col = mix(col, vec3(1.0), clamp(flash * uFlash, 0.0, 1.0));
  float glow = clamp(edge * 0.55 + flash * uFlash, 0.0, 1.0);
  fragColor = vec4(col, max(pic.a, glow));
}`,
  ),
  presets: [
    { name: "Sonic boom", values: { uStrength: 1.6, uSpeed: 1.8, uWidth: 0.1, uChroma: 0.7, uEdge: [1, 1, 1] } },
    { name: "Ripple", values: { uStrength: 0.6, uSpeed: 0.6, uWidth: 0.03, uLife: 2.5, uChroma: 0, uFlash: 0 } },
    { name: "Plasma", values: { uEdge: [0.75, 0.4, 1], uChroma: 1, uFlash: 1.6 } },
  ],
};

export const groundSlam: ShaderEffect = {
  kind: "shader",
  id: "ground-slam",
  name: "Ground slam",
  description: "A heavy landing seen side-on: cracks shoot across the ground, a ring of dust rolls out, rocks jump and the camera shakes.",
  category: "impact",
  tags: ["impact", "interactive", "click", "slam", "dust", "cracks", "rock", "shake", "action"],
  source: glsl(
    `// Ground slam: cracks, a rolling dust ring, jumping rocks and camera shake at each hit on the ground.
uniform vec3 uSky;         // @control color default=#9CC7E8 label="Sky"
uniform vec3 uGround;      // @control color default=#9A7B5A label="Ground"
uniform vec3 uDust;        // @control color default=#D8C3A5 label="Dust"
uniform vec3 uCrack;       // @control color default=#2A1C12 label="Cracks"
uniform float uHorizon;    // @control min=0.3 max=0.8 default=0.6 label="Horizon"
uniform int uCracks;       // @control min=3 max=14 default=9 label="Cracks"
uniform float uReach;      // @control min=0.1 max=0.8 default=0.38 label="Crack reach"
uniform float uDustAmount; // @control min=0 max=1 default=0.85 label="Dust"
uniform int uRocks;        // @control min=0 max=24 default=12 label="Rocks"
uniform float uShake;      // @control min=0 max=2 default=1 label="Shake"
uniform float uLife;       // @control min=1 max=6 default=2.6 label="Lifetime"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    FBM,
    HITS,
    `const float TILT = 0.28; // How flat the ground looks: circles on it squash to ellipses this tall.

// Where hit c lands on the ground, in y-units: where it was clicked (halfway down the ground for a
// click in the sky), or, for the idle demo, somewhere in the near ground.
vec2 landing(vec4 c, float px) {
  vec2 p = c.xy * px;
  if (uDemo && iClicks[0].w < 0.5) return vec2(p.x, uHorizon * (0.25 + 0.2 * fract(c.z * 0.618)));
  return vec2(p.x, p.y < uHorizon ? clamp(p.y, 0.04, uHorizon - 0.06) : uHorizon * 0.4);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  // Camera shake from the newest hit: a hard jolt that rings down.
  vec4 c0 = hitAt(0, uDemo, 3.0);
  float age0 = c0.w > 0.5 ? iTime - c0.z : 99.0;
  if (age0 >= 0.0 && age0 < 1.0) {
    float k = uShake * exp(-age0 * 7.0) * smoothstep(0.0, 0.02, age0);
    p += k * 0.022 * vec2(sin(age0 * 61.0) + 0.5 * sin(age0 * 113.0), cos(age0 * 79.0 + 1.0));
  }
  // Sky and ground.
  float above = p.y - uHorizon;
  vec3 col;
  if (above > 0.0) {
    col = mix(mix(uSky, vec3(1.0), 0.35), uSky * 0.85, smoothstep(0.0, 0.45, above));
  } else {
    float depth = clamp(-above / uHorizon, 0.0, 1.0);
    vec2 g = vec2(p.x / (0.15 + depth), depth * 8.0);
    float grain = fbm(g * 3.0, 4);
    col = uGround * (0.72 + 0.4 * depth) * (0.85 + 0.3 * grain);
    col = mix(col, mix(uSky, uGround, 0.7), exp(-depth * 18.0) * 0.6);
  }
  float dust = 0.0;
  for (int i = 2; i >= 0; i--) {
    vec4 c = hitAt(i, uDemo, 3.0);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > uLife) continue;
    float life = age / uLife;
    vec2 P = landing(c, px);
    vec2 d = p - P;
    // Size by distance: nearer (lower) hits look bigger.
    float scale = mix(1.5, 0.5, P.y / uHorizon);
    vec2 q = vec2(d.x, d.y / TILT) / scale;
    float r = length(q);
    if (above < 0.0) {
      // A dark dent where it landed.
      float dent = exp(-r * r / 0.004) * (1.0 - life * 0.5);
      col *= 1.0 - 0.45 * dent;
      // Cracks: jittered rays that shoot out fast and wander a little.
      float grow = uReach * (1.0 - exp(-age * 14.0));
      float n = float(uCracks);
      float a = atan(q.y, q.x) / 6.28318 + 0.5;
      float cell = floor(a * n);
      float crack = 0.0;
      for (int j = -1; j <= 1; j++) {
        float k = mod(cell + float(j), n);
        vec2 h = hash22(vec2(k + 0.5, c.z * 1.7 + 3.0));
        float len = grow * (0.45 + 0.55 * h.y);
        float ang = (k + 0.5 + (h.x - 0.5) * 0.7) / n;
        ang += (vnoise(vec2(r * 18.0, k * 5.0 + c.z)) - 0.5) * 0.05;
        float da = abs(fract(a - ang + 0.5) - 0.5) * 6.28318 * r;
        float w = 0.007 * (1.0 - r / max(len, 1e-4)) + 0.001;
        float on = step(r, len) * smoothstep(w, w * 0.3, da);
        crack = max(crack, on);
      }
      col = mix(col, uCrack, crack * (1.0 - smoothstep(0.6, 1.0, life)));
    }
    // A dust ring rolling out over the ground, billowing up as it goes.
    float R = 0.5 * (1.0 - exp(-age * 2.4)) * scale;
    float ringW = 0.07 * scale * (0.5 + life);
    float height = 0.16 * scale * (0.4 + life);
    float s = sqrt(max(R * R - d.x * d.x, 0.0)) * TILT;
    float side = smoothstep(R + ringW, R - ringW * 0.3, abs(d.x));
    float puff = 0.0;
    for (int f = 0; f < 2; f++) {
      float yg = f == 0 ? s : -s;
      float up = d.y - yg;
      puff += smoothstep(-ringW * TILT * 2.0, 0.0, up) * (1.0 - smoothstep(0.0, height, up));
    }
    float churn = fbm(vec2(atan(d.y, d.x) * 2.0, length(d) * 6.0 - age * 1.5) * 2.5 + c.z, 4);
    float densityHere = puff * side * smoothstep(0.25, 0.65, churn) * (1.0 - life) * smoothstep(0.0, 0.08, age);
    // A plume thrown straight up where it landed.
    float plumeH = 0.2 * scale * (1.0 - exp(-age * 5.0));
    float plumeW = 0.05 * scale * (1.0 + 2.0 * life) * (0.6 + 0.6 * clamp(d.y / max(plumeH, 1e-3), 0.0, 1.0));
    float plume = smoothstep(plumeW, plumeW * 0.3, abs(d.x)) * smoothstep(-0.02 * scale, 0.0, d.y) * (1.0 - smoothstep(plumeH * 0.5, plumeH, d.y));
    densityHere = max(densityHere, plume * smoothstep(0.3, 0.6, churn) * (1.0 - life) * (1.0 - life));
    dust = max(dust, densityHere);
    // Rocks thrown up from the impact, landing again around it.
    for (int j = 0; j < 24; j++) {
      if (j >= uRocks) break;
      vec2 h = hash22(vec2(float(j) * 3.7 + 1.0, c.z * 2.3));
      float h3 = hash12(h * 37.0 + c.z);
      float vx = (h.x - 0.5) * 0.6 * scale;
      float vy = (0.5 + 0.9 * h.y) * scale;
      float depthOff = (h3 - 0.5) * 0.12 * scale;
      float t = age;
      float g = 3.2 * scale;
      float flight = 2.0 * vy / g;
      float tt = min(t, flight);
      vec2 pos = P + vec2(vx * tt, depthOff * TILT + max(vy * tt - 0.5 * g * tt * tt, 0.0));
      float rr = (0.005 + 0.01 * h3) * scale;
      float sd = length((p - pos) * vec2(1.0, 1.2)) - rr;
      float a = (1.0 - smoothstep(-px, px, sd)) * (1.0 - smoothstep(0.75, 1.0, life));
      vec3 rc = uGround * (0.35 + 0.35 * h.y);
      rc += 0.15 * smoothstep(rr, -rr, dot(p - pos, vec2(0.6, -0.8)));
      // A shadow under it on the ground.
      vec2 below = (p - vec2(pos.x, P.y + depthOff * TILT)) * vec2(1.0, 3.0);
      float sh = exp(-dot(below, below) / (rr * rr * 4.0));
      col *= 1.0 - 0.3 * sh * step(above, 0.0) * (1.0 - life);
      col = mix(col, rc, a);
    }
  }
  col = mix(col, uDust * (0.85 + 0.25 * smoothstep(0.0, 0.2, p.y)), clamp(dust * uDustAmount, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Snowfield", values: { uSky: [0.7, 0.78, 0.86], uGround: [0.9, 0.93, 0.97], uDust: [1, 1, 1], uCrack: [0.35, 0.45, 0.6] } },
    { name: "Mars", values: { uSky: [0.86, 0.6, 0.45], uGround: [0.65, 0.3, 0.17], uDust: [0.85, 0.5, 0.32], uCrack: [0.2, 0.08, 0.04], uShake: 1.5 } },
    { name: "Tremor", values: { uCracks: 14, uReach: 0.7, uRocks: 4, uDustAmount: 0.4, uShake: 2 } },
  ],
};

export const impactFrame: ShaderEffect = {
  kind: "shader",
  id: "impact-frame",
  name: "Impact frame",
  description: "An anime fighting-game impact frame: on each hit the picture punches in, flashes white and flickers inverted or two-tone behind radial speed lines, then recovers.",
  category: "impact",
  video: "interactive",
  tags: ["impact", "interactive", "click", "image", "anime", "manga", "speed-lines", "flash", "action"],
  source: glsl(
    `// Impact frame: a few held frames of flash, inversion and speed lines at each hit.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uMode;         // @control min=0 max=2 default=2 label="Look (0 inverted, 1 two-tone, 2 flicker)"
uniform vec3 uInk;         // @control color default=#0B0B12 label="Ink"
uniform vec3 uPaper;       // @control color default=#FFFFFF label="Paper"
uniform float uLines;      // @control min=0 max=1 default=0.6 label="Speed lines"
uniform float uHold;       // @control min=0.1 max=1 default=0.35 label="Hold (s)"
uniform float uFps;        // @control min=6 max=30 default=12 step=1 label="Frames per second"
uniform float uPunch;      // @control min=0 max=0.3 default=0.1 label="Punch-in"
uniform bool uDemo;        // @control default=true label="Demo when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    HITS,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 c = hitAt(0, uDemo, 2.4);
  float age = c.w > 0.5 ? iTime - c.z : 99.0;
  vec2 hit = c.w > 0.5 ? c.xy / iResolution.xy : vec2(0.5);
  // Held frames: time steps in whole frames while it hits, like hand-drawn animation.
  float frame = floor(max(age, 0.0) * uFps);
  float held = frame / uFps;
  float on = step(0.0, age) * step(held, uHold);
  float recover = age > uHold ? exp(-(age - uHold) * 9.0) : 1.0;
  float k = age >= 0.0 ? recover : 0.0;
  // Punch in towards the hit and jolt a little per frame.
  vec2 jolt = (hash22(vec2(frame, c.z)) - 0.5) * 0.012 * on;
  vec2 st = hit + (uv - hit) / (1.0 + uPunch * k) + jolt;
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb;
  if (on > 0.5) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    int look = uMode == 2 ? int(mod(frame, 2.0)) : uMode;
    if (look == 0) {
      // Inverted with the contrast pushed hard.
      col = clamp((1.0 - col - 0.5) * 1.8 + 0.5, 0.0, 1.0);
    } else {
      col = mix(uInk, uPaper, smoothstep(0.4, 0.5, lum));
    }
    // Radial speed lines bursting from the hit, redrawn each frame, clear near the middle.
    vec2 d = (uv - hit) * vec2(iResolution.x / iResolution.y, 1.0);
    float r = length(d);
    float a = atan(d.y, d.x) / 6.28318 + 0.5;
    float n = 180.0;
    float cell = floor(a * n);
    float h = hash12(vec2(cell, frame + c.z * 7.0));
    float inLine = abs(fract(a * n) - 0.5) * 2.0;
    float thick = 0.15 + 0.7 * h;
    float start = 0.18 + 0.35 * hash12(vec2(cell + 3.0, frame));
    float line = step(1.0 - uLines * 0.9, h) * step(inLine, thick) * smoothstep(start, start + 0.15, r);
    vec3 lineCol = look == 0 ? vec3(1.0) - uInk : uInk;
    col = mix(col, lineCol, line);
    // The first frame is a white flash.
    if (frame < 0.5) col = mix(uPaper, col, 0.15);
    pic.a = 1.0;
  } else if (age >= 0.0) {
    // Recovering: a brief bright, crisp overshoot settling back.
    col = mix(col, clamp((col - 0.5) * 1.3 + 0.58, 0.0, 1.0), k);
  }
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Shonen red", values: { uMode: 1, uInk: [0.75, 0.04, 0.08], uPaper: [1, 0.96, 0.9], uLines: 0.8 } },
    { name: "Negative", values: { uMode: 0, uLines: 0.4, uHold: 0.25 } },
    { name: "Long hold", values: { uHold: 0.8, uFps: 8, uPunch: 0.2 } },
  ],
};

export const meteorStrike: ShaderEffect = {
  kind: "shader",
  id: "meteor-strike",
  name: "Meteor strike",
  description: "A meteor streaking down through a night sky on a burning trail and hitting the ground in a flash, a fireball and a spreading shockwave dome; it loops and strikes where you click.",
  category: "impact",
  tags: ["impact", "interactive", "click", "meteor", "fire", "explosion", "night", "space", "action"],
  loop: 4,
  source: glsl(
    `// Meteor strike: fall, flash, fireball and shockwave dome, every few seconds and where you click.
uniform vec3 uSky;         // @control color default=#0B1026 label="Night sky"
uniform vec3 uLand;        // @control color default=#141826 label="Land"
uniform vec3 uFire;        // @control color default=#FF7A1A label="Fire"
uniform vec3 uTrail;       // @control color default=#7FD6FF label="Trail glow"
uniform float uPeriod;     // @control min=3 max=10 default=4 label="Every (seconds)"
uniform float uAngle;      // @control min=20 max=70 default=38 label="Angle (degrees)"
uniform float uSize;       // @control min=0.4 max=2 default=1 label="Size"
uniform float uImpactX;    // @control min=0.1 max=0.9 default=0.62 label="Strikes at"
uniform bool uDemo;        // @control default=true label="Loop on its own"`,
    HASH,
    NOISE,
    FBM,
    `// Ground height (y-units) at x: low rolling hills.
float land(float x) {
  return 0.2 + 0.035 * sin(x * 3.1 + 1.0) + 0.02 * sin(x * 7.3 + 2.0);
}

vec3 fireRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(uFire * 0.2, uFire, smoothstep(0.0, 0.4, t));
  c = mix(c, vec3(1.0, 0.85, 0.45), smoothstep(0.4, 0.75, t));
  return mix(c, vec3(1.0, 0.98, 0.92), smoothstep(0.75, 1.0, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float W = iResolution.x * px;
  // The strike: the newest click while it plays, else the loop.
  float fall = 1.0;
  float t = -99.0;
  float ix = uImpactX * W;
  if (iClicks[0].w > 0.5 && iTime - iClicks[0].z < uPeriod) {
    t = iTime - iClicks[0].z;
    ix = iClicks[0].x * px;
  } else if (uDemo) {
    t = mod(iTime, uPeriod);
  }
  vec2 I = vec2(ix, land(ix));
  float since = t - fall;
  float S = uSize;
  // Night sky with stars.
  vec3 col = mix(uSky * 1.6 + vec3(0.02, 0.02, 0.05), uSky * 0.6, smoothstep(0.0, 1.0, p.y));
  vec2 sc = floor(fragCoord / 3.0);
  float star = step(0.996, hash12(sc)) * (0.5 + 0.5 * sin(iTime * 3.14159 + hash12(sc + 7.0) * 40.0));
  col += vec3(star) * 0.8;
  // The flash lights the whole sky for a moment.
  float flash = since >= 0.0 ? exp(-since * 6.0) : 0.0;
  col += mix(uFire, vec3(1.0), 0.6) * flash * 0.55;
  // Fireball and dome glow from the impact.
  vec3 light = vec3(0.0);
  if (since >= 0.0 && since < uPeriod - fall) {
    float life = clamp(since / max(min(uPeriod - fall, 2.6), 0.1), 0.0, 1.0);
    vec2 d = (p - I) / S;
    float r = length(d);
    // Shockwave dome: a thin shell spreading over the ground.
    float R = 0.9 * (1.0 - exp(-since * 2.2));
    float shell = exp(-pow((r - R) / (0.012 + 0.03 * life), 2.0)) * step(-0.01, d.y);
    float inside = smoothstep(R, R - 0.1, r) * step(0.0, d.y) * 0.12;
    light += mix(uTrail, vec3(1.0), 0.5) * (shell * 0.9 + inside) * (1.0 - life) * (1.0 - life);
    // Fireball: a churning ball rising off the ground and cooling.
    vec2 fb = d - vec2(0.0, 0.05 * since);
    float fr = 0.13 * (1.0 - exp(-since * 5.0)) * (1.0 + 0.4 * life);
    float n = fbm(fb * 9.0 - vec2(0.0, since * 1.2) + I * 3.0, 5);
    float body = smoothstep(fr * (1.0 + 0.35 * n), fr * 0.4, length(fb * vec2(1.0, 1.15)));
    float heat = clamp(body * (1.4 - life * 1.3) + n * 0.2 - 0.1, 0.0, 1.0);
    float fbA = body * (1.0 - smoothstep(0.6, 1.0, life));
    vec3 smoke = mix(vec3(0.08, 0.07, 0.07), uFire * 0.15, heat);
    col = mix(col, mix(smoke, fireRamp(heat), smoothstep(0.1, 0.4, heat)), fbA * step(0.0, d.y + 0.02));
    // Its glow on the sky and ground.
    light += uFire * exp(-r * r / 0.05) * 0.8 * (1.0 - life);
  }
  // The ground, lit from the impact.
  float g = land(p.x);
  if (p.y < g) {
    float n = fbm(vec2(p.x * 8.0, p.y * 20.0), 3);
    vec3 ground = uLand * (0.7 + 0.5 * n);
    ground += light * 0.6 + uFire * flash * 0.3 * exp(-abs(p.x - I.x) * 3.0);
    float rim = exp(-(g - p.y) * 200.0);
    col = mix(ground, ground + uTrail * 0.1, rim);
    // A glowing crater after it lands.
    if (since >= 0.0) {
      float cr = exp(-dot((p - I) * vec2(1.0, 4.0), (p - I) * vec2(1.0, 4.0)) / (0.004 * S * S));
      col += fireRamp(0.7) * cr * exp(-since * 0.8) * 0.9 * (1.0 - smoothstep(0.5, 1.0, since / max(uPeriod - fall, 0.1)));
    }
  } else {
    col += light;
  }
  // The meteor: a white-hot head on a burning trail, falling at the angle onto the impact point.
  if (t >= 0.0 && since < 0.0) {
    float a = radians(uAngle);
    vec2 dir = vec2(cos(a), -sin(a));
    float dist = 1.6;
    vec2 head = I - dir * dist * (-since / fall) * (-since / fall + 0.3) / 1.3;
    vec2 rel = p - head;
    float along = dot(rel, -dir);
    float across = dot(rel, vec2(-dir.y, dir.x));
    float len = 0.55 * S;
    float tw = (0.006 + 0.02 * clamp(along / len, 0.0, 1.0)) * S;
    float flame = fbm(vec2(along * 14.0 - t * 18.0, across * 40.0), 4);
    float tail = step(0.0, along) * exp(-along / len * 2.5) * exp(-pow(across / (tw * (0.7 + flame)), 2.0));
    float glowT = step(0.0, along) * exp(-along / len * 1.5) * exp(-abs(across) / (0.05 * S)) * 0.35;
    float headD = length(rel) / S;
    float core = exp(-headD * headD / 0.00012);
    float halo = exp(-headD / 0.03) * 0.8;
    col += fireRamp(tail * 1.2) * tail * 1.4 + uTrail * glowT + mix(uTrail, vec3(1.0), 0.6) * (halo + core * 2.0);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Steep", values: { uAngle: 66, uSize: 1.3, uImpactX: 0.5 } },
    { name: "Alien world", values: { uSky: [0.12, 0.03, 0.16], uLand: [0.1, 0.05, 0.12], uFire: [0.4, 1, 0.45], uTrail: [0.8, 0.5, 1] } },
    { name: "Dusk", values: { uSky: [0.2, 0.12, 0.25], uLand: [0.08, 0.06, 0.08], uFire: [1, 0.45, 0.15], uTrail: [1, 0.8, 0.5], uPeriod: 6 } },
  ],
};

export const screenShake: ShaderEffect = {
  kind: "shader",
  id: "screen-shake",
  name: "Screen shake",
  description: "A picture jolted by each hit: it shakes and twists on damped random offsets while a flash and a vignette pulse in the hit colour.",
  category: "impact",
  video: "interactive",
  tags: ["impact", "interactive", "click", "image", "shake", "damage", "flash", "game", "action"],
  source: glsl(
    `// Screen shake: damped random offsets, a little twist and zoom, a flash and a vignette pulse per hit.
uniform sampler2D uImage;  // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uAmount;     // @control min=0 max=2 default=1 label="Shake"
uniform float uRotation;   // @control min=0 max=2 default=0.8 label="Twist"
uniform float uDamping;    // @control min=1 max=12 default=5 label="Damping"
uniform float uFrequency;  // @control min=5 max=60 default=28 label="Frequency"
uniform vec3 uColor;       // @control color default=#FF2A2A label="Hit colour"
uniform float uFlash;      // @control min=0 max=1 default=0.35 label="Flash"
uniform float uVignette;   // @control min=0 max=1 default=0.7 label="Vignette pulse"
uniform bool uDemo;        // @control default=true label="Demo when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    HITS,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 shake = vec2(0.0);
  float twist = 0.0;
  float flash = 0.0;
  float pulse = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 c = hitAt(i, uDemo, 1.8);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > 3.0) continue;
    float env = exp(-age * uDamping) * smoothstep(0.0, 0.015, age);
    // A first kick away from where it hit, then smooth random jitter.
    vec2 away = normalize(vec2(0.5) - c.xy / iResolution.xy + vec2(1e-3)) * exp(-age * 30.0);
    float s = age * uFrequency;
    vec2 jitter = vec2(vnoise(vec2(s, c.z * 3.0)), vnoise(vec2(s + 17.0, c.z * 5.0))) * 2.0 - 1.0;
    shake += (jitter + away * 0.6) * env;
    twist += (vnoise(vec2(s * 0.8 + 41.0, c.z)) * 2.0 - 1.0) * env;
    flash += exp(-age * 14.0);
    pulse += exp(-age * 4.0) * smoothstep(0.0, 0.03, age);
  }
  // Shake about the centre in a square frame, with a slight zoom so the edges stay filled.
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float ang = twist * uRotation * 0.06;
  q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * q;
  q = q / (1.0 + 0.04 * uAmount * min(length(shake), 1.0)) + shake * uAmount * 0.03;
  vec2 st = q / vec2(aspect, 1.0) + 0.5;
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb;
  // Vignette pulse: the edges darken and take the hit colour.
  vec2 e = (uv - 0.5) * vec2(aspect, 1.0);
  float vig = smoothstep(0.25, 0.95, length(e) / max(aspect, 1.0) * 1.4);
  float v = clamp(pulse, 0.0, 1.0) * uVignette * vig;
  col = mix(col, col * 0.3 + uColor * 0.7, v);
  col = mix(col, mix(uColor, vec3(1.0), 0.6), clamp(flash, 0.0, 1.0) * uFlash);
  fragColor = vec4(col, max(pic.a, v));
}`,
  ),
  presets: [
    { name: "White hit", values: { uColor: [1, 1, 1], uFlash: 0.6, uVignette: 0.3 } },
    { name: "Earthquake", values: { uAmount: 1.6, uRotation: 0.3, uDamping: 1.5, uFrequency: 14, uFlash: 0, uVignette: 0 } },
    { name: "Critical", values: { uAmount: 2, uRotation: 2, uDamping: 8, uFlash: 0.8, uVignette: 1 } },
  ],
};

export const impactShaders: ShaderEffect[] = [shockwave, groundSlam, impactFrame, meteorStrike, screenShake];
