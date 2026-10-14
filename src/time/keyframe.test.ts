import { describe, it, expect } from 'vitest';
import {
  bez1d,
  bez1dDerivative,
  solveBezierU,
  easeProgress,
  evaluateKeyframeSegment,
  EASY_EASE,
} from './keyframe.js';

describe('Keyframe Easing Engine', () => {
  it('bez1d and derivative evaluate correctly at endpoints', () => {
    expect(bez1d(0, 0.25, 0.75, 1, 0)).toBe(0);
    expect(bez1d(0, 0.25, 0.75, 1, 1)).toBe(1);
    expect(bez1dDerivative(0, 1, 1, 1, 0)).toBeCloseTo(3.0);
  });

  it('solveBezierU finds root for linear identity', () => {
    const u = solveBezierU(0, 1 / 3, 2 / 3, 1, 0.5);
    expect(u).toBeCloseTo(0.5, 6);
  });

  it('maximum influence (100%/100%) resolves flat midpoint time curve without NaN', () => {
    for (const time of [0.5 - 1e-6, 0.5, 0.5 + 1e-6]) {
      const u = 0.5 + Math.cbrt((time - 0.5) / 4.0);
      const expected = bez1d(0.0, 0.0, 1.0, 1.0, u);
      const actual = easeProgress(0.0, 1.0, 0.0, 1.0, time);
      expect(actual).toBeCloseTo(expected, 7);
    }
  });

  it('reproduces EffectCraft & AE keyframe ease ground truth samples', () => {
    // Reference test vector from EffectCraft (docs/fidelity/keyframe-ease.json):
    // From 0 to 100, outSpeed = 0, outInf = 0.8, inSpeed = 0, inInf = 0.8
    const testCases: [number, number, number, number, number, number, [number, number][]][] = [
      [
        0.0,
        100.0,
        0.0,
        0.8,
        0.0,
        0.8,
        [
          [0.1, 0.59243939],
          [0.25, 4.7643803],
          [0.4, 18.4284394],
          [0.75, 95.2356196],
        ],
      ],
      [
        0.0,
        100.0,
        20.0,
        0.8,
        80.0,
        0.6,
        [
          [0.1, 2.2575494],
          [0.25, 6.9984188],
          [0.4, 14.9334636],
          [0.75, 73.8196785],
        ],
      ],
      [
        100.0,
        0.0,
        -20.0,
        0.6,
        -80.0,
        0.8,
        [
          [0.1, 97.6395466],
          [0.25, 91.5970485],
          [0.4, 74.5367957],
          [0.75, 22.3789127],
        ],
      ],
    ];

    for (const [from, to, outSpeed, outInf, inSpeed, inInf, samples] of testCases) {
      for (const [time, expected] of samples) {
        const val = evaluateKeyframeSegment(
          from,
          to,
          1.0, // 1 second segment
          time,
          { speed: outSpeed, influence: outInf },
          { speed: inSpeed, influence: inInf },
        );
        expect(val).toBeCloseTo(expected, 4);
      }
    }
  });

  it('evaluates easy ease preset cleanly', () => {
    const val0 = evaluateKeyframeSegment(10, 50, 2.0, 0.0, EASY_EASE, EASY_EASE);
    const valMid = evaluateKeyframeSegment(10, 50, 2.0, 1.0, EASY_EASE, EASY_EASE);
    const valEnd = evaluateKeyframeSegment(10, 50, 2.0, 2.0, EASY_EASE, EASY_EASE);

    expect(val0).toBe(10);
    expect(valMid).toBeCloseTo(30, 4);
    expect(valEnd).toBe(50);
  });
});
