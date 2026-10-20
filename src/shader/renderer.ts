import { imageUrls, parseControls, type ControlDef, type ControlValue } from "./controls.js";
import {
  compileShader,
  createContext,
  drawFrame,
  resetGlCaches,
  type CompileError,
  type CompiledShader,
} from "./program.js";
import { LiveAudio, type AudioFrame, type AudioSource } from "./audio.js";
import { PointerTracker } from "./pointer.js";
import { ScrollTracker, viewportProgress } from "./scroll.js";
import { TextureCache, type ImageLoadError, type LiveSource } from "./textures.js";

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

export interface ShaderRendererOptions {
  className?: string;
  /** Enable a transparent WebGL drawing buffer so shader alpha (`fragColor.a`) composites over the page (default false). */
  alpha?: boolean;
  /** Pause rendering when scrolled out of view via IntersectionObserver (default false). */
  pauseWhenHidden?: boolean;
  /** Start playing at once (default true). Set to false to start paused. */
  autoplay?: boolean;
  /** Wait to start playing until the canvas enters the viewport via IntersectionObserver (default false). When true, autoplay is deferred until first visible. */
  playOnEnter?: boolean;
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
  private readonly alpha: boolean;
  private shader: CompiledShader | null = null;
  private textures: TextureCache | null = null;
  /** Live sources by image control, kept to set again on a restored context. */
  private live = new Map<string, LiveSource>();
  private controls: ControlDef[] = [];
  private values: Record<string, ControlValue> | undefined;
  private source = "";
  private raf = 0;
  private lastNow = 0;
  private frame = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  private ownsCanvas = false;
  private resizeObserver: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private wasPlayingBeforeHidden = false;
  private hasEnteredViewport = false;
  private mouse: [number, number, number, number] = [0, 0, 0, 0];
  /** `iPointer` and `iClicks`. */
  private pointer = new PointerTracker();
  /** `iAudio`, `iSpectrum` and `iBeat`, from `setAudioSource`. */
  private audio: LiveAudio | null = null;
  private audioFrame: AudioFrame | undefined;
  /** `iScroll`. */
  private scrollTracker = new ScrollTracker();
  private scrollOverride: number | null = null;
  private scrollMoved = true;
  /** The page clock's latest reading, in seconds, for `iScroll`'s easing. */
  private scrollNow = 0;
  /** `iScroll` as last drawn, so a paused preview redraws only when it changes. */
  private drawnScroll: readonly number[] = [0, 0, 0, 0];
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
  /** Called when an image control's URL (or live video) cannot be loaded; the control shows black. */
  onImageError?: (error: ImageLoadError) => void;

  /**
   * Creates a canvas in `target` (with `className` or options), or attaches to an existing
   * `HTMLCanvasElement`, and starts the animation loop. Size the canvas with CSS.
   */
  constructor(target: HTMLElement | HTMLCanvasElement, options?: string | ShaderRendererOptions) {
    const opts: ShaderRendererOptions =
      typeof options === "string" ? { className: options } : (options ?? {});
    let canvas: HTMLCanvasElement;
    if (target instanceof HTMLCanvasElement || ("tagName" in target && target.tagName === "CANVAS")) {
      canvas = target as HTMLCanvasElement;
      if (opts.className) canvas.className = opts.className;
    } else {
      canvas = document.createElement("canvas");
      if (opts.className) canvas.className = opts.className;
      target.appendChild(canvas);
      this.ownsCanvas = true;
    }
    this.canvas = canvas;
    this.alpha = Boolean(opts.alpha);
    this.gl = createContext(canvas, true, this.alpha);
    this.textures = this.gl && this.textureCache(this.gl);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    const needsObserver =
      (opts.pauseWhenHidden || opts.playOnEnter) && typeof IntersectionObserver !== "undefined";

    if (needsObserver) {
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (opts.playOnEnter && !this.hasEnteredViewport) {
            this.hasEnteredViewport = true;
            if (opts.autoplay ?? true) {
              this.play();
            }
          } else if (this.wasPlayingBeforeHidden) {
            this.wasPlayingBeforeHidden = false;
            this.play();
          }
        } else {
          if (this.playing && opts.pauseWhenHidden) {
            this.wasPlayingBeforeHidden = true;
            this.pause();
          }
        }
      });
      this.intersectionObserver.observe(canvas);
    }

    const shouldAutoplay = (opts.autoplay ?? true) && !opts.playOnEnter;
    this.playing = shouldAutoplay;

    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerenter", this.onPointerEnter);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointerup", this.onPointerUp);
    // Any scroll that may move the canvas: the page's or a scrolling element's.
    window.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
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
      // Where the page is now, so the first frame shows it.
      if (result.shader.builtins.iScroll) this.sampleScroll(performance.now() / 1000);
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
   * Shows a `<video>`, a canvas or a still (an `ImageBitmap`, `VideoFrame`
   * or `ImageData`; see {@link LiveSource}) in the image control `name` (the
   * uniform's name, such as `uImage`) in place of its URL, frame by frame;
   * `null` goes back to the URL. The preview follows the video even while
   * the shader's own clock is paused, and the video plays, seeks and loops
   * on its own: the renderer never controls it. A video from another site
   * needs `crossOrigin = "anonymous"` and CORS, or `onImageError` hears why
   * it shows black. The value stays as it is, so documents, presets and
   * agents keep seeing the URL.
   */
  setLiveSource(name: string, source: LiveSource | null) {
    if (source) this.live.set(name, source);
    else this.live.delete(name);
    this.textures?.setLive(name, source);
    if (!this.playing) this.render();
  }

  /**
   * Feeds `iAudio`, `iSpectrum` and `iBeat` from a sound (`null` stops):
   * - an `<audio>` or `<video>` element: it keeps playing to the speakers,
   *   now through Web Audio (an element can only be wired in once, so the
   *   same node is reused by every renderer that listens to it);
   * - a `MediaStream`, such as a microphone from `getUserMedia`: listened
   *   to, not played;
   * - any Web Audio node (an oscillator, a gain, a player's output), in its
   *   own context.
   *
   * The `AudioContext` and `AnalyserNode` are made on first use (see
   * `sharedAudioContext`). Browsers keep a new context suspended until the
   * page has a click or key press (autoplay policy): call this from one, or
   * the context resumes on the first. While a source is set, a paused
   * preview still follows the sound. A media element from another site needs
   * `crossOrigin = "anonymous"` and CORS, or the browser feeds silence.
   */
  setAudioSource(source: AudioSource | null) {
    this.audio?.dispose();
    this.audio = source ? new LiveAudio(source) : null;
    this.audioFrame = undefined;
    if (!this.playing) this.render();
  }

  /**
   * Pins `iScroll` to a scroll position of your own (0–1, for x and y; the
   * velocity and "scrolling" follow its changes), for scrubbers and hosts
   * that scroll in their own way; `null` goes back to following the page.
   */
  setScrollProgress(progress: number | null) {
    this.scrollOverride = progress === null ? null : Math.min(1, Math.max(0, progress));
    this.scrollMoved = true;
    if (!this.playing) {
      this.sampleScroll(performance.now() / 1000);
      this.render();
    }
  }

  /**
   * Settles once the images the current controls show have loaded, and
   * every live video has a frame. Rejects with an {@link ImageLoadError}
   * when one cannot be (it shows black).
   */
  async ready(): Promise<void> {
    await Promise.all([
      this.textures?.ready(imageUrls(this.controls, this.values)),
      this.textures?.liveReady(),
    ]);
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
    this.pointer.clear();
    this.frame = 0;
    this.render();
    this.emit();
  }

  /** Jumps to `time` seconds (not below 0) and draws it. */
  seek(time: number) {
    // Clicks are stamped with iTime: going back would replay them.
    if (time < this.time) this.pointer.clear();
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
    this.intersectionObserver?.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerenter", this.onPointerEnter);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("scroll", this.onScroll, { capture: true });
    this.audio?.dispose();
    this.audio = null;
    if (this.gl && this.shader) this.gl.deleteProgram(this.shader.program);
    this.textures?.dispose();
    this.textures = null;
    // Free the context now rather than waiting for GC (browsers cap live contexts).
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    if (this.ownsCanvas) this.canvas.remove();
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
        pointer: this.pointer.pointer(this.time),
        clicks: this.pointer.clicksAt(this.time),
        trail: this.pointer.trailAt(this.time),
        ...(this.audioFrame ?? {}),
        scroll: (this.drawnScroll = this.scrollTracker.scroll(this.scrollNow)),
      },
      this.textures ?? undefined,
    );
  }

  private textureCache(gl: WebGL2RenderingContext): TextureCache {
    const cache = new TextureCache(gl, (_url, error) => {
      if (error) this.onImageError?.(error);
      else if (!this.playing) this.render();
    });
    for (const [name, source] of this.live) cache.setLive(name, source);
    return cache;
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
    const seconds = now / 1000;
    // The sound and the scroll run on the page's clock, whether or not the shader's is paused.
    let follow = false;
    const b = this.shader?.builtins;
    if (this.audio && b && (b.iAudio || b.iSpectrum || b.iBeat)) {
      this.audioFrame = this.audio.read(seconds);
      follow = true;
    }
    this.scrollNow = seconds;
    if (b?.iScroll) {
      if (this.scrollMoved || this.scrollOverride === null || !this.scrollTracker.settled(seconds)) this.sampleScroll(seconds);
      const scroll = this.scrollTracker.scroll(seconds);
      if (scroll.some((v, i) => v !== this.drawnScroll[i])) follow = true;
    }
    if (this.playing) {
      this.time += delta * this.speed;
      this.frame += 1;
      this.render(delta * this.speed);
      this.fpsFrames += 1;
    } else if (this.textures?.liveChanged() || follow) {
      // A live video moved on (played, seeked or loaded), the sound changed or the page scrolled while the clock is paused.
      this.render();
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

  /** Where the canvas is in the viewport (or the pinned progress), into the scroll tracker. */
  private sampleScroll(seconds: number) {
    this.scrollMoved = false;
    this.scrollNow = seconds;
    if (this.scrollOverride !== null) {
      const p = this.scrollOverride;
      // As if the canvas were a viewport tall: progress 0 to 1 is two viewport heights of scrolling.
      this.scrollTracker.sample(p, p, p * 2, seconds);
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    const page = document.scrollingElement ?? document.documentElement;
    const range = page.scrollHeight - page.clientHeight;
    this.scrollTracker.sample(viewportProgress(rect.top, rect.height, viewport), range > 0 ? page.scrollTop / range : 0, -rect.top / viewport, seconds);
  }

  private onScroll = () => {
    this.scrollMoved = true;
  };

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
    this.pointer.down(x, y, this.time);
    if (!this.playing) this.render();
  };

  private onPointerMove = (e: PointerEvent) => {
    const [x, y] = this.toPixels(e);
    this.pointer.move(x, y, this.time);
    if (this.mouse[2] <= 0 || e.buttons === 0) {
      if (!this.playing) this.render();
      return;
    }
    this.mouse = [x, y, this.mouse[2], this.mouse[3]];
    if (!this.playing) this.render();
  };

  private onPointerEnter = (e: PointerEvent) => {
    this.pointer.move(...this.toPixels(e), this.time);
    this.pointer.hover(true, this.time);
  };

  private onPointerLeave = () => {
    this.pointer.hover(false, this.time);
  };

  private onPointerUp = () => {
    this.pointer.up(this.time);
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
    this.gl = createContext(this.canvas, true, this.alpha);
    this.textures = this.gl && this.textureCache(this.gl);
    this.setSource(this.source);
    this.onContextLost?.(false);
  };
}
