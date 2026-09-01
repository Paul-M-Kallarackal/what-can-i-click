import { expect, test, type Page } from "@playwright/test";

type BrowserMonitor = {
  issues: string[];
  expectClean: () => void;
};

function monitorBrowser(page: Page): BrowserMonitor {
  const issues: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    const isError = message.type() === "error";
    const isWebGlWarning = message.type() === "warning" && /webgl|context\s+lost|three\.webglrenderer/i.test(text);
    if ((isError || isWebGlWarning) && !text.includes("GL Driver Message")) {
      issues.push(`${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));

  return {
    issues,
    expectClean: () => expect(issues, "browser and WebGL errors").toEqual([]),
  };
}

async function expectHealthyWebGl(page: Page) {
  const signal = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return {
      connected: canvas.isConnected,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      error: context?.getError() ?? null,
    };
  });

  expect(signal.connected).toBe(true);
  expect(signal.width).toBeGreaterThan(0);
  expect(signal.height).toBeGreaterThan(0);
  expect(signal.error).toBe(0);
}

async function expectResponsiveShell(page: Page, width: number) {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    { message: `horizontal overflow at ${width}px` },
  ).toBeLessThanOrEqual(1);

  await expect(page.getByRole("button", { name: "Pause simulation" })).toBeVisible();
  await expect(page.locator(".scenario-picker__trigger")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "MergeTree workbench" })).toBeVisible();
  await expect(page.getByRole("button", { name: /10 use cases/ })).toHaveCount(0);

  const dockBounds = await page.locator(".simulation-dock").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, width: bounds.width };
  });
  expect(dockBounds.width).toBeGreaterThan(0);
  expect(dockBounds.left).toBeGreaterThanOrEqual(-1);
  expect(dockBounds.right).toBeLessThanOrEqual(width + 1);
}

test.describe("responsive and interaction stress", () => {
  test.describe.configure({ mode: "serial" });

  test("rapidly switches MergeTree pressure scenarios without losing WebGL", async ({ page }) => {
    test.setTimeout(60_000);
    const monitor = monitorBrowser(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas")).toBeVisible();

    for (let round = 0; round < 2; round += 1) {
      for (const scenario of [/Tiny insert storm/, /Partition explosion/, /ORDER BY misses the filter/]) {
        await page.locator(".scenario-picker__trigger").click();
        await page.getByRole("menuitemradio", { name: scenario }).click();
        await expect(page.getByRole("complementary", { name: "ClickHouse mechanism inspector" })).toBeVisible();
      }
    }

    await page.waitForTimeout(500);
    await expectHealthyWebGl(page);
    monitor.expectClean();
  });

  test("adapts in place across 390 to 1280 to 390 viewport resizing", async ({ page }) => {
    const monitor = monitorBrowser(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expectResponsiveShell(page, viewport.width);
      await expectHealthyWebGl(page);
    }

    const scenarioBounds = await page.locator(".scenario-picker__trigger").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right };
    });
    expect(scenarioBounds.left).toBeGreaterThanOrEqual(-1);
    expect(scenarioBounds.right).toBeLessThanOrEqual(391);
    monitor.expectClean();
  });

  test("opens an agent-requested journey while the scene remains healthy", async ({ page }) => {
    const monitor = monitorBrowser(page);
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
        workload: "cdc", ingestRate: "high", latencyTarget: "seconds", retention: "months",
        updates: "frequent", availability: "high", topology: "single-region", costPriority: "balanced",
      });
    }) as { journey: { title: string } };

    const guide = page.getByRole("complementary", { name: `${result.journey.title} guided recommendation` });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("region", { name: "Agent decision log" })).toBeVisible();

    const progress = guide.locator(".guide-progress");
    const stepCount = await progress.getByRole("button").count();
    expect(stepCount).toBeGreaterThan(1);

    for (let index = 0; index < stepCount; index += 1) {
      await expect(progress).toHaveAttribute("aria-label", `Step ${index + 1} of ${stepCount}`);
      await expect(progress.getByRole("button").nth(index)).toHaveAttribute("data-active", "true");
      await expect(page.locator(".inspector-shell")).toHaveAttribute("data-open", "false");
      if (index < stepCount - 1) await guide.getByRole("button", { name: "Next", exact: true }).click();
    }

    await expect(guide.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await expectHealthyWebGl(page);
    monitor.expectClean();
  });

  test("automatically remounts the living scene after a context-loss signal", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas")).toBeVisible();

    await page.locator("canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });

    await expect(page.getByRole("alert")).toContainText("Recovering the 3D scene");
    await expect(page.getByRole("alert")).toBeHidden({ timeout: 3_000 });
    await expect(page.locator("canvas")).toBeVisible();
    await expectHealthyWebGl(page);
  });
});
