import { describe, expect, it } from "vitest";
import { COMPANY_EVIDENCE } from "./evidence";
import { DISTRICTS, MECHANISMS } from "./mechanisms";

describe("reviewed ClickHouse knowledge world", () => {
  it("ships eleven districts and all 65 inspectable ClickHouse mechanisms", () => {
    expect(DISTRICTS).toHaveLength(11);
    expect(MECHANISMS).toHaveLength(65);
    expect(new Set(MECHANISMS.map((mechanism) => mechanism.id)).size).toBe(65);

    for (const mechanism of MECHANISMS) {
      expect(mechanism.claims.length).toBeGreaterThan(0);
      expect(mechanism.tradeoffs.length).toBeGreaterThan(0);
      expect(mechanism.states).toHaveLength(3);
      expect(mechanism.transitions).toHaveLength(2);
      expect(mechanism.reducedMotionSummary).toBeTruthy();
      expect(mechanism.claimIds.length).toBeGreaterThan(0);
    }
  });

  it("ships ten reviewed field stories and never invents versions", () => {
    expect(COMPANY_EVIDENCE).toHaveLength(10);
    expect(COMPANY_EVIDENCE.every((entry) => entry.version === "Not disclosed")).toBe(true);
  });
});
