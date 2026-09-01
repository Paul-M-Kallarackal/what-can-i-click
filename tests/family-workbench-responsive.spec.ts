import { expect, test } from "@playwright/test";

test.describe("single MergeTree workbench responsiveness", () => {
  for (const height of [720, 912]) {
    test(`keeps the scene and scenario controls available at 1022x${height}`, async ({ page }) => {
      await page.setViewportSize({ width: 1022, height });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
      const scenarioButton = page.getByRole("button", { name: "Scenario Steady" });
      await expect(workbench).toBeVisible();
      await expect(workbench.getByRole("heading", { name: "MergeTree" })).toBeVisible();
      await expect(workbench.getByText("Append-only facts", { exact: true })).toBeVisible();
      await expect(scenarioButton).toBeVisible();
      await expect(page.locator(".world-canvas canvas")).toBeVisible();
      await expect(workbench.getByRole("tab")).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(".family-workbench")!.getBoundingClientRect();
        const controls = document.querySelector<HTMLElement>(".simulation-dock")!.getBoundingClientRect();
        const canvas = document.querySelector<HTMLCanvasElement>(".world-canvas canvas")!.getBoundingClientRect();
        return {
          noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          panelInsideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
          panelAboveControls: panel.bottom < controls.top,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        };
      });

      expect(metrics).toMatchObject({ noHorizontalOverflow: true, panelInsideViewport: true, panelAboveControls: true });
      expect(metrics.canvasWidth).toBeGreaterThan(900);
      expect(metrics.canvasHeight).toBeGreaterThanOrEqual(height - 1);

      await scenarioButton.click();
      const menu = page.getByRole("menu", { name: "ClickHouse operational scenarios" });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitemradio")).toHaveCount(8);
      await menu.getByRole("menuitemradio", { name: /Tiny insert storm/ }).click();
      const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
      await expect(workbench).toHaveCount(0);
      await expect(inspector).toContainText("Too-many-parts pressure");
      await expect(inspector.locator(".scenario-recommendation")).toContainText("Tiny insert storm");
    });
  }

  test("uses the same scenario-first model at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
    const scenarioButton = page.getByRole("button", { name: "Scenario Steady" });
    await expect(workbench).toBeVisible();
    await expect(scenarioButton).toBeVisible();
    await scenarioButton.click();

    const menu = page.getByRole("menu", { name: "ClickHouse operational scenarios" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitemradio")).toHaveCount(8);
    await menu.getByRole("menuitemradio", { name: /Partition explosion/ }).click();
    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(workbench).toHaveCount(0);
    await expect(inspector.locator(".scenario-recommendation")).toContainText("Partition explosion");
    await expect.poll(() => inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
