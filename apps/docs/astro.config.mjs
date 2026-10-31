import node from "@apphosting/astro-adapter";
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
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
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Pixerate/flair' }],
      customCss: ['./src/styles/custom.css'],
      components: {
        Hero: './src/components/StarlightHeroOverride.astro',
        ThemeSelect: './src/components/ThemeSelectOverride.astro',
        ThemeProvider: './src/components/ThemeProviderOverride.astro',
      },
      sidebar: [
        {
          label: 'Start Here',
          items: [{ autogenerate: { directory: 'getting-started' } }],
        },
        {
          label: 'Catalog & Gallery',
          items: [{ autogenerate: { directory: 'catalog' } }],
        },
        {
          label: 'Shader Engine',
          items: [{ autogenerate: { directory: 'shader-engine' } }],
        },
        {
          label: 'Vector & Motion',
          items: [{ autogenerate: { directory: 'vector-motion' } }],
        },
        {
          label: 'Directing & Scenes',
          items: [{ autogenerate: { directory: 'directing' } }],
        },
        {
          label: 'Editor & Agents',
          items: [{ autogenerate: { directory: 'editor-and-agents' } }],
        },
        {
          label: 'Frameworks',
          items: [{ autogenerate: { directory: 'frameworks' } }],
        },
        {
          label: 'Reference',
          items: [{ autogenerate: { directory: 'reference' } }],
        },
      ],
    }),
    svelte(),
  ],
});
