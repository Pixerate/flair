---
"@pixerate/flair": minor
---

`flames` and `pixel-fire` can drop their backdrop. Both gain a Background colour control (`uBackground`, black for `flames` and the near-black `#050303` for `pixel-fire`, so they look as before) and with it the Background opacity control (`uBackgroundAlpha`, default 1) that keys the background colour out to alpha. Their paint hints set `uBackgroundAlpha` to 0, so painting with either leaves only the fire, not an opaque black band around it.
