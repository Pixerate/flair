import { imageUrls, parseControls, type ControlDef, type ControlValue } from "./controls.js";
import {
  compileShader,
  createContext,
  drawFrame,
  ShaderCompileError,
  type CompiledShader,
} from "./program.js";
import { SPECTRUM_BINS, type AudioFrame } from "./audio.js";
import { clicksUniform, trailUniform, type ShaderClick } from "./pointer.js";
import { TextureCache, type LiveSource } from "./textures.js";

/** A canvas `ShaderFrames` can draw on: a `<canvas>` on a page, or an `OffscreenCanvas` anywhere, a Web Worker included. */
export type FramesCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * RGBA pixels, 8 bits a channel, rows top down, not premultiplied, in sRGB:
 * an `ImageData` where the environment has one, else an object of the same
 * shape.
 */
export interface FramePixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: "srgb";
}

export interface ShaderFramesOptions<C extends FramesCanvas = HTMLCanvasElement> {
  source: string;
  values?: Record<string, ControlValue>;
  width: number;
  height: number;
  /**
   * Draw on this canvas instead of a new, detached one. It is resized to
   * `width` × `height`. Pass an `OffscreenCanvas` to render in a Web
   * Worker (or one transferred from the page with `transferControlToOffscreen`).
   * Without one, frames draw on a new `<canvas>` on a page, and on a new
   * `OffscreenCanvas` where there is no `document`.
   */
  canvas?: C;
  /** Keep the shader's alpha (`fragColor.a`) in the frames, for transparent recordings (default false: opaque). */
  alpha?: boolean;
}

export interface RenderOptions {
  /** `iFrame` (default: the number of frames rendered so far). */
  frame?: number;
  /** `iTimeDelta` in seconds (default: the time since the previous `render`, else 0). */
  delta?: number;
  /** `iMouse` (default: all zero, as on a page nobody has touched). */
  mouse?: [number, number, number, number];
  /** `iPointer`: x, y, how hovered (0–1), the press (seconds held, or minus seconds since release; default all zero). */
  pointer?: [number, number, number, number];
  /** Clicks so far, for `iClicks` (the latest `MAX_CLICKS` at or before the frame's time count). */
  clicks?: readonly ShaderClick[];
  /** Where the pointer has been, oldest first, for `iTrail` (the latest `MAX_TRAIL` at or before the frame's time count). */
  trail?: readonly ShaderClick[];
  /**
   * The sound, for `iAudio`, `iSpectrum` and `iBeat`: a frame from
   * `analyseAudioBuffer(buffer).at(t)` (frame-exact from an audio file), or
   * values of your own; what is left out is silence (`beat` -1). Without
   * it there is no audio at all (every audio uniform 0), and audio-reactive
   * effects play their idle demos.
   */
  audio?: Partial<AudioFrame>;
  /** `iScroll`: progress through the viewport, page scroll (0–1), velocity (viewport heights a second), scrolling (0–1). Default all zero: nothing scrolls it. */
  scroll?: readonly [number, number, number, number];
}

const SILENT = new Float32Array(SPECTRUM_BINS);

/**
 * Renders a shader at exact times you choose, off screen. There is no
 * animation loop and no clock: frame `n` of a recording at `fps` is
 * `render(start + n / fps)`, so the output is the same on any machine. It
 * suits recorders, video pipelines and anything else stepped by its own
 * clock. The constructor throws a {@link ShaderCompileError} when the source
 * does not compile.
 *
 * Image controls load in the background: `await frames.ready()` before the
 * first `render`, or the frames show black where the images go.
 *
 * A video in an image control (see `setLiveSource`) is drawn at whatever
 * frame it is on. To step it with the shader, seek it first: `await
 * seekVideo(video, t); frames.render(t)`. Pictures from elsewhere (an
 * `ImageBitmap`, a WebCodecs `VideoFrame`, an `ImageData`) are shown as they
 * are: pass the next one before each `render`.
 *
 * It runs in a Web Worker as it does on a page: give it an `OffscreenCanvas`,
 * feed image controls with those pictures, and take the frames out with
 * {@link ShaderFrames.readImageData} or {@link ShaderFrames.toImageBitmap}
 * (transferable back to the page). Image URLs load there too, except SVGs.
 */
export class ShaderFrames<C extends FramesCanvas = HTMLCanvasElement> {
  readonly canvas: C;
  readonly width: number;
  readonly height: number;
  readonly controls: ControlDef[];
  private gl: WebGL2RenderingContext | null;
  private shader: CompiledShader;
  private textures: TextureCache;
  private values: Record<string, ControlValue> | undefined;
  private rendered = 0;
  private lastTime: number | null = null;
  private pixels: Uint8Array;

  constructor(options: ShaderFramesOptions<C>) {
    const { source, values, width, height } = options;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.canvas = options.canvas ?? (newCanvas(this.width, this.height) as C);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.values = values;
    const gl = createContext(this.canvas, true, Boolean(options.alpha));
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.controls = parseControls(source);
    const compiled = compileShader(gl, source, this.controls);
    if (!compiled.ok) {
      this.dispose();
      throw new ShaderCompileError(compiled.errors);
    }
    this.shader = compiled.shader;
    this.textures = new TextureCache(gl);
    this.syncTextures();
    this.pixels = new Uint8Array(this.width * this.height * 4);
  }

  /** Changes control values for the frames that follow. */
  setValues(values: Record<string, ControlValue> | undefined) {
    this.values = values;
    this.syncTextures();
  }

  /**
   * Draws a `<video>`, a canvas or a still picture (an `ImageBitmap`,
   * `VideoFrame` or `ImageData`) in the image control `name` instead of its
   * URL, as it is when `render` runs; `null` goes back to the URL. A still
   * uploads once: pass the next picture (or the same one again, after
   * changing its pixels) before the frame that should show it. See
   * {@link LiveSource}.
   */
  setLiveSource(name: string, source: LiveSource | null) {
    this.textures.setLive(name, source);
  }

  /**
   * Settles once every image the controls show has loaded, and every live
   * video has a frame. Rejects with an {@link ImageLoadError} when one
   * cannot be.
   */
  async ready(): Promise<void> {
    await Promise.all([this.textures.ready(imageUrls(this.controls, this.values)), this.textures.liveReady()]);
  }

  /** Draws the frame at `time` seconds onto `canvas`. */
  render(time: number, options: RenderOptions = {}) {
    const gl = this.context();
    const delta = options.delta ?? (this.lastTime === null ? 0 : time - this.lastTime);
    drawFrame(
      gl,
      this.shader,
      this.controls,
      this.values,
      {
        width: this.width,
        height: this.height,
        time,
        delta,
        frame: options.frame ?? this.rendered,
        mouse: options.mouse ?? [0, 0, 0, 0],
        pointer: options.pointer,
        clicks: options.clicks && clicksUniform(options.clicks, time),
        trail: options.trail && trailUniform(options.trail, time),
        ...(options.audio
          ? { audio: options.audio.audio ?? [0, 0, 0, 0], spectrum: options.audio.spectrum ?? SILENT, beat: options.audio.beat ?? -1 }
          : {}),
        ...(options.scroll ? { scroll: options.scroll } : {}),
      },
      this.textures,
    );
    this.rendered += 1;
    this.lastTime = time;
  }

  /**
   * The last rendered frame as RGBA bytes, rows top down (as in `ImageData`;
   * WebGL itself reads bottom up). Pass `out` to reuse a buffer of
   * `width * height * 4` bytes.
   */
  readPixels(out?: Uint8Array | Uint8ClampedArray): Uint8Array | Uint8ClampedArray {
    const gl = this.context();
    const { width, height } = this;
    const target = out ?? new Uint8Array(width * height * 4);
    if (target.length !== width * height * 4) {
      throw new RangeError(`readPixels needs a buffer of ${width * height * 4} bytes.`);
    }
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    const row = width * 4;
    for (let y = 0; y < height; y++) {
      target.set(this.pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    return target;
  }

  /**
   * The last rendered frame as an `ImageData` (see {@link FramePixels}):
   * RGBA, rows top down, ready for `putImageData`, a `VideoFrame` or an
   * encoder.
   */
  readImageData(): FramePixels {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    this.readPixels(data);
    if (typeof ImageData !== "undefined") return new ImageData(data, this.width, this.height) as FramePixels;
    return { data, width: this.width, height: this.height, colorSpace: "srgb" };
  }

  /**
   * The last rendered frame as an `ImageBitmap`, which a Worker can transfer
   * to the page (`postMessage(bitmap, [bitmap])`) without copying, to draw
   * with `drawImage` or a `bitmaprenderer` context. Close it when done.
   */
  async toImageBitmap(): Promise<ImageBitmap> {
    this.context();
    return createImageBitmap(this.canvas);
  }

  /** Releases the GL context now rather than at garbage collection (browsers cap live contexts). */
  dispose() {
    if (!this.gl) return;
    if (this.shader) this.gl.deleteProgram(this.shader.program);
    this.textures?.dispose();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }

  private syncTextures() {
    const urls = imageUrls(this.controls, this.values);
    this.textures.retain(urls);
    for (const url of urls) this.textures.request(url);
  }

  private context(): WebGL2RenderingContext {
    if (!this.gl) throw new Error("These frames have been disposed.");
    if (this.gl.isContextLost()) throw new Error("The graphics context was lost.");
    return this.gl;
  }
}

/** A detached canvas: a `<canvas>` on a page, an `OffscreenCanvas` in a Worker. */
function newCanvas(width: number, height: number): FramesCanvas {
  if (typeof document !== "undefined") return document.createElement("canvas");
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  throw new Error("There is no canvas here: ShaderFrames needs a page or a Worker with OffscreenCanvas.");
}
