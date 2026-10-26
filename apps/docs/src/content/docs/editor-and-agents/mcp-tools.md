---
title: MCP & Agent Tools
description: Declarative tool schemas for autonomous AI coding agents.
---

# Agent Tools & MCP Integration

Flair treats AI coding agents as first-class users. Every capability usable in the UI or code is exposed via declarative agent tools:

## `FLAIR_AGENT_TOOLS`

- `inspectEffect`: Inspect an effect's controls, inputs, and validation issues.
- `applySceneTool`: Apply modifications to scenes and shots safely.
- `simulateScene`: Run fast, headless simulation to verify timing and layout issues without a GPU.

Refusal messages are human- and model-readable sentences that explain exactly what was invalid and how to correct it.
