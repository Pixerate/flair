import { describe, it, expect } from 'vitest';
import { applyRig, setRigWidget, type SceneRig } from './rig.js';
import { applySceneTool } from '../agent/tools.js';
import type { Scene } from './types.js';

describe('Scene Rigs & Macro Parameters', () => {
  it('interpolates slider values across snapshots', () => {
    const rig: SceneRig = {
      widgets: {
        intensity: {
          type: 'slider',
          name: 'intensity',
          value: 0.5,
          snapshots: [
            { at: 0.0, values: { 'media.bg.speed': 1.0, 'media.bg.glow': 0.2 } },
            { at: 1.0, values: { 'media.bg.speed': 5.0, 'media.bg.glow': 1.0 } },
          ],
        },
      },
    };

    const scene: Scene = {
      name: 'rig-demo',
      media: {
        bg: { type: 'shader', source: '// shader', values: { speed: 1.0, glow: 0.2 } },
      },
      shots: [{ hold: 500 }],
    };

    const applied = applyRig(rig, scene);
    expect(applied.media?.bg.values?.speed).toBeCloseTo(3.0);
    expect(applied.media?.bg.values?.glow).toBeCloseTo(0.6);

    // Update slider to 0.75
    const updatedRig = setRigWidget(rig, 'intensity', 0.75);
    const applied2 = applyRig(updatedRig, scene);
    expect(applied2.media?.bg.values?.speed).toBeCloseTo(4.0);
    expect(applied2.media?.bg.values?.glow).toBeCloseTo(0.8);
  });

  it('selects option states from popup widgets', () => {
    const rig: SceneRig = {
      widgets: {
        colorway: {
          type: 'popup',
          name: 'colorway',
          selected: 'neon',
          options: {
            monochrome: { 'media.bg.saturation': 0.0, 'media.bg.contrast': 1.2 },
            neon: { 'media.bg.saturation': 1.8, 'media.bg.contrast': 1.5 },
          },
        },
      },
    };

    const scene: Scene = {
      name: 'popup-demo',
      media: {
        bg: { type: 'shader', source: '// shader', values: { saturation: 1.0, contrast: 1.0 } },
      },
      shots: [{ hold: 500 }],
    };

    const applied = applyRig(rig, scene);
    expect(applied.media?.bg.values?.saturation).toBe(1.8);
    expect(applied.media?.bg.values?.contrast).toBe(1.5);

    const switchedRig = setRigWidget(rig, 'colorway', 'monochrome');
    const appliedSwitched = applyRig(switchedRig, scene);
    expect(appliedSwitched.media?.bg.values?.saturation).toBe(0.0);
    expect(appliedSwitched.media?.bg.values?.contrast).toBe(1.2);
  });

  it('toggles parameters on and off', () => {
    const rig: SceneRig = {
      widgets: {
        filmGrain: {
          type: 'toggle',
          name: 'filmGrain',
          enabled: true,
          on: { 'media.bg.grain': 0.35 },
          off: { 'media.bg.grain': 0.0 },
        },
      },
    };

    const scene: Scene = {
      name: 'toggle-demo',
      media: {
        bg: { type: 'shader', source: '// shader', values: { grain: 0.0 } },
      },
      shots: [{ hold: 500 }],
    };

    const applied = applyRig(rig, scene);
    expect(applied.media?.bg.values?.grain).toBe(0.35);

    const disabledRig = setRigWidget(rig, 'filmGrain', false);
    const appliedDisabled = applyRig(disabledRig, scene);
    expect(appliedDisabled.media?.bg.values?.grain).toBe(0.0);
  });

  it('targets element properties', () => {
    const rig: SceneRig = {
      widgets: {
        ghostMode: {
          type: 'toggle',
          name: 'ghostMode',
          enabled: true,
          on: { 'element.hero.opacity': 0.3 },
          off: { 'element.hero.opacity': 1.0 },
        },
      },
    };

    const scene: Scene = {
      name: 'element-rig-demo',
      shots: [
        {
          run: [
            {
              type: 'element',
              element: { id: 'hero', type: 'rect', x: 0, y: 0, width: 100, height: 100, opacity: 1 },
            },
          ],
        },
      ],
    };

    const applied = applyRig(rig, scene);
    const heroEl = (applied.shots[0]?.run?.[0] as any).element;
    expect(heroEl.opacity).toBe(0.3);
  });

  it('integrates with applySceneTool agent loop', async () => {
    const scene: Scene = {
      name: 'agent-rig-demo',
      media: {
        bg: { type: 'shader', source: '// shader', values: { speed: 1.0 } },
      },
      rig: {
        widgets: {
          tempo: {
            type: 'slider',
            name: 'tempo',
            value: 0.0,
            snapshots: [
              { at: 0.0, values: { 'media.bg.speed': 1.0 } },
              { at: 1.0, values: { 'media.bg.speed': 10.0 } },
            ],
          },
        },
      },
      shots: [{ hold: 500 }],
    };

    const res = await applySceneTool(scene, 'set_rig_widget', {
      name: 'tempo',
      value: 0.5,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.media?.bg.values?.speed).toBeCloseTo(5.5);
      expect((res.scene.rig?.widgets.tempo as any).value).toBe(0.5);
    }
  });
});
