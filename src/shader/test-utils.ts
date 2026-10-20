/**
 * Test helpers for Flair's own tests (Vitest): the fake WebGL2 context (see
 * `src/testing/fake-gl.ts`, published as `@pixerate/flair/testing`), and
 * fakes for images, animation frames, video and layout.
 */

import { FakeGl, type FakeGlOptions } from "../testing/fake-gl.js";

export * from "../testing/fake-gl.js";


export interface Fake2d {
  canvas: HTMLCanvasElement;
  drawImage: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
}

export interface FakeWebGl {
  /** Every WebGL2 context created, in order. */
  contexts: FakeGl[];
  /** Every 2D context created, in order. */
  contexts2d: Fake2d[];
  last(): FakeGl;
}

/**
 * Makes `canvas.getContext` return fakes: one `FakeGl` per canvas for
 * "webgl2" (null when `webgl: false`), and a 2D context that records
 * `drawImage`. Restored after each test by `restoreMocks`.
 */
export function installFakeWebGl(options: FakeGlOptions & { webgl?: boolean } = {}): FakeWebGl {
  const contexts: FakeGl[] = [];
  const contexts2d: Fake2d[] = [];
  const byCanvas = new WeakMap<HTMLCanvasElement, FakeGl | Fake2d>();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
    kind: string,
    attributes?: unknown,
  ) {
    const existing = byCanvas.get(this);
    if (existing) return existing as never;
    if (kind === "webgl2") {
      if (options.webgl === false) return null;
      const gl = new FakeGl(options, attributes);
      contexts.push(gl);
      byCanvas.set(this, gl);
      return gl as never;
    }
    if (kind === "2d") {
      const ctx = { canvas: this, drawImage: vi.fn(), clearRect: vi.fn() };
      contexts2d.push(ctx);
      byCanvas.set(this, ctx);
      return ctx as never;
    }
    return null;
  } as never);
  return {
    contexts,
    contexts2d,
    last() {
      const gl = contexts[contexts.length - 1];
      if (!gl) throw new Error("No WebGL2 context was created.");
      return gl;
    },
  };
}

/**
 * Replaces `Image` with a fake whose `decode()` resolves on the next
 * microtask, or rejects when the URL contains "broken". `images` lists every
 * one created. Restored after each test by `unstubGlobals`.
 */
export function installFakeImages() {
  const images: FakeImage[] = [];
  class FakeImage {
    src = "";
    crossOrigin: string | null = null;
    constructor() {
      images.push(this);
    }
    decode() {
      return this.src.includes("broken")
        ? Promise.reject(new Error("EncodingError"))
        : Promise.resolve();
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return images;
}

/** Lets pending promise callbacks run (image loads in the fakes). */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A `mainImage` source, optionally with extra lines before it. */
export function shaderSource(...lines: string[]): string {
  return [
    ...lines,
    "void mainImage(out vec4 fragColor, in vec2 fragCoord) {",
    "  fragColor = vec4(1.0);",
    "}",
  ].join("\n");
}

/**
 * A manual `requestAnimationFrame`: callbacks queue until `frame(now)` runs
 * them. Stubbed globals are restored after each test by `unstubGlobals`.
 */
export function installManualRaf() {
  let next = 1;
  let queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = next++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
  return {
    get pending() {
      return queue.size;
    },
    /** Runs the callbacks queued so far with `now` (ms); ones they queue wait for the next call. */
    frame(now: number) {
      const run = queue;
      queue = new Map();
      for (const cb of run.values()) cb(now);
    },
  };
}

/**
 * A stand-in for a `<video>`: set `readyState` and `currentTime` to move it
 * on, and `emit` its events. Seeking moves at once and fires `seeked` on the
 * next microtask, as a browser would a little later.
 */
export class FakeVideo extends EventTarget {
  readyState = 0;
  duration = 10;
  seeking = false;
  src = "";
  currentSrc = "https://example.com/clip.mp4";
  error: unknown = null;
  private time = 0;

  get currentTime() {
    return this.time;
  }
  set currentTime(t: number) {
    this.time = t;
    this.seeking = true;
    queueMicrotask(() => {
      this.seeking = false;
      this.readyState = Math.max(this.readyState, 2);
      this.emit("seeked");
    });
  }
  /** Moves to `t` without seeking, as playback does. */
  playTo(t: number) {
    this.time = t;
  }
  emit(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

/** Gives an element a layout box, which jsdom does not compute. */
export function setRect(el: Element, width: number, height: number, left = 0, top = 0) {
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON() {},
    }) as DOMRect;
}
