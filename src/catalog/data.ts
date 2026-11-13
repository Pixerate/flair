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

/*
 * Rolodex: four cards on a spindle, the front one flipping down over the rod
 * to show the next. Paint order is fixed, so there are two layers (the card
 * behind and the front card), each holding every entry with one showing;
 * when a flip ends both switch on an entry and the front stands back up,
 * which looks like nothing changed. Four flips bring it round.
 */
const ROLODEX_ENTRIES = 4;
const ROLODEX_MS = 1500;
const ROLODEX_FLIP_AT = 950;
const ROLODEX_FLIP = 300;
const ROLODEX_UP = "translate(0 170) scale(1 1) translate(0 -170)";
const ROLODEX_DOWN = "translate(0 170) scale(1 0.02) translate(0 -170)";

/** One card of the rolodex, entry `i`, in layer `layer`. */
function rolodexCard(layer: string, i: number, shown: boolean): string {
  return `<g id="rolodex${layer}${i}" opacity="${shown ? 1 : 0}"><text x="160" y="104" text-anchor="middle" textLength="{{len${i}}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{size${i}}}" font-weight="800" fill="{{ink}}">{{entry${i}}}</text><text x="160" y="130" text-anchor="middle" textLength="{{labelLen${i}}}" lengthAdjust="spacingAndGlyphs" font-family="${SANS}" font-size="{{labelSize${i}}}" fill="{{ink}}" opacity="0.6">{{label${i}}}</text></g>`;
}

/** The blank card every entry is written on. */
const ROLODEX_BLANK = `<rect x="80" y="30" width="160" height="140" rx="8" fill="{{card}}" stroke="#000000" stroke-opacity="0.12"/><rect x="80" y="30" width="160" height="7" rx="3.5" fill="{{accent}}"/><ellipse cx="130" cy="164" rx="7" ry="3" fill="#000000" opacity="0.25"/><ellipse cx="190" cy="164" rx="7" ry="3" fill="#000000" opacity="0.25"/>`;

export const rolodex: VectorEffect = {
  kind: "vector",
  id: "rolodex",
  name: "Rolodex",
  description: "Cards on a rolodex spindle flipping down one after another, each showing a figure and its label, for rotating stats, quotes or names.",
  category: "data",
  tags: ["card", "rolodex", "flip", "stat", "rotating", "testimonial", "retro", "loop"],
  hold: 0,
  presets: [
    { name: "Team", values: { entries: "Ada, Grace, Linus, Margaret", labels: "Engineering, Research, Platform, Apollo", accent: [0.92, 0.35, 0.36] } },
    { name: "Dark", values: { background: [0.06, 0.07, 0.1], card: [0.12, 0.13, 0.18], ink: [0.95, 0.96, 0.98] } },
  ],
  derived: (v) => {
    const entries = parseLabels(v.entries, ROLODEX_ENTRIES);
    const labels = parseLabels(v.labels, ROLODEX_ENTRIES);
    const out: Record<string, string | number> = {};
    for (let i = 0; i < ROLODEX_ENTRIES; i++) {
      const entry = fitLabel(entries[i] ?? "", 136, 34, 16);
      const label = fitLabel(labels[i] ?? "", 136, 13, 9);
      Object.assign(out, { [`entry${i}`]: entry.text, [`size${i}`]: entry.size, [`len${i}`]: entry.length, [`label${i}`]: label.text, [`labelSize${i}`]: label.size, [`labelLen${i}`]: label.length });
    }
    return out;
  },
  motion: {
    svg: `<svg viewBox="0 0 320 220"><!-- {{entries: text default='12k users, 4.9 rating, 99.9% uptime, 140 countries' label='Entries (comma separated)'}} {{labels: text default='signed up this month, on the App Store, over the last year, and counting' label='Labels (comma separated)'}} {{background: color default=#F1F5F9 label='Background'}} {{card: color default=#FFFFFF label='Card'}} {{ink: color default=#0F172A label='Text colour'}} {{accent: color default=#6366F1 label='Accent'}} {{metal: color default=#94A3B8 label='Spindle'}} --><rect width="320" height="220" fill="{{background}}"/><path d="M96 200 L224 200 L238 212 L82 212 Z" fill="{{metal}}" opacity="0.7"/><rect x="150" y="174" width="20" height="28" fill="{{metal}}" opacity="0.8"/>${[16, 10, 4]
      .map((dy, k) => `<g transform="translate(0 ${-dy})" opacity="${0.55 + k * 0.15}">${ROLODEX_BLANK}</g>`)
      .join("")}<g id="rolodexBehind">${ROLODEX_BLANK}${Array.from({ length: ROLODEX_ENTRIES }, (_, i) => rolodexCard("Behind", i, i === 1)).join("")}</g><g id="rolodexFront" transform="${ROLODEX_UP}">${ROLODEX_BLANK}${Array.from({ length: ROLODEX_ENTRIES }, (_, i) => rolodexCard("Front", i, i === 0)).join("")}<rect id="rolodexShade" x="80" y="30" width="160" height="140" rx="8" fill="#000000" opacity="0"/></g><rect x="66" y="166" width="188" height="9" rx="4.5" fill="{{metal}}"/><circle cx="66" cy="170.5" r="8" fill="{{metal}}"/><circle cx="254" cy="170.5" r="8" fill="{{metal}}"/><rect x="66" y="167" width="188" height="2.5" rx="1.2" fill="#FFFFFF" opacity="0.35"/></svg>`,
    animate: Array.from({ length: ROLODEX_ENTRIES }, (_, k): SvgAnimation[] => {
      const at = k * ROLODEX_MS + ROLODEX_FLIP_AT;
      // An element shows its first change's starting value until it begins, so each swap starts from what was showing.
      const swap = (id: string, attr: string, from: string | number, to: string | number): SvgAnimation => ({ id, attrs: { [attr]: [from, to] }, delay: at + ROLODEX_FLIP, ms: 0 });
      const showing = (i: number, entry: number) => (i === entry % ROLODEX_ENTRIES ? 1 : 0);
      return [
        { id: "rolodexFront", attrs: { transform: [ROLODEX_UP, ROLODEX_DOWN] }, delay: at, ms: ROLODEX_FLIP, ease: [0.55, 0, 0.9, 0.45] },
        { id: "rolodexShade", attrs: { opacity: [0, 0.45] }, delay: at, ms: ROLODEX_FLIP, ease: "linear" },
        swap("rolodexFront", "transform", ROLODEX_DOWN, ROLODEX_UP),
        swap("rolodexShade", "opacity", 0.45, 0),
        // The front now shows the entry that was behind it, and behind it the one after.
        ...Array.from({ length: ROLODEX_ENTRIES }, (_, i) => [
          swap(`rolodexFront${i}`, "opacity", showing(i, k), showing(i, k + 1)),
          swap(`rolodexBehind${i}`, "opacity", showing(i, k + 1), showing(i, k + 2)),
        ]).flat(),
      ];
    }).flat(),
  },
};

// ── Fan-out links ──────────────────────────────────────────────────────

/**
 * Fan-out links' layout: the source card on the left, the point its links
 * leave from, and the column of targets on the right, which bulges out in
 * the middle so the fan reads as an arc. Timings are in ms.
 */
const FAN = {
  slots: 10,
  card: { x: 20, y: 96, w: 120, h: 48 },
  from: [140, 120] as const,
  mid: 120,
  half: 98,
  pitch: 26,
  left: 232,
  bulge: 34,
  right: 388,
  start: 350,
  stagger: 130,
  draw: 650,
};
const FAN_DEFAULT = ["Services", "Entities", "Regulations", "Policies", "Guidelines", "Standards", "Agencies"];

export const fanOutLinks: VectorEffect = {
  kind: "vector",
  id: "fan-out-links",
  name: "Fan-out links",
  description:
    "One source card sending a fan of curved links out to a column of targets, each drawn by a glowing comet head that lands on its label, the card's count ticking up as they arrive, then sparks running along the links.",
  category: "data",
  tags: ["network", "graph", "one-to-many", "relations", "dashboard", "explainer", "tech"],
  hold: 1500,
  presets: [
    { name: "Light", values: { background: [0.95, 0.96, 0.97], link: [0.2, 0.55, 0.6], head: [0.06, 0.46, 0.55], accent: [0.85, 0.53, 0.05], ink: [0.12, 0.16, 0.22] } },
    { name: "Neon", values: { background: [0.04, 0.02, 0.1], link: [0.66, 0.33, 0.97], head: [1, 1, 1], accent: [0.13, 0.83, 0.93], ink: [0.88, 0.86, 1] } },
    {
      name: "Team",
      values: { source: "Design team", labels: "Brand,Product,Web,Motion,Research", total: 0 },
    },
  ],
  derived: (v) => {
    const given = parseLabels(v.labels, FAN.slots).filter((s) => s !== "");
    const labels = given.length ? given : FAN_DEFAULT;
    const count = labels.length;
    const span = Math.min(FAN.pitch * (count - 1), FAN.half * 2);
    const [fx, fy] = FAN.from;
    const out: Record<string, string | number> = {};
    for (let i = 0; i < FAN.slots; i++) {
      const shown = i < count;
      const y = shown ? (count === 1 ? FAN.mid : FAN.mid - span / 2 + (span * i) / (count - 1)) : FAN.mid;
      const u = (y - FAN.mid) / FAN.half;
      const x = r1(FAN.left + FAN.bulge * (1 - u * u));
      const label = fitLabel(labels[i] ?? "", FAN.right - (x + 10), 10, 7);
      out[`show${i}`] = shown ? "inline" : "none";
      out[`d${i}`] = shown ? `M${fx} ${fy} C${r1(fx + (x - fx) * 0.55)} ${fy} ${r1(fx + (x - fx) * 0.45)} ${r1(y)} ${x} ${r1(y)}` : `M${fx} ${fy} L${fx + 1} ${fy}`;
      out[`x${i}`] = x;
      out[`y${i}`] = r1(y);
      out[`labelX${i}`] = r1(x + 10);
      out[`labelY${i}`] = r1(y + label.size * 0.35);
      out[`text${i}`] = label.text;
      out[`size${i}`] = label.size;
      out[`length${i}`] = label.length;
    }
    const total = Math.round(Number(v.total)) > 0 ? Math.round(Number(v.total)) : count;
    const landed = FAN.start + (count - 1) * FAN.stagger + FAN.draw;
    const caption = fitLabel(v.source, FAN.card.w - 24, 10, 7);
    return {
      ...out,
      total,
      countMs: landed - FAN.start,
      settle: landed + 350,
      captionText: caption.text,
      captionSize: caption.size,
      captionLength: caption.length,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: (() => {
    const { x: cx, y: cy, w: cw, h: ch } = FAN.card;
    const heads = ["{{head}}", "{{link}}", "{{accent}}"];
    const slots = Array.from({ length: FAN.slots }, (_, i) => i);
    const at = (i: number) => FAN.start + i * FAN.stagger;
    return {
      svg: `<svg viewBox="0 0 400 240" font-family="${SANS}"><!-- {{source: text default='Related laws' label='Source'}} {{labels: text default='Services,Entities,Regulations,Policies,Guidelines,Standards,Agencies' label='Targets (comma-separated, up to 10)'}} {{total: int min=0 max=99999 default=0 label='Count on the card (0: one per target)'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{link: color default=#5EC8C4 label='Links'}} {{head: color default=#FFFFFF label='Comet heads'}} {{accent: color default=#F2C46D label='Accent'}} {{ink: color default=#D7E3E6 label='Text'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs><filter id="fanOutLinksGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="fanOutLinksVignette" cx="0.35" cy="0.5" r="0.75"><stop offset="0" stop-color="{{link}}" stop-opacity="0.1"/><stop offset="1" stop-color="{{link}}" stop-opacity="0"/></radialGradient></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="240" fill="{{background}}"/><rect width="400" height="240" fill="url(#fanOutLinksVignette)"/></g>${slots
        .map(
          (i) =>
            `<g display="{{show${i}}}"><path id="fanOutLinksLink${i}" d="{{d${i}}}" fill="none" stroke="{{link}}" stroke-width="1.2" stroke-opacity="0.7"/><circle id="fanOutLinksDot${i}" cx="{{x${i}}}" cy="{{y${i}}}" r="2.4" fill="{{link}}" filter="url(#fanOutLinksGlow)" opacity="0"/><text id="fanOutLinksLabel${i}" x="{{labelX${i}}}" y="{{labelY${i}}}" font-size="{{size${i}}}" textLength="{{length${i}}}" lengthAdjust="spacingAndGlyphs" font-weight="500" fill="{{ink}}" opacity="0">{{text${i}}}</text><circle id="fanOutLinksHead${i}" r="3.2" fill="${heads[i % heads.length]}" filter="url(#fanOutLinksGlow)" opacity="0"/><circle id="fanOutLinksSpark${i}" r="1.6" fill="{{head}}" filter="url(#fanOutLinksGlow)" opacity="0"/></g>`,
        )
        .join(
          "",
        )}<g id="fanOutLinksCard"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="7" fill="{{link}}" fill-opacity="0.08" stroke="{{ink}}" stroke-opacity="0.18"/><rect id="fanOutLinksCardRing" x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="7" fill="none" stroke="{{accent}}" stroke-width="1.6" filter="url(#fanOutLinksGlow)" opacity="0"/><text id="fanOutLinksCount" x="${cx + 12}" y="${cy + 22}" font-size="17" font-weight="700" fill="{{ink}}">0</text><text x="${cx + 12}" y="${cy + 38}" font-size="{{captionSize}}" textLength="{{captionLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.65">{{captionText}}</text></g><circle cx="${FAN.from[0]}" cy="${FAN.from[1]}" r="2.6" fill="{{accent}}" filter="url(#fanOutLinksGlow)"/></svg>`,
      animate: [
        { id: "fanOutLinksCardRing", attrs: { opacity: [0, 1] }, ms: 300 },
        { id: "fanOutLinksCount", count: [0, n("total")], delay: FAN.start, ms: n("countMs"), ease: "linear" },
        ...slots.flatMap((i): SvgAnimation[] => [
          { id: `fanOutLinksLink${i}`, draw: true, delay: at(i), ms: FAN.draw, ease: "in-out" },
          { id: `fanOutLinksHead${i}`, attrs: { opacity: [0, 1] }, delay: at(i), ms: 120 },
          { id: `fanOutLinksHead${i}`, along: `fanOutLinksLink${i}`, delay: at(i), ms: FAN.draw, ease: "in-out" },
          { id: `fanOutLinksHead${i}`, attrs: { opacity: [1, 0], r: [3.2, 7] }, delay: at(i) + FAN.draw, ms: 260, ease: "out" },
          { id: `fanOutLinksDot${i}`, attrs: { opacity: [0, 1], r: [0.5, 2.4] }, delay: at(i) + FAN.draw - 40, ms: 220, ease: "out" },
          { id: `fanOutLinksLabel${i}`, attrs: { opacity: [0, 1], x: [`{{x${i}}}` as unknown as number, n(`labelX${i}`)] }, delay: at(i) + FAN.draw - 80, ms: 360, ease: "out" },
          // Once every link has landed, sparks run out along them in turn.
          { id: `fanOutLinksSpark${i}`, attrs: { opacity: [0, 1] }, delay: n("settle"), ms: 1 },
          { id: `fanOutLinksSpark${i}`, along: `fanOutLinksLink${i}`, delay: n("settle"), ms: 900 + (i % 3) * 150, ease: "in-out" },
          { id: `fanOutLinksSpark${i}`, attrs: { opacity: [1, 0] }, delay: n("settle"), ms: 900 + (i % 3) * 150, ease: [0.6, 0, 1, 1] },
        ]),
      ],
    };
  })(),
};

// ── Hub-and-spoke graph ────────────────────────────────────────────────

/**
 * Hub-and-spoke graph's layout and timing: the hub in the middle, up to
 * `slots` spokes round it on a slightly squashed ring (wider than tall, to
 * fill the frame), each spoke's node with up to `leaves` leaves fanning
 * outward. Times are in ms; spoke `i` leaves the hub at `start + i·stagger`
 * and lands `spoke` later, and its leaves follow it out.
 */
const HSG = {
  cx: 200,
  cy: 150,
  slots: 8,
  leaves: 4,
  radius: 92,
  squash: 1.3,
  start: 450,
  stagger: 90,
  spoke: 500,
  leafGap: 150,
  leafStagger: 80,
  leafMs: 320,
  nodeR: 6.5,
  leafR: 2.6,
  dust: 26,
};
const HSG_DEFAULT = ["Research", "Design", "Engineering", "Data", "Security", "Growth", "Support"];
/** A fixed scatter in [0, 1) for slot `k`, so the layout looks hand-placed and stays the same every play. */
const scatter = (k: number) => {
  const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const hsgLanded = (i: number) => HSG.start + i * HSG.stagger + HSG.spoke;
const hsgLeafAt = (i: number, j: number) => hsgLanded(i) + HSG.leafGap + j * HSG.leafStagger;

export const hubSpokeGraph: VectorEffect = {
  kind: "vector",
  id: "hub-spoke-graph",
  name: "Hub-and-spoke graph",
  description:
    "A glowing hub igniting in a puff of dust, then spokes shooting out to glossy pearl nodes on comet heads, each node branching into small leaves and linking to its neighbours, with sparks running out along the spokes and the hub pulsing.",
  category: "data",
  tags: ["network", "graph", "hub", "constellation", "relations", "dashboard", "explainer", "tech"],
  hold: 1500,
  presets: [
    {
      name: "Light",
      values: { background: [0.95, 0.96, 0.97], core: [0.85, 0.55, 0.1], spoke: [0.75, 0.6, 0.35], node: [0.86, 0.3, 0.55], leaf: [0.45, 0.35, 0.85], comet: [0.1, 0.5, 0.9], ink: [0.12, 0.16, 0.22] },
    },
    {
      name: "Neon",
      values: { background: [0.04, 0.02, 0.1], core: [0.13, 0.83, 0.93], spoke: [0.6, 0.4, 1], node: [0.96, 0.45, 0.71], leaf: [0.5, 0.9, 1], comet: [1, 1, 1], ink: [0.88, 0.86, 1] },
    },
    { name: "Solar system", values: { hub: "Sun", labels: "Mercury,Venus,Earth,Mars,Jupiter,Saturn,Uranus,Neptune", leaves: 2 } },
  ],
  derived: (v) => {
    const given = parseLabels(v.labels, HSG.slots).filter((s) => s !== "");
    const labels = given.length ? given : HSG_DEFAULT;
    const count = labels.length;
    const leaves = Math.min(HSG.leaves, Math.max(0, Math.round(Number(v.leaves)) || 0));
    const step = 360 / count;
    const clamp = (x: number, lo: number, hi: number) => r1(Math.min(hi, Math.max(lo, x)));
    const out: Record<string, string | number> = {};
    const points: [number, number][] = [];
    for (let i = 0; i < HSG.slots; i++) {
      const shown = i < count;
      // Offset by half a step so no spoke runs straight down through the hub's label.
      const a = ((-90 + step * 0.5 + i * step + (scatter(i) - 0.5) * Math.min(18, step * 0.3)) * Math.PI) / 180;
      const r = HSG.radius + (scatter(i + 11) - 0.5) * 22;
      const x = r1(HSG.cx + Math.cos(a) * r * HSG.squash);
      const y = r1(HSG.cy + Math.sin(a) * r);
      points.push([x, y]);
      out[`show${i}`] = shown ? "inline" : "none";
      out[`x${i}`] = x;
      out[`y${i}`] = y;
      out[`spoke${i}`] = `M${HSG.cx} ${HSG.cy} L${x} ${y}`;
      // The label sits on the hub's side of its node, away from the leaves fanning outward.
      const label = fitLabel(labels[i] ?? "", 74, 9, 6);
      const ly = y < HSG.cy ? y + 17 : y - 11;
      out[`label${i}`] = label.text;
      out[`labelSize${i}`] = label.size;
      out[`labelLength${i}`] = label.length;
      out[`labelX${i}`] = r1(x - label.length / 2);
      out[`labelY${i}`] = r1(ly + label.size * 0.35);
      out[`pillX${i}`] = r1(x - label.length / 2 - 4);
      out[`pillY${i}`] = r1(ly - label.size * 0.6 - 2);
      out[`pillW${i}`] = r1(label.length + 8);
      out[`pillH${i}`] = r1(label.size * 1.2 + 4);
      for (let j = 0; j < HSG.leaves; j++) {
        const k = i * HSG.leaves + j;
        const la = a + (((j - (leaves - 1) / 2) * 34 + (scatter(k + 31) - 0.5) * 14) * Math.PI) / 180;
        const d = 26 + scatter(k + 47) * 14;
        const lx = clamp(x + Math.cos(la) * d, 8, 392);
        const lyy = clamp(y + Math.sin(la) * d, 8, 292);
        out[`leafShow${k}`] = shown && j < leaves ? "inline" : "none";
        out[`leaf${k}`] = `M${x} ${y} L${lx} ${lyy}`;
        out[`lx${k}`] = lx;
        out[`ly${k}`] = lyy;
      }
    }
    for (let i = 0; i < HSG.slots; i++) {
      const [x1, y1] = points[i]!;
      const [x2, y2] = points[(i + 1) % count]!;
      out[`chordShow${i}`] = i < count && count >= 3 ? "inline" : "none";
      out[`chord${i}`] = `M${x1} ${y1} L${x2} ${y2}`;
    }
    const hub = fitLabel(v.hub, 96, 10, 7);
    const settle = hsgLanded(count - 1) + HSG.leafGap + Math.max(0, leaves - 1) * HSG.leafStagger + HSG.leafMs + 250;
    return {
      ...out,
      hubText: hub.text,
      hubSize: hub.size,
      hubLength: hub.length,
      hubX: r1(HSG.cx - hub.length / 2),
      hubPillX: r1(HSG.cx - hub.length / 2 - 6),
      hubPillW: r1(hub.length + 12),
      settle,
      settle2: settle + 900,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: (() => {
    const { cx, cy } = HSG;
    const slots = Array.from({ length: HSG.slots }, (_, i) => i);
    const leafSlots = Array.from({ length: HSG.slots * HSG.leaves }, (_, k) => k);
    const dust = Array.from({ length: HSG.dust }, (_, d) => {
      const a = (d / HSG.dust) * Math.PI * 2 + scatter(d + 90) * 0.6;
      const r = 26 + scatter(d + 120) * 34;
      return { d, x: r1(Math.cos(a) * r), y: r1(Math.sin(a) * r), size: r1(1.1 + scatter(d + 150) * 1.8) };
    });
    const pop = (s: number) => `translate(${cx} ${cy}) scale(${s})`;
    const hubY = cy + 31;
    return {
      svg: `<svg viewBox="0 0 400 300" font-family="${SANS}"><!-- {{hub: text default='Platform' label='Hub'}} {{labels: text default='Research,Design,Engineering,Data,Security,Growth,Support' label='Spokes (comma-separated, up to 8)'}} {{leaves: int min=0 max=4 default=3 label='Leaves per spoke'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{core: color default=#F2C46D label='Hub'}} {{spoke: color default=#E8C48A label='Spokes'}} {{node: color default=#E58FB5 label='Nodes'}} {{leaf: color default=#9F8CF0 label='Leaves'}} {{comet: color default=#6FC3FF label='Comets'}} {{ink: color default=#D7E3E6 label='Text'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs><filter id="hubSpokeGraphGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="hubSpokeGraphPearl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.4" stop-color="{{node}}"/><stop offset="1" stop-color="{{node}}" stop-opacity="0.55"/></radialGradient><radialGradient id="hubSpokeGraphLeafPearl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="0.45" stop-color="{{leaf}}"/><stop offset="1" stop-color="{{leaf}}" stop-opacity="0.6"/></radialGradient><radialGradient id="hubSpokeGraphCoreFill" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#FFF8E6"/><stop offset="0.45" stop-color="{{core}}"/><stop offset="1" stop-color="{{core}}" stop-opacity="0.6"/></radialGradient><radialGradient id="hubSpokeGraphVignette" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="{{core}}" stop-opacity="0.08"/><stop offset="1" stop-color="{{core}}" stop-opacity="0"/></radialGradient></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="300" fill="{{background}}"/><rect width="400" height="300" fill="url(#hubSpokeGraphVignette)"/></g>${slots
        .map((i) => `<g display="{{chordShow${i}}}"><path id="hubSpokeGraphChord${i}" d="{{chord${i}}}" fill="none" stroke="{{comet}}" stroke-width="0.7" stroke-opacity="0.3"/></g>`)
        .join("")}${slots
        .map(
          (i) =>
            `<g display="{{show${i}}}"><path id="hubSpokeGraphSpoke${i}" d="{{spoke${i}}}" fill="none" stroke="{{spoke}}" stroke-width="1.4" stroke-opacity="0.8" filter="url(#hubSpokeGraphGlow)"/></g>`,
        )
        .join("")}${leafSlots
        .map(
          (k) =>
            `<g display="{{leafShow${k}}}"><path id="hubSpokeGraphTwig${k}" d="{{leaf${k}}}" fill="none" stroke="{{leaf}}" stroke-width="0.8" stroke-opacity="0.55"/><circle id="hubSpokeGraphLeaf${k}" cx="{{lx${k}}}" cy="{{ly${k}}}" r="0" fill="url(#hubSpokeGraphLeafPearl)" filter="url(#hubSpokeGraphGlow)"/></g>`,
        )
        .join("")}${slots
        .map(
          (i) =>
            `<g display="{{show${i}}}"><circle id="hubSpokeGraphHalo${i}" cx="{{x${i}}}" cy="{{y${i}}}" r="${HSG.nodeR * 2.2}" fill="{{node}}" fill-opacity="0.22" filter="url(#hubSpokeGraphGlow)" opacity="0"/><circle id="hubSpokeGraphNode${i}" cx="{{x${i}}}" cy="{{y${i}}}" r="0" fill="url(#hubSpokeGraphPearl)"/><g id="hubSpokeGraphTag${i}" opacity="0"><rect x="{{pillX${i}}}" y="{{pillY${i}}}" width="{{pillW${i}}}" height="{{pillH${i}}}" rx="3" fill="{{background}}" fill-opacity="0.7"/><text x="{{labelX${i}}}" y="{{labelY${i}}}" font-size="{{labelSize${i}}}" textLength="{{labelLength${i}}}" lengthAdjust="spacingAndGlyphs" font-weight="500" fill="{{ink}}">{{label${i}}}</text></g><circle id="hubSpokeGraphComet${i}" r="2.8" fill="{{comet}}" filter="url(#hubSpokeGraphGlow)" opacity="0"/><circle id="hubSpokeGraphSpark${i}" r="1.6" fill="#FFFFFF" filter="url(#hubSpokeGraphGlow)" opacity="0"/></g>`,
        )
        .join("")}<g transform="translate(${cx} ${cy})">${dust
        .map((p) => `<circle id="hubSpokeGraphDust${p.d}" r="${p.size}" fill="{{core}}" opacity="0"/>`)
        .join("")}</g>${[0, 1]
        .map((k) => `<circle id="hubSpokeGraphPulse${k}" cx="${cx}" cy="${cy}" r="14" fill="none" stroke="{{core}}" stroke-width="1.2" opacity="0"/>`)
        .join("")}<g id="hubSpokeGraphHub" transform="${pop(0)}"><circle r="26" fill="{{core}}" fill-opacity="0.28" filter="url(#hubSpokeGraphGlow)"/><g id="hubSpokeGraphRing" transform="rotate(0)"><circle r="17.5" fill="none" stroke="{{core}}" stroke-width="3" stroke-dasharray="0.8 1.6" stroke-opacity="0.85"/><circle r="15" fill="none" stroke="{{core}}" stroke-width="0.6" stroke-opacity="0.7"/></g><circle r="12" fill="url(#hubSpokeGraphCoreFill)" filter="url(#hubSpokeGraphGlow)"/></g><g id="hubSpokeGraphHubTag" opacity="0"><rect x="{{hubPillX}}" y="${hubY - 9}" width="{{hubPillW}}" height="15" rx="4" fill="{{background}}" fill-opacity="0.75"/><text x="{{hubX}}" y="${hubY + 2}" font-size="{{hubSize}}" textLength="{{hubLength}}" lengthAdjust="spacingAndGlyphs" font-weight="700" fill="{{ink}}">{{hubText}}</text></g></svg>`,
      animate: [
        // The hub ignites: a puff of dust, then the core pops and its ring of ticks turns.
        ...dust.flatMap((p): SvgAnimation[] => [
          { id: `hubSpokeGraphDust${p.d}`, attrs: { opacity: [0.9, 0], cx: [0, p.x], cy: [0, p.y] }, delay: 40, ms: 900 + (p.d % 4) * 120, ease: "out" },
        ]),
        { id: "hubSpokeGraphHub", attrs: { transform: [pop(0), pop(1.18)] }, ms: 300, ease: "out" },
        { id: "hubSpokeGraphHub", attrs: { transform: [pop(1.18), pop(1)] }, delay: 300, ms: 260, ease: "in-out" },
        { id: "hubSpokeGraphRing", attrs: { transform: ["rotate(0)", "rotate(150)"] }, ms: 5000, ease: "linear" },
        { id: "hubSpokeGraphHubTag", attrs: { opacity: [0, 1] }, delay: 450, ms: 350 },
        ...slots.flatMap((i): SvgAnimation[] => {
          const at = HSG.start + i * HSG.stagger;
          const land = hsgLanded(i);
          const r = HSG.nodeR;
          return [
            // A spoke shoots out on a comet head, and its node pops on where it lands.
            { id: `hubSpokeGraphSpoke${i}`, draw: true, delay: at, ms: HSG.spoke, ease: "out" },
            { id: `hubSpokeGraphComet${i}`, attrs: { opacity: [0, 1] }, delay: at, ms: 80 },
            { id: `hubSpokeGraphComet${i}`, along: `hubSpokeGraphSpoke${i}`, delay: at, ms: HSG.spoke, ease: "out" },
            { id: `hubSpokeGraphComet${i}`, attrs: { opacity: [1, 0], r: [2.8, 8] }, delay: land, ms: 280, ease: "out" },
            { id: `hubSpokeGraphNode${i}`, attrs: { r: [0, r * 1.35] }, delay: land - 40, ms: 170, ease: "out" },
            { id: `hubSpokeGraphNode${i}`, attrs: { r: [r * 1.35, r] }, delay: land + 130, ms: 220, ease: "in-out" },
            { id: `hubSpokeGraphHalo${i}`, attrs: { opacity: [0, 1] }, delay: land, ms: 300 },
            { id: `hubSpokeGraphTag${i}`, attrs: { opacity: [0, 1] }, delay: land + 100, ms: 300 },
            { id: `hubSpokeGraphChord${i}`, draw: true, delay: land + 700, ms: 500, ease: "in-out" },
            // Once the graph is whole, sparks run out along the spokes twice.
            { id: `hubSpokeGraphSpark${i}`, attrs: { opacity: [0, 1] }, delay: n("settle"), ms: 1 },
            { id: `hubSpokeGraphSpark${i}`, along: `hubSpokeGraphSpoke${i}`, delay: n("settle"), ms: 800 + (i % 3) * 140, repeat: 2, ease: "in-out" },
            { id: `hubSpokeGraphSpark${i}`, attrs: { opacity: [1, 0] }, delay: n("settle"), ms: 800 + (i % 3) * 140, repeat: 2, ease: [0.6, 0, 1, 1] },
          ];
        }),
        ...leafSlots.flatMap((k): SvgAnimation[] => {
          const at = hsgLeafAt(Math.floor(k / HSG.leaves), k % HSG.leaves);
          return [
            { id: `hubSpokeGraphTwig${k}`, draw: true, delay: at, ms: HSG.leafMs, ease: "out" },
            { id: `hubSpokeGraphLeaf${k}`, attrs: { r: [0, HSG.leafR] }, delay: at + HSG.leafMs - 60, ms: 200, ease: "out" },
          ];
        }),
        // Rings pulse out from the hub as the sparks set off (hidden till then).
        ...[0, 1].map((k): SvgAnimation => ({ id: `hubSpokeGraphPulse${k}`, attrs: { opacity: [0, 0] }, ms: 1 })),
        ...[0, 1].map((k): SvgAnimation => ({
          id: `hubSpokeGraphPulse${k}`,
          attrs: { r: [14, 48], opacity: [0.7, 0], "stroke-width": [1.6, 0.4] },
          delay: n(k ? "settle2" : "settle"),
          ms: 1200,
          ease: "out",
        })),
      ],
    };
  })(),
};

// ── Stat cards ─────────────────────────────────────────────────────────

/**
 * Stat cards' layout and timing: up to `slots` cards in a grid laid out by
 * how many there are (a row of up to three, two by two for four, three by
 * two for five or six) inside the frame's margins. The cards fade in dim,
 * then light up one after another from `start`, `stagger` apart. Times are
 * in ms.
 */
const STAT = { slots: 6, left: 20, top: 24, width: 360, height: 192, gap: 12, start: 700, stagger: 520, count: 900 };
const STAT_VALUES = ["120+", "4800", "98%", "15 min"];

/**
 * A stat as written (`120+`, `$4.2M`, `98.5%`, `24/7`): the text before the
 * number, the number and its decimals, and the text after. Thousands commas
 * are allowed (`4,800`). Text with no number in it has `value` NaN.
 */
export function parseStat(text: string): { pre: string; value: number; dec: number; suf: string } {
  const m = /^([^\d]*?)(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)(.*)$/.exec(text);
  if (!m) return { pre: text, value: NaN, dec: 0, suf: "" };
  const digits = m[2]!.replace(/,/g, "");
  const value = Math.max(-1e9, Math.min(1e9, Number(digits)));
  return { pre: m[1]!, value, dec: Math.min(3, digits.split(".")[1]?.length ?? 0), suf: m[3]! };
}

export const statCards: VectorEffect = {
  kind: "vector",
  id: "stat-cards",
  name: "Stat cards",
  description:
    "A grid of headline stats that fade in dim, then light up one after another: an accent line draws across each card's top, a glowing ring flashes round it and its figure counts up, prefix and suffix kept (120+, $4.2M, 98%).",
  category: "data",
  tags: ["stat", "metric", "card", "dashboard", "highlight", "counter", "explainer", "tech"],
  hold: 1800,
  presets: [
    { name: "Light", values: { background: [0.95, 0.96, 0.97], card: [1, 1, 1], accent: [0.06, 0.55, 0.6], ink: [0.08, 0.12, 0.18] } },
    { name: "Gold", values: { background: [0.07, 0.06, 0.04], card: [0.13, 0.11, 0.07], accent: [0.95, 0.76, 0.36], ink: [0.96, 0.92, 0.84] } },
    { name: "Six up", values: { values: "$4.2M,38%,1.2k,99.9%,12,4.8", labels: "Revenue,Growth,Customers,Uptime,Markets,Rating" } },
  ],
  derived: (v) => {
    const given = parseLabels(v.values, STAT.slots);
    const valueTokens = given.some((s) => s !== "") ? given : STAT_VALUES;
    const labelTokens = parseLabels(v.labels, STAT.slots);
    const count = Math.max(1, Math.min(STAT.slots, valueTokens.length));
    const cols = count <= 3 ? count : count === 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const w = (STAT.width - (cols - 1) * STAT.gap) / cols;
    const h = Math.min(120, (STAT.height - (rows - 1) * STAT.gap) / rows);
    const top = STAT.top + (STAT.height - (rows * h + (rows - 1) * STAT.gap)) / 2;
    const out: Record<string, string | number> = {};
    for (let i = 0; i < STAT.slots; i++) {
      const shown = i < count;
      const row = Math.floor(i / cols);
      // A short last row is centred.
      const inRow = row === rows - 1 ? count - row * cols : cols;
      const rowLeft = STAT.left + (STAT.width - (inRow * w + (inRow - 1) * STAT.gap)) / 2;
      const x = r1(rowLeft + (i % cols) * (w + STAT.gap));
      const y = r1(top + row * (h + STAT.gap));
      const stat = parseStat(String(valueTokens[i] ?? ""));
      const numeric = Number.isFinite(stat.value);
      const pre = formatSafe(stat.pre);
      const suf = formatSafe(stat.suf);
      const shownText = numeric ? `${pre}${formatCount(stat.value, { decimals: stat.dec })}${suf}` : formatSafe(valueTokens[i]);
      const big = fit(shownText, w - 28, Math.min(30, h * 0.36));
      const label = fitLabel(labelTokens[i] ?? "", w - 28, Math.min(11, h * 0.14), 7);
      out[`show${i}`] = shown ? "inline" : "none";
      out[`x${i}`] = x;
      out[`y${i}`] = y;
      out[`w${i}`] = r1(w);
      out[`h${i}`] = r1(h);
      out[`tx${i}`] = r1(x + 14);
      out[`vy${i}`] = r1(y + h * 0.5 + big.size * 0.18);
      out[`ly${i}`] = r1(y + h * 0.5 + big.size * 0.18 + label.size + 7);
      out[`dotX${i}`] = r1(x + w - 14);
      out[`dotY${i}`] = r1(y + 14);
      out[`edge${i}`] = `M${r1(x + 8)} ${y} H${r1(x + w - 8)}`;
      out[`size${i}`] = big.size;
      out[`val${i}`] = numeric ? stat.value : 0;
      out[`dec${i}`] = numeric ? stat.dec : 0;
      out[`fmt${i}`] = numeric ? `${pre}{n}${suf}` : shownText;
      out[`label${i}`] = label.text;
      out[`labelSize${i}`] = label.size;
      out[`labelLength${i}`] = label.length;
    }
    const allLit = STAT.start + (count - 1) * STAT.stagger + STAT.count;
    return { ...out, finale: allLit + 250, finale2: allLit + 510, backdropOpacity: v.backdrop ? 1 : 0 };
  },
  motion: (() => {
    const slots = Array.from({ length: STAT.slots }, (_, i) => i);
    const lit = (i: number) => STAT.start + i * STAT.stagger;
    const at = (name: string, i: number) => `{{${name}${i}}}` as unknown as number;
    return {
      svg: `<svg viewBox="0 0 400 240" font-family="${SANS}"><!-- {{values: text default='120+,4800,98%,15 min' label='Values (comma-separated, up to 6; prefixes and suffixes kept)'}} {{labels: text default='Jurisdictions,Regulations tracked,Accuracy,Alert time' label='Labels (comma-separated)'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{card: color default=#10272C label='Cards'}} {{accent: color default=#5EC8C4 label='Accent'}} {{ink: color default=#E3EEF0 label='Text'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs><filter id="statCardsGlow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="statCardsVignette" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.09"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></radialGradient></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="240" fill="{{background}}"/><rect width="400" height="240" fill="url(#statCardsVignette)"/></g>${slots
        .map(
          (i) =>
            `<g id="statCardsCard${i}" display="{{show${i}}}" opacity="0"><rect id="statCardsFace${i}" x="{{x${i}}}" y="{{y${i}}}" width="{{w${i}}}" height="{{h${i}}}" rx="9" fill="{{card}}" stroke="{{ink}}" stroke-opacity="0.12"/><rect id="statCardsWash${i}" x="{{x${i}}}" y="{{y${i}}}" width="{{w${i}}}" height="{{h${i}}}" rx="9" fill="{{accent}}" opacity="0"/><rect id="statCardsRing${i}" x="{{x${i}}}" y="{{y${i}}}" width="{{w${i}}}" height="{{h${i}}}" rx="9" fill="none" stroke="{{accent}}" stroke-width="1.4" filter="url(#statCardsGlow)" opacity="0"/><path id="statCardsEdge${i}" d="{{edge${i}}}" fill="none" stroke="{{ink}}" stroke-width="2" stroke-linecap="round" opacity="0"/><circle id="statCardsDot${i}" cx="{{dotX${i}}}" cy="{{dotY${i}}}" r="2.4" fill="{{ink}}" opacity="0.25"/><text id="statCardsValue${i}" x="{{tx${i}}}" y="{{vy${i}}}" font-size="{{size${i}}}" font-weight="700" fill="{{ink}}" opacity="0.3">{{fmt${i}}}</text><text id="statCardsLabel${i}" x="{{tx${i}}}" y="{{ly${i}}}" font-size="{{labelSize${i}}}" textLength="{{labelLength${i}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="0.35">{{label${i}}}</text></g>`,
        )
        .join("")}</svg>`,
      animate: [
        ...slots.flatMap((i): SvgAnimation[] => [
          // In, dim, a little after one another.
          { id: `statCardsCard${i}`, attrs: { opacity: [0, 1], transform: ["translate(0 8)", "translate(0 0)"] }, delay: 80 * i, ms: 450, ease: "out" },
          // Lit: the top edge draws across, the ring flashes and settles,
          // the figure counts up and the text comes up to full strength.
          { id: `statCardsEdge${i}`, attrs: { opacity: [0, 1] }, delay: lit(i), ms: 1 },
          { id: `statCardsEdge${i}`, draw: true, delay: lit(i), ms: 420, ease: "in-out" },
          { id: `statCardsEdge${i}`, attrs: { opacity: [1, 0] }, delay: lit(i) + 420, ms: 500, ease: "out" },
          { id: `statCardsRing${i}`, attrs: { opacity: [0, 1] }, delay: lit(i) + 120, ms: 220, ease: "out" },
          { id: `statCardsRing${i}`, attrs: { opacity: [1, 0.35] }, delay: lit(i) + 340, ms: 700, ease: "in-out" },
          { id: `statCardsWash${i}`, attrs: { opacity: [0, 0.16] }, delay: lit(i) + 120, ms: 220, ease: "out" },
          { id: `statCardsWash${i}`, attrs: { opacity: [0.16, 0.06] }, delay: lit(i) + 340, ms: 700, ease: "in-out" },
          { id: `statCardsDot${i}`, attrs: { opacity: [0.25, 1], r: [2.4, 4] }, delay: lit(i) + 120, ms: 200, ease: "out" },
          { id: `statCardsDot${i}`, attrs: { r: [4, 2.6] }, delay: lit(i) + 320, ms: 300, ease: "in-out" },
          { id: `statCardsValue${i}`, attrs: { opacity: [0.3, 1] }, delay: lit(i) + 120, ms: 300 },
          { id: `statCardsValue${i}`, count: [0, at("val", i)], decimals: at("dec", i), format: `{{fmt${i}}}`, delay: lit(i) + 120, ms: STAT.count, ease: "out" },
          { id: `statCardsLabel${i}`, attrs: { opacity: [0.35, 0.75] }, delay: lit(i) + 200, ms: 300 },
          // Once all are lit, the rings pulse together.
          { id: `statCardsRing${i}`, attrs: { opacity: [0.35, 0.9] }, delay: n("finale"), ms: 260, ease: "out" },
          { id: `statCardsRing${i}`, attrs: { opacity: [0.9, 0.35] }, delay: n("finale2"), ms: 600, ease: "in-out" },
        ]),
      ],
    };
  })(),
};

// ── Year scrubber ──────────────────────────────────────────────────────

/**
 * A vertical timeline in a 220×400 frame: a density trace hugging the left
 * edge (up to `trace` wide), a column of year labels at `col` spread from
 * `top` to `bottom` (up to `slots` of them, thinned for long ranges), and a
 * year pill that pops in on the first year then glides to the chosen one.
 * Times are in ms.
 */
const YEAR = { w: 220, h: 400, slots: 13, top: 48, bottom: 352, trace: 56, col: 112, pillW: 66, pillH: 28, step: 4, grow: 1000, pop: 900, glide: 1500, glideMs: 1800 };
const YEAR_DEFAULT = [3, 4, 6, 5, 8, 12, 9, 7, 10, 14, 11, 8, 6, 9, 13, 10, 7, 5, 6, 4];
const YEAR_ARRIVE = YEAR.glide + YEAR.glideMs;

/** A repeatable jitter in [-1, 1] for sample `k`. */
const jitter = (k: number) => {
  const x = Math.sin(k * 12.9898 + 4.1) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * The density trace: `values` spread from `top` to `bottom` (held flat
 * beyond, tapering to nothing at the frame's top and bottom), roughened by
 * `grain` (0 smooth, 1 spiky). The filled shape and its rim, as path data.
 */
export function densityTrace(values: number[], grain: number): { fill: string; rim: string } {
  const hi = Math.max(...values.map((v) => Math.abs(v))) || 1;
  const at = (y: number) => {
    const u = Math.max(0, Math.min(1, (y - YEAR.top) / (YEAR.bottom - YEAR.top))) * (values.length - 1);
    const i = Math.min(values.length - 2, Math.floor(u));
    const f = u - i;
    const ease = f * f * (3 - 2 * f);
    return Math.abs(values[i]! + (values[i + 1]! - values[i]!) * ease) / hi;
  };
  const taper = (y: number) => {
    const t = Math.max(0, Math.min(1, Math.min(y, YEAR.h - y) / 36));
    return t * t * (3 - 2 * t);
  };
  const pts: string[] = [];
  for (let y = 0, k = 0; y <= YEAR.h; y += YEAR.step, k++) {
    const rough = 1 + grain * (0.32 * jitter(k) + 0.14 * jitter(k * 7 + 3));
    const x = YEAR.trace * (0.12 + 0.88 * at(y)) * rough * taper(y);
    pts.push(`${r1(Math.max(0, Math.min(YEAR.trace * 1.3, x)))} ${y}`);
  }
  const rim = `M${pts.join(" L")}`;
  return { fill: `M0 0 L${pts.join(" L")} L0 ${YEAR.h}Z`, rim };
}

/** Whole years in range, `fallback` for anything unreadable. */
const wholeYear = (v: unknown, fallback: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.max(1, Math.min(9999, x)) : fallback;
};

export const yearScrubber: VectorEffect = {
  kind: "vector",
  id: "year-scrubber",
  name: "Year scrubber",
  description:
    "A vertical timeline: a jagged density trace grows in down the left edge, a column of years fades in beside it, and a glowing year pill pops in on the first year and glides down to the chosen one, its number counting through the years and a highlight band riding the trace with it.",
  category: "data",
  tags: ["timeline", "year", "scrubber", "histogram", "dashboard", "sidebar", "tech"],
  hold: 1600,
  presets: [
    { name: "Light", values: { background: [0.95, 0.96, 0.97], panel: [1, 1, 1], ink: [0.1, 0.15, 0.2], accent: [0.06, 0.52, 0.58] } },
    { name: "Amber", values: { background: [0.07, 0.06, 0.04], panel: [0.15, 0.12, 0.07], ink: [0.95, 0.9, 0.8], accent: [0.96, 0.72, 0.3] } },
    { name: "Decade", values: { from: 2015, to: 2025, year: 2023, values: "2,3,3,5,4,7,9,8,12,15,13", grain: 0.4 } },
  ],
  derived: (v) => {
    let from = wholeYear(v.from, 2016);
    let to = wholeYear(v.to, 2024);
    if (to < from) [from, to] = [to, from];
    const year = Math.max(from, Math.min(to, wholeYear(v.year, 2020)));
    const span = to - from;
    const yOf = (y: number) => r1(span === 0 ? (YEAR.top + YEAR.bottom) / 2 : YEAR.top + ((y - from) / span) * (YEAR.bottom - YEAR.top));
    const stride = Math.max(1, Math.ceil(span / (YEAR.slots - 1)));
    const read = parseNumberList(v.values, 64).filter((x) => Number.isFinite(x));
    const values = read.length >= 2 ? read : read.length === 1 ? [read[0]!, read[0]!] : YEAR_DEFAULT;
    const grain = Math.max(0, Math.min(1, Number(v.grain) || 0));
    const { fill, rim } = densityTrace(values, grain);
    const out: Record<string, string | number> = {};
    for (let i = 0; i < YEAR.slots; i++) {
      const y = from + i * stride;
      const shown = y <= to && (i === 0 || span > 0);
      out[`show${i}`] = shown ? "inline" : "none";
      out[`label${i}`] = shown ? String(y) : "";
      out[`ly${i}`] = shown ? r1(yOf(y) + 4) : 0;
    }
    const y0 = yOf(from);
    const y1 = yOf(year);
    return {
      ...out,
      fill,
      rim,
      from,
      year,
      cursorFrom: `translate(0 ${y0})`,
      cursorTo: `translate(0 ${y1})`,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: (() => {
    const slots = Array.from({ length: YEAR.slots }, (_, i) => i);
    const { col, pillW, pillH, w, h } = YEAR;
    const left = col - pillW / 2;
    const right = col + pillW / 2;
    const pill = (s: number) => `translate(${col} 0) scale(${s})`;
    return {
      svg: `<svg viewBox="0 0 ${w} ${h}" font-family="${SANS}"><!-- {{from: int min=1 max=9999 default=2016 label='First year'}} {{to: int min=1 max=9999 default=2024 label='Last year'}} {{year: int min=1 max=9999 default=2020 label='Chosen year'}} {{values: text default='${YEAR_DEFAULT.join(",")}' label='Density, top to bottom (comma-separated)'}} {{grain: float min=0 max=1 default=0.7 step=0.05 label='Roughness'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{panel: color default=#16323A label='Pill'}} {{ink: color default=#D7E3E6 label='Text and trace'}} {{accent: color default=#5EC8C4 label='Accent'}} {{glow: float min=0 max=6 default=3 step=0.5 label='Glow'}} --><defs><filter id="yearScrubberGlow" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="yearScrubberTraceFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{ink}}" stop-opacity="0.04"/><stop offset="1" stop-color="{{ink}}" stop-opacity="0.2"/></linearGradient><linearGradient id="yearScrubberBandFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{accent}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{accent}}" stop-opacity="0.75"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient><linearGradient id="yearScrubberTail" gradientUnits="userSpaceOnUse" x1="${right}" y1="0" x2="${w}" y2="0"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.6"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></linearGradient><radialGradient id="yearScrubberVignette" cx="0.35" cy="0.5" r="0.8"><stop offset="0" stop-color="{{accent}}" stop-opacity="0.08"/><stop offset="1" stop-color="{{accent}}" stop-opacity="0"/></radialGradient><clipPath id="yearScrubberClip"><path d="{{fill}}"/></clipPath></defs><g opacity="{{backdropOpacity}}"><rect width="${w}" height="${h}" fill="{{background}}"/><rect width="${w}" height="${h}" fill="url(#yearScrubberVignette)"/></g><g id="yearScrubberTrace" transform="scale(0 1)"><path d="{{fill}}" fill="url(#yearScrubberTraceFill)"/><g clip-path="url(#yearScrubberClip)"><rect id="yearScrubberBand" x="0" y="-48" width="${YEAR.trace * 1.4}" height="96" fill="url(#yearScrubberBandFill)" transform="{{cursorFrom}}" opacity="0"/></g><path d="{{rim}}" fill="none" stroke="{{ink}}" stroke-opacity="0.55" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0 3.4"/></g>${slots
        .map((i) => `<text id="yearScrubberYear${i}" x="${col}" y="{{ly${i}}}" display="{{show${i}}}" text-anchor="middle" font-size="11" fill="{{ink}}" opacity="0">{{label${i}}}</text>`)
        .join("")}<g id="yearScrubberCursor" transform="{{cursorFrom}}"><path id="yearScrubberLine" d="M0 0 H${left - 4}" fill="none" stroke="{{accent}}" stroke-opacity="0.7" stroke-width="1"/><path id="yearScrubberTailLine" d="M${right + 4} 0 H${w}" fill="none" stroke="url(#yearScrubberTail)" stroke-width="1"/><g id="yearScrubberPill" transform="${pill(0.6)}" opacity="0"><rect id="yearScrubberRing" x="${-pillW / 2}" y="${-pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="{{accent}}" stroke-width="1.4" opacity="0"/><rect x="${-pillW / 2}" y="${-pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="{{panel}}"/><rect id="yearScrubberEdge" x="${-pillW / 2}" y="${-pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="{{accent}}" stroke-width="1.2" filter="url(#yearScrubberGlow)" opacity="0.5"/><text id="yearScrubberValue" y="5" text-anchor="middle" font-size="15" font-weight="600" fill="{{ink}}">{{from}}</text></g></g></svg>`,
      animate: [
        // The trace grows out of the left edge, the years fade in down the column.
        { id: "yearScrubberTrace", attrs: { transform: ["scale(0 1)", "scale(1 1)"] }, ms: YEAR.grow, ease: "out" },
        ...slots.map((i): SvgAnimation => ({ id: `yearScrubberYear${i}`, attrs: { opacity: [0, 0.5], transform: ["translate(6 0)", "translate(0 0)"] }, delay: 150 + i * 60, ms: 420, ease: "out" })),
        // The pill pops in on the first year, its line drawing out both ways.
        { id: "yearScrubberPill", attrs: { opacity: [0, 1], transform: [pill(0.6), pill(1)] }, delay: YEAR.pop, ms: 420, ease: { spring: { stiffness: 260, damping: 16 } } },
        { id: "yearScrubberLine", draw: true, delay: YEAR.pop, ms: 500, ease: "out" },
        { id: "yearScrubberTailLine", draw: true, delay: YEAR.pop + 100, ms: 500, ease: "out" },
        { id: "yearScrubberBand", attrs: { opacity: [0, 0.45] }, delay: YEAR.pop, ms: 400 },
        // It glides to the chosen year, counting, the band riding the trace with it.
        { id: "yearScrubberCursor", attrs: { transform: ["{{cursorFrom}}", "{{cursorTo}}"] }, delay: YEAR.glide, ms: YEAR.glideMs, ease: "in-out" },
        { id: "yearScrubberBand", attrs: { transform: ["{{cursorFrom}}", "{{cursorTo}}"] }, delay: YEAR.glide, ms: YEAR.glideMs, ease: "in-out" },
        { id: "yearScrubberValue", count: [n("from"), n("year")], decimals: 0, delay: YEAR.glide, ms: YEAR.glideMs, ease: "in-out" },
        // Arrived: the pill and band brighten and a ring pulses out twice.
        { id: "yearScrubberEdge", attrs: { opacity: [0.5, 1] }, delay: YEAR_ARRIVE, ms: 260, ease: "out" },
        { id: "yearScrubberBand", attrs: { opacity: [0.45, 0.95] }, delay: YEAR_ARRIVE, ms: 300, ease: "out" },
        ...[0, 1].map((k): SvgAnimation => ({ id: "yearScrubberRing", attrs: { opacity: [0.8, 0], transform: ["scale(1 1)", "scale(1.3 1.7)"] }, delay: YEAR_ARRIVE + k * 520, ms: 700, ease: "out" })),
      ],
    };
  })(),
};

// ── Sentiment tile ─────────────────────────────────────────────────────

/**
 * A 400×150 tile: the headline score and its change on the left, a mood chip
 * top right, and a dot-matrix histogram (up to `cols` columns of up to `rows`
 * dots, `pitch` apart, standing on `base` between `x0` and `x1`) bottom
 * right. The score's column lights up. Times are in ms.
 */
const SENTI = { cols: 24, rows: 8, pitch: 6, x0: 236, x1: 362, base: 116, card: { x: 16, y: 16, w: 368, h: 118, rx: 14 }, count: 300, countMs: 1200, rise: 500, riseStagger: 35, riseMs: 420 };
const SENTI_DEFAULT = [1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 8, 8, 7, 7, 6, 5, 5, 4, 3, 2, 2];

/** The mood a 0–100 score falls in: its name and which colour control paints it. */
export function sentimentMood(score: number): { name: string; color: "negative" | "neutral" | "positive" } {
  if (score < 35) return { name: "Negative", color: "negative" };
  if (score <= 65) return { name: "Moderate", color: "neutral" };
  return { name: "Positive", color: "positive" };
}

export const sentimentTile: VectorEffect = {
  kind: "vector",
  id: "sentiment-tile",
  name: "Sentiment tile",
  description:
    "A dashboard tile for a 0–100 score such as sentiment: the percentage counts up, a change badge slides in green or red by its sign, a mood chip (Negative, Moderate or Positive, picked from the score) pops in and tints the card, and a dot-matrix histogram rises column by column with the score's column lit.",
  category: "data",
  tags: ["kpi", "sentiment", "dashboard", "metric", "card", "histogram", "tech"],
  hold: 1800,
  presets: [
    { name: "Positive", values: { value: 78, delta: 6, values: "1,1,1,2,2,2,3,3,3,4,4,5,5,6,7,8,9,10,9,8,6,4" } },
    { name: "Negative", values: { value: 22, delta: -9, values: "3,5,7,9,10,9,8,7,6,5,4,4,3,3,2,2,2,1,1,1,1,1" } },
    { name: "Light", values: { background: [0.95, 0.96, 0.97], card: [1, 1, 1], ink: [0.1, 0.14, 0.2] } },
  ],
  derived: (v) => {
    const score = Math.max(0, Math.min(100, Number(v.value) || 0));
    const dec = Math.min(1, decimalsOf([score]));
    const suf = formatSafe(v.suffix);
    const shown = `${formatCount(score, { decimals: dec })}${suf}`;
    const big = fit(shown, 150, 42);
    const valueRight = 34 + textWidthEm(shown) * big.size;
    const delta = Number(v.delta) || 0;
    const up = delta >= 0;
    const deltaText = `${up ? "+" : "\u2212"}${formatCount(Math.abs(delta), { decimals: Math.min(1, decimalsOf([Math.abs(delta)])) })}%`;
    const deltaX = r1(valueRight + 10);
    const deltaW = textWidthEm(deltaText) * 11;
    const caption = fitLabel(v.caption, Math.max(20, SENTI.x0 - 10 - deltaX), 10, 7);
    const label = fitLabel(v.label, 200, 13, 9);
    const mood = sentimentMood(score);
    const asked = String(v.rating ?? "").trim();
    const chip = fitLabel(asked.toLowerCase() === "auto" ? mood.name : asked, 110, 10, 7);
    const chipW = r1(Math.max(28, chip.length + 18));
    const read = parseNumberList(v.values, SENTI.cols).filter((x) => Number.isFinite(x));
    const values = (read.length >= 2 ? read : SENTI_DEFAULT).map((x) => Math.max(0, x));
    const hi = Math.max(...values) || 1;
    const cols = values.length;
    const step = (SENTI.x1 - SENTI.x0) / Math.max(1, cols - 1);
    const lit = Math.round((score / 100) * (cols - 1));
    const out: Record<string, string | number> = {};
    for (let i = 0; i < SENTI.cols; i++) {
      const on = i < cols;
      const dots = on ? Math.max(1, Math.round((values[i]! / hi) * SENTI.rows)) : 1;
      const d = Math.abs(i - lit);
      out[`colShow${i}`] = on ? "inline" : "none";
      out[`colX${i}`] = on ? r1(SENTI.x0 + i * step) : 0;
      // A dash pattern of dots: the line reaches a little past the last dot so it shows.
      out[`colTop${i}`] = r1(SENTI.base - (dots - 1) * SENTI.pitch - 0.6);
      out[`colOpacity${i}`] = i === lit ? 1 : r2(0.22 + 0.38 * Math.exp(-(d * d) / 10));
    }
    return {
      ...out,
      value: +score.toFixed(dec),
      dec,
      format: `{n}${suf}`,
      size: big.size,
      deltaX,
      deltaText,
      deltaColor: paint(up ? v.positive : v.negative),
      arrowX: r1(deltaX + deltaW + 4),
      arrow: up ? "M0 6 L4 2 L7 5 L11 0 M7.5 0 H11 V3.5" : "M0 0 L4 4 L7 1 L11 6 M7.5 6 H11 V2.5",
      captionText: caption.text,
      captionSize: caption.size,
      captionLength: caption.length,
      labelText: label.text,
      labelSize: label.size,
      labelLength: label.length,
      chipText: chip.text,
      chipSize: chip.size,
      chipLength: chip.length,
      chipShow: chip.text ? "inline" : "none",
      chipX: r1(SENTI.card.x + SENTI.card.w - 18 - chipW),
      chipW,
      chipTextX: r1(SENTI.card.x + SENTI.card.w - 18 - chipW / 2),
      mood: paint(v[mood.color]),
      litX: out[`colX${lit}`]!,
      litTop: out[`colTop${lit}`]!,
      litAt: SENTI.rise + lit * SENTI.riseStagger + SENTI.riseMs,
      finale: SENTI.rise + (cols - 1) * SENTI.riseStagger + SENTI.riseMs + 200,
      finale2: SENTI.rise + (cols - 1) * SENTI.riseStagger + SENTI.riseMs + 460,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: (() => {
    const cols = Array.from({ length: SENTI.cols }, (_, i) => i);
    const { x, y, w, h, rx } = SENTI.card;
    const at = (name: string, i: number) => `{{${name}${i}}}` as unknown as number;
    const dotted = `stroke-linecap="round" stroke-dasharray="0 ${SENTI.pitch}"`;
    return {
      svg: `<svg viewBox="0 0 400 150" font-family="${SANS}"><!-- {{label: text default='Sentiment rate' label='Label'}} {{value: float min=0 max=100 default=45 step=1 label='Score (0 to 100)'}} {{suffix: text default='%' label='Suffix'}} {{delta: float min=-100 max=100 default=-4 step=0.5 label='Change (points)'}} {{caption: text default='Last month' label='Change caption'}} {{rating: text default='auto' label='Mood chip (auto picks from the score; empty hides it)'}} {{values: text default='${SENTI_DEFAULT.join(",")}' label='Histogram, low to high scores (comma-separated, up to 24)'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{card: color default=#13282E label='Card'}} {{ink: color default=#E3EEF0 label='Text and dots'}} {{negative: color default=#F0605E label='Negative'}} {{neutral: color default=#E3B05A label='Moderate'}} {{positive: color default=#4FD08B label='Positive'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs><filter id="sentimentTileGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="150"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="sentimentTileTint" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="{{mood}}" stop-opacity="0.32"/><stop offset="1" stop-color="{{mood}}" stop-opacity="0"/></radialGradient><linearGradient id="sentimentTileSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.06"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="150" fill="{{background}}"/></g><g id="sentimentTileCard" opacity="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="{{card}}"/><rect id="sentimentTileWash" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#sentimentTileTint)" opacity="0"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#sentimentTileSheen)" stroke="{{ink}}" stroke-opacity="0.1"/><rect id="sentimentTileRim" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="{{mood}}" stroke-width="1.2" opacity="0"/><text x="34" y="44" font-size="{{labelSize}}" textLength="{{labelLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="0.8">{{labelText}}</text><g id="sentimentTileChip" display="{{chipShow}}" opacity="0"><rect x="{{chipX}}" y="28" width="{{chipW}}" height="20" rx="5" fill="{{mood}}" fill-opacity="0.12" stroke="{{mood}}" stroke-opacity="0.8"/><text x="{{chipTextX}}" y="41.5" text-anchor="middle" font-size="{{chipSize}}" textLength="{{chipLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}">{{chipText}}</text></g><text id="sentimentTileValue" x="34" y="110" font-size="{{size}}" font-weight="400" fill="{{ink}}">0{{suffix}}</text><g id="sentimentTileDelta" opacity="0"><text x="{{deltaX}}" y="93" font-size="11" font-weight="600" fill="{{deltaColor}}">{{deltaText}}</text><path id="sentimentTileArrow" d="{{arrow}}" transform="translate({{arrowX}} 84)" fill="none" stroke="{{deltaColor}}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><text x="{{deltaX}}" y="108" font-size="{{captionSize}}" textLength="{{captionLength}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" opacity="0.5">{{captionText}}</text></g>${cols
        .map((i) => `<line id="sentimentTileCol${i}" display="{{colShow${i}}}" x1="{{colX${i}}}" y1="${SENTI.base}" x2="{{colX${i}}}" y2="${SENTI.base}" stroke="{{ink}}" stroke-opacity="{{colOpacity${i}}}" stroke-width="2.6" ${dotted}/>`)
        .join("")}<line id="sentimentTileLit" x1="{{litX}}" y1="${SENTI.base}" x2="{{litX}}" y2="{{litTop}}" stroke="{{mood}}" ${dotted} stroke-width="3.4" filter="url(#sentimentTileGlow)" opacity="0"/></g></svg>`,
      animate: [
        { id: "sentimentTileCard", attrs: { opacity: [0, 1], transform: ["translate(0 8)", "translate(0 0)"] }, ms: 450, ease: "out" },
        // The score counts up; the change slides in once it lands.
        { id: "sentimentTileValue", count: [0, n("value")], decimals: n("dec"), format: "{{format}}", delay: SENTI.count, ms: SENTI.countMs, ease: "out" },
        { id: "sentimentTileDelta", attrs: { opacity: [0, 1], transform: ["translate(-6 0)", "translate(0 0)"] }, delay: SENTI.count + SENTI.countMs - 200, ms: 400, ease: "out" },
        { id: "sentimentTileArrow", draw: true, delay: SENTI.count + SENTI.countMs - 100, ms: 400, ease: "in-out" },
        // The histogram rises column by column, dot by dot.
        ...cols.map((i): SvgAnimation => ({ id: `sentimentTileCol${i}`, attrs: { y2: [SENTI.base, at("colTop", i)] }, delay: SENTI.rise + i * SENTI.riseStagger, ms: SENTI.riseMs, ease: "out" })),
        // The score's column lights in the mood colour; the chip pops in and tints the card.
        { id: "sentimentTileLit", attrs: { opacity: [0, 1] }, delay: n("litAt"), ms: 300, ease: "out" },
        { id: "sentimentTileChip", attrs: { opacity: [0, 1], transform: ["translate(0 -4)", "translate(0 0)"] }, delay: n("finale"), ms: 380, ease: { spring: { stiffness: 260, damping: 18 } } },
        { id: "sentimentTileWash", attrs: { opacity: [0, 1] }, delay: n("finale"), ms: 700, ease: "out" },
        { id: "sentimentTileRim", attrs: { opacity: [0, 0.7] }, delay: n("finale"), ms: 260, ease: "out" },
        { id: "sentimentTileRim", attrs: { opacity: [0.7, 0.25] }, delay: n("finale2"), ms: 900, ease: "in-out" },
        { id: "sentimentTileLit", attrs: { opacity: [1, 0.55] }, delay: n("finale"), ms: 450, ease: "in-out", repeat: 3, alternate: true },
      ],
    };
  })(),
};

// ── Branch menu ────────────────────────────────────────────────────────

/**
 * A 400×260 frame: an orb at `orb` on the left, and up to `slots` tiles
 * stacked at `tile.x` and centred on the orb's height, each reached by a
 * curve. A spark runs out along each curve in turn, `stagger` apart from
 * `start`; its tile flashes as it lands and settles, and the chosen one ends
 * outlined. Times are in ms.
 */
const BRANCH = { slots: 6, orb: { x: 76, y: 130, r: 18 }, tile: { x: 214, w: 150, room: 224, gap: 8, rx: 8 }, start: 450, stagger: 230, run: 480 };
const BRANCH_VALUES = ["18", "3", "24", "32", "12"];
const BRANCH_LABELS = ["Services", "Entities", "Related laws", "KPIs", "Regulations"];

export const branchMenu: VectorEffect = {
  kind: "vector",
  id: "branch-menu",
  name: "Branch menu",
  description:
    "A glowing orb reaching out to a stack of category tiles: curves draw out one after another with a spark running along each, every tile flashing bright as its spark lands and settling as its count ticks up, then the chosen one lights up in gold with its curve.",
  category: "data",
  tags: ["menu", "branch", "node-graph", "card", "dashboard", "counter", "tech", "explainer"],
  hold: 1600,
  presets: [
    { name: "Light", values: { background: [0.94, 0.96, 0.97], tile: [1, 1, 1], ink: [0.1, 0.14, 0.2], flash: [0.1, 0.65, 0.72], chosenColor: [0.85, 0.6, 0.15] } },
    { name: "Three", values: { values: "128,42,7", labels: "Customers,Open deals,At risk", chosen: 3, chosenColor: [0.94, 0.38, 0.37] } },
    { name: "None chosen", values: { chosen: 0 } },
  ],
  derived: (v) => {
    const given = parseLabels(v.values, BRANCH.slots);
    const tokens = given.some((x) => x !== "") ? given : BRANCH_VALUES;
    const labels = parseLabels(v.labels, BRANCH.slots);
    const count = Math.max(1, Math.min(BRANCH.slots, tokens.length));
    const chosen = Math.max(0, Math.min(count, Math.round(Number(v.chosen)) || 0));
    const { orb, tile } = BRANCH;
    const h = Math.min(36, (tile.room - (count - 1) * tile.gap) / count);
    const top = orb.y - (count * h + (count - 1) * tile.gap) / 2;
    const out: Record<string, string | number> = {};
    for (let i = 0; i < BRANCH.slots; i++) {
      const shown = i < count;
      const y = r1(top + i * (h + tile.gap));
      const cy = r1(y + h / 2);
      const stat = parseStat(String(tokens[i] ?? ""));
      const numeric = Number.isFinite(stat.value);
      const pre = formatSafe(stat.pre);
      const suf = formatSafe(stat.suf);
      const label = fitLabel(labels[i] ?? "", tile.w - 40, Math.min(8.5, h * 0.26), 6);
      const big = fit(numeric ? `${pre}${formatCount(stat.value, { decimals: stat.dec })}${suf}` : formatSafe(tokens[i]), tile.w - 46, Math.min(15, h * 0.44));
      const sx = orb.x + orb.r + 4;
      const mid = r1((sx + tile.x) / 2);
      out[`show${i}`] = shown ? "inline" : "none";
      out[`y${i}`] = y;
      out[`h${i}`] = r1(h);
      out[`link${i}`] = `M${sx} ${orb.y} C${mid} ${orb.y} ${mid} ${cy} ${tile.x} ${cy}`;
      out[`iconY${i}`] = r1(cy - (h > 26 ? 5 : 0));
      out[`valueY${i}`] = r1(h > 26 ? cy - 1 : cy + big.size * 0.36);
      out[`labelY${i}`] = r1(cy + label.size + 3);
      out[`labelShow${i}`] = h > 26 ? "inline" : "none";
      out[`size${i}`] = big.size;
      out[`val${i}`] = numeric ? stat.value : 0;
      out[`dec${i}`] = numeric ? stat.dec : 0;
      out[`fmt${i}`] = numeric ? `${pre}{n}${suf}` : formatSafe(tokens[i]);
      out[`label${i}`] = label.text;
      out[`labelSize${i}`] = label.size;
      out[`labelLength${i}`] = label.length;
      out[`gold${i}`] = i === chosen - 1 ? 1 : 0;
    }
    const allIn = BRANCH.start + (count - 1) * BRANCH.stagger + BRANCH.run + 500;
    return {
      ...out,
      chosenShow: chosen ? "inline" : "none",
      chosenLink: chosen ? out[`link${chosen - 1}`]! : "M0 0",
      chosenY: chosen ? out[`y${chosen - 1}`]! : 0,
      chosenH: chosen ? out[`h${chosen - 1}`]! : 0,
      chosenAt: allIn,
      chosenPulse: allIn + 600,
      backdropOpacity: v.backdrop ? 1 : 0,
    };
  },
  motion: (() => {
    const slots = Array.from({ length: BRANCH.slots }, (_, i) => i);
    const { orb, tile } = BRANCH;
    const at = (name: string, i: number) => `{{${name}${i}}}` as unknown as number;
    const launch = (i: number) => BRANCH.start + i * BRANCH.stagger;
    const land = (i: number) => launch(i) + BRANCH.run;
    const glow = (id: string) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{{glow}}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    return {
      svg: `<svg viewBox="0 0 400 260" font-family="${SANS}"><!-- {{values: text default='${BRANCH_VALUES.join(",")}' label='Values (comma-separated, up to 6; prefixes and suffixes kept)'}} {{labels: text default='${BRANCH_LABELS.join(",")}' label='Labels (comma-separated)'}} {{chosen: int min=0 max=6 default=3 label='Chosen tile (0: none)'}} {{background: color default=#0B1A1E label='Background'}} {{backdrop: bool default=true label='Background'}} {{tile: color default=#13282E label='Tiles'}} {{ink: color default=#E3EEF0 label='Text and curves'}} {{flash: color default=#3FD6E0 label='Flash'}} {{chosenColor: color default=#E8C27A label='Chosen'}} {{orbColor: color default=#9C7CF5 label='Orb'}} {{glow: float min=0 max=6 default=2.5 step=0.5 label='Glow'}} --><defs>${glow("branchMenuGlow")}<radialGradient id="branchMenuOrbFill" cx="0.38" cy="0.35" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.35" stop-color="{{orbColor}}"/><stop offset="1" stop-color="{{orbColor}}" stop-opacity="0.55"/></radialGradient><radialGradient id="branchMenuHaze" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{{orbColor}}" stop-opacity="0.35"/><stop offset="1" stop-color="{{orbColor}}" stop-opacity="0"/></radialGradient><linearGradient id="branchMenuFlashFill" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="{{flash}}" stop-opacity="0.25"/><stop offset="1" stop-color="{{flash}}" stop-opacity="0.95"/></linearGradient><linearGradient id="branchMenuGoldFill" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="{{chosenColor}}" stop-opacity="0.08"/><stop offset="1" stop-color="{{chosenColor}}" stop-opacity="0.32"/></linearGradient></defs><g opacity="{{backdropOpacity}}"><rect width="400" height="260" fill="{{background}}"/><rect x="${orb.x - 90}" y="${orb.y - 90}" width="180" height="180" fill="url(#branchMenuHaze)"/></g>${slots
        .map((i) => `<path id="branchMenuLink${i}" display="{{show${i}}}" d="{{link${i}}}" fill="none" stroke="{{ink}}" stroke-opacity="0.35" stroke-width="1"/>`)
        .join("")}<g display="{{chosenShow}}"><path id="branchMenuChosenLink" d="{{chosenLink}}" fill="none" stroke="{{chosenColor}}" stroke-width="1.6" filter="url(#branchMenuGlow)" opacity="0"/></g><g id="branchMenuOrb" opacity="0"><circle cx="${orb.x}" cy="${orb.y}" r="${orb.r + 9}" fill="none" stroke="{{orbColor}}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="1.5 2.5"/><circle id="branchMenuOrbRing" cx="${orb.x}" cy="${orb.y}" r="${orb.r + 4}" fill="none" stroke="{{orbColor}}" stroke-opacity="0.6" stroke-width="1.2"/><circle cx="${orb.x}" cy="${orb.y}" r="${orb.r}" fill="url(#branchMenuOrbFill)" filter="url(#branchMenuGlow)"/></g>${slots
        .map(
          (i) =>
            `<g id="branchMenuTile${i}" display="{{show${i}}}" opacity="0"><rect x="${tile.x}" y="{{y${i}}}" width="${tile.w}" height="{{h${i}}}" rx="${tile.rx}" fill="{{tile}}" stroke="{{ink}}" stroke-opacity="0.14"/><rect id="branchMenuFlash${i}" x="${tile.x}" y="{{y${i}}}" width="${tile.w}" height="{{h${i}}}" rx="${tile.rx}" fill="url(#branchMenuFlashFill)" opacity="0"/><rect id="branchMenuGold${i}" x="${tile.x}" y="{{y${i}}}" width="${tile.w}" height="{{h${i}}}" rx="${tile.rx}" fill="url(#branchMenuGoldFill)" stroke="{{chosenColor}}" stroke-width="1.6" filter="url(#branchMenuGlow)" opacity="0"/><rect x="${tile.x + 10}" y="{{iconY${i}}}" width="9" height="9" rx="2" transform="translate(0 -4.5)" fill="none" stroke="{{ink}}" stroke-opacity="0.85" stroke-width="1.2"/><text id="branchMenuValue${i}" x="${tile.x + 26}" y="{{valueY${i}}}" font-size="{{size${i}}}" font-weight="500" fill="{{ink}}">{{fmt${i}}}</text><text display="{{labelShow${i}}}" x="${tile.x + 10}" y="{{labelY${i}}}" font-size="{{labelSize${i}}}" textLength="{{labelLength${i}}}" lengthAdjust="spacingAndGlyphs" fill="{{ink}}" fill-opacity="0.7">{{label${i}}}</text></g>`,
        )
        .join("")}${slots
        .map((i) => `<g id="branchMenuSpark${i}" display="{{show${i}}}" opacity="0"><circle r="5" fill="{{flash}}" opacity="0.35" filter="url(#branchMenuGlow)"/><circle r="2.2" fill="#FFFFFF"/></g>`)
        .join("")}</svg>`,
      animate: [
        { id: "branchMenuOrb", attrs: { opacity: [0, 1], transform: ["translate(-10 0)", "translate(0 0)"] }, ms: 420, ease: "out" },
        { id: "branchMenuOrbRing", attrs: { "stroke-opacity": [0.6, 0.15] }, delay: 450, ms: 900, ease: "in-out", repeat: 3, alternate: true },
        ...slots.flatMap((i): SvgAnimation[] => [
          // A curve draws out with a spark at its tip...
          { id: `branchMenuLink${i}`, draw: true, delay: launch(i), ms: BRANCH.run, ease: "in-out" },
          { id: `branchMenuSpark${i}`, attrs: { opacity: [0, 1] }, delay: launch(i), ms: 120 },
          { id: `branchMenuSpark${i}`, along: `branchMenuLink${i}`, delay: launch(i), ms: BRANCH.run, ease: "in-out" },
          { id: `branchMenuSpark${i}`, attrs: { opacity: [1, 0] }, delay: land(i), ms: 260, ease: "out" },
          // ...and its tile lands with a bright flash that settles as the count ticks up.
          { id: `branchMenuTile${i}`, attrs: { opacity: [0, 1], transform: ["translate(-10 0)", "translate(0 0)"] }, delay: land(i) - 80, ms: 320, ease: "out" },
          { id: `branchMenuFlash${i}`, attrs: { opacity: [0, 1] }, delay: land(i) - 40, ms: 160, ease: "out" },
          { id: `branchMenuFlash${i}`, attrs: { opacity: [1, 0] }, delay: land(i) + 260, ms: 700, ease: "in-out" },
          { id: `branchMenuValue${i}`, count: [0, at("val", i)], decimals: at("dec", i), format: `{{fmt${i}}}`, delay: land(i), ms: 800, ease: "out" },
          // The chosen one lights up in gold, with its curve.
          { id: `branchMenuGold${i}`, attrs: { opacity: [0, at("gold", i)] }, delay: n("chosenAt"), ms: 450, ease: "out" },
        ]),
        { id: "branchMenuChosenLink", attrs: { opacity: [0, 1] }, delay: n("chosenAt"), ms: 1 },
        { id: "branchMenuChosenLink", draw: true, delay: n("chosenAt"), ms: 500, ease: "in-out" },
        { id: "branchMenuChosenLink", attrs: { opacity: [1, 0.5] }, delay: n("chosenPulse"), ms: 600, ease: "in-out", repeat: 3, alternate: true },
      ],
    };
  })(),
};

export const dataEffects: VectorEffect[] = [donutChart, pieChart, gauge, barRace, sparkline, leaderboard, areaChart, kpiTile, rolodex, fanOutLinks, hubSpokeGraph, statCards, yearScrubber, sentimentTile, branchMenu];
