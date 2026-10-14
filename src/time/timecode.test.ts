import { describe, it, expect } from 'vitest';
import {
  COMMON_FRAME_RATES,
  createFrameRate,
  framesToSMPTE,
  smpteToFrames,
  formatTimecode,
  parseTimecode,
  supportsDropFrame,
} from './timecode.js';

describe('SMPTE Timecode Engine', () => {
  it('identifies drop-frame rates correctly', () => {
    expect(supportsDropFrame(COMMON_FRAME_RATES.FPS_29_97)).toBe(true);
    expect(supportsDropFrame(COMMON_FRAME_RATES.FPS_59_94)).toBe(true);
    expect(supportsDropFrame(COMMON_FRAME_RATES.FPS_30)).toBe(false);
    expect(supportsDropFrame(COMMON_FRAME_RATES.FPS_23_976)).toBe(false); // Base is 24, not divisible by 30
  });

  it('formats non-drop-frame timecodes cleanly', () => {
    // 30 fps
    expect(formatTimecode(0, COMMON_FRAME_RATES.FPS_30)).toBe('00:00:00:00');
    expect(formatTimecode(15, COMMON_FRAME_RATES.FPS_30)).toBe('00:00:00:15');
    expect(formatTimecode(30, COMMON_FRAME_RATES.FPS_30)).toBe('00:00:01:00');
    expect(formatTimecode(3600, COMMON_FRAME_RATES.FPS_30)).toBe('00:02:00:00');
    expect(formatTimecode(108000, COMMON_FRAME_RATES.FPS_30)).toBe('01:00:00:00');
  });

  it('drops frames at the minute mark except every 10th minute for 29.97 DF', () => {
    const rate = COMMON_FRAME_RATES.FPS_29_97;
    // Minute 1: frame 1799 is 00;00;59;29. Next frame (1800) jumps to 00;01;00;02 (dropping 00 and 01).
    expect(formatTimecode(1799, rate, true)).toBe('00;00;59;29');
    expect(formatTimecode(1800, rate, true)).toBe('00;01;00;02');

    // Roundtrip back to frames
    expect(smpteToFrames({ hours: 0, minutes: 1, seconds: 0, frames: 2 }, rate, true)).toBe(1800);

    // Minute 10 (no frames dropped!): 10 minutes = 17982 frames
    // 17981 is 00;09;59;29, 17982 is 00;10;00;00
    expect(formatTimecode(17981, rate, true)).toBe('00;09;59;29');
    expect(formatTimecode(17982, rate, true)).toBe('00;10;00;00');
  });

  it('parses multiple timecode input formats', () => {
    const rate = COMMON_FRAME_RATES.FPS_30;
    // Standard colon-separated
    expect(parseTimecode('01:00:00:00', rate)).toBe(108000);
    // Semicolon drop-frame
    expect(parseTimecode('00;01;00;02', COMMON_FRAME_RATES.FPS_29_97, true)).toBe(1800);
    // Period/comma separated
    expect(parseTimecode('0.0.1.15', rate)).toBe(45);
    // Right-aligned bare digits
    expect(parseTimecode('1000', rate)).toBe(300); // 10 seconds = 300 frames
    // Relative addition/subtraction
    expect(parseTimecode('+15', rate, false, 100)).toBe(115);
    expect(parseTimecode('-30', rate, false, 100)).toBe(70);
  });
});
