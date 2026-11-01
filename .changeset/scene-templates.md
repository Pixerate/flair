---
"@pixerate/flair": minor
---

Sequence templates: reusable scenes with typed slots (`image`, `video`, `svg`, `text`, `color`, `number`, each with a label, a default and a range) that fill layer subject slots and `{{slot}}` placeholders. `instantiateTemplate` fills one into a `Scene` and refuses unknown slots, wrong types and out-of-range values with what each slot takes; `checkTemplate` checks a template of your own. The catalog has four (`product-reveal`, `before-after`, `stat-countdown`, `title-into-tour`) as `SCENE_TEMPLATES` in `@pixerate/flair/catalog`, loaded on demand by the root. Agents get `find_templates`, `describe_template` and `use_template` scene tools, and the CLI `flair template list | show | fill`.
