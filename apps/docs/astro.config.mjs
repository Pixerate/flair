import node from "@apphosting/astro-adapter";
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  site: process.env.DOCS_SITE_URL || 'https://flair.pixerate.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    starlight({
      title: 'Flair',
      description: 'Visual effects and motion graphics for the web: WebGL2 shaders, animated vectors, ready-made catalog, and agent-ready editor.',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      social: {
        github: 'https://github.com/Pixerate/flair',
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        Hero: './src/components/StarlightHeroOverride.astro',
        ThemeSelect: './src/components/ThemeSelectOverride.astro',
        ThemeProvider: './src/components/ThemeProviderOverride.astro',
      },
      sidebar: [
        {
          label: 'Start Here',
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Catalog & Gallery',
          autogenerate: { directory: 'catalog' },
        },
        {
          label: 'Shader Engine',
          autogenerate: { directory: 'shader-engine' },
        },
        {
          label: 'Vector & Motion',
          autogenerate: { directory: 'vector-motion' },
        },
        {
          label: 'Directing & Scenes',
          autogenerate: { directory: 'directing' },
        },
        {
          label: 'Editor & Agents',
          autogenerate: { directory: 'editor-and-agents' },
        },
        {
          label: 'Frameworks',
          autogenerate: { directory: 'frameworks' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
    svelte(),
  ],
});
