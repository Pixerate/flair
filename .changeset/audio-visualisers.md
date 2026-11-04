---
"@pixerate/flair": minor
---

Sixteen new audio-reactive effects in the `audio` category, each playing an idle demo when silent:

- `black-hole-spectrum`: a lensed black hole whose accretion disk is the spectrum (bass outside, treble by the horizon).
- `black-hole-silhouette`: the same for any shape or word (a mask): the disk hugs its outline, lensed over the top, with a photon ring tracing its edge.
- `arcane-sigil`: any shape or word as a magic portal ringed by bands of glowing runes, one to a band of the spectrum.
- `spell-trace`: a minimal hairline trace of any shape or word, with a ring of 64 spectrum dots (transparent).
- `ripple-dot`: a single dot and its ripples, the spectrum read outward (transparent).
- `cymatics`, `liquid-chrome`, `aurora-curtain`, `neon-skyline`, `fractal-pulse`, `ferrofluid-spikes`, `saturn-rings`, `solar-prominence`, `plasma-globe`, `pulsar` and `nebula-pillars`.

Find the ones that take a shape with `findEffects({ accepts: ["audio", "mask"] })`.
