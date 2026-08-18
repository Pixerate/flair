# Flair 🎨

**Flair** is a high-performance TypeScript engine and CLI for programmatically generating Apple Motion graphics files (`.motn`) and automating Motion.app on macOS. It integrates with `@pixerate/ai-core` to translate natural language requirement prompts into full-fidelity Motion projects powered by Google Vertex AI.

---

## Key Features

- **Apple Motion XML Compiler**: Compiles structured motion composition specs (`MotionSpec`) into pristine, native `.motn` XML projects.
- **AI Spec Generation**: Uses `@pixerate/ai-core` and Google Vertex AI (`gemini-3.6-flash`) to convert natural language prompts (e.g. *"Create a flashy title sequence for Slop Machine, neubrutalist aesthetic"*) into validated `MotionSpec` objects.
- **Strict Credential Validation**: Errors out explicitly if Google Vertex AI / GCP credentials are missing or invalid (no silent fallbacks).
- **macOS AppleScript Automation**: Automatically launches `/Applications/Motion.app`, opens generated project files, and triggers timeline playback live on screen.
- **CLI & Library**: Use as a global command-line tool or import directly into Node/TypeScript applications.

---

## Installation

Ensure Node.js v20+ is installed.

```bash
# Clone and install dependencies
cd Flair
npm install
npm run build
```

### Environment Setup

Set your Google Cloud Platform (GCP) credentials for Vertex AI:

```bash
export GCP_PROJECT="your-gcp-project-id"
export GCP_LOCATION="us-central1"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
```

---

## CLI Usage

`flair` includes a CLI for generating and opening Motion project files.

### 1. Generate from Prompt & Auto-Open in Motion.app

```bash
npx flair generate \
  --prompt "Create a flashy title sequence for Slop Machine with a neubrutalist aesthetic" \
  --out ./SlopMachine.motn \
  --open
```

### 2. Generate from Pre-built Spec JSON File

```bash
npx flair generate \
  --spec ./my-spec.json \
  --out ./CustomTitle.motn
```

### 3. Open Existing Motion File in Motion.app & Play

```bash
npx flair open ./SlopMachine.motn
```

---

## Programmatic TypeScript API

### 1. Compile MotionSpec to `.motn` XML

```typescript
import { MotionCompiler, MotionSpec } from 'flair';

const compiler = new MotionCompiler();

const spec: MotionSpec = {
  title: 'SLOP MACHINE',
  subtitle: '★ MAXIMUM SLOP ★',
  badges: ['SYSTEM ERROR // 100% RAW', 'VER 2.0 // NO CAP'],
  style: 'neubrutalist',
  palette: {
    backgroundColor: '#FFE600',
    primaryColor: '#000000',
    secondaryColor: '#FF0055',
    accentColor: '#00FF66',
    borderColor: '#000000',
  },
  canvas: {
    width: 1920,
    height: 1080,
    durationSeconds: 10,
    fps: 30,
  },
  typography: {
    titleFont: 'Impact',
    subtitleFont: 'Arial-Black',
    badgeFont: 'Helvetica-Bold',
  },
  animation: {
    entrance: 'pop-overshoot',
    wiggleIntensity: 0.5,
  },
};

const xmlString = compiler.compile(spec);
```

### 2. AI Prompt to Spec via `@pixerate/ai-core`

```typescript
import { MotionAiGenerator } from 'flair';
import { createVertexClient } from '@ai-sdk/google-vertex';

const vertexClient = createVertexClient({
  project: process.env.GCP_PROJECT,
  location: process.env.GCP_LOCATION || 'us-central1',
});

const aiGenerator = new MotionAiGenerator({ vertexClient });

// Generates validated MotionSpec from prompt string using Vertex AI
const spec = await aiGenerator.generateSpecFromPrompt(
  'Flashy title sequence for Slop Machine, neubrutalist aesthetic'
);
```

### 3. macOS Desktop Automation

```typescript
import { MotionAppAutomation } from 'flair';

const automation = new MotionAppAutomation();

// Opens .motn file in Motion.app and triggers playback
await automation.openProject('/path/to/SlopMachine.motn');
await automation.playTimeline();
```

---

## Architecture

```
src/
├── types/
│   └── spec.ts          # Zod schema definitions for MotionSpec, Canvas, Palette & Typography
├── compiler/
│   └── motion-xml.ts    # MotionCompiler engine transforming specs into .motn XML
├── services/
│   └── ai-generator.ts  # MotionAiGenerator integrating @pixerate/ai-core & Vertex AI
├── automation/
│   └── motion-app.ts    # MotionAppAutomation handling macOS osascript & Motion.app controls
├── cli.ts               # Commander CLI interface
└── index.ts             # Main entry point exports
```

---

## License

MIT
