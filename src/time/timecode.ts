/**
 * SMPTE 12M Timecode engine and broadcast frame-rate converter.
 *
 * Supports non-drop-frame (NDF) and drop-frame (DF) timecode for broadcast standards
 * (23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120 fps).
 *
 * Drop-frame timecode drops frames 00 and 01 at the start of each minute,
 * except every 10th minute (e.g. 00:01:00;02 instead of 00:01:00;00).
 */

export interface RationalFrameRate {
  readonly num: number;
  readonly den: number;
}

export const COMMON_FRAME_RATES = {
  FPS_23_976: { num: 24000, den: 1001 },
  FPS_24: { num: 24, den: 1 },
  FPS_25: { num: 25, den: 1 },
  FPS_29_97: { num: 30000, den: 1001 },
  FPS_30: { num: 30, den: 1 },
  FPS_48: { num: 48, den: 1 },
  FPS_50: { num: 50, den: 1 },
  FPS_59_94: { num: 60000, den: 1001 },
  FPS_60: { num: 60, den: 1 },
  FPS_120: { num: 120, den: 1 },
} as const;

export type StandardFrameRateKey = keyof typeof COMMON_FRAME_RATES;

/** Greatest common divisor helper. */
function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Creates a reduced rational frame rate. */
export function createFrameRate(num: number, den = 1): RationalFrameRate {
  if (den <= 0 || num <= 0) {
    return { num: 30, den: 1 };
  }
  const g = gcd(num, den);
  return { num: Math.round(num / g), den: Math.round(den / g) };
}

/** Returns the timecode base (frames counted per second in timecode display). */
export function getTimecodeBase(rate: RationalFrameRate): number {
  return Math.ceil(rate.num / rate.den);
}

/** Whether a given frame rate supports drop-frame counting (29.97, 59.94, etc.). */
export function supportsDropFrame(rate: RationalFrameRate): boolean {
  return rate.den === 1001 && getTimecodeBase(rate) % 30 === 0;
}

/** Number of dropped frames per minute (e.g. 2 for 29.97, 4 for 59.94). */
export function getDropFrameCount(rate: RationalFrameRate): number {
  const base = getTimecodeBase(rate);
  return Math.floor(base / 15);
}

export interface SMPTEFields {
  negative: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
}

/**
 * Converts a continuous frame count to SMPTE fields (hours, minutes, seconds, frames).
 */
export function framesToSMPTE(
  frame: number,
  rate: RationalFrameRate = COMMON_FRAME_RATES.FPS_30,
  dropFrame = false,
): SMPTEFields {
  const isDrop = dropFrame && supportsDropFrame(rate);
  const neg = frame < 0;
  let n = Math.abs(Math.round(frame));
  const base = getTimecodeBase(rate);
  const drop = getDropFrameCount(rate);

  if (isDrop) {
    const perMinute = base * 60 - drop;
    const per10Minutes = perMinute * 10 + drop;
    const d = Math.floor(n / per10Minutes);
    const m = n % per10Minutes;

    n += drop * 9 * d;
    if (m > drop) {
      n += drop * Math.floor((m - drop) / perMinute);
    }
  }

  const frames = n % base;
  const seconds = Math.floor(n / base) % 60;
  const minutes = Math.floor(n / (base * 60)) % 60;
  const hours = Math.floor(n / (base * 3600));

  return { negative: neg, hours, minutes, seconds, frames };
}

/**
 * Converts SMPTE fields back to a continuous frame number.
 */
export function smpteToFrames(
  fields: { hours: number; minutes: number; seconds: number; frames: number },
  rate: RationalFrameRate = COMMON_FRAME_RATES.FPS_30,
  dropFrame = false,
): number {
  const isDrop = dropFrame && supportsDropFrame(rate);
  const base = getTimecodeBase(rate);
  const drop = getDropFrameCount(rate);

  const totalSecs = fields.hours * 3600 + fields.minutes * 60 + fields.seconds;
  let n = totalSecs * base + fields.frames;

  if (isDrop) {
    const totalMinutes = fields.hours * 60 + fields.minutes;
    n -= drop * (totalMinutes - Math.floor(totalMinutes / 10));
  }

  return n;
}

/**
 * Formats a frame number as standard SMPTE timecode (HH:MM:SS:FF or HH;MM;SS;FF).
 */
export function formatTimecode(
  frame: number,
  rate: RationalFrameRate = COMMON_FRAME_RATES.FPS_30,
  dropFrame = false,
): string {
  const isDrop = dropFrame && supportsDropFrame(rate);
  const { negative, hours, minutes, seconds, frames } = framesToSMPTE(frame, rate, isDrop);
  const sep = isDrop ? ';' : ':';
  const base = getTimecodeBase(rate);
  const frameWidth = base >= 100 ? 3 : 2;

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');
  const fStr = String(frames).padStart(frameWidth, '0');

  return `${negative ? '-' : ''}${hStr}${sep}${mStr}${sep}${sStr}${sep}${fStr}`;
}

/**
 * Parses user or NLE input into a frame number.
 * Supports:
 * - Standard timecodes: `01:00:00:00`, `01;00;00;00`, `00.01.20.15`
 * - Right-aligned numbers: `1000` -> `00:00:10:00`
 * - Relative offsets: `+15` (+15 frames), `-1.00` (-1 second)
 *
 * @param input The timecode string to parse.
 * @param rate Rational frame rate (default: 30 fps).
 * @param dropFrame Whether drop-frame arithmetic applies.
 * @param currentFrame Current playhead position for relative additions.
 */
export function parseTimecode(
  input: string,
  rate: RationalFrameRate = COMMON_FRAME_RATES.FPS_30,
  dropFrame = false,
  currentFrame = 0,
): number {
  const s = input.trim();
  if (!s) {
    throw new Error('Empty timecode string');
  }

  let relativeSign: 1 | -1 | null = null;
  let body = s;
  if (s.startsWith('+')) {
    relativeSign = 1;
    body = s.slice(1);
  } else if (s.startsWith('-')) {
    relativeSign = -1;
    body = s.slice(1);
  }

  const parts = body.split(/[:;.,]/);
  let parsedFrame = 0;

  if (parts.length === 1) {
    const digits = parts[0]!;
    if (!/^\d+$/.test(digits)) {
      throw new Error(`Invalid timecode: "${input}"`);
    }

    if (relativeSign !== null) {
      // Relative bare digits are treated as frames
      const count = parseInt(digits, 10);
      return currentFrame + relativeSign * count;
    }

    // Right-aligned pairs: e.g. "1000" -> HH=0, MM=0, SS=10, FF=0
    const nums: number[] = [];
    let end = digits.length;
    while (end > 0) {
      const start = Math.max(0, end - 2);
      nums.unshift(parseInt(digits.slice(start, end), 10));
      end = start;
    }

    const padded = [0, 0, 0, 0];
    const offset = 4 - nums.length;
    for (let i = 0; i < nums.length; i++) {
      padded[offset + i] = nums[i]!;
    }
    const [h, m, sec, fr] = padded;
    parsedFrame = smpteToFrames(
      { hours: h!, minutes: m!, seconds: sec!, frames: fr! },
      rate,
      dropFrame,
    );
  } else {
    if (parts.length > 4) {
      throw new Error(`Too many timecode fields in "${input}"`);
    }
    const nums = parts.map((p) => (p.length === 0 ? 0 : parseInt(p, 10)));
    if (nums.some((n) => isNaN(n))) {
      throw new Error(`Invalid number in timecode: "${input}"`);
    }

    const padded = [0, 0, 0, 0];
    const offset = 4 - nums.length;
    for (let i = 0; i < nums.length; i++) {
      padded[offset + i] = nums[i]!;
    }
    const [h, m, sec, fr] = padded;
    parsedFrame = smpteToFrames(
      { hours: h!, minutes: m!, seconds: sec!, frames: fr! },
      rate,
      dropFrame,
    );
  }

  if (relativeSign !== null) {
    return currentFrame + relativeSign * parsedFrame;
  }

  return parsedFrame;
}
