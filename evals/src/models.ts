import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getEffect } from "@pixerate/flair/catalog";
import { FatalModelError, type EvalTask, type Model, type ModelRequest, type ModelResponse } from "./types.ts";

/**
 * A model from its spec:
 * - `anthropic:<model>[?effort=low|medium|high|xhigh|max]`: the Claude API (credentials from the
 *   environment: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile).
 * - `command:<shell command>`: any other model, behind a command that reads the request as JSON on
 *   stdin (`{ system, messages, schema, key }`, images as base64 PNG) and prints the answer's text.
 * - `replay:<folder>`: answers saved by an earlier run (`<folder>/<key>.md`), to re-grade without calling a model.
 * - `oracle`: answers each reference task with the catalog effect it holds out, the best any model
 *   could do: what a perfect draft scores, to calibrate the graders. Needs the tasks.
 */
export function createModel(spec: string, tasks: readonly EvalTask[] = []): Model {
  if (spec === "oracle") return oracleModel(tasks);
  const colon = spec.indexOf(":");
  const scheme = colon < 0 ? spec : spec.slice(0, colon);
  const rest = colon < 0 ? "" : spec.slice(colon + 1);
  if (scheme === "anthropic" && rest) return anthropicModel(spec, rest);
  if (scheme === "command" && rest) return commandModel(spec, rest);
  if (scheme === "replay" && rest) return replayModel(spec, rest);
  throw new Error(`"${spec}" is not a model spec; use anthropic:<model>[?effort=…], command:<shell command> or replay:<folder>.`);
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

function anthropicModel(spec: string, rest: string): Model {
  const [id, query = ""] = rest.split("?");
  const params = new URLSearchParams(query);
  const effort = params.get("effort") ?? undefined;
  if (effort !== undefined && !EFFORTS.includes(effort as Effort)) throw new Error(`effort must be one of ${EFFORTS.join(", ")}; not "${effort}".`);
  const unknown = [...params.keys()].filter((k) => k !== "effort");
  if (unknown.length) throw new Error(`"${spec}" has unknown option ${unknown.join(", ")}; the only option is effort.`);
  const client = new Anthropic();
  return {
    name: spec,
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const messages: Anthropic.MessageParam[] = request.messages.map((m) => ({
        role: m.role,
        content: m.content.map((p): Anthropic.ContentBlockParam =>
          p.type === "text" ? { type: "text", text: p.text } : { type: "image", source: { type: "base64", media_type: "image/png", data: p.png.toString("base64") } },
        ),
      }));
      const outputConfig: Record<string, unknown> = {};
      if (effort) outputConfig.effort = effort;
      if (request.schema) outputConfig.format = { type: "json_schema", schema: request.schema };
      const stream = client.messages.stream({
        model: id!,
        max_tokens: 64000,
        system: request.system,
        messages,
        ...(Object.keys(outputConfig).length && { output_config: outputConfig as Anthropic.OutputConfig }),
      });
      let message: Anthropic.Message;
      try {
        message = await stream.finalMessage();
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError || /authentication method/i.test((e as Error).message))
          throw new FatalModelError(`${spec}: ${(e as Error).message.replace(/\.?\s*$/, ".")} Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN, or run \`ant auth login\`) and check the model id.`);
        throw e;
      }
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { text, stop: message.stop_reason ?? undefined, usage: { input: message.usage.input_tokens, output: message.usage.output_tokens } };
    },
  };
}

function commandModel(spec: string, command: string): Model {
  return {
    name: spec,
    generate(request: ModelRequest): Promise<ModelResponse> {
      const body = JSON.stringify({
        key: request.key,
        system: request.system,
        schema: request.schema,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content.map((p) => (p.type === "text" ? p : { type: "image", media_type: "image/png", data: p.png.toString("base64"), label: p.label })),
        })),
      });
      return new Promise((resolve, reject) => {
        const child = spawn(command, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
        const out: Buffer[] = [];
        const err: Buffer[] = [];
        child.stdout.on("data", (d: Buffer) => out.push(d));
        child.stderr.on("data", (d: Buffer) => err.push(d));
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) resolve({ text: Buffer.concat(out).toString("utf8") });
          else reject(new Error(`The model command exited with ${code}: ${Buffer.concat(err).toString("utf8").trim().slice(0, 2000)}`));
        });
        child.stdin.end(body);
      });
    },
  };
}

function replayModel(spec: string, folder: string): Model {
  const root = path.resolve(folder);
  return {
    name: spec,
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const file = path.join(root, `${request.key}.md`);
      if (!existsSync(file)) throw new Error(`There is no saved answer for ${request.key} (looked for ${file}).`);
      return { text: readFileSync(file, "utf8") };
    },
  };
}

/** A catalog effect written as an answer in the format the prompt asks for. */
export function answerFor(effect: Record<string, unknown> & { kind: string }): string {
  if (effect.kind === "shader") {
    const { source, kind: _kind, ...meta } = effect;
    return `\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\`\n\n\`\`\`glsl\n${String(source)}\n\`\`\`\n`;
  }
  const { motion, kind: _kind, derived: _derived, ...meta } = effect as unknown as { motion: { svg: string; animate?: unknown } } & Record<string, unknown>;
  return `\`\`\`json\n${JSON.stringify({ ...meta, animate: motion.animate ?? [] }, null, 2)}\n\`\`\`\n\n\`\`\`svg\n${motion.svg}\n\`\`\`\n`;
}

function oracleModel(tasks: readonly EvalTask[]): Model {
  return {
    name: "oracle",
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const id = request.key.split("/")[0];
      const task = tasks.find((t) => t.id === id);
      const effect = task?.reference?.effect ? getEffect(task.reference.effect) : undefined;
      if (!effect || (effect.kind !== "shader" && effect.kind !== "vector")) throw new Error(`The oracle answers only reference tasks that hold out a catalog shader or vector effect; "${id}" does not.`);
      if (effect.kind === "vector" && (effect.derived || effect.controls)) throw new Error(`The oracle cannot answer "${id}": its effect "${effect.id}" works out values in code (derived or listed controls), which a drafted answer cannot hold.`);
      return { text: answerFor(effect as unknown as Record<string, unknown> & { kind: string }) };
    },
  };
}
