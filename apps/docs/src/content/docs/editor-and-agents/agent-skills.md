---
title: Agent Skills & Claude Code Plugin
description: Skills that teach coding agents (Claude Code, Cursor and others) to find, wire up and author Flair effects, as a Claude Code plugin or copied into your project.
---

# Agent Skills & Claude Code Plugin

Flair ships two agent skills for coding agents that write code *with* Flair: your app's components, pages and custom effects. They are a different thing from Flair's [agent tools](/editor-and-agents/mcp-tools/), which serve a model running *inside* your app at runtime.

| Skill | For |
| --- | --- |
| `flair-use` | Finding an effect (an index of every catalog effect, one line each, by group), choosing an entry point (React, Svelte, embed, the lazy catalog, Node), controls, presets, camera moves, scenes, and checking the result |
| `flair-author` | Writing custom shader and vector effects, checked with `flair controls` |

The skills are plain Markdown. Every workflow in them ends with a check that fails when something is wrong, and a test in Flair's repository makes sure everything they name (exports, entry points, CLI commands and flags, effect ids, presets) exists.

## Claude Code: install the plugin

The Flair repository is a Claude Code plugin marketplace named `pixerate`, with one plugin, `flair`. In a Claude Code session:

```text
/plugin marketplace add Pixerate/flair
/plugin install flair@pixerate
```

Or from your shell:

```bash
claude plugin marketplace add Pixerate/flair
claude plugin install flair@pixerate
```

Claude uses the skills by itself when a task involves Flair; you can also call them as `/flair:flair-use` and `/flair:flair-author`.

- **For everyone on a repository**: run both commands with `--scope project` and commit the `.claude/settings.json` they write. Teammates get the plugin when they trust the folder.
- **Updates**: the plugin's version follows `@pixerate/flair`'s, so it updates with each release: run `/plugin marketplace update pixerate`, or turn on auto-update for the marketplace under **Marketplaces** in `/plugin`.
- **No GitHub SSH key?** Set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` so Claude Code clones over HTTPS.

The skills run the project's own `flair` CLI (`npx flair …`), so install the package in the project too: `npm install @pixerate/flair`.

## Other agents: copy the skills into the project

The skills also ship in the npm package. Copy them into a folder your agent reads:

```bash
npx flair skills install                       # into .claude/skills
npx flair skills install --dir .agents/skills  # any other folder
npx flair skills install --skill flair-use     # one skill only
npx flair skills list
```

Run it again after upgrading Flair: it updates the files that changed and leaves your own files alone. Copied skills match the version of Flair the project has installed. From code, `installSkills({ dir, skills })` from `@pixerate/flair/node` does the same.

To keep a copy from going stale, run the install in CI and fail when it changes or adds anything:

```bash
npx flair skills install --dir .agents/skills
test -z "$(git status --porcelain .agents/skills)" || { echo "Flair's skills are out of date: run npx flair skills install --dir .agents/skills and commit."; exit 1; }
```
