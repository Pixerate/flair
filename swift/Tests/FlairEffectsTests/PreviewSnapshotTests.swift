import CoreGraphics
@testable import FlairEffects
import ImageIO
import Metal
import UniformTypeIdentifiers
import XCTest

/// Renders the effects shown in `FlairEffectView` previews to PNGs for `docs/previews/`.
///
/// `FlairEffectView` draws through an `MTKView`, whose Metal layer `NSView.cacheDisplay(in:to:)` does not
/// capture (it produced blank white images), so the snapshots go through the same `FlairRenderer` the view
/// uses, offscreen, at a fixed time.
final class PreviewSnapshotTests: XCTestCase {
    func testRenderSwiftUIPreviews() throws {
        try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil, "Metal device unavailable in this environment")

        let exportDir = ProcessInfo.processInfo.environment["FLAIR_PREVIEW_EXPORT_DIR"]
            .flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0, isDirectory: true) }

        if let exportDir {
            try FileManager.default.createDirectory(at: exportDir, withIntermediateDirectories: true)
        }

        let renderer = try FlairRenderer()
        let cases: [(name: String, effect: AnyFlairEffect)] = [
            ("Flair-MeshGradient-Sunset", AnyFlairEffect(MeshGradient(preset: "Sunset"))),
            ("Flair-Aurora-Northern", AnyFlairEffect(Aurora(preset: "Northern"))),
            ("Flair-Daydream-Daydream", AnyFlairEffect(Daydream(preset: "Daydream"))),
            ("Flair-Daydream-Memory", AnyFlairEffect(Daydream(preset: "Memory"))),
        ]

        for entry in cases {
            let image = try renderer.renderCGImage(anyEffect: entry.effect, width: 400, height: 260, time: 0.5)
            XCTAssertFalse(isUniform(image), "\(entry.name) rendered a single flat colour")

            let png = try pngData(image)
            XCTAssertGreaterThan(png.count, 0, "Empty PNG for \(entry.name)")

            if let exportDir {
                try png.write(to: exportDir.appendingPathComponent("\(entry.name).png"), options: .atomic)
            }
        }
    }

    private func pngData(_ image: CGImage) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            throw NSError(domain: "PreviewSnapshotTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create PNG destination"])
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw NSError(domain: "PreviewSnapshotTests", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG"])
        }
        return data as Data
    }

    /// True when every pixel matches the first one, as a blank or failed render would.
    private func isUniform(_ image: CGImage) -> Bool {
        let width = image.width
        let height = image.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return true }
        let first = pixels[0..<4]
        return stride(from: 4, to: pixels.count, by: 4).allSatisfy { pixels[$0..<$0 + 4] == first }
    }
}
