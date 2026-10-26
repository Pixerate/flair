---
title: React Integration
description: Using Flair in React 18 and 19 applications.
---

# React Integration

Install the optional peer dependency `react` and import `@pixerate/flair/react`:

```tsx
import { FlairEffect } from "@pixerate/flair/react";

export function HeroBanner() {
  return (
    <div className="relative w-full h-96">
      <FlairEffect
        id="fire-border"
        controls={{ uSpeed: 1.5 }}
        className="absolute inset-0"
      />
      <div className="relative z-10 p-8">
        <h1>Welcome to Flair</h1>
      </div>
    </div>
  );
}
```
