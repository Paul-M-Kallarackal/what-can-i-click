import { beforeEach, describe, expect, it } from "vitest";
import { useAtlasStore } from "./useAtlasStore";

describe("visual-note state", () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it("returns from a mechanism cutaway before showing a tree tidbit", () => {
    const store = useAtlasStore.getState();
    store.selectMechanism("mergetree.part-anatomy", "xray");
    store.selectTidbit("merge.rings");

    expect(useAtlasStore.getState()).toMatchObject({
      selectedMechanismId: null,
      selectedTidbitId: "merge.rings",
      viewLevel: "system",
    });
  });

  it("clears a strategy-specific note when the latest-state strategy changes", () => {
    const store = useAtlasStore.getState();
    store.setMergeFamily("replacing");
    store.selectTidbit("replacing.argmax");
    store.setLatestReadStrategy("final");

    expect(useAtlasStore.getState()).toMatchObject({
      latestReadStrategy: "final",
      selectedTidbitId: null,
    });
  });

  it("keeps latest-state comparison bounded to the active family view", () => {
    const store = useAtlasStore.getState();
    store.setMergeFamily("replacing");
    store.setLatestReadComparison("argmax-vs-final");

    expect(useAtlasStore.getState().latestReadComparison).toBe("argmax-vs-final");

    useAtlasStore.getState().setLatestReadStrategy("final");
    expect(useAtlasStore.getState().latestReadComparison).toBeNull();

    useAtlasStore.getState().setLatestReadComparison("argmax-vs-final");
    useAtlasStore.getState().selectMechanism("read.sparse-index");
    expect(useAtlasStore.getState().latestReadComparison).toBeNull();
  });

  it("keeps production comparison state scoped to the selected evidence account", () => {
    const store = useAtlasStore.getState();
    store.selectEvidence("cloudflare-http-analytics");
    store.setEvidenceComparison("highlevel-notifications-analytics");
    store.selectEvidence("netflix-logging");

    expect(useAtlasStore.getState()).toMatchObject({
      selectedEvidenceId: "netflix-logging",
      evidenceComparisonId: null,
    });
  });

  it("focuses the ClickHouse mechanism that owns a selected operational failure", () => {
    useAtlasStore.getState().setScenario("replica-lag");

    expect(useAtlasStore.getState()).toMatchObject({
      scenario: "replica-lag",
      selectedMechanismId: "observability.replication-queue",
      viewLevel: "mechanism",
      playing: true,
      simulationTime: 0,
    });
  });
});
