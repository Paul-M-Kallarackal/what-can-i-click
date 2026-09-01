import { z } from "zod";
import { COMPANY_EVIDENCE, SOURCES } from "../data/evidence";
import type { ArchitectureDecision, ArchitectureRecommendation, EvidenceReference, LatestReadStrategy, MechanismId, MergeFamilyId, Tradeoff, WorkloadProfile } from "../types";

export const workloadProfileSchema = z.object({
  workload: z.enum(["observability", "product-analytics", "cdc", "iot", "financial", "general"]),
  ingestRate: z.enum(["low", "medium", "high", "extreme"]),
  latencyTarget: z.enum(["interactive", "seconds", "minutes", "batch"]),
  retention: z.enum(["days", "months", "years"]),
  updates: z.enum(["append-only", "occasional", "frequent"]),
  availability: z.enum(["standard", "high"]),
  topology: z.enum(["single-region", "multi-region"]),
  costPriority: z.enum(["performance", "balanced", "cost"]),
  accelerationGoal: z.enum(["repeated-aggregation", "transform-or-route", "alternate-order", "transparent-acceleration", "none"]).optional(),
}).strict();

function decision(input: Omit<ArchitectureDecision, "id" | "districtId">): ArchitectureDecision {
  return {
    ...input,
    districtId: input.mechanismId.split(".")[0] as ArchitectureDecision["districtId"],
    id: `${input.mechanismId}-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

const orderingHint: Record<WorkloadProfile["workload"], string> = {
  observability: "the tenant and service dimensions used by dashboards, followed by event time",
  "product-analytics": "the tenant or project and stable cohort dimensions used by funnels, followed by event time",
  cdc: "the business key used by latest-row and deduplication reads, followed by version or event time",
  iot: "the site or device dimensions used by dashboards, followed by event time",
  financial: "the instrument and venue dimensions used by reads, followed by event time",
  general: "the most common selective equality or range filters, followed by time when it is part of the access path",
};

const aggregationRisk: Record<WorkloadProfile["workload"], string> = {
  observability: "service, trace, label, and time-bucket combinations",
  "product-analytics": "tenant, cohort, event, and user combinations",
  cdc: "business-key and version groups used for latest-row reconstruction",
  iot: "site, device, tag, and time-bucket combinations",
  financial: "account, instrument, venue, and time-window combinations",
  general: "the widest ad-hoc GROUP BY combinations your users can request",
};

type AccelerationGoal = NonNullable<WorkloadProfile["accelerationGoal"]>;

export type MergeFamilyRecommendation = {
  familyId: MergeFamilyId;
  latestReadStrategy: LatestReadStrategy;
  reason: string;
};

/**
 * The bounded workload schema does not contain enough information to safely
 * infer Summing, Aggregating, Collapsing, or Coalescing contracts. Keep those
 * families opt-in through explicit inspection. The advisor can, however,
 * distinguish immutable facts from appended row versions without borrowing a
 * canned use-case journey.
 */
export function recommendMergeFamily(profile: WorkloadProfile): MergeFamilyRecommendation {
  const parsed = workloadProfileSchema.parse(profile);
  if (parsed.updates === "append-only") {
    return {
      familyId: "merge",
      latestReadStrategy: "background",
      reason: "Append-only facts fit plain MergeTree: background merges preserve every row while consolidating immutable parts.",
    };
  }

  return {
    familyId: "replacing",
    latestReadStrategy: "argmax",
    reason: "Appended row versions fit ReplacingMergeTree. Use an explicit argMax(version) read boundary for current state instead of assuming background deduplication has already completed; reserve FINAL for bounded cases you have measured.",
  };
}

export function resolveAccelerationGoal(profile: WorkloadProfile): AccelerationGoal {
  if (profile.accelerationGoal) return profile.accelerationGoal;
  if (profile.workload === "product-analytics" || profile.workload === "observability") return "repeated-aggregation";
  if ((profile.workload === "iot" || profile.workload === "financial") && profile.latencyTarget === "interactive") return "repeated-aggregation";
  if (profile.workload === "general" && profile.latencyTarget === "interactive") return "transparent-acceleration";
  return "none";
}

export function accelerationMechanism(goal: AccelerationGoal): MechanismId | null {
  if (goal === "repeated-aggregation" || goal === "transform-or-route") return "precompute.materialized-view";
  if (goal === "alternate-order" || goal === "transparent-acceleration") return "precompute.projection";
  return null;
}

export function recommendArchitecture(rawProfile: WorkloadProfile): ArchitectureRecommendation {
  const profile = workloadProfileSchema.parse(rawProfile);
  const decisions: ArchitectureDecision[] = [];
  const path: MechanismId[] = [];
  const tradeoffs: Tradeoff[] = [];
  const accelerationGoal = resolveAccelerationGoal(profile);
  const accelerationId = accelerationMechanism(accelerationGoal);
  const managedStream = profile.workload === "cdc" || profile.workload === "iot";
  const ingestionId: MechanismId = managedStream
    ? "ingestion.clickpipes"
    : profile.ingestRate === "low"
      ? "ingestion.client-batching"
      : "ingestion.async-buffer";

  path.push(ingestionId);
  decisions.push(decision({
    mechanismId: ingestionId,
    title: managedStream ? "Managed streaming ingress" : profile.ingestRate === "low" ? "Client-side batches" : "Asynchronous insert buffer",
    recommendation: managedStream
      ? "Use ClickPipes where the source is supported; preserve source ordering and validate deduplication semantics."
      : profile.ingestRate === "low"
        ? "Batch rows at the client before inserting."
        : "Use meaningful client batches, or asynchronous inserts when independent writers cannot coordinate.",
    rationale: `${profile.ingestRate} ingest with a ${profile.latencyTarget} target should avoid a stream of tiny parts.`,
    alternatives: ["Direct native-protocol batches", "Kafka engine with a materialized view"],
    confidence: "high",
    evidenceIds: managedStream ? ["docs-clickpipes", "seemplicity"] : ["docs-async-inserts", "ly-corporation"],
  }));

  path.push("mergetree.parts-pressure");
  decisions.push(decision({
    mechanismId: "mergetree.parts-pressure",
    title: managedStream
      ? "Verify the connector creates mergeable parts"
      : profile.ingestRate === "low"
        ? "Keep small ingest from becoming tiny parts"
        : `${profile.ingestRate === "extreme" ? "Extreme" : "High"} ingest: bound part creation`,
    recommendation: managedStream
      ? "Keep the managed connector's batching intact, then verify rows and bytes per new part at the ClickHouse target; do not assume a streaming connector makes part pressure impossible."
      : profile.ingestRate === "low"
        ? "Accumulate a useful client batch before each insert and verify that part creation stays below background merge completion."
        : "Batch rows before sending them and use asynchronous inserts when independent writers cannot coordinate; verify flush behavior with production-shaped concurrency instead of raising part limits.",
    rationale: `${profile.ingestRate} ${profile.workload.replace("-", " ")} ingest can only remain stable when new immutable parts are created more slowly than eligible background merges can consolidate them.`,
    alternatives: managedStream
      ? ["Increase source-side batch size where the connector supports it", "Stage through Kafka with a deliberately sized consumer block"]
      : ["Coordinate larger native-protocol batches", "Buffer independent writers with asynchronous inserts"],
    confidence: "high",
    evidenceIds: managedStream ? ["docs-mergetree", "docs-clickpipes"] : ["docs-mergetree", "docs-async-inserts"],
  }));

  path.push("mergetree.partition-boundary");
  decisions.push(decision({
    mechanismId: "mergetree.partition-boundary",
    title: profile.retention === "days"
      ? "Short retention: align a coarse lifecycle boundary"
      : `${profile.retention[0].toUpperCase()}${profile.retention.slice(1)} of retention: keep partitions coarse`,
    recommendation: `Use partitioning only when ${profile.retention} retention or another data-management operation needs a boundary. Keep ${profile.workload.replace("-", " ")} query locality in ORDER BY; do not fan inserts across high-cardinality user, tenant, device, or event identifiers unless that identifier is genuinely the lifecycle boundary.`,
    rationale: `A single insert block creates at least one part per partition it touches, and those parts can never merge across partition boundaries. ${profile.updates === "frequent" ? "Versioned rows must also remain in the same partition to reconcile predictably." : "Append-oriented rows still fragment when one flush spans too many keys."}`,
    alternatives: [
      "Start without custom partitioning until lifecycle operations require it",
      profile.retention === "days" ? "Use a coarser time bucket and expire complete parts" : "Use a coarse time bucket and keep selective dimensions in ORDER BY",
    ],
    confidence: "high",
    evidenceIds: ["docs-partitioning-key", "docs-mergetree"],
  }));

  path.push("mergetree.part-anatomy");
  if (profile.updates !== "append-only") path.push("mergetree.part-lifecycle");
  decisions.push(decision({
    mechanismId: profile.updates === "append-only" ? "mergetree.part-anatomy" : "mergetree.part-lifecycle",
    title: profile.updates === "append-only" ? "Immutable MergeTree facts" : "Versioned replacement model",
    recommendation: profile.updates === "append-only"
      ? "Use MergeTree with an ORDER BY key beginning with common selective filters."
      : "Model updates as appended versions—commonly with ReplacingMergeTree—and make replacement semantics explicit at read or aggregation boundaries.",
    rationale: profile.updates === "append-only" ? "The workload fits the simplest immutable-part lifecycle." : "Frequent in-place rewrites fight the part model.",
    alternatives: ["CollapsingMergeTree for explicit state transitions", "Periodic rebuild into a clean target table"],
    confidence: "high",
    evidenceIds: ["docs-mergetree", profile.workload === "cdc" ? "seemplicity" : "netflix"],
  }));

  path.push("read.ordering", "read.sparse-index", "read.granules", "read.saved-work", "read.column-pruning", "execution.explain-plan");
  decisions.push(decision({
    mechanismId: "read.ordering",
    title: `${profile.workload.replace("-", " ")} physical order for ${profile.latencyTarget} reads`,
    recommendation: `Build ORDER BY from representative ${profile.workload.replace("-", " ")} filters: start with ${orderingHint[profile.workload]}. Validate the exact candidate on production-shaped data with EXPLAIN indexes = 1; do not lead with a field only because it is high-cardinality.`,
    rationale: `${profile.latencyTarget} reads stay selective only when matching rows form contiguous ranges that sparse marks can discard around.`,
    alternatives: ["A second table with another ordering", "A projection for a stable alternate access path"],
    confidence: "high",
    evidenceIds: ["docs-primary-index", profile.workload === "financial" ? "qrt" : "cloudflare"],
  }));

  if (accelerationId) {
    const materializedView = accelerationId === "precompute.materialized-view";
    const repeatedAggregate = accelerationGoal === "repeated-aggregation";
    path.push(accelerationId);
    decisions.push(decision({
      mechanismId: accelerationId,
      title: materializedView
        ? repeatedAggregate ? `${profile.workload.replace("-", " ")} aggregate target` : `${profile.workload.replace("-", " ")} transform target`
        : accelerationGoal === "alternate-order" ? `${profile.workload.replace("-", " ")} alternate order` : "Transparent same-table acceleration",
      recommendation: materializedView
        ? repeatedAggregate
          ? `Maintain the repeated ${profile.workload.replace("-", " ")} aggregate from each newly inserted block in an explicit target table, then query that target directly. Backfill existing rows separately and test how source mutations or partition operations are reconciled.`
          : `Use an incremental materialized view to transform, filter, or route each newly inserted ${profile.workload.replace("-", " ")} block into an explicit target table. Backfill history separately; do not assume later source mutations synchronize the target.`
        : `Attach a projection to the base table for the stable ${accelerationGoal === "alternate-order" ? "alternate ORDER BY" : "alternate access path"} while callers continue querying the base table. Materialize existing parts, then prove optimizer selection with EXPLAIN projections = 1.`,
      rationale: materializedView
        ? `This ${profile.latencyTarget} path deliberately shifts repeated work into ${profile.ingestRate} insert traffic and produces a separately modeled result.`
        : `The requested speedup is another representation of the same rows, so keeping it attached to each base part avoids introducing a separately addressed target table.`,
      alternatives: materializedView
        ? ["Projection when the result is the same table in another stable layout", "Query-time aggregation for genuinely ad-hoc questions"]
        : ["Incremental materialized view for a separately modeled transform or aggregate", "Second explicitly queried table when optimizer transparency is not required"],
      confidence: profile.accelerationGoal ? "high" : "medium",
      evidenceIds: [materializedView ? "docs-materialized-views" : "docs-projections", profile.workload === "product-analytics" ? "rill" : "clickhouse-internal"],
    }));
    tradeoffs.push(materializedView
      ? { benefit: "A separately modeled target makes repeated transforms and aggregates cheap to read.", cost: "Every insert performs extra work; history and source-side rewrites need explicit synchronization procedures." }
      : { benefit: "The optimizer can accelerate the existing base-table query with an attached representation.", cost: "Projection storage, materialization, and background maintenance must be justified and optimizer use must be verified." });
  }

  path.push("execution.sort-aggregate", "memory.memory-tracker", "memory.external-spill", "observability.processes");
  const latencySensitiveAggregation = profile.latencyTarget === "interactive" || profile.latencyTarget === "seconds";
  decisions.push(decision({
    mechanismId: "memory.external-spill",
    title: `${profile.workload.replace("-", " ")} aggregation memory guardrail`,
    recommendation: `Benchmark the worst-case distinct count for ${aggregationRisk[profile.workload]}. ${latencySensitiveAggregation ? "Filter earlier and precompute repeated high-cardinality questions before depending on spill. " : "For batch-shaped work, reserve enough temporary storage and accept the I/O tradeoff deliberately. "}Configure max_bytes_before_external_group_by as a tested completion guardrail below the query memory ceiling, not as a latency optimization.`,
    rationale: `${profile.latencyTarget} queries must hold partial state for each distinct group and aggregate function; external processing reduces in-memory pressure only by adding temporary writes, reads, and a merge phase.`,
    alternatives: [
      "Incremental materialized view for repeated aggregates",
      "Aggregation in order when the grouping key aligns with physical order",
      "More memory for irreducible ad-hoc cardinality",
    ],
    confidence: "high",
    evidenceIds: ["docs-external-aggregation", "docs-materialized-views"],
  }));
  tradeoffs.push({ benefit: "A tested spill threshold lets oversized GROUP BY work complete within bounded RAM.", cost: "Temporary disk I/O makes the slow path materially less interactive." });

  if (profile.availability === "high" || profile.topology === "multi-region" || profile.ingestRate === "extreme") {
    const needsShards = profile.ingestRate === "extreme" || profile.topology === "multi-region";
    if (needsShards) path.push("architecture.sharding");
    path.push("architecture.replication", "architecture.keeper", "architecture.failure", "architecture.recovery", "observability.replication-queue");
    if (profile.topology === "multi-region") path.push("architecture.multi-region");
    decisions.push(decision({
      mechanismId: needsShards ? "architecture.sharding" : "architecture.replication",
      title: needsShards ? "Replicated shards" : "Replicated single shard",
      recommendation: needsShards
        ? "Use multiple shards for measured capacity, at least two replicas per shard, and Keeper for replicated-table coordination."
        : "Begin with one shard and multiple replicas; add shards only after measured single-shard capacity is insufficient.",
      rationale: `${profile.availability} availability and ${profile.topology} topology require explicit failure domains.`,
      alternatives: ["ClickHouse Cloud managed scaling", "Single-node deployment for non-critical workloads"],
      confidence: "medium",
      evidenceIds: ["docs-replication", "docs-keeper", needsShards ? "cloudflare" : "gitlab"],
    }));
    decisions.push(decision({
      mechanismId: "architecture.keeper",
      title: "Keeper majority across failure domains",
      recommendation: `Use three voting Keeper nodes for this ${profile.availability}-availability design and place them in independent failure domains. Prove that losing any one voter retains a 2 / 3 majority; alert on lost sessions, no-leader windows, and replicated tables entering read-only state. Keep Keeper logs on non-busy storage and never place user data in the coordination path.`,
      rationale: "Keeper coordinates replication metadata through Raft. Losing a writable majority stops new coordination even though immutable parts remain on ClickHouse replicas and SELECT does not route row bytes through Keeper.",
      alternatives: ["ClickHouse Cloud managed coordination", "A larger odd voting ensemble only when the additional failure model justifies its operational cost"],
      confidence: "high",
      evidenceIds: ["docs-keeper", "docs-readonly-tables", "docs-replication"],
    }));
    const replicaPressure = profile.ingestRate === "high" || profile.ingestRate === "extreme";
    decisions.push(decision({
      mechanismId: "observability.replication-queue",
      title: `${profile.topology === "multi-region" ? "Cross-region" : "Replica"} catch-up guardrail`,
      recommendation: `Track queue size and oldest-task age per replica, then break pending work down by GET_PART, MERGE_PARTS, and${profile.updates === "frequent" ? " MUTATE_PART" : " other operation"} types. ${replicaPressure ? "At this ingest rate, alert when age rises across samples rather than treating a non-zero queue as failure; inspect retries, postpone reasons, and last exceptions before adding capacity." : "Confirm that short queues drain and investigate persistent age growth before it reaches the availability budget."}`,
      rationale: `Replication is asynchronous: the destination must fetch compressed part bytes and complete local work while ${profile.ingestRate} ingest continues.${profile.topology === "multi-region" ? " Cross-region transfer makes network latency and bandwidth an explicit catch-up boundary." : " Keeper coordinates the operation, but part bytes use the replica data path."}`,
      alternatives: ["Reduce write pressure while a replica catches up", "Increase measured fetch, storage, or merge capacity at the slow replica", "Route reads away from a stale replica within an explicit staleness policy"],
      confidence: "high",
      evidenceIds: ["docs-replication-queue", "docs-system-replicas", "docs-replication"],
    }));
    tradeoffs.push({ benefit: "Replication improves availability and read capacity.", cost: "Sharding and replicas add storage, coordination, and recovery testing." });
  }

  if (profile.retention !== "days" || profile.updates !== "append-only" || profile.costPriority === "cost") {
    const mechanismId: MechanismId = profile.costPriority === "cost" ? "retention.ttl-move" : "retention.ttl-delete";
    path.push(mechanismId);
    if (profile.updates === "frequent") path.push("retention.mutation", "observability.merges");
    decisions.push(decision({
      mechanismId,
      title: "Tiered retention policy",
      recommendation: `Encode ${profile.retention} retention with TTL, using recompression or storage movement before deletion when it saves cost.`,
      rationale: "Lifecycle work should be scheduled and observable instead of performed as emergency bulk deletes.",
      alternatives: ["Partition drops for coarse time windows", "Export then delete for regulated archives"],
      confidence: "high",
      evidenceIds: ["docs-ttl", "docs-mutations", profile.workload === "observability" ? "netflix" : "clickhouse-internal"],
    }));
    tradeoffs.push({ benefit: "TTL makes retention repeatable.", cost: "TTL is asynchronous and competes for merge resources." });
    if (profile.updates === "frequent") {
      const peakIngest = profile.ingestRate === "high" || profile.ingestRate === "extreme";
      decisions.push(decision({
        mechanismId: "observability.merges",
        title: `${profile.ingestRate[0].toUpperCase()}${profile.ingestRate.slice(1)} ingest: protect merge capacity`,
        recommendation: `${profile.workload === "cdc" ? "Prefer appended versions with ReplacingMergeTree or explicit argMax reads over routine broad mutations. " : "Keep frequent changes append-oriented where possible. "}${peakIngest ? "Do not overlap broad mutations or heavy TTL rewrites with peak ingestion; stage them in separate windows and stop when normal merges fall behind." : "Schedule broad mutations and heavy TTL work deliberately rather than letting them overlap without bounds."}`,
        rationale: `${profile.retention} retention, frequent updates, and ${profile.ingestRate} ingest can place merges, TTL work, and mutation rewrites on the same finite CPU and storage path.`,
        alternatives: ["Rebuild a controlled partition or shadow table", "Use lightweight deletes only when their semantics fit", "Move correction logic to an append-and-select model"],
        confidence: "high",
        evidenceIds: ["docs-system-merges", "docs-ttl", "docs-mutations"],
      }));
      tradeoffs.push({ benefit: "Protected merge capacity keeps part counts and ingestion stable.", cost: "Bulk correction and lifecycle work may complete later." });
    }
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
    summary: `${profile.workload.replace("-", " ")} architecture: control part creation, align ordering with reads, ${path.some((id) => id.startsWith("precompute")) ? "precompute repeated work, " : ""}${path.some((id) => id.startsWith("architecture")) ? "replicate before scaling out, " : ""}and validate every boundary with production-shaped data.`,
    path: unique(path),
    decisions,
    tradeoffs,
    validationSteps: [
      "Replay representative ingest with production-shaped batch sizes and observe active part counts.",
      "Compare new-part creation with completed merges, and inspect rows and bytes per part before changing safety limits.",
      "Measure distinct partition values touched by each representative insert block; verify that the key exists for lifecycle management rather than query acceleration.",
      ...(profile.updates === "frequent" ? ["Verify every version of one logical row resolves to the same partition value."] : []),
      ...(path.includes("observability.merges") ? ["Replay merges, TTL work, and a representative mutation together; compare queue age, merge throughput, active parts, insert p99, and storage bandwidth before scheduling production overlap."] : []),
      "Use EXPLAIN indexes = 1 and query logs to verify granule pruning and memory use.",
      "Record granules selected versus total granules for the highest-volume query shapes; reject an ORDER BY candidate that scatters a common filter across most ranges.",
      `Benchmark ${aggregationRisk[profile.workload]} at expected and worst-case cardinality; record peak memory, temporary spill I/O, and elapsed time before accepting the external GROUP BY threshold.`,
      "Benchmark the common dashboard and worst-case query at expected concurrency.",
      ...(accelerationId === "precompute.materialized-view" ? [
        "Insert a known block and verify that only that block feeds the incremental materialized-view transform and explicit target table.",
        "Backfill a historical slice separately, mutate or drop a controlled source slice, and verify the target-table reconciliation procedure instead of assuming automatic synchronization.",
        "Compare insert latency, target part creation, target merge pressure, and dashboard latency before and after enabling the view.",
      ] : accelerationId === "precompute.projection" ? [
        "Materialize the projection for existing parts, then use EXPLAIN projections = 1 to prove representative queries select it instead of the base layout.",
        "Compare bytes read, marks read, insert latency, projection storage, and background maintenance before accepting the projection.",
      ] : []),
      ...(path.some((id) => id.startsWith("architecture")) ? [
        "Fail one replica and verify recovery, routing, and Keeper quorum behavior.",
        "Remove one Keeper voter and verify the remaining 2 / 3 majority stays writable; then isolate a second voter, confirm replicated writes pause without moving part bytes through Keeper, restore the majority, and verify sessions and queued work recover.",
        "During failure and catch-up, record replication queue depth, oldest-task age, GET_PART and MERGE_PARTS mix, retries, postpone reasons, last exceptions, and catch-up throughput; recovery is complete only when age and depth return to their tested baseline.",
      ] : []),
    ],
    evidence,
  };
}
