// jsdom has no layout observers; the renderer and the thumbnail pool need them to exist.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
  if (typeof globalThis[name] === "undefined") {
    (globalThis as Record<string, unknown>)[name] = ObserverStub;
  }
}
