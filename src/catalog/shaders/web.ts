import { glsl, HASH, NOISE } from "../glsl.js";
import type { ShaderEffect } from "../types.js";

/*
 * Webbing: a dewy orb web, cobwebs hung in the corners of a page, a web shot
 * at every click and a plexus of drifting points strung together. Each is
 * tagged "web", so the family is easy to find together.
 *
 * The orb webs share one trick: a point's radius is measured to the straight
 * chord between its two spokes (`r · cos(off-centre angle) / cos(half the
 * sector)`), so rings of constant chord radius come out as the polygons a
 * spider actually spins, not circles.
 */

/** `over(acc, colour, alpha)` onto a premultiplied accumulator; `unpremultiply(acc)` for the output. */
const OVER = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 unpremultiply(vec4 acc) {
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}`.trim();

/**
 * `clickAt(i, demo)`: click `i`, newest first, as (x, y, time, 1), or zeros
 * for none. With the demo on and no real clicks yet, a synthetic click lands
 * every 2 s at a pseudo-random spot (needs {@link HASH}).
 */
const CLICKS = `
vec4 clickAt(int i, bool demo) {
  if (!demo || iClicks[0].w > 0.5) return iClicks[i];
  float k = floor(iTime / 2.0) - float(i);
  vec2 h = hash22(vec2(k * 1.37 + 0.5, 3.7));
  return vec4((0.15 + 0.7 * h) * iResolution.xy, k * 2.0, 1.0);
}`.trim();

/** `strand(d)`: a thread's coverage at `d` pixels from its centre line, `uWidth` pixels wide, antialiased. */
const STRAND = `
float strand(float d) {
  return clamp(0.5 * uWidth + 0.5 - d, 0.0, 1.0);
}`.trim();

export const spiderWeb: ShaderEffect = {
  kind: "shader",
  id: "spider-web",
  name: "Spider web",
  description:
    "An orb web strung across the frame, spokes and a spiral of straight silk threads swaying in the breeze, beaded with glinting dew over soft out-of-focus leaves.",
  category: "organic",
  tags: ["background", "web", "spider", "dew", "nature", "halloween", "autumn", "macro"],
  source: glsl(
    `// Spider web: spokes and a polygonal spiral (rings of constant chord radius, stepping out a little per sector), swaying, with dew drops along the spiral.
uniform vec3 uBackground; // @control color default=#070B0A label="Background"
uniform vec3 uBokeh;      // @control color default=#2F5D44 label="Bokeh"
uniform vec3 uThread;     // @control color default=#E6EDF2 label="Silk"
uniform vec3 uDew;        // @control color default=#FFFFFF label="Dew"
uniform float uSize;      // @control min=0.2 max=1.5 default=0.85 label="Web size"
uniform float uSpokes;    // @control min=6 max=36 default=22 step=1 label="Spokes"
uniform float uTurns;     // @control min=4 max=40 default=20 label="Spiral turns"
uniform float uWidth;     // @control min=0.5 max=4 default=1.1 label="Thread width (px)"
uniform float uDewAmount; // @control min=0 max=1 default=0.5 label="Dew"
uniform float uSheen;     // @control min=0 max=1 default=0.3 label="Rainbow sheen"
uniform float uSway;      // @control min=0 max=1 default=0.4 label="Sway"
uniform float uSpeed;     // @control min=0 max=2 default=0.6 label="Wind speed"`,
    HASH,
    NOISE,
    STRAND,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float t = iTime * uSpeed;
  // Ground: dark, with blurred leaves of light drifting behind.
  float b = smoothstep(0.55, 0.9, vnoise(p * 2.2 + vec2(0.04 * t, 0.0))) + 0.6 * smoothstep(0.6, 0.95, vnoise(p * 4.1 - vec2(0.0, 0.03 * t) + 9.0));
  vec3 col = mix(uBackground, uBokeh, clamp(b * (1.0 - 0.6 * length(p)), 0.0, 1.0));
  // The web billows: its rim moves most, its hub least.
  float R = 0.5 * uSize;
  float r0 = length(p);
  vec2 gust = vec2(sin(t * 0.9) + 0.4 * sin(t * 2.3), 0.6 * sin(t * 0.7 + 1.3));
  p -= uSway * 0.035 * gust * smoothstep(0.0, R, r0);
  p += 0.012 * (vec2(vnoise(p * 3.0), vnoise(p * 3.0 + 7.3)) - 0.5);
  float r = length(p);
  float a = atan(p.y, p.x);
  float n = floor(uSpokes);
  float sector = 6.28318 / n;
  float h = 0.5 * sector;
  // Spokes, from the hub out past the web to its anchors.
  float k = floor(a / sector + 0.5);
  float dSpoke = r * abs(sin(a - k * sector)) / px;
  float spokes = strand(dSpoke) * smoothstep(0.015, 0.03, r) * (1.0 - 0.6 * smoothstep(R, 1.4 * R, r));
  // Spiral: the chord radius through this point, stepping out a ring's 1/n each sector.
  float j = floor((a + 3.14159) / sector);
  float dm = a + 3.14159 - (j + 0.5) * sector;
  float rr = r * cos(dm) / cos(h);
  float spacing = R / uTurns;
  // Each sector's threads sit a little off true, as a spider spins them.
  float u = rr / spacing - j / n + 0.12 * (hash12(vec2(j, 5.3)) - 0.5);
  float x = u - floor(u + 0.5);
  float ring = floor(u + 0.5);
  float zone = smoothstep(0.12 * R, 0.15 * R, rr) * (1.0 - smoothstep(R - spacing, R, rr));
  // A few threads snapped, as in any real web.
  float whole = step(0.05, hash12(vec2(ring, j)));
  float spiral = strand(abs(x) * spacing * cos(h) / px) * zone * whole;
  // The hub: a tight mesh of a few rings.
  float hu = rr / (0.025 * R);
  float hub = strand(abs(hu - floor(hu + 0.5)) * 0.025 * R * cos(h) / px) * (1.0 - smoothstep(0.08 * R, 0.09 * R, rr));
  float silk = max(spokes, max(spiral, hub));
  // Light catches the silk in patches, splitting into a rainbow where it does.
  float catchLight = 0.45 + 0.9 * smoothstep(0.35, 0.8, vnoise(p * 3.5 + vec2(0.3 * t, -0.2 * t)));
  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (2.0 * r + 0.3 * a + 0.05 * t + vec3(0.0, 0.33, 0.67)));
  vec3 silkColor = mix(uThread, uThread * rainbow * 1.6, uSheen * smoothstep(0.6, 1.2, catchLight)) * catchLight;
  col = mix(col, silkColor, clamp(silk, 0.0, 1.0));
  col += silkColor * 0.12 * exp(-min(dSpoke, abs(x) * spacing / px) / (3.0 * uWidth)) * zone;
  // Dew: drops along the spiral, in cells along each thread's length.
  float cellLen = 0.045;
  float s = (a + 3.14159) * rr;
  float c = floor(s / cellLen);
  vec2 dh = hash22(vec2(ring * 13.1 + c, j));
  if (dh.x < uDewAmount * 0.7 && zone > 0.5 && whole > 0.5) {
    // Kept inside their cell and between the neighbouring threads, so none is cut off.
    float rd = min(mix(0.005, 0.014, dh.y * dh.y) * uSize, min(0.3 * cellLen, 0.45 * spacing * cos(h)));
    vec2 dd = vec2(s - (c + 0.3 + 0.4 * dh.y) * cellLen, x * spacing * cos(h));
    float dist = length(dd);
    float m = 1.0 - smoothstep(rd - px, rd, dist);
    vec2 nn = dd / rd;
    float spec = 1.0 - smoothstep(0.0, 0.35, length(nn - vec2(-0.3, 0.35)));
    float twinkle = 0.6 + 0.4 * sin(iTime * 2.0 + dh.x * 40.0);
    vec3 drop = mix(col * 0.6 + uDew * 0.15, uDew, 0.5 * smoothstep(0.5, 1.0, length(nn))) + uDew * spec * twinkle * 1.5;
    col = mix(col, drop, m);
    col += uDew * 0.15 * twinkle * exp(-dist / (2.0 * rd)) * (1.0 - m);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Moonlit", values: { uBackground: [0.02, 0.03, 0.07], uBokeh: [0.16, 0.22, 0.42], uThread: [0.82, 0.88, 1], uSheen: 0.2 } },
    { name: "Dry", values: { uDewAmount: 0, uSheen: 0.7 } },
    { name: "Morning dew", values: { uDewAmount: 1, uBokeh: [0.55, 0.42, 0.18], uSpeed: 0.3 } },
    { name: "Light", values: { uBackground: [0.95, 0.96, 0.94], uBokeh: [0.8, 0.88, 0.78], uThread: [0.25, 0.28, 0.32], uDew: [0.55, 0.62, 0.7], uSheen: 0.2 } },
  ],
};

export const cobwebCorners: ShaderEffect = {
  kind: "shader",
  id: "cobweb-corners",
  name: "Cobweb corners",
  description:
    "Dusty, tattered cobwebs strung across the corners of the frame, their threads sagging and gently stirring, with loose strands hanging down: a spooky overlay for a page or picture.",
  category: "overlay",
  tags: ["overlay", "web", "spider", "cobweb", "halloween", "spooky", "haunted", "dust"],
  transparent: true,
  source: glsl(
    `// Cobweb corners: a fan of spokes in each corner, sagging chords between them (some snapped), and loose strands hanging from the top webs.
uniform vec3 uColor;      // @control color default=#E3E6EA label="Silk"
uniform float uOpacity;   // @control min=0 max=1 default=0.85 label="Opacity"
uniform float uSize;      // @control min=0.2 max=1 default=0.55 label="Web size"
uniform float uSpokes;    // @control min=3 max=12 default=7 step=1 label="Spokes"
uniform float uThreads;   // @control min=3 max=24 default=11 label="Threads"
uniform float uWidth;     // @control min=0.5 max=4 default=1.2 label="Thread width (px)"
uniform float uSag;       // @control min=0 max=1 default=0.5 label="Sag"
uniform float uTatter;    // @control min=0 max=0.8 default=0.25 label="Tattered"
uniform float uStrands;   // @control min=0 max=1 default=0.6 label="Hanging strands"
uniform float uSway;      // @control min=0 max=1 default=0.4 label="Sway"
uniform bool uTop;        // @control default=true label="Top corners"
uniform bool uBottom;     // @control default=false label="Bottom corners"`,
    HASH,
    OVER,
    STRAND,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 res = iResolution.xy * px;
  vec2 uv = fragCoord * px;
  float R = uSize;
  float n = floor(uSpokes);
  float h = 0.25 * 3.14159 / n;
  vec4 acc = vec4(0.0);
  for (int corner = 0; corner < 4; corner++) {
    bool top = corner < 2;
    if ((top && !uTop) || (!top && !uBottom)) continue;
    float cid = float(corner);
    // Distances from the corner's two walls.
    vec2 q = vec2(corner == 0 || corner == 2 ? uv.x : res.x - uv.x, top ? res.y - uv.y : uv.y);
    if (q.x > 2.0 * R || q.y > 2.2 * R) continue;
    // A slow stir, more at the web's free edge.
    float r0 = length(q);
    float stir = uSway * 0.04 * sin(iTime * 0.8 + cid * 1.7) * smoothstep(0.0, R, r0);
    q += stir * vec2(0.4, top ? 1.0 : -1.0);
    float r = length(q);
    float a = atan(q.y, q.x);
    float w = clamp(1.0 - smoothstep(0.85 * R, R, r), 0.0, 1.0);
    float silk = 0.0;
    // Spokes: between the walls, each its own length.
    float k = clamp(floor(a / (2.0 * h) + 0.5), 1.0, n - 1.0);
    float spokeLen = R * (0.75 + 0.3 * hash12(vec2(k, cid)));
    silk = max(silk, strand(r * abs(sin(a - k * 2.0 * h)) / px) * (1.0 - smoothstep(spokeLen - 0.05, spokeLen, r)));
    // Chords: sagging away from the corner, each sector's rings a little out of step with the next.
    float j = clamp(floor(a / (2.0 * h)), 0.0, n - 1.0);
    float dm = a - (j + 0.5) * 2.0 * h;
    float bow = 1.0 - (dm / h) * (dm / h);
    float rr = r * cos(dm) / cos(h);
    float rs = rr * (1.0 - 0.12 * uSag * bow);
    float shape = pow(max(rs / R, 1e-4), 0.8);
    float u = shape * uThreads + 0.35 * hash12(vec2(j, cid + 4.0));
    float x = u - floor(u + 0.5);
    float ring = floor(u + 0.5);
    float gradU = 0.8 * uThreads / R * pow(max(rs / R, 1e-4), -0.2) / cos(h);
    float snapped = step(uTatter, hash12(vec2(ring * 7.3 + j, cid)));
    float chord = strand(abs(x) / gradU / px) * snapped * step(0.6, u) * w;
    // Dust settles on some threads, greying them.
    float dust = hash12(vec2(ring + 31.0, j + cid * 9.0));
    silk = max(silk, chord * mix(0.55, 1.0, dust));
    // Loose strands hang from the top webs, swinging slowly.
    if (top) {
      for (int i = 0; i < 3; i++) {
        float hi = hash12(vec2(float(i) * 3.1, cid + 11.0));
        if (hi > uStrands) continue;
        float sx = R * (0.25 + 0.45 * hash12(vec2(float(i), cid + 2.0)));
        float len = R * (0.9 + 0.8 * hi);
        float fall = clamp(q.y / len, 0.0, 1.0);
        float swing = uSway * 0.03 * sin(iTime * (0.9 + 0.3 * hi) + float(i) * 2.1 + cid) * fall * fall;
        float d = abs(q.x - sx - swing) / px;
        silk = max(silk, strand(d) * (1.0 - smoothstep(0.7 * len, len, q.y)) * 0.7);
      }
    }
    acc = over(acc, uColor * (0.8 + 0.2 * hash12(floor(fragCoord / 3.0))), clamp(silk, 0.0, 1.0) * uOpacity);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Haunted", values: { uSize: 0.8, uTatter: 0.45, uStrands: 1, uBottom: true } },
    { name: "Fresh", values: { uTatter: 0, uSag: 0.2, uStrands: 0, uThreads: 16 } },
    { name: "Dark silk", values: { uColor: [0.12, 0.13, 0.15], uOpacity: 0.7 } },
  ],
};

export const webShot: ShaderEffect = {
  kind: "shader",
  id: "web-shot",
  name: "Web shot",
  description:
    "A line of silk shoots from the bottom of the frame to every click and bursts into a sticky web splat that hangs there, then fades.",
  category: "interaction",
  tags: ["interactive", "click", "overlay", "web", "spider", "superhero", "comic", "splat"],
  transparent: true,
  source: glsl(
    `// Web shot: per click, a strand from the shooter to the click, then a splat of uneven spokes and sagging rings springing open.
uniform vec3 uColor;      // @control color default=#F4F6F8 label="Silk"
uniform vec2 uOrigin;     // @control min=0 max=1 default=0.5,0 label="Shooter (0–1 of the frame)"
uniform float uSize;      // @control min=0.05 max=0.5 default=0.2 label="Splat size"
uniform float uSpokes;    // @control min=5 max=16 default=10 step=1 label="Spokes"
uniform float uRings;     // @control min=1 max=6 default=4 step=1 label="Rings"
uniform float uWidth;     // @control min=0.5 max=5 default=2 label="Thread width (px)"
uniform float uLife;      // @control min=0.5 max=8 default=1.8 label="Lifetime"
uniform bool uShadow;     // @control default=true label="Shadow"
uniform bool uDemo;       // @control default=true label="Demo when idle"`,
    HASH,
    CLICKS,
    OVER,
    STRAND,
    `// The splat's silk at offset d (frame heights) from its centre, opened to fraction o, seeded by s.
float splat(vec2 d, float o, float s, float px) {
  float R = uSize * o;
  float r = length(d);
  if (r > 1.25 * R + 4.0 * px) return 0.0;
  float a = atan(d.y, d.x) + 6.28318 * hash12(vec2(s, 1.7));
  float n = floor(uSpokes);
  float sector = 6.28318 / n;
  float h = 0.5 * sector;
  float k = floor(a / sector + 0.5);
  // Spokes, each its own length.
  float len = R * (0.7 + 0.55 * hash12(vec2(mod(k, n), s)));
  float silk = strand(r * abs(sin(a - k * sector)) / px) * (1.0 - smoothstep(len - 2.0 * px, len, r));
  // Rings: chords sagging in towards the centre, stopping at the shorter of their two spokes.
  float j = floor(a / sector);
  float dm = a - (j + 0.5) * sector;
  float rr = r * cos(dm) / cos(h);
  float bow = 1.0 - (dm / h) * (dm / h);
  float reach = R * (0.7 + 0.55 * min(hash12(vec2(mod(j, n), s)), hash12(vec2(mod(j + 1.0, n), s))));
  float spacing = 0.9 * R / max(uRings, 1.0);
  float u = (rr + 0.25 * spacing * bow) / spacing;
  float x = u - floor(u + 0.5);
  silk = max(silk, strand(abs(x) * spacing * cos(h) / px) * step(0.5, u) * (1.0 - smoothstep(reach - 2.0 * px, reach, rr)));
  // A glob of silk where it struck.
  silk = max(silk, 1.0 - smoothstep(0.06 * R - px, 0.06 * R, r));
  return clamp(silk, 0.0, 1.0);
}

// The strand from a to b, drawn on to fraction f: its coverage at p.
float shotLine(vec2 p, vec2 a, vec2 b, float f, float px) {
  vec2 e = (b - a) * f;
  float l = clamp(dot(p - a, e) / max(dot(e, e), 1e-8), 0.0, 1.0);
  return strand(length(p - a - e * l) / px);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  vec2 origin = uOrigin * iResolution.xy * px;
  vec2 shadow = vec2(1.5, -2.5) * px;
  vec4 acc = vec4(0.0);
  for (int i = 7; i >= 0; i--) {
    vec4 c = clickAt(i, uDemo);
    if (c.w < 0.5) continue;
    float age = iTime - c.z;
    if (age < 0.0 || age > uLife + 0.3) continue;
    vec2 at = c.xy * px;
    float seed = c.z * 3.7 + c.x * 0.013;
    // The shot: 0.15 s to fly, then the line slackens and fades as the splat springs open.
    float fly = clamp(age / 0.15, 0.0, 1.0);
    float lineFade = 1.0 - smoothstep(0.2, 0.55, age);
    float o = clamp((age - 0.13) / 0.25, 0.0, 1.0);
    o = 1.0 + 0.15 * sin(o * 5.0) * (1.0 - o) - (1.0 - o) * (1.0 - o) * (1.0 - o);
    o *= step(0.13, age);
    float fade = 1.0 - smoothstep(0.75 * uLife, uLife + 0.3, age);
    fly = fly * fly * (3.0 - 2.0 * fly);
    float line = shotLine(p, origin, at, fly, px) * lineFade;
    float web = splat(p - at, o, seed, px);
    if (uShadow) {
      float sh = max(shotLine(p - shadow, origin, at, fly, px) * lineFade, splat(p - shadow - at, o, seed, px));
      acc = over(acc, vec3(0.0), 0.35 * sh * fade);
    }
    acc = over(acc, uColor, max(line, web) * fade);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Black silk", values: { uColor: [0.08, 0.08, 0.1], uShadow: false } },
    { name: "Big splat", values: { uSize: 0.4, uSpokes: 14, uRings: 6, uLife: 3 } },
    { name: "From the corner", values: { uOrigin: [1, 0] } },
  ],
};

export const plexusWeb: ShaderEffect = {
  kind: "shader",
  id: "plexus-web",
  name: "Plexus web",
  description:
    "A web of glowing points drifting in the dark, each strung to its neighbours by fine lines that brighten as they close in and fade as they part.",
  category: "particles",
  tags: ["background", "particles", "web", "plexus", "network", "constellation", "tech", "data", "hero"],
  source: glsl(
    `// Plexus web: one drifting point per grid cell, lines to the eight round it (and across its corners), bright when short.
uniform vec3 uBackground; // @control color default=#04060D label="Background"
uniform vec3 uColorA;     // @control color default=#38BDF8 label="Colour 1"
uniform vec3 uColorB;     // @control color default=#A78BFA label="Colour 2"
uniform float uDensity;   // @control min=3 max=20 default=8 label="Density"
uniform float uSpeed;     // @control min=0 max=2 default=0.5 label="Speed"
uniform float uReach;     // @control min=0.5 max=1.6 default=1.1 label="Line reach"
uniform float uWidth;     // @control min=0.5 max=3 default=1 label="Line width (px)"
uniform float uPoints;    // @control min=0 max=2 default=1 label="Point size"
uniform float uGlow;      // @control min=0 max=1 default=0.5 label="Glow"`,
    HASH,
    `vec2 node(vec2 id, float t) {
  vec2 h = hash22(id);
  return id + 0.5 + 0.38 * vec2(sin(t * (0.6 + h.x) + 6.28318 * h.y), cos(t * (0.5 + h.y) + 6.28318 * h.x));
}

// Light of the line from a to b at g (cell units), fading with its length.
float link(vec2 g, vec2 a, vec2 b, float cell) {
  vec2 e = b - a;
  float l = clamp(dot(g - a, e) / dot(e, e), 0.0, 1.0);
  float d = length(g - a - e * l) * cell;
  float on = 1.0 - smoothstep(0.6 * uReach, uReach, length(e));
  return on * (clamp(0.5 * uWidth + 0.5 - d, 0.0, 1.0) + uGlow * 0.25 * exp(-d / (3.0 * uWidth)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float cell = iResolution.y / uDensity;
  vec2 g = fragCoord / cell;
  vec2 id = floor(g);
  float t = iTime * uSpeed;
  vec2 pts[9];
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) pts[(y + 1) * 3 + x + 1] = node(id + vec2(x, y), t);
  float light = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i != 4) light += link(g, pts[4], pts[i], cell);
  }
  // Across the corners, so lines crossing this cell between its neighbours are drawn too.
  light += link(g, pts[1], pts[3], cell) + link(g, pts[1], pts[5], cell) + link(g, pts[7], pts[3], cell) + link(g, pts[7], pts[5], cell);
  float dots = 0.0;
  for (int i = 0; i < 9; i++) {
    float d = length(g - pts[i]) * cell;
    float twinkle = 0.7 + 0.3 * sin(iTime * 2.0 + 30.0 * hash12(id + vec2(i)));
    dots += twinkle * (clamp(2.0 * uPoints + 0.5 - d, 0.0, 1.0) + uGlow * 0.6 * exp(-d / (4.0 * uPoints + 1.0)));
  }
  vec2 p = fragCoord / iResolution.xy;
  vec3 tint = mix(uColorA, uColorB, smoothstep(0.0, 1.0, p.x + 0.25 * sin(t * 0.4 + p.y * 3.0)));
  vec3 lit = tint * (0.55 * min(light, 1.5) + min(dots, 2.0));
  // Light over the ground: on dark it adds, on a light ground the lines keep their own colour.
  vec3 col = uBackground * (1.0 - clamp(max(lit.r, max(lit.g, lit.b)), 0.0, 1.0)) + lit;
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Gold", values: { uColorA: [1, 0.8, 0.35], uColorB: [1, 0.5, 0.2] } },
    { name: "Dense", values: { uDensity: 14, uReach: 1.3, uPoints: 0.6 } },
    { name: "Calm", values: { uSpeed: 0.15, uGlow: 0.2 } },
    { name: "Light", values: { uBackground: [0.97, 0.97, 0.99], uColorA: [0.05, 0.4, 0.7], uColorB: [0.4, 0.25, 0.8], uGlow: 0.2 } },
  ],
};

/** The webbing shaders. */
export const webShaders: ShaderEffect[] = [spiderWeb, cobwebCorners, webShot, plexusWeb];
