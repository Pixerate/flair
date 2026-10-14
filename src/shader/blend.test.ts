import { describe, it, expect } from 'vitest';
import {
  ALL_BLEND_MODES,
  blendRgba,
  getGlslBlendFunction,
} from './blend.js';

describe('38-Mode Blend Engine', () => {
  it('defines all 38 blend modes', () => {
    expect(ALL_BLEND_MODES.length).toBe(38);
  });

  it('evaluates normal alpha compositing correctly', () => {
    // 50% red over fully opaque blue
    // src: [0.5, 0, 0, 0.5] (premul)
    // dst: [0, 0, 1.0, 1.0] (premul)
    const out = blendRgba('normal', [0, 0, 1.0, 1.0], [0.5, 0, 0, 0.5]);
    expect(out[0]).toBeCloseTo(0.5); // red
    expect(out[1]).toBeCloseTo(0.0);
    expect(out[2]).toBeCloseTo(0.5); // blue * (1 - 0.5)
    expect(out[3]).toBeCloseTo(1.0);
  });

  it('evaluates multiply correctly on opaque colors', () => {
    // Opaque 0.8 grey multiplied with opaque 0.5 grey = 0.4
    const out = blendRgba('multiply', [0.8, 0.8, 0.8, 1.0], [0.5, 0.5, 0.5, 1.0]);
    expect(out[0]).toBeCloseTo(0.4);
    expect(out[1]).toBeCloseTo(0.4);
    expect(out[2]).toBeCloseTo(0.4);
    expect(out[3]).toBe(1.0);
  });

  it('evaluates screen correctly on opaque colors', () => {
    // 1 - (1 - 0.5)*(1 - 0.5) = 1 - 0.25 = 0.75
    const out = blendRgba('screen', [0.5, 0.5, 0.5, 1.0], [0.5, 0.5, 0.5, 1.0]);
    expect(out[0]).toBeCloseTo(0.75);
    expect(out[1]).toBeCloseTo(0.75);
    expect(out[2]).toBeCloseTo(0.75);
    expect(out[3]).toBe(1.0);
  });

  it('evaluates difference mode', () => {
    const out = blendRgba('difference', [0.8, 0.2, 0.5, 1.0], [0.3, 0.9, 0.5, 1.0]);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0.7);
    expect(out[2]).toBeCloseTo(0.0);
    expect(out[3]).toBe(1.0);
  });

  it('evaluates stencilAlpha and silhouetteAlpha masking', () => {
    // Stencil alpha multiplies dst by src.a
    const stencil = blendRgba('stencilAlpha', [1, 1, 1, 1], [0, 0, 0, 0.4]);
    expect(stencil[0]).toBeCloseTo(0.4);
    expect(stencil[3]).toBeCloseTo(0.4);

    // Silhouette alpha cuts out src.a from dst
    const silhouette = blendRgba('silhouetteAlpha', [1, 1, 1, 1], [0, 0, 0, 0.4]);
    expect(silhouette[0]).toBeCloseTo(0.6);
    expect(silhouette[3]).toBeCloseTo(0.6);
  });

  it('generates valid GLSL code snippets', () => {
    const glsl = getGlslBlendFunction('multiply');
    expect(glsl).toContain('vec4 blend(vec4 dst, vec4 src)');
    expect(glsl).toContain('src.rgb * dst.rgb');
  });
});
