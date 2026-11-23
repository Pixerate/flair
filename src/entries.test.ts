import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What each entry loads up front: the source modules reached through static
 * imports (`import … from`, `export … from`; not `import type` and not
 * `import()`, which load on demand). The lazy entries must never reach the
 * full catalog (`src/catalog/index.ts`), or a loader on a hot path would
 * carry every effect.
 */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    const specifiers = [...text.matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;]*?\s+from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]!);
    for (const spec of specifiers) {
      if (!spec.startsWith(".")) continue;
      const base = resolve(dirname(file), spec.replace(/\.js$/, ""));
      const found = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync) ?? (existsSync(base) ? base : undefined);
      if (found && /\.tsx?$/.test(found)) visit(found);
    }
  };
  visit(resolve(entry));
  return seen;
}

const rel = (files: Set<string>) => [...files].map((f) => relative(process.cwd(), f)).sort();

describe("the lazy entries", () => {
  it.each(["src/embed/lazy.ts", "src/react/lazy.tsx", "src/svelte/lazy.ts"])("%s never loads the full catalog or the lazy catalog's metadata up front", (entry) => {
    const files = rel(staticGraph(entry));
    expect(files).not.toContain("src/catalog/index.ts");
    expect(files).not.toContain("src/catalog/lazy.ts");
    expect(files.filter((f) => f.endsWith(".json"))).toEqual([]);
    // Catalog modules (the effects themselves) load only through loadEffect.
    expect(files.filter((f) => /^src\/catalog\/shaders\//.test(f))).toEqual([]);
  });

  it("the full entries still load the full catalog", () => {
    for (const entry of ["src/embed/index.ts", "src/react/index.tsx", "src/svelte/index.ts"]) expect(rel(staticGraph(entry)), entry).toContain("src/catalog/index.ts");
  });

  it("are published", () => {
    const exports = (JSON.parse(readFileSync("package.json", "utf8")) as { exports: Record<string, unknown> }).exports;
    for (const name of ["embed", "react", "svelte"]) expect(exports[`./${name}/lazy`], name).toEqual({ types: `./dist/${name}/lazy.d.ts`, import: `./dist/${name}/lazy.js` });
  });
});
