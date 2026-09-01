import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAtlasStore } from "../../store/useAtlasStore";
import { Inspector } from "./Inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("production implementation comparison", () => {
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

  it("activates the declared recommendation and lets the user select another account locally", () => {
    act(() => {
      useAtlasStore.getState().selectEvidence("cloudflare-http-analytics");
      root.render(createElement(Inspector));
    });

    const recommendation = container.querySelector<HTMLButtonElement>(".implementation-compare__recommendation")!;
    const select = container.querySelector<HTMLSelectElement>(".implementation-compare__select select")!;
    const label = container.querySelector<HTMLLabelElement>(".implementation-compare__label")!;

    expect(recommendation.textContent).toContain("HighLevel");
    expect(recommendation.textContent).toContain("Shared named family · SummingMergeTree");
    expect(label.htmlFor).toBe(select.id);
    expect(container.querySelector(".implementation-comparison-grid")).toBeNull();

    act(() => recommendation.click());

    expect(select.value).toBe("highlevel-notifications-analytics");
    expect(useAtlasStore.getState()).toMatchObject({ comparisonIds: null, evidenceComparisonId: "highlevel-notifications-analytics" });
    expect(container.querySelectorAll(".implementation-comparison-card")).toHaveLength(2);
    expect([...container.querySelectorAll(".implementation-comparison-card h4")].map((node) => node.textContent)).toEqual(["Cloudflare", "HighLevel"]);

    for (const card of container.querySelectorAll(".implementation-comparison-card")) {
      expect([...card.querySelectorAll("dt")].map((node) => node.textContent)).toEqual(["Pattern", "Published scale", "Result", "Tradeoff"]);
      expect(card.querySelectorAll("a[aria-label$='primary source']")).toHaveLength(1);
    }

    act(() => {
      select.value = "netflix-logging";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect([...container.querySelectorAll(".implementation-comparison-card h4")].map((node) => node.textContent)).toEqual(["Cloudflare", "Netflix"]);
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("Comparing Cloudflare with Netflix.");
  });
});
