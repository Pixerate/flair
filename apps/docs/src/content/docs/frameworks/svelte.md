---
title: Svelte Integration
description: Using Flair in Svelte 5 with zero runtime compiler baggage.
---

# Svelte Integration

Use Flair's ultra-thin Svelte actions (`svelte >= 5`):

```svelte
<script lang="ts">
  import { flairEffect } from "@pixerate/flair/svelte";
</script>

<div
  use:flairEffect={{
    id: "glow-ring-spinner",
    controls: { uSpeed: 2.0 },
  }}
  class="w-32 h-32"
></div>
```
