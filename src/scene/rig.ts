import type { Scene } from './types.js';

export interface SliderSnapshot {
  at: number;
  values: Record<string, number | string>;
}

export interface SliderWidget {
  type: 'slider';
  name: string;
  value: number;
  snapshots: SliderSnapshot[];
}

export interface PopupWidget {
  type: 'popup';
  name: string;
  selected: string;
  options: Record<string, Record<string, number | string>>;
}

export interface ToggleWidget {
  type: 'toggle';
  name: string;
  enabled: boolean;
  on: Record<string, number | string>;
  off: Record<string, number | string>;
}

export type RigWidget = SliderWidget | PopupWidget | ToggleWidget;

export interface SceneRig {
  widgets: Record<string, RigWidget>;
}

/**
 * Updates a widget within a SceneRig and returns the updated SceneRig.
 */
export function setRigWidget(
  rig: SceneRig,
  widgetName: string,
  value: number | string | boolean,
): SceneRig {
  const widget = rig.widgets[widgetName];
  if (!widget) {
    throw new Error(`Rig widget "${widgetName}" not found.`);
  }

  const updatedWidgets = { ...rig.widgets };

  if (widget.type === 'slider') {
    if (typeof value !== 'number') {
      throw new Error(`Slider widget "${widgetName}" expects numeric value.`);
    }
    updatedWidgets[widgetName] = { ...widget, value };
  } else if (widget.type === 'popup') {
    if (typeof value !== 'string') {
      throw new Error(`Popup widget "${widgetName}" expects string value.`);
    }
    updatedWidgets[widgetName] = { ...widget, selected: value };
  } else if (widget.type === 'toggle') {
    if (typeof value !== 'boolean') {
      throw new Error(`Toggle widget "${widgetName}" expects boolean value.`);
    }
    updatedWidgets[widgetName] = { ...widget, enabled: value };
  }

  return { widgets: updatedWidgets };
}

/**
 * Evaluates resolved values for a given widget.
 */
function resolveWidgetValues(widget: RigWidget): Record<string, number | string> {
  if (widget.type === 'popup') {
    return widget.options[widget.selected] ?? {};
  }

  if (widget.type === 'toggle') {
    return widget.enabled ? widget.on : widget.off;
  }

  if (widget.type === 'slider') {
    const { snapshots, value } = widget;
    if (!snapshots || snapshots.length === 0) return {};

    const sorted = [...snapshots].sort((a, b) => a.at - b.at);
    if (value <= sorted[0]!.at) {
      return { ...sorted[0]!.values };
    }
    if (value >= sorted[sorted.length - 1]!.at) {
      return { ...sorted[sorted.length - 1]!.values };
    }

    // Find bounding snapshots
    let idx = 0;
    while (idx < sorted.length - 1 && sorted[idx + 1]!.at < value) {
      idx++;
    }

    const s0 = sorted[idx]!;
    const s1 = sorted[idx + 1]!;
    const span = s1.at - s0.at;
    const t = span > 0 ? (value - s0.at) / span : 0;

    const result: Record<string, number | string> = {};
    const allKeys = new Set([...Object.keys(s0.values), ...Object.keys(s1.values)]);

    for (const k of allKeys) {
      const v0 = s0.values[k];
      const v1 = s1.values[k];
      if (typeof v0 === 'number' && typeof v1 === 'number') {
        result[k] = v0 + (v1 - v0) * t;
      } else if (v0 !== undefined && v1 !== undefined) {
        result[k] = t < 0.5 ? v0 : v1;
      } else {
        result[k] = v1 !== undefined ? v1 : (v0 as number | string);
      }
    }

    return result;
  }

  return {};
}

/**
 * Propagates rig widget state into the scene's shader uniforms and elements.
 */
export function applyRig(rig: SceneRig, scene: Scene): Scene {
  // Deep clone media and shots to prevent mutation
  const nextMedia: Record<string, any> = {};
  if (scene.media) {
    for (const [id, m] of Object.entries(scene.media)) {
      nextMedia[id] = {
        ...m,
        values: { ...(m.values ?? {}) },
      };
    }
  }

  const nextShots = scene.shots.map((shot) => {
    if (!shot.run) return { ...shot };
    return {
      ...shot,
      run: shot.run.map((cmd) => {
        if (cmd.type === 'element' && 'element' in cmd && cmd.element) {
          return { ...cmd, element: { ...cmd.element } };
        }
        if (cmd.type === 'update' && 'props' in cmd && (cmd as any).props) {
          return { ...cmd, props: { ...(cmd as any).props } };
        }
        return { ...cmd };
      }),
    };
  });

  // Collect all resolved values across all widgets in the rig
  const resolvedAll: Record<string, number | string> = {};
  for (const widget of Object.values(rig.widgets)) {
    Object.assign(resolvedAll, resolveWidgetValues(widget));
  }

  // Apply resolved values
  for (const [targetKey, val] of Object.entries(resolvedAll)) {
    if (targetKey.startsWith('media.')) {
      const parts = targetKey.split('.');
      const mediaId = parts[1]!;
      const prop = parts.length > 3 && parts[2] === 'values' ? parts[3]! : parts[2]!;
      if (nextMedia[mediaId]) {
        nextMedia[mediaId].values[prop] = val;
      }
    } else if (targetKey.startsWith('element.')) {
      const parts = targetKey.split('.');
      const elId = parts[1]!;
      const prop = parts[2]!;
      for (const shot of nextShots) {
        if (shot.run) {
          for (const cmd of shot.run) {
            if (cmd.type === 'element' && 'element' in cmd && (cmd as any).element?.id === elId) {
              (cmd.element as any)[prop] = val;
            } else if (cmd.type === 'update' && 'id' in cmd && cmd.id === elId) {
              (cmd as any).props[prop] = val;
            }
          }
        }
      }
    } else {
      // General uniform shorthand: uniforms.<name> or simply <name>
      const uniformName = targetKey.replace(/^uniforms\./, '');
      for (const m of Object.values(nextMedia)) {
        m.values[uniformName] = val;
      }
    }
  }

  return {
    ...scene,
    media: Object.keys(nextMedia).length > 0 ? nextMedia : scene.media,
    shots: nextShots,
    rig,
  };
}
