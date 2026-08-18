import { z } from 'zod';

/**
 * Color definition schema supporting hex strings (e.g. "#FFE600") or RGB ratios (0.0 to 1.0).
 */
export const ColorSchema = z.union([
  z.string().describe('Hex color code e.g. #FFE600 or #000000'),
  z.object({
    r: z.number().min(0).max(1).describe('Red color component between 0.0 and 1.0'),
    g: z.number().min(0).max(1).describe('Green color component between 0.0 and 1.0'),
    b: z.number().min(0).max(1).describe('Blue color component between 0.0 and 1.0'),
    alpha: z.number().min(0).max(1).default(1.0).describe('Alpha component between 0.0 and 1.0'),
  }),
]);

export type ColorSpec = z.infer<typeof ColorSchema>;

/**
 * Palette configuration for the motion graphics composition.
 */
export const PaletteSchema = z.object({
  /** Primary canvas background color */
  backgroundColor: ColorSchema.default('#FFE600'),
  /** Primary text color */
  primaryColor: ColorSchema.default('#000000'),
  /** Secondary text or backdrop card color */
  secondaryColor: ColorSchema.default('#FF0055'),
  /** Accent color for badges and corner decorations */
  accentColor: ColorSchema.default('#00FF66'),
  /** Border and hard-shadow color */
  borderColor: ColorSchema.default('#000000'),
});

export type PaletteSpec = z.infer<typeof PaletteSchema>;

/**
 * Canvas dimensions and frame rate settings.
 */
export const CanvasSchema = z.object({
  /** Width of the composition in pixels */
  width: z.number().int().positive().default(1920),
  /** Height of the composition in pixels */
  height: z.number().int().positive().default(1080),
  /** Timeline duration in seconds */
  durationSeconds: z.number().positive().default(10),
  /** Frame rate (frames per second) */
  fps: z.number().int().positive().default(30),
});

export type CanvasSpec = z.infer<typeof CanvasSchema>;

/**
 * Typography configuration for text elements.
 */
export const TypographySchema = z.object({
  /** Main title font family name installed on macOS */
  titleFont: z.string().default('Impact'),
  /** Subtitle font family name */
  subtitleFont: z.string().default('Arial-Black'),
  /** Font family for badges and stickers */
  badgeFont: z.string().default('Helvetica-Bold'),
});

export type TypographySpec = z.infer<typeof TypographySchema>;

/**
 * Animation and motion behavior rules.
 */
export const AnimationSchema = z.object({
  /** Style of text and element entrance */
  entrance: z.enum(['pop-overshoot', 'snap', 'fade', 'typewriter']).default('pop-overshoot'),
  /** Intensity of oscillating/wiggle motion applied to stickers (0.0 to 1.0) */
  wiggleIntensity: z.number().min(0).max(1).default(0.5),
});

export type AnimationSpec = z.infer<typeof AnimationSchema>;

/**
 * Complete specification required to compile an Apple Motion project (.motn).
 */
export const MotionSpecSchema = z.object({
  /** Primary title text displayed prominently */
  title: z.string().min(1).describe('Primary title string e.g. SLOP MACHINE'),
  /** Secondary subtitle text placed beneath main title */
  subtitle: z.string().optional().describe('Subtitle string e.g. ★ MAXIMUM SLOP ★'),
  /** Array of sticker badge or tagline strings */
  badges: z.array(z.string()).default(['SYSTEM ERROR // 100% RAW', 'VER 2.0 // NO CAP']),
  /** Optional background media image or video file path */
  bgMedia: z.string().optional().describe('Absolute or relative file path to background image or video asset'),
  /** Design aesthetic style preset */
  style: z.enum(['neubrutalist', 'cyberpunk', 'minimalist', 'retro', 'synthwave', 'bold-clean']).default('neubrutalist'),
  /** Color palette settings */
  palette: PaletteSchema.default({
    backgroundColor: '#FFE600',
    primaryColor: '#000000',
    secondaryColor: '#FF0055',
    accentColor: '#00FF66',
    borderColor: '#000000',
  }),
  /** Canvas settings */
  canvas: CanvasSchema.default({
    width: 1920,
    height: 1080,
    durationSeconds: 10,
    fps: 30,
  }),
  /** Typography settings */
  typography: TypographySchema.default({
    titleFont: 'Impact',
    subtitleFont: 'Arial-Black',
    badgeFont: 'Helvetica-Bold',
  }),
  /** Animation settings */
  animation: AnimationSchema.default({
    entrance: 'pop-overshoot',
    wiggleIntensity: 0.5,
  }),
});

export type MotionSpec = z.infer<typeof MotionSpecSchema>;
