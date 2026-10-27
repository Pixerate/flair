import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../..');
const META_PATH = path.resolve(ROOT_DIR, 'src/catalog/meta.generated.json');
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/recent-effects.generated.json');

function generateRecentEffects() {
  console.log('Generating dynamic recent effects list from git history...');
  if (!fs.existsSync(META_PATH)) {
    console.error(`Meta file not found: ${META_PATH}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  const effectMap = new Map(meta.map((e) => [e.id, e]));

  let hashes = [];
  try {
    hashes = execSync('git log --format="%H" -- src/catalog/meta.generated.json', { cwd: ROOT_DIR })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch (err) {
    console.warn('Git log failed, falling back to end of catalog', err);
    const fallback = meta.slice(-16).reverse();
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2));
    return;
  }

  // Iterate oldest-to-newest commits on meta.generated.json to record the exact
  // commit and timestamp where each effect was first introduced into the catalog.
  const commitsOldestFirst = [...hashes].reverse();
  const introduction = new Map();

  for (const hash of commitsOldestFirst) {
    try {
      const date = execSync(`git show -s --format="%aI" ${hash}`, { cwd: ROOT_DIR }).toString().trim();
      const content = execSync(`git show ${hash}:src/catalog/meta.generated.json`, { cwd: ROOT_DIR }).toString();
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/"id":\s*"([^"]+)"/);
        if (match && effectMap.has(match[1])) {
          const id = match[1];
          if (!introduction.has(id)) {
            introduction.set(id, { hash, date, order: introduction.size });
          }
        }
      }
    } catch (e) {
      // Continue if commit read fails
    }
  }

  // Sort all effects by their introduction date descending.
  // If dates are identical (same batch commit), maintain catalog reverse order.
  const enriched = meta.map((e) => {
    const intro = introduction.get(e.id);
    return {
      ...e,
      addedAt: intro?.date || new Date().toISOString(),
      commitHash: intro?.hash || '',
      order: intro?.order ?? 0,
    };
  });

  enriched.sort((a, b) => {
    const diff = new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    if (diff !== 0) return diff;
    return b.order - a.order;
  });

  // Take top 20 genuinely newest effects
  const recent = enriched.slice(0, 20);
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(recent, null, 2), 'utf-8');
  console.log(`Successfully generated ${recent.length} dynamic recent effects in ${OUTPUT_PATH}`);
}

generateRecentEffects();
