import { describe, expect, it } from 'vitest';
import { applySceneTool } from '../agent/tools.js';
import { resolveSceneAssets, sceneAssets } from './assets.js';
import { scenePlan } from './plan.js';
import type { SubjectResolver } from './layers.js';
import type { Scene } from './types.js';
import { validateScene } from './validate.js';

const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21 L3 9 L12 3 L21 9 Z" fill="#f05"/></svg>';

/** A host's library: one sticker, by `provider:id`. */
const library: SubjectResolver = async (ref) => (ref === 'acme:heart' ? { svg: HEART } : undefined);

const scene = (subject: unknown): Scene =>
  ({ name: 'stickers', shots: [{ caption: 'One', hold: 400, layers: [{ effect: 'sticker-cutout', subject, rect: { x: 100, y: 100, width: 300, height: 300 } }] }] }) as Scene;

describe('asset subjects', () => {
  it('lists the assets a scene uses, by shot', () => {
    const s = scene({ asset: 'acme:heart' });
    expect([...sceneAssets(s)]).toEqual([['acme:heart', [0]]]);
  });

  it('are checked for shape, and valid ones pass', () => {
    expect(validateScene(scene({ asset: 'acme:heart' })).filter((i) => i.message.includes('asset'))).toEqual([]);
    const bad = validateScene(scene({ asset: 'has spaces' }));
    expect(bad.some((i) => /"asset": ref/.test(i.message))).toBe(true);
    const extra = validateScene(scene({ asset: 'acme:heart', svg: HEART }));
    expect(extra.some((i) => /"asset": ref/.test(i.message))).toBe(true);
  });

  it('resolve through the host library into the artwork it gives', async () => {
    const { scene: out, issues } = await resolveSceneAssets(scene({ asset: 'acme:heart' }), library);
    expect(issues).toEqual([]);
    expect(out.shots[0]!.layers![0]!.subject).toEqual({ svg: HEART });
  });

  it('report a reference the library does not have, and any asset without a library', async () => {
    const missing = await resolveSceneAssets(scene({ asset: 'acme:nope' }), library);
    expect(missing.issues[0]).toMatchObject({ shot: 1 });
    expect(missing.issues[0]!.message).toMatch(/no asset "acme:nope"/);
    const none = await resolveSceneAssets(scene({ asset: 'acme:heart' }));
    expect(none.issues[0]!.message).toMatch(/no asset resolver was given; pass resolveAsset/);
  });

  it('report a resolver that throws or gives the wrong thing', async () => {
    const throws = await resolveSceneAssets(scene({ asset: 'acme:heart' }), () => {
      throw new Error('offline');
    });
    expect(throws.issues[0]!.message).toMatch(/could not be loaded \(offline\)/);
    const wrong = await resolveSceneAssets(scene({ asset: 'acme:heart' }), () => ({ png: 'x' }) as never);
    expect(wrong.issues[0]!.message).toMatch(/not \{ svg \} or \{ image \}/);
  });

  it('go into the plan as their artwork, and are left out with a note when unresolved', async () => {
    const plan = await scenePlan(scene({ asset: 'acme:heart' }), { resolveAsset: library });
    expect(plan.layers[0]!.subject).toEqual({ svg: HEART });
    const unresolved = await scenePlan(scene({ asset: 'acme:nope' }), { resolveAsset: library });
    expect(unresolved.layers[0]?.subject).toBeUndefined();
    expect(unresolved.notes.some((n) => n.includes('acme:nope'))).toBe(true);
  });
});

describe('asset subjects through the scene tools', () => {
  const blank: Scene = { name: 'stickers', shots: [{ caption: 'One', hold: 400 }] };
  const withSticker = (ref: string) => ({ shot: 1, set: { layers: [{ effect: 'sticker-cutout', subject: { asset: ref } }] } });

  it('are refused when the host has no asset library, leaving the scene alone', async () => {
    const res = await applySceneTool(blank, 'update_shot', withSticker('acme:heart'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no asset library.*\{ "asset": "acme:heart" \}.*\{ "image" \}, \{ "svg" \} or \{ "slot" \}/);
  });

  it('are taken with a library, and one it cannot resolve comes back as an issue', async () => {
    const ok = await applySceneTool(blank, 'update_shot', withSticker('acme:heart'), { resolveAsset: library });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.issues.filter((i) => i.message.includes('asset'))).toEqual([]);

    const missing = await applySceneTool(blank, 'update_shot', withSticker('acme:nope'), { resolveAsset: library });
    expect(missing.ok).toBe(true);
    if (missing.ok) expect((missing.output.issues as { message: string }[]).some((i) => i.message.includes('no asset "acme:nope"'))).toBe(true);
  });

  it('are refused inside a batch too, with no steps applied', async () => {
    const res = await applySceneTool(blank, 'batch_scene', { steps: [{ tool: 'update_shot', params: withSticker('acme:heart') }] });
    expect(res.ok).toBe(false);
  });

  it('show in the outline', async () => {
    const res = await applySceneTool(scene({ asset: 'acme:heart' }), 'get_scene', { view: 'outline' }, { resolveAsset: library });
    expect(res.ok && JSON.stringify(res.outline)).toContain('"asset":"acme:heart"');
  });
});
