/**
 * 38 Layer Blend Modes for Compositing and WebGL Shader Generation.
 * Mathematically matching Adobe After Effects & EffectCraft blending standards.
 */

export type BlendMode =
  | 'normal'
  | 'dissolve'
  | 'dancingDissolve'
  | 'darken'
  | 'multiply'
  | 'colorBurn'
  | 'classicColorBurn'
  | 'linearBurn'
  | 'darkerColor'
  | 'add'
  | 'lighten'
  | 'screen'
  | 'colorDodge'
  | 'classicColorDodge'
  | 'linearDodge'
  | 'lighterColor'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'linearLight'
  | 'vividLight'
  | 'pinLight'
  | 'hardMix'
  | 'difference'
  | 'classicDifference'
  | 'exclusion'
  | 'subtract'
  | 'divide'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'
  | 'stencilAlpha'
  | 'stencilLuma'
  | 'silhouetteAlpha'
  | 'silhouetteLuma'
  | 'alphaAdd'
  | 'luminescentPremul';

export const ALL_BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'dissolve',
  'dancingDissolve',
  'darken',
  'multiply',
  'colorBurn',
  'classicColorBurn',
  'linearBurn',
  'darkerColor',
  'add',
  'lighten',
  'screen',
  'colorDodge',
  'classicColorDodge',
  'linearDodge',
  'lighterColor',
  'overlay',
  'softLight',
  'hardLight',
  'linearLight',
  'vividLight',
  'pinLight',
  'hardMix',
  'difference',
  'classicDifference',
  'exclusion',
  'subtract',
  'divide',
  'hue',
  'saturation',
  'color',
  'luminosity',
  'stencilAlpha',
  'stencilLuma',
  'silhouetteAlpha',
  'silhouetteLuma',
  'alphaAdd',
  'luminescentPremul',
];

export type ColorRgba = [number, number, number, number];

function lum(r: number, g: number, b: number): number {
  return 0.3 * r + 0.59 * g + 0.11 * b;
}

function sat(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function clipColor(r: number, g: number, b: number): [number, number, number] {
  const l = lum(r, g, b);
  const n = Math.min(r, g, b);
  const x = Math.max(r, g, b);
  let cr = r;
  let cg = g;
  let cb = b;
  if (n < 0.0) {
    const denom = Math.max(1e-9, l - n);
    cr = l + ((cr - l) * l) / denom;
    cg = l + ((cg - l) * l) / denom;
    cb = l + ((cb - l) * l) / denom;
  }
  if (x > 1.0) {
    const denom = Math.max(1e-9, x - l);
    cr = l + ((cr - l) * (1.0 - l)) / denom;
    cg = l + ((cg - l) * (1.0 - l)) / denom;
    cb = l + ((cb - l) * (1.0 - l)) / denom;
  }
  return [cr, cg, cb];
}

function setLum(r: number, g: number, b: number, l: number): [number, number, number] {
  const d = l - lum(r, g, b);
  return clipColor(r + d, g + d, b + d);
}

function setSat(r: number, g: number, b: number, s: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn <= 1e-9) return [0, 0, 0];
  const f = (v: number) => ((v - mn) * s) / (mx - mn);
  return [f(r), f(g), f(b)];
}

function burn(cb: number, cs: number): number {
  if (cb >= 1.0) return 1.0;
  if (cs <= 0.0) return 0.0;
  return 1.0 - Math.min(1.0, (1.0 - cb) / cs);
}

function dodge(cb: number, cs: number): number {
  if (cb <= 0.0) return 0.0;
  if (cs >= 1.0) return 1.0;
  return Math.min(1.0, cb / (1.0 - cs));
}

function hardLight(cb: number, cs: number): number {
  if (cs <= 0.5) {
    return cb * 2.0 * cs;
  }
  const s = 2.0 * cs - 1.0;
  return cb + s - cb * s;
}

function softLight(cb: number, cs: number): number {
  if (cs <= 0.5) {
    return cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  }
  const d = cb <= 0.25 ? ((16.0 * cb - 12.0) * cb + 4.0) * cb : Math.sqrt(Math.max(0.0, cb));
  return cb + (2.0 * cs - 1.0) * (d - cb);
}

function vividLight(cb: number, cs: number): number {
  return cs <= 0.5 ? burn(cb, 2.0 * cs) : dodge(cb, 2.0 * (cs - 0.5));
}

function separableBlend(mode: BlendMode, cb: number, cs: number): number {
  switch (mode) {
    case 'darken':
      return Math.min(cb, cs);
    case 'multiply':
      return cb * cs;
    case 'colorBurn':
      return burn(cb, cs);
    case 'classicColorBurn':
      return cs <= 0.0 ? 0.0 : 1.0 - (1.0 - cb) / cs;
    case 'linearBurn':
      return Math.max(0.0, cb + cs - 1.0);
    case 'add':
    case 'linearDodge':
      return cb + cs;
    case 'lighten':
      return Math.max(cb, cs);
    case 'screen':
      return cb + cs - cb * cs;
    case 'colorDodge':
      return dodge(cb, cs);
    case 'classicColorDodge':
      return cs >= 1.0 ? 1.0 : Math.min(1.0, cb / (1.0 - cs));
    case 'overlay':
      return hardLight(cs, cb);
    case 'softLight':
      return softLight(cb, cs);
    case 'hardLight':
      return hardLight(cb, cs);
    case 'linearLight':
      return Math.min(1.0, Math.max(0.0, cb + 2.0 * cs - 1.0));
    case 'vividLight':
      return vividLight(cb, cs);
    case 'pinLight':
      return cs <= 0.5 ? Math.min(cb, 2.0 * cs) : Math.max(cb, 2.0 * cs - 1.0);
    case 'hardMix':
      return cb + cs >= 1.0 ? 1.0 : 0.0;
    case 'difference':
    case 'classicDifference':
      return Math.abs(cb - cs);
    case 'exclusion':
      return cb + cs - 2.0 * cb * cs;
    case 'subtract':
      return Math.max(0.0, cb - cs);
    case 'divide':
      return cs <= 0.0 ? (cb > 0.0 ? 1.0 : 0.0) : cb / cs;
    default:
      return cs;
  }
}

/**
 * Evaluates CPU compositing of premultiplied RGBA source onto premultiplied RGBA destination.
 *
 * @param mode Blend mode to apply.
 * @param dst Destination premultiplied RGBA [r, g, b, a] in [0, 1].
 * @param src Source premultiplied RGBA [r, g, b, a] in [0, 1].
 * @param noise Per-pixel noise parameter in [0, 1] for Dissolve modes (default: 0).
 */
export function blendRgba(
  mode: BlendMode,
  dst: ColorRgba,
  src: ColorRgba,
  noise = 0,
): ColorRgba {
  const sa = src[3];
  const da = dst[3];

  switch (mode) {
    case 'normal': {
      const k = 1.0 - sa;
      return [src[0] + dst[0] * k, src[1] + dst[1] * k, src[2] + dst[2] * k, sa + da * k];
    }
    case 'dissolve':
    case 'dancingDissolve': {
      if (sa <= 0.0 || noise >= sa) return [...dst];
      const inv = 1.0 / sa;
      return [src[0] * inv, src[1] * inv, src[2] * inv, 1.0];
    }
    case 'stencilAlpha':
      return [dst[0] * sa, dst[1] * sa, dst[2] * sa, dst[3] * sa];
    case 'silhouetteAlpha': {
      const k = 1.0 - sa;
      return [dst[0] * k, dst[1] * k, dst[2] * k, dst[3] * k];
    }
    case 'stencilLuma':
    case 'silhouetteLuma': {
      const l = lum(src[0], src[1], src[2]);
      const k = mode === 'stencilLuma' ? l : 1.0 - l;
      return [dst[0] * k, dst[1] * k, dst[2] * k, dst[3] * k];
    }
    case 'alphaAdd': {
      const k = 1.0 - sa;
      return [src[0] + dst[0] * k, src[1] + dst[1] * k, src[2] + dst[2] * k, Math.min(1.0, sa + da)];
    }
    case 'luminescentPremul': {
      const k = 1.0 - sa;
      return [src[0] + dst[0] * k, src[1] + dst[1] * k, src[2] + dst[2] * k, sa + da - sa * da];
    }
  }

  if (sa <= 0.0) return [...dst];
  if (da <= 0.0) return [...src];

  const cs: [number, number, number] = [src[0] / sa, src[1] / sa, src[2] / sa];
  const cb: [number, number, number] = [dst[0] / da, dst[1] / da, dst[2] / da];

  let b: [number, number, number];
  switch (mode) {
    case 'hue':
      b = setLum(...setSat(cs[0], cs[1], cs[2], sat(...cb)), lum(...cb));
      break;
    case 'saturation':
      b = setLum(...setSat(cb[0], cb[1], cb[2], sat(...cs)), lum(...cb));
      break;
    case 'color':
      b = setLum(cs[0], cs[1], cs[2], lum(...cb));
      break;
    case 'luminosity':
      b = setLum(cb[0], cb[1], cb[2], lum(...cs));
      break;
    case 'darkerColor':
      b = lum(...cs) < lum(...cb) ? cs : cb;
      break;
    case 'lighterColor':
      b = lum(...cs) > lum(...cb) ? cs : cb;
      break;
    default:
      b = [
        separableBlend(mode, cb[0], cs[0]),
        separableBlend(mode, cb[1], cs[1]),
        separableBlend(mode, cb[2], cs[2]),
      ];
      break;
  }

  const ao = sa + da - sa * da;
  return [
    (1.0 - da) * src[0] + (1.0 - sa) * dst[0] + sa * da * b[0],
    (1.0 - da) * src[1] + (1.0 - sa) * dst[1] + sa * da * b[1],
    (1.0 - da) * src[2] + (1.0 - sa) * dst[2] + sa * da * b[2],
    ao,
  ];
}

/**
 * Returns a self-contained GLSL shader function for blending two vec4 colors.
 * Useful for runtime GPU compositing across multiple shader layers or passes.
 */
export function getGlslBlendFunction(mode: BlendMode): string {
  switch (mode) {
    case 'multiply':
      return `vec4 blend(vec4 dst, vec4 src) {
  return vec4(src.rgb * dst.rgb * src.a + dst.rgb * (1.0 - src.a), src.a + dst.a * (1.0 - src.a));
}`;
    case 'screen':
      return `vec4 blend(vec4 dst, vec4 src) {
  vec3 res = src.rgb + dst.rgb - src.rgb * dst.rgb;
  return vec4(mix(dst.rgb, res, src.a), src.a + dst.a * (1.0 - src.a));
}`;
    case 'add':
    case 'linearDodge':
      return `vec4 blend(vec4 dst, vec4 src) {
  return vec4(min(vec3(1.0), dst.rgb + src.rgb * src.a), min(1.0, dst.a + src.a));
}`;
    case 'overlay':
      return `vec4 blend(vec4 dst, vec4 src) {
  vec3 res = mix(2.0 * dst.rgb * src.rgb, 1.0 - 2.0 * (1.0 - dst.rgb) * (1.0 - src.rgb), step(vec3(0.5), dst.rgb));
  return vec4(mix(dst.rgb, res, src.a), src.a + dst.a * (1.0 - src.a));
}`;
    case 'difference':
      return `vec4 blend(vec4 dst, vec4 src) {
  return vec4(mix(dst.rgb, abs(dst.rgb - src.rgb), src.a), src.a + dst.a * (1.0 - src.a));
}`;
    case 'normal':
    default:
      return `vec4 blend(vec4 dst, vec4 src) {
  return src + dst * (1.0 - src.a);
}`;
  }
}
