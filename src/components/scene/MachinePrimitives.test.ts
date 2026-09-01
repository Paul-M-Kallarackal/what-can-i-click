import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@react-three/drei", () => ({
  Html: () => null,
  Instance: () => null,
  Instances: () => null,
  RoundedBox: () => null,
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => undefined }));

import {
  aggregatingStateFrame,
  aggregationSpillFrame,
  applyComposedGroupFade,
  backgroundContentionFrame,
  badOrderingFrame,
  coalescingReadFrame,
  collapsingHistoryFrame,
  FAMILY_CANOPY_DENSITY,
  familyCanopyVisibleFormCount,
  foundryCraneFrame,
  foundryMergeFrame,
  keeperQuorumFrame,
  motionLoop,
  motionStage,
  motionWindow,
  partitionExplosionFrame,
  replacingReadFrame,
  replicaLagFrame,
  requestTidbitFocusFeedback,
  retargetTidbitFocusCue,
  setComposedMaterialBaseOpacity,
  subscribeTidbitFocusFeedback,
  summingMergeFrame,
  tidbitFocusCueFrame,
  TIDBIT_FOCUS_CUE_DURATION,
  tinyInsertStormFrame,
  type TidbitFocusCueState,
  versionedCollapseFrame,
} from "./MachinePrimitives";
import type { MergeFamilyId } from "../../types";

describe("composed scene fades", () => {
  it("multiplies independent transition channels without losing animated base opacity", () => {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ opacity: 0.5 });
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));

    applyComposedGroupFade(group, "scene", 0.4);
    applyComposedGroupFade(group, "family", 0.5);
    expect(material.opacity).toBeCloseTo(0.1);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    setComposedMaterialBaseOpacity(material, 0.8);
    expect(material.opacity).toBeCloseTo(0.16);

    applyComposedGroupFade(group, "family", 1);
    applyComposedGroupFade(group, "scene", 1);
    expect(material.opacity).toBeCloseTo(0.8);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });
});

describe("causal motion phases", () => {
  it("keeps loops deterministic and stage boundaries ordered", () => {
    expect(motionLoop(0.75, 2)).toBeCloseTo(0.5);
    expect(motionLoop(2.75, 2)).toBeCloseTo(0.5);
    expect(motionStage(0.1, 0.2, 0.4)).toBe(0);
    expect(motionStage(0.3, 0.2, 0.4)).toBeGreaterThan(0);
    expect(motionStage(0.3, 0.2, 0.4)).toBeLessThan(1);
    expect(motionStage(0.5, 0.2, 0.4)).toBe(1);
  });

  it("shows a bounded consequence window after its arrival stage", () => {
    expect(motionWindow(0.1, 0.12, 0.2, 0.7, 0.82)).toBe(0);
    expect(motionWindow(0.3, 0.12, 0.2, 0.7, 0.82)).toBe(1);
    expect(motionWindow(0.76, 0.12, 0.2, 0.7, 0.82)).toBeGreaterThan(0);
    expect(motionWindow(0.9, 0.12, 0.2, 0.7, 0.82)).toBe(0);
  });
});

describe("foundry crane choreography", () => {
  it("grips, carries, releases, and returns one immutable part", () => {
    const frames = Array.from({ length: 2_000 }, (_, index) => foundryCraneFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["ready", "lower", "grip", "lift", "carry", "place", "release", "retract", "return"]));
    expect(frames.some((frame) => frame.stage === "carry" && frame.payloadVisible && frame.payloadPosition[1] > -2)).toBe(true);
    expect(frames.some((frame) => frame.stage === "release" && frame.clawAngle > 0.2)).toBe(true);
    expect(frames.some((frame) => frame.stage === "return" && !frame.payloadVisible)).toBe(true);
    for (const frame of frames.filter((candidate) => candidate.payloadVisible && candidate.stage !== "ready" && candidate.stage !== "lower")) {
      expect(frame.payloadPosition[0]).toBeCloseTo(frame.carriageX, 6);
      expect(frame.payloadPosition[1]).toBeCloseTo(frame.hookY - 0.74, 6);
      expect(frame.payloadPosition[2]).toBe(0);
    }
  });

  it("keeps a legible completed pose when reduced motion is requested", () => {
    const frame = foundryCraneFrame(42, false, true);
    expect(frame).toMatchObject({ stage: "return", payloadVisible: false });
    expect(frame.carriageX).toBeLessThan(-1);
    expect(frame.clawAngle).toBeGreaterThan(0.35);
    expect(frame.payloadPosition[2]).toBe(0);
  });
});

describe("MergeTree merge choreography", () => {
  it("waits for the crane, interleaves, commits, then retires inputs", () => {
    const frames = Array.from({ length: 2_000 }, (_, index) => foundryMergeFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["waiting", "feed", "interleave", "commit", "retire"]));
    expect(frames.some((frame) => frame.stage === "feed" && frame.outputProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "interleave" && frame.committedPartVisible && frame.outputProgress < 1)).toBe(true);
    expect(frames.some((frame) => frame.stage === "commit" && frame.committedPartVisible && frame.outputProgress === 1)).toBe(true);
    expect(frames.some((frame) => frame.stage === "retire" && frame.inputOpacity < 0.22)).toBe(true);
    expect(frames.some((frame) => frame.inactiveSourceOpacity > 0.7 && frame.removalProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.removalProgress > 0.7 && frame.inactiveSourceOpacity < 0.3)).toBe(true);
  });

  it("shows the committed lifecycle state without travel under reduced motion", () => {
    expect(foundryMergeFrame(0, false, true)).toMatchObject({
      stage: "commit",
      inputOpacity: 0.22,
      outputProgress: 1,
      committedPartVisible: true,
      inactiveSourceOpacity: 0.72,
      removalProgress: 0,
    });
  });
});

describe("ReplacingMergeTree latest-state choreography", () => {
  it.each(["background", "argmax", "final"] as const)("orders candidates, resolution, and output for %s", (strategy) => {
    const frames = Array.from({ length: 3_000 }, (_, index) => replacingReadFrame(index / 100, strategy));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["observe", "evaluate", "resolve", "emit"]));
    expect(frames.some((frame) => frame.stage === "evaluate" && frame.decisionProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "resolve" && frame.winnerProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "emit" && frame.resultProgress > 0)).toBe(true);
  });

  it("shows FINAL doing more read-time work than argMax or background convergence", () => {
    const background = replacingReadFrame(0, "background", true);
    const argmax = replacingReadFrame(0, "argmax", true);
    const final = replacingReadFrame(0, "final", true);

    expect(background.readWorkRatio).toBeLessThan(argmax.readWorkRatio);
    expect(argmax.readWorkRatio).toBeLessThan(final.readWorkRatio);
    expect(final).toMatchObject({ stage: "emit", resultProgress: 1, winnerProgress: 1 });
  });
});

describe("CoalescingMergeTree sparse-field choreography", () => {
  it.each(["background", "final"] as const)("collects fragments before assembling and emitting in %s mode", (strategy) => {
    const frames = Array.from({ length: 4_000 }, (_, index) => coalescingReadFrame(index / 100, strategy));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["fragments", "collect", "assemble", "emit"]));
    expect(frames.some((frame) => frame.stage === "collect" && frame.collectProgress > 0 && frame.assembleProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "assemble" && frame.assembleProgress > 0 && frame.outputProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "emit" && frame.outputProgress > 0)).toBe(true);
  });

  it("moves substantially more work into the read path for FINAL", () => {
    const background = coalescingReadFrame(0, "background", true);
    const final = coalescingReadFrame(0, "final", true);

    expect(background.workRatio).toBeLessThan(final.workRatio);
    expect(final).toMatchObject({ stage: "emit", collectProgress: 1, assembleProgress: 1, outputProgress: 1 });
  });
});

describe("SummingMergeTree partial-storage choreography", () => {
  it("compacts a subset of equal-key rows before the exact query totals every visible part", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => summingMergeFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["unmerged", "compact", "partial", "aggregate", "exact"]));
    expect(frames.some((frame) => frame.stage === "compact" && frame.mergeProgress > 0 && frame.partialProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "partial" && frame.storedRows === 2 && frame.queryProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "aggregate" && frame.queryProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "exact" && frame.resultProgress > 0)).toBe(true);
  });

  it("keeps the partial storage state and exact result legible under reduced motion", () => {
    expect(summingMergeFrame(0, true)).toEqual({
      stage: "exact",
      mergeProgress: 1,
      partialProgress: 1,
      queryProgress: 1,
      resultProgress: 1,
      sourceOpacity: 0.18,
      storedRows: 2,
    });
  });
});

describe("AggregatingMergeTree state choreography", () => {
  it("merges AggregateFunction states before a matching read finalizes the scalar", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => aggregatingStateFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["states", "merge", "combined", "finalize", "result"]));
    expect(frames.some((frame) => frame.stage === "merge" && frame.mergeProgress > 0 && frame.combinedProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "combined" && frame.combinedProgress > 0 && frame.finalizeProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "finalize" && frame.finalizeProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "result" && frame.resultProgress > 0)).toBe(true);
  });

  it("keeps the merged state and finalized scalar visible under reduced motion", () => {
    expect(aggregatingStateFrame(0, true)).toEqual({
      stage: "result",
      mergeProgress: 1,
      combinedProgress: 1,
      finalizeProgress: 1,
      resultProgress: 1,
      sourceOpacity: 0.18,
    });
  });
});

describe("CollapsingMergeTree history choreography", () => {
  it("matches the old state with its cancel before preserving the replacement and resolving the read", () => {
    const frames = Array.from({ length: 3_400 }, (_, index) => collapsingHistoryFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["history", "pair", "collapse", "survivor", "exact"]));
    expect(frames.some((frame) => frame.stage === "pair" && frame.pairProgress > 0 && frame.collapseProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "collapse" && frame.collapseProgress > 0 && frame.survivorProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "survivor" && frame.survivorProgress > 0 && frame.readProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "exact" && frame.readProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "exact" && frame.resultProgress > 0)).toBe(true);
  });

  it("keeps the survivor and exact result visible under reduced motion", () => {
    expect(collapsingHistoryFrame(0, true)).toEqual({
      stage: "exact",
      pairProgress: 1,
      collapseProgress: 1,
      survivorProgress: 1,
      readProgress: 1,
      resultProgress: 1,
      pairOpacity: 0.18,
    });
  });
});

describe("VersionedCollapsingMergeTree routing choreography", () => {
  it("routes out-of-order rows by version before collapsing only the matching opposite-sign pair", () => {
    const frames = Array.from({ length: 3_500 }, (_, index) => versionedCollapseFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["arrive", "route", "match", "collapse", "survive"]));
    expect(frames.some((frame) => frame.stage === "route" && frame.routeProgress > 0 && frame.matchProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "match" && frame.matchProgress > 0 && frame.collapseProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "collapse" && frame.collapseProgress > 0 && frame.survivorProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "survive" && frame.survivorProgress > 0)).toBe(true);
  });

  it("keeps the v2 survivor visible under reduced motion", () => {
    expect(versionedCollapseFrame(0, true)).toEqual({
      stage: "survive",
      arrivalProgress: 1,
      routeProgress: 1,
      matchProgress: 1,
      collapseProgress: 1,
      survivorProgress: 1,
      pairOpacity: 0.18,
    });
  });
});

describe("tiny insert pressure choreography", () => {
  it("creates immutable parts faster than the illustrative merge retires them before showing the recovery path", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => tinyInsertStormFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["arrive", "stamp", "backlog", "throttle", "recover"]));
    expect(frames.every((frame) => frame.backlogParts === frame.createdParts - frame.retiredParts)).toBe(true);
    expect(frames.some((frame) => frame.stage === "backlog" && frame.createdParts >= 16 && frame.retiredParts < frame.createdParts)).toBe(true);
    expect(frames.some((frame) => frame.stage === "throttle" && frame.throttleProgress > 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "recover" && frame.batchFillRatio > 0 && frame.recoveryProgress > 0)).toBe(true);
  });

  it("keeps both the accumulated pressure and one useful batched part visible under reduced motion", () => {
    expect(tinyInsertStormFrame(0, true)).toEqual({
      stage: "recover",
      rowProgress: 1,
      stampProgress: 1,
      createdParts: 18,
      retiredParts: 2,
      backlogParts: 16,
      mergeProgress: 1,
      throttleProgress: 1,
      batchFillRatio: 1,
      recoveryProgress: 1,
    });
  });
});

describe("partition fan-out choreography", () => {
  it("fans one block into representative isolated pools before showing the coarse-boundary correction", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => partitionExplosionFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["flush", "fanout", "isolated", "bounded"]));
    expect(frames.every((frame) => frame.totalPartitions === 480 && frame.illustratedPools === 6)).toBe(true);
    expect(frames.some((frame) => frame.stage === "fanout" && frame.visiblePools > 1 && frame.visiblePools < 6)).toBe(true);
    expect(frames.some((frame) => frame.stage === "isolated" && frame.visiblePools === 6 && frame.boundaryLockProgress > 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "bounded" && frame.recoveryProgress > 0)).toBe(true);
  });

  it("keeps the fragmented state and corrective boundary visible under reduced motion", () => {
    expect(partitionExplosionFrame(0, true)).toEqual({
      stage: "bounded",
      flushProgress: 1,
      fanoutProgress: 1,
      visiblePools: 6,
      boundaryLockProgress: 1,
      recoveryProgress: 1,
      totalPartitions: 480,
      illustratedPools: 6,
    });
  });
});

describe("background merge-capacity choreography", () => {
  it("builds queue age and active parts before moving broad rewrites out of the peak window", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => backgroundContentionFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["arrive", "saturate", "backlog", "protect", "recover"]));
    expect(frames.some((frame) => frame.stage === "saturate" && frame.slotFillProgress > 0 && frame.mitigationProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "backlog" && frame.mergeQueueDepth >= 4 && frame.activeParts >= 5 && frame.queueAgeRatio > 0.7)).toBe(true);
    expect(frames.some((frame) => frame.stage === "protect" && frame.mitigationProgress > 0 && frame.recoveryProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "recover" && frame.recoveryProgress > 0 && frame.mergeQueueDepth < 5 && frame.queueAgeRatio < 1)).toBe(true);
  });

  it("keeps both the pressured state and its protected-window correction visible under reduced motion", () => {
    expect(backgroundContentionFrame(0, true)).toEqual({
      stage: "protect",
      arrivalProgress: 1,
      slotFillProgress: 1,
      backlogProgress: 1,
      mitigationProgress: 1,
      recoveryProgress: 0,
      mergeQueueDepth: 5,
      ttlQueueDepth: 3,
      mutationQueueDepth: 2,
      queueAgeRatio: 1,
      activeParts: 6,
    });
  });
});

describe("physical ordering and sparse-index choreography", () => {
  it("scans a scattered layout before clustering the same filter value into a narrow candidate range", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => badOrderingFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["predicate", "scatter", "wide-scan", "reorder", "prune", "result"]));
    expect(frames.every((frame) => frame.readGranules + frame.skippedGranules === frame.totalGranules)).toBe(true);
    expect(frames.some((frame) => frame.stage === "wide-scan" && frame.readGranules === 11 && frame.wideScanProgress > 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "reorder" && frame.reorderProgress > 0 && frame.pruneProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "prune" && frame.readGranules < 11 && frame.skippedGranules > 1)).toBe(true);
    expect(frames.some((frame) => frame.stage === "result" && frame.readGranules === 2 && frame.skippedGranules === 10)).toBe(true);
  });

  it("keeps the corrected representative range and its before/after comparison visible under reduced motion", () => {
    expect(badOrderingFrame(0, true)).toEqual({
      stage: "result",
      predicateProgress: 1,
      scatterProgress: 1,
      wideScanProgress: 1,
      reorderProgress: 1,
      pruneProgress: 1,
      resultProgress: 1,
      readGranules: 2,
      skippedGranules: 10,
      totalGranules: 12,
    });
  });
});

describe("external aggregation choreography", () => {
  it("builds memory state before spilling and merges runs before showing a result", () => {
    const frames = Array.from({ length: 2_400 }, (_, index) => aggregationSpillFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["read", "build", "threshold", "spill", "external-merge", "result"]));
    expect(frames.some((frame) => frame.stage === "build" && frame.memoryRatio > 0.5 && frame.spilledRuns === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "spill" && frame.memoryRatio < 1 && frame.spilledRuns > 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "external-merge" && frame.mergeProgress > 0 && frame.resultProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "result" && frame.resultProgress > 0)).toBe(true);
  });

  it("keeps a complete explanatory state when reduced motion is requested", () => {
    expect(aggregationSpillFrame(0, true)).toEqual({
      stage: "result",
      inputProgress: 1,
      memoryRatio: 0.62,
      spillProgress: 1,
      spilledRuns: 3,
      mergeProgress: 1,
      resultProgress: 1,
    });
  });
});

describe("replica catch-up choreography", () => {
  it("commits and queues work before lag grows, then drains during catch-up", () => {
    const frames = Array.from({ length: 2_800 }, (_, index) => replicaLagFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["commit", "enqueue", "transfer", "backlog", "catch-up", "healthy"]));
    expect(frames.some((frame) => frame.stage === "enqueue" && frame.logProgress > 0 && frame.transferProgress === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "backlog" && frame.queueDepth >= 6 && frame.oldestTaskRatio > 0.7 && frame.replicaProgress < 0.6)).toBe(true);
    expect(frames.some((frame) => frame.stage === "catch-up" && frame.queueDepth < 6 && frame.transferProgress > 0.45)).toBe(true);
    expect(frames.some((frame) => frame.stage === "healthy" && frame.queueDepth === 0 && frame.replicaProgress === 1)).toBe(true);
  });

  it("keeps a static explanatory backlog when reduced motion is requested", () => {
    expect(replicaLagFrame(0, true)).toEqual({
      stage: "backlog",
      commitProgress: 1,
      logProgress: 1,
      queueDepth: 7,
      oldestTaskRatio: 0.88,
      transferProgress: 0.34,
      replicaProgress: 0.46,
      retryPulse: 1,
    });
  });
});

describe("Keeper quorum choreography", () => {
  it("loses the majority before writes pause and restores it before reconciliation", () => {
    const frames = Array.from({ length: 3_200 }, (_, index) => keeperQuorumFrame(index / 100));
    const stages = new Set(frames.map((frame) => frame.stage));

    expect(stages).toEqual(new Set(["healthy", "partition", "no-quorum", "read-only", "restore", "reconciled"]));
    expect(frames.some((frame) => frame.stage === "no-quorum" && frame.connectedVoters === 1 && !frame.coordinationAvailable)).toBe(true);
    expect(frames.some((frame) => frame.stage === "read-only" && frame.writeProgress < 0.5 && frame.readProgress > 0 && frame.queuedWrites >= 4)).toBe(true);
    expect(frames.some((frame) => frame.stage === "restore" && frame.connectedVoters === 2 && frame.coordinationAvailable && frame.queuedWrites > 0)).toBe(true);
    expect(frames.every((frame) => frame.connectedVoters < 2 ? frame.writeProgress <= 0.46 && !frame.coordinationAvailable : true)).toBe(true);
    expect(frames.some((frame) => frame.stage === "restore" && frame.voterConnectivity[1] === 1 && frame.voterConnectivity[2] < 1)).toBe(true);
    expect(frames.some((frame) => frame.stage === "reconciled" && frame.connectedVoters === 3 && frame.coordinationAvailable && frame.queuedWrites === 0)).toBe(true);
  });

  it("keeps the no-majority cause visible without travel under reduced motion", () => {
    expect(keeperQuorumFrame(0, true)).toEqual({
      stage: "read-only",
      connectedVoters: 1,
      voterConnectivity: [1, 0, 0],
      partitionProgress: 1,
      writeProgress: 0.46,
      readProgress: 1,
      queuedWrites: 4,
      restoreProgress: 0,
      coordinationAvailable: false,
    });
  });
});

describe("tidbit focus feedback", () => {
  it("retargets immediately across rapid family and tidbit changes", () => {
    let cue: TidbitFocusCueState = { tidbitId: null, elapsed: 0 };
    cue = retargetTidbitFocusCue(cue, "merge.tributaries");
    cue.elapsed = 0.07;
    cue = retargetTidbitFocusCue(cue, "merge.rings");
    expect(cue).toEqual({ tidbitId: "merge.rings", elapsed: 0 });

    cue.elapsed = 0.04;
    cue = retargetTidbitFocusCue(cue, "replacing.pruning");
    expect(cue).toEqual({ tidbitId: "replacing.pruning", elapsed: 0 });

    const unchanged = retargetTidbitFocusCue(cue, "replacing.pruning");
    expect(unchanged).toBe(cue);
    cue = retargetTidbitFocusCue(cue, "replacing.pruning", true);
    expect(cue).toEqual({ tidbitId: "replacing.pruning", elapsed: 0 });
    expect(cue).not.toBe(unchanged);

    expect(retargetTidbitFocusCue(cue, null)).toEqual({ tidbitId: null, elapsed: 0 });
  });

  it("uses a short outward impulse without scaling from nothing", () => {
    const initial = tidbitFocusCueFrame(0, false);
    const middle = tidbitFocusCueFrame(TIDBIT_FOCUS_CUE_DURATION / 2, false);
    const settled = tidbitFocusCueFrame(TIDBIT_FOCUS_CUE_DURATION, false);

    expect(initial.visible).toBe(true);
    expect(initial.haloScale).toBeGreaterThanOrEqual(0.9);
    expect(initial.haloOpacity).toBeGreaterThan(0.8);
    expect(initial.localScaleBoost).toBeGreaterThan(0);
    expect(middle.haloScale).toBeGreaterThan(initial.haloScale);
    expect(middle.haloOpacity).toBeLessThan(initial.haloOpacity);
    expect(settled).toMatchObject({ visible: false, haloOpacity: 0, localScaleBoost: 0 });
    expect(TIDBIT_FOCUS_CUE_DURATION).toBeLessThan(0.3);
  });

  it("keeps reduced motion as a color/opacity signal and static halo", () => {
    const initial = tidbitFocusCueFrame(0, true);
    const later = tidbitFocusCueFrame(12, true);
    expect(later).toEqual(initial);
    expect(initial).toMatchObject({ visible: true, localScaleBoost: 0 });
    expect(initial.haloOpacity).toBeGreaterThan(0);
  });

  it("re-emits repeated scene selections so the same hotspot can retrigger", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTidbitFocusFeedback(listener);
    requestTidbitFocusFeedback("merge.rings");
    requestTidbitFocusFeedback("merge.rings");
    unsubscribe();
    requestTidbitFocusFeedback("merge.crown");
    expect(listener.mock.calls).toEqual([["merge.rings"], ["merge.rings"]]);
  });
});

describe("family canopy density", () => {
  it("keeps every analogy clustered, tonal, and within the visible-form target", () => {
    for (const family of Object.keys(FAMILY_CANOPY_DENSITY) as MergeFamilyId[]) {
      const density = FAMILY_CANOPY_DENSITY[family];
      expect(familyCanopyVisibleFormCount(family)).toBeGreaterThanOrEqual(14);
      expect(familyCanopyVisibleFormCount(family)).toBeLessThanOrEqual(24);
      expect(density.clusters).toBeGreaterThanOrEqual(3);
      expect(density.clusters).toBeLessThanOrEqual(6);
      expect(density.tonalShades).toBeGreaterThanOrEqual(3);
      expect(density.tonalShades).toBeLessThanOrEqual(5);
    }
  });
});
