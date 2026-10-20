/**
 * Reading and changing an SVG's markup as text, with no DOM: elements with
 * where they sit in the string, so a primitive can wrap one element and
 * leave every other character as it was written.
 */

/** An element of the markup and where it sits in the string. */
export interface MarkupElement {
  tag: string;
  attrs: Record<string, string>;
  /** Where its opening tag starts. */
  start: number;
  /** Just after its opening tag. */
  openEnd: number;
  /** Where its closing tag starts (`openEnd` when it closes itself). */
  closeStart: number;
  /** Just after it ends. */
  end: number;
  parent?: MarkupElement;
  children: MarkupElement[];
}

const TOKEN = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<[!?][^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]!);

/** Escaped for a double-quoted attribute value. */
export const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** The elements of `svg`: the root (the first element) and every element with an id (the first of each). */
export function scanMarkup(svg: string): { root: MarkupElement | undefined; byId: Map<string, MarkupElement> } {
  const top: MarkupElement = { tag: "", attrs: {}, start: 0, openEnd: 0, closeStart: svg.length, end: svg.length, children: [] };
  const stack = [top];
  const byId = new Map<string, MarkupElement>();
  for (const m of svg.matchAll(TOKEN)) {
    const [whole, close, open, attrs = "", selfClosing] = m;
    if (close) {
      const tag = close.toLowerCase();
      let i = stack.length - 1;
      while (i > 0 && stack[i]!.tag.toLowerCase() !== tag) i--;
      if (i === 0) continue;
      // Anything left open inside it ends where it does.
      for (let j = stack.length - 1; j >= i; j--) {
        stack[j]!.closeStart = m.index;
        stack[j]!.end = m.index + whole.length;
      }
      stack.length = i;
    } else if (open) {
      const el: MarkupElement = { tag: open, attrs: {}, start: m.index, openEnd: m.index + whole.length, closeStart: m.index + whole.length, end: m.index + whole.length, parent: stack[stack.length - 1], children: [] };
      for (const a of attrs.matchAll(ATTR)) el.attrs[a[1]!] = decode(a[2] ?? a[3] ?? a[4] ?? "");
      el.parent!.children.push(el);
      if (el.attrs.id !== undefined && !byId.has(el.attrs.id)) byId.set(el.attrs.id, el);
      if (!selfClosing) stack.push(el);
    }
  }
  const root = top.children[0];
  if (root) root.parent = undefined;
  return { root, byId };
}

/** Its ancestors, nearest first, up to (and with) the root. */
export function ancestorsOf(el: MarkupElement): MarkupElement[] {
  const out: MarkupElement[] = [];
  for (let p = el.parent; p; p = p.parent) out.push(p);
  return out;
}

/** The first element of `svg` (outermost first) marked with this primitive tag (`data-flair-tag`). */
function tagged(svg: string, tag: string): MarkupElement | undefined {
  const { root } = scanMarkup(svg);
  const find = (el: MarkupElement): MarkupElement | undefined => {
    if (el.attrs["data-flair-tag"] === tag) return el;
    for (const c of el.children) {
      const hit = find(c);
      if (hit) return hit;
    }
    return undefined;
  };
  return root && find(root);
}

/**
 * `svg` without what a primitive tagged `tag` added: its clip paths (and
 * anything else it added inside a `<defs>`) go, and its wrapper groups are
 * replaced by what they hold. Returns how many elements went.
 */
/** Tagged elements that wrap what was there before, so removing them keeps their contents. */
const UNWRAPPED = new Set(["g", "textpath", "tspan"]);

export function removeTagged(svg: string, tag: string): { svg: string; removed: number } {
  let removed = 0;
  for (let el = tagged(svg, tag); el; el = tagged(svg, tag)) {
    removed++;
    const tagName = el.tag.toLowerCase();
    // Wrappers (groups round an element, a text path round its words) give back what they hold; anything else (defs) goes.
    svg = UNWRAPPED.has(tagName) ? svg.slice(0, el.start) + svg.slice(el.openEnd, el.closeStart) + svg.slice(el.end) : svg.slice(0, el.start) + svg.slice(el.end);
  }
  return { svg, removed };
}

/** Every id in `svg`'s markup. */
export function markupIds(svg: string): Set<string> {
  return new Set([...svg.matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => decode(m[1] ?? m[2] ?? "")));
}
