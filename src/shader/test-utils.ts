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

export interface FakeTexture {
  id: number;
  /** What was uploaded: an image, or "1x1" for raw bytes. */
  image: unknown;
  flipped: boolean;
  mipmapped: boolean;
  deleted: boolean;
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
  /** Extensions the "GPU" has besides `WEBGL_lose_context` (default `EXT_color_buffer_float` and `OES_texture_float_linear`). */
  extensions?: string[];
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
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE0 = 0x84c0;
  readonly TEXTURE_MIN_FILTER = 0x2801;
  readonly TEXTURE_MAG_FILTER = 0x2800;
  readonly TEXTURE_WRAP_S = 0x2802;
  readonly TEXTURE_WRAP_T = 0x2803;
  readonly NEAREST = 0x2600;
  readonly LINEAR = 0x2601;
  readonly LINEAR_MIPMAP_LINEAR = 0x2703;
  readonly REPEAT = 0x2901;
  readonly CLAMP_TO_EDGE = 0x812f;
  readonly MIRRORED_REPEAT = 0x8370;
  readonly UNPACK_FLIP_Y_WEBGL = 0x9240;
  readonly READ_FRAMEBUFFER = 0x8ca8;
  readonly DRAW_FRAMEBUFFER = 0x8ca9;
  readonly COLOR_ATTACHMENT0 = 0x8ce0;
  readonly COLOR_BUFFER_BIT = 0x4000;
  readonly FRAMEBUFFER = 0x8d40;
  readonly BLEND = 0x0be2;
  readonly SRC_ALPHA = 0x0302;
  readonly ONE_MINUS_SRC_ALPHA = 0x0303;
  readonly ONE = 1;
  readonly RGBA8 = 0x8058;
  readonly RGBA16F = 0x881a;
  readonly RGBA32F = 0x8814;
  readonly HALF_FLOAT = 0x140b;
  readonly FLOAT = 0x1406;

  readonly calls: Call[] = [];
  readonly shaders: FakeShader[] = [];
  readonly programs: FakeProgram[] = [];
  readonly textures: FakeTexture[] = [];
  readonly attributes: unknown;
  lost = false;
  /** Make `createShader` return null, as a lost context can. */
  refuseShaders = false;
  time = 0;
  private bound: FakeTexture | null = null;
  private flipY = false;
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
    if ((this.options.extensions ?? ["EXT_color_buffer_float", "OES_texture_float_linear"]).includes(name)) return {};
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
    this.program = program;
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
  uniform2f(loc: FakeLocation, ...v: number[]) {
    this.record("uniform2f", [loc, ...v]);
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

  createTexture(): FakeTexture {
    const texture = {
      id: this.textures.length,
      image: null,
      flipped: false,
      mipmapped: false,
      deleted: false,
    };
    this.textures.push(texture);
    this.record("createTexture", [texture]);
    return texture;
  }
  deleteTexture(texture: FakeTexture) {
    this.record("deleteTexture", [texture]);
    texture.deleted = true;
  }
  /** Every draw: the program, the texture on each unit, the texture drawn into (null for the canvas), and whether blending was on. */
  readonly draws: { program: FakeProgram | null; textures: Record<number, FakeTexture | null>; target: FakeTexture | null; blend: boolean }[] = [];
  private unit = 0;
  private units: Record<number, FakeTexture | null> = {};
  private program: FakeProgram | null = null;
  private blending = false;
  activeTexture(unit: number) {
    this.record("activeTexture", [unit]);
    this.unit = unit - this.TEXTURE0;
  }
  bindTexture(target: number, texture: FakeTexture | null) {
    this.record("bindTexture", [target, texture]);
    this.bound = texture;
    this.units[this.unit] = texture;
  }
  enable(cap: number) {
    this.record("enable", [cap]);
    if (cap === this.BLEND) this.blending = true;
  }
  disable(cap: number) {
    this.record("disable", [cap]);
    if (cap === this.BLEND) this.blending = false;
  }
  blendFuncSeparate(...args: number[]) {
    this.record("blendFuncSeparate", args);
  }
  clearColor(...args: number[]) {
    this.record("clearColor", args);
  }
  clear(mask: number) {
    this.record("clear", [mask, this.framebuffers.get(this.DRAW_FRAMEBUFFER)?.texture ?? null]);
  }
  pixelStorei(pname: number, value: unknown) {
    this.record("pixelStorei", [pname, value]);
    if (pname === this.UNPACK_FLIP_Y_WEBGL) this.flipY = Boolean(value);
  }
  texImage2D(...args: unknown[]) {
    this.record("texImage2D", args);
    if (!this.bound) return;
    this.bound.image = args.length === 6 ? args[5] : "1x1";
    this.bound.flipped = this.flipY;
  }
  generateMipmap(target: number) {
    this.record("generateMipmap", [target]);
    if (this.bound) this.bound.mipmapped = true;
  }
  private framebuffers = new Map<number, { texture: FakeTexture | null } | null>();
  createFramebuffer() {
    const fb = { texture: null as FakeTexture | null };
    this.record("createFramebuffer", [fb]);
    return fb;
  }
  deleteFramebuffer(fb: unknown) {
    this.record("deleteFramebuffer", [fb]);
  }
  bindFramebuffer(target: number, fb: { texture: FakeTexture | null } | null) {
    this.record("bindFramebuffer", [target, fb]);
    if (target === this.FRAMEBUFFER) {
      this.framebuffers.set(this.READ_FRAMEBUFFER, fb);
      this.framebuffers.set(this.DRAW_FRAMEBUFFER, fb);
    } else this.framebuffers.set(target, fb);
  }
  framebufferTexture2D(target: number, _attachment: number, _textarget: number, texture: FakeTexture | null) {
    this.record("framebufferTexture2D", [target, texture]);
    const fb = this.framebuffers.get(target === this.FRAMEBUFFER ? this.DRAW_FRAMEBUFFER : target);
    if (fb) fb.texture = texture;
  }
  /** Copies the read framebuffer's texture into the draw one's, flipping it when the destination rows run downwards. */
  blitFramebuffer(...args: number[]) {
    this.record("blitFramebuffer", args);
    const from = this.framebuffers.get(this.READ_FRAMEBUFFER)?.texture;
    const to = this.framebuffers.get(this.DRAW_FRAMEBUFFER)?.texture;
    if (!from || !to) return;
    to.image = from.image;
    to.flipped = from.flipped !== args[5]! > args[7]!;
  }
  texParameteri(target: number, pname: number, value: number) {
    this.record("texParameteri", [target, pname, value]);
  }

  drawArrays(mode: number, first: number, count: number) {
    this.record("drawArrays", [mode, first, count]);
    this.draws.push({ program: this.program, textures: { ...this.units }, target: this.framebuffers.get(this.DRAW_FRAMEBUFFER)?.texture ?? null, blend: this.blending });
  }

  readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    _format: number,
    type: number,
    out: Uint8Array | Float32Array,
  ) {
    this.record("readPixels", [x, y, width, height, type]);
    const pixel = this.options.pixel ?? ((_x, py) => [py, 0, 0, 255]);
    // Floats read as the byte colour over 255.
    const scale = out instanceof Float32Array ? 1 / 255 : 1;
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        out.set(pixel(px, py, this.time).map((v) => v * scale), (py * width + px) * 4);
      }
    }
  }
}

/** Casts a fake to the real type for the APIs under test. */
export const asGl = (gl: FakeGl) => gl as unknown as WebGL2RenderingContext;

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
