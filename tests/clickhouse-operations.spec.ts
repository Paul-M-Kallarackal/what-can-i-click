import { expect, test, type Page } from "@playwright/test";

/**
 * Review captures are useful when a designer runs this suite locally. They are
 * intentionally skipped on GitHub's software-rendered Chromium runner: the
 * images are not visual assertions or uploaded artifacts, and synchronous
 * WebGL readback can consume the next short semantic phase.
 */
async function captureReview(page: Page, path: string) {
  if (process.env.CI) return;
  await page.screenshot({ path });
}

test.describe("ClickHouse operational world", () => {
  test("the MergeTree crane carries one immutable part into the merge feed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".crane-payload-label")).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("PART B DROP ZONE", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("ACTIVE PARTS · IMMUTABLE COLUMN FILES", { exact: true })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.craneStage === "grip", undefined, { timeout: 13_000 });
    await page.waitForTimeout(350);
    await expect.poll(async () => {
      const card = await page.locator('.family-workbench[data-single-family="true"]').boundingBox();
      const label = await page.locator(".crane-payload-label").boundingBox();
      return card && label ? label.x - (card.x + card.width) : -1;
    }).toBeGreaterThan(8);
    await captureReview(page, "artifacts/review/crane-grip-v1.png");
    await page.waitForFunction(() => document.documentElement.dataset.craneStage === "carry", undefined, { timeout: 12_000 });
    await expect(page.locator(".crane-status")).toBeVisible();
    await captureReview(page, "artifacts/review/crane-carry-v1.png");
    await expect.poll(
      () => page.evaluate(() => document.documentElement.dataset.craneStage),
      { timeout: 15_000, intervals: [180] },
    ).toBe("release");
    await expect(page.locator(".crane-status")).toBeVisible();
    await captureReview(page, "artifacts/review/crane-release-v1.png");
  });

  test("the merge keeps machinery, source rows, and the newly written part visually distinct", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const legend = page.locator(".foundry-title");
    await expect(legend).toContainText("Part A / B / C");
    await expect(legend).toContainText("Merge machine");
    await expect(legend).toContainText("Rows from A");
    await expect(legend).toContainText("Part C · A + B");
    await expect(page.locator(".world-canvas").getByText("PART C OUTPUT", { exact: true })).toBeVisible();

    await page.waitForFunction(() => document.documentElement.dataset.mergePhase === "interleave", undefined, { timeout: 14_000 });
    await expect(page.locator('.source-part-label[data-source="a"]')).toBeVisible();
    await expect(page.locator('.source-part-label[data-source="b"]')).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("PART C · WRITING", { exact: true })).toBeVisible();
    await expect(page.locator(".crane-payload-label")).toBeHidden();
  });

  test("a committed replacement retires sources through inactive and removed states", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".world-canvas").getByText("A + B · OLD PARTS BIN", { exact: true })).toBeVisible();
    await page.waitForFunction(() => {
      const progress = Number(document.documentElement.dataset.partRetirementProgress ?? "0");
      return progress >= 0.3 && progress <= 0.7;
    }, undefined, { timeout: 14_000 });
    await captureReview(page, "artifacts/review/parts-retiring-v1.png");
    // A screenshot can consume the remaining half-second removed window on a
    // software-rendered CI GPU, so permit one deterministic loop.
    await page.waitForFunction(() => document.documentElement.dataset.partLifecycle === "removed", undefined, { timeout: 14_000 });
    await expect(page.locator(".part-lifecycle-status")).toHaveAttribute("data-state", "removed");
    await captureReview(page, "artifacts/review/parts-bin-v1.png");
  });

  test("keeps the branded tree behind the stable foundry without pressure controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("data-merge-tree-landmark", "visible");
    await expect(page.locator(".merge-tree-monument-label")).toHaveCount(0);
    await expect(page.getByRole("menu", { name: "ClickHouse operational scenarios" })).toHaveCount(0);
    await expect(page.getByLabel("Explore ClickHouse gotchas")).toContainText("Explore 6 gotchas");
    await expect(page.locator(".world-canvas").getByText("ACTIVE PARTS · IMMUTABLE COLUMN FILES", { exact: true })).toBeVisible();
  });

});
