import { imageUrls, parseControls, type ControlDef, type ControlValue } from "./controls.js";
import {
  compileShader,
  createContext,
  drawFrame,
  resetGlCaches,
  type CompileError,
  type CompiledShader,
} from "./program.js";
import { TextureCache, type ImageLoadError } from "./textures.js";

/** Whether the latest source compiled, and if not, why. */
export interface CompileStatus {
  ok: boolean;
  errors: CompileError[];
}

/** What `onStats` reports: on play, pause, seek and restart, and twice a second while running. */
export interface RendererStats {
  /** `iTime`, in seconds. */
  time: number;
  /** Frames drawn per second over the last half second (0 while paused). */
  fps: number;
  playing: boolean;
  /** The drawing buffer's size in device pixels. */
  width: number;
  height: number;
}

/**
 * Runs one shader on a canvas: the editor's live preview. A source that does
 * not compile leaves the last working program on screen, so a typo never
 * blanks the preview; the errors are reported instead.
 *
 * The renderer owns its canvas (added to `host`, removed on dispose): a
 * canvas keeps its WebGL context for life, so reusing one after disposing
 * (a remount, hot reload) would get the released, lost context back.
 */
export class ShaderRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null;
  private shader: CompiledShader | null = null;
  private textures: TextureCache | null = null;
  private controls: ControlDef[] = [];
  private values: Record<string, ControlValue> | undefined;
  private source = "";
  private raf = 0;
  private lastNow = 0;
  private frame = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  private resizeObserver: ResizeObserver;
  private mouse: [number, number, number, number] = [0, 0, 0, 0];
  private disposed = false;
  /** The latest source's status. */
  status: CompileStatus = { ok: true, errors: [] };
  /** `iTime`, in seconds. Use `seek` to change it. */
  time = 0;
  /** Playback speed: 1 is real time. */
  speed = 1;
  /** Device pixels per CSS pixel; lower renders faster. Use `setPixelRatio` to change it. */
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  playing = true;
  fps = 0;
  onStats?: (stats: RendererStats) => void;
  /** Called with `true` when the GL context is lost and `false` once it is restored and recompiled. */
  onContextLost?: (lost: boolean) => void;
  /** Called when an image control's URL cannot be loaded; the control shows black. */
  onImageError?: (error: ImageLoadError) => void;

  /** Creates a canvas in `host` (with `className`) and starts the animation loop. Size the canvas with CSS. */
  constructor(host: HTMLElement, className = "") {
    const canvas = document.createElement("canvas");
    canvas.className = className;
    host.appendChild(canvas);
    this.canvas = canvas;
    this.gl = createContext(canvas, true);
    this.textures = this.gl && this.textureCache(this.gl);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** False when the browser has no WebGL2. */
  get supported(): boolean {
    return this.gl !== null;
  }

  /** Compiles a new source; returns its status. Keeps the previous program when it fails. */
  setSource(source: string): CompileStatus {
    this.source = source;
    const controls = parseControls(source);
    if (!this.gl) {
      this.status = {
        ok: false,
        errors: [{ line: 0, message: "WebGL2 is not available in this browser." }],
      };
      return this.status;
    }
    const result = compileShader(this.gl, source, controls);
    if (result.ok) {
      if (this.shader) this.gl.deleteProgram(this.shader.program);
      this.shader = result.shader;
      this.controls = controls;
      this.status = { ok: true, errors: [] };
    } else {
      this.status = { ok: false, errors: result.errors };
    }
    this.syncTextures();
    if (!this.playing) this.render();
    return this.status;
  }

  /**
   * Sets control values (see `controlValue`); a paused preview redraws.
   * Images load in the background and show once they arrive: await
   * `ready()` before a `capture` that needs them.
   */
  setValues(values: Record<string, ControlValue> | undefined) {
    this.values = values;
    this.syncTextures();
    if (!this.playing) this.render();
  }

  /**
   * Settles once the images the current controls show have loaded. Rejects
   * with an {@link ImageLoadError} when one cannot be (it shows black).
   */
  async ready(): Promise<void> {
    await this.textures?.ready(imageUrls(this.controls, this.values));
  }

  play() {
    this.playing = true;
    this.emit();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  /** Back to `iTime` 0 and frame 0. */
  restart() {
    this.time = 0;
    this.frame = 0;
    this.render();
    this.emit();
  }

  /** Jumps to `time` seconds (not below 0) and draws it. */
  seek(time: number) {
    this.time = Math.max(0, time);
    this.render();
    this.emit();
  }

  setPixelRatio(ratio: number) {
    this.pixelRatio = ratio;
    this.resize();
  }

  /**
   * Captures the current frame (optionally at another time) as a data URL
   * (JPEG unless `type` says PNG), at most `maxEdge` pixels on the long side
   * (default 1024). Playback time is left as it was. Null when nothing has
   * compiled yet.
   */
  capture(
    options: { time?: number; maxEdge?: number; type?: "image/jpeg" | "image/png" } = {},
  ): string | null {
    if (!this.gl || !this.shader) return null;
    const saved = this.time;
    if (options.time !== undefined) this.time = Math.max(0, options.time);
    this.render();
    const { width, height } = this.canvas;
    const scale = Math.min(1, (options.maxEdge ?? 1024) / Math.max(width, height));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(width * scale));
    out.height = Math.max(1, Math.round(height * scale));
    out.getContext("2d")!.drawImage(this.canvas, 0, 0, out.width, out.height);
    this.time = saved;
    if (options.time !== undefined) this.render();
    return out.toDataURL(options.type ?? "image/jpeg", 0.85);
  }

  /** Stops the loop, releases the context and removes the canvas. The renderer cannot be used again. */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    if (this.gl && this.shader) this.gl.deleteProgram(this.shader.program);
    this.textures?.dispose();
    this.textures = null;
    // Free the context now rather than waiting for GC (browsers cap live contexts).
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.canvas.remove();
  }

  private resize() {
    // The layout size, not the bounding box: a rotated or scaled canvas keeps its own proportions.
    const w = Math.max(1, Math.round(this.canvas.clientWidth * this.pixelRatio));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * this.pixelRatio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.render();
    }
  }

  private render(delta = 0) {
    if (!this.gl || !this.shader || this.gl.isContextLost()) return;
    drawFrame(
      this.gl,
      this.shader,
      this.controls,
      this.values,
      {
        width: this.canvas.width,
        height: this.canvas.height,
        time: this.time,
        delta,
        frame: this.frame,
        mouse: this.mouse,
      },
      this.textures ?? undefined,
    );
  }

  private textureCache(gl: WebGL2RenderingContext): TextureCache {
    return new TextureCache(gl, (_url, error) => {
      if (error) this.onImageError?.(error);
      else if (!this.playing) this.render();
    });
  }

  /** Starts loading the images now shown, and frees the ones no longer shown. */
  private syncTextures() {
    if (!this.textures) return;
    const urls = imageUrls(this.controls, this.values);
    this.textures.retain(urls);
    for (const url of urls) this.textures.request(url);
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const delta = this.lastNow ? Math.min((now - this.lastNow) / 1000, 0.1) : 0;
    this.lastNow = now;
    if (this.playing) {
      this.time += delta * this.speed;
      this.frame += 1;
      this.render(delta * this.speed);
      this.fpsFrames += 1;
    }
    if (now - this.fpsSince >= 500) {
      this.fps = this.playing
        ? Math.round((this.fpsFrames * 1000) / (now - this.fpsSince || 1))
        : 0;
      this.fpsFrames = 0;
      this.fpsSince = now;
      this.emit();
    }
  };

  private emit() {
    this.onStats?.({
      time: this.time,
      fps: this.fps,
      playing: this.playing,
      width: this.canvas.width,
      height: this.canvas.height,
    });
  }

  /** Pointer position in shader pixels (origin bottom-left, like gl_FragCoord). */
  private toPixels(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (this.canvas.width / rect.width),
      (rect.bottom - e.clientY) * (this.canvas.height / rect.height),
    ];
  }

  private onPointerDown = (e: PointerEvent) => {
    const [x, y] = this.toPixels(e);
    this.mouse = [x, y, x, y];
    if (!this.playing) this.render();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.mouse[2] <= 0 || e.buttons === 0) return;
    const [x, y] = this.toPixels(e);
    this.mouse = [x, y, this.mouse[2], this.mouse[3]];
    if (!this.playing) this.render();
  };

  private onPointerUp = () => {
    if (this.mouse[2] > 0)
      this.mouse = [this.mouse[0], this.mouse[1], -this.mouse[2], -Math.abs(this.mouse[3])];
  };

  private onLost = (e: Event) => {
    e.preventDefault();
    this.shader = null;
    this.textures?.dispose();
    this.textures = null;
    this.onContextLost?.(true);
  };

  private onRestored = () => {
    resetGlCaches();
    this.gl = createContext(this.canvas, true);
    this.textures = this.gl && this.textureCache(this.gl);
    this.setSource(this.source);
    this.onContextLost?.(false);
  };
}
