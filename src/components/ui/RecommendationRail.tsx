import { ChevronRight, Route, Sparkles } from "lucide-react";
import { LIFECYCLE_PATH, mechanismById } from "../../data/mechanisms";
import { useAtlasStore } from "../../store/useAtlasStore";

export function RecommendationRail() {
  const recommendation = useAtlasStore((state) => state.recommendation);
  const storyMode = useAtlasStore((state) => state.storyMode);
  const storyEvents = useAtlasStore((state) => state.storyEvents);
  const storyIndex = useAtlasStore((state) => state.storyIndex);
  const selected = useAtlasStore((state) => state.selectedMechanismId);
  const path = storyEvents.length ? storyEvents.map((event) => event.subjectId) : recommendation?.path ?? LIFECYCLE_PATH;
  return (
    <aside className="story-rail" aria-label="Architecture story path">
      <div className="story-rail-head">
        {recommendation ? <Sparkles size={14} /> : <Route size={14} />}
        <span><small>{recommendation ? "Agent architecture" : "Data lifecycle"}</small><strong>{recommendation?.summary ?? "One block becomes one answer"}</strong></span>
      </div>
      <ol>
        {path.map((id, index) => {
          const spec = mechanismById(id);
          if (!spec) return null;
          const active = storyEvents.length ? index === storyIndex : selected === id;
          return (
            <li key={`${id}-${index}`}>
              <button
                type="button"
                data-active={active}
                onClick={() => {
                  if (storyEvents[index]) useAtlasStore.getState().seek(storyEvents[index].at);
                  else useAtlasStore.getState().selectMechanism(id);
                }}
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span><strong>{spec.shortTitle}</strong><small>{spec.tempo}</small></span>
                <ChevronRight size={13} />
              </button>
            </li>
          );
        })}
      </ol>
      {storyMode && storyEvents[storyIndex] && <p className="story-narration" aria-live="polite">{storyEvents[storyIndex].narration}</p>}
    </aside>
  );
}
