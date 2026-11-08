import CoreGraphics
import Foundation
import Metal

/// Where a sampler input on a `FlairPipelinePass` reads its pixels from.
public enum FlairPassInput: Sendable, Equatable {
    /// The output of the immediately preceding pass.
    case previous
    /// This pass's own output from the previous frame (ping-pong feedback buffer).
    case feedback
    /// The output of a specific earlier pass index (`0..<passIndex`).
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

/// One pass in a multi-pass `FlairPipeline`.
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

/// Multi-pass Metal shader pipeline supporting intermediate pass routing (`.previous`, `.pass(n)`),
/// ping-pong frame feedback (`.feedback`), and alpha overlay stacks (`.over`), matching `ShaderPipeline`
/// and `effectStack` in `@pixerate/flair`.
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

    /// Creates a pipeline from a base effect followed by filters (whose first `sampler2D` receives `.previous`)
    /// or transparent overlays (`blend: .over`), matching `effectStack` in `@pixerate/flair`.
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

    /// Renders all passes in order and writes the final output into `targetTexture`.
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

    /// Renders the pipeline offscreen and returns an upright `CGImage`.
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
