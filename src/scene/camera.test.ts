import {
  between,
  centreOf,
  easeInOutCubic,
  frame,
  calculateFramingRect,
  viewAt,
  visibleRect,
  type Stage,
} from './camera.js';
import { simulateScene } from './player.js';
import type { Scene } from './types.js';

const stage: Stage = { width: 1920, height: 1080, caption: 0 };

describe('camera', () => {
  it('computes center and framing', () => {
    const v = viewAt(500, 300, 2, stage);
    const [cx, cy] = centreOf(v, stage);
    expect(cx).toBeCloseTo(500, 1);
    expect(cy).toBeCloseTo(300, 1);
  });

  it('frames a rectangle', () => {
    const rect = { x: 100, y: 100, width: 800, height: 600 };
    const v = frame(rect, stage);
    const visible = visibleRect(v, stage);

    expect(visible.width).toBeGreaterThanOrEqual(rect.width);
    expect(visible.height).toBeGreaterThanOrEqual(rect.height);
  });

  it('interpolates smoothly between views', () => {
    const v0 = viewAt(0, 0, 1, stage);
    const v1 = viewAt(100, 200, 2, stage);

    const mid = between(v0, v1, 0.5, stage);
    const [cx, cy] = centreOf(mid, stage);
    expect(cx).toBeCloseTo(50, 1);
    expect(cy).toBeCloseTo(100, 1);
    expect(mid.zoom).toBeCloseTo(Math.sqrt(2), 2);
  });

  it('computes easeInOutCubic curve', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.2)).toBeCloseTo(0.032, 3);
  });

  describe('calculateFramingRect', () => {
    it('returns full stage bounds if elements array is empty', () => {
      const f = calculateFramingRect([], stage);
      expect(f).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('frames a single element with aspect-ratio preserving padding', () => {
      const el = { id: 'box', type: 'rect', x: 200, y: 200, width: 100, height: 100 };
      const f = calculateFramingRect([el], stage, { padding: 0.1 });
      // width and height with 10% pad would be 120x120.
      // Aspect ratio of stage is 1920/1080 = 16/9 (~1.7778).
      // Since 120x120 is taller than 16:9, width expands to 120 * (16/9) = 213.333
      expect(f.height).toBeCloseTo(120);
      expect(f.width).toBeCloseTo(120 * (16 / 9));
      expect(f.width / f.height).toBeCloseTo(16 / 9);
    });

    it('encloses multiple elements and supports minWidth/minHeight', () => {
      const el1 = { id: 'a', type: 'rect', x: 100, y: 100, width: 50, height: 50 };
      const el2 = { id: 'b', type: 'rect', x: 500, y: 400, width: 50, height: 50 };
      const f = calculateFramingRect([el1, el2], stage, { padding: 0.1, minWidth: 1000 });
      expect(f.width).toBeGreaterThanOrEqual(1000);
      expect(f.width / f.height).toBeCloseTo(16 / 9);
      // Both elements must be inside framing rect
      expect(f.x).toBeLessThan(100);
      expect(f.x + f.width).toBeGreaterThan(550);
      expect(f.y).toBeLessThan(100);
      expect(f.y + f.height).toBeGreaterThan(450);
    });

    it('integrates with simulateScene dynamic camera framing', async () => {
      const scene: Scene = {
        name: 'test-auto-frame',
        stage: { width: 1920, height: 1080 },
        shots: [
          {
            camera: { frame: ['focus-target'], padding: 0.2 },
            run: [
              {
                type: 'element',
                element: {
                  id: 'focus-target',
                  type: 'rect',
                  x: 300,
                  y: 300,
                  width: 200,
                  height: 200,
                },
              },
            ],
            hold: 100,
          },
        ],
      };

      const { result } = await simulateScene(scene);
      expect(result.ok).toBe(true);
    });
  });
});
