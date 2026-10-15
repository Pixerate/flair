import { describe, it, expect } from 'vitest';
import { computeBoxFit, layoutStack } from './layout.js';

describe('computeBoxFit', () => {
  const src = [0, 0, 100, 50] as const;
  const dst = [0, 0, 200, 200] as const;

  it('handles contain fit with center alignment', () => {
    const res = computeBoxFit(src, dst, 'contain', 'center');
    expect(res.scaleX).toBe(2);
    expect(res.scaleY).toBe(2);
    expect(res.box).toEqual([0, 50, 200, 100]);
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(50);
  });

  it('handles cover fit with center alignment', () => {
    const res = computeBoxFit(src, dst, 'cover', 'center');
    expect(res.scaleX).toBe(4);
    expect(res.scaleY).toBe(4);
    expect(res.box).toEqual([-100, 0, 400, 200]);
  });

  it('handles fill fit (stretching aspect ratio)', () => {
    const res = computeBoxFit(src, dst, 'fill');
    expect(res.scaleX).toBe(2);
    expect(res.scaleY).toBe(4);
    expect(res.box).toEqual([0, 0, 200, 200]);
  });

  it('handles scale-down when src is smaller than dst', () => {
    const smallSrc = [0, 0, 50, 25] as const;
    const res = computeBoxFit(smallSrc, dst, 'scale-down', 'center');
    expect(res.scaleX).toBe(1);
    expect(res.scaleY).toBe(1);
    expect(res.box).toEqual([75, 87.5, 50, 25]);
  });

  it('respects alignments like topLeft and bottomRight', () => {
    const topLeft = computeBoxFit(src, dst, 'contain', 'topLeft');
    expect(topLeft.box).toEqual([0, 0, 200, 100]);

    const bottomRight = computeBoxFit(src, dst, 'contain', 'bottomRight');
    expect(bottomRight.box).toEqual([0, 100, 200, 100]);
  });
});

describe('layoutStack', () => {
  const items = [
    { width: 40, height: 20 },
    { width: 60, height: 20 },
    { width: 50, height: 30 },
  ];

  it('stacks items vertically (column) with gap and padding', () => {
    const boxes = layoutStack(items, {
      direction: 'column',
      gap: 10,
      padding: 5,
      startX: 0,
      startY: 0,
    });

    expect(boxes).toEqual([
      [5, 5, 40, 20],
      [5, 35, 60, 20],
      [5, 65, 50, 30],
    ]);
  });

  it('lays out items horizontally (row) with gap', () => {
    const boxes = layoutStack(items, {
      direction: 'row',
      gap: 15,
      padding: 0,
    });

    expect(boxes).toEqual([
      [0, 0, 40, 20],
      [55, 0, 60, 20],
      [130, 0, 50, 30],
    ]);
  });
});
