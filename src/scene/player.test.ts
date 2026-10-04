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
        effects: [{ type: 'glow', id: 'glow1', ids: ['box1'] }],
      },
      {
        caption: 'Now we zoom into the component.',
        camera: { x: 150, y: 100, width: 500, height: 400 },
        hold: 600,
        effects: [{ type: 'burst', id: 'b1', ids: ['box1'] }],
        stopEffects: ['glow1'],
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
});
