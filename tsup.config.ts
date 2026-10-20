import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

const shared = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
  // Shared modules go in chunks, so classes are one copy across entries (instanceof keeps working).
  splitting: true,
  external: ["@pixerate/editor", "react", "react-dom", "svelte"],
  define: { __FLAIR_VERSION__: JSON.stringify(version) },
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      "catalog/index": "src/catalog/index.ts",
      "editor/index": "src/editor/index.ts",
      "vector/index": "src/vector/index.ts",
      "motion/index": "src/motion/index.ts",
      "embed/index": "src/embed/index.ts",
      "react/index": "src/react/index.tsx",
      "svelte/index": "src/svelte/index.ts",
      "testing/index": "src/testing/index.ts",
      node: "src/node.ts",
      cli: "src/cli.ts",
    },
    // The document's JSON Schema, also as a file, for tools outside JavaScript.
    async onSuccess() {
      const built = pathToFileURL(resolve("dist/editor/index.js")).href;
      const { EFFECT_DOCUMENT_SCHEMA } = await import(built);
      await mkdir("dist/schemas", { recursive: true });
      await writeFile("dist/schemas/effect-document.json", `${JSON.stringify(EFFECT_DOCUMENT_SCHEMA, null, 2)}\n`);
    },
  },
  // The lazy catalog (and the integrations, which use it) are built on their own, with a chunk per
  // catalog module: built with the rest, its on-demand modules would split the full catalog into dozens
  // of chunks too, making it larger to load. Their effects are separate copies of the full catalog's
  // (equal, not the same objects).
  {
    ...shared,
    entry: { "catalog/lazy": "src/catalog/lazy.ts", "integrations/index": "src/integrations/index.ts" },
  },
]);
