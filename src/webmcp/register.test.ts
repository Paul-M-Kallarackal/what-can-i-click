import { beforeEach, describe, expect, it } from "vitest";
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
    expect(result).toMatchObject({ path: expect.arrayContaining(["architecture"]) });
    expect(await play.execute({})).toMatchObject({ ok: true });
    expect(useAtlasStore.getState().storyMode).toBe("architecture");
  });

  it("rejects executable or secret-bearing fields", async () => {
    const recommend = createToolDefinitions().find((tool) => tool.name === "recommend_clickhouse_architecture")!;
    await expect(recommend.execute({ ...profile, sql: "DROP TABLE x", password: "secret" })).rejects.toThrow();
  });

  it("returns bounded evidence results", async () => {
    const search = createToolDefinitions().find((tool) => tool.name === "search_clickhouse_evidence")!;
    const result = await search.execute({ query: "analytics" }) as { mechanisms: unknown[]; stories: unknown[] };
    expect(result.mechanisms.length).toBeLessThanOrEqual(6);
    expect(result.stories.length).toBeLessThanOrEqual(10);
  });
});

