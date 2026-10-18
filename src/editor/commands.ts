/**
 * The effect editor's commands. Menus, shortcuts, a command palette and
 * agents (through `createCommandToolProvider`) all run these by id, so every
 * entry point shares the same checks and undo steps.
 */

import type { CommandSpec } from "@pixerate/editor/commands";
import { EFFECT_CATEGORIES, EFFECT_CATEGORY_GROUPS, VIDEO_USES, type VectorControl, type VideoUse } from "../catalog/types.js";
import type { SvgEase, SvgMotion } from "../vector/motion.js";
import { getPrimitive, listPrimitives, PRIMITIVE_KINDS, PRIMITIVES, primitiveTags, type PrimitiveKind } from "../motion/index.js";
import { didYouMean } from "../motion/params.js";
import { EFFECT_INPUTS, EFFECT_INTERACTIONS, effectInputs, findEffects, type EffectInput, type EffectInteraction } from "../catalog/index.js";
import type { EditResult, EffectEditor } from "./editor.js";
import { EASING_PRESETS, type Easing } from "./timeline.js";

/** Throws the refusal, so the command registry reports it as a failed command with its message. */
function done(result: EditResult): { ok: true } {
  if (!result.ok) throw new Error(result.message);
  return result;
}

const easingSchema = {
  description: `An easing preset (${EASING_PRESETS.join(", ")}) or {"type":"cubic-bezier","x1","y1","x2","y2"} or {"type":"spring","stiffness","damping","mass"}.`,
} as const;

const valueSchema = {
  description:
    'A control value: a number (float, int), true/false (bool), an array of numbers (vec2–vec4; colours 0–1), a "#RRGGBB" colour, an image URL (sampler2D), or a string (text).',
} as const;

const easeSchema = {
  description: 'The main ease: "linear", "out", "in-out", or a cubic-bezier [x1, y1, x2, y2] (x1 and x2 from 0 to 1; y may overshoot). Default: the primitive\'s.',
} as const;

/** A refusal for a primitive id that does not exist, with the nearest ids. */
function unknownPrimitive(id: unknown): Error {
  const ids = PRIMITIVES.map((p) => p.id);
  return new Error(`There is no primitive ${JSON.stringify(id)}.${typeof id === "string" ? didYouMean(id, ids) : ""} See primitive.list; the ids are ${ids.join(", ")}.`);
}

/** The vector picture being edited, or a refusal for a shader effect. */
function vectorMotion(editor: EffectEditor): SvgMotion {
  const effect = editor.getState().document.effect;
  if (effect.kind !== "vector") throw new Error("This is a shader effect; motion primitives work on a vector effect's picture. Load one first (catalog.search with kind \"vector\", then effect.load).");
  return effect.motion;
}

/** Catalog results `catalog.search` returns when no `limit` is given. */
export const CATALOG_SEARCH_LIMIT = 20;

/** What an agent should know about the compile: the report, or why there is none yet. */
function compileStatus(editor: EffectEditor) {
  const state = editor.getState();
  if (state.document.effect.kind !== "shader") return undefined;
  return state.compile ?? "not compiled yet: no renderer has compiled this source, so compile errors are unknown";
}

/** A summary of the editor's state for agents: the document, controls, values at the playhead, issues and compile errors. */
export function describeEditor(editor: EffectEditor) {
  const state = editor.getState();
  const doc = state.document;
  return {
    name: doc.name,
    basedOn: doc.basedOn,
    kind: doc.effect.kind,
    ...(doc.effect.kind === "shader" ? { source: doc.effect.source } : { motion: doc.effect.motion, ...(doc.effect.controls && { vectorControls: doc.effect.controls }) }),
    controls: state.controls.map((c) => ({
      name: c.name,
      type: c.type,
      label: c.label,
      ...(c.color && { color: true }),
      ...(c.type !== "bool" && c.type !== "sampler2D" && c.type !== "text" && { min: c.min, max: c.max, step: c.step }),
      default: c.default,
    })),
    values: state.values,
    tracks: doc.tracks,
    presets: doc.presets.map((p) => p.name),
    timeline: { duration: doc.duration, loop: doc.loop, time: state.time, playing: state.playing, recording: state.recording },
    issues: state.issues,
    ...(doc.effect.kind === "shader" && { compile: compileStatus(editor) }),
    history: { canUndo: state.history.canUndo, canRedo: state.history.canRedo },
  };
}

/** The effect editor's commands (the registry adds `history.undo` / `history.redo`). */
export function effectCommands(): CommandSpec<EffectEditor>[] {
  return [
    {
      id: "effect.describe",
      label: "Describe effect",
      group: "Effect",
      description: "The effect being edited: its source (or picture), controls, values at the playhead, keyframes, presets, timeline, issues and compile errors.",
      readOnly: true,
      run: (editor) => describeEditor(editor),
    },
    {
      id: "catalog.search",
      label: "Search effects",
      group: "Catalog",
      description: `Searches the built-in effect catalog: {total, effects}, at most \`limit\` effects (default ${CATALOG_SEARCH_LIMIT}). Narrow with words and filters rather than raising the limit. Load one with effect.load to start from it.`,
      readOnly: true,
      params: {
        type: "object",
        properties: {
          text: { type: "string", description: "Words to look for (all must match)." },
          category: { type: "string", enum: EFFECT_CATEGORIES },
          group: {
            type: "string",
            enum: EFFECT_CATEGORY_GROUPS.map((g) => g.name),
            description: `A set of related categories: ${EFFECT_CATEGORY_GROUPS.map((g) => `${g.name} (${g.categories.join(", ")})`).join("; ")}.`,
          },
          kind: { type: "string", enum: ["shader", "vector"] },
          video: {
            type: "array",
            items: { type: "string", enum: VIDEO_USES },
            description: "Only effects that suit video in one of these ways: filter (live video filter), transition (between two clips), interactive (pointer over video), stills (runs on video, made for stills), none.",
          },
          accepts: {
            type: "array",
            items: { type: "string", enum: EFFECT_INPUTS },
            description: "Only effects that can be given all of these: image (a picture), video, svg, text (words), mask (a shape with transparency: icon, logo, word), path (SVG path data).",
          },
          interaction: {
            type: "array",
            items: { type: "string", enum: EFFECT_INTERACTIONS },
            description: "Only effects that answer the pointer in one of these ways: hover, press, click, trail (follows where it has been), pointer (follows where it is). An empty list finds effects that don't answer it.",
          },
          transparent: { type: "boolean", description: "Only overlays (true), drawn over other content, or only effects that fill their frame (false)." },
          limit: { type: "integer", minimum: 1, description: `Most effects to return (default ${CATALOG_SEARCH_LIMIT}).` },
          offset: { type: "integer", minimum: 0, description: "Effects to skip first, to page through more (default 0)." },
        },
        additionalProperties: false,
      },
      run: (
        _,
        params: {
          text?: string;
          category?: (typeof EFFECT_CATEGORIES)[number];
          group?: string;
          kind?: "shader" | "vector";
          video?: VideoUse[];
          accepts?: EffectInput[];
          interaction?: EffectInteraction[];
          transparent?: boolean;
          limit?: number;
          offset?: number;
        },
      ) => {
        const { limit = CATALOG_SEARCH_LIMIT, offset = 0, ...filters } = params ?? {};
        const found = findEffects(filters);
        const effects = found.slice(offset, offset + limit).map((e) => {
          const inputs = effectInputs(e);
          return {
            id: e.id,
            name: e.name,
            kind: e.kind,
            category: e.category,
            description: e.description,
            ...(e.kind === "shader" && e.video ? { video: e.video } : {}),
            accepts: inputs.accepts,
            ...(inputs.interactions.length ? { interactions: inputs.interactions } : {}),
            ...(inputs.transparent ? { transparent: true } : {}),
            presets: e.presets?.map((p) => p.name) ?? [],
          };
        });
        const more = found.length - offset - effects.length;
        return {
          total: found.length,
          effects,
          ...(more > 0 && { more: `${more} more match; narrow the search, or pass offset ${offset + effects.length} for the next ones.` }),
        };
      },
    },
    {
      id: "effect.load",
      label: "Load effect",
      group: "Effect",
      description: "Starts over from a catalog effect (by id, optionally with one of its presets), or from a shader's source.",
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "A catalog effect id (see catalog.search)." },
          preset: { type: "string" },
          source: { type: "string", description: "A shader source to start from instead of a catalog effect." },
          name: { type: "string" },
        },
        additionalProperties: false,
      },
      run: (editor, p: { id?: string; preset?: string; source?: string; name?: string }) =>
        done(p?.source !== undefined ? editor.load({ source: p.source, name: p.name }) : editor.load(p?.id, p?.preset)),
    },
    {
      id: "effect.loadAnimation",
      label: "Open animation",
      group: "Effect",
      description:
        "Starts over from an animation made with @pixerate/editor's animation editor: a MotionScene ({version: 1, name, artwork, shots, controls?, presets?, …}) becomes a vector effect, its colour controls become {{name: color}} placeholders and its presets are kept. Refuses a scene with errors (unknown node ids, malformed commands) and lists them; returns the scene's warnings and the document's issues.",
      params: {
        type: "object",
        properties: {
          scene: { type: "object", description: "The MotionScene, as stored by the animation editor." },
          fps: { type: "number", minimum: 1, maximum: 120, description: "Sampling rate for motion Flair cannot express exactly (default: the scene's fps, else 30)." },
        },
        required: ["scene"],
        additionalProperties: false,
      },
      run: (editor, p: { scene: unknown; fps?: number }) => {
        const result = editor.loadAnimation(p.scene, p.fps ? { fps: p.fps } : {});
        done(result);
        return { ok: true, warnings: result.ok ? (result.warnings ?? []) : [], issues: editor.getState().issues };
      },
    },
    {
      id: "effect.setSource",
      label: "Set shader source",
      group: "Effect",
      description:
        "Replaces a shader effect's GLSL ES 3.00 source (Shadertoy-style mainImage; controls are uniforms annotated `// @control`). Returns the compile report when a preview compiled it (errors carry your source's line numbers), and the document's issues.",
      params: { type: "object", properties: { source: { type: "string" } }, required: ["source"], additionalProperties: false },
      run: (editor, p: { source: string }) => {
        done(editor.setSource(p.source));
        return { ok: true, compile: compileStatus(editor), issues: editor.getState().issues };
      },
    },
    {
      id: "effect.setMotion",
      label: "Set vector picture",
      group: "Effect",
      description:
        "Replaces a vector effect's picture: {svg, animate?}. `svg` is one self-contained <svg> with a viewBox (no scripts); `{{name: type …}}` placeholders in it declare controls and `{{name}}` fills them. `animate` lists changes to elements by id: {id, step?, delay?, ms?, ease?, attrs?: {name: [from, to]}, draw?, view?, along?, count?, write?}. Returns the document's issues.",
      params: {
        type: "object",
        properties: {
          motion: {
            type: "object",
            properties: { svg: { type: "string" }, animate: { type: "array", items: { type: "object" } } },
            required: ["svg"],
            description: "The picture and its animation.",
          },
          controls: {
            type: "array",
            items: { type: "object" },
            description: "Controls declared outside the picture, for older pictures: {name, type, default, label?, color?, min?, max?, step?}. Leave out to keep the current list.",
          },
        },
        required: ["motion"],
        additionalProperties: false,
      },
      run: (editor, p: { motion: SvgMotion; controls?: VectorControl[] }) => {
        done(editor.setMotion(p.motion, p.controls));
        return { ok: true, issues: editor.getState().issues };
      },
    },
    {
      id: "primitive.list",
      label: "List motion primitives",
      group: "Primitives",
      description:
        "Lists the motion primitives: reusable entrances, exits, emphasis and path motions for any element of a vector picture, each {id, kind, name, description, ms, needsBox}. primitive.describe gives one's parameters; primitive.apply puts one on an element.",
      readOnly: true,
      params: {
        type: "object",
        properties: { kind: { type: "string", enum: PRIMITIVE_KINDS, description: "Only this kind: entrance, emphasis, path or exit." } },
        additionalProperties: false,
      },
      run: (_, p: { kind?: PrimitiveKind }) => {
        if (p?.kind !== undefined && !PRIMITIVE_KINDS.includes(p.kind))
          throw new Error(`\`kind\` is one of ${PRIMITIVE_KINDS.join(", ")}; it was given ${JSON.stringify(p.kind)}.`);
        const list = listPrimitives(p?.kind);
        return { total: list.length, primitives: list.map(({ id, kind, name, description, ms, needsBox }) => ({ id, kind, name, description, ms, needsBox })) };
      },
    },
    {
      id: "primitive.describe",
      label: "Describe motion primitive",
      group: "Primitives",
      description: "One motion primitive in full: what it applies to, its parameters (type, default, unit, range or choices), and its default ms and ease.",
      readOnly: true,
      params: {
        type: "object",
        properties: { id: { type: "string", enum: PRIMITIVES.map((p) => p.id), description: "A primitive id from primitive.list, e.g. entrance.pop." } },
        required: ["id"],
        additionalProperties: false,
      },
      run: (_, p: { id: string }) => {
        const primitive = typeof p?.id === "string" ? getPrimitive(p.id) : undefined;
        if (!primitive) throw unknownPrimitive(p?.id);
        return primitive;
      },
    },
    {
      id: "primitive.applied",
      label: "List applied primitives",
      group: "Primitives",
      description: "The motion primitives applied to the vector picture: each use's tag (for primitive.remove), primitive, target and how many animations it added.",
      readOnly: true,
      run: (editor) => {
        const motion = vectorMotion(editor);
        const uses = primitiveTags(motion).map((tag) => {
          const [primitive, rest = ""] = tag.split("@");
          return { tag, primitive, target: rest.replace(/#\d+$/, ""), animations: (motion.animate ?? []).filter((a) => a.tag === tag).length };
        });
        return { total: uses.length, uses };
      },
    },
    {
      id: "primitive.apply",
      label: "Apply motion primitive",
      group: "Primitives",
      description:
        "Puts a motion primitive on one element of the vector picture (by id), as one undo step: its animations are added (tagged), with a wrapper group or clip path round the element where it needs one. Refuses, changing nothing, an unknown primitive or element, bad params or timing. Returns {tag, added, elements, issues}; check the result with view_effect when you can.",
      params: {
        type: "object",
        properties: {
          primitive: { type: "string", enum: PRIMITIVES.map((p) => p.id), description: "A primitive id from primitive.list." },
          target: { type: "string", description: "The id of the element in the picture to move." },
          params: { type: "object", description: "Parameter values by name (primitive.describe lists them); left out, they take their defaults." },
          step: { type: "integer", minimum: 0, description: "The step it plays on: 0 (default) when the picture starts, 1 on the next click or shot, …" },
          delay: { type: "number", minimum: 0, description: "Ms after its step starts (default 0)." },
          ms: { type: "number", exclusiveMinimum: 0, description: "How long it takes, in ms (default: the primitive's)." },
          ease: easeSchema,
          box: {
            type: "array",
            items: { type: "number" },
            minItems: 4,
            maxItems: 4,
            description: "The element's [x, y, width, height] in the viewBox's units, for primitives that need its centre (needsBox) when Flair cannot measure it (text).",
          },
        },
        required: ["primitive", "target"],
        additionalProperties: false,
      },
      run: (editor, p: { primitive: string; target: string; params?: Record<string, unknown>; step?: number; delay?: number; ms?: number; ease?: SvgEase; box?: [number, number, number, number] }) => {
        const result = editor.applyPrimitive(p);
        done(result);
        return { ok: true, tag: result.tag, added: result.added, elements: result.elements, issues: editor.getState().issues };
      },
    },
    {
      id: "primitive.remove",
      label: "Remove motion primitive",
      group: "Primitives",
      description: "Takes off everything one use of a primitive added (by the tag primitive.apply returned, see primitive.applied), as one undo step; the element is put back as it was.",
      params: {
        type: "object",
        properties: { tag: { type: "string", description: 'The use\'s tag, e.g. "entrance.pop@logo".' } },
        required: ["tag"],
        additionalProperties: false,
      },
      run: (editor, p: { tag: string }) => {
        const result = editor.removePrimitive(p?.tag);
        done(result);
        return { ok: true, removed: result.removed, issues: editor.getState().issues };
      },
    },
    {
      id: "effect.rename",
      label: "Rename effect",
      group: "Effect",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.rename(p.name)),
    },
    {
      id: "values.set",
      label: "Set values",
      group: "Values",
      description: "Sets control values by name, all or nothing. A keyframed control (or any, while recording) gets a keyframe at the playhead instead.",
      params: {
        type: "object",
        properties: { values: { type: "object", additionalProperties: valueSchema, description: "Control name → value." } },
        required: ["values"],
        additionalProperties: false,
      },
      run: (editor, p: { values: Record<string, unknown> }) => done(editor.setValues(p.values)),
    },
    {
      id: "values.reset",
      label: "Reset values",
      group: "Values",
      description: "Puts controls back to their defaults: the named ones, or all.",
      params: { type: "object", properties: { names: { type: "array", items: { type: "string" } } }, additionalProperties: false },
      run: (editor, p: { names?: string[] }) => done(editor.resetValues(p?.names)),
    },
    {
      id: "values.randomize",
      label: "Randomize values",
      group: "Values",
      keywords: ["shuffle", "surprise", "explore"],
      params: { type: "object", properties: { names: { type: "array", items: { type: "string" } } }, additionalProperties: false },
      run: (editor, p: { names?: string[] }) => done(editor.randomize(p?.names)),
    },
    {
      id: "preset.apply",
      label: "Apply preset",
      group: "Presets",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.applyPreset(p.name)),
    },
    {
      id: "preset.save",
      label: "Save preset",
      group: "Presets",
      description: "Saves the values at the playhead (all, or the named controls) as a preset.",
      params: {
        type: "object",
        properties: { name: { type: "string" }, names: { type: "array", items: { type: "string" } } },
        required: ["name"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; names?: string[] }) => done(editor.savePreset(p.name, p.names)),
    },
    {
      id: "preset.delete",
      label: "Delete preset",
      group: "Presets",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.deletePreset(p.name)),
    },
    {
      id: "keyframe.set",
      label: "Set keyframe",
      group: "Keyframes",
      description: "Keyframes a control at a time (ms). Without a value, keyframes its current value there. The easing shapes the segment leaving this keyframe.",
      params: {
        type: "object",
        properties: { name: { type: "string" }, time: { type: "number", minimum: 0 }, value: valueSchema, easing: easingSchema },
        required: ["name", "time"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; time: number; value?: unknown; easing?: Easing }) => done(editor.setKeyframe(p.name, p.time, p.value, p.easing)),
    },
    {
      id: "keyframe.remove",
      label: "Delete keyframe",
      group: "Keyframes",
      params: { type: "object", properties: { name: { type: "string" }, time: { type: "number" } }, required: ["name", "time"], additionalProperties: false },
      run: (editor, p: { name: string; time: number }) => done(editor.removeKeyframe(p.name, p.time)),
    },
    {
      id: "keyframe.setEasing",
      label: "Set keyframe easing",
      group: "Keyframes",
      params: {
        type: "object",
        properties: { name: { type: "string" }, time: { type: "number" }, easing: easingSchema },
        required: ["name", "time", "easing"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; time: number; easing: Easing }) => done(editor.setKeyframeEasing(p.name, p.time, p.easing)),
    },
    {
      id: "keyframe.setTrack",
      label: "Set keyframes",
      group: "Keyframes",
      description: "Replaces all of a control's keyframes at once (an empty list removes them). Times are ms; each easing shapes the segment leaving its keyframe.",
      params: {
        type: "object",
        properties: {
          name: { type: "string" },
          keyframes: {
            type: "array",
            items: {
              type: "object",
              properties: { time: { type: "number", minimum: 0 }, value: valueSchema, easing: easingSchema },
              required: ["time", "value"],
            },
          },
        },
        required: ["name", "keyframes"],
        additionalProperties: false,
      },
      run: (editor, p: { name: string; keyframes: { time: number; value: unknown; easing?: unknown }[] }) => done(editor.setTrack(p.name, { keyframes: p.keyframes })),
    },
    {
      id: "keyframe.clear",
      label: "Clear keyframes",
      group: "Keyframes",
      description: "Removes a control's keyframes; it keeps the value it has at the playhead.",
      params: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: (editor, p: { name: string }) => done(editor.clearTrack(p.name)),
    },
    {
      id: "timeline.setTiming",
      label: "Set timing",
      group: "Timeline",
      params: {
        type: "object",
        properties: { duration: { type: "number", exclusiveMinimum: 0, description: "Ms." }, loop: { type: "boolean" } },
        additionalProperties: false,
      },
      run: (editor, p: { duration?: number; loop?: boolean }) => done(editor.setTiming(p ?? {})),
    },
    {
      id: "timeline.play",
      label: "Play",
      group: "Timeline",
      run: (editor) => editor.play(),
    },
    {
      id: "timeline.pause",
      label: "Pause",
      group: "Timeline",
      run: (editor) => editor.pause(),
    },
    {
      id: "timeline.toggle",
      label: "Play / pause",
      group: "Timeline",
      shortcut: "Space",
      run: (editor) => editor.toggle(),
    },
    {
      id: "timeline.seek",
      label: "Go to time",
      group: "Timeline",
      params: { type: "object", properties: { time: { type: "number", minimum: 0, description: "Ms." } }, required: ["time"], additionalProperties: false },
      run: (editor, p: { time: number }) => editor.seek(p.time),
    },
    {
      id: "timeline.stop",
      label: "Stop",
      group: "Timeline",
      run: (editor) => editor.stop(),
    },
    {
      id: "timeline.toggleRecording",
      label: "Record keyframes",
      group: "Timeline",
      description: "While recording, changing a value keyframes it at the playhead.",
      run: (editor) => editor.setRecording(!editor.getState().recording),
    },
  ];
}
