import {
  checkControlValue,
  controlFromDeclaration,
  hexToRgb,
  rgbToHex,
  type ControlDef,
  type ControlType,
  type ControlValue,
} from "../shader/controls.js";
import type { Stage, View } from "../scene/camera.js";
import type { SvgMotion } from "../vector/motion.js";
import type { SvgTrigger } from "../vector/svg.js";

/** What an effect is for, used to group the catalog. */
export type EffectCategory =
  | "gradient"
  | "organic"
  | "pattern"
  | "light"
  | "lighting"
  | "space"
  | "retro"
  | "crt"
  | "image"
  | "cinematic"
  | "film"
  | "beauty"
  | "overlay"
  | "text"
  | "treatment"
  | "morph"
  | "interaction"
  | "pyrotechnics"
  | "timewarp"
  | "timing"
  | "melt"
  | "electric"
  | "fire"
  | "hologram"
  | "splatter"
  | "bubble"
  | "sticker"
  | "trail"
  | "path"
  | "particles"
  | "debris"
  | "impact"
  | "comic"
  | "anime"
  | "horror"
  | "emergency"
  | "meme"
  | "atmosphere"
  | "glow"
  | "shadow"
  | "relief"
  | "distortion"
  | "audio"
  | "scroll"
  | "broadcast"
  | "annotation"
  | "ui"
  | "3d"
  | "weather"
  | "water"
  | "transition"
  | "loader"
  | "data"
  | "icon"
  | "camera";

/** Every category, in the order the catalog lists them. */
export const EFFECT_CATEGORIES: readonly EffectCategory[] = [
  "gradient",
  "organic",
  "pattern",
  "light",
  "lighting",
  "space",
  "retro",
  "crt",
  "image",
  "cinematic",
  "film",
  "beauty",
  "overlay",
  "text",
  "treatment",
  "morph",
  "interaction",
  "pyrotechnics",
  "timewarp",
  "timing",
  "melt",
  "electric",
  "fire",
  "hologram",
  "splatter",
  "bubble",
  "sticker",
  "trail",
  "path",
  "particles",
  "debris",
  "impact",
  "comic",
  "anime",
  "horror",
  "emergency",
  "meme",
  "atmosphere",
  "glow",
  "shadow",
  "relief",
  "distortion",
  "audio",
  "scroll",
  "broadcast",
  "annotation",
  "ui",
  "3d",
  "weather",
  "water",
  "transition",
  "loader",
  "data",
  "icon",
  "camera",
];

/** A set of related categories, for browsing a catalog too long for one row of filters. */
export interface EffectCategoryGroup {
  name: string;
  categories: readonly EffectCategory[];
}

/** Every category in exactly one group, the groups in browsing order. */
export const EFFECT_CATEGORY_GROUPS: readonly EffectCategoryGroup[] = [
  { name: "Backgrounds", categories: ["gradient", "organic", "pattern", "relief", "space", "3d", "weather", "water", "atmosphere"] },
  { name: "Light", categories: ["light", "lighting", "glow", "shadow", "electric", "fire", "hologram"] },
  { name: "Pictures", categories: ["image", "cinematic", "film", "beauty", "distortion", "retro", "crt", "comic", "anime", "horror", "emergency", "meme", "timewarp", "timing", "melt"] },
  { name: "Particles & FX", categories: ["overlay", "splatter", "bubble", "particles", "trail", "debris", "impact", "pyrotechnics"] },
  { name: "Type & titles", categories: ["text", "treatment", "morph", "broadcast", "annotation", "sticker"] },
  { name: "Paths", categories: ["path"] },
  { name: "Inputs", categories: ["interaction", "audio", "scroll"] },
  { name: "Interface", categories: ["ui", "icon", "data"] },
  { name: "Loaders", categories: ["loader"] },
  { name: "Transitions", categories: ["transition"] },
  { name: "Camera", categories: ["camera"] },
];

/** The group a category is browsed under. */
export function categoryGroup(category: EffectCategory): EffectCategoryGroup {
  return EFFECT_CATEGORY_GROUPS.find((g) => g.categories.includes(category))!;
}

/**
 * How a shader effect suits video in its image controls (see
 * `ShaderRenderer.setLiveSource`):
 *
 * - `filter`: it treats each frame on its own, so it works as a live video filter.
 * - `transition`: it blends two pictures, so it works between two clips.
 * - `interactive`: it reacts to the pointer over a picture, and works as well over video.
 * - `stills`: it runs on video but is made for a still picture: it moves the
 *   picture to fake motion of its own, or needs shapes or features in fixed places.
 * - `none`: its pictures are not photos (rendered text, a silhouette mask), so video has no place in it.
 */
export type VideoUse = "filter" | "transition" | "interactive" | "stills" | "none";

/** Every {@link VideoUse}, best suited to video first. */
export const VIDEO_USES: readonly VideoUse[] = ["filter", "transition", "interactive", "stills", "none"];

/** Named control values: a look an effect can be switched to. */
export interface EffectPreset {
  name: string;
  values: Record<string, ControlValue>;
}

interface EffectBase {
  /** Stable id, kebab-case: `aurora`, `image-glitch`. */
  id: string;
  name: string;
  /** One sentence: what it looks like. */
  description: string;
  category: EffectCategory;
  tags: readonly string[];
  presets?: readonly EffectPreset[];
}

/**
 * A WebGL2 fragment shader (Shadertoy-style `mainImage`). Its controls are the
 * `// @control` uniforms in `source`; run it with `ShaderRenderer`,
 * `ShaderFrames`, `ThumbnailPool`, `recordGif` or `standaloneHtml`.
 */
export interface ShaderEffect extends EffectBase {
  kind: "shader";
  source: string;
  /** Seconds after which it repeats exactly, when it loops seamlessly. */
  loop?: number;
  /**
   * Seconds it takes to build up when it starts (a path drawing on, a
   * fade-in) before it settles, at its default values: previews replay it
   * from the start rather than show it settled.
   */
  build?: number;
  /**
   * Draws over other content: `fragColor.a` is coverage (0 where there is
   * nothing to draw), so render it on a transparent canvas
   * (`ShaderRenderer`'s `alpha` option) to layer it over a page or picture.
   */
  transparent?: boolean;
  /**
   * How it suits video in its image controls. Every effect with an image
   * control says; effects without one have nothing to show video in.
   */
  video?: VideoUse;
}

/**
 * A control of a vector effect, declared in a list rather than in the
 * picture (see {@link VectorEffect.controls}). The same shape as a shader's
 * controls (see `ControlDef`) less what only sources have; `vec3` colours
 * are written into the picture as `#rrggbb`.
 */
export type VectorControl = Pick<ControlDef, "name" | "type" | "default"> &
  Partial<Pick<ControlDef, "label" | "color" | "min" | "max" | "step">>;

/**
 * An animated SVG picture (see `SvgMotion`) whose controls are declared in
 * the picture itself, the way a shader's are declared in its source. The
 * first `{{name: type …}}` declares a control and every `{{name}}` is
 * replaced by its value (see {@link vectorControls} and
 * {@link renderVectorEffect}); run the result with `SvgPlayer`.
 */
export interface VectorEffect extends EffectBase {
  kind: "vector";
  motion: SvgMotion;
  /**
   * Controls declared outside the picture, for effects written before
   * controls were declared inline. A control declared in the picture wins
   * over one of the same name here.
   */
  controls?: readonly VectorControl[];
  /**
   * More placeholders worked out from the control values (a bar's height
   * from its value, say), filled in after the controls.
   */
  derived?: (values: Record<string, ControlValue>) => Record<string, string | number>;
  /** Ms to rest on the last frame before it loops (default 600). */
  hold?: number;
  /**
   * Plays in answer to the pointer rather than on a loop: pass it to
   * `SvgPlayer` (`{ trigger: effect.trigger }`). Click-triggered pictures
   * change on steps, each click playing the next.
   */
  trigger?: SvgTrigger;
}

/**
 * What a camera move is for: a `transition` takes the camera from the last
 * shot's framing to the next one's; a `hold` moves it within a framing while
 * the shot holds (a drift, a crash zoom).
 */
export type CameraRole = "transition" | "hold";

/** Where a camera move is: the framings it goes between and how far through it is. */
export interface CameraMoveContext {
  /** The framing the move leaves; for a hold, the framing it moves within (the same as `to`). */
  from: View;
  /** The framing the move arrives at. */
  to: View;
  /** How far through the move, 0 to 1. */
  u: number;
  /** Ms the whole move takes: its duration, the shot's override, or for a hold the shot's hold. */
  ms: number;
  stage: Stage;
}

/** How a camera move moves: its role, its length and the view at each point of it. */
export interface CameraMotion {
  role: CameraRole;
  /** Ms of the move at its default values (0 for a cut); a hold plays across the shot's hold instead. */
  duration: number;
  /**
   * Where the view jumps (0 to 1 through the move), for a move that cuts
   * part-way (a whip pan or punch zoom cuts halfway): timelines key the
   * frames either side, so straight-line interpolation never tweens across it.
   */
  cut?: number;
  /**
   * The camera `ctx.u` of the way through the move, with its motion blur
   * (`blur`, `blurAngle`) when it moves fast enough to blur. Pure: the same
   * context and values give the same view. Values are the move's controls,
   * filled in with their defaults.
   */
  view(ctx: CameraMoveContext, values: Readonly<Record<string, ControlValue>>): View;
}

/**
 * A camera move: how a scene's camera gets into a shot (a glide, a whip
 * pan, a punch zoom, a cut) or moves while it holds (a Ken Burns drift, a
 * crash zoom, a handheld shake). Its controls are declared in a list, as a
 * vector effect's may be. Scenes name it in a shot's `camera.in` or
 * `camera.during`; on its own, `mountEffect` and `recordEffect` preview it
 * on a picture.
 */
export interface CameraEffect extends EffectBase {
  kind: "camera";
  controls: readonly VectorControl[];
  motion: CameraMotion;
}

/** Where a retime is: how far into the retimed clip, and the footage it retimes. */
export interface TimingContext {
  /** Ms into the retimed clip, from 0 to the effect's `length` for this footage. */
  time: number;
  /** Ms of footage. */
  footage: number;
  /** The footage's frames per second: one frame lasts `1000 / fps` ms. */
  fps: number;
}

/** One frame of footage a retimed frame shows, and how much of it. */
export interface TimingFrame {
  /** Ms into the footage. */
  time: number;
  /** Its share of the picture, 0 or more (shares are scaled to add up to 1). */
  weight: number;
}

/**
 * How a retimed frame's footage frames combine: `average` mixes them by
 * weight (frame blending, a long exposure's silky water); `lighten` keeps
 * each pixel's brightest, each frame dimmed by its weight against the
 * heaviest (light trails, star trails).
 */
export type TimingBlend = "average" | "lighten";

/** The footage frames one retimed frame is made of. */
export interface TimingSample {
  frames: readonly TimingFrame[];
  /** Default `average`. */
  blend?: TimingBlend;
}

/** How a timing effect retimes footage: how long the result is and which footage makes each frame of it. */
export interface TimingMotion {
  /** Ms the retimed clip lasts for footage `footage` ms long. Values are the effect's controls, filled in with their defaults. */
  length(footage: number, values: Readonly<Record<string, ControlValue>>): number;
  /**
   * The footage frames retimed frame `ctx.time` shows: one frame for a speed
   * change, a reverse or a freeze; many, weighted, for frame blending, echoes
   * and long exposures. Pure: the same context and values give the same
   * sample, so any frame can be drawn on its own, in any order. Times
   * outside the footage are held at its ends (see `timingSample`).
   */
  sample(ctx: TimingContext, values: Readonly<Record<string, ControlValue>>): TimingSample;
}

/**
 * A retime of video footage: a speed change, a ramp, a reverse, a freeze,
 * frame blending or a long exposure. It draws nothing of its own: for each
 * frame of the result it names the footage frames to show and how to blend
 * them, so the host decodes the frames it needs. Its controls are declared in
 * a list, as a camera move's are. `timingSample` checks its values and
 * answers which frames; `TimingRenderer` draws them from `TimingFootage`;
 * `mountEffect` and `recordEffect` play it on a `<video>` subject (or on a
 * preview clip of their own).
 */
export interface TimingEffect extends EffectBase {
  kind: "timing";
  controls: readonly VectorControl[];
  motion: TimingMotion;
}

/** A stage of a text treatment: what an agent (or anyone) is doing to the range it draws over. */
export type TextTreatmentStage = "checking" | "selecting" | "typing" | "landed" | "caret";

/**
 * How a value eases between two keys: a CSS timing function's name, or a
 * cubic Bézier's control points `[x1, y1, x2, y2]` (x within 0 to 1).
 */
export type TreatmentEase = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | readonly [number, number, number, number];

/** A number, or a control's value written `"{{name}}"`. */
export type TreatmentNumber = number | string;

/**
 * A value that changes through a stage: keys of `[progress, value]`,
 * progress 0 to 1 in order, eased between each pair.
 */
export interface TreatmentTrack {
  keys: readonly (readonly [number, TreatmentNumber])[];
  /** Default `linear`. */
  ease?: TreatmentEase;
}

/** A fixed value or one that changes through the stage. */
export type TreatmentValue = TreatmentNumber | TreatmentTrack;

/**
 * A colour: `#rrggbb`, a colour control written `"{{name}}"`, `"text"` (the
 * host text's colour) or `"background"` (the colour behind the text; a
 * layer in it is left out when the host does not say).
 */
export type TreatmentColor = string;

/**
 * What a treatment layer draws:
 * - `fill`: a rectangle on each line of the range (a tint, a marker, an
 *   underline with `top` and `height`), revealed and erased from its leading
 *   edge, solid or with `stops` across the line, or an outline with `stroke`.
 * - `band`: a soft band crossing the range at `position` (a sweep, a shimmer, a scan).
 * - `caret`: an insertion point at the host's caret.
 * - `tag`: a name tag above the caret (the host's `label`).
 * - `cover`: the background colour over each line, hiding the text under it (the word being typed over).
 * - `ghost`: the text being typed (the host's `text`), in the host's font, over the first line.
 * - `handles`: small squares at the corners of the range, as a design tool's selection.
 * - `ribbon`: a tapering ribbon along a curve (`points`, from the caret, in caret
 *   heights), drawn on and wiped away along its length with `reveal` and `erase`,
 *   its colour changing along it (`colorStops`): a flourish, a swoosh, a curl.
 * - `sparkles`: `count` soft dots shed along the drawn part of a curve (`points`),
 *   scattered `spread` either side, drifting down and twinkling.
 */
export type TreatmentLayerType = "fill" | "band" | "caret" | "tag" | "cover" | "ghost" | "handles" | "ribbon" | "sparkles";

/** How a layer mixes with what is under it. */
export type TreatmentBlend = "normal" | "multiply" | "screen" | "plus-lighter";

/**
 * One layer of a treatment stage, as data a renderer draws with plain
 * rectangles, gradients and text (Core Animation layers, SVG). Numbers may
 * be controls (`"{{name}}"`); `opacity`, `reveal`, `erase` and `position`
 * may change through the stage.
 */
export interface TreatmentLayer {
  type: TreatmentLayerType;
  /** Under the text or over it. Default: `behind` for `fill` and `band`, `above` for the rest. */
  z?: "behind" | "above";
  /** A bool control written `"{{name}}"`: the layer is drawn only while it is on. */
  if?: string;
  /** A bool control written `"{{name}}"`: the layer is drawn only while it is off. */
  unless?: string;
  /** Default `"{{color}}"` (`"background"` for `cover`, `"text"` for `ghost`). */
  color?: TreatmentColor;
  /** The colour's opacity, 0 to 1 (default 1). */
  alpha?: TreatmentNumber;
  /** The layer's opacity through the stage, 0 to 1 (default 1). */
  opacity?: TreatmentValue;
  /** Px each line's rectangle grows by on the left and right (negative shrinks). */
  padX?: TreatmentNumber;
  /** Px each line's rectangle grows by at the top and bottom (negative shrinks). */
  padY?: TreatmentNumber;
  /** Where the layer starts down each line (or the caret), as a share of its height (default 0). */
  top?: TreatmentNumber;
  /** How much of each line's (or the caret's) height it covers (default 1). */
  height?: TreatmentNumber;
  /** Corner radius in px. */
  radius?: TreatmentNumber;
  /** `fill`: how far across the range it is drawn from the leading edge, 0 to 1 (default 1). */
  reveal?: TreatmentValue;
  /** `fill`: how far across the range it is wiped away from the leading edge, 0 to 1 (default 0). */
  erase?: TreatmentValue;
  /**
   * `fill`: opacities across each line, `[offset, alpha]` with offsets 0 to 1,
   * instead of a solid colour. `band`: across the band (default soft both
   * sides: `[[0, 0], [0.5, 1], [1, 0]]`).
   */
  stops?: readonly (readonly [number, TreatmentNumber])[];
  /** `band`: its width as a share of the range's (default 0.4); `caret`: px (default 2); `handles`: each square's side in px (default 6); `ribbon`: at its head, in caret heights (default 0.3). */
  width?: TreatmentNumber;
  /** `band`: px added to its width. */
  widthPx?: TreatmentNumber;
  /** `band`: where it is, from wholly before the range (0) to wholly past it (1). */
  position?: TreatmentValue;
  /** Px of soft glow round the layer, in its colour. */
  glow?: TreatmentNumber;
  /** `fill`: draws an outline this many px wide instead of filling. */
  stroke?: TreatmentNumber;
  blend?: TreatmentBlend;
  /** `tag`: the label's text size in px (default 11); `sparkles`: each dot's largest size, in caret heights (default 0.12). */
  size?: TreatmentNumber;
  /** `tag`: px between the caret's top and the tag (default 2). */
  gap?: TreatmentNumber;
  /** `tag`: the label's colour (default `#ffffff`). */
  textColor?: TreatmentColor;
  /**
   * `ribbon` and `sparkles`: the curve, as `[x, y]` points (y down; see `anchor`
   * for what they are measured from): a start point, then three points for each
   * cubic Bézier segment (two control points and its end).
   */
  points?: readonly (readonly [TreatmentNumber, TreatmentNumber])[];
  /**
   * `ribbon` and `sparkles`: what `points` are measured from. `caret` (default): the caret's top, in
   * caret heights. `range`: the last line of the range (where the change ends), x as a share of its
   * width and y of its height, so the curve covers only the text it is drawn over; widths, spreads
   * and drifts are then in its line heights.
   */
  anchor?: "caret" | "range";
  /**
   * `ribbon` and `sparkles`: stretches along the curve, `[from, to]` from 0 (its start) to 1 (its
   * end), drawn under the text; the rest is drawn at `z`. Alternate them where the curve crosses the
   * letters and it weaves through the words.
   */
  behind?: readonly (readonly [number, number])[];
  /** `ribbon`: its colours along its length, `[offset, colour]` or `[offset, colour, alpha]`, offsets 0 (tail) to 1 (head). Default the layer's colour throughout. */
  colorStops?: readonly (readonly [number, TreatmentColor] | readonly [number, TreatmentColor, TreatmentNumber])[];
  /** `ribbon`: its width at the tail as a share of its width at the head (`width`, in caret heights), default 0.1. */
  taper?: TreatmentNumber;
  /** `sparkles`: how many (default 12). */
  count?: TreatmentNumber;
  /** `sparkles`: how far either side of the curve they scatter, in caret heights (default 0.4). */
  spread?: TreatmentNumber;
  /** `sparkles`: how far they drift down through the stage, in caret heights (default 0.3). */
  drift?: TreatmentNumber;
  /** `sparkles`: picks a different scatter (default 0). */
  seed?: TreatmentNumber;
}

/**
 * How a stage moves without motion, for Reduce Motion: every value is held
 * where it is `at` (0 to 1 through the stage) and the stage fades instead.
 */
export interface TreatmentReduced {
  at?: number;
  fade?: "in" | "out" | "in-out" | "none";
  /** Ms the fade takes (default the stage's own length). */
  duration?: TreatmentNumber;
}

/**
 * One stage of a treatment: its timing and layers. With `flow: "sequence"`
 * (the default) the stage crosses the range's lines as one strip, in
 * `duration` plus `perPixel` ms for each px of it; with `flow: "each"` every
 * line plays it on its own, `stagger` ms after the line before, taking
 * `duration` plus `perPixel` for each px of that line.
 */
export interface TreatmentStage {
  duration: TreatmentNumber;
  perPixel?: TreatmentNumber;
  stagger?: TreatmentNumber;
  flow?: "each" | "sequence";
  /** Starts again at the end until stopped (a blinking caret). */
  loop?: boolean;
  /** Its version without motion (see {@link TreatmentReduced}); each stage has a default. */
  reduced?: TreatmentReduced;
  layers: readonly TreatmentLayer[];
}

/** Every stage of a treatment, described as data. */
export type TextTreatmentStages = Readonly<Record<TextTreatmentStage, TreatmentStage>>;

/**
 * A look for edits to a range of text: a sweep across a word being checked,
 * a selection appearing over what will be replaced, the word being typed
 * over it, a tint on what changed, and the insertion point with a name tag.
 * It draws in an overlay above or behind the host's text, from the host's
 * line rectangles, and never changes the text. Its stages are data (see
 * {@link TreatmentStage}), so the web (`mountTextTreatment` in `/embed`) and
 * Swift (`FlairTextTreatmentRenderer`) draw the same layer plan
 * (`textTreatmentPlan`). Its controls are declared in a list, and its
 * stages name them as `"{{name}}"`; `color` is the agent's colour.
 */
export interface TextTreatmentEffect extends EffectBase {
  kind: "text-treatment";
  controls: readonly VectorControl[];
  stages: TextTreatmentStages;
}

export type EffectDefinition = ShaderEffect | VectorEffect | CameraEffect | TimingEffect | TextTreatmentEffect;

/** The types a vector effect's `{{name: type …}}` placeholder can declare. */
export const VECTOR_CONTROL_TYPES = ["float", "int", "bool", "color", "text"] as const;

/**
 * A placeholder: `{{name}}`, or a declaration `{{name: type attributes}}`
 * whose attributes are a shader `@control`'s (`min`, `max`, `step`,
 * `default`, `label`). Quote values with spaces in single quotes inside an
 * SVG attribute: `fill="{{accent: color default=#6366F1 label='Accent'}}"`.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z_]\w*)\s*(?::\s*([A-Za-z0-9]*)([^}]*))?\}\}/g;

/** Every string in a motion, the markup first, then each animation's values in order. */
function motionStrings(motion: SvgMotion): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(motion);
  return out;
}

/**
 * The controls a vector effect's picture declares, in the order they are
 * first declared: `{{word: text default=SLOP label=Word}}`, `{{accent:
 * color default=#6366F1}}`, `{{width: float min=2 max=20 default=8 step=1}}`,
 * `{{shadow: bool default=true}}`. A name declared twice counts once (the
 * first wins), and declarations with an unknown type are left out (see
 * {@link vectorControlIssues}). A control only `derived` reads can be
 * declared in an XML comment: `<!-- {{drip: float default=1}} -->`.
 */
export function vectorControls(motion: SvgMotion): ControlDef[] {
  const controls: ControlDef[] = [];
  const seen = new Set<string>();
  for (const text of motionStrings(motion)) {
    for (const [, name, type, attributes] of text.matchAll(PLACEHOLDER)) {
      if (type === undefined || seen.has(name!) || !(VECTOR_CONTROL_TYPES as readonly string[]).includes(type)) continue;
      seen.add(name!);
      const colour = type === "color";
      controls.push(controlFromDeclaration(name!, colour ? "vec3" : (type as ControlType), `${attributes}${colour ? " color" : ""}`, controls.length + 1));
    }
  }
  return controls;
}

/** A vector effect's controls: those its picture declares, then any in its `controls` list it does not. */
export function vectorEffectControls(effect: Pick<VectorEffect, "motion" | "controls">): ControlDef[] {
  const declared = vectorControls(effect.motion);
  const names = new Set(declared.map((c) => c.name));
  const listed = (effect.controls ?? []).filter((c) => !names.has(c.name));
  return [...declared, ...listed.map((c, i) => vectorControlDef(c, declared.length + i + 1))];
}

/**
 * Problems with a picture's placeholders, as sentences: declarations of an
 * unknown type, and a name declared twice in different ways.
 */
export function vectorControlIssues(motion: SvgMotion): string[] {
  const issues: string[] = [];
  const declarations = new Map<string, string>();
  for (const text of motionStrings(motion)) {
    for (const [whole, name, type] of text.matchAll(PLACEHOLDER)) {
      if (type === undefined) continue;
      if (!(VECTOR_CONTROL_TYPES as readonly string[]).includes(type))
        issues.push(`${whole}: a control's type is one of ${VECTOR_CONTROL_TYPES.join(", ")}`);
      else if (declarations.has(name!) && declarations.get(name!) !== whole)
        issues.push(`"${name}" is declared twice; declare it once and write {{${name}}} everywhere else`);
      else declarations.set(name!, whole);
    }
  }
  return issues;
}

/** A vector control's value written into the picture: colours as hex, vectors space-separated, the rest as they are. */
function written(control: Pick<ControlDef, "color">, value: ControlValue): string | number | boolean {
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value.join(" ");
  return value;
}

const escapeMarkup = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A vector control as a full `ControlDef`, so editors treat both kinds of effect alike. */
export function vectorControlDef(control: VectorControl, line = 0): ControlDef {
  const min = control.min ?? 0;
  const max = control.max ?? Math.max(min + 1, 1);
  const def: ControlDef = {
    name: control.name,
    type: control.type,
    label: control.label ?? control.name,
    color: control.color ?? false,
    min,
    max,
    step: control.step ?? (control.type === "int" ? 1 : 0.01),
    default: control.default,
    line,
  };
  if (control.min !== undefined || control.max !== undefined) {
    def.limits = { ...(control.min !== undefined && { min }), ...(control.max !== undefined && { max }) };
  }
  return def;
}

/** What a vector effect's colour control takes to paint in the surrounding text's colour (CSS `color`). */
export const CURRENT_COLOR = "currentColor";

/** Whether a colour value is `currentColor` (in any case), which vector effects keep as it is. */
export function isCurrentColor(value: unknown): value is string {
  return typeof value === "string" && value.trim().toLowerCase() === "currentcolor";
}

/**
 * A vector effect's motion with its controls filled in. A string that is
 * only a placeholder (an animation's `"{{width}}"`) becomes the value
 * itself, so numbers stay numbers; elsewhere a placeholder becomes its text,
 * escaped in the markup so any text is safe to show. Comments are dropped
 * from the markup. Colours also take CSS colours (see `parseColor`) and
 * `currentColor`, which paints in the surrounding text's colour (`derived`
 * then sees the string "currentColor"); missing values, and values a
 * control cannot take, use defaults. Placeholders no control or derived
 * value fills stay put.
 */
export function renderVectorEffect(
  effect: Pick<VectorEffect, "motion" | "controls" | "derived">,
  values: Record<string, ControlValue> = {},
): SvgMotion {
  const filled: Record<string, ControlValue> = {};
  const placeholders = new Map<string, string | number | boolean>();
  for (const control of vectorEffectControls(effect)) {
    const given = values[control.name];
    if (control.color && isCurrentColor(given)) {
      filled[control.name] = CURRENT_COLOR;
      placeholders.set(control.name, CURRENT_COLOR);
      continue;
    }
    const check = given === undefined ? undefined : checkControlValue(control, given, { limits: false });
    filled[control.name] = check?.ok ? check.value : control.default;
    placeholders.set(control.name, written(control, filled[control.name]!));
  }
  for (const [name, value] of Object.entries(effect.derived?.(filled) ?? {})) placeholders.set(name, value);
  const fill = (text: string, markup: boolean): string | number | boolean => {
    const whole = /^\{\{\s*([A-Za-z_]\w*)\s*(?::[^}]*)?\}\}$/.exec(text);
    if (!markup && whole && placeholders.has(whole[1]!)) return placeholders.get(whole[1]!)!;
    return text.replace(PLACEHOLDER, (match, name: string) => {
      if (!placeholders.has(name)) return match;
      const value = String(placeholders.get(name));
      return markup ? escapeMarkup(value) : value;
    });
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fill(v, false);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const { svg, ...rest } = effect.motion;
  // Comments hold declarations, not picture, and a value with "--" in one would break the markup.
  return { svg: fill(svg.replace(/<!--[\s\S]*?-->/g, ""), true) as string, ...(walk(rest) as Omit<SvgMotion, "svg">) };
}

/** A colour control for vector effects. */
export function colorControl(name: string, hex: string, label?: string): VectorControl {
  return { name, type: "vec3", color: true, default: hexToRgb(hex) ?? [1, 1, 1], label: label ?? name };
}

/** A number control for vector effects. */
export function numberControl(
  name: string,
  value: number,
  min: number,
  max: number,
  label?: string,
  step?: number,
): VectorControl {
  return { name, type: "float", default: value, min, max, label: label ?? name, step };
}
