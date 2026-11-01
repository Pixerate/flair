import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { layerOpacityAt, layersAt, sceneTimeline, transitionAt } from './timeline.js';
import { keyAt, planLayerOpacity, scenePlan, SCENE_PLAN_VERSION } from './plan.js';
import { SCENE_PLAN_SCHEMA } from './plan-schema.js';
import type { Scene } from './types.js';

const SHADER = 'uniform float speed; // @control min=0 max=4 default=1\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(speed); }';

const scene: Scene = {
  name: 'timeline',
  shots: [
    {
      hold: 1000,
      run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 100, y: 100, width: 200, height: 100 } }],
      layers: [
        { id: 'bg', source: SHADER, until: { shots: 3 } },
        { id: 'late', effect: 'aurora', from: 400, until: 900, fade: 100, opacity: 0.5 },
        { id: 'over', effect: 'tick-ring-burst', ids: ['card'], role: 'overlay' },
      ],
      behaviors: [{ type: 'ramp', target: 'bg', property: 'speed', from: 1, to: 3 }],
    },
    { hold: 1000, transition: { effect: 'transition-wipe', ms: 500 }, layers: [{ id: 'name', effect: 'lower-third', subject: { text: 'Grace Hopper' }, role: 'overlay' }] },
    { hold: 500, layers: [{ id: 'hero', subject: { slot: 'hero' }, rect: { x: 0, y: 0, width: 100, height: 100 } }] },
  ],
};

describe('sceneTimeline', () => {
  const timeline = sceneTimeline(scene);

  it('times shots with their transitions as lead-ins, and each layer from its shot', () => {
    expect(timeline.shots.map((s) => [s.startMs, s.moveMs, s.holdMs])).toEqual([
      [0, 0, 1000],
      [1000, 500, 1000],
      [2500, 0, 500],
    ]);
    expect(timeline.durationMs).toBe(3000);
    const at = Object.fromEntries(timeline.layers.map((l) => [l.key, [l.startMs, l.endMs]]));
    expect(at).toEqual({ bg: [0, 3000], late: [400, 900], over: [0, 1000], name: [1000, 2500], hero: [2500, 3000] });
    expect(timeline.transitions).toEqual([expect.objectContaining({ shot: 1, startMs: 1000, ms: 500 })]);
  });

  it('stacks layers by role, then in the order declared', () => {
    expect(layersAt(timeline, 500).map((l) => l.key)).toEqual(['bg', 'late', 'over']);
    expect(layersAt(timeline, 2600).map((l) => [l.key, l.role])).toEqual([
      ['bg', 'background'],
      ['hero', 'subject'],
    ]);
  });

  it('fades layers in and out, at their opacity', () => {
    const late = timeline.layers.find((l) => l.key === 'late')!;
    expect(layerOpacityAt(late, 399)).toBe(0);
    expect(layerOpacityAt(late, 450)).toBeCloseTo(0.25);
    expect(layerOpacityAt(late, 600)).toBe(0.5);
    expect(layerOpacityAt(late, 850)).toBeCloseTo(0.25);
    expect(layerOpacityAt(late, 900)).toBe(0);
  });

  it('says how far through a transition a time is', () => {
    expect(transitionAt(timeline, 999)).toBeUndefined();
    expect(transitionAt(timeline, 1250)?.progress).toBeCloseTo(0.5);
    expect(transitionAt(timeline, 1500)).toBeUndefined();
  });

  it('cuts the camera into a shot whose transition does the move', () => {
    const framed: Scene = {
      name: 'framed',
      shots: [
        { camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 100 },
        { camera: { x: 0, y: 0, width: 960, height: 540 }, transition: { effect: 'transition-wipe', ms: 400 }, hold: 100 },
        { camera: { x: 0, y: 0, width: 1920, height: 1080, in: 'camera-glide' }, transition: { effect: 'transition-wipe', ms: 200 }, hold: 100 },
      ],
    };
    const [, cut, both] = sceneTimeline(framed).shots;
    expect([cut!.cameraMs, cut!.transitionMs, cut!.moveMs]).toEqual([0, 400, 400]);
    expect([both!.cameraMs, both!.transitionMs, both!.moveMs]).toEqual([600, 200, 600]);
  });
});

describe('scenePlan', () => {
  it('resolves every layer and transition to data a player draws without the catalog', async () => {
    const plan = await scenePlan(scene);
    expect(plan.version).toBe(SCENE_PLAN_VERSION);
    expect(plan.durationMs).toBe(3000);
    const byKey = Object.fromEntries(plan.layers.map((l) => [l.key, l]));
    expect(byKey.bg!.draw).toMatchObject({ kind: 'shader', source: SHADER, values: { speed: 1 }, transparent: false });
    expect(byKey.late!.draw).toMatchObject({ kind: 'shader', effect: 'aurora', values: { uSpeed: 0.35 } });
    expect(byKey.over!.draw).toMatchObject({ kind: 'shader', effect: 'tick-ring-burst', transparent: true });
    expect(byKey.over!.place).toEqual({ ids: ['card'], padding: 0 });
    // A vector effect's words go in its text, and its picture is filled in.
    expect(byKey.name!.draw.kind).toBe('vector');
    expect(JSON.stringify(byKey.name!.draw)).toContain('Grace Hopper');
    expect(byKey.hero!.draw).toEqual({ kind: 'picture' });
    expect(plan.notes).toEqual([expect.stringContaining('slot "hero", which the player fills')]);
    // The transition: the player sets its pictures and progress, and its own animation is off.
    const [t] = plan.transitions;
    expect(t).toMatchObject({ shot: 1, startMs: 1000, ms: 500, controls: { from: 'uFrom', to: 'uTo', progress: 'uProgress', animate: 'uAnimate' } });
    expect(t!.draw.values.uAnimate).toBe(false);
    expect(t!.draw.values).not.toHaveProperty('uFrom');
  });

  it('keys behaviors on layers and elements, and the camera at its fps', async () => {
    const plan = await scenePlan(scene, { fps: 10 });
    const bg = plan.layers.find((l) => l.key === 'bg')!;
    expect(keyAt(bg.tracks!, 50)!.values.speed).toBeCloseTo(1.1, 1);
    expect(keyAt(bg.tracks!, 1000)!.values.speed).toBeCloseTo(3, 1);
    const card = plan.elements.find((e) => e.id === 'card')!;
    expect(keyAt(card.keys, 0)).toBeUndefined();
    expect(keyAt(card.keys, 100)!.element).toMatchObject({ x: 100, y: 100 });
    expect(plan.camera[0]).toMatchObject({ ms: 0, view: { zoom: 1 } });
    expect(planLayerOpacity(plan.layers.find((l) => l.key === 'late')!, 600)).toBe(0.5);
  });

  it('fills slots it is given, words for a vector effect included', async () => {
    const plan = await scenePlan(
      { name: 'slots', shots: [{ layers: [{ id: 'hero', subject: { slot: 'hero' } }, { id: 'who', effect: 'lower-third', subject: { slot: 'who' } }] }] },
      { subjects: { hero: { image: 'hero.png' }, who: { text: 'Ada' } } },
    );
    expect(plan.layers.find((l) => l.key === 'hero')!.subject).toEqual({ image: 'hero.png' });
    expect(JSON.stringify(plan.layers.find((l) => l.key === 'who')!.draw)).toContain('Ada');
    expect(plan.notes).toEqual([]);
  });

  it('round-trips through JSON and fits its schema', async () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/sample.scene.json', 'utf8')) as Scene;
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const validate = ajv.compile(SCENE_PLAN_SCHEMA);
    for (const s of [scene, fixture]) {
      const plan = await scenePlan(s, { subjects: { logo: { svg: '<svg viewBox="0 0 10 10"></svg>' } } });
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
      expect(validate(plan), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
    }
  });
});
