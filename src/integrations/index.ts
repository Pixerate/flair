/**
 * `@pixerate/flair/integrations`: Flair inside other tools.
 *
 * - `flairEffects()`: Flair's catalog and motion primitives as an effects
 *   provider for `@pixerate/editor`'s editors (its `@pixerate/editor/effects`
 *   contract), camera moves included. Needs `@pixerate/editor` 0.224 or
 *   later (an optional peer) for its `/effects` subpath (0.148 without
 *   camera moves: pass `kinds` without `camera`); opening an authoring
 *   session also loads Flair's `EffectEditor`, with the editor subpaths it
 *   uses.
 *
 * @packageDocumentation
 */

export { ENDLESS_PLAY_MS, flairEffects, FLAIR_PROVIDER_ID, type FlairEffectsOptions, type SvgRasterizer } from "./effects.js";
