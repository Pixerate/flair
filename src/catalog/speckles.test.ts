import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { effectControls, effectDefaults, getEffect, shaderRestTime, type ShaderEffect } from "./index.js";

const effect = () => getEffect("pixel-speckles") as ShaderEffect;
const control = (name: string) => effectControls(effect()).find((c) => c.name === name);
const preset = (name: string) => ({ ...effectDefaults(effect()), ...effect().presets?.find((p) => p.name === name)?.values });

describe("pixel-speckles", () => {
  it("is a transparent overlay that loops and rests on a still frame under reduced motion", () => {
    expect(effect()).toMatchObject({ kind: "shader", category: "overlay", transparent: true, loop: 30 });
    expect(shaderRestTime(effect())).toBe(0);
    expect(effectDefaults(effect()).uBackgroundAlpha).toBe(0);
  });

  it("has the controls Swash sets: layout, size, opacity, twinkle, seed, gradient, roundness and keep-clear rectangles", () => {
    for (const name of ["uSpacing", "uDensity", "uMinSize", "uMaxSize", "uMinOpacity", "uMaxOpacity", "uTwinkle", "uSpeed", "uRoundness"]) {
      expect(control(name)?.type, name).toBe("float");
    }
    expect(control("uSeed")?.type).toBe("int");
    for (const name of ["uColor1", "uColor2", "uColor3", "uColor4"]) expect(control(name), name).toMatchObject({ type: "vec3", color: true });
    for (const name of ["uClear1", "uClear2", "uClear3", "uClear4"]) expect(control(name), name).toMatchObject({ type: "vec4", min: 0, max: 1 });
    expect(effectDefaults(effect()).uRoundness).toBe(0.28);
    // Unused keep-clear rectangles are zero-sized.
    expect(effectDefaults(effect()).uClear4).toEqual([0, 0, 0, 0]);
  });

  it("uses the brand gradient, ending in the dark indigo on a dark page and the light indigo on a light one", () => {
    const hex = (v: unknown) => `#${(v as number[]).map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    const dark = preset("Dark page");
    expect(["uColor1", "uColor2", "uColor3", "uColor4"].map((n) => hex(dark[n]))).toEqual(["#EC4899", "#E12AFB", "#8E51FF", "#6D63F0"]);
    expect(hex(preset("Light page").uColor4)).toBe("#4338CA");
  });

  it("is fainter and sparser on a light page than on a dark one", () => {
    const light = preset("Light page");
    const dark = preset("Dark page");
    expect(light.uDensity as number).toBeLessThan(dark.uDensity as number);
    expect(light.uMaxOpacity as number).toBeLessThan(dark.uMaxOpacity as number);
    expect(light.uMinOpacity as number).toBeLessThan(dark.uMinOpacity as number);
  });

  it("is compiled to Metal for FlairEffects as a PixelSpeckles struct", () => {
    const swift = join(process.cwd(), "swift/Sources/FlairEffects");
    const metal = join(swift, "Shaders/pixel-speckles.metal");
    expect(existsSync(metal)).toBe(true);
    expect(readFileSync(metal, "utf8")).toContain("flair_pixel_speckles_frag");
    const generated = readdirSync(join(swift, "Generated")).some((f) => readFileSync(join(swift, "Generated", f), "utf8").includes("public struct PixelSpeckles: FlairEffect"));
    expect(generated).toBe(true);
  });
});
