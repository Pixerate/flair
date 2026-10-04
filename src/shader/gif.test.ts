import { recordGif } from "./gif.js";
import { ShaderCompileError } from "./program.js";
import { installFakeWebGl, shaderSource } from "./test-utils.js";

interface ParsedGif {
  width: number;
  height: number;
  frames: { width: number; height: number; delay: number }[];
  loops: number | null;
}

/** Walks a GIF's blocks: enough to check its size, frames, delays and loop count. */
function parseGif(bytes: Uint8Array): ParsedGif {
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  const u16 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8);
  if (text(0, 6) !== "GIF89a") throw new Error("Not a GIF89a file.");
  const gif: ParsedGif = { width: u16(6), height: u16(8), frames: [], loops: null };
  let p = 13;
  if (bytes[10]! & 0x80) p += 3 * (1 << ((bytes[10]! & 7) + 1));
  const skipSubBlocks = () => {
    while (bytes[p] !== 0) p += bytes[p]! + 1;
    p += 1;
  };
  let delay = 0;
  for (;;) {
    const block = bytes[p++];
    if (block === 0x3b) return gif;
    if (block === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) delay = u16(p + 2);
      if (label === 0xff && text(p + 1, 11) === "NETSCAPE2.0") gif.loops = u16(p + 14);
      skipSubBlocks();
    } else if (block === 0x2c) {
      const frame = { width: u16(p + 4), height: u16(p + 6), delay };
      const flags = bytes[p + 8]!;
      p += 9;
      if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
      p += 1; // LZW minimum code size
      skipSubBlocks();
      gif.frames.push(frame);
    } else {
      throw new Error(`Unexpected block 0x${block?.toString(16)} at ${p - 1}.`);
    }
  }
}

const read = async (blob: Blob) => parseGif(new Uint8Array(await blob.arrayBuffer()));

describe("recordGif", () => {
  it("records duration × fps frames that loop forever", async () => {
    installFakeWebGl({ pixel: (x, y, t) => [x * 40, y * 40, Math.round(t * 100), 255] });
    const blob = await recordGif({
      source: shaderSource(),
      width: 8,
      height: 6,
      fps: 20,
      duration: 0.5,
    });
    expect(blob.type).toBe("image/gif");
    const gif = await read(blob);
    expect([gif.width, gif.height]).toEqual([8, 6]);
    expect(gif.frames).toHaveLength(10);
    expect(gif.frames.every((f) => f.width === 8 && f.height === 6 && f.delay === 5)).toBe(true);
    expect(gif.loops).toBe(0);
  });

  it("renders frames at exact time steps from the start time", async () => {
    const webgl = installFakeWebGl();
    await recordGif({
      source: shaderSource(),
      width: 2,
      height: 2,
      fps: 10,
      duration: 0.3,
      start: 4,
    });
    const gl = webgl.last();
    const times = gl
      .named("uniform1f")
      .filter((c) => (c.args[0] as { name: string }).name === "iTime");
    expect(times.map((c) => c.args[1])).toEqual([4, 4.1, 4.2]);
    const frames = gl.calls.filter(
      (c) => c.name === "uniform1i" && (c.args[0] as { name: string }).name === "iFrame",
    );
    expect(frames.map((c) => c.args[1])).toEqual([0, 1, 2]);
  });

  it("records at least one frame", async () => {
    installFakeWebGl();
    const gif = await read(
      await recordGif({ source: shaderSource(), width: 2, height: 2, fps: 10, duration: 0 }),
    );
    expect(gif.frames).toHaveLength(1);
  });

  it("applies control values", async () => {
    const webgl = installFakeWebGl();
    await recordGif({
      source: shaderSource("uniform float uSpeed; // @control default=1"),
      values: { uSpeed: 3 },
      width: 2,
      height: 2,
      fps: 10,
      duration: 0.1,
    });
    expect(webgl.last().uniform("uSpeed")).toEqual([3]);
  });

  it("reports progress after every frame", async () => {
    installFakeWebGl();
    const progress: [number, number][] = [];
    await recordGif({
      source: shaderSource(),
      width: 2,
      height: 2,
      fps: 10,
      duration: 0.4,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(progress).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
  });

  it("stops with an AbortError when aborted, and releases the context", async () => {
    const webgl = installFakeWebGl();
    const controller = new AbortController();
    const recording = recordGif({
      source: shaderSource(),
      width: 2,
      height: 2,
      fps: 10,
      duration: 2,
      signal: controller.signal,
      onProgress: (done) => {
        if (done === 3) controller.abort();
      },
    });
    await expect(recording).rejects.toMatchObject({ name: "AbortError" });
    const gl = webgl.last();
    expect(gl.named("readPixels").length).toBeLessThan(20);
    expect(gl.lost).toBe(true);
  });

  it("rejects with the first compile error", async () => {
    installFakeWebGl({ compileLog: "ERROR: 0:1: 'COMPILE_ERROR' : undeclared identifier" });
    const recording = recordGif({
      source: shaderSource("COMPILE_ERROR"),
      width: 2,
      height: 2,
      fps: 10,
      duration: 1,
    });
    await expect(recording).rejects.toBeInstanceOf(ShaderCompileError);
    await expect(recording).rejects.toThrow(
      "The shader does not compile (line 1): 'COMPILE_ERROR' : undeclared identifier",
    );
  });

  it("releases the context when it finishes", async () => {
    const webgl = installFakeWebGl();
    await recordGif({ source: shaderSource(), width: 2, height: 2, fps: 10, duration: 0.1 });
    expect(webgl.last().lost).toBe(true);
  });
});
