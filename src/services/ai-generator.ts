import { JsonGenerationService } from '@pixerate/ai-core';
import { MotionSpec, MotionSpecSchema } from '../types/spec.js';

export interface MotionAiGeneratorOptions {
  /** Vertex AI / Gemini client or Vertex instance passed to @pixerate/ai-core */
  vertexClient: any;
}

/**
 * MotionAiGenerator translates natural language prompt requirements into structured MotionSpec objects
 * using @pixerate/ai-core and Google Vertex AI / Gemini.
 */
export class MotionAiGenerator {
  private jsonService: JsonGenerationService;

  constructor(options: MotionAiGeneratorOptions) {
    if (!options || !options.vertexClient) {
      throw new Error(
        'Vertex AI client is required for MotionAiGenerator. Ensure valid Vertex AI credentials are provided.'
      );
    }
    this.jsonService = new JsonGenerationService(options.vertexClient, { client: 'flair' });
  }

  /**
   * Generates a structured MotionSpec from a user prompt string using Vertex AI.
   * Throws an explicit error if Vertex AI credentials or generation fails.
   * 
   * @param prompt Natural language description of motion graphic requirements.
   * @returns Validated MotionSpec object.
   */
  public async generateSpecFromPrompt(prompt: string): Promise<MotionSpec> {
    if (!prompt || !prompt.trim()) {
      throw new Error('Prompt string cannot be empty.');
    }

    const systemPrompt = `You are an expert motion graphics designer producing Apple Motion (.motn) composition specs.
Analyze the user's prompt requirements carefully and generate a complete, vivid MotionSpec object.
Choose an appropriate template architecture ("scratch", "snap", "atmospheric", "pulse", "splash", "swarm", "3d-trailer"). Default to "scratch" to build a brand new custom template from scratch based on the prompt.
Ensure bold color choices, appropriate fonts (like Impact, Helvetica-Bold, Arial-Black), and catchy text for title, subtitle, and badges.`;

    try {
      const result = await this.jsonService.generateJson(prompt, MotionSpecSchema, {
        systemPrompt,
        temperature: 0.7,
        service: 'flair-motion-generator',
      });

      if (!result || !result.data) {
        throw new Error('Vertex AI returned an empty response.');
      }

      return MotionSpecSchema.parse(result.data);
    } catch (error: any) {
      throw new Error(
        `Vertex AI motion spec generation failed: ${error?.message || String(error)}. Check your Vertex AI / GCP credentials and configuration.`
      );
    }
  }
}
