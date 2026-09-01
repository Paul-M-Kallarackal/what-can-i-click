import { beforeEach, describe, expect, it } from "vitest";
import { recommendArchitecture } from "../lib/advisor";
import type { WorkloadProfile } from "../types";
import { useAtlasStore } from "./useAtlasStore";

const recommendationProfile: WorkloadProfile = {
  workload: "observability",
  ingestRate: "high",
  latencyTarget: "interactive",
  retention: "months",
  updates: "append-only",
  availability: "high",
  topology: "single-region",
  costPriority: "balanced",
};

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

  it("stages the exact recommendation and moves its 3D focus decision by decision", () => {
    const recommendation = recommendArchitecture(recommendationProfile);
    useAtlasStore.getState().setRecommendation(recommendation, recommendationProfile);

    expect(useAtlasStore.getState()).toMatchObject({
      recommendationProfile,
      recommendationStepIndex: 0,
      journeyPanelOpen: true,
      activeJourneyId: null,
      selectedMechanismId: recommendation.decisions[0]?.mechanismId,
      mergeFamilyId: "merge",
      scenario: "healthy",
      playing: true,
    });

    useAtlasStore.getState().setRecommendationStep(3);
    expect(useAtlasStore.getState()).toMatchObject({
      recommendationStepIndex: 3,
      selectedMechanismId: recommendation.decisions[3]?.mechanismId,
      viewLevel: "mechanism",
    });

    useAtlasStore.getState().setRecommendationStep(999);
    expect(useAtlasStore.getState().recommendationStepIndex).toBe(recommendation.decisions.length - 1);
  });

  it("preserves the family and read contract selected by the WebMCP advisor", () => {
    const cdcProfile: WorkloadProfile = { ...recommendationProfile, workload: "cdc", updates: "frequent" };
    useAtlasStore.getState().setMergeFamily("replacing");
    useAtlasStore.getState().setLatestReadStrategy("argmax");
    useAtlasStore.getState().setRecommendation(recommendArchitecture(cdcProfile), cdcProfile);

    expect(useAtlasStore.getState()).toMatchObject({
      mergeFamilyId: "replacing",
      latestReadStrategy: "argmax",
      scenario: "healthy",
    });
  });
});
