/**
 * Sound as shaders see it: `iAudio` (level, bass, mid and treble, 0–1,
 * smoothed), `iSpectrum[16]` (64 log-spaced frequency bins, 0–1, four to a
 * `vec4`, low to high) and `iBeat` (seconds since the last beat on the bass,
 * -1 before the first).
 *
 * {@link AudioAnalysis} turns frequency data (an `AnalyserNode`'s, or an
 * FFT's) into those uniforms, deterministically for given data and times.
 * {@link LiveAudio} feeds it from a playing media element, a microphone or
 * any Web Audio node (what `ShaderRenderer.setAudioSource` uses), and
 * {@link analyseAudioBuffer} from a decoded `AudioBuffer` offline, frame-exact
 * for recordings.
 *
 * With no audio at all every audio uniform is zero, `iBeat` included, so an
 * audio-reactive effect can tell silence from "nothing connected" (where
 * `iBeat` is -1 or above 0) and play an idle demo instead.
 */

/** How many frequency bins `iSpectrum` holds (16 `vec4`s). */
export const SPECTRUM_BINS = 64;

/** One frame of the audio uniforms. */
export interface AudioFrame {
  /** `iAudio`: level (loudness, 0–1), bass, mid, treble (0–1), smoothed. */
  audio: readonly [number, number, number, number];
  /** `iSpectrum`: {@link SPECTRUM_BINS} values, 0–1, low to high (log-spaced). */
  spectrum: Float32Array;
  /** `iBeat`: seconds since the last beat, or -1 before the first. */
  beat: number;
}

export interface AudioAnalysisOptions {
  /** The sample rate of the audio analysed, in Hz (default 48000). */
  sampleRate?: number;
  /** The FFT size the frequency data came from (default 2048: `fftSize / 2` values). */
  fftSize?: number;
  /** Decibels that read as 0 and 1 for float (dB) frequency data (default -100 and -30, as `AnalyserNode`). */
  minDecibels?: number;
  maxDecibels?: number;
  /** Seconds a value takes to rise most of the way to a louder reading (default 0.03). */
  attack?: number;
  /** Seconds a value takes to fall most of the way to a quieter one (default 0.25). */
  release?: number;
  /** The lowest and highest frequencies the spectrum covers, in Hz (default 30 and 16000). */
  minHz?: number;
  maxHz?: number;
  /**
   * How far the bass must jump over its recent average to count as a beat,
   * 0–1 (default 0.12). Lower finds more beats.
   */
  beatThreshold?: number;
  /** The least time between two beats, in seconds (default 0.22: about 270 beats a minute). */
  beatGap?: number;
}

/** The bands `iAudio` averages, in Hz. */
export const AUDIO_BANDS = { bass: [20, 250], mid: [250, 2000], treble: [2000, 16000] } as const;

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/**
 * Turns frequency data into the audio uniforms: 64 log-spaced bins, band
 * averages, attack and release smoothing, a loudness level, and simple beat
 * detection (onsets on the bass band, over its recent average). Feed it
 * frequency data with the time it was read, in seconds, increasing; read
 * {@link AudioAnalysis.frame} for the uniforms. The same data at the same
 * times always gives the same uniforms.
 *
 * ```ts
 * const analysis = new AudioAnalysis({ sampleRate: ctx.sampleRate, fftSize: analyser.fftSize });
 * analyser.getFloatFrequencyData(freq);
 * analysis.update(freq, performance.now() / 1000);
 * const { audio, spectrum, beat } = analysis.frame(performance.now() / 1000);
 * ```
 */
export class AudioAnalysis {
  readonly sampleRate: number;
  readonly fftSize: number;
  private readonly minDb: number;
  private readonly maxDb: number;
  private readonly attack: number;
  private readonly release: number;
  private readonly beatThreshold: number;
  private readonly beatGap: number;
  /** Each spectrum bin's range of FFT bins, [from, to), fractional. */
  private readonly ranges: [number, number][];
  private readonly bands: [number, number][];
  private readonly raw = new Float32Array(SPECTRUM_BINS);
  private readonly smoothed = new Float32Array(SPECTRUM_BINS);
  private values: [number, number, number, number] = [0, 0, 0, 0];
  private last: number | undefined;
  private bassAverage = 0;
  private armed = true;
  private lastBeat: number | undefined;
  private normalised = new Float32Array(0);

  constructor(options: AudioAnalysisOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48000;
    this.fftSize = options.fftSize ?? 2048;
    this.minDb = options.minDecibels ?? -100;
    this.maxDb = options.maxDecibels ?? -30;
    this.attack = options.attack ?? 0.03;
    this.release = options.release ?? 0.25;
    this.beatThreshold = options.beatThreshold ?? 0.12;
    this.beatGap = options.beatGap ?? 0.22;
    const binHz = this.sampleRate / this.fftSize;
    const minHz = options.minHz ?? 30;
    const maxHz = Math.min(options.maxHz ?? 16000, this.sampleRate / 2);
    this.ranges = Array.from({ length: SPECTRUM_BINS }, (_, i) => {
      const f0 = minHz * (maxHz / minHz) ** (i / SPECTRUM_BINS);
      const f1 = minHz * (maxHz / minHz) ** ((i + 1) / SPECTRUM_BINS);
      return [f0 / binHz, f1 / binHz];
    });
    this.bands = [AUDIO_BANDS.bass, AUDIO_BANDS.mid, AUDIO_BANDS.treble].map(([a, b]) => [a / binHz, Math.min(b, this.sampleRate / 2) / binHz]);
  }

  /** Forgets everything heard: the next update starts afresh. */
  reset() {
    this.smoothed.fill(0);
    this.values = [0, 0, 0, 0];
    this.last = undefined;
    this.bassAverage = 0;
    this.armed = true;
    this.lastBeat = undefined;
  }

  /**
   * Takes one reading at `time` seconds: `frequency` is `fftSize / 2`
   * values, bytes 0–255 (`getByteFrequencyData`) or decibels
   * (`getFloatFrequencyData`). `waveform` (time-domain samples, -1–1, or
   * bytes centred on 128) gives the level its RMS; without it the level
   * comes from the spectrum.
   */
  update(frequency: Uint8Array | Float32Array, time: number, waveform?: Uint8Array | Float32Array) {
    const n = frequency.length;
    if (this.normalised.length !== n) this.normalised = new Float32Array(n);
    const v = this.normalised;
    if (frequency instanceof Uint8Array) for (let i = 0; i < n; i++) v[i] = frequency[i]! / 255;
    else {
      const range = this.maxDb - this.minDb;
      for (let i = 0; i < n; i++) {
        const db = frequency[i]!;
        v[i] = Number.isFinite(db) ? clamp01((db - this.minDb) / range) : 0;
      }
    }
    // Log bins: the loudest FFT bin in each, or between the two nearest where a bin is narrower than one.
    for (let b = 0; b < SPECTRUM_BINS; b++) {
      const [k0, k1] = this.ranges[b]!;
      const from = Math.ceil(k0);
      const to = Math.min(n - 1, Math.floor(k1));
      let value = 0;
      if (to >= from) for (let k = from; k <= to; k++) value = Math.max(value, v[k]!);
      else {
        const k = Math.min(n - 1.001, (k0 + k1) / 2);
        const i = Math.floor(k);
        value = v[i]! + (v[Math.min(n - 1, i + 1)]! - v[i]!) * (k - i);
      }
      this.raw[b] = value;
    }
    const band = ([k0, k1]: [number, number]) => {
      const from = Math.max(0, Math.ceil(k0));
      const to = Math.min(n - 1, Math.floor(k1));
      let sum = 0;
      for (let k = from; k <= to; k++) sum += v[k]!;
      return to >= from ? sum / (to - from + 1) : 0;
    };
    const bass = band(this.bands[0]!);
    const mid = band(this.bands[1]!);
    const treble = band(this.bands[2]!);
    let level: number;
    if (waveform && waveform.length) {
      let sum = 0;
      const bytes = waveform instanceof Uint8Array;
      for (let i = 0; i < waveform.length; i++) {
        const s = bytes ? (waveform[i]! - 128) / 128 : waveform[i]!;
        sum += s * s;
      }
      level = rmsLevel(Math.sqrt(sum / waveform.length));
    } else {
      let sum = 0;
      for (let b = 0; b < SPECTRUM_BINS; b++) sum += this.raw[b]! * this.raw[b]!;
      level = Math.sqrt(sum / SPECTRUM_BINS);
    }

    const dt = this.last === undefined ? Infinity : Math.max(0, time - this.last);
    const rise = 1 - Math.exp(-dt / this.attack);
    const fall = 1 - Math.exp(-dt / this.release);
    const ease = (from: number, to: number) => from + (to - from) * (to > from ? rise : fall);
    for (let b = 0; b < SPECTRUM_BINS; b++) this.smoothed[b] = ease(this.smoothed[b]!, this.raw[b]!);
    const [l, bs, m, t] = this.values;
    this.values = [ease(l, level), ease(bs, bass), ease(m, mid), ease(t, treble)];

    // Beats: the bass jumping over its average of the last half second or so, once until it settles back.
    const onset = bass - this.bassAverage;
    const threshold = this.beatThreshold + 0.15 * this.bassAverage;
    if (this.last !== undefined && this.armed && onset > threshold && bass > 0.2 && (this.lastBeat === undefined || time - this.lastBeat >= this.beatGap)) {
      this.lastBeat = time;
      this.armed = false;
    } else if (onset < threshold * 0.5) this.armed = true;
    this.bassAverage = this.last === undefined ? bass : this.bassAverage + (bass - this.bassAverage) * (1 - Math.exp(-dt / 0.6));
    this.last = time;
  }

  /** The uniforms after the latest update, with `iBeat` measured to `time` (default the latest update's). */
  frame(time = this.last ?? 0): AudioFrame {
    return {
      audio: [...this.values],
      spectrum: Float32Array.from(this.smoothed),
      beat: this.lastBeat === undefined ? -1 : Math.max(0, time - this.lastBeat),
    };
  }
}

/** Loudness from an RMS amplitude: 0 at -60 dBFS (or below), 1 at full scale. */
export function rmsLevel(rms: number): number {
  return rms > 0 ? clamp01(1 + (20 * Math.log10(rms)) / 60) : 0;
}

// ==========================================
// FFT
// ==========================================

const fftTables = new Map<number, { reverse: Uint32Array; cos: Float64Array; sin: Float64Array }>();

/**
 * An in-place radix-2 FFT of `re` and `im` (their length a power of two).
 * Forward, unscaled: `X[k] = Σ x[n] e^(-2πikn/N)`.
 */
export function fft(re: Float32Array | Float64Array, im: Float32Array | Float64Array) {
  const n = re.length;
  if (n !== im.length || n < 2 || (n & (n - 1)) !== 0) throw new RangeError(`An FFT needs two arrays of one power-of-two length (got ${re.length} and ${im.length}).`);
  let table = fftTables.get(n);
  if (!table) {
    const bits = Math.log2(n);
    const reverse = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >>> b) & 1);
      reverse[i] = r;
    }
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    fftTables.set(n, (table = { reverse, cos, sin }));
  }
  const { reverse, cos, sin } = table;
  for (let i = 0; i < n; i++) {
    const j = reverse[i]!;
    if (j > i) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step]!;
        const wi = sin[k * step]!;
        const a = start + k;
        const b = a + half;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
}

const windows = new Map<number, Float32Array>();

/** The Blackman window `AnalyserNode` applies before its FFT. */
function blackman(n: number): Float32Array {
  let w = windows.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
    windows.set(n, w);
  }
  return w;
}

/**
 * The decibel spectrum of the `fftSize` samples of `samples` ending at
 * `end` (exclusive; samples before the start are silence), as
 * `AnalyserNode.getFloatFrequencyData` gives it with no smoothing: a
 * Blackman window, an FFT, magnitudes over `fftSize`, in dB. Writes
 * `fftSize / 2` values into `out`, and the window's samples into `waveform`
 * when given.
 */
export function frequencyData(samples: Float32Array, end: number, fftSize: number, out: Float32Array, waveform?: Float32Array) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const w = blackman(fftSize);
  const start = end - fftSize;
  for (let i = 0; i < fftSize; i++) {
    const at = start + i;
    const s = at >= 0 && at < samples.length ? samples[at]! : 0;
    if (waveform) waveform[i] = s;
    re[i] = s * w[i]!;
  }
  fft(re, im);
  for (let k = 0; k < fftSize / 2; k++) {
    const mag = Math.hypot(re[k]!, im[k]!) / fftSize;
    out[k] = mag > 0 ? 20 * Math.log10(mag) : -Infinity;
  }
}

/** What {@link analyseAudioBuffer} reads: an `AudioBuffer`, or anything shaped like one. */
export interface AudioSamples {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferAnalysisOptions extends Omit<AudioAnalysisOptions, "sampleRate"> {
  /** Readings per second (default 120). Recordings sample the reading at or just before each frame. */
  rate?: number;
}

/** The audio uniforms of a whole decoded track, at any time (see {@link analyseAudioBuffer}). */
export interface AudioBufferAnalysis {
  /** The track's length in seconds. */
  readonly duration: number;
  /** The uniforms at `time` seconds into the track (silence before 0 and after the end). */
  at(time: number): AudioFrame;
}

/**
 * Analyses a decoded track offline, so a recording of an audio-reactive
 * effect follows the sound frame for frame: the uniforms at time `t` come
 * from an FFT of the samples just before `t`, as a live `AnalyserNode`
 * would hear them, through an {@link AudioAnalysis} stepped at a fixed
 * `rate` from the start of the track. Readings are worked out as far as
 * asked and kept, so asking for frames in any order gives the same answer.
 *
 * ```ts
 * const track = analyseAudioBuffer(await ctx.decodeAudioData(bytes));
 * frames.render(t, { audio: track.at(t) });
 * ```
 */
export function analyseAudioBuffer(buffer: AudioSamples, options: AudioBufferAnalysisOptions = {}): AudioBufferAnalysis {
  const fftSize = options.fftSize ?? 2048;
  const rate = options.rate ?? 120;
  const { sampleRate, length } = buffer;
  // Mono: the channels' average.
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i]! += data[i]! / buffer.numberOfChannels;
  }
  const analysis = new AudioAnalysis({ ...options, sampleRate, fftSize });
  const freq = new Float32Array(fftSize / 2);
  const wave = new Float32Array(fftSize);
  /** Each reading: level, bass, mid, treble, the spectrum, and the last beat's time (NaN for none). */
  const stride = 4 + SPECTRUM_BINS + 1;
  let readings = new Float32Array(stride * 256);
  let count = 0;
  const step = () => {
    const time = count / rate;
    frequencyData(mono, Math.round(time * sampleRate), fftSize, freq, wave);
    analysis.update(freq, time, wave);
    const f = analysis.frame(time);
    if ((count + 1) * stride > readings.length) {
      const grown = new Float32Array(readings.length * 2);
      grown.set(readings);
      readings = grown;
    }
    const at = count * stride;
    readings.set(f.audio, at);
    readings.set(f.spectrum, at + 4);
    readings[at + stride - 1] = f.beat < 0 ? NaN : time - f.beat;
    count++;
  };
  return {
    duration: length / sampleRate,
    at(time) {
      const index = Math.max(0, Math.floor(time * rate + 1e-6));
      while (count <= index) step();
      const at = index * stride;
      const lastBeat = readings[at + stride - 1]!;
      return {
        audio: [readings[at]!, readings[at + 1]!, readings[at + 2]!, readings[at + 3]!],
        spectrum: readings.slice(at + 4, at + 4 + SPECTRUM_BINS),
        beat: Number.isNaN(lastBeat) || time < 0 ? -1 : Math.max(0, time - lastBeat),
      };
    },
  };
}

// ==========================================
// Live audio (browser)
// ==========================================

/** What `ShaderRenderer.setAudioSource` listens to: a media element (it keeps playing to the speakers), a stream (a microphone: not played) or any Web Audio node. */
export type AudioSource = HTMLMediaElement | MediaStream | AudioNode;

let shared: AudioContext | undefined;

/**
 * The `AudioContext` Flair listens with, made on first use and shared by
 * every renderer (browsers limit how many a page may have). Make nodes in it
 * to pass to `setAudioSource` (an oscillator, a decoded buffer). Browsers
 * start it suspended until the page has had a click or key press: Flair
 * resumes it on the first one, or call `resume()` from your own gesture.
 * Closing it is allowed: the next use makes a new one.
 */
export function sharedAudioContext(): AudioContext {
  // A closed context (someone closed it) cannot be resumed: start a new one.
  if (!shared || shared.state === "closed") {
    const Context = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) throw new Error("This browser has no Web Audio (AudioContext), so effects cannot hear audio.");
    shared = new Context();
    const ctx = shared;
    const resume = () => {
      if (ctx.state === "running") return;
      void ctx.resume().catch(() => undefined);
    };
    if (typeof window !== "undefined") {
      for (const type of ["pointerdown", "keydown", "touchend"] as const) window.addEventListener(type, resume, { capture: true, passive: true });
      ctx.addEventListener?.("statechange", () => {
        if (ctx.state !== "running") return;
        for (const type of ["pointerdown", "keydown", "touchend"] as const) window.removeEventListener(type, resume, { capture: true });
      });
    }
  }
  return shared;
}

/** A media element can only be wired into Web Audio once, ever: its source node, kept. */
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/**
 * Listens to a live {@link AudioSource} through an `AnalyserNode` (in the
 * shared context, or the node's own) and reads the audio uniforms from it.
 * A media element keeps playing to the speakers through Web Audio; a stream
 * (a microphone) is only listened to. A media element from another site
 * needs `crossOrigin = "anonymous"` and CORS, or the browser feeds silence.
 */
export class LiveAudio {
  readonly context: BaseAudioContext;
  readonly analyser: AnalyserNode;
  private readonly analysis: AudioAnalysis;
  private readonly input: AudioNode;
  private readonly ownsInput: boolean;
  private readonly freq: Float32Array<ArrayBuffer>;
  private readonly wave: Float32Array<ArrayBuffer>;

  constructor(source: AudioSource, options: AudioAnalysisOptions = {}) {
    const isNode = typeof AudioNode !== "undefined" && source instanceof AudioNode;
    const context = isNode ? (source as AudioNode).context : sharedAudioContext();
    this.context = context;
    if (isNode) {
      this.input = source as AudioNode;
      this.ownsInput = false;
    } else if (typeof MediaStream !== "undefined" && source instanceof MediaStream) {
      this.input = (context as AudioContext).createMediaStreamSource(source);
      this.ownsInput = true;
    } else {
      const element = source as HTMLMediaElement;
      let node = elementSources.get(element);
      if (!node) {
        node = (context as AudioContext).createMediaElementSource(element);
        // Wired into Web Audio, the element is heard only through it: keep it playing to the speakers.
        node.connect(context.destination);
        elementSources.set(element, node);
      }
      this.input = node;
      this.ownsInput = false;
    }
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = options.fftSize ?? 2048;
    // No smoothing here: AudioAnalysis smooths, the same live as offline.
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.minDecibels = options.minDecibels ?? -100;
    this.analyser.maxDecibels = options.maxDecibels ?? -30;
    this.input.connect(this.analyser);
    this.analysis = new AudioAnalysis({ ...options, sampleRate: context.sampleRate, fftSize: this.analyser.fftSize });
    this.freq = new Float32Array(this.analyser.frequencyBinCount);
    this.wave = new Float32Array(this.analyser.fftSize);
    if ("resume" in context && context.state === "suspended") void (context as AudioContext).resume().catch(() => undefined);
  }

  /** Reads the analyser now and returns the uniforms, `time` in seconds (a steady clock, such as `performance.now() / 1000`). */
  read(time: number): AudioFrame {
    this.analyser.getFloatFrequencyData(this.freq);
    this.analyser.getFloatTimeDomainData(this.wave);
    this.analysis.update(this.freq, time, this.wave);
    return this.analysis.frame(time);
  }

  /** Stops listening. A media element goes on playing to the speakers. */
  dispose() {
    try {
      this.input.disconnect(this.analyser);
    } catch {
      // Already disconnected.
    }
    if (this.ownsInput) this.input.disconnect();
  }
}
