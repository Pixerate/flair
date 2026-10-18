/** Checking a primitive's parameters, and suggestions for names that are nearly right. */

import type { PrimitiveDescriptor, PrimitiveParam, PrimitiveParamValue } from "./types.js";

/** Edits (insert, delete, change, swap two neighbours) between two words, ignoring case. */
function distance(a: string, b: string): number {
  const [s, t] = [a.toLowerCase(), b.toLowerCase()];
  const d = Array.from({ length: s.length + 1 }, (_, i) => Array.from({ length: t.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= s.length; i++)
    for (let j = 1; j <= t.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (s[i - 1] === t[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[s.length]![t.length]!;
}

/**
 * The options closest to `word` (by edits, or containing it, or it them),
 * best first, at most `limit`; none when nothing is close.
 */
export function closest(word: string, options: readonly string[], limit = 3): string[] {
  const w = word.toLowerCase();
  const scored = options
    .map((o) => {
      const tail = o.toLowerCase().split(/[.@-]/).pop()!;
      const d = Math.min(distance(w, o), distance(w, tail));
      const contains = o.toLowerCase().includes(w) || (w.length > 2 && w.includes(tail));
      return { o, d: contains ? Math.min(d, 1) : d };
    })
    .filter(({ o, d }) => d <= Math.max(2, Math.floor(Math.min(w.length, o.length) / 3)))
    .sort((x, y) => x.d - y.d);
  return scored.slice(0, limit).map((s) => s.o);
}

/** " Did you mean "a" or "b"?" for the closest options, or "". */
export function didYouMean(word: string, options: readonly string[]): string {
  const near = closest(word, options);
  if (!near.length) return "";
  return ` Did you mean ${near.map((o) => `"${o}"`).join(" or ")}?`;
}

/** `text` ending as a sentence does (with a full stop unless it has one, or a question mark). */
export const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Why `value` does not suit `param`, or undefined when it does. */
function paramProblem(param: PrimitiveParam, value: unknown): string | undefined {
  const name = `\`${param.name}\``;
  switch (param.type) {
    case "float":
    case "int": {
      const range = param.min !== undefined && param.max !== undefined ? ` from ${param.min} to ${param.max}` : param.min !== undefined ? `, ${param.min} or more` : "";
      const what = param.type === "int" ? "a whole number" : "a number";
      if (typeof value !== "number" || !Number.isFinite(value) || (param.type === "int" && !Number.isInteger(value)))
        return `${name} is ${what}${range}; it was given ${JSON.stringify(value)}`;
      if ((param.min !== undefined && value < param.min) || (param.max !== undefined && value > param.max))
        return `${name} is ${what}${range}; ${value} is out of range`;
      return undefined;
    }
    case "bool":
      return typeof value === "boolean" ? undefined : `${name} is true or false; it was given ${JSON.stringify(value)}`;
    case "color":
      return typeof value === "string" && HEX.test(value.trim()) ? undefined : `${name} is a colour written #rrggbb; it was given ${JSON.stringify(value)}`;
    case "text":
      return typeof value === "string" ? undefined : `${name} is text; it was given ${JSON.stringify(value)}`;
    case "enum":
      return typeof value === "string" && param.options!.includes(value)
        ? undefined
        : `${name} is one of ${param.options!.map((o) => `"${o}"`).join(", ")}; it was given ${JSON.stringify(value)}.${typeof value === "string" ? didYouMean(value, param.options!) : ""}`;
  }
}

/**
 * A primitive's parameters with defaults filled in, or the problems with
 * the ones given (unknown names, wrong types, out of range), as sentences.
 */
export function resolveParams(
  descriptor: PrimitiveDescriptor,
  params: unknown,
): { ok: true; values: Record<string, PrimitiveParamValue> } | { ok: false; problems: string[] } {
  if (params !== undefined && (params === null || typeof params !== "object" || Array.isArray(params)))
    return { ok: false, problems: ["`params` is an object of parameter values by name"] };
  const given = (params ?? {}) as Record<string, unknown>;
  const names = descriptor.params.map((p) => p.name);
  const problems: string[] = [];
  for (const key of Object.keys(given)) {
    if (given[key] === undefined || names.includes(key)) continue;
    problems.push(
      names.length
        ? `${descriptor.id} has no parameter "${key}"; it takes ${names.map((n) => `"${n}"`).join(", ")}.${didYouMean(key, names)}`
        : `${descriptor.id} takes no parameters; leave out "${key}"`,
    );
  }
  const values: Record<string, PrimitiveParamValue> = {};
  for (const param of descriptor.params) {
    const value = given[param.name];
    if (value === undefined) {
      values[param.name] = param.default;
      continue;
    }
    const problem = paramProblem(param, value);
    if (problem) problems.push(problem);
    else values[param.name] = param.type === "color" ? (value as string).trim().toLowerCase() : (value as PrimitiveParamValue);
  }
  return problems.length ? { ok: false, problems } : { ok: true, values };
}
