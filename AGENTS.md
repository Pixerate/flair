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
   Test generating and rendering a project file using the CLI:
   ```bash
   node ./dist/cli.js generate --spec ./test-spec.json --out ./test-output.motn
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
   *(Note: If pushing to a tracking remote requires sandbox bypass, run with `BypassSandbox: true`)*.

---

## 3. Code Standards & Architecture

- **Strict Error Handling**: Do not write offline fallbacks or silent suppressions for Vertex AI / GCP credential errors. Throw clear, explicit errors detailing missing credentials.
- **Motion XML Integrity**: Always maintain full ozml factory compliance in `MotionCompiler` when modifying `.motn` XML outputs to prevent Motion.app load failures.
- **Documentation**: Keep `README.md` and JSDoc annotations up to date whenever modifying `MotionSpecSchema`, CLI options, or automation behaviors.
