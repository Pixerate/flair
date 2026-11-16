import type { EvalTask, JudgeScores, Model, Part } from "./types.ts";
import { TYPE_CONTRACT } from "./prompt.ts";

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    fidelity: { type: "integer", description: "1-5" },
    craft: { type: "integer", description: "1-5" },
    motion: { type: "integer", description: "1-5" },
    controls: { type: "integer", description: "1-5" },
    notes: { type: "string" },
  },
  required: ["fidelity", "craft", "motion", "controls", "notes"],
  additionalProperties: false,
} as const;

const SYSTEM = `You grade visual effects drafted for a motion-graphics library. You see frames rendered from a drafted effect, left to right in time, and either the brief it was written to or frames of a reference it was meant to match. Grade what the frames show, not what the effect's description claims.

Score each from 1 to 5:
- fidelity: does it do what was asked? With a brief: every element of the brief is there and reads clearly (5), most (3), little (1). With a reference: a viewer would take it for the same effect (5), the same idea with clear differences (3), unrelated (1).
- craft: would a designer ship it? Clean, balanced, free of artefacts, banding, aliasing, clipped or illegible elements (5); passable (3); broken or ugly (1).
- motion: does it move the way it should? Smooth, purposeful timing and easing that suits the effect (5); acceptable (3); static where it should move, jerky or chaotic (1). For an effect that is meant to be still, judge whether it stays stable.
- controls: are its controls (listed) the useful knobs for this effect, well named, with sensible ranges and defaults (5); some missing or odd (3); missing or useless (1)?

Be strict and consistent: 5 is rare. Answer with JSON only: {"fidelity", "craft", "motion", "controls", "notes"}, notes a sentence or two on the biggest problems.`;

/** The judge's request for one drafted effect. */
export function judgeParts(task: EvalTask, candidate: Buffer, controls: string, reference?: Buffer, inputs: { label: string; png: Buffer }[] = []): Part[] {
  const parts: Part[] = [{ type: "text", text: `Type: ${TYPE_CONTRACT[task.type]}` }];
  if (task.mode === "scratch") parts.push({ type: "text", text: `Brief: ${task.brief}` });
  else if (reference) {
    parts.push({ type: "text", text: `Reference frames${task.brief ? ` (notes: ${task.brief})` : ""}:` }, { type: "image", png: reference, label: "Reference" });
  }
  for (const input of inputs) parts.push({ type: "text", text: input.label }, { type: "image", png: input.png, label: input.label });
  parts.push({ type: "text", text: "The drafted effect's frames:" }, { type: "image", png: candidate, label: "Candidate" });
  parts.push({ type: "text", text: `Its controls:\n${controls}` });
  return parts;
}

/** The JSON object in a judge's answer, checked. */
export function parseJudge(text: string): JudgeScores {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) throw new Error(`The judge's answer holds no JSON object: ${text.slice(0, 200)}`);
  const raw = JSON.parse(match[0]) as Record<string, unknown>;
  const score = (key: string) => {
    const n = Number(raw[key]);
    if (!Number.isFinite(n) || n < 1 || n > 5) throw new Error(`The judge's ${key} is ${String(raw[key])}, not 1 to 5.`);
    return Math.round(n);
  };
  return { fidelity: score("fidelity"), craft: score("craft"), motion: score("motion"), controls: score("controls"), notes: String(raw.notes ?? "") };
}

/** Asks the judge model, returning its scores. */
export async function judge(model: Model, key: string, parts: Part[]): Promise<JudgeScores> {
  const response = await model.generate({ system: SYSTEM, messages: [{ role: "user", content: parts }], schema: JUDGE_SCHEMA as unknown as Record<string, unknown>, key });
  return parseJudge(response.text);
}

/** The judge's scores as one number, 0 to 1: fidelity counts double. */
export function judgeScore(s: JudgeScores): number {
  return (2 * (s.fidelity - 1) + (s.craft - 1) + (s.motion - 1) + (s.controls - 1)) / 20;
}
