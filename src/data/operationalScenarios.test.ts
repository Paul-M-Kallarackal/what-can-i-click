import { describe, expect, it } from "vitest";
import { MECHANISMS } from "./mechanisms";
import { OPERATIONAL_SCENARIOS, operationalSnapshot } from "./operationalScenarios";

describe("ClickHouse operational scenarios", () => {
  it("addresses reviewed ClickHouse mechanisms rather than PostgreSQL internals", () => {
    const ids = new Set(MECHANISMS.map((mechanism) => mechanism.id));
    for (const scenario of OPERATIONAL_SCENARIOS) {
      if (scenario.primaryMechanismId) expect(ids.has(scenario.primaryMechanismId)).toBe(true);
      for (const mechanismId of scenario.affectedMechanismIds) expect(ids.has(mechanismId)).toBe(true);
    }
    expect(JSON.stringify(OPERATIONAL_SCENARIOS)).not.toMatch(/autovacuum|shared_buffers|ProcArray|CLOG|pg_wal/i);
  });

  it("produces deterministic bounded model telemetry", () => {
    expect(operationalSnapshot("aggregation-spill", 8)).toEqual(operationalSnapshot("aggregation-spill", 8));
    expect(operationalSnapshot("aggregation-spill", 8).memoryPercent).toBeLessThanOrEqual(100);
    expect(operationalSnapshot("healthy", 0).queryP99Ms).toBeLessThan(operationalSnapshot("bad-order-by", 8).queryP99Ms);
  });
});
