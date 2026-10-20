import { ShaderFrames } from "../shader/frames.js";
import { ShaderPipeline } from "../shader/pipeline.js";
import { installFakeWebGl } from "./index.js";

const SOURCE = "uniform float uSpeed; // @control default=1\nvoid mainImage(out vec4 c, in vec2 f) { c = vec4(1.0); }";

describe("@pixerate/flair/testing", () => {
  it("lets ShaderFrames render where there is no GPU, the same pixels every time", () => {
    const webgl = installFakeWebGl({ pixel: (x, y, t) => [x * 10, y * 10, t * 100, 255] });
    try {
      const frames = new ShaderFrames({ source: SOURCE, width: 3, height: 2, values: { uSpeed: 2 } });
      frames.render(1);
      const a = frames.readImageData().data;
      frames.render(1);
      expect(frames.readImageData().data).toEqual(a);
      // Rows top down: WebGL's row 1 is the image's first.
      expect([...a.slice(0, 4)]).toEqual([0, 10, 100, 255]);
      expect(webgl.last().uniform("iTime")).toEqual([1]);
      expect(webgl.last().uniform("uSpeed")).toEqual([2]);
      expect(webgl.contexts).toHaveLength(1);
    } finally {
      webgl.restore();
    }
  });

  it("hands out OffscreenCanvas contexts too, installing OffscreenCanvas where there is none", () => {
    expect(typeof OffscreenCanvas).toBe("undefined");
    const webgl = installFakeWebGl();
    try {
      const canvas = new OffscreenCanvas(4, 4);
      const pipeline = new ShaderPipeline({ passes: [{ source: SOURCE }], width: 4, height: 4, canvas });
      pipeline.render(0);
      expect(pipeline.readPixels()).toHaveLength(64);
      expect(webgl.last().canvas).toBe(canvas);
    } finally {
      webgl.restore();
    }
    expect(typeof OffscreenCanvas).toBe("undefined");
  });

  it("puts getContext back on restore", () => {
    const before = HTMLCanvasElement.prototype.getContext;
    const webgl = installFakeWebGl();
    expect(HTMLCanvasElement.prototype.getContext).not.toBe(before);
    webgl.restore();
    expect(HTMLCanvasElement.prototype.getContext).toBe(before);
  });

  it("can have no WebGL2, to test what happens without it", () => {
    const webgl = installFakeWebGl({ webgl: false });
    try {
      expect(() => new ShaderFrames({ source: SOURCE, width: 2, height: 2 })).toThrow("WebGL2 is not available");
    } finally {
      webgl.restore();
    }
  });

  it("gives a 2D context that records its calls and draws nothing", () => {
    const webgl = installFakeWebGl();
    try {
      const ctx = document.createElement("canvas").getContext("2d") as unknown as { drawImage(...a: unknown[]): void; calls: { name: string }[] };
      ctx.drawImage(1, 2, 3);
      expect(ctx.calls.map((c) => c.name)).toEqual(["drawImage"]);
      expect(webgl.last).toThrow("No WebGL2 context");
    } finally {
      webgl.restore();
    }
  });

  it("fails a shader the way a driver would, with the marker", () => {
    const webgl = installFakeWebGl({ compileLog: "ERROR: 0:1: 'nope' : undeclared identifier\n" });
    try {
      expect(() => new ShaderFrames({ source: `${SOURCE}\n// COMPILE_ERROR`, width: 2, height: 2 })).toThrow(/line 1.*undeclared identifier/);
    } finally {
      webgl.restore();
    }
  });
});
