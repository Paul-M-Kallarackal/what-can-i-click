import { expect, test } from "@playwright/test";
import { mergeFamilyById } from "../src/data/mergeFamilies";

const mergeTree = mergeFamilyById("merge");

test.describe("single MergeTree workbench responsiveness", () => {
  for (const height of [720, 912]) {
    test(`keeps the stable guide and scene available at 1022x${height}`, async ({ page }) => {
      await page.setViewportSize({ width: 1022, height });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
      const stableGuide = page.getByLabel("Explore ClickHouse gotchas");
      await expect(workbench).toBeVisible();
      await expect(workbench.getByRole("heading", { name: "MergeTree" })).toBeVisible();
      await expect(workbench.getByText(mergeTree.shortTitle, { exact: true })).toBeVisible();
      await expect(stableGuide).toContainText("Explore 6 gotchas");
      await expect(page.locator(".world-canvas canvas")).toBeVisible();
      await expect(page.getByRole("menu", { name: "ClickHouse operational scenarios" })).toHaveCount(0);

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
    });
  }

  test("keeps the stable WebMCP handoff readable at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
    const stableGuide = page.getByLabel("Explore ClickHouse gotchas");
    await expect(workbench).toBeVisible();
    await expect(stableGuide).toContainText("or ask your agent");
    await expect(stableGuide).toContainText("Explore 6 gotchas");
    await expect(page.getByRole("menu", { name: "ClickHouse operational scenarios" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
