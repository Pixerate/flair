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

program.parse(process.argv);
