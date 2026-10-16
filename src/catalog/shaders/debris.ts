import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Debris: things breaking up and falling. Pieces move ballistically with air
 * drag (`ballistic`), tumble as they go and bounce or settle on a floor where
 * there is one. Each piece is found by working back from the pixel to the
 * piece's resting shape (a cell, a shard, a chunk), so loops stay bounded.
 */

/**
 * `ballistic(v, k, g, t)`: how far a piece launched at velocity `v` has moved
 * after `t` seconds, slowed by air drag `k` and pulled down by gravity `g`.
 */
const BALLISTIC = `
vec2 ballistic(vec2 v, float k, float g, float t) {
  float e = (1.0 - exp(-k * t)) / k;
  return v * e - vec2(0.0, g / k * (t - e));
}`.trim();

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `rock(q, r, seed)`: an irregular seven-sided stone of about radius `r`
 * around the origin, from hashed vertices: x is the distance to its outline
 * (negative inside), yz the outward normal of the nearest face.
 * `shadeRock` lights it as bevelled facets with a speckled surface.
 */
const ROCK = `
const float TAU = 6.28318;
vec3 rock(vec2 q, float r, float seed) {
  float a = atan(q.y, q.x);
  if (a < 0.0) a += TAU;
  float wedge = TAU / 7.0;
  float i = floor(a / wedge);
  float i1 = i + 1.0;
  vec2 A = vec2(cos(i * wedge), sin(i * wedge)) * r * (0.62 + 0.38 * hash12(vec2(mod(i, 7.0), seed)));
  vec2 B = vec2(cos(i1 * wedge), sin(i1 * wedge)) * r * (0.62 + 0.38 * hash12(vec2(mod(i1, 7.0), seed)));
  vec2 e = B - A;
  vec2 n = normalize(vec2(e.y, -e.x));
  return vec3(dot(q - A, n), n);
}
// A stone's colour at local point q, its frame turned by ang: flat top, bevelled faces lit from the upper left.
vec3 shadeRock(vec2 q, vec3 rk, float r, float ang, vec3 base, float seed) {
  float inner = clamp(-rk.x / (r * 0.3), 0.0, 1.0);
  vec2 face = rot(ang) * rk.yz;
  vec3 n = normalize(vec3(face * (0.25 + 1.3 * (1.0 - inner)), 1.0));
  float diff = clamp(dot(n, normalize(vec3(-0.45, 0.65, 0.6))), 0.0, 1.0);
  float speck = 0.6 * vnoise(q / r * 9.0 + seed * 13.0) + 0.4 * hash12(floor(q / r * 30.0) + seed);
  vec3 col = base * (0.3 + 0.9 * diff) * (0.8 + 0.35 * speck);
  return col * (1.0 - 0.3 * smoothstep(-r * 0.08, 0.0, rk.x));
}`.trim();

export const rubbleFall: ShaderEffect = {
  kind: "shader",
  id: "rubble-fall",
  name: "Rubble fall",
  description: "Chunks of rock and concrete tumbling down, bouncing in puffs of dust and settling on a heap of rubble.",
  category: "debris",
  tags: ["debris", "rubble", "rock", "falling", "dust", "overlay", "loop"],
  transparent: true,
  loop: 6,
  source: glsl(
    `// Rubble fall: stones fall, tumble, bounce in dust puffs and crumble into the heap.
uniform vec3 uRock;          // @control color default=#7D746B label="Rock"
uniform vec3 uConcrete;      // @control color default=#B8B2A6 label="Concrete"
uniform vec3 uDust;          // @control color default=#CDBFA6 label="Dust"
uniform float uCount;        // @control min=3 max=20 default=7 label="Chunks across"
uniform float uSize;         // @control min=0.3 max=1 default=0.9 label="Chunk size"
uniform float uGravity;      // @control min=1 max=6 default=3 label="Gravity"
uniform float uBounce;       // @control min=0 max=0.7 default=0.35 label="Bounciness"
uniform float uPile;         // @control min=0 max=0.3 default=0.12 label="Heap height"
uniform float uDustAmount;   // @control min=0 max=1.5 default=1 label="Dust"`,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    OVER,
    ROCK,
    `const float PERIOD = 6.0;

float heapTop(float x) {
  return -0.5 + uPile * (0.45 + 0.55 * vnoise(vec2(x * 2.5, 1.7)));
}

// A puff of dust at 'at', 'age' seconds old: spreading low and wide, thinning as it goes.
float puff(vec2 p, vec2 at, float size, float age, float life, float seed) {
  if (age < 0.0 || age > life) return 0.0;
  float R = size * (1.0 + 2.2 * sqrt(age));
  vec2 d = p - at - vec2(0.0, 0.3 * R);
  d.y *= 1.7;
  float l = length(d);
  if (l > R) return 0.0;
  float fade = 1.0 - age / life;
  float n = fbm(p * 22.0 + seed * 7.3 - vec2(0.0, age * 0.6), 3);
  return smoothstep(R, R * 0.15, l) * fade * fade * (0.3 + 1.1 * n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float cw = iResolution.x / iResolution.y / uCount;
  vec4 acc = vec4(0.0);

  // The heap: small stones packed below a bumpy top, darker the deeper they lie.
  float gs = max(cw * 0.42 * uSize, 0.015);
  vec2 gc = floor(p / gs);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = gc + vec2(float(i), float(j));
      vec2 h = hash22(c + 5.3);
      vec2 site = (c + 0.25 + 0.5 * h) * gs;
      float top = heapTop(site.x);
      if (site.y > top) continue;
      float r = gs * (0.7 + 0.25 * h.y);
      float ang = h.x * TAU;
      vec2 q = rot(-ang) * (p - site);
      if (length(q) > r * 1.05) continue;
      float seed = c.x * 7.1 + c.y * 1.3;
      vec3 rk = rock(q, r, seed);
      float cover = smoothstep(px, -px, rk.x);
      if (cover <= 0.0) continue;
      float depth = clamp((top - site.y) / max(uPile, 0.03), 0.0, 1.0);
      vec3 base = mix(uRock, uConcrete, step(0.55, h.y)) * (0.85 + 0.3 * h.x);
      acc = over(acc, shadeRock(q, rk, r, ang, base, seed) * (1.0 - 0.6 * depth), cover);
    }
  }

  // Falling chunks: three to a column, each falling, bouncing, settling and crumbling once a cycle.
  // Two columns either side, as dust spreads further than the stones reach.
  float dust = 0.0;
  float col = floor(p.x / cw);
  for (int k = -2; k <= 2; k++) {
    float c = col + float(k);
    for (int j = 0; j < 3; j++) {
      vec2 id = vec2(c, float(j));
      vec4 h = vec4(hash22(id + 0.37), hash22(id + 9.1));
      float ta = mod(iTime - (float(j) + h.x) * PERIOD / 3.0, PERIOD);
      float r = cw * 0.42 * uSize * (0.6 + 0.4 * h.y);
      float x0 = (c + 0.5 + 0.3 * (h.z - 0.5)) * cw;
      float rest = heapTop(x0) + r * 0.45;
      float y0 = 0.55 + r + 0.35 * h.w;
      float t1 = sqrt(2.0 * (y0 - rest) / uGravity);
      float vx0 = (h.z - 0.5) * 0.25 * cw;
      float vx1 = (h.w - 0.5) * 1.2 * cw * uBounce;
      float spin = (h.y - 0.5) * 7.0;
      vec2 pos;
      float ang;
      if (ta < t1) {
        pos = vec2(x0 + vx0 * ta, y0 - 0.5 * uGravity * ta * ta);
        ang = h.x * TAU + spin * ta;
      } else {
        // Bounces, each lower by the bounciness, then it rests; it skids and rolls a little, slowing.
        float tau = ta - t1;
        float y = rest;
        float v = uGravity * t1 * uBounce;
        float tb = tau;
        for (int b = 0; b < 3; b++) {
          float dur = 2.0 * v / uGravity;
          if (tb < dur) {
            y = rest + v * tb - 0.5 * uGravity * tb * tb;
            break;
          }
          tb -= dur;
          v *= uBounce;
        }
        pos = vec2(x0 + vx0 * t1 + vx1 * (1.0 - exp(-3.0 * tau)) / 3.0, y);
        ang = h.x * TAU + spin * t1 + spin * 0.5 * (1.0 - exp(-2.5 * tau)) / 2.5;
        dust += puff(p, vec2(x0 + vx0 * t1, rest - r * 0.4), r, tau, 1.6, id.x + id.y * 3.1);
      }
      // At the end of its cycle it crumbles into the heap.
      float crumble = smoothstep(PERIOD - 0.9, PERIOD - 0.15, ta);
      dust += 0.6 * puff(p, pos - vec2(0.0, r * 0.3), r * 0.6, ta - (PERIOD - 0.9), 0.9, id.y + id.x * 1.7);
      vec2 q = rot(-ang) * (p - pos);
      if (length(q) > r * 1.05) continue;
      float seed = id.x * 3.7 + id.y * 11.0;
      vec3 rk = rock(q, r, seed);
      float bits = hash12(floor(q / (r * 0.2)) + id * 3.0);
      float cover = smoothstep(px, -px, rk.x) * step(crumble, bits);
      if (cover <= 0.0) continue;
      vec3 base = mix(uRock, uConcrete, step(0.5, h.z)) * (0.85 + 0.3 * h.w);
      acc = over(acc, shadeRock(q, rk, r, ang, base, seed), cover);
    }
  }
  float n = vnoise(p * 40.0);
  acc = over(acc, uDust * (0.8 + 0.3 * n), clamp(dust * uDustAmount, 0.0, 0.9));
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Demolition", values: { uRock: [0.55, 0.54, 0.52], uConcrete: [0.78, 0.77, 0.74], uDust: [0.85, 0.84, 0.8], uDustAmount: 1.5, uBounce: 0.25 } },
    { name: "Boulders", values: { uCount: 5, uSize: 1, uBounce: 0.18, uGravity: 2.2, uPile: 0.2 } },
    { name: "Gravel shower", values: { uCount: 18, uSize: 0.5, uBounce: 0.5, uPile: 0.06, uDustAmount: 0.6 } },
  ],
};

export const glassShatter: ShaderEffect = {
  kind: "shader",
  id: "glass-shatter",
  name: "Glass shatter",
  description: "A picture that cracks like a pane of glass where you click, its shards falling away and spinning before it mends.",
  category: "debris",
  video: "interactive",
  tags: ["debris", "glass", "shatter", "image", "click", "interactive", "break"],
  source: glsl(
    `// Glass shatter: radial and concentric cracks race out from the click; shards fall away, then it mends.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uBackground;  // @control color default=#0B0D14 label="Behind the glass"
uniform int uSpokes;       // @control min=5 max=16 default=12 label="Radial cracks"
uniform float uGrowth;     // @control min=1.3 max=2.5 default=1.6 label="Ring spacing"
uniform float uScale;      // @control min=0.03 max=0.3 default=0.09 label="First ring size"
uniform float uGravity;    // @control min=0.5 max=4 default=1.8 label="Gravity"
uniform float uSpin;       // @control min=0 max=6 default=2.5 label="Spin"
uniform float uRestore;    // @control min=1.5 max=10 default=3.5 label="Mends after (s)"
uniform bool uDemo;        // @control default=true label="Demo when idle"
${BACKDROP_CONTROLS}`,
    HASH,
    ROTATE,
    BALLISTIC,
    PICTURE,
    `const float TAU = 6.28318;

// The newest click, or with the demo on and no real clicks yet, one every 5.5 s.
vec4 lastClick() {
  if (!uDemo || iClicks[0].w > 0.5) return iClicks[0];
  float k = floor(iTime / 5.5);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.25 + 0.5 * h) * iResolution.xy, k * 5.5 + 0.4, 1.0);
}

// The angle of radial crack i (wrapping every uSpokes).
float spoke(float i) {
  float n = float(uSpokes);
  return (i + 0.6 * (hash12(vec2(mod(i, n), 3.1)) - 0.5)) * TAU / n;
}

const int RINGS = 8;

// How far out concentric crack j (1 and up) crosses sector s: each ring wider than the last, out past the frame.
float ringAt(float s, float j) {
  return uScale * pow(uGrowth, j - 1.0) * (0.85 + 0.3 * hash12(vec2(s, j + 0.5)));
}

// The shard q (from the impact) lies on: x its sector, y its ring, z how far to the nearest crack.
vec3 shardOf(vec2 q) {
  float n = float(uSpokes);
  float a = atan(q.y, q.x);
  if (a < 0.0) a += TAU;
  float s = floor(a / TAU * n);
  if (a < spoke(s)) s -= 1.0;
  else if (a >= spoke(s + 1.0)) s += 1.0;
  float a0 = spoke(s);
  float a1 = spoke(s + 1.0);
  float mid = 0.5 * (a0 + a1);
  float d = dot(q, vec2(cos(mid), sin(mid)));
  float sid = mod(s, n);
  float ring = 0.0;
  float inner = 0.0;
  float outer = 1e3;
  for (int j = 1; j < RINGS; j++) {
    float b = ringAt(sid, float(j));
    if (d < b) {
      outer = b;
      break;
    }
    ring = float(j);
    inner = b;
  }
  float edge = min(outer - d, min(abs(q.x * sin(a0) - q.y * cos(a0)), abs(q.x * sin(a1) - q.y * cos(a1))));
  if (ring > 0.0) edge = min(edge, d - inner);
  return vec3(sid, ring, edge);
}

// A shard's middle, which it turns about, and how far it reaches from there.
vec3 shardCentre(float sid, float ring) {
  float a0 = spoke(sid);
  float a1 = spoke(sid + 1.0);
  float mid = 0.5 * (a0 + a1);
  float inner = ring > 0.0 ? ringAt(sid, ring) : 0.0;
  float outer = ring + 1.0 < float(RINGS) ? ringAt(sid, ring + 1.0) : inner * uGrowth;
  float rc = ring > 0.0 ? 0.5 * (inner + outer) : 0.66 * outer;
  float reach = length(vec2(max(outer - rc, rc - inner), outer * tan(0.5 * (a1 - a0))));
  return vec3(vec2(cos(mid), sin(mid)) * rc, reach + 0.01);
}

// When a shard lets go: the middle first, the outer pane last.
float release(float sid, float ring) {
  return 0.3 + 0.16 * ring + 0.25 * hash12(vec2(sid, ring + 9.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec2 toUv = iResolution.y / iResolution.xy;
  vec4 intact = pictureRGBA(uImage, p * toUv + 0.5);
  vec4 click = lastClick();
  float age = click.w > 0.5 ? iTime - click.z : -1.0;
  if (age < 0.0 || age > uRestore + 1.0) {
    fragColor = intact;
    return;
  }
  vec2 c = (click.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec2 q = p - c;
  vec4 col = vec4(uBackground, 1.0);

  // Shards that have let go, falling and spinning: the first to fall is in front.
  float best = 1e3;
  vec4 hit = vec4(0.0);
  vec2 hitCentre = vec2(0.0);
  for (int s = 0; s < 16; s++) {
    if (s >= uSpokes) break;
    for (int j = 0; j < RINGS; j++) {
      float sid = float(s);
      float ring = float(j);
      float tr = release(sid, ring);
      float dt = age - tr;
      if (dt <= 0.0 || tr >= best) continue;
      vec2 h = hash22(vec2(sid, ring) + 17.3);
      vec3 cen = shardCentre(sid, ring);
      vec2 v0 = normalize(cen.xy + 1e-4) * (0.05 + 0.15 * h.x) / (1.0 + ring) + vec2(0.0, 0.08);
      vec2 rel = q - cen.xy - ballistic(v0, 0.6, uGravity, dt);
      if (length(rel) > cen.z) continue;
      float ang = (h.y - 0.5) * 2.0 * uSpin * dt;
      // It also turns about its own axis, narrowing and catching the light.
      float tilt = cos(dt * (0.6 + 1.2 * h.x) * uSpin);
      vec2 local = rot(-ang) * rel;
      local.x /= sign(tilt) * max(abs(tilt), 0.05);
      vec2 orig = cen.xy + local;
      vec3 sh = shardOf(orig);
      if (sh.x != sid || sh.y != ring) continue;
      best = tr;
      hit = vec4(orig, tilt, sh.z);
      hitCentre = cen.xy;
    }
  }

  if (best < 1e3) {
    vec2 uv = (c + hit.xy) * toUv + 0.5;
    float rim = smoothstep(0.014, 0.0, hit.w);
    vec2 o = normalize(hit.xy - hitCentre + 1e-4) * rim * 0.008;
    vec4 g = pictureRGBA(uImage, uv);
    vec3 pic = vec3(pictureRGBA(uImage, uv + o).r, g.g, pictureRGBA(uImage, uv - o).b);
    float facing = abs(hit.z);
    pic = mix(pic, vec3(0.7, 0.82, 0.88), 0.2 * (1.0 - facing)) * (0.55 + 0.45 * facing);
    pic += rim * (0.3 + 0.7 * pow(1.0 - facing, 2.0)) * vec3(0.9, 0.97, 1.0);
    pic += vec3(0.8, 0.9, 1.0) * pow(max(1.0 - abs(hit.z - 0.3), 0.0), 24.0) * 0.5;
    col = vec4(pic, g.a);
  } else {
    vec3 own = shardOf(q);
    if (age < release(own.x, own.y)) {
      // Still in place: cracks race out, with a little refraction beside each.
      float r = length(q);
      float reach = smoothstep(age * 5.0, age * 5.0 - 0.05, r);
      float crack = smoothstep(px * 1.6, 0.0, own.z) * reach;
      float near = smoothstep(px * 6.0, px * 1.5, own.z) * reach;
      vec4 pic = pictureRGBA(uImage, (p + vec2(0.003, -0.002) * near) * toUv + 0.5);
      vec3 rgb = pic.rgb * (1.0 - 0.18 * near) * (1.0 + reach * 0.08 * (hash12(own.xy) - 0.5)) + 0.85 * crack;
      float crush = smoothstep(0.03, 0.005, r) * (0.4 + 0.6 * hash12(floor(fragCoord / 2.0)));
      col = vec4(mix(rgb, vec3(0.93, 0.96, 1.0), 0.8 * crush), pic.a);
    }
  }
  // Mended: the pane fades back in whole.
  fragColor = mix(col, intact, smoothstep(uRestore, uRestore + 1.0, age));
}`,
  ),
  presets: [
    { name: "Fine crackle", values: { uSpokes: 16, uGrowth: 1.35, uScale: 0.04, uSpin: 3.5 } },
    { name: "Big panes", values: { uSpokes: 7, uGrowth: 2.3, uScale: 0.16, uSpin: 1, uGravity: 1.2 } },
    { name: "Slow motion", values: { uGravity: 0.6, uSpin: 1, uRestore: 7 } },
  ],
};

export const crumblingText: ShaderEffect = {
  kind: "shader",
  id: "crumbling-text",
  name: "Crumbling text",
  description: "Stone letters cracking into chunks from one side, the chunks falling away into dust before the word rebuilds.",
  category: "debris",
  video: "none",
  tags: ["debris", "text", "title", "crumble", "stone", "dust", "loop"],
  loop: 8,
  transparent: true,
  source: glsl(
    `// Crumbling text: chunks crack off from one side, fall and dissolve into dust; then the word rebuilds.
uniform sampler2D uText;        // @control filter=linear wrap=clamp default=${textImage("DECAY")} label="Text"
uniform vec3 uColor;            // @control color default=#C9BBA4 label="Stone"
uniform vec3 uDust;             // @control color default=#E3D8C6 label="Dust"
uniform float uChunk;           // @control min=4 max=20 default=10 label="Chunks (text height)"
uniform float uSize;            // @control min=0.3 max=1 default=0.85 label="Text size"
uniform float uGravity;         // @control min=0.3 max=4 default=1.4 label="Gravity"
uniform bool uFromRight;        // @control default=false label="Crumble from the right"
uniform vec3 uBackground;       // @control color default=#17141F label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.4 label="Crumble (when still)"`,
    HASH,
    NOISE,
    ROTATE,
    BALLISTIC,
    OVER,
    `const float CYCLE = 8.0;
const float LIFE = 1.8;
float textW = 1.0;
float textH = 0.3;
vec2 origin = vec2(0.0);
float cs = 0.03;

float mask(vec2 p) {
  vec2 uv = (p - origin) / vec2(textW, textH);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uText, uv).a;
}

// How far across the text x is, 0 on the side it crumbles from.
float side(float x) {
  float s = (x - origin.x) / textW;
  return uFromRight ? 1.0 - s : s;
}

// Grid coordinates with wobbly cell edges, so chunks break off jagged.
vec2 warped(vec2 p) {
  vec2 g = (p - origin) / cs;
  return g + 0.64 * (vec2(vnoise(g * 1.1 + 3.7), vnoise(g * 1.1 + 9.2)) - 0.5);
}

// When chunk id breaks off.
float breakTime(vec2 id) {
  return 0.7 + 3.3 * clamp(side(origin.x + (id.x + 0.5) * cs), 0.0, 1.0) + 0.45 * hash12(id + 2.3);
}

// Stone at original point q, the chunk turned by ang: grit, and a bevel from the letter edges.
vec3 stone(vec2 q, float ang) {
  float e = 0.004;
  vec2 g = vec2(mask(q + vec2(e, 0.0)) - mask(q - vec2(e, 0.0)), mask(q + vec2(0.0, e)) - mask(q - vec2(0.0, e)));
  vec3 n = normalize(vec3(-(rot(ang) * g) * 0.8, 1.0));
  float diff = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
  float grit = 0.6 * vnoise(q * 140.0) + 0.4 * vnoise(q * 35.0);
  return uColor * (0.45 + 0.7 * diff) * (0.8 + 0.35 * grit);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec2 size = vec2(textureSize(uText, 0));
  float aspect = size.x / max(size.y, 1.0);
  textH = min(uSize * 0.5, iResolution.x / iResolution.y * uSize / aspect);
  textW = textH * aspect;
  origin = vec2(-0.5 * textW, 0.1 - 0.5 * textH);
  cs = textH / uChunk;
  float dirX = uFromRight ? -1.0 : 1.0;
  float tt = uAnimate ? mod(iTime, CYCLE) : uProgress * CYCLE;
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);

  // The standing text: whole until its chunk breaks off, and grain by grain back again at the end.
  float m = mask(p);
  if (m > 0.0) {
    vec2 w = warped(p);
    float td = breakTime(floor(w));
    float tb = 6.0 + 1.3 * side(p.x);
    float grain = hash12(floor(p / (cs * 0.12)));
    float vis = tt < td ? 1.0 : step(grain, smoothstep(tb, tb + 0.6, tt));
    if (vis > 0.0) {
      vec2 f = fract(w);
      float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * cs;
      // Cracks open around a chunk just before it goes.
      float warn = smoothstep(td - 0.6, td, tt) * step(tt, td);
      vec3 c = stone(p, 0.0) * (1.0 - 0.75 * warn * smoothstep(px * 2.0, 0.0, edge));
      acc = over(acc, c, m * vis);
    }
  }

  // Chunks that have broken off: drifting downwind, falling, spinning and crumbling to dust.
  float dust = 0.0;
  float col0 = floor((p.x - origin.x) / cs);
  float rows = ceil(uChunk);
  for (int k = 0; k < 6; k++) {
    float cx = col0 - dirX * float(k - 2);
    if (cx < -1.0 || cx * cs > textW + cs) continue;
    for (int r = -1; r < 21; r++) {
      if (float(r) > rows) break;
      vec2 id = vec2(cx, float(r));
      float a = tt - breakTime(id);
      if (a <= 0.0 || a > LIFE) continue;
      vec2 h = hash22(id + 4.1);
      vec2 centre = origin + (id + 0.5) * cs;
      vec2 off = ballistic(vec2(dirX * (0.5 + h.x), 0.3 + 1.2 * h.y) * cs, 1.5, uGravity, a);
      // Dust: grains shed as it crumbles, lagging behind it and spreading.
      float da = a - 0.35;
      if (da > 0.0) {
        vec2 dc = centre + off * 0.75 + vec2(dirX * 0.5, 0.3) * cs * da;
        float R = cs * (0.5 + 0.8 * da);
        float dd = length(p - dc) / R;
        if (dd < 1.0 && mask(centre) > 0.2) {
          float speck = step(0.55, hash12(floor((p - dc) / (px * 2.5)) + id));
          dust += (1.0 - dd) * smoothstep(0.0, 0.3, da) * (1.0 - smoothstep(0.5, LIFE - 0.35, da)) * (0.2 + 0.8 * speck);
        }
      }
      vec2 rel = p - centre - off;
      if (length(rel) > cs * 1.3) continue;
      float ang = (h.y - 0.5) * 6.0 * a;
      vec2 q = centre + rot(-ang) * rel;
      if (any(notEqual(floor(warped(q)), id))) continue;
      float mq = mask(q);
      if (mq <= 0.0) continue;
      float bits = hash12(floor((q - centre) / (cs * 0.12)) + id * 7.0);
      float cover = mq * step(smoothstep(0.35, LIFE, a), bits);
      if (cover <= 0.0) continue;
      acc = over(acc, stone(q, ang) * 0.92, cover);
    }
  }
  acc = over(acc, uDust, clamp(dust * 0.7, 0.0, 0.85));
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Sandstone", values: { uColor: [0.86, 0.66, 0.42], uDust: [0.93, 0.8, 0.6], uChunk: 8 } },
    { name: "Ruin", values: { uText: textImage("RUIN"), uColor: [0.78, 0.78, 0.8], uDust: [0.88, 0.88, 0.9], uBackground: [0.08, 0.08, 0.1], uBackgroundAlpha: 1, uFromRight: true } },
    { name: "Ash", values: { uColor: [0.32, 0.3, 0.3], uDust: [0.55, 0.53, 0.52], uChunk: 16, uGravity: 0.6 } },
  ],
};

export const paperShreds: ShaderEffect = {
  kind: "shader",
  id: "paper-shreds",
  name: "Paper shreds",
  description: "Strips of shredded paper with faint lines of print fluttering down, twisting and flipping as they fall.",
  category: "debris",
  tags: ["debris", "paper", "shredded", "falling", "office", "overlay"],
  transparent: true,
  source: glsl(
    `// Paper shreds: twisting strips of printed paper flutter down in three depths.
uniform vec3 uPaper;       // @control color default=#F5F2EA label="Paper"
uniform vec3 uPaper2;      // @control color default=#E4DED0 label="Second paper"
uniform vec3 uInk;         // @control color default=#3A3F4A label="Ink"
uniform float uLines;      // @control min=0 max=1 default=0.6 label="Print"
uniform float uCount;      // @control min=3 max=20 default=8 label="Strips across"
uniform float uLength;     // @control min=0.1 max=0.6 default=0.3 label="Strip length"
uniform float uWidth;      // @control min=0.006 max=0.05 default=0.03 label="Strip width"
uniform float uSpeed;      // @control min=0.05 max=0.6 default=0.16 label="Fall speed"
uniform float uFlutter;    // @control min=0 max=1 default=0.5 label="Flutter"
uniform float uTwist;      // @control min=0 max=3 default=1 label="Twist"`,
    HASH,
    ROTATE,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec4 acc = vec4(0.0);
  float cw = iResolution.x / iResolution.y / uCount;
  for (int l = 2; l >= 0; l--) {
    // Farther strips are smaller, slower and a little dimmer.
    float sc = 1.0 - 0.22 * float(l);
    vec2 pl = p / sc;
    float col = floor(pl.x / cw);
    for (int k = -1; k <= 1; k++) {
      float c = col + float(k);
      vec4 h = vec4(hash22(vec2(c, float(l)) + 0.71), hash22(vec2(c, float(l)) + 5.3));
      float L = uLength * (0.7 + 0.5 * h.x);
      float span = 1.0 / sc + L + 0.2;
      float t = iTime * (0.8 + 0.5 * h.y);
      float y = 0.5 / sc + 0.5 * L + 0.1 - mod(iTime * uSpeed * (0.8 + 0.4 * h.z) + h.w * span, span);
      // Swaying side to side as it falls, leaning into each swing.
      float swing = sin(t * 1.7 + h.z * 6.28);
      float x = (c + 0.5 + 0.4 * (h.w - 0.5)) * cw + uFlutter * cw * 0.3 * swing;
      float tilt = uFlutter * 0.45 * cos(t * 1.7 + h.z * 6.28) + 0.5 * (h.x - 0.5);
      vec2 d = rot(-tilt) * (pl - vec2(x, y));
      float s = d.y;
      if (abs(s) > 0.5 * L + px) continue;
      // A gentle curl along its length, and a twist that travels down it.
      float across = d.x - 0.08 * L * sin(t * 0.9 + h.x * 6.0) * (s / L) * (s / L) * 4.0;
      float phase = uTwist * (2.5 * s / L + t * 1.2) + h.y * 6.28;
      float ct = cos(phase);
      float halfW = 0.5 * uWidth * max(abs(ct), 0.04);
      float cover = smoothstep(halfW + px / sc, halfW - px / sc, abs(across)) * smoothstep(0.5 * L + px, 0.5 * L - px, abs(s));
      if (cover <= 0.0) continue;
      vec3 paper = h.z < 0.5 ? uPaper : uPaper2;
      float front = step(0.0, ct);
      // Print: short lines across the strip, cut from the lines of the page.
      float u = across / max(halfW, 1e-4);
      float row = floor(s / 0.011 + h.w * 10.0);
      float word = step(0.35, hash12(vec2(row, floor(u * 1.5 + h.x * 3.0) + c * 3.0)));
      float ink = front * uLines * word * step(0.55, fract(s / 0.011 + h.w * 10.0)) * step(abs(u), 0.85);
      vec3 colour = mix(paper * mix(0.82, 1.0, front), uInk, ink * 0.55);
      // Lit by how squarely it faces us, with a sheen as it turns edge-on.
      colour *= 0.6 + 0.4 * abs(ct);
      colour += 0.12 * pow(1.0 - abs(ct), 4.0);
      acc = over(acc, colour * (1.0 - 0.1 * float(l)), cover);
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Ticker tape", values: { uPaper: [1, 0.84, 0.3], uPaper2: [0.36, 0.75, 0.92], uLines: 0, uWidth: 0.022, uTwist: 1.8, uCount: 12 } },
    { name: "Kraft", values: { uPaper: [0.78, 0.63, 0.47], uPaper2: [0.7, 0.55, 0.4], uInk: [0.2, 0.14, 0.1], uLines: 0.3 } },
    { name: "Storm", values: { uSpeed: 0.45, uFlutter: 1, uTwist: 2.5, uCount: 14 } },
  ],
};

export const leavesBlowing: ShaderEffect = {
  kind: "shader",
  id: "leaves-blowing",
  name: "Leaves blowing",
  description: "Autumn leaves of several shapes blown across in gusts, tumbling and flipping over as they go.",
  category: "debris",
  tags: ["debris", "leaves", "autumn", "wind", "nature", "overlay"],
  transparent: true,
  source: glsl(
    `// Leaves blowing: maple, oval and oak leaves carried by a gusty wind, tumbling and flipping.
uniform vec3 uColor1;      // @control color default=#C8371D label="Red"
uniform vec3 uColor2;      // @control color default=#E8811F label="Orange"
uniform vec3 uColor3;      // @control color default=#EDB52F label="Gold"
uniform vec3 uColor4;      // @control color default=#7A4A22 label="Brown"
uniform float uWind;       // @control min=-2 max=2 default=0.6 label="Wind"
uniform float uGust;       // @control min=0 max=1 default=0.5 label="Gusts"
uniform float uDensity;    // @control min=0.1 max=1 default=0.35 label="Density"
uniform float uSize;       // @control min=0.02 max=0.12 default=0.06 label="Leaf size"
uniform float uTumble;     // @control min=0 max=2 default=1 label="Tumble"`,
    HASH,
    ROTATE,
    OVER,
    `const float TAU = 6.28318;

// How far the wind has carried things by time t: a steady wind with gusts on top.
float carried(float t) {
  return uWind * (t + uGust * ((1.0 - cos(0.8 * t)) + 0.5 * (cos(1.0) - cos(2.1 * t + 1.0)) / 2.1));
}

// How far inside a leaf q is (negative outside), the leaf one unit long each way, its stem end down.
float leaf(vec2 q, float shape) {
  if (shape < 1.0) {
    // Oval, pointed at both ends, finely toothed.
    float w = 0.46 * (1.0 - q.y * q.y) * (1.0 + 0.25 * q.y) * (1.0 + 0.05 * sin(q.y * 40.0));
    return w - abs(q.x);
  }
  if (shape < 2.0) {
    // Maple: five pointed lobes, a notch at the stem.
    float a = atan(q.x, q.y);
    float lobe = pow(abs(cos(a * 2.5)), 1.6);
    float r = (0.5 + 0.5 * lobe) * (1.0 - 0.1 * abs(sin(a * 12.5))) * (1.0 - 0.3 * smoothstep(1.9, 3.14, abs(a)));
    return (r - length(q)) * 0.6;
  }
  // Oak: rounded lobes down each side.
  float w = 0.4 * sqrt(max(1.0 - q.y * q.y, 0.0)) * (0.72 + 0.28 * sin(q.y * 11.0 + 1.0));
  return w - abs(q.x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec4 acc = vec4(0.0);
  float X = carried(iTime);
  float gust = uWind * (1.0 + uGust * (0.8 * sin(0.8 * iTime) + 0.5 * sin(2.1 * iTime + 1.0)));
  for (int l = 2; l >= 0; l--) {
    // Three depths: farther leaves are smaller, slower and hazier.
    float sc = 1.0 - 0.25 * float(l);
    float cs = uSize * 4.5;
    vec2 drift = vec2(X * (0.8 + 0.2 * sc), -0.06 * iTime - 0.05 * uGust * sin(0.8 * iTime));
    vec2 pl = p / sc - drift + float(l) * 7.3;
    vec2 cell = floor(pl / cs);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec4 h = vec4(hash22(c + 0.13 * float(l)), hash22(c + 3.7 + float(l)));
        if (h.x > uDensity) continue;
        // Bobbing and fluttering about its place in the moving air.
        float t = iTime + h.y * 20.0;
        vec2 centre = (c + 0.5 + 0.4 * (h.zw - 0.5)) * cs
          + cs * vec2(0.12 * sin(t * 1.3), 0.15 * sin(t * 0.9 + h.z * 6.0) + 0.1 * uGust * sin(t * 2.3));
        float r = uSize * (0.75 + 0.5 * h.w);
        vec2 rel = pl - centre;
        if (length(rel) > r * 1.4) continue;
        // Tumbling and flipping faster as the wind carries it further.
        float spinDir = h.z < 0.5 ? -1.0 : 1.0;
        float spin = h.y * TAU + uTumble * spinDir * (X * (2.0 + 2.0 * h.w) + 0.4 * sin(t));
        float flip = h.w * TAU + uTumble * (X * (3.0 + 2.0 * h.y) + t * 0.6);
        float cf = cos(flip);
        vec2 q = rot(-spin) * rel / r;
        q.x /= sign(cf) * max(abs(cf), 0.06);
        float shape = floor(h.z * 2.999 + h.x);
        shape = mod(shape, 3.0);
        float inside = leaf(q, shape);
        // The stem.
        float stemTop = shape == 1.0 ? -0.4 : -0.95;
        float stem = 0.035 - abs(q.x + 0.06 * (q.y + 1.0) * (q.y + 1.0));
        stem = min(stem, min(stemTop - q.y, q.y + 1.35));
        float edge = max(inside, stem);
        float aa = px / (r * sc) * 1.5;
        float cover = smoothstep(-aa, aa, edge);
        if (cover <= 0.0) continue;
        // A colour from the palette, browner at the edges, with darker veins.
        float pick = fract(h.y * 7.0 + h.x * 3.0) * 4.0;
        vec3 colour = pick < 1.0 ? uColor1 : pick < 2.0 ? uColor2 : pick < 3.0 ? uColor3 : uColor4;
        colour = mix(colour, uColor4, 0.5 * smoothstep(0.08, 0.0, inside) * step(-0.5, inside));
        float vein = shape == 1.0
          ? smoothstep(0.05, 0.0, abs(fract(atan(q.x, q.y) / TAU * 5.0 + 0.5) - 0.5) * length(q) * 2.0)
          : max(smoothstep(0.03, 0.0, abs(q.x)), smoothstep(0.04, 0.0, abs(fract((q.y - abs(q.x) * 0.9) * 4.0) - 0.5) * 0.25));
        colour *= 1.0 - 0.3 * vein * step(0.0, inside);
        // Facing us it is lit; turning edge-on it darkens; the underside is paler and duller.
        if (cf < 0.0) colour = mix(colour, vec3(dot(colour, vec3(0.3, 0.5, 0.2))) * 1.15, 0.35);
        colour *= 0.55 + 0.45 * abs(cf);
        colour = mix(colour, colour * 0.75 + vec3(0.05), 0.4 * float(l) / 2.0);
        acc = over(acc, colour, cover);
      }
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Gale", values: { uWind: 1.6, uGust: 1, uTumble: 1.6, uDensity: 0.7 } },
    { name: "Lazy drift", values: { uWind: 0.2, uGust: 0.2, uTumble: 0.5, uDensity: 0.35 } },
    { name: "Summer green", values: { uColor1: [0.3, 0.55, 0.2], uColor2: [0.45, 0.68, 0.25], uColor3: [0.62, 0.75, 0.3], uColor4: [0.25, 0.38, 0.15] } },
  ],
};

export const sandErosion: ShaderEffect = {
  kind: "shader",
  id: "sand-erosion",
  name: "Sand erosion",
  description: "A shape of packed sand eroded grain by grain by the wind from one side, the grains streaming away before it reforms.",
  category: "debris",
  video: "none",
  tags: ["debris", "sand", "erosion", "wind", "text", "particles", "disintegrate", "loop"],
  loop: 8,
  transparent: true,
  source: glsl(
    `// Sand erosion: the wind strips a sand shape grain by grain from one side; then it blows back together.
uniform sampler2D uMask;        // @control filter=linear wrap=clamp default=${textImage("SAND")} label="Shape (alpha)"
uniform vec3 uSand;             // @control color default=#E6BE7A label="Sand"
uniform vec3 uShade;            // @control color default=#A8743A label="Shadow"
uniform float uWind;            // @control min=0.3 max=2 default=1 label="Wind"
uniform float uTurbulence;      // @control min=0 max=1 default=0.5 label="Turbulence"
uniform float uGrain;           // @control min=0.003 max=0.015 default=0.007 label="Grain size"
uniform float uSize;            // @control min=0.3 max=1 default=0.85 label="Shape size"
uniform bool uFromRight;        // @control default=false label="Wind from the right"
uniform vec3 uBackground;       // @control color default=#1B1410 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform bool uAnimate;          // @control default=true label="Animate"
uniform float uProgress;        // @control min=0 max=1 default=0.35 label="Erosion (when still)"`,
    HASH,
    NOISE,
    OVER,
    `const float CYCLE = 8.0;
const float LIFE = 1.8;
const float BATCH = LIFE / 24.0;
float shapeW = 1.0;
float shapeH = 0.3;
vec2 origin = vec2(0.0);
float dirX = 1.0;

float mask(vec2 p) {
  vec2 uv = (p - origin) / vec2(shapeW, shapeH);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uMask, uv).a;
}

// The batch of grains source point s goes with: the wind takes a ragged slab at a time, from the windward side.
float batchOf(vec2 s) {
  float x = (s.x - origin.x) / shapeW;
  if (uFromRight) x = 1.0 - x;
  float t = 0.45 + 1.5 * x + 0.5 * (vnoise(s * 9.0) - 0.5) + 0.15 * (vnoise(s * 40.0) - 0.5);
  return floor(t / BATCH);
}

// How far a grain from s has blown after a seconds: picking up speed downwind, lifting, eddying.
vec2 blown(float a, vec2 s) {
  float n1 = vnoise(s * 6.0 + vec2(a * 1.3, 0.0)) - 0.5;
  float n2 = vnoise(s * 6.0 + vec2(7.7, a * 1.1)) - 0.5;
  vec2 d = vec2(dirX * uWind * (0.15 * a + 0.55 * a * a), 0.05 * a + 0.03 * a * a);
  return d + uTurbulence * a * vec2(0.08 * n1, 0.22 * n2);
}

vec3 sand(vec2 cell, float light) {
  vec2 h = hash22(cell + 0.5);
  return mix(uShade, uSand, clamp(light * (0.65 + 0.45 * h.x), 0.0, 1.0)) * (0.9 + 0.2 * h.y);
}

// Packed sand: fine speckle and a little drift of tone.
vec3 packed(vec2 p, float light) {
  float speck = hash12(floor(p / (uGrain * 0.45)));
  float tone = vnoise(p * 30.0);
  return mix(uShade, uSand, clamp(light * (0.7 + 0.25 * speck + 0.2 * tone), 0.0, 1.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  vec2 size = vec2(textureSize(uMask, 0));
  float aspect = size.x / max(size.y, 1.0);
  shapeH = min(uSize * 0.6, iResolution.x / iResolution.y * uSize * 0.8 / aspect);
  shapeW = shapeH * aspect;
  origin = vec2(-0.5 * shapeW, -0.5 * shapeH);
  dirX = uFromRight ? -1.0 : 1.0;
  // Erosion time runs up, then back down: the wind carries the grains back to reform it.
  float e = uAnimate ? 4.0 - abs(mod(iTime, CYCLE) - 4.0) : uProgress * 4.0;
  float now = floor(e / BATCH);
  vec4 acc = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);

  // The standing sand, its windward edge loosening.
  float m = mask(p);
  if (m > 0.0) {
    float left = (batchOf(p) - now) * BATCH;
    if (left > 0.0) {
      float e2 = 0.006;
      float lit = 0.6 + 0.4 * clamp((mask(p + vec2(-e2, e2)) - mask(p + vec2(e2, -e2))) * 2.0 + 0.5, 0.0, 1.0);
      float loose = smoothstep(0.3, 0.0, left);
      float keep = step(loose * 0.7, hash12(floor(p / (uGrain * 0.5)) + 3.1));
      acc = over(acc, packed(p, lit), m * keep);
    }
  }

  // Grains in flight, a batch at a time: the oldest (furthest) first.
  if (e > 0.2) {
    for (int k = 23; k >= 0; k--) {
      float b = now - float(k);
      float a = e - b * BATCH;
      if (a < 0.0 || a > LIFE) continue;
      // Back from where a grain is to where it came from.
      vec2 s = p - blown(a, p);
      s = p - blown(a, s);
      s = p - blown(a, s);
      if (batchOf(s) != b) continue;
      float ms = mask(s);
      if (ms < 0.3) continue;
      vec2 g = s / uGrain;
      vec2 cell = floor(g);
      vec2 h = hash22(cell + 9.7);
      if (h.x < 0.3) continue;
      float rad = (0.25 + 0.25 * h.y) * (1.0 - 0.4 * a / LIFE);
      float d = length(fract(g) - 0.5 - 0.4 * (hash22(cell + 2.3) - 0.5));
      float grain = smoothstep(rad, rad - max(px / uGrain, 0.15), d);
      float fade = 1.0 - smoothstep(LIFE * 0.5, LIFE, a);
      // Each grain, in a thin haze of the finer sand blowing with it.
      acc = over(acc, sand(cell, 0.9), max(grain, 0.22) * fade * ms);
    }
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Heart", values: { uMask: SAMPLE_IMAGES.heart, uSand: [0.95, 0.62, 0.6], uShade: [0.7, 0.3, 0.32] } },
    { name: "Snow", values: { uSand: [0.97, 0.98, 1], uShade: [0.62, 0.7, 0.82], uTurbulence: 0.8, uBackground: [0.1, 0.13, 0.2], uBackgroundAlpha: 1 } },
    { name: "Gale", values: { uWind: 1.8, uTurbulence: 0.25, uFromRight: true } },
  ],
};

/** Debris: rubble, shards, crumbling, shreds, leaves and dust. */
export const debrisShaders: ShaderEffect[] = [rubbleFall, glassShatter, crumblingText, paperShreds, leavesBlowing, sandErosion];
