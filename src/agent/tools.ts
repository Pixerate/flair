import type { Scene, Shot } from '../scene/types.js';
import { validateScene, type SceneIssue } from '../scene/validate.js';
import { checkSceneLayers } from '../scene/layercheck.js';
import { layerKey, layerRole, layerWhat, isSlot, type LayerTime } from '../scene/layers.js';
import { simulateScene } from '../scene/player.js';
import type { Review } from '../scene/report.js';
import { applyRig, setRigWidget } from '../scene/rig.js';
import { cameraEffects, cameraMoveControls } from '../catalog/camera.js';
import { applySceneBatch } from './batch.js';
import { checkSchema } from './schema.js';

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** How a shot arranges layers, a transition, copies and paths, for the tools' descriptions. */
const SHOT_GUIDE =
  'A shot\'s "layers" are catalog effects ({"effect": id, "preset"?, "values"?}), custom shaders ({"source": GLSL with void mainImage}) or bare pictures, each with an optional "subject" ({"image": url}, {"video": url}, {"svg": markup}, {"text": words}, or {"slot": name} that the host fills when it plays or records), a "role" ("background", "subject" or "overlay"), a place on the board ("rect" {x, y, width, height} or "ids" of elements; without either it fills the screen), "from"/"until" (ms after the shot starts, or {"shots": n}; by default it lasts until the next shot), "opacity" and "fade" (ms). find_layer_effects finds effects and what they take. A shot\'s "transition" is a catalog transition from the last shot ({"effect": "transition-wipe", "ms"?, "preset"?, "values"?}); without a camera "in" the camera cuts and the transition does the move. A run command {"type": "replicate", "element": {...}, "pattern": "grid"|"line"|"circle"|"spiral", "count"} draws copies <id>_0…, and a behavior {"type": "path", "target": id, "waypoints": [{"point": [x, y]}, ...], "orient"?} moves an element along a curve while the shot holds.';

export const FLAIR_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'get_scene',
    description: 'Returns the current scene JSON, or with view "outline" a concise structural outline instead, and any static validation issues. Start here.',
    input_schema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['full', 'outline'],
          description:
            'When "outline", returns scene hierarchy, timing, and framing without dense commands or raw media sources.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'write_scene',
    description: 'Overwrites the entire scene with a new specification and validates it. Prefer update_shot, insert_shots and delete_shots for smaller changes.',
    input_schema: {
      type: 'object',
      properties: {
        scene: {
          type: 'object',
          description:
            'Full Scene object with name, stage and shots. ' + SHOT_GUIDE + ' A shot camera frames a box {x, y, width, height} or elements {frame: [ids]}, and may add tilt, turn, roll (degrees, tilt/turn up to 75) and perspective (default 1.2); angles persist until changed. Its "in" is the camera move into the shot ("camera-glide" by default; "camera-whip-pan", "camera-punch-zoom", "camera-cut") and its "during" a move while the shot holds ("camera-ken-burns", "camera-crash-zoom", "camera-handheld"): an id, or {move, ms?, preset?, values?} like {"move": "camera-whip-pan", "values": {"motionBlur": 3}}. find_camera_moves lists the moves with their controls.',
        },
      },
      required: ['scene'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_shot',
    description: 'Updates fields of a specific shot (1-based index) without rewriting the whole scene.',
    input_schema: {
      type: 'object',
      properties: {
        shot: { type: 'integer', minimum: 1, description: '1-based index of the shot to update.' },
        set: {
          type: 'object',
          description: 'Fields to set or replace on this shot: caption, title, camera, hold (ms), run, layers, transition, behaviors. ' + SHOT_GUIDE,
        },
        remove: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field names to delete from this shot.',
        },
      },
      required: ['shot'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_shots',
    description: 'Inserts one or more shots at a given position.',
    input_schema: {
      type: 'object',
      properties: {
        after: {
          type: 'integer',
          minimum: 0,
          description: '0 to insert at the beginning, or 1-based index of shot to insert after.',
        },
        shots: {
          type: 'array',
          items: { type: 'object' },
          description: 'Shot objects to insert (fields as for update_shot).',
        },
      },
      required: ['after', 'shots'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_shots',
    description: 'Deletes one or more shots by 1-based index.',
    input_schema: {
      type: 'object',
      properties: {
        shots: {
          type: 'array',
          items: { type: 'integer', minimum: 1 },
          description: '1-based shot numbers to delete.',
        },
      },
      required: ['shots'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_layer_effects',
    description:
      'Searches the catalog for effects a shot can use as layers (shader and vector effects) or as its transition, with what each takes as a subject, its controls (name, type, range, default) and presets. Results are limited; "total" says how many match, and "offset" pages through them.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Words to look for in the id, name, description, category and tags (all must match).' },
        accepts: { type: 'array', items: { type: 'string', enum: ['image', 'video', 'svg', 'text'] }, description: 'Only effects that take all of these as a subject.' },
        kind: { type: 'string', enum: ['shader', 'vector'], description: 'Only shaders (WebGL) or only vector (animated SVG) effects.' },
        transition: { type: 'boolean', description: 'true: only transitions (for a shot\'s "transition"); false: only effects for "layers".' },
        transparent: { type: 'boolean', description: 'true: only shaders that draw over what is under them (overlays).' },
        limit: { type: 'integer', minimum: 1, description: 'How many to return (default 10, at most 50).' },
        offset: { type: 'integer', minimum: 0, description: 'How many matches to skip, to page through them (default 0).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'find_camera_moves',
    description:
      'Lists the camera moves a shot can use: "transition" moves for its camera "in" (how the camera gets into the shot) and "hold" moves for its camera "during" (how it moves while the shot holds), each with its controls, defaults and presets.',
    input_schema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['transition', 'hold'], description: 'Only moves for camera "in" (transition) or camera "during" (hold).' },
        text: { type: 'string', description: 'Words to look for in the id, name, description and tags (all must match).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'preview_scene',
    description: 'Simulates the scene fast and off-screen, returning its total length, layout and timing warnings, and notes. Run it after a round of edits.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'set_rig_widget',
    description: 'Adjusts a high-level creative rig widget (slider, popup, or toggle) and propagates parameters to shaders and elements.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Rig widget identifier/name.' },
        value: {
          type: ['number', 'string', 'boolean'],
          description: 'New value (number for slider, string for popup, boolean for toggle).',
        },
      },
      required: ['name', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_scene',
    description:
      'Runs several of these tools in order as one all-or-nothing change: if a step fails, none of the steps apply. A string param "$N.path" is replaced by that path in step N\'s result (1-based; e.g. "$1.output.outline.shots[0].hold" or "$2.scene.shots[1].title"), and "$N.path" inside a longer string is filled in; a reference that does not resolve fails its step.',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'A tool name (not batch_scene).' },
              params: { type: 'object', description: 'That tool\'s arguments.' },
            },
            required: ['tool'],
            additionalProperties: false,
          },
          description: 'The tool calls to run, in order.',
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
  },
];

/** A layer as the outline lists it: what it draws, where, and when. */
export interface SceneOutlineLayer {
  /** Its id, or `shot<N>.layer<M>`. */
  layer: string;
  /** Its effect's id, `shader` for a custom source, or `picture`. */
  draws: string;
  role: string;
  /** The slot its subject comes from, when the host fills it. */
  slot?: string;
  from?: LayerTime;
  until?: LayerTime;
}

export interface SceneOutlineShot {
  shot: number;
  caption?: string;
  title?: string;
  hold?: number;
  camera?: Shot['camera'];
  commandCount: number;
  layers?: SceneOutlineLayer[];
  /** The transition into it, by id. */
  transition?: string;
}

export interface SceneOutline {
  name: string;
  title?: string;
  description?: string;
  stage?: Scene['stage'];
  target?: Scene['target'];
  /** The slots the host fills, by name. */
  slots: string[];
  shots: SceneOutlineShot[];
}

export type SceneToolResult =
  | {
      ok: true;
      /** The scene after the tool ran: keep it as the new state. */
      scene: Scene;
      outline?: SceneOutline;
      issues: SceneIssue[];
      review?: Review;
      /**
       * What to send back to the model as the tool's result: only what the
       * call asked for (the outline without the full scene, a summary of an
       * edit, the review without its markdown), so the conversation stays small.
       */
      output: SceneToolOutput;
    }
  | { ok: false; error: string; failedStep?: number; output: SceneToolOutput };

/** The model-facing result of a scene tool call (see `SceneToolResult.output`). */
export type SceneToolOutput = { ok: boolean; [field: string]: unknown };

/** The names of the scene tools, for listing them in refusals. */
const TOOL_NAMES = FLAIR_AGENT_TOOLS.map((t) => t.name);

function fail(error: string, failedStep?: number): SceneToolResult {
  return { ok: false, error, ...(failedStep !== undefined && { failedStep }), output: { ok: false, error } };
}

/** A scene's issues: its shape (`validateScene`), then its layers' presets and values against the catalog (`checkSceneLayers`). */
async function sceneIssues(scene: Scene): Promise<SceneIssue[]> {
  const issues = validateScene(scene);
  for (const issue of await checkSceneLayers(scene)) if (!issues.some((i) => i.shot === issue.shot && i.message === issue.message)) issues.push(issue);
  return issues;
}

/** An edited scene, with its issues and a one-line summary for the model. */
async function edited(scene: Scene, summary: string): Promise<SceneToolResult> {
  const issues = await sceneIssues(scene);
  return { ok: true, scene, issues, output: { ok: true, summary, shotCount: scene.shots.length, issues } };
}

const shotsWord = (n: number) => `${n} shot${n === 1 ? '' : 's'}`;

export function outlineScene(scene: Scene): SceneOutline {
  return {
    name: scene.name,
    title: scene.title,
    description: scene.description,
    stage: scene.stage,
    target: scene.target,
    slots: [...new Set(scene.shots.flatMap((s) => (Array.isArray(s.layers) ? s.layers : []).map((l) => (isSlot(l?.subject) ? l.subject.slot : undefined)).filter((x): x is string => !!x)))],
    shots: scene.shots.map((s, i) => ({
      shot: i + 1,
      caption: s.caption,
      title: s.title,
      hold: s.hold,
      camera: s.camera,
      commandCount: Array.isArray(s.run) ? s.run.length : 0,
      ...(Array.isArray(s.layers) && s.layers.length
        ? {
            layers: s.layers.map((l, j) => ({
              layer: layerKey(l ?? {}, i, j),
              draws: layerWhat(l ?? {}),
              role: layerRole(l ?? {}),
              ...(isSlot(l?.subject) ? { slot: l.subject.slot } : {}),
              ...(l?.from !== undefined ? { from: l.from } : {}),
              ...(l?.until !== undefined ? { until: l.until } : {}),
            })),
          }
        : {}),
      ...(s.transition && typeof s.transition.effect === 'string' ? { transition: s.transition.effect } : {}),
    })),
  };
}

/**
 * Pure state machine that applies tool operations to a Scene. Arguments are
 * checked against the tool's `input_schema` first; a refusal (`ok: false`)
 * leaves the scene as it was and says what to fix. Send `result.output` to
 * the model and keep `result.scene` as the new state.
 */
export async function applySceneTool(
  scene: Scene,
  toolName: string,
  input: Record<string, any> = {},
): Promise<SceneToolResult> {
  const definition = FLAIR_AGENT_TOOLS.find((t) => t.name === toolName);
  if (!definition) {
    return fail(`There is no tool "${toolName}"; the tools are ${TOOL_NAMES.join(', ')}.`);
  }
  const problems = checkSchema(definition.input_schema, input ?? {});
  if (problems.length) return fail(`Invalid arguments for ${toolName}: ${problems.join(' ')}`);
  const shotCount = scene.shots.length;
  const shotRange = `the scene has ${shotsWord(shotCount)} (1 to ${shotCount})`;

  switch (toolName) {
    case 'get_scene': {
      const issues = await sceneIssues(scene);
      if (input.view === 'outline') {
        const outline = outlineScene(scene);
        return { ok: true, scene, outline, issues, output: { ok: true, outline, issues } };
      }
      return { ok: true, scene, issues, output: { ok: true, scene, issues } };
    }

    case 'write_scene': {
      const next = input.scene as Scene;
      if (!Array.isArray(next.shots) || next.shots.some((s) => !s || typeof s !== 'object' || Array.isArray(s))) {
        return fail('The scene needs a shots array of shot objects; nothing was written.');
      }
      if (next.shots.length === 0) return fail('The scene needs at least one shot; nothing was written.');
      return edited(next, `Wrote the scene "${next.name}" with ${shotsWord(next.shots.length)}.`);
    }

    case 'update_shot': {
      const idx = input.shot - 1;
      if (idx >= shotCount) return fail(`There is no shot ${input.shot}; ${shotRange}.`);
      if (input.set === undefined && input.remove === undefined) {
        return fail('Give fields to change in "set", field names to delete in "remove", or both.');
      }
      const updated: Record<string, any> = { ...scene.shots[idx]!, ...(input.set || {}) };
      for (const k of input.remove ?? []) delete updated[k];
      const shots = [...scene.shots];
      shots[idx] = updated as Shot;
      const changed = [...Object.keys(input.set ?? {}), ...(input.remove ?? []).map((k: string) => `-${k}`)];
      return edited({ ...scene, shots }, `Updated shot ${input.shot} (${changed.join(', ')}).`);
    }

    case 'insert_shots': {
      const after = input.after;
      if (after > shotCount) return fail(`Cannot insert after shot ${after}; ${shotRange}, so "after" is 0 to ${shotCount}.`);
      if (input.shots.length === 0) return fail('Give at least one shot to insert.');
      const shots = [...scene.shots.slice(0, after), ...input.shots, ...scene.shots.slice(after)];
      const first = after + 1;
      const last = after + input.shots.length;
      return edited(
        { ...scene, shots },
        `Inserted ${shotsWord(input.shots.length)} as ${first === last ? `shot ${first}` : `shots ${first}-${last}`}; later shots moved down.`,
      );
    }

    case 'delete_shots': {
      const numbers: number[] = input.shots;
      if (numbers.length === 0) return fail('Give the shot numbers to delete.');
      const missing = numbers.filter((n) => n > shotCount);
      if (missing.length) return fail(`There is no shot ${missing.join(', ')}; ${shotRange}. Nothing was deleted.`);
      const toDelete = new Set(numbers.map((n) => n - 1));
      const shots = scene.shots.filter((_, i) => !toDelete.has(i));
      if (shots.length === 0) return fail('Cannot delete every shot; a scene needs at least one. Nothing was deleted.');
      return edited({ ...scene, shots }, `Deleted ${shotsWord(toDelete.size)}; the scene has ${shotsWord(shots.length)} now.`);
    }

    case 'find_layer_effects': {
      const { EFFECT_META } = await import('../catalog/lazy.js');
      const words = String(input.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const accepts: string[] = input.accepts ?? [];
      const limit = Math.min(50, input.limit ?? 10);
      const offset = input.offset ?? 0;
      const matches = EFFECT_META.filter((m) => m.kind !== 'camera')
        .filter((m) => !input.kind || m.kind === input.kind)
        .filter((m) => input.transition === undefined || (m.video === 'transition') === input.transition)
        .filter((m) => input.transparent === undefined || !!m.transparent === input.transparent)
        .filter((m) => accepts.every((a) => m.inputs.accepts.includes(a as never) || (a === 'text' && m.inputs.accepts.includes('mask'))))
        .filter((m) => words.every((w) => [m.id, m.name, m.description, m.category, ...m.tags].join(' ').toLowerCase().includes(w)));
      const player = ['uFrom', 'uTo', 'uProgress', 'uAnimate'];
      const effects = matches.slice(offset, offset + limit).map((m) => {
        const transition = m.video === 'transition';
        return {
          id: m.id,
          name: m.name,
          kind: m.kind,
          goesIn: transition ? 'transition' : 'layers',
          description: m.description,
          accepts: m.inputs.accepts.filter((a) => ['image', 'video', 'svg', 'text', 'mask'].includes(a)),
          ...(m.transparent ? { transparent: true } : {}),
          controls: m.controls
            .filter((c) => !(transition && player.includes(c.name)) && !m.inputs.images.some((x) => x.name === c.name))
            .map((c) => ({ name: c.name, type: c.type, ...(c.type === 'float' || c.type === 'int' ? { min: c.min, max: c.max } : {}), default: c.default })),
          presets: m.presets,
        };
      });
      const output: SceneToolOutput = { ok: true, total: matches.length, effects };
      if (matches.length > offset + effects.length) output.more = `${matches.length - offset - effects.length} more match; ask again with offset ${offset + effects.length}, or narrow with text, accepts or kind.`;
      if (!matches.length) output.note = `No layer effect matches${words.length ? ` "${words.join(' ')}"` : ''}${accepts.length ? ` taking ${accepts.join(' and ')}` : ''}; try fewer words, or leave out a filter.`;
      return { ok: true, scene, issues: [], output };
    }

    case 'find_camera_moves': {
      const words = String(input.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const moves = cameraEffects
        .filter((m) => !input.role || m.motion.role === input.role)
        .filter((m) => words.every((w) => [m.id, m.name, m.description, ...m.tags].join(' ').toLowerCase().includes(w)))
        .map((m) => ({
          id: m.id,
          name: m.name,
          role: m.motion.role,
          field: m.motion.role === 'transition' ? 'in' : 'during',
          ...(m.motion.role === 'transition' && { ms: m.motion.duration }),
          description: m.description,
          controls: cameraMoveControls(m).map((c) => ({ name: c.name, type: c.type, label: c.label, min: c.min, max: c.max, default: c.default })),
          presets: (m.presets ?? []).map((p) => p.name),
        }));
      const note = moves.length ? undefined : `No camera move matches; there are ${cameraEffects.length}: ${cameraEffects.map((m) => m.id).join(', ')}.`;
      return { ok: true, scene, issues: [], output: { ok: true, total: moves.length, moves, ...(note && { note }) } };
    }

    case 'preview_scene': {
      const { review } = await simulateScene(scene);
      const issues = await sceneIssues(scene);
      const { markdown: _markdown, ...summary } = review;
      return { ok: true, scene, issues, review, output: { ok: true, issues, review: summary } };
    }

    case 'set_rig_widget': {
      const widgets = scene.rig?.widgets ?? {};
      if (!scene.rig || !widgets[input.name]) {
        const names = Object.keys(widgets);
        return fail(`Scene does not have a rig widget named "${input.name}"; ${names.length ? `its widgets are ${names.join(', ')}` : 'it has no rig widgets'}.`);
      }
      try {
        const updatedRig = setRigWidget(scene.rig, input.name, input.value);
        return edited(applyRig(updatedRig, scene), `Set rig widget "${input.name}" to ${JSON.stringify(input.value)}.`);
      } catch (err: any) {
        return fail(err.message || String(err));
      }
    }

    case 'batch_scene': {
      const batch = await applySceneBatch(scene, input.steps);
      if (!batch.ok) return fail(`${batch.error} No steps were applied.`, batch.failedStep);
      const issues = await sceneIssues(batch.scene);
      return {
        ok: true,
        scene: batch.scene,
        issues,
        output: {
          ok: true,
          summary: `Ran ${batch.steps.length} step${batch.steps.length === 1 ? '' : 's'}.`,
          steps: batch.steps.map((s) => ({ step: s.step, tool: s.tool, ...s.result.output })),
          shotCount: batch.scene.shots.length,
          issues,
        },
      };
    }
  }
  return fail(`There is no tool "${toolName}".`);
}
