import { drawsAlpha, effectDefaults, effectStack, getEffect, SHADER_EFFECTS } from "./index.js";
import { ShaderPipeline } from "../shader/pipeline.js";
import { installFakeWebGl } from "../shader/test-utils.js";

describe("drawsAlpha", () => {
  it("is true for overlays, and for a background or backdrop opacity below 1", () => {
    const sparkles = getEffect("sparkles")!;
    expect(drawsAlpha(getEffect("click-ripple")!, {})).toBe(true);
    expect(drawsAlpha(getEffect("aurora")!)).toBe(false);
    expect(drawsAlpha(sparkles, effectDefaults(sparkles))).toBe(false);
    expect(drawsAlpha(sparkles, { uBackgroundAlpha: 0.5 })).toBe(true);
    expect(drawsAlpha(getEffect("rainbow")!, { uBackdropAlpha: 0 })).toBe(true);
    // Without values: whether it could, for a canvas whose values change later.
    expect(drawsAlpha(sparkles)).toBe(true);
    expect(drawsAlpha(getEffect("lower-third")!)).toBe(false);
  });
});

describe("effectStack", () => {
  it("feeds each filter the layer below, through its picture control", () => {
    const passes = effectStack(["aurora", "crt", { effect: "image-duotone", preset: "Spotify" }]);
    expect(passes.map((p) => [p.name, p.inputs, p.blend])).toEqual([
      ["aurora", undefined, undefined],
      ["crt", { uImage: "previous" }, undefined],
      ["image-duotone", { uImage: "previous" }, undefined],
    ]);
    expect(passes[2]!.values).toEqual(effectDefaults(getEffect("image-duotone")!, { preset: "Spotify" }));
  });

  it("draws overlays over the layer below, and gives the first layer the source", () => {
    const overlay = SHADER_EFFECTS.find((e) => e.transparent && !e.source.includes("sampler2D"))!;
    const source = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as unknown as ImageData;
    const passes = effectStack(["crt", overlay.id], { source });
    expect(passes[0]!.inputs).toEqual({ uImage: source });
    expect(passes[1]).toMatchObject({ blend: "over", name: overlay.id });
  });

  it("draws a layer over the one below once its background is faded", () => {
    expect(effectStack(["aurora", "sparkles"])[1]!.blend).toBeUndefined();
    expect(effectStack(["aurora", { effect: "sparkles", values: { uBackgroundAlpha: 0 } }])[1]).toMatchObject({ blend: "over", name: "sparkles" });
  });

  it("refuses unknown ids and vector effects, saying which", () => {
    expect(() => effectStack(["auroa"])).toThrow(/no effect "auroa".*"aurora"/);
    expect(() => effectStack(["aurora", "lower-third"])).toThrow(/"lower-third" is a vector effect.*layer 1/);
  });

  it("makes passes a pipeline runs", () => {
    installFakeWebGl();
    const pipeline = new ShaderPipeline({ passes: effectStack(["aurora", "crt"]), width: 4, height: 4 });
    pipeline.render(1);
    expect(pipeline.readImageData().data).toHaveLength(64);
  });
});
