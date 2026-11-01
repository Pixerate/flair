import { describe, expect, it } from 'vitest';
import type { Scene } from '../scene/types.js';
import { exportCmx3600Edl, exportFcp7Xml } from './interchange.js';
import { exportLottie } from './lottie.js';
import { exportMotn } from './motn.js';
import { sceneExportNotes } from './notes.js';

const SHADER = 'void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0); }';

const scene: Scene = {
  name: 'layered',
  stage: { width: 1920, height: 1080 },
  shots: [
    {
      title: 'One',
      hold: 1000,
      run: [{ type: 'replicate', element: { id: 'dot', type: 'ellipse', x: 100, y: 100, width: 40, height: 40 }, pattern: 'line', count: 3, spacing: 100 }],
      layers: [
        { id: 'bg', source: SHADER, until: { shots: 2 } },
        { id: 'logo', subject: { image: 'https://example.com/logo.png' }, rect: { x: 1500, y: 100, width: 300, height: 300 }, fade: 200 },
        { id: 'glow', effect: 'tick-ring-burst', ids: ['dot'], role: 'overlay' },
      ],
    },
    { title: 'Two', hold: 1000, transition: { effect: 'transition-wipe', ms: 500 } },
  ],
};

describe('scenes with layers and transitions, exported', () => {
  it('names what each format leaves out or carries only in part', () => {
    const lottie = sceneExportNotes(scene, 'lottie');
    expect(lottie).toEqual([
      expect.stringMatching(/^Layer "bg" \(shader\) is left out of the Lottie file: Lottie cannot draw shaders/),
      expect.stringMatching(/^Layer "glow" \(tick-ring-burst\) is left out/),
      'Shot 2\'s transition "transition-wipe" is a marker in the Lottie file, where the shots cut.',
    ]);
    expect(sceneExportNotes(scene, 'fcp7')).toContainEqual('Shot 2\'s transition "transition-wipe" is a cross dissolve in FCP7 XML, 500 ms long.');
    expect(sceneExportNotes(scene, 'motn')).toContainEqual(expect.stringMatching(/^Layer "logo" \(picture\) is a placeholder in Motion/));
    expect(sceneExportNotes(scene, 'edl')).toContainEqual(expect.stringMatching(/^Layer "bg" \(shader\) is a comment in the EDL/));
    expect(sceneExportNotes({ name: 'plain', shots: [{ hold: 100 }] }, 'lottie')).toEqual([]);
  });

  it('carries pictures, replicated copies and transition markers into Lottie', () => {
    const lottie = exportLottie(scene);
    expect(lottie.assets).toEqual([{ id: 'image_0', w: 300, h: 300, u: '', p: 'https://example.com/logo.png', e: 0 }]);
    const logo = lottie.layers.find((l) => l.nm === 'logo')!;
    expect(logo).toMatchObject({ ty: 2, refId: 'image_0', ip: 0, op: 30 });
    expect(logo.ks.o).toMatchObject({ a: 1 });
    expect(lottie.layers.filter((l) => l.nm.startsWith('dot_')).map((l) => l.nm)).toEqual(['dot_0', 'dot_1', 'dot_2']);
    expect(lottie.markers).toEqual([{ tm: 30, cm: 'transition: transition-wipe', dr: 15 }]);
    expect(lottie.meta?.d).toContain('Layer "bg" (shader) is left out');
  });

  it('puts layer placeholders and the transition in a Motion file', () => {
    const motn = exportMotn(scene);
    expect(motn).toContain('<scenenode name="Layer bg: shader"');
    expect(motn).toContain('<scenenode name="Layer glow: tick-ring-burst"');
    expect(motn).toContain('over dot');
    expect(motn).toContain('<!-- transition in: transition-wipe, 500 ms -->');
    expect(motn).toContain('<scenenode name="dot_2"');
    expect(motn).toMatch(/<!-- Layer "bg" \(shader\) is a placeholder in Motion/);
  });

  it('dissolves into the shot in FCP7, with each layer a clip on a track above', () => {
    const xml = exportFcp7Xml(scene);
    expect(xml).toMatch(/<transitionitem>\s*<start>30<\/start>\s*<end>45<\/end>\s*<alignment>start<\/alignment>/);
    expect(xml).toContain('<name>Cross Dissolve</name>');
    expect(xml).toContain('<name>bg: shader</name>');
    expect(xml).toContain('<name>glow: tick-ring-burst</name>');
    // bg lasts both shots; logo and glow overlap it, so three layers need three tracks.
    expect(xml.match(/<clipitem id="layer-/g)).toHaveLength(3);
    expect(xml).toContain('<clipitem id="layer-3-1">');
  });

  it('writes the transition as a dissolve event in the EDL, and the layers as comments', () => {
    const edl = exportCmx3600Edl(scene);
    expect(edl).toMatch(/^002 {2}AX {7}V {5}C {8}00:00:00:00 00:00:00:00 01:00:01:00 01:00:01:00$/m);
    expect(edl).toMatch(/^002 {2}AX {7}V {5}D {4}015 00:00:00:00 00:00:01:15 01:00:01:00 01:00:02:15$/m);
    expect(edl).toContain('* FLAIR TRANSITION: transition-wipe');
    expect(edl).toContain('* LAYER: bg (shader), background, 01:00:00:00 to 01:00:02:15');
    expect(edl).toContain('* FLAIR NOTE: Layer "logo" (picture) is a comment in the EDL');
  });
});
