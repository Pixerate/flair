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

- **Pure TypeScript & Lightweight**: Maintain zero heavy runtime dependencies where possible. Keep core shader, animation, and geometric logic testable without a real GPU (using mock WebGL context).
- **Line-Numbered Error Reporting**: Shader compilation and parsing errors must maintain exact line numbers matching user/agent source code (`#line 1` convention).
- **Source as Single Source of Truth**: Uniforms annotated with `// @control` define the parameter surface and defaults.
- **Documentation**: Keep `README.md` and JSDoc annotations up to date whenever modifying shader compilers, renderers, or CLI options.
