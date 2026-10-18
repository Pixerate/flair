import { describe, expect, it } from "vitest";
import { svgAnimatedMarkup } from "../vector/animated.js";
import { behaviorProgress, svgFrame, svgMotionIssues, type SvgMotion } from "../vector/motion.js";
import { svgFrameMarkup } from "../vector/static.js";
import { svgDuration } from "../vector/svg.js";
import { applyPrimitive, ENTRANCE_EASE, EXIT_EASE, getPrimitive, listPrimitives, PRIMITIVE_KINDS, PRIMITIVES, primitiveTags, removePrimitive, type PrimitiveUse } from "./index.js";
import { resolveParams } from "./params.js";

const SVG =
  '<svg viewBox="0 0 200 120">' +
  '<g id="group" transform="translate(20 10)">' +
  '<rect id="card" x="10" y="10" width="40" height="20" fill="#336699" stroke="#112233" stroke-width="2"/>' +
  '<path id="route" d="M0 60 C40 20 80 100 120 60" fill="none"/>' +
  "</g>" +
  '<circle id="dot" cx="150" cy="30" r="8" fill="#ff0000"/>' +
  '<text id="title" x="10" y="110">Hello</text>' +
  '<defs><linearGradient id="grad"><stop id="stop" offset="0"/></linearGradient></defs>' +
  "</svg>";

const MOTION: SvgMotion = { svg: SVG };

/** A use of each primitive on the card that works with its defaults (and what follow needs). */
const useOf = (id: string): PrimitiveUse => ({ primitive: id, target: "card", ...(id === "path.follow" ? { params: { path: "route" } } : {}) });

const apply = (motion: SvgMotion, use: PrimitiveUse) => {
  const result = applyPrimitive(motion, use);
  if (!result.ok) throw new Error(result.message);
  return result;
};

/** The frame at `t` of the elements a use added, as plain data. */
const frameAt = (motion: SvgMotion, t: number) => Object.fromEntries([...svgFrame(motion.animate ?? [], [], t)].map(([id, f]) => [id, JSON.parse(JSON.stringify(f))]));

describe("the primitives as data", () => {
  it("lists every kind, with ids that say their kind", () => {
    expect(new Set(PRIMITIVES.map((p) => p.kind))).toEqual(new Set(PRIMITIVE_KINDS));
    for (const p of PRIMITIVES) expect(p.id.startsWith(`${p.kind}.`)).toBe(true);
    expect(new Set(PRIMITIVES.map((p) => p.id)).size).toBe(PRIMITIVES.length);
    expect(listPrimitives("exit").map((p) => p.id)).toEqual(["exit.fade", "exit.shrink", "exit.slide", "exit.wipe", "exit.undraw"]);
    expect(listPrimitives("entrance")).toHaveLength(10);
    expect(getPrimitive("emphasis.wiggle")?.kind).toBe("emphasis");
    expect(getPrimitive("nope")).toBeUndefined();
  });

  it("describes each one with labelled params whose defaults it accepts, all plain JSON", () => {
    expect(JSON.parse(JSON.stringify(PRIMITIVES))).toEqual(PRIMITIVES);
    for (const p of PRIMITIVES) {
      expect(p.name, p.id).toBeTruthy();
      expect(p.description.length, p.id).toBeGreaterThan(20);
      expect(p.appliesTo, p.id).toBeTruthy();
      expect(p.ms, p.id).toBeGreaterThan(0);
      for (const param of p.params) {
        expect(param.label, `${p.id}.${param.name}`).toBeTruthy();
        expect(param.default, `${p.id}.${param.name}`).not.toBeUndefined();
        if (param.type === "float" || param.type === "int") expect([param.min, param.max].every((n) => typeof n === "number"), `${p.id}.${param.name}`).toBe(true);
        if (param.type === "enum") expect(param.options).toContain(param.default);
      }
      // path.follow's path has no sensible default: it must be given.
      if (p.id !== "path.follow") expect(resolveParams(p, {}).ok, p.id).toBe(true);
    }
  });

  it("keeps the animation editor's defaults", () => {
    const ms = Object.fromEntries(PRIMITIVES.map((p) => [p.id, p.ms]));
    for (const p of listPrimitives("entrance")) expect(p.ms).toBe(600);
    for (const p of listPrimitives("exit")) expect(p.ms).toBe(450);
    expect([ms["emphasis.pulse"], ms["emphasis.shake"], ms["emphasis.spin"], ms["path.follow"]]).toEqual([600, 500, 700, 1400]);
    expect(getPrimitive("entrance.fade")!.ease).toEqual(ENTRANCE_EASE);
    expect(getPrimitive("exit.fade")!.ease).toEqual(EXIT_EASE);
    expect(getPrimitive("path.follow")!.ease).toEqual([0.65, 0, 0.35, 1]);
    const slide = getPrimitive("entrance.slide")!.params;
    expect(slide.find((p) => p.name === "distance")!.default).toBe(40);
    expect(slide.find((p) => p.name === "direction")!.options).toEqual(["up", "down", "left", "right"]);
    expect(getPrimitive("emphasis.pulse")!.params.map((p) => [p.name, p.default])).toEqual([["amount", 0.15], ["count", 1]]);
    expect(getPrimitive("emphasis.shake")!.params.find((p) => p.name === "amount")!.default).toBe(8);
  });
});

describe("applyPrimitive", () => {
  it.each(PRIMITIVES.map((p) => p.id))("%s expands to a motion with no issues and a deterministic frame", (id) => {
    const result = apply(MOTION, useOf(id));
    expect(svgMotionIssues(result.motion)).toEqual([]);
    expect(result.added.length).toBeGreaterThan(0);
    for (const a of result.added) expect(a.tag).toBe(result.tag);
    expect(result.tag).toBe(`${id}@card`);
    const end = svgDuration(result.motion);
    for (const t of [0, end * 0.25, end * 0.5, end * 0.8, end]) {
      // Same time, same frame: from the same motion, and from a fresh expansion.
      expect(frameAt(result.motion, t)).toEqual(frameAt(result.motion, t));
      expect(frameAt(apply(MOTION, useOf(id)).motion, t)).toEqual(frameAt(result.motion, t));
    }
    // And a still and an animated file come out of it.
    expect(svgFrameMarkup(result.motion, { at: end / 2 })).toContain('id="card"');
    expect(svgAnimatedMarkup(result.motion)).toContain("<animate");
  });

  it("hides an entrance until it plays and leaves the element at rest", () => {
    const pop = apply(MOTION, { primitive: "entrance.pop", target: "card", delay: 200 });
    expect(pop.motion.svg).toContain('<g id="card--pop" data-flair-tag="entrance.pop@card"><rect id="card"');
    expect(frameAt(pop.motion, 0)["card--pop"].attrs.opacity).toBe("0");
    expect(frameAt(pop.motion, 0)["card--pop"].attrs.transform).toBe("translate(30 20) scale(0.5) translate(-30 -20)");
    const end = frameAt(pop.motion, 800)["card--pop"];
    expect(end.attrs).toEqual({ opacity: "1", transform: "translate(30 20) scale(1) translate(-30 -20)" });

    const draw = apply(MOTION, { primitive: "entrance.draw", target: "card" });
    expect(frameAt(draw.motion, 0).card).toMatchObject({ draw: 0, attrs: { "fill-opacity": "0" } });
    expect(frameAt(draw.motion, 600).card).toMatchObject({ draw: 1, attrs: { "fill-opacity": "1" } });
  });

  it("slides in from the other side of its direction, and out the way it says", () => {
    const enter = apply(MOTION, { primitive: "entrance.slide", target: "dot", params: { direction: "left", distance: 30 } });
    expect(frameAt(enter.motion, 0)["dot--slide"].attrs.transform).toBe("translate(30 0)");
    expect(frameAt(enter.motion, 600)["dot--slide"].attrs.transform).toBe("translate(0 0)");
    const exit = apply(MOTION, { primitive: "exit.slide", target: "dot" });
    expect(frameAt(exit.motion, 450)["dot--slide-out"].attrs).toEqual({ opacity: "0", transform: "translate(0 40)" });
  });

  it("wipes out as a wipe in reversed in time", () => {
    for (const dir of ["up", "down", "left", "right"] as const) {
      const opposite = { up: "down", down: "up", left: "right", right: "left" }[dir];
      const out = apply(MOTION, { primitive: "exit.wipe", target: "card", params: { direction: dir }, ease: "linear", ms: 500 });
      const into = apply(MOTION, { primitive: "entrance.wipe", target: "card", params: { direction: opposite }, ease: "linear", ms: 500 });
      for (const t of [0, 100, 250, 400, 500])
        expect(frameAt(out.motion, t)["card--wipe-out-clip-shape"].attrs).toEqual(frameAt(into.motion, 500 - t)["card--wipe-clip-shape"].attrs);
    }
  });

  it("reveals through a clip in the element's own box, padded for its stroke", () => {
    const wipe = apply(MOTION, { primitive: "entrance.wipe", target: "card" });
    expect(wipe.elements).toEqual(["card--wipe", "card--wipe-clip"]);
    expect(wipe.motion.svg).toContain('clip-path="url(#card--wipe-clip)"');
    expect(wipe.motion.svg).toContain('<clipPath id="card--wipe-clip" clipPathUnits="objectBoundingBox"><rect id="card--wipe-clip-shape" x="-0.045" y="-0.07" width="0" height="1.14"/>');
    // Text needs no measuring: its box is the clip's units.
    expect(applyPrimitive(MOTION, { primitive: "entrance.iris", target: "title" }).ok).toBe(true);
  });

  it("pulses and shakes as the animation editor does", () => {
    const pulse = apply(MOTION, { primitive: "emphasis.pulse", target: "card", params: { amount: 0.2, count: 2 } });
    const scaleAt = (t: number) => Number(/scale\(([^)]+)\)/.exec(frameAt(pulse.motion, t)["card--pulse"].attrs.transform)![1]);
    for (const t of [0, 75, 150, 300, 450, 600]) expect(scaleAt(t)).toBeCloseTo(1 + 0.2 * Math.sin(Math.PI * (t / 600) * 2) ** 2, 3);

    const shake = apply(MOTION, { primitive: "emphasis.shake", target: "card" });
    const xAt = (t: number) => Number(/translate\(([^ ]+)/.exec(frameAt(shake.motion, t)["card--shake"].attrs.transform)![1]);
    for (const t of [0, 40, 125, 260, 400, 500]) {
      const u = t / 500;
      expect(xAt(t)).toBeCloseTo(8 * Math.sin(2 * Math.PI * u * 3) * (1 - u), 2);
    }
  });

  it("wiggles the same way for the same element, each axis on its own, at rest at both ends", () => {
    const a = apply(MOTION, { primitive: "emphasis.wiggle", target: "card" });
    const b = apply(MOTION, { primitive: "emphasis.wiggle", target: "dot" });
    const at = (m: SvgMotion, id: string, t: number) => frameAt(m, t)[id].attrs.transform as string;
    expect(at(a.motion, "card--wiggle", 0)).toBe("translate(0 0)");
    expect(at(a.motion, "card--wiggle", 1500)).toBe("translate(0 0)");
    const mid = at(a.motion, "card--wiggle", 700).match(/-?[\d.]+/g)!.map(Number);
    expect(mid[0]).not.toBe(mid[1]);
    expect(Math.abs(mid[0]!)).toBeLessThan(6 * 1.6);
    expect(at(b.motion, "dot--wiggle", 700)).not.toBe(at(a.motion, "card--wiggle", 700));
    const seeded = (seed: number, target: string) => at(apply(MOTION, { primitive: "emphasis.wiggle", target, params: { seed } }).motion, `${target}--wiggle`, 700);
    expect(seeded(7, "card")).toBe(seeded(7, "card"));
    expect(seeded(7, "card")).not.toBe(seeded(8, "card"));
  });

  it("tints toward a colour and back", () => {
    const tint = apply(MOTION, { primitive: "emphasis.color-pulse", target: "dot", params: { color: "#0000FF" } });
    expect(frameAt(tint.motion, 0).dot.attrs.fill).toBe("#ff0000");
    expect(frameAt(tint.motion, 300).dot.attrs.fill).toBe("#0000ff");
    expect(frameAt(tint.motion, 600).dot.attrs.fill).toBe("#ff0000");
  });

  it("follows a path with its centre, turning with it when asked", () => {
    const follow = apply(MOTION, { primitive: "path.follow", target: "card", params: { path: "route", orient: true, from: 0.2, to: 0.8 } });
    expect(follow.motion.svg).toContain('<g id="card--follow" data-flair-tag="path.follow@card"><g id="card--follow-centre" data-flair-tag="path.follow@card" transform="translate(-30 -20)"><rect id="card"');
    expect(frameAt(follow.motion, 0)["card--follow"].along).toEqual({ path: "route", at: 0.2, orient: true });
    expect(frameAt(follow.motion, 1400)["card--follow"].along).toEqual({ path: "route", at: 0.8, orient: true });
    // The animated file lets the browser follow it, turning with it.
    expect(svgAnimatedMarkup(follow.motion)).toMatch(/<animateMotion[^>]*rotate="auto"/);
  });

  it("measures through transforms, and takes a box (in viewBox units) for text", () => {
    const nested: SvgMotion = { svg: '<svg viewBox="0 0 100 100"><g transform="translate(50 0) scale(2)"><circle id="c" cx="5" cy="5" r="5" transform="translate(10 0)"/></g><text id="t">Hi</text></svg>' };
    const spin = apply(nested, { primitive: "emphasis.spin", target: "c" });
    expect(spin.added[0]!.attrs!.transform).toEqual(["rotate(0 15 5)", "rotate(360 15 5)"]);
    const text = applyPrimitive(nested, { primitive: "emphasis.spin", target: "t" });
    expect(text).toMatchObject({ ok: false, message: expect.stringContaining("text needs layout") });
    expect(text.ok || text.message).toContain("pass `box`");
    const boxed = apply(nested, { primitive: "emphasis.spin", target: "t", box: [10, 20, 40, 10] });
    expect(boxed.added[0]!.attrs!.transform).toEqual(["rotate(0 30 25)", "rotate(360 30 25)"]);
    // A box given for an element inside a scaled group lands in the group's units.
    const inGroup = apply(nested, { primitive: "emphasis.spin", target: "c", box: [70, 0, 20, 20] });
    expect(inGroup.added[0]!.attrs!.transform).toEqual(["rotate(0 15 5)", "rotate(360 15 5)"]);
  });

  it("measures a picture with placeholders from its filled-in copy", () => {
    const raw: SvgMotion = { svg: '<svg viewBox="0 0 100 100"><rect id="r" x="{{x: float default=10}}" y="0" width="20" height="20"/></svg>' };
    expect(applyPrimitive(raw, { primitive: "entrance.pop", target: "r" })).toMatchObject({ ok: false, message: expect.stringContaining("placeholders") });
    const filled: SvgMotion = { svg: '<svg viewBox="0 0 100 100"><rect id="r" x="10" y="0" width="20" height="20"/></svg>' };
    const pop = applyPrimitive(raw, { primitive: "entrance.pop", target: "r" }, { measure: filled });
    expect(pop.ok && pop.added[1]!.attrs!.transform![1]).toBe("translate(20 10) scale(1) translate(-20 -10)");
    expect(pop.ok && pop.motion.svg).toContain('x="{{x: float default=10}}"');
  });

  it("gives each use its own tag and ids", () => {
    const first = apply(MOTION, { primitive: "emphasis.pulse", target: "card" });
    const second = apply(first.motion, { primitive: "emphasis.pulse", target: "card", delay: 800 });
    expect(second.tag).toBe("emphasis.pulse@card#2");
    expect(second.elements).toEqual(["card--pulse-2"]);
    expect(primitiveTags(second.motion)).toEqual(["emphasis.pulse@card", "emphasis.pulse@card#2"]);
    expect(svgMotionIssues(second.motion)).toEqual([]);
  });

  it("stacks an entrance, emphasis and exit on one element", () => {
    let m = MOTION;
    m = apply(m, { primitive: "entrance.grow", target: "card" }).motion;
    m = apply(m, { primitive: "emphasis.teeter", target: "card", delay: 700 }).motion;
    m = apply(m, { primitive: "exit.wipe", target: "card", delay: 1500 }).motion;
    expect(svgMotionIssues(m)).toEqual([]);
    expect(m.svg).toMatch(/<g id="card--grow"[^>]*><g id="card--teeter"[^>]*><g id="card--wipe-out"[^>]*><defs[^>]*>.*<\/defs><rect id="card"/);
    expect(frameAt(m, 1300)["card--grow"].attrs.opacity).toBe("1");
    expect(frameAt(m, 1300)["card--teeter"].attrs.transform).toBe("rotate(0 30 20)");
  });

  describe("refuses, changing nothing", () => {
    const refuse = (use: unknown, motion: SvgMotion = MOTION) => {
      const before = JSON.stringify(motion);
      const result = applyPrimitive(motion, use as PrimitiveUse);
      expect(JSON.stringify(motion)).toBe(before);
      if (result.ok) throw new Error("expected a refusal");
      return result.message;
    };

    it("an unknown primitive, suggesting the nearest", () => {
      expect(refuse({ primitive: "pop", target: "card" })).toMatch(/no primitive "pop"\. Did you mean "entrance\.pop"\?/);
      expect(refuse({ primitive: "entrance.fad", target: "card" })).toContain('Did you mean "entrance.fade"');
      expect(refuse({ target: "card" })).toContain("`primitive` is a primitive's id");
    });

    it("an unknown or unsuitable target", () => {
      expect(refuse({ primitive: "entrance.fade", target: "crad" })).toMatch(/no element "crad".*Did you mean "card"\?.*can move are "group", "card", "route", "dot", "title"\./);
      expect(refuse({ primitive: "entrance.fade", target: "stop" })).toContain("inside a <defs>");
      expect(refuse({ primitive: "entrance.fade" })).toContain("`target` is the id");
      expect(refuse({ primitive: "entrance.fade", target: "s" }, { svg: '<svg id="s" viewBox="0 0 1 1"/>' })).toContain("whole picture");
    });

    it("bad params: unknown names, wrong types, out of range", () => {
      const message = refuse({ primitive: "entrance.slide", target: "card", params: { distanc: 3, direction: "upp" } });
      expect(message).toContain('entrance.slide has no parameter "distanc"; it takes "direction", "distance". Did you mean "distance"?');
      expect(message).toContain('`direction` is one of "up", "down", "left", "right"; it was given "upp". Did you mean "up"?');
      expect(refuse({ primitive: "emphasis.pulse", target: "card", params: { count: 1.5 } })).toContain("`count` is a whole number from 1 to 20");
      expect(refuse({ primitive: "emphasis.pulse", target: "card", params: { amount: 9 } })).toContain("9 is out of range");
      expect(refuse({ primitive: "emphasis.color-pulse", target: "dot", params: { color: "blue" } })).toContain("colour written #rrggbb");
      expect(refuse({ primitive: "entrance.draw", target: "card", params: { fill: "yes" } })).toContain("`fill` is true or false");
      expect(refuse({ primitive: "entrance.fade", target: "card", params: { x: 1 } })).toContain("takes no parameters");
      expect(refuse({ primitive: "entrance.fade", target: "card", params: [1] })).toContain("`params` is an object");
    });

    it("bad timing", () => {
      const message = refuse({ primitive: "entrance.fade", target: "card", step: -1, delay: -5, ms: 0, ease: "bouncy", box: [1, 2] });
      for (const part of ["`step` is a whole number", "`delay` is a number of ms", "`ms` is a number of ms above 0", "`ease` is", "`box` is [x, y, width, height]"]) expect(message).toContain(part);
    });

    it("a primitive that cannot work on the element", () => {
      expect(refuse({ primitive: "entrance.draw", target: "group" })).toContain('"group" is a <g>');
      expect(refuse({ primitive: "emphasis.color-pulse", target: "group" })).toContain("a group's children keep their own colours");
      expect(refuse({ primitive: "path.follow", target: "card" })).toContain("path.follow needs `path`");
      expect(refuse({ primitive: "path.follow", target: "card", params: { path: "dot" } })).toContain('"dot" is a <circle>');
      expect(refuse({ primitive: "path.follow", target: "dot", params: { path: "route" } })).toContain("different transforms");
      const line: SvgMotion = { svg: '<svg viewBox="0 0 10 10"><line id="l" x1="0" y1="5" x2="10" y2="5" stroke="#000"/></svg>' };
      expect(refuse({ primitive: "entrance.wipe", target: "l" }, line)).toContain("no height");
    });
  });
});

describe("removePrimitive", () => {
  it("takes off exactly what one use added", () => {
    const base: SvgMotion = { svg: SVG, animate: [{ id: "dot", attrs: { r: [0, 8] } }] };
    const one = apply(base, { primitive: "entrance.wipe", target: "card" });
    const two = apply(one.motion, { primitive: "path.follow", target: "card", params: { path: "route" } });
    const back = removePrimitive(two.motion, two.tag);
    expect(back).toEqual({ ok: true, motion: one.motion, removed: two.added });
    const none = removePrimitive(back.ok ? back.motion : base, one.tag);
    expect(none.ok && none.motion).toEqual(base);
  });

  it("refuses a tag that is not there, listing those that are", () => {
    const one = apply(MOTION, { primitive: "entrance.fade", target: "card" });
    expect(removePrimitive(one.motion, "entrance.fade@crad")).toMatchObject({ ok: false, message: expect.stringMatching(/Did you mean "entrance\.fade@card"\?.*The tags are "entrance\.fade@card"/) });
    expect(removePrimitive(MOTION, "x")).toMatchObject({ ok: false, message: expect.stringContaining("nothing to remove") });
  });
});

describe("behaviors in the runtime", () => {
  it("pulses, oscillates, wriggles and overshoots as pure functions of time", () => {
    expect(behaviorProgress({ type: "pulse" }, 0.5)).toBeCloseTo(1);
    expect(behaviorProgress({ type: "pulse", count: 2 }, 0.5)).toBeCloseTo(0);
    expect(behaviorProgress({ type: "oscillate" }, 0.25)).toBeCloseTo(1);
    expect(behaviorProgress({ type: "oscillate", decay: 1 }, 0.25)).toBeCloseTo(0.75);
    expect(behaviorProgress({ type: "wriggle" }, 0)).toBe(0);
    expect(behaviorProgress({ type: "wriggle" }, 1)).toBe(0);
    expect(behaviorProgress({ type: "wriggle", seed: 3 }, 0.5, 0, 1000)).toBe(behaviorProgress({ type: "wriggle", seed: 3 }, 0.5, 0, 1000));
    expect(behaviorProgress({ type: "wriggle", seed: 3 }, 0.5, 0)).not.toBe(behaviorProgress({ type: "wriggle", seed: 3 }, 0.5, 1));
    expect(behaviorProgress({ type: "overshoot" }, 1)).toBe(1);
  });

  it("checks behavior and orient fields", () => {
    const svg = '<svg viewBox="0 0 10 10"><rect id="r"/></svg>';
    expect(svgMotionIssues({ svg, animate: [{ id: "r", attrs: { x: [0, 1] }, behavior: { type: "bounce" } }] })[0]).toContain("`behavior` is {type: pulse | oscillate | wriggle | overshoot");
    expect(svgMotionIssues({ svg, animate: [{ id: "r", attrs: { x: [0, 1] }, behavior: { type: "wriggle", octaves: 0 } }] })[0]).toContain("octaves");
    expect(svgMotionIssues({ svg, animate: [{ id: "r", attrs: { x: [0, 1] }, orient: true }] })[0]).toContain("`orient`");
    expect(svgMotionIssues({ svg, animate: [{ id: "r", attrs: { x: [0, 1] }, behavior: { type: "oscillate", count: 2, decay: 1 }, tag: "mine" }] })).toEqual([]);
  });
});
