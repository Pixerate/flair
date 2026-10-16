import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Bubbles. Soap bubbles and bubble wrap read the pointer built-ins the
 * wrapper declares (`iClicks[8]`: xy pixels, z the `iTime` of the click, w 1
 * for a click), and play a demo while idle that a `uDemo` control turns off.
 * Soap bubbles are a transparent overlay: straight colour with coverage alpha.
 */

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

export const soapBubbles: ShaderEffect = {
  kind: "shader",
  id: "soap-bubbles",
  name: "Soap bubbles",
  description: "Iridescent soap bubbles drifting and wobbling, with swirling thin-film colours, a window highlight and clear centres, popping into droplets at clicks or on their own.",
  category: "bubble",
  tags: ["bubble", "soap", "overlay", "iridescent", "interactive", "click", "playful"],
  transparent: true,
  source: glsl(
    `// Soap bubbles: thin-film bubbles drifting up and popping at clicks or when their time is up.
uniform int uCount;          // @control min=1 max=16 default=9 label="Bubbles"
uniform float uSize;         // @control min=0.3 max=2 default=1 label="Size"
uniform float uRise;         // @control min=0 max=0.3 default=0.06 label="Rise speed"
uniform float uLife;         // @control min=2 max=20 default=8 label="Lifetime"
uniform float uWobble;       // @control min=0 max=2 default=1 label="Wobble"
uniform float uThickness;    // @control min=150 max=1200 default=480 label="Film thickness (nm)"
uniform float uSwirl;        // @control min=0 max=3 default=1 label="Swirl"
uniform float uIridescence;  // @control min=0 max=1 default=1 label="Iridescence"
uniform float uOpacity;      // @control min=0.2 max=1 default=0.85 label="Opacity"
uniform bool uDemo;          // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    OVER,
    `// Bubble i at time t: centre and radius (xyz, in screen heights) and which life it is on (w).
// age is the seconds into that life, life how long it lasts before popping on its own.
vec4 bubbleAt(int i, float t, out float age, out float life) {
  vec2 h = hash22(vec2(float(i) * 3.17 + 0.5, 11.3));
  life = uLife * (0.7 + 0.6 * h.x);
  float period = life + 0.8 + 1.5 * h.y;
  float local = t + h.y * period * 7.0;
  float k = floor(local / period);
  age = local - k * period;
  vec2 r = hash22(vec2(float(i) * 1.91 + k * 7.37, k + 2.1));
  float aspect = iResolution.x / iResolution.y;
  float radius = uSize * mix(0.05, 0.12, r.y * r.y);
  vec2 c = vec2((0.08 + 0.84 * r.x) * aspect, 0.1 + 0.45 * hash12(r * 13.1 + 0.7));
  c.y += uRise * age;
  c.x += 0.05 * uWobble * sin(age * (0.7 + r.y) + r.x * 6.28) + 0.02 * sin(age * 1.9 + k);
  return vec4(c, radius * smoothstep(0.0, 0.6, age), k);
}

// Click j, newest first; idle, the demo pokes a bubble every couple of seconds.
vec4 clickAt(int j, bool demo) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[j];
  float k = floor(iTime / 2.2) - float(j);
  float tc = k * 2.2;
  int b = int(hash12(vec2(k, 5.3)) * float(uCount));
  float age;
  float life;
  vec4 at = bubbleAt(b, tc, age, life);
  return vec4(at.xy * iResolution.y, tc, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec4 acc = vec4(0.0);
  // The clicks are the same for every bubble, so look them up once.
  vec4 clicks[8];
  for (int j = 0; j < 8; j++) clicks[j] = clickAt(j, uDemo);
  // Nothing of a bubble reaches further than this from where it is now: its pop (up to 0.7 s
  // ago, so it has drifted at most this far since) throws droplets out to 3.6 radii + 0.1.
  float drift = 0.7 * (uRise + 0.085 * uWobble + 0.04);
  float far = max(uSize * 0.12, 0.01) * 3.6 + 0.1 + drift + 2.0 * px;
  for (int i = 0; i < 16; i++) {
    if (i >= uCount) break;
    float age;
    float life;
    vec4 b = bubbleAt(i, iTime, age, life);
    vec2 d0 = p - b.xy;
    if (dot(d0, d0) > far * far) continue;
    float birth = iTime - age;
    // It pops when its life is up, or at the first click that lands on it.
    float popAt = birth + life;
    for (int j = 0; j < 8; j++) {
      vec4 c = clicks[j];
      if (c.w < 0.5 || c.z < birth || c.z > iTime || c.z >= popAt) continue;
      float a2;
      float l2;
      vec4 then = bubbleAt(i, c.z, a2, l2);
      if (then.w != b.w || a2 >= l2) continue;
      if (length(c.xy * px - then.xy) < then.z * 1.05 + 0.01) popAt = c.z;
    }
    if (iTime < popAt) {
      float R = b.z;
      vec2 d = p - b.xy;
      if (R < 1e-4 || dot(d, d) > R * R * 1.4) continue;
      // The film wobbles as it drifts.
      float th = atan(d.y, d.x);
      float fi = float(i);
      float wob = 1.0 + uWobble * (0.025 * sin(3.0 * th + iTime * 2.3 + fi) + 0.02 * sin(2.0 * th - iTime * 1.7 + fi * 2.0));
      vec2 n2 = d / (R * wob);
      float r = length(n2);
      float edge = px / R;
      float inside = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
      if (inside <= 0.0) continue;
      float rr = min(r, 1.0);
      float z = sqrt(1.0 - rr * rr);
      // Thin film: a swirling thickness that drains toward the bottom.
      float sw = iTime * 0.25 * uSwirl + fi * 1.7;
      vec2 q = n2 * 1.6 + vec2(sin(sw), cos(sw * 0.8)) * 1.2;
      float flow = vnoise(q * 1.8 + fi * 3.1) + 0.5 * vnoise(q * 3.7 - vec2(sw, -sw) * 0.6);
      float thick = uThickness * (0.35 + 0.55 * flow + 0.3 * (0.5 - 0.5 * n2.y));
      // Light reflected off both faces interferes: a colour per wavelength, shifting with angle.
      float cosT = sqrt(1.0 - (1.0 - z * z) / 1.77);
      vec3 film = 0.5 - 0.5 * cos(6.28318 * 2.0 * 1.33 * thick * cosT / vec3(650.0, 532.0, 450.0));
      film = mix(vec3(0.8), clamp((film - 0.5) * 1.7 + 0.55, 0.0, 1.0), uIridescence);
      float fres = 0.06 + 0.94 * pow(1.0 - z, 3.0);
      vec3 col = film;
      float a = clamp(0.06 + 0.22 * dot(film, vec3(0.333)) + fres, 0.0, 1.0);
      // A bright rim.
      float rim = smoothstep(0.84, 0.99, r);
      col = mix(col, vec3(1.0), rim * 0.3);
      a = max(a, rim * 0.75);
      // A window reflected top left, its panes curved by the bubble, and a glint bottom right.
      vec2 wq = (n2 - vec2(-0.36, 0.38)) * (1.0 + 0.5 * dot(n2, n2));
      wq.x += 0.22 * wq.y;
      vec2 e = abs(wq) - vec2(0.15, 0.12);
      float box = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 0.04;
      float win = 1.0 - smoothstep(-edge * 2.0, edge * 2.0 + 0.012, box);
      float bars = min(smoothstep(0.008, 0.022, abs(wq.x)), smoothstep(0.008, 0.022, abs(wq.y)));
      win *= mix(0.3, 1.0, bars);
      vec2 s = n2 - vec2(0.45, -0.48);
      float glint = exp(-dot(s, s) / 0.004) * 0.7;
      col = mix(col, vec3(1.0), clamp(win + glint, 0.0, 1.0));
      a = max(a, max(win * 0.95, glint));
      acc = over(acc, col, a * inside * uOpacity);
    } else {
      // Popped: a ring snapping outward and droplets thrown off, falling as they shrink.
      float dt = iTime - popAt;
      if (dt > 0.7) continue;
      float a2;
      float l2;
      vec4 then = bubbleAt(i, popAt, a2, l2);
      float R = max(then.z, 0.01);
      vec2 d = p - then.xy;
      float reach = R * 3.6 + 0.1;
      if (dot(d, d) > reach * reach) continue;
      float ringW = px * 1.5 + R * 0.03;
      float x = (length(d) - R * (1.0 + dt * 2.0)) / ringW;
      float ring = exp(-x * x) * (1.0 - smoothstep(0.0, 0.18, dt));
      acc = over(acc, vec3(1.0), ring * 0.8 * uOpacity);
      float fade = 1.0 - dt / 0.7;
      for (int k = 0; k < 12; k++) {
        vec2 hh = hash22(vec2(float(k) + float(i) * 13.0, then.w * 3.3 + 1.0));
        float ang = (float(k) + hh.x * 0.6) / 12.0 * 6.28318;
        vec2 pos = then.xy + vec2(cos(ang), sin(ang)) * R * (1.0 + (0.6 + hh.y) * dt * 2.2) - vec2(0.0, 0.5 * dt * dt);
        float dr = R * 0.05 * (0.6 + hh.y) * fade + px;
        float drop = 1.0 - smoothstep(dr - px, dr + px, length(p - pos));
        vec3 tint = 0.5 + 0.5 * cos(6.28318 * (hh.x + vec3(0.0, 0.33, 0.67)));
        acc = over(acc, mix(vec3(1.0), tint, 0.35), drop * uOpacity * fade);
      }
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Big and slow", values: { uCount: 5, uSize: 1.7, uRise: 0.03, uLife: 14, uWobble: 1.4 } },
    { name: "Golden film", values: { uThickness: 900, uSwirl: 0.6 } },
    { name: "Many small", values: { uCount: 16, uSize: 0.5, uRise: 0.1, uLife: 5 } },
  ],
};

export const underwaterBubbles: ShaderEffect = {
  kind: "shader",
  id: "underwater-bubbles",
  name: "Underwater bubbles",
  description: "Bubbles rising and wobbling over a picture tinted blue-green, with caustic light rippling across it.",
  category: "bubble",
  video: "filter",
  tags: ["bubble", "image", "underwater", "water", "caustics", "ocean"],
  source: glsl(
    `// Underwater bubbles: a picture under water, bubbles rising through it and caustic light playing across it.
uniform sampler2D uImage;     // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform int uCount;           // @control min=4 max=40 default=22 label="Bubbles"
uniform float uSize;          // @control min=0.3 max=2.5 default=1 label="Bubble size"
uniform float uSpeed;         // @control min=0 max=2 default=0.6 label="Rise speed"
uniform vec3 uTint;           // @control color default=#0E7C86 label="Water"
uniform float uTintAmount;    // @control min=0 max=1 default=0.55 label="Tint"
uniform float uCaustics;      // @control min=0 max=2 default=1 label="Caustics"
uniform float uWaviness;      // @control min=0 max=1 default=0.35 label="Waviness"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    PICTURE,
    `// Caustic light: a web of bright lines, slowly shifting.
float caustic(vec2 uv, float t) {
  vec2 p = uv * 6.28318 - 250.0;
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return min(pow(abs(c), 8.0), 1.5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x / iResolution.y;
  // The water bends the view a little.
  vec2 wave = uWaviness * 0.006 * vec2(sin(p.y * 14.0 + iTime * 1.3) + 0.5 * sin(p.x * 23.0 - iTime * 1.7), cos(p.x * 12.0 - iTime * 1.1));
  vec2 lens = vec2(0.0);
  float cover = 0.0;
  float rim = 0.0;
  float shine = 0.0;
  for (int i = 0; i < 40; i++) {
    if (i >= uCount) break;
    vec2 h = hash22(vec2(float(i) * 2.13 + 0.7, 4.1));
    float h3 = hash12(h * 37.0 + 1.3);
    float R = uSize * mix(0.012, 0.045, h3 * h3);
    // Big bubbles rise faster and sway wider.
    float speed = uSpeed * (0.12 + 3.0 * R);
    float travel = 1.15 + 4.0 * R;
    float y = mod(h.y * travel + iTime * speed, travel) - 2.0 * R - 0.05;
    float x = h.x * aspect + 0.03 * sin(iTime * (1.5 + h3) + h.y * 30.0 + y * 8.0) * (0.5 + 10.0 * R);
    vec2 d = p - vec2(x, y);
    // Squashing and stretching as they wobble up.
    float sq = 1.0 + 0.12 * sin(iTime * 9.0 * (0.6 + h3) + h.x * 20.0) * min(1.0, R * 30.0);
    d *= vec2(1.0 / sq, sq);
    float r = length(d) / R;
    float edge = px / R;
    if (r > 1.0 + 2.0 * edge) continue;
    vec2 n = d / R;
    float rr = min(r, 1.0);
    float z = sqrt(1.0 - rr * rr);
    cover = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
    // A bubble is a small lens that flips what is behind it.
    lens = -n * R * 0.7;
    rim = pow(1.0 - z, 2.5);
    vec2 s = n - vec2(-0.35, 0.4);
    shine = exp(-dot(s, s) / 0.025) + 0.4 * exp(-dot(n - vec2(0.4, -0.45), n - vec2(0.4, -0.45)) / 0.01);
  }
  vec2 suv = uv + wave + lens * vec2(1.0 / aspect, 1.0) * cover;
  vec4 pic = pictureRGBA(uImage, suv);
  vec3 col = pic.rgb;
  // Deeper is bluer and darker; near the surface it is lighter.
  vec3 water = uTint * (0.45 + 0.7 * uv.y);
  col = mix(col, water + col * uTint * 0.9, uTintAmount * (0.65 + 0.35 * (1.0 - uv.y)));
  float light = caustic(p * 0.9 + wave * 20.0, iTime * 0.5);
  col += uCaustics * light * 0.3 * vec3(0.8, 1.0, 0.95) * (0.35 + 0.65 * uv.y);
  // Soft shafts of light from the surface.
  float shafts = vnoise(vec2(p.x * 5.0 + p.y * 1.2, iTime * 0.25));
  col += uCaustics * 0.1 * shafts * uv.y * uv.y * vec3(0.8, 1.0, 1.0);
  col = mix(col, col * 1.1 + 0.04, cover * 0.5);
  col += cover * (rim * 0.85 * vec3(0.85, 1.0, 1.0) + shine * 0.9);
  fragColor = vec4(col, max(pic.a, cover));
}`,
  ),
  presets: [
    { name: "Tropical", values: { uTint: [0.1, 0.65, 0.75], uTintAmount: 0.4, uCaustics: 1.4 } },
    { name: "Deep", values: { uTint: [0.03, 0.18, 0.35], uTintAmount: 0.8, uCaustics: 0.5, uCount: 12, uSpeed: 0.4 } },
    { name: "Fish tank", values: { uCount: 40, uSize: 0.6, uSpeed: 1.2, uTintAmount: 0.3 } },
  ],
};

export const fizz: ShaderEffect = {
  kind: "shader",
  id: "fizz",
  name: "Fizz",
  description: "Carbonation: tiny bubbles streaming up in columns from nucleation points, growing and speeding up as they rise through the drink.",
  category: "bubble",
  tags: ["bubble", "fizz", "drink", "champagne", "soda", "carbonation", "background"],
  source: glsl(
    `// Fizz: bubble streams rising from nucleation points, accelerating and growing, plus a few loose bubbles.
uniform vec3 uDrink;       // @control color default=#E3B23C label="Drink"
uniform vec3 uBubble;      // @control color default=#FFF7DC label="Bubbles"
uniform int uStreams;      // @control min=1 max=24 default=12 label="Streams"
uniform float uRate;       // @control min=2 max=30 default=12 label="Bubbles per second"
uniform float uAccel;      // @control min=0.1 max=3 default=1 label="Acceleration"
uniform float uSize;       // @control min=0.3 max=2.5 default=1 label="Size"
uniform float uWiggle;     // @control min=0 max=2 default=1 label="Wiggle"
uniform int uLoose;        // @control min=0 max=30 default=12 label="Loose bubbles"`,
    HASH,
    `// A bubble at p's offset d from its centre, radius R: how much it covers, and its colour over col.
vec3 bubble(vec3 col, vec2 d, float R, float px) {
  float dl = length(d);
  float cover = 1.0 - smoothstep(R - px, R + px, dl);
  if (cover <= 0.0) return col;
  float rim = smoothstep(0.35 * R, R, dl);
  col = mix(col, uBubble, cover * (0.2 + 0.7 * rim));
  vec2 s = d + vec2(0.3, -0.3) * R;
  col = mix(col, vec3(1.0), cover * (1.0 - smoothstep(0.0, 0.3 * R + px, length(s))));
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  // The drink, lit through the glass: darker below, with a soft highlight band.
  vec3 col = uDrink * (0.6 + 0.5 * uv.y);
  col += uDrink * 0.25 * exp(-(uv.x - 0.3) * (uv.x - 0.3) / 0.012);
  col *= 1.0 - 0.25 * pow(abs(uv.x - 0.5) * 2.0, 3.0);
  const float v0 = 0.03;
  float acc = 0.12 * uAccel;
  for (int s = 0; s < 24; s++) {
    if (s >= uStreams) break;
    vec2 h = hash22(vec2(float(s) * 4.7 + 1.0, 8.3));
    float hs = hash12(h * 29.0 + 3.0);
    vec2 site = vec2((0.04 + 0.92 * h.x) * aspect, 0.02 + 0.4 * h.y * h.y);
    float dy = p.y - site.y;
    if (dy < -0.02 || abs(p.x - site.x) > 0.03 * uSize + 0.02 * uWiggle) continue;
    float rate = uRate * (0.5 + hs);
    // The age a bubble has when it reaches this height: y = v0 t + a t² / 2.
    float ageHere = (-v0 + sqrt(v0 * v0 + 2.0 * acc * max(dy, 0.0))) / acc;
    float nf = floor((iTime - ageHere) * rate - hs * 7.0);
    for (int k = -1; k <= 1; k++) {
      float n = nf + float(k);
      if (hash12(vec2(n, float(s) + 0.5)) < 0.15) continue;
      float age = iTime - (n + hs * 7.0) / rate;
      if (age < 0.0) continue;
      float y = site.y + v0 * age + 0.5 * acc * age * age;
      float R = uSize * (0.0015 + 0.0035 * sqrt(max(y - site.y, 0.0) * 3.0));
      float x = site.x + uWiggle * 0.004 * sin(age * 14.0 + n * 1.3) * min(age, 1.0);
      col = bubble(col, p - vec2(x, y), R, px);
    }
  }
  // Loose bubbles drifting up on their own.
  for (int i = 0; i < 30; i++) {
    if (i >= uLoose) break;
    vec2 h = hash22(vec2(float(i) * 1.9 + 0.3, 2.2));
    float hs = hash12(h * 13.0);
    float R = uSize * mix(0.002, 0.006, hs);
    float y = mod(h.y * 1.2 + iTime * (0.05 + 0.1 * hs) * uAccel, 1.2) - 0.1;
    float x = h.x * aspect + 0.01 * uWiggle * sin(iTime * (1.0 + hs) + h.y * 20.0);
    col = bubble(col, p - vec2(x, y), R, px);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Cola", values: { uDrink: [0.22, 0.08, 0.03], uBubble: [0.9, 0.75, 0.6], uRate: 20, uStreams: 18, uLoose: 24 } },
    { name: "Sparkling water", values: { uDrink: [0.62, 0.82, 0.92], uBubble: [1, 1, 1], uSize: 1.4, uAccel: 1.4 } },
    { name: "Rosé", values: { uDrink: [0.95, 0.55, 0.55], uBubble: [1, 0.92, 0.9], uRate: 8 } },
  ],
};

export const foam: ShaderEffect = {
  kind: "shader",
  id: "foam",
  name: "Foam",
  description: "Dense suds of packed bubbles in many sizes, shaded and faintly iridescent, settling slowly as some pop and their neighbours close in.",
  category: "bubble",
  tags: ["bubble", "foam", "suds", "soap", "texture", "background"],
  source: glsl(
    `// Foam: a weighted Voronoi (power diagram) of bubbles, each shaded as a shallow dome with dark walls.
uniform vec3 uBase;          // @control color default=#F2F5FA label="Bubbles"
uniform vec3 uWall;          // @control color default=#6D7E96 label="Shadows"
uniform float uScale;        // @control min=3 max=30 default=9 label="Scale"
uniform float uVariety;      // @control min=0 max=1 default=0.7 label="Size variety"
uniform float uPopping;      // @control min=0 max=1 default=0.3 label="Popping"
uniform float uSettle;       // @control min=0 max=1 default=0.3 label="Settling"
uniform float uIridescence;  // @control min=0 max=1 default=0.45 label="Iridescence"`,
    HASH,
    `// Cell g's bubble: centre (xy, in cell units) and power weight (z). A bubble that has just
// popped has a negative weight, so its neighbours close over it as it grows back. since is the
// seconds since it last popped.
vec3 cellAt(vec2 g, out float since) {
  vec2 h = hash22(g);
  float h3 = hash12(g + 17.3);
  vec2 c = g + 0.5 + 0.6 * (h - 0.5) + 0.08 * vec2(sin(iTime * 0.3 + h.x * 6.28), cos(iTime * 0.27 + h.y * 6.28));
  float w = uVariety * 0.4 * h3 * h3;
  since = 1e3;
  if (hash12(g + 5.1) < uPopping) {
    float period = 9.0 * (0.7 + 0.6 * hash12(g + 9.7));
    float ph = fract(iTime / period + h.x * 3.1);
    since = ph * period;
    w = mix(-0.5, w, smoothstep(0.0, 0.45, ph));
  }
  return vec3(c, w);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * uScale + vec2(0.0, iTime * uSettle * 0.15);
  float px = uScale / iResolution.y;
  vec2 g0 = floor(p);
  // The bubble this point is in: the nearest by power distance.
  float best = 1e9;
  vec2 bc = vec2(0.0);
  vec2 bg = vec2(0.0);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = g0 + vec2(float(i), float(j));
      float s;
      vec3 c = cellAt(g, s);
      vec2 d = p - c.xy;
      float pd = dot(d, d) - c.z;
      if (pd < best) {
        best = pd;
        bc = c.xy;
        bg = g;
      }
    }
  }
  // How far it is to the nearest wall (each wall is a straight bisector), and pops nearby.
  float wall = 1e9;
  float pop = 0.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = g0 + vec2(float(i), float(j));
      float s;
      vec3 c = cellAt(g, s);
      if (s < 0.35) {
        float x = (length(p - c.xy) - (0.15 + s * 1.6)) / 0.05;
        pop = max(pop, exp(-x * x) * (1.0 - s / 0.35));
      }
      if (g == bg) continue;
      vec2 d = p - c.xy;
      float len = length(c.xy - bc);
      if (len < 1e-4) continue;
      wall = min(wall, ((dot(d, d) - c.z) - best) / (2.0 * len));
    }
  }
  float d1 = length(p - bc);
  float R = max(d1 + wall, 1e-3);
  float hh = clamp(wall / R, 0.0, 1.0);
  vec2 u = (p - bc) / R;
  // A shallow dome, lit from the top left.
  vec3 n = normalize(vec3(u * 1.1, sqrt(max(1.0 - dot(u, u), 0.0)) + 0.25));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.7));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float edge = 1.0 - hh;
  // The middle sees through to the foam beneath (darker); toward the walls the film turns bright.
  vec3 col = mix(mix(uWall, uBase, 0.35), uBase, 0.25 + 0.75 * edge * edge);
  col *= 0.75 + 0.35 * diff;
  float cellHash = hash12(bg + 3.3);
  vec3 iri = 0.5 + 0.5 * cos(6.28318 * (cellHash + edge * 1.4 + iTime * 0.04 + vec3(0.0, 0.33, 0.67)));
  col = mix(col, col * (0.6 + 0.8 * iri), uIridescence * 0.5 * edge);
  col += spec * 0.8 * smoothstep(0.1, 0.5, R);
  // The walls between bubbles: a dark seam with a bright lip on each side.
  float seam = 1.0 - smoothstep(0.0, 0.03 + px, wall);
  float lip = smoothstep(0.0, 0.03 + px, wall) * (1.0 - smoothstep(0.03, 0.09 + px, wall));
  col = mix(col, uWall * 0.55, seam * 0.85);
  col += lip * 0.12;
  col += pop * 0.5;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Beer head", values: { uBase: [1, 0.96, 0.86], uWall: [0.72, 0.5, 0.22], uIridescence: 0, uScale: 14 } },
    { name: "Bubble bath", values: { uBase: [1, 0.9, 0.95], uWall: [0.75, 0.5, 0.65], uIridescence: 0.8, uScale: 6 } },
    { name: "Fine lather", values: { uScale: 24, uVariety: 0.4, uPopping: 0.6 } },
  ],
};

export const bubbleWrap: ShaderEffect = {
  kind: "shader",
  id: "bubble-wrap",
  name: "Bubble wrap",
  description: "A sheet of bubble wrap seen from above: click a bubble to pop it flat and crinkled, and it fills back up after a while.",
  category: "bubble",
  tags: ["bubble", "interactive", "click", "playful", "texture", "satisfying"],
  source: glsl(
    `// Bubble wrap: rows of air bubbles on a plastic sheet; clicks pop them, and they refill later.
uniform vec3 uSurface;     // @control color default=#5A6B80 label="Surface"
uniform vec3 uPlastic;     // @control color default=#E3F1FB label="Plastic"
uniform float uRows;       // @control min=3 max=20 default=7 label="Rows"
uniform float uRefill;     // @control min=1 max=60 default=10 label="Refill after (s)"
uniform float uLoop;       // @control min=4 max=40 default=14 label="Demo loop (s)"
uniform bool uDemo;        // @control default=true label="Demo when idle"`,
    HASH,
    NOISE,
    `// The bubble nearest p (in screen heights): its centre (xy) and cell (zw), on staggered rows.
vec4 cellOf(vec2 p) {
  float s = 1.0 / uRows;
  float rh = s * 0.866;
  float j0 = floor(p.y / rh);
  vec4 best = vec4(0.0);
  float bd = 1e9;
  for (int k = -1; k <= 1; k++) {
    float j = j0 + float(k);
    float off = 0.5 * mod(j, 2.0);
    float i0 = floor(p.x / s - off - 0.5);
    for (int m = 0; m <= 1; m++) {
      float i = i0 + float(m);
      vec2 c = vec2((i + 0.5 + off) * s, (j + 0.5) * rh);
      float d = length(p - c);
      if (d < bd) {
        bd = d;
        best = vec4(c, i, j);
      }
    }
  }
  return best;
}

// When the bubble in cell id popped (x) and when it starts to refill (y); x < 0 while it is whole.
vec2 popOf(vec2 id) {
  if (!uDemo || iClicks[0].w > 0.5) {
    float pop = -1.0;
    for (int j = 7; j >= 0; j--) {
      vec4 c = iClicks[j];
      if (c.w < 0.5) continue;
      float age = iTime - c.z;
      if (age < 0.0 || age > uRefill + 0.8) continue;
      vec2 at = c.xy / iResolution.y;
      vec4 cell = cellOf(at);
      if (cell.z != id.x || cell.w != id.y) continue;
      // A click on a bubble that is already flat does nothing.
      if (pop < 0.0 || c.z > pop + uRefill) pop = c.z;
    }
    return vec2(pop, pop + uRefill);
  }
  // Idle: each loop, most bubbles pop at a moment of their own, and all refill as it ends.
  float k = floor(iTime / uLoop);
  float at = (k + 0.04 + 0.8 * hash12(id + k * 7.1)) * uLoop;
  if (hash12(id * 1.3 + k * 3.3 + 0.5) > 0.65 || iTime < at) return vec2(-1.0, 0.0);
  return vec2(at, (k + 1.0) * uLoop - 0.8);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec4 cell = cellOf(p);
  float R = 0.4 / uRows;
  vec2 st = popOf(cell.zw);
  float deflated = st.x < 0.0 ? 0.0 : smoothstep(st.x, st.x + 0.06, iTime) * (1.0 - smoothstep(st.y, st.y + 0.8, iTime));
  float h = 1.0 - 0.88 * deflated;
  vec2 q = (p - cell.xy) / R;
  float r = length(q);
  // The surface under the sheet, each bubble's shadow falling down and right.
  vec3 col = uSurface * (0.92 + 0.08 * vnoise(p * 40.0));
  float shadow = length(q - vec2(0.18, -0.24)) ;
  col *= 1.0 - 0.38 * h * (1.0 - smoothstep(0.75, 1.2, shadow));
  col = mix(col, uPlastic, 0.16);
  float edge = px / R;
  float inside = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
  if (inside > 0.0) {
    float rr = min(r, 1.0);
    float z = sqrt(1.0 - rr * rr);
    vec3 n = vec3(q * h, z + 1.0 - h);
    // Popped plastic crinkles.
    vec2 o = cell.zw * 5.3;
    vec2 wr = vec2(vnoise(q * 4.0 + o), vnoise(q * 4.0 + o + 7.7)) - 0.5;
    float crease = 1.0 - smoothstep(0.0, 0.06, abs(vnoise(q * 3.0 + o + 2.1) - 0.5));
    n.xy += deflated * (wr * 1.6 + crease * 0.3);
    n = normalize(n);
    vec3 L = normalize(vec3(-0.5, 0.6, 0.8));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
    vec3 b = mix(col, uPlastic, 0.18 + 0.4 * pow(1.0 - z, 2.0) * h);
    b *= 0.82 + 0.3 * diff;
    b += spec * (0.85 * h + 0.5 * deflated);
    b += 0.22 * smoothstep(0.72, 0.96, r) * h * vec3(0.9, 0.97, 1.0);
    b -= 0.12 * crease * deflated;
    // The welded seam round each bubble.
    b *= 1.0 - 0.18 * smoothstep(0.9, 1.0, r);
    // A flash as it pops.
    if (st.x >= 0.0) b += 0.35 * (1.0 - smoothstep(0.0, 0.15, iTime - st.x));
    col = mix(col, b, inside);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "On cardboard", values: { uSurface: [0.72, 0.54, 0.36] } },
    { name: "Night", values: { uSurface: [0.07, 0.08, 0.11], uPlastic: [0.75, 0.85, 1] } },
    { name: "Big bubbles", values: { uRows: 4, uRefill: 20 } },
  ],
};

export const lavaBubbles: ShaderEffect = {
  kind: "shader",
  id: "lava-bubbles",
  name: "Lava bubbles",
  description: "Molten bubbles swelling out of a glowing, cracked lava crust and bursting into bright craters with spatter.",
  category: "bubble",
  tags: ["bubble", "lava", "magma", "fire", "volcano", "background"],
  source: glsl(
    `// Lava bubbles: a cracked crust over glowing lava, with bubbles that swell, burst and spatter.
uniform vec3 uHot;         // @control color default=#FFE08A label="Hot"
uniform vec3 uMolten;      // @control color default=#FF4A0D label="Molten"
uniform vec3 uCrust;       // @control color default=#1C0B07 label="Crust"
uniform float uScale;      // @control min=2 max=12 default=4.5 label="Scale"
uniform float uRate;       // @control min=0.05 max=1.5 default=0.35 label="Bubbling"
uniform float uSize;       // @control min=0.2 max=0.9 default=0.55 label="Bubble size"
uniform float uFlow;       // @control min=0 max=1 default=0.25 label="Flow"
uniform float uGlow;       // @control min=0 max=2 default=1 label="Glow"
uniform float uSpatter;    // @control min=0 max=1.5 default=1 label="Spatter"`,
    HASH,
    NOISE,
    FBM,
    `// Temperature (0 crust, 1 white hot) to colour.
vec3 heat(float t) {
  vec3 c = mix(uCrust, uMolten, smoothstep(0.15, 0.55, t));
  c = mix(c, uHot, smoothstep(0.55, 0.9, t));
  return mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.9, 1.15, t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 q = fragCoord / iResolution.y * uScale;
  vec2 drift = vec2(0.05, 0.02) * iTime * uFlow;
  // The crust: plates of cooled rock with glowing cracks between them.
  vec2 w = vec2(fbm(q * 0.5 + drift, 3), fbm(q * 0.5 - drift + 5.2, 3));
  float f = fbm(q * 0.9 + drift + w * 1.5, 5);
  float crack = 1.0 - smoothstep(0.0, 0.05, abs(fbm(q * 1.6 + w + drift * 1.5, 4) - 0.5));
  float T = 0.12 + 0.55 * (1.0 - smoothstep(0.35, 0.62, f)) + 0.4 * crack * smoothstep(0.65, 0.4, f);
  T += 0.06 * sin(iTime * 1.7 + f * 12.0);
  float spec = 0.0;
  vec2 g0 = floor(q);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = g0 + vec2(float(i), float(j));
      vec2 h = hash22(g + 31.7);
      float period = (0.6 + 0.8 * hash12(g * 1.7 + 4.2)) / uRate;
      float tt = iTime / period + h.x * 5.0;
      float cyc = floor(tt);
      float ph = fract(tt);
      // Only some spots bubble each round.
      if (hash12(g + cyc * 1.3 + 8.8) > 0.55) continue;
      vec2 c = g + 0.25 + 0.5 * hash22(g + cyc * 13.1);
      float R = uSize * 0.5 * (0.5 + 0.5 * hash12(g + cyc * 3.1));
      vec2 d = q - c;
      float dl = length(d);
      if (dl > 2.6) continue;
      if (ph < 0.75) {
        // Swelling: a dome of stretched skin, hotter as it thins.
        float s = ph / 0.75;
        float r = R * pow(s, 0.6);
        if (dl < r) {
          float u = dl / r;
          float z = sqrt(1.0 - u * u);
          float m = smoothstep(1.0, 0.85, u);
          float skin = 0.28 + 0.42 * s * z * z + 0.12 * vnoise(d / r * 3.0 + cyc * 7.0);
          T = mix(T, max(T * 0.7, skin), m);
          vec3 n = vec3(d / r, z);
          spec = max(spec, pow(max(dot(n, normalize(vec3(-0.4, 0.5, 0.8))), 0.0), 24.0) * s * m * 0.7);
        } else {
          // A darker lip of crust pushed up round it.
          float x = (dl - r) / (0.08 * R + 0.02);
          T *= 1.0 - 0.35 * s * exp(-x * x);
        }
      } else {
        // Burst: a bright crater cooling, a ring rolling out and spatter thrown up and landing.
        float b = (ph - 0.75) / 0.25;
        float rc = R * (1.0 + 0.25 * b);
        if (dl < rc) {
          float u = dl / rc;
          T = max(T, mix(1.1, 0.45, b) * (1.0 - 0.35 * u * u));
        }
        float x = (dl - rc * (1.0 + b * 1.2)) / 0.06;
        T += 0.25 * exp(-x * x) * (1.0 - b);
        for (int k = 0; k < 8; k++) {
          if (uSpatter <= 0.0) break;
          vec2 hk = hash22(vec2(float(k), cyc) + g * 3.3);
          float ang = (float(k) + hk.x) / 8.0 * 6.28318;
          float dist = min(rc + b * R * (1.2 + 1.6 * hk.y) * uSpatter, 2.2);
          float alt = sin(3.14159 * b);
          vec2 pos = c + vec2(cos(ang), sin(ang)) * dist;
          float sz = R * 0.09 * (0.6 + hk.y) * (0.6 + 0.8 * alt);
          float drop = 1.0 - smoothstep(sz * 0.5, sz, length(q - pos));
          T = mix(T, max(T, 1.0 - 0.45 * b), drop);
        }
      }
    }
  }
  vec3 col = heat(T);
  col += uMolten * uGlow * 0.35 * smoothstep(0.4, 1.0, T);
  col *= 0.7 + 0.3 * uGlow;
  col += spec * 0.5 * vec3(1.0, 0.9, 0.7);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Sulphur blue", values: { uHot: [0.75, 0.95, 1], uMolten: [0.1, 0.45, 1], uCrust: [0.02, 0.03, 0.08] } },
    { name: "Mud pot", values: { uHot: [0.75, 0.68, 0.58], uMolten: [0.45, 0.38, 0.3], uCrust: [0.2, 0.17, 0.14], uGlow: 0.2, uSpatter: 0.6 } },
    { name: "Boiling", values: { uRate: 1.2, uSize: 0.4, uScale: 6 } },
  ],
};

/** Bubbles: soap, underwater, fizz, foam, bubble wrap and lava. */
export const bubbleShaders: ShaderEffect[] = [soapBubbles, underwaterBubbles, fizz, foam, bubbleWrap, lavaBubbles];
