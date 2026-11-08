// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlairEffects",
    platforms: [
        .macOS(.v12),
        .iOS(.v15),
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
            ]
        ),
        .testTarget(
            name: "FlairEffectsTests",
            dependencies: ["FlairEffects"]
        ),
    ]
)
