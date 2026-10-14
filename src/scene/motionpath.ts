/**
 * Constant-Velocity Spatial Motion Paths & Arc-Length Parameterization.
 *
 * Implements multi-segment cubic Bezier spatial trajectories with numerical
 * arc-length integration, ensuring constant pixel-speed traversal, tangent heading,
 * normal vectors, curvature, and seamless combination with temporal AE keyframe easing.
 */

import { evaluateKeyframeSegment, type KeyframeEase } from '../time/keyframe.js';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface PathWaypoint {
  /** Anchor position in 2D or 3D scene coordinates [x, y] or [x, y, z]. */
  point: Vec2 | Vec3;
  /** In-tangent handle relative to anchor point (vector pointing from handle to anchor or vice-versa). Default: [0, 0, 0] */
  inTangent?: Vec2 | Vec3;
  /** Out-tangent handle relative to anchor point (vector pointing from anchor toward next handle). Default: [0, 0, 0] */
  outTangent?: Vec2 | Vec3;
}

export interface SpatialPathSample {
  /** Position on curve [x, y, z]. */
  position: Vec3;
  /** Normalized unit tangent vector [dx, dy, dz]. */
  tangent: Vec3;
  /** 2D heading angle in radians (atan2(dy, dx)). */
  heading: number;
  /** 2D unit normal vector [-dy, dx, 0]. */
  normal: Vec3;
  /** Instantaneous curvature kappa (1 / radius of curvature). */
  curvature: number;
  /** Distance traversed along the path in absolute units. */
  distance: number;
}

interface SegmentSample {
  t: number;
  s: number;
  pos: Vec3;
}

interface PathSegment {
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
  length: number;
  samples: SegmentSample[];
}

export interface SpatialMotionPath {
  waypoints: PathWaypoint[];
  closed: boolean;
  totalLength: number;
  segments: PathSegment[];
}

function toVec3(p: Vec2 | Vec3 | undefined): Vec3 {
  if (!p) return [0, 0, 0];
  return [p[0], p[1], p[2] ?? 0];
}

function cubicPos(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

function cubicVel(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const a = -3 * u * u;
  const b = 3 * u * u - 6 * u * t;
  const c = 6 * u * t - 3 * t * t;
  const d = 3 * t * t;

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

function cubicAcc(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const a = 6 * u;
  const b = -12 * u + 6 * t;
  const c = 6 * u - 12 * t;
  const d = 6 * t;

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Creates and compiles a constant-velocity SpatialMotionPath from a sequence of waypoints.
 * Computes fine-grained arc-length tables along all Bezier segments.
 */
export function createMotionPath(
  waypoints: PathWaypoint[],
  options?: { closed?: boolean; resolution?: number }
): SpatialMotionPath {
  if (waypoints.length < 2) {
    throw new Error('SpatialMotionPath requires at least 2 waypoints.');
  }

  const closed = options?.closed ?? false;
  const segmentCount = closed ? waypoints.length : waypoints.length - 1;
  const segments: PathSegment[] = [];
  let totalLength = 0;

  for (let i = 0; i < segmentCount; i++) {
    const nextIdx = (i + 1) % waypoints.length;
    const w0 = waypoints[i];
    const w1 = waypoints[nextIdx];

    const p0 = toVec3(w0.point);
    const outT = toVec3(w0.outTangent);
    const p1: Vec3 = [p0[0] + outT[0], p0[1] + outT[1], p0[2] + outT[2]];

    const p3 = toVec3(w1.point);
    const inT = toVec3(w1.inTangent);
    const p2: Vec3 = [p3[0] + inT[0], p3[1] + inT[1], p3[2] + inT[2]];

    // Chord length estimate
    const chord = dist3(p0, p1) + dist3(p1, p2) + dist3(p2, p3);
    const stepCount = Math.max(16, Math.min(256, Math.ceil(chord / (options?.resolution ?? 2))));

    const samples: SegmentSample[] = [];
    let segLen = 0;
    let prev = p0;
    samples.push({ t: 0, s: 0, pos: p0 });

    for (let k = 1; k <= stepCount; k++) {
      const t = k / stepCount;
      const pos = cubicPos(p0, p1, p2, p3, t);
      segLen += dist3(prev, pos);
      samples.push({ t, s: segLen, pos });
      prev = pos;
    }

    segments.push({
      p0,
      p1,
      p2,
      p3,
      length: segLen,
      samples,
    });
    totalLength += segLen;
  }

  return {
    waypoints,
    closed,
    totalLength,
    segments,
  };
}

/**
 * Samples the spatial motion path at a normalized distance fraction [0..1].
 * Guarantees strictly constant pixel speed regardless of control handle asymmetry.
 */
export function sampleMotionPath(path: SpatialMotionPath, distanceFraction: number): SpatialPathSample {
  const clampedFraction = Math.max(0, Math.min(1, distanceFraction));
  const targetDistance = clampedFraction * path.totalLength;

  if (path.totalLength === 0) {
    const p = toVec3(path.waypoints[0].point);
    return {
      position: p,
      tangent: [1, 0, 0],
      heading: 0,
      normal: [0, 1, 0],
      curvature: 0,
      distance: 0,
    };
  }

  // Find target segment
  let accumulated = 0;
  let targetSeg = path.segments[0];
  let segDistance = targetDistance;

  for (const seg of path.segments) {
    if (accumulated + seg.length >= targetDistance || seg === path.segments[path.segments.length - 1]) {
      targetSeg = seg;
      segDistance = Math.max(0, Math.min(seg.length, targetDistance - accumulated));
      break;
    }
    accumulated += seg.length;
  }

  // Binary search for exact sample in target segment's arc length table
  const samples = targetSeg.samples;
  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].s < segDistance) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx = Math.max(0, Math.min(samples.length - 2, high));
  const s0 = samples[idx];
  const s1 = samples[idx + 1];

  const segRange = s1.s - s0.s;
  const factor = segRange > 1e-7 ? (segDistance - s0.s) / segRange : 0;
  const t = s0.t + factor * (s1.t - s0.t);

  // Evaluate exact position, velocity, acceleration at t
  const pos = cubicPos(targetSeg.p0, targetSeg.p1, targetSeg.p2, targetSeg.p3, t);
  const vel = cubicVel(targetSeg.p0, targetSeg.p1, targetSeg.p2, targetSeg.p3, t);
  const acc = cubicAcc(targetSeg.p0, targetSeg.p1, targetSeg.p2, targetSeg.p3, t);

  const speed = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
  const safeSpeed = speed > 1e-6 ? speed : 1;
  const tangent: Vec3 = [vel[0] / safeSpeed, vel[1] / safeSpeed, vel[2] / safeSpeed];

  const heading = Math.atan2(tangent[1], tangent[0]);
  const normal: Vec3 = [-tangent[1], tangent[0], 0];

  // Curvature: kappa = |v x a| / |v|^3
  const cx = vel[1] * acc[2] - vel[2] * acc[1];
  const cy = vel[2] * acc[0] - vel[0] * acc[2];
  const cz = vel[0] * acc[1] - vel[1] * acc[0];
  const crossMag = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const curvature = crossMag / (safeSpeed * safeSpeed * safeSpeed);

  return {
    position: pos,
    tangent,
    heading,
    normal,
    curvature,
    distance: targetDistance,
  };
}

/**
 * Samples a spatial motion path driven by elapsed time and AE keyframe velocity easing.
 * Combines spatial arc-length constancy with temporal speed curves.
 */
export function sampleMotionPathAtTime(
  path: SpatialMotionPath,
  time: number,
  duration: number,
  ease?: {
    easeIn?: KeyframeEase;
    easeOut?: KeyframeEase;
  }
): SpatialPathSample {
  const distanceFraction = evaluateKeyframeSegment(
    0,
    1,
    duration,
    time,
    ease?.easeOut,
    ease?.easeIn
  );
  return sampleMotionPath(path, distanceFraction);
}

