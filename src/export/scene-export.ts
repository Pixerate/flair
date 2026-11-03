import type { Scene } from '../scene/types.js';
import { exportLottie } from './lottie.js';
import { exportMotn } from './motn.js';
import { exportCmx3600Edl, exportFcp7Xml } from './interchange.js';
import { exportTextTemplate, type TextTemplate } from './text-template.js';
import { SCENE_EXPORT_FORMATS, sceneExportNotes, type SceneExportFormat } from './notes.js';

export interface SceneExportOptions {
  /** Frames per second, 1 to 240. Default: 30 */
  frameRate?: number;
  /** The EDL's reel name. Default: `AX` */
  reel?: string;
}

/** A scene exported to a file's worth of text, with what it left out. */
export interface SceneExport {
  format: SceneExportFormat;
  /** The file's contents (JSON for `lottie` and `text-template`, XML for `motn` and `fcp7`). */
  content: string;
  /** The file's usual extension, without the dot. */
  extension: string;
  mediaType: string;
  /** What the format leaves out of the scene, or carries only in part (see `sceneExportNotes`). */
  notes: string[];
  /** For `text-template`: the template itself. */
  template?: TextTemplate;
}

const FILES: Record<SceneExportFormat, { extension: string; mediaType: string }> = {
  lottie: { extension: 'json', mediaType: 'application/json' },
  motn: { extension: 'motn', mediaType: 'application/xml' },
  fcp7: { extension: 'xml', mediaType: 'application/xml' },
  edl: { extension: 'edl', mediaType: 'text/plain' },
  'text-template': { extension: 'json', mediaType: 'application/json' },
};

/**
 * Exports a scene to any of {@link SCENE_EXPORT_FORMATS}, as `flair scene
 * export` and the `export_scene` agent tool do. Throws, saying what to give
 * instead, for an unknown format or a frame rate out of range.
 */
export async function exportScene(scene: Scene, format: SceneExportFormat, options: SceneExportOptions = {}): Promise<SceneExport> {
  if (!SCENE_EXPORT_FORMATS.includes(format)) throw new Error(`There is no export format "${format}"; the formats are ${SCENE_EXPORT_FORMATS.join(', ')}.`);
  const frameRate = options.frameRate ?? 30;
  if (!Number.isFinite(frameRate) || frameRate < 1 || frameRate > 240) throw new Error(`The frame rate is ${frameRate}; give 1 to 240 frames per second.`);
  const file = { format, ...FILES[format] };
  if (format === 'text-template') {
    const template = await exportTextTemplate(scene, { frameRate });
    return { ...file, content: JSON.stringify(template, null, 2), notes: template.notes, template };
  }
  const content =
    format === 'lottie'
      ? JSON.stringify(exportLottie(scene, { frameRate }), null, 2)
      : format === 'motn'
        ? exportMotn(scene, { frameRate })
        : format === 'fcp7'
          ? exportFcp7Xml(scene, { frameRate })
          : exportCmx3600Edl(scene, { frameRate, ...(options.reel !== undefined ? { reel: options.reel } : {}) });
  return { ...file, content, notes: sceneExportNotes(scene, format) };
}
