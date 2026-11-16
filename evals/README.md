# Flair effect-drafting evals

How good is a model at writing **new Flair effects**? This package asks a model to draft shader and vector effects, by type, either **from scratch** (a brief in a person's words) or **from reference** (frames of an effect, a still or a video clip), then checks, renders and grades what it wrote.

It is a private workspace package, not part of `@pixerate/flair`: the library keeps its rule of no LLM vendor dependencies, and only this package depends on `@anthropic-ai/sdk`.

## Running it

Needs Node 24.2 or newer (it runs its TypeScript directly), `pnpm build` at the repo root first (it uses the built package), Chrome or Chromium for rendering (`npx playwright install chromium`, or `CHROME_PATH`) and ffmpeg.

```bash
cd evals
node src/cli.ts --list                                               # the tasks
node src/cli.ts --model anthropic:claude-opus-5-5 --judge anthropic:claude-opus-5-5
node src/cli.ts --model anthropic:claude-sonnet-5-5?effort=high --mode reference --samples 3
node src/cli.ts --model anthropic:claude-opus-5-5 --type transition,overlay --turns 1
node src/cli.ts --model oracle --mode reference                      # the graders' ceiling, no model calls
```

`pnpm eval -- <options>` from the repo root runs the same thing (paths are then relative to `evals/`).

Each run writes `results/<time>-<model>/`:

- `report.md`: scores overall, by mode, by kind, by type and by task, the commonest failed checks and any errors.
- `results.json`: every sample's checks, scores, judge notes, tokens and timings.
- `samples/<task>/<n>/`: the draft (`effect.json`, `effect.frag` or `effect.svg`), its rendered frames, `frames.png` (a strip of them) and `transcript.md`.
- `references/<task>/reference.png`: what the model was shown.
- `answers/`: every model answer by key, so `--model replay:<run>/answers` (and `--judge replay:…`) re-grades a run without calling a model.

Model calls cost money: a full run is 29 tasks × samples × up to `--turns` drafting calls, plus one judge call per rendered sample. Start with `--task` or `--type` and one sample.

### Models

| Spec | What it is |
| --- | --- |
| `anthropic:<model>[?effort=…]` | The Claude API, through `@anthropic-ai/sdk` (credentials from `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile). |
| `command:<shell command>` | Any other model: the command reads the request as JSON on stdin (`{ key, system, messages, schema }`, images as base64 PNG) and prints the answer. Wrap another vendor's SDK or CLI this way. |
| `replay:<folder>` | Answers saved by an earlier run. |
| `oracle` | Answers each reference task with the catalog effect it holds out: what a perfect draft scores. Use it after changing a grader. |

## Comparing models

Run the same tasks, samples and judge for each model, then put the runs side by side:

```bash
node src/cli.ts --model anthropic:claude-opus-5-5 --judge anthropic:claude-opus-5-5 --samples 3 --out results/opus
node src/cli.ts --model "command:node src/adapters/gemini.ts gemini-4-hydrogen" --judge anthropic:claude-opus-5-5 --samples 3 --out results/gemini
node src/compare.ts results/opus results/gemini --out results/opus-vs-gemini.md
```

`src/adapters/gemini.ts` calls the Gemini API with `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), or without a key Vertex AI with Application Default Credentials (`gcloud auth application-default login`; `GOOGLE_CLOUD_PROJECT` defaults to gcloud's project, `GOOGLE_CLOUD_LOCATION` to `global`), over plain `fetch`, so no Google SDK is installed; it retries rate limits and stops the run on a bad key or unknown model. Write an adapter like it for any other vendor: read the request JSON on stdin, print the answer (or the `#flair-eval-response` envelope with tokens and the stop reason, see `RESPONSE_MARKER` in `src/types.ts`), and exit 3 when no request would succeed.

The comparison shows the score and first-try rate overall, by mode, by type and by task, the change between the runs, and which tasks each model did better on. It warns when the judges differ, and when a model judged its own drafts: models tend to favour their own work, so re-judge both runs with another model before trusting a close result. Re-judging needs no new drafts:

```bash
node src/cli.ts --model replay:results/opus/answers --judge "command:node src/adapters/gemini.ts gemini-4-hydrogen" --samples 3 --out results/opus-gemini-judged
```

## What it measures

**The prompt.** The system prompt is the `flair-author` skill exactly as shipped (`skills/flair-author`), plus how to format the answer: a `json` block with the definition and a `glsl` or `svg` block with the source. So the eval measures the model *and* the docs agents get; a change to the skill shows up here.

**Types.** Shaders: `background`, `filter` (changes a picture), `overlay` (alpha as coverage), `transition` (`uFrom`, `uTo`, `uProgress`), `interactive` (the pointer). Vector effects: `title`, `loader`, `icon`, `ui`, `data`. Each type is rendered the way it is used: a filter on a test photo, an overlay with alpha (shown over a checkerboard), a transition at progress steps from 0 to 1, an interactive shader with a scripted pointer, a vector effect over its play-through. Camera moves, timing effects and text treatments are TypeScript or host-drawn, so they are not drafted here.

**Repair turns.** After each draft the harness runs what an agent's tools would (the static checks, a compile and render) and sends back what they report, as `flair controls` and the compiler would. The draft gets up to `--turns` turns (default 3); *first try* is the share that came out clean at once. What the brief asked for is never sent back: following the brief is part of what is graded.

**Scores**, 0–100 per sample:

| Area | Weight | What |
| --- | ---: | --- |
| Valid | 15% | Kebab id, known category, every uniform a control, no redeclared built-ins or wrapper code, presets use declared controls with values in range, the vector picture has no `svgMotionIssues`. Every catalog effect passes these. |
| As asked | 25% | The type's contract (a filter takes a picture, an overlay is transparent and leaves the picture visible, a transition shows `uFrom` at 0 and `uTo` at 1), the brief's controls (counts of controls, colour and text controls, trigger or loop), and that it moves when it should. |
| Renders | 15% | It compiles and draws something. A draft that does not render scores at most 20. |
| Look | 45% | The judge's grade (fidelity counts double, then craft, motion and controls, each 1–5), or on reference tasks without a judge, frame similarity to the reference (palette 40%, layout SSIM 35%, amount of motion 25%). With both, 30% judge and 15% similarity. |

Frame similarity is rough: it rewards the right colours, layout and pace, not the right idea, and generative effects with a different random phase score low on layout. Use a judge for anything you will act on; `--model oracle` scores 100 on every reference it can answer, which shows the metric's ceiling.

Run several `--samples` to see variance; the report gives mean ± standard deviation.

## Tasks

`src/tasks.ts` holds 17 scratch tasks (every type) and 12 reference tasks that hold out catalog effects (the model sees their frames, never their id, description or source). Reference tasks for effects whose layout is worked out in code (`derived`, such as `split-reveal` and `lower-third`) still test models, but the oracle cannot answer them.

Your own tasks go in a JSON file, used with `--tasks <file>` instead of the built-in ones; see `tasks/custom.example.json`. A reference is one of:

```jsonc
{ "effect": "aurora" }                                 // a catalog effect, rendered
{ "images": ["frame1.png", "frame2.png"] }             // stills or frames of a clip, in order
{ "video": "clip.mp4", "frames": 8 }                    // frames taken evenly through a video
```

Paths are relative to the task file. Add `"text"` to give a vector reference's text, and `expect` for checks (`animated`, `minControls`, `minColorControls`, `minTextControls`, `controls`, `trigger`, `loops`).

## Changing it

`pnpm test` at the root runs `src/evals.test.ts` (rendered tests are skipped where there is no Chrome) and `pnpm typecheck` checks this package. After changing a grader, run `--model oracle --mode reference`: every reference the oracle can answer should still score 100.
