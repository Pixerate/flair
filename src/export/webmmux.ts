/**
 * A small WebM (Matroska) writer for one VP8 or VP9 video track, with no
 * dependencies, for video encoded in the browser (WebCodecs' `VideoEncoder`).
 *
 * The file is an EBML header and one Segment of known size: `Info` (with the
 * duration), `Tracks`, then `Cluster`s of `SimpleBlock`s, a new cluster at
 * each keyframe. There are no `Cues`, so a player seeks by scanning, which
 * is quick for short clips. Frames with an alpha plane (VP9 or VP8 encoded
 * with `alpha: "keep"`) go in `BlockGroup`s with the alpha as a
 * `BlockAdditional` (id 1), and the track says `AlphaMode` 1, as Chrome's
 * own recordings do.
 */

/** One encoded frame. */
export interface WebmFrame {
  data: Uint8Array;
  /** Presentation time in microseconds (WebCodecs' `timestamp`). */
  timestamp: number;
  key: boolean;
  /** The frame's alpha plane, encoded (WebCodecs' `metadata.alphaSideData`). */
  alpha?: Uint8Array;
}

export interface WebmOptions {
  codec: "vp8" | "vp9";
  width: number;
  height: number;
  frames: readonly WebmFrame[];
  /** The length in microseconds (default: the last frame's time plus one frame). */
  duration?: number;
  /** Frames per second, written as the track's default frame duration. */
  fps?: number;
  /** `WritingApp` (default "flair"). */
  app?: string;
}

/** Element ids (their own leading-bits coding is part of the id). */
const ID = {
  EBML: 0x1a45dfa3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42f7,
  EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Duration: 0x4489,
  MuxingApp: 0x4d80,
  WritingApp: 0x5741,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackUID: 0x73c5,
  TrackType: 0x83,
  FlagLacing: 0x9c,
  CodecID: 0x86,
  DefaultDuration: 0x23e383,
  MaxBlockAdditionID: 0x55ee,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  AlphaMode: 0x53c0,
  Cluster: 0x1f43b675,
  Timestamp: 0xe7,
  SimpleBlock: 0xa3,
  BlockGroup: 0xa0,
  Block: 0xa1,
  ReferenceBlock: 0xfb,
  BlockAdditions: 0x75a1,
  BlockMore: 0xa6,
  BlockAddID: 0xee,
  BlockAdditional: 0xa5,
} as const;

/** Timestamps count milliseconds (TimestampScale 1 000 000 ns). */
const SCALE_NS = 1_000_000;
/** A block's time is a signed 16-bit offset from its cluster's. */
const MAX_OFFSET = 32767;

const concat = (parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** An element id's bytes (ids already carry their length marker). */
function idBytes(id: number): Uint8Array {
  const out: number[] = [];
  for (let n = id; n > 0; n = Math.floor(n / 256)) out.unshift(n & 0xff);
  return Uint8Array.from(out);
}

/** A size as an EBML variable-length integer, in the fewest bytes (1–8). */
export function vint(n: number): Uint8Array {
  for (let len = 1; len <= 8; len++) {
    // All ones is reserved for "unknown size".
    if (n < 2 ** (7 * len) - 1) {
      const out = new Uint8Array(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v % 256;
        v = Math.floor(v / 256);
      }
      out[0]! |= 1 << (8 - len);
      return out;
    }
  }
  throw new RangeError(`An EBML size cannot be ${n}.`);
}

const el = (id: number, ...content: Uint8Array[]) => {
  const body = concat(content);
  return concat([idBytes(id), vint(body.length), body]);
};

const uint = (id: number, n: number) => {
  const out: number[] = [];
  for (let v = n; v > 0 || out.length === 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return el(id, Uint8Array.from(out));
};

const float = (id: number, n: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return el(id, b);
};

const str = (id: number, s: string) => el(id, new TextEncoder().encode(s));

/** A block's header: track 1, its time from the cluster's, its flags. */
function blockHeader(offset: number, flags: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = 0x81;
  new DataView(b.buffer).setInt16(1, offset);
  b[3] = flags;
  return b;
}

/**
 * A WebM file of one VP8 or VP9 track. Throws when there are no frames or
 * the first is not a keyframe.
 */
export function muxWebm(options: WebmOptions): Uint8Array {
  const { codec, width, height, frames, fps } = options;
  if (!frames.length) throw new Error("A WebM needs at least one frame.");
  if (!frames[0]!.key) throw new Error("A WebM's first frame must be a keyframe.");
  const alpha = frames.some((f) => f.alpha);
  const ms = (us: number) => Math.round(us / 1000);
  const last = frames[frames.length - 1]!;
  const frameUs = fps ? 1e6 / fps : frames.length > 1 ? (last.timestamp - frames[0]!.timestamp) / (frames.length - 1) : 1e6 / 30;
  const durationUs = options.duration ?? last.timestamp + frameUs;

  const header = el(
    ID.EBML,
    uint(ID.EBMLVersion, 1),
    uint(ID.EBMLReadVersion, 1),
    uint(ID.EBMLMaxIDLength, 4),
    uint(ID.EBMLMaxSizeLength, 8),
    str(ID.DocType, "webm"),
    // BlockAdditions came in version 4.
    uint(ID.DocTypeVersion, alpha ? 4 : 2),
    uint(ID.DocTypeReadVersion, 2),
  );
  const info = el(
    ID.Info,
    uint(ID.TimestampScale, SCALE_NS),
    float(ID.Duration, durationUs / 1000),
    str(ID.MuxingApp, "flair"),
    str(ID.WritingApp, options.app ?? "flair"),
  );
  const tracks = el(
    ID.Tracks,
    el(
      ID.TrackEntry,
      uint(ID.TrackNumber, 1),
      uint(ID.TrackUID, 1),
      uint(ID.TrackType, 1), // video
      uint(ID.FlagLacing, 0),
      str(ID.CodecID, codec === "vp9" ? "V_VP9" : "V_VP8"),
      ...(fps ? [uint(ID.DefaultDuration, Math.round(1e9 / fps))] : []),
      ...(alpha ? [uint(ID.MaxBlockAdditionID, 1)] : []),
      el(ID.Video, uint(ID.PixelWidth, width), uint(ID.PixelHeight, height), ...(alpha ? [uint(ID.AlphaMode, 1)] : [])),
    ),
  );

  const clusters: Uint8Array[] = [];
  let blocks: Uint8Array[] = [];
  let clusterMs = 0;
  let previousMs = 0;
  const close = () => {
    if (blocks.length) clusters.push(el(ID.Cluster, uint(ID.Timestamp, clusterMs), ...blocks));
    blocks = [];
  };
  frames.forEach((frame, i) => {
    const at = ms(frame.timestamp);
    if (i === 0 || frame.key || at - clusterMs > MAX_OFFSET) {
      close();
      clusterMs = at;
    }
    const offset = at - clusterMs;
    if (frame.alpha) {
      blocks.push(
        el(
          ID.BlockGroup,
          el(ID.Block, blockHeader(offset, 0), frame.data),
          el(ID.BlockAdditions, el(ID.BlockMore, uint(ID.BlockAddID, 1), el(ID.BlockAdditional, frame.alpha))),
          // A group without a reference is a keyframe; point delta frames at the one before.
          ...(frame.key ? [] : [el(ID.ReferenceBlock, signed(previousMs - at))]),
        ),
      );
    } else {
      blocks.push(el(ID.SimpleBlock, blockHeader(offset, frame.key ? 0x80 : 0), frame.data));
    }
    previousMs = at;
  });
  close();

  const segment = el(ID.Segment, info, tracks, ...clusters);
  return concat([header, segment]);
}

/** A signed integer's bytes, big-endian, in the fewest bytes (ReferenceBlock is signed). */
function signed(n: number): Uint8Array {
  for (let len = 1; len <= 8; len++) {
    if (n >= -(2 ** (8 * len - 1)) && n < 2 ** (8 * len - 1)) {
      const out = new Uint8Array(len);
      let v = n < 0 ? 2 ** (8 * len) + n : n;
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v % 256;
        v = Math.floor(v / 256);
      }
      return out;
    }
  }
  throw new RangeError(`${n} is out of range.`);
}
