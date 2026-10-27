---
title: Architecture & Design
description: Architectural concepts, entry points, and boundaries.
---

# Architecture & Design

Flair is designed as a modular, browser-safe graphics toolkit split into discrete entry points.

## Monorepo Entry Points

| Entry Point | Role & Dependencies |
| :--- | :--- |
| `@pixerate/flair` | Core shader runtime, math, time clock, and transitions. Zero dependencies. |
| `@pixerate/flair/catalog` | Synchronous effect registry with all 450+ definitions. |
| `@pixerate/flair/catalog/lazy` | Asynchronous metadata-first registry (`EFFECT_META`) that fetches source on demand. |
| `@pixerate/flair/vector` | Deterministic SVG frame generation and timeline scrubbing. |
| `@pixerate/flair/motion` | 23 declarative motion primitives (entrances, exits, emphasis). |
| `@pixerate/flair/embed` | High-level DOM mounting helpers (`mountEffect`). |
| `@pixerate/flair/editor` | UI-agnostic effect editor and MCP agent tools. |
| `@pixerate/flair/react` | Thin React component wrappers (`<FlairEffect>`). |
| `@pixerate/flair/svelte` | Svelte actions (`use:flairEffect`). |

## Separation of Concerns

Flair is strictly focused on **graphics, rendering, and scene directing**. It contains no LLM vendor logic or model keys, but exports tool definitions (`FLAIR_AGENT_TOOLS`) so orchestration frameworks (like `@pixerate/ai-core`) can direct Flair autonomously.
