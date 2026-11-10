---
"@pixerate/flair": patch
---

Deduplicate in-flight module loads in `@pixerate/flair/catalog/lazy` when multiple effects from the same module are requested together, and resolve effects in the docs gallery, detail sheet, and hero stage from the already-bundled `@pixerate/flair/catalog` so previews never fail on dynamic chunk fetches across deployments.
