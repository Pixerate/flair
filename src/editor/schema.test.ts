import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { EFFECTS } from "../catalog/index.js";
import { createEffectDocument, parseEffectDocument } from "./document.js";
import { EFFECT_DOCUMENT_SCHEMA } from "./schema.js";
import { callTool, createEffectToolProvider } from "./agent.js";
import { createEffectEditor } from "./editor.js";
import type { JsonSchema } from "../shader/schema.js";

const validate = new Ajv2020({ strict: true, allErrors: true }).compile(EFFECT_DOCUMENT_SCHEMA);
const errors = () => JSON.stringify(validate.errors);

describe("EFFECT_DOCUMENT_SCHEMA", () => {
  it.each(EFFECTS.filter((e) => e.kind !== "camera").map((e) => [e.id]))("takes the document for %s", (id) => {
    const doc = createEffectDocument(id);
    expect(validate(JSON.parse(JSON.stringify(doc))), errors()).toBe(true);
  });

  it("takes a blank document and one with tracks, easings and presets", () => {
    const doc = createEffectDocument();
    doc.values = { uSpeed: 2, uColorA: "#ff0000" };
    doc.tracks = {
      uSpeed: {
        keyframes: [
          { time: 0, value: 1, easing: "ease-in-out" },
          { time: 500, value: 2, easing: { type: "spring", stiffness: 200 } },
          { time: 900, value: 3, easing: { type: "cubic-bezier", x1: 0.2, y1: 0, x2: 0.4, y2: 1 } },
        ],
      },
    };
    doc.presets = [{ name: "Fast", values: { uSpeed: 4 } }];
    expect(validate(JSON.parse(JSON.stringify(doc))), errors()).toBe(true);
  });

  it.each([
    ["an unknown field", { extra: 1 }],
    ["another version", { version: 2 }],
    ["a missing name", { name: undefined }],
    ["a duration of 0", { duration: 0 }],
    ["an unknown kind", { effect: { kind: "video", source: "" } }],
    ["a track without keyframes", { tracks: { uSpeed: {} } }],
    ["a keyframe at a negative time", { tracks: { uSpeed: { keyframes: [{ time: -1, value: 1 }] } } }],
    ["an unknown easing", { tracks: { uSpeed: { keyframes: [{ time: 0, value: 1, easing: "bouncy" }] } } }],
    ["an object value", { values: { uSpeed: { x: 1 } } }],
  ])("refuses %s", (_, change) => {
    const doc = { ...JSON.parse(JSON.stringify(createEffectDocument())), ...change };
    expect(validate(JSON.parse(JSON.stringify(doc)))).toBe(false);
  });

  it("accepts nothing parseEffectDocument refuses", () => {
    const docs = [{}, { version: 1 }, { version: 1, name: "x", effect: { kind: "shader" } }, { version: 1, name: "x", effect: { kind: "vector", motion: {} } }];
    for (const doc of docs) {
      expect(parseEffectDocument(doc).ok).toBe(false);
      expect(validate(doc)).toBe(false);
    }
  });

  it("is published with the build, unchanged", () => {
    // Only after a build (CI tests before it).
    const file = resolve("dist/schemas/effect-document.json");
    if (!existsSync(file)) return;
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(JSON.parse(JSON.stringify(EFFECT_DOCUMENT_SCHEMA)));
  });
});

describe("createEffectDocument", () => {
  it("times a vector effect whose picture times its changes with placeholders", () => {
    // typewriter's `ms` and `delay` are {{control}} placeholders: timed with the defaults filled in, not NaN.
    expect(createEffectDocument("typewriter").duration).toBeGreaterThan(600);
  });
});

describe("values.schema, as an agent calls it", () => {
  it("gives the current effect's values schema, which values.set agrees with", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    const called = await callTool(provider, "run_command", { id: "values.schema" });
    const schema = (called.structuredContent as { result: JsonSchema }).result;
    expect(schema).toMatchObject({ type: "object", additionalProperties: false, title: "Aurora controls" });
    const check = new Ajv2020({ strict: true }).compile(schema);
    const speed = Object.keys(schema.properties!).find((n) => schema.properties![n]!.type === "number")!;
    const max = schema.properties![speed]!.maximum!;
    expect(check({ [speed]: max })).toBe(true);
    expect(editor.commands.execute("values.set", { values: { [speed]: max } })).toMatchObject({ ok: true });
    expect(check({ uNope: 1 })).toBe(false);
    expect(editor.commands.execute("values.set", { values: { uNope: 1 } })).toMatchObject({ ok: false });
  });

  it("refuses parameters, as it takes none", async () => {
    const provider = createEffectToolProvider(createEffectEditor({ from: "aurora" }));
    const called = await callTool(provider, "run_command", { id: "values.schema", params: { id: "aurora" } });
    expect(called.isError).toBe(true);
  });

  it("lets a vector effect's colours follow the text", () => {
    const editor = createEffectEditor({ from: "typewriter" });
    const result = editor.commands.execute<JsonSchema>("values.schema");
    expect(JSON.stringify(result.ok && result.result)).toContain('"const":"currentColor"');
  });
});
