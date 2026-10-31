import type { SvgAnimation } from "../vector/motion.js";
import { fit, n, r1 } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * Memes drawn as vectors, in a 640 × 360 frame laid over a picture: set the
 * background opacity to 0 and stack it on a photo or video. Points on the
 * picture are 0–1 across the frame, y up, as in the meme shaders, so a face
 * found once places both. Ids in the picture start with the effect's initials.
 */

const W = 640;
const H = 360;

/** The classic caption face: Impact, then its look-alikes. */
const IMPACT = `Impact, Anton, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif`;

/** The background and its opacity, for laying the picture over a photo. */
const BACKDROP = `{{background: color default=#3B4252 label='Background'}} {{backdrop: float min=0 max=1 default=1 step=0.05 label='Background opacity'}}`;

/** A transform scaling by `s` about the line through (320, `{{mid}}`). */
const aboutLine = (mid: string, s: number | string) => `translate(320 {{${mid}}}) scale(${s}) translate(-320 -{{${mid}}})`;

/** One caption line fitted to the frame: its size, width and baseline, keyed by `key`. */
function captionLine(key: string, text: unknown, upper: boolean, top: boolean) {
  const line = upper ? String(text ?? "").toUpperCase() : String(text ?? "");
  const { size, width } = fit(line, 600, 66);
  const base = top ? 14 + size * 0.84 : H - 14 - size * 0.06;
  return {
    [`${key}Line`]: line,
    [`${key}Size`]: size,
    [`${key}W`]: width,
    [`${key}Base`]: r1(base),
    [`${key}Mid`]: r1(base - size * 0.4),
  };
}

const captionText = (key: string) =>
  `<text id="ic${key}" x="320" y="{{${key}Base}}" text-anchor="middle" textLength="{{${key}W}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{${key}Size}}" fill="{{ink}}" stroke="{{outline}}" stroke-width="{{${key}Stroke}}" stroke-linejoin="round" paint-order="stroke" transform="${aboutLine(`${key}Mid`, "{{popFrom}}")}" opacity="0">{{${key}Line}}</text>`;

/** A caption line popping on from small and springing to rest. */
const captionPop = (key: string, delay: number): SvgAnimation[] => [
  { id: `ic${key}`, attrs: { opacity: [0, 1] }, delay, ms: 90 },
  { id: `ic${key}`, attrs: { transform: [aboutLine(`${key}Mid`, "{{popFrom}}"), aboutLine(`${key}Mid`, 1)] }, delay, ms: 650, ease: { spring: { stiffness: 320, damping: 13 } } },
];

export const impactCaption: VectorEffect = {
  kind: "vector",
  id: "impact-caption",
  name: "Impact caption",
  description:
    "The classic meme caption: white Impact capitals with a heavy black outline across the top and bottom of the frame, each fitted to the width, popping on with the punchline a beat after the setup.",
  category: "meme",
  tags: ["meme", "caption", "text", "impact", "top-text", "bottom-text", "overlay", "pop"],
  hold: 1800,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Bottom only", values: { top: "", bottom: "ONE DOES NOT SIMPLY WRITE A CAPTION" } },
    { name: "No pop", values: { pop: 0 } },
    { name: "Yellow subtitle", values: { ink: [1, 0.86, 0.1], upper: false, thickness: 0.06 } },
  ],
  derived: (v) => {
    const upper = Boolean(v.upper);
    const top = captionLine("top", v.top, upper, true);
    const bottom = captionLine("bottom", v.bottom, upper, false);
    const thickness = Number(v.thickness);
    return {
      ...top,
      ...bottom,
      topStroke: r1(Number(top.topSize) * thickness * 2),
      bottomStroke: r1(Number(bottom.bottomSize) * thickness * 2),
      popFrom: Math.round((1 - 0.7 * Number(v.pop)) * 100) / 100,
      beat: 150 + Math.round(Number(v.beat) * 1000),
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{top: text default='TOP TEXT' label='Top text'}} {{bottom: text default='BOTTOM TEXT' label='Bottom text'}} {{ink: color default=#FFFFFF label='Text colour'}} {{outline: color default=#000000 label='Outline'}} {{thickness: float min=0 max=0.2 default=0.09 step=0.01 label='Outline width (em)'}} {{upper: bool default=true label='Capitals'}} {{pop: float min=0 max=1 default=1 step=0.1 label='Pop-in'}} {{beat: float min=0 max=3 default=0.8 step=0.1 label='Punchline delay (s)'}} {{font: text default="${IMPACT}" label='Font'}} ${BACKDROP} --><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/>${captionText("top")}${captionText("bottom")}</svg>`,
    animate: [...captionPop("top", 150), ...captionPop("bottom", n("beat"))],
  },
};

/** The pixel sunglasses, 22 × 5 cells: a bar, a bridge and two lenses that narrow at the bottom, each with a glint. */
const GLASSES = (() => {
  const ink: string[] = [];
  const glint: string[] = [];
  const cell = (x: number, y: number, to: string[], w = 1) => to.push(`M${x} ${y}h${w}v1h-${w}z`);
  cell(0, 0, ink, 22);
  cell(9, 1, ink, 4);
  for (const left of [1, 13]) {
    for (let row = 1; row <= 4; row++) {
      const inset = Math.max(0, row - 2);
      for (let x = left + inset; x < left + 8 - inset; x++) {
        const shine = (row === 1 && (x === left + 1 || x === left + 2)) || (row === 2 && (x === left + 2 || x === left + 3));
        cell(x, row, shine ? glint : ink);
      }
    }
  }
  return { ink: ink.join(""), glint: glint.join("") };
})();

/** The sample portrait's face (as in `SAMPLE_IMAGES.portrait`), whose eyes sit at the default point. */
const FACE = `<circle cx="320" cy="150" r="70" fill="#c98b6b"/><path d="M190 360 Q200 240 320 240 Q440 240 450 360Z" fill="#33415c"/><path d="M250 130 Q260 60 320 62 Q385 60 392 135 Q370 100 320 100 Q275 100 250 130Z" fill="#2b1d16"/><circle cx="295" cy="150" r="6" fill="#2b1d16"/><circle cx="345" cy="150" r="6" fill="#2b1d16"/><path d="M300 185 Q320 198 340 185" stroke="#7a3e2c" stroke-width="5" fill="none"/>`;

export const dealWithIt: VectorEffect = {
  kind: "vector",
  id: "deal-with-it",
  name: "Deal with it",
  description:
    "Pixel sunglasses sliding slowly down from the top of the frame onto a pair of eyes, landing with a little bounce, then a caption snapping on underneath.",
  category: "meme",
  tags: ["meme", "reaction", "pixel", "sunglasses", "caption", "overlay", "cool"],
  hold: 1600,
  presets: [
    { name: "Overlay", values: { backdrop: 0, face: false } },
    { name: "Quick", values: { drop: 0.5 } },
    { name: "Gold frames", values: { lens: [0.85, 0.65, 0.1] } },
  ],
  derived: (v) => {
    const s = (Number(v.width) * W) / 22;
    const x = r1(Number(v.x) * W - 11 * s);
    const y = r1((1 - Number(v.y)) * H - 2 * s);
    const at = (dy: number) => `translate(${x} ${r1(y + dy)}) scale(${r1(s * 100) / 100})`;
    const caption = fit(v.text, 560, 52);
    const drop = Math.round(Number(v.drop) * 1000);
    return {
      glassesFrom: at(-(y + 6 * s)),
      glassesTo: at(0),
      glassesBounce: at(-s * 0.6),
      drop,
      landed: 300 + drop,
      hop: 300 + drop + 130,
      bounced: 300 + drop + 260,
      captionSize: caption.size,
      captionW: caption.width,
      captionStroke: r1(caption.size * 0.16),
      faceShown: v.face ? 1 : 0,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{text: text default='DEAL WITH IT' label='Caption'}} {{x: float min=0 max=1 default=0.5 step=0.005 label='Eyes across'}} {{y: float min=0 max=1 default=0.583 step=0.005 label='Eyes up'}} {{width: float min=0.05 max=0.8 default=0.16 step=0.01 label='Glasses width'}} {{drop: float min=0.2 max=4 default=1.4 step=0.1 label='Drop (s)'}} {{lens: color default=#000000 label='Glasses'}} {{shine: color default=#FFFFFF label='Glint'}} {{ink: color default=#FFFFFF label='Caption colour'}} {{outline: color default=#000000 label='Caption outline'}} {{face: bool default=true label='Sample face'}} {{font: text default="${IMPACT}" label='Font'}} ${BACKDROP} --><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g opacity="{{faceShown}}">${FACE}</g><g id="dwGlasses" transform="{{glassesFrom}}" shape-rendering="crispEdges"><path d="${GLASSES.ink}" fill="{{lens}}"/><path d="${GLASSES.glint}" fill="{{shine}}"/></g><text id="dwCaption" x="320" y="338" text-anchor="middle" textLength="{{captionW}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{captionSize}}" fill="{{ink}}" stroke="{{outline}}" stroke-width="{{captionStroke}}" stroke-linejoin="round" paint-order="stroke" opacity="0">{{text}}</text></svg>`,
    animate: [
      // A slow, steady slide down, a small hop on landing, and the caption snapping on.
      { id: "dwGlasses", attrs: { transform: ["{{glassesFrom}}", "{{glassesTo}}"] }, delay: 300, ms: n("drop"), ease: "linear" },
      { id: "dwGlasses", attrs: { transform: ["{{glassesTo}}", "{{glassesBounce}}"] }, delay: n("landed"), ms: 130, ease: "out" },
      { id: "dwGlasses", attrs: { transform: ["{{glassesBounce}}", "{{glassesTo}}"] }, delay: n("hop"), ms: 130, ease: "in-out" },
      { id: "dwCaption", attrs: { opacity: [1, 1] }, delay: n("bounced"), ms: 0 },
    ],
  },
};

export const memeEffects: VectorEffect[] = [impactCaption, dealWithIt];
