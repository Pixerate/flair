import { describe, it, expect } from 'vitest';
import { validateScene } from './validate.js';
import { checkSceneLayers } from './layercheck.js';
import type { Scene } from './types.js';

const SHADER = 'uniform float speed; // @control min=0 max=4 default=1\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(speed); }';

const messages = (scene: unknown) => validateScene(scene as Scene).map((i) => i.message);
const card = { type: 'element', element: { id: 'card', type: 'rectangle', x: 100, y: 100, width: 300, height: 200 } };

describe('validateScene', () => {
  it('passes on a scene of layers, a slot, a replicate, a path and a transition', () => {
    const scene: Scene = {
      name: 'hello-world',
      shots: [
        {
          caption: 'Welcome to Flair',
          hold: 500,
          run: [card as never, { type: 'replicate', element: { id: 'dot', type: 'ellipse', x: 0, y: 0, width: 10, height: 10 }, pattern: 'circle', count: 8 }],
          layers: [
            { id: 'bg', source: SHADER, values: { speed: 2 }, until: { shots: 2 } },
            { effect: 'image-duotone', subject: { slot: 'hero' }, ids: ['card'], padding: 8 },
            { effect: 'lower-third', role: 'overlay', from: 200, fade: 150 },
            { subject: { image: 'logo.png' }, rect: { x: 0, y: 0, width: 80, height: 80 }, opacity: 0.8 },
          ],
          behaviors: [{ type: 'path', target: 'dot_0', waypoints: [{ point: [0, 0] }, { point: [100, 100] }] }],
        },
        { hold: 600, transition: { effect: 'transition-wipe', ms: 500 }, camera: { frame: ['dot'] } },
      ],
    };

    expect(validateScene(scene)).toEqual([]);
  });

  it('refuses the old media and effects with what to write instead', () => {
    const found = messages({
      name: 'old',
      media: { plasma: { type: 'shader', source: SHADER } },
      rig: { widgets: { w: { type: 'toggle', name: 'w', enabled: true, on: { 'media.plasma.speed': 2 }, off: {} } } },
      shots: [{ effects: [{ type: 'media', id: 'm', media: 'plasma' }, { type: 'glow', id: 'g', ids: ['x'] }], stopEffects: ['g'] }],
    });
    expect(found.some((m) => m.includes('"media" was replaced by layers') && m.includes('"plasma"'))).toBe(true);
    expect(found.some((m) => m.includes('"effects" were replaced by "layers"') && m.includes('glow → { "effect": "glow-ring-pulse"'))).toBe(true);
    expect(found.some((m) => m.includes('"stopEffects" was replaced by each layer\'s "until"'))).toBe(true);
    expect(found.some((m) => m.includes('Rig target "media.plasma.speed"') && m.includes('"layers.<id>.speed"'))).toBe(true);
    expect(found.some((m) => m.includes('unknown field'))).toBe(false);
  });

  it('refuses unknown effects, camera moves and transitions as layers, naming what to use', () => {
    const found = messages({
      name: 'bad-effects',
      shots: [{ layers: [{ effect: 'auroa' }, { effect: 'camera-whip-pan' }, { effect: 'transition-wipe' }, { effect: 'aurora', source: SHADER }, {}] }],
    });
    expect(found).toContainEqual(expect.stringMatching(/no catalog effect "auroa".*Did you mean "aurora".*find_layer_effects/));
    expect(found).toContainEqual(expect.stringContaining('a camera move: it goes in the shot\'s camera "in" or "during"'));
    expect(found).toContainEqual(expect.stringContaining('"transition-wipe" is a transition'));
    expect(found).toContainEqual(expect.stringContaining('has both "effect" and "source"'));
    expect(found).toContainEqual(expect.stringContaining('Layer 5 draws nothing'));
  });

  it('refuses subjects an effect does not take, and bad slots', () => {
    const found = messages({
      name: 'subjects',
      shots: [{ layers: [{ effect: 'aurora', subject: { image: 'a.png' } }, { effect: 'image-duotone', subject: { text: 'hi' } }, { effect: 'image-duotone', subject: { slot: '1 bad' } }, { subject: { gif: 'x' } }] }],
    });
    expect(found).toContainEqual(expect.stringContaining('"aurora" makes its picture from nothing, so it takes no subject'));
    expect(found).toContainEqual(expect.stringMatching(/"image-duotone" takes .*"image".*not text/));
    expect(found).toContainEqual(expect.stringContaining('names a slot the host fills'));
    expect(found).toContainEqual(expect.stringContaining('"subject" is one of { "image": url }'));
  });

  it('refuses bad placement, roles and times', () => {
    const found = messages({
      name: 'placement',
      shots: [
        {
          run: [card],
          layers: [
            { effect: 'aurora', role: 'middle' },
            { effect: 'aurora', ids: ['ghost'] },
            { effect: 'aurora', rect: { x: 0, y: 0, width: 0, height: 10 } },
            { effect: 'aurora', from: 500, until: 200 },
            { effect: 'aurora', until: { shots: 3 } },
            { effect: 'aurora', opacity: 2, fade: -1 },
            { id: 'dup', effect: 'aurora' },
            { id: 'dup', effect: 'aurora' },
          ],
        },
        { hold: 100 },
      ],
    });
    expect(found).toContainEqual(expect.stringContaining('"role" is one of "background", "subject", "overlay"'));
    expect(found).toContainEqual(expect.stringMatching(/placed over "ghost".*the elements are "card"/));
    expect(found).toContainEqual(expect.stringContaining('"rect" is a box on the board'));
    expect(found).toContainEqual(expect.stringContaining('stops (until 200 ms) before it starts'));
    expect(found).toContainEqual(expect.stringContaining('only 1 shot comes after shot 1; { "shots": 2 } lasts to the end of the scene'));
    expect(found).toContainEqual(expect.stringContaining('"opacity" is 0 to 1'));
    expect(found).toContainEqual(expect.stringContaining('"fade" is ms'));
    expect(found).toContainEqual(expect.stringContaining('Layer id "dup" is already used in shot 1'));
  });

  it('refuses transitions on the first shot, effects that are not transitions, and bad lengths', () => {
    const found = messages({
      name: 'transitions',
      shots: [{ transition: { effect: 'transition-wipe' } }, { transition: { effect: 'aurora', ms: 0 } }, { transition: { effect: 'transition-wip' } }],
    });
    expect(found).toContainEqual(expect.stringContaining('The first shot has nothing to come from'));
    expect(found).toContainEqual(expect.stringMatching(/"aurora" is not a transition.*The transitions are .*"transition-wipe"/));
    expect(found).toContainEqual(expect.stringContaining('"ms" is how long it takes'));
    expect(found).toContainEqual(expect.stringMatching(/no transition "transition-wip".*Did you mean "transition-wipe"/));
  });

  it('checks replicate commands and path behaviors', () => {
    const found = messages({
      name: 'replicas',
      shots: [
        {
          run: [{ type: 'replicate', element: { id: 'dot' }, pattern: 'hex', count: 0 }],
          behaviors: [{ type: 'path', target: 'nobody', waypoints: [{ point: [0, 0] }] }, { type: 'spin', target: 'nobody', property: 'x' }],
        },
      ],
    });
    expect(found).toContainEqual(expect.stringContaining('needs an "element" to copy'));
    expect(found).toContainEqual(expect.stringContaining('pattern is one of "grid", "line", "circle", "spiral"'));
    expect(found).toContainEqual(expect.stringContaining('count is a whole number of copies, 1 to 500'));
    expect(found).toContainEqual(expect.stringContaining('its "waypoints" are at least two'));
    expect(found).toContainEqual(expect.stringContaining('targets "nobody", which no shot has drawn'));
    expect(found).toContainEqual(expect.stringMatching(/type "spin"; behavior types are .*"path"/));
  });

  it("checks a custom shader's values, and the camera and name as before", () => {
    const found = messages({
      name: 'bad_name!',
      shots: [{ camera: { x: 0, y: 0, width: -10, height: 100 }, layers: [{ source: SHADER, values: { sped: 1 } }, { source: 'void main() {}' }] }],
    });
    expect(found).toContainEqual(expect.stringContaining('lowercase words and dashes'));
    expect(found).toContainEqual(expect.stringContaining('width and height must be positive'));
    expect(found).toContainEqual(expect.stringMatching(/has no control "sped"; Did you mean "speed"/));
    expect(found).toContainEqual(expect.stringContaining('void mainImage'));
  });
});

describe('checkSceneLayers', () => {
  it("checks presets and values against the catalog, and keeps a transition's player controls the player's", async () => {
    const issues = await checkSceneLayers({
      name: 'values',
      shots: [{ layers: [{ effect: 'image-duotone', preset: 'Nope', values: { uNope: 1 } }] }, { transition: { effect: 'transition-wipe', values: { uProgress: 0.5 } } }],
    });
    const found = issues.map((i) => `${i.shot}: ${i.message}`);
    expect(found).toContainEqual(expect.stringMatching(/^1: "image-duotone" has no preset "Nope"; its presets are "Spotify"/));
    expect(found).toContainEqual(expect.stringMatching(/^1: "image-duotone" has no control "uNope"/));
    expect(found).toContainEqual(expect.stringMatching(/^2: The transition sets "uProgress", which the player drives/));
  });

  it('is empty without catalog effects, and does not load the catalog', async () => {
    expect(await checkSceneLayers({ name: 'plain', shots: [{ layers: [{ source: SHADER }] }] })).toEqual([]);
  });
});
