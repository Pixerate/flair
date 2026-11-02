// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SKILLS_DIR, FLAIR_SKILLS, installSkills, skillsSource } from "./skills.js";
import { EFFECTS, getEffect, SCENE_TEMPLATES } from "./catalog/index.js";
import { PRIMITIVES } from "./motion/index.js";
import { FLAIR_AGENT_TOOLS } from "./agent/index.js";

const SKILLS = resolve("skills");

/** Every file under `dir`, relative to it. */
function walk(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

describe("installSkills", () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "flair-skills-"));
  });
  afterEach(() => rmSync(project, { recursive: true, force: true }));

  it("copies every skill into .claude/skills, then reports them unchanged, updated, and leaves other files alone", () => {
    const first = installSkills({ cwd: project });
    expect(first.dir).toBe(join(project, DEFAULT_SKILLS_DIR));
    expect(first.skills).toEqual(FLAIR_SKILLS.map((s) => s.name));
    expect(first.files.length).toBe(walk(SKILLS).filter((f) => FLAIR_SKILLS.some((s) => f.startsWith(`${s.name}/`))).length);
    expect(first.files.every((f) => f.status === "added")).toBe(true);
    for (const { file } of first.files) expect(readFileSync(join(first.dir, file), "utf8")).toBe(readFileSync(join(SKILLS, file), "utf8"));

    const skillFile = join(first.dir, "flair-use/SKILL.md");
    writeFileSync(skillFile, "old");
    writeFileSync(join(first.dir, "flair-use/mine.md"), "mine");
    const again = installSkills({ cwd: project });
    expect(again.files.filter((f) => f.status !== "unchanged")).toEqual([{ file: "flair-use/SKILL.md", status: "updated" }]);
    expect(readFileSync(skillFile, "utf8")).toBe(readFileSync(join(SKILLS, "flair-use/SKILL.md"), "utf8"));
    expect(readFileSync(join(first.dir, "flair-use/mine.md"), "utf8")).toBe("mine");
  });

  it("installs only the skills asked for, into the folder asked for", () => {
    const result = installSkills({ cwd: project, dir: "agents/skills", skills: ["flair-author", "flair-author"] });
    expect(result.skills).toEqual(["flair-author"]);
    expect(existsSync(join(project, "agents/skills/flair-author/SKILL.md"))).toBe(true);
    expect(existsSync(join(project, "agents/skills/flair-use"))).toBe(false);
  });

  it("refuses an unknown skill, naming the ones there are, and writes nothing", () => {
    expect(() => installSkills({ cwd: project, skills: ["flair-use", "flair-shaders"] })).toThrow(
      'There is no skill "flair-shaders"; Flair ships flair-use and flair-author.',
    );
    expect(readdirSync(project)).toEqual([]);
  });

  it("refuses a folder that is not a path, or is a file", () => {
    expect(() => installSkills({ cwd: project, dir: " " })).toThrow(/must be a path, like \.claude\/skills/);
    writeFileSync(join(project, "skills"), "");
    expect(() => installSkills({ cwd: project, dir: "skills" })).toThrow(/is a file, not a folder/);
    mkdirSync(join(project, "other"));
    writeFileSync(join(project, "other/flair-use"), "");
    expect(() => installSkills({ cwd: project, dir: "other" })).toThrow(/other\/flair-use is a file/);
  });

  it("finds the skills folder in the package", () => {
    expect(skillsSource()).toBe(SKILLS);
  });
});

describe("flair skills (the CLI)", () => {
  let project: string;
  let cwd: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "flair-cli-"));
    cwd = process.cwd();
  });
  afterEach(() => {
    process.chdir(cwd);
    rmSync(project, { recursive: true, force: true });
  });

  /** Runs `flair …args` in the project, and what it printed, and whether it exited 1. */
  async function flair(...args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")));
    vi.spyOn(console, "error").mockImplementation((...a) => void err.push(a.join(" ")));
    let exited: number | undefined;
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => void (exited ??= code ?? 0)) as never);
    const argv = process.argv;
    process.argv = ["node", "flair", ...args];
    const at = process.cwd();
    process.chdir(project);
    vi.resetModules();
    try {
      await import("./cli.js");
      await vi.waitFor(() => expect(out.length + err.length).toBeGreaterThan(0));
    } finally {
      process.argv = argv;
      process.chdir(at);
    }
    return { out: out.join("\n"), err: err.join("\n"), exited };
  }

  it("installs the skills into .claude/skills, or --dir", async () => {
    const done = await flair("skills", "install");
    expect(done.exited).toBeUndefined();
    expect(done.out).toMatch(/^Installed flair-use and flair-author into .*\.claude\/skills: \d+ added, 0 updated, 0 unchanged\.$/);
    expect(existsSync(join(project, ".claude/skills/flair-use/SKILL.md"))).toBe(true);

    const other = await flair("skills", "install", "--dir", "tools/skills", "--skill", "flair-author");
    expect(other.out).toMatch(/Installed flair-author into .*tools\/skills/);
    expect(existsSync(join(project, "tools/skills/flair-use"))).toBe(false);
  });

  it("refuses an unknown skill with the ones there are", async () => {
    const refused = await flair("skills", "install", "--skill", "flair-shaders");
    expect(refused.exited).toBe(1);
    expect(refused.err).toBe('Error installing skills: There is no skill "flair-shaders"; Flair ships flair-use and flair-author.');
    expect(existsSync(join(project, ".claude"))).toBe(false);
  });

  it("lists the skills", async () => {
    const listed = await flair("skills", "list");
    for (const s of FLAIR_SKILLS) expect(listed.out).toContain(`${s.name}: ${s.description}`);
  });

  it("lists a vector effect's controls, and refuses one that cannot draw", async () => {
    writeFileSync(join(project, "ok.svg"), `<svg viewBox="0 0 10 10"><!-- {{ink: color default=#ff0000}} --><rect id="r" fill="{{ink}}" width="{{w: float min=1 max=10 default=4}}" height="2"/></svg>`);
    const ok = await flair("controls", "ok.svg");
    expect(ok.exited).toBeUndefined();
    expect(ok.out).toContain("Controls in ok.svg (2):");
    expect(ok.out).toContain('ink (color): "Ink" | default=[1, 0, 0]');

    writeFileSync(join(project, "bad.json"), JSON.stringify({ svg: `<svg><text id="t">{{title}}</text></svg>`, animate: [{ id: "nope", ms: 100 }] }));
    const bad = await flair("controls", "bad.json");
    expect(bad.exited).toBe(1);
    expect(bad.err).toContain("{{title}} is never declared");
    expect(bad.err).toContain("the <svg> needs a `viewBox`");
    expect(bad.err).toContain('animate[0]: there is no element with id "nope" in the SVG');
  });
});

// ---------------------------------------------------------------------------
// The skills name only what exists.
// ---------------------------------------------------------------------------

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { files: string[]; exports: Record<string, unknown> };
const CLI = readFileSync("src/cli.ts", "utf8");
const COMMANDS = readFileSync("src/editor/commands.ts", "utf8");
const EDITOR_AGENT = readFileSync("src/editor/agent.ts", "utf8");

/** The source module of each entry point, by subpath ("" for the root). */
const ENTRIES: Record<string, string> = {
  "": "index.ts",
  "/catalog": "catalog/index.ts",
  "/catalog/lazy": "catalog/lazy.ts",
  "/editor": "editor/index.ts",
  "/vector": "vector/index.ts",
  "/motion": "motion/index.ts",
  "/embed": "embed/index.ts",
  "/react": "react/index.tsx",
  "/svelte": "svelte/index.ts",
  "/integrations": "integrations/index.ts",
  "/testing": "testing/index.ts",
  "/node": "node.ts",
};

/** The skills' Markdown, except the generated effect index (lazy.test.ts checks that). */
const DOCS = walk(SKILLS)
  .filter((f) => f.endsWith(".md") && !f.includes("/references/effects/"))
  .map((file) => ({ file, text: readFileSync(join(SKILLS, file), "utf8") }));

/** A document's code blocks, and its prose with them taken out. */
function split(text: string): { code: string; prose: string } {
  const code: string[] = [];
  const prose = text.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body: string) => {
    code.push(body);
    return "";
  });
  return { code: code.join("\n"), prose };
}

/** Every inline `code` span in prose. */
const spans = (prose: string) => [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);

/** The CLI's commands: top-level ones, and the subcommands of each group, each with the flags it takes. */
function cliCommands(): Map<string, Set<string>> {
  const commands = new Map<string, Set<string>>();
  const groups = new Map([...CLI.matchAll(/const (\w+) = program\s*\.command\('([a-z]+)'/g)].map((m) => [m[1]!, m[2]!]));
  const starts = [...CLI.matchAll(/(\w+)\s*\.command\('([a-z]+)/g)].map((m) => ({ at: m.index!, owner: m[1]!, name: m[2]! }));
  starts.forEach((s, i) => {
    const body = CLI.slice(s.at, starts[i + 1]?.at ?? CLI.length);
    const flags = new Set([...body.matchAll(/--(?:no-)?([a-z][\w-]*)/g)].map((m) => m[1]!));
    const key = s.owner === "program" ? s.name : `${groups.get(s.owner)} ${s.name}`;
    commands.set(key, flags);
  });
  return commands;
}

describe("the skills", () => {
  it("are the skills FLAIR_SKILLS lists, each with a SKILL.md named for its folder", () => {
    expect(readdirSync(SKILLS).filter((f) => statSync(join(SKILLS, f)).isDirectory()).sort()).toEqual(FLAIR_SKILLS.map((s) => s.name).sort());
    for (const skill of FLAIR_SKILLS) {
      const text = readFileSync(join(SKILLS, skill.name, "SKILL.md"), "utf8");
      const front = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
      expect(front, `${skill.name}/SKILL.md starts with name and description front matter`).not.toBeNull();
      expect(front![1]).toBe(skill.name);
      expect(front![2]!.length).toBeLessThanOrEqual(1024);
      expect(text.split("\n").length, "SKILL.md stays short; detail goes in references/").toBeLessThan(120);
    }
  });

  it("ship in the npm package", () => {
    expect(pkg.files).toContain("skills");
  });

  it.each(DOCS.map((d) => [d.file, d.text]))("%s links only to files that exist", (file, text) => {
    for (const [, target] of text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/.test(target!)) continue;
      expect(existsSync(resolve(SKILLS, dirname(file), target!)), `${file} links to ${target}`).toBe(true);
    }
  });

  it.each(DOCS.map((d) => [d.file, d.text]))("%s imports only entry points and exports that exist", async (file, text) => {
    for (const [, sub] of text.matchAll(/@pixerate\/flair((?:\/[a-z]+)*)/g))
      expect(Object.keys(pkg.exports), `${file} names @pixerate/flair${sub}`).toContain(`.${sub}`);
    for (const [, names, sub] of split(text).code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@pixerate\/flair((?:\/[a-z]+)*)"/g)) {
      const entry = ENTRIES[sub!]!;
      const module = (await import(/* @vite-ignore */ `./${entry.replace(/\.tsx?$/, ".js")}`)) as Record<string, unknown>;
      const source = readFileSync(join("src", entry), "utf8");
      for (const raw of names!.split(",")) {
        const name = raw.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0]!.trim();
        if (!name) continue;
        const isType = new RegExp(`\\b${name}\\b`).test(source) && /^[A-Z]/.test(name);
        expect(name in module || isType, `${file} imports ${name} from @pixerate/flair${sub}`).toBe(true);
      }
    }
  });

  it.each(DOCS.map((d) => [d.file, d.text]))("%s calls only functions Flair exports", async (file, text) => {
    const exported = new Set<string>();
    for (const entry of Object.values(ENTRIES)) for (const name of Object.keys(await import(/* @vite-ignore */ `./${entry.replace(/\.tsx?$/, ".js")}`))) exported.add(name);
    const glsl = new Set(["mainImage", "texture", "sin", "main", "rgb", "hsl", "readFileSync"]); // GLSL, CSS and Node, not Flair
    for (const span of spans(split(text).prose))
      for (const [, name] of span.matchAll(/(?<![.\w])([A-Za-z_]\w*)\(/g))
        if (!glsl.has(name!)) expect(exported.has(name!), `${file} mentions ${name}(), which Flair does not export`).toBe(true);
  });

  it.each(DOCS.map((d) => [d.file, d.text]))("%s runs only CLI commands and flags that exist", (file, text) => {
    const commands = cliCommands();
    const { code, prose } = split(text);
    const lines = [...code.split("\n").map((l) => l.replace(/\s#\s.*$/, "")), ...spans(prose)];
    for (const line of lines) {
      for (const [, first, second, rest] of line.matchAll(/(?:^|[\s(])(?:npx )?flair ([a-z]+)(?: ([a-z]+))?([^\n]*)/g)) {
        const key = commands.has(`${first} ${second}`) ? `${first} ${second}` : first!;
        expect(commands.has(key), `${file}: flair ${first} ${second ?? ""} is not a command`).toBe(true);
        const sub = [...commands.keys()].some((k) => k.startsWith(`${first} `));
        if (sub) expect(commands.has(`${first} ${second}`), `${file}: flair ${first} has no subcommand "${second}"`).toBe(true);
        for (const [, flag] of (rest ?? "").matchAll(/(?:^|\s)--([a-z][\w-]*)/g))
          expect(commands.get(key)!.has(flag!), `${file}: flair ${key} has no --${flag}`).toBe(true);
      }
    }
  });

  it.each(DOCS.map((d) => [d.file, d.text]))("%s names only effects, presets, templates, primitives, commands and tools that exist", (file, text) => {
    const tools = new Set(FLAIR_AGENT_TOOLS.map((t) => t.name));
    const primitives = new Set(PRIMITIVES.map((p) => p.id));
    for (const span of spans(split(text).prose)) {
      if (/^(effect|catalog|values|preset|keyframe|timeline|history)\.[a-zA-Z]+$/.test(span) && !/\.(frag|svg|json)$/.test(span))
        expect(COMMANDS.includes(`id: "${span}"`), `${file}: there is no editor command ${span}`).toBe(true);
      if (/^[a-z]+(_[a-z]+)+$/.test(span))
        expect(tools.has(span) || EDITOR_AGENT.includes(span), `${file}: there is no agent tool ${span}`).toBe(true);
    }
    for (const [, id] of text.matchAll(/["`]((?:entrance|exit|emphasis|path)\.[a-z-]+)["`]/g))
      expect(primitives.has(id!), `${file}: there is no motion primitive ${id}`).toBe(true);
    for (const [, id] of text.matchAll(/(?:sceneTemplate\("|flair template (?:show|fill) )([a-z-]+)/g))
      expect(SCENE_TEMPLATES.map((t) => t.id), `${file}: there is no template ${id}`).toContain(id);

    const effectAt =
      /(?:\beffect=|<VectorEffect id=|\beffect: |"effect": |"move": |"during": |"in": |(?:getEffect|loadEffect|getEffectMeta|recordEffect|exportEffect|effectControlSchema)\(|mountEffect\(\w+, )"([a-z0-9-]+)"|flair render ([a-z0-9][a-z0-9-]*)/g;
    const ids = new Set(EFFECTS.map((e) => e.id));
    for (const line of text.split("\n")) {
      const found = [...line.matchAll(effectAt)].map((m) => ({ index: m.index!, id: (m[1] ?? m[2])! }));
      for (const m of found) expect(ids.has(m.id), `${file}: there is no effect "${m.id}" (${line.trim()})`).toBe(true);
      for (const p of line.matchAll(/(?:\bpreset=|\bpreset: |"preset": |--preset )"?([^"]+?)"?(?=[,}\s]|$)/g)) {
        const owner = found.filter((m) => m.index < p.index!).at(-1);
        if (!owner) continue;
        const presets = getEffect(owner.id)?.presets?.map((x) => x.name) ?? [];
        expect(presets, `${file}: ${owner.id} has no preset "${p[1]}"`).toContain(p[1]);
      }
    }
  });
});
