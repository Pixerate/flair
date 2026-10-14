import { describe, it, expect } from 'vitest';
import {
  createMotionPath,
  sampleMotionPath,
  sampleMotionPathAtTime,
  type PathWaypoint,
} from './motionpath.js';

describe('Constant-Velocity Spatial Motion Paths', () => {
  it('correctly calculates total length and heading along a straight path', () => {
    const waypoints: PathWaypoint[] = [
      { point: [0, 0] },
      { point: [100, 0] },
    ];

    const path = createMotionPath(waypoints);
    expect(path.totalLength).toBeCloseTo(100, 1);

    const mid = sampleMotionPath(path, 0.5);
    expect(mid.position[0]).toBeCloseTo(50, 1);
    expect(mid.position[1]).toBeCloseTo(0, 1);
    expect(mid.heading).toBeCloseTo(0, 3);
    expect(mid.tangent).toEqual([1, 0, 0]);
    expect(mid.normal).toEqual([-0, 1, 0]);
    expect(mid.curvature).toBeCloseTo(0, 3);
  });

  it('guarantees constant-velocity spatial traversal on asymmetric Bezier curves', () => {
    // Extreme asymmetric handle configuration
    const waypoints: PathWaypoint[] = [
      { point: [0, 0], outTangent: [10, 80] },
      { point: [200, 0], inTangent: [-100, -20] },
    ];

    const path = createMotionPath(waypoints);
    expect(path.totalLength).toBeGreaterThan(200);

    // Test equal distance delta across different sections of the curve
    const p1 = sampleMotionPath(path, 0.2);
    const p2 = sampleMotionPath(path, 0.3);
    const d1 = Math.hypot(p2.position[0] - p1.position[0], p2.position[1] - p1.position[1]);

    const p3 = sampleMotionPath(path, 0.7);
    const p4 = sampleMotionPath(path, 0.8);
    const d2 = Math.hypot(p4.position[0] - p3.position[0], p4.position[1] - p3.position[1]);

    // Both step deltas are 0.1 of total path length, so spatial distance must be closely matched
    expect(d1).toBeCloseTo(path.totalLength * 0.1, 0);
    expect(d2).toBeCloseTo(path.totalLength * 0.1, 0);
    expect(Math.abs(d1 - d2)).toBeLessThan(path.totalLength * 0.015);
  });

  it('maintains unit tangent and orthogonal normal vectors along a 3D curved trajectory', () => {
    const waypoints: PathWaypoint[] = [
      { point: [0, 0, 0], outTangent: [0, 50, 20] },
      { point: [100, 100, 50], inTangent: [-50, 0, -20] },
      { point: [200, 0, 100], inTangent: [-30, 20, 0] },
    ];

    const path = createMotionPath(waypoints);
    for (let f = 0.1; f <= 0.9; f += 0.2) {
      const sample = sampleMotionPath(path, f);
      const tangentLen = Math.hypot(sample.tangent[0], sample.tangent[1], sample.tangent[2]);
      expect(tangentLen).toBeCloseTo(1.0, 3);

      // Normal dot tangent in 2D projection
      const dot = sample.tangent[0] * sample.normal[0] + sample.tangent[1] * sample.normal[1];
      expect(dot).toBeCloseTo(0.0, 3);
    }
  });

  it('supports closed loop paths with wrap-around segments', () => {
    const waypoints: PathWaypoint[] = [
      { point: [0, 0] },
      { point: [100, 0] },
      { point: [100, 100] },
      { point: [0, 100] },
    ];

    const path = createMotionPath(waypoints, { closed: true });
    expect(path.segments.length).toBe(4);
    expect(path.totalLength).toBeCloseTo(400, 1);

    const endSample = sampleMotionPath(path, 1.0);
    expect(endSample.position[0]).toBeCloseTo(0, 1);
    expect(endSample.position[1]).toBeCloseTo(0, 1);
  });

  it('integrates with AE keyframe velocity easing via sampleMotionPathAtTime', () => {
    const waypoints: PathWaypoint[] = [
      { point: [0, 0] },
      { point: [100, 0] },
    ];
    const path = createMotionPath(waypoints);

    // Apply high influence ease-in and ease-out
    const sampleQuarterTime = sampleMotionPathAtTime(path, 0.25, 1.0, {
      easeOut: { speed: 0, influence: 75 },
      easeIn: { speed: 0, influence: 75 },
    });

    // Due to ease curve, at 25% of elapsed time, position has moved much less than 25px
    expect(sampleQuarterTime.position[0]).toBeLessThan(20);

    // At completion time 1.0, exactly at end
    const sampleEndTime = sampleMotionPathAtTime(path, 1.0, 1.0);
    expect(sampleEndTime.position[0]).toBeCloseTo(100, 1);
  });
});
