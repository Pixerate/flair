/**
 * Shape morphing: any SVG paths turned into paths with the same structure, so
 * an `attrs` change on `d` (see `SvgAnimation`) blends one into the other
 * point by point. Pure functions of their arguments, with no DOM.
 */

type Point = [number, number];

/** One piece of a path: its outline as points, and whether it closes. */
interface Ring {
  points: Point[];
  closed: boolean;
}

export interface MorphOptions {
  /** Points per piece of the shape (default 72): more follows curves more closely. */
  points?: number;
  /** Decimals in the numbers written (default 2). */
  decimals?: number;
}

/** Segments a curve is split into before resampling. */
const CURVE_STEPS = 24;

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Arguments each command takes (repeated commands take them again). */
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/**
 * The pieces of a path's `d` as outlines: lines kept, curves and arcs split
 * into short lines. Throws on a command it does not know.
 */
function flatten(d: string): Ring[] {
  const stray = d.replace(TOKEN, "").replace(/[\s,]+/g, "");
  if (stray) throw new Error(`"${stray[0]}" is not a path command`);
  const tokens = d.match(TOKEN) ?? [];
  const rings: Ring[] = [];
  // Typed by a cast: the helpers below assign it, which narrowing would miss.
  let ring = null as Ring | null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // The last control point, for S and T.
  let cx = 0;
  let cy = 0;
  let prev = "";
  let i = 0;
  let command = "";
  const add = (px: number, py: number) => ring!.points.push([px, py]);
  const begin = (px: number, py: number) => {
    if (ring && ring.points.length) rings.push(ring);
    ring = { points: [[px, py]], closed: false };
  };
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i]!)) command = tokens[i++]!;
    else if (!command) throw new Error(`"${tokens[i]}" needs a command (M, L, C, …) before it`);
    const lower = command.toLowerCase();
    if (!(lower in ARGS)) throw new Error(`Unknown path command "${command}"`);
    const rel = command !== command.toUpperCase();
    const n = ARGS[lower]!;
    const args = tokens.slice(i, i + n).map(Number);
    if (args.length < n || args.some((v) => Number.isNaN(v))) break;
    i += n;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (lower === "z") {
      if (ring) {
        ring.closed = true;
        rings.push(ring);
        ring = null;
      }
      x = startX;
      y = startY;
      prev = "z";
      // A Z takes no arguments: wait for the next command.
      command = "";
      continue;
    }
    if (!ring) begin(x, y);
    switch (lower) {
      case "m":
        x = ox + args[0]!;
        y = oy + args[1]!;
        startX = x;
        startY = y;
        begin(x, y);
        // Pairs after a moveto are linetos.
        command = rel ? "l" : "L";
        break;
      case "l":
        x = ox + args[0]!;
        y = oy + args[1]!;
        add(x, y);
        break;
      case "h":
        x = ox + args[0]!;
        add(x, y);
        break;
      case "v":
        y = (rel ? y : 0) + args[0]!;
        add(x, y);
        break;
      case "c":
      case "s": {
        let x1: number;
        let y1: number;
        let rest: number[];
        if (lower === "c") {
          x1 = ox + args[0]!;
          y1 = oy + args[1]!;
          rest = args.slice(2);
        } else {
          const smooth = prev === "c" || prev === "s";
          x1 = smooth ? 2 * x - cx : x;
          y1 = smooth ? 2 * y - cy : y;
          rest = args;
        }
        const x2 = ox + rest[0]!;
        const y2 = oy + rest[1]!;
        const ex = ox + rest[2]!;
        const ey = oy + rest[3]!;
        for (let k = 1; k <= CURVE_STEPS; k++) {
          const t = k / CURVE_STEPS;
          const u = 1 - t;
          add(
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey,
          );
        }
        cx = x2;
        cy = y2;
        x = ex;
        y = ey;
        break;
      }
      case "q":
      case "t": {
        let x1: number;
        let y1: number;
        let ex: number;
        let ey: number;
        if (lower === "q") {
          x1 = ox + args[0]!;
          y1 = oy + args[1]!;
          ex = ox + args[2]!;
          ey = oy + args[3]!;
        } else {
          const smooth = prev === "q" || prev === "t";
          x1 = smooth ? 2 * x - cx : x;
          y1 = smooth ? 2 * y - cy : y;
          ex = ox + args[0]!;
          ey = oy + args[1]!;
        }
        for (let k = 1; k <= CURVE_STEPS; k++) {
          const t = k / CURVE_STEPS;
          const u = 1 - t;
          add(u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey);
        }
        cx = x1;
        cy = y1;
        x = ex;
        y = ey;
        break;
      }
      case "a": {
        const ex = ox + args[5]!;
        const ey = oy + args[6]!;
        for (const p of arcPoints(x, y, args[0]!, args[1]!, args[2]!, args[3]! !== 0, args[4]! !== 0, ex, ey)) add(p[0], p[1]);
        x = ex;
        y = ey;
        break;
      }
    }
    prev = lower;
  }
  if (ring && ring.points.length) rings.push(ring);
  return rings
    .map((r) => {
      // A ring that ends where it starts is closed, Z or not.
      const [a, b] = [r.points[0]!, r.points[r.points.length - 1]!];
      const closes = r.points.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
      return { points: closes ? r.points.slice(0, -1) : r.points, closed: r.closed || closes };
    })
    .filter((r) => r.points.length > 1);
}

/** Points along an SVG arc (endpoint form), not including its start. */
function arcPoints(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angle: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): Point[] {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  // Radii too small to reach are scaled up, as SVG says.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * y1p) / ry;
  const cyp = (-k * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const theta = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = theta(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = theta((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const steps = Math.max(2, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * (CURVE_STEPS / 2)));
  const out: Point[] = [];
  for (let s = 1; s <= steps; s++) {
    const t = start + (delta * s) / steps;
    const px = rx * Math.cos(t);
    const py = ry * Math.sin(t);
    out.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
}

/**
 * `n` points evenly spaced along a ring. A closed ring goes round once; an
 * open one (a stroke) is resampled as closed by going there and back, so it
 * can turn into a closed shape.
 */
function resample(ring: Ring, n: number): Point[] {
  const pts = ring.closed ? [...ring.points, ring.points[0]!] : [...ring.points, ...ring.points.slice(0, -1).reverse()];
  const lengths = [0];
  for (let i = 1; i < pts.length; i++)
    lengths.push(lengths[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = lengths[lengths.length - 1]!;
  if (total === 0) return Array.from({ length: n }, () => [pts[0]![0], pts[0]![1]] as Point);
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const at = (k / n) * total;
    while (j < lengths.length - 1 && lengths[j]! < at) j++;
    const seg = lengths[j]! - lengths[j - 1]!;
    const t = seg > 0 ? (at - lengths[j - 1]!) / seg : 0;
    const a = pts[j - 1]!;
    const b = pts[j]!;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const signedArea = (pts: Point[]) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

const centroid = (pts: Point[]): Point => {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
};

/** How big a piece is: its area, or for a stroke its length times a little. */
function size(ring: Ring, pts: Point[]): number {
  const area = Math.abs(signedArea(pts));
  if (ring.closed && area > 0) return area;
  let length = 0;
  for (let i = 1; i < ring.points.length; i++)
    length += Math.hypot(ring.points[i]![0] - ring.points[i - 1]![0], ring.points[i]![1] - ring.points[i - 1]![1]);
  return length;
}

interface Piece {
  pts: Point[];
  centre: Point;
  size: number;
}

/**
 * Pairs the pieces of one shape with the slots of the shape before it,
 * nearest and most alike first: a slot left over is empty (a piece that
 * shrinks away), and a piece left over takes an empty slot (it grows).
 */
function assign(before: (Piece | null)[], pieces: Piece[], scale: number): (Piece | null)[] {
  const out: (Piece | null)[] = before.map(() => null);
  const pairs: { slot: number; piece: number; cost: number }[] = [];
  before.forEach((slot, s) => {
    if (!slot) return;
    pieces.forEach((p, i) => {
      const distance = Math.hypot(slot.centre[0] - p.centre[0], slot.centre[1] - p.centre[1]) / scale;
      const likeness = Math.abs(Math.log((slot.size + 1e-9) / (p.size + 1e-9)));
      pairs.push({ slot: s, piece: i, cost: distance + 0.5 * likeness });
    });
  });
  pairs.sort((a, b) => a.cost - b.cost);
  const used = new Set<number>();
  for (const { slot, piece } of pairs) {
    if (out[slot] || used.has(piece)) continue;
    out[slot] = pieces[piece]!;
    used.add(piece);
  }
  let free = 0;
  pieces.forEach((p, i) => {
    if (used.has(i)) return;
    while (out[free] || before[free]) free++;
    out[free] = p;
  });
  return out;
}

/** `pts` turned and started so it lines up with `ref` point by point (the shortest moves). */
function align(ref: Point[], pts: Point[]): Point[] {
  const n = pts.length;
  let best = pts;
  let bestCost = Infinity;
  for (const candidate of [pts, [...pts].reverse()]) {
    for (let shift = 0; shift < n; shift++) {
      let cost = 0;
      for (let k = 0; k < n && cost < bestCost; k++) {
        const a = ref[k]!;
        const b = candidate[(k + shift) % n]!;
        cost += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = candidate.slice(shift).concat(candidate.slice(0, shift));
      }
    }
  }
  return best;
}

/**
 * Paths with one structure for a sequence of shapes, so each blends into the
 * next (and the last into the first) with `attrs: { d: [a, b] }`. Any path
 * commands work, curves and arcs included, and shapes can have different
 * numbers of pieces (an icon's parts, a letter's holes): pieces are paired by
 * position and size, and one without a partner grows from or shrinks to a
 * point. Draw the results with `fill-rule="evenodd"`, since a piece's
 * direction can change. Throws a sentence when a path cannot be read.
 */
export function morphSequence(paths: readonly string[], options: MorphOptions = {}): string[] {
  const n = Math.max(8, Math.round(options.points ?? 72));
  const decimals = options.decimals ?? 2;
  const shapes = paths.map((d, i) => {
    let rings: Ring[];
    try {
      rings = flatten(d);
    } catch (e) {
      throw new Error(`Path ${i + 1} cannot be read: ${(e as Error).message}`);
    }
    if (!rings.length) throw new Error(`Path ${i + 1} draws nothing: give it at least two points`);
    return rings.map((r): Piece => {
      const pts = resample(r, n);
      return { pts, centre: centroid(pts), size: size(r, pts) };
    });
  });
  if (!shapes.length) return [];
  const slots = Math.max(...shapes.map((s) => s.length));
  // How far apart counts as far, from the shapes' extent.
  const xs = shapes.flat().flatMap((p) => p.pts.map((q) => q[0]));
  const ys = shapes.flat().flatMap((p) => p.pts.map((q) => q[1]));
  const scale = Math.max(1e-6, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  // Biggest pieces first, so the main outlines keep the first slots.
  const first = [...shapes[0]!].sort((a, b) => b.size - a.size);
  const assigned: (Piece | null)[][] = [[...first, ...Array<null>(slots - first.length).fill(null)]];
  for (let i = 1; i < shapes.length; i++) assigned.push(assign(assigned[i - 1]!, shapes[i]!, scale));
  // An empty slot is a point: where the piece in that slot is in the nearest shape that has one.
  const resolved = assigned.map((shape, i) =>
    shape.map((piece, s): Point[] => {
      if (piece) return piece.pts;
      for (let k = 1; k < shapes.length; k++) {
        const near = assigned[(i + k) % shapes.length]![s] ?? assigned[(i - k + shapes.length) % shapes.length]![s];
        if (near) return Array.from({ length: n }, () => [near.centre[0], near.centre[1]] as Point);
      }
      return Array.from({ length: n }, () => [0, 0] as Point);
    }),
  );
  for (let i = 1; i < resolved.length; i++)
    resolved[i] = resolved[i]!.map((pts, s) => align(resolved[i - 1]![s]!, pts));
  const num = (v: number) => {
    const r = Number(v.toFixed(decimals));
    return String(Object.is(r, -0) ? 0 : r);
  };
  return resolved.map((shape) =>
    shape.map((pts) => `M${pts.map((p) => `${num(p[0])} ${num(p[1])}`).join(" L")} Z`).join(" "),
  );
}

/**
 * Two paths turned into paths with one structure, so `attrs: { d: [from, to] }`
 * blends one into the other (see {@link morphSequence}).
 */
export function morphPaths(from: string, to: string, options: MorphOptions = {}): [string, string] {
  const [a, b] = morphSequence([from, to], options);
  return [a!, b!];
}
