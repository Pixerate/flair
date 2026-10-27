/**
 * `@pixerate/flair/integrations`: Flair inside other tools.
 *
 * - `flairEffects()`: Flair's catalog and motion primitives as an effects
 *   provider for `@pixerate/editor`'s editors (its `@pixerate/editor/effects`
 *   contract). Needs `@pixerate/editor` 0.148 or later (an optional peer)
 *   for its `/effects` subpath; opening an authoring session also loads
 *   Flair's `EffectEditor`, with the editor subpaths it uses.
 *
 * @packageDocumentation
 */

export { flairEffects, FLAIR_PROVIDER_ID, type FlairEffectsOptions, type SvgRasterizer } from "./effects.js";
