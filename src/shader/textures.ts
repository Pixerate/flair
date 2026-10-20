import type { TextureSettings } from "./controls.js";

/** Why an image control's URL could not be shown. */
export class ImageLoadError extends Error {
  readonly url: string;

  constructor(url: string, cause?: unknown, message?: string) {
    super(
      message ??
        `Could not load the image at ${shortUrl(url)}. If it is on another site, that site must allow cross-origin use (CORS).`,
      { cause },
    );
    this.name = "ImageLoadError";
    this.url = url;
  }
}

/** A URL short enough for a message: a data URL is cut after its type. */
export function shortUrl(url: string): string {
  if (url.startsWith("data:")) return `${url.slice(0, Math.min(url.indexOf(",") + 1 || 40, 40))}…`;
  return url.length > 120 ? `${url.slice(0, 119)}…` : url;
}

/**
 * The long edge, in pixels, SVG images are rasterised at. WebGL2 guarantees
 * textures this large on every device.
 */
export const SVG_EDGE = 2048;

const SVG_TYPE = "image/svg+xml";

/** Whether `url` is an SVG: a `data:image/svg+xml` URL, or a path ending in `.svg`. */
export function isSvgUrl(url: string): boolean {
  return /^data:image\/svg\+xml[;,]/i.test(url) || /^(?!data:)[^?#]*\.svg([?#]|$)/i.test(url);
}

/** A length attribute in user units, or undefined for a percentage, `auto` or nothing. */
function svgLength(value: string | null): number | undefined {
  const match = value?.trim().match(/^([\d.]+)(px)?$/);
  const n = match ? Number(match[1]) : NaN;
  return n > 0 ? n : undefined;
}

/**
 * An SVG's markup with `width` and `height` set so its long edge is `edge`
 * pixels, keeping its aspect ratio. An image decodes an SVG at its own size
 * (often icon-sized, or 300 × 150 when it has none), so it would make a
 * small, blurry texture; at this size it is rasterised crisply. A `viewBox`
 * is added where missing, so the drawing scales with the new size rather
 * than staying in the corner. Throws for markup that is not an SVG.
 */
export function sizeSvg(markup: string, edge: number): string {
  const doc = new DOMParser().parseFromString(markup, SVG_TYPE);
  const svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Not an SVG document.");
  }
  const box = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const hasBox = box.length === 4 && box[2]! > 0 && box[3]! > 0;
  const width = svgLength(svg.getAttribute("width")) ?? (hasBox ? box[2]! : 300);
  const height = svgLength(svg.getAttribute("height")) ?? (hasBox ? box[3]! : 150);
  if (!hasBox) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const scale = edge / Math.max(width, height);
  svg.setAttribute("width", String(Math.max(1, Math.round(width * scale))));
  svg.setAttribute("height", String(Math.max(1, Math.round(height * scale))));
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Loads and decodes an image for WebGL. Images from other origins are
 * requested with CORS (`crossOrigin = "anonymous"`): WebGL refuses pixels a
 * page is not allowed to read. SVGs (see {@link isSvgUrl}) are fetched, also
 * with CORS, and sized to {@link SVG_EDGE} pixels on their long edge before
 * they are decoded, so they stay sharp however small they were drawn.
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  if (isSvgUrl(url)) return loadSvg(url);
  return decode(url, url, !/^(data|blob):/i.test(url));
}

/** Whether this is a page with `Image` (false in a Web Worker). */
const canDecodeImages = () => typeof Image !== "undefined";

/**
 * Loads an image for WebGL wherever this runs: {@link loadImage} on a page,
 * and in a Web Worker, which has no `Image`, a CORS `fetch` decoded with
 * `createImageBitmap`. A Worker cannot decode SVG (it has no DOM): it
 * rejects with an {@link ImageLoadError} saying so; rasterise the SVG on the
 * page and pass the `ImageBitmap` to `setLiveSource` instead.
 */
export async function loadImageSource(url: string): Promise<HTMLImageElement | ImageBitmap> {
  if (canDecodeImages()) return loadImage(url);
  if (isSvgUrl(url)) {
    throw new ImageLoadError(
      url,
      undefined,
      `Could not load the SVG at ${shortUrl(url)}: a Worker cannot decode SVG. Draw it on the page and pass the ImageBitmap with setLiveSource instead.`,
    );
  }
  try {
    const response = await fetch(url, { mode: /^(data|blob):/i.test(url) ? undefined : "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await createImageBitmap(await response.blob());
  } catch (e) {
    throw new ImageLoadError(url, e);
  }
}

async function loadSvg(url: string): Promise<HTMLImageElement> {
  let markup: string;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    markup = sizeSvg(await response.text(), SVG_EDGE);
  } catch (e) {
    throw new ImageLoadError(url, e);
  }
  const sized = URL.createObjectURL(new Blob([markup], { type: SVG_TYPE }));
  try {
    return await decode(sized, url, false);
  } finally {
    URL.revokeObjectURL(sized);
  }
}

async function decode(src: string, url: string, cors: boolean): Promise<HTMLImageElement> {
  const image = new Image();
  if (cors) image.crossOrigin = "anonymous";
  image.src = src;
  try {
    await image.decode();
  } catch (e) {
    throw new ImageLoadError(url, e);
  }
  return image;
}

/** Images decoded by {@link preloadImages}, by URL, for every context on the page. */
const preloaded = new Map<string, Promise<HTMLImageElement | ImageBitmap>>();
const decoded = new Map<string, HTMLImageElement | ImageBitmap>();

/**
 * Loads and decodes images ahead of time, for every WebGL context on the
 * page: a texture cache that meets one of them afterwards (in a
 * `ShaderRenderer`, `ShaderFrames` or thumbnail) uploads it at once, so even
 * its first frame shows the image. Otherwise an image arrives a moment after
 * the first frame, which is black where it goes. Use it before drawing frames
 * that cannot wait, such as a video player asking a new `ShaderFrames` for
 * frame _n_.
 *
 * Each URL loads once, however often it is preloaded. Rejects with the first
 * {@link ImageLoadError}; the other images still load. Preloaded images stay
 * in memory until {@link releaseImages}.
 */
export async function preloadImages(urls: Iterable<string>): Promise<void> {
  const loads = [...new Set(urls)].filter(Boolean).map((url) => {
    let load = preloaded.get(url);
    if (!load) {
      load = loadImageSource(url).then(
        (image) => {
          if (preloaded.get(url) === load) decoded.set(url, image);
          return image;
        },
        (e: unknown) => {
          if (preloaded.get(url) === load) preloaded.delete(url);
          throw e;
        },
      );
      preloaded.set(url, load);
    }
    return load;
  });
  const results = await Promise.allSettled(loads);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

/** Forgets preloaded images (all of them without `urls`). Textures already made from them stay. */
export function releaseImages(urls?: Iterable<string>) {
  for (const url of urls ?? [...preloaded.keys()]) {
    preloaded.delete(url);
    decoded.delete(url);
  }
}

/** Something that hands `drawFrame` a texture for an image URL. */
export interface TextureSource {
  /** The texture for `url`: the image once loaded, a 1 × 1 opaque black placeholder until then. */
  texture(url: string): WebGLTexture | null;
  /**
   * The texture of the live source set for the image control `name` (see
   * {@link TextureCache.setLive}), with its current frame; undefined when
   * the control has none, so its URL is drawn instead.
   */
  liveTexture?(name: string): WebGLTexture | null | undefined;
}

/**
 * Pixels for an image control, in place of its URL, from wherever they come
 * from: a playing `<video>`, a canvas (or `OffscreenCanvas`) something else
 * draws on, or a still picture: an `ImageBitmap`, a WebCodecs `VideoFrame`
 * or an `ImageData`. Videos re-upload when their frame changes and canvases
 * on every frame drawn. A still uploads once; pass the next one (or the same
 * one again, after changing its pixels) to `setLiveSource` to show it.
 * Every one works in a Web Worker except `<video>` and `<canvas>`, which
 * only exist on the page. A `VideoFrame` stays the caller's to `close()`,
 * after the frame that shows it has been rendered.
 */
export type LiveSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap
  | VideoFrame
  | ImageData;

interface Live {
  source: LiveSource;
  texture: WebGLTexture | null;
  /** The video time last uploaded (NaN before the first upload, or when a still has changed). */
  uploaded: number;
  /** Set once the source could not be uploaded: it shows black, and is not tried again. */
  error: ImageLoadError | null;
}

/** Whether `source` is a video element (without touching `HTMLVideoElement`, which tests and workers lack). */
function isVideo(source: LiveSource): source is HTMLVideoElement {
  return "readyState" in source && "currentTime" in source;
}

/** Whether `source` is redrawn by something else: a canvas or an `OffscreenCanvas`. */
function isCanvas(source: LiveSource): source is HTMLCanvasElement | OffscreenCanvas {
  return "getContext" in source;
}

/**
 * Whether `source` is an `ImageBitmap` (by shape, as tests have no
 * `ImageBitmap`): it can be closed but, unlike a `VideoFrame`, has no format.
 * WebGL ignores `UNPACK_FLIP_Y_WEBGL` for these, so they are flipped on the GPU.
 */
function isBitmap(source: unknown): source is ImageBitmap {
  return typeof source === "object" && source !== null && "close" in source && !("codedWidth" in source) && "width" in source;
}

/** `HAVE_CURRENT_DATA`: a video has a frame to show. */
const HAVE_CURRENT_DATA = 2;

/** A name for a live source in messages: its video URL, or the control's name. */
function liveName(name: string, source: LiveSource): string {
  return (isVideo(source) && (source.currentSrc || source.src)) || name;
}

/**
 * Seeks a video to `time` seconds and settles once the frame there can be
 * drawn, for stepping a video in time with `ShaderFrames`: `await
 * seekVideo(video, t); frames.render(t)`. Pause the video first, or it
 * moves on. The time is clamped to the video's length.
 */
export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (video.readyState < 1) {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error(`Could not load the video ${shortUrl(video.currentSrc || video.src)}.`)), { once: true });
    });
  }
  const target = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));
  if (Math.abs(video.currentTime - target) < 1e-6 && video.readyState >= HAVE_CURRENT_DATA && !video.seeking) return;
  await new Promise<void>((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = target;
  });
}

interface Entry {
  texture: WebGLTexture | null;
  /** Settles when the image is uploaded or has failed. */
  loaded: Promise<void>;
  error: ImageLoadError | null;
}

/**
 * The textures of one WebGL context, by image URL. A URL starts loading the
 * first time it is asked for; until it arrives the placeholder is drawn, and
 * `onLoad` hears when it does (or fails) so the owner can redraw. An image
 * already decoded by {@link preloadImages} is uploaded at once instead. Images are
 * uploaded upright (`fragCoord / iResolution` samples them the right way up)
 * with mipmaps.
 */
export class TextureCache implements TextureSource {
  private readonly gl: WebGL2RenderingContext;
  private readonly entries = new Map<string, Entry>();
  private readonly live = new Map<string, Live>();
  private readonly onLoad: (url: string, error: ImageLoadError | null) => void;
  private readonly load: (url: string) => Promise<TexImageSource>;
  private placeholder: WebGLTexture | null = null;
  private disposed = false;

  private flipper: { scratch: WebGLTexture | null; read: WebGLFramebuffer | null; draw: WebGLFramebuffer | null } | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    onLoad: (url: string, error: ImageLoadError | null) => void = () => {},
    load: (url: string) => Promise<TexImageSource> = loadImageSource,
  ) {
    this.gl = gl;
    this.onLoad = onLoad;
    this.load = load;
  }

  texture(url: string): WebGLTexture | null {
    return (url && this.entry(url).texture) || this.blank();
  }

  /** Starts loading `url` if it is new. */
  request(url: string) {
    if (url) this.entry(url);
  }

  private entry(url: string): Entry {
    const existing = this.entries.get(url);
    if (existing) return existing;
    const created: Entry = { texture: null, loaded: Promise.resolve(), error: null };
    const ready = decoded.get(url);
    if (ready && !this.gl.isContextLost()) {
      created.texture = this.upload(ready);
      this.entries.set(url, created);
      return created;
    }
    created.loaded = this.load(url).then(
      (image) => {
        if (this.entries.get(url) !== created || this.disposed || this.gl.isContextLost()) return;
        created.texture = this.upload(image);
        this.onLoad(url, null);
      },
      (e: unknown) => {
        if (this.entries.get(url) !== created || this.disposed) return;
        created.error = e instanceof ImageLoadError ? e : new ImageLoadError(url, e);
        this.onLoad(url, created.error);
      },
    );
    this.entries.set(url, created);
    return created;
  }

  /**
   * Shows `source` in the image control `name` instead of its URL, frame by
   * frame (`null` goes back to the URL). Its texture is uploaded as it is
   * drawn: a video's whenever it has moved to another frame, a canvas's on
   * every frame. Until a video has a frame it shows black. A video from
   * another site needs CORS (`crossOrigin = "anonymous"` and the site's
   * consent); without it the upload fails, `onLoad` hears an
   * {@link ImageLoadError}, and the control shows black.
   */
  setLive(name: string, source: LiveSource | null) {
    const existing = this.live.get(name);
    if (existing && existing.source === source) {
      // The same still again: its pixels may have changed, so upload it on the next frame.
      if (!isVideo(existing.source)) existing.uploaded = NaN;
      return;
    }
    if (existing?.texture) this.gl.deleteTexture(existing.texture);
    this.live.delete(name);
    if (source) this.live.set(name, { source, texture: null, uploaded: NaN, error: null });
  }

  liveTexture(name: string): WebGLTexture | null | undefined {
    const live = this.live.get(name);
    if (!live) return undefined;
    if (live.error || this.gl.isContextLost()) return this.blank();
    const { source } = live;
    if (isVideo(source)) {
      if (source.readyState < HAVE_CURRENT_DATA) return live.texture ?? this.blank();
      if (live.texture && live.uploaded === source.currentTime) return live.texture;
      live.uploaded = source.currentTime;
    } else if (!isCanvas(source)) {
      if (live.texture && live.uploaded === 0) return live.texture;
      live.uploaded = 0;
    }
    const gl = this.gl;
    live.texture ??= gl.createTexture();
    try {
      this.uploadUpright(live.texture, source);
    } catch (e) {
      const url = liveName(name, source);
      live.error = new ImageLoadError(
        url,
        e,
        isVideo(source)
          ? `Could not draw the video at ${shortUrl(url)}. If it is on another site, set crossOrigin = "anonymous" on the <video> and make sure that site allows cross-origin use (CORS).`
          : `Could not draw the picture in ${name}: a VideoFrame or ImageBitmap that has been closed cannot be drawn, nor pixels from another site without CORS. Pass a new picture with setLiveSource.`,
      );
      this.onLoad(url, live.error);
      return this.blank();
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    return live.texture;
  }

  /**
   * Whether a live video has moved to a frame not yet drawn (or has its
   * first frame ready), so a paused preview knows to draw again.
   */
  liveChanged(): boolean {
    for (const live of this.live.values()) {
      const { source } = live;
      if (live.error || !isVideo(source) || source.readyState < HAVE_CURRENT_DATA) continue;
      if (!live.texture || live.uploaded !== source.currentTime) return true;
    }
    return false;
  }

  /**
   * Settles once every live video has a frame to show. Rejects with an
   * {@link ImageLoadError} when one fails to load.
   */
  async liveReady(): Promise<void> {
    await Promise.all(
      [...this.live.entries()].map(([name, { source }]) => {
        if (!isVideo(source) || source.readyState >= HAVE_CURRENT_DATA) return undefined;
        return new Promise<void>((resolve, reject) => {
          source.addEventListener("loadeddata", () => resolve(), { once: true });
          source.addEventListener(
            "error",
            () => reject(new ImageLoadError(liveName(name, source), source.error, `Could not load the video at ${shortUrl(liveName(name, source))}.`)),
            { once: true },
          );
        });
      }),
    );
  }

  /** The error for `url`, if it failed to load. */
  error(url: string): ImageLoadError | null {
    return this.entries.get(url)?.error ?? null;
  }

  /**
   * Settles once every one of `urls` has loaded or failed (starting any that
   * are new). Rejects with the first {@link ImageLoadError}.
   */
  async ready(urls: Iterable<string>): Promise<void> {
    const entries = [...urls].filter(Boolean).map((url) => this.entry(url));
    await Promise.all(entries.map((e) => e.loaded));
    const failed = entries.find((e) => e.error);
    if (failed) throw failed.error;
  }

  /** Deletes the textures of every URL not in `urls`; a later request loads them again. */
  retain(urls: Iterable<string>) {
    const keep = new Set(urls);
    for (const [url, entry] of this.entries) {
      if (keep.has(url)) continue;
      if (entry.texture) this.gl.deleteTexture(entry.texture);
      this.entries.delete(url);
    }
  }

  /** Deletes every texture; loads still in flight are dropped. */
  dispose() {
    this.retain([]);
    for (const name of [...this.live.keys()]) this.setLive(name, null);
    if (this.placeholder) this.gl.deleteTexture(this.placeholder);
    this.placeholder = null;
    if (this.flipper) {
      this.gl.deleteTexture(this.flipper.scratch);
      this.gl.deleteFramebuffer(this.flipper.read);
      this.gl.deleteFramebuffer(this.flipper.draw);
      this.flipper = null;
    }
    this.disposed = true;
  }

  private blank(): WebGLTexture | null {
    if (this.placeholder) return this.placeholder;
    const gl = this.gl;
    this.placeholder = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.placeholder);
    const black = new Uint8Array([0, 0, 0, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
    return this.placeholder;
  }

  private upload(image: TexImageSource): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    this.uploadUpright(texture, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  /**
   * Uploads `source` into `texture` upright (row 0 at the bottom, as
   * `fragCoord` counts), leaving `texture` bound. Most sources are flipped by
   * `UNPACK_FLIP_Y_WEBGL`; WebGL ignores it for an `ImageBitmap`, so that is
   * uploaded as it is and copied upside down on the GPU.
   */
  private uploadUpright(texture: WebGLTexture | null, source: TexImageSource) {
    const gl = this.gl;
    if (!isBitmap(source)) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } finally {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
      return;
    }
    const { width, height } = source;
    const f = (this.flipper ??= { scratch: gl.createTexture(), read: gl.createFramebuffer(), draw: gl.createFramebuffer() });
    gl.bindTexture(gl.TEXTURE_2D, f.scratch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, f.read);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.scratch, 0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f.draw);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.blitFramebuffer(0, 0, width, height, 0, height, width, 0, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
}

/** Sets the bound `TEXTURE_2D`'s filter and wrap. */
export function applyTextureSettings(gl: WebGL2RenderingContext, settings: TextureSettings) {
  const min = { mipmap: gl.LINEAR_MIPMAP_LINEAR, linear: gl.LINEAR, nearest: gl.NEAREST }[
    settings.filter
  ];
  const wrap = { repeat: gl.REPEAT, clamp: gl.CLAMP_TO_EDGE, mirror: gl.MIRRORED_REPEAT }[
    settings.wrap
  ];
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    settings.filter === "nearest" ? gl.NEAREST : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
}
