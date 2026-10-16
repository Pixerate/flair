/**
 * A small MP4 (ISO BMFF) writer for one H.264 video track, and optionally
 * one AAC audio track, with no dependencies, for video encoded in the
 * browser (WebCodecs' `VideoEncoder` with `avc: { format: "avc" }`, and
 * `AudioEncoder` with `mp4a.40.2`).
 *
 * The file is "faststart": `ftyp`, then `moov` (the index), then one `mdat`
 * holding every video sample in a single chunk (then every audio sample in
 * another), so a page can start playing it before it has all arrived.
 * Samples are in presentation order (browser encoders make no B-frames), so
 * there is no `ctts`.
 */

/** One encoded frame: its bytes (length-prefixed NAL units), when it shows, and whether it is a keyframe. */
export interface Mp4Sample {
  data: Uint8Array;
  /** Presentation time in microseconds (WebCodecs' `timestamp`). */
  timestamp: number;
  /** How long it shows, in microseconds (default: until the next sample, or the one before's). */
  duration?: number;
  key: boolean;
}

export interface Mp4Options {
  width: number;
  height: number;
  /** The `avcC` record: the encoder's `decoderConfig.description`. */
  avcC: Uint8Array;
  samples: readonly Mp4Sample[];
  /** Ticks per second of the track's times (default 90000, as for broadcast video). */
  timescale?: number;
  /** An AAC sound track to go with the picture. */
  audio?: Mp4AudioTrack;
}

/** AAC audio for {@link muxMp4}: WebCodecs `AudioEncoder` output with codec `mp4a.40.2`. */
export interface Mp4AudioTrack {
  sampleRate: number;
  channels: number;
  /**
   * The AudioSpecificConfig: the encoder's `decoderConfig.description`
   * (default: AAC-LC at this rate and channel count).
   */
  config?: Uint8Array;
  /** Raw AAC frames; `key` is ignored (every AAC frame is a sync sample). */
  samples: readonly Mp4Sample[];
}

const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** An AAC-LC AudioSpecificConfig: object type 2, the rate's index, the channel count. */
export function aacConfig(sampleRate: number, channels: number): Uint8Array {
  const index = AAC_RATES.indexOf(sampleRate);
  if (index < 0) throw new Error(`AAC has no standard rate of ${sampleRate} Hz; resample to 48000 or 44100.`);
  return Uint8Array.of((2 << 3) | (index >> 1), ((index & 1) << 7) | (channels << 3));
}

const MOVIE_TIMESCALE = 1000;
const UINT32 = 0x1_0000_0000;

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** Big-endian fields, written into a growing list of parts. */
class Writer {
  parts: Uint8Array[] = [];
  size = 0;
  bytes(b: Uint8Array) {
    this.parts.push(b);
    this.size += b.length;
    return this;
  }
  u8(n: number) {
    return this.bytes(Uint8Array.of(n & 0xff));
  }
  u16(n: number) {
    return this.bytes(Uint8Array.of((n >>> 8) & 0xff, n & 0xff));
  }
  u32(n: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0);
    return this.bytes(b);
  }
  u64(n: number) {
    return this.u32(Math.floor(n / UINT32)).u32(n % UINT32);
  }
  zeros(n: number) {
    return this.bytes(new Uint8Array(n));
  }
  done(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const p of this.parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}

/** A box: size, type, then its fields and children. */
function box(type: string, ...content: Uint8Array[]): Uint8Array {
  const w = new Writer();
  const size = 8 + content.reduce((n, c) => n + c.length, 0);
  w.u32(size).bytes(ascii(type));
  for (const c of content) w.bytes(c);
  return w.done();
}

/** A full box: a box whose fields start with a version and flags. */
function fullBox(type: string, version: number, flags: number, ...content: Uint8Array[]): Uint8Array {
  return box(type, Uint8Array.of(version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff), ...content);
}

const fields = (fill: (w: Writer) => unknown) => {
  const w = new Writer();
  fill(w);
  return w.done();
};

/** The identity transform, as `tkhd` and `mvhd` write it (16.16 and 2.30 fixed point). */
const MATRIX = fields((w) => [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].forEach((n) => w.u32(n)));

/**
 * Each sample's duration in track ticks, from the gaps between timestamps
 * (the last keeps its own duration, or the gap before it).
 */
function sampleTicks(samples: readonly Mp4Sample[], timescale: number): number[] {
  const tick = (us: number) => Math.round((us * timescale) / 1e6);
  return samples.map((s, i) => {
    const next = samples[i + 1];
    if (next) return Math.max(1, tick(next.timestamp) - tick(s.timestamp));
    if (s.duration) return Math.max(1, tick(s.duration));
    const prev = samples[i - 1];
    return prev ? Math.max(1, tick(s.timestamp) - tick(prev.timestamp)) : Math.max(1, tick(1e6 / 30));
  });
}

/** `stts`: the durations, run-length coded. */
function stts(ticks: number[]): Uint8Array {
  const runs: [number, number][] = [];
  for (const t of ticks) {
    const last = runs[runs.length - 1];
    if (last && last[1] === t) last[0]++;
    else runs.push([1, t]);
  }
  return fullBox("stts", 0, 0, fields((w) => {
    w.u32(runs.length);
    for (const [count, delta] of runs) w.u32(count).u32(delta);
  }));
}

/** A descriptor in an `esds`: tag, length (one byte will do here), body. */
const descriptor = (tag: number, ...content: Uint8Array[]) => {
  const body = fields((w) => content.forEach((c) => w.bytes(c)));
  if (body.length > 0x7f) throw new Error("An esds descriptor this long is not written here.");
  return fields((w) => w.u8(tag).u8(body.length).bytes(body));
};

/** `stsz`, `stsc` and `stco`/`co64`: every sample in one chunk at `offset`. */
function oneChunk(samples: readonly Mp4Sample[], offset: number, wide: boolean): Uint8Array[] {
  const stsz = fullBox("stsz", 0, 0, fields((w) => {
    w.u32(0).u32(samples.length);
    for (const s of samples) w.u32(s.data.length);
  }));
  const stsc = fullBox("stsc", 0, 0, fields((w) => (samples.length ? w.u32(1).u32(1).u32(samples.length).u32(1) : w.u32(0))));
  const stco = wide
    ? fullBox("co64", 0, 0, fields((w) => w.u32(1).u64(offset)))
    : fullBox("stco", 0, 0, fields((w) => w.u32(1).u32(offset)));
  return [stsz, stsc, stco];
}

/** The sound's `trak`: track 2, AAC in an `mp4a` entry. */
function audioTrak(audio: Mp4AudioTrack, offset: number, wide: boolean): { trak: Uint8Array; movieTicks: number } {
  const timescale = audio.sampleRate;
  const ticks = sampleTicks(audio.samples, timescale);
  const trackTicks = ticks.reduce((a, b) => a + b, 0);
  const movieTicks = Math.round((trackTicks * MOVIE_TIMESCALE) / timescale);
  const tkhd = fullBox("tkhd", 0, 3, fields((w) =>
    w.u32(0).u32(0).u32(2).u32(0).u32(movieTicks)
      .zeros(8).u16(0).u16(1).u16(0x0100).u16(0) // reserved, layer, alternate group, volume 1.0, reserved
      .bytes(MATRIX).u32(0).u32(0),
  ));
  const mdhd = fullBox("mdhd", 0, 0, fields((w) => w.u32(0).u32(0).u32(timescale).u32(trackTicks).u16(0x55c4).u16(0)));
  const hdlr = fullBox("hdlr", 0, 0, fields((w) => w.u32(0).bytes(ascii("soun")).zeros(12).bytes(ascii("SoundHandler\0"))));
  const smhd = fullBox("smhd", 0, 0, new Uint8Array(4));
  const dinf = box("dinf", fullBox("dref", 0, 0, fields((w) => w.u32(1)), fullBox("url ", 0, 1)));
  const bitrate = Math.round((audio.samples.reduce((n, s) => n + s.data.length, 0) * 8) / Math.max(1e-3, trackTicks / timescale));
  const esds = fullBox(
    "esds",
    0,
    0,
    descriptor(
      0x03, // ES_Descriptor
      fields((w) => w.u16(2).u8(0)), // ES id, flags
      descriptor(
        0x04, // DecoderConfigDescriptor
        fields((w) => w.u8(0x40).u8(0x15).u8(0).u16(0).u32(bitrate).u32(bitrate)), // MPEG-4 audio, audio stream, buffer size, bitrates
        descriptor(0x05, audio.config ?? aacConfig(audio.sampleRate, audio.channels)), // DecoderSpecificInfo
      ),
      descriptor(0x06, Uint8Array.of(0x02)), // SLConfigDescriptor
    ),
  );
  const mp4a = box(
    "mp4a",
    fields((w) => w.zeros(6).u16(1).zeros(8).u16(audio.channels).u16(16).u16(0).u16(0).u32(Math.min(audio.sampleRate, 0xffff) * 0x10000)),
    esds,
  );
  const stsd = fullBox("stsd", 0, 0, fields((w) => w.u32(1)), mp4a);
  const stbl = box("stbl", stsd, stts(ticks), ...oneChunk(audio.samples, offset, wide));
  const trak = box("trak", tkhd, box("mdia", mdhd, hdlr, box("minf", smhd, dinf, stbl)));
  return { trak, movieTicks };
}

function moov(options: Mp4Options, ticks: number[], dataOffset: number, wide: boolean): Uint8Array {
  const { width, height, avcC, samples } = options;
  const timescale = options.timescale ?? 90000;
  const trackTicks = ticks.reduce((a, b) => a + b, 0);
  const videoTicks = Math.round((trackTicks * MOVIE_TIMESCALE) / timescale);
  const videoBytes = samples.reduce((n, s) => n + s.data.length, 0);
  const sound = options.audio?.samples.length ? audioTrak(options.audio, dataOffset + videoBytes, wide) : undefined;
  const movieTicks = Math.max(videoTicks, sound?.movieTicks ?? 0);

  const mvhd = fullBox("mvhd", 0, 0, fields((w) =>
    w.u32(0).u32(0).u32(MOVIE_TIMESCALE).u32(movieTicks)
      .u32(0x00010000).u16(0x0100).zeros(10) // rate 1.0, volume 1.0, reserved
      .bytes(MATRIX).zeros(24).u32(sound ? 3 : 2), // pre_defined, next track id
  ));
  const tkhd = fullBox("tkhd", 0, 3, fields((w) => // enabled, in the movie
    w.u32(0).u32(0).u32(1).u32(0).u32(videoTicks)
      .zeros(8).u16(0).u16(0).u16(0).u16(0) // reserved, layer, group, volume (none for video), reserved
      .bytes(MATRIX).u32(width * 0x10000).u32(height * 0x10000),
  ));
  const mdhd = fullBox("mdhd", 0, 0, fields((w) => w.u32(0).u32(0).u32(timescale).u32(trackTicks).u16(0x55c4).u16(0))); // "und"
  const hdlr = fullBox("hdlr", 0, 0, fields((w) => w.u32(0).bytes(ascii("vide")).zeros(12).bytes(ascii("VideoHandler\0"))));
  const vmhd = fullBox("vmhd", 0, 1, new Uint8Array(8));
  const dinf = box("dinf", fullBox("dref", 0, 0, fields((w) => w.u32(1)), fullBox("url ", 0, 1)));

  const avc1 = box(
    "avc1",
    fields((w) =>
      w.zeros(6).u16(1) // reserved, data reference index
        .zeros(16).u16(width).u16(height)
        .u32(0x00480000).u32(0x00480000).u32(0).u16(1) // 72 dpi, reserved, one frame per sample
        .zeros(32).u16(0x0018).u16(0xffff), // compressor name, depth, pre_defined
    ),
    box("avcC", avcC),
  );
  const stsd = fullBox("stsd", 0, 0, fields((w) => w.u32(1)), avc1);
  const keys = samples.flatMap((s, i) => (s.key ? [i + 1] : []));
  // Every sample a keyframe: leave stss out, which says so.
  const stss = keys.length === samples.length ? [] : [fullBox("stss", 0, 0, fields((w) => {
    w.u32(keys.length);
    for (const k of keys) w.u32(k);
  }))];
  // One chunk with every sample, starting at the mdat's data.
  const stbl = box("stbl", stsd, stts(ticks), ...stss, ...oneChunk(samples, dataOffset, wide));
  const minf = box("minf", vmhd, dinf, stbl);
  const trak = box("trak", tkhd, box("mdia", mdhd, hdlr, minf));
  return box("moov", mvhd, trak, ...(sound ? [sound.trak] : []));
}

/**
 * An MP4 file of one H.264 track (and an AAC one, with `audio`): `ftyp`,
 * `moov`, then the samples in one `mdat`, the video's then the sound's.
 * Throws when there are no samples or the first is not a keyframe.
 */
export function muxMp4(options: Mp4Options): Uint8Array {
  const { samples } = options;
  if (!samples.length) throw new Error("An MP4 needs at least one frame.");
  if (!samples[0]!.key) throw new Error("An MP4's first frame must be a keyframe.");
  const ftyp = box("ftyp", ascii("isom"), fields((w) => w.u32(0x200)), ascii("isomiso2avc1mp41"));
  const ticks = sampleTicks(samples, options.timescale ?? 90000);
  const all = [...samples, ...(options.audio?.samples ?? [])];
  const payload = all.reduce((n, s) => n + s.data.length, 0);
  const large = payload + 8 >= UINT32;
  const mdatHeader = large ? 16 : 8;
  // The index's size does not depend on the offset it holds, so measure it once and write it again.
  const wide = ftyp.length + moov(options, ticks, 0, large).length + mdatHeader + payload >= UINT32;
  const index = moov(options, ticks, 0, wide);
  const dataOffset = ftyp.length + index.length + mdatHeader;
  const head = fields((w) => {
    w.bytes(ftyp).bytes(moov(options, ticks, dataOffset, wide));
    if (large) w.u32(1).bytes(ascii("mdat")).u64(payload + 16);
    else w.u32(payload + 8).bytes(ascii("mdat"));
  });
  const out = new Uint8Array(head.length + payload);
  out.set(head);
  let at = head.length;
  for (const s of all) {
    out.set(s.data, at);
    at += s.data.length;
  }
  return out;
}
