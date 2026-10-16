import { describe, expect, it } from "vitest";
import { muxMp4, type Mp4Sample } from "./mp4mux.js";
import { muxWebm, vint } from "./webmmux.js";
import { crc32, zipStore } from "./zip.js";

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));

// ---- An ISO BMFF reader: boxes by path, enough to check what the muxer wrote.

interface Box {
  type: string;
  start: number;
  size: number;
  body: DataView;
  children: Box[];
}

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "dinf"]);

function boxes(bytes: Uint8Array, start = 0, end = bytes.length): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Box[] = [];
  for (let at = start; at < end; ) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    }
    expect(size).toBeGreaterThanOrEqual(header);
    expect(at + size).toBeLessThanOrEqual(end);
    const body = new DataView(bytes.buffer, bytes.byteOffset + at + header, size - header);
    const children = CONTAINERS.has(type) ? boxes(bytes, at + header, at + size) : [];
    out.push({ type, start: at, size, body, children });
    at += size;
  }
  return out;
}

function find(list: Box[], path: string): Box {
  const [head, ...rest] = path.split("/");
  const box = list.find((b) => b.type === head);
  if (!box) throw new Error(`no ${head} in ${list.map((b) => b.type).join(",")}`);
  return rest.length ? find(box.children, rest.join("/")) : box;
}

/** The entries of a full box table that starts with a count after version/flags. */
const u32s = (b: Box, offset: number, count: number) => Array.from({ length: count }, (_, i) => b.body.getUint32(offset + i * 4));

// ---- An EBML reader: elements by id, with their bodies.

interface Element {
  id: number;
  start: number;
  size: number;
  body: Uint8Array;
  children: Element[];
}

const MASTERS = new Set([0x1a45dfa3, 0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0x1f43b675, 0xa0, 0x75a1, 0xa6]);

function readVint(bytes: Uint8Array, at: number, keepMarker: boolean): [number, number] {
  const first = bytes[at]!;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  let value = keepMarker ? first : first & (0xff >> len);
  for (let i = 1; i < len; i++) value = value * 256 + bytes[at + i]!;
  return [value, len];
}

function elements(bytes: Uint8Array, start = 0, end = bytes.length): Element[] {
  const out: Element[] = [];
  for (let at = start; at < end; ) {
    const [id, idLen] = readVint(bytes, at, true);
    const [size, sizeLen] = readVint(bytes, at + idLen, false);
    const bodyStart = at + idLen + sizeLen;
    expect(bodyStart + size).toBeLessThanOrEqual(end);
    const body = bytes.subarray(bodyStart, bodyStart + size);
    out.push({ id, start: at, size, body, children: MASTERS.has(id) ? elements(bytes, bodyStart, bodyStart + size) : [] });
    at = bodyStart + size;
  }
  return out;
}

const child = (e: Element | Element[], id: number) => (Array.isArray(e) ? e : e.children).find((c) => c.id === id)!;
const all = (e: Element, id: number) => e.children.filter((c) => c.id === id);
const uintOf = (e: Element) => e.body.reduce((n, b) => n * 256 + b, 0);
const strOf = (e: Element) => new TextDecoder().decode(e.body);
const floatOf = (e: Element) => new DataView(e.body.buffer, e.body.byteOffset, 8).getFloat64(0);

// ---- Fake encoded chunks.

const fakeSamples = (n: number, fps: number, keyEvery: number): Mp4Sample[] =>
  Array.from({ length: n }, (_, i) => ({
    data: new Uint8Array(10 + (i % 7)).fill(i),
    timestamp: Math.round((i * 1e6) / fps),
    key: i % keyEvery === 0,
  }));

describe("muxMp4", () => {
  it("writes ftyp, moov then mdat, with the samples' sizes, times, keyframes and offset", () => {
    const samples = fakeSamples(45, 30, 20);
    const file = muxMp4({ width: 320, height: 240, avcC: Uint8Array.of(1, 2, 3, 4), samples });
    const top = boxes(file);
    expect(top.map((b) => b.type)).toEqual(["ftyp", "moov", "mdat"]);
    expect(top.reduce((n, b) => n + b.size, 0)).toBe(file.length);

    const mvhd = find(top, "moov/mvhd");
    expect(mvhd.body.getUint32(12)).toBe(1000);
    expect(mvhd.body.getUint32(16)).toBe(1500); // 45 frames at 30 fps
    const tkhd = find(top, "moov/trak/tkhd");
    expect(tkhd.body.getUint32(76) / 65536).toBe(320);
    expect(tkhd.body.getUint32(80) / 65536).toBe(240);
    const mdhd = find(top, "moov/trak/mdia/mdhd");
    expect(mdhd.body.getUint32(12)).toBe(90000);
    expect(mdhd.body.getUint32(16)).toBe(45 * 3000);
    expect(String.fromCharCode(...new Uint8Array(find(top, "moov/trak/mdia/hdlr").body.buffer, find(top, "moov/trak/mdia/hdlr").body.byteOffset + 8, 4))).toBe("vide");

    const stsd = find(top, "moov/trak/mdia/minf/stbl/stsd");
    const entry = boxes(new Uint8Array(stsd.body.buffer, stsd.body.byteOffset + 8, stsd.body.byteLength - 8));
    expect(entry[0]!.type).toBe("avc1");
    expect(entry[0]!.body.getUint16(24)).toBe(320);
    expect(entry[0]!.body.getUint16(26)).toBe(240);
    const avcC = boxes(new Uint8Array(entry[0]!.body.buffer, entry[0]!.body.byteOffset + 78, entry[0]!.body.byteLength - 78));
    expect(avcC[0]!.type).toBe("avcC");
    expect([...new Uint8Array(avcC[0]!.body.buffer, avcC[0]!.body.byteOffset, avcC[0]!.body.byteLength)]).toEqual([1, 2, 3, 4]);

    const stts = find(top, "moov/trak/mdia/minf/stbl/stts");
    const runs = stts.body.getUint32(4);
    const ticks = Array.from({ length: runs }, (_, i) => [stts.body.getUint32(8 + i * 8), stts.body.getUint32(12 + i * 8)]);
    expect(ticks.reduce((n, [count]) => n + count!, 0)).toBe(45);
    expect(ticks.reduce((n, [count, delta]) => n + count! * delta!, 0)).toBe(45 * 3000);

    const stss = find(top, "moov/trak/mdia/minf/stbl/stss");
    expect(u32s(stss, 8, stss.body.getUint32(4))).toEqual([1, 21, 41]);
    const stsz = find(top, "moov/trak/mdia/minf/stbl/stsz");
    expect(stsz.body.getUint32(8)).toBe(45);
    expect(u32s(stsz, 12, 45)).toEqual(samples.map((s) => s.data.length));
    const stsc = find(top, "moov/trak/mdia/minf/stbl/stsc");
    // One entry: chunk 1 holds all 45 samples, description 1.
    expect(u32s(stsc, 4, 4)).toEqual([1, 1, 45, 1]);
    const stco = find(top, "moov/trak/mdia/minf/stbl/stco");
    const offset = stco.body.getUint32(8);
    const mdat = top[2]!;
    expect(offset).toBe(mdat.start + 8);
    expect([...file.subarray(offset, offset + samples[0]!.data.length)]).toEqual([...samples[0]!.data]);
    expect(mdat.size - 8).toBe(samples.reduce((n, s) => n + s.data.length, 0));
  });

  it("leaves stss out when every sample is a keyframe, and refuses an empty or keyless start", () => {
    const top = boxes(muxMp4({ width: 16, height: 16, avcC: Uint8Array.of(1), samples: fakeSamples(3, 30, 1) }));
    expect(find(top, "moov/trak/mdia/minf/stbl").children.map((b) => b.type)).toEqual(["stsd", "stts", "stsz", "stsc", "stco"]);
    expect(() => muxMp4({ width: 16, height: 16, avcC: Uint8Array.of(1), samples: [] })).toThrow(/at least one frame/);
    expect(() => muxMp4({ width: 16, height: 16, avcC: Uint8Array.of(1), samples: fakeSamples(2, 30, 5).slice(1) })).toThrow(/keyframe/);
  });

  it("muxes real H.264 from Chrome's encoder into a well-formed file", () => {
    const samples = H264.chunks.map((c) => ({ ...c, data: fromHex(c.data) }));
    const file = muxMp4({ width: 16, height: 16, avcC: fromHex(H264.avcC), samples });
    const top = boxes(file);
    // Each sample is length-prefixed NAL units that fill it exactly.
    const stco = find(top, "moov/trak/mdia/minf/stbl/stco").body.getUint32(8);
    let at = stco;
    for (const s of samples) {
      let n = 0;
      while (n < s.data.length) n += 4 + new DataView(file.buffer, at + n).getUint32(0);
      expect(n).toBe(s.data.length);
      at += s.data.length;
    }
    expect(at).toBe(file.length);
    // The avcC names Baseline (66) with a 4-byte NAL length.
    const avcC = fromHex(H264.avcC);
    expect(avcC[1]).toBe(66);
    expect((avcC[4]! & 3) + 1).toBe(4);
    expect(find(top, "moov/trak/mdia/minf/stbl/stss").body.getUint32(8)).toBe(1);
    expect(find(top, "moov/mvhd").body.getUint32(16)).toBe(100);
  });
});

describe("muxWebm", () => {
  it("writes an EBML header and a segment with info, one track and clusters of blocks", () => {
    const frames = fakeSamples(90, 30, 30);
    const file = muxWebm({ codec: "vp9", width: 640, height: 360, frames, fps: 30, duration: 3e6 });
    const top = elements(file);
    expect(top.map((e) => e.id)).toEqual([0x1a45dfa3, 0x18538067]);
    expect(strOf(child(top[0]!, 0x4282))).toBe("webm");
    const segment = top[1]!;
    expect(segment.start + segment.size).toBeLessThanOrEqual(file.length);
    const info = child(segment, 0x1549a966);
    expect(uintOf(child(info, 0x2ad7b1))).toBe(1_000_000);
    expect(floatOf(child(info, 0x4489))).toBe(3000);
    const track = child(child(segment, 0x1654ae6b), 0xae);
    expect(strOf(child(track, 0x86))).toBe("V_VP9");
    expect(uintOf(child(track, 0xd7))).toBe(1);
    expect(uintOf(child(track, 0x83))).toBe(1);
    expect(uintOf(child(track, 0x23e383))).toBe(33_333_333);
    const video = child(track, 0xe0);
    expect([uintOf(child(video, 0xb0)), uintOf(child(video, 0xba))]).toEqual([640, 360]);
    expect(child(video, 0x53c0)).toBeUndefined();

    const clusters = all(segment, 0x1f43b675);
    expect(clusters).toHaveLength(3); // one per keyframe
    expect(clusters.map((c) => uintOf(child(c, 0xe7)))).toEqual([0, 1000, 2000]);
    const blocks = clusters.flatMap((c) => all(c, 0xa3));
    expect(blocks).toHaveLength(90);
    blocks.forEach((b, i) => {
      expect(b.body[0]).toBe(0x81);
      const cluster = Math.floor(i / 30) * 1000;
      expect(cluster + new DataView(b.body.buffer, b.body.byteOffset + 1, 2).getInt16(0)).toBe(Math.round((i * 1000) / 30));
      expect(Boolean(b.body[3]! & 0x80)).toBe(i % 30 === 0);
      expect([...b.body.subarray(4)]).toEqual([...frames[i]!.data]);
    });
  });

  it("puts each frame's alpha beside it as a BlockAdditional, and says AlphaMode 1", () => {
    const frames = fakeSamples(4, 30, 2).map((f, i) => ({ ...f, alpha: Uint8Array.of(0xa0, i) }));
    const file = muxWebm({ codec: "vp9", width: 16, height: 16, frames, fps: 30 });
    const segment = elements(file)[1]!;
    expect(uintOf(child(elements(file)[0]!, 0x4287))).toBe(4);
    const track = child(child(segment, 0x1654ae6b), 0xae);
    expect(uintOf(child(child(track, 0xe0), 0x53c0))).toBe(1);
    expect(uintOf(child(track, 0x55ee))).toBe(1);
    const groups = all(segment, 0x1f43b675).flatMap((c) => all(c, 0xa0));
    expect(groups).toHaveLength(4);
    groups.forEach((g, i) => {
      const more = child(child(g, 0x75a1), 0xa6);
      expect(uintOf(child(more, 0xee))).toBe(1);
      expect([...child(more, 0xa5).body]).toEqual([0xa0, i]);
      // Delta frames point back at the frame before; keyframes have no reference.
      const ref = child(g, 0xfb);
      if (i % 2 === 0) expect(ref).toBeUndefined();
      else expect(ref.body.length).toBe(1);
    });
  });

  it("starts a cluster before a block's offset would overflow 16 bits", () => {
    const frames = [0, 20e6, 40e6].map((t, i) => ({ data: Uint8Array.of(i), timestamp: t, key: i === 0 }));
    const segment = elements(muxWebm({ codec: "vp8", width: 16, height: 16, frames }))[1]!;
    expect(all(segment, 0x1f43b675).map((c) => uintOf(child(c, 0xe7)))).toEqual([0, 40000]);
  });

  it("muxes real VP8 from Chrome's encoder, with a keyframe the decoder can find", () => {
    const frames = VP8.chunks.map((c) => ({ ...c, data: fromHex(c.data) }));
    const file = muxWebm({ codec: "vp8", width: 16, height: 16, frames, fps: 30 });
    const segment = elements(file)[1]!;
    expect(strOf(child(child(child(segment, 0x1654ae6b), 0xae), 0x86))).toBe("V_VP8");
    const blocks = all(segment, 0x1f43b675).flatMap((c) => all(c, 0xa3));
    expect(blocks).toHaveLength(3);
    // A VP8 keyframe: bit 0 clear in its first byte, then the start code 9d 01 2a and its size.
    const key = blocks[0]!.body.subarray(4);
    expect(key[0]! & 1).toBe(0);
    expect([...key.subarray(3, 6)]).toEqual([0x9d, 0x01, 0x2a]);
    expect(new DataView(key.buffer, key.byteOffset + 6, 4).getUint16(0, true) & 0x3fff).toBe(16);
    expect(floatOf(child(child(segment, 0x1549a966), 0x4489))).toBeCloseTo(100, 0);
  });

  it("codes sizes in the fewest bytes", () => {
    expect([...vint(0)]).toEqual([0x80]);
    expect([...vint(126)]).toEqual([0xfe]);
    expect([...vint(127)]).toEqual([0x40, 0x7f]);
    expect(readVint(vint(1_000_000), 0, false)).toEqual([1_000_000, 3]);
  });
});

describe("zipStore", () => {
  it("stores files a ZIP reader can list, with their CRCs", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const files = [
      { name: "frame-0001.png", data: Uint8Array.of(1, 2, 3) },
      { name: "frame-0002.png", data: new Uint8Array(1000).fill(7) },
    ];
    const zip = zipStore(files);
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    let at = view.getUint32(end + 16, true);
    for (const f of files) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      expect(view.getUint32(at + 16, true)).toBe(crc32(f.data));
      expect(view.getUint32(at + 24, true)).toBe(f.data.length);
      const nameLength = view.getUint16(at + 28, true);
      expect(new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength))).toBe(f.name);
      const local = view.getUint32(at + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      const dataAt = local + 30 + view.getUint16(local + 26, true);
      expect([...zip.subarray(dataAt, dataAt + f.data.length)]).toEqual([...f.data]);
      at += 46 + nameLength;
    }
  });
});

// Three 16 × 16 frames encoded by Chrome's WebCodecs VideoEncoder (H.264 Baseline in avc format, and VP8).
export const H264 = {
  avcC: "0142000bffe100102742000bab4186f02cc14cdc0434040801000428ce3c80",
  chunks: [
    { timestamp: 0, key: true, data: "0000003506052d47564adc5c4c433f94efc5113cd143a8010000030001030000030001020000c3500b000003000003000172f00c03912b0180000000b125b820023e20e23c7fe038807438e10ea37f52c10422308025f92308ea2e995b790f48ea6d3de0421f01a0193facbc799d86081d06936e00c7e8b3a6d4b2d28bf0424fe8102000e84a4023682c8feb153429346400ebe600e0ff10cee85f7530a1bf59a283911b1186f516e8882ac6800104befbefbefbefbefffffe08bdf8d00031186defbefbefbefbefbeba7aebaebaebaebaebae9ebaebaebaebaebaeba7aebaebaebaebaebae9ebaebaebaebaebaf" },
    { timestamp: 33333, key: false, data: "0000003a21e1041bcabd58194c16e1f08189727b3cfea722424eb1c00095f03f4d4e99580c217f5f38d872387c57e17aa8bff5517feaa2ffd545ffaa8bf8" },
    { timestamp: 66667, key: false, data: "0000004021e20813ca4d61cde06f1018e1b4342183b9107624720dfe32d6033db07a8e0004a0fd785af514c2a558f594365fa8bff41e517feaa2ffd545ffaa8bff5517f0" },
  ],
};
export const VP8 = {
  chunks: [
    { timestamp: 0, key: true, data: "9009009d012a1000100000470885858899848801241013ad380b5c07f80efc07f01e001fd40f45dfeddee03fa39ec03fa4af109f01c949c820fc499e2bfd1bf203fa07485ff63fc72f801e840f6c74f7e4b429b61580fefff2cbfde57c5864a4fa30439809892b01a5f14429e7ac27b5bbec6bfffc83c5dd9fc35f9b63ffe06e60ffe2ac7ffc4535a5ead59bf0016c467fb4eb7e0b9950b099541739fdeee71ad9023e987ffec3afb5dd5798e2728cbeee28902b2c4632e4dd37d0979c82238fff817e45868cff319fff5e5946026ebd3222bf7ba3bbe04bc7f626bb8bbc855c730277d4b7cfcd7a01dfffc706bfc4b26d26c56486e85406fff8e1c6214b3f772cfaf2bffdb02ee47795faca4a5fff6e89dfe0ca8d19d87b713b3311ffe4dbadeaae1602238e98086370307defff4b7891704dfc3543bef81f65da9bef5ebe1591daab805c523afdd7ffd516672e260758ec5f10" },
    { timestamp: 33333, key: false, data: "1108000110092000e61e207f80e983fc074407fb96081fe579e81e903840f8d6fe4bde07d057f2afe23fdfbfa97b00f5808d5403980776029aaffaa8d695d5ca801000fee6ac86effdbb543ffffb7a732bfbc0db553ffdd61895d5fe0eddb76b3a792f83bc00cb29bfc3c65869006c52243d41aae6be7bd798bef4b3cb8d9543ea9f7f982f7ff50e4fc677c57fd9041fc2b4f61af9985a7719c86b0f76bbfcfa67f6be7b7548bf0d5a6a20bde35479dd3b853612c488e6e894483e41df9630b51f5df8ef41faace647edeb1b9be54f5cb7c1e89e2ffff5e6abff39e255e2603ffd6e860d3cb901aaab6d1ffd873aa484dd6cf9f7ff6233e50b40026e706dc2dffec312dc8b797af77388e775ff6be6c9e343f9ee565ae76443d36ea0f0d1ca28a73fc36ccb84e6cfcc30e69fff4b83ece977f4d2501c1dd45bbd80" },
    { timestamp: 66667, key: false, data: "3102000110092000d10672e02004cd9ccecc0080fee7710fb17fd56bfffdd72e6ef99f04f293f18bf6900b4cfe9518183342c10d53f1fb08c5ac38f7377a3e7c3261fe7d33ff88e896f4355cf99beb5d54974b6f8227ceb64aa644d02665343599f71fe3e846a40c3d7e8053fff5f3fba134bafd9eae7322b12db62c6f2d4bfc1cf7ef02cfaf75f2fc91e53aa4f5a1dfaf5dca7e915ea219d3514fffb0e77b7b11fc9e117affebe078c0e1f1cdb7439ffb26d332c1d0fddb2d0626bffd9f9b4e66a31a304aa4f593fae5a85b23d429dd7c2dee145dff75ecb174f2ebae9d0cd0e03037b07fd9ff12ced1e0765a5edf3d49357675fffcb91a70df7fae79471c7fa3bf9a80" },
  ],
};
