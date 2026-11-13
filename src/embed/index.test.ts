import { describe, expect, it } from "vitest";
import { getEffect, textImage } from "../catalog/index.js";
import { mountEffect, resolveSubject, subjectValues } from "./index.js";
import { installFakeWebGl } from "../shader/test-utils.js";

const effect = (id: string) => getEffect(id)!;

describe("asset subjects", () => {
  const HEART = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
  const library = async (ref: string) => (ref === "acme:heart" ? { svg: HEART } : undefined);

  it("resolve through the host's library, leaving other subjects alone", async () => {
    expect(await resolveSubject({ asset: "acme:heart" }, library)).toEqual({ svg: HEART });
    expect(await resolveSubject([{ asset: "acme:heart" }, { image: "/b.png" }], library)).toEqual([{ svg: HEART }, { image: "/b.png" }]);
    await expect(resolveSubject({ asset: "acme:nope" }, library)).rejects.toThrow(/no asset "acme:nope"/);
  });

  it("need a resolver: subjectValues says how to give one", () => {
    expect(() => subjectValues(effect("sticker-cutout"), { asset: "acme:heart" })).toThrow(/pass resolveAsset to mountEffect/);
  });

  it("are applied once resolved, and ready() waits for them", async () => {
    installFakeWebGl();
    const host = document.createElement("div");
    const mounted = mountEffect(host, "sticker-cutout", { subject: { asset: "acme:heart" }, resolveAsset: library, autoplay: false });
    const renderer = mounted.renderer!;
    const set = renderer.setValues.bind(renderer);
    const seen: Record<string, unknown>[] = [];
    renderer.setValues = (values) => {
      seen.push({ ...values });
      set(values);
    };
    await mounted.ready().catch(() => undefined);
    expect(String(seen.at(-1)?.uMask)).toMatch(/^data:image\/svg\+xml/);
    mounted.setSubject({ asset: "acme:nope" });
    await expect(mounted.ready()).rejects.toThrow(/no asset "acme:nope"/);
    mounted.dispose();
  });
});

describe("subjectValues", () => {
  it("puts a picture or an SVG into the effect's image control", () => {
    expect(subjectValues(effect("image-duotone"), { image: "/team.jpg" })).toEqual({ values: { uImage: "/team.jpg" }, live: {} });
    const svg = subjectValues(effect("image-duotone"), { svg: '<svg viewBox="0 0 10 10"><circle r="4"/></svg>' }).values.uImage as string;
    expect(svg.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(svg)).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(subjectValues(effect("image-duotone"), { svg: "/logo.svg" }).values.uImage).toBe("/logo.svg");
  });

  it("shows a video live in a picture control, and refuses effects not made for video", () => {
    const video = {} as HTMLVideoElement;
    expect(subjectValues(effect("crt"), { video })).toEqual({ values: {}, live: { uImage: video } });
    expect(() => subjectValues(effect("shader-text"), { video })).toThrow(/takes no video/);
  });

  it("fills a transition's two pictures in order", () => {
    expect(subjectValues(effect("transition-wipe"), [{ image: "/a.jpg" }, { image: "/b.jpg" }]).values).toEqual({ uFrom: "/a.jpg", uTo: "/b.jpg" });
  });

  it("draws words into a shader's text or mask control, and writes them into a vector effect's text", () => {
    expect(subjectValues(effect("shader-text"), { text: "HELLO" }).values.uText).toBe(textImage("HELLO"));
    expect(subjectValues(effect("typewriter"), { text: "Hi there" }).values).toEqual({ text: "Hi there" });
    expect(subjectValues(effect("shape-morph"), { path: "M0 0 L10 0 L5 9 Z" }).values).toEqual({ from: "M0 0 L10 0 L5 9 Z" });
  });

  it("hands sound to an audio-reactive effect, and refuses it elsewhere", () => {
    const audio = {} as HTMLAudioElement;
    expect(subjectValues(effect("spectrum-bars"), { audio })).toEqual({ values: {}, live: {}, audio });
    expect(subjectValues(effect("bass-pulse"), [{ image: "/logo.svg" }, { audio }])).toEqual({ values: { uImage: "/logo.svg" }, live: {}, audio });
    expect(() => subjectValues(effect("aurora"), { audio })).toThrow(/"aurora" does not react to sound; findEffects\(\{ accepts: \["audio"\] \}\)/);
    expect(() => subjectValues(effect("typewriter"), { audio })).toThrow(/does not react to sound/);
  });

  it("explains a subject an effect can't take", () => {
    expect(() => subjectValues(effect("aurora"), { image: "/a.jpg" })).toThrow(/"aurora" takes no image/);
    expect(() => subjectValues(effect("typewriter"), { image: "/a.jpg" })).toThrow(/vector effect/);
    expect(() => subjectValues(effect("image-duotone"), { image: "/a.jpg" }, "uNope")).toThrow(/has no control "uNope"/);
  });
});

describe("mountEffect", () => {
  it("plays a vector effect with its subject and trigger, and rebuilds on new values", () => {
    const host = document.createElement("div");
    const mounted = mountEffect(host, "typewriter", { subject: { text: "Hello there" }, autoplay: false });
    // It types its text out over time: look once it has.
    mounted.player!.seek(mounted.player!.duration - 1);
    expect(host.querySelector("svg")!.outerHTML).toContain("Hello there");
    mounted.setSubject({ text: "Goodbye" });
    mounted.player!.seek(mounted.player!.duration - 1);
    expect(host.querySelectorAll("svg")).toHaveLength(1);
    expect(host.querySelector("svg")!.outerHTML).toContain("Goodbye");
    mounted.dispose();
    expect(host.querySelector("svg")).toBeNull();
    const toggle = mountEffect(host, "toggle-switch");
    expect(toggle.player).toBeDefined();
    toggle.dispose();
  });

  it("runs a shader effect on a canvas, transparent for overlays", () => {
    const host = document.createElement("div");
    const mounted = mountEffect(host, "click-ripple", { autoplay: false });
    expect(mounted.renderer).toBeDefined();
    expect(host.querySelector("canvas")).toBe(mounted.element);
    mounted.dispose();
    expect(() => mountEffect(host, "no-such-effect")).toThrow(/no effect "no-such-effect"/);
  });

  it("draws on a transparent canvas when the effect can fade its backdrop, and an opaque one otherwise", () => {
    const webgl = installFakeWebGl();
    const host = document.createElement("div");
    mountEffect(host, "rainbow", { autoplay: false }).dispose();
    expect(webgl.last().attributes).toMatchObject({ alpha: true });
    mountEffect(host, "aurora", { autoplay: false }).dispose();
    expect(webgl.last().attributes).toMatchObject({ alpha: false });
  });
});

describe("UI components", () => {
  const knob = (host: HTMLElement) => host.querySelector("#slide")!.getAttribute("transform");
  const click = (host: HTMLElement) => host.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

  it("a controlled switch shows the host's state, fires change on click and keys, and changes only when the host says", () => {
    const host = document.createElement("div");
    const events: [string, unknown][] = [];
    const toggle = mountEffect(host, "toggle-switch", { state: { checked: false }, onEvent: (name, detail) => events.push([name, detail]), label: "Wi-Fi", reducedMotion: "always" });
    expect(toggle.element.getAttribute("role")).toBe("switch");
    expect(toggle.element.getAttribute("aria-label")).toBe("Wi-Fi");
    expect(toggle.element.tabIndex).toBe(0);
    expect(toggle.element.getAttribute("aria-checked")).toBe("false");
    expect(knob(host)).toBe("translate(0 0)");

    click(host);
    expect(events).toEqual([["change", { checked: true }]]);
    // Controlled: nothing moves until the host passes the new state.
    expect(toggle.state).toEqual({ checked: false });
    expect(knob(host)).toBe("translate(0 0)");

    toggle.setState!({ checked: true });
    expect(toggle.state).toEqual({ checked: true });
    expect(toggle.element.getAttribute("aria-checked")).toBe("true");
    expect(knob(host)).toBe("translate(70 0)");

    key(toggle.element, " ");
    key(toggle.element, "Enter");
    key(toggle.element, "a");
    expect(events.slice(1)).toEqual([["change", { checked: false }], ["change", { checked: false }]]);
    toggle.setState!({ checked: false });
    expect(knob(host)).toBe("translate(0 0)");
    toggle.setState!({ checked: true });
    expect(knob(host)).toBe("translate(70 0)");
    toggle.dispose();
  });

  it("an uncontrolled switch flips itself and still fires change, starting from its data's state", () => {
    const host = document.createElement("div");
    const events: unknown[] = [];
    const toggle = mountEffect(host, "toggle-switch", { data: { checked: true }, onEvent: (_, detail) => events.push(detail), reducedMotion: "always" });
    expect(knob(host)).toBe("translate(70 0)");
    click(host);
    expect(toggle.state).toEqual({ checked: false });
    expect(knob(host)).toBe("translate(0 0)");
    click(host);
    expect(events).toEqual([{ checked: false }, { checked: true }]);
    expect(toggle.element.getAttribute("aria-checked")).toBe("true");
    toggle.dispose();
  });

  it("starts on a controlled checked state without playing to it", () => {
    const host = document.createElement("div");
    const toggle = mountEffect(host, "toggle-switch", { state: { checked: true } });
    expect(knob(host)).toBe("translate(70 0)");
    expect(toggle.player!.isPlaying).toBe(false);
    toggle.dispose();
  });

  it("takes typed data, shows its rest state under reduced motion, and describes its value", () => {
    const host = document.createElement("div");
    const bar = mountEffect(host, "progress-bar", { data: { value: 40, label: "Saving" }, reducedMotion: "always" });
    expect(bar.element.getAttribute("role")).toBe("progressbar");
    expect(bar.element.getAttribute("aria-label")).toBe("Saving");
    expect(bar.element.getAttribute("aria-valuenow")).toBe("40");
    // At rest: filled to 40% of the track, not faded out.
    expect(host.querySelector("#progressBarFill")!.getAttribute("width")).toBe("88");
    expect(host.querySelector("#progressBarBar")!.getAttribute("opacity")).toBe("1");
    expect(host.querySelector("#progressBarPercent")!.textContent).toBe("40%");
    bar.setData!({ value: 75 });
    expect(host.querySelector("#progressBarFill")!.getAttribute("width")).toBe("165");
    expect(host.textContent).toContain("Saving");
    expect(bar.element.getAttribute("aria-valuenow")).toBe("75");
    bar.dispose();

    const gauge = mountEffect(host, "gauge", { data: { value: 88, max: 160, unit: " km/h", label: "Speed" }, reducedMotion: "always" });
    expect(gauge.element.getAttribute("role")).toBe("meter");
    expect(gauge.element.getAttribute("aria-valuemax")).toBe("160");
    expect(gauge.element.getAttribute("aria-valuetext")).toBe("88 km/h");
    expect(host.querySelector("#gaugeValue")!.textContent).toBe("88 km/h");
    gauge.dispose();
  });

  it("plays once to its rest point, and keeps text controls working", () => {
    const host = document.createElement("div");
    const bar = mountEffect(host, "progress-bar", { values: { value: 30, label: "Old way" }, autoplay: false, reducedMotion: "never" });
    expect(bar.player!.duration).toBeLessThan(3300);
    bar.player!.seek(bar.player!.duration);
    expect(host.querySelector("#progressBarBar")!.getAttribute("opacity")).toBe("1");
    expect(host.textContent).toContain("Old way");
    bar.dispose();
  });

  it("refuses data that does not fit, and data for effects that are not UI", () => {
    const host = document.createElement("div");
    expect(() => mountEffect(host, "gauge", { data: { values: "1,2" } })).toThrow(/has no prop "values"/);
    expect(() => mountEffect(host, "typewriter", { data: { value: 1 } })).toThrow(/"typewriter" is not offered as a UI component/);
  });
});
