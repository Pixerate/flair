import Foundation
import PixerateCore
import PixeratePaint

/**
 * The editor's `checkEffectProvider` (`@pixerate/editor/effects`, `effects/conformance.ts`) for a
 * Swift `EffectProvider`, as far as the Swift protocol goes (no camera, timing, templates or
 * authoring there): strict control schemas, valid defaults and presets, typed errors, and
 * renderers that return the size they were asked for, refuse unknown controls and stop after
 * `dispose`. The Swift editor package has no such check yet, so it lives here.
 */
struct EffectProviderIssue: CustomStringConvertible {
    var effectId: String?
    var message: String
    var description: String { effectId.map { "\($0): \(message)" } ?? message }
}

private let EFFECT_KINDS = ["shader", "vector", "motion", "camera", "timing"]
private let EFFECT_USES = ["filter", "transition", "generator", "overlay", "title", "interactive", "motion", "camera", "timing"]
private let EFFECT_ACCEPTS = ["path"]

private func codeOf(_ error: Error) -> String {
    (error as? EffectError)?.code ?? "untyped \(type(of: error)): \(error.localizedDescription)"
}

/// nil when `run` fails with `code`, else what happened instead.
private func rejectsWith(_ code: String, _ run: () async throws -> Void) async -> String? {
    do {
        try await run()
        return "did not fail (expected \(code))"
    } catch {
        let got = codeOf(error)
        return got == code ? nil : "failed with \(got) (expected \(code))"
    }
}

private func checkSummary(_ e: EffectDescription, _ issues: inout [EffectProviderIssue]) {
    func at(_ m: String) { issues.append(EffectProviderIssue(effectId: e.id, message: m)) }
    if e.id.isEmpty { at("summary has no id") }
    if e.json["name"]?.stringValue?.isEmpty != false { at("summary has no name") }
    if !EFFECT_KINDS.contains(e.kind) { at("kind \"\(e.kind)\" is not one of \(EFFECT_KINDS.joined(separator: ", "))") }
    if e.category.isEmpty { at("summary has no category") }
    if e.uses.isEmpty { at("summary has no uses") }
    for u in e.uses where !EFFECT_USES.contains(u) { at("use \"\(u)\" is not one of \(EFFECT_USES.joined(separator: ", "))") }
    if e.json["transparent"]?.boolValue == nil { at("transparent is not a boolean") }
    if e.json["loop"]?.boolValue == nil { at("loop is not a boolean") }
    if let d = e.json["duration"], !((d.numberValue ?? 0) > 0) { at("duration must be a positive number of ms when present") }
    if let b = e.json["backgroundOpacity"], b.stringValue?.isEmpty != false { at("backgroundOpacity must name a control when present") }
    for a in (e.json["accepts"]?.arrayValue ?? []).compactMap(\.stringValue) where !EFFECT_ACCEPTS.contains(a) { at("accepts \"\(a)\" is not one of \(EFFECT_ACCEPTS.joined(separator: ", "))") }
    if e.kind != "camera" && e.uses.contains("camera") { at("only camera effects may have the use \"camera\"") }
    if e.kind != "timing" && e.uses.contains("timing") { at("only timing effects may have the use \"timing\"") }
}

private func checkDescription(_ id: String, _ d: EffectDescription, _ issues: inout [EffectProviderIssue]) {
    func at(_ m: String) { issues.append(EffectProviderIssue(effectId: id, message: m)) }
    if d.id != id { at("describe(\"\(id)\") returned id \"\(d.id)\"") }
    let c = d.controls
    if c["type"] != .string("object") { at("controls is not an object schema") }
    if c["additionalProperties"] != .bool(false) { at("controls must set additionalProperties: false") }
    let props = c["properties"]?.objectValue ?? [:]
    for (name, schema) in props {
        if (schema.objectValue?["description"]?.stringValue ?? "").trimmingCharacters(in: .whitespaces).isEmpty { at("control \"\(name)\" has no description") }
        if !d.defaults.contains(name) { at("control \"\(name)\" has no default") }
    }
    for name in d.defaults.keys where !props.contains(name) { at("default \"\(name)\" is not a control") }
    if let bg = d.json["backgroundOpacity"]?.stringValue {
        if let control = props[bg]?.objectValue {
            if control["type"] != .string("number") || control["minimum"] != .number(0) || control["maximum"] != .number(1) { at("backgroundOpacity \"\(bg)\" must be a number control from 0 to 1") }
        } else {
            at("backgroundOpacity \"\(bg)\" is not a control")
        }
    }
    let paths = pathControlsOf(d)
    let accepts = (d.json["accepts"]?.arrayValue ?? []).compactMap(\.stringValue)
    if !paths.isEmpty && !accepts.contains("path") { at("controls \(paths.map { "\"\($0)\"" }.joined(separator: ", ")) take a path, but accepts does not list \"path\"") }
    if paths.isEmpty && accepts.contains("path") { at("accepts lists \"path\", but no control has format \"svg-path\"") }
    for e in effectValueErrors(d, d.defaults) { at("default \(e.path): \(e.message)") }
    for p in (d.json["presets"]?.arrayValue ?? []).compactMap(\.objectValue) {
        for e in effectValueErrors(d, p["values"]?.objectValue) { at("preset \"\(p["name"]?.stringValue ?? "")\" \(e.path): \(e.message)") }
    }
    let inputs = d.inputs
    for input in inputs {
        if input["name"]?.stringValue?.isEmpty != false || input["description"]?.stringValue?.isEmpty != false { at("every input needs a name and a description") }
        let kind = input["kind"]?.stringValue ?? ""
        if kind != "image" && kind != "audio" { at("input \"\(input["name"]?.stringValue ?? "")\" has kind \"\(kind)\"") }
    }
    let names = inputs.compactMap { $0["name"]?.stringValue }
    if d.uses.contains("filter") && !names.contains("source") { at("a filter must read an input named \"source\"") }
    if d.uses.contains("transition") && !(names.contains("from") && names.contains("to")) { at("a transition must read inputs named \"from\" and \"to\"") }
}

private func grey(_ size: Int) -> EffectPixels { EffectPixels(width: size, height: size, data: [UInt8](repeating: 128, count: size * size * 4)) }

private func checkRender(_ provider: EffectProvider, _ d: EffectDescription, _ size: Int, _ issues: inout [EffectProviderIssue]) async {
    func at(_ m: String) { issues.append(EffectProviderIssue(effectId: d.id, message: m)) }
    var inputs: [String: EffectPixels] = [:]
    for i in d.inputs where i["kind"]?.stringValue == "image" { if let n = i["name"]?.stringValue { inputs[n] = grey(size) } }
    let renderer: EffectRenderer
    do { renderer = try provider.createRenderer(d.id, width: size, height: size) } catch {
        at("createRenderer failed: \(codeOf(error))")
        return
    }
    do {
        let out = try await renderer.render(EffectRenderRequest(time: 0, inputs: inputs))
        if out.width != size || out.height != size || out.data.count != size * size * 4 { at("render returned \(out.width)×\(out.height), not \(size)×\(size)") }
    } catch {
        at("render failed: \(codeOf(error))")
    }
    if let bad = await rejectsWith("invalid_values", { _ = try await renderer.render(EffectRenderRequest(time: 0, values: ["__not_a_control__": 1], inputs: inputs)) }) { at("render with an unknown control \(bad)") }
    renderer.dispose()
    if let after = await rejectsWith("disposed", { _ = try await renderer.render(EffectRenderRequest(time: 0, inputs: inputs)) }) { at("render after dispose \(after)") }
}

/// Every problem found with `provider` (none when it keeps the contract).
func checkEffectProvider(_ provider: EffectProvider, ids only: [String]? = nil, size: Int = 8) async throws -> [EffectProviderIssue] {
    var issues: [EffectProviderIssue] = []
    func top(_ m: String) { issues.append(EffectProviderIssue(effectId: nil, message: m)) }
    if provider.id.isEmpty { top("provider has no id") }
    for k in ["supportsWorker", "supportsFloat", "supportsMask", "supportsHostImages", "supportsVector"] where provider.capabilities[k]?.boolValue == nil {
        top("capabilities.\(k) is not a boolean")
    }
    if provider.capabilities["supportsVector"] == .bool(true) && !(provider is VectorEffectProvider) { top("supportsVector is set but applyVectorEffect is missing") }

    let list = try await provider.list()
    var ids: [String] = []
    for e in list {
        if ids.contains(e.id) { top("duplicate id \"\(e.id)\"") }
        ids.append(e.id)
        checkSummary(e, &issues)
    }
    if provider.capabilities["supportsCamera"] != .bool(true) && list.contains(where: { $0.kind == "camera" }) { top("the catalog lists camera effects but capabilities.supportsCamera is not set") }
    if provider.capabilities["supportsTiming"] != .bool(true) && list.contains(where: { $0.kind == "timing" }) { top("the catalog lists timing effects but capabilities.supportsTiming is not set") }
    let all = try await provider.search("", EffectSearchOptions())
    if all.count != list.count { top("search(\"\") returned \(all.count) effects, list() \(list.count)") }
    if let use = list.first?.uses.first {
        let filtered = try await provider.search("", EffectSearchOptions(use: use))
        if filtered.contains(where: { !$0.uses.contains(use) }) { top("search(\"\", { use: \"\(use)\" }) returned effects without that use") }
    }
    if let u = await rejectsWith("unknown_effect", { _ = try await provider.describe("__no_such_effect__") }) { top("describe of an unknown id \(u)") }
    if let u = await rejectsWith("unknown_effect", { _ = try provider.createRenderer("__no_such_effect__", width: 4, height: 4) }) { top("createRenderer of an unknown id \(u)") }

    for id in only ?? ids {
        let d: EffectDescription
        do { d = try await provider.describe(id) } catch {
            issues.append(EffectProviderIssue(effectId: id, message: "describe failed: \(codeOf(error))"))
            continue
        }
        checkDescription(id, d, &issues)
        if d.kind == "shader" { await checkRender(provider, d, size, &issues) }
    }
    return issues
}
