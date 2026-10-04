import { describe, it, expect } from 'vitest';
import { applySceneTool } from './tools.js';
import type { Scene } from '../scene/types.js';

describe('applySceneTool', () => {
  const initialScene: Scene = {
    name: 'test-flow',
    title: 'Initial Flow',
    shots: [
      { caption: 'First shot', hold: 500 },
      { caption: 'Second shot', hold: 600 },
    ],
  };

  it('updates shot surgical fields', async () => {
    const res = await applySceneTool(initialScene, 'update_shot', {
      shot: 1,
      set: { caption: 'Updated First Shot', title: 'Step 1' },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.shots[0]!.caption).toBe('Updated First Shot');
      expect(res.scene.shots[0]!.title).toBe('Step 1');
      expect(res.scene.shots[1]!.caption).toBe('Second shot');
    }
  });

  it('inserts shots at given index', async () => {
    const res = await applySceneTool(initialScene, 'insert_shots', {
      after: 1,
      shots: [{ caption: 'Interlude', hold: 400 }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.shots).toHaveLength(3);
      expect(res.scene.shots[1]!.caption).toBe('Interlude');
    }
  });

  it('deletes shots by index', async () => {
    const res = await applySceneTool(initialScene, 'delete_shots', {
      shots: [1],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.shots).toHaveLength(1);
      expect(res.scene.shots[0]!.caption).toBe('Second shot');
    }
  });

  it('sets and removes media', async () => {
    const resAdd = await applySceneTool(initialScene, 'set_media', {
      id: 'shaderBg',
      media: { type: 'shader', source: 'void mainImage(...) {}' },
    });

    expect(resAdd.ok).toBe(true);
    if (resAdd.ok) {
      expect(resAdd.scene.media?.shaderBg).toBeDefined();

      const resRemove = await applySceneTool(resAdd.scene, 'set_media', {
        id: 'shaderBg',
        media: null,
      });
      expect(resRemove.ok).toBe(true);
      if (resRemove.ok) {
        expect(resRemove.scene.media?.shaderBg).toBeUndefined();
      }
    }
  });

  it('previews scene and returns structured review', async () => {
    const res = await applySceneTool(initialScene, 'preview_scene');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.review).toBeDefined();
      expect(res.review?.markdown).toContain('Scene Preview Review');
    }
  });
});
