import { describe, it, expect } from 'vitest';
import { MotionCompiler, normalizeColor } from '../src/compiler/motion-xml.js';
import { MotionSpec } from '../src/types/spec.js';

describe('normalizeColor', () => {
  it('converts hex strings to normalized 0-1 RGB components', () => {
    const yellow = normalizeColor('#FFE600');
    expect(yellow.red).toBeCloseTo(1.0, 2);
    expect(yellow.green).toBeCloseTo(0.9, 1);
    expect(yellow.blue).toBe(0);
    expect(yellow.alpha).toBe(1.0);
  });

  it('converts short 3-digit hex strings', () => {
    const black = normalizeColor('#000');
    expect(black.red).toBe(0);
    expect(black.green).toBe(0);
    expect(black.blue).toBe(0);
  });

  it('accepts RGB object input directly', () => {
    const col = normalizeColor({ r: 0.5, g: 0.2, b: 0.8, alpha: 1.0 });
    expect(col.red).toBe(0.5);
    expect(col.green).toBe(0.2);
    expect(col.blue).toBe(0.8);
  });
});

describe('MotionCompiler', () => {
  it('compiles a valid MotionSpec into Apple Motion XML (.motn)', () => {
    const compiler = new MotionCompiler();
    const spec: MotionSpec = {
      title: 'SLOP MACHINE',
      subtitle: '★ MAXIMUM SLOP ★',
      badges: ['SYSTEM ERROR // 100% RAW', 'VER 2.0 // NO CAP'],
      style: 'neubrutalist',
      palette: {
        backgroundColor: '#FFE600',
        primaryColor: '#000000',
        secondaryColor: '#FF0055',
        accentColor: '#00FF66',
        borderColor: '#000000',
      },
      canvas: {
        width: 1920,
        height: 1080,
        durationSeconds: 5,
        fps: 30,
      },
      typography: {
        titleFont: 'Impact',
        subtitleFont: 'Arial-Black',
        badgeFont: 'Helvetica-Bold',
      },
      animation: {
        entrance: 'pop-overshoot',
        wiggleIntensity: 0.5,
      },
    };

    const xml = compiler.compile(spec);
    expect(xml).toContain('<!DOCTYPE ozxmlscene>');
    expect(xml).toContain('<width>1920</width>');
    expect(xml).toContain('<height>1080</height>');
    expect(xml).toContain('<duration>150</duration>'); // 5s * 30fps = 150
    expect(xml).toContain('<text>SLOP MACHINE');
    expect(xml).toContain('<text>★ MAXIMUM SLOP ★');
    expect(xml).toContain('Impact');
  });

  it('embeds background media layer path when bgMedia is supplied', () => {
    const compiler = new MotionCompiler();
    const spec: MotionSpec = {
      title: 'BACKGROUND MEDIA TEST',
      bgMedia: './test-bg.png',
      badges: [],
      style: 'neubrutalist',
      palette: {
        backgroundColor: '#FFE600',
        primaryColor: '#000000',
        secondaryColor: '#FF0055',
        accentColor: '#00FF66',
        borderColor: '#000000',
      },
      canvas: {
        width: 1920,
        height: 1080,
        durationSeconds: 5,
        fps: 30,
      },
      typography: {
        titleFont: 'Impact',
        subtitleFont: 'Arial-Black',
        badgeFont: 'Helvetica-Bold',
      },
      animation: {
        entrance: 'pop-overshoot',
        wiggleIntensity: 0.5,
      },
    };

    const xml = compiler.compile(spec);
    expect(xml).toContain('<path>file://');
    expect(xml).toContain('test-bg.png</path>');
  });

  it('compiles a template from scratch when template is set to scratch', () => {
    const compiler = new MotionCompiler();
    const spec: MotionSpec = {
      title: 'SCRATCH TEMPLATE TEST',
      template: 'scratch',
      badges: ['BADGE A'],
      style: 'neubrutalist',
      palette: {
        backgroundColor: '#000000',
        primaryColor: '#FFFFFF',
        secondaryColor: '#FF0000',
        accentColor: '#00FF00',
        borderColor: '#000000',
      },
      canvas: {
        width: 1920,
        height: 1080,
        durationSeconds: 10,
        fps: 30,
      },
      typography: {
        titleFont: 'Impact',
        subtitleFont: 'Arial-Black',
        badgeFont: 'Helvetica-Bold',
      },
      animation: {
        entrance: 'pop-overshoot',
        wiggleIntensity: 0.5,
      },
    };

    const xml = compiler.compile(spec);
    expect(xml).toContain('<!DOCTYPE ozxmlscene>');
    expect(xml).toContain('<text>SCRATCH TEMPLATE TEST</text>');
    expect(xml).toContain('Impact');
  });

  it('resolves system templates dynamically based on template spec property', () => {
    const compiler = new MotionCompiler();
    const spec: MotionSpec = {
      title: 'ATMOSPHERIC TEMPLATE TEST',
      template: 'atmospheric',
      badges: [],
      style: 'cyberpunk',
      palette: {
        backgroundColor: '#050510',
        primaryColor: '#00FFCC',
        secondaryColor: '#FF0077',
        accentColor: '#FFFF00',
        borderColor: '#000000',
      },
      canvas: {
        width: 1920,
        height: 1080,
        durationSeconds: 5,
        fps: 30,
      },
      typography: {
        titleFont: 'Impact',
        subtitleFont: 'Arial-Black',
        badgeFont: 'Helvetica-Bold',
      },
      animation: {
        entrance: 'pop-overshoot',
        wiggleIntensity: 0.5,
      },
    };

    const xml = compiler.compile(spec);
    expect(xml).toContain('<!DOCTYPE ozxmlscene>');
    expect(xml).toContain('ATMOSPHERIC TEMPLATE TEST');
  });
});
