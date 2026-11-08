import CoreGraphics
import CoreText
import Foundation
import simd

/// Ports `src/shader/path.ts` (`pathTexture`) to Swift: parses SVG path commands or pixel
/// point arrays, fits them into the frame (`contain`, `cover`, `fill`, `none`) with Y=0 at
/// the bottom (matching `fragCoord`), and resamples them into a `256 × 2` `RGBA32Float` texture.
public enum FlairPathRasterizer {
    public static let maxPoints = 256

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
        return packSubpaths(subpaths, isSvg: true, fit: fit, margin: margin, width: Float(max(1, width)), height: Float(max(1, height)))
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
        return packSubpaths([sub], isSvg: false, fit: .none, margin: 0, width: Float(max(1, width)), height: Float(max(1, height)))
    }

    private static func packSubpaths(
        _ rawSubpaths: [Subpath],
        isSvg: Bool,
        fit: FlairPathFit,
        margin: Float,
        width: Float,
        height: Float
    ) -> [Float] {
        var out = Array<Float>(repeating: 0, count: maxPoints * 2 * 4)
        let valid = rawSubpaths.filter { $0.points.count >= 2 }
        guard !valid.isEmpty else { return out }

        var minX = Float.greatestFiniteMagnitude
        var minY = Float.greatestFiniteMagnitude
        var maxX = -Float.greatestFiniteMagnitude
        var maxY = -Float.greatestFiniteMagnitude
        for sub in valid {
            for p in sub.points {
                minX = Swift.min(minX, p.x)
                minY = Swift.min(minY, p.y)
                maxX = Swift.max(maxX, p.x)
                maxY = Swift.max(maxY, p.y)
            }
        }

        let boxW = Swift.max(maxX - minX, 1e-4)
        let boxH = Swift.max(maxY - minY, 1e-4)
        let clampedMargin = Swift.min(0.45, Swift.max(0, margin))
        let pad = clampedMargin * Swift.min(width, height)
        let availW = Swift.max(1, width - 2 * pad)
        let availH = Swift.max(1, height - 2 * pad)

        let scaleX: Float
        let scaleY: Float
        let offsetX: Float
        let offsetY: Float

        if !isSvg {
            scaleX = 1
            scaleY = 1
            offsetX = 0
            offsetY = 0
        } else {
            switch fit {
            case .contain:
                let s = Swift.min(availW / boxW, availH / boxH)
                scaleX = s
                scaleY = s
                offsetX = (width - boxW * s) * 0.5 - minX * s
                offsetY = (height - boxH * s) * 0.5 - minY * s
            case .cover:
                let s = Swift.max(availW / boxW, availH / boxH)
                scaleX = s
                scaleY = s
                offsetX = (width - boxW * s) * 0.5 - minX * s
                offsetY = (height - boxH * s) * 0.5 - minY * s
            case .fill:
                scaleX = availW / boxW
                scaleY = availH / boxH
                offsetX = pad - minX * scaleX
                offsetY = pad - minY * scaleY
            case .none:
                scaleX = 1
                scaleY = 1
                offsetX = 0
                offsetY = 0
            }
        }

        struct Segment {
            var a: SIMD2<Float>
            var b: SIMD2<Float>
            var length: Float
            var u0: Float
            var u1: Float
        }

        var segments: [Segment] = []
        var totalLength: Float = 0
        let allClosed = valid.allSatisfy { $0.closed }

        for sub in valid {
            let transformed: [SIMD2<Float>] = sub.points.map { p in
                let x = p.x * scaleX + offsetX
                let yRaw = p.y * scaleY + offsetY
                // SVG Y grows downward; shader fragCoord.y grows upward from 0 at bottom.
                let y = isSvg ? (height - yRaw) : yRaw
                return SIMD2<Float>(x, y)
            }
            for i in 0..<(transformed.count - 1) {
                let a = transformed[i]
                let b = transformed[i + 1]
                let len = simd_distance(a, b)
                if len > 1e-4 {
                    segments.append(Segment(a: a, b: b, length: len, u0: totalLength, u1: totalLength + len))
                    totalLength += len
                }
            }
        }

        guard !segments.isEmpty, totalLength > 1e-4 else { return out }

        let step = totalLength / Float(maxPoints)
        var segIndex = 0
        for i in 0..<maxPoints {
            let d0 = Float(i) * step
            let d1 = Float(i + 1) * step
            while segIndex + 1 < segments.count && segments[segIndex].u1 < d0 {
                segIndex += 1
            }
            let seg = segments[segIndex]
            let t0 = Swift.min(1, Swift.max(0, (d0 - seg.u0) / Swift.max(seg.length, 1e-5)))
            let t1 = Swift.min(1, Swift.max(0, (d1 - seg.u0) / Swift.max(seg.length, 1e-5)))
            let p0 = seg.a + (seg.b - seg.a) * t0
            let p1 = seg.a + (seg.b - seg.a) * t1
            let u0 = d0 / totalLength
            let u1 = d1 / totalLength

            // Row 0: (x0, y0, x1, y1)
            let row0Base = i * 4
            out[row0Base + 0] = p0.x
            out[row0Base + 1] = p0.y
            out[row0Base + 2] = p1.x
            out[row0Base + 3] = p1.y

            // Row 1: (u0, u1, totalLength, closed ? 1 : 0)
            let row1Base = (maxPoints + i) * 4
            out[row1Base + 0] = u0
            out[row1Base + 1] = u1
            out[row1Base + 2] = totalLength
            out[row1Base + 3] = allClosed ? 1.0 : 0.0
        }

        return out
    }

    private static func parseSvgPath(_ d: String) -> [Subpath] {
        var tokens: [String] = []
        let pattern = "([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)"
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

/// Renders centered white text on a transparent background (matching `textImage` in `@pixerate/flair`),
/// flipped upright (row 0 at the bottom) so shader `texture(uText, uv)` samples it right-side-up.
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

/// Renders procedural RGBA8 textures for `FlairSampleImage` values so every image and mask effect
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
