import { describe, expect, it } from "vitest";
import { clicksUniform, HOVER_SECONDS, MAX_CLICKS, PointerTracker } from "./pointer.js";

describe("PointerTracker", () => {
  it("eases hovering in and out, from wherever it had got to", () => {
    const p = new PointerTracker();
    expect(p.hovered(0)).toBe(0);
    p.hover(true, 1);
    expect(p.hovered(1)).toBe(0);
    expect(p.hovered(1 + HOVER_SECONDS / 2)).toBeCloseTo(0.5);
    expect(p.hovered(1 + HOVER_SECONDS)).toBe(1);
    p.hover(false, 1 + HOVER_SECONDS / 2);
    expect(p.hovered(1 + HOVER_SECONDS / 2)).toBeCloseTo(0.5);
    expect(p.hovered(2 + HOVER_SECONDS)).toBe(0);
  });

  it("reports where it is and how long it has been pressed", () => {
    const p = new PointerTracker();
    p.move(10, 20);
    expect(p.pointer(0)).toEqual([10, 20, 0, 0]);
    p.down(30, 40, 2);
    expect(p.pointer(2.5)).toEqual([30, 40, 0, 0.5]);
    p.up(3);
    expect(p.pointer(3)[3]).toBeLessThan(0);
    expect(p.pointer(4)[3]).toBe(-1);
  });

  it("keeps the latest clicks, newest first, hiding ones after the frame", () => {
    const p = new PointerTracker();
    for (let i = 0; i < MAX_CLICKS + 2; i++) p.down(i, i, i);
    const u = p.clicksAt(100);
    expect(Array.from(u.slice(0, 4))).toEqual([9, 9, 9, 1]);
    expect(Array.from(u.slice(-4))).toEqual([2, 2, 2, 1]);
    expect(Array.from(p.clicksAt(8.5).slice(0, 4))).toEqual([8, 8, 8, 1]);
    p.clear();
    expect(p.clicksAt(100).every((v) => v === 0)).toBe(true);
  });
});

describe("clicksUniform", () => {
  it("fills empty slots with zeros", () => {
    const u = clicksUniform([{ x: 1, y: 2, time: 3 }], 5);
    expect(u).toHaveLength(MAX_CLICKS * 4);
    expect(Array.from(u.slice(0, 8))).toEqual([1, 2, 3, 1, 0, 0, 0, 0]);
  });
});
