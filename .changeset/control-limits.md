---
"@pixerate/flair": minor
---

A control's declared `min=` and `max=` are now limits. `checkControlValue` (and with it the editor's `values.set` and keyframes, document checks, the integrations and the CLI) refuses a number beyond them, saying what range the control takes, for example "uAmount takes a number from 0 to 1, not 3.". Before, such values were accepted silently.

A control that declares no range keeps 0–1 (0–10 for `int`) as its slider range only, and still takes any number. `ControlDef.limits` holds the declared ends. `renderVectorEffect` still draws whatever it is given.
