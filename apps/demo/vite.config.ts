import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const flairPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
const src = (path: string) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

export default defineConfig({
  // GitHub Pages serves the demo from /<repo>/, so the deploy workflow sets DEMO_BASE=/flair/.
  base: process.env.DEMO_BASE ?? "/",
  define: {
    __FLAIR_VERSION__: JSON.stringify(flairPackage.version),
  },
  resolve: {
    // The demo runs on the library's sources, so it always shows the code in this checkout.
    alias: [
      { find: /^@pixerate\/flair\/catalog$/, replacement: src("catalog/index.ts") },
      { find: /^@pixerate\/flair\/catalog\/lazy$/, replacement: src("catalog/lazy.ts") },
      { find: /^@pixerate\/flair\/integrations$/, replacement: src("integrations/index.ts") },
      { find: /^@pixerate\/flair\/editor$/, replacement: src("editor/index.ts") },
      { find: /^@pixerate\/flair\/vector$/, replacement: src("vector/index.ts") },
      { find: /^@pixerate\/flair\/embed$/, replacement: src("embed/index.ts") },
      { find: /^@pixerate\/flair$/, replacement: src("index.ts") },
    ],
  },
  plugins: [react()],
  server: {
    port: 3100,
  },
});
