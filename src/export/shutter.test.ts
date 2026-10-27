import { describe, expect, it } from 'vitest';
import { checkShutter, FrameAverager, shutterTimes } from './shutter.js';

describe('checkShutter', () => {
  it('is off at angle 0 or when absent, and fills in 8 samples', () => {
    expect(checkShutter({})).toBeUndefined();
    expect(checkShutter({ shutterAngle: 0 })).toBeUndefined();
    expect(checkShutter({ shutterAngle: 180 })).toEqual({ angle: 180, samples: 8 });
    expect(checkShutter({ shutterAngle: 360, shutterSamples: 32 })).toEqual({ angle: 360, samples: 32 });
    expect(checkShutter({ shutterAngle: 45.5, shutterSamples: 2 })).toEqual({ angle: 45.5, samples: 2 });
  });

  it('refuses values out of range with a sentence naming the range', () => {
    for (const shutterAngle of [-1, 361, Number.NaN, Infinity, '180' as never]) {
      expect(() => checkShutter({ shutterAngle })).toThrow(/^shutterAngle is 0 to 360 degrees \(180 is a film camera's usual, 0 is no motion blur\); it was /);
    }
    for (const shutterSamples of [0, 1, 33, 2.5, Number.NaN]) {
      expect(() => checkShutter({ shutterAngle: 180, shutterSamples })).toThrow(/^shutterSamples is a whole number of sub-frames from 2 to 32 \(default 8\); it was /);
    }
    // A bad sample count is caught even with the shutter off.
    expect(() => checkShutter({ shutterSamples: 100 })).toThrow(/shutterSamples/);
  });
});

describe('shutterTimes', () => {
  it('puts each sub-frame at the middle of its slice of the open shutter', () => {
    // 180° at 25 fps: open for 0.02 s from the frame's time.
    expect(shutterTimes(1, 25, { angle: 180, samples: 4 })).toEqual([1.0025, 1.0075, 1.0125, 1.0175].map((t) => expect.closeTo(t, 12)));
    // 360°: the shutter spans the whole frame.
    expect(shutterTimes(0, 10, { angle: 360, samples: 2 })).toEqual([0.025, 0.075].map((t) => expect.closeTo(t, 12)));
    const times = shutterTimes(0.5, 30, { angle: 90, samples: 8 });
    expect(times).toHaveLength(8);
    expect(times[0]!).toBeGreaterThan(0.5);
    expect(times[7]!).toBeLessThan(0.5 + 0.25 / 30);
  });
});

describe('FrameAverager', () => {
  it('averages opaque frames', () => {
    const avg = new FrameAverager(2);
    avg.add([10, 20, 30, 255, 0, 0, 0, 255]);
    avg.add([20, 40, 61, 255, 255, 255, 255, 255]);
    expect([...avg.result(new Uint8Array(8))]).toEqual([15, 30, 46, 255, 128, 128, 128, 255]);
  });

  it('averages in premultiplied alpha, so transparent pixels do not darken the edge', () => {
    const avg = new FrameAverager(1);
    // Solid red, then nothing at all (its colour is black, but it covers nothing).
    avg.add([255, 0, 0, 255]);
    avg.add([0, 0, 0, 0]);
    // Half-covered red, not half-covered dark red.
    expect([...avg.result(new Uint8ClampedArray(4))]).toEqual([255, 0, 0, 128]);
    // Coverage weights the colour.
    avg.add([255, 0, 0, 200]);
    avg.add([0, 0, 255, 50]);
    expect([...avg.result(new Uint8Array(4))]).toEqual([204, 0, 51, 125]);
    // Nothing covered stays transparent black.
    avg.add([9, 9, 9, 0]);
    avg.add([7, 7, 7, 0]);
    expect([...avg.result(new Uint8Array(4))]).toEqual([0, 0, 0, 0]);
  });

  it('keeps full precision across many frames, and starts over after each result', () => {
    const avg = new FrameAverager(1);
    // 31 frames of 0 and one of 255: an 8-bit running average would lose it; the sum keeps 8.
    for (let i = 0; i < 31; i++) avg.add([0, 0, 0, 255]);
    avg.add([255, 0, 0, 255]);
    expect(avg.added).toBe(32);
    expect([...avg.result(new Uint8Array(4))]).toEqual([8, 0, 0, 255]);
    expect(avg.added).toBe(0);
    avg.add([40, 50, 60, 255]);
    expect([...avg.result(new Uint8Array(4))]).toEqual([40, 50, 60, 255]);
  });

  it('refuses frames of the wrong size, and a result with nothing added', () => {
    const avg = new FrameAverager(2);
    expect(() => avg.add([0, 0, 0, 0])).toThrow(/1 pixels cannot be averaged with frames of 2/);
    expect(() => avg.result(new Uint8Array(8))).toThrow(/no frames to average/);
    avg.add(new Uint8Array(8));
    expect(() => avg.result(new Uint8Array(4))).toThrow(/has 2 pixels/);
  });
});
