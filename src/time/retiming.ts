/**
 * Retiming math engine inspired by Apple Motion's RetimingMath framework.
 * Provides deterministic time transformation functors for looping, bouncing (ping-pong),
 * freezing (hold), posterizing/stepping (strobe), and non-linear speed ramps.
 */

export type EasingCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

/**
 * Loops time within [start, start + duration).
 * Handles negative time values smoothly.
 */
export function loopTime(t: number, duration: number, start = 0): number {
  if (duration <= 0) return start;
  const rel = t - start;
  const mod = ((rel % duration) + duration) % duration;
  return start + mod;
}

/**
 * Reflects time back and forth (triangle wave) between start and start + duration.
 */
export function pingPongTime(t: number, duration: number, start = 0): number {
  if (duration <= 0) return start;
  const period = 2 * duration;
  const rel = t - start;
  const mod = ((rel % period) + period) % period;
  const offset = mod <= duration ? mod : period - mod;
  return start + offset;
}

/**
 * Freezes time at a specified timestamp.
 */
export function holdTime(_t: number, holdAt: number): number {
  return holdAt;
}

/**
 * Quantizes continuous time into discrete intervals matching a target frame rate (posterize time).
 * @param t Current timestamp.
 * @param fps Target stepped frame rate (e.g. 12 for stop-motion).
 * @param unit 'ms' (default) if t is in milliseconds, or 'sec' if t is in seconds.
 */
export function strobeTime(t: number, fps: number, unit: 'ms' | 'sec' = 'ms'): number {
  if (fps <= 0) return t;
  const interval = (unit === 'ms' ? 1000 : 1) / fps;
  return Math.floor(t / interval) * interval;
}

/**
 * Applies a non-linear speed ramp curve to time progression within an interval [start, start + duration].
 */
export function speedRampTime(
  t: number,
  start: number,
  duration: number,
  ease: EasingCurve = 'easeInOut',
): number {
  if (duration <= 0 || t <= start) return t;
  if (t >= start + duration) return t;

  const p = (t - start) / duration;
  let eased: number;
  switch (ease) {
    case 'linear':
      eased = p;
      break;
    case 'easeIn':
      eased = p * p;
      break;
    case 'easeOut':
      eased = p * (2 - p);
      break;
    case 'easeInOut':
    default:
      eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      break;
  }

  return start + eased * duration;
}
