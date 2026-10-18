import { describe, expect, it } from "vitest";
import { svgMotionIssues } from "../vector/motion.js";
import { callTool, createEffectToolProvider } from "./agent.js";
import { effectDocumentFromAnimation } from "./animation.js";
import { createEffectEditor } from "./editor.js";

const SCENE = {
  version: 1,
  name: "Badge pop",
  artwork: {
    width: 100,
    height: 100,
    nodes: [
      { id: "badge", type: "path", fill: "#f43f5e", subpaths: [{ closed: true, anchors: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }] }] },
    ],
  },
  controls: [{ name: "accent", type: "color", default: "#f43f5e", label: "Badge colour" }],
  presets: [{ name: "Ocean", values: { accent: "#0ea5e9" } }],
  loop: "loop",
  shots: [{ id: "in", run: [{ type: "enter", targets: ["badge"], duration: 500 }, { type: "move", targets: ["badge"], by: { x: 10, y: 0 } }] }],
};

describe("animation-editor scenes", () => {
  it("become vector effect documents with their controls and presets", () => {
    const imported = effectDocumentFromAnimation(SCENE);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const { document } = imported;
    expect(document).toMatchObject({ name: "Badge pop", loop: true, values: { accent: "#f43f5e" }, presets: [{ name: "Ocean", values: { accent: "#0ea5e9" } }] });
    expect(document.effect.kind).toBe("vector");
    if (document.effect.kind !== "vector") return;
    expect(document.effect.motion.svg).toContain("{{accent: color default=#F43F5E label='Badge colour'}}");
    expect(svgMotionIssues(document.effect.motion)).toEqual([]);
    expect(document.duration).toBe(500 + 700 + 600);
  });

  it("refuse malformed scenes and scenes with errors, saying why", () => {
    const malformed = effectDocumentFromAnimation({ ...SCENE, shots: [{ id: "in", run: [{ type: "entr", targets: ["badge"] }] }] });
    expect(!malformed.ok && malformed.message).toContain('did you mean "enter"');
    const unknown = effectDocumentFromAnimation({ ...SCENE, shots: [{ id: "in", run: [{ type: "enter", targets: ["bdge"] }] }] });
    expect(!unknown.ok && unknown.message).toContain('did you mean "badge"');
    expect(effectDocumentFromAnimation("{").ok).toBe(false);
  });

  it("load through effect.loadAnimation as one undo step", async () => {
    const editor = createEffectEditor();
    const provider = createEffectToolProvider(editor);
    const loaded = await callTool(provider, "run_command", { id: "effect.loadAnimation", params: { scene: SCENE } });
    expect(loaded.isError).toBeFalsy();
    expect(editor.getState().document.name).toBe("Badge pop");
    expect(editor.getState().controls.map((c) => c.name)).toEqual(["accent"]);
    const refused = await callTool(provider, "run_command", { id: "effect.loadAnimation", params: { scene: { ...SCENE, shots: [{ id: "x", run: [{ type: "fade", targets: ["nope"], to: 0 }] }] } } });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).toContain("There is no node");
    expect(editor.getState().document.name).toBe("Badge pop");
    expect(editor.undo()).toBe(true);
    expect(editor.getState().document.name).not.toBe("Badge pop");
    editor.dispose();
  });
});
