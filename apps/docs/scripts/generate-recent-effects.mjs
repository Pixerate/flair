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

  let commits = [];
  try {
    commits = execSync('git log --format="%H" -- src/catalog/meta.generated.json', { cwd: ROOT_DIR })
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

  const found = new Map();

  for (const hash of commits) {
    try {
      const diff = execSync(`git show ${hash} src/catalog/meta.generated.json`, { cwd: ROOT_DIR }).toString();
      const date = execSync(`git show -s --format="%aI" ${hash}`, { cwd: ROOT_DIR }).toString().trim();
      const lines = diff.split('\n');

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++') && line.includes('"id":')) {
          const match = line.match(/"id":\s*"([^"]+)"/);
          if (match && effectMap.has(match[1])) {
            const id = match[1];
            if (!found.has(id)) {
              const effectMeta = effectMap.get(id);
              found.set(id, {
                ...effectMeta,
                addedAt: date,
                commitHash: hash,
              });
            }
          }
        }
      }
    } catch (e) {
      // Continue or break if reach root
    }
  }

  // Sort by addedAt descending
  const sorted = Array.from(found.values()).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );

  // Take top 16 recent effects
  const recent = sorted.slice(0, 16);
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(recent, null, 2), 'utf-8');
  console.log(`Successfully generated ${recent.length} dynamic recent effects in ${OUTPUT_PATH}`);
}

generateRecentEffects();
