import { expect, test } from "@playwright/test";

test("keeps the white MergeTree foundry legible on desktop and mobile", async ({ page }) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const viewport of [
    { width: 1280, height: 720, headingFloor: 40 },
    { width: 390, height: 844, headingFloor: 34 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
    const metrics = await workbench.evaluate((element) => {
      const read = (selector: string) => Number.parseFloat(getComputedStyle(element.querySelector<HTMLElement>(selector)!).fontSize);
      const panel = element.getBoundingClientRect();
      const controls = document.querySelector<HTMLElement>(".simulation-dock")!.getBoundingClientRect();
      return {
        background: getComputedStyle(document.querySelector<HTMLElement>(".app-shell")!).backgroundColor,
        heading: read(".merge-title-row h1"),
        body: read(":scope > header p"),
        scenarioTitle: read(".merge-scenario-card > header > strong"),
        scenarioBody: read(".merge-scenario-card > p"),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        aboveControls: panel.bottom < controls.top,
      };
    });

    expect(metrics.background).toBe("rgb(255, 255, 255)");
    expect(metrics.heading).toBeGreaterThanOrEqual(viewport.headingFloor);
    expect(metrics.body).toBeGreaterThanOrEqual(16);
    expect(metrics.scenarioTitle).toBeGreaterThanOrEqual(20);
    expect(metrics.scenarioBody).toBeGreaterThanOrEqual(15);
    expect(metrics.horizontalOverflow).toBe(false);
    expect(metrics.insideViewport).toBe(true);
    expect(metrics.aboveControls).toBe(true);

    const scenarioButton = page.locator(".scenario-picker__trigger");
    await scenarioButton.click();
    const menu = page.getByRole("menu", { name: "ClickHouse operational scenarios" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitemradio")).toHaveCount(8);
    const menuMetrics = await menu.evaluate((element) => ({
      overflow: element.scrollWidth > element.clientWidth + 1,
      title: Number.parseFloat(getComputedStyle(element.querySelector("header strong")!).fontSize),
      item: Number.parseFloat(getComputedStyle(element.querySelector("button strong")!).fontSize),
    }));
    expect(menuMetrics.overflow).toBe(false);
    expect(menuMetrics.title).toBeGreaterThanOrEqual(15);
    expect(menuMetrics.item).toBeGreaterThanOrEqual(13);
  }

  expect(browserErrors).toEqual([]);
});
