import type { SceneElement } from './geometry.js';

export type ReplicatorPattern = 'grid' | 'line' | 'circle' | 'spiral';

export interface ReplicatorSequence {
  /** Property to modulate per item. */
  property?: 'opacity' | 'rotation' | 'scale' | 'x' | 'y';
  /** Incremental offset or delta added per instance. */
  offset?: number;
  /** Milliseconds delay per instance for staggered triggers. */
  delayPerItem?: number;
}

export interface ReplicatorConfig {
  pattern: ReplicatorPattern;
  count: number;
  /** Origin point [x, y] to anchor the layout (defaults to prototype.x, prototype.y). */
  origin?: [number, number];

  // Grid options
  columns?: number;
  rows?: number;
  columnSpacing?: number;
  rowSpacing?: number;

  // Line options
  startPoint?: [number, number];
  endPoint?: [number, number];
  spacing?: number;

  // Circle / Spiral options
  radius?: number;
  startAngle?: number; // radians
  spiralTightness?: number; // radius expansion per instance

  // Sequence modulation
  sequence?: ReplicatorSequence;
}

/**
 * Procedurally replicates a prototype SceneElement into an array of positioned
 * and sequenced instances (grid, circular array, line, or spiral).
 */
export function expandReplicator(
  prototype: SceneElement,
  config: ReplicatorConfig,
): SceneElement[] {
  const count = Math.max(0, Math.floor(config.count));
  if (count === 0) return [];

  const originX = config.origin ? config.origin[0] : prototype.x;
  const originY = config.origin ? config.origin[1] : prototype.y;
  const elements: SceneElement[] = [];

  for (let i = 0; i < count; i++) {
    const el: SceneElement = {
      ...prototype,
      id: `${prototype.id}_${i}`,
    };

    let px = originX;
    let py = originY;

    switch (config.pattern) {
      case 'grid': {
        const cols = config.columns ?? Math.ceil(Math.sqrt(count));
        const colSpacing = config.columnSpacing ?? (prototype.width + 20);
        const rowSpacing = config.rowSpacing ?? (prototype.height + 20);
        const col = i % cols;
        const row = Math.floor(i / cols);
        px = originX + col * colSpacing;
        py = originY + row * rowSpacing;
        break;
      }

      case 'line': {
        if (config.startPoint && config.endPoint) {
          const t = count > 1 ? i / (count - 1) : 0;
          px = config.startPoint[0] + (config.endPoint[0] - config.startPoint[0]) * t;
          py = config.startPoint[1] + (config.endPoint[1] - config.startPoint[1]) * t;
        } else {
          const spacing = config.spacing ?? (prototype.width + 20);
          px = originX + i * spacing;
          py = originY;
        }
        break;
      }

      case 'circle': {
        const radius = config.radius ?? 150;
        const angleStep = (2 * Math.PI) / count;
        const angle = (config.startAngle ?? 0) + i * angleStep;
        px = originX + radius * Math.cos(angle);
        py = originY + radius * Math.sin(angle);
        break;
      }

      case 'spiral': {
        const baseRadius = config.radius ?? 40;
        const tightness = config.spiralTightness ?? 12;
        const angleStep = Math.PI / 4; // 45 degrees per step
        const angle = (config.startAngle ?? 0) + i * angleStep;
        const r = baseRadius + tightness * i;
        px = originX + r * Math.cos(angle);
        py = originY + r * Math.sin(angle);
        break;
      }
    }

    el.x = px;
    el.y = py;

    // Apply sequence property modulation
    if (config.sequence && config.sequence.offset !== undefined) {
      const { property, offset } = config.sequence;
      if (property === 'opacity') {
        const base = prototype.opacity ?? 1.0;
        el.opacity = Math.max(0, Math.min(1, base + i * offset));
      } else if (property === 'rotation') {
        const base = (prototype as any).rotation ?? 0;
        (el as any).rotation = base + i * offset;
      } else if (property === 'scale') {
        const factor = 1 + i * offset;
        el.width = Math.max(1, prototype.width * factor);
        el.height = Math.max(1, prototype.height * factor);
      } else if (property === 'x') {
        el.x += i * offset;
      } else if (property === 'y') {
        el.y += i * offset;
      }
    }

    elements.push(el);
  }

  return elements;
}
