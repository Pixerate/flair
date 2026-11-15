import CoreGraphics
import CoreText
import Foundation
import QuartzCore

/// Draws text treatment plans (`FlairTextTreatments.plan`) with Core Animation layers: plain layers
/// for fills, outlines and carets, gradient layers for bands, and text layers for the typed word and
/// name tags. No Metal. Put `behindLayer` under the text view's text and `aboveLayer` over it (for a
/// text view that draws its own text, both can go in an overlay above it, with `behindLayer`'s
/// layers drawn first), in the text view's coordinates, y down: give a layer-backed `NSView`
/// overlay `isFlipped = true`, or use UIKit's coordinates as they are.
///
/// ```swift
/// let renderer = FlairTextTreatmentRenderer()
/// overlay.layer?.addSublayer(renderer.behindLayer)
/// overlay.layer?.addSublayer(renderer.aboveLayer)
/// let sweep = FlairTextTreatments.treatment(id: FlairTextTreatments.defaultID)!
/// let plan = FlairTextTreatments.plan(sweep, stage: .checking, time: elapsedMs,
///                                    target: FlairTreatmentTarget(lines: rects), reduceMotion: reduceMotion)
/// renderer.draw([plan], font: textView.font)
/// ```
public final class FlairTextTreatmentRenderer {
    /// The layers under the text.
    public let behindLayer = CALayer()
    /// The layers over the text.
    public let aboveLayer = CALayer()
    /// The screen's scale, for text layers (default 2).
    public var contentsScale: CGFloat = 2

    public init() {
        for layer in [behindLayer, aboveLayer] {
            layer.masksToBounds = false
            layer.actions = Self.noActions
        }
    }

    /// No implicit animations: every frame is drawn as the plan says.
    static let noActions: [String: CAAction] = ["position": NSNull(), "bounds": NSNull(), "frame": NSNull(), "opacity": NSNull(),
                                                "contents": NSNull(), "sublayers": NSNull(), "colors": NSNull(), "locations": NSNull(),
                                                "startPoint": NSNull(), "endPoint": NSNull(), "backgroundColor": NSNull(), "string": NSNull()]

    /// Replaces what it drew with `plans`, each back to front; `font` is the host text's, for typed words.
    public func draw(_ plans: [FlairTextTreatmentPlan], font: CTFont? = nil) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        behindLayer.sublayers = nil
        aboveLayer.sublayers = nil
        for plan in plans {
            for layer in plan.layers {
                (layer.z == "behind" ? behindLayer : aboveLayer).addSublayer(make(layer, font: font))
            }
        }
        CATransaction.commit()
    }

    /// Removes everything it drew.
    public func clear() { draw([]) }

    /// The width a tag's pill takes for its text.
    public static func tagWidth(_ layer: FlairTreatmentPlanLayer) -> Double {
        let size = layer.size ?? 11
        let font = CTFontCreateUIFontForLanguage(.system, size, nil) ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: layer.text ?? "", attributes: [.init(kCTFontAttributeName as String): font]))
        return Double(CTLineGetTypographicBounds(line, nil, nil, nil)) + 2 * (layer.padX ?? size * 0.6)
    }

    func make(_ layer: FlairTreatmentPlanLayer, font: CTFont?) -> CALayer {
        let out: CALayer
        switch layer.kind {
        case .text:
            let text = CATextLayer()
            let f = font ?? CTFontCreateUIFontForLanguage(.user, layer.height * 0.8, nil)!
            text.string = NSAttributedString(string: layer.text ?? "", attributes: [
                .init(kCTFontAttributeName as String): f,
                .init(kCTForegroundColorAttributeName as String): layer.color.cgColor,
            ])
            let lineHeight = Double(CTFontGetAscent(f) + CTFontGetDescent(f) + CTFontGetLeading(f))
            let width = Self.textWidth(layer.text ?? "", font: f)
            // Centred down the line, as the web draws it.
            text.frame = CGRect(x: layer.x, y: layer.y + (layer.height - lineHeight) / 2, width: width + 2, height: lineHeight)
            text.contentsScale = contentsScale
            out = text
        case .tag:
            let pill = CALayer()
            let width = Self.tagWidth(layer)
            pill.frame = CGRect(x: layer.x, y: layer.y, width: width, height: layer.height)
            pill.backgroundColor = layer.color.cgColor
            pill.cornerRadius = layer.radius
            let size = layer.size ?? 11
            let label = CATextLayer()
            let f = CTFontCreateUIFontForLanguage(.emphasizedSystem, size, nil) ?? CTFontCreateWithName("Helvetica-Bold" as CFString, size, nil)
            label.string = NSAttributedString(string: layer.text ?? "", attributes: [
                .init(kCTFontAttributeName as String): f,
                .init(kCTForegroundColorAttributeName as String): (layer.textColor ?? FlairRGBA(1, 1, 1)).cgColor,
            ])
            let lineHeight = Double(CTFontGetAscent(f) + CTFontGetDescent(f))
            label.frame = CGRect(x: layer.padX ?? size * 0.6, y: (layer.height - lineHeight) / 2, width: width, height: lineHeight)
            label.contentsScale = contentsScale
            label.actions = Self.noActions
            pill.addSublayer(label)
            out = pill
        case .path:
            // One container, so the overlapping pieces composite before its opacity, glow and blend apply.
            let group = CALayer()
            group.frame = .zero
            group.masksToBounds = false
            for seg in layer.segments ?? [] {
                let shape = CAShapeLayer()
                let path = CGMutablePath()
                path.addLines(between: seg.points)
                path.closeSubpath()
                shape.path = path
                shape.fillColor = seg.color.cgColor
                shape.actions = Self.noActions
                group.addSublayer(shape)
            }
            out = group
        case .rect:
            if let g = layer.gradient, layer.width > 0, layer.height > 0 {
                let gradient = CAGradientLayer()
                gradient.frame = layer.frame
                gradient.colors = g.stops.map(\.color.cgColor)
                gradient.locations = g.stops.map { NSNumber(value: $0.offset) }
                // The plan's gradient is in the host's coordinates; a gradient layer's is unit, in its bounds.
                gradient.startPoint = CGPoint(x: (g.x0 - layer.x) / layer.width, y: (g.y0 - layer.y) / layer.height)
                gradient.endPoint = CGPoint(x: (g.x1 - layer.x) / layer.width, y: (g.y1 - layer.y) / layer.height)
                gradient.cornerRadius = layer.radius
                out = gradient
            } else {
                let rect = CALayer()
                rect.frame = layer.frame
                rect.cornerRadius = layer.radius
                if let stroke = layer.stroke {
                    rect.borderWidth = min(stroke, layer.width / 2, layer.height / 2)
                    rect.borderColor = layer.color.cgColor
                } else {
                    rect.backgroundColor = layer.color.cgColor
                }
                out = rect
            }
        }
        out.opacity = Float(layer.opacity)
        out.actions = Self.noActions
        if let glow = layer.glow {
            out.shadowColor = FlairRGBA(layer.color.r, layer.color.g, layer.color.b).cgColor
            out.shadowOpacity = Float(layer.color.a)
            out.shadowRadius = glow / 2
            out.shadowOffset = .zero
        }
        #if os(macOS)
        switch layer.blend {
        case "multiply": out.compositingFilter = "multiplyBlendMode"
        case "screen": out.compositingFilter = "screenBlendMode"
        case "plus-lighter": out.compositingFilter = "plusL"
        default: break
        }
        #endif
        return out
    }

    static func textWidth(_ text: String, font: CTFont) -> Double {
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.init(kCTFontAttributeName as String): font]))
        return Double(CTLineGetTypographicBounds(line, nil, nil, nil))
    }
}
