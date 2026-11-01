#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { pathToFileURL } from 'url';
import { parseControls, standaloneHtml, type ControlValue } from './shader/index.js';
import { validateScene, simulateScene, standaloneSceneHtml, type Scene, type SceneSubject } from './scene/index.js';
import { instantiateTemplate, isSubjectSlotType, templateSlotSummary, type SceneTemplate, type TemplateValue, type TemplateValues } from './scene/template.js';
import { sceneExportNotes, type SceneExportFormat } from './export/notes.js';

const program = new Command();

/** --shutter-angle and --shutter-samples as numbers (range-checked by the export, which names the valid range). */
function shutterFlags(options: { shutterAngle?: string; shutterSamples?: string }): { shutterAngle?: number; shutterSamples?: number } {
  const number = (flag: string, text: string | undefined, what: string) => {
    if (text === undefined) return undefined;
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) throw new Error(`${flag} takes ${what}, not "${text}".`);
    return n;
  };
  const shutterAngle = number('--shutter-angle', options.shutterAngle, "degrees from 0 to 360 (180 is a film camera's usual)");
  const shutterSamples = number('--shutter-samples', options.shutterSamples, 'a whole number of sub-frames from 2 to 32');
  return { ...(shutterAngle !== undefined ? { shutterAngle } : {}), ...(shutterSamples !== undefined ? { shutterSamples } : {}) };
}

program
  .name('flair')
  .description('Generative motion graphics, animation directing & bespoke WebGL shader engine')
  .version('2.0.0');

// ==========================================
// Shader Commands
// ==========================================
program
  .command('controls <shaderPath>')
  .description('Inspect and parse @control declarations in a WebGL shader file')
  .option('--json', 'Output controls as JSON', false)
  .action((shaderPath, options) => {
    const fullPath = path.resolve(process.cwd(), shaderPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Shader file not found at: ${fullPath}`);
      process.exit(1);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    const controls = parseControls(source);

    if (options.json) {
      console.log(JSON.stringify(controls, null, 2));
      return;
    }

    if (controls.length === 0) {
      console.log(`No @control annotations found in ${path.basename(shaderPath)}.`);
      return;
    }

    console.log(`Controls in ${path.basename(shaderPath)} (${controls.length}):`);
    for (const c of controls) {
      const defVal = Array.isArray(c.default) ? `[${c.default.join(', ')}]` : String(c.default);
      console.log(
        `  • ${c.name} (${c.type}): "${c.label}" | default=${defVal} | range=[${c.min}, ${c.max}] (line ${c.line})`
      );
    }
  });

program
  .command('html <shaderPath>')
  .description('Generate a self-contained standalone HTML page running the shader')
  .option('-t, --title <title>', 'Page title')
  .option('-o, --out <outputPath>', 'Output HTML path')
  .option('-v, --values <jsonOrFile>', 'Control values as JSON string or path to JSON file')
  .option('--open', 'Open generated HTML page in default browser', false)
  .action((shaderPath, options) => {
    const fullPath = path.resolve(process.cwd(), shaderPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Shader file not found at: ${fullPath}`);
      process.exit(1);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');
    const title = options.title || path.basename(shaderPath, path.extname(shaderPath));

    let values: Record<string, ControlValue> = {};
    if (options.values) {
      try {
        if (fs.existsSync(options.values)) {
          values = JSON.parse(fs.readFileSync(options.values, 'utf-8'));
        } else {
          values = JSON.parse(options.values);
        }
      } catch (err: any) {
        console.error(`Error parsing values: ${err.message}`);
        process.exit(1);
      }
    }

    const htmlContent = standaloneHtml(title, source, values);
    const outputPath = path.resolve(
      process.cwd(),
      options.out || `${path.basename(shaderPath, path.extname(shaderPath))}.html`
    );

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, htmlContent, 'utf-8');
    console.log(`Generated standalone shader page at: ${outputPath}`);

    if (options.open) {
      exec(`open "${outputPath}"`);
    }
  });

program
  .command('export <targetOrShader> [extraPath] [outputPath]')
  .description('Export a shader file to video (.mp4/.webm/.mov), .gif or .png frames, or a scene to motn/lottie/fcp7/edl')
  .option('-o, --out <outputPath>', 'Output file path')
  .option('-w, --width <width>', 'Canvas width', '720')
  .option('-h, --height <height>', 'Canvas height', '720')
  .option('--fps <fps>', 'Frames per second', '30')
  .option('-d, --duration <duration>', 'Duration in seconds', '3')
  .option('-v, --values <jsonOrFile>', 'Control values as JSON string or file')
  .option('--alpha', 'Keep the shader alpha (webm, mov, gif, png)', false)
  .option('--transparent', 'The shader is an overlay: composite its alpha over --background', false)
  .option('--background <css>', 'Colour under transparent pixels without --alpha', '#000000')
  .option('--pointer', 'Act out a pointer that hovers, wanders and clicks', false)
  .option('--software', 'Draw with software GL (SwiftShader) everywhere: the same frames on every machine', false)
  .option('--shutter-angle <degrees>', "Motion blur: the shutter angle, 0 to 360 (180 is a film camera's usual; default 0, off)")
  .option('--shutter-samples <n>', 'Sub-frames averaged into each blurred frame, 2 to 32 (default 8)')
  .action(async (targetOrShader, extraPath, outputPath, options) => {
    if (targetOrShader === 'motn' || targetOrShader === 'lottie' || targetOrShader === 'fcp7' || targetOrShader === 'edl') {
      const sceneFile = extraPath;
      if (!sceneFile) {
        console.error(`Error: Please provide a scene JSON file to export: flair export ${targetOrShader} <scene.json> [output]`);
        process.exit(1);
      }
      const fullPath = path.resolve(process.cwd(), sceneFile);
      if (!fs.existsSync(fullPath)) {
        console.error(`Error: Scene file not found at: ${fullPath}`);
        process.exit(1);
      }
      try {
        const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        const { exportMotn, exportLottie, exportFcp7Xml, exportCmx3600Edl } = await import('./export/index.js');
        const fps = parseInt(options.fps, 10);

        let content: string;
        let ext: string;
        if (targetOrShader === 'motn') {
          content = exportMotn(scene, { frameRate: fps });
          ext = 'motn';
        } else if (targetOrShader === 'lottie') {
          content = JSON.stringify(exportLottie(scene, { frameRate: fps }), null, 2);
          ext = 'json';
        } else if (targetOrShader === 'fcp7') {
          content = exportFcp7Xml(scene, { frameRate: fps });
          ext = 'xml';
        } else {
          content = exportCmx3600Edl(scene, { frameRate: fps });
          ext = 'edl';
        }

        const destination = path.resolve(
          process.cwd(),
          options.out || outputPath || `${scene.name || 'scene'}.${ext}`
        );
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, content, 'utf-8');
        console.log(`✅ Successfully exported ${targetOrShader.toUpperCase()} to: ${destination}`);
        printExportNotes(scene, targetOrShader as SceneExportFormat);
      } catch (err: any) {
        console.error(`Error exporting scene to ${targetOrShader}: ${err.message}`);
        process.exit(1);
      }
      return;
    }

    const shaderPath = targetOrShader;
    const fullPath = path.resolve(process.cwd(), shaderPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Shader file not found at: ${fullPath}`);
      process.exit(1);
    }

    if (!options.out) {
      console.error('Error: Output file path required (-o, --out <outputPath>)');
      process.exit(1);
    }

    const source = fs.readFileSync(fullPath, 'utf-8');

    let values: Record<string, ControlValue> = {};
    if (options.values) {
      try {
        if (fs.existsSync(options.values)) {
          values = JSON.parse(fs.readFileSync(options.values, 'utf-8'));
        } else {
          values = JSON.parse(options.values);
        }
      } catch (err: any) {
        console.error(`Error parsing values: ${err.message}`);
        process.exit(1);
      }
    }

    const width = parseInt(options.width, 10);
    const height = parseInt(options.height, 10);
    const fps = parseInt(options.fps, 10);
    const duration = parseFloat(options.duration);

    console.log(`Rendering ${duration}s (${duration * fps} frames at ${width}x${height}, ${fps}fps) to ${options.out}...`);

    try {
      const { exportMotionGraphic } = await import('./export/recorder.js');
      const savedPath = await exportMotionGraphic({
        source,
        values,
        outputPath: options.out,
        width,
        height,
        fps,
        duration,
        alpha: options.alpha,
        ...(options.software ? { software: true } : {}),
        transparent: options.transparent,
        background: options.background,
        pointer: options.pointer ? 'auto' : 'none',
        ...shutterFlags(options),
        onProgress: (frame, total) => {
          process.stdout.write(`\rRendering frame ${frame}/${total} (${Math.round((frame / total) * 100)}%)`);
        },
      });
      console.log(`\n✅ Successfully exported motion graphic to: ${savedPath}`);
    } catch (err: any) {
      console.error(`\nExport failed: ${err.message}`);
      process.exit(1);
    }
  });

// ==========================================
// Catalog Commands
// ==========================================
const collect = (value: string, previous: string[]) => [...previous, value];

program
  .command('effects')
  .description('List catalog effects with what they take (image, video, svg, text, mask, path) and how they answer the pointer')
  .option('--accepts <inputs>', 'Only effects that take all of these (image, video, svg, text, mask, path; comma-separated or repeated)', collect, [])
  .option('--interaction <ways>', 'Only effects that answer the pointer in one of these ways (hover, press, click, trail, pointer)', collect, [])
  .option('--category <category>', 'Only this category')
  .option('--kind <kind>', 'shader or vector')
  .option('--search <words>', 'Words to look for in the id, name, description and tags')
  .option('--tag <tags>', 'Only effects with every one of these tags (comma-separated or repeated; `flair tags` lists them)', collect, [])
  .option('--transparent', 'Only overlays: effects that draw over what is under them (they take a --backdrop in render)')
  .option('--json', 'Output JSON (id, name, kind, category, description, tags, inputs, presets)', false)
  .action(async (options) => {
    try {
      const { findEffects, effectInputs } = await import('./catalog/index.js');
      const { effectQueryFromFlags, describeEffect } = await import('./export/effect.js');
      const effects = findEffects(effectQueryFromFlags(options));
      if (options.json) {
        console.log(JSON.stringify(effects.map((e) => ({ id: e.id, name: e.name, kind: e.kind, category: e.category, description: e.description, tags: e.tags, inputs: effectInputs(e), presets: e.presets?.map((p) => p.name) ?? [] })), null, 2));
        return;
      }
      if (!effects.length) {
        console.log('No effects match.');
        return;
      }
      for (const e of effects) console.log(describeEffect(e));
      console.log(`\n${effects.length} effect${effects.length === 1 ? '' : 's'}. Render one with: flair render <id> [--image p | --text "…" | …] -o out.mp4`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('tags')
  .description('List the tags of catalog effects, each with how many effects carry it, the most used first')
  .option('--category <category>', 'Only tags of effects in this category')
  .option('--kind <kind>', 'shader or vector')
  .option('--search <words>', 'Only tags of effects matching these words')
  .option('--tag <tags>', 'Only tags of effects that have all of these tags too (comma-separated or repeated)', collect, [])
  .option('--limit <n>', 'Most tags to list (default all)')
  .option('--json', 'Output JSON ([{tag, count}])', false)
  .action(async (options) => {
    try {
      const { effectTags } = await import('./catalog/index.js');
      const { effectQueryFromFlags } = await import('./export/effect.js');
      const limit = options.limit === undefined ? Infinity : Number(options.limit);
      if (options.limit !== undefined && !(Number.isInteger(limit) && limit >= 1)) throw new Error(`--limit takes a whole number from 1; not "${options.limit}".`);
      const all = effectTags(effectQueryFromFlags(options));
      const tags = all.slice(0, limit);
      if (options.json) {
        console.log(JSON.stringify(tags, null, 2));
        return;
      }
      if (!tags.length) {
        console.log('No effects match.');
        return;
      }
      for (const { tag, count } of tags) console.log(`${String(count).padStart(4)}  ${tag}`);
      console.log(`\n${tags.length < all.length ? `${tags.length} of ${all.length}` : all.length} tag${all.length === 1 ? '' : 's'}. Find effects with one: flair effects --tag <tag>`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('render <effect>')
  .description('Render a catalog effect, applied to a subject, to .mp4, .webm, .mov, .gif, .svg (vector effects) or .png frames')
  .option('--image <path>', 'A picture (file path or URL); repeat for effects that take two', collect, [])
  .option('--svg <path>', 'An SVG (file path, URL or markup)', collect, [])
  .option('--text <text>', 'Words, for a text effect or a text mask', collect, [])
  .option('--font <family>', 'CSS font family for --text drawn into a shader')
  .option('--weight <weight>', 'Font weight for --text drawn into a shader')
  .option('--path <d>', 'SVG path data, for a shape control', collect, [])
  .option('--video <path>', 'A video file, decoded to frames with ffmpeg', collect, [])
  .option('--preset <name>', 'A preset by name')
  .option('--set <name=value>', 'A control value (repeatable): --set uSpeed=2 --set uTint=#ff0080', collect, [])
  .option('--size <WxH>', 'Pixels, like 1280x720')
  .option('--fps <fps>', 'Frames per second', '30')
  .option('--duration <seconds>', 'Seconds (default: the effect\'s loop or play-through)')
  .option('--alpha', 'Keep transparency (webm, mov, gif, png, svg)', false)
  .option('--background <css>', 'Colour under transparent pixels without --alpha')
  .option('--backdrop <path>', 'A picture (file path or URL) drawn under an overlay effect in every frame; the frame takes its size unless --size says')
  .option('--backdrop-fit <fit>', 'How the backdrop fills the frame: cover (default), contain or fill')
  .option('--region <x,y,w,h>', 'Confine the effect to part of the frame, normalized 0-1 from the top left, like 0.5,0,0.5,1')
  .option('--no-pointer', 'Leave the pointer still (interactive effects otherwise get a scripted pointer)')
  .option('--software', 'Draw with software GL (SwiftShader) everywhere: the same frames on every machine, for golden-image tests', false)
  .option('--shutter-angle <degrees>', "Motion blur: the shutter angle, 0 to 360 (180 is a film camera's usual; default 0, off). Not for .svg")
  .option('--shutter-samples <n>', 'Sub-frames averaged into each blurred frame, 2 to 32 (default 8); the render draws this many per frame')
  .option('-o, --out <outputPath>', 'Output: .mp4, .webm, .mov, .gif, .svg, a .png pattern (out_%04d.png) or a folder')
  .action(async (effectId, options) => {
    try {
      if (!options.out) throw new Error('Say where to write it: -o out.mp4 (or .webm, .mov, .gif, .svg, out_%04d.png, a folder/).');
      const { exportEffect, parseRegion, parseSets, parseSize, resolveEffect, subjectsFromFlags } = await import('./export/effect.js');
      const effect = resolveEffect(effectId);
      const subjects = subjectsFromFlags(options);
      const size = options.size ? parseSize(options.size) : undefined;
      const fps = Number(options.fps);
      if (!(fps > 0)) throw new Error(`--fps takes a positive number, not "${options.fps}".`);
      const duration = options.duration === undefined ? undefined : Number(options.duration);
      if (duration !== undefined && !(duration > 0)) throw new Error(`--duration takes seconds, more than 0, not "${options.duration}".`);
      console.log(`Rendering ${effect.id} to ${options.out}...`);
      const saved = await exportEffect(effect, {
        ...(subjects.length ? { subject: subjects } : {}),
        ...(options.preset ? { preset: options.preset } : {}),
        values: parseSets(effect, options.set),
        outputPath: options.out,
        ...(size ?? {}),
        fps,
        ...(duration !== undefined ? { duration } : {}),
        alpha: options.alpha,
        ...(options.software ? { software: true } : {}),
        ...(options.background ? { background: options.background } : {}),
        ...(options.backdrop ? { backdrop: options.backdrop } : {}),
        ...(options.backdropFit ? { backdropFit: options.backdropFit } : {}),
        ...(options.region ? { region: parseRegion(options.region) } : {}),
        ...(options.pointer === false ? { pointer: 'none' as const } : {}),
        ...shutterFlags(options),
        onProgress: (frame, total) => {
          if (total > 1) process.stdout.write(`\rFrame ${frame}/${total} (${Math.round((frame / total) * 100)}%)`);
        },
      });
      console.log(`\nWrote ${saved}`);
    } catch (err: any) {
      console.error(`\nRender failed: ${err.message}`);
      process.exit(1);
    }
  });

// ==========================================
// Scene Directing Commands
// ==========================================
const sceneCmd = program
  .command('scene')
  .description('Direct, validate, simulate, and render multi-shot animated scenes');

sceneCmd
  .command('validate <sceneFile>')
  .description('Validate scene JSON structure, camera framing, and effect IDs')
  .action((sceneFile) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const issues = validateScene(scene);
      if (issues.length === 0) {
        console.log(`✅ Scene "${scene.name}" is valid (${scene.shots.length} shots).`);
      } else {
        console.warn(`Found ${issues.length} issue(s) in "${scene.name}":`);
        for (const iss of issues) {
          const loc = iss.shot === 0 ? 'Scene' : `Shot ${iss.shot}`;
          console.warn(`  • [${loc}] ${iss.message}`);
        }
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Error reading scene: ${err.message}`);
      process.exit(1);
    }
  });

sceneCmd
  .command('review <sceneFile>')
  .alias('preview')
  .description('Simulate scene off-screen and generate timing breakdown & diagnostic review')
  .action(async (sceneFile) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const { review } = await simulateScene(scene);
      console.log(review.markdown);
    } catch (err: any) {
      console.error(`Error reviewing scene: ${err.message}`);
      process.exit(1);
    }
  });

/** Prints what an export left out of the scene, or carries only in part. */
function printExportNotes(scene: Scene, format: SceneExportFormat) {
  const notes = sceneExportNotes(scene, format);
  if (notes.length) console.warn(`Not carried over in full:\n${notes.map((n) => `  • ${n}`).join('\n')}`);
}

/**
 * Slots from `--subject slot=value`: words after `text:`, else a file or URL,
 * by its extension a video, an SVG or a picture. Local pictures and SVGs are
 * inlined as `data:` URLs so the page carries them.
 */
function sceneSubjects(given: string[], base: string): Record<string, SceneSubject> {
  const subjects: Record<string, SceneSubject> = {};
  for (const entry of given) {
    const at = entry.indexOf('=');
    if (at < 1) throw new Error(`--subject takes slot=value (like logo=./logo.png or title=text:Hello), not "${entry}".`);
    const value = entry.slice(at + 1);
    subjects[entry.slice(0, at)] = value.startsWith('text:') ? { text: value.slice(5) } : fileSubject(value, base);
  }
  return subjects;
}

/** A file or URL as a subject: by its extension a video, an SVG or a picture; local pictures and SVGs are inlined. */
function fileSubject(value: string, base: string): SceneSubject {
  const ext = path.extname(value.split('?')[0]!).toLowerCase();
  const file = path.resolve(base, value);
  const local = !/^[a-z]+:/i.test(value) && fs.existsSync(file);
  if (['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) return { video: local ? pathToFileURL(file).href : value };
  if (ext === '.svg') return { svg: local ? fs.readFileSync(file, 'utf-8') : value };
  const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
  return { image: local ? `data:${types[ext] ?? 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}` : value };
}

sceneCmd
  .command('html <sceneFile>')
  .description('Generate standalone interactive web player for the scene')
  .option('-o, --out <outputPath>', 'Output HTML path')
  .option('--open', 'Open generated HTML in browser', false)
  .option('--subject <slot=value...>', 'Fill a slot: a picture, SVG or video file or URL (slot=./logo.png), or words (slot=text:Hello)')
  .action(async (sceneFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const subjects = sceneSubjects(options.subject ?? [], path.dirname(fullPath));
      const htmlContent = await standaloneSceneHtml(scene, { subjects });
      const outputPath = path.resolve(
        process.cwd(),
        options.out || `${scene.name || 'scene'}.html`
      );

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, htmlContent, 'utf-8');
      console.log(`Generated standalone scene player at: ${outputPath}`);

      if (options.open) {
        exec(`open "${outputPath}"`);
      }
    } catch (err: any) {
      console.error(`Error generating scene HTML: ${err.message}`);
      process.exit(1);
    }
  });

sceneCmd
  .command('motn <sceneFile> [outFile]')
  .description('Export scene to Apple Motion ozml 4.0 XML (.motn) document')
  .option('--fps <fps>', 'Target frame rate', '30')
  .action(async (sceneFile, outFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const { exportMotn } = await import('./export/index.js');
      const xml = exportMotn(scene, { frameRate: parseInt(options.fps, 10) });
      const destination = path.resolve(
        process.cwd(),
        outFile || `${scene.name || 'scene'}.motn`
      );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, xml, 'utf-8');
      console.log(`✅ Successfully exported Apple Motion scene to: ${destination}`);
      printExportNotes(scene, 'motn');
    } catch (err: any) {
      console.error(`Error exporting scene to .motn: ${err.message}`);
      process.exit(1);
    }
  });

sceneCmd
  .command('lottie <sceneFile> [outFile]')
  .description('Export scene vector shapes and animations to Lottie JSON')
  .option('--fps <fps>', 'Target frame rate', '30')
  .action(async (sceneFile, outFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const { exportLottie } = await import('./export/index.js');
      const animation = exportLottie(scene, { frameRate: parseInt(options.fps, 10) });
      const destination = path.resolve(
        process.cwd(),
        outFile || `${scene.name || 'scene'}.json`
      );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, JSON.stringify(animation, null, 2), 'utf-8');
      console.log(`✅ Successfully exported Lottie animation to: ${destination}`);
      printExportNotes(scene, 'lottie');
    } catch (err: any) {
      console.error(`Error exporting scene to Lottie: ${err.message}`);
      process.exit(1);
    }
  });

sceneCmd
  .command('fcp7 <sceneFile> [outFile]')
  .description('Export scene timeline and markers to Final Cut Pro 7 XML (xmeml v4)')
  .option('--fps <fps>', 'Target frame rate', '30')
  .action(async (sceneFile, outFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const { exportFcp7Xml } = await import('./export/index.js');
      const xml = exportFcp7Xml(scene, { frameRate: parseInt(options.fps, 10) });
      const destination = path.resolve(
        process.cwd(),
        outFile || `${scene.name || 'scene'}.xml`
      );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, xml, 'utf-8');
      console.log(`✅ Successfully exported FCP7 XML to: ${destination}`);
      printExportNotes(scene, 'fcp7');
    } catch (err: any) {
      console.error(`Error exporting scene to FCP7 XML: ${err.message}`);
      process.exit(1);
    }
  });

sceneCmd
  .command('edl <sceneFile> [outFile]')
  .description('Export scene edit decision list to standard CMX 3600 EDL')
  .option('--fps <fps>', 'Target frame rate', '30')
  .option('--reel <reel>', 'Reel name identifier', 'AX')
  .action(async (sceneFile, outFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const { exportCmx3600Edl } = await import('./export/index.js');
      const edl = exportCmx3600Edl(scene, {
        frameRate: parseInt(options.fps, 10),
        reel: options.reel,
      });
      const destination = path.resolve(
        process.cwd(),
        outFile || `${scene.name || 'scene'}.edl`
      );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, edl, 'utf-8');
      console.log(`✅ Successfully exported CMX 3600 EDL to: ${destination}`);
      printExportNotes(scene, 'edl');
    } catch (err: any) {
      console.error(`Error exporting scene to CMX 3600 EDL: ${err.message}`);
      process.exit(1);
    }
  });


// ==========================================
// Template Commands
// ==========================================
const templateCmd = program
  .command('template')
  .description('List sequence templates and fill one into a scene');

/** A catalog template by id, or a template JSON file. */
async function loadTemplate(ref: string): Promise<SceneTemplate> {
  const { SCENE_TEMPLATES } = await import('./catalog/templates.js');
  const found = SCENE_TEMPLATES.find((t) => t.id === ref);
  if (found) return found;
  const file = path.resolve(process.cwd(), ref);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  throw new Error(`There is no template "${ref}" and no such file; the templates are ${SCENE_TEMPLATES.map((t) => t.id).join(', ')} (flair template list).`);
}

/**
 * A slot's value from the command line or a values file: a number for a
 * number slot, a file or URL (local files inlined) for a subject slot, else
 * the words as given.
 */
function templateValue(template: SceneTemplate, slot: string, value: unknown, base: string): TemplateValue {
  const declared = template.slots.find((s) => s.name === slot);
  if (typeof value !== 'string' || !declared) return value as TemplateValue;
  if (declared.type === 'number') return value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
  if (isSubjectSlotType(declared.type) && !value.trimStart().startsWith('<') && !value.startsWith('data:')) return fileSubject(value, base);
  return value;
}

templateCmd
  .command('list')
  .description('List the catalog templates')
  .action(async () => {
    const { SCENE_TEMPLATES } = await import('./catalog/templates.js');
    for (const t of SCENE_TEMPLATES) {
      console.log(`${t.id} — ${t.name} (${t.scene.shots.length} shots)\n  ${t.description}\n  slots: ${t.slots.map((s) => `${s.name} (${s.type})`).join(', ')}`);
    }
  });

templateCmd
  .command('show <template>')
  .description("Describe a template's slots: type, label, default and range")
  .action(async (ref) => {
    try {
      const template = await loadTemplate(ref);
      console.log(`${template.name} (${template.id})\n${template.description}\n\nSlots:`);
      for (const slot of template.slots) console.log(`  • ${templateSlotSummary(slot)}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

templateCmd
  .command('fill <template>')
  .description('Fill a template (a catalog id or a template JSON file) with values, writing the scene JSON and optionally a standalone player')
  .option('--values <valuesFile>', 'A JSON file of values by slot name; picture paths in it are relative to it')
  .option('--set <slot=value...>', 'Set a slot: words, a #RRGGBB colour, a number, or a picture/SVG/video file or URL')
  .option('--name <name>', "The scene's name (default the template's id)")
  .option('-o, --out <sceneFile>', 'Output scene JSON path (default <name>.scene.json)')
  .option('--html <htmlFile>', 'Also write a standalone HTML player for the scene')
  .option('--open', 'Open the HTML player in the browser', false)
  .action(async (ref, options) => {
    try {
      const template = await loadTemplate(ref);
      const values: TemplateValues = {};
      if (options.values) {
        const file = path.resolve(process.cwd(), options.values);
        const given = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (!given || typeof given !== 'object' || Array.isArray(given)) throw new Error(`${options.values} should hold an object of values by slot name.`);
        for (const [slot, value] of Object.entries(given)) values[slot] = templateValue(template, slot, value, path.dirname(file));
      }
      for (const entry of options.set ?? []) {
        const at = entry.indexOf('=');
        if (at < 1) throw new Error(`--set takes slot=value (like headline="Meet Nova" or product=./product.png), not "${entry}".`);
        values[entry.slice(0, at)] = templateValue(template, entry.slice(0, at), entry.slice(at + 1), process.cwd());
      }
      const result = instantiateTemplate(template, values, options.name ? { name: options.name } : {});
      if (!result.ok) {
        console.error(`Could not fill "${template.id}":`);
        for (const error of result.errors) console.error(`  • ${error}`);
        process.exit(1);
      }
      const scenePath = path.resolve(process.cwd(), options.out || `${result.scene.name}.scene.json`);
      fs.mkdirSync(path.dirname(scenePath), { recursive: true });
      fs.writeFileSync(scenePath, `${JSON.stringify(result.scene, null, 2)}\n`, 'utf-8');
      console.log(`Filled "${template.id}" into ${scenePath} (${result.scene.shots.length} shots).`);
      for (const issue of result.issues) console.warn(`  • [${issue.shot ? `Shot ${issue.shot}` : 'Scene'}] ${issue.message}`);
      if (result.openSlots.length) console.log(`Open slots for the host to fill: ${result.openSlots.join(', ')} (flair scene html --subject slot=value).`);
      if (options.html) {
        const htmlPath = path.resolve(process.cwd(), options.html);
        fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
        fs.writeFileSync(htmlPath, await standaloneSceneHtml(result.scene), 'utf-8');
        console.log(`Generated standalone scene player at: ${htmlPath}`);
        if (options.open) exec(`open "${htmlPath}"`);
      }
    } catch (err: any) {
      console.error(`Error filling template: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
