import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.DOCS_SITE_URL || 'https://flair.pixerate.com';
const DOCS_DIR = path.resolve(__dirname, '../src/content/docs');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const ROOT_DIR = path.resolve(__dirname, '../../..');

function sectionFiles(section) {
  const dir = path.join(DOCS_DIR, section.dir);
  if (!fs.existsSync(dir)) return [];
  const others = fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f) && !section.files.includes(f))
    .sort();
  return [...section.files.filter((f) => fs.existsSync(path.join(dir, f))), ...others];
}

const SECTIONS = [
  {
    title: 'Start Here',
    dir: 'getting-started',
    files: ['introduction.md', 'quick-start.md', 'architecture.md'],
  },
  {
    title: 'Catalog & Gallery',
    dir: 'catalog',
    files: ['explorer.mdx', 'shaders.md', 'vector.md'],
  },
  {
    title: 'Shader Engine',
    dir: 'shader-engine',
    files: ['controls.md', 'interactions.md', 'audio-and-scroll.md'],
  },
  {
    title: 'Vector & Motion',
    dir: 'vector-motion',
    files: ['svg-motion.md', 'motion-primitives.md'],
  },
  {
    title: 'Directing & Scenes',
    dir: 'directing',
    files: ['scenes.md', 'interchange.md'],
  },
  {
    title: 'Editor & Agents',
    dir: 'editor-and-agents',
    files: ['effect-editor.md', 'mcp-tools.md'],
  },
  {
    title: 'Frameworks',
    dir: 'frameworks',
    files: ['react.md', 'svelte.md'],
  },
  {
    title: 'Reference',
    dir: 'reference',
    files: ['api.md'],
  },
];

function parseFrontmatter(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: {}, body: rawContent };
  }

  const frontmatterStr = match[1];
  const body = rawContent.slice(match[0].length).trim();
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function generate() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const collectedDocs = [];

  for (const section of SECTIONS) {
    const sectionDocs = [];
    for (const filename of sectionFiles(section)) {
      const filePath = path.join(DOCS_DIR, section.dir, filename);
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(raw);
      const slug = filename.replace(/\.mdx?$/, '');
      const url = `${BASE_URL}/${section.dir}/${slug}/`;

      sectionDocs.push({
        title: frontmatter.title || slug,
        description: frontmatter.description || '',
        url,
        body,
        section: section.title,
        dir: section.dir,
        slug,
      });
    }

    collectedDocs.push({
      sectionTitle: section.title,
      docs: sectionDocs,
    });
  }

  let llmsTxt = `# Flair

> Visual effects and motion graphics for the web: WebGL2 shader effects, animated vector effects, a catalog of 450+ ready-made looks, and a UI-agnostic, agent-ready effect editor.

- Website: ${BASE_URL}
- GitHub: https://github.com/Pixerate/flair
- npm: https://www.npmjs.com/package/@pixerate/flair
- Full Context: ${BASE_URL}/llms-full.txt
- Sitemap: ${BASE_URL}/sitemap.xml

## Start Here
`;

  for (const { sectionTitle, docs } of collectedDocs) {
    if (sectionTitle !== 'Start Here') {
      llmsTxt += `\n## ${sectionTitle}\n\n`;
    } else {
      llmsTxt += `\n`;
    }
    for (const doc of docs) {
      if (doc.description) {
        llmsTxt += `- [${doc.title}](${doc.url}): ${doc.description}\n`;
      } else {
        llmsTxt += `- [${doc.title}](${doc.url})\n`;
      }
    }
  }

  llmsTxt += `\n## Optional & External Resources\n\n`;
  llmsTxt += `- [Full Documentation Bundle](${BASE_URL}/llms-full.txt): Complete combined documentation in plain text markdown format.\n`;
  llmsTxt += `- [GitHub Repository](https://github.com/Pixerate/flair): Source code, issues, and discussions.\n`;

  const docsLlmsPath = path.join(PUBLIC_DIR, 'llms.txt');
  fs.writeFileSync(docsLlmsPath, llmsTxt, 'utf-8');
  console.log(`Generated ${docsLlmsPath}`);

  const rootLlmsPath = path.join(ROOT_DIR, 'llms.txt');
  fs.writeFileSync(rootLlmsPath, llmsTxt, 'utf-8');
  console.log(`Generated ${rootLlmsPath}`);

  let llmsFullTxt = `# Flair — Full Documentation Bundle

> Visual effects and motion graphics for the web.
> Source: ${BASE_URL}
> Generated on: ${new Date().toISOString()}

================================================================================
`;

  for (const { sectionTitle, docs } of collectedDocs) {
    llmsFullTxt += `\n\n# SECTION: ${sectionTitle.toUpperCase()}\n`;
    llmsFullTxt += `================================================================================\n`;

    for (const doc of docs) {
      llmsFullTxt += `\n## ${doc.title}\n`;
      llmsFullTxt += `URL: ${doc.url}\n`;
      if (doc.description) {
        llmsFullTxt += `Description: ${doc.description}\n`;
      }
      llmsFullTxt += `\n${doc.body}\n`;
      llmsFullTxt += `\n--------------------------------------------------------------------------------\n`;
    }
  }

  const docsLlmsFullPath = path.join(PUBLIC_DIR, 'llms-full.txt');
  fs.writeFileSync(docsLlmsFullPath, llmsFullTxt, 'utf-8');
  console.log(`Generated ${docsLlmsFullPath}`);

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap-index.xml
Sitemap: ${BASE_URL}/sitemap.xml
`;
  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  console.log(`Generated ${robotsPath}`);

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>
`;
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8');
  console.log(`Generated ${sitemapPath}`);
}

generate();
