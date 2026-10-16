import { glsl, HASH } from "../glsl.js";
import type { ShaderEffect } from "../types.js";
import { NOISE_3D } from "./atmosphere.js";

/**
 * 3D effects: a globe, studio primitives, an isometric city, a wireframe
 * terrain fly-over, metaballs and a torus knot. They intersect analytically
 * where they can (spheres, planes, a grid walked cell by cell) and ray-march
 * signed distances only inside a bounding sphere, with bounded steps, so the
 * defaults stay cheap at 1080p.
 */

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

export const globe: ShaderEffect = {
  kind: "shader",
  id: "globe",
  name: "Globe",
  description:
    "A spinning Earth-like globe, dotted or realistic, with glowing arcs travelling between cities and an atmosphere rim; drag it to turn it.",
  category: "3d",
  tags: ["3d", "globe", "earth", "world", "map", "network", "data", "interactive", "press", "background"],
  source: glsl(
    `// Globe: an analytic sphere with noise continents (as dots on a lat/long grid, or shaded), great-circle
// arcs between cities lifted off the surface, and a rim of atmosphere. Dragging turns it (iPointer, iClicks).
uniform int uStyle;          // @control min=0 max=1 default=0 label="Style (0 dots, 1 realistic)"
uniform vec3 uBackground;    // @control color default=#050816 label="Background"
uniform vec3 uOcean;         // @control color default=#0B1430 label="Ocean"
uniform vec3 uLand;          // @control color default=#5B8CFF label="Land"
uniform vec3 uArcColor;      // @control color default=#FFB547 label="Arc colour"
uniform vec3 uAtmosphere;    // @control color default=#4F8BFF label="Atmosphere"
uniform float uSize;         // @control min=0.4 max=1.6 default=1 label="Size"
uniform float uSpin;         // @control min=-1 max=1 default=0.15 label="Spin speed"
uniform float uTilt;         // @control min=-1 max=1 default=0.35 label="Tilt"
uniform float uDots;         // @control min=40 max=200 default=110 step=1 label="Dot rows"
uniform float uLandAmount;   // @control min=0 max=1 default=0.5 label="Land amount"
uniform int uArcs;           // @control min=0 max=6 default=6 label="Arcs"
uniform float uArcSpeed;     // @control min=0 max=3 default=1 label="Arc speed"
uniform float uGlow;         // @control min=0 max=2 default=1 label="Atmosphere glow"
uniform bool uDemo;          // @control default=true label="Spin when idle"`,
    HASH,
    NOISE_3D,
    SPHERE_HIT,
    `const float PI = 3.14159265;
// Cities as (latitude, longitude) in degrees, and the pairs the arcs join.
const vec2 CITY[6] = vec2[6](vec2(40.7, -74.0), vec2(51.5, -0.1), vec2(35.7, 139.7), vec2(-33.9, 151.2), vec2(-23.5, -46.6), vec2(25.2, 55.3));
const ivec2 ROUTE[6] = ivec2[6](ivec2(0, 1), ivec2(1, 5), ivec2(5, 2), ivec2(2, 3), ivec2(0, 4), ivec2(4, 1));
const float CAM = 3.4;

// The globe's own frame (where cities and continents live) to the view; its transpose goes back.
mat3 view;

mat3 viewFrom(float yaw, float tilt) {
  float cy = cos(yaw), sy = sin(yaw), ct = cos(tilt), st = sin(tilt);
  mat3 y = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 x = mat3(1.0, 0.0, 0.0, 0.0, ct, st, 0.0, -st, ct);
  return x * y;
}

vec3 fromLatLong(vec2 ll) {
  vec2 r = ll * PI / 180.0;
  return vec3(cos(r.x) * sin(r.y), sin(r.x), cos(r.x) * cos(r.y));
}

// Above 0 on land: noise continents, ice at the poles.
float landAt(vec3 g) {
  float n = fbm3(g * 1.7 + vec3(3.1, 7.4, 1.3), 5);
  return n - mix(0.6, 0.38, uLandAmount);
}

// Where the pointer has dragged the globe: the drag so far while pressed, easing back after letting go.
vec2 dragOffset() {
  float w = iPointer.w;
  if (w == 0.0 || iClicks[0].w < 0.5) return vec2(0.0);
  vec2 from = iClicks[0].xy;
  vec2 to = iPointer.xy;
  float ease = 1.0;
  if (w < 0.0) {
    // Let go: where the pointer was then (its trail, newest first), easing back over two seconds.
    float released = iTime + w;
    for (int i = 0; i < 32; i++) {
      if (iTrail[i].w > 0.5 && iTrail[i].z <= released) {
        to = iTrail[i].xy;
        break;
      }
    }
    ease = 1.0 - smoothstep(0.0, 2.0, -w);
  }
  return (to - from) / iResolution.y * ease;
}

// The screen position (and depth toward the camera) of a point in the view frame.
vec3 project(vec3 v, float f) {
  return vec3(v.xy * f / (CAM - v.z), v.z);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float f = 1.15 * uSize;
  vec2 drag = dragOffset();
  bool idle = iPointer.w == 0.0 && iPointer.z < 0.01;
  float yaw = iTime * uSpin * (uDemo || !idle ? 1.0 : 0.0) + drag.x * 3.5 + 0.8;
  float tilt = clamp(uTilt * 0.6 - drag.y * 2.5, -1.3, 1.3);
  view = viewFrom(yaw, tilt);

  vec3 ro = vec3(0.0, 0.0, CAM);
  vec3 rd = normalize(vec3(p, -f));
  vec2 hit = sphereHit(ro, rd, 1.0);
  // Closest approach of the ray to the centre, for the atmosphere outside the disc.
  float closest = length(ro - rd * dot(ro, rd));
  vec3 col = uBackground + 0.03 * (1.0 - length(p));
  // Atmosphere halo.
  float halo = exp(-max(closest - 1.0, 0.0) * 9.0) * uGlow;
  vec3 sun = normalize(vec3(-0.6, 0.45, 0.75));

  // Size of a pixel on the sphere, in radians at the disc's centre.
  float pxAngle = px * (CAM - 1.0) / f;
  if (hit.x < hit.y) {
    vec3 pos = ro + rd * hit.x;
    vec3 n = pos;
    vec3 g = n * view;
    float facing = max(dot(n, -rd), 0.0);
    float lat = asin(clamp(g.y, -1.0, 1.0));
    float lon = atan(g.x, g.z);
    if (uStyle == 0) {
      // Dots on land, on a grid of rows whose dots keep their spacing toward the poles.
      float rowStep = PI / uDots;
      float row = floor((lat + 0.5 * PI) / rowStep);
      float rowLat = (row + 0.5) * rowStep - 0.5 * PI;
      float count = max(floor(2.0 * PI * cos(rowLat) / rowStep), 1.0);
      float lonStep = 2.0 * PI / count;
      float cell = floor((lon + PI) / lonStep);
      float cellLon = (cell + 0.5) * lonStep - PI;
      vec3 centre = vec3(cos(rowLat) * sin(cellLon), sin(rowLat), cos(rowLat) * cos(cellLon));
      float onLand = step(0.0, landAt(centre));
      vec2 d = vec2((lon - cellLon) * cos(lat), lat - rowLat);
      d.x = mod(d.x + PI, 2.0 * PI) - PI;
      float aa = pxAngle / max(facing, 0.12);
      float dotMask = 1.0 - smoothstep(rowStep * 0.3 - aa, rowStep * 0.3 + aa, length(d));
      // Dots too small to resolve blend into a soft fill.
      dotMask = mix(dotMask, 0.3, smoothstep(rowStep * 0.25, rowStep * 0.7, aa));
      vec3 body = uOcean * (0.55 + 0.45 * facing);
      float light = 0.45 + 0.55 * facing;
      col = mix(body, uLand * light, dotMask * onLand);
    } else {
      // Shaded continents: ocean with a sun glint, land by height, ice at the poles, a lit and a night side.
      float h = landAt(g);
      float coast = smoothstep(-0.015, 0.015, h);
      float relief = fbm3(g * 9.0, 3);
      vec3 shallow = mix(uOcean * 1.8, uOcean, smoothstep(-0.12, 0.0, -h));
      vec3 land = mix(uLand * 0.8, mix(uLand, vec3(0.55, 0.45, 0.3), 0.5), smoothstep(0.03, 0.15, h + relief * 0.06));
      vec3 surface = mix(shallow, land * (0.8 + 0.4 * relief), coast);
      float ice = smoothstep(0.82, 0.9, abs(g.y) + relief * 0.08);
      surface = mix(surface, vec3(0.92, 0.95, 1.0), ice);
      float diffuse = max(dot(n, sun), 0.0);
      vec3 h2 = normalize(sun - rd);
      float glint = pow(max(dot(n, h2), 0.0), 140.0) * (1.0 - coast) * (1.0 - ice);
      col = surface * (0.06 + 0.94 * diffuse) + vec3(1.0, 0.95, 0.85) * glint * 0.6;
      // City lights on the night side's land.
      float lights = step(0.86, hash12(floor(vec2(lon, lat) * 90.0))) * coast * (1.0 - ice);
      col += vec3(1.0, 0.75, 0.4) * lights * smoothstep(0.1, -0.15, dot(n, sun)) * 0.8;
      halo *= 0.6 + 0.4 * max(dot(normalize(vec3(p, 0.2)), sun), 0.0);
    }
    // Atmosphere rim, toward the edge of the disc.
    float rim = pow(1.0 - facing, 3.0);
    col += uAtmosphere * rim * 0.9 * uGlow;
    // Smooth edge.
    float edge = smoothstep(1.0, 1.0 - 2.5 * px * (CAM - 1.0) / f, closest);
    col = mix(uBackground + uAtmosphere * halo, col, edge);
  } else {
    col += uAtmosphere * halo * 0.8;
  }

  // Arcs: great circles between cities, lifted off the surface, a glowing head and fading tail travelling along.
  float arcs = 0.0;
  float cities = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uArcs) break;
    vec3 a = fromLatLong(CITY[ROUTE[i].x]);
    vec3 b = fromLatLong(CITY[ROUTE[i].y]);
    float span = acos(clamp(dot(a, b), -1.0, 1.0));
    vec3 axis = normalize(b - a * dot(a, b));
    float period = 3.2;
    float phase = iTime * uArcSpeed / period + float(i) * 0.37;
    float head = fract(phase) * 1.6;
    float lift = 0.12 + 0.18 * span / PI;
    // Walk the great circle in the view frame, turning by a fixed step (one cos and sin per arc).
    vec3 va = view * a;
    vec3 vb = view * axis;
    // Pixels well away from the arc's bounding sphere skip it.
    vec3 m = view * (0.5 * (a + b));
    float radius = max(0.5 * length(a - b), 1.0 - length(m)) + lift + 0.02;
    float depth = CAM - m.z - radius;
    if (depth > 0.05 && length(p - project(m, f).xy) > radius * f / depth + 40.0 * px) continue;
    float cs = cos(span / 16.0), sn = sin(span / 16.0);
    vec2 cw = vec2(1.0, 0.0);
    vec3 prevV = va * 1.004;
    vec3 prev = project(prevV, f);
    float sPrev = 0.0;
    for (int k = 1; k <= 16; k++) {
      float s = float(k) / 16.0;
      cw = vec2(cw.x * cs - cw.y * sn, cw.y * cs + cw.x * sn);
      vec3 v = (va * cw.x + vb * cw.y) * (1.004 + lift * sin(PI * s));
      vec3 cur = project(v, f);
      vec2 e = cur.xy - prev.xy;
      float u = clamp(dot(p - prev.xy, e) / max(dot(e, e), 1e-8), 0.0, 1.0);
      float d = length(p - prev.xy - e * u);
      // Only near the segment: is that part of it hidden behind the globe?
      bool hidden = true;
      if (d < 40.0 * px) {
        vec3 near = mix(prevV, v, u);
        vec2 sh = sphereHit(ro, normalize(near - ro), 1.0);
        hidden = sh.x < sh.y && sh.x < length(near - ro) - 1e-3;
      }
      prevV = v;
      if (!hidden) {
        float along = mix(sPrev, s, u);
        float tail = smoothstep(head - 0.6, head, along) * step(along, head);
        float core = 1.0 - smoothstep(0.6 * px, 1.8 * px, d);
        float glow = exp(-d / (5.0 * px)) * 0.5;
        arcs = max(arcs, (core + glow) * tail + core * 0.12);
        // The head's spark.
        float spark = exp(-length(p - mix(prev.xy, cur.xy, clamp((head - sPrev) / (s - sPrev), 0.0, 1.0))) / (3.5 * px));
        arcs = max(arcs, spark * step(sPrev, head) * step(head, s) * 1.4);
      }
      prev = cur;
      sPrev = s;
    }
  }
  for (int i = 0; i < 6; i++) {
    vec3 c = view * fromLatLong(CITY[i]);
    if (c.z < 0.05) continue;
    vec3 q = project(c, f);
    float d = length(p - q.xy);
    float pulse = 0.5 + 0.5 * sin(iTime * 3.0 + float(i));
    cities = max(cities, (1.0 - smoothstep(1.5 * px, 3.0 * px, d)) + exp(-d / (6.0 * px)) * 0.4 * pulse);
  }
  col += uArcColor * (arcs + cities);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Dotted dark", values: { uStyle: 0 } },
    {
      name: "Realistic",
      values: {
        uStyle: 1,
        uBackground: [0.0, 0.0, 0.02],
        uOcean: [0.02, 0.1, 0.3],
        uLand: [0.22, 0.42, 0.18],
        uArcColor: [1, 0.85, 0.45],
        uAtmosphere: [0.35, 0.6, 1],
      },
    },
    { name: "Light", values: { uStyle: 0, uBackground: [0.96, 0.97, 1], uOcean: [0.86, 0.89, 0.96], uLand: [0.15, 0.25, 0.6], uArcColor: [1, 0.3, 0.45], uAtmosphere: [0.55, 0.65, 1], uGlow: 0.5 } },
  ],
};

export const rotatingShapes: ShaderEffect = {
  kind: "shader",
  id: "rotating-shapes",
  name: "Rotating shapes",
  description: "A torus, a rounded cube and an icosahedron floating and turning in a soft-lit studio, casting soft shadows on the backdrop.",
  category: "3d",
  tags: ["3d", "shapes", "studio", "geometry", "product", "background", "minimal"],
  source: glsl(
    `// Rotating shapes: three signed-distance primitives ray-marched inside their bounding spheres (64 steps at
// most), a studio floor met analytically, soft shadows toward a key light and a little ambient occlusion.
uniform vec3 uBackdrop;   // @control color default=#ECE7E1 label="Backdrop"
uniform vec3 uColorA;     // @control color default=#FF6A4D label="Torus"
uniform vec3 uColorB;     // @control color default=#4C6FFF label="Cube"
uniform vec3 uColorC;     // @control color default=#FFC23D label="Icosahedron"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform float uFloat;     // @control min=0 max=2 default=1 label="Float"
uniform float uGloss;     // @control min=0 max=1 default=0.6 label="Gloss"
uniform float uSoftness;  // @control min=0.1 max=2 default=0.7 label="Shadow softness"`,
    SPHERE_HIT,
    `const float PHI = 1.618034;
const vec3 LIGHT = vec3(0.55, 0.85, 0.45);

vec3 centre(int i) {
  float fi = float(i);
  return vec3(-1.55 + 1.55 * fi, -0.05 + 0.18 * uFloat * sin(iTime * uSpeed * 0.9 + fi * 2.1), 0.15 * fi - 0.15);
}

mat3 spin(float a, float b) {
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  return mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca) * mat3(1.0, 0.0, 0.0, 0.0, cb, sb, 0.0, -sb, cb);
}

float sdTorus(vec3 p) {
  vec2 q = vec2(length(p.xz) - 0.5, p.y);
  return length(q) - 0.19;
}
float sdRoundBox(vec3 p) {
  vec3 q = abs(p) - vec3(0.36);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.08;
}
float sdIcosahedron(vec3 p) {
  p = abs(p);
  float d = dot(p, normalize(vec3(1.0)));
  d = max(d, dot(p, normalize(vec3(0.0, 1.0, PHI + 1.0))));
  d = max(d, dot(p, normalize(vec3(PHI + 1.0, 0.0, 1.0))));
  d = max(d, dot(p, normalize(vec3(1.0, PHI + 1.0, 0.0))));
  return d - 0.5;
}

// The distance to the nearest shape, and which (0, 1, 2).
vec2 scene(vec3 p) {
  float t = iTime * uSpeed;
  vec2 best = vec2(1e9, -1.0);
  for (int i = 0; i < 3; i++) {
    vec3 q = (p - centre(i)) * spin(t * (0.5 + 0.15 * float(i)) + float(i), t * 0.7 + float(i) * 1.3);
    float d = i == 0 ? sdTorus(q) : i == 1 ? sdRoundBox(q) : sdIcosahedron(q);
    if (d < best.x) best = vec2(d, float(i));
  }
  return best;
}

// The stretch of a ray inside any shape's bounding sphere (x > y when it misses them all).
vec2 bounds(vec3 ro, vec3 rd) {
  vec2 span = vec2(1e9, -1e9);
  for (int i = 0; i < 3; i++) {
    vec2 h = sphereHit(ro - centre(i), rd, 0.78);
    if (h.x < h.y) span = vec2(min(span.x, h.x), max(span.y, h.y));
  }
  return vec2(max(span.x, 0.0), span.y);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * scene(p + e.xyy).x + e.yyx * scene(p + e.yyx).x + e.yxy * scene(p + e.yxy).x + e.xxx * scene(p + e.xxx).x);
}

// Soft shadow toward the light from p (1 lit, 0 in shadow), marched only through the shapes' bounds.
float softShadow(vec3 p, vec3 l) {
  vec2 b = bounds(p, l);
  if (b.x > b.y) return 1.0;
  float k = 10.0 / uSoftness;
  float res = 1.0;
  float t = max(b.x, 0.02);
  for (int i = 0; i < 28; i++) {
    if (t > b.y) break;
    float h = scene(p + l * t).x;
    res = min(res, k * h / t);
    if (res < 0.002) break;
    t += clamp(h, 0.03, 0.3);
  }
  return smoothstep(0.0, 1.0, res);
}

vec3 studio(vec3 rd) {
  // The backdrop's sweep, lighter toward the top, with a softbox overhead for reflections.
  vec3 c = uBackdrop * mix(0.82, 1.05, smoothstep(-0.3, 0.6, rd.y));
  c += vec3(1.2) * smoothstep(0.75, 0.95, rd.y) * smoothstep(-0.2, 0.3, rd.z + 0.4);
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 0.75, 5.6);
  vec3 target = vec3(0.0, -0.15, 0.0);
  vec3 fw = normalize(target - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(p.x * rt + p.y * up + 1.9 * fw);
  vec3 l = normalize(LIGHT);

  // The backdrop: a floor at y = -1 sweeping up into the wall behind.
  vec3 col = studio(rd) * (0.9 + 0.1 * smoothstep(-0.3, 0.2, rd.y));
  float tFloor = rd.y < 0.0 ? (-1.0 - ro.y) / rd.y : 1e9;
  float tHit = 1e9;
  float id = -1.0;
  vec2 b = bounds(ro, rd);
  if (b.x < b.y) {
    float t = b.x;
    for (int i = 0; i < 64; i++) {
      vec2 h = scene(ro + rd * t);
      if (h.x < 0.001 * t) {
        tHit = t;
        id = h.y;
        break;
      }
      t += h.x;
      if (t > b.y) break;
    }
  }
  if (tHit < tFloor) {
    vec3 pos = ro + rd * tHit;
    vec3 n = normalAt(pos);
    vec3 base = id < 0.5 ? uColorA : id < 1.5 ? uColorB : uColorC;
    float diff = max(dot(n, l), 0.0) * softShadow(pos + n * 0.01, l);
    float ao = clamp(0.5 + 0.5 * scene(pos + n * 0.12).x / 0.12, 0.0, 1.0);
    ao *= clamp(0.6 + 0.4 * (pos.y + 1.0), 0.0, 1.0);
    float sky = 0.5 + 0.5 * n.y;
    vec3 lit = base * (0.25 * sky * ao + 0.85 * diff) + base * uBackdrop * 0.12 * (1.0 - sky) * ao;
    vec3 h = normalize(l - rd);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    float spec = pow(max(dot(n, h), 0.0), mix(8.0, 90.0, uGloss)) * diff * mix(0.1, 0.9, uGloss);
    vec3 env = studio(reflect(rd, n));
    col = lit + spec + env * mix(0.02, 0.25, uGloss) * mix(0.3, 1.0, fres) * ao;
  } else if (tFloor < 1e8) {
    vec3 pos = ro + rd * tFloor;
    float shadow = softShadow(pos, l);
    // Contact darkening near the shapes.
    float near = scene(pos).x;
    float ao = mix(0.55, 1.0, smoothstep(0.0, 0.6, near));
    vec3 floorCol = uBackdrop * (0.62 + 0.38 * shadow) * ao;
    // The floor curves up into the wall: blend into the backdrop with distance.
    col = mix(floorCol, col, smoothstep(9.0, 16.0, tFloor));
  }
  // A soft vignette and gamma.
  col *= 1.0 - 0.25 * dot(p, p);
  fragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.9)), 1.0);
}`,
  ),
  presets: [
    { name: "Pastel", values: { uBackdrop: [0.96, 0.92, 0.95], uColorA: [1, 0.62, 0.7], uColorB: [0.55, 0.75, 1], uColorC: [0.62, 0.9, 0.75], uGloss: 0.4 } },
    { name: "Midnight", values: { uBackdrop: [0.12, 0.13, 0.18], uColorA: [1, 0.35, 0.55], uColorB: [0.3, 0.85, 1], uColorC: [0.9, 0.95, 1], uGloss: 0.9 } },
  ],
};

export const isometricCity: ShaderEffect = {
  kind: "shader",
  id: "isometric-city",
  name: "Isometric city",
  description: "An isometric block city whose buildings rise out of the ground, drifting through day and night as windows, street lights and traffic come on.",
  category: "3d",
  tags: ["3d", "city", "isometric", "buildings", "day", "night", "urban", "background"],
  source: glsl(
    `// Isometric city: an orthographic camera walks the city's grid cell by cell (48 cells at most), meeting each
// cell's building box or the street analytically. A sun circles for the day, windows light up at dusk.
uniform vec3 uBuilding;    // @control color default=#E8DCCB label="Buildings"
uniform vec3 uAccent;      // @control color default=#7FA7D9 label="Accent buildings"
uniform vec3 uGround;      // @control color default=#B9C7A5 label="Ground"
uniform vec3 uRoad;        // @control color default=#5B6170 label="Roads"
uniform vec3 uWindow;      // @control color default=#FFD27A label="Window light"
uniform float uDayLength;  // @control min=4 max=120 default=40 label="Day length (s)"
uniform float uTimeOfDay;  // @control min=0 max=1 default=0.15 label="Time of day"
uniform float uHeight;     // @control min=0.3 max=2 default=1 label="Building height"
uniform float uRise;       // @control min=0 max=10 default=3 label="Rise time (s)"
uniform float uZoom;       // @control min=0.5 max=2 default=1 label="Zoom"
uniform float uPan;        // @control min=0 max=2 default=0.4 label="Pan speed"`,
    HASH,
    `const float BLOCK = 4.0;
const float MAXH = 7.0;

bool isRoad(vec2 c) {
  return mod(c.x, BLOCK) < 0.5 || mod(c.y, BLOCK) < 0.5;
}

// The building in cell c: its height (0 for none) and kind (a hash).
vec2 building(vec2 c) {
  if (isRoad(c)) return vec2(0.0);
  float h = hash12(c);
  float k = hash12(c + 17.3);
  // A little park.
  if (k < 0.08) return vec2(0.0, k);
  // Downtowns: taller where a slow wave of districts peaks.
  float district = 0.5 + 0.5 * sin(c.x * 0.13 + 1.3) * sin(c.y * 0.11 + 0.4);
  float height = (0.6 + 0.6 * h + 4.8 * pow(h, 4.0) * district) * uHeight;
  float start = hash12(c + 5.1) * uRise * 0.75;
  float grow = uRise <= 0.0 ? 1.0 : smoothstep(start, start + uRise * 0.25 + 0.01, iTime);
  return vec2(min(height, MAXH) * grow, k);
}

// The sun's direction, and how much of the day it is (1 by day, 0 at night).
vec4 sunAt() {
  float phase = fract(uTimeOfDay + iTime / uDayLength) * 6.28318;
  vec3 dir = normalize(vec3(cos(phase) * 0.8, sin(phase), 0.45));
  return vec4(dir, smoothstep(-0.22, 0.2, dir.y));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 d = normalize(vec3(-1.0, -0.82, -1.0));
  vec3 rt = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, d);
  vec3 target = vec3(1.0, 0.0, 0.3) * iTime * uPan + vec3(0.5, 0.0, 0.5);
  vec3 o = target + (p.x * rt + p.y * up) * 10.0 / uZoom - d * 40.0;
  // Start where the ray comes down to the tallest buildings.
  float t = (MAXH - o.y) / d.y;
  vec3 pos = o + d * t;
  vec2 cell = floor(pos.xz);
  vec2 stepDir = sign(d.xz);
  vec2 delta = abs(1.0 / d.xz);
  vec2 side = (stepDir * (cell - pos.xz) + stepDir * 0.5 + 0.5) * delta + t;
  vec3 inv = 1.0 / d;

  vec4 sun = sunAt();
  float day = sun.w;
  float night = 1.0 - day;
  vec3 ambient = mix(vec3(0.22, 0.26, 0.45), vec3(1.0), day);
  vec3 col = uGround * ambient * 0.7;
  for (int i = 0; i < 48; i++) {
    float tExit = min(side.x, side.y);
    vec2 b = building(cell);
    if (b.x > 0.0) {
      // The building's box, inset from the cell's edges.
      vec3 lo = vec3(cell.x + 0.12, 0.0, cell.y + 0.12);
      vec3 hi = vec3(cell.x + 0.88, b.x, cell.y + 0.88);
      vec3 t0 = (lo - o) * inv;
      vec3 t1 = (hi - o) * inv;
      vec3 tn = min(t0, t1);
      vec3 tf = max(t0, t1);
      float tin = max(max(tn.x, tn.y), tn.z);
      float tout = min(min(tf.x, tf.y), tf.z);
      if (tin < tout && tout > 0.0) {
        vec3 hp = o + d * tin;
        vec3 n = tin == tn.y ? vec3(0.0, 1.0, 0.0) : tin == tn.x ? vec3(-stepDir.x, 0.0, 0.0) : vec3(0.0, 0.0, -stepDir.y);
        vec3 base = mix(uBuilding, uAccent, step(0.72, b.y)) * (0.85 + 0.3 * hash12(cell + 2.0));
        float light = max(dot(n, sun.xyz), 0.0) * day;
        // Faces keep the isometric look: the top brightest, the two sides apart.
        float face = n.y > 0.5 ? 1.0 : abs(n.x) > 0.5 ? 0.78 : 0.62;
        vec3 c = base * face * (ambient * 0.55 + vec3(1.0, 0.95, 0.85) * light * 0.6);
        if (n.y < 0.5) {
          // Windows on the sides: a grid of panes, glass by day and lit at random by night.
          float along = abs(n.x) > 0.5 ? hp.z : hp.x;
          vec2 g = vec2(along * 4.0, hp.y * 3.2);
          vec2 f = fract(g);
          float pane = step(0.25, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.78) * step(0.25, hp.y) * step(hp.y, b.x - 0.15);
          float on = step(hash12(floor(g) + cell * 7.0 + n.xz * 3.0), night * 0.75 - 0.05);
          vec3 glass = mix(vec3(0.35, 0.5, 0.65) * ambient * face, uWindow * 1.6, on);
          c = mix(c, glass, pane);
          // Darker toward the ground.
          c *= 0.7 + 0.3 * smoothstep(0.0, 1.2, hp.y);
        } else {
          // A parapet around the roof.
          vec2 r = abs(fract(hp.xz) - 0.5);
          c *= 0.9 + 0.1 * step(max(r.x, r.y), 0.3);
        }
        col = c;
        break;
      }
    }
    // Reaching the ground in this cell.
    float tg = -o.y / d.y;
    if (tg <= tExit) {
      vec3 gp = o + d * tg;
      vec2 f = fract(gp.xz);
      vec3 g;
      if (isRoad(cell)) {
        g = uRoad;
        // Lane markings, and traffic in both directions.
        bool alongX = mod(cell.y, BLOCK) < 0.5;
        bool junction = mod(cell.x, BLOCK) < 0.5 && mod(cell.y, BLOCK) < 0.5;
        float across = alongX ? f.y : f.x;
        float run = alongX ? gp.x : gp.z;
        float lane = across < 0.5 ? 1.0 : -1.0;
        g = mix(g, vec3(0.92), step(abs(across - 0.5), 0.02) * step(0.5, fract(run * 2.0)) * (junction ? 0.0 : 1.0));
        float road = alongX ? cell.y : cell.x;
        float slot = run * 0.25 - iTime * 0.35 * lane + hash12(vec2(road, lane));
        float car = step(abs(across - 0.5 + lane * 0.22), 0.11) * step(abs(fract(slot) - 0.5), 0.07) * step(0.4, hash12(vec2(floor(slot), road + lane)));
        vec3 carCol = mix(vec3(0.9, 0.3, 0.3), vec3(0.3, 0.5, 0.9), hash12(vec2(floor(slot), road)));
        g = mix(g, mix(carCol, vec3(1.0, 0.9, 0.6) * 2.0, night), car);
      } else {
        g = b.y < 0.08 ? uGround * vec3(0.8, 1.0, 0.75) : uGround;
        // Shade around a building's foot.
        vec2 q = abs(f - 0.5);
        g *= b.x > 0.0 ? mix(0.6, 1.0, smoothstep(0.38, 0.5, max(q.x, q.y))) : 1.0;
        // Street lights at the corners of each lot by night.
        vec2 corner = q - 0.42;
        float lamp = exp(-length(max(corner, 0.0)) * 18.0) * step(0.0, corner.x) * step(0.0, corner.y);
        g += uWindow * lamp * night * 1.5;
      }
      col = g * mix(ambient * 0.7, ambient, day);
      break;
    }
    if (side.x < side.y) {
      side.x += delta.x;
      cell.x += stepDir.x;
    } else {
      side.y += delta.y;
      cell.y += stepDir.y;
    }
  }
  // Warm light at dawn and dusk.
  col *= mix(vec3(1.0), vec3(1.15, 0.85, 0.7), smoothstep(0.35, 0.0, abs(sun.y)) * 0.6);
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Night", values: { uTimeOfDay: 0.72, uDayLength: 120 } },
    { name: "Toy town", values: { uBuilding: [1, 0.86, 0.75], uAccent: [1, 0.55, 0.5], uGround: [0.66, 0.85, 0.55], uRoad: [0.55, 0.58, 0.66], uHeight: 0.6, uZoom: 1.4 } },
  ],
};

export const wireframeTerrain: ShaderEffect = {
  kind: "shader",
  id: "wireframe-terrain",
  name: "Wireframe terrain",
  description: "A fly-over of a glowing wireframe mesh of hills and valleys, the lines coloured by height and fading into fog on the horizon.",
  category: "3d",
  tags: ["3d", "terrain", "wireframe", "mesh", "landscape", "sci-fi", "retro", "background"],
  source: glsl(
    `// Wireframe terrain: a noise heightfield ray-marched with steps that grow with distance (80 at most), a
// triangle mesh's lines drawn on it from the hit point (anti-aliased with fwidth), fog toward the horizon.
uniform vec3 uSky;          // @control color default=#03040C label="Sky"
uniform vec3 uHorizon;      // @control color default=#3A1E5C label="Horizon glow"
uniform vec3 uFill;         // @control color default=#05060F label="Surface"
uniform vec3 uLineLow;      // @control color default=#00E5FF label="Lines (low)"
uniform vec3 uLineHigh;     // @control color default=#FF3BD4 label="Lines (high)"
uniform float uHeight;      // @control min=0 max=3 default=1 label="Height"
uniform float uSpeed;       // @control min=0 max=4 default=1 label="Speed"
uniform float uDensity;     // @control min=0.5 max=4 default=1.5 label="Mesh density"
uniform float uLineWidth;   // @control min=0.5 max=4 default=1.2 label="Line width (px)"
uniform float uGlow;        // @control min=0 max=2 default=1 label="Glow"
uniform float uFog;         // @control min=0 max=2 default=1 label="Fog"`,
    HASH,
    `float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

// The ground's height: rolling noise hills, lower along the valley the camera flies down.
float terrain(vec2 xz) {
  vec2 q = xz * 0.12;
  float h = 0.0;
  float amp = 1.0;
  for (int i = 0; i < 3; i++) {
    h += amp * vnoise(q);
    q = mat2(0.8, 0.6, -0.6, 0.8) * q * 2.1 + 3.7;
    amp *= 0.45;
  }
  float valley = smoothstep(1.0, 9.0, abs(xz.x));
  return (h - 0.55) * 4.5 * uHeight * (0.25 + 0.75 * valley);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float z = iTime * uSpeed * 4.0;
  vec3 ro = vec3(sin(z * 0.03) * 1.5, 0.0, z);
  ro.y = max(terrain(ro.xz), 0.0) * 0.4 + 2.6 * max(uHeight, 0.4);
  vec3 fw = normalize(vec3(0.0, -0.22, 1.0));
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(p.x * rt + p.y * up + 1.3 * fw);

  // The sky: dark above, glowing toward the horizon.
  vec3 sky = mix(uHorizon, uSky, smoothstep(-0.05, 0.35, rd.y));
  sky += uHorizon * 0.6 * exp(-abs(rd.y) * 18.0);
  vec2 sp = floor(fragCoord / 2.0);
  sky += step(0.997, hash12(sp)) * smoothstep(0.0, 0.3, rd.y) * 0.7;
  vec3 col = sky;

  float far = 70.0;
  float t = 0.5;
  float prevT = t;
  float prevGap = 1.0;
  bool hit = false;
  for (int i = 0; i < 80; i++) {
    vec3 pos = ro + rd * t;
    float gap = pos.y - terrain(pos.xz);
    if (gap < 0.0) {
      // Between the last step above the ground and this one below it.
      t = prevT + (t - prevT) * prevGap / (prevGap - gap);
      hit = true;
      break;
    }
    prevT = t;
    prevGap = gap;
    t += max(0.06 * t, gap * 0.5);
    // Above the highest hill and climbing: nothing left to meet.
    if (t > far || (rd.y > 0.0 && pos.y > 5.0 * uHeight)) break;
  }
  if (hit) {
    vec3 pos = ro + rd * t;
    float h = terrain(pos.xz);
    // A triangle mesh: lines along x, along z and one diagonal.
    vec2 g = pos.xz * uDensity;
    vec3 coord = vec3(g, g.x - g.y);
    vec3 dist = abs(fract(coord + 0.5) - 0.5);
    vec3 w = fwidth(coord);
    vec3 lines3 = dist / max(w, 1e-4);
    float lineD = min(min(lines3.x, lines3.y), lines3.z);
    float line = 1.0 - smoothstep(uLineWidth * 0.5, uLineWidth * 0.5 + 1.0, lineD);
    float glow = exp(-lineD / (uLineWidth * 3.0)) * 0.45 * uGlow;
    // Lines too dense to tell apart blend into a faint wash.
    float dense = smoothstep(0.25, 0.6, max(max(w.x, w.y), w.z));
    float amount = mix(line + glow, 0.35, dense);
    vec3 lineCol = mix(uLineLow, uLineHigh, smoothstep(-1.5, 2.5, h / max(uHeight, 0.1)));
    vec3 surf = uFill + lineCol * amount;
    float fog = 1.0 - exp(-t * 0.035 * uFog);
    col = mix(surf, sky, clamp(fog * fog + smoothstep(far * 0.7, far, t), 0.0, 1.0));
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Matrix", values: { uSky: [0, 0.02, 0], uHorizon: [0, 0.25, 0.08], uFill: [0, 0.02, 0], uLineLow: [0, 0.6, 0.2], uLineHigh: [0.6, 1, 0.6] } },
    { name: "Blueprint", values: { uSky: [0.05, 0.15, 0.35], uHorizon: [0.2, 0.4, 0.7], uFill: [0.06, 0.18, 0.4], uLineLow: [0.75, 0.88, 1], uLineHigh: [1, 1, 1], uGlow: 0.3 } },
  ],
};

export const metaballs3d: ShaderEffect = {
  kind: "shader",
  id: "metaballs-3d",
  name: "3D metaballs",
  description: "Glossy 3D metaballs drifting, merging and pulling apart like liquid, reflecting a soft studio around them.",
  category: "3d",
  tags: ["3d", "metaballs", "liquid", "blob", "glossy", "chrome", "background"],
  source: glsl(
    `// 3D metaballs: spheres joined with a smooth minimum, ray-marched inside their bounding sphere (56 steps
// at most), shaded with a procedural studio environment for reflections and a fresnel rim.
uniform vec3 uBackground;  // @control color default=#0E0B1A label="Background"
uniform vec3 uColorA;      // @control color default=#FF4FA3 label="Colour A"
uniform vec3 uColorB;      // @control color default=#6B5BFF label="Colour B"
uniform int uCount;        // @control min=2 max=8 default=6 label="Balls"
uniform float uMerge;      // @control min=0.05 max=1 default=0.45 label="Merge"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uReflection; // @control min=0 max=1 default=0.7 label="Reflection"
uniform float uSize;       // @control min=0.5 max=1.5 default=1 label="Size"`,
    SPHERE_HIT,
    `vec3 ballAt(int i) {
  float fi = float(i);
  float t = iTime * uSpeed * 0.5;
  return vec3(sin(t * (0.7 + 0.13 * fi) + fi * 1.7) * 1.1, cos(t * (0.9 + 0.11 * fi) + fi * 2.3) * 0.7, sin(t * (0.5 + 0.07 * fi) + fi * 0.9) * 0.6) * uSize;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float scene(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float r = (0.42 + 0.12 * sin(float(i) * 3.1)) * uSize;
    d = smin(d, length(p - ballAt(i)) - r, uMerge);
  }
  return d;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.002;
  return normalize(e.xyy * scene(p + e.xyy) + e.yyx * scene(p + e.yyx) + e.yxy * scene(p + e.yxy) + e.xxx * scene(p + e.xxx));
}

// A studio around the balls: a dim room, a bright softbox overhead and two strip lights.
vec3 env(vec3 r) {
  vec3 c = mix(uBackground * 0.6, uBackground * 2.0 + 0.08, smoothstep(-0.4, 0.6, r.y));
  c += vec3(2.2) * smoothstep(0.82, 0.9, r.y);
  float a = atan(r.x, r.z);
  c += vec3(1.4, 1.3, 1.2) * smoothstep(0.06, 0.0, abs(a - 1.9)) * smoothstep(-0.4, 0.0, r.y) * smoothstep(0.7, 0.3, r.y);
  c += vec3(0.9, 1.1, 1.4) * smoothstep(0.05, 0.0, abs(a + 2.2)) * smoothstep(-0.3, 0.1, r.y) * smoothstep(0.6, 0.2, r.y);
  return c;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(p, -1.6));
  vec3 col = uBackground * (1.2 - 0.6 * length(p));
  vec2 b = sphereHit(ro, rd, 2.3 * uSize);
  if (b.x < b.y) {
    float t = max(b.x, 0.0);
    bool hit = false;
    for (int i = 0; i < 56; i++) {
      float d = scene(ro + rd * t);
      if (d < 0.001) {
        hit = true;
        break;
      }
      t += d;
      if (t > b.y) break;
    }
    if (hit) {
      vec3 pos = ro + rd * t;
      vec3 n = normalAt(pos);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
      vec3 base = mix(uColorA, uColorB, smoothstep(-0.6, 0.6, n.x * 0.7 + n.y * 0.5 + 0.2 * sin(iTime * 0.3)));
      vec3 l = normalize(vec3(0.4, 0.8, 0.6));
      float diff = max(dot(n, l), 0.0);
      vec3 refl = env(reflect(rd, n));
      col = base * (0.15 + 0.6 * diff) + refl * mix(0.08, 0.9, uReflection) * mix(0.35, 1.0, fres) + base * fres * 0.3;
      col += pow(max(dot(reflect(rd, n), l), 0.0), 80.0) * 1.2;
    }
  }
  fragColor = vec4(col / (1.0 + col * 0.15), 1.0);
}`,
  ),
  presets: [
    { name: "Chrome", values: { uBackground: [0.06, 0.06, 0.08], uColorA: [0.35, 0.36, 0.4], uColorB: [0.55, 0.56, 0.6], uReflection: 1 } },
    { name: "Candy", values: { uBackground: [1, 0.9, 0.93], uColorA: [1, 0.45, 0.6], uColorB: [1, 0.75, 0.3], uReflection: 0.45 } },
  ],
};

export const torusKnot: ShaderEffect = {
  kind: "shader",
  id: "torus-knot",
  name: "Torus knot",
  description: "A glowing torus knot tube turning slowly, its surface shimmering with iridescent thin-film colour.",
  category: "3d",
  tags: ["3d", "knot", "torus", "iridescent", "glow", "abstract", "background"],
  source: glsl(
    `// Torus knot: a (p, q) knot's tube as a distance from each of its p strands around the torus, ray-marched
// inside a bounding sphere (80 steps at most); the march's near misses add up to a glow around it.
uniform vec3 uBackground;  // @control color default=#05040B label="Background"
uniform vec3 uGlowColor;   // @control color default=#7A5CFF label="Glow"
uniform int uP;            // @control min=1 max=7 default=2 label="Turns around (p)"
uniform int uQ;            // @control min=1 max=9 default=3 label="Turns through (q)"
uniform float uThickness;  // @control min=0.05 max=0.35 default=0.16 label="Thickness"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uIridescence; // @control min=0 max=1 default=0.8 label="Iridescence"
uniform float uGlow;       // @control min=0 max=2 default=1 label="Glow amount"`,
    SPHERE_HIT,
    `const float R = 1.0;
const float STRAND = 0.45;

mat3 turn(float a, float b) {
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  return mat3(1.0, 0.0, 0.0, 0.0, cb, sb, 0.0, -sb, cb) * mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca);
}

// The tube's distance (an underestimate: the march takes shorter steps), and how far along the knot (0-1).
vec2 knot(vec3 p) {
  float r = length(p.xz);
  float a = atan(p.z, p.x);
  vec2 q = vec2(r - R, p.y);
  float best = 1e9;
  float along = 0.0;
  float P = float(uP);
  for (int k = 0; k < 7; k++) {
    if (k >= uP) break;
    float s = (a + 6.28318 * float(k)) / P;
    float ang = s * float(uQ);
    float d = length(q - STRAND * vec2(cos(ang), sin(ang)));
    if (d < best) {
      best = d;
      along = s / 6.28318;
    }
  }
  return vec2(best - uThickness, along);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 0.0, 5.2);
  vec3 rd = normalize(vec3(p, -1.3));
  float t0 = iTime * uSpeed;
  mat3 m = turn(t0 * 0.3, 1.15 + 0.25 * sin(t0 * 0.2));
  vec3 lro = m * ro;
  vec3 lrd = m * rd;
  vec3 col = uBackground + uGlowColor * 0.05 * (1.0 - length(p));
  float glow = 0.0;
  vec2 b = sphereHit(lro, lrd, R + STRAND + uThickness + 0.05);
  if (b.x < b.y) {
    float t = max(b.x, 0.0);
    bool hit = false;
    vec2 h = vec2(0.0);
    for (int i = 0; i < 80; i++) {
      h = knot(lro + lrd * t);
      if (h.x < 0.001) {
        hit = true;
        break;
      }
      // The field stretches where strands wind fast around a small radius: step within its slope.
      vec3 at = lro + lrd * t;
      float slope = STRAND * float(uQ) / (float(uP) * max(length(at.xz), 0.3));
      float dt = h.x / sqrt(1.0 + slope * slope) * 0.9;
      // Glow by the length of ray spent near the tube, so it does not depend on the step count.
      glow += exp(-h.x * 9.0) * min(dt, b.y - t) * 0.6;
      t += dt;
      if (t > b.y) break;
    }
    if (hit) {
      vec3 pos = lro + lrd * t;
      vec2 e = vec2(0.002, 0.0);
      vec3 n = normalize(vec3(knot(pos + e.xyy).x - knot(pos - e.xyy).x, knot(pos + e.yxy).x - knot(pos - e.yxy).x, knot(pos + e.yyx).x - knot(pos - e.yyx).x));
      float facing = max(dot(n, -lrd), 0.0);
      // Thin film: the colour shifts with the viewing angle and along the knot.
      vec3 film = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + (1.0 - facing) * 1.4 + h.y * 2.0 + iTime * 0.05));
      vec3 base = mix(uGlowColor, film, uIridescence);
      vec3 l = normalize(m * vec3(0.5, 0.7, 0.6));
      float diff = max(dot(n, l), 0.0);
      float spec = pow(max(dot(reflect(lrd, n), l), 0.0), 60.0);
      float rim = pow(1.0 - facing, 3.0);
      col = base * (0.18 + 0.75 * diff) + spec * 0.9 + mix(uGlowColor, film, 0.5) * rim * 0.9;
    }
  }
  col += uGlowColor * glow * uGlow;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Trefoil", values: { uP: 2, uQ: 3 } },
    { name: "Cinquefoil", values: { uP: 2, uQ: 5, uThickness: 0.12 } },
    { name: "Gold", values: { uP: 3, uQ: 4, uThickness: 0.11, uGlowColor: [1, 0.7, 0.25], uIridescence: 0.3 } },
  ],
};

export const threeDShaders: readonly ShaderEffect[] = [globe, rotatingShapes, isometricCity, wireframeTerrain, metaballs3d, torusKnot];
