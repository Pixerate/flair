import { ShaderFrames } from "./frames.js";
import { ShaderCompileError } from "./program.js";
import { installFakeWebGl, shaderSource } from "./test-utils.js";

describe("ShaderFrames", () => {
  it("renders on a new canvas of the given size", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 64.4, height: 36 });
    expect([frames.width, frames.height]).toEqual([64, 36]);
    expect([frames.canvas.width, frames.canvas.height]).toEqual([64, 36]);
    expect(webgl.last().attributes).toMatchObject({ preserveDrawingBuffer: true });
  });

  it("can draw on a canvas it is given", () => {
    installFakeWebGl();
    const canvas = document.createElement("canvas");
    const frames = new ShaderFrames({ source: shaderSource(), width: 10, height: 5, canvas });
    expect(frames.canvas).toBe(canvas);
    expect([canvas.width, canvas.height]).toEqual([10, 5]);
  });

  it("is at least one pixel each way", () => {
    installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 0, height: -3 });
    expect([frames.width, frames.height]).toEqual([1, 1]);
  });

  it("renders the time it is given, counting frames and deltas", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 4, height: 4 });
    const gl = webgl.last();
    frames.render(2);
    expect([gl.uniform("iTime"), gl.uniform("iTimeDelta"), gl.uniform("iFrame")]).toEqual([
      [2],
      [0],
      [0],
    ]);
    frames.render(2.5);
    expect([gl.uniform("iTime"), gl.uniform("iTimeDelta"), gl.uniform("iFrame")]).toEqual([
      [2.5],
      [0.5],
      [1],
    ]);
    expect(gl.uniform("iMouse")).toEqual([0, 0, 0, 0]);
  });

  it("takes the frame number, delta and pointer from options", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 4, height: 4 });
    frames.render(1, { frame: 30, delta: 1 / 30, mouse: [5, 6, 7, 8] });
    const gl = webgl.last();
    expect(gl.uniform("iFrame")).toEqual([30]);
    expect(gl.uniform("iTimeDelta")).toEqual([1 / 30]);
    expect(gl.uniform("iMouse")).toEqual([5, 6, 7, 8]);
  });

  it("applies control values, and new ones after setValues", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({
      source: shaderSource("uniform float uSpeed; // @control default=1"),
      values: { uSpeed: 2 },
      width: 4,
      height: 4,
    });
    expect(frames.controls.map((c) => c.name)).toEqual(["uSpeed"]);
    frames.render(0);
    expect(webgl.last().uniform("uSpeed")).toEqual([2]);
    frames.setValues(undefined);
    frames.render(0);
    expect(webgl.last().uniform("uSpeed")).toEqual([1]);
  });

  it("reads pixels top row first", () => {
    // The fake fills each pixel's red channel with its row, counted from the bottom.
    installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 2, height: 3 });
    frames.render(0);
    const pixels = frames.readPixels();
    expect(pixels).toHaveLength(2 * 3 * 4);
    expect([pixels[0], pixels[8], pixels[16]]).toEqual([2, 1, 0]);
  });

  it("fills a buffer it is given, of the right size only", () => {
    installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 2, height: 2 });
    frames.render(0);
    const out = new Uint8ClampedArray(16);
    expect(frames.readPixels(out)).toBe(out);
    expect(() => frames.readPixels(new Uint8Array(3))).toThrow(RangeError);
  });

  it("throws a ShaderCompileError and releases the context when the source does not compile", () => {
    const webgl = installFakeWebGl({
      compileLog: "ERROR: 0:1: 'COMPILE_ERROR' : undeclared identifier",
    });
    let error: unknown;
    try {
      new ShaderFrames({ source: shaderSource("COMPILE_ERROR"), width: 4, height: 4 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ShaderCompileError);
    expect((error as ShaderCompileError).errors).toEqual([
      { line: 1, message: "'COMPILE_ERROR' : undeclared identifier" },
    ]);
    expect(webgl.last().lost).toBe(true);
  });

  it("throws without WebGL2", () => {
    installFakeWebGl({ webgl: false });
    expect(() => new ShaderFrames({ source: shaderSource(), width: 4, height: 4 })).toThrow(
      "WebGL2 is not available in this browser.",
    );
  });

  it("frees the program and context on dispose, once", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 4, height: 4 });
    frames.dispose();
    frames.dispose();
    const gl = webgl.last();
    expect(gl.programs[0]!.deleted).toBe(true);
    expect(gl.named("loseContext")).toHaveLength(1);
    expect(() => frames.render(0)).toThrow("These frames have been disposed.");
  });

  it("refuses to render on a lost context", () => {
    const webgl = installFakeWebGl();
    const frames = new ShaderFrames({ source: shaderSource(), width: 4, height: 4 });
    webgl.last().lost = true;
    expect(() => frames.render(0)).toThrow("The graphics context was lost.");
  });
});
