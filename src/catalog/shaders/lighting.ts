import { FBM, glsl, HASH, NOISE, ROTATE } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Lighting: light falling on a picture rather than light as a background.
 * Most read the picture's brightness as a height map and shade the surface
 * normals it gives (see RELIEF), so surfaces facing a light brighten and
 * those turned away fall into shade. The pictures are `filter=mipmap`, so
 * broad forms can be read from coarse mip levels in a few taps.
 */

/**
 * `surfaceNormal(uv, strength)`: a surface normal for the picture `uImage` at
 * uv, its brightness read as height. A Sobel of fine detail is added to
 * central differences at two broader scales (a fixed share of the picture's
 * height, read at a matching mip level), so flat shapes round off toward
 * their edges as well as catching detail. `shade(n, l, shininess)` gives the
 * Lambert diffuse (x) and a soft Blinn specular (y) for a light from unit
 * direction `l` (z toward the viewer). Needs {@link PICTURE} for its test card.
 */
const RELIEF = `
float heightAt(vec2 uv, float lod) {
  vec3 c = textureSize(uImage, 0).x > 1 ? textureLod(uImage, uv, lod).rgb : testCard(fract(uv));
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// The height's slope at uv, in height per sample step.
vec2 heightSlope(vec2 uv) {
  ivec2 size = textureSize(uImage, 0);
  vec2 texel = size.x > 1 ? 1.0 / vec2(size) : 1.0 / iResolution.xy;
  float texH = size.x > 1 ? float(size.y) : iResolution.y;
  vec2 d = texel * 1.5;
  float tl = heightAt(uv + vec2(-d.x, d.y), 0.0);
  float tc = heightAt(uv + vec2(0.0, d.y), 0.0);
  float tr = heightAt(uv + d, 0.0);
  float ml = heightAt(uv - vec2(d.x, 0.0), 0.0);
  float mr = heightAt(uv + vec2(d.x, 0.0), 0.0);
  float bl = heightAt(uv - d, 0.0);
  float bc = heightAt(uv - vec2(0.0, d.y), 0.0);
  float br = heightAt(uv + vec2(d.x, -d.y), 0.0);
  vec2 fine = vec2(tr + 2.0 * mr + br - tl - 2.0 * ml - bl, tl + 2.0 * tc + tr - bl - 2.0 * bc - br) * 0.125;
  // Broader forms: 2% and 8% of the picture's height apart, each read as blurred as its taps are apart.
  float s1 = 0.02 * texH;
  vec2 d1 = texel * s1;
  float l1 = log2(max(s1, 1.0));
  vec2 mid = vec2(heightAt(uv + vec2(d1.x, 0.0), l1) - heightAt(uv - vec2(d1.x, 0.0), l1),
                  heightAt(uv + vec2(0.0, d1.y), l1) - heightAt(uv - vec2(0.0, d1.y), l1)) * 0.5;
  float s2 = 0.08 * texH;
  vec2 d2 = texel * s2;
  float l2 = log2(max(s2, 1.0));
  vec2 broad = vec2(heightAt(uv + vec2(d2.x, 0.0), l2) - heightAt(uv - vec2(d2.x, 0.0), l2),
                    heightAt(uv + vec2(0.0, d2.y), l2) - heightAt(uv - vec2(0.0, d2.y), l2)) * 0.5;
  return fine * 0.5 + mid * 0.6 + broad * 0.6;
}

vec3 surfaceNormal(vec2 uv, float strength) {
  return normalize(vec3(-heightSlope(uv) * strength, 1.0));
}

vec2 shade(vec3 n, vec3 l, float shininess) {
  float diff = max(dot(n, l), 0.0);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), shininess) * step(0.0, diff - 1e-3);
  return vec2(diff, spec);
}

// Light above 1 rolls off instead of clipping.
vec3 rolloff(vec3 c) {
  return c / (1.0 + max(c - 1.0, 0.0));
}`.trim();

export const relight: ShaderEffect = {
  kind: "shader",
  id: "relight",
  name: "Relight",
  description: "A picture relit by a directional light you can swing round and raise, its surfaces read from brightness so they catch the light or fall into shade.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "relight", "image", "normal-map", "directional", "shading", "filter"],
  source: glsl(
    `// Relight: normals from a Sobel height map of the picture's brightness, shaded by one directional light.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uAzimuth;       // @control min=0 max=360 default=150 label="Light from (°)"
uniform float uElevation;     // @control min=5 max=90 default=35 label="Light height (°)"
uniform vec3 uLight;          // @control color default=#FFE6C4 label="Light colour"
uniform float uIntensity;     // @control min=0 max=3 default=1.4 label="Intensity"
uniform vec3 uAmbientColor;   // @control color default=#8EA2C8 label="Ambient colour"
uniform float uAmbient;       // @control min=0 max=1 default=0.4 label="Ambient"
uniform float uStrength;      // @control min=0 max=10 default=4 label="Relief"
uniform float uSpecular;      // @control min=0 max=1 default=0.25 label="Specular"
uniform float uFalloff;       // @control min=0 max=1 default=0.3 label="Falloff across the frame"
${BACKDROP_CONTROLS}`,
    PICTURE,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float az = radians(uAzimuth);
  float el = radians(uElevation);
  vec3 l = vec3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
  vec3 n = surfaceNormal(uv, uStrength);
  vec2 s = shade(n, l, 36.0);
  // The side of the frame nearer the light is a little brighter, more so the lower it is.
  float wash = max(1.0 + uFalloff * dot(p, l.xy) * 1.6 * (1.0 - 0.6 * l.z), 0.0);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 lit = uAmbientColor * uAmbient + uLight * uIntensity * s.x * wash;
  vec3 col = pic.rgb * lit + uLight * s.y * uSpecular * wash;
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Morning side light", values: { uAzimuth: 175, uElevation: 16, uLight: [1, 0.78, 0.52], uIntensity: 1.8, uAmbientColor: [0.5, 0.62, 0.9], uAmbient: 0.35, uFalloff: 0.6 } },
    { name: "Top light", values: { uAzimuth: 90, uElevation: 72, uLight: [1, 0.98, 0.94], uIntensity: 1.2, uAmbient: 0.25, uFalloff: 0.5, uSpecular: 0.35 } },
    { name: "Dramatic", values: { uAzimuth: 20, uElevation: 10, uLight: [1, 0.9, 0.8], uIntensity: 2.6, uAmbient: 0.05, uStrength: 7, uSpecular: 0.5, uFalloff: 0.8 } },
  ],
};

export const pointLight: ShaderEffect = {
  kind: "shader",
  id: "point-light",
  name: "Point light",
  description: "A torch moving over a darkened picture, following the pointer while it hovers and drifting on its own otherwise, lighting the surfaces that face it.",
  category: "lighting",
  video: "interactive",
  tags: ["lighting", "torch", "flashlight", "image", "interactive", "hover", "normal-map", "dark"],
  source: glsl(
    `// Point light: a light just above the picture, at the pointer while hovered and drifting otherwise, shading normals from brightness.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uColor;          // @control color default=#FFDDA8 label="Light colour"
uniform float uIntensity;     // @control min=0 max=4 default=1.8 label="Intensity"
uniform float uRadius;        // @control min=0.05 max=1.5 default=0.45 label="Falloff radius"
uniform float uHeight;        // @control min=0.02 max=0.5 default=0.1 label="Light height"
uniform float uAmbient;       // @control min=0 max=0.5 default=0.04 label="Ambient"
uniform float uStrength;      // @control min=0 max=10 default=4 label="Relief"
uniform float uSpecular;      // @control min=0 max=1 default=0.4 label="Specular"
uniform float uSpeed;         // @control min=0 max=2 default=0.6 label="Drift speed"
${BACKDROP_CONTROLS}`,
    PICTURE,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // Where the light is: the pointer while it hovers, else a slow wander.
  float t = iTime * uSpeed;
  vec2 drift = iResolution.xy * (0.5 + vec2(0.32 * sin(t * 0.63), 0.26 * sin(t * 0.91 + 1.3)));
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 at = (mix(drift, iPointer.xy, hover) - 0.5 * iResolution.xy) / iResolution.y;
  vec3 toLight = vec3(at - p, uHeight);
  float dist = length(toLight);
  vec3 l = toLight / dist;
  // Inverse-square near the light, faded to nothing past the radius.
  float k = dist / (0.35 * uRadius);
  float att = 1.0 / (1.0 + k * k) * (1.0 - smoothstep(0.4 * uRadius, 1.5 * uRadius, dist));
  vec3 n = surfaceNormal(uv, uStrength);
  vec2 s = shade(n, l, 28.0);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 light = uColor * uIntensity * att;
  vec3 col = pic.rgb * (vec3(uAmbient) * vec3(0.7, 0.8, 1.0) + light * s.x) + light * s.y * uSpecular;
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Torch", values: { uColor: [1, 0.93, 0.8], uRadius: 0.35, uAmbient: 0.01, uIntensity: 2.4 } },
    { name: "Lantern", values: { uColor: [1, 0.66, 0.3], uRadius: 0.8, uHeight: 0.2, uAmbient: 0.08, uSpecular: 0.2 } },
    { name: "Inspection lamp", values: { uImage: SAMPLE_IMAGES.portrait, uColor: [0.85, 0.93, 1], uHeight: 0.04, uStrength: 8, uSpecular: 0.8, uAmbient: 0.1 } },
  ],
};

export const studioLighting: ShaderEffect = {
  kind: "shader",
  id: "studio-lighting",
  name: "Studio lighting",
  description: "Three-point lighting on a subject: a warm key from one side, a cool fill from the other and a bright rim tracing its silhouette, against a darkened studio backdrop.",
  category: "lighting",
  // Each frame is lit on its own, so it works live on a subject shot against a plain backdrop (or with alpha).
  video: "filter",
  tags: ["lighting", "studio", "portrait", "three-point", "key-light", "rim", "image", "filter"],
  source: glsl(
    `// Studio lighting: key and fill shade normals from brightness; a rim lights the subject's edge (alpha, or the corner colour keyed out) on the side away from the key.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Subject"
uniform float uKeyAngle;      // @control min=0 max=360 default=155 label="Key from (°)"
uniform vec3 uKeyColor;       // @control color default=#FFD2A0 label="Key colour"
uniform float uKey;           // @control min=0 max=3 default=1.4 label="Key strength"
uniform vec3 uFillColor;      // @control color default=#86A8FF label="Fill colour"
uniform float uFill;          // @control min=0 max=2 default=0.5 label="Fill strength"
uniform vec3 uRimColor;       // @control color default=#EAF2FF label="Rim colour"
uniform float uRim;           // @control min=0 max=4 default=1.8 label="Rim strength"
uniform float uRimWidth;      // @control min=0.003 max=0.06 default=0.016 label="Rim width"
uniform float uStrength;      // @control min=0 max=10 default=4 label="Relief"
uniform float uKeyOut;        // @control min=0 max=0.5 default=0.12 label="Key out the corner colour (0 off)"
uniform vec3 uStudio;         // @control color default=#1B1D24 label="Studio backdrop"
uniform float uStudioMix;     // @control min=0 max=1 default=0.85 label="Replace the background"
${BACKDROP_CONTROLS}`,
    PICTURE,
    RELIEF,
    `vec3 gKey;
bool gKeyOn;

// How much of the subject there is at uv (alpha, less the backdrop colour when keyed), read at mip level lod.
float subjectAt(vec2 uv, float lod) {
  if (textureSize(uImage, 0).x <= 1) return 1.0;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec4 c = textureLod(uImage, uv, lod);
  float a = c.a;
  if (gKeyOn) a *= smoothstep(uKeyOut, uKeyOut + 0.12, distance(c.rgb / max(c.a, 1e-3), gKey));
  return a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec4 corner = textureLod(uImage, vec2(0.01, 0.99), 0.0);
  gKey = corner.rgb / max(corner.a, 1e-3);
  // A picture already cut out (a clear corner) keeps its alpha as the subject.
  gKeyOn = uKeyOut > 0.0 && corner.a > 0.5;
  ivec2 size = textureSize(uImage, 0);
  float texH = size.x > 1 ? float(size.y) : iResolution.y;
  vec2 aspect = vec2(size.x > 1 ? float(size.y) / float(size.x) : iResolution.y / iResolution.x, 1.0);

  float ka = radians(uKeyAngle);
  vec2 keyDir = vec2(cos(ka), sin(ka));
  vec3 key = normalize(vec3(keyDir * 0.8, 0.6));
  vec3 fill = normalize(vec3(-keyDir * 0.9, 0.45));
  // The rim comes from behind, on the side away from the key and a little above.
  vec2 rimDir = normalize(vec2(-keyDir.x, 0.5 + 0.5 * abs(keyDir.y)));

  vec3 n = surfaceNormal(uv, uStrength);
  vec2 ks = shade(n, key, 30.0);
  float fillWrap = clamp((dot(n, fill) + 0.4) / 1.4, 0.0, 1.0);

  float subject = subjectAt(uv, 0.0);
  // The rim: the subject where what lies toward the rim light is backdrop, plus a little all round its edge.
  float lod = log2(max(uRimWidth * texH * 0.6, 1.0));
  vec2 w = rimDir * uRimWidth * aspect;
  float toward = 0.5 * (subjectAt(uv + w, lod) + subjectAt(uv + w * 0.5, lod - 1.0));
  float around = 0.25 * (subjectAt(uv + vec2(uRimWidth, 0.0) * aspect, lod) + subjectAt(uv - vec2(uRimWidth, 0.0) * aspect, lod)
    + subjectAt(uv + vec2(0.0, uRimWidth), lod) + subjectAt(uv - vec2(0.0, uRimWidth), lod));
  float rim = subject * (clamp(1.0 - toward, 0.0, 1.0) + 0.3 * clamp(1.0 - around, 0.0, 1.0));
  rim = smoothstep(0.05, 0.6, rim);

  vec4 pic = pictureRGBA(uImage, uv);
  vec3 lit = vec3(0.06) + uKeyColor * uKey * ks.x + uFillColor * uFill * fillWrap;
  vec3 col = pic.rgb * lit + uKeyColor * ks.y * uKey * 0.25 + uRimColor * rim * uRim * (0.6 + 0.4 * pic.rgb);

  // The studio backdrop behind: its colour, a soft pool of key light on the key's side, darker toward the corners.
  float pool = exp(-2.5 * dot(p - keyDir * 0.35, p - keyDir * 0.35));
  vec3 studio = uStudio * (0.55 + 0.9 * pool) + uKeyColor * uStudio * pool * 0.6;
  float back = (1.0 - subject) * uStudioMix;
  col = mix(col, studio, back);
  // Where the picture is clear the backdrop's opacity holds, so a cut-out stays clear on a clear backdrop.
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Classic portrait", values: { uKeyColor: [1, 0.9, 0.78], uFillColor: [0.75, 0.82, 1], uFill: 0.6, uRim: 1.2 } },
    { name: "Noir", values: { uKeyColor: [1, 1, 1], uKey: 1.8, uFill: 0.08, uRimColor: [1, 1, 1], uRim: 2.6, uStudio: [0.04, 0.04, 0.05], uStudioMix: 1 } },
    { name: "Music video", values: { uKeyColor: [1, 0.35, 0.65], uFillColor: [0.2, 0.55, 1], uFill: 1.2, uRimColor: [0.5, 1, 0.9], uRim: 2.6, uStudio: [0.08, 0.04, 0.14] } },
  ],
};

export const timeOfDay: ShaderEffect = {
  kind: "shader",
  id: "time-of-day",
  name: "Time of day",
  description: "A picture regraded and relit through the day, from cool dawn through white noon and golden hour to blue hour and a night where its brightest spots glow like lit windows.",
  category: "lighting",
  video: "filter",
  loop: 24,
  tags: ["lighting", "time-of-day", "golden-hour", "blue-hour", "night", "sun", "grade", "image", "filter"],
  source: glsl(
    `// Time of day: a sun on a 24-hour arc shades normals from brightness, a sky colour tints and darkens the picture, and its bright spots light up at night.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uHour;          // @control min=0 max=24 default=6 label="Hour"
uniform float uSpeed;         // @control min=0 max=4 default=1 label="Hours per second (0 holds)"
uniform float uStrength;      // @control min=0 max=10 default=3 label="Relief"
uniform float uSkyTint;       // @control min=0 max=1 default=0.6 label="Sky tint"
uniform float uNightLights;   // @control min=0 max=2 default=1 label="Night lights"
uniform vec3 uLampColor;      // @control color default=#FFC46B label="Night light colour"
uniform float uThreshold;     // @control min=0 max=1 default=0.62 label="Lights from brightness above"
${BACKDROP_CONTROLS}`,
    PICTURE,
    RELIEF,
    `float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Brightness above the lights' threshold at mip level lod, so the brightest spots light up at night.
float glowAt(vec2 uv, float lod) {
  vec3 c = textureSize(uImage, 0).x > 1 ? textureLod(uImage, uv, lod).rgb : testCard(fract(uv));
  return smoothstep(uThreshold, min(uThreshold + 0.25, 1.0), luma(c));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float hour = mod(uHour + iTime * uSpeed, 24.0);
  // The sun: up at 6, highest at 12, down at 18; it crosses from the left (morning) to the right (evening).
  float arc = (hour - 6.0) / 12.0 * 3.14159;
  float e = sin(arc);
  float across = -cos(arc);
  float morning = 1.0 - smoothstep(10.0, 14.0, hour) * (1.0 - smoothstep(22.0, 24.0, hour));
  vec3 l = normalize(vec3(across, 0.25 + 0.6 * max(e, 0.0), 0.2 + 0.9 * max(e, 0.0)));

  float day = smoothstep(-0.04, 0.22, e);
  float night = 1.0 - smoothstep(-0.38, -0.12, e);
  // Sun colour: warm and low (pinker at dawn, deeper gold at dusk), near white overhead.
  vec3 low = mix(vec3(1.0, 0.5, 0.22), vec3(1.0, 0.62, 0.58), morning);
  vec3 sun = mix(low, vec3(1.0, 0.97, 0.92), smoothstep(0.12, 0.65, e));
  // Sky light: deep blue night, blue hour, a warm low-sun sky, then daylight blue.
  vec3 sky = mix(vec3(0.05, 0.07, 0.17), vec3(0.24, 0.32, 0.72), smoothstep(-0.4, -0.12, e));
  sky = mix(sky, mix(vec3(0.85, 0.55, 0.5), vec3(0.8, 0.62, 0.7), morning), smoothstep(-0.12, 0.04, e));
  sky = mix(sky, vec3(0.62, 0.74, 1.0), smoothstep(0.12, 0.55, e));

  vec4 pic = pictureRGBA(uImage, uv);
  float lum = luma(pic.rgb);
  // Night sees in blue-grey: colour drains as it darkens.
  vec3 albedo = mix(pic.rgb, vec3(lum), night * 0.55);
  vec3 n = surfaceNormal(uv, uStrength);
  vec2 s = shade(n, l, 30.0);
  vec3 col = albedo * (sky * mix(0.55, 0.45, day) + sun * day * (0.25 + 1.0 * s.x)) + sun * day * s.y * 0.15;
  // The grade: the whole picture leans toward the sky's colour.
  vec3 tint = sky / max(luma(sky), 0.05);
  col *= mix(vec3(1.0), clamp(tint, 0.0, 2.0), uSkyTint * 0.4);

  // Lights come on at dusk: the brightest spots glow, with a soft halo.
  float on = (1.0 - smoothstep(-0.22, 0.02, e)) * uNightLights;
  float lamp = glowAt(uv, 0.0);
  float halo = glowAt(uv, 3.0) * 0.6 + glowAt(uv, 5.0) * 0.5;
  col += uLampColor * on * (lamp * (0.6 + 0.6 * lum) + halo * 0.5);
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Golden hour", values: { uHour: 17.4, uSpeed: 0 } },
    { name: "Blue hour", values: { uHour: 19.3, uSpeed: 0 } },
    { name: "Night city", values: { uImage: SAMPLE_IMAGES.city, uHour: 22, uSpeed: 0, uThreshold: 0.5, uNightLights: 1.4 } },
  ],
};

export const goboProjection: ShaderEffect = {
  kind: "shader",
  id: "gobo-projection",
  name: "Gobo projection",
  description: "A theatre light throwing a patterned gobo onto a picture (window panes, foliage, stars, venetian slats or your own text), softly focused and slowly drifting.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "gobo", "projection", "stage", "theatre", "pattern", "text", "image", "filter"],
  source: glsl(
    `// Gobo projection: a soft beam broken up by a pattern (or the gobo image's alpha), drifting, multiplied into the picture.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform int uPattern;         // @control min=0 max=4 default=1 label="Gobo (0 window, 1 foliage, 2 stars, 3 slats, 4 gobo image)"
uniform sampler2D uGobo;      // @control filter=mipmap wrap=clamp default=${textImage("LIGHTS")} label="Gobo image (alpha lets light through)"
uniform vec3 uColor;          // @control color default=#FFE4BC label="Light colour"
uniform float uIntensity;     // @control min=0 max=3 default=1.1 label="Intensity"
uniform float uAmbient;       // @control min=0 max=1 default=0.3 label="Ambient"
uniform float uScale;         // @control min=0.3 max=3 default=1 label="Scale"
uniform float uAngle;         // @control min=-180 max=180 default=-12 label="Angle (°)"
uniform float uSoftness;      // @control min=0 max=1 default=0.3 label="Soft focus"
uniform float uDrift;         // @control min=0 max=2 default=0.6 label="Drift"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    NOISE,
    FBM,
    ROTATE,
    `float windowPanes(vec2 q, float s) {
  vec2 frame = abs(q) - vec2(0.42, 0.34);
  float inside = smoothstep(s, -s, max(frame.x, frame.y));
  // Three panes across, two down, between glazing bars.
  vec2 g = abs(fract((q + vec2(0.42, 0.34)) / vec2(0.28, 0.34)) - 0.5);
  float bar = 0.07 + s * 0.5;
  float pane = smoothstep(0.5 - bar - s, 0.5 - bar + s, 0.5 - max(g.x * 1.0, g.y));
  return inside * pane;
}

float foliage(vec2 q, float s, float t) {
  vec2 sway = vec2(sin(t * 0.7 + q.y * 2.0), cos(t * 0.5 + q.x * 1.7)) * 0.03 * uDrift;
  float n = fbm((q + sway) * 6.0 + 2.0, 5);
  float w = 0.02 + s * 0.1;
  return smoothstep(0.5 - w, 0.5 + w, n);
}

float stars(vec2 q, float s) {
  vec2 cell = floor(q / 0.2);
  vec2 f = fract(q / 0.2) - 0.5;
  vec2 h = hash22(cell + 3.1);
  f -= (h - 0.5) * 0.35;
  f = rot(h.x * 6.28) * f;
  float r = length(f);
  float a = atan(f.y, f.x);
  float edge = (0.16 + 0.12 * h.y) * (0.55 + 0.45 * pow(abs(cos(2.5 * a)), 3.0));
  float keep = step(0.25, hash12(cell + 7.7));
  return keep * smoothstep(edge + 0.02 + s * 0.12, edge - 0.02 - s * 0.05, r);
}

float slats(vec2 q, float s) {
  float f = fract(q.y * 8.0);
  float w = 0.04 + s * 0.25;
  float lit = smoothstep(0.0, w, f) * smoothstep(0.62 + w, 0.62, f);
  return lit * smoothstep(0.5 + s * 0.1, 0.44, abs(q.x));
}

float goboImage(vec2 q, float s) {
  ivec2 size = textureSize(uGobo, 0);
  if (size.x <= 1) return 0.0;
  float aspect = float(size.x) / float(size.y);
  float w = min(1.3, 1.3 * aspect);
  vec2 g = q / vec2(w, w / aspect) + 0.5;
  if (g.x < 0.0 || g.x > 1.0 || g.y < 0.0 || g.y > 1.0) return 0.0;
  return textureLod(uGobo, g, log2(1.0 + s * 0.03 * float(size.y))).a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime;
  vec2 shift = vec2(sin(t * 0.13), cos(t * 0.11)) * 0.05 * uDrift;
  vec2 q = rot(radians(uAngle) + sin(t * 0.09) * 0.06 * uDrift) * (p - shift) / uScale;
  float s = uSoftness * 0.06;
  float lit = uPattern == 0 ? windowPanes(q, s)
    : uPattern == 1 ? foliage(q, uSoftness, t)
    : uPattern == 2 ? stars(q, s)
    : uPattern == 3 ? slats(q, uSoftness)
    : goboImage(q, uSoftness);
  // The beam: a soft-edged spot round the gobo.
  float beam = 1.0 - smoothstep(0.45, 0.85 + 0.2 * uSoftness, length(q * vec2(0.75, 1.0)));
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 light = mix(vec3(uAmbient) * vec3(0.92, 0.95, 1.0), uColor * uIntensity, lit * beam);
  vec3 col = pic.rgb * light;
  fragColor = vec4(col / (1.0 + max(col - 1.0, 0.0)), pic.a);
}`,
  ),
  presets: [
    { name: "Window", values: { uPattern: 0, uAngle: -8, uSoftness: 0.2, uColor: [1, 0.86, 0.66] } },
    { name: "Starry stage", values: { uPattern: 2, uColor: [0.7, 0.8, 1], uAmbient: 0.15, uIntensity: 1.8, uScale: 1.2 } },
    { name: "Marquee text", values: { uPattern: 4, uGobo: textImage("OPEN"), uAmbient: 0.2, uIntensity: 1.8, uSoftness: 0.15, uAngle: 0 } },
  ],
};

export const neonSpill: ShaderEffect = {
  kind: "shader",
  id: "neon-spill",
  name: "Neon spill",
  description: "Coloured light spilling onto a picture from a flickering two-colour neon tube, lighting the surfaces that face it and falling off with distance.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "neon", "cyberpunk", "night", "colour", "flicker", "image", "normal-map", "filter"],
  source: glsl(
    `// Neon spill: five point lights along a tube, one colour each half, inverse-square falloff, shading normals from brightness; the tube drawn on top.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uSource;         // @control min=-1 max=1 default=-0.7,0.1 label="Neon position"
uniform float uTubeAngle;     // @control min=-90 max=90 default=80 label="Tube angle (°)"
uniform float uLength;        // @control min=0 max=1 default=0.5 label="Tube length"
uniform vec3 uColorA;         // @control color default=#FF2E9A label="Colour A"
uniform vec3 uColorB;         // @control color default=#3EE4FF label="Colour B"
uniform float uIntensity;     // @control min=0 max=4 default=2.2 label="Power"
uniform float uFlicker;       // @control min=0 max=1 default=0.35 label="Flicker"
uniform float uAmbient;       // @control min=0 max=1 default=0.18 label="Ambient"
uniform float uStrength;      // @control min=0 max=10 default=4 label="Relief"
uniform bool uShowTube;       // @control default=true label="Show the tube"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 c = uSource * vec2(aspect, 1.0) * 0.5;
  float ta = radians(uTubeAngle);
  vec2 dir = vec2(cos(ta), sin(ta)) * uLength * 0.5;
  // Flicker: a fast buzz, and now and then a stutter.
  float t = iTime;
  float buzz = 0.08 * hash12(vec2(floor(t * 40.0), 1.0));
  float stutter = step(0.88, hash12(vec2(floor(t * 5.0), 2.0))) * step(0.5, hash12(vec2(floor(t * 30.0), 3.0)));
  float on = 1.0 - uFlicker * (buzz + 0.75 * stutter);

  vec3 n = surfaceNormal(uv, uStrength);
  vec3 light = vec3(0.0);
  // The tube as five point lights a little off the wall, each falling off with the square of distance.
  for (int i = 0; i < 5; i++) {
    float k = float(i) * 0.25;
    vec2 at = c + dir * (k * 2.0 - 1.0);
    vec3 toLight = vec3(at - p, 0.2);
    float d2 = dot(toLight, toLight);
    float diff = max(dot(n, toLight * inversesqrt(d2)), 0.0);
    light += mix(uColorA, uColorB, smoothstep(0.3, 0.7, k)) * diff * 0.022 / (d2 + 0.04);
  }
  light *= uIntensity * on;
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 col = pic.rgb * (vec3(uAmbient) * vec3(0.55, 0.6, 0.8) + light);

  if (uShowTube) {
    vec2 a = c - dir;
    vec2 ab = 2.0 * dir;
    float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(p - a - ab * h);
    vec3 tint = mix(uColorA, uColorB, smoothstep(0.45, 0.55, h));
    float core = smoothstep(0.009, 0.004, d);
    float halo = exp(-d * 40.0) * 0.8 + exp(-d * 12.0) * 0.3;
    col = mix(col, mix(tint, vec3(1.0), 0.7), core * on) + tint * halo * on * uIntensity * 0.5;
  }
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Cyberpunk", values: { uColorA: [1, 0.15, 0.6], uColorB: [0.2, 0.5, 1], uAmbient: 0.1, uIntensity: 2 } },
    { name: "Diner sign", values: { uSource: [0, 0.85], uTubeAngle: 0, uLength: 0.9, uColorA: [1, 0.3, 0.2], uColorB: [1, 0.75, 0.3], uFlicker: 0.6 } },
    { name: "Steady", values: { uFlicker: 0, uShowTube: false, uColorA: [0.6, 0.2, 1], uColorB: [0.1, 1, 0.7] } },
  ],
};

export const candlelight: ShaderEffect = {
  kind: "shader",
  id: "candlelight",
  name: "Candlelight",
  description: "A picture lit only by a warm candle low in the frame, its flicker shifting the light and the deep shadows, with a soft warm bloom.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "candle", "fire", "warm", "flicker", "cosy", "dark", "image", "normal-map", "filter"],
  source: glsl(
    `// Candlelight: a flickering point light low in the frame shading normals from brightness, a small flame and a warm bloom.
uniform sampler2D uImage;     // @control filter=mipmap wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec2 uSource;         // @control min=-1 max=1 default=-0.45,-0.8 label="Candle position"
uniform vec3 uColor;          // @control color default=#FF9A3D label="Flame colour"
uniform float uIntensity;     // @control min=0 max=4 default=2.2 label="Intensity"
uniform float uFlicker;       // @control min=0 max=1 default=0.6 label="Flicker"
uniform float uReach;         // @control min=0.2 max=2 default=1.2 label="Reach"
uniform float uAmbient;       // @control min=0 max=0.3 default=0.02 label="Ambient"
uniform float uBloom;         // @control min=0 max=1 default=0.5 label="Warm bloom"
uniform float uStrength;      // @control min=0 max=10 default=4 label="Relief"
uniform bool uShowFlame;      // @control default=true label="Show the flame"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    NOISE,
    RELIEF,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime;
  // Flicker: the flame dips and gutters, and leans a little as it does.
  float f = vnoise(vec2(t * 7.0, 0.5)) * 0.6 + vnoise(vec2(t * 17.0, 4.0)) * 0.4;
  float power = 1.0 - uFlicker * 0.45 * (1.0 - f);
  vec2 lean = vec2(vnoise(vec2(t * 3.0, 9.0)) - 0.5, vnoise(vec2(t * 5.0, 13.0)) - 0.5) * vec2(0.03, 0.015) * uFlicker;
  vec2 base = uSource * vec2(aspect, 1.0) * 0.5;
  vec2 flamePos = base + vec2(0.0, 0.035) + lean;

  vec3 toLight = vec3(flamePos - p, 0.12);
  float dist = length(toLight);
  float k = dist / (0.3 * uReach);
  float att = 1.0 / (1.0 + k * k) * (1.0 - smoothstep(0.5 * uReach, 1.6 * uReach, dist));
  vec3 n = surfaceNormal(uv, uStrength);
  vec2 s = shade(n, toLight / dist, 20.0);
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 warm = uColor * uIntensity * att * power;
  // Deep shadows: little ambient, and the lit colour pushed warm.
  vec3 col = pic.rgb * (vec3(uAmbient) * vec3(0.6, 0.6, 0.9) + warm * s.x) + warm * s.y * 0.2;
  // Bloom: the bright, lit parts bleed a little warm light, and the air glows round the flame.
  vec3 soft = textureSize(uImage, 0).x > 1 ? textureLod(uImage, uv, 4.0).rgb : pic.rgb;
  col += soft * warm * 0.25 * uBloom;
  float fd = length(p - flamePos);
  col += uColor * power * uBloom * (exp(-fd * 9.0) * 0.5 + exp(-fd * 30.0) * 0.6);

  if (uShowFlame) {
    vec2 q = (p - flamePos) / vec2(0.012, 0.03);
    q.x += lean.x * 8.0 * max(q.y, 0.0);
    float shape = length(vec2(q.x * (1.0 + max(q.y, 0.0) * 0.9), q.y));
    float flame = smoothstep(1.0, 0.55, shape);
    float core = smoothstep(0.6, 0.1, length(vec2(q.x * 1.4, q.y + 0.45)));
    col = mix(col, mix(uColor * 1.4, vec3(1.0, 0.95, 0.8), core), flame * power);
  }
  fragColor = vec4(rolloff(col), pic.a);
}`,
  ),
  presets: [
    { name: "Single candle", values: { uReach: 0.6, uBloom: 0.7, uAmbient: 0 } },
    { name: "Fireside", values: { uSource: [-0.85, -0.9], uColor: [1, 0.55, 0.2], uReach: 1.6, uIntensity: 2.4, uFlicker: 0.9, uShowFlame: false } },
  ],
};

export const poolCaustics: ShaderEffect = {
  kind: "shader",
  id: "pool-caustics",
  name: "Pool caustics",
  description: "Rippling caustic light reflected from a pool playing across a picture, as on a wall beside the water, in a cool blue-white.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "caustics", "water", "pool", "summer", "reflection", "image", "filter"],
  source: glsl(
    `// Pool caustics: two drifting Voronoi edge networks (F2 - F1), warped and stretched, multiplied into the picture as blue-white light.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Image"
uniform vec3 uTint;           // @control color default=#D4F1FF label="Light tint"
uniform vec3 uShade;          // @control color default=#2E6A96 label="Shade tint"
uniform float uIntensity;     // @control min=0 max=3 default=1.1 label="Intensity"
uniform float uAmbient;       // @control min=0 max=1 default=0.6 label="Ambient"
uniform float uScale;         // @control min=0.3 max=3 default=1 label="Scale"
uniform float uSpeed;         // @control min=0 max=3 default=0.6 label="Speed"
uniform float uSharpness;     // @control min=0 max=1 default=0.6 label="Sharpness"
uniform float uStretch;       // @control min=0 max=1 default=0.35 label="Stretch"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    NOISE,
    `// A web of bright lines: how close q is to the edge between its two nearest moving points.
float causticWeb(vec2 q, float t, float width) {
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash22(cell + o);
      vec2 pt = o + 0.5 + 0.4 * sin(t + 6.28318 * h);
      float d = length(pt - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return 1.0 - smoothstep(0.0, width, f2 - f1);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * uSpeed;
  // Thrown up from the water below, the pattern is stretched along the wall and wobbles as the surface moves.
  vec2 q = p * vec2(1.0, 1.0 - 0.5 * uStretch) * 5.0 / uScale;
  q += 0.35 * vec2(vnoise(q * 0.6 + t * 0.4), vnoise(q * 0.6 - t * 0.35 + 5.0));
  float width = mix(0.35, 0.08, uSharpness);
  float web = causticWeb(q, t, width) * 0.6 + causticWeb(q * 1.37 + 7.3, t * 1.3, width) * 0.6;
  web = pow(web, mix(1.0, 2.2, uSharpness));
  // Brighter and darker patches as the ripples gather and spread.
  web *= 0.6 + 0.6 * vnoise(p * 2.0 + vec2(t * 0.15, -t * 0.1));
  vec4 pic = pictureRGBA(uImage, uv);
  vec3 ambient = uAmbient * mix(vec3(1.0), uShade * 1.7, 0.6);
  vec3 col = pic.rgb * (ambient + uTint * web * uIntensity) + uTint * web * uIntensity * 0.06;
  fragColor = vec4(col / (1.0 + max(col - 1.0, 0.0)), pic.a);
}`,
  ),
  presets: [
    { name: "Midday pool", values: { uIntensity: 1.6, uAmbient: 0.75, uSharpness: 0.8 } },
    { name: "Night pool", values: { uTint: [0.45, 0.85, 1], uShade: [0.05, 0.15, 0.35], uAmbient: 0.25, uIntensity: 1.8, uSpeed: 0.4 } },
  ],
};

export const partyLights: ShaderEffect = {
  kind: "shader",
  id: "party-lights",
  name: "Party lights",
  description: "Club lighting over a picture: coloured spot beams cutting through haze and pools of light sweeping across it, with mirror-ball sparkles and an optional strobe.",
  category: "lighting",
  video: "filter",
  tags: ["lighting", "party", "club", "disco", "stage", "concert", "strobe", "colour", "image", "filter"],
  source: glsl(
    `// Party lights: beams from above sweeping light pools across the picture, added as light, plus mirror-ball dots and a strobe.
uniform sampler2D uImage;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform int uCount;           // @control min=1 max=8 default=5 label="Lights"
uniform vec3 uColorA;         // @control color default=#FF2D95 label="Colour A"
uniform vec3 uColorB;         // @control color default=#2DD4FF label="Colour B"
uniform vec3 uColorC;         // @control color default=#B6FF3B label="Colour C"
uniform float uIntensity;     // @control min=0 max=3 default=1.3 label="Intensity"
uniform float uSpeed;         // @control min=0 max=3 default=1 label="Speed"
uniform float uPoolSize;      // @control min=0.05 max=0.5 default=0.17 label="Pool size"
uniform float uBeams;         // @control min=0 max=1 default=0.5 label="Beams in the haze"
uniform float uDarken;        // @control min=0 max=1 default=0.55 label="Darken the room"
uniform float uSparkle;       // @control min=0 max=1 default=0.35 label="Mirror ball"
uniform float uStrobe;        // @control min=0 max=1 default=0 label="Strobe"
${BACKDROP_CONTROLS}`,
    PICTURE,
    HASH,
    ROTATE,
    `vec3 lightColour(int i, float t) {
  int k = int(mod(float(i) + floor(t * 0.25), 3.0));
  return k == 0 ? uColorA : k == 1 ? uColorB : uColorC;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  float t = iTime * uSpeed;
  vec3 light = vec3(0.0);
  vec3 haze = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    float h = hash12(vec2(fi, 4.2));
    // Each light hangs above the frame and swings its pool back and forth over the picture.
    vec2 src = vec2(((fi + 0.5) / float(uCount) - 0.5) * aspect * 0.9, 0.62);
    vec2 pool = vec2(sin(t * (0.5 + 0.4 * h) + fi * 2.1) * 0.45 * aspect, -0.1 + 0.3 * sin(t * (0.37 + 0.3 * h) + fi * 1.3));
    vec3 c = lightColour(i, t + fi);
    float size = uPoolSize * (0.8 + 0.4 * h);
    float d = length((p - pool) * vec2(1.0, 1.3));
    light += c * (smoothstep(size, size * 0.55, d) * 0.8 + exp(-d * d / (size * size)) * 0.5);
    // The beam: a cone from the light widening to the pool.
    vec2 ab = pool - src;
    float s = clamp(dot(p - src, ab) / dot(ab, ab), 0.0, 1.0);
    float w = mix(0.008, size * 0.9, s);
    float cone = smoothstep(w, w * 0.2, length(p - src - ab * s)) * s * s;
    haze += c * cone;
  }
  // Mirror ball: a sparse grid of dots turning slowly across the picture.
  vec2 g = rot(t * 0.15) * (p + vec2(0.0, 0.6)) * 22.0;
  vec2 cell = floor(g);
  float dotLit = step(0.94, hash12(cell)) * smoothstep(0.22, 0.05, length(fract(g) - 0.5));
  float twinkle = 0.5 + 0.5 * sin(iTime * 6.0 + hash12(cell + 1.7) * 20.0);
  vec3 sparkle = mix(vec3(1.0), lightColour(int(hash12(cell + 2.3) * 3.0), t), 0.5) * dotLit * twinkle * uSparkle;
  // Strobe: now and then a burst of white flashes.
  float burst = step(1.0 - uStrobe * 0.6, hash12(vec2(floor(iTime * 1.5), 9.0)));
  float strobe = uStrobe * burst * step(0.6, fract(iTime * 9.0));

  vec4 pic = pictureRGBA(uImage, uv);
  vec3 room = pic.rgb * (1.0 - uDarken);
  vec3 col = room + pic.rgb * (light + sparkle) * uIntensity * 1.4 + (light * 0.08 + haze * uBeams * 0.6 + sparkle * 0.4) * uIntensity;
  col += strobe * mix(vec3(0.4), vec3(1.0), pic.rgb);
  fragColor = vec4(col / (1.0 + max(col - 1.0, 0.0)), pic.a);
}`,
  ),
  presets: [
    { name: "Disco", values: { uColorA: [1, 0.25, 0.55], uColorB: [1, 0.8, 0.2], uColorC: [0.4, 0.4, 1], uSparkle: 0.8, uBeams: 0.3 } },
    { name: "Rave strobe", values: { uStrobe: 0.7, uSpeed: 2, uCount: 8, uDarken: 0.8, uBeams: 0.9, uColorC: [0.6, 0.2, 1] } },
    { name: "Concert", values: { uImage: SAMPLE_IMAGES.portrait, uCount: 3, uColorA: [0.3, 0.5, 1], uColorB: [1, 0.4, 0.2], uColorC: [1, 1, 1], uSparkle: 0, uBeams: 0.9, uDarken: 0.7 } },
  ],
};

/** Light falling on a picture: relighting, point lights, studio setups, times of day, gobos, neon, candles, caustics and club lights. */
export const lightingShaders: ShaderEffect[] = [
  relight,
  pointLight,
  studioLighting,
  timeOfDay,
  goboProjection,
  neonSpill,
  candlelight,
  poolCaustics,
  partyLights,
];
