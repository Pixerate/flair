import { describe, expect, it } from "vitest";
import { frame, projectPoint, type Stage, type View } from "../scene/camera.js";
import { cameraEffects, cameraPreviewValues, cameraPreviewView, getCameraMove, screenToScene } from "./camera.js";
import { effectControls, effectDefaults, effectDuration, effectInputs, effectMeta, findEffects, getEffect } from "./index.js";

const stage: Stage = { width: 1920, height: 1080, caption: 0 };
const from = frame({ x: 0, y: 0, width: 1920, height: 1080 }, stage);
const to: View = { ...frame({ x: 900, y: 300, width: 800, height: 450 }, stage), tilt: 20 };
const at = (id: string, u: number, values: Record<string, number> = {}, ms?: number) => {
  const move = getCameraMove(id)!;
  return move.motion.view({ from, to, u, stage, ms: ms ?? move.motion.duration }, { ...effectDefaults(move), ...values });
};

describe("camera moves", () => {
  it("are in the catalog as their own kind, in the camera category", () => {
    expect(findEffects({ kind: "camera" }).map((e) => e.id)).toEqual(cameraEffects.map((e) => e.id));
    expect(findEffects({ category: "camera" })).toHaveLength(cameraEffects.length);
    expect(findEffects({ kind: "camera", role: "hold" }).map((e) => e.id)).toEqual(["camera-ken-burns", "camera-crash-zoom"]);
    expect(findEffects({ text: "whip" }).map((e) => e.id)).toContain("camera-whip-pan");
  });

  it.each(cameraEffects.map((e) => [e.id, e] as const))("%s has controls, metadata and presets that agree", (id, move) => {
    expect(getEffect(id)).toBe(move);
    const meta = effectMeta(move);
    expect(meta).toMatchObject({ kind: "camera", role: move.motion.role, duration: move.motion.duration, animated: true });
    expect(effectDuration(move)).toBe(move.motion.duration);
    expect(effectInputs(move)).toMatchObject({ accepts: ["image", "video", "svg"], images: [{ name: "uImage", wants: "picture" }] });
    const names = effectControls(move).map((c) => c.name);
    for (const preset of move.presets ?? []) expect(Object.keys(preset.values).every((n) => names.includes(n)), preset.name).toBe(true);
  });

  it.each(cameraEffects.filter((e) => e.motion.role === "transition").map((e) => [e.id]))("%s arrives on the next framing, unblurred", (id) => {
    expect(at(id, 1)).toEqual(to);
  });

  it("a glide starts on the last framing and passes through the middle", () => {
    expect(at("camera-glide", 0)).toMatchObject({ zoom: from.zoom, scrollX: from.scrollX, scrollY: from.scrollY });
    const mid = at("camera-glide", 0.5);
    expect(mid.zoom).toBeGreaterThan(from.zoom);
    expect(mid.zoom).toBeLessThan(to.zoom);
    expect(mid.blur).toBeUndefined();
    expect(at("camera-glide", 0.5, { motionBlur: 1 }).blur).toBeGreaterThan(0);
  });

  it("a whip streaks hardest at the cut, and a punch zooms in to its punch", () => {
    expect(at("camera-whip-pan", 0.49).blur!).toBeGreaterThan(at("camera-whip-pan", 0.2).blur ?? 0);
    expect(at("camera-whip-pan", 0.49).blurAngle).toBeDefined();
    expect(at("camera-punch-zoom", 0.4999).zoom / from.zoom).toBeCloseTo(3, 1);
    expect(at("camera-punch-zoom", 0.4999, { punch: 5 }).zoom / from.zoom).toBeCloseTo(5, 1);
    expect(at("camera-cut", 0)).toBe(to);
  });

  // The moves the scene camera used to have built in (move, whip, zoom, cut) play just as they did:
  // these views were taken from the old `transitionView` before it was replaced.
  it("play as the scene camera's old built-in transitions did", () => {
    const round = (v: View) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, Math.round(n * 1e4) / 1e4]));
    const views = (id: string, blur: number) => [0.25, 0.49, 0.51, 0.75].map((u) => round(at(id, u, { motionBlur: blur, punch: 1 + blur })));
    expect({
      glide: views("camera-glide", 0),
      glideBlurred: views("camera-glide", 1.5),
      whip: views("camera-whip-pan", 2),
      punch: views("camera-punch-zoom", 2),
    }).toMatchInlineSnapshot(`
      {
        "glide": [
          {
            "scrollX": -72.3669,
            "scrollY": -27.8158,
            "tilt": 1.25,
            "zoom": 1.0562,
          },
          {
            "scrollX": -484.1663,
            "scrollY": -175.2831,
            "tilt": 9.4119,
            "zoom": 1.5098,
          },
          {
            "scrollX": -536.0684,
            "scrollY": -192.3489,
            "tilt": 10.5881,
            "zoom": 1.5896,
          },
          {
            "scrollX": -856.2534,
            "scrollY": -288.2832,
            "tilt": 18.75,
            "zoom": 2.2722,
          },
        ],
        "glideBlurred": [
          {
            "blur": 27.967,
            "scrollX": -72.3669,
            "scrollY": -27.8158,
            "tilt": 1.25,
            "zoom": 1.0562,
          },
          {
            "blur": 40,
            "scrollX": -484.1663,
            "scrollY": -175.2831,
            "tilt": 9.4119,
            "zoom": 1.5098,
          },
          {
            "blur": 40,
            "scrollX": -536.0684,
            "scrollY": -192.3489,
            "tilt": 10.5881,
            "zoom": 1.5896,
          },
          {
            "blur": 40,
            "scrollX": -856.2534,
            "scrollY": -288.2832,
            "tilt": 18.75,
            "zoom": 2.2722,
          },
        ],
        "punch": [
          {
            "blur": 13.972,
            "scrollX": -123.1819,
            "scrollY": -69.2898,
            "zoom": 1.1472,
          },
          {
            "blur": 40,
            "scrollX": -618.6432,
            "scrollY": -347.9868,
            "zoom": 2.8123,
          },
          {
            "blur": 40,
            "scrollX": -1157.768,
            "scrollY": -444.9945,
            "tilt": 20,
            "zoom": 6.7495,
          },
          {
            "blur": 23.816,
            "scrollX": -951.3258,
            "scrollY": -328.8708,
            "tilt": 20,
            "zoom": 2.7533,
          },
        ],
        "whip": [
          {
            "blur": 25.436,
            "blurAngle": 177.474,
            "scrollX": -239.7668,
            "scrollY": 10.5779,
            "zoom": 1,
          },
          {
            "blur": 40,
            "blurAngle": 177.474,
            "scrollX": -1805.3326,
            "scrollY": 79.647,
            "zoom": 1,
          },
          {
            "blur": 40,
            "blurAngle": 177.474,
            "scrollX": -147.7781,
            "scrollY": -333.1863,
            "tilt": 20,
            "zoom": 2.4,
          },
          {
            "blur": 40,
            "blurAngle": 177.474,
            "scrollX": -800.0972,
            "scrollY": -304.4075,
            "tilt": 20,
            "zoom": 2.4,
          },
        ],
      }
    `);
  });

  it("a Ken Burns drift zooms from its start to its end while keeping the framing's angle", () => {
    const start = at("camera-ken-burns", 0, {}, 4000);
    const end = at("camera-ken-burns", 1, {}, 4000);
    expect(start.zoom).toBeCloseTo(to.zoom * 1, 6);
    expect(end.zoom).toBeCloseTo(to.zoom * 1.25, 6);
    expect(end.tilt).toBe(20);
  });

  it("a crash zoom rests, steps in on its target and ends on it", () => {
    const rest = at("camera-crash-zoom", 0.1, {}, 2000);
    expect(rest.zoom).toBeCloseTo(to.zoom, 6);
    const end = at("camera-crash-zoom", 1, { shake: 0 }, 2000);
    expect(end.zoom / to.zoom).toBeCloseTo(3.4, 3);
    // It zooms in about the target, which stays where it was on screen.
    const target = [900 + 0.5 * 800, 300 + 0.42 * 450] as const;
    const flat = (v: View): View => ({ ...v, tilt: 0 });
    expect(projectPoint(flat(end), stage, target)![1]).toBeCloseTo(projectPoint(flat(to), stage, target)![1], 6);
  });
});

describe("camera previews", () => {
  it("map each point on screen back to the scene point the view shows there", () => {
    for (const view of [from, to, { ...to, turn: -30, roll: 10, perspective: 0.8 }]) {
      const h = screenToScene(view, stage);
      for (const p of [[100, 200], [960, 540], [1500, 900]] as const) {
        const s = projectPoint(view, stage, p)!;
        const v = [0, 1, 2].map((i) => h[i]![0] * s[0] + h[i]![1] * s[1] + h[i]![2]);
        expect(v[0]! / v[2]!).toBeCloseTo(p[0], 6);
        expect(v[1]! / v[2]!).toBeCloseTo(p[1], 6);
      }
    }
  });

  it("rest on the whole picture, move to a detail and rest there", () => {
    const whip = getCameraMove("camera-whip-pan")!;
    const values = effectDefaults(whip);
    const start = cameraPreviewView(whip, values, 0, 16 / 9);
    expect(start.view.zoom).toBeCloseTo(1, 6);
    expect(cameraPreviewView(whip, values, 1600, 16 / 9).view.zoom).toBeCloseTo(2.5, 6);
    expect(cameraPreviewValues(whip, values, 0, 16 / 9)).toMatchObject({ uBlur: 0, uBlurDir: [0, 0] });
    expect(cameraPreviewValues(whip, values, 790, 16 / 9).uBlur).toBeGreaterThan(0);
  });
});
