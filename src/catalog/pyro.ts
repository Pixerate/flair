import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const round = (n: number) => Math.round(n * 10) / 10;

export const fireworkBurst: VectorEffect = {
  kind: "vector",
  id: "firework-burst",
  name: "Firework burst",
  description: "A small firework for success moments: a flash, a ring of streaks and a staggered ring of dots bursting outwards and fading.",
  category: "pyrotechnics",
  tags: ["pyro", "celebration", "success", "reward", "ui", "fireworks"],
  hold: 400,
  motion: (() => {
    // Ring one: streaks flying out; ring two: dots, half a step round and a beat later.
    const streaks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      return { id: `l${i}`, c, s, stroke: ["{{a}}", "{{b}}", "{{c}}"][i % 3]! };
    });
    const dots = Array.from({ length: 10 }, (_, i) => {
      const a = ((i + 0.5) / 10) * Math.PI * 2 - Math.PI / 2;
      return { id: `d${i}`, c: Math.cos(a), s: Math.sin(a), fill: ["{{b}}", "{{c}}", "{{a}}"][i % 3]! };
    });
    const at = (c: number, s: number, r: number) => [round(c * r), round(s * r)] as const;
    return {
      svg: `<svg viewBox="0 0 200 200"><!-- {{a: color default=#F43F5E label='Colour A'}} {{b: color default=#FACC15 label='Colour B'}} {{c: color default=#38BDF8 label='Colour C'}} {{width: float min=1 max=8 default=4 step=0.5 label='Line width'}} --><g transform="translate(100 100) scale({{size: float min=0.5 max=1.4 default=1 step=0.05 label='Size'}})"><circle id="flash" cx="0" cy="0" r="0" fill="{{b}}" opacity="0"/>${streaks
        .map(({ id, c, s, stroke }) => {
          const [x, y] = at(c, s, 12);
          return `<line id="${id}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" stroke="${stroke}" stroke-width="{{width}}" stroke-linecap="round" opacity="0"/>`;
        })
        .join("")}${dots.map(({ id, c, s, fill }) => `<circle id="${id}" cx="${round(c * 14)}" cy="${round(s * 14)}" r="5" fill="${fill}" opacity="0"/>`).join("")}</g></svg>`,
      animate: [
        { id: "flash", attrs: { r: [0, 22], opacity: [0.9, 0] }, ms: 380, ease: "out" },
        ...streaks.flatMap(({ id, c, s }): SvgAnimation[] => {
          const [x0, y0] = at(c, s, 12);
          const [x1, y1] = at(c, s, 40);
          const [x2, y2] = at(c, s, 62);
          const [x3, y3] = at(c, s, 74);
          return [
            { id, attrs: { opacity: [0, 1] }, ms: 40 },
            { id, attrs: { x1: [x0, x1], y1: [y0, y1], x2: [x0, x2], y2: [y0, y2] }, ms: 420, ease: "out" },
            { id, attrs: { x1: [x1, x3], y1: [y1, y3], x2: [x2, x3], y2: [y2, y3], opacity: [1, 0] }, delay: 420, ms: 380, ease: "in-out" },
          ];
        }),
        ...dots.flatMap(({ id, c, s }): SvgAnimation[] => [
          { id, attrs: { opacity: [0, 1] }, delay: 150, ms: 40 },
          { id, attrs: { cx: [round(c * 14), round(c * 66)], cy: [round(s * 14), round(s * 66)] }, delay: 150, ms: 520, ease: "out" },
          { id, attrs: { cy: [round(s * 66), round(s * 66 + 10)], r: [5, 1], opacity: [1, 0] }, delay: 670, ms: 450, ease: "in-out" },
        ]),
      ],
    };
  })(),
  presets: [
    { name: "Gold", values: { a: [1, 0.78, 0.3], b: [1, 0.93, 0.6], c: [0.98, 0.6, 0.2] } },
    { name: "Brand", values: { a: [0.39, 0.4, 0.95], b: [0.93, 0.28, 0.6], c: [0.13, 0.83, 0.93] } },
    { name: "Big", values: { size: 1.4, width: 6 } },
  ],
};

/** Pyrotechnics: fireworks, sparks, explosions and smoke, as vector effects. */
export const pyroEffects: VectorEffect[] = [fireworkBurst];
