// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManualClock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import type { SvgPlayer } from "../vector/svg.js";
import { SvgPlayerView, VectorEffect } from "./index.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const motion: SvgMotion = {
  svg: `<svg viewBox="0 0 200 100"><rect id="bar" x="0" y="0" width="0" height="10"/></svg>`,
  animate: [{ id: "bar", attrs: { width: [0, 200] }, ms: 1000, ease: "linear" }],
};

let container: HTMLElement;
let root: Root | undefined;

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  reducedMotion(false);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
});

function render(element: ReactElement) {
  root = createRoot(container);
  act(() => root!.render(element));
}

const stillOf = (el: ParentNode) => el.querySelector<HTMLElement>("span > span[aria-hidden]")!;
const width = (el: ParentNode | null) => el?.querySelector("#bar")?.getAttribute("width");

describe("SvgPlayerView", () => {
  it("server-renders the last frame, sized by the viewBox", () => {
    const html = renderToString(<SvgPlayerView motion={motion} className="hero" />);
    container.innerHTML = html;
    const host = container.firstElementChild as HTMLElement;
    expect(host.className).toBe("hero");
    expect(host.style.display).toBe("block");
    expect(host.style.aspectRatio).toBe("200 / 100");
    expect(width(stillOf(container))).toBe("200");
  });

  it("hydrates without mismatches and hands over to a player, disposed on unmount", () => {
    const element = <SvgPlayerView motion={motion} clock={new ManualClock()} loop={false} />;
    container.innerHTML = renderToString(element);
    const errors = vi.spyOn(console, "error");
    act(() => {
      root = hydrateRoot(container, element);
    });
    expect(errors).not.toHaveBeenCalled();
    const still = stillOf(container);
    expect(still.style.display).toBe("none");
    const live = still.nextElementSibling!;
    expect(width(live)).toBe("0");
    act(() => root!.unmount());
    root = undefined;
    expect(live.childElementCount).toBe(0);
  });

  it("waits until scrolled into view to play once, and keeps room for an inline word's overhang", () => {
    let player: SvgPlayer | undefined;
    render(<SvgPlayerView motion={motion} loop={false} onPlayer={(p) => (player = p)} />);
    // jsdom's IntersectionObserver never reports it in view.
    expect(player?.isPlaying).toBe(false);
    act(() => root!.unmount());
    render(<SvgPlayerView motion={motion} onPlayer={(p) => (player = p)} />);
    expect(player?.isPlaying).toBe(true);
    act(() => root!.unmount());
    render(<VectorEffect id="drip-text" values={{ word: "Slop", inline: true }} contain />);
    const host = container.firstElementChild as HTMLElement;
    expect([host.style.marginTop, host.style.marginLeft, host.style.marginBottom]).toEqual(["0.03em", "0.03em", "0.47em"]);
  });

  it("plays on its clock, and stays on the last frame without a loop", async () => {
    const clock = new ManualClock();
    let player: SvgPlayer | undefined;
    render(<SvgPlayerView motion={motion} clock={clock} loop={false} playOnEnter={false} onPlayer={(p) => (player = p)} />);
    expect(player?.isPlaying).toBe(true);
    const live = stillOf(container).nextElementSibling!;
    await act(async () => {
      for (let t = 0; t < 2000; t += 100) await clock.advance(100);
    });
    expect(width(live)).toBe("200");
    expect(player!.isPlaying).toBe(false);
  });

  it("keeps the still under prefers-reduced-motion", () => {
    reducedMotion(true);
    const onPlayer = vi.fn();
    render(<SvgPlayerView motion={motion} clock={new ManualClock()} onPlayer={onPlayer} />);
    expect(onPlayer).not.toHaveBeenCalled();
    expect(stillOf(container).style.display).toBe("block");
    expect(width(stillOf(container))).toBe("200");
    expect(stillOf(container).nextElementSibling!.childElementCount).toBe(0);
  });

  it("plays anyway with reducedMotion never, and not at all with always", () => {
    reducedMotion(true);
    const onPlayer = vi.fn();
    render(<SvgPlayerView motion={motion} clock={new ManualClock()} reducedMotion="never" onPlayer={onPlayer} />);
    expect(onPlayer).toHaveBeenCalledTimes(1);
    act(() => root!.render(<SvgPlayerView motion={motion} clock={new ManualClock()} reducedMotion="always" onPlayer={onPlayer} />));
    expect(onPlayer).toHaveBeenLastCalledWith(undefined);
    expect(stillOf(container).style.display).toBe("block");
  });

  it("changes speed without remaking the player", () => {
    const clock = new ManualClock();
    const onPlayer = vi.fn();
    render(<SvgPlayerView motion={motion} clock={clock} onPlayer={onPlayer} />);
    act(() => root!.render(<SvgPlayerView motion={motion} clock={clock} onPlayer={onPlayer} speed={2} />));
    expect(onPlayer).toHaveBeenCalledTimes(1);
  });

  it("sizes as a word in a line when inline", () => {
    render(<SvgPlayerView motion={motion} inline clock={new ManualClock()} />);
    const host = container.firstElementChild as HTMLElement;
    expect(host.style.display).toBe("inline-block");
    expect(host.style.height).toBe("0.72em");
    expect(host.style.aspectRatio).toBe("200 / 100");
    act(() => root!.render(<SvgPlayerView motion={motion} inline="1em" clock={new ManualClock()} />));
    expect(host.style.height).toBe("1em");
  });
});

describe("VectorEffect", () => {
  it("renders a catalog effect with its values, without restarting on a new values object", () => {
    const onPlayer = vi.fn();
    const clock = new ManualClock();
    render(<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} clock={clock} onPlayer={onPlayer} />);
    expect(stillOf(container).innerHTML).toContain("Slop");
    act(() => root!.render(<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} clock={clock} onPlayer={onPlayer} />));
    expect(onPlayer).toHaveBeenCalledTimes(1);
    act(() => root!.render(<VectorEffect id="drip-text" values={{ word: "Goo" }} loop={false} clock={clock} onPlayer={onPlayer} />));
    expect(onPlayer).toHaveBeenCalledTimes(3);
    expect(stillOf(container).innerHTML).toContain("Goo");
  });

  it("sizes inline from the effect's inline control", () => {
    const html = renderToString(<VectorEffect id="drip-text" values={{ word: "Slop", inline: true }} />);
    container.innerHTML = html;
    const host = container.firstElementChild as HTMLElement;
    expect(host.style.display).toBe("inline-block");
    expect(host.style.height).toBe("0.72em");
  });

  it("puts elementId on the host and refuses ids that are not vector effects", () => {
    container.innerHTML = renderToString(<VectorEffect id="drip-text" elementId="title" />);
    expect(container.firstElementChild!.id).toBe("title");
    expect(() => renderToString(<VectorEffect id="no-such-effect" />)).toThrow(/not a vector effect/);
  });
});

describe("entry points", () => {
  it("import React only from the react entry", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = join(__dirname, "..");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.tsx?$/.test(f) && !f.startsWith("react") && !/\.test\.tsx?$/.test(f),
    );
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) expect(readFileSync(join(src, f), "utf8"), f).not.toMatch(/from\s+["']react(-dom)?(\/[^"']*)?["']/);
  });
});
