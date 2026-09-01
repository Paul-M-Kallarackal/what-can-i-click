import { expect, test } from "@playwright/test";
import { USE_CASE_JOURNEYS } from "../src/data/useCaseJourneys";

test("renders the MergeTree foundry without browser or WebGL errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if ((message.type() === "error" || message.type() === "warning") && !message.text().includes("GL Driver Message")) errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "MergeTree" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".foundry-legend")).toContainText("Part A / B / C");
  await expect(page.locator(".world-canvas").getByText("ACTIVE PARTS · IMMUTABLE COLUMN FILES", { exact: true })).toBeVisible();
  await page.waitForFunction(() => Number(document.documentElement.dataset.sceneFps) > 0);
  const canvasSignal = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return { available: Boolean(context), error: context?.getError() ?? null };
  });
  expect(canvasSignal).toEqual({ available: true, error: 0 });
  expect(errors).toEqual([]);
});

test("an in-browser WebMCP agent can stage a bounded architecture path", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } } });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length >= 7);
  const result = await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    return tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!.execute({
      workload: "product-analytics", ingestRate: "extreme", latencyTarget: "interactive", retention: "years",
      updates: "occasional", availability: "high", topology: "multi-region", costPriority: "performance",
    });
  }) as { path: string[]; journey: { id: string; title: string } };
  expect(result.path).toEqual(expect.arrayContaining(["architecture.sharding", "architecture.keeper"]));
  expect(result.journey.id).toBe("multi-region-product-analytics");
  await expect(page.getByRole("complementary", { name: /Multi-region product analytics guided recommendation/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Agent decision log" })).toBeVisible();
});

test("materialized views and projections keep different visible contracts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } } });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length >= 7);

  const inspect = (mechanismId: string) => page.evaluate(async (id) => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    return tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mechanismId: id });
  }, mechanismId);

  await inspect("precompute.materialized-view");
  await expect(page.locator("html")).toHaveAttribute("data-precompute-mode", "materialized-view");
  await expect(page.locator('.precompute-stage-readout[data-contract="materialized-view"]')).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("MV SELECT · NEW BLOCK ONLY", { exact: true })).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("SEPARATE TARGET TABLE", { exact: true })).toBeVisible();
  await expect(page.locator(".precompute-choice")).toContainText("Inserted block → transform → target table");

  await inspect("precompute.projection");
  await expect(page.locator("html")).toHaveAttribute("data-precompute-mode", "projection");
  await expect(page.locator('.precompute-stage-readout[data-contract="projection"]')).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("SAME TABLE · ATTACHED TO EACH PART", { exact: true })).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("OPTIMIZER CHOOSES", { exact: true })).toBeVisible();
  await expect(page.locator(".precompute-choice")).toContainText("Base part + attached alternate layout");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "compare_clickhouse_methods")!.execute({ comparison: "materialized-view-vs-projection" });
  });
  await expect(page.locator("html")).toHaveAttribute("data-precompute-mode", "comparison");
  await expect(page.locator('.precompute-stage-readout[data-contract="comparison"]')).toContainText("SAME INPUT · DIFFERENT CONTRACTS");
  await expect(page.locator(".world-canvas").getByText("MV · TRANSFORM", { exact: true })).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("PROJECTION · ATTACHED", { exact: true })).toBeVisible();
  await expect(page.locator(".comparison-grid")).toContainText("View");
  await expect(page.locator(".comparison-grid")).toContainText("Projection");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  await expect(page.locator('.precompute-stage-readout[data-contract="comparison"]')).toBeVisible();
});

test("an agent-selected latest-state method stays synchronized with its 3D family machine", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } } });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length >= 7);

  const inspectFamily = (latestReadStrategy: "argmax" | "final") => page.evaluate(async (strategy) => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    return tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({
      mergeFamilyId: "replacing",
      latestReadStrategy: strategy,
    });
  }, latestReadStrategy);

  await inspectFamily("final");
  const workbench = page.getByRole("complementary", { name: "ReplacingMergeTree workbench" });
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole("region", { name: "Selected latest-state read method" })).toContainText("SELECT FINAL");
  await expect(page.locator(".world-canvas").getByText("SELECT FINAL PRESS", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("complementary", { name: "ReplacingMergeTree workbench" })).toBeVisible();

  await inspectFamily("argmax");
  await expect(workbench.getByRole("region", { name: "Selected latest-state read method" })).toContainText("argMax");
  await expect(page.locator(".world-canvas").getByText("ARGMAX WINNER CRANE", { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "compare_clickhouse_methods")!.execute({ comparison: "argmax-vs-final" });
  });
  await expect(workbench.getByRole("region", { name: "argMax versus SELECT FINAL comparison" })).toContainText("Two correctness contracts");
  await expect(page.locator(".world-canvas").getByText("ARGMAX vs SELECT FINAL", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-replacing-strategy", "argmax-vs-final");

  await workbench.getByRole("button", { name: "Back to MergeTree" }).click();
  await expect(page.getByRole("complementary", { name: "MergeTree workbench" })).toBeVisible();
  await expect(page.locator(".world-canvas").getByText("MERGE WORKER", { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "coalescing", latestReadStrategy: "final" });
  });
  const coalescing = page.getByRole("complementary", { name: "CoalescingMergeTree workbench" });
  await expect(coalescing.getByRole("region", { name: "Selected latest-state read method" })).toContainText("SELECT FINAL");
  await expect(page.locator(".world-canvas").getByText("SELECT FINAL MOSAIC LIGHT TABLE", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-coalescing-strategy", "final");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "coalescing" });
  });
  await expect(page.locator(".world-canvas").getByText("BACKGROUND MOSAIC KILN", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-coalescing-strategy", "background");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "summing" });
  });
  const summing = page.getByRole("complementary", { name: "SummingMergeTree workbench" });
  await expect(summing.getByRole("region", { name: "SummingMergeTree exact-read contract" })).toContainText("Aggregate every visible row");
  await expect(page.locator(".world-canvas").getByText("SUMMINGMERGETREE · ONE SORTING KEY", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-summing-contract", "partial-storage-exact-read");
  await expect(page.locator("html")).toHaveAttribute("data-summing-exact-total", "16");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "aggregating" });
  });
  const aggregating = page.getByRole("complementary", { name: "AggregatingMergeTree workbench" });
  await expect(aggregating.getByRole("region", { name: "AggregatingMergeTree state contract" })).toContainText("Write -State · read matching -Merge");
  await expect(page.locator(".world-canvas").getByText("AGGREGATINGMERGETREE · avgState EXAMPLE", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-aggregating-contract", "state-merge-finalize");
  await expect(page.locator("html")).toHaveAttribute("data-aggregating-final-value", "22");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "collapsing" });
  });
  const collapsing = page.getByRole("complementary", { name: "CollapsingMergeTree workbench" });
  await expect(collapsing.getByRole("region", { name: "CollapsingMergeTree exact-read contract" })).toContainText("Account for Sign before merges converge");
  await expect(page.locator(".world-canvas").getByText("COLLAPSINGMERGETREE · ONE VALID HISTORY", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-collapsing-contract", "matched-pair-sign-aware-read");
  await expect(page.locator("html")).toHaveAttribute("data-collapsing-survivor", "6-views-185-seconds");

  await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    await tools.find((tool) => tool.name === "inspect_clickhouse_mechanism")!.execute({ mergeFamilyId: "versioned-collapsing" });
  });
  const versioned = page.getByRole("complementary", { name: "VersionedCollapsingMergeTree workbench" });
  await expect(versioned.getByRole("region", { name: "VersionedCollapsingMergeTree version contract" })).toContainText("Same key · same version · opposite Sign");
  await expect(page.locator(".world-canvas").getByText("VERSIONEDCOLLAPSINGMERGETREE · OUT-OF-ORDER INPUT", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-versioned-collapsing-contract", "same-key-version-opposite-sign");
  await expect(page.locator("html")).toHaveAttribute("data-versioned-collapsing-survivor", "v2-sign-plus-one");
});

test("all reviewed workload profiles return their matching WebMCP journey", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } } });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length >= 7);
  for (const journey of USE_CASE_JOURNEYS) {
    const result = await page.evaluate(async (profile) => {
      const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
      return tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!.execute(profile);
    }, journey.profile) as { journey: { id: string } };
    expect(result.journey.id).toBe(journey.id);
    await expect(page.getByRole("complementary", { name: `${journey.title} guided recommendation` })).toBeVisible();
  }
});

test("keeps agent-only journeys, search, and the text system map out of the manual UI", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /10 use cases/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open accessible system map" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Search mechanisms and evidence" })).toHaveCount(0);
  await expect(page.locator(".journey-panel")).toHaveCount(0);
});

test("keeps the manual world stable and hands personalization to WebMCP", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Stable architecture walkthrough")).toContainText("Fit ClickHouse to my workload");
  await expect(page.getByRole("menu", { name: "ClickHouse operational scenarios" })).toHaveCount(0);
  await expect(page.locator(".merge-tree-monument-label")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "ClickHouse model telemetry" })).toContainText("Healthy");
});

test("respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "MergeTree" })).toBeVisible();
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.sceneFps));
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      fps: Number(document.documentElement.dataset.sceneFps),
      drawCalls: Number(document.documentElement.dataset.sceneDrawCalls),
    }));
    expect(layout.overflow).toBe(false);
    expect(layout.fps).toBeGreaterThan(0);
    if (viewport.width >= 1280) expect(layout.drawCalls).toBeLessThanOrEqual(220);
  });
}
