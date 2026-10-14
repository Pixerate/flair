import type { EasingCurve } from '../time/retiming.js';

export interface BehaviorBase {
  id?: string;
  /** Target element ID or media ID. */
  target: string;
  /** Property on element (e.g. 'x', 'y', 'scale', 'rotation', 'opacity') or uniform on media. */
  property: string;
}

export interface OscillateBehavior extends BehaviorBase {
  type: 'oscillate';
  wave?: 'sine' | 'square' | 'triangle' | 'sawtooth';
  amplitude: number;
  /** Frequency in Hz (cycles per second). */
  frequency: number;
  /** Phase offset in radians (default 0). */
  phase?: number;
  /** Base center value. If undefined, treated as relative offset added to current base value. */
  center?: number;
}

export interface RampBehavior extends BehaviorBase {
  type: 'ramp';
  from?: number;
  to: number;
  ease?: EasingCurve;
}

export interface RateBehavior extends BehaviorBase {
  type: 'rate';
  /** Rate of change per second (e.g. degrees/sec or units/sec). */
  rate: number;
}

export interface WriggleBehavior extends BehaviorBase {
  type: 'wriggle';
  /** Maximum amplitude of deviation. */
  amount: number;
  /** Speed / frequency of variation in Hz. */
  frequency: number;
  /** Number of noise octaves for organic complexity (default: 3). */
  octaves?: number;
  /** Deterministic random seed. */
  seed?: number;
}

export interface OvershootBehavior extends BehaviorBase {
  type: 'overshoot';
  targetValue: number;
  startValue?: number;
  /** Oscillation frequency / cycles (default: 3). */
  cycles?: number;
  /** Damping factor (higher settles faster, default: 4.0). */
  damping?: number;
}

export interface ThrowBehavior extends BehaviorBase {
  type: 'throw';
  /** Initial speed in units per second. */
  initialVelocity: number;
  /** Friction / deceleration factor (default: 2.0). */
  friction?: number;
}

export type Behavior =
  | OscillateBehavior
  | RampBehavior
  | RateBehavior
  | WriggleBehavior
  | OvershootBehavior
  | ThrowBehavior;

import { fractalWiggle } from '../time/noise.js';

/**
 * Computes smooth organic 1D multi-octave C2 noise wander matching AE wiggle.
 */
function evaluateWriggle(
  t: number,
  freq: number,
  amount: number,
  octaves = 3,
  seed = 42,
): number {
  return fractalWiggle(freq, amount, octaves, 0.5, t, seed, 0);
}

/**
 * Evaluates the new numeric value for a behavior at a given elapsed time.
 * @param behavior The behavior specification.
 * @param elapsedSec Elapsed time within the shot/behavior duration (in seconds).
 * @param durationSec Total duration of the shot/behavior (in seconds).
 * @param baseValue Initial or fallback value before behavior was applied.
 */
export function evaluateBehavior(
  behavior: Behavior,
  elapsedSec: number,
  durationSec: number,
  baseValue = 0,
): number {
  const t = Math.max(0, elapsedSec);

  switch (behavior.type) {
    case 'oscillate': {
      const freq = behavior.frequency;
      const phase = behavior.phase ?? 0;
      const angle = 2 * Math.PI * freq * t + phase;
      let waveVal = 0;

      switch (behavior.wave) {
        case 'square':
          waveVal = Math.sin(angle) >= 0 ? 1 : -1;
          break;
        case 'triangle':
          waveVal = (2 / Math.PI) * Math.asin(Math.sin(angle));
          break;
        case 'sawtooth': {
          const norm = (angle / (2 * Math.PI)) % 1;
          waveVal = 2 * (norm < 0 ? norm + 1 : norm) - 1;
          break;
        }
        case 'sine':
        default:
          waveVal = Math.sin(angle);
          break;
      }

      const offset = waveVal * behavior.amplitude;
      return behavior.center !== undefined ? behavior.center + offset : baseValue + offset;
    }

    case 'ramp': {
      const from = behavior.from ?? baseValue;
      const to = behavior.to;
      const p = durationSec > 0 ? Math.min(1, Math.max(0, t / durationSec)) : 1;
      let eased = p;

      switch (behavior.ease) {
        case 'easeIn':
          eased = p * p;
          break;
        case 'easeOut':
          eased = p * (2 - p);
          break;
        case 'easeInOut':
          eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
          break;
        case 'linear':
        default:
          eased = p;
          break;
      }

      return from + (to - from) * eased;
    }

    case 'rate': {
      return baseValue + behavior.rate * t;
    }

    case 'wriggle': {
      const wander = evaluateWriggle(
        t,
        behavior.frequency,
        behavior.amount,
        behavior.octaves ?? 3,
        behavior.seed ?? 42,
      );
      return baseValue + wander;
    }

    case 'overshoot': {
      const from = behavior.startValue ?? baseValue;
      const target = behavior.targetValue;
      const cycles = behavior.cycles ?? 3;
      const damping = behavior.damping ?? 4.0;

      if (durationSec <= 0) return target;
      const p = Math.min(1, t / durationSec);
      if (p >= 1) return target;

      // Damped harmonic oscillation: 1 - e^(-damping * p) * cos(cycles * pi * p)
      const envelope = Math.exp(-damping * p);
      const oscillation = Math.cos(cycles * Math.PI * p);
      const progress = 1 - envelope * oscillation;

      return from + (target - from) * progress;
    }

    case 'throw': {
      const v0 = behavior.initialVelocity;
      const k = Math.max(0.001, behavior.friction ?? 2.0);
      // Continuous displacement under linear drag: x(t) = (v0 / k) * (1 - e^(-k * t))
      const displacement = (v0 / k) * (1 - Math.exp(-k * t));
      return baseValue + displacement;
    }
  }
}
