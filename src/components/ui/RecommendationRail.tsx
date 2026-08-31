import { ChevronRight, Play, Route } from "lucide-react";
import { knowledgeById } from "../../data/knowledge";
import { useAtlasStore } from "../../store/useAtlasStore";

export function RecommendationRail() {
  const recommendation = useAtlasStore((state) => state.recommendation);
  const playStory = useAtlasStore((state) => state.playStory);
  const selectNode = useAtlasStore((state) => state.selectNode);
  if (!recommendation) return null;
  return (
    <section className="recommendation-rail" aria-label="Agent architecture recommendation">
      <div className="recommendation-title"><Route size={15} /><span><small>Agent architecture</small><strong>{recommendation.summary}</strong></span></div>
      <div className="recommendation-path">
        {recommendation.path.map((id, index) => {
          const node = knowledgeById(id);
          return node ? <div key={id}><button type="button" onClick={() => selectNode(id)}>{node.shortTitle}</button>{index < recommendation.path.length - 1 ? <ChevronRight size={12} /> : null}</div> : null;
        })}
      </div>
      <button type="button" className="play-recommendation" onClick={() => playStory("architecture", recommendation.path)}><Play size={14} />Play path</button>
    </section>
  );
}

