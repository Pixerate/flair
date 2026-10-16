import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/** 3D value noise, 0–1: `vnoise3(p)` and `fbm3(p, octaves)`. */
const NOISE_3D = `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}
float fbm3(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * vnoise3(p);
    p = p * 2.03 + vec3(11.7, 3.1, 7.9);
    amp *= 0.5;
  }
  return sum;
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

export const volumetricClouds: ShaderEffect = {
  kind: "shader",
  id: "volumetric-clouds",
  name: "Volumetric clouds",
  description: "A ray-marched layer of soft, self-shadowed clouds drifting overhead, rimmed with a silver lining toward the sun.",
  category: "atmosphere",
  tags: ["atmosphere", "clouds", "sky", "background", "3d", "weather"],
  source: glsl(
    `// Volumetric clouds: a cloud slab ray-marched with fbm density and a short march toward the sun.
uniform vec3 uSkyTop;       // @control color default=#3A78C9 label="Sky (top)"
uniform vec3 uSkyHorizon;   // @control color default=#B8D8F2 label="Sky (horizon)"
uniform vec3 uCloudColor;   // @control color default=#FFFFFF label="Cloud colour"
uniform vec3 uShadowColor;  // @control color default=#5E6F8A label="Shadow colour"
uniform vec3 uSunColor;     // @control color default=#FFF3DC label="Sun colour"
uniform float uSunAzimuth;  // @control min=-3.1416 max=3.1416 default=0.4 label="Sun direction"
uniform float uSunHeight;   // @control min=0 max=1.5 default=0.35 label="Sun height"
uniform float uCoverage;    // @control min=0 max=1 default=0.5 label="Coverage"
uniform float uDensity;     // @control min=0.1 max=3 default=1 label="Density"
uniform float uSpeed;       // @control min=0 max=3 default=0.6 label="Drift speed"`,
    NOISE_3D,
    `const float BOTTOM = 1.5;
const float TOP = 3.2;

float cloudDensity(vec3 p, int octaves) {
  vec3 q = p * 0.42 + vec3(iTime * uSpeed * 0.12, 0.0, iTime * uSpeed * 0.05);
  float n = fbm3(q, octaves);
  float h = clamp((p.y - BOTTOM) / (TOP - BOTTOM), 0.0, 1.0);
  // Rounded tops and flat-ish bases.
  float shape = smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.45, 1.0, h));
  return clamp((n - (1.0 - uCoverage) * 0.75) * 3.0 * shape, 0.0, 1.0) * uDensity;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 rd = normalize(vec3(p.x, p.y + 0.28, 1.0));
  vec3 sun = normalize(vec3(sin(uSunAzimuth), uSunHeight, cos(uSunAzimuth)));
  float mu = dot(rd, sun);

  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(clamp(rd.y, 0.0, 1.0), 0.6));
  sky += uSunColor * (pow(max(mu, 0.0), 600.0) * 2.0 + pow(max(mu, 0.0), 12.0) * 0.25);
  if (rd.y < 0.0) sky = mix(uSkyHorizon, uShadowColor, clamp(-rd.y * 4.0, 0.0, 0.6));

  vec3 col = vec3(0.0);
  float trans = 1.0;
  if (rd.y > 0.02) {
    float t0 = BOTTOM / rd.y;
    float t1 = min(TOP / rd.y, t0 + 14.0);
    float dt = (t1 - t0) / 40.0;
    float t = t0 + dt * fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453);
    // Henyey-Greenstein: a forward lobe for the silver lining plus a soft back lobe.
    float g = 0.65;
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / 12.566;
    float phase = mix(0.08, hg * 4.0, 0.7);
    for (int i = 0; i < 40; i++) {
      if (trans < 0.02 || t > 60.0) break;
      vec3 pos = rd * t;
      int oct = t < 18.0 ? 5 : 3;
      float d = cloudDensity(pos, oct);
      if (d > 0.01) {
        // Light march toward the sun for self-shadowing.
        float shade = 0.0;
        for (int j = 1; j <= 4; j++) shade += cloudDensity(pos + sun * 0.22 * float(j), 3);
        float light = exp(-shade * 1.4);
        float powder = 1.0 - exp(-d * 4.0);
        vec3 lit = mix(uShadowColor, uCloudColor, light) + uSunColor * light * powder * phase * 2.5;
        float a = 1.0 - exp(-d * dt * 2.2);
        col += trans * a * lit;
        trans *= 1.0 - a;
      }
      t += dt;
    }
    // Far clouds fade into the horizon haze.
    float haze = exp(-max(t0 - 4.0, 0.0) * 0.06);
    col = mix(sky * (1.0 - trans), col, haze);
  }
  fragColor = vec4(sky * trans + col, 1.0);
}`,
  ),
  presets: [
    { name: "Midday", values: { uSunHeight: 1.2, uCoverage: 0.45, uDensity: 0.9 } },
    {
      name: "Sunset",
      values: {
        uSkyTop: [0.24, 0.27, 0.52],
        uSkyHorizon: [1, 0.62, 0.38],
        uCloudColor: [1, 0.78, 0.6],
        uShadowColor: [0.36, 0.25, 0.38],
        uSunColor: [1, 0.55, 0.25],
        uSunAzimuth: 0,
        uSunHeight: 0.08,
        uCoverage: 0.5,
      },
    },
    {
      name: "Storm",
      values: {
        uSkyTop: [0.22, 0.25, 0.3],
        uSkyHorizon: [0.45, 0.48, 0.52],
        uCloudColor: [0.62, 0.65, 0.7],
        uShadowColor: [0.12, 0.13, 0.17],
        uSunColor: [0.75, 0.8, 0.9],
        uCoverage: 0.85,
        uDensity: 2.2,
        uSpeed: 1.8,
      },
    },
  ],
};

export const fogBanks: ShaderEffect = {
  kind: "shader",
  id: "fog-banks",
  name: "Fog banks",
  description: "Horizontal banks of fog drifting at different depths and speeds, thickest near the ground, to lay over any scene.",
  category: "atmosphere",
  tags: ["atmosphere", "fog", "overlay", "moody", "weather"],
  transparent: true,
  source: glsl(
    `// Fog banks: layered bands of fbm fog sliding sideways, near ones lower, faster and denser.
uniform vec3 uColor;      // @control color default=#DCE3EA label="Colour"
uniform float uDensity;   // @control min=0 max=1.5 default=0.8 label="Density"
uniform float uHeight;    // @control min=0.1 max=1 default=0.55 label="Height"
uniform float uSpeed;     // @control min=0 max=3 default=1 label="Speed"
uniform int uLayers;      // @control min=1 max=6 default=4 label="Layers"`,
    HASH,
    NOISE,
    FBM,
    OVER,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y;
  float y = fragCoord.y / iResolution.y;
  vec4 acc = vec4(0.0);
  // Far layers first (high on screen, slow, thin), near layers painted over them.
  for (int i = 0; i < 6; i++) {
    if (i >= uLayers) break;
    float fi = float(i);
    float near = (fi + 1.0) / float(uLayers);
    float centre = uHeight * mix(0.85, 0.12, near);
    float thick = uHeight * mix(0.12, 0.3, near);
    float band = exp(-pow((y - centre) / thick, 2.0));
    band = max(band, step(y, centre) * mix(0.3, 1.0, near));
    float scale = mix(1.2, 2.6, near);
    vec2 q = vec2(p.x * scale + iTime * uSpeed * mix(0.015, 0.08, near) + fi * 7.3, p.y * scale * 3.0 + fi * 2.1);
    float n = fbm(q + 0.6 * vec2(fbm(q * 0.7 - iTime * 0.02, 3), 0.0), 5);
    float a = smoothstep(0.3, 0.8, n) * band * uDensity * mix(0.35, 0.8, near);
    // Ground haze: everything thickens toward the bottom.
    a = clamp(a + (1.0 - smoothstep(0.0, uHeight * 0.4, y)) * 0.12 * uDensity * near, 0.0, 1.0);
    vec3 c = uColor * mix(0.85, 1.0, n);
    acc = over(acc, c, a);
  }
  fragColor = unpremultiply(acc);
}`,
  ),
  presets: [
    { name: "Valley morning", values: { uColor: [0.96, 0.93, 0.88], uDensity: 0.7, uHeight: 0.45, uSpeed: 0.6 } },
    { name: "Moor", values: { uColor: [0.66, 0.72, 0.75], uDensity: 1.2, uHeight: 0.8, uSpeed: 1.4, uLayers: 6 } },
  ],
};

export const risingSteam: ShaderEffect = {
  kind: "shader",
  id: "rising-steam",
  name: "Rising steam",
  description: "Wisps of steam curling up from a cup or vent, thinning and fading as they rise.",
  category: "atmosphere",
  tags: ["atmosphere", "steam", "overlay", "coffee", "warm"],
  transparent: true,
  source: glsl(
    `// Rising steam: stretched noise wisps advected upward from a source, swaying and dissolving.
uniform vec2 uSource;      // @control min=-1 max=1 default=0,-0.6 label="Source"
uniform vec3 uColor;       // @control color default=#FFFFFF label="Colour"
uniform float uWidth;      // @control min=0.02 max=0.6 default=0.12 label="Width"
uniform float uHeight;     // @control min=0.2 max=1.5 default=0.8 label="Height"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uTurbulence; // @control min=0 max=2 default=0.8 label="Curl"
uniform float uOpacity;    // @control min=0 max=1 default=0.7 label="Opacity"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 src = uSource * vec2(aspect, 1.0) * 0.5;
  vec2 q = p - src;
  float h = q.y / uHeight;
  if (h < -0.05 || h > 1.2) { fragColor = vec4(uColor, 0.0); return; }
  float hc = clamp(h, 0.0, 1.0);
  float t = iTime * uSpeed;
  // The plume widens and sways more as it rises.
  float w = uWidth * (0.6 + 1.6 * hc);
  float sway = (sin(q.y * 5.0 - t * 1.1) * 0.5 + sin(q.y * 9.0 - t * 1.7 + 1.3) * 0.3) * uTurbulence * 0.06 * hc;
  vec2 flow = vec2(q.x, q.y - t * 0.25);
  vec2 warp = vec2(fbm(flow * 3.0 + vec2(0.0, -t * 0.2), 4), fbm(flow * 3.0 + vec2(5.2, 1.3), 4)) - 0.5;
  float x = (q.x - sway + warp.x * uTurbulence * 0.25 * hc) / w;
  // Wisps: noise stretched along the rise, so it reads as strands.
  vec2 sq = vec2(x * 2.2, (q.y - t * 0.3) / uHeight * 1.6) + warp * uTurbulence * 1.5;
  float strands = fbm(sq * vec2(1.0, 0.45), 5);
  float body = exp(-x * x * 1.6);
  float wisp = smoothstep(0.42, 0.75, strands + 0.25 * body);
  float a = wisp * body;
  // Born at the source, thinning and fading as it rises.
  a *= smoothstep(-0.05, 0.12, h) * (1.0 - smoothstep(0.35, 1.05, h));
  a *= mix(1.0, 0.55, hc);
  fragColor = vec4(uColor, clamp(a * uOpacity * 1.4, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Coffee cup", values: { uSource: [0, -0.5], uWidth: 0.08, uHeight: 0.6, uSpeed: 0.7, uTurbulence: 1, uOpacity: 0.55 } },
    { name: "Vent", values: { uSource: [0, -1], uWidth: 0.3, uHeight: 1.3, uSpeed: 1.4, uTurbulence: 0.6, uOpacity: 0.8 } },
    { name: "Kettle burst", values: { uSource: [-0.4, -0.3], uWidth: 0.05, uHeight: 1.1, uSpeed: 2.6, uTurbulence: 1.8, uOpacity: 0.95 } },
  ],
};

export const mistOverImage: ShaderEffect = {
  kind: "shader",
  id: "mist-over-image",
  name: "Mist over image",
  description: "Slow mist drifting over a picture, thickest low down and in the distance, with light softly scattering through it.",
  category: "atmosphere",
  video: "filter",
  tags: ["atmosphere", "mist", "image", "fog", "moody", "photo"],
  source: glsl(
    `// Mist over image: drifting fbm haze over a picture, weighted to the ground and the horizon, with a soft bloom.
uniform sampler2D uImage;   // @control filter=linear wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uMistColor;    // @control color default=#E4EAF0 label="Mist colour"
uniform float uDensity;     // @control min=0 max=1 default=0.6 label="Density"
uniform float uHorizon;     // @control min=0 max=1 default=0.4 label="Horizon"
uniform float uGround;      // @control min=0 max=1 default=0.6 label="Ground mist"
uniform float uScatter;     // @control min=0 max=1.5 default=0.6 label="Light scatter"
uniform float uSpeed;       // @control min=0 max=3 default=1 label="Drift speed"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;

  // Depth proxy: hazier toward the horizon (far away) and right at the bottom (ground mist).
  float far = exp(-pow((uv.y - uHorizon) / 0.18, 2.0));
  float ground = (1.0 - smoothstep(0.0, 0.45, uv.y)) * uGround;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float n1 = fbm(vec2(q.x * 2.0 - t * 0.04, q.y * 6.0) + 3.0, 5);
  float n2 = fbm(vec2(q.x * 3.5 + t * 0.025, q.y * 9.0 - t * 0.01) + 11.0, 4);
  float drift = smoothstep(0.25, 0.8, 0.6 * n1 + 0.4 * n2);
  float mist = clamp((far * 0.7 + ground) * mix(0.45, 1.25, drift) + 0.12, 0.0, 1.0) * uDensity;

  // Soft scattering: bright parts of the picture bleed into the mist around them.
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.4;
    vec2 o = vec2(cos(a), sin(a) * aspect) * 0.035;
    vec3 s = picture(uImage, uv + o);
    vec3 s2 = picture(uImage, uv + o * 2.4);
    glow += max(s - 0.55, 0.0) + max(s2 - 0.55, 0.0) * 0.6;
  }
  glow /= 8.0;
  vec3 haze = uMistColor + glow * uScatter * 1.6;
  // Mist lifts the blacks and washes out the colour behind it.
  vec3 col = mix(pic.rgb, haze, mist);
  col += glow * uScatter * 0.5 * (1.0 - mist);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Dawn", values: { uMistColor: [1, 0.9, 0.8], uDensity: 0.7, uScatter: 1.1, uGround: 0.7 } },
    { name: "Cold valley", values: { uMistColor: [0.78, 0.84, 0.9], uDensity: 0.85, uHorizon: 0.5, uScatter: 0.3, uSpeed: 0.6 } },
  ],
};

export const skyTimelapse: ShaderEffect = {
  kind: "shader",
  id: "sky-timelapse",
  name: "Sky timelapse",
  description: "A timelapse sky: layers of clouds racing over at different speeds as the light turns from day to golden hour and back.",
  category: "atmosphere",
  tags: ["atmosphere", "clouds", "sky", "background", "timelapse"],
  source: glsl(
    `// Sky timelapse: parallax cloud layers on perspective planes, under a sky cycling through the day.
uniform vec3 uDayTop;       // @control color default=#2F6FD0 label="Day sky (top)"
uniform vec3 uDayHorizon;   // @control color default=#A9D3F5 label="Day sky (horizon)"
uniform vec3 uGoldTop;      // @control color default=#3E3A7A label="Golden sky (top)"
uniform vec3 uGoldHorizon;  // @control color default=#FFA45C label="Golden sky (horizon)"
uniform float uSpeed;       // @control min=0 max=4 default=1.5 label="Cloud speed"
uniform float uCycle;       // @control min=0 max=1 default=0.08 label="Day cycle speed"
uniform float uCoverage;    // @control min=0 max=1 default=0.5 label="Coverage"
uniform int uLayers;        // @control min=1 max=4 default=3 label="Layers"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float x = (fragCoord.x - 0.5 * iResolution.x) / iResolution.y;
  float y = uv.y;
  // 0 at midday, 1 at golden hour.
  float gold = 0.5 - 0.5 * cos(iTime * uCycle * 6.28318);
  vec3 top = mix(uDayTop, uGoldTop, gold);
  vec3 horizon = mix(uDayHorizon, uGoldHorizon, gold);
  vec3 sky = mix(horizon, top, pow(y, 0.7));
  vec2 sunPos = vec2(0.35, mix(0.85, 0.08, gold));
  float sd = length(vec2(x, y) - sunPos);
  vec3 sunCol = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.6, 0.3), gold);
  sky += sunCol * (smoothstep(0.045, 0.04, sd) + exp(-sd * 6.0) * 0.35);

  vec3 litDay = vec3(1.0);
  vec3 litGold = vec3(1.0, 0.72, 0.5);
  vec3 shadowDay = vec3(0.6, 0.66, 0.76);
  vec3 shadowGold = vec3(0.42, 0.3, 0.42);
  vec3 col = sky;
  // Layer 0 is the highest: farthest, smallest-looking and slowest across the screen.
  for (int i = 0; i < 4; i++) {
    if (i >= uLayers) break;
    float fi = float(i);
    float alt = mix(2.4, 0.7, fi / 3.0);
    float z = alt / (y + 0.12);
    vec2 plane = vec2(x * z, z);
    plane += vec2(iTime * uSpeed * 0.35, iTime * uSpeed * 0.12) + fi * 13.1;
    float scale = mix(0.9, 0.5, fi / 3.0);
    vec2 cq = plane * scale;
    int oct = z > 8.0 ? 3 : 5;
    float n = fbm(cq, oct);
    float cover = mix(0.75, 0.35, uCoverage);
    float a = smoothstep(cover, cover + 0.22, n);
    // Toward the sun: a lighter side; a sample offset sunward darkens bellies.
    float n2 = fbm(cq + vec2(0.08, 0.12), oct);
    float shade = clamp(0.5 + (n - n2) * 6.0, 0.0, 1.0);
    vec3 lit = mix(litDay, litGold, gold);
    vec3 shadow = mix(shadowDay, shadowGold, gold) * mix(1.0, 0.8, fi / 3.0);
    vec3 cc = mix(shadow, lit, shade);
    cc += sunCol * exp(-sd * 3.0) * 0.4 * (1.0 - a);
    // Clouds dissolve into the horizon haze.
    a *= smoothstep(0.0, 0.25, y);
    col = mix(col, mix(cc, horizon, exp(-y * 8.0) * 0.6), a);
  }
  fragColor = vec4(col, 1.0);
}`,
  ),
  presets: [
    { name: "Fair weather", values: { uSpeed: 1.2, uCoverage: 0.35, uCycle: 0.05 } },
    { name: "Racing clouds", values: { uSpeed: 3.5, uCoverage: 0.65, uCycle: 0.15, uLayers: 4 } },
  ],
};

export const smokeCurl: ShaderEffect = {
  kind: "shader",
  id: "smoke-curl",
  name: "Smoke curl",
  description: "A thin thread of incense or cigarette smoke rising smooth and straight, then breaking into curls and turbulence.",
  category: "atmosphere",
  tags: ["atmosphere", "smoke", "incense", "overlay", "elegant", "moody"],
  transparent: true,
  source: glsl(
    `// Smoke curl: a laminar filament whose path and strands are warped more the higher it rises.
uniform vec2 uSource;      // @control min=-1 max=1 default=0,-0.85 label="Source"
uniform vec3 uColor;       // @control color default=#D9DEE6 label="Colour"
uniform float uHeight;     // @control min=0.3 max=1.6 default=1.1 label="Height"
uniform float uBreakup;    // @control min=0 max=1 default=0.35 label="Breakup height"
uniform float uTurbulence; // @control min=0 max=2 default=1 label="Turbulence"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Speed"
uniform float uThickness;  // @control min=0.3 max=3 default=1 label="Thickness"
uniform float uOpacity;    // @control min=0 max=1 default=0.85 label="Opacity"`,
    HASH,
    NOISE,
    FBM,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 src = uSource * vec2(aspect, 1.0) * 0.5;
  vec2 q = p - src;
  float h = q.y / uHeight;
  if (h < -0.02 || h > 1.15) { fragColor = vec4(uColor, 0.0); return; }
  float hc = clamp(h, 0.0, 1.0);
  float t = iTime * uSpeed;
  // 0 while the stream is laminar, rising to 1 where it has broken up.
  float turb = smoothstep(uBreakup - 0.05, uBreakup + 0.45, hc) * uTurbulence;

  // Advected warp: noise carried up with the smoke, swirling the filament into curls.
  vec2 fq = vec2(q.x * 4.0, q.y * 3.0 - t * 0.6);
  vec2 warp = vec2(fbm(fq, 4), fbm(fq + vec2(4.7, 1.9), 4)) - 0.5;
  vec2 warp2 = vec2(fbm(fq * 2.3 + warp * 2.0, 3), fbm(fq * 2.3 + vec2(2.1, 8.4) - warp * 2.0, 3)) - 0.5;
  vec2 w = q + (warp * 0.18 + warp2 * 0.08) * turb * (0.4 + hc);

  // The base path: a gentle sway low down, more after the breakup.
  float sway = 0.012 * sin(q.y * 7.0 - t * 1.2) * hc + turb * 0.05 * sin(q.y * 4.0 - t * 0.9 + 1.7);
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    // The strands start as one and peel apart above the breakup.
    float split = (fi - 1.0) * turb * 0.035 * hc * (1.0 + sin(w.y * 6.0 + fi * 2.3 - t * 0.7));
    float d = abs(w.x - sway - split);
    float width = (mix(0.0015, 0.016, hc) + turb * 0.008 * hc) * uThickness + px * 0.75;
    float strand = exp(-d * d / (width * width));
    a += strand * (fi == 1.0 ? 1.0 : turb * 0.6);
  }
  // A faint diffuse veil around the curls, and dissolving gaps higher up.
  float veil = smoothstep(0.45, 0.8, fbm(w * 6.0 + vec2(0.0, -t * 0.4), 4)) * turb * 0.25 * hc;
  a = a * mix(1.0, 0.5, hc) + veil;
  float gaps = mix(1.0, smoothstep(0.25, 0.6, fbm(w * 3.0 + vec2(1.3, -t * 0.5), 3)), hc * min(turb, 1.0));
  a *= gaps;
  a *= smoothstep(-0.02, 0.01, h) * (1.0 - smoothstep(0.6, 1.1, h));
  fragColor = vec4(uColor, clamp(a * uOpacity, 0.0, 1.0));
}`,
  ),
  presets: [
    { name: "Incense", values: { uColor: [0.86, 0.88, 0.92], uBreakup: 0.45, uTurbulence: 0.8, uSpeed: 0.7, uThickness: 0.8 } },
    { name: "Draughty room", values: { uBreakup: 0.15, uTurbulence: 1.8, uSpeed: 1.4, uThickness: 1.3 } },
  ],
};

export const dryIceFog: ShaderEffect = {
  kind: "shader",
  id: "dry-ice-fog",
  name: "Dry ice fog",
  description: "Dense, low stage fog rolling along the floor and spilling over the edge in a slow, tumbling curtain.",
  category: "atmosphere",
  tags: ["atmosphere", "fog", "overlay", "stage", "spooky", "concert"],
  transparent: true,
  source: glsl(
    `// Dry ice fog: rolling fbm fog hugging a floor, pouring over its edge and pooling below.
uniform vec3 uColor;       // @control color default=#EEF2F7 label="Colour"
uniform float uFloor;      // @control min=0 max=0.8 default=0.38 label="Floor height"
uniform float uEdge;       // @control min=0 max=1.2 default=0.68 label="Edge position"
uniform float uDepth;      // @control min=0.03 max=0.5 default=0.14 label="Fog depth"
uniform float uDensity;    // @control min=0 max=1.5 default=1 label="Density"
uniform float uSpeed;      // @control min=0 max=3 default=1 label="Flow speed"
uniform float uTurbulence; // @control min=0 max=2 default=1 label="Turbulence"`,
    HASH,
    NOISE,
    FBM,
    `float rolling(vec2 q, float t) {
  vec2 warp = vec2(fbm(q * 0.8 + vec2(-t * 0.3, t * 0.1), 4), fbm(q * 0.8 + vec2(3.1, -t * 0.2), 4)) - 0.5;
  return fbm(q + warp * 2.2 * uTurbulence, 5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float x = uv.x;
  float y = uv.y;
  float t = iTime * uSpeed;
  float a = 0.0;

  // On the stage: a dense layer above the floor, billowing higher in places, soft at the top.
  float stage = 1.0 - smoothstep(uEdge - 0.04, uEdge + 0.01, x);
  float n = 0.5;
  if (stage > 0.0) {
    float hy = (y - uFloor) / uDepth;
    n = rolling(vec2(x * aspect * 3.0 - t * 0.35, max(hy, 0.0) * 0.9 + t * 0.05), t);
    float d = n * 1.5 + 0.15 - max(hy, 0.0) * 0.8 - max(-hy, 0.0) * 2.5;
    a = max(a, smoothstep(0.0, 0.7, d) * stage);
  }
  // Over the edge: a curtain falling in an arc, widening as it drops, pooling on the ground.
  if (x > uEdge - 0.04) {
    float dx = max(x - uEdge, 0.0) * aspect;
    float fall = uFloor - dx * dx * 6.0 - dx * 0.4;
    float spread = uDepth * (0.5 + 2.0 * max(uFloor - fall, 0.0));
    float off = (y - fall) / spread;
    float nc = rolling(vec2(dx * 4.0 + off * 0.3, y * 3.0 + t * 0.6), t);
    float curtain = smoothstep(0.0, 0.7, nc * 1.5 + 0.1 - abs(off) * 0.9) * smoothstep(uEdge - 0.04, uEdge, x);
    curtain *= 1.0 - smoothstep(uDepth * 0.5, uDepth * 1.5, y - uFloor);
    float np = rolling(vec2(x * aspect * 3.0 - t * 0.2, y / uDepth * 0.8), t);
    float pool = smoothstep(0.0, 0.7, np * 1.5 + 0.1 - y / (uDepth * 0.8) * 0.8) * smoothstep(uEdge, uEdge + 0.1, x);
    float spill = max(curtain, pool * 0.85);
    if (spill > a) n = mix(n, x > uEdge + 0.05 ? max(nc, np) : nc, 0.5);
    a = max(a, spill);
  }
  a = clamp(a * uDensity, 0.0, 1.0);
  // Denser billows catch more light; thin edges fall slightly into shadow.
  vec3 c = uColor * mix(0.8, 1.05, smoothstep(0.3, 0.75, n));
  fragColor = vec4(c, a);
}`,
  ),
  presets: [
    { name: "Concert stage", values: { uFloor: 0.25, uEdge: 1.2, uDepth: 0.2, uDensity: 1.2, uSpeed: 0.8 } },
    { name: "Haunted ledge", values: { uColor: [0.72, 0.9, 0.82], uFloor: 0.5, uEdge: 0.55, uDepth: 0.1, uTurbulence: 1.6 } },
  ],
};

/** Atmosphere: clouds, fog, steam, mist and drifting wisps. */
export const atmosphereShaders: ShaderEffect[] = [
  volumetricClouds,
  fogBanks,
  risingSteam,
  mistOverImage,
  skyTimelapse,
  smokeCurl,
  dryIceFog,
];
