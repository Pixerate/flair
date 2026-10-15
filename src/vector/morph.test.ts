import { describe, expect, it } from "vitest";
import { morphPaths, morphSequence } from "./morph.js";
import { lerpAttr } from "./motion.js";

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const skeleton = (d: string) => d.replace(NUMBER, "#");
const points = (d: string) =>
  d
    .split(/\s*Z\s*/)
    .filter(Boolean)
    .map((ring) => [...ring.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]));

const SQUARE = "M10 10 H90 V90 H10 Z";
const CIRCLE = "M50 10 A40 40 0 1 1 50 90 A40 40 0 1 1 50 10 Z";

describe("morphPaths", () => {
  it("gives two paths one structure, so lerpAttr blends them", () => {
    const [a, b] = morphPaths(SQUARE, CIRCLE, { points: 32 });
    expect(skeleton(a)).toBe(skeleton(b));
    expect(points(a)[0]).toHaveLength(32);
    const mid = lerpAttr(a, b, 0.5);
    expect(skeleton(mid)).toBe(skeleton(a));
    expect(mid).not.toBe(a);
  });

  it("keeps each shape where it was", () => {
    const [a, b] = morphPaths(SQUARE, CIRCLE, { points: 40 });
    for (const [x, y] of points(a)[0]!) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(90 + 1e-6);
      expect(Math.abs(x - 10) < 0.01 || Math.abs(x - 90) < 0.01 || Math.abs(y - 10) < 0.01 || Math.abs(y - 90) < 0.01).toBe(true);
    }
    for (const [x, y] of points(b)[0]!) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(40, 0);
  });

  it("lines up the start and direction, so a shape morphing into itself does not move", () => {
    const shifted = "M90 90 H10 V10 H90 Z";
    const [a, b] = morphPaths(SQUARE, shifted, { points: 16 });
    expect(a).toBe(b);
  });

  it("reads curves, smooth curves, relative commands and implicit linetos", () => {
    const [a, b] = morphPaths("m10 10 30 0 0 30 -30 0z", "M0 0 C10 -10 20 -10 30 0 S40 20 30 30 Q15 40 0 30 T0 0 Z", { points: 12 });
    expect(skeleton(a)).toBe(skeleton(b));
    expect(points(a)[0]!.every(([x, y]) => x >= 10 && x <= 40 && y >= 10 && y <= 40)).toBe(true);
  });

  it("grows and shrinks pieces with no partner, and pairs pieces by position", () => {
    const two = "M0 0 H10 V10 H0 Z M100 0 H110 V10 H100 Z";
    const one = "M100 0 H112 V12 H100 Z";
    const [a, b] = morphPaths(two, one, { points: 8 });
    expect(skeleton(a)).toBe(skeleton(b));
    const [ringsA, ringsB] = [points(a), points(b)];
    expect(ringsA).toHaveLength(2);
    // The right square becomes the new one; the left one shrinks to a point where it was.
    const right = ringsA.findIndex((r) => r[0]![0]! >= 100);
    expect(ringsB[right]!.every(([x]) => x >= 100)).toBe(true);
    const left = 1 - right;
    expect(new Set(ringsB[left]!.map((p) => p.join(","))).size).toBe(1);
    expect(ringsB[left]![0]).toEqual([5, 5]);
  });

  it("turns strokes (open paths) into closed outlines", () => {
    const [a, b] = morphPaths("M0 50 L100 50", CIRCLE, { points: 20 });
    expect(skeleton(a)).toBe(skeleton(b));
    expect(points(a)[0]!.every(([, y]) => y === 50)).toBe(true);
  });

  it("explains a path it cannot read", () => {
    expect(() => morphPaths("10 10 L 20 20", SQUARE)).toThrow("Path 1 cannot be read");
    expect(() => morphPaths(SQUARE, "M0 0 X 5 5")).toThrow("Path 2 cannot be read");
    expect(() => morphPaths(SQUARE, "M0 0")).toThrow("Path 2 draws nothing");
  });
});

describe("morphSequence", () => {
  it("gives every shape one structure", () => {
    const paths = morphSequence([SQUARE, CIRCLE, "M50 10 L90 90 L10 90 Z", "M0 0 H10 V10 H0 Z M20 0 H30 V10 H20 Z"], { points: 24 });
    expect(paths).toHaveLength(4);
    expect(new Set(paths.map(skeleton)).size).toBe(1);
    expect(paths[0]!.match(/M/g)).toHaveLength(2);
  });

  it("writes plain numbers, never -0 or exponents", () => {
    const [a] = morphPaths("M-0.0001 0 L1e-9 5 L5 5 Z", SQUARE);
    expect(a).not.toMatch(/-0(?![.\d])|e/i);
  });
});
