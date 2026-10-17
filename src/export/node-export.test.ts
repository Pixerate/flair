// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getEffect, type VectorEffect } from '../catalog/index.js';
import { wrapSource } from '../shader/program.js';
import {
  checkEffectValues,
  effectQueryFromFlags,
  nodeSubjectValues,
  parseSets,
  parseSize,
  probeVideo,
  subjectsFromFlags,
  vectorTimeline,
  videoSeconds,
} from './effect.js';
import { chromeArgs, fragmentSource, pageControls, planOutput, renderPageHtml, scriptedPointer, sequencePath } from './recorder.js';

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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-probe-'));
    const videoWithAudio = path.join(dir, 'sample-audio.mp4');
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'ffmpeg',
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

