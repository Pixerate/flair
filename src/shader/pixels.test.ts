import { ShaderFrames } from "./frames.js";
import { ImageLoadError, loadImageSource, TextureCache, type LiveSource } from "./textures.js";
import { asGl, FakeGl, installFakeWebGl, shaderSource } from "./test-utils.js";

// Pictures from outside a page's elements, as tests have no ImageBitmap, VideoFrame or OffscreenCanvas.
const bitmap = (width = 4, height = 2) => ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
const videoFrame = () => ({ codedWidth: 4, codedHeight: 2, displayWidth: 4, displayHeight: 2, format: "RGBA", close: vi.fn() }) as unknown as VideoFrame;
const imageData = () => ({ data: new Uint8ClampedArray(4 * 2 * 4), width: 4, height: 2, colorSpace: "srgb" }) as unknown as ImageData;

function setup(load?: (url: string) => Promise<TexImageSource>) {
  const gl = new FakeGl();
  const onLoad = vi.fn();
  const cache = new TextureCache(asGl(gl), onLoad, load);
  return { gl, onLoad, cache };
}

/** Texture uploads of a picture (not the 1 × 1 placeholder or the empty target of a GPU flip). */
const uploads = (gl: FakeGl) => gl.named("texImage2D").filter((c) => c.args.length === 6);

describe("TextureCache stills", () => {
  it.each([
    ["an ImageData", imageData],
    ["a VideoFrame", videoFrame],
  ])("uploads %s once, upright and mipmapped", (_, make) => {
    const { cache, gl } = setup();
    const picture = make();
    cache.setLive("uImage", picture as LiveSource);
    const texture = cache.liveTexture("uImage");
    expect(cache.liveTexture("uImage")).toBe(texture);
    expect(uploads(gl)).toHaveLength(1);
    expect(texture).toMatchObject({ image: picture, flipped: true, mipmapped: true });
  });

  it("flips an ImageBitmap on the GPU, as WebGL ignores UNPACK_FLIP_Y_WEBGL for it", () => {
    const { cache, gl } = setup();
    const picture = bitmap(4, 2);
    cache.setLive("uImage", picture);
    const texture = cache.liveTexture("uImage");
    expect(texture).toMatchObject({ image: picture, flipped: true, mipmapped: true });
    expect(gl.named("blitFramebuffer")[0]!.args.slice(0, 8)).toEqual([0, 0, 4, 2, 0, 2, 4, 0]);
    // Drawing goes back to the canvas afterwards.
    expect(gl.named("bindFramebuffer").slice(-2).map((c) => c.args[1])).toEqual([null, null]);
    cache.dispose();
    expect(gl.named("deleteFramebuffer")).toHaveLength(2);
  });

  it("uploads the same still again when it is set again (its pixels may have changed), and a new one into the same texture", () => {
    const { cache, gl } = setup();
    const picture = imageData();
    cache.setLive("uImage", picture);
    const texture = cache.liveTexture("uImage");
    cache.setLive("uImage", picture);
    cache.liveTexture("uImage");
    expect(uploads(gl)).toHaveLength(2);
    const next = imageData();
    cache.setLive("uImage", next);
    expect(cache.liveTexture("uImage")).toMatchObject({ image: next });
    expect(texture).toMatchObject({ deleted: true });
  });

  it("uploads an OffscreenCanvas on every frame, as it may have been drawn on", () => {
    const { cache, gl } = setup();
    const canvas = { width: 4, height: 2, getContext: vi.fn() } as unknown as OffscreenCanvas;
    cache.setLive("uImage", canvas);
    cache.liveTexture("uImage");
    cache.liveTexture("uImage");
    expect(uploads(gl)).toHaveLength(2);
  });

  it("reports a closed VideoFrame once, saying what to do, and shows black", () => {
    const { cache, gl, onLoad } = setup();
    const upload = gl.texImage2D.bind(gl);
    gl.texImage2D = (...args: unknown[]) => {
      if (args.length === 6) throw new DOMException("closed", "InvalidStateError");
      upload(...args);
    };
    cache.setLive("uImage", videoFrame());
    expect(cache.liveTexture("uImage")).toMatchObject({ image: "1x1" });
    cache.liveTexture("uImage");
    expect(onLoad).toHaveBeenCalledTimes(1);
    const error = onLoad.mock.calls[0]![1] as ImageLoadError;
    expect(error.message).toContain("closed");
    expect(error.message).toContain("setLiveSource");
  });

  it("uploads an image URL decoded as an ImageBitmap (as in a Worker) upright", async () => {
    const decoded = bitmap();
    const { cache } = setup(async () => decoded);
    await cache.ready(["a.png"]);
    expect(cache.texture("a.png")).toMatchObject({ image: decoded, flipped: true, mipmapped: true });
  });
});

describe("loadImageSource in a Worker", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", undefined);
  });

  it("fetches with CORS and decodes with createImageBitmap", async () => {
    const decoded = bitmap();
    const fetch = vi.fn(async () => new Response(new Blob(["png"])));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => decoded));
    await expect(loadImageSource("https://example.com/a.png")).resolves.toBe(decoded);
    expect(fetch).toHaveBeenCalledWith("https://example.com/a.png", { mode: "cors" });
  });

  it("rejects with an ImageLoadError for a failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const error = await loadImageSource("https://example.com/a.png").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageLoadError);
    expect((error as ImageLoadError).url).toBe("https://example.com/a.png");
  });

  it("refuses an SVG, saying to rasterise it on the page", async () => {
    const error = await loadImageSource("icons/star.svg").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageLoadError);
    expect((error as Error).message).toMatch(/Worker cannot decode SVG.*setLiveSource/);
  });
});

/** An `OffscreenCanvas` whose WebGL2 context is a `FakeGl`. */
class FakeOffscreenCanvas {
  static contexts: FakeGl[] = [];
  gl: FakeGl | null = null;
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(kind: string, attributes?: unknown) {
    if (kind !== "webgl2") return null;
    this.gl ??= new FakeGl({}, attributes);
    FakeOffscreenCanvas.contexts.push(this.gl);
    return this.gl;
  }
}

describe("ShaderFrames in a Worker", () => {
  beforeEach(() => {
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  });

  it("draws on a new OffscreenCanvas where there is no document", () => {
    vi.stubGlobal("document", undefined);
    const frames = new ShaderFrames({ source: shaderSource(), width: 8, height: 4 });
    expect(frames.canvas).toBeInstanceOf(FakeOffscreenCanvas);
    expect([frames.canvas.width, frames.canvas.height]).toEqual([8, 4]);
    frames.render(1);
    expect((frames.canvas as unknown as FakeOffscreenCanvas).gl!.uniform("iTime")).toEqual([1]);
  });

  it("draws on an OffscreenCanvas it is given, resized, and shows stills in image controls", () => {
    vi.stubGlobal("document", undefined);
    const canvas = new FakeOffscreenCanvas(1, 1) as unknown as OffscreenCanvas;
    const frames = new ShaderFrames({ source: shaderSource("uniform sampler2D uImage; // @control"), width: 6, height: 3, canvas });
    expect(frames.canvas).toBe(canvas);
    expect([canvas.width, canvas.height]).toEqual([6, 3]);
    const picture = videoFrame();
    frames.setLiveSource("uImage", picture);
    frames.render(0);
    const gl = (canvas as unknown as FakeOffscreenCanvas).gl!;
    expect(gl.textures.some((t) => t.image === picture && t.flipped)).toBe(true);
  });
});

describe("ShaderFrames output", () => {
  it("readImageData is an ImageData, rows top down", () => {
    installFakeWebGl({ pixel: (_x, y) => [y * 10, 0, 0, 255] });
    const frames = new ShaderFrames({ source: shaderSource(), width: 2, height: 3 });
    frames.render(0);
    const image = frames.readImageData();
    if (typeof ImageData !== "undefined") expect(image).toBeInstanceOf(ImageData);
    expect([image.width, image.height]).toEqual([2, 3]);
    // WebGL's bottom row (y 0) is the image's last.
    expect([image.data[0], image.data[2 * 2 * 4]]).toEqual([20, 0]);
  });

  it("readImageData is ImageData-shaped where there is no ImageData", () => {
    installFakeWebGl();
    vi.stubGlobal("ImageData", undefined);
    const frames = new ShaderFrames({ source: shaderSource(), width: 2, height: 2 });
    frames.render(0);
    const image = frames.readImageData();
    expect(image).toMatchObject({ width: 2, height: 2, colorSpace: "srgb" });
    expect(image.data).toBeInstanceOf(Uint8ClampedArray);
    expect(image.data).toHaveLength(16);
  });

  it("toImageBitmap makes a bitmap of the canvas, and refuses after dispose", async () => {
    installFakeWebGl();
    const made = bitmap();
    const create = vi.fn(async () => made);
    vi.stubGlobal("createImageBitmap", create);
    const frames = new ShaderFrames({ source: shaderSource(), width: 2, height: 2 });
    frames.render(0);
    await expect(frames.toImageBitmap()).resolves.toBe(made);
    expect(create).toHaveBeenCalledWith(frames.canvas);
    frames.dispose();
    await expect(frames.toImageBitmap()).rejects.toThrow("disposed");
  });
});
