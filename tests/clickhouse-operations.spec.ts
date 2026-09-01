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
    await expect(page.locator(".world-canvas").getByText("MERGETREE", { exact: true })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.craneStage === "grip", undefined, { timeout: 13_000 });
    await page.waitForTimeout(350);
    await expect.poll(async () => {
      const card = await page.locator('.family-workbench[data-single-family="true"]').boundingBox();
      const label = await page.locator(".crane-payload-label").boundingBox();
      return card && label ? label.x - (card.x + card.width) : -1;
    }).toBeGreaterThan(8);
    await captureReview(page, "artifacts/review/crane-grip-v1.png");
    await page.waitForFunction(() => document.documentElement.dataset.craneStage === "carry", undefined, { timeout: 6_000 });
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

  test("tiny inserts surface MergeTree part pressure and focus the owning mechanism", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Tiny insert storm/ }).click();

    const telemetry = page.getByRole("region", { name: "ClickHouse model telemetry" });
    await expect(telemetry).toContainText("Tiny inserts");
    await expect(telemetry).toContainText("MODEL · NOT LIVE CLUSTER DATA");
    await expect(page.getByRole("complementary", { name: "ClickHouse mechanism inspector" })).toContainText("Tiny insert storm");
    await expect(page.locator(".world-canvas").getByText("Every tiny insert creates storage work.", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("BACKGROUND MERGE · SLOWER", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("BATCH OR ASYNC BUFFER", { exact: true }).first()).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.tinyInsertPhase === "backlog", undefined, { timeout: 12_000 });
    await expect.poll(() => page.evaluate(() => Number(document.documentElement.dataset.tinyInsertBacklog ?? "0"))).toBeGreaterThanOrEqual(14);
    await captureReview(page, "artifacts/review/tiny-insert-backlog-v2.png");
  });

  test("tiny insert reduced motion preserves both the pressure and recovery explanation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Tiny insert storm/ }).click();

    await page.waitForFunction(() => document.documentElement.dataset.tinyInsertPhase === "recover");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.tinyInsertBacklog)).toBe("16");
    await expect(page.locator(".tiny-insert-mobile-summary")).toContainText("Many tiny parts → merge backlog");
    await expect(page.locator(".tiny-insert-mobile-summary")).toContainText("BATCH OR ASYNC BUFFER");
  });

  test("partition explosion shows one flush creating isolated merge pools", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Partition explosion/ }).click();

    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("Partition explosion");
    await expect(page.locator(".world-canvas").getByText("1 insert block → 480 partition values", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("480 isolated merge pools", { exact: true })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.partitionPhase === "fanout", undefined, { timeout: 8_000 });
    await page.waitForTimeout(1_000);
    await captureReview(page, "artifacts/review/partition-explosion-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.partitionPhase === "isolated", undefined, { timeout: 6_000 });
    await expect(page.locator(".world-canvas").getByText("480 MERGE POOLS · PARTS NEVER CROSS BOUNDARIES", { exact: true })).toBeVisible();
    await captureReview(page, "artifacts/review/partition-isolated-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.partitionPhase === "bounded", undefined, { timeout: 6_000 });
    await expect(page.locator(".partition-recovery-label")).toContainText("LIFECYCLE OPERATIONS · KEEP PARTITIONS COARSE");
    await expect(page.locator(".partition-order-label")).toContainText("QUERY LOCALITY → ORDER BY");
    await captureReview(page, "artifacts/review/partition-correction-v3.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.documentElement.dataset.partitionPhase === "bounded");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.partitionVisiblePools)).toBe("6");
    await expect(page.locator(".partition-mobile-summary")).toContainText("Keep lifecycle partitions coarse");
    await page.waitForTimeout(500);
    await captureReview(page, "artifacts/review/partition-mobile-v3.png");
  });

  test("background contention shows broad rewrites delaying normal merges before a protected recovery window", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Merge \+ TTL \+ mutation contention/ }).click();

    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("Merge + TTL + mutation contention");
    await expect(inspector.locator(".scenario-recommendation")).toContainText("Observe active work before forcing merges");
    await expect(page.locator(".contention-title")).toContainText("Three rewrite classes contend for finite scheduling and storage bandwidth");
    await expect(page.locator(".world-canvas").getByText("MODELED SHARED CAPACITY · NOT SERVER COUNT", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("MODELED A · TTL REWRITE", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("MODELED B · MUTATION", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("TTL REWRITE QUEUE", { exact: true })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.contentionPhase === "saturate", undefined, { timeout: 8_000 });
    await captureReview(page, "artifacts/review/background-contention-saturated-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.contentionPhase === "backlog", undefined, { timeout: 6_000 });
    await expect(page.locator(".world-canvas").getByText("NORMAL MERGES WAIT · QUEUE AGE + ACTIVE PARTS RISE", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Number(document.documentElement.dataset.contentionMergeQueue))).toBeGreaterThanOrEqual(4);
    await captureReview(page, "artifacts/review/background-contention-backlog-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.contentionPhase === "protect", undefined, { timeout: 6_000 });
    await expect(page.locator(".contention-mitigation-label")).toContainText("PROTECT NORMAL MERGE CAPACITY");
    await expect(page.locator(".contention-window-label")).toContainText("DEFERRED REWRITE WINDOW");
    await captureReview(page, "artifacts/review/background-contention-protected-v2.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.documentElement.dataset.contentionPhase === "protect");
    await expect(page.locator(".contention-mobile-summary")).toContainText("Broad rewrites make normal merges wait");
    await page.waitForTimeout(500);
    await captureReview(page, "artifacts/review/background-contention-mobile-v2.png");
  });

  test("bad ORDER BY contrasts a scattered wide scan with a clustered candidate range", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /ORDER BY misses the filter/ }).click();

    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("ORDER BY misses the filter");
    await expect(inspector.locator(".scenario-recommendation")).toContainText("EXPLAIN indexes");
    await expect(page.locator(".ordering-cause-callout")).toContainText("One filter value is scattered across 11 of 12 illustrated granules");
    await page.waitForFunction(() => document.documentElement.dataset.orderingPhase === "wide-scan", undefined, { timeout: 8_000 });
    await expect(page.locator(".ordering-cost-callout")).toContainText("11 / 12 read · illustrative model");
    await expect(page.locator('.ordering-granule-label[data-read="true"]')).toHaveCount(11);
    await expect(page.locator('.ordering-granule-label[data-read="false"]')).toHaveCount(1);
    await page.waitForTimeout(900);
    await captureReview(page, "artifacts/review/bad-ordering-wide-scan-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.orderingPhase === "reorder", undefined, { timeout: 6_000 });
    await expect(page.locator(".ordering-recovery-label")).toContainText("FILTER-FIRST PHYSICAL ORDER");
    await expect(page.locator(".ordering-validation-label")).toContainText("VERIFY · EXPLAIN INDEXES = 1");
    await captureReview(page, "artifacts/review/bad-ordering-reorder-v2.png");
    await page.waitForFunction(() => document.documentElement.dataset.orderingPhase === "result", undefined, { timeout: 6_000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.orderingReadGranules)).toBe("2");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.orderingSkippedGranules)).toBe("10");
    await expect(page.locator('.ordering-granule-label[data-read="true"]')).toHaveCount(2);
    await expect(page.locator('.ordering-granule-label[data-read="false"]')).toHaveCount(10);
    await expect(page.locator(".world-canvas").getByText("MODEL: 11 / 12 READ → 2 / 12 READ · VERIFY WITH EXPLAIN", { exact: true })).toBeVisible();
    await captureReview(page, "artifacts/review/bad-ordering-pruned-v2.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.documentElement.dataset.orderingPhase === "result");
    await expect(page.locator(".ordering-mobile-summary")).toContainText("Model: 11 / 12 read → 2 / 12");
    await page.waitForTimeout(500);
    await expect.poll(() => inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await captureReview(page, "artifacts/review/bad-ordering-mobile-v2.png");
  });

  test("aggregation spill shows memory state becoming disk runs before external merge", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Aggregation spills to disk/ }).click();
    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.aggregationSpillPhase;
        if (phase === "external-merge") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return phase;
      }),
      { timeout: 35_000, intervals: [250] },
    ).toBe("external-merge");
    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("Aggregation spills to disk");
    await expect(inspector.locator(".scenario-recommendation")).toContainText("Treat spill as protection");
    await expect(page.locator(".aggregation-cause-callout")).toContainText("Distinct group keys grow partial state in RAM");
    await expect(page.locator(".aggregation-cost-callout")).toContainText("Spill completes with extra I/O");
    await expect(page.locator(".world-canvas").getByText("PARALLEL PARTIAL STATES", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("SPILL THRESHOLD", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("TEMPORARY RUNS · DISK", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("EXTERNAL MERGE", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("FINAL GROUPS", { exact: true })).toBeVisible();

    await page.waitForTimeout(250);
    await expect(page.locator(".world-canvas").getByText("MERGE TEMPORARY RUNS WITH REMAINING STATE", { exact: true })).toBeVisible();
    await captureReview(page, "artifacts/review/aggregation-spill-v1.png");

    await page.getByRole("button", { name: "Play simulation" }).click();
    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.aggregationSpillPhase;
        if (phase === "result") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return phase;
      }),
      { timeout: 12_000, intervals: [150] },
    ).toBe("result");
    await expect(page.locator(".world-canvas").getByText("FINALIZE GROUPS · EXTRA I/O ADDED LATENCY", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.aggregationSpilledRuns)).toBe("3");
    await expect(page.locator(".aggregation-prevention-label")).toContainText("FILTER / PRECOMPUTE BEFORE SPILL");
    await expect(page.locator(".aggregation-guardrail-label")).toContainText("SPILL = COMPLETION GUARDRAIL · NOT SPEEDUP");
    await captureReview(page, "artifacts/review/aggregation-result-v2.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.documentElement.dataset.aggregationSpillPhase === "result");
    await page.waitForTimeout(500);
    await expect(page.locator(".aggregation-mobile-summary")).toContainText("RAM threshold → temporary disk runs");
    await expect(page.locator(".aggregation-mobile-summary")).toContainText("spill is a slower completion guardrail");
    await expect.poll(() => inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await captureReview(page, "artifacts/review/aggregation-spill-mobile-v2.png");
  });

  test("replica lag separates Keeper metadata from part transfer and shows catch-up", async ({ page }) => {
    test.setTimeout(120_000);
    const runtimeErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Replica queue falls behind/ }).click();
    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("Replica queue falls behind");
    await expect(inspector.locator(".scenario-recommendation")).toContainText("queue depth and oldest-task age together");
    await expect(page.locator(".replica-cause-callout")).toContainText("Queue work arrives faster");
    await expect(page.locator(".replica-diagnosis-callout")).toContainText("task type, oldest age, retries, and exceptions");
    await expect(page.locator(".world-canvas").getByText("REPLICA 1 · CURRENT", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("KEEPER · OPERATION METADATA ONLY", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("PART BYTES · DIRECT DATA PATH", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("REPLICA 2 · BEHIND", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("OLDEST TASK AGE · RETRIES", { exact: true })).toBeVisible();

    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.replicaLagPhase;
        if (phase === "backlog") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return phase;
      }),
      { timeout: 30_000, intervals: [220] },
    ).toBe("backlog");
    await expect(page.locator(".world-canvas").getByText("ARRIVALS OUTRUN FETCH + STORAGE · QUEUE AGE RISES", { exact: true })).toBeVisible();
    await expect(page.locator(".replica-queue-label")).toContainText(/QUEUED · OLDEST (RISING|AGING)/);
    await expect.poll(() => page.evaluate(() => Number(document.documentElement.dataset.replicaQueueDepth))).toBeGreaterThanOrEqual(6);
    await captureReview(page, "artifacts/review/replica-lag-v2.png");

    await page.getByRole("button", { name: "Play simulation" }).click();
    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.replicaLagPhase;
        if (phase === "catch-up") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return phase;
      }),
      { timeout: 20_000, intervals: [180] },
    ).toBe("catch-up");
    await expect(page.locator(".world-canvas").getByText("DESTINATION CAPACITY RETURNS · QUEUE DRAINS", { exact: true })).toBeVisible();
    await expect(page.locator(".replica-recovery-label")).toContainText("RESTORE FETCH / STORAGE CAPACITY");
    await expect(page.locator(".replica-baseline-label")).toContainText("DEPTH + OLDEST AGE RETURN TO BASELINE");
    await captureReview(page, "artifacts/review/replica-catch-up-v2.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.documentElement.dataset.replicaLagPhase === "backlog");
    await page.waitForTimeout(500);
    await expect(page.locator(".replica-mobile-summary")).toContainText("Metadata queues work · part bytes move directly");
    await expect(page.locator(".replica-mobile-summary")).toContainText("recovery ends at the tested baseline");
    await expect.poll(() => inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await captureReview(page, "artifacts/review/replica-lag-mobile-v2.png");
    expect(runtimeErrors).toEqual([]);
  });

  test("Keeper quorum loss pauses coordination without moving user data through Keeper", async ({ page }) => {
    test.setTimeout(120_000);
    const runtimeErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Scenario Steady" }).click();
    await page.getByRole("menuitemradio", { name: /Keeper quorum unavailable/ }).click();
    const inspector = page.getByRole("complementary", { name: "ClickHouse mechanism inspector" });
    await expect(inspector).toContainText("Keeper quorum unavailable");
    await expect(inspector.locator(".scenario-recommendation")).toContainText("independent failure domains");
    await expect(page.locator(".keeper-cause-callout")).toContainText("not the same as a writable majority");
    await expect(page.locator(".keeper-recovery-callout")).toContainText("three voters in independent failure domains");
    await expect(page.locator(".world-canvas").getByText("REPLICA A · LOCAL PARTS", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("REPLICA B · LOCAL PARTS", { exact: true })).toBeVisible();
    await expect(page.locator(".world-canvas").getByText("LOCAL READS · STORED PARTS · NO KEEPER DATA HOP", { exact: true })).toBeVisible();

    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.keeperQuorumPhase;
        if (phase === "read-only") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return phase;
      }),
      { timeout: 35_000, intervals: [250] },
    ).toBe("read-only");
    await expect(page.locator(".keeper-vote-label")).toContainText("1 / 3 VOTERS · NO MAJORITY");
    await expect(page.locator(".keeper-write-label")).toContainText("TABLE READ-ONLY · WRITE WAITS");
    await expect(page.locator("html")).toHaveAttribute("data-keeper-connected-voters", "1");
    await expect(page.locator("html")).toHaveAttribute("data-keeper-coordination", "unavailable");
    await expect(page.locator("html")).toHaveAttribute("data-keeper-recommendation", "reviewed-default");
    await expect(page.locator(".world-canvas").getByText("REPLICATED WRITES PAUSE · LOCAL PART READS CONTINUE", { exact: true })).toBeVisible();
    await captureReview(page, "artifacts/review/keeper-no-quorum-v1.png");

    await page.getByRole("button", { name: "Play simulation" }).click();
    await expect.poll(
      () => page.evaluate(() => {
        const phase = document.documentElement.dataset.keeperQuorumPhase;
        const voters = document.documentElement.dataset.keeperConnectedVoters;
        if (phase === "restore" && voters === "2") document.querySelector<HTMLButtonElement>('[aria-label="Pause simulation"]')?.click();
        return `${phase}:${voters}`;
      }),
      { timeout: 20_000, intervals: [200] },
    ).toBe("restore:2");
    await expect(page.locator(".keeper-vote-label")).toContainText("2 / 3 VOTERS · WRITABLE MAJORITY");
    await expect(page.locator(".keeper-majority-label")).toContainText("RESTORE A 2 / 3 MAJORITY");
    await expect(page.locator(".keeper-domain-label")).toContainText("INDEPENDENT FAILURE DOMAINS");
    await expect(page.locator("html")).toHaveAttribute("data-keeper-coordination", "available");
    await expect(page.locator(".world-canvas").getByText("RESTORE K2 · 2 / 3 REOPENS COORDINATION · QUEUE DRAINS", { exact: true })).toBeVisible();
    await captureReview(page, "artifacts/review/keeper-restore-v2.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.locator(".keeper-mobile-summary")).toContainText("1 / 3 pauses writes · 2 / 3 restores coordination");
    await expect(page.locator(".keeper-mobile-summary")).toContainText("Keeper carries coordination metadata");
    await expect.poll(() => inspector.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await captureReview(page, "artifacts/review/keeper-no-quorum-mobile-v1.png");
    expect(runtimeErrors).toEqual([]);
  });
});
