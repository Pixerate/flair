import { describe, it, expect } from 'vitest';
import { exportMotn } from './motn.js';
import type { Scene } from '../scene/types.js';
import fs from 'fs';
import path from 'path';

describe('Apple Motion .motn Scene Exporter', () => {
  it('generates valid ozml 4.0 XML with correct scene settings and timing', () => {
    const scene: Scene = {
      name: 'test-motion',
      stage: { width: 1920, height: 1080 },
      shots: [
        {
          title: 'Act 1: Title',
          hold: 1000,
          run: [
            {
              type: 'element',
              element: {
                id: 'headline',
                type: 'text',
                x: 960,
                y: 540,
                width: 400,
                height: 80,
                text: 'Welcome to Flair',
              },
            },
          ],
        },
        {
          title: 'Act 2: Graphic',
          hold: 2000,
          run: [
            {
              type: 'element',
              element: {
                id: 'badge',
                type: 'rect',
                x: 200,
                y: 200,
                width: 150,
                height: 150,
              },
            },
          ],
        },
      ],
    };

    const xml = exportMotn(scene, { frameRate: 30 });

    // Validate XML DOCTYPE and root
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<!DOCTYPE ozxmlscene>');
    expect(xml).toContain('<ozml version="4.0">');

    // Validate SceneSettings
    expect(xml).toContain('<width>1920</width>');
    expect(xml).toContain('<height>1080</height>');
    expect(xml).toContain('<frameRate>30</frameRate>');

    // Timing: Shot 1 is 1000ms -> 30 frames (0 to 29). Shot 2 is 2000ms -> 60 frames (30 to 89). Total 90 frames.
    expect(xml).toContain('<duration>90</duration>');
    expect(xml).toContain('timing in="0" out="29"');
    expect(xml).toContain('timing in="30" out="89"');

    // Element nodes
    expect(xml).toContain('<scenenode name="headline"');
    expect(xml).toContain('<text>Welcome to Flair</text>');
    expect(xml).toContain('<scenenode name="badge"');
  });

  it('exports rig widgets when defined in scene', () => {
    const scene: Scene = {
      name: 'rigged-scene',
      rig: {
        widgets: {
          speedSlider: {
            type: 'slider',
            name: 'speedSlider',
            value: 0.75,
            snapshots: [],
          },
          themeToggle: {
            type: 'toggle',
            name: 'themeToggle',
            enabled: true,
            on: {},
            off: {},
          },
        },
      },
      shots: [{ hold: 500 }],
    };

    const xml = exportMotn(scene);
    expect(xml).toContain('<scenenode name="Rigs"');
    expect(xml).toContain('<scenenode name="speedSlider"');
    expect(xml).toContain('value="0.75"');
    expect(xml).toContain('<scenenode name="themeToggle"');
    expect(xml).toContain('value="1"');
  });

  it('successfully exports tests/fixtures/sample.scene.json', () => {
    const fixturePath = path.resolve(__dirname, '../../tests/fixtures/sample.scene.json');
    if (fs.existsSync(fixturePath)) {
      const scene: Scene = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
      const xml = exportMotn(scene);
      expect(xml).toContain('<ozml version="4.0">');
      expect(xml).toContain(scene.name);
    }
  });
});
