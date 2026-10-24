import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";
import { NOISE_3D } from "./atmosphere.js";

/**
 * More space: a ringed planet, a spiral galaxy and a solar system, then
 * things that streak across the night sky: a shooting star, a meteor shower
 * and a comet. The planets are analytic spheres (and ring planes), the
 * galaxy a 2D picture of log-spiral arms seen at a tilt; meteors are bright
 * heads moving along straight paths, lighting each point they pass for a
 * moment after.
 */

/** `stars(fragCoord, density)`: a sparse, twinkling star field in pixel space. */
const STARS = `
float stars(vec2 fragCoord, float density) {
  vec2 cell = floor(fragCoord / 3.0);
  float h = hash12(cell);
  float on = step(1.0 - 0.012 * density, h);
  vec2 at = hash22(cell) * 3.0;
  float d = length(fract(fragCoord / 3.0) * 3.0 - at);
  return on * smoothstep(1.4, 0.0, d) * (0.4 + 0.6 * hash12(cell + 7.0)) * (0.75 + 0.25 * sin(iTime * (1.0 + 3.0 * h) + h * 40.0));
}`.trim();

/** `sphereHit(ro, rd, r)`: the near and far distances along a ray to a sphere at the origin (x > y when it misses). */
const SPHERE_HIT = `
vec2 sphereHit(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}`.trim();

export const planet: ShaderEffect = {
  kind: "shader",
  id: "planet",
  name: "Planet",
  description: "A turning planet, banded gas giant or rocky world, lit from one side with a soft terminator, a scattering atmosphere and optional rings.",
  category: "space",
  tags: ["space", "planet", "saturn", "rings", "astronomy", "sci-fi", "background"],
  source: glsl(
    `// Planet: an analytic sphere on a tilted axis, banded (fbm-warped latitude) or rocky (3D noise), with a
// rim of scattered light brighter on the day side, and a ring plane that shadows the planet and is shadowed by it.
uniform int uStyle;          // @control min=0 max=1 default=0 label="Style (0 gas giant, 1 rocky)"
uniform vec3 uBackground;    // @control color default=#02030A label="Background"
uniform vec3 uColorA;        // @control color default=#EBD3A8 label="Colour A"
uniform vec3 uColorB;        // @control color default=#B0683E label="Colour B"
uniform vec3 uAtmosphere;    // @control color default=#8DB8FF label="Atmosphere"
uniform vec3 uRingColor;     // @control color default=#D8C6A2 label="Ring colour"
uniform bool uRings;         // @control default=true label="Rings"
uniform float uSize;         // @control min=0.4 max=1.6 default=1 label="Size"
uniform float uSpin;         // @control min=-1 max=1 default=0.12 label="Spin speed"
uniform float uTilt;         // @control min=-1 max=1 default=0.42 label="Axis tilt"
uniform float uSunAngle;     // @control min=-3.1416 max=3.1416 default=0.35 label="Sun direction"
uniform float uAtmosphereAmount; // @control min=0 max=2 default=1 label="Atmosphere amount"`,
    HASH,
    NOISE_3D,
    STARS,
    SPHERE_HIT,
    `const float CAM = 4.2;

// The planet's axis tilted toward the viewer, and its frame (spin about the axis).
mat3 frame(float spin) {
  float ct = cos(uTilt), st = sin(uTilt);
  float cv = cos(0.35), sv = sin(0.35);
  float cs = cos(spin), ss = sin(spin);
  mat3 roll = mat3(ct, st, 0.0, -st, ct, 0.0, 0.0, 0.0, 1.0);
  mat3 lean = mat3(1.0, 0.0, 0.0, 0.0, cv, sv, 0.0, -sv, cv);
  mat3 turn = mat3(cs, 0.0, -ss, 0.0, 1.0, 0.0, ss, 0.0, cs);
  return lean * roll * turn;
}

vec3 surface(vec3 g) {
  if (uStyle == 0) {
    // Bands of latitude, warped by noise, and one great storm.
    float warp = fbm3(g * vec3(2.0, 7.0, 2.0) + vec3(0.0, 0.0, iTime * 0.02), 4);
    float v = g.y + 0.09 * (warp - 0.5);
    float bands = 0.5 + 0.35 * sin(v * 17.0) + 0.15 * sin(v * 43.0 + 1.3);
    vec3 c = mix(uColorB, uColorA, smoothstep(0.2, 0.8, bands));
    c *= 0.9 + 0.2 * fbm3(g * vec3(4.0, 24.0, 4.0), 3);
    vec2 storm = vec2(atan(g.x, g.z) - 0.9, (g.y + 0.38) * 3.2);
    float s = length(storm * vec2(1.0, 1.6));
    c = mix(c, mix(uColorB * 1.25, uColorA, 0.25), smoothstep(0.32, 0.18, s) * (0.7 + 0.3 * sin(s * 30.0)));
    return c;
  }
  // Rocky: two kinds of ground by noise, darker basins, polar caps.
  float n = fbm3(g * 2.4, 5);
  float fine = fbm3(g * 11.0, 3);
  vec3 c = mix(uColorB, uColorA, smoothstep(0.35, 0.65, n));
  c *= 0.75 + 0.45 * fine;
  c = mix(c, uColorB * 0.45, smoothstep(0.58, 0.72, n) * 0.6);
  c = mix(c, vec3(0.95), smoothstep(0.86, 0.92, abs(g.y) + fine * 0.08));
  return c;
}

// How much the rings hold at radius r (in planet radii).
float ringDensity(float r) {
  if (r < 1.35 || r > 2.35) return 0.0;
  float d = 0.5 + 0.2 * sin(r * 61.0) + 0.15 * sin(r * 23.0 + 1.0) + 0.15 * sin(r * 137.0 + 2.0) * sin(r * 9.0);
  d *= smoothstep(1.35, 1.45, r) * smoothstep(2.35, 2.2, r);
  // A dark gap partway out.
  d *= 1.0 - 0.85 * smoothstep(0.04, 0.0, abs(r - 1.95));
  return clamp(d, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float f = 1.55 * uSize * (uRings ? 0.52 : 1.0);
  vec3 ro = vec3(0.0, 0.0, CAM);
  vec3 rd = normalize(vec3(p, -f));
  vec3 sun = normalize(vec3(cos(uSunAngle), 0.25, sin(uSunAngle)));
  mat3 m = frame(iTime * uSpin);
  vec3 axis = m * vec3(0.0, 1.0, 0.0);

  vec3 col = uBackground + stars(fragCoord, 1.0);
  vec2 hit = sphereHit(ro, rd, 1.0);
  float closest = length(ro - rd * dot(ro, rd));
  // Scattered light beyond the limb, brightest toward the sun.
  vec2 dir = normalize(p + 1e-5);
  float sunSide = 0.25 + 0.75 * smoothstep(-0.6, 0.6, dot(dir, normalize(sun.xy + vec2(1e-4))) + sun.z * 0.3);
  float halo = exp(-max(closest - 1.0, 0.0) * 14.0) * sunSide * uAtmosphereAmount;
  col += uAtmosphere * halo * 0.7;

  float tPlanet = hit.x < hit.y ? hit.x : 1e9;
  if (tPlanet < 1e8) {
    vec3 n = ro + rd * tPlanet;
    vec3 g = n * m;
    vec3 c = surface(g);
    float ndl = dot(n, sun);
    // A soft terminator, slightly warm where day turns to night.
    float day = smoothstep(-0.12, 0.35, ndl);
    float light = max(ndl, 0.0) * 0.85 + day * 0.15;
    vec3 lit = c * light + c * vec3(1.0, 0.55, 0.35) * 0.12 * smoothstep(0.25, 0.0, abs(ndl + 0.02));
    // The rings' shadow on the planet.
    if (uRings) {
      float tr = -dot(n, axis) / dot(sun, axis);
      if (tr > 0.0) {
        vec3 q = n + sun * tr;
        lit *= 1.0 - 0.75 * ringDensity(length(q));
      }
    }
    float facing = max(dot(n, -rd), 0.0);
    float rim = pow(1.0 - facing, 2.5) * (0.15 + smoothstep(-0.3, 0.6, ndl)) * uAtmosphereAmount;
    lit += uAtmosphere * rim * 0.9;
    float edge = smoothstep(1.0, 1.0 - 2.0 * px * (CAM - 1.0) / f, closest);
    col = mix(col, lit, edge);
  }

  if (uRings) {
    float tr = -dot(ro, axis) / dot(rd, axis);
    if (tr > 0.0 && tr < tPlanet + (tPlanet < 1e8 ? 0.0 : 1e9)) {
      vec3 q = ro + rd * tr;
      float r = length(q);
      float dens = ringDensity(r);
      if (dens > 0.0) {
        // Lit unless the planet stands between the ring and the sun.
        vec2 sh = sphereHit(q, sun, 1.0);
        float shadow = sh.x < sh.y && sh.y > 0.0 ? 0.12 : 1.0;
        float light = 0.35 + 0.65 * abs(dot(sun, axis));
        vec3 rc = uRingColor * (0.85 + 0.15 * sin(r * 97.0)) * light * shadow;
        col = mix(col, rc, dens * 0.85);
      }
    }
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Gas giant", values: { uStyle: 0, uRings: true } },
    {
      name: "Ice giant",
      values: { uStyle: 0, uRings: false, uColorA: [0.72, 0.9, 0.95], uColorB: [0.32, 0.62, 0.82], uAtmosphere: [0.6, 0.85, 1], uTilt: 0.9 },
    },
    {
      name: "Red planet",
      values: { uStyle: 1, uRings: false, uColorA: [0.86, 0.5, 0.3], uColorB: [0.45, 0.2, 0.12], uAtmosphere: [1, 0.6, 0.45], uAtmosphereAmount: 0.5 },
    },
  ],
};

export const spiralGalaxy: ShaderEffect = {
  kind: "shader",
  id: "spiral-galaxy",
  name: "Spiral galaxy",
  description: "A spiral galaxy seen at a tilt, its arms of blue stars and pink nebulae wound around a warm core and laced with dark dust lanes, turning slowly.",
  category: "space",
  tags: ["space", "galaxy", "stars", "astronomy", "cosmic", "background"],
  source: glsl(
    `// Spiral galaxy: log-spiral arms (cos of arms × (angle − winding × ln r)) on a tilted disc, stars
// scattered more thickly along the arms, fbm dust lanes on their inner edges and a bulge at the core.
uniform vec3 uBackground;  // @control color default=#020208 label="Background"
uniform vec3 uCore;        // @control color default=#FFE0B0 label="Core"
uniform vec3 uArmColor;    // @control color default=#8AB0FF label="Arms"
uniform vec3 uNebula;      // @control color default=#FF6FB0 label="Nebulae"
uniform int uArms;         // @control min=1 max=6 default=2 label="Arms"
uniform float uWinding;    // @control min=0.5 max=4 default=2.2 label="Winding"
uniform float uTilt;       // @control min=0 max=1.4 default=0.95 label="Tilt"
uniform float uAngle;      // @control min=-3.1416 max=3.1416 default=0.5 label="Angle"
uniform float uSize;       // @control min=0.4 max=2 default=1 label="Size"
uniform float uSpeed;      // @control min=-2 max=2 default=0.4 label="Rotation speed"
uniform float uDust;       // @control min=0 max=1 default=0.7 label="Dust"`,
    HASH,
    NOISE,
    FBM,
    STARS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 q = mat2(ca, sa, -sa, ca) * p / (0.42 * uSize);
  // Undo the tilt: the disc is foreshortened along y.
  q.y /= max(cos(uTilt), 0.08);
  float r = length(q);
  float spin = iTime * uSpeed * 0.06;
  // The disc's own coordinates, turned with the galaxy.
  vec2 d = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * q;
  float theta = atan(d.y, d.x);
  float arms = float(uArms);
  float wind = theta - uWinding * log(max(r, 1e-3));
  float arm = 0.5 + 0.5 * cos(arms * wind);
  float armSharp = pow(arm, 3.0);
  float disc = exp(-r * 2.6) * smoothstep(1.4, 0.6, r);

  // Clumpy light along the arms.
  float clump = fbm(d * 4.0, 5);
  float light = disc * (0.25 + 1.4 * armSharp * (0.5 + clump));
  vec3 col = uBackground + stars(fragCoord, 1.0) * (1.0 - smoothstep(0.0, 0.6, disc * 4.0));
  col += uArmColor * light * 1.2;
  // Pink star-forming knots on the arms.
  float knots = smoothstep(0.62, 0.8, fbm(d * 9.0 + 3.0, 4)) * armSharp * disc;
  col += uNebula * knots * 2.2;
  // Stars along the arms, more toward the middle.
  for (int i = 0; i < 2; i++) {
    float scale = i == 0 ? 90.0 : 180.0;
    vec2 g = d * scale * uSize;
    vec2 cell = floor(g);
    float h = hash12(cell + float(i) * 31.0);
    float chance = disc * (0.4 + 2.5 * armSharp) * (i == 0 ? 1.6 : 3.0);
    float s = step(1.0 - min(chance, 0.9), h);
    vec2 at = hash22(cell) * 0.6 + 0.2;
    float dist = length(fract(g) - at) / (scale * uSize * px * 0.42 * uSize);
    col += mix(uArmColor, vec3(1.0), 0.6) * s * smoothstep(1.6, 0.0, dist) * (0.4 + 0.6 * hash12(cell + 9.0));
  }
  // Dust lanes on the arms' inner edges.
  float lane = pow(0.5 + 0.5 * cos(arms * wind - 0.9), 6.0);
  float dust = lane * smoothstep(0.08, 0.3, r) * smoothstep(1.2, 0.5, r) * (0.35 + 0.65 * fbm(d * 7.0 + 11.0, 4)) * uDust;
  col *= 1.0 - 0.85 * clamp(dust * 1.6, 0.0, 1.0);
  // The bulge.
  float bulge = exp(-r * r * 30.0) * 1.6 + exp(-r * 6.0) * 0.35;
  col += uCore * bulge;
  fragColor = vec4(col / (1.0 + 0.25 * col), 1.0);
}`,
  ),
  presets: [
    { name: "Face on", values: { uTilt: 0.15, uWinding: 2.6 } },
    { name: "Edge on", values: { uTilt: 1.3, uAngle: 0.15 } },
    { name: "Four arms", values: { uArms: 4, uWinding: 1.6, uArmColor: [0.75, 0.6, 1], uNebula: [1, 0.45, 0.6] } },
  ],
};

export const solarSystem: ShaderEffect = {
  kind: "shader",
  id: "solar-system",
  name: "Solar system",
  description: "A stylised solar system seen at a tilt: planets circling a glowing sun on their orbit lines, the outer ones slower, one with rings.",
  category: "space",
  tags: ["space", "solar system", "planets", "orbit", "astronomy", "sun", "background"],
  source: glsl(
    `// Solar system: planets as analytic spheres on circular orbits in a plane seen at a tilt, orbit lines where
// each pixel's ray meets that plane (anti-aliased with fwidth), lit from the sun at the centre.
uniform vec3 uBackground;  // @control color default=#03040B label="Background"
uniform vec3 uSun;         // @control color default=#FFB443 label="Sun"
uniform vec3 uOrbit;       // @control color default=#7C8BB8 label="Orbit lines"
uniform int uPlanets;      // @control min=1 max=8 default=8 label="Planets"
uniform float uSpeed;      // @control min=0 max=4 default=1 label="Speed"
uniform float uTilt;       // @control min=0.1 max=1.5 default=0.5 label="Tilt"
uniform float uZoom;       // @control min=0.5 max=2 default=1 label="Zoom"
uniform float uOrbitOpacity; // @control min=0 max=1 default=0.45 label="Orbit opacity"
uniform float uPlanetSize; // @control min=0.5 max=2 default=1 label="Planet size"`,
    HASH,
    NOISE_3D,
    STARS,
    SPHERE_HIT,
    `const vec3 COLOUR[8] = vec3[8](vec3(0.66, 0.62, 0.58), vec3(0.95, 0.78, 0.5), vec3(0.3, 0.55, 0.95), vec3(0.85, 0.42, 0.25),
  vec3(0.86, 0.72, 0.55), vec3(0.92, 0.82, 0.6), vec3(0.6, 0.88, 0.92), vec3(0.32, 0.45, 0.95));
const float SIZE[8] = float[8](0.035, 0.05, 0.055, 0.042, 0.11, 0.095, 0.07, 0.068);

float orbitRadius(int i) {
  return 0.42 + float(i) * 0.2 + float(i) * float(i) * 0.008;
}

vec3 planetAt(int i) {
  float r = orbitRadius(i);
  float a = iTime * uSpeed * 0.6 / pow(r / 0.42, 1.5) + float(i) * 2.4 + 0.7;
  return vec3(cos(a), 0.0, sin(a)) * r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float dist = 4.6 / uZoom;
  vec3 ro = vec3(0.0, sin(uTilt), cos(uTilt)) * dist;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(p.x * rt + p.y * up + 1.8 * fw);

  vec3 col = uBackground + stars(fragCoord, 1.0);
  float sunR = 0.17;

  // The nearest planet along the ray.
  float tBest = 1e9;
  int best = -1;
  for (int i = 0; i < 8; i++) {
    if (i >= uPlanets) break;
    vec2 h = sphereHit(ro - planetAt(i), rd, SIZE[i] * uPlanetSize);
    if (h.x < h.y && h.x > 0.0 && h.x < tBest) {
      tBest = h.x;
      best = i;
    }
  }
  vec2 sunHit = sphereHit(ro, rd, sunR);
  float tSun = sunHit.x < sunHit.y ? sunHit.x : 1e9;

  // Orbit lines, where the ray meets the plane in front of anything solid.
  float tPlane = -ro.y / rd.y;
  if (tPlane > 0.0 && tPlane < min(tBest, tSun)) {
    vec3 q = ro + rd * tPlane;
    float r = length(q.xz);
    float w = fwidth(r);
    float lines = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uPlanets) break;
      lines = max(lines, 1.0 - smoothstep(0.5, 1.5, abs(r - orbitRadius(i)) / max(w, 1e-5)));
    }
    col += uOrbit * lines * uOrbitOpacity;
  }

  if (best >= 0 && tBest < tSun) {
    vec3 c = planetAt(best);
    vec3 pos = ro + rd * tBest;
    vec3 n = normalize(pos - c);
    vec3 l = normalize(-c);
    vec3 base = COLOUR[best];
    // Gas giants get bands.
    if (best >= 4) base *= 0.85 + 0.25 * sin(n.y * 26.0 + float(best) + 2.0 * vnoise3(n * 4.0));
    if (best == 2) base = mix(base, vec3(0.3, 0.6, 0.3), smoothstep(0.5, 0.6, vnoise3(n * 3.0 + 2.0)));
    float diff = max(dot(n, l), 0.0);
    col = base * (0.04 + 0.96 * diff) + uSun * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * diff * 0.4;
  } else if (tSun < 1e8) {
    vec3 n = normalize(ro + rd * tSun);
    float boil = fbm3(n * 6.0 + vec3(0.0, iTime * 0.15, 0.0), 4);
    float limb = max(dot(n, -rd), 0.0);
    col = uSun * (0.7 + 0.8 * boil) * (0.55 + 0.45 * limb) + vec3(1.0, 0.95, 0.8) * pow(limb, 3.0) * 0.5;
  }

  // Saturn's rings (the sixth planet), drawn over whatever lies behind them.
  if (uPlanets >= 6) {
    vec3 c = planetAt(5);
    float t = -ro.y / rd.y;
    if (t > 0.0 && t < min(tSun, best == 5 ? tBest + 0.0 : 1e9)) {
      float r = length((ro + rd * t) - c) / (SIZE[5] * uPlanetSize);
      float ring = smoothstep(1.35, 1.45, r) * smoothstep(2.3, 2.15, r) * (0.6 + 0.4 * sin(r * 40.0));
      if (best != 5 || t < tBest) col = mix(col, COLOUR[5] * 0.95, ring * 0.75);
    }
  }

  // The sun's glow over everything.
  float closest = length(ro - rd * dot(ro, rd));
  col += uSun * exp(-max(closest - sunR, 0.0) * 9.0) * 0.6;
  col += uSun * exp(-max(closest - sunR, 0.0) * 40.0) * 0.6;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Top down", values: { uTilt: 1.45, uZoom: 0.9 } },
    { name: "Inner planets", values: { uPlanets: 4, uZoom: 1.9, uPlanetSize: 1.6 } },
  ],
};

/**
 * `meteor(p, a, dir, dist, dur, t, len, w, train, flare, head, tail)`: the
 * light a meteor adds at `p` (all in frame heights), `t` seconds after it set
 * off from `a` along unit `dir`, crossing `dist` in `dur` seconds and burning
 * out there. Each point of the path glows as the head passes and fades over
 * the tail's `len`, with a faint `train` lingering after; the head brightens
 * and flares by `flare` near the end. `w` is the head's width.
 * `meteorSparks(p, a, dir, dist, dur, t, w, flare, sparks, seed, colour)`
 * adds the sparks it sheds (`sparks` 0 to 1; needs {@link HASH}).
 */
const METEOR = `
// How bright a meteor's head is at u (0 to 1) along its path: kindling, a flare before the end, burning out.
float meteorBrightness(float u, float flare) {
  float f = (u - 0.82) / 0.05;
  return smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.72, 1.0, u)) + flare * exp(-f * f);
}
vec3 meteor(vec2 p, vec2 a, vec2 dir, float dist, float dur, float t, float len, float w, float train, float flare, vec3 head, vec3 tail) {
  if (t < 0.0) return vec3(0.0);
  float speed = dist / dur;
  vec2 q = p - a;
  float x = dot(q, dir);
  float hx = min(t, dur) * speed;
  // Nothing reaches further than the head's halo from the path travelled so far.
  float reach = w * 14.0;
  if (abs(dot(q, vec2(-dir.y, dir.x))) > reach || x < -reach || x > hx + reach) return vec3(0.0);
  float xc = clamp(x, 0.0, hx);
  float b = meteorBrightness(xc / dist, flare);
  float age = t - xc / speed;
  float behind = age * speed / len;
  float wd = w * (0.35 + 0.65 * exp(-behind * 2.0));
  float e = length(q - dir * xc);
  float line = exp(-(e * e) / (wd * wd)) * b;
  vec3 col = mix(head, tail, clamp(behind * 3.0, 0.0, 1.0)) * line * exp(-behind * 3.0);
  col += tail * line * train * 0.3 * exp(-age * 1.4);
  // The head: a hot core inside a soft halo, gone quickly after it burns out.
  float hb = meteorBrightness(hx / dist, flare) * exp(-max(t - dur, 0.0) * 14.0);
  float r = length(q - dir * hx);
  return col + mix(head, vec3(1.0), 0.5) * hb * (1.6 * exp(-(r * r) / (w * w)) + 0.35 * exp(-r / (w * 4.0)));
}
// Sparks shed along the path in cells, drifting off, falling and dimming.
vec3 meteorSparks(vec2 p, vec2 a, vec2 dir, float dist, float dur, float t, float w, float flare, float sparks, float seed, vec3 colour) {
  if (t < 0.0) return vec3(0.0);
  float speed = dist / dur;
  vec2 n = vec2(-dir.y, dir.x);
  vec2 q = p - a;
  float x = dot(q, dir);
  float hx = min(t, dur) * speed;
  if (abs(dot(q, n)) > w * 3.0 + 0.04 || x < -0.03 || x > hx + 0.03) return vec3(0.0);
  vec3 col = vec3(0.0);
  float cell = 0.025;
  float k0 = floor(x / cell);
  for (int k = -1; k <= 1; k++) {
    float c = k0 + float(k);
    vec2 h = hash22(vec2(c, seed));
    float xs = (c + h.x) * cell;
    if (xs < 0.0 || xs > hx || h.y > sparks) continue;
    float age = t - xs / speed;
    float life = 0.35 + 0.6 * hash12(vec2(seed, c * 1.7));
    if (age > life) continue;
    vec2 at = a + dir * (xs + 0.01 * (1.0 - exp(-age * 3.0))) + n * (h.y / sparks - 0.5) * (w * 2.0 + 0.03 * age) - vec2(0.0, 0.02) * age * age;
    float r = length(p - at);
    float twinkle = 0.6 + 0.4 * sin(age * 40.0 + c);
    col += colour * exp(-(r * r) / (w * w * 0.3)) * (1.0 - age / life) * twinkle * meteorBrightness(xs / dist, flare);
  }
  return col;
}`.trim();

export const shootingStar: ShaderEffect = {
  kind: "shader",
  id: "shooting-star",
  name: "Shooting star",
  description: "A shooting star streaks across every few seconds, its tail cooling from white to blue, flaring as it burns out and shedding sparks; clicking launches one from the pointer.",
  category: "space",
  tags: ["space", "night", "stars", "meteor", "wish", "magic", "overlay", "interactive", "click"],
  transparent: true,
  source: glsl(
    `// Shooting star: launches at even beats with seeded jitter, each from a random spot on a seeded heading;
// every point of the path glows as the head passes and fades behind it, so the tail is the path's afterglow.
uniform vec3 uBackground;       // @control color default=#060A1C label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"
uniform vec3 uHead;             // @control color default=#FFF6DE label="Head"
uniform vec3 uTail;             // @control color default=#8EC5FF label="Tail"
uniform float uInterval;        // @control min=0.3 max=8 default=2.4 label="Seconds between stars"
uniform float uAngle;           // @control min=0 max=360 default=205 label="Direction (°)"
uniform float uSpread;          // @control min=0 max=90 default=12 label="Direction spread (°)"
uniform float uSpeed;           // @control min=0.2 max=4 default=1.4 label="Speed"
uniform float uDistance;        // @control min=0.2 max=1.6 default=0.8 label="Distance"
uniform float uLength;          // @control min=0.05 max=1 default=0.35 label="Tail length"
uniform float uWidth;           // @control min=0.5 max=6 default=2 label="Width (px)"
uniform float uFlare;           // @control min=0 max=3 default=0.8 label="Burn-out flare"
uniform float uSparks;          // @control min=0 max=1 default=0.5 label="Sparks"
uniform float uTrain;           // @control min=0 max=1 default=0.3 label="Lingering trail"
uniform float uStars;           // @control min=0 max=1 default=0.5 label="Background stars"
uniform bool uClicks;           // @control default=true label="Launch on click"`,
    HASH,
    STARS,
    METEOR,
    `vec3 launch(vec2 p, vec2 from, float t, float seed) {
  vec3 h = vec3(hash22(vec2(seed, 1.7)), hash12(vec2(seed, 5.3)));
  float ang = radians(uAngle + uSpread * (2.0 * h.x - 1.0));
  vec2 dir = vec2(cos(ang), sin(ang));
  float dist = uDistance * (0.7 + 0.6 * h.y);
  float dur = dist / (uSpeed * (0.8 + 0.4 * h.z));
  float w = uWidth / iResolution.y;
  vec3 c = meteor(p, from, dir, dist, dur, t, uLength, w, uTrain, uFlare, uHead, uTail);
  if (uSparks > 0.0) c += meteorSparks(p, from, dir, dist, dur, t, w, uFlare, uSparks, seed, mix(uHead, uTail, 0.5));
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec3 light = vec3(stars(fragCoord, 1.0) * uStars);
  float beat = floor(iTime / uInterval);
  for (int i = 0; i < 5; i++) {
    float k = beat - float(i);
    vec2 h = hash22(vec2(k, 9.1));
    float t = iTime - (k + 0.6 * h.x) * uInterval;
    // The longest flight plus the lingering trail's fade.
    if (t > 1.3 * uDistance / (0.8 * uSpeed) + 3.0) continue;
    // Centre the path on a random spot in the upper part of the frame.
    vec3 g = vec3(hash22(vec2(k, 1.7)), hash12(vec2(k, 5.3)));
    float ang = radians(uAngle + uSpread * (2.0 * g.x - 1.0));
    float dist = uDistance * (0.7 + 0.6 * g.y);
    vec2 mid = vec2((0.15 + 0.7 * h.y) * aspect, 0.4 + 0.4 * hash12(vec2(k, 3.3)));
    light += launch(p, mid - vec2(cos(ang), sin(ang)) * dist * 0.5, t, k);
  }
  if (uClicks) {
    for (int i = 0; i < 3; i++) {
      vec4 c = iClicks[i];
      float t = iTime - c.z;
      if (c.w < 0.5 || t > 1.3 * uDistance / (0.8 * uSpeed) + 3.0) continue;
      light += launch(p, c.xy * px, t, c.z * 7.13 + float(i));
    }
  }
  // Light as colour over the background (alpha is its brightest channel).
  light = 1.0 - exp(-max(light, 0.0));
  float a = max(light.r, max(light.g, light.b));
  vec3 col = uBackground * uBackgroundAlpha * (1.0 - a) + light;
  float alpha = uBackgroundAlpha + a * (1.0 - uBackgroundAlpha);
  fragColor = vec4(min(col / max(alpha, 1e-4), 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Night sky", values: { uBackgroundAlpha: 1 } },
    { name: "Wish", values: { uHead: [1, 0.95, 0.75], uTail: [1, 0.62, 0.86], uSparks: 1, uTrain: 0.6, uWidth: 2.6, uBackgroundAlpha: 1, uBackground: [0.09, 0.05, 0.2] } },
    { name: "Fireball", values: { uHead: [1, 0.9, 0.6], uTail: [1, 0.45, 0.15], uWidth: 4.5, uFlare: 2.2, uSpeed: 0.8, uLength: 0.55, uSparks: 1, uInterval: 4 } },
    { name: "Green bolide", values: { uHead: [0.85, 1, 0.9], uTail: [0.35, 1, 0.55], uWidth: 3.2, uFlare: 1.6, uTrain: 0.8 } },
  ],
};

export const meteorShower: ShaderEffect = {
  kind: "shader",
  id: "meteor-shower",
  name: "Meteor shower",
  description: "A night sky over a hilly, wooded horizon with the Milky Way, as meteors streak outward from one radiant point, the far ones short, the odd one a bright fireball.",
  category: "space",
  tags: ["space", "night", "stars", "meteors", "perseids", "landscape", "background", "hero"],
  source: glsl(
    `// Meteor shower: meteors at a steady rate, each on a ray out of the radiant, starting further out the longer it
// runs (as perspective foreshortens the ones heading toward us); brightness is seeded with a long tail of fireballs.
uniform vec3 uSkyTop;      // @control color default=#03061A label="Sky top"
uniform vec3 uSkyHorizon;  // @control color default=#1C2A5C label="Sky at the horizon"
uniform vec3 uGround;      // @control color default=#010207 label="Ground"
uniform vec3 uColor;       // @control color default=#F2F6FF label="Meteors"
uniform vec3 uTint;        // @control color default=#8CFFB4 label="Tail tint"
uniform float uRate;       // @control min=0.2 max=10 default=3 label="Meteors per second"
uniform float uRadiantX;   // @control min=0 max=1 default=0.72 label="Radiant across"
uniform float uRadiantY;   // @control min=0 max=1 default=0.88 label="Radiant height"
uniform float uSpeed;      // @control min=0.2 max=3 default=1 label="Speed"
uniform float uLength;     // @control min=0.05 max=0.6 default=0.18 label="Tail length"
uniform float uWidth;      // @control min=0.5 max=4 default=1.4 label="Width (px)"
uniform float uHorizon;    // @control min=0 max=0.5 default=0.16 label="Horizon height"
uniform float uMilkyWay;   // @control min=0 max=1 default=0.6 label="Milky Way"
uniform float uStars;      // @control min=0 max=1 default=1 label="Stars"`,
    HASH,
    NOISE,
    FBM,
    STARS,
    METEOR,
    `// The skyline: rolling hills with a scattering of pines.
float skyline(float x) {
  float hill = uHorizon * (0.75 + 0.5 * fbm(vec2(x * 2.2, 3.1), 4));
  float y = hill;
  float cell = 0.028;
  float c = floor(x / cell);
  for (int k = -1; k <= 1; k++) {
    float id = c + float(k);
    vec2 h = hash22(vec2(id, 4.4));
    if (h.x < 0.45) continue;
    float cx = (id + 0.5) * cell + (h.y - 0.5) * cell * 0.6;
    float height = uHorizon * (0.18 + 0.3 * h.y) + 0.01;
    // A pine: a steep triangle standing on the hill.
    y = max(y, hill + height - abs(x - cx) / 0.24);
  }
  return y;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec2 uv = fragCoord / iResolution.xy;
  vec3 col = mix(uSkyHorizon, uSkyTop, smoothstep(uHorizon, 1.0, p.y) * 0.8 + 0.2 * uv.y);
  // The Milky Way: a dusty band of light, darker lanes down its middle.
  vec2 axis = normalize(vec2(1.0, 0.55));
  float across = dot(p - vec2(aspect * 0.5, 0.45), vec2(-axis.y, axis.x));
  float along = dot(p, axis);
  float band = exp(-(across * across) / 0.0256) * (0.55 + 0.6 * fbm(vec2(along * 3.0, across * 6.0), 5));
  float lanes = smoothstep(0.45, 0.75, fbm(vec2(along * 5.0 + 3.0, across * 14.0), 4)) * exp(-(across * across) / 0.0025);
  col += mix(uSkyHorizon * 1.6, vec3(0.85, 0.82, 0.95), 0.35) * band * (1.0 - 0.8 * lanes) * 0.35 * uMilkyWay;
  col += vec3(stars(fragCoord, 1.0 + 3.0 * band * uMilkyWay) * uStars);

  vec2 radiant = vec2(uRadiantX * aspect, uRadiantY);
  float w = uWidth * px;
  float beat = floor(iTime * uRate);
  for (int i = 0; i < 12; i++) {
    float k = beat - float(i);
    vec3 h = vec3(hash22(vec2(k, 2.9)), hash12(vec2(k, 8.1)));
    vec2 g = hash22(vec2(k, 6.6));
    float t = iTime - (k + h.x) / uRate;
    float dur = (0.35 + 0.5 * g.y) / uSpeed;
    if (t > dur + 1.5) continue;
    float ang = h.y * 6.28318;
    vec2 dir = vec2(cos(ang), sin(ang));
    float r0 = 0.06 + 1.1 * h.z;
    float dist = r0 * (0.25 + 0.35 * g.x);
    float bright = 0.45 + 2.2 * pow(g.x * g.y, 2.0);
    vec3 tail = mix(uColor, uTint, smoothstep(0.4, 0.9, h.x) * 0.8);
    col += bright * meteor(p, radiant + dir * r0, dir, dist, dur, t, uLength * (0.6 + 0.8 * g.x), w * (0.7 + 0.5 * bright), 0.4, 0.4 * bright, uColor, tail);
  }

  // The ground in silhouette, its edge catching a little skyglow.
  // Nothing on the skyline stands higher than 1.75 horizons.
  if (uHorizon > 0.0 && p.y < uHorizon * 1.75 + 0.02) {
    float ground = skyline(p.x);
    float edge = smoothstep(-px, px, ground - p.y);
    col = mix(col, uGround + uSkyHorizon * 0.06 * exp(-(ground - p.y) / 0.01), edge);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Storm", values: { uRate: 10, uLength: 0.12, uSpeed: 1.6 } },
    { name: "Open sky", values: { uHorizon: 0, uRadiantX: 0.5, uRadiantY: 0.55 } },
    { name: "Dusk", values: { uSkyTop: [0.07, 0.07, 0.24], uSkyHorizon: [0.62, 0.33, 0.42], uGround: [0.04, 0.02, 0.06], uTint: [1, 0.75, 0.45], uMilkyWay: 0.2, uStars: 0.6 } },
  ],
};

export const comet: ShaderEffect = {
  kind: "shader",
  id: "comet",
  name: "Comet",
  description: "A comet hanging in the night sky: a bright head in a glowing coma, a broad curving dust tail and a straight blue ion tail whose streamers stream away from the sun.",
  category: "space",
  tags: ["space", "comet", "night", "astronomy", "sky", "background", "hero"],
  source: glsl(
    `// Comet: in the head's frame (x along the tail, away from the sun), a coma of nested glows, an ion tail
// that widens slowly with noise streamers flowing outward, and a dust tail that bends back along a parabola.
uniform vec3 uBackground;  // @control color default=#02040C label="Background"
uniform vec3 uComa;        // @control color default=#D4FBFF label="Coma"
uniform vec3 uDust;        // @control color default=#FFE0AA label="Dust tail"
uniform vec3 uIon;         // @control color default=#5FA8FF label="Ion tail"
uniform float uX;          // @control min=0 max=1 default=0.28 label="Head across"
uniform float uY;          // @control min=0 max=1 default=0.32 label="Head height"
uniform float uAngle;      // @control min=0 max=360 default=32 label="Tail direction (°)"
uniform float uSize;       // @control min=0.3 max=2 default=1 label="Size"
uniform float uDustLength; // @control min=0 max=1.5 default=0.8 label="Dust tail"
uniform float uIonLength;  // @control min=0 max=2 default=1.2 label="Ion tail"
uniform float uCurve;      // @control min=-2 max=2 default=0.8 label="Dust tail curve"
uniform float uFlow;       // @control min=0 max=2 default=0.5 label="Streamer flow"
uniform float uStars;      // @control min=0 max=1 default=1 label="Stars"`,
    HASH,
    NOISE,
    FBM,
    STARS,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec3 col = uBackground + vec3(stars(fragCoord, 1.0) * uStars);
  float ang = radians(uAngle);
  vec2 axis = vec2(cos(ang), sin(ang));
  vec2 q = (p - vec2(uX * aspect, uY)) / uSize;
  float x = dot(q, axis);
  float y = dot(q, vec2(-axis.y, axis.x));
  float r = length(q);
  float ahead = smoothstep(-0.03, 0.04, x);

  // Ion tail: narrow and straight, rays streaming outward.
  if (uIonLength > 0.0) {
    float wi = 0.012 + x * 0.05;
    float rays = fbm(vec2(y / max(wi, 1e-3) * 1.5, x * 3.0 - iTime * uFlow * 1.2), 4);
    float kink = 0.012 * sin(x * 7.0 - iTime * uFlow * 2.0) * x * x;
    float yi = (y - kink) / max(wi, 1e-3);
    float ion = exp(-yi * yi) * exp(-x / (uIonLength * 0.45)) * ahead;
    col += uIon * ion * (0.35 + 1.1 * rays * rays) * 0.9;
  }
  // Dust tail: broad, bending back off the line to the sun, with fine striations.
  if (uDustLength > 0.0) {
    float bend = uCurve * 0.35 * x * x;
    float wd = 0.02 + x * 0.22;
    float off = (y + bend) / max(wd, 1e-3);
    float stria = 0.75 + 0.35 * fbm(vec2(off * 2.5 + x * 1.5, x * 1.2 - iTime * uFlow * 0.15), 3);
    float dust = exp(-off * off * 1.4) * exp(-x / (uDustLength * 0.4)) * ahead * stria;
    // Brighter along the leading edge, where the freshest dust is.
    dust *= 0.75 + 0.5 * smoothstep(0.6, -0.6, off * sign(uCurve + 1e-4));
    col += uDust * dust * 0.75;
  }
  // The coma and the nucleus at its heart.
  col += uComa * (exp(-r / 0.035) * 0.9 + exp(-r / 0.12) * 0.25 + exp(-r / 0.4) * 0.06);
  col += vec3(1.0) * exp(-(r * r) / (0.006 * 0.006)) * 1.5;
  col = 1.0 - exp(-col * 1.2);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Great comet", values: { uSize: 1.4, uX: 0.2, uY: 0.22, uAngle: 40, uDustLength: 1.3, uIonLength: 1.8 } },
    { name: "Green coma", values: { uComa: [0.6, 1, 0.65], uIon: [0.4, 0.75, 1], uDustLength: 0.35, uCurve: 0.3 } },
    { name: "Dusty", values: { uIonLength: 0.3, uDustLength: 1.2, uCurve: 1.6, uDust: [1, 0.85, 0.65] } },
  ],
};

export const spaceShaders: readonly ShaderEffect[] = [planet, spiralGalaxy, solarSystem, shootingStar, meteorShower, comet];
