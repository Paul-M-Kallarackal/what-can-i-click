import { describe, expect, it } from "vitest";
import { ARCHITECTURE_EVENTS, LIFECYCLE_EVENTS, eventAtTime, eventProgress, nextEventTime, storyDuration } from "./simulation";

describe("semantic simulation", () => {
  it("orders the complete lifecycle deterministically", () => {
    expect(LIFECYCLE_EVENTS[0].subjectId).toBe("ingestion.async-buffer");
    expect(LIFECYCLE_EVENTS.at(-1)?.subjectId).toBe("retention.ttl-delete");
    expect(LIFECYCLE_EVENTS.every((event, index) => index === 0 || event.at > LIFECYCLE_EVENTS[index - 1].at)).toBe(true);
  });

  it("keeps Keeper separate from failure and recovery", () => {
    expect(ARCHITECTURE_EVENTS.map((event) => event.subjectId)).toEqual([
      "architecture.sharding",
      "architecture.replication",
      "architecture.keeper",
      "architecture.failure",
      "architecture.recovery",
    ]);
    const keeper = ARCHITECTURE_EVENTS.find((event) => event.subjectId === "architecture.keeper");
    expect(keeper?.narration).toContain("metadata");
    expect(keeper?.narration).toContain("separate quorum path");
    expect(keeper?.narration).not.toMatch(/rows? flow|user data/i);
  });

  it("supports seeking, progress, and semantic stepping", () => {
    expect(eventAtTime(LIFECYCLE_EVENTS, 3.3)?.subjectId).toBe("mergetree.part-anatomy");
    expect(eventProgress(LIFECYCLE_EVENTS, 4)).toBeGreaterThan(0);
    expect(nextEventTime(LIFECYCLE_EVENTS, 0)).toBe(LIFECYCLE_EVENTS[1].at);
    expect(nextEventTime(LIFECYCLE_EVENTS, storyDuration(LIFECYCLE_EVENTS))).toBe(storyDuration(LIFECYCLE_EVENTS));
  });
});
