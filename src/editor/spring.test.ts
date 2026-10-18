import { springAt } from "@pixerate/editor/animation";
import { describe, expect, it } from "vitest";
import { springProgress } from "../vector/motion.js";

// The spring ease is a contract with @pixerate/editor, which exports springs as `{spring: …}`.
describe("spring ease parity with @pixerate/editor", () => {
  const springs = [
    {},
    { stiffness: 100, damping: 10 },
    { stiffness: 100, damping: 20 },
    { stiffness: 100, damping: 40, mass: 2 },
    { stiffness: 300, damping: 15, velocity: 4 },
    { stiffness: 80, damping: 0 },
    { mass: 0, stiffness: -1, damping: -3 },
  ];
  it("matches springAt number for number", () => {
    for (const spring of springs)
      for (let s = 0; s <= 2; s += 0.05) expect(springProgress(spring, s)).toBe(springAt(spring, s));
  });
});
