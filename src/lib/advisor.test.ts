import { describe, expect, it } from "vitest";
import { recommendArchitecture, workloadProfileSchema } from "./advisor";
import type { WorkloadProfile } from "../types";

const base: WorkloadProfile = {
  workload: "observability",
  ingestRate: "high",
  latencyTarget: "interactive",
  retention: "months",
  updates: "append-only",
  availability: "high",
  topology: "single-region",
  costPriority: "balanced",
};

describe("recommendArchitecture", () => {
  it("builds an observability path with aggregation, architecture, and retention", () => {
    const result = recommendArchitecture(base);
    expect(result.path).toEqual(["ingestion", "mergetree", "read-path", "aggregation", "architecture", "retention"]);
    expect(result.decisions.every((entry) => entry.evidenceIds.length > 0)).toBe(true);
  });

  it("uses managed ingestion and a replacement model for CDC", () => {
    const result = recommendArchitecture({ ...base, workload: "cdc", updates: "frequent", latencyTarget: "seconds" });
    expect(result.decisions[0].title).toContain("Managed");
    expect(result.decisions[1].recommendation).toContain("ReplacingMergeTree");
  });

  it("recommends replicated shards for multi-region product analytics", () => {
    const result = recommendArchitecture({ ...base, workload: "product-analytics", topology: "multi-region", ingestRate: "extreme" });
    expect(result.decisions.some((entry) => entry.title === "Replicated shards")).toBe(true);
  });

  it("rejects additional fields and arbitrary private context", () => {
    expect(() => workloadProfileSchema.parse({ ...base, password: "secret" })).toThrow();
  });
});

