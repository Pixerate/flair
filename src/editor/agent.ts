/**
 * Agents edit effects through the editor's commands. Flair ships the tools
 * and the instructions; the model, its credentials and the agent loop are
 * the host's. Serve the tools with `@pixerate/editor/tools`' `ToolRegistry`
 * (MCP `tools/list` and `tools/call`), or call them directly with `callTool`.
 */

import { createCommandToolProvider } from "@pixerate/editor/commands";
import {
  createToolRegistry,
  toToolResult,
  type AgentTool,
  type AgentToolProvider,
  type McpToolDefinition,
  type McpToolResult,
  type ToolRegistry,
  type ToolRegistryOptions,
} from "@pixerate/editor/tools";
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

/**
 * A `ToolRegistry` (from `@pixerate/editor/tools`) serving the effect editor's
 * tools: `listTools()` and `callTool(name, args)` are MCP's `tools/list` and
 * `tools/call`, with arguments checked against each tool's schema. Register
 * more providers on it to give the agent other tools too.
 */
export function createEffectToolRegistry(
  editor: EffectEditor,
  options: EffectToolProviderOptions & { registry?: ToolRegistryOptions } = {},
): ToolRegistry {
  const registry = createToolRegistry({ validateArguments: true, ...options.registry });
  registry.register(createEffectToolProvider(editor, options));
  return registry;
}

/** A provider's tool definitions without their handlers, to send to a model. */
export function toolDefinitions(provider: AgentToolProvider): McpToolDefinition[] {
  const tools = typeof provider.tools === "function" ? provider.tools() : provider.tools;
  return tools.map(({ handler: _handler, ...definition }) => definition);
}

/**
 * Runs one of a provider's tools by name without a registry: the handler's
 * result comes back as an MCP `tools/call` result, and a thrown error as an
 * `isError` result. (A `ToolRegistry` also checks the arguments first.)
 */
export async function callTool(provider: AgentToolProvider, name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
  const tools = typeof provider.tools === "function" ? provider.tools() : provider.tools;
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: `There is no tool "${name}".` }], isError: true };
  try {
    return toToolResult(await tool.handler(args, { name, providerId: provider.id }));
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}

/** A system prompt for agents that author effects with these tools. Add your product's own guidance to it. */
export const EFFECT_AGENT_INSTRUCTIONS = `You design web visual effects in an effect editor. Work through its tools: \`list_commands\` shows every command with its parameters; \`run_command\` runs one; \`run_commands\` runs several in order.

Start with \`effect.describe\` to see what is being edited. To start from something close, use \`catalog.search\` then \`effect.load\` (with a preset if one fits). Every change is one undo step; \`history.undo\` reverts a step.

Shader effects are GLSL ES 3.00 fragment shaders written Shadertoy-style:
- Define \`void mainImage(out vec4 fragColor, in vec2 fragCoord)\`; the output is opaque unless the host renders with \`alpha: true\` (overlays), when \`fragColor.a\` is coverage.
- Built-in uniforms (do not declare them): ${BUILTIN_UNIFORMS.map((u) => `\`${u.type} ${u.name}\` (${u.doc})`).join("; ")}.
- Declare controls as uniforms with an annotation on the same line, e.g.
  uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"
  uniform vec3 uTint;    // @control color default=#77C16A label="Tint"
  uniform bool uGrain;   // @control default=true label="Film grain"
  uniform sampler2D uPhoto; // @control filter=linear wrap=clamp label="Photo"
  Types: float, int, bool, vec2, vec3, vec4, sampler2D. Every uniform you declare should be a control.
- Write float literals with a decimal point (1.0, not 1); GLSL does not convert int to float implicitly. Use \`texture()\`, not \`texture2D()\`.
- After \`effect.setSource\`, call \`effect.describe\` and read \`compile\`: fix any errors (their line numbers match your source) before going on.

Vector effects are animated SVG pictures that declare their controls in themselves, like shader uniforms: the first \`{{name: type …}}\` declares a control (types: float, int, bool, color, text; attributes as for \`@control\`, values with spaces in single quotes), and every \`{{name}}\` is replaced by its value, e.g.
  <!-- {{title: text default='Hello' label='Title'}} {{accent: color default=#6366F1}} --><text fill="{{accent}}">{{title}}</text>
Change their controls' values freely (a text control takes any words); edit the picture with care, keeping element ids that animations refer to.

Make effects that loop smoothly and read well behind content: keep motion calm unless asked otherwise, keep contrast where text may sit, and expose the few controls a designer would actually want (colours, speed, scale, intensity) with sensible ranges. Use keyframes (\`keyframe.set\`, in ms) for changes over the timeline. When you can, look at the result with \`view_effect\` and refine it.`;
