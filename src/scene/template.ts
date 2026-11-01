import { isSlot, subjectKind, type SceneSubject, type SubjectSlot } from './layers.js';
import type { Scene } from './types.js';
import { validateScene, type SceneIssue } from './validate.js';

/*
 * Sequence templates: a scene with declared slots that a person or an agent
 * fills to get a finished scene. Subject slots are the layer slots a scene
 * already has (`{ "slot": "product" }` on a layer); the other slots fill
 * `{{name}}` placeholders in the scene's strings, the way vector effects
 * fill `{{control}}`.
 */

/** The kinds of picture a subject slot takes. */
export const SUBJECT_SLOT_TYPES = ['image', 'video', 'svg'] as const;
export type SubjectSlotType = (typeof SUBJECT_SLOT_TYPES)[number];

/** Every kind of slot: a subject (`image`, `video`, `svg`), `text`, `color` or `number`. */
export const TEMPLATE_SLOT_TYPES = [...SUBJECT_SLOT_TYPES, 'text', 'color', 'number'] as const;
export type TemplateSlotType = (typeof TEMPLATE_SLOT_TYPES)[number];

interface SlotBase {
  /** How the scene names it: `{ "slot": name }` on a layer for a subject, `{{name}}` in a string otherwise. Letters, digits, `-` and `_`, starting with a letter. */
  name: string;
  /** What a form shows for it ("Product shot"). */
  label: string;
  /** A sentence on what it is for. */
  description?: string;
}

/**
 * A picture, SVG or video a layer shows: the layers whose `subject` is
 * `{ "slot": name }`. Its `default` (a URL, a `data:` URL or `<svg>` markup)
 * fills it when no value is given; without one it stays a slot for the host
 * to fill at play time.
 */
export interface SubjectTemplateSlot extends SlotBase {
  type: SubjectSlotType;
  default?: string;
}

/** Words for `{{name}}`: a title, a caption, a layer's text. */
export interface TextTemplateSlot extends SlotBase {
  type: 'text';
  default: string;
  /** The most characters it takes. */
  maxLength?: number;
}

/** A colour for `{{name}}`, written `#RRGGBB` (or `#RGB`). */
export interface ColorTemplateSlot extends SlotBase {
  type: 'color';
  default: string;
}

/** A number for `{{name}}`: `"hold": "{{holdMs}}"` writes the number itself. */
export interface NumberTemplateSlot extends SlotBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  /** Whole numbers only. */
  integer?: boolean;
}

export type TemplateSlot = SubjectTemplateSlot | TextTemplateSlot | ColorTemplateSlot | NumberTemplateSlot;

/** A value written as a placeholder: `"{{holdMs}}"` where a number goes. */
type Placeholder = `{{${string}}}`;

/** A scene field as a template writes it: a number or a flag may be a whole-string placeholder. */
export type Templated<T> = T extends string
  ? string
  : T extends number | boolean
    ? T | Placeholder
    : T extends readonly (infer U)[]
      ? Templated<U>[]
      : T extends object
        ? { [K in keyof T]: Templated<T[K]> }
        : T;

/** A scene whose strings may hold `{{slot}}` placeholders. */
export type TemplateScene = Templated<Scene>;

/**
 * A reusable scene with declared slots:
 *
 * ```json
 * {
 *   "id": "product-reveal", "name": "Product reveal", "description": "…",
 *   "slots": [
 *     { "name": "product", "type": "image", "label": "Product shot", "default": "<svg …>" },
 *     { "name": "headline", "type": "text", "label": "Headline", "default": "Meet Nova", "maxLength": 40 }
 *   ],
 *   "scene": { "name": "product-reveal", "shots": [{ "title": "{{headline}}", "layers": [{ "subject": { "slot": "product" } }] }] }
 * }
 * ```
 *
 * {@link instantiateTemplate} fills it.
 */
export interface SceneTemplate {
  /** Lowercase words and dashes. */
  id: string;
  name: string;
  description: string;
  tags?: string[];
  /** In the order a form shows them. */
  slots: TemplateSlot[];
  scene: TemplateScene;
}

/** What fills a slot: words, a colour or a number; for a subject slot a URL or markup, a subject object, or `{ "slot": name }` to leave it for the host. */
export type TemplateValue = string | number | SceneSubject | SubjectSlot;

export type TemplateValues = Record<string, TemplateValue>;

export type TemplateResult =
  | {
      ok: true;
      scene: Scene;
      /** `validateScene`'s issues with the filled scene. */
      issues: SceneIssue[];
      /** Subject slots left for the host to fill at play time (`PlayOptions.subjects`, `--subject`). */
      openSlots: string[];
    }
  | {
      ok: false;
      /** What was wrong with the values, each a sentence naming the valid choices. */
      errors: string[];
    };

const SLOT_NAME = /^[A-Za-z][\w-]*$/;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PLACEHOLDER = /\{\{([A-Za-z][\w-]*)\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{([A-Za-z][\w-]*)\}\}$/;

export const isSubjectSlotType = (type: unknown): type is SubjectSlotType => SUBJECT_SLOT_TYPES.includes(type as SubjectSlotType);

const typeName = (value: unknown): string =>
  value === null ? 'null' : Array.isArray(value) ? 'a list' : typeof value === 'object' ? 'an object' : typeof value === 'string' ? `the words ${JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)}` : `${typeof value === 'number' ? 'the number' : 'the value'} ${String(value)}`;

/** A number slot's range in words: "from 800 to 6000", "of at least 0"… */
function range(slot: NumberTemplateSlot): string {
  const whole = slot.integer ? 'whole number' : 'number';
  if (slot.min !== undefined && slot.max !== undefined) return `a ${whole} from ${slot.min} to ${slot.max}`;
  if (slot.min !== undefined) return `a ${whole} of at least ${slot.min}`;
  if (slot.max !== undefined) return `a ${whole} of at most ${slot.max}`;
  return `a ${whole}`;
}

/** What a slot takes, in a few words, for refusals and listings. */
function takes(slot: TemplateSlot): string {
  switch (slot.type) {
    case 'text':
      return `words${slot.maxLength !== undefined ? ` (up to ${slot.maxLength} characters)` : ''}`;
    case 'color':
      return `a colour like "${slot.default}"`;
    case 'number':
      return range(slot);
    case 'video':
      return 'a video URL';
    case 'svg':
      return 'SVG markup or an SVG URL';
    default:
      return 'a picture: a URL, a data: URL or <svg> markup';
  }
}

/** One line on a slot: its name, type, what it takes and its default. */
export function templateSlotSummary(slot: TemplateSlot): string {
  const fallback = isSubjectSlotType(slot.type) ? (slot.default !== undefined ? 'a placeholder by default' : 'the host fills it when none is given') : `default ${JSON.stringify(slot.default)}`;
  return `${slot.name} (${slot.type}): ${slot.label}; takes ${takes(slot)}; ${fallback}.`;
}

/** The problem with a value for a slot, or undefined when it fits. */
function valueProblem(slot: TemplateSlot, value: unknown): string | undefined {
  const no = (extra = '') => `Slot "${slot.name}" takes ${takes(slot)}${extra}, not ${typeName(value)}.`;
  switch (slot.type) {
    case 'text':
      if (typeof value !== 'string') return no();
      if (slot.maxLength !== undefined && value.length > slot.maxLength) return `Slot "${slot.name}" takes up to ${slot.maxLength} characters; ${JSON.stringify(value.slice(0, 20) + '…')} has ${value.length}. Shorten it.`;
      return undefined;
    case 'color':
      return typeof value === 'string' && COLOR.test(value) ? undefined : no();
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return no();
      if (slot.integer && !Number.isInteger(value)) return `Slot "${slot.name}" takes ${range(slot)}; ${value} is not whole.`;
      if ((slot.min !== undefined && value < slot.min) || (slot.max !== undefined && value > slot.max)) return `Slot "${slot.name}" takes ${range(slot)}; ${value} is out of range.`;
      return undefined;
    default: {
      const host = ` (or { "slot": "${slot.name}" } to leave it for the host)`;
      if (typeof value === 'string') return value.trim() ? undefined : no(host);
      if (isSlot(value)) return Object.keys(value).length === 1 && SLOT_NAME.test(value.slot) ? undefined : `Slot "${slot.name}" left for the host is { "slot": name }, the name letters, digits, "-" and "_", starting with a letter.`;
      const kind = subjectKind(value);
      if (!kind) return no(host);
      const ok = kind === slot.type || (slot.type === 'image' && kind === 'svg');
      const field = (value as Record<string, unknown>)[kind];
      if (!ok) return `Slot "${slot.name}" takes { "${slot.type}": … }${slot.type === 'image' ? ' or { "svg": … }' : ''}, not { "${kind}": … }.`;
      return typeof field === 'string' && field.trim() ? undefined : `Slot "${slot.name}"'s "${kind}" is a non-empty string.`;
    }
  }
}

/** A subject slot's value as the layer's subject. */
function subjectOf(slot: SubjectTemplateSlot, value: TemplateValue): SceneSubject | SubjectSlot {
  if (typeof value !== 'string') return value as SceneSubject | SubjectSlot;
  if (value.trimStart().startsWith('<svg') || slot.type === 'svg') return { svg: value };
  return slot.type === 'video' ? { video: value } : { image: value };
}

const objectLike = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Walks a template scene, calling `text` on each string and `subject` on
 * each layer subject that is a slot; what they return replaces the value.
 */
function walk(value: unknown, text: (s: string) => unknown, subject: (s: SubjectSlot) => unknown, key?: string): unknown {
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, text, subject));
  if (!objectLike(value)) return value;
  if (key === 'subject' && isSlot(value)) return subject(value);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = walk(v, text, subject, k);
  return out;
}

/** Every `{{name}}` in a template's scene, and every layer slot. */
function templateUses(template: SceneTemplate): { placeholders: Set<string>; subjects: Set<string> } {
  const placeholders = new Set<string>();
  const subjects = new Set<string>();
  walk(
    template.scene,
    (s) => {
      for (const m of s.matchAll(PLACEHOLDER)) placeholders.add(m[1]!);
      return s;
    },
    (s) => {
      subjects.add(s.slot);
      return s;
    },
  );
  return { placeholders, subjects };
}

const slotList = (template: SceneTemplate): string =>
  template.slots.length ? `"${template.id}" has ${template.slots.map((s) => `${s.name} (${s.type})`).join(', ')}` : `"${template.id}" has no slots`;

/**
 * Fills a template with values and returns the scene, with `validateScene`'s
 * issues. Values for unknown slots, of the wrong type or out of range are
 * refused, all at once, with what each slot takes; the template is never
 * changed. Slots left out take their defaults; a subject slot with no value
 * and no default (or given `{ "slot": name }`) stays a slot for the host.
 */
export function instantiateTemplate(template: SceneTemplate, values: TemplateValues = {}, options: { name?: string } = {}): TemplateResult {
  const errors: string[] = [];
  if (!objectLike(values)) return { ok: false, errors: [`Values are an object of slot names to values; ${slotList(template)}.`] };
  const slots = new Map(template.slots.map((s) => [s.name, s]));
  for (const [name, value] of Object.entries(values)) {
    const slot = slots.get(name);
    if (!slot) errors.push(`There is no slot "${name}"; ${slotList(template)}.`);
    else if (value !== undefined) {
      const problem = valueProblem(slot, value);
      if (problem) errors.push(problem);
    }
  }
  if (options.name !== undefined && (typeof options.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.name)))
    errors.push(`The scene name is lowercase words and dashes (like "${template.id}"), not ${typeName(options.name)}.`);
  if (errors.length) return { ok: false, errors };

  const filled = (slot: TemplateSlot): TemplateValue | undefined => values[slot.name] ?? slot.default;
  const asText = (name: string, whole: string): string => {
    const slot = slots.get(name);
    if (!slot || isSubjectSlotType(slot.type)) return whole;
    return String(filled(slot));
  };
  const openSlots = new Set<string>();
  const scene = walk(
    template.scene,
    (s) => {
      const whole = WHOLE_PLACEHOLDER.exec(s);
      const slot = whole ? slots.get(whole[1]!) : undefined;
      if (slot && !isSubjectSlotType(slot.type)) return filled(slot);
      return s.replace(PLACEHOLDER, (m, name: string) => asText(name, m));
    },
    (s) => {
      const slot = slots.get(s.slot);
      const value = slot && isSubjectSlotType(slot.type) ? filled(slot) : undefined;
      const subject = slot && value !== undefined ? subjectOf(slot as SubjectTemplateSlot, value) : s;
      if (isSlot(subject)) openSlots.add(subject.slot);
      return subject;
    },
  ) as Scene;
  if (options.name) scene.name = options.name;
  return { ok: true, scene, issues: validateScene(scene), openSlots: [...openSlots] };
}

/**
 * What is wrong with a template itself, as sentences: its id and slots,
 * each slot's default, placeholders and layer slots it does not declare,
 * slots it declares but never uses, and the issues its scene has with the
 * defaults filled in. Empty when it is sound.
 */
export function checkTemplate(template: SceneTemplate): string[] {
  const problems: string[] = [];
  if (!objectLike(template)) return ['A template is an object with id, name, description, slots and scene.'];
  if (typeof template.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.id)) problems.push(`Template id ${typeName(template.id)} should be lowercase words and dashes.`);
  for (const field of ['name', 'description'] as const) if (typeof template[field] !== 'string' || !template[field]) problems.push(`Template "${template.id}" needs a "${field}".`);
  if (!Array.isArray(template.slots)) return [...problems, `Template "${template.id}" needs a "slots" list (it may be empty).`];
  if (!objectLike(template.scene) || !Array.isArray(template.scene.shots)) return [...problems, `Template "${template.id}" needs a "scene" with shots.`];

  const seen = new Set<string>();
  for (const slot of template.slots) {
    const named = `Slot ${JSON.stringify(slot?.name)}`;
    if (!objectLike(slot) || typeof slot.name !== 'string' || !SLOT_NAME.test(slot.name)) {
      problems.push(`${named} needs a name of letters, digits, "-" and "_", starting with a letter.`);
      continue;
    }
    if (seen.has(slot.name)) problems.push(`${named} is declared twice.`);
    seen.add(slot.name);
    if (!TEMPLATE_SLOT_TYPES.includes(slot.type)) {
      problems.push(`${named} has the type ${typeName(slot.type)}; types are ${TEMPLATE_SLOT_TYPES.join(', ')}.`);
      continue;
    }
    if (typeof slot.label !== 'string' || !slot.label) problems.push(`${named} needs a "label".`);
    if (slot.type === 'number' && slot.min !== undefined && slot.max !== undefined && slot.min > slot.max) problems.push(`${named} has a "min" above its "max".`);
    if (slot.default === undefined && !isSubjectSlotType(slot.type)) problems.push(`${named} needs a "default".`);
    else if (slot.default !== undefined) {
      const problem = valueProblem(slot, slot.default);
      if (problem) problems.push(`${named}'s default does not fit: ${problem}`);
    }
  }

  const { placeholders, subjects } = templateUses(template);
  const declared = new Map(template.slots.filter(objectLike).map((s) => [s.name, s]));
  for (const name of placeholders) {
    const slot = declared.get(name);
    if (!slot) problems.push(`The scene uses {{${name}}}, which is not a declared slot; declare it in "slots".`);
    else if (isSubjectSlotType(slot.type)) problems.push(`The scene uses {{${name}}}, but "${name}" is a subject slot: use it as a layer's "subject": { "slot": "${name}" }.`);
  }
  for (const name of subjects) {
    const slot = declared.get(name);
    if (!slot) problems.push(`A layer's subject is { "slot": "${name}" }, which is not a declared slot; declare it in "slots" with type image, video or svg.`);
    else if (!isSubjectSlotType(slot.type)) problems.push(`A layer's subject is { "slot": "${name}" }, but "${name}" is a ${slot.type} slot; a subject slot is image, video or svg (for words, write { "text": "{{${name}}}" }).`);
  }
  for (const name of declared.keys()) if (!placeholders.has(name) && !subjects.has(name)) problems.push(`Slot "${name}" is declared but the scene never uses it.`);

  if (!problems.length) {
    const result = instantiateTemplate(template);
    if (!result.ok) problems.push(...result.errors);
    else for (const issue of result.issues) problems.push(`With its defaults, ${issue.shot ? `shot ${issue.shot}` : 'the scene'}: ${issue.message}`);
  }
  return problems;
}

/** A template's slots as a tool or form lists them: no subject defaults (they can be large), just whether there is one. */
export function describeTemplateSlots(template: SceneTemplate): Record<string, unknown>[] {
  return template.slots.map((slot) => {
    const { default: fallback, ...rest } = slot;
    return isSubjectSlotType(slot.type) ? { ...rest, hasDefault: fallback !== undefined } : { ...rest, default: fallback };
  });
}
