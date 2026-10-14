/**
 * Lottie JSON Vector Animation Exporter.
 *
 * Converts Flair scenes, elements, shapes, transforms, and keyframes into
 * official Lottie JSON format (v5.5.2) compatible with Airbnb Lottie-Web,
 * iOS/Android Lottie, Figma, and Telegram.
 */

import type { Scene } from '../scene/types.js';
import { DEFAULT_STAGE, CAMERA_MS } from '../scene/camera.js';
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
  r: LottieAnimatable<number, [number]>; // rotation
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
  ty: number; // 0 = precomp, 1 = solid, 2 = image, 3 = null, 4 = shape, 5 = text
  nm: string;
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
  ddd: 0;
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

/**
 * Serializes a Flair Scene into standard Lottie JSON animation.
 */
export function exportLottie(scene: Scene, options: LottieExportOptions = {}): LottieAnimation {
  const fr = options.frameRate ?? 30;
  const width = scene.stage?.width ?? DEFAULT_STAGE.width;
  const height = scene.stage?.height ?? DEFAULT_STAGE.height;

  // Compute shot timeline frames
  let currentMs = 0;
  const shotTimings = scene.shots.map((shot, idx) => {
    const camMs = idx > 0 && shot.camera ? CAMERA_MS : 0;
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

  // Build Lottie layers
  const layers: LottieLayer[] = [];
  let layerIndex = 1;

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
      ddd: 0,
      ind: layerIndex++,
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
    ddd: 0,
    assets: [],
    layers,
  };
}
