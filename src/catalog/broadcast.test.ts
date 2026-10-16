import { describe, expect, it } from "vitest";
import { svgAnimatedMarkup } from "../vector/animated.js";
import { svgFrame, svgMotionIssues } from "../vector/motion.js";
import { svgDuration } from "../vector/svg.js";
import { annotationEffects } from "./annotation.js";
import { broadcastEffects } from "./broadcast.js";
import { effectControls, effectDefaults, effectInputs, findEffects, getEffect, renderVectorEffect } from "./index.js";
import type { VectorEffect } from "./types.js";

const effects: VectorEffect[] = [...broadcastEffects, ...annotationEffects];
const render = (id: string, values: Record<string, unknown> = {}) => {
  const effect = getEffect(id) as VectorEffect;
  return renderVectorEffect(effect, { ...effectDefaults(effect), ...values } as never);
};
const prefix = (id: string) => id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

describe("broadcast and annotation effects", () => {
  it("has the titles, logos, cards, ticker and score bug, and the hand-drawn and product-demo annotations", () => {
    expect(findEffects({ category: "broadcast" }).map((e) => e.id)).toEqual(broadcastEffects.map((e) => e.id));
    expect(findEffects({ category: "annotation" }).map((e) => e.id)).toEqual(annotationEffects.map((e) => e.id));
    expect(broadcastEffects.map((e) => e.id)).toEqual(["lower-third", "lower-third-stacked", "title-card", "logo-reveal", "logo-sting", "end-card", "countdown", "subscribe-button", "news-ticker", "scoreboard", "chapter-marker"]);
    expect(annotationEffects.map((e) => e.id)).toEqual(["hand-circle", "hand-arrow", "callout", "bracket-note", "scribble-out", "step-badges", "focus-box", "fake-cursor", "tooltip-tour"]);
    for (const e of effects) {
      expect(e.tags, e.id).toContain(e.category);
      expect(e.presets?.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(effects.map((e) => [e.id, e] as const))("%s is a 16:9 frame, its ids prefixed, and exports as an animated SVG with every preset", (_, effect) => {
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(motion.svg).toMatch(/^<svg viewBox="0 0 1920 1080"/);
    for (const [, name] of motion.svg.matchAll(/\sid="([^"]+)"/g)) expect(name).toMatch(new RegExp(`^${prefix(effect.id)}`));
    for (const preset of [undefined, ...(effect.presets ?? []).map((p) => p.name)]) {
      const m = renderVectorEffect(effect, effectDefaults(effect, { preset }));
      expect(svgMotionIssues(m), preset).toEqual([]);
      const file = svgAnimatedMarkup(m, { hold: effect.hold });
      expect(file, preset).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(file).not.toMatch(/NaN|undefined|\{\{|Infinity/);
    }
  });

  it.each(effects.flatMap((e) => effectControls(e).filter((c) => c.type === "text" && !/font/i.test(c.label)).map((c) => [e.id, c.name, e] as const)))(
    "%s fits short, long and unusual %s",
    (_, name, effect) => {
      for (const word of ["A", "Supercalifragilisticexpialidocious & <co> and then some more words besides", "Café 日本 🎉", ""]) {
        const motion = renderVectorEffect(effect, { ...effectDefaults(effect), [name]: word });
        expect(svgMotionIssues(motion)).toEqual([]);
        expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined|Infinity/);
        expect(svgAnimatedMarkup(motion)).toBeDefined();
      }
    },
  );

  it.each(effects.filter((e) => e.id !== "news-ticker").map((e) => [e.id, e] as const))("%s holds for its hold control, then animates out", (_, effect) => {
    const at = (hold: number) => render(effect.id, { hold });
    // Tours and spotlights hold at each of their stops.
    const stops = { "focus-box": 3, "tooltip-tour": 3 }[effect.id] ?? 1;
    expect(svgDuration(at(5)) - svgDuration(at(2))).toBe(3000 * stops);
    // The last change to start is the way out, after the hold.
    const motion = at(2);
    const last = Math.max(...motion.animate!.map((a) => a.delay ?? 0));
    expect(last, effect.id).toBeGreaterThanOrEqual(2000);
  });

  it("news ticker crawls exactly one repeat of its text per loop, at its speed, and the frame stays full", () => {
    for (const text of ["Short", "A much longer headline that runs across most of the frame and then some more"]) {
      const motion = render("news-ticker", { text, speed: 200 });
      const crawl = motion.animate!.find((a) => a.id === "newsTickerCrawl")!;
      const repeat = -Number(/translate\((-?[\d.]+)/.exec(String(crawl.attrs!.transform![1]))![1]);
      const xs = [...motion.svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-family="[^"]*" font-size="36"/g)].map((m) => Number(m[1]));
      expect(xs.length).toBe(8);
      expect(xs[1]! - xs[0]!).toBeCloseTo(repeat, 0);
      expect(crawl.ms).toBe(Math.round((repeat / 200) * 1000));
      expect(svgDuration(motion)).toBe(crawl.ms);
      expect(xs[xs.length - 1]! - repeat).toBeGreaterThan(1920);
    }
  });

  it("countdown writes every number from its start down to zero, a step apart", () => {
    const motion = render("countdown", { from: 5 });
    const writes = motion.animate!.filter((a) => a.write !== undefined);
    expect([...new Set(writes.map((w) => w.write))]).toEqual(["5", "4", "3", "2", "1", "0"]);
    expect([...new Set(writes.map((w) => w.delay))]).toEqual([300, 1300, 2300, 3300, 4300, 5300]);
    const half = render("countdown", { from: 3, step: 0.5 }).animate!.filter((a) => a.write !== undefined);
    expect([...new Set(half.map((w) => w.delay))]).toEqual([300, 800, 1300, 1800]);
    // The ring is full until the first step, and empty from zero on.
    const ring = (ms: number) => svgFrame(motion.animate!, [], ms).get("countdownRing")!.draw;
    expect(ring(0)).toBe(1);
    expect(ring(5300 + 100)).toBe(0);
  });

  it("scoreboard counts its scores up and ticks its clock, down when asked", () => {
    const up = render("scoreboard", { homeScore: 3, awayScore: 1, minutes: 9, seconds: 58 });
    expect(up.animate!.filter((a) => a.count).map((a) => a.count)).toEqual([[0, 3], [0, 1]]);
    expect([...new Set(up.animate!.filter((a) => a.write).map((a) => a.write))].slice(0, 4)).toEqual(["9:58", "9:59", "10:00", "10:01"]);
    const down = render("scoreboard", { minutes: 0, seconds: 2, countDown: true });
    expect([...new Set(down.animate!.filter((a) => a.write).map((a) => a.write))]).toEqual(["0:02", "0:01", "0:00"]);
  });

  it("takes a logo as SVG path data, fitted to its slot, and draws a stand-in mark for anything else", () => {
    for (const id of ["lower-third-stacked", "logo-reveal", "logo-sting"]) {
      const effect = getEffect(id) as VectorEffect;
      expect(effectInputs(effect).texts.find((t) => t.name === "logo")?.holds, id).toBe("path");
      expect(effectInputs(effect).accepts, id).toEqual(["text", "path"]);
      const heart = render(id, { logo: "M12 21 C3 14 2 9 5 6 C8 3 11 5 12 7 C13 5 16 3 19 6 C22 9 21 14 12 21 Z" });
      expect(heart.svg).toContain('d="M12 21 C3 14');
      expect(render(id, { logo: "not a path" }).svg).not.toContain("not a path");
    }
  });

  it("annotations draw on a transparent frame, placed by percent", () => {
    for (const effect of annotationEffects) expect(renderVectorEffect(effect).svg.replace(/<mask[\s\S]*?<\/mask>/g, ""), effect.id).not.toMatch(/<rect width="1920" height="1080" fill="#/);
    const circle = render("hand-circle", { x: 25, y: 75, w: 10, h: 10 });
    const [x, y] = /d="M([\d.]+) ([\d.]+)/.exec(circle.svg)!.slice(1).map(Number);
    expect(Math.hypot(x! - 480, y! - 810)).toBeLessThan(140);
  });

  it("focus box with two stops stays on the second", () => {
    const motion = render("focus-box", { stops: 2 });
    const end = svgFrame(motion.animate!, [], svgDuration(motion)).get("focusBoxHole")!.attrs;
    const second = svgFrame(motion.animate!, [], 500 + 1500 + 700).get("focusBoxHole")!.attrs;
    expect(end).toEqual(second);
  });
});
