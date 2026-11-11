// swift-tools-version: 5.9
// The manifest is at the repository root so the package can be used as a git dependency;
// its sources live under swift/.
import PackageDescription

let package = Package(
    name: "FlairEffects",
    // macOS 14 / iOS 17 because FlairEditorEffects depends on the editor's Swift package, which needs
    // them, and SwiftPM sets platforms for the whole package.
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(
            name: "FlairEffects",
            targets: ["FlairEffects"]
        ),
        // Flair as an effects provider for the Pixerate editors' Swift package (`FlairEffectProvider`).
        // Optional: an app that only takes FlairEffects never fetches the editor.
        .library(
            name: "FlairEditorEffects",
            targets: ["FlairEditorEffects"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/Pixerate/editor.git", from: "0.39.0"),
    ],
    targets: [
        .target(
            name: "FlairEffects",
            dependencies: [],
            path: "swift/Sources/FlairEffects",
            resources: [
                .process("Shaders"),
            ]
        ),
        .target(
            name: "FlairEditorEffects",
            dependencies: [
                "FlairEffects",
                .product(name: "PixerateCore", package: "editor"),
                .product(name: "PixeratePaint", package: "editor"),
            ],
            path: "swift/Sources/FlairEditorEffects",
            resources: [
                .copy("Resources/flair-effects.json"),
            ],
            // As the editor's own targets: async code runs on its caller's executor.
            swiftSettings: [.enableUpcomingFeature("NonisolatedNonsendingByDefault")]
        ),
        .testTarget(
            name: "FlairEffectsTests",
            dependencies: ["FlairEffects"],
            path: "swift/Tests/FlairEffectsTests"
        ),
        .testTarget(
            name: "FlairEditorEffectsTests",
            dependencies: [
                "FlairEditorEffects",
                "FlairEffects",
                .product(name: "PixerateCore", package: "editor"),
                .product(name: "PixeratePaint", package: "editor"),
            ],
            path: "swift/Tests/FlairEditorEffectsTests",
            swiftSettings: [.enableUpcomingFeature("NonisolatedNonsendingByDefault")]
        ),
    ]
)
