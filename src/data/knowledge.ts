import { CLICKHOUSE_CLAIM_VERSION, SOURCES } from "./evidence";
import type { Claim, DistrictId, KnowledgeNode } from "../types";

const claim = (id: string, text: string, source: Claim["source"], kind: Claim["kind"] = "official"): Claim => ({
  id,
  text,
  kind,
  version: CLICKHOUSE_CLAIM_VERSION,
  source,
});

export const KNOWLEDGE_NODES: KnowledgeNode[] = [
  {
    id: "ingestion",
    district: "01 · Arrival nursery",
    title: "Ingestion & ClickPipes",
    shortTitle: "Ingest",
    tagline: "Let rows arrive in useful groups.",
    explanation: "Small inserts create small parts and transfer overhead. Batch at the client, use asynchronous inserts when clients cannot coordinate, or use ClickPipes for managed streaming and CDC.",
    motion: { tempo: "streaming", critter: "beetle", metaphor: "Beetles gather loose seeds into trays before carrying them into the grove.", reducedMotionState: "Seed trays appear as completed batches." },
    tradeoffs: [
      { benefit: "Larger batches improve insert efficiency.", cost: "Batching adds buffering latency." },
      { benefit: "ClickPipes reduces connector operations.", cost: "Managed ingestion narrows low-level control." },
    ],
    claims: [
      claim("ingest-async", "Asynchronous inserts buffer incoming data before writing it as parts.", SOURCES.asyncInserts),
      claim("ingest-clickpipes", "ClickPipes provides managed ingestion for supported streaming and CDC sources.", SOURCES.clickPipes),
    ],
    relatedNodeIds: ["mergetree", "architecture"],
    position: [-10.5, 0, 5.2],
    accent: "#d9953f",
  },
  {
    id: "mergetree",
    district: "02 · Part garden",
    title: "MergeTree lifecycle",
    shortTitle: "Merge",
    tagline: "Immutable parts, patient roots.",
    explanation: "Inserted blocks become immutable data parts. Background merges combine compatible parts over time; too many tiny parts increase scheduling, file, and metadata pressure.",
    motion: { tempo: "background", critter: "roots", metaphor: "Fine roots pull small soil pads into fewer, broader terraces.", reducedMotionState: "Terraces step directly from many small pads to fewer large pads." },
    tradeoffs: [
      { benefit: "Immutable parts make writes and compression efficient.", cost: "Merges consume background CPU and I/O." },
      { benefit: "Good batching keeps part counts healthy.", cost: "Tiny inserts can outpace background consolidation." },
    ],
    claims: [claim("merge-parts", "MergeTree tables store data in parts and merge those parts in the background.", SOURCES.mergeTree)],
    relatedNodeIds: ["ingestion", "read-path", "retention"],
    position: [-4.1, 0, 1.3],
    accent: "#ffcc01",
  },
  {
    id: "read-path",
    district: "03 · Index canopy",
    title: "Keys, granules & pipelines",
    shortTitle: "Read",
    tagline: "Skip branches before touching leaves.",
    explanation: "ClickHouse sorts data by the table key and keeps a sparse primary index over granules. Queries eliminate ranges first, then run parallel pipelines over the remaining columns.",
    motion: { tempo: "fast", critter: "firefly", metaphor: "Fireflies hop between index lanterns, ignoring whole branches that cannot match.", reducedMotionState: "Matching branches illuminate without traveling particles." },
    tradeoffs: [
      { benefit: "A workload-aligned key skips large ranges.", cost: "One ordering cannot optimize every access pattern." },
      { benefit: "Parallel pipelines accelerate scans.", cost: "Concurrency consumes memory and CPU." },
    ],
    claims: [claim("read-sparse", "The primary index is sparse: it stores marks for granules rather than every row.", SOURCES.primaryIndexes)],
    relatedNodeIds: ["mergetree", "aggregation"],
    position: [3.3, 0, -0.6],
    accent: "#76a478",
  },
  {
    id: "aggregation",
    district: "04 · Grafted views",
    title: "Views & projections",
    shortTitle: "Precompute",
    tagline: "Grow the answer before it is asked.",
    explanation: "Incremental materialized views move aggregation work to insert time. Projections maintain alternate representations that the optimizer can select while queries continue to target the base table.",
    motion: { tempo: "immediate", critter: "hummingbird", metaphor: "A hummingbird visits a graft that already holds the concentrated result.", reducedMotionState: "Prepared result fruit appears on the selected graft." },
    tradeoffs: [
      { benefit: "Materialized views make repeated aggregations cheap to read.", cost: "Insert work and operational complexity increase." },
      { benefit: "Projections can be optimizer-transparent.", cost: "They add storage and maintenance work." },
    ],
    claims: [
      claim("agg-mv", "Incremental materialized views shift computation from query time to insert time.", SOURCES.materializedViews),
      claim("agg-projection", "Projections can provide alternate data layouts selected by the optimizer.", SOURCES.projections),
    ],
    relatedNodeIds: ["read-path", "ingestion"],
    position: [10, 0, -4.8],
    accent: "#9f6b50",
  },
  {
    id: "architecture",
    district: "05 · Replica grove",
    title: "Shards, replicas & Keeper",
    shortTitle: "Scale",
    tagline: "Divide work; duplicate safety.",
    explanation: "Sharding divides data and compute. Replication keeps copies of each shard for resilience. ClickHouse Keeper coordinates replicated table metadata; it is not the data plane itself.",
    motion: { tempo: "streaming", critter: "roots", metaphor: "Trunks divide into shards while silver roots keep replica twins in step.", reducedMotionState: "Replica pairs and shard boundaries appear as static highlighted groups." },
    tradeoffs: [
      { benefit: "Replicas improve availability and read capacity.", cost: "Replication multiplies storage and coordination work." },
      { benefit: "Shards expand capacity.", cost: "Distributed queries and rebalancing become more complex." },
    ],
    claims: [
      claim("arch-replica", "Replicated MergeTree engines replicate data parts across table replicas.", SOURCES.replication),
      claim("arch-keeper", "ClickHouse Keeper provides coordination compatible with ZooKeeper clients.", SOURCES.keeper),
    ],
    relatedNodeIds: ["ingestion", "read-path", "retention"],
    position: [7.4, 0, 6.3],
    accent: "#527c73",
  },
  {
    id: "retention",
    district: "06 · Seasonal archive",
    title: "TTL, mutations & backups",
    shortTitle: "Retain",
    tagline: "Let old leaves fall deliberately.",
    explanation: "TTL rules move, recompress, aggregate, or delete aging data in the background. Heavy mutations rewrite parts, so update-heavy models should prefer engines designed for eventual replacement or collapsing.",
    motion: { tempo: "heavy", critter: "snail", metaphor: "Old leaves turn clay-red and fall; a snail marks expensive rewrites moving through whole pads.", reducedMotionState: "Expired leaves fade and rewritten terraces switch state without travel." },
    tradeoffs: [
      { benefit: "TTL automates lifecycle management.", cost: "Cleanup is asynchronous and consumes merge resources." },
      { benefit: "Mutations can rewrite existing data.", cost: "Large mutations are I/O-heavy and asynchronous." },
    ],
    claims: [
      claim("retain-ttl", "TTL actions run as background work and can delete, move, recompress, or aggregate data.", SOURCES.ttl),
      claim("retain-mutation", "Frequent mutations should be avoided because they rewrite data parts.", SOURCES.mutations),
    ],
    relatedNodeIds: ["mergetree", "architecture"],
    position: [-7.2, 0, -7],
    accent: "#a75e45",
  },
];

export const LIFECYCLE_PATH: DistrictId[] = ["ingestion", "mergetree", "read-path", "aggregation", "architecture", "retention"];

export function knowledgeById(id: string) {
  return KNOWLEDGE_NODES.find((node) => node.id === id);
}

export function searchKnowledge(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return KNOWLEDGE_NODES;
  return KNOWLEDGE_NODES.filter((node) =>
    [node.title, node.shortTitle, node.tagline, node.explanation, node.district, node.motion.metaphor]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

