import { describe, expect, it, vi } from "vitest";
import { FakeGl, type FakeGlOptions } from "../testing/fake-gl.js";
import { scenePlan } from "../scene/plan.js";
import type { Scene } from "../scene/types.js";
import { SceneCompositor } from "./compositor.js";
import { sceneRecordingPlan } from "./scene.js";

const SHADER = "uniform float speed; // @control min=0 max=4 default=1\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(speed); }";

const scene: Scene = {
  name: "composite",
  stage: { width: 320, height: 180 },
  shots: [
    {
      hold: 400,
      title: "One",
      run: [{ type: "element", element: { id: "card", type: "rectangle", x: 40, y: 40, width: 100, height: 60, text: "Card" } }],
      layers: [
        { id: "bg", source: SHADER, until: { shots: 2 } },
        { id: "over", source: SHADER, role: "overlay", rect: { x: 0, y: 0, width: 50, height: 50 } },
      ],
    },
    { hold: 400, transition: { effect: "transition-wipe", ms: 200 } },
  ],
};

/** Fake WebGL2 contexts, and 2D contexts that take any call and record them in order (the canvas first). */
function fakeCanvases(options: FakeGlOptions = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const gl: FakeGl[] = [];
  const contexts = new Map<HTMLCanvasElement, unknown>();
  const make = (canvas: HTMLCanvasElement) =>
    new Proxy(
      { canvas, measureText: (t: string) => ({ width: t.length * 10 }), getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) } as Record<string, unknown>,
      {
        get(target, key: string) {
          if (key in target) return target[key];
          return (...args: unknown[]) => calls.push({ name: key, args: [canvas, ...args] });
        },
        set(target, key: string, value) {
          target[key] = value;
          return true;
        },
      },
    );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, attributes?: unknown) {
    if (!contexts.has(this)) {
      if (kind === "webgl2") gl.push(new FakeGl(options, attributes) as never);
      contexts.set(this, kind === "webgl2" ? gl.at(-1) : make(this));
    }
    return contexts.get(this) as never;
  } as never);
  return { calls, gl };
}

describe("SceneCompositor", () => {
  it("draws background layers, the board, then overlays and words, each shader at the layer's time", async () => {
    const { calls, gl } = fakeCanvases();
    const plan = await scenePlan(scene);
    const compositor = new SceneCompositor(plan);
    await compositor.ready();
    expect(compositor.width).toBe(320);
    // Two layers and the transition each compile a shader.
    expect(gl).toHaveLength(3);

    calls.length = 0;
    await compositor.draw(200);
    const out = calls.filter((c) => c.args[0] === compositor.canvas).map((c) => c.name);
    const firstImage = out.indexOf("drawImage");
    expect(firstImage).toBeGreaterThan(out.indexOf("fillRect"));
    // The card is drawn after the background and before the overlay.
    const card = out.indexOf("rect");
    expect(card).toBeGreaterThan(firstImage);
    expect(out.lastIndexOf("drawImage")).toBeGreaterThan(card);
    expect(out).toContain("fillText");
    compositor.dispose();
  });

  it("blends the last frame into the next shot through the transition, with its progress", async () => {
    const { calls } = fakeCanvases();
    const plan = await scenePlan(scene);
    const compositor = new SceneCompositor(plan, { words: false });
    await compositor.ready();
    calls.length = 0;
    await compositor.draw(500);
    // The outgoing frame and the incoming shot are each drawn on their own canvas, then the transition over the output.
    const canvases = new Set(calls.filter((c) => c.name === "fillRect").map((c) => c.args[0]));
    expect(canvases.size).toBe(2);
    expect(canvases.has(compositor.canvas)).toBe(false);
    const onOutput = calls.filter((c) => c.args[0] === compositor.canvas && c.name === "drawImage");
    expect(onOutput).toHaveLength(1);
    compositor.dispose();
  });

  it("refuses a plan of another version, saying how to make one", async () => {
    const plan = { ...(await scenePlan(scene)), version: 2 as never };
    expect(() => new SceneCompositor(plan)).toThrow(/version 1; this one is version 2\. Make it again with scenePlan/);
  });

  it("names the layer whose shader does not compile", async () => {
    fakeCanvases({ failMarker: "oops", compileLog: "ERROR: 0:3: 'oops' : syntax error" });
    const plan = await scenePlan({ name: "broken", shots: [{ layers: [{ id: "bad", source: `${SHADER}\n// oops` }] }] });
    const compositor = new SceneCompositor(plan);
    await expect(compositor.ready()).rejects.toThrow(/Layer "bad" cannot be drawn/);
    compositor.dispose();
  });
});

describe("sceneRecordingPlan", () => {
  it("records the whole scene at the stage's size by default", async () => {
    const rec = await sceneRecordingPlan(scene, { format: "gif", fps: 10 });
    expect({ ...rec, plan: undefined }).toMatchObject({ format: "gif", width: 320, height: 180, fps: 10, duration: 1, frames: 10, alpha: false });
    expect(rec.plan.layers.map((l) => l.key)).toEqual(["bg", "over"]);
  });

  it("refuses options out of range with what they should be", async () => {
    await expect(sceneRecordingPlan(scene, { format: "gif", fps: 0 })).rejects.toThrow(/fps must be a number above 0/);
    await expect(sceneRecordingPlan(scene, { format: "gif", duration: -1 })).rejects.toThrow(/duration must be a number above 0/);
    await expect(sceneRecordingPlan(scene, { format: "mov" as never })).rejects.toThrow(/format is one of "mp4", "webm", "gif" or "png"/);
  });
});
