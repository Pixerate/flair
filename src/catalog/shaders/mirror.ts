import { glsl, HASH, NOISE, ROTATE, SPECTRUM } from "../glsl.js";
import { SAMPLE_IMAGES, textImage } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { DISPERSE, TEXT_BEVEL } from "./glass.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Mirrors and reflections: chrome lettering, a picture standing on a glossy
 * floor or by water, a tunnel of reflections, a funhouse mirror and a mirror
 * that folds one clip into the next. Every effect here is tagged "mirror" and
 * "reflection".
 */

export const chromeText: ShaderEffect = {
  kind: "shader",
  id: "chrome-text",
  name: "Chrome text",
  description:
    "A title in polished or brushed metal: its bevels reflect a studio sky and dark ground split by a bright horizon, and a glint sweeps across the letters.",
  category: "text",
  video: "none",
  tags: ["text", "title", "chrome", "metal", "mirror", "reflection", "gold", "80s"],
  loop: 4,
  source: glsl(
    `// Chrome text: bevelled letters reflecting a sky-and-ground studio; a softbox glint sweeps through.
uniform sampler2D uText;        // @control wrap=clamp default=${textImage("CHROME")} label="Text"
uniform vec3 uBackground;       // @control color default=#0B0C10 label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
uniform float uSize;            // @control min=0.3 max=1 default=0.85 label="Text size"
uniform float uBevel;           // @control min=0.005 max=0.06 default=0.02 label="Bevel"
uniform vec3 uTint;             // @control color default=#FFFFFF label="Metal tint"
uniform vec3 uSky;              // @control color default=#EAF1FF label="Sky"
uniform vec3 uGround;           // @control color default=#3A302A label="Ground"
uniform float uHorizon;         // @control min=-0.5 max=0.5 default=0 label="Horizon"
uniform float uBrushed;         // @control min=0 max=1 default=0 label="Brushed"
uniform float uSweep;           // @control min=0 max=1 default=0.8 label="Glint"
uniform float uSweepTime;       // @control min=1 max=12 default=4 label="Seconds per glint"
uniform float uShadow;          // @control min=0 max=1 default=0.5 label="Shadow"`,
    HASH,
    NOISE,
    TEXT_BEVEL,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float mask = textAt(p, 1.5 * px);
  vec2 s = bevelSlope(p, uBevel);
  float h = bevelHeight(p, uBevel);
  // Brushing: fine streaks along the letters that scuff the surface and its reflection.
  float streak = vnoise(vec2(p.x * 4.0, p.y * 700.0)) * 0.6 + vnoise(vec2(p.x * 20.0, p.y * 1500.0)) * 0.4;
  s.y += uBrushed * (streak - 0.5) * 0.25;
  // Where the reflected ray lands: the face's height on the letter plus the bevel's tilt.
  float textH = vec2(textureSize(uText, 0)).y / textPlace(vec2(0.0)).z;
  float ey = p.y / (0.35 * textH) - s.y * 1.6 - uHorizon;
  float ex = p.x * 0.6 - s.x * 1.6;
  vec3 sky = mix(uSky, uSky * vec3(0.38, 0.45, 0.62), clamp(ey, 0.0, 1.0));
  vec3 ground = mix(uGround, uGround * 0.12, clamp(-ey * 1.6, 0.0, 1.0));
  vec3 env = ey > 0.0 ? sky : ground;
  env += smoothstep(0.06, 0.0, abs(ey)) * 0.9 * (1.0 - 0.6 * uBrushed);
  env = mix(env, vec3(dot(env, vec3(0.333))), uBrushed * 0.5) * (1.0 - 0.25 * uBrushed * streak);
  float phase = fract(iTime / uSweepTime);
  float glintAt = mix(-2.0, 2.0, clamp(phase / 0.6, 0.0, 1.0));
  env += uSweep * exp(-pow((ex + 0.4 * ey - glintAt) * 3.5, 2.0)) * (1.0 - 0.5 * uBrushed);
  vec3 metal = env * uTint;
  vec3 n = normalize(vec3(-s * 1.4, 1.0));
  vec3 light = normalize(vec3(-0.5, 0.6, 0.8));
  metal += pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0) * 0.8 * uTint;
  metal *= 0.85 + 0.15 * h;
  vec3 col = uBackground * (1.0 - uShadow * 0.7 * textAt(p - vec2(0.01, -0.016), uBevel * 2.5));
  col = mix(col, metal, mask);
  fragColor = vec4(col, max(uBackgroundAlpha, mask));
}`,
  ),
  presets: [
    { name: "Gold", values: { uTint: [1, 0.78, 0.38], uSky: [1, 0.95, 0.85], uGround: [0.35, 0.22, 0.1] } },
    { name: "Brushed steel", values: { uBrushed: 1, uSweep: 0.5 } },
    { name: "Synthwave", values: { uSky: [0.6, 0.85, 1], uGround: [0.55, 0.1, 0.5], uBackground: [0.06, 0.02, 0.1], uHorizon: -0.1 } },
    { name: "Rose gold", values: { uTint: [1, 0.72, 0.65], uSky: [1, 0.93, 0.9] } },
  ],
};

export const floorReflection: ShaderEffect = {
  kind: "shader",
  id: "floor-reflection",
  name: "Floor reflection",
  description:
    "A picture or logo standing on a glossy floor, its mirror image beneath fading and softening with distance, under a soft spotlight; wet floors ripple it.",
  category: "shadow",
  video: "filter",
  tags: ["shadow", "mirror", "reflection", "floor", "product", "logo", "showcase", "image"],
  source: glsl(
    `// Floor reflection: the picture placed upright on a floor line, mirrored below it, blurring and fading with distance.
uniform sampler2D uImage;       // @control wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uSize;            // @control min=0.15 max=0.9 default=0.48 label="Size"
uniform float uFloor;           // @control min=0.05 max=0.6 default=0.3 label="Floor height"
uniform float uStrength;        // @control min=0 max=1 default=0.45 label="Reflection strength"
uniform float uFade;            // @control min=0.05 max=1.5 default=0.6 label="Reflection length"
uniform float uBlur;            // @control min=0 max=1 default=0.3 label="Blur with distance"
uniform float uRipple;          // @control min=0 max=1 default=0 label="Wet floor ripples"
uniform float uFloat;           // @control min=0 max=0.1 default=0 label="Float above the floor"
uniform float uBob;             // @control min=0 max=1 default=0 label="Bob"
uniform float uSpot;            // @control min=0 max=1 default=0.5 label="Spotlight"
uniform vec3 uBackgroundColor;  // @control color default=#101116 label="Background"
uniform vec3 uFloorColor;       // @control color default=#08090B label="Floor"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=1 label="Background opacity"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `// The image's width over height (the test card's when there is none).
float imageAspect() {
  vec2 size = vec2(textureSize(uImage, 0));
  return size.x > 1.0 ? size.x / size.y : 16.0 / 9.0;
}

// How much of a point at s (0–1 across the image) is on the image, smoothed over a pixel.
float onImage(vec2 s, vec2 pxInS) {
  vec2 e = min(s, 1.0 - s) / pxInS;
  return clamp(min(e.x, e.y) + 0.5, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = fragCoord * px;
  float aspect = iResolution.x * px;
  vec2 box = vec2(uSize * imageAspect(), uSize);
  box *= min(1.0, 0.92 * aspect / box.x);
  float base = uFloor + uFloat + uBob * 0.02 * (0.5 + 0.5 * sin(iTime * 1.6));
  vec2 origin = vec2(0.5 * aspect - 0.5 * box.x, base);
  vec2 pxInS = px / box;
  // The room: a background with a spotlight behind the subject, a floor that brightens under it.
  vec2 middle = origin + 0.5 * box;
  vec3 col = uBackgroundColor + uSpot * 0.22 * exp(-dot(p - middle, p - middle) / (box.y * box.y * 0.9));
  float onFloor = smoothstep(uFloor + px, uFloor - px, p.y);
  float under = exp(-pow((p.x - middle.x) / (box.x * 0.8), 2.0)) * exp(-(uFloor - p.y) / (box.y * 0.6));
  vec3 floorCol = uFloorColor + uSpot * 0.08 * under;
  col = mix(col, floorCol, onFloor);
  // The reflection: mirrored about the floor line, rippled, blurred and fading the further down it is.
  float depth = max(uFloor - p.y, 0.0);
  vec2 m = vec2(p.x, 2.0 * uFloor - p.y);
  if (uRipple > 0.0) m.x += uRipple * 0.012 * (vnoise(vec2(p.x * 6.0, depth * 90.0 - iTime * 2.0)) - 0.5) * (0.2 + depth * 8.0);
  vec2 rs = (m - origin) / box;
  vec4 refl = pictureBlurRGBA(uImage, rs, 1.0 + uBlur * 60.0 * depth / box.y) * onImage(rs, pxInS);
  float reach = 1.0 - smoothstep(0.0, uFade * box.y, depth + (base - uFloor));
  col = mix(col, refl.rgb, refl.a * reach * uStrength * onFloor);
  // A contact shadow where the subject meets the floor.
  float contact = exp(-pow((p.x - middle.x) / (box.x * 0.55), 2.0)) * exp(-abs(p.y - uFloor) / (0.012 + uFloat));
  col *= 1.0 - 0.5 * contact * onFloor * (1.0 - uStrength * 0.5);
  // The subject itself.
  vec2 s = (p - origin) / box;
  vec4 subject = pictureBlurRGBA(uImage, s, 1.0);
  float on = onImage(s, pxInS) * subject.a;
  col = mix(col, subject.rgb, on);
  fragColor = vec4(col, max(uBackgroundAlpha, max(on, refl.a * reach * uStrength * onFloor)));
}`,
  ),
  presets: [
    { name: "Logo", values: { uImage: SAMPLE_IMAGES.logo, uBackdropAlpha: 0, uSize: 0.42, uStrength: 0.5 } },
    { name: "Wet street", values: { uRipple: 0.8, uStrength: 0.6, uBlur: 0.15, uFloorColor: [0.04, 0.05, 0.07] } },
    { name: "Studio white", values: { uBackgroundColor: [0.95, 0.95, 0.96], uFloorColor: [0.9, 0.9, 0.92], uStrength: 0.25, uSpot: 0.2 } },
    { name: "Floating", values: { uFloat: 0.04, uBob: 1, uStrength: 0.35 } },
  ],
};

export const waterReflection: ShaderEffect = {
  kind: "shader",
  id: "water-reflection",
  name: "Water reflection",
  description:
    "A picture above a stretch of water that mirrors it, the reflection broken by ripples that shrink towards the horizon, tinted by the water and glinting.",
  category: "water",
  video: "filter",
  tags: ["water", "mirror", "reflection", "lake", "ripple", "image"],
  source: glsl(
    `// Water reflection: the picture above a water line, mirrored below it through perspective ripples.
uniform sampler2D uImage;    // @control wrap=mirror default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uHorizon;      // @control min=0.1 max=0.9 default=0.4 label="Water line"
uniform bool uFit;           // @control default=true label="Lift the picture to stand on the water line"
uniform float uRipple;       // @control min=0 max=1 default=0.5 label="Ripples"
uniform float uScale;        // @control min=0.2 max=3 default=1 label="Ripple size"
uniform float uSpeed;        // @control min=0 max=3 default=1 label="Speed"
uniform vec3 uWater;         // @control color default=#17384A label="Water colour"
uniform float uDepth;        // @control min=0 max=1 default=0.35 label="Water tint"
uniform float uGlints;       // @control min=0 max=1 default=0.5 label="Glints"
uniform float uBlur;         // @control min=0 max=1 default=0.15 label="Blur"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `// The water's height at a point of its surface (x across, z into the distance).
float waves(vec2 w, float t) {
  return vnoise(w + vec2(0.0, t)) * 0.6 + vnoise(w * 2.3 + vec2(t * 0.6, -t * 0.4)) * 0.4;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float h = uHorizon;
  if (uv.y >= h) {
    // Lifted: the picture moved up so its bottom edge sits on the water line (its top is cropped).
    vec2 src = uFit ? vec2(uv.x, uv.y - h) : uv;
    fragColor = pictureBlurRGBA(uImage, src, 1.0);
    return;
  }
  float dist = h - uv.y;
  // Perspective: rows near the horizon are far away, so their ripples are small and packed.
  float z = 1.0 / (dist + 0.03);
  vec2 w = vec2(uv.x * iResolution.x / iResolution.y * 6.0 * z * 0.12, z) * vec2(uScale, 0.35 * uScale) * 4.0;
  float t = iTime * uSpeed;
  float e = 0.05;
  vec2 slope = vec2(waves(w + vec2(e, 0.0), t) - waves(w - vec2(e, 0.0), t), waves(w + vec2(0.0, e), t) - waves(w - vec2(0.0, e), t)) / (2.0 * e);
  float near = dist / max(h, 1e-3);
  vec2 offset = slope * uRipple * vec2(0.01, 0.025) * (0.15 + near);
  float my = uFit ? dist : h + dist;
  vec4 refl = pictureBlurRGBA(uImage, vec2(uv.x, my) + offset, 1.0 + uBlur * 30.0 * near);
  vec3 col = refl.rgb;
  // Water darkens and tints it, more as it comes nearer; the far water reflects most.
  col = mix(col, uWater, uDepth * (0.3 + 0.7 * smoothstep(0.0, 0.8, near)));
  col *= 0.7 + 0.3 * (1.0 - near);
  float glint = pow(clamp(0.5 + 0.5 * (slope.x * 0.7 - slope.y * 0.7), 0.0, 1.0), 24.0);
  col += glint * uGlints * (0.4 + 0.8 * dot(refl.rgb, vec3(0.333))) * smoothstep(0.9, 0.2, near);
  col += 0.12 * exp(-dist * iResolution.y / 2.0);
  fragColor = vec4(col, refl.a);
}`,
  ),
  presets: [
    { name: "Still lake", values: { uRipple: 0.15, uGlints: 0.2, uDepth: 0.2 } },
    { name: "Choppy", values: { uRipple: 1, uScale: 2, uSpeed: 1.8, uGlints: 0.8 } },
    { name: "Night harbour", values: { uImage: SAMPLE_IMAGES.city, uWater: [0.02, 0.04, 0.08], uDepth: 0.5, uGlints: 0.9 } },
  ],
};

export const infinityMirror: ShaderEffect = {
  kind: "shader",
  id: "infinity-mirror",
  name: "Infinity mirror",
  description:
    "A picture repeated inside itself as a tunnel of reflections, each one smaller, darker and more tinted, with a ring of lights between them, drifting endlessly inward.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "mirror", "reflection", "droste", "tunnel", "recursive", "neon", "image"],
  source: glsl(
    `// Infinity mirror: the picture shrunk inside its own frame again and again, zooming slowly through the copies.
uniform sampler2D uImage;     // @control wrap=mirror default=${SAMPLE_IMAGES.city} label="Image"
uniform float uDepth;         // @control min=0.3 max=0.92 default=0.62 label="Each copy's size"
uniform float uFade;          // @control min=0 max=1 default=0.3 label="Darken with depth"
uniform vec3 uTint;           // @control color default=#8FD3FF label="Mirror tint"
uniform float uTintAlpha;     // @control min=0 max=1 default=0.2 label="Tint with depth"
uniform float uFrame;         // @control min=0 max=0.12 default=0.025 label="Frame width"
uniform vec3 uFrameColor;     // @control color default=#101216 label="Frame"
uniform float uLights;        // @control min=0 max=1 default=0.8 label="Lights"
uniform vec3 uLightColor;     // @control color default=#FF3D9A label="Light colour"
uniform float uSpeed;         // @control min=-1 max=1 default=0.2 label="Zoom speed"
uniform float uSpin;          // @control min=-0.5 max=0.5 default=0 label="Turn per copy"
uniform bool uRound;          // @control default=false label="Round"
${BACKDROP_CONTROLS}`,
    ROTATE,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `// How far out p is: 1 on the frame's edge, 0 in the middle.
float extent(vec2 p, float aspect) {
  vec2 q = p / vec2(0.5 * aspect, 0.5);
  return uRound ? length(q) : max(abs(q.x), abs(q.y));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x * px;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  float phase = fract(iTime * uSpeed);
  float m = max(extent(p, aspect), 1e-4);
  // Copies are uDepth apart in scale: level counts them inward, and the zoom slides through them.
  float z = log(m) / log(uDepth) + phase;
  float level = floor(z);
  float scale = pow(uDepth, -(level - phase));
  vec2 q = rot(uSpin * level) * (p * scale);
  vec2 uv = q / vec2(aspect, 1.0) + 0.5;
  vec4 pic = pictureBlurRGBA(uImage, uv, 1.0);
  vec3 col = pic.rgb;
  float deep = max(z - phase, 0.0);
  col *= pow(1.0 - uFade * 0.6, deep);
  col = mix(col, col * uTint * 1.3, 1.0 - pow(1.0 - uTintAlpha, deep));
  // The frame round each copy, with a string of lights along it.
  float local = extent(q, aspect);
  float band = (1.0 - local) / max(uFrame, 1e-4);
  float frame = step(0.0001, uFrame) * smoothstep(1.0 + 2.0 * px * scale / uFrame, 1.0, band);
  vec2 dir = q / vec2(0.5 * aspect, 0.5);
  float around = uRound ? atan(dir.y, dir.x) / 6.28318 : (abs(dir.x) > abs(dir.y) ? dir.y * 0.25 * sign(dir.x) : 0.5 - dir.x * 0.25 * sign(dir.y));
  float bulbs = uRound ? 48.0 : 40.0;
  float bulb = 1.0 - abs(fract(around * bulbs) - 0.5) * 2.0;
  float lit = smoothstep(0.55, 1.0, bulb) * exp(-pow((band - 0.5) * 3.0, 2.0));
  vec3 frameCol = uFrameColor * (0.8 + 0.4 * band) + uLightColor * lit * uLights * 1.5;
  vec3 spill = uLightColor * uLights * 0.25 * exp(-max(band - 1.0, 0.0) * 1.2) * step(1.0, band);
  col = mix(col + spill * pow(1.0 - uFade * 0.6, deep), frameCol * pow(1.0 - uFade * 0.6, deep), frame);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Droste", values: { uFrame: 0, uLights: 0, uTintAlpha: 0, uFade: 0, uDepth: 0.5 } },
    { name: "Neon portal", values: { uRound: true, uLightColor: [0.2, 0.9, 1], uTint: [0.5, 0.4, 1], uTintAlpha: 0.35 } },
    { name: "Spiral", values: { uSpin: 0.2, uSpeed: 0.35 } },
  ],
};

export const funhouseMirror: ShaderEffect = {
  kind: "shader",
  id: "funhouse-mirror",
  name: "Funhouse mirror",
  description:
    "A picture in a gilt-framed oval funhouse mirror that stretches it tall or squat and rolls it through slow wavy bulges, a sheen sliding across the glass.",
  category: "distortion",
  video: "filter",
  tags: ["distortion", "mirror", "reflection", "funhouse", "carnival", "warp", "image"],
  source: glsl(
    `// Funhouse mirror: a curved mirror's warp (stretch plus rolling bulges) inside an oval gilt frame.
uniform sampler2D uImage;    // @control wrap=mirror default=${SAMPLE_IMAGES.portrait} label="Image"
uniform float uStretch;      // @control min=-1 max=1 default=0.5 label="Squat ← → Tall"
uniform float uWave;         // @control min=0 max=1 default=0.45 label="Bulges"
uniform float uWaves;        // @control min=0.5 max=4 default=1.5 label="Bulges down"
uniform float uSpeed;        // @control min=0 max=2 default=0.4 label="Speed"
uniform float uSheen;        // @control min=0 max=1 default=0.5 label="Sheen"
uniform bool uFramed;        // @control default=true label="Oval frame"
uniform vec3 uFrameColor;    // @control color default=#C9A24B label="Frame"
uniform vec3 uWall;          // @control color default=#3B2A3F label="Wall"
${BACKDROP_CONTROLS}`,
    SPECTRUM,
    PICTURE,
    DISPERSE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x * px;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 radii = uFramed ? vec2(min(0.32, 0.42 * aspect), 0.42) : vec2(0.5 * aspect, 0.5);
  vec2 q = p / radii;
  float t = iTime * uSpeed;
  // How wide each row is: stretched overall, with bulges rolling down the glass.
  float bulge = sin(q.y * uWaves * 3.14159 + t);
  float sx = (1.0 + 0.35 * uStretch) * (1.0 + uWave * 0.35 * bulge);
  float sy = 1.0 - 0.3 * uStretch * (1.0 - 0.4 * q.y * q.y);
  vec2 src = vec2(q.x / sx, q.y * sy + uWave * 0.05 * sin(q.x * 2.0 + t * 0.7)) * radii;
  vec4 pic = pictureBlurRGBA(uImage, src / vec2(aspect, 1.0) + 0.5, 1.0);
  vec3 glass = pic.rgb * vec3(0.94, 0.97, 0.95);
  glass *= 1.0 + 0.12 * uWave * cos(q.y * uWaves * 3.14159 + t);
  float sweep = q.x + q.y * 0.6 - 0.4 + 0.25 * sin(t * 0.5);
  glass += uSheen * (0.22 * exp(-sweep * sweep * 30.0) + 0.1 * exp(-pow((sweep + 0.25) * 20.0, 2.0)));
  if (!uFramed) {
    fragColor = vec4(glass, pic.a);
    return;
  }
  float r = length(q);
  float inside = clamp((1.0 - r) * radii.y / px + 0.5, 0.0, 1.0);
  // The frame: a rounded gilt moulding with a beaded outer edge.
  float a = atan(q.y, q.x);
  float outer = 1.14 + 0.012 * smoothstep(0.3, 1.0, abs(sin(a * 24.0)));
  float inFrame = clamp((outer - r) * radii.y / px + 0.5, 0.0, 1.0);
  float across = clamp((r - 1.0) / (outer - 1.0), 0.0, 1.0);
  float round_ = sin(across * 3.14159);
  vec2 n2 = q / max(r, 1e-3) * cos(across * 3.14159);
  float lit = 0.55 + 0.45 * dot(n2, normalize(vec2(-0.5, 0.8)));
  vec3 gilt = uFrameColor * (0.35 + 0.75 * round_ * lit) + vec3(1.0, 0.95, 0.8) * pow(max(round_ * lit, 0.0), 12.0) * 0.6;
  vec3 wall = uWall * (1.0 - 0.45 * exp(-max(length((p + vec2(-0.015, 0.02)) / radii) - outer, 0.0) * 8.0));
  vec3 col = mix(wall, gilt, inFrame);
  col = mix(col, glass, inside);
  fragColor = vec4(col, mix(1.0, pic.a, inside));
}`,
  ),
  presets: [
    { name: "Tall", values: { uStretch: 1, uWave: 0.2 } },
    { name: "Squat", values: { uStretch: -1, uWave: 0.3 } },
    { name: "Wobbly", values: { uStretch: 0, uWave: 1, uWaves: 3, uSpeed: 1 } },
    { name: "No frame", values: { uFramed: false } },
  ],
};

export const mirrorFold: ShaderEffect = {
  kind: "shader",
  id: "transition-mirror-fold",
  name: "Mirror fold",
  description:
    "One picture folds back like a page whose underside is a mirror, the fold sweeping across to reveal the next, the mirrored flap reflecting it as it goes. Loops back and forth; or turn Animate off and set Progress.",
  category: "transition",
  video: "transition",
  tags: ["transition", "mirror", "reflection", "fold", "page", "image", "slideshow"],
  loop: 4,
  source: glsl(
    `// Mirror fold: From folds over along a moving crease; the flap's back is a mirror showing To reflected.
uniform sampler2D uFrom;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="From image"
uniform sampler2D uTo;     // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="To image"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.5 label="Progress (when still)"
uniform float uAngle;      // @control min=-180 max=180 default=0 label="Direction (°)"
uniform float uFlap;       // @control min=0.05 max=0.6 default=0.25 label="Flap width"
uniform float uMirror;     // @control min=0 max=1 default=0.85 label="Mirror (else paper)"
uniform vec3 uTint;        // @control color default=#DCE4EE label="Mirror tint"
uniform float uShadow;     // @control min=0 max=1 default=0.5 label="Shadow"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `float progress() {
  return uAnimate ? smoothstep(0.1, 0.9, 0.5 - 0.5 * cos(iTime * 6.28318 / 4.0)) : uProgress;
}

// An image cover-fitted to the frame (the test card fits it).
vec4 coverRGBA(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  float frameAspect = iResolution.x / iResolution.y;
  float imageAspect = size.x > 1.0 ? size.x / size.y : frameAspect;
  vec2 scale = frameAspect > imageAspect ? vec2(1.0, imageAspect / frameAspect) : vec2(frameAspect / imageAspect, 1.0);
  return pictureRGBA(tex, 0.5 + (uv - 0.5) * scale);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  float aspect = iResolution.x * px;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) * px;
  vec2 dir = vec2(cos(radians(uAngle)), sin(radians(uAngle)));
  // The crease runs across dir; it travels from behind the frame to past it.
  float span = 0.5 * (abs(dir.x) * aspect + abs(dir.y)) + uFlap;
  float t = progress();
  float crease = mix(-span, span, t);
  float x = dot(p, dir) - crease;
  vec4 col;
  float flapW = uFlap * smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t);
  if (x < 0.0) {
    col = coverRGBA(uTo, p / vec2(aspect, 1.0) + 0.5);
  } else if (x < flapW) {
    // On the flap: the fold squashes it, its mirror shows To reflected about the crease, darker towards the fold.
    float k = x / flapW;
    vec2 back = p - dir * 2.0 * x;
    vec4 seen = coverRGBA(uTo, back / vec2(aspect, 1.0) + 0.5);
    vec4 paper = coverRGBA(uFrom, back / vec2(aspect, 1.0) + 0.5);
    vec3 face = mix(paper.rgb * 0.85, seen.rgb * uTint, uMirror);
    face *= 0.65 + 0.45 * k;
    face += uMirror * 0.3 * exp(-pow((k - 0.7) * 6.0, 2.0));
    col = vec4(face, max(seen.a, paper.a));
  } else {
    col = coverRGBA(uFrom, p / vec2(aspect, 1.0) + 0.5);
    col.rgb *= 1.0 - uShadow * 0.5 * exp(-(x - flapW) / 0.04) * step(0.001, flapW);
  }
  fragColor = col;
}`,
  ),
  presets: [
    { name: "Upward", values: { uAngle: 90 } },
    { name: "Paper", values: { uMirror: 0, uFlap: 0.3 } },
    { name: "Wide mirror", values: { uFlap: 0.5, uMirror: 1 } },
  ],
};

/** Mirror and reflection effects: chrome text, a floor and water reflection, an infinity mirror, a funhouse mirror and a mirror-fold transition. */
export const mirrorShaders: ShaderEffect[] = [chromeText, floorReflection, waterReflection, infinityMirror, funhouseMirror, mirrorFold];
