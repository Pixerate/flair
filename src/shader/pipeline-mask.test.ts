import { ShaderPipeline, type PipelineMask } from "./pipeline.js";
import { installFakeWebGl, shaderSource, type FakeGl } from "./test-utils.js";

const fragmentOf = (gl: FakeGl, draw: FakeGl["draws"][number]) => draw.program?.shaders.find((s) => s.type === gl.FRAGMENT_SHADER)?.source ?? "";
const picture = (fill = 255) => ({ data: new Uint8ClampedArray(16).fill(fill), width: 2, height: 2 }) as unknown as ImageData;
/** The value last set on a uniform of Flair's compositor. */
const set = (gl: FakeGl, name: string) => gl.uniform(name);

function setup(mask?: PipelineMask) {
  const webgl = installFakeWebGl();
  const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource("// A") }], width: 8, height: 4, mask });
  return { pipeline, gl: webgl.last() };
}

describe("ShaderPipeline masks", () => {
  it("composites the effect over what is under it by the mask, and shows and reads the composite", () => {
    const under = picture(10);
    const coverage = picture(200);
    const { pipeline, gl } = setup({ picture: coverage, under });
    pipeline.render(0);
    const composite = gl.draws.find((d) => fragmentOf(gl, d).includes("flair_mask"))!;
    const effect = gl.draws[0]!;
    expect(composite.textures[0]).toBe(effect.target);
    expect((composite.textures[1] as { image: unknown }).image).toBe(coverage);
    expect((composite.textures[2] as { image: unknown }).image).toBe(under);
    expect([set(gl, "flair_hasMask"), set(gl, "flair_hasUnder"), set(gl, "flair_hasRegion")]).toEqual([[1], [1], [0]]);
    // The canvas shows the composite, and reads come from it.
    expect(gl.draws.at(-1)!.textures[0]).toBe(composite.target);
    pipeline.readPixels();
    expect((gl.named("bindFramebuffer").at(-2)!.args[1] as { texture: unknown }).texture).toBe(composite.target);
  });

  it("turns a region from the top left into GL's bottom left, with its feather", () => {
    const { pipeline, gl } = setup({ region: [1, 0, 3, 1], feather: 2 });
    pipeline.render(0);
    expect(set(gl, "flair_region")).toEqual([1, 3, 3, 1]);
    expect([set(gl, "flair_hasRegion"), set(gl, "flair_hasMask"), set(gl, "flair_feather")]).toEqual([[1], [0], [2]]);
  });

  it("can use luminance, invert, and show a pass's output underneath", () => {
    const webgl = installFakeWebGl();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource("// A") }, { source: shaderSource("// B") }], width: 2, height: 2, mask: { picture: picture(), channel: "luminance", invert: true, under: { pass: 0 } } });
    pipeline.render(0);
    const gl = webgl.last();
    const composite = gl.draws.find((d) => fragmentOf(gl, d).includes("flair_mask"))!;
    expect(composite.textures[2]).toBe(gl.draws[0]!.target);
    expect([set(gl, "flair_luminance"), set(gl, "flair_invert")]).toEqual([[1], [1]]);
  });

  it("converts float pictures for the mask and what is under it", () => {
    const { pipeline, gl } = setup();
    const floats = { width: 2, height: 2, data: new Float32Array(16).fill(1) };
    pipeline.setMask({ picture: floats, under: floats });
    expect(gl.draws.filter((d) => fragmentOf(gl, d).includes("flair_toSrgb"))).toHaveLength(2);
    pipeline.render(0);
    const composite = gl.draws.find((d) => fragmentOf(gl, d).includes("flair_mask"))!;
    expect(composite.textures[1]).not.toBe(composite.textures[2]);
  });

  it("goes back to the plain output when removed", () => {
    const { pipeline, gl } = setup({ region: [0, 0, 1, 1] });
    pipeline.setMask(null);
    pipeline.render(0);
    expect(gl.draws.some((d) => fragmentOf(gl, d).includes("flair_mask"))).toBe(false);
    expect(gl.draws.at(-1)!.textures[0]).toBe(gl.draws[0]!.target);
  });

  it.each<[string, PipelineMask, RegExp]>([
    ["nothing to mask by", {}, /needs a picture \(its coverage\), a region, or both/],
    ["a region of the wrong shape", { region: [0, 0, 0, 4] }, /\[x, y, width, height\].*got \[0,0,0,4\]/],
    ["an unknown channel", { region: [0, 0, 1, 1], channel: "red" as never }, /"alpha" or "luminance"; got "red"/],
    ["a pass that does not exist", { region: [0, 0, 1, 1], under: { pass: 4 } }, /reads pass 4, and there are 1 passes/],
  ])("refuses %s, saying what it takes", (_, mask, message) => {
    const { pipeline } = setup();
    expect(() => pipeline.setMask(mask)).toThrow(message);
  });
});
