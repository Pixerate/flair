@testable import FlairEditorEffects
import FlairEffects
import PixerateCore
import QuartzCore
import XCTest

/// `FlairEffectProvider` as the editors' `TextTreatmentProvider`: Flair's own plans, in the editor's types.
final class FlairTextTreatmentProviderTests: XCTestCase {
    let target = PixerateCore.TextTreatmentTarget(lines: [TextTreatmentRect(x: 10, y: 20, width: 100, height: 18)],
                                                  caret: TextTreatmentCaret(x: 110, y: 20, height: 18), label: "Agent")

    func testDefaultIsTheSoftSweep() {
        XCTAssertEqual(FlairEffectProvider().defaultTextTreatment, "soft-sweep")
    }

    func testPlansAreFlairsOwn() throws {
        let provider = FlairEffectProvider()
        let request = PixerateCore.TextTreatmentPlanRequest(stage: .landed, time: 1250, target: target)
        let plan = try provider.textTreatmentPlan("ribbon-curl", request, values: JSONObject([("color", .string("#3366cc")), ("darkTheme", .bool(true))]))
        let curl = try XCTUnwrap(FlairTextTreatments.treatment(id: "ribbon-curl"))
        let flair = FlairTextTreatments.plan(curl, stage: .landed, time: 1250, target: FlairEffectProvider.flairTarget(target),
                                             values: ["color": .string("#3366cc"), "darkTheme": .bool(true)])
        XCTAssertEqual(plan, FlairEffectProvider.editorPlan(flair, font: nil))
        XCTAssertTrue(plan.layers.contains { $0.kind == .path && ($0.segments?.count ?? 0) > 3 })
        XCTAssertTrue(plan.layers.contains { $0.blend == "screen" })
        // Through the editor's own helper, with the provider's default.
        let caret = try planTextTreatment(provider, PixerateCore.TextTreatmentPlanRequest(stage: .caret, time: 0, target: target))
        XCTAssertEqual(caret.layers.map(\.source), ["caret", "tag"])
    }

    func testRefusesWithTheContractsCodes() {
        let provider = FlairEffectProvider()
        let request = PixerateCore.TextTreatmentPlanRequest(stage: .caret, time: 0, target: target)
        func code(_ run: () throws -> Void) -> String? {
            do { try run() } catch let e as TextTreatmentError { return e.code } catch { return "other" }
            return nil
        }
        XCTAssertEqual(code { _ = try provider.textTreatmentPlan("no-such-look", request, values: nil) }, "unknown_effect")
        XCTAssertEqual(code { _ = try provider.textTreatmentPlan("aurora", request, values: nil) }, "unsupported")
        XCTAssertEqual(code { _ = try provider.textTreatmentPlan("soft-sweep", PixerateCore.TextTreatmentPlanRequest(stage: .caret, time: -1, target: self.target), values: nil) }, "unsupported")
        XCTAssertEqual(code { _ = try provider.textTreatmentPlan("soft-sweep", request, values: JSONObject([("nope", .number(1))])) }, "invalid_values")
        XCTAssertEqual(code { _ = try provider.textTreatmentPlan("soft-sweep", request, values: JSONObject([("color", .string("purple"))])) }, "invalid_values")
    }

    @MainActor
    func testLayersDrawTheEditorsPlans() throws {
        let provider = FlairEffectProvider()
        let plan = try provider.textTreatmentPlan("soft-sweep", PixerateCore.TextTreatmentPlanRequest(stage: .checking, time: 200, target: target), values: nil)
        let layers = FlairTextTreatmentLayers()
        layers.draw([plan])
        XCTAssertTrue(layers.behindLayer.sublayers?.first is CAGradientLayer)
        layers.draw([])
        XCTAssertNil(layers.behindLayer.sublayers)
    }
}
