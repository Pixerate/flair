import { describe, it, expect } from 'vitest';
import {
  ALL_TRANSITION_TYPES,
  sampleTransition,
  blendTransitionPixel,
  getTransitionGLSL,
} from './transition.js';

describe('Procedural Shader Transitions', () => {
  it('covers all transition types with GLSL generators', () => {
    expect(ALL_TRANSITION_TYPES.length).toBe(8);
    for (const type of ALL_TRANSITION_TYPES) {
      const glsl = getTransitionGLSL(type);
      expect(glsl).toContain('vec4 flair_transition');
      expect(glsl).toContain('sampler2D texA');
      expect(glsl).toContain('sampler2D texB');
    }
  });

  it('linearWipe starts at A (weight=0) and ends at B (weight=1)', () => {
    const startCenter = sampleTransition('linearWipe', [0.5, 0.5], 0, { angle: 0 });
    const endCenter = sampleTransition('linearWipe', [0.5, 0.5], 1, { angle: 0 });

    expect(startCenter.weight).toBeCloseTo(0, 2);
    expect(endCenter.weight).toBeCloseTo(1, 2);

    // Left vs right at progress 0.5
    const left = sampleTransition('linearWipe', [0.1, 0.5], 0.5, { angle: 0, feather: 0.05 });
    const right = sampleTransition('linearWipe', [0.9, 0.5], 0.5, { angle: 0, feather: 0.05 });
    // Left side (early in wipe) has wiped to B, right side still on A
    expect(left.weight).toBeGreaterThan(0.9);
    expect(right.weight).toBeLessThan(0.1);
  });

  it('radialIris supports circle, box, and diamond shapes', () => {
    for (const shape of ['circle', 'box', 'diamond'] as const) {
      const atZero = sampleTransition('radialIris', [0.5, 0.5], 0, { shape });
      expect(atZero.weight).toBeCloseTo(0, 2);

      const atFull = sampleTransition('radialIris', [0.5, 0.5], 1, { shape });
      expect(atFull.weight).toBeCloseTo(1, 2);

      // Center opens first
      const centerMid = sampleTransition('radialIris', [0.5, 0.5], 0.4, { shape });
      const cornerMid = sampleTransition('radialIris', [0.95, 0.95], 0.4, { shape });
      expect(centerMid.weight).toBeGreaterThan(cornerMid.weight);
    }
  });

  it('blockDissolve produces deterministic pseudo-random blocks', () => {
    const s1 = sampleTransition('blockDissolve', [0.25, 0.25], 0.5, { seed: 100 });
    const s2 = sampleTransition('blockDissolve', [0.25, 0.25], 0.5, { seed: 100 });
    const s3 = sampleTransition('blockDissolve', [0.25, 0.25], 0.5, { seed: 999 });

    expect(s1.weight).toBe(s2.weight);
    // At boundaries
    const atZero = sampleTransition('blockDissolve', [0.3, 0.7], 0);
    const atOne = sampleTransition('blockDissolve', [0.3, 0.7], 1);
    expect(atZero.weight).toBe(0);
    expect(atOne.weight).toBe(1);
  });

  it('gridWipe respects ordering patterns', () => {
    const ltrEarly = sampleTransition('gridWipe', [0.1, 0.1], 0.3, { order: 'ltr' });
    const ltrLate = sampleTransition('gridWipe', [0.9, 0.9], 0.3, { order: 'ltr' });
    expect(ltrEarly.weight).toBeGreaterThan(ltrLate.weight);
  });

  it('glassWipe produces refractive displacement during mid-transition and progresses from A to B', () => {
    const atStart = sampleTransition('glassWipe', [0.5, 0.5], 0.0);
    expect(atStart.weight).toBeCloseTo(0, 2);

    const atMid = sampleTransition('glassWipe', [0.5, 0.5], 0.5, { amplitude: 0.1 });
    // Coordinate displacement occurs
    expect(atMid.uvA[0] !== 0.5 || atMid.uvA[1] !== 0.5).toBe(true);

    // Near ends, displacement dies down and transitions fully to B
    const atEnd = sampleTransition('glassWipe', [0.5, 0.5], 1.0);
    expect(atEnd.uvA[0]).toBeCloseTo(0.5, 2);
    expect(atEnd.uvA[1]).toBeCloseTo(0.5, 2);
    expect(atEnd.weight).toBeCloseTo(1, 2);
  });

  it('twister twists coordinates around center', () => {
    const mid = sampleTransition('twister', [0.7, 0.5], 0.5);
    // Point should have rotated
    expect(mid.uvA[0]).not.toBeCloseTo(0.7, 2);

    const start = sampleTransition('twister', [0.7, 0.5], 0.0);
    expect(start.uvA[0]).toBeCloseTo(0.7, 2);
    expect(start.uvA[1]).toBeCloseTo(0.5, 2);
  });

  it('lightLeak injects warm optical additive bloom peaking at mid-transition', () => {
    const start = sampleTransition('lightLeak', [0.5, 0.5], 0.0);
    const mid = sampleTransition('lightLeak', [0.5, 0.5], 0.5, { intensity: 2.0 });
    const end = sampleTransition('lightLeak', [0.5, 0.5], 1.0);

    expect(start.additive[0]).toBeCloseTo(0, 3);
    expect(end.additive[0]).toBeCloseTo(0, 3);
    expect(mid.additive[0]).toBeGreaterThan(1.0);
    expect(mid.additive[1]).toBeGreaterThan(0.8);
  });

  it('crossZoom zooms into center and scales coordinates', () => {
    const sample = sampleTransition('crossZoom', [0.8, 0.8], 0.5, { strength: 0.5 });
    // Zoom in pulls UV closer to center [0.5, 0.5]
    expect(sample.uvA[0]).toBeLessThan(0.8);
    expect(sample.uvA[1]).toBeLessThan(0.8);
  });

  it('blendTransitionPixel accurately composites RGBA colors', () => {
    const colA: [number, number, number, number] = [1, 0, 0, 1]; // Red
    const colB: [number, number, number, number] = [0, 0, 1, 1]; // Blue

    const sampleA = { weight: 0, uvA: [0, 0] as [number, number], uvB: [0, 0] as [number, number], additive: [0, 0, 0] as [number, number, number] };
    const sampleB = { weight: 1, uvA: [0, 0] as [number, number], uvB: [0, 0] as [number, number], additive: [0, 0, 0] as [number, number, number] };
    const sampleMid = { weight: 0.5, uvA: [0, 0] as [number, number], uvB: [0, 0] as [number, number], additive: [0.1, 0.1, 0.1] as [number, number, number] };

    expect(blendTransitionPixel(colA, colB, sampleA)).toEqual([1, 0, 0, 1]);
    expect(blendTransitionPixel(colA, colB, sampleB)).toEqual([0, 0, 1, 1]);

    const midRes = blendTransitionPixel(colA, colB, sampleMid);
    expect(midRes[0]).toBeCloseTo(0.6, 2); // 0.5 * 1 + 0.1 additive
    expect(midRes[2]).toBeCloseTo(0.6, 2); // 0.5 * 1 + 0.1 additive
  });
});
