import type { SvgAnimation } from "../vector/motion.js";
import { colorControl, numberControl, type VectorEffect } from "./types.js";

export const spinner: VectorEffect = {
  kind: "vector",
  id: "spinner",
  name: "Spinner",
  description: "An arc chasing its tail: the classic indeterminate loader.",
  category: "loader",
  tags: ["loader", "ui", "minimal"],
  hold: 0,
  controls: [colorControl("accent", "#6366F1", "Arc"), colorControl("track", "#E5E7EB", "Track"), numberControl("width", 8, 2, 20, "Stroke width", 1)],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="{{track}}" stroke-width="{{width}}"/><g id="spin" transform="rotate(0 50 50)"><circle id="arc" cx="50" cy="50" r="38" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" pathLength="1" stroke-dasharray="0.25 1"/></g></svg>`,
    animate: [
      { id: "spin", attrs: { transform: ["rotate(0 50 50)", "rotate(720 50 50)"] }, ms: 1600, ease: "linear" },
      { id: "arc", attrs: { "stroke-dasharray": ["0.08 1", "0.6 1"] }, ms: 800, ease: "in-out" },
      { id: "arc", attrs: { "stroke-dasharray": ["0.6 1", "0.08 1"] }, delay: 800, ms: 800, ease: "in-out" },
    ],
  },
};

export const bouncingDots: VectorEffect = {
  kind: "vector",
  id: "bouncing-dots",
  name: "Bouncing dots",
  description: "Three dots hopping in turn, for typing indicators and loaders.",
  category: "loader",
  tags: ["loader", "chat", "typing", "ui"],
  hold: 0,
  controls: [colorControl("accent", "#0EA5E9", "Dots"), numberControl("height", 18, 4, 30, "Bounce height", 1)],
  motion: {
    svg: `<svg viewBox="0 0 120 60"><circle id="a" cx="30" cy="40" r="9" fill="{{accent}}"/><circle id="b" cx="60" cy="40" r="9" fill="{{accent}}"/><circle id="c" cx="90" cy="40" r="9" fill="{{accent}}"/></svg>`,
    animate: ["a", "b", "c"].flatMap((id, i): SvgAnimation[] => [
      { id, attrs: { transform: ["translate(0 0)", "translate(0 -{{height}})"] }, delay: i * 150, ms: 250, ease: "out" as const },
      { id, attrs: { transform: ["translate(0 -{{height}})", "translate(0 0)"] }, delay: i * 150 + 250, ms: 250, ease: "in-out" as const },
      { id, attrs: { opacity: [0.5, 1] }, delay: i * 150, ms: 250 },
      { id, attrs: { opacity: [1, 0.5] }, delay: i * 150 + 250, ms: 250 },
    ]),
  },
};

export const progressRing: VectorEffect = {
  kind: "vector",
  id: "progress-ring",
  name: "Progress ring",
  description: "A ring filling up to a percentage while the number counts with it.",
  category: "data",
  tags: ["progress", "kpi", "dashboard", "loader"],
  controls: [
    colorControl("accent", "#22C55E", "Ring"),
    colorControl("track", "#E5E7EB", "Track"),
    colorControl("text", "#111827", "Text"),
    numberControl("value", 72, 0, 100, "Percent", 1),
  ],
  derived: (v) => ({ fraction: Math.min(1, Math.max(0, Number(v.value) / 100)) }),
  motion: {
    svg: `<svg viewBox="0 0 120 120" font-family="system-ui, sans-serif"><circle cx="60" cy="60" r="48" fill="none" stroke="{{track}}" stroke-width="10"/><circle id="ring" cx="60" cy="60" r="48" fill="none" stroke="{{accent}}" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)"/><text id="label" x="60" y="68" text-anchor="middle" font-size="24" font-weight="700" fill="{{text}}">0%</text></svg>`,
    animate: [
      { id: "ring", draw: [0, "{{fraction}}"] as unknown as [number, number], ms: 1600, ease: "out" },
      { id: "label", count: [0, "{{value}}"] as unknown as [number, number], format: "{n}%", ms: 1600, ease: "out" },
    ],
  },
};

export const pulsePing: VectorEffect = {
  kind: "vector",
  id: "pulse-ping",
  name: "Pulse ping",
  description: "Rings radiating from a dot, like a live indicator or radar ping.",
  category: "loader",
  tags: ["live", "notification", "location", "status"],
  hold: 0,
  controls: [colorControl("accent", "#EF4444", "Colour")],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><circle id="r1" cx="50" cy="50" r="8" fill="none" stroke="{{accent}}" stroke-width="3"/><circle id="r2" cx="50" cy="50" r="8" fill="none" stroke="{{accent}}" stroke-width="3"/><circle cx="50" cy="50" r="9" fill="{{accent}}"/></svg>`,
    animate: [
      { id: "r1", attrs: { r: [8, 44], opacity: [0.9, 0], "stroke-width": [4, 1] }, ms: 1400, ease: "out" },
      { id: "r2", attrs: { r: [8, 44], opacity: [0.9, 0], "stroke-width": [4, 1] }, delay: 700, ms: 1400, ease: "out" },
    ],
  },
};

export const successCheck: VectorEffect = {
  kind: "vector",
  id: "success-check",
  name: "Success check",
  description: "A circle drawing itself closed, then a tick, then a little pop.",
  category: "icon",
  tags: ["success", "confirmation", "ui", "feedback"],
  hold: 1200,
  controls: [colorControl("accent", "#16A34A", "Colour"), numberControl("width", 6, 2, 12, "Stroke width", 1)],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><g id="badge" transform="translate(50 50) scale(1) translate(-50 -50)"><circle id="circle" cx="50" cy="50" r="40" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" transform="rotate(-90 50 50)"/><path id="tick" d="M31 52 L44 64 L70 37" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
    animate: [
      { id: "circle", draw: true, ms: 600, ease: "in-out" },
      { id: "tick", draw: true, delay: 500, ms: 400, ease: "out" },
      { id: "badge", attrs: { transform: ["translate(50 50) scale(1) translate(-50 -50)", "translate(50 50) scale(1.12) translate(-50 -50)"] }, delay: 850, ms: 150, ease: "out" },
      { id: "badge", attrs: { transform: ["translate(50 50) scale(1.12) translate(-50 -50)", "translate(50 50) scale(1) translate(-50 -50)"] }, delay: 1000, ms: 250, ease: "in-out" },
    ],
  },
};

export const errorCross: VectorEffect = {
  kind: "vector",
  id: "error-cross",
  name: "Error cross",
  description: "A circle and a cross drawing on, with a short shake.",
  category: "icon",
  tags: ["error", "failure", "ui", "feedback"],
  hold: 1200,
  controls: [colorControl("accent", "#DC2626", "Colour"), numberControl("width", 6, 2, 12, "Stroke width", 1)],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><g id="badge" transform="translate(0 0)"><circle id="circle" cx="50" cy="50" r="40" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" transform="rotate(-90 50 50)"/><path id="a" d="M36 36 L64 64" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round"/><path id="b" d="M64 36 L36 64" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round"/></g></svg>`,
    animate: [
      { id: "circle", draw: true, ms: 600, ease: "in-out" },
      { id: "a", draw: true, delay: 500, ms: 250, ease: "out" },
      { id: "b", draw: true, delay: 700, ms: 250, ease: "out" },
      { id: "badge", attrs: { transform: ["translate(0 0)", "translate(-6 0)"] }, delay: 950, ms: 60, ease: "linear" },
      { id: "badge", attrs: { transform: ["translate(-6 0)", "translate(6 0)"] }, delay: 1010, ms: 100, ease: "linear" },
      { id: "badge", attrs: { transform: ["translate(6 0)", "translate(0 0)"] }, delay: 1110, ms: 80, ease: "out" },
    ],
  },
};

export const heartbeat: VectorEffect = {
  kind: "vector",
  id: "heartbeat",
  name: "Heartbeat",
  description: "A heart beating twice, with an ECG line tracing beneath it.",
  category: "icon",
  tags: ["health", "like", "love", "pulse"],
  hold: 300,
  controls: [colorControl("accent", "#F43F5E", "Heart"), colorControl("line", "#94A3B8", "Line")],
  motion: {
    svg: `<svg viewBox="0 0 200 120"><g id="heart" transform="translate(100 46) scale(1)"><path d="M0 22 C-30 0 -30 -26 -10 -26 C-3 -26 0 -20 0 -16 C0 -20 3 -26 10 -26 C30 -26 30 0 0 22Z" fill="{{accent}}"/></g><path id="ecg" d="M10 100 H70 L80 86 L90 112 L100 76 L110 104 L118 100 H190" fill="none" stroke="{{line}}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    animate: [
      { id: "heart", attrs: { transform: ["translate(100 46) scale(1)", "translate(100 46) scale(1.18)"] }, ms: 120, ease: "out" },
      { id: "heart", attrs: { transform: ["translate(100 46) scale(1.18)", "translate(100 46) scale(1)"] }, delay: 120, ms: 160, ease: "in-out" },
      { id: "heart", attrs: { transform: ["translate(100 46) scale(1)", "translate(100 46) scale(1.12)"] }, delay: 300, ms: 120, ease: "out" },
      { id: "heart", attrs: { transform: ["translate(100 46) scale(1.12)", "translate(100 46) scale(1)"] }, delay: 420, ms: 300, ease: "in-out" },
      { id: "ecg", draw: true, ms: 900, ease: "linear" },
    ],
  },
};

export const barChart: VectorEffect = {
  kind: "vector",
  id: "bar-chart",
  name: "Bar chart",
  description: "Bars growing into place one after another, values counting above them.",
  category: "data",
  tags: ["chart", "dashboard", "report", "explainer"],
  hold: 1500,
  controls: [
    colorControl("accent", "#6366F1", "Bars"),
    colorControl("text", "#334155", "Text"),
    numberControl("a", 40, 0, 100, "Bar 1", 1),
    numberControl("b", 65, 0, 100, "Bar 2", 1),
    numberControl("c", 50, 0, 100, "Bar 3", 1),
    numberControl("d", 90, 0, 100, "Bar 4", 1),
  ],
  derived: (v) =>
    Object.fromEntries(
      ["a", "b", "c", "d"].flatMap((k) => {
        const h = Math.min(100, Math.max(0, Number(v[k]))) * 1.1;
        return [
          [`${k}_height`, +h.toFixed(2)],
          [`${k}_label_y`, +(134 - h).toFixed(2)],
        ];
      }),
    ),
  motion: {
    svg: `<svg viewBox="0 0 240 160" font-family="system-ui, sans-serif"><line x1="20" y1="140" x2="220" y2="140" stroke="{{text}}" stroke-opacity="0.3" stroke-width="2"/>${["a", "b", "c", "d"]
      .map(
        (k, i) =>
          `<g id="bar-${k}" transform="translate(${40 + i * 48} 140) scale(1 0)"><rect x="0" y="-1" width="32" height="1" rx="0.02" fill="{{accent}}"/></g><text id="label-${k}" x="${56 + i * 48}" y="132" text-anchor="middle" font-size="12" fill="{{text}}" opacity="0">0</text>`,
      )
      .join("")}</svg>`,
    animate: ["a", "b", "c", "d"].flatMap((k, i): SvgAnimation[] => [
      { id: `bar-${k}`, attrs: { transform: [`translate(${40 + i * 48} 140) scale(1 0)`, `translate(${40 + i * 48} 140) scale(1 {{${k}_height}})`] }, delay: i * 180, ms: 700, ease: "out" as const },
      { id: `label-${k}`, attrs: { y: [132, `{{${k}_label_y}}`], opacity: [0, 1] }, delay: i * 180, ms: 700, ease: "out" as const },
      { id: `label-${k}`, count: [0, `{{${k}}}`] as unknown as [number, number], delay: i * 180, ms: 700, ease: "out" as const },
    ]),
  },
};

export const lineChart: VectorEffect = {
  kind: "vector",
  id: "line-chart",
  name: "Line chart",
  description: "A trend line drawing across with a marker riding its tip and the area fading in below.",
  category: "data",
  tags: ["chart", "trend", "growth", "dashboard"],
  hold: 1500,
  controls: [colorControl("accent", "#0EA5E9", "Line"), colorControl("grid", "#CBD5E1", "Grid")],
  motion: {
    svg: `<svg viewBox="0 0 240 140"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.35"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient></defs><g stroke="{{grid}}" stroke-width="1"><line x1="20" y1="30" x2="220" y2="30"/><line x1="20" y1="70" x2="220" y2="70"/><line x1="20" y1="110" x2="220" y2="110"/></g><path id="area" d="M20 110 L60 92 L100 98 L140 64 L180 70 L220 30 L220 120 L20 120Z" fill="url(#fill)" opacity="0"/><path id="trend" d="M20 110 L60 92 L100 98 L140 64 L180 70 L220 30" fill="none" stroke="{{accent}}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle id="marker" r="5" fill="#fff" stroke="{{accent}}" stroke-width="3"/></svg>`,
    animate: [
      { id: "trend", draw: true, ms: 1400, ease: "in-out" },
      { id: "marker", along: "trend", ms: 1400, ease: "in-out" },
      { id: "area", attrs: { opacity: [0, 1] }, delay: 900, ms: 600 },
    ],
  },
};

export const statCounter: VectorEffect = {
  kind: "vector",
  id: "stat-counter",
  name: "Stat counter",
  description: "A headline number counting up, with its caption and underline sweeping in.",
  category: "data",
  tags: ["kpi", "number", "headline", "explainer"],
  hold: 1500,
  controls: [
    colorControl("accent", "#F59E0B", "Accent"),
    colorControl("text", "#0F172A", "Text"),
    numberControl("value", 1250, 0, 100000, "Value", 1),
  ],
  motion: {
    svg: `<svg viewBox="0 0 240 120" font-family="system-ui, sans-serif"><text id="number" x="120" y="62" text-anchor="middle" font-size="44" font-weight="800" fill="{{text}}">0</text><path id="underline" d="M60 78 H180" stroke="{{accent}}" stroke-width="6" stroke-linecap="round"/><text id="caption" x="120" y="104" text-anchor="middle" font-size="13" fill="{{text}}" opacity="0">happy customers</text></svg>`,
    animate: [
      { id: "number", count: [0, "{{value}}"] as unknown as [number, number], ms: 1500, ease: "out" },
      { id: "underline", draw: true, delay: 300, ms: 900, ease: "in-out" },
      { id: "caption", attrs: { opacity: [0, 1], y: [112, 104] }, delay: 800, ms: 500, ease: "out" },
    ],
  },
};

export const route: VectorEffect = {
  kind: "vector",
  id: "route",
  name: "Route",
  description: "A dashed journey drawing between two pins, with a traveller following it.",
  category: "data",
  tags: ["map", "travel", "delivery", "journey"],
  hold: 1200,
  controls: [colorControl("accent", "#8B5CF6", "Route"), colorControl("pin", "#0F172A", "Pins")],
  motion: {
    svg: `<svg viewBox="0 0 240 150"><path id="path" d="M30 120 C60 40 120 140 150 70 S210 30 210 30" fill="none" stroke="{{accent}}" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="120" r="7" fill="{{pin}}"/><g id="end" opacity="0"><circle cx="210" cy="30" r="9" fill="{{pin}}"/><circle cx="210" cy="30" r="3.5" fill="#fff"/></g><g id="traveller"><circle r="7" fill="{{accent}}"/><circle r="3" fill="#fff"/></g></svg>`,
    animate: [
      { id: "path", draw: true, ms: 1800, ease: "in-out" },
      { id: "traveller", along: "path", ms: 1800, ease: "in-out" },
      { id: "end", attrs: { opacity: [0, 1] }, delay: 1600, ms: 300 },
    ],
  },
};

export const blobMorph: VectorEffect = {
  kind: "vector",
  id: "blob-morph",
  name: "Blob morph",
  description: "An organic blob shape-shifting through three forms.",
  category: "organic",
  tags: ["shape", "background", "playful", "brand"],
  hold: 0,
  controls: [colorControl("colorA", "#F472B6", "Colour A"), colorControl("colorB", "#818CF8", "Colour B")],
  motion: (() => {
    const shapes = [
      "M100 30 C140 30 170 60 170 100 C170 140 140 170 100 170 C60 170 30 140 30 100 C30 60 60 30 100 30Z",
      "M100 20 C150 40 180 70 160 110 C140 160 120 175 85 165 C45 155 25 120 40 80 C55 40 70 15 100 20Z",
      "M110 35 C155 25 175 85 165 120 C155 160 105 180 70 160 C35 140 20 100 45 70 C65 45 80 40 110 35Z",
    ];
    const step = 1200;
    return {
      svg: `<svg viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{colorA}}"/><stop offset="1" stop-color="{{colorB}}"/></linearGradient></defs><path id="blob" d="${shapes[0]}" fill="url(#g)"/></svg>`,
      animate: shapes.map((d, i) => ({
        id: "blob",
        attrs: { d: [d, shapes[(i + 1) % shapes.length]!] as [string, string] },
        delay: i * step,
        ms: step,
        ease: "in-out" as const,
      })),
    };
  })(),
};

export const signature: VectorEffect = {
  kind: "vector",
  id: "signature",
  name: "Signature",
  description: "A handwritten flourish drawing itself as if by pen.",
  category: "icon",
  tags: ["handwriting", "draw-on", "personal", "reveal"],
  hold: 1500,
  controls: [colorControl("ink", "#1E293B", "Ink"), numberControl("width", 3, 1, 8, "Pen width", 0.5)],
  motion: {
    svg: `<svg viewBox="0 0 260 120"><path id="sig" d="M20 80 C40 20 60 20 55 70 C52 95 70 95 85 60 C95 40 100 75 110 70 C120 65 125 40 135 55 C145 70 150 75 165 50 C175 35 185 60 190 65 C200 75 215 40 240 45" fill="none" stroke="{{ink}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/><path id="dash" d="M70 100 Q140 92 220 98" fill="none" stroke="{{ink}}" stroke-width="{{width}}" stroke-linecap="round"/></svg>`,
    animate: [
      { id: "sig", draw: true, ms: 1800, ease: "in-out" },
      { id: "dash", draw: true, delay: 1700, ms: 400, ease: "out" },
    ],
  },
};

export const equalizer: VectorEffect = {
  kind: "vector",
  id: "equalizer",
  name: "Equalizer",
  description: "Audio level bars dancing, for now-playing badges and voice states.",
  category: "loader",
  tags: ["music", "audio", "voice", "now-playing"],
  hold: 0,
  controls: [colorControl("accent", "#10B981", "Bars")],
  motion: (() => {
    const heights = [
      [0.3, 0.9, 0.5, 0.3],
      [0.7, 0.4, 1.0, 0.7],
      [0.5, 1.0, 0.3, 0.5],
      [0.9, 0.5, 0.7, 0.9],
      [0.4, 0.8, 0.6, 0.4],
    ];
    const beat = 250;
    return {
      svg: `<svg viewBox="0 0 100 100">${heights
        .map((_, i) => `<g id="bar${i}" transform="translate(${14 + i * 16} 85) scale(1 ${heights[i]![0]})"><rect x="0" y="-70" width="10" height="70" rx="5" fill="{{accent}}"/></g>`)
        .join("")}</svg>`,
      animate: heights.flatMap((h, i) =>
        [0, 1, 2].map((k) => ({
          id: `bar${i}`,
          attrs: { transform: [`translate(${14 + i * 16} 85) scale(1 ${h[k]})`, `translate(${14 + i * 16} 85) scale(1 ${h[k + 1]})`] as [string, string] },
          delay: k * beat,
          ms: beat,
          ease: "in-out" as const,
        })),
      ),
    };
  })(),
};

export const confetti: VectorEffect = {
  kind: "vector",
  id: "confetti",
  name: "Confetti burst",
  description: "A burst of confetti flying out and fluttering down.",
  category: "icon",
  tags: ["celebration", "success", "party", "reward"],
  hold: 400,
  controls: [colorControl("a", "#F43F5E", "Colour A"), colorControl("b", "#FACC15", "Colour B"), colorControl("c", "#22D3EE", "Colour C")],
  motion: (() => {
    const pieces = Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
      const dist = 55 + (i % 4) * 12;
      const x = Math.round(Math.cos(angle) * dist);
      const y = Math.round(Math.sin(angle) * dist * 0.8 - 20);
      const spin = (i % 2 ? 1 : -1) * (180 + (i % 5) * 60);
      return { i, x, y, spin, fill: ["{{a}}", "{{b}}", "{{c}}"][i % 3]! };
    });
    return {
      svg: `<svg viewBox="0 0 200 200">${pieces
        .map((p) => `<rect id="p${p.i}" x="-4" y="-2" width="8" height="4" rx="1" fill="${p.fill}" transform="translate(100 110) rotate(0)" opacity="0"/>`)
        .join("")}</svg>`,
      animate: pieces.flatMap((p): SvgAnimation[] => [
        { id: `p${p.i}`, attrs: { opacity: [0, 1] }, ms: 50 },
        {
          id: `p${p.i}`,
          attrs: { transform: ["translate(100 110) rotate(0)", `translate(${100 + p.x} ${110 + p.y}) rotate(${p.spin})`] as [string, string] },
          ms: 600,
          ease: "out" as const,
        },
        {
          id: `p${p.i}`,
          attrs: {
            transform: [`translate(${100 + p.x} ${110 + p.y}) rotate(${p.spin})`, `translate(${100 + p.x * 1.2} ${180 + p.y * 0.2}) rotate(${p.spin * 2})`] as [string, string],
          },
          delay: 600,
          ms: 1000,
          ease: "in-out" as const,
        },
        { id: `p${p.i}`, attrs: { opacity: [1, 0] }, delay: 1300, ms: 300 },
      ]),
    };
  })(),
};


/** Where drip text's drips leave the letters (the word spans x 50–350, baseline 120). */
const DRIP_TOP = 106;
const DRIPS = [
  { x: 70, width: 11, length: 34, delay: 0, ms: 1500 },
  { x: 104, width: 8, length: 18, delay: 260, ms: 1100 },
  { x: 140, width: 13, length: 50, delay: 120, ms: 1800 },
  { x: 186, width: 9, length: 22, delay: 380, ms: 1200 },
  { x: 226, width: 10, length: 28, delay: 200, ms: 1400 },
  { x: 258, width: 12, length: 42, delay: 60, ms: 1700 },
  { x: 288, width: 11, length: 32, delay: 300, ms: 1500 },
];

export const dripText: VectorEffect = {
  kind: "vector",
  id: "drip-text",
  name: "Drip text",
  description: "A chunky outlined title popping in, then oozing slime drips from its letters.",
  category: "icon",
  tags: ["title", "text", "drip", "slime", "y2k", "headline"],
  hold: 1200,
  controls: [
    colorControl("fill", "#FF7EB6", "Fill"),
    colorControl("outline", "#3A0A2C", "Outline"),
    colorControl("shine", "#FFD1E6", "Shine"),
    numberControl("drip", 1, 0.2, 2, "Drip length"),
    numberControl("stroke", 7, 0, 14, "Outline width", 0.5),
  ],
  presets: [
    { name: "Slime", values: { fill: [0.55, 0.93, 0.25], outline: [0.06, 0.2, 0.04], shine: [0.85, 1, 0.7] } },
    { name: "Molten gold", values: { fill: [1, 0.78, 0.2], outline: [0.35, 0.16, 0], shine: [1, 0.96, 0.75], drip: 1.5 } },
  ],
  // Each drip's length and where its bulb ends up, scaled by the drip control.
  derived: (v) =>
    Object.fromEntries(
      DRIPS.flatMap((d, i) => {
        const length = Math.round(d.length * Number(v.drip) * 10) / 10;
        return [
          [`len${i}`, length],
          [`tip${i}`, DRIP_TOP + length],
        ];
      }),
    ),
  motion: (() => {
    // The word is pinned to 300 units wide (textLength), so drips sit under the same letters in any font.
    const word = `<text x="200" y="120" text-anchor="middle" textLength="300" lengthAdjust="spacingAndGlyphs" font-family="'Arial Black', Impact, system-ui, sans-serif" font-size="104" font-weight="900" stroke-linejoin="round"`;
    const drips = (layer: "o" | "f", paint: string) =>
      DRIPS.map(
        (d, i) =>
          `<rect id="${layer}r${i}" x="${d.x - d.width / 2}" y="${DRIP_TOP}" width="${d.width}" height="0" rx="${d.width / 2}" ${paint}/><circle id="${layer}c${i}" cx="${d.x}" cy="${DRIP_TOP}" r="${d.width * 0.72}" ${paint}/>`,
      ).join("");
    const outline = `fill="{{outline}}" stroke="{{outline}}" stroke-width="{{stroke}}"`;
    const pop = (from: number, to: number) =>
      [`translate(200 100) scale(${from}) translate(-200 -100)`, `translate(200 100) scale(${to}) translate(-200 -100)`] as [string, string];
    return {
      svg: `<svg viewBox="0 0 400 200"><g id="word" transform="${pop(0.6, 1)[0]}" opacity="0">${drips("o", outline)}${word} fill="none" stroke="{{outline}}" stroke-width="{{stroke}}">SLOP</text>${drips("f", `fill="{{fill}}"`)}${word} fill="{{fill}}">SLOP</text>${DRIPS.map(
        (d, i) => `<circle id="s${i}" cx="${d.x - d.width * 0.25}" cy="${DRIP_TOP}" r="${d.width * 0.2}" fill="{{shine}}" opacity="0"/>`,
      ).join("")}</g></svg>`,
      animate: [
        { id: "word", attrs: { transform: pop(0.6, 1.08), opacity: [0, 1] }, ms: 260, ease: "out" },
        { id: "word", attrs: { transform: pop(1.08, 1) }, delay: 260, ms: 200, ease: "in-out" },
        ...DRIPS.flatMap((d, i): SvgAnimation[] => {
          const at = { delay: 400 + d.delay, ms: d.ms, ease: "in-out" as const };
          const tip = `{{tip${i}}}` as unknown as number;
          return [
            ...(["o", "f"] as const).flatMap((layer): SvgAnimation[] => [
              { id: `${layer}r${i}`, attrs: { height: [0, `{{len${i}}}` as unknown as number] }, ...at },
              { id: `${layer}c${i}`, attrs: { cy: [DRIP_TOP, tip] }, ...at },
            ]),
            { id: `s${i}`, attrs: { cy: [DRIP_TOP, tip], opacity: [0, 0.9] }, ...at },
          ];
        }),
      ],
    };
  })(),
};

export const vectorEffects: VectorEffect[] = [
  spinner,
  bouncingDots,
  pulsePing,
  equalizer,
  progressRing,
  barChart,
  lineChart,
  statCounter,
  route,
  successCheck,
  errorCross,
  heartbeat,
  signature,
  confetti,
  blobMorph,
  dripText,
];
