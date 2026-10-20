/**
 * `@pixerate/flair/testing`: testing code that renders with Flair where
 * there is no GPU (jsdom, Node, CI), with any test runner.
 *
 * `installFakeWebGl()` makes canvases (and `OffscreenCanvas`) hand out a
 * fake WebGL2 context, so `ShaderFrames`, `ShaderPipeline`, `ShaderRenderer`
 * and `flairEffects()` construct, compile and render as they would on a
 * page. No shader runs: pixels come from `pixel(x, y, time)`, so the same
 * calls always give the same frame, and each fake records the calls made on
 * it for assertions. For real pixels that match across machines, render
 * with `exportEffect`'s `software` option (`@pixerate/flair/node`) instead.
 *
 * @packageDocumentation
 */

import { FakeGl, type FakeGlOptions } from "./fake-gl.js";

export { asGl, FakeGl, type Call, type FakeGlOptions, type FakeLocation, type FakeProgram, type FakeShader, type FakeTexture } from "./fake-gl.js";

/** A 2D context that does nothing, for canvases Flair draws captures or thumbnails on. */
export interface Fake2dContext {
  canvas: unknown;
  /** Calls made on it, by name. */
  calls: { name: string; args: unknown[] }[];
}

export interface InstalledFakeWebGl {
  /** Every fake WebGL2 context handed out, in order. */
  readonly contexts: readonly FakeGl[];
  /** The latest; throws when none has been handed out yet. */
  last(): FakeGl;
  /** Puts `getContext` (and `OffscreenCanvas`) back as they were. */
  restore(): void;
}

export interface InstallFakeWebGlOptions extends FakeGlOptions {
  /** Hand out no WebGL2 context (`getContext("webgl2")` gives null), to test what happens without one. */
  webgl?: false;
}

function fake2d(canvas: unknown): Fake2dContext {
  const calls: Fake2dContext["calls"] = [];
  return new Proxy({ canvas, calls } as Fake2dContext, {
    get(target, name) {
      if (name in target) return target[name as keyof Fake2dContext];
      return (...args: unknown[]) => void calls.push({ name: String(name), args });
    },
  });
}

/**
 * Makes `HTMLCanvasElement` and `OffscreenCanvas` hand out fakes: a
 * `FakeGl` per canvas for `"webgl2"`, and a 2D context that records its
 * calls and draws nothing. Where there is no `OffscreenCanvas` (jsdom), a
 * fake one is installed too. Call `restore()` when done (in `afterEach`).
 *
 *     const webgl = installFakeWebGl({ pixel: (x, y, t) => [x * 10, y * 10, t * 100, 255] });
 *     const frames = new ShaderFrames({ source, width: 4, height: 4 });
 *     frames.render(1);
 *     expect(frames.readImageData().data[0]).toBe(0);
 *     expect(webgl.last().uniform("iTime")).toEqual([1]);
 *     webgl.restore();
 */
export function installFakeWebGl(options: InstallFakeWebGlOptions = {}): InstalledFakeWebGl {
  const contexts: FakeGl[] = [];
  const byCanvas = new WeakMap<object, unknown>();
  const undo: (() => void)[] = [];
  function getContext(this: object, kind: string, attributes?: unknown) {
    const existing = byCanvas.get(this);
    if (existing) return existing;
    let made: unknown = null;
    if (kind === "webgl2" && options.webgl !== false) {
      const gl = new FakeGl(options, attributes);
      Object.assign(gl, { canvas: this });
      contexts.push(gl);
      made = gl;
    } else if (kind === "2d") made = fake2d(this);
    if (made) byCanvas.set(this, made);
    return made;
  }
  const global = globalThis as Record<string, unknown>;
  const patch = (proto: { getContext?: unknown } | undefined) => {
    if (!proto) return;
    const before = Object.getOwnPropertyDescriptor(proto, "getContext");
    Object.defineProperty(proto, "getContext", { value: getContext, configurable: true, writable: true });
    undo.push(() => (before ? Object.defineProperty(proto, "getContext", before) : delete proto.getContext));
  };
  patch((global.HTMLCanvasElement as { prototype?: { getContext?: unknown } } | undefined)?.prototype);
  if (typeof global.OffscreenCanvas === "function") patch((global.OffscreenCanvas as { prototype: { getContext?: unknown } }).prototype);
  else {
    class FakeOffscreenCanvas {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext = getContext;
    }
    global.OffscreenCanvas = FakeOffscreenCanvas;
    undo.push(() => delete global.OffscreenCanvas);
  }
  return {
    contexts,
    last() {
      const gl = contexts[contexts.length - 1];
      if (!gl) throw new Error("No WebGL2 context has been made yet.");
      return gl;
    },
    restore() {
      while (undo.length) undo.pop()!();
    },
  };
}
