/**
 * A small MP4 (ISO BMFF) writer for one H.264 video track, with no
 * dependencies, for video encoded in the browser (WebCodecs' `VideoEncoder`
 * with `avc: { format: "avc" }`).
 *
 * The file is "faststart": `ftyp`, then `moov` (the index), then one `mdat`
 * holding every sample in a single chunk, so a page can start playing it
 * before it has all arrived. Samples are in presentation order (browser
 * encoders make no B-frames), so there is no `ctts`.
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

function moov(options: Mp4Options, ticks: number[], dataOffset: number, wide: boolean): Uint8Array {
  const { width, height, avcC, samples } = options;
  const timescale = options.timescale ?? 90000;
  const trackTicks = ticks.reduce((a, b) => a + b, 0);
  const movieTicks = Math.round((trackTicks * MOVIE_TIMESCALE) / timescale);

  const mvhd = fullBox("mvhd", 0, 0, fields((w) =>
    w.u32(0).u32(0).u32(MOVIE_TIMESCALE).u32(movieTicks)
      .u32(0x00010000).u16(0x0100).zeros(10) // rate 1.0, volume 1.0, reserved
      .bytes(MATRIX).zeros(24).u32(2), // pre_defined, next track id
  ));
  const tkhd = fullBox("tkhd", 0, 3, fields((w) => // enabled, in the movie
    w.u32(0).u32(0).u32(1).u32(0).u32(movieTicks)
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
  const stsz = fullBox("stsz", 0, 0, fields((w) => {
    w.u32(0).u32(samples.length);
    for (const s of samples) w.u32(s.data.length);
  }));
  // One chunk with every sample, starting at the mdat's data.
  const stsc = fullBox("stsc", 0, 0, fields((w) => (samples.length ? w.u32(1).u32(1).u32(samples.length).u32(1) : w.u32(0))));
  const stco = wide
    ? fullBox("co64", 0, 0, fields((w) => w.u32(1).u64(dataOffset)))
    : fullBox("stco", 0, 0, fields((w) => w.u32(1).u32(dataOffset)));
  const stbl = box("stbl", stsd, stts(ticks), ...stss, stsz, stsc, stco);
  const minf = box("minf", vmhd, dinf, stbl);
  const trak = box("trak", tkhd, box("mdia", mdhd, hdlr, minf));
  return box("moov", mvhd, trak);
}

/**
 * An MP4 file of one H.264 track: `ftyp`, `moov`, then the samples in one
 * `mdat`. Throws when there are no samples or the first is not a keyframe.
 */
export function muxMp4(options: Mp4Options): Uint8Array {
  const { samples } = options;
  if (!samples.length) throw new Error("An MP4 needs at least one frame.");
  if (!samples[0]!.key) throw new Error("An MP4's first frame must be a keyframe.");
  const ftyp = box("ftyp", ascii("isom"), fields((w) => w.u32(0x200)), ascii("isomiso2avc1mp41"));
  const ticks = sampleTicks(samples, options.timescale ?? 90000);
  const payload = samples.reduce((n, s) => n + s.data.length, 0);
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
  for (const s of samples) {
    out.set(s.data, at);
    at += s.data.length;
  }
  return out;
}
