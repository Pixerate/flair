import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { defineConfig, type Plugin } from 'vitest/config';

// Compiles the `.svelte` test fixtures (`?server` for server rendering), and
// gives client tests Svelte's browser build, which `mount` and `hydrate` need.
const svelteFixtures: Plugin = {
  name: 'svelte-fixtures',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'svelte') return realpathSync(fileURLToPath(new URL('./node_modules/svelte/src/index-client.js', import.meta.url)));
  },
  transform(code, id) {
    const [file, query] = id.split('?');
    if (!file!.endsWith('.svelte')) return;
    return compile(code, { filename: file, generate: query === 'server' ? 'server' : 'client' }).js;
  },
};

export default defineConfig({
  plugins: [svelteFixtures],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
