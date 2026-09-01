import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAtlasStore } from "../../store/useAtlasStore";
import { createToolDefinitions } from "../../webmcp/register";
import { MergeFamilyNavigator } from "./MergeFamilyNavigator";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("agent-selected MergeTree family workbench", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useAtlasStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderWorkbench() {
    act(() => root.render(createElement(MergeFamilyNavigator)));
    return container.querySelector<HTMLElement>(".family-workbench")!;
  }

  it("keeps a WebMCP-selected ReplacingMergeTree and FINAL read path visible", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;
    useAtlasStore.getState().startJourney("multi-region-product-analytics");
    expect(useAtlasStore.getState().journeyPanelOpen).toBe(true);

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "replacing", latestReadStrategy: "final" });
    });
    const workbench = renderWorkbench();

    expect(useAtlasStore.getState()).toMatchObject({
      mergeFamilyId: "replacing",
      latestReadStrategy: "final",
      journeyPanelOpen: false,
    });
    expect(workbench.getAttribute("aria-label")).toBe("ReplacingMergeTree workbench");
    expect(workbench.dataset.agentSelected).toBe("true");
    expect(workbench.textContent).toContain("Use it when");
    expect(workbench.textContent).toContain("Watch for");
    expect(workbench.querySelector('[aria-label="Selected latest-state read method"]')?.textContent).toContain("SELECT FINAL");
  });

  it("updates the visible read contract to argMax and can return to plain MergeTree", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "replacing", latestReadStrategy: "argmax" });
    });
    const workbench = renderWorkbench();

    expect(workbench.querySelector('[aria-label="Selected latest-state read method"]')?.textContent).toContain("argMax");

    act(() => {
      [...workbench.querySelectorAll("button")].find((button) => button.textContent?.includes("Back to MergeTree"))!.click();
    });

    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "merge", latestReadStrategy: "background" });
    expect(container.querySelector(".family-workbench")?.getAttribute("aria-label")).toBe("MergeTree workbench");
    expect(container.textContent).toContain("Healthy MergeTree flow");
    expect(container.textContent).toContain("What you are seeing");
  });

  it("shows both bounded read contracts only after the agent requests their comparison", async () => {
    const compare = createToolDefinitions().find((tool) => tool.name === "compare_clickhouse_methods")!;

    await act(async () => {
      await compare.execute({ comparison: "argmax-vs-final" });
    });
    const workbench = renderWorkbench();
    const comparison = workbench.querySelector<HTMLElement>('[aria-label="argMax versus SELECT FINAL comparison"]')!;

    expect(useAtlasStore.getState().latestReadComparison).toBe("argmax-vs-final");
    expect(workbench.textContent).toContain("Agent-requested method comparison");
    expect(comparison.querySelector('[data-method="argmax"]')?.textContent).toContain("one explicit (version, tie-breaker) tuple");
    expect(comparison.querySelector('[data-method="final"]')?.textContent).toContain("exact engine semantics");
    expect(comparison.querySelectorAll("article")).toHaveLength(2);

    act(() => {
      [...workbench.querySelectorAll("button")].find((button) => button.textContent?.includes("Back to MergeTree"))!.click();
    });
    expect(useAtlasStore.getState().latestReadComparison).toBeNull();
  });

  it("shows Coalescing FINAL as query-time assembly and defaults a later inspection back to background", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "coalescing", latestReadStrategy: "final" });
    });
    const workbench = renderWorkbench();

    expect(workbench.getAttribute("aria-label")).toBe("CoalescingMergeTree workbench");
    expect(workbench.querySelector('[aria-label="Selected latest-state read method"]')?.textContent).toContain("SELECT FINAL");
    expect(workbench.textContent).toContain("NULL means no update");

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "coalescing" });
    });

    expect(useAtlasStore.getState()).toMatchObject({ mergeFamilyId: "coalescing", latestReadStrategy: "background" });
    expect(container.querySelector('[aria-label="Selected latest-state read method"]')).toBeNull();
  });

  it("shows SummingMergeTree as partial storage with an explicit exact-read contract", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "summing" });
    });
    const workbench = renderWorkbench();
    const exactRead = workbench.querySelector<HTMLElement>('[aria-label="SummingMergeTree exact-read contract"]')!;

    expect(workbench.getAttribute("aria-label")).toBe("SummingMergeTree workbench");
    expect(exactRead.textContent).toContain("Aggregate every visible row");
    expect(exactRead.textContent).toContain("SUM and GROUP BY");
    expect(workbench.textContent).toContain("background summation may be incomplete");
  });

  it("shows the AggregatingMergeTree -State and matching -Merge contract", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "aggregating" });
    });
    const workbench = renderWorkbench();
    const stateContract = workbench.querySelector<HTMLElement>('[aria-label="AggregatingMergeTree state contract"]')!;

    expect(workbench.getAttribute("aria-label")).toBe("AggregatingMergeTree workbench");
    expect(stateContract.textContent).toContain("Write -State · read matching -Merge");
    expect(stateContract.textContent).toContain("sum and count");
    expect(stateContract.textContent).toContain("SimpleAggregateFunction");
  });

  it("shows CollapsingMergeTree producer history and sign-aware exact reads", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "collapsing" });
    });
    const workbench = renderWorkbench();
    const exactRead = workbench.querySelector<HTMLElement>('[aria-label="CollapsingMergeTree exact-read contract"]')!;

    expect(workbench.getAttribute("aria-label")).toBe("CollapsingMergeTree workbench");
    expect(exactRead.textContent).toContain("exact cancel copy");
    expect(exactRead.textContent).toContain("sign-aware aggregation");
    expect(exactRead.textContent).toContain("FINAL for bounded row extraction");
  });

  it("shows VersionedCollapsingMergeTree version matching and order-independent pairing", async () => {
    const inspect = createToolDefinitions().find((tool) => tool.name === "inspect_clickhouse_mechanism")!;

    await act(async () => {
      await inspect.execute({ mergeFamilyId: "versioned-collapsing" });
    });
    const workbench = renderWorkbench();
    const contract = workbench.querySelector<HTMLElement>('[aria-label="VersionedCollapsingMergeTree version contract"]')!;

    expect(workbench.getAttribute("aria-label")).toBe("VersionedCollapsingMergeTree workbench");
    expect(contract.textContent).toContain("Same key · same version · opposite Sign");
    expect(contract.textContent).toContain("arrive out of order");
    expect(contract.textContent).toContain("mismatched cancel cannot remove a newer state");
  });
});
