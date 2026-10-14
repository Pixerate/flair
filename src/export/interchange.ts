import type { Scene, Shot } from '../scene/types.js';
import { DEFAULT_STAGE, CAMERA_MS } from '../scene/camera.js';

export interface Fcp7ExportOptions {
  /** Timeline timebase / frame rate (default 30). */
  frameRate?: number;
  /** NTSC flag (default false, or true if 29.97 / 59.94). */
  ntsc?: boolean;
  /** Starting timecode (default "00:00:00:00"). */
  timecodeStart?: string;
  /** Sequence name override. */
  sequenceName?: string;
  /** Media path prefix or file base URL (default "file://localhost/media/"). */
  mediaPathPrefix?: string;
  /** Include text generator overlay track for titles/captions (default true). */
  includeTextTrack?: boolean;
  /** Include timeline sequence markers (default true). */
  includeMarkers?: boolean;
}

export interface EdlExportOptions {
  /** Timeline timebase / frame rate (default 30). */
  frameRate?: number;
  /** Drop frame flag (default false). */
  dropFrame?: boolean;
  /** Starting timecode (default "01:00:00:00" as per standard broadcast EDL practice). */
  timecodeStart?: string;
  /** Reel name identifier (default "AX", max 8 chars). */
  reel?: string;
}

export interface ShotTiming {
  shot: Shot;
  index: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  startMs: number;
  durationMs: number;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculates start and duration frame boundaries for each shot in a scene.
 */
export function calculateShotTimings(scene: Scene, frameRate: number = 30): ShotTiming[] {
  let currentMs = 0;
  return scene.shots.map((shot, index) => {
    const camMs = index > 0 && shot.camera ? CAMERA_MS : 0;
    const holdMs = shot.hold ?? 800;
    const durationMs = camMs + holdMs;
    const startMs = currentMs;
    currentMs += durationMs;

    const startFrame = Math.round((startMs / 1000) * frameRate);
    const durationFrames = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    const endFrame = startFrame + durationFrames;

    return {
      shot,
      index,
      startFrame,
      endFrame,
      durationFrames,
      startMs,
      durationMs,
    };
  });
}

/**
 * Converts frame count to standard SMPTE timecode HH:MM:SS:FF.
 */
export function framesToTimecode(
  frame: number,
  timebase: number = 30,
  dropFrame: boolean = false
): string {
  const roundedFps = Math.round(timebase);
  let totalFrames = Math.max(0, Math.floor(frame));

  if (dropFrame && (roundedFps === 30 || roundedFps === 29)) {
    // 29.97 DF: drop frames 0 and 1 at the start of every minute except minutes 0, 10, 20, 30, 40, 50
    const dropFramesPer10Mins = 18;
    const framesPer10Mins = 17982; // 10 * 60 * 30 - 18
    const framesPerMinute = 1798; // 60 * 30 - 2

    const d = Math.floor(totalFrames / framesPer10Mins);
    const m = totalFrames % framesPer10Mins;

    if (m >= 2) {
      totalFrames += dropFramesPer10Mins * d + 2 * Math.floor((m - 2) / framesPerMinute);
    } else {
      totalFrames += dropFramesPer10Mins * d;
    }
  }

  const ff = totalFrames % roundedFps;
  const totalSeconds = Math.floor(totalFrames / roundedFps);
  const ss = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;
  const hh = Math.floor(totalMinutes / 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const separator = dropFrame ? ';' : ':';
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${separator}${pad(ff)}`;
}

/**
 * Converts standard SMPTE timecode HH:MM:SS:FF to frame count.
 */
export function timecodeToFrames(
  timecode: string,
  timebase: number = 30,
  dropFrame: boolean = false
): number {
  const parts = timecode.split(/[:;]/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return 0;
  }
  const [hh, mm, ss, ff] = parts;
  const roundedFps = Math.round(timebase);

  if (dropFrame && (roundedFps === 30 || roundedFps === 29)) {
    const totalMinutes = hh * 60 + mm;
    const dropCount = (totalMinutes - Math.floor(totalMinutes / 10)) * 2;
    return ((hh * 3600 + mm * 60 + ss) * roundedFps + ff) - dropCount;
  }

  return (hh * 3600 + mm * 60 + ss) * roundedFps + ff;
}

/**
 * Serializes a Flair Scene into Apple Final Cut Pro 7 XML Interchange Format (xmeml v4).
 * Compatible with Premiere Pro, DaVinci Resolve, and Final Cut Pro.
 */
export function exportFcp7Xml(scene: Scene, options: Fcp7ExportOptions = {}): string {
  const frameRate = options.frameRate ?? 30;
  const timebase = Math.round(frameRate);
  const ntsc = options.ntsc ?? (Math.abs(frameRate - 29.97) < 0.05 || Math.abs(frameRate - 59.94) < 0.05);
  const ntscStr = ntsc ? 'TRUE' : 'FALSE';
  const width = scene.stage?.width ?? DEFAULT_STAGE.width;
  const height = scene.stage?.height ?? DEFAULT_STAGE.height;
  const sequenceName = options.sequenceName ?? scene.name ?? 'Flair Sequence';
  const timecodeStart = options.timecodeStart ?? '00:00:00:00';
  const mediaPrefix = options.mediaPathPrefix ?? 'file://localhost/media/';
  const includeTextTrack = options.includeTextTrack ?? true;
  const includeMarkers = options.includeMarkers ?? true;

  const timings = calculateShotTimings(scene, frameRate);
  const totalFrames = timings.length > 0 ? timings[timings.length - 1].endFrame : 0;
  const startFrameOffset = timecodeToFrames(timecodeStart, frameRate);

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE xmeml>');
  lines.push('<xmeml version="4">');
  lines.push(`  <sequence id="sequence-1">`);
  lines.push(`    <name>${escapeXml(sequenceName)}</name>`);
  lines.push(`    <duration>${totalFrames}</duration>`);
  lines.push('    <rate>');
  lines.push(`      <timebase>${timebase}</timebase>`);
  lines.push(`      <ntsc>${ntscStr}</ntsc>`);
  lines.push('    </rate>');
  lines.push('    <timecode>');
  lines.push('      <rate>');
  lines.push(`        <timebase>${timebase}</timebase>`);
  lines.push(`        <ntsc>${ntscStr}</ntsc>`);
  lines.push('      </rate>');
  lines.push(`      <string>${timecodeStart}</string>`);
  lines.push(`      <frame>${startFrameOffset}</frame>`);
  lines.push('      <displayformat>NDF</displayformat>');
  lines.push('    </timecode>');

  // Sequence Timeline Markers
  if (includeMarkers) {
    timings.forEach(({ shot, index, startFrame, endFrame }) => {
      const name = shot.title || `Shot ${index + 1}`;
      const comment = shot.caption || '';
      lines.push('    <marker>');
      lines.push(`      <name>${escapeXml(name)}</name>`);
      lines.push(`      <comment>${escapeXml(comment)}</comment>`);
      lines.push(`      <in>${startFrame}</in>`);
      lines.push(`      <out>${endFrame}</out>`);
      lines.push('    </marker>');
    });
  }

  lines.push('    <media>');
  lines.push('      <video>');
  lines.push('        <format>');
  lines.push('          <samplecharacteristics>');
  lines.push(`            <width>${width}</width>`);
  lines.push(`            <height>${height}</height>`);
  lines.push('            <pixelaspectratio>square</pixelaspectratio>');
  lines.push('            <rate>');
  lines.push(`              <timebase>${timebase}</timebase>`);
  lines.push(`              <ntsc>${ntscStr}</ntsc>`);
  lines.push('            </rate>');
  lines.push('          </samplecharacteristics>');
  lines.push('        </format>');

  // Video Track 1: Base Shot Clips
  lines.push('        <track>');
  lines.push('          <enabled>TRUE</enabled>');
  lines.push('          <locked>FALSE</locked>');

  timings.forEach(({ shot, index, startFrame, endFrame, durationFrames }) => {
    const shotName = shot.title || `Shot_${index + 1}`;
    const fileId = `file-${index + 1}`;
    const clipId = `clipitem-${index + 1}`;
    const fileName = `${shotName.replace(/[^a-zA-Z0-9_-]/g, '_')}.mov`;
    const fileUrl = `${mediaPrefix.replace(/\/+$/, '')}/${fileName}`;

    lines.push(`          <clipitem id="${clipId}">`);
    lines.push(`            <name>${escapeXml(shotName)}</name>`);
    lines.push(`            <duration>${durationFrames}</duration>`);
    lines.push('            <rate>');
    lines.push(`              <timebase>${timebase}</timebase>`);
    lines.push(`              <ntsc>${ntscStr}</ntsc>`);
    lines.push('            </rate>');
    lines.push(`            <start>${startFrame}</start>`);
    lines.push(`            <end>${endFrame}</end>`);
    lines.push('            <in>0</in>');
    lines.push(`            <out>${durationFrames}</out>`);

    // File element
    lines.push(`            <file id="${fileId}">`);
    lines.push(`              <name>${escapeXml(fileName)}</name>`);
    lines.push(`              <pathurl>${escapeXml(fileUrl)}</pathurl>`);
    lines.push('              <rate>');
    lines.push(`                <timebase>${timebase}</timebase>`);
    lines.push(`                <ntsc>${ntscStr}</ntsc>`);
    lines.push('              </rate>');
    lines.push(`              <duration>${durationFrames}</duration>`);
    lines.push('              <timecode>');
    lines.push('                <rate>');
    lines.push(`                  <timebase>${timebase}</timebase>`);
    lines.push(`                  <ntsc>${ntscStr}</ntsc>`);
    lines.push('                </rate>');
    lines.push('                <string>00:00:00:00</string>');
    lines.push('                <frame>0</frame>');
    lines.push('                <displayformat>NDF</displayformat>');
    lines.push('              </timecode>');
    lines.push('              <media>');
    lines.push('                <video>');
    lines.push('                  <samplecharacteristics>');
    lines.push(`                    <width>${width}</width>`);
    lines.push(`                    <height>${height}</height>`);
    lines.push('                  </samplecharacteristics>');
    lines.push('                </video>');
    lines.push('              </media>');
    lines.push('            </file>');

    // Clip marker if caption is present
    if (shot.caption) {
      lines.push('            <marker>');
      lines.push(`              <name>${escapeXml(shotName)} Narration</name>`);
      lines.push(`              <comment>${escapeXml(shot.caption)}</comment>`);
      lines.push('              <in>0</in>');
      lines.push(`              <out>${durationFrames}</out>`);
      lines.push('            </marker>');
    }

    // Basic Motion Filter
    lines.push('            <filter>');
    lines.push('              <effect>');
    lines.push('                <name>Basic Motion</name>');
    lines.push('                <effectid>basic</effectid>');
    lines.push('                <effectcategory>motion</effectcategory>');
    lines.push('                <effecttype>motion</effecttype>');
    lines.push('                <mediatype>video</mediatype>');
    lines.push('                <parameter>');
    lines.push('                  <parameterid>scale</parameterid>');
    lines.push('                  <name>Scale</name>');
    lines.push('                  <value>100</value>');
    lines.push('                </parameter>');
    lines.push('              </effect>');
    lines.push('            </filter>');
    lines.push('          </clipitem>');
  });

  lines.push('        </track>');

  // Video Track 2: Title / Narration Overlay Track (Generators)
  const hasTextOverlays = timings.some((t) => t.shot.title || t.shot.caption);
  if (includeTextTrack && hasTextOverlays) {
    lines.push('        <track>');
    lines.push('          <enabled>TRUE</enabled>');
    lines.push('          <locked>FALSE</locked>');

    timings.forEach(({ shot, index, startFrame, endFrame, durationFrames }) => {
      const text = shot.title ?? shot.caption;
      if (!text) return;

      const generatorId = `generator-title-${index + 1}`;
      lines.push(`          <clipitem id="${generatorId}">`);
      lines.push(`            <name>${escapeXml(text)}</name>`);
      lines.push(`            <duration>${durationFrames}</duration>`);
      lines.push('            <rate>');
      lines.push(`              <timebase>${timebase}</timebase>`);
      lines.push(`              <ntsc>${ntscStr}</ntsc>`);
      lines.push('            </rate>');
      lines.push(`            <start>${startFrame}</start>`);
      lines.push(`            <end>${endFrame}</end>`);
      lines.push('            <in>0</in>');
      lines.push(`            <out>${durationFrames}</out>`);
      lines.push('            <effect>');
      lines.push('              <name>Text</name>');
      lines.push('              <effectid>Text</effectid>');
      lines.push('              <effectcategory>Text</effectcategory>');
      lines.push('              <effecttype>generator</effecttype>');
      lines.push('              <mediatype>video</mediatype>');
      lines.push('              <parameter>');
      lines.push('                <parameterid>str</parameterid>');
      lines.push('                <name>Text</name>');
      lines.push(`                <value>${escapeXml(text)}</value>`);
      lines.push('              </parameter>');
      lines.push('            </effect>');
      lines.push('          </clipitem>');
    });

    lines.push('        </track>');
  }

  lines.push('      </video>');
  lines.push('    </media>');
  lines.push('  </sequence>');
  lines.push('</xmeml>');

  return lines.join('\n');
}

/**
 * Serializes a Flair Scene into standard CMX 3600 Edit Decision List (EDL).
 * Fully readable by DaVinci Resolve, Premiere Pro, Avid, and Lightworks.
 */
export function exportCmx3600Edl(scene: Scene, options: EdlExportOptions = {}): string {
  const frameRate = options.frameRate ?? 30;
  const timebase = Math.round(frameRate);
  const dropFrame = options.dropFrame ?? false;
  const reel = (options.reel ?? 'AX').slice(0, 8).padEnd(8, ' ');
  const title = (scene.name ?? 'UNTITLED').toUpperCase().replace(/[^A-Z0-9_ -]/g, '');
  const startTc = options.timecodeStart ?? '01:00:00:00';

  const timings = calculateShotTimings(scene, frameRate);
  let recordFrame = timecodeToFrames(startTc, timebase, dropFrame);

  const lines: string[] = [];
  lines.push(`TITLE: ${title}`);
  lines.push(dropFrame ? 'FCM: DROP FRAME' : 'FCM: NON-DROP FRAME');
  lines.push('');

  timings.forEach(({ shot, index, durationFrames }) => {
    const eventNum = (index + 1).toString().padStart(3, '0');
    const srcInTc = '00:00:00:00';
    const srcOutTc = framesToTimecode(durationFrames, timebase, dropFrame);

    const recInTc = framesToTimecode(recordFrame, timebase, dropFrame);
    recordFrame += durationFrames;
    const recOutTc = framesToTimecode(recordFrame, timebase, dropFrame);

    // Standard CMX 3600 line format:
    // Event  Reel      Track  Transition  SourceIn     SourceOut    RecordIn     RecordOut
    lines.push(`${eventNum}  ${reel} V     C        ${srcInTc} ${srcOutTc} ${recInTc} ${recOutTc}`);

    const clipName = shot.title || `Shot ${index + 1}`;
    lines.push(`* FROM CLIP NAME: ${clipName}`);
    if (shot.caption) {
      lines.push(`* COMMENT: ${shot.caption}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
