@testable import FlairEditorEffects
import FlairEffects
import Metal
import PixerateCore
import PixeratePaint
import XCTest

/// The sample stroke paint is checked along: an S-curve across a 64 × 64 frame, as points from the top left.
private let paintSize = 64
private let paintStroke: [(Double, Double)] = (0...16).map { i in
    let t = Double(i) / 16
    return (8 + 48 * t, 32 - 16 * sin(t * .pi * 2))
}

/// A pixel's distance from the sample stroke.
private func strokeDistance(_ x: Double, _ y: Double) -> Double {
    var best = Double.infinity
    for i in 0..<(paintStroke.count - 1) {
        let (ax, ay) = paintStroke[i], (bx, by) = paintStroke[i + 1]
        let dx = bx - ax, dy = by - ay
        let t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / max(dx * dx + dy * dy, 1e-9)))
        best = min(best, hypot(x - ax - t * dx, y - ay - t * dy))
    }
    return best
}

/// Whether a control's schema is a path control (`format: "svg-path"` among its shapes).
private func isPathControl(_ schema: JSONValue?) -> Bool {
    (schema?.objectValue?["anyOf"]?.arrayValue ?? []).contains { $0.objectValue?["format"]?.stringValue == "svg-path" }
}

/// Paint hints, as the TypeScript adapter gives them (`flair-effects.json`): which effects make good
/// paint, and how an editor paints with them.
final class FlairPaintHintTests: XCTestCase {
    func testDeclaresPaintHintsAndCarriesThemOnSummariesAndDescriptions() async throws {
        let provider = FlairEffectProvider()
        XCTAssertEqual(provider.capabilities["paintHints"], .bool(true))
        let all = try await provider.list()
        let painted = all.filter { $0.json["paint"] != nil }
        let candidates = all.filter { !Set($0.uses).isDisjoint(with: ["generator", "overlay", "title"]) }
        XCTAssertGreaterThan(painted.count, 40)
        XCTAssertLessThan(painted.count, candidates.count / 2, "Well under half of the effects that draw a picture of their own make good paint")
        for summary in painted {
            let description = try await provider.describe(summary.id)
            XCTAssertEqual(description.json["paint"], summary.json["paint"], summary.id)
        }
        let planet = try await provider.describe("planet")
        XCTAssertNil(planet.json["paint"], "A framed object is not paint")
        let lava = try await provider.describe("lava-flow")
        XCTAssertEqual(lava.json["paint"], ["map": "stroke", "colors": ["uLava", "uHot"], "values": .object([:]), "live": true, "repeat": "mirror"])
    }

    func testEveryHintNamesRealControlsAndAPathControlForPathPaint() async throws {
        let provider = FlairEffectProvider()
        for summary in try await provider.list() {
            guard let paint = summary.json["paint"]?.objectValue else { continue }
            let d = try await provider.describe(summary.id)
            let properties = d.controls["properties"]?.objectValue ?? [:]
            let map = paint["map"]?.stringValue
            XCTAssertTrue(["path", "stroke", "canvas"].contains(map ?? ""), "\(d.id): map \(String(describing: map))")
            let colors = (paint["colors"]?.arrayValue ?? []).compactMap(\.stringValue)
            XCTAssertLessThanOrEqual(colors.count, 2, d.id)
            for name in colors {
                XCTAssertTrue(d.defaults[name]?.stringValue?.hasPrefix("#") == true, "\(d.id): \(name) is a colour control")
            }
            for (name, _) in paint["values"]?.objectValue ?? [:] {
                XCTAssertNotNil(properties[name], "\(d.id): \(name) is one of its controls")
            }
            XCTAssertNotNil(paint["live"]?.boolValue, d.id)
            if map == "path" { XCTAssertTrue(properties.contains { isPathControl($0.value) }, "\(d.id) has a path control") }
            if map == "stroke" { XCTAssertTrue(["repeat", "mirror", "clamp"].contains(paint["repeat"]?.stringValue ?? ""), d.id) }
            else { XCTAssertNil(paint["repeat"], d.id) }
        }
    }

    /// Each hinted effect, with its hint's values, drawn on the GPU at 64 × 64 (a path effect along the
    /// sample stroke): it draws something, and a path effect stays mostly clear away from the stroke.
    func testEveryHintedEffectPaintsAlongASampleStroke() async throws {
        try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil, "No Metal device.")
        let provider = FlairEffectProvider()
        let points: JSONValue = .array(paintStroke.flatMap { [JSONValue.number($0.0), .number($0.1)] })
        var checked = 0
        for summary in try await provider.list() {
            guard let paint = summary.json["paint"]?.objectValue else { continue }
            let d = try await provider.describe(summary.id)
            var values = paint["values"]?.objectValue ?? [:]
            let isPath = paint["map"]?.stringValue == "path"
            if isPath, let control = (d.controls["properties"]?.objectValue ?? [:]).first(where: { isPathControl($0.value) })?.key {
                values[control] = points
            }
            let r = try provider.createRenderer(d.id, width: paintSize, height: paintSize)
            defer { r.dispose() }
            let frame = try await r.render(EffectRenderRequest(time: 1500, values: values))
            var drawn = 0, outside = 0, clearOutside = 0
            for y in 0..<paintSize {
                for x in 0..<paintSize {
                    let alpha = frame.data[(y * paintSize + x) * 4 + 3]
                    if alpha > 16 { drawn += 1 }
                    if strokeDistance(Double(x) + 0.5, Double(y) + 0.5) > 14 {
                        outside += 1
                        if alpha <= 16 { clearOutside += 1 }
                    }
                }
            }
            XCTAssertGreaterThanOrEqual(drawn, 8, "\(d.id): painted with its hint, it draws almost nothing")
            if isPath {
                XCTAssertGreaterThanOrEqual(Double(clearOutside) / Double(outside), 0.75, "\(d.id): as path paint, it is clear away from the stroke")
            }
            checked += 1
        }
        XCTAssertGreaterThan(checked, 40)
    }
}
