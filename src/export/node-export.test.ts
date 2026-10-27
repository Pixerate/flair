// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getEffect, type VectorEffect } from '../catalog/index.js';
import { wrapSource } from '../shader/program.js';
import {
  backdropSize,
  checkEffectValues,
  checkRegion,
  effectFrameSize,
  effectQueryFromFlags,
  exportEffect,
  exportEffectBuffer,
  imageNaturalSize,
  nodeSubjectValues,
  parseRegion,
  parseSets,
  parseSize,
  regionPixels,
  probeVideo,
  subjectsFromFlags,
  vectorTimeline,
  videoSeconds,
} from './effect.js';
import zlib from 'node:zlib';
import { chromeArgs, encodePng, ffmpegPath, fragmentSource, frameStates, pageControls, planOutput, renderPageHtml, scriptedPointer, sequencePath } from './recorder.js';

const fixture = (name: string) => path.resolve(__dirname, '../../tests/fixtures', name);
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function tempPng(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-test-'));
  const file = path.join(dir, 'pixel.png');
  fs.writeFileSync(file, PNG_1X1);
  return file;
}

describe('planOutput', () => {
  it('picks the format and encoder from the extension', () => {
    expect(planOutput('a.mp4').ffmpegArgs).toContain('libx264');
    expect(planOutput('a.mp4').ffmpegArgs).toContain('yuv420p');
    expect(planOutput('a.webm', { alpha: true }).ffmpegArgs).toContain('yuva420p');
    expect(planOutput('a.webm').ffmpegArgs).not.toContain('yuva420p');
    expect(planOutput('a.mov', { alpha: true }).ffmpegArgs).toEqual(expect.arrayContaining(['prores_ks', '4444', 'yuva444p10le']));
    expect(planOutput('a.gif').format).toBe('gif');
    expect(planOutput('a.svg').format).toBe('svg');
  });

  it('writes PNG frames to a folder, a pattern, or one file', () => {
    expect(planOutput('frames/').path).toMatch(/frames[\\/]frame_%04d\.png$/);
    expect(planOutput('frames').path).toMatch(/frames[\\/]frame_%04d\.png$/);
    expect(planOutput('out_%04d.png').path).toMatch(/out_%04d\.png$/);
    expect(planOutput('out.png').path).toMatch(/out_%04d\.png$/);
    expect(planOutput('out.png', { frames: 1 }).path).toMatch(/out\.png$/);
    expect(sequencePath('/x/out_%04d.png', 7)).toBe('/x/out_0007.png');
  });

  it('refuses alpha in MP4 and unknown formats with a sentence', () => {
    expect(() => planOutput('a.mp4', { alpha: true })).toThrow(/cannot hold alpha/);
    expect(() => planOutput('a.avi')).toThrow(/cannot write ".avi"/);
  });
});

describe('the render page', () => {
  it('compiles mainImage sources with the real wrapper, built-ins included', () => {
    const source = 'void mainImage(out vec4 c, in vec2 p) { c = vec4(iClicks[0].w, iTrail[0].w, iPointer.z, 1.0); }';
    expect(fragmentSource(source)).toBe(wrapSource(source));
    const html = renderPageHtml({
      width: 64,
      height: 32,
      frames: 2,
      alpha: true,
      background: '#000',
      send: 'png',
      shader: { fragment: fragmentSource(source), controls: [], opaque: false },
    });
    for (const decl of ['uniform vec4 iPointer;', 'uniform vec4 iClicks[8];', 'uniform vec4 iTrail[32];', 'uniform vec4 iAudio;', 'uniform vec4 iSpectrum[16];', 'uniform float iBeat;', 'uniform vec4 iScroll;', 'uniform vec3 iResolution;', '#line 1']) {
      expect(html).toContain(decl);
    }
    expect(html).toContain('premultipliedAlpha: false');
  });

  it('keeps complete programs as written', () => {
    const program = fs.readFileSync(fixture('sample.frag'), 'utf8');
    expect(fragmentSource(program)).toBe(program);
    expect(fragmentSource('void main() {}')).toMatch(/^#version 300 es\n/);
  });

  it('uploads images flipped, sizes SVGs, and sets ints and bools as integers', () => {
    const html = renderPageHtml({ width: 8, height: 8, frames: 1, alpha: false, background: '#000', send: 'rgba', shader: { fragment: 'x', controls: [], opaque: true } });
    expect(html).toContain('gl.UNPACK_FLIP_Y_WEBGL, true');
    expect(html).toContain('texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)');
    expect(html).toContain('function sizeSvg');
    expect(html).toContain('gl.uniform1i(loc, Math.round(v))');
    expect(html).toContain('gl.uniform1i(loc, v ? 1 : 0)');
    expect(html).toContain('gl.colorMask(true, true, true, false)');
  });

  it('cannot be closed early by a </script> in a shader', () => {
    const html = renderPageHtml({ width: 8, height: 8, frames: 1, alpha: false, background: '#000', send: 'png', shader: { fragment: '// </script><b>', controls: [], opaque: true } });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('reads local image paths into data URLs and types each control', async () => {
    const file = tempPng();
    const source = [
      'uniform sampler2D uImage; // @control',
      'uniform int uCount; // @control min=1 max=9 default=3',
      'uniform bool uOn; // @control default=true',
      'void mainImage(out vec4 c, in vec2 p) { c = texture(uImage, p); }',
    ].join('\n');
    const controls = await pageControls(source, { uImage: file });
    expect(controls.find((c) => c.name === 'uImage')!.value).toMatch(/^data:image\/png;base64,/);
    expect(controls.find((c) => c.name === 'uCount')).toMatchObject({ type: 'int', value: 3 });
    expect(controls.find((c) => c.name === 'uOn')).toMatchObject({ type: 'bool', value: true });
    await expect(pageControls(source, { uImage: '/no/such/file.png' })).rejects.toThrow(/There is no image/);
  });
});

describe('subjects in Node', () => {
  it('puts an image file into the image control as a data URL', async () => {
    const { values, video } = await nodeSubjectValues(getEffect('image-duotone')!, { image: tempPng() });
    expect(Object.values(values)[0]).toMatch(/^data:image\/png;base64,/);
    expect(video).toEqual({});
  });

  it('reads an SVG file as markup', async () => {
    const { values } = await nodeSubjectValues(getEffect('image-duotone')!, { svg: fixture('icon.svg') });
    expect(Object.values(values)[0]).toMatch(/^data:image\/svg\+xml/);
  });

  it('types text into a vector effect, and draws it for a shader', async () => {
    expect(Object.values((await nodeSubjectValues(getEffect('typewriter')!, { text: 'Hello' })).values)).toContain('Hello');
    expect(Object.values((await nodeSubjectValues(getEffect('shader-text')!, { text: 'FLAIR' })).values)[0]).toMatch(/^data:image\/svg\+xml/);
  });

  it('keeps a video as its file for the picture control', async () => {
    const file = tempPng().replace(/\.png$/, '.mp4');
    fs.writeFileSync(file, '');
    const { video } = await nodeSubjectValues(getEffect('crt')!, { video: file });
    expect(Object.values(video)).toEqual([file]);
  });

  it('says when an effect takes no such subject', async () => {
    await expect(nodeSubjectValues(getEffect('typewriter')!, { image: tempPng() })).rejects.toThrow(/vector effect/);
    await expect(nodeSubjectValues(getEffect('aurora')!, { video: tempPng() })).rejects.toThrow(/takes no video/);
  });
});

describe('command-line arguments', () => {
  it('parses --size', () => {
    expect(parseSize('1280x720')).toEqual({ width: 1280, height: 720 });
    expect(() => parseSize('big')).toThrow(/--size takes/);
  });

  it('parses --set by control type', () => {
    const duotone = getEffect('image-duotone')!;
    const values = parseSets(duotone, ['uContrast=1.5', 'uShadow=#102030', 'uHighlight=1,0.5,0']);
    expect(values).toEqual({ uContrast: 1.5, uShadow: '#102030', uHighlight: [1, 0.5, 0] });
    expect(() => parseSets(duotone, ['uNope=1'])).toThrow(/has no control "uNope"/);
    expect(() => parseSets(duotone, ['uContrast=lots'])).toThrow(/takes a number/);
    expect(() => parseSets(duotone, ['uContrast'])).toThrow(/name=value/);
  });

  it('turns subject flags into subjects', () => {
    expect(subjectsFromFlags({ image: ['a.png', 'b.png'], text: ['Hi'], font: 'Georgia', weight: '700', path: ['M0 0L1 1'] })).toEqual([
      { image: 'a.png' },
      { image: 'b.png' },
      { text: 'Hi', font: 'Georgia', weight: 700 },
      { path: 'M0 0L1 1' },
    ]);
  });

  it('checks the effects filters', () => {
    expect(effectQueryFromFlags({ accepts: ['image,video'], interaction: ['click'], category: 'image' })).toEqual({ accepts: ['image', 'video'], interaction: ['click'], category: 'image' });
    expect(() => effectQueryFromFlags({ accepts: ['sound'] })).toThrow(/--accepts takes/);
    expect(() => effectQueryFromFlags({ category: 'nope' })).toThrow(/--category takes/);
    expect(effectQueryFromFlags({ transparent: true })).toEqual({ transparent: true });
  });
});

describe('acting out the pointer', () => {
  it('clicks, hovers and leaves a trail', () => {
    const frames = scriptedPointer(100, 100, [0, 0.5, 1, 2]);
    expect(frames[0]!.clicks.every((n) => n === 0)).toBe(true);
    expect(frames[1]!.clicks[3]).toBe(1);
    expect(frames[3]!.clicks.filter((_, i) => i % 4 === 3 && frames[3]!.clicks[i] === 1).length).toBeGreaterThan(1);
    expect(frames[2]!.pointer[2]).toBeCloseTo(1);
    expect(frames[2]!.trail[3]).toBe(1);
  });

  it('clicks a click-triggered vector effect through its steps', () => {
    const toggle = getEffect('toggle-switch') as VectorEffect;
    const t = vectorTimeline(toggle, toggle.motion);
    expect(t.steps).toHaveLength(2);
    expect(t.at(0).steps).toEqual([]);
    expect(t.at(t.steps[1]! + 1).steps).toEqual(t.steps);
  });
});

describe('chromeArgs', () => {
  it('includes standard headless Chrome arguments', () => {
    const args = chromeArgs('/tmp/data', 800, 600, 'http://127.0.0.1');
    expect(args).toContain('--headless=new');
    expect(args).toContain('--use-gl=angle');
    expect(args).toContain('--enable-webgl');
    expect(args).toContain('--user-data-dir=/tmp/data');
    expect(args).toContain('--window-size=800,600');
    expect(args[args.length - 1]).toBe('http://127.0.0.1');
  });

  it('appends custom chrome flags when provided', () => {
    const args = chromeArgs('/tmp/data', 800, 600, 'http://127.0.0.1', ['--custom-test-flag', '--max-texture-size=4096']);
    expect(args).toContain('--custom-test-flag');
    expect(args).toContain('--max-texture-size=4096');
  });

  it('draws with SwiftShader everywhere when asked, for the same frames on every machine', () => {
    const args = chromeArgs('/tmp/data', 800, 600, 'http://127.0.0.1', [], { software: true });
    expect(args).toContain('--use-angle=swiftshader');
    expect(args).not.toContain('--use-angle=metal');
    const prev = process.env.FLAIR_SOFTWARE_GL;
    try {
      process.env.FLAIR_SOFTWARE_GL = '1';
      expect(chromeArgs('/tmp/data', 800, 600, 'http://127.0.0.1')).toContain('--use-angle=swiftshader');
    } finally {
      if (prev === undefined) delete process.env.FLAIR_SOFTWARE_GL;
      else process.env.FLAIR_SOFTWARE_GL = prev;
    }
  });

  it('reads flags from FLAIR_CHROME_FLAGS env variable', () => {
    const prev = process.env.FLAIR_CHROME_FLAGS;
    try {
      process.env.FLAIR_CHROME_FLAGS = '--env-flag-1 --env-flag-2';
      const args = chromeArgs('/tmp/data', 800, 600, 'http://127.0.0.1');
      expect(args).toContain('--env-flag-1');
      expect(args).toContain('--env-flag-2');
    } finally {
      if (prev === undefined) delete process.env.FLAIR_CHROME_FLAGS;
      else process.env.FLAIR_CHROME_FLAGS = prev;
    }
  });
});

describe('checkEffectValues', () => {
  it('throws on unknown controls by default', async () => {
    const duotone = getEffect('image-duotone')!;
    await expect(checkEffectValues(duotone, { uNonExistent: 123 })).rejects.toThrow(/has no control "uNonExistent"/);
  });

  it('skips unknown controls when ignoreUnknownControls is true', async () => {
    const duotone = getEffect('image-duotone')!;
    const checked = await checkEffectValues(duotone, { uContrast: 1.5, uUnknownControl: 'ignore-me' }, { ignoreUnknownControls: true });
    expect(checked).toEqual({ uContrast: 1.5 });
  });
});

describe('probeVideo', () => {
  it('probes dimensions, duration, and audio presence using ffmpeg', async () => {
    const { execFileSync } = await import('node:child_process');
    let hasFfmpeg = false;
    try {
      execFileSync(ffmpegPath(), ['-version'], { stdio: 'ignore' });
      hasFfmpeg = true;
    } catch {}

    if (!hasFfmpeg) {
      // ffmpeg is not available in this test environment (e.g. minimal CI container without ffmpeg)
      return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-probe-'));
    const videoWithAudio = path.join(dir, 'sample-audio.mp4');
    execFileSync(
      ffmpegPath(),
      [
        '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '1', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
        videoWithAudio,
      ],
      { stdio: 'ignore' },
    );

    const probe = await probeVideo(videoWithAudio);
    expect(probe.width).toBe(320);
    expect(probe.height).toBe(240);
    expect(probe.duration).toBeCloseTo(1, 0);
    expect(probe.hasAudio).toBe(true);

    const seconds = await videoSeconds(videoWithAudio);
    expect(seconds).toBeCloseTo(1, 0);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('exportEffectBuffer', () => {
  it('exports a vector effect to an in-memory SVG buffer and cleans up temp files', async () => {
    const result = await exportEffectBuffer('toggle-switch', {
      format: 'svg',
      width: 400,
      height: 200,
      values: { unknownExtraControl: 99 } as any,
    });
    expect(result.format).toBe('svg');
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.width).toBe(400);
    expect(result.height).toBe(200);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString('utf8')).toContain('<svg');
  });
});


/** A PNG header that says it is `width` × `height` (enough for sizing; not decodable). */
function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

/** A minimal JPEG: SOI, an EXIF block with `orientation`, and a start of frame `width` × `height`. */
function jpegHeader(width: number, height: number, orientation = 1): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'ascii');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0112, 10);
  tiff.writeUInt16BE(3, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(exif.length + 2, 2);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, exif, sof]);
}

const pngFile = (buf: Buffer, name = 'photo.png') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-test-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, buf);
  return file;
};

const page = (extra: Partial<Parameters<typeof renderPageHtml>[0]> = {}) =>
  renderPageHtml({
    width: 640,
    height: 480,
    frames: 1,
    alpha: false,
    background: '#000',
    send: 'png',
    shader: { fragment: 'x', controls: [], opaque: false },
    ...extra,
  });

describe('backdrops', () => {
  it('draws the backdrop over the background and before the effect, and skips direct readback', () => {
    const html = page({ backdrop: { src: 'data:image/png;base64,AAAA', fit: 'cover' } });
    expect(html).toContain('"backdrop":{"src":"data:image/png;base64,AAAA","fit":"cover"}');
    expect(html).toContain('backdrop = await loadImage(CONFIG.backdrop.src, "for the backdrop")');
    const capture = html.slice(html.indexOf('async function capture'));
    const fill = capture.indexOf('ctx.fillRect(0, 0, W, H)');
    const drawn = capture.indexOf('if (backdrop) drawBackdrop()');
    const effect = capture.indexOf('ctx.drawImage(src, R[0], R[1], EW, EH)');
    expect(fill).toBeGreaterThan(0);
    expect(drawn).toBeGreaterThan(fill);
    expect(effect).toBeGreaterThan(drawn);
    expect(capture).toContain('const direct = CONFIG.shader && !CONFIG.backdrop && !CONFIG.region && (CONFIG.alpha || CONFIG.shader.opaque)');
  });

  it('fits the backdrop by cover, contain or fill', () => {
    const html = page({ backdrop: { src: 'data:,', fit: 'contain' } });
    expect(html).toContain('CONFIG.backdrop.fit === "fill"');
    expect(html).toContain('CONFIG.backdrop.fit === "contain" ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih)');
  });

  it('places and sizes the effect in its region', () => {
    const html = page({ region: [320, 0, 320, 240] });
    expect(html).toContain('"region":[320,0,320,240]');
    expect(html).toContain('const R = CONFIG.region || [0, 0, W, H]');
    expect(html).toContain('glCanvas.width = EW; glCanvas.height = EH;');
    expect(html).toContain('gl.uniform3f(l, EW, EH, 1)');
    expect(html).toContain('sizeSvg(s.svg, EW, EH)');
    expect(regionPixels([0.5, 0, 0.5, 0.5], 640, 480)).toEqual([320, 0, 320, 240]);
    expect(regionPixels([0.999, 0.999, 0.001, 0.001], 100, 100)).toEqual([99, 99, 1, 1]);
  });

  it('checks regions and reads --region', () => {
    expect(checkRegion([0, 0, 1, 1])).toEqual([0, 0, 1, 1]);
    expect(parseRegion('0.5,0,0.5,1')).toEqual([0.5, 0, 0.5, 1]);
    expect(() => checkRegion([0, 0, 1])).toThrow(/region takes \[x, y, width, height\]/);
    expect(() => checkRegion([0.5, 0, 0.6, 1])).toThrow(/at most 1/);
    expect(() => checkRegion([0, 0, 0, 1])).toThrow(/more than 0/);
    expect(() => checkRegion([-0.1, 0, 0.5, 1])).toThrow(/between 0 and 1/);
    expect(() => parseRegion('left')).toThrow(/--region takes x,y,width,height/);
  });

  it('reads picture sizes from their headers, EXIF rotation included', () => {
    expect(imageNaturalSize(pngHeader(1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(imageNaturalSize(jpegHeader(4032, 3024))).toEqual({ width: 4032, height: 3024 });
    expect(imageNaturalSize(jpegHeader(4032, 3024, 6))).toEqual({ width: 3024, height: 4032 });
    const gif = Buffer.alloc(13);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);
    expect(imageNaturalSize(gif)).toEqual({ width: 320, height: 200 });
    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');
    webp.write('VP8X', 12, 'ascii');
    webp.writeUIntLE(799, 24, 3);
    webp.writeUIntLE(599, 27, 3);
    expect(imageNaturalSize(webp)).toEqual({ width: 800, height: 600 });
    expect(imageNaturalSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"/>'))).toEqual({ width: 400, height: 100 });
    expect(imageNaturalSize(Buffer.from('nope'))).toBeUndefined();
    expect(backdropSize(`data:image/png;base64,${pngHeader(640, 360).toString('base64')}`)).toEqual({ width: 640, height: 360 });
  });

  it("defaults the frame to the backdrop's own size, keeping its shape for one given side", () => {
    const sparkles = getEffect('sparkles')!;
    expect(effectFrameSize(sparkles, {}, { width: 1921, height: 1081 })).toEqual({ width: 1922, height: 1082 });
    expect(effectFrameSize(sparkles, { width: 960 }, { width: 1920, height: 1080 })).toEqual({ width: 960, height: 540 });
    expect(effectFrameSize(sparkles, { width: 500, height: 500 }, { width: 1920, height: 1080 })).toEqual({ width: 500, height: 500 });
    expect(effectFrameSize(sparkles, {})).toEqual({ width: 720, height: 720 });
  });

  it('refuses alpha with a backdrop', async () => {
    await expect(exportEffect('sparkles', { backdrop: pngFile(PNG_1X1), alpha: true, outputPath: path.join(os.tmpdir(), 'x.webm') })).rejects.toThrow(
      /A backdrop fills the frame, so there is no transparency left to keep/,
    );
  });

  it('refuses .svg output with a backdrop', async () => {
    await expect(exportEffect('toggle-switch', { backdrop: pngFile(PNG_1X1), outputPath: path.join(os.tmpdir(), 'x.svg') })).rejects.toThrow(
      /An animated SVG cannot carry a backdrop picture/,
    );
  });

  it('refuses a backdrop for a shader that draws every pixel, and says what to do instead', async () => {
    const out = path.join(os.tmpdir(), 'x.png');
    await expect(exportEffect('image-duotone', { backdrop: pngFile(PNG_1X1), outputPath: out })).rejects.toThrow(/pass the picture as its subject instead/);
    await expect(exportEffect('aurora', { backdrop: pngFile(PNG_1X1), outputPath: out })).rejects.toThrow(/pick an overlay effect/);
  });

  it('refuses an unknown fit', async () => {
    await expect(exportEffect('sparkles', { backdrop: pngFile(PNG_1X1), backdropFit: 'stretch' as never, outputPath: path.join(os.tmpdir(), 'x.png') })).rejects.toThrow(
      /--backdrop-fit\) takes cover, contain, fill/,
    );
  });

  it('refuses the same things from exportEffectBuffer, with an in-memory backdrop', async () => {
    await expect(exportEffectBuffer('sparkles', { format: 'webm', alpha: true, backdrop: { imageBuffer: PNG_1X1, ext: 'png' } })).rejects.toThrow(/no transparency left to keep/);
    await expect(exportEffectBuffer('toggle-switch', { format: 'svg', backdrop: { imageBuffer: PNG_1X1 } })).rejects.toThrow(/cannot carry a backdrop/);
    await expect(exportEffectBuffer('aurora', { format: 'png', backdrop: { imageBuffer: PNG_1X1 } })).rejects.toThrow(/draws every pixel itself/);
  });
});

describe('motion blur (shutter)', () => {
  it('gives each frame its sub-frame states, with the pointer acted out at each', () => {
    const plain = frameStates(3, 10, 100, 100, 'auto');
    expect(plain.map((s) => [s.time, s.frame, s.delta])).toEqual([[0, 0, 0], [0.1, 1, 0.1], [0.2, 2, 0.1]]);
    expect(frameStates(3, 10, 100, 100, 'auto', undefined)).toEqual(plain);
    const blurred = frameStates(3, 10, 100, 100, 'auto', { angle: 180, samples: 4 });
    expect(blurred).toHaveLength(12);
    expect(blurred.map((s) => s.frame)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(blurred[5]!.time).toBeCloseTo(0.1 + 1.5 * 0.0125, 12);
    expect(blurred[5]!.delta).toBeCloseTo(0.0125, 12);
    // The pointer moves between sub-frames, so a moving pointer blurs too.
    expect(blurred[4]!.pointer).not.toEqual(blurred[7]!.pointer);
  });

  it('refuses a shutter out of range, or on an animated SVG, before rendering', async () => {
    const out = path.join(os.tmpdir(), 'x.mp4');
    await expect(exportEffect('aurora', { outputPath: out, shutterAngle: 720 })).rejects.toThrow(/shutterAngle is 0 to 360 degrees \(180 is a film camera's usual/);
    await expect(exportEffect('aurora', { outputPath: out, shutterAngle: 180, shutterSamples: 64 })).rejects.toThrow(/shutterSamples is a whole number of sub-frames from 2 to 32/);
    await expect(exportEffect('toggle-switch', { outputPath: path.join(os.tmpdir(), 'x.svg'), shutterAngle: 180 })).rejects.toThrow(/An animated SVG has no frames to motion-blur/);
  });

  it('encodes an averaged frame as a PNG', () => {
    const rgba = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40]);
    const png = encodePng(rgba, 2, 2);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([2, 2, 8, 6]);
    const idat = png.indexOf('IDAT');
    const raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
    expect([...raw]).toEqual([0, ...rgba.subarray(0, 8), 0, ...rgba.subarray(8)]);
  });
});
