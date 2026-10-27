import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The web's hub, and how far its spokes reach. */
const HUB = [80, 84] as const;
const SPOKE = 58;
const SPOKES = 8;

/** A point `r` from the hub at spoke `i` (fractional between spokes), the first pointing up. */
const at = (i: number, r: number) => {
  const a = (i / SPOKES) * 2 * Math.PI - Math.PI / 2;
  return [r1(HUB[0] + r * Math.cos(a)), r1(HUB[1] + r * Math.sin(a))] as const;
};

/** The capture spiral: straight threads spoke to spoke, stepping outwards round four turns. */
const SPIRAL = (() => {
  const turns = 4;
  const points = Array.from({ length: turns * SPOKES + 1 }, (_, k) => at(k, 12 + (40 * k) / (turns * SPOKES)));
  return points.map(([x, y], k) => `${k ? "L" : "M"}${x} ${y}`).join(" ");
})();

/** The spider, drawn round (0, 0): eight bent legs, an abdomen and a head. */
const SPIDER = (() => {
  const legs = [-1, 1].flatMap((side) =>
    [-34, -12, 12, 34].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const knee = [r1(side * 9 * Math.cos(a)), r1(9 * Math.sin(a) - 4)];
      const foot = [r1(side * 15 * Math.cos(a)), r1(15 * Math.sin(a) + 4)];
      return `M0 0 L${knee[0]} ${knee[1]} L${foot[0]} ${foot[1]}`;
    }),
  );
  return `<path d="${legs.join(" ")}" fill="none" stroke="{{spider}}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="0" cy="-2" rx="5.5" ry="6.5" fill="{{spider}}"/><circle cx="0" cy="6" r="3.4" fill="{{spider}}"/>`;
})();

const drop = (y: number) => `translate(${HUB[0]} ${y})`;

export const spiderWebLoader: VectorEffect = {
  kind: "vector",
  id: "spider-web-loader",
  name: "Spider web loader",
  description: "A spider web weaving itself spoke by spoke and round its spiral, then a spider dropping in on its thread, bobbing, and climbing back out as the web fades.",
  category: "loader",
  tags: ["loader", "web", "spider", "halloween", "spooky", "icon", "draw"],
  hold: 400,
  presets: [
    { name: "Light", values: { background: [1, 1, 1], silk: [0.4, 0.44, 0.5], spider: [0.07, 0.07, 0.09] } },
    { name: "Halloween", values: { background: [0.1, 0.04, 0.12], silk: [1, 0.6, 0.2], spider: [0.55, 0.95, 0.3] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 160 160"><!-- {{background: color default=#0D0F14 label='Background'}} {{silk: color default=#D8DEE6 label='Silk'}} {{spider: color default=#F1F2F4 label='Spider'}} --><rect width="160" height="160" fill="{{background}}"/><g id="web" fill="none" stroke="{{silk}}" stroke-linecap="round" stroke-linejoin="round">${Array.from({ length: SPOKES }, (_, i) => {
      const [x, y] = at(i, SPOKE);
      return `<path id="spoke${i}" d="M${HUB[0]} ${HUB[1]} L${x} ${y}" stroke-width="1.4"/>`;
    }).join("")}<path id="spiral" d="${SPIRAL}" stroke-width="1.1"/></g><line id="thread" x1="${HUB[0]}" y1="0" x2="${HUB[0]}" y2="-20" stroke="{{silk}}" stroke-width="1"/><g id="spider" transform="${drop(-24)}">${SPIDER}</g></svg>`,
    animate: [
      // Spokes out from the hub, one after another round the web.
      ...Array.from({ length: SPOKES }, (_, i): SvgAnimation => ({ id: `spoke${i}`, draw: true, delay: i * 70, ms: 240, ease: "out" })),
      // The spiral wound from the hub outwards.
      { id: "spiral", draw: true, delay: 620, ms: 1100, ease: "in-out" },
      // The spider drops on its thread, bobs, waits, and climbs back out.
      { id: "spider", attrs: { transform: [drop(-24), drop(HUB[1])] }, delay: 1750, ms: 480, ease: "out" },
      { id: "thread", attrs: { y2: [-20, HUB[1] - 8] }, delay: 1750, ms: 480, ease: "out" },
      { id: "spider", attrs: { transform: [drop(HUB[1]), drop(HUB[1] - 8)] }, delay: 2230, ms: 180, ease: "out" },
      { id: "spider", attrs: { transform: [drop(HUB[1] - 8), drop(HUB[1])] }, delay: 2410, ms: 260, ease: "in-out" },
      { id: "spider", attrs: { transform: [drop(HUB[1]), drop(-24)] }, delay: 3000, ms: 520, ease: [0.55, 0, 1, 0.45] },
      { id: "thread", attrs: { y2: [HUB[1] - 8, -20] }, delay: 3000, ms: 520, ease: [0.55, 0, 1, 0.45] },
      // The web fades, ready to be woven again.
      { id: "web", attrs: { opacity: [1, 0] }, delay: 3250, ms: 450, ease: "in-out" },
    ],
  },
};

/** Webbing as vector effects. */
export const webEffects: VectorEffect[] = [spiderWebLoader];
