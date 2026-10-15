<script>
  import { vectorEffect, vectorEffectStill } from "../index.js";

  let { params: initial } = $props();
  let params = $state.raw(initial);
  const still = $derived(vectorEffectStill(params));

  export function set(next) {
    params = next;
  }
</script>

<span class="host" use:vectorEffect={params} style={still.style}>{@html still.markup}</span>
