#!/usr/bin/env node
/**
 * A `command:` model for Google's Gemini API, so the eval can run Gemini models without the library
 * depending on Google's SDK:
 *
 *   --model "command:node src/adapters/gemini.ts gemini-4-hydrogen"
 *
 * Reads the eval's request JSON on stdin, calls `generateContent` and prints a response envelope
 * (see {@link RESPONSE_MARKER}). Requests may take up to 15 minutes, as a thinking model may. With `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) it calls the Gemini
 * API; without one it calls Vertex AI with Application Default Credentials (`gcloud auth
 * application-default login`), in `GOOGLE_CLOUD_PROJECT` (default: gcloud's project) and
 * `GOOGLE_CLOUD_LOCATION` (default `global`). Exits 3 for failures no retry fixes (bad credentials,
 * unknown model), so the run stops rather than scoring zeros.
 */
import { execFileSync } from "node:child_process";
import { request } from "node:https";
import { FATAL_EXIT_CODE, RESPONSE_MARKER } from "../types.ts";

interface Request {
  key: string;
  system: string;
  schema?: Record<string, unknown>;
  messages: { role: "user" | "assistant"; content: ({ type: "text"; text: string } | { type: "image"; media_type: string; data: string })[] }[];
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

const FATAL = FATAL_EXIT_CODE;

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Maps Gemini's finish reasons onto the eval's (`end_turn`, `max_tokens`, `refusal`). */
function stopReason(finish: string | undefined, blocked: string | undefined): string {
  if (blocked) return "refusal";
  if (finish === "MAX_TOKENS") return "max_tokens";
  if (finish && ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(finish)) return "refusal";
  return "end_turn";
}

interface Reply {
  status: number;
  text: string;
}

/** Most a request may take: a thinking model can take many minutes before it answers at all. */
const REQUEST_TIMEOUT_MS = 15 * 60_000;

/**
 * POSTs over node:https rather than fetch: fetch gives up when the answer's headers take more than
 * 5 minutes, which a model thinking hard does, and every retry would wait the same 5 minutes again.
 */
function post(url: string, headers: Record<string, string>, body: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "POST", headers: { ...headers, "content-length": Buffer.byteLength(body) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`no answer within ${REQUEST_TIMEOUT_MS / 60_000} minutes`)));
    req.on("error", reject);
    req.end(body);
  });
}

/** Where to send the request and how to authenticate: an API key, else Vertex AI with ADC. */
function endpoint(model: string): { url: string; headers: Record<string, string> } {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (apiKey) return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, headers: { "x-goog-api-key": apiKey } };
  const gcloud = (args: string[]) => {
    try {
      return execFileSync("gcloud", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };
  const token = gcloud(["auth", "application-default", "print-access-token"]);
  if (!token) fail("No GEMINI_API_KEY, and no Application Default Credentials: run `gcloud auth application-default login`, or set GEMINI_API_KEY.", FATAL);
  const project = process.env.GOOGLE_CLOUD_PROJECT || gcloud(["config", "get-value", "project"]);
  if (!project) fail("Set GOOGLE_CLOUD_PROJECT (or `gcloud config set project …`) to call Vertex AI.", FATAL);
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return {
    url: `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
    headers: { authorization: `Bearer ${token}`, "x-goog-user-project": project },
  };
}

async function main() {
  const model = process.argv[2];
  if (!model) fail("Give the Gemini model id: node src/adapters/gemini.ts <model>", FATAL);
  const target = endpoint(model);
  const request = JSON.parse(await readStdin()) as Request;

  const body = {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: request.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.content.map((p) => (p.type === "text" ? { text: p.text } : { inlineData: { mimeType: p.media_type, data: p.data } })),
    })),
    generationConfig: {
      maxOutputTokens: 65536,
      ...(request.schema && { responseMimeType: "application/json", responseJsonSchema: request.schema }),
    },
  };
  // Rate limits, overloads and dropped connections are retried with backoff; other errors are reported at once. An
  // endpoint that does not take a JSON Schema for the answer gets the request again without it.
  let response: Reply | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      response = await post(target.url, { "content-type": "application/json", ...target.headers }, JSON.stringify(body));
    } catch (e) {
      // A dropped connection is retried like an overload; the last one is reported.
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    if (response.status === 400 && "responseJsonSchema" in body.generationConfig && /responseJsonSchema|response_json_schema/i.test(response.text)) {
      delete (body.generationConfig as { responseJsonSchema?: unknown }).responseJsonSchema;
      continue;
    }
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  if (response!.status < 200 || response!.status >= 300) {
    const text = response!.text.slice(0, 2000);
    fail(`Gemini ${model} answered HTTP ${response!.status}: ${text}`, [400, 401, 403, 404].includes(response!.status) && !/schema/i.test(text) ? FATAL : 1);
  }
  const data = JSON.parse(response!.text) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const usage = data.usageMetadata;
  process.stdout.write(
    `${RESPONSE_MARKER}\n${JSON.stringify({
      text,
      stop: stopReason(candidate?.finishReason, data.promptFeedback?.blockReason),
      usage: { input: usage?.promptTokenCount ?? 0, output: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0) },
    })}`,
  );
}

main().catch((e: unknown) => {
  // A network error's reason (a reset, a DNS error) may be in `cause`.
  const cause = (e as { cause?: { code?: string; message?: string } }).cause;
  fail(`${(e as Error).message}${cause ? `: ${cause.code ?? ""} ${cause.message ?? ""}`.trimEnd() : ""}`);
});
