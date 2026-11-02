---
"@pixerate/flair": minor
---

Flair's agent skills (`flair-use`, `flair-author`) are now a Claude Code plugin: the repository is a plugin marketplace named `pixerate`, so `/plugin marketplace add Pixerate/flair` then `/plugin install flair@pixerate` installs them. The plugin's version follows the package's, so it updates with each release. The skills also say to install `@pixerate/flair` in the project, since their `npx flair` commands run the project's own copy.
