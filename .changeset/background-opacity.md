---
"@pixerate/flair": minor
---

Every shader that paints its own `uBackground` colour now has a "Background opacity" control (`uBackgroundAlpha`, default 1, so nothing changes until it is lowered). Below 1 the background colour is keyed out (colour to alpha), so generators such as Neon ripple or Warp starfield can sit over other content; `drawsAlpha` follows it. `withBackgroundOpacity` / `takesBackgroundOpacity` do the same for any source. The editor provider (`flairEffects`) names the control as `backgroundOpacity`, and gives a shader that moves without repeating a `duration` (`ENDLESS_PLAY_MS`, 4 s) so editors can scrub and animate it.
