import { describe, it, expect } from 'vitest';
import { effectGone, effectOpacity, type RunningEffect } from './effects.js';

describe('effects', () => {
  it('detects when an effect is gone after until + fade', () => {
    const running: RunningEffect = {
      effect: { type: 'glow', id: 'g1', ids: ['box'] },
      from: 1000,
      until: 2000,
    };

    expect(effectGone(running, 1500)).toBe(false);
    expect(effectGone(running, 2200)).toBe(false);
    expect(effectGone(running, 2300)).toBe(true);
  });

  it('computes effect opacity with fade in and fade out', () => {
    const running: RunningEffect = {
      effect: { type: 'ripple', id: 'r1', ids: ['star'], duration: 1000 },
      from: 100,
    };

    expect(effectOpacity(running, 50)).toBe(0);
    expect(effectOpacity(running, 250)).toBe(1);
    expect(effectOpacity(running, 1000)).toBe(1);
    expect(effectOpacity(running, 1250)).toBeCloseTo(0.5, 1);
    expect(effectOpacity(running, 1400)).toBe(0);
  });
});
