import { describe, expect, it } from "vitest";
import { effectDefaults, findEffects, renderVectorEffect, type VectorEffect } from "../catalog/index.js";
import { svgAnimatedMarkup } from "./animated.js";
import { svgFrame, type SvgMotion } from "./motion.js";
import { svgFrameMarkup } from "./static.js";

const parse = (markup: string) => {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc.documentElement;
};

const ANIMATIONS = "animate, animateTransform, animateMotion, set";

/** The file as it shows without SMIL: its animation elements removed. */
const still = (markup: string) => {
  const svg = parse(markup);
  for (const el of svg.querySelectorAll(ANIMATIONS)) el.remove();
  return svg;
};

const attrs = (el: Element) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));

/** An `<animate>`'s value at `t` (0–1 of its loop), interpolated as SMIL does for numbers. */
function smil(anim: Element, t: number): number {
  const values = anim.getAttribute("values")!.split(";").map(Number);
  const times = anim.getAttribute("keyTimes")!.split(";").map(Number);
  const splines = anim.getAttribute("keySplines")?.split(";").map((s) => s.trim().split(/\s+/).map(Number));
  let i = times.length - 2;
  while (i > 0 && times[i]! > t) i--;
  const span = times[i + 1]! - times[i]!;
  let p = span > 0 ? Math.min(1, Math.max(0, (t - times[i]!) / span)) : 1;
  if (splines) {
    const [x1, y1, x2, y2] = splines[i]!;
    const bez = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (bez(x1!, x2!, mid) < p) lo = mid;
      else hi = mid;
    }
    p = bez(y1!, y2!, (lo + hi) / 2);
  }
  return values[i]! + (values[i + 1]! - values[i]!) * p;
}

const bars: SvgMotion = {
  svg: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>
    <rect id="bar" x="0" y="0" width="10" height="0" fill="url(#g)"/>
    <circle id="dot" r="2" cy="0"/>
    <path id="line" d="M0 50 L100 50" stroke="#000"/>
    <g id="pick"><circle r="1"/><circle r="2"/></g></svg>`,
  animate: [
    { id: "bar", attrs: { height: [0, 80] }, ms: 1000, ease: "linear" },
    { id: "dot", attrs: { cy: [0, 100] }, ms: 1000, ease: "in-out" },
    { id: "dot", attrs: { cy: [100, 20] }, ms: 600, delay: 1200, ease: "out" },
    { id: "line", draw: true, ms: 1000 },
    { id: "pick", solo: 0 },
    { id: "pick", solo: 1, delay: 1000 },
  ],
};

describe("svgAnimatedMarkup", () => {
  it("is one SVG file with no scripts, starting on the first frame", () => {
    const markup = svgAnimatedMarkup({ ...bars, svg: bars.svg.replace("<rect", `<script>evil()</script><rect onclick="evil()"`) })!;
    expect(markup).not.toMatch(/<script|onclick/i);
    const svg = parse(markup);
    expect(svg.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    const first = still(svgAnimatedMarkup(bars, { idSuffix: "" })!);
    const expected = parse(svgFrameMarkup(bars, { at: 0 })!);
    for (const el of expected.querySelectorAll("*")) {
      const same = first.querySelectorAll(el.localName)[[...expected.querySelectorAll(el.localName)].indexOf(el)]!;
      expect(attrs(same)).toEqual(attrs(el));
    }
    expect(svgAnimatedMarkup({ svg: "<div/>" })).toBeUndefined();
  });

  it("writes a linear change as one <animate> over the loop", () => {
    const svg = parse(svgAnimatedMarkup(bars)!);
    const anims = svg.querySelectorAll("#bar > animate");
    expect(anims).toHaveLength(1);
    const a = anims[0]!;
    // 1800 ms of changes, then 600 ms of rest.
    expect(attrs(a)).toMatchObject({
      attributeName: "height",
      values: "0;80;80",
      keyTimes: "0;0.41667;1",
      calcMode: "linear",
      dur: "2.4s",
      repeatCount: "indefinite",
    });
  });

  it("writes eases as splines that follow svgFrame", () => {
    const loop = 2400;
    const svg = parse(svgAnimatedMarkup(bars)!);
    const cy = svg.querySelector("#dot > animate")!;
    expect(cy.getAttribute("calcMode")).toBe("spline");
    // in-out is in then out, meeting halfway at 500 ms; out is one curve.
    expect(cy.getAttribute("keyTimes")).toBe("0;0.20833;0.41667;0.5;0.75;1");
    expect(cy.getAttribute("values")).toBe("0;50;100;100;20;20");
    const dash = svg.querySelector("#line > animate")!;
    for (let t = 0; t < loop; t += 37) {
      const frame = svgFrame(bars.animate!, [], t);
      expect(smil(cy, t / loop)).toBeCloseTo(Number(frame.get("dot")!.attrs.cy), 1);
      expect(smil(dash, t / loop)).toBeCloseTo(1 - frame.get("line")!.draw!, 2);
    }
    const toggles = [...svg.querySelectorAll("#pick > circle > animate")].map((a) => a.getAttribute("values"));
    expect(toggles).toEqual(["inline;none", "none;inline"]);
  });

  it("samples an ease cut short by the next change within 1/fps", () => {
    const motion: SvgMotion = {
      svg: `<svg viewBox="0 0 10 10"><rect id="r" x="0"/></svg>`,
      animate: [
        { id: "r", attrs: { x: [0, 100] }, ms: 1000, ease: "out" },
        { id: "r", attrs: { x: [50, 0] }, delay: 600, ms: 400, ease: "linear" },
      ],
    };
    const loop = 1600;
    const fps = 20;
    const a = parse(svgAnimatedMarkup(motion, { fps })!).querySelector("animate")!;
    const times = a.getAttribute("keyTimes")!.split(";").map((k) => Number(k) * loop);
    const cut = times.filter((t) => t <= 600);
    for (let i = 1; i < cut.length; i++) expect(cut[i]! - cut[i - 1]!).toBeLessThanOrEqual(1000 / fps + 1e-6);
    for (let t = 0; t < loop; t += 50)
      expect(smil(a, t / loop)).toBeCloseTo(Number(svgFrame(motion.animate!, [], t).get("r")!.attrs.x), -1);
  });

  it("shows counts and written text in turn, one <tspan> each", () => {
    const motion: SvgMotion = {
      svg: `<svg viewBox="0 0 100 20"><text id="n">0</text><text id="w"></text></svg>`,
      animate: [
        { id: "n", count: [0, 5], ms: 500, ease: "linear" },
        { id: "w", write: "Hi!", caret: "|", delay: 500, ms: 300, ease: "linear" },
      ],
    };
    const svg = parse(svgAnimatedMarkup(motion)!);
    const texts = (id: string) => [...svg.querySelectorAll(`#${id} > tspan`)].map((t) => t.firstChild!.textContent);
    expect(texts("n")).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(texts("w")).toEqual(["|", "H|", "Hi|", "Hi!"]);
    const shown = svg.querySelectorAll("#w > tspan");
    expect(shown[0]!.getAttribute("display")).toBeNull();
    expect(shown[1]!.getAttribute("display")).toBe("none");
    // "H|" from a sixth of the way (550 ms, where one letter of three rounds up) until halfway (650 ms).
    const toggle = shown[1]!.querySelector("animate")!;
    expect(attrs(toggle)).toMatchObject({ attributeName: "display", calcMode: "discrete", values: "none;inline;none" });
    const [, on, off] = toggle.getAttribute("keyTimes")!.split(";").map((k) => Number(k) * 1400);
    expect(on).toBeCloseTo(550, 0);
    expect(off).toBeCloseTo(650, 0);
  });

  it("loops forever by default, and holds the end with loop: false", () => {
    const loops = parse(svgAnimatedMarkup(bars)!).querySelectorAll(ANIMATIONS);
    for (const a of loops) expect(a.getAttribute("repeatCount")).toBe("indefinite");
    const once = parse(svgAnimatedMarkup(bars, { loop: false, duration: 3000 })!).querySelectorAll(ANIMATIONS);
    for (const a of once) {
      expect(a.getAttribute("fill")).toBe("freeze");
      expect(a.getAttribute("repeatCount")).toBeNull();
      expect(a.getAttribute("dur")).toBe("3s");
    }
  });

  it("splits a transform into <animateTransform>s, added up in order", () => {
    const motion: SvgMotion = {
      svg: `<svg viewBox="0 0 10 10"><g id="s" transform="translate(0 0) rotate(0 5 5)"/><g id="m" transform="matrix(1 0 0 1 0 0)"/></svg>`,
      animate: [
        { id: "s", attrs: { transform: ["translate(0 0) rotate(0 5 5)", "translate(10 0) rotate(360 5 5)"] }, ms: 1000, ease: "linear" },
        { id: "m", attrs: { transform: ["matrix(1 0 0 1 0 0)", "matrix(0 1 -1 0 0 0)"] }, ms: 1000, ease: "linear" },
      ],
    };
    const svg = parse(svgAnimatedMarkup(motion, { hold: 0 })!);
    expect([...svg.querySelectorAll("#s > animateTransform")].map(attrs)).toMatchObject([
      { type: "translate", values: "0 0;10 0" },
      { type: "rotate", additive: "sum", values: "0 5 5;360 5 5" },
    ]);
    // A matrix has no SMIL type: sampled as translate · rotate · skewX · scale, turning smoothly.
    const parts = [...svg.querySelectorAll("#m > animateTransform")];
    expect(parts.map((p) => p.getAttribute("type"))).toEqual(["translate", "rotate", "skewX", "scale"]);
    const angles = parts[1]!.getAttribute("values")!.split(";").map(Number);
    expect(angles[angles.length - 1]).toBeCloseTo(90, 0);
    for (let i = 1; i < angles.length; i++) expect(Math.abs(angles[i]! - angles[i - 1]!)).toBeLessThan(10);
  });

  it("follows a path with <animateMotion>, starting where the path does", () => {
    const motion: SvgMotion = {
      svg: `<svg viewBox="0 0 100 100"><path id="p" d="M10 20 L90 20"/><circle id="c" r="2" transform="translate(5 5)"/></svg>`,
      animate: [{ id: "c", along: "p", at: [0.25, 1], ms: 1000, ease: "linear" }],
    };
    const svg = parse(svgAnimatedMarkup(motion, { hold: 0 })!);
    const c = svg.querySelector("#c")!;
    expect(c.getAttribute("transform")).toBe("translate(30 20)");
    const move = c.querySelector("animateMotion")!;
    expect(attrs(move)).toMatchObject({ keyPoints: "0.25;1", keyTimes: "0;1", calcMode: "linear" });
    // Its path is referred to, so its id is made unique to this file.
    const path = svg.querySelector("path")!;
    expect(path.id).toMatch(/^p-\w+$/);
    expect(move.querySelector("mpath")!.getAttribute("href")).toBe(`#${path.id}`);
    expect(svgAnimatedMarkup(motion)).toBe(svgAnimatedMarkup(motion));
  });

  it("zooms with view, keeping fixed and non-scaling elements as the player does", () => {
    const motion: SvgMotion = {
      svg: `<svg viewBox="0 0 200 100"><g transform="translate(50 50)"><circle data-nonscaling="" r="4"/></g><text data-fixed="" y="10">Title</text></svg>`,
      animate: [{ view: [50, 25, 100, 50], ms: 1000, ease: "linear" }],
    };
    const svg = parse(svgAnimatedMarkup(motion, { hold: 0 })!);
    expect(svg.querySelector(":scope > animate")!.getAttribute("values")).toBe("0 0 200 100;50 25 100 50");
    expect(svg.querySelector("circle > animateTransform")!.getAttribute("values")).toBe("1;0.5");
    const layer = svg.querySelector("text")!.parentElement!;
    expect([...layer.querySelectorAll(":scope > animateTransform")].map((a) => a.getAttribute("values"))).toEqual([
      "0 0;50 25",
      "1;0.5",
    ]);
  });

  it("exports every catalog vector effect, small enough to ship", () => {
    const sizes: [string, number][] = [];
    for (const effect of findEffects({ kind: "vector" }) as VectorEffect[]) {
      const motion = renderVectorEffect(effect, effectDefaults(effect));
      // Click-triggered pictures change on steps: give them some.
      const steps = effect.trigger === "click" ? [1500, 3000] : [];
      const markup = svgAnimatedMarkup(motion, { hold: effect.hold, steps, idSuffix: "" })!;
      const svg = parse(markup);
      expect(markup).not.toMatch(/<script|\son\w+=/i);
      expect(markup.length).toBeLessThan(400_000);
      sizes.push([effect.id, markup.length]);
      // Without SMIL it is the first frame (except where text and paths followed are written differently).
      const changed = new Set((motion.animate ?? []).filter((a) => a.along || a.count || a.write !== undefined).map((a) => a.id));
      const first = still(markup);
      for (const el of parse(svgFrameMarkup(motion, { at: 0, steps })!).querySelectorAll("[id]")) {
        if (changed.has(el.id)) continue;
        expect(attrs(first.querySelector(`[id="${el.id}"]`)!), `${effect.id} #${el.id}`).toEqual(attrs(el));
      }
      expect(svg.querySelectorAll(ANIMATIONS).length, effect.id).toBeGreaterThan(0);
    }
    sizes.sort((a, b) => b[1] - a[1]);
    console.info("largest animated SVGs:", sizes.slice(0, 5).map(([id, n]) => `${id} ${(n / 1024).toFixed(1)} KB`).join(", "));
  }, 60_000);
});
