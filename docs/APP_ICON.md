# App Icon Prompt & Generation Guide

This document records the brand palette, prompts, and rendering pipeline used to create the Flair icon (`apps/docs/src/assets/icon-1024.png`, `apps/docs/src/assets/logo.png`, `apps/docs/public/favicon.png`, `apps/docs/public/apple-touch-icon.png`, and `apps/demo/public/favicon.png`), aligned with the Pixerate family visual identity (`JazzPaint/docs/APP_ICON.md`, `Swash/docs/APP_ICON.md`, and `SlopStats/docs/APP_ICON.md`).

## 1. Pixerate Brand Palette

- **Background**: Deep obsidian-violet gradient (`#0D061A` to `#1A0B2E`)
- **Primary Fuchsia (`--primary` / `AccentColor`)**: `#EE6BFF` (light) / `#C800DE` (dark)
- **Glow Outline (`GlowOutline`)**: `#E12AFB` (`oklch(0.667 0.295 322.15)`)
- **Glow Shadow (`GlowShadow`)**: `#8E51FF` / `#7F22FE` (`oklch(0.606 0.25 292.717)`)
- **Flare, Wave & Pixel Gradient**: Hot pink (`#EC4899` / `#EE1D7E`) → electric fuchsia (`#E12AFB`) → luminous violet (`#8E51FF`) → electric indigo (`#4338CA`)

## 2. Subagent Brief

```text
Generate a 1024x1024 app/repo icon for "Flair" (a shader, visual effects, and motion graphics library & studio by Pixerate).

Visual brief (must match the Pixerate family icons for Jazz Paint, Swash, and Pixerate Stats):
- Style: Modern Apple macOS / iOS app icon aesthetic — tactile, dimensional, glossy 3D glassmorphic and vector-crafted object with rich lighting, specular highlights, subtle inner glow, smooth gradients, and a clean, bold silhouette.
- Subject: A bold, sculptural 3D radiant four-point star / optical flare emblem intertwined with a sweeping, dynamic luminous light-wave ribbon curving upward from bottom-left toward top-right. The sweeping flare wave and outer tips of the radiant star gracefully dissolve and scatter outward into crisp, floating, luminous rounded-square pixel blocks of varying sizes with glowing edges (echoing the signature Pixerate pixel-grid motif).
- Brand Colours (from the Pixerate palette):
  - Background: Full-bleed rich dark obsidian-violet gradient (`#0D061A` to `#1A0B2E`, full square canvas with NO white border, NO transparent corners, and NO pre-cut rounded-rectangle or squircle frame inside the image — fill the entire 1024x1024 square edge-to-edge into all four sharp 90-degree corners).
  - Flare, Wave & Pixels Palette: Pixerate's signature neon gradient — hot pink / rose (`#EC4899` / `#EE1D7E`), electric fuchsia (`#E12AFB` / `#EE6BFF` / `#C800DE`), luminous violet (`#8E51FF` / `#7F22FE`), and deep electric indigo (`#4338CA`), with brilliant glass-like specular highlights.
- Composition: Centered, bold, uncluttered, instantly readable at both 1024px and small 16px/32px site header and browser favicon sizes. No text, no letter "F", no typography.
```

## 3. Exact Image Generation Prompts

### Pass 1 — Initial 1:1 Icon Generation

```text
App icon design for Flair, a shader and visual effects library. Centered sculptural 3D radiant four-point optical flare star emblem intertwined with a sweeping, dynamic luminous wave ribbon curving gracefully upward from bottom-left toward top-right. The outer tips of the radiant star and the sweeping light ribbon dissolve into floating luminous rounded-square pixel cubes and micro-blocks of varying sizes with glowing edges. Premium modern Apple iOS app icon aesthetic, glassmorphic 3D rendering with tactile depth, frosted translucent glass, prismatic caustics, and crisp specular highlights. Vibrant neon gradient palette of hot pink, electric fuchsia, luminous purple-violet, and deep indigo with brilliant glowing white-hot core lighting. Full-bleed background filling the entire square canvas edge-to-edge into all four sharp corners with a deep obsidian dark violet and midnight-purple ambient gradient (#0D061A to #1A0B2E). No squircle frame, no border, no text, no letters, no typography, full square bleed.
```

### Pass 2 — Contained Composition & Specular Glass Refinement

```text
App icon for "Flair" visual effects studio. Centered fully within the frame with comfortable margins: a stunning sculptural 3D four-pointed optical flare star emblem with a bright glowing center, intertwined with an elegant, glossy curved light-wave ribbon flowing from lower-left to upper-right. The ends of the curved ribbon and the tips of the 4-point flare gracefully dissolve and disperse into floating, luminous rounded-square pixel cubes of varying sizes with glowing edges. Premium modern macOS app icon style, tactile dimensional glossy translucent 3D glass and polished ceramic finish, rich specular highlights, subtle neon inner glow, vibrant gradients of neon hot pink (#EC4899), vivid fuchsia (#E12AFB), luminous electric violet (#8E51FF), and indigo (#4338CA). Full-bleed edge-to-edge dark obsidian violet background (#0D061A to #1A0B2E) filling all 4 sharp corners. Completely contained subject within canvas, no cropping of elements, no squircle mask, no border, no text.
```

## 4. Generating the Site Header Logo, Favicon & Touch Icon

- **Source (`apps/docs/src/assets/icon-1024.png`)**: 1024×1024 full-bleed opaque RGB PNG.
- **Squircle Icons (`apps/docs/src/assets/logo.png`, `apps/docs/public/favicon.png`, `apps/demo/public/favicon.png`)**: Framed to the Apple HIG macOS squircle grid (`824/1024` body, continuous corner radius `22.37%` of the body, specular inner border, and downward drop shadow `dy = +10`, `radius = 16`, `opacity = 28%`).
- **Touch Icon (`apps/docs/public/apple-touch-icon.png`)**: 180×180 full-bleed PNG.

```bash
swift -e '
import AppKit
import SwiftUI

@MainActor
func renderSquircle(nsImage: NSImage, px: Int, bodyRatio: CGFloat = 824.0 / 1024.0, withShadow: Bool = true) -> Data {
    let s = CGFloat(px)
    let body = s * bodyRatio
    let radius = body * 0.2237
    let shadowRadius = withShadow ? s * (16.0 / 1024.0) : 0
    let shadowY = withShadow ? s * (10.0 / 1024.0) : 0
    let borderWidth = max(0.5, s * (2.0 / 1024.0))

    let view = ZStack {
        Color.clear
        Image(nsImage: nsImage)
            .resizable()
            .interpolation(.high)
            .scaledToFill()
            .frame(width: body, height: body)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color(red: 0.93, green: 0.42, blue: 1.0).opacity(0.45),
                                Color.white.opacity(0.12),
                                Color(red: 0.56, green: 0.32, blue: 1.0).opacity(0.28)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: borderWidth
                    )
            )
            .shadow(color: .black.opacity(withShadow ? 0.28 : 0.0), radius: shadowRadius, x: 0, y: shadowY)
    }
    .frame(width: s, height: s)

    let renderer = ImageRenderer(content: view)
    renderer.scale = 1.0
    guard let cgImage = renderer.cgImage else {
        fatalError("Failed to render at \(px)")
    }
    let rep = NSBitmapImageRep(cgImage: cgImage)
    rep.size = NSSize(width: s, height: s)
    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to encode PNG")
    }
    return pngData
}

@MainActor
func renderFullBleed(nsImage: NSImage, px: Int) -> Data {
    let s = CGFloat(px)
    let view = Image(nsImage: nsImage)
        .resizable()
        .interpolation(.high)
        .scaledToFill()
        .frame(width: s, height: s)
        .clipped()

    let renderer = ImageRenderer(content: view)
    renderer.scale = 1.0
    guard let cgImage = renderer.cgImage else {
        fatalError("Failed to render full-bleed at \(px)")
    }
    let rep = NSBitmapImageRep(cgImage: cgImage)
    rep.size = NSSize(width: s, height: s)
    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to encode PNG")
    }
    return pngData
}

MainActor.assumeIsolated {
    let srcPath = "apps/docs/src/assets/icon-1024.png"
    guard let nsImage = NSImage(contentsOfFile: srcPath) else {
        fatalError("Could not load \(srcPath)")
    }

    try! renderSquircle(nsImage: nsImage, px: 256)
        .write(to: URL(fileURLWithPath: "apps/docs/src/assets/logo.png"))

    let faviconData = renderSquircle(nsImage: nsImage, px: 64)
    try! faviconData.write(to: URL(fileURLWithPath: "apps/docs/public/favicon.png"))
    try! faviconData.write(to: URL(fileURLWithPath: "apps/demo/public/favicon.png"))

    try! renderFullBleed(nsImage: nsImage, px: 180)
        .write(to: URL(fileURLWithPath: "apps/docs/public/apple-touch-icon.png"))
}
'
```
