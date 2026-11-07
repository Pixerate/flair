---
"@pixerate/flair": minor
---

Three pixel-bloom effects: rounded squares on a sunflower spiral (phyllotaxis). `pixel-bloom` (pattern) is big at a bright centre and shrinks to pixel dust toward the edge, turning slowly while a shimmer ripples outward, on a clear background. `pixel-bloom-reveal` (loader) is a logo-sting loop: squares pop out centre-first, hold, then spin away to dust edge-first. `transition-pixel-bloom` grows spiral squares out from the centre, each carrying the next picture, with a glow on the growing edge. Each pixel only checks the squares near its radius and angle, so all three stay within a few milliseconds a frame at 1080p.
