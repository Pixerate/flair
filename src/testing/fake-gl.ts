/**
 * A fake WebGL2 context, for testing code that renders with Flair where
 * there is no GPU (jsdom, Node, CI). It runs no shaders: it records every
 * call, "compiles" by looking for a marker in the source, keeps the state a
 * context has (bindings, viewport, tests, blending), and fills `readPixels`
 * from a function of the pixel position and the last `iTime` set, so the
 * same calls always give the same pixels. See `installFakeWebGl` in
 * `@pixerate/flair/testing`.
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
  readonly ACTIVE_TEXTURE = 0x84e0;
  readonly TEXTURE_BINDING_2D = 0x8069;
  readonly DRAW_FRAMEBUFFER_BINDING = 0x8ca6;
  readonly READ_FRAMEBUFFER_BINDING = 0x8caa;
  readonly VIEWPORT = 0x0ba2;
  readonly CURRENT_PROGRAM = 0x8b8d;
  readonly VERTEX_ARRAY_BINDING = 0x85b5;
  readonly BLEND_SRC_RGB = 0x80c9;
  readonly BLEND_DST_RGB = 0x80c8;
  readonly BLEND_SRC_ALPHA = 0x80cb;
  readonly BLEND_DST_ALPHA = 0x80ca;
  readonly SCISSOR_TEST = 0x0c11;
  readonly DEPTH_TEST = 0x0b71;
  readonly STENCIL_TEST = 0x0b90;
  readonly CULL_FACE = 0x0b44;
  readonly COLOR_WRITEMASK = 0x0c23;
  readonly COLOR_CLEAR_VALUE = 0x0c22;
  readonly UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
  readonly RGBA8 = 0x8058;
  readonly RGBA16F = 0x881a;
  readonly RGBA32F = 0x8814;
  readonly HALF_FLOAT = 0x140b;
  readonly FLOAT = 0x1406;

  /** The canvas it belongs to, when `installFakeWebGl` made it (`gl.canvas`). */
  canvas?: unknown;
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
    this.viewportBox = new Int32Array(args);
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
  readonly draws: { program: FakeProgram | null; textures: Record<number, FakeTexture | null>; target: FakeTexture | null; blend: boolean; caps: number[]; vertexArray: unknown }[] = [];
  private unit = 0;
  private units: Record<number, FakeTexture | null> = {};
  private program: FakeProgram | null = null;
  private blending = false;
  activeTexture(unit: number) {
    this.record("activeTexture", [unit]);
    this.unit = unit - this.TEXTURE0;
  }

  // State a host's context has, for checking that a pipeline puts it back.
  private enabledCaps = new Set<number>();
  private viewportBox = new Int32Array([0, 0, 300, 150]);
  private vertexArray: unknown = null;
  private blendFunc = [1, 0, 1, 0];
  private writeMask = [true, true, true, true];
  private clearValue = new Float32Array([0, 0, 0, 0]);
  private premultiply = false;
  private texParams = new Map<FakeTexture, Map<number, number>>();
  getParameter(pname: number): unknown {
    switch (pname) {
      case this.ACTIVE_TEXTURE: return this.TEXTURE0 + this.unit;
      case this.TEXTURE_BINDING_2D: return this.units[this.unit] ?? null;
      case this.DRAW_FRAMEBUFFER_BINDING: return this.framebuffers.get(this.DRAW_FRAMEBUFFER) ?? null;
      case this.READ_FRAMEBUFFER_BINDING: return this.framebuffers.get(this.READ_FRAMEBUFFER) ?? null;
      case this.VIEWPORT: return new Int32Array(this.viewportBox);
      case this.CURRENT_PROGRAM: return this.program;
      case this.VERTEX_ARRAY_BINDING: return this.vertexArray;
      case this.BLEND_SRC_RGB: return this.blendFunc[0];
      case this.BLEND_DST_RGB: return this.blendFunc[1];
      case this.BLEND_SRC_ALPHA: return this.blendFunc[2];
      case this.BLEND_DST_ALPHA: return this.blendFunc[3];
      case this.COLOR_WRITEMASK: return [...this.writeMask];
      case this.COLOR_CLEAR_VALUE: return new Float32Array(this.clearValue);
      case this.UNPACK_FLIP_Y_WEBGL: return this.flipY;
      case this.UNPACK_PREMULTIPLY_ALPHA_WEBGL: return this.premultiply;
      default: return null;
    }
  }
  isEnabled(cap: number) {
    return cap === this.BLEND ? this.blending : this.enabledCaps.has(cap);
  }
  bindVertexArray(vao: unknown) {
    this.record("bindVertexArray", [vao]);
    this.vertexArray = vao;
  }
  colorMask(...mask: boolean[]) {
    this.writeMask = mask;
  }
  isTexture(texture: unknown) {
    return this.textures.includes(texture as FakeTexture) && !(texture as FakeTexture).deleted;
  }
  getTexParameter(_target: number, pname: number) {
    return (this.bound && this.texParams.get(this.bound)?.get(pname)) ?? 0x2702;
  }
  /** A snapshot of the state a pipeline in a host's context must put back. */
  hostState() {
    return {
      draw: this.framebuffers.get(this.DRAW_FRAMEBUFFER) ?? null,
      read: this.framebuffers.get(this.READ_FRAMEBUFFER) ?? null,
      viewport: [...this.viewportBox],
      program: this.program,
      unit: this.unit,
      units: Object.fromEntries(Object.entries(this.units).filter(([u, t]) => Number(u) < 16 && t != null)),
      vertexArray: this.vertexArray,
      enabled: [...this.enabledCaps].sort(),
      blending: this.blending,
      blendFunc: [...this.blendFunc],
      writeMask: [...this.writeMask],
      clear: [...this.clearValue],
      flipY: this.flipY,
      premultiply: this.premultiply,
    };
  }
  bindTexture(target: number, texture: FakeTexture | null) {
    this.record("bindTexture", [target, texture]);
    this.bound = texture;
    this.units[this.unit] = texture;
  }
  enable(cap: number) {
    this.record("enable", [cap]);
    if (cap === this.BLEND) this.blending = true;
    else this.enabledCaps.add(cap);
  }
  disable(cap: number) {
    this.record("disable", [cap]);
    if (cap === this.BLEND) this.blending = false;
    else this.enabledCaps.delete(cap);
  }
  blendFuncSeparate(...args: number[]) {
    this.record("blendFuncSeparate", args);
    this.blendFunc = args;
  }
  clearColor(...args: number[]) {
    this.record("clearColor", args);
    this.clearValue = new Float32Array(args);
  }
  clear(mask: number) {
    this.record("clear", [mask, this.framebuffers.get(this.DRAW_FRAMEBUFFER)?.texture ?? null]);
  }
  pixelStorei(pname: number, value: unknown) {
    this.record("pixelStorei", [pname, value]);
    if (pname === this.UNPACK_FLIP_Y_WEBGL) this.flipY = Boolean(value);
    if (pname === this.UNPACK_PREMULTIPLY_ALPHA_WEBGL) this.premultiply = Boolean(value);
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
    if (this.bound) {
      const params = this.texParams.get(this.bound) ?? new Map<number, number>();
      params.set(pname, value);
      this.texParams.set(this.bound, params);
    }
  }

  drawArrays(mode: number, first: number, count: number) {
    this.record("drawArrays", [mode, first, count]);
    this.draws.push({ program: this.program, textures: { ...this.units }, target: this.framebuffers.get(this.DRAW_FRAMEBUFFER)?.texture ?? null, blend: this.blending, caps: [...this.enabledCaps], vertexArray: this.vertexArray });
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

/** The fake as the WebGL2 context the code under test takes. */
export const asGl = (gl: FakeGl) => gl as unknown as WebGL2RenderingContext;
