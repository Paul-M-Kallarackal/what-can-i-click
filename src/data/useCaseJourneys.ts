import type {
  LatestReadStrategy,
  MechanismId,
  MergeFamilyId,
  Tradeoff,
  WorkloadProfile,
} from "../types";

export type AgentLogStage = "interpret" | "route" | "decide" | "tradeoff" | "guide";
export type GuidePhase = "ingestion" | "storage" | "read" | "precompute" | "architecture" | "retention";

export type AgentLogStep = {
  stage: AgentLogStage;
  message: string;
};

export type JourneyGuideStep = {
  id: string;
  phase: GuidePhase;
  title: string;
  narration: string;
  mechanismId: MechanismId;
  evidenceId: string;
  /** A reviewed implementation selected for this exact step, or null when none is known. */
  productionEvidenceId: string | null;
  familyId?: MergeFamilyId;
};

export type ResolvedJourneyGuideStep = {
  index: number;
  step: JourneyGuideStep;
  familyId: MergeFamilyId;
  latestReadStrategy: LatestReadStrategy;
  mechanismId: MechanismId;
  evidenceId: string;
};

export type JourneyStrategy = {
  label: string;
  readPattern: string;
  latestRead: LatestReadStrategy | null;
  rationale: string;
};

/**
 * A bounded, deterministic workload that an agent can replay without receiving
 * SQL, credentials, schemas, cluster data, or executable content from a user.
 */
export type UseCaseJourney = {
  id: string;
  title: string;
  prompt: string;
  profile: WorkloadProfile;
  familyId: MergeFamilyId;
  mechanismPath: MechanismId[];
  strategy: JourneyStrategy;
  agentLog: AgentLogStep[];
  tradeoff: Tradeoff;
  guidePath: JourneyGuideStep[];
  relatedJourneyIds: string[];
};

export const USE_CASE_JOURNEYS: UseCaseJourney[] = [
  {
    id: "observability-firehose",
    title: "Sub-second observability firehose",
    prompt: "We ingest a very high volume of logs and traces and need interactive dashboards with months of retention and high availability.",
    profile: {
      workload: "observability",
      ingestRate: "extreme",
      latencyTarget: "interactive",
      retention: "months",
      updates: "append-only",
      availability: "high",
      topology: "single-region",
      costPriority: "performance",
    },
    familyId: "merge",
    mechanismPath: [
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
      "architecture.sharding",
      "architecture.replication",
      "architecture.keeper",
      "architecture.failure",
      "architecture.recovery",
      "observability.replication-queue",
      "retention.ttl-delete",
    ],
    strategy: {
      label: "Append, prune, precompute",
      readPattern: "Sparse-index pruning into dashboard materialized views.",
      latestRead: null,
      rationale: "Immutable events fit MergeTree; repeated dashboards should avoid regrouping the full history.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected an append-only telemetry firehose with an interactive read target." },
      { stage: "route", message: "Route independent writers through an async buffer to control part creation." },
      { stage: "decide", message: "Keep raw events in MergeTree and precompute the repeated dashboard grain." },
      { stage: "tradeoff", message: "Spend write work and storage to make common dashboards predictable." },
      { stage: "guide", message: "Follow the stream from buffer to parts, pruning, rollups, replicas, and expiry." },
    ],
    tradeoff: { benefit: "Predictable interactive dashboards at sustained ingest.", cost: "More storage, background work, and recovery testing." },
    guidePath: [
      { id: "obs-ingest", phase: "ingestion", title: "Absorb the burst", narration: "Writers pool rows before a flush creates a part.", mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation", productionEvidenceId: "mercado-libre-o11y" },
      { id: "obs-tree", phase: "storage", title: "Route immutable event parts", narration: "MergeTree keeps the raw event history simple and sortable.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "polymarket-realtime-analytics", familyId: "merge" },
      { id: "obs-read", phase: "read", title: "Skip cold ranges", narration: "Marks and selected columns prevent unnecessary reads.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "obs-rollup", phase: "precompute", title: "Maintain dashboard grain", narration: "A materialized view incrementally prepares repeated aggregates.", mechanismId: "precompute.materialized-view", evidenceId: "clickhouse-internal", productionEvidenceId: "cloudflare-http-analytics" },
      { id: "obs-scale", phase: "architecture", title: "Divide and survive", narration: "Replicated shards add capacity and a tested failure boundary.", mechanismId: "architecture.sharding", evidenceId: "cloudflare", productionEvidenceId: "openai-observability" },
      { id: "obs-expire", phase: "retention", title: "Shed old telemetry", narration: "TTL removes expired ranges through background lifecycle work.", mechanismId: "retention.ttl-delete", evidenceId: "netflix", productionEvidenceId: "dash0-otel-observability" },
    ],
    relatedJourneyIds: ["aggregate-state-rollups", "multi-region-product-analytics"],
  },
  {
    id: "postgres-cdc-latest-state",
    title: "PostgreSQL CDC with upserts",
    prompt: "Mirror PostgreSQL changes into ClickHouse, deduplicate retries, and serve the latest row without rewriting history in place.",
    profile: {
      workload: "cdc",
      ingestRate: "high",
      latencyTarget: "interactive",
      retention: "months",
      updates: "frequent",
      availability: "standard",
      topology: "single-region",
      costPriority: "balanced",
    },
    familyId: "replacing",
    mechanismPath: [
      "ingestion.clickpipes",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "mergetree.part-lifecycle",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
      "precompute.projection",
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "retention.ttl-delete",
      "retention.mutation",
      "observability.merges",
    ],
    strategy: {
      label: "Versioned replacement with argMax",
      readPattern: "Use argMax at stable aggregation boundaries; reserve FINAL for bounded correctness-sensitive reads.",
      latestRead: "argmax",
      rationale: "Appended versions match CDC, while argMax makes the winning version explicit before background merges converge.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected ordered CDC envelopes, retry duplicates, and frequent logical updates." },
      { stage: "route", message: "Use a managed source checkpoint and preserve a meaningful version." },
      { stage: "decide", message: "Choose ReplacingMergeTree and make latest-state reads explicit with argMax." },
      { stage: "tradeoff", message: "Old versions can coexist until background merges; correctness belongs at the read boundary." },
      { stage: "guide", message: "Trace one change from source checkpoint to version pruning and latest-state lookup." },
    ],
    tradeoff: { benefit: "Retry-tolerant ingestion and explicit latest-state semantics.", cost: "Queries must handle versions until merges converge." },
    guidePath: [
      { id: "cdc-ingest", phase: "ingestion", title: "Checkpoint the source", narration: "ClickPipes carries ordered change envelopes into ClickHouse.", mechanismId: "ingestion.clickpipes", evidenceId: "seemplicity", productionEvidenceId: "seemplicity-postgres-cdc" },
      { id: "cdc-tree", phase: "storage", title: "Sort the version candidates", narration: "ReplacingMergeTree keeps the highest intended version per sorting key.", mechanismId: "mergetree.part-anatomy", evidenceId: "seemplicity", productionEvidenceId: "common-room-customer-intelligence", familyId: "replacing" },
      { id: "cdc-read", phase: "read", title: "Ask for the winner", narration: "argMax selects the value tied to the greatest version.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "cdc-layout", phase: "precompute", title: "Maintain an alternate path", narration: "A stable projection can serve a second access pattern.", mechanismId: "precompute.projection", evidenceId: "clickhouse-internal", productionEvidenceId: "chartmetric-playlist-cache" },
      { id: "cdc-retain", phase: "retention", title: "Bound version history", narration: "TTL and carefully scheduled rewrites manage old data.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "dash0-otel-observability" },
    ],
    relatedJourneyIds: ["iot-sparse-device-state", "versioned-concurrent-events"],
  },
  {
    id: "iot-sparse-device-state",
    title: "Sparse IoT device state",
    prompt: "Sensors send partial state updates where each event changes only a few nullable fields; we need current device state and month-scale history.",
    profile: {
      workload: "iot",
      ingestRate: "high",
      latencyTarget: "seconds",
      retention: "months",
      updates: "frequent",
      availability: "standard",
      topology: "single-region",
      costPriority: "cost",
    },
    familyId: "coalescing",
    mechanismPath: [
      "ingestion.clickpipes",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "mergetree.part-lifecycle",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "retention.ttl-move",
      "retention.mutation",
      "observability.merges",
    ],
    strategy: {
      label: "Coalesce sparse state",
      readPattern: "Use FINAL for bounded current-device reads; keep broad history scans on ordinary MergeTree paths.",
      latestRead: "final",
      rationale: "CoalescingMergeTree reconstructs the latest non-null fields without requiring every event to carry a full row.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected sparse field changes rather than complete replacement rows." },
      { stage: "route", message: "Carry device events through a checkpointed stream and retain event order." },
      { stage: "decide", message: "Choose CoalescingMergeTree and use FINAL only for bounded current-state lookups." },
      { stage: "tradeoff", message: "Null semantics become part of the data model and must be tested explicitly." },
      { stage: "guide", message: "Watch sparse field fragments assemble, then move aged history to a cheaper tier." },
    ],
    tradeoff: { benefit: "Compact sparse updates reconstruct current state.", cost: "Null meaning and query-time convergence require deliberate modeling." },
    guidePath: [
      { id: "iot-ingest", phase: "ingestion", title: "Receive partial readings", narration: "The stream preserves each device update envelope.", mechanismId: "ingestion.clickpipes", evidenceId: "emq", productionEvidenceId: "emq-industrial-iot" },
      { id: "iot-tree", phase: "storage", title: "Assemble the sparse mosaic", narration: "CoalescingMergeTree combines the latest non-null field fragments.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: null, familyId: "coalescing" },
      { id: "iot-read", phase: "read", title: "Resolve current state", narration: "A bounded FINAL read applies merge semantics before display.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "iot-retain", phase: "retention", title: "Cool the history", narration: "TTL moves older device events to a lower-cost tier.", mechanismId: "retention.ttl-move", evidenceId: "clickhouse-internal", productionEvidenceId: "critical-manufacturing-factory" },
    ],
    relatedJourneyIds: ["postgres-cdc-latest-state", "long-retention-cost-control"],
  },
  {
    id: "product-analytics-events",
    title: "Interactive product analytics",
    prompt: "Capture append-only product events and keep funnels and cohort dashboards interactive across several months.",
    profile: {
      workload: "product-analytics",
      ingestRate: "high",
      latencyTarget: "interactive",
      retention: "months",
      updates: "append-only",
      availability: "standard",
      topology: "single-region",
      costPriority: "performance",
    },
    familyId: "merge",
    mechanismPath: [
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
      "retention.ttl-delete",
    ],
    strategy: {
      label: "Raw events plus incremental funnels",
      readPattern: "Filter by product dimensions and time, then read maintained dashboard aggregates.",
      latestRead: null,
      rationale: "A simple MergeTree preserves drill-down detail while materialized views accelerate stable questions.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected append-only events with repeated funnel and cohort questions." },
      { stage: "route", message: "Batch independent producers so events do not become tiny parts." },
      { stage: "decide", message: "Keep raw MergeTree events and incrementally maintain common funnel grains." },
      { stage: "tradeoff", message: "Every maintained view adds insert and backfill work." },
      { stage: "guide", message: "Follow a click from ingest to raw event, skipped ranges, and funnel output." },
    ],
    tradeoff: { benefit: "Fast dashboards without sacrificing raw-event drill-down.", cost: "Materialized views require explicit targets, backfills, and monitoring." },
    guidePath: [
      { id: "product-ingest", phase: "ingestion", title: "Batch product events", narration: "The buffer groups concurrent producers into healthy flushes.", mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation", productionEvidenceId: "mercado-libre-o11y" },
      { id: "product-tree", phase: "storage", title: "Keep the clickstream ordered", narration: "MergeTree stores immutable product facts in useful order.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "polymarket-realtime-analytics", familyId: "merge" },
      { id: "product-read", phase: "read", title: "Filter the cohort window", narration: "The sparse index avoids unrelated products and time ranges.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "product-funnel", phase: "precompute", title: "Maintain funnel grain", narration: "A materialized view updates the repeated result as events arrive.", mechanismId: "precompute.materialized-view", evidenceId: "rill", productionEvidenceId: "cloudflare-http-analytics" },
      { id: "product-expire", phase: "retention", title: "Expire old events", narration: "TTL bounds raw history after the chosen retention window.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "replo-live-campaign-analytics" },
    ],
    relatedJourneyIds: ["aggregate-state-rollups", "multi-region-product-analytics"],
  },
  {
    id: "billing-additive-counters",
    title: "Billing and additive counters",
    prompt: "Roll up additive usage counters by customer and period while preserving correctness before background merges finish.",
    profile: {
      workload: "financial",
      ingestRate: "medium",
      latencyTarget: "seconds",
      retention: "years",
      updates: "occasional",
      availability: "standard",
      topology: "single-region",
      costPriority: "balanced",
    },
    familyId: "summing",
    mechanismPath: [
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
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "retention.ttl-delete",
    ],
    strategy: {
      label: "Merge additive counters",
      readPattern: "Still sum matching keys at read time until background part merges converge.",
      latestRead: null,
      rationale: "SummingMergeTree reduces additive rows during merges but should not be treated as an immediately finalized total.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected additive usage deltas grouped by a stable billing key." },
      { stage: "route", message: "Buffer usage deltas into healthy immutable parts." },
      { stage: "decide", message: "Choose SummingMergeTree and keep a final sum in the read contract." },
      { stage: "tradeoff", message: "Storage converges in the background, so unmerged rows remain query-visible." },
      { stage: "guide", message: "Watch equal-key counters accumulate, then verify the read still totals every visible row." },
    ],
    tradeoff: { benefit: "Background merges compact additive counters.", cost: "Queries must aggregate correctly across unmerged parts." },
    guidePath: [
      { id: "billing-ingest", phase: "ingestion", title: "Pool usage deltas", narration: "Async buffering prevents a part for every tiny counter update.", mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation", productionEvidenceId: "mercado-libre-o11y" },
      { id: "billing-tree", phase: "storage", title: "Press equal-key counters", narration: "SummingMergeTree combines numeric values with the same sorting key.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "highlevel-notifications-analytics", familyId: "summing" },
      { id: "billing-read", phase: "read", title: "Total visible rows", narration: "The read remains correct before and after background consolidation.", mechanismId: "read.sparse-index", evidenceId: "qrt", productionEvidenceId: "ramp-spend-analytics" },
      { id: "billing-retain", phase: "retention", title: "Close the retention window", narration: "TTL enforces the policy without emergency bulk deletes.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "clever-observability-retention" },
    ],
    relatedJourneyIds: ["aggregate-state-rollups", "collapsing-cancel-pairs"],
  },
  {
    id: "aggregate-state-rollups",
    title: "Mergeable quantiles and uniques",
    prompt: "Precompute unique users and latency quantiles for interactive analytics without prematurely finalizing aggregate results.",
    profile: {
      workload: "product-analytics",
      ingestRate: "high",
      latencyTarget: "interactive",
      retention: "years",
      updates: "append-only",
      availability: "standard",
      topology: "single-region",
      costPriority: "performance",
    },
    familyId: "aggregating",
    mechanismPath: [
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
      "retention.ttl-delete",
    ],
    strategy: {
      label: "Preserve mergeable aggregate state",
      readPattern: "Store aggregate states in the view target and apply matching merge/finalize functions at read time.",
      latestRead: null,
      rationale: "AggregatingMergeTree can combine uniq and quantile states across parts without losing their merge semantics.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected non-additive aggregates that must remain mergeable across batches." },
      { stage: "route", message: "Feed stable event batches into an incremental aggregate-state view." },
      { stage: "decide", message: "Choose AggregatingMergeTree rather than storing prematurely finalized numbers." },
      { stage: "tradeoff", message: "State types and matching merge functions become part of the schema contract." },
      { stage: "guide", message: "Follow aggregate-state capsules as they combine and finalize only at the result boundary." },
    ],
    tradeoff: { benefit: "Large histories answer quantile and unique queries from compact mergeable states.", cost: "State types, combinators, and backfills are more specialized." },
    guidePath: [
      { id: "aggregate-ingest", phase: "ingestion", title: "Batch raw observations", narration: "The buffer delivers events in groups suitable for view updates.", mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation", productionEvidenceId: "mercado-libre-o11y" },
      { id: "aggregate-tree", phase: "storage", title: "Preserve mergeable states", narration: "AggregatingMergeTree keeps mergeable state rather than a frozen answer.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "dash0-otel-observability", familyId: "aggregating" },
      { id: "aggregate-read", phase: "read", title: "Filter the requested window", narration: "Only relevant ranges and columns reach the final merge step.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "aggregate-view", phase: "precompute", title: "Update states on arrival", narration: "A materialized view writes mergeable states into its target.", mechanismId: "precompute.materialized-view", evidenceId: "rill", productionEvidenceId: "cloudflare-http-analytics" },
      { id: "aggregate-retain", phase: "retention", title: "Bound raw history", narration: "TTL can age raw detail while retained states serve longer horizons.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "dash0-otel-observability" },
    ],
    relatedJourneyIds: ["observability-firehose", "billing-additive-counters"],
  },
  {
    id: "collapsing-cancel-pairs",
    title: "Explicit cancel and delete pairs",
    prompt: "Our producer can emit a positive state row and a matching negative cancellation for updates and deletes.",
    profile: {
      workload: "cdc",
      ingestRate: "medium",
      latencyTarget: "seconds",
      retention: "months",
      updates: "frequent",
      availability: "standard",
      topology: "single-region",
      costPriority: "balanced",
    },
    familyId: "collapsing",
    mechanismPath: [
      "ingestion.clickpipes",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "mergetree.part-lifecycle",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "retention.ttl-delete",
      "retention.mutation",
      "observability.merges",
    ],
    strategy: {
      label: "Sign-aware collapse",
      readPattern: "Aggregate with the sign column so reads remain correct while opposite rows await a merge.",
      latestRead: null,
      rationale: "CollapsingMergeTree fits only when the producer can reliably emit balanced state and cancel rows.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected a producer-owned +1/−1 state transition contract." },
      { stage: "route", message: "Preserve event order and validate every cancellation pair at ingestion." },
      { stage: "decide", message: "Choose CollapsingMergeTree and make sign-aware reads part of the API." },
      { stage: "tradeoff", message: "A missing, duplicated, or reordered sign pair is harder to repair than replacement versions." },
      { stage: "guide", message: "Watch opposite signs meet, then inspect the safe pre-merge read." },
    ],
    tradeoff: { benefit: "Updates and deletes remain insert-oriented.", cost: "Correctness depends on balanced producer-generated sign pairs." },
    guidePath: [
      { id: "collapse-ingest", phase: "ingestion", title: "Carry the signed event", narration: "The stream preserves state and cancellation envelopes.", mechanismId: "ingestion.clickpipes", evidenceId: "seemplicity", productionEvidenceId: "seemplicity-postgres-cdc" },
      { id: "collapse-tree", phase: "storage", title: "Pair opposite signs", narration: "CollapsingMergeTree removes balanced state and cancel rows during merges.", mechanismId: "mergetree.part-anatomy", evidenceId: "seemplicity", productionEvidenceId: "reco-security-state", familyId: "collapsing" },
      { id: "collapse-read", phase: "read", title: "Respect the sign", narration: "Sign-aware aggregation stays correct before physical collapse.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "collapse-retain", phase: "retention", title: "Schedule exceptional rewrites", narration: "Mutations remain heavy repair tools rather than the normal update path.", mechanismId: "retention.mutation", evidenceId: "clickhouse-internal", productionEvidenceId: "reco-security-state" },
    ],
    relatedJourneyIds: ["versioned-concurrent-events", "postgres-cdc-latest-state"],
  },
  {
    id: "versioned-concurrent-events",
    title: "Concurrent versioned cancellations",
    prompt: "Several producers can send state and cancel rows out of order, but each event has a monotonic version and sign.",
    profile: {
      workload: "cdc",
      ingestRate: "high",
      latencyTarget: "seconds",
      retention: "years",
      updates: "frequent",
      availability: "high",
      topology: "single-region",
      costPriority: "balanced",
    },
    familyId: "versioned-collapsing",
    mechanismPath: [
      "ingestion.clickpipes",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "mergetree.part-lifecycle",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
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
      "retention.mutation",
      "observability.merges",
    ],
    strategy: {
      label: "Versioned sign-aware collapse",
      readPattern: "Filter and aggregate by sign while retaining producer versions for correct out-of-order pairing.",
      latestRead: null,
      rationale: "VersionedCollapsingMergeTree adds ordering information when concurrency makes plain collapsing ambiguous.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected balanced signs from concurrent producers with meaningful versions." },
      { stage: "route", message: "Checkpoint the stream without discarding producer version metadata." },
      { stage: "decide", message: "Choose VersionedCollapsingMergeTree and replicate the high-availability path." },
      { stage: "tradeoff", message: "The model is more complex than replacement and needs strict producer invariants." },
      { stage: "guide", message: "Follow out-of-order versioned pairs through matching, replication, failure, and recovery." },
    ],
    tradeoff: { benefit: "Concurrent, out-of-order cancel pairs can converge by version.", cost: "Both sign and version correctness move into the producer contract." },
    guidePath: [
      { id: "versioned-ingest", phase: "ingestion", title: "Retain the version", narration: "The stream carries sign and version together.", mechanismId: "ingestion.clickpipes", evidenceId: "seemplicity", productionEvidenceId: "seemplicity-postgres-cdc" },
      { id: "versioned-tree", phase: "storage", title: "Match the versioned pairs", narration: "VersionedCollapsingMergeTree pairs the intended state transitions.", mechanismId: "mergetree.part-anatomy", evidenceId: "seemplicity", productionEvidenceId: "chartmetric-playlist-cache", familyId: "versioned-collapsing" },
      { id: "versioned-read", phase: "read", title: "Read the converging state", narration: "Sign-aware reads remain valid while parts still overlap.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "versioned-ha", phase: "architecture", title: "Replay on a replica", narration: "Replication and tested recovery protect the analytical path.", mechanismId: "architecture.replication", evidenceId: "gitlab", productionEvidenceId: "cloudflare-http-analytics" },
      { id: "versioned-retain", phase: "retention", title: "Retire old transitions", narration: "TTL bounds the historical change stream.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "dash0-otel-observability" },
    ],
    relatedJourneyIds: ["collapsing-cancel-pairs", "postgres-cdc-latest-state"],
  },
  {
    id: "multi-region-product-analytics",
    title: "Multi-region product analytics",
    prompt: "Run interactive product analytics at extreme ingest with high availability across regions and explicit failure recovery.",
    profile: {
      workload: "product-analytics",
      ingestRate: "extreme",
      latencyTarget: "interactive",
      retention: "months",
      updates: "append-only",
      availability: "high",
      topology: "multi-region",
      costPriority: "performance",
    },
    familyId: "merge",
    mechanismPath: [
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
      "architecture.sharding",
      "architecture.replication",
      "architecture.keeper",
      "architecture.failure",
      "architecture.recovery",
      "observability.replication-queue",
      "architecture.multi-region",
      "retention.ttl-delete",
    ],
    strategy: {
      label: "Local ingest, replicated shards",
      readPattern: "Prefer region-local reads and explicitly test distributed scatter, partial failure, and recovery.",
      latestRead: null,
      rationale: "Scale-out follows measured capacity; replication and Keeper coordination are distinct from the user-data path.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected extreme ingest, interactive reads, and two independent failure dimensions." },
      { stage: "route", message: "Control local part creation before distributing work across shards." },
      { stage: "decide", message: "Use replicated shards and keep Keeper physically outside the data plane." },
      { stage: "tradeoff", message: "Cross-region resilience adds latency, storage, routing, and recovery complexity." },
      { stage: "guide", message: "Follow one event through its local shard, replica bloom, region failure, and catch-up." },
    ],
    tradeoff: { benefit: "Capacity and availability span multiple failure domains.", cost: "Cross-region operations are expensive and must be rehearsed." },
    guidePath: [
      { id: "region-ingest", phase: "ingestion", title: "Control the local flush", narration: "Async buffering prevents source fan-out from flooding the part graph.", mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation", productionEvidenceId: "mercado-libre-o11y" },
      { id: "region-tree", phase: "storage", title: "Keep immutable local facts", narration: "MergeTree remains the storage primitive inside each shard.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "polymarket-realtime-analytics", familyId: "merge" },
      { id: "region-read", phase: "read", title: "Filter before scatter", narration: "Good ordering reduces work before distributed gathering.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "region-view", phase: "precompute", title: "Precompute stable questions", narration: "A materialized view reduces repeated cross-shard aggregation.", mechanismId: "precompute.materialized-view", evidenceId: "rill", productionEvidenceId: "cloudflare-http-analytics" },
      { id: "region-ha", phase: "architecture", title: "Route, fail, recover", narration: "Replicated shards reroute traffic while Keeper coordinates metadata only.", mechanismId: "architecture.sharding", evidenceId: "cloudflare", productionEvidenceId: "openai-observability" },
      { id: "region-cross", phase: "architecture", title: "Cross the regional seam", narration: "Keep reads local where possible; make cross-region latency, routing, and recovery explicit.", mechanismId: "architecture.multi-region", evidenceId: "seemplicity", productionEvidenceId: "seemplicity-postgres-cdc" },
      { id: "region-retain", phase: "retention", title: "Expire every copy", narration: "TTL policy is verified consistently across replicas.", mechanismId: "retention.ttl-delete", evidenceId: "clickhouse-internal", productionEvidenceId: "clever-observability-retention" },
    ],
    relatedJourneyIds: ["observability-firehose", "product-analytics-events"],
  },
  {
    id: "long-retention-cost-control",
    title: "Long-retention cost control",
    prompt: "Keep append-only analytical history for years, accept batch reads, and move older data to a cheaper tier without a backend service.",
    profile: {
      workload: "general",
      ingestRate: "low",
      latencyTarget: "batch",
      retention: "years",
      updates: "append-only",
      availability: "standard",
      topology: "single-region",
      costPriority: "cost",
    },
    familyId: "merge",
    mechanismPath: [
      "ingestion.client-batching",
      "mergetree.parts-pressure",
      "mergetree.partition-boundary",
      "mergetree.part-anatomy",
      "read.ordering",
      "read.sparse-index",
      "read.granules",
      "read.saved-work",
      "read.column-pruning",
      "execution.explain-plan",
      "execution.sort-aggregate",
      "memory.memory-tracker",
      "memory.external-spill",
      "observability.processes",
      "retention.ttl-move",
    ],
    strategy: {
      label: "Simple parts with tiered TTL",
      readPattern: "Use ordinary sparse-index reads and accept slower access after old parts move to cold storage.",
      latestRead: null,
      rationale: "Low-rate append-only history does not need a specialized family; lifecycle policy delivers the cost win.",
    },
    agentLog: [
      { stage: "interpret", message: "Detected low-rate immutable history with a cost-first batch-read target." },
      { stage: "route", message: "Create healthy client batches rather than enabling unnecessary streaming machinery." },
      { stage: "decide", message: "Use plain MergeTree and move aged parts with TTL." },
      { stage: "tradeoff", message: "Cold reads become slower and TTL execution remains asynchronous." },
      { stage: "guide", message: "Follow one batch into a part, through pruning, and down to cold storage." },
    ],
    tradeoff: { benefit: "Years of history remain queryable at lower storage cost.", cost: "Cold access slows down and lifecycle work competes with merges." },
    guidePath: [
      { id: "retention-ingest", phase: "ingestion", title: "Send one useful batch", narration: "The client groups rows before inserting.", mechanismId: "ingestion.client-batching", evidenceId: "ly-corporation", productionEvidenceId: "netflix-logging" },
      { id: "retention-tree", phase: "storage", title: "Keep the raw history", narration: "MergeTree stores the append-only archive without extra semantics.", mechanismId: "mergetree.part-anatomy", evidenceId: "netflix", productionEvidenceId: "polymarket-realtime-analytics", familyId: "merge" },
      { id: "retention-read", phase: "read", title: "Skip unrelated history", narration: "The sparse index narrows even a long time horizon.", mechanismId: "read.sparse-index", evidenceId: "cloudflare", productionEvidenceId: "ramp-spend-analytics" },
      { id: "retention-cold", phase: "retention", title: "Move the old layer", narration: "TTL transfers aged parts to the configured lower-cost volume.", mechanismId: "retention.ttl-move", evidenceId: "clickhouse-internal", productionEvidenceId: "netflix-logging" },
    ],
    relatedJourneyIds: ["iot-sparse-device-state", "observability-firehose"],
  },
];

export function useCaseJourneyById(id: string) {
  return USE_CASE_JOURNEYS.find((journey) => journey.id === id);
}

/**
 * Resolve one guide step into the complete state consumed by the visible world.
 * Keeping this deterministic prevents the picker and WebMCP entry point from
 * drifting, and prevents a previous journey's read strategy from leaking in.
 */
export function resolveJourneyGuideStep(
  journey: UseCaseJourney,
  requestedIndex: number,
): ResolvedJourneyGuideStep {
  const index = Math.max(0, Math.min(journey.guidePath.length - 1, requestedIndex));
  const step = journey.guidePath[index];
  return {
    index,
    step,
    familyId: step.familyId ?? journey.familyId,
    latestReadStrategy: journey.strategy.latestRead ?? "background",
    mechanismId: step.mechanismId,
    evidenceId: step.evidenceId,
  };
}

/**
 * Connect the concise reasoning trace to the nearest visual proof in a guide.
 * Interpretation and routing both restart at ingestion because the world has no
 * pre-ingest scene; the remaining stages advance through the chosen storage family, its
 * first downstream consequence, and the final system outcome.
 */
export function resolveAgentLogGuideIndex(
  journey: UseCaseJourney,
  requestedLogIndex: number,
) {
  const logIndex = Math.max(0, Math.min(journey.agentLog.length - 1, requestedLogIndex));
  const stage = journey.agentLog[logIndex]?.stage ?? "interpret";
  const lastIndex = Math.max(0, journey.guidePath.length - 1);
  const storageIndex = Math.max(0, journey.guidePath.findIndex((step) => step.phase === "storage"));
  const downstreamIndex = journey.guidePath.findIndex(
    (step, index) => index > storageIndex && step.phase !== "storage",
  );

  switch (stage) {
    case "interpret":
    case "route":
      return 0;
    case "decide":
      return storageIndex;
    case "tradeoff":
      return downstreamIndex >= 0 ? downstreamIndex : lastIndex;
    case "guide":
      return lastIndex;
  }
}

export function resolveActiveAgentLogIndex(
  journey: UseCaseJourney,
  requestedGuideIndex: number,
) {
  const guideIndex = resolveJourneyGuideStep(journey, requestedGuideIndex).index;
  let activeIndex = 0;

  for (let logIndex = 0; logIndex < journey.agentLog.length; logIndex += 1) {
    if (resolveAgentLogGuideIndex(journey, logIndex) <= guideIndex) activeIndex = logIndex;
  }

  return activeIndex;
}

export function nearestUseCaseJourney(profile: WorkloadProfile) {
  const weights: Array<[keyof WorkloadProfile, number]> = [
    ["workload", 8],
    ["updates", 6],
    ["latencyTarget", 4],
    ["ingestRate", 3],
    ["availability", 3],
    ["topology", 3],
    ["retention", 2],
    ["costPriority", 2],
  ];
  return [...USE_CASE_JOURNEYS].sort((left, right) => {
    const score = (journey: UseCaseJourney) => weights.reduce((total, [key, weight]) => total + (journey.profile[key] === profile[key] ? weight : 0), 0);
    return score(right) - score(left) || left.id.localeCompare(right.id);
  })[0];
}
