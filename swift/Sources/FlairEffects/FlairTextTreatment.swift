import CoreGraphics
import Foundation

/*
 * Text treatments: the look of edits to a range of text (an agent checking a sentence, selecting a
 * word, typing over it, the change landing, and its caret). A treatment's stages are data, written
 * by `pnpm swift:meta` from `@pixerate/flair`'s catalog into `Resources/flair-text-treatments.json`,
 * and `FlairTextTreatments.plan` turns a stage at a moment into a layer plan with the same
 * arithmetic as the TypeScript `textTreatmentPlan`, so the web and Apple platforms draw the same
 * rectangles, colours and opacities. `FlairTextTreatmentRenderer` draws a plan with Core Animation
 * layers. Coordinates are the host's, y down (a flipped `NSView`, or UIKit).
 */

// MARK: - JSON

/// A JSON value, as treatments and their values are written.
public indirect enum FlairJSON: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([FlairJSON])
    case object([String: FlairJSON])

    /// A value from `JSONSerialization`'s output.
    public init(any: Any?) {
        switch any {
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { self = .bool(n.boolValue) } else { self = .number(n.doubleValue) }
        case let s as String: self = .string(s)
        case let a as [Any]: self = .array(a.map { FlairJSON(any: $0) })
        case let o as [String: Any]: self = .object(o.mapValues { FlairJSON(any: $0) })
        default: self = .null
        }
    }

    /// Parses JSON data.
    public static func parse(_ data: Data) throws -> FlairJSON {
        FlairJSON(any: try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]))
    }

    public subscript(key: String) -> FlairJSON? {
        if case .object(let o) = self { return o[key] }
        return nil
    }

    public var number: Double? {
        if case .number(let d) = self, d.isFinite { return d }
        return nil
    }

    public var string: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var array: [FlairJSON]? {
        if case .array(let a) = self { return a }
        return nil
    }

    public var object: [String: FlairJSON]? {
        if case .object(let o) = self { return o }
        return nil
    }
}

// MARK: - The host's side

/// A stage of a text treatment: what an agent is doing to the range it draws over.
public enum FlairTextTreatmentStage: String, CaseIterable, Sendable {
    /// The agent's insertion point, with its name tag (loops until stopped).
    case caret
    /// A sweep across the word or line being looked at.
    case checking
    /// The selection appearing over what will be replaced.
    case selecting
    /// The word being typed, drawn over the one it replaces, with the caret at its end.
    case typing
    /// What changed, tinted, then fading.
    case landed
}

/// A colour's channels and alpha, 0 to 1.
public struct FlairRGBA: Equatable, Sendable {
    public var r: Double, g: Double, b: Double, a: Double
    public init(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) {
        self.r = r; self.g = g; self.b = b; self.a = a
    }

    /// `#rrggbb`, or nil.
    public init?(hex: String) {
        let text = hex.trimmingCharacters(in: .whitespaces)
        guard text.hasPrefix("#"), text.count == 7, let v = UInt32(text.dropFirst(), radix: 16) else { return nil }
        self.init(Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)
    }

    public var cgColor: CGColor { CGColor(srgbRed: r, green: g, blue: b, alpha: a) }
}

/// An insertion point: its x, the top of its line and the line's height.
public struct FlairTreatmentCaret: Equatable, Sendable {
    public var x: Double, y: Double, height: Double
    public init(x: Double, y: Double, height: Double) {
        self.x = x; self.y = y; self.height = height
    }
}

/// What a treatment draws over: the range's line rectangles in reading order, the caret, and for
/// some layers what has been typed, a name tag and the text's colours.
public struct FlairTreatmentTarget: Equatable, Sendable {
    public var lines: [CGRect]
    public var caret: FlairTreatmentCaret?
    /// `typing`: what has been typed so far.
    public var text: String?
    /// A name tag for the caret (an agent's name).
    public var label: String?
    /// The text's colour, for `"text"` colours.
    public var color: FlairRGBA?
    /// The colour behind the text, for `"background"` colours (a `cover` is left out without it).
    public var background: FlairRGBA?

    public init(lines: [CGRect] = [], caret: FlairTreatmentCaret? = nil, text: String? = nil, label: String? = nil,
                color: FlairRGBA? = nil, background: FlairRGBA? = nil) {
        self.lines = lines; self.caret = caret; self.text = text; self.label = label
        self.color = color; self.background = background
    }
}

// MARK: - The plan

/// A linear gradient in the host's coordinates, padded with its end colours past its ends.
public struct FlairTreatmentGradient: Equatable, Sendable {
    public var x0: Double, y0: Double, x1: Double, y1: Double
    public var stops: [(offset: Double, color: FlairRGBA)]

    public init(x0: Double, y0: Double, x1: Double, y1: Double, stops: [(offset: Double, color: FlairRGBA)]) {
        self.x0 = x0; self.y0 = y0; self.x1 = x1; self.y1 = y1; self.stops = stops
    }

    public static func == (a: Self, b: Self) -> Bool {
        a.x0 == b.x0 && a.y0 == b.y0 && a.x1 == b.x1 && a.y1 == b.y1
            && a.stops.count == b.stops.count && zip(a.stops, b.stops).allSatisfy { $0.offset == $1.offset && $0.color == $1.color }
    }
}

/// One thing to draw (see the TypeScript `TreatmentPlanLayer`): a `rect` filled (or outlined
/// `stroke` px wide), a `text` in the host's font, or a `tag` pill whose width the renderer measures.
public struct FlairTreatmentPlanLayer: Equatable, Sendable {
    public enum Kind: String, Sendable { case rect, text, tag, path }
    public var kind: Kind
    /// The layer type it came from: fill, band, caret, tag, cover, ghost or handles.
    public var source: String
    /// Under the text (`behind`) or over it (`above`).
    public var z: String
    public var x: Double, y: Double, width: Double, height: Double
    public var radius: Double
    public var opacity: Double
    public var color: FlairRGBA
    public var gradient: FlairTreatmentGradient?
    public var stroke: Double?
    public var glow: Double?
    /// normal, multiply, screen or plus-lighter.
    public var blend: String
    public var text: String?
    public var size: Double?
    public var padX: Double?
    public var textColor: FlairRGBA?
    /// `path`: the ribbon's pieces, each a polygon in one colour, drawn as one group at `opacity`.
    public var segments: [FlairTreatmentSegment]?

    public init(kind: Kind, source: String, z: String, x: Double, y: Double, width: Double, height: Double, radius: Double, opacity: Double,
                color: FlairRGBA, gradient: FlairTreatmentGradient? = nil, stroke: Double? = nil, glow: Double? = nil, blend: String = "normal",
                text: String? = nil, size: Double? = nil, padX: Double? = nil, textColor: FlairRGBA? = nil, segments: [FlairTreatmentSegment]? = nil) {
        self.kind = kind; self.source = source; self.z = z; self.x = x; self.y = y; self.width = width; self.height = height
        self.radius = radius; self.opacity = opacity; self.color = color; self.gradient = gradient; self.stroke = stroke; self.glow = glow
        self.blend = blend; self.text = text; self.size = size; self.padX = padX; self.textColor = textColor; self.segments = segments
    }

    public var frame: CGRect { CGRect(x: x, y: y, width: width, height: height) }
}

/// A piece of a ribbon: a polygon filled in one colour.
public struct FlairTreatmentSegment: Equatable, Sendable {
    public var points: [CGPoint]
    public var color: FlairRGBA
    public init(points: [CGPoint], color: FlairRGBA) {
        self.points = points; self.color = color
    }
}

/// A stage at a moment, ready to draw.
public struct FlairTextTreatmentPlan: Equatable, Sendable {
    public var stage: FlairTextTreatmentStage
    public var time: Double
    /// Ms the stage takes for this target (a looping stage's one pass).
    public var duration: Double
    /// Whether it has finished (never, for a looping stage): remove it then.
    public var done: Bool
    public var reduced: Bool
    /// Back to front.
    public var layers: [FlairTreatmentPlanLayer]

    public init(stage: FlairTextTreatmentStage, time: Double, duration: Double, done: Bool, reduced: Bool, layers: [FlairTreatmentPlanLayer]) {
        self.stage = stage; self.time = time; self.duration = duration; self.done = done; self.reduced = reduced; self.layers = layers
    }
}

// MARK: - Treatments

/// A control of a treatment.
public struct FlairTreatmentControl: Sendable {
    public let name: String
    public let type: String
    public let label: String
    public let color: Bool
    public let defaultValue: FlairJSON
    public let min: Double?
    public let max: Double?
}

/// One of the catalog's text treatments, as `@pixerate/flair` describes it.
public struct FlairTextTreatment: Sendable {
    public let id: String
    public let name: String
    public let description: String
    public let tags: [String]
    public let controls: [FlairTreatmentControl]
    public let presets: [(name: String, values: [String: FlairJSON])]
    /// The stages as data, with `"{{control}}"` placeholders.
    public let stages: FlairJSON

    public var presetNames: [String] { presets.map(\.name) }

    init?(json: FlairJSON) {
        guard let id = json["id"]?.string, let name = json["name"]?.string, let stages = json["stages"], stages.object != nil else { return nil }
        self.id = id
        self.name = name
        description = json["description"]?.string ?? ""
        tags = json["tags"]?.array?.compactMap(\.string) ?? []
        controls = (json["controls"]?.array ?? []).compactMap { c in
            guard let name = c["name"]?.string, let type = c["type"]?.string, let value = c["default"] else { return nil }
            return FlairTreatmentControl(name: name, type: type, label: c["label"]?.string ?? name, color: c["color"] == .bool(true),
                                         defaultValue: value, min: c["min"]?.number, max: c["max"]?.number)
        }
        presets = (json["presets"]?.array ?? []).compactMap { p in
            guard let name = p["name"]?.string, let values = p["values"]?.object else { return nil }
            return (name, values)
        }
        self.stages = stages
    }

    /// Its values: each control's default, then a preset's, then `values` (numbers, bools, colours as
    /// `#rrggbb` or `[r, g, b]` channels 0 to 1). Unknown controls and values of the wrong type are left out.
    public func values(preset: String? = nil, values given: [String: FlairJSON] = [:]) -> [String: FlairJSON] {
        var out: [String: FlairJSON] = [:]
        let fromPreset = preset.flatMap { name in presets.first { $0.name == name }?.values } ?? [:]
        for control in controls {
            out[control.name] = control.defaultValue
            for source in [fromPreset, given] {
                guard let v = source[control.name] else { continue }
                switch (control.type, v) {
                case ("bool", .bool): out[control.name] = v
                case ("float", .number), ("int", .number): out[control.name] = v
                case ("vec3", .array(let a)) where control.color && a.count >= 3 && a.allSatisfy({ $0.number != nil }): out[control.name] = v
                case ("vec3", .string(let s)) where control.color:
                    if let c = FlairRGBA(hex: s) { out[control.name] = .array([.number(c.r), .number(c.g), .number(c.b)]) }
                default: break
                }
            }
        }
        return out
    }
}

/// The catalog's text treatments, and the planner.
public enum FlairTextTreatments {
    /// The treatment hosts use when nobody has chosen one: the writing partner's soft sweep.
    public static let defaultID = "soft-sweep"

    /// Every text treatment, the default first.
    public static let all: [FlairTextTreatment] = {
        guard let url = Bundle.module.url(forResource: "flair-text-treatments", withExtension: "json"),
              let data = try? Data(contentsOf: url), let json = try? FlairJSON.parse(data) else { return [] }
        return (json["treatments"]?.array ?? []).compactMap(FlairTextTreatment.init(json:))
    }()

    /// A treatment by id, or nil.
    public static func treatment(id: String) -> FlairTextTreatment? {
        all.first { $0.id == id }
    }

    /// How each stage moves under Reduce Motion when the treatment does not say.
    static let defaultReduced: [FlairTextTreatmentStage: (at: Double, fade: String)] = [
        .caret: (0, "none"), .checking: (0.5, "in-out"), .selecting: (1, "in"), .typing: (1, "none"), .landed: (0, "out"),
    ]

    /// Whether the system asks for reduced motion.
    @MainActor public static var systemReduceMotion: Bool {
        #if os(macOS)
        return NSWorkspaceReduceMotion.value
        #else
        return UIAccessibilityReduceMotion.value
        #endif
    }

    // MARK: Easing (the same arithmetic as TypeScript's `cubicBezier`)

    /// A cubic Bézier timing function at `x` (0 to 1): Newton's method, then bisection if it stalls.
    public static func cubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ x: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        let cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
        let cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
        func sampleX(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
        func slopeX(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }
        func sampleY(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
        var t = x
        for _ in 0..<8 {
            let err = sampleX(t) - x
            if abs(err) < 1e-7 { return sampleY(t) }
            let d = slopeX(t)
            if abs(d) < 1e-6 { break }
            t -= err / d
        }
        var lo = 0.0, hi = 1.0
        t = x
        for _ in 0..<40 {
            let v = sampleX(t)
            if abs(v - x) < 1e-7 { break }
            if v < x { lo = t } else { hi = t }
            t = (lo + hi) / 2
        }
        return sampleY(t)
    }

    /// An easing (a name or `[x1, y1, x2, y2]`) at `x`.
    public static func ease(_ e: FlairJSON?, _ x: Double) -> Double {
        let points: [Double]
        switch e {
        case .string("ease"): points = [0.25, 0.1, 0.25, 1]
        case .string("ease-in"): points = [0.42, 0, 1, 1]
        case .string("ease-out"): points = [0, 0, 0.58, 1]
        case .string("ease-in-out"): points = [0.42, 0, 0.58, 1]
        case .array(let a) where a.count == 4 && a.allSatisfy({ $0.number != nil }): points = a.map { $0.number! }
        default: return min(1, max(0, x))
        }
        return cubicBezier(points[0], points[1], points[2], points[3], x)
    }

    // MARK: Resolution

    static let agentColoured: Set<String> = ["fill", "band", "caret", "tag", "handles", "ribbon", "sparkles"]

    /// A control value as the stages read it: colours as `#rrggbb` (rounded as TypeScript's `rgbToHex`).
    static func written(_ control: FlairTreatmentControl, _ value: FlairJSON) -> FlairJSON {
        guard control.color, case .array(let a) = value else {
            if case .array(let a) = value { return a.first ?? .number(0) }
            return value
        }
        let hex = a.prefix(3).map { v -> String in
            let c = Int((min(1, max(0, v.number ?? 0)) * 255).rounded(.toNearestOrAwayFromZero))
            return String(format: "%02x", c)
        }.joined()
        return .string("#" + hex)
    }

    /// The control a value names, if it is a placeholder `"{{name}}"`.
    static func placeholder(_ v: FlairJSON) -> String? {
        guard case .string(let s) = v else { return nil }
        let t = s.trimmingCharacters(in: .whitespaces)
        guard t.hasPrefix("{{"), t.hasSuffix("}}") else { return nil }
        let name = t.dropFirst(2).dropLast(2).trimmingCharacters(in: .whitespaces)
        guard let first = name.unicodeScalars.first, CharacterSet.letters.union(["_"]).contains(first),
              name.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.union(["_"]).contains($0) }) else { return nil }
        return name
    }

    /// A treatment's stages with each layer's colour filled in where it is left out and every
    /// `"{{name}}"` replaced by its control's value: what TypeScript's `resolveTextTreatment` gives.
    public static func resolve(_ treatment: FlairTextTreatment, values: [String: FlairJSON]) -> FlairJSON {
        let controls = Dictionary(treatment.controls.map { ($0.name, $0) }, uniquingKeysWith: { a, _ in a })
        func walk(_ v: FlairJSON) -> FlairJSON {
            if let name = placeholder(v) {
                guard let control = controls[name] else { return v }
                return written(control, values[name] ?? control.defaultValue)
            }
            switch v {
            case .array(let a): return .array(a.map(walk))
            case .object(let o): return .object(o.mapValues(walk))
            default: return v
            }
        }
        guard case .object(var stages) = treatment.stages else { return treatment.stages }
        for (name, stage) in stages {
            guard case .object(var s) = stage, case .array(let layers) = s["layers"] ?? .null else { continue }
            s["layers"] = .array(layers.map { layer in
                guard case .object(var l) = layer, l["color"] == nil, let type = l["type"]?.string else { return layer }
                l["color"] = .string(agentColoured.contains(type) ? "{{color}}" : type == "cover" ? "background" : type == "ghost" ? "text" : "#000000")
                return .object(l)
            })
            stages[name] = .object(s)
        }
        return walk(.object(stages))
    }

    // MARK: Planning

    static func clamp01(_ x: Double) -> Double { min(1, max(0, x)) }
    static func n(_ v: FlairJSON?, _ fallback: Double) -> Double { v?.number ?? fallback }

    /// A resolved value at progress `p`: a number, or a track eased between its keys.
    static func valueAt(_ v: FlairJSON?, _ p: Double, _ fallback: Double) -> Double {
        guard let v else { return fallback }
        if case .number = v { return v.number ?? fallback }
        guard let keys = v["keys"]?.array, !keys.isEmpty else { return fallback }
        func key(_ k: FlairJSON) -> (Double, FlairJSON?) { (k.array?.first?.number ?? 0, k.array.flatMap { $0.count > 1 ? $0[1] : nil }) }
        let first = key(keys[0])
        if p <= first.0 { return n(first.1, fallback) }
        for i in 1..<keys.count {
            let a = key(keys[i - 1]), b = key(keys[i])
            if p <= b.0 {
                let span = b.0 - a.0
                let u = span <= 0 ? 1 : (p - a.0) / span
                let va = n(a.1, fallback), vb = n(b.1, fallback)
                return va + (vb - va) * ease(v["ease"], u)
            }
        }
        return n(key(keys[keys.count - 1]).1, fallback)
    }

    static func colourOf(_ v: FlairJSON?, _ target: FlairTreatmentTarget) -> FlairRGBA? {
        switch v {
        case .string("text"): return target.color ?? FlairRGBA(0, 0, 0, 1)
        case .string("background"): return target.background
        case .string(let s): return FlairRGBA(hex: s)
        default: return nil
        }
    }

    static func stageLength(_ spec: FlairJSON, _ lines: [CGRect]) -> Double {
        let duration = max(0, n(spec["duration"], 0))
        let perPixel = max(0, n(spec["perPixel"], 0))
        if (spec["flow"]?.string ?? "sequence") == "each", !lines.isEmpty {
            let stagger = max(0, n(spec["stagger"], 0))
            return lines.enumerated().map { Double($0.offset) * stagger + duration + perPixel * Double($0.element.width) }.max()!
        }
        return duration + perPixel * lines.reduce(0) { $0 + Double($1.width) }
    }

    static func lineBox(_ line: CGRect, _ layer: FlairJSON) -> (x: Double, y: Double, width: Double, height: Double) {
        let padX = n(layer["padX"], 0), padY = n(layer["padY"], 0), top = n(layer["top"], 0), height = n(layer["height"], 1)
        let (lx, ly, lw, lh) = (Double(line.minX), Double(line.minY), Double(line.width), Double(line.height))
        return (lx - padX, ly + top * lh - padY, lw + 2 * padX, height * lh + 2 * padY)
    }

    static func radiusFor(_ r: Double, _ w: Double, _ h: Double) -> Double { max(0, min(r, w / 2, h / 2)) }

    static func stops(_ v: FlairJSON?, _ color: FlairRGBA, fallback: [(Double, Double)]?) -> [(offset: Double, color: FlairRGBA)]? {
        let pairs: [(Double, Double)]
        if let a = v?.array {
            pairs = a.map { s in (n(s.array?.first, 0), n(s.array.flatMap { $0.count > 1 ? $0[1] : nil }, 1)) }
        } else if let fallback {
            pairs = fallback
        } else {
            return nil
        }
        return pairs.map { (offset: $0.0, color: FlairRGBA(color.r, color.g, color.b, color.a * clamp01($0.1))) }
    }

    static func planLayers(_ spec: FlairJSON, _ target: FlairTreatmentTarget, progress: (Int) -> Double, fade: Double, sequence: Bool) -> [FlairTreatmentPlanLayer] {
        var out: [FlairTreatmentPlanLayer] = []
        let lines = target.lines.filter { $0.width > 0 && $0.height > 0 }
        for layer in spec["layers"]?.array ?? [] {
            guard let type = layer["type"]?.string else { continue }
            if let cond = layer["if"], cond != .bool(true) { continue }
            if layer["unless"] == .bool(true) { continue }
            let defaultColour: FlairJSON = .string(type == "cover" ? "background" : type == "ghost" ? "text" : "#000000")
            guard let colour = colourOf(layer["color"] ?? defaultColour, target) else { continue }
            let alpha = clamp01(n(layer["alpha"], 1))
            let color = FlairRGBA(colour.r, colour.g, colour.b, colour.a * alpha)
            let z = layer["z"]?.string ?? ((type == "fill" || type == "band") ? "behind" : "above")
            let blend = layer["blend"]?.string ?? "normal"
            let glow = n(layer["glow"], 0)
            func make(_ kind: FlairTreatmentPlanLayer.Kind, _ x: Double, _ y: Double, _ w: Double, _ h: Double, radius: Double, p: Double) -> FlairTreatmentPlanLayer {
                FlairTreatmentPlanLayer(kind: kind, source: type, z: z, x: x, y: y, width: w, height: h, radius: radius,
                                        opacity: clamp01(valueAt(layer["opacity"], p, 1)) * fade, color: color, gradient: nil,
                                        stroke: nil, glow: glow > 0 ? glow : nil, blend: blend, text: nil, size: nil, padX: nil, textColor: nil, segments: nil)
            }
            func push(_ l: FlairTreatmentPlanLayer) {
                if l.opacity > 0 && l.color.a > 0 { out.append(l) }
            }

            if type == "fill" || type == "band" || type == "cover" {
                let boxes = lines.map { lineBox($0, layer) }
                var offsets: [Double] = []
                var span = 0.0
                for b in boxes {
                    offsets.append(sequence ? span : 0)
                    span += b.width
                }
                for (i, box) in boxes.enumerated() {
                    let p = progress(sequence ? -1 : i)
                    let length = sequence ? span : box.width
                    let o = offsets[i]
                    let radius = n(layer["radius"], 0)
                    if type == "band" {
                        let bw = max(0, n(layer["width"], 0.4) * length + n(layer["widthPx"], 0))
                        let pos = valueAt(layer["position"], p, 0)
                        let start = pos * (length + bw) - bw
                        let from = max(start, o)
                        let to = min(start + bw, o + box.width)
                        if to - from <= 0.01 || bw <= 0 { continue }
                        let x0 = box.x + start - o
                        let midY = box.y + box.height / 2
                        let x = box.x + from - o
                        let width = to - from
                        var l = make(.rect, x, box.y, width, box.height, radius: radiusFor(radius, width, box.height), p: p)
                        l.gradient = FlairTreatmentGradient(x0: x0, y0: midY, x1: x0 + bw, y1: midY, stops: stops(layer["stops"], color, fallback: [(0, 0), (0.5, 1), (1, 0)])!)
                        push(l)
                        continue
                    }
                    let reveal = type == "fill" ? clamp01(valueAt(layer["reveal"], p, 1)) : 1
                    let erase = type == "fill" ? clamp01(valueAt(layer["erase"], p, 0)) : 0
                    let from = max(erase * length, o)
                    let to = min(reveal * length, o + box.width)
                    if to - from <= 0.01 { continue }
                    let x = box.x + from - o
                    let width = to - from
                    var l = make(.rect, x, box.y, width, box.height, radius: radiusFor(radius, width, box.height), p: p)
                    let stroke = type == "fill" ? n(layer["stroke"], 0) : 0
                    if stroke > 0 { l.stroke = stroke }
                    if type == "fill", let s = stops(layer["stops"], color, fallback: nil) {
                        let midY = box.y + box.height / 2
                        l.gradient = FlairTreatmentGradient(x0: box.x, y0: midY, x1: box.x + box.width, y1: midY, stops: s)
                    }
                    push(l)
                }
                continue
            }

            let p = progress(-1)
            if type == "ribbon" || type == "sparkles" {
                guard let frame = curveFrame(layer, target, lines) else { continue }
                let samples = sampleCurve(layer["points"], frame)
                let total = samples.last?.s ?? 0
                if total <= 0 { continue }
                let reveal = clamp01(valueAt(layer["reveal"], p, 1))
                let erase = clamp01(valueAt(layer["erase"], p, 0))
                if reveal - erase <= 0.001 { continue }
                let h = frame.uy
                if type == "ribbon" {
                    let from = erase * total, to = reveal * total
                    let part = [pointAt(samples, from)] + samples.filter { $0.s > from && $0.s < to } + [pointAt(samples, to)]
                    let head = max(0, n(layer["width"], 0.3)) * h
                    let taper = clamp01(n(layer["taper"], 0.1))
                    let edges = part.enumerated().map { i, q -> (l: CGPoint, r: CGPoint, s: Double) in
                        let a = part[max(0, i - 1)], b = part[min(part.count - 1, i + 1)]
                        var len = hypot(b.x - a.x, b.y - a.y)
                        if len == 0 { len = 1 }
                        let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len
                        let half = head * (taper + (1 - taper) * (q.s / total)) / 2
                        return (CGPoint(x: q.x + nx * half, y: q.y + ny * half), CGPoint(x: q.x - nx * half, y: q.y - ny * half), q.s)
                    }
                    // Pieces in a `behind` stretch go under the text, the rest over it, so the ribbon weaves through the words.
                    var groups: [(z: String, segments: [FlairTreatmentSegment], xs: [Double], ys: [Double])] = []
                    if edges.count > 1 {
                        for i in 0..<(edges.count - 1) {
                            let j = min(i + 2, edges.count - 1)
                            let mid = (edges[i].s + edges[i + 1].s) / 2 / total
                            let pz = isBehind(layer["behind"], mid) ? "behind" : z
                            if groups.last?.z != pz { groups.append((pz, [], [], [])) }
                            let corners = [edges[i].l, edges[j].l, edges[j].r, edges[i].r]
                            groups[groups.count - 1].segments.append(FlairTreatmentSegment(points: corners,
                                                                                           color: stopColour(layer["colorStops"], mid, FlairRGBA(color.r, color.g, color.b, 1), target)))
                            groups[groups.count - 1].xs += corners.map { Double($0.x) }
                            groups[groups.count - 1].ys += corners.map { Double($0.y) }
                        }
                    }
                    for group in groups {
                        let left = group.xs.min()!, top = group.ys.min()!
                        var l = make(.path, left, top, group.xs.max()! - left, group.ys.max()! - top, radius: 0, p: p)
                        l.z = group.z
                        l.opacity *= color.a
                        l.color = FlairRGBA(color.r, color.g, color.b, 1)
                        l.segments = group.segments
                        push(l)
                    }
                } else {
                    let count = max(0, min(200, Int((n(layer["count"], 12) + 0.5).rounded(.down))))
                    let spread = n(layer["spread"], 0.4) * h
                    let drift = n(layer["drift"], 0.3) * h
                    let size = max(0, n(layer["size"], 0.12)) * h
                    let seed = Int((n(layer["seed"], 0) + 0.5).rounded(.down)) * 1000
                    for i in 0..<count {
                        let k = seed + i * 5
                        let u = hash(k)
                        if u < erase || u > reveal { continue }
                        let q = pointAt(samples, u * total)
                        let a = pointAt(samples, max(0, u * total - 1)), b = pointAt(samples, min(total, u * total + 1))
                        var len = hypot(b.x - a.x, b.y - a.y)
                        if len == 0 { len = 1 }
                        let off = (hash(k + 1) - 0.5) * 2 * spread
                        let d = size * (0.35 + 0.65 * hash(k + 2))
                        let since = p
                        let cx = q.x - ((b.y - a.y) / len) * off
                        let cy = q.y + ((b.x - a.x) / len) * off + drift * since * (0.5 + hash(k + 3))
                        let twinkle = 1 - 0.6 * since * hash(k + 4)
                        var l = make(.rect, cx - d / 2, cy - d / 2, d, d, radius: d / 2, p: p)
                        l.opacity *= twinkle
                        if isBehind(layer["behind"], u) { l.z = "behind" }
                        push(l)
                    }
                }
                continue
            }
            if type == "caret" || type == "tag" {
                guard let caret = target.caret, caret.height > 0 else { continue }
                if type == "caret" {
                    let width = max(0, n(layer["width"], 2))
                    let height = n(layer["height"], 1) * caret.height
                    let y = caret.y + n(layer["top"], 0) * caret.height
                    push(make(.rect, caret.x - width / 2, y, width, height, radius: radiusFor(n(layer["radius"], 0), width, height), p: p))
                } else {
                    guard let label = target.label, !label.isEmpty else { continue }
                    let size = max(1, n(layer["size"], 11))
                    let height = size * 1.6
                    var l = make(.tag, caret.x - 1, caret.y - n(layer["gap"], 2) - height, 0, height, radius: max(0, n(layer["radius"], 4)), p: p)
                    l.text = label
                    l.size = size
                    l.padX = size * 0.6
                    l.textColor = colourOf(layer["textColor"] ?? .string("#ffffff"), target) ?? FlairRGBA(1, 1, 1, 1)
                    push(l)
                }
                continue
            }
            if type == "ghost" {
                guard let first = lines.first, let text = target.text, !text.isEmpty else { continue }
                var l = make(.text, Double(first.minX), Double(first.minY), Double(first.width), Double(first.height), radius: 0, p: p)
                l.text = text
                push(l)
                continue
            }
            if type == "handles" {
                guard !lines.isEmpty else { continue }
                let boxes = lines.map { lineBox($0, layer) }
                let left = boxes.map(\.x).min()!, top = boxes.map(\.y).min()!
                let right = boxes.map { $0.x + $0.width }.max()!, bottom = boxes.map { $0.y + $0.height }.max()!
                let size = max(0, n(layer["width"], 6))
                for (cx, cy) in [(left, top), (right, top), (left, bottom), (right, bottom)] {
                    push(make(.rect, cx - size / 2, cy - size / 2, size, size, radius: radiusFor(n(layer["radius"], 0), size, size), p: p))
                }
            }
        }
        return out
    }

    /// Whether `u` (0 to 1 along a curve) falls in one of a layer's `behind` stretches.
    static func isBehind(_ behind: FlairJSON?, _ u: Double) -> Bool {
        guard let ranges = behind?.array else { return false }
        return ranges.contains { r in
            guard let a = r.array, a.count == 2 else { return false }
            return u >= n(a[0], 2) && u < n(a[1], -1)
        }
    }

    static let curveSteps = 16

    /// A curve layer's frame: the caret in caret heights, or (`anchor: "range"`) the range's last line, x across its width and y down its height.
    static func curveFrame(_ layer: FlairJSON, _ target: FlairTreatmentTarget, _ lines: [CGRect]) -> (x: Double, y: Double, ux: Double, uy: Double)? {
        if layer["anchor"]?.string == "range" {
            guard let last = lines.last else { return nil }
            return (Double(last.minX), Double(last.minY), Double(last.width), Double(last.height))
        }
        guard let caret = target.caret, caret.height > 0 else { return nil }
        return (caret.x, caret.y, caret.height, caret.height)
    }

    /// A curve's points sampled in the host's px (from `frame`), with the arc length to each.
    static func sampleCurve(_ points: FlairJSON?, _ frame: (x: Double, y: Double, ux: Double, uy: Double)) -> [(x: Double, y: Double, s: Double)] {
        guard let pts = points?.array, pts.count >= 4 else { return [] }
        func pt(_ i: Int) -> (Double, Double) {
            let q = pts[i].array
            return (frame.x + n(q?.first, 0) * frame.ux, frame.y + n(q.flatMap { $0.count > 1 ? $0[1] : nil }, 0) * frame.uy)
        }
        let (x0, y0) = pt(0)
        var out: [(x: Double, y: Double, s: Double)] = [(x0, y0, 0)]
        var k = 0
        while k + 3 < pts.count {
            let (ax, ay) = pt(k), (bx, by) = pt(k + 1), (cx, cy) = pt(k + 2), (dx, dy) = pt(k + 3)
            for j in 1...curveSteps {
                let t = Double(j) / Double(curveSteps), u = 1 - t
                let x = u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx
                let y = u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy
                let last = out[out.count - 1]
                out.append((x, y, last.s + hypot(x - last.x, y - last.y)))
            }
            k += 3
        }
        return out
    }

    static func pointAt(_ samples: [(x: Double, y: Double, s: Double)], _ at: Double) -> (x: Double, y: Double, s: Double) {
        for i in 1..<samples.count {
            let a = samples[i - 1], b = samples[i]
            if at <= b.s {
                let f = b.s - a.s <= 0 ? 0 : (at - a.s) / (b.s - a.s)
                return (a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, at)
            }
        }
        return samples[samples.count - 1]
    }

    static func stopColour(_ stops: FlairJSON?, _ u: Double, _ fallback: FlairRGBA, _ target: FlairTreatmentTarget) -> FlairRGBA {
        guard let list = stops?.array, !list.isEmpty else { return fallback }
        let parsed: [(at: Double, c: FlairRGBA)] = list.compactMap { st in
            guard let a = st.array, a.count >= 2, let c = colourOf(a[1], target) else { return nil }
            return (n(a[0], 0), FlairRGBA(c.r, c.g, c.b, c.a * clamp01(n(a.count > 2 ? a[2] : nil, 1))))
        }
        guard let first = parsed.first else { return fallback }
        if u <= first.at { return first.c }
        for i in 1..<parsed.count {
            let a = parsed[i - 1], b = parsed[i]
            if u <= b.at {
                let f = b.at - a.at <= 0 ? 1 : (u - a.at) / (b.at - a.at)
                return FlairRGBA(a.c.r + (b.c.r - a.c.r) * f, a.c.g + (b.c.g - a.c.g) * f, a.c.b + (b.c.b - a.c.b) * f, a.c.a + (b.c.a - a.c.a) * f)
            }
        }
        return parsed[parsed.count - 1].c
    }

    /// A number from 0 to 1 for `i`: the same integer hash as TypeScript's `treatmentHash`.
    public static func hash(_ i: Int) -> Double {
        var h = UInt32(truncatingIfNeeded: i + 1) &* 0x9E37_79B1
        h ^= h >> 16
        h = h &* 0x85EB_CA6B
        h ^= h >> 13
        h = h &* 0xC2B2_AE35
        h ^= h >> 16
        return Double(h) / 4_294_967_296
    }

    static func fadeAt(_ fade: String, _ u: Double) -> Double {
        let x = clamp01(u)
        switch fade {
        case "in": return x
        case "out": return 1 - x
        case "in-out": return clamp01(min(x / 0.3, (1 - x) / 0.3))
        default: return 1
        }
    }

    /// A stage of resolved stages (see `resolve`) at `time` ms into it, over `target`.
    public static func planResolved(_ stages: FlairJSON, stage: FlairTextTreatmentStage, time: Double, target: FlairTreatmentTarget,
                                    reduceMotion: Bool = false) -> FlairTextTreatmentPlan {
        let spec = stages[stage.rawValue] ?? .object([:])
        let lines = target.lines.filter { $0.width > 0 && $0.height > 0 }
        let length = stageLength(spec, lines)
        let sequence = (spec["flow"]?.string ?? "sequence") == "sequence"
        let loops = spec["loop"] == .bool(true)
        if reduceMotion {
            let defaults = defaultReduced[stage]!
            let reduced = spec["reduced"]
            let at = reduced?["at"]?.number ?? defaults.at
            let fade = reduced?["fade"]?.string ?? defaults.fade
            let duration = max(0, n(reduced?["duration"], length))
            let u = duration <= 0 ? 1 : time / duration
            let layers = planLayers(spec, target, progress: { _ in at }, fade: fadeAt(fade, u), sequence: sequence)
            return FlairTextTreatmentPlan(stage: stage, time: time, duration: duration, done: !loops && time >= duration, reduced: true, layers: layers)
        }
        let t = loops && length > 0 ? time.truncatingRemainder(dividingBy: length) : time
        let global = length <= 0 ? 1 : clamp01(t / length)
        let duration = max(0, n(spec["duration"], 0))
        let perPixel = max(0, n(spec["perPixel"], 0))
        let stagger = max(0, n(spec["stagger"], 0))
        let progress = { (i: Int) -> Double in
            if i < 0 || sequence { return global }
            let d = duration + perPixel * Double(lines[i].width)
            return d <= 0 ? (t >= Double(i) * stagger ? 1 : 0) : clamp01((t - Double(i) * stagger) / d)
        }
        return FlairTextTreatmentPlan(stage: stage, time: time, duration: length, done: !loops && time >= length, reduced: false,
                                      layers: planLayers(spec, target, progress: progress, fade: 1, sequence: sequence))
    }

    /// What `treatment` draws for `stage` at `time` ms into it, over `target`, with a preset and
    /// values over its defaults: the same plan as TypeScript's `textTreatmentPlan`.
    public static func plan(_ treatment: FlairTextTreatment, stage: FlairTextTreatmentStage, time: Double, target: FlairTreatmentTarget,
                            preset: String? = nil, values: [String: FlairJSON] = [:], reduceMotion: Bool = false) -> FlairTextTreatmentPlan {
        planResolved(resolve(treatment, values: treatment.values(preset: preset, values: values)), stage: stage,
                     time: max(0, time), target: target, reduceMotion: reduceMotion)
    }
}

#if os(macOS)
import AppKit
enum NSWorkspaceReduceMotion {
    @MainActor static var value: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }
}
#else
import UIKit
enum UIAccessibilityReduceMotion {
    @MainActor static var value: Bool { UIAccessibility.isReduceMotionEnabled }
}
#endif
