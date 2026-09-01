import { expect, test, type Page } from "@playwright/test";

const stories = [
  { title: "Too many parts", scene: "Too many parts" },
  { title: "Scale and coordination", scene: "Scale and coordination" },
  { title: "Updates and deduplication", scene: "Updates and deduplication" },
  { title: "Read-path surprises", scene: "Read-path surprises" },
  { title: "Memory pressure", scene: "Memory pressure" },
  { title: "Materialized-view traps", scene: "Materialized-view traps" },
] as const;

async function openShelf(page: Page) {
  await page.getByRole("button", { name: /Explore 6 gotchas/ }).click();
  await expect(page.getByRole("region", { name: "Six common ClickHouse gotchas" })).toBeVisible();
}

for (const [index, item] of stories.entries()) {
  test(`manually discovers and scrubs ${item.title} through four beats`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      const playwrightTraceProbe = text === "This document requires 'TrustedScript' assignment. The action has been blocked.";
      if ((message.type() === "error" || message.type() === "warning") && !text.includes("GL Driver Message") && !playwrightTraceProbe) errors.push(text);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Explore 6 gotchas/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manual mode" })).toBeVisible();
    await openShelf(page);
    await expect(page.locator(".gotcha-tile")).toHaveCount(7);
    await page.getByRole("button", { name: new RegExp(item.title) }).click();
    const card = page.getByRole("complementary", { name: `${item.title} story` });
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: item.title })).toBeVisible();
    await expect(page.locator(".gotcha-scene-title")).toContainText(item.scene);
    await expect(page.locator(".gotcha-instruments article")).toHaveCount(3);
    await expect(page.locator(".gotcha-legend > div")).toHaveCount(3);

    for (const beat of ["Cause", "Impact", "Avoid", "Verify"] as const) {
      await page.getByRole("button", { name: beat, exact: true }).click();
      await expect(card.locator(".gotcha-beat-copy > span")).toHaveText(beat.toLowerCase());
    }

    const geometry = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".gotcha-story-card")!.getBoundingClientRect();
      const instruments = document.querySelector<HTMLElement>(".gotcha-instruments")!.getBoundingClientRect();
      const rail = document.querySelector<HTMLElement>(".gotcha-rail")!.getBoundingClientRect();
      const overlap = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, cardInstrumentOverlap: overlap(card, instruments), cardRailOverlap: overlap(card, rail) };
    });
    expect(geometry).toEqual({ overflow: false, cardInstrumentOverlap: false, cardRailOverlap: false });

    await page.screenshot({ path: `artifacts/review/gotcha-${index + 1}-1440x900.png` });
    await page.getByRole("button", { name: "Healthy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "MergeTree" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("WebMCP stages a personalized gotcha journey and shows the ready state", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } } });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length === 7);
  await expect(page.getByRole("button", { name: "Agent tools ready · 7" })).toBeVisible();
  const result = await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    return tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!.execute({
      workload: "observability", ingestRate: "extreme", latencyTarget: "interactive", retention: "months", updates: "append-only", availability: "high", topology: "single-region", costPriority: "balanced",
      deployment: "self-managed", insertPattern: "many-small", queryShape: "high-cardinality-aggregate", partitionCardinality: "high", materializedViewFootprint: "few",
    });
  }) as { gotchaJourney: Array<{ gotchaId: string; whyRelevant: string }> };
  expect(result.gotchaJourney.length).toBeGreaterThanOrEqual(3);
  expect(result.gotchaJourney.length).toBeLessThanOrEqual(5);
  expect(new Set(result.gotchaJourney.map((item) => item.gotchaId)).size).toBe(result.gotchaJourney.length);
  const story = page.getByRole("complementary", { name: /story$/ });
  await expect(story).toBeVisible();
  await expect(story.getByText("For your workload")).toBeVisible();
  await expect(story).toContainText(result.gotchaJourney[0]!.whyRelevant);
});

test("mobile keeps the scene above a two-snap story sheet and a fixed semantic rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openShelf(page);
  await expect(page.locator(".gotcha-shelf__grid")).toHaveCSS("grid-template-columns", /.+ .+/);
  await page.getByRole("button", { name: /Read-path surprises/ }).click();
  const card = page.getByRole("complementary", { name: "Read-path surprises story" });
  await expect(card).toHaveAttribute("data-snap", "peek");
  const peek = await card.evaluate((element) => element.getBoundingClientRect());
  expect(peek.top).toBeGreaterThan(844 * .52);
  await card.getByRole("button", { name: "Expand story" }).click();
  await expect(card).toHaveAttribute("data-snap", "full");
  const full = await card.evaluate((element) => element.getBoundingClientRect());
  expect(full.height).toBeGreaterThan(peek.height);
  const rail = page.getByLabel("Read-path surprises story controls");
  await expect(rail).toBeVisible();
  await rail.getByRole("button", { name: "Verify" }).click();
  await expect(card.locator(".gotcha-beat-copy > span")).toHaveText("verify");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  await page.screenshot({ path: "artifacts/review/gotcha-read-mobile-390x844.png" });
});
