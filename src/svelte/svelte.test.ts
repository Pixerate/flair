// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { flushSync, hydrate, mount, unmount } from "svelte";
import { render } from "svelte/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManualClock } from "../time/clock.js";
import type { SvgMotion } from "../vector/motion.js";
import type { SvgPlayer } from "../vector/svg.js";
// Compiled by the test config's plugin.
import Effect from "./fixtures/Effect.svelte";
// @ts-expect-error: Svelte types `*.svelte`, not `*.svelte?server`; compiled for the server.
import EffectServer from "./fixtures/Effect.svelte?server";
import { vectorEffect, vectorEffectStill, type VectorEffectParams } from "./index.js";

const motion: SvgMotion = {
  svg: `<svg viewBox="0 0 200 100"><rect id="bar" x="0" y="0" width="0" height="10"/></svg>`,
  animate: [{ id: "bar", attrs: { width: [0, 200] }, ms: 1000, ease: "linear" }],
};

let host: HTMLElement;

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query }));
}

beforeEach(() => {
  host = document.createElement("span");
  document.body.appendChild(host);
  reducedMotion(false);
});

afterEach(() => {
  host.remove();
});

const stillOf = (el: ParentNode) => el.querySelector<HTMLElement>(":scope > [data-flair-still]")!;
const liveOf = (el: ParentNode) => el.querySelector<HTMLElement>(":scope > :not([data-flair-still])")!;
const width = (el: ParentNode | null) => el?.querySelector("#bar")?.getAttribute("width");
const tick = () => new Promise((r) => setTimeout(r));

describe("vectorEffectStill", () => {
  it("gives the last frame in a layer, and the host's size from the viewBox", () => {
    const still = vectorEffectStill({ motion });
    expect(still.style).toBe("position: relative; display: block; aspect-ratio: 200 / 100");
    host.innerHTML = still.markup;
    expect(width(stillOf(host))).toBe("200");
    expect(stillOf(host).getAttribute("aria-hidden")).toBe("true");
  });

  it("starts hover and press triggers on the first frame, and takes a poster", () => {
    host.innerHTML = vectorEffectStill({ motion, trigger: "hover" }).markup;
    expect(width(stillOf(host))).toBe("0");
    host.innerHTML = vectorEffectStill({ motion, poster: 500 }).markup;
    expect(width(stillOf(host))).toBe("100");
  });

  it("sizes inline, from the option or an effect's inline control", () => {
    expect(vectorEffectStill({ motion, inline: "1em" }).style).toBe(
      "position: relative; display: inline-block; height: 1em; aspect-ratio: 200 / 100",
    );
    const drip = vectorEffectStill({ id: "drip-text", values: { word: "Slop", inline: true } });
    expect(drip.style).toContain("display: inline-block; height: 0.72em");
    expect(drip.markup).toContain("Slop");
  });

  it("refuses ids that are not vector effects", () => {
    expect(() => vectorEffectStill({ id: "no-such-effect" })).toThrow(/not a vector effect/);
  });
});

describe("vectorEffect action", () => {
  it("waits until scrolled into view to play once, and keeps room for an inline word's overhang", () => {
    let player: SvgPlayer | undefined;
    const action = vectorEffect(host, { motion, loop: false, onPlayer: (p) => (player = p) });
    // jsdom's IntersectionObserver never reports it in view.
    expect(player?.isPlaying).toBe(false);
    action.destroy?.();
    const drip = vectorEffectStill({ id: "drip-text", values: { word: "Slop", inline: true }, contain: true });
    expect(drip.style).toMatch(/margin: 0\.03em 0\.03em 0\.\d+em 0\.03em/);
  });

  it("makes its own still and sizing without a server still, and plays on its clock", async () => {
    const clock = new ManualClock();
    let player: SvgPlayer | undefined;
    const action = vectorEffect(host, { motion, clock, loop: false, playOnEnter: false, onPlayer: (p) => (player = p) });
    expect(host.style.display).toBe("block");
    expect(host.style.aspectRatio).toBe("200 / 100");
    expect(stillOf(host).style.display).toBe("none");
    expect(width(stillOf(host))).toBe("200");
    expect(player?.isPlaying).toBe(true);
    for (let t = 0; t < 2000; t += 100) await clock.advance(100);
    expect(width(liveOf(host))).toBe("200");
    expect(player!.isPlaying).toBe(false);

    action.destroy!();
    expect(player).toBeUndefined();
    expect(host.childElementCount).toBe(0);
    expect(host.getAttribute("style") ?? "").toBe("");
  });

  it("uses a server still in place, and leaves the host's own style alone", () => {
    const still = vectorEffectStill({ motion });
    host.setAttribute("style", `${still.style}; display: flex`);
    host.innerHTML = still.markup;
    const server = stillOf(host);
    const action = vectorEffect(host, { motion, clock: new ManualClock() });
    expect(stillOf(host)).toBe(server);
    expect(server.style.display).toBe("none");
    expect(host.style.display).toBe("flex");
    action.destroy!();
    expect(server.style.display).toBe("block");
    expect(host.style.display).toBe("flex");
    expect(host.childElementCount).toBe(1);
  });

  it("keeps the still under prefers-reduced-motion, unless told never to", () => {
    reducedMotion(true);
    const onPlayer = vi.fn();
    const action = vectorEffect(host, { motion, clock: new ManualClock(), onPlayer });
    expect(onPlayer).not.toHaveBeenCalled();
    expect(stillOf(host).style.display).toBe("block");
    expect(liveOf(host).childElementCount).toBe(0);
    action.update!({ motion, clock: new ManualClock(), onPlayer, reducedMotion: "never" });
    expect(onPlayer).toHaveBeenCalledTimes(1);
    expect(stillOf(host).style.display).toBe("none");
    action.update!({ motion, clock: new ManualClock(), onPlayer, reducedMotion: "always" });
    expect(onPlayer).toHaveBeenLastCalledWith(undefined);
    expect(stillOf(host).style.display).toBe("block");
    action.destroy!();
  });

  it("changes speed without remaking the player, and remakes it on new values only", () => {
    const clock = new ManualClock();
    const onPlayer = vi.fn();
    const params = (word: string, speed?: number): VectorEffectParams => ({
      id: "drip-text",
      values: { word },
      loop: false,
      clock,
      onPlayer,
      speed,
    });
    const action = vectorEffect(host, params("Slop"));
    action.update!(params("Slop", 2));
    expect(onPlayer).toHaveBeenCalledTimes(1);
    action.update!(params("Goo"));
    expect(onPlayer).toHaveBeenCalledTimes(3);
    expect(stillOf(host).innerHTML).toContain("Goo");
    action.destroy!();
  });

  it("resizes when it becomes inline", () => {
    const action = vectorEffect(host, { motion, clock: new ManualClock() });
    expect(host.style.height).toBe("");
    action.update!({ motion, clock: new ManualClock(), inline: true });
    expect(host.style.display).toBe("inline-block");
    expect(host.style.height).toBe("0.72em");
    action.update!({ motion, clock: new ManualClock() });
    expect(host.style.height).toBe("");
    action.destroy!();
  });
});

describe("in a Svelte component", () => {
  const params = (word: string): VectorEffectParams => ({
    id: "drip-text",
    values: { word },
    loop: false,
    clock: new ManualClock(),
  });

  it("server-renders the still and hydrates into a player, disposed on unmount", async () => {
    const { body } = render(EffectServer, { props: { params: params("Slop") } });
    expect(body).toContain("data-flair-still");
    expect(body).toContain("Slop");
    expect(body).toMatch(/style="position: relative; display: block; aspect-ratio: [\d.]+ \/ [\d.]+"/);

    host.innerHTML = body;
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    const app = hydrate(Effect, { target: host, props: { params: params("Slop") } });
    flushSync();
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    const span = host.querySelector<HTMLElement>(".host")!;
    expect(span.querySelectorAll("[data-flair-still]")).toHaveLength(1);
    expect(stillOf(span).style.display).toBe("none");
    expect(liveOf(span).querySelector("svg")).not.toBeNull();

    // New params replace the `{@html}` still; it stays hidden behind the new player.
    app.set(params("Goo"));
    flushSync();
    await tick();
    expect(stillOf(span).innerHTML).toContain("Goo");
    expect(stillOf(span).style.display).toBe("none");
    expect(liveOf(span).innerHTML).toContain("Goo");

    await unmount(app);
    expect(host.querySelector(".host")).toBeNull();
  });

  it("mounts on the client alone", () => {
    const app = mount(Effect, { target: host, props: { params: params("Slop") } });
    flushSync();
    const span = host.querySelector<HTMLElement>(".host")!;
    expect(span.style.aspectRatio).not.toBe("");
    expect(stillOf(span).style.display).toBe("none");
    void unmount(app);
  });
});

describe("entry points", () => {
  it("import Svelte only from the svelte entry", () => {
    const src = join(__dirname, "..");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.tsx?$/.test(f) && !f.startsWith("svelte") && !/\.test\.tsx?$/.test(f),
    );
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) expect(readFileSync(join(src, f), "utf8"), f).not.toMatch(/from\s+["']svelte(\/[^"']*)?["']/);
  });

  it("imports only Svelte's types, so the built entry needs no Svelte at run time", () => {
    const source = readFileSync(join(__dirname, "index.ts"), "utf8");
    for (const line of source.match(/^import .* from "svelte[^"]*";$/gm) ?? []) expect(line).toMatch(/^import type /);
  });
});
