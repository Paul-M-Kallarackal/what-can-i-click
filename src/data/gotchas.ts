import type {
  GotchaBeat,
  GotchaBeatKind,
  GotchaId,
  GotchaRecommendation,
  GotchaStory,
  WorkloadProfile,
} from "../types";

export const COMMON_MISTAKES_URL = "https://clickhouse.com/blog/common-getting-started-issues-with-clickhouse";

const camera = (x = 0, y = 2.35, z = 0): GotchaBeat["cameraPose"] => ({
  position: [10.9 + x, 7.8, 15.6],
  target: [x, y, z],
  zoom: 35,
});

const beat = (
  kind: GotchaBeatKind,
  heading: string,
  narration: string,
  guidance: string,
  productionCheck: string,
  metrics: GotchaBeat["metrics"],
  legend: GotchaBeat["legend"],
  eventIds: string[],
  pose = camera(),
): GotchaBeat => ({ kind, heading, narration, guidance, productionCheck, metrics, legend, eventIds, cameraPose: pose });

const yellow = "#FFCC01";
const cyan = "#78D7D2";
const red = "#D64C3F";
const black = "#15171A";
const white = "#F3F2EC";

export const GOTCHA_STORIES: GotchaStory[] = [
  {
    id: "parts-pressure",
    index: 1,
    category: "Ingestion",
    title: "Too many parts",
    summary: "Small writes or excessive partition fan-out create parts faster than ClickHouse can merge them.",
    consequence: "Insert latency rises while the merge queue keeps growing.",
    sourceSectionNumbers: [1, 12],
    primaryMechanismId: "mergetree.parts-pressure",
    mechanismIds: ["ingestion.async-buffer", "mergetree.partition-boundary", "mergetree.parts-pressure", "precompute.write-amplification"],
    evidenceIds: ["common-mistakes", "docs-async-inserts", "docs-partitioning-key", "docs-part-log", "docs-system-merges"],
    sourceUrl: `${COMMON_MISTAKES_URL}#1-too-many-parts`,
    tradeoff: "Larger batches reduce part pressure but add buffering latency; async acknowledgement settings also change durability semantics.",
    reducedMotionSummary: "The buffer, partition gate, part queue, and healthy merged output switch between four labeled states without continuous motion.",
    beats: [
      beat("cause", "Tiny writes bypass the healthy buffer", "Each undersized flush creates one immutable part per partition touched. Materialized-view fan-out can multiply that work.", "Batch at the client or enable asynchronous inserts with durable acknowledgement. Keep partitions tied to lifecycle operations, not high-cardinality identifiers.", "Measure rows per insert and partitions touched per flush.", [
        { label: "Rows / flush", value: "tiny", tone: "warning" }, { label: "Partitions / flush", value: "many", tone: "warning" }, { label: "Async buffer", value: "bypassed", tone: "warning" },
      ], [{ label: "Incoming rows", color: cyan }, { label: "New parts", color: red }, { label: "Mergeable part", color: yellow }], ["rows-arrive", "flush-small", "partition-fanout"], camera(-0.4)),
      beat("impact", "Part creation outruns consolidation", "The active-part queue expands faster than compatible background merges can retire source parts.", "Do not raise part-count limits as the primary fix; that moves the alarm while metadata and background work continue to grow.", "Watch active-part trend and merge backlog together.", [
        { label: "Active parts", value: "rising", tone: "warning" }, { label: "Merge queue", value: "behind", tone: "warning" }, { label: "Insert state", value: "throttling", tone: "warning" },
      ], [{ label: "Queued parts", color: red }, { label: "Merge worker", color: black }, { label: "Completed part", color: yellow }], ["queue-grow", "merge-slow", "insert-throttle"], camera(0.6)),
      beat("avoid", "Create fewer, useful-sized parts", "The async buffer measures compatible rows into blocks; a coarse partition gate keeps each flush inside a small number of merge pools.", "Coordinate client batches, use async inserts when writers cannot coordinate, and consolidate redundant incremental views.", "Confirm acknowledgement behavior under retries and failures.", [
        { label: "Rows / flush", value: "batched", tone: "good" }, { label: "Partitions / flush", value: "bounded", tone: "good" }, { label: "Part trend", value: "stable", tone: "good" },
      ], [{ label: "Buffered rows", color: cyan }, { label: "Useful part", color: yellow }, { label: "Partition gate", color: black }], ["buffer-fill", "bounded-flush", "merge-catch-up"], camera(-0.2)),
      beat("verify", "Prove merges can keep pace", "The machine is healthy only when new parts remain bounded and background work returns to baseline after a burst.", "Use system.parts for current state, system.part_log for history, and system.merges for active work.", "Run a production-shaped ingest burst and confirm recovery rather than checking an idle snapshot.", [
        { label: "system.parts", value: "bounded", tone: "good" }, { label: "part_log", value: "review", tone: "neutral" }, { label: "Merge backlog", value: "recovers", tone: "good" },
      ], [{ label: "Active", color: yellow }, { label: "Inactive", color: white }, { label: "Evidence", color: cyan }], ["sample-parts", "read-part-log", "confirm-recovery"], camera(0.2)),
    ],
  },
  {
    id: "scale-coordination",
    index: 2,
    category: "Architecture",
    title: "Scale and coordination",
    summary: "Sharding too early adds routing and network work; losing Keeper quorum locks replicated writes.",
    consequence: "A workload that fit one machine becomes a distributed-systems problem.",
    sourceSectionNumbers: [2, 10],
    primaryMechanismId: "architecture.vertical-scaling",
    mechanismIds: ["architecture.vertical-scaling", "architecture.sharding", "architecture.distributed-query", "architecture.replication", "architecture.keeper", "architecture.failure"],
    evidenceIds: ["common-mistakes", "docs-replication", "docs-keeper", "docs-readonly-tables"],
    sourceUrl: `${COMMON_MISTAKES_URL}#2-going-horizontal-too-early`,
    tradeoff: "Shards add capacity, but routing, skew, network transfer, rebalancing, and coordination become permanent operational concerns.",
    reducedMotionSummary: "One compute lane switches to three labeled shard lanes; Keeper votes and replica availability change discretely.",
    beats: [
      beat("cause", "Capacity is divided before it is exhausted", "The same filter, sort, and aggregation work is scattered across shards even though one vertically scaled node still has headroom.", "Scale CPU, memory, and storage vertically first; shard only after measurements show a real capacity boundary.", "Compare single-node CPU saturation with cross-node bytes and coordinator time.", [
        { label: "Node headroom", value: "available", tone: "good" }, { label: "Cross-node bytes", value: "introduced", tone: "warning" }, { label: "Shard skew", value: "possible", tone: "warning" },
      ], [{ label: "Query", color: cyan }, { label: "Shard route", color: yellow }, { label: "Network", color: red }], ["single-node", "split-shards", "scatter"], camera(-0.6)),
      beat("impact", "Coordination joins the critical path", "The coordinator gathers partial results while replicas follow metadata instructions from a separate three-node Keeper quorum.", "Keep user part bytes in the data plane. Keeper stores coordination metadata, not table rows.", "Inspect shard skew, replication queues, Keeper sessions, and read-only table state.", [
        { label: "Shard routes", value: "3", tone: "neutral" }, { label: "Keeper votes", value: "3 / 3", tone: "good" }, { label: "Data via Keeper", value: "never", tone: "good" },
      ], [{ label: "Part bytes", color: yellow }, { label: "Metadata pulse", color: cyan }, { label: "Coordinator", color: black }], ["scatter", "replicate", "keeper-pulse"], camera(0.5)),
      beat("avoid", "Add replicas before unnecessary shards", "One shard can gain availability through replicas. In self-managed deployments, an isolated three-node Keeper quorum coordinates replicated tables.", "Use replicas for availability, keep shard count tied to demonstrated capacity, and distinguish Cloud-managed coordination from self-managed Keeper operations.", "Failure-test one replica and one Keeper node separately.", [
        { label: "Replica route", value: "reroutes", tone: "good" }, { label: "Keeper votes", value: "2 / 3", tone: "good" }, { label: "Writes", value: "available", tone: "good" },
      ], [{ label: "Primary route", color: yellow }, { label: "Replica route", color: cyan }, { label: "Unavailable", color: red }], ["replica-fail", "reroute", "keeper-one-down"], camera(0.9)),
      beat("verify", "Test the second failure boundary", "With a second Keeper node unavailable, quorum is lost and replicated writes become read-only even though local part bytes remain outside Keeper.", "For self-managed clusters, alert on quorum, sessions, and replication queues. In Cloud, validate the service-level availability model instead of copying self-managed topology advice.", "Remove failures, confirm sessions recover, and confirm queued replicas catch up.", [
        { label: "Keeper votes", value: "1 / 3", tone: "warning" }, { label: "Replicated writes", value: "read-only", tone: "warning" }, { label: "Local parts", value: "present", tone: "good" },
      ], [{ label: "Available", color: cyan }, { label: "No quorum", color: red }, { label: "Local data", color: yellow }], ["keeper-two-down", "writes-lock", "restore-quorum"], camera(0.8)),
    ],
  },
  {
    id: "updates-deduplication",
    index: 3,
    category: "Data model",
    title: "Updates and deduplication",
    summary: "In-place expectations collide with immutable parts, eventual replacement, and bounded retry deduplication.",
    consequence: "Rewrites spike or duplicate versions remain visible at read time.",
    sourceSectionNumbers: [3, 6],
    primaryMechanismId: "retention.patch-update",
    mechanismIds: ["retention.mutation", "retention.patch-update", "ingestion.retry-deduplication", "mergetree.part-lifecycle"],
    evidenceIds: ["common-mistakes", "docs-mutations", "docs-mergetree"],
    sourceUrl: `${COMMON_MISTAKES_URL}#3-mutations-are-slow`,
    tradeoff: "Append-version models move work from writes to correctness-aware reads; patch updates avoid broad rewrites but still require later merge work.",
    reducedMotionSummary: "The full-part rewrite, patch overlay, version stack, fingerprint gate, and read choice appear as labeled discrete states.",
    beats: [
      beat("cause", "An update targets immutable storage", "A classic mutation dismantles and rewrites complete affected parts. A retried insert may also produce a duplicate when its block identity changes or its deduplication window has passed.", "Start with append-only modeling. Choose a change mechanism only after defining the read-time correctness contract.", "Inspect affected part count, mutation scope, and retry block identity.", [
        { label: "Rewrite scope", value: "whole parts", tone: "warning" }, { label: "Retry identity", value: "must match", tone: "neutral" }, { label: "Versions", value: "coexist", tone: "neutral" },
      ], [{ label: "Base part", color: yellow }, { label: "Changed rows", color: red }, { label: "Retry fingerprint", color: cyan }], ["locate-change", "rewrite-part", "retry-block"], camera(-0.7)),
      beat("impact", "Correctness waits for a contract", "ReplacingMergeTree versions can coexist until background merges. A plain read can therefore see both old and new rows.", "Do not describe ReplacingMergeTree as immediate deduplication. Use explicit current-state reads where correctness cannot wait for merges.", "Query before and after merge convergence and compare results.", [
        { label: "Visible versions", value: "multiple", tone: "warning" }, { label: "Merge convergence", value: "background", tone: "neutral" }, { label: "Plain read", value: "not current-state", tone: "warning" },
      ], [{ label: "Old version", color: white }, { label: "New version", color: yellow }, { label: "Current read", color: cyan }], ["versions-stack", "plain-read", "merge-later"], camera(0)),
      beat("avoid", "Match the update to its real scope", "A lightweight update writes a compact patch part for changed columns. Appended versions use ReplacingMergeTree with argMax(version) or a measured, bounded FINAL read.", "Use patches for targeted changes, appended versions for CDC-style state, and broad classic mutations only as deliberately budgeted rewrites.", "When recommending lightweight deletes, surface their projection compatibility constraints for the pinned version.", [
        { label: "Patch size", value: "targeted", tone: "good" }, { label: "argMax", value: "explicit", tone: "good" }, { label: "FINAL", value: "bounded", tone: "neutral" },
      ], [{ label: "Base columns", color: yellow }, { label: "Patch overlay", color: cyan }, { label: "Broad rewrite", color: red }], ["write-patch", "overlay-read", "choose-current-state"], camera(0.3)),
      beat("verify", "Observe rewrites and duplicate visibility", "The safe choice is the one that stays correct before convergence and keeps rewrite work inside the measured budget.", "Track system.mutations, merge backlog, version ordering, duplicate visibility, and identical retry-block fingerprints.", "Replay the same block, then a semantically identical block with different identity, and confirm the expected outcome.", [
        { label: "Mutations", value: "bounded", tone: "good" }, { label: "Duplicate read", value: "tested", tone: "good" }, { label: "Version order", value: "monotonic", tone: "good" },
      ], [{ label: "Accepted", color: yellow }, { label: "Deduplicated", color: cyan }, { label: "Rewrite pressure", color: red }], ["inspect-mutations", "replay-block", "validate-current-state"], camera(0.5)),
    ],
  },
  {
    id: "read-path-surprises",
    index: 4,
    category: "Queries",
    title: "Read-path surprises",
    summary: "A poor ordering key, ineffective skipping index, or misleading LIMIT makes ClickHouse read far more than expected.",
    consequence: "A tiny result still consumes a wide scan, sort, or aggregation.",
    sourceSectionNumbers: [7, 8, 9],
    primaryMechanismId: "read.ordering",
    mechanismIds: ["read.ordering", "read.sparse-index", "read.data-skipping", "read.limit-short-circuit", "execution.explain-plan"],
    evidenceIds: ["common-mistakes", "docs-primary-index", "docs-explain"],
    sourceUrl: `${COMMON_MISTAKES_URL}#7-bad-primary-key-selection`,
    tradeoff: "One physical order cannot optimize every access path; alternate layouts improve specific reads but add storage and maintenance work.",
    reducedMotionSummary: "Rack ranges switch between skipped and read states; the LIMIT ticket appears after upstream work rather than moving continuously.",
    beats: [
      beat("cause", "The filter does not match physical order", "Matching rows are scattered across sparse-index ranges. An uncorrelated skipping index tags nearly every rack instead of eliminating work.", "Choose ORDER BY from representative equality and range filters, then validate data locality on production-shaped values.", "Use EXPLAIN indexes = 1 and record selected granules.", [
        { label: "Granules selected", value: "most", tone: "warning" }, { label: "Skip-index hits", value: "weak", tone: "warning" }, { label: "Columns read", value: "wide", tone: "warning" },
      ], [{ label: "Skipped", color: white }, { label: "Read", color: red }, { label: "Query beam", color: cyan }], ["predicate", "mark-scan", "broad-read"], camera(-0.5)),
      beat("impact", "LIMIT controls output, not always input", "A LIMIT 10 ticket arrives at the output while an upstream sort, aggregation, or distributed top-N may still consume the full selected input.", "Treat LIMIT as an early-stop optimization only when the plan can stream the required order and terminate safely.", "Inspect EXPLAIN PIPELINE and rows read, not only rows returned.", [
        { label: "Rows returned", value: "10", tone: "neutral" }, { label: "Rows read", value: "many", tone: "warning" }, { label: "Upstream sort", value: "active", tone: "warning" },
      ], [{ label: "Full input", color: red }, { label: "Top-N output", color: yellow }, { label: "Pipeline", color: cyan }], ["scan-input", "sort-all", "emit-limit"], camera(0.4)),
      beat("avoid", "Make the access path visible", "A workload-aligned ordering lets the cyan query beam skip whole rack ranges. A projection or materialized view can serve an important alternate path.", "Use skipping indexes only when measured correlation eliminates granules; do not stack indexes as decoration.", "Compare base, projection, and view plans with the same query and data distribution.", [
        { label: "Granules selected", value: "few", tone: "good" }, { label: "Column pruning", value: "active", tone: "good" }, { label: "Early stop", value: "plan-dependent", tone: "neutral" },
      ], [{ label: "Skipped racks", color: white }, { label: "Selected racks", color: yellow }, { label: "Query", color: cyan }], ["align-order", "skip-ranges", "prune-columns"], camera(-0.1)),
      beat("verify", "Measure avoided work", "The useful number is not result size; it is the granules, rows, and bytes ClickHouse avoided reading before the result was formed.", "Use EXPLAIN indexes, EXPLAIN PIPELINE, query-log rows and bytes, and a production-shaped point-lookup benchmark.", "Verify distributed top-N on every shard plus coordinator gather.", [
        { label: "Granules", value: "counted", tone: "good" }, { label: "Rows / bytes", value: "measured", tone: "good" }, { label: "Shard top-N", value: "verified", tone: "good" },
      ], [{ label: "Avoided work", color: white }, { label: "Actual read", color: yellow }, { label: "Evidence", color: cyan }], ["explain-indexes", "explain-pipeline", "measure-read"], camera(0.2)),
    ],
  },
  {
    id: "memory-pressure",
    index: 5,
    category: "Execution",
    title: "Memory pressure",
    summary: "High-cardinality aggregates, sorts, and the wrong join build side fill memory before the query finishes.",
    consequence: "The query spills to a slower disk loop, waits, or is terminated.",
    sourceSectionNumbers: [11],
    primaryMechanismId: "memory.external-spill",
    mechanismIds: ["execution.sort-aggregate", "execution.join-strategy", "memory.memory-tracker", "memory.external-spill", "execution.workload-scheduler"],
    evidenceIds: ["common-mistakes", "docs-external-aggregation", "docs-joins", "docs-workload-scheduling", "docs-memory-overcommit"],
    sourceUrl: `${COMMON_MISTAKES_URL}#11-memory-limit-exceeded-for-query`,
    tradeoff: "External processing protects availability but is intentionally slower; precomputation and smaller join inputs trade storage or modeling effort for predictable memory.",
    reducedMotionSummary: "The memory vessel, disk spill route, join reservoir, and scheduler queue change between four labeled fill levels.",
    beats: [
      beat("cause", "State cardinality fills the vessel", "Every distinct aggregate key consumes state. A hash join also builds its right-side input into a visible memory reservoir.", "Filter early, reduce grouping dimensions, and put the smaller suitable table on the join build side.", "Record group cardinality and both join input sizes.", [
        { label: "Aggregate states", value: "high", tone: "warning" }, { label: "Join build side", value: "large", tone: "warning" }, { label: "Memory vessel", value: "filling", tone: "warning" },
      ], [{ label: "State", color: yellow }, { label: "Join reservoir", color: cyan }, { label: "Memory limit", color: red }], ["group-grow", "build-hash", "approach-limit"], camera(-0.5)),
      beat("impact", "Protection opens a slower route", "At the configured threshold, external aggregation or sorting writes temporary runs to disk. Overcommitted heavy work may wait or be terminated.", "Treat spill as a safety valve, not an acceleration technique.", "Correlate query-log peak memory with temporary disk I/O and concurrency.", [
        { label: "Memory mode", value: "external", tone: "warning" }, { label: "Disk loop", value: "active", tone: "warning" }, { label: "Heavy query", value: "waiting", tone: "warning" },
      ], [{ label: "Memory path", color: yellow }, { label: "Disk spill", color: red }, { label: "Small queries", color: cyan }], ["spill-open", "write-runs", "scheduler-wait"], camera(0.4)),
      beat("avoid", "Choose a bounded execution route", "Repeated aggregates move to precomputed states. Joins choose hash, grace-hash, sort-merge, or direct lookup according to input shape and dictionaries.", "Benchmark the algorithm with realistic cardinality and concurrency; do not select from a name alone.", "Confirm smaller queries retain latency while the heavy query is active.", [
        { label: "Grouping", value: "reduced", tone: "good" }, { label: "Join route", value: "bounded", tone: "good" }, { label: "Scheduler", value: "fair", tone: "good" },
      ], [{ label: "Hash", color: yellow }, { label: "Grace / sort", color: cyan }, { label: "Direct", color: black }], ["filter-early", "choose-join", "schedule-fairly"], camera(0)),
      beat("verify", "Test peak memory under concurrency", "A query that fits alone can still fail when several copies run together. The production check includes peak memory, spill activation, latency, and concurrent workload behavior.", "Use query_log memory_usage, temporary I/O counters, and workload-scheduler observations.", "Test both the common query and the worst allowed shape at expected concurrency.", [
        { label: "Peak memory", value: "measured", tone: "good" }, { label: "Temporary I/O", value: "measured", tone: "good" }, { label: "Concurrency", value: "tested", tone: "good" },
      ], [{ label: "Within budget", color: yellow }, { label: "Spill", color: red }, { label: "Queued safely", color: cyan }], ["measure-peak", "measure-spill", "load-test"], camera(0.2)),
    ],
  },
  {
    id: "materialized-view-traps",
    index: 6,
    category: "Precompute",
    title: "Materialized-view traps",
    summary: "Incremental views run on inserted blocks, multiply write work, and do not replay source mutations.",
    consequence: "The target drifts or ingestion slows while the view appears healthy.",
    sourceSectionNumbers: [12],
    primaryMechanismId: "precompute.materialized-view",
    mechanismIds: ["precompute.materialized-view", "precompute.refreshable-view", "precompute.aggregate-states", "precompute.write-amplification"],
    evidenceIds: ["common-mistakes", "docs-materialized-views", "docs-projections"],
    sourceUrl: `${COMMON_MISTAKES_URL}#12-materialized-views`,
    tradeoff: "Incremental views buy near-real-time reads with insert-time work and target lifecycle complexity; refreshable views trade freshness for periodic full recomputation.",
    reducedMotionSummary: "The source socket, view fan-out, bypassed mutation, refresh cycle, and rejected target contract switch discretely.",
    beats: [
      beat("cause", "Every insert triggers attached transforms", "One source block immediately creates a transformed target part. Multiple attached views fan out from the same insert.", "Choose each view for a measured repeated read path and consolidate redundant transforms.", "Measure insert latency and target parts as view count rises.", [
        { label: "Attached views", value: "many", tone: "warning" }, { label: "Target parts", value: "multiplied", tone: "warning" }, { label: "Insert work", value: "fan-out", tone: "warning" },
      ], [{ label: "Source block", color: yellow }, { label: "View transform", color: cyan }, { label: "Extra write", color: red }], ["source-insert", "fanout-views", "write-targets"], camera(-0.6)),
      beat("impact", "Source changes can bypass the target", "An incremental view processes inserted blocks; a later source mutation or partition operation does not replay that original trigger into the target.", "Treat source and target as separate tables with an explicit reconciliation and backfill process.", "Mutate a source fixture and verify whether the target changes as expected.", [
        { label: "Source mutation", value: "bypasses view", tone: "warning" }, { label: "Target state", value: "unchanged", tone: "warning" }, { label: "Reconciliation", value: "required", tone: "neutral" },
      ], [{ label: "Source", color: yellow }, { label: "Target", color: cyan }, { label: "Bypass", color: red }], ["mutate-source", "bypass-trigger", "target-drift"], camera(0.3)),
      beat("avoid", "Pick the right recomputation contract", "Incremental views transform each inserted block. Refreshable views periodically rebuild a full result. Their machines and freshness contracts stay visibly distinct.", "Use incremental for block-local near-real-time transforms; use refreshable for periodic full recomputation across changing source state.", "Align aliases, GROUP BY, ORDER BY, and target state types before loading production data.", [
        { label: "Incremental", value: "per block", tone: "good" }, { label: "Refreshable", value: "periodic", tone: "good" }, { label: "Target contract", value: "aligned", tone: "good" },
      ], [{ label: "Incremental track", color: yellow }, { label: "Refresh cycle", color: cyan }, { label: "Rejected schema", color: red }], ["choose-contract", "refresh-cycle", "validate-socket"], camera(-0.1)),
      beat("verify", "Reconcile source and target", "A production check compares source truth with the target, observes refresh status, and measures insert CPU and part creation.", "Track insert latency, target part count, refresh status, state-function CPU cost, and source/target reconciliation.", "Exercise source mutations and partition operations explicitly; do not infer trigger behavior from inserts alone.", [
        { label: "Source / target", value: "reconciled", tone: "good" }, { label: "Refresh status", value: "observed", tone: "good" }, { label: "Insert latency", value: "budgeted", tone: "good" },
      ], [{ label: "Matched", color: yellow }, { label: "Refresh", color: cyan }, { label: "Mismatch", color: red }], ["reconcile", "inspect-refresh", "measure-write-cost"], camera(0.2)),
    ],
  },
];

const storyMap = new Map(GOTCHA_STORIES.map((story) => [story.id, story]));

export function gotchaStoryById(id: string | null | undefined) {
  return id ? storyMap.get(id as GotchaId) : undefined;
}

export function gotchaBeatById(id: string | null | undefined, index: number) {
  const story = gotchaStoryById(id);
  return story?.beats[Math.min(3, Math.max(0, index))];
}

export const DEFAULT_DIAGNOSTICS = {
  deployment: "undecided",
  insertPattern: "mixed",
  queryShape: "mixed",
  partitionCardinality: "unknown",
  materializedViewFootprint: "unknown",
} as const;

export function normalizedDiagnostics(profile: WorkloadProfile) {
  return {
    deployment: profile.deployment ?? DEFAULT_DIAGNOSTICS.deployment,
    insertPattern: profile.insertPattern ?? DEFAULT_DIAGNOSTICS.insertPattern,
    queryShape: profile.queryShape ?? DEFAULT_DIAGNOSTICS.queryShape,
    partitionCardinality: profile.partitionCardinality ?? DEFAULT_DIAGNOSTICS.partitionCardinality,
    materializedViewFootprint: profile.materializedViewFootprint ?? DEFAULT_DIAGNOSTICS.materializedViewFootprint,
  };
}

export function recommendGotchaJourney(profile: WorkloadProfile): GotchaRecommendation[] {
  const diagnostics = normalizedDiagnostics(profile);
  const scores = new Map<GotchaId, number>(GOTCHA_STORIES.map((story) => [story.id, 1]));
  const add = (id: GotchaId, amount: number) => scores.set(id, (scores.get(id) ?? 0) + amount);

  if (profile.ingestRate === "high" || profile.ingestRate === "extreme") add("parts-pressure", 5);
  if (diagnostics.insertPattern === "many-small") add("parts-pressure", 7);
  if (diagnostics.partitionCardinality === "high") add("parts-pressure", 5);
  if (diagnostics.materializedViewFootprint === "many") { add("parts-pressure", 3); add("materialized-view-traps", 10); }
  if (profile.availability === "high" || profile.topology === "multi-region" || diagnostics.deployment === "self-managed") add("scale-coordination", 5);
  if (profile.updates === "frequent" || profile.workload === "cdc") add("updates-deduplication", 7);
  if (profile.updates === "occasional") add("updates-deduplication", 3);
  if (diagnostics.queryShape === "point-lookup" || diagnostics.queryShape === "range-filter" || profile.latencyTarget === "interactive") add("read-path-surprises", 5);
  if (diagnostics.queryShape === "high-cardinality-aggregate" || diagnostics.queryShape === "join-heavy") add("memory-pressure", 7);
  if (diagnostics.materializedViewFootprint === "few") add("materialized-view-traps", 3);
  if (profile.workload === "product-analytics" || profile.workload === "observability") add("materialized-view-traps", 2);

  const unknownCount = Object.values(diagnostics).filter((value) => value === "unknown" || value === "mixed" || value === "undecided").length;
  return GOTCHA_STORIES
    .slice()
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.index - b.index)
    .slice(0, Math.min(5, Math.max(3, scores.size > 4 ? 4 : 3)))
    .map((story) => ({
      gotchaId: story.id,
      whyRelevant: relevanceFor(story.id, profile, diagnostics),
      selectedVariant: variantFor(story.id, diagnostics),
      recommendation: story.beats[2].guidance,
      tradeoff: story.tradeoff,
      validationSteps: [story.beats[0].productionCheck, story.beats[3].guidance, story.beats[3].productionCheck],
      confidence: unknownCount >= 3 ? "medium" : "high",
      evidenceIds: story.evidenceIds,
    }));
}

function relevanceFor(id: GotchaId, profile: WorkloadProfile, diagnostics: ReturnType<typeof normalizedDiagnostics>) {
  const workload = profile.workload.replace("-", " ");
  if (id === "parts-pressure") return `${profile.ingestRate} ${workload} ingest with a ${diagnostics.insertPattern} insert pattern can create parts faster than merges retire them.`;
  if (id === "scale-coordination") return `${profile.availability} availability on a ${profile.topology} topology makes replication and coordination boundaries part of the design.`;
  if (id === "updates-deduplication") return `${profile.updates} updates require an explicit immutable-part and current-state read contract.`;
  if (id === "read-path-surprises") return `${profile.latencyTarget} latency with ${diagnostics.queryShape} queries depends on physical order and avoided granules.`;
  if (id === "memory-pressure") return `${diagnostics.queryShape} execution must remain inside memory at production concurrency.`;
  return `${diagnostics.materializedViewFootprint} materialized-view usage must justify its insert work and separate target lifecycle.`;
}

function variantFor(id: GotchaId, diagnostics: ReturnType<typeof normalizedDiagnostics>) {
  if (id === "parts-pressure") return diagnostics.insertPattern === "many-small" ? "many small synchronous inserts" : diagnostics.partitionCardinality === "high" ? "partition fan-out" : diagnostics.materializedViewFootprint === "many" ? "materialized-view fan-out" : "mixed ingest pressure";
  if (id === "scale-coordination") return diagnostics.deployment === "self-managed" ? "self-managed Keeper and replication" : diagnostics.deployment === "cloud" ? "ClickHouse Cloud availability boundary" : "deployment model not yet decided";
  if (id === "updates-deduplication") return "append versions, patches, and retry identity";
  if (id === "read-path-surprises") return diagnostics.queryShape;
  if (id === "memory-pressure") return diagnostics.queryShape;
  return diagnostics.materializedViewFootprint;
}

export function searchGotchaEvidence(query: string) {
  const needle = query.trim().toLowerCase();
  return GOTCHA_STORIES.filter((story) => [story.title, story.summary, story.consequence, ...story.beats.flatMap((item) => [item.heading, item.narration, item.guidance, item.productionCheck])].join(" ").toLowerCase().includes(needle));
}
