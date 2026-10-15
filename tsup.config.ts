import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "catalog/index": "src/catalog/index.ts",
    "editor/index": "src/editor/index.ts",
    "vector/index": "src/vector/index.ts",
    "react/index": "src/react/index.tsx",
    node: "src/node.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Shared modules go in chunks, so classes are one copy across entries (instanceof keeps working).
  splitting: true,
  external: ["@pixerate/editor", "react", "react-dom"],
});
