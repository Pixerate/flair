import { describe, expect, it } from "vitest";
import { ManualClock } from "../time/clock.js";
import { parseSvg, svgDuration, SvgPlayer, svgView } from "./svg.js";
import type { SvgMotion } from "./motion.js";

const media: SvgMotion = {
  svg: `<svg viewBox="0 0 200 100" onload="evil()">
    <script>evil()</script>
    <rect id="bar" x="10" y="100" width="20" height="0" fill="#000000"/>
    <path id="route" d="M0 50 L200 50" stroke="#333"/>
    <text id="total">0</text>
    <image href="https://x.test/a.png"/>
  </svg>`,
  animate: [
    { id: "bar", attrs: { y: [100, 20], height: [0, 80] }, ms: 1000, ease: "linear" },
    { id: "bar", step: 1, attrs: { fill: ["#000000", "#ff0000"] }, ms: 0 },
    { id: "route", step: 1, draw: true, ms: 1000, ease: "linear" },
    { id: "total", count: [0, 80], format: "{n}%", ms: 1000, ease: "linear" },
  ],
};

describe("parseSvg", () => {
  it("drops scripts, handlers and outside links", () => {
    const svg = parseSvg(media.svg)!;
    expect(svg.querySelector("script")).toBeNull();
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.querySelector("image")!.getAttribute("href")).toBeNull();
    expect(parseSvg("<div>no</div>")).toBeUndefined();
  });
});

describe("svgView", () => {
  it("draws each frame from the time and steps alone", () => {
    const view = svgView(media);
    const bar = () => view.element.querySelector("#bar")!;
    view.draw(500, []);
    expect(bar().getAttribute("height")).toBe("40");
    expect(bar().getAttribute("y")).toBe("60");
    expect(view.element.querySelector("#total")!.textContent).toBe("40%");
    // The route waits for step 1, hidden until then
    const route = view.element.querySelector("#route")!;
    expect(route.getAttribute("stroke-dashoffset")).toBe("1");
    view.draw(3500, [3000]);
    expect(route.getAttribute("stroke-dashoffset")).toBe("0.5");
    expect(bar().getAttribute("fill")).toBe("#ff0000");
    // Back in time (a seek) gives the earlier frame again
    view.draw(500, []);
    expect(bar().getAttribute("fill")).toBe("#000000");
    expect(bar().getAttribute("height")).toBe("40");
  });
});

describe("svgView views and variables", () => {
  it("zooms the picture to a box and back to the whole", () => {
    const view = svgView({
        svg: '<svg viewBox="0 0 800 500"><rect id="r" width="10" height="10"/></svg>',
      animate: [
        { view: [100, 100, 400, 250], ms: 1000, ease: "linear" },
        { view: [0, 0, 800, 500], step: 1, ms: 1000, ease: "linear" },
      ],
    });
    const box = () => view.element.querySelector("svg")!.getAttribute("viewBox");
    view.draw(500, []);
    expect(box()).toBe("50 50 600 375");
    view.draw(5000, [9000]);
    expect(box()).toBe("100 100 400 250");
    view.draw(9500, [9000]);
    expect(box()).toBe("50 50 600 375");
  });

  it("keeps the whole picture where an element cannot be measured", () => {
    // jsdom lays nothing out, so an element's box is unknown
    const view = svgView({
        svg: '<svg viewBox="0 0 800 500"><path id="leg" d="M0 0 L10 10"/><circle id="dot"/></svg>',
      animate: [
        { view: "leg", ms: 0 },
        { id: "dot", along: "leg", ms: 0 },
      ],
    });
    view.draw(100, []);
    expect(view.element.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 800 500");
  });

  it("keeps data-fixed elements in an unzoomed layer over the picture", () => {
    const view = svgView({
        svg: '<svg viewBox="0 0 800 500" font-family="Inter"><text id="title" data-fixed="">Route</text><path id="leg" d="M0 0 L10 10"/></svg>',
      animate: [
        { view: [0, 0, 400, 250], ms: 0 },
        { id: "title", attrs: { opacity: [0, 1] }, ms: 0 },
      ],
    });
    view.draw(100, []);
    const [picture, layer] = [...view.element.querySelectorAll("svg")];
    expect(picture!.getAttribute("viewBox")).toBe("0 0 400 250");
    expect(layer!.getAttribute("viewBox")).toBe("0 0 800 500");
    expect(layer!.getAttribute("font-family")).toBe("Inter");
    // Still animated by id where it moved
    expect(layer!.querySelector("#title")!.getAttribute("opacity")).toBe("1");
    expect(picture!.querySelector("#title")).toBeNull();
  });

  it("keeps data-nonscaling elements the same size on screen as the picture zooms", () => {
    const view = svgView({
        svg: '<svg viewBox="0 0 800 500"><g transform="translate(100 100)"><g id="pin" data-nonscaling=""><circle r="6"/></g></g></svg>',
      animate: [{ view: [0, 0, 200, 125], step: 1, ms: 0 }],
    });
    const pin = () => view.element.querySelector("#pin")!;
    view.draw(0, []);
    expect(pin().getAttribute("transform")).toBeNull();
    // Zoomed in 4×: drawn at a quarter of its size, so it looks the same
    view.draw(5000, [1000]);
    expect(pin().getAttribute("transform")).toBe("scale(0.25)");
  });
});

describe("SvgPlayer", () => {
  it("loops the picture on its clock, and seeks", async () => {
    const clock = new ManualClock();
    const host = document.createElement("div");
    const player = new SvgPlayer(host, media, { clock, hold: 0 });
    expect(player.duration).toBe(svgDuration(media));
    expect(player.duration).toBe(1000);
    const height = () => host.querySelector("#bar")!.getAttribute("height");
    expect(height()).toBe("0");
    await clock.advance(16);
    await clock.advance(484);
    expect(height()).toBe("40");
    player.seek(1250);
    expect(height()).toBe("20");
    player.pause();
    await clock.advance(400);
    expect(height()).toBe("20");
    player.dispose();
    expect(host.querySelector("svg")).toBeNull();
  });

  it("pauses and resumes when scrolled out of view with pauseWhenHidden", () => {
    let callback: IntersectionObserverCallback | null = null;
    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    const origObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const clock = new ManualClock();
      const host = document.createElement("div");
      const player = new SvgPlayer(host, media, { clock, pauseWhenHidden: true });
      expect(player.isPlaying).toBe(true);

      // Scrolled out of view
      callback!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(player.isPlaying).toBe(false);

      // Scrolled back into view
      callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(player.isPlaying).toBe(true);

      player.dispose();
    } finally {
      globalThis.IntersectionObserver = origObserver;
    }
  });
});
