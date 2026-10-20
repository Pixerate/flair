import { ShaderPipeline } from "./pipeline.js";
import { asGl, FakeGl, flush, installFakeImages, shaderSource, type FakeTexture } from "./test-utils.js";

const SAMPLER = "uniform sampler2D uImage; // @control";
const fragmentOf = (gl: FakeGl, draw: FakeGl["draws"][number]) => draw.program?.shaders.find((s) => s.type === gl.FRAGMENT_SHADER)?.source ?? "";

/** A host's context, mid-frame: its own framebuffer, viewport, program, textures, vertex array, tests, blending and unpack flags. */
function host() {
  const gl = new FakeGl();
  Object.assign(gl, { canvas: { width: 300, height: 150 } });
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(5, 6, 70, 80);
  const program = gl.createProgram();
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0 + 3);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.bindVertexArray({ vao: true });
  gl.enable(gl.SCISSOR_TEST);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(1, 1, 0, 1);
  gl.colorMask(true, false, true, false);
  gl.clearColor(0.1, 0.2, 0.3, 0.4);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return { gl, fb, texture };
}

describe("ShaderPipeline in a host's context", () => {
  it("puts the host's state back after every call", () => {
    const { gl } = host();
    const before = gl.hostState();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER), inputs: { uImage: "feedback" } }], width: 4, height: 4, gl: asGl(gl) });
    expect(gl.hostState()).toEqual(before);
    for (const call of [
      () => pipeline.render(0),
      () => pipeline.readPixels(),
      () => pipeline.setInput(0, "uImage", null),
      () => pipeline.setMask({ region: [0, 0, 2, 2] }),
      () => pipeline.render(1),
      () => pipeline.resetFeedback(),
      () => pipeline.dispose(),
    ]) {
      call();
      expect(gl.hostState()).toEqual(before);
    }
  });

  it("draws with no vertex array, scissor, depth or blending of the host's", () => {
    const { gl } = host();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 4, height: 4, gl: asGl(gl) });
    pipeline.render(0);
    for (const draw of gl.draws) expect([draw.caps, draw.vertexArray, draw.blend]).toEqual([[], null, false]);
  });

  it("keeps the output on the GPU, drawing it only where it is asked to", () => {
    const { gl, fb } = host();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource("// A") }], width: 4, height: 4, gl: asGl(gl) });
    pipeline.render(0);
    expect(gl.draws).toHaveLength(1);
    expect(pipeline.outputTexture).toBe(gl.draws[0]!.target);
    const into = gl.createTexture();
    const target = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, 0, gl.TEXTURE_2D, into);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    pipeline.render(1, { target: target as unknown as WebGLFramebuffer });
    const present = gl.draws.at(-1)!;
    expect(fragmentOf(gl, present)).toContain("flair_source");
    expect([present.target, present.textures[0]]).toEqual([into, pipeline.outputTexture]);
  });

  it("shows the host's textures in image controls, copied each frame, leaving their filtering alone", () => {
    const { gl } = host();
    const hostTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, hostTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER, "// A") }], width: 4, height: 4, gl: asGl(gl) });
    pipeline.setInput(0, "uImage", { texture: hostTexture as unknown as WebGLTexture, width: 8, height: 6 });
    pipeline.render(0);
    const copies = gl.draws.filter((d) => d.textures[0] === hostTexture);
    expect(copies.length).toBe(2); // when set, and at the render
    const pass = gl.draws.at(-1)!;
    expect(pass.textures[0]).toBe(copies[1]!.target);
    gl.bindTexture(gl.TEXTURE_2D, hostTexture);
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER)).toBe(gl.LINEAR_MIPMAP_LINEAR);
  });

  it("guards image uploads that arrive later", async () => {
    installFakeImages();
    const { gl } = host();
    const before = gl.hostState();
    new ShaderPipeline({ passes: [{ source: shaderSource("uniform sampler2D uImage; // @control default=photo.png") }], width: 4, height: 4, gl: asGl(gl) });
    await flush();
    await flush();
    expect(gl.textures.some((t: FakeTexture) => (t.image as { src?: string } | null)?.src === "photo.png")).toBe(true);
    expect(gl.hostState()).toEqual(before);
  });

  it("frees only what it made", () => {
    const { gl } = host();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 4, height: 4, gl: asGl(gl) });
    pipeline.dispose();
    expect(gl.named("loseContext")).toHaveLength(0);
    expect(gl.lost).toBe(false);
  });

  it("refuses what needs a canvas of its own, or a context to read textures in", async () => {
    const { gl } = host();
    const pipeline = new ShaderPipeline({ passes: [{ source: shaderSource(SAMPLER) }], width: 4, height: 4, gl: asGl(gl) });
    await expect(pipeline.toImageBitmap()).rejects.toThrow(/outputTexture/);
    expect(() => pipeline.setInput(0, "uImage", { texture: {} as WebGLTexture, width: 2, height: 2 })).toThrow(/a texture of this context/);
    expect(() => new ShaderPipeline({ passes: [{ source: shaderSource() }], width: 4, height: 4, gl: asGl(gl), canvas: document.createElement("canvas") })).toThrow(/canvas or a host's gl context, not both/);
  });
});
