import { create } from "zustand";
import { LIFECYCLE_PATH } from "../data/knowledge";
import type { ArchitectureRecommendation, DistrictId, StoryMode } from "../types";

type AtlasState = {
  selectedNodeId: DistrictId | null;
  selectedEvidenceId: string | null;
  hoveredNodeId: DistrictId | null;
  recommendation: ArchitectureRecommendation | null;
  storyMode: StoryMode;
  storyPath: DistrictId[];
  storyIndex: number;
  storyRevision: number;
  playing: boolean;
  speed: number;
  simulationTime: number;
  reducedMotion: boolean;
  searchOpen: boolean;
  worldInWordsOpen: boolean;
  aboutOpen: boolean;
  selectNode: (id: DistrictId | null) => void;
  selectEvidence: (id: string | null) => void;
  hoverNode: (id: DistrictId | null) => void;
  setRecommendation: (recommendation: ArchitectureRecommendation) => void;
  playStory: (mode: Exclude<StoryMode, null>, path?: DistrictId[]) => void;
  stopStory: () => void;
  togglePlaying: () => void;
  setSpeed: (speed: number) => void;
  setSimulationTime: (time: number) => void;
  setStoryIndex: (index: number) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setWorldInWordsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  reset: () => void;
};

const initial = {
  selectedNodeId: null,
  selectedEvidenceId: null,
  hoveredNodeId: null,
  recommendation: null,
  storyMode: null as StoryMode,
  storyPath: [] as DistrictId[],
  storyIndex: 0,
  storyRevision: 0,
  playing: true,
  speed: 1,
  simulationTime: 0,
  reducedMotion: false,
  searchOpen: false,
  worldInWordsOpen: false,
  aboutOpen: false,
};

export const useAtlasStore = create<AtlasState>((set, get) => ({
  ...initial,
  selectNode: (selectedNodeId) => set({ selectedNodeId, selectedEvidenceId: null, searchOpen: false }),
  selectEvidence: (selectedEvidenceId) => set({ selectedEvidenceId, selectedNodeId: null, searchOpen: false }),
  hoverNode: (hoveredNodeId) => set({ hoveredNodeId }),
  setRecommendation: (recommendation) => set({
    recommendation,
    storyPath: recommendation.path,
    storyMode: "architecture",
    storyIndex: 0,
    storyRevision: get().storyRevision + 1,
    simulationTime: 0,
    playing: true,
    selectedNodeId: recommendation.path[0] ?? null,
    selectedEvidenceId: null,
  }),
  playStory: (storyMode, path) => {
    const storyPath = path ?? (storyMode === "lifecycle" ? LIFECYCLE_PATH : get().recommendation?.path ?? []);
    set({ storyMode, storyPath, storyIndex: 0, storyRevision: get().storyRevision + 1, simulationTime: 0, playing: true, selectedNodeId: storyPath[0] ?? null, selectedEvidenceId: null });
  },
  stopStory: () => set({ storyMode: null, storyPath: [], storyIndex: 0 }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  setSpeed: (speed) => set({ speed: Math.min(4, Math.max(0.25, speed)) }),
  setSimulationTime: (simulationTime) => set({ simulationTime }),
  setStoryIndex: (storyIndex) => set({ storyIndex }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setWorldInWordsOpen: (worldInWordsOpen) => set({ worldInWordsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  reset: () => set({ ...initial, storyRevision: get().storyRevision + 1, reducedMotion: get().reducedMotion }),
}));

export function currentStoryNode(state: Pick<AtlasState, "storyPath" | "storyIndex">) {
  return state.storyPath[state.storyIndex] ?? null;
}
