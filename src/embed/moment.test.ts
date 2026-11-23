import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEffect, shaderRestTime } from "../catalog/index.js";
import { ShaderRenderer } from "../shader/renderer.js";
import { installFakeWebGl } from "../shader/test-utils.js";
import { mountEffect, playMoment } from "./index.js";
import * as lazy from "./lazy.js";

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query }));
}

beforeEach(() => {
  reducedMotion(false);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("shaders under reduced motion", () => {
  it("ShaderRenderer holds one rest frame and will not play", () => {
    installFakeWebGl();
    reducedMotion(true);
    const renderer = new ShaderRenderer(document.createElement("div"), { restTime: 2.5 });
    expect(renderer.reducedMotion).toBe(true);
    expect(renderer.playing).toBe(false);
    expect(renderer.time).toBe(2.5);
    renderer.play();
    expect(renderer.playing).toBe(false);
    renderer.dispose();
  });

  it("animates with reducedMotion: \"never\", and holds a still with \"always\" whatever the visitor prefers", () => {
    installFakeWebGl();
    reducedMotion(true);
    const never = new ShaderRenderer(document.createElement("div"), { reducedMotion: "never" });
    expect(never.playing).toBe(true);
    never.dispose();
    reducedMotion(false);
    const always = new ShaderRenderer(document.createElement("div"), { reducedMotion: "always" });
    expect(always.playing).toBe(false);
    always.dispose();
  });

  it("mountEffect holds a shader at its rest time, and a one-shot at uProgress 1", () => {
    installFakeWebGl();
    reducedMotion(true);
    const aurora = mountEffect(document.createElement("div"), "aurora");
    expect(aurora.renderer!.playing).toBe(false);
    expect(aurora.renderer!.time).toBe(shaderRestTime(getEffect("aurora")!));
    aurora.play();
    expect(aurora.renderer!.playing).toBe(false);
    aurora.dispose();

    const host = document.createElement("div");
    const wipe = mountEffect(host, "transition-wipe", { loop: false, values: { uFrom: "/a.jpg", uTo: "/b.jpg" } });
    const seen: number[] = [];
    const set = wipe.renderer!.setValues.bind(wipe.renderer!);
    wipe.renderer!.setValues = (v) => {
      seen.push(Number(v?.uProgress));
      set(v);
    };
    wipe.play();
    vi.advanceTimersByTime(3000);
    expect(seen.every((p) => p === 1)).toBe(true);
    wipe.dispose();
  });
});

describe("playMoment", () => {
  it("plays once over the anchor, then removes its overlay and releases its GL context", async () => {
    installFakeWebGl();
    const disposed = vi.spyOn(ShaderRenderer.prototype, "dispose");
    const card = document.createElement("div");
    document.body.appendChild(card);
    const played = playMoment(card, "aurora", { duration: 500 });
    await vi.advanceTimersByTimeAsync(0);
    const overlay = document.querySelector<HTMLElement>("[data-flair-moment]")!;
    expect(overlay.dataset.flairMoment).toBe("aurora");
    expect(overlay.style.pointerEvents).toBe("none");
    expect(overlay.style.position).toBe("fixed");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.querySelector("canvas")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(await played).toBe(true);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
    // Disposing the renderer releases its context (WEBGL_lose_context) and removes its canvas.
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("plays nothing under reduced motion, without WebGL2, for an anchor off the page, or once aborted", async () => {
    installFakeWebGl();
    const card = document.createElement("div");
    expect(await playMoment(card, "aurora")).toBe(false);
    document.body.appendChild(card);
    reducedMotion(true);
    expect(await playMoment(card, "aurora")).toBe(false);
    reducedMotion(false);
    const aborted = new AbortController();
    aborted.abort();
    expect(await playMoment(card, "aurora", { signal: aborted.signal })).toBe(false);
    vi.restoreAllMocks();
    installFakeWebGl({ webgl: false });
    expect(await playMoment(card, "aurora")).toBe(false);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
  });

  it("stops early when aborted, and when the anchor leaves the page", async () => {
    installFakeWebGl();
    const card = document.createElement("div");
    document.body.appendChild(card);
    const stop = new AbortController();
    const played = playMoment(card, "aurora", { duration: 5000, signal: stop.signal });
    await vi.advanceTimersByTimeAsync(20);
    stop.abort();
    expect(await played).toBe(false);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
    const gone = playMoment(card, "aurora", { duration: 5000 });
    await vi.advanceTimersByTimeAsync(20);
    card.remove();
    await vi.advanceTimersByTimeAsync(50);
    expect(await gone).toBe(false);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
  });

  it("plays vector effects, and refuses kinds that are not drawn over an element", async () => {
    const card = document.createElement("div");
    document.body.appendChild(card);
    const played = playMoment("viewport", "success-check");
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector("[data-flair-moment] svg")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await played).toBe(true);
    await expect(playMoment(card, "camera-glide")).rejects.toThrow(/is a camera effect; a moment plays a shader or vector effect/);
    expect(() => playMoment(card, "nope")).toThrow(/no effect "nope"/);
  });
});

describe("@pixerate/flair/embed/lazy", () => {
  it("loads an effect by id and mounts it, the same effect the catalog has", async () => {
    installFakeWebGl();
    vi.useRealTimers();
    const mounted = await lazy.mountEffect(document.createElement("div"), "liquid-loader", { data: { value: 0.3 }, label: "Generating", autoplay: false });
    expect(mounted.effect.id).toBe("liquid-loader");
    expect(mounted.renderer).toBeDefined();
    expect(lazy.getLoadedEffect("liquid-loader")).toBe(mounted.effect);
    mounted.dispose();
  });

  it("rejects an unknown id, naming the nearest", async () => {
    vi.useRealTimers();
    await expect(lazy.mountEffect(document.createElement("div"), "auroa")).rejects.toThrow(/no effect "auroa".*"aurora"/);
  });

  it("does not load anything for a moment under reduced motion", async () => {
    vi.useRealTimers();
    reducedMotion(true);
    expect(await lazy.playMoment(document.body, "confetti-nonexistent-id")).toBe(false);
  });
});

describe("loaders take progress", () => {
  it("a shader loader shows a value, then plays its loop for null, and tells assistive tech", () => {
    installFakeWebGl();
    const mounted = mountEffect(document.createElement("div"), "liquid-loader", { data: { value: 0.4 }, label: "Generating image", autoplay: false });
    const canvas = mounted.renderer!.canvas;
    const values = () => (mounted.renderer as unknown as { values: Record<string, unknown> }).values;
    expect(values()).toMatchObject({ uProgress: 0.4, uAnimate: false });
    expect(canvas.getAttribute("role")).toBe("progressbar");
    expect(canvas.getAttribute("aria-label")).toBe("Generating image");
    expect(canvas.getAttribute("aria-valuenow")).toBe("40");
    mounted.setData!({ value: null });
    expect(values()).toMatchObject({ uAnimate: true });
    expect(canvas.hasAttribute("aria-valuenow")).toBe(false);
    expect(() => mounted.setData!({ value: 2 })).toThrow(/at most 1/);
    mounted.dispose();
  });

  it("a shader that is not a component refuses data", () => {
    installFakeWebGl();
    expect(() => mountEffect(document.createElement("div"), "aurora", { data: { value: 1 } })).toThrow(/not offered as a UI component/);
  });
});
