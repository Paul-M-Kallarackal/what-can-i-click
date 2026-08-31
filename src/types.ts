export type Tempo =
  | "immediate"
  | "fast"
  | "streaming"
  | "background"
  | "heavy"
  | "blocking";

export type DistrictId =
  | "ingestion"
  | "mergetree"
  | "read-path"
  | "aggregation"
  | "architecture"
  | "retention";

export type EvidenceKind = "official" | "derived" | "field";

export type WorkloadProfile = {
  workload: "observability" | "product-analytics" | "cdc" | "iot" | "financial" | "general";
  ingestRate: "low" | "medium" | "high" | "extreme";
  latencyTarget: "interactive" | "seconds" | "minutes" | "batch";
  retention: "days" | "months" | "years";
  updates: "append-only" | "occasional" | "frequent";
  availability: "standard" | "high";
  topology: "single-region" | "multi-region";
  costPriority: "performance" | "balanced" | "cost";
};

export type EvidenceReference = {
  id: string;
  label: string;
  url: string;
  kind: EvidenceKind;
};

export type Tradeoff = {
  benefit: string;
  cost: string;
};

export type ArchitectureDecision = {
  id: string;
  nodeId: DistrictId;
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
  path: DistrictId[];
  decisions: ArchitectureDecision[];
  tradeoffs: Tradeoff[];
  validationSteps: string[];
  evidence: EvidenceReference[];
};

export type MotionProfile = {
  tempo: Tempo;
  critter: "beetle" | "firefly" | "hummingbird" | "snail" | "roots" | "leaves";
  metaphor: string;
  reducedMotionState: string;
};

export type Claim = {
  id: string;
  text: string;
  kind: EvidenceKind;
  version: string;
  source: EvidenceReference;
};

export type KnowledgeNode = {
  id: DistrictId;
  district: string;
  title: string;
  shortTitle: string;
  tagline: string;
  explanation: string;
  motion: MotionProfile;
  tradeoffs: Tradeoff[];
  claims: Claim[];
  relatedNodeIds: DistrictId[];
  position: readonly [number, number, number];
  accent: string;
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

export type StoryMode = "lifecycle" | "architecture" | null;

