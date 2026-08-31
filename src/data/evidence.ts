import type { CompanyEvidence, EvidenceReference } from "../types";

export const CLICKHOUSE_CLAIM_VERSION = "26.3 LTS";

const docs = (id: string, label: string, path: string): EvidenceReference => ({
  id,
  label,
  url: `https://clickhouse.com/docs${path}`,
  kind: "official",
});

export const SOURCES = {
  asyncInserts: docs("docs-async-inserts", "Asynchronous inserts", "/optimize/asynchronous-inserts"),
  clickPipes: docs("docs-clickpipes", "ClickPipes", "/integrations/clickpipes"),
  mergeTree: docs("docs-mergetree", "MergeTree table engine", "/engines/table-engines/mergetree-family/mergetree"),
  primaryIndexes: docs("docs-primary-index", "Sparse primary indexes", "/primary-indexes"),
  projections: docs("docs-projections", "Projections", "/data-modeling/projections"),
  materializedViews: docs("docs-materialized-views", "Incremental materialized views", "/materialized-view/incremental-materialized-view"),
  replication: docs("docs-replication", "Data replication", "/engines/table-engines/mergetree-family/replication"),
  keeper: docs("docs-keeper", "ClickHouse Keeper", "/guides/sre/keeper/clickhouse-keeper"),
  ttl: docs("docs-ttl", "Manage data with TTL", "/guides/developer/ttl"),
  mutations: docs("docs-mutations", "Avoid mutations", "/optimize/avoid-mutations"),
  userStories: {
    id: "clickhouse-user-stories",
    label: "ClickHouse user stories",
    url: "https://clickhouse.com/user-stories",
    kind: "field" as const,
  },
  bestPractices: {
    id: "clickhouse-agent-skills",
    label: "ClickHouse agent best practices",
    url: "https://github.com/ClickHouse/agent-skills",
    kind: "official" as const,
  },
} as const;

function story(
  id: string,
  company: string,
  workload: CompanyEvidence["workload"],
  challenge: string,
  approach: string,
  outcome: string,
  provider: string,
  relatedNodeIds: CompanyEvidence["relatedNodeIds"],
  url: string = SOURCES.userStories.url,
): CompanyEvidence {
  return {
    id,
    company,
    workload,
    challenge,
    approach,
    outcome,
    version: "Not disclosed",
    provider,
    source: { id: `story-${id}`, label: `${company} engineering story`, url, kind: "field" },
    relatedNodeIds,
  };
}

export const COMPANY_EVIDENCE: CompanyEvidence[] = [
  story("cloudflare", "Cloudflare", "observability", "Serve analytics over quadrillion-row scale while traffic keeps growing.", "Operate a self-managed, distributed ClickHouse estate designed around continuous scale.", "ClickHouse supports analysis across trillions of requests and millions of requests per second.", "Self-managed", ["architecture", "read-path", "mergetree"]),
  story("ly-corporation", "LY Corporation", "observability", "Observe one of the world’s largest Kafka deployments without runaway infrastructure.", "Stream high-volume Kafka telemetry into a compact ClickHouse deployment.", "The published story reports roughly seven million rows per second on 24 servers.", "Self-managed", ["ingestion", "architecture"]),
  story("gitlab", "GitLab", "product-analytics", "PostgreSQL performance ceilings constrained analytics for a very large user base.", "Move analytical workloads to ClickHouse with cloud deployment flexibility.", "The team reports sub-second analytics for 50 million users.", "ClickHouse Cloud", ["aggregation", "read-path"]),
  story("netflix", "Netflix", "observability", "Petabyte-scale logging required careful simplification and cost control.", "Use ClickHouse for a deliberately simplified logging architecture.", "The published lesson emphasizes doing less work through simpler system choices.", "Cloud", ["mergetree", "retention", "read-path"]),
  story("seemplicity", "Seemplicity", "cdc", "Security analytics needed reliable Postgres change capture without owning the connector stack.", "Use managed Postgres CDC through ClickPipes into ClickHouse.", "The team reduced connector operations while keeping security analytics current.", "ClickHouse Cloud", ["ingestion", "mergetree"]),
  story("lago", "Lago", "financial", "Usage billing needed extremely high event ingestion with queryable results.", "Build the metering path on ClickHouse Cloud with a batch-friendly event model.", "The published story describes one million events per second ingestion.", "ClickHouse Cloud", ["ingestion", "aggregation"]),
  story("emq", "EMQ", "iot", "Industrial telemetry crosses edge gateways, MQTT, and Kafka before analytics.", "Normalize at the edge, stream through EMQX and Kafka, then ingest into ClickHouse Cloud.", "The architecture supports a large industrial IoT cloud while retaining real-time analysis.", "ClickHouse Cloud", ["ingestion", "architecture"], "https://clickhouse.com/blog/emq-ai-assisted-analytics"),
  story("rill", "Rill", "product-analytics", "Interactive operational BI must stay responsive over very large event histories.", "Pair ClickHouse with precomputation and explicit recomputation boundaries.", "The published workload covers 100+ billion events with fast dashboards.", "Self-managed", ["aggregation", "read-path"]),
  story("clickhouse-internal", "ClickHouse Cloud", "observability", "Internal observability grew beyond 100 PB and required predictable wide-event search.", "Use a ClickHouse-native observability stack and wide events.", "The platform scaled beyond 100 PB while retaining interactive investigation.", "ClickHouse Cloud", ["retention", "architecture", "read-path"], "https://clickhouse.com/blog/scaling-observability-beyond-100pb-wide-events-replacing-otel"),
  story("qrt", "QRT", "financial", "Researchers and risk systems need real-time analysis at petabyte scale.", "Use ClickHouse Cloud for research data plus real-time risk and P&L.", "One analytical platform serves both research and time-sensitive risk workloads.", "ClickHouse Cloud", ["architecture", "read-path", "ingestion"]),
];

export function evidenceById(id: string) {
  return COMPANY_EVIDENCE.find((entry) => entry.id === id);
}

export function searchEvidence(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return COMPANY_EVIDENCE;
  return COMPANY_EVIDENCE.filter((entry) =>
    [entry.company, entry.workload, entry.challenge, entry.approach, entry.outcome]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
