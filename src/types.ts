export type Tempo = "immediate" | "fast" | "streaming" | "background" | "heavy" | "blocking";

export type MergeFamilyId = "merge" | "replacing" | "summing" | "aggregating" | "collapsing" | "versioned-collapsing" | "coalescing";
export type LatestReadStrategy = "background" | "argmax" | "final";

export type DistrictId =
  | "ingestion"
  | "mergetree"
  | "read"
  | "precompute"
  | "architecture"
  | "retention"
  | "memory"
  | "execution"
  | "durability"
  | "storage"
  | "observability";

export type MechanismId =
  | "ingestion.client-batching"
  | "ingestion.async-buffer"
  | "ingestion.clickpipes"
  | "ingestion.cdc"
  | "ingestion.backpressure"
  | "ingestion.retry-deduplication"
  | "mergetree.part-anatomy"
  | "mergetree.partition-boundary"
  | "mergetree.merge-selection"
  | "mergetree.sorted-merge"
  | "mergetree.part-lifecycle"
  | "mergetree.parts-pressure"
  | "mergetree.forced-merge"
  | "read.ordering"
  | "read.sparse-index"
  | "read.granules"
  | "read.column-pruning"
  | "read.data-skipping"
  | "read.parallel-pipeline"
  | "read.saved-work"
  | "read.limit-short-circuit"
  | "precompute.materialized-view"
  | "precompute.aggregate-states"
  | "precompute.projection"
  | "precompute.optimizer-choice"
  | "precompute.write-amplification"
  | "precompute.refreshable-view"
  | "architecture.sharding"
  | "architecture.distributed-query"
  | "architecture.replication"
  | "architecture.keeper"
  | "architecture.failure"
  | "architecture.recovery"
  | "architecture.multi-region"
  | "architecture.vertical-scaling"
  | "retention.ttl-delete"
  | "retention.ttl-move"
  | "retention.ttl-recompress"
  | "retention.ttl-aggregate"
  | "retention.mutation"
  | "retention.patch-update"
  | "retention.backup"
  | "retention.restore"
  | "memory.os-page-cache"
  | "memory.mark-cache"
  | "memory.uncompressed-cache"
  | "memory.query-cache"
  | "memory.memory-tracker"
  | "memory.external-spill"
  | "execution.analyzer"
  | "execution.explain-plan"
  | "execution.join-strategy"
  | "execution.sort-aggregate"
  | "execution.processor-pipeline"
  | "execution.workload-scheduler"
  | "durability.part-commit"
  | "durability.async-ack"
  | "durability.insert-quorum"
  | "durability.replication-log"
  | "storage.disks-volumes"
  | "storage.storage-policy"
  | "storage.object-storage"
  | "storage.filesystem-cache"
  | "storage.compression-codecs"
  | "observability.query-log"
  | "observability.part-log"
  | "observability.merges"
  | "observability.replication-queue"
  | "observability.processes"
  | "observability.profile-events";

export type EvidenceKind = "official" | "derived" | "field";
export type StoryMode = "lifecycle" | "architecture" | null;
export type ScenarioMode =
  | "healthy"
  | "pressure"
  | "tiny-insert-storm"
  | "partition-explosion"
  | "merge-ttl-contention"
  | "bad-order-by"
  | "aggregation-spill"
  | "replica-lag"
  | "keeper-quorum-loss";
export type ViewLevel = "system" | "mechanism" | "xray";
export type SimulationEventType =
  | "arrive"
  | "buffer"
  | "flush"
  | "merge"
  | "scan"
  | "replicate"
  | "expire"
  | "cache"
  | "plan"
  | "commit"
  | "store"
  | "observe";

export type WorkloadProfile = {
  workload: "observability" | "product-analytics" | "cdc" | "iot" | "financial" | "general";
  ingestRate: "low" | "medium" | "high" | "extreme";
  latencyTarget: "interactive" | "seconds" | "minutes" | "batch";
  retention: "days" | "months" | "years";
  updates: "append-only" | "occasional" | "frequent";
  availability: "standard" | "high";
  topology: "single-region" | "multi-region";
  costPriority: "performance" | "balanced" | "cost";
  accelerationGoal?: "repeated-aggregation" | "transform-or-route" | "alternate-order" | "transparent-acceleration" | "none";
  deployment?: "cloud" | "self-managed" | "undecided";
  insertPattern?: "batched" | "many-small" | "mixed" | "unknown";
  queryShape?: "range-filter" | "high-cardinality-aggregate" | "point-lookup" | "join-heavy" | "mixed";
  partitionCardinality?: "low" | "medium" | "high" | "unknown";
  materializedViewFootprint?: "none" | "few" | "many" | "unknown";
};

export type GotchaId =
  | "parts-pressure"
  | "scale-coordination"
  | "updates-deduplication"
  | "read-path-surprises"
  | "memory-pressure"
  | "materialized-view-traps";

export type GotchaBeatKind = "cause" | "impact" | "avoid" | "verify";

export type GotchaMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
};

export type GotchaLegendItem = {
  label: string;
  color: string;
};

export type GotchaBeat = {
  kind: GotchaBeatKind;
  heading: string;
  narration: string;
  cameraPose: CameraPose;
  eventIds: string[];
  metrics: GotchaMetric[];
  legend: GotchaLegendItem[];
  guidance: string;
  productionCheck: string;
};

export type GotchaStory = {
  id: GotchaId;
  index: number;
  category: string;
  title: string;
  summary: string;
  consequence: string;
  sourceSectionNumbers: number[];
  primaryMechanismId: MechanismId;
  mechanismIds: MechanismId[];
  beats: [GotchaBeat, GotchaBeat, GotchaBeat, GotchaBeat];
  evidenceIds: string[];
  sourceUrl: string;
  tradeoff: string;
  reducedMotionSummary: string;
};

export type GotchaRecommendation = {
  gotchaId: GotchaId;
  whyRelevant: string;
  selectedVariant: string;
  recommendation: string;
  tradeoff: string;
  validationSteps: string[];
  confidence: "high" | "medium";
  evidenceIds: string[];
};

export type EvidenceReference = { id: string; label: string; url: string; kind: EvidenceKind };
export type Tradeoff = { benefit: string; cost: string };

export type ArchitectureDecision = {
  id: string;
  mechanismId: MechanismId;
  districtId: DistrictId;
  title: string;
  recommendation: string;
  rationale: string;
  alternatives: string[];
  confidence: "high" | "medium";
  evidenceIds: string[];
};

export type ArchitectureRecommendation = {
  id: string;
  summary: string;
  path: MechanismId[];
  decisions: ArchitectureDecision[];
  tradeoffs: Tradeoff[];
  validationSteps: string[];
  evidence: EvidenceReference[];
};

export type CameraPose = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  zoom: number;
};

export type SemanticTransition = { from: string; to: string; label: string };

export type SimulationEvent = {
  at: number;
  type: SimulationEventType;
  subjectId: MechanismId;
  fromState: string;
  toState: string;
  narration: string;
};

export type Claim = {
  id: string;
  text: string;
  kind: EvidenceKind;
  version: string;
  source: EvidenceReference;
};

export type MechanismSpec = {
  id: MechanismId;
  districtId: DistrictId;
  title: string;
  shortTitle: string;
  tagline: string;
  explanation: string;
  tempo: Tempo;
  cameraPose: CameraPose;
  markerPosition: readonly [number, number, number];
  states: string[];
  transitions: SemanticTransition[];
  healthyScenarioId: string;
  pressureScenarioId?: string;
  claimIds: string[];
  claims: Claim[];
  tradeoffs: Tradeoff[];
  relatedMechanismIds: MechanismId[];
  misconception: string;
  reducedMotionSummary: string;
};

export type DistrictSpec = {
  id: DistrictId;
  index: number;
  title: string;
  shortTitle: string;
  description: string;
  position: readonly [number, number, number];
  accent: string;
  mechanismIds: MechanismId[];
};

export type CompanyEvidence = {
  id: string;
  company: string;
  workload: WorkloadProfile["workload"];
  challenge: string;
  approach: string;
  outcome: string;
  version: string;
  provider: string;
  source: EvidenceReference;
  relatedNodeIds: DistrictId[];
};
