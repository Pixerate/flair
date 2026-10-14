/**
 * Keyframe velocity and cubic Bezier easing engine matching Adobe After Effects interpolation semantics.
 *
 * Temporal interpolation between two keyframes is characterized by:
 * - Speed (units / second)
 * - Influence (fraction 0..1, corresponding to 0.1%..100% in the Keyframe Velocity dialog)
 *
 * For normalized values going from 0 to 1 over a segment, easeProgress(outSpeedNorm, outInf, inSpeedNorm, inInf, x)
 * solves the monotone cubic Bezier root x(u) = x and computes value y(u).
 */

export interface KeyframeEase {
  /** Speed in value units per second (or normalized speed if evaluating normalized segment). */
  speed: number;
  /** Influence as a fraction between 0.0 and 1.0 (e.g. 0.3333 for 33.33%). */
  influence: number;
}

/** Easy Ease preset: 0 speed, 33.333% influence. */
export const EASY_EASE: KeyframeEase = {
  speed: 0,
  influence: 1 / 3,
};

/** Evaluates a 1D cubic Bezier polynomial at parameter u in [0, 1]. */
export function bez1d(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const v = 1.0 - u;
  return v * v * v * p0 + 3.0 * v * v * u * p1 + 3.0 * v * u * u * p2 + u * u * u * p3;
}

/** Evaluates the first derivative of a 1D cubic Bezier polynomial at parameter u. */
export function bez1dDerivative(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const v = 1.0 - u;
  return 3.0 * v * v * (p1 - p0) + 6.0 * v * u * (p2 - p1) + 3.0 * u * u * (p3 - p2);
}

/**
 * Solves bez1d(x0, x1, x2, x3, u) = x for u in [0, 1] assuming x(u) is monotone.
 * Uses closed-form inverse for 100% influence midpoint, Newton-Raphson iteration,
 * and high-precision bisection fallback.
 */
export function solveBezierU(x0: number, x1: number, x2: number, x3: number, x: number): number {
  if (x <= x0) return 0.0;
  if (x >= x3) return 1.0;

  // Closed-form solution for 100% influence on both sides (x1 === x3 && x2 === x0).
  // x(u) = x0 + (x3 - x0) * (0.5 + 4 * (u - 0.5)^3)
  if (Math.abs(x1 - x3) < 1e-12 && Math.abs(x2 - x0) < 1e-12) {
    const progress = (x - x0) / (x3 - x0);
    return 0.5 + Math.cbrt((progress - 0.5) * 0.25);
  }

  // Initial estimate
  let u = (x - x0) / (x3 - x0);

  // Up to 8 Newton-Raphson iterations
  for (let iter = 0; iter < 8; iter++) {
    const f = bez1d(x0, x1, x2, x3, u) - x;
    const d = bez1dDerivative(x0, x1, x2, x3, u);
    if (Math.abs(d) < 1e-12) break;
    if (Math.abs(f / d) < 1e-12) return u;
    const nextU = u - f / d;
    if (nextU < 0.0 || nextU > 1.0) break;
    u = nextU;
  }

  // Bisection fallback for robustness
  let lo = 0.0;
  let hi = 1.0;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) * 0.5;
    if (bez1d(x0, x1, x2, x3, mid) < x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) * 0.5;
}

/**
 * Fraction of progress 0..1 through a 1D Bezier temporal segment whose value goes from 0 to 1,
 * with normalized out/in speeds (speed * duration / deltaValue) and influences.
 *
 * @param outSpeedNorm Normalized outgoing speed (speed * duration / deltaValue).
 * @param outInfluence Outgoing influence fraction [0, 1].
 * @param inSpeedNorm Normalized incoming speed (speed * duration / deltaValue).
 * @param inInfluence Incoming influence fraction [0, 1].
 * @param x Normalized time progress in segment [0, 1].
 */
export function easeProgress(
  outSpeedNorm: number,
  outInfluence: number,
  inSpeedNorm: number,
  inInfluence: number,
  x: number,
): number {
  const i0 = Math.min(1.0, Math.max(0.0, outInfluence));
  const i1 = Math.min(1.0, Math.max(0.0, inInfluence));
  const u = solveBezierU(0.0, i0, 1.0 - i1, 1.0, x);
  return bez1d(0.0, outSpeedNorm * i0, 1.0 - inSpeedNorm * i1, 1.0, u);
}

/**
 * Evaluates an interpolated keyframe segment between two values over duration.
 *
 * @param from Starting value at t = 0.
 * @param to Ending value at t = duration.
 * @param duration Duration of the keyframe segment in seconds.
 * @param t Current elapsed time in seconds (0 <= t <= duration).
 * @param outEase Outgoing ease specification at start keyframe.
 * @param inEase Incoming ease specification at end keyframe.
 */
export function evaluateKeyframeSegment(
  from: number,
  to: number,
  duration: number,
  t: number,
  outEase: KeyframeEase = EASY_EASE,
  inEase: KeyframeEase = EASY_EASE,
): number {
  if (duration <= 0 || t <= 0) return from;
  if (t >= duration) return to;

  const delta = to - from;
  const x = t / duration;

  // Zero delta: maintain from
  if (Math.abs(delta) < 1e-12) {
    return from;
  }

  const outSpeedNorm = (outEase.speed * duration) / delta;
  const inSpeedNorm = (inEase.speed * duration) / delta;

  const progress = easeProgress(outSpeedNorm, outEase.influence, inSpeedNorm, inEase.influence, x);
  return from + progress * delta;
}
