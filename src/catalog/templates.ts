import type { SceneTemplate } from "../scene/template.js";

/*
 * Sequence templates: scenes with slots, built only from catalog effects,
 * camera moves and transitions (by id, so this module stays small and loads
 * none of them). The root reaches it with a dynamic import, as the scene
 * tools do.
 */

/** A labelled stand-in picture for a subject slot's default, so a template plays as it is. */
function placeholder(label: string, tint: string, width = 1600, height = 900): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#0F172A"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><rect x="${width * 0.06}" y="${height * 0.08}" width="${width * 0.88}" height="${height * 0.84}" rx="28" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="6" stroke-dasharray="24 18"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${Math.round(height / 9)}" font-weight="700" fill="#FFFFFF" fill-opacity="0.85">${label}</text></svg>`;
}

const STAGE = { width: 1920, height: 1080 };
const FULL = { x: 0, y: 0, width: 1920, height: 1080 };

const productReveal: SceneTemplate = {
  id: "product-reveal",
  name: "Product reveal",
  description: "A product shot drifts in over a gradient, the camera punches in as its name and price come up, and a flare wipes to a closing title card.",
  tags: ["product", "promo", "launch", "ad"],
  slots: [
    { name: "product", type: "image", label: "Product shot", description: "The product, ideally on a plain or transparent background.", default: placeholder("Product shot", "#FF5A36") },
    { name: "productName", type: "text", label: "Product name", default: "Nova Headphones", maxLength: 40 },
    { name: "tagline", type: "text", label: "Tagline", default: "Sound that follows you", maxLength: 60 },
    { name: "price", type: "text", label: "Price or offer", default: "From $249", maxLength: 30 },
    { name: "accent", type: "color", label: "Accent colour", default: "#FF5A36" },
    { name: "holdMs", type: "number", label: "Time on each shot (ms)", default: 2200, min: 1200, max: 6000, integer: true },
  ],
  scene: {
    name: "product-reveal",
    title: "{{productName}}",
    stage: STAGE,
    shots: [
      {
        camera: { ...FULL, during: "camera-ken-burns" },
        caption: "{{tagline}}",
        hold: "{{holdMs}}",
        layers: [
          { id: "backdrop", effect: "mesh-gradient", role: "background", values: { uColorA: "{{accent}}", uColorD: "#0F172A" }, until: { shots: 2 } },
          { id: "product", effect: "image-ken-burns", subject: { slot: "product" }, rect: { x: 400, y: 150, width: 1120, height: 630 }, values: { uZoomStart: 1, uZoomEnd: 1.15 }, until: { shots: 2 }, fade: 400 },
        ],
      },
      {
        camera: { x: 520, y: 200, width: 880, height: 495, in: "camera-punch-zoom" },
        hold: "{{holdMs}}",
        layers: [{ effect: "lower-third", role: "overlay", values: { name: "{{productName}}", title: "{{price}}", accent: "{{accent}}" }, from: 300 }],
      },
      {
        camera: { ...FULL, in: "camera-cut" },
        transition: { effect: "transition-flare-wipe", ms: 900, values: { uColor: "{{accent}}" } },
        hold: "{{holdMs}}",
        layers: [{ effect: "title-card", values: { title: "{{productName}}", subtitle: "{{tagline}}", accent: "{{accent}}" } }],
      },
    ],
  },
};

const beforeAfter: SceneTemplate = {
  id: "before-after",
  name: "Before and after",
  description: "The before picture, a wipe to the after picture, then both side by side under a headline.",
  tags: ["comparison", "before", "after", "makeover", "result"],
  slots: [
    { name: "before", type: "image", label: "Before picture", default: placeholder("Before", "#64748B") },
    { name: "after", type: "image", label: "After picture", default: placeholder("After", "#22C55E") },
    { name: "beforeLabel", type: "text", label: "Before label", default: "Before", maxLength: 30 },
    { name: "afterLabel", type: "text", label: "After label", default: "After", maxLength: 30 },
    { name: "headline", type: "text", label: "Headline", default: "See the difference", maxLength: 50 },
    { name: "background", type: "color", label: "Background colour", default: "#0F172A" },
  ],
  scene: {
    name: "before-after",
    title: "{{headline}}",
    stage: STAGE,
    shots: [
      {
        camera: FULL,
        title: "{{beforeLabel}}",
        hold: 2000,
        layers: [{ subject: { slot: "before" } }],
      },
      {
        camera: FULL,
        title: "{{afterLabel}}",
        transition: { effect: "transition-wipe", ms: 900 },
        hold: 2000,
        layers: [{ subject: { slot: "after" } }],
      },
      {
        camera: { ...FULL, in: "camera-cut" },
        title: "{{headline}}",
        transition: { effect: "transition-luma", ms: 700 },
        hold: 2600,
        layers: [
          { effect: "aurora", role: "background", values: { uSky: "{{background}}" } },
          { subject: { slot: "before" }, rect: { x: 120, y: 260, width: 800, height: 450 }, fade: 300 },
          { subject: { slot: "after" }, rect: { x: 1000, y: 260, width: 800, height: 450 }, fade: 300, from: 250 },
        ],
      },
    ],
  },
};

const statCountdown: SceneTemplate = {
  id: "stat-countdown",
  name: "Stat countdown",
  description: "A countdown builds anticipation, a counter runs up to the number that matters, and a kinetic line lands the message.",
  tags: ["stat", "number", "counter", "countdown", "data", "milestone"],
  slots: [
    { name: "intro", type: "text", label: "Countdown label", default: "This year we reached", maxLength: 40 },
    { name: "countFrom", type: "number", label: "Count down from", default: 3, min: 1, max: 10, integer: true },
    { name: "value", type: "number", label: "The number", default: 12500, min: 0, max: 100000 },
    { name: "caption", type: "text", label: "What the number counts", default: "happy customers", maxLength: 40 },
    { name: "closing", type: "text", label: "Closing line", default: "Thank you", maxLength: 30 },
    { name: "accent", type: "color", label: "Accent colour", default: "#F59E0B" },
  ],
  scene: {
    name: "stat-countdown",
    title: "{{value}} {{caption}}",
    stage: STAGE,
    shots: [
      {
        camera: FULL,
        hold: 3200,
        layers: [{ effect: "countdown", values: { from: "{{countFrom}}", step: 0.6, label: "{{intro}}", ring: "{{accent}}", hold: 0.5 } }],
      },
      {
        camera: { ...FULL, in: "camera-cut" },
        transition: { effect: "transition-focus-pull", ms: 700 },
        hold: 3000,
        layers: [
          { effect: "grainy-gradient", role: "background" },
          { effect: "stat-counter", role: "overlay", values: { value: "{{value}}", caption: "{{caption}}", accent: "{{accent}}" } },
        ],
      },
      {
        camera: { ...FULL, in: "camera-cut" },
        transition: { effect: "transition-wipe", ms: 600 },
        hold: 2400,
        layers: [{ effect: "kinetic-stagger", values: { text: "{{closing}}", accent: "{{accent}}" } }],
      },
    ],
  },
};

const FEATURE = { width: 1280, height: 720 };
const featureShot = (n: number, x: number, move: string) => ({
  camera: { x: x - 200, y: 0, width: 1920, height: 1080, in: move },
  title: `{{feature${n}}}`,
  hold: "{{holdMs}}" as const,
  layers: [{ id: `screen${n}`, subject: { slot: `screen${n}` }, rect: { x: x + 120, y: 180, ...FEATURE }, until: { shots: 4 - n }, fade: 300 }],
});

const titleIntoTour: SceneTemplate = {
  id: "title-into-tour",
  name: "Title card into feature tour",
  description: "An opening title card focus-pulls into a tour of three features, the camera gliding and whip-panning from screen to screen.",
  tags: ["title", "tour", "features", "product", "walkthrough", "saas"],
  slots: [
    { name: "title", type: "text", label: "Title", default: "Introducing Atlas", maxLength: 40 },
    { name: "subtitle", type: "text", label: "Subtitle", default: "Plan, build and ship together", maxLength: 60 },
    { name: "accent", type: "color", label: "Accent colour", default: "#6366F1" },
    { name: "feature1", type: "text", label: "Feature 1", default: "Plan in one place", maxLength: 40 },
    { name: "screen1", type: "image", label: "Feature 1 screenshot", default: placeholder("Feature 1", "#6366F1", 1280, 720) },
    { name: "feature2", type: "text", label: "Feature 2", default: "Build with your team", maxLength: 40 },
    { name: "screen2", type: "image", label: "Feature 2 screenshot", default: placeholder("Feature 2", "#0EA5E9", 1280, 720) },
    { name: "feature3", type: "text", label: "Feature 3", default: "Ship with confidence", maxLength: 40 },
    { name: "screen3", type: "image", label: "Feature 3 screenshot", default: placeholder("Feature 3", "#22C55E", 1280, 720) },
    { name: "holdMs", type: "number", label: "Time on each feature (ms)", default: 2200, min: 1200, max: 6000, integer: true },
  ],
  scene: {
    name: "title-into-tour",
    title: "{{title}}",
    stage: STAGE,
    shots: [
      {
        camera: { x: 0, y: 0, width: 1920, height: 1080 },
        hold: 3000,
        layers: [{ effect: "title-card", values: { title: "{{title}}", subtitle: "{{subtitle}}", accent: "{{accent}}", hold: 2.5 } }],
      },
      {
        ...featureShot(1, 200, "camera-cut"),
        transition: { effect: "transition-focus-pull", ms: 800 },
        layers: [{ id: "backdrop", effect: "aurora", role: "background", values: { uGlowB: "{{accent}}" }, until: { shots: 3 } }, ...featureShot(1, 200, "camera-cut").layers],
      },
      featureShot(2, 2400, "camera-glide"),
      featureShot(3, 4600, "camera-whip-pan"),
    ],
  },
};

/** The catalog's sequence templates. */
export const SCENE_TEMPLATES: readonly SceneTemplate[] = [productReveal, beforeAfter, statCountdown, titleIntoTour];

/** A catalog template by id, or undefined. */
export function sceneTemplate(id: string): SceneTemplate | undefined {
  return SCENE_TEMPLATES.find((t) => t.id === id);
}
