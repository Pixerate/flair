import { useMemo, useState } from "react";
import {
  callTool,
  createEffectToolProvider,
  EFFECT_AGENT_INSTRUCTIONS,
  toolDefinitions,
  type EffectEditor,
} from "@pixerate/flair/editor";
import type { ShaderRenderer } from "@pixerate/flair";

/** What an agent might send for "a slow, moody nebula that brightens over five seconds". */
const SAMPLE_PLAN = {
  steps: [
    { id: "catalog.search", params: { text: "space" } },
    { id: "effect.load", params: { id: "nebula" } },
    { id: "values.set", params: { values: { uGasA: "#1d4ed8", uGasB: "#f472b6", uSpeed: 0.03 } } },
    { id: "timeline.setTiming", params: { duration: 5000, loop: true } },
    { id: "keyframe.set", params: { name: "uDensity", time: 0, value: 0.3, easing: "ease-in-out" } },
    { id: "keyframe.set", params: { name: "uDensity", time: 2500, value: 1.6, easing: "ease-in-out" } },
    { id: "keyframe.set", params: { name: "uDensity", time: 5000, value: 0.3 } },
    { id: "timeline.play" },
  ],
};

interface LogEntry {
  call: string;
  result: unknown;
  error: boolean;
}

export function AgentTab({ editor, onShow }: { editor: EffectEditor; onShow: () => void }) {
  const provider = useMemo(
    () =>
      createEffectToolProvider(editor, {
        capture: () => (window as unknown as { flairPreview?: ShaderRenderer }).flairPreview?.capture({ type: "image/png", maxEdge: 512 }),
      }),
    [editor],
  );
  const definitions = useMemo(() => toolDefinitions(provider), [provider]);
  const [tool, setTool] = useState("run_command");
  const [args, setArgs] = useState(JSON.stringify({ id: "effect.describe" }, null, 2));
  const [log, setLog] = useState<LogEntry[]>([]);

  const run = async (name: string, input: string) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = input.trim() ? JSON.parse(input) : {};
    } catch (e) {
      setLog((l) => [{ call: name, result: `Arguments are not JSON: ${(e as Error).message}`, error: true }, ...l]);
      return;
    }
    const result = await callTool(provider, name, parsed);
    const shown = result.content.map((c) => (c.type === "image" ? { type: "image", bytes: String((c as { data: string }).data).length } : c));
    setLog((l) => [{ call: `${name} ${input.length > 80 ? "{…}" : input.replace(/\s+/g, " ")}`, result: result.structuredContent ?? shown, error: !!result.isError }, ...l]);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-4 min-w-0">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Bring your own model</h1>
          <p className="text-sm text-slate-400">
            The editor exposes every action as a command, and the commands as MCP-shaped tools (<code>list_commands</code>, <code>run_command</code>,{" "}
            <code>run_commands</code>, plus <code>view_effect</code> when you can capture the preview). Plug the provider into{" "}
            <code>@pixerate/editor</code>'s <code>ToolRegistry</code>, an MCP server, or any tool-calling LLM: Flair ships the tools and instructions, never a
            model or credentials.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300">
            <code>{`import { createEffectEditor, createEffectToolProvider,
  toolDefinitions, callTool, EFFECT_AGENT_INSTRUCTIONS } from "@pixerate/flair/editor";

const editor = createEffectEditor({ from: "aurora" });
const tools = createEffectToolProvider(editor);

// Your agent loop: send toolDefinitions(tools) and EFFECT_AGENT_INSTRUCTIONS
// to your model, then for each tool call:
const result = await callTool(tools, call.name, call.input);`}</code>
          </pre>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Try a tool call</h2>
            <button
              onClick={async () => {
                setTool("run_commands");
                const input = JSON.stringify(SAMPLE_PLAN, null, 2);
                setArgs(input);
                await run("run_commands", input);
              }}
              className="ml-auto rounded-md bg-violet-600 px-3 py-1 text-sm hover:bg-violet-500"
            >
              Run a sample agent plan
            </button>
            <button onClick={onShow} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              See it in the editor
            </button>
          </div>
          <select value={tool} onChange={(e) => setTool(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm" aria-label="Tool">
            {definitions.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <textarea
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            spellCheck={false}
            className="block h-48 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
            aria-label="Tool arguments (JSON)"
          />
          <button onClick={() => run(tool, args)} className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800">
            Call {tool}
          </button>
          <div className="space-y-2 max-h-96 overflow-auto">
            {log.map((entry, i) => (
              <div key={log.length - i} className={`rounded-lg border p-2 text-xs ${entry.error ? "border-rose-900 bg-rose-950/30" : "border-slate-800 bg-slate-950"}`}>
                <div className="font-mono text-slate-400">→ {entry.call}</div>
                <pre className="mt-1 whitespace-pre-wrap break-words text-slate-200">{typeof entry.result === "string" ? entry.result : JSON.stringify(entry.result, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 min-w-0">
        <details open className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <summary className="cursor-pointer font-medium">Instructions for the model</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-300">{EFFECT_AGENT_INSTRUCTIONS}</pre>
        </details>
        <details className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <summary className="cursor-pointer font-medium">Tool definitions ({definitions.length})</summary>
          <pre className="mt-3 max-h-[32rem] overflow-auto text-xs text-slate-300">{JSON.stringify(definitions, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
