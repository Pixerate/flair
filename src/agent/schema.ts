/**
 * A small JSON Schema checker for the subset the agent tool definitions use
 * (`type`, `properties`, `required`, `additionalProperties: false`, `enum`,
 * `minimum`, `items`). Its messages are sentences an agent can act on.
 */

type Schema = Record<string, any>;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function described(type: string): string {
  if (type === 'integer') return 'a whole number';
  if (type === 'null') return 'null';
  return `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`;
}

function fits(value: unknown, type: string): boolean {
  const actual = typeOf(value);
  return actual === type || (type === 'number' && actual === 'integer');
}

/** The problems with `value` against `schema`, each naming where it is (`at` is the path so far). */
export function checkSchema(schema: Schema, value: unknown, at = 'arguments'): string[] {
  const problems: string[] = [];
  if (schema.type !== undefined) {
    const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => fits(value, t))) {
      const actual = typeOf(value) === 'integer' ? 'number' : typeOf(value);
      problems.push(`${at} must be ${types.map(described).join(' or ')}, not ${described(actual)}.`);
      return problems;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${at} must be one of ${schema.enum.map((v: unknown) => JSON.stringify(v)).join(', ')}.`);
  }
  if (typeof value === 'number' && typeof schema.minimum === 'number' && value < schema.minimum) {
    problems.push(`${at} must be at least ${schema.minimum}.`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => problems.push(...checkSchema(schema.items, item, `${at}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>;
    const props: Record<string, Schema> = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (obj[name] === undefined) problems.push(`${at}.${name} is required.`);
    }
    for (const [name, v] of Object.entries(obj)) {
      if (props[name]) problems.push(...checkSchema(props[name]!, v, `${at}.${name}`));
      else if (schema.additionalProperties === false) {
        const known = Object.keys(props);
        problems.push(`${at}.${name} is not a parameter${known.length ? `; expected ${known.map((k) => `"${k}"`).join(', ')}` : ''}.`);
      }
    }
  }
  return problems;
}
