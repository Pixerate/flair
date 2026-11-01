import type { ControlValue } from "../shader/controls.js";
import {
  between,
  boardHeight,
  CAMERA_STEPS,
  cameraAngle,
  centreOf,
  DEFAULT_PERSPECTIVE,
  easeInOutCubic,
  frame,
  isAngled,
  moveBlur,
  type Stage,
  type View,
  viewAt,
} from "../scene/camera.js";
import { checkControlValue, controlValue, type ControlDef } from "../shader/controls.js";
import { vectorControlDef, type CameraEffect, type CameraMoveContext } from "./types.js";

/*
 * Camera moves: how a scene's camera gets into a shot (`camera.in`) or moves
 * while the shot holds (`camera.during`). Each is a pure function from where
 * the move is to the camera's view, so scenes, their exporters and their
 * layout checks all see the same camera. On its own a move previews on a
 * picture (see {@link cameraPreviewValues}), the picture standing in for a
 * scene's board.
 *
 * Moves are measured in the scene's own units: a framing's width is
 * `stage.width / view.zoom`. Points within a framing are 0–1 across it from
 * its top left, y down, as a scene's are.
 */

/** A number control's value, or its fallback when it is missing or not a number. */
const num = (values: Readonly<Record<string, ControlValue>>, name: string, fallback: number): number => {
  const v = values[name];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};

const vec2 = (values: Readonly<Record<string, ControlValue>>, name: string, fallback: [number, number]): [number, number] => {
  const v = values[name];
  return Array.isArray(v) && v.length >= 2 && v.every((n) => typeof n === "number") ? [v[0]!, v[1]!] : fallback;
};

const easeInCubic = (t: number): number => t * t * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** The fraction of a move one blur step spans: blur is measured over the step before. */
const STEP = 1 / CAMERA_STEPS;

/** The view's blur fields from the step before, at `strength`; the view unchanged when still. */
function blurred(view: View, before: View, stage: Stage, strength: number): View {
  return strength > 0 ? { ...view, ...moveBlur(before, view, stage, strength) } : view;
}

/**
 * One half of a whip or punch at `t` (0 to 1 through the half; the formula
 * carries on smoothly before 0, which the blur step relies on arriving):
 * leaving `from` (`out`) or arriving at `to`. A punch zooms to `punch` × at
 * the cut.
 */
function half(kind: "whip" | "punch", { from, to, stage }: CameraMoveContext, out: boolean, t: number, punch: number): View {
  const at = out ? from : to;
  // How far off its framing the camera is: 0 settled, 1 at the cut.
  const off = out ? easeInCubic(t) : 1 - easeOutCubic(t);
  const [cx, cy] = centreOf(at, stage);
  const angle = cameraAngle(at);
  if (kind === "punch") return { ...viewAt(cx, cy, at.zoom * Math.pow(punch, off), stage), ...angle };
  const [x0, y0] = centreOf(from, stage);
  const [x1, y1] = centreOf(to, stage);
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const [dx, dy] = dist > 1e-6 ? [(x1 - x0) / dist, (y1 - y0) / dist] : [1, 0];
  // A board's width at this framing's zoom: out ahead of `from`, behind `to`.
  const reach = (stage.width / at.zoom) * off * (out ? 1 : -1);
  return { ...viewAt(cx + dx * reach, cy + dy * reach, at.zoom, stage), ...angle };
}

/**
 * A whip or punch: half the move leaving `from`, cutting at the blurriest
 * moment, half arriving at `to`. It covers a board's width in a few steps,
 * so it blurs at a quarter of a glide's strength to build up to the cut
 * rather than smear throughout.
 */
function whipOrPunch(kind: "whip" | "punch", ctx: CameraMoveContext, blur: number, punch: number): View {
  const { u, to, stage } = ctx;
  if (u >= 1) return to;
  // Each half takes half the move, so a step is twice as far through it; the
  // step before is taken on the same side of the cut, never across it.
  const out = u < 0.5;
  const t = out ? Math.max(0, u) * 2 : (u - 0.5) * 2;
  const view = half(kind, ctx, out, t, punch);
  // Leaving, the camera was still before it set off; arriving, the step before carries on from behind the cut.
  const before = half(kind, ctx, out, out ? Math.max(0, t - 2 * STEP) : t - 2 * STEP, punch);
  return blurred(view, before, stage, blur * 0.25);
}

const MOTION_BLUR = { name: "motionBlur", type: "float", label: "Motion blur", min: 0, max: 3, step: 0.1 } as const;

export const cameraGlide: CameraEffect = {
  kind: "camera",
  id: "camera-glide",
  name: "Glide",
  description: "The camera eases across from the last framing to the next, zooming and turning smoothly on the way.",
  category: "camera",
  tags: ["camera", "move", "pan", "zoom", "ease", "glide"],
  controls: [{ ...MOTION_BLUR, default: 0 }],
  motion: {
    role: "transition",
    duration: 600,
    view({ from, to, u, stage }, values) {
      if (u >= 1) return to;
      const view = between(from, to, easeInOutCubic(Math.max(0, u)), stage);
      const before = between(from, to, easeInOutCubic(Math.max(0, u - STEP)), stage);
      return blurred(view, before, stage, num(values, "motionBlur", 0));
    },
  },
  presets: [
    { name: "Natural blur", values: { motionBlur: 1 } },
    { name: "Swoop", values: { motionBlur: 1.8 } },
  ],
};

export const cameraWhipPan: CameraEffect = {
  kind: "camera",
  id: "camera-whip-pan",
  name: "Whip pan",
  description: "The camera whips off the last framing toward the next in a streak of motion blur and whips in onto it, cutting at the blurriest moment.",
  category: "camera",
  tags: ["camera", "move", "whip", "pan", "swish", "motion-blur", "energetic"],
  controls: [{ ...MOTION_BLUR, default: 2 }],
  motion: {
    role: "transition",
    duration: 600,
    cut: 0.5,
    view: (ctx, values) => whipOrPunch("whip", ctx, num(values, "motionBlur", 2), 1),
  },
  presets: [
    { name: "Soft", values: { motionBlur: 1 } },
    { name: "Hard", values: { motionBlur: 3 } },
  ],
};

export const cameraPunchZoom: CameraEffect = {
  kind: "camera",
  id: "camera-punch-zoom",
  name: "Punch zoom",
  description: "The camera punches into the last framing, blurring every way, and cuts to the next one settling out of a punched-in view.",
  category: "camera",
  tags: ["camera", "move", "zoom", "punch", "push-in", "motion-blur", "energetic"],
  controls: [
    { ...MOTION_BLUR, default: 2 },
    { name: "punch", type: "float", label: "Punch (×)", min: 1.2, max: 6, step: 0.1, default: 3 },
  ],
  motion: {
    role: "transition",
    duration: 600,
    cut: 0.5,
    view: (ctx, values) => whipOrPunch("punch", ctx, num(values, "motionBlur", 2), Math.max(1, num(values, "punch", 3))),
  },
  presets: [
    { name: "Gentle", values: { motionBlur: 1, punch: 1.6 } },
    { name: "Slam", values: { motionBlur: 3, punch: 5 } },
  ],
};

export const cameraCut: CameraEffect = {
  kind: "camera",
  id: "camera-cut",
  name: "Cut",
  description: "The camera jumps straight to the next framing, taking no time.",
  category: "camera",
  tags: ["camera", "cut", "jump", "instant"],
  controls: [],
  motion: { role: "transition", duration: 0, view: ({ to }) => to },
};

/** The size of a framing in scene units: [width, height]. */
const framingSize = (view: View, stage: Stage): [number, number] => [stage.width / view.zoom, boardHeight(stage) / view.zoom];

export const cameraKenBurns: CameraEffect = {
  kind: "camera",
  id: "camera-ken-burns",
  name: "Ken Burns",
  description: "While the shot holds, the camera drifts slowly across the framing, easing from one zoom to another as it pans.",
  category: "camera",
  tags: ["camera", "hold", "ken-burns", "drift", "documentary", "slideshow", "push-in"],
  controls: [
    { name: "zoomStart", type: "float", label: "Start zoom (×)", min: 1, max: 3, step: 0.01, default: 1 },
    { name: "zoomEnd", type: "float", label: "End zoom (×)", min: 1, max: 3, step: 0.01, default: 1.25 },
    { name: "angle", type: "float", label: "Pan direction (°, 90 up)", min: 0, max: 360, step: 1, default: 20 },
  ],
  motion: {
    role: "hold",
    duration: 4000,
    view({ to, u, stage }, values) {
      const k = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));
      const zoom = Math.max(1, num(values, "zoomStart", 1) + (num(values, "zoomEnd", 1.25) - num(values, "zoomStart", 1)) * k);
      // Pan as far as the zoomed window allows in the chosen direction, from one side to the other.
      const a = (num(values, "angle", 20) * Math.PI) / 180;
      const [w, h] = framingSize(to, stage);
      const reach = (1 - 1 / zoom) * 0.5 * (2 * k - 1);
      const [cx, cy] = centreOf(to, stage);
      return { ...viewAt(cx + Math.cos(a) * reach * w, cy - Math.sin(a) * reach * h, to.zoom * zoom, stage), ...cameraAngle(to) };
    },
  },
  presets: [
    { name: "Push in", values: { zoomStart: 1, zoomEnd: 1.5, angle: 0 } },
    { name: "Pull out", values: { zoomStart: 1.6, zoomEnd: 1.05, angle: 200 } },
    { name: "Slow drift", values: { zoomStart: 1.2, zoomEnd: 1.25, angle: 0 } },
  ],
};

/** The crash zoom's view at `ms` into the hold, before blur. */
function crashView(to: View, stage: Stage, ms: number, values: Readonly<Record<string, ControlValue>>): View {
  const steps = Math.max(1, Math.round(num(values, "steps", 3)));
  const stepMs = Math.max(50, num(values, "stepTime", 0.4) * 1000);
  const t = ms - Math.max(0, num(values, "delay", 0.3) * 1000);
  // How far through the steps it is (0 to 1), each step a fast ease that overshoots a touch.
  let level = 0;
  let age = Infinity;
  if (t >= 0) {
    const k = Math.min(Math.floor(t / stepMs), steps - 1);
    age = (t - k * stepMs) / 1000;
    const e = Math.min(1, age / 0.09) - 1;
    level = (k + 1 + 2.7 * e * e * e + 1.7 * e * e) / steps;
  }
  const z = Math.pow(Math.max(1, num(values, "zoom", 3.4)), level);
  const [w, h] = framingSize(to, stage);
  const [tx, ty] = vec2(values, "target", [0.5, 0.42]);
  const [cx, cy] = centreOf(to, stage);
  const target = [cx + (tx - 0.5) * w, cy + (ty - 0.5) * h] as const;
  // Zoom in about the target, so it stays where it is on screen; a kick rings down as each step lands.
  const kick = Number.isFinite(age) ? num(values, "shake", 0.5) * Math.exp(-age * 16) : 0;
  // Before the first step there is no kick (and age is Infinity, whose sine is NaN).
  const x = target[0] + (cx - target[0]) / z + (kick ? ((kick * 0.03) / z) * w * Math.sin(age * 90) : 0);
  const y = target[1] + (cy - target[1]) / z + (kick ? ((kick * 0.03) / z) * h * Math.cos(age * 70 + 1) : 0);
  return { ...viewAt(x, y, to.zoom * z, stage), ...cameraAngle(to) };
}

/** Ms one blur step spans in a hold: as long as a step of a default glide. */
const HOLD_STEP_MS = 600 / CAMERA_STEPS;

export const cameraCrashZoom: CameraEffect = {
  kind: "camera",
  id: "camera-crash-zoom",
  name: "Crash zoom",
  description: "While the shot holds, the camera crashes in on a point (a face, a stare, a detail) in a few sudden steps, each landing with a kick, and stays there.",
  category: "camera",
  tags: ["camera", "hold", "zoom", "crash-zoom", "dramatic", "meme", "shake"],
  controls: [
    { name: "target", type: "vec2", label: "Zoom onto (0–1 across the framing, y down)", min: 0, max: 1, step: 0.01, default: [0.5, 0.42] },
    { name: "zoom", type: "float", label: "Zoom (×)", min: 1.2, max: 8, step: 0.1, default: 3.4 },
    { name: "steps", type: "int", label: "Steps", min: 1, max: 4, step: 1, default: 3 },
    { name: "stepTime", type: "float", label: "Seconds per step", min: 0.15, max: 1.5, step: 0.05, default: 0.4 },
    { name: "delay", type: "float", label: "Seconds before the first step", min: 0, max: 3, step: 0.05, default: 0.3 },
    { name: "shake", type: "float", label: "Kick", min: 0, max: 1, step: 0.05, default: 0.5 },
    { ...MOTION_BLUR, default: 0.6 },
  ],
  motion: {
    role: "hold",
    duration: 2000,
    view({ to, u, stage, ms }, values) {
      const at = Math.max(0, u) * ms;
      const view = crashView(to, stage, at, values);
      return blurred(view, crashView(to, stage, Math.max(0, at - HOLD_STEP_MS), values), stage, num(values, "motionBlur", 0.6));
    },
  },
  presets: [
    { name: "One crash", values: { steps: 1, zoom: 4, stepTime: 0.5 } },
    { name: "Slow dread", values: { steps: 4, zoom: 2.6, stepTime: 0.9, shake: 0.15 } },
    { name: "Extreme close-up", values: { zoom: 7, shake: 0.8 } },
  ],
};

export const cameraEffects: CameraEffect[] = [cameraGlide, cameraWhipPan, cameraPunchZoom, cameraCut, cameraKenBurns, cameraCrashZoom];

const byId = new Map(cameraEffects.map((e) => [e.id, e]));

/** The camera move with this id, or undefined: for code that needs only the camera moves, not the whole catalog. */
export function getCameraMove(id: string): CameraEffect | undefined {
  return byId.get(id);
}

/** A camera move's controls, as `effectControls` gives them. */
export function cameraMoveControls(move: CameraEffect): ControlDef[] {
  return move.controls.map((c, i) => vectorControlDef(c, i + 1));
}

/**
 * A camera move's values: each control's default, overridden by a preset
 * (by name) and then `values`. Problems are sentences: an unknown preset or
 * control, or a value of the wrong type or out of range (left at its
 * default).
 */
export function cameraMoveValues(
  move: CameraEffect,
  options: { preset?: string; values?: Readonly<Record<string, unknown>> } = {},
): { values: Record<string, ControlValue>; issues: string[] } {
  const issues: string[] = [];
  const controls = cameraMoveControls(move);
  let preset: Record<string, ControlValue> | undefined;
  if (options.preset !== undefined) {
    preset = move.presets?.find((p) => p.name === options.preset)?.values;
    if (!preset) {
      const names = (move.presets ?? []).map((p) => `"${p.name}"`).join(", ");
      issues.push(`"${move.id}" has no preset "${options.preset}"; ${names ? `its presets are ${names}` : "it has none"}.`);
    }
  }
  const given: Record<string, ControlValue> = {};
  for (const [name, value] of Object.entries(options.values ?? {})) {
    const control = controls.find((c) => c.name === name);
    if (!control) {
      issues.push(`"${move.id}" has no control "${name}"; ${controls.length ? `its controls are ${controls.map((c) => c.name).join(", ")}` : "it has none"}.`);
      continue;
    }
    const check = checkControlValue(control, value as ControlValue);
    if (check.ok) given[name] = check.value;
    else issues.push(`"${move.id}": ${check.message}`);
  }
  const merged = { ...preset, ...given };
  return { values: Object.fromEntries(controls.map((c) => [c.name, controlValue(c, merged)])), issues };
}

/* ---------- Previewing a move on a picture ---------- */

/** The stage a preview treats its picture as: 1000 units across, the canvas's shape. */
export function previewStage(aspect: number): Stage {
  return { width: 1000, height: 1000 / (aspect > 0 ? aspect : 16 / 9), caption: 0 };
}

/** Ms a preview rests on the first framing before a transition, and on the second after it. */
const PREVIEW_REST = [500, 900] as const;

/** Ms of one loop of a move's preview: rests around a transition, or the hold itself. */
export function cameraPreviewLength(move: CameraEffect, ms = move.motion.duration): number {
  return move.motion.role === "transition" ? PREVIEW_REST[0] + ms + PREVIEW_REST[1] : Math.max(ms, 1000) + PREVIEW_REST[1];
}

/** The framings a preview moves between on a stage: the whole picture, and for a transition a detail up and to the right. */
function previewFramings(move: CameraEffect, stage: Stage): [View, View] {
  const whole = frame({ x: 0, y: 0, width: stage.width, height: stage.height }, stage);
  if (move.motion.role === "hold") return [whole, whole];
  return [whole, frame({ x: stage.width * 0.45, y: stage.height * 0.15, width: stage.width * 0.4, height: stage.height * 0.4 }, stage)];
}

/**
 * The camera's view `timeMs` into a move's preview loop on a picture with
 * this aspect (width / height), the picture filling a stage from
 * {@link previewStage}: a transition rests on the whole picture, moves to a
 * detail and rests there; a hold plays across the whole picture.
 */
export function cameraPreviewView(
  move: CameraEffect,
  values: Readonly<Record<string, ControlValue>>,
  timeMs: number,
  aspect: number,
  ms = move.motion.duration,
): { view: View; stage: Stage } {
  const stage = previewStage(aspect);
  const [from, to] = previewFramings(move, stage);
  const loop = cameraPreviewLength(move, ms);
  const t = ((timeMs % loop) + loop) % loop;
  if (move.motion.role === "hold") {
    const length = Math.max(ms, 1000);
    return { view: move.motion.view({ from, to, u: Math.min(1, t / length), stage, ms: length }, values), stage };
  }
  const u = ms > 0 ? (t - PREVIEW_REST[0]) / ms : t < PREVIEW_REST[0] ? -1 : 1;
  const view = u < 0 ? from : move.motion.view({ from, to, u: Math.min(1, u), stage, ms }, values);
  return { view, stage };
}

/**
 * The homography that takes a point on screen (stage units from the top
 * left of the board) back to the scene point the view shows there: the
 * inverse of `projectPoint`. Rows of a 3 × 3 matrix; divide by the third
 * component.
 */
export function screenToScene(view: View, stage: Stage): [number, number, number][] {
  const cx = stage.width / 2;
  const cy = boardHeight(stage) / 2;
  const z = view.zoom;
  // Board pixel b (from the board's top left) → scene point b / zoom − scroll.
  const toScene: [number, number, number][] = [
    [1 / z, 0, -view.scrollX],
    [0, 1 / z, -view.scrollY],
    [0, 0, 1],
  ];
  const centred = (m: [number, number, number][]): [number, number, number][] =>
    // Screen point s → s − c, through m, then + c: m', in homogeneous form.
    multiply(multiply([[1, 0, cx], [0, 1, cy], [0, 0, 1]], m), [[1, 0, -cx], [0, 1, -cy], [0, 0, 1]]);
  if (!isAngled(view)) return multiply(toScene, centred([[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
  const a = cameraAngle(view);
  const rad = Math.PI / 180;
  const d = (a.perspective ?? DEFAULT_PERSPECTIVE) * stage.width;
  // The board's rotation as projectPoint applies it: roll, then turn, then tilt.
  const [sr, cr] = [Math.sin((a.roll ?? 0) * rad), Math.cos((a.roll ?? 0) * rad)];
  const [st, ct] = [Math.sin((a.turn ?? 0) * rad), Math.cos((a.turn ?? 0) * rad)];
  const [sx, cx2] = [Math.sin((a.tilt ?? 0) * rad), Math.cos((a.tilt ?? 0) * rad)];
  const roll: [number, number, number][] = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const turn: [number, number, number][] = [[ct, 0, st], [0, 1, 0], [-st, 0, ct]];
  const tilt: [number, number, number][] = [[1, 0, 0], [0, cx2, -sx], [0, sx, cx2]];
  const r = multiply(tilt, multiply(turn, roll));
  // The board's normal, and the ray from the eye (0, 0, d) through the screen point meeting the board's plane.
  const n = [r[0]![2]!, r[1]![2]!, r[2]![2]!] as const;
  const m: [number, number, number][] = [
    [n[2] * d, 0, 0],
    [0, n[2] * d, 0],
    [-d * n[0], -d * n[1], 0],
  ];
  const rt: [number, number, number][] = [0, 1, 2].map((i) => [r[0]![i]!, r[1]![i]!, r[2]![i]!]) as [number, number, number][];
  const q = multiply(rt, m);
  const k: [number, number, number][] = [q[0]!, q[1]!, [-n[0], -n[1], n[2] * d]];
  return multiply(toScene, centred(k));
}

function multiply(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): [number, number, number][] {
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!)) as [number, number, number][];
}

/**
 * The values of {@link CAMERA_PREVIEW_SOURCE}'s uniforms `timeMs` into a
 * move's preview on a canvas with this aspect: set them each frame (the
 * picture itself goes in `uImage`).
 */
export function cameraPreviewValues(
  move: CameraEffect,
  values: Readonly<Record<string, ControlValue>>,
  timeMs: number,
  aspect: number,
  ms?: number,
): Record<string, ControlValue> {
  const { view, stage } = cameraPreviewView(move, values, timeMs, aspect, ms);
  const h = screenToScene(view, stage);
  // The blur's direction on screen, or 0 0 for every way.
  const angle = view.blurAngle === undefined ? undefined : (view.blurAngle * Math.PI) / 180;
  return {
    uRow0: h[0]!,
    uRow1: h[1]!,
    uRow2: h[2]!,
    uStage: [stage.width, stage.height],
    uBlur: (view.blur ?? 0) / stage.width,
    uBlurDir: angle === undefined ? [0, 0] : [Math.cos(angle), Math.sin(angle)],
  };
}

/**
 * The shader a camera move previews with: a picture drawn through the
 * view {@link cameraPreviewValues} gives for each frame, blurred along the
 * move. The camera's maths stay in TypeScript; this only draws.
 */
export const CAMERA_PREVIEW_SOURCE = `// Camera preview: a picture seen through a camera move's view, blurred as it moves.
uniform sampler2D uImage; // @control filter=linear wrap=clamp label="Image"
uniform vec3 uRow0;       // @control min=-10000 max=10000 default=1,0,0 label="View row 1"
uniform vec3 uRow1;       // @control min=-10000 max=10000 default=0,1,0 label="View row 2"
uniform vec3 uRow2;       // @control min=-10000 max=10000 default=0,0,1 label="View row 3"
uniform vec2 uStage;      // @control min=1 max=10000 default=1000,562.5 label="Stage size"
uniform float uBlur;      // @control min=0 max=1 default=0 label="Blur"
uniform vec2 uBlurDir;    // @control min=-1 max=1 default=0,0 label="Blur direction"

// The picture at a point on screen (stage units, y down), cover-fitted to the stage; dark off it.
vec3 seen(vec2 s) {
  vec3 h = vec3(dot(uRow0, vec3(s, 1.0)), dot(uRow1, vec3(s, 1.0)), dot(uRow2, vec3(s, 1.0)));
  if (h.z <= 0.0) return vec3(0.04);
  vec2 uv = (h.xy / h.z) / uStage;
  vec2 size = vec2(textureSize(uImage, 0));
  float stageAspect = uStage.x / uStage.y;
  float imageAspect = size.x > 1.0 ? size.x / size.y : stageAspect;
  vec2 cover = stageAspect > imageAspect ? vec2(1.0, imageAspect / stageAspect) : vec2(stageAspect / imageAspect, 1.0);
  vec2 st = 0.5 + (uv - 0.5) * cover;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.04);
  return texture(uImage, vec2(st.x, 1.0 - st.y)).rgb;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 s = vec2(fragCoord.x, iResolution.y - fragCoord.y) * (uStage.x / iResolution.x);
  float r = uBlur * uStage.x;
  vec3 col = vec3(0.0);
  // Nine taps along the streak, or a small ring when it blurs every way.
  bool streak = dot(uBlurDir, uBlurDir) > 0.0;
  for (int i = 0; i < 9; i++) {
    float k = float(i) / 8.0 - 0.5;
    vec2 off = streak ? uBlurDir * k * 2.0 * r : r * k * vec2(cos(float(i) * 2.4), sin(float(i) * 2.4));
    col += seen(s + off);
  }
  fragColor = vec4(col / 9.0, 1.0);
}`;
