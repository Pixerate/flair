import type { Scene, Shot } from '../scene/types.js';
import { DEFAULT_STAGE, DEFAULT_PERSPECTIVE, centreOf, isAngled, type View } from '../scene/camera.js';
import { cameraSamples, shotMoveMs, sceneStage, type CameraSample } from '../scene/cameratrack.js';
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

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** A parameter, keyframed (linear, at frames) when the samples change and static when they do not. */
function curveParameter(name: string, id: number, samples: readonly CameraSample[], value: (v: View) => number, indent: string): string[] {
  const values = samples.map((x) => r3(value(x.view)));
  if (values.every((v) => v === values[0])) return [`${indent}<parameter name="${name}" id="${id}" value="${values[0]}"/>`];
  return [
    `${indent}<parameter name="${name}" id="${id}" value="${values[0]}">`,
    `${indent}  <curve type="1" default="${values[0]}" value="${values[0]}">`,
    ...samples.map((x, i) => `${indent}    <keypoint interpolation="1"><time>${x.frame}</time><value>${values[i]}</value></keypoint>`),
    `${indent}  </curve>`,
    `${indent}</parameter>`,
  ];
}

/**
 * The scene's camera as a group the shot groups sit in: its anchor point is
 * the camera's centre, its scale the zoom and its rotations the angle
 * (Motion's y points up, so tilt and roll turn the other way), keyframed
 * every other frame through each move. The perspective distance and each
 * move's motion blur are noted in comments: set them on a Motion camera and
 * in the render settings.
 */
function cameraGroupOpen(scene: Scene, frameRate: number, totalFrames: number, id: number): string[] {
  const stage = sceneStage(scene);
  const samples = cameraSamples(scene, frameRate);
  const angled = samples.some((x) => isAngled(x.view));
  const lines = [`    <group name="Camera" id="${id}">`];
  if (angled) {
    const distance = r3((samples.find((x) => x.view.perspective)?.view.perspective ?? DEFAULT_PERSPECTIVE) * stage.width);
    lines.push(`      <!-- 3D group: view it through a camera ${distance}px from the canvas -->`);
  }
  for (const shot of scene.shots) {
    const transition = shot.camera?.transition;
    if (transition && transition !== 'move') lines.push(`      <!-- ${escapeXml(shot.title ?? 'Shot')}: ${transition} in -->`);
    if (shot.camera?.motionBlur) lines.push(`      <!-- ${escapeXml(shot.title ?? 'Shot')}: motion blur ${shot.camera.motionBlur} on the move in -->`);
  }
  lines.push(`      <timing in="0" out="${totalFrames - 1}" offset="0"/>`);
  lines.push('      <parameter name="Properties" id="1">');
  lines.push('        <parameter name="Transform" id="100">');
  lines.push('          <parameter name="Position" id="101">');
  lines.push('            <parameter name="X" id="1" value="0"/>');
  lines.push('            <parameter name="Y" id="2" value="0"/>');
  lines.push('          </parameter>');
  lines.push('          <parameter name="Scale" id="102">');
  lines.push(...curveParameter('X', 1, samples, (v) => v.zoom * 100, '            '));
  lines.push(...curveParameter('Y', 2, samples, (v) => v.zoom * 100, '            '));
  lines.push('          </parameter>');
  lines.push('          <parameter name="Rotation" id="103">');
  lines.push(...curveParameter('X', 1, samples, (v) => 0 - (v.tilt ?? 0), '            '));
  lines.push(...curveParameter('Y', 2, samples, (v) => v.turn ?? 0, '            '));
  lines.push(...curveParameter('Z', 3, samples, (v) => 0 - (v.roll ?? 0), '            '));
  lines.push('          </parameter>');
  lines.push('          <parameter name="Anchor Point" id="104">');
  lines.push(...curveParameter('X', 1, samples, (v) => centreOf(v, stage)[0], '            '));
  lines.push(...curveParameter('Y', 2, samples, (v) => 0 - centreOf(v, stage)[1], '            '));
  lines.push('          </parameter>');
  lines.push('        </parameter>');
  lines.push('      </parameter>');
  return lines;
}

/**
 * Serializes a Flair Scene into Apple Motion ozml 4.0 XML document format
 * (.motn). A scene with a camera puts its shots in a "Camera" group that
 * moves, zooms and turns as the camera does.
 */
export function exportMotn(scene: Scene, options: MotnExportOptions = {}): string {
  const frameRate = options.frameRate ?? 30;
  const width = scene.stage?.width ?? DEFAULT_STAGE.width;
  const height = scene.stage?.height ?? DEFAULT_STAGE.height;

  // Calculate shot frame ranges
  let currentMs = 0;
  const shotTimings = scene.shots.map((shot, idx) => {
    const camMs = shotMoveMs(shot, idx);
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

  // Groups and element nodes per shot, inside the camera group when there is one.
  const hasCamera = scene.shots.some((s) => s.camera);
  if (hasCamera) lines.push(...cameraGroupOpen(scene, frameRate, totalFrames, nodeId++));
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
  if (hasCamera) lines.push('    </group>');

  lines.push('  </scene>');
  lines.push('</ozml>');
  lines.push('');

  return lines.join('\n');
}
