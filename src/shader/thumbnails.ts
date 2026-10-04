import { parseControls, type ControlDef, type ControlValue } from "./controls.js";
import {
  compileShader,
  createContext,
  drawFrame,
  resetGlCaches,
  type CompiledShader,
} from "./program.js";

/** Controls a registered thumbnail. */
export interface ThumbnailHandle {
  /** Shows another source or other values. A new source is recompiled; new values only redraw. */
  update(source: string, values?: Record<string, ControlValue>): void;
  /** With reduced motion, a hovered thumbnail animates and the others hold a still frame. */
  setHovered(hovered: boolean): void;
  /** Stops drawing into the canvas and frees its program. */
  dispose(): void;
}

export interface ThumbnailPoolOptions {
  /** Size of the shared render canvas (default 480 × 270). Thumbnails are drawn at most this large, then scaled. */
  renderWidth?: number;
  renderHeight?: number;
  /** Animation rate (default 30). */
  fps?: number;
  /** `iTime` of the still frame shown with reduced motion (default 2). */
  stillTime?: number;
  /** Hold still frames unless hovered (default: the `prefers-reduced-motion` media query). */
  reducedMotion?: boolean;
}

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  source: string;
  values?: Record<string, ControlValue>;
  controls: ControlDef[];
  shader: CompiledShader | null;
  failed: boolean;
  dirty: boolean;
  visible: boolean;
  hovered: boolean;
  onStatus?: (ok: boolean) => void;
}

/**
 * Animated thumbnails from a single WebGL context. Browsers cap live WebGL
 * contexts (about 16), so a gallery cannot give every card its own: the pool
 * renders each visible thumbnail in turn on one hidden canvas and copies the
 * frame into the thumbnail's own 2D canvas, cropped to its aspect ratio like
 * `object-fit: cover`. Thumbnails off screen (by `IntersectionObserver`) cost
 * nothing, and programs compile once per source.
 *
 * Nothing is created until the first `register`.
 */
export class ThumbnailPool {
  private readonly renderWidth: number;
  private readonly renderHeight: number;
  private readonly interval: number;
  private readonly fps: number;
  private readonly stillTime: number;
  private readonly reducedMotion: boolean;
  private readonly entries = new Set<Entry>();
  private readonly byCanvas = new WeakMap<Element, Entry>();
  private observer: IntersectionObserver | null | undefined;
  private glCanvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private raf = 0;
  private last = 0;
  private start: number | null = null;

  constructor(options: ThumbnailPoolOptions = {}) {
    this.renderWidth = options.renderWidth ?? 480;
    this.renderHeight = options.renderHeight ?? 270;
    this.fps = options.fps ?? 30;
    this.interval = 1000 / this.fps;
    this.stillTime = options.stillTime ?? 2;
    this.reducedMotion =
      options.reducedMotion ??
      (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /**
   * Starts drawing `source` into `canvas`, which should be sized with CSS; its
   * drawing buffer follows its CSS size and the device pixel ratio (up to 2).
   * `onStatus` hears whether the source compiled (and `false` without WebGL2).
   */
  register(
    canvas: HTMLCanvasElement,
    source: string,
    values?: Record<string, ControlValue>,
    onStatus?: (ok: boolean) => void,
  ): ThumbnailHandle {
    const observer = this.intersection();
    const entry: Entry = {
      canvas,
      ctx: canvas.getContext("2d")!,
      source,
      values,
      controls: [],
      shader: null,
      failed: false,
      dirty: true,
      visible: observer === null,
      hovered: false,
      onStatus,
    };
    this.entries.add(entry);
    this.byCanvas.set(canvas, entry);
    observer?.observe(canvas);
    if (!this.context()) onStatus?.(false);
    this.schedule();
    return {
      update: (nextSource, nextValues) => {
        if (nextSource !== entry.source) {
          this.release(entry);
          entry.source = nextSource;
          entry.failed = false;
        }
        entry.values = nextValues;
        entry.dirty = true;
        this.schedule();
      },
      setHovered: (hovered) => {
        entry.hovered = hovered;
        entry.dirty = true;
        this.schedule();
      },
      dispose: () => {
        observer?.unobserve(canvas);
        this.entries.delete(entry);
        this.byCanvas.delete(canvas);
        this.release(entry);
      },
    };
  }

  /** The number of registered thumbnails. */
  get size(): number {
    return this.entries.size;
  }

  private intersection(): IntersectionObserver | null {
    if (this.observer !== undefined) return this.observer;
    this.observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (records) => {
              for (const r of records) {
                const entry = this.byCanvas.get(r.target);
                if (!entry) continue;
                entry.visible = r.isIntersecting;
                if (entry.visible) entry.dirty = true;
              }
              this.schedule();
            },
            { rootMargin: "100px" },
          );
    return this.observer;
  }

  private context(): WebGL2RenderingContext | null {
    if (this.gl && !this.gl.isContextLost()) return this.gl;
    const canvas = document.createElement("canvas");
    canvas.width = this.renderWidth;
    canvas.height = this.renderHeight;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      for (const entry of this.entries) entry.shader = null;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      resetGlCaches();
      for (const entry of this.entries) entry.dirty = true;
      this.schedule();
    });
    resetGlCaches();
    this.glCanvas = canvas;
    this.gl = createContext(canvas);
    return this.gl;
  }

  private release(entry: Entry) {
    if (entry.shader) this.gl?.deleteProgram(entry.shader.program);
    entry.shader = null;
  }

  private compile(entry: Entry, gl: WebGL2RenderingContext) {
    entry.controls = parseControls(entry.source);
    const result = compileShader(gl, entry.source, entry.controls);
    entry.shader = result.ok ? result.shader : null;
    entry.failed = !result.ok;
    entry.onStatus?.(result.ok);
  }

  private renderEntry(entry: Entry, gl: WebGL2RenderingContext, time: number) {
    if (!entry.shader && !entry.failed) this.compile(entry, gl);
    if (!entry.shader) return;
    sizeCanvas(entry.canvas);
    // Fill the thumbnail the way `object-fit: cover` would, at its aspect ratio.
    const aspect = entry.canvas.width / entry.canvas.height;
    const w = Math.min(this.renderWidth, Math.round(this.renderHeight * aspect));
    const h = Math.min(this.renderHeight, Math.round(w / aspect));
    drawFrame(gl, entry.shader, entry.controls, entry.values, {
      width: w,
      height: h,
      time,
      delta: this.interval / 1000,
      frame: Math.floor(time * this.fps),
      mouse: [0, 0, 0, 0],
    });
    // The GL canvas's drawing buffer is valid until this task ends; copy it now.
    // WebGL draws from the bottom left, so the frame sits at the bottom of the canvas.
    entry.ctx.drawImage(
      this.glCanvas!,
      0,
      this.renderHeight - h,
      w,
      h,
      0,
      0,
      entry.canvas.width,
      entry.canvas.height,
    );
    entry.dirty = false;
  }

  private schedule() {
    if (!this.raf && this.entries.size) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const gl = this.context();
    if (!gl) return;
    this.start ??= now;
    const animate = now - this.last >= this.interval;
    const time = (now - this.start) / 1000;
    let keepGoing = false;
    for (const entry of this.entries) {
      if (!entry.visible) continue;
      const moving = !this.reducedMotion || entry.hovered;
      if (entry.dirty || (moving && animate)) {
        this.renderEntry(entry, gl, moving ? time : this.stillTime);
      }
      if (moving && entry.shader) keepGoing = true;
    }
    if (animate) this.last = now;
    if (keepGoing) this.schedule();
  };
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  // The layout size, not the bounding box: a rotated or scaled canvas keeps its own proportions.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

let shared: ThumbnailPool | null = null;

/** The pool `registerThumbnail` uses, created on first use. */
export function sharedThumbnailPool(): ThumbnailPool {
  shared ??= new ThumbnailPool();
  return shared;
}

/** Registers a thumbnail with the shared pool. See {@link ThumbnailPool.register}. */
export function registerThumbnail(
  canvas: HTMLCanvasElement,
  source: string,
  values?: Record<string, ControlValue>,
  onStatus?: (ok: boolean) => void,
): ThumbnailHandle {
  return sharedThumbnailPool().register(canvas, source, values, onStatus);
}
