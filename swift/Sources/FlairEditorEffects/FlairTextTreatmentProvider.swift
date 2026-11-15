import CoreGraphics
import CoreText
import FlairEffects
import Foundation
import PixerateCore
import QuartzCore

// Flair's text treatments through the editors' Swift package: `FlairEffectProvider` is a
// `TextTreatmentProvider` (its plans are `FlairTextTreatments.plan`'s, the same as the TypeScript
// `flairEffects().textTreatmentPlan`), and `FlairTextTreatmentLayers` is a `TextTreatmentRenderer`
// that draws the editor's plans with `FlairTextTreatmentRenderer`'s Core Animation layers.

extension FlairEffectProvider: TextTreatmentProvider {
    /// The treatment for agents that don't choose one: the writing partner's soft sweep.
    public var defaultTextTreatment: String? { FlairTextTreatments.defaultID }

    /// What text treatment `id` draws for `request.stage` at `request.time` over `request.target`, with
    /// `values` over its defaults (`color` is the agent's colour, `"#rrggbb"`). Throws `TextTreatmentError`:
    /// `unknown_effect` for an id Flair does not have, `unsupported` for another kind of effect or a bad
    /// request, `invalid_values` for an unknown control or a value of the wrong type.
    public func textTreatmentPlan(_ id: String, _ request: PixerateCore.TextTreatmentPlanRequest, values: JSONObject?) throws -> PixerateCore.TextTreatmentPlan {
        guard let treatment = FlairTextTreatments.treatment(id: id) else {
            if hasEffect(id) {
                throw TextTreatmentError("unsupported", "\"\(id)\" is not a text treatment, so it draws nothing over text; the text treatments are \(FlairTextTreatments.all.map(\.id).joined(separator: ", ")).")
            }
            throw TextTreatmentError("unknown_effect", "Flair has no effect \"\(id)\"; the text treatments are \(FlairTextTreatments.all.map(\.id).joined(separator: ", ")).")
        }
        try checkTextTreatmentRequest(request)
        let given = try Self.treatmentValues(treatment, values)
        let plan = FlairTextTreatments.plan(treatment, stage: FlairTextTreatmentStage(rawValue: request.stage.rawValue)!, time: request.time,
                                            target: Self.flairTarget(request.target), values: given, reduceMotion: request.reduceMotion)
        return Self.editorPlan(plan, font: request.target.font)
    }


    /// Values from the editor, checked against the treatment's controls.
    static func treatmentValues(_ treatment: FlairTextTreatment, _ values: JSONObject?) throws -> [String: FlairJSON] {
        guard let values else { return [:] }
        var out: [String: FlairJSON] = [:]
        for key in values.keys {
            guard let control = treatment.controls.first(where: { $0.name == key }) else {
                throw TextTreatmentError("invalid_values", "\"\(treatment.id)\" has no control \"\(key)\"; its controls are \(treatment.controls.map(\.name).joined(separator: ", ")).")
            }
            let value = values[key]!
            switch (control.type, value) {
            case ("bool", .bool(let b)): out[key] = .bool(b)
            case ("float", .number(let n)), ("int", .number(let n)): out[key] = .number(n)
            case ("vec3", .string(let s)) where control.color && FlairRGBA(hex: s) != nil: out[key] = .string(s)
            default:
                let wants = control.color ? "a colour, \"#rrggbb\"" : control.type == "bool" ? "true or false" : "a number"
                throw TextTreatmentError("invalid_values", "\"\(treatment.id)\": \(key) takes \(wants).")
            }
        }
        return out
    }

    static func flairTarget(_ t: PixerateCore.TextTreatmentTarget) -> FlairTreatmentTarget {
        FlairTreatmentTarget(lines: t.lines.map { CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height) },
                             caret: t.caret.map { FlairTreatmentCaret(x: $0.x, y: $0.y, height: $0.height) },
                             text: t.text, label: t.label,
                             color: t.color.map { FlairRGBA($0.r, $0.g, $0.b, $0.a) },
                             background: t.background.map { FlairRGBA($0.r, $0.g, $0.b, $0.a) })
    }

    static func editorColour(_ c: FlairRGBA) -> TextTreatmentRGBA { TextTreatmentRGBA(c.r, c.g, c.b, c.a) }

    /// A Flair plan as the editor's (the typed word's layers carry the host's font back).
    static func editorPlan(_ p: FlairTextTreatmentPlan, font: String?) -> PixerateCore.TextTreatmentPlan {
        PixerateCore.TextTreatmentPlan(stage: TextTreatmentStage(rawValue: p.stage.rawValue)!, time: p.time, duration: p.duration, done: p.done, reduced: p.reduced,
                                       layers: p.layers.map { l in
                                           TextTreatmentLayer(kind: TextTreatmentLayer.Kind(rawValue: l.kind.rawValue)!, source: l.source,
                                                              z: l.z == "behind" ? .behind : .above, x: l.x, y: l.y, width: l.width, height: l.height,
                                                              radius: l.radius, opacity: l.opacity, color: editorColour(l.color),
                                                              gradient: l.gradient.map { g in
                                                                  TextTreatmentGradient(x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1,
                                                                                        stops: g.stops.map { .init(offset: $0.offset, color: editorColour($0.color)) })
                                                              },
                                                              stroke: l.stroke, glow: l.glow, blend: l.blend, text: l.text,
                                                              font: l.kind == .text ? font : nil, size: l.size, padX: l.padX,
                                                              textColor: l.textColor.map(editorColour),
                                                              segments: l.segments.map { segs in
                                                                  segs.map { TextTreatmentSegment(points: $0.points.map { (x: Double($0.x), y: Double($0.y)) }, color: editorColour($0.color)) }
                                                              })
                                       })
    }

    /// The editor's plan as Flair's, for `FlairTextTreatmentRenderer`.
    static func flairPlan(_ p: PixerateCore.TextTreatmentPlan) -> FlairTextTreatmentPlan {
        let rgba = { (c: TextTreatmentRGBA) in FlairRGBA(c.r, c.g, c.b, c.a) }
        return FlairTextTreatmentPlan(stage: FlairTextTreatmentStage(rawValue: p.stage.rawValue)!, time: p.time, duration: p.duration, done: p.done, reduced: p.reduced,
                                      layers: p.layers.map { l in
                                          FlairTreatmentPlanLayer(kind: FlairTreatmentPlanLayer.Kind(rawValue: l.kind.rawValue)!, source: l.source, z: l.z.rawValue,
                                                                  x: l.x, y: l.y, width: l.width, height: l.height, radius: l.radius, opacity: l.opacity,
                                                                  color: rgba(l.color),
                                                                  gradient: l.gradient.map { g in
                                                                      FlairTreatmentGradient(x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, stops: g.stops.map { (offset: $0.offset, color: rgba($0.color)) })
                                                                  },
                                                                  stroke: l.stroke, glow: l.glow, blend: l.blend, text: l.text, size: l.size, padX: l.padX,
                                                                  textColor: l.textColor.map(rgba),
                                                                  segments: l.segments.map { segs in
                                                                      segs.map { FlairTreatmentSegment(points: $0.points.map { CGPoint(x: $0.x, y: $0.y) }, color: rgba($0.color)) }
                                                                  })
                                      })
    }
}

/// The editors' `TextTreatmentRenderer` for Flair's (and the built-in) treatments: draws plans with
/// `FlairTextTreatmentRenderer`'s Core Animation layers. Put `behindLayer` under the text and
/// `aboveLayer` over it, in the text view's coordinates, y down.
@MainActor
public final class FlairTextTreatmentLayers: TextTreatmentRenderer {
    public let renderer = FlairTextTreatmentRenderer()
    /// The host text's font, for typed words.
    public var font: CTFont?

    public var behindLayer: CALayer { renderer.behindLayer }
    public var aboveLayer: CALayer { renderer.aboveLayer }

    public init(font: CTFont? = nil) {
        self.font = font
    }

    public func draw(_ plans: [PixerateCore.TextTreatmentPlan]) {
        renderer.draw(plans.map(FlairEffectProvider.flairPlan), font: font)
    }
}
