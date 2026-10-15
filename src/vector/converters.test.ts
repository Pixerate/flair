import { describe, it, expect } from 'vitest';
import { remap, stepVariant, formatUnit } from './converters.js';

describe('remap', () => {
  it('remaps numbers linearly across ranges', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
    expect(remap(0.5, 0, 1, 10, 20)).toBe(15);
  });

  it('inverts ranges gracefully', () => {
    expect(remap(0.2, 0, 1, 100, 0)).toBe(80);
  });

  it('clamps output when requested', () => {
    expect(remap(15, 0, 10, 0, 100, true)).toBe(100);
    expect(remap(-5, 0, 10, 0, 100, true)).toBe(0);
    expect(remap(1.5, 0, 1, 100, 0, true)).toBe(0);
  });
});

describe('stepVariant', () => {
  const variants = ['idle', 'active', 'complete'];

  it('maps progress to variants', () => {
    expect(stepVariant(0, variants)).toBe('idle');
    expect(stepVariant(0.2, variants)).toBe('idle');
    expect(stepVariant(0.5, variants)).toBe('active');
    expect(stepVariant(0.8, variants)).toBe('complete');
    expect(stepVariant(1, variants)).toBe('complete');
  });

  it('handles edge cases', () => {
    expect(stepVariant(0.5, [])).toBeUndefined();
    expect(stepVariant(-0.5, variants)).toBe('idle');
    expect(stepVariant(1.5, variants)).toBe('complete');
  });
});

describe('formatUnit', () => {
  it('formats numbers with fixed decimals and templates', () => {
    expect(formatUnit(42.567, 'number', { decimals: 1 })).toBe('42.6');
    expect(formatUnit(15, 'number', { template: '{n} px' })).toBe('15.00 px');
  });

  it('formats percentages', () => {
    expect(formatUnit(0.75, 'percent')).toBe('75%');
    expect(formatUnit(0.756, 'percent', { decimals: 1 })).toBe('75.6%');
  });

  it('formats currency', () => {
    expect(formatUnit(12.5, 'currency')).toBe('$12.50');
    expect(formatUnit(99, 'currency', { currency: '£', decimals: 0 })).toBe('£99');
  });

  it('formats timecodes mm:ss', () => {
    expect(formatUnit(65, 'timecode')).toBe('01:05');
    expect(formatUnit(9, 'timecode')).toBe('00:09');
    expect(formatUnit(125.8, 'timecode')).toBe('02:05');
  });
});
