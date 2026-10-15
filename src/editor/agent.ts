/**
 * Agents edit effects through the editor's commands. Flair ships the tools
 * and the instructions; the model, its credentials and the agent loop are
 * the host's (bridge the provider into an MCP server or any tool-calling LLM).
 */

import { createCommandToolProvider } from "@pixerate/editor/commands";
import type { AgentTool, AgentToolProvider, McpToolDefinition, McpToolResult } from "@pixerate/editor/generation";
import { BUILTIN_UNIFORMS } from "../shader/program.js";
import type { EffectEditor } from "./editor.js";

export interface EffectToolProviderOptions {
  /** Provider id (default `flair-effect`). */
  id?: string;
  /** Prefix every tool name with `<namespace>__`. */
  namespace?: string;
  /**
   * Captures the preview as a data URL (PNG or JPEG), adding a `view_effect`
   * tool so the agent can look at what it made. With `ShaderRenderer`:
   * `() => renderer.capture({ type: "image/png" })`.
   */
  capture?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Commands agents may not see or run. */
  exclude?: (id: string) => boolean;
}

/**
 * The effect editor as agent tools (MCP-shaped, for `@pixerate/editor`'s
 * `ToolRegistry` or any tool loop):
 *
 * - `list_commands`, `run_command`, `run_commands`: every editor command
 *   (describe, search the catalog, load, set source, values, presets,
 *   keyframes, timing, undo and redo).
 * - `view_effect`, when `capture` is given: an image of the preview.
 */
export function createEffectToolProvider(editor: EffectEditor, options: EffectToolProviderOptions = {}): AgentToolProvider {
  const base = createCommandToolProvider(editor.commands, {
    id: options.id ?? "flair-effect",
    namespace: options.namespace,
    exclude: options.exclude,
  });
  const extra: AgentTool[] = [];
  if (options.capture) {
    const capture = options.capture;
    extra.push({
      name: options.namespace ? `${options.namespace}__view_effect` : "view_effect",
      title: "View effect",
      description: "An image of the effect's preview as it is drawn now, to check what your changes look like.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      handler: async () => {
        const url = await capture();
        const match = url ? /^data:([^;,]+);base64,(.*)$/.exec(url) : null;
        if (!match) return { content: [{ type: "text", text: "Nothing to show yet: the preview has not drawn a frame." }], isError: true };
        return { content: [{ type: "image", data: match[2]!, mimeType: match[1]! }] };
      },
    });
  }
  const baseTools = () => (typeof base.tools === "function" ? base.tools() : base.tools);
  return { id: base.id, namespace: base.namespace, subscribe: base.subscribe, tools: () => [...baseTools(), ...extra] };
}

/** A provider's tool definitions without their handlers, to send to a model. */
export function toolDefinitions(provider: AgentToolProvider): McpToolDefinition[] {
  const tools = typeof provider.tools === "function" ? provider.tools() : provider.tools;
  return tools.map(({ handler: _handler, ...definition }) => definition);
}

/**
 * Runs one of a provider's tools by name, for hosts without a `ToolRegistry`:
 * the handler's result comes back as an MCP `tools/call` result, and a
 * thrown error as an `isError` result.
 */
export async function callTool(provider: AgentToolProvider, name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
  const tools = typeof provider.tools === "function" ? provider.tools() : provider.tools;
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: `There is no tool "${name}".` }], isError: true };
  try {
    const result = await tool.handler(args, { name, providerId: provider.id });
    if (result && typeof result === "object" && Array.isArray((result as McpToolResult).content)) return result as McpToolResult;
    if (result === undefined) return { content: [] };
    if (typeof result === "string") return { content: [{ type: "text", text: result }] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}

/** A system prompt for agents that author effects with these tools. Add your product's own guidance to it. */
export const EFFECT_AGENT_INSTRUCTIONS = `You design web visual effects in an effect editor. Work through its tools: \`list_commands\` shows every command with its parameters; \`run_command\` runs one; \`run_commands\` runs several in order.

Start with \`effect.describe\` to see what is being edited. To start from something close, use \`catalog.search\` then \`effect.load\` (with a preset if one fits). Every change is one undo step; \`history.undo\` reverts a step.

Shader effects are GLSL ES 3.00 fragment shaders written Shadertoy-style:
- Define \`void mainImage(out vec4 fragColor, in vec2 fragCoord)\`; the output is opaque (alpha is ignored).
- Built-in uniforms (do not declare them): ${BUILTIN_UNIFORMS.map((u) => `\`${u.type} ${u.name}\` (${u.doc})`).join("; ")}.
- Declare controls as uniforms with an annotation on the same line, e.g.
  uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"
  uniform vec3 uTint;    // @control color default=#77C16A label="Tint"
  uniform bool uGrain;   // @control default=true label="Film grain"
  uniform sampler2D uPhoto; // @control filter=linear wrap=clamp label="Photo"
  Types: float, int, bool, vec2, vec3, vec4, sampler2D. Every uniform you declare should be a control.
- Write float literals with a decimal point (1.0, not 1); GLSL does not convert int to float implicitly. Use \`texture()\`, not \`texture2D()\`.
- After \`effect.setSource\`, call \`effect.describe\` and read \`compile\`: fix any errors (their line numbers match your source) before going on.

Vector effects are animated SVG pictures: change their controls' values; their picture is edited with care, keeping element ids that animations refer to.

Make effects that loop smoothly and read well behind content: keep motion calm unless asked otherwise, keep contrast where text may sit, and expose the few controls a designer would actually want (colours, speed, scale, intensity) with sensible ranges. Use keyframes (\`keyframe.set\`, in ms) for changes over the timeline. When you can, look at the result with \`view_effect\` and refine it.`;
