import { describe, expect, it } from "vitest";
import { checkControlValue, parseControls } from "../shader/controls.js";
import { svgMotionIssues } from "../vector/motion.js";
import {
  EFFECT_CATEGORIES,
  EFFECTS,
  effectControls,
  effectDefaults,
  findEffects,
  getEffect,
  renderVectorEffect,
  SAMPLE_IMAGES,
  SHADER_EFFECTS,
} from "./index.js";

describe("catalog", () => {
  it("has unique kebab-case ids in known categories", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const effect of EFFECTS) {
      expect(effect.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(EFFECT_CATEGORIES).toContain(effect.category);
      expect(effect.description.length).toBeGreaterThan(10);
      expect(effect.tags.length).toBeGreaterThan(0);
    }
    expect(EFFECTS.length).toBeGreaterThanOrEqual(50);
  });

  it("covers every category", () => {
    for (const category of EFFECT_CATEGORIES) expect(findEffects({ category }).length).toBeGreaterThan(0);
  });

  it.each(SHADER_EFFECTS.map((e) => [e.id, e] as const))("shader %s declares mainImage and controls", (_, effect) => {
    expect(effect.source).toMatch(/void mainImage\(out vec4 fragColor, in vec2 fragCoord\)/);
    const controls = parseControls(effect.source);
    expect(controls.length).toBeGreaterThan(0);
    // Every uniform the source declares is a control (the built-ins come from the wrapper).
    const uniforms = [...effect.source.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
    expect(controls.map((c) => c.name).sort()).toEqual(uniforms.sort());
    for (const c of controls) expect(c.label).not.toBe("");
  });

  it.each(EFFECTS.filter((e) => e.presets).map((e) => [e.id, e] as const))("presets of %s are valid values", (_, effect) => {
    const controls = effectControls(effect);
    for (const preset of effect.presets!) {
      for (const [name, value] of Object.entries(preset.values)) {
        const control = controls.find((c) => c.name === name);
        expect(control, `${effect.id}/${preset.name}: ${name}`).toBeDefined();
        expect(checkControlValue(control!, value).ok, `${effect.id}/${preset.name}: ${name}`).toBe(true);
      }
    }
  });

  it.each(EFFECTS.filter((e) => e.kind === "vector").map((e) => [e.id, e] as const))(
    "vector %s renders with no issues or leftover placeholders",
    (_, effect) => {
      if (effect.kind !== "vector") return;
      const motion = renderVectorEffect(effect, effectDefaults(effect));
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{/);
    },
  );

  it("fills vector controls: colours as hex, numbers as numbers, derived values too", () => {
    const ring = getEffect("progress-ring")!;
    if (ring.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(ring, { value: 50, accent: [1, 0, 0] });
    expect(motion.svg).toContain('stroke="#ff0000"');
    expect(motion.animate!.find((a) => a.id === "label")!.count).toEqual([0, 50]);
    expect(motion.animate!.find((a) => a.id === "ring")!.draw).toEqual([0, 0.5]);
  });

  it("finds effects by words, kind and tags", () => {
    expect(findEffects({ text: "aurora" }).map((e) => e.id)).toEqual(["aurora"]);
    expect(findEffects({ kind: "vector" }).every((e) => e.kind === "vector")).toBe(true);
    expect(findEffects({ tags: ["loader"] }).length).toBeGreaterThan(2);
    expect(findEffects({ text: "no such thing anywhere" })).toEqual([]);
  });

  it("merges defaults, presets and values", () => {
    const aurora = getEffect("aurora")!;
    const values = effectDefaults(aurora, { preset: "Ember", values: { uSpeed: 2 } });
    expect(values.uSpeed).toBe(2);
    expect(values.uGlowA).toEqual([1, 0.45, 0.1]);
    expect(values.uHeight).toBe(0.55);
  });

  it("gives image effects sample pictures", () => {
    expect(effectDefaults(getEffect("transition-wipe")!).uTo).toBe(SAMPLE_IMAGES.city);
    expect(effectDefaults(getEffect("image-glitch")!).uImage).toBe(SAMPLE_IMAGES.landscape);
    expect(SAMPLE_IMAGES.landscape).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
