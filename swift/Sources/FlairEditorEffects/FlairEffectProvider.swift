import CryptoKit
import FlairEffects
import Foundation
import Metal
import PixerateCore
import PixeratePaint

/**
 * Flair as an effects provider for the Pixerate editors' Swift package: `FlairEffectProvider`
 * implements the editor's `EffectProvider` (`PixeratePaint`) over `FlairEffects`, so a Swift editor
 * can list, search, describe and render Flair's Metal shaders without depending on Flair.
 *
 * ```swift
 * let controller = try PaintEditorController(width: 1024, height: 768)
 * controller.setEffectsProvider(FlairEffectProvider())
 * _ = try await controller.addEffectLayer("aurora")
 * ```
 *
 * It mirrors `flairEffects()` from `@pixerate/flair/integrations` for shader effects: the catalog,
 * descriptions, uses, inputs and presets are the ones the TypeScript adapter gives (written by
 * `pnpm swift:meta` into `Resources/flair-effects.json`), so documents saved on one side replay on
 * the other. Renderers draw on the GPU with `FlairRenderer` and return straight-alpha RGBA8:
 * a filter's `source` and a transition's `from` / `to` become the shader's pictures, a transition's
 * progress drives it (`progress`, else `time` over its duration), and a mask keeps the untouched
 * picture (a filter's source, a transition's start) where it is 0. Vector, motion, camera and timing
 * effects and float pixels are not offered here yet.
 *
 * Authoring (`openAuthoring`, the editor's `effect_authoring_*` tools) edits a catalog effect's
 * values, presets, keyframes and timing with the editor's generic session. A document saved by
 * either adapter opens again here when its shader is the catalog's: the Swift adapter draws Flair's
 * Metal shaders, compiled ahead of time, so a document whose GLSL was edited (on the web) is
 * refused, saying so. Paint editors draw saved Flair documents only when the host sets
 * `rawShaders: true`; the provider needs nothing more for that.
 */
public final class FlairEffectProvider: AuthoringEffectProvider {
    /// The provider's id, saved next to effect ids (the TypeScript adapter's `FLAIR_PROVIDER_ID`).
    public static let providerId = "flair"

    public let id = FlairEffectProvider.providerId
    public let name = "Flair"
    public let capabilities: JSONObject

    /// The largest renderer side, in pixels.
    public let maxSize: Int

    /// The most ms a renderer waits for its shader to compile before refusing (as the editor's
    /// `PixelGPU.defaultCompileTimeoutMs`, 2000). Shaders compile once per provider.
    public let compileTimeoutMs: Double

    private let entries: [String: FlairEditorEffect]
    private let summaries: [EffectDescription]
    private let device: MTLDevice?
    private var gpu: FlairRenderer?
    private let lock = NSLock()

    /// A provider drawing on `device` (the system default GPU unless given). Without a GPU the
    /// catalog still lists and describes, and `createRenderer` refuses saying why.
    public init(device: MTLDevice? = MTLCreateSystemDefaultDevice(), compileTimeoutMs: Double = 2000) {
        self.device = device
        self.compileTimeoutMs = compileTimeoutMs
        let all = FlairEditorCatalog.shared.filter { FlairCatalog.effect(id: $0.description.id) != nil }
        entries = Dictionary(all.map { ($0.description.id, $0) }, uniquingKeysWith: { a, _ in a })
        summaries = all.map(\.description.summary)
        maxSize = 8192
        capabilities = [
            "supportsWorker": false,
            "supportsFloat": false,
            "supportsMask": true,
            "supportsHostImages": false,
            "supportsVector": false,
            "supportsAuthoring": true,
            "supportsCamera": false,
            "supportsTiming": false,
            "supportsTemplates": false,
            "maxSize": .number(Double(maxSize)),
        ]
    }

    private func entry(_ id: String) throws -> FlairEditorEffect {
        guard let e = entries[id] else { throw EffectError.unknown(id, in: "Flair") }
        return e
    }

    public func list(_ options: EffectSearchOptions) async throws -> [EffectDescription] {
        searchEffectSummaries(summaries, "", options)
    }

    public func search(_ query: String, _ options: EffectSearchOptions) async throws -> [EffectDescription] {
        searchEffectSummaries(summaries, query, options)
    }

    public func describe(_ id: String) async throws -> EffectDescription {
        try entry(id).description
    }

    public func createRenderer(_ id: String, width: Int, height: Int) throws -> EffectRenderer {
        let e = try entry(id)
        if !(width >= 1 && height >= 1) {
            throw EffectError.unsupported("createRenderer needs a width and height of at least 1 pixel; got \(width) × \(height).", id)
        }
        if width > maxSize || height > maxSize {
            throw EffectError.unsupported("createRenderer takes sides up to \(maxSize) pixels; got \(width) × \(height).", id)
        }
        guard let effect = FlairCatalog.effect(id: id) else { throw EffectError.unknown(id, in: "Flair") }
        try withGPU(id) { gpu in
            do {
                try gpu.prepare(anyEffect: effect, timeoutMs: compileTimeoutMs)
            } catch FlairRendererError.compileTimedOut {
                throw EffectError.unsupported("\"\(id)\" took longer than \(Int(compileTimeoutMs)) ms to compile for the GPU; try again shortly (it keeps compiling), or use another effect.", id)
            } catch {
                throw EffectError.unsupported("\"\(id)\" cannot render here: \(error.localizedDescription)", id)
            }
        }
        return FlairShaderRenderer(entry: e, effect: effect, width: width, height: height, provider: self)
    }

    // MARK: Authoring

    /**
     * Opens a catalog effect (with a preset's values when one is named) or a document saved by
     * `exportDocument` on either adapter, for editing its values, presets, keyframes and timing.
     * The session is the editor's `GenericEffectAuthoringSession` drawing with this provider; it has
     * no source to edit (`canEditSource` is false). Refuses an unknown effect or preset, a document
     * from another provider, and a document whose GLSL is not the catalog effect's, saying why.
     */
    public func openAuthoring(_ from: EffectAuthoringSource) async throws -> EffectAuthoringSession {
        switch from {
        case .effect(let id, let preset):
            let e = try entry(id)
            if let preset {
                let names = (e.description.json["presets"]?.arrayValue ?? []).compactMap { $0.objectValue?["name"]?.stringValue }
                if !names.contains(preset) {
                    let valid = names.isEmpty ? "none" : names.map { "\"\($0)\"" }.joined(separator: ", ")
                    throw EffectError.unsupported("\"\(id)\" has no preset \"\(preset)\"; its presets are \(valid).", id)
                }
            }
            return try await GenericEffectAuthoringSession(.effect(id, preset: preset), options: GenericAuthoringOptions(provider: self))
        case .document(let raw):
            let doc = try authoringDocument(raw)
            return try await GenericEffectAuthoringSession(.document(.object(doc)), options: GenericAuthoringOptions(provider: self))
        }
    }

    /// A saved document's contract fields, once its header and shader are known to be ones this provider draws.
    private func authoringDocument(_ raw: JSONValue) throws -> JSONObject {
        guard let o = raw.objectValue else {
            throw documentError("", [("/", "must be a document saved with exportDocument (an object)")])
        }
        var header: [(String, String)] = []
        if o["version"] != .number(1) { header.append(("/version", "must be 1")) }
        if let p = o["providerId"], p != .string(Self.providerId) {
            header.append(("/providerId", "is \(p.stringified()); this is Flair's provider (\"\(Self.providerId)\"): open it with the provider that saved it"))
        }
        let effectId = o["effectId"]?.stringValue ?? ""
        if effectId.isEmpty { header.append(("/effectId", "must be the id of the effect the document was made from")) }
        if !header.isEmpty { throw documentError(effectId, header) }
        let e = try entry(effectId)

        // The GLSL it was saved with: Flair's own document (the TypeScript adapter's), else the contract's source.
        var glsl: String?
        if let flair = o["flair"] {
            guard let effect = flair.objectValue?["effect"]?.objectValue else {
                throw documentError(effectId, [("/flair/effect", "must be the effect's source ({ kind, source })")])
            }
            if effect["kind"] != .string("shader") {
                throw documentError(effectId, [("/flair/effect/kind", "is \(effect["kind"]?.stringified() ?? "missing"), but \"\(effectId)\" is a shader effect")])
            }
            guard let s = effect["source"]?.stringValue else { throw documentError(effectId, [("/flair/effect/source", "must be a string")]) }
            glsl = s
        } else if let s = o["source"]?.stringValue {
            if let lang = o["sourceLanguage"], lang != .string("glsl") {
                throw documentError(effectId, [("/sourceLanguage", "is \(lang.stringified()); Flair's shader documents are written in \"glsl\"")])
            }
            glsl = s
        }
        if let glsl, flairSourceHash(glsl) != e.sourceHash {
            let name = o["name"]?.stringValue ?? e.description.name
            throw EffectError.unsupported(
                "\"\(name)\" has GLSL edited from \"\(effectId)\"; this adapter draws Flair's shaders compiled to Metal ahead of time, so it can't draw edited source. Open the document where Flair's TypeScript adapter runs (flairEffects().openAuthoring), or open \"\(effectId)\" here and set its values instead.",
                effectId)
        }
        var doc = o
        for key in ["flair", "source", "sourceLanguage"] { doc[key] = nil }
        return doc
    }

    /// The shared GPU renderer (its pipelines and textures are cached across renderers), made on first use.
    func withGPU<T>(_ id: String, _ body: (FlairRenderer) throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }
        if gpu == nil {
            guard let device else {
                throw EffectError.unsupported("\"\(id)\" cannot render here: there is no Metal GPU. Flair's effects need one.", id)
            }
            do { gpu = try FlairRenderer(device: device) } catch {
                throw EffectError.unsupported("\"\(id)\" cannot render here: \(error.localizedDescription)", id)
            }
        }
        return try body(gpu!)
    }
}

/// One catalog effect as the editors see it: its description and where its inputs go.
struct FlairEditorEffect {
    let description: EffectDescription
    /// Input name → the image control (Metal sampler) it fills.
    let inputs: [String: String]
    let transition: Bool
    /// `flairSourceHash` of the GLSL its Metal shader was made from.
    let sourceHash: String
}

/// SHA-256 of a GLSL source's UTF-8 bytes, as lowercase hex (as `pnpm swift:meta` writes it).
func flairSourceHash(_ source: String) -> String {
    SHA256.hash(data: Data(source.utf8)).map { String(format: "%02x", $0) }.joined()
}

/// A saved document's problems, as the editor's `invalid_values` error (one line per path).
private func documentError(_ effectId: String, _ problems: [(path: String, message: String)]) -> EffectError {
    let lines = problems.map { "- \($0.path): \($0.message)" }.joined(separator: "\n")
    return EffectError("invalid_values", "Invalid values for effect \"\(effectId)\":\n\(lines)", effectId: effectId.isEmpty ? nil : effectId)
}

/// The descriptions `pnpm swift:meta` writes, read once.
enum FlairEditorCatalog {
    static let shared: [FlairEditorEffect] = {
        guard let url = Bundle.module.url(forResource: "flair-effects", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let root = try? JSONValue.parse(data),
              let list = root.objectValue?["effects"]?.arrayValue else { return [] }
        return list.compactMap { item in
            guard let o = item.objectValue, let d = o["description"]?.objectValue else { return nil }
            var inputs: [String: String] = [:]
            for (name, uniform) in o["inputs"]?.objectValue ?? [:] {
                if let u = uniform.stringValue { inputs[name] = u }
            }
            return FlairEditorEffect(description: EffectDescription(d), inputs: inputs, transition: o["transition"] == .bool(true), sourceHash: o["sourceHash"]?.stringValue ?? "")
        }
    }()
}

/// How long one play of a shader that moves but never repeats is said to last (ms), as `ENDLESS_PLAY_MS`.
let endlessPlayMs: Double = 4000

final class FlairShaderRenderer: SyncEffectRenderer {
    let entry: FlairEditorEffect
    let effect: AnyFlairEffect
    let width: Int
    let height: Int
    private weak var provider: FlairEffectProvider?
    private var disposed = false

    var effectId: String { entry.description.id }

    init(entry: FlairEditorEffect, effect: AnyFlairEffect, width: Int, height: Int, provider: FlairEffectProvider) {
        self.entry = entry
        self.effect = effect
        self.width = width
        self.height = height
        self.provider = provider
    }

    func dispose() { disposed = true }

    func render(_ request: EffectRenderRequest) async throws -> EffectPixels {
        try renderSync(request)
    }

    func renderSync(_ request: EffectRenderRequest) throws -> EffectPixels {
        let id = effectId
        if disposed { throw EffectError("disposed", "The renderer for \"\(id)\" was disposed. Create a new renderer.", effectId: id) }
        guard let provider else { throw EffectError("disposed", "The renderer for \"\(id)\" outlived its provider. Create a new renderer.", effectId: id) }
        try checkRequest(request)
        let values = try resolveEffectValues(entry.description, request.values)
        var flair = flairValues(values)
        if entry.transition {
            let duration = entry.description.duration ?? endlessPlayMs
            let p = request.progress ?? request.time / duration
            flair["uAnimate"] = .bool(false)
            flair["uProgress"] = .number(Swift.min(1, Swift.max(0, p.isFinite ? p : 0)))
        }
        let configured = effect.applying(values: flair)
        let w = width, h = height
        var data: [UInt8] = try provider.withGPU(id) { gpu in
            var bound: [String] = []
            defer { for u in bound { gpu.setLiveTexture(nil, for: u) } }
            for (name, uniform) in entry.inputs {
                guard let picture = request.inputs[name] else { continue }
                guard let texture = makeTexture(gpu.device, picture) else {
                    throw EffectError.unsupported("\"\(id)\" could not take the input \"\(name)\" as a texture.", id)
                }
                gpu.setLiveTexture(texture, for: uniform)
                bound.append(uniform)
            }
            do {
                return try gpu.renderBytes(anyEffect: configured, width: w, height: h, time: Float(request.time / 1000))
            } catch {
                throw EffectError.unsupported("\"\(id)\" cannot render here: \(error.localizedDescription)", id)
            }
        }
        if let mask = request.mask {
            applyMask(&data, mask, untouched: request.inputs["source"] ?? request.inputs["from"])
        }
        return EffectPixels(width: w, height: h, data: data)
    }

    /// Checks the request's time and inputs; refuses as the TypeScript adapter does.
    private func checkRequest(_ request: EffectRenderRequest) throws {
        let id = effectId
        if !request.time.isFinite {
            throw EffectError.unsupported("render needs { time } in ms, a finite number; got \(request.time).", id)
        }
        let specs = entry.description.inputs
        let names = specs.compactMap { $0["name"]?.stringValue }
        for name in request.inputs.keys.sorted() where !names.contains(name) {
            let valid = names.isEmpty ? "it takes none" : "its inputs are \(names.map { "\"\($0)\"" }.joined(separator: ", "))"
            throw EffectError.unsupported("\"\(id)\" has no input \"\(name)\"; \(valid).", id)
        }
        for spec in specs {
            guard let name = spec["name"]?.stringValue else { continue }
            if spec["required"] == .bool(true) && request.inputs[name] == nil {
                throw EffectError.unsupported("\"\(id)\" needs the input \"\(name)\": \(spec["description"]?.stringValue ?? "a picture").", id)
            }
            if let p = request.inputs[name], !(p.width >= 1 && p.height >= 1 && p.data.count == p.width * p.height * 4) {
                throw EffectError.unsupported("The input \"\(name)\" of \"\(id)\" is not RGBA8 pixels: \(p.width) × \(p.height) with \(p.data.count) bytes (want width × height × 4).", id)
            }
        }
        if let m = request.mask, m.width != width || m.height != height || m.data.count != width * height * 4 {
            throw EffectError.unsupported("The mask must be EffectPixels the size of the renderer (\(width) × \(height)); got \(m.width) × \(m.height).", id)
        }
    }

    /// Contract values (checked against the schema) as Flair's: CSS colours become channels.
    private func flairValues(_ values: JSONObject) -> [String: FlairJSONValue] {
        var out: [String: FlairJSONValue] = [:]
        for (name, value) in values {
            let control = effect.controls.first { $0.name == name }
            switch value {
            case .number(let n): out[name] = .number(n)
            case .bool(let b): out[name] = .bool(b)
            case .array(let a): out[name] = .array(a.map { $0.numberValue ?? 0 })
            case .string(let s):
                if let c = control, c.isColor, let rgba = parseCSSColor(s) {
                    out[name] = .array(c.type == .vec4 ? Array(rgba.prefix(3)) + [rgba.count > 3 ? rgba[3] : 1] : Array(rgba.prefix(3)))
                } else {
                    out[name] = .string(s)
                }
            case .null, .object: continue
            }
        }
        return out
    }

    /// Where the mask is 0 the untouched picture shows (or, with none, nothing); where it is 1, the effect.
    private func applyMask(_ data: inout [UInt8], _ mask: EffectPixels, untouched: EffectPixels?) {
        for y in 0..<height {
            for x in 0..<width {
                let i = (y * width + x) * 4
                let k = Double(mask.data[i + 3]) / 255
                if k >= 1 { continue }
                if let u = untouched {
                    let ux = Swift.min(u.width - 1, x * u.width / width), uy = Swift.min(u.height - 1, y * u.height / height)
                    let j = (uy * u.width + ux) * 4
                    for c in 0..<4 {
                        let a = Double(u.data[j + c]), b = Double(data[i + c])
                        data[i + c] = UInt8(Swift.max(0, Swift.min(255, (a + (b - a) * k).rounded())))
                    }
                } else {
                    data[i + 3] = UInt8((Double(data[i + 3]) * k).rounded())
                }
            }
        }
    }
}

/// A straight-alpha RGBA8 picture as a texture, its bottom row first (as Flair binds pictures).
private func makeTexture(_ device: MTLDevice, _ p: EffectPixels) -> MTLTexture? {
    let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: p.width, height: p.height, mipmapped: false)
    desc.usage = [.shaderRead]
    desc.storageMode = .shared
    guard let texture = device.makeTexture(descriptor: desc) else { return nil }
    let row = p.width * 4
    var flipped = [UInt8](repeating: 0, count: p.data.count)
    for y in 0..<p.height {
        let from = (p.height - 1 - y) * row
        flipped.replaceSubrange(y * row..<(y + 1) * row, with: p.data[from..<from + row])
    }
    flipped.withUnsafeBytes { raw in
        if let base = raw.baseAddress {
            texture.replace(region: MTLRegionMake2D(0, 0, p.width, p.height), mipmapLevel: 0, withBytes: base, bytesPerRow: row)
        }
    }
    return texture
}

/**
 * A CSS colour as sRGB channels 0–1 (`parseColor` in Flair's TypeScript): hex (3, 4, 6 or 8
 * digits, `#` optional), `rgb()` / `rgba()` and `hsl()` / `hsla()`. Alpha is kept only below 1.
 */
func parseCSSColor(_ css: String) -> [Double]? {
    let text = css.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    var hex = text.hasPrefix("#") ? String(text.dropFirst()) : text
    if [3, 4, 6, 8].contains(hex.count), hex.allSatisfy(\.isHexDigit) {
        if hex.count <= 4 { hex = hex.map { "\($0)\($0)" }.joined() }
        var rgba: [Double] = []
        var i = hex.startIndex
        while i < hex.endIndex {
            let j = hex.index(i, offsetBy: 2)
            rgba.append(Double(UInt8(hex[i..<j], radix: 16) ?? 0) / 255)
            i = j
        }
        return rgba.count == 4 && rgba[3] < 1 ? rgba : Array(rgba.prefix(3))
    }
    guard let open = text.firstIndex(of: "("), text.hasSuffix(")") else { return nil }
    let fn = String(text[..<open])
    guard ["rgb", "rgba", "hsl", "hsla"].contains(fn) else { return nil }
    let body = text[text.index(after: open)..<text.index(before: text.endIndex)]
    let parts = body.split(whereSeparator: { $0 == "," || $0 == "/" || $0 == " " }).map(String.init).filter { !$0.isEmpty }
    guard parts.count == 3 || parts.count == 4 else { return nil }
    func num(_ p: String, _ full: Double) -> Double {
        guard p.range(of: "^-?(\\d+\\.?\\d*|\\.\\d+)(%|deg)?$", options: .regularExpression) != nil else { return .nan }
        let digits = p.hasSuffix("%") ? String(p.dropLast()) : p.hasSuffix("deg") ? String(p.dropLast(3)) : p
        guard let n = Double(digits) else { return .nan }
        return p.hasSuffix("%") ? n / 100 * full : n
    }
    // NaN stays NaN (as in JavaScript), so a bad component fails the colour below.
    func clamp(_ n: Double) -> Double { n.isNaN ? n : Swift.min(1, Swift.max(0, n)) }
    var rgb: [Double]
    if fn.hasPrefix("rgb") {
        rgb = parts.prefix(3).map { clamp(num($0, 255) / 255) }
    } else {
        let h = (num(parts[0], 360).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 360
        let s = clamp(num(parts[1], 1)), l = clamp(num(parts[2], 1))
        func f(_ k: Double) -> Double {
            let t = (k + h * 12).truncatingRemainder(dividingBy: 12)
            return l - s * Swift.min(l, 1 - l) * Swift.max(-1, Swift.min(t - 3, 9 - t, 1))
        }
        rgb = [f(0), f(8), f(4)]
    }
    let alpha = parts.count == 4 ? clamp(num(parts[3], 1)) : 1
    if (rgb + [alpha]).contains(where: \.isNaN) { return nil }
    return alpha < 1 ? rgb + [alpha] : rgb
}
