---
title: Quick Start
description: Get up and running with Flair in under two minutes.
---

# Quick Start

## Installation

Install `@pixerate/flair` using your preferred package manager:

```bash
# pnpm (recommended)
pnpm add @pixerate/flair

# npm
npm install @pixerate/flair

# yarn
yarn add @pixerate/flair
```

## Basic Example: Mounting an Effect

Mounting a ready-made effect onto any HTML container:

```ts
import { mountEffect } from "@pixerate/flair/embed";
import { loadEffect } from "@pixerate/flair/catalog/lazy";

// 1. Fetch the effect on-demand (lazy-loaded to keep bundles light)
const effect = await loadEffect("fire-border");

// 2. Mount onto your container element
const instance = mountEffect(document.getElementById("my-banner"), effect, {
  controls: {
    uFlames: [1.0, 0.4, 0.1],
    uSpeed: 1.2,
  },
});

// Update controls dynamically
instance.setControls({ uSpeed: 2.0 });

// Clean up when unmounting
// instance.destroy();
```

## Vector / SVG Effects

Vector effects render cleanly without WebGL:

```ts
import { loadEffect } from "@pixerate/flair/catalog/lazy";
import { SvgPlayer } from "@pixerate/flair/vector";

const effect = await loadEffect("hourglass");
const player = new SvgPlayer(document.getElementById("loader-slot"), effect);

player.play();
```
