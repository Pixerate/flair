/**
 * Perceptual Color Science & Film Grading Engine.
 *
 * Implements:
 * - Oklab & Oklch: Perceptually uniform color spaces that eliminate hue shifts and gray dead zones.
 * - Standard Color Spaces: sRGB, Linear sRGB, Rec.709, Display P3, and ACEScg.
 * - Film Color Grading: ASC CDL (Slope, Offset, Power), Lift/Gamma/Gain, Vibrance (skin tone protection),
 *   and White Balance (Kelvin color temperature & tint).
 * - GLSL code generators for real-time WebGL fragment shader execution.
 */

export type ColorRGB = [number, number, number];
export type ColorRGBA = [number, number, number, number];

// -----------------------------------------------------------------------------
// sRGB <-> Linear Transfer Curves
// -----------------------------------------------------------------------------

export function srgbToLinear(c: number): number {
  const v = Math.max(0, c);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = Math.max(0, c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055;
}

export function srgbToLinearRgb(rgb: ColorRGB): ColorRGB {
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
}

export function linearRgbToSrgb(rgb: ColorRGB): ColorRGB {
  return [linearToSrgb(rgb[0]), linearToSrgb(rgb[1]), linearToSrgb(rgb[2])];
}

// -----------------------------------------------------------------------------
// Oklab & Oklch Perceptual Color Spaces (Björn Ottosson, 2020)
// -----------------------------------------------------------------------------

export function linearSrgbToOklab(rgb: ColorRGB): [number, number, number] {
  const [r, g, b] = rgb;

  // Linear sRGB to LMS cone response
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  // LMS to Oklab (L: lightness [0..1], a: green-red, b: blue-yellow)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bVal = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return [L, a, bVal];
}

export function oklabToLinearSrgb(lab: [number, number, number]): ColorRGB {
  const [L, a, b] = lab;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bVal = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [r, g, bVal];
}

export function srgbToOklab(rgb: ColorRGB): [number, number, number] {
  return linearSrgbToOklab(srgbToLinearRgb(rgb));
}

export function oklabToSrgb(lab: [number, number, number]): ColorRGB {
  const linear = oklabToLinearSrgb(lab);
  return linearRgbToSrgb(linear);
}

export function oklabToOklch(lab: [number, number, number]): [number, number, number] {
  const [L, a, b] = lab;
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a);
  if (h < 0) h += 2 * Math.PI;
  return [L, C, h];
}

export function oklchToOklab(lch: [number, number, number]): [number, number, number] {
  const [L, C, h] = lch;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

/**
 * Perceptually uniform color interpolation using Oklab space.
 * Prevents intermediate grayish dead spots.
 */
export function interpolateOklab(c1: ColorRGB, c2: ColorRGB, t: number): ColorRGB {
  const lab1 = srgbToOklab(c1);
  const lab2 = srgbToOklab(c2);
  const clampedT = Math.max(0, Math.min(1, t));

  const lab: [number, number, number] = [
    lab1[0] + (lab2[0] - lab1[0]) * clampedT,
    lab1[1] + (lab2[1] - lab1[1]) * clampedT,
    lab1[2] + (lab2[2] - lab1[2]) * clampedT,
  ];

  const res = oklabToSrgb(lab);
  return [
    Math.max(0, Math.min(1, res[0])),
    Math.max(0, Math.min(1, res[1])),
    Math.max(0, Math.min(1, res[2])),
  ];
}

/**
 * Perceptually uniform color interpolation using Oklch cylindrical space.
 * Interpolates along the shortest hue arc for vibrant gradients.
 */
export function interpolateOklch(c1: ColorRGB, c2: ColorRGB, t: number): ColorRGB {
  const lch1 = oklabToOklch(srgbToOklab(c1));
  const lch2 = oklabToOklch(srgbToOklab(c2));
  const clampedT = Math.max(0, Math.min(1, t));

  const L = lch1[0] + (lch2[0] - lch1[0]) * clampedT;
  const C = lch1[1] + (lch2[1] - lch1[1]) * clampedT;

  // Shortest arc hue interpolation
  let dHue = lch2[2] - lch1[2];
  if (dHue > Math.PI) dHue -= 2 * Math.PI;
  if (dHue < -Math.PI) dHue += 2 * Math.PI;
  let h = lch1[2] + dHue * clampedT;
  if (h < 0) h += 2 * Math.PI;
  if (h >= 2 * Math.PI) h -= 2 * Math.PI;

  const res = oklabToSrgb(oklchToOklab([L, C, h]));
  return [
    Math.max(0, Math.min(1, res[0])),
    Math.max(0, Math.min(1, res[1])),
    Math.max(0, Math.min(1, res[2])),
  ];
}

// -----------------------------------------------------------------------------
// Color Space Transformations (sRGB, Rec.709, Display P3, ACEScg)
// -----------------------------------------------------------------------------

export type ColorSpace = 'srgb' | 'linear-srgb' | 'rec709' | 'display-p3' | 'acescg';

type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

function mulMat3(m: Matrix3x3, v: ColorRGB): ColorRGB {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// Linear sRGB to Display P3 (linear)
const MAT_LINEAR_SRGB_TO_P3: Matrix3x3 = [
  0.822462, 0.177538, 0.000000,
  0.033194, 0.966806, 0.000000,
  0.017083, 0.072397, 0.910520,
];

// Display P3 (linear) to Linear sRGB
const MAT_P3_TO_LINEAR_SRGB: Matrix3x3 = [
  1.224940, -0.224940, 0.000000,
  -0.042057, 1.042057, 0.000000,
  -0.019638, -0.078636, 1.098274,
];

// Linear sRGB to ACEScg (AP1 primaries with Bradford adaptation to ACES white)
const MAT_LINEAR_SRGB_TO_ACESCG: Matrix3x3 = [
  0.613097, 0.339523, 0.047379,
  0.070194, 0.916354, 0.013452,
  0.020616, 0.109570, 0.869815,
];

// ACEScg to Linear sRGB
const MAT_ACESCG_TO_LINEAR_SRGB: Matrix3x3 = [
  1.704859, -0.621714, -0.083299,
  -0.130078, 1.140735, -0.010560,
  -0.023964, -0.128975, 1.153014,
];

/**
 * Converts a color between standard imaging color spaces.
 */
export function convertColorSpace(color: ColorRGB, from: ColorSpace, to: ColorSpace): ColorRGB {
  if (from === to) return [...color];

  // First convert `from` to Linear sRGB
  let lin: ColorRGB;
  switch (from) {
    case 'srgb':
      lin = srgbToLinearRgb(color);
      break;
    case 'linear-srgb':
      lin = [...color];
      break;
    case 'rec709':
      // BT.709 gamma 2.4 EOTF
      lin = [
        Math.pow(Math.max(0, color[0]), 2.4),
        Math.pow(Math.max(0, color[1]), 2.4),
        Math.pow(Math.max(0, color[2]), 2.4),
      ];
      break;
    case 'display-p3': {
      // P3 sRGB transfer to linear P3, then matrix to linear sRGB
      const p3Lin = srgbToLinearRgb(color);
      lin = mulMat3(MAT_P3_TO_LINEAR_SRGB, p3Lin);
      break;
    }
    case 'acescg':
      lin = mulMat3(MAT_ACESCG_TO_LINEAR_SRGB, color);
      break;
  }

  // Then convert from Linear sRGB to `to`
  switch (to) {
    case 'linear-srgb':
      return lin;
    case 'srgb':
      return linearRgbToSrgb(lin);
    case 'rec709':
      // BT.709 gamma 1/2.4
      return [
        Math.pow(Math.max(0, lin[0]), 1 / 2.4),
        Math.pow(Math.max(0, lin[1]), 1 / 2.4),
        Math.pow(Math.max(0, lin[2]), 1 / 2.4),
      ];
    case 'display-p3': {
      const p3Lin = mulMat3(MAT_LINEAR_SRGB_TO_P3, lin);
      return linearRgbToSrgb(p3Lin);
    }
    case 'acescg':
      return mulMat3(MAT_LINEAR_SRGB_TO_ACESCG, lin);
  }
}

// -----------------------------------------------------------------------------
// Film Color Grading: ASC CDL, Lift/Gamma/Gain, Vibrance, White Balance
// -----------------------------------------------------------------------------

export interface AscCdl {
  /** Multiplicative scaling (default [1, 1, 1]) */
  slope?: ColorRGB;
  /** Additive offset (default [0, 0, 0]) */
  offset?: ColorRGB;
  /** Exponential power (default [1, 1, 1]) */
  power?: ColorRGB;
  /** Master saturation (default 1.0) */
  saturation?: number;
}

/**
 * Standard ASC CDL (American Society of Cinematographers Color Decision List).
 * Formula: out = (in * slope + offset)^power, followed by Rec.709 luma-weighted saturation.
 */
export function applyAscCdl(color: ColorRGB, cdl: AscCdl): ColorRGB {
  const slope = cdl.slope ?? [1, 1, 1];
  const offset = cdl.offset ?? [0, 0, 0];
  const power = cdl.power ?? [1, 1, 1];
  const sat = cdl.saturation ?? 1.0;

  let r = Math.pow(Math.max(0, color[0] * slope[0] + offset[0]), power[0]);
  let g = Math.pow(Math.max(0, color[1] * slope[1] + offset[1]), power[1]);
  let b = Math.pow(Math.max(0, color[2] * slope[2] + offset[2]), power[2]);

  if (sat !== 1.0) {
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + sat * (r - luma);
    g = luma + sat * (g - luma);
    b = luma + sat * (b - luma);
  }

  return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
}

export interface LiftGammaGain {
  /** Shadows adjustment (default [0, 0, 0]) */
  lift?: ColorRGB;
  /** Midtones gamma adjustment (default [1, 1, 1]) */
  gamma?: ColorRGB;
  /** Highlights gain adjustment (default [1, 1, 1]) */
  gain?: ColorRGB;
}

/**
 * Three-way Lift / Gamma / Gain film color grading.
 * Formula: out = (gain * (in + lift * (1 - in)))^(1 / gamma)
 */
export function applyLiftGammaGain(color: ColorRGB, lgg: LiftGammaGain): ColorRGB {
  const lift = lgg.lift ?? [0, 0, 0];
  const gamma = lgg.gamma ?? [1, 1, 1];
  const gain = lgg.gain ?? [1, 1, 1];

  const processChannel = (val: number, l: number, gm: number, gn: number): number => {
    const lifted = val + l * (1.0 - val);
    const gained = Math.max(0, lifted * gn);
    const safeGamma = Math.max(1e-4, gm);
    return Math.pow(gained, 1.0 / safeGamma);
  };

  return [
    processChannel(color[0], lift[0], gamma[0], gain[0]),
    processChannel(color[1], lift[1], gamma[1], gain[1]),
    processChannel(color[2], lift[2], gamma[2], gain[2]),
  ];
}

/**
 * Vibrance adjustment with skin tone protection.
 * Selectively boosts muted colors while preventing already saturated colors and skin tones
 * from clipping.
 * @param amount Vibrance delta in [-1..1]
 */
export function applyVibrance(color: ColorRGB, amount: number): ColorRGB {
  if (Math.abs(amount) < 1e-4) return [...color];

  const [r, g, b] = color;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC > 1e-5 ? (maxC - minC) / maxC : 0;

  // Protect warm skin tones (hue around red/orange/yellow: r > g > b)
  let skinProtection = 1.0;
  if (r > g && g > b) {
    const skinFactor = (g - b) / (r - b + 1e-5);
    skinProtection = Math.max(0.2, 1.0 - skinFactor * 0.5);
  }

  // Weight inversely proportional to current saturation
  const boost = amount * (1.0 - sat) * skinProtection;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const newR = Math.max(0, Math.min(1, luma + (1 + boost) * (r - luma)));
  const newG = Math.max(0, Math.min(1, luma + (1 + boost) * (g - luma)));
  const newB = Math.max(0, Math.min(1, luma + (1 + boost) * (b - luma)));

  return [newR, newG, newB];
}

/**
 * Calculates RGB multiplier from Kelvin blackbody color temperature and green/magenta tint.
 * @param kelvin Temperature in Kelvin [2000..12000], D65 neutral is 6500K.
 * @param tint Green/magenta shift in [-100..100] (0 = neutral).
 */
export function getWhiteBalanceGains(kelvin: number, tint = 0): ColorRGB {
  const k = Math.max(2000, Math.min(12000, kelvin)) / 100.0;

  let r: number;
  let g: number;
  let b: number;

  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = 255;
  }

  // Normalize D65 (6500K) to [1, 1, 1]
  const d65R = 255;
  const d65G = 250.7;
  const d65B = 255;

  let gainR = r / d65R;
  let gainG = g / d65G;
  let gainB = b / d65B;

  // Tint adjustment (green vs magenta)
  const tintFactor = tint / 100.0;
  gainG *= 1.0 - tintFactor * 0.15;
  gainR *= 1.0 + tintFactor * 0.05;
  gainB *= 1.0 + tintFactor * 0.05;

  return [gainR, gainG, gainB];
}

// -----------------------------------------------------------------------------
// GLSL Shaders
// -----------------------------------------------------------------------------

/**
 * Self-contained GLSL functions for fast Oklab <-> Linear sRGB transforms.
 */
export function getOklabGLSL(): string {
  return `
// Oklab <-> Linear sRGB (Björn Ottosson)
vec3 flair_linear_to_oklab(vec3 c) {
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 flair_oklab_to_linear(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}
`.trim();
}

/**
 * Self-contained GLSL functions for ASC CDL and Lift/Gamma/Gain grading.
 */
export function getColorGradingGLSL(): string {
  return `
// ASC CDL Grading
vec3 flair_cdl(vec3 color, vec3 slope, vec3 offset, vec3 power, float sat) {
  vec3 c = pow(max(color * slope + offset, vec3(0.0)), power);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), c, sat);
}

// 3-Way Lift / Gamma / Gain Grading
vec3 flair_lift_gamma_gain(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
  vec3 lifted = color + lift * (vec3(1.0) - color);
  vec3 gained = max(lifted * gain, vec3(0.0));
  return pow(gained, 1.0 / max(gamma, vec3(0.0001)));
}
`.trim();
}
