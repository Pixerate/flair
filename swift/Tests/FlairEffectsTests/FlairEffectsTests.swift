import CoreGraphics
import Foundation
import Metal
import XCTest
@testable import FlairEffects

final class FlairEffectsTests: XCTestCase {
    func testCatalogMetadataAndLookup() {
        XCTAssertGreaterThanOrEqual(FlairCatalog.all.count, 440)
        let mesh = FlairCatalog.effect(id: "mesh-gradient")
        XCTAssertNotNil(mesh)
        XCTAssertEqual(mesh?.effectName, "Mesh gradient")
        XCTAssertEqual(mesh?.category, "gradient")
        XCTAssertEqual(mesh?.functionName, "flair_mesh_gradient_frag")
        XCTAssertTrue(mesh?.presetNames.contains("Sunset") == true)

        let gradients = FlairCatalog.effects(inCategory: "gradient")
        XCTAssertFalse(gradients.isEmpty)
        let neonTagged = FlairCatalog.effects(withTag: "neon")
        XCTAssertFalse(neonTagged.isEmpty)
    }

    func testTypedStructPresetsAndUniformPacking() {
        var mesh = MeshGradient(preset: "Sunset")
        XCTAssertEqual(MeshGradient.effectId, "mesh-gradient")
        XCTAssertGreaterThanOrEqual(MeshGradient.uniformByteLength, 992)

        mesh.speed = 1.5
        let state = FlairFrameState(width: 800, height: 600, time: 1.25, delta: 1.0 / 60.0, frame: 75)
        let data = mesh.packedUniforms(state: state)
        XCTAssertEqual(data.count, MeshGradient.uniformByteLength)

        data.withUnsafeBytes { raw in
            let w = raw.load(fromByteOffset: 0, as: Float.self)
            let h = raw.load(fromByteOffset: 4, as: Float.self)
            let t = raw.load(fromByteOffset: 12, as: Float.self)
            let f = raw.load(fromByteOffset: 20, as: Int32.self)
            XCTAssertEqual(w, 800)
            XCTAssertEqual(h, 600)
            XCTAssertEqual(t, 1.25, accuracy: 1e-5)
            XCTAssertEqual(f, 75)
        }
    }

    func testCodableJSONCompatibilityWithWebControls() throws {
        // Test decoding web control JSON (uniform names + hex colors + property names)
        let json = """
        {
          "uSpeed": 1.75,
          "uColorA": "#ff0080",
          "grain": 0.15
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(MeshGradient.self, from: json)
        XCTAssertEqual(decoded.speed, 1.75, accuracy: 1e-5)
        XCTAssertEqual(decoded.colorA.x, 1.0, accuracy: 0.01)
        XCTAssertEqual(decoded.colorA.y, 0.0, accuracy: 0.01)
        XCTAssertEqual(decoded.colorA.z, 128.0 / 255.0, accuracy: 0.01)
        XCTAssertEqual(decoded.grain, 0.15, accuracy: 1e-5)

        let reencoded = try JSONEncoder().encode(decoded)
        let roundTrip = try JSONDecoder().decode(MeshGradient.self, from: reencoded)
        XCTAssertEqual(roundTrip, decoded)
    }

    func testPathAndTextRasterizers() {
        let pathFloats = FlairPathRasterizer.rasterize(
            path: "M 0 0 L 100 0 L 100 100 Z",
            fit: .contain,
            margin: 0.1,
            width: 200,
            height: 200
        )
        XCTAssertEqual(pathFloats.count, 256 * 2 * 4)
        // Total length in row 1 (.z) should be positive, and closed (.w) == 1.0
        let totalLength = pathFloats[256 * 4 + 2]
        let isClosed = pathFloats[256 * 4 + 3]
        XCTAssertGreaterThan(totalLength, 100)
        XCTAssertEqual(isClosed, 1.0)

        let textBytes = FlairTextRasterizer.rasterize(text: "FLAIR", width: 256, height: 64)
        XCTAssertEqual(textBytes.count, 256 * 64 * 4)
        let nonZeroAlpha = textBytes.stride(by: 4, offset: 3).filter { $0 > 0 }.count
        XCTAssertGreaterThan(nonZeroAlpha, 50)
    }

    func testPointerAudioAndScrollTrackers() {
        var state = FlairFrameState(width: 400, height: 300, time: 1.0, delta: 1.0 / 60.0)
        let pointer = FlairPointerTracker()
        pointer.down(x: 120, y: 80, time: 1.0)
        pointer.move(x: 140, y: 95, time: 1.016)
        pointer.apply(to: &state)
        XCTAssertEqual(state.mouse.x, 140)
        XCTAssertEqual(state.mouse.y, 95)
        XCTAssertEqual(state.clicks.count, 1)
        XCTAssertFalse(state.trail.isEmpty)

        let audio = FlairAudioAnalyzer()
        let sineWave = (0..<512).map { sin(Float($0) * 0.15) * 0.8 }
        audio.update(samples: sineWave, sampleRate: 44100, time: 1.0)
        audio.apply(to: &state)
        XCTAssertGreaterThan(state.audio.x, 0.1)

        let scroll = FlairScrollTracker()
        scroll.update(progress: 0.5, page: 1.2, time: 1.0)
        scroll.apply(to: &state)
        XCTAssertEqual(state.scroll.x, 0.5, accuracy: 1e-5)
        XCTAssertEqual(state.scroll.y, 1.2, accuracy: 1e-5)
    }

    func testOffscreenMetalRenderingAcrossAllPhases() throws {
        guard MTLCreateSystemDefaultDevice() != nil else {
            throw XCTSkip("No Metal device available.")
        }
        let renderer = try FlairRenderer()

        // Phase 1: Single-pass procedural shader (MeshGradient)
        let meshImage = try renderer.renderCGImage(effect: MeshGradient(preset: "Prism"), width: 96, height: 64, time: 0.5)
        XCTAssertEqual(meshImage.width, 96)
        XCTAssertEqual(meshImage.height, 64)

        // Phase 2: Sampler2D / Text / Path shaders (Crt, ShaderText, LaserWrite)
        let crtImage = try renderer.renderCGImage(effect: Crt(), width: 96, height: 64, time: 0.5)
        XCTAssertEqual(crtImage.width, 96)
        let textImage = try renderer.renderCGImage(effect: ShaderText(), width: 96, height: 64, time: 0.5)
        XCTAssertEqual(textImage.width, 96)
        if let pathEffect = FlairCatalog.effect(id: "neon-path") {
            let pathImg = try renderer.renderCGImage(anyEffect: pathEffect, width: 96, height: 64, time: 0.5)
            XCTAssertEqual(pathImg.width, 96)
        }

        // Phase 3: Multi-pass pipeline (MeshGradient -> Crt filter -> Sparkles overlay)
        let pipeline = FlairPipeline.effectStack(
            renderer: renderer,
            base: AnyFlairEffect(MeshGradient(preset: "Prism")),
            overlays: [
                AnyFlairEffect(Crt()),
                AnyFlairEffect(Sparkles())
            ]
        )
        let stackedImage = try pipeline.renderCGImage(width: 96, height: 64, time: 0.5)
        XCTAssertEqual(stackedImage.width, 96)
        XCTAssertEqual(stackedImage.height, 64)

        // Phase 4: Audio / pointer reactive shader
        var state = FlairFrameState(width: 96, height: 64, time: 0.8)
        state.audio = SIMD4<Float>(0.7, 0.8, 0.5, 0.4)
        state.pointer = SIMD4<Float>(10, -5, 1, 1)
        if let audioEffect = FlairCatalog.effect(id: "audio-spectrum") ?? FlairCatalog.all.first(where: { $0.phase == 4 }) {
            let audioImage = try renderer.renderCGImage(anyEffect: audioEffect, width: 96, height: 64, time: 0.8, state: state)
            XCTAssertEqual(audioImage.width, 96)
        }
    }
}

private extension Array {
    func stride(by step: Int, offset: Int = 0) -> [Element] {
        var result: [Element] = []
        var i = offset
        while i < count {
            result.append(self[i])
            i += step
        }
        return result
    }
}
