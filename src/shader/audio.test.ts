import { describe, expect, it } from "vitest";
import { analyseAudioBuffer, AudioAnalysis, fft, frequencyData, rmsLevel, SPECTRUM_BINS, type AudioSamples } from "./audio.js";

/** A mono buffer from a function of time. */
function buffer(seconds: number, f: (t: number) => number, sampleRate = 48000): AudioSamples {
  const data = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < data.length; i++) data[i] = f(i / sampleRate);
  return { sampleRate, length: data.length, numberOfChannels: 1, getChannelData: () => data };
}

/** A kick (a decaying 60 Hz thump) every half second from 0.25 s, over a quiet 6 kHz hiss. */
const kicks = (t: number) => {
  const since = (t - 0.25) % 0.5;
  const kick = t >= 0.25 && since < 0.12 ? Math.sin(2 * Math.PI * 60 * since) * Math.exp(-since * 20) * 0.9 : 0;
  return kick + 0.05 * Math.sin(2 * Math.PI * 6000 * t);
};

describe("fft", () => {
  it("finds a sine's frequency", () => {
    const n = 256;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 10 * i) / n);
    fft(re, im);
    const mags = Array.from(re, (r, k) => Math.hypot(r, im[k]!));
    expect(mags[10]).toBeCloseTo(n / 2, 6);
    expect(mags[246]).toBeCloseTo(n / 2, 6);
    expect(mags[3]).toBeCloseTo(0, 6);
  });

  it("refuses lengths that are not a power of two", () => {
    expect(() => fft(new Float32Array(6), new Float32Array(6))).toThrow(/power-of-two/);
  });
});

describe("AudioAnalysis", () => {
  it("reads byte data as 0–1, into 64 bins and three bands", () => {
    const a = new AudioAnalysis();
    const full = new Uint8Array(1024).fill(255);
    a.update(full, 0);
    const f = a.frame();
    expect(f.spectrum).toHaveLength(SPECTRUM_BINS);
    expect(Array.from(f.spectrum).every((v) => v === 1)).toBe(true);
    expect(f.audio.slice(1)).toEqual([1, 1, 1]);
    expect(f.beat).toBe(-1);
  });

  it("reads decibels between its floor and ceiling", () => {
    const a = new AudioAnalysis({ minDecibels: -100, maxDecibels: -30 });
    a.update(new Float32Array(1024).fill(-65), 0);
    expect(a.frame().spectrum[10]).toBeCloseTo(0.5, 5);
    a.reset();
    a.update(new Float32Array(1024).fill(-Infinity), 0);
    expect(a.frame().spectrum[10]).toBe(0);
  });

  it("puts a tone in its band and bin, low to high", () => {
    const a = new AudioAnalysis({ sampleRate: 48000, fftSize: 2048 });
    const data = new Uint8Array(1024);
    // 4 kHz is FFT bin 4000 / (48000 / 2048) ≈ 171.
    data[171] = 255;
    a.update(data, 0);
    const f = a.frame();
    expect(f.audio[3]).toBeGreaterThan(0);
    expect(f.audio[1]).toBe(0);
    const loudest = Array.from(f.spectrum).indexOf(Math.max(...f.spectrum));
    expect(loudest).toBeGreaterThan(40);
    expect(loudest).toBeLessThan(52);
  });

  it("rises quickly and falls slowly", () => {
    const a = new AudioAnalysis({ attack: 0.02, release: 0.5 });
    a.update(new Uint8Array(1024), 0);
    a.update(new Uint8Array(1024).fill(255), 0.05);
    const up = a.frame().audio[1];
    expect(up).toBeGreaterThan(0.9);
    a.update(new Uint8Array(1024), 0.1);
    const down = a.frame().audio[1];
    expect(down).toBeGreaterThan(0.8);
    expect(down).toBeLessThan(up);
  });

  it("is deterministic for given data and times", () => {
    const run = () => {
      const a = new AudioAnalysis();
      const out: number[] = [];
      for (let i = 0; i < 30; i++) {
        a.update(Uint8Array.from({ length: 1024 }, (_, k) => (i * 37 + k * 11) % 256), i / 60);
        out.push(...a.frame().audio, a.frame().beat);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it("finds beats on the bass, and not in between", () => {
    const a = new AudioAnalysis();
    const beats: number[] = [];
    let last = -1;
    for (let i = 0; i <= 180; i++) {
      const t = i / 60;
      const kick = t % 0.5 < 0.08;
      const data = new Uint8Array(1024).fill(40);
      // The bass band is FFT bins 1–10 at 48 kHz / 2048.
      if (kick) for (let k = 0; k < 12; k++) data[k] = 240;
      a.update(data, t);
      const beat = a.frame(t).beat;
      if (beat === 0 && t !== last) beats.push(+t.toFixed(3));
      last = t;
    }
    expect(beats).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it("measures the time since the last beat", () => {
    const a = new AudioAnalysis();
    a.update(new Uint8Array(1024).fill(10), 0);
    a.update(new Uint8Array(1024).fill(250), 0.1);
    expect(a.frame(0.1).beat).toBe(0);
    expect(a.frame(0.35).beat).toBeCloseTo(0.25);
  });
});

describe("rmsLevel", () => {
  it("is 1 at full scale, 0 in silence and below -60 dB", () => {
    expect(rmsLevel(1)).toBe(1);
    expect(rmsLevel(0.1)).toBeCloseTo(2 / 3);
    expect(rmsLevel(0.0005)).toBe(0);
    expect(rmsLevel(0)).toBe(0);
  });
});

describe("frequencyData", () => {
  it("gives a full-scale sine about -6 dB less the window's loss at its bin, as AnalyserNode does", () => {
    const b = buffer(0.1, (t) => Math.sin(2 * Math.PI * 1500 * t));
    const out = new Float32Array(1024);
    frequencyData(b.getChannelData(0), 4096, 2048, out);
    // 1500 Hz is bin 64 at 48 kHz / 2048.
    const peak = Array.from(out).indexOf(Math.max(...out));
    expect(peak).toBe(64);
    // Amplitude 1, halved by the FFT's symmetry and scaled by the Blackman window's 0.42: about -13.6 dB.
    expect(out[64]).toBeCloseTo(20 * Math.log10(0.5 * 0.42), 0);
  });
});

describe("analyseAudioBuffer", () => {
  const track = () => analyseAudioBuffer(buffer(2.2, kicks));

  it("follows the sound: bass on each kick, quiet between, treble from the hiss", () => {
    const a = track();
    expect(a.duration).toBeCloseTo(2.2);
    const onKick = a.at(0.3);
    const between = a.at(0.7);
    expect(onKick.audio[1]).toBeGreaterThan(0.4);
    expect(between.audio[1]).toBeLessThan(onKick.audio[1] * 0.6);
    expect(between.spectrum[54]).toBeGreaterThan(0.5); // 6 kHz
    expect(onKick.audio[0]).toBeGreaterThan(between.audio[0]);
    expect(onKick.spectrum).toHaveLength(SPECTRUM_BINS);
  });

  it("finds a beat at each kick", () => {
    const a = track();
    expect(a.at(0.2).beat).toBe(-1);
    for (const kick of [0.25, 0.75, 1.25, 1.75]) {
      const b = a.at(kick + 0.1).beat;
      expect(b, `kick at ${kick}`).toBeGreaterThanOrEqual(0.03);
      expect(b, `kick at ${kick}`).toBeLessThanOrEqual(0.1);
    }
  });

  it("gives the same frame for a time, asked in any order", () => {
    const forward = track();
    const backward = track();
    const times = [0.1, 0.5, 0.95, 1.3, 2];
    const a = times.map((t) => forward.at(t));
    const b = [...times].reverse().map((t) => backward.at(t)).reverse();
    expect(a).toEqual(b);
  });

  it("is silence before the start and after the end", () => {
    const a = track();
    expect(a.at(-1).audio).toEqual([0, 0, 0, 0]);
    expect(a.at(4).audio[0]).toBeLessThan(0.01);
  });
});
