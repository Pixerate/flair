import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { softSweep, textTreatmentPlan } from "../catalog/treatment.js";
import { mountEffect, subjectValues } from "./index.js";
import { caretAt, drawTextTreatmentPlans, mountTextTreatment, previewTextTreatment, rangeRects, treatmentOf } from "./treatment.js";

const line = { x: 10, y: 20, width: 100, height: 18 };

/** A container with a manual clock and no animation frames, so tests draw frames themselves. */
function setup(options: Parameters<typeof mountTextTreatment>[2] = {}) {
  const container = document.createElement("div");
  container.textContent = "Some text to treat.";
  document.body.appendChild(container);
  let now = 0;
  const overlay = mountTextTreatment(container, "soft-sweep", { autoplay: false, reducedMotion: "never", clock: () => now, ...options });
  return { container, overlay, at: (ms: number) => ((now = ms), overlay.render()) };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("mountTextTreatment", () => {
  it("puts an SVG behind the text and one above it, making the container a stacking context, and puts it back on dispose", () => {
    const { container, overlay } = setup();
    expect(container.firstChild).toBe(overlay.behind);
    expect(container.lastChild).toBe(overlay.above);
    expect(overlay.behind.style.zIndex).toBe("-1");
    expect(overlay.above.style.pointerEvents).toBe("none");
    expect(container.style.position).toBe("relative");
    expect(container.style.isolation).toBe("isolate");
    overlay.dispose();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.style.position).toBe("");
    expect(container.style.isolation).toBe("");
  });

  it("draws a stage's plan as it plays: the sweep behind the text with a gradient, until it finishes", async () => {
    const { overlay, at } = setup();
    const onDone = vi.fn();
    const playback = overlay.play("checking", { lines: [line] }, { onDone });
    at(235);
    const rect = overlay.behind.querySelector("rect")!;
    expect(rect.getAttribute("data-source")).toBe("band");
    expect(rect.getAttribute("fill")).toMatch(/^url\(#flair-tt\d+-g0\)$/);
    const gradient = overlay.behind.querySelector("linearGradient")!;
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect([...gradient.querySelectorAll("stop")].map((s) => s.getAttribute("stop-opacity"))).toEqual(["0", "0.22", "0"]);
    expect(playback.plan).toEqual(textTreatmentPlan(softSweep, { stage: "checking", time: 235, target: { lines: [line] } }));
    at(10_000);
    await playback.finished;
    expect(onDone).toHaveBeenCalledOnce();
    expect(overlay.behind.querySelector("rect")).toBeNull();
  });

  it("follows a target that changes while it plays, and plays several stages at once", () => {
    const { overlay, at } = setup();
    let x = 50;
    overlay.play("caret", () => ({ caret: { x, y: 0, height: 20 }, label: "Claude" }));
    overlay.play("landed", { lines: [line] });
    at(10);
    const caret = () => overlay.above.querySelector('rect[data-source="caret"]')!;
    expect(caret().getAttribute("x")).toBe("49");
    expect(overlay.above.querySelector('g[data-source="tag"] text')!.textContent).toBe("Claude");
    expect(overlay.behind.querySelector('rect[data-source="fill"]')).not.toBeNull();
    x = 80;
    at(20);
    expect(caret().getAttribute("x")).toBe("79");
  });

  it("draws the typed word over a cover in the host's background, in the host's font", () => {
    const { overlay, at } = setup();
    overlay.play("typing", { lines: [line], caret: { x: 60, y: 20, height: 18 }, text: "wor", background: "#fafafa", color: "#222222", font: "16px Georgia" });
    at(0);
    const cover = overlay.above.querySelector('rect[data-source="cover"]')!;
    expect(cover.getAttribute("fill")).toBe("rgb(250, 250, 250)");
    const ghost = overlay.above.querySelector('text[data-source="ghost"]') as SVGTextElement;
    expect(ghost.textContent).toBe("wor");
    expect(ghost.style.font).toMatch(/Georgia/);
    expect(ghost.getAttribute("fill")).toBe("rgb(34, 34, 34)");
  });

  it("stops a looping stage on stop(), and everything on clear()", async () => {
    const { overlay, at } = setup();
    const caret = overlay.play("caret", { caret: { x: 5, y: 0, height: 20 } });
    at(5000);
    expect(overlay.above.querySelector("rect")).not.toBeNull();
    caret.stop();
    await caret.finished;
    expect(overlay.above.querySelector("rect")).toBeNull();
    overlay.play("caret", { caret: { x: 5, y: 0, height: 20 } });
    overlay.clear();
    expect(overlay.above.querySelector("rect")).toBeNull();
  });

  it("draws without motion when asked (or when the visitor prefers it)", () => {
    const { overlay, at } = setup({ reducedMotion: "always" });
    expect(overlay.reduceMotion).toBe(true);
    const playback = overlay.play("landed", { lines: [line] });
    at(450);
    expect(playback.plan!.reduced).toBe(true);
    expect(overlay.behind.querySelector("rect")!.getAttribute("opacity")).toBe("0.5");
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)" }));
    const user = setup({ reducedMotion: "user" });
    expect(user.overlay.reduceMotion).toBe(true);
    expect(setup({ reducedMotion: "never" }).overlay.reduceMotion).toBe(false);
  });

  it("changes values and treatments, refusing bad ones with a sentence", () => {
    const { overlay, at } = setup();
    overlay.setValues({ color: "#00ff00" });
    overlay.play("landed", { lines: [line] });
    at(0);
    expect(overlay.behind.querySelector("rect")!.getAttribute("fill")).toBe("rgb(0, 255, 0)");
    expect(() => overlay.setValues({ tintAlpha: 9 })).toThrow(/tintAlpha/);
    overlay.setEffect("marker-swipe");
    at(1);
    // The colour carries over; the marker blends like ink.
    const mark = overlay.behind.querySelector("rect")!;
    expect(mark.getAttribute("fill")).toBe("rgb(0, 255, 0)");
    expect(mark.getAttribute("style")).toMatch(/mix-blend-mode: multiply/);
    expect(() => overlay.setEffect("marker")).toThrow(/no text treatment "marker".*marker-swipe/);
  });

  it("refuses an unknown treatment, a bad stage or a bad target up front", () => {
    const { overlay } = setup();
    expect(() => treatmentOf("aurora")).toThrow(/no text treatment "aurora"/);
    expect(() => overlay.play("glowing" as never, { lines: [line] })).toThrow(/no stage "glowing"/);
    expect(() => overlay.play("checking", { lines: [{ x: 0, y: 0, width: 5 } as never] })).toThrow(/Line 0 of the target/);
    expect(() => mountTextTreatment(document.createElement("div"), "soft-sweep", { values: { nope: 1 } })).toThrow(/no control "nope"/);
  });
});

describe("drawTextTreatmentPlans", () => {
  it("draws outlines inside their rectangles, glows as drop shadows and tags as pills", () => {
    const behind = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const above = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    drawTextTreatmentPlans({ behind, above }, [
      {
        stage: "checking",
        time: 0,
        duration: 1,
        done: false,
        reduced: false,
        layers: [
          { kind: "rect", source: "fill", z: "behind", x: 0, y: 0, width: 10, height: 10, radius: 3, opacity: 1, color: [1, 0, 0, 1], stroke: 2, blend: "normal" },
          { kind: "rect", source: "caret", z: "above", x: 4, y: 0, width: 2, height: 10, radius: 0, opacity: 1, color: [0, 0, 1, 1], glow: 6, blend: "normal" },
          { kind: "tag", source: "tag", z: "above", x: 3, y: -20, width: 0, height: 17.6, radius: 4, opacity: 1, color: [0, 0, 1, 1], text: "Ada", size: 11, padX: 6.6, textColor: [1, 1, 1, 1], blend: "normal" },
        ],
      },
    ]);
    const outline = behind.querySelector("rect")!;
    expect([outline.getAttribute("x"), outline.getAttribute("width"), outline.getAttribute("fill"), outline.getAttribute("stroke-width"), outline.getAttribute("rx")]).toEqual(["1", "8", "none", "2", "2"]);
    expect(above.querySelector('rect[data-source="caret"]')!.getAttribute("style")).toMatch(/drop-shadow\(0 0 6px/);
    const pill = above.querySelector('g[data-source="tag"] rect')!;
    expect(Number(pill.getAttribute("width"))).toBeGreaterThan(13.2);
  });
});

describe("ribbons", () => {
  it("draw as one group of polygons, so the overlapping pieces share its opacity, glow and blend", () => {
    const { overlay, at } = setup();
    overlay.setEffect("ribbon-curl");
    overlay.setValues({ darkTheme: true });
    overlay.play("landed", { lines: [line], caret: { x: 110, y: 20, height: 18 } });
    at(1450);
    const frost = overlay.above.querySelector('g[data-source="ribbon"]')!;
    expect(frost.querySelectorAll("polygon").length).toBeGreaterThan(3);
    expect(frost.getAttribute("style")).toMatch(/mix-blend-mode: screen.*drop-shadow/);
  });
});

describe("rangeRects and caretAt", () => {
  it("give a range's lines in the container's coordinates, one per line, from its text", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>first part <b>bold</b> wraps</p>";
    document.body.appendChild(container);
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50 } as DOMRect);
    const rectsByText: Record<string, DOMRect[]> = {
      "first part ": [{ left: 110, top: 60, width: 70, height: 18, right: 180 } as DOMRect],
      bold: [{ left: 180, top: 60, width: 30, height: 18, right: 210 } as DOMRect],
      " wraps": [{ left: 210, top: 60, width: 5, height: 18, right: 215 } as DOMRect, { left: 100, top: 84, width: 40, height: 18, right: 140 } as DOMRect],
    };
    // jsdom has no layout: each text node's rectangles, as a browser would give them.
    Range.prototype.getClientRects = function (this: Range) {
      const node = this.startContainer as Text;
      if (this.startOffset === 0 && this.endOffset === node.length) return rectsByText[node.data] as unknown as DOMRectList;
      // A single character, for caretAt: the first letter of "wraps" on the second line.
      return [{ left: 100, top: 84, width: 8, height: 18, right: 108 }] as unknown as DOMRectList;
    };
    onTestFinished(() => {
      delete (Range.prototype as Partial<Range>).getClientRects;
    });
    const range = document.createRange();
    const p = container.querySelector("p")!;
    range.selectNodeContents(p);
    expect(rangeRects(range, container)).toEqual([
      { x: 10, y: 10, width: 105, height: 18 },
      { x: 0, y: 34, width: 40, height: 18 },
    ]);
    const wraps = p.lastChild as Text;
    expect(caretAt(wraps, 1, container)).toEqual({ x: 0, y: 34, height: 18 });
    expect(caretAt(wraps, wraps.length, container)).toEqual({ x: 8, y: 34, height: 18 });
  });
});

describe("the scripted preview", () => {
  it("plays the edit on a paragraph of its own, and is what mountEffect mounts for a treatment", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const preview = previewTextTreatment(host, "soft-sweep", { autoplay: false });
    expect(preview.element.textContent).toMatch(/It checks each sentance, fixes the odd wrod/);
    preview.dispose();
    expect(host.children).toHaveLength(0);

    const mounted = mountEffect(host, "marker-swipe", { autoplay: false });
    expect(mounted.element.querySelector("p")!.textContent).toMatch(/sentance/);
    expect(mounted.element.querySelectorAll("svg[data-flair-treatment='marker-swipe']")).toHaveLength(2);
    expect(() => mounted.setSubject({ text: "hi" })).toThrow(/text treatment.*takes no subject.*mountTextTreatment/);
    mounted.dispose();
    expect(() => subjectValues(softSweep, { image: "/a.png" })).toThrow(/mountTextTreatment/);
  });
});
