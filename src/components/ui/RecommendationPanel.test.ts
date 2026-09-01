import { describe, expect, it } from "vitest";
import { recommendArchitecture } from "../../lib/advisor";
import type { WorkloadProfile } from "../../types";
import { recommendationProfileFacts, recommendationStepState } from "./RecommendationPanel";

const profile: WorkloadProfile = {
  workload: "cdc",
  ingestRate: "high",
  latencyTarget: "seconds",
  retention: "months",
  updates: "frequent",
  availability: "high",
  topology: "single-region",
  costPriority: "balanced",
};

describe("recommendation panel model", () => {
  it("summarizes only the bounded workload facts supplied by the agent", () => {
    expect(recommendationProfileFacts(profile)).toEqual([
      "CDC",
      "high ingest",
      "seconds reads",
      "months retention",
      "high availability",
      "single region",
    ]);
  });

  it("resolves a decision to its mechanism, evidence, and validation check", () => {
    const recommendation = recommendArchitecture(profile);
    const state = recommendationStepState(recommendation, 0);

    expect(state).toMatchObject({
      index: 0,
      decision: { mechanismId: "ingestion.clickpipes" },
      mechanism: { id: "ingestion.clickpipes" },
      validationStep: expect.any(String),
    });
    expect(state.evidence.map((entry) => entry.id)).toEqual(expect.arrayContaining(["docs-clickpipes"]));
  });

  it("bounds agent-selected steps to the reviewed recommendation path", () => {
    const recommendation = recommendArchitecture(profile);
    expect(recommendationStepState(recommendation, -10).index).toBe(0);
    expect(recommendationStepState(recommendation, 999).index).toBe(recommendation.decisions.length - 1);
  });
});
