import { MAX_TILT } from './camera.js';
import { cameraMoveIds, DEFAULT_CAMERA_MOVE, resolveCameraMove } from './moves.js';
import { checkLayer, checkTransition, legacyEffectIssues } from './layercheck.js';
import { replicaIds, replicateIssues } from './replicator.js';
import { BEHAVIOR_TYPES } from './behavior.js';
import { layerKey } from './layers.js';
import { rigTargets } from './rig.js';
import { isElementCommand, isReplicateCommand, type Scene, type Shot } from './types.js';

/** The camera moves that replaced the camera's old built-in transitions. */
const LEGACY_TRANSITIONS: Record<string, string> = { move: 'camera-glide', whip: 'camera-whip-pan', zoom: 'camera-punch-zoom', cut: 'camera-cut' };

export interface SceneIssue {
  /** 1-based shot index (0 indicates whole scene level). */
  shot: number;
  message: string;
}

const LONG_CAPTION = 120;
const LONG_TITLE = 60;
const MAX_LAYERS_PER_SHOT = 8;

const SCENE_FIELDS = ['name', 'title', 'description', 'stage', 'target', 'rig', 'shots'];
const SHOT_FIELDS = ['caption', 'title', 'camera', 'hold', 'run', 'layers', 'transition', 'behaviors'];
/** Fields earlier versions had, refused with what to write instead rather than as unknown. */
const LEGACY_SCENE_FIELDS = ['media'];
const LEGACY_SHOT_FIELDS = ['effects', 'stopEffects'];
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
    if (!SCENE_FIELDS.includes(key) && !LEGACY_SCENE_FIELDS.includes(key)) say(0, `Scene has an unknown field "${key}"; scene fields are ${list(SCENE_FIELDS)}.`);
  }
  const legacy = scene as { media?: unknown };
  if (legacy.media !== undefined) {
    const ids = legacy.media && typeof legacy.media === 'object' ? Object.keys(legacy.media) : [];
    say(0, `Scene "media" was replaced by layers: put each shader on the shot that shows it as { "layers": [{ "source": "…", "role": "background", "until": { "shots": N } }] } (or a catalog effect's id in "effect"), and remove "media"${ids.length ? ` (it has ${list(ids)})` : ''}.`);
  }
  if (scene.rig && typeof scene.rig === 'object') {
    const layerIds = new Set((Array.isArray(scene.shots) ? scene.shots : []).flatMap((s) => (Array.isArray(s?.layers) ? s.layers.map((l) => l?.id).filter(Boolean) : [])));
    for (const target of rigTargets(scene.rig)) {
      if (target.startsWith('media.')) say(0, `Rig target "${target}" names scene media, which layers replaced; give the layer an "id" and write "layers.<id>.${target.split('.').slice(target.split('.')[2] === 'values' ? 3 : 2).join('.') || '<control>'}".`);
      else if (target.startsWith('layers.') && !layerIds.has(target.split('.')[1]))
        say(0, `Rig target "${target}" names no layer; ${layerIds.size ? `the layers with ids are ${list([...layerIds] as string[])}` : 'no layer has an "id" yet: give the layer one'}.`);
    }
  }

  if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
    say(0, 'Scene needs at least one shot.');
    return issues;
  }

  /** Element ids drawn so far (copies included), and layer keys used so far. */
  const drawn = new Set<string>();
  const layerKeys = new Map<string, number>();

  for (const [idx, shot] of scene.shots.entries()) {
    const shotNum = idx + 1;

    if (!shot || typeof shot !== 'object' || Array.isArray(shot)) {
      say(shotNum, 'Each shot must be an object.');
      continue;
    }
    for (const key of Object.keys(shot)) {
      if (!SHOT_FIELDS.includes(key) && !LEGACY_SHOT_FIELDS.includes(key)) say(shotNum, `Shot has an unknown field "${key}"; shot fields are ${list(SHOT_FIELDS)}.`);
    }
    for (const issue of legacyEffectIssues(shot as Record<string, unknown>)) say(shotNum, issue);
    for (const key of ['caption', 'title'] as const) {
      if (shot[key] !== undefined && typeof shot[key] !== 'string') say(shotNum, `Shot ${key} must be a string.`);
    }
    if (shot.hold !== undefined && typeof shot.hold !== 'number') say(shotNum, 'Shot hold must be a number of milliseconds.');
    for (const key of ['run', 'layers', 'behaviors'] as const) {
      if (shot[key] !== undefined && !Array.isArray(shot[key])) say(shotNum, `Shot ${key} must be an array.`);
    }
    if (Array.isArray(shot.run)) {
      shot.run.forEach((cmd, i) => {
        if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string') {
          say(shotNum, `Command ${i + 1} in run needs a string type ("element", "update", "delete", "clear" or "replicate").`);
          return;
        }
        if (cmd.type === 'replicate') {
          const problems = replicateIssues(cmd as Record<string, unknown>);
          for (const p of problems) say(shotNum, `Command ${i + 1} in run: ${p}`);
          if (!problems.length && isReplicateCommand(cmd)) {
            drawn.add(cmd.element.id);
            for (const id of replicaIds(cmd)) drawn.add(id);
          }
        } else if (isElementCommand(cmd)) drawn.add(cmd.element.id);
      });
    }

    // Check behaviors
    if (Array.isArray(shot.behaviors)) {
      const keysSoFar = new Set([...layerKeys.keys(), ...(Array.isArray(shot.layers) ? shot.layers.map((l, i) => layerKey(l ?? {}, idx, i)) : [])]);
      shot.behaviors.forEach((b, i) => {
        const where = `Behavior ${i + 1}`;
        if (!b || typeof b !== 'object') return say(shotNum, `${where} must be an object.`);
        if (!BEHAVIOR_TYPES.includes(b.type as (typeof BEHAVIOR_TYPES)[number])) say(shotNum, `${where} has type ${JSON.stringify(b.type)}; behavior types are ${list([...BEHAVIOR_TYPES])}.`);
        if (typeof b.target !== 'string') return say(shotNum, `${where} needs a "target": an element's id, or a layer's id.`);
        const known = drawn.has(b.target) || (b.type !== 'path' && keysSoFar.has(b.target));
        if (!known) {
          const els = [...drawn];
          say(shotNum, `${where} targets "${b.target}", which no shot has drawn by now${b.type === 'path' ? '' : ' and no layer is called'}; ${els.length ? `the elements drawn are ${list(els.slice(0, 12))}${els.length > 12 ? ` and ${els.length - 12} more` : ''}` : 'no elements are drawn yet'}.`);
        }
        if (b.type === 'path') {
          const wps = (b as { waypoints?: unknown }).waypoints;
          const point = (w: any) => w && Array.isArray(w.point) && (w.point.length === 2 || w.point.length === 3) && w.point.every((n: unknown) => typeof n === 'number');
          if (!Array.isArray(wps) || wps.length < 2 || !wps.every(point))
            say(shotNum, `${where} is a path: its "waypoints" are at least two { "point": [x, y] } (with optional "inTangent" and "outTangent" handles, [dx, dy]).`);
        } else if (typeof (b as { property?: unknown }).property !== 'string') {
          say(shotNum, `${where} needs a "property" to change: an element's (x, y, rotation, opacity…) or a layer's control.`);
        }
      });
    }

    // Check layers and the transition into the shot
    if (Array.isArray(shot.layers)) {
      if (shot.layers.length > MAX_LAYERS_PER_SHOT) say(shotNum, `Shot starts ${shot.layers.length} layers at once; keep a shot to ${MAX_LAYERS_PER_SHOT} or fewer so each reads.`);
      shot.layers.forEach((layer, i) => {
        for (const issue of checkLayer(layer, { shot: idx, index: i, shots: scene.shots.length, drawn })) say(shotNum, issue);
        if (layer && typeof layer === 'object') {
          const key = layerKey(layer, idx, i);
          if (layerKeys.has(key)) say(shotNum, `Layer id "${key}" is already used in shot ${layerKeys.get(key)! + 1}; layer ids are unique in the scene.`);
          else layerKeys.set(key, idx);
        }
      });
    }
    if (shot.transition !== undefined) for (const issue of checkTransition(shot.transition, idx)) say(shotNum, issue);

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
  }

  return issues;
}
