import type { ControlValue } from '../shader/controls.js';
import type { LiveSource } from '../shader/textures.js';
import type { Rect } from './geometry.js';

/**
 * Something a layer shows or applies its effect to, written in the scene
 * as JSON: a picture or SVG (a URL, a `data:` URL or `<svg>` markup), a
 * video by URL, or words.
 */
export type SceneSubject =
  | { image: string }
  | { video: string }
  | { svg: string }
  | { text: string; font?: string; weight?: number | string };

/** A subject the host fills in at play or record time, by name: `{ "slot": "productShot" }`. */
export interface SubjectSlot {
  slot: string;
}

/** A layer's subject: written in the scene, or a slot the host fills. */
export type LayerSubject = SceneSubject | SubjectSlot;

/**
 * What a host fills a slot with: anything a scene could have written, or a
 * live source (a playing `<video>`, a canvas) as `{ video }`.
 */
export type SlotSubject = SceneSubject | { video: LiveSource };

/** Subjects by slot name, for `playScene`, `scenePlan` and `recordScene`. */
export type SceneSubjects = Record<string, SlotSubject>;

/**
 * Where a layer sits in the stack: `background` under the element board,
 * `subject` on the board above its elements, `overlay` above everything
 * but the title and caption.
 */
export type LayerRole = 'background' | 'subject' | 'overlay';

export const LAYER_ROLES: readonly LayerRole[] = ['background', 'subject', 'overlay'];

/** The kinds of subject a scene can write, as `subject` keys. */
export const SUBJECT_KINDS = ['image', 'video', 'svg', 'text'] as const;

/**
 * When a layer starts or stops: ms after its shot starts, or `{ shots: n }`
 * for when the n-th shot after its own begins (`{ shots: 1 }`: the next one).
 */
export type LayerTime = number | { shots: number };

/**
 * One layer of a shot: a catalog effect (`effect`, with `preset` and
 * `values`), a custom shader (`source`), or a bare picture (only a
 * `subject`), placed on the screen or on the board, for a stretch of time.
 *
 * ```json
 * { "effect": "aurora", "role": "background", "until": { "shots": 3 } }
 * { "effect": "image-duotone", "subject": { "slot": "productShot" }, "rect": { "x": 200, "y": 300, "width": 640, "height": 360 } }
 * { "effect": "lower-third", "role": "overlay", "values": { "title": "Ada Lovelace" }, "from": 400 }
 * ```
 */
export interface SceneLayer {
  /** A name unique in the scene, for rigs, behaviors and outlines (default `shot<N>.layer<M>`). */
  id?: string;
  /** A catalog effect's id: a shader or vector effect. Leave it out for a bare picture or a custom `source`. */
  effect?: string;
  /** A custom shader instead of a catalog effect: GLSL ES 3.00 with `void mainImage(out vec4 fragColor, in vec2 fragCoord)`, its uniforms `// @control`. */
  source?: string;
  /** A preset of the effect's, by name. */
  preset?: string;
  /** Control values over the effect's defaults (and the preset's). */
  values?: Record<string, ControlValue>;
  /** What the effect is applied to, or the picture itself for a bare picture. */
  subject?: LayerSubject;
  /** Where it sits in the stack (default `subject` when placed with `rect` or `ids`, else `background`). */
  role?: LayerRole;
  /** A box on the board in scene units: the layer moves with the camera. Without `rect` or `ids` it fills the screen. */
  rect?: Rect;
  /** Elements whose bounds (with `padding`) place it on the board, following them as they move. */
  ids?: string[];
  /** Scene units around the elements named by `ids` (default 0). */
  padding?: number;
  /** When it starts (default 0: as its shot starts). */
  from?: LayerTime;
  /** When it stops (default `{ shots: 1 }`: as the next shot starts). */
  until?: LayerTime;
  /** 0 to 1 (default 1). */
  opacity?: number;
  /** Ms it fades in and out over (default 0: it cuts). */
  fade?: number;
}

/**
 * A catalog transition into a shot: the outgoing shot's last frame
 * (`uFrom`) gives way to the incoming shot (`uTo`) as `uProgress` runs
 * from 0 to 1 over `ms`. With no camera `in`, the camera cuts and the
 * transition does the move; with one, both play together.
 */
export interface ShotTransition {
  /** A catalog transition's id (`transition-wipe`, `transition-film-burn`…). */
  effect: string;
  /** How long it takes, in ms (default 800). */
  ms?: number;
  preset?: string;
  values?: Record<string, ControlValue>;
}

/** How long a transition takes when it does not say. */
export const DEFAULT_TRANSITION_MS = 800;

/** The controls a transition is played through. */
export const TRANSITION_CONTROLS = { from: 'uFrom', to: 'uTo', progress: 'uProgress', animate: 'uAnimate' } as const;

export const isSlot = (subject: unknown): subject is SubjectSlot =>
  !!subject && typeof subject === 'object' && typeof (subject as SubjectSlot).slot === 'string';

/** The kind of a scene subject (`image`, `video`, `svg`, `text`), or undefined when it is none of them. */
export function subjectKind(subject: unknown): (typeof SUBJECT_KINDS)[number] | undefined {
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) return undefined;
  return SUBJECT_KINDS.find((k) => k in subject);
}

/** Where a layer sits in the stack: its `role`, else `subject` when placed on the board, else `background`. */
export function layerRole(layer: SceneLayer): LayerRole {
  return layer.role ?? (layer.rect || layer.ids ? 'subject' : 'background');
}

/** How a layer is named: its `id`, else `shot<N>.layer<M>` (both 1-based). */
export function layerKey(layer: SceneLayer, shotIndex: number, layerIndex: number): string {
  return typeof layer.id === 'string' && layer.id ? layer.id : `shot${shotIndex + 1}.layer${layerIndex + 1}`;
}

/** What a layer draws, in a word: its effect's id, `shader` for a custom source, or `picture`. */
export function layerWhat(layer: SceneLayer): string {
  return layer.effect ?? (layer.source !== undefined ? 'shader' : 'picture');
}
