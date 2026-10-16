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

  it('returns outline view with structural summary', async () => {
    const sceneWithCommands: Scene = {
      ...initialScene,
      media: { bg: { type: 'shader', source: '// heavy source code' } },
      shots: [
        {
          caption: 'Shot 1',
          hold: 500,
          run: [{ type: 'clear' }, { type: 'delete', id: 'old' }],
          effects: [{ type: 'glow', id: 'glow1', ids: ['item1'] }],
        },
      ],
    };
    const res = await applySceneTool(sceneWithCommands, 'get_scene', { view: 'outline' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outline).toBeDefined();
      expect(res.outline?.name).toBe('test-flow');
      expect(res.outline?.mediaIds).toEqual(['bg']);
      expect(res.outline?.shots).toHaveLength(1);
      expect(res.outline?.shots[0]?.shot).toBe(1);
      expect(res.outline?.shots[0]?.commandCount).toBe(2);
      expect(res.outline?.shots[0]?.effects).toEqual(['glow']);
    }
  });

  it('refuses arguments that do not fit the tool schema, leaving the scene alone', async () => {
    const cases: [string, Record<string, unknown>, RegExp][] = [
      ['update_shot', {}, /arguments\.shot is required/],
      ['update_shot', { shot: '1', set: {} }, /shot must be a whole number/],
      ['update_shot', { shot: 0, set: {} }, /at least 1/],
      ['update_shot', { shot: 1, sett: {} }, /"sett"|sett is not a parameter/],
      ['update_shot', { shot: 9, set: { hold: 1 } }, /no shot 9; the scene has 2 shots/],
      ['update_shot', { shot: 1 }, /Give fields to change/],
      ['delete_shots', { shots: [99] }, /no shot 99.*Nothing was deleted/],
      ['insert_shots', { after: 5, shots: [{}] }, /"after" is 0 to 2/],
      ['insert_shots', { after: 0, shots: [3] }, /shots\[0\] must be an object/],
      ['write_scene', { scene: { foo: 1 } }, /shots array/],
      ['set_media', { id: 'nope', media: null }, /no media "nope"/],
      ['set_media', { id: 'x', media: { source: 'a' } }, /string type/],
      ['get_scene', { view: 'brief' }, /one of "full", "outline"/],
      ['make_coffee', {}, /no tool "make_coffee"; the tools are get_scene/],
    ];
    for (const [tool, input, message] of cases) {
      const res = await applySceneTool(initialScene, tool, input);
      expect(res.ok, tool).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(message);
        expect(res.output).toEqual({ ok: false, error: res.error });
      }
    }
  });

  it('reports what is wrong inside shots and shader media as issues', async () => {
    const res = await applySceneTool(initialScene, 'insert_shots', {
      after: 0,
      shots: [{ nonsense: true, hold: 'long', run: [{}] }],
    });
    expect(res.ok).toBe(true);
    const messages = res.ok ? res.issues.map((i) => i.message).join('\n') : '';
    expect(messages).toMatch(/unknown field "nonsense"/);
    expect(messages).toMatch(/hold must be a number/);
    expect(messages).toMatch(/Command 1 in run needs a string type/);

    const media = await applySceneTool(initialScene, 'set_media', { id: 'bg', media: { type: 'shader', source: 'not glsl' } });
    expect(media.ok && media.issues.map((i) => i.message)).toEqual([expect.stringMatching(/mainImage/)]);
  });

  it('gives the model only what it asked for', async () => {
    const outline = await applySceneTool(initialScene, 'get_scene', { view: 'outline' });
    expect(outline.ok && Object.keys(outline.output)).toEqual(['ok', 'outline', 'issues']);

    const full = await applySceneTool(initialScene, 'get_scene', {});
    expect(full.ok && full.output.scene).toBe(initialScene);

    const edit = await applySceneTool(initialScene, 'insert_shots', { after: 1, shots: [{ caption: 'Mid' }] });
    expect(edit.ok && edit.output).toEqual({ ok: true, summary: expect.stringMatching(/as shot 2/), shotCount: 3, issues: [] });
    expect(JSON.stringify(edit.ok && edit.output)).not.toContain('First shot');

    const preview = await applySceneTool(initialScene, 'preview_scene', {});
    expect(preview.ok && preview.output.review).not.toHaveProperty('markdown');
  });

  it('runs batch_scene as one all-or-nothing tool', async () => {
    const res = await applySceneTool(initialScene, 'batch_scene', {
      steps: [
        { tool: 'get_scene', params: { view: 'outline' } },
        { tool: 'update_shot', params: { shot: 2, set: { hold: '$1.output.outline.shots[0].hold' } } },
        { tool: 'delete_shots', params: { shots: [1] } },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.shots).toEqual([{ caption: 'Second shot', hold: 500 }]);
      expect(res.output.steps).toHaveLength(3);
    }

    const failed = await applySceneTool(initialScene, 'batch_scene', {
      steps: [
        { tool: 'delete_shots', params: { shots: [1] } },
        { tool: 'update_shot', params: { shot: 1, set: { hold: '$1.nope' } } },
      ],
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.failedStep).toBe(2);
      expect(failed.error).toMatch(/does not resolve.*No steps were applied/);
    }

    const nested = await applySceneTool(initialScene, 'batch_scene', { steps: [{ tool: 'batch_scene', params: { steps: [] } }] });
    expect(!nested.ok && nested.error).toMatch(/cannot be nested/);
  });
});

