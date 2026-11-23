// @vitest-environment jsdom
import { act, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeWebGl } from "../shader/test-utils.js";
import { useFlairMoment } from "./index.js";
import * as lazy from "./lazy.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
  installFakeWebGl();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

describe("@pixerate/flair/react/lazy", () => {
  it("<FlairEffect> loads an effect by id, then mounts it with the latest data", async () => {
    root = createRoot(container);
    act(() => root!.render(<lazy.FlairEffect effect="liquid-loader" data={{ value: 0.2 }} label="Working" autoplay={false} className="job" />));
    expect(container.querySelector("canvas")).toBeNull();
    // New data while it loads: applied once it has mounted.
    act(() => root!.render(<lazy.FlairEffect effect="liquid-loader" data={{ value: 0.7 }} label="Working" autoplay={false} className="job" />));
    await settle();
    const canvas = container.querySelector("canvas")!;
    expect(canvas.getAttribute("aria-valuenow")).toBe("70");
  });

  it("<FlairEffect> reports an unknown id to onError", async () => {
    const errors: string[] = [];
    root = createRoot(container);
    act(() => root!.render(<lazy.FlairEffect effect="auroa" onError={(e) => errors.push(e.message)} />));
    await settle();
    expect(errors[0]).toMatch(/no effect "auroa"/);
  });

  it("<VectorEffect> asks for an effect to be loaded first", async () => {
    root = createRoot(container);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => act(() => root!.render(<lazy.VectorEffect id="drip-text" />))).toThrow(/has been loaded \(await loadEffect\(id\) first\)/);
    spy.mockRestore();
    root = undefined;
    await lazy.loadEffect("drip-text");
    root = createRoot(container);
    act(() => root!.render(<lazy.VectorEffect id="drip-text" autoplay={false} />));
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("useFlairMoment", () => {
  it("plays over a ref, and stops what is playing on unmount", async () => {
    const results: boolean[] = [];
    function Card() {
      const play = useFlairMoment();
      const card = useRef<HTMLDivElement>(null);
      useEffect(() => {
        play(card, "aurora", { duration: 10_000 }).then((p) => results.push(p));
      }, [play]);
      return <div ref={card} />;
    }
    root = createRoot(container);
    act(() => root!.render(<Card />));
    await settle();
    expect(document.querySelector("[data-flair-moment]")).not.toBeNull();
    act(() => root!.unmount());
    root = undefined;
    await settle();
    expect(results).toEqual([false]);
    expect(document.querySelector("[data-flair-moment]")).toBeNull();
  });
});
