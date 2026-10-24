import type { SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`ms`, `delay`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

/** A transform scaling by `s` about (`cx`, `cy`). */
const about = (cx: number, cy: number, s: number) => `translate(${r1(cx)} ${r1(cy)}) scale(${r2(s)}) translate(${r1(-cx)} ${r1(-cy)})`;

/** Instant change: the attribute snaps to `value` at `delay` (resets of hidden elements, so a loop starts clean). */
const snap = (id: string, attr: string, value: string | number, delay: number): SvgAnimation => ({ id, attrs: { [attr]: [value, value] }, delay, ms: 0 });

const SANS = `system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

/** Chat bubble: the sent bubble's right edge, top, and the reply's left edge (viewBox units). */
const RIGHT = 372;
const TOP = 34;
const REPLY_X = 28;
/** Typing dots: bounces and the time between them. */
const BOUNCES = 4;
const BOUNCE_MS = 900;
const DOTS = 3;

export const chatBubble: VectorEffect = {
  kind: "vector",
  id: "chat-bubble",
  name: "Chat bubble",
  description: "A chat message bubble popping in with an overshoot and its text typing in, then a reply bubble with bouncing typing dots.",
  category: "bubble",
  tags: ["bubble", "chat", "message", "ui", "typing", "speech", "text"],
  hold: 700,
  presets: [
    { name: "Green", values: { bubble: [0.15, 0.75, 0.4], ink: [1, 1, 1] } },
    { name: "Dark", values: { background: [0.07, 0.08, 0.11], bubble: [0.45, 0.4, 1], reply: [0.17, 0.18, 0.23], dots: [0.65, 0.67, 0.75] } },
    { name: "Short", values: { text: "On my way! 🚀", pace: 70 } },
  ],
  derived: (v) => {
    const text = String(v.text);
    const e = Math.max(0.6, textWidthEm(text));
    const size = r1(Math.min(22, 290 / e));
    const width = r1(Math.max(58, e * size + 38));
    const height = r1(size + 30);
    const left = r1(RIGHT - width);
    const bottom = r1(TOP + height);
    const typing = Math.max(1, Math.round(Array.from(text).length * Number(v.pace)));
    const reply = 350 + typing + 450;
    const replyTop = r1(bottom + 22);
    const replyBottom = r1(replyTop + 44);
    const dotY = r1(replyTop + 22);
    const sent = (s: number) => about(RIGHT, bottom, s);
    const back = (s: number) => about(REPLY_X, replyBottom, s);
    return {
      size,
      left,
      width,
      height,
      bottom,
      textX: r1(left + 19),
      textY: r1(TOP + height / 2 + size * 0.35),
      rx: r1(Math.min(height / 2, 20)),
      tail: `M${r1(RIGHT - 20)} ${r1(bottom - 12)} C${r1(RIGHT - 16)} ${r1(bottom - 2)} ${r1(RIGHT - 8)} ${r1(bottom + 4)} ${r1(RIGHT + 6)} ${r1(bottom + 4)} C${r1(RIGHT - 2)} ${r1(bottom - 1)} ${r1(RIGHT - 3)} ${r1(bottom - 8)} ${r1(RIGHT - 3)} ${r1(bottom - 16)}Z`,
      replyTop,
      replyTail: `M${REPLY_X + 20} ${r1(replyBottom - 12)} C${REPLY_X + 16} ${r1(replyBottom - 2)} ${REPLY_X + 8} ${r1(replyBottom + 4)} ${REPLY_X - 6} ${r1(replyBottom + 4)} C${REPLY_X + 2} ${r1(replyBottom - 1)} ${REPLY_X + 3} ${r1(replyBottom - 8)} ${REPLY_X + 3} ${r1(replyBottom - 16)}Z`,
      dotY,
      dotUp: r1(dotY - 6),
      typing,
      sent0: sent(0),
      sent1: sent(1),
      sentOver: sent(1.12),
      sentUnder: sent(0.95),
      reply0: back(0),
      reply1: back(1),
      replyOver: back(1.12),
      replyUnder: back(0.95),
      ...Object.fromEntries([0, 220, 340].map((k) => [`replyAt${k}`, reply + k])),
      ...Object.fromEntries(
        Array.from({ length: BOUNCES * DOTS }, (_, i) => {
          const [k, j] = [Math.floor(i / DOTS), i % DOTS];
          const at = reply + 450 + k * BOUNCE_MS + j * 150;
          return [
            [`rise${k}_${j}`, at],
            [`fall${k}_${j}`, at + 180],
          ];
        }).flat(),
      ),
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 400 200"><!-- {{text: text default='Hey! Are we still on for tonight?' label='Message'}} {{pace: float min=15 max=200 default=45 step=5 label='Ms per letter'}} {{background: color default=#FFFFFF label='Background'}} {{bubble: color default=#3B82F6 label='Bubble'}} {{ink: color default=#FFFFFF label='Text colour'}} {{reply: color default=#E5E7EB label='Reply bubble'}} {{dots: color default=#6B7280 label='Typing dots'}} --><rect width="400" height="200" fill="{{background}}"/><g id="sent" transform="{{sent0}}"><path d="{{tail}}" fill="{{bubble}}"/><rect x="{{left}}" y="${TOP}" width="{{width}}" height="{{height}}" rx="{{rx}}" fill="{{bubble}}"/><text id="msg" x="{{textX}}" y="{{textY}}" font-family="${SANS}" font-size="{{size}}" font-weight="500" fill="{{ink}}" xml:space="preserve">{{text}}</text></g><g id="reply" transform="{{reply0}}"><path d="{{replyTail}}" fill="{{reply}}"/><rect x="${REPLY_X}" y="{{replyTop}}" width="86" height="44" rx="22" fill="{{reply}}"/>${Array.from(
      { length: DOTS },
      (_, j) => `<circle id="dot${j}" cx="${REPLY_X + 22 + j * 21}" cy="{{dotY}}" r="5" fill="{{dots}}" opacity="0.45"/>`,
    ).join("")}</g></svg>`,
    animate: [
      { id: "sent", attrs: { transform: ["{{sent0}}", "{{sentOver}}"] }, ms: 220, ease: "out" },
      { id: "sent", attrs: { transform: ["{{sentOver}}", "{{sentUnder}}"] }, delay: 220, ms: 120, ease: "in-out" },
      { id: "sent", attrs: { transform: ["{{sentUnder}}", "{{sent1}}"] }, delay: 340, ms: 140, ease: "in-out" },
      { id: "msg", write: "{{text}}", delay: 350, ms: n("typing"), ease: "linear" },
      { id: "reply", attrs: { transform: ["{{reply0}}", "{{replyOver}}"] }, delay: n("replyAt0"), ms: 220, ease: "out" },
      { id: "reply", attrs: { transform: ["{{replyOver}}", "{{replyUnder}}"] }, delay: n("replyAt220"), ms: 120, ease: "in-out" },
      { id: "reply", attrs: { transform: ["{{replyUnder}}", "{{reply1}}"] }, delay: n("replyAt340"), ms: 140, ease: "in-out" },
      // The typing dots bounce one after another, brightening as they rise.
      ...Array.from({ length: BOUNCES * DOTS }, (_, i): SvgAnimation[] => {
        const [k, j] = [Math.floor(i / DOTS), i % DOTS];
        const id = `dot${j}`;
        return [
          { id, attrs: { cy: ["{{dotY}}", "{{dotUp}}"], opacity: [0.45, 1] }, delay: n(`rise${k}_${j}`), ms: 180, ease: "out" },
          { id, attrs: { cy: ["{{dotUp}}", "{{dotY}}"], opacity: [1, 0.45] }, delay: n(`fall${k}_${j}`), ms: 260, ease: "in-out" },
        ];
      }).flat(),
    ],
  },
};

/** Bubble pop loader: the bubbles' centres, radius and droplets per bubble. */
const LOADER_X = [45, 95, 145, 195];
const LOADER_Y = 40;
const LOADER_R = 14;
const DROPS = 6;
const LOADER_STAGGER = 300;
const POP_AT = 800;
const LOADER_END = (LOADER_X.length - 1) * LOADER_STAGGER + POP_AT + 600;

export const bubblePopLoader: VectorEffect = {
  kind: "vector",
  id: "bubble-pop-loader",
  name: "Bubble pop loader",
  description: "A loader of four bubbles inflating in turn and popping into droplets, over and over.",
  category: "loader",
  tags: ["bubble", "loader", "loading", "spinner", "ui", "playful"],
  hold: 120,
  presets: [
    { name: "Mint", values: { color: [0.2, 0.8, 0.65], accent: [0.55, 0.95, 0.85] } },
    { name: "Dark", values: { background: [0.07, 0.08, 0.11], color: [0.55, 0.6, 1], accent: [1, 0.55, 0.85] } },
    { name: "Candy", values: { color: [1, 0.4, 0.65], accent: [1, 0.8, 0.3], width: 3 } },
  ],
  motion: (() => {
    const drop = (i: number, k: number, r: number) => {
      const a = ((k + 0.5) / DROPS) * Math.PI * 2;
      return [r1(LOADER_X[i]! + r * Math.cos(a)), r1(LOADER_Y + r * Math.sin(a))] as const;
    };
    const pose = (i: number) => (s: number) => about(LOADER_X[i]!, LOADER_Y, s);
    const bubbles = LOADER_X.map(
      (x, i) =>
        `<circle id="ring${i}" cx="${x}" cy="${LOADER_Y}" r="${LOADER_R}" fill="none" stroke="{{color}}" stroke-width="0"/>${Array.from({ length: DROPS }, (_, k) => {
          const [dx, dy] = drop(i, k, LOADER_R);
          return `<circle id="d${i}_${k}" cx="${dx}" cy="${dy}" r="0" fill="${k % 2 ? "{{accent}}" : "{{color}}"}"/>`;
        }).join(
          "",
        )}<g id="b${i}" transform="${pose(i)(0)}"><circle cx="${x}" cy="${LOADER_Y}" r="${LOADER_R}" fill="{{color}}" fill-opacity="0.22" stroke="{{color}}" stroke-width="{{width}}"/><ellipse cx="${x - 5}" cy="${LOADER_Y - 5}" rx="4" ry="2.6" fill="#FFFFFF" opacity="0.85" transform="rotate(-35 ${x - 5} ${LOADER_Y - 5})"/></g>`,
    ).join("");
    return {
      svg: `<svg viewBox="0 0 240 80"><!-- {{color: color default=#6366F1 label='Bubbles'}} {{accent: color default=#38BDF8 label='Droplets'}} {{background: color default=#FFFFFF label='Background'}} {{width: float min=1 max=4 default=2 step=0.5 label='Outline'}} --><rect width="240" height="80" fill="{{background}}"/>${bubbles}</svg>`,
      animate: LOADER_X.flatMap((_, i): SvgAnimation[] => {
        const t0 = i * LOADER_STAGGER;
        const pop = t0 + POP_AT;
        const p = pose(i);
        return [
          // Inflating with a wobble, then bursting.
          { id: `b${i}`, attrs: { transform: [p(0), p(1.1)] }, delay: t0, ms: 450, ease: "out" },
          { id: `b${i}`, attrs: { transform: [p(1.1), p(0.95)] }, delay: t0 + 450, ms: 150, ease: "in-out" },
          { id: `b${i}`, attrs: { transform: [p(0.95), p(1)] }, delay: t0 + 600, ms: 200, ease: "in-out" },
          { id: `b${i}`, attrs: { transform: [p(1), p(1.35)], opacity: [1, 0] }, delay: pop, ms: 90, ease: "out" },
          snap(`ring${i}`, "stroke-width", 0, 0),
          { id: `ring${i}`, attrs: { r: [LOADER_R, LOADER_R * 2], "stroke-width": [3, 0] }, delay: pop, ms: 320, ease: "out" },
          ...Array.from({ length: DROPS }, (_, k): SvgAnimation[] => {
            const [x0, y0] = drop(i, k, LOADER_R);
            const [x1, y1] = drop(i, k, LOADER_R * 2.1);
            return [
              snap(`d${i}_${k}`, "r", 0, 0),
              { id: `d${i}_${k}`, attrs: { cx: [x0, x1], cy: [y0, r1(y1 + 4)], r: [3, 0] }, delay: pop, ms: 420, ease: "out" },
              snap(`d${i}_${k}`, "cx", x0, LOADER_END),
              snap(`d${i}_${k}`, "cy", y0, LOADER_END),
            ];
          }).flat(),
          // Hidden again, ready for the next round.
          snap(`ring${i}`, "r", LOADER_R, LOADER_END),
          snap(`b${i}`, "transform", p(0), LOADER_END),
          snap(`b${i}`, "opacity", 1, LOADER_END),
        ];
      }),
    };
  })(),
};

/** Bubbles as vector effects: chat bubbles and pops. */
export const bubbleEffects: VectorEffect[] = [chatBubble, bubblePopLoader];
