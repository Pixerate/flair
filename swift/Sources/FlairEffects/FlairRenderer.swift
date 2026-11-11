import CoreGraphics
import Foundation
import ImageIO
import Metal
import MetalKit

/// Errors thrown by `FlairRenderer` when initializing Metal resources or compiling shaders.
public enum FlairRendererError: Error, LocalizedError, Sendable {
    case metalDeviceUnavailable
    case commandQueueUnavailable
    case shaderSourceNotFound(String)
    case shaderFunctionNotFound(String)
    case textureCreationFailed
    /// Compiling an effect's shader took longer than the allowed ms (`prepare(anyEffect:timeoutMs:)`).
    case compileTimedOut(String, Double)

    public var errorDescription: String? {
        switch self {
        case .metalDeviceUnavailable:
            return "No Metal GPU device is available on this system."
        case .commandQueueUnavailable:
            return "Could not create a Metal command queue."
        case .shaderSourceNotFound(let name):
            return "Could not find bundled Metal shader source for '\(name)'."
        case .shaderFunctionNotFound(let name):
            return "Could not find Metal fragment function '\(name)'."
        case .textureCreationFailed:
            return "Could not allocate target MTLTexture."
        case .compileTimedOut(let id, let ms):
            return "Compiling the Metal shader for '\(id)' took longer than \(Int(ms)) ms."
        }
    }
}

/// Renders `FlairEffect` shaders into `MTLTexture` targets, `MTKView` views, or offscreen `CGImage` bitmaps.
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

    /// Binds a live `MTLTexture` (such as a video frame, camera feed, or intermediate pass) to a named sampler uniform.
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

    /**
     * Compiles `effect`'s pipeline for `pixelFormat` now, unless it is cached already, and waits at
     * most `timeoutMs` for it. Past that it throws `compileTimedOut`; the compile still finishes in
     * the background and is cached, so a later render (or `prepare`) uses it. Shaders in the
     * package's default library (an Xcode build) are ready at once; a SwiftPM build compiles the
     * bundled `.metal` source on first use, which this bounds.
     */
    public func prepare(anyEffect effect: AnyFlairEffect, pixelFormat: MTLPixelFormat = .rgba8Unorm, timeoutMs: Double) throws {
        let key = PipelineKey(functionName: effect.functionName, pixelFormat: pixelFormat.rawValue, isTransparent: false)
        if lock.withLock({ pipelines[key] }) != nil { return }
        final class Outcome: @unchecked Sendable { var error: Error? }
        let outcome = Outcome()
        let done = DispatchSemaphore(value: 0)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                _ = try self.pipelineState(functionName: effect.functionName, effectId: effect.effectId, pixelFormat: pixelFormat, isTransparent: false)
            } catch {
                outcome.error = error
            }
            done.signal()
        }
        if done.wait(timeout: .now() + .milliseconds(max(0, Int(timeoutMs)))) == .timedOut {
            throw FlairRendererError.compileTimedOut(effect.effectId, timeoutMs)
        }
        if let error = outcome.error { throw error }
    }

    /**
     * Compiles a run-time effect's Metal source (`FlairRuntimeEffect.msl`) so `functionName` can be
     * drawn, waiting at most `timeoutMs`. Past that it throws `compileTimedOut`; the compile finishes
     * in the background and is kept. A source that doesn't compile, or has no `functionName`, throws
     * the compiler's error. Loading the same function again does nothing.
     */
    public func loadLibrary(msl: String, functionName: String, timeoutMs: Double) throws {
        if lock.withLock({ functionLibraries[functionName] }) != nil { return }
        final class Outcome: @unchecked Sendable { var error: Error? }
        let outcome = Outcome()
        let done = DispatchSemaphore(value: 0)
        let opts = MTLCompileOptions()
        opts.fastMathEnabled = true
        device.makeLibrary(source: msl, options: opts) { [weak self] library, error in
            if let library, library.makeFunction(name: functionName) != nil {
                self?.lock.withLock { self?.functionLibraries[functionName] = library }
            } else {
                outcome.error = error ?? FlairRendererError.shaderFunctionNotFound(functionName)
            }
            done.signal()
        }
        if done.wait(timeout: .now() + .milliseconds(max(0, Int(timeoutMs)))) == .timedOut {
            throw FlairRendererError.compileTimedOut(functionName, timeoutMs)
        }
        if let error = outcome.error { throw error }
    }

    /// Renders `effect` into `targetTexture`.
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

    /// Renders a type-erased `AnyFlairEffect` into `targetTexture`.
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

    /// Renders `effect` offscreen and returns an upright `CGImage`.
    public func renderCGImage<E: FlairEffect>(
        effect: E,
        width: Int = 320,
        height: Int = 180,
        time: Float = 0,
        state: FlairFrameState? = nil
    ) throws -> CGImage {
        try renderCGImage(anyEffect: AnyFlairEffect(effect), width: width, height: height, time: time, state: state)
    }

    /// Renders a type-erased `AnyFlairEffect` offscreen and returns an upright `CGImage`.
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

    /// Renders a type-erased `AnyFlairEffect` offscreen and returns upright RGBA8 pixel bytes (`width * height * 4`).
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

    /// Reads an `.rgba8Unorm` or `.bgra8Unorm` `MTLTexture` into a `CGImage`.
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
                key = "path:\(frameWidth)x\(frameHeight):\(fit.rawValue):\(margin):\(d)"
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
            let key = "sample:\(sample.rawValue):\(mipmapped)"
            if let cached = cachedTexture(forKey: key) { return cached }
            let rgba = FlairSampleRasterizer.rasterize(sample: sample, width: 512, height: 288)
            let tex = makeRGBA8Texture(pixels: rgba, width: 512, height: 288, mipmapped: mipmapped, commandBuffer: commandBuffer)
            storeCachedTexture(tex, forKey: key)
            return tex
        case .text(let text, let font, let weight, let width, let height):
            let key = "text:\(width)x\(height):\(font):\(weight):\(mipmapped):\(text)"
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
            let key = "url:\(mipmapped):\(urlString)"
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
