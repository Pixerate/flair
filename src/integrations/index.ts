/**
 * `@pixerate/flair/integrations`: Flair inside other tools.
 *
 * - `flairEffects()`: Flair's catalog and motion primitives as an effects
 *   provider for `@pixerate/editor`'s editors (its `@pixerate/editor/effects`
 *   contract). Needs `@pixerate/editor` with the `/effects` subpath (an
 *   optional peer); nothing else from it.
 *
 * @packageDocumentation
 */

export { flairEffects, FLAIR_PROVIDER_ID, type FlairEffectsOptions, type SvgRasterizer } from "./effects.js";
