import { describe, it, expect } from 'vitest';
import type { Scene } from '../scene/types.js';
import { applySceneBatch, substituteVariables } from './batch.js';

describe('Atomic Agent Multi-Tool Batching', () => {
  const initialScene: Scene = {
    name: 'Test Scene',
    stage: { width: 1920, height: 1080 },
    shots: [
      {
        title: 'Opening',
        hold: 3000,
      },
    ],
  };

  it('substitutes variables from earlier step results', () => {
    const mockResults = new Map();
    mockResults.set(1, {
      ok: true,
      scene: {
        name: 'Updated Scene',
        shots: [{ title: 'Shot Alpha', hold: 4500 }],
      },
    });

    // Direct reference
    expect(substituteVariables('$1.scene.name', mockResults)).toBe('Updated Scene');
    expect(substituteVariables('$1.scene.shots[0].hold', mockResults)).toBe(4500);

    // Template string interpolation
    expect(substituteVariables('New title for $1.scene.shots[0].title', mockResults)).toBe(
      'New title for Shot Alpha',
    );
  });

  it('executes a multi-step batch successfully', async () => {
    const result = await applySceneBatch(initialScene, [
      {
        tool: 'update_shot',
        params: {
          shot: 1,
          set: { title: 'Renamed Opening' },
        },
      },
      {
        tool: 'insert_shots',
        params: {
          after: 1,
          shots: [{ title: 'Second Shot', hold: 2000 }],
        },
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.scene.shots.length).toBe(2);
    expect(result.scene.shots[0]!.title).toBe('Renamed Opening');
    expect(result.scene.shots[1]!.title).toBe('Second Shot');
    expect(result.steps.length).toBe(2);
  });

  it('rolls back atomically to initial scene if any step fails', async () => {
    const result = await applySceneBatch(initialScene, [
      {
        tool: 'update_shot',
        params: {
          shot: 1,
          set: { title: 'Should Be Discarded' },
        },
      },
      {
        tool: 'update_shot',
        params: {
          shot: 999, // Out of bounds -> fails
          set: { title: 'Invalid' },
        },
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe(2);
    // Scene state rolled back to pristine initial state
    expect(result.scene).toBe(initialScene);
    expect(result.scene.shots[0]!.title).toBe('Opening');
  });

  it('chains outputs using substitution across batch commands', async () => {
    const result = await applySceneBatch(initialScene, [
      {
        tool: 'insert_shots',
        params: {
          after: 1,
          shots: [{ title: 'Target Shot', hold: 5000 }],
        },
      },
      {
        tool: 'update_shot',
        params: {
          shot: 2,
          set: {
            hold: '$1.scene.shots[0].hold', // Copy hold from shot 1 (3000)
          },
        },
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.scene.shots[1]!.hold).toBe(3000);
  });
});
