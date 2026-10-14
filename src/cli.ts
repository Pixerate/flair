#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { parseControls, standaloneHtml, type ControlValue } from './shader/index.js';
import { validateScene, simulateScene, standaloneSceneHtml, type Scene } from './scene/index.js';

const program = new Command();

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
  .description('Export shader animation (GIF/MP4) or scene to Apple Motion ozml 4.0 (.motn)')
  .option('-o, --out <outputPath>', 'Output file path')
  .option('-w, --width <width>', 'Canvas width', '720')
  .option('-h, --height <height>', 'Canvas height', '720')
  .option('--fps <fps>', 'Frames per second', '30')
  .option('-d, --duration <duration>', 'Duration in seconds', '3')
  .option('-v, --values <jsonOrFile>', 'Control values as JSON string or file')
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
      const { exportMotionGraphic } = await import('./export/index.js');
      const savedPath = await exportMotionGraphic({
        source,
        values,
        outputPath: options.out,
        width,
        height,
        fps,
        duration,
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

sceneCmd
  .command('html <sceneFile>')
  .description('Generate standalone interactive web player for the scene')
  .option('-o, --out <outputPath>', 'Output HTML path')
  .option('--open', 'Open generated HTML in browser', false)
  .action((sceneFile, options) => {
    const fullPath = path.resolve(process.cwd(), sceneFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Scene file not found at: ${fullPath}`);
      process.exit(1);
    }

    try {
      const scene: Scene = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const htmlContent = standaloneSceneHtml(scene);
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
    } catch (err: any) {
      console.error(`Error exporting scene to CMX 3600 EDL: ${err.message}`);
      process.exit(1);
    }
  });


program.parse(process.argv);
