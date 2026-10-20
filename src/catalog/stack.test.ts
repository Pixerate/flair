import { effectDefaults, effectStack, getEffect, SHADER_EFFECTS } from "./index.js";
import { ShaderPipeline } from "../shader/pipeline.js";
import { installFakeWebGl } from "../shader/test-utils.js";

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
