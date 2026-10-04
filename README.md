# Flair 🎨

**Flair** is a modern generative animation and WebGL shader engine designed for humans and AI agents. It eliminates reliance on desktop timeline applications (such as Apple Motion / After Effects) by providing programmable WebGL2 fragment shaders, declarative controls, live previews, frame-exact rendering, camera directing, procedural effects, and agent-ready tooling.

---

## Key Features

### 🎬 Scene & Animation Directing (inspired by Lingo)
- **Multi-Shot Directorial Structure**: Direct scenes as sequential beats (`Shot`) with camera moves, narration, headings/titles, and holds.
- **Deterministic Time Source (`ManualClock`)**: Decouple rendering from wall-clock time. Advance frames manually with exact timestamps for video pipelines, SSR, or instant test simulation.
- **Dynamic Camera Easing**: Smooth cubic easing (`easeInOutCubic`, `between`, `frame`) for panning, zooming, and framing objects across beats.
- **Procedural Visual Effects**: Built-in procedural effects (`gradient`, `glow`, `flow`, `ripple`, `burst`, `shimmer`, `spotlight`, `timer`, `counter`, `highlight`, `blur`, `media`).
- **First-Class Shader Media**: Embed bespoke WebGL fragment shaders directly into scene shots as dynamic background or foreground layers.
- **Static Scene Validation & Fast Simulation**: Catch framing clipping, overlapping elements, tiny unreadable text, and timing issues off-screen before rendering.
- **LLM Agent Authoring Tools**: Pre-built Anthropic/Gemini compatible tool schemas (`get_scene`, `write_scene`, `update_shot`, `insert_shots`, `delete_shots`, `set_media`, `preview_scene`) and a pure state machine (`applySceneTool`).

### ⚡️ Bespoke WebGL2 Shader Engine (inspired by Gobo)
- **Shadertoy-Compatible WebGL2 Shaders**: Write fragment shaders with `mainImage(out vec4 fragColor, in vec2 fragCoord)` using standard inputs (`iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`).
- **Controls Declared in Source**: Annotate uniforms with `// @control` to define UI controls (sliders, switches, color pickers, vectors) directly in GLSL. The source remains the single source of truth.
- **Line-Numbered Error Reporting**: Exact compiler diagnostics matching source line numbers, making autonomous agent iteration seamless.
- **Frame-Exact Rendering (`ShaderFrames`)**: Render offscreen at exact timestamps without relying on wall-clock time, perfectly suited for video recording pipelines and deterministic previews.
- **Live Canvas Previews (`ShaderRenderer`)**: Interactive preview canvas with play/pause, seek, speed controls, mouse interaction, and automatic fallback on compilation errors.
- **Pooled Thumbnails (`ThumbnailPool`)**: Share a single WebGL2 context across dozens of animated cards/thumbnails.
- **Looping GIFs & Standalone HTML**: Export self-contained HTML pages or encode looping animated GIFs via `gifenc`.

---

## Installation

Ensure Node.js v20+ is installed.

```bash
# Clone and install dependencies
cd Flair
npm install
npm run build
```

---

## CLI Usage

`flair` includes a CLI for inspecting shaders, generating standalone web pages, and directing scenes.

### Shader Commands

```bash
# Inspect @control uniforms in a shader
npx flair controls ./my-shader.frag

# Output controls as JSON
npx flair controls ./my-shader.frag --json

# Generate a self-contained HTML page for the shader
npx flair html ./my-shader.frag --out ./preview.html --open
```

### Scene Directing Commands

```bash
# Validate a multi-shot scene JSON file
npx flair scene validate ./my-scene.json

# Fast simulate off-screen & print timing breakdown + diagnostic review
npx flair scene review ./my-scene.json

# Generate an interactive standalone web player for the scene
npx flair scene html ./my-scene.json --out ./player.html --open
```

---

## Programmatic TypeScript API

### 1. Scene Directing & Fast Simulation

```typescript
import { simulateScene, type Scene } from 'flair';

const scene: Scene = {
  name: 'data-pipeline',
  title: 'Real-time Streaming Architecture',
  shots: [
    {
      title: 'Ingestion Layer',
      caption: 'Events stream directly into our high-throughput buffer.',
      camera: { x: 0, y: 0, width: 1920, height: 1080 },
      hold: 800,
      run: [
        {
          type: 'element',
          element: { id: 'kafka', type: 'rectangle', x: 200, y: 300, width: 400, height: 250, text: 'Kafka' },
        },
      ],
      effects: [
        { type: 'glow', id: 'g1', ids: ['kafka'] },
      ],
    },
    {
      title: 'Processing Cluster',
      caption: 'Workers compute aggregates in windowed batches.',
      camera: { x: 500, y: 200, width: 1200, height: 700 },
      hold: 1000,
      effects: [
        { type: 'burst', id: 'b1', ids: ['kafka'] },
      ],
      stopEffects: ['g1'],
    },
  ],
};

// Fast-forward simulation without waiting for wall-clock time
const { result, review } = await simulateScene(scene);
console.log(review.markdown);
```

### 2. Autonomous Agent Tools State Machine

```typescript
import { applySceneTool, FLAIR_AGENT_TOOLS } from 'flair';

// Expose FLAIR_AGENT_TOOLS to Claude, GPT-4, or Gemini
// Surgically patch scene state:
const outcome = await applySceneTool(scene, 'update_shot', {
  shot: 1,
  set: { caption: 'Updated high-throughput stream caption.' },
});

if (outcome.ok) {
  console.log('Updated scene:', outcome.scene);
}
```

### 3. Live WebGL Shader Preview

```typescript
import { ShaderRenderer } from 'flair';

const renderer = new ShaderRenderer(containerElement, 'preview');
const status = renderer.setSource(glslSource);

if (!status.ok) {
  console.error('Compiler errors:', status.errors);
}

// Playback control
renderer.pause();
renderer.seek(2.5);
renderer.setValues({ speed: 1.5 });
```

### 4. Frame-Exact Headless Rendering

```typescript
import { ShaderFrames } from 'flair';

const frames = new ShaderFrames({
  source: glslSource,
  values: { speed: 2.0 },
  width: 1920,
  height: 1080,
});

for (let i = 0; i < 60; i++) {
  frames.render(i / 30); // Frame at exact timestamp
  const pixels = frames.readPixels(); // Uint8Array RGBA
}

frames.dispose();
```

## Architecture & Separation of Concerns

There is an intentional, decoupled boundary between **Flair** and **`@pixerate/ai-core`**:

| Responsibility | Flair 🎨 | @pixerate/ai-core 🧠 |
| :--- | :--- | :--- |
| **Domain** | Motion graphics, WebGL2 shaders, scene directing & simulation | AI orchestration, model reasoning & agent workflows |
| **Runtime Dependencies** | Pure TypeScript, zero LLM SDKs, zero vendor locks | AI SDKs (Google Vertex, Anthropic, OpenAI), provider clients |
| **Scene & Shader Specs** | Defines `Scene`, `Shot`, `Effect`, `@control`, `ManualClock` | Generates GLSL shaders & scene manifests from user prompts |
| **Validation & Simulation** | Provides `validateScene`, `simulateScene`, camera layout checks | Analyzes validation issues and generates iterative corrections |
| **Agent Tool Surfaces** | Exports declarative tool schemas (`FLAIR_AGENT_TOOLS`) and `applySceneTool` state machine | Executes the LLM agent loop that invokes those tools |

---

## Verification & Tests

```bash
npm run typecheck
npm test
npm run build
```

