import { describe, it, expect } from 'vitest';
import { expandReplicator } from './replicator.js';
import type { SceneElement } from './geometry.js';

describe('Replicators & Sequence Propagation', () => {
  const prototype: SceneElement = {
    id: 'dot',
    type: 'circle',
    x: 100,
    y: 100,
    width: 20,
    height: 20,
    opacity: 1.0,
  };

  it('returns empty array when count is 0', () => {
    expect(expandReplicator(prototype, { pattern: 'grid', count: 0 })).toEqual([]);
  });

  it('generates a grid of instances with IDs and spacing', () => {
    const items = expandReplicator(prototype, {
      pattern: 'grid',
      count: 4,
      columns: 2,
      columnSpacing: 50,
      rowSpacing: 40,
    });

    expect(items).toHaveLength(4);
    expect(items.map((i) => i.id)).toEqual(['dot_0', 'dot_1', 'dot_2', 'dot_3']);

    // Row 0, col 0
    expect(items[0]!.x).toBe(100);
    expect(items[0]!.y).toBe(100);

    // Row 0, col 1
    expect(items[1]!.x).toBe(150);
    expect(items[1]!.y).toBe(100);

    // Row 1, col 0
    expect(items[2]!.x).toBe(100);
    expect(items[2]!.y).toBe(140);

    // Row 1, col 1
    expect(items[3]!.x).toBe(150);
    expect(items[3]!.y).toBe(140);
  });

  it('generates a line of instances between two points', () => {
    const items = expandReplicator(prototype, {
      pattern: 'line',
      count: 3,
      startPoint: [0, 0],
      endPoint: [100, 200],
    });

    expect(items).toHaveLength(3);
    expect(items[0]!.x).toBe(0);
    expect(items[0]!.y).toBe(0);

    expect(items[1]!.x).toBe(50);
    expect(items[1]!.y).toBe(100);

    expect(items[2]!.x).toBe(100);
    expect(items[2]!.y).toBe(200);
  });

  it('generates a circular ring of instances', () => {
    const items = expandReplicator(prototype, {
      pattern: 'circle',
      count: 4,
      origin: [500, 500],
      radius: 100,
      startAngle: 0,
    });

    expect(items).toHaveLength(4);
    // 0 deg: (500 + 100, 500) = (600, 500)
    expect(items[0]!.x).toBeCloseTo(600);
    expect(items[0]!.y).toBeCloseTo(500);

    // 90 deg (pi/2): (500, 500 + 100) = (500, 600)
    expect(items[1]!.x).toBeCloseTo(500);
    expect(items[1]!.y).toBeCloseTo(600);

    // 180 deg (pi): (500 - 100, 500) = (400, 500)
    expect(items[2]!.x).toBeCloseTo(400);
    expect(items[2]!.y).toBeCloseTo(500);

    // 270 deg (3pi/2): (500, 500 - 100) = (500, 400)
    expect(items[3]!.x).toBeCloseTo(500);
    expect(items[3]!.y).toBeCloseTo(400);
  });

  it('generates a spiral pattern with expanding radius', () => {
    const items = expandReplicator(prototype, {
      pattern: 'spiral',
      count: 5,
      origin: [0, 0],
      radius: 50,
      spiralTightness: 10,
    });

    expect(items).toHaveLength(5);
    // r0 = 50, r1 = 60, r2 = 70, etc.
    const dist0 = Math.hypot(items[0]!.x, items[0]!.y);
    const dist4 = Math.hypot(items[4]!.x, items[4]!.y);
    expect(dist0).toBeCloseTo(50);
    expect(dist4).toBeCloseTo(90);
  });

  it('modulates sequence property offsets across instances', () => {
    const items = expandReplicator(prototype, {
      pattern: 'grid',
      count: 3,
      sequence: {
        property: 'opacity',
        offset: -0.2,
      },
    });

    expect(items[0]!.opacity).toBeCloseTo(1.0);
    expect(items[1]!.opacity).toBeCloseTo(0.8);
    expect(items[2]!.opacity).toBeCloseTo(0.6);

    const scaledItems = expandReplicator(prototype, {
      pattern: 'line',
      count: 3,
      sequence: {
        property: 'scale',
        offset: 0.5,
      },
    });

    expect(scaledItems[0]!.width).toBe(20);
    expect(scaledItems[1]!.width).toBe(30);
    expect(scaledItems[2]!.width).toBe(40);
  });
});
