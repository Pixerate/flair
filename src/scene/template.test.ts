import { describe, expect, it } from 'vitest';
import { checkTemplate, describeTemplateSlots, instantiateTemplate, templateSlotSummary, type SceneTemplate } from './template.js';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const template: SceneTemplate = deepFreeze({
  id: 'promo',
  name: 'Promo',
  description: 'A test template.',
  slots: [
    { name: 'product', type: 'image', label: 'Product', default: 'https://example.com/p.png' },
    { name: 'clip', type: 'video', label: 'Clip' },
    { name: 'headline', type: 'text', label: 'Headline', default: 'Meet Nova', maxLength: 20 },
    { name: 'accent', type: 'color', label: 'Accent', default: '#FF5A36' },
    { name: 'holdMs', type: 'number', label: 'Hold', default: 2000, min: 800, max: 6000, integer: true },
  ],
  scene: {
    name: 'promo',
    title: '{{headline}} promo',
    shots: [
      {
        title: '{{headline}}',
        caption: 'Hold {{holdMs}} ms in {{accent}}; {{unknown}} stays',
        hold: '{{holdMs}}',
        layers: [
          { effect: 'mesh-gradient', role: 'background', values: { uColorA: '{{accent}}', uSpeed: 0.3 } },
          { effect: 'image-duotone', subject: { slot: 'product' }, rect: { x: 0, y: 0, width: 640, height: 360 } },
          { subject: { slot: 'clip' } },
          { effect: 'lower-third', role: 'overlay', subject: { text: '{{headline}}' } },
        ],
        run: [{ type: 'element', element: { id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 40, text: '{{headline}}!' } }],
      },
    ],
  },
});

describe('instantiateTemplate', () => {
  it('fills placeholders, typed where a whole string, and inlines subjects', () => {
    const result = instantiateTemplate(template, { headline: 'Hello', holdMs: 1500, product: '<svg viewBox="0 0 1 1"/>' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shot = result.scene.shots[0]!;
    expect(result.scene.title).toBe('Hello promo');
    expect(shot.title).toBe('Hello');
    expect(shot.hold).toBe(1500);
    expect(shot.caption).toBe('Hold 1500 ms in #FF5A36; {{unknown}} stays');
    expect(shot.layers![0]!.values).toEqual({ uColorA: '#FF5A36', uSpeed: 0.3 });
    expect(shot.layers![1]!.subject).toEqual({ svg: '<svg viewBox="0 0 1 1"/>' });
    expect(shot.layers![2]!.subject).toEqual({ slot: 'clip' });
    expect(shot.layers![3]!.subject).toEqual({ text: 'Hello' });
    expect((shot.run![0] as any).element.text).toBe('Hello!');
    expect(result.openSlots).toEqual(['clip']);
  });

  it('uses defaults, inlines a video by kind, and keeps a slot given { slot }', () => {
    const filled = instantiateTemplate(template, { clip: 'https://example.com/c.mp4', product: { slot: 'hero' } }, { name: 'my-promo' });
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    expect(filled.scene.name).toBe('my-promo');
    expect(filled.scene.shots[0]!.layers![1]!.subject).toEqual({ slot: 'hero' });
    expect(filled.scene.shots[0]!.layers![2]!.subject).toEqual({ video: 'https://example.com/c.mp4' });
    expect(filled.openSlots).toEqual(['hero']);
    const defaults = instantiateTemplate(template);
    expect(defaults.ok && defaults.scene.shots[0]!.layers![1]!.subject).toEqual({ image: 'https://example.com/p.png' });
  });

  it('refuses unknown slots, wrong types and out-of-range values all at once, naming the choices', () => {
    const result = instantiateTemplate(template, { colour: '#000000', accent: 3, holdMs: 9000, headline: 'x'.repeat(30), product: { video: 'v.mp4' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      'There is no slot "colour"; "promo" has product (image), clip (video), headline (text), accent (color), holdMs (number).',
      'Slot "accent" takes a colour like "#FF5A36", not the number 3.',
      'Slot "holdMs" takes a whole number from 800 to 6000; 9000 is out of range.',
      expect.stringContaining('Slot "headline" takes up to 20 characters'),
      'Slot "product" takes { "image": … } or { "svg": … }, not { "video": … }.',
    ]);
    const fraction = instantiateTemplate(template, { holdMs: 1000.5 });
    expect(!fraction.ok && fraction.errors).toEqual(['Slot "holdMs" takes a whole number from 800 to 6000; 1000.5 is not whole.']);
    const name = instantiateTemplate(template, {}, { name: 'Bad Name' });
    expect(!name.ok && name.errors[0]).toMatch(/lowercase words and dashes/);
  });

  it('never changes the template', () => {
    const before = JSON.stringify(template);
    instantiateTemplate(template, { headline: 'Changed' });
    expect(JSON.stringify(template)).toBe(before);
  });
});

describe('checkTemplate', () => {
  it('names undeclared, misused, unused and badly defaulted slots', () => {
    const problems = checkTemplate({
      id: 'Bad',
      name: 'Bad',
      description: 'x',
      slots: [
        { name: 'title', type: 'text', label: 'Title', default: 'way too long', maxLength: 3 },
        { name: 'pic', type: 'image', label: 'Pic' },
        { name: 'spare', type: 'color', label: 'Spare', default: 'red' },
        { name: 'pic', type: 'text', label: 'Again', default: 'x' },
      ],
      scene: { name: 'bad', shots: [{ title: '{{pic}} {{missing}}', layers: [{ subject: { slot: 'title' } }, { subject: { slot: 'ghost' } }] }] },
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lowercase words and dashes'),
        expect.stringContaining('Slot "title"\'s default does not fit'),
        'Slot "pic" is declared twice.',
        expect.stringContaining('Slot "spare"\'s default does not fit'),
        'The scene uses {{missing}}, which is not a declared slot; declare it in "slots".',
        expect.stringContaining('A layer\'s subject is { "slot": "title" }, but "title" is a text slot'),
        expect.stringContaining('{ "slot": "ghost" }, which is not a declared slot'),
        'Slot "spare" is declared but the scene never uses it.',
      ]),
    );
  });

  it('passes a sound template and reports its scene issues with defaults', () => {
    expect(checkTemplate(template)).toEqual(['The scene uses {{unknown}}, which is not a declared slot; declare it in "slots".']);
    const sound = { ...template, scene: { ...template.scene, shots: [{ ...template.scene.shots[0]!, caption: 'Hold {{holdMs}} ms' }] } };
    expect(checkTemplate(sound)).toEqual([]);
    const broken = checkTemplate({ ...sound, scene: { ...sound.scene, shots: [{ ...sound.scene.shots[0]!, layers: [...template.scene.shots[0]!.layers!, { effect: 'no-such-effect' }] }] } });
    expect(broken.some((p) => p.startsWith('With its defaults, shot 1:') && p.includes('no-such-effect'))).toBe(true);
  });
});

describe('slot descriptions', () => {
  it('summarise each slot in a line and leave subject defaults out of listings', () => {
    expect(templateSlotSummary(template.slots[4]!)).toBe('holdMs (number): Hold; takes a whole number from 800 to 6000; default 2000.');
    expect(templateSlotSummary(template.slots[1]!)).toBe('clip (video): Clip; takes a video URL; the host fills it when none is given.');
    expect(describeTemplateSlots(template)[0]).toEqual({ name: 'product', type: 'image', label: 'Product', hasDefault: true });
  });
});
