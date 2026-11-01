import type { Scene, Shot } from '../scene/types.js';
import { DEFAULT_STAGE, DEFAULT_PERSPECTIVE, centreOf, isAngled, type View } from '../scene/camera.js';
import { cameraSamples, cameraTrack, shotMoveMs, sceneStage, type CameraSample } from '../scene/cameratrack.js';
import { DEFAULT_CAMERA_MOVE } from '../scene/moves.js';
import { isElementCommand, isReplicateCommand, type SceneCommand } from '../scene/types.js';
import { replicateCommands } from '../scene/replicator.js';
import { layerWhat } from '../scene/layers.js';
import { sceneTimeline, type TimedLayer } from '../scene/timeline.js';
import { layerBoard, sceneExportNotes } from './notes.js';
import type { Rect } from '../scene/geometry.js';

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

/**
 * A layer as a placeholder rectangle named after its effect, at its place
 * (a box on the board, or the whole screen) and for its time, with its
 * opacity: the look itself is rendered elsewhere and swapped in.
 */
function layerPlaceholder(t: TimedLayer, box: Rect | undefined, frameOf: (ms: number) => number, id: number, width: number, height: number, indent: string): string[] {
  const inFrame = frameOf(t.startMs);
  const outFrame = Math.max(inFrame, frameOf(t.endMs) - 1);
  const x = box ? box.x + box.width / 2 : width / 2;
  const y = box ? box.y + box.height / 2 : height / 2;
  const lines = [
    `${indent}<scenenode name="Layer ${escapeXml(t.key)}: ${escapeXml(layerWhat(t.layer))}" id="${id}" factoryID="3" version="1">`,
    `${indent}  <!-- ${escapeXml(t.role)} layer, ${t.layer.ids ? `over ${escapeXml(t.layer.ids.join(', '))}` : box ? 'on the board' : 'over the screen'}${t.layer.fade ? `, fading over ${t.layer.fade} ms` : ''} -->`,
    `${indent}  <timing in="${inFrame}" out="${outFrame}" offset="${inFrame}"/>`,
    `${indent}  <parameter name="Properties" id="1">`,
    `${indent}    <parameter name="Transform" id="100">`,
    `${indent}      <parameter name="Position" id="101">`,
    `${indent}        <parameter name="X" id="1" value="${r3(x)}"/>`,
    `${indent}        <parameter name="Y" id="2" value="${r3(-y)}"/>`,
    `${indent}      </parameter>`,
    `${indent}      <parameter name="Scale" id="102">`,
    `${indent}        <parameter name="X" id="1" value="${box?.width ?? width}"/>`,
    `${indent}        <parameter name="Y" id="2" value="${box?.height ?? height}"/>`,
    `${indent}      </parameter>`,
    `${indent}    </parameter>`,
    `${indent}    <parameter name="Opacity" id="4" value="${r3(typeof t.layer.opacity === 'number' ? t.layer.opacity : 1)}"/>`,
    `${indent}  </parameter>`,
    `${indent}</scenenode>`,
  ];
  return lines;
}

/** A shot's commands with each `replicate` drawn out as its copies. */
function drawnCommands(run: readonly SceneCommand[] | undefined): SceneCommand[] {
  return (run ?? []).flatMap((cmd): SceneCommand[] => (isReplicateCommand(cmd) ? replicateCommands(cmd).map((c) => c.command) : [cmd]));
}

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
  for (const entry of cameraTrack(scene)) {
    const title = escapeXml(entry.shot.title ?? 'Shot');
    const move = entry.moveMs > 0 ? entry.move : undefined;
    if (move && move.move.id !== DEFAULT_CAMERA_MOVE) lines.push(`      <!-- ${title}: ${move.move.id} in -->`);
    const blur = move?.values.motionBlur;
    if (typeof blur === 'number' && blur > 0) lines.push(`      <!-- ${title}: motion blur ${blur} on the move in -->`);
    if (entry.during) lines.push(`      <!-- ${title}: ${entry.during.move.id} while it holds -->`);
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
  for (const note of sceneExportNotes(scene, 'motn')) lines.push(`  <!-- ${note.replace(/--/g, '- -')} -->`);
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

  // Layers over the screen sit outside the camera: backgrounds under the shots, overlays over them.
  const timeline = sceneTimeline(scene);
  const frameOf = (ms: number) => Math.round((ms / 1000) * frameRate);
  const onScreen = timeline.layers.filter((t) => !t.layer.rect && !t.layer.ids);
  const screenGroup = (role: 'background' | 'overlay', name: string) => {
    const these = onScreen.filter((t) => (role === 'background' ? t.role === 'background' : t.role !== 'background'));
    if (!these.length) return;
    lines.push(`    <group name="${name}" id="${nodeId++}">`);
    lines.push(`      <timing in="0" out="${totalFrames - 1}" offset="0"/>`);
    for (const t of these) lines.push(...layerPlaceholder(t, layerBoard(t, timeline), frameOf, nodeId++, width, height, '      '));
    lines.push('    </group>');
  };
  screenGroup('background', 'Background layers');

  // Groups and element nodes per shot, inside the camera group when there is one.
  const hasCamera = scene.shots.some((s) => s.camera);
  if (hasCamera) lines.push(...cameraGroupOpen(scene, frameRate, totalFrames, nodeId++));
  for (const [idx, item] of shotTimings.entries()) {
    const shotLabel = item.shot.title
      ? `Shot ${idx + 1}: ${escapeXml(item.shot.title)}`
      : `Shot ${idx + 1}`;
    lines.push(`    <group name="${shotLabel}" id="${nodeId++}">`);
    lines.push(`      <timing in="${item.startFrame}" out="${item.endFrame}" offset="${item.startFrame}"/>`);
    const into = timeline.transitions.find((t) => t.shot === idx);
    if (into) lines.push(`      <!-- transition in: ${escapeXml(into.transition.effect)}, ${into.ms} ms -->`);
    for (const t of timeline.layers.filter((l) => l.shot === idx && (l.layer.rect || l.layer.ids))) lines.push(...layerPlaceholder(t, layerBoard(t, timeline), frameOf, nodeId++, width, height, '      '));

    if (item.shot.run) {
      for (const cmd of drawnCommands(item.shot.run)) {
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
  screenGroup('overlay', 'Overlay layers');

  lines.push('  </scene>');
  lines.push('</ozml>');
  lines.push('');

  return lines.join('\n');
}
