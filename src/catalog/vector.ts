import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

export const spinner: VectorEffect = {
  kind: "vector",
  id: "spinner",
  name: "Spinner",
  description: "An arc chasing its tail: the classic indeterminate loader.",
  category: "loader",
  tags: ["loader", "ui", "minimal"],
  hold: 0,
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#6366F1 label='Arc'}} {{track: color default=#E5E7EB label='Track'}} {{width: float min=2 max=20 default=8 step=1 label='Stroke width'}} --><circle cx="50" cy="50" r="38" fill="none" stroke="{{track}}" stroke-width="{{width}}"/><g id="spin" transform="rotate(0 50 50)"><circle id="arc" cx="50" cy="50" r="38" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" pathLength="1" stroke-dasharray="0.25 1"/></g></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 120 60"><!-- {{accent: color default=#0EA5E9 label='Dots'}} {{height: float min=4 max=30 default=18 step=1 label='Bounce height'}} --><circle id="a" cx="30" cy="40" r="9" fill="{{accent}}"/><circle id="b" cx="60" cy="40" r="9" fill="{{accent}}"/><circle id="c" cx="90" cy="40" r="9" fill="{{accent}}"/></svg>`,
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
  category: "loader",
  tags: ["progress", "kpi", "dashboard", "loader"],
  derived: (v) => ({ fraction: Math.min(1, Math.max(0, Number(v.value) / 100)) }),
  motion: {
    svg: `<svg viewBox="0 0 120 120" font-family="system-ui, sans-serif"><!-- {{accent: color default=#22C55E label='Ring'}} {{track: color default=#E5E7EB label='Track'}} {{text: color default=#111827 label='Text'}} {{value: float min=0 max=100 default=72 step=1 label='Percent'}} --><circle cx="60" cy="60" r="48" fill="none" stroke="{{track}}" stroke-width="10"/><circle id="ring" cx="60" cy="60" r="48" fill="none" stroke="{{accent}}" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)"/><text id="label" x="60" y="68" text-anchor="middle" font-size="24" font-weight="700" fill="{{text}}">0%</text></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#EF4444 label='Colour'}} --><circle id="r1" cx="50" cy="50" r="8" fill="none" stroke="{{accent}}" stroke-width="3"/><circle id="r2" cx="50" cy="50" r="8" fill="none" stroke="{{accent}}" stroke-width="3"/><circle cx="50" cy="50" r="9" fill="{{accent}}"/></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#16A34A label='Colour'}} {{width: float min=2 max=12 default=6 step=1 label='Stroke width'}} --><g id="badge" transform="translate(50 50) scale(1) translate(-50 -50)"><circle id="circle" cx="50" cy="50" r="40" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" transform="rotate(-90 50 50)"/><path id="tick" d="M31 52 L44 64 L70 37" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#DC2626 label='Colour'}} {{width: float min=2 max=12 default=6 step=1 label='Stroke width'}} --><g id="badge" transform="translate(0 0)"><circle id="circle" cx="50" cy="50" r="40" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round" transform="rotate(-90 50 50)"/><path id="a" d="M36 36 L64 64" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round"/><path id="b" d="M64 36 L36 64" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round"/></g></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 200 120"><!-- {{accent: color default=#F43F5E label='Heart'}} {{line: color default=#94A3B8 label='Line'}} --><g id="heart" transform="translate(100 46) scale(1)"><path d="M0 22 C-30 0 -30 -26 -10 -26 C-3 -26 0 -20 0 -16 C0 -20 3 -26 10 -26 C30 -26 30 0 0 22Z" fill="{{accent}}"/></g><path id="ecg" d="M10 100 H70 L80 86 L90 112 L100 76 L110 104 L118 100 H190" fill="none" stroke="{{line}}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
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
    svg: `<svg viewBox="0 0 240 160" font-family="system-ui, sans-serif"><!-- {{accent: color default=#6366F1 label='Bars'}} {{text: color default=#334155 label='Text'}} {{a: float min=0 max=100 default=40 step=1 label='Bar 1'}} {{b: float min=0 max=100 default=65 step=1 label='Bar 2'}} {{c: float min=0 max=100 default=50 step=1 label='Bar 3'}} {{d: float min=0 max=100 default=90 step=1 label='Bar 4'}} --><line x1="20" y1="140" x2="220" y2="140" stroke="{{text}}" stroke-opacity="0.3" stroke-width="2"/>${["a", "b", "c", "d"]
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
  motion: {
    svg: `<svg viewBox="0 0 240 140"><!-- {{accent: color default=#0EA5E9 label='Line'}} {{grid: color default=#CBD5E1 label='Grid'}} --><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.35"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient></defs><g stroke="{{grid}}" stroke-width="1"><line x1="20" y1="30" x2="220" y2="30"/><line x1="20" y1="70" x2="220" y2="70"/><line x1="20" y1="110" x2="220" y2="110"/></g><path id="area" d="M20 110 L60 92 L100 98 L140 64 L180 70 L220 30 L220 120 L20 120Z" fill="url(#fill)" opacity="0"/><path id="trend" d="M20 110 L60 92 L100 98 L140 64 L180 70 L220 30" fill="none" stroke="{{accent}}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle id="marker" r="5" fill="#fff" stroke="{{accent}}" stroke-width="3"/></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 240 120" font-family="system-ui, sans-serif"><!-- {{accent: color default=#F59E0B label='Accent'}} {{text: color default=#0F172A label='Text'}} {{value: float min=0 max=100000 default=1250 step=1 label='Value'}} {{caption: text default='happy customers' label='Caption'}} --><text id="number" x="120" y="62" text-anchor="middle" font-size="44" font-weight="800" fill="{{text}}">0</text><path id="underline" d="M60 78 H180" stroke="{{accent}}" stroke-width="6" stroke-linecap="round"/><text id="caption" x="120" y="104" text-anchor="middle" font-size="13" fill="{{text}}" opacity="0">{{caption}}</text></svg>`,
    animate: [
      { id: "number", count: [0, "{{value}}"] as unknown as [number, number], ms: 1500, ease: "out" },
      { id: "underline", draw: true, delay: 300, ms: 900, ease: "in-out" },
      { id: "caption", attrs: { opacity: [0, 1], y: [112, 104] }, delay: 800, ms: 500, ease: "out" },
    ],
  },
};

export const timelineTrack: VectorEffect = {
  kind: "vector",
  id: "timeline-track",
  name: "Timeline track",
  description: "A vertical line drawing down with nodes popping along milestones.",
  category: "data",
  tags: ["timeline", "roadmap", "milestones", "history"],
  hold: 1200,
  motion: {
    svg: `<svg viewBox="0 0 100 400"><!-- {{track: color default=#E5E7EB label='Track'}} {{accent: color default=#F97316 label='Accent'}} {{width: float min=1 max=8 default=3 step=0.5 label='Line width'}} --><line x1="50" y1="20" x2="50" y2="380" stroke="{{track}}" stroke-width="{{width}}" stroke-linecap="round"/><path id="line" d="M50 20 L50 380" fill="none" stroke="{{accent}}" stroke-width="{{width}}" stroke-linecap="round"/><g id="n1" transform="translate(50 60) scale(0)"><circle r="8" fill="{{accent}}"/><circle r="4" fill="#ffffff"/></g><g id="n2" transform="translate(50 160) scale(0)"><circle r="8" fill="{{accent}}"/><circle r="4" fill="#ffffff"/></g><g id="n3" transform="translate(50 260) scale(0)"><circle r="8" fill="{{accent}}"/><circle r="4" fill="#ffffff"/></g><g id="n4" transform="translate(50 360) scale(0)"><circle r="8" fill="{{accent}}"/><circle r="4" fill="#ffffff"/></g></svg>`,
    animate: [
      { id: "line", draw: true, ms: 1400, ease: "in-out" },
      { id: "n1", attrs: { transform: ["translate(50 60) scale(0)", "translate(50 60) scale(1)"] }, delay: 200, ms: 250, ease: "out" },
      { id: "n2", attrs: { transform: ["translate(50 160) scale(0)", "translate(50 160) scale(1)"] }, delay: 550, ms: 250, ease: "out" },
      { id: "n3", attrs: { transform: ["translate(50 260) scale(0)", "translate(50 260) scale(1)"] }, delay: 900, ms: 250, ease: "out" },
      { id: "n4", attrs: { transform: ["translate(50 360) scale(0)", "translate(50 360) scale(1)"] }, delay: 1300, ms: 250, ease: "out" },
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
  motion: {
    svg: `<svg viewBox="0 0 240 150"><!-- {{accent: color default=#8B5CF6 label='Route'}} {{pin: color default=#0F172A label='Pins'}} --><path id="path" d="M30 120 C60 40 120 140 150 70 S210 30 210 30" fill="none" stroke="{{accent}}" stroke-width="4" stroke-linecap="round"/><circle cx="30" cy="120" r="7" fill="{{pin}}"/><g id="end" opacity="0"><circle cx="210" cy="30" r="9" fill="{{pin}}"/><circle cx="210" cy="30" r="3.5" fill="#fff"/></g><g id="traveller"><circle r="7" fill="{{accent}}"/><circle r="3" fill="#fff"/></g></svg>`,
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
  motion: (() => {
    const shapes = [
      "M100 30 C140 30 170 60 170 100 C170 140 140 170 100 170 C60 170 30 140 30 100 C30 60 60 30 100 30Z",
      "M100 20 C150 40 180 70 160 110 C140 160 120 175 85 165 C45 155 25 120 40 80 C55 40 70 15 100 20Z",
      "M110 35 C155 25 175 85 165 120 C155 160 105 180 70 160 C35 140 20 100 45 70 C65 45 80 40 110 35Z",
    ];
    const step = 1200;
    return {
      svg: `<svg viewBox="0 0 200 200"><!-- {{colorA: color default=#F472B6 label='Colour A'}} {{colorB: color default=#818CF8 label='Colour B'}} --><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{colorA}}"/><stop offset="1" stop-color="{{colorB}}"/></linearGradient></defs><path id="blob" d="${shapes[0]}" fill="url(#g)"/></svg>`,
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
  motion: {
    svg: `<svg viewBox="0 0 260 120"><!-- {{ink: color default=#1E293B label='Ink'}} {{width: float min=1 max=8 default=3 step=0.5 label='Pen width'}} --><path id="sig" d="M20 80 C40 20 60 20 55 70 C52 95 70 95 85 60 C95 40 100 75 110 70 C120 65 125 40 135 55 C145 70 150 75 165 50 C175 35 185 60 190 65 C200 75 215 40 240 45" fill="none" stroke="{{ink}}" stroke-width="{{width}}" stroke-linecap="round" stroke-linejoin="round"/><path id="dash" d="M70 100 Q140 92 220 98" fill="none" stroke="{{ink}}" stroke-width="{{width}}" stroke-linecap="round"/></svg>`,
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
      svg: `<svg viewBox="0 0 100 100"><!-- {{accent: color default=#10B981 label='Bars'}} -->${heights
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
      svg: `<svg viewBox="0 0 200 200"><!-- {{a: color default=#F43F5E label='Colour A'}} {{b: color default=#FACC15 label='Colour B'}} {{c: color default=#22D3EE label='Colour C'}} -->${pieces
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


/** Flow network's nodes and links, left to right, with the critical path through them. */
const NODES: Record<string, [number, number]> = {
  s: [40, 120], a: [120, 60], b: [120, 180], c: [280, 50], d: [290, 130], e: [280, 200], t: [360, 120],
};
const HUB: [number, number] = [200, 120];
const link = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
};
const LINKS: { from: [number, number]; to: [number, number]; column: number }[] = [
  { from: NODES.s!, to: NODES.a!, column: 0 },
  { from: NODES.s!, to: NODES.b!, column: 0 },
  { from: NODES.a!, to: HUB, column: 1 },
  { from: NODES.b!, to: HUB, column: 1 },
  { from: HUB, to: NODES.c!, column: 2 },
  { from: HUB, to: NODES.d!, column: 2 },
  { from: HUB, to: NODES.e!, column: 2 },
  { from: NODES.c!, to: NODES.t!, column: 3 },
  { from: NODES.d!, to: NODES.t!, column: 3 },
  { from: NODES.e!, to: NODES.t!, column: 3 },
];
const CRITICAL = [NODES.s!, NODES.b!, HUB, NODES.c!, NODES.t!]
  .map((p, i, all) => (i === 0 ? "" : link(all[i - 1]!, p).replace(/^M[\d.]+ [\d.]+ /, i === 1 ? `M${all[0]![0]} ${all[0]![1]} ` : "")))
  .filter(Boolean)
  .join(" ");
/** The column a node is reached in, so it appears as the links arrive. */
const NODE_COLUMN: Record<string, number> = { s: 0, a: 1, b: 1, c: 3, d: 3, e: 3, t: 4 };
const COLUMN_MS = 280;
const PATH_START = 1500;
const PATH_MS = 1800;

export const flowNetwork: VectorEffect = {
  kind: "vector",
  id: "flow-network",
  name: "Flow network",
  description: "A node graph linking up, then a glowing critical path racing through it to a pulsing hub.",
  category: "data",
  tags: ["network", "graph", "dag", "workflow", "tech", "explainer"],
  hold: 1200,
  presets: [
    { name: "Light", values: { background: [0.93, 0.95, 0.96], link: [0.37, 0.72, 0.69], path: [0.96, 0.62, 0.04], ink: [0.2, 0.25, 0.33] } },
    { name: "Neon", values: { background: [0.04, 0.02, 0.1], link: [0.13, 0.83, 0.93], path: [0.96, 0.45, 0.71], ink: [0.85, 0.85, 1] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 400 240" font-family="system-ui, sans-serif"><!-- {{label: text default='Critical path' label='Hub label'}} {{background: color default=#0B1220 label='Background'}} {{link: color default=#4FD1C5 label='Links'}} {{path: color default=#F5A524 label='Critical path'}} {{ink: color default=#CBD5E1 label='Label'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="400" height="240" fill="{{background}}"/>${LINKS.map(
      (l, i) => `<path id="l${i}" d="${link(l.from, l.to)}" fill="none" stroke="{{link}}" stroke-width="1.6" stroke-opacity="0.75" filter="url(#glow)"/>`,
    ).join("")}<path id="crit" d="${CRITICAL}" fill="none" stroke="{{path}}" stroke-width="3" stroke-linecap="round" filter="url(#glow)"/>${[0, 1]
      .map((i) => `<circle id="ring${i}" cx="${HUB[0]}" cy="${HUB[1]}" r="10" fill="none" stroke="{{link}}" stroke-width="2" opacity="0"/>`)
      .join("")}${Object.entries(NODES)
      .map(([id, [x, y]]) => `<circle id="n${id}" cx="${x}" cy="${y}" r="6" fill="{{background}}" stroke="{{link}}" stroke-width="2.5" filter="url(#glow)" opacity="0"/>`)
      .join("")}<g id="hub" opacity="0"><circle cx="${HUB[0]}" cy="${HUB[1]}" r="13" fill="{{link}}" fill-opacity="0.25" stroke="{{link}}" stroke-width="2" filter="url(#glow)"/><circle cx="${HUB[0]}" cy="${HUB[1]}" r="6" fill="{{link}}"/></g><text id="caption" x="${HUB[0]}" y="${HUB[1] + 34}" text-anchor="middle" font-size="12" font-weight="600" fill="{{ink}}" opacity="0">{{label}}</text>${[0, 1, 2]
      .map((i) => `<circle id="pkt${i}" r="2.5" fill="{{link}}" filter="url(#glow)" opacity="0"/>`)
      .join("")}<circle id="comet" r="5" fill="#FFFFFF" stroke="{{path}}" stroke-width="2" filter="url(#glow)" opacity="0"/></svg>`,
    animate: [
      ...LINKS.map((l, i): SvgAnimation => ({ id: `l${i}`, draw: true, delay: l.column * COLUMN_MS, ms: 500, ease: "out" })),
      ...Object.keys(NODES).map((id): SvgAnimation => ({ id: `n${id}`, attrs: { opacity: [0, 1] }, delay: Math.max(0, NODE_COLUMN[id]! * COLUMN_MS - 120), ms: 250 })),
      { id: "hub", attrs: { opacity: [0, 1] }, delay: 2 * COLUMN_MS - 120, ms: 300 },
      { id: "caption", attrs: { opacity: [0, 1], y: [HUB[1] + 40, HUB[1] + 34] }, delay: 2 * COLUMN_MS, ms: 400, ease: "out" },
      // Data packets drift along a few links while the path waits.
      ...[3, 5, 8].map((link, i): SvgAnimation[] => [
        { id: `pkt${i}`, attrs: { opacity: [0, 1] }, delay: 1000 + i * 150, ms: 150 },
        { id: `pkt${i}`, along: `l${link}`, delay: 1000 + i * 150, ms: 1100, ease: "in-out" },
        { id: `pkt${i}`, attrs: { opacity: [1, 0] }, delay: 2000 + i * 150, ms: 200 },
      ]).flat(),
      { id: "crit", draw: true, delay: PATH_START, ms: PATH_MS, ease: "in-out" },
      { id: "comet", attrs: { opacity: [0, 1] }, delay: PATH_START, ms: 150 },
      { id: "comet", along: "crit", delay: PATH_START, ms: PATH_MS, ease: "in-out" },
      { id: "comet", attrs: { opacity: [1, 0] }, delay: PATH_START + PATH_MS, ms: 300 },
      // Rings pulse out from the hub as the comet passes it, halfway along.
      ...[0, 1].map((i): SvgAnimation => ({
        id: `ring${i}`,
        attrs: { r: [10, 52], opacity: [0.9, 0], "stroke-width": [3, 0.5] },
        delay: PATH_START + PATH_MS / 2 + i * 350,
        ms: 1200,
        ease: "out",
      })),
    ],
  },
};

/** Drip text's word: its baseline, size, and cap height (a heavy sans's, about 0.72 of its size). */
const DRIP_BASELINE = 120;
const DRIP_SIZE = 104;
const DRIP_CAP = 75;
/** Drip text's drips: where each leaves the word, as a fraction of its run of the word, and how it runs. */
const DRIP_TOP = 106;
const DRIPS = [
  { at: 0.067, width: 11, length: 34, delay: 0, ms: 1500 },
  { at: 0.18, width: 8, length: 18, delay: 260, ms: 1100 },
  { at: 0.3, width: 13, length: 50, delay: 120, ms: 1800 },
  { at: 0.453, width: 9, length: 22, delay: 380, ms: 1200 },
  { at: 0.587, width: 10, length: 28, delay: 200, ms: 1400 },
  { at: 0.693, width: 12, length: 42, delay: 60, ms: 1700 },
  { at: 0.793, width: 11, length: 32, delay: 300, ms: 1500 },
];
/**
 * The drips repeat along a long word, one run of them every `DRIP_RUN`
 * units (about four letters), up to `DRIP_RUNS` runs; past that the runs
 * spread out.
 */
const DRIP_RUN = 300;
const DRIP_RUNS = 8;
const DRIP_SLOTS = Array.from({ length: DRIP_RUNS }, (_, run) => DRIPS.map((d, k) => ({ ...d, i: run * DRIPS.length + k, run, delay: d.delay + run * 90 }))).flat();

/**
 * Drip text. The word keeps its letters' shapes at any length: on its own
 * stage a long word is scaled down to fit, and with `inline` on the picture
 * widens with it instead. Inline, it frames the word from cap height to
 * baseline and lets the rest spill out (by its `data-overhang`, see
 * `svgInlineLayout`), so in a heading it sits on the baseline without adding
 * leading: give its container `display: inline-block; height: 0.72em` and
 * the viewBox's aspect ratio. A `font` of `inherit` takes the surrounding
 * text's, and colours take `currentColor`.
 */
export const dripText: VectorEffect = {
  kind: "vector",
  id: "drip-text",
  name: "Drip text",
  description: "A chunky outlined title popping in, then oozing slime drips from its letters; Inline sets it in a line of text.",
  category: "text",
  tags: ["title", "text", "drip", "slime", "y2k", "headline"],
  hold: 1200,
  presets: [
    { name: "Slime", values: { fill: [0.55, 0.93, 0.25], outline: [0.06, 0.2, 0.04], shine: [0.85, 1, 0.7] } },
    { name: "Molten gold", values: { fill: [1, 0.78, 0.2], outline: [0.35, 0.16, 0], shine: [1, 0.96, 0.75], drip: 1.5 } },
  ],
  // The word is drawn at its own width (textLength from its estimated width), so the drips land under its letters in any font.
  derived: (v) => {
    const width = Math.round(Math.max(0.6, textWidthEm(String(v.word).trim())) * DRIP_SIZE);
    const left = 200 - width / 2;
    const runs = Math.min(DRIP_RUNS, Math.max(1, Math.round(width / DRIP_RUN)));
    const run = width / runs;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    // At rest: the longest drip's tip below the baseline, and the outline's half width all round, in ems.
    const edge = Number(v.stroke) / 2 / DRIP_SIZE;
    const tip = (DRIP_TOP + Math.max(...DRIPS.map((d) => d.length)) * Number(v.drip) + 13 * 0.72 - DRIP_BASELINE) / DRIP_SIZE;
    const overhang = [edge, edge, Math.max(0.05, tip) + edge, edge].map((e) => Math.round(e * 100) / 100).join(" ");
    return {
      width,
      fit: v.inline ? 1 : Math.round(Math.min(1, 380 / width) * 1000) / 1000,
      // Inline, the picture frames just the word's capitals, from cap height to baseline, so it sits on
      // the line like a letter would; the pop, outline and drips spill out over the text around it.
      viewBox: v.inline ? `${left} ${DRIP_BASELINE - DRIP_CAP} ${width} ${DRIP_CAP}` : "0 0 400 200",
      overflow: v.inline ? "visible" : "hidden",
      overhang,
      ...Object.fromEntries(
        DRIP_SLOTS.flatMap((d) => {
          const x = r1(left + (d.run + d.at) * run);
          const length = r1(d.length * Number(v.drip));
          return [
            [`show${d.i}`, d.run < runs ? "inline" : "none"],
            [`x${d.i}`, x],
            [`left${d.i}`, r1(x - d.width / 2)],
            [`shine${d.i}`, r1(x - d.width * 0.25)],
            [`len${d.i}`, length],
            [`tip${d.i}`, r1(DRIP_TOP + length)],
          ];
        }),
      ),
    };
  },
  motion: (() => {
    const word = `<text x="200" y="${DRIP_BASELINE}" text-anchor="middle" textLength="{{width}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="${DRIP_SIZE}" font-weight="{{weight}}" stroke-linejoin="round"`;
    const drips = (layer: "o" | "f", paint: string) =>
      DRIP_SLOTS.map(
        (d) =>
          `<g display="{{show${d.i}}}"><rect id="${layer}r${d.i}" x="{{left${d.i}}}" y="${DRIP_TOP}" width="${d.width}" height="0" rx="${d.width / 2}" ${paint}/><circle id="${layer}c${d.i}" cx="{{x${d.i}}}" cy="${DRIP_TOP}" r="${d.width * 0.72}" ${paint}/></g>`,
      ).join("");
    const outline = `fill="{{outline}}" stroke="{{outline}}" stroke-width="{{stroke}}"`;
    const pop = (from: number, to: number) =>
      [`translate(200 100) scale(${from}) translate(-200 -100)`, `translate(200 100) scale(${to}) translate(-200 -100)`] as [string, string];
    return {
      svg: `<svg viewBox="{{viewBox}}" overflow="{{overflow}}" data-overhang="{{overhang}}"><!-- {{word: text default=SLOP label='Word'}} {{font: text default='Arial Black, Impact, system-ui, sans-serif' label='Font'}} {{weight: int min=100 max=900 default=900 step=100 label='Weight'}} {{fill: color default=#FF7EB6 label='Fill'}} {{outline: color default=#3A0A2C label='Outline'}} {{shine: color default=#FFD1E6 label='Shine'}} {{drip: float min=0.2 max=2 default=1 label='Drip length'}} {{stroke: float min=0 max=14 default=7 step=0.5 label='Outline width'}} {{inline: bool default=false label='Inline'}} --><g transform="translate(200 100) scale({{fit}}) translate(-200 -100)"><g id="word" transform="${pop(0.6, 1)[0]}" opacity="0">${drips("o", outline)}${word} fill="none" stroke="{{outline}}" stroke-width="{{stroke}}">{{word}}</text>${drips("f", `fill="{{fill}}"`)}${word} fill="{{fill}}">{{word}}</text>${DRIP_SLOTS.map(
        (d) => `<circle id="s${d.i}" display="{{show${d.i}}}" cx="{{shine${d.i}}}" cy="${DRIP_TOP}" r="${d.width * 0.2}" fill="{{shine}}" opacity="0"/>`,
      ).join("")}</g></g></svg>`,
      animate: [
        { id: "word", attrs: { transform: pop(0.6, 1.08), opacity: [0, 1] }, ms: 260, ease: "out" },
        { id: "word", attrs: { transform: pop(1.08, 1) }, delay: 260, ms: 200, ease: "in-out" },
        ...DRIP_SLOTS.flatMap((d): SvgAnimation[] => {
          const at = { delay: 400 + d.delay, ms: d.ms, ease: "in-out" as const };
          const tip = `{{tip${d.i}}}` as unknown as number;
          return [
            ...(["o", "f"] as const).flatMap((layer): SvgAnimation[] => [
              { id: `${layer}r${d.i}`, attrs: { height: [0, `{{len${d.i}}}` as unknown as number] }, ...at },
              { id: `${layer}c${d.i}`, attrs: { cy: [DRIP_TOP, tip] }, ...at },
            ]),
            { id: `s${d.i}`, attrs: { cy: [DRIP_TOP, tip], opacity: [0, 0.9] }, ...at },
          ];
        }),
      ],
    };
  })(),
};

/** Viewfinder's timecode runs this many seconds (at 25 fps) before it loops back to zero. */
const VIEWFINDER_SECONDS = 10;

export const viewfinder: VectorEffect = {
  kind: "vector",
  id: "viewfinder",
  name: "Viewfinder",
  description: "A camera viewfinder over the picture: corner brackets, a blinking REC light and a running timecode.",
  category: "overlay",
  tags: ["overlay", "camera", "recording", "vlog", "frame"],
  hold: 0,
  presets: [
    { name: "Night vision", values: { color: [0.45, 1, 0.45], rec: [0.45, 1, 0.45] } },
    { name: "Live", values: { label: "LIVE", timecode: false } },
  ],
  derived: (v) => ({ timecodeOpacity: v.timecode ? 1 : 0 }),
  motion: {
    svg: `<svg viewBox="0 0 320 180" font-family="ui-monospace, Menlo, Consolas, monospace"><!-- {{color: color default=#FFFFFF label='Frame'}} {{rec: color default=#EF4444 label='Record light'}} {{timecode: bool default=true label='Timecode'}} --><g fill="none" stroke="{{color}}" stroke-width="2.5" stroke-linecap="square"><path d="M16 42 V16 H42"/><path d="M278 16 H304 V42"/><path d="M304 138 V164 H278"/><path d="M42 164 H16 V138"/><path d="M154 90 H166 M160 84 V96" stroke-width="1.5" opacity="0.8"/></g><circle id="dot" cx="34" cy="33" r="4.5" fill="{{rec}}"/><text x="44" y="37.5" font-size="12" font-weight="700" fill="{{color}}">{{label: text default=REC label='Label'}}</text><text x="296" y="37.5" text-anchor="end" font-size="12" fill="{{color}}" opacity="{{timecodeOpacity}}">00:00:<tspan id="sec">00</tspan>:<tspan id="ff">00</tspan></text></svg>`,
    animate: Array.from({ length: VIEWFINDER_SECONDS }, (_, s): SvgAnimation[] => [
      { id: "sec", count: [s, s], format: s < 10 ? "0{n}" : "{n}", delay: s * 1000, ms: 1 },
      // Frames 00–24: the single digits padded with a zero, then the rest.
      { id: "ff", count: [0, 9.49], format: "0{n}", delay: s * 1000, ms: 400, ease: "linear" },
      { id: "ff", count: [10, 24.49], format: "{n}", delay: s * 1000 + 400, ms: 600, ease: "linear" },
      { id: "dot", attrs: { opacity: [0, 1] }, delay: s * 1000, ms: 1 },
      { id: "dot", attrs: { opacity: [1, 0] }, delay: s * 1000 + 600, ms: 1 },
    ]).flat(),
  },
};

/** Upload card's picture box, the done badge on its corner, and how long the done state shows. */
const UPLOAD_IMAGE = { x: 40, y: 32, w: 160, h: 96 };
const UPLOAD_BADGE: [number, number] = [184, 48];
const UPLOAD_SHOW = 1900;
const uploadAbout = (cx: number, cy: number, s: number) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
/** A derived number in an animation's numeric field. */
const num = (name: string) => `{{${name}}}` as unknown as number;

export const uploadCard: VectorEffect = {
  kind: "vector",
  id: "upload-card",
  name: "Upload card",
  description: "An image upload card whose progress bar fills as the percentage counts to 100%, then the placeholder cross-fades into the finished picture with a check, and resets.",
  category: "loader",
  tags: ["upload", "progress", "image", "file", "ui", "loader"],
  hold: 300,
  presets: [
    { name: "Dark", values: { card: [0.09, 0.11, 0.15], ink: [0.95, 0.96, 0.97], accent: [0.55, 0.36, 0.96] } },
    { name: "Ocean", values: { label: "beach-day.png", accent: [0.02, 0.6, 0.75] } },
  ],
  derived: (v) => {
    const e = Math.max(0.6, textWidthEm(String(v.label)));
    const size = Math.round(Math.min(13, 112 / e) * 10) / 10;
    const up = Math.round(Math.min(6, Math.max(0.5, Number(v.duration) || 2.2)) * 1000);
    const back = up + UPLOAD_SHOW;
    return { size, length: Math.round(e * size * 10) / 10, up, swap: up + 80, pop: up + 300, popped: up + 500, tickAt: up + 420, back, hidden: back + 300, shown: back + 350 };
  },
  motion: ((): SvgMotion => {
    const { x, y, w, h } = UPLOAD_IMAGE;
    const [bx, by] = UPLOAD_BADGE;
    const mid = [x + w / 2, y + h / 2] as const;
    return {
      svg: `<svg viewBox="0 0 240 200"><!-- {{label: text default='mountains.jpg' label='File name'}} {{duration: float min=0.5 max=6 default=2.2 step=0.1 label='Upload time (s)'}} {{card: color default=#FFFFFF label='Card'}} {{accent: color default=#6366F1 label='Accent'}} {{ink: color default=#111827 label='Text colour'}} --><defs><filter id="cardShadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="6"/></filter><clipPath id="imageClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/></clipPath><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.45"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0.1"/></linearGradient></defs><rect x="24" y="22" width="192" height="168" rx="16" fill="#000000" opacity="0.14" filter="url(#cardShadow)"/><rect x="24" y="16" width="192" height="168" rx="16" fill="{{card}}" stroke="{{ink}}" stroke-opacity="0.08"/><g id="placeholder"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="{{ink}}" fill-opacity="0.05" stroke="{{ink}}" stroke-opacity="0.18" stroke-width="1.5" stroke-dasharray="5 4"/><g fill="none" stroke="{{ink}}" stroke-opacity="0.4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="142" cy="64" r="7"/><path d="M84 104 L104 80 L118 95 L128 86 L156 104 Z"/></g></g><g id="picture" opacity="0" transform="${uploadAbout(mid[0], mid[1], 1.06)}" clip-path="url(#imageClip)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="{{card}}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/><circle cx="150" cy="60" r="11" fill="#FDE68A"/><path d="M40 128 L40 110 L82 74 L114 102 L146 80 L200 116 L200 128 Z" fill="{{accent}}" fill-opacity="0.55"/><path d="M40 128 L40 118 Q90 96 138 110 T200 106 L200 128 Z" fill="{{accent}}"/></g><g id="badge" transform="${uploadAbout(bx, by, 0)}"><circle cx="${bx}" cy="${by}" r="11" fill="{{accent}}" stroke="{{card}}" stroke-width="3"/><path id="tick" d="M${bx - 5} ${by + 0.5} L${bx - 1.5} ${by + 4} L${bx + 5} ${by - 3.5}" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g><text x="${x}" y="152" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="{{size}}" font-weight="600" fill="{{ink}}">{{label}}</text><text id="pct" x="${x + w}" y="152" text-anchor="end" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="12" font-weight="500" fill="{{ink}}" fill-opacity="0.6">0%</text><rect x="${x}" y="162" width="${w}" height="6" rx="3" fill="{{ink}}" fill-opacity="0.1"/><rect id="bar" x="${x}" y="162" width="0" height="6" rx="3" fill="{{accent}}"/></svg>`,
      animate: [
        // Uploading: the bar and the percentage climb together.
        { id: "bar", attrs: { width: [0, w] }, ms: num("up"), ease: "in-out" },
        { id: "pct", count: [0, 100], format: "{n}%", ms: num("up"), ease: "in-out" },
        // Done: the placeholder gives way to the picture, settling as it fades in, and a check pops on.
        { id: "placeholder", attrs: { opacity: [1, 0] }, delay: num("swap"), ms: 360 },
        { id: "picture", attrs: { opacity: [0, 1] }, delay: num("swap"), ms: 420 },
        { id: "picture", attrs: { transform: [uploadAbout(mid[0], mid[1], 1.06), uploadAbout(mid[0], mid[1], 1)] }, delay: num("swap"), ms: 600, ease: "out" },
        { id: "badge", attrs: { transform: [uploadAbout(bx, by, 0), uploadAbout(bx, by, 1.2)] }, delay: num("pop"), ms: 200, ease: "out" },
        { id: "badge", attrs: { transform: [uploadAbout(bx, by, 1.2), uploadAbout(bx, by, 1)] }, delay: num("popped"), ms: 160, ease: "in-out" },
        { id: "tick", attrs: { opacity: [0, 1] }, delay: num("tickAt"), ms: 40 },
        { id: "tick", draw: true, delay: num("tickAt"), ms: 260, ease: "out" },
        // Reset: back to the empty placeholder, the bar and count fading out and back in at zero.
        { id: "picture", attrs: { opacity: [1, 0] }, delay: num("back"), ms: 360 },
        { id: "placeholder", attrs: { opacity: [0, 1] }, delay: num("back"), ms: 360 },
        { id: "badge", attrs: { transform: [uploadAbout(bx, by, 1), uploadAbout(bx, by, 0)] }, delay: num("back"), ms: 220, ease: "in-out" },
        { id: "tick", attrs: { opacity: [1, 0] }, delay: num("back"), ms: 120 },
        { id: "tick", draw: [0, 0], delay: num("hidden"), ms: 0 },
        { id: "picture", attrs: { transform: [uploadAbout(mid[0], mid[1], 1.06), uploadAbout(mid[0], mid[1], 1.06)] }, delay: num("hidden"), ms: 0 },
        { id: "bar", attrs: { opacity: [1, 0] }, delay: num("back"), ms: 250 },
        { id: "pct", attrs: { opacity: [1, 0] }, delay: num("back"), ms: 250 },
        { id: "bar", attrs: { width: [0, 0] }, delay: num("hidden"), ms: 0 },
        { id: "pct", count: [0, 0], format: "{n}%", delay: num("hidden"), ms: 0 },
        { id: "bar", attrs: { opacity: [0, 1] }, delay: num("shown"), ms: 250 },
        { id: "pct", attrs: { opacity: [0, 1] }, delay: num("shown"), ms: 250 },
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
  timelineTrack,
  successCheck,
  errorCross,
  heartbeat,
  signature,
  confetti,
  blobMorph,
  dripText,
  flowNetwork,
  viewfinder,
  uploadCard,
];
