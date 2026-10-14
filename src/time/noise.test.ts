import { describe, it, expect } from 'vitest';
import {
  hash64,
  mixSeeds,
  unitFloat,
  quinticFade,
  noise1d,
  noise3d,
  fractalWiggle,
} from './noise.js';

describe('Noise & Wiggle Engine', () => {
  it('hash64 produces deterministic avalanche mixing', () => {
    const h1 = hash64(42n);
    const h2 = hash64(42n);
    const h3 = hash64(43n);

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('unitFloat generates numbers in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const u = unitFloat(i);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('quinticFade satisfies C2 boundary conditions', () => {
    expect(quinticFade(0)).toBe(0);
    expect(quinticFade(1)).toBe(1);
    expect(quinticFade(0.5)).toBeCloseTo(0.5, 6);
  });

  it('noise1d is bounded in [-1, 1] and smooth', () => {
    let prev = noise1d(7, 0.0);
    expect(prev).toBeGreaterThanOrEqual(-1.0);
    expect(prev).toBeLessThanOrEqual(1.0);

    for (let i = 1; i <= 500; i++) {
      const x = i * 0.01;
      const v = noise1d(7, x);
      expect(v).toBeGreaterThanOrEqual(-1.0);
      expect(v).toBeLessThanOrEqual(1.0);
      // Continuous: step of 0.01 cannot produce jump > 0.1
      expect(Math.abs(v - prev)).toBeLessThan(0.1);
      prev = v;
    }
  });

  it('noise3d is bounded and handles 3D coordinates', () => {
    const val = noise3d(0.3, 4.2, -7.5, 123);
    expect(val).toBeGreaterThanOrEqual(-1.0);
    expect(val).toBeLessThanOrEqual(1.0);
  });

  it('fractalWiggle stays bounded within theoretical amplitude limit', () => {
    const amp = 50.0;
    // For 1 octave, max magnitude is amp
    for (let i = 0; i < 200; i++) {
      const w1 = fractalWiggle(3.0, amp, 1, 0.5, i / 30.0, 99);
      expect(Math.abs(w1)).toBeLessThanOrEqual(amp + 1e-6);
    }

    // For multi-octaves, geometric sum of amplitudes is amp / (1 - 0.5) = 2 * amp
    for (let i = 0; i < 200; i++) {
      const wMulti = fractalWiggle(2.0, amp, 4, 0.5, i / 30.0, 101);
      expect(Math.abs(wMulti)).toBeLessThanOrEqual(2 * amp + 1e-6);
    }
  });

  it('decorrelates dimensions for 2D/3D camera shake', () => {
    const wX = fractalWiggle(2.0, 10.0, 3, 0.5, 1.25, 42, 0);
    const wY = fractalWiggle(2.0, 10.0, 3, 0.5, 1.25, 42, 1);
    expect(wX).not.toBe(wY);
  });
});
