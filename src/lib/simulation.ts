import { ARCHITECTURE_FAILURE_PATH, LIFECYCLE_PATH, mechanismById } from "../data/mechanisms";
import type { MechanismId, SimulationEvent, SimulationEventType, StoryMode } from "../types";

const typeFor = (id: MechanismId): SimulationEventType => {
  if (id.startsWith("ingestion")) return id.includes("buffer") ? "buffer" : "arrive";
  if (id.startsWith("mergetree")) return id.includes("part-anatomy") ? "flush" : "merge";
  if (id.startsWith("read") || id.startsWith("precompute")) return "scan";
  if (id.startsWith("architecture")) return "replicate";
  if (id.startsWith("memory")) return "cache";
  if (id.startsWith("execution")) return "plan";
  if (id.startsWith("durability")) return "commit";
  if (id.startsWith("storage")) return "store";
  if (id.startsWith("observability")) return "observe";
  return "expire";
};

const lifecycleNarration: Partial<Record<MechanismId, string>> = {
  "ingestion.async-buffer": "Independent insert streams collect inside a shared asynchronous buffer.",
  "mergetree.part-anatomy": "The flushed block becomes a sorted, immutable columnar part.",
  "mergetree.sorted-merge": "Compatible parts interleave into a larger replacement in the background.",
  "read.sparse-index": "A predicate checks sparse index marks before columns are read.",
  "read.granules": "Whole granules outside the candidate range remain untouched.",
  "read.column-pruning": "Only columns required by the query lift into the scanner.",
  "read.parallel-pipeline": "Selected ranges divide across parallel processors and reconverge.",
  "precompute.materialized-view": "A repeated aggregate can be maintained as each new block arrives.",
  "retention.ttl-delete": "Aging data becomes TTL-eligible and leaves through background work.",
};

const architectureNarration: Partial<Record<MechanismId, string>> = {
  "architecture.sharding": "The shard key routes each row to one capacity boundary.",
  "architecture.replication": "Every shard sends committed parts to its replica partner.",
  "architecture.keeper": "Keeper coordinates replicated metadata on a separate quorum path.",
  "architecture.failure": "One replica fails; traffic reroutes while redundancy is reduced.",
  "architecture.recovery": "The returning replica fetches missing parts and converges.",
};

function eventsFromPath(path: MechanismId[], narration: Partial<Record<MechanismId, string>>): SimulationEvent[] {
  return path.map((subjectId, index) => {
    const mechanism = mechanismById(subjectId);
    return {
      at: index * 3.25,
      type: typeFor(subjectId),
      subjectId,
      fromState: mechanism?.states[0] ?? "Ready",
      toState: mechanism?.states[2] ?? "Complete",
      narration: narration[subjectId] ?? mechanism?.tagline ?? "The mechanism changes state.",
    };
  });
}

export const LIFECYCLE_EVENTS = eventsFromPath(LIFECYCLE_PATH, lifecycleNarration);
export const ARCHITECTURE_EVENTS = eventsFromPath(ARCHITECTURE_FAILURE_PATH, architectureNarration);

export function eventsForStory(mode: Exclude<StoryMode, null>, path?: MechanismId[]) {
  if (path?.length) return eventsFromPath(path, mode === "lifecycle" ? lifecycleNarration : architectureNarration);
  return mode === "lifecycle" ? LIFECYCLE_EVENTS : ARCHITECTURE_EVENTS;
}

export function storyDuration(events: SimulationEvent[]) {
  return events.length ? events[events.length - 1].at + 3.25 : 0;
}

export function eventIndexAtTime(events: SimulationEvent[], time: number) {
  if (!events.length) return -1;
  let index = 0;
  for (let cursor = 0; cursor < events.length; cursor += 1) {
    if (events[cursor].at <= time) index = cursor;
    else break;
  }
  return index;
}

export function eventAtTime(events: SimulationEvent[], time: number) {
  const index = eventIndexAtTime(events, time);
  return index >= 0 ? events[index] : null;
}

export function eventProgress(events: SimulationEvent[], time: number) {
  const index = eventIndexAtTime(events, time);
  if (index < 0) return 0;
  const start = events[index].at;
  const end = events[index + 1]?.at ?? start + 3.25;
  return Math.min(1, Math.max(0, (time - start) / Math.max(0.001, end - start)));
}

export function nextEventTime(events: SimulationEvent[], time: number, direction: 1 | -1 = 1) {
  if (!events.length) return 0;
  if (direction === 1) return events.find((event) => event.at > time + 0.01)?.at ?? storyDuration(events);
  return [...events].reverse().find((event) => event.at < time - 0.01)?.at ?? 0;
}
