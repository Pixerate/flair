import CoreGraphics
import Foundation
import QuartzCore
import XCTest
@testable import FlairEffects

/// Swift plans text treatments as TypeScript does: every case in `Fixtures/text-treatment-plans.json`
/// (written by `pnpm swift:meta` from `textTreatmentPlan`) is planned again here and must give the
/// same layers: rectangles, colours, opacities and gradients, within float noise.
final class FlairTextTreatmentTests: XCTestCase {
    func testTreatmentsLoadWithTheSoftSweepFirst() {
        let all = FlairTextTreatments.all
        XCTAssertGreaterThanOrEqual(all.count, 7)
        XCTAssertEqual(all.first?.id, FlairTextTreatments.defaultID)
        let sweep = FlairTextTreatments.treatment(id: "soft-sweep")
        XCTAssertEqual(sweep?.name, "Soft sweep")
        XCTAssertTrue(sweep?.presetNames.contains("Blue") == true)
        XCTAssertTrue(sweep?.controls.contains { $0.name == "color" && $0.color } == true)
    }

    func testPlansMatchTypeScript() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/text-treatment-plans.json")
        let fixture = try FlairJSON.parse(Data(contentsOf: url))
        let cases = try XCTUnwrap(fixture["cases"]?.array)
        XCTAssertGreaterThan(cases.count, 300)
        var layers = 0
        for c in cases {
            let id = c["id"]!.string!, stageName = c["stage"]!.string!
            let treatment = try XCTUnwrap(FlairTextTreatments.treatment(id: id), id)
            let stage = try XCTUnwrap(FlairTextTreatmentStage(rawValue: stageName))
            let target = Self.target(c["target"]!)
            let plan = FlairTextTreatments.plan(treatment, stage: stage, time: c["time"]!.number!, target: target,
                                                preset: c["preset"]?.string, values: c["values"]?.object ?? [:],
                                                reduceMotion: c["reduceMotion"] == .bool(true))
            let expected = c["plan"]!
            let at = "\(id) \(stageName) t=\(c["time"]!.number!) reduced=\(c["reduceMotion"] == .bool(true)) preset=\(c["preset"]?.string ?? "-")"
            XCTAssertEqual(plan.duration, expected["duration"]!.number!, accuracy: 1e-6, at)
            XCTAssertEqual(plan.done, expected["done"] == .bool(true), at)
            XCTAssertEqual(plan.reduced, expected["reduced"] == .bool(true), at)
            let want = expected["layers"]!.array!
            XCTAssertEqual(plan.layers.map(\.source), want.map { $0["source"]!.string! }, at)
            guard plan.layers.count == want.count else { continue }
            for (got, w) in zip(plan.layers, want) {
                layers += 1
                Self.assertLayer(got, w, at)
            }
        }
        XCTAssertGreaterThan(layers, 500)
    }

    func testRendererDrawsAPlanWithCoreAnimationLayers() throws {
        let sweep = try XCTUnwrap(FlairTextTreatments.treatment(id: "soft-sweep"))
        let target = FlairTreatmentTarget(lines: [CGRect(x: 10, y: 20, width: 100, height: 18)], caret: FlairTreatmentCaret(x: 110, y: 20, height: 18),
                                          text: "word", label: "Partner", color: FlairRGBA(0, 0, 0), background: FlairRGBA(1, 1, 1))
        let renderer = FlairTextTreatmentRenderer()
        let checking = FlairTextTreatments.plan(sweep, stage: .checking, time: 200, target: target)
        let typing = FlairTextTreatments.plan(sweep, stage: .typing, time: 0, target: target)
        renderer.draw([checking, typing])
        XCTAssertTrue(renderer.behindLayer.sublayers?.first is CAGradientLayer)
        let above = renderer.aboveLayer.sublayers ?? []
        // cover, tint, typed word, caret, tag
        XCTAssertEqual(above.count, 5)
        XCTAssertTrue(above[2] is CATextLayer)
        XCTAssertEqual(above[3].frame, CGRect(x: 109, y: 20, width: 2, height: 18))
        XCTAssertGreaterThan(above[4].frame.width, 2 * 11 * 0.6)
        renderer.clear()
        XCTAssertNil(renderer.behindLayer.sublayers)
    }

    func testReduceMotionHoldsAndFades() throws {
        let sweep = try XCTUnwrap(FlairTextTreatments.treatment(id: "soft-sweep"))
        let target = FlairTreatmentTarget(lines: [CGRect(x: 0, y: 0, width: 100, height: 18)])
        let moving = FlairTextTreatments.plan(sweep, stage: .landed, time: 450, target: target)
        let still = FlairTextTreatments.plan(sweep, stage: .landed, time: 450, target: target, reduceMotion: true)
        XCTAssertEqual(moving.layers.first?.opacity ?? 0, 1, accuracy: 1e-9)
        XCTAssertEqual(still.layers.first?.opacity ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertTrue(still.reduced)
    }

    // MARK: Helpers

    static func target(_ json: FlairJSON) -> FlairTreatmentTarget {
        let lines = (json["lines"]?.array ?? []).map { l in
            CGRect(x: l["x"]!.number!, y: l["y"]!.number!, width: l["width"]!.number!, height: l["height"]!.number!)
        }
        let caret = json["caret"].map { FlairTreatmentCaret(x: $0["x"]!.number!, y: $0["y"]!.number!, height: $0["height"]!.number!) }
        return FlairTreatmentTarget(lines: lines, caret: caret, text: json["text"]?.string, label: json["label"]?.string,
                                    color: json["color"]?.string.flatMap { FlairRGBA(hex: $0) },
                                    background: json["background"]?.string.flatMap { FlairRGBA(hex: $0) })
    }

    static func rgba(_ json: FlairJSON?) -> [Double] { json?.array?.compactMap(\.number) ?? [] }

    static func assertClose(_ a: [Double], _ b: [Double], _ at: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(a.count, b.count, at, file: file, line: line)
        for (x, y) in zip(a, b) { XCTAssertEqual(x, y, accuracy: 1e-6, at, file: file, line: line) }
    }

    static func assertLayer(_ got: FlairTreatmentPlanLayer, _ w: FlairJSON, _ at: String) {
        let where_ = "\(at) \(got.source)"
        XCTAssertEqual(got.kind.rawValue, w["kind"]?.string, where_)
        XCTAssertEqual(got.z, w["z"]?.string, where_)
        XCTAssertEqual(got.blend, w["blend"]?.string, where_)
        assertClose([got.x, got.y, got.width, got.height, got.radius, got.opacity],
                    ["x", "y", "width", "height", "radius", "opacity"].map { w[$0]!.number! }, where_)
        assertClose([got.color.r, got.color.g, got.color.b, got.color.a], rgba(w["color"]), where_)
        XCTAssertEqual(got.stroke ?? 0, w["stroke"]?.number ?? 0, accuracy: 1e-9, where_)
        XCTAssertEqual(got.glow ?? 0, w["glow"]?.number ?? 0, accuracy: 1e-9, where_)
        XCTAssertEqual(got.text, w["text"]?.string, where_)
        XCTAssertEqual(got.size ?? 0, w["size"]?.number ?? 0, accuracy: 1e-9, where_)
        XCTAssertEqual(got.padX ?? 0, w["padX"]?.number ?? 0, accuracy: 1e-9, where_)
        if w["textColor"] != nil { assertClose(got.textColor.map { [$0.r, $0.g, $0.b, $0.a] } ?? [], rgba(w["textColor"]), where_) }
        let g = w["gradient"]
        XCTAssertEqual(got.gradient == nil, g == nil, where_)
        if let gg = got.gradient, let g {
            assertClose([gg.x0, gg.y0, gg.x1, gg.y1], ["x0", "y0", "x1", "y1"].map { g[$0]!.number! }, where_)
            let stops = g["stops"]!.array!
            XCTAssertEqual(gg.stops.count, stops.count, where_)
            for (s, ws) in zip(gg.stops, stops) {
                assertClose([s.offset, s.color.r, s.color.g, s.color.b, s.color.a], [ws["offset"]!.number!] + rgba(ws["color"]), where_)
            }
        }
    }
}
