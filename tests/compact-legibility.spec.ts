import { expect, test } from "@playwright/test";

test("keeps the single MergeTree scenario card readable at compact desktop heights", async ({ page }) => {
  test.setTimeout(60_000);

  for (const height of [720, 650, 600]) {
    await page.setViewportSize({ width: 1022, height });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
    const scenario = workbench.locator(".merge-scenario-card");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByRole("heading", { name: "MergeTree" })).toBeVisible();
    await expect(scenario).toContainText("Steady ClickHouse");
    await expect(page.getByLabel("Stable architecture walkthrough")).toContainText("Fit ClickHouse to my workload");
    await expect(page.getByRole("textbox", { name: "Search mechanisms and evidence" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /10 use cases/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open accessible system map" })).toHaveCount(0);

    const metrics = await workbench.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const scenarioCard = element.querySelector<HTMLElement>(".merge-scenario-card")!;
      const card = scenarioCard.getBoundingClientRect();
      const body = scenarioCard.querySelector<HTMLElement>(":scope > p")!;
      const title = scenarioCard.querySelector<HTMLElement>(":scope > header > strong")!;
      return {
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        cardInsidePanel: card.top >= panel.top - 1 && card.bottom <= panel.bottom + 1,
        panelInsideViewport: panel.top >= 0 && panel.bottom <= window.innerHeight + 1,
        titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
        bodySize: Number.parseFloat(getComputedStyle(body).fontSize),
      };
    });

    expect(metrics).toMatchObject({ horizontalOverflow: false, cardInsidePanel: true, panelInsideViewport: true });
    expect(metrics.titleSize).toBeGreaterThanOrEqual(20);
    expect(metrics.bodySize).toBeGreaterThanOrEqual(14);
  }
});

test("keeps the mobile MergeTree scenario readable without telemetry collision", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const workbench = page.getByRole("complementary", { name: "MergeTree workbench" });
  const scenario = workbench.locator(".merge-scenario-card");
  await expect(scenario).toContainText("Steady ClickHouse");

  const metrics = await workbench.evaluate((element) => {
    const size = (selector: string) => Number.parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize);
    const panel = element.getBoundingClientRect();
    const controls = document.querySelector<HTMLElement>(".simulation-dock")!.getBoundingClientRect();
    return {
      heading: size(".merge-title-row h1"),
      scenarioTitle: size(".merge-scenario-card > header > strong"),
      body: size(".merge-scenario-card > p"),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      telemetryVisible: getComputedStyle(document.querySelector(".operational-hud")!).display !== "none",
      panelAboveControls: panel.bottom < controls.top,
    };
  });

  expect(metrics.horizontalOverflow).toBe(false);
  expect(metrics.telemetryVisible).toBe(false);
  expect(metrics.panelAboveControls).toBe(true);
  expect(metrics.heading).toBeGreaterThanOrEqual(34);
  expect(metrics.scenarioTitle).toBeGreaterThanOrEqual(20);
  expect(metrics.body).toBeGreaterThanOrEqual(15);
});
