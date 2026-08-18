import fs from 'fs';
import path from 'path';
import { MotionSpec, ColorSpec, MotionSpecSchema } from '../types/spec.js';

export interface NormalizedColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
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

/**
 * MotionCompiler transforms a MotionSpec into a full-featured, 100% compliant Apple Motion project (.motn).
 */
export class MotionCompiler {
  private baseTemplatePath: string;

  constructor(
    baseTemplatePath = '/Applications/Motion.app/Contents/Resources/Templates.localized/Compositions.localized/Snap.localized/Snap-Open.localized/Snap-Open.motn'
  ) {
    this.baseTemplatePath = baseTemplatePath;
  }

  /**
   * Compiles a MotionSpec into a valid Apple Motion XML (.motn) file.
   * 
   * @param spec Input composition specification.
   * @returns Compiled XML string.
   */
  public compile(spec: MotionSpec): string {
    const validatedSpec = MotionSpecSchema.parse(spec);
    
    if (!fs.existsSync(this.baseTemplatePath)) {
      throw new Error(`Base Apple Motion template file not found at: ${this.baseTemplatePath}`);
    }

    let xml = fs.readFileSync(this.baseTemplatePath, 'utf-8');

    const bgColor = normalizeColor(validatedSpec.palette.backgroundColor);

    const titleText = validatedSpec.title.toUpperCase();
    const subtitleText = validatedSpec.subtitle ? validatedSpec.subtitle.toUpperCase() : '★ MAXIMUM SLOP ★';
    const badge1 = validatedSpec.badges[0] || 'SYSTEM ERROR // 100% RAW';
    const badge2 = validatedSpec.badges[1] || 'VER 2.0 // NO CAP';

    // 1. Text Content Replacements
    xml = xml.replace(/<text>Title Here/g, `<text>${titleText}`);
    xml = xml.replace(/<text>Subtitle/g, `<text>${subtitleText}`);
    xml = xml.replace(/<text>Title Information 1/g, `<text>${badge1}`);
    xml = xml.replace(/<text>Title Information 2/g, `<text>${badge2}`);

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

    return xml;
  }
}
