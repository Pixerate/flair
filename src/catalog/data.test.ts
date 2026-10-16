import { describe, expect, it } from "vitest";
import { svgAnimatedMarkup } from "../vector/animated.js";
import { svgFrame, svgMotionIssues, type SvgMotion } from "../vector/motion.js";
import { svgDuration } from "../vector/svg.js";
import { dataEffects, decimalsOf, fitLabel, parseLabels, parseNumberList, parseRace, parseSeries, parseShares } from "./data.js";
import { iconEffects } from "./icons.js";
import { effectControls, effectDefaults, effectInputs, findEffects, getEffect, renderVectorEffect, type VectorEffect } from "./index.js";

const ALL = [...dataEffects, ...iconEffects];
const render = (id: string, values: Record<string, unknown> = {}) => {
  const effect = getEffect(id) as VectorEffect;
  return renderVectorEffect(effect, effectDefaults(effect, { values: values as never }));
};
const frame = (motion: SvgMotion, ms: number, steps: number[] = []) => JSON.stringify([...svgFrame(motion.animate!, steps, ms)].sort());
const prefix = (id: string) => id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const clean = (motion: SvgMotion) => {
  expect(svgMotionIssues(motion)).toEqual([]);
  expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined|Infinity/);
};

const BAD = ["", "abc", ",,,", "-5,-2", "1e400", "Café 日本 🎉 & <b>", "$12, 45%, 3.5k", "x".repeat(300), "0,0,0", "A:;B:x", ";;"];

describe("data and icon effects", () => {
  it("are all in the catalog, in their categories", () => {
    expect(findEffects({ category: "data" }).map((e) => e.id)).toEqual(
      expect.arrayContaining(["donut-chart", "pie-chart", "gauge", "bar-race", "sparkline", "leaderboard", "area-chart", "kpi-tile"]),
    );
    expect(findEffects({ category: "icon" }).map((e) => e.id)).toEqual(
      expect.arrayContaining(["weather-icons", "notification-bell", "animated-arrows", "emoji-reactions", "bookmark-star", "trash-delete", "lock-unlock", "wifi-signal"]),
    );
    for (const effect of dataEffects) expect(effect.category).toBe("data");
    for (const effect of iconEffects) expect(effect.category).toBe("icon");
  });

  it.each(ALL.map((e) => [e.id, e] as const))("%s prefixes every id with its name and animates something", (id, effect) => {
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    clean(motion);
    for (const [, name] of motion.svg.matchAll(/\sid="([^"]+)"/g)) expect(name, id).toMatch(new RegExp(`^${prefix(id)}`));
    // Hovers play to a different end; clicks and loops may come back to how they started, so look halfway.
    const steps = effect.trigger === "click" ? [0] : [];
    const at = effect.trigger === "click" ? 400 : effect.trigger === "hover" ? svgDuration(motion) : svgDuration(motion) / 2;
    expect(frame(motion, at, steps)).not.toBe(frame(motion, 0, steps));
  });

  it.each(ALL.map((e) => [e.id, e] as const))("%s exports to an animated SVG with every preset", (_, effect) => {
    for (const preset of [undefined, ...(effect.presets ?? []).map((p) => p.name)]) {
      const motion = renderVectorEffect(effect, effectDefaults(effect, { preset }));
      clean(motion);
      const markup = svgAnimatedMarkup(motion, { hold: effect.hold, steps: effect.trigger === "click" ? [1500, 3000] : [] })!;
      expect(markup).toMatch(/<animate/);
      expect(markup).not.toMatch(/<script|\son\w+=/i);
      expect(new DOMParser().parseFromString(markup, "image/svg+xml").querySelector("parsererror")).toBeNull();
    }
  });

  it.each(ALL.flatMap((e) => effectControls(e).filter((c) => c.type === "text").map((c) => [e.id, c.name] as const)))(
    "%s takes any %s, readable or not",
    (id, name) => {
      for (const text of BAD) clean(render(id, { [name]: text }));
    },
  );

  it.each(ALL.flatMap((e) => effectControls(e).filter((c) => c.type === "int" || c.type === "float").map((c) => [e.id, c.name, c] as const)))(
    "%s takes %s at its limits",
    (id, name, control) => {
      for (const value of [control.min, control.max, (control.min + control.max) / 2]) clean(render(id, { [name]: value }));
    },
  );

  it("tags only the pointer-driven icons interactive", () => {
    for (const effect of ALL) expect(effect.tags.includes("interactive"), effect.id).toBe(effectInputs(effect).interactions.length > 0);
    expect(getEffect("emoji-reactions")).toMatchObject({ trigger: "hover" });
    expect(getEffect("bookmark-star")).toMatchObject({ trigger: "hover" });
    expect(getEffect("trash-delete")).toMatchObject({ trigger: "click" });
    expect(getEffect("lock-unlock")).toMatchObject({ trigger: "click" });
  });

  it("trash replays on each click, ending as it started; the lock toggles over two", () => {
    const trash = render("trash-delete");
    expect(trash.animate!.every((a) => a.step === 1)).toBe(true);
    expect(frame(trash, 400, [0])).not.toBe(frame(trash, 0, []));
    expect(frame(trash, 10000, [0])).toBe(frame(trash, 0, []));
    const lock = render("lock-unlock");
    expect(lock.animate!.every((a) => a.step === 1 || a.step === 2)).toBe(true);
    expect(frame(lock, 5000, [0])).not.toBe(frame(lock, 0, []));
    expect(frame(lock, 10000, [0, 5000])).toBe(frame(lock, 0, []));
  });

  it("hover icons rest with nothing shown and play to a different end", () => {
    for (const id of ["emoji-reactions", "bookmark-star"]) {
      const motion = render(id);
      expect(motion.animate!.every((a) => (a.step ?? 0) === 0)).toBe(true);
      expect(frame(motion, svgDuration(motion))).not.toBe(frame(motion, 0));
    }
  });

  it("looping icons end where they start", () => {
    for (const id of ["weather-icons", "animated-arrows", "wifi-signal", "notification-bell"])
      for (let kind = 0; kind < 7; kind++) {
        const motion = render(id, { kind });
        const end = new Map(svgFrame(motion.animate!, [], svgDuration(motion)));
        const start = new Map(svgFrame(motion.animate!, [], 0));
        for (const [el, f] of start) {
          // Drawn lines may end drawn, as long as they are hidden by then.
          const e = end.get(el)!;
          if (f.draw !== undefined && e.attrs.opacity === "0") continue;
          if (f.text !== undefined) continue;
          // Rays and refresh arrows turn by their symmetry: 45° and 180° look the same as 0°.
          if (/Rays$|Refresh$/.test(el)) {
            const turn = (t: string) => Number(/rotate\((-?[\d.]+)/.exec(t)![1]);
            expect((turn(e.attrs.transform!) - turn(f.attrs.transform!)) % (el.endsWith("Refresh") ? 180 : 45), el).toBe(0);
            continue;
          }
          expect(e, `${id} ${kind} #${el}`).toEqual(f);
        }
      }
  });

  it("weather and arrows show one picture at a time", () => {
    for (const [id, count] of [["weather-icons", 7], ["animated-arrows", 4]] as const)
      for (let kind = 0; kind < count; kind++) {
        const svg = render(id, { kind }).svg;
        expect(svg.match(/display="inline"/g)?.length, `${id} ${kind}`).toBe(1);
      }
  });
});

describe("data parsing", () => {
  it("reads numbers in place, ignoring units and junk", () => {
    expect(parseNumberList("12, 7.5;3 $40 45% abc", 10).map((v) => (Number.isNaN(v) ? "NaN" : v))).toEqual([12, 7.5, 3, 40, 45, "NaN"]);
    expect(parseNumberList("", 5)).toEqual([]);
    expect(parseNumberList("1,2,3,4,5,6,7,8", 3)).toEqual([1, 2, 3]);
    expect(parseNumberList("1e400", 3).every(Number.isNaN)).toBe(true);
    expect(parseLabels(" A , B,,C ", 3)).toEqual(["A", "B", ""]);
    expect(decimalsOf([1, 2.5, 3.25, 4.1234])).toBe(2);
    expect(decimalsOf([1, 2])).toBe(0);
  });

  it("cuts labels too long to read short, with an ellipsis", () => {
    expect(fitLabel("Web", 50, 9, 7)).toMatchObject({ text: "Web", size: 9 });
    const long = fitLabel("A very long label that cannot fit", 50, 9, 7);
    expect(long.text).toMatch(/\u2026$/);
    expect(long.size).toBeGreaterThanOrEqual(7);
    expect(fitLabel("", 50, 9, 7).text).toBe("");
  });

  it("keeps shares positive and falls back when none are", () => {
    expect(parseShares("10,-4,x,30", 6, [1])).toEqual([10, 0, 0, 30]);
    expect(parseShares("0,-1,nope", 6, [5, 5])).toEqual([5, 5]);
  });

  it("reads race rows, carrying values over gaps", () => {
    const rows = parseRace("A:1,2,3;B:5,x;4 8;C:", 6, 5, [{ name: "F", values: [1] }]);
    expect(rows).toEqual([
      { name: "A", values: [1, 2, 3] },
      { name: "B", values: [5, 5, 5] },
      { name: "#3", values: [4, 8, 8] },
    ]);
    expect(parseRace("junk;;", 6, 5, [{ name: "F", values: [1, 2] }])).toEqual([{ name: "F", values: [1, 2] }]);
    expect(parseRace("A:1,2,3,4,5,6,7", 6, 3, []).at(0)!.values).toEqual([1, 2, 3]);
  });

  it("reads stacked series of one length, at least two points", () => {
    expect(parseSeries("1,2,3;4", 4, 12, [[1, 1]])).toEqual([[1, 2, 3], [4, 4, 4]]);
    expect(parseSeries("7", 4, 12, [[1, 1]])).toEqual([[7, 7]]);
    expect(parseSeries("x;-3,-4", 4, 12, [[1, 1]])).toEqual([[1, 1]]);
  });
});

describe("data effects", () => {
  it("donut and pie hide slots beyond the data and count each share", () => {
    for (const id of ["donut-chart", "pie-chart"]) {
      const motion = render(id, { values: "1,3", labels: "One,Three" });
      expect(motion.svg.match(/display="inline"/g)?.length, id).toBe(id === "donut-chart" ? 4 : 6);
      const pcts = motion.animate!.filter((a) => a.count && a.format === "{n}%").map((a) => a.count![1]);
      expect(pcts.slice(0, 2), id).toEqual(id === "donut-chart" ? [25, 75] : [25, 75]);
    }
    const donut = render("donut-chart", { values: "2.5,2.5" });
    expect(donut.animate!.find((a) => a.id === "donutChartTotal")).toMatchObject({ count: [0, 5], decimals: 1 });
  });

  it("gauge clamps its value to the scale and counts with its unit", () => {
    const motion = render("gauge", { value: 500, max: 200, unit: " km/h" });
    const count = motion.animate!.find((a) => a.id === "gaugeValue")!;
    expect(count).toMatchObject({ count: [0, 200], format: "{n} km/h" });
    expect(motion.animate!.filter((a) => a.id === "gaugeNeedle").at(-1)!.attrs!.transform![1]).toBe("rotate(180 120 112)");
  });

  it("bar race reorders its bars and ticks its period label", () => {
    const motion = render("bar-race", { rows: "A:10,1;B:5,20", periods: "Then,Now" });
    const at = (ms: number) => new Map(svgFrame(motion.animate!, [], ms));
    expect(at(1000).get("barRaceRow0")!.attrs.transform).toBe("translate(0 12)");
    expect(at(svgDuration(motion)).get("barRaceRow0")!.attrs.transform).toBe("translate(0 40)");
    expect(at(svgDuration(motion)).get("barRaceRow1")!.attrs.transform).toBe("translate(0 12)");
    expect(at(svgDuration(motion)).get("barRacePeriod")!.solo).toBe(1);
    expect(at(0).get("barRacePeriod")!.solo).toBe(0);
    expect(motion.svg).toContain(">Now</text>");
  });

  it("leaderboard ranks by score and initials its avatars", () => {
    const motion = render("leaderboard", { names: "low guy,top dog", scores: "1,9" });
    expect(motion.svg).toContain(">LG</text>");
    expect(motion.svg).toContain(">TD</text>");
    const end = new Map(svgFrame(motion.animate!, [], svgDuration(motion)));
    expect(end.get("leaderboardRow1")!.attrs.transform).toBe("translate(0 8)");
    expect(end.get("leaderboardRow0")!.attrs.transform).toBe("translate(0 42)");
  });

  it("area chart's tooltip ends on the last total", () => {
    const motion = render("area-chart", { series: "1,2,3;4,5,6" });
    const end = new Map(svgFrame(motion.animate!, [], svgDuration(motion)));
    expect(end.get("areaChartTipValue")!.text).toBe("9");
    expect(end.get("areaChartTip")!.attrs.transform).toBe("translate(268 0)");
  });

  it("kpi tile colours and signs its delta, and keeps braces out of its format", () => {
    const down = render("kpi-tile", { delta: -3.2, prefix: "{n}€" });
    expect(down.svg).toContain('fill="#dc2626"');
    expect(down.animate!.find((a) => a.id === "kpiTileDeltaValue")).toMatchObject({ count: [0, 3.2], format: "−{n}%" });
    expect(down.animate!.find((a) => a.id === "kpiTileValue")!.format).toBe("n€{n}k");
    const up = render("kpi-tile", { delta: 5 });
    expect(up.animate!.find((a) => a.id === "kpiTileDeltaValue")!.format).toBe("+{n}%");
  });

  it("star rating fills to the half star", () => {
    const motion = render("bookmark-star", { rating: 3.4 });
    const widths = motion.animate!.filter((a) => a.id?.startsWith("bookmarkStarFill")).map((a) => a.attrs!.width![1]);
    expect(widths).toEqual([32, 32, 32, 16, 0]);
  });
});
