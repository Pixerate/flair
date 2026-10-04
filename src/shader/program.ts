import { controlValue, type ControlDef, type ControlValue } from "./controls.js";

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
] as const;

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
out vec4 gobo_FragColor;
`;

const EPILOGUE = `
void main() {
  vec4 gobo_color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(gobo_color, gl_FragCoord.xy);
  gobo_FragColor = vec4(gobo_color.rgb, 1.0);
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

/** What one frame shows: its size in pixels, its time and the pointer. */
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
}

/** Draws one frame of a compiled shader into the bound framebuffer, from (0, 0). */
export function drawFrame(
  gl: WebGL2RenderingContext,
  shader: CompiledShader,
  controls: ControlDef[],
  values: Record<string, ControlValue> | undefined,
  state: FrameState,
) {
  gl.viewport(0, 0, state.width, state.height);
  gl.useProgram(shader.program);
  const b = shader.builtins;
  if (b.iResolution) gl.uniform3f(b.iResolution, state.width, state.height, 1);
  if (b.iTime) gl.uniform1f(b.iTime, state.time);
  if (b.iTimeDelta) gl.uniform1f(b.iTimeDelta, state.delta);
  if (b.iFrame) gl.uniform1i(b.iFrame, state.frame);
  if (b.iMouse) gl.uniform4f(b.iMouse, ...state.mouse);
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
    }
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/**
 * A WebGL2 context set up for full-screen fragment shaders: opaque, no depth,
 * stencil or antialiasing. `preserveDrawingBuffer` keeps the last frame
 * readable after the task that drew it (for captures). Null without WebGL2.
 */
export function createContext(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  preserveDrawingBuffer = false,
): WebGL2RenderingContext | null {
  return canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer,
    powerPreference: "high-performance",
  }) as WebGL2RenderingContext | null;
}
