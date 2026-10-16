import { describe, expect, it } from "vitest";
import { getEffect, textImage } from "../catalog/index.js";
import { mountEffect, subjectValues } from "./index.js";

const effect = (id: string) => getEffect(id)!;

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
});
