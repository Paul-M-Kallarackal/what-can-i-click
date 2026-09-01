import { Html, Instances, Instance, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { RootState, ThreeEvent } from "@react-three/fiber";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { MECHANISMS } from "../../data/mechanisms";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { DistrictId, DistrictSpec, LatestReadStrategy, MechanismId, MergeFamilyId } from "../../types";

export const COLORS = {
  mineral: "#D8D8D0",
  ceramic: "#F3F2EC",
  ink: "#15171A",
  yellow: "#FFCC01",
  cyan: "#78D7D2",
  pressure: "#D64C3F",
  amber: "#E6A52E",
  violet: "#8F82CE",
  glass: "#BFC8C8",
  cold: "#778E9B",
};

export type FamilyCanopyDensity = {
  semanticForms: number;
  supportingForms: number;
  clusters: number;
  tonalShades: number;
};

/**
 * Counts the meaningful front-layer forms and the smaller clustered support
 * forms together. Keeping this registry deterministic makes crown density a
 * testable visual contract instead of an impressionistic magic number.
 */
export const FAMILY_CANOPY_DENSITY: Record<MergeFamilyId, FamilyCanopyDensity> = {
  merge: { semanticForms: 4, supportingForms: 16, clusters: 4, tonalShades: 5 },
  replacing: { semanticForms: 8, supportingForms: 10, clusters: 5, tonalShades: 5 },
  coalescing: { semanticForms: 7, supportingForms: 10, clusters: 4, tonalShades: 5 },
  summing: { semanticForms: 3, supportingForms: 14, clusters: 4, tonalShades: 5 },
  aggregating: { semanticForms: 14, supportingForms: 6, clusters: 3, tonalShades: 5 },
  collapsing: { semanticForms: 9, supportingForms: 10, clusters: 4, tonalShades: 5 },
  "versioned-collapsing": { semanticForms: 10, supportingForms: 8, clusters: 4, tonalShades: 5 },
};

export function familyCanopyVisibleFormCount(family: MergeFamilyId) {
  const density = FAMILY_CANOPY_DENSITY[family];
  return density.semanticForms + density.supportingForms;
}

const machineRenderClock = { time: 0 };

type ScopedMotionState = {
  origin: number;
  pausedAt: number | null;
  pausedDuration: number;
  frozenTime: number;
  active: boolean;
  lastGlobalTime: number;
};

type MotionScopeValue = {
  active: boolean;
  readTime: () => number;
};

const MotionScopeContext = createContext<MotionScopeValue | null>(null);

function readSharedMachineTime() {
  return machineRenderClock.time;
}

export function advanceMachineRenderTime(delta: number) {
  machineRenderClock.time += Math.max(0, delta);
}

export function resetMachineRenderTime(time = 0) {
  machineRenderClock.time = Math.max(0, time);
}

/**
 * Deterministic loop and stage helpers for causal scene choreography.
 * Keeping these scalar and allocation-free lets every family express the same
 * arrival -> transformation -> consequence grammar without sharing a clock.
 */
export function motionLoop(time: number, rate: number, phase = 0) {
  return ((Math.max(0, time) * Math.max(0, rate) + phase) % 1 + 1) % 1;
}

export function motionStage(cycle: number, start: number, end: number) {
  if (end <= start) return cycle >= end ? 1 : 0;
  return THREE.MathUtils.smoothstep(cycle, start, end);
}

export function motionWindow(cycle: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) {
  return motionStage(cycle, enterStart, enterEnd) * (1 - motionStage(cycle, exitStart, exitEnd));
}

export type FoundryCraneStage = "ready" | "lower" | "grip" | "lift" | "carry" | "place" | "release" | "retract" | "return";

export type FoundryCraneFrame = {
  stage: FoundryCraneStage;
  carriageX: number;
  hookY: number;
  clawAngle: number;
  payloadVisible: boolean;
  payloadPosition: readonly [number, number, number];
  payloadScale: number;
};

export type FoundryMergeStage = "waiting" | "feed" | "interleave" | "commit" | "retire";

export type FoundryMergeFrame = {
  stage: FoundryMergeStage;
  inputProgress: number;
  inputOpacity: number;
  outputProgress: number;
  outputOpacity: number;
  committedPartVisible: boolean;
  gatePulse: number;
  inactiveSourceOpacity: number;
  removalProgress: number;
};

export type FoundryPartLifecycle = "active" | "inactive" | "removed";

/**
 * Keep a completed retirement readable during the next idle crane interval.
 * The status resets only when a new pair starts feeding the merge worker,
 * rather than flashing back to `active` at the exact loop boundary.
 */
export function foundryPartLifecycle(
  frame: FoundryMergeFrame,
  previous: FoundryPartLifecycle | "" = "",
): FoundryPartLifecycle {
  if (frame.removalProgress > 0.55) return "removed";
  if (previous === "removed" && frame.stage === "waiting") return "removed";
  if (frame.inactiveSourceOpacity > 0.05) return "inactive";
  return "active";
}

export type ReplacingReadStage = "observe" | "evaluate" | "resolve" | "emit";

export type ReplacingReadFrame = {
  stage: ReplacingReadStage;
  candidateProgress: number;
  decisionProgress: number;
  winnerProgress: number;
  loserOpacity: number;
  resultProgress: number;
  readWorkRatio: number;
};

export type CoalescingReadStage = "fragments" | "collect" | "assemble" | "emit";

export type CoalescingReadFrame = {
  stage: CoalescingReadStage;
  collectProgress: number;
  assembleProgress: number;
  outputProgress: number;
  sourceOpacity: number;
  workRatio: number;
};

export type SummingMergeStage = "unmerged" | "compact" | "partial" | "aggregate" | "exact";

export type SummingMergeFrame = {
  stage: SummingMergeStage;
  mergeProgress: number;
  partialProgress: number;
  queryProgress: number;
  resultProgress: number;
  sourceOpacity: number;
  storedRows: 2 | 3;
};

export type AggregatingStateStage = "states" | "merge" | "combined" | "finalize" | "result";

export type AggregatingStateFrame = {
  stage: AggregatingStateStage;
  mergeProgress: number;
  combinedProgress: number;
  finalizeProgress: number;
  resultProgress: number;
  sourceOpacity: number;
};

export type CollapsingHistoryStage = "history" | "pair" | "collapse" | "survivor" | "exact";

export type CollapsingHistoryFrame = {
  stage: CollapsingHistoryStage;
  pairProgress: number;
  collapseProgress: number;
  survivorProgress: number;
  readProgress: number;
  resultProgress: number;
  pairOpacity: number;
};

export type VersionedCollapseStage = "arrive" | "route" | "match" | "collapse" | "survive";

export type VersionedCollapseFrame = {
  stage: VersionedCollapseStage;
  arrivalProgress: number;
  routeProgress: number;
  matchProgress: number;
  collapseProgress: number;
  survivorProgress: number;
  pairOpacity: number;
};

export type TinyInsertStormStage = "arrive" | "stamp" | "backlog" | "throttle" | "recover";

export type TinyInsertStormFrame = {
  stage: TinyInsertStormStage;
  rowProgress: number;
  stampProgress: number;
  createdParts: number;
  retiredParts: number;
  backlogParts: number;
  mergeProgress: number;
  throttleProgress: number;
  batchFillRatio: number;
  recoveryProgress: number;
};

export type PartitionExplosionStage = "flush" | "fanout" | "isolated" | "bounded";

export type PartitionExplosionFrame = {
  stage: PartitionExplosionStage;
  flushProgress: number;
  fanoutProgress: number;
  visiblePools: number;
  boundaryLockProgress: number;
  recoveryProgress: number;
  totalPartitions: 480;
  illustratedPools: 6;
};

export type BackgroundContentionStage = "arrive" | "saturate" | "backlog" | "protect" | "recover";

export type BackgroundContentionFrame = {
  stage: BackgroundContentionStage;
  arrivalProgress: number;
  slotFillProgress: number;
  backlogProgress: number;
  mitigationProgress: number;
  recoveryProgress: number;
  mergeQueueDepth: number;
  ttlQueueDepth: number;
  mutationQueueDepth: number;
  queueAgeRatio: number;
  activeParts: number;
};

export type BadOrderingStage = "predicate" | "scatter" | "wide-scan" | "reorder" | "prune" | "result";

export type BadOrderingFrame = {
  stage: BadOrderingStage;
  predicateProgress: number;
  scatterProgress: number;
  wideScanProgress: number;
  reorderProgress: number;
  pruneProgress: number;
  resultProgress: number;
  readGranules: number;
  skippedGranules: number;
  totalGranules: 12;
};

export type AggregationSpillStage = "read" | "build" | "threshold" | "spill" | "external-merge" | "result";

export type AggregationSpillFrame = {
  stage: AggregationSpillStage;
  inputProgress: number;
  memoryRatio: number;
  spillProgress: number;
  spilledRuns: number;
  mergeProgress: number;
  resultProgress: number;
};

export type ReplicaLagStage = "commit" | "enqueue" | "transfer" | "backlog" | "catch-up" | "healthy";

export type ReplicaLagFrame = {
  stage: ReplicaLagStage;
  commitProgress: number;
  logProgress: number;
  queueDepth: number;
  oldestTaskRatio: number;
  transferProgress: number;
  replicaProgress: number;
  retryPulse: number;
};

export type KeeperQuorumStage = "healthy" | "partition" | "no-quorum" | "read-only" | "restore" | "reconciled";

export type KeeperQuorumFrame = {
  stage: KeeperQuorumStage;
  connectedVoters: number;
  voterConnectivity: [number, number, number];
  partitionProgress: number;
  writeProgress: number;
  readProgress: number;
  queuedWrites: number;
  restoreProgress: number;
  coordinationAvailable: boolean;
};

const craneSegment = (cycle: number, start: number, end: number, from: number, to: number) => (
  THREE.MathUtils.lerp(from, to, motionStage(cycle, start, end))
);

/**
 * One causal MergeTree crane cycle: descend, grip one immutable part, lift it,
 * carry it to the merge feed, release it, then return. The pure frame function
 * makes the choreography testable and keeps React out of the animation loop.
 */
export function foundryCraneFrame(time: number, pressure = false, reducedMotion = false): FoundryCraneFrame {
  // This is a rail crane: the carriage, claw, and cassette all share one
  // depth plane. Earlier versions lerped the cassette in Z while the claw
  // stayed on the rail, which made the load visibly escape the gripper.
  const sourceX = -1.15;
  const targetX = 2.28;
  const railZ = 0;
  const highHookY = -0.68;
  // Parent crane Y is 5.15. With the cassette 0.74 below the hook, -3.46
  // places Part B at world Y 0.95: exactly level with the intake queue.
  const lowHookY = -3.46;
  const openClawAngle = 0.42;
  const closedClawAngle = 0.02;

  if (reducedMotion) {
    return {
      stage: "return",
      carriageX: sourceX,
      hookY: highHookY,
      clawAngle: openClawAngle,
      payloadVisible: false,
      payloadPosition: [targetX, lowHookY - 0.74, railZ],
      payloadScale: 1,
    };
  }

  const cycle = motionLoop(time, pressure ? 0.13 : 0.085);
  let stage: FoundryCraneStage = "ready";
  let carriageX = sourceX;
  let hookY = highHookY;
  let clawAngle = openClawAngle;

  if (cycle < 0.06) {
    stage = "ready";
  } else if (cycle < 0.16) {
    stage = "lower";
    hookY = craneSegment(cycle, 0.06, 0.16, highHookY, lowHookY);
  } else if (cycle < 0.22) {
    stage = "grip";
    hookY = lowHookY;
    clawAngle = craneSegment(cycle, 0.16, 0.22, openClawAngle, closedClawAngle);
  } else if (cycle < 0.32) {
    stage = "lift";
    hookY = craneSegment(cycle, 0.22, 0.32, lowHookY, highHookY);
    clawAngle = closedClawAngle;
  } else if (cycle < 0.5) {
    stage = "carry";
    carriageX = craneSegment(cycle, 0.32, 0.5, sourceX, targetX);
    clawAngle = closedClawAngle;
  } else if (cycle < 0.59) {
    stage = "place";
    carriageX = targetX;
    hookY = craneSegment(cycle, 0.5, 0.59, highHookY, lowHookY);
    clawAngle = closedClawAngle;
  } else if (cycle < 0.64) {
    stage = "release";
    carriageX = targetX;
    hookY = lowHookY;
    clawAngle = craneSegment(cycle, 0.59, 0.64, closedClawAngle, openClawAngle);
  } else if (cycle < 0.72) {
    stage = "retract";
    carriageX = targetX;
    hookY = craneSegment(cycle, 0.64, 0.72, lowHookY, highHookY);
    clawAngle = openClawAngle;
  } else {
    stage = "return";
    carriageX = craneSegment(cycle, 0.72, 1, targetX, sourceX);
    clawAngle = openClawAngle;
  }

  if (cycle < 0.16) {
    return { stage, carriageX, hookY, clawAngle, payloadVisible: true, payloadPosition: [sourceX, lowHookY - 0.74, railZ], payloadScale: 1 };
  }
  if (cycle < 0.64) {
    return {
      stage,
      carriageX,
      hookY,
      clawAngle,
      payloadVisible: true,
      payloadPosition: [carriageX, hookY - 0.74, railZ],
      payloadScale: 1,
    };
  }
  if (cycle < 0.72) {
    return {
      stage,
      carriageX,
      hookY,
      clawAngle,
      payloadVisible: false,
      payloadPosition: [targetX, lowHookY - 0.74, railZ],
      payloadScale: 1,
    };
  }
  return { stage, carriageX, hookY, clawAngle, payloadVisible: false, payloadPosition: [sourceX, lowHookY - 0.74, railZ], payloadScale: 1 };
}

/**
 * The merge loom consumes the exact same cycle as the crane. It cannot begin
 * feeding until the crane releases its part, and it does not retire either
 * source until the replacement part has committed.
 */
export function foundryMergeFrame(time: number, pressure = false, reducedMotion = false): FoundryMergeFrame {
  if (reducedMotion) {
    return {
      stage: "commit",
      inputProgress: 1,
      inputOpacity: 0.22,
      outputProgress: 1,
      outputOpacity: 1,
      committedPartVisible: true,
      gatePulse: 1,
      inactiveSourceOpacity: 0.72,
      removalProgress: 0,
    };
  }

  const cycle = motionLoop(time, pressure ? 0.13 : 0.085);
  const nextCommitOpacity = motionStage(cycle, 0.82, 0.87);

  if (cycle < 0.64) {
    return {
      stage: "waiting",
      inputProgress: 0,
      inputOpacity: 1,
      outputProgress: 0,
      outputOpacity: 0,
      committedPartVisible: false,
      gatePulse: 0,
      inactiveSourceOpacity: 0,
      removalProgress: 0,
    };
  }
  if (cycle < 0.72) {
    const progress = motionStage(cycle, 0.64, 0.72);
    return {
      stage: "feed",
      inputProgress: progress,
      inputOpacity: 1,
      outputProgress: 0,
      outputOpacity: 0,
      committedPartVisible: false,
      gatePulse: progress * 0.45,
      inactiveSourceOpacity: 0,
      removalProgress: 0,
    };
  }
  if (cycle < 0.86) {
    const progress = motionStage(cycle, 0.72, 0.86);
    return {
      stage: "interleave",
      inputProgress: 1,
      inputOpacity: THREE.MathUtils.lerp(1, 0.28, progress),
      outputProgress: progress,
      outputOpacity: nextCommitOpacity,
      // Part C is visible while it is being written. It must not pop into
      // existence only after the black merge worker has finished.
      committedPartVisible: progress > 0.01,
      gatePulse: 0.45 + progress * 0.55,
      inactiveSourceOpacity: 0,
      removalProgress: 0,
    };
  }
  if (cycle < 0.9) {
    const inactiveProgress = motionStage(cycle, 0.86, 0.9);
    return {
      stage: "commit",
      inputProgress: 1,
      inputOpacity: 0.22,
      outputProgress: 1,
      outputOpacity: 1,
      committedPartVisible: true,
      gatePulse: 1,
      inactiveSourceOpacity: THREE.MathUtils.lerp(0, 1, inactiveProgress),
      removalProgress: 0,
    };
  }
  // Give the source parts enough time to visibly travel into the retirement
  // bin instead of disappearing through a last-frame shrink.
  const removalProgress = motionStage(cycle, 0.9, 1);
  return {
    stage: "retire",
    inputProgress: 1,
    inputOpacity: THREE.MathUtils.lerp(0.2, 0.02, motionStage(cycle, 0.9, 1)),
    outputProgress: 1,
    outputOpacity: 1,
    committedPartVisible: true,
    gatePulse: THREE.MathUtils.lerp(1, 0, motionStage(cycle, 0.9, 1)),
    inactiveSourceOpacity: 1 - removalProgress,
    removalProgress,
  };
}

/**
 * A deterministic latest-state read cycle for ReplacingMergeTree. The three
 * strategies share the same candidates but pay for correctness in different
 * places: background merging evaluates eventually, argMax computes one
 * total-order winner in the query, and FINAL applies the engine contract to
 * all matching candidates during the read.
 */
export function replacingReadFrame(time: number, strategy: LatestReadStrategy, reducedMotion = false): ReplacingReadFrame {
  const workByStrategy: Record<LatestReadStrategy, number> = {
    background: 0.28,
    argmax: 0.58,
    final: 0.94,
  };
  if (reducedMotion) {
    return {
      stage: "emit",
      candidateProgress: 1,
      decisionProgress: 1,
      winnerProgress: 1,
      loserOpacity: strategy === "background" ? 0.32 : 0.18,
      resultProgress: 1,
      readWorkRatio: workByStrategy[strategy],
    };
  }

  const rate = strategy === "background" ? 0.07 : strategy === "argmax" ? 0.095 : 0.082;
  const cycle = motionLoop(time, rate);
  const evaluateStart = strategy === "background" ? 0.34 : strategy === "argmax" ? 0.2 : 0.16;
  const resolveStart = strategy === "background" ? 0.7 : strategy === "argmax" ? 0.64 : 0.7;
  const emitStart = strategy === "background" ? 0.84 : strategy === "argmax" ? 0.78 : 0.82;
  const candidateProgress = motionStage(cycle, 0.04, evaluateStart);
  const decisionProgress = motionStage(cycle, evaluateStart, resolveStart);
  const winnerProgress = motionStage(cycle, resolveStart, emitStart);
  const resultProgress = motionStage(cycle, emitStart, 0.96);
  const stage: ReplacingReadStage = cycle < evaluateStart
    ? "observe"
    : cycle < resolveStart
      ? "evaluate"
      : cycle < emitStart
        ? "resolve"
        : "emit";

  return {
    stage,
    candidateProgress,
    decisionProgress,
    winnerProgress,
    loserOpacity: THREE.MathUtils.lerp(1, strategy === "background" ? 0.32 : 0.18, winnerProgress),
    resultProgress,
    readWorkRatio: workByStrategy[strategy],
  };
}

/**
 * Sparse fields can converge during a later background merge or be assembled
 * for one bounded read with FINAL. Both produce the same example row, but the
 * work moves from storage maintenance to the query path.
 */
export function coalescingReadFrame(time: number, strategy: "background" | "final", reducedMotion = false): CoalescingReadFrame {
  const workRatio = strategy === "final" ? 0.9 : 0.3;
  if (reducedMotion) {
    return { stage: "emit", collectProgress: 1, assembleProgress: 1, outputProgress: 1, sourceOpacity: 0.28, workRatio };
  }

  const cycle = motionLoop(time, strategy === "final" ? 0.085 : 0.062);
  const collectStart = strategy === "final" ? 0.14 : 0.32;
  const assembleStart = strategy === "final" ? 0.42 : 0.58;
  const emitStart = strategy === "final" ? 0.76 : 0.84;
  const collectProgress = motionStage(cycle, collectStart, assembleStart);
  const assembleProgress = motionStage(cycle, assembleStart, emitStart);
  const outputProgress = motionStage(cycle, emitStart, 0.96);
  const stage: CoalescingReadStage = cycle < collectStart
    ? "fragments"
    : cycle < assembleStart
      ? "collect"
      : cycle < emitStart
        ? "assemble"
        : "emit";

  return {
    stage,
    collectProgress,
    assembleProgress,
    outputProgress,
    sourceOpacity: THREE.MathUtils.lerp(1, 0.28, assembleProgress),
    workRatio,
  };
}

/**
 * One truthful SummingMergeTree cycle. Two equal-key rows can be compacted in
 * one background merge while a newer equal-key row remains in another part.
 * The exact read therefore aggregates the stored partial and the unmerged row;
 * storage convergence is useful, but never presented as the correctness gate.
 */
export function summingMergeFrame(time: number, reducedMotion = false): SummingMergeFrame {
  if (reducedMotion) {
    return {
      stage: "exact",
      mergeProgress: 1,
      partialProgress: 1,
      queryProgress: 1,
      resultProgress: 1,
      sourceOpacity: 0.18,
      storedRows: 2,
    };
  }

  const cycle = motionLoop(time, 0.068);
  const mergeProgress = motionStage(cycle, 0.16, 0.48);
  const partialProgress = motionStage(cycle, 0.48, 0.64);
  const queryProgress = motionStage(cycle, 0.66, 0.86);
  const resultProgress = motionStage(cycle, 0.86, 0.97);
  const stage: SummingMergeStage = cycle < 0.16
    ? "unmerged"
    : cycle < 0.48
      ? "compact"
      : cycle < 0.66
        ? "partial"
        : cycle < 0.86
          ? "aggregate"
          : "exact";

  return {
    stage,
    mergeProgress,
    partialProgress,
    queryProgress,
    resultProgress,
    sourceOpacity: THREE.MathUtils.lerp(1, 0.18, partialProgress),
    storedRows: partialProgress > 0.72 ? 2 : 3,
  };
}

/**
 * AggregateFunction columns preserve mergeable state. This example keeps an
 * avgState as (sum, count): (20, 2) and (90, 3) merge to (110, 5), and only a
 * matching avgMerge read finalizes the scalar 22. The state must not be
 * mistaken for a prematurely computed average.
 */
export function aggregatingStateFrame(time: number, reducedMotion = false): AggregatingStateFrame {
  if (reducedMotion) {
    return {
      stage: "result",
      mergeProgress: 1,
      combinedProgress: 1,
      finalizeProgress: 1,
      resultProgress: 1,
      sourceOpacity: 0.18,
    };
  }

  const cycle = motionLoop(time, 0.064);
  const mergeProgress = motionStage(cycle, 0.14, 0.48);
  const combinedProgress = motionStage(cycle, 0.48, 0.66);
  const finalizeProgress = motionStage(cycle, 0.68, 0.87);
  const resultProgress = motionStage(cycle, 0.87, 0.97);
  const stage: AggregatingStateStage = cycle < 0.14
    ? "states"
    : cycle < 0.48
      ? "merge"
      : cycle < 0.68
        ? "combined"
        : cycle < 0.87
          ? "finalize"
          : "result";

  return {
    stage,
    mergeProgress,
    combinedProgress,
    finalizeProgress,
    resultProgress,
    sourceOpacity: THREE.MathUtils.lerp(1, 0.18, combinedProgress),
  };
}

/**
 * A valid CollapsingMergeTree history contains an old state (+1), an exact
 * cancel copy (-1), and a replacement state (+1). Background merging may
 * remove the matched pair later; the exact read remains sign-aware while all
 * three rows are still visible.
 */
export function collapsingHistoryFrame(time: number, reducedMotion = false): CollapsingHistoryFrame {
  if (reducedMotion) {
    return {
      stage: "exact",
      pairProgress: 1,
      collapseProgress: 1,
      survivorProgress: 1,
      readProgress: 1,
      resultProgress: 1,
      pairOpacity: 0.18,
    };
  }

  const cycle = motionLoop(time, 0.062);
  const pairProgress = motionStage(cycle, 0.14, 0.42);
  const collapseProgress = motionStage(cycle, 0.42, 0.62);
  const survivorProgress = motionStage(cycle, 0.62, 0.79);
  const readProgress = motionStage(cycle, 0.79, 0.9);
  const resultProgress = motionStage(cycle, 0.9, 0.98);
  const stage: CollapsingHistoryStage = cycle < 0.14
    ? "history"
    : cycle < 0.42
      ? "pair"
      : cycle < 0.62
        ? "collapse"
        : cycle < 0.79
          ? "survivor"
          : "exact";

  return {
    stage,
    pairProgress,
    collapseProgress,
    survivorProgress,
    readProgress,
    resultProgress,
    pairOpacity: THREE.MathUtils.lerp(1, 0.18, collapseProgress),
  };
}

/**
 * VersionedCollapsingMergeTree can accept an out-of-order history because the
 * version is part of the collapse identity. A v1 +1 / -1 pair collapses even
 * when its rows arrive around a newer v2 +1 state; v2 never pairs with v1.
 */
export function versionedCollapseFrame(time: number, reducedMotion = false): VersionedCollapseFrame {
  if (reducedMotion) {
    return {
      stage: "survive",
      arrivalProgress: 1,
      routeProgress: 1,
      matchProgress: 1,
      collapseProgress: 1,
      survivorProgress: 1,
      pairOpacity: 0.18,
    };
  }

  const cycle = motionLoop(time, 0.06);
  const arrivalProgress = motionStage(cycle, 0.05, 0.24);
  const routeProgress = motionStage(cycle, 0.24, 0.48);
  const matchProgress = motionStage(cycle, 0.48, 0.66);
  const collapseProgress = motionStage(cycle, 0.66, 0.82);
  const survivorProgress = motionStage(cycle, 0.82, 0.98);
  const stage: VersionedCollapseStage = cycle < 0.24
    ? "arrive"
    : cycle < 0.48
      ? "route"
      : cycle < 0.66
        ? "match"
        : cycle < 0.82
          ? "collapse"
          : "survive";

  return {
    stage,
    arrivalProgress,
    routeProgress,
    matchProgress,
    collapseProgress,
    survivorProgress,
    pairOpacity: THREE.MathUtils.lerp(1, 0.18, collapseProgress),
  };
}

/**
 * A bounded tiny-insert pressure cycle. Independent single-row writes create
 * immutable parts faster than one illustrative background merge can retire
 * them. The final state keeps the accumulated pressure visible while a
 * batching path demonstrates many rows becoming one useful part. Counts are
 * deliberately model values, not measurements from a cluster.
 */
export function tinyInsertStormFrame(time: number, reducedMotion = false): TinyInsertStormFrame {
  if (reducedMotion) {
    return {
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
    };
  }

  const cycle = motionLoop(time, 0.105);
  const rowProgress = motionStage(cycle, 0.02, 0.2);
  const stampProgress = motionStage(cycle, 0.14, 0.46);
  const mergeProgress = motionStage(cycle, 0.42, 0.7);
  const throttleProgress = motionStage(cycle, 0.68, 0.82);
  const batchFillRatio = motionStage(cycle, 0.76, 0.91);
  const recoveryProgress = motionStage(cycle, 0.88, 0.98);
  const createdParts = Math.max(1, Math.round(THREE.MathUtils.lerp(1, 18, stampProgress)));
  const retiredParts = Math.min(2, Math.floor(mergeProgress * 2.999));

  return {
    stage: cycle < 0.14
      ? "arrive"
      : cycle < 0.46
        ? "stamp"
        : cycle < 0.68
          ? "backlog"
          : cycle < 0.82
            ? "throttle"
            : "recover",
    rowProgress,
    stampProgress,
    createdParts,
    retiredParts,
    backlogParts: createdParts - retiredParts,
    mergeProgress,
    throttleProgress,
    batchFillRatio,
    recoveryProgress,
  };
}

/**
 * One insert block touches 480 partition values. Six representative bays make
 * that fan-out legible without pretending to render every filesystem pool.
 * Parts never merge across those boundaries. The final state preserves the
 * fragmented result while introducing a coarse lifecycle boundary as the
 * corrective design contrast; query locality belongs in ORDER BY.
 */
export function partitionExplosionFrame(time: number, reducedMotion = false): PartitionExplosionFrame {
  if (reducedMotion) {
    return {
      stage: "bounded",
      flushProgress: 1,
      fanoutProgress: 1,
      visiblePools: 6,
      boundaryLockProgress: 1,
      recoveryProgress: 1,
      totalPartitions: 480,
      illustratedPools: 6,
    };
  }

  const cycle = motionLoop(time, 0.105);
  const flushProgress = motionStage(cycle, 0.03, 0.24);
  const fanoutProgress = motionStage(cycle, 0.24, 0.55);
  const boundaryLockProgress = motionStage(cycle, 0.5, 0.72);
  const recoveryProgress = motionStage(cycle, 0.76, 0.96);

  return {
    stage: cycle < 0.24
      ? "flush"
      : cycle < 0.55
        ? "fanout"
        : cycle < 0.76
          ? "isolated"
          : "bounded",
    flushProgress,
    fanoutProgress,
    visiblePools: Math.max(1, Math.min(6, Math.ceil(fanoutProgress * 6))),
    boundaryLockProgress,
    recoveryProgress,
    totalPartitions: 480,
    illustratedPools: 6,
  };
}

/**
 * A modeled background-capacity cycle, not a literal ClickHouse pool size.
 * TTL and mutation rewrites consume finite scheduling and storage capacity,
 * normal merge work falls behind, and active parts accumulate. The corrective
 * state moves broad rewrites out of the peak window so normal merges can catch
 * up. This keeps the causal resource tradeoff explicit without inventing a
 * server setting or guaranteed per-workload slot allocation.
 */
export function backgroundContentionFrame(time: number, reducedMotion = false): BackgroundContentionFrame {
  if (reducedMotion) {
    return {
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
    };
  }

  const cycle = motionLoop(time, 0.1);
  const arrivalProgress = motionStage(cycle, 0.03, 0.22);
  const slotFillProgress = motionStage(cycle, 0.16, 0.38);
  const backlogProgress = motionStage(cycle, 0.34, 0.62);
  const mitigationProgress = motionStage(cycle, 0.64, 0.82);
  const recoveryProgress = motionStage(cycle, 0.8, 0.97);
  const drainProgress = recoveryProgress;

  return {
    stage: cycle < 0.22
      ? "arrive"
      : cycle < 0.42
        ? "saturate"
        : cycle < 0.64
          ? "backlog"
          : cycle < 0.82
            ? "protect"
            : "recover",
    arrivalProgress,
    slotFillProgress,
    backlogProgress,
    mitigationProgress,
    recoveryProgress,
    mergeQueueDepth: Math.max(1, Math.round(THREE.MathUtils.lerp(1, 5, backlogProgress) - drainProgress * 4)),
    ttlQueueDepth: Math.max(1, Math.round(THREE.MathUtils.lerp(1, 3, backlogProgress) - drainProgress * 2)),
    mutationQueueDepth: Math.max(1, Math.round(THREE.MathUtils.lerp(1, 2, backlogProgress) - drainProgress)),
    queueAgeRatio: THREE.MathUtils.clamp(backlogProgress - drainProgress, 0, 1),
    activeParts: Math.max(2, Math.round(THREE.MathUtils.lerp(2, 6, backlogProgress) - drainProgress * 4)),
  };
}

/**
 * A representative sparse-index lesson, not a query benchmark. The first
 * physical order scatters one filter value across eleven of twelve illustrated
 * granules. A workload-shaped ORDER BY then clusters those same match tokens
 * into two adjacent granules so the sparse marks can discard the other ten.
 * Production acceptance still requires EXPLAIN indexes on production-shaped
 * data; the fixed counts exist only to make the causal contrast legible.
 */
export function badOrderingFrame(time: number, reducedMotion = false): BadOrderingFrame {
  if (reducedMotion) {
    return {
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
    };
  }

  const cycle = motionLoop(time, 0.085);
  const predicateProgress = motionStage(cycle, 0.02, 0.16);
  const scatterProgress = motionStage(cycle, 0.14, 0.3);
  const wideScanProgress = motionStage(cycle, 0.28, 0.5);
  const reorderProgress = motionStage(cycle, 0.52, 0.7);
  const pruneProgress = motionStage(cycle, 0.68, 0.86);
  const resultProgress = motionStage(cycle, 0.84, 0.97);
  const readGranules = Math.round(THREE.MathUtils.lerp(11, 2, pruneProgress));

  return {
    stage: cycle < 0.16
      ? "predicate"
      : cycle < 0.3
        ? "scatter"
        : cycle < 0.52
          ? "wide-scan"
          : cycle < 0.7
            ? "reorder"
            : cycle < 0.86
              ? "prune"
              : "result",
    predicateProgress,
    scatterProgress,
    wideScanProgress,
    reorderProgress,
    pruneProgress,
    resultProgress,
    readGranules,
    skippedGranules: 12 - readGranules,
    totalGranules: 12,
  };
}

/**
 * One external GROUP BY cycle. Distinct keys first expand partial aggregation
 * state in RAM. Only after the configured threshold is crossed do sealed
 * temporary runs leave memory, after which an external merge can finalize the
 * grouped result. The ordering is deliberately explicit so the visualization
 * never implies that spilling is a faster parallel output path.
 */
export function aggregationSpillFrame(time: number, reducedMotion = false): AggregationSpillFrame {
  if (reducedMotion) {
    return {
      stage: "result",
      inputProgress: 1,
      memoryRatio: 0.62,
      spillProgress: 1,
      spilledRuns: 3,
      mergeProgress: 1,
      resultProgress: 1,
    };
  }

  const cycle = motionLoop(time, 0.12);
  const inputProgress = motionStage(cycle, 0.03, 0.27);
  const buildProgress = motionStage(cycle, 0.12, 0.47);
  const spillProgress = motionStage(cycle, 0.5, 0.7);
  const mergeProgress = motionStage(cycle, 0.7, 0.88);
  const resultProgress = motionStage(cycle, 0.88, 0.97);
  const memoryRatio = cycle < 0.5
    ? THREE.MathUtils.lerp(0.24, 1, buildProgress)
    : THREE.MathUtils.lerp(1, 0.58, spillProgress);
  const spilledRuns = spillProgress <= 0
    ? 0
    : Math.min(3, Math.max(1, Math.ceil(spillProgress * 3)));

  return {
    stage: cycle < 0.12
      ? "read"
      : cycle < 0.47
        ? "build"
        : cycle < 0.5
          ? "threshold"
          : cycle < 0.7
            ? "spill"
            : cycle < 0.88
              ? "external-merge"
              : "result",
    inputProgress,
    memoryRatio,
    spillProgress,
    spilledRuns,
    mergeProgress,
    resultProgress,
  };
}

/**
 * A ReplicatedMergeTree catch-up cycle. The coordination ticket is created
 * before compressed part bytes begin their direct replica-to-replica trip.
 * During pressure, arrivals outpace the destination's fetch/storage path, so
 * queue depth and oldest-task age rise together before catch-up drains both.
 */
export function replicaLagFrame(time: number, reducedMotion = false): ReplicaLagFrame {
  if (reducedMotion) {
    return {
      stage: "backlog",
      commitProgress: 1,
      logProgress: 1,
      queueDepth: 7,
      oldestTaskRatio: 0.88,
      transferProgress: 0.34,
      replicaProgress: 0.46,
      retryPulse: 1,
    };
  }

  const cycle = motionLoop(time, 0.105);
  const commitProgress = motionStage(cycle, 0.02, 0.16);
  const logProgress = motionStage(cycle, 0.12, 0.28);
  const backlogGrowth = motionStage(cycle, 0.24, 0.6);
  const catchUp = motionStage(cycle, 0.7, 0.92);
  const queueDepth = cycle < 0.7
    ? Math.round(THREE.MathUtils.lerp(1, 7, backlogGrowth))
    : Math.max(0, Math.round(THREE.MathUtils.lerp(7, 0, catchUp)));
  const oldestTaskRatio = cycle < 0.7
    ? THREE.MathUtils.lerp(0.08, 1, backlogGrowth)
    : THREE.MathUtils.lerp(1, 0, catchUp);
  const transferProgress = cycle < 0.7
    ? THREE.MathUtils.lerp(0, 0.36, motionStage(cycle, 0.28, 0.65))
    : THREE.MathUtils.lerp(0.36, 1, catchUp);
  const replicaProgress = cycle < 0.7
    ? THREE.MathUtils.lerp(0.32, 0.48, motionStage(cycle, 0.3, 0.65))
    : THREE.MathUtils.lerp(0.48, 1, catchUp);

  return {
    stage: cycle < 0.12
      ? "commit"
      : cycle < 0.28
        ? "enqueue"
        : cycle < 0.48
          ? "transfer"
          : cycle < 0.7
            ? "backlog"
            : cycle < 0.94
              ? "catch-up"
              : "healthy",
    commitProgress,
    logProgress,
    queueDepth,
    oldestTaskRatio,
    transferProgress,
    replicaProgress,
    retryPulse: cycle >= 0.48 && cycle < 0.7 ? 0.45 + Math.sin(cycle * 86) * 0.45 : 0,
  };
}

/**
 * Models a three-voter Keeper ensemble losing its majority. Coordination and
 * new replicated writes stop, while local immutable parts remain on ClickHouse
 * replicas and can still serve reads. Recovery reconnects voters before queued
 * replicated work is allowed to advance again.
 */
export function keeperQuorumFrame(time: number, reducedMotion = false): KeeperQuorumFrame {
  if (reducedMotion) {
    return {
      stage: "read-only",
      connectedVoters: 1,
      voterConnectivity: [1, 0, 0],
      partitionProgress: 1,
      writeProgress: 0.46,
      readProgress: 1,
      queuedWrites: 4,
      restoreProgress: 0,
      coordinationAvailable: false,
    };
  }

  const cycle = motionLoop(time, 0.095);
  const partitionProgress = motionStage(cycle, 0.14, 0.32);
  const restoreProgress = motionStage(cycle, 0.7, 0.93);
  const voterConnectivity: [number, number, number] = cycle < 0.14
    ? [1, 1, 1]
    : cycle < 0.28
      ? [
          1,
          1 - motionStage(cycle, 0.2, 0.28),
          1 - motionStage(cycle, 0.14, 0.22),
        ]
      : cycle < 0.7
        ? [1, 0, 0]
        : cycle < 0.93
          ? [
              1,
              motionStage(cycle, 0.7, 0.78),
              motionStage(cycle, 0.8, 0.88),
            ]
          : [1, 1, 1];
  const connectedVoters = voterConnectivity.filter((value) => value >= 0.999).length;
  const coordinationAvailable = connectedVoters >= 2;
  const queuedWrites = cycle >= 0.28 && cycle < 0.78
    ? Math.min(5, 1 + Math.round(motionStage(cycle, 0.3, 0.66) * 4))
    : cycle >= 0.78 && cycle < 0.93
      ? Math.max(0, Math.round(THREE.MathUtils.lerp(5, 0, motionStage(cycle, 0.78, 0.93))))
      : 0;

  return {
    stage: cycle < 0.14
      ? "healthy"
      : cycle < 0.28
        ? "partition"
        : cycle < 0.5
          ? "no-quorum"
          : cycle < 0.7
            ? "read-only"
            : cycle < 0.92
              ? "restore"
              : "reconciled",
    connectedVoters,
    voterConnectivity,
    partitionProgress,
    writeProgress: !coordinationAvailable
      ? 0.46
      : cycle < 0.14
        ? motionStage(cycle, 0.02, 0.13)
        : THREE.MathUtils.lerp(0.46, 1, motionStage(cycle, 0.78, 0.93)),
    readProgress: motionLoop(time, 0.34),
    queuedWrites,
    restoreProgress,
    coordinationAvailable,
  };
}

export const TIDBIT_FOCUS_CUE_DURATION = 0.22;

export type TidbitFocusCueState = {
  tidbitId: string | null;
  elapsed: number;
};

export type TidbitFocusCueFrame = {
  visible: boolean;
  haloScale: number;
  haloOpacity: number;
  localScaleBoost: number;
};

/**
 * A selection replaces the current impulse instead of queueing behind it.
 * `retrigger` lets a second click on an already-selected scene object restart
 * the local response even though the selected store id itself is unchanged.
 */
export function retargetTidbitFocusCue(
  current: TidbitFocusCueState,
  tidbitId: string | null,
  retrigger = false,
): TidbitFocusCueState {
  if (!tidbitId) return { tidbitId: null, elapsed: 0 };
  if (!retrigger && current.tidbitId === tidbitId) return current;
  return { tidbitId, elapsed: 0 };
}

/**
 * One short, strong ease-out impulse provides immediate spatial feedback.
 * Reduced motion retains the selection signal as color/opacity and a static
 * halo, with no positional or scale animation.
 */
export function tidbitFocusCueFrame(elapsed: number, reducedMotion: boolean): TidbitFocusCueFrame {
  if (reducedMotion) {
    return {
      visible: true,
      haloScale: 1.28,
      haloOpacity: 0.76,
      localScaleBoost: 0,
    };
  }

  const progress = THREE.MathUtils.clamp(elapsed / TIDBIT_FOCUS_CUE_DURATION, 0, 1);
  if (progress >= 1) {
    return {
      visible: false,
      haloScale: 1.82,
      haloOpacity: 0,
      localScaleBoost: 0,
    };
  }

  const easeOut = 1 - Math.pow(1 - progress, 3);
  const remaining = 1 - easeOut;
  return {
    visible: true,
    haloScale: THREE.MathUtils.lerp(0.96, 1.82, easeOut),
    haloOpacity: 0.92 * remaining * remaining,
    localScaleBoost: 0.16 * remaining,
  };
}

type TidbitFocusRequestListener = (tidbitId: string) => void;

const tidbitFocusRequestListeners = new Set<TidbitFocusRequestListener>();

/** Scene objects use this narrow signal to retrigger their semantic hotspot. */
export function requestTidbitFocusFeedback(tidbitId: string) {
  tidbitFocusRequestListeners.forEach((listener) => listener(tidbitId));
}

export function subscribeTidbitFocusFeedback(listener: TidbitFocusRequestListener) {
  tidbitFocusRequestListeners.add(listener);
  return () => { tidbitFocusRequestListeners.delete(listener); };
}

export function useMachineTime() {
  return useContext(MotionScopeContext)?.readTime ?? readSharedMachineTime;
}

export function useMotionActive() {
  return useContext(MotionScopeContext)?.active ?? true;
}

export function MotionScopeProvider({
  active,
  startTime,
  children,
}: {
  active: boolean;
  startTime: number;
  children: ReactNode;
}) {
  const scope = useRef<ScopedMotionState>({
    origin: startTime,
    pausedAt: active ? null : machineRenderClock.time,
    pausedDuration: 0,
    frozenTime: Math.max(0, machineRenderClock.time - startTime),
    active,
    lastGlobalTime: machineRenderClock.time,
  });

  useLayoutEffect(() => {
    const state = scope.current;
    const now = machineRenderClock.time;
    if (state.origin !== startTime) {
      state.origin = startTime;
      state.pausedDuration = 0;
      state.pausedAt = active ? null : now;
      state.frozenTime = Math.max(0, now - startTime);
      state.lastGlobalTime = now;
      state.active = active;
      return;
    }
    if (state.active === active) return;
    if (!active) {
      state.frozenTime = Math.max(0, now - state.origin - state.pausedDuration);
      state.pausedAt = now;
    } else if (state.pausedAt !== null) {
      state.pausedDuration += Math.max(0, now - state.pausedAt);
      state.pausedAt = null;
    }
    state.lastGlobalTime = now;
    state.active = active;
  }, [active, startTime]);

  const readTime = useCallback(() => {
    const state = scope.current;
    const now = machineRenderClock.time;
    if (now + 0.0001 < state.lastGlobalTime) {
      state.origin = now;
      state.pausedDuration = 0;
      state.pausedAt = state.active ? null : now;
      state.frozenTime = 0;
    }
    state.lastGlobalTime = now;
    return state.active
      ? Math.max(0, now - state.origin - state.pausedDuration)
      : state.frozenTime;
  }, []);

  const value = useMemo<MotionScopeValue>(() => ({ active, readTime }), [active, readTime]);
  return <MotionScopeContext.Provider value={value}>{children}</MotionScopeContext.Provider>;
}

/** Runs continuously while active, once to freeze the current pose when dormant. */
export function useMotionFrame(
  callback: (state: RootState, delta: number) => void,
  renderPriority?: number,
  enabled = true,
) {
  const active = useMotionActive() && enabled;
  const appliedDormantPose = useRef(false);
  useFrame((state, delta) => {
    if (!active && appliedDormantPose.current) return;
    callback(state, delta);
    appliedDormantPose.current = !active;
  }, renderPriority);
}

export type MaterialFadeChannel = "scene" | "family" | "read";

type MaterialFadeState = {
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
  channels: Partial<Record<MaterialFadeChannel, number>>;
};

function materialFadeState(material: THREE.Material) {
  const stored = material.userData.composedFade as MaterialFadeState | undefined;
  if (stored) return stored;
  const created: MaterialFadeState = {
    baseOpacity: material.opacity,
    baseTransparent: material.transparent,
    baseDepthWrite: material.depthWrite,
    channels: {},
  };
  material.userData.composedFade = created;
  return created;
}

function commitMaterialFade(material: THREE.Material, state: MaterialFadeState) {
  const alpha = Object.values(state.channels).reduce((product, value) => product * (value ?? 1), 1);
  const transparent = state.baseTransparent || alpha < 0.999;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
  material.opacity = state.baseOpacity * alpha;
  material.depthWrite = alpha >= 0.999 ? state.baseDepthWrite : false;
}

export function setComposedMaterialFade(material: THREE.Material, channel: MaterialFadeChannel, alpha: number) {
  const state = materialFadeState(material);
  state.channels[channel] = THREE.MathUtils.clamp(alpha, 0, 1);
  commitMaterialFade(material, state);
}

export function setComposedMaterialBaseOpacity(material: THREE.Material, opacity: number) {
  const state = materialFadeState(material);
  state.baseOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
  commitMaterialFade(material, state);
}

export function applyComposedGroupFade(group: THREE.Group | null, channel: MaterialFadeChannel, alpha: number) {
  const seen = new Set<THREE.Material>();
  group?.traverse((object) => {
    const value = (object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material;
    const materials = Array.isArray(value) ? value : value ? [value] : [];
    materials.forEach((material) => {
      if (seen.has(material)) return;
      seen.add(material);
      setComposedMaterialFade(material, channel, alpha);
    });
  });
}

export type FlowPoint = readonly [number, number, number];

function curveFromPoints(points: readonly FlowPoint[]) {
  return new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], point[1], point[2])));
}

function useStableCurve(points: readonly FlowPoint[]) {
  // Most callers declare short point arrays inline. The semantic key prevents
  // those equivalent arrays from rebuilding curve and tube resources on every
  // React render.
  const pointKey = JSON.stringify(points);
  // `points` is intentionally represented by pointKey in the dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => curveFromPoints(points), [pointKey]);
}

export function LivingTube({
  points,
  radius,
  color,
  emissive = 0,
  tubularSegments = 48,
  radialSegments = 9,
}: {
  points: readonly FlowPoint[];
  radius: number;
  color: string;
  emissive?: number;
  tubularSegments?: number;
  radialSegments?: number;
}) {
  const curve = useStableCurve(points);
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false),
    [curve, radius, radialSegments, tubularSegments],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissive}
        roughness={0.56}
        metalness={0.05}
      />
    </mesh>
  );
}

const DEFAULT_FLOW_OFFSETS = [0, 0.2, 0.4, 0.6, 0.8] as const;

/**
 * Moves every orb in one logical stream with one instanced draw call and one
 * frame callback. Curve positions are pre-sampled so the hot path only does
 * scalar interpolation and matrix writes.
 */
export function FlowOrbStream({
  points,
  color,
  offsets = DEFAULT_FLOW_OFFSETS,
  speed = 0.36,
  scale = 1,
  radius = 0.19,
  hitRadius = 0.42,
  sampleDivisions = 128,
  tidbitId,
}: {
  points: readonly FlowPoint[];
  color: string;
  offsets?: readonly number[];
  speed?: number;
  scale?: number;
  radius?: number;
  hitRadius?: number;
  sampleDivisions?: number;
  tidbitId?: string;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const helper = useRef(new THREE.Object3D());
  const lastTime = useRef(Number.NaN);
  const lastActiveScale = useRef(Number.NaN);
  const getTime = useMachineTime();
  const active = useAtlasStore((state) => Boolean(tidbitId) && state.selectedTidbitId === tidbitId);
  const curve = useStableCurve(points);
  const divisions = Math.max(24, Math.min(256, Math.round(sampleDivisions)));
  const offsetKey = offsets.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streamOffsets = useMemo(() => Array.from(offsets), [offsetKey]);
  const sampledPositions = useMemo(() => {
    const samples = curve.getSpacedPoints(divisions);
    const positions = new Float32Array(samples.length * 3);
    samples.forEach((point, index) => {
      const target = index * 3;
      positions[target] = point.x;
      positions[target + 1] = point.y;
      positions[target + 2] = point.z;
    });
    return positions;
  }, [curve, divisions]);
  const hitGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, Math.min(divisions, 72), hitRadius, 6, false),
    [curve, divisions, hitRadius],
  );

  useLayoutEffect(() => {
    if (mesh.current) mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    lastTime.current = Number.NaN;
    lastActiveScale.current = Number.NaN;
  }, [divisions, offsetKey, sampledPositions, scale, speed]);

  useEffect(() => {
    return () => {
      hitGeometry.dispose();
      if (typeof document !== "undefined") document.body.style.cursor = "default";
    };
  }, [hitGeometry]);

  useMotionFrame(() => {
    const target = mesh.current;
    if (!target) return;

    const time = getTime();
    const object = helper.current;
    const activeScale = active ? 1.35 : 1;
    if (time === lastTime.current && activeScale === lastActiveScale.current) return;

    for (let index = 0; index < streamOffsets.length; index += 1) {
      const progress = ((time * speed + streamOffsets[index]) % 1 + 1) % 1;
      const samplePosition = progress * divisions;
      const lowerSample = Math.floor(samplePosition);
      const upperSample = Math.min(lowerSample + 1, divisions);
      const alpha = samplePosition - lowerSample;
      const lowerOffset = lowerSample * 3;
      const upperOffset = upperSample * 3;

      object.position.set(
        THREE.MathUtils.lerp(sampledPositions[lowerOffset], sampledPositions[upperOffset], alpha),
        THREE.MathUtils.lerp(sampledPositions[lowerOffset + 1], sampledPositions[upperOffset + 1], alpha),
        THREE.MathUtils.lerp(sampledPositions[lowerOffset + 2], sampledPositions[upperOffset + 2], alpha),
      );
      const pulse = scale * activeScale * (0.9 + Math.sin(progress * Math.PI) * 0.22);
      object.scale.setScalar(pulse);
      object.updateMatrix();
      target.setMatrixAt(index, object.matrix);
    }

    target.instanceMatrix.needsUpdate = true;
    lastTime.current = time;
    lastActiveScale.current = activeScale;
  });

  const handleClick = tidbitId
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (event.delta <= 4) {
          requestTidbitFocusFeedback(tidbitId);
          useAtlasStore.getState().selectTidbit(tidbitId);
        }
      }
    : undefined;
  const handlePointerOver = tidbitId
    ? (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }
    : undefined;
  const handlePointerOut = tidbitId
    ? () => {
        document.body.style.cursor = "default";
      }
    : undefined;

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, streamOffsets.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[radius, 12, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.25 : 0.85}
          roughness={0.22}
        />
      </instancedMesh>
      {tidbitId && (
        <mesh
          geometry={hitGeometry}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}

export function ChamberBase({ accent, width = 5.3, depth = 4.6 }: { accent: string; width?: number; depth?: number }) {
  return (
    <group>
      <RoundedBox args={[width, 0.58, depth]} radius={0.32} smoothness={4} position={[0, -0.26, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#AAACA8" roughness={0.72} metalness={0.08} />
      </RoundedBox>
      <mesh position={[0, 0.205, depth / 2 - 0.12]}>
        <boxGeometry args={[width - 0.5, 0.035, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.28} />
      </mesh>
    </group>
  );
}

export function DataCassette({ position = [0, 0, 0], scale = [1, 1, 1], color = COLORS.yellow, opacity = 1, emissive = 0.16 }: {
  position?: [number, number, number];
  scale?: [number, number, number];
  color?: string;
  opacity?: number;
  emissive?: number;
}) {
  return (
    <RoundedBox args={[1.15, 0.48, 0.72]} radius={0.1} smoothness={3} position={position} scale={scale} castShadow>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.48} metalness={0.08} transparent={opacity < 1} opacity={opacity} />
    </RoundedBox>
  );
}

export function DataBars({ count = 18, spread = [2.4, 1.4, 1.4], color = COLORS.yellow, offset = [0, 0, 0], scale = [0.07, 0.34, 0.07] }: {
  count?: number;
  spread?: [number, number, number];
  color?: string;
  offset?: [number, number, number];
  scale?: [number, number, number];
}) {
  const rows = useMemo(() => Array.from({ length: count }, (_, index) => ({
    position: [offset[0] + ((index * 17) % 19) / 18 * spread[0] - spread[0] / 2, offset[1] + ((index * 11) % 13) / 12 * spread[1], offset[2] + ((index * 7) % 17) / 16 * spread[2] - spread[2] / 2] as [number, number, number],
    scale: 0.72 + (index % 5) * 0.08,
  })), [count, offset, spread]);
  return (
    <Instances limit={count} range={count} castShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.42} />
      {rows.map((row, index) => <Instance key={index} position={row.position} scale={row.scale} />)}
    </Instances>
  );
}

export function GlassBox({ position = [0, 0, 0], size = [2, 2, 2], color = COLORS.glass, opacity = 0.22 }: {
  position?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  opacity?: number;
}) {
  return (
    <RoundedBox args={size} radius={0.16} smoothness={4} position={position}>
      <meshPhysicalMaterial color={color} transparent opacity={opacity} roughness={0.12} metalness={0.03} transmission={0.12} depthWrite={false} />
    </RoundedBox>
  );
}

export function Conveyor({ from, to, color = COLORS.ink, width = 0.16 }: { from: [number, number, number]; to: [number, number, number]; color?: string; width?: number }) {
  const vector = useMemo(() => new THREE.Vector3(...to).sub(new THREE.Vector3(...from)), [from, to]);
  const midpoint = useMemo(() => new THREE.Vector3(...from).add(new THREE.Vector3(...to)).multiplyScalar(0.5), [from, to]);
  return (
    <mesh position={midpoint} rotation={[0, Math.atan2(vector.x, vector.z), Math.PI / 2]}>
      <cylinderGeometry args={[width, width, vector.length(), 10]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.4} emissive={color} emissiveIntensity={color === COLORS.yellow || color === COLORS.cyan ? 0.22 : 0} />
    </mesh>
  );
}

export function InstrumentGauge({ position, value, color = COLORS.yellow, label }: { position: [number, number, number]; value: number; color?: string; label?: string }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.055, 10, 40, Math.PI * 1.5]} />
        <meshStandardMaterial color="#4A4D4D" roughness={0.42} metalness={0.4} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI * 0.6 + value * Math.PI * 1.2]} position={[0, 0.03, 0]}>
        <boxGeometry args={[0.05, 0.52, 0.045]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {label && <Html pointerEvents="none" center position={[0, -0.58, 0]} distanceFactor={10}><span className="machine-micro-label">{label}</span></Html>}
    </group>
  );
}

export function DistrictLabel({ district, focused }: { district: DistrictSpec; focused: boolean }) {
  return (
    <Html center position={[0, 5.25, 0]} distanceFactor={15} zIndexRange={[6, 0]}>
      <button
        type="button"
        className="district-label"
        data-focused={focused}
        onClick={() => useAtlasStore.getState().selectMechanism(district.mechanismIds[0])}
        aria-label={`Inspect ${district.title}`}
      >
        <span>{String(district.index).padStart(2, "0")}</span>
        <strong>{district.shortTitle}</strong>
        <small>{district.mechanismIds.length} mechanisms</small>
      </button>
    </Html>
  );
}

export function MechanismMarkers({ districtId }: { districtId: DistrictId }) {
  const selected = useAtlasStore((state) => state.selectedMechanismId);
  const viewLevel = useAtlasStore((state) => state.viewLevel);
  const visible = mechanismDistrict(selected) === districtId && viewLevel !== "system";
  if (!visible) return null;
  return (
    <group>
      {MECHANISMS.filter((entry) => entry.districtId === districtId).map((entry) => (
        <Html key={entry.id} center position={entry.markerPosition as [number, number, number]} distanceFactor={8.5} zIndexRange={[12, 7]}>
          <button
            type="button"
            className="mechanism-marker"
            data-active={selected === entry.id}
            onClick={(event) => { event.stopPropagation(); useAtlasStore.getState().selectMechanism(entry.id, selected === entry.id ? "xray" : "mechanism"); }}
            onPointerEnter={() => useAtlasStore.getState().hoverMechanism(entry.id)}
            onPointerLeave={() => useAtlasStore.getState().hoverMechanism(null)}
          >
            <i />
            <span>{entry.shortTitle}</span>
          </button>
        </Html>
      ))}
    </group>
  );
}

export function SelectionHalo({ active, color = COLORS.yellow, radius = 2.7 }: { active: boolean; color?: string; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (!ref.current) return;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.opacity = THREE.MathUtils.lerp(material.opacity, 0.62 + Math.sin(getTime() * 2) * 0.08, 0.12);
  });
  if (!active) return null;
  return (
    <mesh ref={ref} position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.045, 8, 72]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.08} />
    </mesh>
  );
}

export function mechanismDistrict(id: MechanismId | null) {
  return id?.split(".")[0] as DistrictId | undefined;
}
