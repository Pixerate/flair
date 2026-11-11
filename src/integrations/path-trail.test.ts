import { describe, expect, it } from "vitest";
import type { ControlDef } from "../shader/controls.js";
import { MAX_TRAIL } from "../shader/pointer.js";
import { isPathTrailEffect, pathTrail, trailFromPoints } from "./path-trail.js";

const control = (name: string, type: ControlDef["type"]): ControlDef => ({ name, type, label: name, color: false }) as ControlDef;
const trailControls = [control("uPath", "path"), control("uDemo", "bool"), control("uLife", "float")];

describe("path trails", () => {
  it("only takes effects with a demo toggle and a path control", () => {
    expect(isPathTrailEffect(trailControls)).toBe(true);
    expect(isPathTrailEffect([control("uPath", "path")])).toBe(false);
    expect(isPathTrailEffect([control("uDemo", "bool")])).toBe(false);
  });

  it("makes the trail from path points, the head at the path's end, and turns the demo off", () => {
    const traced = pathTrail(trailControls, { uPath: [10, 20, 110, 20], uDemo: true, uLife: 1 }, 100, 2);
    expect(traced?.values.uDemo).toBe(false);
    const trail = traced!.trail;
    expect(trail).toHaveLength(MAX_TRAIL);
    // Oldest first: the path's start, half of uLife ago; the newest is its end now, y up.
    expect(trail[0]!.x).toBeCloseTo(10);
    expect(trail[0]!.time).toBeCloseTo(1.5);
    expect(trail[MAX_TRAIL - 1]).toEqual({ x: 110, y: 80, time: 2 });
  });

  it("leaves SVG path data, too few points and other effects to the demo", () => {
    expect(pathTrail(trailControls, { uPath: "M 0 0 L 10 10" }, 100, 0)).toBeUndefined();
    expect(pathTrail(trailControls, { uPath: [1, 2] }, 100, 0)).toBeUndefined();
    expect(pathTrail([control("uPath", "path")], { uPath: [0, 0, 10, 10] }, 100, 0)).toBeUndefined();
  });

  it("spaces the points evenly along the path's length", () => {
    const trail = trailFromPoints([[0, 0], [30, 0], [30, 31]], 100, 0, 1);
    const steps = trail.slice(1).map((p, i) => Math.hypot(p.x - trail[i]!.x, p.y - trail[i]!.y));
    // 61 px over 31 steps, less where a step cuts the corner.
    expect(Math.max(...steps)).toBeCloseTo(61 / 31, 5);
  });
});
