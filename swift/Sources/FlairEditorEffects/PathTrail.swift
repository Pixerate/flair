import FlairEffects
import Foundation
import simd

/**
 * The pointer-trail effects (`comet-trail`, `ribbon-trail`, …) follow `iTrail`, and with no
 * pointer their `uDemo` walks a short trail along `uPath` over time. An editor that paints with
 * one along a stroke gives the stroke as `uPath` points and wants the whole stroke drawn at once,
 * so when `uPath` is a points array (not SVG path data, which still walks) the renderer makes
 * `iTrail` from it instead: `FlairFrameState.maxTrail` points spread evenly along the path, the
 * head at its end, their ages spread over half the effect's `uLife` (so the tail fades as a trail
 * does, but all of it shows), and `uDemo` off. As `pathTrail` in `src/integrations/path-trail.ts`.
 */
enum FlairPathTrail {
    /// Whether an effect draws a pointer trail that a path can stand in for: a `uDemo` toggle and a path control.
    static func isTrailEffect(_ controls: [FlairControlDescriptor]) -> Bool {
        controls.contains { $0.name == "uDemo" && $0.type == .bool } && controls.contains { $0.type == .path }
    }

    /// The trail (newest first, pixels from the bottom left) and values with `uDemo` off, or nil when the path isn't points.
    static func trail(controls: [FlairControlDescriptor], values: [String: FlairJSONValue], height: Double, time: Double) -> (trail: [SIMD4<Float>], values: [String: FlairJSONValue])? {
        guard isTrailEffect(controls), let control = controls.first(where: { $0.type == .path }),
              case .array(let flat)? = values[control.name], flat.count >= 4, flat.allSatisfy(\.isFinite)
        else { return nil }
        let points = stride(from: 0, to: flat.count - 1, by: 2).map { SIMD2(flat[$0], flat[$0 + 1]) }
        var life = 1.0
        if case .number(let l)? = values["uLife"], l > 0 { life = l }
        var out = values
        out["uDemo"] = .bool(false)
        return (trailPoints(points, height: height, time: time, life: life), out)
    }

    /// `maxTrail` points evenly along `points` (pixels from the top left), newest (the path's end, at `time`) first, flipped to y up.
    static func trailPoints(_ points: [SIMD2<Double>], height: Double, time: Double, life: Double) -> [SIMD4<Float>] {
        let n = FlairFrameState.maxTrail
        var lengths: [Double] = [0]
        for i in 1..<points.count { lengths.append(lengths[i - 1] + simd_distance(points[i], points[i - 1])) }
        let total = lengths.last ?? 0
        let step = life / 2 / Double(n - 1)
        var oldestFirst: [SIMD4<Float>] = []
        var seg = 1
        for k in 0..<n {
            let along = total * Double(k) / Double(n - 1)
            while seg < points.count - 1 && lengths[seg] < along { seg += 1 }
            let a = points[seg - 1], b = points[min(seg, points.count - 1)]
            let span = lengths[seg] - lengths[seg - 1]
            let t = span > 0 ? min(1, max(0, (along - lengths[seg - 1]) / span)) : 0
            let p = a + (b - a) * t
            oldestFirst.append(SIMD4(Float(p.x), Float(height - p.y), Float(time - Double(n - 1 - k) * step), 1))
        }
        return oldestFirst.reversed()
    }
}
