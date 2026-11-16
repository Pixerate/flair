/**
 * The shapes the eval passes around: tasks, the effects a model drafts, and what each grader found.
 */

/** What kind of Flair effect a task asks for. Camera moves, retimes and text treatments are TypeScript, so they are not drafted here. */
export type EffectKind = "shader" | "vector";

/**
 * What the effect is for, which decides how it is rendered and checked:
 * - `background`: a shader that draws every pixel by itself.
 * - `filter`: a shader that changes a picture (one `sampler2D` control).
 * - `overlay`: a shader that draws over other content, with alpha as coverage (`transparent: true`).
 * - `transition`: a shader that blends `uFrom` into `uTo` as `uProgress` goes from 0 to 1.
 * - `interactive`: a shader that answers the pointer (`iPointer`, `iMouse`, `iClicks` or `iTrail`).
 * - `title`, `loader`, `icon`, `ui`, `data`: vector effects.
 */
export type EffectType = "background" | "filter" | "overlay" | "transition" | "interactive" | "title" | "loader" | "icon" | "ui" | "data";

export const EFFECT_TYPES: readonly EffectType[] = ["background", "filter", "overlay", "transition", "interactive", "title", "loader", "icon", "ui", "data"];

export const KIND_OF_TYPE: Record<EffectType, EffectKind> = {
  background: "shader",
  filter: "shader",
  overlay: "shader",
  transition: "shader",
  interactive: "shader",
  title: "vector",
  loader: "vector",
  icon: "vector",
  ui: "vector",
  data: "vector",
};

/** `scratch`: drafted from words alone. `reference`: drafted to look like reference frames (and words naming only the type). */
export type TaskMode = "scratch" | "reference";

/** What a task's effect must do, checked without a judge. */
export interface Expectations {
  /** The frames must change over time. */
  animated?: boolean;
  /** At least this many controls. */
  minControls?: number;
  /** At least this many colour controls. */
  minColorControls?: number;
  /** At least this many text controls (vector). */
  minTextControls?: number;
  /** These control names must exist (a transition's `uFrom`, `uTo`, `uProgress`). */
  controls?: readonly string[];
  /** Vector: plays in answer to the pointer with this trigger. */
  trigger?: "hover" | "press" | "click" | "scroll";
  /** Vector: loops (no trigger). */
  loops?: boolean;
}

/** Where a reference task's frames come from. */
export interface ReferenceSource {
  /** A catalog effect, held out: rendered as the reference, never named to the model. */
  effect?: string;
  /** Picture files (PNG, JPEG, …) in time order: a still or frames of a clip. */
  images?: readonly string[];
  /** A video file; `frames` are taken from it evenly. */
  video?: string;
  /** Text given to a vector reference (and to the drafted effect). */
  text?: string;
  /** Frames to show the model (default 6). */
  frames?: number;
}

export interface EvalTask {
  /** Unique, kebab-case. */
  id: string;
  type: EffectType;
  mode: TaskMode;
  /** What to make, in a person's words. For reference tasks, extra words beside the frames (may be empty). */
  brief: string;
  reference?: ReferenceSource;
  expect?: Expectations;
}

/** One part of a message to a model. */
export type Part = { type: "text"; text: string } | { type: "image"; png: Buffer; label?: string };

export interface ModelMessage {
  role: "user" | "assistant";
  content: readonly Part[];
}

export interface ModelRequest {
  system: string;
  messages: readonly ModelMessage[];
  /** A JSON Schema the answer must follow (adapters that cannot enforce it ask for it in words). */
  schema?: Record<string, unknown>;
  /** Names the request for replay adapters: `<task>/<sample>/<turn>` or `judge/<task>/<sample>`. */
  key: string;
}

export interface ModelResponse {
  text: string;
  usage?: { input: number; output: number };
  /** Why it stopped, when the provider says (`end_turn`, `max_tokens`, `refusal`…). */
  stop?: string;
}

export interface Model {
  /** The spec it was made from, for reports: `anthropic:claude-opus-5-5`. */
  name: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

/** A drafted effect, as parsed from a model's answer: a `ShaderEffect` or `VectorEffect` definition. */
export type DraftEffect = Record<string, unknown> & { kind: EffectKind; id: string };

/** One graded check. */
export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

/** What the renderer and the frame metrics found. */
export interface RenderResult {
  ok: boolean;
  /** The compiler's or renderer's message when it failed. */
  error?: string;
  /** RGBA frames, all `width` × `height`. */
  frames: Frames;
  /** Transition only: frames at progress 0, 0.5 and 1, and the two pictures on their own. */
  transition?: { at0: Frames; mid: Frames; at1: Frames; from: Frames; to: Frames };
  ms: number;
}

export interface Frames {
  width: number;
  height: number;
  /** One RGBA buffer per frame. */
  data: Buffer[];
}

export interface JudgeScores {
  /** 1–5 each. */
  fidelity: number;
  craft: number;
  motion: number;
  controls: number;
  notes: string;
}

/** Everything about one sample of one task. */
export interface SampleResult {
  task: string;
  type: EffectType;
  kind: EffectKind;
  mode: TaskMode;
  sample: number;
  model: string;
  /** Turns the model took (1 when its first draft rendered cleanly). */
  turns: number;
  /** Its first draft parsed, passed the static checks and rendered. */
  firstTry: boolean;
  checks: Check[];
  /** 0–1 per area; absent when it could not be measured. */
  scores: { validity?: number; requirements?: number; render?: number; similarity?: number; judge?: number };
  /** 0–100. */
  overall: number;
  judge?: JudgeScores;
  /** Reference tasks: the frame metrics behind `similarity`. */
  similarity?: { palette: number; structure: number; motion: number };
  usage: { input: number; output: number };
  ms: { generate: number; render: number };
  error?: string;
  /** Folder holding the draft, its frames and the transcript. */
  dir: string;
}

/** A model failure no other sample would get past (missing credentials, a model that does not exist): the run stops. */
export class FatalModelError extends Error {
  override name = "FatalModelError";
}
