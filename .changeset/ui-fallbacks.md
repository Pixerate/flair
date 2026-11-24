---
"@pixerate/flair": minor
---

Fallbacks for UI components (Pixerate/surreal-ui#38): `UiDescriptor` gains `fallback`, the baseline type to show where the effect can't run, matching `@pixerate/schemas` 2.6.0. The gauge falls back to `progress`, and the new `uiFallback(effect, data)` gives `{ implements: "progress", props: { value, label } }` from the gauge's data: the reading as a percent of the scale, written out in the label ("Speed: 88 km/h"). The loaders (`liquid-loader`, `flame-loader`, `generating-field`, `slop-vat`) fall back to `progress` as well, their `value` as a percent, and to `spinner` while the value is `null`. `UiFallback` is exported too. The gauge's and the loaders' `contentHash`es change, since they now cover the example's fallback.
