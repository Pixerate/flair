import { controlValue, type ControlDef, type ControlValue } from "./controls.js";
import { SPECTRUM_BINS } from "./audio.js";
import { MAX_CLICKS, MAX_TRAIL } from "./pointer.js";
import { applyTextureSettings, type TextureSource } from "./textures.js";

/**
 * Shaders are written Shadertoy-style: the source defines
 * `void mainImage(out vec4 fragColor, in vec2 fragCoord)` and may use the
 * built-in uniforms below. It is compiled as GLSL ES 3.00 (WebGL2) inside a
 * small wrapper; `#line 1` keeps compiler line numbers matching the source.
 */
export const BUILTIN_UNIFORMS = [
  { name: "iResolution", type: "vec3", doc: "viewport size in pixels (z = 1)" },
  { name: "iTime", type: "float", doc: "seconds since the shader started" },
  { name: "iTimeDelta", type: "float", doc: "seconds since the previous frame" },
  { name: "iFrame", type: "int", doc: "frame number" },
  {
    name: "iMouse",
    type: "vec4",
    doc: "xy = pointer while pressed (pixels), zw = press position (negative once released)",
  },
  {
    name: "iPointer",
    type: "vec4",
    doc: "xy = pointer while over the canvas (pixels), z = how hovered (0–1, eased), w = seconds held while pressed, minus seconds since release after (0 before any press)",
  },
  {
    name: "iClicks",
    type: "vec4",
    size: MAX_CLICKS,
    doc: "the latest clicks, newest first: xy = where (pixels), z = when (iTime seconds), w = 1 for a click, 0 for an empty slot",
  },
  {
    name: "iTrail",
    type: "vec4",
    size: MAX_TRAIL,
    doc: "where the pointer has just been over the canvas, newest first (about 30 points a second, so a second of path): xy = where (pixels), z = when (iTime seconds), w = 1 for a point, 0 for an empty slot",
  },
  {
    name: "iAudio",
    type: "vec4",
    doc: "the sound (see setAudioSource): x = level (loudness 0–1), y = bass, z = mid, w = treble (0–1, smoothed); all zero with no audio",
  },
  {
    name: "iSpectrum",
    type: "vec4",
    size: SPECTRUM_BINS / 4,
    doc: "64 log-spaced frequency bins (about 30 Hz to 16 kHz), 0–1, four to a vec4, low to high: bin i is iSpectrum[i / 4][i % 4]",
  },
  {
    name: "iBeat",
    type: "float",
    doc: "seconds since the last beat (an onset on the bass), -1 before the first; 0 like every audio uniform when there is no audio at all",
  },
  {
    name: "iScroll",
    type: "vec4",
    doc: "scrolling: x = the canvas's progress through the viewport (0 as its top enters at the bottom, 1 as its bottom leaves at the top), y = page scroll (0–1), z = velocity (viewport heights per second, + down, smoothed), w = 1 while scrolling, easing to 0; all zero where nothing scrolls",
  },
] as const;

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iPointer;
uniform vec4 iClicks[${MAX_CLICKS}];
uniform vec4 iTrail[${MAX_TRAIL}];
uniform vec4 iAudio;
uniform vec4 iSpectrum[${SPECTRUM_BINS / 4}];
uniform float iBeat;
uniform vec4 iScroll;
out vec4 flair_FragColor;
`;

const EPILOGUE = `
void main() {
  vec4 flair_color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(flair_color, gl_FragCoord.xy);
  flair_FragColor = vec4(flair_color.rgb, clamp(flair_color.a, 0.0, 1.0));
}
`;

/** A full-screen triangle from `gl_VertexID` alone: no buffers or attributes. */
export const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** One compiler message, mapped back to the user's source. */
export interface CompileError {
  /** 1-based line in the user's source (0 when the driver gave none, or it is outside the source). */
  line: number;
  message: string;
}

/** A linked program and the uniform locations `drawFrame` sets. */
export interface CompiledShader {
  program: WebGLProgram;
  builtins: Record<string, WebGLUniformLocation | null>;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export type CompileResult =
  { ok: true; shader: CompiledShader } | { ok: false; errors: CompileError[] };

/** Thrown by the APIs that cannot carry on without a program (`ShaderFrames`, `recordGif`). */
export class ShaderCompileError extends Error {
  readonly errors: CompileError[];

  constructor(errors: CompileError[]) {
    super(formatCompileError(errors));
    this.name = "ShaderCompileError";
    this.errors = errors;
  }
}

/** "The shader does not compile (line 3): 'x' : undeclared identifier", from the first error. */
export function formatCompileError(errors: CompileError[]): string {
  const first = errors[0];
  return `The shader does not compile${first?.line ? ` (line ${first.line})` : ""}: ${first?.message ?? "unknown error"}`;
}

/** The complete GLSL ES 3.00 fragment shader for a `mainImage` source. */
export function wrapSource(source: string): string {
  // `#line 1` must follow the prelude; drop a user `#version` (the wrapper owns it).
  return `${PRELUDE}#line 1\n${source.replace(/^\s*#version[^\n]*/m, "")}\n${EPILOGUE}`;
}

/** Turns a driver log ("ERROR: 0:12: 'foo' : undeclared identifier") into line-numbered errors. */
export function parseCompileLog(log: string, lineCount: number): CompileError[] {
  const errors: CompileError[] = [];
  for (const raw of log.split("\n")) {
    const text = raw.trim();
    if (!text) continue;
    const m = /^(?:ERROR|WARNING):\s*\d+:(\d+):\s*(.*)$/.exec(text);
    if (m) {
      const line = Number(m[1]);
      errors.push({ line: line >= 1 && line <= lineCount ? line : 0, message: m[2]!.trim() });
    } else if (!/^\W*$/.test(text)) {
      errors.push({ line: 0, message: text.replace(/^ERROR:\s*/, "") });
    }
  }
  if (!errors.length) errors.push({ line: 0, message: "The shader did not compile." });
  // Drivers often repeat the same error.
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.line}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let vertexCache = new WeakMap<WebGL2RenderingContext, WebGLShader>();

function vertexShader(gl: WebGL2RenderingContext): WebGLShader {
  let vs = vertexCache.get(gl);
  if (!vs) {
    vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SOURCE);
    gl.compileShader(vs);
    vertexCache.set(gl, vs);
  }
  return vs;
}

/**
 * Links a complete GLSL ES 3.00 fragment shader (not a `mainImage` source)
 * with the full-screen triangle, for Flair's own passes (copies,
 * composites). Throws with the driver's log when it does not compile:
 * these sources are Flair's, so that is a bug, not a user error.
 */
export function linkUtilityProgram(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fs) throw new Error("WebGL could not create a shader (the context may be lost).");
  gl.shaderSource(fs, fragment);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fs);
    gl.deleteShader(fs);
    throw new Error(`Flair's own shader did not compile: ${log}`);
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader(gl));
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Flair's own shader did not link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

/** Forgets cached GL objects. Call it after a context loss, before compiling on the restored context. */
export function resetGlCaches() {
  vertexCache = new WeakMap();
}

/**
 * Compiles and links a `mainImage` source. Errors come back with lines in
 * the user's source, never thrown. `controls` (from `parseControls`) says
 * which uniform locations to look up.
 */
export function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  controls: ControlDef[],
): CompileResult {
  const lineCount = source.split("\n").length;
  if (gl.isContextLost()) {
    return {
      ok: false,
      errors: [
        {
          line: 0,
          message:
            "The graphics context was lost; reload the page if the preview does not come back.",
        },
      ],
    };
  }
  if (!/\bmainImage\s*\(/.test(source)) {
    return {
      ok: false,
      errors: [
        { line: 0, message: "Define void mainImage(out vec4 fragColor, in vec2 fragCoord)." },
      ],
    };
  }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fs) {
    return {
      ok: false,
      errors: [{ line: 0, message: "WebGL could not create a shader (the context may be lost)." }],
    };
  }
  gl.shaderSource(fs, wrapSource(source));
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const errors = parseCompileLog(gl.getShaderInfoLog(fs) ?? "", lineCount);
    gl.deleteShader(fs);
    return { ok: false, errors };
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader(gl));
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const errors = parseCompileLog(gl.getProgramInfoLog(program) ?? "", lineCount);
    gl.deleteProgram(program);
    return { ok: false, errors };
  }
  const builtins: CompiledShader["builtins"] = {};
  for (const u of BUILTIN_UNIFORMS) builtins[u.name] = gl.getUniformLocation(program, u.name);
  const uniforms = new Map(
    controls.map((c) => [c.name, gl.getUniformLocation(program, c.name)] as const),
  );
  return { ok: true, shader: { program, builtins, uniforms } };
}

const NO_CLICKS = new Float32Array(MAX_CLICKS * 4);
const NO_TRAIL = new Float32Array(MAX_TRAIL * 4);
const NO_SPECTRUM = new Float32Array(SPECTRUM_BINS);

/** What one frame shows: its size in pixels, its time, the pointer, the sound and the scroll. */
export interface FrameState {
  width: number;
  height: number;
  /** `iTime`, in seconds. */
  time: number;
  /** `iTimeDelta`, in seconds. */
  delta: number;
  /** `iFrame`. */
  frame: number;
  /** `iMouse`, Shadertoy semantics. */
  mouse: [number, number, number, number];
  /** `iPointer` (default all zero: nobody is pointing). */
  pointer?: readonly [number, number, number, number];
  /** `iClicks`: {@link MAX_CLICKS} × (x, y, time, 1), newest first (default none; see `clicksUniform`). */
  clicks?: Float32Array;
  /** `iTrail`: {@link MAX_TRAIL} × (x, y, time, 1), newest first (default none; see `trailUniform`). */
  trail?: Float32Array;
  /** `iAudio`: level, bass, mid, treble (default all zero: no audio). */
  audio?: readonly [number, number, number, number];
  /** `iSpectrum`: {@link SPECTRUM_BINS} values, 0–1, low to high (default all zero). */
  spectrum?: Float32Array;
  /** `iBeat`: seconds since the last beat, -1 before the first (default 0, with no audio at all). */
  beat?: number;
  /** `iScroll`: progress, page, velocity, scrolling (default all zero: nothing scrolls it). */
  scroll?: readonly [number, number, number, number];
}

/**
 * Draws one frame of a compiled shader into the bound framebuffer, from (0, 0).
 * Image controls are bound to texture units 0, 1, … in source order, with
 * textures from `textures` (a {@link TextureCache} for the same context): a
 * control's live source when it has one, else its URL's image. Without
 * `textures` they sample nothing.
 */
export function drawFrame(
  gl: WebGL2RenderingContext,
  shader: CompiledShader,
  controls: ControlDef[],
  values: Record<string, ControlValue> | undefined,
  state: FrameState,
  textures?: TextureSource,
) {
  gl.viewport(0, 0, state.width, state.height);
  gl.useProgram(shader.program);
  const b = shader.builtins;
  if (b.iResolution) gl.uniform3f(b.iResolution, state.width, state.height, 1);
  if (b.iTime) gl.uniform1f(b.iTime, state.time);
  if (b.iTimeDelta) gl.uniform1f(b.iTimeDelta, state.delta);
  if (b.iFrame) gl.uniform1i(b.iFrame, state.frame);
  if (b.iMouse) gl.uniform4f(b.iMouse, ...state.mouse);
  if (b.iPointer) gl.uniform4f(b.iPointer, ...(state.pointer ?? [0, 0, 0, 0]));
  if (b.iClicks) gl.uniform4fv(b.iClicks, state.clicks ?? NO_CLICKS);
  if (b.iTrail) gl.uniform4fv(b.iTrail, state.trail ?? NO_TRAIL);
  if (b.iAudio) gl.uniform4f(b.iAudio, ...(state.audio ?? ([0, 0, 0, 0] as const)));
  if (b.iSpectrum) gl.uniform4fv(b.iSpectrum, state.spectrum ?? NO_SPECTRUM);
  if (b.iBeat) gl.uniform1f(b.iBeat, state.beat ?? 0);
  if (b.iScroll) gl.uniform4f(b.iScroll, ...(state.scroll ?? ([0, 0, 0, 0] as const)));
  let unit = 0;
  for (const control of controls) {
    const loc = shader.uniforms.get(control.name);
    if (!loc) continue;
    const v = controlValue(control, values);
    switch (control.type) {
      case "float":
        gl.uniform1f(loc, v as number);
        break;
      case "int":
        gl.uniform1i(loc, Math.round(v as number));
        break;
      case "bool":
        gl.uniform1i(loc, v ? 1 : 0);
        break;
      case "vec2":
        gl.uniform2fv(loc, v as number[]);
        break;
      case "vec3":
        gl.uniform3fv(loc, v as number[]);
        break;
      case "vec4":
        gl.uniform4fv(loc, v as number[]);
        break;
      case "sampler2D": {
        gl.activeTexture(gl.TEXTURE0 + unit);
        const live = textures?.liveTexture?.(control.name);
        const texture = (live === undefined ? textures?.texture(v as string) : live) ?? null;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (texture && control.texture) applyTextureSettings(gl, control.texture);
        gl.uniform1i(loc, unit++);
        break;
      }
    }
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/**
 * A WebGL2 context set up for full-screen fragment shaders: opaque by default,
 * no depth, stencil or antialiasing. `preserveDrawingBuffer` keeps the last
 * frame readable after the task that drew it (for captures). `alpha` enables a
 * transparent drawing buffer for overlay shaders. Null without WebGL2.
 */
export function createContext(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  preserveDrawingBuffer = false,
  alpha = false,
): WebGL2RenderingContext | null {
  return canvas.getContext("webgl2", {
    alpha,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer,
    powerPreference: "high-performance",
  }) as WebGL2RenderingContext | null;
}
