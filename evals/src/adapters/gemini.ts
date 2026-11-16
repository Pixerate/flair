#!/usr/bin/env node
/**
 * A `command:` model for Google's Gemini API, so the eval can run Gemini models without the library
 * depending on Google's SDK:
 *
 *   --model "command:node src/adapters/gemini.ts gemini-4-hydrogen"
 *
 * Reads the eval's request JSON on stdin, calls `generateContent` with `GEMINI_API_KEY` (or
 * `GOOGLE_API_KEY`), and prints a response envelope (see {@link RESPONSE_MARKER}). Exits 3 for
 * failures no retry fixes (bad key, unknown model), so the run stops rather than scoring zeros.
 */
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

async function main() {
  const model = process.argv[2];
  if (!model) fail("Give the Gemini model id: node src/adapters/gemini.ts <model>", FATAL);
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) fail("Set GEMINI_API_KEY (or GOOGLE_API_KEY) to call the Gemini API.", FATAL);
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  // Rate limits and overloads are retried with backoff; other errors are reported at once.
  let response: Response | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body) });
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  if (!response!.ok) {
    const text = (await response!.text()).slice(0, 2000);
    fail(`Gemini ${model} answered HTTP ${response!.status}: ${text}`, [400, 401, 403, 404].includes(response!.status) && !/schema/i.test(text) ? FATAL : 1);
  }
  const data = (await response!.json()) as GeminiResponse;
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

main().catch((e: unknown) => fail((e as Error).message));
