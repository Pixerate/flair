/**
 * Procedural WebGL Fragment Shader Transitions & CPU Compositing.
 * Inspired by professional NLE/After Effects/EffectCraft transitions:
 * Linear Wipe, Radial Iris, Block Dissolve, Grid Wipe, Glass Wipe,
 * Twister, Light Leak, and Cross Zoom.
 */

export type TransitionType =
  | 'linearWipe'
  | 'radialIris'
  | 'blockDissolve'
  | 'gridWipe'
  | 'glassWipe'
  | 'twister'
  | 'lightLeak'
  | 'crossZoom';

export const ALL_TRANSITION_TYPES: readonly TransitionType[] = [
  'linearWipe',
  'radialIris',
  'blockDissolve',
  'gridWipe',
  'glassWipe',
  'twister',
  'lightLeak',
  'crossZoom',
];

export interface LinearWipeOptions {
  /** Angle in degrees clockwise from right (0 = left-to-right, 90 = top-to-bottom). Default: 0 */
  angle?: number;
  /** Feather softness width [0..1]. Default: 0.1 */
  feather?: number;
}

export interface RadialIrisOptions {
  /** Center point in normalized UV coordinates [0..1]. Default: [0.5, 0.5] */
  center?: [number, number];
  /** Geometric iris shape. Default: 'circle' */
  shape?: 'circle' | 'box' | 'diamond';
  /** Feather softness [0..1]. Default: 0.1 */
  feather?: number;
}

export interface BlockDissolveOptions {
  /** Block cell count along width. Default: 32 */
  blockCount?: number;
  /** Pseudo-random seed integer. Default: 1337 */
  seed?: number;
  /** Softness of dissolve per block. Default: 0.05 */
  feather?: number;
}

export interface GridWipeOptions {
  /** Number of grid cells [x, y]. Default: [16, 10] */
  gridSize?: [number, number];
  /** Order in which cells wipe: 'ltr' | 'diagonal' | 'radial' | 'random'. Default: 'diagonal' */
  order?: 'ltr' | 'diagonal' | 'radial' | 'random';
}

export interface GlassWipeOptions {
  /** Angle in degrees. Default: 45 */
  angle?: number;
  /** Wave displacement amplitude. Default: 0.08 */
  amplitude?: number;
  /** Wave frequency. Default: 12.0 */
  frequency?: number;
}

export interface TwisterOptions {
  /** Maximum twist angle in radians. Default: Math.PI * 2 */
  twist?: number;
  /** Center of swirl. Default: [0.5, 0.5] */
  center?: [number, number];
}

export interface LightLeakOptions {
  /** Leak tint RGB [0..1]. Default: [1.0, 0.85, 0.6] (warm golden light) */
  color?: [number, number, number];
  /** Peak intensity of light bloom at progress 0.5. Default: 1.5 */
  intensity?: number;
}

export interface CrossZoomOptions {
  /** Zoom strength. Default: 0.3 */
  strength?: number;
  /** Center of zoom. Default: [0.5, 0.5] */
  center?: [number, number];
}

export type TransitionOptions =
  | LinearWipeOptions
  | RadialIrisOptions
  | BlockDissolveOptions
  | GridWipeOptions
  | GlassWipeOptions
  | TwisterOptions
  | LightLeakOptions
  | CrossZoomOptions;

export interface TransitionSample {
  /** Weight of scene B in [0..1] (0 = fully A, 1 = fully B). */
  weight: number;
  /** Sample coordinate for scene A [u, v]. */
  uvA: [number, number];
  /** Sample coordinate for scene B [u, v]. */
  uvB: [number, number];
  /** Additive color light bloom [r, g, b]. */
  additive: [number, number, number];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (Math.abs(edge1 - edge0) < 1e-7) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** 2D integer spatial hash for block dissolve and random grid wipes */
function hash2d(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 362827313) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Evaluates the transition at a given UV coordinate and progress [0..1].
 * Returns displaced UVs, B weight, and any additive optical bloom.
 */
export function sampleTransition(
  type: TransitionType,
  uv: [number, number],
  progress: number,
  options?: TransitionOptions
): TransitionSample {
  const p = clamp01(progress);
  const u = uv[0];
  const v = uv[1];

  switch (type) {
    case 'linearWipe': {
      const opts = (options as LinearWipeOptions) || {};
      const deg = opts.angle ?? 0;
      const feather = Math.max(1e-4, opts.feather ?? 0.1);
      const rad = (deg * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      // Project UV onto normal vector centered at 0.5
      // Max projection span along unit square is sqrt(2) * 0.5
      const proj = (u - 0.5) * dx + (v - 0.5) * dy;
      // Map progress [0, 1] across projected range [-0.707, 0.707]
      const span = Math.abs(dx) + Math.abs(dy); // exact bounding box projection span
      const halfSpan = span * 0.5;
      const edge = -halfSpan - feather + p * (span + 2 * feather);
      const weight = 1 - smoothstep(edge - feather * 0.5, edge + feather * 0.5, proj);

      return { weight, uvA: [u, v], uvB: [u, v], additive: [0, 0, 0] };
    }

    case 'radialIris': {
      const opts = (options as RadialIrisOptions) || {};
      const center = opts.center ?? [0.5, 0.5];
      const shape = opts.shape ?? 'circle';
      const feather = Math.max(1e-4, opts.feather ?? 0.1);

      const du = u - center[0];
      const dv = v - center[1];
      let dist = 0;
      let maxDist = 1;

      if (shape === 'circle') {
        dist = Math.sqrt(du * du + dv * dv);
        // Corner distance from center
        const cdu = Math.max(center[0], 1 - center[0]);
        const cdv = Math.max(center[1], 1 - center[1]);
        maxDist = Math.sqrt(cdu * cdu + cdv * cdv);
      } else if (shape === 'box') {
        dist = Math.max(Math.abs(du), Math.abs(dv));
        maxDist = Math.max(center[0], 1 - center[0], center[1], 1 - center[1]);
      } else {
        // diamond
        dist = Math.abs(du) + Math.abs(dv);
        const cdu = Math.max(center[0], 1 - center[0]);
        const cdv = Math.max(center[1], 1 - center[1]);
        maxDist = cdu + cdv;
      }

      const radius = p * (maxDist + feather);
      const weight = 1 - smoothstep(radius - feather, radius, dist);

      return { weight, uvA: [u, v], uvB: [u, v], additive: [0, 0, 0] };
    }

    case 'blockDissolve': {
      const opts = (options as BlockDissolveOptions) || {};
      const count = opts.blockCount ?? 32;
      const seed = opts.seed ?? 1337;
      const feather = Math.max(1e-4, opts.feather ?? 0.05);

      const bx = Math.floor(u * count);
      const by = Math.floor(v * count);
      const h = hash2d(bx, by, seed);

      // Transition occurs as p increases past h
      const edge = p * (1 + feather);
      const weight = smoothstep(h - feather, h, edge);

      return { weight, uvA: [u, v], uvB: [u, v], additive: [0, 0, 0] };
    }

    case 'gridWipe': {
      const opts = (options as GridWipeOptions) || {};
      const [cols, rows] = opts.gridSize ?? [16, 10];
      const order = opts.order ?? 'diagonal';

      const cx = Math.floor(u * cols);
      const cy = Math.floor(v * rows);

      let cellRank = 0;
      if (order === 'ltr') {
        cellRank = (cx + cy * cols) / (cols * rows);
      } else if (order === 'diagonal') {
        cellRank = (cx / (cols - 1 || 1) + cy / (rows - 1 || 1)) * 0.5;
      } else if (order === 'radial') {
        const nx = (cx + 0.5) / cols - 0.5;
        const ny = (cy + 0.5) / rows - 0.5;
        cellRank = Math.sqrt(nx * nx + ny * ny) * Math.SQRT2;
      } else {
        cellRank = hash2d(cx, cy, 42);
      }

      const width = 0.15;
      const weight = smoothstep(cellRank - width, cellRank + width, p * (1 + 2 * width) - width);

      return { weight, uvA: [u, v], uvB: [u, v], additive: [0, 0, 0] };
    }

    case 'glassWipe': {
      const opts = (options as GlassWipeOptions) || {};
      const deg = opts.angle ?? 45;
      const amp = opts.amplitude ?? 0.08;
      const freq = opts.frequency ?? 12.0;

      const rad = (deg * Math.PI) / 180;
      const nx = Math.cos(rad);
      const ny = Math.sin(rad);

      // Distance along sweep line
      const sweep = (u - 0.5) * nx + (v - 0.5) * ny;
      const waveCenter = (p - 0.5) * 1.6;
      const waveDist = sweep - waveCenter;

      // Bell curve packet around the wavefront with non-zero peak at the wavefront
      const envelope = Math.exp(-waveDist * waveDist * 30);
      const disp = Math.cos(waveDist * freq) * amp * envelope;

      const uvA: [number, number] = [clamp01(u + disp * ny), clamp01(v - disp * nx)];
      const uvB: [number, number] = [clamp01(u - disp * ny), clamp01(v + disp * nx)];
      const weight = smoothstep(-0.1, 0.1, waveDist);

      return { weight, uvA, uvB, additive: [0, 0, 0] };
    }

    case 'twister': {
      const opts = (options as TwisterOptions) || {};
      const maxTwist = opts.twist ?? Math.PI * 2;
      const center = opts.center ?? [0.5, 0.5];

      const du = u - center[0];
      const dv = v - center[1];
      const dist = Math.sqrt(du * du + dv * dv);

      // Twist angle peaks at progress 0.5
      const angle = (1 - Math.cos(p * Math.PI * 2)) * 0.5 * maxTwist * Math.max(0, 1 - dist);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const ru = du * cosA - dv * sinA + center[0];
      const rv = du * sinA + dv * cosA + center[1];

      const weight = smoothstep(0.4, 0.6, p);
      return {
        weight,
        uvA: [clamp01(ru), clamp01(rv)],
        uvB: [clamp01(ru), clamp01(rv)],
        additive: [0, 0, 0],
      };
    }

    case 'lightLeak': {
      const opts = (options as LightLeakOptions) || {};
      const color = opts.color ?? [1.0, 0.85, 0.6];
      const intensity = opts.intensity ?? 1.5;

      // Light flash peaks symmetrically at progress 0.5
      const peak = Math.sin(p * Math.PI);
      const leak = Math.pow(peak, 3) * intensity;
      const additive: [number, number, number] = [
        color[0] * leak,
        color[1] * leak,
        color[2] * leak,
      ];

      const weight = smoothstep(0.3, 0.7, p);
      return { weight, uvA: [u, v], uvB: [u, v], additive };
    }

    case 'crossZoom': {
      const opts = (options as CrossZoomOptions) || {};
      const str = opts.strength ?? 0.3;
      const center = opts.center ?? [0.5, 0.5];

      const du = u - center[0];
      const dv = v - center[1];

      // Zoom in on A up to 0.5, zoom out on B from 0.5 to 1.0
      const zoomA = 1 + p * str;
      const zoomB = 1 + (1 - p) * str;

      const uvA: [number, number] = [
        clamp01(center[0] + du / zoomA),
        clamp01(center[1] + dv / zoomA),
      ];
      const uvB: [number, number] = [
        clamp01(center[0] + du / zoomB),
        clamp01(center[1] + dv / zoomB),
      ];

      const weight = smoothstep(0.4, 0.6, p);
      return { weight, uvA, uvB, additive: [0, 0, 0] };
    }
  }
}

/**
 * CPU Compositing: blends two RGBA pixels across a transition.
 */
export function blendTransitionPixel(
  colA: [number, number, number, number],
  colB: [number, number, number, number],
  sample: TransitionSample
): [number, number, number, number] {
  const w = sample.weight;
  const invW = 1 - w;

  const r = clamp01(colA[0] * invW + colB[0] * w + sample.additive[0]);
  const g = clamp01(colA[1] * invW + colB[1] * w + sample.additive[1]);
  const b = clamp01(colA[2] * invW + colB[2] * w + sample.additive[2]);
  const a = clamp01(colA[3] * invW + colB[3] * w);

  return [r, g, b, a];
}

/**
 * Returns self-contained WebGL GLSL fragment shader code implementing
 * the selected transition function.
 * Signature: `vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress)`
 */
export function getTransitionGLSL(type: TransitionType): string {
  switch (type) {
    case 'linearWipe':
      return `
// Flair Transition: Linear Wipe
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  float feather = 0.1;
  float span = 1.0;
  float edge = -0.5 - feather + p * (span + 2.0 * feather);
  float proj = uv.x - 0.5;
  float w = 1.0 - smoothstep(edge - feather * 0.5, edge + feather * 0.5, proj);
  vec4 a = texture2D(texA, uv);
  vec4 b = texture2D(texB, uv);
  return mix(a, b, w);
}
`.trim();

    case 'radialIris':
      return `
// Flair Transition: Radial Iris
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  float dist = distance(uv, vec2(0.5));
  float maxDist = 0.70710678;
  float radius = p * (maxDist + 0.1);
  float w = 1.0 - smoothstep(radius - 0.1, radius, dist);
  vec4 a = texture2D(texA, uv);
  vec4 b = texture2D(texB, uv);
  return mix(a, b, w);
}
`.trim();

    case 'blockDissolve':
      return `
// Flair Transition: Block Dissolve
float flair_hash(vec2 p) {
  vec2 k = vec2(0.3183099, 0.3678794);
  p = p * k + vec2(k.y, k.x);
  return fract(16.0 * k.x * fract(p.x * p.y * (p.x + p.y)));
}

vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  float blocks = 32.0;
  vec2 cell = floor(uv * blocks);
  float h = flair_hash(cell);
  float w = smoothstep(h - 0.05, h, p * 1.05);
  vec4 a = texture2D(texA, uv);
  vec4 b = texture2D(texB, uv);
  return mix(a, b, w);
}
`.trim();

    case 'gridWipe':
      return `
// Flair Transition: Grid Wipe
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  vec2 grid = vec2(16.0, 10.0);
  vec2 cell = floor(uv * grid) / grid;
  float rank = (cell.x + cell.y) * 0.5;
  float w = smoothstep(rank - 0.15, rank + 0.15, p * 1.3 - 0.15);
  vec4 a = texture2D(texA, uv);
  vec4 b = texture2D(texB, uv);
  return mix(a, b, w);
}
`.trim();

    case 'glassWipe':
      return `
// Flair Transition: Glass Wipe
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  float sweep = (uv.x - 0.5) * 0.7071 + (uv.y - 0.5) * 0.7071;
  float waveCenter = (p - 0.5) * 1.6;
  float waveDist = sweep - waveCenter;
  float envelope = exp(-waveDist * waveDist * 30.0);
  float disp = sin(waveDist * 12.0) * 0.08 * envelope;
  vec2 uvA = clamp(uv + vec2(disp * 0.7071, -disp * 0.7071), 0.0, 1.0);
  vec2 uvB = clamp(uv - vec2(disp * 0.7071, -disp * 0.7071), 0.0, 1.0);
  float w = smoothstep(-0.1, 0.1, waveDist);
  vec4 a = texture2D(texA, uvA);
  vec4 b = texture2D(texB, uvB);
  return mix(a, b, w);
}
`.trim();

    case 'twister':
      return `
// Flair Transition: Twister
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  vec2 d = uv - vec2(0.5);
  float dist = length(d);
  float angle = (1.0 - cos(p * 6.2831853)) * 0.5 * 6.2831853 * max(0.0, 1.0 - dist);
  float c = cos(angle);
  float s = sin(angle);
  vec2 ruv = clamp(vec2(d.x * c - d.y * s, d.x * s + d.y * c) + vec2(0.5), 0.0, 1.0);
  float w = smoothstep(0.4, 0.6, p);
  vec4 a = texture2D(texA, ruv);
  vec4 b = texture2D(texB, ruv);
  return mix(a, b, w);
}
`.trim();

    case 'lightLeak':
      return `
// Flair Transition: Light Leak
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  float peak = sin(p * 3.14159265);
  float leak = pow(peak, 3.0) * 1.5;
  vec3 tint = vec3(1.0, 0.85, 0.6) * leak;
  float w = smoothstep(0.3, 0.7, p);
  vec4 a = texture2D(texA, uv);
  vec4 b = texture2D(texB, uv);
  vec4 res = mix(a, b, w);
  return vec4(clamp(res.rgb + tint, 0.0, 1.0), res.a);
}
`.trim();

    case 'crossZoom':
      return `
// Flair Transition: Cross Zoom
vec4 flair_transition(sampler2D texA, sampler2D texB, vec2 uv, float progress) {
  float p = clamp(progress, 0.0, 1.0);
  vec2 d = uv - vec2(0.5);
  float zA = 1.0 + p * 0.3;
  float zB = 1.0 + (1.0 - p) * 0.3;
  vec2 uvA = clamp(vec2(0.5) + d / zA, 0.0, 1.0);
  vec2 uvB = clamp(vec2(0.5) + d / zB, 0.0, 1.0);
  float w = smoothstep(0.4, 0.6, p);
  vec4 a = texture2D(texA, uvA);
  vec4 b = texture2D(texB, uvB);
  return mix(a, b, w);
}
`.trim();
  }
}
