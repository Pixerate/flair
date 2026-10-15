import { describe, expect, it } from "vitest";
import {
  formatCount,
  lerpAttr,
  lerpData,
  stepData,
  stepProgress,
  stepStart,
  SVG_PICTURE,
  svgFrame,
  svgMotionIssues,
  type SvgAnimation,
} from "./motion.js";

describe("steps", () => {
  it("starts step 0 at once and step n at steps[n - 1]", () => {
    expect(stepStart([1000, 2500], 0)).toBe(0);
    expect(stepStart([1000, 2500], 2)).toBe(2500);
    expect(stepStart([1000], 2)).toBeUndefined();
  });

  it("eases a change from its step's start (plus delay) over ms", () => {
    const steps = [1000];
    expect(stepProgress(steps, 999, 1)).toBe(0);
    expect(stepProgress(steps, 1400, 1, { ease: "linear" })).toBe(0.5);
    expect(stepProgress(steps, 1400, 1)).toBe(0.5); // in-out is symmetric
    expect(stepProgress(steps, 1300, 1, { delay: 200, ms: 200, ease: "linear" })).toBe(0.5);
    expect(stepProgress(steps, 5000, 1)).toBe(1);
    expect(stepProgress(steps, 5000, 2)).toBe(0);
  });
});

describe("lerpData", () => {
  it("keeps items by key, growing new ones and shrinking old ones", () => {
    const a = [
      { name: "A", value: 10 },
      { name: "B", value: 20 },
    ];
    const b = [
      { name: "B", value: 40 },
      { name: "C", value: 10 },
    ];
    expect(lerpData(a, b, 0.5)).toEqual([
      { name: "B", value: 30 },
      { name: "C", value: 5 },
      { name: "A", value: 5 },
    ]);
    expect(lerpData(a, b, 1)).toBe(b);
  });

  it("keys links by both ends and blends nested objects", () => {
    const a = { links: [{ source: "x", target: "y", value: 2 }], total: 2 };
    const b = { links: [{ source: "x", target: "y", value: 4 }], total: 4 };
    expect(lerpData(a, b, 0.5)).toEqual({
      links: [{ source: "x", target: "y", value: 3 }],
      total: 3,
    });
  });
});

describe("stepData", () => {
  const states = [{ v: 0 }, { v: 100 }, { v: 50 }];
  it("shows each state from its step, moving from the one before", () => {
    expect(stepData(states, [], 5000)).toEqual({ v: 0 });
    expect(stepData(states, [1000], 1400, { ease: "linear" })).toEqual({ v: 50 });
    expect(stepData(states, [1000], 3000)).toEqual({ v: 100 });
    expect(stepData(states, [1000, 3000], 3000)).toEqual({ v: 100 });
    expect(stepData(states, [1000, 3000, 4000, 5000], 9000)).toEqual({ v: 50 });
  });

  it("is the same frame however the time is reached", () => {
    const at = (t: number) => stepData(states, [1000, 2000], t);
    const stepped = Array.from({ length: 90 }, (_, i) => at((i * 1000) / 30));
    expect(at(1500)).toEqual(stepped[45]);
  });
});

describe("lerpAttr", () => {
  it("blends numbers, colours and strings whose numbers change", () => {
    expect(lerpAttr(0, 120, 0.25)).toBe("30");
    expect(lerpAttr("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(lerpAttr("#f00", "#00f", 1)).toBe("#0000ff");
    expect(lerpAttr("translate(0 0)", "translate(100 -50)", 0.5)).toBe("translate(50 -25)");
    expect(lerpAttr("M0 0L10 10", "M0 0L20 30", 0.5)).toBe("M0 0L15 20");
    expect(lerpAttr("start", "end", 0.4)).toBe("start");
    expect(lerpAttr("start", "end", 0.6)).toBe("end");
  });
});

describe("svgFrame", () => {
  const grow: SvgAnimation = { id: "bar", attrs: { height: [0, 100] }, ms: 1000, ease: "linear" };
  it("holds the starting value until a change starts, then plays it", () => {
    const later: SvgAnimation = { ...grow, step: 1 };
    expect(svgFrame([later], [], 5000).get("bar")!.attrs.height).toBe("0");
    expect(svgFrame([later], [2000], 2500).get("bar")!.attrs.height).toBe("50");
    expect(svgFrame([later], [2000], 9000).get("bar")!.attrs.height).toBe("100");
  });

  it("lets the latest started change win, so steps can chain", () => {
    const anims: SvgAnimation[] = [grow, { id: "bar", step: 1, attrs: { height: [100, 40] } }];
    expect(svgFrame(anims, [], 500).get("bar")!.attrs.height).toBe("50");
    expect(svgFrame(anims, [3000], 2900).get("bar")!.attrs.height).toBe("100");
    expect(svgFrame(anims, [3000], 9000).get("bar")!.attrs.height).toBe("40");
  });

  it("draws lines on and counts numbers", () => {
    const frame = svgFrame(
      [
        { id: "route", draw: true, ms: 1000, ease: "linear" },
        { id: "total", count: [0, 42], format: "{n}%", ms: 1000, ease: "linear" },
      ],
      [],
      500,
    );
    expect(frame.get("route")!.draw).toBe(0.5);
    expect(frame.get("total")!.text).toBe("21%");
  });
});

describe("svgFrame views and paths", () => {
  it("frames the whole picture from where the last view left it", () => {
    const anims: SvgAnimation[] = [
      { view: "leg-1", ms: 1000, ease: "linear" },
      { view: [0, 0, 800, 500], step: 1, ms: 1000, ease: "linear" },
    ];
    // Before any view: from the whole picture (null) to the first, not started
    expect(svgFrame(anims, [], 500).get(SVG_PICTURE)!.view).toEqual({
      from: null,
      to: "leg-1",
      u: 0.5,
    });
    expect(svgFrame(anims, [2000], 2500).get(SVG_PICTURE)!.view).toEqual({
      from: "leg-1",
      to: [0, 0, 800, 500],
      u: 0.5,
    });
  });

  it("moves an element along a path between fractions", () => {
    const frame = svgFrame(
      [{ id: "baton", along: "leg-2", at: [0.2, 0.6], ms: 1000, ease: "linear" }],
      [],
      500,
    );
    expect(frame.get("baton")!.along!.path).toBe("leg-2");
    expect(frame.get("baton")!.along!.at).toBeCloseTo(0.4);
  });

  it("checks views and paths against the picture", () => {
    const svg = '<svg viewBox="0 0 100 50"><path id="leg"/><circle id="dot"/></svg>';
    const say = (animate: object[]) => svgMotionIssues({ type: "svg", svg, animate }).join(" | ");
    expect(say([{ view: "leg" }, { view: [0, 0, 50, 25] }, { id: "dot", along: "leg" }])).toBe("");
    expect(say([{ view: "nope" }])).toMatch(/not an id/);
    expect(say([{ view: [0, 0, 0, 10] }])).toMatch(/width and height above 0/);
    expect(say([{ id: "dot", along: "nope" }])).toMatch(/id of a path/);
    expect(say([{ along: "leg" }])).toMatch(/needs an `id`/);
    expect(say([{ id: "dot", along: "leg", at: [0, 2] }])).toMatch(/between 0 and 1/);
  });
});

describe("svgMotionIssues", () => {
  const svg = '<svg viewBox="0 0 100 50"><rect id="bar" width="10" height="0"/></svg>';
  it("accepts a self-contained picture whose animations name its elements", () => {
    expect(svgMotionIssues({ type: "svg", svg, animate: [grow()] })).toEqual([]);
  });

  it("checks the viewBox on the root tag only, in linear time", () => {
    const start = performance.now();
    // Many unclosed "<svg" repeats used to make the viewBox check quadratic
    expect(svgMotionIssues({ type: "svg", svg: "<svg".repeat(50_000) }).join()).toMatch(/viewBox/);
    expect(performance.now() - start).toBeLessThan(500);
    expect(
      svgMotionIssues({ type: "svg", svg: '<svg><g viewBox="0 0 1 1"/></svg>' }).join(),
    ).toMatch(/needs a `viewBox`/);
  });

  it("refuses scripts, outside links, missing viewBoxes and unknown ids", () => {
    const say = (m: object) => svgMotionIssues({ type: "svg", ...m }).join(" | ");
    expect(say({})).toMatch(/needs the picture's markup/);
    expect(say({ svg: '<svg><rect id="bar"/></svg>' })).toMatch(/viewBox/);
    expect(say({ svg: svg.replace("<rect", '<script/><rect onclick="x()"') })).toMatch(/scripts/);
    expect(say({ svg: svg.replace("<rect", '<image href="https://x.test/a.png"/><rect') })).toMatch(
      /cannot link/,
    );
    expect(say({ svg, animate: [{ id: "nope", draw: true }] })).toMatch(
      /no element with id "nope"/,
    );
    expect(say({ svg, animate: [{ id: "bar" }] })).toMatch(/changes nothing/);
    expect(say({ svg, animate: [{ id: "bar", step: 1.5, draw: true }] })).toMatch(/whole number/);
  });

  function grow(): SvgAnimation {
    return { id: "bar", attrs: { height: [0, 40] } };
  }
});

describe("formatCount", () => {
  it("rounds integers, keeps decimal places, and supports string templates", () => {
    expect(formatCount(21.4)).toBe("21");
    expect(formatCount(21.6, { format: "{n}%" })).toBe("22%");
    expect(formatCount(1.25, { decimals: 1 })).toBe("1.3");
    expect(formatCount(1.25, { decimals: 2, format: "${n}" })).toBe("$1.25");
  });
});
