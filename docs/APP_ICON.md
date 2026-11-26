# App Icon Prompt & Generation Guide

This document records the brand palette, prompts, and rendering pipeline used to create the Flair icon (`brand/flair-icon-1024.png`, `apps/docs/src/assets/logo.png`, `apps/docs/public/favicon.png`, `apps/docs/public/apple-touch-icon.png`, and `apps/demo/public/favicon.png`) and social media avatar (`brand/flair-avatar-1024.png`), aligned with the Pixerate family visual identity (`JazzPaint/docs/APP_ICON.md`, `Swash/docs/APP_ICON.md`, and `SlopStats/docs/APP_ICON.md`).

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
- Subject: A bold, solid, glossy 3D faceted four-point star / optical flare emblem in the center, with a single sleek 3D luminous ribbon looping in an angled elliptical orbit around the star (passing behind the upper-left and sweeping smoothly around the front toward the upper-right) where its trailing tip dissolves into a clean cluster of floating, glowing rounded-square pixel blocks (echoing the signature Pixerate pixel-grid motif).
- Brand Colours (from the Pixerate palette):
  - Background: Full-bleed rich dark obsidian-violet gradient (`#0D061A` to `#1A0B2E`, full square canvas with NO white border, NO transparent corners, and NO pre-cut rounded-rectangle or squircle frame inside the image — fill the entire 1024x1024 square edge-to-edge into all four sharp 90-degree corners).
  - Flare, Wave & Pixels Palette: Pixerate's signature neon gradient — hot pink / rose (`#EC4899` / `#EE1D7E`), electric fuchsia (`#E12AFB` / `#EE6BFF` / `#C800DE`), luminous violet (`#8E51FF` / `#7F22FE`), and deep electric indigo (`#4338CA`), with brilliant glass-like specular highlights.
- Composition: Centered, bold, uncluttered, instantly readable at both 1024px and small 16px/32px site header and browser favicon sizes. No text, no letter "F", no typography.
```

## 3. Exact Image Generation Prompt

```text
Minimalist modern macOS app icon for Flair. In the center, a bold, solid 3D four-pointed optical flare star emblem with crisp geometric beveled facets, solid volume, and an intense glowing core with glass-like specular highlights. A single sleek, smooth 3D luminous ribbon loops in an elegant angled elliptical orbit around the star, swooping behind the left point and curving gracefully around the front towards the upper-right. Only at the upper-right tip does the ribbon dissolve into a small, clean, well-spaced cluster of crisp floating rounded-square pixel blocks with glowing edges. Uncluttered, iconic, high-contrast, perfectly legible at tiny favicon sizes. Vibrant Pixerate neon color gradient flowing through the ribbon and star: hot pink (#EC4899), electric fuchsia (#E12AFB), luminous violet (#8E51FF), and deep indigo (#4338CA). Background is a full-bleed edge-to-edge dark obsidian-violet gradient (#0D061A to #1A0B2E) filling all four sharp 90-degree corners with generous margin around the emblem. No squircle frame, no border, no text, no wireframe lines.
```

## 4. Generating the Site Header Logo, Favicon & Touch Icon

- **Source (`brand/flair-icon-1024.png`)**: 1024×1024 full-bleed opaque RGB PNG.
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
    let srcPath = "brand/flair-icon-1024.png"
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

## 5. Social Media Avatar (`brand/flair-avatar-1024.png`)

- **Purpose**: 1024×1024 full-bleed opaque RGB PNG (`hasAlpha: no`) for social media profile avatars (X/Twitter, Discord, Instagram, GitHub, YouTube, TikTok). The artwork from `brand/flair-icon-1024.png` is inset with extra background padding so the optical flare star, orbital ribbon, and glowing pixel blocks stay comfortably inside circular avatar crops.
- **Generation**:

```bash
swift -e '
import AppKit
import CoreImage
import ImageIO

let srcPath = "brand/flair-icon-1024.png"
let outPath = "brand/flair-avatar-1024.png"
guard let input = CIImage(contentsOf: URL(fileURLWithPath: srcPath)) else {
    fatalError("Could not load \(srcPath)")
}

let pad: CGFloat = 84
let trim: CGFloat = 16
let feather: CGFloat = 32
let extent = input.extent
let trimmed = input.cropped(to: extent.insetBy(dx: trim, dy: trim))
let padded = extent.insetBy(dx: -pad, dy: -pad)

let background = trimmed.clampedToExtent().applyingGaussianBlur(sigma: 24).cropped(to: padded)
let mask = CIFilter(name: "CIRoundedRectangleGenerator", parameters: [
    "inputExtent": CIVector(cgRect: trimmed.extent.insetBy(dx: feather, dy: feather)),
    "inputRadius": 24.0,
    "inputColor": CIColor.white,
])!.outputImage!
    .applyingGaussianBlur(sigma: feather * 0.5)
    .cropped(to: padded)

let blended = CIFilter(name: "CIBlendWithMask", parameters: [
    kCIInputImageKey: trimmed,
    kCIInputBackgroundImageKey: background,
    kCIInputMaskImageKey: mask,
])!.outputImage!
    .cropped(to: padded)
    .transformed(by: CGAffineTransform(translationX: pad - extent.origin.x, y: pad - extent.origin.y))

let scale = 1024.0 / padded.width
let scaled = blended.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

let context = CIContext()
guard let rendered = context.createCGImage(scaled, from: CGRect(x: 0, y: 0, width: 1024, height: 1024)) else {
    fatalError("Failed to render \(outPath)")
}

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let opaqueCtx = CGContext(
    data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0,
    space: srgb, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
)!
opaqueCtx.draw(rendered, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let url = URL(fileURLWithPath: outPath) as CFURL
let dest = CGImageDestinationCreateWithURL(url, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, opaqueCtx.makeImage()!, nil)
guard CGImageDestinationFinalize(dest) else {
    fatalError("Failed to write \(outPath)")
}
'
```
