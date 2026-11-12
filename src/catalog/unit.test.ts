import { describe, expect, it } from "vitest";
import { getEffect } from "./index.js";

/**
 * The path trails and tubes size what they draw from `uUnit` when it is set, so an editor painting
 * them along a stroke sizes them to the brush instead of to the whole canvas.
 */
const SIZED = ["comet-trail", "ribbon-trail", "sparkle-trail", "brush-trail", "ghost-trail", "light-painting", "glass-tube", "glass-writing"];

describe("size unit (uUnit)", () => {
  for (const id of SIZED) {
    it(`${id} declares uUnit, off by default`, () => {
      const effect = getEffect(id);
      expect(effect?.kind).toBe("shader");
      const source = (effect as { source: string }).source;
      expect(source).toMatch(/uniform float uUnit;\s*\/\/ @control min=0 max=16384 default=0 /);
    });
  }

  it("trails measure sizes and jumps in units of trailUnit(), never the frame height directly", () => {
    for (const id of SIZED.slice(0, 6)) {
      const source = (getEffect(id) as { source: string }).source;
      expect(source, id).toContain("float px = 1.0 / trailUnit();");
      expect(source, id).not.toContain("1.0 / iResolution.y");
      expect(source, id).toContain("0.03 * trailUnit()");
    }
  });

  it("tubes take their thickness as a share of uUnit when it is set", () => {
    for (const id of ["glass-tube", "glass-writing"]) {
      const source = (getEffect(id) as { source: string }).source;
      expect(source, id).toContain("(uUnit > 0.0 ? uUnit : min(iResolution.x, iResolution.y))");
    }
  });
});
