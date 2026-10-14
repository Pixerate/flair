import { describe, expect, it } from 'vitest';
import {
  holdTime,
  loopTime,
  pingPongTime,
  speedRampTime,
  strobeTime,
} from './retiming.js';

describe('RetimingMath', () => {
  describe('loopTime', () => {
    it('loops time within [0, duration)', () => {
      expect(loopTime(0, 1000)).toBe(0);
      expect(loopTime(500, 1000)).toBe(500);
      expect(loopTime(1000, 1000)).toBe(0);
      expect(loopTime(1250, 1000)).toBe(250);
      expect(loopTime(2000, 1000)).toBe(0);
    });

    it('respects non-zero start time', () => {
      expect(loopTime(500, 1000, 500)).toBe(500);
      expect(loopTime(1000, 1000, 500)).toBe(1000);
      expect(loopTime(1500, 1000, 500)).toBe(500);
    });

    it('handles negative time smoothly', () => {
      expect(loopTime(-250, 1000)).toBe(750);
      expect(loopTime(-1000, 1000)).toBe(0);
    });

    it('handles zero or negative duration safely', () => {
      expect(loopTime(500, 0, 100)).toBe(100);
      expect(loopTime(500, -500, 100)).toBe(100);
    });
  });

  describe('pingPongTime', () => {
    it('bounces time back and forth', () => {
      expect(pingPongTime(0, 1000)).toBe(0);
      expect(pingPongTime(500, 1000)).toBe(500);
      expect(pingPongTime(1000, 1000)).toBe(1000);
      expect(pingPongTime(1200, 1000)).toBe(800);
      expect(pingPongTime(1500, 1000)).toBe(500);
      expect(pingPongTime(2000, 1000)).toBe(0);
      expect(pingPongTime(2500, 1000)).toBe(500);
    });

    it('handles offset start times', () => {
      expect(pingPongTime(100, 500, 100)).toBe(100);
      expect(pingPongTime(600, 500, 100)).toBe(600);
      expect(pingPongTime(800, 500, 100)).toBe(400);
    });

    it('handles zero or negative duration safely', () => {
      expect(pingPongTime(500, 0, 200)).toBe(200);
    });
  });

  describe('holdTime', () => {
    it('returns the frozen timestamp', () => {
      expect(holdTime(0, 500)).toBe(500);
      expect(holdTime(1000, 500)).toBe(500);
      expect(holdTime(99999, 500)).toBe(500);
    });
  });

  describe('strobeTime', () => {
    it('quantizes milliseconds into stepped intervals', () => {
      // 10 fps -> 100ms interval
      expect(strobeTime(0, 10, 'ms')).toBe(0);
      expect(strobeTime(45, 10, 'ms')).toBe(0);
      expect(strobeTime(99, 10, 'ms')).toBe(0);
      expect(strobeTime(100, 10, 'ms')).toBe(100);
      expect(strobeTime(185, 10, 'ms')).toBe(100);
      expect(strobeTime(200, 10, 'ms')).toBe(200);
    });

    it('quantizes seconds when specified', () => {
      // 2 fps -> 0.5s interval
      expect(strobeTime(0.2, 2, 'sec')).toBe(0);
      expect(strobeTime(0.5, 2, 'sec')).toBe(0.5);
      expect(strobeTime(0.9, 2, 'sec')).toBe(0.5);
      expect(strobeTime(1.1, 2, 'sec')).toBe(1.0);
    });

    it('handles zero or negative fps gracefully', () => {
      expect(strobeTime(123, 0)).toBe(123);
      expect(strobeTime(123, -5)).toBe(123);
    });
  });

  describe('speedRampTime', () => {
    it('returns original time outside range', () => {
      expect(speedRampTime(50, 100, 500)).toBe(50);
      expect(speedRampTime(700, 100, 500)).toBe(700);
    });

    it('interpolates linearly when linear ease chosen', () => {
      expect(speedRampTime(100, 100, 500, 'linear')).toBe(100);
      expect(speedRampTime(350, 100, 500, 'linear')).toBe(350);
      expect(speedRampTime(600, 100, 500, 'linear')).toBe(600);
    });

    it('ramps smoothly with easeInOut', () => {
      const mid = speedRampTime(350, 100, 500, 'easeInOut');
      expect(mid).toBe(350);
      const quarter = speedRampTime(225, 100, 500, 'easeInOut');
      expect(quarter).toBeLessThan(225); // easeIn curves slowly at start
    });
  });
});
