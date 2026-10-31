import type { SvgMotion } from "../vector/motion.js";
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

/** The horror effects drawn as vectors. */
export const horrorEffects: VectorEffect[] = [emergencyBroadcast];
