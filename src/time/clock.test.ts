import { describe, it, expect } from 'vitest';
import { ManualClock, jitter, realClock } from './clock.js';

describe('ManualClock', () => {
  it('advances time manually', async () => {
    const clock = new ManualClock(100);
    expect(clock.now()).toBe(100);

    await clock.advance(50);
    expect(clock.now()).toBe(150);

    await clock.tick(30); // ~33.33ms
    expect(clock.now()).toBeCloseTo(183.33, 1);
  });

  it('fires sleeps in order and waits for completion', async () => {
    const clock = new ManualClock();
    const order: number[] = [];

    clock.sleep(100).then(() => order.push(100));
    clock.sleep(50).then(() => order.push(50));
    clock.sleep(200).then(() => order.push(200));

    expect(clock.pending).toBe(true);

    await clock.advance(75);
    expect(order).toEqual([50]);
    expect(clock.now()).toBe(75);

    await clock.advance(50);
    expect(order).toEqual([50, 100]);

    await clock.advance(100);
    expect(order).toEqual([50, 100, 200]);
    expect(clock.pending).toBe(false);
  });

  it('resolves frame callbacks', async () => {
    const clock = new ManualClock();
    let frameFired = false;

    clock.frame().then(() => {
      frameFired = true;
    });

    expect(frameFired).toBe(false);
    await clock.tick();
    expect(frameFired).toBe(true);
  });

  it('provides deterministic jitter', () => {
    const a1 = jitter('star', 0);
    const a2 = jitter('star', 0);
    const b = jitter('star', 1);
    const c = jitter('galaxy', 0);

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).not.toBe(c);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThan(1);
  });
});

describe('realClock', () => {
  it('reports live time and can sleep', async () => {
    expect(realClock.live).toBe(true);
    const t0 = realClock.now();
    await realClock.sleep(10);
    const t1 = realClock.now();
    expect(t1).toBeGreaterThanOrEqual(t0);
  });
});
