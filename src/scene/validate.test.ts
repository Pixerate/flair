import { describe, it, expect } from 'vitest';
import { validateScene } from './validate.js';
import type { Scene } from './types.js';

describe('validateScene', () => {
  it('passes on valid scene', () => {
    const scene: Scene = {
      name: 'hello-world',
      shots: [
        {
          caption: 'Welcome to Flair',
          hold: 500,
          effects: [{ type: 'gradient', id: 'grad1', colors: ['#ff0055', '#00ffcc'] }],
        },
      ],
    };

    const issues = validateScene(scene);
    expect(issues).toHaveLength(0);
  });

  it('detects missing media and invalid effect IDs', () => {
    const scene: Scene = {
      name: 'bad_name!',
      shots: [
        {
          camera: { x: 0, y: 0, width: -10, height: 100 },
          effects: [
            { type: 'media', id: 'm1', media: 'non_existent_shader' },
            { type: 'glow', id: 'g1', ids: [] },
          ],
        },
      ],
    };

    const issues = validateScene(scene);
    expect(issues.some((i) => i.message.includes('lowercase words and dashes'))).toBe(true);
    expect(issues.some((i) => i.message.includes('width and height must be positive'))).toBe(true);
    expect(issues.some((i) => i.message.includes('not defined in scene.media'))).toBe(true);
    expect(issues.some((i) => i.message.includes('non-empty ids array'))).toBe(true);
  });
});
