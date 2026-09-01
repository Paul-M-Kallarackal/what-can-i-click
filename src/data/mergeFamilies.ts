import type { LatestReadStrategy, MergeFamilyId } from "../types";

export type MergeFamilySpec = {
  id: MergeFamilyId;
  title: string;
  shortTitle: string;
  analogy: string;
  useWhen: string;
  caution: string;
  behavior: string;
  accent: string;
  source: string;
  tidbits: Array<{
    id: string;
    label: string;
    title: string;
    body: string;
    scenePosition: readonly [number, number, number];
    showForStrategies?: readonly LatestReadStrategy[];
  }>;
};

export const MERGE_FAMILIES: MergeFamilySpec[] = [
  {
    id: "merge",
    title: "MergeTree",
    shortTitle: "Raw events",
    analogy: "Sorted merge yard",
    useWhen: "Append-only facts, logs, traces, metrics, and analytical event tables.",
    caution: "It does not deduplicate logical rows or pre-aggregate values for you.",
    behavior: "Several sorted immutable parts become one larger part while their rows and columns remain intact.",
    accent: "#FFCC01",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/mergetree",
    tidbits: [
      { id: "merge.tributaries", label: "Input lanes", title: "Many parts become one part", body: "Each input lane carries a sorted immutable part. A background merge writes one larger part while preserving its rows and column data.", scenePosition: [-2.65, 1.12, -0.68] },
      { id: "merge.rings", label: "Mark rails", title: "Marks bound the search", body: "Sparse marks around granules let a well-ordered query avoid whole ranges of data.", scenePosition: [1.5, 0.36, 0.36] },
      { id: "merge.crown", label: "Rows retained", title: "Duplicates remain ordinary rows", body: "Ordinary MergeTree merges preserve duplicate sorting-key rows. TTL, mutations, and deletes can still remove data.", scenePosition: [2.62, 4.28, 0.24] },
    ],
  },
  {
    id: "replacing",
    title: "ReplacingMergeTree",
    shortTitle: "Latest row",
    analogy: "Version sorter",
    useWhen: "CDC, idempotent ingest, deduplication, or full-row versions keyed by ORDER BY.",
    caution: "For guaranteed current-state reads, use FINAL or a query with equivalent version, tie, NULL, and delete semantics. Winning tombstones remain stored unless cleanup is configured.",
    behavior: "Rows sharing an ORDER BY key are replacement candidates. With ver, the greatest version wins; without it, the most recently inserted row in that merge wins. Background deduplication is eventual.",
    accent: "#F18B52",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/replacingmergetree",
    tidbits: [
      { id: "replacing.versions", label: "Version candidates", title: "Versions can coexist", body: "Rows with the same sorting key may remain visible in separate parts until a background merge reconciles them.", scenePosition: [-2.52, 3.48, 0.32] },
      { id: "replacing.pruning", label: "Winner gate", title: "One version survives", body: "With a version column, the highest version is retained when eligible parts merge.", scenePosition: [0.15, 4.86, 0.42] },
      { id: "replacing.background", label: "Merged result", title: "Wait for background replacement", body: "This is the cheapest read path, but versions can coexist until eligible parts merge.", scenePosition: [3.06, 5.42, 0.86], showForStrategies: ["background"] },
      { id: "replacing.argmax", label: "argMax", title: "Choose one totally ordered winner", body: "argMax can avoid FINAL when a version plus tie-breaker identifies one row. Use a tuple for related columns and handle nulls and tombstones explicitly.", scenePosition: [3.06, 5.42, 0.86], showForStrategies: ["argmax"] },
      { id: "replacing.final", label: "SELECT FINAL", title: "Reconcile this read now", body: "FINAL applies the engine's replacement rules while the query runs, trading simpler correctness for read-time work.", scenePosition: [3.06, 5.42, 0.86], showForStrategies: ["final"] },
    ],
  },
  {
    id: "coalescing",
    title: "CoalescingMergeTree",
    shortTitle: "Sparse updates",
    analogy: "Sparse mosaic assembler",
    useWhen: "Sparse partial updates where each event changes only some nullable columns.",
    caution: "Requires ClickHouse 25.6+. Freshness follows insertion and part order, not a version column. NULL means no update and cannot clear an earlier non-NULL value; use FINAL before merges finish.",
    behavior: "Fragments sharing an ORDER BY key assemble the latest non-NULL value for each selected column.",
    accent: "#79D8C8",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/coalescingmergetree",
    tidbits: [
      { id: "coalescing.shards", label: "Sparse shards", title: "Updates can be partial", body: "One event may carry temperature while another carries battery. Unchanged nullable columns can stay empty.", scenePosition: [-2.34, 4.62, 0.38] },
      { id: "coalescing.assembly", label: "Mosaic assembly", title: "Columns converge independently", body: "Merges assemble the latest non-null value for each column into a more complete state.", scenePosition: [0.1, 4.26, 0.52] },
      { id: "coalescing.nulls", label: "Null meaning", title: "Null is part of the model", body: "Treat null as “no new value” only when that matches the domain; deliberate null semantics are essential here.", scenePosition: [2.58, 2.32, 0.64] },
      { id: "coalescing.read", label: "SELECT FINAL", title: "Assemble the row for this read", body: "FINAL applies coalescing semantics at query time when the latest non-null fields still live in separate parts.", scenePosition: [3.02, 5.38, 0.82], showForStrategies: ["final"] },
    ],
  },
  {
    id: "summing",
    title: "SummingMergeTree",
    shortTitle: "Running totals",
    analogy: "Counter press",
    useWhen: "Additive counters and materialized-view targets grouped by the sorting key.",
    caution: "Exact reads still use SUM and GROUP BY because background summation may be incomplete. Specify summed columns deliberately and keep raw detail in a separate MergeTree table.",
    behavior: "Numeric rows with one sorting key are pressed into a smaller additive result during merges.",
    accent: "#E7A93A",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/summingmergetree",
    tidbits: [
      { id: "summing.seeds", label: "Input counters", title: "Equal keys contribute", body: "Numeric columns from rows sharing the sorting key can be combined as parts merge.", scenePosition: [-2.82, 1.32, -0.42] },
      { id: "summing.fruit", label: "Counter output", title: "Storage pre-sums in background", body: "The accumulated counter grows as compatible values converge, reducing the number of stored rows over time.", scenePosition: [0.48, 4.32, 0.72] },
      { id: "summing.read", label: "Exact read", title: "Queries still aggregate", body: "Recently inserted parts may not have merged yet, so an exact result should still use the appropriate SUM and GROUP BY.", scenePosition: [2.56, 3.62, 0.12] },
    ],
  },
  {
    id: "aggregating",
    title: "AggregatingMergeTree",
    shortTitle: "Aggregate states",
    analogy: "Aggregate-state refinery",
    useWhen: "Materialized views that preserve mergeable states such as uniq, quantiles, avg, min, and max.",
    caution: "AggregateFunction columns need matching -State writes and -Merge reads. SimpleAggregateFunction is also supported and stores scalar values instead.",
    behavior: "State capsules retain mergeable aggregate state instead of prematurely finalizing a number.",
    accent: "#A48AE3",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/aggregatingmergetree",
    tidbits: [
      { id: "aggregating.cells", label: "State capsules", title: "The state stays mergeable", body: "Capsules store AggregateFunction states rather than prematurely finalized scalar answers.", scenePosition: [-1.46, 4.22, 0.46] },
      { id: "aggregating.flow", label: "State feed", title: "Views can feed states", body: "Incremental materialized views commonly produce these states as new source blocks arrive.", scenePosition: [-2.66, 3.48, 0.42] },
      { id: "aggregating.finalize", label: "Finalize gate", title: "Matching combinators finish", body: "Queries use the matching -Merge combinator to combine stored states and produce the final answer.", scenePosition: [0.02, 5.62, 0.46] },
    ],
  },
  {
    id: "collapsing",
    title: "CollapsingMergeTree",
    shortTitle: "Cancel pairs",
    analogy: "Polarity gate",
    useWhen: "Insert-based updates or deletes where producers can emit correct +1 and −1 state pairs.",
    caution: "The producer must emit consecutive, matching state/cancel history. Guaranteed reads need sign-aware aggregation or bounded FINAL; avoid FINAL for million-row scans.",
    behavior: "The old +1 and its matching old-state −1 cancel; the replacement +1 survives.",
    accent: "#EB6758",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/collapsingmergetree",
    tidbits: [
      { id: "collapsing.pairs", label: "Three-row change", title: "An update carries old and new state", body: "After the original old +1, the producer emits that old state with −1 and the replacement state with +1.", scenePosition: [-2.58, 3.34, 0.42] },
      { id: "collapsing.cancel", label: "Cancellation", title: "Old state cancels; new state stays", body: "During a compatible merge, old +1 meets old −1 and both disappear. The replacement +1 remains as current state.", scenePosition: [0.08, 3.26, 0.72] },
      { id: "collapsing.pending", label: "Three rows pending", title: "Reads must tolerate merge lag", body: "Before merging, old +1, old −1, and replacement +1 can all be visible; queries must apply sign-aware semantics.", scenePosition: [0.82, 5.74, 0.42] },
    ],
  },
  {
    id: "versioned-collapsing",
    title: "VersionedCollapsingMergeTree",
    shortTitle: "Concurrent changes",
    analogy: "Version railway",
    useWhen: "Collapsing semantics with concurrent or out-of-order producers that provide versions.",
    caution: "A cancel row must match the key and exact version with the opposite Sign. Until merges finish, use sign-aware aggregation or bounded FINAL; avoid FINAL for large scans.",
    behavior: "Numbered state and cancel rows find the correct partner even when they arrive out of order.",
    accent: "#79A5E8",
    source: "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/versionedcollapsingmergetree",
    tidbits: [
      { id: "versioned.spiral", label: "Version track", title: "Version orders the pairing", body: "A version helps matching states find the correct partner when several producers arrive concurrently or out of order.", scenePosition: [-1.42, 2.54, 0.52] },
      { id: "versioned.signs", label: "Sign + version", title: "Both fields matter", body: "The engine still needs intentional +1 and −1 events; version adds ordering rather than replacing sign semantics.", scenePosition: [0.84, 4.38, 0.56] },
      { id: "versioned.mismatch", label: "Version mismatch", title: "A mismatched pair remains", body: "Opposite signs do not cancel unless their sorting key and version also match.", scenePosition: [1.54, 5.42, 0.62] },
      { id: "versioned.cost", label: "Complexity", title: "Choose it deliberately", body: "Use this when pair cancellation is truly the model. ReplacingMergeTree is usually simpler for ordinary latest-row state.", scenePosition: [2.72, 3.58, 0.46] },
    ],
  },
];

export const LATEST_READ_STRATEGIES: Array<{ id: LatestReadStrategy; label: string; summary: string; chooseWhen: string; tradeoff: string }> = [
  { id: "background", label: "Merged state", summary: "Let background merges converge storage.", chooseWhen: "Choose this only when eventual convergence is acceptable and the read does not require the current logical row immediately.", tradeoff: "Fast reads, but not immediate correctness while versions coexist." },
  { id: "argmax", label: "argMax", summary: "Select the value attached to the greatest total-ordering tuple.", chooseWhen: "Choose this when one explicit (version, tie-breaker) tuple totally orders every candidate and the query models NULLs and tombstones deliberately.", tradeoff: "Can avoid FINAL when one total order identifies the winner. Use a tuple for related columns and handle ties, NULLs, and tombstones explicitly." },
  { id: "final", label: "SELECT FINAL", summary: "Apply the table engine's exact merge rules during this query.", chooseWhen: "Choose this when exact engine semantics matter more than minimum read work and the matching keys or partitions can be bounded.", tradeoff: "Simplest correctness model, but it adds read-time work. Bound candidate rows and only split by partition when every version of a key stays together." },
];

/** Read contracts that the current reviewed family visualizations can explain. */
export const MERGE_FAMILY_READ_STRATEGIES: Record<MergeFamilyId, readonly LatestReadStrategy[]> = {
  merge: ["background"],
  replacing: ["background", "argmax", "final"],
  coalescing: ["background", "final"],
  summing: ["background"],
  aggregating: ["background"],
  collapsing: ["background"],
  "versioned-collapsing": ["background"],
};

export function mergeFamilySupportsReadStrategy(familyId: MergeFamilyId, strategy: LatestReadStrategy) {
  return MERGE_FAMILY_READ_STRATEGIES[familyId].includes(strategy);
}

export function mergeFamilyById(id: MergeFamilyId) {
  return MERGE_FAMILIES.find((family) => family.id === id)!;
}
