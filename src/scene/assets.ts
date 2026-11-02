import { isAsset, type ResolvedAsset, type SceneLayer, type SubjectResolver } from './layers.js';
import type { Scene } from './types.js';
import type { SceneIssue } from './validate.js';

/** Every asset reference a scene's layers use, with the shots (0-based) that use it. */
export function sceneAssets(scene: Scene): Map<string, number[]> {
  const refs = new Map<string, number[]>();
  scene.shots.forEach((shot, i) => {
    for (const layer of Array.isArray(shot?.layers) ? (shot.layers as SceneLayer[]) : []) {
      if (!isAsset(layer?.subject)) continue;
      const shots = refs.get(layer.subject.asset) ?? [];
      if (!shots.includes(i)) shots.push(i);
      refs.set(layer.subject.asset, shots);
    }
  });
  return refs;
}

const isResolved = (value: unknown): value is ResolvedAsset => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (typeof v.svg === 'string' && !!v.svg) || (typeof v.image === 'string' && !!v.image);
};

/** One reference resolved: the artwork (`{ svg }` or `{ image }`), or a sentence saying why not. */
export async function resolveAsset(ref: string, resolve: SubjectResolver): Promise<ResolvedAsset | string> {
  let found: unknown;
  try {
    found = await resolve(ref);
  } catch (error) {
    return `The asset "${ref}" could not be loaded (${error instanceof Error ? error.message : String(error)}).`;
  }
  if (found === undefined) return `The host's asset library has no asset "${ref}"; check the reference, or use an { "image" }, { "svg" } or { "slot" } subject instead.`;
  if (!isResolved(found)) return `The asset "${ref}" resolved to something that is not { svg } or { image }; the host's resolver must give one of those.`;
  return 'svg' in found && typeof found.svg === 'string' ? { svg: found.svg } : { image: (found as { image: string }).image };
}

/**
 * The scene with every `{ "asset": ref }` subject replaced by the artwork
 * `resolve` gives for it, and an issue for each reference it could not
 * resolve (those layers keep their asset subject, and draw nothing).
 * Without a resolver, every asset is an issue.
 */
export async function resolveSceneAssets(scene: Scene, resolve?: SubjectResolver): Promise<{ scene: Scene; issues: SceneIssue[] }> {
  const refs = sceneAssets(scene);
  if (!refs.size) return { scene, issues: [] };
  const issues: SceneIssue[] = [];
  const found = new Map<string, ResolvedAsset>();
  for (const [ref, shots] of refs) {
    const result = resolve
      ? await resolveAsset(ref, resolve)
      : `The layer's subject is the asset "${ref}", but no asset resolver was given; pass resolveAsset (the host's library), or use an { "image" }, { "svg" } or { "slot" } subject instead.`;
    if (typeof result === 'string') for (const shot of shots) issues.push({ shot: shot + 1, message: result });
    else found.set(ref, result);
  }
  const shots = scene.shots.map((shot) => {
    if (!Array.isArray(shot?.layers) || !shot.layers.some((l) => isAsset(l?.subject) && found.has(l.subject.asset))) return shot;
    return { ...shot, layers: shot.layers.map((l) => (isAsset(l?.subject) && found.has(l.subject.asset) ? { ...l, subject: found.get(l.subject.asset)! } : l)) };
  });
  return { scene: { ...scene, shots }, issues };
}
