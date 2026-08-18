import { execSync } from 'child_process';

export interface FontValidationResult {
  valid: boolean;
  referencedFonts: string[];
  missingFonts: string[];
}

export interface FontValidationOptions {
  allowMissing?: boolean;
  customChecker?: (fontName: string) => boolean;
}

/**
  * Extracts all font names referenced in Apple Motion XML (<font ...>FontName</font>).
  */
export function extractFontsFromMotionXml(xml: string): string[] {
  const fontRegex = /<font\b[^>]*>([^<]+)<\/font>/gi;
  const fonts = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = fontRegex.exec(xml)) !== null) {
    const fontName = match[1].trim();
    if (fontName) {
      fonts.add(fontName);
    }
  }
  return Array.from(fonts);
}

/**
  * Checks system availability for a list of font names.
  */
export function checkFontsAvailability(
  fontNames: string[],
  customChecker?: (fontName: string) => boolean
): { present: string[]; missing: string[] } {
  if (customChecker) {
    const present: string[] = [];
    const missing: string[] = [];
    for (const font of fontNames) {
      if (customChecker(font)) {
        present.push(font);
      } else {
        missing.push(font);
      }
    }
    return { present, missing };
  }

  if (fontNames.length === 0) {
    return { present: [], missing: [] };
  }

  const uniqueFonts = Array.from(new Set(fontNames));
  const present: string[] = [];
  const missing: string[] = [];

  // Try macOS Swift / AppKit NSFont check first
  try {
    const jsonInput = JSON.stringify(uniqueFonts);
    const swiftCode = `import AppKit; import Foundation; let input = ${JSON.stringify(jsonInput)}; if let data = input.data(using: .utf8), let fonts = try? JSONSerialization.jsonObject(with: data) as? [String] { for f in fonts { let exists = NSFont(name: f, size: 12) != nil; print("\\(f)\\t\\(exists)") } }`;
    const output = execSync(`swift -e ${JSON.stringify(swiftCode)}`, { encoding: 'utf-8', timeout: 5000 });
    const lines = output.trim().split('\n');
    const checkedSet = new Set<string>();
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const font = parts[0];
        const exists = parts[1];
        checkedSet.add(font);
        if (exists === 'true') {
          present.push(font);
        } else {
          missing.push(font);
        }
      }
    }
    if (checkedSet.size === uniqueFonts.length) {
      return { present, missing };
    }
  } catch {
    // Fallback if Swift check fails
  }

  // Fallback: fc-list check
  try {
    const fcOutput = execSync('fc-list || /usr/local/bin/fc-list', { encoding: 'utf-8', timeout: 5000 });
    for (const font of uniqueFonts) {
      if (fcOutput.includes(font)) {
        present.push(font);
      } else {
        missing.push(font);
      }
    }
    return { present, missing };
  } catch {
    // If no font tools work, report all fonts as missing to be safe
    return { present: [], missing: uniqueFonts };
  }
}

/**
  * Validates that all fonts referenced in an Apple Motion XML string exist on the host system.
  */
export function validateMotionXmlFonts(
  xml: string,
  options?: FontValidationOptions
): FontValidationResult {
  const referencedFonts = extractFontsFromMotionXml(xml);
  const { missing } = checkFontsAvailability(referencedFonts, options?.customChecker);

  const valid = missing.length === 0;

  if (!valid && !options?.allowMissing) {
    throw new Error(
      `Font(s) referenced in Motion file are missing from the system: ${missing.join(', ')}. Please install the required font(s) or update typography settings.`
    );
  }

  return {
    valid,
    referencedFonts,
    missingFonts: missing,
  };
}

export class FontValidator {
  public static extractFonts(xml: string): string[] {
    return extractFontsFromMotionXml(xml);
  }

  public static checkAvailability(
    fontNames: string[],
    customChecker?: (fontName: string) => boolean
  ): { present: string[]; missing: string[] } {
    return checkFontsAvailability(fontNames, customChecker);
  }

  public static validateXml(
    xml: string,
    options?: FontValidationOptions
  ): FontValidationResult {
    return validateMotionXmlFonts(xml, options);
  }
}
