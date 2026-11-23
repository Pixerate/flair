import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_FRAMES, DEVICE_KINDS, effectInputs, findEffects, getEffect } from "../catalog/index.js";
import { findEffectMeta } from "../catalog/lazy.js";
import { callTool, createEffectToolProvider } from "../editor/agent.js";
import { createEffectEditor } from "../editor/editor.js";
import { installFakeWebGl } from "../shader/test-utils.js";
import { mountEffect, subjectValues } from "./index.js";
import * as lazy from "./lazy.js";

const shots = (n: number) => Array.from({ length: n }, (_, i) => ({ image: `/shot-${i + 1}.png` }));
const values = (m: ReturnType<typeof mountEffect>) => (m.renderer as unknown as { values: Record<string, unknown> }).values;

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query }));
}

beforeEach(() => {
  reducedMotion(false);
  installFakeWebGl();
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the montage category", () => {
  it("is browsed under Pictures, and found by category and by what it accepts", () => {
    expect(findEffects({ category: "montage" }).map((e) => e.id)).toEqual(["device-showcase", "screenshot-carousel"]);
    expect(findEffects({ accepts: ["items"] }).map((e) => e.id)).toEqual(["device-showcase", "screenshot-carousel"]);
    expect(findEffectMeta({ accepts: ["items"] }).map((m) => m.id)).toEqual(["device-showcase", "screenshot-carousel"]);
  });

  it("effectInputs reports the items input with its counts", () => {
    expect(effectInputs(getEffect("device-showcase")!).items).toEqual({ min: 1, max: 24, slots: ["uItem0", "uItem1", "uItem2", "uItem3", "uItem4"], cycle: "swap" });
    expect(effectInputs(getEffect("screenshot-carousel")!).items).toMatchObject({ cycle: "carousel", slots: ["uFrom", "uTo"] });
    expect(effectInputs(getEffect("device-showcase")!).accepts).toContain("items");
  });

  it("has a generic frame for every device kind, its screen inside it", () => {
    expect(Object.keys(DEVICE_FRAMES)).toEqual([...DEVICE_KINDS]);
    for (const frame of Object.values(DEVICE_FRAMES)) {
      const [x, y, w, h] = frame.screen;
      expect(x, frame.kind).toBeGreaterThanOrEqual(0);
      expect(y, frame.kind).toBeGreaterThanOrEqual(0);
      expect(x + w, frame.kind).toBeLessThanOrEqual(1);
      expect(y + h, frame.kind).toBeLessThanOrEqual(1);
    }
    expect(DEVICE_FRAMES.phone.aspect).toBeLessThan(1);
    expect(DEVICE_FRAMES.laptop.aspect).toBeGreaterThan(1);
  });
});

describe("subjectValues for a montage", () => {
  it("fills its slots with the first items, how many it shows and each device", () => {
    const showcase = getEffect("device-showcase")!;
    const v = subjectValues(showcase, [{ image: "/a.png", device: "laptop" }, { image: "/b.png", device: "phone" }]).values;
    expect(v).toEqual({ uItem0: "/a.png", uItem1: "/b.png", uDevice0: 2, uDevice1: 0, uCount: 2 });
    expect(subjectValues(showcase, shots(7)).values.uCount).toBe(5);
  });

  it("fills a carousel's shown and next screenshot, taking over from its preview loop", () => {
    expect(subjectValues(getEffect("screenshot-carousel")!, [{ image: "/a.png", device: "phone" }, { image: "/b.png" }]).values).toEqual({ uFrom: "/a.png", uTo: "/b.png", uDevice: 0, uProgress: 0, uAnimate: false });
  });

  it("refuses lists out of range, items that are not media, and unknown devices, saying what it takes", () => {
    const showcase = getEffect("device-showcase")!;
    expect(() => subjectValues(showcase, shots(25))).toThrow(/takes 1 to 24 items .* given 25/);
    expect(() => subjectValues(showcase, [{ image: "/a.png" }, { text: "hi" }])).toThrow(/item 2 is words/);
    expect(() => subjectValues(showcase, [{ image: "/a.png", device: "fridge" as never }])).toThrow(/devices are phone, tablet, laptop, desktop, watch, browser/);
  });
});

describe("mountEffect with a list of media", () => {
  it("swaps screens one device at a time, telling the page each item that comes in", () => {
    const seen: number[] = [];
    const m = mountEffect(document.createElement("div"), "device-showcase", { subject: shots(7), itemDuration: 1000, onItem: (i) => seen.push(i) });
    expect(values(m)).toMatchObject({ uItem0: "/shot-1.png", uItem4: "/shot-5.png", uCount: 5 });
    vi.advanceTimersByTime(1100);
    expect(values(m).uItem0).toBe("/shot-6.png");
    vi.advanceTimersByTime(1000);
    expect(values(m).uItem1).toBe("/shot-7.png");
    vi.advanceTimersByTime(1000);
    expect(values(m).uItem2).toBe("/shot-1.png");
    expect(seen).toEqual([5, 6, 0]);
    m.dispose();
  });

  it("a carousel changes from the shown screenshot to the next by running its progress", () => {
    const seen: number[] = [];
    const m = mountEffect(document.createElement("div"), "screenshot-carousel", { subject: shots(3), itemDuration: 1000, overlap: 400, onItem: (i) => seen.push(i) });
    expect(values(m)).toMatchObject({ uFrom: "/shot-1.png", uTo: "/shot-2.png", uProgress: 0, uAnimate: false });
    vi.advanceTimersByTime(1200);
    expect(Number(values(m).uProgress)).toBeGreaterThan(0);
    vi.advanceTimersByTime(300);
    expect(values(m)).toMatchObject({ uFrom: "/shot-2.png", uTo: "/shot-3.png", uProgress: 0 });
    expect(seen).toEqual([1]);
    m.dispose();
  });

  it("waits while the renderer is paused (scrolled out of view), and stops after the last item without loop", () => {
    const m = mountEffect(document.createElement("div"), "device-showcase", { subject: shots(6), itemDuration: 500, loop: false });
    m.pause();
    vi.advanceTimersByTime(2000);
    expect(values(m).uItem0).toBe("/shot-1.png");
    m.play();
    vi.advanceTimersByTime(600);
    expect(values(m).uItem0).toBe("/shot-6.png");
    vi.advanceTimersByTime(3000);
    expect(values(m).uItem1).toBe("/shot-2.png");
    m.dispose();
  });

  it("lays the first items out still under reduced motion", () => {
    reducedMotion(true);
    const m = mountEffect(document.createElement("div"), "device-showcase", { subject: shots(8), itemDuration: 200 });
    vi.advanceTimersByTime(2000);
    expect(values(m)).toMatchObject({ uItem0: "/shot-1.png", uCount: 5 });
    m.dispose();
  });

  it("swaps the whole list with setSubject", () => {
    const m = mountEffect(document.createElement("div"), "device-showcase", { subject: shots(2) });
    m.setSubject([{ image: "/x.png", device: "watch" }]);
    expect(values(m)).toMatchObject({ uItem0: "/x.png", uDevice0: 4, uCount: 1 });
    m.dispose();
  });

  it("pauses video items no slot shows, and plays those one does", () => {
    const clip = () => ({ play: vi.fn(() => Promise.resolve()), pause: vi.fn() }) as unknown as HTMLVideoElement;
    const videos = Array.from({ length: 7 }, clip);
    const m = mountEffect(document.createElement("div"), "device-showcase", { subject: videos.map((video) => ({ video })) });
    expect(videos[0]!.play).toHaveBeenCalled();
    expect(videos[6]!.pause).toHaveBeenCalled();
    m.dispose();
  });

  it("loads through the lazy entry without the full catalog", async () => {
    vi.useRealTimers();
    const m = await lazy.mountEffect(document.createElement("div"), "screenshot-carousel", { subject: shots(2), autoplay: false });
    expect(m.effect.items?.cycle).toBe("carousel");
    m.dispose();
  });
});

describe("items.set, for agents", () => {
  const run = async (from: string, params: Record<string, unknown>) => {
    const editor = createEffectEditor({ from });
    const tools = createEffectToolProvider(editor);
    const result = await callTool(tools, "run_command", { id: "items.set", params });
    const text = result.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
    return { editor, error: Boolean(result.isError), text, result: (result.structuredContent as { result?: Record<string, unknown> } | undefined)?.result };
  };

  it("fills a montage's slots, count and devices, and says how many it shows of how many", async () => {
    const { editor, error, result } = await run("device-showcase", { items: [{ image: "/a.png", device: "tablet" }, { image: "/b.png" }, { image: "/c.png" }, { image: "/d.png" }, { image: "/e.png" }, { image: "/f.png" }] });
    expect(error).toBe(false);
    expect(result).toMatchObject({ ok: true, shown: 5, of: 6 });
    expect(editor.getState().document.values).toMatchObject({ uItem0: "/a.png", uDevice0: 1, uCount: 5 });
  });

  it("refuses an effect that is not a montage, a bad device, and a list out of range, leaving the document alone", async () => {
    const plain = await run("aurora", { items: [{ image: "/a.png" }] });
    expect(plain).toMatchObject({ error: true, text: expect.stringContaining("is not a montage") });
    expect(plain.text).toContain("device-showcase");
    expect(await run("device-showcase", { items: [{ image: "/a.png", device: "fridge" }] })).toMatchObject({ error: true, text: expect.stringContaining("phone") });
    const many = await run("screenshot-carousel", { items: shots(25) });
    expect(many).toMatchObject({ error: true, text: expect.stringContaining("takes 1 to 24 items") });
    expect(many.editor.getState().document.values.uFrom).toBeUndefined();
    expect(await run("device-showcase", { items: [] })).toMatchObject({ error: true });
  });
});
