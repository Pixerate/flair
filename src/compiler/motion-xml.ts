import fs from 'fs';
import path from 'path';
import { MotionSpec, ColorSpec, MotionSpecSchema } from '../types/spec.js';
import { validateMotionXmlFonts } from '../services/font-validator.js';

export interface NormalizedColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export interface CompileOptions {
  /**
   * Whether to check that all fonts referenced in the output XML are installed on the host system.
   * Defaults to true.
   */
  validateFonts?: boolean;
  /**
   * Custom font availability checker function (useful for tests or non-macOS environments).
   */
  fontChecker?: (fontName: string) => boolean;
}

/**
 * Converts a Hex string or ColorSpec object into normalized 0.0-1.0 RGB components for Apple Motion.
 */
export function normalizeColor(color: ColorSpec): NormalizedColor {
  if (typeof color === 'string') {
    let hex = color.replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      return {
        red: Number(((num >> 16) & 255) / 255),
        green: Number(((num >> 8) & 255) / 255),
        blue: Number((num & 255) / 255),
        alpha: 1.0,
      };
    }
  } else if (typeof color === 'object' && color !== null) {
    return {
      red: color.r,
      green: color.g,
      blue: color.b,
      alpha: color.alpha ?? 1.0,
    };
  }
  return { red: 0, green: 0, blue: 0, alpha: 1.0 };
}

export const SYSTEM_TEMPLATES: Record<string, string> = {
  snap: '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Snap.localized/Snap-Open.localized/Snap-Open.motn',
  atmospheric: '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Atmospheric.localized/Atmospheric-Open.localized/Atmospheric-Open.motn',
  pulse: '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Pulse.localized/Pulse-Open.localized/Pulse-Open.motn',
  splash: '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Splash.localized/Splash-Open.localized/Splash-Open.motn',
  swarm: '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Swarm.localized/Swarm-Open.localized/Swarm-Open.motn',
  '3d-trailer': '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/3D.localized/Trailer.localized/Trailer.motn',
};

/**
 * MotionCompiler transforms a MotionSpec into a full-featured, 100% compliant Apple Motion project (.motn).
 */
export class MotionCompiler {
  private baseTemplatePath?: string;

  constructor(baseTemplatePath?: string) {
    this.baseTemplatePath = baseTemplatePath;
  }

  /**
   * Generates a brand new Apple Motion XML (.motn) template from scratch based on the MotionSpec.
   */
  private generateScratchTemplate(spec: MotionSpec): string {
    const bgColor = normalizeColor(spec.palette.backgroundColor);
    const totalFrames = Math.round(spec.canvas.durationSeconds * spec.canvas.fps);

    let mediaXml = '';
    if (spec.bgMedia) {
      const absMediaUrl = `file://${path.resolve(process.cwd(), spec.bgMedia)}`;
      mediaXml = `\n\t\t<footage name="Media Layer" id="999">\n\t\t\t<path>${absMediaUrl}</path>\n\t\t</footage>`;
    }

    const titleText = spec.title.toUpperCase();
    const subtitleText = spec.subtitle ? spec.subtitle.toUpperCase() : '';
    const badge1 = spec.badges[0] || '';
    const badge2 = spec.badges[1] || '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ozxmlscene>
<ozml version="4.0">

<factory id="1" uuid="044beba5ad3211d7ac9b000393833f6a">
	<description>Style</description>
	<manufacturer>Apple</manufacturer>
	<version>1</version>
</factory>
<factory id="2" uuid="babfc7777f4711d7aaa7000393833f6a">
	<description>Text</description>
	<manufacturer>Apple</manufacturer>
	<version>1</version>
</factory>

<scene>
	<canvas>
		<width>${spec.canvas.width}</width>
		<height>${spec.canvas.height}</height>
		<duration>${totalFrames}</duration>
		<frameRate>${spec.canvas.fps}</frameRate>
		<timeRange offset="0" duration="${totalFrames}"/>
		<backgroundColor red="${bgColor.red}" green="${bgColor.green}" blue="${bgColor.blue}" alpha="${bgColor.alpha}"/>
	</canvas>${mediaXml}
	<scenenode name="Title Here" id="1001" factoryID="2" version="1">
		<text>${titleText}</text>
		<font type="0">${spec.typography.titleFont}</font>
	</scenenode>
	<scenenode name="Subtitle" id="1002" factoryID="2" version="1">
		<text>${subtitleText}</text>
		<font type="0">${spec.typography.subtitleFont}</font>
	</scenenode>
	<scenenode name="Title Information 1" id="1003" factoryID="2" version="1">
		<text>${badge1}</text>
		<font type="0">${spec.typography.badgeFont}</font>
	</scenenode>
	<scenenode name="Title Information 2" id="1004" factoryID="2" version="1">
		<text>${badge2}</text>
		<font type="0">${spec.typography.badgeFont}</font>
	</scenenode>
</scene>
</ozml>`;
  }

  /**
   * Compiles a MotionSpec into a valid Apple Motion XML (.motn) file.
   * 
   * @param spec Input composition specification.
   * @param options Optional compilation flags.
   * @returns Compiled XML string.
   */
  public compile(spec: MotionSpec, options?: CompileOptions): string {
    const validatedSpec = MotionSpecSchema.parse(spec);

    let xml: string;
    const requestedTemplate = validatedSpec.template?.toLowerCase();

    if (this.baseTemplatePath) {
      if (!fs.existsSync(this.baseTemplatePath)) {
        throw new Error(`Base Apple Motion template file not found at: ${this.baseTemplatePath}`);
      }
      xml = fs.readFileSync(this.baseTemplatePath, 'utf-8');
    } else if (requestedTemplate === 'scratch') {
      xml = this.generateScratchTemplate(validatedSpec);
    } else {
      let resolvedPath = requestedTemplate ? SYSTEM_TEMPLATES[requestedTemplate] : undefined;

      if (!resolvedPath) {
        // Fallback mapping based on style
        switch (validatedSpec.style) {
          case 'cyberpunk':
          case 'synthwave':
          case 'retro':
            resolvedPath = SYSTEM_TEMPLATES['atmospheric'];
            break;
          case 'minimalist':
            resolvedPath = SYSTEM_TEMPLATES['swarm'];
            break;
          default:
            resolvedPath = SYSTEM_TEMPLATES['snap'];
            break;
        }
      }

      if (resolvedPath && fs.existsSync(resolvedPath)) {
        xml = fs.readFileSync(resolvedPath, 'utf-8');
      } else {
        xml = this.generateScratchTemplate(validatedSpec);
      }
    }

    const bgColor = normalizeColor(validatedSpec.palette.backgroundColor);

    const titleText = validatedSpec.title.toUpperCase();
    const subtitleText = validatedSpec.subtitle ? validatedSpec.subtitle.toUpperCase() : '★ MAXIMUM SLOP ★';
    const badge1 = validatedSpec.badges[0] || 'SYSTEM ERROR // 100% RAW';
    const badge2 = validatedSpec.badges[1] || 'VER 2.0 // NO CAP';

    // 1. Text Content Replacements
    xml = xml.replace(/<text>Title Here[\r\n]*/gi, `<text>${titleText}`);
    xml = xml.replace(/<text>TITLE HERE[\r\n]*/gi, `<text>${titleText}`);
    xml = xml.replace(/<text>Subtitle[\r\n]*/gi, `<text>${subtitleText}`);
    xml = xml.replace(/<text>Title Information 1[\r\n]*/gi, `<text>${badge1}`);
    xml = xml.replace(/<text>Title Information 2[\r\n]*/gi, `<text>${badge2}`);

    // 2. Typography / Font Replacements
    xml = xml.replace(/HelveticaNeue-CondensedBold/g, validatedSpec.typography.titleFont);
    xml = xml.replace(/HelveticaNeue-UltraLight/g, validatedSpec.typography.subtitleFont);

    // 3. Canvas Background Color
    xml = xml.replace(
      /<backgroundColor red="[^"]+" green="[^"]+" blue="[^"]+" alpha="[^"]+"/,
      `<backgroundColor red="${bgColor.red}" green="${bgColor.green}" blue="${bgColor.blue}" alpha="${bgColor.alpha}"`
    );

    // 4. Background Media Layer Asset
    if (validatedSpec.bgMedia) {
      const absMediaUrl = `file://${path.resolve(process.cwd(), validatedSpec.bgMedia)}`;
      xml = xml.replace(
        /<footage name="Media Layer" id="(\d+)">/,
        `<footage name="Media Layer" id="$1">\n\t\t<path>${absMediaUrl}</path>`
      );
    }

    // 5. Canvas Dimensions
    xml = xml.replace(/<width>\d+<\/width>/, `<width>${validatedSpec.canvas.width}</width>`);
    xml = xml.replace(/<height>\d+<\/height>/, `<height>${validatedSpec.canvas.height}</height>`);

    // 6. Total frames duration
    const totalFrames = Math.round(validatedSpec.canvas.durationSeconds * validatedSpec.canvas.fps);
    xml = xml.replace(/<duration>\d+<\/duration>/, `<duration>${totalFrames}</duration>`);
    xml = xml.replace(/<timeRange offset="0" duration="\d+"\/>/, `<timeRange offset="0" duration="${totalFrames}"/>`);
    xml = xml.replace(/<frameRate>\d+<\/frameRate>/, `<frameRate>${validatedSpec.canvas.fps}</frameRate>`);

    // 7. Verify system fonts referenced in compiled Motion file
    const shouldValidateFonts = options?.validateFonts ?? true;
    if (shouldValidateFonts) {
      validateMotionXmlFonts(xml, {
        allowMissing: false,
        customChecker: options?.fontChecker,
      });
    }

    return xml;
  }
}
