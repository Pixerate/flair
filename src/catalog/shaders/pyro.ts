import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

/*
 * Pyrotechnics. Sparks are light: each overlay sums its sparks into an HDR
 * colour and writes it with `glow`, whose alpha is the brightest channel, so
 * they brighten whatever is under them. Particles fly ballistically with air
 * drag (`ballistic`), so bursts slow down and droop the way real ones do.
 * Fireworks and explosions also read `iClicks` (xy pixels, z the `iTime` of
 * the click, w 1 for a click), the built-in the wrapper declares.
 */

/**
 * `glow(c)`: light as a colour over whatever is behind it. Its alpha is its
 * brightest channel, so it brightens what is under it like a screen blend.
 */
const GLOW = `
vec4 glow(vec3 c) {
  c = 1.0 - exp(-max(c, 0.0));
  float a = max(c.r, max(c.g, c.b));
  return vec4(c / max(a, 1e-4), a);
}`.trim();

/**
 * `over(acc, colour, alpha)`: paints a colour over a premultiplied
 * accumulator; `unpremultiply(acc)` turns it into straight colour and coverage.
 */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `ballistic(v, k, g, t)`: how far a particle launched at velocity `v` has
 * moved after `t` seconds, slowed by air drag `k` and pulled down by gravity
 * `g`. `streak(p, tail, head, w)`: a spark's streak of width `w`, brightest
 * at its head.
 */
const PARTICLE = `
vec2 ballistic(vec2 v, float k, float g, float t) {
  float e = (1.0 - exp(-k * t)) / k;
  return v * e - vec2(0.0, g / k * (t - e));
}
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}
float streak(vec2 p, vec2 tail, vec2 head, float w) {
  vec2 s = segment(p, tail, head);
  float along = mix(0.08, 1.0, s.y * s.y);
  return (exp(-s.x * s.x / (w * w)) + 0.12 * exp(-s.x / (w * 3.0))) * along;
}`.trim();

export const fireworks: ShaderEffect = {
  kind: "shader",
  id: "fireworks",
  name: "Fireworks",
  description: "Shells rising on faint trails and bursting into peonies, chrysanthemums, gold willows and rings that droop and twinkle out; clicks fire more.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "fireworks", "celebration", "festive", "night", "click", "interactive"],
  transparent: true,
  source: glsl(
    `// Fireworks: staggered shells rising and bursting into peony, chrysanthemum, willow and ring patterns.
uniform vec3 uColorA;     // @control color default=#FF4D6D label="Colour A"
uniform vec3 uColorB;     // @control color default=#4DD9FF label="Colour B"
uniform vec3 uColorC;     // @control color default=#B98CFF label="Colour C"
uniform vec3 uGold;       // @control color default=#FFB347 label="Willow gold"
uniform float uRate;      // @control min=0.2 max=1.6 default=0.8 label="Shells per second"
uniform float uSize;      // @control min=0.3 max=2 default=1 label="Burst size"
uniform float uGravity;   // @control min=0 max=2 default=1 label="Gravity"
uniform float uTrail;     // @control min=0 max=2 default=1 label="Trail length"
uniform float uBrightness; // @control min=0.2 max=3 default=1 label="Brightness"`,
    HASH,
    GLOW,
    PARTICLE,
    `vec3 pick(float h) {
  return h < 0.333 ? uColorA : (h < 0.667 ? uColorB : uColorC);
}

// One burst at c, tb seconds after it bursts. Types: 0 peony, 1 chrysanthemum, 2 willow, 3 ring.
vec3 burst(vec2 p, vec2 c, float tb, float seed, float px) {
  vec4 h = vec4(hash22(vec2(seed, 1.7)), hash22(vec2(seed, 8.3)));
  int type = int(floor(h.x * 4.0));
  bool willow = type == 2;
  float life = willow ? 3.4 : (type == 1 ? 2.4 : 1.9);
  if (tb < 0.0 || tb > life) return vec3(0.0);
  float speed = (willow ? 0.5 : 0.75) * (0.85 + 0.3 * h.y) * uSize;
  float k = willow ? 2.2 : 3.2;
  float g = 0.32 * uGravity;
  float trail = (type == 0 ? 0.05 : (type == 1 ? 0.28 : (willow ? 0.7 : 0.06))) * uTrail;
  // Skip pixels nowhere near the burst: everything lies within reach of its falling centre.
  float e = (1.0 - exp(-k * tb)) / k;
  float drop = g / k * (tb - e);
  if (length(p - c + vec2(0.0, drop * 0.5)) > speed * e + drop * 0.6 + 0.06) return vec3(0.0);
  vec3 primary = willow ? uGold : pick(h.z);
  vec3 second = pick(fract(h.z + 0.4));
  bool twoTone = h.w > 0.5 && !willow;
  float fade = 1.0 - smoothstep(life * 0.5, life, tb);
  float cool = smoothstep(0.0, 0.3, tb);
  float w = max(0.0028, 1.1 * px);
  float tilt = 0.25 + 0.6 * h.w;
  vec2 ringAxis = vec2(cos(h.y * 6.28), sin(h.y * 6.28));
  vec3 col = vec3(0.0);
  for (int j = 0; j < 44; j++) {
    float fj = float(j);
    vec2 r = hash22(vec2(fj * 1.31 + 0.7, seed));
    float a = r.x * 6.28318;
    vec2 dir;
    if (type == 3) {
      // A ring: a circle of stars in a tilted plane.
      a = (fj + 0.3 * r.y) / 44.0 * 6.28318;
      vec2 u = vec2(cos(a), sin(a) * tilt);
      dir = vec2(u.x * ringAxis.x - u.y * ringAxis.y, u.x * ringAxis.y + u.y * ringAxis.x) * (0.95 + 0.05 * r.y);
    } else {
      // A sphere of stars seen side on: denser towards the middle.
      float z = 2.0 * r.y - 1.0;
      dir = vec2(cos(a), sin(a)) * sqrt(1.0 - z * z) * (0.9 + 0.1 * hash12(vec2(fj, seed + 3.0)));
    }
    vec2 v = dir * speed;
    vec2 head = c + ballistic(v, k, g, tb);
    vec2 tail = c + ballistic(v, k, g, max(tb - trail, 0.0));
    float s = streak(p, tail, head, w * (willow ? 0.9 : 1.0));
    if (s < 1e-3) continue;
    float twinkle = type == 0 ? 1.0 : 0.45 + 0.55 * step(0.35, hash12(vec2(fj + seed, floor(iTime * 22.0))));
    vec3 tint = twoTone && fj > 21.5 ? second : primary;
    col += mix(vec3(1.0, 0.95, 0.85), tint, cool) * s * twinkle;
  }
  // The burst's flash.
  col += mix(vec3(1.0), primary, 0.5) * 0.5 * exp(-length(p - c) * 18.0 / uSize) * exp(-tb * 9.0);
  return col * fade * 1.6;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec3 col = vec3(0.0);
  float cycle = max(6.0 / uRate, 3.9);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float tt = iTime + fi * cycle / 6.0 + 0.6;
    float n = floor(tt / cycle);
    float local = tt - n * cycle;
    float seed = hash12(vec2(fi * 7.1, n)) * 100.0;
    vec4 h = vec4(hash22(vec2(seed, 4.4)), hash22(vec2(seed, 9.9)));
    vec2 target = vec2((h.x - 0.5) * 0.75 * aspect, mix(0.02, 0.3, h.y));
    vec2 launch = vec2(target.x + (h.z - 0.5) * 0.12, -0.56);
    float rise = 0.9 + 0.35 * h.w;
    if (local < rise) {
      // The rising shell: a sputtering head on a short, faint trail.
      float u = local / rise;
      float u0 = max(u - 0.18 * uTrail, 0.0);
      vec2 head = mix(launch, target, vec2(u, 1.0 - (1.0 - u) * (1.0 - u)));
      vec2 tail = mix(launch, target, vec2(u0, 1.0 - (1.0 - u0) * (1.0 - u0)));
      float flicker = 0.6 + 0.4 * hash12(vec2(fi, floor(iTime * 30.0)));
      col += vec3(1.0, 0.72, 0.42) * streak(p, tail, head, max(0.0022, px)) * 0.7 * flicker;
    } else {
      col += burst(p, target, local - rise, seed, px);
    }
  }
  // A burst at each click.
  for (int i = 0; i < 8; i++) {
    vec4 click = iClicks[i];
    if (click.w < 0.5) continue;
    float tb = iTime - click.z;
    if (tb < 0.0 || tb > 3.5) continue;
    vec2 c = (click.xy - 0.5 * iResolution.xy) / iResolution.y;
    col += burst(p, c, tb, fract(click.z * 0.6180339) * 100.0 + float(i) * 0.01, px);
  }
  fragColor = glow(col * uBrightness);
}`,
  ),
  presets: [
    { name: "Gold finale", values: { uColorA: [1, 0.8, 0.4], uColorB: [1, 0.95, 0.85], uColorC: [1, 0.6, 0.25], uRate: 1.6, uSize: 1.2 } },
    { name: "Patriotic", values: { uColorA: [1, 0.2, 0.25], uColorB: [1, 1, 1], uColorC: [0.25, 0.45, 1] } },
    { name: "Slow and big", values: { uRate: 0.35, uSize: 1.8, uGravity: 0.6, uTrail: 1.6 } },
  ],
};

export const sparkler: ShaderEffect = {
  kind: "shader",
  id: "sparkler",
  name: "Sparkler",
  description: "A burning sparkler throwing crackling, forking spark streaks from its glowing tip, which follows the pointer when it hovers.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "sparks", "celebration", "festive", "interactive", "hover"],
  transparent: true,
  source: glsl(
    `// Sparkler: short-lived spark streaks that fork as they burn, round a glowing tip.
uniform vec2 uPosition;   // @control min=-1 max=1 default=0,0.15 label="Tip"
uniform vec3 uColor;      // @control color default=#FFC46B label="Sparks"
uniform float uDensity;   // @control min=0 max=1 default=0.8 label="Density"
uniform float uLength;    // @control min=0.3 max=2 default=1 label="Spark length"
uniform float uIntensity; // @control min=0.2 max=3 default=1 label="Intensity"
uniform bool uStick;      // @control default=true label="Show stick"`,
    HASH,
    GLOW,
    OVER,
    PARTICLE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 home = uPosition * vec2(aspect, 1.0) * 0.5;
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec2 tip = mix(home, pointer, clamp(iPointer.z, 0.0, 1.0));
  vec4 acc = vec4(0.0);

  if (uStick) {
    // The wire, and the grey coating that is still to burn.
    vec2 down = normalize(vec2(0.28, -1.0));
    vec2 wire = segment(p, tip, tip + down * 0.6);
    acc = over(acc, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.0015, 0.0015 + px, wire.x)));
    vec2 coat = segment(p, tip + down * 0.01, tip + down * 0.3);
    acc = over(acc, vec3(0.42, 0.4, 0.37), (1.0 - smoothstep(0.0045, 0.0045 + px, coat.x)) * 0.95);
  }

  vec3 col = vec3(0.0);
  float w = max(0.0018, 0.9 * px);
  if (length(p - tip) < 0.42 * uLength + 0.05) {
    for (int j = 0; j < 48; j++) {
      float fj = float(j);
      vec2 h = hash22(vec2(fj, 7.13));
      float period = 0.28 + 0.3 * h.y;
      float tt = iTime / period + h.x;
      float n = floor(tt);
      float u = tt - n;
      vec2 s = hash22(vec2(fj * 3.1, n));
      if (s.x > uDensity) continue;
      float age = u * period;
      float angle = s.y * 6.28318;
      float speed = mix(0.6, 1.6, hash12(vec2(n, fj + 3.3))) * uLength;
      vec2 v = vec2(cos(angle), sin(angle)) * speed;
      float k = 6.0;
      float g = 0.6;
      // Each spark burns out in a fork: a few short branches flash from where it ends.
      float forkAt = mix(0.45, 0.8, hash12(vec2(fj, n + 0.5)));
      float ta = min(u, forkAt) * period;
      vec2 head = tip + ballistic(v, k, g, ta);
      vec2 tail = tip + ballistic(v, k, g, max(ta - 0.045, 0.0));
      float alive = u < forkAt ? 1.0 : 0.0;
      col += mix(vec3(1.0, 0.95, 0.8), uColor, u) * streak(p, tail, head, w) * alive * 1.6;
      if (u >= forkAt) {
        float since = (u - forkAt) * period;
        float flash = exp(-since * 22.0);
        if (flash < 0.02) continue;
        float grow = 1.0 - exp(-since * 40.0);
        vec2 heading = normalize(v + vec2(1e-5));
        for (int b = 0; b < 3; b++) {
          float fb = float(b);
          float turn = (fb - 1.0) * 0.9 + (hash12(vec2(fj + fb, n)) - 0.5) * 0.8;
          vec2 bd = vec2(heading.x * cos(turn) - heading.y * sin(turn), heading.x * sin(turn) + heading.y * cos(turn));
          float len = (0.025 + 0.03 * hash12(vec2(fb, fj + n))) * uLength * grow;
          col += uColor * streak(p, head, head + bd * len, w * 0.8) * flash * 1.6;
        }
      }
    }
  }
  // The tip: a white-hot core in a flickering orange halo.
  float r = length(p - tip);
  float flicker = 0.8 + 0.2 * hash12(vec2(floor(iTime * 25.0), 1.0));
  col += vec3(1.0, 0.97, 0.9) * exp(-r * r / 0.00006) * 3.0;
  col += uColor * (0.006 / (r + 0.006)) * 0.5 * flicker;
  vec4 light = glow(col * uIntensity);
  acc = over(acc, light.rgb, light.a);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Cool white", values: { uColor: [0.85, 0.92, 1], uDensity: 1, uLength: 1.2 } },
    { name: "Just sparks", values: { uStick: false, uDensity: 0.6 } },
  ],
};

export const explosion: ShaderEffect = {
  kind: "shader",
  id: "explosion",
  name: "Explosion",
  description: "A fireball cooling from white-hot to orange to rolling dark smoke, with a shockwave ring and flying debris; it loops and also goes off at each click.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "explosion", "fire", "smoke", "action", "click", "interactive"],
  transparent: true,
  loop: 3,
  source: glsl(
    `// Explosion: fireball, shockwave, debris and smoke, every few seconds and at each click.
uniform vec2 uPosition;   // @control min=-1 max=1 default=0,-0.1 label="Position"
uniform float uSize;      // @control min=0.3 max=2 default=1 label="Size"
uniform float uPeriod;    // @control min=2 max=8 default=3 label="Every (seconds)"
uniform vec3 uFire;       // @control color default=#FF7A1A label="Fire"
uniform vec3 uSmoke;      // @control color default=#4A413A label="Smoke"
uniform float uSmokeAmount; // @control min=0 max=1 default=0.85 label="Smoke"
uniform bool uAuto;       // @control default=true label="Loop on its own"`,
    HASH,
    NOISE,
    FBM,
    GLOW,
    OVER,
    PARTICLE,
    `// Fire colour for a temperature 0–1: dark red, orange, yellow, white.
vec3 fireRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(uFire * 0.25, uFire, smoothstep(0.0, 0.4, t));
  c = mix(c, vec3(1.0, 0.85, 0.4), smoothstep(0.4, 0.75, t));
  return mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.75, 1.0, t));
}

// An explosion at c, t seconds after it goes off, painted over acc.
vec4 explode(vec4 acc, vec2 p, vec2 c, float t, float seed, float scale, float px) {
  float end = min(uPeriod, 3.6);
  if (t < 0.0 || t > end) return acc;
  vec2 q = p - c;
  if (length(q) > scale * 1.6) return acc;
  float out_ = 1.0 - smoothstep(end * 0.6, end, t);
  vec3 col = vec3(0.0);

  // Smoke: a billowing cloud growing, rising and thinning, lit from inside while the fire burns.
  vec2 sq = (q - vec2(0.0, 0.12 * t * scale)) / scale;
  float sr = 0.2 + 0.2 * sqrt(t);
  float sn = fbm(sq * 5.0 + vec2(seed, -t * 0.6), 5);
  float sd = length(sq * vec2(0.9, 1.1)) / sr - (sn - 0.5) * 1.2;
  float smoke = (1.0 - smoothstep(0.25, 1.1, sd)) * smoothstep(0.05, 0.35, t) * out_ * uSmokeAmount;
  vec3 smokeCol = mix(uSmoke, uSmoke * 0.6 + uFire * 0.35, exp(-t * 1.6) * (1.0 - smoothstep(0.2, 0.8, sd)));
  acc = over(acc, smokeCol * (0.8 + 0.4 * sn), smoke * 0.92);

  // Fireball: expanding fast, then rising and cooling into the smoke.
  float R = scale * 0.32 * (1.0 - exp(-t * 7.0)) + 1e-3;
  vec2 fq = q - vec2(0.0, 0.05 * t * scale);
  float fn = fbm(fq / scale * 7.0 + vec2(-seed, -t * 1.4), 5);
  float fd = length(fq) / R + (fn - 0.5) * 0.9;
  float heat = exp(-t * 1.5) * out_;
  float temp = (1.0 - smoothstep(0.0, 1.05, fd)) * heat * (0.6 + 1.4 * fn * fn * 2.0);
  col += fireRamp(temp) * smoothstep(0.02, 0.3, temp) * 1.5;

  // Shockwave: a thin bright ring racing out, with a haze of brightened air behind it.
  float rr = length(q);
  float ring = scale * 1.25 * (1.0 - exp(-t * 2.6));
  float rw = max(0.004, 1.5 * px) + 0.01 * t;
  float wave = exp(-pow((rr - ring) / rw, 2.0)) * exp(-t * 3.0);
  float haze = smoothstep(ring - 0.12 * scale, ring, rr) * step(rr, ring) * exp(-t * 4.0);
  col += vec3(1.0, 0.92, 0.8) * (wave * 1.2 + haze * 0.18);

  // The flash.
  col += mix(vec3(1.0), uFire, 0.4) * exp(-rr * 4.0 / scale) * exp(-t * 10.0) * 1.5;

  // Debris: sparks flung out on ballistic arcs.
  float w = max(0.0025, px);
  for (int j = 0; j < 36; j++) {
    float fj = float(j);
    vec2 h = hash22(vec2(fj, seed + 2.0));
    float life = 0.6 + 1.0 * hash12(vec2(seed, fj));
    if (t > life) continue;
    float a = h.x * 6.28318;
    vec2 v = vec2(cos(a), sin(a) * 0.8 + 0.25) * (0.8 + 1.4 * h.y) * scale;
    vec2 head = c + ballistic(v, 2.2, 1.1, t);
    vec2 tail = c + ballistic(v, 2.2, 1.1, max(t - 0.06, 0.0));
    float f = 1.0 - smoothstep(life * 0.4, life, t);
    col += mix(vec3(1.0, 0.9, 0.6), uFire, t / life) * streak(p, tail, head, w) * f * 1.5;
  }
  vec4 light = glow(col);
  return over(acc, light.rgb, light.a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec4 acc = vec4(0.0);
  if (uAuto) acc = explode(acc, p, uPosition * vec2(aspect, 1.0) * 0.5, mod(iTime, uPeriod), 3.7, 0.65 * uSize, px);
  for (int i = 7; i >= 0; i--) {
    vec4 click = iClicks[i];
    if (click.w < 0.5) continue;
    vec2 c = (click.xy - 0.5 * iResolution.xy) / iResolution.y;
    acc = explode(acc, p, c, iTime - click.z, fract(click.z * 0.618) * 50.0, 0.38 * uSize, px);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Clicks only", values: { uAuto: false } },
    { name: "Blue plasma", values: { uFire: [0.25, 0.55, 1], uSmoke: [0.1, 0.12, 0.2], uSmokeAmount: 0.4 } },
    { name: "Big and slow", values: { uSize: 1.6, uPeriod: 5, uSmokeAmount: 1 } },
  ],
};

export const sparkFountain: ShaderEffect = {
  kind: "shader",
  id: "spark-fountain",
  name: "Spark fountain",
  description: "A gerb spraying sparks up from its base in a column that arcs over and falls back, lighting the ground.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "sparks", "fountain", "celebration", "stage"],
  transparent: true,
  source: glsl(
    `// Spark fountain: sparks sprayed up from a base, arcing back down under gravity.
uniform vec2 uBase;       // @control min=-1 max=1 default=0,-0.85 label="Base"
uniform vec3 uColor;      // @control color default=#FFB547 label="Sparks"
uniform float uHeight;    // @control min=0.3 max=2 default=1 label="Height"
uniform float uSpread;    // @control min=0 max=1 default=0.3 label="Spread"
uniform float uDensity;   // @control min=0 max=1 default=0.85 label="Density"
uniform float uIntensity; // @control min=0.2 max=3 default=1 label="Intensity"`,
    HASH,
    GLOW,
    PARTICLE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 base = uBase * vec2(aspect, 1.0) * 0.5;
  vec3 col = vec3(0.0);
  float w = max(0.0022, px);
  float k = 1.4;
  float g = 1.5;
  // Past this distance a streak's glow is far below one level, so sparks farther
  // away are skipped, and so is the whole loop outside the fountain's reach.
  float margin = 30.0 * w;
  float vmax = 1.35 * uHeight * 1.25;
  float xmax = vmax * sin(min(uSpread * 1.2, 1.5708)) * (1.0 - exp(-k * 1.8)) / k;
  float apex = log(1.0 + vmax * k / g) / k;
  float ea = (1.0 - exp(-k * apex)) / k;
  float ymax = vmax * ea - g / k * (apex - ea);
  vec2 rel = p - base;
  bool inReach = abs(rel.x) < xmax + margin && rel.y > -0.01 - margin && rel.y < ymax + margin;
  for (int j = 0; j < 112; j++) {
    if (!inReach) break;
    float fj = float(j);
    vec2 h = hash22(vec2(fj, 2.31));
    float life = 1.0 + 0.8 * h.y;
    float tt = iTime / life + h.x;
    float n = floor(tt);
    float age = (tt - n) * life;
    vec3 s = vec3(hash22(vec2(fj * 1.7, n)), hash12(vec2(n, fj + 0.37)));
    if (s.z > uDensity) continue;
    float a = (s.x - 0.5) * 2.0 * uSpread * 1.2;
    // A spark only ever moves to its own side of the base.
    if (a * rel.x < 0.0 && abs(rel.x) > margin) continue;
    vec2 v = vec2(sin(a), cos(a)) * mix(0.9, 1.35, s.y) * uHeight * 1.25;
    vec2 head = base + ballistic(v, k, g, age);
    vec2 tail = base + ballistic(v, k, g, max(age - 0.07, 0.0));
    // Sparks that fall back past the base are gone.
    if (head.y < base.y - 0.01) continue;
    if (any(lessThan(p, min(head, tail) - margin)) || any(greaterThan(p, max(head, tail) + margin))) continue;
    float fade = 1.0 - smoothstep(0.5, 1.0, age / life);
    float twinkle = 0.6 + 0.4 * hash12(vec2(fj, floor(iTime * 24.0)));
    vec3 tint = mix(vec3(1.0, 0.96, 0.85), uColor, smoothstep(0.0, 0.5, age));
    col += tint * streak(p, tail, head, w) * fade * twinkle * 1.2;
  }
  // The gerb's mouth: a white-hot plume, and the glow it throws on the ground.
  vec2 q = p - base;
  float flicker = 0.85 + 0.15 * hash12(vec2(floor(iTime * 30.0), 4.0));
  col += vec3(1.0, 0.95, 0.85) * exp(-pow(q.x / 0.012, 2.0) - pow((q.y - 0.02) / 0.04, 2.0)) * 2.0 * flicker;
  col += uColor * (0.012 / (length(q) + 0.012)) * 0.6 * flicker;
  col += uColor * exp(-abs(q.y) * 45.0) * exp(-abs(q.x) * 5.0) * 0.4 * uHeight;
  fragColor = glow(col * uIntensity);
}`,
  ),
  presets: [
    { name: "Silver", values: { uColor: [0.86, 0.9, 1] } },
    { name: "Wide fan", values: { uSpread: 0.8, uHeight: 0.8 } },
  ],
};

export const romanCandle: ShaderEffect = {
  kind: "shader",
  id: "roman-candle",
  name: "Roman candle",
  description: "Balls of coloured fire popping up from a tube one after another, trailing comet tails and sputtering sparks.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "fireworks", "celebration", "festive"],
  transparent: true,
  source: glsl(
    `// Roman candle: coloured stars shot up at intervals with comet tails and sputter.
uniform vec2 uBase;       // @control min=-1 max=1 default=0,-0.95 label="Base"
uniform float uAngle;     // @control min=-0.6 max=0.6 default=0.08 label="Tilt"
uniform float uInterval;  // @control min=0.3 max=3 default=0.8 label="Seconds between shots"
uniform float uHeight;    // @control min=0.5 max=2 default=1.2 label="Height"
uniform vec3 uColorA;     // @control color default=#FF3D7F label="Colour A"
uniform vec3 uColorB;     // @control color default=#3DFF9E label="Colour B"
uniform vec3 uColorC;     // @control color default=#3DB2FF label="Colour C"`,
    HASH,
    GLOW,
    OVER,
    PARTICLE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 base = uBase * vec2(aspect, 1.0) * 0.5;
  vec2 dir = vec2(sin(uAngle), cos(uAngle));
  vec4 acc = vec4(0.0);

  // The tube.
  vec2 tube = segment(p, base, base - dir * 0.14);
  acc = over(acc, vec3(0.45, 0.1, 0.12), 1.0 - smoothstep(0.011, 0.011 + px, tube.x));

  vec3 col = vec3(0.0);
  float w = max(0.0025, px);
  float k = 0.7;
  float g = 1.0;
  float shot = floor(iTime / uInterval);
  for (int i = 0; i < 5; i++) {
    float n = shot - float(i);
    float age = iTime - n * uInterval;
    float life = 1.9;
    if (age > life || n < 0.0) continue;
    vec2 h = hash22(vec2(n, 5.5));
    vec3 tint = mod(n, 3.0) < 0.5 ? uColorA : (mod(n, 3.0) < 1.5 ? uColorB : uColorC);
    vec2 v = (dir + vec2((h.x - 0.5) * 0.08, 0.0)) * (0.95 + 0.1 * h.y) * uHeight * 1.45;
    vec2 ball = base + ballistic(v, k, g, age);
    if (length(p - ball) > 0.45) continue;
    float burn = 1.0 - smoothstep(life * 0.65, life, age);
    // The star, and its comet tail.
    float r = length(p - ball);
    col += mix(vec3(1.0), tint, 0.35) * exp(-r * r / (0.0003 * burn + 1e-6)) * 2.5 * burn;
    col += tint * (0.012 / (r + 0.012)) * 0.4 * burn;
    vec2 tail = base + ballistic(v, k, g, max(age - 0.22, 0.0));
    col += tint * streak(p, tail, ball, w * 2.6) * burn * 1.1;
    // Sputter: sparks shed by the star, drifting off and dropping.
    for (int j = 0; j < 8; j++) {
      float fj = float(j);
      vec2 s = hash22(vec2(fj + n * 13.0, 2.2));
      float te = s.x * age;
      float sa = age - te;
      if (sa > 0.35) continue;
      vec2 from = base + ballistic(v, k, g, te);
      float a = s.y * 6.28318;
      vec2 sv = vec2(cos(a), sin(a)) * 0.45;
      vec2 head = from + ballistic(sv, 4.0, 0.8, sa);
      vec2 stail = from + ballistic(sv, 4.0, 0.8, max(sa - 0.04, 0.0));
      col += mix(vec3(1.0, 0.85, 0.6), tint, 0.5) * streak(p, stail, head, w) * (1.0 - sa / 0.35) * burn * 1.5;
    }
  }
  // The muzzle: a flash at each shot, and a little sputter between.
  float since = iTime - shot * uInterval;
  float m = length(p - base);
  float flicker = 0.7 + 0.3 * hash12(vec2(floor(iTime * 28.0), 3.0));
  col += vec3(1.0, 0.8, 0.5) * (exp(-since * 14.0) * 2.0 + 0.25 * flicker) * exp(-m * m / 0.0004);
  vec4 light = glow(col);
  acc = over(acc, light.rgb, light.a);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Rapid fire", values: { uInterval: 0.35, uHeight: 1 } },
    { name: "Gold", values: { uColorA: [1, 0.75, 0.3], uColorB: [1, 0.9, 0.6], uColorC: [1, 0.6, 0.2] } },
  ],
};

export const fuseBurn: ShaderEffect = {
  kind: "shader",
  id: "fuse-burn",
  name: "Fuse burn",
  description: "A lit fuse burning along an S-curve, its bright spitting spark leaving a charred, smoking cord behind, then a pop.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "fuse", "sparks", "countdown", "suspense"],
  transparent: true,
  source: glsl(
    `// Fuse burn: a spitting spark running along a curved cord, charring it as it goes.
uniform float uCurve;     // @control min=-1 max=1 default=0.6 label="Curve"
uniform float uWaves;     // @control min=0.5 max=3 default=1 label="Waves"
uniform float uDuration;  // @control min=1 max=15 default=5 label="Burn time"
uniform vec3 uCord;       // @control color default=#C9A46A label="Cord"
uniform vec3 uSpark;      // @control color default=#FFB040 label="Spark"
uniform float uThickness; // @control min=0.5 max=3 default=1 label="Thickness"`,
    HASH,
    GLOW,
    OVER,
    PARTICLE,
    `// The fuse at s (0–1): an S-curve across the frame.
vec2 fusePoint(float s, float aspect) {
  return vec2(mix(-0.42, 0.42, s) * aspect, uCurve * 0.22 * sin(s * 6.28318 * uWaves));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  // Burn for most of the cycle, then a pop at the end and a moment's rest.
  float cycle = uDuration + 1.0;
  float t = mod(iTime, cycle);
  float burnt = clamp(t / uDuration, 0.0, 1.0);
  float after = t - uDuration;

  // Nearest point of the cord (a polyline), and how far along it that is.
  float best = 1e9;
  float along = 0.0;
  float sAt = 0.0;
  float length_ = 0.0;
  vec2 prev = fusePoint(0.0, aspect);
  for (int i = 1; i <= 48; i++) {
    vec2 next = fusePoint(float(i) / 48.0, aspect);
    vec2 sg = segment(p, prev, next);
    float seg = length(next - prev);
    if (sg.x < best) {
      best = sg.x;
      sAt = (float(i) - 1.0 + sg.y) / 48.0;
      along = length_ + seg * sg.y;
    }
    length_ += seg;
    prev = next;
  }
  vec4 acc = vec4(0.0);
  float width = 0.0045 * uThickness;
  float ahead = step(burnt, sAt);
  float wv = ahead > 0.5 ? width : width * 0.75;
  float cover = 1.0 - smoothstep(wv - px, wv, best);
  // A twisted cord ahead of the spark; a charred one, still glowing near it, behind.
  float twist = 0.85 + 0.15 * sin(along * 420.0 / uThickness + best / width * 2.5);
  float shade = 1.0 - 0.4 * pow(best / max(wv, 1e-4), 2.0);
  vec3 cord = uCord * twist * shade;
  vec3 charred = vec3(0.1, 0.085, 0.075) * shade;
  acc = over(acc, mix(charred, cord, ahead), cover);

  vec2 head = fusePoint(burnt, aspect);
  vec3 col = vec3(0.0);
  if (ahead < 0.5) {
    float behind = (burnt - sAt) * length_;
    float ember = exp(-behind / 0.03) + 0.5 * exp(-behind / 0.12) * step(0.8, hash12(vec2(floor(along * 300.0), floor(iTime * 8.0))));
    col += uSpark * vec3(1.0, 0.55, 0.3) * ember * cover * 1.5;
  }

  // Smoke curling up from the spark.
  vec2 q = p - head;
  if (q.y > 0.0 && after < 0.0) {
    float sway = q.x - 0.02 * sin(q.y * 25.0 - iTime * 3.0) - q.y * 0.15;
    float plume = exp(-sway * sway / (0.00004 + q.y * 0.0012)) * exp(-q.y * 7.0) * smoothstep(0.0, 0.03, q.y);
    acc = over(acc, vec3(0.6, 0.58, 0.56), plume * 0.22);
  }

  if (after < 0.0) {
    // The spark: a white-hot head spitting short sparks every which way.
    float r = length(q);
    float flicker = 0.75 + 0.25 * hash12(vec2(floor(iTime * 30.0), 2.0));
    col += vec3(1.0, 0.95, 0.85) * exp(-r * r / 0.00005) * 3.0 * flicker;
    col += uSpark * (0.007 / (r + 0.007)) * 0.6 * flicker;
    if (r < 0.2) {
      float w = max(0.0018, 0.9 * px);
      for (int j = 0; j < 28; j++) {
        float fj = float(j);
        vec2 h = hash22(vec2(fj, 6.6));
        float period = 0.22 + 0.25 * h.y;
        float tt = iTime / period + h.x;
        float n = floor(tt);
        float age = (tt - n) * period;
        vec2 s = hash22(vec2(fj * 2.3, n));
        float a = mix(-0.4, 3.54, s.x);
        vec2 v = vec2(cos(a), sin(a)) * mix(0.4, 1.1, s.y);
        vec2 sh = head + ballistic(v, 7.0, 0.8, age);
        vec2 st = head + ballistic(v, 7.0, 0.8, max(age - 0.035, 0.0));
        col += mix(vec3(1.0, 0.95, 0.8), uSpark, age / period) * streak(p, st, sh, w) * (1.0 - age / period) * 1.3;
      }
    }
  } else {
    // The pop: a flash at the end of the fuse.
    float r = length(q);
    col += mix(vec3(1.0), uSpark, 0.4) * exp(-r * 12.0) * exp(-after * 6.0) * 2.0;
    col += vec3(1.0, 0.9, 0.7) * exp(-pow((r - after * 0.6) / 0.006, 2.0)) * exp(-after * 5.0);
  }
  vec4 light = glow(col);
  acc = over(acc, light.rgb, light.a);
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Straight", values: { uCurve: 0 } },
    { name: "Slow wiggle", values: { uCurve: 0.9, uWaves: 2, uDuration: 10 } },
  ],
};

export const smokeBomb: ShaderEffect = {
  kind: "shader",
  id: "smoke-bomb",
  name: "Smoke bomb",
  description: "Billowing two-tone coloured smoke pouring from a point, rolling out along the ground and rising as it thins.",
  category: "pyrotechnics",
  tags: ["pyro", "overlay", "smoke", "colour", "photo", "moody"],
  transparent: true,
  source: glsl(
    `// Smoke bomb: domain-warped fbm smoke pouring from a source, spreading and rising.
uniform vec2 uSource;     // @control min=-1 max=1 default=0,-0.8 label="Source"
uniform vec3 uColorA;     // @control color default=#FF4FA3 label="Colour A"
uniform vec3 uColorB;     // @control color default=#7C5CFF label="Colour B"
uniform float uDensity;   // @control min=0 max=1 default=0.85 label="Density"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uSpread;    // @control min=0.2 max=2 default=1 label="Spread"
uniform float uHeight;    // @control min=0.2 max=2 default=1 label="Rise"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 src = uSource * vec2(aspect, 1.0) * 0.5;
  vec2 q = p - src;
  float t = iTime * uSpeed;
  float h = max(q.y, 0.0);
  // Where smoke is: a plume widening as it rises, and a cloud rolling out along the ground.
  float width = 0.04 + h * 0.75 * uSpread;
  float plume = exp(-pow(q.x / width, 2.0)) * exp(-h / (0.55 * uHeight));
  float ground = exp(-pow(q.y / 0.07, 2.0)) * exp(-abs(q.x) / (0.3 * uSpread));
  float env = max(plume, ground * 0.8) * smoothstep(-0.06, 0.0, q.y);
  if (env < 0.01) {
    fragColor = vec4(0.0);
    return;
  }
  // Billows: fbm advected up and outwards, warped by itself.
  vec2 flow = vec2(q.x * (1.0 - 0.4 * clamp(h * 2.0, 0.0, 1.0)), q.y - t * 0.22);
  vec2 warp = vec2(fbm(flow * 3.0 + vec2(0.0, t * 0.05), 4), fbm(flow * 3.0 + vec2(5.2, 1.3 - t * 0.07), 4));
  float n = fbm(flow * 4.5 + warp * 1.6, 5);
  float n2 = fbm(flow * 4.5 + warp * 1.6 + vec2(0.0, 0.03), 5);
  float d = smoothstep(0.25, 0.75, n * (0.6 + 0.8 * env)) * env;
  float a = clamp(d * 1.6 * uDensity, 0.0, 1.0);
  // Colour drifts between the two; billow tops catch the light.
  float mixer = smoothstep(0.3, 0.7, fbm(flow * 1.5 + warp + vec2(9.0, 0.0), 3) + q.x * 0.6);
  vec3 col = mix(uColorA, uColorB, mixer);
  float light = clamp(0.75 + (n2 - n) * 10.0 + 0.25 * n, 0.4, 1.25);
  col = col * light + 0.06;
  // The canister's flare at the source.
  float r = length(q);
  col = mix(col, mix(vec3(1.0, 0.95, 0.9), uColorA, 0.4), exp(-r * r / 0.0004) * 0.8);
  a = max(a, exp(-r * r / 0.0002));
  fragColor = vec4(clamp(col, 0.0, 1.0), a);
}`,
  ),
  presets: [
    { name: "Orange and teal", values: { uColorA: [1, 0.55, 0.15], uColorB: [0.1, 0.75, 0.75] } },
    { name: "Gender reveal", values: { uColorA: [1, 0.55, 0.75], uColorB: [0.45, 0.7, 1], uDensity: 1, uSpread: 1.4 } },
    { name: "Wisp", values: { uDensity: 0.45, uSpread: 0.5, uHeight: 1.6, uSpeed: 0.6 } },
  ],
};

export const lightShow: ShaderEffect = {
  kind: "shader",
  id: "light-show",
  name: "Light show",
  description: "A stadium pyro finale: flame jets and spark gerbs firing from the stage edge in sequences under sweeping beams, for title cards.",
  category: "pyrotechnics",
  tags: ["pyro", "background", "concert", "stage", "title", "hero", "fire"],
  source: glsl(
    `// Light show: flame jets and gerbs along the bottom firing in chases, with sweeping beams.
uniform vec3 uBackground; // @control color default=#06040C label="Background"
uniform vec3 uFlame;      // @control color default=#FF6A1A label="Flames"
uniform vec3 uSparks;     // @control color default=#FFE2A0 label="Gerbs"
uniform vec3 uBeam;       // @control color default=#5E8BFF label="Beams"
uniform int uJets;        // @control min=3 max=12 default=7 label="Jets"
uniform float uSpeed;     // @control min=0.2 max=3 default=1 label="Speed"
uniform float uBeams;     // @control min=0 max=2 default=1 label="Beam strength"`,
    HASH,
    NOISE,
    FBM,
    `// A firing: up fast, holding, and dying away.
float fire(float x, float len) {
  return smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(len * 0.7, len, x));
}

vec3 flameRamp(float t) {
  vec3 c = mix(uFlame * 0.3, uFlame, smoothstep(0.0, 0.45, t));
  c = mix(c, vec3(1.0, 0.85, 0.45), smoothstep(0.45, 0.8, t));
  return mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.8, 1.0, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float t = iTime * uSpeed;
  vec3 col = uBackground * (0.6 + 0.6 * (1.0 - uv.y));

  // Beams: searchlights from below the stage, sweeping through a little haze.
  float haze = 0.6 + 0.6 * fbm(p * 3.0 + vec2(t * 0.1, 0.0), 3);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 o = vec2((fi / 3.0 - 0.5) * aspect * 0.9, -0.05);
    float aim = 0.55 * sin(t * (0.35 + 0.1 * fi) + fi * 1.9) + (fi < 1.5 ? 0.2 : -0.2);
    vec2 d = p - o;
    float ang = atan(d.x, d.y) - aim;
    float cone = exp(-ang * ang / 0.0025) * smoothstep(1.4, 0.0, length(d));
    vec3 tint = mix(uBeam, vec3(1.0), 0.25 * mod(fi, 2.0));
    col += tint * cone * haze * 0.35 * uBeams;
  }

  // The firing sequence, in 4-beat phrases: all at once, a chase, centre out, alternate.
  float phrase = floor(t / 4.0);
  float pattern = mod(phrase, 4.0);
  float local = mod(t, 4.0);
  float jets = float(uJets);
  float stageGlow = 0.0;
  for (int j = 0; j < 12; j++) {
    if (j >= uJets) break;
    float fj = float(j);
    float x01 = (fj + 0.5) / jets;
    float x = (x01 - 0.5) * aspect * 0.9;
    float f;
    if (pattern < 0.5) f = fire(local, 1.4);
    else if (pattern < 1.5) f = fire(local - x01 * 1.8, 0.9);
    else if (pattern < 2.5) f = fire(local - abs(x01 - 0.5) * 2.6, 1.0);
    else f = fire(mod(local + (mod(fj, 2.0) < 0.5 ? 0.0 : 1.0), 2.0), 0.8);
    // Gerbs fire while the flames rest.
    float gerb = (1.0 - f) * (pattern < 0.5 ? smoothstep(1.4, 1.8, local) * (1.0 - smoothstep(3.6, 4.0, local)) : (pattern > 2.5 ? 1.0 : 0.0));
    stageGlow += f + gerb * 0.3;
    vec2 q = p - vec2(x, 0.0);
    if (abs(q.x) > 0.25) continue;

    if (f > 0.01) {
      // A flame jet: a turbulent column, hottest at the nozzle.
      float H = 0.75 * f;
      float y = q.y / max(H, 1e-3);
      if (y < 1.3) {
        float turb = fbm(vec2(q.x * 10.0 + fj * 7.0, q.y * 5.0 - t * 6.0), 4);
        float wdt = 0.012 + q.y * 0.13;
        float dx = q.x + (turb - 0.5) * 0.12 * q.y * 2.0;
        float core = exp(-dx * dx / (wdt * wdt));
        float heat = core * (1.0 - smoothstep(0.2, 1.2, y + (turb - 0.5) * 0.5)) * f * 1.4;
        col += flameRamp(heat) * smoothstep(0.03, 0.3, heat) * 1.6;
      }
    }
    if (gerb > 0.01) {
      // A gerb: streaks of sparks shooting straight up.
      float gx = q.x * 90.0;
      float top = 0.55 + 0.1 * sin(t * 3.0 + fj);
      if (abs(gx) < 4.0) {
        float lane = floor(gx);
        float speedY = 3.0 + hash12(vec2(lane, fj)) * 2.0;
        float cy = q.y * 6.0 - t * speedY + hash12(vec2(fj, lane)) * 10.0;
        float cell = floor(cy);
        vec2 r = hash22(vec2(lane + fj * 9.0, cell));
        float lit = step(0.45, r.x) * (1.0 - abs(gx) / 4.0);
        float tailF = fract(cy);
        float spark = lit * smoothstep(0.45, 0.95, tailF) * (1.0 - smoothstep(0.95, 1.0, tailF));
        float across = exp(-pow((fract(gx) - 0.5 - (r.y - 0.5) * 0.6) * 5.0, 2.0));
        col += mix(uSparks, vec3(1.0), 0.3) * spark * across * gerb * (1.0 - smoothstep(top * 0.4, top, q.y)) * 1.4;
      }
      col += uSparks * exp(-abs(q.x) * 60.0) * (1.0 - smoothstep(0.0, top, q.y)) * gerb * 0.12;
      col += uSparks * exp(-length(q * vec2(1.0, 2.0)) * 40.0) * gerb;
    }
  }
  // The stage edge, lit by the fire.
  col += uFlame * stageGlow / jets * 0.6 * exp(-p.y * 6.0);
  col = 1.0 - exp(-max(col, 0.0) * 1.2);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Ice", values: { uFlame: [0.3, 0.6, 1], uSparks: [0.85, 0.95, 1], uBeam: [0.7, 0.4, 1] } },
    { name: "Full stage", values: { uJets: 12, uSpeed: 1.4, uBeams: 1.6 } },
  ],
};

/** Pyrotechnics: fireworks, sparks, explosions and smoke. */
export const pyroShaders: ShaderEffect[] = [fireworks, sparkler, explosion, sparkFountain, romanCandle, fuseBurn, smokeBomb, lightShow];
