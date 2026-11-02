/**
 * Flair's sequence templates as the editor's contract sees them: summaries,
 * slots shaped for a form, and a filled template's scene as an
 * `EffectSequence` (shots of catalog effect layers, catalog transitions and
 * camera moves). What a sequence cannot carry is named in its notes.
 */

import type {
  CameraMoveSpec,
  EffectLayer,
  EffectSequence,
  EffectSequenceShot,
  EffectShotTransition,
  EffectTemplateDescription,
  EffectTemplateSlot,
  EffectTemplateSummary,
  EffectValue,
} from "@pixerate/editor/effects";
import { boundsOf, type Rect } from "../scene/geometry.js";
import { boardHeight, type View } from "../scene/camera.js";
import { cameraTrack, sceneStage } from "../scene/cameratrack.js";
import { DEFAULT_CAMERA_MOVE } from "../scene/moves.js";
import { describeTemplateSlots, instantiateTemplate, type SceneTemplate } from "../scene/template.js";
import { sceneTimeline } from "../scene/timeline.js";
import type { SceneLayer, ShotTransition } from "../scene/layers.js";
import type { Scene } from "../scene/types.js";

/** A template's summary: its shots and, with its defaults filled in, how long it plays. */
export function templateSummaryOf(template: SceneTemplate): EffectTemplateSummary {
  const filled = instantiateTemplate(template);
  const durationMs = filled.ok ? Math.round(sceneTimeline(filled.scene).durationMs) : undefined;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    ...(template.tags?.length && { tags: template.tags }),
    shots: template.scene.shots.length,
    ...(durationMs !== undefined && { durationMs }),
  };
}

export function templateDescriptionOf(template: SceneTemplate): EffectTemplateDescription {
  return { ...templateSummaryOf(template), slots: describeTemplateSlots(template) as unknown as EffectTemplateSlot[] };
}

/** To hundredths, and never -0 (which a saved document would keep). */
const round = (n: number) => Math.round(n * 100) / 100 + 0;

/** What the camera sees with this view, as a box in scene units. */
function framingOf(view: View, stage: { width: number; height: number; caption?: number }): Rect {
  return { x: round(-view.scrollX), y: round(-view.scrollY), width: round(stage.width / view.zoom), height: round(boardHeight(stage) / view.zoom) };
}

const values = (v: SceneLayer["values"]) => v as Record<string, EffectValue> | undefined;

/**
 * A filled scene as a sequence, for a provider whose catalog has the effects
 * `offered` says it does. Each shot's framing is where Flair's camera
 * settles (dynamic framings worked out), layers placed by elements get those
 * elements' box, and what a sequence cannot carry (custom shaders, element
 * commands, behaviors, camera angles, effects not offered) is left out with
 * a note.
 */
export function sequenceOf(scene: Scene, offered: (id: string) => boolean): { sequence: EffectSequence; notes: string[] } {
  const notes: string[] = [];
  const stage = sceneStage(scene);
  const track = cameraTrack(scene);
  const shots = scene.shots.map((shot, s): EffectSequenceShot => {
    const at = `Shot ${s + 1}`;
    const entry = track[s]!;
    const lens = shot.camera;
    const move = (spec: CameraMoveSpec | undefined, field: "in" | "during") => {
      if (spec === undefined) return undefined;
      const id = typeof spec === "string" ? spec : spec.move;
      if (offered(id)) return spec;
      notes.push(`${at}: its camera move "${id}" (camera.${field}) is left out, as this provider does not offer camera moves.`);
      return undefined;
    };
    // Flair glides into a shot whose camera names no move; say so, so an editor plays the same.
    const into = move(s > 0 && lens ? ((lens.in as CameraMoveSpec | undefined) ?? DEFAULT_CAMERA_MOVE) : undefined, "in");
    const during = move(lens?.during as CameraMoveSpec | undefined, "during");
    if (entry.to.tilt || entry.to.turn || entry.to.roll) notes.push(`${at}: its camera angle (tilt, turn or roll) is left out; the sequence frames it flat.`);
    if (shot.run?.length) notes.push(`${at}: its ${shot.run.length} element command${shot.run.length === 1 ? "" : "s"} (run) are left out; a sequence has only layers.`);
    if (shot.behaviors?.length) notes.push(`${at}: its behaviors are left out.`);

    const layers: EffectLayer[] = [];
    (shot.layers ?? []).forEach((layer, i) => {
      const name = layer.id ? `layer "${layer.id}"` : `layer ${i + 1}`;
      if (layer.source !== undefined) return notes.push(`${at}: ${name} is a custom shader (source), which a sequence cannot carry; it is left out.`);
      if (layer.effect !== undefined && !offered(layer.effect)) return notes.push(`${at}: ${name}'s effect "${layer.effect}" is not offered by this provider; it is left out.`);
      const { ids, padding, source: _source, values: given, ...rest } = layer;
      let rect = layer.rect;
      if (ids?.length) {
        const placed = entry.elements.filter((e) => ids.includes(e.id)).map(boundsOf);
        if (!placed.length) return notes.push(`${at}: ${name} is placed by elements ${ids.join(", ")}, which are not on the board; it is left out.`);
        const pad = padding ?? 0;
        const x = Math.min(...placed.map((b) => b.x)) - pad;
        const y = Math.min(...placed.map((b) => b.y)) - pad;
        rect = { x, y, width: Math.max(...placed.map((b) => b.x + b.width)) + pad - x, height: Math.max(...placed.map((b) => b.y + b.height)) + pad - y };
        notes.push(`${at}: ${name} is placed by elements; the sequence places it at their box when the shot starts, and it does not follow them.`);
      }
      layers.push({ ...rest, ...(given && { values: values(given) }), ...(rect && { rect }) } as EffectLayer);
    });

    let transition: EffectShotTransition | undefined;
    const t: ShotTransition | undefined = shot.transition;
    if (t && s > 0) {
      if (offered(t.effect)) transition = { ...t, ...(t.values && { values: values(t.values) }) } as EffectShotTransition;
      else notes.push(`${at}: its transition "${t.effect}" is not offered by this provider; it is left out.`);
    }

    const camera = { framing: framingOf(entry.to, stage), ...(into !== undefined && { in: into }), ...(during !== undefined && { during }) };
    return {
      hold: entry.holdMs,
      ...(shot.title !== undefined && { title: shot.title }),
      ...(shot.caption !== undefined && { caption: shot.caption }),
      camera,
      layers,
      ...(transition && { transition }),
    };
  });
  if (scene.rig) notes.push("The scene's rig is left out.");
  return { sequence: { name: scene.name, ...(scene.title !== undefined && { title: scene.title }), stage: { width: stage.width, height: stage.height }, shots }, notes };
}
