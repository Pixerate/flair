import { describe, expect, it } from "vitest";
import { svgAnimatedMarkup } from "./animated.js";
import { cubicBezierEase, EASES, easeFunction, isSvgEase, stepProgress, svgFrame, svgMotionIssues, type SvgMotion } from "./motion.js";

const parse = (markup: string) => {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc.documentElement;
};

describe("cubic-bezier easings", () => {
  it("solve the curve for time", () => {
    // (1/3, 1, 2/3, 1) is exactly Flair's `out`.
    const out = cubicBezierEase([1 / 3, 1, 2 / 3, 1]);
    for (const t of [0, 0.1, 0.25, 0.5, 0.8, 1]) expect(out(t)).toBeCloseTo(EASES.out(t), 5);
    const css = cubicBezierEase([0.42, 0, 0.58, 1]);
    expect(css(0.5)).toBeCloseTo(0.5, 5);
    expect(css(0.25)).toBeCloseTo(0.1291, 3);
    // Overshoot (a back ease) goes past 1.
    expect(Math.max(...[0.6, 0.7, 0.8].map(cubicBezierEase([0.34, 1.56, 0.64, 1])))).toBeGreaterThan(1);
    expect(easeFunction(undefined)).toBe(EASES["in-out"]);
  });

  it("play in changes and pass validation; malformed curves are reported", () => {
    expect(stepProgress([], 400, 0, { ms: 800, ease: [0, 0, 1, 1] })).toBeCloseTo(0.5, 5);
    const motion: SvgMotion = {
      svg: '<svg viewBox="0 0 10 10"><rect id="r" width="1" height="1"/></svg>',
      animate: [{ id: "r", ms: 1000, ease: [0.25, 0.1, 0.25, 1], attrs: { x: [0, 10] } }],
    };
    expect(svgMotionIssues(motion)).toEqual([]);
    expect(Number(svgFrame(motion.animate!, [], 500).get("r")!.attrs.x)).toBeCloseTo(10 * cubicBezierEase([0.25, 0.1, 0.25, 1])(0.5), 3);
    expect(isSvgEase([2, 0, 1, 1])).toBe(false);
    expect(svgMotionIssues({ ...motion, animate: [{ ...motion.animate![0]!, ease: [2, 0, 1, 1] }] })[0]).toMatch(/cubic-bezier/);
  });

  it("are written as SMIL key splines, and sampled when they overshoot", () => {
    const motion = (ease: [number, number, number, number]): SvgMotion => ({
      svg: '<svg viewBox="0 0 10 10"><rect id="r" width="1" height="1"/></svg>',
      animate: [{ id: "r", ms: 1000, ease, attrs: { x: [0, 10] } }],
    });
    const splines = (m: SvgMotion) => parse(svgAnimatedMarkup(m, { hold: 0 })!).querySelector('animate[attributeName="x"]')!.getAttribute("keySplines");
    expect(splines(motion([0.25, 0.1, 0.25, 1]))).toContain("0.25 0.1 0.25 1");
    expect(splines(motion([0.34, 1.56, 0.64, 1])) ?? "").not.toContain("1.56");
  });
});
