import tseslint from "typescript-eslint";

function restrict(...groups) {
  const paths = [];
  const patterns = [];
  for (const group of groups) {
    if (group.paths) paths.push(...group.paths);
    if (group.patterns) patterns.push(...group.patterns);
  }
  return {
    "no-restricted-imports": ["error", { paths, patterns }],
  };
}

const VENDOR_RESTRICTION = {
  paths: [
    { name: "ai", message: "Flair must not depend on LLM SDKs." },
    { name: "openai", message: "Flair must not depend on LLM SDKs." },
    { name: "zod", message: "Flair must not depend on zod." },
  ],
  patterns: [
    {
      group: [
        "@pixerate/ai-core*",
        "@pixerate/agent-core*",
        "@pixerate/schemas*",
        "@ai-sdk/*",
        "@anthropic-ai/*",
        "@google/*",
      ],
      message: "Flair must remain vendor- and orchestrator-dependency free.",
    },
  ],
};

const NODE_RESTRICTION = {
  paths: [
    { name: "fs", message: "Browser-safe source files must not import Node built-ins." },
    { name: "path", message: "Browser-safe source files must not import Node built-ins." },
    { name: "child_process", message: "Browser-safe source files must not import Node built-ins." },
    { name: "os", message: "Browser-safe source files must not import Node built-ins." },
    { name: "crypto", message: "Browser-safe source files must not import Node built-ins." },
  ],
  patterns: [
    {
      group: ["node:*"],
      message: "Browser-safe source files must not import Node built-ins.",
    },
  ],
};

const NO_EDITOR = {
  paths: [{ name: "@pixerate/editor", message: "Only src/editor/** and src/integrations/** may import @pixerate/editor." }],
  patterns: [
    {
      group: ["@pixerate/editor/*"],
      message: "Only src/editor/** and src/integrations/** may import @pixerate/editor.",
    },
  ],
};

const EDITOR_SUBPATHS_ONLY = {
  paths: [{ name: "@pixerate/editor", message: "src/editor/** must import only allowed @pixerate/editor subpaths." }],
  patterns: [
    {
      group: [
        "@pixerate/editor/*",
        "!@pixerate/editor/history",
        "!@pixerate/editor/commands",
        "!@pixerate/editor/tools",
        "!@pixerate/editor/animation",
        "!@pixerate/editor/animation-editor",
        "!@pixerate/editor/parameters",
      ],
      message:
        "src/editor/** may only import @pixerate/editor/{history,commands,tools,animation,animation-editor,parameters}.",
    },
  ],
};

const INTEGRATIONS_EFFECTS_ONLY = {
  paths: [{ name: "@pixerate/editor", message: "src/integrations/** may only import @pixerate/editor/effects." }],
  patterns: [
    {
      group: ["@pixerate/editor/*", "!@pixerate/editor/effects"],
      message: "src/integrations/** may only import @pixerate/editor/effects.",
    },
  ],
};

const NO_REACT = {
  paths: [
    { name: "react", message: "Only src/react/** may import React." },
    { name: "react-dom", message: "Only src/react/** may import react-dom." },
  ],
  patterns: [
    {
      group: ["react/*"],
      message: "Only src/react/** may import React.",
    },
  ],
};

const NO_SVELTE = {
  paths: [{ name: "svelte", message: "Only src/svelte/** may import Svelte." }],
  patterns: [
    {
      group: ["svelte/*"],
      message: "Only src/svelte/** may import Svelte.",
    },
  ],
};

const SVELTE_TYPE_ONLY = {
  paths: [
    {
      name: "svelte",
      allowTypeImports: true,
      message: "src/svelte/** may only import types from svelte so tsup builds without the Svelte compiler.",
    },
  ],
  patterns: [
    {
      group: ["svelte/*"],
      allowTypeImports: true,
      message: "src/svelte/** may only import types from svelte/* so tsup builds without the Svelte compiler.",
    },
  ],
};

const NO_FULL_CATALOG = {
  paths: [
    {
      name: "../catalog",
      message: "Shared lazy entry core must never import the full catalog.",
    },
  ],
  patterns: [
    {
      group: ["../catalog/index*"],
      message: "Shared lazy entry core must never import the full catalog.",
    },
  ],
};

const NODE_ONLY_FILES = [
  "src/node/**",
  "src/node.ts",
  "src/cli.ts",
  "src/skills.ts",
  "src/export/effect.ts",
  "src/export/metal.ts",
  "src/export/metal-document.ts",
  "src/export/timing.ts",
  "src/export/recorder.ts",
];

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.svelte"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": {
        rules: {
          "exhaustive-deps": { meta: {}, create: () => ({}) },
        },
      },
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: restrict(VENDOR_RESTRICTION),
  },
  {
    files: NODE_ONLY_FILES,
    ignores: ["**/*.test.{ts,tsx}"],
    rules: restrict(VENDOR_RESTRICTION, NO_EDITOR, NO_REACT, NO_SVELTE),
  },
  {
    files: ["src/editor/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, EDITOR_SUBPATHS_ONLY, NO_REACT, NO_SVELTE),
  },
  {
    files: ["src/integrations/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/integrations/authoring.ts"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, INTEGRATIONS_EFFECTS_ONLY, NO_REACT, NO_SVELTE),
  },
  {
    files: ["src/integrations/authoring.ts"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_REACT, NO_SVELTE),
  },
  {
    files: ["src/react/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/react/core.tsx"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_SVELTE),
  },
  {
    files: ["src/react/core.tsx"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_SVELTE, NO_FULL_CATALOG),
  },
  {
    files: ["src/svelte/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/svelte/core.ts"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_REACT, SVELTE_TYPE_ONLY),
  },
  {
    files: ["src/svelte/core.ts"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_REACT, SVELTE_TYPE_ONLY, NO_FULL_CATALOG),
  },
  {
    files: ["src/embed/mount.ts"],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_REACT, NO_SVELTE, NO_FULL_CATALOG),
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      ...NODE_ONLY_FILES,
      "src/editor/**",
      "src/integrations/**",
      "src/react/**",
      "src/svelte/**",
      "src/embed/mount.ts",
    ],
    rules: restrict(VENDOR_RESTRICTION, NODE_RESTRICTION, NO_EDITOR, NO_REACT, NO_SVELTE),
  },
];
