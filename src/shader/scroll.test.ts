import { describe, expect, it } from "vitest";
import { SCROLL_SETTLE, ScrollTracker, viewportProgress } from "./scroll.js";

describe("viewportProgress", () => {
  it("is 0 as the top enters at the bottom and 1 as the bottom leaves at the top", () => {
    expect(viewportProgress(800, 200, 800)).toBe(0);
    expect(viewportProgress(300, 200, 800)).toBe(0.5);
    expect(viewportProgress(-200, 200, 800)).toBe(1);
    expect(viewportProgress(2000, 200, 800)).toBe(0);
    expect(viewportProgress(-900, 200, 800)).toBe(1);
  });
});

describe("ScrollTracker", () => {
  it("is all zero until it hears where things are", () => {
    expect(new ScrollTracker().scroll(1)).toEqual([0, 0, 0, 0]);
  });

  it("measures a smoothed velocity in viewport heights a second, and eases out of scrolling", () => {
    const s = new ScrollTracker();
    // Scrolling down a viewport height a second for half a second, at 60 frames a second.
    for (let i = 0; i <= 30; i++) s.sample(0.2 + i / 120, 0.1, i / 60, i / 60);
    const [x, y, v, w] = s.scroll(0.5);
    expect(x).toBeCloseTo(0.45);
    expect(y).toBeCloseTo(0.1);
    expect(v).toBeGreaterThan(0.95);
    expect(v).toBeLessThanOrEqual(1);
    expect(w).toBe(1);
    // It stops: the velocity falls away and "scrolling" eases to 0.
    for (let i = 31; i <= 90; i++) s.sample(0.45, 0.1, 0.5, i / 60);
    expect(Math.abs(s.scroll(1.5)[2])).toBeLessThan(0.01);
    expect(s.scroll(0.5 + SCROLL_SETTLE / 2)[3]).toBeCloseTo(0.5);
    expect(s.scroll(0.5 + SCROLL_SETTLE)[3]).toBe(0);
    expect(s.settled(1.5)).toBe(true);
  });

  it("is negative scrolling up", () => {
    const s = new ScrollTracker();
    for (let i = 0; i <= 20; i++) s.sample(0.5, 0.5, -i / 30, i / 60);
    expect(s.scroll(20 / 60)[2]).toBeLessThan(-1);
  });

  it("never reads all zero once measured, even at progress 0", () => {
    const s = new ScrollTracker();
    s.sample(0, 0, 0, 0);
    expect(s.scroll(0)[0]).toBeGreaterThan(0);
  });
});
