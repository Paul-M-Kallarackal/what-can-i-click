import { describe, expect, it } from "vitest";
import { evidenceById, SOURCES } from "./evidence";
import { GOTCHA_STORIES, gotchaStoryById, normalizedDiagnostics, recommendGotchaJourney } from "./gotchas";
import { mechanismById } from "./mechanisms";
import type { WorkloadProfile } from "../types";

const base: WorkloadProfile = {
  workload: "general",
  ingestRate: "medium",
  latencyTarget: "seconds",
  retention: "months",
  updates: "append-only",
  availability: "standard",
  topology: "single-region",
  costPriority: "balanced",
};

describe("six ClickHouse gotcha stories", () => {
  it("ships six complete four-beat stories with valid mechanisms and bounded legends", () => {
    expect(GOTCHA_STORIES).toHaveLength(6);
    expect(new Set(GOTCHA_STORIES.map((story) => story.id)).size).toBe(6);
    for (const story of GOTCHA_STORIES) {
      expect(story.beats.map((beat) => beat.kind)).toEqual(["cause", "impact", "avoid", "verify"]);
      expect(story.reducedMotionSummary.length).toBeGreaterThan(40);
      expect(story.sourceUrl).toMatch(/^https:\/\/clickhouse\.com\//);
      expect(mechanismById(story.primaryMechanismId)).toBeTruthy();
      expect(story.mechanismIds.every((id) => Boolean(mechanismById(id)))).toBe(true);
      expect(story.beats.every((beat) => beat.legend.length > 0 && beat.legend.length <= 3)).toBe(true);
      expect(story.beats.every((beat) => beat.metrics.length > 0 && beat.metrics.length <= 3)).toBe(true);
    }
    expect(SOURCES.commonMistakes.id).toBe("common-mistakes");
    expect(evidenceById("common-mistakes")).toBeUndefined();
  });

  it("keeps legacy workload profiles valid by applying diagnostic assumptions", () => {
    expect(normalizedDiagnostics(base)).toEqual({
      deployment: "undecided",
      insertPattern: "mixed",
      queryShape: "mixed",
      partitionCardinality: "unknown",
      materializedViewFootprint: "unknown",
    });
  });

  it.each([
    [{ ...base, workload: "observability", ingestRate: "extreme", insertPattern: "many-small" } as WorkloadProfile, "parts-pressure"],
    [{ ...base, workload: "cdc", updates: "frequent" } as WorkloadProfile, "updates-deduplication"],
    [{ ...base, availability: "high", deployment: "self-managed" } as WorkloadProfile, "scale-coordination"],
    [{ ...base, latencyTarget: "interactive", queryShape: "point-lookup" } as WorkloadProfile, "read-path-surprises"],
    [{ ...base, queryShape: "high-cardinality-aggregate" } as WorkloadProfile, "memory-pressure"],
    [{ ...base, materializedViewFootprint: "many", ingestRate: "high" } as WorkloadProfile, "materialized-view-traps"],
  ])("ranks the expected hero gotcha for a diagnostic workload", (profile, expected) => {
    const journey = recommendGotchaJourney(profile);
    expect(journey.length).toBeGreaterThanOrEqual(3);
    expect(journey.length).toBeLessThanOrEqual(5);
    expect(new Set(journey.map((item) => item.gotchaId)).size).toBe(journey.length);
    expect(journey[0]?.gotchaId).toBe(expected);
    expect(gotchaStoryById(expected)).toBeTruthy();
  });
});
