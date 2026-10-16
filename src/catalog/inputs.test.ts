import { describe, expect, it } from "vitest";
import { EFFECT_INPUTS, EFFECTS, effectControls, effectInputs, findEffects, getEffect } from "./index.js";

const inputs = (id: string) => effectInputs(getEffect(id)!);

describe("effectInputs", () => {
  it("knows picture effects take images, SVGs and (when suited) video", () => {
    expect(inputs("image-duotone")).toMatchObject({ accepts: ["image", "video", "svg"], video: "filter", images: [{ name: "uImage", wants: "picture" }] });
    expect(inputs("transition-wipe").images.map((s) => s.name)).toEqual(["uFrom", "uTo"]);
  });

  it("knows mask and text effects take shapes with transparency, words and SVGs", () => {
    expect(inputs("shader-text")).toMatchObject({ accepts: ["image", "svg", "text", "mask"], images: [{ wants: "text" }] });
    expect(inputs("silhouette-morph").accepts).toContain("mask");
    expect(inputs("drop-shadow-lift")).toMatchObject({ accepts: ["image", "svg", "text", "mask"], images: [{ wants: "mask" }] });
  });

  it("reads vector text controls as copy, fonts or path data", () => {
    const typewriter = inputs("typewriter");
    expect(typewriter.accepts).toEqual(["text"]);
    expect(typewriter.texts.map((t) => [t.name, t.holds])).toEqual([["text", "copy"], ["font", "font"]]);
    expect(inputs("shape-morph").accepts).toEqual(["path"]);
    expect(inputs("scramble-text").texts.find((t) => t.name === "glyphs")!.holds).toBe("glyphs");
  });

  it("knows how effects answer the pointer", () => {
    expect(inputs("click-ripple")).toMatchObject({ transparent: true });
    expect(inputs("click-ripple").interactions).toContain("click");
    expect(inputs("comet-trail").interactions).toContain("trail");
    expect(inputs("magnifier").interactions).toEqual(expect.arrayContaining(["hover", "pointer"]));
    expect(inputs("press-charge").interactions).toContain("press");
    expect(inputs("toggle-switch")).toMatchObject({ trigger: "click", interactions: ["click"] });
    expect(inputs("aurora")).toMatchObject({ accepts: [], images: [], texts: [], interactions: [], transparent: false });
  });

  it("knows which effects hear sound and which follow the scroll", () => {
    expect(inputs("spectrum-bars")).toMatchObject({ accepts: ["audio"], interactions: [] });
    expect(inputs("bass-pulse").accepts).toEqual(["image", "video", "svg", "audio"]);
    expect(inputs("parallax-layers")).toMatchObject({ accepts: [], interactions: ["scroll"] });
    expect(inputs("scroll-draw")).toMatchObject({ trigger: "scroll", interactions: ["scroll"] });
    expect(findEffects({ interaction: ["scroll"] }).every((e) => e.category === "scroll")).toBe(true);
  });

  it("agrees with every effect's controls and fields", () => {
    for (const effect of EFFECTS) {
      const i = effectInputs(effect);
      const images = effectControls(effect).filter((c) => c.type === "sampler2D");
      expect(i.images.length, effect.id).toBe(images.length);
      expect(i.accepts.every((a) => EFFECT_INPUTS.includes(a)), effect.id).toBe(true);
      if (effect.kind === "shader") expect(i.video, effect.id).toBe(effect.video);
      if (effect.kind === "vector") expect(i.interactions, effect.id).toEqual(effect.trigger ? [effect.trigger] : []);
      // The "interactive" tag (what text search finds) says just what the effect does.
      expect(effect.tags.includes("interactive"), `${effect.id} is tagged interactive only if it answers the pointer`).toBe(i.interactions.length > 0);
      // Every interactive shader in the interaction category really reads the pointer.
      if (effect.category === "interaction") expect(i.interactions.length, effect.id).toBeGreaterThan(0);
    }
  });
});

describe("findEffects by inputs", () => {
  it("finds what can be given a picture, a word or a path", () => {
    const forVideo = findEffects({ accepts: ["video"] });
    expect(forVideo.length).toBeGreaterThan(50);
    expect(forVideo.every((e) => e.kind === "shader" && e.video && e.video !== "none")).toBe(true);
    const forText = findEffects({ accepts: ["text"] });
    expect(forText.map((e) => e.id)).toEqual(expect.arrayContaining(["typewriter", "shader-text", "neon-sign"]));
    expect(findEffects({ accepts: ["path"] }).map((e) => e.id)).toEqual(expect.arrayContaining(["shape-morph", "line-boil"]));
  });

  it("finds by interaction and transparency", () => {
    const clicks = findEffects({ interaction: ["click"] });
    expect(clicks.map((e) => e.id)).toEqual(expect.arrayContaining(["click-ripple", "toggle-switch", "fireworks"]));
    expect(findEffects({ interaction: [] }).every((e) => effectInputs(e).interactions.length === 0)).toBe(true);
    const overlays = findEffects({ transparent: true });
    expect(overlays.every((e) => e.kind === "shader" && e.transparent)).toBe(true);
    expect(findEffects({ accepts: ["image"], interaction: ["hover"] }).map((e) => e.id)).toContain("magnifier");
  });
});
