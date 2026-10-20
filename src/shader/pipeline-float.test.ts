import { ShaderPipeline } from "./pipeline.js";
import { installFakeWebGl, shaderSource, type FakeGl, type FakeTexture } from "./test-utils.js";

const SAMPLER = "uniform sampler2D uImage; // @control";
const fragmentOf = (gl: FakeGl, draw: FakeGl["draws"][number]) => draw.program?.shaders.find((s) => s.type === gl.FRAGMENT_SHADER)?.source ?? "";

describe("ShaderPipeline formats", () => {
  it("draws float passes into half or full float textures", () => {
    for (const [format, internal, type] of [
      ["rgba16f", 0x881a, 0x140b],
      ["rgba32f", 0x8814, 0x1406],
    ] as const) {
      const webgl = installFakeWebGl();
      new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 2, height: 2, format });
      const targets = webgl.last().named("texImage2D").filter((c) => c.args.length === 9);
      expect(targets.length).toBeGreaterThan(0);
      for (const t of targets) expect([t.args[2], t.args[7]]).toEqual([internal, type]);
    }
  });

  it("says what to use instead when the GPU cannot", () => {
    installFakeWebGl({ extensions: [] });
    expect(() => new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 2, height: 2, format: "rgba16f" })).toThrow(/EXT_color_buffer_float.*use "rgba8"/);
    installFakeWebGl({ extensions: ["EXT_color_buffer_float"] });
    expect(() => new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 2, height: 2, format: "rgba32f" })).toThrow(/OES_texture_float_linear.*use "rgba16f"/);
    installFakeWebGl();
    expect(() => new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 2, height: 2, format: "rgb10" as never })).toThrow(/"rgb10" is not one of rgba8, rgba16f, rgba32f/);
  });

  it("reads float output in linear light, decoded on the GPU, rows top down", () => {
    const webgl = installFakeWebGl({ pixel: (_x, y) => [y * 51, 0, 0, 255] });
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 2, height: 3, format: "rgba16f" });
    pipeline.render(0);
    const gl = webgl.last();
    const out = pipeline.readFloatPixels();
    const decode = gl.draws.at(-1)!;
    expect(fragmentOf(gl, decode)).toContain("flair_toLinear");
    expect(decode.textures[0]).toBe(gl.draws[0]!.target);
    expect(gl.named("readPixels").at(-1)!.args[4]).toBe(gl.FLOAT);
    // The fake reads floats as bytes / 255: row 0 (top) is GL's row 2.
    expect(out[0]).toBeCloseTo(102 / 255);
    expect(out.length).toBe(24);
  });

  it("reads bytes from a float pipeline by quantising its floats", () => {
    const webgl = installFakeWebGl({ pixel: () => [51, 102, 153, 255] });
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 1, height: 1, format: "rgba32f" });
    pipeline.render(0);
    expect([...pipeline.readPixels()]).toEqual([51, 102, 153, 255]);
    expect(webgl.last().named("readPixels").at(-1)!.args[4]).toBe(webgl.last().FLOAT);
  });

  it("decodes 8-bit output to linear light for readFloatPixels", () => {
    installFakeWebGl({ pixel: () => [128, 255, 0, 128] });
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 1, height: 1 });
    pipeline.render(0);
    const [r, g, b, a] = pipeline.readFloatPixels();
    expect(r).toBeCloseTo(0.2158, 3);
    expect([g, b]).toEqual([1, 0]);
    expect(a).toBeCloseTo(128 / 255);
  });
});

describe("float pictures in", () => {
  const picture = (width: number, height: number) => ({ width, height, data: new Float32Array(width * height * 4).fill(0.5) });

  it("uploads full floats and converts them on the GPU to what shaders sample", () => {
    const webgl = installFakeWebGl();
    const input = picture(3, 2);
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER), inputs: { uImage: input } }], width: 4, height: 4, format: "rgba16f" });
    const gl = webgl.last();
    const upload = gl.named("texImage2D").find((c) => c.args[8] === input.data)!;
    expect([upload.args[2], upload.args[3], upload.args[4], upload.args[7]]).toEqual([gl.RGBA32F, 3, 2, gl.FLOAT]);
    const encode = gl.draws.find((d) => fragmentOf(gl, d).includes("flair_toSrgb"))!;
    expect(encode).toBeDefined();
    pipeline.render(0);
    const pass = gl.draws.at(-2)!;
    expect(pass.textures[0]).toBe(encode.target);
    // The raw upload is not kept.
    expect((encode.textures[0] as FakeTexture).deleted).toBe(true);
  });

  it("refuses a picture whose data does not match its size, saying the sizes", () => {
    installFakeWebGl();
    const bad = { width: 2, height: 2, data: new Float32Array(3) };
    expect(() => new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER), inputs: { uImage: bad } }], width: 2, height: 2 })).toThrow(/2 × 2 × 4 = 16\); it has 3/);
  });

  it("frees the converted picture when the control is given something else", () => {
    const webgl = installFakeWebGl();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER), inputs: { uImage: picture(2, 2) } }], width: 2, height: 2 });
    const gl = webgl.last();
    const converted = gl.draws.find((d) => fragmentOf(gl, d).includes("flair_toSrgb"))!.target!;
    pipeline.setInput(0, "uImage", null);
    expect(converted.deleted).toBe(true);
  });
});
