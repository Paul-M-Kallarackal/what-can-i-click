import { z } from "zod";
import { COMPANY_EVIDENCE, SOURCES } from "../data/evidence";
import type { ArchitectureDecision, ArchitectureRecommendation, DistrictId, EvidenceReference, Tradeoff, WorkloadProfile } from "../types";

export const workloadProfileSchema = z.object({
  workload: z.enum(["observability", "product-analytics", "cdc", "iot", "financial", "general"]),
  ingestRate: z.enum(["low", "medium", "high", "extreme"]),
  latencyTarget: z.enum(["interactive", "seconds", "minutes", "batch"]),
  retention: z.enum(["days", "months", "years"]),
  updates: z.enum(["append-only", "occasional", "frequent"]),
  availability: z.enum(["standard", "high"]),
  topology: z.enum(["single-region", "multi-region"]),
  costPriority: z.enum(["performance", "balanced", "cost"]),
}).strict();

function decision(input: Omit<ArchitectureDecision, "id">): ArchitectureDecision {
  return { ...input, id: `${input.nodeId}-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` };
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function recommendArchitecture(rawProfile: WorkloadProfile): ArchitectureRecommendation {
  const profile = workloadProfileSchema.parse(rawProfile);
  const decisions: ArchitectureDecision[] = [];
  const path: DistrictId[] = ["ingestion", "mergetree"];
  const tradeoffs: Tradeoff[] = [];

  const managedStream = profile.workload === "cdc" || profile.workload === "iot";
  decisions.push(decision({
    nodeId: "ingestion",
    title: managedStream ? "Managed streaming ingress" : profile.ingestRate === "low" ? "Client-side batches" : "Asynchronous insert buffer",
    recommendation: managedStream
      ? "Use ClickPipes where the source is supported; preserve source ordering and validate deduplication semantics."
      : profile.ingestRate === "low"
        ? "Batch rows at the client before inserting."
        : "Use meaningful client batches, or asynchronous inserts when independent writers cannot coordinate.",
    rationale: `${profile.ingestRate} ingest with a ${profile.latencyTarget} latency target should avoid producing a stream of tiny parts.`,
    alternatives: ["Kafka engine with a materialized view", "Direct native-protocol batches"],
    confidence: "high",
    evidenceIds: managedStream ? ["docs-clickpipes", "seemplicity"] : ["docs-async-inserts", "ly-corporation"],
  }));

  decisions.push(decision({
    nodeId: "mergetree",
    title: profile.updates === "append-only" ? "MergeTree fact table" : "Versioned replacement model",
    recommendation: profile.updates === "append-only"
      ? "Use MergeTree with an ORDER BY key beginning with common selective filters."
      : "Model updates with a versioned ReplacingMergeTree-style pattern and make deduplication explicit at read or aggregation boundaries.",
    rationale: profile.updates === "append-only" ? "The workload can preserve the simplest immutable-part lifecycle." : "Frequent in-place rewrites fight the part model.",
    alternatives: ["CollapsingMergeTree for explicit state transitions", "Periodic rebuild into a clean target table"],
    confidence: "high",
    evidenceIds: ["docs-mergetree", profile.workload === "cdc" ? "seemplicity" : "netflix"],
  }));

  path.push("read-path");
  decisions.push(decision({
    nodeId: "read-path",
    title: "Workload-aligned sorting key",
    recommendation: "Start ORDER BY with high-value filtering dimensions, then time; validate pruning with EXPLAIN indexes = 1.",
    rationale: `${profile.latencyTarget} reads depend first on skipping granules, not on adding secondary machinery.`,
    alternatives: ["A second table with another ordering", "A projection for a stable alternate access path"],
    confidence: "high",
    evidenceIds: ["docs-primary-index", profile.workload === "financial" ? "qrt" : "cloudflare"],
  }));

  if (profile.latencyTarget === "interactive" || profile.workload === "product-analytics" || profile.workload === "observability") {
    path.push("aggregation");
    const projectionFirst = profile.workload === "general" || profile.updates === "frequent";
    decisions.push(decision({
      nodeId: "aggregation",
      title: projectionFirst ? "Projection for alternate reads" : "Incremental materialized view",
      recommendation: projectionFirst
        ? "Use a projection only for a stable alternate sort or pre-aggregation the optimizer can choose."
        : "Use an incremental materialized view for repeated dashboard aggregates with a clear target table.",
      rationale: "Repeated interactive questions should not rescan and regroup the full event history.",
      alternatives: projectionFirst ? ["Second explicitly queried table", "Incremental materialized view"] : ["Projection", "Query-time aggregation"],
      confidence: "high",
      evidenceIds: [projectionFirst ? "docs-projections" : "docs-materialized-views", profile.workload === "product-analytics" ? "rill" : "clickhouse-internal"],
    }));
    tradeoffs.push({ benefit: "Precomputation makes common reads predictable.", cost: "Insert work, storage, and backfill procedures increase." });
  }

  if (profile.availability === "high" || profile.topology === "multi-region" || profile.ingestRate === "extreme") {
    path.push("architecture");
    const needsShards = profile.ingestRate === "extreme" || profile.topology === "multi-region";
    decisions.push(decision({
      nodeId: "architecture",
      title: needsShards ? "Replicated shards" : "Replicated single shard",
      recommendation: needsShards
        ? "Use multiple shards for capacity, at least two replicas per shard for availability, and Keeper for replicated-table coordination."
        : "Begin with one shard and multiple replicas; add shards only after measured single-shard capacity is insufficient.",
      rationale: `${profile.availability} availability and ${profile.topology} topology require failure domains to be explicit.`,
      alternatives: ["ClickHouse Cloud managed scaling", "Single-node deployment for non-critical workloads"],
      confidence: "medium",
      evidenceIds: ["docs-replication", "docs-keeper", needsShards ? "cloudflare" : "gitlab"],
    }));
    tradeoffs.push({ benefit: "Replication improves availability and read capacity.", cost: "Sharding and replicas add storage, coordination, and recovery testing." });
  }

  if (profile.retention !== "days" || profile.updates !== "append-only" || profile.costPriority === "cost") {
    path.push("retention");
    decisions.push(decision({
      nodeId: "retention",
      title: "Tiered retention policy",
      recommendation: `Encode ${profile.retention} retention with TTL, using recompression or storage movement before deletion when it saves cost.`,
      rationale: "Lifecycle work should be scheduled and observable instead of performed as emergency bulk deletes.",
      alternatives: ["Partition drops for coarse time windows", "Export then delete for regulated archives"],
      confidence: "high",
      evidenceIds: ["docs-ttl", "docs-mutations", profile.workload === "observability" ? "netflix" : "clickhouse-internal"],
    }));
    tradeoffs.push({ benefit: "TTL makes retention repeatable.", cost: "TTL is asynchronous and competes for merge resources." });
  }

  const evidenceIds = unique(decisions.flatMap((entry) => entry.evidenceIds));
  const evidence: EvidenceReference[] = evidenceIds.flatMap((id) => {
    const official = Object.values(SOURCES).find((source) => source.id === id);
    if (official) return [official];
    const field = COMPANY_EVIDENCE.find((entry) => entry.id === id)?.source;
    return field ? [field] : [];
  });

  return {
    id: `architecture-${profile.workload}-${profile.ingestRate}-${profile.latencyTarget}`,
    summary: `${profile.workload.replace("-", " ")} architecture: control part creation, align the sort key with reads, ${path.includes("aggregation") ? "precompute repeated work, " : ""}${path.includes("architecture") ? "replicate before scaling out, " : ""}and validate every boundary with production-shaped data.`,
    path: unique(path),
    decisions,
    tradeoffs,
    validationSteps: [
      "Replay representative ingest with production-shaped batch sizes and observe active part counts.",
      "Use EXPLAIN indexes = 1 and query logs to verify granule pruning and memory use.",
      "Benchmark the common dashboard and worst-case query at expected concurrency.",
      ...(path.includes("architecture") ? ["Fail one replica and verify recovery, routing, and Keeper quorum behavior."] : []),
    ],
    evidence,
  };
}

