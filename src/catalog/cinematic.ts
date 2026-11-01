import type { SvgAnimation, SvgMotion } from "../vector/motion.js";
import { fit, ms, n, r1, SANS } from "./broadcast.js";
import type { VectorEffect } from "./types.js";

/*
 * Cinematic vector effects: opening credits and an end-credits roll. Like the broadcast
 * graphics it is a 1920 × 1080 frame whose text is fitted from its length,
 * so any names fit in any font.
 */

/** The most credit lines the roll holds; lines past it are left out. */
export const CREDIT_SLOTS = 16;

/** A line of the credits: a section heading, a role and its name, or a line on its own. */
export interface CreditLine {
  kind: "heading" | "credit" | "line";
  role: string;
  name: string;
}

/**
 * Credits written as lines separated by semicolons or new lines: `Role: Name`
 * for a credit, `# Heading` for a section heading and anything else as a
 * centred line on its own. Blank lines are skipped; at most
 * {@link CREDIT_SLOTS} lines are kept.
 */
export function parseCredits(text: unknown): CreditLine[] {
  const lines: CreditLine[] = [];
  for (const raw of String(text ?? "").split(/[;\n]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (line.startsWith("#")) lines.push({ kind: "heading", role: line.replace(/^#+\s*/, ""), name: "" });
    else if (colon > 0) lines.push({ kind: "credit", role: line.slice(0, colon).trim(), name: line.slice(colon + 1).trim() });
    else lines.push({ kind: "line", role: "", name: line });
    if (lines.length === CREDIT_SLOTS) break;
  }
  return lines;
}

const DEFAULT_CREDITS =
  "Directed by: Ada Lovelace; Written by: Grace Hopper; Produced by: Alan Turing; # Cast; The Navigator: Katherine Johnson; The Engineer: Margaret Hamilton; The Pilot: Amelia Earhart; # Crew; Director of photography: Hedy Lamarr; Editor: Dorothy Vaughan; Music: Delia Derbyshire; Filmed on location";

const slot = (k: number) =>
  `<text x="960" y="{{y${k}}}" opacity="{{h${k}}}" text-anchor="middle" font-family="{{font}}" font-size="{{hs${k}}}" font-weight="700" letter-spacing="4" textLength="{{hw${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{accent}}">{{heading${k}}}</text>` +
  `<text x="930" y="{{y${k}}}" opacity="{{c${k}}}" text-anchor="end" font-family="{{font}}" font-size="{{rs${k}}}" font-weight="400" textLength="{{rw${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}">{{role${k}}}</text>` +
  `<text x="{{nx${k}}}" y="{{y${k}}}" opacity="{{v${k}}}" text-anchor="{{na${k}}}" font-family="{{font}}" font-size="{{ns${k}}}" font-weight="600" textLength="{{nw${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{name${k}}}</text>`;

const endCreditsMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{title: text default='The Long Way Home' label='Title'}} {{credits: text default='${DEFAULT_CREDITS}' label='Credits (Role: Name; # Heading; a line on its own)'}} {{background: color default=#000000 label='Background'}} {{backgroundOpacity: float min=0 max=1 default=1 step=0.05 label='Background opacity'}} {{ink: color default=#F5F5F4 label='Name colour'}} {{muted: color default=#A8A29E label='Role colour'}} {{accent: color default=#E7C26B label='Title and heading colour'}} {{speed: float min=40 max=400 default=140 step=10 label='Speed (px a second)'}} {{fade: bool default=true label='Fade at the top and bottom'}} {{font: text default="${SANS}" label='Font'}} --><defs><linearGradient id="endCreditsFadeRamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="{{edge}}"/><stop offset="0.14" stop-color="#FFFFFF"/><stop offset="0.86" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="{{edge}}"/></linearGradient><mask id="endCreditsFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect width="1920" height="1080" fill="url(#endCreditsFadeRamp)"/></mask></defs><rect width="1920" height="1080" fill="{{background}}" fill-opacity="{{backgroundOpacity}}"/><g mask="url(#endCreditsFade)"><g id="endCreditsRoll" transform="translate(0 1080)"><text x="960" y="{{titleBase}}" text-anchor="middle" font-family="{{font}}" font-size="{{titleSize}}" font-weight="800" letter-spacing="6" textLength="{{titleW}}" lengthAdjust="spacingAndGlyphs" fill="{{accent}}">{{title}}</text>${Array.from({ length: CREDIT_SLOTS }, (_, k) => slot(k)).join("")}</g></g></svg>`,
  animate: [{ id: "endCreditsRoll", attrs: { transform: ["translate(0 1080)", "translate(0 {{rollEnd}})"] }, ms: n("rollMs"), ease: "linear" }],
};

export const endCreditsRoll: VectorEffect = {
  kind: "vector",
  id: "end-credits-roll",
  name: "End credits roll",
  description: "A film's end credits rolling up the screen: the title, then section headings and roles beside their names in two columns, fading at the top and bottom of the frame.",
  category: "cinematic",
  tags: ["cinematic", "film", "credits", "end-card", "outro", "scroll", "title"],
  hold: 300,
  presets: [
    { name: "Classic", values: { background: [0, 0, 0], ink: [1, 1, 1], muted: [0.66, 0.66, 0.66], accent: [1, 1, 1] } },
    { name: "Gold", values: { background: [0.04, 0.03, 0.02], ink: [0.97, 0.93, 0.84], muted: [0.66, 0.6, 0.5], accent: [0.91, 0.76, 0.42] } },
    { name: "Over video", values: { backgroundOpacity: 0, fade: false } },
    { name: "Fast", values: { speed: 300 } },
  ],
  derived: (v) => {
    const title = fit(v.title, 1500, 110);
    const lines = parseCredits(v.credits);
    const out: Record<string, string | number> = {
      titleSize: title.size,
      titleW: title.width,
      titleBase: r1(title.size * 0.8),
      edge: v.fade ? 0 : 1,
    };
    let cursor = title.size + 130;
    for (let k = 0; k < CREDIT_SLOTS; k++) {
      const line = lines[k];
      const heading = line?.kind === "heading";
      const credit = line?.kind === "credit";
      if (heading && k > 0) cursor += 56;
      const h = fit(heading ? line.role.toUpperCase() : "", 1500, 44);
      const role = fit(credit ? line.role : "", 820, 36);
      const name = fit(line && !heading ? line.name : "", credit ? 820 : 1500, 42);
      Object.assign(out, {
        [`y${k}`]: r1(cursor + 46),
        [`h${k}`]: heading ? 1 : 0,
        [`c${k}`]: credit ? 1 : 0,
        [`v${k}`]: line && !heading ? 1 : 0,
        [`heading${k}`]: heading ? line.role.toUpperCase() : "",
        [`hs${k}`]: h.size,
        [`hw${k}`]: h.width,
        [`role${k}`]: credit ? line.role : "",
        [`rs${k}`]: role.size,
        [`rw${k}`]: role.width,
        [`name${k}`]: line && !heading ? line.name : "",
        [`ns${k}`]: name.size,
        [`nw${k}`]: name.width,
        [`nx${k}`]: credit ? 990 : 960,
        [`na${k}`]: credit ? "start" : "middle",
      });
      if (line) cursor += heading ? 84 : 64;
    }
    out.rollEnd = -r1(cursor);
    out.rollMs = Math.round(((1080 + cursor) / Math.max(1, Number(v.speed) || 140)) * 1000);
    return out;
  },
  motion: endCreditsMotion,
};

// ── Opening credits ────────────────────────────────────────────────────

/** The most cards the opening credits show; cards past it are left out. */
export const CARD_SLOTS = 6;

const CARD_FADE = 700;
const CARD_GAP = 300;

const card = (k: number) =>
  `<g id="openingCreditsCard${k}" opacity="0" transform="translate({{gx}} {{gy}}) scale(0.97)"><text x="0" y="{{ly${k}}}" text-anchor="{{anchor}}" font-family="{{font}}" font-size="{{ls${k}}}" font-weight="500" textLength="{{lw${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{muted}}">{{lead${k}}}</text><text x="0" y="{{ny${k}}}" text-anchor="{{anchor}}" font-family="{{font}}" font-size="{{ns${k}}}" font-weight="{{nweight${k}}}" textLength="{{nw${k}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{name${k}}}</text></g>`;

const cardMotion = (k: number): SvgAnimation[] => [
  { id: `openingCreditsCard${k}`, attrs: { opacity: [0, n(`peak${k}`)] }, delay: n(`in${k}`), ms: CARD_FADE, ease: "out" },
  { id: `openingCreditsCard${k}`, attrs: { transform: ["translate({{gx}} {{gy}}) scale(0.97)", "translate({{gx}} {{gy}}) scale(1)"] }, delay: n(`in${k}`), ms: n("drift"), ease: "out" },
  { id: `openingCreditsCard${k}`, attrs: { opacity: [n(`peak${k}`), 0] }, delay: n(`out${k}`), ms: CARD_FADE, ease: "in-out" },
];

const openingCreditsMotion: SvgMotion = {
  svg: `<svg viewBox="0 0 1920 1080"><!-- {{credits: text default='A film by: Ada Lovelace; Starring: Grace Hopper; With: Alan Turing; Music by: Delia Derbyshire; # The Long Way Home' label='Cards (Lead: Name; # Title; a name on its own)'}} {{background: color default=#000000 label='Background'}} {{backgroundOpacity: float min=0 max=1 default=1 step=0.05 label='Background opacity'}} {{ink: color default=#F5F5F4 label='Name colour'}} {{muted: color default=#A8A29E label='Lead colour'}} {{place: int min=0 max=2 default=0 label='Place (0 centre, 1 lower left, 2 lower right)'}} {{hold: float min=0.5 max=10 default=2 step=0.5 label='Hold each card (s)'}} {{font: text default="${SANS}" label='Font'}} --><rect width="1920" height="1080" fill="{{background}}" fill-opacity="{{backgroundOpacity}}"/>${Array.from({ length: CARD_SLOTS }, (_, k) => card(k)).join("")}</svg>`,
  animate: Array.from({ length: CARD_SLOTS }, (_, k) => cardMotion(k)).flat(),
};

export const openingCredits: VectorEffect = {
  kind: "vector",
  id: "opening-credits",
  name: "Opening credits",
  description: "A film's opening credits: one card at a time, a small tracked lead over a name, each fading in while it eases larger and fading out, ending on the film's title.",
  category: "cinematic",
  tags: ["cinematic", "film", "credits", "intro", "title"],
  hold: 400,
  presets: [
    { name: "Over video", values: { backgroundOpacity: 0, place: 1 } },
    { name: "Gold", values: { background: [0.04, 0.03, 0.02], ink: [0.97, 0.93, 0.84], muted: [0.91, 0.76, 0.42] } },
    { name: "Quick", values: { hold: 1 } },
  ],
  derived: (v) => {
    const lines = parseCredits(v.credits).slice(0, CARD_SLOTS);
    const place = Math.round(Number(v.place) || 0);
    const hold = ms(v.hold);
    const per = CARD_FADE * 2 + hold + CARD_GAP;
    const out: Record<string, string | number> = {
      gx: place === 1 ? 192 : place === 2 ? 1728 : 960,
      gy: place === 0 ? 540 : 860,
      anchor: place === 1 ? "start" : place === 2 ? "end" : "middle",
      drift: CARD_FADE * 2 + hold,
    };
    for (let k = 0; k < CARD_SLOTS; k++) {
      const line = lines[k];
      const title = line?.kind === "heading";
      const lead = fit(line?.kind === "credit" ? line.role.toUpperCase() : "", 1200, 30);
      const name = fit(line ? (title ? line.role : line.name) : "", 1500, title ? 120 : 76);
      const hasLead = line?.kind === "credit";
      Object.assign(out, {
        [`lead${k}`]: hasLead ? line.role.toUpperCase() : "",
        [`ls${k}`]: lead.size,
        [`lw${k}`]: lead.width,
        [`ly${k}`]: hasLead ? -r1(name.size * 0.45) : 0,
        [`name${k}`]: line ? (title ? line.role : line.name) : "",
        [`ns${k}`]: name.size,
        [`nw${k}`]: name.width,
        [`ny${k}`]: r1(name.size * (hasLead ? 0.55 : 0.35)),
        [`nweight${k}`]: title ? 800 : 600,
        [`peak${k}`]: line ? 1 : 0,
        [`in${k}`]: line ? k * per : 0,
        [`out${k}`]: line ? k * per + CARD_FADE + hold : 0,
      });
    }
    return out;
  },
  motion: openingCreditsMotion,
};

/** Cinematic vector effects. */
export const cinematicEffects: VectorEffect[] = [openingCredits, endCreditsRoll];
