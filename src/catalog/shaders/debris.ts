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
  // A ring at a time: the rings all of whose shards are too far from this pixel, wherever they are
  // in their fall, are passed over whole; later rings let go later, so once one is not yet falling
  // (or would be behind what is already here) neither are the rest.
  float best = 1e3;
  vec4 hit = vec4(0.0);
  vec2 hitCentre = vec2(0.0);
  float n = float(uSpokes);
  float spreadMax = tan(min(0.8 * TAU / n, 1.5));
  for (int j = 0; j < RINGS; j++) {
    float ring = float(j);
    float firstGo = 0.3 + 0.16 * ring;
    float dtHi = age - firstGo;
    if (dtHi <= 0.0 || firstGo >= best) break;
    float dtLo = max(dtHi - 0.25, 0.0);
    // Bounds on this ring's shards: how far out their middles are, how far they reach, how far they have drifted and dropped.
    float span = uScale * pow(uGrowth, ring);
    float lo = j > 0 ? span / uGrowth : 0.0;
    float rcLo = j > 0 ? 0.425 * (lo + span) : 0.561 * span;
    float rcHi = j > 0 ? 0.575 * (lo + span) : 0.759 * span;
    float radial = j > 0 ? 0.5 * max(1.15 * span - 0.85 * lo, 1.15 * lo - 0.85 * span) : rcHi;
    float reachMax = length(vec2(radial, 1.15 * span * spreadMax)) + 0.02;
    float rMin = rcLo + 0.05 * (1.0 - exp(-0.6 * dtLo)) / 0.6 / (1.0 + ring) - reachMax - 0.01;
    float rMax = rcHi + 0.2 * (1.0 - exp(-0.6 * dtHi)) / 0.6 / (1.0 + ring) + reachMax + 0.01;
    float yA = ballistic(vec2(0.0, 0.08), 0.6, uGravity, dtLo).y;
    float yB = ballistic(vec2(0.0, 0.08), 0.6, uGravity, dtHi).y;
    float yLo = min(yA, yB) - 0.02;
    float yHi = max(yA, yB) + 0.02;
    float dNear = length(vec2(q.x, q.y - clamp(q.y, yLo, yHi)));
    float dFar = max(length(q - vec2(0.0, yLo)), length(q - vec2(0.0, yHi)));
    if (dFar < rMin || dNear > rMax) continue;
    // And of its shards, only those whose sector points (near enough) at this pixel from where the impact point has dropped to:
    // each sector's middle lies 0.2–0.8 of the way round its share of the circle.
    float first = 0.0;
    float count = n;
    float slack = reachMax + 0.01;
    if (dNear > slack) {
      vec2 na = normalize(q - vec2(0.0, yLo));
      vec2 nb = normalize(q - vec2(0.0, yHi));
      float w = 0.5 * acos(clamp(dot(na, nb), -1.0, 1.0)) + asin(slack / dNear);
      vec2 bisect = na + nb;
      float toward = atan(bisect.y, bisect.x) / (TAU / n);
      w /= TAU / n;
      first = ceil(toward - w - 0.8);
      count = min(floor(toward + w - 0.2) - first + 1.0, n);
    }
    for (int k = 0; k < 16; k++) {
      if (float(k) >= count) break;
      float sid = mod(first + float(k), n);
      float tr = release(sid, ring);
      float dt = age - tr;
      if (dt <= 0.0 || tr >= best) continue;
      // How far it has drifted (along e) and dropped since it let go: ballistic(), split so the drop can be used first.
      float e = (1.0 - exp(-0.6 * dt)) / 0.6;
      // Seen from where the impact point has dropped to by now, too near or far, or not in this sector's direction.
      vec2 dropped = q - vec2(0.0, 0.08 * e - uGravity / 0.6 * (dt - e));
      float far = length(dropped);
      if (far < rMin || far > rMax) continue;
      // Its two cracks, the direction halfway between them and tan of half the angle they make.
      float a0 = spoke(sid);
      float a1 = spoke(sid + 1.0);
      vec2 d0 = vec2(cos(a0), sin(a0));
      vec2 d1 = vec2(cos(a1), sin(a1));
      vec2 dir = normalize(d0 + d1);
      float spread = (d0.x * d1.y - d0.y * d1.x) / (1.0 + dot(d0, d1));
      // Not pointing (near enough) this way: further off its middle than any of its corners could be.
      float near = length(vec2(radial, 1.15 * span * spread)) + 0.03;
      if (far > near && dot(dropped, dir) < sqrt(far * far - near * near)) continue;
      // Its middle, which it turns about, and how far it reaches from there (ringAt, with the ring's scale worked out above).
      float inner = j > 0 ? lo * (0.85 + 0.3 * hash12(vec2(sid, ring + 0.5))) : 0.0;
      float outer = j + 1 < RINGS ? span * (0.85 + 0.3 * hash12(vec2(sid, ring + 1.5))) : inner * uGrowth;
      float rc = j > 0 ? 0.5 * (inner + outer) : 0.66 * outer;
      float reach = length(vec2(max(outer - rc, rc - inner), outer * spread)) + 0.01;
      vec2 cen = dir * rc;
      vec2 h = hash22(vec2(sid, ring) + 17.3);
      vec2 rel = dropped - cen - normalize(cen + 1e-4) * (0.05 + 0.15 * h.x) / (1.0 + ring) * e;
      if (dot(rel, rel) > reach * reach) continue;
      float ang = (h.y - 0.5) * 2.0 * uSpin * dt;
      // It also turns about its own axis, narrowing and catching the light.
      float tilt = cos(dt * (0.6 + 1.2 * h.x) * uSpin);
      vec2 local = rot(-ang) * rel;
      local.x /= sign(tilt) * max(abs(tilt), 0.05);
      vec2 orig = cen + local;
      // Back on the pane, is that point inside this shard: between its two cracks and its two rings?
      float side0 = d0.x * orig.y - d0.y * orig.x;
      float side1 = d1.x * orig.y - d1.y * orig.x;
      float d = dot(orig, dir);
      float rim = j + 1 < RINGS ? outer : 1e3;
      if (side0 < 0.0 || side1 >= 0.0 || d >= rim) continue;
      // Past every ring inside it (they are a little ragged, so not only the nearest).
      bool past = true;
      for (int i = 1; i < RINGS; i++) {
        if (i > j) break;
        if (d < ringAt(sid, float(i))) {
          past = false;
          break;
        }
      }
      if (!past) continue;
      float edge = min(rim - d, min(abs(side0), abs(side1)));
      if (j > 0) edge = min(edge, d - inner);
      best = tr;
      hit = vec4(orig, tilt, edge);
      hitCentre = cen;
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
      // Where its grains came from, give or take the turbulence: skip the batch unless that is in
      // the shape and in the slab of it this batch was taken from (see batchOf).
      vec2 from = (p - vec2(dirX * uWind * (0.15 * a + 0.55 * a * a), 0.05 * a + 0.03 * a * a) - origin) / vec2(shapeW, shapeH);
      vec2 sway = uTurbulence * a * vec2(0.04, 0.11) / vec2(shapeW, shapeH) + 1e-3;
      if (uFromRight) from.x = 1.0 - from.x;
      float slabLo = max((b * BATCH - 0.775) / 1.5, 0.0);
      float slabHi = min(((b + 1.0) * BATCH - 0.125) / 1.5, 1.0);
      if (from.x + sway.x < slabLo || from.x - sway.x > slabHi || from.y + sway.y < 0.0 || from.y - sway.y > 1.0) continue;
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

const CLICKS = `
vec4 clickAt(int i, bool demo, float period) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[i];
  float k = floor(iTime / period) - float(i);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.2 + 0.6 * h) * iResolution.xy, k * period, 1.0);
}`.trim();

export const moneyRain: ShaderEffect = {
  kind: "shader",
  id: "money-rain",
  name: "Money rain",
  description: "Spinning metallic coins with moving glints and fluttering banknotes raining down, piling at the bottom and bursting wherever you click.",
  category: "debris",
  tags: ["debris", "money", "coin", "cash", "rain", "jackpot", "overlay", "interactive", "click"],
  transparent: true,
  source: glsl(
    `// Money rain: spinning metallic coins and fluttering banknotes raining down, piling up and bursting on click.
uniform int uMode;       // @control min=0 max=2 default=2 label="Mode (0 coins, 1 bills, 2 both)"
uniform vec3 uMetal;     // @control color default=#F5C542 label="Metal colour"
uniform vec3 uBill;      // @control color default=#4E9A51 label="Bill colour"
uniform float uDensity;  // @control min=0 max=1 default=0.7 label="Density"
uniform float uSize;     // @control min=0.5 max=2 default=1 label="Size"
uniform float uSpin;     // @control min=0 max=3 default=1 label="Spin"
uniform float uGlint;    // @control min=0 max=2 default=1 label="Glint"
uniform bool uPile;      // @control default=true label="Pile at bottom"
uniform bool uDemo;      // @control default=true label="Demo clicks when idle"`,
    HASH,
    NOISE,
    ROTATE,
    OVER,
    CLICKS,
    `const float TAU = 6.2831853;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Draw a 3D-spinning metallic coin at local offset dp, radius r.
vec4 paintCoin(vec4 acc, vec2 dp, float r, float spin, float flip, float depthDim, float fade, float px) {
  float c = cos(flip);
  float ac = abs(c);
  float squash = max(ac, 0.1);
  vec2 q = rot(spin) * dp;
  // Rim thickness appears as the coin turns edge-on.
  float edgeOff = (1.0 - ac) * 0.14 * r * sign(c == 0.0 ? 1.0 : c);
  vec2 qFront = vec2(q.x / squash, q.y);
  vec2 qBack = vec2((q.x - edgeOff) / squash, q.y);
  float dFront = length(qFront) - r;
  float dBack = length(qBack) - r;
  float sd = min(dFront, dBack);
  float cover = 1.0 - smoothstep(-px, px / squash, sd);
  if (cover <= 0.001) return acc;

  vec2 u = qFront / max(r, 1e-5);
  float rad = length(u);
  bool onEdge = dFront > 0.0 && dBack <= 0.0;

  vec3 darkMetal = uMetal * vec3(0.34, 0.27, 0.18);
  vec3 hiMetal = mix(uMetal, vec3(1.0, 0.98, 0.88), 0.72);
  vec3 col;
  if (onEdge) {
    // Milled/reeded coin edge.
    float ridges = 0.5 + 0.5 * sin(atan(qBack.y, qBack.x) * 28.0);
    col = mix(darkMetal, uMetal * 0.85, ridges * 0.75);
  } else {
    // Embossed rim and inner emblem.
    float rim = smoothstep(0.74, 0.82, rad) * (1.0 - smoothstep(0.95, 1.0, rad));
    float groove = exp(-pow((rad - 0.76) / 0.045, 2.0));
    float bar = smoothstep(0.18, 0.12, abs(u.x)) * smoothstep(0.52, 0.45, abs(u.y));
    float ring = exp(-pow((rad - 0.42) / 0.07, 2.0)) * step(0.1, abs(u.x));
    float emboss = clamp(rim + max(bar, ring) * 0.75 - groove * 0.8, 0.0, 1.0);

    vec2 n2 = u * (0.7 + 0.5 * rim) + vec2(0.0, emboss * 0.35);
    vec3 n = normalize(vec3(n2.x * c, n2.y, max(ac, 0.15)));
    vec3 ldir = normalize(vec3(-0.45, 0.65, 0.62));
    float diff = clamp(dot(n, ldir), 0.0, 1.0);
    vec3 hvec = normalize(ldir + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, hvec), 0.0), 18.0);
    // Moving glint sweep as the coin rotates.
    float sweep = pow(max(0.0, 1.0 - abs(sin(flip * 1.0 + 0.4)) * 3.5), 2.0);
    float glint = (spec * 1.1 + sweep * 0.9 * (1.0 - groove)) * uGlint;

    col = mix(darkMetal, uMetal, 0.35 + 0.75 * diff);
    col = mix(col, darkMetal, groove * 0.45);
    col += hiMetal * glint;
  }
  return over(acc, min(col * depthDim, vec3(1.2)), cover * fade);
}

// Draw a fluttering, curling banknote at local offset dp, half-width r.
vec4 paintBill(vec4 acc, vec2 dp, float r, float spin, float flutter, float seed, float depthDim, float fade, float px) {
  float squash = 0.28 + 0.72 * abs(cos(flutter));
  vec2 q = rot(spin) * dp;
  float curl = 0.22 * r * sin(q.x / max(r, 1e-5) * 3.2 + seed * 6.0 + iTime * 2.8);
  q.y += curl;
  q.y /= squash;

  vec2 halfSize = vec2(r * 1.35, r * 0.64);
  float sd = sdBox(q, halfSize);
  float cover = 1.0 - smoothstep(-px, px / squash, sd);
  if (cover <= 0.001) return acc;

  vec2 uv = q / halfSize;
  float border = max(smoothstep(0.76, 0.84, abs(uv.x)), smoothstep(0.66, 0.76, abs(uv.y)));
  float innerLine = max(exp(-pow((abs(uv.x) - 0.82) / 0.03, 2.0)), exp(-pow((abs(uv.y) - 0.72) / 0.04, 2.0)));
  float oval = 1.0 - smoothstep(0.36, 0.44, length(vec2(uv.x * 1.25, uv.y * 1.35)));
  // Central emblem & corner pips.
  float emblem = (1.0 - smoothstep(0.14, 0.2, length(vec2(uv.x * 1.5, uv.y)))) * oval;
  float corners = step(0.68, abs(uv.x)) * step(0.55, abs(uv.y)) * (1.0 - border * 0.5);

  vec3 paper = mix(uBill, vec3(0.92, 0.94, 0.86), 0.42);
  vec3 ink = uBill * 0.42;
  vec3 col = mix(paper, uBill * 0.72, border * 0.75);
  col = mix(col, ink, clamp(innerLine * 0.55 + emblem * 0.65 + corners * 0.35, 0.0, 1.0));
  col = mix(col, paper * 1.06, oval * 0.35 * (1.0 - emblem));

  // Curl lighting & edge sheen.
  float curlShade = 0.82 + 0.18 * cos(q.x / max(r, 1e-5) * 3.2 + seed * 6.0 + iTime * 2.8);
  float tiltShade = (0.65 + 0.35 * abs(cos(flutter))) * (cos(flutter) < 0.0 ? 0.85 : 1.0);
  col *= curlShade * tiltShade;
  col += vec3(0.12) * uGlint * pow(1.0 - abs(cos(flutter)), 3.0);
  return over(acc, min(col * depthDim, vec3(1.1)), cover * fade);
}

vec4 paintPiece(vec4 acc, vec2 dp, float r, float spin, float flip, float seed, bool isBill, float depthDim, float fade, float px) {
  if (isBill) return paintBill(acc, dp, r, spin, flip, seed, depthDim, fade, px);
  return paintCoin(acc, dp, r, spin, flip, depthDim, fade, px);
}

bool pickBill(float h) {
  if (uMode == 0) return false;
  if (uMode == 1) return true;
  return h > 0.55;
}

float heapTop(float x) {
  return -0.5 + 0.13 * uSize * (0.42 + 0.58 * vnoise(vec2(x * 3.1, 2.3)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 acc = vec4(0.0);

  // 1. Optional pile at the bottom.
  if (uPile && uDensity > 0.01 && p.y < -0.5 + 0.19 * uSize) {
    float gs = 0.045 * uSize;
    vec2 gc = floor(p / gs);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 c = gc + vec2(float(i), float(j));
        vec2 h = hash22(c + 11.7);
        vec2 site = (c + 0.25 + 0.5 * h) * gs;
        float top = heapTop(site.x);
        if (site.y > top) continue;
        float r = gs * (0.58 + 0.22 * h.y);
        if (length(p - site) > r * 1.5) continue;
        float depth = clamp((top - site.y) / max(0.12 * uSize, 0.02), 0.0, 1.0);
        float dim = 1.0 - 0.55 * depth;
        bool isBill = pickBill(fract(h.x * 5.7));
        float flip = (h.y - 0.5) * 1.2 + sin(iTime * 0.8 * uSpin + h.x * 12.0) * 0.15;
        acc = paintPiece(acc, p - site, r, h.x * TAU, flip, c.x * 3.1 + c.y, isBill, dim, 1.0, px);
      }
    }
  }

  // 2. Continuous falling rain in 2 depth layers.
  if (uDensity > 0.001) {
    for (int l = 1; l >= 0; l--) {
      float fl = float(l);
      float sc = 1.0 - 0.28 * fl;
      float dim = 1.0 - 0.2 * fl;
      float cs = 0.13 * uSize * sc;
      float fallSpeed = (0.38 + 0.12 * (1.0 - fl));
      vec2 q = (p + vec2(fl * 0.37, iTime * fallSpeed)) / cs;
      vec2 gc = floor(q);
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 id = gc + vec2(float(i), float(j));
          vec4 h = vec4(hash22(id + fl * 19.3), hash22(id * 2.1 + fl * 7.7));
          if (h.x > uDensity) continue;
          bool isBill = pickBill(h.y);
          float sway = (isBill ? 0.35 : 0.12) * sin(iTime * (1.6 + 1.2 * h.z) + h.w * TAU);
          vec2 center = (id + 0.2 + 0.6 * h.zw + vec2(sway, 0.0)) * cs;
          vec2 dp = (q * cs) - center;
          float r = 0.032 * uSize * sc * (0.82 + 0.35 * h.y);
          if (length(dp) > r * 1.5) continue;
          float spin = h.w * TAU + iTime * uSpin * (isBill ? 1.2 : 2.2) * (h.z < 0.5 ? 1.0 : -1.0);
          float flip = h.z * TAU + iTime * uSpin * (isBill ? 3.2 : 4.8) * (0.7 + 0.6 * h.y);
          acc = paintPiece(acc, dp, r, spin, flip, id.x * 5.3 + id.y, isBill, dim, 1.0, px);
        }
      }
    }
  }

  // 3. Click bursts (up to 4 active clicks, plus demo clicks when idle).
  const float LIFE = 3.2;
  const float k = 2.4;
  for (int i = 3; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo, 3.0);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > LIFE) continue;
    vec2 origin = (c.xy - 0.5 * iResolution.xy) * px;
    float e = (1.0 - exp(-k * age)) / k;
    float drop = 0.42 * (age - e);
    float maxReach = 0.95 * e + drop + 0.1 * uSize;
    if (length(p - origin + vec2(0.0, drop * 0.5)) > maxReach) continue;

    float fade = 1.0 - smoothstep(LIFE - 0.7, LIFE, age);
    for (int j = 0; j < 18; j++) {
      float fj = float(j);
      vec4 h = vec4(hash22(vec2(fj * 3.7 + 1.0, c.z)), hash22(vec2(c.z * 1.9, fj * 7.1)));
      float ang = h.x * TAU;
      float speed = 0.45 + 0.55 * h.y;
      vec2 v0 = vec2(cos(ang), sin(ang) * 0.8 + 0.35) * speed;
      vec2 pos = origin + v0 * e - vec2(0.0, (0.35 + 0.15 * h.z) * (age - e));
      vec2 dp = p - pos;
      float r = 0.03 * uSize * (0.8 + 0.35 * h.w);
      if (abs(dp.x) > r * 1.5 || abs(dp.y) > r * 1.5) continue;
      bool isBill = pickBill(h.z);
      float spin = h.w * TAU + age * uSpin * 3.0 * (h.x < 0.5 ? 1.0 : -1.0);
      float flip = h.z * TAU + age * uSpin * 6.0;
      acc = paintPiece(acc, dp, r, spin, flip, fj + c.z, isBill, 1.0, fade, px);
    }
  }

  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Jackpot", values: { uMode: 0, uMetal: [0.98, 0.78, 0.22], uDensity: 1, uPile: true, uGlint: 1.5, uSpin: 1.4 } },
    { name: "Cash", values: { uMode: 1, uBill: [0.3, 0.62, 0.32], uDensity: 0.8 } },
    { name: "Silver", values: { uMode: 0, uMetal: [0.82, 0.85, 0.9], uGlint: 1.4 } },
    { name: "Burst only", values: { uDensity: 0, uPile: false } },
  ],
};

export const petalFall: ShaderEffect = {
  kind: "shader",
  id: "petal-fall",
  name: "Petal fall",
  description: "Falling cherry blossom and rose petals drifting on a breeze with a swaying 3D flip, soft depth blur and click bursts.",
  category: "debris",
  tags: ["debris", "petals", "sakura", "cherry-blossom", "rose", "spring", "wedding", "overlay", "interactive", "click"],
  transparent: true,
  source: glsl(
    `// Petal fall: cherry blossom, rose and round petals drifting on a breeze with 3D flip and click bursts.
uniform int uShape;      // @control min=0 max=2 default=0 label="Shape (0 sakura, 1 rose, 2 round)"
uniform vec3 uColor;     // @control color default=#F9C6D7 label="Petal"
uniform vec3 uTip;       // @control color default=#FFF0F5 label="Tip"
uniform float uDensity;  // @control min=0 max=1 default=0.55 label="Density"
uniform float uSize;     // @control min=0.02 max=0.12 default=0.055 label="Size"
uniform int uLayers;     // @control min=1 max=5 default=3 label="Depth layers"
uniform float uSway;     // @control min=0 max=2 default=1 label="Sway"
uniform float uFlip;     // @control min=0 max=1 default=0.92 label="Flip"
uniform float uBreeze;   // @control min=-2 max=2 default=0.35 label="Breeze"
uniform float uSpeed;    // @control min=0.1 max=2.5 default=0.7 label="Fall speed"
uniform float uGlow;     // @control min=0 max=1 default=0 label="Glow"
uniform bool uDemo;      // @control default=true label="Demo clicks when idle"`,
    HASH,
    ROTATE,
    OVER,
    CLICKS,
    `const float TAU = 6.2831853;

// Signed distance inside a petal (positive inside), base at -y, tip at +y.
float petalShape(vec2 q, int shape) {
  if (shape == 0) {
    // Sakura: tapered base, broad upper curve, distinct apical notch.
    float y = q.y / 0.9;
    float taper = 0.24 + 0.76 * smoothstep(-1.0, 0.45, y);
    float notch = 0.36 * smoothstep(0.28, 0.88, y) * exp(-pow(q.x / 0.16, 2.0));
    float r2 = (q.x * q.x) / (0.38 * taper * taper) + y * y + notch;
    return (1.0 - sqrt(max(r2, 0.0))) * 0.65;
  }
  if (shape == 1) {
    // Rose: broad, cupped petal with a softly ruffled upper edge.
    float y = q.y / 0.88;
    float taper = 0.38 + 0.62 * smoothstep(-1.0, 0.25, y);
    float ruffle = 0.03 * sin(q.x * 9.0 + y * 3.0) * smoothstep(0.2, 0.9, y);
    float r2 = (q.x * q.x) / (0.68 * taper * taper) + pow(y + ruffle, 2.0);
    return (1.0 - sqrt(max(r2, 0.0))) * 0.65;
  }
  // Round: soft camellia / wedding petal.
  float y = q.y / 0.85;
  float taper = 0.55 + 0.45 * smoothstep(-1.0, 0.1, y);
  float r2 = (q.x * q.x) / (0.52 * taper * taper) + y * y;
  return (1.0 - sqrt(max(r2, 0.0))) * 0.65;
}

vec4 drawPetal(vec4 acc, vec2 rel, float r, float spin, float flip, float blur, float depthFade, float fade, vec2 seed, float px) {
  float cf = cos(flip);
  float ac = abs(cf);
  float squash = mix(1.0, max(ac, 0.05), uFlip);
  vec2 q = rot(-spin) * rel / r;
  q.x /= (cf < 0.0 ? -1.0 : 1.0) * squash;

  float inside = petalShape(q, uShape);
  float aa = px / max(r, 1e-5) * 1.6 + blur;
  float cover = smoothstep(-aa, aa, inside);
  if (cover <= 0.001) return acc;

  float grad = smoothstep(-0.75, 0.75, q.y);
  vec3 col = mix(uColor, uTip, grad * 0.85);
  // Subtle translucency toward the centre and a catchlight as the petal turns edge-on.
  col *= 0.88 + 0.14 * smoothstep(0.0, 0.38, inside);
  if (cf < 0.0) col = mix(col, mix(col, vec3(1.0), 0.2), 0.35);
  col += uTip * (1.0 - ac) * 0.16 * uFlip;
  col += mix(uColor, uTip, 0.5) * uGlow * 0.45;
  col = mix(col, col * 0.78 + vec3(0.06), depthFade);

  float alpha = cover * fade * clamp(0.86 + 0.12 * (1.0 - ac), 0.0, 1.0);
  return over(acc, min(col, vec3(1.2)), alpha);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec4 acc = vec4(0.0);

  int layers = clamp(uLayers, 1, 5);
  if (uDensity > 0.001) {
    for (int l = 4; l >= 0; l--) {
      if (l >= layers) continue;
      float fl = float(l);
      float depthNorm = layers > 1 ? fl / float(layers - 1) : 0.0;
      float sc = 1.0 - 0.16 * fl;
      float cs = uSize * 4.2;
      float fallY = (0.16 + 0.06 * (1.0 - depthNorm)) * uSpeed * iTime;
      float driftX = uBreeze * 0.25 * (0.65 + 0.35 * sc) * iTime;
      vec2 pl = p / sc - vec2(driftX, -fallY) + fl * 5.7;
      vec2 cell = floor(pl / cs);
      float blur = (l == 0 && layers > 1) ? 0.1 : 0.0;
      float depthFade = 0.35 * depthNorm;

      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j));
          vec4 h = vec4(hash22(c + 0.19 * fl), hash22(c + 4.3 + fl));
          if (h.x > uDensity) continue;
          float t = iTime * (0.7 + 0.6 * h.y) + h.z * 20.0;
          vec2 swayOff = cs * vec2(
            0.22 * uSway * sin(t * 1.15 + h.w * TAU),
            0.12 * uSway * cos(t * 0.85 + h.z * TAU)
          );
          vec2 centre = (c + 0.5 + 0.38 * (h.zw - 0.5)) * cs + swayOff;
          float r = uSize * (0.72 + 0.56 * h.w);
          vec2 rel = pl - centre;
          if (length(rel) > r * 1.45) continue;

          float spinDir = h.z < 0.5 ? -1.0 : 1.0;
          float spin = h.y * TAU + spinDir * (iTime * 0.7 * uSpeed + 0.6 * uSway * sin(t * 1.1));
          float flip = h.w * TAU + iTime * (1.4 + 1.2 * h.y) * (0.4 + 0.6 * uSway) + uBreeze * 0.5 * iTime;
          acc = drawPetal(acc, rel, r, spin, flip, blur, depthFade, 1.0, h.xy, px / sc);
        }
      }
    }
  }

  // Click bursts (up to 4 active clicks, plus demo clicks when idle).
  const float LIFE = 3.4;
  const float DRAG = 2.0;
  for (int i = 3; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo, 3.5);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > LIFE) continue;
    vec2 origin = (c.xy - 0.5 * iResolution.xy) * px;
    float e = (1.0 - exp(-DRAG * age)) / DRAG;
    float drop = 0.22 * uSpeed * age;
    float maxReach = 0.7 * e + drop + abs(uBreeze) * 0.25 * age + uSize * 2.0;
    if (length(p - origin - vec2(uBreeze * 0.15 * age, -drop * 0.5)) > maxReach) continue;

    float fade = 1.0 - smoothstep(LIFE - 0.9, LIFE, age);
    for (int j = 0; j < 14; j++) {
      float fj = float(j);
      vec4 h = vec4(hash22(vec2(fj * 3.1 + 1.0, c.z)), hash22(vec2(c.z * 2.3, fj * 5.7)));
      float ang = h.x * TAU;
      float spd = 0.28 + 0.42 * h.y;
      vec2 v0 = vec2(cos(ang), sin(ang) * 0.85 + 0.25) * spd;
      vec2 sway = vec2(0.04 * uSway * sin(age * 2.2 + h.z * TAU), 0.0);
      vec2 pos = origin + v0 * e + vec2(uBreeze * 0.2 * age, -0.22 * uSpeed * (0.7 + 0.5 * h.z) * age) + sway;
      vec2 rel = p - pos;
      float r = uSize * (0.75 + 0.45 * h.w);
      if (length(rel) > r * 1.45) continue;

      float spin = h.w * TAU + age * (1.8 + 1.4 * h.z) * (h.x < 0.5 ? 1.0 : -1.0);
      float flip = h.z * TAU + age * (2.6 + 1.8 * h.y);
      acc = drawPetal(acc, rel, r, spin, flip, 0.0, 0.0, fade, h.xy, px);
    }
  }

  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Sakura", values: { uShape: 0, uColor: [0.98, 0.78, 0.84], uTip: [1, 0.95, 0.97], uSway: 1.1, uFlip: 0.92, uGlow: 0 } },
    { name: "Rose petals", values: { uShape: 1, uColor: [0.72, 0.08, 0.16], uTip: [0.92, 0.28, 0.34], uSize: 0.08, uSpeed: 0.45, uSway: 0.75, uDensity: 0.45, uGlow: 0 } },
    { name: "White wedding", values: { uShape: 2, uColor: [0.95, 0.94, 0.92], uTip: [1, 1, 1], uSway: 0.9, uSpeed: 0.5, uGlow: 0.08 } },
    { name: "Night blossoms", values: { uShape: 0, uColor: [0.92, 0.42, 0.62], uTip: [1, 0.76, 0.88], uGlow: 0.65, uSpeed: 0.55 } },
  ],
};

/** Debris: rubble, shards, crumbling, shreds, leaves, dust, money rain and falling petals. */
export const debrisShaders: ShaderEffect[] = [rubbleFall, glassShatter, crumblingText, paperShreds, leavesBlowing, sandErosion, moneyRain, petalFall];
