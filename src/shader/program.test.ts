import { parseControls } from "./controls.js";
import {
  BUILTIN_UNIFORMS,
  compileShader,
  createContext,
  drawFrame,
  formatCompileError,
  parseCompileLog,
  resetGlCaches,
  ShaderCompileError,
  VERTEX_SOURCE,
  wrapSource,
  type CompiledShader,
  type FrameState,
} from "./program.js";
import { asGl, FakeGl, shaderSource, type FakeLocation, type FakeShader } from "./test-utils.js";

const STATE: FrameState = {
  width: 320,
  height: 180,
  time: 1.5,
  delta: 0.016,
  frame: 7,
  mouse: [1, 2, 3, 4],
};

function compiled(gl: FakeGl, source: string): CompiledShader {
  const result = compileShader(asGl(gl), source, parseControls(source));
  if (!result.ok) throw new Error(result.errors[0]!.message);
  return result.shader;
}

describe("wrapSource", () => {
  const source = "void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }";
  const wrapped = wrapSource(source);

  it("starts with the GLSL ES 3.00 version line", () => {
    expect(wrapped.startsWith("#version 300 es\n")).toBe(true);
  });

  it("declares every built-in uniform", () => {
    for (const u of BUILTIN_UNIFORMS) expect(wrapped).toContain(`uniform ${u.type} ${u.name};`);
  });

  it("resets line numbers just before the user's source", () => {
    expect(wrapped).toContain(`#line 1\n${source}\n`);
  });

  it("calls mainImage from main and writes an opaque colour", () => {
    expect(wrapped).toMatch(/void main\(\) \{[\s\S]*mainImage\(flair_color, gl_FragCoord\.xy\);/);
    expect(wrapped).toContain("flair_FragColor = vec4(flair_color.rgb, 1.0);");
  });

  it("drops a #version line from the user's source", () => {
    const w = wrapSource(`  #version 300 es\n${source}`);
    expect(w.match(/#version/g)).toHaveLength(1);
  });

  it("keeps the user's own preprocessor lines", () => {
    expect(wrapSource(`#define PI 3.14159\n${source}`)).toContain("#line 1\n#define PI 3.14159\n");
  });
});

describe("VERTEX_SOURCE", () => {
  it("draws a full-screen triangle from gl_VertexID", () => {
    expect(VERTEX_SOURCE.startsWith("#version 300 es")).toBe(true);
    expect(VERTEX_SOURCE).toContain("gl_VertexID");
  });
});

describe("parseCompileLog", () => {
  it("reads line numbers from ANGLE and driver logs", () => {
    const log = [
      "ERROR: 0:3: 'foo' : undeclared identifier",
      "ERROR: 0:7: '=' : cannot convert from 'const int' to 'highp float'",
    ].join("\n");
    expect(parseCompileLog(log, 10)).toEqual([
      { line: 3, message: "'foo' : undeclared identifier" },
      { line: 7, message: "'=' : cannot convert from 'const int' to 'highp float'" },
    ]);
  });

  it("reads warnings too", () => {
    expect(parseCompileLog("WARNING: 0:2: unused variable", 5)).toEqual([
      { line: 2, message: "unused variable" },
    ]);
  });

  it("reports lines outside the user's source as line 0", () => {
    expect(parseCompileLog("ERROR: 0:40: 'x' : bad", 10)).toEqual([
      { line: 0, message: "'x' : bad" },
    ]);
    expect(parseCompileLog("ERROR: 0:0: 'x' : bad", 10)[0]!.line).toBe(0);
  });

  it("keeps lines without a location, and drops punctuation-only lines", () => {
    expect(parseCompileLog("ERROR: Missing main()\n\0\n---\n", 10)).toEqual([
      { line: 0, message: "Missing main()" },
    ]);
  });

  it("removes repeated errors", () => {
    const log = "ERROR: 0:2: 'x' : bad\nERROR: 0:2: 'x' : bad\nERROR: 0:3: 'x' : bad";
    expect(parseCompileLog(log, 10)).toHaveLength(2);
  });

  it("never returns an empty list", () => {
    expect(parseCompileLog("", 10)).toEqual([{ line: 0, message: "The shader did not compile." }]);
  });
});

describe("formatCompileError and ShaderCompileError", () => {
  it("names the first error and its line", () => {
    expect(
      formatCompileError([
        { line: 3, message: "bad" },
        { line: 9, message: "worse" },
      ]),
    ).toBe("The shader does not compile (line 3): bad");
    expect(formatCompileError([{ line: 0, message: "bad" }])).toBe(
      "The shader does not compile: bad",
    );
    expect(formatCompileError([])).toBe("The shader does not compile: unknown error");
  });

  it("carries the errors", () => {
    const errors = [{ line: 1, message: "bad" }];
    const error = new ShaderCompileError(errors);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ShaderCompileError");
    expect(error.errors).toBe(errors);
    expect(error.message).toBe("The shader does not compile (line 1): bad");
  });
});

describe("compileShader", () => {
  beforeEach(() => resetGlCaches());

  it("compiles the wrapped source and links it with the shared vertex shader", () => {
    const gl = new FakeGl();
    const source = shaderSource();
    const result = compileShader(asGl(gl), source, []);
    expect(result.ok).toBe(true);
    const vertex = gl.shaders.find((s) => s.type === gl.VERTEX_SHADER);
    const fragment = gl.shaders.find((s) => s.type === gl.FRAGMENT_SHADER);
    expect(vertex!.source).toBe(VERTEX_SOURCE);
    expect(fragment!.source).toBe(wrapSource(source));
    expect(gl.programs[0]!.shaders).toEqual([vertex, fragment]);
    expect(gl.programs[0]!.linked).toBe(true);
    expect(fragment!.deleted).toBe(true);
  });

  it("looks up the built-ins and every control's uniform", () => {
    const gl = new FakeGl({ missingUniforms: ["iMouse", "uUnused"] });
    const source = shaderSource(
      "uniform float uSpeed; // @control",
      "uniform float uUnused; // @control",
    );
    const shader = compiled(gl, source);
    expect(Object.keys(shader.builtins)).toEqual(BUILTIN_UNIFORMS.map((u) => u.name));
    expect(shader.builtins.iMouse).toBeNull();
    expect((shader.builtins.iTime as FakeLocation).name).toBe("iTime");
    expect([...shader.uniforms.keys()]).toEqual(["uSpeed", "uUnused"]);
    expect(shader.uniforms.get("uUnused")).toBeNull();
  });

  it("compiles the vertex shader once per context, until the caches are reset", () => {
    const gl = new FakeGl();
    compiled(gl, shaderSource());
    compiled(gl, shaderSource());
    const vertexCount = () => gl.shaders.filter((s) => s.type === gl.VERTEX_SHADER).length;
    expect(vertexCount()).toBe(1);
    compiled(new FakeGl(), shaderSource());
    expect(vertexCount()).toBe(1);
    resetGlCaches();
    compiled(gl, shaderSource());
    expect(vertexCount()).toBe(2);
  });

  it("reports compile errors on the user's lines, and deletes the shader", () => {
    const gl = new FakeGl({ compileLog: "ERROR: 0:2: 'COMPILE_ERROR' : undeclared identifier" });
    const result = compileShader(asGl(gl), shaderSource("// COMPILE_ERROR"), []);
    expect(result).toEqual({
      ok: false,
      errors: [{ line: 2, message: "'COMPILE_ERROR' : undeclared identifier" }],
    });
    const fragment = gl.shaders.find((s: FakeShader) => s.type === gl.FRAGMENT_SHADER)!;
    expect(fragment.deleted).toBe(true);
    expect(gl.programs).toHaveLength(0);
  });

  it("reports link errors and deletes the program", () => {
    const gl = new FakeGl({ linkLog: "ERROR: Linking failed" });
    const result = compileShader(asGl(gl), shaderSource("// LINK_ERROR"), []);
    expect(result).toEqual({ ok: false, errors: [{ line: 0, message: "Linking failed" }] });
    expect(gl.programs[0]!.deleted).toBe(true);
  });

  it("asks for mainImage before compiling", () => {
    const gl = new FakeGl();
    const result = compileShader(asGl(gl), "void main() {}", []);
    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 0, message: "Define void mainImage(out vec4 fragColor, in vec2 fragCoord)." },
      ],
    });
    expect(gl.calls).toHaveLength(0);
  });

  it("says when the context is lost", () => {
    const gl = new FakeGl();
    gl.lost = true;
    const result = compileShader(asGl(gl), shaderSource(), []);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]!.message).toMatch(/context was lost/);
  });

  it("says when WebGL cannot create a shader", () => {
    const gl = new FakeGl();
    gl.refuseShaders = true;
    const result = compileShader(asGl(gl), shaderSource(), []);
    expect(!result.ok && result.errors[0]!.message).toMatch(/could not create a shader/);
  });
});

describe("drawFrame", () => {
  beforeEach(() => resetGlCaches());

  it("sets the viewport, program and built-ins, then draws one triangle", () => {
    const gl = new FakeGl();
    const shader = compiled(gl, shaderSource());
    gl.calls.length = 0;
    drawFrame(asGl(gl), shader, [], undefined, STATE);
    expect(gl.named("viewport")[0]!.args).toEqual([0, 0, 320, 180]);
    expect(gl.named("useProgram")[0]!.args[0]).toBe(shader.program);
    expect(gl.uniform("iResolution")).toEqual([320, 180, 1]);
    expect(gl.uniform("iTime")).toEqual([1.5]);
    expect(gl.uniform("iTimeDelta")).toEqual([0.016]);
    expect(gl.uniform("iFrame")).toEqual([7]);
    expect(gl.uniform("iMouse")).toEqual([1, 2, 3, 4]);
    expect(gl.named("drawArrays")[0]!.args).toEqual([gl.TRIANGLES, 0, 3]);
    expect(gl.calls[gl.calls.length - 1]!.name).toBe("drawArrays");
  });

  it("sets each control with the setter for its type", () => {
    const gl = new FakeGl();
    const source = shaderSource(
      "uniform float uF; // @control default=0.5",
      "uniform int uI; // @control default=3",
      "uniform bool uB; // @control default=true",
      "uniform vec2 uV2; // @control default=1,2",
      "uniform vec3 uV3; // @control color default=#ff0000",
      "uniform vec4 uV4; // @control default=1,2,3,4",
    );
    const controls = parseControls(source);
    const shader = compiled(gl, source);
    drawFrame(asGl(gl), shader, controls, undefined, STATE);
    const setter = (name: string) =>
      gl.calls.find((c) => (c.args[0] as FakeLocation | null)?.name === name)?.name;
    expect(
      ["uF", "uI", "uB", "uV2", "uV3", "uV4"].map((n) => [n, setter(n), gl.uniform(n)]),
    ).toEqual([
      ["uF", "uniform1f", [0.5]],
      ["uI", "uniform1i", [3]],
      ["uB", "uniform1i", [1]],
      ["uV2", "uniform2fv", [[1, 2]]],
      ["uV3", "uniform3fv", [[1, 0, 0]]],
      ["uV4", "uniform4fv", [[1, 2, 3, 4]]],
    ]);
  });

  it("uses stored values that fit, rounds ints and sends false as 0", () => {
    const gl = new FakeGl();
    const source = shaderSource(
      "uniform int uI; // @control",
      "uniform bool uB; // @control default=true",
      "uniform vec2 uV; // @control default=1,2",
    );
    const controls = parseControls(source);
    drawFrame(asGl(gl), compiled(gl, source), controls, { uI: 2.7, uB: false, uV: [9] }, STATE);
    expect(gl.uniform("uI")).toEqual([3]);
    expect(gl.uniform("uB")).toEqual([0]);
    expect(gl.uniform("uV")).toEqual([[1, 2]]);
  });

  it("binds image controls to units in source order, with their sampling settings", () => {
    const gl = new FakeGl();
    const source = shaderSource(
      "uniform sampler2D uA; // @control filter=nearest wrap=clamp",
      "uniform float uF; // @control",
      "uniform sampler2D uB; // @control wrap=mirror",
    );
    const textures = { texture: vi.fn((url: string) => ({ url }) as unknown as WebGLTexture) };
    drawFrame(
      asGl(gl),
      compiled(gl, source),
      parseControls(source),
      { uB: "b.png" },
      STATE,
      textures,
    );
    expect(textures.texture.mock.calls).toEqual([[""], ["b.png"]]);
    expect(gl.uniform("uA")).toEqual([0]);
    expect(gl.uniform("uB")).toEqual([1]);
    expect(gl.named("activeTexture").map((c) => c.args[0])).toEqual([gl.TEXTURE0, gl.TEXTURE0 + 1]);
    expect(gl.named("bindTexture").map((c) => c.args[1])).toEqual([{ url: "" }, { url: "b.png" }]);
    const params = gl.named("texParameteri").map((c) => c.args.slice(1));
    expect(params).toEqual([
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT],
      [gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT],
    ]);
  });

  it("binds no texture to an image control without a texture source", () => {
    const gl = new FakeGl();
    const source = shaderSource("uniform sampler2D uA; // @control");
    drawFrame(asGl(gl), compiled(gl, source), parseControls(source), undefined, STATE);
    expect(gl.named("bindTexture")[0]!.args[1]).toBeNull();
    expect(gl.named("texParameteri")).toHaveLength(0);
    expect(gl.uniform("uA")).toEqual([0]);
  });

  it("skips uniforms the driver removed", () => {
    const gl = new FakeGl({ missingUniforms: ["uGone", "iMouse"] });
    const source = shaderSource("uniform float uGone; // @control");
    drawFrame(asGl(gl), compiled(gl, source), parseControls(source), undefined, STATE);
    expect(gl.named("uniform1f").some((c) => c.args[0] === null)).toBe(false);
    expect(gl.named("uniform4f")).toHaveLength(0);
  });
});

describe("createContext", () => {
  it("asks for an opaque WebGL2 context without depth, stencil or antialiasing", () => {
    const canvas = { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
    createContext(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
  });

  it("can preserve the drawing buffer, and passes null through", () => {
    const canvas = { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
    expect(createContext(canvas, true)).toBeNull();
    expect(canvas.getContext).toHaveBeenCalledWith(
      "webgl2",
      expect.objectContaining({ preserveDrawingBuffer: true }),
    );
  });
});
