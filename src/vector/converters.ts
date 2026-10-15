/**
 * Pure math and formatting converters for driving vector animations and data bindings.
 * Inspired by Rive data converters.
 */

/**
 * Linearly remaps a value from [inMin, inMax] to [outMin, outMax].
 * If clamp is true, clamps the result to [outMin, outMax] (or [outMax, outMin] if inverted).
 */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clamp = false,
): number {
  if (inMax === inMin) return outMin;
  const progress = (value - inMin) / (inMax - inMin);
  let res = outMin + progress * (outMax - outMin);
  if (clamp) {
    const low = Math.min(outMin, outMax);
    const high = Math.max(outMin, outMax);
    res = Math.max(low, Math.min(high, res));
  }
  return res;
}

/**
 * Maps a normalized progress value (0 to 1) into discrete step items.
 */
export function stepVariant<T>(progress: number, steps: readonly T[]): T | undefined {
  if (steps.length === 0) return undefined;
  if (progress <= 0) return steps[0];
  if (progress >= 1) return steps[steps.length - 1];
  const idx = Math.floor(progress * steps.length);
  return steps[Math.min(idx, steps.length - 1)];
}

export type UnitFormat = 'number' | 'percent' | 'currency' | 'timecode';

export interface FormatUnitOptions {
  decimals?: number;
  currency?: string;
  template?: string;
}

/**
 * Formats a numeric value into human-readable strings according to common presentation formats.
 */
export function formatUnit(value: number, format: UnitFormat = 'number', options: FormatUnitOptions = {}): string {
  const decimals = options.decimals ?? (format === 'percent' ? 0 : 2);

  switch (format) {
    case 'number': {
      const formatted = value.toFixed(decimals);
      return options.template ? options.template.replace('{n}', formatted) : formatted;
    }
    case 'percent': {
      const pct = (value * (options.decimals !== undefined ? 100 : 100)).toFixed(decimals);
      return options.template ? options.template.replace('{n}', pct) : `${pct}%`;
    }
    case 'currency': {
      const sym = options.currency ?? '$';
      const amt = value.toFixed(decimals);
      return `${sym}${amt}`;
    }
    case 'timecode': {
      const totalSeconds = Math.max(0, Math.floor(value));
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }
}
