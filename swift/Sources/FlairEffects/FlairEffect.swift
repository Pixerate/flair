import Foundation

/// A Shadertoy-style catalog effect compiled to Metal Shading Language with typed controls and presets.
public protocol FlairEffect: Codable, Sendable, Equatable {
    /// Catalog identifier (e.g. `"mesh-gradient"`).
    static var effectId: String { get }
    /// Human-readable display name (e.g. `"Mesh gradient"`).
    static var effectName: String { get }
    /// Catalog category (e.g. `"gradients"`).
    static var category: String { get }
    /// One-sentence visual description.
    static var effectDescription: String { get }
    /// Search tags from the catalog.
    static var tags: [String] { get }
    /// Metal pipeline phase (1: procedural, 2: texture/path inputs, 4: audio/pointer/scroll built-ins).
    static var phase: Int { get }
    /// Unique Metal fragment shader entry-point name (e.g. `"flair_mesh_gradient_frag"`).
    static var functionName: String { get }
    /// Total byte size of the `FlairUniforms` `std140` buffer at `[[buffer(0)]]`.
    static var uniformByteLength: Int { get }
    /// Whether the shader outputs alpha for compositing over other content.
    static var isTransparent: Bool { get }
    /// Exact loop duration in seconds, if the shader loops seamlessly.
    static var loopDuration: Double? { get }
    /// Control descriptors in declaration order.
    static var controls: [FlairControlDescriptor] { get }
    /// Sampler bindings (`[[texture(1)]]`, `[[sampler(1)]]`, …) in declaration order.
    static var samplerBindings: [FlairSamplerBinding] { get }
    /// Named catalog presets.
    static var presets: [String: Self] { get }

    /// Initializes the effect with its default control values.
    init()
    /// Initializes the effect with a named preset (case-insensitive fallback to defaults when unknown).
    init(preset: String)

    /// Writes the built-in prefix and all control uniforms into `buffer` (must have at least `Self.uniformByteLength` bytes).
    func encodeUniforms(into buffer: UnsafeMutableRawPointer, state: FlairFrameState)
    /// Returns the texture input bound at `[[texture(binding)]]`.
    func textureInput(for binding: Int) -> FlairTextureInput
    /// Updates the texture input bound at `[[texture(binding)]]`.
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

    /// Packs the effect's `FlairUniforms` `std140` buffer for `state` into a `Data` buffer.
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

/// Type-erased wrapper around any `FlairEffect`, used by `FlairCatalog` and `FlairPipeline`.
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
    }

    public func withPreset(_ name: String) -> AnyFlairEffect {
        _makePreset(name)
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
