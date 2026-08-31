import type { Tempo } from "../types";

export const TEMPO_LABEL: Record<Tempo, string> = {
  immediate: "Immediate",
  fast: "Fast",
  streaming: "Streaming",
  background: "Background",
  heavy: "Heavy",
  blocking: "Blocking",
};

export const TEMPO_WEIGHT: Record<Tempo, number> = {
  immediate: 5,
  fast: 4,
  streaming: 3,
  background: 2,
  heavy: 1,
  blocking: 0,
};

