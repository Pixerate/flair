import { parseControls, type ControlDef, type ControlValue } from "./controls.js";
import {
  compileShader,
  createContext,
  drawFrame,
  ShaderCompileError,
  type CompiledShader,
} from "./program.js";

export interface ShaderFramesOptions {
  source: string;
  values?: Record<string, ControlValue>;
  width: number;
  height: number;
  /** Draw on this canvas instead of a new, detached one. It is resized to `width` × `height`. */
  canvas?: HTMLCanvasElement;
}

export interface RenderOptions {
  /** `iFrame` (default: the number of frames rendered so far). */
  frame?: number;
  /** `iTimeDelta` in seconds (default: the time since the previous `render`, else 0). */
  delta?: number;
  /** `iMouse` (default: all zero, as on a page nobody has touched). */
  mouse?: [number, number, number, number];
}

/**
 * Renders a shader at exact times you choose, off screen. There is no
 * animation loop and no clock: frame `n` of a recording at `fps` is
 * `render(start + n / fps)`, so the output is the same on any machine. It
 * suits recorders, video pipelines and anything else stepped by its own
 * clock. The constructor throws a {@link ShaderCompileError} when the source
 * does not compile.
 */
export class ShaderFrames {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly controls: ControlDef[];
  private gl: WebGL2RenderingContext | null;
  private shader: CompiledShader;
  private values: Record<string, ControlValue> | undefined;
  private rendered = 0;
  private lastTime: number | null = null;
  private pixels: Uint8Array;

  constructor(options: ShaderFramesOptions) {
    const { source, values, width, height } = options;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.canvas = options.canvas ?? document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.values = values;
    const gl = createContext(this.canvas, true);
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.controls = parseControls(source);
    const compiled = compileShader(gl, source, this.controls);
    if (!compiled.ok) {
      this.dispose();
      throw new ShaderCompileError(compiled.errors);
    }
    this.shader = compiled.shader;
    this.pixels = new Uint8Array(this.width * this.height * 4);
  }

  /** Changes control values for the frames that follow. */
  setValues(values: Record<string, ControlValue> | undefined) {
    this.values = values;
  }

  /** Draws the frame at `time` seconds onto `canvas`. */
  render(time: number, options: RenderOptions = {}) {
    const gl = this.context();
    const delta = options.delta ?? (this.lastTime === null ? 0 : time - this.lastTime);
    drawFrame(gl, this.shader, this.controls, this.values, {
      width: this.width,
      height: this.height,
      time,
      delta,
      frame: options.frame ?? this.rendered,
      mouse: options.mouse ?? [0, 0, 0, 0],
    });
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

  /** Releases the GL context now rather than at garbage collection (browsers cap live contexts). */
  dispose() {
    if (!this.gl) return;
    if (this.shader) this.gl.deleteProgram(this.shader.program);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }

  private context(): WebGL2RenderingContext {
    if (!this.gl) throw new Error("These frames have been disposed.");
    if (this.gl.isContextLost()) throw new Error("The graphics context was lost.");
    return this.gl;
  }
}
