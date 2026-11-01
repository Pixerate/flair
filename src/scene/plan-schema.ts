import { SCENE_PLAN_VERSION } from './plan-types.js';

const num = { type: 'number' } as const;
const str = { type: 'string' } as const;
const rect = { type: 'object', required: ['x', 'y', 'width', 'height'], properties: { x: num, y: num, width: num, height: num } } as const;
const controlValues = { type: 'object', additionalProperties: { type: ['number', 'boolean', 'string', 'array'] } } as const;
const subject = {
  type: 'object',
  description: 'A picture, video URL, SVG (markup or URL) or words; or { slot } when the player fills it.',
  oneOf: [
    { required: ['image'], properties: { image: str } },
    { required: ['video'], properties: { video: str } },
    { required: ['svg'], properties: { svg: str } },
    { required: ['text'], properties: { text: str, font: str, weight: { type: ['number', 'string'] } } },
    { required: ['slot'], properties: { slot: str } },
  ],
} as const;
const shader = {
  type: 'object',
  required: ['kind', 'source', 'values', 'transparent'],
  properties: {
    kind: { const: 'shader' },
    effect: str,
    source: { type: 'string', description: 'GLSL ES 3.00 with void mainImage(out vec4 fragColor, in vec2 fragCoord), its uniforms declared with // @control.' },
    values: controlValues,
    transparent: { type: 'boolean' },
    subjectControl: str,
  },
} as const;

/**
 * The JSON Schema (draft 2020-12) of a {@link ScenePlan}, for players
 * outside JavaScript: the build writes it to
 * `@pixerate/flair/schemas/scene-plan.json`.
 */
export const SCENE_PLAN_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://pixerate.github.io/flair/schemas/scene-plan.json',
  title: 'Flair scene plan',
  description: 'A scene with everything a player needs worked out: shots, the camera at every frame, elements as they change, and layers and transitions with their shaders or pictures and values. Times are ms on the scene timeline; board units are the stage\'s.',
  type: 'object',
  required: ['version', 'name', 'stage', 'durationMs', 'fps', 'shots', 'camera', 'elements', 'layers', 'transitions', 'notes'],
  properties: {
    version: { const: SCENE_PLAN_VERSION },
    name: str,
    title: str,
    stage: { type: 'object', required: ['width', 'height'], properties: { width: num, height: num, caption: num } },
    durationMs: num,
    fps: num,
    shots: {
      type: 'array',
      items: { type: 'object', required: ['index', 'startMs', 'moveMs', 'holdMs'], properties: { index: { type: 'integer' }, startMs: num, moveMs: num, holdMs: num, title: str, caption: str } },
    },
    camera: {
      type: 'array',
      description: 'The view at each frame: hold each to the next.',
      items: {
        type: 'object',
        required: ['ms', 'view'],
        properties: {
          ms: num,
          view: { type: 'object', required: ['zoom', 'scrollX', 'scrollY'], properties: { zoom: num, scrollX: num, scrollY: num, tilt: num, turn: num, roll: num, perspective: num, blur: num, blurAngle: num } },
        },
      },
    },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'keys'],
        properties: {
          id: str,
          keys: {
            type: 'array',
            items: { type: 'object', required: ['ms', 'element'], properties: { ms: num, element: { type: ['object', 'null'], required: ['id', 'type', 'x', 'y', 'width', 'height'] } } },
          },
        },
      },
    },
    layers: {
      type: 'array',
      description: 'Bottom of the stack first.',
      items: {
        type: 'object',
        required: ['key', 'shot', 'role', 'startMs', 'endMs', 'opacity', 'fade', 'place', 'draw'],
        properties: {
          key: str,
          shot: { type: 'integer' },
          role: { enum: ['background', 'subject', 'overlay'] },
          startMs: num,
          endMs: num,
          opacity: num,
          fade: num,
          place: {
            oneOf: [
              { type: 'object', required: ['screen'], properties: { screen: { const: true } } },
              { type: 'object', required: ['rect'], properties: { rect } },
              { type: 'object', required: ['ids', 'padding'], properties: { ids: { type: 'array', items: str }, padding: num } },
            ],
          },
          draw: {
            oneOf: [
              shader,
              { type: 'object', required: ['kind', 'effect', 'motion', 'holdMs'], properties: { kind: { const: 'vector' }, effect: str, motion: { type: 'object', required: ['svg'] }, holdMs: num } },
              { type: 'object', required: ['kind'], properties: { kind: { const: 'picture' } } },
            ],
          },
          subject,
          tracks: { type: 'array', items: { type: 'object', required: ['ms', 'values'], properties: { ms: num, values: { type: 'object', additionalProperties: num } } } },
        },
      },
    },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['shot', 'startMs', 'ms', 'draw', 'controls'],
        properties: {
          shot: { type: 'integer' },
          startMs: num,
          ms: num,
          draw: shader,
          controls: { type: 'object', required: ['from', 'to', 'progress', 'animate'], properties: { from: str, to: str, progress: str, animate: str } },
        },
      },
    },
    notes: { type: 'array', items: str },
  },
} as const;
