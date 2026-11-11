@testable import FlairEditorEffects
import Metal
import PixerateCore
import PixeratePaint
import XCTest

/// The document `pnpm swift:meta` saved with the TypeScript adapter (Aurora, preset Ember, keyframes, 3 s loop).
private func tsDocument() throws -> JSONObject {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/aurora-ts-document.json")
    return try XCTUnwrap(JSONValue.parse(Data(contentsOf: url)).objectValue)
}

private func openError(_ provider: FlairEffectProvider, _ from: EffectAuthoringSource) async -> EffectError? {
    do {
        let s = try await provider.openAuthoring(from)
        s.dispose()
        return nil
    } catch {
        return error as? EffectError
    }
}

/// A paint editor with Flair registered and its tools, called the way a model calls them.
private struct Host {
    let c: PaintEditorController
    let registry: ToolRegistry

    /// CI's virtual GPUs are slow; the editor's own tests cover the trial render budget, so these give it room.
    init(rawShaders: Bool) throws {
        c = try PaintEditorController(width: 32, height: 16, paperPreset: "smooth", authoredEffects: .author, rawShaders: rawShaders, authoredEffectLimits: AuthoredEffectLimits(trialRenderMs: 30_000, liveFrameMs: 30_000))
        c.setEffectsProvider(FlairEffectProvider())
        registry = ToolRegistry(validateArguments: true)
        _ = try registry.register(createPaintEditorToolProvider(c))
        _ = try registry.register(createPaintEffectsToolProvider(c))
        _ = try registry.register(createPaintEffectAuthoringToolProvider(c))
    }

    func call(_ name: String, _ args: JSONObject = [:], file: StaticString = #filePath, line: UInt = #line) async -> JSONObject {
        let r = await registry.callTool(name, args)
        if r.isError { XCTFail("\(name) failed: \(r.text ?? "")", file: file, line: line) }
        return r.structuredContent ?? [:]
    }

    func fail(_ name: String, _ args: JSONObject = [:], file: StaticString = #filePath, line: UInt = #line) async -> String {
        let r = await registry.callTool(name, args)
        XCTAssertTrue(r.isError, "\(name) should fail", file: file, line: line)
        return r.text ?? ""
    }
}

final class FlairEditorAuthoringTests: XCTestCase {
    private func gpu() throws {
        try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil, "No Metal device.")
    }

    // MARK: - Sessions

    func testSaysItAuthorsAndOpensCatalogEffectsWithAPreset() async throws {
        let provider = FlairEffectProvider()
        XCTAssertEqual(provider.capabilities["supportsAuthoring"], true)

        let s = try await provider.openAuthoring(.effect("aurora", preset: "Ember"))
        defer { s.dispose() }
        let state = s.getState()
        XCTAssertEqual(state.providerId, "flair")
        XCTAssertEqual(state.effectId, "aurora")
        XCTAssertEqual(state.kind, "shader")
        XCTAssertEqual(state.values["uSky"], "#0f0508")
        XCTAssertEqual(state.values["uSpeed"], 0.35)
        // Metal shaders are compiled ahead of time: there is no source to edit here.
        XCTAssertFalse(s.canEditSource)
        XCTAssertNil(state.source)
        let edit = await s.setSource("void mainImage(out vec4 c, in vec2 p) {}")
        XCTAssertFalse(edit.isOK)
    }

    func testEditsValuesKeyframesPresetsAndTimingAndReopensWhatItSaves() async throws {
        let provider = FlairEffectProvider()
        let s = try await provider.openAuthoring(.effect("aurora"))
        defer { s.dispose() }
        XCTAssertTrue(s.setValue("uGlowA", "#ff0000").isOK)
        XCTAssertTrue(s.setTiming(duration: 2000, loop: true).isOK)
        XCTAssertTrue(s.setKeyframe("uIntensity", time: 0, value: 0.5).isOK)
        XCTAssertTrue(s.setKeyframe("uIntensity", time: 2000, value: 1.5).isOK)
        XCTAssertTrue(s.savePreset("Mine").isOK)
        s.seek(1000)
        XCTAssertEqual(s.getState().values["uIntensity"]?.numberValue ?? 0, 1, accuracy: 1e-9)
        XCTAssertTrue(s.undo())
        XCTAssertTrue(s.redo())

        // Refusals change nothing and say what to do.
        let before = s.getState()
        XCTAssertEqual(s.setValue("uNope", 1).message, "there is no control \"uNope\"; the controls are uSky, uGlowA, uGlowB, uSpeed, uIntensity, uHeight")
        XCTAssertFalse(s.setValue("uSpeed", "fast").isOK)
        XCTAssertTrue(s.getState() === before)

        let saved = s.exportDocument()
        XCTAssertEqual(saved.providerId, "flair")
        XCTAssertEqual(saved.effectId, "aurora")
        XCTAssertNil(saved.source, "Catalog shaders are drawn from the catalog: the document carries no source.")
        let again = try await provider.openAuthoring(.document(.object(saved.json)))
        defer { again.dispose() }
        let state = again.getState()
        XCTAssertEqual(state.values["uGlowA"], "#ff0000")
        XCTAssertEqual(state.tracks["uIntensity"]?.count, 2)
        XCTAssertEqual(state.duration, 2000)
        XCTAssertTrue(state.loop)
        XCTAssertTrue((state.description.json["presets"]?.arrayValue ?? []).contains { $0.objectValue?["name"] == "Mine" })
    }

    func testOpensADocumentTheTypeScriptAdapterSaved() async throws {
        let provider = FlairEffectProvider()
        let doc = try tsDocument()
        XCTAssertNotNil(doc["flair"], "The TypeScript adapter keeps Flair's own document, with the GLSL.")
        let s = try await provider.openAuthoring(.document(.object(doc)))
        defer { s.dispose() }
        s.seek(0)
        let state = s.getState()
        XCTAssertEqual(state.name, "Aurora")
        XCTAssertEqual(state.values["uSky"], "#0f0508")
        XCTAssertEqual(state.values["uSpeed"], 0.8)
        XCTAssertEqual(state.values["uIntensity"], 0.2)
        XCTAssertEqual(state.tracks["uIntensity"]?.last?.easing, .named("ease-in-out"))
        XCTAssertEqual(state.duration, 3000)
        XCTAssertTrue(state.loop)
        let presets = (state.description.json["presets"]?.arrayValue ?? []).compactMap { $0.objectValue?["name"]?.stringValue }
        XCTAssertEqual(presets, ["Arctic", "Ember", "Ice", "Saved on the web"])

        // Saved here, it keeps the contract's fields (which the TypeScript adapter reads over the catalog effect).
        let out = s.exportDocument().json
        XCTAssertNil(out["flair"])
        XCTAssertEqual(out["values"]?.objectValue?["uSpeed"], 0.8)
        XCTAssertEqual(out["duration"], 3000)
    }

    func testRefusesWhatItCannotOpenSayingWhatToDo() async throws {
        let provider = FlairEffectProvider()
        let unknown = await openError(provider, .effect("no-such-effect"))
        XCTAssertEqual(unknown?.code, "unknown_effect")
        let preset = await openError(provider, .effect("aurora", preset: "Lava"))
        XCTAssertEqual(preset?.message, "\"aurora\" has no preset \"Lava\"; its presets are \"Arctic\", \"Ember\", \"Ice\".")

        let notADocument = await openError(provider, .document("aurora"))
        XCTAssertEqual(notADocument?.code, "invalid_values")
        XCTAssertTrue(notADocument?.message.contains("must be a document saved with exportDocument") == true)

        var doc = try tsDocument()
        doc["providerId"] = "pixel"
        doc["version"] = 2
        let header = await openError(provider, .document(.object(doc)))
        XCTAssertEqual(header?.message, "Invalid values for effect \"aurora\":\n- /version: must be 1\n- /providerId: is \"pixel\"; this is Flair's provider (\"flair\"): open it with the provider that saved it")

        // GLSL edited on the web can't be drawn here: there is no GLSL compiler on the device.
        var edited = try tsDocument()
        var flair = edited["flair"]?.objectValue ?? [:]
        var effect = flair["effect"]?.objectValue ?? [:]
        effect["source"] = .string((effect["source"]?.stringValue ?? "") + "\n// tweaked\n")
        flair["effect"] = .object(effect)
        edited["flair"] = .object(flair)
        let glsl = await openError(provider, .document(.object(edited)))
        XCTAssertEqual(glsl?.code, "unsupported")
        XCTAssertEqual(glsl?.message, "\"Aurora\" has GLSL edited from \"aurora\"; this adapter draws Flair's shaders compiled to Metal ahead of time, so it can't draw edited source. Open the document where Flair's TypeScript adapter runs (flairEffects().openAuthoring), or open \"aurora\" here and set its values instead.")

        var contractSource = try tsDocument()
        contractSource["flair"] = nil
        contractSource["source"] = "void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }"
        contractSource["sourceLanguage"] = "glsl"
        let contract = await openError(provider, .document(.object(contractSource)))
        XCTAssertEqual(contract?.code, "unsupported")
        contractSource["sourceLanguage"] = "pixel"
        let pixel = await openError(provider, .document(.object(contractSource)))
        XCTAssertEqual(pixel?.message, "Invalid values for effect \"aurora\":\n- /sourceLanguage: is \"pixel\"; Flair's shader documents are written in \"glsl\"")

        var badValues = try tsDocument()
        badValues["values"] = ["uSpeed": "fast"]
        let values = await openError(provider, .document(.object(badValues)))
        XCTAssertEqual(values?.code, "invalid_values")
        XCTAssertTrue(values?.message.contains("/values/uSpeed") == true, values?.message ?? "")
    }

    // MARK: - Previews

    func testPreviewsDrawTheKeyframedValuesAtEachTime() async throws {
        try gpu()
        let provider = FlairEffectProvider()
        let s = try await provider.openAuthoring(.document(.object(try tsDocument())))
        defer { s.dispose() }
        let preview = try await s.createPreview(width: 24, height: 16)
        defer { preview.dispose() }
        let dim = try await preview.render(EffectRenderRequest(time: 0))
        let bright = try await preview.render(EffectRenderRequest(time: 2000))
        XCTAssertNotEqual(dim.data, bright.data, "uIntensity is keyframed from 0.2 to 1.4.")
        XCTAssertTrue(s.getState().compiled ?? true)
        XCTAssertNil(s.getState().previewError)

        // The same picture as the provider draws with those values.
        let direct = try provider.createRenderer("aurora", width: 24, height: 16)
        defer { direct.dispose() }
        let values = authoringValuesAt(s.exportDocument(), 2000)
        let expected = try await direct.render(EffectRenderRequest(time: 2000, values: values))
        XCTAssertEqual(bright.data, expected.data)
    }

    func testShadersHaveTwoSecondsToCompile() async throws {
        try gpu()
        XCTAssertEqual(FlairEffectProvider().compileTimeoutMs, 2000, "As the editor's PixelGPU.defaultCompileTimeoutMs.")
        // With no time at all, a shader that isn't compiled yet is refused, saying so (or, built
        // with Xcode, it comes ready-made from the default library).
        let hurried = FlairEffectProvider(compileTimeoutMs: 0)
        do {
            let r = try hurried.createRenderer("plasma", width: 8, height: 8)
            r.dispose()
        } catch let e as EffectError {
            XCTAssertEqual(e.message, "\"plasma\" took longer than 0 ms to compile for the GPU; try again shortly (it keeps compiling), or use another effect.")
        }
    }

    // MARK: - Agents, through a paint editor's tools

    func testAgentsAuthorFlairEffectsWithTheEditorsTools() async throws {
        let t = try Host(rawShaders: false)
        let opened = await t.call("open_effect_authoring", ["effect": "aurora"])
        XCTAssertEqual(opened["from"], "aurora")
        let set = await t.call("effect_authoring_set_values", ["values": ["uSpeed": 1.2, "uGlowB": "#00ff88"]])
        XCTAssertEqual(set["values"]?.objectValue?["uSpeed"], 1.2)
        let refused = await t.fail("effect_authoring_set_values", ["values": ["uSpeed": "fast"]])
        XCTAssertTrue(refused.contains("uSpeed"), refused)
        let source = await t.fail("effect_authoring_set_source", ["source": "x"])
        XCTAssertTrue(source.contains("has no source to edit"), source)
        _ = await t.call("effect_authoring_set_keyframe", ["control": "uHeight", "time": 0, "value": 0.2])
        _ = await t.call("effect_authoring_set_timing", ["duration": 2500, "loop": true])

        // Without rawShaders a paint editor keeps only pixel expression effects.
        let save = await t.fail("save_authored_effect", ["name": "Fast aurora"])
        XCTAssertTrue(save.contains("raw shader source needs rawShaders: true"), save)
    }

    func testPaintEditorsDrawSavedFlairDocumentsOnlyWithRawShaders() async throws {
        try gpu()
        let t = try Host(rawShaders: true)
        _ = await t.call("open_effect_authoring", ["effect": "aurora"])
        _ = await t.call("effect_authoring_set_values", ["values": ["uSpeed": 1.2]])
        // As the authoring tab does: a preview first, so the shader is compiled before the trial render.
        let preview = try await XCTUnwrap(t.c.authoringSession).createPreview(width: 16, height: 16)
        _ = try await preview.render(EffectRenderRequest(time: 0))
        preview.dispose()
        let saved = await t.call("save_authored_effect", ["name": "Fast aurora"])
        let id = try XCTUnwrap(saved["id"]?.stringValue ?? saved["effect"]?.objectValue?["id"]?.stringValue, "\(saved)")
        XCTAssertEqual(id, "authored.fast-aurora")
        let layer = try await t.c.addEffectLayer(id)
        XCTAssertEqual(layer.source.effect, id)

        // The TypeScript adapter's document, kept in a painting: drawn through Flair only with rawShaders.
        var json = t.c.toJSON()
        json["authoredEffects"] = ["authored.web-aurora": ["name": "Web aurora", "document": .object(try tsDocument())]]
        let off = try Host(rawShaders: false)
        XCTAssertEqual(try off.c.loadJSON(.object(json)), [])
        let listed = await off.call("list_authored_effects")["effects"]?.arrayValue?.first?.objectValue ?? [:]
        let problem = listed["problem"]?.stringValue ?? ""
        XCTAssertTrue(problem.contains("for the provider \"flair\"; this editor draws only pixel expression effects (raw shader source needs rawShaders: true)"), problem)

        let on = try Host(rawShaders: true)
        XCTAssertEqual(try on.c.loadJSON(.object(json)), [])
        let drawn = await on.call("list_authored_effects")["effects"]?.arrayValue?.first?.objectValue ?? [:]
        XCTAssertNil(drawn["problem"], "\(drawn)")
        let webLayer = try await on.c.addEffectLayer("authored.web-aurora")
        XCTAssertEqual(webLayer.source.effect, "authored.web-aurora")
    }
}
