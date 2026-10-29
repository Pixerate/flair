import { describe, expect, it } from "vitest";
import { drawsAlpha, effectControls, effectDefaults, EFFECTS, getEffect } from "../catalog/index.js";
import { BACKGROUND_OPACITY_CONTROL, takesBackgroundOpacity, withBackgroundOpacity } from "./background.js";
import { parseControls } from "./controls.js";

const SOURCE = [
  'uniform vec3 uBackground; // @control color default=#09090B label="Background"',
  'uniform vec3 uNeon;       // @control color default=#FF2BD6 label="Neon"',
  "void mainImage(out vec4 fragColor, in vec2 fragCoord) {",
  "  fragColor = vec4(uBackground + uNeon * 0.5, 1.0);",
  "}",
  "",
].join("\n");

/** The key in the shader, in JavaScript: what `flair_backgroundOpacity` returns for one pixel. */
function key(c: number[], bg: number[], opacity: number): number[] {
  if (opacity >= 1) return c;
  const d = c.slice(0, 3).map((v, i) => Math.min(1, Math.max(0, v)) - bg[i]!);
  const k = d.map((v, i) => Math.abs(v) / Math.max(v >= 0 ? 1 - bg[i]! : bg[i]!, 1e-4));
  const a = Math.min(1, Math.max(0, ...k));
  const fg = d.map((v, i) => (a > 0 ? bg[i]! + v / a : bg[i]!));
  const alpha = a + opacity * (1 - a);
  const col = fg.map((v, i) => (alpha > 0 ? (v * a + bg[i]! * opacity * (1 - a)) / alpha : bg[i]!));
  return [...col, alpha * c[3]!];
}

describe("withBackgroundOpacity", () => {
  it("adds a Background opacity control (default 1) after the source, keeping its line numbers", () => {
    const out = withBackgroundOpacity(SOURCE);
    const lines = SOURCE.split("\n");
    expect(out.split("\n").slice(0, lines.length - 1)).toEqual(lines.slice(0, -1).map((l) => l.replace("mainImage", "flair_opaqueImage")));
    expect(parseControls(out).find((c) => c.name === BACKGROUND_OPACITY_CONTROL)).toMatchObject({ type: "float", min: 0, max: 1, default: 1, label: "Background opacity" });
    expect(out.match(/void mainImage\(/g)).toHaveLength(1);
    expect(withBackgroundOpacity(out)).toBe(out);
  });

  it("leaves sources without a background colour, or with an opacity of their own, alone", () => {
    const plain = "void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }";
    expect(takesBackgroundOpacity(plain)).toBe(false);
    expect(withBackgroundOpacity(plain)).toBe(plain);
    const own = `${SOURCE}uniform float uBackgroundAlpha; // @control min=0 max=1 default=0`;
    expect(withBackgroundOpacity(own)).toBe(own);
    const notColour = SOURCE.replace("@control color default=#09090B", "@control default=0.5");
    expect(withBackgroundOpacity(notColour)).toBe(notColour);
  });

  it("keys the background out: light over it keeps its hue, the background itself goes", () => {
    const bg = [0, 0, 0];
    expect(key([0, 0, 0, 1], bg, 0)[3]).toBe(0);
    const glow = key([0.5, 0.1, 0.4, 1], bg, 0);
    expect(glow[3]).toBeCloseTo(0.5);
    expect(glow.slice(0, 3).map((v) => v * glow[3]!)).toEqual([0.5, 0.1, 0.4].map((v) => expect.closeTo(v, 6)));
    // Over its own background it gives the frame back, at any opacity.
    const grey = [0.2, 0.3, 0.25];
    for (const opacity of [0, 0.4, 1]) {
      const [r, g, b, a] = key([0.6, 0.5, 0.25, 1], grey, opacity);
      const over = [r!, g!, b!].map((v, i) => v * a! + grey[i]! * (1 - a!));
      expect(over).toEqual([0.6, 0.5, 0.25].map((v) => expect.closeTo(v, 6)));
    }
  });

  it("gives catalog effects with a background colour the control, so they can draw alpha", () => {
    const ripple = getEffect("neon-ripple")!;
    expect(effectDefaults(ripple)[BACKGROUND_OPACITY_CONTROL]).toBe(1);
    expect(drawsAlpha(ripple)).toBe(true);
    expect(drawsAlpha(ripple, { [BACKGROUND_OPACITY_CONTROL]: 1 })).toBe(false);
    expect(drawsAlpha(ripple, { [BACKGROUND_OPACITY_CONTROL]: 0 })).toBe(true);
    for (const effect of EFFECTS) {
      if (effect.kind !== "shader") continue;
      const named = effectControls(effect).filter((c) => c.name === BACKGROUND_OPACITY_CONTROL);
      expect(named.length, effect.id).toBeLessThanOrEqual(1);
      if (effectControls(effect).some((c) => c.name === "uBackground" && c.color)) expect(named, effect.id).toHaveLength(1);
    }
  });
});
