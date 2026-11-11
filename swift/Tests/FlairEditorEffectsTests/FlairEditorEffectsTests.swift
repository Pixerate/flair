@testable import FlairEditorEffects
import FlairEffects
import Metal
import PixerateCore
import PixeratePaint
import XCTest

private func solid(_ w: Int, _ h: Int, _ rgba: [UInt8]) -> EffectPixels {
    EffectPixels(width: w, height: h, data: (0..<(w * h)).flatMap { _ in rgba })
}

private func pixel(_ p: EffectPixels, _ x: Int, _ y: Int) -> [UInt8] {
    let i = (y * p.width + x) * 4
    return Array(p.data[i..<i + 4])
}

/// The error a call fails with, as an editor sees it.
private func failure(_ run: () async throws -> Void) async -> EffectError? {
    do {
        try await run()
        return nil
    } catch {
        return error as? EffectError
    }
}

final class FlairEditorEffectsTests: XCTestCase {
    private func gpu() throws {
        try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil, "No Metal device.")
    }

    // MARK: - The catalog

    func testListsEveryMetalEffectWithTheTypeScriptAdaptersDescriptions() async throws {
        let provider = FlairEffectProvider()
        let all = try await provider.list()
        XCTAssertEqual(all.count, FlairCatalog.all.count, "Every compiled Metal effect is offered (run `pnpm swift:meta` when the catalog changes).")
        XCTAssertEqual(Set(all.map(\.id)), Set(FlairCatalog.all.map(\.effectId)))
        XCTAssertTrue(all.allSatisfy { $0.kind == "shader" })
        // Summaries leave out controls, defaults, presets and inputs, as `EffectSummary` does.
        XCTAssertNil(all[0].json["controls"])

        let d = try await provider.describe("mesh-gradient")
        XCTAssertEqual(d.name, "Mesh gradient")
        XCTAssertEqual(d.uses, ["generator"])
        XCTAssertEqual(d.defaults["uColorA"], "#ff6b6b")
        XCTAssertEqual(d.duration, 4000)
        XCTAssertEqual((d.json["presets"]?.arrayValue ?? []).compactMap { $0.objectValue?["name"]?.stringValue }, ["Sunset", "Lagoon", "Mono"])

        let duotone = try await provider.describe("image-duotone")
        XCTAssertEqual(duotone.uses, ["filter"])
        XCTAssertEqual(layerImageInput(duotone), "source")
        // The picture it changes is an input, not a control.
        XCTAssertFalse(duotone.controlNames.contains("uImage"))

        let wipe = try await provider.describe("transition-wipe")
        XCTAssertEqual(wipe.inputs.compactMap { $0["name"]?.stringValue }, ["from", "to"])
        XCTAssertFalse(wipe.controlNames.contains("uProgress"))
    }

    func testSearchesAndFiltersLikeTheEditor() async throws {
        let provider = FlairEffectProvider()
        let filters = try await provider.list(EffectSearchOptions(use: "filter"))
        XCTAssertFalse(filters.isEmpty)
        XCTAssertTrue(filters.allSatisfy { $0.uses.contains("filter") })
        let paths = try await provider.list(EffectSearchOptions(accepts: ["path"]))
        XCTAssertTrue(paths.map(\.id).contains("brush-trail"))
        let found = try await provider.search("mesh gradient", EffectSearchOptions(limit: 3))
        XCTAssertEqual(found.first?.id, "mesh-gradient")
    }

    func testRefusesWhatItCannotDoSayingWhatToDoInstead() async throws {
        let provider = FlairEffectProvider()
        let unknown = await failure { _ = try await provider.describe("no-such-effect") }
        XCTAssertEqual(unknown?.code, "unknown_effect")
        XCTAssertTrue(unknown?.message.contains("search_effects") == true)

        let tooBig = await failure { _ = try provider.createRenderer("mesh-gradient", width: 9000, height: 10) }
        XCTAssertEqual(tooBig?.code, "unsupported")
        let empty = await failure { _ = try provider.createRenderer("mesh-gradient", width: 0, height: 10) }
        XCTAssertEqual(empty?.code, "unsupported")
        XCTAssertTrue(empty?.message.contains("at least 1 pixel") == true)

        try gpu()
        let r = try provider.createRenderer("image-duotone", width: 4, height: 4)
        let missing = await failure { _ = try await r.render(EffectRenderRequest()) }
        XCTAssertEqual(missing?.code, "unsupported")
        XCTAssertTrue(missing?.message.contains("needs the input \"source\"") == true)
        let stray = await failure { _ = try await r.render(EffectRenderRequest(inputs: ["source": solid(4, 4, [0, 0, 0, 255]), "image": solid(4, 4, [0, 0, 0, 255])])) }
        XCTAssertTrue(stray?.message.contains("has no input \"image\"; its inputs are \"source\"") == true)
        let bad = await failure { _ = try await r.render(EffectRenderRequest(values: ["uContrast": "lots"], inputs: ["source": solid(4, 4, [0, 0, 0, 255])])) }
        XCTAssertEqual(bad?.code, "invalid_values")
        XCTAssertTrue(bad?.message.contains("uContrast") == true)
        let mask = await failure { _ = try await r.render(EffectRenderRequest(inputs: ["source": solid(4, 4, [0, 0, 0, 255])], mask: solid(2, 2, [0, 0, 0, 255]))) }
        XCTAssertTrue(mask?.message.contains("size of the renderer") == true)
    }

    // MARK: - The contract, for every effect

    func testKeepsTheEffectProviderContractForEveryEffect() async throws {
        try gpu()
        let issues = try await checkEffectProvider(FlairEffectProvider())
        XCTAssertTrue(issues.isEmpty, issues.prefix(20).map(\.description).joined(separator: "\n"))
    }

    // MARK: - Pixels

    func testRendersGeneratorsWithTheirValuesAndColoursInAnyCSSForm() async throws {
        try gpu()
        let provider = FlairEffectProvider()
        let r = try provider.createRenderer("mesh-gradient", width: 32, height: 16)
        defer { r.dispose() }
        let a = try await r.render(EffectRenderRequest(time: 500))
        XCTAssertEqual(a.data.count, 32 * 16 * 4)
        XCTAssertEqual(pixel(a, 16, 8)[3], 255, "An opaque generator.")
        let red: JSONObject = ["uColorA": "#ff0000", "uColorB": "#ff0000", "uColorC": "#ff0000", "uColorD": "#ff0000", "uGrain": 0]
        let b = try await r.render(EffectRenderRequest(time: 500, values: red))
        let p = pixel(b, 16, 8)
        XCTAssertGreaterThan(p[0], 240)
        XCTAssertLessThan(p[1], 15)
        // The same colour as rgb() and hsl() draws the same picture.
        var asRgb = red
        for k in ["uColorA", "uColorB", "uColorC", "uColorD"] { asRgb[k] = "rgb(255, 0, 0)" }
        let c = try await r.render(EffectRenderRequest(time: 500, values: asRgb))
        XCTAssertEqual(b.data, c.data)
        var asHsl = red
        for k in ["uColorA", "uColorB", "uColorC", "uColorD"] { asHsl[k] = "hsl(0 100% 50%)" }
        let d = try await r.render(EffectRenderRequest(time: 500, values: asHsl))
        XCTAssertEqual(b.data, d.data)
    }

    func testFiltersChangeTheirSourceAndAMaskKeepsItUntouched() async throws {
        try gpu()
        let provider = FlairEffectProvider()
        let r = try provider.createRenderer("image-duotone", width: 8, height: 8)
        defer { r.dispose() }
        let black = solid(8, 8, [0, 0, 0, 255]), white = solid(8, 8, [255, 255, 255, 255])
        let dark = try await r.render(EffectRenderRequest(inputs: ["source": black]))
        let light = try await r.render(EffectRenderRequest(inputs: ["source": white]))
        // Shadows take the shadow colour (#1e1b4b), highlights the highlight colour (#fb7185).
        XCTAssertLessThan(Int(pixel(dark, 4, 4)[0]), 80)
        XCTAssertGreaterThan(Int(pixel(light, 4, 4)[0]), 200)

        // A picture whose top half is red and bottom half blue reaches the shader the right way up.
        var halves = solid(8, 8, [255, 255, 255, 255])
        for y in 4..<8 { for x in 0..<8 { let i = (y * 8 + x) * 4; halves.data[i] = 0; halves.data[i + 1] = 0; halves.data[i + 2] = 0 } }
        let split = try await r.render(EffectRenderRequest(inputs: ["source": halves]))
        XCTAssertGreaterThan(Int(pixel(split, 4, 1)[0]), Int(pixel(split, 4, 6)[0]) + 100, "The top of the source is the top of the frame.")

        let none = solid(8, 8, [0, 0, 0, 0])
        let masked = try await r.render(EffectRenderRequest(inputs: ["source": white], mask: none))
        XCTAssertEqual(masked.data, white.data, "Where the mask is 0 the source shows untouched.")
    }

    func testTransitionsRunFromTheirFirstPictureToTheirSecond() async throws {
        try gpu()
        let provider = FlairEffectProvider()
        let r = try provider.createRenderer("transition-wipe", width: 16, height: 16)
        defer { r.dispose() }
        let red = solid(16, 16, [255, 0, 0, 255]), blue = solid(16, 16, [0, 0, 255, 255])
        let start = try await r.render(EffectRenderRequest(inputs: ["from": red, "to": blue], progress: 0))
        let end = try await r.render(EffectRenderRequest(inputs: ["from": red, "to": blue], progress: 1))
        XCTAssertEqual(pixel(start, 8, 8)[0], 255)
        XCTAssertEqual(pixel(end, 8, 8)[2], 255)
        // Without progress, time over its duration drives it.
        let duration = try await provider.describe("transition-wipe").duration ?? 4000
        let late = try await r.render(EffectRenderRequest(time: duration, inputs: ["from": red, "to": blue]))
        XCTAssertEqual(late.data, end.data)
    }

    func testReadsCSSColoursAsFlairsTypeScriptDoes() {
        XCTAssertEqual(parseCSSColor("#f00"), [1, 0, 0])
        XCTAssertEqual(parseCSSColor("ff000080")?.count, 4)
        XCTAssertEqual(parseCSSColor("#ff0000ff"), [1, 0, 0])
        XCTAssertEqual(parseCSSColor("rgba(0, 255, 0, 0.5)"), [0, 1, 0, 0.5])
        XCTAssertEqual(parseCSSColor("rgb(100% 0% 0% / 1)"), [1, 0, 0])
        XCTAssertEqual(parseCSSColor("hsl(240deg, 100%, 50%)"), [0, 0, 1])
        XCTAssertNil(parseCSSColor("rgb(a, b, c)"))
        XCTAssertNil(parseCSSColor("tomato"))
    }

    // MARK: - In the paint editor

    func testAPaintEditorDrawsFlairEffectPaperLayersFillsAndPaintAndReplaysThemWhenOpenedAgain() async throws {
        try gpu()
        let c = try PaintEditorController(width: 48, height: 32, brushId: "ink-pen")
        c.setEffectsProvider(FlairEffectProvider())

        let paper = try await c.setPaperEffect("mesh-gradient", values: ["uColorA": "#204080"], time: 250)
        XCTAssertEqual(paper?.source.provider, "flair")
        XCTAssertEqual(paper?.image.width, 48)

        let added = try await c.addEffectLayer("aurora", values: ["uSpeed": 0.5])
        XCTAssertEqual(added.source.effect, "aurora")
        XCTAssertEqual(added.source.values["uSpeed"], 0.5)
        let updated = try await c.updateEffectLayer(added.layer.id, time: 1000)
        XCTAssertEqual(updated.time, 1000)

        let filled = try await c.fillLayerWithEffect("plasma")
        XCTAssertEqual(filled.source.effect, "plasma")

        _ = try await c.setEffectPaint("brush-trail", map: ["by": "path"])
        _ = try c.setBrushFacets(["tip": ["size": 8, "hardness": 1, "opacity": 1, "flow": 1], "behaviour": ["grain": 0]])
        let stroke = try c.paintStroke(PaintStrokeInit(seed: 1), points: [
            PenPoint(x: 6, y: 16, pressure: 1),
            PenPoint(x: 24, y: 10, pressure: 1),
            PenPoint(x: 42, y: 16, pressure: 1),
        ])
        XCTAssertEqual(c.doc.strokes.last?.effect?.effect, "brush-trail")

        // Saved, then opened in another editor with the provider: the effects come back and draw again.
        let saved = c.toJSON()
        let again = try PaintEditorController(width: 8, height: 8, brushId: "ink-pen")
        again.setEffectsProvider(FlairEffectProvider())
        let problems = try again.loadJSON(.object(saved))
        XCTAssertEqual(problems, [])
        XCTAssertEqual(again.getPaperEffect()?.source.effect, "mesh-gradient")
        XCTAssertEqual(again.getEffectLayer(added.layer.id)?.effect, "aurora")
        XCTAssertEqual(again.getEffectLayer(added.layer.id)?.time, 1000)
        let redrawn = try await again.updateEffectLayer(added.layer.id, values: ["uSpeed": 0.25])
        XCTAssertEqual(redrawn.provider, "flair")
        _ = try await again.updatePaperEffect(time: 500)
        // The saved stroke keeps its effect paint, which renders again for a replay.
        XCTAssertEqual(again.doc.strokes.first { $0.id == stroke.strokeId }?.effect?.effect, "brush-trail")
        try await again.prepareEffectPaints(again.doc.strokes.compactMap(\.effect))
    }
}
