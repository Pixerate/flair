/**
 * The agent skills Flair ships (in the package's `skills/` folder), for
 * coding agents such as Claude Code or Cursor writing code that uses Flair,
 * and installing them into a project. Node-only: it reads and writes files.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The skills in the package, by folder name. */
export const FLAIR_SKILLS = [
  { name: "flair-use", description: "Finding catalog effects and putting them on a page, in React or Svelte, in a scene or a recording, and checking the result." },
  { name: "flair-author", description: "Writing custom shader and vector effects: declared controls, presets, and checking them with `flair controls`." },
] as const;

export type FlairSkillName = (typeof FLAIR_SKILLS)[number]["name"];

/** Where `installSkills` copies to unless told otherwise, relative to the project. */
export const DEFAULT_SKILLS_DIR = ".claude/skills";

export interface InstallSkillsOptions {
  /** The folder to copy the skills into (default `.claude/skills`), relative to `cwd`. */
  dir?: string;
  /** The project folder (default `process.cwd()`). */
  cwd?: string;
  /** Only these skills (default all of `FLAIR_SKILLS`). */
  skills?: readonly string[];
}

/** One file written (or left as it was) by `installSkills`. */
export interface InstalledSkillFile {
  /** Path from the skills folder: `flair-use/SKILL.md`. */
  file: string;
  status: "added" | "updated" | "unchanged";
}

export interface InstalledSkills {
  /** The absolute folder the skills went into. */
  dir: string;
  skills: FlairSkillName[];
  files: InstalledSkillFile[];
}

/**
 * The package's `skills/` folder: the nearest one above this module that
 * holds Flair's skills (from `dist/` in the package, or `src/` in the repo).
 */
export function skillsSource(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, "skills");
    if (FLAIR_SKILLS.every((s) => fs.existsSync(path.join(candidate, s.name, "SKILL.md")))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Flair's skills folder is missing from the package; reinstall @pixerate/flair.");
    dir = parent;
  }
}

/** Every file under `dir`, as paths from it with forward slashes, sorted. */
function filesUnder(dir: string, prefix = ""): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), rel) : entry.isFile() ? [rel] : [];
    })
    .sort();
}

/**
 * Copies Flair's skills into a project, so a coding agent there finds them
 * (`.claude/skills/<name>/SKILL.md` for Claude Code). Files already there are
 * brought up to date; anything else in the folder is left alone. Throws a
 * sentence saying what to fix for an unknown skill or a folder that cannot
 * be written, before anything is written.
 */
export function installSkills(options: InstallSkillsOptions = {}): InstalledSkills {
  const names = FLAIR_SKILLS.map((s) => s.name) as string[];
  if (options.dir !== undefined && (typeof options.dir !== "string" || !options.dir.trim()))
    throw new Error(`The skills folder must be a path, like ${DEFAULT_SKILLS_DIR}; it was ${JSON.stringify(options.dir)}.`);
  const wanted = options.skills?.length ? [...new Set(options.skills)] : names;
  const unknown = wanted.filter((s) => !names.includes(s));
  if (unknown.length)
    throw new Error(`There is no skill ${unknown.map((s) => `"${s}"`).join(", ")}; Flair ships ${names.join(" and ")}.`);

  const dir = path.resolve(options.cwd ?? process.cwd(), options.dir ?? DEFAULT_SKILLS_DIR);
  const blocked = [dir, ...wanted.map((s) => path.join(dir, s))].find((p) => fs.existsSync(p) && !fs.statSync(p).isDirectory());
  if (blocked) throw new Error(`${blocked} is a file, not a folder; pick another --dir or move it.`);

  const source = skillsSource();
  const files: InstalledSkillFile[] = [];
  for (const skill of wanted) {
    for (const rel of filesUnder(path.join(source, skill))) {
      const from = path.join(source, skill, rel);
      const to = path.join(dir, skill, rel);
      const content = fs.readFileSync(from);
      const existing = fs.existsSync(to) ? fs.readFileSync(to) : undefined;
      const status = existing === undefined ? "added" : existing.equals(content) ? "unchanged" : "updated";
      if (status !== "unchanged") {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, content);
      }
      files.push({ file: `${skill}/${rel}`, status });
    }
  }
  return { dir, skills: wanted as FlairSkillName[], files };
}
