/**
 * Animated text templates: a scene's words as editable Bodymovin/Lottie
 * text layers, with the metadata a video editor's template pipeline needs
 * to import, re-bind and edit them (fonts, boxes, slots, word timings).
 */

import type { Scene } from '../scene/types.js';
import type { Rect } from '../scene/geometry.js';
import { boardHeight } from '../scene/camera.js';
import { sceneStage } from '../scene/cameratrack.js';
import { isSlot, subjectKind, type SceneLayer } from '../scene/layers.js';
import { layerOpacityAt, sceneTimeline, type TimedLayer } from '../scene/timeline.js';
import type { ControlValue } from '../shader/controls.js';
import { textWidthEm } from '../catalog/images.js';
import { exportLottie, type LottieAnimatable, type LottieAnimation, type LottieLayer } from './lottie.js';
import { layerBoard, sceneExportNotes } from './notes.js';

export interface TextTemplateOptions {
  /** Target framerate in fps. Default: 30 */
  frameRate?: number;
}

/** What the template's `format` field says, so a pipeline can tell it from a plain Lottie file. */
export const TEXT_TEMPLATE_FORMAT = 'flair-text-template';
export const TEXT_TEMPLATE_VERSION = 1;

/** A typeface the template's text uses: `name` is what the Lottie text layers call it. */
export interface TextTemplateFont {
  name: string;
  /** A CSS font-family list, first choice first. */
  family: string;
  weight: number;
}

/** A stretch of a text's words and when it shows, in ms on the scene's timeline. */
export interface TextTemplateSegment {
  text: string;
  startMs: number;
  endMs: number;
}

/** One piece of text in the template, and the Lottie text layer that draws it. */
export interface TextTemplateText {
  /** `shot<N>.title`, `shot<N>.caption`, `element.<id>`, or a layer's key and its text control (`intro.text`). */
  id: string;
  /** Where the words come from in the scene. */
  source: 'title' | 'caption' | 'element' | 'layer';
  /** The Lottie text layer's `ind` in `animation.layers`. */
  layer: number;
  /** Its text document's `sid` in the animation: the Lottie slot (in `animation.slots`) that re-binds it. */
  slot: string;
  /** The field it shows (see `TextTemplate.fields`). */
  field: string;
  text: string;
  /** For layers: the catalog effect it stands in for, when it has one. */
  effect?: string;
  font: {
    /** The `name` of one of `TextTemplate.fonts`. */
    name: string;
    family: string;
    weight: number;
    /** In px. For effect layers, fitted to the layer's box (the effect fits its words its own way). */
    size: number;
    /** Letter spacing, in thousandths of an em (Lottie's `tr`). */
    tracking: number;
    /** In px. */
    lineHeight: number;
  };
  /** `#rrggbb`. */
  fill: string;
  align: 'left' | 'center' | 'right';
  /** About where the words sit when they first show, in stage px (on the board when `onBoard`, moving with the camera). */
  box: Rect;
  onBoard: boolean;
  inMs: number;
  outMs: number;
  /** In and out frames, as the Lottie layer's `ip` and `op`. */
  ip: number;
  op: number;
  /**
   * When its words show: one segment for the whole text, or one a word when
   * it builds a word (or letter) at a time, each showing until `outMs`. The
   * Lottie layer reveals them in turn with a word range selector.
   */
  segments: TextTemplateSegment[];
}

/** A field a template user fills: the texts that show it (several when a scene slot shows in several layers), and what they show until it is filled. */
export interface TextTemplateField {
  id: string;
  label: string;
  default: string;
  /** The ids of the `texts` it fills. */
  texts: string[];
  /** The scene's slot (`{ "slot": name }`) it comes from, when it is one. */
  sceneSlot?: string;
}

/** An animated text template: a Lottie animation with editable text layers, and their metadata. */
export interface TextTemplate {
  format: typeof TEXT_TEMPLATE_FORMAT;
  version: typeof TEXT_TEMPLATE_VERSION;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  durationMs: number;
  /** The scene as Lottie (see `exportLottie`), with a text layer for each of `texts` and Lottie `slots` for their documents. */
  animation: LottieAnimation & { fonts: { list: LottieFont[] }; slots?: Record<string, { p: LottieTextData }> };
  fonts: TextTemplateFont[];
  texts: TextTemplateText[];
  fields: TextTemplateField[];
  /** What the template leaves out of the scene, or carries only in part (see `sceneExportNotes`). */
  notes: string[];
}

interface LottieFont {
  fName: string;
  fFamily: string;
  fStyle: string;
  fWeight: string;
  ascent: number;
}

/** A Lottie text document (the `s` of a text layer's `t.d` keyframe). */
interface LottieTextDocument {
  s: number;
  f: string;
  t: string;
  j: 0 | 1 | 2;
  tr: number;
  lh: number;
  ls: number;
  fc: [number, number, number];
}

interface LottieTextData {
  k: { s: LottieTextDocument; t: number }[];
  sid?: string;
}

/** How the compositor draws a shot's title and caption (see `drawWords` in `src/embed/compositor.ts`). */
const TITLE = { family: 'system-ui, sans-serif', weight: 600, size: 30, fill: '#ffffff' };
const CAPTION = { family: 'system-ui, sans-serif', weight: 400, size: 28, fill: '#f1f5f9' };
/** How it draws an element's text. */
const ELEMENT = { family: 'sans-serif', weight: 400, fill: '#ffffff' };
/** How `textImage` draws a text subject. */
const SUBJECT = { family: "'Arial Black', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif", weight: 900, fill: '#ffffff' };

/** Above the middle of a line to its baseline, in ems: about half the cap height. */
const MID_TO_BASE = 0.35;
/** From the top of a line to its baseline, in ems. */
const ASCENT = 0.8;
const LINE_HEIGHT = 1.2;

/** Effect controls that pace words in turn, by label: ms per word or per letter. */
const PACE_LABELS: Record<string, 'word' | 'letter'> = {
  'ms per word': 'word',
  'ms between words': 'word',
  'ms per letter': 'letter',
  'ms between letters': 'letter',
};

/** Colour controls that colour an effect's words, by name or label, in order of preference. */
const INK = /^(ink|color|colour|text|textcolor|base|fill)$/i;

const r2 = (n: number) => Math.round(n * 100) / 100;
const hexOf = (rgb: readonly number[]) => `#${rgb.slice(0, 3).map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => r2(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];

/** About how wide `text` is in ems at `weight`: `textWidthEm` is for a bold face, so black faces run wider and regular ones narrower. */
const widthEm = (text: string, weight: number) => textWidthEm(text) * (weight >= 800 ? 1.25 : weight <= 500 ? 0.92 : 1);

function styleOf(weight: number): string {
  if (weight >= 900) return 'Black';
  if (weight >= 800) return 'ExtraBold';
  if (weight >= 700) return 'Bold';
  if (weight >= 600) return 'SemiBold';
  if (weight >= 500) return 'Medium';
  if (weight <= 300) return 'Light';
  return 'Regular';
}

/** Words and when each starts showing, from a pace control: a word every `every` ms, or a letter every `every` ms. */
function pacedSegments(text: string, startMs: number, endMs: number, pace?: { by: 'word' | 'letter'; every: number }): TextTemplateSegment[] {
  const words = [...text.matchAll(/\S+/g)];
  if (!pace || words.length < 2) return [{ text, startMs, endMs }];
  return words.map((w, i) => {
    const at = pace.by === 'word' ? i : Array.from(text.slice(0, w.index)).length;
    return { text: w[0], startMs: Math.min(endMs, Math.round(startMs + at * pace.every)), endMs };
  });
}

/** What a text layer is made from, before it is numbered and placed in the animation. */
interface Draft extends Omit<TextTemplateText, 'layer' | 'slot' | 'field' | 'ip' | 'op' | 'font'> {
  font: Omit<TextTemplateText['font'], 'name'>;
  /** Where the Lottie layer's origin sits: the baseline's start (left), middle or end (right). */
  origin: [number, number];
  /** The Lottie layer it hangs off: an element's shape layer, by element id. */
  element?: string;
  /** The scene layer it comes from, by key. */
  layerKey?: string;
  /** The layer's opacity, 0 to 100, at `inMs` and through its fades. */
  opacity: LottieAnimatable<number, [number]>;
  slotOf?: { id: string; label: string; sceneSlot?: string; default: string };
}

/** The shot titles and captions, one text a run of shots showing the same words (as the player carries them over). */
function wordDrafts(timeline: ReturnType<typeof sceneTimeline>, stage: ReturnType<typeof sceneStage>): Draft[] {
  const drafts: Draft[] = [];
  for (const which of ['title', 'caption'] as const) {
    const style = which === 'title' ? TITLE : CAPTION;
    let open: Draft | undefined;
    timeline.shots.forEach((entry, i) => {
      const words = entry.shot[which];
      if (words === undefined) return;
      if (open) open.outMs = open.segments[0]!.endMs = entry.startMs;
      open = undefined;
      if (!words) return;
      const width = widthEm(words, style.weight) * style.size;
      const band = stage.caption ?? 0;
      const middle = which === 'title' ? 24 + 30 : band > 0 ? boardHeight(stage) + band / 2 : stage.height - 64 - 26;
      const baseline = middle + MID_TO_BASE * style.size;
      open = {
        id: `shot${i + 1}.${which}`,
        source: which,
        text: words,
        font: { family: style.family, weight: style.weight, size: style.size, tracking: 0, lineHeight: style.size * LINE_HEIGHT },
        fill: style.fill,
        align: 'center',
        box: { x: r2(stage.width / 2 - width / 2), y: r2(baseline - ASCENT * style.size), width: r2(width), height: r2(style.size * LINE_HEIGHT) },
        onBoard: false,
        inMs: entry.startMs,
        outMs: timeline.durationMs,
        segments: [{ text: words, startMs: entry.startMs, endMs: timeline.durationMs }],
        origin: [stage.width / 2, r2(baseline)],
        opacity: { a: 0, k: 100 },
      };
      drafts.push(open);
    });
  }
  return drafts;
}

/** Elements with text, as the shot that first drew them had them, hanging off their shape layers. */
function elementDrafts(timeline: ReturnType<typeof sceneTimeline>): Draft[] {
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  for (const entry of timeline.shots) {
    for (const el of entry.elements) {
      if (seen.has(el.id)) continue;
      seen.add(el.id);
      if (typeof el.text !== 'string' || !el.text) continue;
      const size = el.fontSize ?? 24;
      const baseline = Math.min(el.height - 8, 16 + size);
      drafts.push({
        id: `element.${el.id}`,
        source: 'element',
        text: el.text,
        font: { family: ELEMENT.family, weight: ELEMENT.weight, size, tracking: 0, lineHeight: size * LINE_HEIGHT },
        fill: ELEMENT.fill,
        align: 'left',
        box: { x: el.x + 16, y: r2(el.y + baseline - ASCENT * size), width: r2(widthEm(el.text, ELEMENT.weight) * size), height: r2(size * LINE_HEIGHT) },
        onBoard: true,
        inMs: entry.startMs,
        outMs: timeline.durationMs,
        segments: [{ text: el.text, startMs: entry.startMs, endMs: timeline.durationMs }],
        // Relative to the shape layer, whose origin is the element's middle.
        origin: [16 - el.width / 2, baseline - el.height / 2],
        element: el.id,
        opacity: { a: 0, k: 100 },
      });
    }
  }
  return drafts;
}

type Lazy = typeof import('../catalog/lazy.js');

/** A layer's opacity over its span, as the exporters draw pictures: its fades as keyframes. */
function layerOpacity(t: TimedLayer, frameOf: (ms: number) => number): LottieAnimatable<number, [number]> {
  const fade = t.layer.fade ?? 0;
  const at = (ms: number) => Math.round(layerOpacityAt(t, Math.min(Math.max(ms, t.startMs), t.endMs - 0.001)) * 100);
  return fade > 0
    ? { a: 1, k: [t.startMs, t.startMs + fade, t.endMs - fade, t.endMs - 0.001].map((ms) => ({ t: frameOf(ms), s: [at(ms)] })) }
    : { a: 0, k: at(t.startMs) };
}

/**
 * Layers with words: a text subject, a slot or a value filling a vector
 * effect's text, or the text controls a vector effect shows by default.
 * Each text control gets a text, stacked down the layer's box. Top of the
 * stack first, as Lottie draws its first layer on top.
 */
async function layerDrafts(timeline: ReturnType<typeof sceneTimeline>, stage: ReturnType<typeof sceneStage>, frameOf: (ms: number) => number): Promise<Draft[]> {
  const stacked: Draft[][] = [];
  const effectIds = new Set(timeline.layers.map((t) => t.layer.effect).filter((id): id is string => typeof id === 'string'));
  const lazy: Lazy | undefined = effectIds.size ? await import('../catalog/lazy.js') : undefined;
  for (const t of timeline.layers) {
    const drafts: Draft[] = [];
    stacked.push(drafts);
    const layer: SceneLayer = t.layer;
    const box = layerBoard(t, timeline);
    const area: Rect = box ?? { x: 0, y: 0, width: stage.width, height: boardHeight(stage) };
    const subject = layer.subject;
    const words = subjectKind(subject) === 'text' ? (subject as { text: string; font?: string; weight?: number | string }) : undefined;
    const meta = typeof layer.effect === 'string' ? lazy?.getEffectMeta(layer.effect) : undefined;
    const base = { source: 'layer' as const, layerKey: t.key, onBoard: !!box, inMs: t.startMs, outMs: t.endMs, opacity: layerOpacity(t, frameOf) };

    if (meta?.kind === 'vector') {
      const copies = meta.inputs.texts.filter((x) => x.holds === 'copy');
      if (!copies.length) continue;
      const preset = typeof layer.preset === 'string' ? (await lazy!.loadEffect(meta.id)).presets?.find((p) => p.name === layer.preset)?.values : undefined;
      const value = (name: string): ControlValue | undefined => layer.values?.[name] ?? preset?.[name] ?? meta.controls.find((c) => c.name === name)?.default;
      const fontInput = meta.inputs.texts.find((x) => x.holds === 'font');
      const family = String((fontInput && value(fontInput.name)) || SUBJECT.family);
      const weight = Number(value('weight')) || 400;
      const ink = meta.controls.find((c) => c.color && (INK.test(c.name) || /text|ink/i.test(c.label)));
      const inkValue = ink ? value(ink.name) : undefined;
      const fill = Array.isArray(inkValue) ? hexOf(inkValue as number[]) : '#ffffff';
      const paceControl = meta.controls.find((c) => PACE_LABELS[c.label.toLowerCase()]);
      const pace = paceControl ? { by: PACE_LABELS[paceControl.label.toLowerCase()]!, every: Number(value(paceControl.name)) } : undefined;
      const band = area.height / copies.length;
      copies.forEach((copy, i) => {
        // A text subject or a slot fills the effect's first text, as the player does.
        const slot = i === 0 && isSlot(subject) ? subject.slot : undefined;
        const text = i === 0 && words ? words.text : String(value(copy.name) ?? copy.default);
        if (!text.trim()) return;
        const size = r2(Math.min(area.height * 0.3, band * 0.6, (area.width * 0.9) / Math.max(0.6, widthEm(text, weight))));
        const width = widthEm(text, weight) * size;
        const baseline = area.y + band * i + band / 2 + MID_TO_BASE * size;
        drafts.push({
          ...base,
          id: `${t.key}.${copy.name}`,
          text,
          effect: meta.id,
          font: { family, weight, size, tracking: 0, lineHeight: r2(size * LINE_HEIGHT) },
          fill,
          align: 'center',
          box: { x: r2(area.x + area.width / 2 - width / 2), y: r2(baseline - ASCENT * size), width: r2(width), height: r2(size * LINE_HEIGHT) },
          segments: pacedSegments(text, t.startMs, t.endMs, i === 0 && pace && pace.every > 0 ? pace : undefined),
          origin: [area.x + area.width / 2, r2(baseline)],
          ...(slot ? { slotOf: { id: slot, label: copy.label, sceneSlot: slot, default: text } } : { slotOf: { id: `${t.key}.${copy.name}`, label: copy.label, default: text } }),
        });
      });
    } else if (words && (layer.effect === undefined || meta?.kind === 'shader')) {
      // Words drawn as a picture (`textImage`), fitted to the layer's box.
      const weight = Number(words.weight ?? SUBJECT.weight) || SUBJECT.weight;
      const size = r2(Math.min(area.height * 0.78, (area.width * 0.9) / Math.max(0.5, widthEm(words.text, weight))));
      const width = widthEm(words.text, weight) * size;
      const baseline = area.y + area.height / 2 + MID_TO_BASE * size;
      drafts.push({
        ...base,
        id: `${t.key}.text`,
        text: words.text,
        ...(meta ? { effect: meta.id } : {}),
        font: { family: words.font ?? SUBJECT.family, weight, size, tracking: 0, lineHeight: r2(size * LINE_HEIGHT) },
        fill: SUBJECT.fill,
        align: 'center',
        box: { x: r2(area.x + area.width / 2 - width / 2), y: r2(baseline - ASCENT * size), width: r2(width), height: r2(size * LINE_HEIGHT) },
        segments: [{ text: words.text, startMs: t.startMs, endMs: t.endMs }],
        origin: [area.x + area.width / 2, r2(baseline)],
      });
    }
  }
  return stacked.reverse().flat();
}

/** A word range selector that hides the words not yet shown, stepping on as each segment starts. */
function wordReveal(segments: readonly TextTemplateSegment[], frameOf: (ms: number) => number) {
  const n = segments.length;
  return {
    nm: 'Words',
    s: {
      t: 0,
      xe: { a: 0, k: 0 },
      ne: { a: 0, k: 0 },
      a: { a: 0, k: 100 },
      b: 3, // based on words
      rn: 0,
      sh: 1, // square
      s: { a: 1, k: segments.map((seg, i) => ({ t: frameOf(seg.startMs), s: [r2(((i + 1) / n) * 100)], h: 1 })) },
      e: { a: 0, k: 100 },
      o: { a: 0, k: 0 },
      r: 1, // percent
    },
    a: { o: { a: 0, k: 0 } },
  };
}

/**
 * Exports a scene as an animated text template: the scene as Lottie (see
 * `exportLottie`) with an editable Lottie text layer (`ty: 5`) for each
 * piece of words it shows, and alongside it the metadata an editor's
 * template pipeline re-binds and edits them with.
 *
 * - **Texts**: the shots' titles and captions (styled as the player draws
 *   them), elements' text (following their shape layers), and layers with
 *   words: a text subject, or the text controls of a vector effect (the
 *   kinetic typography and caption effects), filled from a slot, the
 *   layer's values, its preset or the effect's defaults.
 * - **Fonts**: each family and weight, in the animation's `fonts.list`.
 * - **Boxes**: about where each text sits, in stage px, from its font size
 *   and a width estimate (no font is measured). Effect layers' words are
 *   fitted to the layer's box, stacked when an effect has several.
 * - **Slots and fields**: each text's document has a `sid` naming its
 *   Lottie slot (in the animation's `slots`), and `fields` groups texts
 *   under what a template user fills: a scene slot (`{ "slot": name }`)
 *   keeps its name, and is one field however many layers show it.
 * - **Timing**: in and out frames on the scene's timeline, and segments: a
 *   word at a time for effects paced by "Ms per word" or "Ms per letter"
 *   controls (revealed by a word range selector; the effect's own lead-in
 *   and easing are not carried), else the whole text.
 *
 * Loads the catalog's metadata when the scene has effect layers, so it is async.
 */
export async function exportTextTemplate(scene: Scene, options: TextTemplateOptions = {}): Promise<TextTemplate> {
  const fr = options.frameRate ?? 30;
  const base = exportLottie(scene, { frameRate: fr });
  const stage = sceneStage(scene);
  const timeline = sceneTimeline(scene);
  const frameOf = (ms: number) => Math.round((ms / 1000) * fr);

  const drafts = [...wordDrafts(timeline, stage), ...(await layerDrafts(timeline, stage, frameOf)), ...elementDrafts(timeline)];

  const fonts: TextTemplateFont[] = [];
  const fontFor = (family: string, weight: number): string => {
    const found = fonts.find((f) => f.family === family && f.weight === weight);
    if (found) return found.name;
    const first = family.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '').replace(/[^A-Za-z0-9]+/g, '') || 'Font';
    const name = `${first}-${styleOf(weight)}${fonts.some((f) => f.name.startsWith(`${first}-${styleOf(weight)}`)) ? `-${fonts.length}` : ''}`;
    fonts.push({ name, family, weight });
    return name;
  };

  const rig = base.layers.find((l) => l.ty === 3 && l.nm === 'Camera')?.ind;
  const shapeOf = new Map(base.layers.filter((l) => l.ty === 4).map((l) => [l.nm, l]));
  let ind = Math.max(0, ...base.layers.map((l) => l.ind)) + 1;
  const texts: TextTemplateText[] = [];
  const textLayers: LottieLayer[] = [];
  const lottieSlots: Record<string, { p: LottieTextData }> = {};
  const fields: TextTemplateField[] = [];
  const usedSids = new Set<string>();

  for (const d of drafts) {
    const name = fontFor(d.font.family, d.font.weight);
    const parent = d.element ? shapeOf.get(d.element) : undefined;
    const ip = parent ? parent.ip : frameOf(d.inMs);
    const op = Math.max(ip + 1, parent ? parent.op : frameOf(d.outMs));
    let sid = d.id;
    for (let k = 2; usedSids.has(sid); k++) sid = `${d.id}.${k}`;
    usedSids.add(sid);
    const doc: LottieTextDocument = {
      s: d.font.size,
      f: name,
      t: d.text,
      j: d.align === 'left' ? 0 : d.align === 'right' ? 1 : 2,
      tr: d.font.tracking,
      lh: d.font.lineHeight,
      ls: 0,
      fc: rgbOf(d.fill),
    };
    const data: LottieTextData = { k: [{ s: doc, t: 0 }], sid };
    lottieSlots[sid] = { p: { k: [{ s: doc, t: 0 }] } };
    // Board text hangs off the camera rig, an element's text off its shape layer; screen text off neither.
    const parentInd = parent?.ind ?? (d.onBoard ? rig : undefined);
    textLayers.push({
      ddd: 0,
      ind,
      ...(parentInd !== undefined ? { parent: parentInd } : {}),
      ty: 5,
      nm: d.id,
      sr: 1,
      ks: { p: { a: 0, k: [d.origin[0], d.origin[1], 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: d.opacity },
      ao: 0,
      ip,
      op,
      st: 0,
      bm: 0,
      t: { d: data, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: d.segments.length > 1 ? [wordReveal(d.segments, frameOf)] : [] },
    });
    const { origin: _o, element: _e, layerKey: _k, opacity: _p, slotOf, ...meta } = d;
    const fieldId = slotOf?.sceneSlot ?? sid;
    texts.push({ ...meta, layer: ind, slot: sid, field: fieldId, font: { name, ...d.font }, ip, op });
    const shared = fields.find((f) => f.id === fieldId);
    if (shared) shared.texts.push(d.id);
    else
      fields.push({
        id: fieldId,
        label: slotOf?.label ?? (d.source === 'title' ? 'Title' : d.source === 'caption' ? 'Caption' : 'Text'),
        default: slotOf?.default ?? d.text,
        texts: [d.id],
        ...(slotOf?.sceneSlot ? { sceneSlot: slotOf.sceneSlot } : {}),
      });
    ind++;
  }

  // Text over everything but the camera (Lottie draws its first layer on top).
  const cameraCount = base.layers.filter((l) => l.ty === 13 || (l.ty === 3 && l.nm === 'Camera')).length;
  const layers = [...base.layers.slice(0, cameraCount), ...textLayers, ...base.layers.slice(cameraCount)];
  const notes = sceneExportNotes(scene, 'text-template', new Set(drafts.map((d) => d.layerKey).filter((k): k is string => !!k)));

  return {
    format: TEXT_TEMPLATE_FORMAT,
    version: TEXT_TEMPLATE_VERSION,
    name: base.nm,
    width: base.w,
    height: base.h,
    frameRate: fr,
    durationMs: timeline.durationMs,
    animation: {
      ...base,
      // Text documents' `sid` and the `slots` they name came to Lottie in 5.12.
      v: '5.12.1',
      layers,
      fonts: { list: fonts.map((f) => ({ fName: f.name, fFamily: f.family, fStyle: styleOf(f.weight), fWeight: String(f.weight), ascent: ASCENT * 100 })) },
      ...(Object.keys(lottieSlots).length ? { slots: lottieSlots } : {}),
      meta: { g: 'Flair', ...(notes.length ? { d: notes.join(' ') } : {}) },
    },
    fonts,
    texts,
    fields,
    notes,
  };
}
