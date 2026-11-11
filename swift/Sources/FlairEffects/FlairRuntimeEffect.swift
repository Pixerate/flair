import Foundation

/**
 * A shader compiled to Metal Shading Language outside this package (for instance by
 * `attachFlairMetal` in `@pixerate/flair/node`, from GLSL edited after the package was built), with
 * the `std140` layout of its `FlairUniforms` buffer. Wrap it with `AnyFlairEffect(runtime:)` to draw
 * it with `FlairRenderer`, after `FlairRenderer.loadLibrary(msl:functionName:timeoutMs:)` has
 * compiled its source.
 */
public struct FlairRuntimeEffect: Sendable, Equatable {
    /// One scalar or vector control in the uniform buffer.
    public struct Field: Sendable, Equatable {
        public let name: String
        public let type: FlairControlType
        /// Byte offset in `FlairUniforms` (at least `FlairFrameState.builtinByteLength`).
        public let offset: Int
        /// The range values are clamped to (per component for vectors).
        public let min: Float
        public let max: Float
        public let isColor: Bool

        public init(name: String, type: FlairControlType, offset: Int, min: Float, max: Float, isColor: Bool = false) {
            self.name = name
            self.type = type
            self.offset = offset
            self.min = min
            self.max = max
            self.isColor = isColor
        }
    }

    public let effectId: String
    public let effectName: String
    /// The fragment function in `msl`; it must not clash with a catalog effect's.
    public let functionName: String
    public let msl: String
    public let uniformByteLength: Int
    public let fields: [Field]
    public let samplerBindings: [FlairSamplerBinding]
    public let isTransparent: Bool
    /// Control values by uniform name: numbers, booleans, channel arrays (or hex colour strings) and texture strings.
    public var values: [String: FlairJSONValue]

    public init(effectId: String, effectName: String, functionName: String, msl: String, uniformByteLength: Int, fields: [Field], samplerBindings: [FlairSamplerBinding] = [], isTransparent: Bool = false, values: [String: FlairJSONValue] = [:]) {
        self.effectId = effectId
        self.effectName = effectName
        self.functionName = functionName
        self.msl = msl
        self.uniformByteLength = Swift.max(uniformByteLength, FlairFrameState.builtinByteLength)
        self.fields = fields
        self.samplerBindings = samplerBindings
        self.isTransparent = isTransparent
        self.values = values
    }

    /// Writes the built-ins and every field (clamped to its range; zero when it has no value) into `buffer` (`uniformByteLength` bytes).
    public func encodeUniforms(into buffer: UnsafeMutableRawPointer, state: FlairFrameState) {
        memset(buffer, 0, uniformByteLength)
        state.encodeBuiltins(into: buffer)
        for f in fields where f.offset >= FlairFrameState.builtinByteLength {
            let value = values[f.name] ?? .null
            func clamp(_ x: Float) -> Float { Swift.min(f.max, Swift.max(f.min, x)) }
            switch f.type {
            case .float:
                if case .number(let n) = value { FlairUniformEncoder.writeFloat(clamp(Float(n)), to: buffer, at: f.offset) }
            case .int:
                if case .number(let n) = value { FlairUniformEncoder.writeInt(Int32(clamp(Float(n.rounded()))), to: buffer, at: f.offset) }
            case .bool:
                if case .bool(let b) = value { FlairUniformEncoder.writeBool(b, to: buffer, at: f.offset) }
            case .vec2, .vec3, .vec4:
                let count = f.type == .vec2 ? 2 : f.type == .vec3 ? 3 : 4
                var channels: [Float]
                switch value {
                case .array(let a): channels = a.map(Float.init)
                case .string(let s):
                    guard let c = FlairJSONBag.parseHexColor(s) else { continue }
                    channels = [c.x, c.y, c.z, c.w]
                default: continue
                }
                for i in 0..<count {
                    FlairUniformEncoder.writeFloat(clamp(i < channels.count ? channels[i] : 0), to: buffer, at: f.offset + i * 4)
                }
            case .sampler2D, .path:
                continue
            }
        }
    }

    /// The texture a sampler shows: a texture string value (a sample image or SVG path data), else none.
    public func textureInput(for binding: Int) -> FlairTextureInput {
        guard let b = samplerBindings.first(where: { $0.binding == binding }), case .string(let s)? = values[b.name] else { return .none }
        return FlairTextureInput.fromControlString(s, defaultFit: b.pathFit, defaultMargin: b.pathMargin)
    }

    /// Control descriptors (fields, then samplers), as `AnyFlairEffect.controls` lists them.
    public var controls: [FlairControlDescriptor] {
        fields.map { FlairControlDescriptor(name: $0.name, property: $0.name, type: $0.type, label: $0.name, isColor: $0.isColor, min: $0.min, max: $0.max) }
            + samplerBindings.map { FlairControlDescriptor(name: $0.name, property: $0.property, type: $0.type, label: $0.name, filter: $0.filter, wrap: $0.wrap, pathFit: $0.pathFit, pathMargin: $0.pathMargin) }
    }
}
