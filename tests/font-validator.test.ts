import { describe, it, expect } from 'vitest';
import {
  extractFontsFromMotionXml,
  checkFontsAvailability,
  validateMotionXmlFonts,
  FontValidator,
} from '../src/services/font-validator.js';
import { MotionCompiler } from '../src/compiler/motion-xml.js';
import { MotionSpec } from '../src/types/spec.js';

describe('FontValidator', () => {
  it('extracts unique font names from Apple Motion XML', () => {
    const sampleXml = `
      <ozxmlscene>
        <style>
          <font type="0">Impact</font>
        </style>
        <style>
          <font type="0">HelveticaNeue-CondensedBold</font>
        </style>
        <style>
          <font type="1">Impact</font>
        </style>
      </ozxmlscene>
    `;

    const extracted = extractFontsFromMotionXml(sampleXml);
    expect(extracted).toEqual(['Impact', 'HelveticaNeue-CondensedBold']);
  });

  it('checks font availability using custom checker', () => {
    const installed = new Set(['Impact', 'Arial-Black']);
    const customChecker = (font: string) => installed.has(font);

    const result = checkFontsAvailability(['Impact', 'FakeFont123'], customChecker);
    expect(result.present).toEqual(['Impact']);
    expect(result.missing).toEqual(['FakeFont123']);
  });

  it('validates XML and throws error on missing fonts', () => {
    const sampleXml = `<font type="0">MissingFont_ABC_999</font>`;
    const installed = new Set(['Impact']);

    expect(() =>
      validateMotionXmlFonts(sampleXml, {
        customChecker: (font) => installed.has(font),
      })
    ).toThrow(/missing from the system/);
  });

  it('validates XML and returns result when allowMissing is true', () => {
    const sampleXml = `<font type="0">MissingFont_ABC_999</font>`;
    const installed = new Set(['Impact']);

    const result = validateMotionXmlFonts(sampleXml, {
      allowMissing: true,
      customChecker: (font) => installed.has(font),
    });

    expect(result.valid).toBe(false);
    expect(result.missingFonts).toEqual(['MissingFont_ABC_999']);
  });
});

describe('MotionCompiler with Font Validation', () => {
  const baseSpec: MotionSpec = {
    title: 'FONT CHECK TEST',
    subtitle: 'SUBTITLE TEST',
    badges: ['BADGE 1', 'BADGE 2'],
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

  it('successfully compiles when referenced fonts are installed on system', () => {
    const compiler = new MotionCompiler();
    const xml = compiler.compile(baseSpec);
    expect(xml).toContain('Impact');
    expect(xml).toContain('Arial-Black');
  });

  it('throws error when MotionSpec references non-existent font', () => {
    const compiler = new MotionCompiler();
    const invalidSpec: MotionSpec = {
      ...baseSpec,
      typography: {
        ...baseSpec.typography,
        titleFont: 'NonExistentFont_XYZ_999',
      },
    };

    expect(() => compiler.compile(invalidSpec)).toThrow(
      /Font\(s\) referenced in Motion file are missing from the system: NonExistentFont_XYZ_999/
    );
  });

  it('allows bypassing font validation if validateFonts option is false', () => {
    const compiler = new MotionCompiler();
    const invalidSpec: MotionSpec = {
      ...baseSpec,
      typography: {
        ...baseSpec.typography,
        titleFont: 'NonExistentFont_XYZ_999',
      },
    };

    const xml = compiler.compile(invalidSpec, { validateFonts: false });
    expect(xml).toContain('NonExistentFont_XYZ_999');
  });
});
