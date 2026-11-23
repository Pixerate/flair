import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeWebGl } from "../shader/test-utils.js";
import { flairMoment } from "./index.js";
import * as lazy from "./lazy.js";

const settle = () => new Promise((r) => setTimeout(r, 80));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
  installFakeWebGl();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("@pixerate/flair/svelte/lazy", () => {
  it("flairEffect loads an effect by id and mounts it, with the latest params", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const action = lazy.flairEffect(node, { effect: "flame-loader", data: { value: 0.1 }, label: "Rendering", autoplay: false });
    action.update!({ effect: "flame-loader", data: { value: 0.9 }, label: "Rendering", autoplay: false });
    await settle();
    expect(node.querySelector("canvas")!.getAttribute("aria-valuenow")).toBe("90");
    action.destroy!();
    expect(node.querySelector("canvas")).toBeNull();
  });

  it("flairEffect reports an unknown id to onError, and drops an effect that loads after destroy", async () => {
    const errors: string[] = [];
    lazy.flairEffect(document.createElement("div"), { effect: "auroa", onError: (e) => errors.push(e.message) });
    const node = document.createElement("div");
    lazy.flairEffect(node, { effect: "aurora", autoplay: false }).destroy!();
    await settle();
    expect(errors[0]).toMatch(/no effect "auroa"/);
    expect(node.querySelector("canvas")).toBeNull();
  });

  it("vectorEffectStill asks for an effect to be loaded first", async () => {
    expect(() => lazy.vectorEffectStill({ id: "drip-text-lazy-missing" })).toThrow(/has not been loaded; await loadEffect/);
    await lazy.loadEffect("drip-text");
    expect(lazy.vectorEffectStill({ id: "drip-text" }).markup).toContain("<svg");
  });
});

describe("flairMoment", () => {
  it("plays on mount without a key, and again each time the key changes", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const done: boolean[] = [];
    const action = flairMoment(node, { effect: "aurora", duration: 10, key: 1, onDone: (p) => done.push(p) });
    await settle();
    expect(done).toEqual([]);
    action.update!({ effect: "aurora", duration: 10, key: 2, onDone: (p) => done.push(p) });
    await settle();
    expect(done).toEqual([true]);
    action.update!({ effect: "aurora", duration: 10, key: 2, onDone: (p) => done.push(p) });
    await settle();
    expect(done).toEqual([true]);
    const once = flairMoment(node, { effect: "aurora", duration: 10_000, onDone: (p) => done.push(p) });
    await settle();
    expect(document.querySelector("[data-flair-moment]")).not.toBeNull();
    once.destroy!();
    await settle();
    expect(done).toEqual([true, false]);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
  });
});
