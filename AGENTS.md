# AGENTS.md - Developer & Agent Execution Guidelines

This file contains instructions for AI agents and developer tools working in the **Flair** repository.

---

## 1. Quality & Verification Workflow

Before declaring any change complete:

1. **Type Checking**:
   ```bash
   pnpm typecheck
   ```
2. **Build Verification**:
   ```bash
   pnpm build
   ```
3. **Unit Tests**:
   ```bash
   pnpm test
   ```
4. **End-to-End CLI Verification**:
   Test inspecting controls or generating standalone HTML using the CLI:
   ```bash
   node ./dist/cli.js controls ./tests/fixtures/sample.frag
   node ./dist/cli.js scene review ./tests/fixtures/sample.scene.json
   ```

5. **Catalog shaders compile on a real GPU**: when adding or changing catalog shaders, run `pnpm dev` and open `http://localhost:3100/#check`; every shader must compile.
6. **Catalog shaders stay cheap**: for new or heavier shaders, open `http://localhost:3100/#bench?only=<ids>` in a front tab with nothing else drawing, and keep a shader's frame within a few ms at 1080p; when tuning, compare frames before and after so the look stays the same.

---

## 2. Git Commit & Push Workflow

Upon successful completion and full test verification of any feature, fix, or update:

1. **Check Workspace Status**:
   ```bash
   git status
   ```
2. **Stage Changed & Created Files**:
   ```bash
   git add .
   ```
3. **Add a changeset** for any change consumers would notice (`pnpm changeset`), and commit the generated file. Merging to `main` versions and publishes `@pixerate/flair`.
4. **Commit Changes**:
   Create a clear, conventional commit message detailing what was changed:
   ```bash
   git commit -m "feat: <description of feature or fix>"
   ```
5. **Push to Remote Repository**:
   ```bash
   git push origin main
   ```

---

## 3. Agents Are First-Class Users

Agents use Flair as much as people do, through the editor commands (`src/editor/commands.ts`, served by `createEffectToolProvider`) and the scene tools (`FLAIR_AGENT_TOOLS` / `applySceneTool` in `src/agent`). Treat that surface as a product, not an afterthought:

- **Every capability reaches agents.** A feature a person can use through the API or a UI ships with the command or tool an agent uses for it, in the same change. A refusal never points at something an agent cannot call.
- **Inputs are checked, never guessed.** Arguments are validated against the tool's schema; a missing, mistyped or out-of-range argument is refused with `ok: false` and the state is left alone. Nothing silently does nothing, and nothing quietly writes a bad value.
- **Errors say what to do next.** A refusal names what was wrong and the valid choices ("there is no shot 9; the scene has 2 shots (1 to 2)").
- **Results stay small.** Return what the call asked for: summaries and issues after edits, not the whole document; lists are limited, say how many there are and how to get more.
- **Agents can check their work.** After a change an agent can see whether it worked (validation issues, compile reports, a preview, a headless review), and is told plainly when that is not known yet.
- **Tested from the agent's side.** New tools and commands get tests that call them the way a model would, including bad arguments, and keep `EFFECT_AGENT_INSTRUCTIONS`, the tool descriptions and the README in step with what they do.

---

## 4. Code Standards & Architecture

- **Pure TypeScript & Lightweight**: Maintain zero heavy runtime dependencies. Keep core shader, animation, and geometric logic testable without a real GPU (using mock WebGL context).
- **Line-Numbered Error Reporting**: Shader compilation and parsing errors must maintain exact line numbers matching user/agent source code (`#line 1` convention).
- **Source as Single Source of Truth**: Uniforms annotated with `// @control` define the parameter surface and defaults.
- **Documentation**: Keep `README.md` and JSDoc annotations up to date whenever modifying shader compilers, renderers, or CLI options.
- **Entry points stay lean**: `@pixerate/flair`, `/testing`, `/catalog`, `/catalog/lazy`, `/vector`, `/motion` and `/embed` have no runtime dependencies and no Node built-ins (browser-safe). Node-only code goes in `/node`. Only `/editor` and `/integrations` may import `@pixerate/editor`, and only its dependency-free subpaths (`/history`, `/commands`, `/tools`, `/animation`, `/animation-editor`, `/parameters` for `/editor`; `/effects` for `/integrations`); it is an optional peer dependency (>= 0.55, the first with `/animation-editor`; `/integrations` needs >= 0.124, the first with `/effects`). `flairEffects()` implements `@pixerate/editor/effects`' `EffectProvider` contract: keep `src/integrations/effects.test.ts` (which runs the editor's `checkEffectProvider`) passing when catalog effects change. Only `/react` may import `react` (an optional peer, >= 18); it wraps `SvgPlayer` and stays thin, so framework-neutral logic (like `svgFrameMarkup`, the server-rendered still) lives in `/vector`. Only `/svelte` may import `svelte` (an optional peer, >= 5), and only its types, so it builds with tsup and no Svelte compiler; the same thin-wrapper rule applies.
- **Catalog effects**: shader sources are self-contained (inline helpers from `src/catalog/glsl.ts`), every uniform is a `// @control`, and presets only use declared controls. Vector effects fill `{{control}}` placeholders; `src/catalog/catalog.test.ts` checks all of this. After adding or changing effects, run `pnpm catalog:meta` to regenerate the lazy catalog's metadata (`src/catalog/lazy.test.ts` fails until it is current).
- **Editor commands are the agent surface**: new editing actions are added to `EffectEditor` and registered in `src/editor/commands.ts` with a params schema, so menus, shortcuts and agents share them. Refusals are sentences an agent can act on.

---

## 5. Separation of Concerns with `@pixerate/ai-core`

There is a strict architectural boundary between **Flair** and **`@pixerate/ai-core`**:

- **Flair is the Graphics, Directing & Simulation Domain**:
  - Pure rendering, WebGL fragment shader execution, frame extraction, GIF encoding.
  - Scene data schemas (`Scene`, `Shot`, `Effect`, `SceneMedia`), camera math, and deterministic time (`ManualClock`).
  - Headless simulation (`simulateScene`), layout/cut validation (`validateScene`), and report generation (`reviewScene`).
  - Declarative agent tool specifications (`FLAIR_AGENT_TOOLS`) and state machine transitions (`applySceneTool`).
  - **No LLM vendor dependencies**: Flair does NOT import `@pixerate/ai-core`, `@ai-sdk/*`, Google Vertex, Anthropic, OpenAI, or Zod. Flair must remain lightweight, fast to install, and pure.

- **`@pixerate/ai-core` is the AI Orchestrator & Intelligence Layer**:
  - Owns LLM providers, model credentials, prompt engineering, agent loops, reasoning strategies, and memory.
  - Consumes Flair as a downstream rendering and directing library: it imports `FLAIR_AGENT_TOOLS` or calls `applySceneTool` and `simulateScene` to autonomously author, validate, and preview generative motion graphics.
