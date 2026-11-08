import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { effectControls, EFFECTS, findEffects, getEffect, SHADER_EFFECTS } from "../catalog/index.js";
import { metaOf } from "../catalog/meta.js";
import { createEffectToolRegistry, EffectEditor } from "../editor/index.js";
import { parseControls } from "../shader/controls.js";
import { effectQueryFromFlags } from "./effect.js";
import {
  compileShaderToMetal,
  effectMetalPhase,
  exportMetalPackage,
  FLAIR_METAL_BUILTIN_BYTE_LENGTH,
  generateSwiftEffectStruct,
  metalFunctionName,
  metalHashHeader,
  metalToolsAvailable,
  metalUniformLayout,
  packMetalUniforms,
  parseGlslangLog,
  swiftIdentifier,
  swiftPropertyName,
  swiftTypeName,
  wrapMetalSource,
} from "./metal.js";

describe("GLSL → Metal pipeline & Swift package generator", () => {
  it("maps effect IDs and uniform names to Metal and Swift identifiers", () => {
    expect(metalFunctionName("mesh-gradient")).toBe("flair_mesh_gradient_frag");
    expect(metalFunctionName("3d-cube")).toBe("flair_3d_cube_frag");
    expect(swiftTypeName("mesh-gradient")).toBe("MeshGradient");
    expect(swiftTypeName("crt")).toBe("Crt");
    expect(swiftPropertyName("uSpeed")).toBe("speed");
    expect(swiftPropertyName("uBGColor")).toBe("bgColor");
    expect(swiftPropertyName("uUV")).toBe("uv");
    expect(swiftPropertyName("uCase")).toBe("case");
    expect(swiftIdentifier("case")).toBe("`case`");
    expect(swiftIdentifier("speed")).toBe("speed");
  });

  it("classifies shader effects into phases 1, 2, and 4", () => {
    const phase1 = `
      uniform float uSpeed; // @control min=0 max=4 default=1
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        // iAudio in a comment does not make it phase 4
        fragColor = vec4(sin(iTime * uSpeed));
      }
    `;
    expect(effectMetalPhase(phase1)).toBe(1);

    const phase2 = `
      uniform sampler2D uTex; // @control filter=linear wrap=clamp
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = texture(uTex, fragCoord / iResolution.xy);
      }
    `;
    expect(effectMetalPhase(phase2)).toBe(2);

    const phase4 = `
      uniform sampler2D uTex; // @control
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = texture(uTex, fragCoord / iResolution.xy) * iAudio.x + iPointer.z;
      }
    `;
    expect(effectMetalPhase(phase4)).toBe(4);
  });

  it("computes std140 uniform layout and packs builtin + control bytes accurately", () => {
    const src = [
      "uniform float uSpeed; // @control min=0 max=4 default=1.5",
      "uniform vec3 uColor; // @control color default=#ff0080",
      "uniform bool uInvert; // @control default=true",
      "uniform int uSteps; // @control min=1 max=16 default=4",
      "uniform vec2 uOffset; // @control min=-1 max=1 default=0.25,-0.5",
      "uniform sampler2D uImage; // @control filter=linear wrap=clamp",
      'uniform sampler2D uPath; // @control path default="M 0 0 L 10 10" fit=contain',
      "void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0); }",
    ].join("\n");

    const controls = parseControls(src);
    const layout = metalUniformLayout(controls);

    expect(layout.samplers).toEqual([
      {
        name: "uImage",
        property: "image",
        type: "sampler2D",
        binding: 1,
        filter: "linear",
        wrap: "clamp",
      },
      {
        name: "uPath",
        property: "path",
        type: "path",
        binding: 2,
        filter: "nearest",
        wrap: "clamp",
        pathFit: "contain",
        pathMargin: 0.1,
      },
    ]);

    // std140 offsets starting at 992:
    // uSpeed: float at 992 (size 4) -> next 996
    // uColor: vec3 aligned to 16 -> offset 1008 (size 12) -> next 1020
    // uInvert: bool aligned to 4 -> offset 1020 (size 4) -> next 1024
    // uSteps: int aligned to 4 -> offset 1024 (size 4) -> next 1028
    // uOffset: vec2 aligned to 8 -> offset 1032 (size 8) -> next 1040 -> rounded to 16 = 1040
    expect(layout.fields.map((f) => ({ name: f.name, offset: f.offset, size: f.size }))).toEqual([
      { name: "uSpeed", offset: 992, size: 4 },
      { name: "uColor", offset: 1008, size: 12 },
      { name: "uInvert", offset: 1020, size: 4 },
      { name: "uSteps", offset: 1024, size: 4 },
      { name: "uOffset", offset: 1032, size: 8 },
    ]);
    expect(layout.byteLength).toBe(1040);

    const bytes = packMetalUniforms(
      controls,
      { uSpeed: 2.25, uInvert: true, uSteps: 7 },
      { width: 1280, height: 720, time: 3.5, delta: 0.016, frame: 42, flipY: true },
      layout,
    );
    expect(bytes.byteLength).toBe(1040);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getFloat32(0, true)).toBe(1280);
    expect(view.getFloat32(4, true)).toBe(720);
    expect(view.getFloat32(12, true)).toBeCloseTo(3.5, 5);
    expect(view.getInt32(20, true)).toBe(42);
    expect(view.getFloat32(28, true)).toBe(1); // flipY
    expect(view.getFloat32(FLAIR_METAL_BUILTIN_BYTE_LENGTH, true)).toBeCloseTo(2.25, 5);
    expect(view.getUint32(1020, true)).toBe(1); // uInvert
    expect(view.getInt32(1024, true)).toBe(7); // uSteps
  });

  it("preserves exact user source line numbers in wrapMetalSource and parseGlslangLog", () => {
    const src = [
      "// line 1",
      "uniform float uSpeed; // @control min=0 max=2 default=1",
      "// line 3",
      "void mainImage(out vec4 fragColor, in vec2 fragCoord) {",
      "  float broken = vec2(1.0, 2.0);", // line 5: type error
      "  fragColor = vec4(broken);",
      "}",
    ].join("\n");

    const wrapped = wrapMetalSource(src);
    expect(wrapped.lineCount).toBe(7);
    expect(wrapped.glsl).toContain("#line 1\n// line 1\n// @control min=0 max=2 default=1\n// line 3");

    const parsed = parseGlslangLog("ERROR: /tmp/test.frag:5: '=' :  cannot convert from ' const 2-component vector of float' to ' temp float'\nERROR: 1 compilation errors.", 7);
    expect(parsed).toEqual([
      {
        line: 5,
        message: "'=' :  cannot convert from ' const 2-component vector of float' to ' temp float'",
      },
    ]);

    const tools = metalToolsAvailable();
    if (tools.ok) {
      const res = compileShaderToMetal(src, { id: "broken-test" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0]?.line).toBe(5);
      }
    }
  });

  it("compiles single-pass and sampler shaders to MSL when tools are installed", () => {
    const tools = metalToolsAvailable();
    if (!tools.ok) return;

    const mesh = getEffect("mesh-gradient");
    expect(mesh?.kind).toBe("shader");
    if (!mesh || mesh.kind !== "shader") return;

    const res = compileShaderToMetal(mesh.source, {
      id: mesh.id,
      controls: effectControls(mesh),
      verify: Boolean(tools.xcrunMetal),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.functionName).toBe("flair_mesh_gradient_frag");
      expect(res.msl).toContain("fragment flair_mesh_gradient_frag_out flair_mesh_gradient_frag");
      expect(res.msl).toContain("[[buffer(0)]]");
    }

    const swiftStruct = generateSwiftEffectStruct(mesh);
    expect(swiftStruct).toContain("public struct MeshGradient: FlairEffect, Codable, Sendable, Equatable");
    expect(swiftStruct).toContain('public static let effectId = "mesh-gradient"');
    expect(swiftStruct).toContain('public static let functionName = "flair_mesh_gradient_frag"');
  });

  it("exposes swiftReady on EffectMeta, findEffects, effectQueryFromFlags, and catalog.search", async () => {
    const mesh = getEffect("mesh-gradient")!;
    const meshMeta = metaOf(mesh, effectControls(mesh), {
      accepts: [],
      images: [],
      texts: [],
      interactions: [],
      transparent: false,
    });
    expect(meshMeta.swiftReady).toBe(true);

    const swiftEffects = findEffects({ swiftReady: true });
    expect(swiftEffects.length).toBe(SHADER_EFFECTS.length);
    expect(swiftEffects.every((e) => e.kind === "shader")).toBe(true);

    const nonSwiftEffects = findEffects({ swiftReady: false });
    expect(nonSwiftEffects.length).toBe(EFFECTS.length - SHADER_EFFECTS.length);
    expect(nonSwiftEffects.every((e) => e.kind !== "shader")).toBe(true);

    expect(effectQueryFromFlags({ swift: true })).toEqual({ swiftReady: true });

    const editor = new EffectEditor();
    const registry = createEffectToolRegistry(editor);
    const searchRes = await registry.callTool("run_command", {
      id: "catalog.search",
      params: { swiftReady: true, limit: 3 },
    });
    expect(searchRes.isError).toBeFalsy();
    const text = (searchRes.content[0] as { type: "text"; text: string }).text;
    const payload = JSON.parse(text);
    const result = payload.result ?? payload;
    expect(result.total).toBe(SHADER_EFFECTS.length);
    expect(result.effects[0].swiftReady).toBe(true);
  });

  it("keeps the committed swift/ package in sync with SHADER_EFFECTS", () => {
    const swiftDir = resolve("swift");
    expect(existsSync(join(swiftDir, "Package.swift"))).toBe(true);
    const shadersDir = join(swiftDir, "Sources", "FlairEffects", "Shaders");
    expect(existsSync(join(shadersDir, "_FlairVertex.metal"))).toBe(true);

    const stale: string[] = [];
    for (const effect of SHADER_EFFECTS) {
      const metalFile = join(shadersDir, `${effect.id}.metal`);
      expect(existsSync(metalFile), `Missing ${effect.id}.metal — run 'flair export metal'`).toBe(true);
      const header = metalHashHeader(effect.id, effect.source, effectControls(effect));
      if (!readFileSync(metalFile, "utf8").startsWith(`${header}\n`)) stale.push(effect.id);
    }
    expect(stale, `Out-of-date .metal files — run 'flair export metal'`).toEqual([]);

    // Every effect has exactly one generated Swift struct and a registry entry.
    const generatedDir = join(swiftDir, "Sources", "FlairEffects", "Generated");
    const generated = readdirSync(generatedDir)
      .filter((f) => f.startsWith("FlairEffectsPart"))
      .map((f) => readFileSync(join(generatedDir, f), "utf8"))
      .join("\n");
    const ids = [...generated.matchAll(/public static let effectId = "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(ids, `Generated Swift structs are out of date — run 'flair export metal'`).toEqual(SHADER_EFFECTS.map((e) => e.id).sort());
    const registry = readFileSync(join(generatedDir, "FlairEffectsCatalog.swift"), "utf8");
    const registered = [...registry.matchAll(/AnyFlairEffect\((\w+)\(\)\)/g)].map((m) => m[1]);
    expect(registered).toEqual(SHADER_EFFECTS.map((e) => swiftTypeName(e.id)));

    const tools = metalToolsAvailable();
    if (tools.ok) {
      const catalogPath = join(swiftDir, "Sources", "FlairEffects", "Generated", "FlairEffectsCatalog.swift");
      const beforeCatalog = readFileSync(catalogPath, "utf8");
      const report = exportMetalPackage({ outDir: swiftDir, write: false });
      expect(report.ok).toBe(true);
      expect(report.compiled).toBe(SHADER_EFFECTS.length);
      expect(beforeCatalog).toContain(`public static let all: [AnyFlairEffect]`);
    }
  });

  it("refuses unknown --only ids, naming them", () => {
    expect(() => exportMetalPackage({ only: ["mesh-gradient", "no-such-effect"], write: false })).toThrow(/no shader effect "no-such-effect"/);
  });

  it("keeps the whole Swift registry when exporting a subset with only", () => {
    const tools = metalToolsAvailable();
    if (!tools.ok) return;
    const out = mkdtempSync(join(tmpdir(), "flair-metal-only-"));
    try {
      const shaders = join(out, "Sources", "FlairEffects", "Shaders");
      mkdirSync(shaders, { recursive: true });
      for (const id of ["aurora", "crt"]) {
        copyFileSync(join(resolve("swift"), "Sources", "FlairEffects", "Shaders", `${id}.metal`), join(shaders, `${id}.metal`));
      }
      const report = exportMetalPackage({ outDir: out, only: ["mesh-gradient"] });
      expect(report.ok).toBe(true);
      expect(report.effects.map((e) => e.id)).toEqual(["mesh-gradient"]);
      const registry = readFileSync(join(out, "Sources", "FlairEffects", "Generated", "FlairEffectsCatalog.swift"), "utf8");
      for (const id of ["aurora", "crt", "mesh-gradient"]) expect(registry).toContain(`AnyFlairEffect(${swiftTypeName(id)}())`);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
