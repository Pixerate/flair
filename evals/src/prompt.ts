import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KIND_OF_TYPE, type DraftEffect, type EffectType, type EvalTask, type Part } from "./types.ts";

const SKILL_DIR = fileURLToPath(new URL("../../skills/flair-author/", import.meta.url));

/** A skill file without its YAML front matter. */
function skillFile(name: string): string {
  return readFileSync(SKILL_DIR + name, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

/** What the answer must look like, read by {@link parseAnswer}. */
export const ANSWER_FORMAT = `## How to answer

You cannot run commands here: the harness runs the checks (\`flair controls\`, a compile and a headless render) on your answer and sends you back anything they report, and you then answer again with the whole effect.

Answer with the effect as fenced code blocks, and nothing else is read:

1. A \`\`\`json block with the definition's fields other than the source: \`id\`, \`name\`, \`category\`, \`description\`, \`tags\`, \`presets\` (optional), and for a shader \`transparent\`, \`loop\` or \`build\` when they apply; for a vector effect its \`animate\` list, and \`hold\` or \`trigger\` when they apply.
2. For a shader, a \`\`\`glsl block with the whole fragment source. For a vector effect, an \`\`\`svg block with the whole picture.

Write the effect in full every time, never a diff or an excerpt.`;

/** The system prompt: the flair-author skill as shipped, then the answer format. */
export function systemPrompt(): string {
  return [
    "You write custom effects for @pixerate/flair, a library of WebGL2 shader and animated SVG effects. The guide below is the documentation coding agents get for this.",
    skillFile("SKILL.md"),
    skillFile("references/shader.md"),
    skillFile("references/vector.md"),
    ANSWER_FORMAT,
  ].join("\n\n---\n\n");
}

/** What each type of effect must be, told to the model whatever the mode. */
export const TYPE_CONTRACT: Record<EffectType, string> = {
  background: "A shader that draws every pixel itself (no picture input): a background.",
  filter: "A shader that changes a picture: it reads the picture from one `sampler2D` control (give it a sensible default, or leave it empty), and the harness renders it applied to a test photo through that control.",
  overlay: "A shader that draws over other content: `fragColor.a` is coverage (0 where it draws nothing) and the definition sets `transparent: true`. The harness renders it with alpha.",
  transition: "A shader transition between two pictures: `sampler2D` controls named `uFrom` and `uTo`, and a `float` control `uProgress` from 0 (shows uFrom) to 1 (shows uTo). The harness sets uProgress itself, so the transition must follow uProgress rather than iTime.",
  interactive: "A shader that answers the pointer through the built-ins (`iPointer`, `iMouse`, `iClicks`, `iTrail`) and has an idle look with no pointer. The harness acts out a pointer that hovers, wanders and clicks.",
  title: "A vector effect (an animated SVG): a title or caption.",
  loader: "A vector effect (an animated SVG): a loading indicator.",
  icon: "A vector effect (an animated SVG): an animated icon.",
  ui: "A vector effect (an animated SVG): an interface component.",
  data: "A vector effect (an animated SVG): a chart or data graphic.",
};

/** What the model is shown for a reference task, besides its frames. */
export interface ReferenceView {
  /** Strip of the reference frames, left to right in time. */
  strip: Buffer;
  frames: number;
  seconds: number;
  /** Filter: the picture before the effect. Transition: the two pictures. */
  inputs?: { label: string; png: Buffer }[];
  /** A vector reference's text. */
  text?: string;
  /** An overlay reference was shown over a checkerboard. */
  overChecker?: boolean;
}

/** The first message of a task. */
export function taskMessage(task: EvalTask, view?: ReferenceView): Part[] {
  const kind = KIND_OF_TYPE[task.type];
  const head = `Draft a new Flair ${kind} effect.\n\nType: ${TYPE_CONTRACT[task.type]}`;
  if (task.mode === "scratch") return [{ type: "text", text: `${head}\n\nBrief: ${task.brief.trim()}` }];
  if (!view) throw new Error(`Reference task "${task.id}" needs its reference frames.`);
  const parts: Part[] = [
    {
      type: "text",
      text:
        `${head}\n\nMake it look ${view.frames > 1 ? "and move " : ""}like the reference below: ${
          view.frames === 1 ? "a still" : view.seconds > 0 ? `${view.frames} frames taken evenly through ${view.seconds.toFixed(1)} s, left to right` : `${view.frames} frames in order, left to right`
        }.` +
        (view.overChecker ? " It is an overlay, shown over a grey checkerboard where it is transparent." : "") +
        (view.text ? ` It was rendered with its text set to "${view.text}"; make that text a control.` : "") +
        (task.brief.trim() ? `\n\nNotes: ${task.brief.trim()}` : ""),
    },
    { type: "image", png: view.strip, label: "Reference frames" },
  ];
  for (const input of view.inputs ?? []) parts.push({ type: "text", text: input.label }, { type: "image", png: input.png, label: input.label });
  return parts;
}

/** The message sent back when a draft has problems. */
export function feedbackMessage(problems: readonly string[]): Part[] {
  return [
    {
      type: "text",
      text: `The checks found problems with that draft:\n\n${problems.map((p) => `- ${p}`).join("\n")}\n\nFix them and send the whole effect again, in the same format.`,
    },
  ];
}

/** Fenced code blocks: their language tag (lower case, may be empty) and body. */
export function codeBlocks(text: string): { lang: string; body: string }[] {
  return [...text.matchAll(/```([\w-]*)[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1]!.toLowerCase(), body: m[2]! }));
}

/**
 * The effect in a model's answer, or the reason it cannot be read. Shaders want a `json` block and a
 * `glsl` (or `frag`) block; vector effects a `json` block and an `svg` block (or `motion` in the JSON).
 */
export function parseAnswer(text: string, kind: "shader" | "vector"): { effect: DraftEffect } | { error: string } {
  const blocks = codeBlocks(text);
  const json = blocks.find((b) => b.lang === "json" || b.lang === "jsonc");
  if (!json) return { error: "The answer has no ```json block with the effect's definition." };
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(json.body) as Record<string, unknown>;
  } catch (e) {
    return { error: `The \`\`\`json block is not valid JSON: ${(e as Error).message}.` };
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return { error: "The ```json block must hold an object: the definition's fields." };
  if (kind === "shader") {
    const glsl = blocks.find((b) => b.lang === "glsl" || b.lang === "frag" || b.lang === "glsles");
    const source = glsl?.body ?? (typeof meta.source === "string" ? meta.source : undefined);
    if (!source?.trim()) return { error: "The answer has no ```glsl block with the shader's source." };
    const { animate: _animate, motion: _motion, ...rest } = meta;
    return { effect: { ...rest, kind: "shader", id: String(meta.id ?? ""), source } };
  }
  const svgBlock = blocks.find((b) => b.lang === "svg" || b.lang === "xml");
  const motion = meta.motion as { svg?: unknown; animate?: unknown } | undefined;
  const svg = svgBlock?.body.trim() ?? (typeof motion?.svg === "string" ? motion.svg : undefined);
  if (!svg) return { error: "The answer has no ```svg block with the picture." };
  const animate = meta.animate ?? motion?.animate ?? [];
  const { animate: _a, motion: _m, source: _s, ...rest } = meta;
  return { effect: { ...rest, kind: "vector", id: String(meta.id ?? ""), motion: { svg, animate } } };
}
