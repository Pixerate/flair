# @pixerate/flair

## 0.2.0

### Minor Changes

- 6fb310a: Build the effect editor on `@pixerate/editor` 0.29's new subpaths (now the minimum version of the optional peer):

  - Keyframes use `@pixerate/editor/animation`'s easing engine and track types. Flair's own copy is gone; its exports remain as aliases.
  - Agent tools are typed by `@pixerate/editor/tools`. A new `createEffectToolRegistry(editor)` serves them through its `ToolRegistry`, with argument checking.
  - New `parameterSchemaFor(controls)` and `bindEffectParameters(editor)` drive `@pixerate/editor/parameters`, including the React and Svelte `ParametersPanel`s, with every change and keyframe toggle going through the effect editor.
  - New `EffectEditor.setTrack` and its `keyframe.setTrack` command replace a control's keyframes in one step.

## 0.1.1

### Patch Changes

- 921f9f4: Ship `CHANGELOG.md` in the package and normalise the `bin` and `repository` fields, so npm no longer rewrites them on publish.

## 0.1.0

### Minor Changes

- f4849b5: First public release: WebGL2 shader effects with image controls, animated vector effects, a catalog of 59 ready-made effects, and a UI-agnostic, agent-ready effect editor built on `@pixerate/editor`.
