/**
 * Lottie JSON Vector Animation Exporter.
 *
 * Converts Flair scenes, elements, shapes, transforms, and keyframes into
 * official Lottie JSON format (v5.5.2) compatible with Airbnb Lottie-Web,
 * iOS/Android Lottie, Figma, and Telegram.
 */

import type { Scene } from '../scene/types.js';
import { DEFAULT_STAGE, DEFAULT_PERSPECTIVE, boardHeight, centreOf, isAngled, type View } from '../scene/camera.js';
import { cameraSamples, shotMoveMs, sceneStage } from '../scene/cameratrack.js';
import { isElementCommand, isUpdateCommand } from '../scene/types.js';
import type { KeyframeEase } from '../time/keyframe.js';

export interface LottieExportOptions {
  /** Target framerate in fps. Default: 30 */
  frameRate?: number;
}

export interface LottieKeyframe<T> {
  t: number; // frame number
  s: T; // start value
  e?: T; // end value
  o?: { x: number | number[]; y: number | number[] }; // out tangent ease
  i?: { x: number | number[]; y: number | number[] }; // in tangent ease
  h?: number; // hold keyframe flag
}

export interface LottieAnimatable<T, K = T> {
  a: 0 | 1; // 0 = static, 1 = animated
  k: T | LottieKeyframe<K>[];
}

export interface LottieTransform {
  p: LottieAnimatable<[number, number, number], [number, number, number]>; // position
  a: LottieAnimatable<[number, number, number], [number, number, number]>; // anchor
  s: LottieAnimatable<[number, number, number], [number, number, number]>; // scale
  r?: LottieAnimatable<number, [number]>; // rotation (2D layers)
  or?: LottieAnimatable<[number, number, number]>; // orientation (3D layers: players expect it with rx/ry/rz)
  rx?: LottieAnimatable<number, [number]>; // X rotation (3D layers)
  ry?: LottieAnimatable<number, [number]>; // Y rotation (3D layers)
  rz?: LottieAnimatable<number, [number]>; // Z rotation (3D layers)
  o: LottieAnimatable<number, [number]>; // opacity
}


export interface LottieShapeItem {
  ty: string;
  nm?: string;
  [key: string]: unknown;
}

export interface LottieLayer {
  ddd: 0 | 1;
  ind: number;
  ty: number; // 0 = precomp, 1 = solid, 2 = image, 3 = null, 4 = shape, 5 = text, 13 = camera
  nm: string;
  /** Index of the parent layer: element layers hang off the camera rig. */
  parent?: number;
  /** Camera layers: perspective (the AE camera's zoom), in px. */
  pe?: LottieAnimatable<number, [number]>;
  sr: number;
  ks: LottieTransform;
  ao: 0 | 1;
  ip: number;
  op: number;
  st: number;
  bm: number;
  shapes?: LottieShapeItem[];
  sw?: number;
  sh?: number;
  sc?: string;
}

export interface LottieAnimation {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: 0 | 1;
  assets: unknown[];
  layers: LottieLayer[];
}

/**
 * Maps AE speed and influence into normalized Lottie Bezier ease control points (o.x, o.y, i.x, i.y).
 */
export function createLottieEase(
  durationFrames: number,
  deltaVal: number,
  outEase?: KeyframeEase,
  inEase?: KeyframeEase
): { o: { x: number; y: number }; i: { x: number; y: number } } {
  const infOut = Math.max(0.001, Math.min(1.0, (outEase?.influence ?? 33.333) / 100));
  const infIn = Math.max(0.001, Math.min(1.0, (inEase?.influence ?? 33.333) / 100));

  const safeDelta = Math.abs(deltaVal) > 1e-6 ? deltaVal : 1;
  const speedOut = outEase?.speed ?? 0;
  const speedIn = inEase?.speed ?? 0;

  // Lottie normalized control points
  const ox = infOut;
  const oy = Math.max(0, Math.min(1, (speedOut * infOut * durationFrames) / safeDelta));

  const ix = 1.0 - infIn;
  const iy = Math.max(0, Math.min(1, 1.0 - (speedIn * infIn * durationFrames) / safeDelta));

  return {
    o: { x: Number(ox.toFixed(4)), y: Number(oy.toFixed(4)) },
    i: { x: Number(ix.toFixed(4)), y: Number(iy.toFixed(4)) },
  };
}

/** Linear keyframes for a sampled value, or a static value when it never changes. */
function sampled<T extends number | number[]>(samples: { t: number; v: T }[]): LottieAnimatable<T, any> {
  const same = samples.every((x) => JSON.stringify(x.v) === JSON.stringify(samples[0]!.v));
  if (same) return { a: 0, k: samples[0]!.v };
  const keys = samples.map((x, i) => {
    const s = (Array.isArray(x.v) ? x.v : [x.v]) as number[];
    return i < samples.length - 1 ? { t: x.t, s, o: { x: 0, y: 0 }, i: { x: 1, y: 1 } } : { t: x.t, s };
  });
  return { a: 1, k: keys as LottieKeyframe<any>[] };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The scene's camera as layers: a null "Camera" rig the element layers hang
 * off (its anchor is the camera's centre, its scale the zoom and, in 3D, its
 * rotations the angle), and, when the camera is ever angled, an AE camera
 * whose zoom is the perspective distance. Sampled every other frame during
 * moves, so the eased path and perspective come through. Lottie has no
 * motion blur, so that is left out.
 */
function cameraLayers(scene: Scene, fr: number, totalFrames: number): { layers: LottieLayer[]; rig: number; ddd: 0 | 1 } | null {
  if (!scene.shots.some((s) => s.camera)) return null;
  const stage = sceneStage(scene);
  const samples = cameraSamples(scene, fr).map((x) => ({ t: x.frame, view: x.view }));
  const ddd: 0 | 1 = samples.some((x) => isAngled(x.view)) ? 1 : 0;
  const w = stage.width;
  const h = boardHeight(stage);
  const at = <T extends number | number[]>(fn: (v: View) => T) => sampled(samples.map((x) => ({ t: x.t, v: fn(x.view) })));
  const ks: LottieTransform = {
    a: at((v) => {
      const [cx, cy] = centreOf(v, stage);
      return [r3(cx), r3(cy), 0] as [number, number, number];
    }) as LottieTransform['a'],
    p: { a: 0, k: [w / 2, h / 2, 0] },
    s: at((v) => [r3(v.zoom * 100), r3(v.zoom * 100), 100] as [number, number, number]) as LottieTransform['s'],
    o: { a: 0, k: 100 },
  };
  // AE turns the other way round X and Y from CSS (its z points into the screen).
  if (ddd) {
    ks.or = { a: 0, k: [0, 0, 0] };
    ks.rx = at((v) => r3(0 - (v.tilt ?? 0)));
    ks.ry = at((v) => r3(0 - (v.turn ?? 0)));
    ks.rz = at((v) => r3(v.roll ?? 0));
  } else ks.r = at((v) => r3(v.roll ?? 0));
  const layers: LottieLayer[] = [];
  if (ddd) {
    const distance = at((v) => r3((v.perspective ?? DEFAULT_PERSPECTIVE) * w));
    const d0 = (DEFAULT_PERSPECTIVE * w) as number;
    layers.push({
      ddd: 1,
      ind: 1,
      ty: 13,
      nm: 'Camera Lens',
      sr: 1,
      pe: distance,
      ks: {
        p: { a: 0, k: [w / 2, h / 2, -d0] },
        a: { a: 0, k: [w / 2, h / 2, 0] },
        s: { a: 0, k: [100, 100, 100] },
        or: { a: 0, k: [0, 0, 0] },
        rx: { a: 0, k: 0 },
        ry: { a: 0, k: 0 },
        rz: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
      },
      ao: 0,
      ip: 0,
      op: totalFrames,
      st: 0,
      bm: 0,
    });
  }
  const rig = layers.length + 1;
  layers.push({ ddd, ind: rig, ty: 3, nm: 'Camera', sr: 1, ks, ao: 0, ip: 0, op: totalFrames, st: 0, bm: 0 });
  return { layers, rig, ddd };
}

/**
 * Serializes a Flair Scene into standard Lottie JSON animation. A scene
 * with a camera gets a camera rig the element layers hang off, in 3D (with
 * an AE camera) when the camera is angled.
 */
export function exportLottie(scene: Scene, options: LottieExportOptions = {}): LottieAnimation {
  const fr = options.frameRate ?? 30;
  const width = scene.stage?.width ?? DEFAULT_STAGE.width;
  const height = scene.stage?.height ?? DEFAULT_STAGE.height;

  // Compute shot timeline frames
  let currentMs = 0;
  const shotTimings = scene.shots.map((shot, idx) => {
    const camMs = shotMoveMs(shot, idx);
    const holdMs = shot.hold ?? 800;
    const durationMs = camMs + holdMs;
    const startMs = currentMs;
    currentMs += durationMs;

    const startFrame = Math.round((startMs / 1000) * fr);
    const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fr));
    const endFrame = startFrame + durationFrames;

    return {
      shot,
      startFrame,
      durationFrames,
      endFrame,
    };
  });

  const totalFrames = Math.max(1, Math.round((currentMs / 1000) * fr));

  // Collect elements and track property updates across shots
  interface ElementTrack {
    id: string;
    type: string;
    initialX: number;
    initialY: number;
    width: number;
    height: number;
    text?: string;
    opacity: number;
    inFrame: number;
    outFrame: number;
    posKeyframes: LottieKeyframe<[number, number, number]>[];
    opacityKeyframes: LottieKeyframe<[number]>[];
  }

  const tracks = new Map<string, ElementTrack>();

  for (const timing of shotTimings) {
    const shot = timing.shot;
    if (!shot.run) continue;

    for (const cmd of shot.run) {
      if (isElementCommand(cmd)) {
        const el = cmd.element;
        if (!tracks.has(el.id)) {
          tracks.set(el.id, {
            id: el.id,
            type: el.type,
            initialX: el.x,
            initialY: el.y,
            width: el.width,
            height: el.height,
            text: el.text,
            opacity: el.opacity ?? 1,
            inFrame: timing.startFrame,
            outFrame: totalFrames,
            posKeyframes: [
              {
                t: timing.startFrame,
                s: [el.x + el.width * 0.5, el.y + el.height * 0.5, 0],
              },
            ],
            opacityKeyframes: [
              {
                t: timing.startFrame,
                s: [(el.opacity ?? 1) * 100],
              },
            ],
          });
        }
      } else if (isUpdateCommand(cmd)) {
        const track = tracks.get(cmd.id);
        if (track) {
          const props = cmd.props;
          const prevPos = track.posKeyframes[track.posKeyframes.length - 1];
          const newX = props.x !== undefined ? props.x : prevPos.s[0] - track.width * 0.5;
          const newY = props.y !== undefined ? props.y : prevPos.s[1] - track.height * 0.5;

          const ease = createLottieEase(timing.durationFrames, 1);
          prevPos.o = ease.o;
          prevPos.i = ease.i;

          track.posKeyframes.push({
            t: timing.endFrame,
            s: [newX + track.width * 0.5, newY + track.height * 0.5, 0],
          });

          if (props.opacity !== undefined) {
            const prevOp = track.opacityKeyframes[track.opacityKeyframes.length - 1];
            prevOp.o = ease.o;
            prevOp.i = ease.i;
            track.opacityKeyframes.push({
              t: timing.endFrame,
              s: [props.opacity * 100],
            });
          }
        }
      }
    }
  }

  // Build Lottie layers: the camera first, then the elements hanging off its rig.
  const camera = cameraLayers(scene, fr, totalFrames);
  const layers: LottieLayer[] = camera ? [...camera.layers] : [];
  let layerIndex = layers.length + 1;

  for (const track of tracks.values()) {
    const isPosAnimated = track.posKeyframes.length > 1;
    const isOpAnimated = track.opacityKeyframes.length > 1;

    const p: LottieAnimatable<[number, number, number], [number, number, number]> = isPosAnimated
      ? { a: 1, k: track.posKeyframes }
      : { a: 0, k: [track.initialX + track.width * 0.5, track.initialY + track.height * 0.5, 0] };

    const o: LottieAnimatable<number, [number]> = isOpAnimated
      ? { a: 1, k: track.opacityKeyframes }
      : { a: 0, k: track.opacity * 100 };

    const ks: LottieTransform = {
      p,
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
      r: { a: 0, k: 0 },
      o,
    };

    // Shape items for rectangle / visual element
    const shapes: LottieShapeItem[] = [
      {
        ty: 'gr',
        nm: track.id,
        it: [
          {
            ty: 'rc',
            nm: 'Rectangle Path',
            d: 1,
            s: { a: 0, k: [track.width, track.height] },
            p: { a: 0, k: [0, 0] },
            r: { a: 0, k: 8 },
          },
          {
            ty: 'fl',
            nm: 'Fill',
            c: { a: 0, k: [0.2, 0.4, 0.9, 1] },
            o: { a: 0, k: 100 },
            r: 1,
          },
          {
            ty: 'tr',
            nm: 'Transform',
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
    ];

    layers.push({
      ddd: camera?.ddd ?? 0,
      ind: layerIndex++,
      ...(camera && { parent: camera.rig }),
      ty: 4, // Shape layer
      nm: track.id,
      sr: 1,
      ks,
      ao: 0,
      ip: track.inFrame,
      op: track.outFrame,
      st: track.inFrame,
      bm: 0, // Normal blend mode
      shapes,
    });
  }

  return {
    v: '5.5.2',
    fr,
    ip: 0,
    op: totalFrames,
    w: width,
    h: height,
    nm: scene.name || 'Flair Animation',
    ddd: camera?.ddd ?? 0,
    assets: [],
    layers,
  };
}
