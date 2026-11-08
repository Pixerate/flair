#if canImport(SwiftUI) && canImport(MetalKit)
import Foundation
import Metal
import MetalKit
import SwiftUI

/// A SwiftUI view that renders any `FlairEffect` at up to 60–120 fps using `MTKView`.
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

/// A SwiftUI view that renders a multi-pass `FlairPipeline`.
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
    /// Places an animated `FlairEffect` behind this view.
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

    /// Places a transparent `FlairEffect` overlay above this view with hit-testing disabled.
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
