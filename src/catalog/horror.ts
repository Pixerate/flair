import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { after, fit, holdControl, holds, ms, outTimes, r1, SANS } from "./broadcast.js";
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

/** The horror effects drawn as vectors. */
export const horrorEffects: VectorEffect[] = [emergencyBroadcast, poltergeist];
