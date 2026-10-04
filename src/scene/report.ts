import type { ShotCheck } from './check.js';
import type { Scene } from './types.js';

export interface ShotLog extends ShotCheck {
  index: number;
  start: number;
  drawn: number;
  end: number;
  caption?: string;
  title?: string;
  failed: string[];
  effects?: string[];
}

export interface ReviewOptions {
  target?: [number, number];
  minTextPx?: number;
}

export interface Review {
  totalMs: number;
  warnings: string[];
  notes: string[];
  markdown: string;
}

/** Formats a structured diagnostic report of scene playback. */
export function reviewScene(scene: Scene, logs: readonly ShotLog[], options: ReviewOptions = {}): Review {
  const warnings: string[] = [];
  const notes: string[] = [];
  const minTextPx = options.minTextPx ?? 18;
  const totalMs = logs.length > 0 ? logs[logs.length - 1]!.end : 0;
  const totalSec = (totalMs / 1000).toFixed(1);

  if (scene.target) {
    const [minS, maxS] = scene.target;
    const durS = totalMs / 1000;
    if (durS < minS) {
      warnings.push(`Scene is ${totalSec}s, shorter than target minimum (${minS}s).`);
    } else if (durS > maxS) {
      warnings.push(`Scene is ${totalSec}s, longer than target maximum (${maxS}s).`);
    }
  }

  for (const log of logs) {
    const shotPrefix = `Shot ${log.index}:`;

    if (log.failed.length > 0) {
      warnings.push(`${shotPrefix} ${log.failed.length} command(s) failed: ${log.failed.join(', ')}`);
    }

    for (const f of log.framing) {
      warnings.push(`${shotPrefix} element "${f.id}" is ${f.how} of the camera frame.`);
    }

    for (const [a, b] of log.overlaps) {
      notes.push(`${shotPrefix} elements "${a}" and "${b}" overlap significantly.`);
    }

    if (log.smallTexts) {
      for (const t of log.smallTexts) {
        if (t.px < minTextPx) {
          warnings.push(`${shotPrefix} text "${t.text}" is only ${t.px}px on screen (less than ${minTextPx}px minimum).`);
        }
      }
    }

    for (const id of log.underTitle) {
      warnings.push(`${shotPrefix} element "${id}" is partially covered by the title bar.`);
    }
  }

  // Generate markdown
  const lines: string[] = [
    `# Scene Preview Review: ${scene.title || scene.name}`,
    `**Total Duration:** ${totalSec}s (${logs.length} shots)`,
    '',
  ];

  if (warnings.length > 0) {
    lines.push('### ⚠️ Warnings to Address:');
    for (const w of warnings) lines.push(`- ${w}`);
    lines.push('');
  } else {
    lines.push('✅ No critical layout or framing warnings.');
    lines.push('');
  }

  if (notes.length > 0) {
    lines.push('### ℹ️ Layout Notes:');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('### Shot Breakdown');
  lines.push('| Shot | Start | End | Duration | Title / Caption |');
  lines.push('|:---:|:---:|:---:|:---:|:---|');
  for (const log of logs) {
    const dur = ((log.end - log.start) / 1000).toFixed(1);
    const text = log.title || log.caption || '—';
    lines.push(`| ${log.index} | ${(log.start / 1000).toFixed(1)}s | ${(log.end / 1000).toFixed(1)}s | ${dur}s | ${text.slice(0, 40)} |`);
  }

  return {
    totalMs,
    warnings,
    notes,
    markdown: lines.join('\n'),
  };
}
