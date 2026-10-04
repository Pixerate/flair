import type { Scene, Shot } from './types.js';
import { EFFECT_TYPES } from './effects.js';

export interface SceneIssue {
  /** 1-based shot index (0 indicates whole scene level). */
  shot: number;
  message: string;
}

const LONG_CAPTION = 120;
const LONG_TITLE = 60;
const MAX_EFFECTS_PER_SHOT = 5;

/** Validates a Scene before running or rendering it. */
export function validateScene(scene: Scene): SceneIssue[] {
  const issues: SceneIssue[] = [];
  const say = (shot: number, message: string) => issues.push({ shot, message });

  if (!scene.name || typeof scene.name !== 'string') {
    say(0, 'Scene needs a string name.');
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scene.name)) {
    say(0, `Scene name "${scene.name}" should be lowercase words and dashes.`);
  }

  if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
    say(0, 'Scene needs at least one shot.');
    return issues;
  }

  const mediaKeys = new Set(Object.keys(scene.media ?? {}));
  const effectIds = new Set<string>();

  // Check media
  if (scene.media) {
    for (const [id, m] of Object.entries(scene.media)) {
      if (!m || typeof m !== 'object') {
        say(0, `Media "${id}" must be an object.`);
      } else if (!m.type) {
        say(0, `Media "${id}" needs a type.`);
      } else if (m.type === 'shader' && !m.source) {
        say(0, `Shader media "${id}" needs a source string.`);
      }
    }
  }

  for (const [idx, shot] of scene.shots.entries()) {
    const shotNum = idx + 1;

    // Check camera
    if (shot.camera) {
      if (shot.camera.width <= 0 || shot.camera.height <= 0) {
        say(shotNum, 'Camera rectangle width and height must be positive.');
      }
    }

    // Check hold
    if (shot.hold !== undefined && shot.hold < 0) {
      say(shotNum, 'Shot hold cannot be negative.');
    }

    // Check text lengths
    if (shot.caption && shot.caption.length > LONG_CAPTION) {
      say(shotNum, `Caption is long (${shot.caption.length} chars); consider breaking into multiple shots.`);
    }
    if (shot.title && shot.title.length > LONG_TITLE) {
      say(shotNum, `Title is long (${shot.title.length} chars); titles should be concise headings.`);
    }

    // Check effects
    const effects = shot.effects ?? [];
    if (effects.length > MAX_EFFECTS_PER_SHOT) {
      say(shotNum, `Shot starts ${effects.length} effects at once; consider keeping effects focused.`);
    }

    for (const eff of effects) {
      if (!eff.id || typeof eff.id !== 'string') {
        say(shotNum, 'Every effect needs a unique string id.');
        continue;
      }
      if (effectIds.has(eff.id)) {
        say(shotNum, `Duplicate effect id "${eff.id}".`);
      }
      effectIds.add(eff.id);

      if (!EFFECT_TYPES.includes(eff.type as any)) {
        say(shotNum, `Unknown effect type "${(eff as any).type}".`);
      }

      if (eff.type === 'media') {
        if (!eff.media) {
          say(shotNum, `Media effect "${eff.id}" needs a media id.`);
        } else if (!mediaKeys.has(eff.media)) {
          say(shotNum, `Media effect "${eff.id}" references "${eff.media}" which is not defined in scene.media.`);
        }
      }

      if (eff.type === 'flow' && !eff.along) {
        say(shotNum, `Flow effect "${eff.id}" needs an "along" element id.`);
      }

      if (['glow', 'ripple', 'spotlight', 'shimmer', 'timer', 'blur', 'burst'].includes(eff.type)) {
        const withIds = eff as { ids?: string[] };
        if (!Array.isArray(withIds.ids) || withIds.ids.length === 0) {
          say(shotNum, `${eff.type} effect "${eff.id}" needs a non-empty ids array.`);
        }
      }
    }
  }

  return issues;
}
