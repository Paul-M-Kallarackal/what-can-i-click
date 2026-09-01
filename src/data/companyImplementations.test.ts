import { describe, expect, it } from "vitest";
import { COMPANY_IMPLEMENTATIONS, matchCompanyImplementations, MERGE_FAMILY_EVIDENCE_GAPS } from "./companyImplementations";

describe("reviewed company implementations", () => {
  it("ships a sizeable, uniquely sourced primary corpus without invented versions", () => {
    expect(COMPANY_IMPLEMENTATIONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(COMPANY_IMPLEMENTATIONS.map((entry) => entry.id)).size).toBe(COMPANY_IMPLEMENTATIONS.length);
    expect(new Set(COMPANY_IMPLEMENTATIONS.map((entry) => entry.source.url)).size).toBe(COMPANY_IMPLEMENTATIONS.length);

    for (const entry of COMPANY_IMPLEMENTATIONS) {
      expect(entry.source.primary).toBe(true);
      expect(entry.source.url).toMatch(/^https:\/\//);
      expect(entry.source.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.scale.length).toBeGreaterThan(0);
      expect(entry.mechanisms.length).toBeGreaterThan(0);
      expect(entry.version).toMatch(/^(Not disclosed|\d{2}\.\d{1,2}( \([A-Za-z -]+\))?)$/);
    }

    expect(COMPANY_IMPLEMENTATIONS.filter((entry) => entry.version !== "Not disclosed").map((entry) => [entry.company, entry.version])).toEqual([
      ["Common Room", "23.12 (FINAL performance observation)"],
      ["Appcues", "25.6 (lightweight deletes)"],
    ]);
  });

  it("covers the publicly disclosed MergeTree family production patterns", () => {
    const covered = new Set(COMPANY_IMPLEMENTATIONS.flatMap((entry) => entry.mergeFamilyIds));
    expect(covered).toEqual(new Set(["merge", "replacing", "summing", "aggregating", "collapsing", "versioned-collapsing"]));
    expect(MERGE_FAMILY_EVIDENCE_GAPS.coalescing?.officialPatternUrl).toBe("https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/coalescingmergetree");
  });

  it("returns bounded, deterministic side-by-side matches", () => {
    const cdc = matchCompanyImplementations({ workload: "cdc", mergeFamilyId: "replacing" }, 2);
    expect(cdc).toHaveLength(2);
    expect(cdc[0].implementation.company).toBe("Common Room");
    expect(cdc[0].matchedOn).toEqual(["workload:cdc", "family:replacing"]);

    const observability = matchCompanyImplementations({ mechanismId: "read.data-skipping", query: "Bloom" }, 10);
    expect(observability.length).toBeLessThanOrEqual(6);
    expect(observability.some((result) => result.implementation.company === "OpenAI")).toBe(true);
    expect(observability.some((result) => result.implementation.company === "Mercado Libre")).toBe(true);
  });

  it("keeps disclosed family and latest-read decisions attached to their primary accounts", () => {
    const highLevel = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "HighLevel")!;
    expect(highLevel.mergeFamilyIds).toEqual(["replacing", "summing"]);
    expect(highLevel.mechanisms).toContain("argMax");
    expect(highLevel.tradeoff).toContain("FINAL");

    const appcues = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "Appcues")!;
    expect(appcues.mergeFamilyIds).toEqual(["replacing"]);
    expect(appcues.version).toBe("25.6 (lightweight deletes)");

    const flock = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "Flock Safety")!;
    expect(flock.mergeFamilyIds).toEqual(["aggregating", "replacing"]);
    expect(flock.relatedMechanismIds).toContain("precompute.aggregate-states");

    const dash0 = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "Dash0")!;
    expect(dash0.mergeFamilyIds).toEqual(["aggregating"]);
    expect(dash0.mechanisms).toContain("GROUP BY merge functions");
    expect(dash0.mechanisms).toContain("FINAL");

    const commonRoom = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "Common Room")!;
    expect(commonRoom.version).toBe("23.12 (FINAL performance observation)");
    expect(commonRoom.relatedMechanismIds).not.toContain("ingestion.cdc");

    const polymarket = COMPANY_IMPLEMENTATIONS.find((entry) => entry.company === "Polymarket")!;
    expect(polymarket.mergeFamilyIds).toEqual(["merge"]);
    expect(polymarket.mechanisms).toContain("MergeTree");
    expect(polymarket.version).toBe("Not disclosed");
    expect(polymarket.source.url).toBe("https://clickhouse.com/blog/how-polymarket-scales-data-with-postgres-and-clickhouse");
    expect(polymarket.source.url).not.toMatch(/medium|hexens/i);
  });

  it("keeps the newly reviewed architecture claims pinned to their exact primary accounts", () => {
    const modal = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "modal-ai-runtime-observability")!;
    expect(modal.mergeFamilyIds).toEqual(["replacing"]);
    expect(modal.mechanisms).toEqual(expect.arrayContaining(["ReplacingMergeTree", "argMaxIf", "sortable ULIDs"]));
    expect(modal.version).toBe("Not disclosed");
    expect(modal.source.url).toBe("https://clickhouse.com/blog/modal-real-time-observability-ai-workloads");

    const hud = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "hud-runtime-telemetry-enrichment")!;
    expect(hud.mergeFamilyIds).toEqual(["replacing"]);
    expect(hud.mechanisms).toEqual(expect.arrayContaining(["Null table engine", "dictionaries", "ReplacingMergeTree"]));

    const openMeter = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "openmeter-usage-billing-windows")!;
    expect(openMeter.mergeFamilyIds).toEqual(["aggregating"]);
    expect(openMeter.mechanisms).toEqual(expect.arrayContaining(["Kafka backpressure", "materialized views", "AggregatingMergeTree"]));

    const cisco = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "cisco-talos-threat-reputation")!;
    expect(cisco.mergeFamilyIds).toEqual([]);
    expect(cisco.mechanisms).toEqual(expect.arrayContaining(["SharedMergeTree", "sharded ClickPipes", "AWS PrivateLink"]));
    expect(cisco.source.url).toBe("https://clickhouse.com/blog/cisco");

    const cogent = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "cogent-agentic-vulnerability-analytics")!;
    expect(cogent.mechanisms).toEqual(expect.arrayContaining(["projections", "agentic SQL validation"]));
    expect(cogent.relatedMechanismIds).toEqual(expect.arrayContaining(["precompute.projection", "precompute.write-amplification"]));

    const doControl = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "docontrol-mcp-security-analytics")!;
    expect(doControl.mechanisms).toEqual(expect.arrayContaining(["ClickHouse MCP", "supervisor agent", "specialized sub-agents"]));
    expect(doControl.mergeFamilyIds).toEqual([]);
  });

  it("pins the major-company expansion to reviewed primary accounts without inventing releases or families", () => {
    const microsoft = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "microsoft-clarity-web-analytics")!;
    expect(microsoft.source).toEqual(expect.objectContaining({
      url: "https://clarity.microsoft.com/blog/why-microsoft-clarity-chose-clickhouse/",
      publisher: "Microsoft Clarity Blog",
      kind: "company-engineering",
      primary: true,
    }));
    expect(microsoft.mechanisms).toEqual(expect.arrayContaining(["ReplicatedMergeTree", "large-batch routing service", "layered bi-sharding"]));
    expect(microsoft.mergeFamilyIds).toEqual(["merge"]);

    const lyft = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "lyft-batch-realtime-analytics")!;
    expect(lyft.source.url).toBe("https://clickhouse.com/blog/lyft-analytics-clickhouse-cloud");
    expect(lyft.mechanisms).toEqual(expect.arrayContaining(["S3 table function", "Apache Flink", "protobuf IDL reflection"]));
    expect(lyft.mergeFamilyIds).toEqual([]);

    const deshaw = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "deshaw-high-cardinality-observability")!;
    expect(deshaw.source.url).toBe("https://clickhouse.com/blog/deshaw");
    expect(deshaw.mechanisms).toEqual(expect.arrayContaining(["InfluxDB line protocol", "custom disk-level backfill", "materialized views"]));
    expect(deshaw.mergeFamilyIds).toEqual([]);

    const visa = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "visa-conversational-payments-analytics")!;
    expect(visa.source.url).toBe("https://clickhouse.com/blog/visa-conversational-agents");
    expect(visa.mechanisms).toEqual(expect.arrayContaining(["PGP-encrypted S3 handoff", "AWS PrivateLink", "ClickHouse MCP"]));
    expect(visa.mergeFamilyIds).toEqual([]);

    const sony = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "sony-liv-streaming-analytics")!;
    expect(sony.source.url).toBe("https://clickhouse.com/blog/sony-liv-real-time-analytics");
    expect(sony.mechanisms).toEqual(expect.arrayContaining(["Amazon Kinesis", "ClickPipes", "QoE analytics"]));
    expect(sony.mergeFamilyIds).toEqual([]);

    expect([microsoft, lyft, deshaw, visa, sony].map((entry) => entry.version)).toEqual(Array(5).fill("Not disclosed"));
  });

  it("finds the new production patterns without a hard-coded corpus count", () => {
    expect(matchCompanyImplementations({ query: "SharedMergeTree" }, 1)[0]?.implementation.company).toBe("Cisco Talos");
    expect(matchCompanyImplementations({ query: "argMaxIf" }, 1)[0]?.implementation.company).toBe("Modal");
    expect(matchCompanyImplementations({ query: "ClickHouse MCP" }, 1)[0]?.implementation.company).toBe("DoControl");
  });

  it("finds the expanded primary corpus by disclosed architecture terms", () => {
    expect(matchCompanyImplementations({ query: "ReplicatedMergeTree" }, 1)[0]?.implementation.company).toBe("Microsoft Clarity");
    expect(matchCompanyImplementations({ query: "protobuf IDL reflection" }, 1)[0]?.implementation.company).toBe("Lyft");
    expect(matchCompanyImplementations({ query: "InfluxDB line protocol" }, 1)[0]?.implementation.company).toBe("D. E. Shaw");
    expect(matchCompanyImplementations({ query: "PGP-encrypted S3 handoff" }, 1)[0]?.implementation.company).toBe("Visa");
    expect(matchCompanyImplementations({ query: "QoE analytics" }, 1)[0]?.implementation.company).toBe("Sony LIV");
  });
});
