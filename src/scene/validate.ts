import { MAX_TILT } from './camera.js';
import { cameraMoveIds, DEFAULT_CAMERA_MOVE, resolveCameraMove } from './moves.js';

/** The camera moves that replaced the camera's old built-in transitions. */
const LEGACY_TRANSITIONS: Record<string, string> = { move: 'camera-glide', whip: 'camera-whip-pan', zoom: 'camera-punch-zoom', cut: 'camera-cut' };
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

const SCENE_FIELDS = ['name', 'title', 'description', 'stage', 'media', 'target', 'rig', 'shots'];
const SHOT_FIELDS = ['caption', 'title', 'camera', 'hold', 'run', 'effects', 'stopEffects', 'behaviors'];
const list = (names: string[]) => names.map((n) => `"${n}"`).join(', ');

/** Validates a Scene before running or rendering it. */
export function validateScene(scene: Scene): SceneIssue[] {
  const issues: SceneIssue[] = [];
  const say = (shot: number, message: string) => issues.push({ shot, message });

  if (!scene.name || typeof scene.name !== 'string') {
    say(0, 'Scene needs a string name.');
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scene.name)) {
    say(0, `Scene name "${scene.name}" should be lowercase words and dashes.`);
  }

  for (const key of Object.keys(scene)) {
    if (!SCENE_FIELDS.includes(key)) say(0, `Scene has an unknown field "${key}"; scene fields are ${list(SCENE_FIELDS)}.`);
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
      } else if (m.type === 'shader' && (!m.source || typeof m.source !== 'string')) {
        say(0, `Shader media "${id}" needs a source string.`);
      } else if (m.type === 'shader' && !/\bmainImage\s*\(/.test(m.source as string)) {
        say(0, `Shader media "${id}" needs a function void mainImage(out vec4 fragColor, in vec2 fragCoord).`);
      }
    }
  }

  for (const [idx, shot] of scene.shots.entries()) {
    const shotNum = idx + 1;

    if (!shot || typeof shot !== 'object' || Array.isArray(shot)) {
      say(shotNum, 'Each shot must be an object.');
      continue;
    }
    for (const key of Object.keys(shot)) {
      if (!SHOT_FIELDS.includes(key)) say(shotNum, `Shot has an unknown field "${key}"; shot fields are ${list(SHOT_FIELDS)}.`);
    }
    for (const key of ['caption', 'title'] as const) {
      if (shot[key] !== undefined && typeof shot[key] !== 'string') say(shotNum, `Shot ${key} must be a string.`);
    }
    if (shot.hold !== undefined && typeof shot.hold !== 'number') say(shotNum, 'Shot hold must be a number of milliseconds.');
    for (const key of ['run', 'effects', 'stopEffects', 'behaviors'] as const) {
      if (shot[key] !== undefined && !Array.isArray(shot[key])) say(shotNum, `Shot ${key} must be an array.`);
    }
    if (Array.isArray(shot.run)) {
      shot.run.forEach((cmd, i) => {
        if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string')
          say(shotNum, `Command ${i + 1} in run needs a string type ("element", "update", "delete" or "clear").`);
      });
    }

    // Check camera
    if (shot.camera) {
      if ('frame' in shot.camera) {
        if (!Array.isArray(shot.camera.frame) || shot.camera.frame.length === 0) {
          say(shotNum, 'Dynamic camera framing requires a non-empty frame array of element IDs.');
        }
      } else if ('width' in shot.camera && (shot.camera.width <= 0 || shot.camera.height <= 0)) {
        say(shotNum, 'Camera rectangle width and height must be positive.');
      }
      const cam = shot.camera;
      const angle = (name: 'tilt' | 'turn' | 'roll', max: number) => {
        const v = cam[name];
        if (v !== undefined && !(typeof v === 'number' && Math.abs(v) <= max))
          say(shotNum, `Camera ${name} is degrees between -${max} and ${max}.`);
      };
      angle('tilt', MAX_TILT);
      angle('turn', MAX_TILT);
      angle('roll', 180);
      if (cam.perspective !== undefined && !(typeof cam.perspective === 'number' && cam.perspective >= 0.3))
        say(shotNum, 'Camera perspective is the lens distance as a multiple of the stage width, 0.3 or more (1.2 by default).');
      // The fields camera moves replaced, refused with what to write instead.
      const old = cam as { transition?: unknown; motionBlur?: unknown };
      if (old.transition !== undefined || old.motionBlur !== undefined) {
        const id = typeof old.transition === 'string' ? (LEGACY_TRANSITIONS[old.transition] ?? DEFAULT_CAMERA_MOVE) : DEFAULT_CAMERA_MOVE;
        const replacement = old.motionBlur !== undefined ? `{ "in": { "move": "${id}", "values": { "motionBlur": ${JSON.stringify(old.motionBlur)} } } }` : `{ "in": "${id}" }`;
        say(shotNum, `Camera "transition" and "motionBlur" were replaced by camera moves from the catalog; write ${replacement}. Camera "in" takes one of ${cameraMoveIds('transition')}.`);
      }
      if (cam.in !== undefined) {
        for (const issue of resolveCameraMove(cam.in, 'transition').issues) say(shotNum, issue);
        if (idx === 0) say(shotNum, 'The first shot has no framing to move from, so its camera starts in place and its "in" does nothing; give the move to a later shot or leave it out.');
      }
      if (cam.during !== undefined) for (const issue of resolveCameraMove(cam.during, 'hold', shot.hold ?? 800).issues) say(shotNum, issue);
    }

    // Check hold
    if (shot.hold !== undefined && shot.hold < 0) {
      say(shotNum, 'Shot hold cannot be negative.');
    }

    // Check text lengths
    if (typeof shot.caption === 'string' && shot.caption.length > LONG_CAPTION) {
      say(shotNum, `Caption is long (${shot.caption.length} chars); consider breaking into multiple shots.`);
    }
    if (typeof shot.title === 'string' && shot.title.length > LONG_TITLE) {
      say(shotNum, `Title is long (${shot.title.length} chars); titles should be concise headings.`);
    }

    // Check effects
    const effects = Array.isArray(shot.effects) ? shot.effects : [];
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
