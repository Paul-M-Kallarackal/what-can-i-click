import { beforeEach, describe, expect, it } from "vitest";
import { getGuideProductionEvidence, getJourneyPanelState, resolveVisibleAgentLogIndex } from "../components/ui/AgentJourneyPanel";
import { recommendArchitecture, workloadProfileSchema } from "../lib/advisor";
import { useAtlasStore } from "../store/useAtlasStore";
import { evidenceById } from "./evidence";
import { mechanismById } from "./mechanisms";
import { mergeFamilyById } from "./mergeFamilies";
import {
  resolveActiveAgentLogIndex,
  resolveAgentLogGuideIndex,
  resolveJourneyGuideStep,
  USE_CASE_JOURNEYS,
  useCaseJourneyById,
} from "./useCaseJourneys";

describe("deterministic ChatGPT and WebMCP use-case journeys", () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it("ships exactly ten bounded, uniquely addressable journeys", () => {
    expect(USE_CASE_JOURNEYS).toHaveLength(10);
    expect(new Set(USE_CASE_JOURNEYS.map((journey) => journey.id)).size).toBe(10);

    for (const journey of USE_CASE_JOURNEYS) {
      expect(workloadProfileSchema.parse(journey.profile)).toEqual(journey.profile);
      expect(useCaseJourneyById(journey.id)).toBe(journey);
      expect(journey.prompt.length).toBeLessThanOrEqual(180);
      expect(journey.prompt).not.toMatch(/password|credential|api[_ -]?key|select\s+.+\s+from/i);
    }
  });

  it("pins every journey to the current deterministic advisor path", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      const first = recommendArchitecture(journey.profile);
      const replay = recommendArchitecture({ ...journey.profile });

      expect(replay).toEqual(first);
      expect(first.path).toEqual(journey.mechanismPath);
      expect(first.path.every((id) => mechanismById(id))).toBe(true);
      expect(first.decisions.every((decision) => decision.evidenceIds.length > 0)).toBe(true);
    }
  });

  it("selects a reviewed MergeTree family and documents argMax and FINAL where they matter", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      expect(mergeFamilyById(journey.familyId).id).toBe(journey.familyId);
      expect(journey.strategy.label).toBeTruthy();
      expect(journey.strategy.readPattern).toBeTruthy();
      expect(journey.strategy.rationale).toBeTruthy();
    }

    expect(useCaseJourneyById("postgres-cdc-latest-state")?.strategy.latestRead).toBe("argmax");
    expect(useCaseJourneyById("iot-sparse-device-state")?.strategy.latestRead).toBe("final");
  });

  it("provides concise, ordered agent traces without leaking arbitrary input", () => {
    const expectedStages = ["interpret", "route", "decide", "tradeoff", "guide"];

    for (const journey of USE_CASE_JOURNEYS) {
      expect(journey.agentLog.map((step) => step.stage)).toEqual(expectedStages);
      expect(journey.agentLog).toHaveLength(5);
      expect(journey.agentLog.every((step) => step.message.length > 12 && step.message.length <= 140)).toBe(true);
      expect(journey.agentLog.reduce((length, step) => length + step.message.length, 0)).toBeLessThanOrEqual(700);
      expect(journey.agentLog.map((step) => step.message).join(" ")).not.toContain(journey.prompt);
      expect(journey.tradeoff.benefit).toBeTruthy();
      expect(journey.tradeoff.cost).toBeTruthy();
    }
  });

  it("maps every agent trace control to a bounded visual guide step", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      const targets = journey.agentLog.map((_, index) => resolveAgentLogGuideIndex(journey, index));
      const storageIndex = journey.guidePath.findIndex((step) => step.phase === "storage");
      const downstreamIndex = journey.guidePath.findIndex((step, index) => index > storageIndex && step.phase !== "storage");

      expect(targets).toEqual([
        0,
        0,
        storageIndex,
        downstreamIndex,
        journey.guidePath.length - 1,
      ]);
      expect(targets.every((index) => index >= 0 && index < journey.guidePath.length)).toBe(true);
      expect(resolveAgentLogGuideIndex(journey, Number.POSITIVE_INFINITY)).toBe(journey.guidePath.length - 1);
      expect(resolveAgentLogGuideIndex(journey, -1)).toBe(0);

      for (let logIndex = 0; logIndex < journey.agentLog.length; logIndex += 1) {
        expect(resolveVisibleAgentLogIndex(journey, targets[logIndex], logIndex)).toBe(logIndex);
      }

      for (let guideIndex = 0; guideIndex < journey.guidePath.length; guideIndex += 1) {
        const activeLogIndex = resolveActiveAgentLogIndex(journey, guideIndex);
        expect(activeLogIndex).toBeGreaterThanOrEqual(0);
        expect(activeLogIndex).toBeLessThan(journey.agentLog.length);
        expect(targets[activeLogIndex]).toBeLessThanOrEqual(guideIndex);
      }
    }
  });

  it("pins production evidence to each exact guide step instead of fuzzy ranking", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      for (let index = 0; index < journey.guidePath.length; index += 1) {
        const step = journey.guidePath[index];
        expect(step).toHaveProperty("productionEvidenceId");
        const resolved = getGuideProductionEvidence(journey, index);

        if (step.productionEvidenceId === null) {
          expect(resolved).toEqual({ implementation: undefined, alignedOn: null });
          expect(step.id).toBe("iot-tree");
          continue;
        }

        expect(resolved.implementation?.id).toBe(step.productionEvidenceId);
        expect(["family", "mechanism"]).toContain(resolved.alignedOn);
      }
    }
  });

  it("gives the multi-region workload its own regional architecture step", () => {
    const journey = useCaseJourneyById("multi-region-product-analytics")!;
    const regionalSteps = journey.guidePath.filter((step) => step.mechanismId === "architecture.multi-region");

    expect(regionalSteps).toHaveLength(1);
    expect(regionalSteps[0]).toMatchObject({
      id: "region-cross",
      phase: "architecture",
      productionEvidenceId: "seemplicity-postgres-cdc",
    });
  });

  it("guides every workload from ingestion through a family and read into read or retention", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      const phases = journey.guidePath.map((step) => step.phase);
      const stepIds = journey.guidePath.map((step) => step.id);

      expect(phases[0]).toBe("ingestion");
      expect(phases).toContain("storage");
      expect(phases).toContain("read");
      expect(["read", "retention"]).toContain(phases.at(-1));
      expect(new Set(stepIds).size).toBe(stepIds.length);
      expect(journey.guidePath.some((step) => step.phase === "storage" && step.familyId === journey.familyId)).toBe(true);

      for (const step of journey.guidePath) {
        expect(mechanismById(step.mechanismId)).toBeTruthy();
        expect(journey.mechanismPath).toContain(step.mechanismId);
        expect(evidenceById(step.evidenceId)).toBeTruthy();
      }
    }
  });

  it("drives the actual 3D family and strategy while visibly resolving every step focus", () => {
    for (const journey of USE_CASE_JOURNEYS) {
      const store = useAtlasStore.getState();
      store.setLatestReadStrategy("final");
      store.startJourney(journey.id);

      for (let index = 0; index < journey.guidePath.length; index += 1) {
        useAtlasStore.getState().setJourneyStep(index);
        const expected = resolveJourneyGuideStep(journey, index);
        expect(useAtlasStore.getState()).toMatchObject({
          activeJourneyId: journey.id,
          journeyStepIndex: expected.index,
          mergeFamilyId: expected.familyId,
          latestReadStrategy: expected.latestReadStrategy,
          selectedMechanismId: null,
          selectedEvidenceId: null,
          viewLevel: "system",
        });

        const panel = getJourneyPanelState(journey, index);
        expect(panel.guide).toEqual(expected);
        expect(panel.family.title).toBeTruthy();
        expect(panel.strategy.label).toBeTruthy();
        expect(panel.mechanism.title).toBeTruthy();
        expect(panel.evidence?.company).toBeTruthy();
      }

      useAtlasStore.getState().setJourneyStep(Number.POSITIVE_INFINITY);
      expect(useAtlasStore.getState().journeyStepIndex).toBe(journey.guidePath.length - 1);
      useAtlasStore.getState().setJourneyStep(-1);
      expect(useAtlasStore.getState().journeyStepIndex).toBe(0);
      useAtlasStore.getState().stopJourney();
    }
  });

  it("links each guide only to other shipped journeys", () => {
    const ids = new Set(USE_CASE_JOURNEYS.map((journey) => journey.id));

    for (const journey of USE_CASE_JOURNEYS) {
      expect(journey.relatedJourneyIds.length).toBeGreaterThan(0);
      expect(new Set(journey.relatedJourneyIds).size).toBe(journey.relatedJourneyIds.length);
      expect(journey.relatedJourneyIds).not.toContain(journey.id);
      expect(journey.relatedJourneyIds.every((id) => ids.has(id))).toBe(true);
    }
  });
});
