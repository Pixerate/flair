import { imageUrls, parseControls, type ControlDef, type ControlValue } from "./controls.js";
import type { FramePixels, FramesCanvas, RenderOptions } from "./frames.js";
import { compileShader, createContext, drawFrame, linkUtilityProgram, ShaderCompileError, type CompiledShader, type CompileError } from "./program.js";
import { SPECTRUM_BINS } from "./audio.js";
import { clicksUniform, trailUniform } from "./pointer.js";
import { TextureCache, type LiveSource, type TextureSource } from "./textures.js";
import { srgbToLinear } from "./color.js";

/**
 * A float picture: RGBA, rows top down, in **linear light** (sRGB
 * primaries), straight (not premultiplied) alpha, where colour may go below
 * 0 or above 1 (as `EffectPixels.float` in `@pixerate/editor/effects`).
 */
export interface FloatPicture {
  width: number;
  height: number;
  data: Float32Array;
}

/**
 * Where an image control of a pass gets its picture from:
 *
 * - `"previous"`: the pass before this one, this frame (the next effect in a stack).
 * - `"feedback"`: this pass's own output from the frame before, for trails,
 *   echoes and other effects that build on themselves (transparent black on
 *   the first frame, and after `resetFeedback`).
 * - `{ pass: n }`: pass `n`'s output: this frame's for a pass before this
 *   one, the frame before's for this pass or a later one.
 * - A picture: a `<video>`, a canvas, an `ImageBitmap`, a `VideoFrame` or an
 *   `ImageData` (see `LiveSource`).
 *
 * Image controls not given an input show their URL, as in `ShaderFrames`.
 */
export type PassInput = "previous" | "feedback" | { pass: number } | LiveSource | FloatPicture;

/**
 * What a pipeline's passes draw into, and so its precision: `rgba8` (8 bits
 * a channel, the default), `rgba16f` (half floats: HDR, 16-bit layers) or
 * `rgba32f` (full floats). The float formats need the GPU to render to
 * float textures (`EXT_color_buffer_float`, on nearly every WebGL2 device);
 * `rgba32f` also needs `OES_texture_float_linear` to be sampled smoothly.
 */
export type PipelineFormat = "rgba8" | "rgba16f" | "rgba32f";

/** One pass of a {@link ShaderPipeline}: a `mainImage` shader, its values, and what its image controls show. */
export interface PipelinePass {
  source: string;
  values?: Record<string, ControlValue>;
  /** Image controls (sampler uniforms) fed from other passes or pictures, by name. */
  inputs?: Readonly<Record<string, PassInput>>;
  /**
   * `"replace"` (default): the pass's output is what it draws. `"over"`: it
   * is drawn over the previous pass's output by its alpha, for overlays in a
   * stack (an overlay's `fragColor.a` is coverage).
   */
  blend?: "replace" | "over";
  /** A name for messages ("pass 2 (vignette)"). */
  name?: string;
}

/**
 * Where a pipeline's effect applies. Coverage comes from a `picture`
 * (its alpha, or its luminance with `channel: "luminance"`; stretched to the
 * output), a `region` (a rectangle in output pixels from the top left, with
 * a soft edge `feather` pixels wide), or both multiplied together; `invert`
 * turns it round. Where coverage is 0 `under` shows (a picture, or a pass's
 * output: usually the picture the effect changes); without `under`,
 * coverage multiplies the output's alpha instead, as for a generator laid
 * over something else. 0 is untouched and 1 the full effect, as
 * `EffectRenderRequest.mask` in `@pixerate/editor/effects`.
 */
export interface PipelineMask {
  picture?: LiveSource | FloatPicture;
  channel?: "alpha" | "luminance";
  region?: readonly [number, number, number, number];
  feather?: number;
  invert?: boolean;
  under?: LiveSource | FloatPicture | { pass: number };
}

export interface ShaderPipelineOptions<C extends FramesCanvas = HTMLCanvasElement> {
  passes: readonly PipelinePass[];
  width: number;
  height: number;
  /** Draw on this canvas instead of a new one (an `OffscreenCanvas` in a Worker); resized to `width` × `height`. */
  canvas?: C;
  /** Keep the last pass's alpha in the output (default false: opaque). */
  alpha?: boolean;
  /**
   * What passes draw into (default `rgba8`). Shaders see colour the same
   * way in every format (sRGB-encoded, as they are written), so an effect
   * looks the same; float formats keep precision between passes and values
   * above 1, and `readFloatPixels` gives them out in linear light.
   */
  format?: PipelineFormat;
  /** Where the effect applies (see {@link ShaderPipeline.setMask}). */
  mask?: PipelineMask;
}

/** Thrown when a pass of a pipeline does not compile: `pass` says which (0-based). */
export class PassCompileError extends ShaderCompileError {
  readonly pass: number;

  constructor(pass: number, label: string, errors: CompileError[]) {
    super(errors);
    this.name = "PassCompileError";
    this.pass = pass;
    this.message = `${label}: ${this.message}`;
  }
}

/** A texture to draw into, and the framebuffer that draws into it (with its size, when not the pipeline's). */
interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width?: number;
  height?: number;
}

/** Each format's internal format and texel type. */
const FORMATS: Record<PipelineFormat, (gl: WebGL2RenderingContext) => [number, number]> = {
  rgba8: (gl) => [gl.RGBA8, gl.UNSIGNED_BYTE],
  rgba16f: (gl) => [gl.RGBA16F, gl.HALF_FLOAT],
  rgba32f: (gl) => [gl.RGBA32F, gl.FLOAT],
};

interface PassState {
  label: string;
  spec: PipelinePass;
  controls: ControlDef[];
  shader: CompiledShader;
  values: Record<string, ControlValue> | undefined;
  inputs: Map<string, PassInput>;
  /** This frame's output. */
  current: Target;
  /** The frame before's output, for passes something reads as feedback. */
  previous: Target | null;
}

const SILENT = new Float32Array(SPECTRUM_BINS);

/** Copies a texture as it is (rows as they are), for drawing a pass's output on the canvas or under an overlay. */
const COPY_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D flair_source;
out vec4 flair_out;
void main() {
  flair_out = texelFetch(flair_source, ivec2(gl_FragCoord.xy), 0);
}
`;

/** A pass's name for messages: "pass 2 (vignette)". */
const passLabel = (i: number, spec: PipelinePass) => `pass ${i}${spec.name ? ` (${spec.name})` : ""}`;

/**
 * The extended sRGB curves, sign-preserving so colour outside 0–1 survives:
 * a float picture's linear light becomes the sRGB-encoded colour shaders
 * expect (rows flipped to GL's, bottom up), and the output goes back.
 */
const CURVES = `
vec3 flair_toSrgb(vec3 c) {
  vec3 a = abs(c);
  return sign(c) * mix(1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, a * 12.92, step(a, vec3(0.0031308)));
}
vec3 flair_toLinear(vec3 c) {
  vec3 a = abs(c);
  return sign(c) * mix(pow((a + 0.055) / 1.055, vec3(2.4)), a / 12.92, step(a, vec3(0.04045)));
}
`;

const ENCODE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D flair_source;
out vec4 flair_out;
${CURVES}
void main() {
  ivec2 size = textureSize(flair_source, 0);
  ivec2 at = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(flair_source, ivec2(at.x, size.y - 1 - at.y), 0);
  flair_out = vec4(flair_toSrgb(c.rgb), c.a);
}
`;

const DECODE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D flair_source;
out vec4 flair_out;
${CURVES}
void main() {
  vec4 c = texelFetch(flair_source, ivec2(gl_FragCoord.xy), 0);
  flair_out = vec4(flair_toLinear(c.rgb), c.a);
}
`;

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D flair_source;
uniform sampler2D flair_mask;
uniform sampler2D flair_under;
uniform int flair_hasMask;
uniform int flair_hasUnder;
uniform int flair_luminance;
uniform int flair_invert;
uniform int flair_hasRegion;
uniform vec4 flair_region;
uniform float flair_feather;
uniform vec2 flair_size;
out vec4 flair_out;
void main() {
  vec4 effect = texelFetch(flair_source, ivec2(gl_FragCoord.xy), 0);
  vec2 uv = gl_FragCoord.xy / flair_size;
  float k = 1.0;
  if (flair_hasMask == 1) {
    vec4 m = texture(flair_mask, uv);
    k *= flair_luminance == 1 ? dot(m.rgb, vec3(0.2126, 0.7152, 0.0722)) * m.a : m.a;
  }
  if (flair_hasRegion == 1) {
    vec2 lo = flair_region.xy;
    vec2 hi = flair_region.xy + flair_region.zw;
    float f = max(flair_feather, 0.001) * 0.5;
    vec2 inside = smoothstep(lo - f, lo + f, gl_FragCoord.xy) * (1.0 - smoothstep(hi - f, hi + f, gl_FragCoord.xy));
    k *= inside.x * inside.y;
  }
  k = clamp(flair_invert == 1 ? 1.0 - k : k, 0.0, 1.0);
  flair_out = flair_hasUnder == 1 ? mix(texture(flair_under, uv), effect, k) : vec4(effect.rgb, effect.a * k);
}
`;

const isFloatPicture = (input: unknown): input is FloatPicture =>
  typeof input === "object" && input !== null && (input as FloatPicture).data instanceof Float32Array && typeof (input as FloatPicture).width === "number";

const isPassRef = (input: PassInput): input is { pass: number } => typeof input === "object" && input !== null && "pass" in input && typeof (input as { pass: unknown }).pass === "number";

/**
 * Renders several shaders as one picture, each pass reading the ones before
 * (an effect stack) or its own last frame (feedback, for trails and echoes),
 * at exact times like `ShaderFrames`: frame `n` at `fps` is
 * `render(start + n / fps)`. Every pass draws into a texture of its own on
 * one WebGL2 context; the last pass is the output, drawn on `canvas` and
 * read with `readPixels`, `readImageData` or `toImageBitmap`.
 *
 * Feedback makes a frame depend on the frames drawn before it: render them
 * in order from the start (or from a `resetFeedback`) to get the same frames
 * every time. Without feedback each frame stands on its own.
 *
 * The constructor throws a {@link PassCompileError} naming the pass that
 * does not compile, and an `Error` for an input that cannot be (a name that
 * is not an image control, a pass that does not exist, `"previous"` on the
 * first pass).
 */
export class ShaderPipeline<C extends FramesCanvas = HTMLCanvasElement> {
  readonly canvas: C;
  readonly width: number;
  readonly height: number;
  private gl: WebGL2RenderingContext | null;
  private readonly passes: PassState[] = [];
  private readonly textures: TextureCache;
  private copy: WebGLProgram;
  private encode: WebGLProgram | null = null;
  private decode: WebGLProgram | null = null;
  private decoded: Target | null = null;
  /** Float pictures converted to what shaders expect, by `pass:control` (or `mask`, `under`). */
  private readonly converted = new Map<string, Target>();
  private mask: PipelineMask | null = null;
  private compositor: WebGLProgram | null = null;
  private composed: Target | null = null;
  /** What the last frame's output is in: the last pass's target, or the masked composite. */
  private result: Target | null = null;
  private readonly format: PipelineFormat;
  private rendered = 0;
  private lastTime: number | null = null;
  private pixels: Uint8Array;

  constructor(options: ShaderPipelineOptions<C>) {
    const { passes, width, height } = options;
    if (!passes?.length) throw new Error("A pipeline needs at least one pass.");
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.canvas = options.canvas ?? (newCanvas(this.width, this.height) as C);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const gl = createContext(this.canvas, true, Boolean(options.alpha));
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.textures = new TextureCache(gl);
    this.pixels = new Uint8Array(this.width * this.height * 4);
    this.format = options.format ?? "rgba8";
    try {
      if (!(this.format in FORMATS)) throw new Error(`The format "${String(this.format)}" is not one of ${Object.keys(FORMATS).join(", ")}.`);
      if (this.format !== "rgba8" && !gl.getExtension("EXT_color_buffer_float")) {
        throw new Error(`This GPU cannot render to float textures (EXT_color_buffer_float), so the format "${this.format}" is not available here; use "rgba8".`);
      }
      if (this.format === "rgba32f" && !gl.getExtension("OES_texture_float_linear")) {
        throw new Error('This GPU cannot sample 32-bit float textures smoothly (OES_texture_float_linear); use "rgba16f", which keeps HDR at half precision.');
      }
      this.copy = linkUtilityProgram(gl, COPY_SOURCE);
      passes.forEach((spec, i) => {
        const label = passLabel(i, spec);
        const controls = parseControls(spec.source);
        const compiled = compileShader(gl, spec.source, controls);
        if (!compiled.ok) throw new PassCompileError(i, label, compiled.errors);
        this.passes.push({ label, spec, controls, shader: compiled.shader, values: spec.values, inputs: new Map(), current: this.target(), previous: null });
      });
      passes.forEach((spec, i) => {
        for (const [name, input] of Object.entries(spec.inputs ?? {})) this.setInput(i, name, input);
      });
    } catch (e) {
      this.dispose();
      throw e;
    }
    this.syncTextures();
    if (options.mask) this.setMask(options.mask);
  }

  /** Each pass's controls, in pass order. */
  get controls(): ControlDef[][] {
    return this.passes.map((p) => p.controls);
  }

  /** Changes a pass's control values for the frames that follow. */
  setValues(pass: number, values: Record<string, ControlValue> | undefined) {
    this.pass(pass).values = values;
    this.syncTextures();
  }

  /**
   * Feeds a pass's image control `name` from another pass, its own last
   * frame, or a picture (see {@link PassInput}); `null` goes back to the
   * control's URL. Throws for a name that is not an image control of the
   * pass, or a pass that does not exist.
   */
  setInput(pass: number, name: string, input: PassInput | null) {
    const state = this.pass(pass);
    const control = state.controls.find((c) => c.name === name);
    if (!control || control.type !== "sampler2D") {
      const images = state.controls.filter((c) => c.type === "sampler2D").map((c) => c.name);
      throw new Error(`${state.label} has no image control "${name}"; ${images.length ? `its image controls are ${images.join(", ")}` : "it has none"}.`);
    }
    const key = `${pass}:${name}`;
    state.inputs.delete(name);
    this.textures.setLive(key, null);
    if (!isFloatPicture(input)) this.forget(key);
    if (input === null) return void this.syncTextures();
    if (input === "previous") {
      if (pass === 0) throw new Error(`${state.label} is the first pass: it has no previous pass to read. Give "${name}" a picture instead.`);
    } else if (input === "feedback") {
      this.history(pass);
    } else if (isPassRef(input)) {
      if (!Number.isInteger(input.pass) || input.pass < 0 || input.pass >= this.passes.length) {
        throw new Error(`${state.label} reads pass ${input.pass}, and there are ${this.passes.length} passes (0 to ${this.passes.length - 1}).`);
      }
      if (input.pass >= pass) this.history(input.pass);
    } else if (isFloatPicture(input)) {
      this.convert(key, `${state.label}: a float picture for "${name}"`, input);
    } else {
      this.textures.setLive(key, input);
    }
    state.inputs.set(name, input);
    this.syncTextures();
  }

  /**
   * Limits where the pipeline's effect applies (see {@link PipelineMask}):
   * by a coverage picture, a rectangle, or both. Where coverage is 0 the
   * picture `under` shows (or, without one, the output is transparent);
   * where it is 1, the effect. `null` removes it. Pictures are read when
   * set: set the mask again for the next frame's.
   */
  setMask(mask: PipelineMask | null) {
    for (const key of ["mask", "under"]) {
      this.textures.setLive(key, null);
      this.forget(key);
    }
    this.mask = null;
    if (!mask) return;
    if (mask.picture === undefined && mask.region === undefined) throw new Error("A mask needs a picture (its coverage), a region, or both.");
    if (mask.region !== undefined) {
      const r = mask.region;
      if (!Array.isArray(r) || r.length !== 4 || !r.every((v) => typeof v === "number" && Number.isFinite(v)) || !(r[2]! > 0 && r[3]! > 0)) {
        throw new Error(`A mask's region is [x, y, width, height] in output pixels from the top left, with a width and height above 0; got ${JSON.stringify(r)}.`);
      }
    }
    if (mask.channel !== undefined && mask.channel !== "alpha" && mask.channel !== "luminance") {
      throw new Error(`A mask's channel is "alpha" or "luminance"; got ${JSON.stringify(mask.channel)}.`);
    }
    const under = mask.under;
    if (under !== undefined && isPassRef(under as PassInput) && !this.passes[(under as { pass: number }).pass]) {
      throw new Error(`A mask's under reads pass ${(under as { pass: number }).pass}, and there are ${this.passes.length} passes (0 to ${this.passes.length - 1}).`);
    }
    for (const [key, picture] of [
      ["mask", mask.picture],
      ["under", under],
    ] as const) {
      if (picture === undefined || isPassRef(picture as PassInput)) continue;
      if (isFloatPicture(picture)) this.convert(key, `A mask's ${key === "mask" ? "picture" : "under"}`, picture);
      else this.textures.setLive(key, picture as LiveSource);
    }
    this.mask = mask;
  }

  /** Settles once every image the passes show has loaded, and every live video has a frame (see `ShaderFrames.ready`). */
  async ready(): Promise<void> {
    await Promise.all([this.textures.ready(this.urls()), this.textures.liveReady()]);
  }

  /** Draws the frame at `time` seconds: every pass in order, the last on `canvas`. */
  render(time: number, options: RenderOptions = {}) {
    const gl = this.context();
    const delta = options.delta ?? (this.lastTime === null ? 0 : time - this.lastTime);
    const state = {
      width: this.width,
      height: this.height,
      time,
      delta,
      frame: options.frame ?? this.rendered,
      mouse: options.mouse ?? ([0, 0, 0, 0] as [number, number, number, number]),
      pointer: options.pointer,
      clicks: options.clicks && clicksUniform(options.clicks, time),
      trail: options.trail && trailUniform(options.trail, time),
      ...(options.audio ? { audio: options.audio.audio ?? [0, 0, 0, 0], spectrum: options.audio.spectrum ?? SILENT, beat: options.audio.beat ?? -1 } : {}),
      ...(options.scroll ? { scroll: options.scroll } : {}),
    };
    this.passes.forEach((pass, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, pass.current.framebuffer);
      gl.viewport(0, 0, this.width, this.height);
      if (pass.spec.blend === "over" && i > 0) {
        this.drawCopy(this.passes[i - 1]!.current.texture);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      drawFrame(gl, pass.shader, pass.controls, pass.values, state, this.sourceFor(i));
      gl.disable(gl.BLEND);
      // Image controls sample with mipmaps unless they say otherwise.
      gl.bindTexture(gl.TEXTURE_2D, pass.current.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    });
    const result = this.mask ? this.composite(this.output.current) : this.output.current;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    this.drawCopy(result.texture);
    this.result = result;
    for (const pass of this.passes) {
      if (pass.previous) [pass.current, pass.previous] = [pass.previous, pass.current];
    }
    this.rendered += 1;
    this.lastTime = time;
  }

  /** Clears every pass's last frame, so feedback starts again as on the first frame. */
  resetFeedback() {
    const gl = this.context();
    for (const pass of this.passes) {
      if (pass.previous) this.clear(pass.previous);
      if (pass.previous) this.clear(pass.current);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.rendered = 0;
    this.lastTime = null;
  }

  /** The last frame's output as RGBA bytes, rows top down (as `ShaderFrames.readPixels`). */
  readPixels(out?: Uint8Array | Uint8ClampedArray): Uint8Array | Uint8ClampedArray {
    const gl = this.context();
    const { width, height } = this;
    const target = out ?? new Uint8Array(width * height * 4);
    if (target.length !== width * height * 4) throw new RangeError(`readPixels needs a buffer of ${width * height * 4} bytes.`);
    // After `render`, the output is the pass's `previous` when it keeps one (they were swapped).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultTarget().framebuffer);
    if (this.format === "rgba8") gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    else {
      // A float framebuffer reads as floats; its colour is sRGB-encoded already, so it only needs quantising.
      const floats = new Float32Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, floats);
      for (let i = 0; i < floats.length; i++) this.pixels[i] = Math.round(Math.min(1, Math.max(0, floats[i]!)) * 255);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const row = width * 4;
    for (let y = 0; y < height; y++) target.set(this.pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    return target;
  }

  /**
   * The last frame's output as floats: RGBA, rows top down, in linear light
   * (sRGB primaries), straight alpha, as {@link FloatPicture}. With a float
   * `format` colour keeps its precision and may exceed 1; with `rgba8` it is
   * the 8-bit output, decoded. Pass `out` to reuse a buffer.
   */
  readFloatPixels(out?: Float32Array): Float32Array {
    const gl = this.context();
    const { width, height } = this;
    const n = width * height * 4;
    const target = out ?? new Float32Array(n);
    if (target.length !== n) throw new RangeError(`readFloatPixels needs a buffer of ${n} floats.`);
    if (this.format === "rgba8") {
      const bytes = this.readPixels();
      for (let i = 0; i < n; i += 4) {
        target[i] = srgbToLinear(bytes[i]! / 255);
        target[i + 1] = srgbToLinear(bytes[i + 1]! / 255);
        target[i + 2] = srgbToLinear(bytes[i + 2]! / 255);
        target[i + 3] = bytes[i + 3]! / 255;
      }
      return target;
    }
    this.decode ??= linkUtilityProgram(gl, DECODE_SOURCE);
    this.decoded ??= this.target();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.decoded.framebuffer);
    gl.viewport(0, 0, width, height);
    this.drawWith(this.decode, this.resultTarget().texture);
    const rows = new Float32Array(n);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, rows);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const row = width * 4;
    for (let y = 0; y < height; y++) target.set(rows.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    return target;
  }

  /** The last frame's output as an `ImageData` (see `ShaderFrames.readImageData`). */
  readImageData(): FramePixels {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    this.readPixels(data);
    if (typeof ImageData !== "undefined") return new ImageData(data, this.width, this.height) as FramePixels;
    return { data, width: this.width, height: this.height, colorSpace: "srgb" };
  }

  /** The last frame's output as an `ImageBitmap` (see `ShaderFrames.toImageBitmap`). */
  async toImageBitmap(): Promise<ImageBitmap> {
    this.context();
    return createImageBitmap(this.canvas);
  }

  /** Releases the GL context now rather than at garbage collection. */
  dispose() {
    const gl = this.gl;
    if (!gl) return;
    for (const pass of this.passes) {
      gl.deleteProgram(pass.shader.program);
      for (const t of [pass.current, pass.previous]) {
        if (!t) continue;
        gl.deleteFramebuffer(t.framebuffer);
        gl.deleteTexture(t.texture);
      }
    }
    for (const t of this.converted.values()) this.deleteTarget(t);
    for (const t of [this.decoded, this.composed]) if (t) this.deleteTarget(t);
    for (const program of [this.copy, this.encode, this.decode]) if (program) gl.deleteProgram(program);
    this.textures.dispose();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }

  /** The last frame's output (before any frame: the last pass's empty target). */
  private resultTarget(): Target {
    return this.result ?? this.output.current;
  }

  private get output(): PassState {
    return this.passes[this.passes.length - 1]!;
  }

  private pass(index: number): PassState {
    const state = this.passes[index];
    if (!state) throw new Error(`There is no pass ${index}; the pipeline has ${this.passes.length} (0 to ${this.passes.length - 1}).`);
    return state;
  }

  /** Gives a pass a second target, so its last frame can be read while it draws the next. */
  private history(index: number) {
    const state = this.passes[index]!;
    if (!state.previous) state.previous = this.clear(this.target());
  }

  /** What `drawFrame` binds for pass `index`'s image controls: other passes' outputs, pictures, or URLs. */
  private sourceFor(index: number): TextureSource {
    const state = this.passes[index]!;
    return {
      texture: (url) => this.textures.texture(url),
      liveTexture: (name) => {
        const input = state.inputs.get(name);
        if (input === undefined) return undefined;
        if (input === "previous") return this.passes[index - 1]!.current.texture;
        if (input === "feedback") return state.previous!.texture;
        if (isPassRef(input)) {
          const source = this.passes[input.pass]!;
          return input.pass < index ? source.current.texture : source.previous!.texture;
        }
        if (isFloatPicture(input)) return this.converted.get(`${index}:${name}`)!.texture;
        return this.textures.liveTexture(`${index}:${name}`);
      },
    };
  }

  private target(width = this.width, height = this.height): Target {
    const gl = this.context();
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const [internal, type] = FORMATS[this.format](gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null);
    gl.generateMipmap(gl.TEXTURE_2D);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
  }

  /** Fills a target with transparent black. */
  private clear(target: Target): Target {
    const gl = this.context();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return target;
  }

  /** Blends the effect's output with what is under it by the mask's coverage, into the composite target. */
  private composite(effect: Target): Target {
    const gl = this.context();
    const mask = this.mask!;
    this.compositor ??= linkUtilityProgram(gl, COMPOSITE_SOURCE);
    this.composed ??= this.target();
    const program = this.compositor;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.composed.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(program);
    const at = (name: string) => gl.getUniformLocation(program, name);
    const bind = (unit: number, name: string, texture: WebGLTexture | null | undefined) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture ?? null);
      if (texture && unit > 0) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.uniform1i(at(name), unit);
    };
    const picture = (key: "mask" | "under", value: PipelineMask["picture"] | PipelineMask["under"]) => {
      if (value === undefined) return undefined;
      if (isPassRef(value as PassInput)) return this.passes[(value as { pass: number }).pass]!.current.texture;
      if (isFloatPicture(value)) return this.converted.get(key)!.texture;
      return this.textures.liveTexture(key);
    };
    const maskTexture = picture("mask", mask.picture);
    const underTexture = picture("under", mask.under);
    bind(0, "flair_source", effect.texture);
    bind(1, "flair_mask", maskTexture);
    bind(2, "flair_under", underTexture);
    gl.uniform1i(at("flair_hasMask"), maskTexture ? 1 : 0);
    gl.uniform1i(at("flair_hasUnder"), underTexture ? 1 : 0);
    gl.uniform1i(at("flair_luminance"), mask.channel === "luminance" ? 1 : 0);
    gl.uniform1i(at("flair_invert"), mask.invert ? 1 : 0);
    gl.uniform2f(at("flair_size"), this.width, this.height);
    const [x, y, w, h] = mask.region ?? [0, 0, this.width, this.height];
    // From the top left, as given, to GL's bottom left.
    gl.uniform4f(at("flair_region"), x, this.height - y - h, w, h);
    gl.uniform1i(at("flair_hasRegion"), mask.region ? 1 : 0);
    gl.uniform1f(at("flair_feather"), Math.max(0, mask.feather ?? 0));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, this.composed.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    return this.composed;
  }

  /** Draws `texture` as it is into the bound framebuffer. */
  private drawCopy(texture: WebGLTexture) {
    this.drawWith(this.copy, texture);
  }

  /** Runs one of Flair's own programs over `texture` into the bound framebuffer. */
  private drawWith(program: WebGLProgram, texture: WebGLTexture) {
    const gl = this.context();
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, "flair_source"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Uploads a float picture and converts it, on the GPU, to what shaders
   * expect: sRGB-encoded (extended past 0–1), rows bottom up, in the
   * pipeline's format, with mipmaps. Done when the input is set: set it
   * again for the next frame's picture.
   */
  private convert(key: string, what: string, picture: FloatPicture) {
    const gl = this.context();
    const { width, height, data } = picture;
    if (!(width >= 1 && height >= 1) || data.length !== width * height * 4) {
      throw new RangeError(`${what} needs width × height × 4 floats (${width} × ${height} × 4 = ${width * height * 4}); it has ${data.length}.`);
    }
    const raw = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, raw);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
    // No mipmaps: without this filter the texture is incomplete, and reads as nothing.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    let target = this.converted.get(key);
    if (!target || target.width !== width || target.height !== height) {
      if (target) this.deleteTarget(target);
      target = { ...this.target(width, height), width, height };
      this.converted.set(key, target);
    }
    this.encode ??= linkUtilityProgram(gl, ENCODE_SOURCE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, width, height);
    this.drawWith(this.encode, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(raw);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /** Frees a converted float picture. */
  private forget(key: string) {
    const target = this.converted.get(key);
    if (target) this.deleteTarget(target);
    this.converted.delete(key);
  }

  private deleteTarget(target: Target) {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
  }

  /** The URLs image controls show: those not fed by an input. */
  private urls(): string[] {
    return this.passes.flatMap((p) => imageUrls(p.controls.filter((c) => !p.inputs.has(c.name)), p.values));
  }

  private syncTextures() {
    const urls = this.urls();
    this.textures.retain(urls);
    for (const url of urls) this.textures.request(url);
  }

  private context(): WebGL2RenderingContext {
    if (!this.gl) throw new Error("This pipeline has been disposed.");
    if (this.gl.isContextLost()) throw new Error("The graphics context was lost.");
    return this.gl;
  }
}

/** A detached canvas: a `<canvas>` on a page, an `OffscreenCanvas` in a Worker. */
function newCanvas(width: number, height: number): FramesCanvas {
  if (typeof document !== "undefined") return document.createElement("canvas");
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  throw new Error("There is no canvas here: ShaderPipeline needs a page or a Worker with OffscreenCanvas.");
}
