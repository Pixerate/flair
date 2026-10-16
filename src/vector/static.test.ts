import { describe, expect, it } from "vitest";
import { effectDefaults, findEffects, renderVectorEffect, type VectorEffect } from "../catalog/index.js";
import { parseViewBox, svgFrameMarkup, svgViewBox } from "./static.js";
import { parseSvg, svgDuration, svgView } from "./svg.js";
import type { SvgMotion } from "./motion.js";

const media: SvgMotion = {
  svg: `<svg viewBox="0 0 200 100" onload="evil()">
    <script>evil()</script><foreignObject><div>html</div></foreignObject>
    <rect id="bar" x="10" y="100" width="20" height="0" fill="#000000"/>
    <path id="route" d="M0 50 L200 50" stroke="#333"/>
    <text id="total">0</text>
    <g id="pick"><circle r="1"/><circle r="2"/></g>
    <image href="https://x.test/a.png"/><use href="#bar"/>
    <style>.a > .b { fill: red }</style>
  </svg>`,
  animate: [
    { id: "bar", attrs: { y: [100, 20], height: [0, 80] }, ms: 1000, ease: "linear" },
    { id: "route", draw: true, ms: 1000, ease: "linear" },
    { id: "total", count: [0, 80], format: "{n}% & <more>", ms: 1000, ease: "linear" },
    { id: "pick", solo: 1, ms: 1000 },
  ],
};

describe("svgFrameMarkup", () => {
  it("draws the last frame by default, safely", () => {
    const markup = svgFrameMarkup(media)!;
    expect(markup).not.toMatch(/script|onload|foreignObject|x\.test|<div/i);
    const svg = parseSvg(markup)!;
    expect(svg.querySelector("#bar")!.getAttribute("height")).toBe("80");
    expect(svg.querySelector("#route")!.getAttribute("stroke-dashoffset")).toBe("0");
    expect(svg.querySelector("#total")!.textContent).toBe("80% & <more>");
    expect([...svg.querySelectorAll("#pick > circle")].map((c) => c.getAttribute("display"))).toEqual(["none", null]);
    expect(svg.querySelector("use")!.getAttribute("href")).toBe("#bar");
    expect(svg.querySelector("style")!.textContent).toBe(".a > .b { fill: red }");
    expect(svg.getAttribute("width")).toBe("100%");
  });

  it("takes a time or the first frame", () => {
    expect(parseSvg(svgFrameMarkup(media, { at: "first" })!)!.querySelector("#bar")!.getAttribute("height")).toBe("0");
    expect(parseSvg(svgFrameMarkup(media, { at: 500 })!)!.querySelector("#bar")!.getAttribute("height")).toBe("40");
  });

  it("is undefined for markup that is not an svg", () => {
    expect(svgFrameMarkup({ svg: "<div>no</div>" })).toBeUndefined();
  });

  it("matches the player's last frame for every catalog vector effect", () => {
    const effects = findEffects({ kind: "vector" }) as VectorEffect[];
    expect(effects.length).toBeGreaterThan(10);
    for (const effect of effects) {
      const motion = renderVectorEffect(effect, effectDefaults(effect));
      const end = svgDuration(motion);
      const view = svgView(motion);
      view.draw(end);
      const live = view.element.querySelector("svg")!;
      const still = parseSvg(svgFrameMarkup(motion)!);
      expect(still, effect.id).toBeDefined();
      // Moves along paths need layout, which neither has here.
      const along = new Set((motion.animate ?? []).filter((a) => a.along).map((a) => a.id));
      // The live view gives ids it refers to a suffix (unique on the page): compare by the ids as written.
      const scoped = new Map([...live.querySelectorAll("[data-flair-id]")].map((el) => [el.id, el.getAttribute("data-flair-id")!]));
      const unscoped = (value: string) => value.replace(/#([\w.-]+)/g, (whole, id: string) => (scoped.has(id) ? `#${scoped.get(id)}` : whole));
      for (const el of live.querySelectorAll("[id]")) {
        const id = el.getAttribute("data-flair-id") ?? el.id;
        if (along.has(id)) continue;
        const other = still!.querySelector(`[id="${CSS.escape(id)}"]`);
        expect(other, `${effect.id} #${id}`).not.toBeNull();
        for (const attr of el.attributes) {
          if (attr.name === "data-flair-id" || attr.name === "id") continue;
          expect(other!.getAttribute(attr.name), `${effect.id} #${id} ${attr.name}`).toBe(unscoped(attr.value));
        }
        expect(other!.textContent, `${effect.id} #${id}`).toBe(el.textContent);
      }
    }
  });
});

describe("svgViewBox", () => {
  it("reads the opening tag's viewBox", () => {
    expect(svgViewBox(`<svg xmlns="x" viewBox="10 20 300 75"><g viewBox="0 0 1 1"/></svg>`)).toEqual([10, 20, 300, 75]);
    expect(svgViewBox(`<svg viewBox='0,0,4,2'/>`)).toEqual([0, 0, 4, 2]);
    expect(svgViewBox(`<svg/>`)).toBeUndefined();
    expect(parseViewBox("0 0 0 10")).toBeUndefined();
  });
});
