/**
 * Stylised device frames for montage effects: generic phone, tablet,
 * laptop, desktop monitor, watch and browser window bezels (no real
 * hardware likenesses), each with the rectangle its screen fills, so any
 * effect can put media "on screen". As metadata for layout and vector
 * effects ({@link DEVICE_FRAMES}) and as a GLSL helper for shaders
 * ({@link DEVICE_GLSL}), the two describing the same shapes.
 */

/** The device kinds, in the order their int controls use (0 phone … 5 browser). */
export const DEVICE_KINDS = ["phone", "tablet", "laptop", "desktop", "watch", "browser"] as const;

/** A device kind: what an item's `device` hint names. */
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/** A device frame: its size (height 1) and its screen's rectangle, as fractions of that size from the top left. */
export interface DeviceFrame {
  kind: DeviceKind;
  /** Width and height, the height being 1. */
  size: readonly [number, number];
  /** The screen: left, top, width and height as fractions of the frame's width and height. */
  screen: readonly [number, number, number, number];
  /** The screen's corner radius, as a fraction of the frame's height. */
  screenRadius: number;
  /** The screen's aspect (width / height): what a screenshot made for it fits best. */
  aspect: number;
}

/** Screens as centre and half size in frame-height units, frame centred on 0 (what the GLSL uses). */
const SCREENS: Record<DeviceKind, readonly [number, number, number, number, number]> = {
  // cx, cy, half width, half height, radius
  phone: [0, 0, 0.225, 0.48, 0.055],
  tablet: [0, 0, 0.345, 0.465, 0.03],
  laptop: [0, 0.06, 0.62, 0.39, 0.008],
  desktop: [0, 0.12, 0.7, 0.36, 0.008],
  watch: [0, 0, 0.22, 0.27, 0.09],
  browser: [0, -0.035, 0.73, 0.445, 0.008],
};

const SIZES: Record<DeviceKind, readonly [number, number]> = {
  phone: [0.49, 1],
  tablet: [0.76, 1],
  laptop: [1.56, 1],
  desktop: [1.5, 1],
  watch: [0.62, 1],
  browser: [1.5, 1],
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Every device frame, by kind. */
export const DEVICE_FRAMES: Readonly<Record<DeviceKind, DeviceFrame>> = Object.fromEntries(
  DEVICE_KINDS.map((kind) => {
    const [w, h] = SIZES[kind];
    const [cx, cy, hw, hh, radius] = SCREENS[kind];
    // GLSL y points up; the metadata measures from the top.
    const left = (cx - hw + w / 2) / w;
    const top = (h / 2 - (cy + hh)) / h;
    return [kind, { kind, size: [w, h], screen: [r3(left), r3(top), r3((2 * hw) / w), r3((2 * hh) / h)], screenRadius: radius, aspect: r3(hw / hh) }];
  }),
) as unknown as Record<DeviceKind, DeviceFrame>;

/** A device hint as its int (0 phone … 5 browser); undefined for a name that is not one. */
export function deviceIndex(device: string): number | undefined {
  const i = (DEVICE_KINDS as readonly string[]).indexOf(device);
  return i < 0 ? undefined : i;
}

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const glslVec = (k: DeviceKind) => `vec4(${SCREENS[k].slice(0, 4).map(f).join(", ")})`;

/**
 * GLSL for the frames, centred on 0 with a height of 1:
 * - `deviceSize(kind)`: width and height.
 * - `deviceScreen(kind)`: the screen's centre and half size.
 * - `deviceFrame(kind, p, bezel, px, out screenUV, out screen)`: the frame's
 *   colour and coverage at `p`, and the screen's coverage and 0–1 position
 *   there (y up), to sample a screenshot at.
 */
export const DEVICE_GLSL = `
float dsBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec2 deviceSize(int k) {
  return k == 0 ? vec2(${f(SIZES.phone[0])}, 1.0) : k == 1 ? vec2(${f(SIZES.tablet[0])}, 1.0) : k == 2 ? vec2(${f(SIZES.laptop[0])}, 1.0) : k == 3 ? vec2(${f(SIZES.desktop[0])}, 1.0) : k == 4 ? vec2(${f(SIZES.watch[0])}, 1.0) : vec2(${f(SIZES.browser[0])}, 1.0);
}
vec4 deviceScreen(int k) {
  return k == 0 ? ${glslVec("phone")} : k == 1 ? ${glslVec("tablet")} : k == 2 ? ${glslVec("laptop")} : k == 3 ? ${glslVec("desktop")} : k == 4 ? ${glslVec("watch")} : ${glslVec("browser")};
}
float deviceScreenRadius(int k) {
  return k == 0 ? ${f(SCREENS.phone[4])} : k == 1 ? ${f(SCREENS.tablet[4])} : k == 4 ? ${f(SCREENS.watch[4])} : 0.008;
}
vec4 deviceFrame(int k, vec2 p, vec3 bezel, float px, out vec2 suv, out float screen) {
  vec2 sz = deviceSize(k) * 0.5;
  vec4 sr = deviceScreen(k);
  float body;
  vec3 c = bezel;
  if (k == 2) {
    // Laptop: a lid and a thin base wider than it.
    float lid = dsBox(p - vec2(0.0, 0.06), vec2(0.66, 0.43), 0.03);
    float base = dsBox(p - vec2(0.0, -0.42), vec2(0.78, 0.035), 0.02);
    body = min(lid, base);
    c = mix(bezel, bezel * 0.75 + 0.18, step(p.y, -0.385));
  } else if (k == 3) {
    // Desktop: a monitor on a neck and foot.
    float scr = dsBox(p - vec2(0.0, 0.12), vec2(0.74, 0.4), 0.02);
    float neck = dsBox(p - vec2(0.0, -0.36), vec2(0.06, 0.1), 0.0);
    float foot = dsBox(p - vec2(0.0, -0.47), vec2(0.22, 0.025), 0.02);
    body = min(scr, min(neck, foot));
  } else if (k == 4) {
    // Watch: a rounded face on a strap.
    body = min(dsBox(p, vec2(0.27, 0.33), 0.12), dsBox(p, vec2(0.19, 0.5), 0.05));
  } else {
    body = dsBox(p, sz, k == 0 ? 0.075 : k == 1 ? 0.045 : 0.03);
  }
  float sd = dsBox(p - sr.xy, sr.zw, deviceScreenRadius(k));
  screen = smoothstep(px, -px, sd);
  suv = (p - sr.xy) / (2.0 * sr.zw) + 0.5;
  if (k == 5) {
    // Browser: a lighter title bar with three dots.
    c = mix(c, bezel * 1.2 + 0.08, step(sr.y + sr.w, p.y));
    for (int i = 0; i < 3; i++) {
      vec2 dotAt = vec2(-sz.x + 0.05 + 0.035 * float(i), sz.y - 0.045);
      c = mix(c, vec3(0.95, 0.4 + 0.2 * float(i), 0.35), smoothstep(px, -px, length(p - dotAt) - 0.011));
    }
  }
  if (k == 0) screen *= smoothstep(-px, px, dsBox(p - vec2(0.0, sr.y + sr.w - 0.03), vec2(0.05, 0.012), 0.012));
  return vec4(c, smoothstep(px, -px, body));
}`.trim();
