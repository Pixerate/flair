// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlairEffects",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(
            name: "FlairEffects",
            targets: ["FlairEffects"]
        ),
    ],
    targets: [
        .target(
            name: "FlairEffects",
            resources: [
                .process("Shaders"),
                .copy("Resources/flair-text-treatments.json"),
            ]
        ),
        .testTarget(
            name: "FlairEffectsTests",
            dependencies: ["FlairEffects"]
        ),
    ]
)
