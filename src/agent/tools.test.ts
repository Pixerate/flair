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
      shots: [
        {
          caption: 'Shot 1',
          hold: 500,
          run: [{ type: 'clear' }, { type: 'delete', id: 'old' }],
          layers: [{ id: 'bg', source: '// heavy source code' }, { effect: 'image-duotone', subject: { slot: 'hero' }, role: 'overlay', until: { shots: 1 } }],
        },
        { transition: { effect: 'transition-wipe' } },
      ],
    };
    const res = await applySceneTool(sceneWithCommands, 'get_scene', { view: 'outline' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outline).toBeDefined();
      expect(res.outline?.name).toBe('test-flow');
      expect(res.outline?.slots).toEqual(['hero']);
      expect(res.outline?.shots).toHaveLength(2);
      expect(res.outline?.shots[0]?.shot).toBe(1);
      expect(res.outline?.shots[0]?.commandCount).toBe(2);
      expect(res.outline?.shots[0]?.layers).toEqual([
        { layer: 'bg', draws: 'shader', role: 'background' },
        { layer: 'shot1.layer2', draws: 'image-duotone', role: 'overlay', slot: 'hero', until: { shots: 1 } },
      ]);
      expect(res.outline?.shots[1]?.transition).toBe('transition-wipe');
      expect(JSON.stringify(res.output)).not.toContain('heavy source code');
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
      ['set_media', { id: 'x', media: null }, /no tool "set_media"; the tools are .*find_layer_effects/],
      ['find_layer_effects', { accepts: ['gif'] }, /accepts\[0\] must be one of "image", "video", "svg", "text"/],
      ['find_layer_effects', { limit: 0 }, /limit must be at least 1/],
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

  it('reports what is wrong inside shots and their layers as issues', async () => {
    const res = await applySceneTool(initialScene, 'insert_shots', {
      after: 0,
      shots: [{ nonsense: true, hold: 'long', run: [{}] }],
    });
    expect(res.ok).toBe(true);
    const messages = res.ok ? res.issues.map((i) => i.message).join('\n') : '';
    expect(messages).toMatch(/unknown field "nonsense"/);
    expect(messages).toMatch(/hold must be a number/);
    expect(messages).toMatch(/Command 1 in run needs a string type/);

    const shader = await applySceneTool(initialScene, 'update_shot', { shot: 1, set: { layers: [{ source: 'not glsl' }] } });
    expect(shader.ok && shader.issues.map((i) => i.message)).toEqual([expect.stringMatching(/mainImage/)]);
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


describe('camera moves through the scene tools', () => {
  const cards: Scene = {
    name: 'cards',
    shots: [
      { camera: { frame: ['a'] }, hold: 300, run: [{ type: 'element', element: { id: 'a', type: 'rectangle', x: 100, y: 100, width: 300, height: 200 } }, { type: 'element', element: { id: 'b', type: 'rectangle', x: 1200, y: 600, width: 300, height: 200 } }] },
      { camera: { frame: ['b'] }, hold: 300 },
    ],
  };
  const issuesAfter = async (camera: Record<string, unknown>) => {
    const res = await applySceneTool(cards, 'update_shot', { shot: 2, set: { camera: { frame: ['b'], ...camera } } });
    expect(res.ok).toBe(true);
    return res.ok ? res.issues.map((i) => i.message) : [];
  };

  it('lists the moves for camera "in" and "during", with their controls', async () => {
    const all = await applySceneTool(cards, 'find_camera_moves', {});
    expect(all.output.total).toBe(7);
    const hold = await applySceneTool(cards, 'find_camera_moves', { role: 'hold' });
    expect((hold.output.moves as { id: string; field: string }[]).map((m) => [m.id, m.field])).toEqual([
      ['camera-ken-burns', 'during'],
      ['camera-crash-zoom', 'during'],
      ['camera-handheld', 'during'],
    ]);
    const whip = await applySceneTool(cards, 'find_camera_moves', { text: 'whip' });
    expect(whip.output.moves).toEqual([expect.objectContaining({ id: 'camera-whip-pan', ms: 600, controls: [expect.objectContaining({ name: 'motionBlur', min: 0, max: 3, default: 2 })], presets: ['Soft', 'Hard'] })]);
    const none = await applySceneTool(cards, 'find_camera_moves', { text: 'dolly' });
    expect(none.output.note).toMatch(/^No camera move matches; there are 7: camera-glide/);
    const bad = await applySceneTool(cards, 'find_camera_moves', { role: 'sideways' });
    expect(bad.ok).toBe(false);
  });

  it('takes a whip with values, and previews it at its length', async () => {
    expect(await issuesAfter({ in: { move: 'camera-whip-pan', ms: 400, values: { motionBlur: 3 } } })).toEqual([]);
    const res = await applySceneTool(cards, 'batch_scene', {
      steps: [
        { tool: 'update_shot', params: { shot: 2, set: { camera: { frame: ['b'], in: { move: 'camera-whip-pan', ms: 400 }, during: 'camera-ken-burns' } } } },
        { tool: 'preview_scene' },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.issues).toEqual([]);
  });

  it('says what is wrong with a move and what to use instead', async () => {
    expect(await issuesAfter({ in: 'camera-dolly' })).toEqual(['There is no camera move "camera-dolly"; camera "in" takes one of "camera-glide", "camera-whip-pan", "camera-punch-zoom", "camera-cut".']);
    expect((await issuesAfter({ in: 'camera-ken-burns' }))[0]).toMatch(/while a shot holds, so it goes in camera "during", not "in"/);
    expect(await issuesAfter({ in: { move: 'camera-glide', values: { motionBlur: 7 } } })).toEqual(['"camera-glide": motionBlur takes a number from 0 to 3, not 7.']);
    expect(await issuesAfter({ in: { move: 'camera-glide', values: { blur: 1 } } })).toEqual(['"camera-glide" has no control "blur"; its controls are motionBlur.']);
    expect((await issuesAfter({ transition: 'zoom' }))[0]).toMatch(/replaced by camera moves from the catalog; write \{ "in": "camera-punch-zoom" \}/);
  });
});

describe('layers through the scene tools', () => {
  const board: Scene = {
    name: 'launch',
    shots: [
      { hold: 600, run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 200, y: 200, width: 600, height: 340 } }] },
      { hold: 600 },
    ],
  };
  const issuesAfter = async (set: Record<string, unknown>, shot = 1) => {
    const res = await applySceneTool(board, 'update_shot', { shot, set });
    expect(res.ok).toBe(true);
    return res.ok ? res.issues.map((i) => i.message) : [];
  };

  it('finds effects for layers and transitions, with what they take, a page at a time', async () => {
    const pictures = await applySceneTool(board, 'find_layer_effects', { accepts: ['image'], text: 'duotone' });
    expect(pictures.ok).toBe(true);
    const found = pictures.output.effects as { id: string; goesIn: string; accepts: string[]; controls: { name: string }[]; presets: string[] }[];
    expect(found[0]).toMatchObject({ id: 'image-duotone', goesIn: 'layers', kind: 'shader' });
    expect(found[0]!.accepts).toContain('image');
    expect(found[0]!.controls.some((c) => c.name === 'uImage')).toBe(false);
    expect(found[0]!.presets).toContain('Spotify');

    const transitions = await applySceneTool(board, 'find_layer_effects', { transition: true, limit: 5 });
    expect(transitions.output.total).toBeGreaterThan(20);
    expect((transitions.output.effects as unknown[]).length).toBe(5);
    expect(transitions.output.more).toMatch(/more match; ask again with offset 5/);
    for (const e of transitions.output.effects as { goesIn: string; controls: { name: string }[] }[]) {
      expect(e.goesIn).toBe('transition');
      expect(e.controls.map((c) => c.name)).not.toContain('uProgress');
    }
    const page2 = await applySceneTool(board, 'find_layer_effects', { transition: true, limit: 5, offset: 5 });
    expect((page2.output.effects as { id: string }[])[0]!.id).not.toBe((transitions.output.effects as { id: string }[])[0]!.id);

    const vector = await applySceneTool(board, 'find_layer_effects', { kind: 'vector', text: 'lower third' });
    expect((vector.output.effects as { kind: string }[]).every((e) => e.kind === 'vector')).toBe(true);

    const none = await applySceneTool(board, 'find_layer_effects', { text: 'zzzz' });
    expect(none.output).toMatchObject({ total: 0, effects: [], note: expect.stringMatching(/No layer effect matches "zzzz"/) });
  });

  it('takes layers, a slot and a transition, and previews them', async () => {
    const res = await applySceneTool(board, 'batch_scene', {
      steps: [
        { tool: 'update_shot', params: { shot: 1, set: { layers: [{ id: 'bg', effect: 'aurora', until: { shots: 2 } }, { effect: 'image-duotone', preset: 'Spotify', subject: { slot: 'product' }, ids: ['card'] }] } } },
        { tool: 'update_shot', params: { shot: 2, set: { transition: { effect: 'transition-wipe', ms: 500 }, layers: [{ effect: 'lower-third', role: 'overlay', from: 200 }] } } },
        { tool: 'preview_scene' },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues).toEqual([]);
      expect(res.scene.shots[1]!.transition).toEqual({ effect: 'transition-wipe', ms: 500 });
    }
  });

  it('says what is wrong with a layer and what to use instead', async () => {
    expect((await issuesAfter({ layers: [{ effect: 'aurara' }] }))[0]).toMatch(/no catalog effect "aurara".*Did you mean "aurora".*find_layer_effects/);
    expect((await issuesAfter({ layers: [{ effect: 'transition-wipe' }] }))[0]).toMatch(/is a transition: .*"transition": \{ "effect": "transition-wipe" \}/);
    expect((await issuesAfter({ layers: [{ effect: 'aurora', subject: { image: 'a.png' } }] }))[0]).toMatch(/takes no subject.*find_layer_effects with \{ "accepts": \["image"\] \}/);
    expect((await issuesAfter({ layers: [{ effect: 'aurora', ids: ['crad'] }] }))[0]).toMatch(/placed over "crad".*the elements are "card"/);
    expect(await issuesAfter({ layers: [{ effect: 'image-duotone', preset: 'Spotfy', values: { uStrength: 'lots' } }] })).toEqual([
      expect.stringMatching(/"image-duotone" has no preset "Spotfy"; its presets are "Spotify"/),
      expect.stringMatching(/"image-duotone"/),
    ]);
    expect((await issuesAfter({ transition: { effect: 'transition-wipe' } }))[0]).toMatch(/first shot has nothing to come from/);
    expect((await issuesAfter({ transition: { effect: 'aurora' } }, 2))[0]).toMatch(/"aurora" is not a transition.*The transitions are/);
    expect((await issuesAfter({ effects: [{ type: 'glow', id: 'g', ids: ['card'] }] }))[0]).toMatch(/"effects" were replaced by "layers".*glow → \{ "effect": "glow-ring-pulse"/);
  });

  it('takes replicate commands and path behaviors, and says what is wrong with them', async () => {
    expect(
      await issuesAfter({
        run: [{ type: 'replicate', element: { id: 'dot', type: 'ellipse', x: 100, y: 100, width: 20, height: 20 }, pattern: 'grid', count: 9, columns: 3 }],
        behaviors: [{ type: 'path', target: 'dot_4', waypoints: [{ point: [0, 0] }, { point: [400, 300] }], orient: true }],
      }),
    ).toEqual([]);
    const bad = await issuesAfter({ run: [{ type: 'replicate', element: { id: 'dot', x: 0, y: 0, width: 1, height: 1 }, pattern: 'hexagon', count: 9 }], behaviors: [{ type: 'path', target: 'dot', waypoints: [] }] });
    expect(bad).toContainEqual(expect.stringMatching(/pattern is one of "grid", "line", "circle", "spiral", not "hexagon"/));
    expect(bad).toContainEqual(expect.stringMatching(/"waypoints" are at least two/));
  });
});

describe('templates, as a model calls them', () => {
  const start: Scene = { name: 'draft', shots: [{ caption: 'Draft', hold: 500 }] };

  it('lists templates with a total, a limit and a way to page', async () => {
    const all = await applySceneTool(start, 'find_templates', {});
    expect(all.ok).toBe(true);
    expect(all.output.total).toBeGreaterThanOrEqual(4);
    const page = await applySceneTool(start, 'find_templates', { limit: 1 });
    expect(page.output.templates).toHaveLength(1);
    expect(page.output.more).toMatch(/more match; ask again with offset 1/);
    const product = await applySceneTool(start, 'find_templates', { text: 'product reveal' });
    expect((product.output.templates as any[]).map((t) => t.id)).toContain('product-reveal');
    expect((product.output.templates as any[])[0].slots).toContain('product (image)');
    const none = await applySceneTool(start, 'find_templates', { text: 'zzz' });
    expect(none.output.note).toMatch(/No template matches "zzz"; there are \d+: .*before-after/);
    expect(none.ok && none.scene).toBe(start);
  });

  it('describes a template\'s slots without dumping its placeholder pictures', async () => {
    const res = await applySceneTool(start, 'describe_template', { template: 'stat-countdown' });
    expect(res.ok).toBe(true);
    const slots = res.output.slots as any[];
    expect(slots.find((s) => s.name === 'value')).toMatchObject({ type: 'number', min: 0, max: 100000, default: 12500 });
    expect(res.output.shots).toHaveLength(3);
    const tour = await applySceneTool(start, 'describe_template', { template: 'title-into-tour' });
    expect(tour.output.slots as any[]).toContainEqual(expect.objectContaining({ name: 'screen1', type: 'image', hasDefault: true }));
    expect(JSON.stringify(tour.output)).not.toContain('<svg xmlns');
  });

  it('fills a template into the working scene', async () => {
    const res = await applySceneTool(start, 'use_template', { template: 'product-reveal', values: { productName: 'Orbit Mug', accent: '#2266FF', holdMs: 1800, product: { slot: 'hero' } }, name: 'orbit-launch' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scene.name).toBe('orbit-launch');
    expect(res.scene.shots[0]!.hold).toBe(1800);
    expect(res.issues).toEqual([]);
    expect(res.output.summary).toMatch(/Started the scene "orbit-launch" from the template "product-reveal" with 3 shots, filling productName, accent, holdMs, product; tagline, price took their defaults\./);
    expect(res.output.openSlots).toEqual(['hero']);
    expect(JSON.stringify(res.output)).not.toContain('"shots":[');
  });

  it('refuses bad arguments and leaves the scene alone', async () => {
    const refusals = [
      [{ template: 'product-reveel' }, /There is no template "product-reveel"; the templates are product-reveal, before-after/],
      [{ template: 'product-reveal', values: { colour: '#000000' } }, /There is no slot "colour"; "product-reveal" has product \(image\), productName \(text\)/],
      [{ template: 'product-reveal', values: { accent: 'blue' } }, /Slot "accent" takes a colour like "#FF5A36", not the words "blue"\. Nothing was changed\./],
      [{ template: 'product-reveal', values: { holdMs: 100 } }, /Slot "holdMs" takes a whole number from 1200 to 6000; 100 is out of range/],
      [{ template: 'product-reveal', values: { product: 42 } }, /Slot "product" takes a picture: a URL, a data: URL or <svg> markup \(or \{ "slot": "product" \} to leave it for the host\), not the number 42/],
      [{ template: 'product-reveal', name: 'Big Launch' }, /lowercase words and dashes/],
      [{ template: 'product-reveal', valuez: {} }, /arguments\.valuez is not a parameter; expected "template", "values", "name"/],
      [{ values: {} }, /arguments\.template is required/],
      [{ template: 'product-reveal', values: 'headline=Hi' }, /arguments\.values must be an object/],
    ] as const;
    for (const [input, message] of refusals) {
      const res = await applySceneTool(start, 'use_template', input as any);
      expect(res.ok, JSON.stringify(input)).toBe(false);
      expect(res.output.error).toMatch(message);
    }
    expect((await applySceneTool(start, 'describe_template', { template: 'nope' })).output.error).toMatch(/the templates are/);
    expect((await applySceneTool(start, 'find_templates', { limit: 0 })).output.error).toMatch(/limit must be at least 1/);
  });

  it('works inside batch_scene, editing the filled scene', async () => {
    const res = await applySceneTool(start, 'batch_scene', {
      steps: [
        { tool: 'use_template', params: { template: 'before-after', values: { headline: 'Kitchen makeover' } } },
        { tool: 'update_shot', params: { shot: 1, set: { caption: 'Day one' } } },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scene.shots[2]!.title).toBe('Kitchen makeover');
    expect(res.scene.shots[0]!.caption).toBe('Day one');
  });
});
