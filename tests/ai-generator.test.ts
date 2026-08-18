import { describe, it, expect, vi } from 'vitest';
import { MotionAiGenerator } from '../src/services/ai-generator.js';

describe('MotionAiGenerator', () => {
  it('throws an error if instantiated without vertexClient', () => {
    expect(() => new MotionAiGenerator({ vertexClient: null })).toThrow(
      'Vertex AI client is required'
    );
  });

  it('throws an error if prompt is empty', async () => {
    const mockVertex = vi.fn();
    const generator = new MotionAiGenerator({ vertexClient: mockVertex });
    await expect(generator.generateSpecFromPrompt('')).rejects.toThrow(
      'Prompt string cannot be empty'
    );
  });

  it('throws an explicit error when Vertex AI fails or lacks credentials', async () => {
    const mockVertex = vi.fn().mockImplementation(() => {
      throw new Error('GCP Credentials missing or invalid');
    });

    const generator = new MotionAiGenerator({ vertexClient: mockVertex });
    await expect(
      generator.generateSpecFromPrompt('Create a title sequence for Slop Machine')
    ).rejects.toThrow('Vertex AI motion spec generation failed');
  });
});
