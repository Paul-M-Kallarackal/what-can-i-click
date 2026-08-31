import { describe, expect, it } from "vitest";
import { COMPANY_EVIDENCE } from "./evidence";
import { KNOWLEDGE_NODES } from "./knowledge";

describe("reviewed atlas data", () => {
  it("ships exactly six fully sourced hero mechanisms", () => {
    expect(KNOWLEDGE_NODES).toHaveLength(6);
    for (const node of KNOWLEDGE_NODES) {
      expect(node.claims.length).toBeGreaterThan(0);
      expect(node.tradeoffs.length).toBeGreaterThan(0);
      expect(node.motion.metaphor).toBeTruthy();
      expect(node.motion.reducedMotionState).toBeTruthy();
    }
  });

  it("ships ten reviewed field stories and never invents versions", () => {
    expect(COMPANY_EVIDENCE).toHaveLength(10);
    expect(COMPANY_EVIDENCE.every((entry) => entry.version === "Not disclosed")).toBe(true);
  });
});

