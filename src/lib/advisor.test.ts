import { describe, expect, it } from "vitest";
import { recommendArchitecture, workloadProfileSchema } from "./advisor";
import { mechanismById } from "../data/mechanisms";
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
    expect(result.path).toEqual([
      "ingestion.async-buffer",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
      "precompute.materialized-view",
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "architecture.replication",
      "architecture.keeper",
      "architecture.failure",
      "architecture.recovery",
      "observability.replication-queue",
      "retention.ttl-delete",
    ]);
    expect(result.path.every((id) => mechanismById(id))).toBe(true);
    expect(result.decisions.every((entry) => entry.evidenceIds.length > 0)).toBe(true);
    const keeper = result.decisions.find((entry) => entry.mechanismId === "architecture.keeper");
    expect(keeper?.recommendation).toContain("2 / 3 majority");
    expect(keeper?.recommendation).toContain("read-only state");
    expect(keeper?.evidenceIds).toEqual(expect.arrayContaining(["docs-keeper", "docs-readonly-tables", "docs-replication"]));
  });

  it("uses managed ingestion and a replacement model for CDC", () => {
    const result = recommendArchitecture({ ...base, workload: "cdc", updates: "frequent", latencyTarget: "seconds" });
    expect(result.decisions[0].title).toContain("Managed");
    expect(result.decisions.find((entry) => entry.mechanismId === "mergetree.part-lifecycle")?.recommendation).toContain("ReplacingMergeTree");
    expect(result.decisions.find((entry) => entry.mechanismId === "mergetree.parts-pressure")?.recommendation).toContain("managed connector");
  });

  it("attaches a workload-specific decision to the tiny-part gotcha", () => {
    const high = recommendArchitecture(base).decisions.find((entry) => entry.mechanismId === "mergetree.parts-pressure");
    const low = recommendArchitecture({ ...base, ingestRate: "low" }).decisions.find((entry) => entry.mechanismId === "mergetree.parts-pressure");

    expect(high?.title).toContain("High ingest");
    expect(high?.recommendation).toContain("asynchronous inserts");
    expect(low?.title).toContain("small ingest");
    expect(low?.recommendation).toContain("client batch");
  });

  it("keeps partitioning tied to lifecycle rather than query locality", () => {
    const months = recommendArchitecture(base).decisions.find((entry) => entry.mechanismId === "mergetree.partition-boundary");
    const short = recommendArchitecture({ ...base, retention: "days" }).decisions.find((entry) => entry.mechanismId === "mergetree.partition-boundary");

    expect(months?.title).toContain("Months of retention");
    expect(months?.recommendation).toContain("ORDER BY");
    expect(short?.title).toContain("Short retention");
    expect(short?.evidenceIds).toContain("docs-partitioning-key");
  });

  it("turns the workload into an explicit physical-order recommendation", () => {
    const observability = recommendArchitecture(base).decisions.find((entry) => entry.mechanismId === "read.ordering");
    const financial = recommendArchitecture({ ...base, workload: "financial", latencyTarget: "seconds" }).decisions.find((entry) => entry.mechanismId === "read.ordering");

    expect(observability?.title).toContain("observability physical order");
    expect(observability?.recommendation).toContain("tenant and service");
    expect(observability?.recommendation).toContain("EXPLAIN indexes = 1");
    expect(financial?.recommendation).toContain("instrument and venue");
  });

  it("treats external GROUP BY as a workload-shaped completion guardrail", () => {
    const interactive = recommendArchitecture(base).decisions.find((entry) => entry.mechanismId === "memory.external-spill");
    const batch = recommendArchitecture({ ...base, workload: "iot", latencyTarget: "batch" }).decisions.find((entry) => entry.mechanismId === "memory.external-spill");

    expect(interactive?.recommendation).toContain("service, trace, label");
    expect(interactive?.recommendation).toContain("precompute repeated high-cardinality questions");
    expect(interactive?.recommendation).toContain("max_bytes_before_external_group_by");
    expect(interactive?.evidenceIds).toContain("docs-external-aggregation");
    expect(batch?.recommendation).toContain("site, device, tag");
    expect(batch?.recommendation).toContain("reserve enough temporary storage");
  });

  it("protects merge capacity when frequent updates overlap retention work", () => {
    const result = recommendArchitecture({ ...base, workload: "cdc", updates: "frequent", ingestRate: "extreme", retention: "years" });
    const contention = result.decisions.find((entry) => entry.mechanismId === "observability.merges");

    expect(result.path).toEqual(expect.arrayContaining(["retention.ttl-delete", "retention.mutation", "observability.merges"]));
    expect(contention?.title).toContain("Extreme ingest");
    expect(contention?.recommendation).toContain("ReplacingMergeTree");
    expect(contention?.recommendation).toContain("Do not overlap broad mutations");
    expect(contention?.evidenceIds).toEqual(expect.arrayContaining(["docs-system-merges", "docs-ttl", "docs-mutations"]));
    expect(result.evidence.map((entry) => entry.id)).toContain("docs-system-merges");
    expect(result.validationSteps.some((step) => step.includes("merges, TTL work"))).toBe(true);
  });

  it("recommends replicated shards for multi-region product analytics", () => {
    const result = recommendArchitecture({ ...base, workload: "product-analytics", topology: "multi-region", ingestRate: "extreme" });
    expect(result.decisions.some((entry) => entry.title === "Replicated shards")).toBe(true);
    expect(result.path).toEqual(expect.arrayContaining([
      "architecture.sharding",
      "architecture.replication",
      "architecture.keeper",
      "architecture.failure",
      "architecture.recovery",
      "observability.replication-queue",
      "architecture.multi-region",
    ]));
    const catchUp = result.decisions.find((entry) => entry.mechanismId === "observability.replication-queue");
    expect(catchUp?.title).toContain("Cross-region");
    expect(catchUp?.recommendation).toContain("oldest-task age");
    expect(catchUp?.recommendation).toContain("GET_PART");
    expect(catchUp?.evidenceIds).toEqual(expect.arrayContaining(["docs-replication-queue", "docs-system-replicas", "docs-replication"]));
    expect(result.validationSteps.some((step) => step.includes("catch-up throughput"))).toBe(true);
  });

  it("rejects additional fields and arbitrary private context", () => {
    expect(() => workloadProfileSchema.parse({ ...base, password: "secret" })).toThrow();
  });
});
