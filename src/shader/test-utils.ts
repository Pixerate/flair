/**
 * A fake WebGL2 context for tests: jsdom has no WebGL. It records every call,
 * "compiles" by looking for a marker in the source, and fills `readPixels`
 * from a function of the pixel position and the last `iTime` set.
 */

export interface FakeShader {
  type: number;
  source: string;
  compiled: boolean;
  deleted: boolean;
}

export interface FakeProgram {
  shaders: FakeShader[];
  linked: boolean;
  deleted: boolean;
}

export interface FakeLocation {
  name: string;
}

export interface Call {
  name: string;
  args: unknown[];
}

export interface FakeGlOptions {
  /** A fragment source containing this string fails to compile with `compileLog`. */
  failMarker?: string;
  compileLog?: string;
  /** A fragment source containing this string compiles but fails to link with `linkLog`. */
  linkFailMarker?: string;
  linkLog?: string;
  /** Uniforms the "driver" optimised away: their location is null. */
  missingUniforms?: string[];
  /** Pixel colour for `readPixels`; y counts from the bottom, as in WebGL. */
  pixel?: (x: number, y: number, time: number) => [number, number, number, number];
}

export class FakeGl {
  readonly VERTEX_SHADER = 0x8b31;
  readonly FRAGMENT_SHADER = 0x8b30;
  readonly COMPILE_STATUS = 0x8b81;
  readonly LINK_STATUS = 0x8b82;
  readonly TRIANGLES = 0x0004;
  readonly RGBA = 0x1908;
  readonly UNSIGNED_BYTE = 0x1401;

  readonly calls: Call[] = [];
  readonly shaders: FakeShader[] = [];
  readonly programs: FakeProgram[] = [];
  readonly attributes: unknown;
  lost = false;
  /** Make `createShader` return null, as a lost context can. */
  refuseShaders = false;
  time = 0;
  private readonly options: FakeGlOptions;

  constructor(options: FakeGlOptions = {}, attributes?: unknown) {
    this.options = { failMarker: "COMPILE_ERROR", linkFailMarker: "LINK_ERROR", ...options };
    this.attributes = attributes;
  }

  /** Calls by name, in order. */
  named(name: string): Call[] {
    return this.calls.filter((c) => c.name === name);
  }

  /** The value last set on a uniform, by name. */
  uniform(name: string): unknown[] | undefined {
    const call = [...this.calls]
      .reverse()
      .find(
        (c) => c.name.startsWith("uniform") && (c.args[0] as FakeLocation | null)?.name === name,
      );
    return call?.args.slice(1);
  }

  private record(name: string, args: unknown[]) {
    this.calls.push({ name, args });
  }

  isContextLost() {
    return this.lost;
  }

  getExtension(name: string) {
    if (name !== "WEBGL_lose_context") return null;
    return {
      loseContext: () => {
        this.record("loseContext", []);
        this.lost = true;
      },
    };
  }

  createShader(type: number): FakeShader | null {
    this.record("createShader", [type]);
    if (this.refuseShaders) return null;
    const shader = { type, source: "", compiled: false, deleted: false };
    this.shaders.push(shader);
    return shader;
  }

  shaderSource(shader: FakeShader, source: string) {
    this.record("shaderSource", [shader, source]);
    shader.source = source;
  }

  compileShader(shader: FakeShader) {
    this.record("compileShader", [shader]);
    shader.compiled = !(
      shader.type === this.FRAGMENT_SHADER && shader.source.includes(this.options.failMarker!)
    );
  }

  getShaderParameter(shader: FakeShader, pname: number) {
    return pname === this.COMPILE_STATUS ? shader.compiled : null;
  }

  getShaderInfoLog(_shader: FakeShader) {
    return this.options.compileLog ?? "ERROR: 0:2: 'oops' : syntax error\n";
  }

  deleteShader(shader: FakeShader) {
    this.record("deleteShader", [shader]);
    shader.deleted = true;
  }

  createProgram(): FakeProgram {
    this.record("createProgram", []);
    const program = { shaders: [], linked: false, deleted: false };
    this.programs.push(program);
    return program;
  }

  attachShader(program: FakeProgram, shader: FakeShader) {
    this.record("attachShader", [program, shader]);
    program.shaders.push(shader);
  }

  linkProgram(program: FakeProgram) {
    this.record("linkProgram", [program]);
    program.linked = !program.shaders.some((s) => s.source.includes(this.options.linkFailMarker!));
  }

  getProgramParameter(program: FakeProgram, pname: number) {
    return pname === this.LINK_STATUS ? program.linked : null;
  }

  getProgramInfoLog(_program: FakeProgram) {
    return this.options.linkLog ?? "ERROR: Missing mainImage";
  }

  deleteProgram(program: FakeProgram) {
    this.record("deleteProgram", [program]);
    program.deleted = true;
  }

  getUniformLocation(_program: FakeProgram, name: string): FakeLocation | null {
    return this.options.missingUniforms?.includes(name) ? null : { name };
  }

  useProgram(program: FakeProgram) {
    this.record("useProgram", [program]);
  }

  viewport(...args: number[]) {
    this.record("viewport", args);
  }

  uniform1f(loc: FakeLocation, x: number) {
    this.record("uniform1f", [loc, x]);
    if (loc.name === "iTime") this.time = x;
  }
  uniform1i(loc: FakeLocation, x: number) {
    this.record("uniform1i", [loc, x]);
  }
  uniform3f(loc: FakeLocation, ...v: number[]) {
    this.record("uniform3f", [loc, ...v]);
  }
  uniform4f(loc: FakeLocation, ...v: number[]) {
    this.record("uniform4f", [loc, ...v]);
  }
  uniform2fv(loc: FakeLocation, v: number[]) {
    this.record("uniform2fv", [loc, v]);
  }
  uniform3fv(loc: FakeLocation, v: number[]) {
    this.record("uniform3fv", [loc, v]);
  }
  uniform4fv(loc: FakeLocation, v: number[]) {
    this.record("uniform4fv", [loc, v]);
  }

  drawArrays(mode: number, first: number, count: number) {
    this.record("drawArrays", [mode, first, count]);
  }

  readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    _format: number,
    _type: number,
    out: Uint8Array,
  ) {
    this.record("readPixels", [x, y, width, height]);
    const pixel = this.options.pixel ?? ((_x, py) => [py, 0, 0, 255]);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        out.set(pixel(px, py, this.time), (py * width + px) * 4);
      }
    }
  }
}

/** Casts a fake to the real type for the APIs under test. */
export const asGl = (gl: FakeGl) => gl as unknown as WebGL2RenderingContext;

export interface Fake2d {
  canvas: HTMLCanvasElement;
  drawImage: ReturnType<typeof vi.fn>;
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
      const ctx = { canvas: this, drawImage: vi.fn() };
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
