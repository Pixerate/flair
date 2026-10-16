import { readFileSync } from "node:fs";
import {
  ImageLoadError,
  isSvgUrl,
  loadImage,
  preloadImages,
  releaseImages,
  seekVideo,
  shortUrl,
  sizeSvg,
  SVG_EDGE,
  TextureCache,
} from "./textures.js";
import { asGl, FakeGl, FakeVideo, flush, installFakeImages } from "./test-utils.js";
import type { LiveSource } from "./textures.js";

function setup(load?: (url: string) => Promise<TexImageSource>) {
  const gl = new FakeGl();
  const onLoad = vi.fn();
  const cache = new TextureCache(asGl(gl), onLoad, load);
  return { gl, onLoad, cache };
}

const image = (name: string) => ({ name }) as unknown as TexImageSource;

describe("loadImage", () => {
  it("asks for CORS except for data and blob URLs", async () => {
    const images = installFakeImages();
    await loadImage("https://example.com/a.png");
    await loadImage("data:image/png;base64,AAAA");
    await loadImage("blob:https://example.com/1");
    expect(images.map((i) => [i.src, i.crossOrigin])).toEqual([
      ["https://example.com/a.png", "anonymous"],
      ["data:image/png;base64,AAAA", null],
      ["blob:https://example.com/1", null],
    ]);
  });

  it("rejects with an ImageLoadError that names the URL and CORS", async () => {
    installFakeImages();
    const error = await loadImage("https://example.com/broken.png").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageLoadError);
    expect((error as ImageLoadError).url).toBe("https://example.com/broken.png");
    expect((error as Error).message).toBe(
      "Could not load the image at https://example.com/broken.png. If it is on another site, that site must allow cross-origin use (CORS).",
    );
  });
});

describe("SVG images", () => {
  const svg = (attrs: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><circle r="4"/></svg>`;
  const size = (markup: string) => {
    const el = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
    return ["width", "height", "viewBox"].map((a) => el.getAttribute(a));
  };

  it("isSvgUrl knows SVG data URLs and .svg paths", () => {
    expect(isSvgUrl("data:image/svg+xml;base64,AAAA")).toBe(true);
    expect(isSvgUrl("data:image/svg+xml,%3Csvg%3E")).toBe(true);
    expect(isSvgUrl("https://example.com/icons/logo.svg?v=2")).toBe(true);
    expect(isSvgUrl("/logo.SVG#top")).toBe(true);
    expect(isSvgUrl("https://example.com/logo.svg.png")).toBe(false);
    expect(isSvgUrl("https://example.com/a.png?f=.svg")).toBe(false);
    expect(isSvgUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isSvgUrl("blob:https://example.com/1")).toBe(false);
  });

  it("sizeSvg scales the long edge to the size asked for, keeping the aspect ratio", () => {
    expect(size(sizeSvg(svg('width="24" height="24" viewBox="0 0 24 24"'), 2048))).toEqual([
      "2048",
      "2048",
      "0 0 24 24",
    ]);
    // No size: the viewBox gives the aspect ratio.
    expect(size(sizeSvg(svg('viewBox="0 0 40 20"'), 1000))).toEqual(["1000", "500", "0 0 40 20"]);
    // No viewBox: one is added, so the drawing scales with the new size.
    expect(size(sizeSvg(svg('width="30px" height="60"'), 1000))).toEqual([
      "500",
      "1000",
      "0 0 30 60",
    ]);
    // Percentages say nothing about the size; neither size nor viewBox means 300 × 150.
    expect(size(sizeSvg(svg('width="100%"'), 600))).toEqual(["600", "300", "0 0 300 150"]);
  });

  it("sizeSvg sizes a Lucide-style icon and leaves its currentColor strokes alone", () => {
    const icon = readFileSync("tests/fixtures/icon.svg", "utf8");
    const sized = sizeSvg(icon, SVG_EDGE);
    expect(size(sized)).toEqual([String(SVG_EDGE), String(SVG_EDGE), "0 0 24 24"]);
    const el = new DOMParser().parseFromString(sized, "image/svg+xml").documentElement;
    expect(["fill", "stroke", "stroke-width"].map((a) => el.getAttribute(a))).toEqual(["none", "currentColor", "2"]);
  });

  it("sizeSvg throws for markup that is not an SVG", () => {
    expect(() => sizeSvg("<html></html>", 100)).toThrow("Not an SVG document.");
    expect(() => sizeSvg("<svg", 100)).toThrow("Not an SVG document.");
  });

  function stubSvgFetch(response: () => Promise<Response>) {
    const fetch = vi.fn(response);
    const revoke = vi.fn();
    const blobs: Blob[] = [];
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: (blob: Blob) => (blobs.push(blob), `blob:sized/${blobs.length}`),
        revokeObjectURL: revoke,
      }),
    );
    return { fetch, revoke, blobs };
  }

  it("loadImage fetches an SVG and decodes it sized to SVG_EDGE", async () => {
    const images = installFakeImages();
    const { fetch, revoke, blobs } = stubSvgFetch(
      async () => new Response(svg('width="24" height="12"')),
    );
    const image = await loadImage("https://example.com/logo.svg");
    expect(fetch).toHaveBeenCalledWith("https://example.com/logo.svg");
    expect(image).toBe(images[0]);
    expect([images[0]!.src, images[0]!.crossOrigin]).toEqual(["blob:sized/1", null]);
    expect(size(await blobs[0]!.text())).toEqual([
      String(SVG_EDGE),
      String(SVG_EDGE / 2),
      "0 0 24 12",
    ]);
    expect(blobs[0]!.type).toBe("image/svg+xml");
    expect(revoke).toHaveBeenCalledWith("blob:sized/1");
  });

  it("loadImage rejects with an ImageLoadError for the SVG's URL when it cannot be read", async () => {
    installFakeImages();
    for (const response of [
      async () => new Response("", { status: 404 }),
      async () => new Response("not an svg"),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ]) {
      stubSvgFetch(response);
      const error = await loadImage("https://example.com/logo.svg").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ImageLoadError);
      expect((error as ImageLoadError).url).toBe("https://example.com/logo.svg");
    }
  });
});

describe("shortUrl", () => {
  it("cuts data URLs after their type, and long URLs at 120 characters", () => {
    expect(shortUrl(`data:image/png;base64,${"A".repeat(100)}`)).toBe("data:image/png;base64,…");
    expect(shortUrl(`https://a.com/${"x".repeat(200)}`)).toHaveLength(120);
    expect(shortUrl("a.png")).toBe("a.png");
  });
});

describe("TextureCache", () => {
  it("draws an opaque black placeholder until the image arrives", async () => {
    const { gl, cache, onLoad } = setup(async (url) => image(url));
    const placeholder = cache.texture("a.png");
    expect(gl.textures).toHaveLength(1);
    expect(placeholder).toBe(gl.textures[0]);
    expect(gl.named("texImage2D")[0]!.args.slice(3, 5)).toEqual([1, 1]);
    await flush();
    expect(onLoad).toHaveBeenCalledWith("a.png", null);
    const texture = cache.texture("a.png");
    expect(texture).toBe(gl.textures[1]);
    expect(gl.textures[1]).toMatchObject({
      image: { name: "a.png" },
      flipped: true,
      mipmapped: true,
    });
    // Flipping is switched off again for anyone else uploading on this context.
    expect(gl.named("pixelStorei").at(-1)!.args).toEqual([gl.UNPACK_FLIP_Y_WEBGL, false]);
  });

  it("uses the placeholder for no image without loading anything", () => {
    const load = vi.fn();
    const { cache } = setup(load);
    cache.texture("");
    cache.request("");
    expect(load).not.toHaveBeenCalled();
  });

  it("loads each URL once", async () => {
    const load = vi.fn(async (url: string) => image(url));
    const { cache } = setup(load);
    cache.request("a.png");
    cache.texture("a.png");
    await cache.ready(["a.png", "a.png"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ready rejects with the failure, and the image stays black", async () => {
    const { cache, onLoad, gl } = setup(() => Promise.reject(new Error("404")));
    await expect(cache.ready(["a.png"])).rejects.toBeInstanceOf(ImageLoadError);
    expect(onLoad).toHaveBeenCalledWith("a.png", expect.any(ImageLoadError));
    expect(cache.error("a.png")?.url).toBe("a.png");
    expect(cache.texture("a.png")).toBe(gl.textures[0]);
  });

  it("retain deletes textures no longer shown, and drops their loads", async () => {
    const { cache, gl, onLoad } = setup(async (url) => image(url));
    await cache.ready(["a.png"]);
    cache.request("b.png");
    cache.retain([]);
    await flush();
    expect(gl.textures[0]!.deleted).toBe(true);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(gl.textures).toHaveLength(1);
  });

  it("dispose deletes everything and drops loads in flight", async () => {
    const { cache, gl, onLoad } = setup(async (url) => image(url));
    cache.texture("a.png");
    cache.dispose();
    await flush();
    expect(gl.textures.every((t) => t.deleted)).toBe(true);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not upload into a lost context", async () => {
    const { cache, gl, onLoad } = setup(async (url) => image(url));
    cache.request("a.png");
    gl.lost = true;
    await flush();
    expect(gl.textures).toHaveLength(0);
    expect(onLoad).not.toHaveBeenCalled();
  });
});

describe("TextureCache live sources", () => {
  const live = (v: FakeVideo) => v as unknown as LiveSource;

  it("is undefined for a control with none, so its URL is drawn", () => {
    const { cache } = setup(async (url) => image(url));
    expect(cache.liveTexture("uImage")).toBeUndefined();
  });

  it("shows black until a video has a frame, then uploads it flipped and mipmapped", () => {
    const { cache, gl } = setup();
    const video = new FakeVideo();
    cache.setLive("uImage", live(video));
    const placeholder = cache.liveTexture("uImage");
    expect(gl.textures[0]!.image).toBe("1x1");
    expect(placeholder).toBe(gl.textures[0]);
    expect(cache.liveChanged()).toBe(false);
    video.readyState = 2;
    expect(cache.liveChanged()).toBe(true);
    const texture = cache.liveTexture("uImage");
    expect(texture).toBe(gl.textures[1]);
    expect(gl.textures[1]).toMatchObject({ image: video, flipped: true, mipmapped: true });
    expect(gl.named("pixelStorei").at(-1)!.args).toEqual([gl.UNPACK_FLIP_Y_WEBGL, false]);
    expect(cache.liveChanged()).toBe(false);
  });

  it("uploads a video again only when its frame changes, into the same texture", () => {
    const { cache, gl } = setup();
    const video = new FakeVideo();
    video.readyState = 4;
    cache.setLive("uImage", live(video));
    cache.liveTexture("uImage");
    cache.liveTexture("uImage");
    expect(gl.named("texImage2D")).toHaveLength(1);
    video.playTo(0.04);
    expect(cache.liveChanged()).toBe(true);
    expect(cache.liveTexture("uImage")).toBe(gl.textures[0]);
    expect(gl.named("texImage2D")).toHaveLength(2);
    expect(gl.textures).toHaveLength(1);
  });

  it("uploads a canvas on every frame", () => {
    const { cache, gl } = setup();
    const canvas = document.createElement("canvas");
    cache.setLive("uImage", canvas);
    cache.liveTexture("uImage");
    cache.liveTexture("uImage");
    expect(gl.named("texImage2D")).toHaveLength(2);
    expect(gl.textures[0]!.image).toBe(canvas);
  });

  it("reports a video it may not read (CORS) once, and shows black", () => {
    const { cache, gl, onLoad } = setup();
    const video = new FakeVideo();
    video.readyState = 4;
    const upload = gl.texImage2D.bind(gl);
    gl.texImage2D = (...args: unknown[]) => {
      if (args.length === 6) throw new DOMException("tainted", "SecurityError");
      upload(...args);
    };
    cache.setLive("uImage", live(video));
    const texture = cache.liveTexture("uImage");
    expect(texture).toBe(gl.textures.find((t) => t.image === "1x1"));
    expect(onLoad).toHaveBeenCalledTimes(1);
    const error = onLoad.mock.calls[0]![1] as ImageLoadError;
    expect(error).toBeInstanceOf(ImageLoadError);
    expect(error.url).toBe("https://example.com/clip.mp4");
    expect(error.message).toContain('crossOrigin = "anonymous"');
    video.playTo(1);
    cache.liveTexture("uImage");
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(cache.liveChanged()).toBe(false);
  });

  it("setting null or another source deletes the texture; dispose deletes them all", () => {
    const { cache, gl } = setup();
    const canvas = document.createElement("canvas");
    cache.setLive("uImage", canvas);
    cache.liveTexture("uImage");
    cache.setLive("uImage", canvas);
    expect(gl.textures[0]!.deleted).toBeFalsy();
    cache.setLive("uImage", null);
    expect(gl.textures[0]!.deleted).toBe(true);
    expect(cache.liveTexture("uImage")).toBeUndefined();
    cache.setLive("uOther", canvas);
    cache.liveTexture("uOther");
    cache.dispose();
    expect(gl.textures.every((t) => t.deleted)).toBe(true);
  });

  it("liveReady waits for each video's first frame, and rejects when one fails", async () => {
    const { cache } = setup();
    const video = new FakeVideo();
    cache.setLive("uImage", live(video));
    let done = false;
    const ready = cache.liveReady().then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    video.readyState = 2;
    video.emit("loadeddata");
    await ready;
    expect(done).toBe(true);

    const broken = new FakeVideo();
    cache.setLive("uOther", live(broken));
    const failed = cache.liveReady();
    broken.emit("error");
    await expect(failed).rejects.toBeInstanceOf(ImageLoadError);
  });
});

describe("seekVideo", () => {
  it("waits for metadata, seeks within the video's length and settles on seeked", async () => {
    const video = new FakeVideo();
    const seeking = seekVideo(video as unknown as HTMLVideoElement, 25);
    await flush();
    expect(video.currentTime).toBe(0);
    video.readyState = 1;
    video.emit("loadedmetadata");
    await seeking;
    expect(video.currentTime).toBe(10);
    expect(video.readyState).toBe(2);
  });

  it("settles at once when the frame is already there", async () => {
    const video = new FakeVideo();
    video.readyState = 4;
    video.playTo(3);
    const seeked = vi.fn();
    video.addEventListener("seeked", seeked);
    await seekVideo(video as unknown as HTMLVideoElement, 3);
    expect(seeked).not.toHaveBeenCalled();
  });
});

describe("preloadImages", () => {
  afterEach(() => releaseImages());

  it("loads each URL once, and a cache made afterwards uploads it at once", async () => {
    const images = installFakeImages();
    await preloadImages(["a.png", "a.png", ""]);
    await preloadImages(["a.png"]);
    expect(images).toHaveLength(1);
    const load = vi.fn();
    const { gl, cache, onLoad } = setup(load);
    const texture = cache.texture("a.png");
    expect(texture).toBe(gl.textures[0]);
    expect(gl.textures[0]).toMatchObject({ image: images[0], flipped: true, mipmapped: true });
    expect(load).not.toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
    await expect(cache.ready(["a.png"])).resolves.toBeUndefined();
  });

  it("rejects with the first failure, keeps the rest, and retries a failed URL", async () => {
    const images = installFakeImages();
    await expect(preloadImages(["broken.png", "b.png"])).rejects.toBeInstanceOf(ImageLoadError);
    const { gl, cache } = setup(async (url) => image(url));
    expect(cache.texture("b.png")).toBe(gl.textures[0]);
    await expect(preloadImages(["broken.png"])).rejects.toBeInstanceOf(ImageLoadError);
    expect(images.filter((i) => i.src === "broken.png")).toHaveLength(2);
  });

  it("releaseImages forgets them, so caches load as usual", async () => {
    installFakeImages();
    await preloadImages(["a.png"]);
    releaseImages(["a.png"]);
    const load = vi.fn(async (url: string) => image(url));
    const { cache } = setup(load);
    cache.texture("a.png");
    expect(load).toHaveBeenCalledWith("a.png");
  });
});
