---
"@pixerate/flair": minor
---

Data and icon effects (vector, so they render crisp and export to animated SVG and recordings).

- **data**: `donut-chart`, `pie-chart`, `gauge`, `bar-race`, `sparkline`, `leaderboard`, `area-chart` and `kpi-tile`. Lists come in through text controls of comma-separated values with a matching labels control (`values: "42,28,18,12"`, `labels: "Direct,Social,Search,Email"`); stacked series and race rows are separated by semicolons (`series: "12,18,15;8,10,14"`, `rows: "Lumen:12,28,41;Pixel:30,36,48"`). Any text is safe: unreadable numbers count as nothing, units and currency signs are ignored, and the defaults come back when nothing is readable. Long labels are cut short with an ellipsis.
- **icon**: `weather-icons` (sun, partly cloudy, cloudy, rain, thunder, snow or wind, picked by `kind`), `notification-bell`, `animated-arrows` (nudge, chevrons, refresh or external link), `emoji-reactions` (hover), `bookmark-star` (a five-star rating filling on hover; `like-button` already covers the heart burst), `trash-delete` (click, replays), `lock-unlock` (click toggle) and `wifi-signal`.
