import { rgbToHex } from "../shader/controls.js";
import { formatCount, type SvgAnimation } from "../vector/motion.js";
import { textWidthEm } from "./images.js";
import { isCurrentColor, type VectorEffect } from "./types.js";

/*
 * Data effects: charts and figures whose numbers come in through controls.
 * Lists are text controls holding comma-separated values (and a matching
 * text control of labels); rows of series are separated by semicolons.
 * Everything is parsed in `derived`, so any text is safe: unreadable
 * numbers count as nothing (or fall back to the defaults when nothing at
 * all is readable). Each chart animates in, holds, and starts over.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A derived number in an animation's numeric field (`count`, `delay`, `ms`). */
const n = (name: string) => `{{${name}}}` as unknown as number;

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** Text fitted to `width` units, at most `max` high: its font size and width. */
function fit(text: unknown, width: number, max: number) {
  const e = Math.max(0.6, textWidthEm(String(text)));
  const size = Math.min(max, width / e);
  return { size: r1(size), length: r1(e * size) };
}

/**
 * Text fitted like {@link fit}, but never smaller than `min`: text too long
 * for that is cut short with an ellipsis. Gives the text to show as well.
 */
export function fitLabel(text: unknown, width: number, max: number, min: number) {
  const whole = String(text ?? "");
  const f = fit(whole, width, max);
  if (f.size >= min) return { text: whole, ...f };
  const letters = Array.from(whole);
  while (letters.length > 1 && Math.max(0.6, textWidthEm(`${letters.join("").trimEnd()}\u2026`)) * min > width) letters.pop();
  const cut = `${letters.join("").trimEnd()}\u2026`;
  return { text: cut, ...fit(cut, width, max) };
}

/** A colour control's value as paint: `#rrggbb`, or `currentColor`. */
const paint = (v: unknown) => (isCurrentColor(v) ? "currentColor" : Array.isArray(v) ? rgbToHex(v as number[]) : "#000000");

/** Text safe inside a count's `format` (braces would read as `{n}`). */
const formatSafe = (v: unknown) => String(v ?? "").replace(/[{}]/g, "");

/** The series colours data effects share, one control each. */
export const DATA_PALETTE = ["#6366F1", "#22C55E", "#F59E0B", "#EC4899", "#0EA5E9", "#A855F7"];
const palette = (count = DATA_PALETTE.length) =>
  DATA_PALETTE.slice(0, count)
    .map((hex, i) => `{{c${i + 1}: color default=${hex} label='Colour ${i + 1}'}}`)
    .join(" ");
const PALETTE_PRESETS = [
  { name: "Ocean", values: { c1: [0.03, 0.4, 0.62], c2: [0.05, 0.65, 0.91], c3: [0.22, 0.74, 0.97], c4: [0.49, 0.83, 0.99], c5: [0.08, 0.72, 0.65], c6: [0.37, 0.92, 0.83] } },
  { name: "Sunset", values: { c1: [0.94, 0.27, 0.27], c2: [0.98, 0.45, 0.09], c3: [0.98, 0.75, 0.14], c4: [0.93, 0.29, 0.6], c5: [0.66, 0.33, 0.97], c6: [0.4, 0.4, 0.95] } },
];

// ── Parsing ────────────────────────────────────────────────────────────

/**
 * The numbers in a list written with commas, semicolons or spaces, at most
 * `max`, each kept in its place: a token with no readable number is `NaN`.
 * Currency signs, units and percent signs round a number are ignored
 * (`$12`, `45%`, `3.5k` read 12, 45, 3.5).
 */
export function parseNumberList(text: unknown, max: number): number[] {
  return String(text ?? "")
    .split(/[,;\s]+/)
    .filter((t) => t !== "")
    .slice(0, max)
    .map((token) => {
      const cleaned = token.replace(/[^0-9.eE+-]/g, "");
      const value = /\d/.test(cleaned) ? Number(cleaned) : NaN;
      return Number.isFinite(value) ? Math.max(-1e9, Math.min(1e9, value)) : NaN;
    });
}

/** The labels in a list written with commas (or semicolons), trimmed, at most `max`. */
export function parseLabels(text: unknown, max: number): string[] {
  return String(text ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .slice(0, max);
}

/** Shares for a pie or donut: positive numbers in place (anything else counts 0), or `fallback` when none are positive. */
export function parseShares(text: unknown, max: number, fallback: readonly number[]): number[] {
  const values = parseNumberList(text, max).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  return values.some((v) => v > 0) ? values : [...fallback];
}

/** Decimals a number is written with, at most 2. */
export function decimalsOf(values: readonly number[]): number {
  let most = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || Number.isInteger(v)) continue;
    const s = String(v);
    most = Math.max(most, s.includes("e") ? 2 : (s.split(".")[1]?.length ?? 0));
  }
  return Math.min(2, most);
}

/** A row of a bar race: its name and a value per state. */
export interface RaceRow {
  name: string;
  values: number[];
}

/**
 * Bar race rows written as `Name:10,20,35;Other:15,25,30`: rows separated
 * by semicolons or new lines, a name then a colon then a value per state.
 * A row with no colon is all values and named by its place; an unreadable
 * or missing value keeps the row's value before it. At most `maxRows` rows
 * and `maxStates` states; `fallback` when no row has a readable value.
 */
export function parseRace(text: unknown, maxRows: number, maxStates: number, fallback: readonly RaceRow[]): RaceRow[] {
  const rows: { name: string; raw: number[] }[] = [];
  for (const line of String(text ?? "").split(/[;\n]+/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    const name = colon >= 0 ? line.slice(0, colon).trim() : `#${rows.length + 1}`;
    const raw = parseNumberList(colon >= 0 ? line.slice(colon + 1) : line, maxStates);
    if (raw.some((v) => Number.isFinite(v))) rows.push({ name, raw });
    if (rows.length === maxRows) break;
  }
  if (!rows.length) return fallback.map((r) => ({ name: r.name, values: [...r.values] }));
  const states = Math.max(...rows.map((r) => r.raw.length));
  return rows.map(({ name, raw }) => {
    let last = raw.find((v) => Number.isFinite(v)) ?? 0;
    const values = Array.from({ length: states }, (_, k) => {
      const v = raw[k];
      if (v !== undefined && Number.isFinite(v)) last = Math.max(0, v);
      return last;
    });
    return { name, values };
  });
}

/**
 * Series for a stacked chart: rows separated by semicolons or new lines,
 * each a comma-separated list. Unreadable and negative values count 0, and
 * short rows keep their last value, so every row has as many points as the
 * longest (at least 2, at most `maxPoints`). `fallback` when nothing reads.
 */
export function parseSeries(text: unknown, maxRows: number, maxPoints: number, fallback: readonly (readonly number[])[]): number[][] {
  const rows = String(text ?? "")
    .split(/[;\n]+/)
    .map((line) => parseNumberList(line, maxPoints))
    .filter((row) => row.some((v) => Number.isFinite(v)))
    .slice(0, maxRows)
    .map((row) => row.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)));
  if (!rows.length || rows.every((r) => r.every((v) => v === 0))) return fallback.map((r) => [...r]);
  const points = Math.max(2, ...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: points }, (_, j) => r[Math.min(j, r.length - 1)]!));
}

// ── Legend (donut and pie) ─────────────────────────────────────────────

const SLOTS = 6;
const LEGEND = { swatch: 158, label: 174, right: 250, pitch: 22 };

/** A legend row per share: which show, where, their labels fitted and their percentages. */
function legendValues(labels: string[], fractions: number[], at: number[], cy: number) {
  const shown = fractions.map((f) => f > 0);
  const count = shown.filter(Boolean).length;
  const out: Record<string, string | number> = {};
  let row = 0;
  for (let i = 0; i < SLOTS; i++) {
    const f = fractions[i] ?? 0;
    const label = labels[i] ?? "";
    const { text, size, length } = fitLabel(label, LEGEND.right - LEGEND.label - 32, 11, 8);
    out[`show${i}`] = f > 0 ? "inline" : "none";
    out[`ly${i}`] = r1(cy + ((f > 0 ? row : 0) - (count - 1) / 2) * LEGEND.pitch);
    out[`l${i}`] = text;
    out[`ls${i}`] = size;
    out[`ll${i}`] = length;
    out[`pct${i}`] = Math.round(f * 100);
    out[`at${i}`] = at[i] ?? 0;
    if (f > 0) row++;
  }
  return out;
}

const legendMarkup = (prefix: string) =>
  Array.from(
    { length: SLOTS },
    (_, i) =>
      `<g id="${prefix}Row${i}" display="{{show${i}}}" opacity="0" transform="translate(8 {{ly${i}}})"><rect x="${LEGEND.swatch}" y="-5" width="10" height="10" rx="3" fill="{{c${i + 1}}}"/><text x="${LEGEND.label}" y="4" font-size="{{ls${i}}}" textLength="{{ll${i}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{l${i}}}</text><text id="${prefix}Pct${i}" x="${LEGEND.right}" y="4" text-anchor="end" font-size="11" font-weight="700" fill="{{ink}}">0%</text></g>`,
  ).join("");

const legendAnimations = (prefix: string): SvgAnimation[] =>
  Array.from({ length: SLOTS }, (_, i): SvgAnimation[] => [
    { id: `${prefix}Row${i}`, attrs: { opacity: [0, 1], transform: [`translate(8 {{ly${i}}})`, `translate(0 {{ly${i}}})`] }, delay: n(`at${i}`), ms: 320, ease: "out" },
    { id: `${prefix}Pct${i}`, count: [0, n(`pct${i}`)], format: "{n}%", delay: n(`at${i}`), ms: 600, ease: "out" },
  ]).flat();

// ── Donut chart ────────────────────────────────────────────────────────

const DONUT = { cx: 80, cy: 80, r: 50, width: 22, start: 150, sweep: 1400 };
const DONUT_DEFAULT = [42, 28, 18, 12];

export const donutChart: VectorEffect = {
  kind: "vector",
  id: "donut-chart",
  name: "Donut chart",
  description: "Segments sweeping round a ring one after another, a legend giving each share, and the total counting up in the middle.",
  category: "data",
  tags: ["chart", "donut", "share", "dashboard", "report", "explainer"],
  hold: 1600,
  presets: [...PALETTE_PRESETS, { name: "Budget", values: { values: "1200,800,450,300,250", labels: "Rent,Food,Travel,Fun,Other", caption: "per month" } }],
  derived: (v) => {
    const values = parseShares(v.values, SLOTS, DONUT_DEFAULT);
    const total = values.reduce((a, b) => a + b, 0);
    const fractions = values.map((x) => x / total);
    const gap = fractions.filter((f) => f > 0).length > 1 ? 0.005 : 0;
    const out: Record<string, string | number> = {};
    const at: number[] = [];
    let cum = 0;
    for (let i = 0; i < SLOTS; i++) {
      const f = fractions[i] ?? 0;
      at.push(Math.round(DONUT.start + cum * DONUT.sweep));
      out[`rot${i}`] = r2(-90 + cum * 360);
      out[`frac${i}`] = Math.min(1, Math.max(0.001, +(f - gap).toFixed(4)));
      out[`ms${i}`] = Math.max(60, Math.round(f * DONUT.sweep));
      cum += f;
    }
    const dec = decimalsOf(values);
    const totalSize = fit(formatCount(total, { decimals: dec }), 64, 26).size;
    const caption = fitLabel(v.caption, 58, 9.5, 7.5);
    return {
      ...legendValues(parseLabels(v.labels, SLOTS), fractions, at, DONUT.cy),
      ...out,
      total: +total.toFixed(dec),
      dec,
      totalSize,
      totalY: r1(DONUT.cy + totalSize * 0.35 - (String(v.caption).trim() ? 5 : 0)),
      captionY: r1(DONUT.cy + totalSize * 0.35 + 9),
      captionText: caption.text,
      captionSize: caption.size,
      captionLength: caption.length,
      countMs: DONUT.start + DONUT.sweep,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 260 160" font-family="${SANS}"><!-- {{values: text default='42,28,18,12' label='Values (comma-separated)'}} {{labels: text default='Direct,Social,Search,Email' label='Labels (comma-separated)'}} {{caption: text default='visits' label='Caption'}} {{ink: color default=#1E293B label='Text'}} {{track: color default=#E2E8F0 label='Track'}} ${palette()} --><circle cx="${DONUT.cx}" cy="${DONUT.cy}" r="${DONUT.r}" fill="none" stroke="{{track}}" stroke-width="${DONUT.width}"/>${Array.from(
      { length: SLOTS },
      (_, i) =>
        `<g display="{{show${i}}}"><circle id="donutChartSeg${i}" cx="${DONUT.cx}" cy="${DONUT.cy}" r="${DONUT.r}" fill="none" stroke="{{c${i + 1}}}" stroke-width="${DONUT.width}" transform="rotate({{rot${i}}} ${DONUT.cx} ${DONUT.cy})"/></g>`,
    ).join(
      "",
    )}<text id="donutChartTotal" x="${DONUT.cx}" y="{{totalY}}" text-anchor="middle" font-size="{{totalSize}}" font-weight="800" fill="{{ink}}">0</text><text x="${DONUT.cx}" y="{{captionY}}" text-anchor="middle" font-size="{{captionSize}}" textLength="{{captionLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.6">{{captionText}}</text>${legendMarkup("donutChart")}</svg>`,
    animate: [
      ...Array.from({ length: SLOTS }, (_, i): SvgAnimation => ({ id: `donutChartSeg${i}`, draw: [0, n(`frac${i}`)], delay: n(`at${i}`), ms: n(`ms${i}`), ease: "linear" })),
      { id: "donutChartTotal", count: [0, n("total")], decimals: n("dec"), ms: n("countMs"), ease: "out" },
      ...legendAnimations("donutChart"),
    ],
  },
};

// ── Pie chart ──────────────────────────────────────────────────────────

const PIE = { cx: 80, cy: 80, r: 58, pop: 7, start: 150, stagger: 230 };
const PIE_DEFAULT = [38, 26, 20, 16];
/** A pie slice's group: pushed out by (`dx`, `dy`) and scaled by `s` about the centre. */
const pieMove = (dx: string | number, dy: string | number, s: number) => `translate(${dx} ${dy}) translate(${PIE.cx} ${PIE.cy}) scale(${s}) translate(${-PIE.cx} ${-PIE.cy})`;

/** A pie wedge from fraction `a` to `b` of the way round, clockwise from the top. */
function wedge(a: number, b: number): string {
  const { cx, cy, r } = PIE;
  if (b - a <= 0) return `M${cx} ${cy}Z`;
  if (b - a >= 0.9999) return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const at = (f: number) => `${r2(cx + r * Math.sin(f * 2 * Math.PI))} ${r2(cy - r * Math.cos(f * 2 * Math.PI))}`;
  return `M${cx} ${cy} L${at(a)} A${r} ${r} 0 ${b - a > 0.5 ? 1 : 0} 1 ${at(b)}Z`;
}

export const pieChart: VectorEffect = {
  kind: "vector",
  id: "pie-chart",
  name: "Pie chart",
  description: "Pie slices popping out one at a time and settling into place, each with its percentage, beside a legend.",
  category: "data",
  tags: ["chart", "pie", "share", "percentage", "dashboard", "report"],
  hold: 1600,
  presets: [...PALETTE_PRESETS, { name: "Survey", values: { values: "54,31,15", labels: "Yes,No,Not sure" } }],
  derived: (v) => {
    const values = parseShares(v.values, SLOTS, PIE_DEFAULT);
    const total = values.reduce((a, b) => a + b, 0);
    const fractions = values.map((x) => x / total);
    const out: Record<string, string | number> = {};
    const at: number[] = [];
    const ink = paint(v.ink);
    let cum = 0;
    for (let i = 0; i < SLOTS; i++) {
      const f = fractions[i] ?? 0;
      const mid = (cum + f / 2) * 2 * Math.PI;
      const inside = f >= 0.08;
      out[`tshow${i}`] = f >= 0.04 ? "inline" : "none";
      const radius = inside ? PIE.r * 0.62 : PIE.r + 14;
      at.push(PIE.start + i * PIE.stagger);
      out[`d${i}`] = wedge(cum, cum + f);
      out[`ox${i}`] = r2(PIE.pop * Math.sin(mid));
      out[`oy${i}`] = r2(-PIE.pop * Math.cos(mid));
      out[`tx${i}`] = r1(PIE.cx + radius * Math.sin(mid));
      out[`ty${i}`] = r1(PIE.cy - radius * Math.cos(mid) + 4);
      out[`tf${i}`] = inside ? paint(v.onSlice) : ink;
      out[`tl${i}`] = PIE.start + i * PIE.stagger + 260;
      cum += f;
    }
    return { ...legendValues(parseLabels(v.labels, SLOTS), fractions, at, PIE.cy), ...out };
  },
  motion: {
    svg: `<svg viewBox="0 0 260 160" font-family="${SANS}"><!-- {{values: text default='38,26,20,16' label='Values (comma-separated)'}} {{labels: text default='Product,Services,Support,Other' label='Labels (comma-separated)'}} {{ink: color default=#1E293B label='Text'}} {{onSlice: color default=#FFFFFF label='Labels on slices'}} {{edge: color default=#FFFFFF label='Slice edges'}} ${palette()} -->${Array.from(
      { length: SLOTS },
      (_, i) =>
        `<g id="pieChartSlice${i}" display="{{show${i}}}" transform="${pieMove(0, 0, 0)}"><path d="{{d${i}}}" fill="{{c${i + 1}}}" stroke="{{edge}}" stroke-width="2" stroke-linejoin="round"/></g>`,
    ).join("")}${Array.from(
      { length: SLOTS },
      (_, i) =>
        `<text id="pieChartLabel${i}" display="{{tshow${i}}}" x="{{tx${i}}}" y="{{ty${i}}}" text-anchor="middle" font-size="11" font-weight="700" fill="{{tf${i}}}" opacity="0">0%</text>`,
    ).join("")}${legendMarkup("pieChart")}</svg>`,
    animate: [
      ...Array.from({ length: SLOTS }, (_, i): SvgAnimation[] => [
        { id: `pieChartSlice${i}`, attrs: { transform: [pieMove(0, 0, 0), pieMove(`{{ox${i}}}`, `{{oy${i}}}`, 1.06)] }, delay: n(`at${i}`), ms: 260, ease: "out" },
        { id: `pieChartSlice${i}`, attrs: { transform: [pieMove(`{{ox${i}}}`, `{{oy${i}}}`, 1.06), pieMove(0, 0, 1)] }, delay: n(`tl${i}`), ms: 300, ease: "in-out" },
        { id: `pieChartLabel${i}`, attrs: { opacity: [0, 1] }, delay: n(`tl${i}`), ms: 200 },
        { id: `pieChartLabel${i}`, count: [0, n(`pct${i}`)], format: "{n}%", delay: n(`tl${i}`), ms: 500, ease: "out" },
      ]).flat(),
      ...legendAnimations("pieChart"),
    ],
  },
};

// ── Gauge ──────────────────────────────────────────────────────────────

const GAUGE = { cx: 120, cy: 112, r: 84, band: 14 };
/** A point on the gauge's arc, `f` of the way from its left end to its right. */
const gaugeAt = (f: number, r: number) => `${r2(GAUGE.cx - r * Math.cos(f * Math.PI))} ${r2(GAUGE.cy - r * Math.sin(f * Math.PI))}`;
const gaugeArc = (a: number, b: number) => (b - a <= 0.0005 ? `M${gaugeAt(a, GAUGE.r)}` : `M${gaugeAt(a, GAUGE.r)} A${GAUGE.r} ${GAUGE.r} 0 0 1 ${gaugeAt(b, GAUGE.r)}`);
const needle = (deg: number | string) => `rotate(${deg} ${GAUGE.cx} ${GAUGE.cy})`;

export const gauge: VectorEffect = {
  kind: "vector",
  id: "gauge",
  name: "Gauge",
  description: "A speedometer gauge: its coloured band draws on, the needle sweeps past the value and settles, and the reading counts up beneath.",
  category: "data",
  tags: ["gauge", "speedometer", "meter", "kpi", "dashboard", "score"],
  hold: 1600,
  presets: [
    { name: "Speed", values: { value: 88, max: 160, unit: " km/h", label: "Speed", warn: 70, danger: 85 } },
    { name: "Dark", values: { ink: [0.94, 0.95, 0.97], needleColor: [0.94, 0.95, 0.97], hub: [0.06, 0.07, 0.1] } },
  ],
  derived: (v) => {
    const max = Math.max(0.001, Number(v.max) || 100);
    const value = Math.min(max, Math.max(0, Number(v.value) || 0));
    const f = value / max;
    const warn = Math.min(1, Math.max(0, Number(v.warn) / 100));
    const danger = Math.min(1, Math.max(warn, Number(v.danger) / 100));
    const dec = decimalsOf([value]);
    const unit = formatSafe(v.unit);
    const reading = fit(`${formatCount(value, { decimals: dec })}${unit}`, 150, 26);
    const label = fitLabel(v.label, 150, 10, 8);
    const ends = [0, max].map((x) => fit(formatCount(x, { decimals: decimalsOf([x]) }), 30, 10).size);
    return {
      band0: gaugeArc(0, warn),
      band1: gaugeArc(warn, danger),
      band2: gaugeArc(danger, 1),
      over: needle(r1(180 * Math.min(1, f + 0.06))),
      angle: needle(r1(180 * f)),
      reading: +value.toFixed(dec),
      dec,
      unit,
      readingSize: reading.size,
      labelText: label.text,
      labelSize: label.size,
      labelLength: label.length,
      maxText: formatCount(max, { decimals: decimalsOf([max]) }),
      maxSize: ends[1]!,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 170" font-family="${SANS}"><!-- {{value: float min=0 max=10000 default=72 step=1 label='Value'}} {{max: float min=1 max=10000 default=100 step=1 label='Scale maximum'}} {{unit: text default='%' label='Unit'}} {{label: text default='Performance' label='Label'}} {{warn: float min=0 max=100 default=60 step=1 label='Amber from (% of scale)'}} {{danger: float min=0 max=100 default=85 step=1 label='Red from (% of scale)'}} {{low: color default=#22C55E label='Low band'}} {{mid: color default=#F59E0B label='Middle band'}} {{high: color default=#EF4444 label='High band'}} {{needleColor: color default=#0F172A label='Needle'}} {{hub: color default=#FFFFFF label='Hub centre'}} {{ink: color default=#1E293B label='Text'}} --><path id="gaugeBand0" d="{{band0}}" fill="none" stroke="{{low}}" stroke-width="${GAUGE.band}"/><path id="gaugeBand1" d="{{band1}}" fill="none" stroke="{{mid}}" stroke-width="${GAUGE.band}"/><path id="gaugeBand2" d="{{band2}}" fill="none" stroke="{{high}}" stroke-width="${GAUGE.band}"/><g stroke="{{ink}}" stroke-opacity="0.35" stroke-linecap="round">${Array.from({ length: 11 }, (_, k) => `<path d="M${gaugeAt(k / 10, 70)} L${gaugeAt(k / 10, k % 5 ? 65 : 61)}" stroke-width="${k % 5 ? 1.5 : 2.5}"/>`).join("")}</g><text x="${GAUGE.cx - GAUGE.r}" y="130" text-anchor="middle" font-size="10" fill="{{ink}}" fill-opacity="0.6">0</text><text x="${GAUGE.cx + GAUGE.r}" y="130" text-anchor="middle" font-size="{{maxSize}}" fill="{{ink}}" fill-opacity="0.6">{{maxText}}</text><g id="gaugeNeedle" transform="${needle(0)}"><path d="M${GAUGE.cx} ${GAUGE.cy - 4} L${GAUGE.cx - GAUGE.r + 12} ${GAUGE.cy} L${GAUGE.cx} ${GAUGE.cy + 4}Z" fill="{{needleColor}}"/></g><circle cx="${GAUGE.cx}" cy="${GAUGE.cy}" r="8" fill="{{needleColor}}"/><circle cx="${GAUGE.cx}" cy="${GAUGE.cy}" r="3" fill="{{hub}}"/><text id="gaugeValue" x="${GAUGE.cx}" y="148" text-anchor="middle" font-size="{{readingSize}}" font-weight="800" fill="{{ink}}">0</text><text x="${GAUGE.cx}" y="164" text-anchor="middle" font-size="{{labelSize}}" textLength="{{labelLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.6">{{labelText}}</text></svg>`,
    animate: [
      ...[0, 1, 2].map((k): SvgAnimation => ({ id: `gaugeBand${k}`, draw: true, delay: k * 140, ms: 320, ease: k === 0 ? "out" : "linear" })),
      { id: "gaugeNeedle", attrs: { transform: [needle(0), "{{over}}"] }, delay: 300, ms: 900, ease: "out" },
      { id: "gaugeNeedle", attrs: { transform: ["{{over}}", "{{angle}}"] }, delay: 1200, ms: 450, ease: "in-out" },
      { id: "gaugeValue", count: [0, n("reading")], decimals: n("dec"), format: "{n}{{unit}}", delay: 300, ms: 1300, ease: "out" },
    ],
  },
};

// ── Bar race ───────────────────────────────────────────────────────────

const RACE_ROWS = 6;
const RACE_STATES = 5;
const RACE = { left: 74, top: 12, pitch: 28, height: 22, width: 320, value: 10, intro: 900, move: 1000, rest: 700 };
const RACE_DEFAULT: RaceRow[] = [
  { name: "Lumen", values: [12, 28, 41, 66] },
  { name: "Pixel", values: [30, 36, 48, 54] },
  { name: "Vertex", values: [22, 40, 39, 71] },
  { name: "Shader", values: [8, 20, 52, 60] },
  { name: "Raster", values: [18, 24, 30, 35] },
  { name: "Vector", values: [26, 30, 44, 49] },
];
const raceTime = (k: number) => RACE.intro + RACE.rest + (k - 1) * (RACE.move + RACE.rest);

export const barRace: VectorEffect = {
  kind: "vector",
  id: "bar-race",
  name: "Bar race",
  description: "A bar chart race: bars stretch and overtake each other, swapping places as the period label ticks through the years.",
  category: "data",
  tags: ["chart", "race", "ranking", "bar", "timeline", "explainer"],
  hold: 1800,
  presets: [
    ...PALETTE_PRESETS,
    { name: "Browsers", values: { rows: "Chrome:20,45,62,65;Firefox:28,30,22,8;Safari:5,8,15,19;Edge:0,2,4,5;Opera:3,2,2,2", periods: "2009,2012,2016,2020" } },
  ],
  derived: (v) => {
    const rows = parseRace(v.rows, RACE_ROWS, RACE_STATES, RACE_DEFAULT);
    const states = Math.max(1, rows[0]!.values.length);
    const all = rows.flatMap((r) => r.values);
    const dec = decimalsOf(all);
    const valueWidth = Math.max(...all.map((x) => textWidthEm(formatCount(x, { decimals: dec })))) * RACE.value;
    const barWidth = Math.max(40, RACE.width - RACE.left - 10 - valueWidth);
    const periods = parseLabels(v.periods, RACE_STATES);
    const end = states > 1 ? raceTime(states - 1) + RACE.move : RACE.intro;
    const out: Record<string, string | number> = { dec };
    // Each state's ranking (ties keep their order) and the scale it is drawn at.
    const ranks = Array.from({ length: RACE_STATES }, (_, k) => {
      const s = Math.min(k, states - 1);
      const order = rows.map((r, i) => [i, r.values[s]!] as const).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const rank = new Map(order.map(([i], place) => [i, place]));
      const top = Math.max(1e-9, order[0]![1]);
      return { s, rank, top };
    });
    for (let i = 0; i < RACE_ROWS; i++) {
      const row = rows[i];
      const name = fitLabel(row?.name ?? "", RACE.left - 12, 11, 8);
      out[`show${i}`] = row ? "inline" : "none";
      out[`nm${i}`] = name.text;
      out[`ns${i}`] = name.size;
      out[`nl${i}`] = name.length;
      out[`in${i}`] = i * 70;
      for (let k = 0; k < RACE_STATES; k++) {
        const { s, rank, top } = ranks[k]!;
        const value = row ? row.values[s]! : 0;
        const w = r1((value / top) * barWidth);
        out[`y${i}_${k}`] = RACE.top + (rank.get(i) ?? i) * RACE.pitch;
        out[`w${i}_${k}`] = w;
        out[`x${i}_${k}`] = r1(RACE.left + w + 5);
        out[`v${i}_${k}`] = value;
      }
    }
    for (let k = 1; k < RACE_STATES; k++) {
      out[`t${k}`] = k < states ? raceTime(k) : end;
      out[`m${k}`] = k < states ? RACE.move : 0;
      out[`tick${k}`] = k < states ? raceTime(k) + RACE.move / 2 : end;
      out[`solo${k}`] = Math.min(k, states - 1);
    }
    for (let k = 0; k < RACE_STATES; k++) {
      const p = fit(periods[k] ?? "", 120, 30);
      out[`p${k}`] = periods[k] ?? "";
      out[`ps${k}`] = p.size;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 ${RACE.width} 210" font-family="${SANS}"><!-- {{rows: text default='Lumen:12,28,41,66;Pixel:30,36,48,54;Vertex:22,40,39,71;Shader:8,20,52,60;Raster:18,24,30,35;Vector:26,30,44,49' label='Rows (Name:v1,v2,…; …)'}} {{periods: text default='2021,2022,2023,2024' label='Periods (comma-separated)'}} {{ink: color default=#1E293B label='Text'}} ${palette()} --><g id="barRacePeriod" font-weight="800" fill="{{ink}}" fill-opacity="0.22" text-anchor="end">${Array.from(
      { length: RACE_STATES },
      (_, k) => `<text x="${RACE.width - 8}" y="202" font-size="{{ps${k}}}"${k ? ` display="none"` : ""}>{{p${k}}}</text>`,
    ).join("")}</g>${Array.from(
      { length: RACE_ROWS },
      (_, i) =>
        `<g id="barRaceRow${i}" display="{{show${i}}}" opacity="0" transform="translate(0 {{y${i}_0}})"><text x="${RACE.left - 6}" y="15" text-anchor="end" font-size="{{ns${i}}}" textLength="{{nl${i}}}" lengthAdjust="spacingAndGlyphs" font-weight="600" fill="{{ink}}">{{nm${i}}}</text><rect id="barRaceBar${i}" x="${RACE.left}" y="0" width="0" height="${RACE.height}" rx="4" fill="{{c${i + 1}}}"/><text id="barRaceValue${i}" x="${RACE.left + 5}" y="15" font-size="${RACE.value}" font-weight="700" fill="{{ink}}">0</text></g>`,
    ).join("")}</svg>`,
    animate: [
      { id: "barRacePeriod", solo: 0 },
      ...Array.from({ length: RACE_STATES - 1 }, (_, j): SvgAnimation => ({ id: "barRacePeriod", solo: n(`solo${j + 1}`), delay: n(`tick${j + 1}`) })),
      ...Array.from({ length: RACE_ROWS }, (_, i): SvgAnimation[] => [
        { id: `barRaceRow${i}`, attrs: { opacity: [0, 1] }, delay: n(`in${i}`), ms: 300 },
        { id: `barRaceBar${i}`, attrs: { width: [0, n(`w${i}_0`)] }, delay: n(`in${i}`), ms: 800, ease: "out" },
        { id: `barRaceValue${i}`, attrs: { x: [RACE.left + 5, n(`x${i}_0`)] }, count: [0, n(`v${i}_0`)], decimals: n("dec"), delay: n(`in${i}`), ms: 800, ease: "out" },
        ...Array.from({ length: RACE_STATES - 1 }, (_, j): SvgAnimation[] => {
          const [a, b] = [j, j + 1];
          const at = { delay: n(`t${b}`), ms: n(`m${b}`), ease: "in-out" as const };
          return [
            { id: `barRaceRow${i}`, attrs: { transform: [`translate(0 {{y${i}_${a}}})`, `translate(0 {{y${i}_${b}}})`] }, ...at },
            { id: `barRaceBar${i}`, attrs: { width: [n(`w${i}_${a}`), n(`w${i}_${b}`)] }, ...at },
            { id: `barRaceValue${i}`, attrs: { x: [n(`x${i}_${a}`), n(`x${i}_${b}`)] }, count: [n(`v${i}_${a}`), n(`v${i}_${b}`)], decimals: n("dec"), ...at },
          ];
        }).flat(),
      ]).flat(),
    ],
  },
};

// ── Sparkline ──────────────────────────────────────────────────────────

const SPARK_DEFAULT = [4, 6, 5, 8, 7, 10, 9, 13];
const SPARK_DRAW = 1200;

/** A line through `values` in a box, and the area under it: path data. */
function linePath(values: number[], x0: number, x1: number, top: number, bottom: number) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, j) => [r1(x0 + (j * (x1 - x0)) / (values.length - 1)), r1(hi === lo ? (top + bottom) / 2 : bottom - ((v - lo) / span) * (bottom - top))] as const);
  const line = pts.map(([x, y], j) => `${j ? "L" : "M"}${x} ${y}`).join(" ");
  return { line, area: `${line} L${pts.at(-1)![0]} ${bottom + 3} L${pts[0]![0]} ${bottom + 3}Z`, end: pts.at(-1)! };
}

/** Readable numbers from a list (at least two), or `fallback`. */
function series(text: unknown, max: number, fallback: number[]): number[] {
  const values = parseNumberList(text, max).filter((x) => Number.isFinite(x));
  return values.length >= 2 ? values : values.length === 1 ? [values[0]!, values[0]!] : fallback;
}

export const sparkline: VectorEffect = {
  kind: "vector",
  id: "sparkline",
  name: "Sparkline",
  description: "A tiny trend line drawing in with a dot riding its tip, which then pulses beside the latest value; small enough to sit in a line of text.",
  category: "data",
  tags: ["chart", "sparkline", "trend", "inline", "kpi", "dashboard"],
  hold: 600,
  presets: [
    { name: "Falling", values: { values: "14,13,11,12,9,8,9,6", accent: [0.86, 0.15, 0.15] } },
    { name: "Violet", values: { accent: [0.55, 0.36, 0.96] } },
  ],
  derived: (v) => {
    const values = series(v.values, 32, SPARK_DEFAULT);
    const dec = decimalsOf(values);
    const e = Math.max(0.6, textWidthEm(formatCount(values.at(-1)!, { decimals: dec })));
    const size = r1(Math.min(13, 44 / e));
    const right = r1(120 - 3 - e * size - 6);
    const { line, area } = linePath(values, 4, right, 6, 26);
    return { line, area, size, valueX: r1(right + 6), first: values[0]!, last: values.at(-1)!, dec };
  },
  motion: {
    svg: `<svg viewBox="0 0 120 32" font-family="${SANS}"><!-- {{values: text default='4,6,5,8,7,10,9,13' label='Values (comma-separated)'}} {{accent: color default=#10B981 label='Line'}} {{ink: color default=#1E293B label='Value'}} --><defs><linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.3"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient></defs><path id="sparklineArea" d="{{area}}" fill="url(#sparklineFill)" opacity="0"/><path id="sparklineLine" d="{{line}}" fill="none" stroke="{{accent}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><g id="sparklineDot"><circle id="sparklinePulse" r="2.6" fill="none" stroke="{{accent}}" stroke-width="1.5" opacity="0"/><circle r="2.8" fill="{{accent}}"/></g><text id="sparklineValue" x="{{valueX}}" y="20.5" font-size="{{size}}" font-weight="700" fill="{{ink}}">0</text></svg>`,
    animate: [
      { id: "sparklineLine", draw: true, ms: SPARK_DRAW, ease: "in-out" },
      { id: "sparklineDot", along: "sparklineLine", ms: SPARK_DRAW, ease: "in-out" },
      { id: "sparklineArea", attrs: { opacity: [0, 1] }, delay: 700, ms: 600 },
      { id: "sparklineValue", count: [n("first"), n("last")], decimals: n("dec"), ms: SPARK_DRAW, ease: "in-out" },
      ...[0, 1, 2].map((k): SvgAnimation => ({ id: "sparklinePulse", attrs: { r: [2.6, 9], opacity: [0.8, 0] }, delay: SPARK_DRAW + 50 + k * 750, ms: 700, ease: "out" })),
    ],
  },
};

// ── Leaderboard ────────────────────────────────────────────────────────

const BOARD = { rows: 6, top: 8, pitch: 34, height: 30, left: 8, width: 244, slide: 130 };

export const leaderboard: VectorEffect = {
  kind: "vector",
  id: "leaderboard",
  name: "Leaderboard",
  description: "Ranked rows sliding into place from the bottom up, each with an initials avatar and a score counting up, then a highlight on the winner.",
  category: "data",
  tags: ["leaderboard", "ranking", "score", "game", "dashboard", "competition"],
  hold: 1800,
  presets: [
    { name: "Dark", values: { card: [0.12, 0.14, 0.19], ink: [0.94, 0.95, 0.97] } },
    { name: "Sales", values: { names: "North team,South team,East team,West team", scores: "128400,119250,98100,87600", accent: [0.13, 0.77, 0.37] } },
  ],
  derived: (v) => {
    const names = parseLabels(v.names, BOARD.rows);
    const scores = parseNumberList(v.scores, BOARD.rows).map((x) => (Number.isFinite(x) ? x : 0));
    const count = Math.min(BOARD.rows, Math.max(1, names.filter((s) => s !== "").length, scores.length));
    const rows = Array.from({ length: count }, (_, i) => ({ name: names[i] || `Player ${i + 1}`, score: scores[i] ?? 0 }));
    const order = rows.map((r, i) => [i, r.score] as const).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const rank = new Map(order.map(([i], place) => [i, place]));
    const dec = decimalsOf(rows.map((r) => r.score));
    const crown = (count - 1) * BOARD.slide + 450;
    const out: Record<string, string | number> = { dec, crown, settle: crown + 200 };
    for (let i = 0; i < BOARD.rows; i++) {
      const row = rows[i];
      const place = rank.get(i) ?? i;
      const wait = Math.max(0, count - 1 - place) * BOARD.slide;
      const scoreWidth = textWidthEm(formatCount(row?.score ?? 0, { decimals: dec })) * 12;
      const name = fitLabel(row?.name ?? "", Math.max(20, BOARD.left + BOARD.width - 12 - scoreWidth - 8 - 72), 12, 9);
      const initials =
        (row?.name ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => Array.from(w)[0]!)
          .join("")
          .toUpperCase() || "?";
      out[`show${i}`] = row ? "inline" : "none";
      out[`y${i}`] = BOARD.top + place * BOARD.pitch;
      out[`at${i}`] = wait;
      out[`land${i}`] = wait + 300;
      out[`rank${i}`] = place + 1;
      out[`nm${i}`] = name.text;
      out[`ns${i}`] = name.size;
      out[`nl${i}`] = name.length;
      out[`ini${i}`] = initials;
      out[`is${i}`] = r1(Math.min(10, 15 / Math.max(0.6, textWidthEm(initials))));
      out[`sc${i}`] = row?.score ?? 0;
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 260 214" font-family="${SANS}"><!-- {{names: text default='Ava Stone,Ben Ito,Cleo Park,Dev Shah,Eli Moss' label='Names (comma-separated)'}} {{scores: text default='870,980,640,820,510' label='Scores (comma-separated)'}} {{card: color default=#F1F5F9 label='Rows'}} {{ink: color default=#0F172A label='Text'}} {{accent: color default=#F59E0B label='Winner highlight'}} ${palette()} -->${Array.from(
      { length: BOARD.rows },
      (_, i) =>
        `<g id="leaderboardRow${i}" display="{{show${i}}}" opacity="0" transform="translate(280 {{y${i}}})"><rect x="${BOARD.left}" y="0" width="${BOARD.width}" height="${BOARD.height}" rx="8" fill="{{card}}"/><text x="26" y="19.5" text-anchor="middle" font-size="12" font-weight="700" fill="{{ink}}" fill-opacity="0.55">{{rank${i}}}</text><circle cx="52" cy="15" r="11" fill="{{c${i + 1}}}"/><text x="52" y="18.5" text-anchor="middle" font-size="{{is${i}}}" font-weight="700" fill="#FFFFFF">{{ini${i}}}</text><text x="70" y="19.5" font-size="{{ns${i}}}" textLength="{{nl${i}}}" lengthAdjust="spacingAndGlyphs" font-weight="600" fill="{{ink}}">{{nm${i}}}</text><text id="leaderboardScore${i}" x="${BOARD.left + BOARD.width - 12}" y="19.5" text-anchor="end" font-size="12" font-weight="700" fill="{{ink}}">0</text></g>`,
    ).join(
      "",
    )}<rect id="leaderboardRing" x="${BOARD.left}" y="${BOARD.top}" width="${BOARD.width}" height="${BOARD.height}" rx="8" fill="none" stroke="{{accent}}" stroke-width="2" opacity="0"/><rect id="leaderboardTop" x="${BOARD.left}" y="${BOARD.top}" width="${BOARD.width}" height="${BOARD.height}" rx="8" fill="{{accent}}" fill-opacity="0.12" stroke="{{accent}}" stroke-width="2" opacity="0"/><g id="leaderboardBadge" transform="translate(26 23) scale(0)"><circle r="10" fill="{{accent}}"/><path d="M-5 -3.5 L-2.5 -0.5 L0 -5 L2.5 -0.5 L5 -3.5 L4 3.5 H-4Z" fill="#FFFFFF"/></g></svg>`,
    animate: [
      ...Array.from({ length: BOARD.rows }, (_, i): SvgAnimation[] => [
        { id: `leaderboardRow${i}`, attrs: { transform: [`translate(280 {{y${i}}})`, `translate(0 {{y${i}}})`] }, delay: n(`at${i}`), ms: 450, ease: "out" },
        { id: `leaderboardRow${i}`, attrs: { opacity: [0, 1] }, delay: n(`at${i}`), ms: 200 },
        { id: `leaderboardScore${i}`, count: [0, n(`sc${i}`)], decimals: n("dec"), delay: n(`land${i}`), ms: 800, ease: "out" },
      ]).flat(),
      { id: "leaderboardTop", attrs: { opacity: [0, 1] }, delay: n("crown"), ms: 250 },
      { id: "leaderboardRing", attrs: { opacity: [0, 0.9] }, delay: n("crown"), ms: 0 },
      { id: "leaderboardRing", attrs: { x: [BOARD.left, BOARD.left - 5], y: [BOARD.top, BOARD.top - 5], width: [BOARD.width, BOARD.width + 10], height: [BOARD.height, BOARD.height + 10], opacity: [0.9, 0] }, delay: n("crown"), ms: 650, ease: "out" },
      { id: "leaderboardBadge", attrs: { transform: ["translate(26 23) scale(0)", "translate(26 23) scale(1.25)"] }, delay: n("crown"), ms: 200, ease: "out" },
      { id: "leaderboardBadge", attrs: { transform: ["translate(26 23) scale(1.25)", "translate(26 23) scale(1)"] }, delay: n("settle"), ms: 200, ease: "in-out" },
    ],
  },
};

// ── Area chart ─────────────────────────────────────────────────────────

const AREA = { series: 4, points: 12, x0: 34, x1: 268, top: 40, base: 150, sweep: 2400, rise: 1100 };
const AREA_DEFAULT = [
  [12, 18, 15, 24, 28, 34],
  [8, 10, 14, 12, 18, 22],
  [5, 6, 9, 8, 11, 14],
];

export const areaChart: VectorEffect = {
  kind: "vector",
  id: "area-chart",
  name: "Area chart",
  description: "A stacked area chart whose layers rise together from the baseline, then a tooltip line glides across reading the total.",
  category: "data",
  tags: ["chart", "area", "stacked", "trend", "dashboard", "report"],
  hold: 1400,
  presets: [...PALETTE_PRESETS.map((p) => ({ ...p, values: Object.fromEntries(Object.entries(p.values).slice(0, AREA.series)) })), { name: "Two series", values: { series: "5,9,7,12,15,14,18,22;3,4,6,5,8,9,8,11", labels: "Paid,Organic", points: "W1,W2,W3,W4,W5,W6,W7,W8" } }],
  derived: (v) => {
    const rows = parseSeries(v.series, AREA.series, AREA.points, AREA_DEFAULT);
    const points = rows[0]!.length;
    const cum = rows.map((_, s) => Array.from({ length: points }, (_, j) => rows.slice(0, s + 1).reduce((a, r) => a + r[j]!, 0)));
    const top = Math.max(1e-9, ...cum.at(-1)!);
    const x = (j: number) => r1(AREA.x0 + (j * (AREA.x1 - AREA.x0)) / (points - 1));
    const y = (value: number) => r1(AREA.base - (value / top) * (AREA.base - AREA.top));
    const edge = (values: number[], back: boolean) => {
      const pts = values.map((val, j) => `${x(j)} ${y(val)}`);
      return (back ? pts.reverse() : pts).join(" L");
    };
    const zero = new Array<number>(points).fill(0);
    const labels = parseLabels(v.labels, AREA.series);
    const xLabels = parseLabels(v.points, AREA.points);
    const dec = decimalsOf(rows.flat());
    const totals = cum.at(-1)!;
    const spacing = (AREA.x1 - AREA.x0) / (points - 1);
    const seg = AREA.sweep / (points - 1);
    const tip = AREA.rise + 200;
    const end = tip + AREA.sweep;
    const tipSize = r1(Math.min(9, 34 / Math.max(0.6, ...totals.map((t) => textWidthEm(formatCount(t, { decimals: dec }))))));
    const out: Record<string, string | number> = { dec, tip, tipSize, tx0: x(0), total0: +totals[0]!.toFixed(dec) };
    for (let s = 0; s < AREA.series; s++) {
      const shown = s < rows.length;
      const below = s > 0 && shown ? cum[s - 1]! : zero;
      const above = shown ? cum[s]! : zero;
      out[`show${s}`] = shown ? "inline" : "none";
      // Every layer rises from the baseline at once, so they stay stacked all the way up.
      out[`flat${s}`] = `M${edge(zero, false)} L${edge(zero, true)}Z`;
      out[`full${s}`] = `M${edge(above, false)} L${edge(below, true)}Z`;
      const lab = fitLabel(labels[s] ?? "", 50, 9, 7.5);
      out[`lab${s}`] = lab.text;
      out[`labs${s}`] = lab.size;
      out[`labl${s}`] = lab.length;
      out[`dy${s}_0`] = y(above[0]!);
    }
    for (let j = 0; j < AREA.points; j++) {
      const shown = j < points;
      const label = fitLabel(xLabels[j] ?? "", spacing * 0.9, 9, 7);
      out[`xs${j}`] = shown ? "inline" : "none";
      out[`xx${j}`] = shown ? x(j) : AREA.x1;
      out[`xl${j}`] = label.text;
      out[`xz${j}`] = label.size;
    }
    // The tooltip moves point to point, each stretch straight, as the areas' edges are.
    for (let j = 0; j < AREA.points - 1; j++) {
      const real = j < points - 1;
      const [a, b] = real ? [j, j + 1] : [points - 1, points - 1];
      out[`sd${j}`] = real ? Math.round(tip + j * seg) : end;
      out[`sm${j}`] = real ? Math.round(seg) : 0;
      out[`ta${j}`] = x(a);
      out[`tb${j}`] = x(b);
      out[`va${j}`] = +totals[a]!.toFixed(dec);
      out[`vb${j}`] = +totals[b]!.toFixed(dec);
      for (let s = 0; s < AREA.series; s++) {
        const c = s < rows.length ? cum[s]! : zero;
        out[`ya${s}_${j}`] = y(c[a]!);
        out[`yb${s}_${j}`] = y(c[b]!);
      }
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 300 176" font-family="${SANS}"><!-- {{series: text default='12,18,15,24,28,34;8,10,14,12,18,22;5,6,9,8,11,14' label='Series (values, rows split by ;)'}} {{labels: text default='Web,Mobile,API' label='Series labels (comma-separated)'}} {{points: text default='Jan,Feb,Mar,Apr,May,Jun' label='Point labels (comma-separated)'}} {{ink: color default=#1E293B label='Text'}} {{grid: color default=#E2E8F0 label='Grid'}} ${palette(AREA.series)} --><g stroke="{{grid}}" stroke-width="1">${[0, 1, 2, 3].map((k) => `<line x1="${AREA.x0}" x2="${AREA.x1}" y1="${AREA.top + (k * (AREA.base - AREA.top)) / 3}" y2="${AREA.top + (k * (AREA.base - AREA.top)) / 3}"/>`).join("")}</g>${Array.from(
      { length: AREA.series },
      (_, s) =>
        `<path id="areaChartArea${s}" display="{{show${s}}}" d="{{flat${s}}}" fill="{{c${s + 1}}}" fill-opacity="0.78" stroke="{{c${s + 1}}}" stroke-width="1.5" stroke-linejoin="round"/>`,
    ).join("")}${Array.from(
      { length: AREA.series },
      (_, s) =>
        `<g display="{{show${s}}}" transform="translate(${AREA.x0 + s * 64} 0)"><rect x="0" y="5" width="8" height="8" rx="2" fill="{{c${s + 1}}}"/><text x="12" y="12.5" font-size="{{labs${s}}}" textLength="{{labl${s}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{lab${s}}}</text></g>`,
    ).join("")}<g font-size="9" fill="{{ink}}" fill-opacity="0.6" text-anchor="middle">${Array.from(
      { length: AREA.points },
      (_, j) => `<text display="{{xs${j}}}" x="{{xx${j}}}" y="166" font-size="{{xz${j}}}">{{xl${j}}}</text>`,
    ).join("")}</g><g id="areaChartTip" opacity="0" transform="translate({{tx0}} 0)"><line x1="0" x2="0" y1="34" y2="${AREA.base}" stroke="{{ink}}" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="3 2"/><rect x="-20" y="18" width="40" height="16" rx="4" fill="{{ink}}"/><text id="areaChartTipValue" x="0" y="29" text-anchor="middle" font-size="{{tipSize}}" font-weight="700" fill="#FFFFFF">0</text>${Array.from(
      { length: AREA.series },
      (_, s) => `<circle id="areaChartDot${s}" display="{{show${s}}}" cx="0" cy="{{dy${s}_0}}" r="3" fill="#FFFFFF" stroke="{{c${s + 1}}}" stroke-width="2"/>`,
    ).join("")}</g></svg>`,
    animate: [
      ...Array.from({ length: AREA.series }, (_, s): SvgAnimation => ({ id: `areaChartArea${s}`, attrs: { d: [`{{flat${s}}}`, `{{full${s}}}`] }, ms: AREA.rise, ease: "out" })),
      { id: "areaChartTip", attrs: { opacity: [0, 1] }, delay: n("tip"), ms: 200 },
      { id: "areaChartTipValue", count: [n("total0"), n("total0")], decimals: n("dec"), delay: n("tip"), ms: 0 },
      ...Array.from({ length: AREA.points - 1 }, (_, j): SvgAnimation[] => {
        const at = { delay: n(`sd${j}`), ms: n(`sm${j}`), ease: "linear" as const };
        return [
          { id: "areaChartTip", attrs: { transform: [`translate({{ta${j}}} 0)`, `translate({{tb${j}}} 0)`] }, ...at },
          { id: "areaChartTipValue", count: [n(`va${j}`), n(`vb${j}`)], decimals: n("dec"), ...at },
          ...Array.from({ length: AREA.series }, (_, s): SvgAnimation => ({ id: `areaChartDot${s}`, attrs: { cy: [n(`ya${s}_${j}`), n(`yb${s}_${j}`)] }, ...at })),
        ];
      }).flat(),
    ],
  },
};

// ── KPI tile ───────────────────────────────────────────────────────────

const KPI_DEFAULT = [3, 4, 3.5, 5, 4.8, 6, 7.2];

export const kpiTile: VectorEffect = {
  kind: "vector",
  id: "kpi-tile",
  name: "KPI tile",
  description: "A dashboard tile: the headline figure counts up, a delta arrow shows the change in green or red by its sign, and a mini sparkline draws in.",
  category: "data",
  tags: ["kpi", "dashboard", "metric", "card", "sparkline", "report"],
  hold: 1600,
  presets: [
    { name: "Dark", values: { card: [0.09, 0.11, 0.15], ink: [0.95, 0.96, 0.97] } },
    { name: "Churn", values: { label: "Churn rate", value: 2.4, prefix: "", suffix: "%", delta: -0.6, trend: "3.4,3.3,3.1,3.0,2.8,2.6,2.4", caption: "vs last quarter" } },
  ],
  derived: (v) => {
    const value = Number(v.value) || 0;
    const dec = Math.min(3, Math.max(0, Math.round(Number(v.decimals) || 0)));
    const pre = formatSafe(v.prefix);
    const suf = formatSafe(v.suffix);
    const big = fit(`${pre}${formatCount(value, { decimals: dec })}${suf}`, 204, 34);
    const delta = Number(v.delta) || 0;
    const up = delta >= 0;
    const trend = series(v.trend, 24, KPI_DEFAULT);
    const { line, area, end } = linePath(trend, 148, 222, 90, 120);
    const label = fitLabel(v.label, 204, 12, 10);
    const caption = fitLabel(v.caption, 120, 10, 8);
    return {
      pre,
      suf,
      dec,
      value: +value.toFixed(dec),
      size: big.size,
      delta: +Math.abs(delta).toFixed(1),
      deltaFormat: up ? "+{n}%" : "−{n}%",
      deltaColor: paint(up ? v.up : v.down),
      arrow: up ? "M24 92 L30 100 H18Z" : "M24 101 L30 93 H18Z",
      line,
      area,
      endX: end[0],
      endY: end[1],
      labelText: label.text,
      captionText: caption.text,
      labelSize: label.size,
      labelLength: label.length,
      captionSize: caption.size,
      captionLength: caption.length,
    };
  },
  motion: {
    svg: `<svg viewBox="0 0 240 140" font-family="${SANS}"><!-- {{label: text default='Monthly revenue' label='Label'}} {{value: float min=0 max=1000000 default=48.2 step=0.1 label='Value'}} {{decimals: int min=0 max=3 default=1 label='Decimals'}} {{prefix: text default='$' label='Prefix'}} {{suffix: text default='k' label='Suffix'}} {{delta: float min=-100 max=100 default=12.4 step=0.1 label='Change (%)'}} {{caption: text default='vs last month' label='Caption'}} {{trend: text default='3,4,3.5,5,4.8,6,7.2' label='Trend (comma-separated)'}} {{card: color default=#FFFFFF label='Card'}} {{ink: color default=#0F172A label='Text'}} {{accent: color default=#6366F1 label='Sparkline'}} {{up: color default=#16A34A label='Rise'}} {{down: color default=#DC2626 label='Fall'}} --><defs><linearGradient id="kpiTileFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.28"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient></defs><rect x="2" y="2" width="236" height="136" rx="14" fill="{{card}}" stroke="{{ink}}" stroke-opacity="0.1"/><text x="18" y="30" font-size="{{labelSize}}" textLength="{{labelLength}}" lengthAdjust="spacingAndGlyphs" font-weight="600" fill="{{ink}}" fill-opacity="0.6">{{labelText}}</text><text id="kpiTileValue" x="18" y="72" font-size="{{size}}" font-weight="800" fill="{{ink}}">0</text><g id="kpiTileDelta" opacity="0"><path d="{{arrow}}" fill="{{deltaColor}}"/><text id="kpiTileDeltaValue" x="34" y="101" font-size="12" font-weight="700" fill="{{deltaColor}}">0%</text></g><text id="kpiTileCaption" x="18" y="124" font-size="{{captionSize}}" textLength="{{captionLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.55" opacity="0">{{captionText}}</text><path id="kpiTileArea" d="{{area}}" fill="url(#kpiTileFill)" opacity="0"/><path id="kpiTileLine" d="{{line}}" fill="none" stroke="{{accent}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle id="kpiTileEnd" cx="{{endX}}" cy="{{endY}}" r="0" fill="{{accent}}"/></svg>`,
    animate: [
      { id: "kpiTileValue", count: [0, n("value")], decimals: n("dec"), format: "{{pre}}{n}{{suf}}", ms: 1400, ease: "out" },
      { id: "kpiTileDelta", attrs: { opacity: [0, 1], transform: ["translate(0 6)", "translate(0 0)"] }, delay: 500, ms: 400, ease: "out" },
      { id: "kpiTileDeltaValue", count: [0, n("delta")], decimals: 1, format: "{{deltaFormat}}", delay: 500, ms: 900, ease: "out" },
      { id: "kpiTileCaption", attrs: { opacity: [0, 1] }, delay: 800, ms: 400 },
      { id: "kpiTileLine", draw: true, delay: 300, ms: 1100, ease: "in-out" },
      { id: "kpiTileArea", attrs: { opacity: [0, 1] }, delay: 900, ms: 500 },
      { id: "kpiTileEnd", attrs: { r: [0, 4.5] }, delay: 1400, ms: 180, ease: "out" },
      { id: "kpiTileEnd", attrs: { r: [4.5, 3] }, delay: 1580, ms: 200, ease: "in-out" },
    ],
  },
};

export const dataEffects: VectorEffect[] = [donutChart, pieChart, gauge, barRace, sparkline, leaderboard, areaChart, kpiTile];
