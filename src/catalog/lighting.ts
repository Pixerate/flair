import type { SvgAnimation } from "../vector/motion.js";
import type { VectorEffect } from "./types.js";

/** The lamp's sway: a rotation about where its cord meets the ceiling. */
const sway = (deg: number) => `rotate(${deg} 120 0)`;

/** A tug on the pull cord on `step`, and the lamp swaying after it. */
const pull = (step: number): SvgAnimation[] => [
  { id: "lampSwitchCord", step, attrs: { y2: [122, 135] }, ms: 110, ease: "out" },
  { id: "lampSwitchCord", step, attrs: { y2: [135, 122] }, delay: 110, ms: 260, ease: "in-out" },
  { id: "lampSwitchBead", step, attrs: { cy: [125, 138] }, ms: 110, ease: "out" },
  { id: "lampSwitchBead", step, attrs: { cy: [138, 125] }, delay: 110, ms: 260, ease: "in-out" },
  { id: "lampSwitchRig", step, attrs: { transform: [sway(0), sway(2.5)] }, delay: 110, ms: 260, ease: "out" },
  { id: "lampSwitchRig", step, attrs: { transform: [sway(2.5), sway(-1.4)] }, delay: 370, ms: 380, ease: "in-out" },
  { id: "lampSwitchRig", step, attrs: { transform: [sway(-1.4), sway(0)] }, delay: 750, ms: 420, ease: "in-out" },
];

/** Opacity of each light layer from `from` to `to` on `step`, after `delay`. */
const fade = (step: number, from: string | number, to: string | number, delay: number, ms: number): SvgAnimation[] =>
  ["lampSwitchCone", "lampSwitchPool", "lampSwitchRoomLit"].map((id) => ({ id, step, attrs: { opacity: [from, to] }, delay, ms, ease: "out" }));

export const lampSwitch: VectorEffect = {
  kind: "vector",
  id: "lamp-switch",
  name: "Lamp switch",
  description: "A pendant lamp in a dark room: a click tugs its pull cord, the bulb flickers on and a warm cone of light fades in over the scene; the next click turns it off.",
  category: "lighting",
  tags: ["lighting", "lamp", "light", "switch", "toggle", "click", "interactive", "warm", "ui", "illustration"],
  trigger: "click",
  hold: 900,
  presets: [
    { name: "Cool LED", values: { light: [0.78, 0.9, 1], shade: [0.85, 0.87, 0.9], lit: [0.16, 0.2, 0.26] } },
    { name: "Brass", values: { shade: [0.75, 0.55, 0.22], light: [1, 0.72, 0.38], background: [0.08, 0.07, 0.06], lit: [0.3, 0.22, 0.14] } },
  ],
  motion: {
    svg: `<svg viewBox="0 0 240 200"><!-- {{background: color default=#14121C label='Room'}} {{lit: color default=#3B2F2A label='Lit room'}} {{shade: color default=#2F7A72 label='Shade'}} {{bulbOff: color default=#57525E label='Bulb (off)'}} {{light: color default=#FFD27A label='Light'}} {{intensity: float min=0.2 max=1 default=0.8 label='Light strength'}} --><defs><linearGradient id="lampSwitchConeFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{light}}" stop-opacity="0.75"/><stop offset="1" stop-color="{{light}}" stop-opacity="0.05"/></linearGradient><radialGradient id="lampSwitchPoolFade"><stop offset="0" stop-color="{{light}}" stop-opacity="0.9"/><stop offset="1" stop-color="{{light}}" stop-opacity="0"/></radialGradient><filter id="lampSwitchBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><filter id="lampSwitchSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="240" height="200" fill="{{background}}"/><rect id="lampSwitchRoomLit" width="240" height="200" fill="{{lit}}" opacity="0"/><rect x="0" y="186" width="240" height="14" fill="#000000" opacity="0.25"/><ellipse id="lampSwitchPool" cx="120" cy="188" rx="96" ry="16" fill="url(#lampSwitchPoolFade)" opacity="0"/><g fill="#000000" opacity="0.45"><rect x="92" y="160" width="56" height="5" rx="2"/><rect x="98" y="165" width="4" height="22"/><rect x="138" y="165" width="4" height="22"/><rect x="112" y="148" width="12" height="12" rx="2"/></g><g id="lampSwitchRig" transform="${sway(0)}"><path id="lampSwitchCone" d="M84 90 L156 90 L236 196 L4 196 Z" fill="url(#lampSwitchConeFade)" opacity="0" filter="url(#lampSwitchSoft)"/><line x1="120" y1="0" x2="120" y2="54" stroke="#8A8494" stroke-width="2"/><circle id="lampSwitchGlow" cx="120" cy="94" r="24" fill="{{light}}" opacity="0" filter="url(#lampSwitchBlur)"/><circle id="lampSwitchBulb" cx="120" cy="92" r="9" fill="{{bulbOff}}"/><path d="M110 50 L130 50 L133 56 L107 56 Z" fill="{{shade}}"/><path d="M104 56 L136 56 L162 90 L78 90 Z" fill="{{shade}}"/><path d="M104 56 L136 56 L140 61 L100 61 Z" fill="#FFFFFF" opacity="0.12"/><ellipse id="lampSwitchInner" cx="120" cy="90" rx="42" ry="4" fill="{{light}}" opacity="0"/><line id="lampSwitchCord" x1="154" y1="82" x2="154" y2="122" stroke="#B9B2C4" stroke-width="1.5"/><circle id="lampSwitchBead" cx="154" cy="125" r="3.5" fill="#D9D2E4"/></g></svg>`,
    animate: [
      // Step 1, on: a tug, the bulb flickers on and the light fades in over the room.
      ...pull(1),
      { id: "lampSwitchBulb", step: 1, attrs: { fill: ["{{bulbOff}}", "{{light}}"] }, delay: 140, ms: 80 },
      { id: "lampSwitchGlow", step: 1, attrs: { opacity: [0, 0.9] }, delay: 140, ms: 60 },
      { id: "lampSwitchGlow", step: 1, attrs: { opacity: [0.9, 0.25] }, delay: 200, ms: 70 },
      { id: "lampSwitchGlow", step: 1, attrs: { opacity: [0.25, 1] }, delay: 270, ms: 240, ease: "out" },
      { id: "lampSwitchInner", step: 1, attrs: { opacity: [0, 0.9] }, delay: 140, ms: 200, ease: "out" },
      ...fade(1, 0, "{{intensity}}", 270, 520),
      // Step 2, off: a tug and everything dims back to the start.
      ...pull(2),
      { id: "lampSwitchBulb", step: 2, attrs: { fill: ["{{light}}", "{{bulbOff}}"] }, delay: 140, ms: 200 },
      { id: "lampSwitchGlow", step: 2, attrs: { opacity: [1, 0] }, delay: 140, ms: 260, ease: "out" },
      { id: "lampSwitchInner", step: 2, attrs: { opacity: [0.9, 0] }, delay: 140, ms: 220, ease: "out" },
      ...fade(2, "{{intensity}}", 0, 140, 380),
    ],
  },
};

/** Lighting as vector effects: a lamp switched on and off. */
export const lightingEffects: VectorEffect[] = [lampSwitch];
