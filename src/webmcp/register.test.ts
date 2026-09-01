import { beforeEach, describe, expect, it } from "vitest";
import { COMPANY_IMPLEMENTATIONS } from "../data/companyImplementations";
import { DISTRICTS, MECHANISMS } from "../data/mechanisms";
import { useAtlasStore } from "../store/useAtlasStore";
import { createToolDefinitions } from "./register";

const profile = {
  workload: "product-analytics",
  ingestRate: "extreme",
  latencyTarget: "interactive",
  retention: "years",
  updates: "occasional",
  availability: "high",
  topology: "multi-region",
  costPriority: "performance",
};

describe("WebMCP tools", () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it("registers the focused seven-tool surface", () => {
    expect(createToolDefinitions().map((tool) => tool.name)).toEqual([
      "describe_clickhouse_world",
      "recommend_clickhouse_architecture",
      "play_architecture_story",
      "inspect_clickhouse_mechanism",
      "compare_clickhouse_methods",
      "search_clickhouse_evidence",
      "reset_clickhouse_world",
    ]);
  });

  it("stages and plays an architecture recommendation", async () => {
    const tools = createToolDefinitions();
    const recommend = tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!;
    const play = tools.find((tool) => tool.name === "play_architecture_story")!;
    const result = await recommend.execute(profile);
    expect(result).toMatchObject({
      path: expect.arrayContaining(["architecture.sharding", "architecture.keeper"]),
      journey: {
        id: "multi-region-product-analytics",
        guidePath: expect.arrayContaining([
          expect.objectContaining({ mechanismId: "ingestion.async-buffer", evidenceId: "ly-corporation" }),
        ]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      activeJourneyId: "multi-region-product-analytics",
      mergeFamilyId: "merge",
      latestReadStrategy: "background",
      selectedMechanismId: null,
      selectedEvidenceId: null,
      viewLevel: "system",
    });
    expect(await play.execute({})).toMatchObject({ ok: true });
    expect(useAtlasStore.getState().storyMode).toBe("architecture");
  });

  it("rejects executable or secret-bearing fields", async () => {
    const recommend = createToolDefinitions().find((tool) => tool.name === "recommend_clickhouse_architecture")!;
    await expect(recommend.execute({ ...profile, sql: "DROP TABLE x", password: "secret" })).rejects.toThrow();
  });

  it("returns bounded evidence results", async () => {
    const search = createToolDefinitions().find((tool) => tool.name === "search_clickhouse_evidence")!;
    const result = await search.execute({ query: "analytics" }) as {
      corpus: { mechanisms: number; stories: number; implementationAccounts: number; architectureRecipes: number };
      mechanisms: unknown[];
      stories: unknown[];
    };
    expect(result.corpus).toEqual({ mechanisms: MECHANISMS.length, stories: 10, implementationAccounts: COMPANY_IMPLEMENTATIONS.length, architectureRecipes: COMPANY_IMPLEMENTATIONS.length });
    expect(result.mechanisms.length).toBeLessThanOrEqual(6);
    expect(result.stories.length).toBeLessThanOrEqual(10);
  });

  it("returns reviewed production implementations to an agent search", async () => {
    const search = createToolDefinitions().find((tool) => tool.name === "search_clickhouse_evidence")!;
    const result = await search.execute({ query: "Cisco" }) as {
      implementations: Array<{ company: string; version: string; source: { url: string } }>;
    };

    expect(result.implementations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        company: "Cisco Talos",
        version: "Not disclosed",
        source: expect.objectContaining({ url: "https://clickhouse.com/blog/cisco" }),
      }),
    ]));
  });

  it("describes, inspects, compares, and resets only reviewed mechanisms", async () => {
    const tools = createToolDefinitions();
    const describeWorld = tools.find((tool) => tool.name === "describe_clickhouse_world")!;
    const inspect = tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!;
    const compare = tools.find((tool) => tool.name === "compare_clickhouse_methods")!;
    const reset = tools.find((tool) => tool.name === "reset_clickhouse_world")!;

    expect(await describeWorld.execute({})).toMatchObject({
      evidenceCorpus: { stories: 10, implementationAccounts: COMPANY_IMPLEMENTATIONS.length },
      mechanisms: expect.arrayContaining([expect.objectContaining({ id: "mergetree.part-anatomy" })]),
    });
    expect(await inspect.execute({ mechanismId: "mergetree.part-anatomy", view: "xray" })).toMatchObject({ ok: true, view: "xray" });
    expect(useAtlasStore.getState()).toMatchObject({ selectedMechanismId: "mergetree.part-anatomy", viewLevel: "xray" });
    expect(await compare.execute({ firstId: "precompute.materialized-view", secondId: "precompute.projection" })).toMatchObject({ ok: true });
    expect(useAtlasStore.getState().comparisonIds).toEqual(["precompute.materialized-view", "precompute.projection"]);
    expect(await reset.execute({})).toMatchObject({ ok: true, chambers: DISTRICTS.length, mechanisms: MECHANISMS.length, stories: 10 });
    expect(useAtlasStore.getState()).toMatchObject({ selectedMechanismId: null, viewLevel: "system", comparisonIds: null });
  });

  it("plays named ClickHouse pressure scenarios and focuses their real mechanism", async () => {
    const tools = createToolDefinitions();
    const recommend = tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!;
    const play = tools.find((tool) => tool.name === "play_architecture_story")!;

    await recommend.execute(profile);
    const result = await play.execute({ scenario: "aggregation-spill" });

    expect(result).toMatchObject({
      ok: true,
      scenario: {
        id: "aggregation-spill",
        primaryMechanismId: "memory.external-spill",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/worst-case distinct count|precompute repeated high-cardinality|max_bytes_before_external_group_by/i),
        rationale: expect.stringMatching(/partial state|temporary writes|merge phase/i),
        evidenceIds: expect.arrayContaining(["docs-external-aggregation", "docs-materialized-views"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "aggregation-spill",
      selectedMechanismId: "memory.external-spill",
    });

    const replicaLag = await play.execute({ scenario: "replica-lag" });
    expect(replicaLag).toMatchObject({
      ok: true,
      scenario: {
        id: "replica-lag",
        primaryMechanismId: "observability.replication-queue",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/queue size|oldest-task age|GET_PART|MERGE_PARTS/i),
        rationale: expect.stringMatching(/asynchronous|fetch compressed part bytes|local work/i),
        evidenceIds: expect.arrayContaining(["docs-replication-queue", "docs-system-replicas", "docs-replication"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "replica-lag",
      selectedMechanismId: "observability.replication-queue",
    });

    const keeperLoss = await play.execute({ scenario: "keeper-quorum-loss" });
    expect(keeperLoss).toMatchObject({
      ok: true,
      scenario: {
        id: "keeper-quorum-loss",
        primaryMechanismId: "architecture.keeper",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/three voting Keeper nodes|independent failure domains|2 \/ 3 majority/i),
        rationale: expect.stringMatching(/Raft|coordination|row bytes/i),
        evidenceIds: expect.arrayContaining(["docs-keeper", "docs-readonly-tables", "docs-replication"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "keeper-quorum-loss",
      selectedMechanismId: "architecture.keeper",
    });

    const tinyInsert = await play.execute({ scenario: "tiny-insert-storm" });
    expect(tinyInsert).toMatchObject({
      ok: true,
      scenario: {
        id: "tiny-insert-storm",
        primaryMechanismId: "mergetree.parts-pressure",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/asynchronous inserts/i),
        evidenceIds: expect.arrayContaining(["docs-mergetree", "docs-async-inserts"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "tiny-insert-storm",
      selectedMechanismId: "mergetree.parts-pressure",
    });

    const partitionExplosion = await play.execute({ scenario: "partition-explosion" });
    expect(partitionExplosion).toMatchObject({
      ok: true,
      scenario: {
        id: "partition-explosion",
        primaryMechanismId: "mergetree.partition-boundary",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/years retention|partitioning only/i),
        evidenceIds: expect.arrayContaining(["docs-partitioning-key", "docs-mergetree"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "partition-explosion",
      selectedMechanismId: "mergetree.partition-boundary",
    });

    await recommend.execute({
      ...profile,
      workload: "cdc",
      ingestRate: "high",
      retention: "months",
      updates: "frequent",
    });
    const backgroundContention = await play.execute({ scenario: "merge-ttl-contention" });
    expect(backgroundContention).toMatchObject({
      ok: true,
      scenario: {
        id: "merge-ttl-contention",
        primaryMechanismId: "observability.merges",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/appended versions|do not overlap broad mutations|separate windows/i),
        rationale: expect.stringMatching(/finite CPU and storage path/i),
        evidenceIds: expect.arrayContaining(["docs-system-merges", "docs-ttl", "docs-mutations"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "merge-ttl-contention",
      selectedMechanismId: "observability.merges",
    });

    const badOrdering = await play.execute({ scenario: "bad-order-by" });
    expect(badOrdering).toMatchObject({
      ok: true,
      scenario: {
        id: "bad-order-by",
        primaryMechanismId: "read.ordering",
      },
      avoidance: {
        personalized: true,
        recommendation: expect.stringMatching(/business key|version or event time|EXPLAIN indexes/i),
        rationale: expect.stringMatching(/contiguous ranges|sparse marks/i),
        evidenceIds: expect.arrayContaining(["docs-primary-index"]),
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "bad-order-by",
      selectedMechanismId: "read.ordering",
    });
  });

  it("focuses living MergeTree families and compares argMax with FINAL", async () => {
    const tools = createToolDefinitions();
    const describeWorld = tools.find((tool) => tool.name === "describe_clickhouse_world")!;
    const inspect = tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!;
    const compare = tools.find((tool) => tool.name === "compare_clickhouse_methods")!;

    expect(await describeWorld.execute({})).toMatchObject({ mergeTreeFamilies: expect.arrayContaining([expect.objectContaining({ id: "coalescing", analogy: "Sparse mosaic assembler" })]) });
    expect(await inspect.execute({ mergeFamilyId: "replacing", latestReadStrategy: "final" })).toMatchObject({ ok: true, view: "family-machine", latestReadStrategy: "final" });
    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "replacing", latestReadStrategy: "final", selectedMechanismId: null });
    expect(await compare.execute({ comparison: "argmax-vs-final" })).toMatchObject({ ok: true, comparison: "argmax-vs-final", view: "latest-state-comparison", methods: expect.arrayContaining([expect.objectContaining({ id: "argmax" }), expect.objectContaining({ id: "final" })]) });
    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "replacing", latestReadComparison: "argmax-vs-final", journeyPanelOpen: false });

    expect(await compare.execute({ comparison: "materialized-view-vs-projection" })).toMatchObject({
      ok: true,
      comparison: "materialized-view-vs-projection",
      view: "derived-data-comparison",
      materializedView: { id: "precompute.materialized-view" },
      projection: { id: "precompute.projection" },
      decisionInputs: {
        materializedView: ["repeated-aggregation", "transform-or-route"],
        projection: ["alternate-order", "transparent-acceleration"],
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      selectedMechanismId: "precompute.materialized-view",
      comparisonIds: ["precompute.materialized-view", "precompute.projection"],
      journeyPanelOpen: false,
    });

    expect(await inspect.execute({ mergeFamilyId: "summing" })).toMatchObject({
      ok: true,
      latestReadStrategy: "background",
      family: {
        exactReadContract: {
          demonstration: { partA: 5, partB: 7, storedPartial: 12, recentPart: 4, exactTotal: 16 },
        },
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "summing", latestReadStrategy: "background", latestReadComparison: null });

    expect(await inspect.execute({ mergeFamilyId: "coalescing", latestReadStrategy: "final" })).toMatchObject({ ok: true, latestReadStrategy: "final" });
    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "coalescing", latestReadStrategy: "final", latestReadComparison: null });

    expect(await inspect.execute({ mergeFamilyId: "aggregating" })).toMatchObject({
      ok: true,
      family: {
        aggregateStateContract: {
          demonstration: {
            partA: { sum: 20, count: 2 },
            partB: { sum: 90, count: 3 },
            mergedState: { sum: 110, count: 5 },
            finalizedAverage: 22,
          },
        },
      },
    });

    expect(await inspect.execute({ mergeFamilyId: "collapsing" })).toMatchObject({
      ok: true,
      family: {
        collapsingContract: {
          demonstration: {
            oldState: { pageViews: 5, durationSeconds: 146, sign: 1 },
            cancel: { pageViews: 5, durationSeconds: 146, sign: -1 },
            replacement: { pageViews: 6, durationSeconds: 185, sign: 1 },
            exactResult: { pageViews: 6, durationSeconds: 185 },
          },
        },
      },
    });

    expect(await inspect.execute({ mergeFamilyId: "versioned-collapsing" })).toMatchObject({
      ok: true,
      family: {
        versionedCollapsingContract: {
          demonstration: {
            arrivalOrder: ["v2-state", "v1-cancel", "v1-state"],
            collapsedPair: ["v1-state", "v1-cancel"],
            survivor: "v2-state",
          },
        },
      },
    });
  });

  it("opens two reviewed production implementations as the visible comparison", async () => {
    const compare = createToolDefinitions().find((tool) => tool.name === "compare_clickhouse_methods")!;

    const result = await compare.execute({
      firstImplementationId: "cloudflare-http-analytics",
      secondImplementationId: "highlevel-notifications-analytics",
    });

    expect(result).toMatchObject({
      ok: true,
      comparison: "production-implementations",
      first: { company: "Cloudflare", declaredFamilies: expect.arrayContaining(["summing"]) },
      second: { company: "HighLevel", declaredFamilies: expect.arrayContaining(["summing"]) },
      declaredOverlap: { families: ["summing"], sameWorkload: true },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      selectedEvidenceId: "cloudflare-http-analytics",
      evidenceComparisonId: "highlevel-notifications-analytics",
      selectedMechanismId: null,
    });
  });

  it("plays an explicitly disclosed company architecture without inventing steps", async () => {
    const play = createToolDefinitions().find((tool) => tool.name === "play_architecture_story")!;

    expect(await play.execute({ implementationId: "cloudflare-http-analytics" })).toMatchObject({
      ok: true,
      story: "company-architecture",
      implementation: {
        company: "Cloudflare",
        mechanismPath: [
          "ingestion.client-batching",
          "precompute.aggregate-states",
          "precompute.materialized-view",
          "architecture.replication",
        ],
      },
    });
    expect(useAtlasStore.getState()).toMatchObject({
      storyMode: "architecture",
      selectedMechanismId: "ingestion.client-batching",
      mergeFamilyId: "summing",
      latestReadStrategy: "background",
    });
  });

  it("rejects unknown mechanism IDs and malformed tool inputs", async () => {
    const tools = createToolDefinitions();
    const inspect = tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!;
    const compare = tools.find((tool) => tool.name === "compare_clickhouse_methods")!;
    const search = tools.find((tool) => tool.name === "search_clickhouse_evidence")!;

    await expect(inspect.execute({ mechanismId: "custom.shader", view: "xray" })).rejects.toThrow();
    await expect(inspect.execute({ mergeFamilyId: "replacing", latestReadStrategy: "shader" })).rejects.toThrow();
    await expect(inspect.execute({ mergeFamilyId: "merge", latestReadStrategy: "argmax" })).rejects.toThrow(/not a reviewed read contract/);
    await expect(compare.execute({ firstId: "read.sparse-index", secondId: "read.sparse-index", geometry: "https://example.com/model.glb" })).rejects.toThrow();
    await expect(compare.execute({ firstImplementationId: "cloudflare-http-analytics" })).rejects.toThrow();
    await expect(search.execute({ query: "x" })).rejects.toThrow();
  });
});
