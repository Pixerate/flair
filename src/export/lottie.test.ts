import { describe, it, expect } from 'vitest';
import { exportLottie, createLottieEase } from './lottie.js';
import type { Scene } from '../scene/types.js';

describe('Lottie Vector Animation Exporter', () => {
  it('computes normalized Lottie ease control points from AE velocity specs', () => {
    const ease = createLottieEase(30, 100, { speed: 0, influence: 50 }, { speed: 0, influence: 50 });
    expect(ease.o.x).toBeCloseTo(0.5, 2);
    expect(ease.o.y).toBeCloseTo(0.0, 2);
    expect(ease.i.x).toBeCloseTo(0.5, 2);
    expect(ease.i.y).toBeCloseTo(1.0, 2);
  });

  it('exports a single-shot static scene to valid Lottie JSON format', () => {
    const scene: Scene = {
      name: 'Static Card',
      stage: { width: 1920, height: 1080 },
      shots: [
        {
          hold: 1000,
          run: [
            {
              type: 'element',
              element: {
                id: 'card-1',
                type: 'card',
                x: 100,
                y: 150,
                width: 300,
                height: 200,
              },
            },
          ],
        },
      ],
    };

    const lottie = exportLottie(scene, { frameRate: 60 });
    expect(lottie.v).toBe('5.5.2');
    expect(lottie.fr).toBe(60);
    expect(lottie.w).toBe(1920);
    expect(lottie.h).toBe(1080);
    expect(lottie.op).toBe(60); // 1000ms at 60fps = 60 frames
    expect(lottie.layers.length).toBe(1);

    const layer = lottie.layers[0];
    expect(layer.nm).toBe('card-1');
    expect(layer.ty).toBe(4); // shape layer
    expect(layer.ks.p.a).toBe(0); // static position
    expect(layer.ks.p.k).toEqual([250, 250, 0]); // center of rect: 100 + 150, 150 + 100
  });

  it('exports multi-shot keyframed animations with tangent control handles', () => {
    const scene: Scene = {
      name: 'Animated Motion',
      stage: { width: 1280, height: 720 },
      shots: [
        {
          hold: 500,
          run: [
            {
              type: 'element',
              element: {
                id: 'hero-box',
                type: 'rect',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                opacity: 0,
              },
            },
          ],
        },
        {
          hold: 500,
          run: [
            {
              type: 'update',
              id: 'hero-box',
              props: {
                x: 300,
                y: 200,
                opacity: 1,
              },
            },
          ],
        },
      ],
    };

    const lottie = exportLottie(scene, { frameRate: 30 });
    expect(lottie.layers.length).toBe(1);

    const layer = lottie.layers[0];
    expect(layer.ks.p.a).toBe(1); // animated position
    expect(layer.ks.o.a).toBe(1); // animated opacity

    const posKeys = layer.ks.p.k as any[];
    expect(posKeys.length).toBe(2);
    expect(posKeys[0].t).toBe(0);
    expect(posKeys[0].s).toEqual([50, 50, 0]);
    expect(posKeys[0].o).toBeDefined();
    expect(posKeys[0].i).toBeDefined();

    expect(posKeys[1].s).toEqual([350, 250, 0]);
  });
});
