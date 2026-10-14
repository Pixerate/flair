import { describe, it, expect } from 'vitest';
import { evaluateBehavior } from './behavior.js';
import { simulateScene } from './player.js';
import type { Scene } from './types.js';

describe('Declarative Behaviors', () => {
  describe('Oscillate', () => {
    it('evaluates sine oscillation around baseValue or center', () => {
      // amplitude 10, freq 1Hz (period 1s), phase 0
      // at t=0: sin(0) = 0 -> base 5 -> 5
      expect(
        evaluateBehavior(
          { type: 'oscillate', target: 'box', property: 'x', amplitude: 10, frequency: 1 },
          0,
          1,
          5,
        ),
      ).toBeCloseTo(5);

      // at t=0.25s: sin(pi/2) = 1 -> 5 + 10 = 15
      expect(
        evaluateBehavior(
          { type: 'oscillate', target: 'box', property: 'x', amplitude: 10, frequency: 1 },
          0.25,
          1,
          5,
        ),
      ).toBeCloseTo(15);

      // at t=0.75s: sin(3pi/2) = -1 -> 5 - 10 = -5
      expect(
        evaluateBehavior(
          { type: 'oscillate', target: 'box', property: 'x', amplitude: 10, frequency: 1 },
          0.75,
          1,
          5,
        ),
      ).toBeCloseTo(-5);

      // with center specified: center 100, amp 10 -> at t=0.25s = 110
      expect(
        evaluateBehavior(
          { type: 'oscillate', target: 'box', property: 'x', amplitude: 10, frequency: 1, center: 100 },
          0.25,
          1,
          0,
        ),
      ).toBeCloseTo(110);
    });

    it('supports square, triangle, and sawtooth waves', () => {
      // Square wave: positive for first half of period
      const square = evaluateBehavior(
        { type: 'oscillate', target: 'box', property: 'x', wave: 'square', amplitude: 20, frequency: 1 },
        0.25,
        1,
        0,
      );
      expect(square).toBe(20);

      const squareNeg = evaluateBehavior(
        { type: 'oscillate', target: 'box', property: 'x', wave: 'square', amplitude: 20, frequency: 1 },
        0.75,
        1,
        0,
      );
      expect(squareNeg).toBe(-20);

      // Triangle wave: linear ramp between -1 and 1
      const triPeak = evaluateBehavior(
        { type: 'oscillate', target: 'box', property: 'x', wave: 'triangle', amplitude: 10, frequency: 1 },
        0.25,
        1,
        0,
      );
      expect(triPeak).toBeCloseTo(10);

      // Sawtooth wave
      const sawMid = evaluateBehavior(
        { type: 'oscillate', target: 'box', property: 'x', wave: 'sawtooth', amplitude: 10, frequency: 1 },
        0.25,
        1,
        0,
      );
      expect(sawMid).toBeCloseTo(-5);
    });
  });

  describe('Ramp', () => {
    it('interpolates linearly and with easing curves', () => {
      const linear = evaluateBehavior(
        { type: 'ramp', target: 'box', property: 'opacity', from: 0, to: 1, ease: 'linear' },
        0.5,
        1.0,
      );
      expect(linear).toBeCloseTo(0.5);

      const easeIn = evaluateBehavior(
        { type: 'ramp', target: 'box', property: 'opacity', from: 0, to: 1, ease: 'easeIn' },
        0.5,
        1.0,
      );
      expect(easeIn).toBeCloseTo(0.25);

      const easeOut = evaluateBehavior(
        { type: 'ramp', target: 'box', property: 'opacity', from: 0, to: 1, ease: 'easeOut' },
        0.5,
        1.0,
      );
      expect(easeOut).toBeCloseTo(0.75);

      // Clamps at duration end
      const clamped = evaluateBehavior(
        { type: 'ramp', target: 'box', property: 'opacity', from: 0, to: 100 },
        1.5,
        1.0,
      );
      expect(clamped).toBe(100);
    });
  });

  describe('Rate', () => {
    it('applies constant speed change over time', () => {
      // 90 degrees/sec rotation starting from 45 deg
      const r1 = evaluateBehavior(
        { type: 'rate', target: 'wheel', property: 'rotation', rate: 90 },
        0.5,
        2.0,
        45,
      );
      expect(r1).toBeCloseTo(90);

      const r2 = evaluateBehavior(
        { type: 'rate', target: 'wheel', property: 'rotation', rate: 90 },
        2.0,
        2.0,
        45,
      );
      expect(r2).toBeCloseTo(225);
    });
  });

  describe('Wriggle', () => {
    it('generates smooth bounded organic deviation deterministically', () => {
      const b1 = evaluateBehavior(
        { type: 'wriggle', target: 'box', property: 'y', amount: 50, frequency: 2, seed: 123 },
        0.3,
        1.0,
        100,
      );
      const b2 = evaluateBehavior(
        { type: 'wriggle', target: 'box', property: 'y', amount: 50, frequency: 2, seed: 123 },
        0.3,
        1.0,
        100,
      );
      // Determinism across same inputs
      expect(b1).toBe(b2);

      // Bound check
      expect(Math.abs(b1 - 100)).toBeLessThanOrEqual(50.001);

      // Different time gives different value
      const b3 = evaluateBehavior(
        { type: 'wriggle', target: 'box', property: 'y', amount: 50, frequency: 2, seed: 123 },
        0.7,
        1.0,
        100,
      );
      expect(b3).not.toBe(b1);
    });
  });

  describe('Overshoot', () => {
    it('settles at target value with harmonic damping', () => {
      // Overshoot from 0 to 100
      const mid = evaluateBehavior(
        { type: 'overshoot', target: 'box', property: 'scale', targetValue: 100, startValue: 0, cycles: 2, damping: 3 },
        0.3,
        1.0,
        0,
      );
      // Mid-flight should exceed or approach target
      expect(mid).toBeGreaterThan(0);

      // At end of duration (or beyond), reaches target
      const end = evaluateBehavior(
        { type: 'overshoot', target: 'box', property: 'scale', targetValue: 100, startValue: 0 },
        1.0,
        1.0,
        0,
      );
      expect(end).toBe(100);
    });
  });

  describe('Throw', () => {
    it('simulates inertia with friction deceleration', () => {
      // Throw with v0 = 100, friction = 2
      // x(t) = (100 / 2) * (1 - e^(-2*t)) -> max distance 50
      const t1 = evaluateBehavior(
        { type: 'throw', target: 'ball', property: 'x', initialVelocity: 100, friction: 2 },
        0.5,
        2.0,
        0,
      );
      const t2 = evaluateBehavior(
        { type: 'throw', target: 'ball', property: 'x', initialVelocity: 100, friction: 2 },
        2.0,
        2.0,
        0,
      );
      expect(t1).toBeGreaterThan(0);
      expect(t2).toBeGreaterThan(t1);
      expect(t2).toBeLessThanOrEqual(50);
    });
  });

  describe('Simulation Integration', () => {
    it('updates element properties over shot dwell time', async () => {
      const scene: Scene = {
        name: 'Behavior Demo',
        stage: { width: 800, height: 600 },
        shots: [
          {
            hold: 200,
            run: [
              {
                type: 'create',
                element: {
                  id: 'hero',
                  type: 'rect',
                  x: 100,
                  y: 100,
                  width: 50,
                  height: 50,
                },
              },
            ],
            behaviors: [
              {
                type: 'rate',
                target: 'hero',
                property: 'x',
                rate: 100, // 100 px / sec -> in 0.2s should move ~20px
              },
            ],
          },
        ],
      };

      const { result } = await simulateScene(scene);
      expect(result.ok).toBe(true);
      expect(result.shots).toHaveLength(1);
    });
  });
});
