import { describe, expect, it } from 'vitest';
import type { Scene } from '../scene/types.js';
import { exportCmx3600Edl, exportFcp7Xml } from './interchange.js';
import { exportLottie } from './lottie.js';
import { exportMotn } from './motn.js';

const scene: Scene = {
  name: 'tilt',
  shots: [
    { title: 'Wide', camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 500, run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 600, y: 300, width: 400, height: 300 } }] },
    { title: 'Swoop', camera: { frame: ['card'], tilt: 35, turn: -15, in: { move: 'camera-glide', values: { motionBlur: 1.5 } } }, hold: 500 },
  ],
};

describe('exporting the camera', () => {
  it('Lottie: a 3D rig the layers hang off, and a lens', () => {
    const lottie = exportLottie(scene, { frameRate: 30 });
    expect(lottie.ddd).toBe(1);
    const [lens, rig, card] = lottie.layers;
    expect(lens).toMatchObject({ ty: 13, nm: 'Camera Lens', ddd: 1 });
    expect(rig).toMatchObject({ ty: 3, nm: 'Camera', ddd: 1 });
    expect(card).toMatchObject({ nm: 'card', parent: rig!.ind, ddd: 1 });
    // Players read an orientation alongside X/Y/Z rotations (lottie-web fails to draw without one).
    expect(rig!.ks.or).toEqual({ a: 0, k: [0, 0, 0] });
    expect(lens!.ks).toMatchObject({ or: { a: 0, k: [0, 0, 0] }, rx: { a: 0, k: 0 } });
    const rx = rig!.ks.rx as { a: number; k: { t: number; s: number[] }[] };
    expect(rx.a).toBe(1);
    expect(rx.k[0]!.s).toEqual([0]);
    expect(rx.k.at(-1)).toMatchObject({ t: 33, s: [-35] });
    expect((rig!.ks.ry as { k: { s: number[] }[] }).k.at(-1)!.s).toEqual([15]);
  });

  it('Lottie: a flat camera stays 2D, and no camera adds nothing', () => {
    const flat: Scene = { ...scene, shots: [scene.shots[0]!, { camera: { frame: ['card'] }, hold: 500 }] };
    const lottie = exportLottie(flat);
    expect(lottie.ddd).toBe(0);
    expect(lottie.layers.map((l) => l.nm)).toEqual(['Camera', 'card']);
    expect(lottie.layers[0]!.ks.rx).toBeUndefined();
    const none: Scene = { name: 'n', shots: [{ hold: 500, run: scene.shots[0]!.run }] };
    expect(exportLottie(none).layers.map((l) => l.nm)).toEqual(['card']);
  });

  it('Apple Motion: the shots sit in a keyframed camera group', () => {
    const xml = exportMotn(scene);
    expect(xml).toContain('<group name="Camera"');
    expect(xml).toContain('3D group');
    expect(xml).toContain('motion blur 1.5');
    expect(xml).toMatch(/<parameter name="Rotation" id="103">\s*<parameter name="X" id="1" value="0">\s*<curve/);
    // Motion's y points up, so a tilt that leans the top away is a negative X rotation.
    expect(xml).toContain('<value>-35</value>');
    expect(xml.indexOf('<group name="Camera"')).toBeLessThan(xml.indexOf('Shot 1'));
  });

  it('FCP7: a keyframed corner pin and motion blur on the moving shot', () => {
    const xml = exportFcp7Xml(scene);
    const swoop = xml.slice(xml.indexOf('<clipitem id="clipitem-2">'));
    expect(swoop).toContain('<effectid>deformation</effectid>');
    expect(swoop).toContain('<parameterid>ulcorner</parameterid>');
    expect(swoop).toMatch(/<keyframe><when>0<\/when><value><horiz>-0.5<\/horiz><vert>-0.5<\/vert><\/value><\/keyframe>/);
    expect(swoop).toContain('<effectid>motionblur</effectid>');
    // The wide shot is the full frame, so it needs no pin.
    const wide = xml.slice(xml.indexOf('<clipitem id="clipitem-1">'), xml.indexOf('<clipitem id="clipitem-2">'));
    expect(wide).not.toContain('deformation');
  });

  it('EDL: the camera as a note', () => {
    const edl = exportCmx3600Edl(scene);
    expect(edl).toMatch(/\* CAMERA: zoom \d\.\d\dx on \(800, 450\), tilt 35°, turn -15°, motion blur 1\.5/);
  });
});
