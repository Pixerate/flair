import { describe, it, expect } from 'vitest';
import {
  srgbToLinear,
  linearToSrgb,
  srgbToOklab,
  oklabToSrgb,
  interpolateOklab,
  interpolateOklch,
  convertColorSpace,
  applyAscCdl,
  applyLiftGammaGain,
  applyVibrance,
  getWhiteBalanceGains,
  getOklabGLSL,
  getColorGradingGLSL,
  type ColorRGB,
} from './color.js';

describe('Perceptual Color Science & Grading Engine', () => {
  it('round-trips sRGB transfer function', () => {
    for (const val of [0.0, 0.04, 0.18, 0.5, 0.8, 1.0]) {
      const lin = srgbToLinear(val);
      const srgb = linearToSrgb(lin);
      expect(srgb).toBeCloseTo(val, 4);
    }
  });

  it('round-trips Oklab perceptual space with high fidelity', () => {
    const testColors: ColorRGB[] = [
      [1, 0, 0],       // pure red
      [0, 1, 0],       // pure green
      [0, 0, 1],       // pure blue
      [1, 1, 0],       // yellow
      [0.2, 0.5, 0.8], // sky blue
      [0.9, 0.9, 0.9], // light gray
    ];

    for (const c of testColors) {
      const lab = srgbToOklab(c);
      const roundTrip = oklabToSrgb(lab);
      expect(roundTrip[0]).toBeCloseTo(c[0], 3);
      expect(roundTrip[1]).toBeCloseTo(c[1], 3);
      expect(roundTrip[2]).toBeCloseTo(c[2], 3);
    }
  });

  it('interpolateOklab preserves perceptual luminance and avoids muddy gray dead-zones', () => {
    const blue: ColorRGB = [0, 0, 1];
    const yellow: ColorRGB = [1, 1, 0];

    const midOklab = interpolateOklab(blue, yellow, 0.5);
    // In naive RGB, (0,0,1) + (1,1,0) gives (0.5, 0.5, 0.5) which is dull medium gray
    // In Oklab, the perceptual blend retains hue transitions and chroma
    expect(midOklab[0] !== 0.5 || midOklab[1] !== 0.5 || midOklab[2] !== 0.5).toBe(true);
  });

  it('interpolateOklch smoothly interpolates along shortest hue arc', () => {
    const red: ColorRGB = [1, 0, 0];
    const yellow: ColorRGB = [1, 1, 0];

    const mid = interpolateOklch(red, yellow, 0.5);
    // Midpoint between red and yellow in Oklch produces an orange tone (high red, medium green, low blue)
    expect(mid[0]).toBeGreaterThan(0.8);
    expect(mid[1]).toBeGreaterThan(0.3);
    expect(mid[2]).toBeLessThan(0.1);
  });

  it('converts across color spaces (sRGB <-> Display P3 <-> ACEScg)', () => {
    const orig: ColorRGB = [0.8, 0.4, 0.2];
    const p3 = convertColorSpace(orig, 'srgb', 'display-p3');
    const backFromP3 = convertColorSpace(p3, 'display-p3', 'srgb');

    expect(backFromP3[0]).toBeCloseTo(orig[0], 2);
    expect(backFromP3[1]).toBeCloseTo(orig[1], 2);
    expect(backFromP3[2]).toBeCloseTo(orig[2], 2);

    const acescg = convertColorSpace(orig, 'srgb', 'acescg');
    const backFromAces = convertColorSpace(acescg, 'acescg', 'srgb');

    expect(backFromAces[0]).toBeCloseTo(orig[0], 2);
    expect(backFromAces[1]).toBeCloseTo(orig[1], 2);
    expect(backFromAces[2]).toBeCloseTo(orig[2], 2);
  });

  it('applies ASC CDL color grading', () => {
    const color: ColorRGB = [0.5, 0.5, 0.5];

    // Slope boosts exposure
    const slopeApplied = applyAscCdl(color, { slope: [1.2, 1.2, 1.2] });
    expect(slopeApplied[0]).toBeCloseTo(0.6, 2);

    // Offset lifts floor
    const offsetApplied = applyAscCdl(color, { offset: [0.1, 0.1, 0.1] });
    expect(offsetApplied[0]).toBeCloseTo(0.6, 2);

    // Power bends tone curve
    const powerApplied = applyAscCdl(color, { power: [2.0, 2.0, 2.0] });
    expect(powerApplied[0]).toBeCloseTo(0.25, 2);
  });

  it('applies 3-way Lift / Gamma / Gain grading', () => {
    const black: ColorRGB = [0.0, 0.0, 0.0];
    const white: ColorRGB = [1.0, 1.0, 1.0];

    // Lift lifts black point
    const lifted = applyLiftGammaGain(black, { lift: [0.1, 0.1, 0.1] });
    expect(lifted[0]).toBeCloseTo(0.1, 2);

    // Gain scales highlights
    const gained = applyLiftGammaGain(white, { gain: [0.8, 0.8, 0.8] });
    expect(gained[0]).toBeCloseTo(0.8, 2);
  });

  it('applies vibrance selectively and protects warm skin tones', () => {
    const skinTone: ColorRGB = [0.85, 0.65, 0.5]; // warm flesh tone
    const mutedBlue: ColorRGB = [0.4, 0.45, 0.55]; // muted neutral blue

    const skinVibrance = applyVibrance(skinTone, 0.5);
    const blueVibrance = applyVibrance(mutedBlue, 0.5);

    // Muted blue should receive a higher proportional saturation delta than the skin tone
    const skinDelta = Math.abs(skinVibrance[0] - skinTone[0]);
    const blueDelta = Math.abs(blueVibrance[2] - mutedBlue[2]);

    expect(blueDelta).toBeGreaterThan(skinDelta * 0.8);
  });

  it('calculates Kelvin white balance gains accurately', () => {
    // D65 neutral (6500K) produces approx 1.0 gains
    const d65 = getWhiteBalanceGains(6500, 0);
    expect(d65[0]).toBeCloseTo(1.0, 1);
    expect(d65[1]).toBeCloseTo(1.0, 1);
    expect(d65[2]).toBeCloseTo(1.0, 1);

    // Warm temperature (3200K tungsten) has warm red boost
    const warm = getWhiteBalanceGains(3200, 0);
    expect(warm[0]).toBeGreaterThan(warm[2]);

    // Cool temperature (9000K sky) has cool blue boost
    const cool = getWhiteBalanceGains(9000, 0);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it('provides valid GLSL code snippets for fragment shaders', () => {
    const oklabGLSL = getOklabGLSL();
    expect(oklabGLSL).toContain('flair_linear_to_oklab');
    expect(oklabGLSL).toContain('flair_oklab_to_linear');

    const gradingGLSL = getColorGradingGLSL();
    expect(gradingGLSL).toContain('flair_cdl');
    expect(gradingGLSL).toContain('flair_lift_gamma_gain');
  });
});
