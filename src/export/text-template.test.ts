import { describe, it, expect } from 'vitest';
import { exportTextTemplate, TEXT_TEMPLATE_FORMAT } from './text-template.js';
import { exportScene } from './scene-export.js';
import type { Scene } from '../scene/types.js';

/** A titled, captioned scene with a labelled card, a karaoke caption and a slot shown twice. */
const scene: Scene = {
  name: 'promo',
  stage: { width: 1920, height: 1080 },
  shots: [
    {
      title: 'Hello world',
      caption: 'First',
      hold: 1000,
      run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 100, y: 100, width: 300, height: 120, text: 'Label', fontSize: 32 } }],
    },
    {
      caption: 'Second',
      hold: 2000,
      layers: [
        { id: 'sing', effect: 'caption-karaoke', values: { text: 'one two three', pace: 500 }, rect: { x: 200, y: 600, width: 800, height: 400 } },
        { id: 'head', effect: 'caption-word-bounce', subject: { slot: 'headline' }, role: 'overlay' },
        { id: 'head-again', effect: 'kinetic-stagger', subject: { slot: 'headline' }, from: 1000 },
      ],
    },
    { title: '', hold: 1000, layers: [{ id: 'words', subject: { text: 'Big words', font: 'Georgia, serif', weight: 700 }, rect: { x: 0, y: 0, width: 1024, height: 256 } }] },
  ],
};

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)!;

describe('exportTextTemplate', () => {
  it('turns titles, captions, element text and text layers into editable Lottie text layers', async () => {
    const t = await exportTextTemplate(scene);
    expect(t.format).toBe(TEXT_TEMPLATE_FORMAT);
    // Layers top of the stack first: the overlay, then the board's subjects (later first), then the background.
    expect(t.texts.map((x) => x.id)).toEqual(['shot1.title', 'shot1.caption', 'shot2.caption', 'head.text', 'words.text', 'sing.text', 'head-again.text', 'element.card']);
    const textLayers = t.animation.layers.filter((l) => l.ty === 5);
    expect(textLayers.map((l) => l.nm)).toEqual(t.texts.map((x) => x.id));
    for (const text of t.texts) {
      const layer = t.animation.layers.find((l) => l.ind === text.layer)!;
      expect(layer.ty).toBe(5);
      expect(layer.t?.d).toMatchObject({ sid: text.slot, k: [{ s: { t: text.text, f: text.font.name, s: text.font.size } }] });
      expect(t.animation.slots?.[text.slot]?.p.k[0]?.s.t).toBe(text.text);
      expect(t.fonts.map((f) => f.name)).toContain(text.font.name);
    }
    // Text draws above the shapes it labels.
    expect(t.animation.layers.findIndex((l) => l.nm === 'element.card')).toBeLessThan(t.animation.layers.findIndex((l) => l.nm === 'card'));
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });

  it('times titles and captions as the player carries them over, and clears a title set to ""', async () => {
    const t = await exportTextTemplate(scene, { frameRate: 30 });
    expect(byId(t.texts, 'shot1.title')).toMatchObject({ inMs: 0, outMs: 3000, ip: 0, op: 90 });
    expect(byId(t.texts, 'shot1.caption')).toMatchObject({ inMs: 0, outMs: 1000, ip: 0, op: 30 });
    expect(byId(t.texts, 'shot2.caption')).toMatchObject({ inMs: 1000, outMs: 4000 });
  });

  it('styles and places titles and captions as the compositor draws them', async () => {
    const t = await exportTextTemplate(scene);
    const title = byId(t.texts, 'shot1.title');
    expect(title.font).toMatchObject({ family: 'system-ui, sans-serif', weight: 600, size: 30, lineHeight: 36 });
    expect(title).toMatchObject({ fill: '#ffffff', align: 'center', onBoard: false });
    expect(title.box.x + title.box.width / 2).toBeCloseTo(960, 1);
    expect(title.box.y).toBeGreaterThan(24);
    expect(title.box.y + title.box.height).toBeLessThan(24 + 60 + 10);
    const caption = byId(t.texts, 'shot1.caption');
    expect(caption.font).toMatchObject({ weight: 400, size: 28 });
    expect(caption.box.y).toBeGreaterThan(1080 - 64 - 52);
    expect(t.fonts.find((f) => f.name === title.font.name)).toEqual({ name: 'systemui-SemiBold', family: 'system-ui, sans-serif', weight: 600 });
  });

  it("hangs an element's text off its shape layer, at the compositor's inset", async () => {
    const t = await exportTextTemplate(scene);
    const text = byId(t.texts, 'element.card');
    const shape = t.animation.layers.find((l) => l.ty === 4 && l.nm === 'card')!;
    const layer = t.animation.layers.find((l) => l.ind === text.layer)!;
    expect(layer.parent).toBe(shape.ind);
    expect(layer.ks.p.k).toEqual([16 - 150, 48 - 60, 0]);
    expect(text).toMatchObject({ source: 'element', onBoard: true, align: 'left', box: { x: 116 } });
    expect(text.font).toMatchObject({ size: 32, family: 'sans-serif' });
  });

  it('gives a paced text effect word timings, revealed by a word range selector', async () => {
    const t = await exportTextTemplate(scene, { frameRate: 30 });
    const sing = byId(t.texts, 'sing.text');
    expect(sing).toMatchObject({ effect: 'caption-karaoke', text: 'one two three', inMs: 1000, outMs: 3000, onBoard: true });
    expect(sing.segments).toEqual([
      { text: 'one', startMs: 1000, endMs: 3000 },
      { text: 'two', startMs: 1500, endMs: 3000 },
      { text: 'three', startMs: 2000, endMs: 3000 },
    ]);
    // The effect's own font, fitted into the layer's box.
    expect(sing.font).toMatchObject({ family: "'Arial Black', 'Helvetica Neue', Impact, system-ui, sans-serif", weight: 900 });
    expect(sing.box.x).toBeGreaterThanOrEqual(200);
    expect(sing.box.x + sing.box.width).toBeLessThanOrEqual(1000);
    const animators = t.animation.layers.find((l) => l.ind === sing.layer)!.t!.a as any[];
    expect(animators).toHaveLength(1);
    expect(animators[0].s.b).toBe(3);
    expect(animators[0].s.s.k).toEqual([
      { t: 30, s: [33.33], h: 1 },
      { t: 45, s: [66.67], h: 1 },
      { t: 60, s: [100], h: 1 },
    ]);
  });

  it('times words by letters for letter-paced effects', async () => {
    const t = await exportTextTemplate({ name: 'letters', shots: [{ hold: 3000, layers: [{ id: 'k', effect: 'kinetic-stagger', values: { text: 'Go big', stagger: 100 } }] }] });
    expect(byId(t.texts, 'k.text').segments).toEqual([
      { text: 'Go', startMs: 0, endMs: 3000 },
      { text: 'big', startMs: 300, endMs: 3000 },
    ]);
  });

  it('makes a scene slot one field, however many layers show it', async () => {
    const t = await exportTextTemplate(scene);
    expect(byId(t.fields, 'headline')).toEqual({ id: 'headline', label: 'Text', default: 'Words that bounce into place', texts: ['head.text', 'head-again.text'], sceneSlot: 'headline' });
    expect(byId(t.texts, 'head.text')).toMatchObject({ field: 'headline', slot: 'head.text', onBoard: false });
    expect(byId(t.fields, 'shot1.title')).toEqual({ id: 'shot1.title', label: 'Title', default: 'Hello world', texts: ['shot1.title'] });
    expect(t.fields.map((f) => f.id)).toEqual(['shot1.title', 'shot1.caption', 'shot2.caption', 'headline', 'words.text', 'sing.text', 'element.card']);
  });

  it("takes a text subject's font and weight, and fits its words in the layer's box", async () => {
    const t = await exportTextTemplate(scene);
    const words = byId(t.texts, 'words.text');
    expect(words.font).toMatchObject({ family: 'Georgia, serif', weight: 700 });
    expect(words.box.width).toBeLessThanOrEqual(1024);
    expect(words.box.height).toBeLessThanOrEqual(256);
    expect(t.fonts.find((f) => f.family === 'Georgia, serif')?.name).toBe('Georgia-Bold');
  });

  it('fills an effect\'s text controls from its values, its preset or its defaults, a text each', async () => {
    const t = await exportTextTemplate({ name: 'l3', shots: [{ hold: 2000, layers: [{ id: 'l3', effect: 'lower-third', values: { name: 'Grace Hopper' }, rect: { x: 100, y: 800, width: 900, height: 200 } }] }] });
    expect(t.texts.map((x) => [x.id, x.text])).toEqual([
      ['l3.name', 'Grace Hopper'],
      ['l3.title', 'Mathematician and writer'],
    ]);
    const [name, title] = t.texts;
    expect(name!.box.y).toBeLessThan(title!.box.y);
  });

  it('notes what it carries as text and what it leaves out', async () => {
    const t = await exportTextTemplate({ name: 'notes', shots: [{ hold: 1000, layers: [{ id: 'sing', effect: 'caption-karaoke' }, { id: 'sky', effect: 'aurora' }] }, { hold: 500, transition: { effect: 'transition-wipe' } }] });
    expect(t.notes).toEqual([
      expect.stringMatching(/^Layer "sing" \(caption-karaoke\) is editable text in the text template/),
      expect.stringMatching(/^Layer "sky" \(aurora\) is left out of the text template/),
      expect.stringMatching(/transition-wipe" is a marker in the text template/),
    ]);
    expect(t.animation.meta?.d).toBe(t.notes.join(' '));
  });

  it('exports a scene with no words as an empty template', async () => {
    const t = await exportTextTemplate({ name: 'quiet', shots: [{ hold: 500 }] });
    expect(t.texts).toEqual([]);
    expect(t.fields).toEqual([]);
    expect(t.animation.slots).toBeUndefined();
    expect(t.animation.fonts.list).toEqual([]);
  });
});

describe('exportScene', () => {
  it('exports to every format, with its extension and notes', async () => {
    const quiet: Scene = { name: 'quiet', shots: [{ hold: 500, layers: [{ effect: 'aurora' }] }] };
    for (const [format, extension] of [['lottie', 'json'], ['motn', 'motn'], ['fcp7', 'xml'], ['edl', 'edl'], ['text-template', 'json']] as const) {
      const out = await exportScene(quiet, format);
      expect(out.extension).toBe(extension);
      expect(out.content.length).toBeGreaterThan(0);
      expect(out.notes.length).toBe(1);
    }
    expect(JSON.parse((await exportScene(scene, 'text-template')).content).format).toBe(TEXT_TEMPLATE_FORMAT);
    expect((await exportScene(quiet, 'edl', { reel: 'B1' })).content).toContain('B1');
  });

  it('refuses an unknown format or frame rate, naming the valid ones', async () => {
    await expect(exportScene(scene, 'gif' as never)).rejects.toThrow('There is no export format "gif"; the formats are lottie, motn, fcp7, edl, text-template.');
    await expect(exportScene(scene, 'lottie', { frameRate: 0 })).rejects.toThrow('give 1 to 240 frames per second');
  });
});
