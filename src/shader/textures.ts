import type { TextureSettings } from "./controls.js";

/** Why an image control's URL could not be shown. */
export class ImageLoadError extends Error {
  readonly url: string;

  constructor(url: string, cause?: unknown) {
    super(
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
const preloaded = new Map<string, Promise<HTMLImageElement>>();
const decoded = new Map<string, HTMLImageElement>();

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
      load = loadImage(url).then(
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
  private readonly onLoad: (url: string, error: ImageLoadError | null) => void;
  private readonly load: (url: string) => Promise<TexImageSource>;
  private placeholder: WebGLTexture | null = null;
  private disposed = false;

  constructor(
    gl: WebGL2RenderingContext,
    onLoad: (url: string, error: ImageLoadError | null) => void = () => {},
    load: (url: string) => Promise<TexImageSource> = loadImage,
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
    if (this.placeholder) this.gl.deleteTexture(this.placeholder);
    this.placeholder = null;
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
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
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
