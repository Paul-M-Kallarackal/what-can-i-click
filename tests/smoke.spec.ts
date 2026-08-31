import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("renders the living atlas without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Watch your data/ })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Play the data lifecycle" }).click();
  await expect(page.getByRole("complementary", { name: "Atlas inspector" }).getByRole("heading", { level: 2 })).toBeVisible();
  const canvasSignal = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return { available: false, error: null };
    return { available: true, error: context.getError() };
  });
  expect(canvasSignal).toEqual({ available: true, error: 0 });
  expect(errors.filter((message) => !message.includes("GL Driver Message"))).toEqual([]);
});

test("an in-browser WebMCP agent can stage an architecture path", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: (tool: typeof tools[number]) => { tools.push(tool); } },
    });
    Object.defineProperty(window, "__atlasTools", { configurable: true, value: tools });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __atlasTools: unknown[] }).__atlasTools.length === 7);
  const result = await page.evaluate(async () => {
    const tools = (window as unknown as { __atlasTools: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__atlasTools;
    const recommend = tools.find((tool) => tool.name === "recommend_clickhouse_architecture")!;
    return recommend.execute({
      workload: "product-analytics",
      ingestRate: "extreme",
      latencyTarget: "interactive",
      retention: "years",
      updates: "occasional",
      availability: "high",
      topology: "multi-region",
      costPriority: "performance",
    });
  }) as { path: string[] };
  expect(result.path).toContain("architecture");
  await expect(page.getByRole("region", { name: "Agent architecture recommendation" })).toBeVisible();
  await expect(page.getByText("Agent chose this")).toBeVisible();
  await page.screenshot({ path: "test-results/atlas-architecture-path.png", fullPage: true });
});

test("respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Watch your data/ })).toBeVisible();
  const motion = await page.locator(".hero-chunk").first().evaluate((element) => ({
    animationDuration: getComputedStyle(element).animationDuration,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }));
  expect(Number.parseFloat(motion.animationDuration)).toBeLessThanOrEqual(0.000001);
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
      fps: document.documentElement.dataset.sceneFps ?? null,
    }));
    expect(layout.overflow).toBe(false);
    if (viewport.width >= 1280) {
      expect(Number.isFinite(Number(layout.fps))).toBe(true);
      expect(Number(layout.fps)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: `test-results/atlas-${viewport.width}x${viewport.height}.png`, fullPage: true });
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Play the data lifecycle" }).click();
      await expect(page.getByRole("complementary", { name: "Atlas inspector" }).getByRole("heading", { level: 2 })).toBeVisible();
      await page.screenshot({ path: "test-results/atlas-390x844-inspector.png", fullPage: true });
    }
  });
}
