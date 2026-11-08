import Foundation
import simd

/// Tracks pointer position, velocity, hover/down envelopes, click ripples (`iClicks[8]`),
/// and pointer trail (`iTrail[32]`), matching `src/shader/pointer.ts`.
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

    /// Records a pointer move in shader pixel coordinates (`y = 0` at bottom).
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

    /// Records a pointer press at `(x, y)` in shader pixel coordinates (`y = 0` at bottom).
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

    /// Advances smoothed pointer state and writes `mouse`, `pointer`, `clicks`, and `trail` into `state`.
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

/// Real-time and offline audio analyzer computing `iAudio` (level, bass, mid, treble),
/// `iSpectrum[16]` (64 logarithmic bins), and `iBeat` (seconds since last beat), matching `src/shader/audio.ts`.
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

    /// Analyzes a mono PCM sample window (e.g. 512 or 1024 samples) at `time`.
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

/// Tracks scroll progress, page offset, smoothed velocity, and scrolling envelope (`iScroll`),
/// matching `src/shader/scroll.ts`.
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
