import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_FRAMES, DEVICE_KINDS, effectControls, effectDefaults, effectInputs, findEffects, getEffect, renderVectorEffect, vectorItems, type VectorEffect } from "../catalog/index.js";
import { findEffectMeta } from "../catalog/lazy.js";
import { callTool, createEffectToolProvider } from "../editor/agent.js";
import { createEffectEditor } from "../editor/editor.js";
import { installFakeWebGl } from "../shader/test-utils.js";
import { mountEffect, subjectValues } from "./index.js";
import * as lazy from "./lazy.js";

const MONTAGES = ["device-showcase", "screenshot-carousel", "device-morph", "bento-montage", "photo-scatter", "filmstrip-montage", "split-grid-reveal", "orbit-gallery", "before-after-series", "wall-zoom", "logo-wall"];
const LOGO = `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
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
    expect(findEffects({ category: "montage" }).map((e) => e.id)).toEqual(MONTAGES);
    expect(findEffects({ accepts: ["items"] }).map((e) => e.id)).toEqual(MONTAGES);
    expect(findEffectMeta({ accepts: ["items"] }).map((m) => m.id)).toEqual(MONTAGES);
  });

  it.each(MONTAGES)("%s has items, presets and a rest frame, and its slots are image controls", (id) => {
    const effect = getEffect(id)!;
    expect(effect.items, id).toBeDefined();
    expect(effect.presets?.length, id).toBeGreaterThanOrEqual(3);
    const names = new Set(effectControls(effect).map((c) => c.name));
    for (const slot of effect.items!.slots) expect(effectControls(effect).find((c) => c.name === slot)?.type, slot).toBe("sampler2D");
    for (const name of [effect.items!.count, effect.items!.list, ...(effect.items!.devices ?? [])].filter(Boolean)) expect(names.has(name!), name).toBe(true);
    if (effect.kind === "shader") {
      expect(effect.rest, id).toBeDefined();
      // Six items fill six slots (the bench's case), short of the device ones.
      expect(effect.items!.slots.length, id).toBeGreaterThanOrEqual(effect.items!.devices ? 2 : 6);
    }
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

describe("vector montages: markup that follows the item count", () => {
  const wall = getEffect("logo-wall") as VectorEffect;
  const list = (n: number, label = (i: number) => `Brand ${i + 1}`) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ href: "data:image/svg+xml,x", label: label(i) })));

  it("reports its items as a list control, not as words to fill", () => {
    const inputs = effectInputs(wall);
    expect(inputs.items).toEqual({ min: 1, max: 24, slots: [], cycle: "repeat", list: "items" });
    expect(inputs.accepts).toEqual(["items"]);
    expect(inputs.texts).toEqual([]);
  });

  it("writes each repeat block, and each item animation, once per item, staggered", () => {
    for (const n of [1, 3, 11]) {
      const motion = renderVectorEffect(wall, { ...effectDefaults(wall), items: list(n) });
      expect(motion.svg.match(/<rect id="logoWallCard\d+"/g), String(n)).toHaveLength(n);
      expect(motion.svg).not.toMatch(/\{\{/);
      const pops = motion.animate!.filter((a) => /^logoWallItem\d+$/.test(a.id!) && a.attrs?.opacity);
      expect(pops.map((a) => a.id)).toEqual(Array.from({ length: n }, (_, i) => `logoWallItem${i}`));
      expect(pops.map((a) => a.delay ?? 0)).toEqual(Array.from({ length: n }, (_, i) => i * 90));
      expect(JSON.stringify(motion.animate)).not.toMatch(/\{\{/);
    }
  });

  it("lays any count out inside the frame, each card in its own cell", () => {
    for (const n of [1, 2, 5, 6, 7, 24]) {
      const boxes = Array.from({ length: n }, (_, i) => wall.itemDerived!(i, n, effectDefaults(wall)) as Record<string, number>);
      for (const b of boxes) {
        expect(b.cx - b.w / 2, String(n)).toBeGreaterThanOrEqual(0);
        expect(b.cx + b.w / 2, String(n)).toBeLessThanOrEqual(640);
        expect(b.cy - b.h / 2, String(n)).toBeGreaterThanOrEqual(0);
        expect(b.cy + b.h / 2, String(n)).toBeLessThanOrEqual(360);
      }
      expect(new Set(boxes.map((b) => `${b.cx},${b.cy}`)).size, String(n)).toBe(n);
    }
  });

  it("escapes labels, braces too, and leaves out items it cannot show", () => {
    const motion = renderVectorEffect(wall, { items: list(1, () => `<b>{{accent}}</b>`) });
    expect(motion.svg).toContain("&lt;b&gt;&#123;&#123;accent&#125;&#125;&lt;/b&gt;");
    expect(vectorItems(wall, JSON.stringify([{ href: "https://example.com/a.png" }, { href: "data:image/png;base64,AA", label: 3 }, "x", { label: "Only words" }]))).toEqual([{ href: "data:image/png;base64,AA" }, { label: "Only words" }]);
    expect(vectorItems(wall, "not json")).toEqual([]);
    expect(renderVectorEffect(wall, { items: "not json" }).svg).not.toContain("logoWallCard");
  });

  it("takes SVGs and data: pictures as subjects, and refuses pictures by URL and video, saying what to do", () => {
    const v = subjectValues(wall, [{ svg: LOGO, label: "Acme" }, { image: "data:image/png;base64,AA" }]).values;
    expect(JSON.parse(v.items as string)).toEqual([{ href: expect.stringMatching(/^data:image\/svg\+xml/), label: "Acme" }, { href: "data:image/png;base64,AA" }]);
    expect(() => subjectValues(wall, [{ image: "/a.png" }])).toThrow(/data:image.*shader montage/);
    expect(() => subjectValues(wall, [{ video: document.createElement("video") }])).toThrow(/not video/);
  });

  it("mounts with its items, and setSubject redraws for a new count", () => {
    const host = document.createElement("div");
    const m = mountEffect(host, "logo-wall", { subject: [{ svg: LOGO }, { svg: LOGO }], autoplay: false });
    expect(host.querySelectorAll("rect[data-flair-id^='logoWallCard'], rect[id^='logoWallCard']")).toHaveLength(2);
    m.setSubject([{ svg: LOGO }, { svg: LOGO }, { svg: LOGO }, { svg: LOGO }]);
    expect(host.querySelectorAll("rect[data-flair-id^='logoWallCard'], rect[id^='logoWallCard']")).toHaveLength(4);
    m.dispose();
  });
});

describe("items.set on a vector montage", () => {
  const run = async (params: Record<string, unknown>) => {
    const editor = createEffectEditor({ from: "logo-wall" });
    const result = await callTool(createEffectToolProvider(editor), "run_command", { id: "items.set", params });
    const text = result.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
    return { editor, error: Boolean(result.isError), text, result: (result.structuredContent as { result?: Record<string, unknown> } | undefined)?.result };
  };

  it("keeps every item in the list control, so the picture follows the count", async () => {
    const { editor, error, result } = await run({ items: [{ svg: LOGO, label: "Acme" }, { image: "data:image/png;base64,AA" }, { svg: LOGO }] });
    expect(error).toBe(false);
    expect(result).toMatchObject({ ok: true, shown: 3, of: 3 });
    expect(JSON.parse(editor.getState().document.values.items as string)).toHaveLength(3);
  });

  it("refuses pictures by URL, and items with no picture or two, leaving the document alone", async () => {
    const remote = await run({ items: [{ image: "https://example.com/a.png" }] });
    expect(remote).toMatchObject({ error: true, text: expect.stringContaining("vector montage") });
    expect(remote.editor.getState().document.values.items).toBeUndefined();
    expect(await run({ items: [{ label: "No picture" }] })).toMatchObject({ error: true, text: expect.stringContaining("neither") });
    expect(await run({ items: [{ image: "data:image/png;base64,AA", svg: LOGO }] })).toMatchObject({ error: true, text: expect.stringContaining("both") });
  });
});
