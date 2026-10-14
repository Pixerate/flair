import { describe, it, expect } from 'vitest';
import type { Scene } from '../scene/types.js';
import {
  framesToTimecode,
  timecodeToFrames,
  calculateShotTimings,
  exportFcp7Xml,
  exportCmx3600Edl,
} from './interchange.js';

describe('NLE Timeline Interchange', () => {
  describe('Timecode conversions', () => {
    it('converts frame counts to SMPTE timecode (NDF)', () => {
      expect(framesToTimecode(0, 30)).toBe('00:00:00:00');
      expect(framesToTimecode(15, 30)).toBe('00:00:00:15');
      expect(framesToTimecode(30, 30)).toBe('00:00:01:00');
      expect(framesToTimecode(1800, 30)).toBe('00:01:00:00');
      expect(framesToTimecode(108000, 30)).toBe('01:00:00:00');
    });

    it('round-trips SMPTE timecode to frames and back', () => {
      const tc = '01:23:45:12';
      const frames = timecodeToFrames(tc, 30);
      expect(framesToTimecode(frames, 30)).toBe(tc);
    });

    it('handles drop-frame timecode syntax', () => {
      const tc = framesToTimecode(1800, 30, true);
      expect(tc).toContain(';');
    });
  });

  const sampleScene: Scene = {
    name: 'Product Showcase',
    stage: { width: 1920, height: 1080 },
    shots: [
      {
        title: 'Opening Hook',
        caption: 'Welcome to the revolutionary new Flair engine.',
        hold: 1000, // 1000ms = 30 frames at 30fps
      },
      {
        title: 'Feature Showcase',
        caption: 'High dynamic range procedural graphics.',
        camera: { x: 0, y: 0, width: 1920, height: 1080 }, // camera transition: +600ms = 18 frames
        hold: 1400, // 1400ms = 42 frames => total 60 frames
      },
      {
        title: 'Call to Action',
        caption: 'Available now on GitHub.',
        hold: 800, // 800ms = 24 frames
      },
    ],
  };

  describe('calculateShotTimings', () => {
    it('accurately calculates frame boundaries for shots', () => {
      const timings = calculateShotTimings(sampleScene, 30);
      expect(timings).toHaveLength(3);

      expect(timings[0].startFrame).toBe(0);
      expect(timings[0].durationFrames).toBe(30);
      expect(timings[0].endFrame).toBe(30);

      expect(timings[1].startFrame).toBe(30);
      expect(timings[1].durationFrames).toBe(60);
      expect(timings[1].endFrame).toBe(90);

      expect(timings[2].startFrame).toBe(90);
      expect(timings[2].durationFrames).toBe(24);
      expect(timings[2].endFrame).toBe(114);
    });
  });

  describe('exportFcp7Xml', () => {
    it('exports well-formed FCP7 XML sequence with tracks and markers', () => {
      const xml = exportFcp7Xml(sampleScene, { frameRate: 30 });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<xmeml version="4">');
      expect(xml).toContain('<sequence id="sequence-1">');
      expect(xml).toContain('<name>Product Showcase</name>');
      expect(xml).toContain('<duration>114</duration>');

      // Rate and timecode
      expect(xml).toContain('<timebase>30</timebase>');
      expect(xml).toContain('<string>00:00:00:00</string>');

      // Timeline sequence markers
      expect(xml).toContain('<marker>');
      expect(xml).toContain('<name>Opening Hook</name>');
      expect(xml).toContain('<comment>Welcome to the revolutionary new Flair engine.</comment>');
      expect(xml).toContain('<in>0</in>');
      expect(xml).toContain('<out>30</out>');

      // Video track & clip items
      expect(xml).toContain('<clipitem id="clipitem-1">');
      expect(xml).toContain('<clipitem id="clipitem-2">');
      expect(xml).toContain('<clipitem id="clipitem-3">');

      // File references
      expect(xml).toContain('<file id="file-1">');
      expect(xml).toContain('<pathurl>file://localhost/media/Opening_Hook.mov</pathurl>');

      // Motion filters
      expect(xml).toContain('<name>Basic Motion</name>');

      // Generator / Text overlay track
      expect(xml).toContain('<clipitem id="generator-title-1">');
      expect(xml).toContain('<value>Opening Hook</value>');
    });
  });

  describe('exportCmx3600Edl', () => {
    it('exports standard CMX 3600 Edit Decision List', () => {
      const edl = exportCmx3600Edl(sampleScene, {
        frameRate: 30,
        timecodeStart: '01:00:00:00',
        reel: 'REEL01',
      });

      expect(edl).toContain('TITLE: PRODUCT SHOWCASE');
      expect(edl).toContain('FCM: NON-DROP FRAME');

      // Event 1
      expect(edl).toContain('001  REEL01   V     C        00:00:00:00 00:00:01:00 01:00:00:00 01:00:01:00');
      expect(edl).toContain('* FROM CLIP NAME: Opening Hook');
      expect(edl).toContain('* COMMENT: Welcome to the revolutionary new Flair engine.');

      // Event 2
      expect(edl).toContain('002  REEL01   V     C        00:00:00:00 00:00:02:00 01:00:01:00 01:00:03:00');
      expect(edl).toContain('* FROM CLIP NAME: Feature Showcase');

      // Event 3
      expect(edl).toContain('003  REEL01   V     C        00:00:00:00 00:00:00:24 01:00:03:00 01:00:03:24');
      expect(edl).toContain('* FROM CLIP NAME: Call to Action');
    });
  });
});
