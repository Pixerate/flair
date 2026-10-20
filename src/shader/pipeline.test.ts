import { PassCompileError, ShaderPipeline } from "./pipeline.js";
import { installFakeWebGl, shaderSource, type FakeGl, type FakeTexture } from "./test-utils.js";

/** A pass whose program can be told apart in `draws` by `// <name>`, with an image control `uImage`. */
const pass = (name: string, ...lines: string[]) => shaderSource(`// ${name}`, "uniform sampler2D uImage; // @control", ...lines);

/** Which pass (by its `// name`) a draw ran, or "copy" for Flair's own copy program. */
function drawn(gl: FakeGl) {
  return gl.draws.map((d) => {
    const fragment = d.program?.shaders.find((s) => s.type === gl.FRAGMENT_SHADER)?.source ?? "";
    return /\/\/ (\w+)/.exec(fragment.replace(/^#version[^\n]*\n/, ""))?.[1] ?? (fragment.includes("flair_source") ? "copy" : "?");
  });
}

function setup(passes: ConstructorParameters<typeof ShaderPipeline>[0]["passes"]) {
  const webgl = installFakeWebGl();
  const pipeline = new ShaderPipeline({ passes, width: 4, height: 2 });
  return { pipeline, gl: webgl.last() };
}

describe("ShaderPipeline", () => {
  it("draws each pass into its own texture, then the last on the canvas", () => {
    const { pipeline, gl } = setup([{ source: pass("A") }, { source: pass("B"), inputs: { uImage: "previous" } }]);
    pipeline.render(1);
    expect(drawn(gl)).toEqual(["A", "B", "copy"]);
    const [a, b, copy] = gl.draws;
    expect(a!.target).not.toBeNull();
    expect(b!.target).not.toBeNull();
    expect(b!.target).not.toBe(a!.target);
    // B samples A's output; the canvas gets B's.
    expect(b!.textures[0]).toBe(a!.target);
    expect(copy!.target).toBeNull();
    expect(copy!.textures[0]).toBe(b!.target);
    expect(gl.uniform("iTime")).toEqual([1]);
  });

  it("feeds a pass its own last frame: black at first, then each frame the one before", () => {
    const { pipeline, gl } = setup([{ source: pass("T"), inputs: { uImage: "feedback" } }]);
    const cleared = gl.named("clear").map((c) => c.args[1]);
    pipeline.render(0);
    const first = gl.draws[0]!;
    expect(first.textures[0]).not.toBe(first.target);
    expect(cleared).toContain(first.textures[0]);
    pipeline.render(1 / 30);
    const second = gl.draws[2]!;
    // Frame 2 reads what frame 1 drew, into the other texture.
    expect(second.textures[0]).toBe(first.target);
    expect(second.target).toBe(first.textures[0]);
    pipeline.render(2 / 30);
    expect(gl.draws[4]!.textures[0]).toBe(second.target);
  });

  it("reads an earlier pass this frame, and a later one (or itself) from the frame before", () => {
    const { pipeline, gl } = setup([
      { source: pass("A"), inputs: { uImage: { pass: 1 } } },
      { source: pass("B"), inputs: { uImage: { pass: 0 } } },
    ]);
    pipeline.render(0);
    pipeline.render(1);
    const [, , , a2, b2] = gl.draws;
    const b1 = gl.draws[1]!;
    expect(drawn(gl).slice(3, 5)).toEqual(["A", "B"]);
    expect(a2!.textures[0]).toBe(b1.target);
    expect(b2!.textures[0]).toBe(a2!.target);
  });

  it("draws an overlay pass over the pass before by its alpha", () => {
    const { pipeline, gl } = setup([{ source: pass("A") }, { source: shaderSource("// O"), blend: "over" }]);
    pipeline.render(0);
    expect(drawn(gl)).toEqual(["A", "copy", "O", "copy"]);
    const [a, under, overlay] = gl.draws;
    expect(under!.textures[0]).toBe(a!.target);
    expect(under!.target).toBe(overlay!.target);
    expect([under!.blend, overlay!.blend]).toEqual([false, true]);
    expect(gl.named("blendFuncSeparate")[0]!.args).toEqual([gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA]);
  });

  it("shows pictures and URLs in image controls not fed by a pass", () => {
    const { pipeline, gl } = setup([{ source: pass("A") }]);
    const picture = { data: new Uint8ClampedArray(16), width: 2, height: 2 } as unknown as ImageData;
    pipeline.setInput(0, "uImage", picture);
    pipeline.render(0);
    expect((gl.draws[0]!.textures[0] as FakeTexture).image).toBe(picture);
    pipeline.setInput(0, "uImage", null);
    pipeline.render(0);
    expect((gl.draws[2]!.textures[0] as FakeTexture).image).toBe("1x1");
  });

  it("takes values per pass", () => {
    const { pipeline, gl } = setup([{ source: pass("A", "uniform float uK; // @control default=1") }, { source: pass("B", "uniform float uK; // @control default=1"), values: { uK: 3 } }]);
    pipeline.setValues(0, { uK: 2 });
    pipeline.render(0);
    expect(gl.named("uniform1f").filter((c) => (c.args[0] as { name: string }).name === "uK").map((c) => c.args[1])).toEqual([2, 3]);
    expect(pipeline.controls.map((c) => c.map((d) => d.name))).toEqual([
      ["uImage", "uK"],
      ["uImage", "uK"],
    ]);
  });

  it("reads the last frame's output, rows top down, from the pass that drew it", () => {
    const webgl = installFakeWebGl({ pixel: (_x, y) => [y * 10, 0, 0, 255] });
    const pipeline = new ShaderPipeline({ passes: [{ source: pass("T"), inputs: { uImage: "feedback" } }], width: 2, height: 3 });
    pipeline.render(0);
    const gl = webgl.last();
    const image = pipeline.readImageData();
    expect([image.width, image.height, image.data[0]]).toEqual([2, 3, 20]);
    const read = gl.named("bindFramebuffer").at(-2)!.args[1] as { texture: FakeTexture };
    expect(read.texture).toBe(gl.draws[0]!.target);
  });

  it("resetFeedback starts feedback again from black", () => {
    const { pipeline, gl } = setup([{ source: pass("T"), inputs: { uImage: "feedback" } }]);
    pipeline.render(0);
    pipeline.render(1);
    const before = gl.named("clear").length;
    pipeline.resetFeedback();
    expect(gl.named("clear").length).toBe(before + 2);
    pipeline.render(0);
    expect(gl.uniform("iFrame")).toEqual([0]);
  });

  it("names the pass that does not compile", () => {
    installFakeWebGl();
    const error = (() => {
      try {
        new ShaderPipeline({ passes: [{ source: pass("A") }, { source: pass("B", "COMPILE_ERROR"), name: "glow" }], width: 2, height: 2 });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(PassCompileError);
    expect(error).toMatchObject({ pass: 1, message: expect.stringMatching(/^pass 1 \(glow\): The shader does not compile/) });
  });

  it.each([
    ["previous on the first pass", [{ source: pass("A"), inputs: { uImage: "previous" as const } }], /first pass: it has no previous pass/],
    ["a pass that does not exist", [{ source: pass("A"), inputs: { uImage: { pass: 3 } } }], /reads pass 3, and there are 1 passes \(0 to 0\)/],
    ["a name that is not an image control", [{ source: pass("A"), inputs: { uNope: "feedback" as const } }], /no image control "uNope"; its image controls are uImage/],
  ])("refuses %s, saying what there is", (_, passes, message) => {
    installFakeWebGl();
    expect(() => new ShaderPipeline({ passes, width: 2, height: 2 })).toThrow(message);
  });

  it("refuses no passes, and work after dispose", () => {
    installFakeWebGl();
    expect(() => new ShaderPipeline({ passes: [], width: 2, height: 2 })).toThrow("at least one pass");
    const { pipeline } = setup([{ source: pass("A") }]);
    pipeline.dispose();
    expect(() => pipeline.render(0)).toThrow("disposed");
  });
});
