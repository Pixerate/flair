import { describe, it, expect } from 'vitest';
import { simulateScene, MemorySceneBoard, playScene } from './player.js';
import { ManualClock } from '../time/clock.js';
import type { Scene } from './types.js';

describe('Scene Player & Simulator', () => {
  const testScene: Scene = {
    name: 'test-flow',
    title: 'Architecture Overview',
    shots: [
      {
        caption: 'Here is our core system.',
        title: 'Core Engine',
        camera: { x: 0, y: 0, width: 1000, height: 600 },
        hold: 500,
        run: [
          {
            type: 'element',
            element: { id: 'box1', type: 'rectangle', x: 200, y: 150, width: 300, height: 200 },
          },
        ],
        layers: [{ id: 'glow1', effect: 'glow-ring-pulse', ids: ['box1'] }],
      },
      {
        caption: 'Now we zoom into the component.',
        camera: { x: 150, y: 100, width: 500, height: 400 },
        hold: 600,
        layers: [{ id: 'b1', effect: 'tick-ring-burst', ids: ['box1'] }],
      },
    ],
  };

  it('simulates scene instantaneously with ManualClock', async () => {
    const { result, review } = await simulateScene(testScene);

    expect(result.ok).toBe(true);
    expect(result.shots).toHaveLength(2);
    expect(result.duration).toBeGreaterThan(1000);
    expect(review.warnings).toHaveLength(0);
    expect(review.markdown).toContain('Architecture Overview');
    expect(review.markdown).toContain('Core Engine');
  });

  it('records framing issues when elements are outside camera', async () => {
    const brokenScene: Scene = {
      name: 'broken-framing',
      shots: [
        {
          camera: { x: 0, y: 0, width: 500, height: 500 },
          run: [
            {
              type: 'element',
              element: { id: 'offscreen', type: 'rectangle', x: 3000, y: 3000, width: 100, height: 100 },
            },
          ],
        },
      ],
    };

    const { result, review } = await simulateScene(brokenScene);
    expect(result.ok).toBe(false);
    expect(result.shots[0]!.framing).toHaveLength(1);
    expect(result.shots[0]!.framing[0]!.how).toBe('outside');
    expect(review.warnings.some((w) => w.includes('outside of the camera frame'))).toBe(true);
  });

  it('tells the board which layers show, in stack order, and fills slots', async () => {
    const scene: Scene = {
      name: 'layers',
      shots: [
        {
          hold: 400,
          layers: [
            { id: 'over', effect: 'spotlight', role: 'overlay' },
            { id: 'bg', effect: 'aurora', until: { shots: 2 } },
            { id: 'logo', subject: { slot: 'logo' }, rect: { x: 0, y: 0, width: 100, height: 100 }, fade: 100 },
          ],
        },
        { hold: 400, transition: { effect: 'transition-wipe', ms: 300 } },
      ],
    };
    const board = new MemorySceneBoard();
    const clock = new ManualClock();
    const seen: string[][] = [];
    const transitions: number[] = [];
    board.setLayers = (layers) => {
      board.layers = layers;
      seen.push(layers.map((l) => l.key));
    };
    board.setTransition = (t) => {
      if (t) transitions.push(t.progress);
    };
    let done = false;
    const play = playScene(scene, board, clock, { subjects: { logo: { image: 'logo.png' } } }).then((r) => ((done = true), r));
    for (let i = 0; i < 200 && !done; i++) await clock.advance(50);
    const result = await play;
    expect(result.ok).toBe(true);
    expect(seen[0]).toEqual(['bg', 'logo', 'over']);
    expect(result.shots[0]!.layers).toEqual(['bg', 'logo', 'over']);
    expect(result.shots[1]!.layers).toEqual(['bg']);
    expect(transitions[0]).toBe(0);
    expect(transitions.at(-1)).toBeLessThan(1);
    expect(transitions.length).toBeGreaterThan(3);
    // The transition makes the shot's lead-in, so the second shot lasts its 300 ms and its 400 ms hold.
    expect(result.shots[1]!.end - result.shots[1]!.start).toBeCloseTo(700, -1);
  });

  it('fails the shot that uses a slot no subject was given for', async () => {
    const scene: Scene = { name: 'slots', shots: [{ hold: 100 }, { hold: 100, layers: [{ subject: { slot: 'hero' } }] }] };
    const clock = new ManualClock();
    let done = false;
    const play = playScene(scene, new MemorySceneBoard(), clock, { subjects: { logo: { image: 'a.png' } } }).then((r) => ((done = true), r));
    for (let i = 0; i < 100 && !done; i++) await clock.advance(50);
    const result = await play;
    expect(result.ok).toBe(false);
    expect(result.shots[1]!.failed[0]).toContain('No subject was given for the slot "hero"');
    expect(result.shots[1]!.failed[0]).toContain('"logo"');
  });

  it('replicates elements, staggering copies through the hold, and frames them by the prototype id', async () => {
    const scene: Scene = {
      name: 'replicas',
      shots: [
        {
          hold: 400,
          camera: { frame: ['dot'] },
          run: [{ type: 'replicate', element: { id: 'dot', type: 'ellipse', x: 100, y: 100, width: 40, height: 40 }, pattern: 'line', count: 4, spacing: 100, sequence: { delayPerItem: 100 } }],
        },
      ],
    };
    const board = new MemorySceneBoard();
    const clock = new ManualClock();
    const counts: number[] = [];
    board.setLayers = () => counts.push(board.elements().length);
    let done = false;
    const play = playScene(scene, board, clock).then((r) => ((done = true), r));
    for (let i = 0; i < 100 && !done; i++) await clock.advance(50);
    await play;
    expect(board.elements().map((e) => e.id)).toEqual(['dot_0', 'dot_1', 'dot_2', 'dot_3']);
    expect(counts[0]).toBe(0);
    expect(counts).toContain(2);
    expect(board.elements()[3]!.x).toBe(400);
  });

  it('moves an element along a path behavior, its centre ending on the last waypoint', async () => {
    const scene: Scene = {
      name: 'path',
      shots: [
        {
          hold: 1000,
          run: [{ type: 'element', element: { id: 'rocket', type: 'rectangle', x: 0, y: 0, width: 20, height: 10 } }],
          behaviors: [{ type: 'path', target: 'rocket', waypoints: [{ point: [100, 500] }, { point: [500, 100] }, { point: [900, 500] }], orient: true }],
        },
      ],
    };
    const board = new MemorySceneBoard();
    const clock = new ManualClock();
    let done = false;
    const play = playScene(scene, board, clock).then((r) => ((done = true), r));
    for (let i = 0; i < 100 && !done; i++) await clock.advance(50);
    await play;
    const rocket = board.elements()[0]! as any;
    expect(rocket.x + 10).toBeCloseTo(900, 0);
    expect(rocket.y + 5).toBeCloseTo(500, 0);
    expect(typeof rocket.rotation).toBe('number');
  });
});
