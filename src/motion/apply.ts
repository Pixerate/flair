/**
 * Applying a primitive to an element of an `SvgMotion`, and taking it off
 * again. Everything is checked before anything changes, and a use either
 * applies whole or not at all.
 */

import { isSvgEase, svgMotionIssues, type SvgAnimation, type SvgBox, type SvgMotion } from "../vector/motion.js";
import { boxInParent, invert, isUndrawn, ownTransform, parentMatrix, strokeWidth, transformBox, multiply } from "./geometry.js";
import { primitiveById, PRIMITIVES, PrimitiveError, type ExpandContext } from "./library.js";
import { escapeAttr, markupIds, removeTagged, scanMarkup, type MarkupElement } from "./markup.js";
import { didYouMean, resolveParams, sentence } from "./params.js";
import type { PrimitiveResult, PrimitiveUse } from "./types.js";

/** Elements a primitive can move: drawn things, not their parts (a `<tspan>`) or definitions. */
const MOVABLE = new Set(["g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "image", "use", "a", "svg", "switch"]);

const ids = (list: Iterable<string>) => [...list].filter(Boolean);
const listIds = (list: string[]) => (list.length > 12 ? `${list.slice(0, 12).map((i) => `"${i}"`).join(", ")} and ${list.length - 12} more` : list.map((i) => `"${i}"`).join(", "));

/** Every primitive tag in a motion (`SvgAnimation.tag`, `data-flair-tag`), in the order first seen. */
export function primitiveTags(motion: SvgMotion): string[] {
  const tags = new Set<string>();
  for (const a of motion.animate ?? []) if (typeof a?.tag === "string") tags.add(a.tag);
  for (const m of (motion.svg ?? "").matchAll(/\sdata-flair-tag\s*=\s*"([^"]*)"/g)) tags.add(m[1]!.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<"));
  return [...tags];
}

/** A use's timing checks, as sentences. */
function timingProblems(use: PrimitiveUse): string[] {
  const problems: string[] = [];
  if (use.step !== undefined && !(Number.isInteger(use.step) && use.step >= 0)) problems.push("`step` is a whole number, 0 or more (0 when the picture starts, 1 with the next shot, …)");
  if (use.delay !== undefined && !(typeof use.delay === "number" && use.delay >= 0 && Number.isFinite(use.delay))) problems.push("`delay` is a number of ms, 0 or more");
  if (use.ms !== undefined && !(typeof use.ms === "number" && use.ms > 0 && Number.isFinite(use.ms))) problems.push("`ms` is a number of ms above 0");
  if (use.ease !== undefined && !isSvgEase(use.ease))
    problems.push('`ease` is "linear", "out", "in-out", a cubic-bezier [x1, y1, x2, y2] with x1 and x2 from 0 to 1, or {spring: {mass?, stiffness?, damping?, velocity?}}');
  if (use.repeat !== undefined && !(Number.isInteger(use.repeat) && use.repeat >= 1)) problems.push("`repeat` is a whole number of cycles, 1 or more");
  if (use.alternate !== undefined && typeof use.alternate !== "boolean") problems.push("`alternate` is true or false");
  if (use.box !== undefined) {
    const b = use.box as unknown;
    if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && Number.isFinite(n)) || !(b[2] >= 0 && b[3] >= 0))
      problems.push("`box` is [x, y, width, height] in the viewBox's units, width and height 0 or more");
  }
  return problems;
}

/** Why Flair cannot measure `el`, for a refusal. */
function unmeasurable(el: MarkupElement): string {
  const all: MarkupElement[] = [];
  const walk = (e: MarkupElement) => {
    all.push(e);
    e.children.forEach(walk);
  };
  walk(el);
  if (all.some((e) => e.tag.toLowerCase() === "text")) return "text needs layout to measure";
  if (all.some((e) => Object.values(e.attrs).some((v) => v.includes("{{")))) return "its numbers are {{placeholders}}";
  return `Flair cannot measure a <${el.tag}> from its markup`;
}

/**
 * Applies a motion primitive (see `PRIMITIVES`) to one element of `motion`,
 * returning a new motion: the primitive's animations added to `animate`
 * (each tagged with the use's `tag`), and any markup it needs (a wrapper
 * group to move or fade, a clip path to reveal through) round the target.
 * Every frame stays a pure function of time, played exactly by Flair.
 *
 * Checks the primitive, the target, the parameters and the timing first,
 * and refuses with a sentence saying how to fix the problem (`ok: false`),
 * leaving `motion` as it was. Primitives that scale or turn round the
 * element's centre (`needsBox`) measure its box from the markup; give
 * `box` (in the `viewBox`'s units) for text and for numbers that are
 * `{{placeholders}}`. `measure`, the same picture with its placeholders
 * filled in, is measured instead when given.
 */
export function applyPrimitive(motion: SvgMotion, use: PrimitiveUse, options: { measure?: SvgMotion } = {}): PrimitiveResult {
  const fail = (message: string): PrimitiveResult => ({ ok: false, message });
  if (!motion || typeof motion.svg !== "string" || !motion.svg.trim()) return fail("The motion needs `svg`: one <svg>…</svg> element with a viewBox.");
  if (!use || typeof use !== "object") return fail("A use is {primitive, target, params?, step?, delay?, ms?, ease?, repeat?, alternate?, box?}.");
  if (typeof use.primitive !== "string" || !use.primitive) return fail(`\`primitive\` is a primitive's id: ${PRIMITIVES.map((p) => p.id).join(", ")}.`);
  const primitive = primitiveById(use.primitive);
  if (!primitive)
    return fail(`There is no primitive "${use.primitive}".${didYouMean(use.primitive, PRIMITIVES.map((p) => p.id))} The primitives are ${PRIMITIVES.map((p) => p.id).join(", ")}.`);
  const { descriptor } = primitive;

  const { root, byId } = scanMarkup(motion.svg);
  if (!root || root.tag.toLowerCase() !== "svg") return fail("The motion's `svg` must be one <svg>…</svg> element.");
  // The ids worth suggesting: elements a primitive can move.
  const elementIds = ids([...byId].filter(([, el]) => el !== root && MOVABLE.has(el.tag.toLowerCase()) && !isUndrawn(el)).map(([id]) => id));
  if (typeof use.target !== "string" || !use.target) return fail(`\`target\` is the id of the element to move; the elements it can move are ${listIds(elementIds) || "none (give the element an id first)"}.`);
  const target = byId.get(use.target);
  if (!target)
    return fail(
      `There is no element "${use.target}" in the picture.${didYouMean(use.target, elementIds)} ${elementIds.length ? `The elements it can move are ${listIds(elementIds)}.` : "No drawn element has an id yet: give the one to move an id with effect.setMotion."}`,
    );
  const tagName = target.tag.toLowerCase();
  if (target === root) return fail(`"${use.target}" is the whole picture; apply ${descriptor.id} to an element inside it.`);
  if (isUndrawn(target)) return fail(`"${use.target}" is inside a <defs>, <clipPath>, <mask> or similar, which is not drawn where it is written; apply ${descriptor.id} to a drawn element.`);
  if (!MOVABLE.has(tagName))
    return fail(`${descriptor.id} moves a drawn element (a shape, text, image, group or use); "${use.target}" is a <${target.tag}>${tagName === "tspan" || tagName === "textpath" ? ": apply it to its <text>" : ""}.`);

  const problems = timingProblems(use);
  if ((use.repeat !== undefined || use.alternate !== undefined) && descriptor.kind !== "emphasis")
    problems.push(`\`repeat\` and \`alternate\` go with emphasis primitives (${PRIMITIVES.filter((p) => p.kind === "emphasis").map((p) => p.id).join(", ")}); ${descriptor.id} is ${descriptor.kind === "entrance" ? "an" : "a"} ${descriptor.kind} primitive`);
  const params = resolveParams(descriptor, use.params);
  if (!params.ok) problems.push(...params.problems);
  if (problems.length) return fail(`Cannot apply ${descriptor.id} to "${use.target}": ${problems.map(sentence).join(" ")}`);
  const values = (params as Extract<typeof params, { ok: true }>).values;

  // Measured from the filled-in picture when given (its ids and structure are the same).
  const measured = options.measure ? scanMarkup(options.measure.svg) : { root, byId };
  const measuredTarget = measured.byId.get(use.target) ?? target;
  const parentBox = (): SvgBox | undefined => {
    if (use.box) {
      // Given in the viewBox's units: into the parent's.
      const m = parentMatrix(measuredTarget);
      const inverse = m && invert(m);
      return inverse ? transformBox(use.box, inverse) : undefined;
    }
    return boxInParent(measuredTarget, measured.byId);
  };

  // A tag and element ids no one has used.
  const taken = new Set(primitiveTags(motion));
  let tag = `${descriptor.id}@${use.target}`;
  for (let n = 2; taken.has(tag); n++) tag = `${descriptor.id}@${use.target}#${n}`;
  const usedIds = markupIds(motion.svg);
  const freshId = (name: string) => {
    let id = `${use.target}--${name}`;
    for (let n = 2; usedIds.has(id); n++) id = `${use.target}--${name}-${n}`;
    usedIds.add(id);
    return id;
  };

  const step = use.step ?? 0;
  const delay = use.delay ?? 0;
  const ms = use.ms ?? descriptor.ms;
  const mainEase = use.ease ?? descriptor.ease;
  const wraps: { id: string; attrs: Record<string, string>; defs?: string }[] = [];
  const contentWraps: { id: string; element: string; attrs: Record<string, string> }[] = [];
  const added: SvgAnimation[] = [];
  const ctx: ExpandContext = {
    id: use.target,
    tagName,
    attrs: target.attrs,
    values,
    timing: (from = 0, to = 1, ease) => ({
      ...(step ? { step } : {}),
      ...(delay + ms * from ? { delay: +(delay + ms * from).toFixed(3) } : {}),
      ms: +(ms * (to - from)).toFixed(3),
      ease: ease ?? mainEase,
    }),
    wrap(name, attrs = {}) {
      const id = freshId(name);
      wraps.push({ id, attrs });
      return id;
    },
    wrapContent(name, element, attrs = {}) {
      if (target.closeStart <= target.openEnd) throw new PrimitiveError(`"${use.target}" has nothing inside it for ${descriptor.id} to wrap.`);
      const id = freshId(name);
      contentWraps.push({ id, element, attrs });
      return id;
    },
    clip(shape, attrs) {
      const wrap = wraps[wraps.length - 1];
      if (!wrap) throw new Error("clip() needs a wrapper first");
      const clipId = `${wrap.id}-clip`;
      const shapeId = `${wrap.id}-clip-shape`;
      usedIds.add(clipId);
      usedIds.add(shapeId);
      const shapeAttrs = Object.entries(attrs).map(([k, v]) => ` ${k}="${+v.toFixed(4)}"`).join("");
      wrap.attrs["clip-path"] = `url(#${clipId})`;
      wrap.defs = `<defs data-flair-tag="${escapeAttr(tag)}"><clipPath id="${escapeAttr(clipId)}" clipPathUnits="objectBoundingBox"><${shape} id="${escapeAttr(shapeId)}"${shapeAttrs}/></clipPath></defs>`;
      return shapeId;
    },
    centre() {
      const box = parentBox();
      if (!box)
        throw new PrimitiveError(
          `${descriptor.id} turns or scales "${use.target}" round its centre, but ${unmeasurable(measuredTarget)}; pass \`box\`: its [x, y, width, height] in the viewBox's units.`,
        );
      return [box[0] + box[2] / 2, box[1] + box[3] / 2];
    },
    padding() {
      const box = parentBox();
      if (box && (box[2] <= 0 || box[3] <= 0))
        throw new PrimitiveError(`${descriptor.id} reveals through a clip over "${use.target}"'s box, which has no ${box[2] <= 0 ? "width" : "height"} (a straight line); use entrance.draw or entrance.fade for it instead.`);
      if (!box) return [0.05, 0.05];
      const s = strokeWidth(measuredTarget) / 2;
      return [Math.min(1, s / box[2] + 0.02), Math.min(1, s / box[3] + 0.02)];
    },
    add(anim) {
      // Emphasis parts each span the whole use, so they repeat in step.
      added.push({ ...anim, ...(use.repeat && use.repeat > 1 ? { repeat: use.repeat } : {}), ...(use.alternate ? { alternate: true } : {}), tag });
    },
    element(id) {
      const el = byId.get(id);
      return el && { tagName: el.tag.toLowerCase() };
    },
    sameUnits(pathId) {
      const path = measured.byId.get(pathId);
      if (!path) return undefined;
      const [pm, own, tm] = [parentMatrix(path), ownTransform(path), parentMatrix(measuredTarget)];
      if (!pm || !own || !tm) return undefined;
      const a = multiply(pm, own);
      return a.every((v, i) => Math.abs(v - tm[i]!) < 1e-6);
    },
  };
  try {
    primitive.expand(ctx);
  } catch (e) {
    if (e instanceof PrimitiveError) return fail(e.message);
    throw e;
  }

  // The markup: the target's contents in their wrappers, and the target inside its own (outermost first), each tagged.
  const attrsOf = (attrs: Record<string, string>) => Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
  let element = motion.svg.slice(target.start, target.end);
  if (contentWraps.length) {
    const [from, to] = [target.openEnd - target.start, target.closeStart - target.start];
    const open = contentWraps.map((w) => `<${w.element} id="${escapeAttr(w.id)}" data-flair-tag="${escapeAttr(tag)}"${attrsOf(w.attrs)}>`).join("");
    const close = [...contentWraps].reverse().map((w) => `</${w.element}>`).join("");
    element = element.slice(0, from) + open + element.slice(from, to) + close + element.slice(to);
  }
  if (wraps.length) {
    const open = wraps.map((w) => `<g id="${escapeAttr(w.id)}" data-flair-tag="${escapeAttr(tag)}"${attrsOf(w.attrs)}>${w.defs ?? ""}`).join("");
    element = open + element + "</g>".repeat(wraps.length);
  }
  const svg = motion.svg.slice(0, target.start) + element + motion.svg.slice(target.end);
  const next: SvgMotion = { ...motion, svg, animate: [...(motion.animate ?? []), ...added] };
  const before = new Set(svgMotionIssues(motion));
  const issues = svgMotionIssues(next).filter((i) => !before.has(i));
  if (issues.length) return fail(`Applying ${descriptor.id} to "${use.target}" would break the picture: ${issues.join("; ")}.`);
  const elements = [...wraps.flatMap((w) => (w.defs ? [w.id, `${w.id}-clip`] : [w.id])), ...contentWraps.map((w) => w.id)];
  return { ok: true, motion: next, tag, added, elements };
}

/**
 * `motion` without what one use of a primitive added (by its `tag`, from
 * `applyPrimitive` or `primitiveTags`): its animations, and its wrapper
 * groups and clip paths (the element is put back where it was). Refuses an
 * unknown tag, listing the ones there are.
 */
export function removePrimitive(motion: SvgMotion, tag: string): { ok: true; motion: SvgMotion; removed: SvgAnimation[] } | { ok: false; message: string } {
  if (!motion || typeof motion.svg !== "string") return { ok: false, message: "The motion needs `svg`: one <svg>…</svg> element with a viewBox." };
  const tags = primitiveTags(motion);
  if (typeof tag !== "string" || !tags.includes(tag))
    return {
      ok: false,
      message: tags.length
        ? `No primitive in the picture is tagged ${JSON.stringify(tag)}.${typeof tag === "string" ? didYouMean(tag, tags) : ""} The tags are ${tags.map((t) => `"${t}"`).join(", ")}.`
        : "No primitive has been applied to this picture, so there is nothing to remove.",
    };
  const removed = (motion.animate ?? []).filter((a) => a?.tag === tag);
  const animate = (motion.animate ?? []).filter((a) => a?.tag !== tag);
  const { svg } = removeTagged(motion.svg, tag);
  const next: SvgMotion = { ...motion, svg };
  if (motion.animate !== undefined || animate.length) next.animate = animate;
  return { ok: true, motion: next, removed };
}
