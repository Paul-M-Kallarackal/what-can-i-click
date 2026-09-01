import type { MechanismId, ScenarioMode } from "../types";

export type OperationalSnapshot = {
  insertsPerSecond: number;
  queryP99Ms: number;
  activeParts: number;
  activeMerges: number;
  memoryPercent: number;
  replicaQueue: number;
};

export type OperationalScenario = {
  id: ScenarioMode;
  title: string;
  shortTitle: string;
  description: string;
  lesson: string;
  setting: string;
  settingValue: string;
  primaryMechanismId: MechanismId | null;
  affectedMechanismIds: MechanismId[];
  target: OperationalSnapshot;
};

const steady: OperationalSnapshot = {
  insertsPerSecond: 820_000,
  queryP99Ms: 145,
  activeParts: 48,
  activeMerges: 3,
  memoryPercent: 46,
  replicaQueue: 1,
};

export const OPERATIONAL_SCENARIOS: OperationalScenario[] = [
  {
    id: "healthy",
    title: "Steady ClickHouse",
    shortTitle: "Steady",
    description: "Batched inserts, bounded background work, selective reads, and replicas keeping pace.",
    lesson: "Batched inserts and background merges remain in balance.",
    setting: "workload",
    settingValue: "balanced",
    primaryMechanismId: null,
    affectedMechanismIds: [],
    target: steady,
  },
  {
    id: "pressure",
    title: "General pressure",
    shortTitle: "Pressure",
    description: "A compatibility scenario that raises load across the currently selected mechanism.",
    lesson: "Prefer one named scenario when diagnosing a concrete ClickHouse tradeoff.",
    setting: "load",
    settingValue: "high",
    primaryMechanismId: null,
    affectedMechanismIds: [],
    target: { insertsPerSecond: 360_000, queryP99Ms: 1_480, activeParts: 260, activeMerges: 21, memoryPercent: 91, replicaQueue: 84 },
  },
  {
    id: "tiny-insert-storm",
    title: "Tiny insert storm",
    shortTitle: "Tiny inserts",
    description: "Single-row inserts create immutable parts faster than background merges can consolidate them.",
    lesson: "Batch at the client or use asynchronous inserts; raising part limits only moves the alarm.",
    setting: "rows / insert",
    settingValue: "1",
    primaryMechanismId: "mergetree.parts-pressure",
    affectedMechanismIds: ["ingestion.client-batching", "ingestion.async-buffer", "mergetree.parts-pressure", "observability.part-log", "observability.merges"],
    target: { insertsPerSecond: 54_000, queryP99Ms: 1_940, activeParts: 610, activeMerges: 34, memoryPercent: 78, replicaQueue: 126 },
  },
  {
    id: "partition-explosion",
    title: "Partition explosion",
    shortTitle: "Partitions",
    description: "One flush fans out across many partition keys and permanently fragments merge eligibility.",
    lesson: "Use partitioning for lifecycle boundaries; put query locality in ORDER BY.",
    setting: "partitions / flush",
    settingValue: "480",
    primaryMechanismId: "mergetree.partition-boundary",
    affectedMechanismIds: ["mergetree.partition-boundary", "mergetree.parts-pressure", "observability.part-log"],
    target: { insertsPerSecond: 190_000, queryP99Ms: 1_260, activeParts: 740, activeMerges: 9, memoryPercent: 72, replicaQueue: 204 },
  },
  {
    id: "merge-ttl-contention",
    title: "Merge + TTL + mutation contention",
    shortTitle: "Background pile-up",
    description: "Merges, TTL rewrites, and a broad mutation compete for the same storage and background capacity.",
    lesson: "Observe active work before forcing merges; schedule broad rewrites deliberately.",
    setting: "background work",
    settingValue: "3 competing classes",
    primaryMechanismId: "observability.merges",
    affectedMechanismIds: ["mergetree.merge-selection", "retention.ttl-delete", "retention.mutation", "observability.merges"],
    target: { insertsPerSecond: 410_000, queryP99Ms: 2_380, activeParts: 330, activeMerges: 28, memoryPercent: 86, replicaQueue: 168 },
  },
  {
    id: "bad-order-by",
    title: "ORDER BY misses the filter",
    shortTitle: "Bad ORDER BY",
    description: "The primary index cannot discard broad ranges, so the scanner reads far more granules and columns.",
    lesson: "Design physical ordering from representative filters and verify skipped ranges with EXPLAIN indexes.",
    setting: "granules read",
    settingValue: "92%",
    primaryMechanismId: "read.ordering",
    affectedMechanismIds: ["read.ordering", "read.sparse-index", "read.granules", "read.saved-work", "execution.explain-plan"],
    target: { insertsPerSecond: 790_000, queryP99Ms: 3_120, activeParts: 56, activeMerges: 4, memoryPercent: 83, replicaQueue: 2 },
  },
  {
    id: "aggregation-spill",
    title: "Aggregation spills to disk",
    shortTitle: "Memory spill",
    description: "High-cardinality aggregate state crosses its memory threshold and continues through external processing.",
    lesson: "Treat spill as protection, not acceleration. Reduce unnecessary group-key cardinality or precompute repeated questions first; then test an external GROUP BY threshold with memory headroom and measure temporary I/O.",
    setting: "external GROUP BY",
    settingValue: "active",
    primaryMechanismId: "memory.external-spill",
    affectedMechanismIds: ["execution.sort-aggregate", "memory.memory-tracker", "memory.external-spill", "precompute.materialized-view", "observability.processes"],
    target: { insertsPerSecond: 770_000, queryP99Ms: 4_680, activeParts: 52, activeMerges: 3, memoryPercent: 96, replicaQueue: 2 },
  },
  {
    id: "replica-lag",
    title: "Replica queue falls behind",
    shortTitle: "Replica lag",
    description: "Part fetches and replicated operations accumulate faster than one replica can complete them.",
    lesson: "Watch queue depth and oldest-task age together. Use task type, retries, postpone reason, and last exception to separate slow part transfer, destination storage, merge capacity, and Keeper/session problems; verify the queue drains after recovery.",
    setting: "queue entries",
    settingValue: "186",
    primaryMechanismId: "observability.replication-queue",
    affectedMechanismIds: ["architecture.replication", "architecture.recovery", "durability.replication-log", "observability.replication-queue"],
    target: { insertsPerSecond: 720_000, queryP99Ms: 920, activeParts: 82, activeMerges: 8, memoryPercent: 69, replicaQueue: 186 },
  },
  {
    id: "keeper-quorum-loss",
    title: "Keeper quorum unavailable",
    shortTitle: "Keeper loss",
    description: "The coordination quorum is unavailable while existing local data paths remain physically separate.",
    lesson: "Run an odd Keeper ensemble across independent failure domains and prove that one loss leaves a majority. Monitor quorum, sessions, and replicated-table read-only state; restore coordination before retrying queued writes. Keeper carries metadata, never user part bytes.",
    setting: "Keeper votes",
    settingValue: "1 / 3",
    primaryMechanismId: "architecture.keeper",
    affectedMechanismIds: ["architecture.keeper", "durability.replication-log", "observability.replication-queue"],
    target: { insertsPerSecond: 18_000, queryP99Ms: 740, activeParts: 64, activeMerges: 5, memoryPercent: 61, replicaQueue: 310 },
  },
];

export const OPERATIONAL_SCENARIO_IDS = OPERATIONAL_SCENARIOS.map((scenario) => scenario.id) as [ScenarioMode, ...ScenarioMode[]];

export function operationalScenarioById(id: ScenarioMode) {
  return OPERATIONAL_SCENARIOS.find((scenario) => scenario.id === id) ?? OPERATIONAL_SCENARIOS[0];
}

export function isPressureScenario(id: ScenarioMode) {
  return id !== "healthy";
}

const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;

/** Deterministic model telemetry; never presented as measurements from a real cluster. */
export function operationalSnapshot(id: ScenarioMode, simulationTime: number): OperationalSnapshot {
  const scenario = operationalScenarioById(id);
  if (id === "healthy") {
    const breathe = 0.035 * Math.sin(simulationTime * 0.82);
    return {
      insertsPerSecond: Math.round(steady.insertsPerSecond * (1 + breathe)),
      queryP99Ms: Math.round(steady.queryP99Ms * (1 + breathe * 0.7)),
      activeParts: Math.round(steady.activeParts * (1 + breathe)),
      activeMerges: steady.activeMerges,
      memoryPercent: Math.round(steady.memoryPercent * (1 + breathe * 0.5)),
      replicaQueue: Math.max(0, Math.round(steady.replicaQueue + Math.sin(simulationTime * 0.4))),
    };
  }

  const ramp = Math.min(1, Math.max(0, simulationTime / 4));
  const pulse = 0.92 + Math.sin(simulationTime * 0.9) * 0.08;
  const amount = ramp * pulse;
  return {
    insertsPerSecond: Math.max(0, Math.round(lerp(steady.insertsPerSecond, scenario.target.insertsPerSecond, amount))),
    queryP99Ms: Math.round(lerp(steady.queryP99Ms, scenario.target.queryP99Ms, amount)),
    activeParts: Math.round(lerp(steady.activeParts, scenario.target.activeParts, amount)),
    activeMerges: Math.round(lerp(steady.activeMerges, scenario.target.activeMerges, amount)),
    memoryPercent: Math.min(100, Math.round(lerp(steady.memoryPercent, scenario.target.memoryPercent, amount))),
    replicaQueue: Math.round(lerp(steady.replicaQueue, scenario.target.replicaQueue, amount)),
  };
}
