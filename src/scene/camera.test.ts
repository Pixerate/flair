import { describe, it, expect } from 'vitest';
import { between, centreOf, easeInOutCubic, frame, viewAt, visibleRect, type Stage } from './camera.js';

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
});
