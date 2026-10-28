---
"@pixerate/flair": minor
---

Make effect tags something consumers and agents can browse, not only filter by.

- `effectTags(query?)`, in both `@pixerate/flair/catalog` and `@pixerate/flair/catalog/lazy`, lists the tags of the effects a query finds with how many carry each, the most used first. `normaliseTag` and `TAG_FORMAT` are exported too.
- `findEffects({ tags })` and `findEffectMeta({ tags })` match tags in any case, with spaces as hyphens (`"Game Boy"` finds `game-boy`).
- Agents: `catalog.search` takes `tags` and returns each effect's tags, and the new `catalog.tags` command lists tags under the same filters. An unknown tag is refused with the nearest ones.
- CLI: `flair effects --tag <tags>` and a new `flair tags` command.
- Catalog tags are now consistently kebab-case, each word in one form: spaced tags are hyphenated (`motion blur` → `motion-blur`, `game boy` → `game-boy`), and singular/plural pairs are merged (`spark` → `sparks`, `star` → `stars`, `waves` → `wave`), and `timelapse` is `time-lapse`. Code filtering on the old spellings should switch to the new ones.
