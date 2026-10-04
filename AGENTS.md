# AGENTS.md - Developer & Agent Execution Guidelines

This file contains instructions for AI agents and developer tools working in the **Flair** repository.

---

## 1. Quality & Verification Workflow

Before declaring any change complete:

1. **Type Checking**:
   ```bash
   npm run typecheck
   ```
2. **Build Verification**:
   ```bash
   npm run build
   ```
3. **Unit Tests**:
   ```bash
   npm test
   ```
4. **End-to-End CLI Verification**:
   Test inspecting controls or generating standalone HTML using the CLI:
   ```bash
   node ./dist/cli.js controls ./tests/fixtures/sample.frag
   node ./dist/cli.js scene review ./tests/fixtures/sample.scene.json
   ```

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
3. **Commit Changes**:
   Create a clear, conventional commit message detailing what was changed:
   ```bash
   git commit -m "feat: <description of feature or fix>"
   ```
4. **Push to Remote Repository**:
   ```bash
   git push origin main
   ```

---

## 3. Code Standards & Architecture

- **Pure TypeScript & Lightweight**: Maintain zero heavy runtime dependencies. Keep core shader, animation, and geometric logic testable without a real GPU (using mock WebGL context).
- **Line-Numbered Error Reporting**: Shader compilation and parsing errors must maintain exact line numbers matching user/agent source code (`#line 1` convention).
- **Source as Single Source of Truth**: Uniforms annotated with `// @control` define the parameter surface and defaults.
- **Documentation**: Keep `README.md` and JSDoc annotations up to date whenever modifying shader compilers, renderers, or CLI options.

---

## 4. Separation of Concerns with `@pixerate/ai-core`

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
