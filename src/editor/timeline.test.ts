import { describe, expect, it } from "vitest";
import type { ControlDef } from "../shader/controls.js";
import { cubicBezierAt, evaluateEasing, evaluateTrack, interpolateControlValue, isEasing, keyframeTimes, normalizeKeyframes } from "./timeline.js";

const float: ControlDef = { name: "uX", type: "float", label: "X", color: false, min: 0, max: 10, step: 0.1, default: 0, line: 1 };
const int: ControlDef = { ...float, type: "int", name: "uN" };
const color: ControlDef = { ...float, type: "vec3", color: true, name: "uC", default: [0, 0, 0] };

describe("easing", () => {
  it("solves CSS beziers and presets", () => {
    expect(cubicBezierAt(0, 0, 1, 1, 0.3)).toBeCloseTo(0.3, 4);
    expect(evaluateEasing("ease-in-out", 0.5)).toBeCloseTo(0.5, 3);
    expect(evaluateEasing("ease-in", 0.25)).toBeLessThan(0.25);
    expect(evaluateEasing("ease-out", 0.25)).toBeGreaterThan(0.25);
    expect(evaluateEasing("hold", 0.99)).toBe(0);
    expect(evaluateEasing(undefined, 0.4)).toBe(0.4);
    expect(evaluateEasing({ type: "cubic-bezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }, 0.6)).toBeGreaterThan(1);
  });

  it("springs overshoot and settle", () => {
    const samples = Array.from({ length: 50 }, (_, i) => evaluateEasing({ type: "spring", damping: 10 }, i / 50, 1000));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(evaluateEasing("spring", 1)).toBe(1);
  });

  it("recognises easings", () => {
    expect(isEasing("ease-out-back")).toBe(true);
    expect(isEasing("bouncy")).toBe(false);
    expect(isEasing({ type: "cubic-bezier", x1: 0, y1: 0, x2: 1, y2: 1 })).toBe(true);
    expect(isEasing({ type: "spring", stiffness: -1 })).toBe(false);
  });
});

describe("tracks", () => {
  const track = { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 10, easing: "hold" as const }, { time: 2000, value: 4 }] };

  it("holds before the first and after the last keyframe, and interpolates between", () => {
    expect(evaluateTrack(track, -5, float)).toBe(0);
    expect(evaluateTrack(track, 500, float)).toBe(5);
    expect(evaluateTrack(track, 1500, float)).toBe(10);
    expect(evaluateTrack(track, 9999, float)).toBe(4);
    expect(evaluateTrack({ ...track, enabled: false }, 500, float)).toBeUndefined();
    expect(evaluateTrack({ keyframes: [] }, 500, float)).toBeUndefined();
  });

  it("rounds ints, blends colours in Oklab, and switches booleans halfway", () => {
    expect(interpolateControlValue(int, 0, 3, 0.4)).toBe(1);
    const mid = interpolateControlValue(color, [1, 0, 0], [0, 0, 1], 0.5) as number[];
    expect(mid).toHaveLength(3);
    expect(mid[0]).toBeGreaterThan(0.3);
    expect(interpolateControlValue(undefined, true, false, 0.4)).toBe(true);
    expect(interpolateControlValue(undefined, [0, 0], [2, 4], 0.5)).toEqual([1, 2]);
  });

  it("normalises keyframes and lists times", () => {
    expect(normalizeKeyframes([{ time: 50, value: 1 }, { time: 10, value: 2 }, { time: 50, value: 3 }])).toEqual([
      { time: 10, value: 2 },
      { time: 50, value: 3 },
    ]);
    expect(keyframeTimes({ a: track, b: { keyframes: [{ time: 500, value: 1 }] } })).toEqual([0, 500, 1000, 2000]);
  });
});
