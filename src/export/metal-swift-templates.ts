/**
 * Swift runtime templates emitted into the `FlairEffects` Swift package
 * (`swift/Package.swift` and `swift/Sources/FlairEffects/*.swift`).
 */

export const PACKAGE_SWIFT_TEMPLATE = `// swift-tools-version: 5.9
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
            ]
        ),
        .testTarget(
            name: "FlairEffectsTests",
            dependencies: ["FlairEffects"]
        ),
    ]
)
`;

export const VERTEX_METAL_TEMPLATE = `#include <metal_stdlib>
using namespace metal;

struct FlairVertexOut {
    float4 position [[position]];
};

vertex FlairVertexOut flair_fullscreen_vertex(uint vid [[vertex_id]]) {
    FlairVertexOut out;
    float2 uv = float2((vid << 1) & 2, vid & 2);
    out.position = float4(uv * 2.0 - 1.0, 0.0, 1.0);
    return out;
}
`;

export const FLAIR_TYPES_SWIFT = `import CoreGraphics
import Foundation
import simd

@inline(__always) public func flairVec2(_ x: Float, _ y: Float) -> SIMD2<Float> { SIMD2<Float>(x, y) }
@inline(__always) public func flairVec3(_ x: Float, _ y: Float, _ z: Float) -> SIMD3<Float> { SIMD3<Float>(x, y, z) }
@inline(__always) public func flairVec4(_ x: Float, _ y: Float, _ z: Float, _ w: Float) -> SIMD4<Float> { SIMD4<Float>(x, y, z, w) }

/// The uniform types a Flair shader control can have.
public enum FlairControlType: String, Codable, Sendable, Equatable {
    case float
    case int
    case bool
    case vec2
    case vec3
    case vec4
    case sampler2D
    case path
}

/// How an image texture is filtered when sampled.
public enum FlairTextureFilter: String, Codable, Sendable, Equatable {
    case mipmap
    case linear
    case nearest
}

/// How texture coordinates outside 0...1 wrap.
public enum FlairTextureWrap: String, Codable, Sendable, Equatable {
    case \`repeat\` = "repeat"
    case clamp
    case mirror
}

/// How an SVG path is fitted into the frame (the shader's \`PATH\` helpers do the fitting, so a path
/// follows resizes). \`fill\` has no shader equivalent and is drawn as \`none\`.
public enum FlairPathFit: String, Codable, Sendable, Equatable {
    case contain
    case cover
    case fill
    case none
}

/// Built-in sample pictures matching \`@pixerate/flair\`'s \`SAMPLE_IMAGES\`.
public enum FlairSampleImage: String, Codable, Sendable, Equatable, CaseIterable {
    case landscape
    case city
    case portrait
    case portrait2
    case cutout
    case greenScreen
    case logo
    case heart
    case icon
}

/// Metadata describing a single \`// @control\` uniform on a \`FlairEffect\`.
public struct FlairControlDescriptor: Sendable, Equatable {
    public let name: String
    public let property: String
    public let type: FlairControlType
    public let label: String
    public let isColor: Bool
    public let min: Float
    public let max: Float
    public let step: Float
    public let unit: String?
    public let filter: FlairTextureFilter?
    public let wrap: FlairTextureWrap?
    public let pathFit: FlairPathFit?
    public let pathMargin: Float?

    public init(
        name: String,
        property: String,
        type: FlairControlType,
        label: String,
        isColor: Bool = false,
        min: Float = 0,
        max: Float = 1,
        step: Float = 0.005,
        unit: String? = nil,
        filter: FlairTextureFilter? = nil,
        wrap: FlairTextureWrap? = nil,
        pathFit: FlairPathFit? = nil,
        pathMargin: Float? = nil
    ) {
        self.name = name
        self.property = property
        self.type = type
        self.label = label
        self.isColor = isColor
        self.min = min
        self.max = max
        self.step = step
        self.unit = unit
        self.filter = filter
        self.wrap = wrap
        self.pathFit = pathFit
        self.pathMargin = pathMargin
    }
}

/// Metadata describing a texture or path sampler slot bound at \`[[texture(N)]]\`, \`[[sampler(N)]]\`.
public struct FlairSamplerBinding: Sendable, Equatable {
    public let name: String
    public let property: String
    public let type: FlairControlType
    public let binding: Int
    public let filter: FlairTextureFilter
    public let wrap: FlairTextureWrap
    public let pathFit: FlairPathFit
    public let pathMargin: Float

    public init(
        name: String,
        property: String,
        type: FlairControlType,
        binding: Int,
        filter: FlairTextureFilter = .mipmap,
        wrap: FlairTextureWrap = .repeat,
        pathFit: FlairPathFit = .contain,
        pathMargin: Float = 0.1
    ) {
        self.name = name
        self.property = property
        self.type = type
        self.binding = binding
        self.filter = filter
        self.wrap = wrap
        self.pathFit = pathFit
        self.pathMargin = pathMargin
    }
}

/// Sendable wrapper for \`CGImage\` values stored on a \`FlairTextureInput\`.
public struct FlairSendableImage: @unchecked Sendable, Equatable {
    public let cgImage: CGImage

    public init(_ cgImage: CGImage) {
        self.cgImage = cgImage
    }

    public static func == (lhs: FlairSendableImage, rhs: FlairSendableImage) -> Bool {
        lhs.cgImage === rhs.cgImage
            || (lhs.cgImage.width == rhs.cgImage.width
                && lhs.cgImage.height == rhs.cgImage.height
                && lhs.cgImage.bytesPerRow == rhs.cgImage.bytesPerRow)
    }
}

/// Value bound to a \`sampler2D\` or \`path\` control on a \`FlairEffect\`.
public enum FlairTextureInput: Sendable, Equatable, Codable {
    case none
    case sample(FlairSampleImage)
    case text(String, font: String = "Helvetica-Bold", weight: Double = 900, width: Int = 1024, height: Int = 256)
    case path(String, fit: FlairPathFit = .contain, margin: Float = 0.1)
    /// Points in frame pixels from the top left (y down), like the web \`[x0, y0, x1, y1, …]\` path value.
    case points([SIMD2<Float>])
    case url(String)
    case pngData(Data)
    case image(FlairSendableImage)

    public static func cgImage(_ image: CGImage) -> FlairTextureInput {
        .image(FlairSendableImage(image))
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .none
            return
        }
        if let coords = try? container.decode([Float].self) {
            var pts: [SIMD2<Float>] = []
            pts.reserveCapacity(coords.count / 2)
            var i = 0
            while i + 1 < coords.count {
                pts.append(SIMD2<Float>(coords[i], coords[i + 1]))
                i += 2
            }
            self = .points(pts)
            return
        }
        let str = (try? container.decode(String.self)) ?? ""
        self = FlairTextureInput.fromControlString(str)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .none:
            try container.encode("")
        case .sample(let s):
            try container.encode("sample:\\(s.rawValue)")
        case .text(let t, _, _, _, _):
            try container.encode("text:\\(t)")
        case .path(let d, _, _):
            try container.encode(d)
        case .points(let pts):
            var flat: [Float] = []
            flat.reserveCapacity(pts.count * 2)
            for p in pts {
                flat.append(p.x)
                flat.append(p.y)
            }
            try container.encode(flat)
        case .url(let u):
            try container.encode(u)
        case .pngData(let data):
            try container.encode("data:image/png;base64,\\(data.base64EncodedString())")
        case .image:
            try container.encode("[CGImage]")
        }
    }

    public static func fromControlString(_ raw: String, defaultFit: FlairPathFit = .contain, defaultMargin: Float = 0.1) -> FlairTextureInput {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .none }
        if trimmed.hasPrefix("sample:") {
            let name = String(trimmed.dropFirst("sample:".count))
            if let s = FlairSampleImage(rawValue: name) { return .sample(s) }
        }
        if trimmed.hasPrefix("text:") {
            return .text(String(trimmed.dropFirst("text:".count)))
        }
        if trimmed.hasPrefix("data:image/svg+xml;charset=utf-8,"),
           let comma = trimmed.firstIndex(of: ",") {
            let encoded = String(trimmed[trimmed.index(after: comma)...])
            if let xml = encoded.removingPercentEncoding,
               let range = xml.range(of: "<text[^>]*>([\\\\s\\\\S]*?)</text>", options: .regularExpression) {
                let tag = String(xml[range])
                if let gt = tag.firstIndex(of: ">"),
                   let lt = tag.range(of: "</text>", options: .backwards)?.lowerBound,
                   gt < lt {
                    let body = String(tag[tag.index(after: gt)..<lt])
                        .replacingOccurrences(of: "&amp;", with: "&")
                        .replacingOccurrences(of: "&lt;", with: "<")
                        .replacingOccurrences(of: "&gt;", with: ">")
                        .replacingOccurrences(of: "&quot;", with: "\\"")
                        .replacingOccurrences(of: "&#39;", with: "'")
                    return .text(body)
                }
            }
        }
        if let first = trimmed.first, (first == "M" || first == "m") {
            return .path(trimmed, fit: defaultFit, margin: defaultMargin)
        }
        return .url(trimmed)
    }
}

/// Built-in uniform state for a single rendered frame.
public struct FlairFrameState: Sendable, Equatable {
    public static let builtinByteLength = 992
    public static let maxClicks = 8
    public static let maxTrail = 32
    public static let spectrumBins = 64

    public var width: Float
    public var height: Float
    public var time: Float
    public var delta: Float
    public var frame: Int32
    public var beat: Float
    public var flipY: Bool
    public var mouse: SIMD4<Float>
    public var pointer: SIMD4<Float>
    public var clicks: [SIMD4<Float>]
    public var trail: [SIMD4<Float>]
    public var audio: SIMD4<Float>
    public var spectrum: [Float]
    public var scroll: SIMD4<Float>

    public init(
        width: Float = 640,
        height: Float = 360,
        time: Float = 0,
        delta: Float = 1.0 / 60.0,
        frame: Int32 = 0,
        beat: Float = 0,
        flipY: Bool = true,
        mouse: SIMD4<Float> = .zero,
        pointer: SIMD4<Float> = .zero,
        clicks: [SIMD4<Float>] = [],
        trail: [SIMD4<Float>] = [],
        audio: SIMD4<Float> = .zero,
        spectrum: [Float] = [],
        scroll: SIMD4<Float> = .zero
    ) {
        self.width = width
        self.height = height
        self.time = time
        self.delta = delta
        self.frame = frame
        self.beat = beat
        self.flipY = flipY
        self.mouse = mouse
        self.pointer = pointer
        self.clicks = clicks
        self.trail = trail
        self.audio = audio
        self.spectrum = spectrum
        self.scroll = scroll
    }

    /// Writes the 992-byte \`std140\` built-in uniform prefix into \`buffer\`.
    public func encodeBuiltins(into buffer: UnsafeMutableRawPointer) {
        memset(buffer, 0, FlairFrameState.builtinByteLength)
        FlairUniformEncoder.writeVec3(SIMD3<Float>(width, height, 1.0), to: buffer, at: 0)
        FlairUniformEncoder.writeFloat(time, to: buffer, at: 12)
        FlairUniformEncoder.writeFloat(delta, to: buffer, at: 16)
        FlairUniformEncoder.writeInt(frame, to: buffer, at: 20)
        FlairUniformEncoder.writeFloat(beat, to: buffer, at: 24)
        FlairUniformEncoder.writeFloat(flipY ? 1.0 : 0.0, to: buffer, at: 28)
        FlairUniformEncoder.writeVec4(mouse, to: buffer, at: 32)
        FlairUniformEncoder.writeVec4(pointer, to: buffer, at: 48)

        let clickCount = Swift.min(clicks.count, FlairFrameState.maxClicks)
        for i in 0..<clickCount {
            FlairUniformEncoder.writeVec4(clicks[i], to: buffer, at: 64 + i * 16)
        }

        let trailCount = Swift.min(trail.count, FlairFrameState.maxTrail)
        for i in 0..<trailCount {
            FlairUniformEncoder.writeVec4(trail[i], to: buffer, at: 192 + i * 16)
        }

        FlairUniformEncoder.writeVec4(audio, to: buffer, at: 704)

        let specCount = Swift.min(spectrum.count, FlairFrameState.spectrumBins)
        for i in 0..<specCount {
            FlairUniformEncoder.writeFloat(spectrum[i], to: buffer, at: 720 + i * 4)
        }

        FlairUniformEncoder.writeVec4(scroll, to: buffer, at: 976)
    }
}

/// Low-level \`std140\` byte writer and value clamping helpers used by generated \`FlairEffect\` structs.
public enum FlairUniformEncoder {
    @inline(__always)
    public static func writeFloat(_ value: Float, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        buffer.storeBytes(of: value, toByteOffset: offset, as: Float.self)
    }

    @inline(__always)
    public static func writeInt(_ value: Int32, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        buffer.storeBytes(of: value, toByteOffset: offset, as: Int32.self)
    }

    @inline(__always)
    public static func writeBool(_ value: Bool, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        let bits: UInt32 = value ? 1 : 0
        buffer.storeBytes(of: bits, toByteOffset: offset, as: UInt32.self)
    }

    @inline(__always)
    public static func writeVec2(_ value: SIMD2<Float>, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        buffer.storeBytes(of: value.x, toByteOffset: offset, as: Float.self)
        buffer.storeBytes(of: value.y, toByteOffset: offset + 4, as: Float.self)
    }

    @inline(__always)
    public static func writeVec3(_ value: SIMD3<Float>, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        buffer.storeBytes(of: value.x, toByteOffset: offset, as: Float.self)
        buffer.storeBytes(of: value.y, toByteOffset: offset + 4, as: Float.self)
        buffer.storeBytes(of: value.z, toByteOffset: offset + 8, as: Float.self)
    }

    @inline(__always)
    public static func writeVec4(_ value: SIMD4<Float>, to buffer: UnsafeMutableRawPointer, at offset: Int) {
        buffer.storeBytes(of: value.x, toByteOffset: offset, as: Float.self)
        buffer.storeBytes(of: value.y, toByteOffset: offset + 4, as: Float.self)
        buffer.storeBytes(of: value.z, toByteOffset: offset + 8, as: Float.self)
        buffer.storeBytes(of: value.w, toByteOffset: offset + 12, as: Float.self)
    }

    @inline(__always)
    public static func clampFloat(_ value: Float, min lo: Float? = nil, max hi: Float? = nil) -> Float {
        var v = value
        if let lo = lo, v < lo { v = lo }
        if let hi = hi, v > hi { v = hi }
        return v
    }

    @inline(__always)
    public static func clampInt(_ value: Int32, min lo: Int32? = nil, max hi: Int32? = nil) -> Int32 {
        var v = value
        if let lo = lo, v < lo { v = lo }
        if let hi = hi, v > hi { v = hi }
        return v
    }

    @inline(__always)
    public static func clampVec2(_ value: SIMD2<Float>, min lo: Float? = nil, max hi: Float? = nil) -> SIMD2<Float> {
        SIMD2<Float>(clampFloat(value.x, min: lo, max: hi), clampFloat(value.y, min: lo, max: hi))
    }

    @inline(__always)
    public static func clampVec3(_ value: SIMD3<Float>, min lo: Float? = nil, max hi: Float? = nil) -> SIMD3<Float> {
        SIMD3<Float>(
            clampFloat(value.x, min: lo, max: hi),
            clampFloat(value.y, min: lo, max: hi),
            clampFloat(value.z, min: lo, max: hi)
        )
    }

    @inline(__always)
    public static func clampVec4(_ value: SIMD4<Float>, min lo: Float? = nil, max hi: Float? = nil) -> SIMD4<Float> {
        SIMD4<Float>(
            clampFloat(value.x, min: lo, max: hi),
            clampFloat(value.y, min: lo, max: hi),
            clampFloat(value.z, min: lo, max: hi),
            clampFloat(value.w, min: lo, max: hi)
        )
    }
}

/// Loose JSON value representation so effects decode web control values (\`flair export -v\`) seamlessly.
public enum FlairJSONValue: Codable, Sendable, Equatable {
    case number(Double)
    case bool(Bool)
    case string(String)
    case array([Double])
    case null

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let b = try? c.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? c.decode(Double.self) {
            self = .number(n)
        } else if let s = try? c.decode(String.self) {
            self = .string(s)
        } else if let a = try? c.decode([Double].self) {
            self = .array(a)
        } else {
            self = .null
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .null: try c.encodeNil()
        }
    }
}

/// Helper used by generated \`FlairEffect\` structs to decode and encode control JSON dictionaries.
public struct FlairJSONBag: Sendable {
    public var values: [String: FlairJSONValue]

    public init(values: [String: FlairJSONValue] = [:]) {
        self.values = values
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.values = (try? container.decode([String: FlairJSONValue].self)) ?? [:]
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(values)
    }

    private func lookup(_ uniform: String, _ property: String) -> FlairJSONValue? {
        values[uniform] ?? values[property]
    }

    public func decodeFloat(_ uniform: String, _ property: String, default def: Float, min lo: Float? = nil, max hi: Float? = nil) -> Float {
        guard let v = lookup(uniform, property), case .number(let n) = v, n.isFinite else { return def }
        return FlairUniformEncoder.clampFloat(Float(n), min: lo, max: hi)
    }

    public func decodeInt(_ uniform: String, _ property: String, default def: Int32, min lo: Int32? = nil, max hi: Int32? = nil) -> Int32 {
        guard let v = lookup(uniform, property), case .number(let n) = v, n.isFinite else { return def }
        return FlairUniformEncoder.clampInt(Int32(n.rounded()), min: lo, max: hi)
    }

    public func decodeBool(_ uniform: String, _ property: String, default def: Bool) -> Bool {
        guard let v = lookup(uniform, property) else { return def }
        switch v {
        case .bool(let b): return b
        case .number(let n): return n != 0
        default: return def
        }
    }

    public func decodeVec2(_ uniform: String, _ property: String, default def: SIMD2<Float>, min lo: Float? = nil, max hi: Float? = nil) -> SIMD2<Float> {
        guard let v = lookup(uniform, property), case .array(let a) = v, a.count >= 2 else { return def }
        return FlairUniformEncoder.clampVec2(SIMD2<Float>(Float(a[0]), Float(a[1])), min: lo, max: hi)
    }

    public func decodeVec3(_ uniform: String, _ property: String, default def: SIMD3<Float>, isColor: Bool = false, min lo: Float? = nil, max hi: Float? = nil) -> SIMD3<Float> {
        guard let v = lookup(uniform, property) else { return def }
        switch v {
        case .array(let a) where a.count >= 3:
            let vec = SIMD3<Float>(Float(a[0]), Float(a[1]), Float(a[2]))
            return isColor ? FlairUniformEncoder.clampVec3(vec, min: 0, max: 1) : FlairUniformEncoder.clampVec3(vec, min: lo, max: hi)
        case .string(let s) where isColor:
            if let rgba = FlairJSONBag.parseHexColor(s) {
                return SIMD3<Float>(rgba.x, rgba.y, rgba.z)
            }
            return def
        default:
            return def
        }
    }

    public func decodeVec4(_ uniform: String, _ property: String, default def: SIMD4<Float>, isColor: Bool = false, min lo: Float? = nil, max hi: Float? = nil) -> SIMD4<Float> {
        guard let v = lookup(uniform, property) else { return def }
        switch v {
        case .array(let a) where a.count >= 4:
            let vec = SIMD4<Float>(Float(a[0]), Float(a[1]), Float(a[2]), Float(a[3]))
            return isColor ? FlairUniformEncoder.clampVec4(vec, min: 0, max: 1) : FlairUniformEncoder.clampVec4(vec, min: lo, max: hi)
        case .string(let s) where isColor:
            return FlairJSONBag.parseHexColor(s) ?? def
        default:
            return def
        }
    }

    public func decodeTexture(_ uniform: String, _ property: String, default def: FlairTextureInput, fit: FlairPathFit = .contain, margin: Float = 0.1) -> FlairTextureInput {
        guard let v = lookup(uniform, property) else { return def }
        switch v {
        case .string(let s):
            return FlairTextureInput.fromControlString(s, defaultFit: fit, defaultMargin: margin)
        case .array(let a) where a.count >= 4:
            var pts: [SIMD2<Float>] = []
            var i = 0
            while i + 1 < a.count {
                pts.append(SIMD2<Float>(Float(a[i]), Float(a[i + 1])))
                i += 2
            }
            return .points(pts)
        default:
            return def
        }
    }

    public mutating func encodeFloat(_ value: Float, for key: String) {
        values[key] = .number(Double(value))
    }

    public mutating func encodeInt(_ value: Int32, for key: String) {
        values[key] = .number(Double(value))
    }

    public mutating func encodeBool(_ value: Bool, for key: String) {
        values[key] = .bool(value)
    }

    public mutating func encodeVec2(_ value: SIMD2<Float>, for key: String) {
        values[key] = .array([Double(value.x), Double(value.y)])
    }

    public mutating func encodeVec3(_ value: SIMD3<Float>, for key: String) {
        values[key] = .array([Double(value.x), Double(value.y), Double(value.z)])
    }

    public mutating func encodeVec4(_ value: SIMD4<Float>, for key: String) {
        values[key] = .array([Double(value.x), Double(value.y), Double(value.z), Double(value.w)])
    }

    public mutating func encodeTexture(_ value: FlairTextureInput, for key: String) {
        switch value {
        case .none:
            values[key] = .string("")
        case .sample(let s):
            values[key] = .string("sample:\\(s.rawValue)")
        case .text(let t, _, _, _, _):
            values[key] = .string("text:\\(t)")
        case .path(let d, _, _):
            values[key] = .string(d)
        case .points(let pts):
            var flat: [Double] = []
            for p in pts {
                flat.append(Double(p.x))
                flat.append(Double(p.y))
            }
            values[key] = .array(flat)
        case .url(let u):
            values[key] = .string(u)
        case .pngData(let data):
            values[key] = .string("data:image/png;base64,\\(data.base64EncodedString())")
        case .image:
            values[key] = .string("[CGImage]")
        }
    }

    public static func parseHexColor(_ raw: String) -> SIMD4<Float>? {
        var hex = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        if hex.count == 3 || hex.count == 4 {
            hex = hex.map { "\\($0)\\($0)" }.joined()
        }
        guard hex.count == 6 || hex.count == 8, let val = UInt64(hex, radix: 16) else {
            return nil
        }
        if hex.count == 6 {
            let r = Float((val >> 16) & 0xFF) / 255.0
            let g = Float((val >> 8) & 0xFF) / 255.0
            let b = Float(val & 0xFF) / 255.0
            return SIMD4<Float>(r, g, b, 1.0)
        } else {
            let r = Float((val >> 24) & 0xFF) / 255.0
            let g = Float((val >> 16) & 0xFF) / 255.0
            let b = Float((val >> 8) & 0xFF) / 255.0
            let a = Float(val & 0xFF) / 255.0
            return SIMD4<Float>(r, g, b, a)
        }
    }
}
`;

export const FLAIR_EFFECT_SWIFT = `import Foundation

/// A Shadertoy-style catalog effect compiled to Metal Shading Language with typed controls and presets.
public protocol FlairEffect: Codable, Sendable, Equatable {
    /// Catalog identifier (e.g. \`"mesh-gradient"\`).
    static var effectId: String { get }
    /// Human-readable display name (e.g. \`"Mesh gradient"\`).
    static var effectName: String { get }
    /// Catalog category (e.g. \`"gradients"\`).
    static var category: String { get }
    /// One-sentence visual description.
    static var effectDescription: String { get }
    /// Search tags from the catalog.
    static var tags: [String] { get }
    /// Metal pipeline phase (1: procedural, 2: texture/path inputs, 4: audio/pointer/scroll built-ins).
    static var phase: Int { get }
    /// Unique Metal fragment shader entry-point name (e.g. \`"flair_mesh_gradient_frag"\`).
    static var functionName: String { get }
    /// Total byte size of the \`FlairUniforms\` \`std140\` buffer at \`[[buffer(0)]]\`.
    static var uniformByteLength: Int { get }
    /// Whether the shader outputs alpha for compositing over other content.
    static var isTransparent: Bool { get }
    /// Exact loop duration in seconds, if the shader loops seamlessly.
    static var loopDuration: Double? { get }
    /// Control descriptors in declaration order.
    static var controls: [FlairControlDescriptor] { get }
    /// Sampler bindings (\`[[texture(1)]]\`, \`[[sampler(1)]]\`, …) in declaration order.
    static var samplerBindings: [FlairSamplerBinding] { get }
    /// Named catalog presets.
    static var presets: [String: Self] { get }

    /// Initializes the effect with its default control values.
    init()
    /// Initializes the effect with a named preset (case-insensitive fallback to defaults when unknown).
    init(preset: String)

    /// Writes the built-in prefix and all control uniforms into \`buffer\` (must have at least \`Self.uniformByteLength\` bytes).
    func encodeUniforms(into buffer: UnsafeMutableRawPointer, state: FlairFrameState)
    /// Returns the texture input bound at \`[[texture(binding)]]\`.
    func textureInput(for binding: Int) -> FlairTextureInput
    /// Updates the texture input bound at \`[[texture(binding)]]\`.
    mutating func setTextureInput(_ input: FlairTextureInput, for binding: Int)
}

extension FlairEffect {
    public static var samplerBindings: [FlairSamplerBinding] { [] }

    public init(preset: String) {
        if let exact = Self.presets[preset] {
            self = exact
            return
        }
        let lower = preset.lowercased()
        if let match = Self.presets.first(where: { $0.key.lowercased() == lower })?.value {
            self = match
            return
        }
        self.init()
    }

    public func textureInput(for binding: Int) -> FlairTextureInput {
        .none
    }

    public mutating func setTextureInput(_ input: FlairTextureInput, for binding: Int) {}

    /// Packs the effect's \`FlairUniforms\` \`std140\` buffer for \`state\` into a \`Data\` buffer.
    public func packedUniforms(state: FlairFrameState = FlairFrameState()) -> Data {
        var data = Data(count: Self.uniformByteLength)
        data.withUnsafeMutableBytes { raw in
            if let base = raw.baseAddress {
                encodeUniforms(into: base, state: state)
            }
        }
        return data
    }
}

/// Type-erased wrapper around any \`FlairEffect\`, used by \`FlairCatalog\` and \`FlairPipeline\`.
public struct AnyFlairEffect: Sendable, Equatable {
    public let effectId: String
    public let effectName: String
    public let category: String
    public let effectDescription: String
    public let tags: [String]
    public let phase: Int
    public let functionName: String
    public let uniformByteLength: Int
    public let isTransparent: Bool
    public let loopDuration: Double?
    public let controls: [FlairControlDescriptor]
    public let samplerBindings: [FlairSamplerBinding]
    public let presetNames: [String]

    private let _encodeUniforms: @Sendable (UnsafeMutableRawPointer, FlairFrameState) -> Void
    private let _textureInput: @Sendable (Int) -> FlairTextureInput
    private let _makePreset: @Sendable (String) -> AnyFlairEffect
    private let _encodeJSON: @Sendable () throws -> Data
    private let _decodeJSON: @Sendable (Data) throws -> AnyFlairEffect
    private var textureOverrides: [Int: FlairTextureInput] = [:]

    public init<E: FlairEffect>(_ effect: E) {
        let type = E.self
        self.effectId = type.effectId
        self.effectName = type.effectName
        self.category = type.category
        self.effectDescription = type.effectDescription
        self.tags = type.tags
        self.phase = type.phase
        self.functionName = type.functionName
        self.uniformByteLength = type.uniformByteLength
        self.isTransparent = type.isTransparent
        self.loopDuration = type.loopDuration
        self.controls = type.controls
        self.samplerBindings = type.samplerBindings
        self.presetNames = Array(type.presets.keys).sorted()
        self._encodeUniforms = { ptr, state in
            effect.encodeUniforms(into: ptr, state: state)
        }
        self._textureInput = { binding in
            effect.textureInput(for: binding)
        }
        self._makePreset = { name in
            AnyFlairEffect(E(preset: name))
        }
        self._encodeJSON = {
            try JSONEncoder().encode(effect)
        }
        self._decodeJSON = { data in
            let decoded = try JSONDecoder().decode(E.self, from: data)
            return AnyFlairEffect(decoded)
        }
    }

    public func withPreset(_ name: String) -> AnyFlairEffect {
        _makePreset(name)
    }

    /// Encodes the effect's current control values as JSON \`Data\`.
    public func encodedJSON() throws -> Data {
        try _encodeJSON()
    }

    /// Decodes a new \`AnyFlairEffect\` of the same concrete type from control JSON \`Data\`,
    /// preserving any existing texture overrides.
    public func decoded(from data: Data) throws -> AnyFlairEffect {
        var next = try _decodeJSON(data)
        for (binding, overrideInput) in textureOverrides {
            next.setTextureInput(overrideInput, for: binding)
        }
        return next
    }

    /// Encodes the effect's current control values as a \`[String: FlairJSONValue]\` dictionary.
    public func encodedValues() -> [String: FlairJSONValue] {
        guard let data = try? _encodeJSON(),
              let dict = try? JSONDecoder().decode([String: FlairJSONValue].self, from: data) else {
            return [:]
        }
        return dict
    }

    /// Returns a copy of this effect with the specified control values (keyed by uniform name or Swift property name) applied.
    public func applying(values overrides: [String: FlairJSONValue]) -> AnyFlairEffect {
        var merged = encodedValues()
        for (k, v) in overrides {
            merged[k] = v
            if let desc = controls.first(where: { $0.name == k || $0.property == k }) {
                merged[desc.name] = v
                merged[desc.property] = v
            }
        }
        guard let data = try? JSONEncoder().encode(merged),
              var next = try? _decodeJSON(data) else {
            return self
        }
        for (binding, overrideInput) in textureOverrides {
            next.setTextureInput(overrideInput, for: binding)
        }
        return next
    }

    public func encodeUniforms(into buffer: UnsafeMutableRawPointer, state: FlairFrameState) {
        _encodeUniforms(buffer, state)
    }

    public func packedUniforms(state: FlairFrameState = FlairFrameState()) -> Data {
        var data = Data(count: uniformByteLength)
        data.withUnsafeMutableBytes { raw in
            if let base = raw.baseAddress {
                encodeUniforms(into: base, state: state)
            }
        }
        return data
    }

    public func textureInput(for binding: Int) -> FlairTextureInput {
        textureOverrides[binding] ?? _textureInput(binding)
    }

    public mutating func setTextureInput(_ input: FlairTextureInput, for binding: Int) {
        textureOverrides[binding] = input
    }

    public static func == (lhs: AnyFlairEffect, rhs: AnyFlairEffect) -> Bool {
        lhs.effectId == rhs.effectId
            && lhs.packedUniforms() == rhs.packedUniforms()
            && lhs.samplerBindings.map { lhs.textureInput(for: $0.binding) }
                == rhs.samplerBindings.map { rhs.textureInput(for: $0.binding) }
    }
}
`;

export const FLAIR_PATH_AND_TEXT_SWIFT = `import CoreGraphics
import CoreText
import Foundation
import simd

/// Ports \`src/shader/path.ts\` (\`pathTexture\`) to Swift: parses SVG path commands or pixel
/// point arrays and resamples them into a \`256 × 2\` \`RGBA32Float\` texture matching the exact
/// \`PATH\` GLSL/Metal shader helper layout:
/// - row 0, texel \`i\`: \`(x, y, distanceAlong, joinFlag)\` in path units (y down);
/// - row 1, texel 0: \`(pointsCount, totalLength, chunksCount, fitCode: 0 none, 1 contain, 2 cover)\`;
/// - row 1, texel 1: \`(minX, minY, maxX, maxY)\`;
/// - row 1, texel 2: \`(margin, 0, 0, 0)\`;
/// - row 1, texel \`3 + c\`: chunk \`c\` bounding box \`(cMinX, cMinY, cMaxX, cMaxY)\` for points \`16*c ... 16*(c+1)\`.
public enum FlairPathRasterizer {
    public static let maxPoints = 256
    public static let pathChunk = 16

    private struct Subpath {
        var points: [SIMD2<Float>]
        var closed: Bool
    }

    public static func rasterize(
        path: String,
        fit: FlairPathFit = .contain,
        margin: Float = 0.1,
        width: Int = 640,
        height: Int = 360
    ) -> [Float] {
        let subpaths = parseSvgPath(path)
        return packSubpaths(subpaths, isSvg: true, fit: fit, margin: margin)
    }

    public static func rasterize(
        points: [SIMD2<Float>],
        width: Int = 640,
        height: Int = 360
    ) -> [Float] {
        guard points.count >= 2 else {
            return Array(repeating: 0, count: maxPoints * 2 * 4)
        }
        let closed = simd_distance(points.first!, points.last!) < 1e-3 && points.count > 2
        let sub = Subpath(points: points, closed: closed)
        return packSubpaths([sub], isSvg: false, fit: .none, margin: 0)
    }

    private static func lengthOf(_ piece: [SIMD2<Float>]) -> Float {
        guard piece.count >= 2 else { return 0 }
        var sum: Float = 0
        for i in 1..<piece.count {
            sum += simd_distance(piece[i], piece[i - 1])
        }
        return sum
    }

    private static func pointAlong(_ piece: [SIMD2<Float>], at distance: Float) -> SIMD2<Float> {
        guard let first = piece.first else { return .zero }
        var left = distance
        for i in 1..<piece.count {
            let a = piece[i - 1]
            let b = piece[i]
            let l = simd_distance(b, a)
            if left <= l && l > 0 {
                return a + (b - a) * (left / l)
            }
            left -= l
        }
        return piece.last ?? first
    }

    private static func packSubpaths(
        _ rawSubpaths: [Subpath],
        isSvg: Bool,
        fit: FlairPathFit,
        margin: Float
    ) -> [Float] {
        var out = Array<Float>(repeating: 0, count: maxPoints * 2 * 4)
        let pieces: [[SIMD2<Float>]] = rawSubpaths.compactMap { sub in
            guard sub.points.count >= 2 else { return nil }
            var pts = sub.points
            if sub.closed, let first = pts.first, let last = pts.last, simd_distance(first, last) > 1e-4 {
                pts.append(first)
            }
            return lengthOf(pts) > 1e-4 ? pts : nil
        }
        guard !pieces.isEmpty else { return out }

        let totalLength = pieces.reduce(Float(0)) { $0 + lengthOf($1) }
        guard totalLength > 1e-4 else { return out }

        let vertices = pieces.reduce(0) { $0 + $1.count }
        let maxSamplePoints = maxPoints - 4 // keep room for row 1 metadata + up to 16 chunks
        let budget = Swift.max(
            2 * pieces.count,
            Swift.min(maxSamplePoints, Swift.max(64, Int(ceil(Double(vertices) / 4.0))))
        )
        let spacing = totalLength / Float(Swift.max(1, budget - pieces.count))

        var points: [SIMD4<Float>] = []
        points.reserveCapacity(budget)
        var along: Float = 0

        for (pieceIdx, piece) in pieces.enumerated() {
            let own = lengthOf(piece)
            let remainingPieces = pieces.count - 1 - pieceIdx
            let maxForPiece = maxSamplePoints - points.count - 2 * remainingPieces
            let targetCount = Int((own / spacing).rounded()) + 1
            let n = Swift.max(2, Swift.min(maxForPiece, targetCount))
            for i in 0..<n {
                let d = (own * Float(i)) / Float(n - 1)
                let p = pointAlong(piece, at: d)
                points.append(SIMD4<Float>(p.x, p.y, along + d, i == 0 ? 0.0 : 1.0))
            }
            along += own
        }

        guard points.count >= 2 else { return out }

        for (i, p) in points.enumerated() {
            let base = i * 4
            out[base + 0] = p.x
            out[base + 1] = p.y
            out[base + 2] = p.z
            out[base + 3] = p.w
        }

        func box(from startIdx: Int, to endIdx: Int) -> SIMD4<Float> {
            var x0 = Float.greatestFiniteMagnitude
            var y0 = Float.greatestFiniteMagnitude
            var x1 = -Float.greatestFiniteMagnitude
            var y1 = -Float.greatestFiniteMagnitude
            for i in startIdx...endIdx {
                let p = points[i]
                x0 = Swift.min(x0, p.x)
                y0 = Swift.min(y0, p.y)
                x1 = Swift.max(x1, p.x)
                y1 = Swift.max(y1, p.y)
            }
            return SIMD4<Float>(x0, y0, x1, y1)
        }

        let chunks = Int(ceil(Double(points.count - 1) / Double(pathChunk)))
        let allBounds = box(from: 0, to: points.count - 1)
        let clampedMargin = Swift.min(0.45, Swift.max(0, margin))
        let fitCode: Float
        if !isSvg {
            fitCode = 0.0
        } else {
            switch fit {
            case .none, .fill:
                fitCode = 0.0
            case .contain:
                fitCode = 1.0
            case .cover:
                fitCode = 2.0
            }
        }

        let row1 = maxPoints * 4
        // Row 1, texel 0: (points, length, chunks, fit)
        out[row1 + 0] = Float(points.count)
        out[row1 + 1] = totalLength
        out[row1 + 2] = Float(chunks)
        out[row1 + 3] = fitCode

        // Row 1, texel 1: (minX, minY, maxX, maxY)
        out[row1 + 4] = allBounds.x
        out[row1 + 5] = allBounds.y
        out[row1 + 6] = allBounds.z
        out[row1 + 7] = allBounds.w

        // Row 1, texel 2: (margin, 0, 0, 0)
        out[row1 + 8] = clampedMargin
        out[row1 + 9] = 0.0
        out[row1 + 10] = 0.0
        out[row1 + 11] = 0.0

        // Row 1, texel 3 + c: chunk bounding box
        for c in 0..<chunks {
            let b = box(from: c * pathChunk, to: Swift.min((c + 1) * pathChunk, points.count - 1))
            let offset = row1 + (3 + c) * 4
            if offset + 3 < out.count {
                out[offset + 0] = b.x
                out[offset + 1] = b.y
                out[offset + 2] = b.z
                out[offset + 3] = b.w
            }
        }

        return out
    }

    private static func parseSvgPath(_ d: String) -> [Subpath] {
        var tokens: [String] = []
        let pattern = "([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\\\\d+\\\\.?\\\\d*|\\\\.\\\\d+)(?:[eE][-+]?\\\\d+)?)"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let ns = d as NSString
            let matches = regex.matches(in: d, range: NSRange(location: 0, length: ns.length))
            tokens = matches.map { ns.substring(with: $0.range) }
        }

        var subpaths: [Subpath] = []
        var current: [SIMD2<Float>] = []
        var cursor = SIMD2<Float>.zero
        var start = SIMD2<Float>.zero
        var lastControl: SIMD2<Float>? = nil
        var cmd: Character = " "
        var idx = 0

        func nextFloat() -> Float? {
            guard idx < tokens.count, let v = Float(tokens[idx]) else { return nil }
            idx += 1
            return v
        }

        while idx < tokens.count {
            let tok = tokens[idx]
            if let first = tok.first, first.isLetter {
                cmd = first
                idx += 1
                if cmd == "Z" || cmd == "z" {
                    if !current.isEmpty {
                        if simd_distance(current.last!, start) > 1e-4 {
                            current.append(start)
                        }
                        subpaths.append(Subpath(points: current, closed: true))
                        current = []
                    }
                    cursor = start
                    lastControl = nil
                    continue
                }
            }

            let isRel = cmd.isLowercase
            switch cmd.uppercased() {
            case "M":
                guard let x = nextFloat(), let y = nextFloat() else { break }
                if !current.isEmpty {
                    subpaths.append(Subpath(points: current, closed: false))
                    current = []
                }
                cursor = isRel ? cursor + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                start = cursor
                current.append(cursor)
                cmd = isRel ? "l" : "L"
                lastControl = nil
            case "L":
                guard let x = nextFloat(), let y = nextFloat() else { break }
                cursor = isRel ? cursor + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                current.append(cursor)
                lastControl = nil
            case "H":
                guard let x = nextFloat() else { break }
                cursor.x = isRel ? cursor.x + x : x
                current.append(cursor)
                lastControl = nil
            case "V":
                guard let y = nextFloat() else { break }
                cursor.y = isRel ? cursor.y + y : y
                current.append(cursor)
                lastControl = nil
            case "C":
                guard let x1 = nextFloat(), let y1 = nextFloat(),
                      let x2 = nextFloat(), let y2 = nextFloat(),
                      let x = nextFloat(), let y = nextFloat() else { break }
                let p0 = cursor
                let c1 = isRel ? p0 + SIMD2<Float>(x1, y1) : SIMD2<Float>(x1, y1)
                let c2 = isRel ? p0 + SIMD2<Float>(x2, y2) : SIMD2<Float>(x2, y2)
                let p3 = isRel ? p0 + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                for step in 1...12 {
                    let t = Float(step) / 12.0
                    let mt = 1.0 - t
                    let pt = mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p3
                    current.append(pt)
                }
                cursor = p3
                lastControl = c2
            case "S":
                guard let x2 = nextFloat(), let y2 = nextFloat(),
                      let x = nextFloat(), let y = nextFloat() else { break }
                let p0 = cursor
                let c1 = lastControl.map { p0 * 2 - $0 } ?? p0
                let c2 = isRel ? p0 + SIMD2<Float>(x2, y2) : SIMD2<Float>(x2, y2)
                let p3 = isRel ? p0 + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                for step in 1...12 {
                    let t = Float(step) / 12.0
                    let mt = 1.0 - t
                    let pt = mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p3
                    current.append(pt)
                }
                cursor = p3
                lastControl = c2
            case "Q":
                guard let x1 = nextFloat(), let y1 = nextFloat(),
                      let x = nextFloat(), let y = nextFloat() else { break }
                let p0 = cursor
                let c1 = isRel ? p0 + SIMD2<Float>(x1, y1) : SIMD2<Float>(x1, y1)
                let p2 = isRel ? p0 + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                for step in 1...10 {
                    let t = Float(step) / 10.0
                    let mt = 1.0 - t
                    let pt = mt * mt * p0 + 2 * mt * t * c1 + t * t * p2
                    current.append(pt)
                }
                cursor = p2
                lastControl = c1
            case "T":
                guard let x = nextFloat(), let y = nextFloat() else { break }
                let p0 = cursor
                let c1 = lastControl.map { p0 * 2 - $0 } ?? p0
                let p2 = isRel ? p0 + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                for step in 1...10 {
                    let t = Float(step) / 10.0
                    let mt = 1.0 - t
                    let pt = mt * mt * p0 + 2 * mt * t * c1 + t * t * p2
                    current.append(pt)
                }
                cursor = p2
                lastControl = c1
            case "A":
                guard let _ = nextFloat(), let _ = nextFloat(),
                      let _ = nextFloat(), let _ = nextFloat(),
                      let _ = nextFloat(),
                      let x = nextFloat(), let y = nextFloat() else { break }
                let p0 = cursor
                let p1 = isRel ? p0 + SIMD2<Float>(x, y) : SIMD2<Float>(x, y)
                for step in 1...8 {
                    let t = Float(step) / 8.0
                    current.append(p0 + (p1 - p0) * t)
                }
                cursor = p1
                lastControl = nil
            default:
                idx += 1
            }
        }
        if !current.isEmpty {
            subpaths.append(Subpath(points: current, closed: false))
        }
        return subpaths
    }
}

/// Renders centered white text on a transparent background (matching \`textImage\` in \`@pixerate/flair\`),
/// flipped upright (row 0 at the bottom) so shader \`texture(uText, uv)\` samples it right-side-up.
public enum FlairTextRasterizer {
    public static func rasterize(
        text: String,
        font: String = "Helvetica-Bold",
        weight: Double = 900,
        width: Int = 1024,
        height: Int = 256
    ) -> [UInt8] {
        let w = max(1, width)
        let h = max(1, height)
        var pixels = Array<UInt8>(repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: &pixels,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return pixels
        }

        ctx.clear(CGRect(x: 0, y: 0, width: w, height: h))
        let clean = text.isEmpty ? "FLAIR" : text
        let ems = max(0.5, Double(clean.count) * 0.68)
        let fontSize = CGFloat(min(Double(h) * 0.72, (Double(w) * 0.88) / ems))
        let ctFont = CTFontCreateWithName(font as CFString, fontSize, nil)
        let white = CGColor(colorSpace: colorSpace, components: [1, 1, 1, 1])!
        let attrs: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): ctFont,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): white,
        ]
        let attrString = NSAttributedString(string: clean, attributes: attrs)
        let line = CTLineCreateWithAttributedString(attrString)
        var ascent: CGFloat = 0
        var descent: CGFloat = 0
        var leading: CGFloat = 0
        let lineWidth = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))

        // Flip vertically in CoreGraphics so row 0 in memory is the bottom of the glyph.
        ctx.translateBy(x: 0, y: CGFloat(h))
        ctx.scaleBy(x: 1, y: -1)
        let scaleX = lineWidth > CGFloat(w) * 0.92 ? (CGFloat(w) * 0.92) / max(lineWidth, 1) : 1.0
        ctx.saveGState()
        ctx.translateBy(x: CGFloat(w) * 0.5, y: CGFloat(h) * 0.5)
        ctx.scaleBy(x: scaleX, y: 1.0)
        ctx.textPosition = CGPoint(x: -lineWidth * 0.5, y: -(ascent - descent) * 0.5)
        CTLineDraw(line, ctx)
        ctx.restoreGState()

        return pixels
    }
}

/// Renders procedural RGBA8 textures for \`FlairSampleImage\` values so every image and mask effect
/// in the catalog works immediately with zero external image files.
public enum FlairSampleRasterizer {
    public static func rasterize(sample: FlairSampleImage, width: Int = 512, height: Int = 288) -> [UInt8] {
        let w = max(1, width)
        let h = max(1, height)
        var pixels = Array<UInt8>(repeating: 0, count: w * h * 4)
        for y in 0..<h {
            let v = Float(y) / Float(max(1, h - 1)) // 0 at bottom, 1 at top
            for x in 0..<w {
                let u = Float(x) / Float(max(1, w - 1))
                let rgba = samplePixel(sample: sample, u: u, v: v)
                let idx = (y * w + x) * 4
                pixels[idx + 0] = UInt8(clamping: Int((rgba.x * 255.0).rounded()))
                pixels[idx + 1] = UInt8(clamping: Int((rgba.y * 255.0).rounded()))
                pixels[idx + 2] = UInt8(clamping: Int((rgba.z * 255.0).rounded()))
                pixels[idx + 3] = UInt8(clamping: Int((rgba.w * 255.0).rounded()))
            }
        }
        return pixels
    }

    private static func samplePixel(sample: FlairSampleImage, u: Float, v: Float) -> SIMD4<Float> {
        switch sample {
        case .landscape:
            let skyTop = SIMD3<Float>(0.231, 0.298, 0.722)
            let skyBot = SIMD3<Float>(1.0, 0.639, 0.420)
            var col = skyBot + (skyTop - skyBot) * v
            let sunDist = hypot(u - 0.65, (v - 0.53) * 0.56)
            if sunDist < 0.1 { col = SIMD3<Float>(1.0, 0.914, 0.690) }
            let h1 = 0.32 + 0.06 * sin(u * 8.0)
            let h2 = 0.20 + 0.05 * sin(u * 6.0 + 1.2)
            if v < h2 { col = SIMD3<Float>(0.106, 0.184, 0.200) }
            else if v < h1 { col = SIMD3<Float>(0.173, 0.290, 0.322) }
            return SIMD4<Float>(col.x, col.y, col.z, 1.0)
        case .city:
            var col = SIMD3<Float>(0.051, 0.063, 0.157)
            let moonDist = hypot(u - 0.81, (v - 0.78) * 0.56)
            if moonDist < 0.06 { col = SIMD3<Float>(0.961, 0.953, 0.843) }
            let colIdx = Int(u * 12.0)
            let bHeight = 0.25 + Float((colIdx * 37) % 45) / 100.0
            if v < bHeight {
                col = SIMD3<Float>(0.145, 0.165, 0.322)
                let wx = (u * 12.0).truncatingRemainder(dividingBy: 1.0)
                let wy = (v * 20.0).truncatingRemainder(dividingBy: 1.0)
                if wx > 0.25 && wx < 0.75 && wy > 0.3 && wy < 0.7 && ((colIdx + Int(v * 20.0)) % 3 == 0) {
                    col = SIMD3<Float>(1.0, 0.812, 0.353)
                }
            }
            return SIMD4<Float>(col.x, col.y, col.z, 1.0)
        case .portrait, .cutout, .greenScreen:
            let bg: SIMD4<Float>
            if sample == .cutout {
                bg = .zero
            } else if sample == .greenScreen {
                bg = SIMD4<Float>(0.15, 0.78, 0.32, 1.0)
            } else {
                bg = SIMD4<Float>(0.949, 0.902, 0.847, 1.0)
            }
            let headDist = hypot((u - 0.5) * 1.6, v - 0.58)
            if headDist < 0.20 {
                return SIMD4<Float>(0.788, 0.545, 0.420, 1.0)
            }
            let bodyDist = hypot((u - 0.5) * 1.2, v - 0.12)
            if v < 0.36 && bodyDist < 0.28 {
                return SIMD4<Float>(0.200, 0.255, 0.361, 1.0)
            }
            return bg
        case .portrait2:
            let headDist = hypot((u - 0.67) * 1.5, v - 0.52)
            if headDist < 0.24 {
                return SIMD4<Float>(0.910, 0.706, 0.561, 1.0)
            }
            if v < 0.28 && abs(u - 0.67) < 0.26 {
                return SIMD4<Float>(0.643, 0.216, 0.184, 1.0)
            }
            return SIMD4<Float>(0.827, 0.894, 0.902, 1.0)
        case .logo:
            let d = hypot(u - 0.5, v - 0.5)
            if d < 0.10 || (d > 0.21 && d < 0.39) {
                return SIMD4<Float>(0.388, 0.400, 0.945, 1.0)
            }
            return .zero
        case .heart, .icon:
            let x = (u - 0.5) * 2.4
            let y = (v - 0.44) * 2.4
            let a = x * x + y * y - 0.35
            let inside = (a * a * a - x * x * y * y * y) < 0
            if sample == .heart {
                return inside ? SIMD4<Float>(0.957, 0.247, 0.369, 1.0) : .zero
            } else {
                let edge = abs(a * a * a - x * x * y * y * y) < 0.04
                return edge ? SIMD4<Float>(0, 0, 0, 1) : .zero
            }
        }
    }
}
`;

export const FLAIR_INPUTS_SWIFT = `import Foundation
import simd

/// Tracks pointer position, velocity, hover/down envelopes, click ripples (\`iClicks[8]\`),
/// and pointer trail (\`iTrail[32]\`), matching \`src/shader/pointer.ts\`.
public final class FlairPointerTracker: @unchecked Sendable {
    public static let hoverSeconds: Float = 0.18
    public static let trailSeconds: Float = 0.6
    public static let maxClicks = 8
    public static let maxTrail = 32

    private var x: Float = 0
    private var y: Float = 0
    private var prevX: Float = 0
    private var prevY: Float = 0
    private var vx: Float = 0
    private var vy: Float = 0
    private var clickX: Float = 0
    private var clickY: Float = 0
    private var inside = false
    private var pressed = false
    private var hover: Float = 0
    private var down: Float = 0
    private var lastSampleTime: Float? = nil

    public struct ClickSample: Sendable, Equatable {
        public var x: Float
        public var y: Float
        public var time: Float
    }

    private var clickHistory: [ClickSample] = []
    private var trailHistory: [ClickSample] = []

    public init() {}

    /// Records a pointer move in shader pixel coordinates (\`y = 0\` at bottom).
    public func move(x: Float, y: Float, time: Float) {
        if !inside {
            prevX = x
            prevY = y
        }
        self.x = x
        self.y = y
        self.inside = true
        appendTrail(x: x, y: y, time: time)
    }

    /// Records a pointer press at \`(x, y)\` in shader pixel coordinates (\`y = 0\` at bottom).
    public func down(x: Float, y: Float, time: Float) {
        move(x: x, y: y, time: time)
        pressed = true
        clickX = x
        clickY = y
        clickHistory.insert(ClickSample(x: x, y: y, time: time), at: 0)
        if clickHistory.count > Self.maxClicks {
            clickHistory.removeLast(clickHistory.count - Self.maxClicks)
        }
    }

    /// Records a pointer release.
    public func up(time: Float) {
        pressed = false
    }

    /// Records the pointer leaving the view.
    public func leave(time: Float) {
        inside = false
        pressed = false
    }

    private func appendTrail(x: Float, y: Float, time: Float) {
        if let first = trailHistory.first, hypot(first.x - x, first.y - y) < 2.0 && abs(time - first.time) < 0.016 {
            return
        }
        trailHistory.insert(ClickSample(x: x, y: y, time: time), at: 0)
        if trailHistory.count > Self.maxTrail {
            trailHistory.removeLast(trailHistory.count - Self.maxTrail)
        }
    }

    /// Advances smoothed pointer state and writes \`mouse\`, \`pointer\`, \`clicks\`, and \`trail\` into \`state\`.
    public func apply(to state: inout FlairFrameState) {
        let dt = Swift.max(1.0 / 240.0, state.delta)
        let step = Swift.min(1.0, dt / Self.hoverSeconds)
        hover += ((inside ? 1.0 : 0.0) - hover) * step
        down += ((pressed ? 1.0 : 0.0) - down) * step

        let rawVx = (x - prevX) / dt
        let rawVy = (y - prevY) / dt
        vx += (rawVx - vx) * 0.35
        vy += (rawVy - vy) * 0.35
        prevX = x
        prevY = y
        lastSampleTime = state.time

        let signZ: Float = pressed ? clickX : -clickX
        let signW: Float = pressed ? clickY : -clickY
        state.mouse = SIMD4<Float>(x, y, signZ, signW)
        state.pointer = SIMD4<Float>(vx, vy, hover, down)

        state.clicks = clickHistory.prefix(Self.maxClicks).map {
            SIMD4<Float>($0.x, $0.y, $0.time, 1.0)
        }
        state.trail = trailHistory
            .filter { state.time - $0.time <= Self.trailSeconds }
            .prefix(Self.maxTrail)
            .map { SIMD4<Float>($0.x, $0.y, $0.time, 1.0) }
    }
}

/// Real-time and offline audio analyzer computing \`iAudio\` (level, bass, mid, treble),
/// \`iSpectrum[16]\` (64 logarithmic bins), and \`iBeat\` (seconds since last beat), matching \`src/shader/audio.ts\`.
public final class FlairAudioAnalyzer: @unchecked Sendable {
    public static let spectrumBins = 64

    public private(set) var audio: SIMD4<Float> = .zero
    public private(set) var spectrum: [Float] = Array(repeating: 0, count: 64)
    public private(set) var beat: Float = 0

    private var prevSpectrum: [Float] = Array(repeating: 0, count: 64)
    private var fluxAverage: Float = 0
    private var lastBeatTime: Float = -1

    public init() {}

    /// Directly sets precomputed audio values.
    public func set(level: Float, bass: Float, mid: Float, treble: Float, beat: Float = 0, spectrum: [Float]? = nil) {
        self.audio = SIMD4<Float>(
            Swift.min(1, Swift.max(0, level)),
            Swift.min(1, Swift.max(0, bass)),
            Swift.min(1, Swift.max(0, mid)),
            Swift.min(1, Swift.max(0, treble))
        )
        self.beat = beat
        if let spectrum = spectrum {
            for i in 0..<Self.spectrumBins {
                self.spectrum[i] = i < spectrum.count ? Swift.min(1, Swift.max(0, spectrum[i])) : 0
            }
        }
    }

    /// Analyzes a mono PCM sample window (e.g. 512 or 1024 samples) at \`time\`.
    public func update(samples: [Float], sampleRate: Float = 44100, time: Float) {
        guard !samples.isEmpty else { return }
        var sumSq: Float = 0
        for s in samples { sumSq += s * s }
        let rms = Swift.min(1.0, sqrt(sumSq / Float(samples.count)) * 2.5)

        let n = 256
        var real = Array<Float>(repeating: 0, count: n)
        var imag = Array<Float>(repeating: 0, count: n)
        let count = Swift.min(samples.count, n)
        for i in 0..<count {
            let window = 0.5 * (1.0 - cos(2.0 * Float.pi * Float(i) / Float(max(1, count - 1))))
            real[i] = samples[i] * window
        }
        radix2FFT(real: &real, imag: &imag)

        let half = n / 2
        var mags = Array<Float>(repeating: 0, count: half)
        for i in 0..<half {
            let m = hypot(real[i], imag[i]) / Float(half)
            let db = 20.0 * log10(Swift.max(m, 1e-5))
            mags[i] = Swift.min(1.0, Swift.max(0.0, (db + 75.0) / 65.0))
        }

        var flux: Float = 0
        for bin in 0..<Self.spectrumBins {
            let t = Float(bin) / Float(Self.spectrumBins - 1)
            let idx = Int((pow(t, 1.8) * Float(half - 2)).rounded()) + 1
            let val = mags[Swift.min(half - 1, Swift.max(1, idx))]
            let smoothed = spectrum[bin] * 0.65 + val * 0.35
            let diff = Swift.max(0, smoothed - prevSpectrum[bin])
            flux += diff
            prevSpectrum[bin] = smoothed
            spectrum[bin] = smoothed
        }

        let bass = average(spectrum, range: 0..<10)
        let mid = average(spectrum, range: 10..<34)
        let treble = average(spectrum, range: 34..<64)
        audio = SIMD4<Float>(rms, bass, mid, treble)

        fluxAverage = fluxAverage * 0.9 + flux * 0.1
        if flux > Swift.max(0.45, fluxAverage * 1.45) && (lastBeatTime < 0 || time - lastBeatTime > 0.22) {
            lastBeatTime = time
        }
        beat = lastBeatTime < 0 ? -1.0 : Swift.max(0, time - lastBeatTime)
    }

    public func apply(to state: inout FlairFrameState) {
        state.audio = audio
        state.spectrum = spectrum
        state.beat = beat
    }

    private func average(_ array: [Float], range: Range<Int>) -> Float {
        guard !range.isEmpty else { return 0 }
        var sum: Float = 0
        for i in range { sum += array[i] }
        return Swift.min(1.0, sum / Float(range.count))
    }

    private func radix2FFT(real: inout [Float], imag: inout [Float]) {
        let n = real.count
        var j = 0
        for i in 0..<n {
            if i < j {
                real.swapAt(i, j)
                imag.swapAt(i, j)
            }
            var m = n >> 1
            while m >= 1 && j >= m {
                j -= m
                m >>= 1
            }
            j += m
        }
        var len = 2
        while len <= n {
            let half = len >> 1
            let angle = -2.0 * Float.pi / Float(len)
            let wLenR = cos(angle)
            let wLenI = sin(angle)
            var i = 0
            while i < n {
                var wR: Float = 1.0
                var wI: Float = 0.0
                for k in 0..<half {
                    let uR = real[i + k]
                    let uI = imag[i + k]
                    let vR = real[i + k + half] * wR - imag[i + k + half] * wI
                    let vI = real[i + k + half] * wI + imag[i + k + half] * wR
                    real[i + k] = uR + vR
                    imag[i + k] = uI + vI
                    real[i + k + half] = uR - vR
                    imag[i + k + half] = uI - vI
                    let nextWR = wR * wLenR - wI * wLenI
                    wI = wR * wLenI + wI * wLenR
                    wR = nextWR
                }
                i += len
            }
            len <<= 1
        }
    }
}

/// Tracks scroll progress, page offset, smoothed velocity, and scrolling envelope (\`iScroll\`),
/// matching \`src/shader/scroll.ts\`.
public final class FlairScrollTracker: @unchecked Sendable {
    public private(set) var scroll: SIMD4<Float> = .zero
    private var prevPage: Float = 0
    private var lastScrollTime: Float = -10

    public init() {}

    public func update(progress: Float, page: Float, time: Float) {
        let dt = Swift.max(1.0 / 120.0, time - Swift.max(0, lastScrollTime))
        let rawVel = (page - prevPage) / dt
        let vel = scroll.z * 0.7 + rawVel * 0.3
        prevPage = page
        if abs(rawVel) > 1e-4 {
            lastScrollTime = time
        }
        let scrolling = Swift.max(0.0, 1.0 - Swift.max(0.0, time - lastScrollTime) / 0.25)
        scroll = SIMD4<Float>(
            Swift.min(1.0, Swift.max(0.0, progress)),
            page,
            vel,
            scrolling
        )
    }

    public func apply(to state: inout FlairFrameState) {
        state.scroll = scroll
    }
}
`;

export const FLAIR_RENDERER_SWIFT = `import CoreGraphics
import Foundation
import ImageIO
import Metal
import MetalKit

/// Errors thrown by \`FlairRenderer\` when initializing Metal resources or compiling shaders.
public enum FlairRendererError: Error, LocalizedError, Sendable {
    case metalDeviceUnavailable
    case commandQueueUnavailable
    case shaderSourceNotFound(String)
    case shaderFunctionNotFound(String)
    case textureCreationFailed

    public var errorDescription: String? {
        switch self {
        case .metalDeviceUnavailable:
            return "No Metal GPU device is available on this system."
        case .commandQueueUnavailable:
            return "Could not create a Metal command queue."
        case .shaderSourceNotFound(let name):
            return "Could not find bundled Metal shader source for '\\(name)'."
        case .shaderFunctionNotFound(let name):
            return "Could not find Metal fragment function '\\(name)'."
        case .textureCreationFailed:
            return "Could not allocate target MTLTexture."
        }
    }
}

/// Renders \`FlairEffect\` shaders into \`MTLTexture\` targets, \`MTKView\` views, or offscreen \`CGImage\` bitmaps.
public final class FlairRenderer: @unchecked Sendable {
    public let device: MTLDevice
    public let commandQueue: MTLCommandQueue

    private struct PipelineKey: Hashable {
        let functionName: String
        let pixelFormat: UInt
        let isTransparent: Bool
    }

    private struct SamplerKey: Hashable {
        let filter: FlairTextureFilter
        let wrap: FlairTextureWrap
    }

    private var defaultLibrary: MTLLibrary?
    private var vertexFunction: MTLFunction?
    private var functionLibraries: [String: MTLLibrary] = [:]
    private var pipelines: [PipelineKey: MTLRenderPipelineState] = [:]
    private var samplers: [SamplerKey: MTLSamplerState] = [:]
    private var textureCache: [String: MTLTexture] = [:]
    private var liveTextures: [String: MTLTexture] = [:]
    private var fallbackTexture2D: MTLTexture?
    private var fallbackPathTexture: MTLTexture?
    private let lock = NSLock()

    public init(device: MTLDevice? = MTLCreateSystemDefaultDevice()) throws {
        guard let device = device else {
            throw FlairRendererError.metalDeviceUnavailable
        }
        guard let queue = device.makeCommandQueue() else {
            throw FlairRendererError.commandQueueUnavailable
        }
        self.device = device
        self.commandQueue = queue
        self.defaultLibrary = try? device.makeDefaultLibrary(bundle: .module)
    }

    /// Binds a live \`MTLTexture\` (such as a video frame, camera feed, or intermediate pass) to a named sampler uniform.
    public func setLiveTexture(_ texture: MTLTexture?, for uniformName: String) {
        lock.lock()
        defer { lock.unlock() }
        if let texture = texture {
            liveTextures[uniformName] = texture
        } else {
            liveTextures.removeValue(forKey: uniformName)
        }
    }

    /// Clears cached textures that are no longer needed.
    public func clearTextureCache() {
        lock.lock()
        defer { lock.unlock() }
        textureCache.removeAll()
    }

    /// Renders \`effect\` into \`targetTexture\`.
    public func render<E: FlairEffect>(
        effect: E,
        state: FlairFrameState,
        to targetTexture: MTLTexture,
        commandBuffer: MTLCommandBuffer? = nil,
        loadAction: MTLLoadAction = .clear,
        clearColor: MTLClearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
    ) throws {
        try render(
            anyEffect: AnyFlairEffect(effect),
            state: state,
            to: targetTexture,
            commandBuffer: commandBuffer,
            loadAction: loadAction,
            clearColor: clearColor
        )
    }

    /// Renders a type-erased \`AnyFlairEffect\` into \`targetTexture\`.
    public func render(
        anyEffect effect: AnyFlairEffect,
        state: FlairFrameState,
        to targetTexture: MTLTexture,
        commandBuffer: MTLCommandBuffer? = nil,
        loadAction: MTLLoadAction = .clear,
        clearColor: MTLClearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0),
        blendOver: Bool = false
    ) throws {
        var frameState = state
        frameState.width = Float(targetTexture.width)
        frameState.height = Float(targetTexture.height)

        let pipeline = try pipelineState(
            functionName: effect.functionName,
            effectId: effect.effectId,
            pixelFormat: targetTexture.pixelFormat,
            isTransparent: blendOver || (effect.isTransparent && loadAction == .load)
        )

        let ownsBuffer = (commandBuffer == nil)
        guard let cmd = commandBuffer ?? commandQueue.makeCommandBuffer() else {
            throw FlairRendererError.commandQueueUnavailable
        }

        var resolvedTextures: [(Int, MTLTexture, MTLSamplerState)] = []
        for binding in effect.samplerBindings {
            let input = effect.textureInput(for: binding.binding)
            let tex = resolveTexture(
                for: binding,
                input: input,
                frameWidth: targetTexture.width,
                frameHeight: targetTexture.height,
                commandBuffer: cmd
            )
            let smp = samplerState(filter: binding.filter, wrap: binding.wrap)
            resolvedTextures.append((binding.binding, tex, smp))
        }

        let passDesc = MTLRenderPassDescriptor()
        passDesc.colorAttachments[0].texture = targetTexture
        passDesc.colorAttachments[0].loadAction = loadAction
        passDesc.colorAttachments[0].storeAction = .store
        passDesc.colorAttachments[0].clearColor = clearColor

        let uniformData = effect.packedUniforms(state: frameState)
        if let encoder = cmd.makeRenderCommandEncoder(descriptor: passDesc) {
            encoder.setRenderPipelineState(pipeline)
            uniformData.withUnsafeBytes { raw in
                if let base = raw.baseAddress {
                    if uniformData.count <= 4096 {
                        encoder.setFragmentBytes(base, length: uniformData.count, index: 0)
                    } else if let buf = device.makeBuffer(bytes: base, length: uniformData.count, options: .storageModeShared) {
                        encoder.setFragmentBuffer(buf, offset: 0, index: 0)
                    }
                }
            }
            for (index, tex, smp) in resolvedTextures {
                encoder.setFragmentTexture(tex, index: index)
                encoder.setFragmentSamplerState(smp, index: index)
            }
            encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
            encoder.endEncoding()
        }

        if ownsBuffer {
            cmd.commit()
            cmd.waitUntilCompleted()
        }
    }

    /// Renders \`effect\` offscreen and returns an upright \`CGImage\`.
    public func renderCGImage<E: FlairEffect>(
        effect: E,
        width: Int = 320,
        height: Int = 180,
        time: Float = 0,
        state: FlairFrameState? = nil
    ) throws -> CGImage {
        try renderCGImage(anyEffect: AnyFlairEffect(effect), width: width, height: height, time: time, state: state)
    }

    /// Renders a type-erased \`AnyFlairEffect\` offscreen and returns an upright \`CGImage\`.
    public func renderCGImage(
        anyEffect effect: AnyFlairEffect,
        width: Int = 320,
        height: Int = 180,
        time: Float = 0,
        state: FlairFrameState? = nil
    ) throws -> CGImage {
        let w = max(1, width)
        let h = max(1, height)
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: w,
            height: h,
            mipmapped: false
        )
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .shared
        guard let texture = device.makeTexture(descriptor: desc) else {
            throw FlairRendererError.textureCreationFailed
        }

        var frameState = state ?? FlairFrameState(width: Float(w), height: Float(h), time: time)
        frameState.width = Float(w)
        frameState.height = Float(h)
        if state == nil { frameState.time = time }
        frameState.flipY = true

        try render(anyEffect: effect, state: frameState, to: texture)
        return try readCGImage(from: texture)
    }

    /// Renders a type-erased \`AnyFlairEffect\` offscreen and returns upright RGBA8 pixel bytes (\`width * height * 4\`).
    public func renderBytes(
        anyEffect effect: AnyFlairEffect,
        width: Int = 320,
        height: Int = 180,
        time: Float = 0,
        state: FlairFrameState? = nil
    ) throws -> [UInt8] {
        let w = max(1, width)
        let h = max(1, height)
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: w,
            height: h,
            mipmapped: false
        )
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .shared
        guard let texture = device.makeTexture(descriptor: desc) else {
            throw FlairRendererError.textureCreationFailed
        }

        var frameState = state ?? FlairFrameState(width: Float(w), height: Float(h), time: time)
        frameState.width = Float(w)
        frameState.height = Float(h)
        if state == nil { frameState.time = time }
        frameState.flipY = true

        try render(anyEffect: effect, state: frameState, to: texture)
        let bytesPerRow = w * 4
        var bytes = Array<UInt8>(repeating: 0, count: bytesPerRow * h)
        texture.getBytes(
            &bytes,
            bytesPerRow: bytesPerRow,
            from: MTLRegionMake2D(0, 0, w, h),
            mipmapLevel: 0
        )
        return bytes
    }

    /// Reads an \`.rgba8Unorm\` or \`.bgra8Unorm\` \`MTLTexture\` into a \`CGImage\`.
    public func readCGImage(from texture: MTLTexture) throws -> CGImage {
        let w = texture.width
        let h = texture.height
        let bytesPerRow = w * 4
        var bytes = Array<UInt8>(repeating: 0, count: bytesPerRow * h)
        texture.getBytes(
            &bytes,
            bytesPerRow: bytesPerRow,
            from: MTLRegionMake2D(0, 0, w, h),
            mipmapLevel: 0
        )
        if texture.pixelFormat == .bgra8Unorm || texture.pixelFormat == .bgra8Unorm_srgb {
            var i = 0
            while i + 3 < bytes.count {
                bytes.swapAt(i, i + 2)
                i += 4
            }
        }
        let data = Data(bytes)
        guard let provider = CGDataProvider(data: data as CFData),
              let cgImage = CGImage(
                  width: w,
                  height: h,
                  bitsPerComponent: 8,
                  bitsPerPixel: 32,
                  bytesPerRow: bytesPerRow,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                  provider: provider,
                  decode: nil,
                  shouldInterpolate: true,
                  intent: .defaultIntent
              ) else {
            throw FlairRendererError.textureCreationFailed
        }
        return cgImage
    }

    private func pipelineState(
        functionName: String,
        effectId: String,
        pixelFormat: MTLPixelFormat,
        isTransparent: Bool
    ) throws -> MTLRenderPipelineState {
        let key = PipelineKey(functionName: functionName, pixelFormat: pixelFormat.rawValue, isTransparent: isTransparent)
        lock.lock()
        if let cached = pipelines[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let vtx = try loadVertexFunction()
        let frag = try loadFragmentFunction(functionName: functionName, effectId: effectId)

        let desc = MTLRenderPipelineDescriptor()
        desc.vertexFunction = vtx
        desc.fragmentFunction = frag
        guard let colorAttachment = desc.colorAttachments[0] else {
            throw FlairRendererError.shaderFunctionNotFound(functionName)
        }
        colorAttachment.pixelFormat = pixelFormat
        if isTransparent {
            colorAttachment.isBlendingEnabled = true
            colorAttachment.sourceRGBBlendFactor = .sourceAlpha
            colorAttachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
            colorAttachment.rgbBlendOperation = .add
            colorAttachment.sourceAlphaBlendFactor = .one
            colorAttachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            colorAttachment.alphaBlendOperation = .add
        }

        let state = try device.makeRenderPipelineState(descriptor: desc)
        lock.lock()
        pipelines[key] = state
        lock.unlock()
        return state
    }

    private func loadVertexFunction() throws -> MTLFunction {
        lock.lock()
        if let vtx = vertexFunction {
            lock.unlock()
            return vtx
        }
        if let lib = defaultLibrary, let fn = lib.makeFunction(name: "flair_fullscreen_vertex") {
            vertexFunction = fn
            lock.unlock()
            return fn
        }
        lock.unlock()

        let src = try readBundledMetalSource(named: "_FlairVertex")
        let lib = try device.makeLibrary(source: src, options: nil)
        guard let fn = lib.makeFunction(name: "flair_fullscreen_vertex") else {
            throw FlairRendererError.shaderFunctionNotFound("flair_fullscreen_vertex")
        }
        lock.lock()
        vertexFunction = fn
        lock.unlock()
        return fn
    }

    private func loadFragmentFunction(functionName: String, effectId: String) throws -> MTLFunction {
        lock.lock()
        if let lib = defaultLibrary, let fn = lib.makeFunction(name: functionName) {
            lock.unlock()
            return fn
        }
        if let lib = functionLibraries[functionName], let fn = lib.makeFunction(name: functionName) {
            lock.unlock()
            return fn
        }
        lock.unlock()

        let src = try readBundledMetalSource(named: effectId)
        let opts = MTLCompileOptions()
        opts.fastMathEnabled = true
        let lib = try device.makeLibrary(source: src, options: opts)
        guard let fn = lib.makeFunction(name: functionName) else {
            throw FlairRendererError.shaderFunctionNotFound(functionName)
        }
        lock.lock()
        functionLibraries[functionName] = lib
        lock.unlock()
        return fn
    }

    private func readBundledMetalSource(named name: String) throws -> String {
        if let url = Bundle.module.url(forResource: name, withExtension: "metal")
            ?? Bundle.module.url(forResource: name, withExtension: "metal", subdirectory: "Shaders"),
           let text = try? String(contentsOf: url, encoding: .utf8) {
            return text
        }
        throw FlairRendererError.shaderSourceNotFound(name)
    }

    private func samplerState(filter: FlairTextureFilter, wrap: FlairTextureWrap) -> MTLSamplerState {
        let key = SamplerKey(filter: filter, wrap: wrap)
        lock.lock()
        if let cached = samplers[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let desc = MTLSamplerDescriptor()
        switch filter {
        case .nearest:
            desc.minFilter = .nearest
            desc.magFilter = .nearest
            desc.mipFilter = .notMipmapped
        case .linear:
            desc.minFilter = .linear
            desc.magFilter = .linear
            desc.mipFilter = .notMipmapped
        case .mipmap:
            desc.minFilter = .linear
            desc.magFilter = .linear
            desc.mipFilter = .linear
        }
        let addressMode: MTLSamplerAddressMode
        switch wrap {
        case .repeat:
            addressMode = .repeat
        case .clamp:
            addressMode = .clampToEdge
        case .mirror:
            addressMode = .mirrorRepeat
        }
        desc.sAddressMode = addressMode
        desc.tAddressMode = addressMode
        let state = device.makeSamplerState(descriptor: desc)!
        lock.lock()
        samplers[key] = state
        lock.unlock()
        return state
    }

    private func resolveTexture(
        for binding: FlairSamplerBinding,
        input: FlairTextureInput,
        frameWidth: Int,
        frameHeight: Int,
        commandBuffer: MTLCommandBuffer
    ) -> MTLTexture {
        lock.lock()
        if let live = liveTextures[binding.name] ?? liveTextures[binding.property] {
            lock.unlock()
            return live
        }
        lock.unlock()

        if binding.type == .path {
            let key: String
            switch input {
            case .path(let d, let fit, let margin):
                key = "path:\\(frameWidth)x\\(frameHeight):\\(fit.rawValue):\\(margin):\\(d)"
                if let cached = cachedTexture(forKey: key) { return cached }
                let floats = FlairPathRasterizer.rasterize(path: d, fit: fit, margin: margin, width: frameWidth, height: frameHeight)
                let tex = makePathTexture(floats: floats)
                storeCachedTexture(tex, forKey: key)
                return tex
            case .points(let pts):
                let floats = FlairPathRasterizer.rasterize(points: pts, width: frameWidth, height: frameHeight)
                return makePathTexture(floats: floats)
            default:
                return defaultPathTexture()
            }
        }

        let mipmapped = (binding.filter == .mipmap)
        switch input {
        case .none:
            return defaultTexture2D()
        case .sample(let sample):
            let key = "sample:\\(sample.rawValue):\\(mipmapped)"
            if let cached = cachedTexture(forKey: key) { return cached }
            let rgba = FlairSampleRasterizer.rasterize(sample: sample, width: 512, height: 288)
            let tex = makeRGBA8Texture(pixels: rgba, width: 512, height: 288, mipmapped: mipmapped, commandBuffer: commandBuffer)
            storeCachedTexture(tex, forKey: key)
            return tex
        case .text(let text, let font, let weight, let width, let height):
            let key = "text:\\(width)x\\(height):\\(font):\\(weight):\\(mipmapped):\\(text)"
            if let cached = cachedTexture(forKey: key) { return cached }
            let rgba = FlairTextRasterizer.rasterize(text: text, font: font, weight: weight, width: width, height: height)
            let tex = makeRGBA8Texture(pixels: rgba, width: max(1, width), height: max(1, height), mipmapped: mipmapped, commandBuffer: commandBuffer)
            storeCachedTexture(tex, forKey: key)
            return tex
        case .image(let sendable):
            return makeCGImageTexture(sendable.cgImage, mipmapped: mipmapped, commandBuffer: commandBuffer)
        case .pngData(let data):
            if let source = CGImageSourceCreateWithData(data as CFData, nil),
               let cg = CGImageSourceCreateImageAtIndex(source, 0, nil) {
                return makeCGImageTexture(cg, mipmapped: mipmapped, commandBuffer: commandBuffer)
            }
            return defaultTexture2D()
        case .url(let urlString):
            let key = "url:\\(mipmapped):\\(urlString)"
            if let cached = cachedTexture(forKey: key) { return cached }
            if let url = URL(string: urlString), url.isFileURL,
               let data = try? Data(contentsOf: url),
               let source = CGImageSourceCreateWithData(data as CFData, nil),
               let cg = CGImageSourceCreateImageAtIndex(source, 0, nil) {
                let tex = makeCGImageTexture(cg, mipmapped: mipmapped, commandBuffer: commandBuffer)
                storeCachedTexture(tex, forKey: key)
                return tex
            }
            return defaultTexture2D()
        case .path(let d, let fit, let margin):
            let floats = FlairPathRasterizer.rasterize(path: d, fit: fit, margin: margin, width: frameWidth, height: frameHeight)
            return makePathTexture(floats: floats)
        case .points(let pts):
            let floats = FlairPathRasterizer.rasterize(points: pts, width: frameWidth, height: frameHeight)
            return makePathTexture(floats: floats)
        }
    }

    private func cachedTexture(forKey key: String) -> MTLTexture? {
        lock.lock()
        defer { lock.unlock() }
        return textureCache[key]
    }

    private func storeCachedTexture(_ texture: MTLTexture, forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        textureCache[key] = texture
    }

    private func makePathTexture(floats: [Float]) -> MTLTexture {
        let w = FlairPathRasterizer.maxPoints
        let h = 2
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba32Float,
            width: w,
            height: h,
            mipmapped: false
        )
        desc.usage = [.shaderRead]
        desc.storageMode = .shared
        let tex = device.makeTexture(descriptor: desc)!
        floats.withUnsafeBytes { raw in
            if let base = raw.baseAddress {
                tex.replace(
                    region: MTLRegionMake2D(0, 0, w, h),
                    mipmapLevel: 0,
                    withBytes: base,
                    bytesPerRow: w * 16
                )
            }
        }
        return tex
    }

    private func makeRGBA8Texture(
        pixels: [UInt8],
        width: Int,
        height: Int,
        mipmapped: Bool,
        commandBuffer: MTLCommandBuffer
    ) -> MTLTexture {
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: width,
            height: height,
            mipmapped: mipmapped && width > 1 && height > 1
        )
        desc.usage = [.shaderRead]
        desc.storageMode = .shared
        let tex = device.makeTexture(descriptor: desc)!
        pixels.withUnsafeBytes { raw in
            if let base = raw.baseAddress {
                tex.replace(
                    region: MTLRegionMake2D(0, 0, width, height),
                    mipmapLevel: 0,
                    withBytes: base,
                    bytesPerRow: width * 4
                )
            }
        }
        if desc.mipmapLevelCount > 1, let blit = commandBuffer.makeBlitCommandEncoder() {
            blit.generateMipmaps(for: tex)
            blit.endEncoding()
        }
        return tex
    }

    private func makeCGImageTexture(
        _ cgImage: CGImage,
        mipmapped: Bool,
        commandBuffer: MTLCommandBuffer
    ) -> MTLTexture {
        let w = max(1, cgImage.width)
        let h = max(1, cgImage.height)
        var pixels = Array<UInt8>(repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        if let ctx = CGContext(
            data: &pixels,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) {
            // Flip vertically so row 0 in texture memory is the bottom of the image (matching WebGL UNPACK_FLIP_Y_WEBGL).
            ctx.translateBy(x: 0, y: CGFloat(h))
            ctx.scaleBy(x: 1, y: -1)
            ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
        return makeRGBA8Texture(pixels: pixels, width: w, height: h, mipmapped: mipmapped, commandBuffer: commandBuffer)
    }

    private func defaultTexture2D() -> MTLTexture {
        lock.lock()
        if let tex = fallbackTexture2D {
            lock.unlock()
            return tex
        }
        lock.unlock()

        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: 1, height: 1, mipmapped: false)
        desc.usage = [.shaderRead]
        desc.storageMode = .shared
        let tex = device.makeTexture(descriptor: desc)!
        let black: [UInt8] = [0, 0, 0, 255]
        black.withUnsafeBytes { raw in
            if let base = raw.baseAddress {
                tex.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, withBytes: base, bytesPerRow: 4)
            }
        }
        lock.lock()
        fallbackTexture2D = tex
        lock.unlock()
        return tex
    }

    private func defaultPathTexture() -> MTLTexture {
        lock.lock()
        if let tex = fallbackPathTexture {
            lock.unlock()
            return tex
        }
        lock.unlock()

        let floats = Array<Float>(repeating: 0, count: FlairPathRasterizer.maxPoints * 2 * 4)
        let tex = makePathTexture(floats: floats)
        lock.lock()
        fallbackPathTexture = tex
        lock.unlock()
        return tex
    }
}
`;

export const FLAIR_PIPELINE_SWIFT = `import CoreGraphics
import Foundation
import Metal

/// Where a sampler input on a \`FlairPipelinePass\` reads its pixels from.
public enum FlairPassInput: Sendable, Equatable {
    /// The output of the immediately preceding pass.
    case previous
    /// This pass's own output from the previous frame (ping-pong feedback buffer).
    case feedback
    /// The output of a specific earlier pass index (\`0..<passIndex\`).
    case pass(Int)
    /// A static or procedural texture input.
    case texture(FlairTextureInput)
}

/// How a pass composites over the previous pass.
public enum FlairPassBlend: String, Sendable, Equatable {
    /// Draws a fresh pass (default).
    case replace
    /// Alpha-blends over the previous pass's output.
    case over
}

/// One pass in a multi-pass \`FlairPipeline\`.
public struct FlairPipelinePass: Sendable, Equatable {
    public var effect: AnyFlairEffect
    public var inputs: [String: FlairPassInput]
    public var blend: FlairPassBlend

    public init<E: FlairEffect>(
        _ effect: E,
        inputs: [String: FlairPassInput] = [:],
        blend: FlairPassBlend = .replace
    ) {
        self.effect = AnyFlairEffect(effect)
        self.inputs = inputs
        self.blend = blend
    }

    public init(
        anyEffect: AnyFlairEffect,
        inputs: [String: FlairPassInput] = [:],
        blend: FlairPassBlend = .replace
    ) {
        self.effect = anyEffect
        self.inputs = inputs
        self.blend = blend
    }
}

/// Multi-pass Metal shader pipeline supporting intermediate pass routing (\`.previous\`, \`.pass(n)\`),
/// ping-pong frame feedback (\`.feedback\`), and alpha overlay stacks (\`.over\`), matching \`ShaderPipeline\`
/// and \`effectStack\` in \`@pixerate/flair\`.
public final class FlairPipeline: @unchecked Sendable {
    public let renderer: FlairRenderer
    public var passes: [FlairPipelinePass]

    private var passTextures: [Int: MTLTexture] = [:]
    private var feedbackReadTextures: [Int: MTLTexture] = [:]
    private var feedbackWriteTextures: [Int: MTLTexture] = [:]
    private var cachedWidth: Int = 0
    private var cachedHeight: Int = 0

    public init(renderer: FlairRenderer, passes: [FlairPipelinePass]) {
        self.renderer = renderer
        self.passes = passes
    }

    /// Creates a pipeline from a base effect followed by filters (whose first \`sampler2D\` receives \`.previous\`)
    /// or transparent overlays (\`blend: .over\`), matching \`effectStack\` in \`@pixerate/flair\`.
    public static func effectStack(
        renderer: FlairRenderer,
        base: AnyFlairEffect,
        overlays: [AnyFlairEffect]
    ) -> FlairPipeline {
        var list: [FlairPipelinePass] = [FlairPipelinePass(anyEffect: base)]
        for item in overlays {
            let imageBindings = item.samplerBindings.filter { $0.type == .sampler2D }
            if let firstImage = imageBindings.first {
                list.append(
                    FlairPipelinePass(
                        anyEffect: item,
                        inputs: [firstImage.name: .previous],
                        blend: .replace
                    )
                )
            } else {
                list.append(
                    FlairPipelinePass(
                        anyEffect: item,
                        inputs: [:],
                        blend: .over
                    )
                )
            }
        }
        return FlairPipeline(renderer: renderer, passes: list)
    }

    /// Resets ping-pong feedback history textures to transparent black.
    public func resetFeedback() {
        feedbackReadTextures.removeAll()
        feedbackWriteTextures.removeAll()
    }

    /// Renders all passes in order and writes the final output into \`targetTexture\`.
    public func render(
        state: FlairFrameState,
        to targetTexture: MTLTexture,
        commandBuffer: MTLCommandBuffer? = nil
    ) throws {
        guard !passes.isEmpty else { return }
        let w = targetTexture.width
        let h = targetTexture.height
        ensureIntermediateTextures(width: w, height: h, pixelFormat: targetTexture.pixelFormat)

        let ownsBuffer = (commandBuffer == nil)
        guard let cmd = commandBuffer ?? renderer.commandQueue.makeCommandBuffer() else {
            throw FlairRendererError.commandQueueUnavailable
        }

        let lastIndex = passes.count - 1
        for i in 0..<passes.count {
            let pass = passes[i]
            let isLast = (i == lastIndex)
            let usesFeedback = pass.inputs.values.contains(.feedback)

            // Intermediate passes render in bottom-up texture orientation (flipY = false) so
            // subsequent passes sampling at uv = fragCoord / iResolution.xy read them upright.
            // The final pass outputting to targetTexture uses state.flipY.
            var passState = state
            passState.width = Float(w)
            passState.height = Float(h)
            passState.flipY = isLast && !usesFeedback ? state.flipY : false

            for (uniformName, source) in pass.inputs {
                switch source {
                case .previous:
                    if i > 0, let prev = passTextures[i - 1] {
                        renderer.setLiveTexture(prev, for: uniformName)
                    }
                case .pass(let idx):
                    if let earlier = passTextures[idx] {
                        renderer.setLiveTexture(earlier, for: uniformName)
                    }
                case .feedback:
                    if let fb = feedbackReadTextures[i] {
                        renderer.setLiveTexture(fb, for: uniformName)
                    }
                case .texture:
                    renderer.setLiveTexture(nil, for: uniformName)
                }
            }

            let outTex: MTLTexture
            if usesFeedback {
                outTex = feedbackWriteTextures[i]!
            } else if isLast {
                outTex = targetTexture
            } else {
                outTex = passTextures[i]!
            }

            if pass.blend == .over && i > 0, let prevTex = passTextures[i - 1], prevTex !== outTex {
                if let blit = cmd.makeBlitCommandEncoder() {
                    blit.copy(
                        from: prevTex,
                        sourceSlice: 0,
                        sourceLevel: 0,
                        sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
                        sourceSize: MTLSize(width: w, height: h, depth: 1),
                        to: outTex,
                        destinationSlice: 0,
                        destinationLevel: 0,
                        destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0)
                    )
                    blit.endEncoding()
                }
            }

            try renderer.render(
                anyEffect: pass.effect,
                state: passState,
                to: outTex,
                commandBuffer: cmd,
                loadAction: (pass.blend == .over && i > 0) ? .load : .clear,
                blendOver: pass.blend == .over && i > 0
            )

            for uniformName in pass.inputs.keys {
                renderer.setLiveTexture(nil, for: uniformName)
            }

            if usesFeedback {
                passTextures[i] = outTex
                let oldRead = feedbackReadTextures[i]
                feedbackReadTextures[i] = outTex
                feedbackWriteTextures[i] = oldRead
                if isLast && outTex !== targetTexture {
                    if let blit = cmd.makeBlitCommandEncoder() {
                        blit.copy(
                            from: outTex,
                            sourceSlice: 0,
                            sourceLevel: 0,
                            sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
                            sourceSize: MTLSize(width: w, height: h, depth: 1),
                            to: targetTexture,
                            destinationSlice: 0,
                            destinationLevel: 0,
                            destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0)
                        )
                        blit.endEncoding()
                    }
                }
            }
        }

        if ownsBuffer {
            cmd.commit()
            cmd.waitUntilCompleted()
        }
    }

    /// Renders the pipeline offscreen and returns an upright \`CGImage\`.
    public func renderCGImage(
        width: Int = 320,
        height: Int = 180,
        time: Float = 0,
        state: FlairFrameState? = nil
    ) throws -> CGImage {
        let w = max(1, width)
        let h = max(1, height)
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: w,
            height: h,
            mipmapped: false
        )
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .shared
        guard let target = renderer.device.makeTexture(descriptor: desc) else {
            throw FlairRendererError.textureCreationFailed
        }
        var frameState = state ?? FlairFrameState(width: Float(w), height: Float(h), time: time)
        frameState.width = Float(w)
        frameState.height = Float(h)
        if state == nil { frameState.time = time }
        frameState.flipY = true
        try render(state: frameState, to: target)
        return try renderer.readCGImage(from: target)
    }

    private func ensureIntermediateTextures(width: Int, height: Int, pixelFormat: MTLPixelFormat) {
        if cachedWidth != width || cachedHeight != height {
            passTextures.removeAll()
            feedbackReadTextures.removeAll()
            feedbackWriteTextures.removeAll()
            cachedWidth = width
            cachedHeight = height
        }
        for i in 0..<passes.count {
            if passTextures[i] == nil {
                passTextures[i] = makeTargetTexture(width: width, height: height, pixelFormat: pixelFormat)
            }
            if passes[i].inputs.values.contains(.feedback) {
                if feedbackReadTextures[i] == nil {
                    feedbackReadTextures[i] = makeTargetTexture(width: width, height: height, pixelFormat: pixelFormat)
                }
                if feedbackWriteTextures[i] == nil {
                    feedbackWriteTextures[i] = makeTargetTexture(width: width, height: height, pixelFormat: pixelFormat)
                }
            }
        }
    }

    private func makeTargetTexture(width: Int, height: Int, pixelFormat: MTLPixelFormat) -> MTLTexture {
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: pixelFormat,
            width: max(1, width),
            height: max(1, height),
            mipmapped: false
        )
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .private
        return renderer.device.makeTexture(descriptor: desc)!
    }
}
`;

export const FLAIR_EFFECT_VIEW_SWIFT = `#if canImport(SwiftUI) && canImport(MetalKit)
import Foundation
import Metal
import MetalKit
import SwiftUI

/// A SwiftUI view that renders any \`FlairEffect\` at up to 60–120 fps using \`MTKView\`.
public struct FlairEffectView<E: FlairEffect>: View {
    public var effect: E
    public var isPaused: Bool
    public var preferredFramesPerSecond: Int
    public var fixedTime: Float?
    public var pointerTracker: FlairPointerTracker?
    public var audioAnalyzer: FlairAudioAnalyzer?
    public var scrollTracker: FlairScrollTracker?

    @State private var internalPointer = FlairPointerTracker()

    public init(
        _ effect: E,
        isPaused: Bool = false,
        preferredFramesPerSecond: Int = 60,
        fixedTime: Float? = nil,
        pointerTracker: FlairPointerTracker? = nil,
        audioAnalyzer: FlairAudioAnalyzer? = nil,
        scrollTracker: FlairScrollTracker? = nil
    ) {
        self.effect = effect
        self.isPaused = isPaused
        self.preferredFramesPerSecond = preferredFramesPerSecond
        self.fixedTime = fixedTime
        self.pointerTracker = pointerTracker
        self.audioAnalyzer = audioAnalyzer
        self.scrollTracker = scrollTracker
    }

    public var body: some View {
        let activePointer = pointerTracker ?? internalPointer
        GeometryReader { proxy in
            FlairMTKViewRepresentable(
                effect: AnyFlairEffect(effect),
                isPaused: isPaused,
                preferredFramesPerSecond: preferredFramesPerSecond,
                fixedTime: fixedTime,
                pointerTracker: activePointer,
                audioAnalyzer: audioAnalyzer,
                scrollTracker: scrollTracker
            )
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let scale = Float(proxy.size.height > 0 ? 1.0 : 1.0)
                        let px = Float(value.location.x) * scale
                        let py = Float(proxy.size.height - value.location.y) * scale
                        let t = fixedTime ?? Float( CACurrentMediaTime() )
                        activePointer.down(x: px, y: py, time: t)
                    }
                    .onEnded { _ in
                        let t = fixedTime ?? Float( CACurrentMediaTime() )
                        activePointer.up(time: t)
                    }
            )
        }
    }
}

/// A SwiftUI view that renders a multi-pass \`FlairPipeline\`.
public struct FlairPipelineView: View {
    public var passes: [FlairPipelinePass]
    public var isPaused: Bool
    public var preferredFramesPerSecond: Int
    public var fixedTime: Float?

    public init(
        passes: [FlairPipelinePass],
        isPaused: Bool = false,
        preferredFramesPerSecond: Int = 60,
        fixedTime: Float? = nil
    ) {
        self.passes = passes
        self.isPaused = isPaused
        self.preferredFramesPerSecond = preferredFramesPerSecond
        self.fixedTime = fixedTime
    }

    public var body: some View {
        FlairPipelineMTKViewRepresentable(
            passes: passes,
            isPaused: isPaused,
            preferredFramesPerSecond: preferredFramesPerSecond,
            fixedTime: fixedTime
        )
    }
}

extension View {
    /// Places an animated \`FlairEffect\` behind this view.
    public func flairBackground<E: FlairEffect>(
        _ effect: E,
        isPaused: Bool = false,
        preferredFramesPerSecond: Int = 60
    ) -> some View {
        self.background(
            FlairEffectView(
                effect,
                isPaused: isPaused,
                preferredFramesPerSecond: preferredFramesPerSecond
            )
        )
    }

    /// Places a transparent \`FlairEffect\` overlay above this view with hit-testing disabled.
    public func flairOverlay<E: FlairEffect>(
        _ effect: E,
        isPaused: Bool = false,
        preferredFramesPerSecond: Int = 60
    ) -> some View {
        self.overlay(
            FlairEffectView(
                effect,
                isPaused: isPaused,
                preferredFramesPerSecond: preferredFramesPerSecond
            )
            .allowsHitTesting(false)
        )
    }
}

final class FlairMTKCoordinator: NSObject, MTKViewDelegate {
    var effect: AnyFlairEffect
    var fixedTime: Float?
    var pointerTracker: FlairPointerTracker?
    var audioAnalyzer: FlairAudioAnalyzer?
    var scrollTracker: FlairScrollTracker?

    private let renderer: FlairRenderer?
    private let startTime = CACurrentMediaTime()
    private var lastTime: CFTimeInterval = 0
    private var frameCount: Int32 = 0

    init(effect: AnyFlairEffect) {
        self.effect = effect
        self.renderer = try? FlairRenderer()
        super.init()
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let renderer = renderer,
              let drawable = view.currentDrawable else { return }
        let now = CACurrentMediaTime()
        let elapsed = fixedTime ?? Float(now - startTime)
        let dt = lastTime == 0 ? (1.0 / 60.0) : Float(max(1.0 / 240.0, now - lastTime))
        lastTime = now

        var state = FlairFrameState(
            width: Float(drawable.texture.width),
            height: Float(drawable.texture.height),
            time: elapsed,
            delta: dt,
            frame: frameCount,
            flipY: true
        )
        frameCount &+= 1
        pointerTracker?.apply(to: &state)
        audioAnalyzer?.apply(to: &state)
        scrollTracker?.apply(to: &state)

        guard let cmd = renderer.commandQueue.makeCommandBuffer() else { return }
        try? renderer.render(
            anyEffect: effect,
            state: state,
            to: drawable.texture,
            commandBuffer: cmd
        )
        cmd.present(drawable)
        cmd.commit()
    }
}

final class FlairPipelineMTKCoordinator: NSObject, MTKViewDelegate {
    var passes: [FlairPipelinePass] {
        didSet { pipeline?.passes = passes }
    }
    var fixedTime: Float?

    private let renderer: FlairRenderer?
    private var pipeline: FlairPipeline?
    private let startTime = CACurrentMediaTime()
    private var lastTime: CFTimeInterval = 0
    private var frameCount: Int32 = 0

    init(passes: [FlairPipelinePass]) {
        self.passes = passes
        let r = try? FlairRenderer()
        self.renderer = r
        self.pipeline = r.map { FlairPipeline(renderer: $0, passes: passes) }
        super.init()
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let renderer = renderer,
              let pipeline = pipeline,
              let drawable = view.currentDrawable else { return }
        let now = CACurrentMediaTime()
        let elapsed = fixedTime ?? Float(now - startTime)
        let dt = lastTime == 0 ? (1.0 / 60.0) : Float(max(1.0 / 240.0, now - lastTime))
        lastTime = now

        let state = FlairFrameState(
            width: Float(drawable.texture.width),
            height: Float(drawable.texture.height),
            time: elapsed,
            delta: dt,
            frame: frameCount,
            flipY: true
        )
        frameCount &+= 1

        guard let cmd = renderer.commandQueue.makeCommandBuffer() else { return }
        try? pipeline.render(state: state, to: drawable.texture, commandBuffer: cmd)
        cmd.present(drawable)
        cmd.commit()
    }
}

#if os(macOS)
struct FlairMTKViewRepresentable: NSViewRepresentable {
    var effect: AnyFlairEffect
    var isPaused: Bool
    var preferredFramesPerSecond: Int
    var fixedTime: Float?
    var pointerTracker: FlairPointerTracker?
    var audioAnalyzer: FlairAudioAnalyzer?
    var scrollTracker: FlairScrollTracker?

    func makeCoordinator() -> FlairMTKCoordinator {
        FlairMTKCoordinator(effect: effect)
    }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = false
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        view.layer?.isOpaque = !effect.isTransparent
        view.delegate = context.coordinator
        return view
    }

    func updateNSView(_ view: MTKView, context: Context) {
        context.coordinator.effect = effect
        context.coordinator.fixedTime = fixedTime
        context.coordinator.pointerTracker = pointerTracker
        context.coordinator.audioAnalyzer = audioAnalyzer
        context.coordinator.scrollTracker = scrollTracker
        view.isPaused = isPaused
        view.enableSetNeedsDisplay = isPaused
        view.preferredFramesPerSecond = preferredFramesPerSecond
        view.layer?.isOpaque = !effect.isTransparent
        if isPaused { view.setNeedsDisplay(view.bounds) }
    }
}

struct FlairPipelineMTKViewRepresentable: NSViewRepresentable {
    var passes: [FlairPipelinePass]
    var isPaused: Bool
    var preferredFramesPerSecond: Int
    var fixedTime: Float?

    func makeCoordinator() -> FlairPipelineMTKCoordinator {
        FlairPipelineMTKCoordinator(passes: passes)
    }

    func makeNSView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = false
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        view.delegate = context.coordinator
        return view
    }

    func updateNSView(_ view: MTKView, context: Context) {
        context.coordinator.passes = passes
        context.coordinator.fixedTime = fixedTime
        view.isPaused = isPaused
        view.enableSetNeedsDisplay = isPaused
        view.preferredFramesPerSecond = preferredFramesPerSecond
        if isPaused { view.setNeedsDisplay(view.bounds) }
    }
}
#else
struct FlairMTKViewRepresentable: UIViewRepresentable {
    var effect: AnyFlairEffect
    var isPaused: Bool
    var preferredFramesPerSecond: Int
    var fixedTime: Float?
    var pointerTracker: FlairPointerTracker?
    var audioAnalyzer: FlairAudioAnalyzer?
    var scrollTracker: FlairScrollTracker?

    func makeCoordinator() -> FlairMTKCoordinator {
        FlairMTKCoordinator(effect: effect)
    }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = false
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        view.isOpaque = !effect.isTransparent
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.effect = effect
        context.coordinator.fixedTime = fixedTime
        context.coordinator.pointerTracker = pointerTracker
        context.coordinator.audioAnalyzer = audioAnalyzer
        context.coordinator.scrollTracker = scrollTracker
        view.isPaused = isPaused
        view.enableSetNeedsDisplay = isPaused
        view.preferredFramesPerSecond = preferredFramesPerSecond
        view.isOpaque = !effect.isTransparent
        if isPaused { view.setNeedsDisplay() }
    }
}

struct FlairPipelineMTKViewRepresentable: UIViewRepresentable {
    var passes: [FlairPipelinePass]
    var isPaused: Bool
    var preferredFramesPerSecond: Int
    var fixedTime: Float?

    func makeCoordinator() -> FlairPipelineMTKCoordinator {
        FlairPipelineMTKCoordinator(passes: passes)
    }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = false
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.passes = passes
        context.coordinator.fixedTime = fixedTime
        view.isPaused = isPaused
        view.enableSetNeedsDisplay = isPaused
        view.preferredFramesPerSecond = preferredFramesPerSecond
        if isPaused { view.setNeedsDisplay() }
    }
}
#endif
#endif
`;

export const FLAIR_TESTS_SWIFT = `import CoreGraphics
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
        // Row 1 texel 0: (pointsCount, totalLength, chunks, fitCode)
        let pointCount = pathFloats[256 * 4 + 0]
        let totalLength = pathFloats[256 * 4 + 1]
        let chunks = pathFloats[256 * 4 + 2]
        let fitCode = pathFloats[256 * 4 + 3]
        XCTAssertGreaterThanOrEqual(pointCount, 4)
        XCTAssertGreaterThan(totalLength, 300)
        XCTAssertGreaterThanOrEqual(chunks, 1)
        XCTAssertEqual(fitCode, 1.0)

        let ptsFloats = FlairPathRasterizer.rasterize(
            points: [SIMD2<Float>(10, 20), SIMD2<Float>(110, 20), SIMD2<Float>(110, 80)],
            width: 200,
            height: 200
        )
        XCTAssertGreaterThanOrEqual(ptsFloats[256 * 4 + 0], 2)
        XCTAssertEqual(ptsFloats[256 * 4 + 1], 160, accuracy: 1e-3)
        XCTAssertEqual(ptsFloats[256 * 4 + 3], 0.0) // fitCode == 0 for point arrays

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
        if let pathEffect = FlairCatalog.effect(id: "glass-tube") {
            var configured = pathEffect
                .withPreset("Neon")
                .applying(values: [
                    "uBackgroundAlpha": .number(0.0),
                    "uDrawOn": .number(0.0),
                    "uProgress": .number(1.0),
                ])
            configured.setTextureInput(.points([SIMD2<Float>(12, 32), SIMD2<Float>(84, 32)]), for: 1)
            let bytes = try renderer.renderBytes(anyEffect: configured, width: 96, height: 64, time: 0.5)
            XCTAssertEqual(bytes.count, 96 * 64 * 4)
            let strokeOpaqueCount = bytes.stride(by: 4, offset: 3).filter { $0 > 16 }.count
            XCTAssertGreaterThan(strokeOpaqueCount, 50)
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
`;
