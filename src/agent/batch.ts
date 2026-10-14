/**
 * Atomic Agent Multi-Tool Batching with Result Variable Substitution.
 * Inspired by EffectCraft's atomic batch execution protocol.
 *
 * Allows AI agents to execute multi-step modifications to a Scene in a single turn,
 * with atomic rollback on failure and cross-step variable substitution ($1.prop, $2.prop).
 */

import type { Scene } from '../scene/types.js';
import { applySceneTool, type SceneToolResult } from './tools.js';

export interface BatchCommand {
  /** Name of the tool to execute (e.g. 'update_shot', 'insert_shots', 'set_rig_widget'). */
  tool: string;
  /** Parameters for the tool call. */
  params?: Record<string, any>;
}

export interface BatchExecutionStepResult {
  step: number;
  tool: string;
  result: SceneToolResult;
}

export interface BatchExecutionResult {
  ok: boolean;
  scene: Scene;
  steps: BatchExecutionStepResult[];
  error?: string;
  failedStep?: number;
}

/**
 * Resolves nested property path on an object (e.g. "a.b[0].c").
 */
function getByPath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Recursively substitutes `$stepIndex.path` references in parameters using previous step results.
 * E.g., "$1.scene.shots[0].duration" -> substituted with the duration value from step 1 result.
 */
export function substituteVariables(
  value: any,
  stepResults: Map<number, SceneToolResult>,
): any {
  if (typeof value === 'string') {
    // Check if the entire string is a substitution reference: "$1.path.to.prop"
    const match = /^\$(\d+)\.(.+)$/.exec(value);
    if (match) {
      const stepIdx = parseInt(match[1]!, 10);
      const path = match[2]!;
      const prevResult = stepResults.get(stepIdx);
      if (prevResult) {
        const resolved = getByPath(prevResult, path);
        if (resolved !== undefined) {
          return resolved;
        }
      }
    }
    // Partial template string substitution: "Hello $1.scene.name"
    return value.replace(/\$(\d+)\.([a-zA-Z0-9_.[\]]+)/g, (fullMatch, stepStr, path) => {
      const stepIdx = parseInt(stepStr, 10);
      const prevResult = stepResults.get(stepIdx);
      if (prevResult) {
        const resolved = getByPath(prevResult, path);
        if (resolved !== undefined) {
          return String(resolved);
        }
      }
      return fullMatch;
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteVariables(item, stepResults));
  }

  if (value !== null && typeof value === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      copy[k] = substituteVariables(v, stepResults);
    }
    return copy;
  }

  return value;
}

/**
 * Executes an atomic batch of scene tools with transactional rollback.
 * If any step fails, the scene rolls back to the initial state and returns the failure.
 *
 * @param scene Initial scene state before batch.
 * @param commands Ordered array of tool commands to execute.
 */
export async function applySceneBatch(
  scene: Scene,
  commands: BatchCommand[],
): Promise<BatchExecutionResult> {
  let currentScene = scene;
  const stepResults = new Map<number, SceneToolResult>();
  const executedSteps: BatchExecutionStepResult[] = [];

  for (let i = 0; i < commands.length; i++) {
    const stepNumber = i + 1; // 1-based indexing for user/agent ergonomics
    const cmd = commands[i]!;

    // Perform variable substitution using results of earlier steps
    const resolvedParams = substituteVariables(cmd.params || {}, stepResults);

    // Prevent recursive batch execution to avoid cycles
    if (cmd.tool === 'batch_scene_tool') {
      return {
        ok: false,
        scene, // Rollback
        steps: executedSteps,
        error: `Nested batch_scene_tool is not allowed at step ${stepNumber}.`,
        failedStep: stepNumber,
      };
    }

    const stepResult = await applySceneTool(currentScene, cmd.tool, resolvedParams);
    stepResults.set(stepNumber, stepResult);
    executedSteps.push({
      step: stepNumber,
      tool: cmd.tool,
      result: stepResult,
    });

    if (!stepResult.ok) {
      // Transactional rollback: discard intermediate scenes and return original
      return {
        ok: false,
        scene, // Rollback to initial
        steps: executedSteps,
        error: `Step ${stepNumber} (${cmd.tool}) failed: ${stepResult.error}`,
        failedStep: stepNumber,
      };
    }

    currentScene = stepResult.scene;
  }

  return {
    ok: true,
    scene: currentScene,
    steps: executedSteps,
  };
}
