import { describe, expect, it } from "vitest";
import { effectInputs, getEffect } from "../catalog/index.js";
import { createEffectEditor } from "../editor/editor.js";
import { textPath, textPathProblem } from "../vector/handwriting.js";
import { asGl, FakeGl } from "../testing/fake-gl.js";
import { checkControlValue, controlValue, describeValue, parseControls } from "./controls.js";
import { MAX_PATH_POINTS, PATH_CHUNK, pathPageData, pathPlacement, pathProblem, pathTexture } from "./path.js";
import { compileShader, drawFrame, type FrameState } from "./program.js";
import { controlSchema } from "./schema.js";
import { standaloneHtml } from "./standalone.js";

const SOURCE = `uniform sampler2D uPath; // @control path default="M 0 0 L 100 0 L 100 50" fit=cover margin=0.2 label="Route"
void mainImage(out vec4 c, in vec2 p) { c = texelFetch(uPath, ivec2(0), 0); }`;

const frame: FrameState = { width: 200, height: 100, time: 0, delta: 0, frame: 0, mouse: [0, 0, 0, 0] };

describe("path controls", () => {
  it("are declared on a sampler2D with `path`, with their fit and margin", () => {
    const [control] = parseControls(SOURCE);
    expect(control).toMatchObject({ name: "uPath", type: "path", label: "Route", default: "M 0 0 L 100 0 L 100 50", path: { fit: "cover", margin: 0.2 } });
    expect(parseControls('uniform sampler2D uP; // @control path default="M0 0 L1 1" fit=sideways margin=3')[0]!.path).toEqual({ fit: "contain", margin: 0.45 });
    // A plain image control is unchanged.
    expect(parseControls("uniform sampler2D uPhoto; // @control filter=linear")[0]!.type).toBe("sampler2D");
  });

  it("take SVG path data or points in pixels, and refuse anything else with what to pass", () => {
    const [control] = parseControls(SOURCE);
    expect(checkControlValue(control!, "M 10 10 C 20 0 30 0 40 10")).toEqual({ ok: true, value: "M 10 10 C 20 0 30 0 40 10" });
    expect(checkControlValue(control!, [0, 0, 50, 50, 100, 0])).toEqual({ ok: true, value: [0, 0, 50, 50, 100, 0] });
    expect(checkControlValue(control!, "hello")).toEqual({ ok: false, message: expect.stringMatching(/^uPath takes SVG path data starting with a move, like "M .*", or a list of points/) });
    expect(checkControlValue(control!, "M 0 0 Q 1")).toEqual({ ok: false, message: expect.stringMatching(/uPath takes a path with some length/) });
    expect(checkControlValue(control!, "M 0 0 X 3 4")).toEqual({ ok: false, message: expect.stringMatching(/does not parse: "X" is not a path command/) });
    expect(checkControlValue(control!, "M 5 5 L 5 5")).toEqual({ ok: false, message: expect.stringMatching(/every point in the same place/) });
    expect(checkControlValue(control!, [0, 0, 1])).toEqual({ ok: false, message: "uPath takes an even list of at least 4 numbers [x0, y0, x1, y1, …], not 3." });
    expect(checkControlValue(control!, [0, "a", 1, 1])).toMatchObject({ ok: false });
    expect(checkControlValue(control!, 42)).toMatchObject({ ok: false, message: expect.stringMatching(/takes SVG path data/) });
    // A stored value that is no longer a path falls back to the default.
    expect(controlValue(control!, { uPath: "nope" })).toBe("M 0 0 L 100 0 L 100 50");
  });

  it("describe long point lists briefly, keeping results small", () => {
    const [control] = parseControls(SOURCE);
    const points = Array.from({ length: 200 }, (_, i) => i);
    expect(describeValue(control!, points)).toBe("100 points, from (0, 1) to (198, 199)");
    expect(describeValue(control!, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("have a schema marking path data, with how it is placed and the point budget", () => {
    const schema = controlSchema(parseControls(SOURCE)[0]!);
    expect(schema.anyOf).toEqual([
      { type: "string", format: "svg-path", pattern: "^\\s*[Mm]" },
      { type: "array", items: { type: "number" }, minItems: 4 },
    ]);
    expect(schema.description).toMatch(/fitted into the frame \(cover, keeping 20% of the shorter side clear\)/);
    expect(schema.description).toContain(`at most ${MAX_PATH_POINTS} points`);
  });
});

describe("pathTexture", () => {
  it("packs evenly spaced points, the length, bounds and chunk boxes", () => {
    const packed = pathTexture("M 0 0 L 100 0 L 100 50")!;
    expect(packed.length).toBe(150);
    expect(packed.bounds).toEqual([0, 0, 100, 50]);
    expect(packed.points).toBe(64);
    const row = packed.width * 4;
    const meta = Array.from(packed.data.slice(row, row + 4));
    expect(meta).toEqual([64, 150, Math.ceil(63 / PATH_CHUNK), 1]);
    // First point starts a piece; the rest join on; distance along grows to the length.
    expect(Array.from(packed.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(packed.data[63 * 4 + 2]).toBeCloseTo(150);
    expect(packed.data[63 * 4 + 3]).toBe(1);
  });

  it("keeps separate pieces apart, and reads point lists in pixels", () => {
    const two = pathTexture("M 0 0 L 10 0 M 0 20 L 10 20")!;
    expect(two.pieces).toBe(2);
    const starts = Array.from({ length: two.points }, (_, i) => two.data[i * 4 + 3]).filter((w) => w === 0);
    expect(starts).toHaveLength(2);
    const pixels = pathTexture([10, 10, 110, 10], "contain")!;
    expect(pixels.data[pixels.width * 4 + 3]).toBe(0);
    expect(pathPlacement(pixels, 400, 300)).toEqual({ scale: 1, box: [10, 10, 100, 0] });
  });

  it("fits path data into the frame as declared", () => {
    const packed = pathTexture("M 0 0 L 100 0 L 100 50", "contain", 0.1)!;
    const placed = pathPlacement(packed, 200, 100);
    expect(placed.scale).toBeCloseTo(1.6);
    [20, 10, 160, 80].forEach((v, i) => expect(placed.box[i]).toBeCloseTo(v));
    const straight = pathTexture("M 0 0 L 100 0", "contain", 0)!;
    expect(pathPlacement(straight, 200, 100).scale).toBe(2);
  });

  it("stays within the point budget for long paths", () => {
    const long = "M 0 0 " + Array.from({ length: 400 }, (_, i) => `C ${i * 10 + 3} 20 ${i * 10 + 7} -20 ${i * 10 + 10} 0`).join(" ");
    const packed = pathTexture(long)!;
    expect(packed.points).toBe(MAX_PATH_POINTS);
    expect(packed.width).toBe(MAX_PATH_POINTS);
  });

  it("is undefined for a value that is not a path", () => {
    expect(pathTexture("nope")).toBeUndefined();
    expect(pathProblem("M 0 0 L 1 1")).toBeNull();
  });
});

describe("drawing path controls", () => {
  it("uploads the path as a float texture, once, and binds it to the control's unit", () => {
    const gl = new FakeGl();
    const controls = parseControls(SOURCE);
    const result = compileShader(asGl(gl), SOURCE, controls);
    if (!result.ok) throw new Error(result.errors[0]!.message);
    drawFrame(asGl(gl), result.shader, controls, undefined, frame);
    drawFrame(asGl(gl), result.shader, controls, undefined, frame);
    const uploads = gl.named("texImage2D");
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.args.slice(2, 8)).toEqual([gl.RGBA32F, 64, 2, 0, gl.RGBA, gl.FLOAT]);
    expect(gl.uniform("uPath")).toEqual([0]);
    // A new value uploads a new texture.
    drawFrame(asGl(gl), result.shader, controls, { uPath: [0, 0, 10, 10] }, frame);
    expect(gl.named("texImage2D")).toHaveLength(2);
  });

  it("travel with standalone pages as data", () => {
    const html = standaloneHtml("Route", SOURCE, { uPath: [0, 0, 10, 10] });
    expect(html).toContain("function pathTexture(gl, unit, path)");
    expect(html).toContain('"path":{"width"');
    expect(pathPageData("nope", "contain", 0.1)).toBeNull();
  });
});

describe("path effects, from an agent's side", () => {
  it("say they take a path, and take one through values.set", () => {
    const tube = getEffect("glass-tube")!;
    expect(effectInputs(tube)).toMatchObject({ accepts: ["path"], texts: [{ name: "uPath", holds: "path" }] });
    const editor = createEffectEditor({ from: "glass-tube" });
    expect(editor.commands.execute("values.set", { values: { uPath: "M 0 0 C 50 -40 100 40 150 0" } })).toMatchObject({ ok: true });
    expect(editor.commands.execute("values.set", { values: { uPath: [20, 20, 300, 200] } })).toMatchObject({ ok: true });
    const refused = editor.commands.execute("values.set", { values: { uPath: "a squiggle" } });
    expect(refused).toMatchObject({ ok: false, message: expect.stringMatching(/uPath takes SVG path data/) });
    // Refused: nothing changed.
    expect(editor.document.values.uPath).toEqual([20, 20, 300, 200]);
  });
});

describe("handwriting", () => {
  it("writes words as path data in pen order, joined up in script", () => {
    const script = textPath("Hello");
    expect(pathProblem(script)).toBeNull();
    // Joined up: one stroke for the whole word, bar the H's crossbar and lifts within letters.
    expect(script.match(/M/g)!.length).toBeLessThan(5);
    const sans = textPath("Hi", { font: "sans" });
    expect(sans.match(/M/g)!.length).toBe(5); // H: three strokes; i: stem and dot.
    expect(textPath("Hi", { font: "sans", smooth: false })).toMatch(/^M [\d.]+ [\d.]+ L/);
    // Capitals' tops at y = 0 for the size asked.
    const box = pathTexture(textPath("I", { font: "sans", size: 100 }), "none")!.bounds;
    expect(box[1]).toBeCloseTo(0);
    expect(box[3]).toBeCloseTo(100);
  });

  it("refuses words it cannot write, saying which letters", () => {
    expect(textPathProblem("")).toBe("needs some words to write");
    expect(textPathProblem("café ☕")).toBe('can only write printable ASCII letters, digits and punctuation (and line breaks), not "é", "☕"');
    expect(() => textPath("naïve")).toThrow(RangeError);
  });

  it("are taken as words by path controls in values.set, and refused with what to pass", () => {
    const editor = createEffectEditor({ from: "glass-writing" });
    expect(editor.commands.execute("values.set", { values: { uPath: { text: "Hi there", font: "sans", align: "center" } } })).toMatchObject({ ok: true });
    expect(editor.document.values.uPath).toBe(textPath("Hi there", { font: "sans", align: "center" }));
    expect(editor.commands.execute("values.set", { values: { uPath: { text: "Hi", font: "Comic Sans" } } })).toMatchObject({ ok: false, message: `uPath's "font" is "script" or "sans", not "Comic Sans".` });
    expect(editor.commands.execute("values.set", { values: { uPath: { text: "", font: "sans" } } })).toMatchObject({ ok: false, message: 'uPath needs some words to write: pass {"text": "…"}.' });
    expect(editor.commands.execute("values.set", { values: { uPath: { words: "Hi" } } })).toMatchObject({ ok: false, message: 'uPath takes words as {"text", "font", "align"}, not "words".' });
    const schema = editor.commands.execute("values.schema", {}) as { ok: boolean; schema?: { properties: Record<string, { anyOf: unknown[] }> } };
    expect(JSON.stringify(schema)).toContain('"enum":["script","sans"]');
  });
});
