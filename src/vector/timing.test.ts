import { describe, expect, it } from "vitest";
import { svgAnimatedMarkup } from "./animated.js";
import {
  changeLength,
  changeTime,
  easeFunction,
  isSvgEase,
  springProgress,
  springSettleMs,
  stepProgress,
  svgFrame,
  svgMotionIssues,
  type SvgAnimation,
  type SvgMotion,
} from "./motion.js";
import { svgDuration } from "./svg.js";

const SVG = '<svg viewBox="0 0 100 100"><rect id="box" width="10" height="10"/></svg>';
const opacityAt = (anim: SvgAnimation, t: number) => Number(svgFrame([anim], [], t).get("box")!.attrs.opacity);

describe("repeat and alternate", () => {
  const fade: SvgAnimation = { id: "box", attrs: { opacity: [0, 1] }, ms: 100, ease: "linear", repeat: 3 };

  it("plays whole cycles, each from `from` to `to`, taking ms × repeat", () => {
    expect(changeLength(fade)).toBe(300);
    expect(svgDuration({ svg: SVG, animate: [fade] })).toBe(300);
    expect(opacityAt(fade, 50)).toBeCloseTo(0.5);
    expect(opacityAt(fade, 150)).toBeCloseTo(0.5);
    expect(opacityAt(fade, 100)).toBe(0);
    expect(opacityAt(fade, 299)).toBeCloseTo(0.99);
    expect(opacityAt(fade, 300)).toBe(1);
    expect(opacityAt(fade, 1000)).toBe(1);
  });

  it("runs odd cycles backwards with the ease applied to the reversed time", () => {
    const swing: SvgAnimation = { ...fade, ease: "out", alternate: true, repeat: 2 };
    const out = easeFunction("out");
    expect(opacityAt(swing, 25)).toBeCloseTo(out(0.25), 3);
    expect(opacityAt(swing, 125)).toBeCloseTo(out(0.75), 3);
    expect(opacityAt(swing, 100)).toBe(1);
    // An even number of alternating cycles ends back at `from`.
    expect(opacityAt(swing, 200)).toBe(0);
    expect(opacityAt({ ...swing, repeat: 3 }, 300)).toBe(1);
    expect(changeTime({ ms: 100, repeat: 2, alternate: true }, 150)).toBeCloseTo(0.5);
  });

  it("repeats a behavior each cycle", () => {
    const pulse: SvgAnimation = { id: "box", attrs: { opacity: [0, 1] }, ms: 100, behavior: { type: "pulse" }, repeat: 2 };
    expect(opacityAt(pulse, 50)).toBeCloseTo(1);
    expect(opacityAt(pulse, 150)).toBeCloseTo(1);
    expect(opacityAt(pulse, 100)).toBeCloseTo(0);
  });
});

describe("strobe", () => {
  const fade: SvgAnimation = { id: "box", attrs: { opacity: [0, 1] }, ms: 1000, ease: "linear", strobe: 12 };

  it("holds time on a grid of strobe frames a second from the change's start", () => {
    const at = (t: number) => (Math.floor((t * 12) / 1000) / 12) * 1000 / 1000;
    for (const t of [0, 40, 83, 84, 500, 917, 999]) expect(opacityAt(fade, t)).toBeCloseTo(at(t), 3);
    expect(opacityAt({ ...fade, delay: 200 }, 290)).toBeCloseTo(at(90), 3);
  });

  it("is at its end once the change is over", () => {
    expect(opacityAt({ ...fade, ms: 800 }, 799)).toBeCloseTo(0.9375, 3);
    expect(opacityAt({ ...fade, ms: 800 }, 800)).toBe(1);
  });
});

describe("spring ease", () => {
  it("is 1 − x(t) for a damped spring, snapping to 1 at the end of the change", () => {
    const spring = { spring: { stiffness: 100, damping: 10 } };
    expect(isSvgEase(spring)).toBe(true);
    // Under-damped by hand: w0 = 10, zeta = 0.5.
    const w0 = 10;
    const zeta = 0.5;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const x = Math.exp(-zeta * w0 * 0.2) * (Math.cos(wd * 0.2) + ((zeta * w0) / wd) * Math.sin(wd * 0.2));
    expect(springProgress(spring.spring, 0.2)).toBeCloseTo(1 - x, 12);
    expect(stepProgress([], 200, 0, { ms: 1000, ease: spring })).toBeCloseTo(1 - x, 12);
    expect(stepProgress([], 1000, 0, { ms: 1000, ease: spring })).toBe(1);
    expect(stepProgress([], 0, 0, { ms: 1000, ease: spring })).toBe(0);
  });

  it("handles critically and over-damped springs, and clamps bad values", () => {
    // Critically damped: damping = 2·sqrt(k·m).
    expect(springProgress({ stiffness: 100, damping: 20 }, 0.1)).toBeCloseTo(1 - Math.exp(-1) * 2, 12);
    const over = springProgress({ stiffness: 100, damping: 40 }, 0.1);
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(1);
    expect(Number.isFinite(springProgress({ mass: 0, stiffness: -5, damping: -1 }, 0.1))).toBe(true);
  });

  it("settles by springSettleMs, clamped to 50–10000", () => {
    // The settle time is the decay envelope's (the editor's own estimate): within about 0.1%,
    // a little more just under critical damping (the default spring is ~0.75% off at 531 ms).
    expect(springSettleMs({})).toBeCloseTo(6900 / 13, 6);
    for (const spring of [{}, { damping: 10 }, { stiffness: 100, damping: 20 }, { damping: 60 }]) {
      const ms = springSettleMs(spring);
      expect(ms).toBeGreaterThanOrEqual(50);
      expect(Math.abs(1 - springProgress(spring, ms / 1000))).toBeLessThan(1e-2);
    }
    expect(springSettleMs({ damping: 0 })).toBe(10000);
    expect(springSettleMs({ stiffness: 1e6, damping: 2000 })).toBe(50);
  });
});

describe("svgMotionIssues", () => {
  const issues = (a: Record<string, unknown>) => svgMotionIssues({ svg: SVG, animate: [{ id: "box", attrs: { opacity: [0, 1] }, ...a }] });

  it("accepts good timing", () => {
    expect(issues({ repeat: 3, alternate: true, strobe: 12, ease: { spring: { damping: 12 } } })).toEqual([]);
  });

  it("says how to fix bad values", () => {
    expect(issues({ repeat: 0 })[0]).toMatch(/`repeat` is a whole number of cycles, 1 or more/);
    expect(issues({ repeat: 1.5 })[0]).toMatch(/repeat/);
    expect(issues({ alternate: "yes" })[0]).toMatch(/`alternate` is true or false/);
    expect(issues({ strobe: 0 })[0]).toMatch(/`strobe` is frames a second, above 0/);
    expect(issues({ ease: { spring: { stiffness: "stiff" } } })[0]).toMatch(/`ease.spring` is \{mass\?, stiffness\?, damping\?, velocity\?\}/);
    expect(issues({ ease: { spring: { bounce: 1 } } })[0]).toMatch(/ease.spring/);
    expect(issues({ ease: "bouncy" })[0]).toMatch(/\{spring: /);
  });
});

describe("svgAnimatedMarkup with the new timing", () => {
  const parse = (markup: string) => new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
  /** The value SMIL shows at `t` for linear keys (all these are), from an `<animate>`'s keys. */
  const smilAt = (el: Element, t: number) => {
    const times = el.getAttribute("keyTimes")!.split(";").map(Number);
    const values = el.getAttribute("values")!.split(";").map(Number);
    const dur = parseFloat(el.getAttribute("dur")!) * 1000;
    const p = t / dur;
    let i = times.length - 1;
    while (i > 0 && times[i]! > p) i--;
    if (i >= times.length - 1) return values[values.length - 1]!;
    const span = times[i + 1]! - times[i]!;
    return span ? values[i]! + ((values[i + 1]! - values[i]!) * (p - times[i]!)) / span : values[i + 1]!;
  };
  const check = (anim: SvgAnimation, at: number[], digits = 2) => {
    const motion: SvgMotion = { svg: SVG, animate: [anim] };
    const el = parse(svgAnimatedMarkup(motion, { hold: 0 })!).querySelector("animate")!;
    expect(el.getAttribute("calcMode")).not.toBe("spline");
    for (const t of at) expect(smilAt(el, t)).toBeCloseTo(opacityAt(anim, t), digits);
  };

  it("writes repeated and alternating linear cycles exactly", () => {
    check({ id: "box", attrs: { opacity: [0, 1] }, ms: 100, ease: "linear", repeat: 3, alternate: true }, [0, 30, 99, 130, 170, 250, 299]);
    check({ id: "box", attrs: { opacity: [0, 1] }, ms: 100, ease: "linear", repeat: 2 }, [10, 90, 110, 190]);
  });

  it("writes strobed time as held frames that jump exactly", () => {
    check({ id: "box", attrs: { opacity: [0, 1] }, ms: 1000, ease: "linear", strobe: 12 }, [0, 50, 82, 84, 400, 916, 917, 990], 6);
  });

  it("samples a spring", () => {
    check({ id: "box", attrs: { opacity: [0, 1] }, ms: 600, ease: { spring: { damping: 10 } } }, [0, 100, 300, 599], 1);
  });

  it("turns an eased cycle's spline round when it runs backwards", () => {
    const motion: SvgMotion = { svg: SVG, animate: [{ id: "box", attrs: { opacity: [0, 1] }, ms: 100, ease: [0.1, 0.2, 0.3, 0.9], repeat: 2, alternate: true }] };
    const el = parse(svgAnimatedMarkup(motion, { hold: 0 })!).querySelector("animate")!;
    expect(el.getAttribute("values")).toBe("0;1;0");
    expect(el.getAttribute("keySplines")).toBe("0.1 0.2 0.3 0.9;0.7 0.1 0.9 0.8");
  });
});
