import type { Scene, Shot } from '../scene/types.js';
import { DEFAULT_STAGE, CAMERA_MS } from '../scene/camera.js';
import { isElementCommand } from '../scene/types.js';

export interface MotnExportOptions {
  frameRate?: number;
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
 * Serializes a Flair Scene into Apple Motion ozml 4.0 XML document format (.motn).
 */
export function exportMotn(scene: Scene, options: MotnExportOptions = {}): string {
  const frameRate = options.frameRate ?? 30;
  const width = scene.stage?.width ?? DEFAULT_STAGE.width;
  const height = scene.stage?.height ?? DEFAULT_STAGE.height;

  // Calculate shot frame ranges
  let currentMs = 0;
  const shotTimings = scene.shots.map((shot, idx) => {
    const camMs = idx > 0 && shot.camera ? CAMERA_MS : 0;
    const holdMs = shot.hold ?? 800;
    const durationMs = camMs + holdMs;
    const startMs = currentMs;
    currentMs += durationMs;

    const startFrame = Math.round((startMs / 1000) * frameRate);
    const durationFrames = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    const endFrame = startFrame + durationFrames - 1;

    return {
      shot,
      startFrame,
      durationFrames,
      endFrame,
    };
  });

  const totalFrames = Math.max(1, Math.round((currentMs / 1000) * frameRate));

  let nodeId = 10000;
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE ozxmlscene>');
  lines.push('<ozml version="4.0">');
  if (scene.name) {
    lines.push(`  <!-- Scene: ${escapeXml(scene.name)} -->`);
  }
  lines.push('');
  lines.push('  <displayversion>5.0</displayversion>');
  lines.push('');
  lines.push('  <factory id="1" uuid="044beba5ad3211d7ac9b000393833f6a">');
  lines.push('    <description>Style</description>');
  lines.push('    <manufacturer>Apple</manufacturer>');
  lines.push('    <version>1</version>');
  lines.push('  </factory>');
  lines.push('  <factory id="2" uuid="babfc7777f4711d7aaa7000393833f6a">');
  lines.push('    <description>Text</description>');
  lines.push('    <manufacturer>Apple</manufacturer>');
  lines.push('    <version>1</version>');
  lines.push('  </factory>');
  lines.push('  <factory id="3" uuid="712462a4323911d78f8400039389b702">');
  lines.push('    <description>Shape</description>');
  lines.push('    <manufacturer>Apple</manufacturer>');
  lines.push('    <version>1</version>');
  lines.push('  </factory>');
  lines.push('  <factory id="4" uuid="65cb4dc9d4504fa281921f5f751fba06">');
  lines.push('    <description>Widget</description>');
  lines.push('    <manufacturer>Apple</manufacturer>');
  lines.push('    <version>1</version>');
  lines.push('  </factory>');
  lines.push('');
  lines.push('  <scene>');
  lines.push('    <sceneSettings>');
  lines.push(`      <width>${width}</width>`);
  lines.push(`      <height>${height}</height>`);
  lines.push(`      <duration>${totalFrames}</duration>`);
  lines.push(`      <frameRate>${frameRate}</frameRate>`);
  lines.push('      <NTSC>0</NTSC>');
  lines.push('      <channels>4</channels>');
  lines.push('      <channelDepth>8</channelDepth>');
  lines.push('      <pixelAspectRatio>1</pixelAspectRatio>');
  lines.push('      <backgroundColor red="0" green="0" blue="0" alpha="1"/>');
  lines.push('    </sceneSettings>');
  lines.push('    <currentFrame>0</currentFrame>');
  lines.push(`    <timeRange offset="0" duration="${totalFrames}"/>`);
  lines.push(`    <playRange offset="0" duration="${totalFrames}"/>`);
  lines.push('    <flags>1</flags>');

  // Rig widget export if defined
  if (scene.rig && Object.keys(scene.rig.widgets).length > 0) {
    lines.push(`    <scenenode name="Rigs" id="${nodeId++}" factoryID="4" version="1">`);
    for (const [widgetName, widget] of Object.entries(scene.rig.widgets)) {
      lines.push(`      <scenenode name="${escapeXml(widgetName)}" id="${nodeId++}" factoryID="4" version="1">`);
      lines.push('        <parameter name="Object" id="2">');
      if (widget.type === 'slider') {
        lines.push(`          <parameter name="Widget" id="100" default="0" value="${widget.value}"/>`);
      } else if (widget.type === 'toggle') {
        lines.push(`          <parameter name="Widget" id="100" default="0" value="${widget.enabled ? 1 : 0}"/>`);
      } else if (widget.type === 'popup') {
        lines.push(`          <parameter name="Widget" id="100" default="0" value="${escapeXml(widget.selected)}"/>`);
      }
      lines.push('        </parameter>');
      lines.push('      </scenenode>');
    }
    lines.push('    </scenenode>');
  }

  // Groups and element nodes per shot
  for (const [idx, item] of shotTimings.entries()) {
    const shotLabel = item.shot.title
      ? `Shot ${idx + 1}: ${escapeXml(item.shot.title)}`
      : `Shot ${idx + 1}`;
    lines.push(`    <group name="${shotLabel}" id="${nodeId++}">`);
    lines.push(`      <timing in="${item.startFrame}" out="${item.endFrame}" offset="${item.startFrame}"/>`);

    if (item.shot.run) {
      for (const cmd of item.shot.run) {
        if (isElementCommand(cmd) && cmd.element) {
          const el = cmd.element;
          const isText = el.type === 'text';
          const factoryId = isText ? 2 : 3;
          lines.push(`      <scenenode name="${escapeXml(el.id)}" id="${nodeId++}" factoryID="${factoryId}" version="1">`);
          lines.push(`        <timing in="${item.startFrame}" out="${item.endFrame}" offset="${item.startFrame}"/>`);
          lines.push('        <parameter name="Properties" id="1">');
          lines.push('          <parameter name="Transform" id="100">');
          lines.push('            <parameter name="Position" id="101">');
          lines.push(`              <parameter name="X" id="1" value="${el.x}"/>`);
          lines.push(`              <parameter name="Y" id="2" value="${-el.y}"/>`);
          lines.push('            </parameter>');
          if (!isText) {
            lines.push('            <parameter name="Scale" id="102">');
            lines.push(`              <parameter name="X" id="1" value="${el.width}"/>`);
            lines.push(`              <parameter name="Y" id="2" value="${el.height}"/>`);
            lines.push('            </parameter>');
          }
          lines.push('          </parameter>');
          lines.push('        </parameter>');

          if (isText && el.text) {
            lines.push(`        <text>${escapeXml(el.text)}</text>`);
          }
          lines.push('      </scenenode>');
        }
      }
    }

    lines.push('    </group>');
  }

  lines.push('  </scene>');
  lines.push('</ozml>');
  lines.push('');

  return lines.join('\n');
}
