import { rgbToHex } from "../shader/controls.js";
import type { SvgAnimation } from "../vector/motion.js";
import { fit, holds, n, r1 } from "./broadcast.js";
import { about, keys, LETTERING, rand, snap, star } from "./comic.js";
import { textWidthEm } from "./images.js";
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

/** A point on the picture (0–1 across, y up) in the frame's units. */
const at = (x: unknown, y: unknown) => [r1(Number(x) * W), r1((1 - Number(y)) * H)] as const;

// ── Stonks chart ───────────────────────────────────────────────────────

/** The chart's plot: its left and right, and the line's low and high. */
const SC = { left: 70, right: 540, low: 300, high: 80 };
const SC_STEPS = 14;

/** The jagged line: rising faster and faster, or (`crash`) falling, with `jag` of zig-zag. */
function stonksLine(crash: boolean, jag: number): string {
  const points = Array.from({ length: SC_STEPS + 1 }, (_, i) => {
    const t = i / SC_STEPS;
    const zig = i === 0 || i === SC_STEPS ? 0 : (i % 2 ? 1 : -0.6) * (0.6 + 0.8 * rand(i + 70)) * 24 * jag * (1 - 0.4 * t);
    const y = SC.low - (SC.low - SC.high) * t ** 1.7 + zig;
    return `${r1(SC.left + (SC.right - SC.left) * t)} ${r1(crash ? SC.low + SC.high - y : y)}`;
  });
  return `M${points.join(" L")}`;
}

const SC_GRID = [80, 153, 226, 300].map((y) => `M${SC.left} ${y} H${SC.right + 40}`).join(" ") + " " + [187, 305, 422, 540].map((x) => `M${x} ${SC.high - 20} V${SC.low}`).join(" ");

export const stonksChart: VectorEffect = {
  kind: "vector",
  id: "stonks-chart",
  name: "Stonks chart",
  description:
    "The stonks trope: a jagged line chart rocketing up to a fat arrow head (or crashing down, by a switch), its value ticking up as it draws and a bold label above, laid over a picture or on its own.",
  category: "meme",
  tags: ["meme", "chart", "stonks", "line-chart", "arrow", "counter", "finance", "overlay"],
  hold: 1400,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Not stonks", values: { crash: true, label: "NOT STONKS", line: [0.94, 0.27, 0.27] } },
    { name: "Dollars", values: { value: 69420, prefix: "$", suffix: "" } },
    { name: "Slow burn", values: { rise: 4, jag: 0.4 } },
  ],
  derived: (v) => {
    const crash = Boolean(v.crash);
    const label = fit(v.label, 300, 56);
    // The words go in the corner the line leaves empty: top left as it rises, bottom left as it falls.
    const labelBase = crash ? 262 : 70;
    const valueBase = crash ? 322 : 124;
    const rise = Math.round(Number(v.rise) * 1000);
    return {
      lineD: stonksLine(crash, Number(v.jag)),
      labelSize: label.size,
      labelW: label.width,
      labelBase,
      labelFrom: about(40, labelBase - label.size * 0.35, 0),
      labelTo: about(40, labelBase - label.size * 0.35, 1),
      valueBase,
      valueRest: about(40, valueBase - 16, 1),
      valueBig: about(40, valueBase - 16, 1.14),
      fmt: `${crash ? "−" : "+"}${String(v.prefix ?? "")}{n}${String(v.suffix ?? "")}`,
      rise,
      risen: 200 + rise,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{label: text default='STONKS' label='Label'}} {{value: float min=0 max=1000000 default=420 step=1 label='Value'}} {{decimals: int min=0 max=2 default=0 label='Decimals'}} {{prefix: text default='' label='Before the value'}} {{suffix: text default='%' label='After the value'}} {{crash: bool default=false label='Crash'}} {{rise: float min=0.5 max=6 default=1.8 step=0.1 label='Draw time (s)'}} {{jag: float min=0 max=1.5 default=1 step=0.05 label='Jaggedness'}} {{line: color default=#22C55E label='Line'}} {{grid: color default=#94A3B8 label='Grid'}} {{ink: color default=#FFFFFF label='Text colour'}} {{outline: color default=#000000 label='Outline'}} {{font: text default="${IMPACT}" label='Font'}} ${BACKDROP} --><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><path d="${SC_GRID}" stroke="{{grid}}" stroke-opacity="0.3" stroke-width="1.5" fill="none"/><path d="M${SC.left} ${SC.high - 20} V${SC.low} H${SC.right + 40}" stroke="{{grid}}" stroke-width="3" fill="none"/><path id="scShadow" d="{{lineD}}" fill="none" stroke="{{outline}}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/><path id="scLine" d="{{lineD}}" fill="none" stroke="{{line}}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/><g id="scArrow"><path d="M-10 -28 L44 0 L-10 28 Z" fill="{{line}}" stroke="{{outline}}" stroke-width="5" stroke-linejoin="round"/></g><g id="scLabel" transform="{{labelFrom}}"><text x="40" y="{{labelBase}}" textLength="{{labelW}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{labelSize}}" fill="{{ink}}" stroke="{{outline}}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">{{label}}</text></g><g id="scTick" transform="{{valueRest}}"><text id="scValue" x="40" y="{{valueBase}}" font-family="{{font}}" font-size="44" fill="{{line}}" stroke="{{outline}}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">0</text></g></svg>`,
    animate: [
      { id: "scLabel", attrs: { transform: ["{{labelFrom}}", "{{labelTo}}"] }, ms: 650, ease: { spring: { stiffness: 320, damping: 13 } } },
      // The line draws on with the arrow riding its tip and the value counting with it.
      { id: "scShadow", draw: true, delay: 200, ms: n("rise"), ease: "in-out" },
      { id: "scLine", draw: true, delay: 200, ms: n("rise"), ease: "in-out" },
      { id: "scArrow", along: "scLine", orient: true, delay: 200, ms: n("rise"), ease: "in-out" },
      { id: "scValue", count: [0, "{{value}}"] as unknown as [number, number], format: "{{fmt}}", decimals: n("decimals"), delay: 200, ms: n("rise"), ease: "in-out" },
      // Then the value throbs, twice.
      { id: "scTick", attrs: { transform: ["{{valueRest}}", "{{valueBig}}"] }, delay: n("risen"), ms: 700, behavior: { type: "pulse", count: 2 } },
    ],
  },
};

// ── Error cascade ──────────────────────────────────────────────────────

const EC_SLOTS = 16;
const EC_W = 260;
const EC_H = 112;
/** A plain UI face, the kind old dialogs were set in. */
const DIALOG = `Tahoma, Verdana, 'DejaVu Sans', Geneva, sans-serif`;

/** A raised bevel round a box: light top and left, dark bottom and right. */
const bevel = (x: number, y: number, w: number, h: number) =>
  `<path d="M${x} ${y + h} V${y} H${x + w}" stroke="#FFFFFF" stroke-width="2" fill="none"/><path d="M${x} ${y + h} H${x + w} V${y}" stroke="#404040" stroke-width="2" fill="none"/>`;

/** One dialog, at its slot's place. */
const ecDialog = (i: number) =>
  `<g display="{{eon${i}}}"><g id="ecWin${i}" transform="translate({{ex${i}}} {{ey${i}}})" opacity="0"><rect x="3" y="4" width="${EC_W}" height="${EC_H}" fill="#000000" opacity="0.35"/><rect width="${EC_W}" height="${EC_H}" fill="{{face}}"/>${bevel(0, 0, EC_W, EC_H)}<rect x="4" y="4" width="${EC_W - 8}" height="20" fill="url(#ecBar)"/><text x="10" y="18.5" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" font-size="{{titleSize}}" font-weight="700" fill="{{titleInk}}">{{title}}</text><rect x="${EC_W - 24}" y="7" width="16" height="14" fill="{{face}}"/>${bevel(EC_W - 24, 7, 16, 14)}<path d="M${EC_W - 20} 10.5 L${EC_W - 12} 17.5 M${EC_W - 12} 10.5 L${EC_W - 20} 17.5" stroke="#000000" stroke-width="2"/><circle cx="30" cy="56" r="15" fill="{{icon}}" stroke="#000000" stroke-opacity="0.5" stroke-width="1.5"/><path d="M24 50 L36 62 M36 50 L24 62" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/><text x="56" y="61" textLength="{{messageW}}" lengthAdjust="spacingAndGlyphs" font-size="{{messageSize}}" fill="{{ink}}">{{message}}</text><rect x="${EC_W / 2 - 34}" y="80" width="68" height="22" fill="{{face}}"/>${bevel(EC_W / 2 - 34, 80, 68, 22)}<rect x="${EC_W / 2 - 30}" y="83" width="60" height="16" fill="none" stroke="#000000" stroke-width="1" stroke-dasharray="1 1"/><text x="${EC_W / 2}" y="95.5" text-anchor="middle" textLength="{{buttonW}}" lengthAdjust="spacingAndGlyphs" font-size="{{buttonSize}}" fill="{{ink}}">{{button}}</text></g></g>`;

export const errorCascade: VectorEffect = {
  kind: "vector",
  id: "error-cascade",
  name: "Error cascade",
  description:
    "Retro error dialogs popping up one after another, cascading down the screen or dragging a trail across it like a frozen computer, each with an editable title, message and button and no real system's branding.",
  category: "meme",
  tags: ["meme", "retro", "error", "dialog", "window", "crash", "glitch", "90s", "overlay"],
  hold: 1500,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Trail", values: { trail: true, count: 16, pace: 0.07 } },
    { name: "Warning", values: { title: "Warning", message: "Are you sure? This cannot be undone.", icon: [0.98, 0.78, 0.1], button: "Yes" } },
    { name: "Dark", values: { face: [0.2, 0.22, 0.26], ink: [0.92, 0.93, 0.95], bar: [0.45, 0.1, 0.55], bar2: [0.85, 0.3, 0.6] } },
  ],
  derived: (v) => {
    const count = Math.max(1, Math.min(EC_SLOTS, Math.round(Number(v.count))));
    const pace = Math.round(Number(v.pace) * 1000);
    const title = fit(v.title, 200, 13);
    const message = fit(v.message, 190, 15);
    const button = fit(v.button, 52, 12);
    const out: Record<string, string | number> = {
      titleSize: title.size,
      titleW: title.width,
      messageSize: message.size,
      messageW: message.width,
      buttonSize: button.size,
      buttonW: button.width,
    };
    const span = Math.max(1, count - 1);
    for (let i = 0; i < EC_SLOTS; i++) {
      const t = Math.min(i, span) / span;
      // A cascade steps down and right; a trail swings across the screen as if dragged.
      const [x, y] = v.trail
        ? [30 + (W - EC_W - 60) * t, 40 + 170 * t + 40 * Math.sin(3 * Math.PI * t)]
        : [40 + Math.min(i, span) * Math.min(26, 300 / span), 30 + Math.min(i, span) * Math.min(20, 190 / span)];
      out[`ex${i}`] = r1(x);
      out[`ey${i}`] = r1(y);
      out[`eon${i}`] = i < count ? "inline" : "none";
      out[`eat${i}`] = 150 + Math.min(i, count) * pace;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{title: text default='Error' label='Title'}} {{message: text default='Something went horribly wrong.' label='Message'}} {{button: text default='OK' label='Button'}} {{count: int min=1 max=${EC_SLOTS} default=10 label='Dialogs'}} {{pace: float min=0.03 max=1 default=0.18 step=0.01 label='Seconds between'}} {{trail: bool default=false label='Drag a trail'}} {{face: color default=#C0C0C0 label='Window'}} {{bar: color default=#000080 label='Title bar'}} {{bar2: color default=#1084D0 label='Title bar fade'}} {{titleInk: color default=#FFFFFF label='Title colour'}} {{ink: color default=#000000 label='Text colour'}} {{icon: color default=#E81123 label='Icon'}} {{font: text default="${DIALOG}" label='Font'}} ${BACKDROP} --><defs><linearGradient id="ecBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{bar}}"/><stop offset="1" stop-color="{{bar2}}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g font-family="{{font}}">${Array.from({ length: EC_SLOTS }, (_, i) => ecDialog(i)).join("")}</g></svg>`,
    // Each dialog snaps on, as they did, a beat after the one before.
    animate: Array.from({ length: EC_SLOTS }, (_, i) => holds(`ecWin${i}`, "opacity", [[n(`eat${i}`), 1]])).flat(),
  },
};

// ── Bonk ───────────────────────────────────────────────────────────────

/** The mallet, its striking face's middle at (0, 0), its handle out to the right, held at {@link BK_GRIP}. */
const BK_GRIP = [190, -48] as const;
const BK_MALLET = `<rect x="30" y="-58" width="174" height="20" rx="9" fill="{{handle}}" stroke="{{ink}}" stroke-width="5"/><rect x="-38" y="-96" width="76" height="96" rx="12" fill="{{head}}" stroke="{{ink}}" stroke-width="5"/><path d="M-38 -80 H38 M-38 -16 H38" stroke="{{ink}}" stroke-width="4"/><rect x="-27" y="-74" width="9" height="52" rx="4.5" fill="#FFFFFF" opacity="0.35"/>`;
const swing = (deg: number) => `rotate(${deg} ${BK_GRIP[0]} ${BK_GRIP[1]})`;

/** Impact lines flying out sideways from the point of the hit. */
const BK_LINES = [158, 180, 202, 338, 0, 22]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `M${r1(52 * Math.cos(a))} ${r1(52 * Math.sin(a) - 6)} L${r1(88 * Math.cos(a))} ${r1(88 * Math.sin(a) - 6)}`;
  })
  .join(" ");

const BK_STAR = star(0, 0, 70, 40, 10);

export const bonk: VectorEffect = {
  kind: "vector",
  id: "bonk",
  name: "Bonk",
  description:
    "A cartoon mallet winds up and swings down onto a point, the head under it squashes and springs back, and a comic impact star pops with the word BONK, the frame shaking from the hit.",
  category: "meme",
  tags: ["meme", "reaction", "comic", "bonk", "mallet", "hammer", "hit", "cartoon", "overlay"],
  hold: 500,
  presets: [
    { name: "Overlay", values: { backdrop: 0, face: false } },
    { name: "Toy hammer", values: { word: "SQUEAK", head: [0.93, 0.2, 0.25], handle: [1, 0.85, 0.2], burst: [0.55, 0.85, 1] } },
    { name: "Big bonk", values: { word: "BONK!", size: 1.3, y: 0.62 } },
  ],
  derived: (v) => {
    const [px, py] = at(v.x, v.y);
    const s = r1(Number(v.size) * 100) / 100;
    // The star sits beside the hit, on the side with more room.
    const side = px < W * 0.3 ? 140 : -140;
    const word = fit(v.word, 118, 44);
    const sink = r1(Math.max(0, H - py) * 0.12);
    return {
      malletAt: `translate(${px} ${py}) scale(${s})`,
      starAt: `translate(${r1(px + side * s)} ${r1(py - 10 * s)}) scale(${s})`,
      wordSize: word.size,
      wordW: word.width,
      wordBase: r1(word.size * 0.36),
      faceRest: about(px, H, 1),
      faceSquash: about(px, H, 1.1, 0.88),
      sinkTo: `translate(0 ${sink})`,
      faceShown: v.face ? 1 : 0,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{word: text default='BONK' label='Word'}} {{x: float min=0 max=1 default=0.5 step=0.005 label='Hit across'}} {{y: float min=0 max=1 default=0.775 step=0.005 label='Hit up'}} {{size: float min=0.4 max=2 default=0.75 step=0.05 label='Size'}} {{head: color default=#B5763C label='Mallet head'}} {{handle: color default=#8A5427 label='Handle'}} {{burst: color default=#FFD60A label='Star'}} {{letters: color default=#FF3B30 label='Letters'}} {{ink: color default=#111111 label='Ink'}} {{face: bool default=true label='Sample face'}} {{font: text default="${LETTERING}" label='Font'}} ${BACKDROP} --><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g id="bkShake" transform="translate(0 0)"><g id="bkFace" transform="{{faceRest}}" opacity="{{faceShown}}">${FACE}</g><g id="bkStar" transform="{{starAt}}"><g id="bkBurst" transform="scale(0)"><path d="${BK_STAR}" fill="{{burst}}" stroke="{{ink}}" stroke-width="6" stroke-linejoin="miter"/><g id="bkWord" transform="scale(0)"><text x="0" y="{{wordBase}}" text-anchor="middle" textLength="{{wordW}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{wordSize}}" font-weight="900" fill="{{letters}}" stroke="{{ink}}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">{{word}}</text></g></g></g><g id="bkSink" transform="translate(0 0)"><g transform="{{malletAt}}"><g id="bkLines" transform="scale(0.6)" opacity="0"><path d="${BK_LINES}" stroke="{{ink}}" stroke-width="6" stroke-linecap="round"/></g><g id="bkMallet" transform="${swing(80)}" opacity="0">${BK_MALLET}</g></g></g></g></svg>`,
    animate: [
      // The mallet appears raised, winds up a little further, then swings down hard.
      snap("bkMallet", "opacity", 1, 0),
      ...keys("bkMallet", "transform", [
        [0, swing(80)],
        [220, swing(96)],
      ], { ease: "out" }),
      { id: "bkMallet", attrs: { transform: [swing(96), swing(0)] }, delay: 220, ms: 140, ease: [0.55, 0, 1, 0.6] },
      // It rebounds, rests, then lifts away and fades.
      { id: "bkMallet", attrs: { transform: [swing(0), swing(8)] }, delay: 360, ms: 200, ease: "out" },
      { id: "bkMallet", attrs: { transform: [swing(8), swing(80)], opacity: [1, 0] }, delay: 1400, ms: 300, ease: "in-out" },
      // The head squashes under it and springs back, the mallet going down with it.
      { id: "bkFace", attrs: { transform: ["{{faceRest}}", "{{faceSquash}}"] }, delay: 360, ms: 70, ease: "out" },
      { id: "bkFace", attrs: { transform: ["{{faceSquash}}", "{{faceRest}}"] }, delay: 430, ms: 600, ease: { spring: { stiffness: 300, damping: 9 } } },
      { id: "bkSink", attrs: { transform: ["translate(0 0)", "{{sinkTo}}"] }, delay: 360, ms: 70, ease: "out" },
      { id: "bkSink", attrs: { transform: ["{{sinkTo}}", "translate(0 0)"] }, delay: 430, ms: 600, ease: { spring: { stiffness: 300, damping: 9 } } },
      // Impact lines fly out, and the star and the word pop past their size and settle.
      snap("bkLines", "opacity", 1, 360),
      { id: "bkLines", attrs: { transform: ["scale(0.6)", "scale(1.3)"], opacity: [1, 0] }, delay: 360, ms: 300, ease: "out" },
      snap("bkLines", "transform", "scale(0.6)", 700),
      ...keys("bkBurst", "transform", [
        [360, "scale(0)"],
        [470, "scale(1.3)"],
        [560, "scale(0.94)"],
        [640, "scale(1)"],
      ], { ease: "out" }),
      ...keys("bkWord", "transform", [
        [400, "scale(0) rotate(-14)"],
        [530, "scale(1.35) rotate(-4)"],
        [640, "scale(0.95) rotate(-10)"],
        [740, "scale(1) rotate(-8)"],
      ], { ease: "out" }),
      { id: "bkBurst", attrs: { transform: ["scale(1)", "scale(0)"] }, delay: 1500, ms: 250, ease: "in-out" },
      { id: "bkWord", attrs: { transform: ["scale(1) rotate(-8)", "scale(0) rotate(-14)"] }, delay: 1500, ms: 250, ease: "in-out" },
      // Everything shakes from the hit.
      { id: "bkShake", attrs: { transform: ["translate(0 0)", "translate(6 4)"] }, delay: 360, ms: 300, ease: "linear", behavior: { type: "oscillate", count: 4, decay: 1.5 } },
    ],
  },
};

// ── Hitmarker montage ──────────────────────────────────────────────────

const HM_SLOTS = 8;
const HM_POINTS = "0.32,0.62 0.6,0.45 0.44,0.3 0.72,0.68 0.5,0.52";

/** Up to `max` points read from "x,y x,y …" (0–1, y up); `fallback`'s when none can be read. */
function readPoints(text: unknown, max: number, fallback: string): (readonly [number, number])[] {
  const numbers = (String(text ?? "").match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const points = Array.from({ length: Math.floor(numbers.length / 2) }, (_, i) => [numbers[2 * i]!, numbers[2 * i + 1]!] as const)
    .map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as const)
    .slice(0, max);
  return points.length ? points : readPoints(fallback, max, fallback);
}

/** The four diagonal ticks of a hit marker, round (0, 0). */
const HM_TICKS = [45, 135, 225, 315]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `M${r1(9 * Math.cos(a))} ${r1(9 * Math.sin(a))} L${r1(24 * Math.cos(a))} ${r1(24 * Math.sin(a))}`;
  })
  .join(" ");

/** When each part of a hit happens, in ms after it lands. */
const HM_TIMES = { set: 90, fade: 240, reset: 440, score: 40, scoreFade: 460, scoreReset: 760 } as const;

const hmSlot = (i: number) =>
  `<g display="{{hon${i}}}" transform="translate({{hx${i}}} {{hy${i}}}) scale({{size}})"><g id="hmMark${i}" transform="scale(1.7)" opacity="0" filter="url(#hmShadow)"><path d="${HM_TICKS}" fill="none" stroke="{{hc${i}}}" stroke-width="{{weight}}" stroke-linecap="square"/></g><g id="hmRise${i}" transform="translate(0 0)"><text id="hmScore${i}" x="22" y="-24" font-family="{{font}}" font-size="30" fill="{{scoreInk}}" stroke="#000000" stroke-width="5" stroke-linejoin="round" paint-order="stroke" opacity="0">{{score}}</text></g></g>`;

/** One hit: the marker slamming in and fading, the score floating up, the frame jolting. */
const hmHit = (i: number): SvgAnimation[] => {
  const t = (k: keyof typeof HM_TIMES | "at") => n(`h${k}${i}`);
  return [
    { id: `hmMark${i}`, attrs: { opacity: [0, 1] }, delay: t("at"), ms: 30 },
    { id: `hmMark${i}`, attrs: { transform: ["scale(1.7)", "scale(0.88)"] }, delay: t("at"), ms: 90, ease: "out" },
    { id: `hmMark${i}`, attrs: { transform: ["scale(0.88)", "scale(1)"] }, delay: t("set"), ms: 90, ease: "in-out" },
    { id: `hmMark${i}`, attrs: { opacity: [1, 0], transform: ["scale(1)", "scale(1.15)"] }, delay: t("fade"), ms: 180, ease: "in-out" },
    snap(`hmMark${i}`, "transform", "scale(1.7)", t("reset")),
    { id: `hmScore${i}`, attrs: { opacity: [0, 1] }, delay: t("score"), ms: 80 },
    { id: `hmRise${i}`, attrs: { transform: ["translate(0 0)", "translate(10 -46)"] }, delay: t("score"), ms: 700, ease: "out" },
    { id: `hmScore${i}`, attrs: { opacity: [1, 0] }, delay: t("scoreFade"), ms: 260, ease: "in-out" },
    snap(`hmRise${i}`, "transform", "translate(0 0)", t("scoreReset")),
    { id: "hmShake", attrs: { transform: ["translate(0 0)", `translate({{hsx${i}}} {{hsy${i}}})`] }, delay: t("at"), ms: n("shakeMs"), ease: "linear", behavior: { type: "oscillate", count: 2, decay: 1.5 } },
  ];
};

export const hitmarkerMontage: VectorEffect = {
  kind: "vector",
  id: "hitmarker-montage",
  name: "Hitmarker montage",
  description:
    "A montage-parody volley: hit markers slamming down one after another at points across the frame, a score popping up and floating off each, the frame jolting with every hit and the last one in red.",
  category: "meme",
  tags: ["meme", "reaction", "hitmarker", "montage", "game", "fps", "score", "shake", "overlay"],
  hold: 900,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Headshots", values: { marker: [1, 0.2, 0.2], score: "+HEADSHOT", scoreInk: [1, 0.2, 0.2] } },
    { name: "Rapid fire", values: { pace: 0.12, points: "0.3,0.5 0.36,0.56 0.42,0.5 0.5,0.58 0.56,0.5 0.62,0.56 0.68,0.5 0.74,0.58" } },
    { name: "Steady", values: { shake: 0 } },
  ],
  derived: (v) => {
    const points = readPoints(v.points, HM_SLOTS, HM_POINTS);
    const pace = Math.round(Number(v.pace) * 1000);
    const shake = Number(v.shake);
    const marker = rgbToHex(v.marker as number[]);
    const kill = v.finale ? rgbToHex(v.kill as number[]) : marker;
    const out: Record<string, string | number> = { shakeMs: Math.min(220, pace) };
    for (let i = 0; i < HM_SLOTS; i++) {
      const [x, y] = at(...(points[i] ?? points[points.length - 1]!));
      const on = i < points.length;
      const start = 150 + Math.min(i, points.length) * pace;
      Object.assign(out, {
        [`hon${i}`]: on ? "inline" : "none",
        [`hx${i}`]: x,
        [`hy${i}`]: y,
        [`hc${i}`]: i === points.length - 1 ? kill : marker,
        [`hsx${i}`]: on ? r1(shake * (i % 2 ? -1 : 1)) : 0,
        [`hsy${i}`]: on ? r1(shake * 0.6) : 0,
        [`hat${i}`]: start,
      });
      for (const [k, after] of Object.entries(HM_TIMES)) out[`h${k}${i}`] = start + after;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{points: text default='${HM_POINTS}' label='Hits (x,y 0–1, y up)'}} {{score: text default='+100' label='Score'}} {{pace: float min=0.08 max=1.5 default=0.32 step=0.01 label='Seconds between hits'}} {{size: float min=0.5 max=2.5 default=1.25 step=0.05 label='Size'}} {{weight: float min=2 max=9 default=4.5 step=0.5 label='Tick weight'}} {{shake: float min=0 max=12 default=4 step=0.5 label='Shake'}} {{marker: color default=#FFFFFF label='Marker'}} {{finale: bool default=true label='Last hit in red'}} {{kill: color default=#FF2A2A label='Last hit'}} {{scoreInk: color default=#FFD60A label='Score colour'}} {{font: text default="${IMPACT}" label='Font'}} ${BACKDROP} --><defs><filter id="hmShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.6"/></filter></defs><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g id="hmShake" transform="translate(0 0)">${Array.from({ length: HM_SLOTS }, (_, i) => hmSlot(i)).join("")}</g></svg>`,
    animate: Array.from({ length: HM_SLOTS }, (_, i) => hmHit(i)).flat(),
  },
};

// ── Reaction rain ──────────────────────────────────────────────────────

const RR_SLOTS = 18;
const EMOJI = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', sans-serif`;

/** The reactions to pick from: words split at spaces, or else each glyph (an emoji with its modifiers is one). */
function glyphList(text: unknown): string[] {
  const s = String(text ?? "").trim();
  if (!s) return ["❤"];
  if (/\s/.test(s)) return s.split(/\s+/);
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (g) => g.segment);
  return Array.from(s);
}

const rrSlot = (i: number) =>
  `<g display="{{ron${i}}}"><g id="rrRise${i}" transform="translate({{rx${i}}} 410)" opacity="0"><g id="rrWob${i}" transform="translate(0 0)"><g id="rrPop${i}" transform="scale(0.2)"><text y="{{rb${i}}}" text-anchor="middle" font-size="{{rs${i}}}">{{rg${i}}}</text></g></g></g></g>`;

const rrFloat = (i: number): SvgAnimation[] => [
  { id: `rrRise${i}`, attrs: { transform: [`translate({{rx${i}}} 410)`, `{{rto${i}}}`] }, delay: n(`rd${i}`), ms: n(`rm${i}`), ease: [0.2, 0.5, 0.6, 1] },
  { id: `rrRise${i}`, attrs: { opacity: [0, 1] }, delay: n(`rd${i}`), ms: 150 },
  { id: `rrPop${i}`, attrs: { transform: ["scale(0.2)", "scale(1)"] }, delay: n(`rd${i}`), ms: 600, ease: { spring: { stiffness: 260, damping: 12 } } },
  { id: `rrWob${i}`, attrs: { transform: ["translate(0 0)", `translate({{rw${i}}} 0)`] }, delay: n(`rd${i}`), ms: n(`rm${i}`), ease: "linear", behavior: { type: "oscillate", count: 1.5 + (i % 3) * 0.5 } },
  { id: `rrRise${i}`, attrs: { opacity: [1, 0] }, delay: n(`rf${i}`), ms: n(`rfm${i}`), ease: "in-out" },
];

export const reactionRain: VectorEffect = {
  kind: "vector",
  id: "reaction-rain",
  name: "Reaction rain",
  description:
    "Live-stream reactions floating up the side of the frame: emoji (or any glyphs or words) popping in at the bottom, wobbling as they rise and fading out near the top.",
  category: "meme",
  tags: ["meme", "reaction", "emoji", "live", "stream", "heart", "float", "social", "overlay"],
  hold: 300,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Left side", values: { side: 0.14 } },
    { name: "Hearts", values: { glyphs: "❤️ 💖 💕 😍" } },
    { name: "Flood", values: { count: 18, rate: 10, spread: 0.4, side: 0.5 } },
  ],
  derived: (v) => {
    const glyphs = glyphList(v.glyphs);
    const count = Math.max(1, Math.min(RR_SLOTS, Math.round(Number(v.count))));
    const rate = Math.max(0.5, Number(v.rate));
    const speed = Math.max(0.2, Number(v.speed));
    const out: Record<string, string | number> = {};
    for (let i = 0; i < RR_SLOTS; i++) {
      const x = Math.min(W - 24, Math.max(24, Number(v.side) * W + (rand(i + 11) - 0.5) * 2 * Number(v.spread) * W));
      const size = r1((32 + 18 * rand(i + 19)) * Number(v.scale));
      const delay = 100 + Math.round((i * 1000) / rate + rand(i + 29) * (500 / rate));
      const ms = Math.round((2300 + 900 * rand(i + 37)) / speed);
      Object.assign(out, {
        [`ron${i}`]: i < count ? "inline" : "none",
        [`rg${i}`]: glyphs[Math.floor(rand(i * 7 + 3) * glyphs.length)]!,
        [`rx${i}`]: r1(x),
        [`rto${i}`]: `translate(${r1(x + (rand(i + 53) - 0.5) * 40)} ${r1(40 + 90 * rand(i + 41))})`,
        [`rs${i}`]: size,
        [`rb${i}`]: r1(size * 0.35),
        [`rw${i}`]: r1((8 + 10 * rand(i + 61)) * (i % 2 ? -1 : 1)),
        [`rd${i}`]: delay,
        [`rm${i}`]: ms,
        [`rf${i}`]: delay + Math.round(ms * 0.6),
        [`rfm${i}`]: Math.round(ms * 0.4),
      });
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{glyphs: text default='😂🔥💀' label='Reactions'}} {{count: int min=1 max=${RR_SLOTS} default=14 label='How many'}} {{rate: float min=0.5 max=12 default=5 step=0.5 label='A second'}} {{speed: float min=0.4 max=2.5 default=1 step=0.1 label='Rise speed'}} {{side: float min=0 max=1 default=0.86 step=0.01 label='Column across'}} {{spread: float min=0 max=0.5 default=0.08 step=0.01 label='Column width'}} {{scale: float min=0.5 max=2.5 default=1 step=0.05 label='Size'}} {{font: text default="${EMOJI}" label='Font'}} ${BACKDROP} --><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g font-family="{{font}}">${Array.from({ length: RR_SLOTS }, (_, i) => rrSlot(i)).join("")}</g></svg>`,
    animate: Array.from({ length: RR_SLOTS }, (_, i) => rrFloat(i)).flat(),
  },
};

// ── Word art ───────────────────────────────────────────────────────────

const WA_LAYERS = 9;
const WA_MID = 180;
/** A heavy face, as the 90s set it. */
const WA_FONT = `'Arial Black', 'Arial Bold', Impact, 'Helvetica Neue', sans-serif`;

/** Each letter's place and turn: set along a line that arches (`arch`) and waves (`wave`), both −1 to 1. */
function wordArtLetters(text: string, size: number, arch: number, wave: number, base: number) {
  const chars = Array.from(text);
  const advances = chars.map((c) => Math.max(0.25, textWidthEm(c)) * size);
  const total = Math.max(1, advances.reduce((a, b) => a + b, 0));
  const amp = 70;
  const xs: number[] = [];
  const ys: number[] = [];
  const turns: number[] = [];
  let x = W / 2 - total / 2;
  for (const advance of advances) {
    const u = (x - (W / 2 - total / 2) + advance / 2) / total;
    const lift = arch * amp * (1 - (2 * u - 1) ** 2) - wave * amp * 0.55 * Math.sin(2 * Math.PI * u);
    const slope = (arch * amp * 4 * (2 * u - 1) + wave * amp * 0.55 * 2 * Math.PI * Math.cos(2 * Math.PI * u)) / total;
    xs.push(r1(x + advance / 2));
    ys.push(r1(base - lift));
    turns.push(r1((Math.atan(slope) * 180) / Math.PI));
    x += advance;
  }
  return { xs: xs.join(" "), ys: ys.join(" "), turns: turns.join(" "), width: total };
}

const waLetters = (rest: string) => `<text x="{{xs}}" y="{{ys}}" rotate="{{turns}}" text-anchor="middle" font-family="{{font}}" font-size="{{size}}" font-weight="900" ${rest}>{{text}}</text>`;

export const wordArtText: VectorEffect = {
  kind: "vector",
  id: "wordart-text",
  name: "Word art",
  description:
    "90s word art: chunky letters in a rainbow gradient that flows along them, skewed, with a deep 3D extrude growing out behind, set on a wave or an arch, spinning in with a bounce.",
  category: "meme",
  tags: ["meme", "caption", "retro", "word-art", "rainbow", "3d", "extrude", "90s", "text"],
  hold: 1800,
  presets: [
    { name: "Overlay", values: { backdrop: 0 } },
    { name: "Arch", values: { arch: 0.8, wave: 0 } },
    { name: "Big wave", values: { wave: 1, arch: 0, skew: 0 } },
    { name: "Chrome", values: { c1: [0.98, 0.98, 1], c2: [0.55, 0.6, 0.68], c3: [0.95, 0.96, 0.98], c4: [0.4, 0.44, 0.52], c5: [0.85, 0.87, 0.9], side: [0.16, 0.18, 0.24] } },
    { name: "Flat", values: { depth: 0, skew: 0, wave: 0 } },
  ],
  derived: (v) => {
    const text = String(v.text ?? "");
    const { size } = fit(text, 540, 110);
    const base = r1(WA_MID + size * 0.36);
    const letters = wordArtLetters(text, size, Number(v.arch), Number(v.wave), base);
    const depth = Number(v.depth);
    const out: Record<string, string | number> = {
      ...letters,
      size,
      skewAt: `translate(${W / 2} ${base}) skewX(${r1(Number(v.skew))}) translate(${-W / 2} ${-base})`,
      gx1: r1(W / 2 - letters.width / 2),
      gx2: r1(W / 2 + letters.width / 2),
      gx1To: v.flow ? r1(W / 2 + letters.width / 2) : r1(W / 2 - letters.width / 2),
      gx2To: v.flow ? r1(W / 2 + (letters.width * 3) / 2) : r1(W / 2 + letters.width / 2),
      stroke: r1(Math.max(0, Number(v.thickness)) * size * 0.04),
    };
    for (let k = 1; k <= WA_LAYERS; k++) out[`wa${k}`] = `translate(${r1((k / WA_LAYERS) * depth * 16)} ${r1((k / WA_LAYERS) * depth * 22)})`;
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${W} ${H}"><!-- {{text: text default='TOTALLY RAD' label='Text'}} {{wave: float min=-1 max=1 default=0.5 step=0.05 label='Wave'}} {{arch: float min=-1 max=1 default=0 step=0.05 label='Arch'}} {{skew: float min=-30 max=30 default=-12 step=1 label='Skew (°)'}} {{depth: float min=0 max=2 default=1 step=0.05 label='Extrude depth'}} {{thickness: float min=0 max=3 default=1 step=0.1 label='Outline'}} {{flow: bool default=true label='Flowing colours'}} {{c1: color default=#FF2D2D label='Colour 1'}} {{c2: color default=#FFC400 label='Colour 2'}} {{c3: color default=#27D845 label='Colour 3'}} {{c4: color default=#2D7BFF label='Colour 4'}} {{c5: color default=#B03DFF label='Colour 5'}} {{side: color default=#3A1D6E label='Extrude'}} {{outline: color default=#14102A label='Outline colour'}} {{font: text default="${WA_FONT}" label='Font'}} ${BACKDROP} --><defs><linearGradient id="waRainbow" gradientUnits="userSpaceOnUse" x1="{{gx1}}" y1="0" x2="{{gx2}}" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="{{c1}}"/><stop offset="0.2" stop-color="{{c2}}"/><stop offset="0.4" stop-color="{{c3}}"/><stop offset="0.6" stop-color="{{c4}}"/><stop offset="0.8" stop-color="{{c5}}"/><stop offset="1" stop-color="{{c1}}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="{{background}}" opacity="{{backdrop}}"/><g id="waArt" transform="${about(W / 2, WA_MID, 0, 0, -20)}"><g transform="{{skewAt}}">${Array.from(
      { length: WA_LAYERS },
      (_, j) => {
        const k = WA_LAYERS - j;
        return `<g id="waLayer${k}" transform="translate(0 0)">${waLetters(k === WA_LAYERS ? `fill="{{side}}" stroke="{{outline}}" stroke-width="{{stroke}}" stroke-linejoin="round" paint-order="stroke"` : `fill="{{side}}"`)}</g>`;
      },
    ).join("")}${waLetters(`fill="url(#waRainbow)" stroke="{{outline}}" stroke-width="{{stroke}}" stroke-linejoin="round"`)}</g></g></svg>`,
    animate: [
      // It spins in past its size and settles, then the extrude grows out behind and the colours flow.
      ...keys("waArt", "transform", [
        [0, about(W / 2, WA_MID, 0, 0, -20)],
        [380, about(W / 2, WA_MID, 1.12, 1.12, 4)],
        [520, about(W / 2, WA_MID, 0.96, 0.96, -1)],
        [640, about(W / 2, WA_MID, 1)],
      ], { ease: "out" }),
      ...Array.from({ length: WA_LAYERS }, (_, j): SvgAnimation => ({ id: `waLayer${j + 1}`, attrs: { transform: ["translate(0 0)", `{{wa${j + 1}}}`] }, delay: 300, ms: 450, ease: "out" })),
      { id: "waRainbow", attrs: { x1: ["{{gx1}}", "{{gx1To}}"], x2: ["{{gx2}}", "{{gx2To}}"] }, delay: 640, ms: 2200, ease: "linear" },
    ],
  },
};

export const memeEffects: VectorEffect[] = [impactCaption, dealWithIt, stonksChart, errorCascade, bonk, hitmarkerMontage, reactionRain, wordArtText];
