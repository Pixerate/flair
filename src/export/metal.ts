/**
 * Automated GLSL → Metal Shading Language (MSL) compiler and Swift package
 * generator (`FlairEffects`).
 *
 * Wraps Flair's Shadertoy-style `mainImage(out vec4, in vec2)` fragment
 * shaders into Vulkan GLSL 450 with an explicit `std140` uniform block
 * (`FlairUniforms` at `[[buffer(0)]]`) and explicit sampler bindings
 * (`[[texture(1)]]`, `[[sampler(1)]]`, …), compiles them to SPIR-V with
 * `glslangValidator`, cross-compiles to MSL with `spirv-cross`, and generates
 * the `FlairEffects` Swift package (`swift/Package.swift`).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { effectControls, SHADER_EFFECTS } from "../catalog/index.js";
import { SAMPLE_IMAGES } from "../catalog/images.js";
import { isTextImage } from "../catalog/inputs.js";
import type { ShaderEffect } from "../catalog/types.js";
import { MAX_CLICKS, MAX_TRAIL } from "../shader/pointer.js";
import { SPECTRUM_BINS } from "../shader/audio.js";
import {
  controlValue,
  parseControls,
  type ControlDef,
  type ControlType,
  type ControlValue,
  type TextureSettings,
} from "../shader/controls.js";
import type { CompileError, FrameState } from "../shader/program.js";
import type { PathFit } from "../shader/path.js";

/** Fixed byte length of Flair's built-in uniform prefix in `FlairUniforms` (`std140`, 62 × 16 bytes). */
export const FLAIR_METAL_BUILTIN_BYTE_LENGTH = 992;

/**
 * Built-in phase classification for a shader effect in the Metal pipeline:
 * - `1`: Single-pass procedural shader (no texture samplers or interactive/audio built-ins).
 * - `2`: Uses `sampler2D` or `path` texture inputs (`[[texture(N)]]`, `[[sampler(N)]]`).
 * - `3`: Multi-pass pipeline / feedback (`FlairPipeline`).
 * - `4`: Uses audio (`iAudio`, `iSpectrum`, `iBeat`), rich pointer (`iPointer`, `iClicks`, `iTrail`) or scroll (`iScroll`) built-ins.
 */
export type MetalEffectPhase = 1 | 2 | 3 | 4;

/** One scalar or vector control field in the `FlairUniforms` `std140` buffer. */
export interface MetalUniformField {
  /** GLSL uniform name (e.g. `"uSpeed"`). */
  name: string;
  /** Swift property name on the generated effect struct (e.g. `"speed"`). */
  property: string;
  /** Control type (`float`, `int`, `bool`, `vec2`, `vec3`, `vec4`). */
  type: Exclude<ControlType, "sampler2D" | "text" | "path">;
  /** Byte offset in `FlairUniforms` (`>= FLAIR_METAL_BUILTIN_BYTE_LENGTH`). */
  offset: number;
  /** Byte size of the value in `std140` (`4`, `8`, `12`, or `16`). */
  size: number;
  /** Byte alignment in `std140` (`4`, `8`, or `16`). */
  align: number;
}

/** One texture or path sampler bound outside the uniform buffer. */
export interface MetalSamplerField {
  /** GLSL uniform name (e.g. `"uTexture"` or `"uPath"`). */
  name: string;
  /** Swift property name on the generated effect struct (e.g. `"texture"` or `"path"`). */
  property: string;
  /** `"sampler2D"` for images/masks/text, or `"path"` for packed SVG paths. */
  type: "sampler2D" | "path";
  /** Metal `[[texture(N)]]` and `[[sampler(N)]]` index (`1, 2, …`). */
  binding: number;
  /** Texture filter mode (`"nearest"` for path textures). */
  filter: TextureSettings["filter"];
  /** Texture wrap mode (`"clamp"` for path textures). */
  wrap: TextureSettings["wrap"];
  /** Path fitting mode when `type === "path"`. */
  pathFit?: PathFit;
  /** Path margin when `type === "path"`. */
  pathMargin?: number;
}

/** Deterministic `std140` buffer layout and sampler bindings for a shader's controls. */
export interface MetalUniformLayout {
  /** Total byte size of `FlairUniforms`, rounded up to a 16-byte multiple (`>= 992`). */
  byteLength: number;
  /** Scalar and vector control fields in declaration order. */
  fields: MetalUniformField[];
  /** Texture and path sampler bindings (`binding = 1, 2, …`) in declaration order. */
  samplers: MetalSamplerField[];
}

/** Frame state for packing `FlairUniforms` bytes, with optional `flipY` (defaults to `true`). */
export interface MetalFrameState extends Partial<FrameState> {
  /**
   * Whether to flip `gl_FragCoord.y` so `fragCoord.y = 0` is at the bottom of
   * a top-left Metal drawable/texture. Defaults to `true` for final views and
   * `CGImage` renders; set `false` for intermediate multi-pass textures.
   */
  flipY?: boolean;
}

/** Availability of the external command-line tools used by the Metal pipeline. */
export interface MetalToolchainStatus {
  /** True when both `glslangValidator` and `spirv-cross` were found. */
  ok: boolean;
  /** Resolved path to `glslangValidator`, or `null`. */
  glslang: string | null;
  /** Resolved path to `spirv-cross`, or `null`. */
  spirvCross: string | null;
  /** Resolved path to `xcrun metal` (macOS only), or `null`. */
  xcrunMetal: string | null;
  /** Actionable installation hint when `ok` is `false`. */
  message?: string;
}

/** Options for compiling a single GLSL fragment shader to Metal Shading Language. */
export interface CompileMetalOptions {
  /** Effect identifier (used to name the MSL entry point `flair_<id>_frag`). Defaults to `"shader"`. */
  id?: string;
  /** Parsed controls (if omitted, parsed from `source`). */
  controls?: ControlDef[];
  /** Also verify the generated MSL with `xcrun metal -c` when available on macOS. */
  verify?: boolean;
}

/** Result of compiling a single shader to Metal Shading Language. */
export type CompileMetalResult =
  | {
      ok: true;
      /** Generated Metal Shading Language (`.metal`) source. */
      msl: string;
      /** Unique fragment entry-point name (e.g. `"flair_mesh_gradient_frag"`). */
      functionName: string;
      /** Deterministic uniform buffer and sampler binding layout. */
      layout: MetalUniformLayout;
      /** Effect phase (1, 2, or 4). */
      phase: MetalEffectPhase;
    }
  | {
      ok: false;
      /** Line-mapped diagnostics in the original GLSL source (`#line 1` convention). */
      errors: CompileError[];
    };

/** Per-effect status entry in a {@link MetalExportReport}. */
export interface MetalEffectReport {
  id: string;
  name: string;
  category: string;
  swiftType: string;
  functionName: string;
  phase: MetalEffectPhase;
  ok: boolean;
  uniformByteLength: number;
  samplers: number;
  presets: number;
  errors?: CompileError[];
}

/** Summary returned by {@link exportMetalPackage}. */
export interface MetalExportReport {
  ok: boolean;
  outDir: string;
  total: number;
  compiled: number;
  failed: number;
  verifiedWithXcrun: boolean;
  phases: Record<MetalEffectPhase, number>;
  effects: MetalEffectReport[];
}

/** Options for {@link exportMetalPackage}. */
export interface ExportMetalPackageOptions {
  /** Output directory for the Swift package (defaults to `<repo>/swift`). */
  outDir?: string;
  /** Optional subset of shader effect IDs to compile (when omitted, compiles all catalog shader effects). */
  only?: readonly string[];
  /** Verify generated `.metal` shaders with `xcrun metal` when available on macOS. */
  verify?: boolean;
  /** Write generated files to disk (defaults to `true`; set `false` for a dry-run compile check). */
  write?: boolean;
}

const EXTRA_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

function findExecutable(envVar: string, names: readonly string[]): string | null {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const pathDirs = (process.env.PATH ?? "")
    .split(":")
    .map((d) => d.trim())
    .filter(Boolean);
  const dirs = [...pathDirs, ...EXTRA_BIN_DIRS.filter((d) => !pathDirs.includes(d))];
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Resolved path to `glslangValidator` (from `GLSLANG_PATH`, `PATH`, `/opt/homebrew/bin` or `/usr/local/bin`), or `null`. */
export function glslangPath(): string | null {
  return findExecutable("GLSLANG_PATH", ["glslangValidator", "glslang"]);
}

/** Resolved path to `spirv-cross` (from `SPIRV_CROSS_PATH`, `PATH`, `/opt/homebrew/bin` or `/usr/local/bin`), or `null`. */
export function spirvCrossPath(): string | null {
  return findExecutable("SPIRV_CROSS_PATH", ["spirv-cross"]);
}

let cachedXcrunMetal: string | null | undefined;

/** Resolved path to Apple's `metal` compiler via `xcrun -f metal`, or `null` when unavailable. */
export function xcrunMetalPath(): string | null {
  if (cachedXcrunMetal !== undefined) return cachedXcrunMetal;
  if (process.platform !== "darwin") {
    cachedXcrunMetal = null;
    return null;
  }
  const res = spawnSync("xcrun", ["-f", "metal"], { encoding: "utf8" });
  cachedXcrunMetal = res.status === 0 && res.stdout.trim() ? res.stdout.trim() : null;
  return cachedXcrunMetal;
}

/** Checks whether `glslangValidator` and `spirv-cross` (and optionally `xcrun metal`) are installed. */
export function metalToolsAvailable(): MetalToolchainStatus {
  const glslang = glslangPath();
  const spirvCross = spirvCrossPath();
  const xcrunMetal = xcrunMetalPath();
  if (glslang && spirvCross) {
    return { ok: true, glslang, spirvCross, xcrunMetal };
  }
  const missing = [
    !glslang ? "glslangValidator (or set GLSLANG_PATH)" : null,
    !spirvCross ? "spirv-cross (or set SPIRV_CROSS_PATH)" : null,
  ].filter(Boolean);
  const installHint =
    process.platform === "darwin"
      ? "Install them with Homebrew: brew install glslang spirv-cross"
      : "Install them with your package manager (e.g. apt-get install glslang-tools spirv-cross) or brew install glslang spirv-cross";
  return {
    ok: false,
    glslang,
    spirvCross,
    xcrunMetal,
    message: `Missing required Metal shader tools: ${missing.join(", ")}. ${installHint}.`,
  };
}

/** Unique Metal fragment entry-point name for an effect ID: `"mesh-gradient"` → `"flair_mesh_gradient_frag"`. */
export function metalFunctionName(id: string): string {
  const snake = id
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `flair_${snake || "shader"}_frag`;
}

const SWIFT_RESERVED_TYPES = new Set([
  "FlairEffect",
  "AnyFlairEffect",
  "FlairCatalog",
  "FlairRenderer",
  "FlairPipeline",
  "FlairEffectView",
  "FlairPipelineView",
  "FlairFrameState",
  "FlairTextureInput",
  "Type",
  "Self",
  "Protocol",
  "Error",
  "String",
  "Float",
  "Int",
  "Bool",
]);

/** PascalCase Swift struct name for an effect ID: `"mesh-gradient"` → `"MeshGradient"`. */
export function swiftTypeName(id: string): string {
  const parts = id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const raw = parts.join("") || "ShaderEffect";
  const prefixed = /^\d/.test(raw) ? `Effect${raw}` : raw;
  return SWIFT_RESERVED_TYPES.has(prefixed) ? `${prefixed}Effect` : prefixed;
}

const SWIFT_KEYWORDS = new Set([
  "associatedtype",
  "break",
  "case",
  "catch",
  "class",
  "continue",
  "default",
  "defer",
  "deinit",
  "do",
  "else",
  "enum",
  "extension",
  "fallthrough",
  "false",
  "fileprivate",
  "for",
  "func",
  "guard",
  "if",
  "import",
  "in",
  "init",
  "inout",
  "internal",
  "is",
  "let",
  "nil",
  "open",
  "operator",
  "private",
  "precedencegroup",
  "protocol",
  "public",
  "repeat",
  "rethrows",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "subscript",
  "super",
  "switch",
  "throw",
  "throws",
  "true",
  "try",
  "typealias",
  "var",
  "where",
  "while",
  "Any",
  "Type",
]);

/** CamelCase Swift property name for a GLSL uniform: `"uFlowSpeed"` → `"flowSpeed"`, `"uBGColor"` → `"bgColor"`. */
export function swiftPropertyName(uniformName: string): string {
  const stripped = /^u[A-Z]/.test(uniformName) ? uniformName.slice(1) : uniformName;
  const camel = stripped.replace(/^[A-Z]+/, (caps) =>
    caps.length > 1 && caps.length < stripped.length
      ? caps.slice(0, -1).toLowerCase() + caps.slice(-1)
      : caps.toLowerCase(),
  );
  return /^\d/.test(camel) ? `_${camel}` : camel;
}

/** Escapes a Swift property name with backticks when it is a Swift keyword (e.g. `"case"` → ``"`case`"``). */
export function swiftIdentifier(name: string): string {
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/** Strips comments from GLSL source before scanning for built-in references. */
function stripGlslComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
}

/**
 * Classifies a shader effect into its Metal roadmap phase:
 * - Phase 4 when it reads audio (`iAudio`, `iSpectrum`, `iBeat`), rich pointer (`iPointer`, `iClicks`, `iTrail`) or scroll (`iScroll`).
 * - Phase 2 when it declares `sampler2D` or `path` controls.
 * - Phase 1 otherwise.
 */
export function effectMetalPhase(source: string, controls?: readonly ControlDef[]): MetalEffectPhase {
  const code = stripGlslComments(source);
  if (/\b(iAudio|iSpectrum|iBeat|iPointer|iClicks|iTrail|iScroll)\b/.test(code)) {
    return 4;
  }
  const list = controls ?? parseControls(source);
  if (list.some((c) => c.type === "sampler2D" || c.type === "path")) {
    return 2;
  }
  return 1;
}

function alignTo(offset: number, align: number): number {
  return Math.ceil(offset / align) * align;
}

function std140Metrics(type: Exclude<ControlType, "sampler2D" | "text" | "path">): { size: number; align: number } {
  switch (type) {
    case "float":
    case "int":
    case "bool":
      return { size: 4, align: 4 };
    case "vec2":
      return { size: 8, align: 8 };
    case "vec3":
      return { size: 12, align: 16 };
    case "vec4":
      return { size: 16, align: 16 };
  }
}

/**
 * Computes the deterministic `std140` uniform buffer layout and explicit
 * texture/sampler binding slots (`1, 2, …`) for a shader's controls.
 */
export function metalUniformLayout(controls: readonly ControlDef[]): MetalUniformLayout {
  const fields: MetalUniformField[] = [];
  const samplers: MetalSamplerField[] = [];
  let offset = FLAIR_METAL_BUILTIN_BYTE_LENGTH;
  let nextBinding = 1;
  const usedProps = new Set<string>();

  const uniqueProp = (rawName: string): string => {
    const base = swiftPropertyName(rawName);
    let candidate = base;
    let i = 2;
    while (usedProps.has(candidate)) {
      candidate = `${base}${i++}`;
    }
    usedProps.add(candidate);
    return candidate;
  };

  for (const control of controls) {
    if (control.type === "text") continue;
    const property = uniqueProp(control.name);
    if (control.type === "sampler2D") {
      samplers.push({
        name: control.name,
        property,
        type: "sampler2D",
        binding: nextBinding++,
        filter: control.texture?.filter ?? "mipmap",
        wrap: control.texture?.wrap ?? "repeat",
      });
      continue;
    }
    if (control.type === "path") {
      samplers.push({
        name: control.name,
        property,
        type: "path",
        binding: nextBinding++,
        filter: "nearest",
        wrap: "clamp",
        pathFit: control.path?.fit ?? "contain",
        pathMargin: control.path?.margin ?? 0.1,
      });
      continue;
    }
    const { size, align } = std140Metrics(control.type);
    offset = alignTo(offset, align);
    fields.push({
      name: control.name,
      property,
      type: control.type,
      offset,
      size,
      align,
    });
    offset += size;
  }

  const byteLength = Math.max(FLAIR_METAL_BUILTIN_BYTE_LENGTH, alignTo(offset, 16));
  return { byteLength, fields, samplers };
}

/**
 * Packs built-in uniforms and control values into a `Uint8Array` matching
 * `FlairUniforms`'s `std140` layout (`[[buffer(0)]]`).
 */
export function packMetalUniforms(
  controls: readonly ControlDef[],
  values?: Record<string, ControlValue>,
  state: MetalFrameState = {},
  layout: MetalUniformLayout = metalUniformLayout(controls),
): Uint8Array {
  const buffer = new ArrayBuffer(layout.byteLength);
  const view = new DataView(buffer);
  const f32 = new Float32Array(buffer);

  const width = state.width ?? 640;
  const height = state.height ?? 360;
  const time = state.time ?? 0;
  const delta = state.delta ?? 1 / 60;
  const frame = state.frame ?? 0;
  const beat = state.beat ?? 0;
  const flipY = state.flipY ?? true;
  const mouse = state.mouse ?? [0, 0, 0, 0];
  const pointer = state.pointer ?? [0, 0, 0, 0];
  const audio = state.audio ?? [0, 0, 0, 0];
  const scroll = state.scroll ?? [0, 0, 0, 0];

  // Offset 0: vec3 iResolution (0..11) + float iTime (12..15)
  view.setFloat32(0, width, true);
  view.setFloat32(4, height, true);
  view.setFloat32(8, 1, true);
  view.setFloat32(12, time, true);

  // Offset 16: float iTimeDelta (16) + int iFrame (20) + float iBeat (24) + float flair_flipY (28)
  view.setFloat32(16, delta, true);
  view.setInt32(20, Math.trunc(frame), true);
  view.setFloat32(24, beat, true);
  view.setFloat32(28, flipY ? 1 : 0, true);

  // Offset 32: vec4 iMouse
  for (let i = 0; i < 4; i++) view.setFloat32(32 + i * 4, mouse[i] ?? 0, true);
  // Offset 48: vec4 iPointer
  for (let i = 0; i < 4; i++) view.setFloat32(48 + i * 4, pointer[i] ?? 0, true);

  // Offset 64: vec4 iClicks[8] (128 bytes)
  if (state.clicks) {
    f32.set(state.clicks.subarray(0, MAX_CLICKS * 4), 64 / 4);
  }
  // Offset 192: vec4 iTrail[32] (512 bytes)
  if (state.trail) {
    f32.set(state.trail.subarray(0, MAX_TRAIL * 4), 192 / 4);
  }
  // Offset 704: vec4 iAudio
  for (let i = 0; i < 4; i++) view.setFloat32(704 + i * 4, audio[i] ?? 0, true);
  // Offset 720: vec4 iSpectrum[16] (256 bytes = 64 floats)
  if (state.spectrum) {
    f32.set(state.spectrum.subarray(0, SPECTRUM_BINS), 720 / 4);
  }
  // Offset 976: vec4 iScroll
  for (let i = 0; i < 4; i++) view.setFloat32(976 + i * 4, scroll[i] ?? 0, true);

  // Control fields starting at offset 992
  const byName = new Map(controls.map((c) => [c.name, c] as const));
  for (const field of layout.fields) {
    const control = byName.get(field.name);
    if (!control) continue;
    const val = controlValue(control, values);
    switch (field.type) {
      case "float":
        view.setFloat32(field.offset, typeof val === "number" ? val : Number(control.default) || 0, true);
        break;
      case "int":
        view.setInt32(field.offset, Math.round(typeof val === "number" ? val : Number(control.default) || 0), true);
        break;
      case "bool":
        view.setUint32(field.offset, val ? 1 : 0, true);
        break;
      case "vec2":
      case "vec3":
      case "vec4": {
        const arr = Array.isArray(val) ? val : (control.default as number[]);
        const count = field.type === "vec2" ? 2 : field.type === "vec3" ? 3 : 4;
        for (let i = 0; i < count; i++) {
          view.setFloat32(field.offset + i * 4, arr[i] ?? 0, true);
        }
        break;
      }
    }
  }

  return new Uint8Array(buffer);
}

const CONTROL_DECLARATION_LINE =
  /^(\s*)uniform\s+(float|int|bool|vec2|vec3|vec4|sampler2D)\s+([A-Za-z_]\w*)\s*;(\s*\/\/\s*@control\b.*)$/;

/**
 * Wraps a Shadertoy-style `mainImage` fragment shader into Vulkan GLSL 450
 * with a `std140` `FlairUniforms` block (`set = 0, binding = 0`) and explicit
 * sampler bindings (`set = 0, binding = 1, 2, …`).
 *
 * Line count and line numbers of `source` are strictly preserved via `#line 1`.
 */
export function wrapMetalSource(
  source: string,
  controls?: readonly ControlDef[],
): { glsl: string; layout: MetalUniformLayout; lineCount: number } {
  const parsedControls = controls ?? parseControls(source);
  const layout = metalUniformLayout(parsedControls);
  const controlNames = new Set(parsedControls.map((c) => c.name));

  const lines = source.split("\n");
  const transformedLines = lines.map((line) => {
    if (/^\s*#\s*version\b/.test(line)) {
      return `// ${line}`;
    }
    if (/^\s*precision\s+(lowp|mediump|highp)\s+(float|int|sampler2D)\s*;/.test(line)) {
      return `// ${line}`;
    }
    const m = CONTROL_DECLARATION_LINE.exec(line);
    if (m && controlNames.has(m[3]!)) {
      return `${m[1] ?? ""}${m[4]!.trimStart()}`;
    }
    return line;
  });

  const uniformFieldLines = layout.fields.map((f) => `  ${f.type} ${f.name};`);
  const samplerLines = layout.samplers.map(
    (s) => `layout(set = 0, binding = ${s.binding}) uniform sampler2D ${s.name};`,
  );

  const prelude = [
    "#version 450",
    "layout(location = 0) out vec4 flair_FragColor;",
    "layout(set = 0, binding = 0, std140) uniform FlairUniforms {",
    "  vec3 iResolution;",
    "  float iTime;",
    "  float iTimeDelta;",
    "  int iFrame;",
    "  float iBeat;",
    "  float flair_flipY;",
    "  vec4 iMouse;",
    "  vec4 iPointer;",
    `  vec4 iClicks[${MAX_CLICKS}];`,
    `  vec4 iTrail[${MAX_TRAIL}];`,
    "  vec4 iAudio;",
    `  vec4 iSpectrum[${SPECTRUM_BINS / 4}];`,
    "  vec4 iScroll;",
    ...uniformFieldLines,
    "};",
    ...samplerLines,
    "#line 1",
  ].join("\n");

  const epilogue = [
    "",
    `#line ${lines.length + 1}`,
    "void main() {",
    "  vec4 flair_color = vec4(0.0, 0.0, 0.0, 1.0);",
    "  vec2 flair_coord = vec2(gl_FragCoord.x, flair_flipY > 0.5 ? iResolution.y - gl_FragCoord.y : gl_FragCoord.y);",
    "  mainImage(flair_color, flair_coord);",
    "  flair_FragColor = flair_color;",
    "}",
  ].join("\n");

  return {
    glsl: `${prelude}\n${transformedLines.join("\n")}${epilogue}\n`,
    layout,
    lineCount: lines.length,
  };
}

/**
 * Parses `glslangValidator` output into line-numbered {@link CompileError}s
 * mapped back to the user/catalog source (`1..lineCount`, or `0` for whole-program errors).
 */
export function parseGlslangLog(log: string, lineCount?: number): CompileError[] {
  const errors: CompileError[] = [];
  for (const raw of log.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^ERROR:\s*(?:.+?):(\d+):\s*(.+)$/.exec(line);
    if (match) {
      const n = Number(match[1]);
      const mapped =
        lineCount !== undefined && (n < 1 || n > lineCount)
          ? 0
          : Math.max(0, n);
      errors.push({ line: mapped, message: match[2]!.trim() });
      continue;
    }
    const unnumbered = /^ERROR:\s*(.+)$/.exec(line);
    if (unnumbered && !/^\d+\s+compilation errors/i.test(unnumbered[1]!)) {
      errors.push({ line: 0, message: unnumbered[1]!.trim() });
    }
  }
  if (errors.length === 0 && log.trim()) {
    errors.push({ line: 0, message: log.trim() });
  }
  return errors;
}

/** Pragmas after the hash header of every generated `.metal` file (see `transpileToMetal`). */
const METAL_UNUSED_PRAGMAS = '#pragma clang diagnostic ignored "-Wunused-variable"\n#pragma clang diagnostic ignored "-Wunused-const-variable"\n';

/**
 * The `// flair-metal-hash: …` header line a shader's generated `.metal` file
 * starts with; a file without it is out of date (`flair export metal` rebuilds it).
 */
export function metalHashHeader(id: string, source: string, controls?: readonly ControlDef[]): string {
  const { glsl } = wrapMetalSource(source, controls);
  return `// flair-metal-hash: ${fnv1aHash(`${metalFunctionName(id)}\n${glsl}`)}`;
}

function fnv1aHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Compiles a Shadertoy-style `mainImage` GLSL source to Metal Shading Language
 * (`.metal`) using `glslangValidator` and `spirv-cross` (plus optional `xcrun metal` verification).
 */
export function compileShaderToMetal(source: string, options: CompileMetalOptions = {}): CompileMetalResult {
  const lineCount = source.split("\n").length;
  if (!/\bmainImage\s*\(/.test(source)) {
    return {
      ok: false,
      errors: [{ line: 0, message: "Define void mainImage(out vec4 fragColor, in vec2 fragCoord)." }],
    };
  }

  const tools = metalToolsAvailable();
  if (!tools.ok || !tools.glslang || !tools.spirvCross) {
    return {
      ok: false,
      errors: [{ line: 0, message: tools.message ?? "Missing glslangValidator or spirv-cross." }],
    };
  }

  const id = options.id ?? "shader";
  const controls = options.controls ?? parseControls(source);
  const functionName = metalFunctionName(id);
  const phase = effectMetalPhase(source, controls);
  const { glsl, layout } = wrapMetalSource(source, controls);
  const hashHeader = `// flair-metal-hash: ${fnv1aHash(`${functionName}\n${glsl}`)}\n`;

  const scratch = mkdtempSync(join(tmpdir(), "flair-metal-"));
  const fragPath = join(scratch, `${id}.frag`);
  const spvPath = join(scratch, `${id}.spv`);
  const metalPath = join(scratch, `${id}.metal`);
  const airPath = join(scratch, `${id}.air`);

  try {
    writeFileSync(fragPath, glsl, "utf8");
    const glslangRes = spawnSync(tools.glslang, ["-V", "-S", "frag", "-o", spvPath, fragPath], {
      encoding: "utf8",
    });
    if (glslangRes.status !== 0 || !existsSync(spvPath)) {
      const log = `${glslangRes.stdout ?? ""}\n${glslangRes.stderr ?? ""}`.trim();
      return { ok: false, errors: parseGlslangLog(log, lineCount) };
    }

    const spirvRes = spawnSync(
      tools.spirvCross,
      [
        spvPath,
        "--msl",
        "--msl-version",
        "20100",
        "--msl-decoration-binding",
        "--rename-entry-point",
        "main",
        functionName,
        "frag",
      ],
      { encoding: "utf8" },
    );
    if (spirvRes.status !== 0 || !spirvRes.stdout) {
      const msg = (spirvRes.stderr || spirvRes.stdout || "spirv-cross failed to generate Metal source.").trim();
      return { ok: false, errors: [{ line: 0, message: msg }] };
    }

    // spirv-cross inlines helpers and copies constant arrays, so an `out` argument a call site
    // ignores, or a constant it folded away, becomes an unused variable in the Metal although
    // the GLSL is clean. Silence just those two diagnostics in the generated file.
    const msl = `${hashHeader}${METAL_UNUSED_PRAGMAS}${spirvRes.stdout}`;
    if (options.verify && tools.xcrunMetal) {
      writeFileSync(metalPath, msl, "utf8");
      const metalRes = spawnSync(
        "xcrun",
        ["metal", "-std=macos-metal2.1", "-c", metalPath, "-o", airPath],
        { encoding: "utf8" },
      );
      if (metalRes.status !== 0) {
        const msg = (metalRes.stderr || metalRes.stdout || "xcrun metal failed to compile MSL.").trim();
        return { ok: false, errors: [{ line: 0, message: msg }] };
      }
    }

    return {
      ok: true,
      msl,
      functionName,
      layout,
      phase,
    };
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup errors.
    }
  }
}

import {
  FLAIR_EFFECT_SWIFT,
  FLAIR_RUNTIME_EFFECT_SWIFT,
  FLAIR_EFFECT_VIEW_SWIFT,
  FLAIR_INPUTS_SWIFT,
  FLAIR_PATH_AND_TEXT_SWIFT,
  FLAIR_PIPELINE_SWIFT,
  FLAIR_RENDERER_SWIFT,
  FLAIR_TESTS_SWIFT,
  FLAIR_TYPES_SWIFT,
  PACKAGE_SWIFT_TEMPLATE,
  VERTEX_METAL_TEMPLATE,
} from "./metal-swift-templates.js";

const SAMPLE_BY_URL = new Map<string, string>(
  Object.entries(SAMPLE_IMAGES).map(([name, url]) => [url, name]),
);

function swiftString(value: string): string {
  return (
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    '"'
  );
}

function swiftFloat(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  const rounded = Number(value.toFixed(6));
  if (Object.is(rounded, -0)) return "0.0";
  const str = String(rounded);
  return /^[+-]?\d+$/.test(str) ? `${str}.0` : str;
}

function swiftInt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value));
}

function extractTextImageContent(url: string): string {
  try {
    const encoded = url.slice(url.indexOf(",") + 1);
    const xml = decodeURIComponent(encoded);
    const match = /<text[^>]*>([\s\S]*?)<\/text>/.exec(xml);
    if (!match) return "FLAIR";
    return match[1]!
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  } catch {
    return "FLAIR";
  }
}

function swiftTextureExpr(control: ControlDef, rawValue: ControlValue): string {
  if (control.type === "path") {
    const fit = control.path?.fit ?? "contain";
    const margin = control.path?.margin ?? 0.1;
    if (Array.isArray(rawValue) && rawValue.length >= 2) {
      const pts: string[] = [];
      for (let i = 0; i + 1 < rawValue.length; i += 2) {
        pts.push(`flairVec2(${swiftFloat(Number(rawValue[i]) || 0)}, ${swiftFloat(Number(rawValue[i + 1]) || 0)})`);
      }
      return `.points([${pts.join(", ")}])`;
    }
    const str = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!str) return ".none";
    return `.path(${swiftString(str)}, fit: .${fit}, margin: ${swiftFloat(margin)})`;
  }
  const str = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!str) return ".none";
  const sample = SAMPLE_BY_URL.get(str);
  if (sample) return `.sample(.${sample})`;
  if (isTextImage(str)) return `.text(${swiftString(extractTextImageContent(str))})`;
  return `.url(${swiftString(str)})`;
}

function swiftValueExpr(control: ControlDef, rawValue: ControlValue | undefined): string {
  const val = rawValue !== undefined ? controlValue(control, { [control.name]: rawValue }) : control.default;
  switch (control.type) {
    case "float":
      return swiftFloat(typeof val === "number" ? val : Number(control.default) || 0);
    case "int":
      return swiftInt(typeof val === "number" ? val : Number(control.default) || 0);
    case "bool":
      return val ? "true" : "false";
    case "vec2": {
      const a = Array.isArray(val) ? val : [0, 0];
      return `flairVec2(${swiftFloat(a[0] ?? 0)}, ${swiftFloat(a[1] ?? 0)})`;
    }
    case "vec3": {
      const a = Array.isArray(val) ? val : [0, 0, 0];
      return `flairVec3(${swiftFloat(a[0] ?? 0)}, ${swiftFloat(a[1] ?? 0)}, ${swiftFloat(a[2] ?? 0)})`;
    }
    case "vec4": {
      const a = Array.isArray(val) ? val : [0, 0, 0, 1];
      return `flairVec4(${swiftFloat(a[0] ?? 0)}, ${swiftFloat(a[1] ?? 0)}, ${swiftFloat(a[2] ?? 0)}, ${swiftFloat(a[3] ?? 1)})`;
    }
    case "sampler2D":
    case "path":
      return swiftTextureExpr(control, val);
    case "text":
      return swiftString(String(val ?? ""));
  }
}

function swiftTypeForControl(type: ControlType): string {
  switch (type) {
    case "float":
      return "Float";
    case "int":
      return "Int32";
    case "bool":
      return "Bool";
    case "vec2":
      return "SIMD2<Float>";
    case "vec3":
      return "SIMD3<Float>";
    case "vec4":
      return "SIMD4<Float>";
    case "sampler2D":
    case "path":
      return "FlairTextureInput";
    case "text":
      return "String";
  }
}

/** Generates the typed Swift struct for a single {@link ShaderEffect}. */
export function generateSwiftEffectStruct(
  effect: ShaderEffect,
  controls: readonly ControlDef[] = effectControls(effect),
  layout: MetalUniformLayout = metalUniformLayout(controls),
): string {
  const structName = swiftTypeName(effect.id);
  const fnName = metalFunctionName(effect.id);
  const phase = effectMetalPhase(effect.source, controls);
  const byName = new Map(controls.map((c) => [c.name, c] as const));

  const propByUniform = new Map<string, string>();
  for (const f of layout.fields) propByUniform.set(f.name, f.property);
  for (const s of layout.samplers) propByUniform.set(s.name, s.property);

  const activeControls = controls.filter((c) => propByUniform.has(c.name));

  const controlDescriptorLines = activeControls.map((c) => {
    const prop = propByUniform.get(c.name)!;
    const args: string[] = [
      `name: ${swiftString(c.name)}`,
      `property: ${swiftString(prop)}`,
      `type: .${c.type}`,
      `label: ${swiftString(c.label)}`,
    ];
    if (c.color) args.push("isColor: true");
    args.push(`min: ${swiftFloat(c.min)}`);
    args.push(`max: ${swiftFloat(c.max)}`);
    args.push(`step: ${swiftFloat(c.step)}`);
    if (c.unit) args.push(`unit: ${swiftString(c.unit)}`);
    if (c.texture) {
      args.push(`filter: .${c.texture.filter}`);
      args.push(`wrap: .${c.texture.wrap}`);
    }
    if (c.path) {
      args.push(`pathFit: .${c.path.fit}`);
      args.push(`pathMargin: ${swiftFloat(c.path.margin)}`);
    }
    return `        FlairControlDescriptor(${args.join(", ")}),`;
  });

  const samplerBindingLines = layout.samplers.map((s) => {
    const args: string[] = [
      `name: ${swiftString(s.name)}`,
      `property: ${swiftString(s.property)}`,
      `type: .${s.type}`,
      `binding: ${s.binding}`,
      `filter: .${s.filter}`,
      `wrap: .${s.wrap}`,
    ];
    if (s.pathFit) args.push(`pathFit: .${s.pathFit}`);
    if (s.pathMargin !== undefined) args.push(`pathMargin: ${swiftFloat(s.pathMargin)}`);
    return `        FlairSamplerBinding(${args.join(", ")}),`;
  });

  const propertyLines = activeControls.map((c) => {
    const prop = propByUniform.get(c.name)!;
    const ident = swiftIdentifier(prop);
    const sType = swiftTypeForControl(c.type);
    const defExpr = swiftValueExpr(c, undefined);
    return `    /// ${c.label} (\`${c.name}\`).\n    public var ${ident}: ${sType} = ${defExpr}`;
  });

  const presetLines = (effect.presets ?? []).map((p) => {
    const assigns: string[] = [];
    for (const c of activeControls) {
      if (Object.prototype.hasOwnProperty.call(p.values, c.name)) {
        const prop = propByUniform.get(c.name)!;
        const ident = swiftIdentifier(prop);
        assigns.push(`p.${ident} = ${swiftValueExpr(c, p.values[c.name])}`);
      }
    }
    const body = assigns.length ? `${assigns.join("; ")}; ` : "";
    return `        do { var p = ${structName}(); ${body}map[${swiftString(p.name)}] = p }`;
  });

  const encodeFieldLines = layout.fields.map((f) => {
    const c = byName.get(f.name)!;
    const ident = swiftIdentifier(f.property);
    const minArg = c.limits?.min !== undefined ? `min: ${f.type === "int" ? swiftInt(c.limits.min) : swiftFloat(c.limits.min)}` : null;
    const maxArg = c.limits?.max !== undefined ? `max: ${f.type === "int" ? swiftInt(c.limits.max) : swiftFloat(c.limits.max)}` : null;
    const boundsArgs = [minArg, maxArg].filter(Boolean).join(", ");

    switch (f.type) {
      case "float": {
        const vExpr = boundsArgs ? `FlairUniformEncoder.clampFloat(${ident}, ${boundsArgs})` : ident;
        return `        FlairUniformEncoder.writeFloat(${vExpr}, to: buffer, at: ${f.offset})`;
      }
      case "int": {
        const vExpr = boundsArgs ? `FlairUniformEncoder.clampInt(${ident}, ${boundsArgs})` : ident;
        return `        FlairUniformEncoder.writeInt(${vExpr}, to: buffer, at: ${f.offset})`;
      }
      case "bool":
        return `        FlairUniformEncoder.writeBool(${ident}, to: buffer, at: ${f.offset})`;
      case "vec2": {
        const vExpr = boundsArgs ? `FlairUniformEncoder.clampVec2(${ident}, ${boundsArgs})` : ident;
        return `        FlairUniformEncoder.writeVec2(${vExpr}, to: buffer, at: ${f.offset})`;
      }
      case "vec3": {
        const vExpr = c.color
          ? `FlairUniformEncoder.clampVec3(${ident}, min: 0.0, max: 1.0)`
          : boundsArgs
            ? `FlairUniformEncoder.clampVec3(${ident}, ${boundsArgs})`
            : ident;
        return `        FlairUniformEncoder.writeVec3(${vExpr}, to: buffer, at: ${f.offset})`;
      }
      case "vec4": {
        const vExpr = c.color
          ? `FlairUniformEncoder.clampVec4(${ident}, min: 0.0, max: 1.0)`
          : boundsArgs
            ? `FlairUniformEncoder.clampVec4(${ident}, ${boundsArgs})`
            : ident;
        return `        FlairUniformEncoder.writeVec4(${vExpr}, to: buffer, at: ${f.offset})`;
      }
    }
  });

  const decodeLines = activeControls.map((c) => {
    const prop = propByUniform.get(c.name)!;
    const ident = swiftIdentifier(prop);
    const defExpr = swiftValueExpr(c, undefined);
    const uStr = swiftString(c.name);
    const pStr = swiftString(prop);
    const minFloat = c.limits?.min !== undefined ? `, min: ${swiftFloat(c.limits.min)}` : "";
    const maxFloat = c.limits?.max !== undefined ? `, max: ${swiftFloat(c.limits.max)}` : "";
    const minInt = c.limits?.min !== undefined ? `, min: ${swiftInt(c.limits.min)}` : "";
    const maxInt = c.limits?.max !== undefined ? `, max: ${swiftInt(c.limits.max)}` : "";

    switch (c.type) {
      case "float":
        return `        self.${ident} = bag.decodeFloat(${uStr}, ${pStr}, default: ${defExpr}${minFloat}${maxFloat})`;
      case "int":
        return `        self.${ident} = bag.decodeInt(${uStr}, ${pStr}, default: ${defExpr}${minInt}${maxInt})`;
      case "bool":
        return `        self.${ident} = bag.decodeBool(${uStr}, ${pStr}, default: ${defExpr})`;
      case "vec2":
        return `        self.${ident} = bag.decodeVec2(${uStr}, ${pStr}, default: ${defExpr}${minFloat}${maxFloat})`;
      case "vec3":
        return `        self.${ident} = bag.decodeVec3(${uStr}, ${pStr}, default: ${defExpr}, isColor: ${c.color ? "true" : "false"}${minFloat}${maxFloat})`;
      case "vec4":
        return `        self.${ident} = bag.decodeVec4(${uStr}, ${pStr}, default: ${defExpr}, isColor: ${c.color ? "true" : "false"}${minFloat}${maxFloat})`;
      case "sampler2D":
      case "path": {
        const fit = c.path?.fit ?? "contain";
        const margin = c.path?.margin ?? 0.1;
        return `        self.${ident} = bag.decodeTexture(${uStr}, ${pStr}, default: ${defExpr}, fit: .${fit}, margin: ${swiftFloat(margin)})`;
      }
      case "text":
        return "";
    }
  });

  const encodeJsonLines = activeControls.map((c) => {
    const prop = propByUniform.get(c.name)!;
    const ident = swiftIdentifier(prop);
    const uStr = swiftString(c.name);
    switch (c.type) {
      case "float":
        return `        bag.encodeFloat(self.${ident}, for: ${uStr})`;
      case "int":
        return `        bag.encodeInt(self.${ident}, for: ${uStr})`;
      case "bool":
        return `        bag.encodeBool(self.${ident}, for: ${uStr})`;
      case "vec2":
        return `        bag.encodeVec2(self.${ident}, for: ${uStr})`;
      case "vec3":
        return `        bag.encodeVec3(self.${ident}, for: ${uStr})`;
      case "vec4":
        return `        bag.encodeVec4(self.${ident}, for: ${uStr})`;
      case "sampler2D":
      case "path":
        return `        bag.encodeTexture(self.${ident}, for: ${uStr})`;
      case "text":
        return "";
    }
  });

  const textureMethods =
    layout.samplers.length === 0
      ? []
      : [
          "    public func textureInput(for binding: Int) -> FlairTextureInput {",
          "        switch binding {",
          ...layout.samplers.map(
            (s) => `        case ${s.binding}: return self.${swiftIdentifier(s.property)}`,
          ),
          "        default: return .none",
          "        }",
          "    }",
          "",
          "    public mutating func setTextureInput(_ input: FlairTextureInput, for binding: Int) {",
          "        switch binding {",
          ...layout.samplers.map(
            (s) => `        case ${s.binding}: self.${swiftIdentifier(s.property)} = input`,
          ),
          "        default: break",
          "        }",
          "    }",
        ];

  return [
    `/// **${effect.name}** (\`${effect.id}\`, category: \`${effect.category}\`).`,
    `/// ${effect.description}`,
    `public struct ${structName}: FlairEffect, Codable, Sendable, Equatable {`,
    `    public static let effectId = ${swiftString(effect.id)}`,
    `    public static let effectName = ${swiftString(effect.name)}`,
    `    public static let category = ${swiftString(effect.category)}`,
    `    public static let effectDescription = ${swiftString(effect.description)}`,
    `    public static let tags: [String] = [${effect.tags.map(swiftString).join(", ")}]`,
    `    public static let phase: Int = ${phase}`,
    `    public static let functionName = ${swiftString(fnName)}`,
    `    public static let uniformByteLength: Int = ${layout.byteLength}`,
    `    public static let isTransparent: Bool = ${effect.transparent ? "true" : "false"}`,
    `    public static let loopDuration: Double? = ${effect.loop !== undefined ? swiftFloat(effect.loop) : "nil"}`,
    `    public static let controls: [FlairControlDescriptor] = [`,
    ...controlDescriptorLines,
    `    ]`,
    ...(layout.samplers.length > 0
      ? [
          `    public static let samplerBindings: [FlairSamplerBinding] = [`,
          ...samplerBindingLines,
          `    ]`,
        ]
      : []),
    ...(presetLines.length === 0
      ? [`    public static let presets: [String: ${structName}] = [:]`]
      : [
          `    public static let presets: [String: ${structName}] = {`,
          `        var map: [String: ${structName}] = [:]`,
          ...presetLines,
          `        return map`,
          `    }()`,
        ]),
    ...(propertyLines.length > 0 ? ["", ...propertyLines] : []),
    "",
    `    public init() {}`,
    "",
    `    public func encodeUniforms(into buffer: UnsafeMutableRawPointer, state: FlairFrameState) {`,
    `        state.encodeBuiltins(into: buffer)`,
    ...encodeFieldLines,
    `    }`,
    ...(textureMethods.length > 0 ? ["", ...textureMethods] : []),
    "",
    `    public init(from decoder: Decoder) throws {`,
    `        let bag = try FlairJSONBag(from: decoder)`,
    ...decodeLines.filter(Boolean),
    `    }`,
    "",
    `    public func encode(to encoder: Encoder) throws {`,
    `        var bag = FlairJSONBag()`,
    ...encodeJsonLines.filter(Boolean),
    `        try bag.encode(to: encoder)`,
    `    }`,
    `}`,
  ].join("\n");
}

/** Generates the `FlairCatalog` lookup registry in Swift. */
function generateSwiftCatalogRegistry(effects: readonly ShaderEffect[]): string {
  const entries = effects.map((e) => `        AnyFlairEffect(${swiftTypeName(e.id)}()),`);
  return [
    "// GENERATED BY `@pixerate/flair` (`flair export metal`) — DO NOT EDIT BY HAND.",
    "import Foundation",
    "import simd",
    "",
    "/// Registry of all Flair shader effects compiled for Metal.",
    "public enum FlairCatalog {",
    "    /// Every compiled shader effect in catalog order.",
    "    public static let all: [AnyFlairEffect] = [",
    ...entries,
    "    ]",
    "",
    "    private static let byId: [String: AnyFlairEffect] = {",
    "        var map: [String: AnyFlairEffect] = [:]",
    "        map.reserveCapacity(all.count)",
    "        for item in all { map[item.effectId] = item }",
    "        return map",
    "    }()",
    "",
    "    /// Looks up a catalog effect by its ID (e.g. `\"mesh-gradient\"`), or `nil`.",
    "    public static func effect(id: String) -> AnyFlairEffect? {",
    "        byId[id]",
    "    }",
    "",
    "    /// Looks up a catalog effect by its ID and applies a named preset.",
    "    public static func effect(id: String, preset: String) -> AnyFlairEffect? {",
    "        byId[id]?.withPreset(preset)",
    "    }",
    "",
    "    /// Returns all effects in `category` (case-insensitive).",
    "    public static func effects(inCategory category: String) -> [AnyFlairEffect] {",
    "        let lower = category.lowercased()",
    "        return all.filter { $0.category.lowercased() == lower }",
    "    }",
    "",
    "    /// Returns all effects carrying `tag` (case-insensitive).",
    "    public static func effects(withTag tag: String) -> [AnyFlairEffect] {",
    "        let lower = tag.lowercased()",
    "        return all.filter { $0.tags.contains { $0.lowercased() == lower } }",
    "    }",
    "}",
  ].join("\n");
}

function writeIfChanged(filePath: string, content: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf8");
    if (existing === content) return;
  }
  writeFileSync(filePath, content, "utf8");
}

/**
 * Compiles catalog shader effects to Metal Shading Language (`.metal`),
 * generates typed Swift models and the `FlairEffects` Swift package (`Package.swift`),
 * and returns a {@link MetalExportReport}.
 */
export function exportMetalPackage(options: ExportMetalPackageOptions = {}): MetalExportReport {
  const outDir = resolve(options.outDir ?? "swift");
  const write = options.write ?? true;
  const verify = options.verify ?? false;

  const onlySet =
    options.only && options.only.length > 0
      ? new Set(options.only.map((id) => id.trim()).filter(Boolean))
      : null;

  if (onlySet) {
    const known = new Set(SHADER_EFFECTS.map((e) => e.id));
    const unknown = [...onlySet].filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new Error(
        `There is no shader effect ${unknown.map((id) => `"${id}"`).join(", ")}; \`flair effects --kind shader\` lists the ${known.size} shader effect ids.`,
      );
    }
  }

  const tools = metalToolsAvailable();
  if (!tools.ok) {
    throw new Error(tools.message ?? "Missing glslangValidator or spirv-cross.");
  }

  const shadersDir = join(outDir, "Sources", "FlairEffects", "Shaders");
  const generatedDir = join(outDir, "Sources", "FlairEffects", "Generated");
  const sourcesDir = join(outDir, "Sources", "FlairEffects");
  const testsDir = join(outDir, "Tests", "FlairEffectsTests");

  if (write) {
    mkdirSync(shadersDir, { recursive: true });
    mkdirSync(generatedDir, { recursive: true });
    mkdirSync(testsDir, { recursive: true });

    writeIfChanged(join(outDir, "Package.swift"), PACKAGE_SWIFT_TEMPLATE);
    writeIfChanged(join(shadersDir, "_FlairVertex.metal"), VERTEX_METAL_TEMPLATE);
    writeIfChanged(join(sourcesDir, "FlairTypes.swift"), FLAIR_TYPES_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairEffect.swift"), FLAIR_EFFECT_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairRuntimeEffect.swift"), FLAIR_RUNTIME_EFFECT_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairPathAndText.swift"), FLAIR_PATH_AND_TEXT_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairInputs.swift"), FLAIR_INPUTS_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairRenderer.swift"), FLAIR_RENDERER_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairPipeline.swift"), FLAIR_PIPELINE_SWIFT);
    writeIfChanged(join(sourcesDir, "FlairEffectView.swift"), FLAIR_EFFECT_VIEW_SWIFT);
    if (!onlySet) {
      writeIfChanged(join(testsDir, "FlairEffectsTests.swift"), FLAIR_TESTS_SWIFT);
    }
  }

  const reports: MetalEffectReport[] = [];
  const phases: Record<MetalEffectPhase, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const compiledEffects: ShaderEffect[] = [];
  const structChunks: string[] = [];

  for (const effect of SHADER_EFFECTS) {
    const controls = effectControls(effect);
    const phase = effectMetalPhase(effect.source, controls);
    const functionName = metalFunctionName(effect.id);
    const { glsl, layout } = wrapMetalSource(effect.source, controls);
    const swiftType = swiftTypeName(effect.id);
    const expectedHash = `// flair-metal-hash: ${fnv1aHash(`${functionName}\n${glsl}`)}\n`;
    const targetMetalPath = join(shadersDir, `${effect.id}.metal`);
    const existing = existsSync(targetMetalPath) ? readFileSync(targetMetalPath, "utf8") : null;

    // With `only`, the other effects keep their committed shaders, so the
    // generated Swift registry and structs still cover the whole package.
    if (onlySet && !onlySet.has(effect.id)) {
      if (existing !== null) {
        compiledEffects.push(effect);
        structChunks.push(generateSwiftEffectStruct(effect, controls, layout));
      }
      continue;
    }

    const cachedMsl = !verify && existing?.startsWith(expectedHash) ? existing : null;

    const res: CompileMetalResult = cachedMsl
      ? { ok: true, msl: cachedMsl, functionName, layout, phase }
      : compileShaderToMetal(effect.source, {
          id: effect.id,
          controls,
          verify,
        });

    if (res.ok) {
      phases[phase] += 1;
      compiledEffects.push(effect);
      if (write) {
        writeIfChanged(join(shadersDir, `${effect.id}.metal`), res.msl);
      }
      structChunks.push(generateSwiftEffectStruct(effect, controls, layout));
      reports.push({
        id: effect.id,
        name: effect.name,
        category: effect.category,
        swiftType,
        functionName,
        phase,
        ok: true,
        uniformByteLength: layout.byteLength,
        samplers: layout.samplers.length,
        presets: (effect.presets ?? []).length,
      });
    } else {
      reports.push({
        id: effect.id,
        name: effect.name,
        category: effect.category,
        swiftType,
        functionName,
        phase,
        ok: false,
        uniformByteLength: layout.byteLength,
        samplers: layout.samplers.length,
        presets: (effect.presets ?? []).length,
        errors: res.errors,
      });
    }
  }

  if (write) {
    // Clean up any stale .metal files when doing a full catalog export.
    if (!onlySet && existsSync(shadersDir)) {
      const expectedMetal = new Set([
        "_FlairVertex.metal",
        ...compiledEffects.map((e) => `${e.id}.metal`),
      ]);
      for (const file of readdirSync(shadersDir)) {
        if (file.endsWith(".metal") && !expectedMetal.has(file)) {
          unlinkSync(join(shadersDir, file));
        }
      }
    }

    const catalogFileContent = `${generateSwiftCatalogRegistry(compiledEffects)}\n`;
    writeIfChanged(join(generatedDir, "FlairEffectsCatalog.swift"), catalogFileContent);

    const chunkSize = 50;
    const expectedSwiftFiles = new Set<string>(["FlairEffectsCatalog.swift"]);
    for (let i = 0; i < structChunks.length; i += chunkSize) {
      const partIndex = Math.floor(i / chunkSize) + 1;
      const fileName = `FlairEffectsPart${partIndex}.swift`;
      expectedSwiftFiles.add(fileName);
      const partContent = [
        "// GENERATED BY `@pixerate/flair` (`flair export metal`) — DO NOT EDIT BY HAND.",
        "import Foundation",
        "import simd",
        "",
        ...structChunks.slice(i, i + chunkSize),
        "",
      ].join("\n\n");
      writeIfChanged(join(generatedDir, fileName), partContent);
    }

    if (!onlySet && existsSync(generatedDir)) {
      for (const file of readdirSync(generatedDir)) {
        if (file.endsWith(".swift") && !expectedSwiftFiles.has(file)) {
          unlinkSync(join(generatedDir, file));
        }
      }
    }
  }

  const compiled = reports.filter((r) => r.ok).length;
  const failed = reports.length - compiled;

  return {
    ok: failed === 0,
    outDir,
    total: reports.length,
    compiled,
    failed,
    verifiedWithXcrun: Boolean(verify && tools.xcrunMetal),
    phases,
    effects: reports,
  };
}
