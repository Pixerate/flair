import { describe, expect, it } from 'vitest';
import { checkTemplate, instantiateTemplate } from '../scene/template.js';
import { checkSceneLayers } from '../scene/layercheck.js';
import { SCENE_TEMPLATES } from './templates.js';

describe('catalog templates', () => {
  for (const template of SCENE_TEMPLATES) {
    it(`${template.id} is sound and fills with its defaults into a scene with no issues`, async () => {
      expect(checkTemplate(template)).toEqual([]);
      const result = instantiateTemplate(template);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.issues).toEqual([]);
      expect(await checkSceneLayers(result.scene)).toEqual([]);
      expect(result.openSlots).toEqual([]);
      expect(JSON.stringify(result.scene)).not.toMatch(/\{\{/);
    });
  }

  it('have unique ids', () => {
    expect(new Set(SCENE_TEMPLATES.map((t) => t.id)).size).toBe(SCENE_TEMPLATES.length);
  });
});

describe('the root entry', () => {
  it('reaches the templates only through a dynamic import', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const files = ['src/index.ts', 'src/agent/tools.ts', 'src/agent/batch.ts', ...readdirSync('src/scene').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => `src/scene/${f}`)];
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"][./]*(catalog\/)?templates\.js['"]/);
  });
});
