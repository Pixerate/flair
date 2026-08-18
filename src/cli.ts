#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { createVertex } from '@ai-sdk/google-vertex';
import { MotionCompiler } from './compiler/motion-xml.js';
import { MotionAiGenerator } from './services/ai-generator.js';
import { MotionAppAutomation } from './automation/motion-app.js';
import { MotionSpecSchema, MotionSpec } from './types/spec.js';

const program = new Command();

program
  .name('flair')
  .description('AI-powered Apple Motion (.motn) generator and desktop automation CLI')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate an Apple Motion project (.motn) from a prompt or spec JSON file')
  .option('-p, --prompt <prompt>', 'Natural language prompt requirement')
  .option('-s, --spec <specFile>', 'Path to a JSON file containing a MotionSpec')
  .option('-m, --media <mediaPath>', 'Path to background image or video asset')
  .option('-o, --out <outputPath>', 'Output .motn file path', './output.motn')
  .option('--open', 'Keep project open in Motion.app after generation', false)
  .action(async (options) => {
    try {
      const automation = new MotionAppAutomation();
      const wasRunning = await automation.isMotionRunning();

      let spec: MotionSpec;

      if (options.spec) {
        const specPath = path.resolve(process.cwd(), options.spec);
        if (!fs.existsSync(specPath)) {
          console.error(`Error: Spec file not found at ${specPath}`);
          process.exit(1);
        }
        const jsonRaw = fs.readFileSync(specPath, 'utf-8');
        spec = MotionSpecSchema.parse(JSON.parse(jsonRaw));
        if (options.media) {
          spec.bgMedia = options.media;
        }
        console.log(`Loaded MotionSpec from file: ${specPath}`);
      } else if (options.prompt) {
        console.log(`Generating MotionSpec using Vertex AI for prompt: "${options.prompt}"...`);
        
        const projectId =
          process.env.GOOGLE_VERTEX_PROJECT ||
          process.env.GCP_PROJECT ||
          process.env.GOOGLE_CLOUD_PROJECT;

        if (!projectId) {
          throw new Error(
            'Google Vertex AI project is missing. Set GOOGLE_VERTEX_PROJECT or GCP_PROJECT environment variable.'
          );
        }

        const vertexClient = createVertex({
          project: projectId,
          location: process.env.GCP_LOCATION || 'us-central1',
        });

        const aiGenerator = new MotionAiGenerator({
          vertexClient,
          ...(process.env.VERTEX_MODEL || process.env.GEMINI_MODEL
            ? { modelName: process.env.VERTEX_MODEL || process.env.GEMINI_MODEL }
            : {}),
        });
        spec = await aiGenerator.generateSpecFromPrompt(options.prompt);
        if (options.media) {
          spec.bgMedia = options.media;
        }
        console.log('Successfully generated MotionSpec via Vertex AI.');
      } else {
        console.error('Error: Either --prompt or --spec must be provided.');
        process.exit(1);
      }

      const compiler = new MotionCompiler();
      const xmlOutput = compiler.compile(spec);

      const outputPath = path.resolve(process.cwd(), options.out);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, xmlOutput, 'utf-8');
      console.log(`Successfully compiled Apple Motion project to: ${outputPath}`);

      // Validate project by opening in Motion.app
      console.log('Validating project in Motion.app...');
      await automation.openProject(outputPath);

      if (options.open) {
        await automation.playTimeline();
        console.log('Motion.app active and playback started.');
      } else if (!wasRunning) {
        // Auto-close Motion.app after validation if it was not running prior
        console.log('Validation complete. Auto-closing Motion.app...');
        await new Promise((res) => setTimeout(res, 1500));
        await automation.quitMotion();
        console.log('Motion.app closed.');
      }
    } catch (err: any) {
      console.error(`Error: ${err?.message || String(err)}`);
      process.exit(1);
    }
  });

program
  .command('render <motnPath>')
  .description('Instruct Motion.app to render an Apple Motion project (.motn) to an MP4 video file')
  .option('-o, --out <outputPath>', 'Destination MP4 video file path', './output.mp4')
  .action(async (motnPath, options) => {
    try {
      const automation = new MotionAppAutomation();
      const wasRunning = await automation.isMotionRunning();

      console.log(`Rendering ${motnPath} to ${options.out}...`);
      await automation.renderProject(motnPath, options.out);
      console.log(`Render command issued for: ${options.out}`);

      if (!wasRunning) {
        await new Promise((res) => setTimeout(res, 3000));
        await automation.quitMotion();
      }
    } catch (err: any) {
      console.error(`Error rendering Motion project: ${err?.message || String(err)}`);
      process.exit(1);
    }
  });

program
  .command('open <motnPath>')
  .description('Open an existing Apple Motion file (.motn) in Motion.app and start playback')
  .action(async (motnPath) => {
    try {
      const fullPath = path.resolve(process.cwd(), motnPath);
      const automation = new MotionAppAutomation();
      await automation.openProject(fullPath);
      await automation.playTimeline();
      console.log(`Opened ${fullPath} in Motion.app.`);
    } catch (err: any) {
      console.error(`Error opening Motion file: ${err?.message || String(err)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
