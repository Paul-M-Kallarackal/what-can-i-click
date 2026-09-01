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
    const playwrightTraceProbe = text === "This document requires 'TrustedScript' assignment. The action has been blocked.";
    if ((isError || isWebGlWarning) && !text.includes("GL Driver Message") && !playwrightTraceProbe) {
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
  await expect(page.getByLabel("Stable architecture walkthrough")).toBeVisible();
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

  test("replays the stable MergeTree machine without losing WebGL", async ({ page }) => {
    test.setTimeout(60_000);
    const monitor = monitorBrowser(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas")).toBeVisible();

    for (let round = 0; round < 4; round += 1) {
      await page.getByRole("button", { name: "Pause simulation" }).click();
      await expect(page.getByRole("button", { name: "Play simulation" })).toBeVisible();
      await page.getByRole("button", { name: "Play simulation" }).click();
      await page.getByRole("button", { name: "Reset foundry" }).click();
      await expect(page.getByLabel("Stable architecture walkthrough")).toContainText("Fit ClickHouse to my workload");
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

    const guideBounds = await page.getByLabel("Stable architecture walkthrough").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right };
    });
    expect(guideBounds.left).toBeGreaterThanOrEqual(-1);
    expect(guideBounds.right).toBeLessThanOrEqual(391);
    monitor.expectClean();
  });

  test("opens an agent-requested journey while the scene remains healthy", async ({ page }) => {
    test.setTimeout(60_000);
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
    }) as {
      decisions: Array<{ mechanismId: string; title: string }>;
      mergeFamilyRecommendation: { familyId: string; latestReadStrategy: string };
      visualGuide: { currentStep: string };
    };

    expect(result.visualGuide.currentStep).toBe(result.decisions[0]?.mechanismId);
    const guide = page.getByRole("complementary", { name: "Your ClickHouse architecture recommendation" });
    await expect(guide).toBeVisible();
    await expect(guide).toContainText(result.decisions[0]!.title);
    await expect(guide.getByText("CDC", { exact: true })).toBeVisible();
    await expect(guide.getByText(/Use ClickPipes where the source is supported/)).toBeVisible();
    await expect(page.locator(".family-workbench")).toHaveCount(0);
    await expect(guide.getByRole("region", { name: "Recommended MergeTree storage and read contract" })).toContainText("ReplacingMergeTree");
    await expect(guide.getByRole("region", { name: "Recommended MergeTree storage and read contract" })).toContainText("argMax current-state reads");

    const progress = guide.getByRole("navigation", { name: "Recommendation steps" });
    const slider = guide.getByRole("slider", { name: "Move through the recommended architecture" });
    const stepCount = await progress.getByRole("button").count();
    expect(stepCount).toBeGreaterThan(1);

    await expect(progress.getByRole("button").first()).toHaveAttribute("data-active", "true");
    await guide.getByRole("button", { name: "Next decision", exact: true }).click({ force: true });
    await expect(progress.getByRole("button").nth(1)).toHaveAttribute("data-active", "true");
    const partitionStepIndex = result.decisions.findIndex((entry) => entry.mechanismId === "mergetree.partition-boundary");
    expect(partitionStepIndex).toBeGreaterThanOrEqual(0);
    await progress.getByRole("button").nth(partitionStepIndex).click();
    await expect(page.locator(".partition-boundary-label")).toContainText("PARTS NEVER MERGE ACROSS IT");
    const sliderBounds = await slider.boundingBox();
    expect(sliderBounds).not.toBeNull();
    const startX = sliderBounds!.x + (partitionStepIndex / (stepCount - 1)) * sliderBounds!.width;
    const y = sliderBounds!.y + sliderBounds!.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(sliderBounds!.x + sliderBounds!.width - 2, y, { steps: 12 });
    await page.mouse.up();
    await expect(progress.getByRole("button").last()).toHaveAttribute("data-active", "true");
    await expect(page.locator(".inspector-shell")).toHaveCount(0);
    await expect(guide.getByRole("button", { name: "Play the architecture", exact: true })).toBeVisible();
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
