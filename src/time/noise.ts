/**
 * Deterministic pseudo-random number generator, hash mixing, and C2-continuous smooth value noise.
 * Based on 64-bit SplitMix64 mixing and quintic Hermite interpolation.
 *
 * Produces deterministic, platform-independent outputs for wiggle, organic turbulence, and camera shake.
 */

// BigInt constants for SplitMix64
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;
const MULT1 = 0xbf58476d1ce4e5b9n;
const MULT2 = 0x94d049bb133111ebn;
const MASK64 = 0xffffffffffffffffn;
const BASE_MIX = 0x2545f4914f6cdd1dn;
const POW2_53 = 9007199254740992; // 2^53

/**
 * SplitMix64 mixing finalizer: maps any 64-bit integer to a high-quality pseudorandom 64-bit integer.
 */
export function hash64(x: bigint): bigint {
  let v = (x + GOLDEN_GAMMA) & MASK64;
  v = ((v ^ (v >> 30n)) * MULT1) & MASK64;
  v = ((v ^ (v >> 27n)) * MULT2) & MASK64;
  return (v ^ (v >> 31n)) & MASK64;
}

/**
 * Combines multiple seed numbers/bigints into a single mixed 64-bit seed.
 */
export function mixSeeds(parts: (bigint | number)[]): bigint {
  let h = BASE_MIX;
  for (const p of parts) {
    const val = typeof p === 'bigint' ? p : BigInt(Math.floor(p));
    h = hash64(h ^ hash64(val & MASK64));
  }
  return h;
}

/**
 * Maps a 64-bit seed to a uniform float in [0, 1).
 */
export function unitFloat(seed: bigint | number): number {
  const s = typeof seed === 'bigint' ? seed : BigInt(Math.floor(seed));
  const hashed = hash64(s);
  const shifted = Number(hashed >> 11n);
  return shifted / POW2_53;
}

/**
 * Quintic Hermite interpolant fade function: 6t^5 - 15t^4 + 10t^3.
 * First and second derivatives are zero at t = 0 and t = 1, ensuring C2 continuity.
 */
export function quinticFade(t: number): number {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Returns a deterministic pseudo-random lattice value in [-1, 1].
 */
function lattice(seed: bigint, i: bigint): number {
  const mixed = seed ^ hash64(i & MASK64);
  return unitFloat(mixed) * 2.0 - 1.0;
}

/**
 * 1D C2-continuous smooth value noise in [-1, 1].
 * Guaranteed bounded by lattice values, smooth without sudden velocity spikes.
 */
export function noise1d(seed: bigint | number, x: number): number {
  if (!Number.isFinite(x)) return 0.0;
  const s = typeof seed === 'bigint' ? seed : BigInt(Math.floor(seed));
  const floorX = Math.floor(x);
  const u = quinticFade(x - floorX);
  const i = BigInt(Math.floor(floorX));
  const a = lattice(s, i);
  const b = lattice(s, i + 1n);
  return a + (b - a) * u;
}

/**
 * 3D C2-continuous smooth value noise in [-1, 1].
 */
export function noise3d(x: number, y: number, z: number, seed: bigint | number = 0): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return 0.0;
  }
  const s = typeof seed === 'bigint' ? seed : BigInt(Math.floor(seed));
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);

  const u = quinticFade(x - fx);
  const v = quinticFade(y - fy);
  const w = quinticFade(z - fz);

  const ix = BigInt(fx);
  const iy = BigInt(fy);
  const iz = BigInt(fz);

  const g = (dx: bigint, dy: bigint, dz: bigint): number => {
    const combined = mixSeeds([s, ix + dx, iy + dy, iz + dz]);
    return unitFloat(combined) * 2.0 - 1.0;
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const x00 = lerp(g(0n, 0n, 0n), g(1n, 0n, 0n), u);
  const x10 = lerp(g(0n, 1n, 0n), g(1n, 1n, 0n), u);
  const x01 = lerp(g(0n, 0n, 1n), g(1n, 0n, 1n), u);
  const x11 = lerp(g(0n, 1n, 1n), g(1n, 1n, 1n), u);

  const y0 = lerp(x00, x10, v);
  const y1 = lerp(x01, x11, v);

  return lerp(y0, y1, w);
}

/**
 * Evaluates multi-octave fractal noise wiggle:
 * sum_{k=0}^{octaves-1} amp * (ampMult^k) * noise1d(freq * (2^k) * t)
 *
 * Matches the mathematical formulation of After Effects / EffectCraft wiggle().
 *
 * @param freq Oscillation frequency in Hz (cycles per second).
 * @param amp Maximum deviation amplitude.
 * @param octaves Number of noise detail octaves (default: 3).
 * @param ampMult Amplitude multiplier per octave (default: 0.5).
 * @param t Elapsed time in seconds.
 * @param seed Random seed (default: 42).
 * @param dimension Dimension index (0, 1, 2) to ensure decorrelated multi-axis wiggle.
 */
export function fractalWiggle(
  freq: number,
  amp: number,
  octaves = 3,
  ampMult = 0.5,
  t = 0,
  seed = 42,
  dimension = 0,
): number {
  const oct = Math.max(1, Math.min(16, Math.floor(octaves)));
  let currentAmp = amp;
  let currentFreq = freq;
  let sum = 0.0;
  const baseSeed = BigInt(seed);

  for (let k = 0; k < oct; k++) {
    const s = mixSeeds([baseSeed, BigInt(dimension), BigInt(k)]);
    const phaseOffset = unitFloat(s) * 1000.0;
    sum += currentAmp * noise1d(s, currentFreq * t + phaseOffset);
    currentAmp *= ampMult;
    currentFreq *= 2.0;
  }

  return sum;
}
