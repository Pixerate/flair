import { DEVICE_GLSL } from "../devices.js";
import { glsl } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Montages: several pieces of media composed into one animated scene, such
 * as screenshots on a set of devices or a frame cycling through them. Their
 * items fill image controls in order (`items` on the definition), and
 * `mountEffect` brings in more items than there are slots as it plays (see
 * `EffectItems`). They draw on clear by default, so they drop onto any page.
 */

/** A background, off by default, and how it is composited under the devices. */
const BACKGROUND = `
uniform vec3 uBackground;       // @control color default=#EEF2FF label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`.trim();

/** `over(acc, c, a)` onto a premultiplied accumulator; `finish(acc)` puts it over the background. */
const COMPOSITE = `
vec4 over(vec4 acc, vec3 c, float a) {
  return vec4(acc.rgb * (1.0 - a) + c * a, acc.a * (1.0 - a) + a);
}
vec4 finish(vec4 acc) {
  vec4 base = vec4(uBackground * uBackgroundAlpha, uBackgroundAlpha);
  vec4 o = vec4(acc.rgb + base.rgb * (1.0 - acc.a), acc.a + base.a * (1.0 - acc.a));
  return vec4(o.rgb / max(o.a, 1e-4), o.a);
}`.trim();

/** `screenRGBA(tex, suv, aspect)`: a screenshot filling a screen of that aspect (cover, top-aligned, as screenshots read). */
const SCREEN = `
vec4 screenRGBA(sampler2D tex, vec2 suv, float aspect) {
  ivec2 ts = textureSize(tex, 0);
  vec2 uv = suv;
  if (ts.x > 1 && ts.y > 1) {
    float texAspect = float(ts.x) / float(ts.y);
    // Cover: fill the screen, cropping the overflow; a tall screenshot is cropped from the bottom.
    if (texAspect > aspect) uv.x = (suv.x - 0.5) * aspect / texAspect + 0.5;
    else uv.y = 1.0 - (1.0 - suv.y) * texAspect / aspect;
  }
  return pictureRGBA(tex, uv);
}`.trim();

const ITEM_CONTROLS = [
  `uniform sampler2D uItem0;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Item 1"`,
  `uniform sampler2D uItem1;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Item 2"`,
  `uniform sampler2D uItem2;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Item 3"`,
  `uniform sampler2D uItem3;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Item 4"`,
  `uniform sampler2D uItem4;      // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Item 5"`,
].join("\n");

const DEVICE_CONTROLS = [0, 1, 2, 3, 4]
  .map((i) => `uniform int uDevice${i};        // @control min=0 max=5 default=${[2, 0, 1, 0, 4][i]} label="Device ${i + 1} (0 phone, 1 tablet, 2 laptop, 3 desktop, 4 watch, 5 browser)"`)
  .join("\n");

export const deviceShowcase: ShaderEffect = {
  kind: "shader",
  id: "device-showcase",
  name: "Device showcase",
  description: "Screenshots on two to five stylised devices (phone, tablet, laptop, monitor, watch, browser) in a staggered layout with depth, drifting in a slow parallax orbit while the devices swap screens one after another.",
  category: "montage",
  video: "stills",
  tags: ["montage", "devices", "screenshots", "mockup", "product", "marketing", "responsive", "app", "items"],
  transparent: true,
  rest: 0,
  items: {
    min: 1,
    max: 24,
    slots: ["uItem0", "uItem1", "uItem2", "uItem3", "uItem4"],
    cycle: "swap",
    count: "uCount",
    devices: ["uDevice0", "uDevice1", "uDevice2", "uDevice3", "uDevice4"],
  },
  source: glsl(
    `// Device showcase: up to five devices with screenshots, staggered in depth, drifting in a slow orbit.
${ITEM_CONTROLS}
${DEVICE_CONTROLS}
uniform int uCount;             // @control min=1 max=5 default=3 label="Devices"
uniform int uLayout;            // @control min=0 max=2 default=0 label="Layout (0 staggered row, 1 family, 2 floating stack)"
uniform float uSize;            // @control min=0.3 max=1.2 default=0.72 label="Size"
uniform float uOrbit;           // @control min=0 max=1 default=0.35 label="Orbit"
uniform float uSpeed;           // @control min=0 max=2 default=0.5 label="Orbit speed"
uniform vec3 uBezel;            // @control color default=#111827 label="Bezel"
uniform float uShadow;          // @control min=0 max=1 default=0.35 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    DEVICE_GLSL,
    COMPOSITE,
    SCREEN,
    `vec4 itemScreen(int i, vec2 suv, float aspect) {
  if (i == 0) return screenRGBA(uItem0, suv, aspect);
  if (i == 1) return screenRGBA(uItem1, suv, aspect);
  if (i == 2) return screenRGBA(uItem2, suv, aspect);
  if (i == 3) return screenRGBA(uItem3, suv, aspect);
  return screenRGBA(uItem4, suv, aspect);
}
int deviceOf(int i) {
  return i == 0 ? uDevice0 : i == 1 ? uDevice1 : i == 2 ? uDevice2 : i == 3 ? uDevice3 : uDevice4;
}

// Where device i of n sits (xy, in frame heights from the centre), its scale and depth (0 back, 1 front).
vec4 placeOf(int i, int n, int k) {
  float fi = float(i);
  float fn = float(n);
  if (uLayout == 1) {
    // Family: the big screens behind in the middle, the small ones in front at the sides.
    float big = k == 2 || k == 3 || k == 5 ? 1.0 : k == 1 ? 0.7 : k == 0 ? 0.5 : 0.32;
    float side = fn <= 1.0 ? 0.0 : (fi / (fn - 1.0) - 0.5) * 2.0;
    float x = side * 0.62 * (1.0 - 0.35 * big);
    return vec4(x, -0.12 * (1.0 - big), big * 0.92, 1.0 - big);
  }
  if (uLayout == 2) {
    // Floating stack: overlapping diagonally, the last in front.
    float t = fn <= 1.0 ? 0.5 : fi / (fn - 1.0);
    return vec4(mix(-0.45, 0.45, t), mix(0.18, -0.18, t), 0.78, t);
  }
  // Staggered row: across the frame, alternately up and down, the middle in front.
  float t = fn <= 1.0 ? 0.5 : fi / (fn - 1.0);
  float depth = 1.0 - abs(t - 0.5) * 2.0;
  // Spread across what is visible, leaving room for the outer devices' halves.
  float visible = iResolution.x / iResolution.y / uSize;
  float x = (t - 0.5) * min(0.55 * fn, max(0.0, visible - 0.9));
  float y = (mod(fi, 2.0) - 0.5) * 0.12;
  return vec4(x, y, 0.62 + 0.25 * depth, depth);
}

// How far back device i is (0 back, 1 front), told apart by index when two are level.
float depthOf(int i, int n) {
  return placeOf(i, n, deviceOf(i)).w + float(i) * 1e-3;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float h = iResolution.y * uSize;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / h;
  float px = 1.5 / h;
  int n = clamp(uCount, 1, 5);
  vec4 acc = vec4(0.0);
  // Back to front: each pass draws the device ranked that far back, so nearer devices draw over farther ones.
  float depths[5];
  for (int j = 0; j < 5; j++) depths[j] = j < n ? depthOf(j, n) : 99.0;
  for (int pass = 0; pass < 5; pass++) {
    if (pass >= n) break;
    int which = 0;
    for (int j = 0; j < 5; j++) {
      int r = 0;
      for (int m = 0; m < 5; m++) r += depths[m] < depths[j] ? 1 : 0;
      if (j < n && r == pass) which = j;
    }
    int k = deviceOf(which);
    vec4 place = placeOf(which, n, k);
    // A slow orbit: nearer devices drift further, as parallax.
    float phase = iTime * uSpeed + float(which) * 1.7;
    vec2 drift = uOrbit * vec2(0.05 * sin(phase), 0.03 * cos(phase * 0.8)) * (0.4 + place.w);
    vec2 q = (p - place.xy - drift) / place.z;
    // A soft shadow under it, then the frame and its screen.
    float shadow = exp(-pow(length((q - vec2(0.0, -0.55)) * vec2(1.0 / max(deviceSize(k).x, 0.4), 6.0)), 2.0) * 2.0);
    acc = over(acc, vec3(0.0), shadow * uShadow * 0.6);
    vec2 suv;
    float screen;
    vec4 frame = deviceFrame(k, q, uBezel, px / place.z, suv, screen);
    acc = over(acc, frame.rgb, frame.a);
    if (screen > 0.0) {
      vec4 sr = deviceScreen(k);
      vec4 shot = itemScreen(which, suv, sr.z / sr.w);
      acc = over(acc, shot.rgb, screen * shot.a);
    }
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Phone + laptop", values: { uCount: 2, uDevice0: 2, uDevice1: 0, uLayout: 1 } },
    { name: "Device family", values: { uCount: 4, uDevice0: 3, uDevice1: 1, uDevice2: 0, uDevice3: 4, uLayout: 1 } },
    { name: "Floating stack", values: { uCount: 3, uDevice0: 5, uDevice1: 5, uDevice2: 5, uLayout: 2, uOrbit: 0.6 } },
    { name: "With background", values: { uBackgroundAlpha: 1 } },
  ],
};

export const screenshotCarousel: ShaderEffect = {
  kind: "shader",
  id: "screenshot-carousel",
  name: "Screenshot carousel",
  description: "One device or browser frame cycling through screenshots, each swapped for the next with a slide, a fade, a zoom or a wipe, the frame floating gently.",
  category: "montage",
  video: "stills",
  tags: ["montage", "devices", "screenshots", "carousel", "slideshow", "product", "marketing", "browser", "items"],
  transparent: true,
  loop: 6,
  rest: 0,
  items: { min: 1, max: 24, slots: ["uFrom", "uTo"], cycle: "carousel", progress: "uProgress", devices: ["uDevice"] },
  source: glsl(
    `// Screenshot carousel: one frame cycling through screenshots, swapping each for the next.
uniform sampler2D uFrom;        // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Screenshot shown"
uniform sampler2D uTo;          // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Next screenshot"
uniform int uDevice;            // @control min=0 max=5 default=5 label="Frame (0 phone, 1 tablet, 2 laptop, 3 desktop, 4 watch, 5 browser)"
uniform int uTransition;        // @control min=0 max=3 default=0 label="Swap (0 slide, 1 fade, 2 zoom, 3 wipe)"
uniform bool uAnimate;          // @control default=true label="Animate (preview)"
uniform float uProgress;        // @control min=0 max=1 default=0 label="Change to the next (0–1)"
uniform float uSize;            // @control min=0.3 max=1 default=0.8 label="Size"
uniform float uFloat;           // @control min=0 max=1 default=0.4 label="Float"
uniform vec3 uBezel;            // @control color default=#1F2937 label="Frame"
uniform float uShadow;          // @control min=0 max=1 default=0.35 label="Shadow"
${BACKGROUND}
${BACKDROP_CONTROLS}`,
    PICTURE,
    DEVICE_GLSL,
    COMPOSITE,
    SCREEN,
    `// The screen during a change, by uTransition: the shown screenshot (a) giving way to the next (b).
vec4 swapScreen(vec2 suv, float aspect, float t) {
  t = smoothstep(0.0, 1.0, clamp(t, 0.0, 1.0));
  if (uTransition == 1) return mix(screenRGBA(uFrom, suv, aspect), screenRGBA(uTo, suv, aspect), t);
  if (uTransition == 2) {
    // Zoom: the shown one grows and fades, the next settles in from slightly small.
    vec4 a = screenRGBA(uFrom, (suv - 0.5) / (1.0 + 0.25 * t) + 0.5, aspect);
    vec4 b = screenRGBA(uTo, (suv - 0.5) / (0.85 + 0.15 * t) + 0.5, aspect);
    return mix(a, b, t);
  }
  if (uTransition == 3) {
    // Wipe: a soft edge sweeping left to right.
    float edge = smoothstep(t * 1.2 - 0.1, t * 1.2 - 0.2, suv.x);
    return mix(screenRGBA(uFrom, suv, aspect), screenRGBA(uTo, suv, aspect), edge);
  }
  // Slide: the next pushes the shown one off to the left.
  vec2 sa = suv + vec2(t, 0.0);
  vec2 sb = suv + vec2(t - 1.0, 0.0);
  return sa.x <= 1.0 ? screenRGBA(uFrom, sa, aspect) : screenRGBA(uTo, sb, aspect);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float h = iResolution.y * uSize;
  int k = clamp(uDevice, 0, 5);
  // Wide frames are sized to fit the width as well.
  h = min(h, iResolution.x * uSize / deviceSize(k).x);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / h;
  float px = 1.5 / h;
  // The preview swaps there and back on a 6 s loop; given items, mountEffect drives uProgress.
  float t = uAnimate ? smoothstep(0.35, 0.5, abs(fract(iTime / 6.0) - 0.5) * 2.0 * 0.5 + 0.25) : uProgress;
  float bob = uFloat * 0.02 * sin(iTime * 6.28318 / 6.0);
  vec2 q = p - vec2(0.0, bob);
  vec4 acc = vec4(0.0);
  float shadow = exp(-pow(length((q - vec2(0.0, -0.56)) * vec2(1.0 / deviceSize(k).x, 7.0)), 2.0) * 2.0);
  acc = over(acc, vec3(0.0), shadow * uShadow * 0.6);
  vec2 suv;
  float screen;
  vec4 frame = deviceFrame(k, q, uBezel, px, suv, screen);
  acc = over(acc, frame.rgb, frame.a);
  if (screen > 0.0) {
    vec4 sr = deviceScreen(k);
    vec4 shot = swapScreen(suv, sr.z / sr.w, t);
    acc = over(acc, shot.rgb, screen * shot.a);
  }
  fragColor = finish(acc);
}`,
  ),
  presets: [
    { name: "Phone", values: { uDevice: 0, uTransition: 0 } },
    { name: "Laptop fade", values: { uDevice: 2, uTransition: 1 } },
    { name: "Tablet zoom", values: { uDevice: 1, uTransition: 2 } },
    { name: "Browser wipe", values: { uDevice: 5, uTransition: 3, uBackgroundAlpha: 1 } },
  ],
};

export const montageShaders: ShaderEffect[] = [deviceShowcase, screenshotCarousel];
