import type { Scene, SceneMedia, Shot } from '../scene/types.js';
import { validateScene, type SceneIssue } from '../scene/validate.js';
import { simulateScene } from '../scene/player.js';
import type { Review } from '../scene/report.js';
import { applyRig, setRigWidget } from '../scene/rig.js';

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const FLAIR_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'get_scene',
    description: 'Returns the current scene JSON and any static validation issues.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'write_scene',
    description: 'Overwrites the entire scene with a new specification and validates it.',
    input_schema: {
      type: 'object',
      properties: {
        scene: {
          type: 'object',
          description:
            'Full Scene object with name, stage, media, and shots. A shot camera frames a box {x, y, width, height} or elements {frame: [ids]}, and may add tilt, turn, roll (degrees, tilt/turn up to 75), perspective (default 1.2) and motionBlur (0-3, 1 natural); angles persist until changed.',
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
        set: { type: 'object', description: 'Fields to set or replace on this shot.' },
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
          description: 'Array of Shot objects to insert.',
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
    name: 'set_media',
    description: 'Adds, updates, or removes embedded media (e.g. bespoke WebGL shaders) by ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Media identifier.' },
        media: {
          type: ['object', 'null'],
          description: 'SceneMedia object (e.g. { type: "shader", source: "..." }), or null to remove.',
        },
      },
      required: ['id', 'media'],
      additionalProperties: false,
    },
  },
  {
    name: 'preview_scene',
    description: 'Simulates the scene fast and off-screen, returning timing, layout checks, and review report.',
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
];

export type SceneToolResult =
  | { ok: true; scene: Scene; issues: SceneIssue[]; review?: Review }
  | { ok: false; error: string };

/**
 * Pure state machine that applies tool operations to a Scene.
 */
export async function applySceneTool(
  scene: Scene,
  toolName: string,
  input: Record<string, any> = {},
): Promise<SceneToolResult> {
  switch (toolName) {
    case 'get_scene': {
      return { ok: true, scene, issues: validateScene(scene) };
    }

    case 'write_scene': {
      if (!input.scene || typeof input.scene !== 'object') {
        return { ok: false, error: 'Expected scene object in arguments.' };
      }
      const newScene = input.scene as Scene;
      const issues = validateScene(newScene);
      return { ok: true, scene: newScene, issues };
    }

    case 'update_shot': {
      const idx = input.shot - 1;
      if (idx < 0 || idx >= scene.shots.length) {
        return { ok: false, error: `Invalid shot number ${input.shot}; scene has ${scene.shots.length} shots.` };
      }
      const existing = scene.shots[idx]!;
      const updated: Record<string, any> = { ...existing, ...(input.set || {}) };
      if (Array.isArray(input.remove)) {
        for (const k of input.remove) {
          delete updated[k];
        }
      }
      const shots = [...scene.shots];
      shots[idx] = updated as Shot;
      const newScene = { ...scene, shots };
      return { ok: true, scene: newScene, issues: validateScene(newScene) };
    }

    case 'insert_shots': {
      const after = input.after ?? scene.shots.length;
      if (after < 0 || after > scene.shots.length) {
        return { ok: false, error: `Invalid after index ${after}.` };
      }
      if (!Array.isArray(input.shots) || input.shots.length === 0) {
        return { ok: false, error: 'Expected non-empty shots array to insert.' };
      }
      const shots = [...scene.shots.slice(0, after), ...input.shots, ...scene.shots.slice(after)];
      const newScene = { ...scene, shots };
      return { ok: true, scene: newScene, issues: validateScene(newScene) };
    }

    case 'delete_shots': {
      if (!Array.isArray(input.shots) || input.shots.length === 0) {
        return { ok: false, error: 'Expected non-empty shots array to delete.' };
      }
      const toDelete = new Set(input.shots.map((n: number) => n - 1));
      const shots = scene.shots.filter((_, i) => !toDelete.has(i));
      if (shots.length === 0) {
        return { ok: false, error: 'Cannot delete all shots in scene.' };
      }
      const newScene = { ...scene, shots };
      return { ok: true, scene: newScene, issues: validateScene(newScene) };
    }

    case 'set_media': {
      if (!input.id || typeof input.id !== 'string') {
        return { ok: false, error: 'Expected string media id.' };
      }
      const media = { ...(scene.media || {}) };
      if (input.media === null) {
        delete media[input.id];
      } else {
        media[input.id] = input.media as SceneMedia;
      }
      const newScene = { ...scene, media };
      return { ok: true, scene: newScene, issues: validateScene(newScene) };
    }

    case 'preview_scene': {
      const { review } = await simulateScene(scene);
      return { ok: true, scene, issues: validateScene(scene), review };
    }

    case 'set_rig_widget': {
      if (!scene.rig || !scene.rig.widgets || !scene.rig.widgets[input.name]) {
        return { ok: false, error: `Scene does not have a rig widget named "${input.name}".` };
      }
      try {
        const updatedRig = setRigWidget(scene.rig, input.name, input.value);
        const newScene = applyRig(updatedRig, scene);
        return { ok: true, scene: newScene, issues: validateScene(newScene) };
      } catch (err: any) {
        return { ok: false, error: err.message || String(err) };
      }
    }

    default:
      return { ok: false, error: `Unknown tool name: ${toolName}` };
  }
}
