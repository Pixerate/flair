import CoreGraphics
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
    case `repeat` = "repeat"
    case clamp
    case mirror
}

/// How an SVG path is fitted into the frame.
public enum FlairPathFit: String, Codable, Sendable, Equatable {
    case contain
    case cover
    case fill
    case none
}

/// Built-in sample pictures matching `@pixerate/flair`'s `SAMPLE_IMAGES`.
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

/// Metadata describing a single `// @control` uniform on a `FlairEffect`.
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

/// Metadata describing a texture or path sampler slot bound at `[[texture(N)]]`, `[[sampler(N)]]`.
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

/// Sendable wrapper for `CGImage` values stored on a `FlairTextureInput`.
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

/// Value bound to a `sampler2D` or `path` control on a `FlairEffect`.
public enum FlairTextureInput: Sendable, Equatable, Codable {
    case none
    case sample(FlairSampleImage)
    case text(String, font: String = "Helvetica-Bold", weight: Double = 900, width: Int = 1024, height: Int = 256)
    case path(String, fit: FlairPathFit = .contain, margin: Float = 0.1)
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
            try container.encode("sample:\(s.rawValue)")
        case .text(let t, _, _, _, _):
            try container.encode("text:\(t)")
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
            try container.encode("data:image/png;base64,\(data.base64EncodedString())")
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
               let range = xml.range(of: "<text[^>]*>([\\s\\S]*?)</text>", options: .regularExpression) {
                let tag = String(xml[range])
                if let gt = tag.firstIndex(of: ">"),
                   let lt = tag.range(of: "</text>", options: .backwards)?.lowerBound,
                   gt < lt {
                    let body = String(tag[tag.index(after: gt)..<lt])
                        .replacingOccurrences(of: "&amp;", with: "&")
                        .replacingOccurrences(of: "&lt;", with: "<")
                        .replacingOccurrences(of: "&gt;", with: ">")
                        .replacingOccurrences(of: "&quot;", with: "\"")
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

    /// Writes the 992-byte `std140` built-in uniform prefix into `buffer`.
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

/// Low-level `std140` byte writer and value clamping helpers used by generated `FlairEffect` structs.
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

/// Loose JSON value representation so effects decode web control values (`flair export -v`) seamlessly.
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

/// Helper used by generated `FlairEffect` structs to decode and encode control JSON dictionaries.
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
            values[key] = .string("sample:\(s.rawValue)")
        case .text(let t, _, _, _, _):
            values[key] = .string("text:\(t)")
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
            values[key] = .string("data:image/png;base64,\(data.base64EncodedString())")
        case .image:
            values[key] = .string("[CGImage]")
        }
    }

    public static func parseHexColor(_ raw: String) -> SIMD4<Float>? {
        var hex = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        if hex.count == 3 || hex.count == 4 {
            hex = hex.map { "\($0)\($0)" }.joined()
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
