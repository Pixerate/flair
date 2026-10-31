import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, fit, holdControl, holds, ms, outTimes, r1, SANS } from "./broadcast.js";
import { textWidthEm } from "./images.js";
import type { VectorEffect } from "./types.js";

/*
 * Horror drawn as vectors. The emergency broadcast is a full-frame card in
 * the broadcast graphics' 1920 × 1080 frame and title-safe area (see
 * `broadcast.ts`): it switches on like an old set, holds for its `hold`
 * control and switches off, ending as it started.
 */

/** How long the card takes to come on, until its message is up (ms). */
const EMERGENCY_IN = 1600;

/** The whole card squashed to a line (`y`) and to a point (`x`), about the frame's middle. */
const tube = (x: number, y: number) => `translate(960 540) scale(${x} ${y}) translate(-960 -540)`;

const emergencyBroadcastMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{header: text default='EMERGENCY ALERT SYSTEM' label='Header'}} {{title: text default='DO NOT LOOK OUTSIDE' label='Title'}} {{message: text default='Stay indoors. Cover every window. Do not answer the door, whoever it sounds like.' label='Message'}} {{footer: text default='THIS IS NOT A TEST' label='Footer'}} {{background: color default=#08080A label='Background'}} {{ink: color default=#FFFFFF label='Text colour'}} {{muted: color default=#B8BCC6 label='Message colour'}} {{alert: color default=#D7141E label='Alert colour'}} ${holdControl(4)} {{font: text default="${SANS}" label='Font'}} --><defs><clipPath id="emergencyBroadcastTitleClip"><rect id="emergencyBroadcastTitleWipe" x="192" y="0" width="0" height="1080"/></clipPath></defs><rect width="1920" height="1080" fill="#000000"/><g id="emergencyBroadcastAll" transform="${tube(0, 0.01)}"><rect width="1920" height="1080" fill="{{background}}"/><rect id="emergencyBroadcastPulse" width="1920" height="1080" fill="{{alert}}" opacity="0"/><rect id="emergencyBroadcastBar" x="192" y="150" width="0" height="110" fill="{{alert}}"/><text id="emergencyBroadcastHeader" x="960" y="{{headerBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{headerSize}}" font-weight="800" letter-spacing="4" textLength="{{headerW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="0">{{header}}</text><g clip-path="url(#emergencyBroadcastTitleClip)"><text x="960" y="{{titleBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{titleSize}}" font-weight="900" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{title}}</text></g><text id="emergencyBroadcastMessage" x="960" y="{{messageBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{messageSize}}" font-weight="500" textLength="{{messageW}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}" opacity="0">{{message}}</text><text id="emergencyBroadcastFooter" x="960" y="900" text-anchor="middle" font-family="{{font}}" font-size="{{footerSize}}" font-weight="800" letter-spacing="6" textLength="{{footerW}}" lengthAdjust="spacingAndGlyphs" fill="{{alert}}" opacity="0">{{footer}}</text><rect id="emergencyBroadcastGlow" width="1920" height="1080" fill="#FFFFFF" opacity="1"/></g></svg>`,
  animate: [
    // Switches on like an old set: a bright line opening out, then the picture.
    { id: "emergencyBroadcastAll", attrs: { transform: [tube(0, 0.01), tube(1, 0.01)] }, ms: 160, ease: "out" },
    { id: "emergencyBroadcastAll", attrs: { transform: [tube(1, 0.01), tube(1, 1)] }, delay: 160, ms: 200, ease: "out" },
    { id: "emergencyBroadcastGlow", attrs: { opacity: [1, 0] }, delay: 200, ms: 300, ease: "out" },
    // The header bar, the title wiping on and the message under it.
    { id: "emergencyBroadcastBar", attrs: { width: [0, 1536] }, delay: 350, ms: 400, ease: "out" },
    { id: "emergencyBroadcastHeader", attrs: { opacity: [0, 1] }, delay: 550, ms: 200 },
    { id: "emergencyBroadcastTitleWipe", attrs: { width: [0, 1536] }, delay: 700, ms: 600, ease: "in-out" },
    { id: "emergencyBroadcastMessage", attrs: { opacity: [0, 1] }, delay: 1200, ms: 400, ease: "out" },
    // A slow red pulse over it all, and the footer blinking twice a second.
    { id: "emergencyBroadcastPulse", attrs: { opacity: [0, 0.1] }, delay: 700, ms: 700, repeat: 4, alternate: true },
    ...holds("emergencyBroadcastFooter", "opacity", [
      [0, 0],
      [EMERGENCY_IN, 1],
      [EMERGENCY_IN + 250, 0.2],
      [EMERGENCY_IN + 500, 1],
      [EMERGENCY_IN + 750, 0.2],
      [EMERGENCY_IN + 1000, 1],
      [EMERGENCY_IN + 1250, 0.2],
      [EMERGENCY_IN + 1500, 1],
    ]),
    // Switches off: squashed to a bright line, then to nothing.
    { id: "emergencyBroadcastGlow", attrs: { opacity: [0, 1] }, delay: after(0), ms: 140 },
    { id: "emergencyBroadcastAll", attrs: { transform: [tube(1, 1), tube(1, 0.01)] }, delay: after(0), ms: 180 },
    { id: "emergencyBroadcastAll", attrs: { transform: [tube(1, 0.01), tube(0, 0.01)] }, delay: after(180), ms: 160 },
  ],
};

export const emergencyBroadcast: VectorEffect = {
  kind: "vector",
  id: "emergency-broadcast",
  name: "Emergency broadcast",
  description:
    "A fictional emergency alert taking over the screen like an old set switching on: a red header bar, a stark warning wiping on, instructions under it and a blinking footer, under a slow red pulse, then the set switching off.",
  category: "horror",
  tags: ["horror", "analog-horror", "broadcast", "emergency", "alert", "warning", "title", "card", "found-footage"],
  hold: 300,
  presets: [
    { name: "Civil defence", values: { header: "CIVIL DEFENCE BROADCAST", alert: [0.95, 0.65, 0.05], background: [0.02, 0.03, 0.08] } },
    { name: "Blue screen", values: { background: [0.04, 0.12, 0.6], alert: [1, 1, 1], muted: [0.85, 0.88, 1] } },
    { name: "Curfew", values: { title: "CURFEW IN EFFECT", message: "Remain indoors from sundown until further notice. Do not let anyone in." } },
  ],
  derived: (v) => {
    const header = fit(v.header, 1400, 60);
    const title = fit(v.title, 1440, 150);
    const message = fit(v.message, 1440, 46);
    const footer = fit(v.footer, 1200, 44);
    const titleBase = 470 + title.size * 0.36;
    return {
      ...outTimes(emergencyBroadcastMotion, EMERGENCY_IN + ms(v.hold)),
      headerSize: header.size,
      headerW: header.width,
      headerBase: r1(205 + header.size * 0.35),
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(titleBase),
      messageSize: message.size,
      messageW: message.width,
      messageBase: r1(titleBase + 70 + message.size * 0.75),
      footerSize: footer.size,
      footerW: footer.width,
    };
  },
  motion: emergencyBroadcastMotion,
};

/** Poltergeist's interface pieces: where each rests (its middle), how high it lifts and which way it tips. */
const PIECES = [
  { id: "poltergeistCard", x: 150, y: 140, lift: 70, tip: -9 },
  { id: "poltergeistButton", x: 300, y: 205, lift: 55, tip: 12 },
  { id: "poltergeistAvatar", x: 300, y: 95, lift: 85, tip: -18 },
  { id: "poltergeistToggle", x: 125, y: 240, lift: 45, tip: 7 },
] as const;

/** When the pieces start trembling, lift, are dropped and when everything has settled (ms). */
const TREMBLE_AT = 400;
const LIFT_AT = 900;
const SLAM_AT = 3000;

const at = (x: number, y: number, r = 0) => `translate(${x} ${y}) rotate(${r})`;

export const poltergeist: VectorEffect = {
  kind: "vector",
  id: "poltergeist",
  name: "Poltergeist",
  description:
    "An app screen where something unseen takes hold: a card, a button, an avatar and a toggle tremble, lift off and wobble in the air, then slam back down at once, shaking the screen and puffing up dust.",
  category: "horror",
  tags: ["horror", "spectral", "poltergeist", "ui", "haunted", "shake", "levitate", "card"],
  hold: 900,
  presets: [
    { name: "Dark mode", values: { background: [0.07, 0.08, 0.1], surface: [0.14, 0.15, 0.19], ink: [0.9, 0.92, 0.96], accent: [0.55, 0.45, 1] } },
    { name: "Violent", values: { amount: 1.8 } },
    { name: "Unsettled", values: { amount: 0.4 } },
  ],
  derived: (v) => {
    const a = Number(v.amount);
    return Object.fromEntries(
      PIECES.flatMap((piece, i) => [
        [`up${i}`, at(piece.x, r1(piece.y - piece.lift * a), r1(piece.tip * a))],
        [`wob${i}`, at(r1(piece.x + 14 * a), r1(piece.y - piece.lift * a - 10 * a), r1(piece.tip * a + 16 * a))],
      ]),
    );
  },
  motion: (() => {
    const rest = (i: number) => at(PIECES[i]!.x, PIECES[i]!.y);
    const shadow = (i: number, w: number) =>
      `<ellipse id="poltergeistShadow${i}" cx="${PIECES[i]!.x}" cy="${PIECES[i]!.y + w}" rx="${w * 1.3}" ry="6" fill="#000000" opacity="0.12" transform="translate(${PIECES[i]!.x} ${PIECES[i]!.y + w}) scale(1) translate(-${PIECES[i]!.x} -${PIECES[i]!.y + w})"/>`;
    const dust = (i: number, w: number) =>
      [-1, 1].map((side, k) => `<circle id="poltergeistDust${i}${k}" cx="${PIECES[i]!.x + side * w}" cy="${PIECES[i]!.y + w * 0.6}" r="0" fill="{{ink}}" opacity="0"/>`).join("");
    const halfH = [58, 20, 30, 16];
    const halfW = [90, 50, 30, 30];
    return {
      svg: `<svg viewBox="0 0 400 300"><!-- {{title: text default='Untitled' label='Card title'}} {{label: text default='Submit' label='Button label'}} {{background: color default=#F3F4F6 label='Background'}} {{surface: color default=#FFFFFF label='Surface'}} {{ink: color default=#1F2937 label='Ink'}} {{accent: color default=#6366F1 label='Accent'}} {{amount: float min=0.2 max=2 default=1 step=0.1 label='Intensity'}} {{font: text default='system-ui, sans-serif' label='Font'}} --><rect width="400" height="300" fill="{{background}}"/><g id="poltergeistScreen" transform="translate(0 0)" font-family="{{font}}">${PIECES.map((_, i) => shadow(i, halfH[i]!)).join("")}${PIECES.map((_, i) => dust(i, halfW[i]!)).join("")}<g id="poltergeistCard" transform="${rest(0)}"><rect x="-90" y="-58" width="180" height="116" rx="12" fill="{{surface}}" stroke="{{ink}}" stroke-opacity="0.12"/><rect x="-74" y="-42" width="148" height="44" rx="6" fill="{{accent}}" opacity="0.18"/><text x="-74" y="24" font-size="15" font-weight="700" fill="{{ink}}">{{title}}</text><rect x="-74" y="34" width="110" height="7" rx="3.5" fill="{{ink}}" opacity="0.18"/></g><g id="poltergeistButton" transform="${rest(1)}"><rect x="-50" y="-20" width="100" height="40" rx="20" fill="{{accent}}"/><text x="0" y="5" text-anchor="middle" font-size="14" font-weight="700" fill="#FFFFFF">{{label}}</text></g><g id="poltergeistAvatar" transform="${rest(2)}"><circle r="30" fill="{{surface}}" stroke="{{ink}}" stroke-opacity="0.12"/><circle cy="-7" r="10" fill="{{ink}}" opacity="0.35"/><path d="M-18 20 Q0 2 18 20" fill="{{ink}}" opacity="0.35"/></g><g id="poltergeistToggle" transform="${rest(3)}"><rect x="-30" y="-16" width="60" height="32" rx="16" fill="{{accent}}"/><circle cx="14" r="12" fill="#FFFFFF"/></g></g></svg>`,
      animate: [
        ...PIECES.flatMap((piece, i): SvgAnimation[] => [
          // A tremble, then it lifts and tips; wobbles in the air; and is dropped.
          { id: piece.id, attrs: { transform: [rest(i), at(piece.x + 2, piece.y - 1, 2)] }, delay: TREMBLE_AT + i * 60, ms: LIFT_AT - TREMBLE_AT - i * 60, behavior: { type: "oscillate", count: 7 + i } },
          { id: piece.id, attrs: { transform: [rest(i), `{{up${i}}}`] }, delay: LIFT_AT + i * 90, ms: 650, ease: "out" },
          { id: piece.id, attrs: { transform: [`{{up${i}}}`, `{{wob${i}}}`] }, delay: LIFT_AT + 650 + i * 90, ms: SLAM_AT - LIFT_AT - 650 - i * 90, behavior: { type: "wriggle", frequency: 1.6 + 0.3 * i, seed: 5 + i * 11 } },
          { id: piece.id, attrs: { transform: [`{{up${i}}}`, rest(i)] }, delay: SLAM_AT, ms: 120, ease: [0.55, 0, 1, 0.45] },
          { id: `poltergeistShadow${i}`, attrs: { opacity: [0.12, 0.04] }, delay: LIFT_AT + i * 90, ms: 650, ease: "out" },
          { id: `poltergeistShadow${i}`, attrs: { opacity: [0.04, 0.12] }, delay: SLAM_AT, ms: 120 },
          // Dust puffing out from under it on impact.
          ...[0, 1].flatMap((k): SvgAnimation[] => [
            { id: `poltergeistDust${i}${k}`, attrs: { r: [2, 14], opacity: [0.35, 0], cx: [PIECES[i]!.x + (k ? 1 : -1) * halfW[i]!, PIECES[i]!.x + (k ? 1 : -1) * (halfW[i]! + 22)] }, delay: SLAM_AT + 120, ms: 520, ease: "out" },
          ]),
        ]),
        // The whole screen shakes from the impact and settles.
        { id: "poltergeistScreen", attrs: { transform: ["translate(0 0)", "translate(0 6)"] }, delay: SLAM_AT + 120, ms: 420, behavior: { type: "oscillate", count: 4, decay: 2 } },
      ],
    };
  })(),
};

// ── Loaders ────────────────────────────────────────────────────────────

/** Coffin loader: the coffin's outline in its 120 box, and its lid's pose (slid and swung about its top-left corner). */
const COFFIN = "M50 16 H70 L84 38 L76 104 H44 L36 38 Z";
const lid = (x: number, y: number, deg: number) => `translate(${x} ${y}) rotate(${deg} 36 38)`;
const COFFIN_OPEN = 600;
const COFFIN_SLAM = 2250;

export const coffinLoader: VectorEffect = {
  kind: "vector",
  id: "coffin-loader",
  name: "Coffin loader",
  description: "A coffin whose lid jolts, then creaks open to show a pair of eyes in the dark that blink, before it slams shut again in a puff of dust.",
  category: "loader",
  tags: ["loader", "horror", "halloween", "coffin", "vampire", "waiting", "icon"],
  hold: 500,
  presets: [
    { name: "Ebony", values: { wood: [0.12, 0.1, 0.1], trim: [0.75, 0.75, 0.8] } },
    { name: "Green eyes", values: { eyes: [0.45, 1, 0.4] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{wood: color default=#5A3A26 label='Wood'}} {{trim: color default=#C9A86A label='Trim'}} {{inside: color default=#0C0A0E label='Inside'}} {{eyes: color default=#FF3B2F label='Eyes'}} {{dust: color default=#A89F94 label='Dust'}} --><path d="${COFFIN}" fill="{{inside}}"/><g id="coffinLoaderEyes" opacity="0" fill="{{eyes}}"><ellipse id="coffinLoaderEyeL" cx="54" cy="46" rx="3" ry="2.2"/><ellipse id="coffinLoaderEyeR" cx="66" cy="46" rx="3" ry="2.2"/></g><g id="coffinLoaderLid" transform="${lid(0, 0, 0)}"><path d="${COFFIN}" fill="{{wood}}" stroke="{{trim}}" stroke-width="2" stroke-linejoin="round"/><path d="M60 34 V78 M50 47 H70" stroke="{{trim}}" stroke-width="4" stroke-linecap="round"/></g><circle id="coffinLoaderDust0" cx="42" cy="104" r="0" fill="{{dust}}" opacity="0"/><circle id="coffinLoaderDust1" cx="78" cy="104" r="0" fill="{{dust}}" opacity="0"/></svg>`,
    animate: [
      // A jolt from inside, then the lid creaks open in stutters.
      { id: "coffinLoaderLid", attrs: { transform: [lid(0, 0, 0), lid(2, -1, 2)] }, delay: 200, ms: 90, ease: "out" },
      { id: "coffinLoaderLid", attrs: { transform: [lid(2, -1, 2), lid(0, 0, 0)] }, delay: 290, ms: 90, ease: "in-out" },
      { id: "coffinLoaderLid", attrs: { transform: [lid(0, 0, 0), lid(24, -4, 16)] }, delay: COFFIN_OPEN, ms: 700, ease: "out", strobe: 10 },
      // Eyes in the dark, a blink, gone.
      { id: "coffinLoaderEyes", attrs: { opacity: [0, 1] }, delay: 1150, ms: 250 },
      ...(["coffinLoaderEyeL", "coffinLoaderEyeR"] as const).flatMap((id): SvgAnimation[] => [
        { id, attrs: { ry: [2.2, 0.2] }, delay: 1800, ms: 80 },
        { id, attrs: { ry: [0.2, 2.2] }, delay: 1880, ms: 80 },
      ]),
      { id: "coffinLoaderEyes", attrs: { opacity: [1, 0] }, delay: 2150, ms: 80 },
      // Slammed shut, dust puffing out of the corners.
      { id: "coffinLoaderLid", attrs: { transform: [lid(24, -4, 16), lid(0, 0, 0)] }, delay: COFFIN_SLAM, ms: 150, ease: [0.55, 0, 1, 0.45] },
      ...[0, 1].flatMap((k) => [
        ...holds(`coffinLoaderDust${k}`, "r", [[0, 0]]),
        ...holds(`coffinLoaderDust${k}`, "opacity", [[0, 0]]),
        { id: `coffinLoaderDust${k}`, attrs: { r: [2, 10], opacity: [0.55, 0] }, delay: COFFIN_SLAM + 150, ms: 500, ease: "out" } satisfies SvgAnimation,
        ...holds(`coffinLoaderDust${k}`, "r", [[COFFIN_SLAM + 650, 0]]),
      ]),
    ],
  },
};

/** Candle burndown: how long it burns, and how far its top comes down. */
const BURN = 2600;
const BURN_DROP = 44;
const flameScale = (x: number, y: number) => `translate(60 33) scale(${x} ${y}) translate(-60 -33)`;

export const candleBurndown: VectorEffect = {
  kind: "vector",
  id: "candle-burndown",
  name: "Candle burndown",
  description: "A candle burning down to a stub as its flame flickers and wax pools at its base, then blowing out in a curl of smoke and fading back to a fresh one.",
  category: "loader",
  tags: ["loader", "horror", "halloween", "candle", "flames", "progress", "waiting"],
  hold: 0,
  presets: [
    { name: "Black wax", values: { wax: [0.14, 0.13, 0.15], plate: [0.55, 0.5, 0.42] } },
    { name: "Witch light", values: { flame: [0.45, 1, 0.5], core: [0.9, 1, 0.9] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{wax: color default=#EFE6D2 label='Wax'}} {{plate: color default=#4B4F58 label='Holder'}} {{wick: color default=#2A2420 label='Wick'}} {{flame: color default=#FFB347 label='Flame'}} {{core: color default=#FFF3C4 label='Flame core'}} {{smoke: color default=#9AA0A8 label='Smoke'}} --><ellipse cx="60" cy="104" rx="32" ry="7" fill="{{plate}}"/><g id="candleBurndownCandle" opacity="1"><ellipse id="candleBurndownPool" cx="60" cy="102" rx="0" ry="3" fill="{{wax}}"/><rect id="candleBurndownWax" x="50" y="40" width="20" height="62" fill="{{wax}}"/><ellipse id="candleBurndownTop" cx="60" cy="40" rx="10" ry="3" fill="{{wax}}" stroke="{{plate}}" stroke-opacity="0.25"/><g id="candleBurndownWick" transform="translate(0 0)"><line x1="60" y1="40" x2="60" y2="33" stroke="{{wick}}" stroke-width="1.6" stroke-linecap="round"/><g id="candleBurndownFlame" transform="${flameScale(1, 1)}"><path d="M60 33 C55 27 56 20 60 11 C64 20 65 27 60 33 Z" fill="{{flame}}"/><path d="M60 32 C58 28 58.5 24 60 19 C61.5 24 62 28 60 32 Z" fill="{{core}}"/></g></g><path id="candleBurndownSmoke" d="M60 76 C56 68 64 62 60 54 C56 46 63 40 60 30" fill="none" stroke="{{smoke}}" stroke-width="2" stroke-linecap="round" opacity="0"/></g></svg>`,
    animate: [
      // It burns down, the flame flickering, wax pooling at the base.
      { id: "candleBurndownWax", attrs: { y: [40, 40 + BURN_DROP], height: [62, 62 - BURN_DROP] }, ms: BURN, ease: "linear" },
      { id: "candleBurndownTop", attrs: { cy: [40, 40 + BURN_DROP] }, ms: BURN, ease: "linear" },
      { id: "candleBurndownWick", attrs: { transform: ["translate(0 0)", `translate(0 ${BURN_DROP})`] }, ms: BURN, ease: "linear" },
      { id: "candleBurndownFlame", attrs: { transform: [flameScale(1, 1), flameScale(0.85, 1.2)] }, ms: BURN, behavior: { type: "wriggle", frequency: 4, seed: 6 } },
      { id: "candleBurndownPool", attrs: { rx: [0, 15] }, ms: BURN, ease: "out" },
      // Out, a curl of smoke, and it fades away.
      { id: "candleBurndownFlame", attrs: { transform: [flameScale(1, 1), flameScale(0, 0)] }, delay: BURN, ms: 180, ease: "in-out" },
      { id: "candleBurndownSmoke", attrs: { opacity: [0, 0.7] }, delay: BURN + 100, ms: 200 },
      { id: "candleBurndownSmoke", attrs: { opacity: [0.7, 0] }, delay: BURN + 300, ms: 500, ease: "out" },
      { id: "candleBurndownCandle", attrs: { opacity: [1, 0] }, delay: BURN + 500, ms: 250 },
      // Unseen, a fresh candle; it fades back in, lit.
      ...holds("candleBurndownWax", "y", [[BURN + 750, 40]]),
      ...holds("candleBurndownWax", "height", [[BURN + 750, 62]]),
      ...holds("candleBurndownTop", "cy", [[BURN + 750, 40]]),
      ...holds("candleBurndownWick", "transform", [[BURN + 750, "translate(0 0)"]]),
      ...holds("candleBurndownFlame", "transform", [[BURN + 750, flameScale(1, 1)]]),
      ...holds("candleBurndownPool", "rx", [[BURN + 750, 0]]),
      { id: "candleBurndownCandle", attrs: { opacity: [0, 1] }, delay: BURN + 760, ms: 300 },
    ],
  },
};

/** Ghost loader: a ghost's body round (0, 0) with its hem in one of two waves (the same commands, so it morphs). */
const ghostBody = (up: number, down: number) =>
  `M-12 6 V-2 C-12 -10 -7 -15 0 -15 C7 -15 12 -10 12 -2 V6 Q10 ${up} 8 6 Q6 ${down} 4 6 Q2 ${up} 0 6 Q-2 ${down} -4 6 Q-6 ${up} -8 6 Q-10 ${down} -12 6 Z`;
const GHOST_A = ghostBody(11, 2);
const GHOST_B = ghostBody(2, 11);
const GHOST_LAP = 2000;

export const ghostLoader: VectorEffect = {
  kind: "vector",
  id: "ghost-loader",
  name: "Ghost loader",
  description: "A little ghost floating round in a circle, its hem rippling and fainter copies of it trailing behind, blinking now and then.",
  category: "loader",
  tags: ["loader", "horror", "halloween", "ghost", "spinner", "cute", "waiting"],
  hold: 0,
  presets: [
    { name: "Ectoplasm", values: { ghost: [0.6, 1, 0.75], outline: [0.25, 0.6, 0.4], eyes: [0.05, 0.2, 0.1] } },
    { name: "On dark", values: { outline: [0.93, 0.95, 0.97] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 120 120"><!-- {{ghost: color default=#EEF2F7 label='Ghost'}} {{outline: color default=#8C95A8 label='Outline'}} {{eyes: color default=#1E1B2E label='Eyes'}} --><g id="ghostLoaderOrbit" transform="rotate(0 60 60)">${[72, 48, 24]
      .map((deg, k) => `<path transform="rotate(-${deg} 60 60) translate(60 24) scale(${0.7 + k * 0.08})" d="${GHOST_A}" fill="{{ghost}}" stroke="{{outline}}" stroke-width="1.2" opacity="${0.15 + k * 0.12}"/>`)
      .join("")}<g transform="translate(60 24)"><path id="ghostLoaderBody" d="${GHOST_A}" fill="{{ghost}}" stroke="{{outline}}" stroke-width="1.4" stroke-linejoin="round"/><ellipse id="ghostLoaderEyeL" cx="-4.2" cy="-4" rx="1.7" ry="2.5" fill="{{eyes}}"/><ellipse id="ghostLoaderEyeR" cx="4.2" cy="-4" rx="1.7" ry="2.5" fill="{{eyes}}"/></g></g></svg>`,
    animate: [
      { id: "ghostLoaderOrbit", attrs: { transform: ["rotate(0 60 60)", "rotate(360 60 60)"] }, ms: GHOST_LAP, ease: "linear" },
      { id: "ghostLoaderBody", attrs: { d: [GHOST_A, GHOST_B] }, ms: GHOST_LAP / 8, repeat: 8, alternate: true, ease: "in-out" },
      ...(["ghostLoaderEyeL", "ghostLoaderEyeR"] as const).flatMap((id) => holds(id, "ry", [[0, 2.5], [1300, 0.3], [1400, 2.5]])),
    ],
  },
};

/** Skeleton hand loader: the knuckles, index to little finger, and the order they drum in. */
const KNUCKLES = [
  [38, 52],
  [51, 55],
  [64, 55],
  [77, 52],
] as const;
const DRUM_ORDER = [3, 2, 1, 0];
const DRUM_GAP = 150;

export const skeletonHandLoader: VectorEffect = {
  kind: "vector",
  id: "skeleton-hand-loader",
  name: "Skeleton hand loader",
  description: "A bony skeleton hand drumming its fingers on a table one after another, little finger to index, waiting impatiently.",
  category: "loader",
  tags: ["loader", "horror", "halloween", "skeleton", "hands", "bones", "waiting", "impatient"],
  hold: 400,
  presets: [
    { name: "Dark", values: { bone: [0.9, 0.88, 0.82], shade: [0.3, 0.28, 0.25], table: [0.75, 0.6, 0.45] } },
    { name: "Glow bones", values: { bone: [0.7, 1, 0.75], shade: [0.1, 0.3, 0.15] } },
  ],
  motion: (() => {
    const bone = (d: string) => `<path d="${d}" fill="none" stroke="{{shade}}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="{{bone}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    const joint = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.8" fill="{{bone}}" stroke="{{shade}}" stroke-width="1.2"/>`;
    const rot = (i: number, deg: number) => `rotate(${deg} ${KNUCKLES[i]![0]} ${KNUCKLES[i]![1]})`;
    const fingers = KNUCKLES.map(([x, y], i) => {
      const len = i === 0 || i === 3 ? 0.85 : 1;
      const [a, b, c] = [y + 14 * len, y + 25 * len, y + 34 * len];
      return `<g id="skeletonHandLoaderF${i}" transform="${rot(i, 0)}">${bone(`M${x} ${y} L${x} ${a} L${x} ${b} L${x} ${c}`)}${joint(x, a)}${joint(x, b)}</g><line id="skeletonHandLoaderTick${i}" x1="${x - 5}" y1="${y + c - y + 4}" x2="${x + 5}" y2="${y + c - y + 4}" stroke="{{bone}}" stroke-width="1.5" stroke-linecap="round" opacity="0"/>`;
    }).join("");
    return {
      svg: `<svg viewBox="0 0 120 120"><!-- {{bone: color default=#EDE6D6 label='Bone'}} {{shade: color default=#8F8676 label='Shading'}} {{table: color default=#4A3A30 label='Table'}} --><line x1="12" y1="96" x2="108" y2="96" stroke="{{table}}" stroke-width="3" stroke-linecap="round"/><ellipse cx="60" cy="17" rx="10" ry="6" fill="{{bone}}" stroke="{{shade}}" stroke-width="1.4"/>${KNUCKLES.map(([x, y], i) => bone(`M${53 + i * 4.7} 20 L${x} ${y}`)).join("")}${bone("M48 34 L32 52 L26 64")}${joint(32, 52)}${fingers}${KNUCKLES.map(([x, y]) => joint(x, y)).join("")}</svg>`,
      animate: DRUM_ORDER.flatMap((i, k): SvgAnimation[] => {
        const at = k * DRUM_GAP;
        return [
          { id: `skeletonHandLoaderF${i}`, attrs: { transform: [rot(i, 0), rot(i, -28)] }, delay: at, ms: 110, ease: "out" },
          { id: `skeletonHandLoaderF${i}`, attrs: { transform: [rot(i, -28), rot(i, 0)] }, delay: at + 110, ms: 80, ease: [0.55, 0, 1, 0.45] },
          ...holds(`skeletonHandLoaderTick${i}`, "opacity", [[0, 0]]),
          { id: `skeletonHandLoaderTick${i}`, attrs: { opacity: [0.9, 0] }, delay: at + 190, ms: 160, ease: "out" },
        ];
      }),
    };
  })(),
};

// ── Interaction ────────────────────────────────────────────────────────

/** Haunted hover: the button's pose, moved and tipped from its rest about its middle (160, 60). */
const button = (x: number, y: number, deg: number) => `translate(${x} ${y}) rotate(${deg} 160 60)`;

export const hauntedHover: VectorEffect = {
  kind: "vector",
  id: "haunted-hover",
  name: "Haunted hover",
  description: "A button that will not be touched: on hover it flinches away from the pointer, tipping and trembling, leaving a ghostly outline where it was; it settles back when the pointer leaves.",
  category: "interaction",
  tags: ["interactive", "ui", "hover", "horror", "button", "haunted", "flinch", "micro-interaction"],
  trigger: "hover",
  hold: 600,
  presets: [
    { name: "Dark", values: { background: [0.07, 0.06, 0.09], button: [0.55, 0.12, 0.16], ink: [1, 0.95, 0.92], ghost: [0.6, 0.9, 0.75] } },
    { name: "Polite", values: { label: "After you" } },
  ],
  derived: (v) => {
    const text = String(v.label);
    const size = Math.round(Math.min(20, 118 / Math.max(0.6, textWidthEm(text))) * 10) / 10;
    return { size, length: r1(Math.max(0.6, textWidthEm(text)) * size), base: r1(60 + size * 0.35) };
  },
  motion: {
    svg: `<svg viewBox="0 0 320 120"><!-- {{label: text default='Enter' label='Label'}} {{background: color default=#F5F2EE label='Background'}} {{button: color default=#2B2233 label='Button'}} {{ink: color default=#FFFFFF label='Label colour'}} {{ghost: color default=#7FA8A0 label='Ghostly outline'}} {{font: text default='system-ui, sans-serif' label='Font'}} --><rect width="320" height="120" fill="{{background}}"/><rect id="hauntedHoverGhost" x="85" y="37" width="150" height="46" rx="23" fill="none" stroke="{{ghost}}" stroke-width="2" stroke-dasharray="5 4" opacity="0"/><g id="hauntedHoverButton" transform="${button(0, 0, 0)}"><rect x="85" y="37" width="150" height="46" rx="23" fill="{{button}}"/><text x="160" y="{{base}}" text-anchor="middle" textLength="{{length}}" lengthAdjust="spacingAndGlyphs" font-family="{{font}}" font-size="{{size}}" font-weight="700" fill="{{ink}}">{{label}}</text></g></svg>`,
    animate: [
      // It flinches away, tipping, and trembles there.
      { id: "hauntedHoverButton", attrs: { transform: [button(0, 0, 0), button(48, -12, 9)] }, ms: 240, ease: "out" },
      { id: "hauntedHoverButton", attrs: { transform: [button(48, -12, 9), button(50, -12, 11)] }, delay: 240, ms: 700, behavior: { type: "oscillate", count: 9, decay: 1.5 } },
      // A ghostly outline left where it was.
      { id: "hauntedHoverGhost", attrs: { opacity: [0, 0.6] }, ms: 120 },
      { id: "hauntedHoverGhost", attrs: { opacity: [0.6, 0.3] }, delay: 240, ms: 600, ease: "out" },
    ],
  },
};

// ── Icons ──────────────────────────────────────────────────────────────

export const jackOLantern: VectorEffect = {
  kind: "vector",
  id: "jack-o-lantern",
  name: "Jack-o'-lantern",
  description: "A carved pumpkin with a candle flickering inside, its face glowing and dimming unevenly and its light breathing round it.",
  category: "icon",
  tags: ["icon", "horror", "halloween", "pumpkin", "jack-o-lantern", "glow", "candle"],
  hold: 0,
  presets: [
    { name: "Ghostly", values: { skin: [0.86, 0.86, 0.82], rib: [0.6, 0.6, 0.56], glow: [0.6, 1, 0.75] } },
    { name: "Rotten", values: { skin: [0.45, 0.32, 0.12], rib: [0.28, 0.18, 0.06], glow: [0.95, 0.6, 0.2] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{skin: color default=#E8700F label='Skin'}} {{rib: color default=#A8480A label='Ribs'}} {{stem: color default=#4D6B2A label='Stem'}} {{glow: color default=#FFD54F label='Candlelight'}} --><ellipse id="jackOLanternHalo" cx="50" cy="58" rx="46" ry="40" fill="{{glow}}" opacity="0.22"/><path d="M47 22 C46 16 48 12 53 10 C54 14 53 18 54 23 Z" fill="{{stem}}"/>${[
      [30, 18],
      [70, 18],
      [50, 22],
    ]
      .map(([cx, rx]) => `<ellipse cx="${cx}" cy="58" rx="${rx}" ry="34" fill="{{skin}}" stroke="{{rib}}" stroke-width="2"/>`)
      .join("")}<g id="jackOLanternFace" fill="{{glow}}"><path d="M30 50 L40 38 L44 52 Z"/><path d="M70 50 L60 38 L56 52 Z"/><path d="M50 56 L46 64 H54 Z"/><path d="M26 68 Q50 84 74 68 L70 76 L64 72 L58 79 L50 74 L42 79 L36 72 L30 76 Z"/></g></svg>`,
    animate: [
      { id: "jackOLanternFace", attrs: { opacity: [1, 0.55] }, ms: 2400, behavior: { type: "wriggle", frequency: 3, seed: 13 } },
      { id: "jackOLanternHalo", attrs: { opacity: [0.22, 0.08] }, ms: 2400, behavior: { type: "wriggle", frequency: 3, seed: 13 } },
    ],
  },
};

/** Bat flap: a wing (the left; the right is its mirror) up and down, the same commands so it morphs. */
const WING_UP = "M50 50 Q38 30 16 26 Q22 36 15 42 Q26 42 28 50 Q36 46 42 55 Z";
const WING_DOWN = "M50 50 Q36 62 16 74 Q24 66 17 60 Q28 59 30 54 Q37 55 42 55 Z";
const FLAP_MS = 170;

export const batFlap: VectorEffect = {
  kind: "vector",
  id: "bat-flap",
  name: "Bat flap",
  description: "A bat beating its scalloped wings, rising a little with each beat.",
  category: "icon",
  tags: ["icon", "horror", "halloween", "bats", "flap", "wings", "flying"],
  hold: 300,
  presets: [
    { name: "Purple", values: { bat: [0.32, 0.15, 0.45], eyes: [1, 0.85, 0.2] } },
    { name: "Light", values: { bat: [0.94, 0.94, 0.96], eyes: [0.85, 0.1, 0.15] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{bat: color default=#1C1626 label='Bat'}} {{eyes: color default=#FF4B3E label='Eyes'}} --><g id="batFlapBody" transform="translate(0 0)" fill="{{bat}}"><path id="batFlapWingL" d="${WING_UP}"/><g transform="translate(100 0) scale(-1 1)"><path id="batFlapWingR" d="${WING_UP}"/></g><ellipse cx="50" cy="54" rx="7" ry="11"/><path d="M43 44 L44 34 L48 40 H52 L56 34 L57 44 Q50 50 43 44 Z"/><circle cx="47.5" cy="42" r="1.4" fill="{{eyes}}"/><circle cx="52.5" cy="42" r="1.4" fill="{{eyes}}"/></g></svg>`,
    animate: [
      ...(["batFlapWingL", "batFlapWingR"] as const).map((id): SvgAnimation => ({ id, attrs: { d: [WING_UP, WING_DOWN] }, ms: FLAP_MS, repeat: 6, alternate: true, ease: "in-out" })),
      { id: "batFlapBody", attrs: { transform: ["translate(0 0)", "translate(0 -4)"] }, ms: FLAP_MS, repeat: 6, alternate: true, ease: "in-out" },
    ],
  },
};

export const skullChatter: VectorEffect = {
  kind: "vector",
  id: "skull-chatter",
  name: "Skull chatter",
  description: "A skull whose jaw chatters open and shut, its eye sockets glowing red for a moment as it does.",
  category: "icon",
  tags: ["icon", "horror", "halloween", "skull", "skeleton", "chatter", "teeth"],
  hold: 900,
  presets: [
    { name: "Gold", values: { bone: [0.95, 0.78, 0.35], dark: [0.25, 0.15, 0.05] } },
    { name: "Green glow", values: { glow: [0.4, 1, 0.45] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 100 100"><!-- {{bone: color default=#EFE8DA label='Bone'}} {{dark: color default=#2A2228 label='Sockets'}} {{glow: color default=#FF3B2F label='Eye glow'}} --><path d="M50 10 C29 10 17 25 17 43 C17 55 23 61 30 63 V72 H70 V63 C77 61 83 55 83 43 C83 25 71 10 50 10 Z" fill="{{bone}}"/><ellipse cx="37" cy="44" rx="8.5" ry="9.5" fill="{{dark}}"/><ellipse cx="63" cy="44" rx="8.5" ry="9.5" fill="{{dark}}"/><g id="skullChatterGlow" opacity="0" fill="{{glow}}"><circle cx="37" cy="45" r="3.2"/><circle cx="63" cy="45" r="3.2"/></g><path d="M50 54 L46 62 H54 Z" fill="{{dark}}"/>${[36, 43, 50, 57, 64].map((x) => `<rect x="${x - 3}" y="66" width="6" height="7" rx="1.5" fill="{{dark}}" opacity="0.35"/>`).join("")}<g id="skullChatterJaw" transform="translate(0 0)"><path d="M30 73 H70 V80 C70 87 62 91 50 91 C38 91 30 87 30 80 Z" fill="{{bone}}"/>${[36, 43, 50, 57, 64].map((x) => `<rect x="${x - 3}" y="73" width="6" height="6" rx="1.5" fill="{{dark}}" opacity="0.35"/>`).join("")}</g></svg>`,
    animate: [
      { id: "skullChatterJaw", attrs: { transform: ["translate(0 0)", "translate(0 7)"] }, ms: 75, repeat: 8, alternate: true, ease: "in-out" },
      { id: "skullChatterGlow", attrs: { opacity: [0, 1] }, ms: 300, repeat: 2, alternate: true, ease: "in-out" },
    ],
  },
};

/** The horror effects drawn as vectors. */
export const horrorEffects: VectorEffect[] = [emergencyBroadcast, poltergeist, coffinLoader, candleBurndown, ghostLoader, skeletonHandLoader, hauntedHover, jackOLantern, batFlap, skullChatter];
