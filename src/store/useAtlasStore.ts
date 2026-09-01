import { create } from "zustand";
import { LIFECYCLE_PATH, mechanismById } from "../data/mechanisms";
import { operationalScenarioById } from "../data/operationalScenarios";
import { resolveJourneyGuideStep, useCaseJourneyById } from "../data/useCaseJourneys";
import { eventsForStory, nextEventTime } from "../lib/simulation";
import type { ArchitectureRecommendation, LatestReadStrategy, MechanismId, MergeFamilyId, ScenarioMode, SimulationEvent, StoryMode, ViewLevel, WorkloadProfile } from "../types";

type InspectorSnap = "peek" | "full";

type AtlasState = {
  selectedMechanismId: MechanismId | null;
  selectedEvidenceId: string | null;
  evidenceComparisonId: string | null;
  hoveredMechanismId: MechanismId | null;
  viewLevel: ViewLevel;
  scenario: ScenarioMode;
  mergeFamilyId: MergeFamilyId;
  latestReadStrategy: LatestReadStrategy;
  latestReadComparison: "argmax-vs-final" | null;
  selectedTidbitId: string | null;
  showSavedWork: boolean;
  comparisonIds: [MechanismId, MechanismId] | null;
  recommendation: ArchitectureRecommendation | null;
  recommendationProfile: WorkloadProfile | null;
  recommendationStepIndex: number;
  storyMode: StoryMode;
  storyPath: MechanismId[];
  storyEvents: SimulationEvent[];
  storyIndex: number;
  storyRevision: number;
  playing: boolean;
  speed: number;
  simulationTime: number;
  reducedMotion: boolean;
  searchOpen: boolean;
  worldInWordsOpen: boolean;
  aboutOpen: boolean;
  journeyPanelOpen: boolean;
  activeJourneyId: string | null;
  journeyStepIndex: number;
  inspectorSnap: InspectorSnap;
  selectMechanism: (id: MechanismId | null, level?: ViewLevel) => void;
  selectEvidence: (id: string | null) => void;
  setEvidenceComparison: (id: string | null) => void;
  hoverMechanism: (id: MechanismId | null) => void;
  setViewLevel: (level: ViewLevel) => void;
  openXray: () => void;
  showSystem: () => void;
  setScenario: (scenario: ScenarioMode) => void;
  setMergeFamily: (familyId: MergeFamilyId) => void;
  setLatestReadStrategy: (strategy: LatestReadStrategy) => void;
  setLatestReadComparison: (comparison: "argmax-vs-final" | null) => void;
  selectTidbit: (id: string | null) => void;
  toggleSavedWork: () => void;
  setComparison: (first: MechanismId, second: MechanismId) => void;
  clearComparison: () => void;
  setRecommendation: (recommendation: ArchitectureRecommendation, profile: WorkloadProfile) => void;
  setRecommendationStep: (index: number) => void;
  playStory: (mode: Exclude<StoryMode, null>, path?: MechanismId[]) => void;
  stopStory: () => void;
  togglePlaying: () => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  seek: (time: number) => void;
  step: (direction: 1 | -1) => void;
  setSimulationTime: (time: number) => void;
  setStoryIndex: (index: number) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setWorldInWordsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setJourneyPanelOpen: (open: boolean) => void;
  startJourney: (id: string) => void;
  stopJourney: () => void;
  setJourneyStep: (index: number) => void;
  setInspectorSnap: (snap: InspectorSnap) => void;
  reset: () => void;
};

const initial = {
  selectedMechanismId: null,
  selectedEvidenceId: null,
  evidenceComparisonId: null,
  hoveredMechanismId: null,
  viewLevel: "system" as ViewLevel,
  scenario: "healthy" as ScenarioMode,
  mergeFamilyId: "merge" as MergeFamilyId,
  latestReadStrategy: "background" as LatestReadStrategy,
  latestReadComparison: null as "argmax-vs-final" | null,
  selectedTidbitId: null as string | null,
  showSavedWork: false,
  comparisonIds: null as [MechanismId, MechanismId] | null,
  recommendation: null,
  recommendationProfile: null as WorkloadProfile | null,
  recommendationStepIndex: 0,
  storyMode: null as StoryMode,
  storyPath: [] as MechanismId[],
  storyEvents: [] as SimulationEvent[],
  storyIndex: 0,
  storyRevision: 0,
  playing: true,
  speed: 1,
  simulationTime: 0,
  reducedMotion: false,
  searchOpen: false,
  worldInWordsOpen: false,
  aboutOpen: false,
  journeyPanelOpen: false,
  activeJourneyId: null as string | null,
  journeyStepIndex: 0,
  inspectorSnap: "peek" as InspectorSnap,
};

export const useAtlasStore = create<AtlasState>((set, get) => ({
  ...initial,
  selectMechanism: (selectedMechanismId, level = "mechanism") => set({
    selectedMechanismId,
    selectedEvidenceId: null,
    evidenceComparisonId: null,
    searchOpen: false,
    viewLevel: selectedMechanismId ? level : "system",
    inspectorSnap: selectedMechanismId ? "peek" : "full",
    latestReadComparison: null,
  }),
  selectEvidence: (selectedEvidenceId) => set({ selectedEvidenceId, evidenceComparisonId: null, selectedMechanismId: null, selectedTidbitId: null, searchOpen: false, viewLevel: "system", inspectorSnap: "full", latestReadComparison: null }),
  setEvidenceComparison: (evidenceComparisonId) => set({ evidenceComparisonId }),
  hoverMechanism: (hoveredMechanismId) => set({ hoveredMechanismId }),
  setViewLevel: (viewLevel) => set({ viewLevel }),
  openXray: () => set((state) => ({ viewLevel: state.selectedMechanismId ? "xray" : "system", inspectorSnap: "peek" })),
  showSystem: () => set({ selectedMechanismId: null, selectedEvidenceId: null, evidenceComparisonId: null, viewLevel: "system", comparisonIds: null, latestReadComparison: null }),
  setScenario: (scenario) => {
    const operational = operationalScenarioById(scenario);
    const selectedMechanismId = operational.primaryMechanismId ?? get().selectedMechanismId;
    set({
      scenario,
      simulationTime: 0,
      playing: true,
      selectedMechanismId,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      selectedTidbitId: null,
      viewLevel: selectedMechanismId ? "mechanism" : get().viewLevel,
      inspectorSnap: selectedMechanismId ? "peek" : get().inspectorSnap,
      latestReadComparison: null,
    });
  },
  setMergeFamily: (mergeFamilyId) => set({ mergeFamilyId, selectedTidbitId: null, selectedMechanismId: null, selectedEvidenceId: null, evidenceComparisonId: null, viewLevel: "system", comparisonIds: null, latestReadComparison: null }),
  setLatestReadStrategy: (latestReadStrategy) => set({ latestReadStrategy, selectedTidbitId: null, latestReadComparison: null }),
  setLatestReadComparison: (latestReadComparison) => set({ latestReadComparison, selectedTidbitId: null }),
  selectTidbit: (selectedTidbitId) => set(selectedTidbitId ? {
    selectedTidbitId,
    selectedEvidenceId: null,
    evidenceComparisonId: null,
    selectedMechanismId: null,
    viewLevel: "system",
    inspectorSnap: "peek",
    latestReadComparison: null,
  } : { selectedTidbitId: null }),
  toggleSavedWork: () => set((state) => ({ showSavedWork: !state.showSavedWork })),
  setComparison: (first, second) => set({ comparisonIds: first === second ? null : [first, second], viewLevel: "mechanism" }),
  clearComparison: () => set({ comparisonIds: null }),
  setRecommendation: (recommendation, recommendationProfile) => {
    const firstDecision = recommendation.decisions[0];
    set({
      recommendation,
      recommendationProfile,
      recommendationStepIndex: 0,
      storyPath: recommendation.path,
      storyEvents: [],
      storyMode: null,
      storyIndex: 0,
      storyRevision: get().storyRevision + 1,
      simulationTime: 0,
      playing: false,
      selectedMechanismId: firstDecision?.mechanismId ?? recommendation.path[0] ?? null,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      viewLevel: firstDecision || recommendation.path.length ? "mechanism" : "system",
      scenario: "healthy",
      latestReadComparison: null,
      activeJourneyId: null,
      journeyStepIndex: 0,
      journeyPanelOpen: true,
      inspectorSnap: "peek",
    });
  },
  setRecommendationStep: (requestedIndex) => set((state) => {
    if (!state.recommendation?.decisions.length) return { recommendationStepIndex: 0 };
    const recommendationStepIndex = Math.min(Math.max(0, requestedIndex), state.recommendation.decisions.length - 1);
    const selectedMechanismId = state.recommendation.decisions[recommendationStepIndex]!.mechanismId;
    return {
      recommendationStepIndex,
      selectedMechanismId,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      selectedTidbitId: null,
      comparisonIds: null,
      latestReadComparison: null,
      viewLevel: "mechanism",
      scenario: "healthy",
      simulationTime: 0,
      playing: false,
      inspectorSnap: "peek",
    };
  }),
  playStory: (storyMode, path) => {
    const storyPath = path ?? (storyMode === "lifecycle" ? LIFECYCLE_PATH : get().recommendation?.path ?? []);
    const storyEvents = eventsForStory(storyMode, storyPath);
    set({
      storyMode,
      storyPath,
      storyEvents,
      storyIndex: 0,
      storyRevision: get().storyRevision + 1,
      simulationTime: 0,
      playing: true,
      selectedMechanismId: storyPath[0] ?? null,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      viewLevel: storyPath.length ? "mechanism" : "system",
      inspectorSnap: "peek",
      latestReadComparison: null,
    });
  },
  stopStory: () => set({ storyMode: null, storyPath: [], storyEvents: [], storyIndex: 0, playing: false }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed: Math.min(4, Math.max(0.25, speed)) }),
  seek: (simulationTime) => set((state) => {
    const index = Math.max(0, lastEventIndexAtOrBefore(state.storyEvents, simulationTime));
    const selectedMechanismId = state.storyEvents[index]?.subjectId ?? state.selectedMechanismId;
    return { simulationTime: Math.max(0, simulationTime), storyIndex: index, selectedMechanismId, playing: false, viewLevel: selectedMechanismId ? "mechanism" : state.viewLevel };
  }),
  step: (direction) => {
    const state = get();
    const simulationTime = nextEventTime(state.storyEvents, state.simulationTime, direction);
    const index = Math.max(0, lastEventIndexAtOrBefore(state.storyEvents, simulationTime));
    const selectedMechanismId = state.storyEvents[index]?.subjectId ?? state.selectedMechanismId;
    set({ simulationTime, storyIndex: index, selectedMechanismId, playing: false, viewLevel: selectedMechanismId ? "mechanism" : state.viewLevel });
  },
  setSimulationTime: (simulationTime) => set({ simulationTime }),
  setStoryIndex: (storyIndex) => set((state) => ({ storyIndex, selectedMechanismId: state.storyEvents[storyIndex]?.subjectId ?? state.selectedMechanismId })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setWorldInWordsOpen: (worldInWordsOpen) => set({ worldInWordsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setJourneyPanelOpen: (journeyPanelOpen) => set({ journeyPanelOpen }),
  startJourney: (activeJourneyId) => {
    const journey = useCaseJourneyById(activeJourneyId);
    if (!journey) return;
    const guide = resolveJourneyGuideStep(journey, 0);
    set({
      activeJourneyId,
      recommendationProfile: null,
      recommendationStepIndex: 0,
      journeyStepIndex: guide.index,
      journeyPanelOpen: true,
      mergeFamilyId: guide.familyId,
      latestReadStrategy: guide.latestReadStrategy,
      selectedTidbitId: null,
      storyMode: null,
      storyPath: [],
      storyEvents: [],
      storyIndex: 0,
      simulationTime: 0,
      playing: true,
      selectedMechanismId: null,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      viewLevel: "system",
      scenario: "healthy",
      comparisonIds: null,
      latestReadComparison: null,
      inspectorSnap: "peek",
    });
  },
  stopJourney: () => set({ activeJourneyId: null, journeyStepIndex: 0, journeyPanelOpen: false, recommendationProfile: null, recommendationStepIndex: 0, selectedTidbitId: null, storyMode: null, storyPath: [], storyEvents: [], storyIndex: 0, simulationTime: 0, playing: true, selectedMechanismId: null, selectedEvidenceId: null, evidenceComparisonId: null, viewLevel: "system", comparisonIds: null, latestReadComparison: null }),
  setJourneyStep: (requestedIndex) => set((state) => {
    const journey = state.activeJourneyId ? useCaseJourneyById(state.activeJourneyId) : undefined;
    if (!journey) return { journeyStepIndex: 0, selectedTidbitId: null };
    const guide = resolveJourneyGuideStep(journey, requestedIndex);
    return {
      journeyStepIndex: guide.index,
      mergeFamilyId: guide.familyId,
      latestReadStrategy: guide.latestReadStrategy,
      selectedMechanismId: null,
      selectedEvidenceId: null,
      evidenceComparisonId: null,
      selectedTidbitId: null,
      comparisonIds: null,
      latestReadComparison: null,
      viewLevel: "system",
      inspectorSnap: "peek",
    };
  }),
  setInspectorSnap: (inspectorSnap) => set({ inspectorSnap }),
  reset: () => set({ ...initial, storyRevision: get().storyRevision + 1, reducedMotion: get().reducedMotion }),
}));

export function currentStoryMechanism(state: Pick<AtlasState, "storyEvents" | "storyIndex">) {
  return state.storyEvents[state.storyIndex]?.subjectId ?? null;
}

function lastEventIndexAtOrBefore(events: SimulationEvent[], simulationTime: number) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].at <= simulationTime) return index;
  }
  return -1;
}

export function selectedDistrict(state: Pick<AtlasState, "selectedMechanismId">) {
  return mechanismById(state.selectedMechanismId)?.districtId ?? null;
}
