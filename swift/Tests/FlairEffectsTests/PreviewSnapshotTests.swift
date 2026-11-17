import AppKit
@testable import FlairEffects
import Metal
import SwiftUI
import XCTest

@MainActor
final class PreviewSnapshotTests: XCTestCase {
    func testRenderSwiftUIPreviews() throws {
        try XCTSkipIf(MTLCreateSystemDefaultDevice() == nil, "Metal device unavailable in this environment")

        let exportDir = ProcessInfo.processInfo.environment["FLAIR_PREVIEW_EXPORT_DIR"]
            .flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0, isDirectory: true) }

        if let exportDir {
            try FileManager.default.createDirectory(at: exportDir, withIntermediateDirectories: true)
        }

        let cases: [(name: String, view: AnyView)] = [
            ("Flair-MeshGradient-Sunset", AnyView(FlairEffectView(MeshGradient(preset: "Sunset"), isPaused: true, fixedTime: 0.5))),
            ("Flair-Aurora-Northern", AnyView(FlairEffectView(Aurora(preset: "Northern"), isPaused: true, fixedTime: 0.5))),
        ]

        for entry in cases {
            let png = try renderToPNG(view: entry.view, size: CGSize(width: 400, height: 260))
            XCTAssertGreaterThan(png.count, 0, "Empty PNG for \(entry.name)")

            if let exportDir {
                try png.write(to: exportDir.appendingPathComponent("\(entry.name).png"), options: .atomic)
            }
        }
    }

    private func renderToPNG<V: View>(
        view: V,
        size: CGSize
    ) throws -> Data {
        let hostingView = NSHostingView(rootView: view.frame(width: size.width, height: size.height))
        let bounds = NSRect(origin: .zero, size: size)
        hostingView.frame = bounds

        let window = NSWindow(
            contentRect: bounds,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.contentView = hostingView
        hostingView.layoutSubtreeIfNeeded()

        guard let rep = hostingView.bitmapImageRepForCachingDisplay(in: bounds) else {
            throw NSError(domain: "PreviewSnapshotTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to allocate bitmap rep"])
        }
        hostingView.cacheDisplay(in: bounds, to: rep)

        guard let data = rep.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "PreviewSnapshotTests", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG"])
        }
        window.orderOut(nil)
        return data
    }
}
