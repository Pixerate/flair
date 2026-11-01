import { describe, it, expect } from 'vitest';
import { applyRig, setRigWidget, type SceneRig } from './rig.js';
import { applySceneTool } from '../agent/tools.js';
import type { Scene } from './types.js';

const SHADER = 'uniform float speed; // @control\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(speed); }';
const bgValues = (scene: Scene) => scene.shots[0]!.layers![0]!.values as Record<string, number>;

describe('Scene Rigs & Macro Parameters', () => {
  it('interpolates slider values across snapshots', () => {
    const rig: SceneRig = {
      widgets: {
        intensity: {
          type: 'slider',
          name: 'intensity',
          value: 0.5,
          snapshots: [
            { at: 0.0, values: { 'layers.bg.speed': 1.0, 'layers.bg.glow': 0.2 } },
            { at: 1.0, values: { 'layers.bg.speed': 5.0, 'layers.bg.glow': 1.0 } },
          ],
        },
      },
    };

    const scene: Scene = {
      name: 'rig-demo',
      shots: [{ hold: 500, layers: [{ id: 'bg', source: SHADER, values: { speed: 1.0, glow: 0.2 } }] }],
    };

    const applied = applyRig(rig, scene);
    expect(bgValues(applied).speed).toBeCloseTo(3.0);
    expect(bgValues(applied).glow).toBeCloseTo(0.6);

    // Update slider to 0.75
    const updatedRig = setRigWidget(rig, 'intensity', 0.75);
    const applied2 = applyRig(updatedRig, scene);
    expect(bgValues(applied2).speed).toBeCloseTo(4.0);
    expect(bgValues(applied2).glow).toBeCloseTo(0.8);
  });

  it('selects option states from popup widgets', () => {
    const rig: SceneRig = {
      widgets: {
        colorway: {
          type: 'popup',
          name: 'colorway',
          selected: 'neon',
          options: {
            monochrome: { 'layers.bg.saturation': 0.0, 'layers.bg.contrast': 1.2 },
            neon: { 'layers.bg.saturation': 1.8, 'layers.bg.contrast': 1.5 },
          },
        },
      },
    };

    const scene: Scene = {
      name: 'popup-demo',
      shots: [{ hold: 500, layers: [{ id: 'bg', source: SHADER, values: { saturation: 1.0, contrast: 1.0 } }] }],
    };

    const applied = applyRig(rig, scene);
    expect(bgValues(applied).saturation).toBe(1.8);
    expect(bgValues(applied).contrast).toBe(1.5);

    const switchedRig = setRigWidget(rig, 'colorway', 'monochrome');
    const appliedSwitched = applyRig(switchedRig, scene);
    expect(bgValues(appliedSwitched).saturation).toBe(0.0);
    expect(bgValues(appliedSwitched).contrast).toBe(1.2);
  });

  it('toggles parameters on and off', () => {
    const rig: SceneRig = {
      widgets: {
        filmGrain: {
          type: 'toggle',
          name: 'filmGrain',
          enabled: true,
          on: { 'layers.bg.grain': 0.35 },
          off: { 'layers.bg.grain': 0.0 },
        },
      },
    };

    const scene: Scene = {
      name: 'toggle-demo',
      shots: [{ hold: 500, layers: [{ id: 'bg', source: SHADER, values: { grain: 0.0 } }] }],
    };

    const applied = applyRig(rig, scene);
    expect(bgValues(applied).grain).toBe(0.35);

    const disabledRig = setRigWidget(rig, 'filmGrain', false);
    const appliedDisabled = applyRig(disabledRig, scene);
    expect(bgValues(appliedDisabled).grain).toBe(0.0);
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
      rig: {
        widgets: {
          tempo: {
            type: 'slider',
            name: 'tempo',
            value: 0.0,
            snapshots: [
              { at: 0.0, values: { 'layers.bg.speed': 1.0 } },
              { at: 1.0, values: { 'layers.bg.speed': 10.0 } },
            ],
          },
        },
      },
      shots: [{ hold: 500, layers: [{ id: 'bg', source: SHADER, values: { speed: 1.0 } }] }],
    };

    const res = await applySceneTool(scene, 'set_rig_widget', {
      name: 'tempo',
      value: 0.5,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(bgValues(res.scene).speed).toBeCloseTo(5.5);
      expect((res.scene.rig?.widgets.tempo as any).value).toBe(0.5);
    }
  });

  it('sets a bare control on the layers that have it, and leaves the scene given alone', () => {
    const scene: Scene = {
      name: 'bare-demo',
      shots: [{ layers: [{ id: 'bg', source: SHADER }, { id: 'aura', effect: 'aurora' }] }],
    };
    const rig: SceneRig = { widgets: { pace: { type: 'toggle', name: 'pace', enabled: true, on: { speed: 2 }, off: { speed: 1 } } } };
    const applied = applyRig(rig, scene);
    expect(applied.shots[0]!.layers![0]!.values).toEqual({ speed: 2 });
    expect(applied.shots[0]!.layers![1]!.values).toEqual({});
    expect(scene.shots[0]!.layers![0]!.values).toBeUndefined();
  });
});
